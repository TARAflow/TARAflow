// src/tests/unit/features/risks/services/concept-relink.test.ts
//
// FX-5: a renamed attack-tree node gives its path a new key, so the risk
// gets a new id and goals / claims keep the old one. Proposed for re-linking:
// risks of the same tree and STRIDE category the item is not linked to yet,
// uncovered paths first; the swap replaces the dead link or drops it.

import { describe, expect, it } from "vitest";
import { relinkCandidates, relinkConceptItem } from "features/risks/services/concept-relink";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { CybersecurityConcept } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// Ids as the sync builds them: R-AT-<treeId>-<pathKey>-<STRIDE>.
const pathRisk = (treeId: string, pathKey: string, stride: string, label: string): Risk =>
  ({
    id: `R-AT-${treeId}-${pathKey}-${stride}`,
    threatDisplayId: label,
    strideCategory: stride,
    attackTreeAssessment: { treeId, pathKey, likelihoodComponent: 0, strideCategory: stride },
  }) as unknown as Risk;

const TREE = "4f1c-aa";
const RISKS = [
  pathRisk(TREE, "a1b2c3d4e5f6", "T", "AT-1.2"), // renamed path, new key
  pathRisk(TREE, "0f0f0f0f0f0f", "T", "AT-1.1"), // other path, covered by CSG-02
  pathRisk(TREE, "a1b2c3d4e5f6", "I", "AT-1.2"), // same path, other STRIDE
  pathRisk("other-tree", "a1b2c3d4e5f6", "T", "AT-2.1"), // other tree
  { id: "R-9d2e-uuid", threatDisplayId: "P1-T-1", strideCategory: "T" } as unknown as Risk, // DFD threat
];
const DEAD = `R-AT-${TREE}-ffffffffffff-T`;

const concept = (): CybersecurityConcept =>
  ({
    goals: [
      { id: "g1", displayId: "CSG-01", statement: "x", riskIds: [DEAD], assetProperties: [] },
      { id: "g2", displayId: "CSG-02", statement: "y", riskIds: [RISKS[1].id], assetProperties: [] },
    ],
    claims: [{ id: "c1", displayId: "CLM-01", statement: "z", kind: "retain", riskIds: [DEAD], assumptionIds: [] }],
    verifications: [],
  }) as Any;

describe("concept relink (FX-5)", () => {
  it("proposes the paths of the same tree and STRIDE category, uncovered ones first", () => {
    const c = concept();
    expect(relinkCandidates(DEAD, c.goals[0], "goal", RISKS, c).map((r) => r.threatDisplayId)).toEqual([
      "AT-1.2",
      "AT-1.1",
    ]);
  });

  it("no proposal for a dead link that was not an attack-path risk", () => {
    const c = concept();
    expect(relinkCandidates("R-gone-uuid", c.goals[0], "goal", RISKS, c)).toEqual([]);
  });

  it("does not propose a risk the item is linked to already", () => {
    const c = concept();
    const goal = { ...c.goals[0], riskIds: [DEAD, RISKS[0].id] };
    expect(relinkCandidates(DEAD, goal, "goal", RISKS, c).map((r) => r.threatDisplayId)).toEqual(["AT-1.1"]);
  });

  it("relink replaces the dead link; null drops it — goals and claims", () => {
    const c = concept();
    const goals = relinkConceptItem(c, "goal", "g1", DEAD, RISKS[0].id).goals;
    expect(goals[0].riskIds).toEqual([RISKS[0].id]);
    expect(goals[1]).toBe(c.goals[1]);
    expect(relinkConceptItem(c, "claim", "c1", DEAD, null).claims[0].riskIds).toEqual([]);
  });
});
