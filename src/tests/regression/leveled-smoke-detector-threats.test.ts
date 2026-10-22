// Leveled-DFD Phase 2 gate, part 2c (leveled-dfd-multi-diagram-design.md §13):
// the analysis graph of the three-page SmokeDetector and the threats generated
// from it must equal the single page — same records, same assets, only the
// drawing is split over Top / Sensor Head / Smoke Detector Controller.
import { describe, it, expect } from "vitest";
import { buildDfdGraph } from "features/dfd/services/build-dfd-graph";
import { DFDGraphAnalysisContext } from "features/dfd/adapters/dfd-graph-analysis-context";
import type {
  DFDConnection,
  DFDElement,
  DFDPage,
} from "features/dfd/models/dfd-types";
import type { DFDGraph } from "features/dfd/models/dfd-graph-types";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { buildAssetDataReference } from "app/utils/build-asset-data-reference";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import { interactionThreatGenerator } from "features/threats/services/per-interaction/interaction-generator";
import type {
  ThreatConfiguration,
  ThreatProjectData,
  ThreatTable,
} from "features/threats/models/threat-types";
import type { Asset } from "features/assets/models/asset-types";
import fixture from "../fixtures/leveled/smoke-detector-leveled.json";

const connections = fixture.connections as unknown as DFDConnection[];
const single = buildDfdGraph({
  xml: fixture.singlePageXml,
  elements: fixture.singleElements as unknown as DFDElement[],
  connections,
  assets: [],
});
const leveled = buildDfdGraph({
  xml: fixture.leveledXml,
  pages: fixture.pages as DFDPage[],
  elements: fixture.leveledElements as unknown as DFDElement[],
  connections,
  assets: [],
});

const plain = (map: Map<string, unknown>) =>
  Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));
// Member lists of a boundary follow the element order, which is page order
// in a leveled DFD — compared as sets (the threats below prove the order
// does not matter).
const asSets = (map: Map<string, unknown>) =>
  Object.fromEntries(
    [...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v]),
  );

describe("leveled SmokeDetector — analysis graph (Phase 2c)", () => {
  it("has the single-page elements and flows — the decomposed MPs are gone", () => {
    expect([...leveled.elementsById.keys()].sort()).toEqual(
      [...single.elementsById.keys()].sort(),
    );
    expect([...leveled.connectionsById.keys()].sort()).toEqual(
      [...single.connectionsById.keys()].sort(),
    );
  });

  it("has the same boundary membership, nesting and effective trust boundaries", () => {
    for (const key of [
      "elementTrustBoundaries",
      "trustBoundaryElements",
      "elementChipBoundaries",
      "chipBoundaryElements",
      "elementPhysicalBoundaries",
      "physicalBoundaryElements",
      "trustBoundaryHierarchy",
      "effectiveElementTrustBoundary",
    ] as const) {
      expect({
        key,
        value: asSets(leveled[key] as Map<string, unknown>),
      }).toEqual({
        key,
        value: asSets(single[key] as Map<string, unknown>),
      });
    }
  });

  it("analyses every flow identically (endpoints, crossings, interfaces)", () => {
    expect(plain(leveled.dataFlowAnalysis)).toEqual(
      plain(single.dataFlowAnalysis),
    );
  });
});

// ---------------------------------------------------------------------------

function threatsOf(graph: DFDGraph): string[] {
  const data = {
    threats: null,
    dfdGraph: toReferenceGraph(graph),
    assetDataRef: buildAssetDataReference(
      fixture.assets as unknown as Asset[],
      {},
      fixture.impactScale as "4-level",
    ),
  } as unknown as ThreatProjectData;
  const context = new DFDGraphAnalysisContext(graph);
  const tables: ThreatTable[] = [
    ...elementThreatGenerator.generateThreatsForProject(data, {
      activeMethod: "per-element",
      forceClassicMode: false,
    } as unknown as ThreatConfiguration),
    ...interactionThreatGenerator.generateThreatsForProject(data, context),
  ];
  // Compare content, not the generated UUIDs and timestamps.
  return tables
    .flatMap((t) => t.threats)
    .map((t) => {
      const {
        id: _id,
        created: _created,
        lastModified: _lastModified,
        ...rest
      } = t as unknown as Record<string, unknown>;
      return JSON.stringify(rest);
    })
    .sort();
}

describe("leveled SmokeDetector — generated threats (Phase 2c)", () => {
  const singleThreats = threatsOf(single);
  const leveledThreats = threatsOf(leveled);

  it("generates threats at all", () => {
    expect(singleThreats.length).toBeGreaterThan(0);
  });

  it("generates exactly the single-page threats (element + interaction)", () => {
    expect(leveledThreats.length).toBe(singleThreats.length);
    expect(leveledThreats).toEqual(singleThreats);
  });
});
