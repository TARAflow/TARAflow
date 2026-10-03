// src/tests/unit/shared/models/asset-a2a-rules.test.ts
//
// A2A rule set in shared (asset-graph-view-requirements.md, AR-4).

import { describe, it, expect } from "vitest";
import {
  ALLOWED_A2A_RELATIONS,
  KERN_A2A_RELATIONS,
  classifyA2ATargetGroup,
  classifyA2ATargets,
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

describe("A2A rules — target classification (FR-E4/E5)", () => {
  it("valid when source → target is allowed", () => {
    const c = classifyA2ATargetGroup("process", "function");
    expect(c.targetClass).toBe("valid");
    expect(c.forward.map((o) => o.relationType)).toEqual(["implements", "invokes"]);
  });

  it("reverse_only when only target → source is allowed, with the reverse types", () => {
    // data → service: nothing; service → data: exposes, consumes
    const c = classifyA2ATargetGroup("data", "service");
    expect(c.targetClass).toBe("reverse_only");
    expect(c.forward).toEqual([]);
    expect(c.reverse.map((o) => o.relationType)).toEqual(["exposes", "consumes"]);
  });

  it("invalid when no direction is allowed", () => {
    expect(classifyA2ATargetGroup("data", "infrastructure").targetClass).toBe(
      "invalid",
    );
  });

  it("is consistent with the matrix for every group pair", () => {
    for (const s of GROUPS) {
      for (const t of GROUPS) {
        const c = classifyA2ATargetGroup(s, t);
        const fwd = getAllowedA2ARelations(s, t).length > 0;
        const rev = getAllowedA2ARelations(t, s).length > 0;
        expect(c.targetClass).toBe(fwd ? "valid" : rev ? "reverse_only" : "invalid");
      }
    }
  });

  it("classifies candidates by id and never offers the source itself", () => {
    const source = { id: "p1", assetGroup: "process" as const };
    const result = classifyA2ATargets(source, [
      source,
      { id: "f1", assetGroup: "function" },
      { id: "d1", assetGroup: "data" },
      { id: "e1", assetGroup: "environment" },
      { id: "p2", assetGroup: "process" },
    ]);
    expect(result.get("p1")!.targetClass).toBe("invalid");
    expect(result.get("f1")!.targetClass).toBe("valid");
    // process → data: nothing; data → process: required_by, …
    expect(result.get("d1")!.targetClass).toBe("reverse_only");
    expect(result.get("e1")!.targetClass).toBe("valid");
    expect(result.get("p2")!.targetClass).toBe("valid");
  });
});
