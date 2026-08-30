// tests/unit/features/assets/services/asset-sync-property-drop.golden.test.ts
//
// Phase 4 NET of the Asset-Store SoT refactor (see asset-store-ssot-refactor-v2.md, §3.1).
//
// PURPOSE: pin the CURRENT (deliberately lossy) behaviour before Phase 4 merges the
// two property bags. It does NOT assert what SHOULD happen — it locks in what does.
//
// Finding §3.1: the rich, category-specific `DFDAsset.properties` block
// (dataType, isSafetyFunction, automationLevel, containsSafetyRelevantData,
// externalRefs, …) never reaches AssetData through the DFD → AssetData path.
// The projection type `AssetDFDAsset` (mapDFDAssetsToAssetFeature's output) has
// NO `properties` channel at all, so the fields are dropped at the mapping
// boundary, before syncFromDFD ever sees them. Only `protectionNeed` is carried
// (into Asset.properties.protectionNeed).
//
// When Phase 4 gives Asset a canonical merged property schema and points the
// form at it, THIS test must be updated consciously — that update is the signal
// that the data-loss seam has been closed on purpose.

import { describe, it, expect } from "vitest";

import { syncFromDFD } from "features/assets/services/asset-sync-service";
import { createDefaultAssetData } from "features/assets/services/asset-factory";
import { mapDFDAssetsToAssetFeature } from "app/utils/dfd-to-asset-mapper";
import type { DFDAsset } from "features/dfd/models/dfd-asset-types";

/**
 * A Data-group DFD asset carrying the rich category-specific properties that an
 * analyst edits through the DFD asset form (which writes DFDAsset.properties).
 */
const dfdAssetWithRichProps: DFDAsset = {
  id: "DA-001",
  displayId: "DA-001",
  name: "Calibration Data",
  assetGroup: "data",
  protectionNeed: "high",
  linkedElements: [],
  properties: {
    category: "data",
    protectionNeed: "high",
    // --- DFD-only category fields (the ones §3.1 says are dropped) ---
    dataType: ["configuration"],
    lifecycle: "stored",
    containsSafetyRelevantData: true,
    isSafetyFunction: true,
    automationLevel: "fully_automated",
  },
} as unknown as DFDAsset;

function runSyncFor(dfdAsset: DFDAsset) {
  const assetData = createDefaultAssetData();
  const refs = mapDFDAssetsToAssetFeature([dfdAsset], [], []);
  const { assetData: synced } = syncFromDFD(assetData, refs, [], []);
  return synced.assets.find((a) => a.id === dfdAsset.id);
}

describe("§3.1 — DFDAsset.properties is dropped on the DFD → AssetData sync path", () => {
  it("creates the asset record (id / name / group survive)", () => {
    const asset = runSyncFor(dfdAssetWithRichProps);
    expect(asset).toBeDefined();
    expect(asset!.name).toBe("Calibration Data");
    expect(asset!.assetGroup).toBe("data");
  });

  it("carries protectionNeed into Asset.properties (the one field that survives)", () => {
    const asset = runSyncFor(dfdAssetWithRichProps);
    expect(asset!.properties?.protectionNeed).toBe("high");
  });

  it("DROPS the rich DFD category fields — pins the §3.1 data loss", () => {
    const asset = runSyncFor(dfdAssetWithRichProps);
    const props = (asset!.properties ?? {}) as Record<string, unknown>;

    // None of the DFD-only category fields make it across today.
    expect(props.dataType).toBeUndefined();
    expect(props.lifecycle).toBeUndefined();
    expect(props.containsSafetyRelevantData).toBeUndefined();
    expect(props.isSafetyFunction).toBeUndefined();
    expect(props.automationLevel).toBeUndefined();
  });

  it("confirms the loss happens at the projection boundary (AssetDFDAsset has no properties channel)", () => {
    const [ref] = mapDFDAssetsToAssetFeature([dfdAssetWithRichProps], [], []);
    // The reference the sync consumes never carries properties at all.
    expect((ref as unknown as Record<string, unknown>).properties).toBeUndefined();
  });
});
