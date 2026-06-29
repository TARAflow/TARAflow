// ==================== RC-2 — Sensor/Actuator coverage pass ====================
// Phase: per-element generation fix, Step 3.
//
// Problem: generateThreatsForProject reaches Process/DataStore/Multiprocess/Sensor/
// Actuator ONLY via the trust-boundary pass (graph.effectiveElementTrustBoundary).
// A Sensor or Actuator OUTSIDE any TrustBoundary is never iterated → zero threats,
// silently. In EdGe2, SE-1 (206) only survives because it sits inside the LB
// boundary; the sync fixture encodes this as realStrategyMissing: ["206"].
//
// RED before fix:  a Sensor placed outside every TrustBoundary yields no table.
// GREEN after fix: a fallback pass emits its base [T,D] threats.
//
// NOTE: this is an integration-level test — it drives the full generator, which
// performs a catalog lookup. It assumes the same i18n/catalog test bootstrap the
// existing per-element golden tests already rely on. If your harness lacks it,
// either reuse that setup file or assert at the category level via
// elementThreatGenerator.getEffectiveStrideCategories (which needs no catalog) and
// keep the iteration assertion in the integration suite.

import { describe, it, expect } from "vitest";
import {
  ElementThreatGenerator,
  elementThreatGenerator,
} from "../../../../../../features/threats/services/per-element/element-generator";
import type {
  ThreatProjectData,
  ThreatTable,
} from "features/threats";
import type { DFDElementReference } from "shared";

/** A Sensor that belongs to no TrustBoundary, PhysicalBoundary or ChipBoundary. */
const orphanSensor: DFDElementReference = {
  id: "900",
  type: "Sensor",
  name: "Standalone Photometer",
  displayId: "SE-9",
} as DFDElementReference;

/** Minimal DFD graph with a single, boundary-less Sensor. */
function graphWithOrphanSensor() {
  return {
    elementsById: new Map<string, DFDElementReference>([[orphanSensor.id, orphanSensor]]),
    connectionsById: new Map(),
    effectiveElementTrustBoundary: new Map<string, string | null>([[orphanSensor.id, null]]),
    elementPhysicalBoundaries: new Map<string, string[]>(),
    elementChipBoundaries: new Map<string, string[]>(),
  };
}

function projectWithOrphanSensor(): ThreatProjectData {
  return {
    dfdGraph: graphWithOrphanSensor(),
    assetDataRef: { assets: [] }, // no asset link → CIANAAA inactive → base [T,D]
  } as unknown as ThreatProjectData;
}

function allThreats(tables: ThreatTable[]) {
  return tables.flatMap((t) => t.threats);
}

describe("Sensor/Actuator coverage (RC-2)", () => {
  it("generates threats for a Sensor that sits outside every boundary", () => {
    const tables = elementThreatGenerator.generateThreatsForProject(
      projectWithOrphanSensor(),
    );
    const sensorThreats = allThreats(tables).filter(
      (th) => th.linkedElement?.elementType === "Sensor",
    );
    expect(sensorThreats.length).toBeGreaterThan(0);
  });

  it("emits the full base table [T,D] for an unlinked orphan Sensor", () => {
    const tables = elementThreatGenerator.generateThreatsForProject(
      projectWithOrphanSensor(),
    );
    const cats = new Set(
      allThreats(tables)
        .filter((th) => th.linkedElement?.elementId === orphanSensor.id)
        .map((th) => th.strideCategory),
    );
    expect(cats).toEqual(new Set(["T", "D"]));
  });

  it("category-level pipeline already returns [T,D] for the orphan Sensor (regression anchor)", () => {
    // getEffectiveStrideCategories needs no catalog; it proves the strategy is
    // correct independently of the iteration fix above.
    const cats = new ElementThreatGenerator().getEffectiveStrideCategories(
      orphanSensor,
      projectWithOrphanSensor(),
    );
    expect(new Set(cats)).toEqual(new Set(["T", "D"]));
  });
});
