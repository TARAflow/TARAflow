import { describe, it, expect, afterEach, vi } from "vitest";
// NOTE: align relative paths with the sibling tests in this folder.
import { elementThreatSync } from "../../features/threats/services/per-element/element-sync";
import { elementThreatGenerator } from "../../features/threats/services/per-element/element-generator";
import type {
  ThreatProjectData,
  ThreatTable,
} from "../../features/threats/models/threat-types";

/**
 * Round-trip of the silent Class A path for a renumber: after the element's
 * displayId changes (P-1 → P-2), checkSyncStatus must report the id drift with
 * a regenerated newId, applyChangedReferences must rewrite the threat id, and a
 * second checkSyncStatus must then report inSync — i.e. the drift truly clears
 * (the original bug left it detected forever).
 */

function buildProject(displayId: string, threatId: string): ThreatProjectData {
  const element = {
    id: "e1",
    type: "Process",
    name: "Auth",
    displayId,
    properties: {},
  };
  const table: ThreatTable = {
    trustBoundaryId: null,
    trustBoundaryName: "No Trust Boundary",
    threats: [
      {
        id: threatId,
        strideCategory: "S",
        sequenceNumber: 1,
        linkedElement: {
          elementId: "e1",
          elementName: "Auth",
          elementType: "Process",
          displayId: "P-1",
        },
        trustBoundaryId: null,
      },
    ],
  } as unknown as ThreatTable;

  return {
    dfdGraph: {
      elementsById: new Map([["e1", element]]),
      connectionsById: new Map(),
    },
    threats: {
      configuration: { activeMethod: "per-element" },
      perElementTables: [table],
      perInteractionTables: [],
      lastModified: new Date().toISOString(),
    },
    assetDataRef: { assets: [] },
  } as unknown as ThreatProjectData;
}

describe("renumber round-trip (Class A)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects the id drift, regenerates the id, then reports inSync", () => {
    // No missing/orphaned noise — the only element is already threatened.
    vi.spyOn(
      elementThreatGenerator,
      "getEffectiveStrideCategories",
    ).mockReturnValue([] as any);

    // Element renumbered to P-2; threat still carries the old id P1-S-1.
    const project = buildProject("P-2", "P1-S-1");
    const tables = project.threats!.perElementTables;

    const status1 = elementThreatSync.checkSyncStatus(project, tables);
    const change = status1.changedReferences.elements.find(
      (c) => c.threatId === "P1-S-1",
    );
    expect(change).toBeDefined();
    expect(change!.changes).toContain("id");
    expect(change!.newId).toBe("P2-S-1");

    const { tables: updatedTables, updated } =
      elementThreatSync.applyChangedReferences(
        tables,
        status1.changedReferences.elements,
      );
    expect(updated).toBe(1);
    expect(updatedTables[0].threats[0].id).toBe("P2-S-1");

    // Re-check against a project that now reflects the applied tables.
    const project2 = {
      ...project,
      threats: { ...project.threats!, perElementTables: updatedTables },
    } as ThreatProjectData;

    const status2 = elementThreatSync.checkSyncStatus(project2, updatedTables);
    expect(status2.changedReferences.elements).toHaveLength(0);
    expect(status2.inSync).toBe(true);
  });
});
