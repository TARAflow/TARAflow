// Leveled-DFD Phase 1.5 — adoption of files that are already multi-page
// (design §11.2.1, D13). A proposal only; nothing is linked before
// applyAdoption, and the XML is never touched.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import {
  applyAdoption,
  buildPageTree,
  computeHomePages,
  findDanglingReferences,
  proposeAdoption,
} from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
import {
  flow,
  mxfile,
  node,
  page,
} from "../../../../../fixtures/leveled-dfd-xml";

// The leveled Smoke Detector drawn as three plain draw.io pages — copies are
// ordinary cells with their own ids, as in a file drawn before links existed.
const SYS = page(
  "sys",
  "System",
  node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
    node("ee1", "externalentity", "Debugger", "EE-1", 600) +
    node("sb", "trustboundary", "Sensor Board [SB]", "SB", 0) +
    flow("df7", "stream sensor data", "DF-7", "mp1", "mp2") +
    flow("df8", "pull debug commands", "DF-8", "ee1", "mp1"),
);
const SEN = page(
  "sen",
  "Sensor Module",
  node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10) +
    node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500) +
    node("sen_ee1", "externalentity", "Debugger", "EE-1", 700) +
    node("sen_sb", "trustboundary", "Sensor Board [SB]", "SB", 0) +
    flow("sen_df7", "stream sensor data", "DF-7", "sen_p2", "sen_mp2") +
    flow("sen_df8", "pull debug commands", "DF-8", "sen_ee1", "sen_p2"),
);
const CTL = page(
  "ctl",
  "Controller Module",
  node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300) +
    flow("ctl_df7", "stream sensor data", "DF-7", "ctl_mp1", "ctl_p5"),
);
const XML = mxfile(SYS, SEN, CTL);

function propose(xml: string, pages?: DFDPage[]) {
  const parse = dfdParser.parse(xml, pages);
  return proposeAdoption({ parse, persistedPages: pages });
}

const cell = (c: { pageId: string; cellId: string }) =>
  `${c.pageId}/${c.cellId}`;

describe("proposeAdoption — leveled Smoke Detector without links", () => {
  const proposal = propose(XML);

  it("proposes the decomposition tree from the flow neighbourhood", () => {
    expect(
      proposal.pages.map((p) => [p.pageId, p.status, p.decomposes]),
    ).toEqual([
      ["sys", "root", undefined],
      ["sen", "proposed", "mp1"],
      ["ctl", "proposed", "mp2"],
    ]);
  });

  it("groups copies by (displayId, type), definition on the root page", () => {
    expect(
      proposal.groups.map((g) => [
        g.displayId,
        g.tfId,
        cell(g.definition),
        g.definitionReason,
        g.copies.map(cell),
      ]),
    ).toEqual([
      ["MP-1", "mp1", "sys/mp1", "root", ["ctl/ctl_mp1"]],
      ["MP-2", "mp2", "sys/mp2", "root", ["sen/sen_mp2"]],
      ["EE-1", "ee1", "sys/ee1", "root", ["sen/sen_ee1"]],
      ["SB", "sb", "sys/sb", "root", ["sen/sen_sb"]],
      ["DF-7", "df7", "sys/df7", "root", ["sen/sen_df7", "ctl/ctl_df7"]],
      ["DF-8", "df8", "sys/df8", "root", ["sen/sen_df8"]],
    ]);
    expect(proposal.groups.every((g) => !g.labelDivergence)).toBe(true);
  });

  it("is only a proposal: the parse still has every copy as its own element", () => {
    expect(dfdParser.parse(XML).elements).toHaveLength(10);
  });
});

describe("applyAdoption", () => {
  const proposal = propose(XML);
  const applied = applyAdoption(proposal, undefined);
  if (!applied.ok) throw new Error(applied.reason);
  const pages = applied.pages;

  it("writes one page entry per XML page with decomposition and ref links", () => {
    expect(pages.map((p) => [p.pageId, p.decomposes, p.order])).toEqual([
      ["sys", undefined, 0],
      ["sen", "mp1", 1],
      ["ctl", "mp2", 2],
    ]);
    expect(pages[0]).not.toHaveProperty("links"); // definitions stay plain
    expect(pages[2].links).toEqual([
      { cellId: "ctl_mp1", tfId: "mp1", role: "ref" },
      { cellId: "ctl_df7", tfId: "df7", role: "ref" },
    ]);
  });

  it("re-parsed, the model is one logical element per group and a clean tree", () => {
    const parse = dfdParser.parse(XML, pages);
    expect(parse.elements.map((e) => e.displayId)).toEqual([
      "MP-1",
      "MP-2",
      "EE-1",
      "SB",
      "P-2",
      "P-5",
    ]);
    expect(parse.connections.map((c) => [c.displayId, c.from, c.to])).toEqual([
      ["DF-7", "mp1", "mp2"],
      ["DF-8", "ee1", "mp1"],
    ]);
    expect(findDanglingReferences(parse.occurrences)).toEqual([]);
    const tree = buildPageTree({
      parsedPages: parse.pages,
      persistedPages: pages,
      elements: parse.elements,
      occurrences: parse.occurrences,
      homePages: computeHomePages(parse.occurrences),
    });
    expect(tree.issues).toEqual([]);
    expect(Object.fromEntries(tree.depthOf)).toEqual({
      sys: 0,
      sen: 1,
      ctl: 1,
    });
  });

  it("a second proposal on the adopted file has nothing left to merge", () => {
    const again = propose(XML, pages);
    expect(again.pages.map((p) => p.status)).toEqual([
      "root",
      "existing",
      "existing",
    ]);
    expect(again.groups.every((g) => g.definitionReason === "existing")).toBe(
      true,
    );
    const reapplied = applyAdoption(again, pages);
    expect(reapplied.ok && reapplied.pages).toEqual(pages);
  });
});

describe("applyAdoption — the analyst's decisions", () => {
  const proposal = propose(XML);

  it("a rejected group is left as it is", () => {
    const result = applyAdoption(proposal, undefined, {
      reject: ["element:ee1"],
    });
    if (!result.ok) throw new Error(result.reason);
    const sen = result.pages.find((p) => p.pageId === "sen")!;
    expect(sen.links?.map((l) => l.cellId)).not.toContain("sen_ee1");
  });

  it("another member can be chosen as definition; the root cell becomes a copy", () => {
    const result = applyAdoption(proposal, undefined, {
      definition: { "element:mp1": { pageId: "ctl", cellId: "ctl_mp1" } },
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.pages.find((p) => p.pageId === "sys")!.links).toEqual([
      { cellId: "mp1", tfId: "mp1", role: "ref" },
    ]);
    expect(result.pages.find((p) => p.pageId === "ctl")!.links).toContainEqual({
      cellId: "ctl_mp1",
      tfId: "mp1",
      role: "definition",
    });
  });

  it("refuses a definition that is not a member of the group", () => {
    expect(
      applyAdoption(proposal, undefined, {
        definition: { "element:mp1": { pageId: "sen", cellId: "sen_p2" } },
      }),
    ).toEqual({
      ok: false,
      reason: "INVALID_DEFINITION",
      groupKey: "element:mp1",
    });
  });

  it("refuses a page without decomposition — it would be a second root", () => {
    expect(
      applyAdoption(proposal, undefined, { decomposes: { ctl: null } }),
    ).toEqual({ ok: false, reason: "PAGE_NOT_PLACED", pageId: "ctl" });
  });

  it("the root page stays without decomposition", () => {
    const result = applyAdoption(proposal, undefined, {});
    if (!result.ok) throw new Error(result.reason);
    expect(result.pages.find((p) => p.pageId === "sys")).not.toHaveProperty(
      "decomposes",
    );
  });
});

describe("proposeAdoption — what is never merged or guessed", () => {
  it("cells without a real displayId stay singletons", () => {
    const noId = (id: string) =>
      `<object label="Logger" type="process" id="${id}">
         <mxCell style="ellipse;" vertex="1" parent="1">
           <mxGeometry x="900" y="10" width="120" height="60" as="geometry"/>
         </mxCell>
       </object>`;
    const xml = mxfile(
      page("sys", "System", noId("log_a")),
      page("sen", "Sensor Module", noId("log_b")),
    );
    expect(propose(xml).groups).toEqual([]);
  });

  it("two already-linked identities with the same displayId are a conflict, not merged", () => {
    // mp1 (System) and ctl_mp1 (Controller) both carry "MP-1" but are already
    // linked to two different identities: adoption must not pick one.
    const pages: DFDPage[] = [
      {
        pageId: "sys",
        name: "System",
        order: 0,
        links: [{ cellId: "mp1", tfId: "mp1x", role: "definition" }],
      },
      {
        pageId: "sen",
        name: "Sensor Module",
        decomposes: "mp1x",
        order: 0,
        links: [{ cellId: "sen_mp2", tfId: "mp2", role: "ref" }],
      },
      {
        pageId: "ctl",
        name: "Controller Module",
        order: 1,
        links: [{ cellId: "ctl_mp1", tfId: "other", role: "definition" }],
      },
    ];
    const proposal = propose(XML, pages);
    const mp1Groups = proposal.groups.filter((g) => g.displayId === "MP-1");
    expect(mp1Groups.map((g) => [g.tfId, g.conflictWith])).toEqual([
      ["mp1x", ["other"]],
      ["other", ["mp1x"]],
    ]);
    const applied = applyAdoption(proposal, pages);
    if (!applied.ok) throw new Error(applied.reason);
    expect(applied.pages.find((p) => p.pageId === "ctl")!.links).toEqual([
      { cellId: "ctl_mp1", tfId: "other", role: "definition" },
      { cellId: "ctl_df7", tfId: "df7", role: "ref" },
    ]);
  });

  it("flags label divergence among merged records", () => {
    const renamed = SEN.replace(
      'label="Debugger" type="externalentity" id="sen_ee1"',
      'label="JTAG Debugger" type="externalentity" id="sen_ee1"',
    );
    expect(renamed).not.toBe(SEN);
    const ee1 = propose(mxfile(SYS, renamed, CTL)).groups.find(
      (g) => g.displayId === "EE-1",
    )!;
    expect(ee1.labelDivergence).toBe(true);
  });

  it("an equally plausible pair of multiprocesses is ambiguous, not guessed", () => {
    const sys = page(
      "sys",
      "System",
      node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
        node("ee1", "externalentity", "Debugger", "EE-1", 600) +
        flow("df1", "a", "DF-1", "ee1", "mp1") +
        flow("df2", "b", "DF-2", "ee1", "mp2"),
    );
    const amb = page(
      "amb",
      "Detail",
      node("amb_ee1", "externalentity", "Debugger", "EE-1", 10) +
        node("amb_p1", "process", "Part", "P-1", 300),
    );
    const other = page(
      "oth",
      "Notes",
      node("oth_p9", "process", "Unrelated", "P-9", 10),
    );
    const proposal = propose(mxfile(sys, amb, other));
    expect(
      proposal.pages.map((p) => [p.pageId, p.status, p.candidates]),
    ).toEqual([
      ["sys", "root", []],
      ["amb", "ambiguous", ["mp1", "mp2"]],
      ["oth", "unplaced", []],
    ]);

    // An unplaced or ambiguous page is never adopted as a second root: the
    // analyst has to name the multiprocess it details.
    expect(applyAdoption(proposal, undefined, {})).toEqual({
      ok: false,
      reason: "PAGE_NOT_PLACED",
      pageId: "amb",
    });
    const placed = applyAdoption(proposal, undefined, {
      decomposes: { amb: "mp1", oth: "mp2" },
    });
    if (!placed.ok) throw new Error(placed.reason);
    expect(placed.pages.map((p) => [p.pageId, p.decomposes])).toEqual([
      ["sys", undefined],
      ["amb", "mp1"],
      ["oth", "mp2"],
    ]);
  });

  it("an already linked group keeps its existing definition", () => {
    // EE-1 was defined on Sensor Module (moved definition, tfId "ee1"); the
    // System cell sys_ee1 is a plain duplicate drawn later.
    const sys = SYS.replace(/"ee1"/g, '"sys_ee1"');
    const pages: DFDPage[] = [
      { pageId: "sys", name: "System", order: 0 },
      {
        pageId: "sen",
        name: "Sensor Module",
        decomposes: "mp1",
        order: 0,
        links: [{ cellId: "sen_ee1", tfId: "ee1", role: "definition" }],
      },
    ];
    const proposal = propose(mxfile(sys, SEN), pages);
    const ee1 = proposal.groups.find((g) => g.displayId === "EE-1")!;
    expect([ee1.tfId, cell(ee1.definition), ee1.definitionReason]).toEqual([
      "ee1",
      "sen/sen_ee1",
      "existing",
    ]);
    expect(ee1.copies.map(cell)).toEqual(["sys/sys_ee1"]);
  });
});
