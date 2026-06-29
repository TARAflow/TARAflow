import { describe, it, expect, vi, afterEach } from "vitest";
import { elementThreatSync } from "features/threats/services/per-element/element-sync";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";

// ── Fakes ───────────────────────────────────────────────────────────────────

// A DFDGraphReference holding a single element, no connections, no TBs.
function graphWith(element: { id: string; type: string; name: string; displayId: string }) {
  return {
    elementsById: new Map([[element.id, element]]),
    connectionsById: new Map(),
    effectiveElementTrustBoundary: new Map(),
  } as any;
}

function project(element: { id: string; type: string; name: string; displayId: string }) {
  return { dfdGraph: graphWith(element), threats: null } as any;
}

function spyOnEffective() {
  return vi.spyOn(elementThreatGenerator, "getEffectiveStrideCategories");
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("checkSyncStatus uses effective STRIDE categories for missing detection", () => {
  let spy: ReturnType<typeof spyOnEffective>;

  afterEach(() => spy.mockRestore());

  it("does NOT flag an element whose categories are all eliminated", () => {
    // e.g. an internal, authenticated ExternalEntity where both S and R are removed.
    const ee = { id: "189", type: "ExternalEntity", name: "Operator", displayId: "EE-2" };
    spy = spyOnEffective().mockReturnValue([]); // generator would produce nothing

    const status = elementThreatSync.checkSyncStatus(project(ee), []);

    expect(status.missingInThreats.elements).toHaveLength(0);
    expect(status.inSync).toBe(true);
  });

  it("DOES flag an element that has effective categories but no threats yet", () => {
    const ee = { id: "174", type: "ExternalEntity", name: "Mobile/Browser", displayId: "EE-1" };
    spy = spyOnEffective().mockReturnValue(["S"] as any);

    const status = elementThreatSync.checkSyncStatus(project(ee), []);

    expect(status.missingInThreats.elements.map((e) => e.id)).toContain("174");
    expect(status.inSync).toBe(false);
  });

  it("does NOT flag a non-ExternalEntity element with no effective categories", () => {
    // e.g. a Sensor with no STRIDE entry today — must not produce a phantom warning.
    const sensor = { id: "206", type: "Sensor", name: "Photometer", displayId: "SE-1" };
    spy = spyOnEffective().mockReturnValue([]);

    const status = elementThreatSync.checkSyncStatus(project(sensor), []);

    expect(status.missingInThreats.elements).toHaveLength(0);
  });
});