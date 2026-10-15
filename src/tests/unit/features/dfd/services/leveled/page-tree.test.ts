// Leveled-DFD Phase 1.3 — page tree, home pages (design §5.3, §5.4).
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { buildPageTree, computeHomePages } from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
  page,
  ref,
  LEVELED_PAGES,
} from "../../../../../fixtures/leveled-dfd-xml";

function tree(xml: string, persistedPages?: DFDPage[]) {
  const parsed = dfdParser.parse(xml, persistedPages);
  const homePages = computeHomePages(parsed.occurrences);
  return {
    homePages,
    tree: buildPageTree({
      parsedPages: parsed.pages,
      persistedPages,
      elements: parsed.elements,
      occurrences: parsed.occurrences,
      homePages,
    }),
  };
}

const LEVELED = LEVELED_PAGES;

describe("computeHomePages", () => {
  it("is the page of the definition cell, never of a copy", () => {
    const { homePages } = tree(mxfile(SYSTEM, SENSOR, CONTROLLER), LEVELED);
    expect(Object.fromEntries(homePages.elements)).toEqual({
      mp1: "sys",
      mp2: "sys",
      sen_p2: "sen",
      ctl_p5: "ctl",
    });
    expect(Object.fromEntries(homePages.connections)).toEqual({ df7: "sys" });
  });

  it("does not depend on page order", () => {
    const { homePages } = tree(mxfile(SENSOR, CONTROLLER, SYSTEM), LEVELED);
    expect(homePages.elements.get("mp2")).toBe("sys");
  });

  it("has no home page for an element with context copies only", () => {
    const { homePages } = tree(mxfile(SENSOR), LEVELED);
    expect(homePages.elements.has("mp2")).toBe(false);
    expect(homePages.connections.has("df7")).toBe(false);
  });
});

describe("buildPageTree — classic projects", () => {
  it("treats the only page as implicit root without dfd.pages", () => {
    const { tree: t } = tree(mxfile(SYSTEM));
    expect(t.rootPageId).toBe("sys");
    expect(t.pages).toEqual([{ pageId: "sys", name: "System", order: 0 }]);
    expect(t.depthOf.get("sys")).toBe(0);
    expect(t.issues).toEqual([]);
  });

  it("is empty for empty XML", () => {
    const { tree: t } = tree("");
    expect(t.pages).toEqual([]);
    expect(t.rootPageId).toBeUndefined();
    expect(t.issues).toEqual([]);
  });

  it("marks further pages as unassigned without dfd.pages (adoption pending)", () => {
    const { tree: t } = tree(mxfile(SYSTEM, SENSOR, CONTROLLER));
    expect(t.rootPageId).toBe("sys");
    expect(t.issues).toEqual([
      { code: "PAGE_UNASSIGNED", pageId: "sen" },
      { code: "PAGE_UNASSIGNED", pageId: "ctl" },
    ]);
  });
});

describe("buildPageTree — leveled Smoke Detector", () => {
  const { tree: t } = tree(mxfile(SYSTEM, SENSOR, CONTROLLER), LEVELED);

  it("derives parent pages from the home page of the decomposed MP", () => {
    expect(Object.fromEntries(t.parentOf)).toEqual({ sen: "sys", ctl: "sys" });
    expect(Object.fromEntries(t.childPageOf)).toEqual({
      mp1: "sen",
      mp2: "ctl",
    });
  });

  it("derives depth and tree order", () => {
    expect(Object.fromEntries(t.depthOf)).toEqual({ sys: 0, sen: 1, ctl: 1 });
    expect(t.pages.map((p) => p.pageId)).toEqual(["sys", "sen", "ctl"]);
    expect(t.issues).toEqual([]);
  });

  it("orders siblings by `order`, not by document order", () => {
    const swapped = LEVELED.map((p) =>
      p.pageId === "sen" ? { ...p, order: 2 } : p,
    );
    const { tree: s } = tree(mxfile(SYSTEM, SENSOR, CONTROLLER), swapped);
    expect(s.pages.map((p) => p.pageId)).toEqual(["sys", "ctl", "sen"]);
  });

  it("nests depth-first: a page decomposing an MP of a child page", () => {
    const sensorWithMp = page(
      "sen",
      "Sensor Module",
      node("sen_mp3", "multiprocess", "Signal Chain", "MP-3", 10),
    );
    const signal = page(
      "sig",
      "Signal Chain",
      node("sig_p7", "process", "Filter Signal", "P-7", 10),
    );
    const { tree: n } = tree(mxfile(SYSTEM, sensorWithMp, CONTROLLER, signal), [
      ...LEVELED,
      { pageId: "sig", name: "Signal Chain", decomposes: "sen_mp3", order: 0 },
    ]);
    expect(n.pages.map((p) => p.pageId)).toEqual(["sys", "sen", "sig", "ctl"]);
    expect(n.depthOf.get("sig")).toBe(2);
    expect(n.parentOf.get("sig")).toBe("sen");
  });

  it("takes page names from the XML", () => {
    const renamed = LEVELED.map((p) => ({ ...p, name: "stale" }));
    const { tree: r } = tree(mxfile(SYSTEM, SENSOR, CONTROLLER), renamed);
    expect(r.pages.map((p) => p.name)).toEqual([
      "System",
      "Sensor Module",
      "Controller Module",
    ]);
  });
});

describe("buildPageTree — inconsistencies are reported, never repaired", () => {
  it("reports pages missing in the XML and pages missing in dfd.pages", () => {
    const { tree: t } = tree(mxfile(SYSTEM, CONTROLLER), [
      LEVELED[0],
      LEVELED[1],
    ]);
    expect(t.issues).toEqual([
      { code: "PAGE_MISSING", pageId: "sen" },
      { code: "PAGE_UNASSIGNED", pageId: "ctl" },
    ]);
    expect(t.pages.map((p) => p.pageId)).toEqual(["sys"]);
  });

  it("reports unknown and non-multiprocess decompositions", () => {
    const { tree: t } = tree(mxfile(SYSTEM, SENSOR, CONTROLLER), [
      LEVELED[0],
      { pageId: "sen", name: "", decomposes: "nope", order: 0 },
      { pageId: "ctl", name: "", decomposes: "sen_p2", order: 1 },
    ]);
    expect(t.issues).toEqual([
      { code: "PAGE_DECOMPOSES_UNKNOWN", pageId: "sen", tfId: "nope" },
      {
        code: "PAGE_DECOMPOSES_NOT_MULTIPROCESS",
        pageId: "ctl",
        tfId: "sen_p2",
      },
    ]);
    expect(t.depthOf.has("sen")).toBe(false);
  });

  it("reports an MP decomposed by two pages", () => {
    const { tree: t } = tree(mxfile(SYSTEM, SENSOR, CONTROLLER), [
      LEVELED[0],
      LEVELED[1],
      { ...LEVELED[2], decomposes: "mp1" },
    ]);
    expect(t.issues).toContainEqual({
      code: "PAGE_DECOMPOSED_TWICE",
      tfId: "mp1",
      pageIds: ["sen", "ctl"],
    });
  });

  it("reports a decomposed MP drawn on its own child page", () => {
    const sensorWithSelf = page(
      "sen",
      "Sensor Module",
      node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10) +
        node("sen_mp1", "multiprocess", "Sensor Module", "MP-1", 300),
    );
    const pages = LEVELED.map((p) =>
      p.pageId === "sen" ? { ...p, links: [ref("sen_mp1", "mp1")] } : p,
    );
    const { tree: t } = tree(mxfile(SYSTEM, sensorWithSelf, CONTROLLER), pages);
    expect(t.issues).toEqual([
      { code: "BAL_DECOMPOSED_ON_OWN_PAGE", pageId: "sen", tfId: "mp1" },
    ]);
  });

  it("cannot place a page whose decomposed MP is dangling", () => {
    // SYSTEM missing: mp2 exists only as a copy on Sensor Module
    const { tree: t } = tree(mxfile(SENSOR, CONTROLLER), [
      { ...LEVELED[1], decomposes: undefined },
      LEVELED[2],
    ]);
    expect(t.issues).toEqual([
      { code: "PAGE_PARENT_UNRESOLVED", pageId: "ctl", tfId: "mp2" },
    ]);
    expect(t.depthOf.has("ctl")).toBe(false);
  });

  it("reports a cycle: MP defined on its own child page", () => {
    const loop = page(
      "loop",
      "Loop",
      node("loop_mp", "multiprocess", "Self", "MP-9", 10),
    );
    const { tree: t } = tree(mxfile(SYSTEM, loop), [
      LEVELED[0],
      { pageId: "loop", name: "", decomposes: "loop_mp", order: 0 },
    ]);
    expect(t.issues).toEqual([
      { code: "BAL_DECOMPOSED_ON_OWN_PAGE", pageId: "loop", tfId: "loop_mp" },
      { code: "PAGE_CYCLE", pageIds: ["loop"] },
    ]);
    expect(t.pages.map((p) => p.pageId)).toEqual(["sys"]);
  });

  it("reports a missing root", () => {
    const { tree: t } = tree(mxfile(SYSTEM, SENSOR), [
      { pageId: "sys", name: "", decomposes: "mp2", order: 0 },
      { pageId: "sen", name: "", decomposes: "mp1", order: 0 },
    ]);
    expect(t.issues).toContainEqual({ code: "PAGE_NO_ROOT" });
    expect(t.rootPageId).toBeUndefined();
    expect(t.pages).toEqual([]);
  });

  it("reports several roots and keeps the first by order", () => {
    const { tree: t } = tree(mxfile(SYSTEM, SENSOR), [
      { pageId: "sen", name: "", order: 1 },
      { pageId: "sys", name: "", order: 0 },
    ]);
    expect(t.rootPageId).toBe("sys");
    expect(t.issues).toEqual([
      { code: "PAGE_MULTIPLE_ROOTS", pageIds: ["sys", "sen"] },
    ]);
  });
});
