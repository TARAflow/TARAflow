// src/tests/unit/app/services/migrate_12_to_13.test.ts
//
// Schema 13 (0.18.0-beta, model-coverage-implementation-plan.md §6): the
// matrix data moves 1:1 into one block per standard family (S13-b, K-2), the
// default component stays at the top (K-5), and the migration reports per
// file whether it changed an analysis value (K-9) — the reshape does not, so
// a TARA verification is re-sealed; a dropped legacy statement does.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { migrate_12_to_13 } from "app/services/versions";
import { applyMigrations, parseAndRepairWithMetadata } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { verificationStateHash } from "app/services/verification-state";
import { VERIFICATION_HASH_VERSION, type ComplianceStatement } from "shared";

type Any = any;

const st = (reasoning: string, date = "2026-11-01"): ComplianceStatement => ({ status: "met", reasoning, date });

const v12Compliance = () => ({
  componentId: "mp_ctl",
  target: { IAC: 2, SI: 3 },
  deviceCategories: { categories: ["EDR"], source: "manual" },
  statements: { "cr-1.7": st("NIST rules"), "cr-4.1-rest+cr-4.1-transit": st("both") },
});

describe("migrate_12_to_13", () => {
  it("moves the IEC 62443-4-2 fields 1:1 into their family block; the component stays the default", () => {
    const { data, analysisChanged } = migrate_12_to_13({ schemaVersion: 12, compliance: v12Compliance() });
    expect(data).toEqual({
      schemaVersion: 13,
      compliance: {
        componentId: "mp_ctl",
        families: {
          "iec-62443-4-2": {
            target: { IAC: 2, SI: 3 },
            deviceCategories: { categories: ["EDR"], source: "manual" },
            statements: { "cr-1.7": st("NIST rules"), "cr-4.1-rest+cr-4.1-transit": st("both") },
          },
        },
      },
    });
    expect(analysisChanged).toBe(false);
  });

  it("only a component: no family block", () => {
    expect(migrate_12_to_13({ schemaVersion: 12, compliance: { componentId: "p1" } }).data.compliance).toEqual({ componentId: "p1" });
  });

  it("a project without matrix data only gets the version", () => {
    const v12 = { schemaVersion: 12, info: { name: "P" } };
    expect(migrate_12_to_13(structuredClone(v12))).toEqual({ data: { ...v12, schemaVersion: 13 }, analysisChanged: false });
  });

  it("data already per family passes unchanged (same object)", () => {
    const compliance = { families: { "iec-62443-4-2": { target: { IAC: 1 } } } };
    expect(migrate_12_to_13({ schemaVersion: 12, compliance }).data.compliance).toBe(compliance);
  });

  it("statements of the 0.17 development are folded per requirement first", () => {
    const { data, analysisChanged } = migrate_12_to_13({
      schemaVersion: 12,
      compliance: { statements: { "iec-62443-4-2-2019": { "CR 1.7": st("x") } } },
    });
    expect(data.compliance).toEqual({ families: { "iec-62443-4-2": { statements: { "cr-1.7": st("x") } } } });
    expect(analysisChanged).toBe(false);
  });

  it("two editions with different statements on one requirement: the older is dropped — reported for this file (K-9)", () => {
    const { data, analysisChanged } = migrate_12_to_13({
      schemaVersion: 12,
      compliance: {
        statements: {
          "en-iec-62443-4-2-praa-2026": { "CR 1.7": st("older", "2026-10-30") },
          "iec-62443-4-2-2019": { "CR 1.7": st("newer", "2026-11-01") },
        },
      },
    });
    expect(data.compliance.families["iec-62443-4-2"].statements).toEqual({ "cr-1.7": st("newer", "2026-11-01") });
    expect(analysisChanged).toBe(true);
  });
});

describe("schema 13 in the pipeline", () => {
  it("is the current version", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(13);
    expect(applyMigrations({ schemaVersion: 12 }).data.schemaVersion).toBe(13);
  });

  it("preservation is per file: the reshape keeps it, a dropped statement does not", () => {
    expect(applyMigrations({ schemaVersion: 12, compliance: v12Compliance() }).analysisPreserved).toBe(true);
    const dropping = {
      schemaVersion: 12,
      compliance: {
        statements: {
          "en-iec-62443-4-2-praa-2026": { "CR 1.7": st("a", "2026-10-30") },
          "iec-62443-4-2-2019": { "CR 1.7": st("b") },
        },
      },
    };
    expect(applyMigrations(dropping).analysisPreserved).toBe(false);
    // From before 12, a version that is neither declared nor reporting breaks it.
    expect(applyMigrations({ schemaVersion: 10 }).analysisPreserved).toBe(false);
    expect(applyMigrations({ schemaVersion: 11 }).analysisPreserved).toBe(true);
  });

  /** SmokeDetector at schema 12 with matrix data and a verification of the file as read. */
  function verifiedV12(compliance: Any): Any {
    const current: Any = parseAndRepairWithMetadata(
      JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8")),
    )!.project;
    const asV12: Any = JSON.parse(JSON.stringify({ ...current, schemaVersion: 12, compliance }));
    const readHash = verificationStateHash(JSON.parse(JSON.stringify(asV12)));
    asV12.cybersecurityConcept = {
      ...(asV12.cybersecurityConcept ?? { goals: [], claims: [] }),
      verifications: [
        { id: "v1", date: "2026-11-01", reviewer: "A", scope: ["tara"], result: "passed", stateHash: readHash, hashVersion: VERIFICATION_HASH_VERSION },
      ],
    };
    return { file: asV12, readHash };
  }

  it("the reshape changes the hashed matrix data, the verification is re-sealed", () => {
    const { file, readHash } = verifiedV12(v12Compliance());
    const { project: loaded }: Any = parseAndRepairWithMetadata(file);
    expect(loaded.schemaVersion).toBe(13);
    expect(loaded.compliance.families["iec-62443-4-2"].target).toEqual({ IAC: 2, SI: 3 });
    expect(verificationStateHash(loaded)).not.toBe(readHash);
    const entry = loaded.cybersecurityConcept.verifications[0];
    expect(entry.reconfirm).toBeUndefined();
    expect(entry.stateHash).toBe(verificationStateHash(loaded));
  });

  it("a dropped legacy statement asks to confirm the verification again", () => {
    const { file } = verifiedV12({
      statements: {
        "en-iec-62443-4-2-praa-2026": { "CR 1.7": st("a", "2026-10-30") },
        "iec-62443-4-2-2019": { "CR 1.7": st("b") },
      },
    });
    const { project: loaded }: Any = parseAndRepairWithMetadata(file);
    expect(loaded.cybersecurityConcept.verifications[0].reconfirm).toBe("migration");
  });
});

describe("MS-1: combinable controls become selections (1:1)", () => {
  const dfd = {
    elements: [
      { id: "p", type: "Process", properties: { malwareProtection: "code_signing" } },
      { id: "mp", type: "Multiprocess", properties: { malwareProtection: "" } },
      { id: "ds", type: "DataStore", properties: { malwareProtection: "none" } },
      { id: "q", type: "Process", properties: { malwareProtection: ["sandbox"] } },
    ],
    connections: [{ id: "f", from: "p", to: "q", properties: { physicalPathProtection: "cable_duct" } }],
  };

  it("a stored value becomes a selection of one, an empty one is removed, other types and selections stay", () => {
    const { data, analysisChanged } = migrate_12_to_13({ schemaVersion: 12, dfd: structuredClone(dfd) });
    expect(data.dfd.elements.map((e: Any) => e.properties)).toEqual([
      { malwareProtection: ["code_signing"] },
      {},
      { malwareProtection: "none" },
      { malwareProtection: ["sandbox"] },
    ]);
    expect(data.dfd.connections[0].properties).toEqual({ physicalPathProtection: ["cable_duct"] });
    expect(analysisChanged).toBe(false);
  });

  it("a verified file with such values is re-sealed, not reopened", () => {
    const current: Any = parseAndRepairWithMetadata(JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8")))!.project;
    const file: Any = JSON.parse(JSON.stringify({ ...current, schemaVersion: 12 }));
    file.dfd.elements = file.dfd.elements.map((e: Any) =>
      e.type === "Process" ? { ...e, properties: { ...e.properties, malwareProtection: "code_signing" } } : e,
    );
    const readHash = verificationStateHash(JSON.parse(JSON.stringify(file)));
    file.cybersecurityConcept = {
      ...(file.cybersecurityConcept ?? { goals: [], claims: [] }),
      verifications: [{ id: "v1", date: "2026-11-02", reviewer: "A", scope: ["tara"], result: "passed", stateHash: readHash, hashVersion: VERIFICATION_HASH_VERSION }],
    };
    const { project: loaded }: Any = parseAndRepairWithMetadata(file);
    expect(loaded.dfd.elements.find((e: Any) => e.type === "Process").properties.malwareProtection).toEqual(["code_signing"]);
    expect(loaded.cybersecurityConcept.verifications[0].reconfirm).toBeUndefined();
  });
});
