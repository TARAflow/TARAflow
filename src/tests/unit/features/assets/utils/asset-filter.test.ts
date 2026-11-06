// src/tests/unit/features/assets/utils/asset-filter.test.ts
//
// AF-1: the asset tab filters by asset type and by criticality "from level"
// (the level of the "Overall" column) — across all group accordions.

import { describe, expect, it } from "vitest";
import {
  NO_ASSET_FILTER,
  assetCriticalityLevel,
  assetTypeCounts,
  filterAssets,
  getCategoryFromAsset,
  isAssetFilterActive,
} from "features/assets/utils/asset-filter";
import type { AssetGroup } from "shared";
import type { Asset } from "features/assets/models/asset-types";

const asset = (id: string, overallImpact: number, extra: Partial<Asset> = {}): Asset =>
  ({ id, displayId: id, name: id, overallImpact, properties: {}, ...extra }) as unknown as Asset;

const ASSETS = [
  asset("DA-001", 3.6, { assetGroup: "data" } as Partial<Asset>),
  asset("DA-002", 1.2, { assetGroup: "data" } as Partial<Asset>),
  asset("SY-001", 2.5, { assetGroup: "system" } as Partial<Asset>),
  asset("PH-001", 0, { assetGroup: "physical" } as Partial<Asset>),
  // Legacy asset: type from the id prefix only.
  asset("FU-001", 4),
];

const ids = (list: Asset[]) => list.map((a) => a.id);

describe("asset filter (AF-1)", () => {
  it("no filter → every asset", () => {
    expect(isAssetFilterActive(NO_ASSET_FILTER)).toBe(false);
    expect(ids(filterAssets(ASSETS, NO_ASSET_FILTER))).toEqual(ids(ASSETS));
  });

  it("types: only the selected ones, the id prefix counts for legacy assets", () => {
    const f = { ...NO_ASSET_FILTER, types: ["data", "function"] as AssetGroup[] };
    expect(ids(filterAssets(ASSETS, f))).toEqual(["DA-001", "DA-002", "FU-001"]);
    expect(getCategoryFromAsset(ASSETS[4])).toBe("function");
  });

  it("criticality from level: that level and every higher one, unrated hidden", () => {
    const f = { ...NO_ASSET_FILTER, minLevel: 3 };
    expect(isAssetFilterActive(f)).toBe(true);
    // 3.6 → 4, 2.5 → 3 (round), 1.2 → 1, 0 → unrated, 4 → 4
    expect(ids(filterAssets(ASSETS, f))).toEqual(["DA-001", "SY-001", "FU-001"]);
  });

  it("criticality follows the rounding of the overall column", () => {
    const f = { ...NO_ASSET_FILTER, minLevel: 2 };
    expect(ids(filterAssets(ASSETS, f, "round"))).not.toContain("DA-002");
    expect(ids(filterAssets(ASSETS, f, "ceil"))).toContain("DA-002");
    expect(assetCriticalityLevel(ASSETS[1], "ceil")).toBe(2);
  });

  it("unrated assets on request", () => {
    const f = { ...NO_ASSET_FILTER, minLevel: 4, includeUnrated: true };
    expect(ids(filterAssets(ASSETS, f))).toEqual(["DA-001", "PH-001", "FU-001"]);
  });

  it("type and criticality combine (AND)", () => {
    const f = { types: ["data"] as AssetGroup[], minLevel: 2, includeUnrated: false };
    expect(ids(filterAssets(ASSETS, f))).toEqual(["DA-001"]);
  });

  it("type counts: only the types present, in config order", () => {
    expect(assetTypeCounts(ASSETS)).toEqual([
      { type: "data", count: 2 },
      { type: "function", count: 1 },
      { type: "system", count: 1 },
      { type: "physical", count: 1 },
    ]);
  });
});
