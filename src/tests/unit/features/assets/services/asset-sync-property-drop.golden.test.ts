// tests/unit/features/assets/services/asset-sync-property-drop.golden.test.ts
//
// Phase 4 of the Asset-Store SoT refactor (see asset-store-ssot-refactor-v2.md, §3.1).
//
// This test previously PINNED the lossy behaviour (properties dropped on the
// DFD → AssetData path). Phase 4b-iii closed that seam: AssetDFDAsset now
// carries a `properties` channel, mapDFDAssetsToAssetFeature passes
// DFDAsset.properties through, and syncFromDFD merges them into
// Asset.properties. So the test now asserts the OPPOSITE — the rich
// category-specific properties survive — which is the conscious update the
// original drop-test asked for.

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

describe("§3.1 (closed) — DFDAsset.properties now flows to AssetData via sync", () => {
  it("creates the asset record (id / name / group survive)", () => {
    const asset = runSyncFor(dfdAssetWithRichProps);
    expect(asset).toBeDefined();
    expect(asset!.name).toBe("Calibration Data");
    expect(asset!.assetGroup).toBe("data");
  });

  it("carries protectionNeed into Asset.properties", () => {
    const asset = runSyncFor(dfdAssetWithRichProps);
    expect(asset!.properties?.protectionNeed).toBe("high");
  });

  it("CARRIES the rich DFD category fields through to Asset.properties", () => {
    const asset = runSyncFor(dfdAssetWithRichProps);
    const props = (asset!.properties ?? {}) as Record<string, unknown>;

    expect(props.dataType).toEqual(["configuration"]);
    expect(props.lifecycle).toBe("stored");
    expect(props.containsSafetyRelevantData).toBe(true);
    expect(props.isSafetyFunction).toBe(true);
    expect(props.automationLevel).toBe("fully_automated");
  });

  it("exposes the properties channel on the projection (AssetDFDAsset carries properties)", () => {
    const [ref] = mapDFDAssetsToAssetFeature([dfdAssetWithRichProps], [], []);
    expect((ref as unknown as Record<string, unknown>).properties).toBeDefined();
  });
});
