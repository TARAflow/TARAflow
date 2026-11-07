// src/tests/unit/app/utils/component-threats.test.ts
//
// Multi-project TARA, patch 14 (design §7.1): the imported threats as one
// read model, derived per instance from the snapshot — remapped ids and
// references, the component's decisions kept, no threats on the
// component's EEs, no perspective whose victim is the EE side; and the
// risks they get through the normal risk sync.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { componentExcludedIds } from "app/services/component-import/component-scope";
import {
  componentThreatData,
  componentThreatGroups,
  componentThreatReferences,
  withComponentThreats,
} from "app/utils/component-threats";
import { componentInstanceTfId, instanceAssetId, type ComponentInsertContext } from "features/dfd";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { flow, mxfile, node, page } from "../../../fixtures/leveled-dfd-xml";

const componentProject = (() => {
  const p = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
  // Make a few threats relevant so that risks are created.
  for (const tb of p.threats!.perElementTables) for (const t of tb.threats.slice(0, 2)) t.relevance = "relevant";
  return p;
})();
const snapshot = buildComponentSnapshot(componentProject);
const EES = new Set(snapshot.dfd!.elements.filter((e) => e.type === "ExternalEntity").map((e) => e.id));

const context = (): ComponentInsertContext => ({
  xml: mxfile(page("top", "Fire Panel", node("m_plc", "externalentity", "Fire Panel Controller", "EE-1", 10) + node("m_p1", "process", "Alarm Logic", "P-1", 300) + flow("m_df1", "report alarm", "DF-1", "m_plc", "m_p1"))),
  pages: [],
  pageId: "top",
  assets: [],
  elements: [
    { id: "m_plc", displayId: "EE-1", name: "Fire Panel Controller", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    { id: "m_p1", displayId: "P-1", name: "Alarm Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
  ] as never,
  connections: [{ id: "m_df1", displayId: "DF-1", name: "report alarm", from: "m_plc", to: "m_p1", properties: {} }] as never,
});

function machine(instances: { id: string; prefix: string }[]) {
  let components: Project["components"] | undefined;
  let ctx = context();
  for (const i of instances) {
    const applied = applyComponentImport({
      context: ctx,
      machine: { components },
      result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(componentProject), source: { commitSha: "a", schemaVersion: 14 } },
      choice: { prefix: i.prefix, name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" } },
      ids: { importId: "imp", instanceId: i.id },
      importedAt: "t",
    });
    components = applied.components;
    ctx = { ...ctx, xml: applied.outcome.xml, pages: applied.outcome.pages, elements: applied.outcome.elements, connections: applied.outcome.connections, assets: applied.outcome.assets };
  }
  return { components, dfd: { elements: ctx.elements, connections: ctx.connections }, assets: null, threats: null } as unknown as Project;
}

const allSnapshotThreats = [...snapshot.threats!.perElementTables, ...snapshot.threats!.perInteractionTables].flatMap((t) => t.threats);

describe("componentThreatData", () => {
  const m = machine([{ id: "inst-1", prefix: "SD1" }]);
  const data = componentThreatData(m)!;
  const threats = [...data.perElementTables, ...data.perInteractionTables].flatMap((t) => t.threats);

  it("one table per method and instance, named after the instance", () => {
    expect(data.perElementTables).toHaveLength(1);
    expect(data.perElementTables[0].displayIdentifier).toBe("[SD1]");
    expect(data.perElementTables[0].trustBoundaryName).toBe("SD1 · Smoke Detector");
  });

  it("remaps ids, references and display ids to the instance", () => {
    const original = snapshot.threats!.perElementTables.flatMap((t) => t.threats).find((t) => t.linkedElement && !EES.has(t.linkedElement.elementId) && (t.linkedAssetIds ?? []).length > 0)!;
    const mine = threats.find((t) => t.id === componentInstanceTfId("inst-1", `threat|${original.id}`))!;
    expect(mine.displayId).toBe(`SD1:${original.displayId}`);
    expect(mine.linkedElement!.elementId).toBe(componentInstanceTfId("inst-1", original.linkedElement!.elementId));
    expect(mine.linkedAssetIds).toEqual(original.linkedAssetIds.map((a) => instanceAssetId("inst-1", a)));
    expect(mine.relevance).toBe(original.relevance);
    expect(mine.strideCategory).toBe(original.strideCategory);
  });

  it("no threat on a component EE", () => {
    expect(threats.filter((t) => t.linkedElement?.elementType === "ExternalEntity")).toEqual([]);
    expect(allSnapshotThreats.some((t) => t.linkedElement?.elementType === "ExternalEntity")).toBe(true);
  });

  it("no per-interaction threat whose victim is the EE side", () => {
    const machineEeIds = new Set(m.components!.instances[0].eeMapping.map((e) => e.machineTfId));
    for (const t of data.perInteractionTables.flatMap((tb) => tb.threats)) {
      if (!t.dataFlow) continue;
      const victim = t.interactionContext?.victimRole === "source" ? t.dataFlow.sourceId : t.dataFlow.targetId;
      expect(machineEeIds.has(victim)).toBe(false);
    }
  });

  it("the imported threats are exactly on the excluded parts (patch 12 ↔ 14)", () => {
    const excluded = componentExcludedIds(m);
    for (const t of data.perElementTables.flatMap((tb) => tb.threats)) {
      expect(excluded.has(t.linkedElement!.elementId), t.displayId).toBe(true);
    }
  });

  it("two instances: distinct, stable ids", () => {
    const two = machine([{ id: "inst-1", prefix: "SD1" }, { id: "inst-2", prefix: "SD2" }]);
    const d = componentThreatData(two)!;
    const ids = [...d.perElementTables, ...d.perInteractionTables].flatMap((t) => t.threats.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(componentThreatData(machine([{ id: "inst-1", prefix: "SD1" }]))).toEqual(data);
  });

  it("no components, no data", () => {
    expect(componentThreatData({})).toBeNull();
  });
});

describe("groups, references, merge", () => {
  const m = machine([{ id: "inst-1", prefix: "SD1" }]);

  it("one group per instance for the Threats tab", () => {
    const groups = componentThreatGroups(m);
    expect(groups.map((g) => g.label)).toEqual(["SD1 · Smoke Detector"]);
    expect(groups[0].threats.length).toBeGreaterThan(0);
  });

  it("each row names its method — the Threats tab shows the active one (manual test 2026-11-07)", () => {
    const rows = componentThreatGroups(m)[0].rows;
    const data = componentThreatData(m)!;
    const count = (tables: { threats: unknown[] }[]) => tables.reduce((n, t) => n + t.threats.length, 0);
    expect(rows.filter((r) => r.method === "per-element").length).toBe(count(data.perElementTables));
    expect(rows.filter((r) => r.method === "per-interaction").length).toBe(count(data.perInteractionTables));
    expect(rows.every((r) => r.method === "per-element" || r.method === "per-interaction")).toBe(true);
  });

  it("references for the risk register, per method", () => {
    const refs = componentThreatReferences(m, "per-element");
    expect(refs.length).toBe(componentThreatData(m)!.perElementTables[0].threats.length);
    expect(refs.every((r) => r.sourceStrideMethod === "per-element")).toBe(true);
    expect(refs[0].trustBoundaryId).toBe("[SD1]");
  });

  it("withComponentThreats adds the imported tables to the stored ones", () => {
    const merged = withComponentThreats({ perElementTables: [{ trustBoundaryId: null, trustBoundaryName: "own", displayIdentifier: "[TB]", threats: [] }], perInteractionTables: [], lastModified: "" } as never, m)!;
    expect(merged.perElementTables.map((t) => t.displayIdentifier)).toEqual(["[TB]", "[SD1]"]);
    expect(withComponentThreats(null, {})).toBeNull();
  });

  it("the risk sync creates risks for the relevant imported threats with stable ids", () => {
    const refs = [...componentThreatReferences(m, "per-element"), ...componentThreatReferences(m, "per-interaction")];
    const relevant = refs.filter((r) => r.relevance === "relevant");
    expect(relevant.length).toBeGreaterThan(0);
    const result = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: "" } as never, refs);
    const riskIds = new Set(result.riskData.risks.map((r) => r.id));
    for (const r of relevant) expect(riskIds.has(`R-${r.id}`), r.displayId).toBe(true);
  });
});

// ==================== RELEVANCE OVERRIDE (I3, patch 15) ====================

import { withRelevanceOverride } from "app/services/component-import/relevance-overrides";
import { DiffService } from "features/audit/services/diff-service";

describe("relevance override on boundary flows (I3)", () => {
  const base = machine([{ id: "inst-1", prefix: "SD1" }]);
  const groups = componentThreatGroups(base);
  const boundaryRow = groups[0].rows.find((r) => r.boundary)!;
  const internalRow = groups[0].rows.find((r) => !r.boundary)!;
  const decide = (row: typeof boundaryRow, relevance: "relevant" | "not_relevant") =>
    ({ ...base, components: withRelevanceOverride(base.components!, "inst-1", row.threatKey, { relevance, rationale: "Runs over the plant network", componentRelevance: row.componentRelevance }, "2026-11-07") }) as Project;

  it("the rows know which threats lie on a boundary flow", () => {
    expect(boundaryRow).toBeDefined();
    expect(internalRow).toBeDefined();
  });

  it("an override on a boundary-flow threat changes the machine's relevance; the component's stays visible", () => {
    const target = boundaryRow.componentRelevance === "relevant" ? "not_relevant" : "relevant";
    const row = componentThreatGroups(decide(boundaryRow, target))[0].rows.find((r) => r.threatKey === boundaryRow.threatKey)!;
    expect(row.threat.relevance).toBe(target);
    expect(row.componentRelevance).toBe(boundaryRow.componentRelevance);
    expect(row.override).toMatchObject({ relevance: target, rationale: "Runs over the plant network" });
    expect(row.stale).toBeUndefined();
  });

  it("an override stored for an internal threat has no effect (internals stay read-only)", () => {
    const p = decide(internalRow, internalRow.componentRelevance === "relevant" ? "not_relevant" : "relevant");
    const row = componentThreatGroups(p)[0].rows.find((r) => r.threatKey === internalRow.threatKey)!;
    expect(row.threat.relevance).toBe(internalRow.componentRelevance);
    expect(row.override).toBeUndefined();
  });

  it("raised to relevant, the threat gets a risk", () => {
    const p = decide(boundaryRow, "relevant");
    const refs = [...componentThreatReferences(p, "per-element"), ...componentThreatReferences(p, "per-interaction")];
    const result = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: "" } as never, refs);
    expect(result.riskData.risks.some((r) => r.id === `R-${boundaryRow.threat.id}`)).toBe(true);
  });

  it("re-check: when the component changed its decision since, the override is to review", () => {
    const p = decide(boundaryRow, "relevant");
    const stale = { ...p, components: { ...p.components!, instances: p.components!.instances.map((i) => ({ ...i, relevanceOverrides: i.relevanceOverrides!.map((o) => ({ ...o, componentRelevance: "uncertain" as const })) })) } } as Project;
    const row = componentThreatGroups(stale)[0].rows.find((r) => r.threatKey === boundaryRow.threatKey)!;
    expect(boundaryRow.componentRelevance).not.toBe("uncertain");
    expect(row.stale).toBe(true);
  });

  it("set, replace, remove; a rationale is required", () => {
    const c1 = withRelevanceOverride(base.components!, "inst-1", "k", { relevance: "relevant", rationale: " a ", componentRelevance: "not_relevant" }, "d1");
    expect(c1.instances[0].relevanceOverrides).toEqual([{ threatKey: "k", relevance: "relevant", rationale: "a", componentRelevance: "not_relevant", date: "d1" }]);
    const c2 = withRelevanceOverride(c1, "inst-1", "k", { relevance: "uncertain", rationale: "b", componentRelevance: "not_relevant" }, "d2");
    expect(c2.instances[0].relevanceOverrides).toHaveLength(1);
    expect(c2.instances[0].relevanceOverrides![0].relevance).toBe("uncertain");
    const c3 = withRelevanceOverride(c2, "inst-1", "k", null, "d3");
    expect("relevanceOverrides" in c3.instances[0]).toBe(false);
    expect(() => withRelevanceOverride(base.components!, "inst-1", "k", { relevance: "relevant", rationale: "  ", componentRelevance: "unrated" }, "d")).toThrow();
  });

  it("the commit gate opens: the audit diff sees an override", () => {
    const p = decide(boundaryRow, "relevant");
    const changes = new DiffService().detectChanges(
      { ...p, dfd: null, assets: null, threats: null, risks: null, attackTrees: null } as never,
      { ...base, dfd: null, assets: null, threats: null, risks: null, attackTrees: null } as never,
    );
    const section = changes.find((c) => c.phase === "components")!;
    expect(section).toBeDefined();
    expect(section.changes[0]).toMatchObject({ type: "modified", name: "SD1" });
    expect(section.changes[0].details!.map((d) => d.field)).toContain("relevanceOverrides");
  });
});

// ==================== FACTOR PREFILL (§7.2, patch 16) ====================

import { componentFactorPrefills } from "app/utils/component-threats";
import { componentFindings } from "app/services/component-import/component-findings";

describe("factor prefill per fingerprint (patch 16)", () => {
  // cnc-ref: weighted mean, 4-level, skill_level / ease_of_exploit rated.
  const cncProject = parseAndRepair(loadProjectFixture("cnc-ref.tara.json")) as Project;
  const cncSnapshot = buildComponentSnapshot(cncProject);
  const imported = () => {
    const applied = applyComponentImport({
      context: context(),
      machine: {},
      result: { snapshot: cncSnapshot, contentHash: snapshotContentHash(cncSnapshot), methodology: projectMethodologyFingerprint(cncProject), source: { commitSha: "a", schemaVersion: 14 } },
      choice: { prefix: "CNC1", name: "CNC", eeMapping: {} },
      ids: { importId: "imp", instanceId: "inst-c" },
      importedAt: "t",
    });
    return applied.components;
  };
  const withRisks = (configuration: Record<string, unknown>) =>
    ({ components: imported(), risks: { configuration: { ...cncProject.risks!.configuration, ...configuration }, risks: [], lastModified: "" } }) as unknown as Project;

  it("identical methodology: every rated intrinsic factor of each risk", () => {
    const prefills = componentFactorPrefills(withRisks({}));
    expect(prefills.size).toBeGreaterThan(0);
    for (const values of prefills.values()) {
      for (const v of values) expect(["skill_level", "ease_of_exploit"]).toContain(v.factorId);
    }
    const sr = cncSnapshot.risks.find((x) => x.intrinsicFactors.length > 0)!;
    expect(prefills.get(componentInstanceTfId("inst-c", `threat|${sr.threatId}`))).toEqual(sr.intrinsicFactors);
  });

  it("another likelihood scale: nothing is taken over", () => {
    expect(componentFactorPrefills(withRisks({ scale: "5-level" })).size).toBe(0);
  });

  it("findings: method mismatch (info), unrated imported risks, overrides without rationale", () => {
    const p = withRisks({ scale: "5-level" });
    const inst = p.components!.instances[0];
    const sr = cncSnapshot.risks[0];
    const riskOf = (ratings: Record<string, unknown>[]) => ({ id: "r", threatId: componentInstanceTfId(inst.id, `threat|${sr.threatId}`), factorRatings: ratings });
    const project = {
      ...p,
      dfd: { elements: [], connections: [] },
      risks: { ...p.risks!, risks: [riskOf([{ factorId: "skill_level", value: 0, weight: 1 }, { factorId: "ease_of_exploit", value: 2, weight: 1, source: "manual", derivedValue: 3, derivedFrom: "component" }])] },
    } as unknown as Project;
    const f = componentFindings(project);
    expect(f.infos.map((x) => x.key)).toEqual(["components.findings.CMP_METHOD_MISMATCH"]);
    expect(f.warnings.map((x) => x.key)).toEqual(expect.arrayContaining(["components.findings.CMP_FACTOR_UNRATED", "components.findings.CMP_FACTOR_OVERRIDE_RATIONALE"]));
    // with a rationale the override finding goes
    const withRationale = { ...project, risks: { ...project.risks!, risks: [riskOf([{ factorId: "skill_level", value: 1, weight: 1 }, { factorId: "ease_of_exploit", value: 2, weight: 1, source: "manual", derivedValue: 3, derivedFrom: "component", overrideRationale: "network" }])] } } as unknown as Project;
    expect(componentFindings(withRationale).warnings.map((x) => x.key)).not.toContain("components.findings.CMP_FACTOR_OVERRIDE_RATIONALE");
  });

  it("the commit gate opens on an override rationale alone (risk factor ratings in the audit diff)", () => {
    const risk = (rationale: string) => ({ id: "r1", threatId: "t", threatDisplayId: "X", strideCategory: "T", calculatedRiskBeforeMitigation: 6, calculatedRiskAfterMitigation: 0, moscowPriority: "must", selectedMitigations: [], factorRatings: [{ factorId: "skill_level", value: 2, weight: 1, source: "manual", derivedValue: 3, derivedFrom: "component", overrideRationale: rationale }], mitigatedFactorRatings: [] });
    const project = (rationale: string) => ({ dfd: null, assets: null, threats: null, attackTrees: null, risks: { configuration: DEFAULT_CONFIGURATION, risks: [risk(rationale)], lastModified: "" } }) as never;
    const changes = new DiffService().detectChanges(project("plant network"), project(""));
    const section = changes.find((c) => c.phase === "risks")!;
    expect(section.changes[0].details!.map((d) => d.field)).toEqual(["factorRatings"]);
  });
});
