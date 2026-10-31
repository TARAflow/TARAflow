// tests/unit/app/services/item-definition-passthrough.test.ts
//
// ISO/SAE 21434 conformance plan Phase 1 stage A (A-1, decision 24):
// project.itemDefinition survives every write path — the Overview's patch,
// the write channel, the disk form and loading (incl. the repair path, which
// rebuilds a project from known fields and used to drop sourceBindings too).

import { describe, it, expect } from "vitest";

import { buildGeneralTabPatch } from "app/services/general-tab-update";
import { mergeProjectPatch } from "app/services/project-commit";
import { prepareForDisk } from "app/services/prepare-for-disk";
import { parseAndRepair, repairProject } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import type { Project } from "app/models/project-types";
import type { GeneralTabData } from "features/overview";
import { EMPTY_PROJECT_TAGS, type ItemDefinition } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const itemDefinition = (): ItemDefinition => ({
  sections: {
    boundary: { text: "Detector head and its loop interface", source: { document: "arc42", section: "§3" }, modelRefs: ["TB-1"] },
  },
  functions: [{ id: "F1", name: "Detect smoke", lifecyclePhases: ["operation"] }],
  assumptions: [{ id: "A1", displayId: "ASM-01", text: "Loop wiring is not accessible", status: "open" }],
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

const tabData = (p: Project, extra: Partial<GeneralTabData> = {}): GeneralTabData =>
  ({ info: p.info, settings: p.settings, phaseStatus: p.phaseStatus, sourceBindings: p.sourceBindings, ...extra }) as GeneralTabData;

describe("itemDefinition survives every write path", () => {
  it("the Overview patch carries it; without it the stored one is not cleared", () => {
    const p = project({ itemDefinition: itemDefinition() });
    expect(buildGeneralTabPatch(p, tabData(p, { itemDefinition: itemDefinition() })).itemDefinition).toEqual(itemDefinition());
    expect("itemDefinition" in buildGeneralTabPatch(p, tabData(p))).toBe(false);
  });

  it("write channel and disk form", () => {
    const merged = mergeProjectPatch(project(), { id: "P", itemDefinition: itemDefinition() } as Any, "t1");
    expect(merged.itemDefinition).toEqual(itemDefinition());
    expect(prepareForDisk(merged).itemDefinition).toEqual(itemDefinition());
  });

  it("loading, valid and repaired; the repair keeps source bindings too", () => {
    const bindings = [{ id: "B1", repoUrl: "https://example.org/r.git" }];
    const raw: Any = JSON.parse(JSON.stringify(prepareForDisk(project({ itemDefinition: itemDefinition() }))));
    expect(parseAndRepair(raw)?.itemDefinition).toEqual(itemDefinition());
    const repaired = repairProject({ ...raw, sourceBindings: bindings });
    expect(repaired?.itemDefinition).toEqual(itemDefinition());
    expect(repaired?.sourceBindings).toEqual(bindings);
  });
});

describe("cybersecurityConcept survives the write paths (Phase 4, decision 25)", () => {
  const concept = {
    goals: [{ id: "g1", displayId: "CSG-01", statement: "Protect the loop", riskIds: ["R-1"], assetProperties: [] }],
    claims: [{ id: "c1", displayId: "CLM-01", statement: "Needs tools", kind: "retain", riskIds: ["R-2"], assumptionIds: ["a1"] }],
    verifications: [],
  };
  it("write channel, disk form, loading and repair", () => {
    const merged = mergeProjectPatch(project(), { id: "P", cybersecurityConcept: concept } as Any, "t1");
    expect(merged.cybersecurityConcept).toEqual(concept);
    const raw: Any = JSON.parse(JSON.stringify(prepareForDisk(merged)));
    expect(parseAndRepair(raw)?.cybersecurityConcept).toEqual(concept);
    expect(repairProject(raw)?.cybersecurityConcept).toEqual(concept);
  });
});
