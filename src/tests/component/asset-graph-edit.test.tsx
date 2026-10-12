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

  it("edit mode in the layer view offers + in every visible layer, also empty ones (FR-E2)", () => {
    const onCreateAsset = vi.fn();
    const onSelectAsset = vi.fn();
    const commit = vi.fn();
    const { rerender } = render(
      <A2AOpsProvider commit={commit}>
        <AssetGraphView source={source} selectedAssetId={null} onSelectAsset={onSelectAsset} onCreateAsset={onCreateAsset} />
      </A2AOpsProvider>,
    );
    expect(screen.queryByTestId("asset-graph-create-data")).toBeNull(); // view mode
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    // architecture preset: data, function, infrastructure have assets; system is empty
    expect(screen.getByTestId("asset-graph-create-system")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("asset-graph-create-data"));
    expect(onCreateAsset).toHaveBeenCalledWith("data");

    // The new asset arrives: it is selected (to be named) and sits in the data lane
    // at the end, next to the existing data asset.
    const grown: AssetGraphSource = {
      ...source,
      assets: [...source.assets, { id: "d9", displayId: "DA-002", name: "", assetGroup: "data" }],
    };
    rerender(
      <A2AOpsProvider commit={commit}>
        <AssetGraphView source={grown} selectedAssetId={null} onSelectAsset={onSelectAsset} onCreateAsset={onCreateAsset} />
      </A2AOpsProvider>,
    );
    expect(onSelectAsset).toHaveBeenLastCalledWith("d9");
    const pos = (id: string) =>
      screen.getByTestId(`asset-graph-node-${id}`).getAttribute("transform")!.match(/translate\(([-\d.]+),([-\d.]+)\)/)!.slice(1).map(Number);
    const [x1, y1] = pos("d1");
    const [x9, y9] = pos("d9");
    expect(y9).toBe(y1);
    expect(x9).toBeGreaterThan(x1);
    expect(screen.getByTestId("asset-graph-inspector-asset")).toHaveTextContent("DA-002");
  });

  it("deleting an asset asks first, with its usage, then uses the asset panel's path (FR-E8)", () => {
    const onDeleteAsset = vi.fn();
    const assetUsage = vi.fn(() => ({ dfdRelations: 2, assetToAssetRelations: 1, hazardRelations: 0, blockingAttackTrees: [] }));
    render(
      <A2AOpsProvider commit={vi.fn()}>
        <AssetGraphView
          source={source}
          selectedAssetId={null}
          onSelectAsset={() => {}}
          onDeleteAsset={onDeleteAsset}
          assetUsage={assetUsage as never}
        />
      </A2AOpsProvider>,
    );
    fireEvent.click(screen.getByTestId("asset-graph-node-d1"));
    expect(screen.queryByTestId("asset-graph-delete-asset")).toBeNull(); // view mode
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    fireEvent.click(screen.getByTestId("asset-graph-delete-asset"));
    expect(assetUsage).toHaveBeenCalledWith("d1");
    expect(onDeleteAsset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteAsset).toHaveBeenCalledWith("d1");
  });

  it("editing a link's attributes sends one update operation (FR-E6)", () => {
    const commit = renderEditable();
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    fireEvent.click(screen.getByTestId("asset-graph-edge-r1"));
    // required_by has no step order — the field is not offered.
    expect(screen.queryByTestId("asset-graph-link-step")).toBeNull();
    const save = screen.getByTestId("asset-graph-link-save");
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByTestId("asset-graph-link-rationale"), { target: { value: "E-Stop needs the value" } });
    fireEvent.click(save);
    expect(commit).toHaveBeenCalledWith([
      { kind: "update", relationId: "r1", attributes: { rationale: "E-Stop needs the value" } },
    ]);
  });

  it("step order only for step types (invokes): invalid input blocks saving", () => {
    const src: AssetGraphSource = {
      assets: [
        { id: "p1", displayId: "PR-001", name: "Update", assetGroup: "process" },
        { id: "f1", displayId: "FU-001", name: "Verify", assetGroup: "function" },
      ],
      relations: [{ id: "r9", sourceAssetId: "p1", targetAssetId: "f1", relationType: "invokes" } as A2ARelation],
      elements: [],
    };
    const commit = vi.fn();
    render(
      <A2AOpsProvider commit={commit}>
        <AssetGraphView source={src} selectedAssetId={null} onSelectAsset={() => {}} focusRequest={{ assetId: "f1" }} />
      </A2AOpsProvider>,
    );
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    fireEvent.click(screen.getByTestId("asset-graph-edge-r9"));
    const step = screen.getByTestId("asset-graph-link-step");
    fireEvent.change(step, { target: { value: "x" } });
    expect(screen.getByTestId("asset-graph-link-save")).toBeDisabled();
    fireEvent.change(step, { target: { value: "2" } });
    fireEvent.click(screen.getByTestId("asset-graph-link-save"));
    expect(commit).toHaveBeenCalledWith([{ kind: "update", relationId: "r9", attributes: { stepOrder: 2 } }]);
  });

  it("asset properties in the card use the shared asset form (D9)", () => {
    const onChange = vi.fn();
    const dfdAsset = (id: string, displayId: string, group: string, name: string) =>
      ({ id, displayId, name, assetGroup: group, linkedElements: [], properties: {} }) as never;
    render(
      <A2AOpsProvider commit={vi.fn()}>
        <AssetGraphView
          source={source}
          selectedAssetId={null}
          onSelectAsset={() => {}}
          assetEditing={{
            assets: [dfdAsset("d1", "DA-001", "data", "Measure Data"), dfdAsset("f1", "FU-001", "function", "E-Stop")],
            elements: [],
            connections: [],
            onChange,
          }}
        />
      </A2AOpsProvider>,
    );
    fireEvent.click(screen.getByTestId("asset-graph-node-d1"));
    expect(screen.queryByTestId("asset-graph-properties")).toBeNull(); // view mode
    fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
    fireEvent.click(screen.getByTestId("asset-graph-node-d1"));
    fireEvent.click(screen.getByText("Properties"));
    const name = document.getElementById("asset-name-input") as HTMLInputElement;
    expect(name.value).toBe("Measure Data");
    fireEvent.change(name, { target: { value: "Measured speed" } });
    fireEvent.blur(name);
    expect(onChange).toHaveBeenCalledWith("d1", { name: "Measured speed" });
  });

  it("in view mode the link card stays read-only", () => {
    renderEditable();
    fireEvent.click(screen.getByTestId("asset-graph-edge-r1"));
    expect(screen.queryByTestId("asset-graph-link-form")).toBeNull();
  });
});
