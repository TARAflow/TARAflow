// tests/unit/features/dfd/asset-graph/layout-asset-graph.move.test.ts
//
// Asset graph design FR-V17 / FR-V17d (doc/InProgress/DFD/asset-graph-
// hazards-and-node-move.md): moveNodeHorizontally changes only the node's x,
// keeps a side-column node out of the vertical lanes, and the moved position
// stays put in the next layout (AR-12).

import { describe, it, expect } from "vitest";
import {
  layoutAssetGraph,
  moveNodeHorizontally,
  NODE_SPACING,
} from "features/dfd/asset-graph/layout-asset-graph";
import type { AssetGraphNode } from "features/dfd/asset-graph/asset-graph-types";

const node = (id: string, group: string): AssetGraphNode =>
  ({ kind: "asset", id, displayId: id, name: id, group }) as unknown as AssetGraphNode;

const graph = {
  nodes: [node("d1", "data"), node("d2", "data"), node("f1", "function"), node("h1", "human")],
  edges: [],
};

describe("moveNodeHorizontally", () => {
  const layout = layoutAssetGraph(graph);

  it("changes only the node's x", () => {
    const moved = moveNodeHorizontally(layout.positions, "d1", 123.4, { sideColumn: false, lanes: layout.lanes });
    const before = layout.positions.get("d1")!;
    expect(moved.get("d1")).toEqual({ x: Math.round(before.x + 123.4), y: before.y });
    for (const id of ["d2", "f1", "h1"]) expect(moved.get(id)).toEqual(layout.positions.get(id));
  });

  it("a side-column node stops one spacing left of the column", () => {
    const column = Math.min(...layout.lanes.filter((l) => l.kind === "orthogonal").map((l) => l.x!));
    const moved = moveNodeHorizontally(layout.positions, "h1", -10000, { sideColumn: true, lanes: layout.lanes });
    expect(moved.get("h1")!.x).toBe(column - NODE_SPACING);
  });

  it("an unknown node changes nothing", () => {
    const moved = moveNodeHorizontally(layout.positions, "nope", 50, { sideColumn: false, lanes: layout.lanes });
    expect([...moved]).toEqual([...layout.positions]);
  });

  it("the moved position is a known position of the next layout", () => {
    const moved = moveNodeHorizontally(layout.positions, "f1", 300, { sideColumn: false, lanes: layout.lanes });
    const again = layoutAssetGraph(graph, moved);
    expect(again.positions.get("f1")).toEqual(moved.get("f1"));
    expect(again.positions.get("d1")).toEqual(layout.positions.get("d1"));
  });
});
