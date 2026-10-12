// src/tests/component/asset-table.show-in-graph.test.tsx
//
// FR-V13: each row offers "Show in graph"; it reports the asset and does not
// open the edit dialog underneath.

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetTable } from "features/assets/components/asset-table";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Asset } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

const asset = {
  id: "da-001",
  displayId: "DA-001",
  name: "Alpha",
  assetGroup: "data",
  properties: {},
  impactRatings: [],
  linkedDFDElements: [],
  securityGoals: [],
} as unknown as Asset;

describe("AssetTable — Show in graph", () => {
  it("reports the row's asset, not the edit action", () => {
    const onShowInGraph = vi.fn();
    const onEdit = vi.fn();
    render(
      <div style={{ width: 1800, height: 400 }}>
        <AssetTable
          assets={[asset]}
          configuration={DEFAULT_ASSET_CONFIGURATION}
          onEdit={onEdit}
          onShowInGraph={onShowInGraph}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Show in graph" }));
    expect(onShowInGraph).toHaveBeenCalledWith(asset);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("without the callback there is no such action", () => {
    render(
      <div style={{ width: 1800, height: 400 }}>
        <AssetTable assets={[asset]} configuration={DEFAULT_ASSET_CONFIGURATION} onEdit={() => {}} />
      </div>,
    );
    expect(screen.queryByRole("menuitem", { name: "Show in graph" })).toBeNull();
  });

  it("a highlight request marks the row (show in table from the graph)", () => {
    const { container } = render(
      <div style={{ width: 1800, height: 400 }}>
        <AssetTable
          assets={[asset]}
          configuration={DEFAULT_ASSET_CONFIGURATION}
          onEdit={() => {}}
          highlightRequest={{ assetId: "da-001" }}
        />
      </div>,
    );
    expect(container.querySelector(".MuiDataGrid-row--highlighted")).not.toBeNull();
  });

  it("a highlighted row hidden by the review filter lifts the filter", () => {
    const other = { ...asset, id: "da-002", displayId: "DA-002", name: "Beta" } as Asset;
    const { rerender, container } = render(
      <div style={{ width: 1800, height: 400 }}>
        <AssetTable
          assets={[asset, other]}
          configuration={DEFAULT_ASSET_CONFIGURATION}
          onEdit={() => {}}
          needsReview={new Set(["da-002"])}
        />
      </div>,
    );
    fireEvent.click(screen.getByTestId("asset-review-filter"));
    expect(screen.queryByText("Alpha")).toBeNull();
    rerender(
      <div style={{ width: 1800, height: 400 }}>
        <AssetTable
          assets={[asset, other]}
          configuration={DEFAULT_ASSET_CONFIGURATION}
          onEdit={() => {}}
          needsReview={new Set(["da-002"])}
          highlightRequest={{ assetId: "da-001" }}
        />
      </div>,
    );
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(container.querySelector(".MuiDataGrid-row--highlighted")).not.toBeNull();
  });
});
