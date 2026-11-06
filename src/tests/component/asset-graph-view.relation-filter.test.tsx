// src/tests/component/asset-graph-view.relation-filter.test.tsx
//
// User 2026-11-06: the asset graph's relation filter — one checkbox per kind
// of relation (DFD element, asset, hazard), all ticked by default. A hazard is
// a node like an asset; the kind of a relation is its other end (a hazard's
// relation to an asset counts as "asset"). An unticked kind hides every node
// with such a relation; nothing ticked leaves the nodes without any relation.
// Only hazards marked relevant (in scope) appear in the graph at all.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import { filterByRelations, onlyRelevantHazards, relationIndex } from "features/dfd/asset-graph/asset-graph-query";
import type { A2ARelation, HazardItem, HazardRelation } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const rel = (id: string, s: string, t: string) =>
  ({ id, sourceAssetId: s, targetAssetId: t, relationType: "required_by" }) as A2ARelation;
const hz = (id: string, systemRelevance?: string) =>
  ({ id, label: id, combinationType: "ANY", source: "manual", systemRelevance }) as unknown as HazardItem;

// d1 – f1 asset relation; d2 on a DFD element; d3 nothing; p1 contributes to
// H1, H1 endangers u1 (human); H2 relevant without relation; H3 out of scope.
const source: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "d2", displayId: "DA-002", name: "Calibration", assetGroup: "data" },
    { id: "d3", displayId: "DA-003", name: "Log", assetGroup: "data" },
    { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
    { id: "p1", displayId: "PR-001", name: "Shutdown", assetGroup: "process" },
    { id: "u1", displayId: "HU-001", name: "Operator", assetGroup: "human" },
  ],
  relations: [rel("r1", "d1", "f1")],
  elements: [{ id: "pe", displayId: "P-1", type: "Process", assetRelations: [{ assetId: "d2", relationType: "processes" }] }],
  hazards: {
    items: [hz("H1", "in_scope"), hz("H2", "in_scope"), hz("H3", "out_of_scope"), hz("H4")],
    relations: [
      { type: "contributes_to", from: "p1", to: "H1", relevance: "direct", hazardDistance: 1 },
      { type: "endangers", from: "H1", to: "u1", impact: { target: "human", severity: "fatal" } },
      { type: "contributes_to", from: "d3", to: "H3", relevance: "direct", hazardDistance: 1 },
    ] as unknown as HazardRelation[],
  },
};

const nodesOf = (s: AssetGraphSource) => [
  ...s.assets.map((a) => a.id),
  ...(s.hazards?.items ?? []).map((h) => h.id as string),
];

describe("relation filter — helpers", () => {
  const relevant = onlyRelevantHazards(source);
  const index = relationIndex(relevant);
  const show = (...ticked: ("element" | "asset" | "hazard")[]) => nodesOf(filterByRelations(relevant, index, ticked));

  it("only relevant hazards; an edge to an out-of-scope hazard is no relation", () => {
    expect(relevant.hazards!.items.map((h) => h.id)).toEqual(["H1", "H2"]);
    expect(index.assets.hazard.has("d3")).toBe(false);
  });

  it("all ticked: everything", () => {
    expect(show("element", "asset", "hazard")).toEqual(["d1", "d2", "d3", "f1", "p1", "u1", "H1", "H2"]);
  });

  it("asset unticked: assets with an asset relation and every linked hazard go", () => {
    expect(show("element", "hazard")).toEqual(["d2", "d3", "p1", "u1", "H2"]);
  });

  it("hazard unticked: assets with a hazard relation go, the hazards stay", () => {
    expect(show("element", "asset")).toEqual(["d1", "d2", "d3", "f1", "H1", "H2"]);
  });

  it("element unticked: assets on a DFD element go", () => {
    expect(show("asset", "hazard")).toEqual(["d1", "d3", "f1", "p1", "u1", "H1", "H2"]);
  });

  it("nothing ticked: only nodes without any relation", () => {
    expect(show()).toEqual(["d3", "H2"]);
  });

  it("asset only: on a DFD element or a hazard is out, asset relations stay", () => {
    expect(show("asset")).toEqual(["d1", "d3", "f1", "H1", "H2"]);
  });
});

describe("relation filter — view", () => {
  const view = () =>
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={vi.fn()} onShowElement={vi.fn()} />);
  const node = (id: string) => screen.queryByTestId(`asset-graph-node-${id}`);
  const untick = (k: string) => {
    fireEvent.click(screen.getByTestId("asset-graph-relation-filter"));
    fireEvent.click(screen.getByTestId(`asset-graph-relation-${k}`));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  };

  it("counts only the relevant hazards", () => {
    view();
    expect(screen.getByTestId("asset-graph-counts")).toHaveTextContent("2 of 2 hazards");
  });

  it("unticking all three leaves the nodes without relation; the button says filtered; Show all", () => {
    view();
    const button = screen.getByTestId("asset-graph-relation-filter");
    expect(button).toHaveTextContent("Relations");
    for (const k of ["element", "asset", "hazard"]) untick(k);
    expect(button).toHaveTextContent("Relations: filtered (1)");
    expect(node("d3")).toBeInTheDocument();
    for (const id of ["d1", "d2", "f1", "p1", "u1"]) expect(node(id)).toBeNull();
    fireEvent.click(button);
    fireEvent.click(screen.getByTestId("asset-graph-relation-all"));
    for (const id of ["d1", "d2", "d3", "f1"]) expect(node(id)).toBeInTheDocument();
  });

  it("not offered in the focus view; Reset ticks all again", () => {
    view();
    untick("asset");
    fireEvent.click(screen.getByTestId("asset-graph-view-focus"));
    expect(screen.queryByTestId("asset-graph-relation-filter")).toBeNull();
    fireEvent.click(screen.getByTestId("asset-graph-view-layers"));
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("asset-graph-relation-filter")).toHaveTextContent(/^Relations$/);
    expect(node("d1")).toBeInTheDocument();
  });
});
