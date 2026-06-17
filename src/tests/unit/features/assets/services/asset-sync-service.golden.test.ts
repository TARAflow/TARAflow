// tests/unit/features/assets/services/asset-sync-service.golden.test.ts
//
// Phase 0 of the Asset-Store SoT refactor (see asset-store-ssot-refactor-v2.md).
//
// PURPOSE: a regression NET, captured BEFORE any refactor touches the asset model.
// These tests do not assert what the output "should" be — they pin what it CURRENTLY
// is. Any later phase that changes syncFromDFD / the derivation must update the
// snapshot consciously, which makes accidental behavioural drift impossible to miss.
//
// Two kinds of test here:
//   1. Snapshot characterization of syncFromDFD on real fixtures (robust against the
//      JSON-key-order fragility in the linkedElements comparison — see note below).
//   2. Explicit sentinels for the §3.4 finding (DFD safety-annotation projection is
//      empty in real data) — these read straight off the persisted fixture, so the
//      expected values are certain.
//
// ⚠ WIRING CHECKLIST (adjust to your aliases, then delete this block):
//   - import paths below use deep specifiers (features/…, app/…, shared/…). If your
//     barrels re-export these, switch to `from "features/assets"` etc.
//   - the fixture loader path assumes tests/fixtures/load-fixture.ts.
//   - copy the 3 .tara.json into src/tests/fixtures/ (see load-fixture.ts).

import { describe, it, expect } from "vitest";

import { syncFromDFD } from "features/assets/services/asset-sync-service";
import { createDefaultAssetData } from "features/assets/services/asset-factory";
import { mapDFDAssetsToAssetFeature } from "app/utils/dfd-to-asset-mapper";
import { hasSafetyData } from "shared/models/asset-reference-types";
import type { AssetReference } from "shared/models/asset-reference-types";

import { loadProjectFixture, FIXTURES } from "../../../../fixtures/load-fixture";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/** Replace non-deterministic timestamps so snapshots stay stable across runs. */
function stripVolatile<T>(result: T): T {
  return JSON.parse(
    JSON.stringify(result, (key, value) =>
      key === "lastModified" || key === "created" ? "<volatile>" : value,
    ),
  );
}

/**
 * Runs the DFD → AssetData sync exactly as the app would: map the persisted
 * dfd.assets into the asset-feature reference shape, then sync. Elements and
 * connections are reserved params in syncFromDFD (unused today) → [] is faithful.
 */
function runSync(project: ReturnType<typeof loadProjectFixture>) {
  const assetData = project.assets ?? createDefaultAssetData();
  const dfdAssets = mapDFDAssetsToAssetFeature(project.dfd?.assets ?? []);
  return syncFromDFD(assetData, dfdAssets, [], []);
}

/**
 * Minimal Asset → AssetReference projection, mirroring the relevant parts of
 * memoizedAssetDataRef (workspace-layout.tsx). Inlined here only because that
 * projection is not yet an exported pure function — extracting toAssetReference()
 * is the recommended next micro-step (advances Phase 6) and would replace this.
 */
function toRefs(project: ReturnType<typeof loadProjectFixture>): AssetReference[] {
  const assets = project.assets?.assets ?? [];
  return assets.map((a) => ({
    id: a.id,
    name: a.name,
    assetGroup: a.assetGroup,
    physicalImpact: a.physicalImpact,
    aggregatedImpact: a.aggregatedImpact,
    hasSafetyAnnotation: (a.linkedDFDElements ?? []).some(
      (l) => l.safety && l.safety.relevance !== "none",
    ),
    impactRatings: a.impactRatings?.map((r) => ({
      criterionId: r.criterionId,
      value: r.value,
    })),
  }));
}

// ──────────────────────────────────────────────────────────────────────────
// 1. syncFromDFD — characterization snapshots
// ──────────────────────────────────────────────────────────────────────────

describe("Phase 0 — syncFromDFD characterization", () => {
  // NOTE: SmokeDetector and cnc-ref are ALREADY in sync (dfd.assets id-set ==
  // assets.assets id-set). We EXPECT a no-op, but syncFromDFD compares
  // linkedElements via JSON.stringify, which is key-order sensitive. If the first
  // run records hasChanges:true here, that is the known fragility from §3.4 (2),
  // NOT a test bug — capture it, then fix the comparison in a later phase.
  it("SmokeDetector: re-sync of an in-sync project", () => {
    const result = runSync(loadProjectFixture(FIXTURES.smokeDetector));
    expect(stripVolatile(result)).toMatchSnapshot();
  });

  it("cnc-ref (migrated): re-sync of an in-sync project", () => {
    const result = runSync(loadProjectFixture(FIXTURES.cncRef));
    expect(stripVolatile(result)).toMatchSnapshot();
  });

  it("empty project: sync of default AssetData with no DFD assets is a clean no-op", () => {
    const result = syncFromDFD(createDefaultAssetData(), [], [], []);
    expect(result.hasChanges).toBe(false);
    expect(result.newAssets).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.assetData.assets).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 2. §3.4 sentinel — the DFD safety-annotation projection is empty in real data
// ──────────────────────────────────────────────────────────────────────────

describe("Phase 0 — §3.4 safety-projection gap (sentinel)", () => {
  const project = loadProjectFixture(FIXTURES.smokeDetector);
  const assets = project.assets!.assets;

  it("no linkedDFDElement carries a safety annotation", () => {
    const withSafetyLink = assets.filter((a) =>
      (a.linkedDFDElements ?? []).some(
        (l) => l.safety && l.safety.relevance !== "none",
      ),
    );
    expect(withSafetyLink).toHaveLength(0);
  });

  it("physicalImpact exists, but only via manual analyst override", () => {
    const withPhysical = assets.filter((a) => a.physicalImpact);
    expect(withPhysical).toHaveLength(4);
    // every one is manual — none derived from a DFD safety annotation
    expect(withPhysical.every((a) => a.physicalImpactSource === "manual")).toBe(true);
    expect(withPhysical.every((a) => a.physicalImpact === "fatality")).toBe(true);
  });

  it("hasSafetyData is true via physicalImpact, yet hasSafetyAnnotation is never set", () => {
    const refs = toRefs(project);
    // The gap: not a single asset is flagged via the DFD-annotation path …
    expect(refs.some((r) => r.hasSafetyAnnotation)).toBe(false);
    // … but the project IS safety-relevant — only because physicalImpact survived manually.
    expect(hasSafetyData(refs)).toBe(true);
    // If a later phase wires DFD safety annotations through correctly, THIS test
    // flips — update it deliberately and document why.
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 3. AssetReference projection — derived-value snapshot
// ──────────────────────────────────────────────────────────────────────────

describe("Phase 0 — AssetReference projection snapshot", () => {
  it("SmokeDetector: id → derived impact fields", () => {
    const refs = toRefs(loadProjectFixture(FIXTURES.smokeDetector)).map((r) => ({
      id: r.id,
      assetGroup: r.assetGroup,
      aggregatedImpact: r.aggregatedImpact,
      physicalImpact: r.physicalImpact,
      hasSafetyAnnotation: r.hasSafetyAnnotation,
    }));
    // Known baseline (verified against the fixture): aggregatedImpact distribution
    // CRITICAL×1, HIGH+×3, undefined×15; physicalImpact set on 4.
    expect(refs).toMatchSnapshot();
  });
});
