// tests/unit/features/attacktree/services/attacktree-feasibility.test.ts
//
// PHASE 2 — the feasibility axis of the risk matrix.
//
// This is the phase where a bug does not crash anything: it silently produces a
// plausible-looking risk number that is wrong. So the tests assert SEMANTICS,
// not just arithmetic:
//
//   - more effort must never mean more feasible (monotonicity)
//   - benefit must NEVER touch the risk number in ISO mode (Cl. 3.1.29)
//   - benefit MUST touch it in 62443 mode
//   - aggregation across paths is MAX, never average (15.8 NOTE 2) — averaging
//     lets a pile of hard paths mask one trivial one
//
// Band boundaries and factor weights are configuration (they differ per
// organisation and must be printed in the report), so tests use explicit test
// configs rather than pinning the shipped defaults — otherwise recalibrating
// against Annex G would break the suite for no reason.

import { describe, it, expect } from "vitest";
import {
  aggregateFeasibility,
  bandAttackPotential,
  bandProbability,
  computeAttackPotential,
  computeLikelihood,
  feasibilityToRiskScale,
  meetsThreshold,
} from "features/attacktree/services/attacktree-feasibility";
import {
  type AttackPotentialFactors,
  type FeasibilityConfiguration,
  DEFAULT_FEASIBILITY_CONFIGURATION,
} from "features/attacktree/models/attacktree-feasibility-types";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

function isoConfig(
  overrides: Partial<FeasibilityConfiguration> = {},
): FeasibilityConfiguration {
  return {
    ...DEFAULT_FEASIBILITY_CONFIGURATION,
    likelihoodModel: "feasibility-only",
    ...overrides,
  };
}

function iec62443Config(
  overrides: Partial<FeasibilityConfiguration> = {},
): FeasibilityConfiguration {
  return {
    ...DEFAULT_FEASIBILITY_CONFIGURATION,
    likelihoodModel: "feasibility-x-motivation",
    ...overrides,
  };
}

/** The easiest possible attack: no time, no skill, no kit, wide open. */
const TRIVIAL: AttackPotentialFactors = {
  elapsedTime: "le-1-day",
  specialistExpertise: "layman",
  knowledgeOfItem: "public",
  windowOfOpportunity: "unlimited",
  equipment: "standard",
};

/** The hardest: years, multiple experts, secret knowledge, bespoke kit. */
const EXTREME: AttackPotentialFactors = {
  elapsedTime: "gt-6-months",
  specialistExpertise: "multiple-experts",
  knowledgeOfItem: "strictly-confidential",
  windowOfOpportunity: "difficult",
  equipment: "multiple-bespoke",
};

// ──────────────────────────────────────────────────────────────────────────
// Attack potential — monotonicity is the load-bearing property
// ──────────────────────────────────────────────────────────────────────────

describe("computeAttackPotential", () => {
  it("sums the five factors", () => {
    const config = isoConfig();
    const potential = computeAttackPotential(TRIVIAL, config);
    expect(potential).toBe(0); // all-cheapest levels are weighted 0
  });

  it("a harder attack always has a higher potential", () => {
    const config = isoConfig();
    expect(computeAttackPotential(EXTREME, config)).toBeGreaterThan(
      computeAttackPotential(TRIVIAL, config),
    );
  });

  it("REGRESSION: every factor is monotonic — raising any one never lowers the potential", () => {
    // If a weight table were mis-entered (a higher level given a lower weight),
    // the tool would rate a harder attack as MORE feasible. That is the silent,
    // dangerous direction, so it is pinned per factor.
    const config = isoConfig();
    const base = computeAttackPotential(TRIVIAL, config);

    const harderVariants: AttackPotentialFactors[] = [
      { ...TRIVIAL, elapsedTime: "gt-6-months" },
      { ...TRIVIAL, specialistExpertise: "multiple-experts" },
      { ...TRIVIAL, knowledgeOfItem: "strictly-confidential" },
      { ...TRIVIAL, windowOfOpportunity: "difficult" },
      { ...TRIVIAL, equipment: "multiple-bespoke" },
    ];

    for (const variant of harderVariants) {
      expect(computeAttackPotential(variant, config)).toBeGreaterThan(base);
    }
  });

  it("each factor's own scale is ordered", () => {
    const c = isoConfig();
    const w = c.weights;

    expect(w.elapsedTime["le-1-day"]).toBeLessThan(w.elapsedTime["le-1-week"]);
    expect(w.elapsedTime["le-1-week"]).toBeLessThan(w.elapsedTime["le-1-month"]);
    expect(w.elapsedTime["le-1-month"]).toBeLessThan(w.elapsedTime["le-6-months"]);
    expect(w.elapsedTime["le-6-months"]).toBeLessThan(w.elapsedTime["gt-6-months"]);

    expect(w.specialistExpertise.layman).toBeLessThan(w.specialistExpertise.proficient);
    expect(w.specialistExpertise.proficient).toBeLessThan(w.specialistExpertise.expert);
    expect(w.specialistExpertise.expert).toBeLessThan(w.specialistExpertise["multiple-experts"]);

    expect(w.knowledgeOfItem.public).toBeLessThan(w.knowledgeOfItem.restricted);
    expect(w.knowledgeOfItem.restricted).toBeLessThan(w.knowledgeOfItem.confidential);
    expect(w.knowledgeOfItem.confidential).toBeLessThan(w.knowledgeOfItem["strictly-confidential"]);

    expect(w.windowOfOpportunity.unlimited).toBeLessThan(w.windowOfOpportunity.easy);
    expect(w.windowOfOpportunity.easy).toBeLessThan(w.windowOfOpportunity.moderate);
    expect(w.windowOfOpportunity.moderate).toBeLessThan(w.windowOfOpportunity.difficult);

    expect(w.equipment.standard).toBeLessThan(w.equipment.specialized);
    expect(w.equipment.specialized).toBeLessThan(w.equipment.bespoke);
    expect(w.equipment.bespoke).toBeLessThan(w.equipment["multiple-bespoke"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Banding — more effort ⇒ less feasible
// ──────────────────────────────────────────────────────────────────────────

describe("bandAttackPotential", () => {
  const config = isoConfig({
    bands: [
      { level: "high", minPotential: 0 },
      { level: "medium", minPotential: 10 },
      { level: "low", minPotential: 20 },
      { level: "very-low", minPotential: 30 },
    ],
  });

  it("a trivial attack is highly feasible", () => {
    expect(bandAttackPotential(0, config)).toBe("high");
  });

  it("an extreme attack is barely feasible", () => {
    expect(bandAttackPotential(99, config)).toBe("very-low");
  });

  it("band boundaries are inclusive at the lower edge", () => {
    expect(bandAttackPotential(9, config)).toBe("high");
    expect(bandAttackPotential(10, config)).toBe("medium"); // ← boundary
    expect(bandAttackPotential(19, config)).toBe("medium");
    expect(bandAttackPotential(20, config)).toBe("low"); // ← boundary
    expect(bandAttackPotential(29, config)).toBe("low");
    expect(bandAttackPotential(30, config)).toBe("very-low"); // ← boundary
  });

  it("REGRESSION: a mis-ordered band config still yields correct ratings", () => {
    // Config comes from a dialog and from persisted JSON. If someone writes the
    // bands out of order, we must not silently mis-rate — sort defensively.
    const scrambled = isoConfig({
      bands: [
        { level: "low", minPotential: 20 },
        { level: "high", minPotential: 0 },
        { level: "very-low", minPotential: 30 },
        { level: "medium", minPotential: 10 },
      ],
    });

    expect(bandAttackPotential(0, scrambled)).toBe("high");
    expect(bandAttackPotential(15, scrambled)).toBe("medium");
    expect(bandAttackPotential(25, scrambled)).toBe("low");
    expect(bandAttackPotential(35, scrambled)).toBe("very-low");
  });

  it("end-to-end: the trivial attack outranks the extreme one", () => {
    const c = isoConfig();
    const trivial = bandAttackPotential(computeAttackPotential(TRIVIAL, c), c);
    const extreme = bandAttackPotential(computeAttackPotential(EXTREME, c), c);

    expect(trivial).toBe("high");
    expect(extreme).toBe("very-low");
  });
});

describe("bandProbability (quick mode)", () => {
  const config = isoConfig();

  it("maps a probability onto a level", () => {
    expect(bandProbability(0.0, config)).toBe("very-low");
    expect(bandProbability(0.3, config)).toBe("low");
    expect(bandProbability(0.6, config)).toBe("medium");
    expect(bandProbability(0.9, config)).toBe("high");
  });

  it("is monotonic", () => {
    const rank = { "very-low": 0, low: 1, medium: 2, high: 3 } as const;
    let previous = -1;
    for (const p of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
      const current = rank[bandProbability(p, config)];
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// THE FORK: benefit in ISO vs 62443 mode
// ──────────────────────────────────────────────────────────────────────────

describe("computeLikelihood — ISO 21434 mode (feasibility-only)", () => {
  it("REGRESSION: benefit NEVER changes the likelihood, whatever its value", () => {
    // Cl. 3.1.29 expresses risk in terms of attack feasibility and impact.
    // The Annex G factors measure effort only. Admitting motivation would let a
    // team argue a risk away ("nobody would bother") on an unprovable premise.
    // This is the single most important assertion in Phase 2.
    const config = isoConfig();

    for (const benefit of ["negligible", "low", "medium", "high"] as const) {
      expect(computeLikelihood("high", benefit, config)).toBe("high");
      expect(computeLikelihood("very-low", benefit, config)).toBe("very-low");
      expect(computeLikelihood("medium", benefit, config)).toBe("medium");
    }
  });

  it("likelihood IS feasibility", () => {
    const config = isoConfig();
    expect(computeLikelihood("low", undefined, config)).toBe("low");
  });
});

describe("computeLikelihood — IEC 62443 / classic mode (feasibility-x-motivation)", () => {
  const config = iec62443Config();

  it("REGRESSION: benefit DOES change the likelihood", () => {
    // The mirror of the ISO assertion above. If this passes in ISO mode or fails
    // here, the two methods have been conflated.
    expect(computeLikelihood("medium", "negligible", config)).not.toBe("medium");
    expect(computeLikelihood("medium", "high", config)).not.toBe("medium");
  });

  it("a lucrative attack is more likely than the bare effort suggests", () => {
    expect(computeLikelihood("medium", "high", config)).toBe("high");
  });

  it("an attack nobody profits from is less likely, however easy", () => {
    // High feasibility, zero benefit → not a realistic scenario.
    expect(computeLikelihood("high", "negligible", config)).toBe("low");
  });

  it("medium benefit is neutral", () => {
    expect(computeLikelihood("medium", "medium", config)).toBe("medium");
  });

  it("the shift is clamped — it cannot escape the four levels", () => {
    expect(computeLikelihood("high", "high", config)).toBe("high"); // no 5th level
    expect(computeLikelihood("very-low", "negligible", config)).toBe("very-low");
  });

  it("without a stated benefit, likelihood falls back to feasibility", () => {
    expect(computeLikelihood("medium", undefined, config)).toBe("medium");
  });
});

describe("the two models genuinely diverge", () => {
  it("the same path yields different likelihoods under ISO and 62443", () => {
    const iso = computeLikelihood("high", "negligible", isoConfig());
    const iec = computeLikelihood("high", "negligible", iec62443Config());

    expect(iso).toBe("high"); // ISO: effort only
    expect(iec).toBe("low"); // 62443: nobody would bother
    expect(iso).not.toBe(iec);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Aggregation — MAX, per 15.8 NOTE 2
// ──────────────────────────────────────────────────────────────────────────

describe("aggregateFeasibility", () => {
  it("REGRESSION: takes the MAXIMUM — the attacker picks the easiest route", () => {
    // 15.8 NOTE 2 gives the maximum as its example. Averaging would let nine
    // hard paths mask one trivial one, understating the risk. That is exactly
    // the failure this test exists to prevent.
    const levels = [
      "very-low",
      "very-low",
      "very-low",
      "high", // ← the one that matters
      "low",
    ] as const;

    expect(aggregateFeasibility([...levels])).toBe("high");
  });

  it("is not an average", () => {
    // An average of very-low and high would land around medium.
    expect(aggregateFeasibility(["very-low", "high"])).toBe("high");
    expect(aggregateFeasibility(["very-low", "high"])).not.toBe("medium");
  });

  it("a single path aggregates to itself", () => {
    expect(aggregateFeasibility(["medium"])).toBe("medium");
  });

  it("no paths yields undefined rather than a fabricated rating", () => {
    expect(aggregateFeasibility([])).toBeUndefined();
  });

  it("order does not matter", () => {
    expect(aggregateFeasibility(["low", "high", "medium"])).toBe("high");
    expect(aggregateFeasibility(["high", "medium", "low"])).toBe("high");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Mapping B — feasibility → risk scale
// ──────────────────────────────────────────────────────────────────────────

describe("feasibilityToRiskScale (Mapping B)", () => {
  it("maps every level onto the risk scale", () => {
    const config = isoConfig();
    for (const level of ["very-low", "low", "medium", "high"] as const) {
      expect(feasibilityToRiskScale(level, config)).toBeGreaterThan(0);
    }
  });

  it("is monotonic — more feasible never scores lower", () => {
    const config = isoConfig();
    expect(feasibilityToRiskScale("very-low", config)).toBeLessThan(
      feasibilityToRiskScale("low", config),
    );
    expect(feasibilityToRiskScale("low", config)).toBeLessThan(
      feasibilityToRiskScale("medium", config),
    );
    expect(feasibilityToRiskScale("medium", config)).toBeLessThan(
      feasibilityToRiskScale("high", config),
    );
  });

  it("honours a project-specific scale", () => {
    const threeLevel = isoConfig({
      levelToRiskScale: { "very-low": 1, low: 1, medium: 2, high: 3 },
    });
    expect(feasibilityToRiskScale("high", threeLevel)).toBe(3);
    expect(feasibilityToRiskScale("very-low", threeLevel)).toBe(1);
  });
});

describe("meetsThreshold", () => {
  it("compares on the ordinal scale, not alphabetically", () => {
    expect(meetsThreshold("high", "medium")).toBe(true);
    expect(meetsThreshold("medium", "medium")).toBe(true);
    expect(meetsThreshold("low", "medium")).toBe(false);
    // "high" < "low" alphabetically — a string compare would get this wrong.
    expect(meetsThreshold("high", "low")).toBe(true);
  });
});
