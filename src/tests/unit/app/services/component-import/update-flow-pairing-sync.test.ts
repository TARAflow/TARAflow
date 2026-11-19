// Multi-project TARA phase 5c (review of patch 60): does a machine threat
// moved to a PAIRED boundary flow survive the next regular threat sync? The
// sync recognises stored threats by their generator key (flow, STRIDE,
// direction) and reports a changed endpoint / boundary / template. Real
// machine, real import, real per-interaction generator and reconciliation:
// after the update the moved threat must be "unchanged" with its id — not
// obsolete with a new one generated beside it.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import type { ComponentSnapshot } from "app/models/component-snapshot-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { applyComponentUpdate } from "app/services/component-import/component-update";
import { componentExcludedIds } from "app/services/component-import/component-scope";
import dfdService from "features/dfd/services/dfd-service";
import { DFDGraphAnalysisContext } from "features/dfd/adapters/dfd-graph-analysis-context";
import { componentInstanceTfId } from "features/dfd";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { interactionThreatGenerator } from "features/threats/services/per-interaction/interaction-generator";
import { reconcileThreats } from "features/threats/services/threat-reconciliation";
import { interactionThreatNaturalKey } from "features/threats/services/threat-identity";
import type { ThreatConfiguration, ThreatProjectData } from "features/threats/models/threat-types";
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
  context: { xml: machineXml, pages: [], pageId: "top", assets: [], elements: machineElements, connections: [{ id: "m_df1", displayId: "DF-1", name: "report alarm", from: "m_plc", to: "m_p1", properties: {} }] as never },
  machine: {},
  result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component), source: { commitSha: "a", schemaVersion: 14 } },
  choice: { prefix: "SD1", name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" } },
  ids: { importId: "imp", instanceId: "inst-1" },
  importedAt: "t",
});
const iconfig = { activeMethod: "per-interaction", forceClassicMode: false, zeroTrustMode: false } as unknown as ThreatConfiguration;

/** Save the DFD (graph) and generate the machine's per-interaction threats, as the app does. */
function generate(p: Pick<Project, "dfd" | "components">) {
  const saved = dfdService.saveDFDFromXml(
    { id: "machine", name: "Fire Panel", phaseStatus: {}, dfd: { ...p.dfd, assets: [] } } as unknown as DFDProjectData,
    p.dfd!.xml!,
  );
  const graph = saved.dfd.graph!;
  const threatProject = {
    id: "machine",
    name: "Fire Panel",
    threats: null,
    phaseStatus: {},
    dfdGraph: toReferenceGraph(graph),
    excludedElementIds: componentExcludedIds({ components: p.components }),
    lastModified: "",
  } as unknown as ThreatProjectData;
  return interactionThreatGenerator.generateThreatsForProject(threatProject, new DFDGraphAnalysisContext(graph), iconfig).flatMap((t) => t.threats);
}

describe("a machine threat on a paired boundary flow survives the regular sync (review of 60)", () => {
  const ees = new Set(snapshot.dfd!.elements.filter((e) => e.type === "ExternalEntity").map((e) => e.id));
  const boundary = snapshot.dfd!.connections.find((c) => ees.has(c.from) !== ees.has(c.to) && c.from !== c.to)!;
  const before: Project = {
    id: "machine",
    components: applied.components,
    dfd: { xml: applied.outcome.xml, pages: applied.outcome.pages, elements: applied.outcome.elements, connections: applied.outcome.connections },
  } as unknown as Project;
  const generated = generate(before);
  const onFlow = generated.filter((t) => t.dataFlow?.connectionId === componentInstanceTfId("inst-1", boundary.id));
  const machine = {
    ...before,
    threats: { perElementTables: [], perInteractionTables: [{ threats: generated }] },
    risks: { risks: onFlow.slice(0, 1).map((t) => ({ id: `R-${t.id}`, threatId: t.id, factorRatings: [], mitigatedFactorRatings: [], selectedMitigations: [{ id: "M-T-9", status: "planned", ticketId: "ABC-7" }] })) },
  } as unknown as Project;

  // the component renames the boundary flow — everywhere it names it (records, xml cells, page links)
  const renamed = "flow-renamed";
  const next = JSON.parse(JSON.stringify(snapshot).split(boundary.id).join(renamed)) as ComponentSnapshot;

  it("the boundary flow carries machine threats before the update (the test bites)", () => {
    expect(onFlow.length).toBeGreaterThan(0);
  });

  it("after the update with the pairing: the same ids, unchanged — nothing obsolete, nothing new on the flow; the risk stays", () => {
    const r = applyComponentUpdate({
      project: machine,
      importId: "imp",
      result: { snapshot: next, contentHash: snapshotContentHash(next), source: { commitSha: "b", schemaVersion: 14 }, methodology: null },
      pairing: { flows: { [boundary.id]: renamed } },
      updatedAt: "t2",
    });
    const stored = r.project.threats!.perInteractionTables.flatMap((t) => t.threats);
    const fresh = generate(r.project);
    const rec = reconcileThreats(stored, fresh, interactionThreatNaturalKey);
    const movedIds = new Set(onFlow.map((t) => t.id));
    expect(rec.obsolete.filter((x) => movedIds.has(x.threat.id))).toEqual([]);
    expect(rec.changed.filter((x) => movedIds.has(x.threat.id))).toEqual([]);
    expect(rec.unchanged.filter((x) => movedIds.has(x.threat.id)).length).toBe(onFlow.length);
    expect(rec.added.filter((x) => x.threat.dataFlow?.connectionId === componentInstanceTfId("inst-1", renamed))).toEqual([]);
    expect(r.project.risks!.risks.find((x) => x.threatId === onFlow[0].id)!.selectedMitigations).toEqual([{ id: "M-T-9", status: "planned", ticketId: "ABC-7" }]);
  });

  it("without the pairing they would be obsolete and new ones generated (the pairing is what saves them)", () => {
    const r = applyComponentUpdate({
      project: machine,
      importId: "imp",
      result: { snapshot: next, contentHash: snapshotContentHash(next), source: { commitSha: "b", schemaVersion: 14 }, methodology: null },
      updatedAt: "t2",
    });
    const stored = r.project.threats!.perInteractionTables.flatMap((t) => t.threats);
    expect(stored.some((t) => onFlow.some((o) => o.id === t.id))).toBe(false);
    const rec = reconcileThreats(stored, generate(r.project), interactionThreatNaturalKey);
    expect(rec.added.some((x) => x.threat.dataFlow?.connectionId === componentInstanceTfId("inst-1", renamed))).toBe(true);
  });
});
