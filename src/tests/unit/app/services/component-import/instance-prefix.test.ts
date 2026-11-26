// src/tests/unit/app/services/component-import/instance-prefix.test.ts
//
// 0.20 manual test E3 (2026-11-26, user): the proposal "SDC1" for a component
// whose own instances are SDC1 / SDC2 gave "SDC1:SDC1:CASE"; and a prefix
// could not be changed after the import. Checked through a real import (the
// SmokeDetector into a small machine) and a real save.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport, candidateFrom } from "app/services/component-import/import-flow";
import { innerPrefixes, prefixProblem, renameInstancePrefix } from "app/services/component-import/instance-prefix";
import dfdService from "features/dfd/services/dfd-service";
import type { DFDProjectData } from "features/dfd/models/dfd-types";
import { flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const component = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
const snapshot = buildComponentSnapshot(component);
const machineXml = mxfile(
  page("top", "Fire Panel", node("m_plc", "externalentity", "Fire Panel Controller", "EE-1", 1600) + node("m_p1", "process", "Alarm Logic", "P-1", 300) + flow("m_df1", "report alarm", "DF-1", "m_plc", "m_p1")),
);
const machineElements = [
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
  { id: "m", name: "m", phaseStatus: {}, dfd: { xml: machineXml, pages: applied.outcome.pages, elements: applied.outcome.elements, connections: applied.outcome.connections, assets: [] } } as unknown as DFDProjectData,
  applied.outcome.xml,
);
const instance = applied.components.instances[0];
const firstThreatId = [...(snapshot.threats?.perElementTables ?? []), ...(snapshot.threats?.perInteractionTables ?? [])].flatMap((t) => t.threats)[0].id;
const machine = {
  id: "m",
  info: { name: "m", tags: { domain: [], platform: [], regulation: [], custom: [] } },
  dfd: saved.dfd,
  // a decision of the machine on the instance, to see that it stays
  components: {
    ...applied.components,
    instances: [{ ...instance, relevanceOverrides: [{ threatKey: firstThreatId, relevance: "not_relevant", rationale: "r", date: "d" }] }],
  },
  assets: { assets: applied.assets, relations: applied.relations, configuration: component.assets!.configuration, lastModified: "" },
  threats: null,
  risks: null,
} as unknown as Project;

const instanceIds = (p: Project) =>
  [...(p.dfd?.elements ?? []), ...(p.dfd?.connections ?? [])].filter((e) => /^cmp/.test(e.id)).map((e) => e.displayId ?? "");

describe("inner prefixes and the proposal", () => {
  it("the segments before the last of a prefixed display id, at every level", () => {
    expect(innerPrefixes({ dfd: { elements: [{ displayId: "SDC1:P-1" }, { displayId: "SDC1:SDC2:DF-3" }, { displayId: "P-2" }] } } as never)).toEqual(["SDC1", "SDC2"]);
  });

  it("the import proposes a prefix the component does not use inside", () => {
    const nested = { ...snapshot, component: { ...snapshot.component, name: "Smoke Detector Controller" }, dfd: { ...snapshot.dfd!, elements: [...snapshot.dfd!.elements, { id: "x", type: "Process", displayId: "SDC1:P-1" }, { id: "y", type: "Process", displayId: "SDC2:P-1" }] } };
    const c = candidateFrom({ snapshot: nested as never, source: { schemaVersion: 14 } as never, contentHash: "h" }, {});
    expect(c.defaultPrefix).toBe("SDC3");
    expect(c.usedPrefixes).toEqual(expect.arrayContaining(["SDC1", "SDC2"]));
  });
});

describe("prefixProblem", () => {
  it("format, taken by another instance, inside the component; its own prefix is fine", () => {
    expect(prefixProblem(machine, "imp", "with space", "inst-1")).toBe("format");
    expect(prefixProblem(machine, "imp", "SD1", "inst-1")).toBeUndefined();
    expect(prefixProblem(machine, "imp", "sd1")).toBe("taken");
    const nestedMachine = {
      components: {
        ...machine.components!,
        imports: machine.components!.imports.map((i) => ({ ...i, snapshot: { ...i.snapshot, dfd: { elements: [{ displayId: "SDC1:P-1" }] } } })),
      },
    } as unknown as Project;
    expect(prefixProblem(nestedMachine, "imp", "sdc1", "inst-1")).toBe("inner");
    expect(prefixProblem(machine, "imp", "C1", "inst-1")).toBeUndefined();
  });
});

describe("renameInstancePrefix", () => {
  const renamed = renameInstancePrefix(machine, "inst-1", "C1", "2026-11-26T00:00:00.000Z");

  it("every display id of the instance follows, in the records, the diagram and the instance assets", () => {
    const before = instanceIds(machine);
    const after = instanceIds(renamed);
    expect(before.some((id) => id.startsWith("SD1:"))).toBe(true);
    expect(after.filter((id) => id.startsWith("SD1:"))).toEqual([]);
    expect(after.filter((id) => id.startsWith("C1:")).length).toBe(before.filter((id) => id.startsWith("SD1:")).length);
    expect(renamed.dfd!.xml).not.toMatch(/label="[^"]*SD1:/);
    expect(renamed.assets!.assets.filter((a) => /^cmp/.test(a.id)).every((a) => a.displayId?.startsWith("C1:"))).toBe(true);
  });

  it("the save reads the new ids back", () => {
    const again = dfdService.saveDFDFromXml({ ...renamed, phaseStatus: {} } as unknown as DFDProjectData, renamed.dfd!.xml!);
    expect(instanceIds({ dfd: again.dfd } as never).sort()).toEqual(instanceIds(renamed).sort());
  });

  it("the machine's decisions and the import record stay; only the prefix changes", () => {
    const i = renamed.components!.instances[0];
    expect(i.prefix).toBe("C1");
    expect(i.relevanceOverrides).toEqual(machine.components!.instances[0].relevanceOverrides);
    expect(renamed.components!.imports).toEqual(machine.components!.imports);
    // same ids: the records are the same elements
    expect(renamed.dfd!.elements.map((e) => e.id).sort()).toEqual(machine.dfd!.elements.map((e) => e.id).sort());
  });

  it("refuses a prefix with a problem; the same prefix changes nothing", () => {
    expect(() => renameInstancePrefix(machine, "inst-1", "bad prefix", "t")).toThrow(/format/);
    expect(renameInstancePrefix(machine, "inst-1", "SD1", "t")).toBe(machine);
  });
});
