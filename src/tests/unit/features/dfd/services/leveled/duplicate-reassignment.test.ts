// Leveled-DFD Phase 3.3 (leveled-dfd-multi-diagram-design.md §5.2, D8):
// a duplicated definition (draw.io "Duplicate page" keeps the cell ids) gets
// a fresh identity on save — "paste = new element", never merged.
import { describe, it, expect } from "vitest";
import { reassignDuplicateDefinitions } from "features/dfd/services/leveled";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { dfdService } from "features/dfd/services/dfd-service";
import type { DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";

const shape = (type: string, id: string, y: number) =>
  `<object label="${id}" type="${type}" id="${id}">` +
  `<mxCell style="ellipse;" vertex="1" parent="1">` +
  `<mxGeometry x="100" y="${y}" width="80" height="80" as="geometry"/></mxCell></object>`;
const flow = (id: string, from: string, to: string) =>
  `<object label="${id}" type="DataFlow" id="${id}">` +
  `<mxCell style="endArrow=classic;" edge="1" parent="1" source="${from}" target="${to}">` +
  `<mxGeometry relative="1" as="geometry"/></mxCell></object>`;
const page = (id: string, cells: string) =>
  `<diagram id="${id}" name="${id}"><mxGraphModel><root>` +
  `<mxCell id="0"/><mxCell id="1" parent="0"/>${cells}` +
  `</root></mxGraphModel></diagram>`;
const mxfile = (...pages: string[]) => `<mxfile>${pages.join("")}</mxfile>`;

// Top: multiprocess m, process a1, process a2, flow f1 a1 → a2.
// pm (details m): its own process b1 — and, in the "after" state, a1, a2
// and f1 again with the SAME cell ids (pasted from a duplicated page).
const top = page(
  "top",
  shape("Multiprocess", "m", 10) +
    shape("Process", "a1", 100) +
    shape("Process", "a2", 200) +
    flow("f1", "a1", "a2"),
);
const before = mxfile(top, page("pm", shape("Process", "b1", 50)));
const after = mxfile(
  top,
  page(
    "pm",
    shape("Process", "b1", 50) +
      shape("Process", "a1", 100) +
      shape("Process", "a2", 200) +
      flow("f1", "a1", "a2"),
  ),
);
const pages: DFDPage[] = [
  { pageId: "top", name: "Top", order: 0 },
  { pageId: "pm", name: "m", order: 0, decomposes: "m" },
];

describe("reassignDuplicateDefinitions", () => {
  it("gives the cells that are new since the last save a fresh identity", () => {
    const result = reassignDuplicateDefinitions({
      xml: after,
      pages,
      previousXml: before,
      previousPages: pages,
    });
    expect(result.reassigned.map((r) => [r.pageId, r.cellId, r.tfId])).toEqual([
      ["pm", "a1", "pm:a1"],
      ["pm", "a2", "pm:a2"],
      ["pm", "f1", "pm:f1"],
    ]);
    expect(result.pages!.find((p) => p.pageId === "pm")!.links).toEqual([
      { cellId: "a1", tfId: "pm:a1", role: "definition" },
      { cellId: "a2", tfId: "pm:a2", role: "definition" },
      { cellId: "f1", tfId: "pm:f1", role: "definition" },
    ]);
    expect(result.pages!.find((p) => p.pageId === "top")).toBe(pages[0]);
  });

  it("the copies become elements and a flow of their own — nothing merged", () => {
    const { pages: next } = reassignDuplicateDefinitions({
      xml: after,
      pages,
      previousXml: before,
      previousPages: pages,
    });
    const parse = dfdParser.parse(after, next);
    expect(parse.elements.map((e) => e.id).sort()).toEqual(
      ["a1", "a2", "b1", "m", "pm:a1", "pm:a2"].sort(),
    );
    const flows = parse.connections.map((c) => [c.id, c.from, c.to]).sort();
    expect(flows).toEqual([
      ["f1", "a1", "a2"],
      ["pm:f1", "pm:a1", "pm:a2"],
    ]);
  });

  it("without a previous state the page first in tree order keeps the identity", () => {
    const result = reassignDuplicateDefinitions({ xml: after, pages });
    expect(result.reassigned.every((r) => r.pageId === "pm")).toBe(true);
  });

  it("keeps the identity where it was saved before, even on a lower page", () => {
    // a1 existed on pm only; Top's a1 is the new one.
    const prev = mxfile(
      page("top", shape("Multiprocess", "m", 10)),
      page("pm", shape("Process", "b1", 50) + shape("Process", "a1", 100)),
    );
    const xml = mxfile(
      page("top", shape("Multiprocess", "m", 10) + shape("Process", "a1", 100)),
      page("pm", shape("Process", "b1", 50) + shape("Process", "a1", 100)),
    );
    const result = reassignDuplicateDefinitions({
      xml,
      pages,
      previousXml: prev,
      previousPages: pages,
    });
    expect(result.reassigned.map((r) => [r.pageId, r.cellId])).toEqual([
      ["top", "a1"],
    ]);
  });

  it("avoids a fresh id that is already taken", () => {
    const xml = mxfile(
      page(
        "top",
        shape("Multiprocess", "m", 10) +
          shape("Process", "a1", 100) +
          shape("Process", "pm:a1", 300),
      ),
      page("pm", shape("Process", "a1", 100)),
    );
    const result = reassignDuplicateDefinitions({ xml, pages });
    expect(result.reassigned.map((r) => r.tfId)).toEqual(["pm:a1#2"]);
  });

  it("is a no-op without duplicates, for one page and for classic projects", () => {
    expect(
      reassignDuplicateDefinitions({ xml: before, pages, previousXml: before })
        .pages,
    ).toBe(pages);
    const one = [pages[0]];
    expect(
      reassignDuplicateDefinitions({ xml: before, pages: one }).pages,
    ).toBe(one);
    expect(
      reassignDuplicateDefinitions({ xml: before, pages: undefined }).pages,
    ).toBeUndefined();
  });

  it("is stable: the next save keeps the links and reassigns nothing", () => {
    const first = reassignDuplicateDefinitions({
      xml: after,
      pages,
      previousXml: before,
      previousPages: pages,
    });
    const second = reassignDuplicateDefinitions({
      xml: after,
      pages: first.pages,
      previousXml: after,
      previousPages: first.pages,
    });
    expect(second.reassigned).toEqual([]);
    expect(second.pages).toBe(first.pages);
  });
});

describe("save path applies the reassignment (dfd-service)", () => {
  const project = {
    id: "p",
    name: "dup",
    dfd: { xml: before, elements: [], connections: [], assets: [], pages },
    phaseStatus: {},
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: "",
  } as unknown as DFDProjectData;

  it("saveDFDFromXml persists the fresh identities and the new records", () => {
    const result = dfdService.saveDFDFromXml(project, after);
    expect(result.success).toBe(true);
    expect(
      result.dfd.pages!.find((p) => p.pageId === "pm")!.links,
    ).toHaveLength(3);
    expect(result.dfd.elements.map((e) => e.id)).toEqual(
      expect.arrayContaining(["pm:a1", "pm:a2"]),
    );
    expect(result.dfd.connections.map((c) => c.id)).toEqual(
      expect.arrayContaining(["f1", "pm:f1"]),
    );
  });
});
