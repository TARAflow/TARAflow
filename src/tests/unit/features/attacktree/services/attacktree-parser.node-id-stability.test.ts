// src/tests/unit/features/attacktree/services/attacktree-parser.node-id-stability.test.ts
//
// Parsing is deterministic: the same DSL yields the same node ids.
//
// Node ids used to be `node-${Date.now()}-${Math.random()}`, minted per node at
// parse time. Since the parser rebuilds the whole AST on every edit, every node
// got a new id on every keystroke — and parentId, PathAnalysis.nodeIds and
// criticalPath all point at them. Changing one leaf value from 4 to 5 rewrote
// several hundred lines of the saved project, which makes a .tara.json
// unreviewable in a diff. For a tool whose output is meant to be auditable,
// that is a defect, not cosmetics.
//
// Ids now come from the ROOT→node name chain, the same way pathKey does.

import { describe, it, expect } from "vitest";
import { parseAttackTree } from "features/attacktree/services/attacktree-parser";
import type { AttackTreeNode } from "features/attacktree/models/attacktree-types";

const DSL = `Data Tampering [DA-001];ROOT @manipulation
\tApplication Layer;OR
\t\tInput Validation Bypass;AND @manipulation
\t\t\tFind Weak Validation;0.6,0.8,3
\t\t\tInject Malicious Data;0.7,0.9,4
\t\tLogic Manipulation;0.4,0.7,3 @manipulation
\tStorage Layer;0.2,0.5,4 @manipulation`;

/** Every id in the tree, in document order. */
function collectIds(node: AttackTreeNode, acc: string[] = []): string[] {
  acc.push(node.id);
  node.children.forEach((c: AttackTreeNode) => collectIds(c, acc));
  return acc;
}

function parse(dsl: string): AttackTreeNode {
  const result = parseAttackTree(dsl, "extended");
  if (!result.ast) throw new Error("fixture DSL failed to parse");
  return result.ast;
}

describe("parseAttackTree — node ids are content-derived", () => {
  it("produces identical ids for the same DSL parsed twice", () => {
    expect(collectIds(parse(DSL))).toEqual(collectIds(parse(DSL)));
  });

  it("keeps ids stable when only an evaluation value changes", () => {
    // THE regression: this edit used to rewrite every id in the tree.
    const edited = DSL.replace(
      "Inject Malicious Data;0.7,0.9,4",
      "Inject Malicious Data;0.7,0.9,5",
    );
    expect(collectIds(parse(edited))).toEqual(collectIds(parse(DSL)));
  });

  it("keeps ids stable when an unrelated sibling is added", () => {
    // Only the new node's id is added; the existing ones must not move.
    const withExtra = `${DSL}\n\tNetwork Layer;0.3,0.4,2 @manipulation`;
    const before = collectIds(parse(DSL));
    const after = collectIds(parse(withExtra));
    expect(after).toEqual(expect.arrayContaining(before));
    expect(after).toHaveLength(before.length + 1);
  });

  it("changes the id of a renamed node — a rename is a different step", () => {
    const renamed = DSL.replace("Storage Layer", "Persistence Layer");
    const before = parse(DSL).children.find(
      (c: AttackTreeNode) => c.name === "Storage Layer",
    )!;
    const after = parse(renamed).children.find(
      (c: AttackTreeNode) => c.name === "Persistence Layer",
    )!;
    expect(after.id).not.toBe(before.id);
  });

  it("carries no timestamp or random component", () => {
    for (const id of collectIds(parse(DSL))) {
      expect(id).toMatch(/^node-[0-9a-f]{12}(-\d+)?$/);
    }
  });
});

describe("parseAttackTree — structural integrity of the ids", () => {
  it("gives every node a unique id", () => {
    const ids = collectIds(parse(DSL));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("disambiguates identically-named siblings", () => {
    const duplicates = `Root;ROOT @manipulation
\tBranch;OR
\t\tStep;0.5,0.5,3
\t\tStep;0.5,0.5,3`;
    const branch = parse(duplicates).children[0];
    expect(branch.children[0].id).not.toBe(branch.children[1].id);
  });

  it("links parentId to the parent's stable id", () => {
    const root = parse(DSL);
    expect(root.parentId).toBeUndefined();
    for (const child of root.children) {
      expect(child.parentId).toBe(root.id);
      for (const grandchild of child.children) {
        expect(grandchild.parentId).toBe(child.id);
      }
    }
  });
});