// src/tests/unit/app/services/migrate_11_to_12.test.ts
//
// Schema 12 (0.17.0-beta, iec-62443-4-2-cra-coverage.md D-8): a version
// fence for project.compliance — no data change, declared analysis-
// preserving, so a TARA verification recorded with 0.16 (schema 11) stays
// valid when the file is opened in 0.17.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { migrate_11_to_12 } from "app/services/versions";
import { ANALYSIS_PRESERVING_MIGRATIONS, applyMigrations, parseAndRepairWithMetadata } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { verificationStateHash, verificationStatus } from "app/services/verification-state";
import { VERIFICATION_HASH_VERSION } from "shared";

type Any = any;

const v11 = { schemaVersion: 11, info: { name: "P" }, risks: [{ id: "R-1" }] };

describe("migrate 11 → 12 (version fence)", () => {
  it("only raises the version", () => {
    expect(migrate_11_to_12(structuredClone(v11))).toEqual({ ...v11, schemaVersion: 12 });
  });

  it("is the current version and declared analysis-preserving", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(12);
    expect(ANALYSIS_PRESERVING_MIGRATIONS.has(12)).toBe(true);
  });

  it("a file of a newer schema is refused", () => {
    expect(() => applyMigrations({ ...v11, schemaVersion: 13 })).toThrow(/Unsupported schema version: 13/);
  });

  // The fence changes no hashed content (the verification hash does not cover
  // schemaVersion), so the verification needs no re-seal at all. The
  // declaration above starts to matter once a reshaping step joins this
  // migration (IEC-9) — then the re-seal path carries the verification.
  it("a TARA verification recorded with schema 11 stays valid after loading (no reconfirm)", () => {
    // A complete project at schema 11: the fixture brought to the current
    // schema, written back as 11 (the 11 → 12 step changes nothing else).
    const current: Any = parseAndRepairWithMetadata(
      JSON.parse(readFileSync("src/tests/fixtures/headlamp-iso21434.tara.json", "utf-8")),
    )!.project;
    const asV11: Any = JSON.parse(JSON.stringify({ ...current, schemaVersion: 11 }));
    const readHash = verificationStateHash(JSON.parse(JSON.stringify(asV11)));
    asV11.cybersecurityConcept = {
      ...(asV11.cybersecurityConcept ?? { goals: [], claims: [] }),
      verifications: [
        { id: "v1", date: "2026-10-30", reviewer: "A", scope: ["tara"], result: "passed", stateHash: readHash, hashVersion: VERIFICATION_HASH_VERSION },
      ],
    };

    const { project: loaded, migrated }: Any = parseAndRepairWithMetadata(asV11);
    expect(migrated).toBe(true);
    expect(loaded.schemaVersion).toBe(12);
    expect(verificationStateHash(loaded)).toBe(readHash);
    const entry = loaded.cybersecurityConcept.verifications[0];
    expect(entry.reconfirm).toBeUndefined();
    expect(verificationStatus(loaded.cybersecurityConcept.verifications, verificationStateHash(loaded), "2026-10-31").kind).not.toBe("reconfirm");
  });
});
