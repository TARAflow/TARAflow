// tests/unit/features/attacktree/services/attacktree-validator.test.ts
//
// The validator is what turns a syntactically fine tree into a TARA-consistent
// one. Everything it catches would otherwise pass SILENTLY:
//
//   - a dangling [A-999] after an asset was renamed — the tree still draws, it
//     just no longer refers to anything
//   - an unrated leaf — it quietly contributes no feasibility
//   - a gate mixing rating methods — the path drops out of the analysis entirely
//   - a security goal the tree never attacks — a coverage gap that looks like a
//     finished tree
//
// SEVERITY IS PART OF THE CONTRACT, not decoration. A dangling asset ref is a
// *warning* (the model is wrong but the tree is usable); an empty node name is an
// *error* (nothing can be done with it); a mixed-method gate is an *error* (the
// arithmetic is impossible). Get a severity wrong and the tree either blocks on a
// triviality or ships with a hole — so every test asserts it explicitly.

import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import { attackTreeValidator } from "features/attacktree/services/attacktree-validator";
import { makeAsset, makeProjectData } from "../attacktree-factory";

function astOf(dsl: string) {
  const result = attackTreeParser.parse(dsl, "simple");
  if (!result.ast) {
    throw new Error(
      `fixture failed to parse: ${result.errors.map((e) => e.messageKey).join("; ")}`,
    );
  }
  return result.ast;
}

// ──────────────────────────────────────────────────────────────────────────
// TARA consistency — dangling references
// ──────────────────────────────────────────────────────────────────────────

describe("validateTARAConsistency", () => {
  it("passes when every reference resolves", () => {
    const ast = astOf(
      [
        "Steal [A-001] [DS-01];ROOT @disclosure",
        "\tLeaf [T-001];p=0.5,i=3 [M-001]",
      ].join("\n"),
    );

    expect(
      attackTreeValidator.validateTARAConsistency(ast, makeProjectData()),
    ).toEqual([]);
  });

  it("warns on an unknown asset reference", () => {
    // The tree still renders — it just points at an asset that no longer exists.
    // Warning, not error: the analyst must see it, but the tree stays usable.
    const ast = astOf("Steal [A-999];ROOT @disclosure\n\tLeaf;p=0.5,i=3");

    const errors = attackTreeValidator.validateTARAConsistency(
      ast,
      makeProjectData(),
    );

    const assetError = errors.find(
      (e) =>
        e.messageKey === "tabs.attacktree.validation.tara.assetNotFound" &&
        e.params?.ref === "A-999",
    );
    expect(assetError).toBeDefined();
    expect(assetError!.severity).toBe("warning");
    expect(assetError!.type).toBe("tara");
  });

  it("warns on an unknown DFD element reference", () => {
    const ast = astOf("Steal [A-001] [DS-99];ROOT\n\tLeaf;p=0.5,i=3");

    expect(
      attackTreeValidator
        .validateTARAConsistency(ast, makeProjectData())
        .some((e) => e.params?.ref === "DS-99" && e.severity === "warning"),
    ).toBe(true);
  });

  it("warns on an unknown threat reference", () => {
    const ast = astOf("Steal [A-001];ROOT\n\tLeaf [T-999];p=0.5,i=3");

    expect(
      attackTreeValidator
        .validateTARAConsistency(ast, makeProjectData())
        .some((e) => e.params?.ref === "T-999" && e.severity === "warning"),
    ).toBe(true);
  });

  it("reports an unknown mitigation as INFO, not a warning", () => {
    // A mitigation may legitimately be proposed in the tree before it exists in
    // the catalog. That is analysis in progress, not a modelling error.
    const ast = astOf("Steal [A-001];ROOT\n\tLeaf;p=0.5,i=3 [M-999]");

    const mitigationError = attackTreeValidator
      .validateTARAConsistency(ast, makeProjectData())
      .find((e) => e.params?.ref === "M-999");

    expect(mitigationError).toBeDefined();
    expect(mitigationError!.severity).toBe("info");
  });

  it("matches references case-insensitively", () => {
    // [a-001] and [A-001] are the same asset. Anything else produces phantom
    // warnings on a perfectly good tree.
    const ast = astOf("Steal [a-001];ROOT\n\tLeaf;p=0.5,i=3 [m-001]");

    expect(
      attackTreeValidator.validateTARAConsistency(ast, makeProjectData()),
    ).toEqual([]);
  });

  it("checks references on every node, not just the root", () => {
    const ast = astOf(
      [
        "Steal [A-001];ROOT",
        "\tGate;OR",
        "\t\tDeep [A-999];p=0.5,i=3", // ← buried two levels down
      ].join("\n"),
    );

    expect(
      attackTreeValidator
        .validateTARAConsistency(ast, makeProjectData())
        .some((e) => e.params?.ref === "A-999"),
    ).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Attack goals
// ──────────────────────────────────────────────────────────────────────────

describe("validateAttackGoals", () => {
  it("accepts a known attack goal", () => {
    const ast = astOf("Steal [A-001];ROOT @disclosure\n\tLeaf;p=0.5,i=3");

    expect(
      attackTreeValidator
        .validateAttackGoals(ast, makeProjectData(), "A-001")
        .filter((e) => e.severity === "warning"),
    ).toEqual([]);
  });

  it("the PARSER rejects an unknown goal — it never reaches node.attackGoal", () => {
    // This is where an unknown goal is actually caught. isValidAttackGoal() gates
    // the assignment, so the parser warns and leaves attackGoal undefined rather
    // than letting a meaningless goal into the AST.
    const result = attackTreeParser.parse(
      "Steal [A-001];ROOT @nonsense\n\tLeaf;p=0.5,i=3",
      "simple",
    );

    expect(result.ast!.attackGoal).toBeUndefined();
    expect(
      result.warnings.some(
        (w) => w.messageKey === "tabs.attacktree.validation.parser.unknownGoal",
      ),
    ).toBe(true);
  });

  it("the validator still catches an unknown goal on an AST it did not parse", () => {
    // Defence in depth: an AST can also arrive from a persisted .tara.json written
    // by an older version, where the goal vocabulary differed. The parser is not
    // in that path, so the validator must not assume the goal was ever screened.
    const ast = astOf("Steal [A-001];ROOT @disclosure\n\tLeaf;p=0.5,i=3");
    // Simulate a goal that is no longer in ATTACK_GOAL_DEFINITIONS.
    ast.attackGoal = "retired_goal" as never;

    const goalError = attackTreeValidator
      .validateAttackGoals(ast, makeProjectData(), "A-001")
      .find((e) => e.messageKey === "tabs.attacktree.validation.goal.unknown");

    expect(goalError).toBeDefined();
    expect(goalError!.severity).toBe("warning");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Completeness
// ──────────────────────────────────────────────────────────────────────────

describe("validateCompleteness", () => {
  it("errors on an empty node name", () => {
    // An unnamed node cannot be identified, cannot be assessed, and (Phase 1)
    // cannot even carry a stable pathKey.
    const ast = astOf("Root;ROOT\n\tLeaf;p=0.5,i=3");
    ast.children[0].name = "";

    const nameError = attackTreeValidator
      .validateCompleteness(ast)
      .find((e) => e.messageKey === "tabs.attacktree.validation.completeness.emptyName");

    expect(nameError).toBeDefined();
    expect(nameError!.severity).toBe("error");
  });

  it("warns about a leaf with no risk evaluation", () => {
    // An unrated leaf contributes no feasibility. Unflagged, it would look like
    // the safest part of the tree.
    const ast = astOf("Root;ROOT\n\tUnrated;OR\n\t\tStillUnrated;OR");

    expect(
      attackTreeValidator
        .validateCompleteness(ast)
        .some(
          (e) =>
            e.messageKey === "tabs.attacktree.validation.completeness.leafNoEvaluation" &&
            e.severity === "warning",
        ),
    ).toBe(true);
  });

  it("does not warn when every leaf is evaluated", () => {
    const ast = astOf(
      [
        "Root;ROOT",
        "\tGate;OR",
        "\t\tA;p=0.5,i=3 [M-001]",
        "\t\tB;p=0.5,i=3 [M-001]",
      ].join("\n"),
    );

    expect(
      attackTreeValidator
        .validateCompleteness(ast)
        .some(
          (e) => e.messageKey === "tabs.attacktree.validation.completeness.leafNoEvaluation",
        ),
    ).toBe(false);
  });

  it("reports a path with no mitigations as INFO", () => {
    // A path with no controls is a finding, not a defect — the analyst may not
    // have got there yet, or may be accepting the risk.
    const ast = astOf("Root;ROOT\n\tGate;OR\n\t\tA;p=0.5,i=3\n\t\tB;p=0.5,i=3");

    expect(
      attackTreeValidator
        .validateCompleteness(ast)
        .some(
          (e) =>
            e.messageKey === "tabs.attacktree.validation.completeness.pathNoMitigations" &&
            e.severity === "info",
        ),
    ).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Security goal coverage
// ──────────────────────────────────────────────────────────────────────────

describe("validateSecurityGoalCoverage", () => {
  it("warns when an enabled security goal is never attacked", () => {
    // The asset needs C and I protected; the tree only models an attack on
    // confidentiality. Integrity is unanalysed — a coverage gap that otherwise
    // looks like a finished tree.
    const ast = astOf("Steal [A-001];ROOT @disclosure\n\tLeaf;p=0.5,i=3");

    const errors = attackTreeValidator.validateSecurityGoalCoverage(
      ast,
      makeAsset(),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("warning");
    expect(errors[0].messageKey).toBe("tabs.attacktree.validation.coverage.missingGoals");
  });

  it("passes when every enabled goal is covered", () => {
    const ast = astOf(
      [
        "Steal [A-001];ROOT @disclosure",
        "\tTamper;OR @manipulation",
        "\t\tLeaf;p=0.5,i=3",
      ].join("\n"),
    );

    expect(
      attackTreeValidator.validateSecurityGoalCoverage(ast, makeAsset()),
    ).toEqual([]);
  });

  it("has nothing to check for an asset with no enabled goals", () => {
    const ast = astOf("Steal [A-001];ROOT @disclosure\n\tLeaf;p=0.5,i=3");
    const asset = makeAsset({ securityGoals: [{ type: "C", enabled: false }] });

    expect(
      attackTreeValidator.validateSecurityGoalCoverage(ast, asset),
    ).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Rating method consistency  (Phase 2/3)
// ──────────────────────────────────────────────────────────────────────────

describe("validateRatingMethodConsistency", () => {
  it("REGRESSION: a gate mixing attack potential and probability is an ERROR", () => {
    // An AND gate SUMS attack potential (effort accumulates) or MULTIPLIES
    // probabilities. There is no honest way to combine "four weeks of expert
    // work" with "p=0.8" — they are different kinds of quantity.
    //
    // The calculator returns undefined for such a gate. Without this error the
    // path would silently carry NO feasibility and drop out of the analysis: an
    // attack path that quietly stops being assessed and says nothing about it.
    const ast = astOf(
      [
        "Root;ROOT",
        "\tGate;AND",
        "\t\tByPotential;et=1m,se=expert,kn=restricted,wo=easy,eq=standard",
        "\t\tByProbability;p=0.8,i=3",
      ].join("\n"),
    );

    const errors = attackTreeValidator.validateRatingMethodConsistency(ast);

    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].messageKey).toBe("tabs.attacktree.validation.rating.mixedMethods");
  });

  it("a gate rated consistently in audit mode is fine", () => {
    const ast = astOf(
      [
        "Root;ROOT",
        "\tGate;AND",
        "\t\tA;et=1m,se=expert,kn=restricted,wo=easy,eq=standard",
        "\t\tB;et=1w,se=proficient,kn=public,wo=easy,eq=standard",
      ].join("\n"),
    );

    expect(attackTreeValidator.validateRatingMethodConsistency(ast)).toEqual([]);
  });

  it("a gate rated consistently in quick mode is fine", () => {
    const ast = astOf(
      ["Root;ROOT", "\tGate;AND", "\t\tA;p=0.5,i=3", "\t\tB;p=0.7,i=3"].join("\n"),
    );

    expect(attackTreeValidator.validateRatingMethodConsistency(ast)).toEqual([]);
  });

  it("detects the mix at a nested gate, not just the top one", () => {
    const ast = astOf(
      [
        "Root;ROOT",
        "\tOuter;OR",
        "\t\tInner;AND",
        "\t\t\tA;et=1m,se=expert,kn=restricted,wo=easy,eq=standard",
        "\t\t\tB;p=0.8,i=3",
      ].join("\n"),
    );

    const errors = attackTreeValidator.validateRatingMethodConsistency(ast);

    expect(errors).toHaveLength(1);
    expect(errors[0].params?.name).toBe("Inner");
  });

  it("an unrated child does not trigger a false positive", () => {
    // An unrated leaf has no rating method at all — that is not a "mix".
    // Flagging it here would bury the real signal (validateCompleteness already
    // warns about the missing evaluation).
    const ast = astOf(
      ["Root;ROOT", "\tGate;AND", "\t\tRated;p=0.5,i=3", "\t\tUnrated;OR"].join(
        "\n",
      ),
    );

    expect(attackTreeValidator.validateRatingMethodConsistency(ast)).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Deprecated per-leaf impact  (Phase 3)
// ──────────────────────────────────────────────────────────────────────────

describe("validateDeprecatedImpact", () => {
  it("reports a per-leaf impact as INFO, never as an error", () => {
    // Impact belongs to the damage scenario — asset × security goal (ISO 3.1.22 /
    // 3.1.24) — not to an attack step. The old DSL let one tree claim two
    // different impacts for one damage scenario.
    //
    // Existing trees are full of `i=`, so this can only ever be informational.
    const ast = astOf(["Root;ROOT", "\tLeaf;p=0.5,i=3"].join("\n"));

    const infos = attackTreeValidator.validateDeprecatedImpact(ast, "A-001");

    expect(infos).toHaveLength(1);
    expect(infos[0].severity).toBe("info");
    expect(infos[0].messageKey).toBe("tabs.attacktree.validation.impact.ignoredWithAsset");
    expect(infos[0].params?.asset).toBe("A-001");
  });

  it("explains the damage-scenario rule when the tree is not asset-anchored", () => {
    const ast = astOf(["Root;ROOT", "\tLeaf;p=0.5,i=3"].join("\n"));

    const infos = attackTreeValidator.validateDeprecatedImpact(ast, undefined);

    expect(infos[0].messageKey).toBe("tabs.attacktree.validation.impact.ignoredGeneric");
  });

  it("says nothing about a tree rated in audit mode (no i= anywhere)", () => {
    const ast = astOf(
      ["Root;ROOT", "\tLeaf;et=1w,se=expert,kn=public,wo=easy,eq=standard"].join(
        "\n",
      ),
    );

    expect(attackTreeValidator.validateDeprecatedImpact(ast, "A-001")).toEqual(
      [],
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Full validation — how findings are bucketed, and what blocks
// ──────────────────────────────────────────────────────────────────────────

describe("validateAttackTree", () => {
  it("is invalid when syntax errors are passed in", () => {
    const result = attackTreeValidator.validateAttackTree(
      undefined,
      makeProjectData(),
      [
        {
          line: 1,
          type: "syntax",
          severity: "error",
          messageKey: "tabs.attacktree.validation.test.boom",
        },
      ],
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it("is valid when only warnings and infos are present", () => {
    // A dangling asset ref must NOT block the tree. If it did, renaming one asset
    // would brick every tree pointing at it.
    const ast = astOf("Steal [A-999];ROOT @disclosure\n\tLeaf;p=0.5,i=3 [M-001]");

    const result = attackTreeValidator.validateAttackTree(
      ast,
      makeProjectData(),
      [],
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("REGRESSION: a tree with deprecated i= is still VALID", () => {
    // Info must never flip isValid — otherwise every project that exists today
    // would break the moment Phase 3 landed.
    const result = attackTreeValidator.validateAttackTree(
      astOf(
        ["Steal [A-001];ROOT @disclosure", "\tLeaf;p=0.5,i=3 [M-001]"].join("\n"),
      ),
      makeProjectData(),
      [],
      "A-001",
    );

    expect(result.isValid).toBe(true);
    expect(result.infos.length).toBeGreaterThan(0);
  });

  it("REGRESSION: a mixed-method gate DOES make the tree invalid", () => {
    // The mirror of the test above. This one must block: the path has no
    // feasibility, so the tree cannot be analysed at all.
    const result = attackTreeValidator.validateAttackTree(
      astOf(
        [
          "Steal [A-001];ROOT @disclosure",
          "\tGate;AND",
          "\t\tA;et=1m,se=expert,kn=restricted,wo=easy,eq=standard",
          "\t\tB;p=0.8,i=3",
        ].join("\n"),
      ),
      makeProjectData(),
      [],
      "A-001",
    );

    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.messageKey === "tabs.attacktree.validation.rating.mixedMethods",
      ),
    ).toBe(true);
  });

  it("sorts findings into errors / warnings / infos by severity", () => {
    const ast = astOf("Steal [A-999];ROOT @disclosure\n\tLeaf;OR");

    const result = attackTreeValidator.validateAttackTree(
      ast,
      makeProjectData(),
      [],
    );

    // Nothing is miscategorised — a warning must never land in errors, etc.
    expect(result.errors.every((e) => e.severity === "error")).toBe(true);
    expect(result.warnings.every((e) => e.severity === "warning")).toBe(true);
    expect(result.infos.every((e) => e.severity === "info")).toBe(true);
  });

  it("records when it last ran", () => {
    const result = attackTreeValidator.validateAttackTree(
      astOf("Root;ROOT\n\tLeaf;p=0.5,i=3"),
      makeProjectData(),
      [],
    );

    expect(result.lastValidated).toBeTruthy();
    expect(new Date(result.lastValidated).toString()).not.toBe("Invalid Date");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

describe("hasAttackGoals / getUniqueAttackGoals", () => {
  it("detects whether any node declares a goal", () => {
    expect(
      attackTreeValidator.hasAttackGoals(
        astOf("Root;ROOT @disclosure\n\tLeaf;p=0.5,i=3"),
      ),
    ).toBe(true);

    expect(
      attackTreeValidator.hasAttackGoals(astOf("Root;ROOT\n\tLeaf;p=0.5,i=3")),
    ).toBe(false);
  });

  it("collects each goal once, however often it appears", () => {
    const ast = astOf(
      [
        "Root;ROOT @disclosure",
        "\tA;OR @disclosure", // repeat
        "\t\tLeaf;p=0.5,i=3 @manipulation",
      ].join("\n"),
    );

    const goals = attackTreeValidator.getUniqueAttackGoals(ast);

    expect(goals).toContain("disclosure");
    expect(goals).toContain("manipulation");
    expect(goals.filter((g) => g === "disclosure")).toHaveLength(1);
  });
});