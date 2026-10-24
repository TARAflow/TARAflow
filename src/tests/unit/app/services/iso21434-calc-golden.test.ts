// tests/unit/app/services/iso21434-calc-golden.test.ts
//
// ISO/SAE 21434 conformance plan 0c (decision 17): golden values of the
// calculation cores behind the calculation stamps. Fixed inputs → fixed
// outputs. If one of these fails, a formula changed: stored values computed
// before no longer match — bump the version constant named in the message so
// the stamp shows it, then update the expected value.

import { describe, it, expect } from "vitest";

import {
  calculateRiskValues,
  RISK_CALC_VERSION,
} from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import { iso21434Feasibility } from "features/risks/models/iso21434-core";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import {
  attackTreeCalculator,
  calculateNodeFeasibilityQuantity,
  FEASIBILITY_CALC_VERSION,
} from "features/attacktree/services/attacktree-calculator";
import { DEFAULT_FEASIBILITY_CONFIGURATION } from "features/attacktree/models/attacktree-feasibility-types";

const BUMP_RISK = `risk core formula changed → bump RISK_CALC_VERSION (now ${RISK_CALC_VERSION})`;
const BUMP_FEAS = `feasibility core formula changed → bump FEASIBILITY_CALC_VERSION (now ${FEASIBILITY_CALC_VERSION})`;

const isoConfig: RiskConfiguration = {
  ...DEFAULT_CONFIGURATION,
  likelihoodMethod: "iso-21434",
  impactAggregation: "max",
};

describe("golden: risk core under iso-21434", () => {
  it("impact × likelihood from the attack tree", () => {
    const r = calculateRiskValues(
      [
        { factorId: "safety", value: 4, weight: 1 },
        { factorId: "financial_damage", value: 2, weight: 1 },
        { factorId: "attack_tree_likelihood", value: 3, weight: 1 },
      ],
      isoConfig,
    );
    expect(r, BUMP_RISK).toEqual({ impact: 4, likelihood: 3, risk: 12 });
  });

  it("iso_* score-table fallback without a tree", () => {
    const r = calculateRiskValues(
      [
        { factorId: "privacy", value: 3, weight: 1 },
        { factorId: "iso_elapsed_time", value: 2, weight: 1 },
        { factorId: "iso_expertise", value: 2, weight: 1 },
        { factorId: "iso_knowledge", value: 1, weight: 1 },
        { factorId: "iso_window_of_opportunity", value: 1, weight: 1 },
        { factorId: "iso_equipment", value: 1, weight: 1 },
      ],
      isoConfig,
    );
    expect(r, BUMP_RISK).toEqual({ impact: 3, likelihood: 4, risk: 12 });
  });

  it("iso21434-core Table G.7 band edges", () => {
    expect([0, 13, 14, 19, 20, 24, 25].map(iso21434Feasibility), BUMP_RISK).toEqual([
      "high",
      "high",
      "medium",
      "medium",
      "low",
      "low",
      "very-low",
    ]);
  });
});

describe("golden: attack-tree feasibility core", () => {
  const DSL = [
    "Steal [A-001];ROOT",
    "\tBoth;AND",
    "\t\tStep A;et=1w,se=proficient,kn=restricted,wo=easy,eq=standard",
    "\t\tStep B;et=1d,se=layman,kn=public,wo=unlimited,eq=specialized",
    "\tAlone;et=6m,se=expert,kn=confidential,wo=difficult,eq=bespoke",
  ].join("\n");
  const ast = attackTreeParser.parse(DSL, "extended").ast!;

  it("gate rules: AND sums the attack potential, OR takes the minimum", () => {
    const cfg = DEFAULT_FEASIBILITY_CONFIGURATION;
    expect(calculateNodeFeasibilityQuantity(ast.children[0], cfg), BUMP_FEAS).toEqual({
      kind: "potential",
      value: 12,
    });
    expect(calculateNodeFeasibilityQuantity(ast, cfg), BUMP_FEAS).toEqual({
      kind: "potential",
      value: 12,
    });
  });

  it("path feasibility and aggregation", () => {
    const pa = attackTreeCalculator.analyzeAttackPaths(
      ast,
      "extended",
      DEFAULT_FEASIBILITY_CONFIGURATION,
    );
    expect(
      pa.paths.map((p) => [p.pathKey, p.attackPotential, p.feasibilityLevel]),
      BUMP_FEAS,
    ).toEqual([
      ["9b602c120115", 8, "high"],
      ["9a602a7f0415", 4, "high"],
      ["88b21a4c4613", 47, "very-low"],
    ]);
    expect(pa.aggregatedFeasibility, BUMP_FEAS).toBe("high");
  });
});
