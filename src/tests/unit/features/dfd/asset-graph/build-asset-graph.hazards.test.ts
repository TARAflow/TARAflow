// tests/unit/features/dfd/asset-graph/build-asset-graph.hazards.test.ts
//
// Asset graph design FR-V11, FR-V11a, FR-V11c, FR-V11e (doc/InProgress/DFD/
// asset-graph-hazards-and-node-move.md): Hazard Items as read-only nodes in
// their own side-column lane, `contributes_to` / `endangers` edges to shown
// assets, stubs for edges into hidden layers, the "not linked" mark — and a
// project without Hazard Items keeps exactly the graph it had (golden).
//
// Data: the SmokeDetector fixture (G10) — 22 assets, 5 Hazard Items,
// 21 contributes_to, 10 endangers.

import { describe, it, expect } from "vitest";
import {
  ASSET_GRAPH_PRESETS,
  buildAssetGraph,
  HAZARD_LANE,
  LANE_HEIGHT,
  layoutAssetGraph,
  sourceOnPages,
  withRegistryAssets,
  type AssetGraphHazardNode,
  type AssetGraphSource,
} from "features/dfd/asset-graph";
import type { A2ARelation, HazardItem, HazardRelation } from "shared";
import fixture from "../../../../fixtures/hazards/smoke-detector-hazard-graph.json";

const smokeDetector = (): AssetGraphSource => ({
  assets: fixture.assets.assets,
  relations: fixture.assets.relations as unknown as A2ARelation[],
  elements: [],
  hazards: {
    items: fixture.hazards.hazards as unknown as HazardItem[],
    relations: fixture.hazards.relations as unknown as HazardRelation[],
  },
});

const displayOf = (source: AssetGraphSource) => {
  const byId = new Map(source.assets.map((a) => [a.id, a.displayId]));
  return (id: string) => byId.get(id) ?? id;
};

const idOf = (source: AssetGraphSource, displayId: string) =>
  source.assets.find((a) => a.displayId === displayId)!.id;

const hazardNodes = (g: ReturnType<typeof buildAssetGraph>) =>
  g.nodes.filter((n): n is AssetGraphHazardNode => n.kind === "hazard");

describe("asset graph — Hazard Items (FR-V11)", () => {
  it("preset All: 5 hazard nodes, 21 contributes_to and 10 endangers edges", () => {
    const g = buildAssetGraph(smokeDetector(), {
      view: "layers",
      layers: ASSET_GRAPH_PRESETS.all,
      showHazards: true,
    });
    expect(hazardNodes(g).map((n) => [n.id, n.displayId, n.name])).toEqual([
      ["hz:H-01", "HZ-01", "Fire not detected"],
      ["hz:H-02", "HZ-02", "Alarm not transmitted"],
      ["hz:H-03", "HZ-03", "Delayed alarm"],
      ["hz:H-04", "HZ-04", "False alarm"],
      ["hz:H-05", "HZ-05", "Wrong fire location reported"],
    ]);
    expect(g.edges.filter((e) => e.kind === "contributes_to")).toHaveLength(21);
    expect(g.edges.filter((e) => e.kind === "endangers")).toHaveLength(10);
    expect(g.stubs["hz:H-01"]).toBeUndefined();
    expect(g.counts.hazardsTotal).toBe(5);
    expect(g.counts.hazardsVisible).toBe(5);
    // Asset counts are about assets only.
    expect(g.counts.assetsVisible).toBe(22);
  });

  it("preset Protection targets: endangers to HU-001 / HU-002, the rest as stubs (FR-V11a)", () => {
    const source = smokeDetector();
    const display = displayOf(source);
    const g = buildAssetGraph(source, {
      view: "layers",
      layers: ASSET_GRAPH_PRESETS.protection,
      showHazards: true,
    });
    expect(g.edges.filter((e) => e.kind === "contributes_to")).toEqual([]);
    expect(
      g.edges
        .filter((e) => e.kind === "endangers")
        .map((e) => `${e.source} → ${display(e.target)}`)
        .sort(),
    ).toEqual([
      "hz:H-01 → HU-001",
      "hz:H-02 → HU-001",
      "hz:H-03 → HU-001",
      "hz:H-04 → HU-001",
      "hz:H-05 → HU-001",
      "hz:H-05 → HU-002",
    ]);
    // H-01: 5 data, 2 function, 1 system contribute; IF-001 is endangered.
    expect(g.stubs["hz:H-01"]).toEqual([
      { layer: "data", count: 5 },
      { layer: "function", count: 2 },
      { layer: "system", count: 1 },
      { layer: "infrastructure", count: 1 },
    ]);
    expect(g.stubs["hz:H-05"]).toEqual([{ layer: "data", count: 2 }]);
  });

  it("edges carry relevance (contributes_to) and the severity (endangers)", () => {
    const source = smokeDetector();
    const display = displayOf(source);
    const g = buildAssetGraph(source, { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showHazards: true });
    const contributes = g.edges.filter((e) => e.kind === "contributes_to" && e.target === "hz:H-01");
    expect(Object.fromEntries(contributes.map((e) => [display(e.source), e.relevance]))).toMatchObject({
      "FU-001": "direct",
      "DA-001": "direct",
      "DA-004": "indirect",
      "SY-002": "indirect",
    });
    const endangers = g.edges.filter((e) => e.kind === "endangers" && e.source === "hz:H-01");
    expect(endangers.map((e) => [display(e.target), e.severity])).toEqual(
      expect.arrayContaining([
        ["HU-001", "fatal"],
        ["IF-001", "critical"],
      ]),
    );
  });

  it("colour rank = the worst endangers severity of the hazard", () => {
    const g = buildAssetGraph(smokeDetector(), { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showHazards: true });
    expect(Object.fromEntries(hazardNodes(g).map((n) => [n.hazardId, [n.severity, n.severityRank]]))).toEqual({
      "H-01": ["fatal", 4],
      "H-02": ["fatal", 4],
      "H-03": ["irreversible_major", 4],
      "H-04": ["reversible_major", 2],
      "H-05": ["irreversible_major", 4],
    });
  });

  it("person harm in the pre-v9 vocabulary is shown with its canonical value", () => {
    const source: AssetGraphSource = {
      assets: [{ id: "hu", displayId: "HU-001", name: "Occupant", assetGroup: "human" }],
      relations: [],
      elements: [],
      hazards: {
        items: [{ id: "H1", label: "Fire", combinationType: "ANY", source: "manual" } as HazardItem],
        relations: [
          { type: "endangers", from: "H1", to: "hu", impact: { target: "human", severity: "fatality" } } as unknown as HazardRelation,
        ],
      },
    };
    const g = buildAssetGraph(source, { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showHazards: true });
    expect(g.edges.map((e) => e.severity)).toEqual(["fatal"]);
    expect(hazardNodes(g)[0]).toMatchObject({ displayId: "Fire", severity: "fatal", severityRank: 4 });
  });

  it("1H-S: a person edge rated 'none' (S0) is drawn with its rating, rank 0", () => {
    const source: AssetGraphSource = {
      assets: [{ id: "hu", displayId: "HU-001", name: "Operator", assetGroup: "human" }],
      relations: [],
      elements: [],
      hazards: {
        items: [{ id: "H1", label: "Pinch", combinationType: "ANY", source: "manual" } as HazardItem],
        relations: [{ type: "endangers", from: "H1", to: "hu", impact: { target: "human", severity: "none" } } as HazardRelation],
      },
    };
    const g = buildAssetGraph(source, { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showHazards: true });
    expect(g.edges.map((e) => e.severity)).toEqual(["none"]);
    expect(hazardNodes(g)[0]).toMatchObject({ severity: "none", severityRank: 0, linked: true });
  });

  it("a hazard without an edge to an existing asset is 'not linked' (FR-V11e)", () => {
    const source: AssetGraphSource = {
      assets: [{ id: "d", displayId: "DA-001", name: "Data", assetGroup: "data" }],
      relations: [],
      elements: [],
      hazards: {
        items: [
          { id: "H1", label: "Lonely", combinationType: "ANY", source: "manual" } as HazardItem,
          { id: "H2", label: "Dangling", combinationType: "ANY", source: "manual" } as HazardItem,
          { id: "H3", label: "Linked", combinationType: "ANY", source: "manual" } as HazardItem,
        ],
        relations: [
          { type: "contributes_to", from: "gone", to: "H2", relevance: "direct", hazardDistance: 0 } as unknown as HazardRelation,
          { type: "contributes_to", from: "d", to: "H3", relevance: "direct", hazardDistance: 0 } as unknown as HazardRelation,
        ],
      },
    };
    const g = buildAssetGraph(source, { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showHazards: true });
    expect(hazardNodes(g).map((n) => [n.hazardId, n.linked])).toEqual([
      ["H2", false],
      ["H3", true],
      ["H1", false],
    ]);
    expect(g.edges.map((e) => e.id)).toEqual(["d->hz:H3"]);
  });

  it("off without showHazards", () => {
    const source = smokeDetector();
    const off = buildAssetGraph(source, { view: "layers", layers: ASSET_GRAPH_PRESETS.all });
    expect(hazardNodes(off)).toEqual([]);
    expect(off.counts).toMatchObject({ hazardsTotal: 5, hazardsVisible: 0 });
    const focus = buildAssetGraph(source, {
      view: "focus",
      layers: ASSET_GRAPH_PRESETS.all,
      focusAssetId: idOf(source, "FU-001"),
    });
    expect(hazardNodes(focus)).toEqual([]);
  });

  it("golden: without Hazard Items the graph and its layout are unchanged", () => {
    const withHazards = smokeDetector();
    const { hazards: _drop, ...without } = withHazards;
    for (const layers of [ASSET_GRAPH_PRESETS.all, ASSET_GRAPH_PRESETS.protection, ASSET_GRAPH_PRESETS.architecture]) {
      const base = buildAssetGraph(without, { view: "layers", layers });
      const variants = [
        buildAssetGraph(without, { view: "layers", layers, showHazards: true }),
        buildAssetGraph({ ...without, hazards: { items: [], relations: [] } }, { view: "layers", layers, showHazards: true }),
        buildAssetGraph(withHazards, { view: "layers", layers }),
      ];
      for (const g of variants) {
        expect(g.nodes).toEqual(base.nodes);
        expect(g.edges).toEqual(base.edges);
        expect(g.stubs).toEqual(base.stubs);
        expect(layoutAssetGraph(g)).toEqual(layoutAssetGraph(base));
      }
    }
  });

  it("layout: the hazard lane sits in the side column directly above human (G1)", () => {
    const g = buildAssetGraph(smokeDetector(), { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showHazards: true });
    const { lanes, positions } = layoutAssetGraph(g);
    const lane = (id: string) => lanes.find((l) => l.id === id)!;
    const ids = lanes.filter((l) => l.kind === "orthogonal").map((l) => l.id);
    expect(ids).toEqual(["process", "service", HAZARD_LANE, "human"]);
    expect(lane(HAZARD_LANE).x).toBe(lane("human").x);
    expect(lane(HAZARD_LANE).y).toBeLessThan(lane("human").y);
    expect(lane("human").y - lane(HAZARD_LANE).y).toBe(LANE_HEIGHT);
    // In the lane (the side column settles like the other orthogonal lanes).
    for (const n of hazardNodes(g)) {
      expect(Math.abs(positions.get(n.id)!.y - lane(HAZARD_LANE).y)).toBeLessThan(LANE_HEIGHT / 2);
    }
  });

  it("page filter (leveled DFD): hazards keep their causes on the pages and their protection targets", () => {
    const source: AssetGraphSource = {
      assets: [
        { id: "d1", displayId: "DA-001", name: "On page", assetGroup: "data" },
        { id: "d2", displayId: "DA-002", name: "Elsewhere", assetGroup: "data" },
        { id: "u1", displayId: "HU-001", name: "Occupant", assetGroup: "human" },
        { id: "u2", displayId: "HU-002", name: "Visitor", assetGroup: "human" },
      ],
      relations: [],
      elements: [
        { id: "p1", type: "Process", assetRelations: [{ assetId: "d1", relationType: "processes" }] },
        { id: "p2", type: "Process", assetRelations: [{ assetId: "d2", relationType: "processes" }] },
      ],
      hazards: {
        items: [
          { id: "H1", label: "Here", combinationType: "ANY", source: "manual" } as HazardItem,
          { id: "H2", label: "There", combinationType: "ANY", source: "manual" } as HazardItem,
        ],
        relations: [
          { type: "contributes_to", from: "d1", to: "H1", relevance: "direct", hazardDistance: 0 } as unknown as HazardRelation,
          { type: "contributes_to", from: "d2", to: "H1", relevance: "direct", hazardDistance: 0 } as unknown as HazardRelation,
          { type: "contributes_to", from: "d2", to: "H2", relevance: "direct", hazardDistance: 0 } as unknown as HazardRelation,
          { type: "endangers", from: "H1", to: "u1", impact: { target: "human", severity: "fatal" } } as HazardRelation,
          { type: "endangers", from: "H2", to: "u2", impact: { target: "human", severity: "fatal" } } as HazardRelation,
        ],
      },
    };
    const shown = sourceOnPages(source, new Set(["p1"]));
    expect(shown.hazards?.items.map((h) => h.id)).toEqual(["H1"]);
    expect(shown.hazards?.relations).toHaveLength(2);
    // The protection target of a hazard on the pages stays — it has no element.
    expect(shown.assets.map((a) => a.id)).toEqual(["d1", "u1"]);
  });
});

describe("asset graph — manual assets from the registry", () => {
  // dfd.assets holds DFD-sourced assets only; the SmokeDetector's persons
  // (HU-001, HU-002) and the building (IF-001) are manual protection targets.
  const manual = new Set(["HU-001", "HU-002", "IF-001"]);
  const registry = () => {
    const full = smokeDetector();
    return { assets: full.assets, relations: full.relations };
  };
  const mirrorOnly = (): AssetGraphSource => {
    const full = smokeDetector();
    const assets = full.assets.filter((a) => !manual.has(a.displayId!));
    const ids = new Set(assets.map((a) => a.id));
    return {
      ...full,
      assets,
      relations: full.relations.filter((r) => ids.has(r.sourceAssetId) && ids.has(r.targetAssetId)),
    };
  };

  it("without the registry the endangers edges have no target (the reported bug)", () => {
    const g = buildAssetGraph(mirrorOnly(), { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showHazards: true });
    expect(g.edges.filter((e) => e.kind === "endangers")).toEqual([]);
  });

  it("with it HZ-01 endangers HU-001 and IF-001, and the manual assets keep their links", () => {
    const source = withRegistryAssets(mirrorOnly(), registry());
    const display = displayOf(source);
    expect(source.assets.map((a) => a.displayId)).toEqual(expect.arrayContaining([...manual]));
    expect(source.relations).toHaveLength(smokeDetector().relations.length);
    const g = buildAssetGraph(source, { view: "layers", layers: ASSET_GRAPH_PRESETS.all, showHazards: true });
    expect(g.edges.filter((e) => e.kind === "endangers")).toHaveLength(10);
    expect(
      g.edges.filter((e) => e.source === "hz:H-01" && e.kind === "endangers").map((e) => display(e.target)).sort(),
    ).toEqual(["HU-001", "IF-001"]);
  });

  it("adds nothing the mirror has already — no duplicate assets or links", () => {
    const full = smokeDetector();
    expect(withRegistryAssets(full, registry())).toBe(full);
    expect(withRegistryAssets(full, null)).toBe(full);
    const mirror = mirrorOnly();
    const renamed = { ...mirror, relations: mirror.relations.map((r) => ({ ...r, id: `${r.id}#mirror` })) };
    const merged = withRegistryAssets(renamed, registry());
    expect(merged.relations).toHaveLength(full.relations.length);
  });
});

describe("asset graph — hazards in the focus view (FR-V11b)", () => {
  const focus = (source: AssetGraphSource, focusAssetId: string, depth: number, showHazards = true) =>
    buildAssetGraph(source, { view: "focus", layers: ASSET_GRAPH_PRESETS.all, focusAssetId, depth, showHazards });
  const shownDisplay = (source: AssetGraphSource, g: ReturnType<typeof buildAssetGraph>) => {
    const display = displayOf(source);
    return g.nodes.filter((n) => n.kind !== "anchor").map((n) => (n.kind === "hazard" ? n.id : display(n.id)));
  };

  it("depth 1 from FU-001: the hazard it contributes to; depth 2: its causes and protection targets", () => {
    const source = smokeDetector();
    const one = focus(source, idOf(source, "FU-001"), 1);
    expect(hazardNodes(one).map((n) => [n.id, n.distance])).toEqual([["hz:H-01", 1]]);
    expect(shownDisplay(source, one)).not.toContain("HU-001");
    // Edges among the shown nodes: FU-001 and its shown neighbours → H-01.
    const contributes = one.edges.filter((e) => e.kind === "contributes_to");
    expect(new Set(contributes.map((e) => e.target))).toEqual(new Set(["hz:H-01"]));
    expect(contributes.map((e) => e.source)).toContain(idOf(source, "FU-001"));

    const two = focus(source, idOf(source, "FU-001"), 2);
    expect(shownDisplay(source, two)).toEqual(expect.arrayContaining(["HU-001", "IF-001", "DA-001", "SY-002"]));
    const display = displayOf(source);
    expect(
      two.edges.filter((e) => e.kind === "endangers" && e.source === "hz:H-01").map((e) => display(e.target)).sort(),
    ).toEqual(["HU-001", "IF-001"]);
  });

  it("a protection target reaches the hazards that endanger it", () => {
    const source = smokeDetector();
    const g = focus(source, idOf(source, "HU-002"), 1);
    expect(hazardNodes(g).map((n) => n.id)).toEqual(["hz:H-05"]);
  });

  it("a hazard can be the focus — shown even with the toggle off", () => {
    const source = smokeDetector();
    const g = focus(source, "hz:H-05", 1, false);
    expect(g.focusMissing).toBe(false);
    expect(hazardNodes(g).map((n) => [n.id, n.distance])).toEqual([["hz:H-05", 0]]);
    expect(shownDisplay(source, g).sort()).toEqual(["DA-003", "DA-008", "HU-001", "HU-002", "hz:H-05"]);
    expect(focus(source, "hz:gone", 1).focusMissing).toBe(true);
  });

  it("does not walk into hidden layers; their hazard edges become stubs", () => {
    const source = smokeDetector();
    const g = buildAssetGraph(source, {
      view: "focus",
      layers: ASSET_GRAPH_PRESETS.protection,
      focusAssetId: "hz:H-05",
      depth: 1,
    });
    expect(shownDisplay(source, g).sort()).toEqual(["HU-001", "HU-002", "hz:H-05"]);
    expect(g.stubs["hz:H-05"]).toEqual([{ layer: "data", count: 2 }]);
  });
});
