// src/tests/unit/app/services/component-import/component-threat-exclusion.test.ts
//
// Multi-project TARA, patch 12 (design §7.1): no generator runs on the parts
// of an imported component. Built end to end: a fire panel imports the
// SmokeDetector (real insertion, real save, real analysis graph), then both
// generators and their sync checks run with the instance's ids excluded.
//   - per element: no threat on a component element or flow
//   - per interaction: no threat on a flow inside the component; on a
//     boundary flow only the perspective whose victim is the machine side
//   - the machine's own elements keep their threats; the sync reports
//     nothing missing for the component's parts

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { componentExcludedIds } from "app/services/component-import/component-scope";
import dfdService from "features/dfd/services/dfd-service";
import { DFDGraphAnalysisContext } from "features/dfd/adapters/dfd-graph-analysis-context";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import { interactionThreatGenerator } from "features/threats/services/per-interaction/interaction-generator";
import { elementThreatSync } from "features/threats/services/per-element/element-sync";
import { interactionThreatSync } from "features/threats/services/per-interaction/interaction-sync";
import type { ThreatConfiguration, ThreatProjectData, ThreatTable } from "features/threats/models/threat-types";
import type { DFDProjectData } from "features/dfd/models/dfd-types";
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

const applied = applyComponentImport({
  context: { xml: machineXml, pages: [], pageId: "top",
    assets: [], elements: machineElements, connections: [{ id: "m_df1", displayId: "DF-1", name: "report alarm", from: "m_plc", to: "m_p1", properties: {} }] as never },
  machine: {},
  result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component), source: { commitSha: "a", schemaVersion: 14 } },
  choice: { prefix: "SD1", name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" } },
  ids: { importId: "imp", instanceId: "inst-1" },
  importedAt: "t",
});
const saved = dfdService.saveDFDFromXml(
  { id: "machine", name: "Fire Panel", phaseStatus: {}, dfd: { xml: machineXml, pages: applied.outcome.pages, elements: applied.outcome.elements, connections: applied.outcome.connections, assets: [] } } as unknown as DFDProjectData,
  applied.outcome.xml,
);
const graph = saved.dfd.graph!;
const excluded = componentExcludedIds({ components: applied.components });
const config = { activeMethod: "per-element", forceClassicMode: false, zeroTrustMode: false } as unknown as ThreatConfiguration;

const project = (withExclusion: boolean): ThreatProjectData =>
  ({
    id: "machine",
    name: "Fire Panel",
    threats: null,
    phaseStatus: {},
    dfdGraph: toReferenceGraph(graph),
    ...(withExclusion ? { excludedElementIds: excluded } : {}),
    lastModified: "",
  }) as unknown as ThreatProjectData;

const allThreats = (tables: ThreatTable[]) => tables.flatMap((t) => t.threats);
const boundaryFlows = new Set(
  snapshot.dfd!.connections
    .filter((c) => {
      const ee = (id: string) => snapshot.dfd!.elements.find((e) => e.id === id)?.type === "ExternalEntity";
      return ee(c.from) !== ee(c.to);
    })
    .map((c) => applied.outcome.connections.find((x) => x.name === c.name && x.displayId === "DF-xx")?.id)
    .filter(Boolean) as string[],
);

describe("component scope", () => {
  it("excludes the component's elements and flows, not the machine's", () => {
    expect(saved.success).toBe(true);
    expect(excluded.size).toBeGreaterThan(20);
    for (const id of ["m_plc", "m_p1", "m_df1", "m_tb"]) expect(excluded.has(id)).toBe(false);
    for (const id of boundaryFlows) expect(excluded.has(id)).toBe(true);
  });
});

describe("per element", () => {
  const tables = elementThreatGenerator.generateThreatsForProject(project(true), config);
  const threats = allThreats(tables);

  it("no threat on a part of the component", () => {
    expect(threats.filter((t) => excluded.has(t.linkedElement?.elementId ?? ""))).toEqual([]);
  });

  it("the machine's elements keep their threats", () => {
    expect(threats.some((t) => t.linkedElement?.elementId === "m_p1")).toBe(true);
    expect(threats.some((t) => t.linkedElement?.elementId === "m_plc")).toBe(true);
  });

  it("without the exclusion the component's parts would get threats (the test bites)", () => {
    const unexcluded = allThreats(elementThreatGenerator.generateThreatsForProject(project(false), config));
    expect(unexcluded.some((t) => excluded.has(t.linkedElement?.elementId ?? ""))).toBe(true);
  });

  it("the sync reports nothing missing for the component's parts", () => {
    const status = elementThreatSync.checkSyncStatus(project(true), tables);
    expect(status.missingInThreats.elements.filter((e) => excluded.has(e.id))).toEqual([]);
    expect(status.missingInThreats.dataFlows.filter((c) => excluded.has(c.id))).toEqual([]);
  });
});

describe("per interaction", () => {
  const ctx = new DFDGraphAnalysisContext(graph);
  const iconfig = { ...config, activeMethod: "per-interaction" } as ThreatConfiguration;
  const tables = interactionThreatGenerator.generateThreatsForProject(project(true), ctx, iconfig);
  const threats = allThreats(tables);
  const victimOf = (t: (typeof threats)[number]) =>
    t.interactionContext?.victimRole === "source" ? t.dataFlow?.sourceId : t.dataFlow?.targetId;

  it("no threat whose victim is a part of the component", () => {
    const flowThreats = threats.filter((t) => t.dataFlow);
    expect(flowThreats.filter((t) => excluded.has(victimOf(t) ?? ""))).toEqual([]);
  });

  it("boundary flows: the machine-side perspective is generated", () => {
    const onBoundary = threats.filter((t) => boundaryFlows.has(t.dataFlow?.connectionId ?? ""));
    expect(onBoundary.length).toBeGreaterThan(0);
    for (const t of onBoundary) expect(excluded.has(victimOf(t) ?? "")).toBe(false);
  });

  it("no interface threat of the component", () => {
    expect(threats.filter((t) => !t.dataFlow && excluded.has(t.linkedElement?.elementId ?? ""))).toEqual([]);
  });

  it("without the exclusion there would be component-side threats (the test bites)", () => {
    const unexcluded = allThreats(interactionThreatGenerator.generateThreatsForProject(project(false), ctx, iconfig));
    expect(unexcluded.some((t) => t.dataFlow && excluded.has(victimOf(t) ?? ""))).toBe(true);
  });

  it("the sync reports no missing flow inside the component and no missing component interface", () => {
    const status = interactionThreatSync.checkSyncStatus(project(true), tables) as unknown as {
      missingInThreats?: { connections?: { id: string }[]; interfaces?: { id: string }[] };
      missingConnections?: { id: string }[];
    };
    const missing = JSON.stringify(status);
    const inside = [...excluded].filter((id) => !boundaryFlows.has(id));
    for (const id of inside) expect(missing.includes(`"${id}"`), id).toBe(false);
  });

  // Review 2026-11-07: the sync checks the graph's connection.from / to, the
  // generator the data flow's fromElementId / toElementId. On the parent page
  // a boundary flow ends on the multiprocess; both must see the stitched
  // (inner) end, or the drift badge reports a "missing" boundary flow.
  it("boundary flows: sync and generator see the same stitched ends — none reported missing", () => {
    expect(boundaryFlows.size).toBeGreaterThan(0);
    const flows = new Map([...ctx.getDataFlows()].map((df) => [df.connectionId, df]));
    for (const id of boundaryFlows) {
      const conn = graph.connectionsById.get(id)!;
      const df = flows.get(id)!;
      // I2 (EE → boundary element): not a data flow for either side
      if (!df) continue;
      expect(conn, id).toBeDefined();
      expect([conn.from, conn.to], id).toEqual([df.fromElementId, df.toElementId]);
      // stitched: the component end is the inner element, not the multiprocess
      expect([conn.from, conn.to].includes(applied.instance.multiprocessTfId), id).toBe(false);
    }
    const status = interactionThreatSync.checkSyncStatus(project(true), tables);
    const missing = JSON.stringify(status);
    for (const id of boundaryFlows) expect(missing.includes(`"${id}"`), id).toBe(false);
    expect(status.inSync, missing.slice(0, 300)).toBe(true);
  });
});
