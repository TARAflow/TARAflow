// FR-V15: positions remembered locally; malformed data and positions that no
// longer fit their lane fall back to the deterministic layout.

import { describe, expect, it } from "vitest";
import {
  parsePositions,
  positionsStorageKey,
  serializePositions,
} from "features/dfd/asset-graph/asset-graph-positions-store";
import { LANE_HEIGHT, layoutAssetGraph } from "features/dfd/asset-graph/layout-asset-graph";
import type { AssetGraphNode } from "features/dfd/asset-graph/asset-graph-types";

describe("asset graph — local positions", () => {
  it("round-trips, keeps only existing ids and rounds", () => {
    const text = serializePositions(
      new Map([
        ["a", { x: 10.4, y: 20.6 }],
        ["gone", { x: 1, y: 2 }],
      ]),
      (id) => id !== "gone",
    );
    expect([...parsePositions(text)]).toEqual([["a", { x: 10, y: 21 }]]);
  });

  it("ignores missing, broken, foreign-version and non-numeric data", () => {
    expect(parsePositions(null).size).toBe(0);
    expect(parsePositions("{nope").size).toBe(0);
    expect(parsePositions(JSON.stringify({ v: 2, p: { a: [1, 2] } })).size).toBe(0);
    const mixed = parsePositions(JSON.stringify({ v: 1, p: { a: [1, 2], b: ["x", 2], c: [1], d: [null, 3] } }));
    expect([...mixed.keys()]).toEqual(["a"]);
  });

  it("one key per project", () => {
    expect(positionsStorageKey("p1")).not.toBe(positionsStorageKey("p2"));
  });

  it("the layout keeps a remembered position in its lane and re-places one outside it", () => {
    const nodes = [
      { kind: "asset", id: "d1", group: "data" },
      { kind: "asset", id: "d2", group: "data" },
    ] as unknown as AssetGraphNode[];
    const fresh = layoutAssetGraph({ nodes, edges: [] });
    const laneY = fresh.positions.get("d1")!.y;
    const kept = layoutAssetGraph({ nodes, edges: [] }, new Map([["d1", { x: 900, y: laneY + 10 }]]));
    expect(kept.positions.get("d1")).toEqual({ x: 900, y: laneY + 10 });
    const stale = layoutAssetGraph({ nodes, edges: [] }, new Map([["d1", { x: 900, y: laneY - LANE_HEIGHT }]]));
    expect(Math.abs(stale.positions.get("d1")!.y - laneY)).toBeLessThan(LANE_HEIGHT / 2);
  });
});
