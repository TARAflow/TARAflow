// Leveled-DFD Phase 1.2 — logical identity across pages (design §5.2, §16).
//
// Leveled Smoke Detector excerpt from tests/fixtures/leveled-dfd-xml.ts;
// context copies are declared by the identity links in dfd.pages.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";

import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
  page,
  ref,
} from "../../../../../fixtures/leveled-dfd-xml";

describe("logical identity across pages", () => {
  const result = dfdParser.parse(
    mxfile(SYSTEM, SENSOR, CONTROLLER),
    LEVELED_PAGES,
  );

  it("merges context copies into one logical element per tfId", () => {
    expect(result.elements.map((e) => [e.id, e.displayId, e.name])).toEqual([
      ["mp1", "MP-1", "Sensor Module"],
      ["mp2", "MP-2", "Controller Module"],
      ["sen_p2", "P-2", "Sample Smoke Sensor"],
      ["ctl_p5", "P-5", "Evaluate Alarm"],
    ]);
  });

  it("takes the logical record from the definition, not from a copy", () => {
    const mp2 = result.elements.find((e) => e.id === "mp2")!;
    expect(mp2.position).toEqual({ x: 300, y: 10 }); // System page, not x=500
  });

  it("keeps one logical flow whose record is the definition's", () => {
    expect(
      result.connections.map((c) => [c.id, c.displayId, c.from, c.to]),
    ).toEqual([["df7", "DF-7", "mp1", "mp2"]]);
  });

  it("records every occurrence with its page-local endpoints resolved to tfIds", () => {
    const flows = result.occurrences.filter((o) => o.kind === "connection");
    expect(
      flows.map((o) => [
        o.pageId,
        o.cellId,
        o.tfId,
        o.role,
        o.sourceTfId,
        o.targetTfId,
      ]),
    ).toEqual([
      ["sys", "df7", "df7", "definition", "mp1", "mp2"],
      ["sen", "sen_df7", "df7", "ref", "sen_p2", "mp2"],
      ["ctl", "ctl_df7", "df7", "ref", "mp1", "ctl_p5"],
    ]);
  });

  it("records element occurrences per page with their role", () => {
    const nodes = result.occurrences.filter((o) => o.kind === "element");
    expect(nodes.map((o) => [o.pageId, o.cellId, o.tfId, o.role])).toEqual([
      ["sys", "mp1", "mp1", "definition"],
      ["sys", "mp2", "mp2", "definition"],
      ["sen", "sen_p2", "sen_p2", "definition"],
      ["sen", "sen_mp2", "mp2", "ref"],
      ["ctl", "ctl_mp1", "mp1", "ref"],
      ["ctl", "ctl_p5", "ctl_p5", "definition"],
    ]);
  });

  it("counts logical elements and flows, not occurrences", () => {
    expect(result.stats.multiprocesses).toBe(2);
    expect(result.stats.processes).toBe(2);
    expect(result.stats.dataFlows).toBe(1);
  });
});

describe("page order does not decide the record", () => {
  it("a definition on a later page wins over an earlier copy", () => {
    const result = dfdParser.parse(mxfile(SENSOR, SYSTEM), LEVELED_PAGES);
    const mp2 = result.elements.find((e) => e.id === "mp2")!;
    expect(mp2.position).toEqual({ x: 300, y: 10 });
    expect(result.connections.map((c) => [c.id, c.from, c.to])).toEqual([
      ["df7", "mp1", "mp2"],
    ]);
  });
});

describe("definition whose identity differs from its cell id (moved / adopted)", () => {
  it("uses the linked tfId as identity and resolves endpoints to it", () => {
    const xml = mxfile(
      page(
        "sys",
        "System",
        node("cell_a", "multiprocess", "Sensor Module", "MP-1", 10) +
          node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
          flow("df7", "stream sensor data", "DF-7", "cell_a", "mp2"),
      ),
    );
    const result = dfdParser.parse(xml, [
      {
        pageId: "sys",
        name: "System",
        order: 0,
        links: [{ cellId: "cell_a", tfId: "mp1", role: "definition" }],
      },
    ]);
    expect(result.elements.map((e) => e.id)).toEqual(["mp1", "mp2"]);
    expect(result.connections[0]).toMatchObject({
      id: "df7",
      from: "mp1",
      to: "mp2",
    });
    expect(result.occurrences[0]).toMatchObject({
      cellId: "cell_a",
      tfId: "mp1",
      role: "definition",
    });
  });
});

describe("links are page-local", () => {
  it("a link of one page never applies to the same cell id on another page", () => {
    const pages = [
      { pageId: "other", name: "", order: 0, links: [ref("sen_mp2", "mp2")] },
    ];
    const result = dfdParser.parse(mxfile(SENSOR), pages);
    expect(result.elements.map((e) => e.id)).toContain("sen_mp2");
  });
});

describe("context copy without definition (dangling, design §5.2.1)", () => {
  it("keeps the logical element from the copy — never dropped", () => {
    const result = dfdParser.parse(mxfile(SENSOR), LEVELED_PAGES);
    expect(result.elements.map((e) => [e.id, e.displayId])).toEqual([
      ["sen_p2", "P-2"],
      ["mp2", "MP-2"],
    ]);
    expect(result.connections.map((c) => [c.id, c.from, c.to])).toEqual([
      ["df7", "sen_p2", "mp2"],
    ]);
    expect(result.occurrences.every((o) => o.pageId === "sen")).toBe(true);
  });
});

describe("without links every cell is its own element", () => {
  it("the same three pages without dfd.pages: copies stay separate elements", () => {
    const result = dfdParser.parse(mxfile(SYSTEM, SENSOR, CONTROLLER));
    expect(result.elements).toHaveLength(6);
    expect(result.connections).toHaveLength(3);
  });
});

describe("classic project without dfd.pages", () => {
  it("is unchanged: tfId = cell id, every occurrence a definition", () => {
    const result = dfdParser.parse(mxfile(SYSTEM));
    expect(result.elements.map((e) => e.id)).toEqual(["mp1", "mp2"]);
    expect(result.connections.map((c) => [c.id, c.from, c.to])).toEqual([
      ["df7", "mp1", "mp2"],
    ]);
    expect(
      result.occurrences.every(
        (o) => o.role === "definition" && o.tfId === o.cellId,
      ),
    ).toBe(true);
  });
});
