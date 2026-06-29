import { describe, it, expect } from "vitest";
// NOTE: align this relative path with the sibling tests in this folder if your
// repo uses a different depth/alias. Service lives in
// src/features/threats/services/per-element/element-generator.ts
import { buildElementToAssetsIndex } from "../../../../../../features/threats/services/per-element/element-generator";
import fixture from "../../../../../fixtures/edge2-asset-index.fixture.json";

/**
 * Golden fixture extracted from the real customer project (EdGe2_tara.json):
 * the asset→element links (asset.linkedDFDElements) inverted into the
 * assetDataRef shape the generator actually consumes
 * (assetDataRef.assets[].linkedElementIds). buildElementToAssetsIndex must
 * re-invert it into element id → asset id[], which both the full generator and
 * the sync add-path rely on so newly synced elements carry the SAME
 * linkedAssetIds a full regeneration would produce.
 */
describe("buildElementToAssetsIndex — golden (EdGe2 project)", () => {
  const assetDataRef = fixture.assetDataRef as {
    assets: { id: string; linkedElementIds: string[] }[];
  };
  const expected = fixture.expected as Record<string, string[]>;

  it("inverts the real asset links into element → assetIds (exact)", () => {
    const index = buildElementToAssetsIndex(assetDataRef as any);
    for (const [elementId, assetIds] of Object.entries(expected)) {
      expect(index.get(elementId)).toEqual(assetIds);
    }
    // No phantom keys: index covers exactly the linked elements.
    expect(index.size).toBe(Object.keys(expected).length);
  });

  it("fans a shared asset (DA-004) out to every element that links it", () => {
    const index = buildElementToAssetsIndex(assetDataRef as any);
    // DA-004 is the asset shared by the Operator EE (189) and the Sensor (206).
    expect(index.get("189")).toContain("DA-004");
    expect(index.get("206")).toContain("DA-004");
  });

  it("returns an empty map for a missing/undefined assetDataRef", () => {
    expect(buildElementToAssetsIndex(undefined as any).size).toBe(0);
  });

  it("returns an empty map when an asset has no linkedElementIds", () => {
    const index = buildElementToAssetsIndex({
      assets: [{ id: "DA-XX", linkedElementIds: [] }],
    } as any);
    expect(index.size).toBe(0);
  });
});
