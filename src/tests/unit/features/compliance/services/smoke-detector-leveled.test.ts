// Early smoke test of the matrix on the leveled SmokeDetector (derived from
// the seminar example; iec-62443-4-2-cra-coverage.md §9.5, D-24): the
// effective model resolves flows across pages, so processes on child pages
// that serve a human actor are applicable — never a false n/a.
import { describe, it, expect } from "vitest";
import { buildAnalysisView } from "features/dfd/services/build-dfd-graph";
import type { DFDPage } from "features/dfd/models/dfd-types";
import {
  buildPropertyView,
  EDITION_PRAA_2026,
  evaluateMatrix,
  type ViewElement,
  type ViewFlow,
} from "features/compliance";
import fixture from "../../../../fixtures/leveled/smoke-detector-leveled.json";

const analysis = buildAnalysisView({
  xml: fixture.leveledXml,
  pages: fixture.pages as DFDPage[],
  elements: fixture.leveledElements as never,
  connections: fixture.connections as never,
  assets: fixture.assets as never,
});

const view = buildPropertyView({
  analysisElements: analysis.elements as unknown as ViewElement[],
  allElements: fixture.leveledElements as unknown as ViewElement[],
  flows: analysis.validationConnections as unknown as ViewFlow[],
});

const result = evaluateMatrix({
  edition: EDITION_PRAA_2026,
  view,
  scope: new Set(view.elements.map((e) => e.id)), // nothing selected → the whole model (D-7)
  run: "achieved",
});
const row = (label: string) => result.rows.find((r) => r.label === label)!;
const idOf = (name: string) => fixture.leveledElements.find((e) => e.name === name)!.id;

describe("leveled SmokeDetector — matrix smoke test", () => {
  it("the maintenance technician on Top is a neighbour of the leaf process on the child page", () => {
    const handler = idOf("Controller Communication Handler");
    const technician = idOf("Maintenance Technician");
    expect(view.flows.some((f) => f.from === technician && f.to === handler)).toBe(true);
    // CR 2.5 applies to that process: listed as failing or unknown, row not n/a.
    expect(row("CR 2.5").status).not.toBe("n/a");
    expect([...row("CR 2.5").failing, ...row("CR 2.5").unknown]).toContain(handler);
  });

  it("no session / non-repudiation row is n/a for a model with a human actor", () => {
    for (const label of ["CR 2.5", "CR 2.7", "CR 2.12", "CR 2.12 RE(1)"]) {
      expect(row(label).status, label).not.toBe("n/a");
    }
  });

  it("the decomposed multiprocesses stay in the view as carriers of system properties", () => {
    expect(analysis.elements.some((e) => e.type === "Multiprocess")).toBe(false);
    expect(view.elements.filter((e) => e.type === "Multiprocess").map((e) => e.id).sort()).toEqual(["mp_ctl", "mp_sen"]);
    // Without them CR 3.10 (update mechanism) would be a false n/a.
    expect(row("CR 3.10").status).not.toBe("n/a");
  });

  it("an unfinished example model reaches no SL-C above 0 for the component", () => {
    expect(Object.values(result.component).every((level) => level === 0)).toBe(true);
  });
});
