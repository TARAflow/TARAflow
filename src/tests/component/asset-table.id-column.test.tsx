// src/tests/component/asset-table.id-column.test.tsx
//
// Manual test 2026-11-08: the display ids of an imported component's assets
// carry the instance prefix ("SDC1:DA-001") and were cut in half by the
// 95 px ID column. The column now grows with the longest id; the chip has
// the full id as tooltip.

import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetTable } from "features/assets/components/asset-table";
import { DEFAULT_ASSET_CONFIGURATION, type Asset } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

const asset = (id: string, displayId: string) =>
  ({ id, displayId, name: id, assetGroup: "data", properties: {}, impactRatings: [], linkedDFDElements: [], securityGoals: [] }) as unknown as Asset;

const idHeaderWidth = (assets: Asset[]) => {
  const { container, unmount } = render(
    <div style={{ width: 1800, height: 400 }}>
      <AssetTable assets={assets} configuration={DEFAULT_ASSET_CONFIGURATION} onEdit={() => {}} />
    </div>,
  );
  const header = container.querySelector('[role="columnheader"][data-field="id"]') as HTMLElement;
  const width = parseFloat(header.style.width || header.style.minWidth || header.style.maxWidth);
  unmount();
  return width;
};

describe("AssetTable — ID column", () => {
  it("keeps its width for short ids and grows for prefixed ones", () => {
    const short = idHeaderWidth([asset("a", "DA-001")]);
    const long = idHeaderWidth([asset("a", "DA-001"), asset("b", "SDC1:DA-001")]);
    expect(short).toBe(95);
    expect(long).toBe(36 + 7.5 * "SDC1:DA-001".length);
  });
});
