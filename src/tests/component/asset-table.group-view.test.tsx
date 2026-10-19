// src/tests/component/asset-table.group-view.test.tsx
//
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6c): the asset
// tables of the group accordions share one toolbar ("Show factors", "Needs
// review only") and take the height of their rows; "Show in table" then
// brings the row into view in the page — repeatedly, because the accordion
// may still be opening and the row heights are measured after the first
// paint.

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AssetTable,
  AssetTableToolbar,
  SCROLL_RETRY_MS,
  type AssetTableView,
} from "features/assets/components/asset-table";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Asset } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

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

const factorHeader = () =>
  document.querySelector(`[data-field="impact_${DEFAULT_ASSET_CONFIGURATION.impactCriteria[0].id}"]`);

describe("AssetTable under the shared toolbar", () => {
  it("has no toolbar of its own and follows the factor setting", () => {
    const view: AssetTableView = { factorsVisible: false, reviewOnly: false };
    const { rerender } = render(
      <div style={{ width: 1800 }}>
        <AssetTable assets={[asset]} configuration={DEFAULT_ASSET_CONFIGURATION} onEdit={() => {}} autoHeight view={view} />
      </div>,
    );
    expect(screen.queryByTestId("asset-table-toolbar")).toBeNull();
    expect(factorHeader()).toBeNull();
    rerender(
      <div style={{ width: 1800 }}>
        <AssetTable
          assets={[asset]}
          configuration={DEFAULT_ASSET_CONFIGURATION}
          onEdit={() => {}}
          autoHeight
          view={{ ...view, factorsVisible: true }}
        />
      </div>,
    );
    expect(factorHeader()).not.toBeNull();
  });

  it("the toolbar reports changes of both settings", () => {
    const onChange = vi.fn();
    render(
      <AssetTableToolbar
        view={{ factorsVisible: false, reviewOnly: false }}
        onChange={onChange}
        needsReview={new Set(["da-001"])}
        reviewCount={1}
      />,
    );
    fireEvent.click(screen.getByText("tabs.assets.tooltips.showFactors"));
    expect(onChange).toHaveBeenLastCalledWith({ factorsVisible: true, reviewOnly: false });
    fireEvent.click(screen.getByTestId("asset-review-filter"));
    expect(onChange).toHaveBeenLastCalledWith({ factorsVisible: false, reviewOnly: true });
  });

  it("'Show in table' scrolls the row into view until the layout has settled", () => {
    vi.useFakeTimers();
    try {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      render(
        <div style={{ width: 1800 }}>
          <AssetTable
            assets={[asset]}
            configuration={DEFAULT_ASSET_CONFIGURATION}
            onEdit={() => {}}
            autoHeight
            view={{ factorsVisible: false, reviewOnly: false }}
            highlightRequest={{ assetId: "da-001" }}
          />
        </div>,
      );
      // Once after the first paint, again after the accordion opened and
      // the row heights were measured (a row further down was missed).
      act(() => {
        vi.advanceTimersByTime(SCROLL_RETRY_MS[SCROLL_RETRY_MS.length - 1] + 10);
      });
      expect(scrollIntoView).toHaveBeenCalledTimes(SCROLL_RETRY_MS.length);
    } finally {
      vi.useRealTimers();
    }
  });
});
