// src/tests/component/asset-graph-hazards.test.tsx
//
// Asset graph design FR-V11, FR-V11c, FR-V11d, FR-V11e, G3, G9
// (doc/InProgress/DFD/asset-graph-hazards-and-node-move.md): Hazard Items in
// the graph — on with the presets "Protection targets" and "All", a toggle
// and a counter in the context bar, a read-only card with "Open in Hazard
// tab", no connection handles in edit mode, "not linked" for a hazard
// without edges. Focus view (FR-V11b): hazards as neighbours, a hazard as
// the focus, the "DFD elements" toggle in the focus view too.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import { A2AOpsProvider } from "features/dfd/contexts/a2a-ops-context";
import type { HazardItem, HazardRelation } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const source: AssetGraphSource = {
  assets: [
    { id: "f1", displayId: "FU-001", name: "Smoke detection", assetGroup: "function" },
    { id: "u1", displayId: "HU-001", name: "Occupants", assetGroup: "human" },
  ],
  relations: [],
  elements: [{ id: "p1", displayId: "P-1", name: "Detector", type: "Process", assetRelations: [{ assetId: "f1", relationType: "implements" }] }],
  hazards: {
    items: [
      {
        id: "H1",
        externalRef: "HZ-01",
        label: "Fire not detected",
        description: "Smoke is present but no alarm.",
        hazardType: "thermal",
        combinationType: "ANY",
        systemRelevance: "in_scope",
        source: "manual",
      } as HazardItem,
      { id: "H2", label: "Unlinked hazard", combinationType: "ANY", source: "manual" } as HazardItem,
    ],
    relations: [
      { type: "contributes_to", from: "f1", to: "H1", relevance: "direct", hazardDistance: 1 } as unknown as HazardRelation,
      { type: "endangers", from: "H1", to: "u1", impact: { target: "human", severity: "fatal" } } as HazardRelation,
    ],
  },
};

const choosePreset = (name: string) => {
  fireEvent.mouseDown(within(screen.getByTestId("asset-graph-preset")).getByRole("combobox"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name }));
};
// The input itself (an open menu hides the context bar from role queries).
const toggle = () => screen.getByTestId("asset-graph-show-hazards").querySelector("input") as HTMLInputElement;

afterEach(cleanup);

describe("AssetGraphView — Hazard Items (FR-V11)", () => {
  it("off in the default preset; on with All and Protection targets (G3), with a counter", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    expect(screen.queryByTestId("asset-graph-node-hz:H1")).toBeNull();
    expect(toggle().checked).toBe(false);

    choosePreset("all");
    expect(toggle().checked).toBe(true);
    expect(screen.getByTestId("asset-graph-node-hz:H1")).toBeTruthy();
    expect(screen.getByTestId("asset-graph-node-hz:H1").getAttribute("data-severity-rank")).toBe("4");
    expect(screen.getByTestId("asset-graph-edge-f1->hz:H1")).toBeTruthy();
    expect(screen.getByTestId("asset-graph-edge-hz:H1->u1").textContent).toContain("fatal");
    expect(screen.getByTestId("asset-graph-counts").textContent).toContain("2 of 2 hazards");

    choosePreset("architecture");
    expect(screen.queryByTestId("asset-graph-node-hz:H1")).toBeNull();
    choosePreset("protection");
    expect(screen.getByTestId("asset-graph-node-hz:H1")).toBeTruthy();
    // FU-001 is in a hidden layer: a stub at the hazard (FR-V11a).
    expect(screen.getByTestId("asset-graph-stub-hz:H1-function")).toBeTruthy();

    fireEvent.click(toggle());
    expect(screen.queryByTestId("asset-graph-node-hz:H1")).toBeNull();
  });

  it("a hazard without edges is marked 'not linked' (FR-V11e)", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    choosePreset("all");
    expect(screen.getByTestId("asset-graph-not-linked-hz:H2")).toBeTruthy();
    expect(screen.queryByTestId("asset-graph-not-linked-hz:H1")).toBeNull();
    fireEvent.click(screen.getByTestId("asset-graph-node-hz:H2"));
    expect(screen.getByTestId("asset-graph-inspector-not-linked")).toBeTruthy();
  });

  it("click: read-only card with causes, targets and 'Open in Hazard tab' (FR-V11d, G9)", () => {
    const onOpenHazard = vi.fn();
    const onSelectAsset = vi.fn();
    render(
      <AssetGraphView source={source} selectedAssetId={null} onSelectAsset={onSelectAsset} onOpenHazard={onOpenHazard} />,
    );
    choosePreset("all");
    fireEvent.click(screen.getByTestId("asset-graph-node-hz:H1"));
    const card = screen.getByTestId("asset-graph-inspector-hazard");
    expect(card.textContent).toContain("HZ-01 Fire not detected");
    expect(card.textContent).toContain("Smoke is present but no alarm.");
    expect(card.textContent).toContain("FU-001 Smoke detection · direct");
    expect(card.textContent).toContain("HU-001 Occupants · fatal");
    // The asset panel's selection is not touched by a hazard.
    expect(onSelectAsset).not.toHaveBeenCalled();

    fireEvent.click(within(card).getByTestId("asset-graph-open-hazard"));
    expect(onOpenHazard).toHaveBeenCalledWith("H1");

    // A cause navigates to the asset.
    fireEvent.click(within(card).getByText(/FU-001 Smoke detection/));
    expect(onSelectAsset).toHaveBeenCalledWith("f1");
  });

  it("without the callback the card has no 'Open in Hazard tab'", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    choosePreset("all");
    fireEvent.click(screen.getByTestId("asset-graph-node-hz:H1"));
    expect(screen.queryByTestId("asset-graph-open-hazard")).toBeNull();
  });

  it("edit mode: assets have handles, hazards none (read-only, G2)", () => {
    render(
      <A2AOpsProvider commit={() => {}}>
        <AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />
      </A2AOpsProvider>,
    );
    choosePreset("all");
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    expect(screen.getByTestId("asset-graph-handle-f1")).toBeTruthy();
    expect(screen.queryByTestId("asset-graph-handle-hz:H1")).toBeNull();
    // No "+" to create in the hazard lane.
    expect(screen.queryByTestId("asset-graph-create-hazards")).toBeNull();
  });

  it("no toggle when the project has no Hazard Items", () => {
    const { hazards: _drop, ...plain } = source;
    render(<AssetGraphView source={plain} selectedAssetId={null} onSelectAsset={() => {}} />);
    choosePreset("all");
    expect(screen.queryByTestId("asset-graph-show-hazards")).toBeNull();
    expect(screen.getByTestId("asset-graph-counts").textContent).not.toContain("hazards");
  });

  it("the layer menu has a Hazards entry (FR-V11c)", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    expect(screen.queryByTestId("asset-graph-node-hz:H1")).toBeNull();
    fireEvent.click(screen.getByLabelText("Layers"));
    fireEvent.click(screen.getByTestId("asset-graph-layer-hazards"));
    expect(screen.getByTestId("asset-graph-node-hz:H1")).toBeTruthy();
    expect(toggle().checked).toBe(true);
  });

  it("focus on an asset with hazard edges shows its hazards (G3, FR-V11b)", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    // Default preset: hazards off, FU-001 visible.
    fireEvent.doubleClick(screen.getByTestId("asset-graph-node-f1"));
    expect(screen.getByTestId("asset-graph-node-hz:H1")).toBeTruthy();
    expect(screen.queryByTestId("asset-graph-node-hz:H2")).toBeNull();
    expect(screen.queryByTestId("asset-graph-node-u1")).toBeNull(); // depth 2
  });

  it("a hazard can be the focus — double-click or the card's Focus button", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    choosePreset("all");
    fireEvent.doubleClick(screen.getByTestId("asset-graph-node-hz:H1"));
    expect(screen.getByText(/Focus: HZ-01 Fire not detected/)).toBeTruthy();
    expect(screen.getByTestId("asset-graph-node-f1")).toBeTruthy();
    expect(screen.getByTestId("asset-graph-node-u1")).toBeTruthy();
    expect(screen.queryByTestId("asset-graph-node-hz:H2")).toBeNull();
  });

  it("the card's Focus button focuses the hazard", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    choosePreset("all");
    fireEvent.click(screen.getByTestId("asset-graph-node-hz:H1"));
    fireEvent.click(screen.getByTestId("asset-graph-focus-hazard"));
    expect(screen.getByText(/Focus: HZ-01 Fire not detected/)).toBeTruthy();
  });

  it("DFD elements can be hidden in the focus view too", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    const anchors = () => within(screen.getByTestId("asset-graph-show-anchors")).getByRole("checkbox") as HTMLInputElement;
    expect(anchors().checked).toBe(false); // layer view: off
    fireEvent.doubleClick(screen.getByTestId("asset-graph-node-f1"));
    expect(anchors().checked).toBe(true); // focus view: on by default
    expect(screen.getByTestId("asset-graph-node-el:p1")).toBeTruthy();
    fireEvent.click(anchors());
    expect(screen.queryByTestId("asset-graph-node-el:p1")).toBeNull();
  });
});
