// src/tests/component/asset-graph-view.test.tsx
//
// Phase 2: the asset graph view renders what the preparation returns and
// shares the selection with the asset panel (FR-V8). Read-only.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import type { A2ARelation } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const text = (o?.defaultValue as string | undefined) ?? k;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? ""));
    },
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const rel = (id: string, s: string, t: string, type: string, stepOrder?: number) =>
  ({ id, sourceAssetId: s, targetAssetId: t, relationType: type, ...(stepOrder ? { stepOrder } : {}) }) as A2ARelation;

const source: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
    { id: "p1", displayId: "PR-001", name: "Shutdown", assetGroup: "process" },
  ],
  relations: [rel("r1", "d1", "f1", "required_by"), rel("r2", "p1", "f1", "invokes", 1)],
  elements: [{ id: "pe", displayId: "P-1", type: "Process", assetRelations: [{ assetId: "f1", relationType: "implements" }] }],
};

function view(props: Partial<React.ComponentProps<typeof AssetGraphView>> = {}) {
  const onSelectAsset = vi.fn();
  const onShowElement = vi.fn();
  render(
    <AssetGraphView
      source={source}
      selectedAssetId={null}
      onSelectAsset={onSelectAsset}
      onShowElement={onShowElement}
      {...props}
    />,
  );
  return { onSelectAsset, onShowElement };
}

describe("AssetGraphView", () => {
  it("starts in the layer view with the architecture preset; process is a stub", () => {
    view();
    expect(screen.getByTestId("asset-graph-node-d1")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-node-f1")).toBeInTheDocument();
    expect(screen.queryByTestId("asset-graph-node-p1")).toBeNull();
    expect(screen.getByTestId("asset-graph-edge-r1")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-stub-f1-process")).toHaveTextContent("1 → process");
    expect(screen.getByTestId("asset-graph-counts")).toHaveTextContent(
      "2 of 3 assets visible · 1 in hidden layers",
    );
  });

  it("clicking a stub shows its layer (FR-V4)", () => {
    view();
    fireEvent.click(screen.getByTestId("asset-graph-stub-f1-process"));
    expect(screen.getByTestId("asset-graph-node-p1")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-edge-r2")).toHaveTextContent("1");
  });

  it("clicking a node selects the asset in the panel (FR-V8)", () => {
    const { onSelectAsset } = view();
    fireEvent.click(screen.getByTestId("asset-graph-node-d1"));
    expect(onSelectAsset).toHaveBeenCalledWith("d1");
  });

  it("double-click focuses the asset; the focus view shows element anchors", () => {
    const { onShowElement } = view();
    fireEvent.doubleClick(screen.getByTestId("asset-graph-node-f1"));
    expect(screen.getByTestId("asset-graph-node-el:pe")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("asset-graph-node-el:pe"));
    expect(onShowElement).toHaveBeenCalledWith("pe");
  });

  it("a focus request from outside opens the focus view (FR-V13)", () => {
    view({ focusRequest: { assetId: "d1" } }); // all layers
    expect(screen.getByTestId("asset-graph-node-d1")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-node-f1")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-counts")).toHaveTextContent("2 of 3 assets visible · 0 in hidden layers · 1 outside focus");
  });
});
