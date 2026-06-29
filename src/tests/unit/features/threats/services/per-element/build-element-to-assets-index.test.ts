import { describe, it, expect } from "vitest";
import { buildElementToAssetsIndex } from "features/threats/services/per-element/element-generator";

// Minimal AssetDataReference factory — only the fields the index reads.
function ref(assets: Array<{ id: string; linkedElementIds?: string[] }>) {
  return { assets, hasSafetyAssets: false } as any;
}

describe("buildElementToAssetsIndex", () => {
  it("returns an empty map when the asset reference is undefined", () => {
    const index = buildElementToAssetsIndex(undefined);
    expect(index.size).toBe(0);
  });

  it("returns an empty map when there are no assets", () => {
    const index = buildElementToAssetsIndex(ref([]));
    expect(index.size).toBe(0);
  });

  it("maps every linked element of an asset to that asset's id", () => {
    const index = buildElementToAssetsIndex(
      ref([{ id: "A-1", linkedElementIds: ["131", "140"] }]),
    );
    expect(index.get("131")).toEqual(["A-1"]);
    expect(index.get("140")).toEqual(["A-1"]);
  });

  it("merges multiple assets linked to the same element", () => {
    const index = buildElementToAssetsIndex(
      ref([
        { id: "A-1", linkedElementIds: ["131"] },
        { id: "A-2", linkedElementIds: ["131"] },
      ]),
    );
    expect(index.get("131")).toEqual(["A-1", "A-2"]);
  });

  it("skips assets without linkedElementIds", () => {
    const index = buildElementToAssetsIndex(
      ref([
        { id: "A-1" }, // no linkedElementIds
        { id: "A-2", linkedElementIds: ["140"] },
      ]),
    );
    expect(index.has("__undefined__")).toBe(false);
    expect(index.get("140")).toEqual(["A-2"]);
    expect(index.size).toBe(1);
  });
});
