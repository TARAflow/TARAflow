// tests/unit/features/dfd/asset-graph/asset-graph-query.test.ts
//
// FR-V10 / UX-6: type list for the filter, search, and "why not visible".

import { describe, it, expect } from "vitest";
import {
  ASSET_GRAPH_PRESETS,
  assetVisibility,
  buildAssetGraph,
  relationTypesIn,
  searchAssets,
  type AssetGraphSource,
} from "features/dfd/asset-graph";
import type { A2ARelation } from "shared";

const rel = (id: string, s: string, t: string, relationType: string) =>
  ({ id, sourceAssetId: s, targetAssetId: t, relationType }) as A2ARelation;

const source: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "d2", displayId: "DA-002", name: "Config", assetGroup: "data" },
    { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
    { id: "h1", displayId: "HU-001", name: "Operator", assetGroup: "human" },
  ],
  relations: [
    rel("r1", "d1", "f1", "required_by"),
    rel("r2", "d2", "f1", "required_by"),
    rel("r3", "d2", "f1", "configures"),
  ],
  elements: [{ id: "pe", type: "Process", assetRelations: [{ assetId: "f1", relationType: "implements" }] }],
};

describe("relationTypesIn", () => {
  it("lists asset-link types first, with counts", () => {
    expect(relationTypesIn(source)).toEqual([
      { type: "configures", kind: "a2a", count: 1 },
      { type: "required_by", kind: "a2a", count: 2 },
      { type: "implements", kind: "anchor", count: 1 },
    ]);
  });
});

describe("searchAssets", () => {
  it("matches display id and name, case-insensitive, in layer order", () => {
    expect(searchAssets(source, "da-").map((a) => a.id)).toEqual(["d1", "d2"]);
    expect(searchAssets(source, "stop").map((a) => a.id)).toEqual(["f1"]);
    expect(searchAssets(source, "  ")).toEqual([]);
  });
});

describe("assetVisibility", () => {
  it("visible / hidden layer / outside focus / unknown", () => {
    const options = {
      view: "focus" as const,
      layers: ASSET_GRAPH_PRESETS.architecture,
      focusAssetId: "d1",
    };
    const g = buildAssetGraph(source, options);
    expect(assetVisibility(g, source, options, "f1")).toEqual({ state: "visible" });
    expect(assetVisibility(g, source, options, "h1")).toEqual({ state: "hiddenLayer", layer: "human" });
    expect(assetVisibility(g, source, options, "d2")).toEqual({ state: "outsideFocus" });
    expect(assetVisibility(g, source, options, "zz")).toEqual({ state: "unknown" });
  });
});

describe("relationsOfAssetGrouped (FR-V8)", () => {
  it("groups outgoing by type, incoming by inverse name, then DFD elements", async () => {
    const { relationsOfAssetGrouped } = await import("features/dfd/asset-graph");
    const src: AssetGraphSource = {
      ...source,
      relations: [
        ...source.relations,
        { id: "r4", sourceAssetId: "p1", targetAssetId: "f1", relationType: "invokes", stepOrder: 2 } as A2ARelation,
        { id: "r5", sourceAssetId: "p2", targetAssetId: "f1", relationType: "invokes", stepOrder: 1 } as A2ARelation,
      ],
      assets: [
        ...source.assets,
        { id: "p1", displayId: "PR-001", name: "Update", assetGroup: "process" },
        { id: "p2", displayId: "PR-002", name: "Boot", assetGroup: "process" },
      ],
    };
    const groups = relationsOfAssetGrouped(src, "f1", (t) => `inv(${t})`);
    expect(groups.map((g) => [g.direction, g.label, g.items.map((i) => i.displayId)])).toEqual([
      ["in", "inv(configures)", ["DA-002"]],
      ["in", "inv(invokes)", ["PR-002", "PR-001"]],
      ["in", "inv(required_by)", ["DA-001", "DA-002"]],
      ["element", "implements", ["pe"]],
    ]);
    const out = relationsOfAssetGrouped(src, "d2", (t) => t);
    expect(out.map((g) => [g.direction, g.label])).toEqual([
      ["out", "configures"],
      ["out", "required_by"],
    ]);
    expect(out[0].items[0]).toMatchObject({ id: "f1", relationId: "r3" });
  });
});
