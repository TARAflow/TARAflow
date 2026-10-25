// tests/unit/features/dfd/asset-graph/layout-asset-graph.test.ts
//
// D6 / FR-V3 / AR-10 / AR-12: lanes per layer, deterministic, stable.

import { describe, it, expect } from "vitest";
import {
  ASSET_GRAPH_PRESETS,
  LANE_HEIGHT,
  buildAssetGraph,
  layoutAssetGraph,
  type AssetGraphSource,
} from "features/dfd/asset-graph";
import type { A2ARelation } from "shared";

const asset = (id: string, group: string) => ({ id, displayId: id.toUpperCase(), assetGroup: group });
const rel = (id: string, s: string, t: string, type: string) =>
  ({ id, sourceAssetId: s, targetAssetId: t, relationType: type }) as A2ARelation;

function source(extra: { assets?: ReturnType<typeof asset>[]; relations?: A2ARelation[] } = {}): AssetGraphSource {
  return {
    assets: [
      asset("d1", "data"),
      asset("d2", "data"),
      asset("f1", "function"),
      asset("s1", "system"),
      asset("i1", "infrastructure"),
      asset("p1", "process"),
      asset("h1", "human"),
      asset("e1", "environment"),
      ...(extra.assets ?? []),
    ],
    relations: [
      rel("r1", "d1", "f1", "required_by"),
      rel("r2", "d2", "f1", "required_by"),
      rel("r3", "p1", "f1", "invokes"),
      rel("r4", "p1", "s1", "runs_on"),
      rel("r5", "s1", "i1", "hosted_on"),
      rel("r6", "p1", "h1", "operated_by"),
      ...(extra.relations ?? []),
    ],
    elements: [{ id: "pe", type: "Process", assetRelations: [{ assetId: "f1", relationType: "implements" }] }],
  };
}

const graphOf = (src: AssetGraphSource) =>
  buildAssetGraph(src, { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showAnchors: true });

describe("layoutAssetGraph", () => {
  it("vertical layers are lanes, bottom-up; anchors below data", () => {
    const { positions } = layoutAssetGraph(graphOf(source()));
    const y = (id: string) => positions.get(id)!.y;
    expect(y("d1")).toBeGreaterThan(y("f1"));
    expect(y("f1")).toBeGreaterThan(y("s1"));
    expect(y("s1")).toBeGreaterThan(y("i1"));
    expect(y("el:pe")).toBeGreaterThan(y("d1"));
    // Close to the lane centre.
    expect(Math.abs(y("d1") - 3 * LANE_HEIGHT)).toBeLessThan(LANE_HEIGHT / 2);
  });

  it("orthogonal layers sit in a side column; environment next to human", () => {
    const { positions, lanes } = layoutAssetGraph(graphOf(source()));
    const maxVerticalX = Math.max(
      ...["d1", "d2", "f1", "s1", "i1"].map((id) => positions.get(id)!.x),
    );
    expect(positions.get("p1")!.x).toBeGreaterThan(maxVerticalX);
    const human = lanes.find((l) => l.id === "human")!;
    const env = lanes.find((l) => l.id === "environment")!;
    expect(env.y).toBe(human.y);
    expect(env.x!).toBeGreaterThan(human.x!);
  });

  it("is deterministic (AR-10)", () => {
    const a = layoutAssetGraph(graphOf(source()));
    const b = layoutAssetGraph(graphOf(source()));
    expect([...a.positions]).toEqual([...b.positions]);
  });

  it("keeps known nodes fixed and places only new ones (AR-12)", () => {
    const first = layoutAssetGraph(graphOf(source()));
    const grown = graphOf(
      source({ assets: [asset("d3", "data")], relations: [rel("r7", "d3", "f1", "required_by")] }),
    );
    const second = layoutAssetGraph(grown, first.positions);
    for (const [id, p] of first.positions) {
      expect(second.positions.get(id), id).toEqual(p);
    }
    const d3 = second.positions.get("d3")!;
    expect(Math.abs(d3.y - first.positions.get("d1")!.y)).toBeLessThan(LANE_HEIGHT / 2);
  });

  it("no previous positions = full layout (rearrange)", () => {
    const g = graphOf(source());
    const moved = new Map([...layoutAssetGraph(g).positions].map(([id, p]) => [id, { x: p.x + 999, y: p.y }]));
    const again = layoutAssetGraph(g);
    expect(again.positions.get("d1")).not.toEqual(moved.get("d1"));
  });

  it("an empty graph has no lanes", () => {
    expect(layoutAssetGraph({ nodes: [], edges: [] })).toEqual({ positions: new Map(), lanes: [] });
  });
});

describe("layoutAssetGraph — extra lanes (edit mode)", () => {
  it("empty layers get a lane when asked for, without moving anything", () => {
    const g = buildAssetGraph(
      { assets: [asset("d1", "data")], relations: [], elements: [] },
      { view: "layers", layers: ASSET_GRAPH_PRESETS.architecture },
    );
    const plain = layoutAssetGraph(g);
    expect(plain.lanes.map((l) => l.id)).toEqual(["data"]);
    const withLanes = layoutAssetGraph(g, new Map(), { extraLanes: ["function", "system", "human"] });
    // A side column brings the free row above everything (FR-V17g).
    expect(withLanes.lanes.map((l) => l.id).sort()).toEqual(["data", "free", "function", "human", "system"]);
    expect(withLanes.positions.get("d1")).toEqual(plain.positions.get("d1"));
  });
});
