// src/tests/regression/dfd-assets-projection-equivalence.test.ts
//
// Step 2.2 of the asset-store consolidation — the SAFETY NET.
//
// Before dropping the stored DFDData.assets (step 2.4), we must prove that it
// is fully reconstructible from the canonical feature store (project.assets)
// plus the diagram. This test does exactly that, against REAL project
// fixtures: for every fixture that has both stores, projecting the feature
// store back to the DFDAsset shape reproduces the stored dfd.assets —
// membership, core fields, and the derived element links.
//
// If this ever fails, the stored dfd.assets carried information the feature
// store does not, and step 2.4 would lose it. That is precisely what must not
// happen — so this guards the whole consolidation.

import { describe, it, expect } from "vitest";
import {
  deriveDfdAssets,
  dfdSourcedAssets,
} from "app/utils/asset-to-dfd-mapper";
import { loadProjectFixture, FIXTURES } from "../fixtures/load-fixture";

type LinkKey = string; // `${elementId}|${relationType ?? ""}`

const linkKeys = (
  links:
    | ReadonlyArray<{ elementId: string; relationType?: string }>
    | undefined,
): LinkKey[] =>
  (links ?? [])
    .map((l) => `${l.elementId}|${l.relationType ?? ""}`)
    .sort();

describe.each([
  ["SmokeDetector (19 assets)", FIXTURES.smokeDetector],
  ["cnc-ref (4 assets)", FIXTURES.cncRef],
])(
  "dfd.assets is fully reconstructible from the feature store — %s",
  (_label, fixtureFile) => {
    const project = loadProjectFixture(fixtureFile);
    const featureAssets = project.assets?.assets ?? [];
    const dfd = project.dfd!;
    const storedDfdAssets = dfd.assets ?? [];

    const projected = deriveDfdAssets(
      dfdSourcedAssets(featureAssets),
      dfd.elements ?? [],
      dfd.connections ?? [],
    );

    it("reproduces the exact set of asset ids", () => {
      expect(projected.map((a) => a.id).sort()).toEqual(
        storedDfdAssets.map((a) => a.id).sort(),
      );
    });

    it("reproduces id/displayId/name/assetGroup for every asset", () => {
      const byId = new Map(projected.map((a) => [a.id, a]));
      for (const stored of storedDfdAssets) {
        const p = byId.get(stored.id);
        expect(p, `projected asset ${stored.id} missing`).toBeDefined();
        expect(p!.name).toBe(stored.name);
        expect(p!.assetGroup).toBe(stored.assetGroup);
        // The feature id already IS the display id.
        expect(p!.displayId).toBe(stored.id);
      }
    });

    it("reproduces the derived element links (elementId + relationType)", () => {
      const byId = new Map(projected.map((a) => [a.id, a]));
      for (const stored of storedDfdAssets) {
        const p = byId.get(stored.id)!;
        expect(linkKeys(p.linkedElements)).toEqual(
          linkKeys(stored.linkedElements),
        );
      }
    });
  },
);

describe("dfdSourcedAssets — membership filter", () => {
  it("keeps only source 'dfd' assets, excluding manual-only ones", () => {
    const project = loadProjectFixture(FIXTURES.smokeDetector);
    const featureAssets = project.assets?.assets ?? [];
    const filtered = dfdSourcedAssets(featureAssets);
    expect(filtered.every((a) => a.source === "dfd")).toBe(true);
    // In this fixture every feature asset is DFD-sourced, so none are dropped.
    expect(filtered).toHaveLength(featureAssets.length);
  });
});
