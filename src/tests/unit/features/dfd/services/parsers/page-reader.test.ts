// Leveled-DFD Phase 1.1 — page-aware reading
// (leveled-dfd-multi-diagram-design.md §5.1, §11.1).
import { describe, it, expect } from "vitest";
import { readDrawioPages } from "features/dfd/services/parsers/page-reader";

const model = (cells: string) =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;

const cellIds = (doc: Document) =>
  Array.from(doc.getElementsByTagName("mxCell")).map((c) => c.getAttribute("id"));

describe("readDrawioPages", () => {
  it("returns no pages for empty input", () => {
    expect(readDrawioPages("")).toEqual([]);
    expect(readDrawioPages(undefined)).toEqual([]);
  });

  it("treats a bare <mxGraphModel> as one page with pageId ''", () => {
    const pages = readDrawioPages(model('<mxCell id="a" vertex="1" parent="1"/>'));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ pageId: "", name: "", index: 0 });
    expect(cellIds(pages[0].doc)).toEqual(["0", "1", "a"]);
  });

  it("splits an mxfile into separate page documents", () => {
    const xml = `<mxfile>
      <diagram id="top" name="Top">${model('<mxCell id="a" vertex="1" parent="1"/>')}</diagram>
      <diagram id="sub" name="Detail">${model('<mxCell id="b" vertex="1" parent="1"/>')}</diagram>
    </mxfile>`;
    const pages = readDrawioPages(xml);
    expect(pages.map((p) => [p.pageId, p.name, p.index])).toEqual([
      ["top", "Top", 0],
      ["sub", "Detail", 1],
    ]);
    // Each page only sees its own cells — "0"/"1" repeat per page.
    expect(cellIds(pages[0].doc)).toEqual(["0", "1", "a"]);
    expect(cellIds(pages[1].doc)).toEqual(["0", "1", "b"]);
  });

  it("returns an empty model for an empty page", () => {
    const pages = readDrawioPages(
      `<mxfile><diagram id="a" name="A">${model("")}</diagram><diagram id="b" name="B"/></mxfile>`,
    );
    expect(pages).toHaveLength(2);
    expect(pages[1]).toMatchObject({ pageId: "b" });
    expect(cellIds(pages[1].doc)).toEqual(["0", "1"]);
  });

  it("throws on a compressed page instead of returning it empty", () => {
    expect(() =>
      readDrawioPages(`<mxfile><diagram id="c" name="C">7ZXBbuIwEIafJkcqJyEU</diagram></mxfile>`),
    ).toThrow(/compressed pages are not supported/);
  });
});
