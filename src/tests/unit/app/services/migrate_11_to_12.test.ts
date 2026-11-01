// src/tests/unit/app/services/migrate_11_to_12.test.ts
//
// Schema 12 (0.17.0-beta, iec-62443-4-2-cra-coverage.md D-8, P-1): a
// version fence for project.compliance plus one 1:1 reshape — the trust
// boundary's defaultDenyPolicy becomes multi-select. Declared analysis-
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

  it("defaultDenyPolicy: a single value becomes a selection of one, an empty one is removed (P-1)", () => {
    const tb = (defaultDenyPolicy: unknown) => ({ id: "tb", type: "TrustBoundary", properties: { boundaryType: "network", defaultDenyPolicy } });
    const out = migrate_11_to_12({
      ...structuredClone(v11),
      dfd: { elements: [tb("island_mode"), tb(""), tb(["fail_close"]), { id: "p", type: "Process", properties: {} }] },
    });
    expect(out.dfd.elements.map((e: Any) => e.properties.defaultDenyPolicy)).toEqual([["island_mode"], undefined, ["fail_close"], undefined]);
    expect("defaultDenyPolicy" in out.dfd.elements[1].properties).toBe(false);
    expect(out.dfd.elements[0].properties.boundaryType).toBe("network");
  });

  it("boundaryControls: the old free text moves into customBoundaryControls, nothing is lost", () => {
    const tb = (properties: Record<string, unknown>) => ({ id: "tb", type: "TrustBoundary", properties });
    const out = migrate_11_to_12({
      ...structuredClone(v11),
      dfd: {
        elements: [
          tb({ boundaryControls: "Siemens SCALANCE S615" }),
          tb({ boundaryControls: "DPI for Profinet", customBoundaryControls: "OPC UA reverse proxy" }),
          tb({ boundaryControls: "OPC UA reverse proxy", customBoundaryControls: "OPC UA reverse proxy" }),
          tb({ boundaryControls: "" }),
        ],
      },
    });
    expect(out.dfd.elements.map((e: Any) => e.properties)).toEqual([
      { customBoundaryControls: "Siemens SCALANCE S615" },
      { customBoundaryControls: "OPC UA reverse proxy\nDPI for Profinet" },
      { customBoundaryControls: "OPC UA reverse proxy" },
      {},
    ]);
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

  it("the reshape changes the hashed DFD, the verification is re-sealed (declared analysis-preserving)", () => {
    const current: Any = parseAndRepairWithMetadata(
      JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8")),
    )!.project;
    const asV11: Any = JSON.parse(JSON.stringify({ ...current, schemaVersion: 11 }));
    asV11.dfd.elements.push({
      id: "tb-p1",
      type: "TrustBoundary",
      name: "Zone [Z]",
      displayId: "Z",
      position: { x: 0, y: 0 },
      size: { width: 10, height: 10 },
      properties: { boundaryType: "network", defaultDenyPolicy: "deny_all_permit_exception" },
    });
    const readHash = verificationStateHash(JSON.parse(JSON.stringify(asV11)));
    asV11.cybersecurityConcept = {
      ...(asV11.cybersecurityConcept ?? { goals: [], claims: [] }),
      verifications: [
        { id: "v1", date: "2026-10-30", reviewer: "A", scope: ["tara"], result: "passed", stateHash: readHash, hashVersion: VERIFICATION_HASH_VERSION },
      ],
    };

    const { project: loaded }: Any = parseAndRepairWithMetadata(asV11);
    expect(loaded.dfd.elements.find((e: Any) => e.id === "tb-p1").properties.defaultDenyPolicy).toEqual(["deny_all_permit_exception"]);
    expect(verificationStateHash(loaded)).not.toBe(readHash);
    const entry = loaded.cybersecurityConcept.verifications[0];
    expect(entry.reconfirm).toBeUndefined();
    expect(entry.stateHash).toBe(verificationStateHash(loaded));
  });
});
