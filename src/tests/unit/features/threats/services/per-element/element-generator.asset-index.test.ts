// ==================== RC-1 — Asset reverse index (buildElementToAssetsIndex) ====================
// Phase: per-element generation fix, Step 1.
//
// Goal: buildElementToAssetsIndex must resolve element↔asset links from the NEW
// `linkedDFDElements` field (asset-store SSoT refactor) while still tolerating the
// LEGACY `linkedElementIds` field for projects saved before the refactor.
//
// RED before fix:  the linkedDFDElements suite fails (index empty) because the
//                  generator reads only `linkedElementIds`.
// GREEN after fix: both suites pass.
//
// Placement: src/features/threats/__tests__/edge2/  (adjust relative paths if you
// colocate differently).

import { describe, it, expect } from "vitest";
import { buildElementToAssetsIndex } from "../../../../../../features/threats/services/per-element/element-generator";
import type { ThreatProjectData } from "features/threats";

import legacyFixture from "../../../../../fixtures/edge2-asset-index.fixture.json";

type AssetDataRef = ThreatProjectData["assetDataRef"];

/** Compare a Map<string,string[]> to a plain { id: string[] } expectation, order-insensitive. */
function expectIndexEquals(
  index: Map<string, string[]>,
  expected: Record<string, string[]>,
): void {
  expect(new Set(index.keys())).toEqual(new Set(Object.keys(expected)));
  for (const [elementId, assetIds] of Object.entries(expected)) {
    expect([...(index.get(elementId) ?? [])].sort()).toEqual([...assetIds].sort());
  }
}

describe("buildElementToAssetsIndex — legacy linkedElementIds (regression guard)", () => {
  it("inverts assets keyed by linkedElementIds into elementId → assetIds[]", () => {
    const index = buildElementToAssetsIndex(
      legacyFixture.assetDataRef as unknown as AssetDataRef,
    );
    expectIndexEquals(index, legacyFixture.expected as Record<string, string[]>);
  });

  it("returns an empty index when assetDataRef is undefined", () => {
    expect(buildElementToAssetsIndex(undefined).size).toBe(0);
  });
});

