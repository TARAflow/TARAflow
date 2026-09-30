// src/tests/unit/app/services/repair-hazard-asset-refs.test.ts
//
// Hazard edges orphaned by the 5 → 6 asset identity split still point at the
// old readable label (now Asset.displayId). The load-time repair repoints
// them to the asset UUID — only on an unambiguous match.

import { describe, it, expect } from "vitest";
import { repairHazardAssetRefs } from "app/services/repair-hazard-asset-refs";
import { migrate_5_to_6 } from "app/services/versions/migrate-5-to-6";

const SYS = "11111111-1111-4111-8111-111111111111";
const HUM = "22222222-2222-4222-8222-222222222222";

function v6Broken(extraAssets: any[] = [], relations?: any[]): any {
  return {
    schemaVersion: 7,
    assets: {
      assets: [
        { id: SYS, displayId: "SY-001", name: "PLC" },
        { id: HUM, displayId: "HU-001", name: "Operator" },
        ...extraAssets,
      ],
    },
    hazards: {
      hazards: [{ id: "H-01", label: "Crush" }],
      relations: relations ?? [
        { type: "contributes_to", from: "SY-001", to: "H-01" },
        { type: "endangers", from: "H-01", to: "HU-001" },
      ],
    },
  };
}

describe("repairHazardAssetRefs", () => {
  it("repoints old readable labels to the asset UUID", () => {
    const out = repairHazardAssetRefs(v6Broken());
    expect(out.hazards.relations).toEqual([
      { type: "contributes_to", from: SYS, to: "H-01" },
      { type: "endangers", from: "H-01", to: HUM },
    ]);
  });

  it("only touches the asset side (hazard ids stay as they are)", () => {
    const out = repairHazardAssetRefs(v6Broken());
    expect(out.hazards.relations[0].to).toBe("H-01");
    expect(out.hazards.relations[1].from).toBe("H-01");
  });

  it("leaves an ambiguous label unresolved instead of guessing", () => {
    const dup = { id: "33333333-3333-4333-8333-333333333333", displayId: "SY-001" };
    const out = repairHazardAssetRefs(v6Broken([dup]));
    expect(out.hazards.relations[0].from).toBe("SY-001");
    expect(out.hazards.relations[1].to).toBe(HUM);
  });

  it("leaves unknown references alone", () => {
    const data = v6Broken([], [
      { type: "contributes_to", from: "XX-999", to: "H-01" },
    ]);
    expect(repairHazardAssetRefs(data)).toBe(data);
  });

  it("collapses edges that become duplicates", () => {
    const out = repairHazardAssetRefs(
      v6Broken([], [
        { type: "contributes_to", from: SYS, to: "H-01" },
        { type: "contributes_to", from: "SY-001", to: "H-01" },
      ]),
    );
    expect(out.hazards.relations).toEqual([
      { type: "contributes_to", from: SYS, to: "H-01" },
    ]);
  });

  it("is a no-op (same object) on a clean file", () => {
    const clean = repairHazardAssetRefs(v6Broken());
    expect(repairHazardAssetRefs(clean)).toBe(clean);
  });

  it("is a no-op on a pre-v6 file (refs still resolve by readable id)", () => {
    const v5 = {
      schemaVersion: 5,
      assets: { assets: [{ id: "SY-001", name: "PLC" }] },
      hazards: {
        hazards: [],
        relations: [{ type: "contributes_to", from: "SY-001", to: "H-01" }],
      },
    };
    expect(repairHazardAssetRefs(v5)).toBe(v5);
  });
});

describe("migrate_5_to_6 — hazard relations", () => {
  it("repoints contributes_to.from and endangers.to to the new UUIDs", () => {
    const out = migrate_5_to_6({
      schemaVersion: 5,
      assets: {
        assets: [
          { id: "SY-001", name: "PLC" },
          { id: "HU-001", name: "Operator" },
        ],
      },
      hazards: {
        hazards: [{ id: "H-01" }],
        relations: [
          { type: "contributes_to", from: "SY-001", to: "H-01" },
          { type: "endangers", from: "H-01", to: "HU-001" },
        ],
      },
    });
    const byLabel = new Map(
      out.assets.assets.map((a: any) => [a.displayId, a.id]),
    );
    expect(out.hazards.relations[0]).toMatchObject({
      from: byLabel.get("SY-001"),
      to: "H-01",
    });
    expect(out.hazards.relations[1]).toMatchObject({
      from: "H-01",
      to: byLabel.get("HU-001"),
    });
  });
});
