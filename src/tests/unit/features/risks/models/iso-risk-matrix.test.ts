// tests/unit/features/risks/models/iso-risk-matrix.test.ts
//
// ISO/SAE 21434 conformance plan 3a (decisions 20, 22): golden values of the
// risk matrix Annex H, Table H.8, the H.9 examples, Table F.1 and the numeric
// safety rule, the iso_* fallback and the reverse Mapping B.

import { describe, it, expect } from "vitest";

import {
  ISO_IMPACT_LEVELS,
  ISO_FEASIBILITY_LEVELS,
  ISO_SAFETY_LEVEL_F1,
  feasibilityFromRiskScaleValue,
  isoFeasibilityFromFactors,
  isoImpactFromRating,
  isoRiskValue,
  isoSafetyFromRating,
} from "features/risks/models/iso-risk-matrix";

describe("golden: risk matrix Annex H, Table H.8", () => {
  it("all 16 cells", () => {
    const table = ISO_IMPACT_LEVELS.map((i) =>
      ISO_FEASIBILITY_LEVELS.map((f) => isoRiskValue(i, f)),
    );
    // rows negligible → severe, columns very low → high (as in H.8, bottom-up)
    expect(table).toEqual([
      [1, 1, 1, 1],
      [1, 2, 2, 3],
      [1, 2, 3, 4],
      [2, 3, 4, 5],
    ]);
  });

  it("extremes are 1 and 5 (RQ-15-16)", () => {
    expect(isoRiskValue("negligible", "very-low")).toBe(1);
    expect(isoRiskValue("severe", "high")).toBe(5);
  });

  it("Table H.9 examples: High × Severe → 5, Low × Moderate → 2", () => {
    expect(isoRiskValue("severe", "high")).toBe(5);
    expect(isoRiskValue("moderate", "low")).toBe(2);
  });
});

describe("impact levels", () => {
  it("non-safety categories: 1 negligible … 4 severe, 0 / n/a not rated", () => {
    expect([1, 2, 3, 4].map(isoImpactFromRating)).toEqual([
      "negligible",
      "moderate",
      "major",
      "severe",
    ]);
    expect(isoImpactFromRating(0)).toBeUndefined();
    expect(isoImpactFromRating("na")).toBeUndefined();
    expect(isoImpactFromRating(null)).toBeUndefined();
  });

  it("safety categorical (Table F.1)", () => {
    expect(ISO_SAFETY_LEVEL_F1).toEqual({
      none: "negligible",
      reversible_minor: "moderate",
      reversible_major: "moderate",
      irreversible_minor: "major",
      irreversible_major: "major",
      fatal: "severe",
    });
  });

  it("safety numeric = Se factor: 1, 2 moderate; 3 major; 4 severe and ambiguous; 0 not rated", () => {
    expect(isoSafetyFromRating(1)).toEqual({ level: "moderate", ambiguous: false });
    expect(isoSafetyFromRating(2)).toEqual({ level: "moderate", ambiguous: false });
    expect(isoSafetyFromRating(3)).toEqual({ level: "major", ambiguous: false });
    expect(isoSafetyFromRating(4)).toEqual({ level: "severe", ambiguous: true });
    expect(isoSafetyFromRating(0)).toBeUndefined();
  });
});

describe("feasibility inputs", () => {
  it("iso_* fallback: all five factors needed (Annex H.7 row 1: AP 20 → low)", () => {
    const r = (id: string, value: number) => ({ factorId: id, value });
    const h7 = [
      r("iso_elapsed_time", 2),
      r("iso_expertise", 4),
      r("iso_knowledge", 3),
      r("iso_window_of_opportunity", 1),
      r("iso_equipment", 2),
    ];
    expect(isoFeasibilityFromFactors(h7)).toEqual({ attackPotential: 20, feasibility: "low" });
    expect(isoFeasibilityFromFactors(h7.slice(1))).toBeNull();
  });

  it("reverse Mapping B from the risk scale; 3-level ambiguity → the higher level", () => {
    expect(feasibilityFromRiskScaleValue(4, "4-level")).toBe("high");
    expect(feasibilityFromRiskScaleValue(5, "5-level")).toBe("high");
    expect(feasibilityFromRiskScaleValue(1, "3-level")).toBe("low");
    expect(feasibilityFromRiskScaleValue(5, "4-level")).toBeUndefined();
    expect(feasibilityFromRiskScaleValue(0, "4-level")).toBeUndefined();
  });
});
