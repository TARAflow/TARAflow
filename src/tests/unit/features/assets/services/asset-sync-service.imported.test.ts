// src/tests/unit/features/assets/services/asset-sync-service.imported.test.ts
//
// An asset of an imported component belongs to the component (0.20, manual
// test 2026-11-22): its links to the component's elements, name, group and
// derived values come from the snapshot. The component's elements on the
// machine's DFD carry no assetRelations, so a DFD update must not re-derive
// such an asset — it emptied its links and rewrote its impact, and opening a
// machine with an imported component changed the file.

import { describe, it, expect } from "vitest";
import { syncFromDFD } from "features/assets/services/asset-sync-service";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets";
import type { AssetData, Asset, AssetDFDAsset } from "features/assets";

const LINKS = [
  { elementId: "cmp-p1", elementName: "Optical Detection Controller", elementType: "Process", displayId: "SDC1:P-1", relationType: "processes" },
  { elementId: "cmp-df1", elementName: "stream sensor data", elementType: "DataFlow", displayId: "SDC1:DF-1", relationType: "transfers" },
];

function asset(overrides: Partial<Asset>): Asset {
  return {
    id: "cmp-a1",
    displayId: "SDC1:DA-1",
    name: "smoke meas data",
    assetGroup: "data",
    source: "dfd",
    syncedWithDFD: true,
    impactRatings: [],
    securityGoals: [],
    properties: {},
    linkedDFDElements: LINKS,
    ...overrides,
  } as unknown as Asset;
}

function data(assets: Asset[]): AssetData {
  return { configuration: DEFAULT_ASSET_CONFIGURATION, assets, lastModified: "2026-11-09T21:20:57.786Z" };
}

/** What the DFD of the machine yields for the asset: no relations on the component's elements. */
function dfdRef(overrides: Partial<AssetDFDAsset> = {}): AssetDFDAsset {
  return { id: "cmp-a1", displayId: "SDC1:DA-1", name: "smoke meas data", assetGroup: "data", linkedElements: [], ...overrides } as AssetDFDAsset;
}

describe("syncFromDFD — assets of an imported component", () => {
  it("keeps the asset of an imported component as it is (links, impact, no timestamp)", () => {
    const imported = asset({ importedFrom: "SDC1 · Smoke Detector Case" });
    const base = data([imported]);
    const { assetData, hasChanges } = syncFromDFD(base, [dfdRef()], [], []);
    expect(hasChanges).toBe(false);
    expect(assetData).toBe(base);
    expect(assetData.assets[0]).toBe(imported);
    expect(assetData.assets[0].linkedDFDElements).toHaveLength(2);
    expect(assetData.assets[0].physicalImpactSource).toBeUndefined();
  });

  it("also when the DFD names it differently — the component owns name and group", () => {
    const imported = asset({ importedFrom: "SDC1 · Smoke Detector Case" });
    const { assetData } = syncFromDFD(data([imported]), [dfdRef({ name: "renamed", assetGroup: "service" })], [], []);
    expect(assetData.assets[0]).toBe(imported);
  });

  it("an asset of the machine itself is still re-derived from the DFD (control)", () => {
    const own = asset({ id: "DA-001", displayId: "DA-001" });
    const { assetData, hasChanges } = syncFromDFD(data([own]), [dfdRef({ id: "DA-001", displayId: "DA-001" })], [], []);
    expect(hasChanges).toBe(true);
    expect(assetData.assets[0].linkedDFDElements).toEqual([]);
    expect(assetData.assets[0].physicalImpactSource).toBe("derived");
  });
});
