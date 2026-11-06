// tests/unit/features/dfd/asset-graph/layout-asset-graph.move.test.ts
//
// Asset graph design FR-V17 / FR-V17d (doc/InProgress/DFD/asset-graph-
// hazards-and-node-move.md): moveNode keeps a vertical-lane node in its lane
// and snaps it onto one of the lane's three rows (user 2026-11-06); a
// side-column node moves freely in x and snaps in y to the row grid (lanes
// and the two free rows above the top lane, three rows each, FR-V17g); the
// moved position stays put in the next layout (AR-12). A full layout spreads
// a crowded lane over its rows by the nodes' links.

import { describe, it, expect } from "vitest";
import {
  FREE_LANE,
  FREE_LANE_2,
  LANE_HEIGHT,
  ROW_HEIGHT,
  SPREAD_FROM,
  laneRows,
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

  it("a vertical-lane node starts on the middle row and moves onto the lane's rows only", () => {
    const before = layout.positions.get("d1")!;
    expect(before.y).toBe(lane("data").y);
    const down = moveNode(layout.positions, "d1", 123.4, ROW_HEIGHT * 0.8, opts(false));
    expect(down.get("d1")).toEqual({ x: Math.round(before.x + 123.4), y: lane("data").y + ROW_HEIGHT });
    // Far up: the lane's top row, never the lane above.
    expect(moveNode(layout.positions, "d1", 0, -10000, opts(false)).get("d1")!.y).toBe(lane("data").y - ROW_HEIGHT);
    for (const id of ["d2", "f1", "s1", "h1"]) expect(down.get(id)).toEqual(layout.positions.get(id));
  });

  it("a node moved onto another row of its lane keeps it in the next layout", () => {
    const moved = moveNode(layout.positions, "d1", 0, -ROW_HEIGHT, opts(false));
    expect(layoutAssetGraph(graph, moved).positions.get("d1")).toEqual(moved.get("d1"));
  });

  it("a side-column node moves freely in x, into the vertical lanes too", () => {
    const before = layout.positions.get("h1")!;
    const moved = moveNode(layout.positions, "h1", -10000, 0, opts(true));
    expect(moved.get("h1")).toEqual({ x: before.x - 10000, y: before.y });
  });

  it("…and snaps in y to the nearest row, between the top and the bottom lane", () => {
    const before = layout.positions.get("h1")!;
    const toSystem = lane("system").y - before.y;
    expect(moveNode(layout.positions, "h1", 0, toSystem + ROW_HEIGHT * 0.3, opts(true)).get("h1")!.y).toBe(
      lane("system").y,
    );
    expect(moveNode(layout.positions, "h1", 0, toSystem + ROW_HEIGHT * 0.8, opts(true)).get("h1")!.y).toBe(
      lane("system").y + ROW_HEIGHT,
    );
    const rows = layout.lanes.flatMap(laneRows);
    const top = Math.min(...rows);
    const bottom = Math.max(...rows);
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

const edge = (source: string, target: string, i: number) => ({ id: `e${i}`, kind: "a2a" as const, source, target, relationType: "x" });

describe("layout rows (three per vertical lane)", () => {
  it("a lane with few nodes keeps them on its middle row; the side column on its lane", () => {
    const few = {
      nodes: Array.from({ length: SPREAD_FROM - 1 }, (_, i) => node(`d${i}`, "data")).concat([node("h1", "human"), node("h2", "human")]),
      edges: [],
    };
    const { positions, lanes } = layoutAssetGraph(few);
    const dataY = lanes.find((l) => l.id === "data")!.y;
    for (let i = 0; i < SPREAD_FROM - 1; i++) expect(positions.get(`d${i}`)!.y).toBe(dataY);
    const humanY = lanes.find((l) => l.id === "human")!.y;
    expect(positions.get("h1")!.y).toBe(humanY);
    expect(positions.get("h2")!.y).toBe(humanY);
  });

  it("a crowded lane is spread over its three rows, at most a third each", () => {
    const many = {
      nodes: Array.from({ length: 12 }, (_, i) => node(`d${i}`, "data")).concat([node("h1", "human")]),
      edges: Array.from({ length: 12 }, (_, i) => edge(`d${i}`, "h1", i)),
    };
    const { positions, lanes } = layoutAssetGraph(many);
    const rows = laneRows(lanes.find((l) => l.id === "data")!);
    const perRow = rows.map((y) => [...Array(12).keys()].filter((i) => positions.get(`d${i}`)!.y === y).length);
    expect(perRow).toEqual([4, 4, 4]);
  });

  it("spread by links: up to the lane above → top row, down to the DFD elements → bottom row", () => {
    const anchor = (id: string) => ({ kind: "anchor", id, displayId: id, name: id }) as unknown as AssetGraphNode;
    const nodes = [
      ...Array.from({ length: 9 }, (_, i) => node(`d${i}`, "data")),
      node("f1", "function"),
      anchor("anchor:p1"),
    ];
    // d0–d2 feed a function (up), d3–d5 sit on a DFD element (down), d6–d8 have no links.
    const edges = [
      ...[0, 1, 2].map((i) => edge(`d${i}`, "f1", i)),
      ...[3, 4, 5].map((i) => edge("anchor:p1", `d${i}`, i)),
    ];
    const { positions, lanes } = layoutAssetGraph({ nodes, edges });
    const [top, middle, bottom] = laneRows(lanes.find((l) => l.id === "data")!);
    for (const i of [0, 1, 2]) expect(positions.get(`d${i}`)!.y).toBe(top);
    for (const i of [3, 4, 5]) expect(positions.get(`d${i}`)!.y).toBe(bottom);
    for (const i of [6, 7, 8]) expect(positions.get(`d${i}`)!.y).toBe(middle);
  });

  it("the spread is deterministic and only a full layout spreads — a new node takes the middle row", () => {
    const many = {
      nodes: Array.from({ length: 9 }, (_, i) => node(`d${i}`, "data")).concat([node("f1", "function")]),
      edges: Array.from({ length: 9 }, (_, i) => edge(`d${i}`, "f1", i)),
    };
    const a = layoutAssetGraph(many);
    expect([...layoutAssetGraph(many).positions]).toEqual([...a.positions]);
    const grown = { nodes: [...many.nodes, node("d9", "data")], edges: [...many.edges, edge("d9", "f1", 9)] };
    const next = layoutAssetGraph(grown, a.positions);
    expect(next.positions.get("d9")!.y).toBe(a.lanes.find((l) => l.id === "data")!.y);
    for (let i = 0; i < 9; i++) expect(next.positions.get(`d${i}`)).toEqual(a.positions.get(`d${i}`));
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

describe("two free rows above the top lane (FR-V17g)", () => {
  const layout = layoutAssetGraph(graph);
  const lane = (id: string) => layout.lanes.find((l) => l.id === id);

  it("sit one and two rows above the topmost lane, hold no node", () => {
    const top = Math.min(...layout.lanes.filter((l) => l.kind !== "free").map((l) => l.y));
    expect(lane(FREE_LANE)).toEqual({ id: FREE_LANE, kind: "free", y: top - LANE_HEIGHT });
    expect(lane(FREE_LANE_2)).toEqual({ id: FREE_LANE_2, kind: "free", y: top - 2 * LANE_HEIGHT });
    for (const p of layout.positions.values()) {
      expect(p.y).not.toBe(top - LANE_HEIGHT);
      expect(p.y).not.toBe(top - 2 * LANE_HEIGHT);
    }
  });

  it("a side-column node can be moved into either and stays there; a vertical-lane node cannot", () => {
    const freeY = lane(FREE_LANE)!.y;
    const free2Y = lane(FREE_LANE_2)!.y;
    // Three rows in each free row as well (user 2026-11-06).
    expect(laneRows(lane(FREE_LANE)!)).toEqual([freeY - ROW_HEIGHT, freeY, freeY + ROW_HEIGHT]);
    const moved = moveNode(layout.positions, "h1", 0, -10000, { sideColumn: true, lanes: layout.lanes });
    expect(moved.get("h1")!.y).toBe(free2Y - ROW_HEIGHT);
    for (const y of [...laneRows(lane(FREE_LANE)!), ...laneRows(lane(FREE_LANE_2)!)]) {
      const to = moveNode(layout.positions, "h1", 0, y - layout.positions.get("h1")!.y, { sideColumn: true, lanes: layout.lanes });
      expect(to.get("h1")!.y).toBe(y);
    }
    expect(layoutAssetGraph(graph, moved).positions.get("h1")).toEqual(moved.get("h1"));
    const s1 = moveNode(layout.positions, "s1", 0, -10000, { sideColumn: false, lanes: layout.lanes });
    expect(s1.get("s1")!.y).toBe(lane("system")!.y - ROW_HEIGHT);
  });

  it("no free row without a side column", () => {
    const vertical = layoutAssetGraph({ nodes: [node("d1", "data"), node("s1", "system")], edges: [] });
    expect(vertical.lanes.map((l) => l.id)).not.toContain(FREE_LANE);
    expect(vertical.lanes.map((l) => l.id)).not.toContain(FREE_LANE_2);
  });
});
