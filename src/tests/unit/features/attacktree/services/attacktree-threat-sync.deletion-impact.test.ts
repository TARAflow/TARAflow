// Insert this describe block into the existing attacktree-threat-sync.test.ts
// (import computeDeletionImpact alongside the other named imports from the
// module, and RiskReference from "../models/attacktree-types" if not already
// imported). Kept standalone here because I don't have your existing test
// file's fixtures/imports to merge into directly.

import { describe, it, expect } from "vitest";
import type { AttackTree, RiskReference } from "features/attacktree/models/attacktree-types";
import { computeDeletionImpact } from "features/attacktree/services/attacktree-threat-sync";
import { buildThreatId } from "features/attacktree/services/attacktree-threat-generator";

function makeTree(overrides: Partial<AttackTree> = {}): AttackTree {
  return {
    id: "tree-1",
    name: "Integrity Violation",
    anchor: {
      type: "asset",
      assetId: "A-1",
      assetName: "Config Data",
      securityGoal: "I",
    },
    dsl: "",
    configuration: { evaluationMethod: "simple" },
    validation: { isValid: true, errors: [], warnings: [] },
    created: "2026-01-01T00:00:00.000Z",
    lastModified: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as AttackTree;
}
 
function makeRisk(overrides: Partial<RiskReference> = {}): RiskReference {
  return {
    id: "R-1",
    threatId: "AT-tree-1-somepathkey-T",
    calculatedRiskBeforeMitigation: 0,
    moscowPriority: "should",
    ...overrides,
  };
}
 
describe("computeDeletionImpact", () => {
  it("returns {0, 0} for a tree with no assessments", () => {
    const tree = makeTree({ pathAssessments: [] });
    const impact = computeDeletionImpact(tree, []);
    expect(impact).toEqual({ assessedPathCount: 0, riskCount: 0 });
  });
 
  it("counts assessed paths even when no matching risk exists yet (register not synced)", () => {
    const tree = makeTree({
      pathAssessments: [
        {
          pathKey: "pk-1",
          strideCategory: "T",
          relevance: "relevant",
          lastModified: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const impact = computeDeletionImpact(tree, []);
    expect(impact).toEqual({ assessedPathCount: 1, riskCount: 0 });
  });
 
  it("counts a risk whose threatId matches an assessed path's derived id", () => {
    const tree = makeTree({
      pathAssessments: [
        {
          pathKey: "pk-1",
          strideCategory: "T",
          relevance: "relevant",
          lastModified: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const threatId = buildThreatId(tree.id, "pk-1", "T");
    const risk = makeRisk({ threatId });
 
    const impact = computeDeletionImpact(tree, [risk]);
    expect(impact).toEqual({ assessedPathCount: 1, riskCount: 1 });
  });
 
  it("does not count an unrated path as assessed, even if a risk happens to reference its id", () => {
    const tree = makeTree({
      pathAssessments: [
        {
          pathKey: "pk-1",
          strideCategory: "T",
          relevance: "unrated",
          lastModified: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const threatId = buildThreatId(tree.id, "pk-1", "T");
    const risk = makeRisk({ threatId });
 
    const impact = computeDeletionImpact(tree, [risk]);
    expect(impact).toEqual({ assessedPathCount: 0, riskCount: 0 });
  });
 
  it("does NOT count a risk on a threat-anchored tree's own threatId — that risk survives deletion", () => {
    const tree = makeTree({
      anchor: { type: "threat", threatId: "T-999", strideCategory: "T" },
      pathAssessments: [], // threat-anchored trees don't carry per-path assessments today
    });
    const risk = makeRisk({ threatId: "T-999" });
 
    const impact = computeDeletionImpact(tree, [risk]);
    expect(impact).toEqual({ assessedPathCount: 0, riskCount: 0 });
  });
 
  it("counts two assessed paths and matches only the risks that exist", () => {
    const tree = makeTree({
      pathAssessments: [
        {
          pathKey: "pk-1",
          strideCategory: "T",
          relevance: "relevant",
          lastModified: "2026-01-01T00:00:00.000Z",
        },
        {
          pathKey: "pk-2",
          strideCategory: "D",
          relevance: "uncertain",
          lastModified: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const risk1 = makeRisk({ threatId: buildThreatId(tree.id, "pk-1", "T") });
    // pk-2's risk was never synced — only one of the two exists in the register.
 
    const impact = computeDeletionImpact(tree, [risk1]);
    expect(impact).toEqual({ assessedPathCount: 2, riskCount: 1 });
  });
});
 