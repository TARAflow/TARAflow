// src/tests/component/asset-graph-view.unlinked.test.tsx
//
// User 2026-11-06: a relation filter in the asset graph's layer view — the
// work lists of assets still to be linked: without an asset relation, on a
// DFD element but without an asset relation, without a hazard relation,
// without any relation (asset, hazard, DFD element);
// combinable with the layer presets.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import { assetIdsByRelationFilter } from "features/dfd/asset-graph/asset-graph-query";
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

// d1 – f1 linked; d2 only on a DFD element; d3 nothing; d4 only a relation to
// a deleted asset; p1 contributes to a hazard; h1 (human) endangered.
const hazards = {
  items: [{ id: "H1", label: "Fire", combinationType: "ANY", source: "manual" } as unknown as HazardItem],
  relations: [
    { type: "contributes_to", from: "p1", to: "H1", relevance: "direct", hazardDistance: 1 },
    { type: "endangers", from: "H1", to: "h1", impact: { target: "human", severity: "fatal" } },
  ] as unknown as HazardRelation[],
};
const base: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "d2", displayId: "DA-002", name: "Calibration", assetGroup: "data" },
    { id: "d3", displayId: "DA-003", name: "Log", assetGroup: "data" },
    { id: "d4", displayId: "DA-004", name: "Orphan link", assetGroup: "data" },
    { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
    { id: "p1", displayId: "PR-001", name: "Shutdown", assetGroup: "process" },
    { id: "h1", displayId: "HU-001", name: "Operator", assetGroup: "human" },
  ],
  relations: [rel("r1", "d1", "f1"), rel("r2", "d4", "gone")],
  elements: [{ id: "pe", displayId: "P-1", type: "Process", assetRelations: [{ assetId: "d2", relationType: "processes" }] }],
};
const withHazards: AssetGraphSource = { ...base, hazards };

const view = (source: AssetGraphSource) =>
  render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={vi.fn()} onShowElement={vi.fn()} />);
const node = (id: string) => screen.queryByTestId(`asset-graph-node-${id}`);
const open = () => fireEvent.mouseDown(within(screen.getByTestId("asset-graph-relation-filter")).getByRole("combobox"));
const choose = (f: string) => {
  open();
  fireEvent.click(screen.getByTestId(`asset-graph-relation-filter-${f}`));
};
const shown = (ids: string[]) => ids.filter((id) => node(id));

describe("asset graph — relation filter", () => {
  it("helper: the assets each filter keeps", () => {
    const by = assetIdsByRelationFilter(withHazards);
    expect([...by.noAsset].sort()).toEqual(["d2", "d3", "d4", "h1", "p1"]);
    // On a DFD element, but on no other asset (d1 is on none and linked to f1).
    expect([...by.elementNoAsset].sort()).toEqual(["d2"]);
    expect([...by.noHazard].sort()).toEqual(["d1", "d2", "d3", "d4", "f1"]);
    expect([...by.none].sort()).toEqual(["d3", "d4"]);
  });

  it("offers all four with their counts; each shows only its assets; All shows everything", () => {
    view(withHazards);
    open();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All assets",
      "Without asset relation (5)",
      "DFD element relation, no asset relation (1)",
      "Without hazard relation (5)",
      "Without any relation (2)",
    ]);
    fireEvent.click(screen.getByTestId("asset-graph-relation-filter-none"));
    const ids = ["d1", "d2", "d3", "d4", "f1", "p1", "h1"];
    expect(shown(ids)).toEqual(["d3", "d4"]);
    choose("elementNoAsset");
    expect(shown(ids)).toEqual(["d2"]);
    choose("noHazard");
    expect(shown(ids)).toEqual(["d1", "d2", "d3", "d4", "f1"]);
    choose("noAsset");
    expect(shown(ids)).toEqual(["d2", "d3", "d4", "p1", "h1"]);
    choose("all");
    expect(shown(ids)).toEqual(ids);
  });

  it("combines with a preset: counts and assets of the architecture layers only", () => {
    view(withHazards);
    fireEvent.mouseDown(within(screen.getByTestId("asset-graph-preset")).getByRole("combobox"));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "architecture" }));
    open();
    expect(screen.getByTestId("asset-graph-relation-filter-noAsset")).toHaveTextContent("(3)");
    fireEvent.click(screen.getByTestId("asset-graph-relation-filter-noAsset"));
    expect(shown(["d2", "d3", "d4", "p1", "d1"])).toEqual(["d2", "d3", "d4"]);
  });

  it("without hazards in the project: no hazard entry; 'any' checks asset and DFD links", () => {
    view(base);
    open();
    expect(screen.queryByTestId("asset-graph-relation-filter-noHazard")).toBeNull();
    expect(screen.getByTestId("asset-graph-relation-filter-none")).toHaveTextContent("(4)"); // d3, d4, p1, h1
  });

  it("not offered in the focus view; Reset sets All", () => {
    view(withHazards);
    choose("none");
    fireEvent.click(screen.getByTestId("asset-graph-view-focus"));
    expect(screen.queryByTestId("asset-graph-relation-filter")).toBeNull();
    fireEvent.click(screen.getByTestId("asset-graph-view-layers"));
    fireEvent.click(screen.getByText("Reset"));
    expect(node("d1")).toBeInTheDocument();
    open();
    expect(screen.getByTestId("asset-graph-relation-filter-all")).toHaveAttribute("aria-selected", "true");
  });
});
