// tests/unit/features/threats/services/project-mitigations.test.ts
//
// Custom mitigation catalog design CM-2: the project's own mitigations
// M-C-nnn — ids never reused, registered with the catalog so every reader
// (closed loop, dialogs, report) sees them like a built-in entry.

import { afterEach, describe, it, expect } from "vitest";
import "i18n/services/i18n";
import {
  addProjectMitigation,
  isProjectMitigationId,
  nextProjectMitigationId,
  removeProjectMitigation,
  updateProjectMitigation,
} from "features/threats/services/project-mitigations";
import {
  getAllMitigations,
  getLocalizedMitigation,
  getMitigationCatalogVersion,
  resolveMitigationDrafts,
  setProjectMitigations,
} from "features/threats/services/threat-catalog-service";
import { DEFAULT_THREAT_CONFIGURATION, type ProjectMitigation } from "features/threats/models/threat-types";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { projectMitigationUsage, isProjectMitigationUsed } from "app/services/project-mitigation-usage";
import { DiffService } from "features/audit/services/diff-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const effect = { targetType: "Process", property: "inputValidation", expectedValue: "strict", confidence: "heuristic" } as const;
const added = () =>
  addProjectMitigation(DEFAULT_THREAT_CONFIGURATION, {
    text: "  Validate the operator badge  ",
    strideCategory: "S",
    affectsProperties: [effect],
  });

afterEach(() => setProjectMitigations(undefined));

describe("project mitigation catalog — configuration", () => {
  it("M-C-001, trimmed, isCustom, the counter remembers it", () => {
    const { configuration, id } = added();
    expect(id).toBe("M-C-001");
    expect(isProjectMitigationId(id)).toBe(true);
    expect(isProjectMitigationId("M-S-001")).toBe(false);
    expect(configuration.customMitigations).toEqual([
      { id: "M-C-001", text: "Validate the operator badge", strideCategory: "S", context: {}, isCustom: true, affectsProperties: [effect] },
    ]);
    expect(configuration.customMitigationSeq).toBe(1);
  });

  it("ids are never reused after a delete", () => {
    const { configuration } = added();
    const second = addProjectMitigation(configuration, { text: "B", strideCategory: "T" });
    const afterDelete = removeProjectMitigation(second.configuration, "M-C-002");
    expect(afterDelete.customMitigations.map((m) => m.id)).toEqual(["M-C-001"]);
    expect(nextProjectMitigationId(afterDelete)).toBe("M-C-003");
  });

  it("update changes text (trimmed) and effects, not the id", () => {
    const { configuration } = added();
    const next = updateProjectMitigation(configuration, "M-C-001", { text: " New ", affectsProperties: [] });
    expect(next.customMitigations[0]).toMatchObject({ id: "M-C-001", text: "New", affectsProperties: [] });
  });
});

describe("registered with the catalog", () => {
  const entries = (): ProjectMitigation[] => added().configuration.customMitigations;

  it("joins the catalog, resolves its own text, bumps the version; none → built-in only", () => {
    const builtIn = getAllMitigations().length;
    const v = getMitigationCatalogVersion();
    setProjectMitigations(entries());
    expect(getMitigationCatalogVersion()).toBe(v + 1);
    expect(getAllMitigations()).toHaveLength(builtIn + 1);
    expect(getLocalizedMitigation("M-C-001")).toBe("Validate the operator badge");
    expect(resolveMitigationDrafts([{ id: "M-C-001", notes: "n" }])).toEqual([
      { id: "M-C-001", text: "Validate the operator badge", notes: "n", isCustom: false },
    ]);
    setProjectMitigations(undefined);
    expect(getAllMitigations()).toHaveLength(builtIn);
    expect(getLocalizedMitigation("M-C-001")).not.toBe("Validate the operator badge");
  });

  it("the closed loop derives the SHOULD of a project mitigation", () => {
    setProjectMitigations(entries());
    const threats: Any = {
      perElementTables: [{ threats: [{ id: "t1", linkedElement: { elementId: "p1", elementType: "Process" } }] }],
      perInteractionTables: [],
    };
    const risks: Any = {
      risks: [{ id: "r1", threatId: "t1", treatment: "reduce", selectedMitigations: [{ id: "M-C-001", status: "open" }] }],
    };
    const dfd: Any = { elements: [{ id: "p1", properties: { inputValidation: "none" } }], connections: [] };
    expect(deriveControlInstances(threats, risks, dfd, getAllMitigations())).toEqual([
      expect.objectContaining({ elementId: "p1", property: "inputValidation", expectedValue: "strict", status: "missing", coversMitigationIds: ["M-C-001"] }),
    ]);
  });
});

describe("usage and audit", () => {
  const project = (): Any => ({
    threats: { configuration: {}, perElementTables: [{ threats: [{ displayId: "P1-S-2", proposedMitigations: [{ id: "M-C-001" }] }] }], perInteractionTables: [] },
    risks: { risks: [{ id: "r1", threatDisplayId: "P1-S-2", selectedMitigations: [{ id: "M-C-001" }], proposedMitigations: [] }] },
    attackTrees: { trees: [{ id: "at1", name: "Tree", dsl: "leaf [M-C-001]", pathAssessments: [] }] },
  });

  it("finds threats, risks and attack trees using an entry", () => {
    const u = projectMitigationUsage(project(), "M-C-001");
    expect(u).toEqual({ threats: ["P1-S-2"], risks: ["P1-S-2"], attackTrees: ["Tree"] });
    expect(isProjectMitigationUsed(projectMitigationUsage(project(), "M-C-002"))).toBe(false);
  });

  it("the audit diff shows an added and a changed project mitigation", () => {
    const { configuration } = added();
    const threats = (cfg: Any): Any => ({ configuration: cfg, perElementTables: [], perInteractionTables: [] });
    const base: Any = { dfd: null, assets: null, risks: null, attackTrees: null };
    const svc = new DiffService();
    const addedPhase = svc.detectChanges({ ...base, threats: threats(configuration) }, { ...base, threats: threats(DEFAULT_THREAT_CONFIGURATION) });
    expect(addedPhase[0].changes.map((c) => `${c.type}:${c.name}`)).toEqual(["added:M-C-001 Validate the operator badge"]);
    const changed = updateProjectMitigation(configuration, "M-C-001", { text: "Other" });
    const modified = svc.detectChanges({ ...base, threats: threats(changed) }, { ...base, threats: threats(configuration) });
    expect(modified[0].changes[0]).toMatchObject({ type: "modified", description: "Project mitigation modified: 1 field(s) changed" });
  });
});
