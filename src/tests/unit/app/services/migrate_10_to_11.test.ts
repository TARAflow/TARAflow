// src/tests/unit/app/services/migrate_10_to_11.test.ts
//
// Schema 11 (0.16.0-beta, ISO plan decision 24): a version fence — no data
// change. Older releases refuse the file instead of counting a person edge
// rated "none" (S0) as harm.

import { describe, expect, it } from "vitest";
import { migrate_10_to_11 } from "app/services/versions";
import { applyMigrations } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";

const v10 = {
  schemaVersion: 10,
  hazards: {
    hazards: [{ id: "H1", label: "Pinch", combinationType: "ANY", source: "manual" }],
    relations: [{ type: "endangers", from: "H1", to: "HU-1", impact: { target: "human", severity: "none" } }],
  },
};

describe("migrate 10 → 11 (version fence)", () => {
  it("only raises the version", () => {
    const out = migrate_10_to_11(structuredClone(v10));
    expect(out).toEqual({ ...v10, schemaVersion: 11 });
  });

  it("is followed by the schema-12 fence", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(12);
    expect(applyMigrations(structuredClone(v10)).data.schemaVersion).toBe(12);
  });
});
