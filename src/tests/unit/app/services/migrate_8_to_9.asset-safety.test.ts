// src/tests/unit/app/services/migrate_8_to_9.asset-safety.test.ts
//
// Schema v9 (asset safety part): asset-level safety properties become derived.

import { describe, it, expect } from "vitest";
import { migrate_8_to_9 } from "app/services/versions/migrate-8-to-9";

const v8 = (assets: any[]): any => ({
  schemaVersion: 8,
  assets: { assets, configuration: {} },
  dfd: {
    elements: [{ id: "I1", properties: { safetyRelevant: true } }],
    connections: [],
  },
});

describe("migrate_8_to_9 — asset safety", () => {
  it("bumps the version, also without assets", () => {
    expect(migrate_8_to_9({ schemaVersion: 8, assets: null }).schemaVersion).toBe(9);
  });

  it("drops the asset safety flags", () => {
    const out = migrate_8_to_9(
      v8([
        {
          id: "a",
          properties: { safetyRelevant: true, containsSafetyRelevantData: true, owner: "x" },
        },
      ]),
    );
    expect(out.assets.assets[0].properties).toEqual({ owner: "x" });
  });

  it("keeps a lone safetyImpact as a manual override with marker", () => {
    const out = migrate_8_to_9(
      v8([
        {
          id: "a",
          properties: { safetyImpact: "irreversible_major", safetyRationale: "arm motion" },
        },
      ]),
    );
    const a = out.assets.assets[0];
    expect(a.physicalImpact).toBe("irreversible_major");
    expect(a.physicalImpactSource).toBe("manual");
    expect(a.physicalImpactRationale).toContain("arm motion");
    expect(a.physicalImpactRationale).toContain("[MIGRATED]");
    expect(a.properties).toEqual({});
  });

  it("drops safetyImpact when the asset is already rated", () => {
    const out = migrate_8_to_9(
      v8([
        {
          id: "a",
          physicalImpact: "fatal",
          physicalImpactSource: "derived",
          properties: { safetyImpact: "reversible_minor" },
        },
      ]),
    );
    const a = out.assets.assets[0];
    expect(a.physicalImpact).toBe("fatal");
    expect(a.physicalImpactSource).toBe("derived");
    expect(a.properties).toEqual({});
  });

  it("leaves DFD element safetyRelevant untouched", () => {
    const out = migrate_8_to_9(v8([]));
    expect(out.dfd.elements[0].properties.safetyRelevant).toBe(true);
  });
});
