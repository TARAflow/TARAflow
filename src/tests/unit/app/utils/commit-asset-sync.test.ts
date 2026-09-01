// tests/unit/app/utils/commit-asset-sync.test.ts
//
// Phase 2 coverage for the asset-sync chokepoint (asset-store-ssot-refactor-v2.md).
// commitAssetSync is pure, so we exercise it directly against real fixtures.
//
// ⚠ adjust import paths to your aliases if needed.

import { describe, it, expect } from "vitest";

import { commitAssetSync } from "app/utils/commit-asset-sync";
import { loadProjectFixture, FIXTURES } from "../../../fixtures/load-fixture";

describe("Phase 2 — commitAssetSync", () => {
  it("backfill repairs drifted stores (prev = undefined)", () => {
    const project = loadProjectFixture(FIXTURES.smokeDetector);

    const repaired = commitAssetSync(undefined, project);

    // The fixture has drifted: assets.linkedDFDElements is stale vs dfd.assets.
    // Backfill must produce a new object with re-synced AssetData.
    expect(repaired).not.toBe(project);
    expect(repaired.assets).not.toBe(project.assets);

    // DA-002 link[1] was stale (DF-8); the live DFD has DF-9 → must be repaired.
    const da002 = repaired.assets!.assets.find((a) => a.id === "DA-002")!;
    expect(da002.linkedDFDElements[1].displayId).toBe("DF-9");

    // Manual safety override must survive the sync.
    expect(da002.physicalImpact).toBe("fatality");
    expect(da002.physicalImpactSource).toBe("manual");
  });

  it("is idempotent: a second forced sync is a no-op", () => {
    const project = loadProjectFixture(FIXTURES.smokeDetector);

    const first = commitAssetSync(undefined, project); // repairs drift
    const second = commitAssetSync(undefined, first); // nothing left to repair

    // No further change → same object returned by reference.
    expect(second).toBe(first);
  });

  it("write-path reference guard: unchanged dfd.assets → skip sync", () => {
    const project = loadProjectFixture(FIXTURES.smokeDetector);

    // prev and next share the same dfd.assets reference → guard short-circuits,
    // returns next untouched (re-sync on writes only when DFD assets changed).
    const result = commitAssetSync(project, project);
    expect(result).toBe(project);
  });

  it("no AssetData → returns project untouched", () => {
    const empty = loadProjectFixture(FIXTURES.simpleTest);
    expect(commitAssetSync(undefined, empty)).toBe(empty);
  });
});

describe("Phase 5c — single-store load (dfd.assets derived from feature store)", () => {
  // A project persisted WITHOUT the dfd.assets mirror: the canonical feature
  // store holds the (dfd-sourced) assets, dfd has only the elements +
  // assetRelations that reference them.
  const uuid = "11111111-2222-4333-8444-555555555555";
  const project: any = {
    id: "p",
    assets: {
      assets: [
        {
          id: uuid,
          displayId: "DA-001",
          name: "Config Data",
          assetGroup: "data",
          source: "dfd",
          syncedWithDFD: true,
          impactRatings: [],
          securityGoals: [],
          linkedDFDElements: [],
          properties: {},
        },
        {
          id: "manual-1",
          displayId: "DA-002",
          name: "Manual only",
          assetGroup: "data",
          source: "manual",
          impactRatings: [],
          securityGoals: [],
          linkedDFDElements: [],
          properties: {},
        },
      ],
      configuration: {},
    },
    dfd: {
      assets: [], // stripped
      elements: [
        {
          id: "3",
          type: "Process",
          name: "MyProcess",
          displayId: "P-1",
          assetRelations: [{ assetId: uuid, relationType: "creates" }],
        },
      ],
      connections: [],
    },
  };

  it("derives dfd.assets from the feature store instead of pruning it", () => {
    const out = commitAssetSync(undefined, project);

    // dfd.assets rebuilt from the dfd-sourced feature asset...
    expect(out.dfd!.assets.map((a: any) => a.id)).toEqual([uuid]);
    const derived = out.dfd!.assets[0];
    expect(derived.displayId).toBe("DA-001");
    expect(derived.assetGroup).toBe("data");
    // ...with its link derived from the element's assetRelation.
    expect(derived.linkedElements?.[0]?.elementId).toBe("3");

    // The feature store is left intact — the dfd-sourced asset is NOT pruned,
    // and the manual-only asset is untouched.
    expect(out.assets!.assets.map((a: any) => a.id).sort()).toEqual(
      [uuid, "manual-1"].sort(),
    );
  });

  it("excludes manual-only assets from the derived dfd.assets", () => {
    const out = commitAssetSync(undefined, project);
    expect(out.dfd!.assets.some((a: any) => a.id === "manual-1")).toBe(false);
  });
});
