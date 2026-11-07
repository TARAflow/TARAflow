// src/tests/unit/features/dfd/services/leveled/component-pages-numbering.test.ts
//
// Multi-project TARA (design §6.6): the pages of an imported component are
// locked for the machine's renumber — the component's ids keep their prefix,
// the multiprocess and the boundary flows (machine elements) get numbers,
// and context copies of machine elements on the component's page follow
// their definition.

import { describe, expect, it } from "vitest";
import { DFDAutoNumbering } from "features/dfd/services/dfd-auto-numbering";
import { insertComponentInstance } from "features/dfd/services/leveled/insert-component";
import { lockedPageIdsOf } from "features/dfd/services/leveled/locked-pages";
import { flow, mxfile, node, page } from "../../../../../fixtures/leveled-dfd-xml";
import { loadProjectFixture } from "../../../../../fixtures/load-fixture";

const smoke = loadProjectFixture("SmokeDetector.tara.json");
const machineXml = mxfile(
  page(
    "top",
    "Fire Panel",
    node("m_plc", "externalentity", "Fire Panel Controller", "EE-xx", 10) +
      node("m_p1", "process", "Alarm Logic", "P-xx", 300) +
      flow("m_df1", "report alarm", "DF-xx", "m_plc", "m_p1"),
  ),
);
const inserted = insertComponentInstance({
  machine: { xml: machineXml, elements: [], connections: [] },
  component: { xml: smoke.dfd!.xml!, elements: smoke.dfd!.elements, connections: smoke.dfd!.connections },
  instanceId: "inst-1",
  prefix: "SD1",
  parentPageId: "top",
  multiprocess: { name: "Smoke Detector", x: 600, y: 200 },
  eeMapping: { "EE-1": "m_plc" },
});

/** idlabel text by the id of the cell it labels, per page. */
function labels(xml: string, pageId: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const diagram = Array.from(doc.getElementsByTagName("diagram")).find((d) => d.getAttribute("id") === pageId)!;
  const out = new Map<string, string>();
  for (const o of Array.from(diagram.getElementsByTagName("object"))) {
    if (o.getAttribute("type") !== "idlabel") continue;
    const parent = o.getElementsByTagName("mxCell")[0]?.getAttribute("parent") ?? "";
    out.set(parent, (o.getAttribute("label") ?? "").replace(/<[^>]+>/g, ""));
  }
  return out;
}

describe("lockedPageIdsOf", () => {
  it("the pages that decompose the given multiprocesses", () => {
    const pages = [
      { pageId: "top", name: "Top", order: 0 },
      { pageId: "a", name: "A", decomposes: "mpA", order: 0 },
      { pageId: "b", name: "B", decomposes: "mpB", order: 1 },
    ];
    expect([...lockedPageIdsOf(pages, ["mpA"])]).toEqual(["a"]);
    expect(lockedPageIdsOf(pages, undefined).size).toBe(0);
    expect(lockedPageIdsOf(undefined, ["mpA"]).size).toBe(0);
  });
});

describe("renumber with a locked component page", () => {
  const locked = lockedPageIdsOf(inserted.pages, [inserted.multiprocessTfId]);
  const numbered = new DFDAutoNumbering().autoNumber(inserted.xml, inserted.pages, undefined, locked);

  it("the component page is locked", () => {
    expect([...locked]).toEqual([inserted.childPageId]);
  });

  it("the machine's elements, the multiprocess and the boundary flows get numbers", () => {
    const top = labels(numbered, "top");
    expect(top.get("m_plc")).toMatch(/^EE-\d+$/);
    expect(top.get("m_p1")).toMatch(/^P-\d+$/);
    expect(top.get(inserted.multiprocessTfId)).toMatch(/^MP-\d+$/);
    const boundaryFlowLabels = [...top.entries()].filter(([id]) => inserted.connections.some((c) => c.id === id)).map(([, l]) => l);
    expect(boundaryFlowLabels.length).toBeGreaterThan(0);
    for (const l of boundaryFlowLabels) expect(l).toMatch(/^DF-\d+$/);
  });

  it("the component's ids keep their prefix", () => {
    const child = labels(numbered, inserted.childPageId);
    const before = labels(inserted.xml, inserted.childPageId);
    const prefixed = [...before.entries()].filter(([, l]) => l.startsWith("SD1:"));
    expect(prefixed.length).toBeGreaterThan(10);
    for (const [id, l] of prefixed) expect(child.get(id)).toBe(l);
  });

  it("the copy of the machine element on the component page follows its definition", () => {
    const top = labels(numbered, "top");
    const child = labels(numbered, inserted.childPageId);
    const copyLabels = [...child.values()].filter((l) => l === top.get("m_plc"));
    expect(copyLabels.length).toBeGreaterThan(0);
  });

  it("without the lock the component's numbers would change", () => {
    const unlocked = new DFDAutoNumbering().autoNumber(inserted.xml, inserted.pages);
    const before = labels(inserted.xml, inserted.childPageId);
    const after = labels(unlocked, inserted.childPageId);
    expect([...before.entries()].some(([id, l]) => l.startsWith("SD1:") && after.get(id) !== l)).toBe(true);
  });
});
