// src/tests/unit/app/utils/dfd-to-asset-mapper.contract.test.ts
//
// Field-contract for mapDFDAssetsToAssetFeature — the DFD→Feature sync boundary.
//
// TARAflow's asset ownership split (confirmed design):
//   DFD world      owns: existence, relations, structural + technical
//                        properties (portability, …), and protectionNeed
//                        (canonical on DFDAsset, edited in the DFD form).
//   Feature world  owns: impact ratings, security goals (CIANAAA).
//   Shared:        name, description  (bidirectional, mirrored in
//                  workspace-layout's handleDFDUpdate / handleAssetsUpdate).
//   One-way DFD→Feature (read-only in Feature): protectionNeed, so the impact
//                  assessment can read the protection need without editing it.
//
// This mapper is the ONE place the DFD→Feature projection happens. The bugs we
// chased ("portability never reaches the Asset tab") were NOT bugs — properties
// are deliberately DFD-only. So the contract is a POSITIVE list (fields that
// must cross) AND a NEGATIVE list (fields that must NOT), because the dangerous
// regression in either direction is silent: adding properties to the projection
// would leak DFD-only data into the Feature world and re-create two-world drift.
//
// This replaces dfd-asset-feature-update-wired.test.ts, which asserted the
// opposite (that DFD property edits must reach the Feature store) and was based
// on a wrong premise.

import { describe, it, expect } from "vitest";
import { mapDFDAssetsToAssetFeature } from "app/utils/dfd-to-asset-mapper";
import type { DFDAsset } from "features/dfd/models/dfd-asset-types";

function makeDfdAsset(overrides: Partial<DFDAsset> = {}): DFDAsset {
  return {
    id: "PH-001",
    displayId: "PH-001",
    name: "Sensor",
    description: "BLE pressure sensor",
    assetGroup: "physical",
    protectionNeed: "medium",
    linkedElements: [],
    properties: {
      portability: "portable",
      // a stale mirror that must never win / never leak
      protectionNeed: "low",
    },
    ...overrides,
  } as DFDAsset;
}

describe("mapDFDAssetsToAssetFeature — field contract", () => {
  it("carries the shared + structural fields into the Feature world", () => {
    const [ref] = mapDFDAssetsToAssetFeature([makeDfdAsset()], [], []);

    expect(ref.id).toBe("PH-001");
    expect(ref.name).toBe("Sensor");
    expect(ref.description).toBe("BLE pressure sensor");
    expect(ref.assetGroup).toBe("physical");
    expect(ref.linkedElements).toEqual([]);
  });

  it("carries protectionNeed one-way from the canonical top-level field", () => {
    const [ref] = mapDFDAssetsToAssetFeature([makeDfdAsset()], [], []);
    // canonical top-level "medium" must win over the stale properties mirror "low"
    expect(ref.protectionNeed).toBe("medium");
  });

  it("does NOT leak DFD-only properties into the Feature world", () => {
    // The core boundary guard. portability (and the whole `properties` bag)
    // is DFD-owned and must never appear on the Feature reference. If someone
    // later adds `properties: asset.properties` to the mapper "to be helpful",
    // this fails — which is exactly the regression we want to catch.
    const [ref] = mapDFDAssetsToAssetFeature([makeDfdAsset()], [], []) as any[];

    expect(ref.properties).toBeUndefined();
    expect(ref.portability).toBeUndefined();
  });

  it("does NOT carry Feature-owned assessment fields", () => {
    // impactRatings / securityGoals are owned by the Feature world and are
    // never sourced from the DFD projection. Guard against accidental addition.
    const [ref] = mapDFDAssetsToAssetFeature([makeDfdAsset()], [], []) as any[];

    expect(ref.impactRatings).toBeUndefined();
    expect(ref.securityGoals).toBeUndefined();
    expect(ref.overallImpact).toBeUndefined();
  });

  it("exposes exactly the agreed key-set (freezes the contract)", () => {
    const [ref] = mapDFDAssetsToAssetFeature([makeDfdAsset()], [], []);
    // Adjust ONLY when the ownership split intentionally changes — this is the
    // single source of truth for what crosses the DFD→Feature boundary.
    expect(Object.keys(ref).sort()).toEqual(
      [
        "assetGroup",
        "description",
        "displayId",
        "id",
        "linkedElements",
        "name",
        "protectionNeed",
      ].sort(),
    );
  });
});
