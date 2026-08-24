// src/tests/regression/asset-store-two-world-consistency.test.ts
//
// TARAflow keeps assets in TWO places that must stay reconciled:
//   dfd.assets      — the DFD module's view (DFDAsset[])
//   assets.assets   — the Asset feature's view (Asset[])
//
// Several production bugs were the drift between them: an asset present in one
// world but missing/empty in the other, or an element.assetRelations entry
// pointing at an id that exists in neither. These are invariants, not
// behaviours — they must hold for ANY persisted project, so we assert them
// over the fixtures rather than over one hand-built case.
//
// A fixture that violates an invariant is itself a captured bug: fix the
// pipeline (or the fixture, if it predates a fix) rather than loosening the
// assertion.

import { describe, it, expect } from "vitest";
import { loadProjectFixture, FIXTURES } from "../fixtures/load-fixture";
import type { Project } from "app/models/project-types";

/** All fixtures that carry a DFD with assets. simpleTest is intentionally empty. */
const DFD_FIXTURES = [FIXTURES.smokeDetector, FIXTURES.cncRef] as const;

function dfdAssetIds(p: Project): string[] {
  return (p.dfd?.assets ?? []).map((a: any) => a.id).sort();
}

function featureAssetIds(p: Project): string[] {
  return (p.assets?.assets ?? []).map((a) => a.id).sort();
}

describe("asset store — two-world consistency (fixtures)", () => {
  for (const fixture of DFD_FIXTURES) {
    describe(fixture, () => {
      const project = loadProjectFixture(fixture);

      it("dfd.assets and assets.assets have identical id-sets", () => {
        // The core invariant. When it fails, one world has an asset the other
        // lost — the "asset vanished from the Asset tab but not the DFD"
        // (or vice-versa) family of reports.
        expect(featureAssetIds(project)).toEqual(dfdAssetIds(project));
      });

      it("every element.assetRelations target exists in dfd.assets", () => {
        // The exact condition asset-relation-validator flags as
        // ASSET_RELATION_INCONSISTENT ("… not found"). Pinning it here turns a
        // runtime warning into a build-time guarantee for the shipped fixtures.
        const assetIds = new Set((project.dfd?.assets ?? []).map((a: any) => a.id));
        const dangling: string[] = [];

        for (const el of project.dfd?.elements ?? ([] as any[])) {
          for (const rel of (el as any).assetRelations ?? []) {
            if (!assetIds.has(rel.assetId)) {
              dangling.push(
                `${el.displayId ?? el.id} → ${rel.assetId} (via "${rel.relationType}")`,
              );
            }
          }
          }

        for (const conn of project.dfd?.connections ?? ([] as any[])) {
          for (const rel of (conn as any).assetRelations ?? []) {
            if (!assetIds.has(rel.assetId)) {
              dangling.push(
                `${conn.displayId ?? conn.id} → ${rel.assetId} (via "${rel.relationType}")`,
              );
            }
          }
        }

        expect(dangling, `Dangling asset relations:\n${dangling.join("\n")}`).toEqual([]);
      });

      it("no duplicate asset ids within either world", () => {
        const dfdIds = (project.dfd?.assets ?? []).map((a: any) => a.id);
        const featIds = (project.assets?.assets ?? []).map((a) => a.id);
        expect(new Set(dfdIds).size).toBe(dfdIds.length);
        expect(new Set(featIds).size).toBe(featIds.length);
      });
    });
  }

  it("empty-DFD fixture is internally consistent (both worlds empty/absent)", () => {
    const project = loadProjectFixture(FIXTURES.simpleTest);
    expect(dfdAssetIds(project)).toEqual(featureAssetIds(project));
  });
});
