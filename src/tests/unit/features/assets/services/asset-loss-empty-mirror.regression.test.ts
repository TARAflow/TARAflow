// tests/unit/features/assets/services/asset-loss-empty-mirror.regression.test.ts
//
// REGRESSION: silent loss of canonical (feature-store) assets.
//
// Root cause: syncFromDFD prunes every source:"dfd" asset that is absent from
// the dfd.assets mirror. But the mirror is stripped to [] on disk
// (prepare-for-disk) and re-derived on load, and edits can hand syncFromDFD a
// partial/empty mirror. Running the prune against an EMPTY mirror therefore
// wipes every DFD-sourced record from the canonical store — the "we keep
// losing assets" bug from the two-store rework.
//
// Fix (a): syncFromDFD must never prune when the incoming mirror is empty.
// Genuine removals (a non-empty mirror that no longer lists an asset) still
// prune, so canvas delete keeps working until the SSOT refactor removes
// record-removal from syncFromDFD altogether.

import { describe, it, expect } from "vitest";

import { syncFromDFD } from "features/assets/services/asset-sync-service";
import { createDefaultAssetData } from "features/assets/services/asset-factory";
import { assetService } from "features/assets/services/asset-service";
import type { AssetData } from "features/assets/models/asset-types";

function storeWith(
  assets: Array<{ id: string; source: "dfd" | "manual"; name?: string }>,
): AssetData {
  const base = createDefaultAssetData();
  return {
    ...base,
    assets: assets.map((a, i) => ({
      id: a.id,
      numericId: i + 1,
      displayId: a.id,
      name: a.name ?? a.id,
      assetGroup: "data",
      source: a.source,
      syncedWithDFD: a.source === "dfd",
      linkedDFDElements: [],
      properties: {},
      securityGoals: [],
      impactRatings: [],
      overallImpact: 0,
      physicalImpactSource: "derived",
      lastModified: "<t>",
      created: "<t>",
    })) as unknown as AssetData["assets"],
  };
}

describe("syncFromDFD — asset-loss regression (empty mirror must not prune)", () => {
  it("keeps a DFD-sourced asset when the dfd.assets mirror is empty (load path)", () => {
    const store = storeWith([{ id: "A1", source: "dfd", name: "Config Data" }]);

    // Empty mirror = stripped on disk / not yet derived — NOT "all deleted".
    const { assetData, warnings } = syncFromDFD(store, [], [], []);

    expect(assetData.assets.map((a) => a.id)).toContain("A1");
    expect(warnings.join(" ")).not.toMatch(/no longer in DFD/);
  });

  it("keeps every asset (dfd + manual) against an empty mirror", () => {
    const store = storeWith([
      { id: "A1", source: "dfd" },
      { id: "A2", source: "dfd" },
      { id: "M1", source: "manual" },
    ]);

    const { assetData } = syncFromDFD(store, [], [], []);

    expect(assetData.assets.map((a) => a.id).sort()).toEqual([
      "A1",
      "A2",
      "M1",
    ]);
  });

  it("SSOT: does NOT remove a record even when absent from a non-empty mirror", () => {
    // Post-Phase-4: syncFromDFD is create/update only. An asset missing from
    // the mirror is NOT pruned — it persists in the canonical store (orphaned)
    // and removal is an explicit user action, never a mirror-diff side effect.
    const store = storeWith([
      { id: "A1", source: "dfd" },
      { id: "A2", source: "dfd" },
    ]);
    const mirror = [
      {
        id: "A1",
        displayId: "A1",
        name: "A1",
        assetGroup: "data" as const,
        linkedElements: [],
      },
    ];

    const { assetData, warnings } = syncFromDFD(store, mirror, [], []);

    const ids = assetData.assets.map((a) => a.id);
    expect(ids).toContain("A1");
    expect(ids).toContain("A2"); // persists — not pruned
    expect(warnings.join(" ")).not.toMatch(/no longer in DFD/);
  });

  it("explicit deleteAsset still removes a record (removal is intentional, not implicit)", () => {
    const store = storeWith([
      { id: "A1", source: "dfd" },
      { id: "A2", source: "dfd" },
    ]);

    const after = assetService.deleteAsset(store, "A2");

    expect(after.assets.map((a) => a.id)).toEqual(["A1"]);
  });
});
