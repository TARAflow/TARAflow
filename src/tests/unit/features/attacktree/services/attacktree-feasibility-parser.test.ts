// tests/unit/features/attacktree/services/attacktree-feasibility-parser.test.ts
//
// PHASE 2 — the audit-mode DSL.
//
//   Quick mode (existing):  Extract Data;p=0.8,i=3
//   Audit mode (new):       Extract Data;et=1w,se=expert,kn=restricted,wo=easy,eq=standard
//   Benefit (both modes):   ...,b=high
//
// Two things must hold, and the second is easy to break:
//   1. audit mode parses
//   2. every existing tree still parses BYTE-IDENTICALLY

import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import {
  looksLikeAttackPotential,
  parseAttackPotential,
  parseBenefit,
} from "features/attacktree/services/attacktree-feasibility-parser";

function leafOf(dsl: string) {
  const result = attackTreeParser.parse(dsl, "simple");
  return result.ast!.children[0];
}

// ──────────────────────────────────────────────────────────────────────────
// Audit mode
// ──────────────────────────────────────────────────────────────────────────

describe("attack-potential (audit mode) syntax", () => {
  it("parses all five factors", () => {
    const leaf = leafOf(
      [
        "Root;ROOT",
        "\tExtract Data;et=1w,se=expert,kn=restricted,wo=easy,eq=standard",
      ].join("\n"),
    );

    expect(leaf.evaluation?.attackPotential).toEqual({
      elapsedTime: "le-1-week",
      specialistExpertise: "expert",
      knowledgeOfItem: "restricted",
      windowOfOpportunity: "easy",
      equipment: "standard",
    });
  });

  it("accepts the shorthand aliases an analyst actually types", () => {
    const result = parseAttackPotential(
      "et=1d,se=layman,kn=public,wo=unlimited,eq=standard",
      1,
    );

    expect(result.factors?.elapsedTime).toBe("le-1-day");
    expect(result.error).toBeUndefined();
  });

  it("REGRESSION: a missing factor is an error, not a silent default", () => {
    // A partially rated path yields an attack potential that is silently too
    // LOW, hence a feasibility silently too HIGH — the dangerous direction.
    // Refusing to parse is the only safe behaviour.
    const result = parseAttackPotential(
      "et=1w,se=expert,kn=restricted,wo=easy", // eq missing
      7,
    );

    expect(result.factors).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.severity).toBe("error");
    expect(result.error!.message).toContain("eq");
    expect(result.error!.messageDE).toBeTruthy();
    expect(result.error!.line).toBe(7);
  });

  it("an unknown factor value is an error and lists the valid ones", () => {
    const result = parseAttackPotential(
      "et=1w,se=wizard,kn=public,wo=easy,eq=standard",
      1,
    );

    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain("wizard");
    expect(result.error!.message).toContain("expert"); // suggests valid values
  });

  it("surfaces the parse error on the tree, not just as a silent drop", () => {
    const result = attackTreeParser.parse(
      ["Root;ROOT", "\tBad;et=1w,se=expert"].join("\n"),
      "simple",
    );

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("detects audit mode without consuming other syntax", () => {
    expect(looksLikeAttackPotential("et=1w,se=expert")).toBe(true);
    expect(looksLikeAttackPotential("p=0.5,i=3")).toBe(false);
    expect(looksLikeAttackPotential("0.8,0.9,3")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Benefit
// ──────────────────────────────────────────────────────────────────────────

describe("benefit", () => {
  it("parses alongside attack-potential factors", () => {
    const leaf = leafOf(
      [
        "Root;ROOT",
        "\tExtract Data;et=1w,se=expert,kn=public,wo=easy,eq=standard,b=high",
      ].join("\n"),
    );

    expect(leaf.evaluation?.benefit).toBe("high");
  });

  it("parses alongside quick mode", () => {
    const leaf = leafOf(["Root;ROOT", "\tLeaf;p=0.5,i=3,b=low"].join("\n"));

    expect(leaf.evaluation?.simple?.probability).toBeCloseTo(0.5);
    expect(leaf.evaluation?.benefit).toBe("low");
  });

  it("is optional", () => {
    const leaf = leafOf(["Root;ROOT", "\tLeaf;p=0.5,i=3"].join("\n"));
    expect(leaf.evaluation?.benefit).toBeUndefined();
  });

  it("an unknown benefit is an error", () => {
    const result = parseBenefit("b=enormous", 3);
    expect(result.error).toBeDefined();
    expect(result.error!.line).toBe(3);
  });

  it("REGRESSION: numeric b= in the extended format is NOT read as a benefit level", () => {
    // The legacy extended syntax is f=0.8,b=0.9,i=3 — there `b` is a NUMBER.
    // If parseBenefit grabbed it, every extended tree would fail to parse.
    expect(parseBenefit("f=0.8,b=0.9,i=3", 1).benefit).toBeUndefined();
    expect(parseBenefit("f=0.8,b=0.9,i=3", 1).error).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Backward compatibility — the easy thing to break
// ──────────────────────────────────────────────────────────────────────────

describe("legacy formats still parse unchanged", () => {
  it("simple: p=0.5,i=3", () => {
    const leaf = leafOf(["Root;ROOT", "\tLeaf;p=0.5,i=3"].join("\n"));

    expect(leaf.evaluation?.simple).toEqual({ probability: 0.5, impact: 3 });
    expect(leaf.evaluation?.attackPotential).toBeUndefined();
  });

  it("extended explicit: f=0.8,b=0.9,i=3", () => {
    const result = attackTreeParser.parse(
      ["Root;ROOT", "\tLeaf;f=0.8,b=0.9,i=3"].join("\n"),
      "extended",
    );

    expect(result.success).toBe(true);
    expect(result.ast!.children[0].evaluation?.extended).toBeDefined();
  });

  it("extended shorthand: 0.8,0.9,3", () => {
    const result = attackTreeParser.parse(
      ["Root;ROOT", "\tLeaf;0.8,0.9,3"].join("\n"),
      "extended",
    );

    expect(result.success).toBe(true);
    expect(result.ast!.children[0].evaluation?.extended?.impact).toBe(3);
  });

  it("a whole legacy tree parses with no attack-potential anywhere", () => {
    const result = attackTreeParser.parse(
      [
        "Steal Config [A-001];ROOT @disclosure",
        "\tRemote Path;OR",
        "\t\tExploit API;p=0.5,i=3 [M-001]",
        "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
      ].join("\n"),
      "simple",
    );

    expect(result.success).toBe(true);
    const leaves = result.ast!.children[0].children;
    expect(leaves).toHaveLength(2);
    expect(leaves.every((l) => !l.evaluation?.attackPotential)).toBe(true);
  });
});
