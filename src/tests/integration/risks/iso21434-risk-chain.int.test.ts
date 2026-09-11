// ISO/SAE 21434 risk-chain composition — integration test.
//
// Proves the seams the individual unit tests do NOT cover compose correctly for
// an ISO project, exercising the REAL services (no mocks):
//
//   Asset SFOP impact  ──applyAssetCriteriaToFactorRatings──►  impact factors
//   ISO 18045 factors  ──scoreTableLikelihood (iso-21434)───►  likelihood
//                       calculateRiskValues → R = I × L
//
// In exclusive mode all impact factors are locked off, so impact can ONLY come
// from asset-impact (design DS-4). The third case proves the exact silent-zero
// that DS-4 / the useAssetImpact enforcement prevents.

import { describe, it, expect } from "vitest";
import {
  calculateRiskValues,
  applyAssetCriteriaToFactorRatings,
} from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { FactorRating } from "features/risks/models/risk-factor-types";
import type { AssetReference, AssetDataReference } from "shared";

const SFOP_IMPACT_FACTORS = [
  "safety",
  "financial_damage",
  "operational",
  "privacy",
] as const;

const ISO_LIKELIHOOD_FACTORS = [
  "iso_elapsed_time",
  "iso_expertise",
  "iso_knowledge",
  "iso_window_of_opportunity",
  "iso_equipment",
] as const;

// A fresh rating set: SFOP impact factors unrated (0), ISO factors rated at
// value 1 (lowest attack potential → highest feasibility → non-zero likelihood).
const freshRatings = (): FactorRating[] => [
  ...SFOP_IMPACT_FACTORS.map((factorId) => ({ factorId, value: 0, weight: 1 })),
  ...ISO_LIKELIHOOD_FACTORS.map((factorId) => ({ factorId, value: 1, weight: 1 })),
];

const isoConfig = (useAssetImpact: boolean): RiskConfiguration => ({
  ...DEFAULT_CONFIGURATION,
  likelihoodMethod: "iso-21434",
  useAssetImpact,
});

// One linked asset carrying SFOP impact: three criteria rated directly, plus a
// physical (safety) impact that the safety factor derives from.
const linkedAsset: AssetReference = {
  id: "AS-001",
  name: "Vehicle location data",
  assetGroup: "data",
  physicalImpact: "irreversible_injury",
  impactRatings: [
    { criterionId: "financial_damage", value: 3 },
    { criterionId: "operational", value: 2 },
    { criterionId: "privacy", value: 4 },
  ],
};

const assetDataRef: AssetDataReference = {
  assets: [linkedAsset],
  hasSafetyAssets: true,
  impactScale: "4-level",
};

const ratingFor = (ratings: FactorRating[], id: string) =>
  ratings.find((r) => r.factorId === id);

describe("ISO 21434 risk chain (integration)", () => {
  it("prefills every SFOP impact factor from the linked asset", () => {
    const prefilled = applyAssetCriteriaToFactorRatings(
      freshRatings(),
      [linkedAsset],
      assetDataRef,
      isoConfig(true),
    );

    for (const id of SFOP_IMPACT_FACTORS) {
      const r = ratingFor(prefilled, id);
      expect(r, `impact factor ${id} present`).toBeDefined();
      expect(r!.value, `impact factor ${id} derived > 0`).toBeGreaterThan(0);
      expect(r!.source, `impact factor ${id} marked derived`).toBe("derived");
    }
    // 1:1 criterion → factor match on the non-safety criteria (4-level asset =
    // 4-level risk scale, so no rescale).
    expect(ratingFor(prefilled, "privacy")!.value).toBe(4);
    expect(ratingFor(prefilled, "financial_damage")!.value).toBe(3);
    expect(ratingFor(prefilled, "operational")!.value).toBe(2);
  });

  it("yields non-zero R = I × L from asset SFOP impact + ISO feasibility", () => {
    const config = isoConfig(true);
    const prefilled = applyAssetCriteriaToFactorRatings(
      freshRatings(),
      [linkedAsset],
      assetDataRef,
      config,
    );
    const result = calculateRiskValues(prefilled, config);

    expect(result.impact, "impact from asset SFOP").toBeGreaterThan(0);
    expect(result.likelihood, "likelihood from ISO score table").toBeGreaterThan(0);
    expect(result.risk, "risk = I × L").toBeGreaterThan(0);
  });

  it("DS-4: without useAssetImpact the ISO impact axis is empty → risk 0", () => {
    // Exclusive mode locks impact factors off; with useAssetImpact = false the
    // prefill is skipped, so impact has no source at all. This is the silent
    // zero the DS-4 enforcement (threadUseAssetImpact + dialog lock) prevents.
    const config = isoConfig(false);
    const prefilled = applyAssetCriteriaToFactorRatings(
      freshRatings(),
      [linkedAsset],
      assetDataRef,
      config,
    );
    const result = calculateRiskValues(prefilled, config);

    expect(result.impact).toBe(0);
    expect(result.risk).toBe(0);
    // Likelihood is unaffected — it comes from the ISO factors, not the asset.
    expect(result.likelihood).toBeGreaterThan(0);
  });
});
