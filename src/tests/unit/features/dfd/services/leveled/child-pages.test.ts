// Leveled-DFD Phase 5d — child page per new multiprocess, tab names
// (design §5.3, §12, D15–D17).
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { planPageSync, ROOT_PAGE_NAME } from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
  page,
  ref,
} from "../../../../../fixtures/leveled-dfd-xml";

const ids = () => {
  let n = 0;
  return () => `new${++n}`;
};

const plan = (
  xml: string,
  pages: DFDPage[] | undefined,
  known: string[] = [],
) =>
  planPageSync({
    parse: dfdParser.parse(xml, pages),
    pages,
    knownMultiprocesses: new Set(known),
    newPageId: ids(),
  });

describe("planPageSync — classic project", () => {
  const classic = mxfile(
    page(
      "p1",
      "Page-1",
      node("ee", "externalentity", "User", "EE-1", 10) +
        node("mp", "multiprocess", "Gateway", "MP-xx", 300),
    ),
  );

  it("does nothing for multiprocesses that existed when the DFD was opened", () => {
    expect(plan(classic, undefined, ["mp"])).toBeUndefined();
  });

  it("does nothing without a multiprocess", () => {
    const xml = mxfile(page("p1", "Page-1", node("p", "process", "A", "P-1", 10)));
    expect(plan(xml, undefined)).toBeUndefined();
  });

  it("gives a new multiprocess its child page and names the root Top", () => {
    const result = plan(classic, undefined)!;
    expect(result.create).toEqual([
      { pageId: "new1", name: "Gateway", decomposes: "mp", links: [{ pageId: "p1", cellId: "mp" }] },
    ]);
    expect(result.pages).toEqual([
      { pageId: "p1", name: ROOT_PAGE_NAME, order: 0 },
      { pageId: "new1", name: "Gateway", decomposes: "mp", order: 1 },
    ]);
    expect(result.rename).toEqual([{ pageId: "p1", name: "Top" }]);
  });
});

describe("planPageSync — leveled project", () => {
  it("is stable for the leveled excerpt (root renamed once to Top)", () => {
    const result = plan(mxfile(SYSTEM, SENSOR, CONTROLLER), LEVELED_PAGES, ["mp1", "mp2"])!;
    expect(result.create).toEqual([]);
    expect(result.rename).toEqual([{ pageId: "sys", name: "Top" }]);
    // After the rename the XML says Top: nothing left to do.
    const renamed = mxfile(SYSTEM.replace('name="System"', 'name="Top"'), SENSOR, CONTROLLER);
    expect(plan(renamed, result.pages, ["mp1", "mp2"])).toBeUndefined();
  });

  it("links every occurrence of the new multiprocess, a nested MP included", () => {
    const sen = page(
      "sen",
      "Sensor Module",
      node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10) +
        node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500) +
        node("sen_mp3", "multiprocess", "Optics", "MP-1.1", 800),
    );
    const ctl = page(
      "ctl",
      "Controller Module",
      node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300) +
        node("ctl_mp3", "multiprocess", "Optics", "MP-1.1", 600),
    );
    const pages = LEVELED_PAGES.map((p) =>
      p.pageId === "ctl" ? { ...p, links: [...(p.links ?? []), ref("ctl_mp3", "sen_mp3")] } : p,
    );
    const result = plan(mxfile(SYSTEM, sen, ctl), pages, ["mp1", "mp2"])!;
    expect(result.create).toEqual([
      {
        pageId: "new1",
        name: "Optics",
        decomposes: "sen_mp3",
        links: [
          { pageId: "sen", cellId: "sen_mp3" },
          { pageId: "ctl", cellId: "ctl_mp3" },
        ],
      },
    ]);
    expect(result.pages.at(-1)).toEqual({
      pageId: "new1",
      name: "Optics",
      decomposes: "sen_mp3",
      order: 2,
    });
  });

  it("lets the tab name follow a renamed multiprocess (D16)", () => {
    const sys = SYSTEM.replace('label="Sensor Module" type="multiprocess"', 'label="Sensor Head" type="multiprocess"');
    const top = sys.replace('name="System"', 'name="Top"');
    const pages = LEVELED_PAGES.map((p) => (p.pageId === "sys" ? { ...p, name: "Top" } : p));
    const result = plan(mxfile(top, SENSOR, CONTROLLER), pages, ["mp1", "mp2"])!;
    expect(result.rename).toEqual([{ pageId: "sen", name: "Sensor Head" }]);
    expect(result.pages.find((p) => p.pageId === "sen")?.name).toBe("Sensor Head");
  });

  it("leaves a pasted copy of an existing multiprocess to the copy assignment", () => {
    const ctl = page(
      "ctl",
      "Controller Module",
      node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300) +
        node("ctl_paste", "multiprocess", "Controller Module", "MP-2", 600),
    );
    const top = SYSTEM.replace('name="System"', 'name="Top"');
    expect(plan(mxfile(top, SENSOR, ctl), LEVELED_PAGES, ["mp1", "mp2"])?.create ?? []).toEqual([]);
  });
});
