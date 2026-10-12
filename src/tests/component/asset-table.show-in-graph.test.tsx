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
});
