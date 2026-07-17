// tests/unit/features/attacktree/services/attacktree-parser.test.ts
//
// First Attack Tree tests. The parser is the component that failed in the
// field: adding a line in the editor produced "Node has no parent" and the
// diagram stopped rendering. Root cause was upstream (CodeMirror inserted no
// tabs), but the parser is where the contract lives, so that contract gets
// pinned here.
//
// Covered:
//   (1) indentation → tree depth  ← the regression
//   (2) structural errors (no ROOT, multiple ROOTs, orphan nodes)
//   (3) reference + attack-goal parsing
//   (4) both evaluation syntaxes (simple p=/i= vs extended f,b,i)
//   (5) comments / blank lines
//
// Indentation in these fixtures is TABS on purpose — see attacktree-factory.

import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import {
  DSL_SIMPLE,
  DSL_EXTENDED,
  DSL_AND_GATE,
} from "../attacktree-factory";

// ──────────────────────────────────────────────────────────────────────────
// (1) Indentation → depth  [REGRESSION]
// ──────────────────────────────────────────────────────────────────────────

describe("parseAttackTree — indentation defines hierarchy", () => {
  it("nests children by leading tabs", () => {
    const result = attackTreeParser.parse(DSL_SIMPLE, "simple");

    expect(result.success).toBe(true);
    const root = result.ast!;
    expect(root.type).toBe("ROOT");
    expect(root.children).toHaveLength(1);

    const orGate = root.children[0];
    expect(orGate.name).toBe("Remote Path");
    expect(orGate.type).toBe("OR");
    expect(orGate.children).toHaveLength(2);
    expect(orGate.children.map((c) => c.name)).toEqual([
      "Exploit API",
      "Sniff Traffic",
    ]);
  });

  it("REGRESSION: a child line written without indentation is rejected as an orphan", () => {
    // This is exactly what the editor produced before the fix: every new line
    // landed at level 0, colliding with ROOT. The parser MUST reject it —
    // silently attaching it to ROOT would hide a real modelling error.
    const dsl = [
      "Steal Config [A-001];ROOT @disclosure",
      "Remote Path;OR", // ← no tab
    ].join("\n");

    const result = attackTreeParser.parse(dsl, "simple");

    expect(result.success).toBe(false);
    expect(
      result.errors.some((e) => e.messageKey === "tabs.attacktree.validation.parser.noParent"),
    ).toBe(true);
  });

  it("REGRESSION: pasted content indented with spaces still parses (2 spaces = 1 level)", () => {
    // Fallback for content copied from a source that lost its tabs. Tabs stay
    // the canonical unit; this only prevents a paste from collapsing the whole
    // subtree onto ROOT's level.
    const dsl = [
      "Steal Config [A-001];ROOT @disclosure",
      "  Remote Path;OR",
      "    Exploit API;p=0.5,i=3",
      "    Sniff Traffic;p=0.2,i=2",
    ].join("\n");

    const result = attackTreeParser.parse(dsl, "simple");

    expect(result.success).toBe(true);
    const orGate = result.ast!.children[0];
    expect(orGate.name).toBe("Remote Path");
    expect(orGate.children).toHaveLength(2);
  });

  it("supports depth > 2", () => {
    const dsl = [
      "Root;ROOT",
      "\tL1;OR",
      "\t\tL2;AND",
      "\t\t\tL3a;p=0.5,i=3",
      "\t\t\tL3b;p=0.5,i=3",
    ].join("\n");

    const result = attackTreeParser.parse(dsl, "simple");

    const l2 = result.ast!.children[0].children[0];
    expect(l2.name).toBe("L2");
    expect(l2.level).toBe(2);
    expect(l2.children.map((c) => c.name)).toEqual(["L3a", "L3b"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (2) Structural errors
// ──────────────────────────────────────────────────────────────────────────

describe("parseAttackTree — structural validation", () => {
  it("errors when no ROOT node is present", () => {
    const result = attackTreeParser.parse("Some Node;OR", "simple");

    expect(result.success).toBe(false);
    expect(
      result.errors.some((e) => e.messageKey === "tabs.attacktree.validation.parser.noRoot"),
    ).toBe(true);
  });

  it("errors on multiple ROOT nodes", () => {
    const dsl = ["First;ROOT", "Second;ROOT"].join("\n");

    const result = attackTreeParser.parse(dsl, "simple");

    expect(result.success).toBe(false);
    expect(
      result.errors.some(
        (e) => e.messageKey === "tabs.attacktree.validation.parser.multipleRoots",
      ),
    ).toBe(true);
  });

  it("returns no AST when parsing fails", () => {
    const result = attackTreeParser.parse("", "simple");
    expect(result.success).toBe(false);
    expect(result.ast).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (3) References + attack goals
// ──────────────────────────────────────────────────────────────────────────

describe("parseAttackTree — references and goals", () => {
  it("parses asset, DFD and threat references", () => {
    const dsl = [
      "Access DB [A-001] [DS-01];ROOT @disclosure",
      "\tVia Threat [T-001];p=0.5,i=3",
    ].join("\n");

    const result = attackTreeParser.parse(dsl, "simple");
    const root = result.ast!;

    expect(root.assetRef).toBe("A-001");
    expect(root.dfdRef).toBe("DS-01");
    expect(root.attackGoal).toBe("disclosure");
    expect(root.children[0].threatRef).toBe("T-001");
  });

  it("parses mitigations, including multiple on one node", () => {
    const dsl = [
      "Root;ROOT",
      "\tLeaf;p=0.5,i=3 [M-001,M-002]",
    ].join("\n");

    const result = attackTreeParser.parse(dsl, "simple");

    expect(result.ast!.children[0].mitigations).toEqual(["M-001", "M-002"]);
  });

  it("leaves mitigations empty when none are given", () => {
    const result = attackTreeParser.parse(
      ["Root;ROOT", "\tLeaf;p=0.5,i=3"].join("\n"),
      "simple",
    );

    expect(result.ast!.children[0].mitigations).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (4) Evaluation syntaxes
// ──────────────────────────────────────────────────────────────────────────

describe("parseAttackTree — evaluation", () => {
  it("parses simple evaluation (p=, i=)", () => {
    const result = attackTreeParser.parse(DSL_SIMPLE, "simple");
    const leaf = result.ast!.children[0].children[0];

    expect(leaf.evaluation?.simple).toBeDefined();
    expect(leaf.evaluation!.simple!.probability).toBeCloseTo(0.5);
    expect(leaf.evaluation!.simple!.impact).toBe(3);
  });

  it("parses extended evaluation (f,b,i)", () => {
    const result = attackTreeParser.parse(DSL_EXTENDED, "extended");
    const leaf = result.ast!.children[0].children[0];

    expect(leaf.evaluation?.extended).toBeDefined();
    expect(leaf.evaluation!.extended!.impact).toBe(4);
  });

  it("gate nodes carry no leaf evaluation", () => {
    const result = attackTreeParser.parse(DSL_AND_GATE, "simple");
    const gate = result.ast!.children[0];

    expect(gate.type).toBe("AND");
    expect(gate.evaluation?.simple).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (5) Comments and blank lines
// ──────────────────────────────────────────────────────────────────────────

describe("parseAttackTree — comments and whitespace", () => {
  it("ignores comment lines and blank lines", () => {
    const dsl = [
      "# Attack Tree: demo",
      "",
      "Root;ROOT",
      "# a comment in the middle",
      "",
      "\tLeaf;p=0.5,i=3",
    ].join("\n");

    const result = attackTreeParser.parse(dsl, "simple");

    expect(result.success).toBe(true);
    expect(result.ast!.children).toHaveLength(1);
    expect(result.ast!.children[0].name).toBe("Leaf");
  });

  it("assigns 1-based line numbers that account for skipped lines", () => {
    const dsl = ["# header", "", "Root;ROOT", "\tLeaf;p=0.5,i=3"].join("\n");

    const result = attackTreeParser.parse(dsl, "simple");

    expect(result.ast!.lineNumber).toBe(3);
    expect(result.ast!.children[0].lineNumber).toBe(4);
  });
});
