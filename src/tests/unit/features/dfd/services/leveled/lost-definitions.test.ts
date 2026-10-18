// Leveled-DFD Phase 5k — a linked definition cell deleted and drawn again
// (design §5.2 lifecycle): the old record is gone unless the analyst
// re-attaches it to the new cell.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { findLostDefinitions, reattachDefinition } from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
import { mxfile, node, page, ref } from "../../../../../fixtures/leveled-dfd-xml";

const SEN_EMPTY = page("sen", "Sensor Module", "");
const PAGES_BEFORE: DFDPage[] = [
  {
    pageId: "sys",
    name: "Top",
    order: 0,
    // "Logger" was adopted / moved: its identity differs from its cell id.
    links: [{ cellId: "cx", tfId: "tx", role: "definition" }],
  },
  { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 1 },
];
const PAGES_AFTER: DFDPage[] = [{ ...PAGES_BEFORE[0], links: [] }, PAGES_BEFORE[1]];

const state = (xml: string, pages: DFDPage[]) => {
  const { elements, connections } = dfdParser.parse(xml, pages);
  // The stored record carries properties the parser does not know.
  return {
    xml,
    pages,
    elements: elements.map((e) =>
      e.id === "tx" ? { ...e, properties: { notes: "important" }, assetRelations: [] } : e,
    ),
    connections,
  } as never;
};

const MP1 = node("mp1", "multiprocess", "Sensor Module", "MP-1", 600);
const BEFORE_XML = mxfile(page("sys", "Top", MP1 + node("cx", "process", "Logger", "P-3", 10)), SEN_EMPTY);

describe("findLostDefinitions", () => {
  it("reports a linked definition whose cell was redrawn, with the new cell as candidate", () => {
    const afterXml = mxfile(
      page("sys", "Top", MP1 + node("cy", "process", "Logger", "P-3", 10) + node("cz", "process", "Other", "P-4", 300)),
      SEN_EMPTY,
    );
    const lost = findLostDefinitions(
      state(BEFORE_XML, PAGES_BEFORE),
      state(afterXml, PAGES_AFTER),
      dfdParser.parse(afterXml, PAGES_AFTER),
    );
    expect(lost).toHaveLength(1);
    expect(lost[0]).toMatchObject({
      kind: "element",
      tfId: "tx",
      label: "P-3 Logger",
      type: "Process",
      pageId: "sys",
      pageName: "Top",
      // Same displayId first.
      candidates: [
        { cellId: "cy", label: "P-3 Logger" },
        { cellId: "cz", label: "P-4 Other" },
      ],
    });
    expect((lost[0].record as { properties: unknown }).properties).toEqual({ notes: "important" });
  });

  it("does not report it while a context copy keeps the element (dangling instead)", () => {
    const afterXml = mxfile(
      page("sys", "Top", MP1),
      page("sen", "Sensor Module", node("sen_x", "process", "Logger", "P-3", 10)),
    );
    const pagesAfter: DFDPage[] = [PAGES_AFTER[0], { ...PAGES_BEFORE[1], links: [ref("sen_x", "tx")] }];
    expect(
      findLostDefinitions(
        state(BEFORE_XML, PAGES_BEFORE),
        state(afterXml, pagesAfter),
        dfdParser.parse(afterXml, pagesAfter),
      ),
    ).toEqual([]);
  });

  it("does not report a plain cell drawn again — a new element as in a classic DFD", () => {
    const before = mxfile(page("sys", "Top", MP1 + node("pa", "process", "Plain", "P-5", 10)), SEN_EMPTY);
    const after = mxfile(page("sys", "Top", MP1 + node("pb", "process", "Plain", "P-5", 10)), SEN_EMPTY);
    const pages: DFDPage[] = [{ ...PAGES_BEFORE[0], links: [] }, PAGES_BEFORE[1]];
    expect(
      findLostDefinitions(state(before, pages), state(after, pages), dfdParser.parse(after, pages)),
    ).toEqual([]);
  });

  it("does not report a definition whose cell is still there", () => {
    expect(
      findLostDefinitions(
        state(BEFORE_XML, PAGES_BEFORE),
        state(BEFORE_XML, PAGES_BEFORE),
        dfdParser.parse(BEFORE_XML, PAGES_BEFORE),
      ),
    ).toEqual([]);
  });
});

describe("reattachDefinition", () => {
  it("links the new cell to the old identity", () => {
    const pages = reattachDefinition(PAGES_AFTER, { tfId: "tx", pageId: "sys" }, "cy");
    expect(pages[0].links).toEqual([{ cellId: "cy", tfId: "tx", role: "definition" }]);
    const parsed = dfdParser.parse(
      mxfile(page("sys", "Top", MP1 + node("cy", "process", "Logger", "P-3", 10)), SEN_EMPTY),
      pages,
    );
    expect(parsed.elements.map((e) => e.id)).toContain("tx");
    expect(parsed.elements.map((e) => e.id)).not.toContain("cy");
  });
});
