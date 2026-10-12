// src/tests/component/asset-graph-view.test.tsx
//
// Phase 2: the asset graph view renders what the preparation returns and
// shares the selection with the asset panel (FR-V8). Read-only.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import type { A2ARelation } from "shared";

// Element → asset labels live under assets.relations.element.<group>.<type>.
const DICT: Record<string, string> = {
  "assets.relations.element.function.implements": "implemented by element",
};
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const text = DICT[k] ?? (o?.defaultValue as string | undefined) ?? k;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? ""));
    },
    i18n: {
      language: "en",
      exists: (k: string) => k in DICT || k.startsWith("assets.relations.a2a."),
    },
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

  it("type filter hides a relation type and the context bar says so (FR-V10)", () => {
    view();
    fireEvent.click(screen.getByTestId("asset-graph-type-filter"));
    fireEvent.click(screen.getByTestId("asset-graph-type-required_by"));
    expect(screen.queryByTestId("asset-graph-edge-r1")).toBeNull();
    expect(screen.getByTestId("asset-graph-counts")).toHaveTextContent("1 links filtered");
    fireEvent.click(screen.getByTestId("asset-graph-filter-chip").querySelector("svg")!);
    expect(screen.getByTestId("asset-graph-edge-r1")).toBeInTheDocument();
  });

  it("search: a visible hit is selected; a hit in a hidden layer says why and offers the layer", () => {
    const { onSelectAsset } = view();
    const input = screen.getByTestId("asset-graph-search");
    fireEvent.change(input, { target: { value: "FU-001" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelectAsset).toHaveBeenCalledWith("f1");

    fireEvent.change(input, { target: { value: "shutdown" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const notice = screen.getByTestId("asset-graph-search-notice");
    expect(notice).toHaveTextContent("PR-001 Shutdown is in the hidden layer process.");
    fireEvent.click(screen.getByRole("button", { name: "Show layer process" }));
    expect(screen.getByTestId("asset-graph-node-p1")).toBeInTheDocument();
    expect(onSelectAsset).toHaveBeenLastCalledWith("p1");
  });

  it("search without a match says so", () => {
    view();
    const input = screen.getByTestId("asset-graph-search");
    fireEvent.change(input, { target: { value: "nothing" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("asset-graph-search-notice")).toHaveTextContent('No asset matches "nothing".');
  });

  it("clicking a node opens the detail card with relations grouped by type (FR-V8)", () => {
    const { onSelectAsset } = view({ selectedAssetId: "f1", onShowInTable: vi.fn() });
    fireEvent.click(screen.getByTestId("asset-graph-node-f1"));
    const card = screen.getByTestId("asset-graph-inspector-asset");
    expect(card).toHaveTextContent("FU-001 E-Stop");
    expect(card).toHaveTextContent("requires");
    expect(card).toHaveTextContent("DA-001 Measure Data");
    expect(card).toHaveTextContent("[1] PR-001 Shutdown");
    expect(card).toHaveTextContent("implemented by element");
    // Going to a related asset in a hidden layer shows that layer.
    fireEvent.click(screen.getByRole("button", { name: "[1] PR-001 Shutdown" }));
    expect(onSelectAsset).toHaveBeenLastCalledWith("p1");
    expect(screen.getByTestId("asset-graph-node-p1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show in table" })).toBeInTheDocument();
  });

  it("clicking a link shows its details", () => {
    view();
    fireEvent.click(screen.getByTestId("asset-graph-stub-f1-process"));
    fireEvent.click(screen.getByTestId("asset-graph-edge-r2"));
    const card = screen.getByTestId("asset-graph-inspector-edge");
    expect(card).toHaveTextContent("PR-001 Shutdown");
    expect(card).toHaveTextContent("(invokes)");
    expect(card).toHaveTextContent("FU-001 E-Stop");
    expect(card).toHaveTextContent("Step1");
  });

  it("an invalid link gets a symbol on the link and its source node (UX-4 stage 4)", () => {
    const invalid: AssetGraphSource = {
      ...source,
      assets: source.assets.map((a) => (a.id === "d1" ? { ...a, assetGroup: "human" } : a)),
    };
    render(
      <AssetGraphView
        source={invalid}
        selectedAssetId={null}
        onSelectAsset={() => {}}
        focusRequest={{ assetId: "f1" }}
      />,
    );
    expect(screen.getByTestId("asset-graph-finding-d1")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-edge-r1")).toHaveTextContent("⚠");
    fireEvent.click(screen.getByTestId("asset-graph-edge-r1"));
    expect(screen.getByTestId("asset-graph-inspector-finding")).toBeInTheDocument();
  });

  it("an asset that appears while the view is open pulses (UX-4 stage 2)", () => {
    const { rerender } = render(
      <AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} />,
    );
    expect(screen.queryByTestId("asset-graph-fresh-d1")).toBeNull();
    const grown: AssetGraphSource = {
      ...source,
      assets: [...source.assets, { id: "d9", displayId: "DA-009", name: "New", assetGroup: "data" }],
    };
    rerender(<AssetGraphView source={grown} selectedAssetId={null} onSelectAsset={() => {}} />);
    expect(screen.getByTestId("asset-graph-fresh-d9")).toBeInTheDocument();
    expect(screen.queryByTestId("asset-graph-fresh-d1")).toBeNull();
  });

  it("DFD element links use the element relation label of the target's group", () => {
    view({ focusRequest: { assetId: "f1" } });
    expect(screen.getByTestId("asset-graph-edge-el:pe->f1:implements")).toHaveTextContent(
      "implemented by element",
    );
  });

  it("the detail card opens on click even without a panel selection, clear of the side panel", () => {
    view({ selectedAssetId: null, rightInset: 520 });
    fireEvent.click(screen.getByTestId("asset-graph-node-d1"));
    expect(screen.getByTestId("asset-graph-inspector-asset")).toHaveTextContent("DA-001 Measure Data");
    expect(screen.getByTestId("asset-graph-inspector")).toHaveStyle({ right: "532px" });
  });

  it("a focus request opens the asset's card — the card is the place to edit in the graph", () => {
    view({ focusRequest: { assetId: "d1" } });
    expect(screen.getByTestId("asset-graph-inspector-asset")).toHaveTextContent("DA-001 Measure Data");
  });
});
