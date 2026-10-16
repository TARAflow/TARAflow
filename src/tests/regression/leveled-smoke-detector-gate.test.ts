// Leveled-DFD Phase 2 gate (leveled-dfd-multi-diagram-design.md §13).
//
// The single-page SmokeDetector DFD and its three-page version (System with
// MP-1 Sensor Head and MP-2 Smoke Detector Controller, one child page per
// multiprocess; original cell ids kept, copies linked in dfd.pages). The
// leveled model must analyse exactly like the single page.
//
// Phase 2a: leaves and stitched flow endpoints.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import {
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
});

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
