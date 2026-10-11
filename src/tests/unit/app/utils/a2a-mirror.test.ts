// src/tests/unit/app/utils/a2a-mirror.test.ts
//
// Bridge between the canonical A2A edge list and the dfd.assets mirror
// (schema v8).

import { describe, it, expect } from "vitest";
import { liftA2AFromMirror, projectA2AOntoMirror } from "app/utils/a2a-mirror";
import type { A2ARelation } from "shared";

const groups: Record<string, string> = { d: "data", f: "function", p: "process" };
const groupOf = (id: string) => groups[id] as any;

function ids() {
  let n = 0;
  return () => `new-${++n}`;
}

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
  it("writes outgoing edges with computed groups and ids, empty list otherwise", () => {
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
    expect((out[1] as any).assetRelations).toEqual([]);
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

describe("liftA2AFromMirror", () => {
  it("adds a new entry with a new id and keeps ids of known edges", () => {
    const out = liftA2AFromMirror(
      [edge("r1", "d", "f", "required_by")],
      [
        mirror("d", "data", [
          { id: "r1", targetAssetId: "f", relationType: "required_by" },
          { targetAssetId: "f", relationType: "configures" },
        ]),
      ],
      ids(),
    );
    expect(out!.map((r) => [r.id, r.relationType])).toEqual([
      ["new-1", "configures"],
      ["r1", "required_by"],
    ]);
  });

  it("matches an entry without id by source, target and type", () => {
    const out = liftA2AFromMirror(
      [edge("r1", "d", "f", "required_by")],
      [mirror("d", "data", [{ targetAssetId: "f", relationType: "required_by", rationale: "y" }])],
      ids(),
    );
    expect(out).toEqual([edge("r1", "d", "f", "required_by", { rationale: "y" })]);
  });

  it("returns null when nothing changes", () => {
    expect(
      liftA2AFromMirror(
        [edge("r1", "d", "f", "required_by")],
        [mirror("d", "data", [{ id: "r1", targetAssetId: "f", relationType: "required_by" }])],
        ids(),
      ),
    ).toBeNull();
  });

  it("leaves sources alone that are off the mirror or lack the field (B1 guard)", () => {
    const relations = [
      edge("r1", "d", "f", "required_by"),
      edge("r2", "p", "f", "implements"),
    ];
    expect(liftA2AFromMirror(relations, [mirror("d", "data")], ids())).toBeNull();
  });

  it("an empty list on the mirror removes that source's edges only", () => {
    const out = liftA2AFromMirror(
      [edge("r1", "d", "f", "required_by"), edge("r2", "p", "f", "implements")],
      [mirror("d", "data", [])],
      ids(),
    );
    expect(out!.map((r) => r.id)).toEqual(["r2"]);
  });

  it("merges exact duplicates on the mirror", () => {
    const out = liftA2AFromMirror(
      [],
      [
        mirror("d", "data", [
          { targetAssetId: "f", relationType: "required_by" },
          { targetAssetId: "f", relationType: "required_by" },
        ]),
      ],
      ids(),
    );
    expect(out).toHaveLength(1);
  });
});
