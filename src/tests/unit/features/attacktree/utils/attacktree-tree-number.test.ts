// User 2026-10-30: the attack-tree tab shows "AT-n" before the tree title and
// AT-n.m per path — the numbers the threats, the risks and the report use.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { treeDisplayId, treeNumberOf } from "features/attacktree/utils/attacktree-labels";
import { attackPathDisplayId } from "features/attacktree/services/attacktree-threat-generator";
import { buildAttackPathThreatReferences } from "app/utils/build-attack-path-threat-references";
import { parseAndRepair } from "app/services/migration-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

describe("tree number", () => {
  it("the 1-based position of the tree in the project", () => {
    const trees = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(treeNumberOf(trees, "b")).toBe(2);
    expect(treeDisplayId(trees, "c")).toBe("AT-3");
    expect(treeDisplayId(trees, "x")).toBeUndefined();
  });

  it("matches the display ids of the attack-path threats (headlamp fixture)", () => {
    const p: Any = parseAndRepair(JSON.parse(readFileSync("src/tests/fixtures/headlamp-iso21434.tara.json", "utf-8")));
    const trees = p.attackTrees.trees;
    const refs = buildAttackPathThreatReferences(p.attackTrees, false, p.info.tags);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs as Any[]) {
      const tree = trees.find((t: Any) => ref.id.startsWith(`AT-${t.id}-`));
      const path = tree.pathAnalysis.paths.find((x: Any) => ref.id === `AT-${tree.id}-${x.pathKey}-${ref.strideCategory}`);
      expect(ref.displayId.startsWith(attackPathDisplayId(treeNumberOf(trees, tree.id)!, path))).toBe(true);
    }
  });
});
