// Leveled-DFD Phase 6f (design §10): page and analysis-state filter of the
// threat and risk tables.
import { describe, it, expect } from "vitest";
import {
  NO_DFD_SCOPE_FILTER,
  dfdScopePredicate,
  pageWithSubPages,
  type DfdScopeIndex,
} from "shared";

const INDEX: DfdScopeIndex = {
  pages: [
    { pageId: "top", name: "Top", depth: 0 },
    { pageId: "mp1", name: "Sensor", depth: 1 },
    { pageId: "mp11", name: "Optics", depth: 2 },
  ],
  itemsOnPage: {
    top: ["ee1", "mp1", "df1"],
    mp1: ["p1", "mp11", "df2", "ee1"],
    mp11: ["p11"],
  },
  childPages: { top: ["mp1"], mp1: ["mp11"] },
  parentLevelFlows: ["df1"],
};

describe("dfdScopePredicate", () => {
  it("filters nothing without a filter or without an index", () => {
    expect(dfdScopePredicate(INDEX, NO_DFD_SCOPE_FILTER)).toBeUndefined();
    expect(dfdScopePredicate(undefined, { ...NO_DFD_SCOPE_FILTER, pageId: "top" })).toBeUndefined();
  });

  it("keeps what a page shows, context copies included", () => {
    const on = dfdScopePredicate(INDEX, { ...NO_DFD_SCOPE_FILTER, pageId: "mp1" })!;
    expect(on({ elementId: "p1" })).toBe(true);
    expect(on({ elementId: "ee1" })).toBe(true); // copy of EE-1
    expect(on({ elementId: "p11" })).toBe(false);
    expect(on({ connectionId: "df2" })).toBe(true);
  });

  it("adds the sub-pages on request", () => {
    expect(pageWithSubPages(INDEX, "top")).toEqual(["top", "mp1", "mp11"]);
    const on = dfdScopePredicate(INDEX, { pageId: "mp1", withSubPages: true, parentLevelOnly: false })!;
    expect(on({ elementId: "p11" })).toBe(true);
    expect(on({ connectionId: "df1" })).toBe(false);
  });

  it("decides a flow threat by its flow, not by the element it names", () => {
    const on = dfdScopePredicate(INDEX, { ...NO_DFD_SCOPE_FILTER, pageId: "mp11" })!;
    expect(on({ elementId: "p11", connectionId: "df2" })).toBe(false);
  });

  it("keeps only the flows analysed on parent level, combinable with a page", () => {
    const parent = dfdScopePredicate(INDEX, { ...NO_DFD_SCOPE_FILTER, parentLevelOnly: true })!;
    expect(parent({ connectionId: "df1" })).toBe(true);
    expect(parent({ connectionId: "df2" })).toBe(false);
    expect(parent({ elementId: "p1" })).toBe(false);
    const both = dfdScopePredicate(INDEX, { pageId: "mp1", withSubPages: false, parentLevelOnly: true })!;
    expect(both({ connectionId: "df1" })).toBe(false);
  });

  it("drops an item without a reference", () => {
    const on = dfdScopePredicate(INDEX, { ...NO_DFD_SCOPE_FILTER, pageId: "top" })!;
    expect(on({})).toBe(false);
  });
});
