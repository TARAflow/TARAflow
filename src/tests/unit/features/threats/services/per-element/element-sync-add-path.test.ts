import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { elementThreatSync } from "features/threats/services/per-element/element-sync";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import type { ThreatSyncStatus } from "features/threats/models/threat-types";

// ── Fakes ───────────────────────────────────────────────────────────────────
 
// Minimal DFDGraphReference: enough for the add-path (no TB membership).
function graph() {
  return {
    elementsById: new Map(),
    connectionsById: new Map(),
    effectiveElementTrustBoundary: new Map(),
  } as any;
}
 
// ThreatProjectData stub carrying the asset reference under test.
function project(
  assetDataRef: { assets: Array<{ id: string; linkedElementIds?: string[] }> },
) {
  return {
    dfdGraph: graph(),
    threats: null,
    assetDataRef,
  } as any;
}
 
// A sync status whose only pending work is the supplied missing element(s).
function syncStatus(partial: Partial<ThreatSyncStatus["missingInThreats"]>): ThreatSyncStatus {
  return {
    inSync: false,
    missingInThreats: {
      elements: partial.elements ?? [],
      dataFlows: partial.dataFlows ?? [],
    },
    orphanedThreats: { elementIds: [], dataFlowIds: [], threatIds: [] },
    changedReferences: { elements: [], dataFlows: [] },
    summary: {
      missingElementCount: 0,
      missingDataFlowCount: 0,
      orphanedThreatCount: 0,
      changedReferenceCount: 0,
    },
    lastChecked: "test",
  };
}
 
const NO_OP = { updateReferences: false, removeOrphaned: false };
 
// Infer the concrete MockInstance type (annotating vi.spyOn directly widens
// to MockInstance<unknown[], unknown>, which won't match the overload).
function spyOnGenerator() {
  return vi.spyOn(elementThreatGenerator, "generateThreatsForSingleElement");
}
 
// ── Tests ───────────────────────────────────────────────────────────────────
 
describe("synchronizeThreats add-path wires the asset index into the generator", () => {
  let spy: ReturnType<typeof spyOnGenerator>;
 
  beforeEach(() => {
    // Stub the generator: we assert what it RECEIVES, not what it produces,
    // so the real strategy / catalog / i18n never run. Deterministic.
    spy = spyOnGenerator().mockReturnValue([]);
  });
 
  afterEach(() => spy.mockRestore());
 
  it("passes linkedAssetIds for a newly synced element (not an empty map)", () => {
    const missing = {
      id: "P1",
      type: "Process",
      name: "Proc",
      displayId: "P-1",
    } as any;
 
    elementThreatSync.synchronizeThreats(
      project({ assets: [{ id: "A-1", linkedElementIds: ["P1"] }] }),
      {} as any, // dfdContext — ignored by synchronizeThreats
      [],
      syncStatus({ elements: [missing] }),
      NO_OP,
    );
 
    expect(spy).toHaveBeenCalledTimes(1);
    // 5th positional arg (index 4) is the elementToAssets map.
    const elementToAssets = spy.mock.calls[0][4] as Map<string, string[]>;
    expect(elementToAssets.get("P1")).toEqual(["A-1"]);
  });
 
  it("passes linkedAssetIds for a newly synced data flow", () => {
    const missingDf = {
      id: "DF1",
      displayId: "DF-1",
      label: "flow",
    } as any;
 
    elementThreatSync.synchronizeThreats(
      project({ assets: [{ id: "A-2", linkedElementIds: ["DF1"] }] }),
      {} as any,
      [],
      syncStatus({ dataFlows: [missingDf] }),
      NO_OP,
    );
 
    const dfCall = spy.mock.calls.find((c) => (c[0] as any).id === "DF1");
    expect(dfCall).toBeDefined();
    const elementToAssets = dfCall![4] as Map<string, string[]>;
    expect(elementToAssets.get("DF1")).toEqual(["A-2"]);
  });
 
  it("passes an empty (but valid) map when the element has no linked assets", () => {
    const missing = {
      id: "P9",
      type: "Process",
      name: "Lonely",
      displayId: "P-9",
    } as any;
 
    elementThreatSync.synchronizeThreats(
      project({ assets: [{ id: "A-1", linkedElementIds: ["P1"] }] }), // links P1, not P9
      {} as any,
      [],
      syncStatus({ elements: [missing] }),
      NO_OP,
    );
 
    const elementToAssets = spy.mock.calls[0][4] as Map<string, string[]>;
    expect(elementToAssets.get("P9")).toBeUndefined();
    // The index is still the real shared structure, just without an entry for P9.
    expect(elementToAssets instanceof Map).toBe(true);
  });
});
