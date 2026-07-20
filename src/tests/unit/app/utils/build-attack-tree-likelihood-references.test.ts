// tests/unit/app/utils/build-attack-tree-likelihood-references.test.ts
//
// 5b-2 — the app-layer builder that turns each tree's likelihood into an
// AttackTreeLikelihoodReference for the Risk feature.
//
// The failures this guards against:
//   - an unrated path silently contributing a likelihood (it must contribute
//     NOTHING, not a low value)
//   - the riskId drifting from the id the 5a threat generator assigns (they
//     MUST match, or the likelihood lands on no risk)
//   - asset-anchored trees collapsing all paths to one value (each emitted path
//     is its own risk and must keep its own likelihood)
//   - threat-anchored trees emitting per-path (the whole tree is one risk → one
//     aggregated value)

import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import { attackTreeCalculator } from "features/attacktree/services/attacktree-calculator";
import { buildThreatId } from "features/attacktree/services/attacktree-threat-generator";
import type {
  AttackTree,
  AttackTreeAnchor,
  AttackTreeData,
} from "features/attacktree/models/attacktree-types";
import { buildAttackTreeLikelihoodReferences } from "app/utils/build-attack-tree-likelihood-references";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures — mirror attacktree-threat-generator.test.ts's makeTree
// ──────────────────────────────────────────────────────────────────────────

const ASSET_ANCHOR: AttackTreeAnchor = {
  type: "asset",
  assetId: "A-001",
  assetName: "Config Database",
  securityGoal: "C",
};

const THREAT_ANCHOR: AttackTreeAnchor = {
  type: "threat",
  threatId: "T-042",
  threatTitle: "Config disclosure",
  strideCategory: "I",
};

function makeTree(
  dsl: string,
  anchor: AttackTreeAnchor = ASSET_ANCHOR,
  id = "at-1",
): AttackTree {
  const parsed = attackTreeParser.parse(dsl, "simple");
  if (!parsed.ast) {
    throw new Error(
      `fixture failed to parse: ${parsed.errors.map((e) => e.messageKey).join("; ")}`,
    );
  }
  return {
    id,
    name: "Steal Config",
    anchor,
    dsl,
    ast: parsed.ast,
    pathAnalysis: attackTreeCalculator.analyzeAttackPaths(parsed.ast, "simple"),
    configuration: { evaluationMethod: "simple" },
  } as unknown as AttackTree;
}

/** Wrap trees in the AttackTreeData shape the builder receives. */
function makeData(trees: AttackTree[]): AttackTreeData {
  return { trees, configuration: undefined } as unknown as AttackTreeData;
}

const SIMPLE_TREE = [
  "Steal Config [A-001];ROOT @disclosure",
  "\tRemote Path;OR",
  "\t\tExploit API;p=0.9,i=3 [M-001]",
  "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
].join("\n");

// An unrated leaf (no evaluation) → its path has no likelihoodLevel.
const UNRATED_TREE = [
  "Steal Config [A-001];ROOT @disclosure",
  "\tRemote Path;OR",
  "\t\tExploit API;LEAF [M-001]",
].join("\n");

// ──────────────────────────────────────────────────────────────────────────

describe("buildAttackTreeLikelihoodReferences", () => {
  it("returns [] when there are no trees", () => {
    expect(buildAttackTreeLikelihoodReferences(null)).toEqual([]);
    expect(buildAttackTreeLikelihoodReferences(makeData([]))).toEqual([]);
  });

  it("returns [] for a tree without pathAnalysis", () => {
    const tree = makeTree(SIMPLE_TREE);
    const noPathAnalysis = { ...tree, pathAnalysis: undefined } as AttackTree;
    expect(
      buildAttackTreeLikelihoodReferences(makeData([noPathAnalysis])),
    ).toEqual([]);
  });

  describe("asset-anchored → per path", () => {
    it("emits one reference per emitted path, riskId === buildThreatId(...)", () => {
      const tree = makeTree(SIMPLE_TREE, ASSET_ANCHOR);
      const refs = buildAttackTreeLikelihoodReferences(makeData([tree]));

      expect(refs.length).toBeGreaterThan(0);
      // Every ref's riskId must be reconstructable from (treeId, pathKey, stride)
      // — i.e. identical to the 5a threat id, so it lands on the right risk.
      for (const ref of refs) {
        expect(ref.riskId).toBe(
          buildThreatId(tree.id, ref.pathKey, ref.strideCategory),
        );
        expect(ref.treeId).toBe(tree.id);
      }
    });

    it("each reference carries a mappedValue on the risk scale", () => {
      const tree = makeTree(SIMPLE_TREE, ASSET_ANCHOR);
      const refs = buildAttackTreeLikelihoodReferences(makeData([tree]));
      for (const ref of refs) {
        expect(typeof ref.mappedValue).toBe("number");
        expect(ref.mappedValue).toBeGreaterThan(0);
      }
    });

    it("an unrated path contributes NO reference (never a silent low)", () => {
      const tree = makeTree(UNRATED_TREE, ASSET_ANCHOR);
      const refs = buildAttackTreeLikelihoodReferences(makeData([tree]));
      expect(refs).toEqual([]);
    });
  });

  describe("threat-anchored → aggregated", () => {
    it("emits exactly one reference for the whole tree, riskId === anchor.threatId", () => {
      const tree = makeTree(SIMPLE_TREE, THREAT_ANCHOR);
      const refs = buildAttackTreeLikelihoodReferences(makeData([tree]));

      expect(refs).toHaveLength(1);
      expect(refs[0].riskId).toBe("T-042");
      expect(refs[0].treeId).toBe(tree.id);
      expect(refs[0].mappedValue).toBeGreaterThan(0);
    });

    it("an unrated threat-anchored tree contributes nothing", () => {
      const tree = makeTree(UNRATED_TREE, THREAT_ANCHOR);
      const refs = buildAttackTreeLikelihoodReferences(makeData([tree]));
      expect(refs).toEqual([]);
    });
  });

  it("standalone / risk-anchored trees do not feed likelihood here", () => {
    const standalone = makeTree(SIMPLE_TREE, {
      type: "standalone",
    } as AttackTreeAnchor);
    expect(
      buildAttackTreeLikelihoodReferences(makeData([standalone])),
    ).toEqual([]);
  });

  it("flattens across multiple trees", () => {
    const assetTree = makeTree(SIMPLE_TREE, ASSET_ANCHOR, "at-asset");
    const threatTree = makeTree(SIMPLE_TREE, THREAT_ANCHOR, "at-threat");
    const refs = buildAttackTreeLikelihoodReferences(
      makeData([assetTree, threatTree]),
    );
    const treeIds = new Set(refs.map((r) => r.treeId));
    expect(treeIds.has("at-asset")).toBe(true);
    expect(treeIds.has("at-threat")).toBe(true);
  });
});
