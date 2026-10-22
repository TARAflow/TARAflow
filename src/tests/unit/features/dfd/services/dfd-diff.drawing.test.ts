// Leveled-DFD §11.3 — the drawing: pages added / removed (structural),
// renamed (graphical), a definition moved (semantic), a cell's identity
// changed (identity), context copies and layout per page (graphical).
// §14 "Diff and audit": a page deletion and a definition move are traceable.
import { describe, it, expect } from "vitest";
import { diffDfd, type DfdChange } from "features/dfd/services/dfd-diff";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { makeDefinition } from "features/dfd/services/leveled/identity-links";
import type { DFDPage } from "features/dfd/models/dfd-types";
import { CONTROLLER, LEVELED_PAGES, SENSOR, SYSTEM, mxfile, node, page, ref } from "../../../../fixtures/leveled-dfd-xml";

const dfdOf = (xml: string, pages: DFDPage[] | undefined) => {
  const { elements, connections } = dfdParser.parse(xml, pages);
  return { xml, pages, elements, connections };
};
const BEFORE = dfdOf(mxfile(SYSTEM, SENSOR, CONTROLLER), LEVELED_PAGES);
const drawing = (changes: DfdChange[]) => changes.filter((c) => c.subject !== "element" && c.subject !== "flow");
const brief = (c: DfdChange) => `${c.kind} ${c.category} ${c.displayId}: ${c.name}`;

describe("diffDfd — the drawing of a leveled DFD", () => {
  it("nothing changed, nothing reported", () => {
    expect(diffDfd(BEFORE, dfdOf(mxfile(SYSTEM, SENSOR, CONTROLLER), LEVELED_PAGES))).toEqual([]);
  });

  it("a page deleted: structural, with the multiprocess it decomposed — its copies not listed again", () => {
    const pages = LEVELED_PAGES.filter((p) => p.pageId !== "ctl");
    const changes = drawing(diffDfd(BEFORE, dfdOf(mxfile(SYSTEM, SENSOR), pages)));
    expect(changes.map(brief)).toEqual(["removed structural Page: Controller Module (decomposes MP-2)"]);
  });

  it("a page added: structural", () => {
    const pages = LEVELED_PAGES.filter((p) => p.pageId !== "ctl");
    const changes = drawing(diffDfd(dfdOf(mxfile(SYSTEM, SENSOR), pages), BEFORE));
    expect(changes.map(brief)).toEqual(["added structural Page: Controller Module (decomposes MP-2)"]);
  });

  it("a page renamed: graphical", () => {
    const after = dfdOf(mxfile(SYSTEM, SENSOR, CONTROLLER.replace('name="Controller Module"', 'name="Controller"')), LEVELED_PAGES);
    const [change] = drawing(diffDfd(BEFORE, after));
    expect(brief(change)).toBe("modified graphical Page: Controller (decomposes MP-2)");
    expect(change.fields).toEqual([{ field: "name", before: "Controller Module", after: "Controller" }]);
  });

  it("a definition moved to another page: semantic, with both pages", () => {
    const occurrences = dfdParser.parse(BEFORE.xml, LEVELED_PAGES).occurrences;
    const moved = makeDefinition(LEVELED_PAGES, occurrences, { pageId: "sen", cellId: "sen_mp2" });
    if (!moved.ok) throw new Error(moved.reason);
    const changes = drawing(diffDfd(BEFORE, dfdOf(BEFORE.xml, moved.pages)));
    const definition = changes.find((c) => c.subject === "definition")!;
    expect(brief(definition)).toBe("modified semantic MP-2: Controller Module");
    expect(definition.fields).toEqual([{ field: "home page", before: "System", after: "Sensor Module" }]);
  });

  it("a cell linked to another element: an identity change", () => {
    const pages = LEVELED_PAGES.map((p) => (p.pageId === "sen" ? { ...p, links: [ref("sen_mp2", "mp1"), ref("sen_df7", "df7")] } : p));
    const identity = drawing(diffDfd(BEFORE, dfdOf(BEFORE.xml, pages))).find((c) => c.subject === "identity")!;
    expect(identity).toMatchObject({ category: "identity", name: "cell sen_mp2 on Sensor Module" });
    expect(identity.fields).toEqual([{ field: "shows", before: "MP-2", after: "MP-1" }]);
  });

  it("a context copy added: graphical, per page", () => {
    const sen = SENSOR.replace("</root>", node("sen_mp1", "multiprocess", "Sensor Module", "MP-1", 800) + "</root>");
    const pages = LEVELED_PAGES.map((p) =>
      p.pageId === "sen" ? { ...p, links: [...(p.links ?? []), ref("sen_mp1", "mp1")] } : p,
    );
    const changes = drawing(diffDfd(BEFORE, dfdOf(mxfile(SYSTEM, sen, CONTROLLER), pages)));
    expect(changes.map(brief)).toEqual(["modified graphical Context copies: Sensor Module"]);
    expect(changes[0].fields).toEqual([{ field: "added", before: undefined, after: "MP-1" }]);
  });

  it("an element moved: graphical layout, per page", () => {
    const sys = SYSTEM.replace(/(id="mp1">\s*<mxCell[^>]*>\s*<mxGeometry x=")10"/, '$1250"');
    expect(sys).not.toBe(SYSTEM);
    const changes = drawing(diffDfd(BEFORE, dfdOf(mxfile(sys, SENSOR, CONTROLLER), LEVELED_PAGES)));
    expect(changes.map(brief)).toEqual(["modified graphical Layout: System"]);
    expect(changes[0].fields).toEqual([{ field: "moved or resized", before: undefined, after: "MP-1" }]);
  });
});

describe("diffDfd — the drawing of a classic DFD", () => {
  it("reports the layout of the one page", () => {
    const one = (x: number) => mxfile(page("p1", "Page-1", node("a", "process", "A", "P-1", x)));
    const changes = diffDfd(dfdOf(one(10), undefined), dfdOf(one(90), undefined));
    expect(changes.map(brief)).toEqual(["modified graphical Layout: Page-1"]);
  });
});
