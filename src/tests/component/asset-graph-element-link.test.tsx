// src/tests/component/asset-graph-element-link.test.tsx
//
// Phase 3, FR-E7: DFD element → asset relations in the graph's edit mode.
// From an element anchor's handle (targets classified by getAllowedRelations)
// or from the asset card ("Link to element"); edited in the side panel's
// per-asset dialog; written through the DFD tab's callback (AR-6).

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource, type ElementLinking } from "features/dfd/asset-graph";
import { A2AOpsProvider } from "features/dfd/contexts/a2a-ops-context";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

// ChipBoundary: data (reads, stores, modifies) and function (implements,
// depends_on) allowed, infrastructure not. TrustBoundary: nothing.
const cbRelations = [{ assetId: "f1", assetGroup: "function", relationType: "implements" }];
const source: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
    { id: "i1", displayId: "IN-001", name: "Cabinet", assetGroup: "infrastructure" },
  ],
  relations: [],
  elements: [{ id: "cb", displayId: "CB-1", name: "MCU", type: "ChipBoundary", assetRelations: cbRelations }],
};

function renderGraph(edit = true) {
  const onChange = vi.fn();
  const linking: ElementLinking = {
    elements: [
      { id: "cb", displayId: "CB-1", name: "MCU", type: "ChipBoundary", assetRelations: cbRelations },
      { id: "tb", displayId: "TB-1", name: "Zone", type: "TrustBoundary", assetRelations: [] },
    ] as never,
    connections: [],
    onChange,
  };
  render(
    <A2AOpsProvider commit={vi.fn()}>
      <AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} elementLinking={linking} />
    </A2AOpsProvider>,
  );
  fireEvent.click(screen.getByLabelText("DFD elements"));
  if (edit) fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
  return onChange;
}

describe("AssetGraphView — DFD element relations (FR-E7)", () => {
  it("in view mode an anchor has no handle and the card offers no linking", () => {
    renderGraph(false);
    expect(screen.getByTestId("asset-graph-node-el:cb")).toBeInTheDocument();
    expect(screen.queryByTestId("asset-graph-handle-el:cb")).toBeNull();
    fireEvent.click(screen.getByTestId("asset-graph-node-d1"));
    expect(screen.queryByTestId("asset-graph-link-element")).toBeNull();
  });

  it("dragging from an anchor marks targets by the element rules; dropping opens the dialog with only allowed types", () => {
    const onChange = renderGraph();
    fireEvent.pointerDown(screen.getByTestId("asset-graph-handle-el:cb"));
    expect(screen.getByTestId("asset-graph-node-d1")).toHaveAttribute("data-target-class", "valid");
    expect(screen.getByTestId("asset-graph-node-i1")).toHaveAttribute("data-target-class", "invalid");

    fireEvent.pointerUp(screen.getByTestId("asset-graph-node-d1"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("DA-001");
    for (const type of ["reads", "stores", "modifies"]) expect(within(dialog).getByText(type)).toBeInTheDocument();
    expect(within(dialog).queryByText("creates")).toBeNull();
    expect(within(dialog).queryByText("is_an")).toBeNull();

    fireEvent.click(within(dialog).getByText("reads"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [elementId, relations] = onChange.mock.calls[0];
    expect(elementId).toBe("cb");
    expect(relations).toEqual([
      cbRelations[0],
      expect.objectContaining({ assetId: "d1", assetGroup: "data", relationType: "reads" }),
    ]);
  });

  it("dropping on an asset the element may not relate to explains why and writes nothing", () => {
    const onChange = renderGraph();
    fireEvent.pointerDown(screen.getByTestId("asset-graph-handle-el:cb"));
    fireEvent.pointerUp(screen.getByTestId("asset-graph-node-i1"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("asset-graph-connect-notice")).toHaveTextContent(
      "A ChipBoundary cannot relate to a infrastructure asset (CB-1 – IN-001).",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("“Link to element” in the asset card offers only elements the rules allow", () => {
    renderGraph();
    fireEvent.click(screen.getByTestId("asset-graph-node-d1"));
    fireEvent.click(screen.getByTestId("asset-graph-link-element"));
    const picker = screen.getByTestId("asset-graph-element-picker");
    expect(within(picker).getByTestId("asset-graph-element-option-cb")).toBeInTheDocument();
    expect(within(picker).queryByTestId("asset-graph-element-option-tb")).toBeNull();
    fireEvent.change(within(picker).getByTestId("asset-graph-element-search"), { target: { value: "nothing" } });
    expect(within(picker).queryByTestId("asset-graph-element-option-cb")).toBeNull();
    fireEvent.change(within(picker).getByTestId("asset-graph-element-search"), { target: { value: "mcu" } });
    fireEvent.click(within(picker).getByTestId("asset-graph-element-option-cb"));
    expect(within(screen.getByRole("dialog")).getByText("stores")).toBeInTheDocument();
  });

  it("the anchor link card edits or removes the relation", () => {
    const onChange = renderGraph();
    fireEvent.click(screen.getByTestId("asset-graph-edge-el:cb->f1:implements"));
    fireEvent.click(screen.getByTestId("asset-graph-edit-element-link"));
    expect(screen.getByRole("dialog")).toHaveTextContent("FU-001");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByTestId("asset-graph-edge-el:cb->f1:implements"));
    fireEvent.click(screen.getByTestId("asset-graph-remove-element-link"));
    expect(onChange).toHaveBeenCalledWith("cb", []);
  });
});
