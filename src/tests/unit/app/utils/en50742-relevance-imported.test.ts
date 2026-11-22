// src/tests/unit/app/utils/en50742-relevance-imported.test.ts
//
// Review 2026-11-22 (other instance): a machine of platform components — are
// the threats of an imported component judged by the EN 50742 relevance?
// They are: an imported threat points to the elements the import put into
// the machine (remapThreat → the instance's ids), and the machine's
// relevance map holds them. A component inside the safety zone, its
// counterpart (EE) outside: the threats on the boundary flows crossing the
// zone and on the component's interfaces they pass are relevant, the others
// not (rule sheet R2, "imported components").

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { componentThreatReferences } from "app/utils/component-threats";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { dfdRefResolver, threatRelevance } from "app/utils/en50742-relevance";
import dfdService from "features/dfd/services/dfd-service";
import type { DFDProjectData } from "features/dfd/models/dfd-types";
import { flow, mxfile, node, page } from "../../../fixtures/leveled-dfd-xml";

const component = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
const snapshot = buildComponentSnapshot(component);
// The cabinet is the safety zone; the fire panel controller (EE) stands outside it.
const machineXml = mxfile(
  page(
    "top",
    "Fire Panel",
    `<object label="Cabinet [CAB]" type="trustboundary" id="m_tb"><mxCell vertex="1" parent="1" style="rounded=0;dashed=1;"><mxGeometry x="0" y="0" width="1400" height="900" as="geometry"/></mxCell></object>` +
      node("m_plc", "externalentity", "Fire Panel Controller", "EE-1", 1600) +
      node("m_p1", "process", "Alarm Logic", "P-1", 300) +
      flow("m_df1", "report alarm", "DF-1", "m_plc", "m_p1"),
  ),
);
const machineElements = [
  { id: "m_tb", displayId: "CAB", name: "Cabinet [CAB]", type: "TrustBoundary", position: { x: 0, y: 0 }, size: { width: 1400, height: 900 }, properties: { safetyZone: "yes" } },
  { id: "m_plc", displayId: "EE-1", name: "Fire Panel Controller", type: "ExternalEntity", position: { x: 1600, y: 10 }, size: { width: 120, height: 60 }, properties: {} },
  { id: "m_p1", displayId: "P-1", name: "Alarm Logic", type: "Process", position: { x: 300, y: 10 }, size: { width: 120, height: 60 }, properties: {} },
] as never[];
const machineConnections = [{ id: "m_df1", displayId: "DF-1", name: "report alarm", from: "m_plc", to: "m_p1", properties: {} }] as never[];

const applied = applyComponentImport({
  context: { xml: machineXml, pages: [], pageId: "top", assets: [], elements: machineElements, connections: machineConnections } as never,
  machine: {},
  result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component), source: { commitSha: "a", schemaVersion: 14 } },
  choice: { prefix: "SD1", name: "Smoke Detector", eeMapping: { "EE-1": "m_plc" } },
  ids: { importId: "imp", instanceId: "inst-1" },
  importedAt: "t",
});
const saved = dfdService.saveDFDFromXml(
  {
    id: "m",
    name: "m",
    phaseStatus: {},
    dfd: { xml: machineXml, pages: applied.outcome.pages, elements: applied.outcome.elements, connections: applied.outcome.connections, assets: [] },
  } as unknown as DFDProjectData,
  applied.outcome.xml,
);
const project = {
  id: "m",
  info: { name: "m", tags: { domain: [], platform: [], regulation: ["EN 50742 A"], custom: [] } },
  dfd: saved.dfd,
  components: applied.components,
  assets: { assets: [], configuration: {} },
  threats: null,
  risks: null,
} as unknown as Project;
const relevance = prepareProjectCompliance(project)!.en50742Relevance();
const resolve = dfdRefResolver(project.dfd);
const items = new Map([...saved.dfd.elements, ...saved.dfd.connections].map((x) => [x.id, x]));

describe("EN 50742 relevance of an imported component's threats", () => {
  it("the zone holds the instance's boundary flows and the component interfaces they pass", () => {
    expect(relevance.mode).toBe("zone");
    const types = [...relevance.relevant.keys()].map((id) => (items.get(id) as { type?: string } | undefined)?.type ?? "DataFlow");
    expect(types).toContain("Interface");
    expect(types).toContain("DataFlow");
  });

  it.each(["per-element", "per-interaction"] as const)("%s: anchored on the instance's elements, relevant where they cross the zone, else not", (method) => {
    const refs = componentThreatReferences(project, method);
    expect(refs.length).toBeGreaterThan(0);
    const anchorOf = (r: (typeof refs)[number]) => r.dataFlow?.connectionId ?? r.linkedElement?.elementId ?? "";
    // every imported threat points to an element of the machine (the instance's)
    for (const r of refs) expect(items.has(anchorOf(r)), r.displayId).toBe(true);
    const relevant = refs.filter((r) => threatRelevance(r, relevance, resolve).relevant);
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant.length).toBeLessThan(refs.length);
    for (const r of relevant) expect(relevance.relevant.has(anchorOf(r)), r.displayId).toBe(true);
  });
});
