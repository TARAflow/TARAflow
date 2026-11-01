// Horizontal autoresize of id labels: the numbering writes the XML draw.io
// loads, so the box grows there to fit the id ("DF-14", "P-1.2.3"); a box
// that is wide enough, or that the analyst made wider, stays.
import { describe, it, expect } from "vitest";
import { DFDAutoNumbering } from "features/dfd/services/dfd-auto-numbering";
import { flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const widthOf = (xml: string, id: string) =>
  Number(new RegExp(`id="${id}_id">\\s*<mxCell[^>]*>\\s*<mxGeometry width="(\\d+(?:\\.\\d+)?)"`).exec(xml)?.[1]);

describe("id label width", () => {
  it("a long id widens its box, a short one keeps the library width", () => {
    // Fifteen flows: the last one gets DF-15, wider than the 35 px box.
    const flows = Array.from({ length: 15 }, (_, i) => flow(`f${i}`, "push x [cmd]", "DF-xx", "p1", "p2")).join("");
    const xml = mxfile(page("p", "Top", node("p1", "process", "A", "P-xx", 10) + node("p2", "process", "B", "P-xx", 300) + flows));
    const out = new DFDAutoNumbering(15, "left-right").autoNumber(xml);
    expect(out).toContain("DF-15");
    const widths = Array.from({ length: 15 }, (_, i) => widthOf(out, `f${i}`));
    expect(Math.max(...widths)).toBeGreaterThan(35);
    expect(widthOf(out, "p1")).toBe(35); // "P-1" fits
  });

  it("a box already wider than needed stays", () => {
    const xml = mxfile(page("p", "Top", node("p1", "process", "A", "P-xx", 10).replace('width="35"', 'width="80"')));
    expect(widthOf(new DFDAutoNumbering(15, "left-right").autoNumber(xml), "p1")).toBe(80);
  });
});
