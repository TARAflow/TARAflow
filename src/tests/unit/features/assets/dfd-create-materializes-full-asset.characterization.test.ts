// src/tests/unit/features/assets/dfd-create-materializes-full-asset.characterization.test.ts
//
// Phase 5c NET (single canonical store). Pins the invariant the single-store
// switch must preserve: creating an asset FROM the DFD materializes a COMPLETE
// feature Asset record — structural fields set from the DFD, analytical fields
// present with empty defaults (impactRatings, securityGoals). The asset tab
// later fills those analytical fields on the SAME record.
//
// Today this happens indirectly (DFD writes dfd.assets → syncFromDFD mints the
// feature record). Under decision A the DFD create will write the one feature
// store directly; this test guards that the resulting record is still complete
// with the same empty analytical defaults — so nothing regresses when the
// second store goes away.

import { describe, it, expect } from "vitest";
import { syncFromDFD } from "features/assets/services/asset-sync-service";
import { createDefaultAssetData } from "features/assets/services/asset-factory";
import { mapDFDAssetsToAssetFeature } from "app/utils/dfd-to-asset-mapper";
import type { DFDAsset } from "features/dfd/models/dfd-asset-types";

const dfdSeed: DFDAsset = {
  id: "11111111-2222-4333-8444-555555555555",
  displayId: "DA-001",
  name: "Config Data",
  assetGroup: "data",
  protectionNeed: "high",
  linkedElements: [],
  properties: { dataType: ["configuration"], isSafetyFunction: true },
} as unknown as DFDAsset;

function materializeFromDFD(seed: DFDAsset) {
  const assetData = createDefaultAssetData();
  const refs = mapDFDAssetsToAssetFeature([seed], [], []);
  const { assetData: synced } = syncFromDFD(assetData, refs, [], []);
  return synced.assets.find((a) => a.id === seed.id)!;
}

describe("DFD create materializes a complete feature Asset (single-store invariant)", () => {
  const asset = materializeFromDFD(dfdSeed);

  it("sets the structural fields the DFD owns", () => {
    expect(asset.id).toBe(dfdSeed.id);
    expect(asset.displayId).toBe("DA-001");
    expect(asset.name).toBe("Config Data");
    expect(asset.assetGroup).toBe("data");
    expect(asset.properties?.dataType).toEqual(["configuration"]);
    expect(asset.properties?.isSafetyFunction).toBe(true);
    expect(asset.properties?.protectionNeed).toBe("high");
  });

  it("marks provenance as DFD-sourced and synced", () => {
    expect(asset.source).toBe("dfd");
    expect(asset.syncedWithDFD).toBe(true);
  });

  it("provides the analytical fields with empty defaults (asset tab fills them later)", () => {
    // impactRatings: present as an array (one entry per impact criterion),
    // each with no value yet.
    expect(Array.isArray(asset.impactRatings)).toBe(true);
    expect(
      asset.impactRatings.every(
        (r: any) => r.value === undefined || r.value === null || r.value === "",
      ),
    ).toBe(true);

    // securityGoals: present as an array (one entry per CIANAAA goal).
    expect(Array.isArray(asset.securityGoals)).toBe(true);
    expect(asset.securityGoals.length).toBeGreaterThan(0);

    // overallImpact is computed (defined), not left missing.
    expect(asset.overallImpact).toBeDefined();

    // No high-value classification asserted by the DFD create.
    expect(asset.properties?.isHighValueAsset).toBeUndefined();
  });
});
