// src/tests/unit/app/services/migrate_13_to_14.test.ts
//
// Schema 14 (0.19.0-beta, multi-project TARA design v3 §10): a version fence
// for project.components — no data change, the analysis is kept (a TARA
// verification is re-sealed), and the repair path keeps the new block.

import { describe, expect, it } from "vitest";
import { migrate_13_to_14 } from "app/services/versions";
import { applyMigrations, repairProject } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { verificationStateHash } from "app/services/verification-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const components = () => ({
  imports: [
    {
      id: "imp1",
      componentId: "cam",
      name: "Camera system",
      source: { commitSha: "abc123", schemaVersion: 14 },
      importedAt: "2026-11-07",
      methodology: { likelihoodMethod: "weighted-mean", factors: [], hash: "000000000000" },
      snapshot: { snapshotFormat: 1 },
      contentHash: "111111111111",
    },
  ],
  instances: [{ id: "i1", importId: "imp1", multiprocessTfId: "mp1", prefix: "CAM1", eeMapping: [], assumptions: [] }],
});

describe("migrate_13_to_14", () => {
  it("only bumps the version and reports no analysis change", () => {
    const input = { schemaVersion: 13, info: { name: "x" }, dfd: { elements: [] } };
    const { data, analysisChanged } = migrate_13_to_14(input);
    expect(data).toEqual({ ...input, schemaVersion: 14 });
    expect(analysisChanged).toBe(false);
  });

  it("is the current schema", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(14);
  });

  it("a schema-13 file migrates to 14 with its analysis preserved", () => {
    const r = applyMigrations({ schemaVersion: 13, info: { name: "x" } });
    expect(r.data.schemaVersion).toBe(14);
    expect(r.applied).toEqual([14]);
    expect(r.analysisPreserved).toBe(true);
  });

  it("a file from a newer TARAflow is refused", () => {
    expect(() => applyMigrations({ schemaVersion: 15 })).toThrow(/Unsupported schema version: 15/);
  });

  it("the repair path keeps project.components", () => {
    const repaired = repairProject({ id: "p1", schemaVersion: 14, info: { name: "x" }, components: components() } as Any);
    expect(repaired?.components).toEqual(components());
  });

  it("the verification hash: unchanged without components, changed with them", () => {
    const p: Any = { info: { description: "d" }, dfd: null };
    const without = verificationStateHash(p);
    expect(verificationStateHash({ ...p, components: undefined })).toBe(without);
    expect(verificationStateHash({ ...p, components: components() })).not.toBe(without);
  });
});
