// src/tests/unit/features/dfd/services/leveled/insert-component.test.ts
//
// Multi-project TARA, phase 1 (design §5, §6): one instance of a component
// DFD put into a machine DFD — checked through the real save path
// (dfdService.saveDFDFromXml: parse, identity links, effective model,
// leveled findings), not only by looking at the XML.
//
// Component: the SmokeDetector fixture (single page, five external entities,
// one EE → EE flow). The shells use a small case component built here. Machine: a small fire panel drawn with the leveled
// test builders — a "Fire Panel Controller" EE and an alarm process.

import { describe, expect, it } from "vitest";
import dfdService from "features/dfd/services/dfd-service";
import type { DFDConnection, DFDElement, DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";
import {
  insertComponentInstance,
  replaceComponentInstance,
  prefixDisplayLabel,
  prefixBoundaryLabel,
  InsertComponentError,
  instanceAssetId,
  shellBoundaryIds,
} from "features/dfd/services/leveled/insert-component";
import { flow, mxfile, node, page } from "../../../../../fixtures/leveled-dfd-xml";
import { analyseLeveled } from "features/dfd/services/leveled/leveled-analysis";
import { danglingAttachedCopies } from "features/dfd/services/leveled/child-pages-steps";
import { parseDfd } from "features/dfd";
import { loadProjectFixture } from "../../../../../fixtures/load-fixture";

const smoke = loadProjectFixture("SmokeDetector.tara.json");
const component = {
  xml: smoke.dfd!.xml!,
  elements: smoke.dfd!.elements,
  connections: smoke.dfd!.connections,
  assets: smoke.dfd!.assets,
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
      assets: result.assets,
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
    expect(r.elements[0]).toMatchObject({ id: r.multiprocessTfId, type: "Multiprocess", displayId: "MP-1" });
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

  it("display ids: the component's with the instance prefix; the multiprocess, new EEs and boundary flows the machine's next numbers", () => {
    const r = insert();
    const process = smoke.dfd!.elements.find((e) => e.type === "Process")!;
    expect(r.elements.find((e) => e.id === r.idMap[process.id])?.displayId).toBe(`SD1:${process.displayId}`);
    // manual test 2026-11-17: no placeholder to renumber by hand; the machine has EE-1 and DF-1
    expect(r.elements.find((e) => e.id === r.multiprocessTfId)?.displayId).toBe("MP-1");
    const flows = BOUNDARY.map((id) => r.connections.find((c) => c.id === r.idMap[id])!.displayId);
    expect(flows).toEqual(BOUNDARY.map((_, i) => `DF-${i + 2}`));
    const newEes = r.elements.filter((e) => e.type === "ExternalEntity").map((e) => e.displayId);
    expect(newEes).toEqual(newEes.map((_, i) => `EE-${i + 2}`));
    expect(r.xml).not.toMatch(/(MP|EE|DF)-xx/);
  });

  // Manual test 2026-11-19: the new multiprocess landed on — and under — a machine element.
  it("placeFree: the multiprocess goes to the first free place, not onto a machine element", () => {
    const busy = mxfile(page("top", "Fire Panel", node("m_big", "process", "Controller", "P-9", 560)));
    const big = { id: "m_big", displayId: "P-9", name: "Controller", type: "Process", position: { x: 560, y: 0 }, size: { width: 120, height: 60 }, properties: {} } as unknown as DFDElement;
    const at = (placeFree: boolean) => {
      const r = insertComponentInstance({
        machine: { xml: busy.replace(/<mxGeometry[^>]*\/>/, '<mxGeometry x="560" y="160" width="300" height="200" as="geometry"/>'), elements: [big], connections: [] },
        component,
        instanceId: "inst-1",
        prefix: "SD1",
        parentPageId: "top",
        multiprocess: { name: "Smoke Detector", x: 600, y: 200 },
        eeMapping: {},
        placeFree,
      });
      const g = new RegExp(`id="${r.multiprocessTfId}"[^>]*>\\s*<mxCell[^>]*>\\s*<mxGeometry x="(\\d+)" y="(\\d+)"`).exec(r.xml)!;
      return { x: Number(g[1]), y: Number(g[2]) };
    };
    expect(at(false)).toEqual({ x: 600, y: 200 }); // the given place: on the controller (560,160 300×200)
    const free = at(true);
    expect(free.y).toBe(200);
    expect(free.x).toBeGreaterThanOrEqual(560 + 300 + 20); // right of the controller, with a gap
  });

  it("carries the component's properties", () => {
    const r = insert();
    const withProps = smoke.dfd!.elements.find((e) => e.type === "Process" && Object.keys(e.properties ?? {}).length > 0)!;
    const copy = r.elements.find((e) => e.id === r.idMap[withProps.id])!;
    expect(copy.properties).toEqual(withProps.properties);
  });

  it("assets per instance (E5): the mirror with instance ids, relations pointing to them", () => {
    const r = insert();
    expect(r.assets).toHaveLength(smoke.dfd!.assets.length);
    const assetIds = new Set(r.assets.map((a) => a.id));
    for (const a of smoke.dfd!.assets) expect(assetIds.has(instanceAssetId("inst-1", a.id))).toBe(true);
    const related = r.elements.flatMap((e) => e.assetRelations ?? []);
    expect(related.length).toBeGreaterThan(0);
    for (const rel of related) expect(assetIds.has(rel.assetId), rel.assetId).toBe(true);
    const machineIds = new Set([...r.elements.map((e) => e.id), ...r.connections.map((c) => c.id), "m_plc", "m_p1"]);
    for (const a of r.assets) for (const l of a.linkedElements ?? []) expect(machineIds.has(l.elementId), l.elementId).toBe(true);
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
      // boundaries carry their id in the label — with the prefix too (0.20 item 17)
      const expected = `SD1:${e.displayId}`;
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
  it("prefixBoundaryLabel: the prefix into the last id bracket, in front of inner prefixes; without bracket unchanged", () => {
    expect(prefixBoundaryLabel("Case [CASE]", "SD2")).toBe("Case [SD2:CASE]");
    expect(prefixBoundaryLabel("Zone [old] [Z-1]", "SD2")).toBe("Zone [old] [SD2:Z-1]");
    expect(prefixBoundaryLabel("Case", "SD2")).toBe("Case");
    // nested (review 2026-11-22): the outer prefix in front of the inner one
    expect(prefixBoundaryLabel("Case [SD1:CASE]", "C1")).toBe("Case [C1:SD1:CASE]");
    // the same prefix inside and outside: prefixed again (the label comes fresh from the component)
    expect(prefixBoundaryLabel("Case [C1:CASE]", "C1")).toBe("Case [C1:C1:CASE]");
  });

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
    // nested (review 2026-11-22): in front of the inner prefixes, also the same one
    expect(prefixDisplayLabel("SD1:P-1", "C1")).toBe("C1:SD1:P-1");
    expect(prefixDisplayLabel("C1:P-1", "C1")).toBe("C1:C1:P-1");
    expect(prefixDisplayLabel('<font style="font-size: 10px">SD1:DF-2</font>', "C1")).toBe('<font style="font-size: 10px">C1:SD1:DF-2</font>');
    expect(prefixDisplayLabel('<font style="font-size: 10px">SDC</font>', "CAM1")).toBe('<font style="font-size: 10px">CAM1:SDC</font>');
  });
});

// Manual test 2026-11-07: the machine's top page showed the multiprocess
// alone — the case and the trust zone of the component were only on its
// child page. Shells (boundaries every part of the component is inside)
// now appear around the multiprocess on the parent page — as attached
// copies of their definitions on the component's page (user 2026-11-08).
describe("insertComponentInstance — shells around the multiprocess", () => {
  const box = (id: string, type: string, label: string, x: number, y: number, w: number, h: number) =>
    `<object label="${label}" type="${type}" id="${id}"><mxCell style="rounded=0;dashed=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell></object>`;
  const idl = (id: string, text: string) =>
    `<object label="${text}" type="idlabel" id="${id}_id"><mxCell connectable="0" parent="${id}" vertex="1"><mxGeometry width="35" height="18" relative="1" as="geometry"/></mxCell></object>`;
  // Case ⊃ Zone ⊃ Chip ⊃ P-1; DS-1 in Zone, not in Chip; IF-1 in Case, not in Zone; EE outside.
  const caseXml = mxfile(
    page(
      "c_top",
      "Page-1",
      box("c_case", "physicalboundary", "Case [CASE]", 0, 0, 700, 420) +
        box("c_zone", "trustboundary", "Zone [Z]", 20, 40, 460, 340) +
        box("c_chip", "chipboundary", "Chip [CH]", 40, 80, 180, 120) +
        box("c_p1", "process", "Measure", 60, 110, 120, 60) + idl("c_p1", "P-1") +
        box("c_ds1", "datastorage", "Calibration", 280, 240, 120, 60) + idl("c_ds1", "DS-1") +
        box("c_if1", "interface", "Port", 600, 180, 40, 40) + idl("c_if1", "IF-1") +
        box("c_ee", "externalentity", "Controller", 900, 180, 120, 60) + idl("c_ee", "EE-1") +
        flow("c_df1", "command", "DF-1", "c_ee", "c_p1") +
        flow("c_df2", "write", "DF-2", "c_p1", "c_ds1"),
    ),
  );
  const parsed = dfdService.saveDFDFromXml(
    { id: "c", name: "c", phaseStatus: {}, dfd: { xml: caseXml, elements: [], connections: [], assets: [] } } as unknown as DFDProjectData,
    caseXml,
  );
  const caseComponent = { xml: caseXml, elements: parsed.dfd.elements, connections: parsed.dfd.connections, assets: [] };
  const insertCase = () =>
    insertComponentInstance({
      machine: { xml: machineXml, elements: machineElements, connections: machineConnections },
      component: caseComponent,
      instanceId: "inst-c",
      prefix: "C1",
      parentPageId: "top",
      multiprocess: { name: "Case", x: 600, y: 200 },
      eeMapping: { c_ee: "m_plc" },
    });
  const pageXml = (xml: string, pageId: string) => xml.match(new RegExp(`<diagram[^>]*id="${pageId}"[\\s\\S]*?</diagram>`))![0];
  const geometryOf = (pageText: string, cellId: string) => {
    const cell = pageText.match(new RegExp(`id="${cellId}"[\\s\\S]*?<mxGeometry ([^>]*)>`))![1];
    const n = (k: string) => Number(cell.match(new RegExp(`${k}="([-0-9.]+)"`))![1]);
    return { x: n("x"), y: n("y"), w: n("width"), h: n("height") };
  };

  it("shells: the case and the zone; not the chip (DS-1 and IF-1 are outside it)", () => {
    expect(shellBoundaryIds(caseComponent).sort()).toEqual(["c_case", "c_zone"]);
  });

  it("no shells without boundaries, or for the SmokeDetector fixture where no boundary holds both modules", () => {
    expect(shellBoundaryIds({ ...caseComponent, elements: caseComponent.elements.filter((e) => !BOUNDARY_TYPES.has(e.type)) })).toEqual([]);
    expect(shellBoundaryIds(component)).toEqual([]);
  });

  it("attached copies of the shells around the multiprocess on the parent page, nested; the definitions stay on the component's page", () => {
    const r = insertCase();
    const top = pageXml(r.xml, "top");
    const parentLinks = r.pages.find((p) => p.pageId === "top")!.links ?? [];
    const shellCell = (componentId: string) => parentLinks.find((l) => l.tfId === r.idMap[componentId])!;
    // user 2026-11-08: only references on top, attached to their definition
    expect(shellCell("c_case")).toMatchObject({ role: "ref", attached: true });
    expect(shellCell("c_zone")).toMatchObject({ role: "ref", attached: true });
    const mp = geometryOf(top, r.multiprocessTfId);
    const outer = geometryOf(top, shellCell("c_case").cellId);
    const inner = geometryOf(top, shellCell("c_zone").cellId);
    const encloses = (a: typeof mp, b: typeof mp) => a.x < b.x && a.y < b.y && a.x + a.w > b.x + b.w && a.y + a.h > b.y + b.h;
    expect(encloses(inner, mp)).toBe(true);
    expect(encloses(outer, inner)).toBe(true);
    // behind the machine's cells: right after the layer cell, outer first
    expect(top.indexOf(`id="${shellCell("c_case").cellId}"`)).toBeLessThan(top.indexOf(`id="${shellCell("c_zone").cellId}"`));
    expect(top.indexOf(`id="${shellCell("c_zone").cellId}"`)).toBeLessThan(top.indexOf('id="m_plc"'));
    // definitions (cell id = tfId) only on the component's page; the chip has no copy on top
    expect(top).not.toContain(`id="${r.idMap.c_case}"`);
    expect(top).not.toContain(`id="${r.idMap.c_chip}"`);
    const childXml = pageXml(r.xml, r.childPageId);
    for (const id of ["c_case", "c_zone", "c_chip"]) expect(childXml).toContain(`id="${r.idMap[id]}"`);
    const child = r.pages.find((p) => p.pageId === r.childPageId)!;
    expect((child.links ?? []).some((l) => [r.idMap.c_case, r.idMap.c_zone].includes(l.tfId))).toBe(false);
    // the record keeps the component's geometry
    const rec = r.elements.find((e) => e.id === r.idMap.c_case)!;
    const original = caseComponent.elements.find((e) => e.id === "c_case")!;
    expect(rec.position).toEqual(original.position);
  });

  // 0.20 item 17 (0.19 manual test): two instances of one component brought
  // the same boundary ids ("Case [CASE]" twice) — the instance prefix goes
  // into the id bracket, like every other display id of the instance.
  it("boundary labels carry the instance prefix — on the component's page, on the attached copies and in the records", () => {
    const r = insertCase();
    const top = pageXml(r.xml, "top");
    const child = pageXml(r.xml, r.childPageId);
    for (const [label, prefixed] of [["Case [CASE]", "Case [C1:CASE]"], ["Zone [Z]", "Zone [C1:Z]"], ["Chip [CH]", "Chip [C1:CH]"]]) {
      expect(child).toContain(`label="${prefixed}"`);
      expect(child).not.toContain(`label="${label}"`);
    }
    expect(top).toContain('label="Case [C1:CASE]"');
    expect(top).toContain('label="Zone [C1:Z]"');
    expect(top).not.toMatch(/label="(Case \[CASE\]|Zone \[Z\])"/);
    expect(r.elements.find((e) => e.id === r.idMap.c_case)).toMatchObject({ name: "Case [C1:CASE]", displayId: "C1:CASE" });
    expect(r.elements.find((e) => e.id === r.idMap.c_zone)).toMatchObject({ displayId: "C1:Z", properties: { boundaryId: "C1:Z" } });
    // the inner elements as before
    expect(r.elements.find((e) => e.id === r.idMap.c_p1)?.displayId).toBe("C1:P-1");
  });

  it("the save reads the prefixed ids back; no missing-id finding; two instances, no duplicate id", () => {
    const first = insertCase();
    const second = insertComponentInstance({
      machine: { xml: first.xml, pages: first.pages, elements: [...machineElements, ...first.elements], connections: [...machineConnections, ...first.connections] },
      component: caseComponent,
      instanceId: "inst-c2",
      prefix: "C2",
      parentPageId: "top",
      multiprocess: { name: "Case 2", x: 600, y: 600 },
      eeMapping: { c_ee: "m_plc" },
    });
    const project = {
      id: "m",
      name: "m",
      phaseStatus: {},
      dfd: {
        xml: machineXml,
        pages: second.pages,
        elements: [...machineElements, ...first.elements, ...second.elements],
        connections: [...machineConnections, ...first.connections, ...second.connections],
        assets: [],
      },
    } as unknown as DFDProjectData;
    const saved = dfdService.saveDFDFromXml(project, second.xml);
    expect(saved.success).toBe(true);
    const boundaryIds = saved.dfd.elements.filter((e) => BOUNDARY_TYPES.has(e.type)).map((e) => e.displayId).sort();
    expect(boundaryIds).toEqual(["C1:CASE", "C1:CH", "C1:Z", "C2:CASE", "C2:CH", "C2:Z"]);
    const all = [...saved.validation.errors, ...saved.validation.warnings].map((f) => f.key);
    expect(all.filter((k) => /trustBoundaryMissingId|TRUST_BOUNDARY_MISSING_ID|duplicateIdLabel/i.test(k))).toEqual([]);
  });

  it("an update builds the instance again — the prefix once, not twice", () => {
    const first = insertCase();
    const r = replaceComponentInstance({
      machine: { xml: first.xml, pages: first.pages, elements: [...machineElements, ...first.elements], connections: [...machineConnections, ...first.connections] },
      oldComponent: caseComponent,
      component: caseComponent,
      instanceId: "inst-c",
      prefix: "C1",
      eeMapping: { c_ee: "m_plc" },
    });
    expect(r.xml.match(/label="Case \[C1:CASE\]"/g)).toHaveLength(2); // definition + attached copy
    expect(r.xml).not.toContain("C1:C1:");
    expect(r.elements.find((e) => e.id === first.idMap.c_case)?.displayId).toBe("C1:CASE");
  });

  // Review 2026-11-22: a component brings its own imports (design §6.5, E8).
  // Its boundaries are prefixed already; the outer import puts its prefix in
  // front, like for the inner elements (M1:C1:P-1) — label and record alike,
  // and the save reads the same id back.
  // the machine with its Case instance (C1), imported as a component itself
  const nested = () => {
    const inner = insertCase();
    const controller = {
      xml: inner.xml,
      pages: inner.pages,
      elements: [...machineElements, ...inner.elements],
      connections: [...machineConnections, ...inner.connections],
      assets: [],
    };
    const importInto = (machine: { xml: string; pages?: DFDPage[]; elements: DFDElement[]; connections: DFDConnection[] }, instanceId: string, prefix: string, y: number) =>
      insertComponentInstance({
        machine,
        component: controller,
        instanceId,
        prefix,
        parentPageId: "top",
        multiprocess: { name: `Controller ${prefix}`, x: 600, y },
        eeMapping: { m_plc: "m_plc" },
      });
    /** Two controllers with these prefixes, saved. */
    return (p1: string, p2: string) => {
      const base = { xml: machineXml, elements: machineElements, connections: machineConnections };
      const a = importInto(base, "inst-a", p1, 200);
      const b = importInto({ xml: a.xml, pages: a.pages, elements: [...machineElements, ...a.elements], connections: [...machineConnections, ...a.connections] }, "inst-b", p2, 700);
      const project = {
        id: "m",
        name: "m",
        phaseStatus: {},
        dfd: {
          xml: machineXml,
          pages: b.pages,
          elements: [...machineElements, ...a.elements, ...b.elements],
          connections: [...machineConnections, ...a.connections, ...b.connections],
          assets: [],
        },
      } as unknown as DFDProjectData;
      return { a, b, saved: dfdService.saveDFDFromXml(project, b.xml) };
    };
  };
  const idsOf = (saved: ReturnType<typeof dfdService.saveDFDFromXml>, pick: (e: DFDElement) => boolean) =>
    saved.dfd.elements.filter(pick).map((e) => e.displayId).sort();
  const findingKeys = (saved: ReturnType<typeof dfdService.saveDFDFromXml>) =>
    [...saved.validation.errors, ...saved.validation.warnings].map((f) => f.key).filter((k) => /trustBoundaryMissingId|duplicateIdLabel/i.test(k));

  it("a nested import: the outer prefix in front of the inner one — label, record and save agree", () => {
    const { a, b, saved } = nested()("M1", "M2");
    expect(b.xml).toContain('label="Case [M1:C1:CASE]"');
    expect(b.xml).toContain('label="Case [M2:C1:CASE]"');
    expect(b.xml).not.toMatch(/label="Case \[C1:CASE\]"/);
    expect(a.elements.find((e) => e.name === "Case [M1:C1:CASE]")?.displayId).toBe("M1:C1:CASE");
    expect(saved.success).toBe(true);
    expect(idsOf(saved, (e) => e.type === "PhysicalBoundary")).toEqual(["M1:C1:CASE", "M2:C1:CASE"]);
    // the inner elements alike: the outer prefix in front of the whole chain (was "C1:M1:P-1")
    expect(idsOf(saved, (e) => e.name === "Measure")).toEqual(["M1:C1:P-1", "M2:C1:P-1"]);
    expect(findingKeys(saved)).toEqual([]);
  });

  // Review 2026-11-22: prefixes are unique within one machine only — the
  // controller's Case instance and the controller itself may both be C1.
  it("a nested import with the same prefix inside and outside: prefixed twice, label and record agree", () => {
    const { a, saved } = nested()("C1", "C2");
    expect(a.xml).toContain('label="Case [C1:C1:CASE]"');
    expect(a.elements.find((e) => e.name === "Case [C1:C1:CASE]")?.displayId).toBe("C1:C1:CASE");
    expect(idsOf(saved, (e) => e.type === "PhysicalBoundary")).toEqual(["C1:C1:CASE", "C2:C1:CASE"]);
    expect(idsOf(saved, (e) => e.name === "Measure")).toEqual(["C1:C1:P-1", "C2:C1:P-1"]);
    // the record of every element of the instance says what the save reads back
    for (const r of a.elements.filter((e) => e.displayId && e.displayId.startsWith("C1:"))) {
      expect(saved.dfd.elements.find((e) => e.id === r.id)?.displayId, r.name).toBe(r.displayId);
    }
    expect(findingKeys(saved)).toEqual([]);
  });

  it("the shells go with the component's page: once it is deleted they are dangling attached copies to remove", () => {
    const r = insertCase();
    const parentLinks = r.pages.find((p) => p.pageId === "top")!.links ?? [];
    const shellCells = parentLinks.filter((l) => l.attached).map((l) => l.cellId).sort();
    expect(shellCells).toHaveLength(2);
    // with the page: nothing to remove
    expect(danglingAttachedCopies(parseDfd(r.xml, r.pages), r.pages, new Set())).toEqual([]);
    // the page deleted in draw.io (and from the page tree)
    const withoutPage = r.xml.replace(pageXml(r.xml, r.childPageId), "");
    const pages = r.pages.filter((p) => p.pageId !== r.childPageId);
    const dangling = danglingAttachedCopies(parseDfd(withoutPage, pages), pages, new Set());
    expect(dangling.map((d) => d.pageId)).toEqual(["top"]);
    expect([...dangling[0].cellIds].sort()).toEqual(shellCells);
    // already requested: not again
    const requested = new Set(shellCells.map((c) => `top\u0000-${c}`));
    expect(danglingAttachedCopies(parseDfd(withoutPage, pages), pages, requested)).toEqual([]);
  });

  it("through the save: no balancing / page errors, same effective boundaries as in the component", () => {
    const r = insertCase();
    const saved = save(r);
    expect(saved.success).toBe(true);
    expect(saved.validation.errors.filter((f) => /leveled\.(BAL_|PAGE_)/.test(f.key))).toEqual([]);
    expect(saved.validation.warnings.filter((f) => /leveled\.(BAL_|PAGE_)/.test(f.key))).toEqual([]);
    // attached copies above their definition: no BAL_HOME_NOT_HIGHEST (info)
    expect((saved.validation.infos ?? []).filter((f) => /leveled\.(BAL_|PAGE_)/.test(f.key))).toEqual([]);
    const model = analyseLeveled({ xml: r.xml, pages: r.pages, elements: saved.dfd.elements, connections: saved.dfd.connections }).model;
    const boundariesOf = (componentId: string) => {
      const b = model.elements.find((e) => e.tfId === r.idMap[componentId])!.boundaries!;
      return [...b.trust, ...b.chip, ...b.physical].sort();
    };
    expect(boundariesOf("c_p1")).toEqual([r.idMap.c_case, r.idMap.c_chip, r.idMap.c_zone].sort());
    expect(boundariesOf("c_ds1")).toEqual([r.idMap.c_case, r.idMap.c_zone].sort());
    expect(boundariesOf("c_if1")).toEqual([r.idMap.c_case]);
    // the boundary flow still resolves to the inner element
    const f = model.flows.find((x) => x.tfId === r.idMap.c_df1)!;
    expect([f.from, f.to]).toEqual(["m_plc", r.idMap.c_p1]);
  });
});

// ==================== REPLACE (phase 5c) ====================

describe("replaceComponentInstance — an instance moves to a new component state (phase 5c)", () => {
  const first = insert();
  const machineAfter = {
    xml: first.xml,
    pages: first.pages,
    elements: [...machineElements, ...first.elements],
    connections: [...machineConnections, ...first.connections],
    assets: first.assets,
  };
  // after the import every EE is mapped: EE-1 to the controller, the others to the EEs the import created
  const mapping = Object.fromEntries(EES.map((id) => [id, first.idMap[id]]));
  const replace = (next = component, machine = machineAfter) =>
    replaceComponentInstance({ machine, oldComponent: component, component: next, instanceId: "inst-1", prefix: "SD1", eeMapping: mapping });
  const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id).sort();

  it("the same state again: the same ids, pages and records — the machine's references stay valid", () => {
    const r = replace();
    expect(ids([...r.remaining.elements, ...r.elements])).toEqual(ids(machineAfter.elements));
    expect(ids([...r.remaining.connections, ...r.connections])).toEqual(ids(machineAfter.connections));
    expect(ids([...r.remaining.assets, ...r.assets])).toEqual(ids(machineAfter.assets));
    expect(r.pages.map((p) => p.pageId).sort()).toEqual(first.pages.map((p) => p.pageId).sort());
    expect(r.multiprocessTfId).toBe(first.multiprocessTfId);
    // the EEs the import created are the machine's: they stay and are mapped again, not duplicated
    expect(r.elements.filter((e) => e.type === "ExternalEntity")).toEqual([]);
    expect(new DOMParser().parseFromString(r.xml, "text/xml").getElementsByTagName("diagram").length).toBe(
      new DOMParser().parseFromString(first.xml, "text/xml").getElementsByTagName("diagram").length,
    );
  });

  it("keeps the multiprocess's place, name and display ids (no renumbering)", () => {
    const numbered = { ...machineAfter, xml: machineAfter.xml.replace(/label="MP-1"/, 'label="MP-7"') };
    const r = replace(component, numbered);
    expect(r.xml).toContain('label="MP-7"');
    expect(r.elements.find((e) => e.id === first.multiprocessTfId)!.displayId).toBe("MP-7");
    expect(r.xml).toMatch(new RegExp(`id="${first.multiprocessTfId}"[^>]*>\\s*<mxCell[^>]*>\\s*<mxGeometry x="600" y="200"`));
  });

  it("the boundary flows keep the machine's numbers; a renamed one the analyst paired keeps its number too (manual test 2026-11-17)", () => {
    const [renamed, ...others] = BOUNDARY.filter((id) => !TO_BOUNDARY.includes(id));
    const numberOf = (r: { connections: readonly DFDConnection[] }, tf: string) => r.connections.find((c) => c.id === tf)?.displayId;
    const before = numberOf(machineAfter, first.idMap[renamed])!;
    const next = { ...component, connections: component.connections.map((c) => (c.id === renamed ? { ...c, id: `${renamed}-new` } : c)) };
    const xml = component.xml.replace(new RegExp(`id="${renamed}"`, "g"), `id="${renamed}-new"`);
    const nextState = { ...next, xml };
    const paired = replaceComponentInstance({
      machine: machineAfter, oldComponent: component, component: nextState, instanceId: "inst-1", prefix: "SD1", eeMapping: mapping,
      pairedFlows: { [renamed]: `${renamed}-new` },
    });
    const newTf = paired.idMap[`${renamed}-new`];
    expect(newTf).not.toBe(first.idMap[renamed]);
    expect(numberOf(paired, newTf)).toBe(before);
    for (const id of others) expect(numberOf(paired, first.idMap[id])).toBe(numberOf(machineAfter, first.idMap[id]));
    expect(paired.xml).not.toMatch(/(MP|EE|DF)-xx/);
    // unpaired, it is a new flow: the next number nobody uses, not a placeholder
    const unpaired = replaceComponentInstance({ machine: machineAfter, oldComponent: component, component: nextState, instanceId: "inst-1", prefix: "SD1", eeMapping: mapping });
    const used = machineAfter.connections.map((c) => Number(/^DF-(\d+)$/.exec(c.displayId)?.[1] ?? 0));
    expect(numberOf(unpaired, newTf)).toBe(`DF-${Math.max(...used) + 1}`);
  });

  it("the multiprocess keeps the machine's description, properties and asset relations", () => {
    const own = {
      ...machineAfter,
      elements: machineAfter.elements.map((e) =>
        e.id === first.multiprocessTfId
          ? { ...e, description: "Our smoke detector", properties: { securityLevel: "SL2" }, assetRelations: [{ assetId: "a-own", relation: "processes" }] }
          : e,
      ),
    } as typeof machineAfter;
    const mp = replace(component, own).elements.find((e) => e.id === first.multiprocessTfId)!;
    expect(mp.description).toBe("Our smoke detector");
    expect(mp.properties).toEqual({ securityLevel: "SL2" });
    expect(mp.assetRelations).toEqual([{ assetId: "a-own", relation: "processes" }]);
  });

  it("a changed state: what the component removed goes, the rest keeps its ids", () => {
    const process = component.elements.find((e) => e.type === "Process" && !component.connections.some((c) => c.from === e.id || c.to === e.id));
    const victim = process ?? component.elements.find((e) => e.type === "DataStore")!;
    const next = {
      ...component,
      elements: component.elements.filter((e) => e.id !== victim.id),
      connections: component.connections.filter((c) => c.from !== victim.id && c.to !== victim.id),
    };
    const r = replace(next);
    const all = ids([...r.remaining.elements, ...r.elements]);
    expect(all).not.toContain(first.idMap[victim.id]);
    const survivor = component.elements.find((e) => e.id !== victim.id && e.type === "Process")!;
    expect(all).toContain(first.idMap[survivor.id]);
  });
});
