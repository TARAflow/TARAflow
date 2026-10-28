// Leveled DFD: the validator checks every drawn flow, excluded ones included
// (EE → EE, excludeFromThreatGen, abstract with a valid refinement), with the
// endpoints of the effective model — as on a single-page DFD. Graph and
// threat generation keep leaving the excluded flows out. Before, the
// validator got only the graph's flows: an EE connected only to another EE
// was reported as unconnected, and excluded flows were not checked at all.
import { describe, it, expect } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import { buildAnalysisView } from "features/dfd/services/build-dfd-graph";
import type { DFDProjectData } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  flow,
  mxfile,
  node,
  page,
} from "../fixtures/leveled-dfd-xml";

// System page + two external entities talking to each other (EE → EE), and a
// flow to a process that is excluded from threat generation without a
// rationale.
const SYSTEM_WITH_EXCLUDED = page(
  "sys",
  "System",
  node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
    flow("df7", "stream sensor data", "DF-7", "mp1", "mp2") +
    node("ee1", "externalentity", "Operator", "EE-1", 600) +
    node("ee2", "externalentity", "Fire Brigade", "EE-2", 900) +
    node("p9", "process", "Log Events", "P-9", 1200) +
    flow("df9", "call", "DF-9", "ee1", "ee2") +
    flow("df10", "configure", "DF-10", "ee1", "p9"),
);

const xml = mxfile(SYSTEM_WITH_EXCLUDED, SENSOR, CONTROLLER);
const singleXml = mxfile(SYSTEM_WITH_EXCLUDED);

const storedConnections = [
  { id: "df10", properties: { excludeFromThreatGen: true } },
];

const project = (dfdXml: string, pages?: unknown): DFDProjectData =>
  ({
    id: `proj-${Math.random().toString(36).slice(2)}`,
    name: "Leveled",
    dfd: {
      xml: dfdXml,
      elements: [],
      connections: storedConnections,
      assets: [],
      ...(pages ? { pages } : {}),
    },
    phaseStatus: {},
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: "",
  }) as unknown as DFDProjectData;

const keysFor = (findings: { key: string; elementId?: string; params?: unknown }[] = [], id: string) =>
  findings
    .filter((f) => f.elementId === id || JSON.stringify(f.params ?? {}).includes(`"${id}"`))
    .map((f) => f.key)
    .sort();

describe("leveled DFD: the validator sees the excluded flows", () => {
  const leveled = dfdService.saveDFDFromXml(project(xml, LEVELED_PAGES), xml).validation;
  const single = dfdService.saveDFDFromXml(project(singleXml), singleXml).validation;

  it("an EE connected only to another EE is not 'unconnected'", () => {
    const unconnected = [...(leveled.warnings ?? [])].filter((f) => /unconnected|noConnections|no_connections/i.test(f.key));
    expect(unconnected.map((f) => (f as { elementId?: string }).elementId)).not.toContain("ee2");
  });

  it("excluded flows get the same flow findings as on a single page", () => {
    for (const id of ["df9", "df10"]) {
      expect(keysFor(leveled.warnings, id), id).toEqual(keysFor(single.warnings, id));
      expect(keysFor(leveled.errors, id), id).toEqual(keysFor(single.errors, id));
    }
  });

  it("excludeFromThreatGen without a rationale warns on a multi-page DFD too", () => {
    expect(keysFor(leveled.warnings, "df10")).toContain("tabs.dfd.validation.df.prop.excludeMissingRationale");
  });

  it("the graph still leaves the excluded flows out", () => {
    const view = buildAnalysisView({
      xml,
      pages: LEVELED_PAGES,
      elements: [],
      connections: storedConnections as never,
      assets: [],
    } as never);
    expect(view.validationConnections.map((c) => c.id)).toEqual(expect.arrayContaining(["df9", "df10"]));
    expect(view.connections.map((c) => c.id)).not.toContain("df9");
    expect(view.connections.map((c) => c.id)).not.toContain("df10");
  });
});
