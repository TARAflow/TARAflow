// tests/unit/features/dfd/asset-graph/build-asset-graph.test.ts
//
// Phase 2, AR-11: the asset graph preparation is a pure function. These tests
// pin layers, presets, stubs, focus depth, type filter, element anchors,
// context-bar counts and determinism.

import { describe, it, expect } from "vitest";
import {
  ASSET_GRAPH_PRESETS,
  buildAssetGraph,
  hiddenLayersWithStubs,
  presetOfLayers,
  type AssetGraphSource,
} from "features/dfd/asset-graph";
import type { A2ARelation } from "shared";

const asset = (id: string, displayId: string, group: string, name = displayId) => ({
  id,
  displayId,
  name,
  assetGroup: group,
});

const rel = (
  id: string,
  s: string,
  t: string,
  relationType: string,
  stepOrder?: number,
): A2ARelation =>
  ({
    id,
    sourceAssetId: s,
    targetAssetId: t,
    relationType,
    ...(stepOrder !== undefined ? { stepOrder } : {}),
  }) as A2ARelation;

// Measure data → E-stop function ← invoked by the safety process, which runs
// on the PLC (hosted in the cabinet) and is operated by the operator.
function source(): AssetGraphSource {
  return {
    assets: [
      asset("d1", "DA-001", "data", "Measure Data"),
      asset("f1", "FU-001", "function", "E-Stop"),
      asset("s1", "SY-001", "system", "Safety PLC"),
      asset("i1", "IN-001", "infrastructure", "Cabinet"),
      asset("p1", "PR-001", "process", "Safety shutdown"),
      asset("h1", "HU-001", "human", "Operator"),
    ],
    relations: [
      rel("r1", "d1", "f1", "required_by"),
      rel("r2", "p1", "f1", "invokes", 1),
      rel("r3", "p1", "s1", "runs_on"),
      rel("r4", "p1", "h1", "operated_by"),
      rel("r5", "s1", "i1", "hosted_on"),
      rel("r6", "d1", "gone", "required_by"), // dangling end: never drawn
    ],
    elements: [
      {
        id: "pe",
        displayId: "P-1",
        name: "Controller",
        type: "Process",
        assetRelations: [{ assetId: "f1", relationType: "implements" }],
      },
      {
        id: "df",
        displayId: "DF-1",
        name: "values",
        type: "DataFlow",
        assetRelations: [{ assetId: "d1", relationType: "transmits" }],
      },
      { id: "ee", type: "ExternalEntity" },
    ],
  };
}

const ids = (g: ReturnType<typeof buildAssetGraph>) => g.nodes.map((n) => n.id);

describe("presets (FR-V2)", () => {
  it("each preset is recognised, order does not matter", () => {
    for (const [id, layers] of Object.entries(ASSET_GRAPH_PRESETS)) {
      expect(presetOfLayers([...layers].reverse())).toBe(id);
    }
  });

  it('"All" comes first in the preset list', async () => {
    const { ASSET_GRAPH_PRESET_ORDER } = await import("features/dfd/asset-graph");
    expect(ASSET_GRAPH_PRESET_ORDER[0]).toBe("all");
  });

  it("a changed preset becomes custom", () => {
    expect(presetOfLayers(["data", "function", "system"])).toBe("custom");
  });
});

describe("layer view", () => {
  it("shows the assets of the visible layers, vertical layers bottom-up", () => {
    const g = buildAssetGraph(source(), {
      view: "layers",
      layers: ASSET_GRAPH_PRESETS.architecture,
    });
    expect(ids(g)).toEqual(["d1", "f1", "s1", "i1"]);
    expect(g.edges.map((e) => e.id)).toEqual(["r1", "r5"]);
    expect(g.edges[0]).toEqual({
      id: "r1",
      kind: "a2a",
      source: "d1",
      target: "f1",
      relationType: "required_by",
    });
  });

  it("links into hidden layers become stubs, grouped by layer (FR-V4)", () => {
    const g = buildAssetGraph(source(), {
      view: "layers",
      layers: ASSET_GRAPH_PRESETS.architecture,
    });
    expect(g.stubs).toEqual({
      f1: [{ layer: "process", count: 1 }],
      s1: [{ layer: "process", count: 1 }],
    });
    expect(hiddenLayersWithStubs(g)).toEqual(["process"]);
  });

  it("context-bar counts say what is hidden and why (FR-V14)", () => {
    const g = buildAssetGraph(source(), {
      view: "layers",
      layers: ASSET_GRAPH_PRESETS.architecture,
    });
    expect(g.counts).toEqual({
      assetsTotal: 6,
      assetsVisible: 4,
      assetsInHiddenLayers: 2,
      assetsOutsideFocus: 0,
      edgesHiddenByFilter: 0,
      edgesVisible: 2,
      anchorsVisible: 0,
      hazardsTotal: 0,
      hazardsVisible: 0,
    });
  });

  it("anchors only on request in the layer view (FR-V6)", () => {
    const opts = { view: "layers" as const, layers: ASSET_GRAPH_PRESETS.all };
    expect(buildAssetGraph(source(), opts).counts.anchorsVisible).toBe(0);
    const g = buildAssetGraph(source(), { ...opts, showAnchors: true });
    expect(g.nodes.filter((n) => n.kind === "anchor").map((n) => n.id)).toEqual([
      "el:df",
      "el:pe",
    ]);
  });
});

describe("focus view (FR-V5)", () => {
  it("depth 1: the focus asset and its direct neighbours, both directions", () => {
    const g = buildAssetGraph(source(), {
      view: "focus",
      layers: ASSET_GRAPH_PRESETS.all,
      focusAssetId: "f1",
    });
    const assets = g.nodes.filter((n) => n.kind === "asset");
    expect(assets.map((n) => [n.id, n.kind === "asset" ? n.distance : null])).toEqual([
      ["d1", 1],
      ["f1", 0],
      ["p1", 1],
    ]);
    expect(g.counts.assetsOutsideFocus).toBe(3);
    expect(g.edges.filter((e) => e.kind === "a2a").map((e) => e.id)).toEqual(["r1", "r2"]);
    expect(g.edges.find((e) => e.id === "r2")?.stepOrder).toBe(1);
  });

  it("depth 2 reaches the neighbours' neighbours", () => {
    const g = buildAssetGraph(source(), {
      view: "focus",
      layers: ASSET_GRAPH_PRESETS.all,
      focusAssetId: "f1",
      depth: 2,
    });
    expect(ids(g).filter((id) => !id.startsWith("el:"))).toEqual([
      "d1",
      "f1",
      "s1",
      "p1",
      "h1",
    ]);
  });

  it("shows element anchors of the shown assets on request (on by default in the view)", () => {
    const off = buildAssetGraph(source(), { view: "focus", layers: ASSET_GRAPH_PRESETS.all, focusAssetId: "f1" });
    expect(off.nodes.filter((n) => n.kind === "anchor")).toEqual([]);
    const g = buildAssetGraph(source(), {
      view: "focus",
      layers: ASSET_GRAPH_PRESETS.all,
      focusAssetId: "f1",
      showAnchors: true,
    });
    expect(g.nodes.filter((n) => n.kind === "anchor")).toEqual([
      {
        kind: "anchor",
        id: "el:df",
        elementId: "df",
        elementType: "DataFlow",
        displayId: "DF-1",
        name: "values",
      },
      {
        kind: "anchor",
        id: "el:pe",
        elementId: "pe",
        elementType: "Process",
        displayId: "P-1",
        name: "Controller",
      },
    ]);
    expect(g.edges.filter((e) => e.kind === "anchor").map((e) => e.id)).toEqual([
      "el:df->d1:transmits",
      "el:pe->f1:implements",
    ]);
  });

  it("does not walk into hidden layers; those links become stubs", () => {
    const g = buildAssetGraph(source(), {
      view: "focus",
      layers: ["data", "function", "system", "process"],
      focusAssetId: "f1",
      depth: 3,
    });
    expect(ids(g).filter((id) => !id.startsWith("el:"))).toEqual(["d1", "f1", "s1", "p1"]);
    expect(g.stubs).toEqual({
      p1: [{ layer: "human", count: 1 }],
      s1: [{ layer: "infrastructure", count: 1 }],
    });
    expect(g.counts.assetsInHiddenLayers).toBe(2);
  });

  it("the focus asset is shown even if its layer is hidden", () => {
    const g = buildAssetGraph(source(), {
      view: "focus",
      layers: ["function"],
      focusAssetId: "p1",
    });
    expect(ids(g).filter((id) => !id.startsWith("el:"))).toEqual(["f1", "p1"]);
  });

  it("an unknown focus id yields an empty graph and says so", () => {
    const g = buildAssetGraph(source(), {
      view: "focus",
      layers: ASSET_GRAPH_PRESETS.all,
      focusAssetId: "nope",
    });
    expect(g.focusMissing).toBe(true);
    expect(g.nodes).toEqual([]);
  });
});

describe("relation type filter (FR-V10)", () => {
  it("hidden types are not drawn, not walked and counted", () => {
    const g = buildAssetGraph(source(), {
      view: "focus",
      layers: ASSET_GRAPH_PRESETS.all,
      focusAssetId: "f1",
      depth: 2,
      relationTypes: ["required_by", "runs_on", "operated_by", "implements", "transmits"],
    });
    // Without "invokes" the process is not reached from the function.
    expect(ids(g).filter((id) => !id.startsWith("el:"))).toEqual(["d1", "f1"]);
  });

  it("an edge between shown assets hidden by the filter is counted", () => {
    const g = buildAssetGraph(source(), {
      view: "layers",
      layers: ASSET_GRAPH_PRESETS.architecture,
      relationTypes: ["hosted_on"],
    });
    expect(g.edges.map((e) => e.id)).toEqual(["r5"]);
    expect(g.counts.edgesHiddenByFilter).toBe(1);
  });
});

describe("determinism (AR-10)", () => {
  it("input order does not change the output", () => {
    const a = source();
    const shuffled: AssetGraphSource = {
      assets: [...a.assets].reverse(),
      relations: [...a.relations].reverse(),
      elements: [...a.elements].reverse(),
    };
    const opts = {
      view: "focus" as const,
      layers: ASSET_GRAPH_PRESETS.all,
      focusAssetId: "f1",
      depth: 3,
    };
    expect(buildAssetGraph(shuffled, opts)).toEqual(buildAssetGraph(a, opts));
  });
});
