// src/tests/unit/app/utils/component-treatments.test.ts
//
// Multi-project TARA, phase 3a (design §7.4): how the component treated its
// risks, per instance, read-only — measures with their status (pending →
// CMP_MEASURE_PENDING), handed-over / accepted risks arrive untreated with
// the component's claims as the reason (CMP_HANDOVER_OPEN until the machine
// sets its own treatment; a justification alone does not decide).

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { componentFindings } from "app/services/component-import/component-findings";
import { componentThreatReferences } from "app/utils/component-threats";
import { componentTreatments, machineDecided, measureState } from "app/utils/component-treatments";
import { extractThreatReferences } from "app/utils/extract-threat-references";
import { componentInstanceTfId } from "features/dfd";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { flow, mxfile, node, page } from "../../../fixtures/leveled-dfd-xml";

// The component: two relevant threats, one reduced with two measures, one shared with a claim.
const component = (() => {
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
  p.cybersecurityConcept = {
    goals: [],
    claims: [{ id: "c1", displayId: "CLM-01", statement: "The integrator isolates the sensor bus", kind: "share", riskIds: [share.id], assumptionIds: [], responsibleParty: "Integrator" }],
  } as never;
  return { project: p, reduceThreat: picked[0].id, shareThreat: picked[1].id };
})();
const snapshot = buildComponentSnapshot(component.project);

function machine(): Project {
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
  const base = { components: a.components, dfd: { elements: a.outcome.elements, connections: a.outcome.connections }, assets: null } as unknown as Project;
  const refs = componentThreatReferences({ ...base, risks: null } as never, "per-element");
  const risks = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: "" } as never, refs).riskData;
  return { ...base, risks } as Project;
}
const tid = (threat: string) => componentInstanceTfId("i1", `threat|${threat}`);

describe("component treatments (phase 3a)", () => {
  const m = machine();
  const map = componentTreatments(m);

  it("reduce: the component's measures with their status; its own project mitigation named from the snapshot", () => {
    const tr = map.get(tid(component.reduceThreat))!;
    expect(tr).toMatchObject({ instanceLabel: "SD1 · Smoke Detector", treatment: "reduce", handedOver: false });
    expect(tr.measures.map((x) => [x.id, x.state])).toEqual([["M-S-001", "implemented"], ["M-C-001", "pending"]]);
    expect(tr.measures.find((x) => x.id === "M-C-001")!.text).toBe("Signed sensor frames");
  });

  it("share: handed over, with the component's claim as the reason", () => {
    const tr = map.get(tid(component.shareThreat))!;
    expect(tr).toMatchObject({ treatment: "share", handedOver: true, justification: "The integrator controls the bus" });
    expect(tr.claims).toEqual([{ displayId: "CLM-01", kind: "share", statement: "The integrator isolates the sensor bus", responsibleParty: "Integrator" }]);
  });

  it("measure states: implemented / verified count, rejected apart, the rest pending", () => {
    expect(["implemented", "verified"].map(measureState)).toEqual(["implemented", "implemented"]);
    expect(measureState("rejected")).toBe("rejected");
    expect(["open", "in_progress", "in_review"].map(measureState)).toEqual(["pending", "pending", "pending"]);
  });

  it("decided: an own measure, or an own treatment other than reduce with a justification — not a justification alone", () => {
    expect(machineDecided({ treatment: "reduce", treatmentJustification: "", selectedMitigations: [] })).toBe(false);
    expect(machineDecided({ treatment: "reduce", treatmentJustification: "We think about it", selectedMitigations: [] })).toBe(false);
    expect(machineDecided({ treatment: "accept", treatmentJustification: "", selectedMitigations: [] })).toBe(false);
    expect(machineDecided({ treatment: "accept", treatmentJustification: "Bus inside the locked cabinet", selectedMitigations: [] })).toBe(true);
    expect(machineDecided({ treatment: "reduce", treatmentJustification: "", selectedMitigations: [{ id: "M-T-001", status: "open" }] as never })).toBe(true);
  });

  it("findings: CMP_MEASURE_PENDING and CMP_HANDOVER_OPEN per instance; the handover closes with the machine's treatment", () => {
    const keys = (p: Project) => componentFindings(p).warnings.map((w) => w.key.split(".").pop());
    expect(m.risks!.risks.some((r) => r.threatId === tid(component.reduceThreat))).toBe(true);
    expect(keys(m)).toContain("CMP_MEASURE_PENDING");
    expect(keys(m)).toContain("CMP_HANDOVER_OPEN");
    const decided = {
      ...m,
      risks: {
        ...m.risks!,
        risks: m.risks!.risks.map((r) => (r.threatId === tid(component.shareThreat) ? { ...r, treatment: "accept", treatmentJustification: "Bus inside the locked cabinet" } : r)),
      },
    } as Project;
    expect(keys(decided)).not.toContain("CMP_HANDOVER_OPEN");
  });
});
