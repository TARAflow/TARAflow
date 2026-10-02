// tests/unit/features/risks/services/impact-weight-source.test.ts
//
// Design §5.3 / phase 4: one source of weights for impact. Asset criteria and
// risk impact factors are the same quantities but carried independent
// weights — the same data gave two different means. The asset weights are
// the default; a weight the analyst overrides in the risk configuration wins.

import { describe, expect, it } from "vitest";
import { applyAssetImpactWeights } from "features/risks/services/impact-weight-source";
import { previewRiskDataChange } from "features/risks/services/impact-aggregation-preview";
import { withAssetImpactWeights } from "features/risks/utils/risks-tab-helpers";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";

const ratings = () => [
  { factorId: "financial_damage", value: 4, weight: 1 },
  { factorId: "privacy", value: 1, weight: 1 },
  { factorId: "skill_level", value: 2, weight: 1, source: "manual" },
];
const data = (impactWeightSource?: "asset" | "risk", withRisk = true, privacyManual = false): RiskData =>
  ({
    configuration: {
      ...DEFAULT_CONFIGURATION,
      activeFactors: [
        { factorId: "financial_damage", enabled: true, weight: 1 },
        { factorId: "privacy", enabled: true, weight: privacyManual ? 0.75 : 1, weightManual: privacyManual },
        { factorId: "skill_level", enabled: true, weight: 1 },
      ],
      ...(impactWeightSource ? { impactWeightSource } : {}),
    },
    risks: withRisk
      ? [{ id: "r1", threatDisplayId: "T1", factorRatings: ratings(), mitigatedFactorRatings: ratings() }]
      : [],
    lastModified: "",
  }) as unknown as RiskData;

// financial 3× as heavy as privacy in the asset configuration
const ASSET = { financial_damage: 0.75, privacy: 0.25, skill_level: 0.9 };

describe("applyAssetImpactWeights", () => {
  it("impact factors get the asset weight, likelihood keeps its own; values recalculated", () => {
    const next = applyAssetImpactWeights(data(), ASSET)!;
    const af = Object.fromEntries(next.configuration.activeFactors.map((f) => [f.factorId, f.weight]));
    expect(af).toEqual({ financial_damage: 0.75, privacy: 0.25, skill_level: 1 });
    expect(next.configuration.impactWeightSource).toBe("asset");
    const r = next.risks[0];
    expect(r.factorRatings.find((x) => x.factorId === "privacy")!.weight).toBe(0.25);
    expect(r.factorRatings.find((x) => x.factorId === "skill_level")).toMatchObject({ weight: 1, source: "manual" });
    // (4·0.75 + 1·0.25) / 1 = 3.25 → 3.3 instead of 2.5
    expect(r.calculatedImpact).toBe(3.3);
  });

  it("a weight the analyst overrode in the risk configuration wins", () => {
    const next = applyAssetImpactWeights(data(undefined, true, true), ASSET)!;
    const af = Object.fromEntries(next.configuration.activeFactors.map((f) => [f.factorId, f.weight]));
    expect(af.privacy).toBe(0.75);
    expect(af.financial_damage).toBe(0.75);
    expect(next.risks[0].factorRatings.find((x) => x.factorId === "privacy")!.weight).toBe(1);
  });

  it("nothing to change → null; no asset weights → null", () => {
    const once = applyAssetImpactWeights(data(), ASSET)!;
    expect(applyAssetImpactWeights(once, ASSET)).toBeNull();
    expect(applyAssetImpactWeights(data(), undefined)).toBeNull();
  });

  it("the preview shows the value change before it is applied", () => {
    const d = data();
    const rows = previewRiskDataChange(d, applyAssetImpactWeights(d, ASSET)!);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ impactBefore: 2.5, impactAfter: 3.3 });
  });
});

describe("withAssetImpactWeights (risk tab)", () => {
  it("existing project with risks and no setting: untouched (explicit switch in the dialog)", () => {
    expect(withAssetImpactWeights(data(), ASSET)).toBeNull();
  });

  it("no risks yet: switches to the asset weights directly", () => {
    expect(withAssetImpactWeights(data(undefined, false), ASSET)?.configuration.impactWeightSource).toBe("asset");
  });

  it('"asset": follows asset weight changes; "risk": never', () => {
    const asset = applyAssetImpactWeights(data(), ASSET)!;
    const changed = withAssetImpactWeights(asset, { ...ASSET, privacy: 0.5 })!;
    expect(changed.risks[0].factorRatings.find((x) => x.factorId === "privacy")!.weight).toBe(0.5);
    expect(withAssetImpactWeights(data("risk"), ASSET)).toBeNull();
  });
});
