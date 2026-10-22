// Leveled-DFD Phase 5i — one thumbnail per page (design §12.1, D18): only
// changed pages are exported again; dfd.thumbnail mirrors Top.
import { describe, it, expect } from "vitest";
import {
  pageFingerprints,
  pagesToExport,
  withPageThumbnails,
} from "features/dfd/services/leveled";
import { dfdPreviewPagesOf } from "shared";
import type { DFDPage } from "features/dfd/models/dfd-types";
import { mxfile, node, page } from "../../../../../fixtures/leveled-dfd-xml";

const TOP = page("sys", "Top", node("mp1", "multiprocess", "Sensor Module", "MP-1", 10));
const SEN = page("sen", "Sensor Module", node("p", "process", "Part", "P-1.1", 10));
const XML = mxfile(TOP, SEN);
const PAGES: DFDPage[] = [
  { pageId: "sys", name: "Top", order: 0 },
  { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 1 },
];

describe("pageFingerprints", () => {
  it("changes only for the page whose content changed", () => {
    const before = pageFingerprints(XML);
    const after = pageFingerprints(mxfile(TOP, SEN.replace('x="10"', 'x="99"')));
    expect(after.get("sys")).toBe(before.get("sys"));
    expect(after.get("sen")).not.toBe(before.get("sen"));
  });
});

describe("pagesToExport", () => {
  it("exports every page without thumbnail", () => {
    expect(pagesToExport(XML, PAGES, new Map())).toEqual(["sys", "sen"]);
  });

  it("exports a page whose content changed since its export, not the others", () => {
    const withThumbs = PAGES.map((p) => ({ ...p, thumbnail: "data:x" }));
    const exported = pageFingerprints(XML);
    expect(pagesToExport(XML, withThumbs, exported)).toEqual([]);
    const edited = mxfile(TOP, SEN.replace('x="10"', 'x="99"'));
    expect(pagesToExport(edited, withThumbs, exported)).toEqual(["sen"]);
  });

  it("does nothing for a classic project (one page — dfd.thumbnail as before)", () => {
    expect(pagesToExport(mxfile(TOP), [PAGES[0]], new Map())).toEqual([]);
    expect(pagesToExport(mxfile(TOP), undefined, new Map())).toEqual([]);
  });
});

describe("withPageThumbnails", () => {
  it("stores each page's thumbnail and mirrors Top in dfd.thumbnail", () => {
    const result = withPageThumbnails(PAGES, "old", { sen: "data:sen", sys: "data:top" });
    expect(result.pages?.map((p) => p.thumbnail)).toEqual(["data:top", "data:sen"]);
    expect(result.thumbnail).toBe("data:top");
  });

  it("keeps dfd.thumbnail when only a child page changed and Top has none yet", () => {
    expect(withPageThumbnails(PAGES, "old", { sen: "data:sen" }).thumbnail).toBe("old");
  });
});

describe("dfdPreviewPagesOf", () => {
  it("lists the pages Top first, Top falling back to dfd.thumbnail", () => {
    const pages = [
      { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 0, thumbnail: "data:sen" },
      { pageId: "sys", name: "Top", order: 0 },
    ];
    expect(dfdPreviewPagesOf({ pages, thumbnail: "data:top" })).toEqual([
      { pageId: "sys", name: "Top", thumbnail: "data:top" },
      { pageId: "sen", name: "Sensor Module", thumbnail: "data:sen" },
    ]);
  });

  it("is undefined for a classic DFD", () => {
    expect(dfdPreviewPagesOf({ thumbnail: "data:x" })).toBeUndefined();
    expect(dfdPreviewPagesOf({ pages: [{ pageId: "a", name: "A", order: 0 }] })).toBeUndefined();
  });
});
