// src/tests/component/assets-tab.filter.test.tsx
//
// AF-1: the asset tab filters by asset type and criticality "from level"
// across all group accordions. Counts follow the filter, empty accordions
// disappear, "Reset filter" clears it, the filter is kept per project for
// the session, and "Show in table" lifts a filter that hides the asset.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetsTab, resetAssetTabViewMemory } from "features/assets/components/assets-tab";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Asset, AssetProjectData } from "features/assets/models/asset-types";
import { TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";

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

afterEach(cleanup);
beforeEach(() => resetAssetTabViewMemory());

const CRITERION = DEFAULT_ASSET_CONFIGURATION.impactCriteria[0].id;
const link = (elementId: string) => ({ elementId, elementType: "Process", elementName: elementId, displayId: elementId });
const asset = (id: string, name: string, assetGroup: string, overallImpact: number, el: string): Asset =>
  ({
    id,
    displayId: id.toUpperCase(),
    name,
    assetGroup,
    overallImpact,
    properties: {},
    // The tab recalculates the overall impact from the ratings.
    impactRatings: overallImpact > 0 ? [{ criterionId: CRITERION, value: overallImpact }] : [],
    linkedDFDElements: [link(el)],
    securityGoals: [],
  }) as unknown as Asset;

const ASSETS = [
  asset("da-001", "Calibration", "data", 4, "p1"),
  asset("da-002", "Log", "data", 1, "p2"),
  asset("sy-001", "Controller", "system", 3, "p2"),
  asset("ph-001", "Housing", "physical", 0, "p1"),
];

const GROUPS: DfdTableGroups = {
  groups: [
    { key: TOP_LEVEL_GROUP, label: "" },
    { key: "mp1", label: "MP-1 Sensor" },
  ],
  elementGroup: { p1: TOP_LEVEL_GROUP, p2: "mp1" },
  flowGroups: {},
};

const project = (id = "p-1", groups: DfdTableGroups | undefined = GROUPS): AssetProjectData => ({
  id,
  name: "Test",
  assets: { configuration: { ...DEFAULT_ASSET_CONFIGURATION }, assets: ASSETS, lastModified: "" },
  phaseStatus: {} as AssetProjectData["phaseStatus"],
  lastModified: "",
  dfdTableGroups: groups,
});

function renderTab(p = project(), highlight: { assetId: string } | null = null) {
  return render(
    <div style={{ width: 1800, height: 900 }}>
      <AssetsTab project={p} onUpdate={() => {}} tableHighlightRequest={highlight} />
    </div>,
  );
}

/** Picks "from level" in the criticality select (opens the menu like a user). */
function pickLevel(level: number) {
  fireEvent.mouseDown(within(screen.getByTestId("asset-table-toolbar")).getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(`4-level\\.${level}\\.label or higher`) }));
}

const count = (key: string) =>
  within(screen.getByTestId(`asset-group-${key}`)).getAllByText(/^\d+$/)[0].textContent;

describe("Asset tab — type and criticality filter (AF-1)", () => {
  it("offers only the types present, with their count", () => {
    renderTab();
    const bar = screen.getByTestId("asset-type-filter");
    expect(within(bar).getByTestId("asset-type-filter-data")).toHaveTextContent("Data (2)");
    expect(within(bar).getByTestId("asset-type-filter-system")).toHaveTextContent("(1)");
    expect(within(bar).queryByTestId("asset-type-filter-human")).toBeNull();
  });

  it("type filter works across all accordions; counts follow, empty ones disappear", () => {
    renderTab();
    expect(count(TOP_LEVEL_GROUP)).toBe("2");
    expect(count("mp1")).toBe("2");

    fireEvent.click(screen.getByTestId("asset-type-filter-system"));
    expect(screen.queryByTestId(`asset-group-${TOP_LEVEL_GROUP}`)).toBeNull();
    expect(count("mp1")).toBe("1");
    expect(screen.getByText("Controller")).toBeTruthy();
    expect(screen.queryByText("Log")).toBeNull();
    expect(screen.getByTestId("asset-filter-count")).toHaveTextContent("1 of 4 assets shown");

    // A second type widens the filter.
    fireEvent.click(screen.getByTestId("asset-type-filter-data"));
    expect(count(TOP_LEVEL_GROUP)).toBe("1");
    expect(count("mp1")).toBe("2");
  });

  it("criticality from level hides lower and unrated assets; unrated on request", () => {
    renderTab();
    pickLevel(3);
    expect(screen.getByTestId("asset-filter-count")).toHaveTextContent("2 of 4 assets shown");
    expect(screen.queryByText("Housing")).toBeNull();
    expect(screen.queryByText("Log")).toBeNull();

    fireEvent.click(screen.getByTestId("asset-unrated-filter").querySelector("input")!);
    expect(screen.getByText("Housing")).toBeTruthy();
    expect(screen.getByTestId("asset-filter-count")).toHaveTextContent("3 of 4 assets shown");
  });

  it("nothing matches → a note instead of empty accordions; reset shows all again", () => {
    renderTab();
    fireEvent.click(screen.getByTestId("asset-type-filter-physical"));
    pickLevel(2);
    expect(screen.getByTestId("asset-filter-empty")).toHaveTextContent("No asset matches the filter.");
    expect(screen.queryByTestId(`asset-group-${TOP_LEVEL_GROUP}`)).toBeNull();

    fireEvent.click(screen.getByTestId("asset-filter-reset"));
    expect(screen.queryByTestId("asset-filter-count")).toBeNull();
    expect(count(TOP_LEVEL_GROUP)).toBe("2");
    expect(count("mp1")).toBe("2");
  });

  it("classic DFD without groups: the same bar filters the one table", () => {
    renderTab(project("p-1", undefined));
    expect(screen.getAllByTestId("asset-table-toolbar")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("asset-type-filter-data"));
    expect(screen.getByText("Calibration")).toBeTruthy();
    expect(screen.queryByText("Controller")).toBeNull();
  });

  it("kept per project for the session, not shared between projects", () => {
    const first = renderTab();
    fireEvent.click(screen.getByTestId("asset-type-filter-system"));
    first.unmount();

    renderTab();
    expect(screen.getByTestId("asset-type-filter-system")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("asset-filter-count")).toHaveTextContent("1 of 4 assets shown");
    cleanup();

    renderTab(project("p-2"));
    expect(screen.getByTestId("asset-type-filter-system")).toHaveAttribute("aria-pressed", "false");
  });

  it("'Show in table' for an asset the filter hides lifts the filter", () => {
    const { rerender } = renderTab();
    fireEvent.click(screen.getByTestId("asset-type-filter-system"));
    expect(screen.queryByText("Calibration")).toBeNull();
    rerender(
      <div style={{ width: 1800, height: 900 }}>
        <AssetsTab project={project()} onUpdate={() => {}} tableHighlightRequest={{ assetId: "da-001" }} />
      </div>,
    );
    expect(screen.getByText("Calibration")).toBeTruthy();
    expect(screen.queryByTestId("asset-filter-count")).toBeNull();
  });
});
