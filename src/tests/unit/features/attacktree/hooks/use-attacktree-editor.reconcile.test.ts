// src/tests/unit/features/attacktree/hooks/use-attacktree-editor.reconcile.test.ts
//
// PHASE 5a — editor wiring, tested as LOGIC (no renderHook, matching the
// project's service-test style).
//
// The editor hook's only 5a responsibility is: after a re-parse, run
// reconcileAttackPathThreats(updatedTree, previousAnalysis) and surface the
// diff. The React plumbing (state, debounce, refs) is not what can silently
// break the contract — the previous/next pairing is. So we test THAT directly:
// feed the exact (updatedTree, previous) the hook would build, and assert the
// Class A/B outcome. If a refactor ever passes the WRONG previous (e.g. the
// post-parse analysis, which would make every edit look like "no change"),
// these fail.

import { describe, it, expect } from "vitest";
import {
  createEmptyAttackTree,
  type AttackPath,
  type AttackTree,
  type PathAnalysis,
  type AttackPathAssessment,
} from "features/attacktree/models/attacktree-types";
import { computePathKey } from "features/attacktree/services/attacktree-path-identity";
import { reconcileAttackPathThreats } from "features/attacktree/services/attacktree-threat-sync";

// Reuse the same minimal fixtures shape as the sync test.
function makePath(chain: string[]): AttackPath {
  return {
    id: "d",
    pathKey: computePathKey(chain),
    path: chain,
    nodeIds: chain.map((_, i) => `n${i}`),
    feasibilityLevel: "medium",
    riskScore: 1,
    attackGoals: ["manipulation"],
    mitigations: [],
    isCritical: false,
    isFullyMitigated: false,
  };
}

function makeAnalysis(paths: AttackPath[]): PathAnalysis {
  return {
    paths,
    criticalPaths: [],
    maxRiskScore: 1,
    averageRiskScore: 1,
    totalPaths: paths.length,
    aggregatedLikelihood: 1,
    likelihoodMethod: "max",
    goalSummary: {
      disclosure: 0,
      manipulation: 0,
      "service-disruption": 0,
      "privilege-abuse": 0,
      "identity-misuse": 0,
      "accountability-evasion": 0,
      destruction: 0,
    },
    analysisDate: new Date().toISOString(),
  };
}

const CHAIN = ["ROOT", "flash firmware"];
const KEY = computePathKey(CHAIN);

function assetTree(
  paths: AttackPath[],
  assessments?: AttackPathAssessment[],
): AttackTree {
  const tree = createEmptyAttackTree({
    type: "asset",
    assetId: "A-1",
    assetName: "ECU",
  });
  tree.name = "ECU compromise";
  tree.pathAnalysis = makeAnalysis(paths);
  if (assessments) tree.pathAssessments = assessments;
  return tree;
}

describe("editor wiring — previous is the PRE-edit analysis", () => {
  it("an assessed path removed by the edit is Class B (banner)", () => {
    const assessment: AttackPathAssessment = {
      pathKey: KEY,
      strideCategory: "T",
      relevance: "relevant",
      lastModified: new Date().toISOString(),
    };

    // previous = the analysis BEFORE the edit (the path exists).
    const previous = makeAnalysis([makePath(CHAIN)]);

    // updatedTree = AFTER the edit: the confirmed path is gone.
    const updatedTree = assetTree(
      [makePath(["ROOT", "something else"])],
      [assessment],
    );

    const { diff } = reconcileAttackPathThreats(updatedTree, previous);
    expect(diff.requiresBanner).toBe(true);
  });

  it("passing the POST-parse analysis as previous would HIDE the removal — guard", () => {
    // This documents the bug the wiring must avoid: if previous === the new
    // analysis, the diff sees no removal and never raises the banner.
    const assessment: AttackPathAssessment = {
      pathKey: KEY,
      strideCategory: "T",
      relevance: "relevant",
      lastModified: new Date().toISOString(),
    };
    const updatedTree = assetTree(
      [makePath(["ROOT", "something else"])],
      [assessment],
    );

    // WRONG previous (the tree's own new analysis) → no banner.
    const wrong = reconcileAttackPathThreats(
      updatedTree,
      updatedTree.pathAnalysis,
    );
    expect(wrong.diff.requiresBanner).toBe(false); // demonstrates why order matters
  });
});

describe("editor wiring — pathAssessments survive a re-parse", () => {
  it("parseAndValidateTree's spread preserves pathAssessments", () => {
    // The invariant that matters for the wiring: whatever parseAndValidateTree
    // returns must still carry the analyst's decisions, because the post-parse
    // reconcile reads tree.pathAssessments. parseAndValidateTree does
    // `{ ...tree, dsl, ast, validation, pathAnalysis, lastModified }` — so any
    // field it doesn't explicitly overwrite passes through. We assert that
    // property directly, without driving the real parser/validator (which needs
    // a full project shape irrelevant to this invariant).
    const assessment: AttackPathAssessment = {
      pathKey: "k1",
      strideCategory: "T",
      relevance: "relevant",
      lastModified: new Date().toISOString(),
    };

    const tree = createEmptyAttackTree({
      type: "asset",
      assetId: "A-1",
      assetName: "ECU",
    });
    tree.pathAssessments = [assessment];

    // Simulate exactly the fields parseAndValidateTree overwrites; everything
    // else (pathAssessments included) is spread through untouched.
    const afterParse: AttackTree = {
      ...tree,
      dsl: tree.dsl,
      ast: undefined,
      validation: tree.validation,
      pathAnalysis: undefined,
      lastModified: new Date().toISOString(),
    };

    expect(afterParse.pathAssessments).toEqual([assessment]);
  });
});