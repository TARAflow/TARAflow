// src/tests/examples/pump-station-example.test.ts
//
// Checks what the Pump Station Controller example promises (IEC 62443-4-2,
// CRA edition; iec-62443-4-2-cra-coverage.md IEC-10), through the real
// services. With WRITE_EXAMPLES=<dir> it also writes the project file:
//
//   WRITE_EXAMPLES=. npx vitest run src/tests/examples/pump-station-example.test.ts

import { beforeAll, describe, expect, it } from "vitest";
import { initI18nNode } from "../../../taraflow-reporter/cli/i18n-node";
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
import { dfdValidator } from "features/dfd/services/dfd-validator";
import { buildThreatGoalLinks } from "app/utils/build-threat-goal-links";
import { commitLoadedPhaseStatus } from "app/services/phase-status-commit";
import { getProgressPhaseIds } from "app/models/phase-types";
import { collectAssetFindings } from "features/assets/services/asset-validator";
import type { AssetData } from "features/assets/models/asset-types";
import { riskService } from "features/risks/services/risk-service";
import type { RiskData } from "features/risks/models/risk-assessment-types";
import { buildPumpStationProject, type ProjectJson } from "./pump-station-example";

// The texts of threats, mitigations and verifications come from the catalog's
// translations — loaded first, as in the app, so the written example has them.
let raw: ProjectJson;
let project: Project;
beforeAll(async () => {
  await initI18nNode("en");
  raw = buildPumpStationProject();
  project = parseAndRepair(JSON.parse(JSON.stringify(raw))) as Project;
});
const byDisplay = (id: string) =>
  [...raw.dfd.elements, ...raw.dfd.connections].find((x: ProjectJson) => x.displayId === id)!;

describe("Pump Station Controller example", () => {
  it("is a current project the migration leaves as it is", () => {
    expect(project).not.toBeNull();
    expect(project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(project.info.tags.regulation).toEqual(["EN IEC 62443 (CRA)", "CRA"]);
    expect(project.compliance?.families?.["iec-62443-4-2"]?.target).toEqual({ IAC: 2, UC: 2, SI: 2, DC: 2, RDF: 2, TRE: 2, RA: 2 });
    // Not safety-relevant: no hazard analysis, no safety criterion, no safety risk factor.
    expect(project.info.safetyRelevant).toBe(false);
    expect(project.assets!.configuration.impactCriteria.some((c) => c.id === "safety")).toBe(false);
    expect(project.risks!.configuration.activeFactors.find((f) => f.factorId === "safety")?.enabled ?? false).toBe(false);
  });

  it("the parser reads the diagram: 18 elements, 14 flows, interfaces on the cabinet border", () => {
    expect(raw.dfd.elements).toHaveLength(18);
    expect(raw.dfd.connections).toHaveLength(14);
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
    expect(interfacesOf("DF-14")).toEqual(["IF-5"]); // debug probe on the JTAG (path B)
  });

  it("the app's own checks find nothing to complete: DFD, assets, risks", () => {
    const graph = resolveDfdGraph(project.dfd as ProjectJson)!;
    const dfd = project.dfd as ProjectJson;
    const v = dfdValidator.validate(dfd.elements, dfd.connections, dfd.assets, dfd.stats, graph);
    expect([...v.errors, ...v.warnings]).toEqual([]);
    expect(collectAssetFindings(project.assets as AssetData)).toEqual([]);
    const rv = riskService.validate(project.risks as RiskData);
    expect([...rv.errors, ...rv.warnings]).toEqual([]);
    const threats = [...raw.threats.perElementTables, ...raw.threats.perInteractionTables].flatMap((t: ProjectJson) => t.threats);
    expect(threats.every((t: ProjectJson) => t.relevance === "relevant")).toBe(true);
  });

  it("asset-to-asset relations: what the pump control and its functions need, use and are configured by", () => {
    const name = (id: string) => project.assets!.assets.find((a) => a.id === id)!.displayId;
    const relations = (project.assets!.relations ?? []).map((r) => `${name(r.sourceAssetId)} ${r.relationType} ${name(r.targetAssetId)}`);
    expect(relations.sort()).toEqual(
      [
        "DA-001 derives_from DA-004",
        "DA-001 required_by PR-001",
        "DA-002 consumed_by PR-001",
        "DA-003 required_by PR-001",
        "DA-004 configures PR-001",
        "DA-005 configures PR-001",
        "PR-001 implements FU-001",
        "DA-001 required_by FU-001",
        "DA-004 configures FU-001",
        "DA-002 required_by FU-002",
        "DA-003 required_by FU-003",
        "DA-005 required_by FU-003",
      ].sort(),
    );
  });

  it("function assets on the DFD and in the system definition", () => {
    const fn = (id: string) => project.assets!.assets.find((a) => a.displayId === id)!;
    const links = (id: string) => fn(id).linkedDFDElements.map((l) => `${l.displayId ?? l.elementId} ${l.relationType}`).sort();
    expect(links("FU-001")).toEqual(["MP-1 implements"]);
    expect(links("FU-002")).toEqual(["MP-1 executes", "P-1 implements"]);
    expect(links("FU-003")).toEqual(["MP-1 implements"]);
    const functions = project.itemDefinition!.functions;
    const displayOf = (assetId: string | undefined) => project.assets!.assets.find((a) => a.id === assetId)?.displayId;
    expect(functions.filter((f) => f.functionAssetId).map((f) => displayOf(f.functionAssetId))).toEqual(["FU-001", "FU-002", "FU-003"]);
  });

  it("the Assets tab's threat / goal check finds nothing: every threat violates an active goal of its assets", () => {
    const links = buildThreatGoalLinks({
      threats: project.threats,
      assets: project.assets!.assets,
      dfdElements: (project.dfd as ProjectJson).elements,
      attackTrees: project.attackTrees,
      disabledStrideMethods: [],
    });
    expect(collectAssetFindings(project.assets as AssetData, links)).toEqual([]);
  });

  it("the Overview shows 100 %: every progress phase complete by the app's rules", () => {
    const loaded = commitLoadedPhaseStatus(project);
    const phases = getProgressPhaseIds(!!loaded.info.safetyRelevant, false);
    expect(phases.map((id) => [id, loaded.phaseStatus[id as keyof typeof loaded.phaseStatus]])).toEqual(phases.map((id) => [id, "complete"]));
  });

  it("threats, mitigations and verifications carry their catalog texts", () => {
    const threats = [...raw.threats.perElementTables, ...raw.threats.perInteractionTables].flatMap((t: ProjectJson) => t.threats);
    for (const t of threats) {
      expect(t.threatDescription, t.displayId).toBeTruthy();
      expect(t.attackDescription, t.displayId).toBeTruthy();
    }
    for (const r of raw.risks.risks) {
      for (const m of r.proposedMitigations ?? []) expect(m.text, `${r.threatDisplayId} ${m.id}`).toBeTruthy();
      for (const v of r.proposedVerifications ?? []) expect(v.text, `${r.threatDisplayId} ${v.id}`).toBeTruthy();
    }
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
    // CR 1.1 RE(1), CR 1.7, CR 1.7 RE(2) from the model fields (CM-5a); CR 7.6
    // from the model, CR 7.6 RE(1) (SL 3, above the target) now a gap: the
    // settings are readable on the HMI, not as a machine-readable report (CM-6).
    expect(count(achieved.rows)).toEqual({ met: 56, gap: 13, "n/a": 21, "needs-statement": 7 });
    expect(count(planned.rows)).toEqual({ met: 59, gap: 10, "n/a": 21, "needs-statement": 7 });

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
    expect([...achieved.rows.find((r) => r.label === "CR 3.1")!.failing].sort()).toEqual(["df-10", "df-11", "df-14", "df-7", "df-9"]);

    // D-29: a mitigation covers only the elements of its risks — MFA chosen
    // elsewhere does not close the human access flows DF-1 and DF-9.
    const plannedRow = (label: string) => planned.rows.find((r) => r.label === label)!;
    expect(plannedRow("CR 1.1 RE(2)").status).toBe("gap");
    expect([...plannedRow("CR 1.1 RE(2)").failing].sort()).toEqual(["df-1", "df-9"]);

    // planned never loses a met row
    for (const row of achieved.rows.filter((r) => r.status === "met")) expect(status(planned.rows, row.label)).toBe("met");
  });

  it("switched to the classic edition the statements still hold — only the graph is evaluated anew (D-31)", () => {
    const classic = {
      ...project,
      info: { ...project.info, tags: { ...project.info.tags, regulation: ["IEC 62443", "CRA"] } },
    } as Project;
    const { achieved, planned } = evaluateProjectCompliance(classic)!;
    const row = (label: string) => achieved.rows.find((r) => r.label === label)!;
    expect(row("CR 1.10")).toMatchObject({ status: "met", source: "statement" }); // made with the CRA edition
    // CR 1.5 from the model: F-3 / F-3b answer the whole checklist (CM-5b).
    expect(row("CR 1.5")).toMatchObject({ status: "met", source: "model", checklist: [] });
    // CR 7.6 from secureByDefault / securityConfigReporting in the classic edition too (CM-6).
    expect(row("CR 7.6")).toMatchObject({ status: "met", source: "model" });
    // From the model fields in both editions; 2019 RE(1) / RE(2) as well.
    for (const label of ["CR 1.1 RE(1)", "CR 1.7", "CR 1.7 RE(1)", "CR 1.7 RE(2)"]) {
      expect(row(label), label).toMatchObject({ status: "met", source: "model" });
    }
    expect(row("EDR 2.4").status).toBe("n/a"); // device row of the confirmed category, "no mobile code"
    expect(row("CR 7.8").status).toBe("needs-statement");
    // The CRA edition's picture, the graph's gaps included; RDF reaches 4 —
    // the boundary rows CR 5.2 RE(2)/(3) are NDR rows there, n/a for an EDR.
    expect(achieved.component).toEqual({ IAC: 1, UC: 2, SI: 0, DC: 0, RDF: 4, TRE: 4, RA: 1 });
    expect(planned.component).toEqual({ IAC: 1, UC: 2, SI: 1, DC: 4, RDF: 4, TRE: 4, RA: 1 });
  });

  it.runIf(!!process.env.WRITE_EXAMPLES)("writes the example", () => {
    const dir = process.env.WRITE_EXAMPLES!;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "Pump_Station_Controller-IEC62443-CRA.tara.json"), JSON.stringify(raw, null, 2) + "\n");
  });
});
