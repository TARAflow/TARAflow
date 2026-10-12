// tests/unit/features/dfd/asset-graph/asset-graph-history.test.ts
//
// FR-E9: undo/redo of link changes — steps name links by key, not by id,
// so a re-created link (new id) is still found by redo.

import { describe, it, expect } from "vitest";
import {
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  entryForAdd,
  entryForRemove,
  entryForUpdate,
  popRedo,
  popUndo,
  pushEntry,
  resolveSteps,
} from "features/dfd/asset-graph/asset-graph-history";
import { applyA2AOps, type A2ARelation, type AssetGroup } from "shared";

const groups = new Map<string, AssetGroup>([["d", "data"], ["f", "function"]]);
let n = 0;
const apply = (rels: A2ARelation[], ops: Parameters<typeof applyA2AOps>[1]) =>
  applyA2AOps(rels, ops, (id) => groups.get(id), () => `id${++n}`).relations;

describe("asset graph history", () => {
  it("add → undo removes it → redo creates it again", () => {
    let rels: A2ARelation[] = [];
    const entry = entryForAdd({ sourceAssetId: "d", targetAssetId: "f", relationType: "required_by" } as never);
    rels = apply(rels, resolveSteps(entry.redo, rels).ops);
    expect(rels).toHaveLength(1);
    rels = apply(rels, resolveSteps(entry.undo, rels).ops);
    expect(rels).toEqual([]);
    rels = apply(rels, resolveSteps(entry.redo, rels).ops);
    expect(rels).toHaveLength(1);
  });

  it("remove → undo re-creates it with its attributes; redo finds the NEW id", () => {
    let rels = apply([], [
      { kind: "add", relation: { sourceAssetId: "d", targetAssetId: "f", relationType: "configures", stepOrder: 2, rationale: "r" } as never },
    ]);
    const entry = entryForRemove(rels[0]);
    rels = apply(rels, resolveSteps(entry.redo, rels).ops);
    expect(rels).toEqual([]);
    rels = apply(rels, resolveSteps(entry.undo, rels).ops);
    expect(rels[0]).toMatchObject({ relationType: "configures", stepOrder: 2, rationale: "r" });
    const newId = rels[0].id;
    const redo = resolveSteps(entry.redo, rels);
    expect(redo.ops).toEqual([{ kind: "remove", relationId: newId }]);
  });

  it("update → undo restores old values, absent ones become undefined", () => {
    const rels = apply([], [
      { kind: "add", relation: { sourceAssetId: "d", targetAssetId: "f", relationType: "required_by", rationale: "old" } as never },
    ]);
    const entry = entryForUpdate(rels[0], { rationale: "new", notes: "n" });
    expect(resolveSteps(entry.undo, rels).ops).toEqual([
      { kind: "update", relationId: rels[0].id, attributes: { rationale: "old", notes: undefined } },
    ]);
  });

  it("a step whose link is gone is skipped and reported", () => {
    const entry = entryForRemove({ id: "x", sourceAssetId: "d", targetAssetId: "f", relationType: "required_by" } as A2ARelation);
    expect(resolveSteps(entry.redo, [])).toEqual({ ops: [], complete: false });
  });

  it("stack: a new change drops the redo branch; the past is limited", () => {
    const e = entryForAdd({ sourceAssetId: "d", targetAssetId: "f", relationType: "required_by" } as never);
    let h = pushEntry(EMPTY_HISTORY, e);
    const u = popUndo(h);
    expect(u.entry).toBe(e);
    h = u.next;
    expect(h.future).toHaveLength(1);
    h = pushEntry(h, e);
    expect(h.future).toEqual([]);
    expect(popRedo(h).entry).toBeUndefined();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = pushEntry(h, e);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
