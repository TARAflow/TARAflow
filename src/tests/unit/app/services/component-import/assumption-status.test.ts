// src/tests/unit/app/services/component-import/assumption-status.test.ts
//
// Multi-project TARA, phase 3b (design §7.6, I7 (2)/(6)): the component's
// assumptions of use per instance — status with evidence and the mandatory
// rationale for "not applicable"; findings (open, violated, fulfilled by a
// machine measure not implemented yet); the audit diff; copying ratings.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { componentFindings } from "app/services/component-import/component-findings";
import { copyInstanceRatings } from "app/services/component-import/copy-ratings";
import {
  assumptionGaps,
  instanceAssumptions,
  machineMeasureOptions,
  withAssumptionStatus,
} from "app/services/component-import/assumption-status";
import { DiffService } from "features/audit/services/diff-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const component = (() => {
  const p = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
  p.itemDefinition = {
    sections: {},
    functions: [],
    assumptions: [
      { id: "a1", displayId: "ASM-01", text: "The sensor bus runs inside the cabinet", status: "confirmed", owner: "platform" },
      { id: "a2", displayId: "ASM-02", text: "The controller authenticates calibration commands", status: "open" },
    ],
  } as never;
  return p;
})();
const snapshot = buildComponentSnapshot(component);

function machine(): Project {
  let ctx = {
    xml: mxfile(page("top", "Panel", node("m_plc", "externalentity", "PLC", "EE-1", 10) + node("m_p1", "process", "Logic", "P-1", 300) + flow("m_df1", "x", "DF-1", "m_plc", "m_p1"))),
    pages: [],
    pageId: "top",
    assets: [],
    elements: [
      { id: "m_plc", displayId: "EE-1", name: "PLC", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
      { id: "m_p1", displayId: "P-1", name: "Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    ],
    connections: [{ id: "m_df1", displayId: "DF-1", name: "x", from: "m_plc", to: "m_p1", properties: {} }],
  } as never as Parameters<typeof applyComponentImport>[0]["context"];
  let components: Project["components"] | undefined;
  for (const [id, prefix] of [["s", "SD1"], ["t", "SD2"]] as const) {
    const a = applyComponentImport({
      context: ctx,
      machine: { components },
      result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component), source: { commitSha: "a", schemaVersion: 14 } },
      choice: { prefix, name: "SD", eeMapping: { "EE-1": "m_plc" } },
      ids: { importId: "imp", instanceId: id },
      importedAt: "t",
    });
    components = a.components;
    ctx = { ...ctx, xml: a.outcome.xml, pages: a.outcome.pages, elements: a.outcome.elements, connections: a.outcome.connections };
  }
  return {
    components,
    dfd: { elements: ctx.elements, connections: ctx.connections },
    risks: {
      configuration: DEFAULT_CONFIGURATION,
      risks: [{ id: "R-own", threatId: "own", selectedMitigations: [{ id: "M-C-001", status: "open" }, { id: "M-T-001", status: "implemented" }] }],
    },
    threats: { configuration: { customMitigations: [{ id: "M-C-001", text: "Locked cabinet" }] } },
  } as unknown as Project;
}

const inst = (p: Project, id: string) => p.components!.instances.find((i) => i.id === id)!;
const imp = (p: Project) => p.components!.imports[0];
const keys = (p: Project) => {
  const f = componentFindings(p);
  return { errors: f.errors.map((x) => x.key.split(".").pop()), warnings: f.warnings.map((x) => x.key.split(".").pop()) };
};
const set = (p: Project, instanceId: string, assumptionId: string, decision: Parameters<typeof withAssumptionStatus>[3]) =>
  ({ ...p, components: withAssumptionStatus(p.components!, instanceId, assumptionId, decision) }) as Project;

describe("assumptions of use per instance (phase 3b)", () => {
  it("the component's assumptions, open in every instance, with the component's own status beside", () => {
    const m = machine();
    const list = instanceAssumptions(inst(m, "s"), imp(m));
    expect(list.map((a) => [a.displayId, a.status, a.componentStatus])).toEqual([
      ["ASM-01", "open", "confirmed"],
      ["ASM-02", "open", "open"],
    ]);
    expect(snapshot.assumptions[0]).not.toHaveProperty("owner");
  });

  it("set, with evidence; not applicable needs a rationale; open without anything removes the entry", () => {
    let m = machine();
    m = set(m, "s", "a1", { status: "fulfilled", evidence: { mitigationIds: ["M-T-001"], note: " cabinet  " } });
    expect(inst(m, "s").assumptions).toEqual([{ instanceId: "s", assumptionId: "a1", status: "fulfilled", evidence: { mitigationIds: ["M-T-001"], note: "cabinet" } }]);
    expect(() => set(m, "s", "a2", { status: "not_applicable" })).toThrow(/rationale/);
    m = set(m, "s", "a2", { status: "not_applicable", rationale: "No calibration in this machine" });
    expect(instanceAssumptions(inst(m, "s"), imp(m)).find((a) => a.assumptionId === "a2")).toMatchObject({ status: "not_applicable", rationale: "No calibration in this machine" });
    m = set(m, "s", "a1", { status: "open" });
    expect(inst(m, "s").assumptions.map((a) => a.assumptionId)).toEqual(["a2"]);
    // the other instance is untouched
    expect(inst(m, "t").assumptions).toEqual([]);
  });

  it("findings: open (warning), not fulfilled (error), fulfilled by a measure not implemented yet", () => {
    let m = machine();
    expect(keys(m).warnings).toContain("CMP_AOU_OPEN");
    m = set(m, "s", "a1", { status: "not_fulfilled" });
    expect(keys(m).errors).toContain("CMP_AOU_VIOLATED");
    m = set(m, "s", "a1", { status: "fulfilled", evidence: { mitigationIds: ["M-C-001"] } });
    expect(assumptionGaps(inst(m, "s"), imp(m), m.risks!.risks).metByPending.map((x) => x.mitigationIds)).toEqual([["M-C-001"]]);
    expect(keys(m).warnings).toContain("CMP_AOU_MET_BY_PENDING");
    // backed by an implemented measure: no such finding
    m = set(m, "s", "a1", { status: "fulfilled", evidence: { mitigationIds: ["M-T-001"] } });
    expect(assumptionGaps(inst(m, "s"), imp(m), m.risks!.risks).metByPending).toEqual([]);
  });

  it("evidence options: the machine's project mitigations and the measures its risks chose", () => {
    const ids = machineMeasureOptions(machine()).map((o) => o.id);
    expect(ids).toEqual(["M-C-001", "M-T-001"]);
    expect(machineMeasureOptions(machine())[0].label).toBe("M-C-001 Locked cabinet");
  });

  it("the audit diff sees an assumption status (commit gate)", () => {
    const m = machine();
    const changed = set(m, "s", "a1", { status: "fulfilled" });
    const strip = (p: Project) => ({ ...p, dfd: null, assets: null, threats: null, risks: null, attackTrees: null }) as never;
    const section = new DiffService().detectChanges(strip(changed), strip(m)).find((c) => c.phase === "components")!;
    expect(section.changes[0].details!.map((d) => d.field)).toContain("assumptions");
  });

  it("copying ratings takes the assumption status as a decision; fill keeps the target's own", () => {
    let m = machine();
    m = set(m, "s", "a1", { status: "fulfilled", evidence: { note: "cabinet" } });
    m = set(m, "s", "a2", { status: "not_applicable", rationale: "no calibration" });
    m = set(m, "t", "a2", { status: "not_fulfilled" });
    const fill = copyInstanceRatings(m, "s", "t", { decisions: true, assetImpact: false, mode: "fill" });
    const t1 = fill.components.instances.find((i) => i.id === "t")!.assumptions;
    expect(t1.find((a) => a.assumptionId === "a1")).toMatchObject({ instanceId: "t", status: "fulfilled", evidence: { note: "cabinet" } });
    expect(t1.find((a) => a.assumptionId === "a2")!.status).toBe("not_fulfilled");
    expect(fill.counts.assumptions).toBe(1);
    const over = copyInstanceRatings(m, "s", "t", { decisions: true, assetImpact: false, mode: "overwrite" });
    expect(over.components.instances.find((i) => i.id === "t")!.assumptions.find((a) => a.assumptionId === "a2")).toMatchObject({ status: "not_applicable", rationale: "no calibration" });
  });
});
