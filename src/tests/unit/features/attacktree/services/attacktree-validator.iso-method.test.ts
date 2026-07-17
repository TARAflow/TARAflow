// src/tests/unit/features/attacktree/services/attacktree-validator.iso-method.test.ts
//
// 5b-1a — ISO mode enforces an implemented RC-15-11 feasibility method, and
// that every leaf is rated with it. Semantics, not arithmetic.

import { describe, it, expect } from "vitest";
import {
  validateISOFeasibilityMethod,
  validateAttackTree,
} from "features/attacktree/services/attacktree-validator";
import type {
  AttackTreeNode,
  AttackTreeProjectData,
} from "features/attacktree/models/attacktree-types";
import {
  DEFAULT_FEASIBILITY_CONFIGURATION,
  type FeasibilityConfiguration,
} from "features/attacktree/models/attacktree-feasibility-types";

// ── fixtures ────────────────────────────────────────────────────────────────

let idc = 0;
function leaf(
  name: string,
  evaluation: NonNullable<AttackTreeNode["evaluation"]>,
): AttackTreeNode {
  return {
    id: `n${idc++}`, name, type: "LEAF" as AttackTreeNode["type"],
    level: 1, lineNumber: 1, children: [], mitigations: [], evaluation,
  };
}
function root(children: AttackTreeNode[]): AttackTreeNode {
  return {
    id: "root", name: "ROOT", type: "ROOT" as AttackTreeNode["type"],
    level: 0, lineNumber: 0, children, mitigations: [],
  };
}

const AP = { attackPotential: {
  elapsedTime: "le-1-week", specialistExpertise: "expert",
  knowledgeOfItem: "restricted", windowOfOpportunity: "easy", equipment: "standard",
} } as NonNullable<AttackTreeNode["evaluation"]>;
const SIMPLE = { simple: { probability: 0.6, impact: 3 } } as NonNullable<AttackTreeNode["evaluation"]>;
const EXTENDED = { extended: { feasibility: 0.6, benefits: 0.8, impact: 4 } } as NonNullable<AttackTreeNode["evaluation"]>;

const ISO = (over: Partial<FeasibilityConfiguration> = {}): FeasibilityConfiguration => ({
  ...DEFAULT_FEASIBILITY_CONFIGURATION,
  likelihoodModel: "feasibility-only",
  method: "attack-potential",
  ...over,
});
const STANDARD: FeasibilityConfiguration = {
  ...DEFAULT_FEASIBILITY_CONFIGURATION,
  likelihoodModel: "feasibility-x-motivation",
};

const project = {
  id: "p", name: "p", phaseStatus: {}, isHighImpact: false,
  attackTrees: null, assets: [], threats: [], risks: [],
  dfdElements: [], mitigations: [], lastModified: "",
} as unknown as AttackTreeProjectData;

// ── validateISOFeasibilityMethod ────────────────────────────────────────────

describe("validateISOFeasibilityMethod", () => {
  it("Standard mode is a no-op — every format allowed", () => {
    const ast = root([leaf("a", SIMPLE), leaf("b", EXTENDED), leaf("c", AP)]);
    expect(validateISOFeasibilityMethod(ast, STANDARD)).toHaveLength(0);
  });

  it("ISO + attack-potential: an attack-potential leaf passes", () => {
    const ast = root([leaf("extract", AP)]);
    expect(validateISOFeasibilityMethod(ast, ISO())).toHaveLength(0);
  });

  it("ISO rejects p,i as an error (not an RC-15-11 method)", () => {
    const ast = root([leaf("a", SIMPLE)]);
    const errs = validateISOFeasibilityMethod(ast, ISO());
    expect(errs.filter((e) => e.severity === "error")).toHaveLength(1);
    expect(errs[0].messageKey).toBe("tabs.attacktree.validation.iso.probabilityLeaf");
  });

  it("ISO rejects f,b,i as an error", () => {
    const ast = root([leaf("a", EXTENDED)]);
    const errs = validateISOFeasibilityMethod(ast, ISO());
    expect(errs.filter((e) => e.severity === "error")).toHaveLength(1);
    expect(errs[0].messageKey).toBe("tabs.attacktree.validation.iso.extendedLeaf");
  });

  it("ISO with a not-yet-implemented method (cvss) is a config error", () => {
    const ast = root([leaf("extract", AP)]);
    const errs = validateISOFeasibilityMethod(ast, ISO({ method: "cvss" }));
    // Class-1 config error present.
    expect(errs.some((e) => e.messageKey === "tabs.attacktree.validation.iso.methodNotImplemented")).toBe(true);
  });

  it("ISO with quick method is rejected (not audit-grade)", () => {
    const ast = root([leaf("extract", AP)]);
    const errs = validateISOFeasibilityMethod(ast, ISO({ method: "quick" }));
    expect(errs.some((e) => e.messageKey === "tabs.attacktree.validation.iso.methodQuick")).toBe(true);
  });

  it("ISO: a mix of a valid AP leaf and a non-audit-grade leaf flags only the bad one", () => {
    // Only one implemented audit-grade method exists today (attack-potential),
    // so "rated with the wrong implemented method" is not yet constructible.
    // What IS constructible: an AP leaf (fine) beside a simple leaf (never valid
    // in ISO). Exactly one error.
    const ast = root([leaf("a", AP), leaf("b", SIMPLE)]);
    const errs = validateISOFeasibilityMethod(ast, ISO());
    expect(errs.filter((e) => e.severity === "error")).toHaveLength(1);
  });

  it("benefit on an attack-potential leaf is info, not error", () => {
    const ast = root([leaf("extract", { ...AP, benefit: "high" })]);
    const errs = validateISOFeasibilityMethod(ast, ISO());
    expect(errs.filter((e) => e.severity === "error")).toHaveLength(0);
    expect(errs.filter((e) => e.severity === "info")).toHaveLength(1);
  });

  it("flags every offending leaf, not just the first", () => {
    const ast = root([leaf("a", SIMPLE), leaf("b", EXTENDED), leaf("c", AP)]);
    const errs = validateISOFeasibilityMethod(ast, ISO());
    expect(errs.filter((e) => e.severity === "error")).toHaveLength(2);
  });
});

// ── through validateAttackTree ──────────────────────────────────────────────

describe("validateAttackTree honours the feasibility config", () => {
  it("no config → Standard, a p,i tree has no ISO error", () => {
    const ast = root([leaf("a", SIMPLE)]);
    const res = validateAttackTree(ast, project, [], undefined);
    expect(res.errors.some((e) => e.messageKey.startsWith("tabs.attacktree.validation.iso."))).toBe(false);
  });

  it("ISO config makes a p,i tree invalid", () => {
    const ast = root([leaf("a", SIMPLE)]);
    const res = validateAttackTree(ast, project, [], undefined, ISO());
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.messageKey.startsWith("tabs.attacktree.validation.iso."))).toBe(true);
  });

  it("per-leaf impact: info in Standard, error in ISO", () => {
    const ast = root([leaf("a", SIMPLE)]); // simple carries impact:3
    const std = validateAttackTree(ast, project, [], undefined, STANDARD);
    expect(std.infos.some((e) => e.messageKey.startsWith("tabs.attacktree.validation.impact."))).toBe(true);
    expect(std.errors.some((e) => e.messageKey.startsWith("tabs.attacktree.validation.impact."))).toBe(false);

    const iso = validateAttackTree(ast, project, [], undefined, ISO());
    expect(iso.errors.some((e) => e.messageKey.startsWith("tabs.attacktree.validation.impact."))).toBe(true);
  });

  it("ISO + clean attack-potential tree has no 5b-1a errors", () => {
    const ast = root([leaf("extract", AP)]);
    const res = validateAttackTree(ast, project, [], undefined, ISO());
    expect(res.errors.some((e) => e.messageKey.startsWith("tabs.attacktree.validation.iso."))).toBe(false);
    expect(res.errors.some((e) => e.messageKey.startsWith("tabs.attacktree.validation.impact."))).toBe(false);
  });
});