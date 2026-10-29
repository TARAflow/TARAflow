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
  effectVocabulary,
  projectEffect,
} from "features/threats/services/project-mitigations";
import { mergeProposedMitigations } from "features/threats/services/threat-identity";
import {
  getAllMitigations,
  getLocalizedMitigation,
  getMitigationCatalogVersion,
  resolveMitigationDrafts,
  setProjectMitigations,
} from "features/threats/services/threat-catalog-service";
import { DEFAULT_THREAT_CONFIGURATION, type ProjectMitigation } from "features/threats/models/threat-types";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import {
  projectMitigationUsage,
  isProjectMitigationUsed,
  mergeProjectMitigationRefs,
} from "app/services/project-mitigation-usage";
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

describe("CM-3: effect vocabulary, regeneration, merge", () => {
  it("the vocabulary is the built-in catalog's target / property / values; project entries do not extend it", () => {
    const vocab = effectVocabulary([
      ...getAllMitigations(),
      { isCustom: true, affectsProperties: [{ targetType: "Process", property: "madeUp", expectedValue: 1, confidence: "heuristic" }] },
    ] as Any);
    const enc = vocab.find((v) => v.targetType === "DataFlow" && v.property === "encryptionInTransit");
    expect(enc?.values).toEqual(expect.arrayContaining(["tls", "vpn"]));
    expect(vocab.some((v) => v.property === "madeUp")).toBe(false);
    expect(projectEffect({ targetType: "DataFlow", role: "channel", property: "encryptionInTransit" }, "tls")).toEqual({
      targetType: "DataFlow",
      role: "channel",
      property: "encryptionInTransit",
      expectedValue: "tls",
      confidence: "heuristic",
    });
  });

  it("a project mitigation on a generated threat survives regeneration", () => {
    expect(mergeProposedMitigations([{ id: "M-S-001" }, { id: "M-C-001" }, { notes: "free" }], [{ id: "M-S-001" }])).toEqual([
      { id: "M-S-001" },
      { id: "M-C-001" },
      { notes: "free" },
    ]);
  });

  it("merge rewrites threats, risks and attack trees, keeps one, drops the entry", () => {
    const project: Any = {
      threats: {
        configuration: { customMitigations: [{ id: "M-C-001" }, { id: "M-C-002" }] },
        perElementTables: [{ threats: [{ proposedMitigations: [{ id: "M-C-001", notes: "n" }] }, { proposedMitigations: [{ id: "M-C-001" }, { id: "M-C-002" }] }] }],
        perInteractionTables: [],
      },
      risks: { risks: [{ selectedMitigations: [{ id: "M-C-001", status: "open" }] }] },
      attackTrees: { trees: [{ dsl: "a [M-C-001]", pathAssessments: [{ mitigationIds: ["M-C-001", "M-C-002"] }] }] },
    };
    const out: Any = mergeProjectMitigationRefs(project, "M-C-001", "M-C-002");
    expect(out.threats.configuration.customMitigations).toEqual([{ id: "M-C-002" }]);
    expect(out.threats.perElementTables[0].threats.map((t: Any) => t.proposedMitigations)).toEqual([
      [{ id: "M-C-002", notes: "n" }],
      [{ id: "M-C-002" }],
    ]);
    expect(out.risks.risks[0].selectedMitigations).toEqual([{ id: "M-C-002", status: "open" }]);
    expect(out.attackTrees.trees[0]).toMatchObject({ dsl: "a [M-C-002]", pathAssessments: [{ mitigationIds: ["M-C-002"] }] });
  });
});
