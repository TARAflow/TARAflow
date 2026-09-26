// tests/unit/features/threats/services/per-element/element-generator.dataflow-properties.test.ts
//
// Per-element generation built the data-flow element WITHOUT its properties,
// so data-flow property modifiers (e.g. exposureLevel EL0 → no S, no I) never
// took effect in per-element mode — while per-interaction applied them.
// Observed on SmokeDetector: EL0 flows kept their I threats.

import { describe, it, expect } from "vitest";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import type { ThreatConfiguration, ThreatProjectData } from "features/threats/models/threat-types";

const config = { activeMethod: "per-element", forceClassicMode: false } as unknown as ThreatConfiguration;

function project(flowProps: Record<string, unknown>): ThreatProjectData {
  const el = (id: string, type: string) => ({ id, type, name: id, displayId: id });
  return {
    threats: null,
    dfdGraph: {
      elementsById: new Map([
        ["p1", el("p1", "Process")],
        ["ds1", el("ds1", "DataStore")],
      ]),
      connectionsById: new Map([
        ["df1", { id: "df1", from: "p1", to: "ds1", name: "write data", displayId: "DF-1", properties: flowProps }],
      ]),
      effectiveElementTrustBoundary: new Map<string, string | null>([
        // different sides → the flow lands in the cross-boundary "Data Flows" table
        ["p1", null],
        ["ds1", null],
      ]),
      elementPhysicalBoundaries: new Map(),
      elementChipBoundaries: new Map(),
    },
    assetDataRef: { assets: [] },
  } as unknown as ThreatProjectData;
}

const flowCategories = (props: Record<string, unknown>) =>
  elementThreatGenerator
    .generateThreatsForProject(project(props), config)
    .flatMap((t) => t.threats)
    .filter((t) => t.linkedElement?.elementId === "df1")
    .map((t) => t.strideCategory)
    .sort();

describe("per-element data flows honour their properties", () => {
  it("without properties: full DataFlow base (T, I, D)", () => {
    expect(flowCategories({})).toEqual(["D", "I", "T"]);
  });

  it("EL0 (internal, trusted) removes I", () => {
    expect(flowCategories({ exposureLevel: "EL0" })).toEqual(["D", "T"]);
  });

  it("excludeFromThreatGen still removes the flow entirely", () => {
    expect(flowCategories({ excludeFromThreatGen: true })).toEqual([]);
  });
});
