// Leveled-DFD Phase 7b: the element overview of a leveled DFD as one table
// per page — each element once, on the page its definition is on.
import { describe, it, expect } from "vitest";
import { elementsByPageOf } from "features/documentation/utils/dfd-element-pages";
import type { DFDConnection, DFDElement, DFDPage } from "features/dfd/models/dfd-types";
import fixture from "../../../fixtures/leveled/smoke-detector-leveled.json";

const elements = fixture.leveledElements as unknown as DFDElement[];
const leveled = (extra: DFDElement[] = []) => ({
  xml: fixture.leveledXml,
  pages: fixture.pages as DFDPage[],
  elements: [...elements, ...extra],
  connections: fixture.connections as unknown as DFDConnection[],
});
const ids = (list: DFDElement[]) => list.map((e) => e.displayId);

describe("elementsByPageOf", () => {
  it("groups the elements by the page of their definition, in page-tree order", () => {
    const groups = elementsByPageOf(leveled(), "en")!;
    expect(groups.map((g) => g.title)).toEqual([
      'Page "Top"',
      'Page "Sensor Head" (decomposes MP-1 Sensor Head)',
      'Page "Smoke Detector Controller" (decomposes MP-2 Smoke Detector Controller)',
    ]);
    expect(ids(groups[0].elements)).toEqual(expect.arrayContaining(["EE-1", "MP-1", "MP-2", "SB"]));
    expect(ids(groups[1].elements)).toEqual(expect.arrayContaining(["P-1", "DS-1", "IF-1"]));
    expect(ids(groups[1].elements)).not.toContain("EE-1"); // a context copy there, defined on Top
    // Every element exactly once.
    expect(groups.flatMap((g) => g.elements)).toHaveLength(elements.length);
  });

  it("keeps the record order within a page, as in the classic overview", () => {
    const groups = elementsByPageOf(leveled(), "en")!;
    const order = elements.map((e) => e.id);
    for (const g of groups) {
      const at = g.elements.map((e) => order.indexOf(e.id));
      expect([...at].sort((a, b) => a - b)).toEqual(at);
    }
  });

  it("lists records without a drawn cell last, and speaks German", () => {
    const orphan = { id: "gone", displayId: "P-99", name: "Gone", type: "Process" } as DFDElement;
    const groups = elementsByPageOf(leveled([orphan]), "de")!;
    expect(groups.at(-1)).toEqual({ title: "Auf keiner Seite", elements: [orphan] });
    expect(groups[1].title).toBe("Seite „Sensor Head“ (zerlegt MP-1 Sensor Head)");
  });

  it("is undefined for a classic DFD", () => {
    expect(elementsByPageOf({ xml: fixture.singlePageXml, elements }, "en")).toBeUndefined();
  });
});
