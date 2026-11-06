// src/tests/component/asset-graph-view.unlinked.test.tsx
//
// User 2026-11-06: a filter in the asset graph's layer view that shows only
// the assets without an asset-to-asset relation — also those linked only to
// DFD elements or hazards — combinable with the layer presets.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import { assetIdsWithoutA2A } from "features/dfd/asset-graph/asset-graph-query";
import type { A2ARelation } from "shared";

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

// d1 – f1 linked; d2 only on a DFD element; d3 nothing; p1 nothing (process);
// a relation to a deleted asset does not count (d4).
const source: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "d2", displayId: "DA-002", name: "Calibration", assetGroup: "data" },
    { id: "d3", displayId: "DA-003", name: "Log", assetGroup: "data" },
    { id: "d4", displayId: "DA-004", name: "Orphan link", assetGroup: "data" },
    { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
    { id: "p1", displayId: "PR-001", name: "Shutdown", assetGroup: "process" },
  ],
  relations: [rel("r1", "d1", "f1"), rel("r2", "d4", "gone")],
  elements: [{ id: "pe", displayId: "P-1", type: "Process", assetRelations: [{ assetId: "d2", relationType: "processes" }] }],
};

const view = () =>
  render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={vi.fn()} onShowElement={vi.fn()} />);
const node = (id: string) => screen.queryByTestId(`asset-graph-node-${id}`);

describe("asset graph — without asset relation", () => {
  it("helper: no relation, only a DFD link, or a link to a deleted asset", () => {
    expect([...assetIdsWithoutA2A(source)].sort()).toEqual(["d2", "d3", "d4", "p1"]);
  });

  it("the chip counts them and shows only them; off again shows everything", () => {
    view();
    const chip = screen.getByTestId("asset-graph-unlinked");
    expect(chip).toHaveTextContent("Without asset relation (4)");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    for (const id of ["d2", "d3", "d4", "p1"]) expect(node(id)).toBeInTheDocument();
    for (const id of ["d1", "f1"]) expect(node(id)).toBeNull();
    fireEvent.click(chip);
    for (const id of ["d1", "f1", "d2"]) expect(node(id)).toBeInTheDocument();
  });

  it("combines with a preset: architecture hides the process", () => {
    view();
    fireEvent.mouseDown(within(screen.getByTestId("asset-graph-preset")).getByRole("combobox"));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "architecture" }));
    const chip = screen.getByTestId("asset-graph-unlinked");
    expect(chip).toHaveTextContent("(3)");
    fireEvent.click(chip);
    for (const id of ["d2", "d3", "d4"]) expect(node(id)).toBeInTheDocument();
    expect(node("p1")).toBeNull();
    expect(node("d1")).toBeNull();
  });

  it("not offered in the focus view; Reset turns it off", () => {
    view();
    fireEvent.click(screen.getByTestId("asset-graph-unlinked"));
    fireEvent.click(screen.getByTestId("asset-graph-view-focus"));
    expect(screen.queryByTestId("asset-graph-unlinked")).toBeNull();
    fireEvent.click(screen.getByTestId("asset-graph-view-layers"));
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByTestId("asset-graph-unlinked")).toHaveAttribute("aria-pressed", "false");
    expect(node("d1")).toBeInTheDocument();
  });
});
