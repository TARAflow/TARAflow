// Leveled-DFD Phase 2 gate (leveled-dfd-multi-diagram-design.md §13).
//
// The single-page SmokeDetector DFD and its three-page version (System with
// MP-1 Sensor Head and MP-2 Smoke Detector Controller, one child page per
// multiprocess; original cell ids kept, copies linked in dfd.pages). The
// leveled model must analyse exactly like the single page.
//
// Phase 2a: leaves and stitched flow endpoints.
// Phase 2b: crossed interfaces per flow, boundary membership per element.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import {
  analysePageGeometry,
  buildEffectiveModel,
  buildPageTree,
  computeHomePages,
  findDanglingReferences,
} from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
import fixture from "../fixtures/leveled/smoke-detector-leveled.json";

const pages = fixture.pages as DFDPage[];
const single = dfdParser.parse(fixture.singlePageXml);
const leveled = dfdParser.parse(fixture.leveledXml, pages);
const homePages = computeHomePages(leveled.occurrences);
const tree = buildPageTree({
  parsedPages: leveled.pages,
  persistedPages: pages,
  elements: leveled.elements,
  occurrences: leveled.occurrences,
  homePages,
});
const model = buildEffectiveModel({
  elements: leveled.elements,
  connections: leveled.connections,
  occurrences: leveled.occurrences,
  tree,
  homePages,
  pageGeometry: analysePageGeometry(leveled.pageCells),
});
// The single page as today's graph builder sees it (cell id = tfId).
const singleGeometry = [...analysePageGeometry(single.pageCells).values()][0];

describe("leveled SmokeDetector — structure", () => {
  it("is a clean three-page tree without dangling copies", () => {
    expect(tree.issues).toEqual([]);
    expect(
      tree.pages.map((p) => [p.pageId, tree.depthOf.get(p.pageId)]),
    ).toEqual([
      ["sys", 0],
      ["sen", 1],
      ["ctl", 1],
    ]);
    expect(findDanglingReferences(leveled.occurrences)).toEqual([]);
  });

  it("has the single-page elements plus the two multiprocesses", () => {
    const ids = (list: { id: string }[]) => list.map((e) => e.id).sort();
    expect(ids(leveled.elements)).toEqual(
      [...ids(single.elements), "mp_ctl", "mp_sen"].sort(),
    );
    expect(ids(leveled.connections)).toEqual(ids(single.connections));
  });
});

describe("leveled SmokeDetector — effective model (Phase 2a)", () => {
  it("its leaves are exactly the single-page elements", () => {
    expect(model.elements.map((e) => e.tfId).sort()).toEqual(
      single.elements.map((e) => e.id).sort(),
    );
  });

  it("every flow resolves to the endpoints of the single page", () => {
    const expected = single.connections
      .map((c) => [c.id, c.from, c.to, "resolved"])
      .sort();
    const actual = model.flows
      .map((f) => [f.tfId, f.from, f.to, f.state])
      .sort();
    expect(actual).toEqual(expected);
    expect(model.findings).toEqual([]);
  });
});

describe("leveled SmokeDetector — interfaces and boundaries (Phase 2b)", () => {
  it("every flow crosses the same interfaces as on the single page", () => {
    const expected = single.connections
      .map((c) => [
        c.id,
        [...(singleGeometry.flowInterfaces.get(c.id) ?? [])].sort(),
      ])
      .sort();
    const actual = model.flows
      .map((f) => [f.tfId, (f.interfaces ?? []).map((i) => i.tfId).sort()])
      .sort();
    expect(actual).toEqual(expected);
  });

  it("attributes the bus interfaces of DF-7 to their side of each border", () => {
    // DF-7 stream smoke measurement: P-2 (Sensor Head) → P-5 (Controller)
    expect(model.flows.find((f) => f.tfId === "DF-1")!.interfaces).toEqual([
      { tfId: "IF-2", side: "source", level: 1 }, // IF-1 RS-485 (Head)
      { tfId: "21", side: "target", level: 1 }, // IF-3 RS-485 (Controller)
    ]);
  });

  it("every element lies in the same boundaries as on the single page (D14)", () => {
    for (const kind of ["trust", "chip", "physical"] as const) {
      const expected = Object.fromEntries(
        single.elements.map((e) => [
          e.id,
          [...(singleGeometry[kind].get(e.id) ?? [])].sort(),
        ]),
      );
      const actual = Object.fromEntries(
        model.elements.map((e) => [e.tfId, e.boundaries![kind]]),
      );
      expect({ kind, actual }).toEqual({ kind, actual: expected });
    }
    expect(model.findings).toEqual([]);
  });
});
