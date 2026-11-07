// src/tests/unit/features/dfd/services/leveled/insert-component.test.ts
//
// Multi-project TARA, phase 1 (design §5, §6): one instance of a component
// DFD put into a machine DFD — checked through the real save path
// (dfdService.saveDFDFromXml: parse, identity links, effective model,
// leveled findings), not only by looking at the XML.
//
// Component: the SmokeDetector fixture (single page, five external entities,
// one EE → EE flow). Machine: a small fire panel drawn with the leveled
// test builders — a "Fire Panel Controller" EE and an alarm process.

import { describe, expect, it } from "vitest";
import dfdService from "features/dfd/services/dfd-service";
import type { DFDConnection, DFDElement, DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";
import {
  insertComponentInstance,
  prefixDisplayLabel,
  InsertComponentError,
} from "features/dfd/services/leveled/insert-component";
import { flow, mxfile, node, page } from "../../../../../fixtures/leveled-dfd-xml";
import { analyseLeveled } from "features/dfd/services/leveled/leveled-analysis";
import { loadProjectFixture } from "../../../../../fixtures/load-fixture";

const smoke = loadProjectFixture("SmokeDetector.tara.json");
const component = {
  xml: smoke.dfd!.xml!,
  elements: smoke.dfd!.elements,
  connections: smoke.dfd!.connections,
};
const EES = smoke.dfd!.elements.filter((e) => e.type === "ExternalEntity").map((e) => e.id);
const EE_TO_EE = smoke.dfd!.connections.filter((c) => EES.includes(c.from) && EES.includes(c.to)).map((c) => c.id);
const BOUNDARY = smoke.dfd!.connections.filter((c) => EES.includes(c.from) !== EES.includes(c.to)).map((c) => c.id);
const BOUNDARY_TYPES = new Set(["TrustBoundary", "PhysicalBoundary", "ChipBoundary"]);
const typeOfComponent = (id: string) => smoke.dfd!.elements.find((e) => e.id === id)?.type ?? "";
/** Boundary flows whose inner end is a boundary element — the known limit I2. */
const TO_BOUNDARY = BOUNDARY.filter((id) => {
  const c = smoke.dfd!.connections.find((x) => x.id === id)!;
  return BOUNDARY_TYPES.has(typeOfComponent(EES.includes(c.from) ? c.to : c.from));
});

const machineXml = mxfile(
  page(
    "top",
    "Fire Panel",
    node("m_plc", "externalentity", "Fire Panel Controller", "EE-1", 10) +
      node("m_p1", "process", "Alarm Logic", "P-1", 300) +
      flow("m_df1", "report alarm", "DF-1", "m_plc", "m_p1"),
  ),
);
const machineElements = [
  { id: "m_plc", displayId: "EE-1", name: "Fire Panel Controller", type: "ExternalEntity", position: { x: 10, y: 10 }, size: { width: 120, height: 60 }, properties: {} },
  { id: "m_p1", displayId: "P-1", name: "Alarm Logic", type: "Process", position: { x: 300, y: 10 }, size: { width: 120, height: 60 }, properties: {} },
] as unknown as DFDElement[];
const machineConnections = [
  { id: "m_df1", displayId: "DF-1", name: "report alarm", from: "m_plc", to: "m_p1", properties: {} },
] as unknown as DFDConnection[];

const insert = (instanceId = "inst-1", prefix = "SD1", machine = { xml: machineXml, elements: machineElements, connections: machineConnections, pages: undefined as DFDPage[] | undefined }) =>
  insertComponentInstance({
    machine,
    component,
    instanceId,
    prefix,
    parentPageId: "top",
    multiprocess: { name: "Smoke Detector", x: 600, y: 200 },
    eeMapping: { "EE-1": "m_plc" }, // Alarmzentrale → the machine's controller; the others are taken over
  });

function save(result: ReturnType<typeof insert>, base = { elements: machineElements, connections: machineConnections }) {
  const project = {
    id: "machine",
    name: "Fire Panel",
    phaseStatus: {},
    dfd: {
      xml: machineXml,
      pages: result.pages,
      elements: [...base.elements, ...result.elements],
      connections: [...base.connections, ...result.connections],
      assets: [],
    },
  } as unknown as DFDProjectData;
  return dfdService.saveDFDFromXml(project, result.xml);
}

describe("insertComponentInstance — structure", () => {
  it("adds the multiprocess, its child page and a root page entry", () => {
    const r = insert();
    expect(r.pages.map((p) => [p.name, p.decomposes ?? null])).toEqual([
      ["Top", null],
      ["Smoke Detector", r.multiprocessTfId],
    ]);
    expect(r.childPageId).toBe(r.pages[1].pageId);
    expect(r.xml).toContain(`link="data:page/id,${r.childPageId}"`);
    expect(r.elements[0]).toMatchObject({ id: r.multiprocessTfId, type: "Multiprocess", displayId: "MP-xx" });
  });

  it("maps the EEs: a mapped one to the machine element, the others to new EEs", () => {
    const r = insert();
    expect(r.idMap["EE-1"]).toBe("m_plc");
    const created = EES.filter((id) => id !== "EE-1").map((id) => r.idMap[id]);
    expect(new Set(created).size).toBe(EES.length - 1);
    for (const id of created) expect(r.elements.find((e) => e.id === id)?.type).toBe("ExternalEntity");
  });

  it("drops the EE → EE flows, keeps every other flow with a record", () => {
    const r = insert();
    expect(EE_TO_EE.length).toBeGreaterThan(0);
    for (const id of EE_TO_EE) expect(r.connections.find((c) => c.id === r.idMap[id])).toBeUndefined();
    expect(r.connections).toHaveLength(smoke.dfd!.connections.length - EE_TO_EE.length);
  });

  it("display ids: the component's with the instance prefix; machine placeholders for the multiprocess and the boundary flows", () => {
    const r = insert();
    const process = smoke.dfd!.elements.find((e) => e.type === "Process")!;
    expect(r.elements.find((e) => e.id === r.idMap[process.id])?.displayId).toBe(`SD1:${process.displayId}`);
    for (const id of BOUNDARY) expect(r.connections.find((c) => c.id === r.idMap[id])?.displayId).toBe("DF-xx");
  });

  it("carries the component's properties, drops asset relations (phase 2)", () => {
    const r = insert();
    const withProps = smoke.dfd!.elements.find((e) => e.type === "Process" && Object.keys(e.properties ?? {}).length > 0)!;
    const copy = r.elements.find((e) => e.id === r.idMap[withProps.id])!;
    expect(copy.properties).toEqual(withProps.properties);
    expect(r.elements.every((e) => (e.assetRelations ?? []).length === 0)).toBe(true);
  });
});

describe("insertComponentInstance — through the real save path", () => {
  it("the save accepts the result and resolves one record per logical element", () => {
    const r = insert();
    const saved = save(r);
    expect(saved.success).toBe(true);
    const ids = new Set(saved.dfd.elements.map((e) => e.id));
    expect(ids.has(r.multiprocessTfId)).toBe(true);
    for (const e of smoke.dfd!.elements) {
      if (!EES.includes(e.id)) expect(ids.has(r.idMap[e.id]), e.id).toBe(true);
    }
    // no record for a component EE itself — it is a copy of a machine element
    for (const ee of EES) expect(ids.has(`cmp-${ee}`)).toBe(false);
  });

  it("records: a boundary flow keeps the endpoints of its definition (machine element ↔ multiprocess)", () => {
    const r = insert();
    const saved = save(r);
    for (const id of BOUNDARY) {
      const original = smoke.dfd!.connections.find((c) => c.id === id)!;
      const conn = saved.dfd.connections.find((c) => c.id === r.idMap[id])!;
      expect(conn, id).toBeDefined();
      expect(conn.from).toBe(EES.includes(original.from) ? r.idMap[original.from] : r.multiprocessTfId);
      expect(conn.to).toBe(EES.includes(original.to) ? r.idMap[original.to] : r.multiprocessTfId);
    }
  });

  it("effective model: boundary flows resolve to the inner element (deepest wins)", () => {
    const r = insert();
    const saved = save(r);
    const model = analyseLeveled({ xml: r.xml, pages: r.pages, elements: saved.dfd.elements, connections: saved.dfd.connections }).model;
    for (const id of BOUNDARY.filter((x) => !TO_BOUNDARY.includes(x))) {
      const original = smoke.dfd!.connections.find((c) => c.id === id)!;
      const f = model.flows.find((x) => x.tfId === r.idMap[id])!;
      expect(f, id).toBeDefined();
      expect([f.from, f.to], id).toEqual([r.idMap[original.from], r.idMap[original.to]]);
    }
  });

  it("no balancing or page-tree errors, except the known limit I2 (EE → boundary element)", () => {
    const r = insert();
    const saved = save(r);
    const leveled = saved.validation.errors.filter((f) => /leveled\.(BAL_|PAGE_)/.test(f.key));
    expect(TO_BOUNDARY.length).toBeGreaterThan(0);
    expect(leveled.map((f) => f.key).every((k) => k.endsWith("BAL_AMBIGUOUS_ENDPOINT"))).toBe(true);
    expect(leveled.map((f) => f.elementId).sort()).toEqual(TO_BOUNDARY.map((id) => r.idMap[id]).sort());
  });

  it("no dangling asset references (asset relations come in phase 2)", () => {
    const saved = save(insert());
    expect(saved.validation.errors.filter((f) => f.key === "dfdValidation.assetRelationInconsistent")).toEqual([]);
  });

  it("display ids keep the instance prefix after the save (read back from the idlabels)", () => {
    const r = insert();
    const saved = save(r);
    for (const e of smoke.dfd!.elements) {
      if (EES.includes(e.id) || !e.displayId) continue;
      // boundaries carry their id in the label and keep it as named
      const expected = BOUNDARY_TYPES.has(e.type) ? e.displayId : `SD1:${e.displayId}`;
      expect(saved.dfd.elements.find((x) => x.id === r.idMap[e.id])?.displayId, e.id).toBe(expected);
    }
    for (const c of smoke.dfd!.connections) {
      if (EES.includes(c.from) || EES.includes(c.to) || !c.displayId) continue;
      expect(saved.dfd.connections.find((x) => x.id === r.idMap[c.id])?.displayId, c.id).toBe(`SD1:${c.displayId}`);
    }
  });

  it("properties survive the save", () => {
    const r = insert();
    const saved = save(r);
    const withProps = smoke.dfd!.elements.find((e) => e.type === "Process" && Object.keys(e.properties ?? {}).length > 0)!;
    expect(saved.dfd.elements.find((e) => e.id === r.idMap[withProps.id])?.properties).toEqual(withProps.properties);
  });
});

describe("insertComponentInstance — identity", () => {
  it("is deterministic for the same instance", () => {
    expect(insert("inst-1").xml).toBe(insert("inst-1").xml);
    expect(insert("inst-1").idMap).toEqual(insert("inst-1").idMap);
  });

  it("two instances get distinct ids and both survive one save", () => {
    const first = insert("inst-1", "SD1");
    const second = insertComponentInstance({
      machine: { xml: first.xml, pages: first.pages, elements: [...machineElements, ...first.elements], connections: [...machineConnections, ...first.connections] },
      component,
      instanceId: "inst-2",
      prefix: "SD2",
      parentPageId: "top",
      multiprocess: { name: "Smoke Detector 2", x: 600, y: 500 },
      eeMapping: { "EE-1": "m_plc" },
    });
    const ids1 = new Set(first.elements.map((e) => e.id));
    const shared = second.elements.filter((e) => ids1.has(e.id));
    expect(shared).toEqual([]);
    const saved = save(second, { elements: [...machineElements, ...first.elements], connections: [...machineConnections, ...first.connections] });
    expect(saved.success).toBe(true);
    expect(saved.dfd.elements.filter((e) => e.type === "Multiprocess")).toHaveLength(2);
    const leveled = saved.validation.errors.filter((f) => /leveled\.(BAL_|PAGE_)/.test(f.key));
    expect(leveled.every((f) => f.key.endsWith("BAL_AMBIGUOUS_ENDPOINT"))).toBe(true);
    expect(leveled).toHaveLength(TO_BOUNDARY.length * 2);
  });
});

describe("insertComponentInstance — refusals and helpers", () => {
  it("a mapping to an element that is not on the parent page is refused", () => {
    expect(() =>
      insertComponentInstance({
        machine: { xml: machineXml, elements: machineElements, connections: machineConnections },
        component,
        instanceId: "x",
        prefix: "SD1",
        parentPageId: "top",
        multiprocess: { name: "SD", x: 0, y: 0 },
        eeMapping: { "EE-1": "nowhere" },
      }),
    ).toThrow(InsertComponentError);
  });

  it("an unknown parent page is refused", () => {
    expect(() =>
      insertComponentInstance({
        machine: { xml: machineXml, elements: machineElements, connections: machineConnections },
        component,
        instanceId: "x",
        prefix: "SD1",
        parentPageId: "missing",
        multiprocess: { name: "SD", x: 0, y: 0 },
        eeMapping: {},
      }),
    ).toThrow(InsertComponentError);
  });

  it("prefixDisplayLabel keeps the formatting around the id", () => {
    expect(prefixDisplayLabel("P-3", "CAM1")).toBe("CAM1:P-3");
    expect(prefixDisplayLabel('<font style="font-size: 10px">DF-12a</font>', "CAM1")).toBe('<font style="font-size: 10px">CAM1:DF-12a</font>');
    expect(prefixDisplayLabel("MP-1.2", "CAM1")).toBe("CAM1:MP-1.2");
    expect(prefixDisplayLabel("SDC", "CAM1")).toBe("CAM1:SDC");
    expect(prefixDisplayLabel('<font style="font-size: 10px">SDC</font>', "CAM1")).toBe('<font style="font-size: 10px">CAM1:SDC</font>');
  });
});
