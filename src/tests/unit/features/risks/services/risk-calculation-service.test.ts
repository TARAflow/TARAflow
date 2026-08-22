import { describe, it, expect } from "vitest";
import { calculateRiskValues } from "features/risks";
import type { FactorRating, RiskConfiguration } from "features/risks";
import type { LikelihoodMethod } from "shared";

// Minimal RiskConfiguration — calculateRiskValues only reads customFactors,
// scale and likelihoodMethod for the likelihood computation.
const config = (
  likelihoodMethod: LikelihoodMethod | undefined,
  scale: RiskConfiguration["scale"],
): RiskConfiguration =>
  ({
    scale,
    likelihoodMethod,
    customFactors: [],
  }) as unknown as RiskConfiguration;

const rate = (o: Record<string, number>): FactorRating[] =>
  Object.entries(o).map(([factorId, value]) => ({
    factorId,
    value,
    weight: 1,
    source: "manual",
  })) as unknown as FactorRating[];

describe("calculateRiskValues — ISO 21434 score-table likelihood", () => {
  it("all-lowest levels → highest likelihood (4 on a 4-level scale)", () => {
    const ratings = rate({
      iso_elapsed_time: 1,
      iso_expertise: 1,
      iso_knowledge: 1,
      iso_window_of_opportunity: 1,
      iso_equipment: 1,
    });
    expect(
      calculateRiskValues(ratings, config("iso-21434", "4-level")).likelihood,
    ).toBe(4);
  });

  it("high-effort worked example (AP 47 → very-low) → lowest likelihood (1)", () => {
    const ratings = rate({
      iso_elapsed_time: 4, // <=6months = 17
      iso_expertise: 3, // expert = 6
      iso_knowledge: 3, // confidential = 7
      iso_window_of_opportunity: 4, // difficult = 10
      iso_equipment: 3, // bespoke = 7
    });
    expect(
      calculateRiskValues(ratings, config("iso-21434", "4-level")).likelihood,
    ).toBe(1);
  });

  it("unrated → likelihood 0", () => {
    expect(
      calculateRiskValues([], config("iso-21434", "4-level")).likelihood,
    ).toBe(0);
  });
});

describe("calculateRiskValues — ETSI TVRA score-table likelihood", () => {
  it("all-lowest levels → highest likelihood (5 on a 5-level scale)", () => {
    const ratings = rate({
      time: 1,
      expertise: 1,
      knowledge: 1,
      etsi_opportunity: 1,
      equipment: 1,
      etsi_intensity: 1,
    });
    expect(
      calculateRiskValues(ratings, config("etsi-tvra", "5-level")).likelihood,
    ).toBe(5);
  });

  it("high-effort worked example (AP 53 → beyond-high) → lowest likelihood (1)", () => {
    const ratings = rate({
      time: 4, // <=6months = 17
      expertise: 3, // expert = 6
      knowledge: 4, // critical = 11
      etsi_opportunity: 4, // difficult = 10
      equipment: 3, // bespoke = 7
      etsi_intensity: 3, // heavy = 2
    });
    expect(
      calculateRiskValues(ratings, config("etsi-tvra", "5-level")).likelihood,
    ).toBe(1);
  });
});

describe("calculateRiskValues — weighted-mean (default) is unchanged", () => {
  it("undefined method falls back to the weighted mean of likelihood factors", () => {
    // Two standard likelihood factors rated 4 and 2 (equal weight) → mean 3.
    const ratings = rate({ skill_level: 4, motive: 2 });
    expect(
      calculateRiskValues(ratings, config(undefined, "5-level")).likelihood,
    ).toBe(3);
  });

  it("does not route standard factors through the score-table path", () => {
    // ISO factor ids are ignored by the weighted-mean path.
    const ratings = rate({ skill_level: 5 });
    expect(
      calculateRiskValues(ratings, config("weighted-mean", "5-level"))
        .likelihood,
    ).toBe(5);
  });
});
