// tests/unit/features/attacktree/services/attacktree-calculator-feasibility.test.ts
//
// PHASE 2 (completion) — the calculator now derives a FeasibilityLevel per path
// and aggregates it onto the tree.
//
// This is the piece that makes Phase 4 possible: "cheapest-per-goal" emission
// cannot be implemented without a per-path feasibility, and the Risks tab
// (Phase 6) cannot consume a likelihood that nobody computed.
//
// The legacy riskScore is deliberately untouched — it stays until Phase 6
// switches the Risks tab over. Both axes coexist for now, and a test below
// pins that so the changeover stays a conscious decision rather than a side
// effect.

import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import { attackTreeCalculator } from "features/attacktree/services/attacktree-calculator";
import {
  type FeasibilityConfiguration,
  DEFAULT_FEASIBILITY_CONFIGURATION,
} from "features/attacktree/models/attacktree-feasibility-types";

function isoConfig(): FeasibilityConfiguration {
  return {
    ...DEFAULT_FEASIBILITY_CONFIGURATION,
    likelihoodModel: "feasibility-only",
  };
}

function iec62443Config(): FeasibilityConfiguration {
  return {
    ...DEFAULT_FEASIBILITY_CONFIGURATION,
    likelihoodModel: "feasibility-x-motivation",
  };
}

function analyse(dsl: string, config = isoConfig()) {
  const ast = attackTreeParser.parse(dsl, "simple").ast!;
  return attackTreeCalculator.analyzeAttackPaths(ast, "simple", config);
}

function pathTo(analysis: ReturnType<typeof analyse>, leaf: string) {
  return analysis.paths.find((p) => p.path[p.path.length - 1] === leaf)!;
}

// ──────────────────────────────────────────────────────────────────────────
// Per-path feasibility
// ──────────────────────────────────────────────────────────────────────────

describe("analyzeAttackPaths — feasibility per path", () => {
  it("derives feasibility from attack-potential factors (audit mode)", () => {
    const dsl = [
      "Steal Config [A-001];ROOT @disclosure",
      "\tTrivial;et=1d,se=layman,kn=public,wo=unlimited,eq=standard",
      "\tExtreme;et=>6m,se=experts,kn=strict,wo=difficult,eq=multiple-bespoke",
    ].join("\n");

    const analysis = analyse(dsl);

    expect(pathTo(analysis, "Trivial").feasibilityLevel).toBe("high");
    expect(pathTo(analysis, "Extreme").feasibilityLevel).toBe("very-low");
  });

  it("records the attack potential behind the level", () => {
    const dsl = [
      "Root;ROOT",
      "\tTrivial;et=1d,se=layman,kn=public,wo=unlimited,eq=standard",
    ].join("\n");

    expect(pathTo(analyse(dsl), "Trivial").attackPotential).toBe(0);
  });

  it("falls back to the probability in quick mode", () => {
    const dsl = ["Root;ROOT", "\tEasy;p=0.9,i=3", "\tHard;p=0.1,i=3"].join("\n");
    const analysis = analyse(dsl);

    expect(pathTo(analysis, "Easy").feasibilityLevel).toBe("high");
    expect(pathTo(analysis, "Hard").feasibilityLevel).toBe("very-low");
    expect(pathTo(analysis, "Easy").attackPotential).toBeUndefined();
  });

  it("REGRESSION: an unrated leaf has NO feasibility, rather than defaulting to very-low", () => {
    // Defaulting an unrated path to "very-low" would make it look like the
    // safest one in the tree — the tool would be actively hiding the gap. It
    // must be visibly absent so the validator and the UI can flag it.
    const dsl = ["Root;ROOT", "\tGate;OR", "\t\tUnrated;OR"].join("\n");
    const analysis = analyse(dsl);

    expect(analysis.paths[0].feasibilityLevel).toBeUndefined();
    expect(analysis.paths[0].likelihoodLevel).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// The likelihood fork, end to end
// ──────────────────────────────────────────────────────────────────────────

describe("analyzeAttackPaths — likelihood depends on the project's model", () => {
  const DSL = [
    "Root;ROOT",
    "\tEasy But Pointless;et=1d,se=layman,kn=public,wo=unlimited,eq=standard,b=negligible",
  ].join("\n");

  it("ISO mode: likelihood equals feasibility, benefit is ignored", () => {
    const path = pathTo(analyse(DSL, isoConfig()), "Easy But Pointless");

    expect(path.feasibilityLevel).toBe("high");
    expect(path.likelihoodLevel).toBe("high"); // ← benefit did NOT bite
    expect(path.benefit).toBe("negligible"); // ← but it IS recorded
  });

  it("62443 mode: benefit lowers the likelihood below the feasibility", () => {
    const path = pathTo(analyse(DSL, iec62443Config()), "Easy But Pointless");

    expect(path.feasibilityLevel).toBe("high"); // unchanged
    expect(path.likelihoodLevel).toBe("low"); // ← benefit bit
  });

  it("REGRESSION: the same tree yields different likelihoods under the two models", () => {
    const iso = pathTo(analyse(DSL, isoConfig()), "Easy But Pointless");
    const iec = pathTo(analyse(DSL, iec62443Config()), "Easy But Pointless");

    expect(iso.feasibilityLevel).toBe(iec.feasibilityLevel);
    expect(iso.likelihoodLevel).not.toBe(iec.likelihoodLevel);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Aggregation onto the tree (15.8 NOTE 2)
// ──────────────────────────────────────────────────────────────────────────

describe("analyzeAttackPaths — aggregation across paths", () => {
  const MIXED = [
    "Steal Config [A-001];ROOT @disclosure",
    "\tHard A;et=>6m,se=experts,kn=strict,wo=difficult,eq=multiple-bespoke",
    "\tHard B;et=6m,se=expert,kn=confidential,wo=difficult,eq=bespoke",
    "\tTrivial;et=1d,se=layman,kn=public,wo=unlimited,eq=standard",
  ].join("\n");

  it("REGRESSION: aggregation is the MAX — one trivial path is not masked by hard ones", () => {
    // The core of 15.8 NOTE 2. If this ever becomes an average, a tree with one
    // trivial path and nine brutal ones would report as "low feasibility" and
    // the real risk would vanish from the register.
    const analysis = analyse(MIXED);

    expect(analysis.aggregatedFeasibility).toBe("high");
  });

  it("exposes the cheapest path for the emission policy", () => {
    const analysis = analyse(MIXED);

    expect(analysis.cheapestPath).toBeDefined();
    expect(analysis.cheapestPath!.path).toContain("Trivial");
    expect(analysis.cheapestPath!.feasibilityLevel).toBe("high");
  });

  it("the cheapest path is deterministic when several tie", () => {
    // A wobbling "cheapest path" would make the emitted threat set unstable
    // between runs and defeat the whole point of Phase 1's stable identity.
    const tied = [
      "Root;ROOT",
      "\tA;et=1d,se=layman,kn=public,wo=unlimited,eq=standard",
      "\tB;et=1d,se=layman,kn=public,wo=unlimited,eq=standard",
    ].join("\n");

    const first = analyse(tied).cheapestPath!.pathKey;
    for (let i = 0; i < 5; i++) {
      expect(analyse(tied).cheapestPath!.pathKey).toBe(first);
    }
  });

  it("aggregates the likelihood axis separately from feasibility in 62443 mode", () => {
    const dsl = [
      "Root;ROOT",
      "\tEasy Pointless;et=1d,se=layman,kn=public,wo=unlimited,eq=standard,b=negligible",
      "\tHarder Lucrative;et=1m,se=proficient,kn=restricted,wo=easy,eq=standard,b=high",
    ].join("\n");

    const analysis = analyse(dsl, iec62443Config());

    // Feasibility ignores benefit: the easy path still tops that axis.
    expect(analysis.aggregatedFeasibility).toBe("high");
    // Likelihood folds benefit in, so the two axes can diverge.
    expect(analysis.aggregatedLikelihoodLevel).toBeDefined();
  });

  it("a tree with no evaluations has no aggregated feasibility", () => {
    const analysis = analyse(["Root;ROOT", "\tGate;OR", "\t\tX;OR"].join("\n"));

    expect(analysis.aggregatedFeasibility).toBeUndefined();
    expect(analysis.cheapestPath).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Gate semantics survive the banding step
// ──────────────────────────────────────────────────────────────────────────

describe("gate aggregation follows the QUANTITY, not a config switch", () => {
  // The three quantities compose differently, and mixing them up is a maths
  // error rather than a "conservative choice":
  //
  //   attack potential (effort)  AND -> SUM      OR -> MIN
  //   probability                AND -> PRODUCT  OR -> UNION
  //   ordinal level only         AND -> MIN      OR -> MAX  (bottleneck heuristic)
  //
  // Applying min() to an attack potential would claim two weeks of work plus two
  // weeks of work equals two weeks of work. So it is not offered as an option.

  const rank = { "very-low": 0, low: 1, medium: 2, high: 3 } as const;

  it("REGRESSION: AND on attack potential SUMS the effort, it does not take the min", () => {
    // Two identical moderate steps must be HARDER than one of them alone.
    // min() would report them as exactly as hard as a single step.
    const one = [
      "Root;ROOT",
      "\tOnly;et=1m,se=proficient,kn=restricted,wo=moderate,eq=specialized",
    ].join("\n");

    const two = [
      "Root;ROOT",
      "\tGate;AND",
      "\t\tStepA;et=1m,se=proficient,kn=restricted,wo=moderate,eq=specialized",
      "\t\tStepB;et=1m,se=proficient,kn=restricted,wo=moderate,eq=specialized",
    ].join("\n");

    const single = analyse(one).aggregatedFeasibility!;
    const doubled = analyse(two).aggregatedFeasibility!;

    expect(rank[doubled]).toBeLessThan(rank[single]);
  });

  it("REGRESSION: AND on probability MULTIPLIES, it does not take the min", () => {
    // p=0.8 AND p=0.8 is 0.64, not 0.8. min() would report 0.8 and understate
    // the effort — the optimistic, dangerous direction.
    const single = analyse(["Root;ROOT", "\tOnly;p=0.8,i=3"].join("\n"));
    const both = analyse(
      [
        "Root;ROOT",
        "\tGate;AND",
        "\t\tA;p=0.8,i=3",
        "\t\tB;p=0.8,i=3",
      ].join("\n"),
    );

    expect(rank[both.aggregatedFeasibility!]).toBeLessThan(
      rank[single.aggregatedFeasibility!],
    );
  });

  it("OR on attack potential takes the CHEAPEST branch (min effort)", () => {
    const ast = attackTreeParser.parse(
      [
        "Root;ROOT",
        "\tGate;OR",
        "\t\tCheap;et=1d,se=layman,kn=public,wo=unlimited,eq=standard",
        "\t\tExpensive;et=>6m,se=experts,kn=strict,wo=difficult,eq=multiple-bespoke",
      ].join("\n"),
      "simple",
    ).ast!;

    // The attacker picks the cheap branch, so the gate is highly feasible.
    expect(
      attackTreeCalculator.calculateNodeFeasibility(ast.children[0], isoConfig()),
    ).toBe("high");
  });

  it("OR on probability uses the union, so it is at least as likely as its best child", () => {
    const ast = attackTreeParser.parse(
      ["Root;ROOT", "\tGate;OR", "\t\tA;p=0.5,i=3", "\t\tB;p=0.5,i=3"].join("\n"),
      "simple",
    ).ast!;

    // 1 - (1-0.5)(1-0.5) = 0.75 — two independent routes are better than one.
    const gate = attackTreeCalculator.calculateNodeFeasibility(
      ast.children[0],
      isoConfig(),
    )!;
    const alone = attackTreeCalculator.calculateNodeFeasibility(
      attackTreeParser.parse(["Root;ROOT", "\tA;p=0.5,i=3"].join("\n"), "simple")
        .ast!.children[0],
      isoConfig(),
    )!;

    expect(rank[gate]).toBeGreaterThanOrEqual(rank[alone]);
  });

  it("REGRESSION: a leaf under an AND is NOT as feasible as it looks alone", () => {
    // The attacker cannot reach EasyStep without also clearing HardStep. The AND
    // gate has already priced that in, and the path inherits it.
    const standalone = [
      "Root;ROOT",
      "\tGate;OR",
      "\t\tEasyStep;p=0.9,i=3",
      "\t\tHardStep;p=0.2,i=3",
    ].join("\n");

    const gated = [
      "Root;ROOT",
      "\tGate;AND",
      "\t\tEasyStep;p=0.9,i=3",
      "\t\tHardStep;p=0.2,i=3",
    ].join("\n");

    const alone = pathTo(analyse(standalone), "EasyStep").feasibilityLevel!;
    const underAnd = pathTo(analyse(gated), "EasyStep").feasibilityLevel!;

    expect(alone).toBe("high");
    expect(rank[underAnd]).toBeLessThan(rank[alone]);
  });

  it("an AND tree is never more feasible than the same tree as OR", () => {
    const and = analyse(
      ["Root;ROOT", "\tG;AND", "\t\tA;p=0.6,i=3", "\t\tB;p=0.6,i=3"].join("\n"),
    );
    const or = analyse(
      ["Root;ROOT", "\tG;OR", "\t\tA;p=0.6,i=3", "\t\tB;p=0.6,i=3"].join("\n"),
    );

    expect(rank[and.aggregatedFeasibility!]).toBeLessThanOrEqual(
      rank[or.aggregatedFeasibility!],
    );
  });

  it("REGRESSION: effort and probability are NOT combined under one gate", () => {
    // There is no honest way to combine "four weeks of work" with "p=0.8".
    // Returning undefined lets the validator surface it as an error rather than
    // inventing a number.
    const mixed = [
      "Root;ROOT",
      "\tGate;AND",
      "\t\tByPotential;et=1m,se=expert,kn=restricted,wo=easy,eq=standard",
      "\t\tByProbability;p=0.8,i=3",
    ].join("\n");

    const ast = attackTreeParser.parse(mixed, "simple").ast!;

    expect(
      attackTreeCalculator.calculateNodeFeasibility(ast.children[0], isoConfig()),
    ).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Coexistence with the legacy axis
// ──────────────────────────────────────────────────────────────────────────

describe("the legacy riskScore is untouched", () => {
  it("REGRESSION: riskScore still computed alongside the new feasibility axis", () => {
    // Phase 6 switches the Risks tab over to the feasibility axis. Until then
    // both coexist, and that changeover must be a conscious decision — not a
    // side effect of this phase.
    const analysis = analyse(["Root;ROOT", "\tLeaf;p=0.5,i=3"].join("\n"));

    expect(analysis.paths[0].riskScore).toBeGreaterThan(0);
    expect(analysis.maxRiskScore).toBeGreaterThan(0);
    expect(analysis.paths[0].feasibilityLevel).toBeDefined(); // both present
  });

  it("existing callers that omit the config still work", () => {
    // analyzeAttackPaths(root, method) — no third argument.
    const ast = attackTreeParser.parse(
      ["Root;ROOT", "\tLeaf;p=0.9,i=3"].join("\n"),
      "simple",
    ).ast!;

    const analysis = attackTreeCalculator.analyzeAttackPaths(ast, "simple");

    expect(analysis.totalPaths).toBe(1);
    expect(analysis.paths[0].feasibilityLevel).toBe("high"); // default config applied
  });
});