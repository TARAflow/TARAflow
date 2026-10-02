// Design §5.6, phase 5 scope A: ISO/SAE 21434 15.8 NOTE 1 — the risk per
// impact category behind the one register value. Display only.

import { describe, expect, it } from "vitest";
import { isoRiskByCategory } from "features/risks/services/iso-risk-by-category";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

const r = (factorId: string, value: number) => ({ factorId, value, weight: 1 });
const cfg = { ...DEFAULT_CONFIGURATION, impactAggregation: "max" as const };

describe("isoRiskByCategory", () => {
  const ratings = [r("safety", 4), r("financial_damage", 1), r("privacy", 2), r("operational", 0), r("skill_level", 3)];

  it("one value per rated category, in S F O P order; unrated categories left out", () => {
    const rows = isoRiskByCategory(ratings, cfg);
    expect(rows.map((c) => c.short)).toEqual(["S", "F", "P"]);
    expect(rows.map((c) => [c.impact, c.risk])).toEqual([
      [4, 12],
      [1, 3],
      [2, 6],
    ]);
  });

  it("under max, the highest category is the register value", () => {
    const top = Math.max(...isoRiskByCategory(ratings, cfg).map((c) => c.risk));
    expect(top).toBe(calculateRiskValues(ratings, cfg).risk);
  });

  it("levels come from the project's scale and thresholds", () => {
    const rows = isoRiskByCategory(ratings, cfg);
    expect(rows[0].level).not.toBe(rows[1].level);
  });

  it("no category rated → nothing", () => {
    expect(isoRiskByCategory([r("skill_level", 2)], cfg)).toEqual([]);
  });
});

describe("isoRiskByCategory — partial configuration (report on old files)", () => {
  it("no customFactors / activeFactors → still computes", () => {
    const partial = { likelihoodMethod: "iso-21434", impactAggregation: "max" } as never;
    expect(() => isoRiskByCategory([r("safety", 4), r("skill_level", 3)], partial)).not.toThrow();
  });
});
