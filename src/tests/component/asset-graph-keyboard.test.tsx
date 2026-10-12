// src/tests/component/asset-graph-keyboard.test.tsx
//
// Phase 3, NFR-4: keyboard operation of the asset graph. Nodes are in the tab
// order and selected on focus; arrows move to the nearest node; Enter
// focuses; Delete removes the focused link or asset (edit mode only); Esc
// closes the card and cancels a running drag.

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import { A2AOpsProvider } from "features/dfd/contexts/a2a-ops-context";
import type { A2ARelation } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const source: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
  ],
  relations: [{ id: "r1", sourceAssetId: "d1", targetAssetId: "f1", relationType: "required_by" } as A2ARelation],
  elements: [],
};

function renderGraph({ edit = false } = {}) {
  const commit = vi.fn();
  const onSelectAsset = vi.fn();
  const onDeleteAsset = vi.fn();
  render(
    <A2AOpsProvider commit={commit}>
      <AssetGraphView source={source} selectedAssetId={null} onSelectAsset={onSelectAsset} onDeleteAsset={onDeleteAsset} />
    </A2AOpsProvider>,
  );
  if (edit) fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
  return { commit, onSelectAsset, onDeleteAsset };
}

const node = (id: string) => screen.getByTestId(`asset-graph-node-${id}`);
const focus = (el: Element) => act(() => (el as SVGElement).focus());

describe("AssetGraphView — keyboard (NFR-4)", () => {
  it("nodes are in the tab order; focusing one selects it and shows the focus ring", () => {
    const { onSelectAsset } = renderGraph();
    expect(node("d1")).toHaveAttribute("tabindex", "0");
    focus(node("d1"));
    expect(onSelectAsset).toHaveBeenLastCalledWith("d1");
    expect(screen.getByTestId("asset-graph-focus-d1")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-inspector-asset")).toHaveTextContent("DA-001 Measure Data");
  });

  it("arrow keys move to the nearest node in that direction; from the canvas they start at the first", () => {
    const { onSelectAsset } = renderGraph();
    fireEvent.keyDown(screen.getByTestId("asset-graph-canvas"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(node("d1"));
    fireEvent.keyDown(node("d1"), { key: "ArrowUp" }); // function lane is above data
    expect(document.activeElement).toBe(node("f1"));
    expect(onSelectAsset).toHaveBeenLastCalledWith("f1");
    fireEvent.keyDown(node("f1"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(node("d1"));
  });

  it("Enter focuses the asset", () => {
    renderGraph();
    focus(node("d1"));
    fireEvent.keyDown(node("d1"), { key: "Enter" });
    expect(screen.getByTestId("asset-graph-view-focus")).toHaveAttribute("aria-pressed", "true");
  });

  it("Esc closes the card", () => {
    renderGraph();
    focus(node("d1"));
    expect(screen.getByTestId("asset-graph-inspector")).toBeInTheDocument();
    fireEvent.keyDown(node("d1"), { key: "Escape" });
    expect(screen.queryByTestId("asset-graph-inspector")).toBeNull();
  });

  it("Delete does nothing in view mode", () => {
    const { commit } = renderGraph();
    fireEvent.click(screen.getByTestId("asset-graph-edge-r1"));
    fireEvent.keyDown(screen.getByTestId("asset-graph-edge-r1"), { key: "Delete" });
    focus(node("d1"));
    fireEvent.keyDown(node("d1"), { key: "Delete" });
    expect(commit).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("edit mode: Delete on a link removes it; on an asset it asks first", () => {
    const { commit } = renderGraph({ edit: true });
    fireEvent.click(screen.getByTestId("asset-graph-edge-r1"));
    fireEvent.keyDown(screen.getByTestId("asset-graph-edge-r1"), { key: "Delete" });
    expect(commit).toHaveBeenCalledWith([
      { kind: "remove", relationId: "r1" },
    ]);
    focus(node("f1"));
    fireEvent.keyDown(node("f1"), { key: "Delete" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Esc cancels a running drag", () => {
    renderGraph({ edit: true });
    fireEvent.pointerDown(screen.getByTestId("asset-graph-handle-d1"));
    expect(screen.getByTestId("asset-graph-drag-line")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("asset-graph-drag-line")).toBeNull();
  });

  it("typing in the search field does not move or delete anything", () => {
    const { onSelectAsset } = renderGraph({ edit: true });
    const input = screen.getByTestId("asset-graph-search");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Delete" });
    expect(onSelectAsset).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
