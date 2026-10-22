// Leveled-DFD Phase 7a/7b: the DFD chapter of a leveled DFD has one section
// per page in page-tree order — heading, figure, the elements defined there.
import { describe, it, expect } from "vitest";
import { reportPagesOf } from "features/dfd/services/leveled/report-pages";
import { dfdPageSectionsOf } from "features/documentation/utils/dfd-page-sections";
import type { DFDConnection, DFDElement, DFDPage } from "features/dfd/models/dfd-types";
import fixture from "../../../fixtures/leveled/smoke-detector-leveled.json";

const IMG = (s: string) => `data:image/svg+xml;base64,${btoa(s)}`;
const elements = fixture.leveledElements as unknown as DFDElement[];

const leveled = (thumbnails: Record<string, string> = {}, rootThumbnail?: string, extra: DFDElement[] = []) => ({
  xml: fixture.leveledXml,
  pages: (fixture.pages as DFDPage[]).map((p) =>
    thumbnails[p.pageId] ? { ...p, thumbnail: thumbnails[p.pageId] } : p,
  ),
  elements: [...elements, ...extra],
  connections: fixture.connections as unknown as DFDConnection[],
  ...(rootThumbnail ? { thumbnail: rootThumbnail } : {}),
});
const ids = (list: DFDElement[]) => list.map((e) => e.displayId);

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
    expect(reportPagesOf(leveled({}, IMG("root")))!.map((p) => p.image)).toEqual([IMG("root"), undefined, undefined]);
  });

  it("is undefined for a classic DFD", () => {
    expect(reportPagesOf({ xml: fixture.singlePageXml, thumbnail: IMG("x") })).toBeUndefined();
    expect(reportPagesOf(null)).toBeUndefined();
  });
});

describe("dfdPageSectionsOf", () => {
  it("has one section per page: title, image, the elements defined there", () => {
    const sections = dfdPageSectionsOf(leveled({ sys: IMG("top"), sen: IMG("sen") }), "en")!;
    expect(sections.map((s) => [s.title, s.isPage, s.image])).toEqual([
      ['Page "Top"', true, IMG("top")],
      ['Page "Sensor Head" (decomposes MP-1 Sensor Head)', true, IMG("sen")],
      ['Page "Smoke Detector Controller" (decomposes MP-2 Smoke Detector Controller)', true, undefined],
    ]);
    expect(ids(sections[0].elements)).toEqual(expect.arrayContaining(["EE-1", "MP-1", "MP-2", "SB"]));
    expect(ids(sections[1].elements)).toEqual(expect.arrayContaining(["P-1", "DS-1", "IF-1"]));
    expect(ids(sections[1].elements)).not.toContain("EE-1"); // a context copy there, defined on Top
    expect(sections.flatMap((s) => s.elements)).toHaveLength(elements.length);
  });

  it("keeps the record order within a page, as in the classic overview", () => {
    const order = elements.map((e) => e.id);
    for (const s of dfdPageSectionsOf(leveled(), "en")!) {
      const at = s.elements.map((e) => order.indexOf(e.id));
      expect([...at].sort((a, b) => a - b)).toEqual(at);
    }
  });

  it("closes with the records on no page, and speaks German", () => {
    const orphan = { id: "gone", displayId: "P-99", name: "Gone", type: "Process" } as DFDElement;
    const sections = dfdPageSectionsOf(leveled({}, undefined, [orphan]), "de")!;
    expect(sections.at(-1)).toEqual({ title: "Auf keiner Seite", isPage: false, elements: [orphan] });
    expect(sections[1].title).toBe("Seite „Sensor Head“ (zerlegt MP-1 Sensor Head)");
  });

  it("is undefined for a classic DFD", () => {
    expect(dfdPageSectionsOf({ xml: fixture.singlePageXml, elements }, "en")).toBeUndefined();
  });
});
