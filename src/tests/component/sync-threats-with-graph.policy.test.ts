import { describe, it, expect, afterEach, vi } from "vitest";
// NOTE: align relative paths with the sibling tests in this folder.
import { syncThreatsWithGraph } from "../../features/threats/services/sync-threats-with-graph";
import { elementThreatGenerator } from "../../features/threats/services/per-element/element-generator";
import type { ThreatBundle } from "../../features/threats/models/threat-types";

/**
 * The live DFD-change path (syncThreatsWithGraph) implements the agreed policy:
 *   Class A — rename / renumber / retype → applied SILENTLY on every save.
 *   Class B — missing / orphaned (the SET of threats changed) → NOT touched
 *             here; it surfaces via the sync banner for an explicit decision.
 * These tests pin both halves so a future refactor can't silently re-introduce
 * auto-generation or auto-removal.
 */

function elem(id: string, name: string, displayId: string) {
  return { id, type: "Process", name, displayId, properties: {} };
}

function graphOf(elements: ReturnType<typeof elem>[]) {
  return {
    elementsById: new Map(elements.map((e) => [e.id, e])),
    connectionsById: new Map(),
  } as any;
}

function bundle(threats: any[]): ThreatBundle {
  return {
    configuration: { activeMethod: "per-element" },
    perElementTables: [
      { trustBoundaryId: null, trustBoundaryName: "No Trust Boundary", threats },
    ],
    perInteractionTables: [],
    lastModified: new Date().toISOString(),
  } as unknown as ThreatBundle;
}

function threat(id: string, eid: string, name: string, displayId: string) {
  return {
    id,
    strideCategory: "S",
    sequenceNumber: 1,
    linkedElement: {
      elementId: eid,
      elementName: name,
      elementType: "Process",
      displayId,
    },
    trustBoundaryId: null,
  };
}

const assetDataRef = { assets: [] } as any;

describe("syncThreatsWithGraph — Class A/B policy", () => {
    afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Class A: a rename is applied silently (name refreshed, count unchanged)", () => {
    vi.spyOn(elementThreatGenerator, "getEffectiveStrideCategories").mockReturnValue(
      [] as any,
    );
    // Graph says "New"; the threat still mirrors "Old". Same displayId → id stable.
    const graph = graphOf([elem("e1", "New", "P-1")]);
    const input = bundle([threat("P1-S-1", "e1", "Old", "P-1")]);

    const out = syncThreatsWithGraph(input, graph, assetDataRef)!;
    const threats = out.perElementTables![0].threats;

    expect(threats).toHaveLength(1); // non-destructive
    expect(threats[0].id).toBe("P1-S-1"); // id stable on pure rename
    expect(threats[0].linkedElement?.elementName).toBe("New"); // refreshed
  });

  it("Class B (missing): an unthreatened element is NOT auto-generated", () => {
    // Stub returns a non-empty category set → checkSyncStatus WOULD flag e2 as
    // missing. The live path must still leave the threat set untouched.
    vi.spyOn(elementThreatGenerator, "getEffectiveStrideCategories").mockReturnValue(
      ["S"] as any,
    );
    const graph = graphOf([
      elem("e1", "Auth", "P-1"), // matches its threat → no drift
      elem("e2", "Logger", "P-2"), // unthreatened → would be "missing"
    ]);
    const input = bundle([threat("P1-S-1", "e1", "Auth", "P-1")]);

    const out = syncThreatsWithGraph(input, graph, assetDataRef)!;
    const threats = out.perElementTables![0].threats;

    expect(threats).toHaveLength(1); // nothing generated for e2
    expect(threats.some((t) => t.linkedElement?.elementId === "e2")).toBe(false);
  });

  it("Class B (orphaned): a dangling threat is NOT auto-removed", () => {
    vi.spyOn(elementThreatGenerator, "getEffectiveStrideCategories").mockReturnValue(
      [] as any,
    );
    // Threat points at "gone", which is absent from the graph → orphaned.
    const graph = graphOf([elem("e9", "Other", "P-9")]);
    const input = bundle([threat("P1-S-1", "gone", "Ghost", "P-1")]);

    const out = syncThreatsWithGraph(input, graph, assetDataRef)!;
    const threats = out.perElementTables![0].threats;

    expect(threats).toHaveLength(1); // orphaned threat survives
    expect(threats[0].linkedElement?.elementId).toBe("gone");
  });
});
