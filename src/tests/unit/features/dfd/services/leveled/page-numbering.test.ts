// Leveled-DFD Phase 5l (leveled-dfd-multi-diagram-design.md §8, D19):
// renumber one page — and the pages below it, whose namespaces hang on its
// multiprocesses. Every other page keeps its numbers; copies of the
// renumbered elements elsewhere follow.
import { describe, it, expect } from "vitest";
import { DFDAutoNumbering } from "features/dfd/services/dfd-auto-numbering";
import { dfdParser } from "features/dfd/services/dfd-parser";
import type { DFDPage } from "features/dfd/models/dfd-types";
import { flow, mxfile, node, page, ref } from "../../../../../fixtures/leveled-dfd-xml";

const SYS = page(
  "sys",
  "Top",
  node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
    node("p3", "process", "Logger", "P-3", 600) +
    flow("df7", "stream", "DF-7", "mp1", "mp2"),
);
const SEN = page(
  "sen",
  "Sensor Module",
  node("sen_b", "process", "Second", "P-9", 300) + // drawn right of …
    node("sen_a", "process", "First", "P-8", 10) + // … this one
    node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 600),
);
const CTL = page(
  "ctl",
  "Controller Module",
  node("ctl_p5", "process", "Evaluate", "P-5", 300) +
    node("ctl_copy", "process", "First", "P-8", 600), // copy of sen_a
);
const PAGES: DFDPage[] = [
  { pageId: "sys", name: "Top", order: 0 },
  { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 1, links: [ref("sen_mp2", "mp2")] },
  { pageId: "ctl", name: "Controller Module", decomposes: "mp2", order: 2, links: [ref("ctl_copy", "sen_a")] },
];

/** cell id → displayId per page */
const labels = (xml: string, pages = PAGES) =>
  Object.fromEntries(
    dfdParser
      .parse(xml, pages)
      .pageCells.map((p) => [p.pageId, Object.fromEntries(p.elements.map((e) => [e.id, e.displayId]))]),
  );

const renumber = (xml: string, pageId?: string, pages = PAGES) =>
  new DFDAutoNumbering(15, "left-right").autoNumber(xml, pages, pageId);

describe("renumber one page (5l)", () => {
  const XML = mxfile(SYS, SEN, CTL);

  it("numbers the page in its namespace and leaves the other pages alone", () => {
    const after = labels(renumber(XML, "sen"));
    expect(after.sen).toEqual({ sen_a: "P-1.1", sen_b: "P-1.2", sen_mp2: "MP-2" });
    expect(after.sys).toEqual({ mp1: "MP-1", mp2: "MP-2", p3: "P-3" });
    // The controller page keeps its own numbers …
    expect(after.ctl.ctl_p5).toBe("P-5");
    // … but the copy of a renumbered element follows its definition.
    expect(after.ctl.ctl_copy).toBe("P-1.1");
  });

  it("renumbers everything for the root page", () => {
    const after = labels(renumber(XML, "sys"));
    expect(after).toEqual(labels(renumber(XML)));
    expect(after.ctl.ctl_p5).toBe("P-2.1");
  });

  it("takes the pages below along — their namespace hangs on this page", () => {
    // A multiprocess on the sensor page with a child page of its own.
    const sen = page(
      "sen",
      "Sensor Module",
      node("sen_a", "process", "First", "P-8", 10) +
        node("sen_mp9", "multiprocess", "Optics", "MP-7", 300) +
        node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 600),
    );
    const deep = page("deep", "Optics", node("deep_p", "process", "Lens", "P-4", 10));
    const pages: DFDPage[] = [
      ...PAGES,
      { pageId: "deep", name: "Optics", decomposes: "sen_mp9", order: 3 },
    ];
    const after = labels(renumber(mxfile(SYS, sen, CTL, deep), "sen", pages), pages);
    expect(after.sen.sen_mp9).toBe("MP-1.1");
    expect(after.deep.deep_p).toBe("P-1.1.1");
    expect(after.ctl.ctl_p5).toBe("P-5");
  });

  it("continues the root namespace after the numbers outside when the MP has none", () => {
    // MP-1 still has its placeholder: the sensor page numbers in the root
    // namespace — after P-3 on the top page, never colliding with it.
    const sys = SYS.replace('label="MP-1"', 'label="MP-xx"');
    const after = labels(renumber(mxfile(sys, SEN, CTL), "sen"));
    expect(after.sen.sen_a).toBe("P-6");
    expect(after.sen.sen_b).toBe("P-7");
    expect(after.sys.p3).toBe("P-3");
  });

  it("is the classic numbering for a single page", () => {
    const single = mxfile(page("p1", "Page-1", node("a", "process", "A", "P-9", 10) + node("b", "process", "B", "P-8", 300)));
    expect(new DFDAutoNumbering(15, "left-right").autoNumber(single, undefined, "p1")).toBe(
      new DFDAutoNumbering(15, "left-right").autoNumber(single),
    );
  });
});
