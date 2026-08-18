// src/tests/unit/app/dfd-safety-pipeline.test.ts
//
// End-to-end regression test for the DA-001 production bug: a
// SafetyAnnotation (relevance: "direct", impact: "fatality") set on an
// element→asset relation via the Asset Relation Selector never reached
// Asset.physicalImpact / aggregatedImpact.
//
// Deliberately uses the REAL mapDFDAssetsToAssetFeature and the REAL
// syncFromDFD together, no mocks — mocking either one would hide exactly
// the class of bug this guards against (a field silently dropped between
// two modules that each look correct in isolation).

import { describe, it, expect } from "vitest";
import { mapDFDAssetsToAssetFeature } from "app/utils/dfd-to-asset-mapper";
import { syncFromDFD } from "features/assets/services/asset-sync-service";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets";
import type { AssetData, Asset } from "features/assets";
import type { DFDAsset, DFDElement } from "features/dfd";

describe("DFD safety annotation → Asset impact (full pipeline, DA-001 regression)", () => {
  it("propagates a direct+fatality safety annotation all the way to aggregatedImpact CRITICAL", () => {
    // ---- Arrange: reproduce the exact real-world shape ----
    const dfdAsset: DFDAsset = {
      id: "DA-001",
      displayId: "DA-001",
      name: "Meassure Data",
      assetGroup: "data",
      protectionNeed: "low",
    } as DFDAsset;

    const element: DFDElement = {
      id: "el-p4",
      displayId: "P-4",
      name: "Cloud Synchronization",
      type: "Process",
      position: { x: 0, y: 0 },
      size: { width: 100, height: 60 },
      properties: {},
      assetRelations: [
        {
          assetId: "DA-001",
          assetGroup: "data",
          relationType: "reads",
          safety: {
            relevance: "direct",
            impact: "fatality",
            physicalHazardPotential: "high",
            rationale: "Regression fixture — see DA-001 production incident",
          },
        } as any,
      ],
    } as DFDElement;

    // Asset already exists with only LOW business impact (all 5 criteria = 1) —
    // this is what made the bug invisible: without safety, LOW is the
    // objectively correct result, so nothing looked "obviously wrong" until
    // the CRITICAL override was checked for specifically.
    const existingAsset: Asset = {
      id: "DA-001",
      numericId: 1,
      name: "Meassure Data",
      assetGroup: "data",
      impactRatings: [
        { criterionId: "financial_damage", value: 1 },
        { criterionId: "operational", value: 1 },
        { criterionId: "regulatory_compliance", value: 1 },
        { criterionId: "privacy", value: 1 },
        { criterionId: "reputation", value: 1 },
      ],
      overallImpact: 1,
      securityGoals: [],
      linkedDFDElements: [],
      source: "dfd",
      syncedWithDFD: true,
      properties: {},
      created: "2026-01-01T00:00:00.000Z",
      lastModified: "2026-01-01T00:00:00.000Z",
    } as Asset;

    const assetData: AssetData = {
      configuration: DEFAULT_ASSET_CONFIGURATION,
      assets: [existingAsset],
      lastModified: "2026-01-01T00:00:00.000Z",
    };

    // ---- Act: the real pipeline, exactly as commit-asset-sync.ts runs it ----
    const dfdAssetReferences = mapDFDAssetsToAssetFeature(
      [dfdAsset],
      [element],
      [],
    );
    const { assetData: result } = syncFromDFD(
      assetData,
      dfdAssetReferences,
      [],
      [],
    );

    // ---- Assert: the exact regression ----
    const asset = result.assets.find((a) => a.id === "DA-001");
    expect(asset).toBeDefined();
    expect(asset?.physicalImpact).toBe("fatality");
    expect(asset?.physicalImpactSource).toBe("derived");
    expect(asset?.aggregatedImpact).toBe("CRITICAL");

    // And a sanity check that this ISN'T just because business impact was
    // secretly high — it genuinely is all-LOW, safety alone drives CRITICAL.
    expect(asset?.overallImpact).toBeLessThanOrEqual(1);
  });

  it("without any safety annotation, the same asset stays at its business-driven LOW impact", () => {
    // Control case — proves the previous test's CRITICAL result is caused
    // by the safety annotation, not by some other change in the fixture.
    const dfdAsset: DFDAsset = {
      id: "DA-001",
      displayId: "DA-001",
      name: "Meassure Data",
      assetGroup: "data",
      protectionNeed: "low",
    } as DFDAsset;

    const element: DFDElement = {
      id: "el-p4",
      displayId: "P-4",
      name: "Cloud Synchronization",
      type: "Process",
      position: { x: 0, y: 0 },
      size: { width: 100, height: 60 },
      properties: {},
      assetRelations: [
        { assetId: "DA-001", assetGroup: "data", relationType: "reads" } as any,
      ],
    } as DFDElement;

    const existingAsset: Asset = {
      id: "DA-001",
      numericId: 1,
      name: "Meassure Data",
      assetGroup: "data",
      impactRatings: [
        { criterionId: "financial_damage", value: 1 },
        { criterionId: "operational", value: 1 },
        { criterionId: "regulatory_compliance", value: 1 },
        { criterionId: "privacy", value: 1 },
        { criterionId: "reputation", value: 1 },
      ],
      overallImpact: 1,
      securityGoals: [],
      linkedDFDElements: [],
      source: "dfd",
      syncedWithDFD: true,
      properties: {},
      created: "2026-01-01T00:00:00.000Z",
      lastModified: "2026-01-01T00:00:00.000Z",
    } as Asset;

    const assetData: AssetData = {
      configuration: DEFAULT_ASSET_CONFIGURATION,
      assets: [existingAsset],
      lastModified: "2026-01-01T00:00:00.000Z",
    };

    const dfdAssetReferences = mapDFDAssetsToAssetFeature(
      [dfdAsset],
      [element],
      [],
    );
    const { assetData: result } = syncFromDFD(
      assetData,
      dfdAssetReferences,
      [],
      [],
    );

    const asset = result.assets.find((a) => a.id === "DA-001");
    expect(asset?.physicalImpact).toBeUndefined();
    expect(asset?.aggregatedImpact).not.toBe("CRITICAL");
  });
});
