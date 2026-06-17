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
