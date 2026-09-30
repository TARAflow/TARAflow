// tests/unit/shared/utils/threat-impact.test.ts
//
// Phase 4 of the security-goal rework: the impact of a threat comes from the
// security goals it violates (design doc §4.3, mandatory cases §4.5).
// Each case runs through applyAssetCriteriaToFactorRatings — the function the
// risk sync and the risk dialog use — so the risk actually gets these values.

import { describe, it, expect } from "vitest";
import { resolveThreatImpactAssets } from "shared";
import type { AssetDataReference, AssetReference, StrideCategory } from "shared";
import { applyAssetCriteriaToFactorRatings } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { FactorRating } from "features/risks/models/risk-factor-types";

type Goal = NonNullable<AssetReference["securityGoals"]>[number];

const asset = (id: string, safety: number, goals: Goal[]): AssetReference => ({
  id,
  name: id,
  assetGroup: "data",
  impactRatings: [{ criterionId: "safety", value: safety }],
  securityGoals: goals,
});
const I = (override?: number): Goal => ({
  type: "I",
  level: "high",
  ...(override !== undefined ? { impactRatings: [{ criterionId: "safety", value: override }] } : {}),
});

const config: RiskConfiguration = { ...DEFAULT_CONFIGURATION, useAssetImpact: true };
const ref = (assets: AssetReference[]): AssetDataReference => ({ assets, hasSafetyAssets: false, impactScale: "4-level" });

/** Derived safety factor for a threat of the given STRIDE category. */
function safetyFactor(assets: AssetReference[], stride: StrideCategory): number {
  const ratings: FactorRating[] = [{ factorId: "safety", value: 0, weight: 1 }];
  return applyAssetCriteriaToFactorRatings(ratings, assets, ref(assets), config, stride)[0].value;
}

describe("mandatory cases (design §4.5) — integrity threat (T)", () => {
  it("1: A safety 4 with goal I adjusted to 2, B safety 3 inheriting → 3 (not 4)", () => {
    expect(safetyFactor([asset("A", 4, [I(2)]), asset("B", 3, [I()])], "T")).toBe(3);
  });

  it("2: A safety 4 adjusted to 2, B safety 3 without goal I → 2 — B contributes nothing", () => {
    expect(safetyFactor([asset("A", 4, [I(2)]), asset("B", 3, [])], "T")).toBe(2);
  });

  it("3: no linked asset has an active goal I → fallback to the asset values (4)", () => {
    const r = resolveThreatImpactAssets([asset("A", 4, []), asset("B", 3, [])], "T");
    expect(r.matched).toBe(false);
    expect(safetyFactor([asset("A", 4, []), asset("B", 3, [])], "T")).toBe(4);
  });

  it("4: A safety 2 with goal I adjusted to 3 (conflict) → 3 — the override applies (invariant E)", () => {
    expect(safetyFactor([asset("A", 2, [I(3)])], "T")).toBe(3);
  });

  it("5: repudiation threat — goal N 2, goal Acc 3 → 3 (MAX over N and Acc)", () => {
    const a: AssetReference = {
      ...asset("A", 4, []),
      securityGoals: [
        { type: "N", level: "medium", impactRatings: [{ criterionId: "safety", value: 2 }] },
        { type: "Acc", level: "high", impactRatings: [{ criterionId: "safety", value: 3 }] },
      ],
    };
    expect(safetyFactor([a], "R")).toBe(3);
  });
});

describe("resolveThreatImpactAssets", () => {
  it("inactive goals do not count", () => {
    const a = asset("A", 4, [{ type: "I", level: "none" }]);
    expect(resolveThreatImpactAssets([a], "T").matched).toBe(false);
  });

  it("n/a and unrated overrides enter no aggregation", () => {
    const a: AssetReference = {
      ...asset("A", 4, []),
      securityGoals: [
        { type: "N", level: "low", impactRatings: [{ criterionId: "safety", value: "na" }] },
        { type: "Acc", level: "low" }, // inherits 4
      ],
    };
    expect(resolveThreatImpactAssets([a], "R").assets[0].impactRatings).toEqual([{ criterionId: "safety", value: 4 }]);
  });

  it("without STRIDE the risk prefill keeps the previous behaviour (all assets, asset values)", () => {
    const assets = [asset("A", 4, [I(2)]), asset("B", 3, [])];
    const ratings: FactorRating[] = [{ factorId: "safety", value: 0, weight: 1 }];
    expect(applyAssetCriteriaToFactorRatings(ratings, assets, ref(assets), config)[0].value).toBe(4);
  });
});

describe("buildAssetDataReference carries per-goal impact", () => {
  it("active goals keep their overrides; goals without overrides stay lean", async () => {
    const { buildAssetDataReference } = await import("app/utils/build-asset-data-reference");
    const ref = buildAssetDataReference(
      [
        {
          id: "A", name: "A", assetGroup: "data", properties: {}, linkedDFDElements: [],
          impactRatings: [{ criterionId: "safety", value: 4 }],
          securityGoals: [
            { type: "I", level: "high", formalDescription: "", impactRatings: [{ criterionId: "safety", value: 2 }] },
            { type: "A", level: "high", formalDescription: "" },
            { type: "C", level: "none", formalDescription: "" },
          ],
        } as any,
      ],
      {} as any,
      "4-level",
    );
    expect(ref.assets[0].securityGoals).toEqual([
      { type: "I", level: "high", impactRatings: [{ criterionId: "safety", value: 2 }] },
      { type: "A", level: "high" },
    ]);
  });
});
