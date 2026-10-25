// tests/unit/features/dfd/asset-graph/layout-asset-graph.move.test.ts
//
// Asset graph design FR-V17 / FR-V17d (doc/InProgress/DFD/asset-graph-
// hazards-and-node-move.md): moveNode moves a vertical-lane node along its
// lane only; a side-column node moves freely in x and snaps in y to a row
// (the lane heights); the moved position stays put in the next layout
// (AR-12).

import { describe, it, expect } from "vitest";
import {
  LANE_HEIGHT,
  layoutAssetGraph,
  moveNode,
} from "features/dfd/asset-graph/layout-asset-graph";
import type { AssetGraphNode } from "features/dfd/asset-graph/asset-graph-types";

const node = (id: string, group: string): AssetGraphNode =>
  ({ kind: "asset", id, displayId: id, name: id, group }) as unknown as AssetGraphNode;

const graph = {
  nodes: [
    node("d1", "data"),
    node("d2", "data"),
    node("f1", "function"),
    node("s1", "system"),
    node("h1", "human"),
  ],
  edges: [],
};

describe("moveNode", () => {
  const layout = layoutAssetGraph(graph);
  const lane = (id: string) => layout.lanes.find((l) => l.id === id)!;
  const opts = (sideColumn: boolean) => ({ sideColumn, lanes: layout.lanes });

  it("a vertical-lane node moves along its lane only", () => {
    const moved = moveNode(layout.positions, "d1", 123.4, 300, opts(false));
    const before = layout.positions.get("d1")!;
    expect(moved.get("d1")).toEqual({ x: Math.round(before.x + 123.4), y: before.y });
    for (const id of ["d2", "f1", "s1", "h1"]) expect(moved.get(id)).toEqual(layout.positions.get(id));
  });

  it("a side-column node moves freely in x, into the vertical lanes too", () => {
    const before = layout.positions.get("h1")!;
    const moved = moveNode(layout.positions, "h1", -10000, 0, opts(true));
    expect(moved.get("h1")).toEqual({ x: before.x - 10000, y: before.y });
  });

  it("…and snaps in y to the nearest row, between the top and the bottom lane", () => {
    const before = layout.positions.get("h1")!;
    const toSystem = lane("system").y - before.y;
    expect(moveNode(layout.positions, "h1", 0, toSystem + LANE_HEIGHT * 0.3, opts(true)).get("h1")!.y).toBe(
      lane("system").y,
    );
    const top = Math.min(...layout.lanes.map((l) => l.y));
    const bottom = Math.max(...layout.lanes.map((l) => l.y));
    expect(moveNode(layout.positions, "h1", 0, -10000, opts(true)).get("h1")!.y).toBe(top);
    expect(moveNode(layout.positions, "h1", 0, 10000, opts(true)).get("h1")!.y).toBe(bottom);
  });

  it("an unknown node changes nothing", () => {
    const moved = moveNode(layout.positions, "nope", 50, 50, opts(false));
    expect([...moved]).toEqual([...layout.positions]);
  });

  it("the moved position is a known position of the next layout", () => {
    const moved = moveNode(layout.positions, "f1", 300, 0, opts(false));
    const again = layoutAssetGraph(graph, moved);
    expect(again.positions.get("f1")).toEqual(moved.get("f1"));
    expect(again.positions.get("d1")).toEqual(layout.positions.get("d1"));
  });

  it("a side-column node moved to another row stays there", () => {
    const moved = moveNode(layout.positions, "h1", -400, lane("system").y - layout.positions.get("h1")!.y, opts(true));
    const again = layoutAssetGraph(graph, moved);
    expect(again.positions.get("h1")).toEqual(moved.get("h1"));
  });
});

describe("layout rows (vertical lanes at one height)", () => {
  it("all nodes of a vertical lane share the lane's height", () => {
    const many = {
      nodes: Array.from({ length: 12 }, (_, i) => node(`d${i}`, "data")).concat([node("h1", "human"), node("h2", "human")]),
      edges: Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, kind: "a2a" as const, source: `d${i}`, target: "h1", relationType: "x" })),
    };
    const { positions, lanes } = layoutAssetGraph(many);
    const dataY = lanes.find((l) => l.id === "data")!.y;
    for (let i = 0; i < 12; i++) expect(positions.get(`d${i}`)!.y).toBe(dataY);
    const humanY = lanes.find((l) => l.id === "human")!.y;
    expect(positions.get("h1")!.y).toBe(humanY);
    expect(positions.get("h2")!.y).toBe(humanY);
  });

  it("a remembered position slightly off its lane snaps back onto it", () => {
    const first = layoutAssetGraph(graph);
    const p = first.positions.get("d1")!;
    const again = layoutAssetGraph(graph, new Map(first.positions).set("d1", { x: p.x, y: p.y + 20 }));
    expect(again.positions.get("d1")).toEqual(p);
  });

  it("vertical lanes stay left of the side column, even when linked to it", () => {
    const many = {
      nodes: Array.from({ length: 11 }, (_, i) => node(`d${i}`, "data")).concat([node("h1", "human")]),
      edges: Array.from({ length: 11 }, (_, i) => ({ id: `e${i}`, kind: "a2a" as const, source: `d${i}`, target: "h1", relationType: "x" })),
    };
    const { positions, lanes } = layoutAssetGraph(many);
    const column = lanes.find((l) => l.id === "human")!.x!;
    for (let i = 0; i < 11; i++) expect(positions.get(`d${i}`)!.x).toBeLessThan(column - 100);
  });
});
