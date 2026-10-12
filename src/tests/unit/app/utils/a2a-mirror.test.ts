// src/tests/unit/app/utils/a2a-mirror.test.ts
//
// Bridge between the canonical A2A edge list and the dfd.assets mirror
// (schema v8).

import { describe, it, expect } from "vitest";
import { projectA2AOntoMirror } from "app/utils/a2a-mirror";
import type { A2ARelation } from "shared";

const groups: Record<string, string> = { d: "data", f: "function", p: "process" };
const groupOf = (id: string) => groups[id] as any;

const mirror = (id: string, group: string, assetRelations?: unknown[]): any => ({
  id,
  displayId: id,
  name: id,
  assetGroup: group,
  ...(assetRelations !== undefined ? { assetRelations } : {}),
});

const edge = (id: string, s: string, t: string, type: string, extra = {}): A2ARelation =>
  ({ id, sourceAssetId: s, targetAssetId: t, relationType: type, ...extra }) as A2ARelation;

describe("projectA2AOntoMirror", () => {
  it("writes outgoing edges with computed groups and ids; leaves edge-less assets untouched", () => {
    const out = projectA2AOntoMirror(
      [mirror("d", "data"), mirror("f", "function")],
      [edge("r1", "d", "f", "required_by", { rationale: "x" })],
      groupOf,
    );
    expect((out[0] as any).assetRelations).toEqual([
      {
        id: "r1",
        sourceGroup: "data",
        targetGroup: "function",
        targetAssetId: "f",
        relationType: "required_by",
        rationale: "x",
      },
    ]);
    expect((out[1] as any).assetRelations).toBeUndefined();
  });

  it("returns the same array when the mirror already matches", () => {
    const first = projectA2AOntoMirror(
      [mirror("d", "data")],
      [edge("r1", "d", "f", "required_by")],
      groupOf,
    );
    expect(
      projectA2AOntoMirror(first, [edge("r1", "d", "f", "required_by")], groupOf),
    ).toBe(first);
  });
});

describe("projectA2AOntoMirror — removal", () => {
  it("clears a list whose edges are gone", () => {
    const out = projectA2AOntoMirror(
      [mirror("d", "data", [{ id: "r1", targetAssetId: "f", relationType: "required_by" }])],
      [],
      groupOf,
    );
    expect((out[0] as any).assetRelations).toEqual([]);
  });
});
