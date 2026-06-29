// ==================== INTEGRATION — asset link → threat reverse index ====================
// Crosses the Dependency-Inversion boundary on purpose, so it lives in
// src/tests/integration/ (not unit/). It drives the real production chain against
// genuine EdGe2 link data, with NO stubs and NO catalog/i18n dependency:
//
//   Asset.linkedDFDElements                         (asset feature, full model)
//     └─ buildAssetDataReference  (app layer)  →  AssetReference.linkedElementIds
//         └─ buildElementToAssetsIndex (threats) →  elementId → assetIds[]
//
// What it locks in:
//   • the app-layer mapper populates linkedElementIds from linkedDFDElements,
//   • the de-duplication (RC-1') survives all the way into the threat index,
//   • the inversion matches the fixture's expected reverse map element-for-element.
//
// Vitest default include ('**/*.{test,spec}...') picks this up automatically;
// no setupFiles needed (the chain touches neither jsdom nor the catalog).

import { describe, it, expect } from "vitest";
import { buildAssetDataReference } from "../../../app/utils/build-asset-data-reference";
import { buildElementToAssetsIndex } from "../../../features/threats/services/per-element/element-generator";
import type { Asset } from "features/assets";

import fixture from "../../fixtures/edge2-asset-index-linked-dfd.fixture.json";

type HazardLinks = Parameters<typeof buildAssetDataReference>[1];
const NO_HAZARDS = {} as HazardLinks;

/** Hydrate a fixture asset ({ id, linkedDFDElements }) into a full Asset. */
function hydrate(fixtureAsset: {
  id: string;
  linkedDFDElements: Array<Record<string, unknown>>;
}): Asset {
  return {
    id: fixtureAsset.id,
    numericId: 0,
    name: `Asset ${fixtureAsset.id}`,
    assetGroup: "data",
    impactRatings: [],
    overallImpact: 0,
    securityGoals: [],
    linkedDFDElements: fixtureAsset.linkedDFDElements,
    source: "dfd",
    syncedWithDFD: true,
    created: "",
    lastModified: "",
  } as unknown as Asset;
}

describe("integration: asset links → AssetDataReference → threat reverse index", () => {
  const hydrated = fixture.assetDataRef.assets.map(hydrate);
  const dataRef = buildAssetDataReference(hydrated, NO_HAZARDS, "4-level");
  const index = buildElementToAssetsIndex(dataRef);
  const expected = fixture.expected as Record<string, string[]>;

  it("inverts real EdGe2 links into the expected elementId → assetIds[] map", () => {
    expect(new Set(index.keys())).toEqual(new Set(Object.keys(expected)));
    for (const [elementId, assetIds] of Object.entries(expected)) {
      expect([...(index.get(elementId) ?? [])].sort()).toEqual(
        [...assetIds].sort(),
      );
    }
  });

  it("propagates RC-1' de-dup into the index (DA-001 once under element 14)", () => {
    // DA-001 links element "14" under two relationTypes in the fixture.
    expect((index.get("14") ?? []).filter((a) => a === "DA-001").length).toBe(1);
  });

  it("maps each asset's linkedElementIds without duplicates", () => {
    for (const ref of dataRef.assets) {
      const ids = ref.linkedElementIds ?? [];
      expect(ids.length).toBe(new Set(ids).size);
    }
  });
});
