// ==================== RC-1' — app-layer AssetReference mapping (dedup) ====================
// The mapper buildAssetDataReference ALREADY maps Asset.linkedDFDElements[].elementId
// -> AssetReference.linkedElementIds, so Module 2 (CIANAAA) is correctly fed at
// runtime. The only residual defect is the missing de-duplication: an asset that
// links the same element under several relationTypes yields a duplicate id, which
// later doubles that asset in a threat's linkedAssetIds.
//
// Placement: src/tests/unit/app/utils/  (next to build-asset-hazard-links.test.ts).
//
// NOTE: buildAssetDataReference calls resolveAssetPhysicalImpact(asset, hazardLink).
// The minimal Asset stubs below carry the fields that path reads; extend if your
// resolver requires more.

import { describe, it, expect } from "vitest";
import { buildAssetDataReference } from "../../../../app/utils/build-asset-data-reference";
import type { Asset } from "features/assets";

type HazardLinks = Parameters<typeof buildAssetDataReference>[1];

function asset(id: string, linkedElementIds: string[], goals = []): Asset {
  return {
    id,
    numericId: Number(id.replace(/\D/g, "")) || 0,
    name: `Asset ${id}`,
    assetGroup: "data",
    impactRatings: [],
    overallImpact: 0,
    securityGoals: goals,
    linkedDFDElements: linkedElementIds.map((elementId) => ({
      elementId,
      elementName: elementId,
      elementType: "Process",
      relationType: "processes",
    })),
    source: "dfd",
    syncedWithDFD: true,
    created: "",
    lastModified: "",
  } as unknown as Asset;
}

const NO_HAZARDS = {} as HazardLinks;
const build = (assets: Asset[]) =>
  buildAssetDataReference(assets, NO_HAZARDS, "4-level");

describe("buildAssetDataReference — linkedElementIds (RC-1')", () => {
  it("maps linkedDFDElements[].elementId into linkedElementIds", () => {
    const { assets } = build([asset("DA-100", ["14", "129", "174"])]);
    expect(assets[0].linkedElementIds).toEqual(["14", "129", "174"]);
  });

  it("de-duplicates an element linked under multiple relationTypes", () => {
    // DA-001 in EdGe2 links element "14" twice.
    const { assets } = build([asset("DA-001", ["14", "14", "129"])]);
    const count = (assets[0].linkedElementIds ?? []).filter((id) => id === "14")
      .length;
    expect(count).toBe(1);
    expect(assets[0].linkedElementIds).toEqual(["14", "129"]);
  });

  it("yields empty linkedElementIds for an asset with no DFD links", () => {
    const { assets } = build([asset("DA-009", [])]);
    expect(assets[0].linkedElementIds).toEqual([]);
  });

  it("passes only active security goals through to the snapshot", () => {
    const goals = [
      { type: "I", level: "high" },
      { type: "C", level: "none" },
    ] as Asset["securityGoals"];
    const { assets } = build([asset("DA-005", ["14"], goals as never)]);
    expect(assets[0].securityGoals).toEqual([{ type: "I", level: "high" }]);
  });
});
