// src/tests/component/asset-group-sections.test.tsx
//
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6c, D20): assets
// grouped by the elements and flows holding them — one multiprocess →
// there (a top-level flow carrying it in does not count), several
// multiprocesses → "Shared", only top level or no link at all → "Top
// level", links only to deleted elements → "Not in the DFD".
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGroupSections } from "features/assets/components/asset-group-sections";
import {
  ASSET_NOT_IN_DFD,
  ASSET_SHARED_GROUP,
  assetGroupOf,
  assetGroupSections,
} from "features/assets/utils/asset-groups";
import { TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";
import type { Asset } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const GROUPS: DfdTableGroups = {
  groups: [
    { key: TOP_LEVEL_GROUP, label: "" },
    { key: "mp1", label: "MP-1 Sensor" },
    { key: "mp2", label: "MP-2 Controller" },
  ],
  elementGroup: { ee1: TOP_LEVEL_GROUP, p2: "mp1", ds2: "mp1", p5: "mp2" },
  flowGroups: { df7: [TOP_LEVEL_GROUP], df9: ["mp1"] },
};

const link = (elementId: string, elementType = "Process") => ({
  elementId,
  elementType,
  elementName: elementId,
  displayId: elementId,
});
const asset = (id: string, links: ReturnType<typeof link>[]) =>
  ({ id, name: id, linkedDFDElements: links }) as unknown as Asset;

const ASSETS = [
  asset("calibration", [link("p2"), link("ds2", "DataStore"), link("df9", "DataFlow")]),
  // Written via the top-level flow DF-7, held in MP-2 → MP-2, not Shared.
  asset("thresholds", [link("p5"), link("df7", "DataFlow")]),
  asset("panel-cmd", [link("ee1", "ExternalEntity"), link("df7", "DataFlow")]),
  asset("measurement", [link("p2"), link("p5")]),
  asset("occupants", []),
  asset("gone", [link("deleted")]),
];

const ids = (assets: Asset[]) => assets.map((a) => a.id);

describe("assetGroupOf / assetGroupSections", () => {
  it("one multiprocess → there, several → Shared, top or no link → Top level, gone → Not in the DFD", () => {
    expect(assetGroupOf(GROUPS, ASSETS[0])).toBe("mp1");
    expect(assetGroupOf(GROUPS, ASSETS[1])).toBe("mp2");
    expect(assetGroupOf(GROUPS, ASSETS[2])).toBe(TOP_LEVEL_GROUP);
    expect(assetGroupOf(GROUPS, ASSETS[3])).toBe(ASSET_SHARED_GROUP);
    // No link at all (people, building): the system as a whole → top level.
    expect(assetGroupOf(GROUPS, ASSETS[4])).toBe(TOP_LEVEL_GROUP);
    expect(assetGroupOf(GROUPS, ASSETS[5])).toBe(ASSET_NOT_IN_DFD);
  });

  it("orders top level, multiprocesses, Shared, Not in the DFD", () => {
    expect(assetGroupSections(GROUPS, ASSETS).map((s) => [s.key, ids(s.assets)])).toEqual([
      [TOP_LEVEL_GROUP, ["panel-cmd", "occupants"]],
      ["mp1", ["calibration"]],
      ["mp2", ["thresholds"]],
      [ASSET_SHARED_GROUP, ["measurement"]],
      [ASSET_NOT_IN_DFD, ["gone"]],
    ]);
  });
});

const renderTable = (assets: Asset[], groupKey: string) => (
  <div data-testid={`table-${groupKey}`}>{ids(assets).join(",")}</div>
);

describe("AssetGroupSections", () => {
  it("renders the table once per group with its assets", () => {
    render(<AssetGroupSections groups={GROUPS} assets={ASSETS} renderTable={renderTable} />);
    expect(screen.getByTestId(`table-${TOP_LEVEL_GROUP}`).textContent).toBe("panel-cmd,occupants");
    expect(screen.getByTestId("table-mp1").textContent).toBe("calibration");
    expect(screen.getByTestId(`table-${ASSET_SHARED_GROUP}`).textContent).toBe("measurement");
    const shared = screen.getByTestId(`asset-group-${ASSET_SHARED_GROUP}`);
    expect(within(shared).getByText("Shared")).toBeTruthy();
    expect(within(screen.getByTestId(`asset-group-${TOP_LEVEL_GROUP}`)).getByText("Top level")).toBeTruthy();
  });

  it("'Show in table' opens the group of the asset", () => {
    const { rerender } = render(
      <AssetGroupSections groups={GROUPS} assets={ASSETS} renderTable={renderTable} />,
    );
    fireEvent.click(within(screen.getByTestId("asset-group-mp2")).getByText("MP-2 Controller"));
    expect(screen.queryByTestId("table-mp2")).toBeNull();
    rerender(
      <AssetGroupSections
        groups={GROUPS}
        assets={ASSETS}
        renderTable={renderTable}
        highlightRequest={{ assetId: "thresholds" }}
      />,
    );
    expect(screen.getByTestId("table-mp2").textContent).toBe("thresholds");
  });

  it("renders the table unchanged without groups", () => {
    render(<AssetGroupSections assets={ASSETS} renderTable={renderTable} />);
    expect(screen.getByTestId("table-").textContent).toBe(ids(ASSETS).join(","));
    expect(screen.queryByTestId(`asset-group-${TOP_LEVEL_GROUP}`)).toBeNull();
  });
});
