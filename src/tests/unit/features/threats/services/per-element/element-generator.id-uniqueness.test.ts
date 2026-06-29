// ==================== RC-5 — Threat id uniqueness / sequence ====================
// Phase: per-element generation fix, Step 5 (low priority).
//
// Invariant: a full project regeneration must never emit two threats with the same
// id across all tables (the end-of-run dedup keys on threat.id). The saved EdGe2
// file showed sync-merge residue (e.g. DF1-I-1 in both [TB] and [DF]); this pins
// the invariant so it cannot regress, and documents the hardcoded sequenceNumber.

import { describe, it, expect } from "vitest";
import { elementThreatGenerator } from "../../../../../../features/threats/services/per-element/element-generator";
import { generateThreatIdPerElement } from "../../../../../../features/threats/models/per-element-types";
import type { ThreatProjectData } from "features/threats";
import type { DFDElementReference } from "shared";

const sensor: DFDElementReference = {
  id: "900",
  type: "Sensor",
  name: "Standalone Photometer",
  displayId: "SE-9",
} as DFDElementReference;

const store: DFDElementReference = {
  id: "901",
  type: "DataStore",
  name: "Local Buffer",
  displayId: "DS-9",
} as DFDElementReference;

function project(): ThreatProjectData {
  return {
    dfdGraph: {
      elementsById: new Map([
        [sensor.id, sensor],
        [store.id, store],
      ]),
      connectionsById: new Map(),
      effectiveElementTrustBoundary: new Map<string, string | null>([
        [sensor.id, null],
        [store.id, null],
      ]),
      elementPhysicalBoundaries: new Map<string, string[]>(),
      elementChipBoundaries: new Map<string, string[]>(),
    },
    assetDataRef: { assets: [] },
  } as unknown as ThreatProjectData;
}

describe("Threat id uniqueness (RC-5)", () => {
  it("emits no duplicate threat ids across all generated tables", () => {
    const tables = elementThreatGenerator.generateThreatsForProject(project());
    const ids = tables.flatMap((t) => t.threats.map((th) => th.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("id format is {ElementID}-{STRIDE}-{Seq} with dashes stripped from the element id", () => {
    expect(generateThreatIdPerElement("SE-9", "T", 1)).toBe("SE9-T-1");
    expect(generateThreatIdPerElement("DS-9", "D", 2)).toBe("DS9-D-2");
  });

  // Once createThreatForElement increments per (element, category) instead of the
  // hardcoded 1, replace this todo with an assertion that two same-category threats
  // on one element receive distinct sequence numbers.
  it.todo("assigns distinct sequence numbers to same-category threats on one element");
});
