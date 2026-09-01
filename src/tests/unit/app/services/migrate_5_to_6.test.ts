// src/tests/unit/app/services/migrate_5_to_6.test.ts
//
// Asset identity split (schema 5 → 6): readable asset id → opaque UUID, old
// label → displayId, and every asset-id foreign key repointed in one pass.

import { describe, it, expect } from "vitest";
import { migrate_5_to_6 } from "app/services/versions/migrate-5-to-6";
import { loadProjectFixture } from "../../../fixtures/load-fixture";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadFixture(): any {
  return loadProjectFixture("asset-uuid-migration-v5.tara.json");
}

describe("migrate_5_to_6 — asset id → UUID, label → displayId (real fixture)", () => {
  it("gives every asset a UUID id and moves the old readable id to displayId", () => {
    const out = migrate_5_to_6(loadFixture());
    for (const a of out.assets.assets) {
      expect(a.id).toMatch(UUID_RE);
      expect(a.displayId).toMatch(/^DA-\d+$/);
    }
    expect(out.schemaVersion).toBe(6);
  });

  it("repoints element assetRelations to the new UUIDs (no orphans)", () => {
    const out = migrate_5_to_6(loadFixture());
    const validIds = new Set(out.assets.assets.map((a: any) => a.id));

    const refs = out.dfd.elements.flatMap((e: any) =>
      (e.assetRelations ?? []).map((r: any) => r.assetId),
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatch(UUID_RE); // rewritten, not the old "DA-001"
      expect(validIds.has(ref)).toBe(true); // resolves to a real asset
    }
  });

  it("drops the dfd.assets mirror (feature store is the single canonical store)", () => {
    const out = migrate_5_to_6(loadFixture());
    // dfd.assets is emptied — a runtime projection, no longer persisted.
    expect(out.dfd.assets).toEqual([]);
    // The feature store still holds every asset, and element references still
    // resolve to them (proven in the "no orphans" test above).
    expect(out.assets.assets.length).toBeGreaterThan(0);
  });

  it("is idempotent — a second run changes nothing", () => {
    const once = migrate_5_to_6(loadFixture());
    const twice = migrate_5_to_6(once);
    expect(twice.assets.assets.map((a: any) => a.id)).toEqual(
      once.assets.assets.map((a: any) => a.id),
    );
    expect(
      twice.dfd.elements.flatMap((e: any) =>
        (e.assetRelations ?? []).map((r: any) => r.assetId),
      ),
    ).toEqual(
      once.dfd.elements.flatMap((e: any) =>
        (e.assetRelations ?? []).map((r: any) => r.assetId),
      ),
    );
  });
});

describe("migrate_5_to_6 — rewrites every asset-id reference field", () => {
  const project = {
    schemaVersion: 5,
    assets: {
      assets: [
        { id: "DA-001", assetGroup: "data", name: "A" },
        { id: "SY-001", assetGroup: "system", name: "B" },
      ],
    },
    dfd: {
      assets: [{ id: "DA-001" }, { id: "SY-001" }],
      elements: [{ id: "e1", assetRelations: [{ assetId: "DA-001" }] }],
      connections: [{ id: "c1", assetRelations: [{ assetId: "SY-001" }] }],
    },
    // Threats: linkedAssetIds + assetIds (string[] fields).
    threats: {
      perElementTables: [
        {
          threats: [
            { id: "t1", linkedAssetIds: ["DA-001", "SY-001"], assetIds: ["DA-001"] },
          ],
        },
      ],
    },
    // Asset-to-asset relation (source/targetAssetId).
    risks: {
      risks: [{ id: "r1", assetId: "SY-001" }],
    },
    a2a: [{ sourceAssetId: "DA-001", targetAssetId: "SY-001" }],
  };

  it("maps assetId / linkedAssetIds / assetIds / source+targetAssetId to the new UUIDs", () => {
    const out = migrate_5_to_6(structuredClone(project));
    const da = out.assets.assets.find((a: any) => a.displayId === "DA-001").id;
    const sy = out.assets.assets.find((a: any) => a.displayId === "SY-001").id;

    expect(out.dfd.elements[0].assetRelations[0].assetId).toBe(da);
    expect(out.dfd.connections[0].assetRelations[0].assetId).toBe(sy);

    const th = out.threats.perElementTables[0].threats[0];
    expect(th.linkedAssetIds).toEqual([da, sy]);
    expect(th.assetIds).toEqual([da]);

    expect(out.risks.risks[0].assetId).toBe(sy);
    expect(out.a2a[0].sourceAssetId).toBe(da);
    expect(out.a2a[0].targetAssetId).toBe(sy);
  });

  it("leaves unrelated strings untouched", () => {
    const out = migrate_5_to_6(structuredClone(project));
    // element/connection/threat ids are not asset ids — must be unchanged.
    expect(out.dfd.elements[0].id).toBe("e1");
    expect(out.dfd.connections[0].id).toBe("c1");
    expect(out.threats.perElementTables[0].threats[0].id).toBe("t1");
    expect(out.risks.risks[0].id).toBe("r1");
  });
});
