// Leveled-DFD Phase 5f — context copies for a child page (design §12
// "Decompose…" / "Sync context"): flow neighbours, the flows at the MP's
// border, the boundaries around them; never the MP itself; idempotent.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { analysePageGeometry, planContextCopies } from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
import { LEVELED_PAGES, flow, mxfile, node, page, ref } from "../../../../../fixtures/leveled-dfd-xml";

// A trust boundary around both multiprocesses on the top page.
const boundary = `<object label="Board [SB]" type="trustboundary" id="sb">
  <mxCell style="rounded=0;dashed=1;" vertex="1" parent="1">
    <mxGeometry x="0" y="0" width="1000" height="300" as="geometry"/>
  </mxCell>
</object>`;

const TOP = page(
  "sys",
  "Top",
  boundary +
    node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
    node("ee1", "externalentity", "Debugger", "EE-1", 600) +
    flow("df7", "stream sensor data", "DF-7", "mp1", "mp2") +
    flow("df8", "pull debug commands", "DF-8", "ee1", "mp1") +
    flow("df9", "unrelated", "DF-9", "ee1", "mp2") +
    flow("loop", "self", "DF-10", "mp1", "mp1"),
);

const plan = (childPage: string, pages: DFDPage[], mp = "mp1", childId = "sen") => {
  const xml = mxfile(TOP, childPage);
  const parse = dfdParser.parse(xml, pages);
  return planContextCopies({
    parse,
    pageGeometry: analysePageGeometry(parse.pageCells),
    multiprocess: mp,
    childPageId: childId,
  });
};

const PAGES = (links: DFDPage["links"] = []): DFDPage[] => [
  { pageId: "sys", name: "Top", order: 0 },
  { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 1, links },
];

describe("planContextCopies", () => {
  it("copies boundaries, flow neighbours and the flows at the MP onto an empty child page", () => {
    const result = plan(page("sen", "Sensor Module", ""), PAGES());
    expect(result).toEqual({
      fromPageId: "sys",
      toPageId: "sen",
      cells: ["sb", "mp2", "ee1", "df7", "df8"],
      existing: {},
      tfIdOf: { sb: "sb", mp2: "mp2", ee1: "ee1", df7: "df7", df8: "df8" },
    });
    // Never the MP itself, no self-loop, no flow that does not touch it.
    expect(result!.cells).not.toContain("mp1");
    expect(result!.cells).not.toContain("loop");
    expect(result!.cells).not.toContain("df9");
  });

  it("copies only what is missing and connects a new flow to the copy already there", () => {
    const sen = page(
      "sen",
      "Sensor Module",
      node("sen_p2", "process", "Sample", "P-1.1", 10) +
        node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500) +
        flow("sen_df7", "stream sensor data", "DF-7", "sen_p2", "sen_mp2"),
    );
    const result = plan(sen, PAGES([ref("sen_mp2", "mp2"), ref("sen_df7", "df7")]));
    expect(result?.cells).toEqual(["sb", "ee1", "df8"]);
    expect(result?.existing).toEqual({ mp2: "sen_mp2" });
  });

  it("has nothing to do when the child page shows all of it", () => {
    const sen = page(
      "sen",
      "Sensor Module",
      boundary.replace('id="sb"', 'id="sen_sb"') +
        node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500) +
        node("sen_ee1", "externalentity", "Debugger", "EE-1", 700) +
        node("sen_p", "process", "Part", "P-1.1", 10) +
        flow("sen_df7", "stream sensor data", "DF-7", "sen_p", "sen_mp2") +
        flow("sen_df8", "pull debug commands", "DF-8", "sen_ee1", "sen_p"),
    );
    const links = [
      ref("sen_sb", "sb"),
      ref("sen_mp2", "mp2"),
      ref("sen_ee1", "ee1"),
      ref("sen_df7", "df7"),
      ref("sen_df8", "df8"),
    ];
    expect(plan(sen, PAGES(links))).toBeUndefined();
  });

  it("counts a linked cell as present although it is no occurrence (flow with a free end)", () => {
    // DF-8 was copied earlier; its MP end is still free, so the parser does
    // not see it — the link alone says it is there.
    const sen = page(
      "sen",
      "Sensor Module",
      `<object label="pull debug commands" type="dataflow" id="sen_df8"><mxCell edge="1" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell></object>`,
    );
    const links = [ref("sen_df8", "df8")];
    const xml = mxfile(TOP, sen);
    const parse = dfdParser.parse(xml, PAGES(links));
    const result = planContextCopies({
      parse,
      pageGeometry: analysePageGeometry(parse.pageCells),
      multiprocess: "mp1",
      childPageId: "sen",
      childLinks: links,
    });
    expect(result?.cells).toEqual(["sb", "mp2", "ee1", "df7"]);
  });

  it("does nothing for a multiprocess without a home page", () => {
    expect(plan(page("sen", "Sensor Module", ""), PAGES(), "nope")).toBeUndefined();
  });

  it("works on the existing leveled excerpt (child page with copies)", () => {
    // Sanity: the fixture's controller page already copies MP-1 and DF-7.
    const result = plan(page("ctl", "Controller Module", ""), LEVELED_PAGES, "mp2", "ctl");
    expect(result?.cells).toEqual(["sb", "mp1", "ee1", "df7", "df9"]);
  });
});
