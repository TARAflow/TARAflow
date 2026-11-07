// src/tests/unit/app/services/component-import/import-into-machine-with-threats.test.ts
//
// Multi-project TARA, manual test 2026-11-07: the usual order is that the
// machine already has its threats (and risks) when a component is imported.
// Real insertion, real save, real graphs before and after, both generators,
// the sync check and the sync, the risk sync:
//   - the machine's existing threats survive the import untouched (no
//     orphan, no removal, no change)
//   - the sync adds no threat on a part of the component; the boundary flows
//     get only the machine-side perspective (per interaction), none per
//     element (they are the component's flows)
//   - after the sync both methods are in sync
//   - the risk register keeps the machine's risks and gains the imported ones

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { componentExcludedIds } from "app/services/component-import/component-scope";
import { componentThreatReferences } from "app/utils/component-threats";
import { extractThreatReferences } from "app/utils/extract-threat-references";
import dfdService from "features/dfd/services/dfd-service";
import { DFDGraphAnalysisContext } from "features/dfd/adapters/dfd-graph-analysis-context";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import { interactionThreatGenerator } from "features/threats/services/per-interaction/interaction-generator";
import { elementThreatSync } from "features/threats/services/per-element/element-sync";
import { interactionThreatSync } from "features/threats/services/per-interaction/interaction-sync";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import type { Threat, ThreatConfiguration, ThreatProjectData, ThreatTable } from "features/threats/models/threat-types";
import type { DFDProjectData } from "features/dfd/models/dfd-types";
import type { DFDGraph } from "features/dfd/models/dfd-graph-types";
import { flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const component = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
const snapshot = buildComponentSnapshot(component);

const machineXml = mxfile(
  page(
    "top",
    "Fire Panel",
    `<object label="Cabinet" type="trustboundary" id="m_tb"><mxCell vertex="1" parent="1" style="rounded=0;dashed=1;"><mxGeometry x="0" y="0" width="1400" height="900" as="geometry"/></mxCell></object>` +
      node("m_plc", "externalentity", "Fire Panel Controller", "EE-1", 1600) +
      node("m_p1", "process", "Alarm Logic", "P-1", 300) +
      flow("m_df1", "report alarm", "DF-1", "m_plc", "m_p1"),
  ),
);
const machineElements = [
  { id: "m_tb", displayId: "TB-1", name: "Cabinet", type: "TrustBoundary", position: { x: 0, y: 0 }, size: { width: 1400, height: 900 }, properties: {} },
  { id: "m_plc", displayId: "EE-1", name: "Fire Panel Controller", type: "ExternalEntity", position: { x: 1600, y: 10 }, size: { width: 120, height: 60 }, properties: {} },
  { id: "m_p1", displayId: "P-1", name: "Alarm Logic", type: "Process", position: { x: 300, y: 10 }, size: { width: 120, height: 60 }, properties: {} },
] as never[];
const machineConnections = [{ id: "m_df1", displayId: "DF-1", name: "report alarm", from: "m_plc", to: "m_p1", properties: {} }] as never[];

const save = (xml: string, pages: unknown, elements: unknown, connections: unknown) =>
  dfdService.saveDFDFromXml(
    { id: "machine", name: "Fire Panel", phaseStatus: {}, dfd: { xml: machineXml, pages, elements, connections, assets: [] } } as unknown as DFDProjectData,
    xml,
  );

const config = { activeMethod: "per-element", forceClassicMode: false, zeroTrustMode: false } as unknown as ThreatConfiguration;
const iconfig = { ...config, activeMethod: "per-interaction" } as ThreatConfiguration;
const threatProject = (graph: DFDGraph, element: ThreatTable[], interaction: ThreatTable[], excluded?: Set<string>): ThreatProjectData =>
  ({
    id: "machine",
    name: "Fire Panel",
    phaseStatus: {},
    dfdGraph: toReferenceGraph(graph),
    threats: { configuration: config, perElementTables: element, perInteractionTables: interaction, lastModified: "" },
    ...(excluded ? { excludedElementIds: excluded } : {}),
    lastModified: "",
  }) as unknown as ThreatProjectData;
const all = (tables: ThreatTable[]) => tables.flatMap((t) => t.threats);
const byId = (tables: ThreatTable[]) => new Map(all(tables).map((t) => [t.id, t]));

// ── 1. The machine alone, with its threats ───────────────────────────────
const before = save(machineXml, undefined, machineElements, machineConnections);
const beforeGraph = before.dfd.graph!;
const ownElement = elementThreatGenerator.generateThreatsForProject(threatProject(beforeGraph, [], []), config);
const ownInteraction = interactionThreatGenerator.generateThreatsForProject(threatProject(beforeGraph, [], []), new DFDGraphAnalysisContext(beforeGraph), iconfig);

// ── 2. The import ────────────────────────────────────────────────────────
const applied = applyComponentImport({
  context: { xml: machineXml, pages: [], pageId: "top", assets: [], elements: machineElements, connections: machineConnections } as never,
  machine: {},
  result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component), source: { commitSha: "a", schemaVersion: 14 } },
  choice: { prefix: "SD1", name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" } },
  ids: { importId: "imp", instanceId: "inst-1" },
  importedAt: "t",
});
const after = save(applied.outcome.xml, applied.outcome.pages, applied.outcome.elements, applied.outcome.connections);
const graph = after.dfd.graph!;
const ctx = new DFDGraphAnalysisContext(graph);
const excluded = componentExcludedIds({ components: applied.components });
const ees = new Set(snapshot.dfd!.elements.filter((e) => e.type === "ExternalEntity").map((e) => e.id));
const boundaryIds = new Set(
  applied.outcome.connections.filter((c) => c.displayId === "DF-xx" && excluded.has(c.id)).map((c) => c.id),
);

describe("import into a machine that already has threats", () => {
  it("setup: the machine had threats of both methods, the import added boundary flows", () => {
    expect(after.success).toBe(true);
    expect(all(ownElement).length).toBeGreaterThan(0);
    expect(all(ownInteraction).length).toBeGreaterThan(0);
    expect(boundaryIds.size).toBeGreaterThan(0);
  });

  describe.each([
    ["per element", ownElement, "element"],
    ["per interaction", ownInteraction, "interaction"],
  ] as const)("%s", (_label, own, kind) => {
    const project = () =>
      kind === "element" ? threatProject(graph, own as ThreatTable[], [], excluded) : threatProject(graph, [], own as ThreatTable[], excluded);
    const sync = kind === "element" ? elementThreatSync : interactionThreatSync;
    const status = sync.checkSyncStatus(project(), own as ThreatTable[]);
    const result = sync.synchronizeThreats(project(), ctx, own as ThreatTable[], status, { updateReferences: true, removeOrphaned: true });
    const tables = (kind === "element" ? result.threatData!.perElementTables : result.threatData!.perInteractionTables) as ThreatTable[];
    const victimOf = (t: Threat) => (t.interactionContext?.victimRole === "source" ? t.dataFlow?.sourceId : t.dataFlow?.targetId);

    it("no existing threat is orphaned or removed by the import", () => {
      expect(status.orphanedThreats.threatIds).toEqual([]);
      expect(result.removed).toBe(0);
      const now = byId(tables);
      for (const t of all(own as ThreatTable[])) {
        const kept = now.get(t.id);
        expect(kept, t.displayId).toBeDefined();
        expect([kept!.threatDescription, kept!.relevance, kept!.strideCategory]).toEqual([t.threatDescription, t.relevance, t.strideCategory]);
      }
    });

    it("the sync adds nothing on a part of the component", () => {
      const added = all(tables).filter((t) => !byId(own as ThreatTable[]).has(t.id));
      if (kind === "element") {
        expect(added.filter((t) => excluded.has(t.linkedElement?.elementId ?? "") || excluded.has(t.dataFlow?.connectionId ?? ""))).toEqual([]);
      } else {
        // boundary flows: only the machine-side perspective
        for (const t of added.filter((x) => x.dataFlow)) expect(excluded.has(victimOf(t) ?? ""), t.displayId).toBe(false);
        expect(added.filter((t) => !t.dataFlow && excluded.has(t.linkedElement?.elementId ?? ""))).toEqual([]);
      }
    });

    it("after the sync the method is in sync", () => {
      const again = sync.checkSyncStatus({ ...project(), threats: result.threatData! } as ThreatProjectData, tables);
      expect(again.inSync, JSON.stringify(again.summary ?? again).slice(0, 300)).toBe(true);
    });
  });

  it("per interaction: the boundary flows get the machine-side perspective through the sync", () => {
    const status = interactionThreatSync.checkSyncStatus(threatProject(graph, [], ownInteraction, excluded), ownInteraction);
    const result = interactionThreatSync.synchronizeThreats(threatProject(graph, [], ownInteraction, excluded), ctx, ownInteraction, status, { updateReferences: true, removeOrphaned: true });
    const onBoundary = all(result.threatData!.perInteractionTables as ThreatTable[]).filter((t) => boundaryIds.has(t.dataFlow?.connectionId ?? ""));
    expect(onBoundary.length).toBeGreaterThan(0);
  });

  it("the risk register keeps the machine's risks and gains the imported ones", () => {
    const relevant = (tables: ThreatTable[]) =>
      tables.map((tb) => ({ ...tb, threats: tb.threats.map((t) => ({ ...t, relevance: "relevant" as const })) }));
    const ownRefs = extractThreatReferences({ perElementTables: relevant(ownElement), perInteractionTables: [], lastModified: "" } as never, "per-element", [], after.dfd.elements as never);
    const riskData = { configuration: { ...component.risks!.configuration }, risks: [], lastModified: "" } as never;
    const first = syncRisksFromThreats(riskData, ownRefs).riskData;
    expect(first.risks.length).toBeGreaterThan(0);
    const imported = componentThreatReferences(
      { components: applied.components, assets: { assets: [] } as never, dfd: after.dfd as never, risks: first as never },
      "per-element",
    );
    const second = syncRisksFromThreats(first, [...ownRefs, ...imported]).riskData;
    const ids = new Set(second.risks.map((r) => r.threatId));
    for (const r of first.risks) expect(ids.has(r.threatId), r.threatId).toBe(true);
    const importedRelevant = imported.filter((r) => r.relevance === "relevant");
    expect(importedRelevant.length).toBeGreaterThan(0);
    for (const r of importedRelevant) expect(ids.has(r.id), r.displayId).toBe(true);
    // the machine's risks are unchanged by the import
    const firstById = new Map(first.risks.map((r) => [r.id, r]));
    for (const r of second.risks.filter((x) => firstById.has(x.id))) expect(r.factorRatings).toEqual(firstById.get(r.id)!.factorRatings);
  });
});
