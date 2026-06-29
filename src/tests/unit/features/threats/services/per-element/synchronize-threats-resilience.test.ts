import { describe, it, expect, afterEach, vi } from "vitest";
// NOTE: align these relative paths with the sibling tests in this folder.
import { elementThreatSync } from "../../../../../../features/threats/services/per-element/element-sync";
import { elementThreatGenerator } from "../../../../../../features/threats/services/per-element/element-generator";
import type {
  ThreatProjectData,
  ThreatSyncStatus,
} from "../../../../../../features/threats/models/threat-types";

/**
 * The sync add-path generates threats per missing element/data flow. A type the
 * strategy or templates don't fully support yet (e.g. a freshly added
 * Sensor/Actuator) can throw during generation. That single failure must NOT
 * abort the whole batch — otherwise one unsupported element silently kills
 * renumber/rename/property sync. These tests pin the per-element/per-dataflow
 * try/catch guards.
 */

type RefElement = {
  id: string;
  type: string;
  name: string;
  displayId: string;
  properties: Record<string, unknown>;
};

function el(
  id: string,
  type: string,
  displayId: string,
): RefElement {
  return { id, type, name: `${type} ${id}`, displayId, properties: {} };
}

function projectWith(elements: RefElement[]): ThreatProjectData {
  const elementsById = new Map<string, RefElement>();
  for (const e of elements) elementsById.set(e.id, e);
  return {
    dfdGraph: {
      elementsById,
      connectionsById: new Map(),
      // Real DFDGraphReference field read by getElementTrustBoundary; empty map
      // → every element resolves to "No Trust Boundary" (fine for this test).
      effectiveElementTrustBoundary: new Map(),
    },
    threats: null,
    // P1 links asset A-1 so we can also assert the index reaches the generator.
    assetDataRef: {
      assets: [{ id: "A-1", linkedElementIds: ["P1"] }],
    },
  } as unknown as ThreatProjectData;
}

function statusMissing(elements: RefElement[]): ThreatSyncStatus {
  return {
    inSync: false,
    missingInThreats: { elements: elements as any, dataFlows: [] },
    orphanedThreats: { elementIds: [], dataFlowIds: [], threatIds: [] },
    changedReferences: { elements: [], dataFlows: [] },
    summary: {
      missingElementCount: elements.length,
      missingDataFlowCount: 0,
      orphanedThreatCount: 0,
      changedReferenceCount: 0,
    },
    lastChecked: new Date().toISOString(),
  } as unknown as ThreatSyncStatus;
}

const OPTS = { updateReferences: true, removeOrphaned: false };

describe("synchronizeThreats add-path resilience", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not abort the batch when one element type throws on generation", () => {
    const proc = el("P1", "Process", "P-1");
    const sensor = el("S1", "Sensor", "SE-1"); // unsupported → throws

    const spy = vi
      .spyOn(elementThreatGenerator, "generateThreatsForSingleElement")
      .mockImplementation((e: any) => {
        if (e.type === "Sensor") throw new Error("no Sensor template yet");
        return [
          {
            id: `${e.displayId}-T-1`,
            strideCategory: "T",
            sequenceNumber: 1,
            linkedElement: {
              elementId: e.id,
              elementType: e.type,
              elementName: e.name,
              displayId: e.displayId,
            },
          },
        ] as any;
      });

    const project = projectWith([proc, sensor]);
    const status = statusMissing([proc, sensor]);

    let result!: ReturnType<typeof elementThreatSync.synchronizeThreats>;
    expect(() => {
      result = elementThreatSync.synchronizeThreats(
        project,
        {} as any,
        [],
        status,
        OPTS,
      );
    }).not.toThrow();

    expect(result.success).toBe(true);
    expect(result.threatData).toBeDefined();

    // Both elements were attempted (the Sensor threw and was caught).
    expect(spy).toHaveBeenCalledTimes(2);

    const allThreats = (result.threatData!.perElementTables ?? []).flatMap(
      (t) => t.threats,
    );
    const ids = allThreats.map((t) => t.id);
    // The supported Process produced its threat; the Sensor was skipped, not fatal.
    expect(ids).toContain("P-1-T-1");
    expect(allThreats.some((t) => t.linkedElement?.elementId === "S1")).toBe(
      false,
    );
  });

  it("passes the populated asset index (not an empty map) to the generator", () => {
    const proc = el("P1", "Process", "P-1");
    const spy = vi
      .spyOn(elementThreatGenerator, "generateThreatsForSingleElement")
      .mockReturnValue([] as any);

    elementThreatSync.synchronizeThreats(
      projectWith([proc]),
      {} as any,
      [],
      statusMissing([proc]),
      OPTS,
    );

    // 5th positional arg (index 4) is the elementToAssets reverse index.
    const elementToAssets = spy.mock.calls[0][4] as Map<string, string[]>;
    expect(elementToAssets).toBeInstanceOf(Map);
    expect(elementToAssets.get("P1")).toEqual(["A-1"]);
  });

  it("survives when EVERY missing element throws (no threats added, no crash)", () => {
    const a = el("S1", "Sensor", "SE-1");
    const b = el("A1", "Actuator", "AC-1");
    vi.spyOn(
      elementThreatGenerator,
      "generateThreatsForSingleElement",
    ).mockImplementation(() => {
      throw new Error("boom");
    });

    let result!: ReturnType<typeof elementThreatSync.synchronizeThreats>;
    expect(() => {
      result = elementThreatSync.synchronizeThreats(
        projectWith([a, b]),
        {} as any,
        [],
        statusMissing([a, b]),
        OPTS,
      );
    }).not.toThrow();

    expect(result.success).toBe(true);
    const added = (result.threatData?.perElementTables ?? []).flatMap(
      (t) => t.threats,
    );
    expect(added).toHaveLength(0);
  });
});