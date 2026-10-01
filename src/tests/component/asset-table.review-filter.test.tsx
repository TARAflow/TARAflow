// src/tests/component/asset-table.review-filter.test.tsx
//
// Phase 5 of the security-goal rework (design §4.4): with many assets the
// review must not require opening every dialog. The "Needs review only"
// filter narrows the table to assets with errors or warnings in the findings.

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetTable } from "features/assets/components/asset-table";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Asset } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const base = options?.defaultValue ?? key;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, n: string) =>
        options && n in options ? String(options[n]) : `{{${n}}}`,
      );
    },
    i18n: { language: "en" },
  }),
}));

const asset = (id: string, name: string): Asset =>
  ({
    id,
    displayId: id.toUpperCase(),
    name,
    assetGroup: "data",
    properties: {},
    impactRatings: [],
    linkedDFDElements: [],
    securityGoals: [],
  }) as unknown as Asset;

const ASSETS = [asset("da-001", "Alpha"), asset("da-002", "Beta"), asset("da-003", "Gamma")];

function renderTable(needsReview?: ReadonlySet<string>) {
  render(
    <div style={{ width: 1600, height: 600 }}>
      <AssetTable
        assets={ASSETS}
        configuration={DEFAULT_ASSET_CONFIGURATION}
        onEdit={() => {}}
        needsReview={needsReview}
      />
    </div>,
  );
}

describe("AssetTable — Needs review only", () => {
  it("shows the count and narrows the rows to the flagged assets", () => {
    renderTable(new Set(["da-002"]));
    const button = screen.getByTestId("asset-review-filter");
    expect(button).toHaveTextContent("Needs review only (1)");
    expect(screen.getByText("Alpha")).toBeTruthy();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.queryByText("Gamma")).toBeNull();
    expect(screen.getByText("Beta")).toBeTruthy();

    fireEvent.click(button);
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("nothing flagged: the filter says so instead of an empty grid", () => {
    renderTable(new Set());
    fireEvent.click(screen.getByTestId("asset-review-filter"));
    expect(screen.getByTestId("asset-review-empty")).toHaveTextContent("No asset needs review.");
  });

  it("no review set given → no filter offered", () => {
    renderTable();
    expect(screen.queryByTestId("asset-review-filter")).toBeNull();
  });
});
