// src/tests/component/assets-tab.imported-no-change.test.tsx
//
// Opening the Assets tab of a machine with an imported component must not
// change the project (manual test 0.20, SmokeDetectorController, 2026-11-22):
// the component's assets carry no overallImpact until the machine rates them,
// and the tab's recalculation turned the missing value into 0 and saved it.

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetsTab, resetAssetTabViewMemory } from "features/assets/components/assets-tab";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Asset, AssetProjectData } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);
beforeEach(() => resetAssetTabViewMemory());

const imported = {
  id: "cmpd6a16dee9768",
  displayId: "SDC1:DA-1",
  name: "smoke meas data",
  assetGroup: "data",
  importedFrom: "SDC1 · Smoke Detector Case",
  properties: {},
  impactRatings: [],
  linkedDFDElements: [{ elementId: "cmp-p1", elementType: "Process", elementName: "Optical Detection Controller", displayId: "SDC1:P-1" }],
  securityGoals: [],
} as unknown as Asset; // no overallImpact, as the import writes it

const project: AssetProjectData = {
  id: "p-1",
  name: "Machine",
  assets: { configuration: { ...DEFAULT_ASSET_CONFIGURATION }, assets: [imported], lastModified: "" },
  phaseStatus: {} as AssetProjectData["phaseStatus"],
  lastModified: "",
};

describe("AssetsTab — an imported component's assets", () => {
  it("opening and leaving the tab does not update the project", () => {
    const onUpdate = vi.fn();
    const { unmount } = render(
      <div style={{ width: 1800, height: 900 }}>
        <AssetsTab project={project} onUpdate={onUpdate} />
      </div>,
    );
    unmount(); // the tab saves pending changes when it is left
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
