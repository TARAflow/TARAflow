// Phase 0 guard of the leveled-DFD design (doc/Open/DFD/leveled-dfd-multi-diagram-design.md §13).
import { describe, it, expect } from "vitest";
import {
  inspectDrawioPages,
  describeUnsupportedPageLayout,
} from "shared/utils/drawio-page-layout";

const MODEL = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>`;

const page = (id: string, name: string, content = MODEL) =>
  `<diagram id="${id}" name="${name}">${content}</diagram>`;

describe("inspectDrawioPages", () => {
  it("treats empty / missing XML as a supported empty layout", () => {
    for (const xml of [undefined, null, "", "   "]) {
      const layout = inspectDrawioPages(xml);
      expect(layout.supported).toBe(true);
      expect(layout.pageCount).toBe(0);
    }
  });

  it("supports a bare <mxGraphModel> (no mxfile wrapper)", () => {
    const layout = inspectDrawioPages(MODEL);
    expect(layout).toEqual({
      pageCount: 0,
      pageNames: [],
      compressedPageNames: [],
      supported: true,
    });
  });

  it("supports exactly one uncompressed page", () => {
    const layout = inspectDrawioPages(`<mxfile>${page("p1", "Top")}</mxfile>`);
    expect(layout.pageCount).toBe(1);
    expect(layout.pageNames).toEqual(["Top"]);
    expect(layout.supported).toBe(true);
  });

  it("rejects several pages and reports their names in order", () => {
    const xml = `<mxfile host="x">${page("sys", "System")}
      ${page("sen", "Sensor Module")}${page("ctl", "Controller Module")}${page("dbg", "Diagnostics")}</mxfile>`;
    const layout = inspectDrawioPages(xml);
    expect(layout.pageCount).toBe(4);
    expect(layout.pageNames).toEqual([
      "System",
      "Sensor Module",
      "Controller Module",
      "Diagnostics",
    ]);
    expect(layout.compressedPageNames).toEqual([]);
    expect(layout.supported).toBe(false);
  });

  it("counts an empty second page (self-closing or blank) as a page", () => {
    const selfClosing = `<mxfile>${page("a", "A")}<diagram id="b" name="B"/></mxfile>`;
    const blank = `<mxfile>${page("a", "A")}<diagram id="b" name="B">  </diagram></mxfile>`;
    for (const xml of [selfClosing, blank]) {
      const layout = inspectDrawioPages(xml);
      expect(layout.pageCount).toBe(2);
      expect(layout.compressedPageNames).toEqual([]);
      expect(layout.supported).toBe(false);
    }
  });

  it("rejects a single compressed page", () => {
    const xml = `<mxfile><diagram id="c" name="Page-1">7ZXBbuIwEIafJkcqJyEUjiWlrbSqhMRhe7TxQKx1bOQ4BPbpd0wcKAqttFL3dnOwZv7xzPy/Ik2Q5cXh0bBN/qY5yCDpFKVBmuUUqAs1k41wb7kozk2ZLbeqkSWyYBOcBfBy</diagram></mxfile>`;
    const layout = inspectDrawioPages(xml);
    expect(layout.pageCount).toBe(1);
    expect(layout.compressedPageNames).toEqual(["Page-1"]);
    expect(layout.supported).toBe(false);
  });

  it("decodes XML entities in page names and keeps unnamed pages", () => {
    const xml = `<mxfile><diagram id="a" name="A &amp; B">${MODEL}</diagram><diagram id="b">${MODEL}</diagram></mxfile>`;
    expect(inspectDrawioPages(xml).pageNames).toEqual(["A & B", ""]);
  });

  it("does not mistake <diagram> inside an attribute value for a page", () => {
    // draw.io escapes markup inside attributes, so a literal "<diagram" can
    // only appear as an element.
    const xml = `<mxfile>${page("a", "A", `<mxGraphModel><root><object label="&lt;diagram&gt;" id="x"/></root></mxGraphModel>`)}</mxfile>`;
    expect(inspectDrawioPages(xml).pageCount).toBe(1);
  });
});

describe("describeUnsupportedPageLayout", () => {
  it("is empty for a supported layout", () => {
    expect(describeUnsupportedPageLayout(inspectDrawioPages(MODEL))).toBe("");
  });

  it("names the pages and the compressed pages", () => {
    const xml = `<mxfile>${page("a", "Top")}<diagram id="b" name="">abc</diagram></mxfile>`;
    const text = describeUnsupportedPageLayout(inspectDrawioPages(xml));
    expect(text).toContain("2 pages");
    expect(text).toContain('"Top"');
    expect(text).toContain("<unnamed>");
    expect(text).toContain("compressed");
  });
});
