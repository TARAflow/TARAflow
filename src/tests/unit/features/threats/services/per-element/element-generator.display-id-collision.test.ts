// tests/unit/features/threats/services/per-element/element-generator.display-id-collision.test.ts
//
// Threat display labels derive from the element's displayId, which is not
// unique across element kinds. The generator's final dedup was keyed on the
// display label alone, so a PhysicalBoundary and a ChipBoundary both labelled
// "SDC" produced identical labels (SDC-T-1 …) and the chip boundary's threats
// were silently dropped (observed on SmokeDetector: "Smoke Detector Case [SDC]"
// vs "Smoke Detector Controller [SDC]").

import { describe, it, expect } from "vitest";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import type { ThreatConfiguration, ThreatProjectData } from "features/threats/models/threat-types";

const config = { activeMethod: "per-element", forceClassicMode: false } as unknown as ThreatConfiguration;

function project(): ThreatProjectData {
  const pb = { id: "pb-1", type: "PhysicalBoundary", name: "Case", displayId: "SDC", properties: {} };
  const cb = { id: "cb-2", type: "ChipBoundary", name: "Controller", displayId: "SDC", properties: {} };
  return {
    threats: null,
    dfdGraph: {
      elementsById: new Map([
        [pb.id, pb],
        [cb.id, cb],
      ]),
      connectionsById: new Map(),
      effectiveElementTrustBoundary: new Map<string, string | null>(),
      elementPhysicalBoundaries: new Map(),
      elementChipBoundaries: new Map(),
    },
    assetDataRef: { assets: [] },
  } as unknown as ThreatProjectData;
}

const threatsOf = (elementId: string) =>
  elementThreatGenerator
    .generateThreatsForProject(project(), config)
    .flatMap((t) => t.threats)
    .filter((t) => t.linkedElement?.elementId === elementId);

describe("same displayId on different elements", () => {
  it("both elements keep their threats — including the overlapping categories", () => {
    const cats = (id: string) => threatsOf(id).map((t) => t.strideCategory);
    // T, I, E are generated for both → their labels (SDC-T-1, SDC-I-1, SDC-E-1)
    // coincide; each element must still keep its own.
    for (const c of ["T", "I", "E"]) {
      expect(cats("pb-1")).toContain(c);
      expect(cats("cb-2")).toContain(c);
    }
  });
});
