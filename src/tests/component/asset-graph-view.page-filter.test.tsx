// src/tests/component/asset-graph-view.page-filter.test.tsx
//
// Leveled DFD (design §9, Phase 6f): the asset graph filtered to the assets
// of the elements on one page, optionally with its sub-pages.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import type { A2ARelation, DfdScopeIndex } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const rel = (id: string, s: string, t: string, type: string) =>
  ({ id, sourceAssetId: s, targetAssetId: t, relationType: type }) as A2ARelation;

const source: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "d2", displayId: "DA-002", name: "Config", assetGroup: "data" },
    { id: "f1", displayId: "FU-001", name: "Alarm", assetGroup: "function" },
  ],
  relations: [rel("r1", "d1", "f1", "required_by")],
  elements: [
    { id: "mp1", displayId: "MP-1", type: "Multiprocess", assetRelations: [{ assetId: "f1", relationType: "implements" }] },
    { id: "p1", displayId: "P-1.1", type: "Process", assetRelations: [{ assetId: "d1", relationType: "processes" }] },
    { id: "p2", displayId: "P-1.1.1", type: "Process", assetRelations: [{ assetId: "d2", relationType: "processes" }] },
  ],
};

const SCOPE: DfdScopeIndex = {
  pages: [
    { pageId: "top", name: "Top", depth: 0 },
    { pageId: "sen", name: "Sensor", depth: 1 },
    { pageId: "opt", name: "Optics", depth: 2 },
  ],
  itemsOnPage: { top: ["mp1"], sen: ["p1"], opt: ["p2"] },
  childPages: { top: ["sen"], sen: ["opt"] },
  parentLevelFlows: [],
};

const choosePage = (name: string) => {
  // The page select: its native input carries the test id, the combobox is its sibling.
  fireEvent.mouseDown(within(screen.getByTestId("dfd-scope-page").parentElement!).getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name }));
};

describe("AssetGraphView — page filter", () => {
  it("has no page filter for a classic DFD", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={vi.fn()} />);
    expect(screen.queryByTestId("dfd-scope-page")).toBeNull();
  });

  it("shows only the assets of the elements on the chosen page, with sub-pages on request", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={vi.fn()} pageScope={SCOPE} />);
    expect(screen.getByTestId("asset-graph-node-d2")).toBeInTheDocument();

    choosePage("Sensor");
    expect(screen.getByTestId("asset-graph-node-d1")).toBeInTheDocument();
    expect(screen.queryByTestId("asset-graph-node-d2")).toBeNull();
    expect(screen.queryByTestId("asset-graph-node-f1")).toBeNull();

    fireEvent.click(screen.getByLabelText("with-sub-pages"));
    expect(screen.getByTestId("asset-graph-node-d2")).toBeInTheDocument();
  });

  it("explains a search hit outside the page and shows all pages on request", () => {
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={vi.fn()} pageScope={SCOPE} />);
    choosePage("Sensor");
    fireEvent.change(screen.getByTestId("asset-graph-search"), { target: { value: "Config" } });
    fireEvent.keyDown(screen.getByTestId("asset-graph-search"), { key: "Enter" });
    expect(screen.getByTestId("asset-graph-search-notice")).toHaveTextContent(
      "DA-002 Config is held by no element on the selected page.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Show all pages" }));
    expect(screen.getByTestId("asset-graph-node-d2")).toBeInTheDocument();
  });
});
