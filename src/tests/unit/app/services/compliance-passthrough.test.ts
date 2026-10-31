// tests/unit/app/services/compliance-passthrough.test.ts
//
// IEC 62443-4-2 matrix data (iec-62443-4-2-cra-coverage.md D-8, schema 12):
// project.compliance survives every write path — the write channel, the
// disk form and loading, including the repair path, which rebuilds a project
// from known fields.

import { describe, it, expect } from "vitest";

import { mergeProjectPatch } from "app/services/project-commit";
import { prepareForDisk } from "app/services/prepare-for-disk";
import { parseAndRepair, repairProject } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import type { Project } from "app/models/project-types";
import { EMPTY_PROJECT_TAGS, type ComplianceData } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const compliance = (): ComplianceData => ({
  componentId: "mp_ctl",
  target: { IAC: 2, UC: 2, SI: 3 },
  deviceCategories: { categories: ["EDR"], source: "manual" },
  statements: {
    "en-iec-62443-4-2-praa-2026": {
      "CR 1.7": { status: "met", reasoning: "NIST SP 800-63B rules in the login service", evidenceRef: "TR-12 §4", modelStatusAtStatement: "needs-statement", date: "2026-11-02" },
    },
    "iec-62443-4-2-2019": {
      "EDR 3.10": { status: "met", reasoning: "signed OTA", supportingMeasure: "update server", date: "2026-11-02" },
    },
  },
});

const project = (extra: Partial<Project> = {}): Project =>
  ({
    id: "P",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    info: { name: "Detector", description: "Detects smoke", tags: { ...EMPTY_PROJECT_TAGS }, team: [] },
    currentPhase: 0,
    phaseStatus: {},
    settings: {},
    hazards: null,
    dfd: null,
    assets: null,
    threats: null,
    risks: null,
    attackTrees: null,
    documentation: null,
    audit: null,
    integration: null,
    ...extra,
  }) as unknown as Project;

describe("project.compliance survives every write path (schema 12)", () => {
  it("write channel and disk form", () => {
    const merged = mergeProjectPatch(project(), { id: "P", compliance: compliance() } as Any, "t1");
    expect(merged.compliance).toEqual(compliance());
    expect(prepareForDisk(merged).compliance).toEqual(compliance());
  });

  it("loading, valid and repaired", () => {
    const raw: Any = JSON.parse(JSON.stringify(prepareForDisk(project({ compliance: compliance() }))));
    expect(parseAndRepair(raw)?.compliance).toEqual(compliance());
    expect(repairProject(raw)?.compliance).toEqual(compliance());
  });

  it("a schema-11 file has none and gets none", () => {
    const raw: Any = JSON.parse(JSON.stringify(prepareForDisk(project())));
    expect(parseAndRepair({ ...raw, schemaVersion: 11 })?.compliance).toBeUndefined();
  });
});
