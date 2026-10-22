// Leveled-DFD Phase 5f — context copies for a child page (design §12
// "Decompose…" / "Sync context"): flow neighbours, the flows at the MP's
// border, the boundaries around them; never the MP itself; idempotent.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import {
  analysePageGeometry,
  insertCandidates,
  planContextCopies,
  planContextRemovals,
  planInsertAsContext,
} from "features/dfd/services/leveled";
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

describe("planContextRemovals", () => {
  // The sensor page shows MP-2, EE-1 and both flows as copies; a process of
  // its own is not part of this check (the caller only asks for pure
  // context pages).
  const sen = page(
    "sen",
    "Sensor Module",
    boundary.replace('id="sb"', 'id="sen_sb"') +
      node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500) +
      node("sen_ee1", "externalentity", "Debugger", "EE-1", 700) +
      `<object label="stream sensor data" type="dataflow" id="sen_df7"><mxCell edge="1" parent="1" target="sen_mp2"><mxGeometry relative="1" as="geometry"><mxPoint x="10" y="40" as="sourcePoint"/></mxGeometry></mxCell></object>` +
      `<object label="pull debug commands" type="dataflow" id="sen_df8"><mxCell edge="1" parent="1" source="sen_ee1"><mxGeometry relative="1" as="geometry"><mxPoint x="10" y="40" as="targetPoint"/></mxGeometry></mxCell></object>`,
  );
  const links = [
    ref("sen_sb", "sb"),
    ref("sen_mp2", "mp2"),
    ref("sen_ee1", "ee1"),
    ref("sen_df7", "df7"),
    ref("sen_df8", "df8"),
  ];
  const removals = (top: string) => {
    const xml = mxfile(top, sen);
    const parse = dfdParser.parse(xml, PAGES(links));
    return planContextRemovals({
      parse,
      pageGeometry: analysePageGeometry(parse.pageCells),
      multiprocess: "mp1",
      childPageId: "sen",
      childLinks: links,
    });
  };

  it("removes nothing while the context is unchanged", () => {
    expect(removals(TOP)).toEqual([]);
  });

  it("removes the copy of a deleted flow and of a neighbour without flow to the MP", () => {
    // Reported with 5g: DF-8 (Debugger → MP-1) deleted on the top page;
    // its copy and the Debugger stayed on the child page.
    const withoutDf8 = TOP.replace(/<object label="pull debug commands"[\s\S]*?<\/object>\s*<object label="DF-8"[\s\S]*?<\/object>/, "");
    expect(withoutDf8).not.toContain('id="df8"');
    expect(removals(withoutDf8).sort()).toEqual(["sen_df8", "sen_ee1"]);
  });

  it("never removes a definition", () => {
    const own = sen.replace(
      node("sen_ee1", "externalentity", "Debugger", "EE-1", 700),
      node("sen_ee9", "externalentity", "Own", "EE-9", 700),
    );
    const xml = mxfile(TOP, own);
    const parse = dfdParser.parse(xml, PAGES(links));
    const result = planContextRemovals({
      parse,
      pageGeometry: analysePageGeometry(parse.pageCells),
      multiprocess: "mp1",
      childPageId: "sen",
      childLinks: links,
    });
    expect(result).not.toContain("sen_ee9");
  });

  it("does nothing for a multiprocess that is gone (orphan question instead)", () => {
    expect(
      planContextRemovals({
        parse: dfdParser.parse(mxfile(page("sys", "Top", ""), sen), PAGES(links)),
        pageGeometry: new Map(),
        multiprocess: "mp1",
        childPageId: "sen",
        childLinks: links,
      }),
    ).toEqual([]);
  });
});

describe("planContextRemovals — copies inserted by hand stay", () => {
  it("never removes a manual copy, although it is not part of the context", () => {
    // EE-1 has no flow to MP-1 any more, but the analyst inserted it.
    const top = page(
      "sys",
      "Top",
      node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("ee1", "externalentity", "Debugger", "EE-1", 600),
    );
    const sen = page("sen", "Sensor Module", node("sen_ee1", "externalentity", "Debugger", "EE-1", 600));
    for (const manual of [false, true]) {
      const links = [{ cellId: "sen_ee1", tfId: "ee1", role: "ref" as const, ...(manual ? { manual } : {}) }];
      const xml = mxfile(top, sen);
      const parse = dfdParser.parse(xml, PAGES(links));
      const result = planContextRemovals({
        parse,
        pageGeometry: analysePageGeometry(parse.pageCells),
        multiprocess: "mp1",
        childPageId: "sen",
        childLinks: links,
      });
      expect(result).toEqual(manual ? [] : ["sen_ee1"]);
    }
  });
});

describe("Insert as context (5h)", () => {
  const sen = page("sen", "Sensor Module", node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500));
  const pages = PAGES([ref("sen_mp2", "mp2")]);
  const parse = dfdParser.parse(mxfile(TOP, sen), pages);

  it("offers what is not on the page yet, never the MP the page details", () => {
    const labels = insertCandidates(parse, pages, "sen").map((c) => `${c.kind}:${c.label}`);
    expect(labels).toContain("element:EE-1 Debugger");
    expect(labels).toContain("connection:DF-8 pull debug commands");
    expect(labels).not.toContain("element:MP-1 Sensor Module"); // detailed by this page
    expect(labels).not.toContain("element:MP-2 Controller Module"); // already there
  });

  it("copies an element from its definition page", () => {
    expect(planInsertAsContext(parse, pages, "element", "ee1", "sen")).toEqual({
      fromPageId: "sys",
      toPageId: "sen",
      cells: ["ee1"],
      existing: {},
      tfIdOf: { ee1: "ee1" },
    });
  });

  it("connects an inserted flow to copies of its ends already on the page", () => {
    // DF-9 runs EE-1 → MP-2; MP-2 is already shown on the sensor page.
    expect(planInsertAsContext(parse, pages, "connection", "df9", "sen")?.existing).toEqual({
      mp2: "sen_mp2",
    });
  });

  it("refuses the detailed MP, an element already shown and an unknown page", () => {
    expect(planInsertAsContext(parse, pages, "element", "mp1", "sen")).toBeUndefined();
    expect(planInsertAsContext(parse, pages, "element", "mp2", "sen")).toBeUndefined();
    expect(planInsertAsContext(parse, pages, "element", "ee1", "nope")).toBeUndefined();
  });
});
