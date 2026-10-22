// Leveled-DFD Phase 5a — cell ↔ tfId index for selection and navigation
// (design §5.2, §13 Phase 5 prerequisite). Cell ids are page-local; the UI
// must open the logical record of a selected copy and find the right cell
// (and page) for a record.
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { buildCellIdentityIndex, makeDefinition } from "features/dfd/services/leveled";
import { useCellIdentity } from "features/dfd/hooks/use-cell-identity";
import type { DFDPage } from "features/dfd/models/dfd-types";
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

const indexOf = (xml: string, pages: readonly DFDPage[] | undefined) =>
  buildCellIdentityIndex(pages, dfdParser.parse(xml, pages).occurrences);

describe("buildCellIdentityIndex — draw.io → TARAflow (tfIdOf)", () => {
  const index = indexOf(XML, LEVELED_PAGES);

  it("resolves a context copy to the element it shows", () => {
    expect(index.tfIdOf("sen_mp2", "sen")).toBe("mp2");
    expect(index.tfIdOf("ctl_df7", "ctl")).toBe("df7");
  });

  it("keeps the cell id for a definition without link", () => {
    expect(index.tfIdOf("sen_p2", "sen")).toBe("sen_p2");
    expect(index.tfIdOf("mp1", "sys")).toBe("mp1");
  });

  it("uses the page's links also for a cell the last parse has not seen", () => {
    const pages: DFDPage[] = LEVELED_PAGES.map((p) =>
      p.pageId === "sen"
        ? { ...p, links: [...(p.links ?? []), { cellId: "new_cell", tfId: "mp1", role: "ref" }] }
        : p,
    );
    expect(indexOf(XML, pages).tfIdOf("new_cell", "sen")).toBe("mp1");
  });

  it("does not mix up equal cell ids on different pages", () => {
    // A duplicated page keeps its cell ids: "p" on page b is a context copy
    // of "mp1", on page a it is its own definition.
    const xml = mxfile(
      page("a", "A", node("p", "process", "Alpha", "P-1", 10)),
      page("b", "B", node("p", "process", "Alpha", "P-1", 10)),
    );
    const pages: DFDPage[] = [
      { pageId: "a", name: "A", order: 0 },
      { pageId: "b", name: "B", order: 1, links: [{ cellId: "p", tfId: "b:p", role: "definition" }] },
    ];
    const index = indexOf(xml, pages);
    expect(index.tfIdOf("p", "a")).toBe("p");
    expect(index.tfIdOf("p", "b")).toBe("b:p");
    // Without a page the cell id is ambiguous → cell id, never a guess.
    expect(index.tfIdOf("p")).toBe("p");
  });

  it("without a page id resolves a cell id that is unique across pages", () => {
    expect(index.tfIdOf("sen_mp2")).toBe("mp2");
    expect(index.tfIdOf("sen_mp2", null)).toBe("mp2");
  });

  it("falls back to the cell id for unknown cells and pages", () => {
    expect(index.tfIdOf("nope")).toBe("nope");
    expect(index.tfIdOf("nope", "unknown-page")).toBe("nope");
  });
});

describe("buildCellIdentityIndex — TARAflow → draw.io (cellOf)", () => {
  const index = indexOf(XML, LEVELED_PAGES);

  it("prefers the occurrence on the page the user is looking at", () => {
    expect(index.cellOf("mp2", "sen")).toEqual({ pageId: "sen", cellId: "sen_mp2" });
    expect(index.cellOf("df7", "ctl")).toEqual({ pageId: "ctl", cellId: "ctl_df7" });
  });

  it("otherwise opens the definition", () => {
    expect(index.cellOf("mp2", "ctl")).toEqual({ pageId: "sys", cellId: "mp2" });
    expect(index.cellOf("mp2")).toEqual({ pageId: "sys", cellId: "mp2" });
    expect(index.cellOf("sen_p2", "sys")).toEqual({ pageId: "sen", cellId: "sen_p2" });
  });

  it("finds a definition whose cell id differs from its tfId", () => {
    // "Make this the definition": the copy on the sensor page is the home
    // now, the former definition on the system page a copy.
    const moved = makeDefinition(LEVELED_PAGES, dfdParser.parse(XML, LEVELED_PAGES).occurrences, {
      pageId: "sen",
      cellId: "sen_mp2",
    });
    if (!moved.ok) throw new Error(moved.reason);
    expect(indexOf(XML, moved.pages).cellOf("mp2")).toEqual({ pageId: "sen", cellId: "sen_mp2" });
    expect(indexOf(XML, moved.pages).tfIdOf("mp2", "sys")).toBe("mp2");
  });

  it("takes the first copy of a dangling element", () => {
    const index = indexOf(mxfile(SENSOR, CONTROLLER), LEVELED_PAGES);
    expect(index.cellOf("mp2")).toEqual({ pageId: "sen", cellId: "sen_mp2" });
  });

  it("lists all occurrences in document order", () => {
    expect(index.occurrencesOf("df7")).toEqual([
      { pageId: "sys", cellId: "df7", role: "definition" },
      { pageId: "sen", cellId: "sen_df7", role: "ref" },
      { pageId: "ctl", cellId: "ctl_df7", role: "ref" },
    ]);
    expect(index.occurrencesOf("unknown")).toEqual([]);
  });

  it("knows no cell for an unknown tfId", () => {
    expect(index.cellOf("unknown")).toBeUndefined();
  });
});

describe("useCellIdentity", () => {
  it("is the identity for a classic project (no parse, no page)", () => {
    const { result } = renderHook(() => useCellIdentity({ xml: mxfile(SYSTEM) }));
    expect(result.current.tfIdOf("mp1", "sys")).toBe("mp1");
    expect(result.current.cellOf("mp1")).toBeUndefined();
  });

  it("indexes a leveled project", () => {
    const { result } = renderHook(() =>
      useCellIdentity({ xml: XML, pages: LEVELED_PAGES }),
    );
    expect(result.current.tfIdOf("ctl_mp1", "ctl")).toBe("mp1");
    expect(result.current.cellOf("mp1", "ctl")).toEqual({ pageId: "ctl", cellId: "ctl_mp1" });
  });

  it("keeps the index while xml and pages are unchanged", () => {
    const dfd = { xml: XML, pages: LEVELED_PAGES };
    const { result, rerender } = renderHook(() => useCellIdentity(dfd));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
