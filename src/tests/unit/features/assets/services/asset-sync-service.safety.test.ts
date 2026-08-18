// src/tests/unit/features/assets/services/asset-sync-service.safety.test.ts
//
// Regression coverage for the second hop of the safety-annotation bug:
// syncFromDFD receives dfdAsset.linkedElements (now correctly carrying
// `safety`, per the mapper fix) and must (a) copy it onto
// Asset.linkedDFDElements unchanged, and (b) feed it into
// deriveAndApplyImpacts so physicalImpact/aggregatedImpact reflect it.
//
// Also isolates a second, independently-discovered gap while writing this
// suite: deriveAndApplyImpacts is only called on the "update existing
// asset" branch, never on first creation (see the "new asset" describe
// block below) — this test intentionally makes that explicit rather than
// silently working around it.

import { describe, it, expect } from "vitest";
import { syncFromDFD } from "features/assets/services/asset-sync-service";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets";
import type { AssetData, Asset, AssetDFDAsset } from "features/assets";

function makeAssetData(assets: Asset[] = []): AssetData {
  return {
    configuration: DEFAULT_ASSET_CONFIGURATION,
    assets,
    lastModified: "2026-01-01T00:00:00.000Z",
  };
}

function makeExistingAsset(overrides: Partial<Asset> = {}): Asset {
  return {
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
    ...overrides,
  } as Asset;
}

function makeDfdAssetRef(overrides: Partial<AssetDFDAsset> = {}): AssetDFDAsset {
  return {
    id: "DA-001",
    displayId: "DA-001",
    name: "Meassure Data",
    assetGroup: "data",
    protectionNeed: "low",
    linkedElements: [],
    ...overrides,
  } as AssetDFDAsset;
}

describe("syncFromDFD — safety propagation (existing asset)", () => {
  it("copies safety from dfdAsset.linkedElements onto Asset.linkedDFDElements", () => {
    const existing = makeAssetData([makeExistingAsset()]);
    const dfdAsset = makeDfdAssetRef({
      linkedElements: [
        {
          elementId: "el-1",
          elementName: "Cloud Synchronization",
          elementType: "Process",
          displayId: "P-4",
          relationType: "reads",
          safety: { relevance: "direct", impact: "fatality" },
        },
      ],
    });

    const { assetData } = syncFromDFD(existing, [dfdAsset], [], []);
    const asset = assetData.assets.find((a) => a.id === "DA-001");

    expect(asset?.linkedDFDElements[0].safety).toEqual({
      relevance: "direct",
      impact: "fatality",
    });
  });

  it("Safety Override Rule: direct + fatality → aggregatedImpact CRITICAL, regardless of low business impact", () => {
    // Business impact alone (all criteria = 1/low) would not yield CRITICAL —
    // this is the exact real-world case (DA-001) that exposed the bug.
    const existing = makeAssetData([makeExistingAsset()]);
    const dfdAsset = makeDfdAssetRef({
      linkedElements: [
        {
          elementId: "el-1",
          elementName: "Cloud Synchronization",
          elementType: "Process",
          displayId: "P-4",
          relationType: "reads",
          safety: { relevance: "direct", impact: "fatality" },
        },
      ],
    });

    const { assetData } = syncFromDFD(existing, [dfdAsset], [], []);
    const asset = assetData.assets.find((a) => a.id === "DA-001");

    expect(asset?.physicalImpact).toBe("fatality");
    expect(asset?.physicalImpactSource).toBe("derived");
    expect(asset?.aggregatedImpact).toBe("CRITICAL");
  });

  it("indirect relevance does NOT trigger the override, even with fatality impact", () => {
    // Per safety-types.ts: "fatality + relevance:'indirect' does NOT trigger
    // override → HIGH+ only." Guards against an overly aggressive fix.
    const existing = makeAssetData([makeExistingAsset()]);
    const dfdAsset = makeDfdAssetRef({
      linkedElements: [
        {
          elementId: "el-1",
          elementName: "Cloud Synchronization",
          elementType: "Process",
          displayId: "P-4",
          relationType: "reads",
          safety: { relevance: "indirect", impact: "fatality" },
        },
      ],
    });

    const { assetData } = syncFromDFD(existing, [dfdAsset], [], []);
    const asset = assetData.assets.find((a) => a.id === "DA-001");

    expect(asset?.aggregatedImpact).not.toBe("CRITICAL");
  });

  it("respects a manual physicalImpact override — does not let DFD safety data overwrite it", () => {
    const existing = makeAssetData([
      makeExistingAsset({
        physicalImpact: "reversible_injury",
        physicalImpactSource: "manual",
        physicalImpactRationale: "Analyst assessment overrides DFD signal",
      }),
    ]);
    const dfdAsset = makeDfdAssetRef({
      linkedElements: [
        {
          elementId: "el-1",
          elementName: "Cloud Synchronization",
          elementType: "Process",
          displayId: "P-4",
          relationType: "reads",
          safety: { relevance: "direct", impact: "fatality" },
        },
      ],
    });

    const { assetData } = syncFromDFD(existing, [dfdAsset], [], []);
    const asset = assetData.assets.find((a) => a.id === "DA-001");

    expect(asset?.physicalImpact).toBe("reversible_injury");
    expect(asset?.physicalImpactSource).toBe("manual");
  });
});

describe("syncFromDFD — safety propagation (brand-new asset, first sync)", () => {
  it("derives physicalImpact/aggregatedImpact immediately on creation, not just on a later update", () => {
    // Was previously a KNOWN GAP: deriveAndApplyImpacts ran only in the
    // "update existing" branch. A freshly created asset's linkedDFDElements
    // is set to exactly the incoming value, so it can never look "changed"
    // on a subsequent sync — without deriving on creation too, such an
    // asset would be permanently stuck with no physicalImpact. Fixed by
    // calling deriveAndApplyImpacts in the creation branch as well.
    const empty = makeAssetData([]); // asset does not exist yet
    const dfdAsset = makeDfdAssetRef({
      linkedElements: [
        {
          elementId: "el-1",
          elementName: "Cloud Synchronization",
          elementType: "Process",
          displayId: "P-4",
          relationType: "reads",
          safety: { relevance: "direct", impact: "fatality" },
        },
      ],
    });

    const { assetData, newAssets } = syncFromDFD(empty, [dfdAsset], [], []);
    const asset = assetData.assets.find((a) => a.id === "DA-001");

    expect(newAssets).toContain("DA-001");
    expect(asset?.physicalImpact).toBe("fatality");
    expect(asset?.physicalImpactSource).toBe("derived");
    expect(asset?.aggregatedImpact).toBe("CRITICAL");
  });

  it("stays correctly derived across a repeat sync with no further changes (does not get stuck, nothing to get stuck ON anymore)", () => {
    const empty = makeAssetData([]);
    const dfdAsset = makeDfdAssetRef({
      linkedElements: [
        {
          elementId: "el-1",
          elementName: "Cloud Synchronization",
          elementType: "Process",
          displayId: "P-4",
          relationType: "reads",
          safety: { relevance: "direct", impact: "fatality" },
        },
      ],
    });

    const { assetData: afterFirstSync } = syncFromDFD(empty, [dfdAsset], [], []);
    const { assetData: afterSecondSync, hasChanges } = syncFromDFD(
      afterFirstSync,
      [dfdAsset],
      [],
      [],
    );
    const asset = afterSecondSync.assets.find((a) => a.id === "DA-001");

    // Nothing actually changed between the two syncs — correctly a no-op —
    // but the value from the FIRST sync is already right, so there's
    // nothing left to "pick up" the way the old (wrong) test assumed.
    expect(hasChanges).toBe(false);
    expect(asset?.physicalImpact).toBe("fatality");
    expect(asset?.aggregatedImpact).toBe("CRITICAL");
  });
});