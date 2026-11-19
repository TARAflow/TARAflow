// src/tests/unit/features/threats/services/per-element/ee-to-ee-flow.test.ts
//
// Manual test 2026-11-07: a flow between two external entities got
// per-element threats on a single-page DFD; once the DFD became leveled (a
// component import adds a child page) the effective model excluded the flow
// (DFD_EE_TO_EE_FLOW) and the sync removed its threats silently. Now the
// per-element generator leaves EE → EE flows out on every DFD — as the
// leveled model and per-interaction mode do — and the sync never reports
// them missing. The DFD explains it on a single page too: the info
// DFD_EE_TO_EE_FLOW that a leveled DFD gets from its effective model
// (review 2026-11-07).

import { describe, expect, it } from "vitest";
import dfdService from "features/dfd/services/dfd-service";
import type { DFDProjectData } from "features/dfd/models/dfd-types";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { elementThreatGenerator, isEeToEeFlow } from "features/threats/services/per-element/element-generator";
import { elementThreatSync } from "features/threats/services/per-element/element-sync";
import type { ThreatConfiguration, ThreatProjectData } from "features/threats/models/threat-types";
import { flow, mxfile, node, page } from "../../../../../fixtures/leveled-dfd-xml";

const xml = mxfile(
  page(
    "top",
    "Plant",
    `<object label="Cabinet" type="trustboundary" id="tb"><mxCell vertex="1" parent="1" style="rounded=0;dashed=1;"><mxGeometry x="250" y="0" width="300" height="200" as="geometry"/></mxCell></object>` +
      node("gw", "externalentity", "Gateway", "EE-1", 10) +
      node("srv", "externalentity", "Update Server", "EE-2", 700) +
      node("p1", "process", "Controller", "P-1", 300) +
      flow("ee_ee", "push firmware", "DF-1", "gw", "srv") +
      flow("ee_p", "command", "DF-2", "gw", "p1"),
  ),
);
const saved = dfdService.saveDFDFromXml(
  { id: "p", name: "Plant", phaseStatus: {}, dfd: { xml, elements: [], connections: [], assets: [] } } as unknown as DFDProjectData,
  xml,
);
const graph = toReferenceGraph(saved.dfd.graph!);
const config = { activeMethod: "per-element", forceClassicMode: false, zeroTrustMode: false } as unknown as ThreatConfiguration;
const project = { id: "p", name: "Plant", threats: null, phaseStatus: {}, dfdGraph: graph, lastModified: "" } as unknown as ThreatProjectData;
const tables = elementThreatGenerator.generateThreatsForProject(project, config);
const threats = tables.flatMap((t) => t.threats);
const onFlow = (id: string) => threats.filter((t) => t.dataFlow?.connectionId === id || t.linkedElement?.elementId === id);

describe("per element: EE → EE flows are out of scope on a single-page DFD too", () => {
  it("setup: single page, the EE → EE flow is in the graph", () => {
    expect(saved.success).toBe(true);
    expect(graph.connectionsById.has("ee_ee")).toBe(true);
    expect(isEeToEeFlow(graph.connectionsById.get("ee_ee")!, graph)).toBe(true);
    expect(isEeToEeFlow(graph.connectionsById.get("ee_p")!, graph)).toBe(false);
  });

  it("no threat on the EE → EE flow; the EE → process flow keeps its threats", () => {
    expect(onFlow("ee_ee")).toEqual([]);
    expect(onFlow("ee_p").length).toBeGreaterThan(0);
  });

  it("the sync does not report the EE → EE flow missing", () => {
    const status = elementThreatSync.checkSyncStatus({ ...project, threats: { configuration: config, perElementTables: tables, perInteractionTables: [], lastModified: "" } } as never, tables);
    expect(status.missingInThreats.dataFlows.map((c) => c.id)).not.toContain("ee_ee");
    expect(status.inSync).toBe(true);
  });

  it("the single-page DFD explains it: DFD_EE_TO_EE_FLOW (info) on the EE → EE flow only", () => {
    const infos = (saved.validation.infos ?? []).filter((f) => f.key === "dfdValidation.leveled.DFD_EE_TO_EE_FLOW");
    expect(infos.map((f) => f.elementId)).toEqual(["ee_ee"]);
    expect(infos[0].params).toEqual({ flow: "DF-1 push firmware" });
  });

  it("a leveled DFD keeps the effective model's finding — once, not twice", () => {
    const leveledXml = xml.replace("</mxfile>", page("child", "Detail", node("c1", "process", "Inner", "P-9", 10)) + "</mxfile>");
    const leveled = dfdService.saveDFDFromXml(
      { id: "p", name: "Plant", phaseStatus: {}, dfd: { xml: leveledXml, elements: [], connections: [], assets: [], pages: [{ pageId: "top", name: "Plant", order: 0 }, { pageId: "child", name: "Detail", order: 1 }] } } as unknown as DFDProjectData,
      leveledXml,
    );
    const all = [...leveled.validation.errors, ...leveled.validation.warnings, ...(leveled.validation.infos ?? [])];
    expect(all.filter((f) => f.key === "dfdValidation.leveled.DFD_EE_TO_EE_FLOW" && f.elementId === "ee_ee")).toHaveLength(1);
  });
});
