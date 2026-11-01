// src/tests/examples/pump-station-example.test.ts
//
// Checks what the Pump Station Controller example promises (IEC 62443-4-2,
// CRA edition; iec-62443-4-2-cra-coverage.md IEC-10), through the real
// services. With WRITE_EXAMPLES=<dir> it also writes the project file:
//
//   WRITE_EXAMPLES=. npx vitest run src/tests/examples/pump-station-example.test.ts

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAndRepair } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { evaluateProjectCompliance } from "app/services/compliance-report";
import { resolveDfdGraph } from "app/utils/resolve-dfd-graph";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { getAllMitigations } from "features/threats";
import { DONE_MITIGATION_STATUSES } from "shared/models/control-instance";
import { meetsExpected, readControlValue } from "shared/utils/control-value-semantics";
import type { Project } from "app/models/project-types";
import { buildPumpStationProject, type ProjectJson } from "./pump-station-example";

const raw = buildPumpStationProject();
const project = parseAndRepair(JSON.parse(JSON.stringify(raw))) as Project;
const byDisplay = (id: string) =>
  [...raw.dfd.elements, ...raw.dfd.connections].find((x: ProjectJson) => x.displayId === id)!;

describe("Pump Station Controller example", () => {
  it("is a current project the migration leaves as it is", () => {
    expect(project).not.toBeNull();
    expect(project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(project.info.tags.regulation).toEqual(["EN IEC 62443 (CRA)", "CRA"]);
    expect(project.compliance?.target).toEqual({ IAC: 2, UC: 2, SI: 2, DC: 2, RDF: 2, TRE: 2, RA: 2 });
  });

  it("the parser reads the diagram: 17 elements, 13 flows, interfaces on the cabinet border", () => {
    expect(raw.dfd.elements).toHaveLength(17);
    expect(raw.dfd.connections).toHaveLength(13);
    const graph = resolveDfdGraph(raw.dfd)!;
    const interfacesOf = (flow: string) =>
      (graph.dataFlowAnalysis.get(byDisplay(flow).id)?.interfaceIds ?? []).map((id: string) => byDisplay2(id));
    const byDisplay2 = (id: string) => raw.dfd.elements.find((e: ProjectJson) => e.id === id)?.displayId;
    expect(interfacesOf("DF-1")).toEqual(["IF-1"]);
    for (const flow of ["DF-4", "DF-5", "DF-6", "DF-7", "DF-8"]) expect(interfacesOf(flow)).toEqual(["IF-3"]);
    expect(interfacesOf("DF-9")).toEqual(["IF-2"]);
    expect(interfacesOf("DF-10")).toEqual(["IF-4"]);
    expect(interfacesOf("DF-11")).toEqual(["IF-4"]);
    expect(interfacesOf("DF-2")).toEqual([]);
  });

  it("threats and risks come from the generators; every risk has a chosen mitigation", () => {
    const threats = [...raw.threats.perElementTables, ...raw.threats.perInteractionTables].flatMap((t: ProjectJson) => t.threats);
    expect(threats.length).toBeGreaterThan(100);
    expect(raw.risks.risks).toHaveLength(threats.length);
    for (const risk of raw.risks.risks) expect(risk.selectedMitigations.length).toBeGreaterThan(0);
  });

  it("a verified mitigation is visible in the model: no done mitigation with an unmet SHOULD value", () => {
    const properties = new Map(
      [...raw.dfd.elements, ...raw.dfd.connections].map((x: ProjectJson) => [x.id, x.properties ?? {}]),
    );
    const done = new Set<string>();
    for (const risk of raw.risks.risks) {
      for (const m of risk.selectedMitigations) if (DONE_MITIGATION_STATUSES.includes(m.status)) done.add(`${risk.id}::${m.id}`);
    }
    const unmetDone = deriveControlInstances(raw.threats, raw.risks, raw.dfd, getAllMitigations())
      .filter((c) => !meetsExpected(c.property, readControlValue(properties.get(c.elementId), c.property), c.expectedValue))
      .filter((c) => c.coversRiskIds.some((r) => c.coversMitigationIds.some((m) => done.has(`${r}::${m}`))));
    expect(unmetDone).toEqual([]);
  });

  it("the matrix shows every kind of row, and the planned run closes part of the gaps", () => {
    const { achieved, planned } = evaluateProjectCompliance(project)!;
    const count = (rows: { status: string }[]) =>
      rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
    expect(count(achieved.rows)).toEqual({ met: 55, gap: 12, "n/a": 21, "needs-statement": 9 });
    expect(count(planned.rows)).toEqual({ met: 58, gap: 9, "n/a": 21, "needs-statement": 9 });

    // SL-T 2: UC and RDF reach it; IAC stays at 1 even planned (no device
    // authentication on the fieldbus — a claim or a fix is needed); RA waits
    // for the open CR 7.8 statement; SI and DC improve with the planned fixes.
    expect(achieved.component).toEqual({ IAC: 1, UC: 2, SI: 0, DC: 0, RDF: 2, TRE: 4, RA: 1 });
    expect(planned.component).toEqual({ IAC: 1, UC: 2, SI: 1, DC: 4, RDF: 2, TRE: 4, RA: 1 });

    const status = (rows: typeof achieved.rows, label: string) => rows.find((r) => r.label === label)!.status;
    expect(status(achieved.rows, "CR 1.2")).toBe("gap");
    expect(status(achieved.rows, "CR 4.1")).toBe("gap");
    expect(status(planned.rows, "CR 4.1")).toBe("met");
    expect(status(achieved.rows, "CR 2.4")).toBe("n/a"); // statement: no mobile code
    expect(status(achieved.rows, "CR 3.13")).toBe("gap"); // statement: not met
    expect(status(achieved.rows, "CR 7.8")).toBe("needs-statement");
    expect(status(achieved.rows, "CR 3.10")).toBe("met"); // signed OTA update on the PLC
    // D-28: the key press on the touch panel (DF-1) and the internal flows
    // to the configuration store (DF-12/13) are no transmitted information.
    expect(achieved.rows.find((r) => r.label === "CR 3.1")!.failing).toEqual(["df-7", "df-9", "df-10", "df-11"]);

    // D-29: a mitigation covers only the elements of its risks — MFA chosen
    // elsewhere does not close the human access flows DF-1 and DF-9.
    const plannedRow = (label: string) => planned.rows.find((r) => r.label === label)!;
    expect(plannedRow("CR 1.1 RE(2)").status).toBe("gap");
    expect(plannedRow("CR 1.1 RE(2)").failing).toEqual(["df-1", "df-9"]);

    // planned never loses a met row
    for (const row of achieved.rows.filter((r) => r.status === "met")) expect(status(planned.rows, row.label)).toBe("met");
  });

  it.runIf(!!process.env.WRITE_EXAMPLES)("writes the example", () => {
    const dir = process.env.WRITE_EXAMPLES!;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "Pump_Station_Controller-IEC62443-CRA.tara.json"), JSON.stringify(raw, null, 2) + "\n");
  });
});
