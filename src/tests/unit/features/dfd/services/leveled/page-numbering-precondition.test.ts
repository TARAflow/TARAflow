// Leveled DFD §8, 5l: a child page is renumbered on its own only once the
// multiprocess it decomposes has a number — otherwise its parts would get
// flat numbers (P-5 instead of P-2.1).
import { describe, it, expect } from "vitest";
import { unnumberedDecomposedMp } from "features/dfd/services/leveled/page-numbering";
import type { DFDElement, DFDPage } from "features/dfd/models/dfd-types";

const pages: DFDPage[] = [
  { pageId: "top", name: "Top", order: 0 },
  { pageId: "ctl", name: "Controller", order: 0, decomposes: "mp2" },
];
const mp = (displayId: string) => [{ id: "mp2", name: "Controller", displayId, type: "Multiprocess" }] as DFDElement[];

describe("unnumberedDecomposedMp", () => {
  it("the multiprocess of the page while it shows the placeholder or only its name", () => {
    expect(unnumberedDecomposedMp(pages, mp("MP-xx"), "ctl")?.id).toBe("mp2");
    expect(unnumberedDecomposedMp(pages, mp("Controller"), "ctl")?.id).toBe("mp2");
  });

  it("none once it is numbered, also hierarchically", () => {
    expect(unnumberedDecomposedMp(pages, mp("MP-2"), "ctl")).toBeNull();
    expect(unnumberedDecomposedMp(pages, mp("MP-1.3"), "ctl")).toBeNull();
  });

  it("none for the root page or an unknown page", () => {
    expect(unnumberedDecomposedMp(pages, mp("MP-xx"), "top")).toBeNull();
    expect(unnumberedDecomposedMp(pages, mp("MP-xx"), null)).toBeNull();
  });
});
