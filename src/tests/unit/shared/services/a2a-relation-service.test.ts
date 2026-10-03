// src/tests/unit/shared/services/a2a-relation-service.test.ts
//
// Relations service (asset-graph-view-requirements.md, AR-5; D1 = edge list).

import { describe, it, expect } from "vitest";
import {
  addA2ARelation,
  changeA2ARelationType,
  removeA2ARelation,
  removeA2ARelationsOfAsset,
  relationsOfAsset,
  sortA2ARelations,
  updateA2ARelationAttributes,
  validateA2ARelations,
  type AssetGroupLookup,
} from "shared/services/a2a-relation-service";
import type { A2ARelation } from "shared/models/a2a-relation-types";
import type { AssetGroup } from "shared/models/asset-group-types";

function lookup(groups: Record<string, AssetGroup>): AssetGroupLookup {
  return (id) => groups[id];
}

const GROUPS = lookup({
  d1: "data",
  f1: "function",
  p1: "process",
  s1: "system",
  i1: "infrastructure",
});

function ids(prefix = "r"): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

function rel(
  id: string,
  sourceAssetId: string,
  targetAssetId: string,
  relationType: A2ARelation["relationType"],
): A2ARelation {
  return { id, sourceAssetId, targetAssetId, relationType };
}

describe("addA2ARelation", () => {
  it("adds an allowed relation with a new id", () => {
    const res = addA2ARelation(
      [],
      { sourceAssetId: "d1", targetAssetId: "p1", relationType: "required_by" },
      GROUPS,
      ids(),
    );
    expect(res).toEqual({
      ok: true,
      relations: [rel("r1", "d1", "p1", "required_by")],
    });
  });

  it("keeps attributes", () => {
    const withAttr = addA2ARelation(
      [],
      {
        sourceAssetId: "p1",
        targetAssetId: "s1",
        relationType: "depends_on",
        degradationMode: true,
        rationale: "fallback",
      },
      GROUPS,
      ids(),
    );
    expect(withAttr.ok && withAttr.relations[0]).toMatchObject({
      degradationMode: true,
      rationale: "fallback",
    });
  });

  it.each([
    ["source_missing", "x", "p1", "required_by"],
    ["target_missing", "d1", "x", "required_by"],
    ["self_relation", "d1", "d1", "derives_from"],
    ["type_not_allowed", "d1", "p1", "hosted_on"],
  ] as const)("rejects %s", (reason, s, t, type) => {
    expect(
      addA2ARelation(
        [],
        { sourceAssetId: s, targetAssetId: t, relationType: type },
        GROUPS,
        ids(),
      ),
    ).toEqual({ ok: false, reason });
  });

  it("rejects an exact duplicate but allows another type on the same pair", () => {
    const existing = [rel("r1", "d1", "f1", "required_by")];
    expect(
      addA2ARelation(
        existing,
        { sourceAssetId: "d1", targetAssetId: "f1", relationType: "required_by" },
        GROUPS,
        ids("n"),
      ),
    ).toEqual({ ok: false, reason: "duplicate" });
    const other = addA2ARelation(
      existing,
      { sourceAssetId: "d1", targetAssetId: "f1", relationType: "configures" },
      GROUPS,
      ids("n"),
    );
    expect(other.ok && other.relations).toHaveLength(2);
  });

  it("does not mutate the input list", () => {
    const existing: A2ARelation[] = [];
    addA2ARelation(
      existing,
      { sourceAssetId: "d1", targetAssetId: "p1", relationType: "required_by" },
      GROUPS,
      ids(),
    );
    expect(existing).toEqual([]);
  });
});

describe("remove / update / change type", () => {
  const base = [
    rel("r1", "d1", "f1", "required_by"),
    rel("r2", "p1", "s1", "runs_on"),
  ];

  it("removes by id and reports a missing id", () => {
    expect(removeA2ARelation(base, "r1")).toEqual({
      ok: true,
      relations: [base[1]],
    });
    expect(removeA2ARelation(base, "nope")).toEqual({
      ok: false,
      reason: "relation_missing",
    });
  });

  it("updates attributes and keeps identity", () => {
    const res = updateA2ARelationAttributes(base, "r2", { notes: "n" });
    expect(res.ok && res.relations[1]).toEqual({ ...base[1], notes: "n" });
  });

  it("changes the type, keeps the id, and validates against the rules", () => {
    const ok = changeA2ARelationType(base, "r1", "configures", GROUPS);
    expect(ok.ok && ok.relations.find((r) => r.id === "r1")!.relationType).toBe(
      "configures",
    );
    expect(changeA2ARelationType(base, "r1", "hosted_on", GROUPS)).toEqual({
      ok: false,
      reason: "type_not_allowed",
    });
  });

  it("rejects a type change that would create a duplicate", () => {
    const two = [
      rel("r1", "d1", "f1", "required_by"),
      rel("r2", "d1", "f1", "configures"),
    ];
    expect(changeA2ARelationType(two, "r2", "required_by", GROUPS)).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });
});

describe("cascade (asset delete, AR-5/AR-8)", () => {
  const base = [
    rel("r1", "d1", "p1", "required_by"),
    rel("r2", "p1", "s1", "runs_on"),
    rel("r3", "s1", "i1", "hosted_on"),
  ];

  it("lists in- and outgoing relations of an asset", () => {
    const { incoming, outgoing } = relationsOfAsset(base, "p1");
    expect(incoming.map((r) => r.id)).toEqual(["r1"]);
    expect(outgoing.map((r) => r.id)).toEqual(["r2"]);
  });

  it("removes every relation touching the asset in one step", () => {
    const res = removeA2ARelationsOfAsset(base, "p1");
    expect(res.relations.map((r) => r.id)).toEqual(["r3"]);
    expect(res.removed.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("validateA2ARelations (B5, load)", () => {
  it("reports relations broken by a group change, in both directions", () => {
    const relations = [
      rel("r1", "d1", "p1", "required_by"), // p1 incoming
      rel("r2", "p1", "s1", "runs_on"), // p1 outgoing
    ];
    // p1 was changed from process to human
    const findings = validateA2ARelations(
      relations,
      lookup({ d1: "data", p1: "human", s1: "system" }),
    );
    expect(findings).toEqual([
      { relationId: "r1", reason: "type_not_allowed" },
      { relationId: "r2", reason: "type_not_allowed" },
    ]);
  });

  it("reports dangling endpoints and accepts a valid list", () => {
    expect(
      validateA2ARelations([rel("r1", "d1", "gone", "required_by")], GROUPS),
    ).toEqual([{ relationId: "r1", reason: "target_missing" }]);
    expect(
      validateA2ARelations([rel("r1", "d1", "p1", "required_by")], GROUPS),
    ).toEqual([]);
  });
});

describe("sortA2ARelations (AR-9)", () => {
  it("orders by source, target, type, id regardless of input order", () => {
    const a = rel("r2", "a", "b", "depends_on");
    const b = rel("r1", "a", "b", "depends_on");
    const c = rel("r9", "a", "a2", "calls");
    const d = rel("r0", "0", "z", "calls");
    expect(sortA2ARelations([a, b, c, d])).toEqual([d, c, b, a]);
    expect(sortA2ARelations([d, a, c, b])).toEqual([d, c, b, a]);
  });
});
