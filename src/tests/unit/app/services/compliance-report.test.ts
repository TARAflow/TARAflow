// tests/unit/app/services/compliance-report.test.ts
//
// The matrix of a real project for the document (app/services/compliance-
// report.ts; iec-62443-4-2-cra-coverage.md §5, §9.4, D-1, D-3, D-7):
// edition by tags, component scope, achieved and planned runs.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseAndRepair } from "app/services/migration-service";
import {
  buildDocCompliance,
  complianceScope,
  evaluateProjectCompliance,
  prepareProjectCompliance,
} from "app/services/compliance-report";
import { EDITION_2019, EDITION_PRAA_2026 } from "features/compliance";
import type { Project } from "app/models/project-types";
import { buildPumpStationProject } from "../../../examples/pump-station-example";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const smokeDetector = (regulation: string[], compliance?: Any): Project => {
  const raw: Any = JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8"));
  const project: Any = parseAndRepair(raw)!;
  project.info = { ...project.info, tags: { domain: [], platform: [], custom: [], ...(project.info.tags ?? {}), regulation } };
  if (compliance) project.compliance = compliance;
  return project;
};

describe("prepareProjectCompliance", () => {
  it("one preparation evaluates each edition like evaluateProjectCompliance (K-1, sub-tabs)", () => {
    const project = smokeDetector(["IEC 62443", "EN IEC 62443 (CRA)"]);
    const context = prepareProjectCompliance(project)!;
    for (const edition of [EDITION_PRAA_2026, EDITION_2019]) {
      const single = evaluateProjectCompliance(project, edition)!;
      const fromContext = context.evaluate(edition);
      expect(fromContext.achieved).toEqual(single.achieved);
      expect(fromContext.planned).toEqual(single.planned);
      expect(fromContext.achieved.rows).toHaveLength(edition.rows.length);
    }
    expect(context.scope).toEqual(evaluateProjectCompliance(project)!.scope);
  });

  it("a family's own component narrows that family's scope; the default stays for the context (K-5)", () => {
    const project = smokeDetector(["IEC 62443"], { families: { "iec-62443-4-2": { componentId: "P-5" } } });
    const context = prepareProjectCompliance(project)!;
    const evaluation = context.evaluate(EDITION_2019);
    expect(context.scopeName).toBeUndefined();
    expect(evaluation.scopeName).toBe("P-12 Firmware Update Manager");
    expect(evaluation.scope.has("P-5")).toBe(true);
    expect(evaluation.scope.size).toBeLessThan(context.scope.size);
  });

  it("no DFD → nothing to evaluate", () => {
    const project = smokeDetector(["IEC 62443"]);
    expect(prepareProjectCompliance({ ...project, dfd: undefined } as Any)).toBeUndefined();
  });
});

describe("buildDocCompliance", () => {
  it("no 62443 tag → no matrix (the generic CRA tag selects none, D-3)", () => {
    expect(buildDocCompliance(smokeDetector([]))).toBeUndefined();
    expect(buildDocCompliance(smokeDetector(["CRA"]))).toBeUndefined();
  });

  it("CRA edition: all 97 rows, the CRA view, seven FRs", () => {
    const [doc] = buildDocCompliance(smokeDetector(["EN IEC 62443 (CRA)"]))!;
    expect(doc.cra).toBe(true);
    expect(doc.draft).toBe(true);
    expect(doc.rows).toHaveLength(97);
    expect(doc.vectors.map((v) => v.fr)).toEqual(["IAC", "UC", "SI", "DC", "RDF", "TRE", "RA"]);
    expect(doc.component).toBeUndefined();
  });

  it("both tags → one part per edition, the CRA edition first (K-1, CM-9)", () => {
    const parts = buildDocCompliance(smokeDetector(["IEC 62443", "EN IEC 62443 (CRA)"]))!;
    expect(parts.map((p) => [p.standardLabel, p.cra])).toEqual([
      ["EN IEC 62443-4-2 (CRA)", true],
      ["IEC 62443-4-2:2019", false],
    ]);
    expect(parts.map((p) => p.rows.length)).toEqual([97, 125]);
  });

  it("classic edition: device rows wait for a confirmed category (K-C1)", () => {
    const [doc] = buildDocCompliance(smokeDetector(["IEC 62443"]))!;
    expect(doc.cra).toBe(false);
    expect(doc.rows).toHaveLength(125);
    expect(doc.deviceCategories).toEqual({ categories: [], confirmed: false });
    expect(doc.rows.find((r) => r.label === "EDR 3.14")!.status).toBe("pending-category");
    const [confirmed] = buildDocCompliance(smokeDetector(["IEC 62443"], { families: { "iec-62443-4-2": { deviceCategories: { categories: ["EDR"], source: "manual" } } } }))!;
    expect(confirmed.rows.find((r) => r.label === "EDR 3.14")!.status).not.toBe("pending-category");
    expect(confirmed.rows.find((r) => r.label === "NDR 3.14")!.status).toBe("n/a");
  });

  it("names elements by display id and name; target from the project", () => {
    const [doc] = buildDocCompliance(smokeDetector(["EN IEC 62443 (CRA)"], { families: { "iec-62443-4-2": { target: { IAC: 2 } } } }))!;
    expect(doc.vectors[0].target).toBe(2);
    const listed = doc.rows.flatMap((r) => [...r.failing, ...r.unknown]);
    expect(listed.some((n) => /^P-\d+ /.test(n))).toBe(true);
  });

  it("planned never below achieved: SHOULD values only strengthen, open mitigations count too", () => {
    const { achieved, planned } = evaluateProjectCompliance(smokeDetector(["EN IEC 62443 (CRA)"]))!;
    for (const fr of Object.keys(achieved.component) as (keyof typeof achieved.component)[]) {
      expect(planned.component[fr]).toBeGreaterThanOrEqual(achieved.component[fr]);
      expect(planned.withSupport[fr]).toBeGreaterThanOrEqual(achieved.withSupport[fr]);
    }
  });

  it("planned keeps the other properties of an element a SHOULD value changes: no met row turns unknown", () => {
    // The pump station example has open mitigations whose SHOULD values touch
    // flows with several properties (DF-7, DF-10, DF-11).
    const { achieved, planned } = evaluateProjectCompliance(parseAndRepair(buildPumpStationProject())!)!;
    const plannedStatus = new Map(planned.rows.map((r) => [r.label, r.status]));
    const met = achieved.rows.filter((r) => r.status === "met");
    expect(met.length).toBeGreaterThan(0);
    for (const row of met) expect([row.label, plannedStatus.get(row.label)]).toEqual([row.label, "met"]);
  });
});

describe("complianceScope (D-7)", () => {
  const graph = {
    elementTrustBoundaries: new Map([["p1", ["tb"]]]),
    elementChipBoundaries: new Map([["p1", ["cb"]]]),
    elementPhysicalBoundaries: new Map<string, string[]>(),
    dataFlowAnalysis: new Map([["f1", { interfaceIds: ["if1"] }], ["f2", { interfaceIds: ["if2"] }]]),
  };
  const view = {
    elements: ["mp", "p1", "p2", "other", "tb", "cb", "if1", "if2"].map((id) => ({ id, type: "Process" })),
    flows: [
      { id: "f1", from: "ee", to: "p1" },
      { id: "f2", from: "ee", to: "other" },
    ],
  };
  const containment = new Map([["p1", "mp"], ["p2", "p1x"], ["p1x", "mp"]]);

  it("no component → the whole model", () => {
    expect(complianceScope(undefined, view, containment, graph).size).toBe(view.elements.length);
  });

  it("the component, its descendants, their boundaries and the interfaces their flows pass", () => {
    const scope = complianceScope("mp", view, containment, graph);
    expect([...scope].sort()).toEqual(["cb", "if1", "mp", "p1", "p2", "tb"]);
  });
});
