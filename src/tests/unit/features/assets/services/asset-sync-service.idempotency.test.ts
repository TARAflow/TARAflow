// src/tests/unit/features/assets/services/asset-sync-service.idempotency.test.ts
//
// Regression coverage for the "assets flicker in and out" class of bug:
// syncFromDFD must be IDEMPOTENT (sync∘sync === sync) and must PRESERVE a
// DFD-only asset when merged onto a base that does not yet contain it.
//
// Why this matters: handleDFDUpdate (workspace-layout.tsx) calls syncFromDFD
// with `current.assets` as the base and the freshly-mapped dfd.assets as the
// incoming set. When a relation is added right after an asset is created, the
// base (read via activeProjectRef) can still lag the DFD by one asset. If
// syncFromDFD were not a stable union over the incoming DFD set, the just-
// created asset would drop out of the result on one sync and reappear on the
// next — the exact "manchmal da, manchmal weg" the user observed. These tests
// pin the two properties that guarantee it cannot.
//
// Pure-function tests: syncFromDFD takes plain data and returns plain data,
// so no hooks, timers, or fixtures are needed here.

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

function makeDfdAssetRef(overrides: Partial<AssetDFDAsset> = {}): AssetDFDAsset {
  return {
    id: "DA-001",
    displayId: "DA-001",
    name: "Measure Data",
    assetGroup: "data",
    protectionNeed: "low",
    linkedElements: [],
    ...overrides,
  } as AssetDFDAsset;
}

function ids(data: AssetData): string[] {
  return data.assets.map((a) => a.id).sort();
}

describe("syncFromDFD — union preservation", () => {
  it("keeps a DFD-only asset when the base lacks it (the create→relate lag case)", () => {
    // base has only DA-001; DFD now also has SV-001 (just created, not yet in
    // the feature store because activeProjectRef lagged by one asset).
    const base = makeAssetData([
      {
        ...(makeDfdAssetToAsset(makeDfdAssetRef({ id: "DA-001" }))),
      },
    ]);
    const dfdAssets = [
      makeDfdAssetRef({ id: "DA-001" }),
      makeDfdAssetRef({ id: "SV-001", name: "Azure AD B2C", assetGroup: "service" }),
    ];

    const { assetData, newAssets } = syncFromDFD(base, dfdAssets, [], []);

    expect(ids(assetData)).toEqual(["DA-001", "SV-001"]);
    expect(newAssets).toContain("SV-001");
  });

  it("adding a relation to one asset does not drop the others", () => {
    const base = makeAssetData([
      makeDfdAssetToAsset(makeDfdAssetRef({ id: "DA-001" })),
      makeDfdAssetToAsset(makeDfdAssetRef({ id: "SV-001", assetGroup: "service" })),
    ]);
    // SV-001 now gains a linked element (the relation to P9).
    const dfdAssets = [
      makeDfdAssetRef({ id: "DA-001" }),
      makeDfdAssetRef({
        id: "SV-001",
        assetGroup: "service",
        linkedElements: [
          {
            elementId: "el-p9",
            elementName: "Azure AD B2C Tenant",
            elementType: "Process",
            displayId: "P-9",
            relationType: "is_an",
          },
        ],
      }),
    ];

    const { assetData } = syncFromDFD(base, dfdAssets, [], []);

    expect(ids(assetData)).toEqual(["DA-001", "SV-001"]);
    const sv = assetData.assets.find((a) => a.id === "SV-001");
    expect(sv?.linkedDFDElements).toHaveLength(1);
    expect(sv?.linkedDFDElements[0].displayId).toBe("P-9");
  });
});

describe("syncFromDFD — idempotency", () => {
  it("a second sync with unchanged input is a no-op (hasChanges === false)", () => {
    const base = makeAssetData([]);
    const dfdAssets = [
      makeDfdAssetRef({ id: "SV-001", assetGroup: "service" }),
    ];

    const first = syncFromDFD(base, dfdAssets, [], []);
    const second = syncFromDFD(first.assetData, dfdAssets, [], []);

    expect(second.hasChanges).toBe(false);
    expect(ids(second.assetData)).toEqual(ids(first.assetData));
    // Same reference returned when nothing changed — cheap identity check the
    // service itself relies on for render-avoidance.
    expect(second.assetData).toBe(first.assetData);
  });

  it("sync∘sync === sync over a mixed multi-group set", () => {
    const base = makeAssetData([]);
    const dfdAssets = [
      makeDfdAssetRef({ id: "DA-001", assetGroup: "data" }),
      makeDfdAssetRef({ id: "SY-001", assetGroup: "system" }),
      makeDfdAssetRef({ id: "PH-001", assetGroup: "physical" }),
      makeDfdAssetRef({ id: "SV-001", assetGroup: "service" }),
    ];

    const once = syncFromDFD(base, dfdAssets, [], []);
    const twice = syncFromDFD(once.assetData, dfdAssets, [], []);

    expect(ids(twice.assetData)).toEqual(ids(once.assetData));
    expect(twice.hasChanges).toBe(false);
  });

  it("does not oscillate: three consecutive syncs converge to a stable id-set", () => {
    let data = makeAssetData([]);
    const dfdAssets = [
      makeDfdAssetRef({ id: "DA-001" }),
      makeDfdAssetRef({ id: "SV-001", assetGroup: "service" }),
    ];

    const snapshots: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const r = syncFromDFD(data, dfdAssets, [], []);
      data = r.assetData;
      snapshots.push(ids(data));
    }

    expect(snapshots[0]).toEqual(["DA-001", "SV-001"]);
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
  });
});

// Minimal DFDAsset → Asset projection so a "base" can contain an asset that
// already looks synced. Mirrors the shape syncFromDFD produces on creation.
function makeDfdAssetToAsset(ref: AssetDFDAsset): Asset {
  return {
    id: ref.id,
    numericId: Number(ref.id.replace(/\D/g, "")) || 1,
    name: ref.name ?? ref.id,
    assetGroup: ref.assetGroup ?? "data",
    impactRatings: DEFAULT_ASSET_CONFIGURATION.impactCriteria.map((c) => ({
      criterionId: c.id,
      value: null,
    })),
    overallImpact: 0,
    securityGoals: [],
    linkedDFDElements: (ref.linkedElements ?? []).map((l) => ({
      elementId: String(l.elementId ?? ""),
      elementName: String(l.elementName ?? ""),
      elementType: String(l.elementType ?? "unknown"),
      displayId: String(l.displayId ?? ""),
      relationType: String(l.relationType ?? ""),
      qualifier: (l as any).qualifier,
      notes: (l as any).notes,
      safety: (l as any).safety,
    })),
    source: "dfd",
    syncedWithDFD: true,
    properties: {
      description: ref.description || undefined,
      protectionNeed: ref.protectionNeed,
    },
    created: "2026-01-01T00:00:00.000Z",
    lastModified: "2026-01-01T00:00:00.000Z",
  } as Asset;
}
