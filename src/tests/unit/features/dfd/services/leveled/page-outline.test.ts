// Leveled-DFD Phase 5c — what the page tree shows (design §12, D15): tree
// order with depth, the detailed multiprocess, a decomposition not yet in
// effect, finding counts by home page, unplaced pages after the tree.
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { buildPageOutline } from "features/dfd/services/leveled";
import { usePageOutline } from "features/dfd/hooks/use-page-outline";
import type { DFDPage, ValidationFinding } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
  page,
} from "../../../../../fixtures/leveled-dfd-xml";

const XML = mxfile(SYSTEM, SENSOR, CONTROLLER);

const outline = (
  xml: string,
  pages: readonly DFDPage[] = LEVELED_PAGES,
  findings: { errors?: ValidationFinding[]; warnings?: ValidationFinding[] } = {},
) => buildPageOutline({ parse: dfdParser.parse(xml, pages), pages, ...findings });

describe("buildPageOutline", () => {
  it("lists the pages in tree order with depth and detailed multiprocess", () => {
    const { nodes, firstPageId } = outline(XML);
    expect(nodes.map((n) => [n.pageId, n.name, n.depth, n.decomposes?.label])).toEqual([
      ["sys", "System", 0, undefined],
      ["sen", "Sensor Module", 1, "MP-1 Sensor Module"],
      ["ctl", "Controller Module", 1, "MP-2 Controller Module"],
    ]);
    expect(firstPageId).toBe("sys");
    expect(nodes.every((n) => !n.pendingDecomposition)).toBe(true);
  });

  it("marks a child page without a part of its own (D15)", () => {
    // The controller page holds only the copy of MP-1: MP-2 stays a leaf.
    const copiesOnly = page(
      "ctl",
      "Controller Module",
      node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10),
    );
    const { nodes } = outline(mxfile(SYSTEM, SENSOR, copiesOnly));
    expect(nodes.find((n) => n.pageId === "ctl")?.pendingDecomposition).toBe(true);
    expect(nodes.find((n) => n.pageId === "sen")?.pendingDecomposition).toBe(false);
  });

  it("counts findings on the home page of the element or flow they name", () => {
    const { nodes } = outline(XML, LEVELED_PAGES, {
      errors: [
        { key: "e", elementId: "sen_p2" },
        { key: "e", elementId: "df7" }, // defined on System
        { key: "e" }, // no element: on no page
      ],
      warnings: [{ key: "w", elementId: "ctl_p5" }, { key: "w", elementId: "mp2" }],
    });
    expect(nodes.map((n) => [n.pageId, n.errors, n.warnings])).toEqual([
      ["sys", 1, 1],
      ["sen", 1, 0],
      ["ctl", 0, 1],
    ]);
  });

  it("lists a page the tree cannot place after the tree", () => {
    const pages: DFDPage[] = [
      ...LEVELED_PAGES,
      { pageId: "p4", name: "Page-4", order: 3 }, // a second root
    ];
    const xml = mxfile(SYSTEM, SENSOR, CONTROLLER, page("p4", "Page-4", ""));
    const { nodes } = outline(xml, pages);
    expect(nodes.map((n) => [n.pageId, n.depth])).toEqual([
      ["sys", 0],
      ["sen", 1],
      ["ctl", 1],
      ["p4", undefined],
    ]);
  });
});

describe("usePageOutline", () => {
  it("is null for a single page and while pages wait for adoption", () => {
    const single = renderHook(() => usePageOutline({ xml: mxfile(SYSTEM) }, null));
    expect(single.result.current).toBeNull();
    const unadopted = renderHook(() =>
      usePageOutline({ xml: XML, pages: LEVELED_PAGES.slice(0, 2) }, null),
    );
    expect(unadopted.result.current).toBeNull();
  });

  it("builds the outline of an adopted DFD", () => {
    const { result } = renderHook(() => usePageOutline({ xml: XML, pages: LEVELED_PAGES }, null));
    expect(result.current?.nodes.map((n) => n.pageId)).toEqual(["sys", "sen", "ctl"]);
  });
});
