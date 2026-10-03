// src/tests/unit/shared/models/asset-a2a-rules.test.ts
//
// A2A rule set in shared (asset-graph-view-requirements.md, AR-4).

import { describe, it, expect } from "vitest";
import {
  ALLOWED_A2A_RELATIONS,
  KERN_A2A_RELATIONS,
  getA2ARelationOptions,
  getAllowedA2ARelations,
  isKernA2ARelation,
} from "shared/models/asset-a2a-rules";
import type { AssetGroup } from "shared/models/asset-group-types";

const GROUPS: AssetGroup[] = [
  "data",
  "function",
  "system",
  "infrastructure",
  "process",
  "physical",
  "service",
  "human",
  "environment",
];

describe("A2A rules — matrix", () => {
  it("environment is a protection target only: no outgoing relations", () => {
    for (const target of GROUPS) {
      expect(getAllowedA2ARelations("environment", target)).toEqual([]);
    }
  });

  it("an undefined pair yields an empty list, not undefined", () => {
    expect(getAllowedA2ARelations("data", "infrastructure")).toEqual([]);
  });

  it("covers every source group", () => {
    expect(Object.keys(ALLOWED_A2A_RELATIONS).sort()).toEqual([...GROUPS].sort());
  });
});

describe("A2A rules — KERN", () => {
  it("every KERN relation is allowed by the matrix", () => {
    for (const source of GROUPS) {
      for (const target of GROUPS) {
        for (const type of KERN_A2A_RELATIONS[source]?.[target] ?? []) {
          expect(getAllowedA2ARelations(source, target)).toContain(type);
        }
      }
    }
  });

  it("matches the KERN overview of the relationship document", () => {
    expect(isKernA2ARelation("data", "process", "required_by")).toBe(true);
    expect(isKernA2ARelation("data", "function", "configures")).toBe(true);
    expect(isKernA2ARelation("process", "system", "runs_on")).toBe(true);
    expect(isKernA2ARelation("process", "function", "implements")).toBe(true);
    expect(isKernA2ARelation("system", "infrastructure", "hosted_on")).toBe(true);
    expect(isKernA2ARelation("process", "human", "affects_privacy")).toBe(true);
    // allowed, but not KERN
    expect(isKernA2ARelation("process", "function", "invokes")).toBe(false);
    expect(isKernA2ARelation("process", "human", "endangers")).toBe(false);
  });

  it("options list KERN first, then the rest in matrix order", () => {
    // matrix order: endangers, affects_privacy, operated_by
    expect(getA2ARelationOptions("process", "human")).toEqual([
      { relationType: "affects_privacy", kern: true },
      { relationType: "endangers", kern: false },
      { relationType: "operated_by", kern: false },
    ]);
  });

  it("options of an undefined pair are empty", () => {
    expect(getA2ARelationOptions("human", "data")).toEqual([]);
  });
});
