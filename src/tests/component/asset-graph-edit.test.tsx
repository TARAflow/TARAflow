// src/tests/component/asset-graph-edit.test.tsx
//
// Phase 3: edit mode of the asset graph. Connections are dragged from a
// node's handle; targets are classified while dragging; the chooser offers
// only allowed types; the result goes through the single write path
// (A2AOpsContext → commitA2AOps).

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import { A2AOpsProvider } from "features/dfd/contexts/a2a-ops-context";
import { classifyA2ATargetGroup, type A2ARelation } from "shared";

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
    { id: "i1", displayId: "IN-001", name: "Cabinet", assetGroup: "infrastructure" },
  ],
  relations: [{ id: "r1", sourceAssetId: "d1", targetAssetId: "f1", relationType: "required_by" } as A2ARelation],
  elements: [],
};

function renderEditable(commit = vi.fn()) {
  render(
    <A2AOpsProvider commit={commit}>
      <AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />
    </A2AOpsProvider>,
  );
  return commit;
}

describe("AssetGraphView — edit mode", () => {
  it("is off by default; without a write path there is no edit switch (FR-E1)", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />);
    expect(screen.queryByTestId("asset-graph-mode-edit")).toBeNull();
    cleanup();
    renderEditable();
    expect(screen.getByTestId("asset-graph-canvas-box")).toHaveAttribute("data-mode", "view");
    expect(screen.queryByTestId("asset-graph-handle-d1")).toBeNull();
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    expect(screen.getByTestId("asset-graph-canvas-box")).toHaveAttribute("data-mode", "edit");
    expect(screen.getByTestId("asset-graph-handle-d1")).toBeInTheDocument();
  });

  it("drag → targets classified → chooser → add operation (FR-E4)", () => {
    const commit = renderEditable();
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    fireEvent.pointerDown(screen.getByTestId("asset-graph-handle-d1"));
    expect(screen.getByTestId("asset-graph-drag-line")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-node-f1")).toHaveAttribute("data-target-class", "valid");

    fireEvent.pointerUp(screen.getByTestId("asset-graph-node-f1"));
    // The existing type is offered but disabled.
    expect(screen.getByTestId("asset-graph-connect-option-required_by")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId("asset-graph-connect-option-configures"));
    expect(commit).toHaveBeenCalledWith([
      {
        kind: "add",
        relation: { sourceAssetId: "d1", targetAssetId: "f1", relationType: "configures" },
      },
    ]);
  });

  it("dropping on an asset without any allowed direction explains why (FR-E5)", () => {
    const groups = ["data", "function", "system", "infrastructure"] as const;
    let pair: [string, string] | null = null;
    for (const a of groups) for (const b of groups) {
      if (!pair && a !== b && classifyA2ATargetGroup(a, b).targetClass === "invalid") pair = [a, b];
    }
    expect(pair, "an invalid pair among the architecture layers").not.toBeNull();
    const src: AssetGraphSource = {
      assets: [
        { id: "x", displayId: "X-1", name: "X", assetGroup: pair![0] },
        { id: "y", displayId: "Y-1", name: "Y", assetGroup: pair![1] },
      ],
      relations: [],
      elements: [],
    };
    const commit = vi.fn();
    render(
      <A2AOpsProvider commit={commit}>
        <AssetGraphView source={src} selectedAssetId={null} onSelectAsset={() => {}} />
      </A2AOpsProvider>,
    );
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    fireEvent.pointerDown(screen.getByTestId("asset-graph-handle-x"));
    expect(screen.getByTestId("asset-graph-node-y")).toHaveAttribute("data-target-class", "invalid");
    fireEvent.pointerUp(screen.getByTestId("asset-graph-node-y"));
    expect(screen.getByTestId("asset-graph-connect-notice")).toHaveTextContent("No relation is allowed between X-1 and Y-1");
    expect(screen.queryByTestId("asset-graph-connect-chooser")).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });

  it("deleting a link in edit mode sends a remove operation (FR-E8)", () => {
    const commit = renderEditable();
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    fireEvent.click(screen.getByTestId("asset-graph-edge-r1"));
    fireEvent.click(screen.getByTestId("asset-graph-delete-link"));
    expect(commit).toHaveBeenCalledWith([{ kind: "remove", relationId: "r1" }]);
  });
});
