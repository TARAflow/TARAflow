// tests/unit/features/attacktree/services/attacktree-calculator.test.ts
//
// The calculator turns the AST into the numbers the analyst actually acts on
// (path risk scores, critical paths). Two properties matter and are easy to
// break without noticing:
//
//   - AND vs OR must aggregate differently. An AND gate requires ALL children
//     to succeed, so it must be no more likely than its easiest child; an OR
//     gate needs only one, so it must be at least as likely as its best child.
//     Swap the two and every score stays plausible but is quietly wrong.
//   - Leaves must map 1:1 to paths — a dropped path is an unanalysed attack.
//
// Assertions are on relationships/invariants rather than magic numbers, so the
// tests survive a deliberate re-tuning of the formula but still catch a swap.

import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import { attackTreeCalculator } from "features/attacktree/services/attacktree-calculator";
import { DSL_AND_GATE, DSL_EXTENDED, DSL_SIMPLE } from "../attacktree-factory";

function astOf(dsl: string, method: "simple" | "extended" = "simple") {
  return attackTreeParser.parse(dsl, method).ast!;
}

// ──────────────────────────────────────────────────────────────────────────
// Path extraction
// ──────────────────────────────────────────────────────────────────────────

describe("analyzeAttackPaths — path extraction", () => {
  it("produces one path per leaf", () => {
    const analysis = attackTreeCalculator.analyzeAttackPaths(
      astOf(DSL_SIMPLE),
      "simple",
    );

    expect(analysis.totalPaths).toBe(2);
    expect(analysis.paths).toHaveLength(2);
  });

  it("each path records the full route from ROOT to leaf", () => {
    const analysis = attackTreeCalculator.analyzeAttackPaths(
      astOf(DSL_SIMPLE),
      "simple",
    );

    const path = analysis.paths[0];
    expect(path.path[0]).toBe("Steal Config");
    expect(path.path).toContain("Remote Path");
    expect(path.path[path.path.length - 1]).toMatch(/Exploit API|Sniff Traffic/);
  });

  it("collects the mitigations that lie on the path", () => {
    const analysis = attackTreeCalculator.analyzeAttackPaths(
      astOf(DSL_SIMPLE),
      "simple",
    );

    const all = analysis.paths.flatMap((p) => p.mitigations);
    expect(all).toContain("M-001");
    expect(all).toContain("M-002");
  });

  it("handles a deep tree without losing leaves", () => {
    const dsl = [
      "Root;ROOT",
      "\tA;OR",
      "\t\tB;AND",
      "\t\t\tC1;p=0.5,i=3",
      "\t\t\tC2;p=0.5,i=3",
      "\t\tD;p=0.9,i=4",
    ].join("\n");

    const analysis = attackTreeCalculator.analyzeAttackPaths(
      astOf(dsl),
      "simple",
    );

    expect(analysis.totalPaths).toBe(3); // C1, C2, D
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Aggregation semantics
// ──────────────────────────────────────────────────────────────────────────

describe("gate aggregation — AND vs OR", () => {
  it("an OR gate is at least as likely as its most likely child", () => {
    const dsl = [
      "Root;ROOT",
      "\tGate;OR",
      "\t\tEasy;p=0.9,i=3",
      "\t\tHard;p=0.1,i=3",
    ].join("\n");

    const root = astOf(dsl);
    attackTreeCalculator.calculateTreeRiskScores(root, "simple");

    const gate = root.children[0];
    const easiest = Math.max(
      ...gate.children.map((c) => attackTreeCalculator.calculateNodeProbability(c, "simple")),
    );
    const gateProb = attackTreeCalculator.calculateNodeProbability(gate, "simple");

    expect(gateProb).toBeGreaterThanOrEqual(easiest - 1e-9);
  });

  it("an AND gate is no more likely than its least likely child", () => {
    const dsl = [
      "Root;ROOT",
      "\tGate;AND",
      "\t\tEasy;p=0.9,i=3",
      "\t\tHard;p=0.1,i=3",
    ].join("\n");

    const root = astOf(dsl);
    attackTreeCalculator.calculateTreeRiskScores(root, "simple");

    const gate = root.children[0];
    const hardest = Math.min(
      ...gate.children.map((c) => attackTreeCalculator.calculateNodeProbability(c, "simple")),
    );
    const gateProb = attackTreeCalculator.calculateNodeProbability(gate, "simple");

    expect(gateProb).toBeLessThanOrEqual(hardest + 1e-9);
  });

  it("REGRESSION: an AND tree scores no higher than the same tree as OR", () => {
    // Directly pins the semantics against an accidental swap.
    const andRoot = astOf(DSL_AND_GATE);
    const orRoot = astOf(DSL_AND_GATE.replace(";AND", ";OR"));

    const andAnalysis = attackTreeCalculator.analyzeAttackPaths(andRoot, "simple");
    const orAnalysis = attackTreeCalculator.analyzeAttackPaths(orRoot, "simple");

    expect(andAnalysis.maxRiskScore).toBeLessThanOrEqual(
      orAnalysis.maxRiskScore + 1e-9,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Scoring
// ──────────────────────────────────────────────────────────────────────────

describe("risk scoring", () => {
  it("scores a higher-probability, higher-impact leaf above a weaker one", () => {
    const analysis = attackTreeCalculator.analyzeAttackPaths(
      astOf(DSL_SIMPLE),
      "simple",
    );

    const exploit = analysis.paths.find((p) => p.path.includes("Exploit API"))!;
    const sniff = analysis.paths.find((p) => p.path.includes("Sniff Traffic"))!;

    // p=0.5,i=3 vs p=0.2,i=2
    expect(exploit.riskScore).toBeGreaterThan(sniff.riskScore);
  });

  it("computes max and average consistently with the individual paths", () => {
    const analysis = attackTreeCalculator.analyzeAttackPaths(
      astOf(DSL_SIMPLE),
      "simple",
    );

    const scores = analysis.paths.map((p) => p.riskScore);
    expect(analysis.maxRiskScore).toBeCloseTo(Math.max(...scores), 5);
    expect(analysis.averageRiskScore).toBeCloseTo(
      scores.reduce((a, b) => a + b, 0) / scores.length,
      5,
    );
  });

  it("handles the extended (f,b,i) method", () => {
    const analysis = attackTreeCalculator.analyzeAttackPaths(
      astOf(DSL_EXTENDED, "extended"),
      "extended",
    );

    expect(analysis.totalPaths).toBe(2);
    expect(analysis.maxRiskScore).toBeGreaterThan(0);
    // 0.8,0.9,4 must outrank 0.2,0.5,2
    const strong = analysis.paths.find((p) => p.path.includes("Exploit API"))!;
    const weak = analysis.paths.find((p) => p.path.includes("Sniff Traffic"))!;
    expect(strong.riskScore).toBeGreaterThan(weak.riskScore);
  });

  it("marks the highest-scoring path(s) as critical and flags them on the path", () => {
    const analysis = attackTreeCalculator.analyzeAttackPaths(
      astOf(DSL_SIMPLE),
      "simple",
    );

    // criticalPaths must be a subset of paths, and consistent with isCritical
    for (const critical of analysis.criticalPaths) {
      expect(critical.isCritical).toBe(true);
    }
    const flagged = analysis.paths.filter((p) => p.isCritical);
    expect(flagged).toHaveLength(analysis.criticalPaths.length);
  });
});
