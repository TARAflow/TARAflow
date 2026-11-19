// src/tests/fixtures/component-treatment-machine.ts
//
// A component (Smoke Detector: two relevant threats, one reduced with
// M-S-001 implemented + M-C-001 in progress relying on ASM-01, one shared
// with a claim) imported once as instance "i1" (prefix SD1) into a small
// machine whose risks are synced from the instance's threats. Shared by the
// component-treatment tests (phase 3a–3d) and the app/CLI report comparison.

import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "./load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { componentThreatReferences } from "app/utils/component-threats";
import { extractThreatReferences } from "app/utils/extract-threat-references";
import { componentInstanceTfId } from "features/dfd";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { flow, mxfile, node, page } from "./leveled-dfd-xml";

// The component: two relevant threats, one reduced with two measures, one shared with a claim.
export const component = (() => {
  const p = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
  const picked = p.threats!.perElementTables.flatMap((t) => t.threats).filter((t) => t.linkedElement?.elementType === "Process").slice(0, 2);
  for (const t of picked) t.relevance = "relevant";
  const refs = extractThreatReferences(p.threats, "per-element", p.assets?.assets, p.dfd?.elements as never).filter((r) => picked.some((t) => t.id === r.id));
  const risks = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: "" } as never, refs).riskData.risks;
  const [reduce, share] = [risks.find((r) => r.threatId === picked[0].id)!, risks.find((r) => r.threatId === picked[1].id)!];
  p.risks = {
    ...(p.risks ?? { configuration: DEFAULT_CONFIGURATION, lastModified: "" }),
    configuration: DEFAULT_CONFIGURATION,
    risks: [
      { ...reduce, treatment: "reduce", selectedMitigations: [{ id: "M-S-001", status: "implemented" }, { id: "M-C-001", status: "in_progress" }] },
      { ...share, treatment: "share", treatmentJustification: "The integrator controls the bus", selectedMitigations: [] },
    ],
  } as never;
  p.threats = { ...p.threats!, configuration: { ...p.threats!.configuration, customMitigations: [{ id: "M-C-001", text: "Signed sensor frames", isCustom: true, strideCategory: "T", context: "process", affectsProperties: [] }] } } as never;
  p.itemDefinition = {
    sections: {},
    functions: [],
    assumptions: [{ id: "a1", displayId: "ASM-01", text: "Frames are checked by the controller", status: "confirmed", mitigationIds: ["M-C-001", "M-X-404"] }],
  } as never;
  p.cybersecurityConcept = {
    goals: [],
    claims: [{ id: "c1", displayId: "CLM-01", statement: "The integrator isolates the sensor bus", kind: "share", riskIds: [share.id], assumptionIds: [], responsibleParty: "Integrator" }],
  } as never;
  return { project: p, reduceThreat: picked[0].id, shareThreat: picked[1].id };
})();
export const snapshot = buildComponentSnapshot(component.project);

export function machine(): Project {
  const ctx = {
    xml: mxfile(page("top", "Panel", node("m_plc", "externalentity", "PLC", "EE-1", 10) + node("m_p1", "process", "Logic", "P-1", 300) + flow("m_df1", "x", "DF-1", "m_plc", "m_p1"))),
    pages: [],
    pageId: "top",
    assets: [],
    elements: [
      { id: "m_plc", displayId: "EE-1", name: "PLC", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
      { id: "m_p1", displayId: "P-1", name: "Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    ],
    connections: [{ id: "m_df1", displayId: "DF-1", name: "x", from: "m_plc", to: "m_p1", properties: {} }],
  } as never;
  const a = applyComponentImport({
    context: ctx,
    machine: {},
    result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component.project), source: { commitSha: "a", schemaVersion: 14 } },
    choice: { prefix: "SD1", name: "SD", eeMapping: { "EE-1": "m_plc" } },
    ids: { importId: "imp", instanceId: "i1" },
    importedAt: "t",
  });
  const base = { components: a.components, dfd: { xml: a.outcome.xml, pages: a.outcome.pages, elements: a.outcome.elements, connections: a.outcome.connections }, assets: null } as unknown as Project;
  const refs = componentThreatReferences({ ...base, risks: null } as never, "per-element");
  const risks = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: "" } as never, refs).riskData;
  return { ...base, risks } as Project;
}
export const tid = (threat: string) => componentInstanceTfId("i1", `threat|${threat}`);
