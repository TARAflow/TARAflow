// tests/unit/app/services/fix-tree-likelihood-scale.test.ts
//
// Conformance plan decision 21, migration 9 → 10: attack-tree likelihoods
// stored with the 5-level default {1, 2, 3, 5} are corrected for 3- and
// 4-level risk scales; 5-level projects stay unchanged; nothing but the
// tree likelihood and the values computed from it changes.

import { describe, it, expect } from "vitest";

import { fixTreeLikelihoodScale } from "app/services/versions/fix-tree-likelihood-scale";
import { migrate_9_to_10 } from "app/services/versions/migrate-9-to-10";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

const LEGACY = { "very-low": 1, low: 2, medium: 3, high: 5 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const risk = (treeValue: number, residual?: number): any => ({
  id: "R1",
  treatment: "reduce",
  moscowPriority: "should",
  treatmentJustification: "kept",
  factorRatings: [
    { factorId: "safety", value: 3, weight: 1 },
    { factorId: "attack_tree_likelihood", value: treeValue, weight: 1 },
  ],
  mitigatedFactorRatings:
    residual === undefined
      ? []
      : [
          { factorId: "safety", value: 3, weight: 1 },
          { factorId: "attack_tree_likelihood", value: residual, weight: 1 },
        ],
  calculatedImpact: 3,
  calculatedLikelihood: treeValue,
  calculatedRiskBeforeMitigation: 3 * treeValue,
  calculatedRiskAfterMitigation: residual === undefined ? 0 : 3 * residual,
  attackTreeAssessment: { treeId: "t", pathKey: "k", levelToRiskScale: LEGACY },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const project = (scale: string, risks: any[]): any => ({
  schemaVersion: 9,
  risks: {
    configuration: {
      ...DEFAULT_CONFIGURATION,
      scale,
      activeFactors: [
        { factorId: "safety", enabled: true, weight: 1 },
        { factorId: "attack_tree_likelihood", enabled: true, weight: 1 },
      ],
    },
    risks,
  },
});

const tree = (r: { factorRatings: { factorId: string; value: number }[] }) =>
  r.factorRatings.find((f) => f.factorId === "attack_tree_likelihood")!.value;

describe("fixTreeLikelihoodScale", () => {
  it("4-level: a high path (5) becomes 4, values recomputed, snapshot replaced", () => {
    const out = fixTreeLikelihoodScale(project("4-level", [risk(5)]));
    const r = out.risks.risks[0];
    expect(tree(r)).toBe(4);
    expect(r.calculatedLikelihood).toBeLessThanOrEqual(4);
    expect(r.calculatedRiskBeforeMitigation).toBeLessThanOrEqual(16);
    expect(r.attackTreeAssessment.levelToRiskScale).toEqual({
      "very-low": 1,
      low: 2,
      medium: 3,
      high: 4,
    });
    expect([r.treatment, r.moscowPriority, r.treatmentJustification]).toEqual([
      "reduce",
      "should",
      "kept",
    ]);
  });

  it("3-level: medium (3) → 2, low (2) → 1; residual too", () => {
    const out = fixTreeLikelihoodScale(project("3-level", [risk(3, 2)]));
    const r = out.risks.risks[0];
    expect(tree(r)).toBe(2);
    expect(
      r.mitigatedFactorRatings.find((f: { factorId: string }) => f.factorId === "attack_tree_likelihood").value,
    ).toBe(1);
  });

  it("5-level projects and risks without a tree are unchanged (same object)", () => {
    const five = project("5-level", [risk(5)]);
    expect(fixTreeLikelihoodScale(five)).toBe(five);
    const noTree = project("4-level", [{ ...risk(3), attackTreeAssessment: undefined }]);
    expect(fixTreeLikelihoodScale(noTree)).toBe(noTree);
  });

  it("migration 9 → 10 applies it and sets schema 10", () => {
    const out = migrate_9_to_10(project("4-level", [risk(5)]));
    expect(out.schemaVersion).toBe(10);
    expect(tree(out.risks.risks[0])).toBe(4);
  });
});
