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
  fireEvent.mouseDown(screen.getByTestId("asset-criticality-filter-select"));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(`4-level\\.${level}\\.label or higher`) }));
}

const PRESENT_TYPES = ["data", "system", "physical"];
const typeItem = (type: string) => screen.getByTestId(`asset-type-filter-${type}`);
const openTypes = () => fireEvent.mouseDown(screen.getByTestId("asset-type-filter-select"));
const closeMenu = () => fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

/** AF-2: unticks every present type but the given ones in the type dropdown. */
function onlyTypes(...keep: string[]) {
  openTypes();
  for (const type of PRESENT_TYPES) {
    if (!keep.includes(type) && typeItem(type).getAttribute("aria-checked") === "true") fireEvent.click(typeItem(type));
  }
  closeMenu();
}

const count = (key: string) =>
  within(screen.getByTestId(`asset-group-${key}`)).getAllByText(/^\d+$/)[0].textContent;

describe("Asset tab — type and criticality filter (AF-1, AF-2)", () => {
  it("the type dropdown offers only the types present, with their count, all ticked", () => {
    renderTab();
    expect(screen.getByTestId("asset-type-filter-select")).toHaveTextContent("All types");
    openTypes();
    expect(typeItem("data")).toHaveTextContent("Data (2)");
    expect(typeItem("system")).toHaveTextContent("(1)");
    expect(screen.queryByTestId("asset-type-filter-human")).toBeNull();
    for (const type of PRESENT_TYPES) expect(typeItem(type)).toHaveAttribute("aria-checked", "true");
  });

  it("unticking hides a type across all accordions; counts follow, empty ones disappear", () => {
    renderTab();
    expect(count(TOP_LEVEL_GROUP)).toBe("2");
    expect(count("mp1")).toBe("2");

    onlyTypes("system");
    expect(screen.getByTestId("asset-type-filter-select")).toHaveTextContent("System");
    expect(screen.queryByTestId(`asset-group-${TOP_LEVEL_GROUP}`)).toBeNull();
    expect(count("mp1")).toBe("1");
    expect(screen.getByText("Controller")).toBeTruthy();
    expect(screen.queryByText("Log")).toBeNull();
    expect(screen.getByTestId("asset-filter-count")).toHaveTextContent("1 of 4 assets shown");

    // Ticking a second type widens the filter.
    openTypes();
    fireEvent.click(typeItem("data"));
    closeMenu();
    expect(count(TOP_LEVEL_GROUP)).toBe("1");
    expect(count("mp1")).toBe("2");
  });

  it("the last ticked type cannot be unticked; 'Show all types' ticks all again", () => {
    renderTab();
    onlyTypes("system");
    openTypes();
    expect(typeItem("system")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId("asset-type-filter-all"));
    closeMenu();
    expect(screen.getByTestId("asset-type-filter-select")).toHaveTextContent("All types");
    expect(screen.queryByTestId("asset-filter-count")).toBeNull();
  });

  it("criticality: the highest level reads its name alone, the others 'or higher' (AF-2b)", () => {
    renderTab();
    fireEvent.mouseDown(screen.getByTestId("asset-criticality-filter-select"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    const L = (n: number) => `tabs.assets.impactScale.4-level.${n}.label`;
    expect(options).toEqual(["All levels", L(4), `${L(3)} or higher`, `${L(2)} or higher`, `${L(1)} or higher`]);
  });

  it("the filter dropdowns come first, then the buttons (AF-2b)", () => {
    renderTab();
    const bar = screen.getAllByTestId("asset-table-toolbar")[0];
    const type = within(bar).getByTestId("asset-type-filter");
    const review = within(bar).getByTestId("asset-review-filter");
    expect(type.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const criticality = within(bar).getByTestId("asset-criticality-filter-select");
    expect(criticality.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    onlyTypes("physical");
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
    onlyTypes("data");
    expect(screen.getByText("Calibration")).toBeTruthy();
    expect(screen.queryByText("Controller")).toBeNull();
  });

  it("kept per project for the session, not shared between projects", () => {
    const first = renderTab();
    onlyTypes("system");
    first.unmount();

    renderTab();
    openTypes();
    expect(typeItem("system")).toHaveAttribute("aria-checked", "true");
    expect(typeItem("data")).toHaveAttribute("aria-checked", "false");
    closeMenu();
    expect(screen.getByTestId("asset-filter-count")).toHaveTextContent("1 of 4 assets shown");
    cleanup();

    renderTab(project("p-2"));
    expect(screen.getByTestId("asset-type-filter-select")).toHaveTextContent("All types");
  });

  it("'Show in table' for an asset the filter hides lifts the filter", () => {
    const { rerender } = renderTab();
    onlyTypes("system");
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
