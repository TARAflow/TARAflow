// Leveled-DFD Phase 6a (design Phase 6, D20) — accordion groups of the
// asset / threat / risk tables: one per top-level decomposed multiprocess
// plus "Top level"; a flow between two groups belongs to both.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { multiprocessGroupsOf } from "features/dfd";
import { TOP_LEVEL_GROUP, groupsOfDfdItem } from "shared";
import type { DFDPage } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
  page,
} from "../../../../../fixtures/leveled-dfd-xml";

const source = (xml: string, pages: DFDPage[] = LEVELED_PAGES) => {
  const { elements, connections } = dfdParser.parse(xml, pages);
  return { xml, pages, elements, connections, assets: [] };
};

// Top additionally holds an external entity talking to MP-1.
const SYS = SYSTEM.replace(
  "</root>",
  node("ee1", "externalentity", "Debugger", "EE-1", 900) +
    flow("df8", "debug", "DF-8", "ee1", "mp1") +
    "</root>",
);

describe("multiprocessGroupsOf", () => {
  const groups = multiprocessGroupsOf(source(mxfile(SYS, SENSOR, CONTROLLER)))!;

  it("has Top level first, then the decomposed multiprocesses in page order", () => {
    expect(groups.groups).toEqual([
      { key: TOP_LEVEL_GROUP, label: "" },
      { key: "mp1", label: "MP-1 Sensor Module" },
      { key: "mp2", label: "MP-2 Controller Module" },
    ]);
  });

  it("puts parts into their multiprocess, everything else into Top level", () => {
    expect(groups.elementGroup.sen_p2).toBe("mp1");
    expect(groups.elementGroup.ctl_p5).toBe("mp2");
    expect(groups.elementGroup.ee1).toBe(TOP_LEVEL_GROUP);
  });

  it("puts a flow between groups into Top level only — every threat once (D20)", () => {
    // DF-7 resolves P-2 (in MP-1) → P-5 (in MP-2): between two MPs.
    expect(groups.flowGroups.df7).toEqual([TOP_LEVEL_GROUP]);
    // DF-8 EE-1 → MP-1, not drawn below MP-1: between Top and an MP.
    expect(groups.flowGroups.df8).toEqual([TOP_LEVEL_GROUP]);
  });

  it("keeps a flow inside a multiprocess in its group", () => {
    const sen = SENSOR.replace(
      "</root>",
      node("sen_p3", "process", "Diagnostics", "P-3", 300) +
        flow("sen_df1", "samples", "DF-1.1", "sen_p2", "sen_p3") +
        "</root>",
    );
    const g = multiprocessGroupsOf(source(mxfile(SYS, sen, CONTROLLER)))!;
    expect(g.flowGroups.sen_df1).toEqual(["mp1"]);
  });

  it("answers for threats by element or flow, nothing for unknown ids", () => {
    expect(groupsOfDfdItem(groups, { elementId: "sen_p2" })).toEqual(["mp1"]);
    expect(groupsOfDfdItem(groups, { connectionId: "df7" })).toEqual([TOP_LEVEL_GROUP]);
    expect(groupsOfDfdItem(groups, { elementId: "gone" })).toEqual([]);
  });

  it("is undefined without a decomposed multiprocess and for a classic DFD", () => {
    // Child pages hold only copies: neither MP is decomposed (D15).
    const copiesOnly = [
      page("sen", "Sensor Module", node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500)),
      page("ctl", "Controller Module", node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10)),
    ];
    expect(multiprocessGroupsOf(source(mxfile(SYSTEM, ...copiesOnly)))).toBeUndefined();
    const classic = mxfile(page("p1", "Page-1", node("a", "process", "A", "P-1", 10)));
    expect(multiprocessGroupsOf(source(classic, []))).toBeUndefined();
  });
});
