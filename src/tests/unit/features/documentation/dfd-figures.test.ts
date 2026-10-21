// Leveled-DFD Phase 7a (design §12.1, item 4): one report figure per page in
// page-tree order, captioned with the page and the multiprocess it
// decomposes; a classic DFD keeps its single uncaptioned figure.
import { describe, it, expect } from "vitest";
import { reportPagesOf } from "features/dfd/services/leveled/report-pages";
import { dfdFiguresOf } from "features/documentation/utils/dfd-figures";
import { dfdDecompositionOf } from "features/documentation/utils/dfd-decomposition";
import type { DFDConnection, DFDElement, DFDPage } from "features/dfd/models/dfd-types";
import fixture from "../../../fixtures/leveled/smoke-detector-leveled.json";

const IMG = (s: string) => `data:image/svg+xml;base64,${btoa(s)}`;

const leveled = (thumbnails: Record<string, string | undefined>, rootThumbnail?: string) => ({
  xml: fixture.leveledXml,
  pages: (fixture.pages as DFDPage[]).map((p) =>
    thumbnails[p.pageId] ? { ...p, thumbnail: thumbnails[p.pageId] } : p,
  ),
  elements: fixture.leveledElements as unknown as DFDElement[],
  connections: fixture.connections as unknown as DFDConnection[],
  ...(rootThumbnail ? { thumbnail: rootThumbnail } : {}),
});

describe("reportPagesOf", () => {
  it("lists the pages in tree order with depth, image and the decomposed multiprocess", () => {
    const pages = reportPagesOf(leveled({ sys: IMG("top"), sen: IMG("sen"), ctl: IMG("ctl") }))!;
    expect(pages.map((p) => [p.name, p.depth, p.decomposes])).toEqual([
      ["Top", 0, undefined],
      ["Sensor Head", 1, "MP-1 Sensor Head"],
      ["Smoke Detector Controller", 1, "MP-2 Smoke Detector Controller"],
    ]);
    expect(pages.map((p) => p.image)).toEqual([IMG("top"), IMG("sen"), IMG("ctl")]);
  });

  it("falls back to dfd.thumbnail for the root page only", () => {
    const pages = reportPagesOf(leveled({}, IMG("root")))!;
    expect(pages.map((p) => p.image)).toEqual([IMG("root"), undefined, undefined]);
  });

  it("is undefined for a classic DFD", () => {
    expect(reportPagesOf({ xml: fixture.singlePageXml, thumbnail: IMG("x") })).toBeUndefined();
    expect(reportPagesOf(null)).toBeUndefined();
  });
});

describe("dfdFiguresOf", () => {
  it("captions each page, in English and German", () => {
    const dfd = leveled({ sys: IMG("top"), sen: IMG("sen") });
    expect(dfdFiguresOf(dfd, "en").map((f) => f.caption)).toEqual([
      'Page "Top"',
      'Page "Sensor Head" (decomposes MP-1 Sensor Head)',
      'Page "Smoke Detector Controller" (decomposes MP-2 Smoke Detector Controller)',
    ]);
    expect(dfdFiguresOf(dfd, "de")[1].caption).toBe("Seite „Sensor Head“ (zerlegt MP-1 Sensor Head)");
    expect(dfdFiguresOf(dfd, "en")[2].image).toBeUndefined();
  });

  it("keeps one uncaptioned figure for a classic DFD", () => {
    expect(dfdFiguresOf({ xml: fixture.singlePageXml, thumbnail: IMG("x") }, "en")).toEqual([{ image: IMG("x") }]);
    expect(dfdFiguresOf({ xml: fixture.singlePageXml }, "en")).toEqual([{}]);
  });
});

describe("dfdDecompositionOf (7b)", () => {
  it("lists the pages as a tree with the elements defined on each", () => {
    const d = dfdDecompositionOf(leveled({}), "en")!;
    expect(d.title).toBe("Decomposition");
    expect(d.items.map((i) => i.depth)).toEqual([0, 1, 1]);
    expect(d.items[0].text).toBe(
      'Page "Top" — defined here: CB, CTE, EE-1, EE-2, EE-3, EE-4, EE-5, MP-1, MP-2, SB, SHE',
    );
    expect(d.items[1].text).toBe(
      'Page "Sensor Head" (decomposes MP-1 Sensor Head) — defined here: DS-1, DS-2, IF-1, IF-2, P-1, P-2, P-3, P-4, SMCU',
    );
    // Display order is natural: P-9 before P-10.
    expect(d.items[2].text).toContain("P-8, P-9, P-10, P-11, P-12");
  });

  it("speaks German and is absent for a classic DFD", () => {
    expect(dfdDecompositionOf(leveled({}), "de")!.items[1].text).toContain(
      "Seite „Sensor Head“ (zerlegt MP-1 Sensor Head) — hier definiert: DS-1",
    );
    expect(dfdDecompositionOf({ xml: fixture.singlePageXml }, "en")).toBeUndefined();
  });
});
