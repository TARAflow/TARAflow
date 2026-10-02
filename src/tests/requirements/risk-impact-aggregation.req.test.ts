// src/tests/requirements/risk-impact-aggregation.req.test.ts
//
// Requirement tests for doc/Open/Risk/risk-impact-aggregation-design.md
// (requirements §4, Part B §7.4). One describe per requirement id (RA-xx,
// see doc/Test/requirements-test-matrix.md). Real services end to end:
// asset → reference → risk factors → calculation → preview → report.

import { describe, expect, it } from "vitest";
import { REGULATION_PRESETS } from "shared";
import type { ImpactAggregation } from "shared";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";
import { createDefaultRiskData } from "features/risks/models/risk-assessment-types";
import {
  applyAssetCriteriaToFactorRatings,
  calculateRiskValues,
  explainImpact,
} from "features/risks/services/risk-calculation-service";
import { previewImpactAggregation } from "features/risks/services/impact-aggregation-preview";
import { applyAssetImpactWeights } from "features/risks/services/impact-weight-source";
import { isoRiskByCategory } from "features/risks/services/iso-risk-by-category";
import {
  withAssetImpactWeights,
  withRecommendedImpactAggregation,
} from "features/risks/utils/risks-tab-helpers";
import { impactBasisText } from "features/risks/utils/impact-basis-text";
import { factorLevelOptions } from "features/risks/utils/factor-level-options";
import { impactAggregationSentence } from "features/documentation/utils/impact-aggregation-text";
import { assetRef, dataAsset, r } from "./builders";

const t = (key: string, o?: Record<string, unknown>) =>
  String(o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n]));

const LIKELIHOOD = { factorId: "skill_level", value: 2, weight: 1 };
const IMPACT = ["safety", "financial_damage", "operational", "privacy", "physical_damage", "environmental"];

/** The risk of one threat on asset `a`: impact factors filled from the asset as in the app. */
function riskFor(ratings: ReturnType<typeof r>[], config: RiskConfiguration) {
  const asset = dataAsset("a", ratings);
  const ref = assetRef([asset]);
  const filled = applyAssetCriteriaToFactorRatings(
    [...IMPACT.map((factorId) => ({ factorId, value: 0, weight: 1 })), LIKELIHOOD],
    ref.assets,
    ref,
    { ...config, useAssetImpact: true },
  );
  return { ratings: filled, values: calculateRiskValues(filled, config) };
}
const cfg = (impactAggregation?: ImpactAggregation): RiskConfiguration => ({
  ...DEFAULT_CONFIGURATION,
  ...(impactAggregation ? { impactAggregation } : {}),
});
const SFOP = (s: number, f: number, o: number, p: number) => [
  r("safety", s),
  r("financial_damage", f),
  r("operational", o),
  r("privacy", p),
];

// ─────────────────────────────────────────────────────────────────────────────
describe("RA-01 (req. 1, 4) the worst harm is never diluted", () => {
  it("safety 4 next to three harmless factors: harm floor 4 (weighted mean would give 1.8)", () => {
    expect(riskFor(SFOP(4, 1, 1, 1), cfg()).values.impact).toBe(1.8);
    expect(riskFor(SFOP(4, 1, 1, 1), cfg("harm-floor")).values.impact).toBe(4);
  });

  it("environment and physical damage share the floor (Q3)", () => {
    const env = [r("environmental", 4), r("financial_damage", 1), r("operational", 1)];
    expect(riskFor(env, cfg("harm-floor")).values.impact).toBe(4);
  });
});

describe("RA-02 (req. 2) the aggregation is a property of the preset", () => {
  it("standard / EN 50742 A and B: harm floor; ISO 21434 / ETSI TVRA: maximum", () => {
    expect(REGULATION_PRESETS.standard.impactAggregation).toBe("harm-floor");
    expect(REGULATION_PRESETS["en-50742-a"].impactAggregation).toBe("harm-floor");
    expect(REGULATION_PRESETS["en-50742-b"].impactAggregation).toBe("harm-floor");
    expect(REGULATION_PRESETS["iso-21434"].impactAggregation).toBe("max");
    expect(REGULATION_PRESETS["etsi-tvra"].impactAggregation).toBe("max");
  });

  it("a new project (no risks yet) takes the preset recommendation directly", () => {
    const next = withRecommendedImpactAggregation(createDefaultRiskData(), "max");
    expect(next?.configuration.impactAggregation).toBe("max");
  });
});

describe("RA-03 (req. 3) the standard preset still weighs business consequences", () => {
  it("S1 F4 O1 P1: harm floor 2 (mean of F/O/P), maximum would be 4", () => {
    expect(riskFor(SFOP(1, 4, 1, 1), cfg("harm-floor")).values.impact).toBe(2);
    expect(riskFor(SFOP(1, 4, 1, 1), cfg("max")).values.impact).toBe(4);
  });
});

describe("RA-04 (req. 5) one weight source: asset weights by default, overridable", () => {
  const ratings = [
    { factorId: "financial_damage", value: 4, weight: 1 },
    { factorId: "privacy", value: 1, weight: 1 },
    LIKELIHOOD,
  ];
  const data = (privacyOverride?: number): RiskData =>
    ({
      ...createDefaultRiskData(),
      configuration: {
        ...DEFAULT_CONFIGURATION,
        activeFactors: [
          { factorId: "financial_damage", enabled: true, weight: 1 },
          privacyOverride === undefined
            ? { factorId: "privacy", enabled: true, weight: 1 }
            : { factorId: "privacy", enabled: true, weight: privacyOverride, weightManual: true },
          { factorId: "skill_level", enabled: true, weight: 1 },
        ],
        impactWeightSource: "asset",
      },
      risks: [{ id: "r1", threatDisplayId: "T1", factorRatings: ratings, mitigatedFactorRatings: ratings }],
    }) as unknown as RiskData;
  const ASSET_WEIGHTS = { financial_damage: 0.75, privacy: 0.25 };

  it("the asset criterion weights apply to the risk impact", () => {
    const next = applyAssetImpactWeights(data(), ASSET_WEIGHTS)!;
    expect(next.risks[0].calculatedImpact).toBe(3.3); // (4·0.75 + 1·0.25)
  });

  it("a weight the analyst overrides in the risk configuration wins", () => {
    const next = applyAssetImpactWeights(data(0.75), ASSET_WEIGHTS)!;
    const w = Object.fromEntries(next.configuration.activeFactors.map((f) => [f.factorId, f.weight]));
    expect(w).toMatchObject({ financial_damage: 0.75, privacy: 0.75 });
  });
});

describe("RA-05 (req. 6) existing projects never change silently", () => {
  const legacy = (): RiskData => {
    const { ratings, values } = riskFor(SFOP(4, 1, 1, 1), cfg());
    const { impactAggregation: _a, ...configuration } = cfg();
    return {
      ...createDefaultRiskData(),
      configuration,
      risks: [
        {
          id: "r1",
          threatDisplayId: "T1",
          factorRatings: ratings,
          mitigatedFactorRatings: ratings,
          calculatedImpact: values.impact,
          calculatedRiskBeforeMitigation: values.risk,
        },
      ],
    } as unknown as RiskData;
  };

  it("a project without the setting keeps the weighted mean", () => {
    const d = legacy();
    expect(calculateRiskValues(d.risks[0].factorRatings, d.configuration).impact).toBe(1.8);
  });

  it("with risks, neither the preset recommendation nor the asset weights are applied automatically", () => {
    expect(withRecommendedImpactAggregation(legacy(), "harm-floor")).toBeNull();
    expect(withAssetImpactWeights(legacy(), { safety: 0.5, financial_damage: 0.5 })).toBeNull();
  });

  it("switching shows every changed risk before it is applied", () => {
    const rows = previewImpactAggregation(legacy(), "harm-floor");
    expect(rows).toEqual([
      expect.objectContaining({ riskId: "r1", impactBefore: 1.8, impactAfter: 4, levelChanged: true }),
    ]);
  });
});

describe("RA-06 (req. 7) the analyst sees how the impact was formed", () => {
  it("risk dialog line names the factor that sets the impact", () => {
    const { ratings } = riskFor(SFOP(4, 1, 1, 1), cfg("harm-floor"));
    const line = impactBasisText(explainImpact(ratings, cfg("harm-floor")), t, (id) => id);
    expect(line).toBe("Impact 4 — safety (harm floor)");
  });

  it("report states the project's aggregation", () => {
    expect(impactAggregationSentence("harm-floor", "en")).toMatch(/^Impact aggregation: harm floor/);
    expect(impactAggregationSentence(undefined, "en")).toMatch(/weighted mean/);
  });
});

describe("RA-07 (Part B §7.4) likelihood levels name the situation they stand for", () => {
  const labels = (id: string, scale: "3-level" | "4-level" | "5-level", method?: string) =>
    factorLevelOptions(id, "likelihood", { scale, likelihoodMethod: method } as never, false, t).options.map(
      (o) => o.label,
    );

  it("skill level 4 reads 'No technical skills', not 'High'", () => {
    expect(labels("skill_level", "4-level")[3]).toBe("4 – No technical skills");
  });

  it("ETSI TVRA: the norm's levels with the value, own number of levels per factor", () => {
    expect(labels("time", "4-level", "etsi-tvra")).toHaveLength(5);
    expect(labels("time", "4-level", "etsi-tvra")[1]).toBe("≤ 1 week (2)");
    expect(labels("etsi_intensity", "4-level", "etsi-tvra")).toHaveLength(3);
  });

  it("custom factors keep the generic scale with the direction hint", () => {
    const o = factorLevelOptions("my_factor", "likelihood", { scale: "4-level" } as never, false, t);
    expect(o.directionHint).toBe("1 = attack unlikely … 4 = attack likely");
  });
});

describe("RA-08 (§5.6 scope A) ISO/SAE 21434: risk per impact category", () => {
  it("one value per rated category; the highest equals the register value under maximum", () => {
    const config = cfg("max");
    const { ratings, values } = riskFor(SFOP(4, 1, 0, 2), config);
    const cats = isoRiskByCategory(ratings, config);
    expect(cats.map((c) => c.short)).toEqual(["S", "F", "P"]);
    expect(Math.max(...cats.map((c) => c.risk))).toBe(values.risk);
  });
});
