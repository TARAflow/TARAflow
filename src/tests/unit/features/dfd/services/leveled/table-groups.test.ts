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

  it("indexes the pages for the page and analysis-state filters (6f)", () => {
    const scope = groups.scope!;
    expect(scope.pages).toEqual([
      { pageId: "sys", name: "System", depth: 0 },
      { pageId: "sen", name: "Sensor Module", depth: 1 },
      { pageId: "ctl", name: "Controller Module", depth: 1 },
    ]);
    expect(scope.childPages).toEqual({ sys: ["sen", "ctl"] });
    // Definitions and context copies: MP-2 is shown on the sensor page too.
    expect(scope.itemsOnPage.sen).toEqual(expect.arrayContaining(["sen_p2", "mp2"]));
    expect(scope.itemsOnPage.sys).toEqual(expect.arrayContaining(["mp1", "mp2", "ee1", "df7", "df8"]));
    expect(scope.itemsOnPage.sys).not.toContain("sen_p2");
    // DF-8 ends at MP-1 with no refinement below: analysed on parent level.
    expect(scope.parentLevelFlows).toContain("df8");
    expect(scope.parentLevelFlows).not.toContain("df7");
  });

  it("lists each decomposed multiprocess with its parts and inner flows (risk roll-up)", () => {
    const mps = groups.scope!.multiprocesses;
    expect(mps.map((m) => [m.tfId, m.label, m.depth])).toEqual([
      ["mp1", "MP-1 Sensor Module", 0],
      ["mp2", "MP-2 Controller Module", 0],
    ]);
    expect(mps[0].items).toContain("sen_p2");
    expect(mps[1].items).toContain("ctl_p5");
    // DF-7 runs between the two multiprocesses: inside neither.
    expect(mps.flatMap((m) => m.items)).not.toContain("df7");
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

  it("puts a boundary into the group of the page it is defined on", () => {
    // A chip boundary drawn (defined) on the sensor page belongs to MP-1; a
    // boundary on Top stays top level.
    const chip = `<object label="Sensor MCU [SMCU]" type="chipboundary" id="sen_chip">
      <mxCell style="rounded=0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="400" height="200" as="geometry"/></mxCell>
    </object>`;
    const enclosure = `<object label="Enclosure [ENC]" type="physicalboundary" id="enc">
      <mxCell style="rounded=0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="900" height="300" as="geometry"/></mxCell>
    </object>`;
    const g = multiprocessGroupsOf(
      source(mxfile(SYS.replace("</root>", enclosure + "</root>"), SENSOR.replace("</root>", chip + "</root>"), CONTROLLER)),
    )!;
    expect(g.elementGroup.sen_chip).toBe("mp1");
    expect(g.elementGroup.enc).toBe(TOP_LEVEL_GROUP);
  });

  it("answers for threats by element or flow, nothing for unknown ids", () => {
    expect(groupsOfDfdItem(groups, { elementId: "sen_p2" })).toEqual(["mp1"]);
    expect(groupsOfDfdItem(groups, { connectionId: "df7" })).toEqual([TOP_LEVEL_GROUP]);
    expect(groupsOfDfdItem(groups, { elementId: "gone" })).toEqual([]);
  });

  it("finds a flow given as element id (per-element data-flow threats)", () => {
    expect(groupsOfDfdItem(groups, { elementId: "df7" })).toEqual([TOP_LEVEL_GROUP]);
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
