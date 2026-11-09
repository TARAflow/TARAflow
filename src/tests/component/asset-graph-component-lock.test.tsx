// Multi-project TARA phase 4a-3 (user 2026-11-09): in the asset graph's edit
// mode what an imported component owns is locked — its links (between two
// of its assets) cannot be changed or deleted, its assets not deleted or
// edited; a new link needs at least one asset of the machine.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    { id: "c-d1", displayId: "SD1:DA-001", name: "Sensor frames", assetGroup: "data" },
    { id: "c-f1", displayId: "SD1:FU-001", name: "Alarm", assetGroup: "function" },
    { id: "m-f1", displayId: "FU-001", name: "Quality log", assetGroup: "function" },
  ],
  relations: [{ id: "r-c", sourceAssetId: "c-d1", targetAssetId: "c-f1", relationType: "required_by" } as A2ARelation],
  elements: [],
};
const lockedBy = (id: string) => (id.startsWith("c-") ? "SD1 · Smoke Detector" : undefined);

function renderEditable(commit = vi.fn(), onDeleteAsset = vi.fn()) {
  render(
    <A2AOpsProvider commit={commit}>
      <AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} lockedBy={lockedBy}
        onDeleteAsset={onDeleteAsset} assetUsage={(() => ({ dfdRelations: 0, assetToAssetRelations: 0, hazardRelations: 0, blockingAttackTrees: [] })) as never} />
    </A2AOpsProvider>,
  );
  fireEvent.click(screen.getByTestId("asset-graph-mode-edit"));
  return { commit, onDeleteAsset };
}

describe("asset graph — a component's part locked (phase 4a-3)", () => {
  it("the component's link: marked, no delete; Delete key does nothing", () => {
    const { commit } = renderEditable();
    fireEvent.click(screen.getByTestId("asset-graph-edge-r-c"));
    expect(screen.getByTestId("asset-graph-locked").textContent).toBe("Component SD1");
    expect(screen.queryByTestId("asset-graph-delete-link")).toBeNull();
    fireEvent.keyDown(screen.getByTestId("asset-graph-edge-r-c"), { key: "Delete" });
    expect(commit).not.toHaveBeenCalled();
  });

  it("a component's asset: marked, no delete, no properties form", () => {
    const { onDeleteAsset } = renderEditable();
    fireEvent.click(screen.getByTestId("asset-graph-node-c-d1"));
    expect(screen.getByTestId("asset-graph-locked")).toBeTruthy();
    expect(screen.queryByTestId("asset-graph-delete-asset")).toBeNull();
    expect(screen.queryByTestId("asset-graph-properties")).toBeNull();
    fireEvent.keyDown(screen.getByTestId("asset-graph-node-c-d1"), { key: "Delete" });
    expect(onDeleteAsset).not.toHaveBeenCalled();
    // the machine's own asset: as before
    fireEvent.click(screen.getByTestId("asset-graph-node-m-f1"));
    expect(screen.queryByTestId("asset-graph-locked")).toBeNull();
    expect(screen.getByTestId("asset-graph-delete-asset")).toBeTruthy();
  });

  it("a new link between two component assets is refused; to a machine asset it is offered", () => {
    renderEditable();
    fireEvent.pointerDown(screen.getByTestId("asset-graph-handle-c-d1"));
    fireEvent.pointerUp(screen.getByTestId("asset-graph-node-c-f1"));
    expect(screen.getByTestId("asset-graph-connect-notice").textContent).toContain("Belongs to SD1 · Smoke Detector");
    fireEvent.pointerDown(screen.getByTestId("asset-graph-handle-c-d1"));
    fireEvent.pointerUp(screen.getByTestId("asset-graph-node-m-f1"));
    expect(screen.getAllByTestId(/^asset-graph-connect-option-/).length).toBeGreaterThan(0);
  });
});
