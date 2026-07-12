// tests/unit/features/attacktree/services/attacktree-operations.test.ts
//
// Covers the second field bug: the Create dialog offered templates, but the
// selected templateId never reached tree creation — every tree came out empty.
// The dialog looked fine, so nothing surfaced except "die Vorlagen fehlen".
//
// createTreeFromTemplate is therefore pinned here: a template-created tree
// must differ from an empty one AND must arrive already parsed (an unparsed
// tree renders no diagram, which is how the bug presented).

import { describe, it, expect } from "vitest";
import { attackTreeOperations } from "features/attacktree/services/attacktree-operations";
import {
  ATTACK_TREE_TEMPLATES,
  type AttackTree,
  type AttackTreeAnchor,
} from "features/attacktree/models/attacktree-types";
import { makeProjectData } from "../attacktree-factory";

const ASSET_ANCHOR: AttackTreeAnchor = {
  type: "asset",
  assetId: "A-001",
  assetName: "Config Database",
  securityGoal: "C",
};

// ──────────────────────────────────────────────────────────────────────────
// Template creation  [REGRESSION]
// ──────────────────────────────────────────────────────────────────────────

describe("createTreeFromTemplate", () => {
  it("REGRESSION: produces a tree from the template DSL, not an empty one", () => {
    const project = makeProjectData();

    const empty = attackTreeOperations.createParsedTree(
      ASSET_ANCHOR,
      { evaluationMethod: "extended" },
      project,
    );
    const fromTemplate = attackTreeOperations.createTreeFromTemplate(
      "template-confidentiality",
      ASSET_ANCHOR,
      project,
    );

    expect(fromTemplate).not.toBeNull();
    // The whole point of the bug: these two were identical.
    expect(fromTemplate!.dsl).not.toBe(empty.dsl);
    expect(fromTemplate!.dsl.length).toBeGreaterThan(empty.dsl.length);
  });

  it("returns a tree that is already parsed (has an AST) — otherwise no diagram renders", () => {
    const tree = attackTreeOperations.createTreeFromTemplate(
      "template-confidentiality",
      ASSET_ANCHOR,
      makeProjectData(),
    );

    expect(tree!.ast).toBeDefined();
    expect(tree!.ast!.type).toBe("ROOT");
    expect(tree!.ast!.children.length).toBeGreaterThan(0);
  });

  it("substitutes the anchor's asset id into the template placeholder", () => {
    const tree = attackTreeOperations.createTreeFromTemplate(
      "template-confidentiality",
      ASSET_ANCHOR,
      makeProjectData(),
    );

    expect(tree!.dsl).not.toContain("ASSET_ID");
    expect(tree!.ast!.assetRef).toBe("A-001");
  });

  it("returns null for an unknown template id", () => {
    const tree = attackTreeOperations.createTreeFromTemplate(
      "template-does-not-exist",
      ASSET_ANCHOR,
      makeProjectData(),
    );

    expect(tree).toBeNull();
  });

  it("every shipped template parses into a valid ROOT tree", () => {
    // Guards against a template being added with broken (e.g. space-indented
    // or ROOT-less) DSL — which the user would only discover after picking it.
    const project = makeProjectData();

    for (const template of ATTACK_TREE_TEMPLATES) {
      const anchor: AttackTreeAnchor = template.suitableFor.includes("asset")
        ? ASSET_ANCHOR
        : { type: "standalone" };

      const tree = attackTreeOperations.createTreeFromTemplate(
        template.id,
        anchor,
        project,
      );

      expect(tree, `template ${template.id} failed to load`).not.toBeNull();
      expect(tree!.ast, `template ${template.id} produced no AST`).toBeDefined();
      expect(tree!.ast!.type).toBe("ROOT");
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Parse & validate
// ──────────────────────────────────────────────────────────────────────────

describe("parseAndValidateTree", () => {
  it("attaches ast, validation and pathAnalysis for a valid tree", () => {
    const project = makeProjectData();
    const tree = attackTreeOperations.createTreeFromTemplate(
      "template-confidentiality",
      ASSET_ANCHOR,
      project,
    )!;

    expect(tree.validation).toBeDefined();
    expect(tree.pathAnalysis).toBeDefined();
    expect(tree.pathAnalysis!.totalPaths).toBeGreaterThan(0);
  });

  it("omits pathAnalysis when the DSL is structurally invalid", () => {
    const project = makeProjectData();
    const base = attackTreeOperations.createParsedTree(
      ASSET_ANCHOR,
      {},
      project,
    );

    const broken = attackTreeOperations.parseAndValidateTree(
      base,
      "Orphan;OR", // no ROOT
      project,
    );

    expect(broken.validation!.isValid).toBe(false);
    expect(broken.pathAnalysis).toBeUndefined();
  });

  it("needsParsing() is true only while a tree has no AST", () => {
    const project = makeProjectData();
    const parsed = attackTreeOperations.createParsedTree(
      ASSET_ANCHOR,
      {},
      project,
    );

    expect(attackTreeOperations.needsParsing(parsed)).toBe(false);
    expect(
      attackTreeOperations.needsParsing({ ...parsed, ast: undefined }),
    ).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Collection operations (pure, immutable)
// ──────────────────────────────────────────────────────────────────────────

describe("tree collection operations", () => {
  function makeTree(id: string): AttackTree {
    const tree = attackTreeOperations.createParsedTree(
      ASSET_ANCHOR,
      {},
      makeProjectData(),
    );
    return { ...tree, id };
  }

  it("addTreeToCollection does not mutate the input array", () => {
    const trees = [makeTree("t1")];
    const result = attackTreeOperations.addTreeToCollection(
      trees,
      makeTree("t2"),
    );

    expect(trees).toHaveLength(1);
    expect(result).toHaveLength(2);
  });

  it("updateTreeInCollection replaces by id and leaves others untouched", () => {
    const t1 = makeTree("t1");
    const t2 = makeTree("t2");
    const updated = { ...t2, name: "renamed" };

    const result = attackTreeOperations.updateTreeInCollection(
      [t1, t2],
      updated,
    );

    expect(result.find((t) => t.id === "t2")!.name).toBe("renamed");
    expect(result.find((t) => t.id === "t1")).toBe(t1);
  });

  it("updateTreeInCollection is a no-op for an unknown id", () => {
    const trees = [makeTree("t1")];
    const result = attackTreeOperations.updateTreeInCollection(
      trees,
      makeTree("ghost"),
    );

    expect(result).toBe(trees);
  });

  it("removeTreeFromCollection removes only the target", () => {
    const result = attackTreeOperations.removeTreeFromCollection(
      [makeTree("t1"), makeTree("t2")],
      "t1",
    );

    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });

  it("countValidTrees counts only trees whose validation passed", () => {
    const project = makeProjectData();
    const good = attackTreeOperations.createTreeFromTemplate(
      "template-confidentiality",
      ASSET_ANCHOR,
      project,
    )!;
    const bad = attackTreeOperations.parseAndValidateTree(
      good,
      "Orphan;OR",
      project,
    );

    expect(attackTreeOperations.countValidTrees([good, bad])).toBe(1);
  });
});

describe("needsParsing — legacy pathAnalysis migration", () => {
  it("REGRESSION: a tree persisted before pathKey existed is re-parsed", () => {
    // Projects saved by v0.5 have an AST *and* a pathAnalysis, so the old
    // `!tree.ast` check would say "no parsing needed" and hand back paths whose
    // pathKey is undefined — despite the type promising a string. Everything
    // keyed off pathKey (threat ids, Class A/B diff) would then collapse onto
    // one undefined key.
    const project = makeProjectData();
    const tree = attackTreeOperations.createTreeFromTemplate(
      "template-confidentiality",
      ASSET_ANCHOR,
      project,
    )!;

    // Simulate a project loaded from a pre-Phase-1 .tara.json: AST present,
    // pathAnalysis present, but the paths carry no pathKey.
    const legacy: AttackTree = {
      ...tree,
      pathAnalysis: {
        ...tree.pathAnalysis!,
        paths: tree.pathAnalysis!.paths.map((p) => {
          const { pathKey: _dropped, ...withoutKey } = p;
          return withoutKey as typeof p;
        }),
      },
    };

    expect(attackTreeOperations.needsParsing(legacy)).toBe(true);

    // ...and re-parsing heals it.
    const healed = attackTreeOperations.parseAndValidateTree(
      legacy,
      legacy.dsl,
      project,
    );
    expect(healed.pathAnalysis!.paths.every((p) => !!p.pathKey)).toBe(true);
  });

  it("a tree already carrying pathKeys is not re-parsed", () => {
    const tree = attackTreeOperations.createTreeFromTemplate(
      "template-confidentiality",
      ASSET_ANCHOR,
      makeProjectData(),
    )!;

    expect(tree.pathAnalysis!.paths.every((p) => !!p.pathKey)).toBe(true);
    expect(attackTreeOperations.needsParsing(tree)).toBe(false);
  });

  it("a tree with no paths at all is not re-parsed on that account", () => {
    // An empty-but-valid tree must not be forced into a re-parse loop.
    const tree = attackTreeOperations.createParsedTree(
      ASSET_ANCHOR,
      {},
      makeProjectData(),
    );
    const noPaths: AttackTree = {
      ...tree,
      pathAnalysis: { ...tree.pathAnalysis!, paths: [] },
    };

    expect(attackTreeOperations.needsParsing(noPaths)).toBe(false);
  });
});



