import { describe, it, expect } from "vitest";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { FactorRating } from "features/risks/models/risk-factor-types";

const isoConfig = (): RiskConfiguration => ({
  ...DEFAULT_CONFIGURATION,
  likelihoodMethod: "iso-21434",
});

// Impact from a derived asset SFOP factor; likelihood from the attack tree.
const impact: FactorRating = { factorId: "safety", value: 4, weight: 1 };

describe("ISO 21434 likelihood from the attack tree", () => {
  it("uses attack_tree_likelihood as the likelihood when iso_* are unrated", () => {
    const ratings: FactorRating[] = [
      impact,
      { factorId: "attack_tree_likelihood", value: 3, weight: 1 },
      { factorId: "iso_elapsed_time", value: 0, weight: 1 },
      { factorId: "iso_expertise", value: 0, weight: 1 },
    ];
    const res = calculateRiskValues(ratings, isoConfig());
    expect(res.likelihood).toBe(3); // tree feasibility, not the zero score table
    expect(res.impact).toBeGreaterThan(0);
    expect(res.risk).toBeGreaterThan(0); // R = I × L, no longer 0
  });

  it("falls back to the 18045 score table when no tree drives the risk", () => {
    const ratings: FactorRating[] = [impact, { factorId: "iso_elapsed_time", value: 0, weight: 1 }];
    const res = calculateRiskValues(ratings, isoConfig());
    expect(res.likelihood).toBe(0); // nothing rated, no tree → 0 (unchanged)
  });
});
