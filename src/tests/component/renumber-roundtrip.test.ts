import { describe, it, expect, afterEach, vi } from "vitest";
// NOTE: align relative paths with the sibling tests in this folder.
import { elementThreatSync } from "../../features/threats/services/per-element/element-sync";
import { elementThreatGenerator } from "../../features/threats/services/per-element/element-generator";
import type {
  ThreatProjectData,
  ThreatTable,
} from "../../features/threats/models/threat-types";

/**
 * Round-trip of the silent Class A path for a renumber under the identity
 * split (schema v5): after the element's displayId changes (P-1 → P-2),
 * checkSyncStatus must report the drift with a regenerated newDisplayId,
 * applyChangedReferences must rewrite threat.DISPLAYID while leaving the stable
 * threat.id (UUID) untouched, and a second checkSyncStatus must report inSync.
 * The threat's identity surviving the renumber is the whole point of the fix.
 */

const STABLE_ID = "uuid-threat-stable-0001";

function buildProject(displayId: string, threatDisplayId: string): ThreatProjectData {
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
        id: STABLE_ID,
        displayId: threatDisplayId,
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

describe("renumber round-trip (Class A, identity split)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the UUID id stable, regenerates displayId, then reports inSync", () => {
    vi.spyOn(
      elementThreatGenerator,
      "getEffectiveStrideCategories",
    ).mockReturnValue([] as any);

    // Element renumbered to P-2; threat still carries the old label P1-S-1
    // but its stable UUID id must not move.
    const project = buildProject("P-2", "P1-S-1");
    const tables = project.threats!.perElementTables;

    const status1 = elementThreatSync.checkSyncStatus(project, tables);
    const change = status1.changedReferences.elements.find(
      (c) => c.threatId === STABLE_ID,
    );
    expect(change).toBeDefined();
    expect(change!.changes).toContain("id");
    expect(change!.newDisplayId).toBe("P2-S-1");

    const { tables: updatedTables, updated } =
      elementThreatSync.applyChangedReferences(
        tables,
        status1.changedReferences.elements,
      );
    expect(updated).toBe(1);
    // Identity preserved, label regenerated.
    expect(updatedTables[0].threats[0].id).toBe(STABLE_ID);
    expect(updatedTables[0].threats[0].displayId).toBe("P2-S-1");

    const project2 = {
      ...project,
      threats: { ...project.threats!, perElementTables: updatedTables },
    } as ThreatProjectData;

    const status2 = elementThreatSync.checkSyncStatus(project2, updatedTables);
    expect(status2.changedReferences.elements).toHaveLength(0);
    expect(status2.inSync).toBe(true);
  });
});
