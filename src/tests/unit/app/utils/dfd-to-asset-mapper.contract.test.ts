// src/tests/unit/app/utils/dfd-to-asset-mapper.contract.test.ts
//
// Field-contract for mapDFDAssetsToAssetFeature — the DFD→Feature sync boundary.
//
// TARAflow's asset ownership split (SoT model — one canonical store):
//   DFD tab        EDITS: existence, relations, structural + technical
//                        properties (dataType, portability, …), and
//                        protectionNeed. It no longer owns a separate store —
//                        those edits are STORED in the one feature store.
//   Asset tab      EDITS: impact ratings, security goals (CIANAAA), HVA block.
//   Shared:        name, description  (bidirectional).
//
// Under the single-source-of-truth consolidation there is only ONE asset store
// (the feature store). The structural `properties` bag is edited in the DFD tab
// but must be STORED on the feature Asset — there is nowhere else for it to
// live. So the mapper carries `properties` across (as well as protectionNeed).
//
// NOTE: an earlier version of this test asserted the OPPOSITE (properties are
// "deliberately DFD-only" and must never cross), written under the former
// two-world model. That model is exactly what the consolidation dissolves:
// with one store there is no second world to drift against, so carrying
// properties is required, not a leak.

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

  it("carries the structural properties into the Feature world (one store)", () => {
    // Under SoT the DFD-edited properties are stored on the feature Asset.
    // The mapper must project them through so the sync can land them.
    const [ref] = mapDFDAssetsToAssetFeature([makeDfdAsset()], [], []) as any[];

    expect(ref.properties).toBeDefined();
    expect(ref.properties.portability).toBe("portable");
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
        "properties",
        "protectionNeed",
      ].sort(),
    );
  });
});
