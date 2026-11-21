// EN 50742 safety zone (O18, user 2026-11-21): a mark on a trust boundary,
// asked in EN 50742 projects (and wherever it is set); a flow crossing the
// zone's border without an Interface gets a warning — the interface carries
// the exposure level EN 50742 assesses.
import { describe, expect, it } from "vitest";
import { validateSafetyZoneCrossings } from "features/dfd/services/validators/connection-validator";
import { MODEL_CONDITIONS, MODEL_FIELDS, isFieldShown, safetyZoneIds, visibilityContexts, type VisibilityElement } from "shared";
import type { DFDConnection, DFDElement, ValidationFinding } from "features/dfd/models/dfd-types";
import type { DFDGraph } from "features/dfd/models/dfd-graph-types";

const tb = (id: string, props: Record<string, unknown> = {}) => ({ id, type: "TrustBoundary", properties: { boundaryType: "network", ...props } });
const zone = tb("SZ", { safetyZone: "yes" });
const flow = (id: string) => ({ id, displayId: id, name: id, from: "a", to: "b" }) as unknown as DFDConnection;
const graph = (analysis: Record<string, { from: string[]; to: string[]; interfaces: string[] }>) =>
  ({
    dataFlowAnalysis: new Map(
      Object.entries(analysis).map(([id, a]) => [id, { fromTrustBoundaryIds: a.from, toTrustBoundaryIds: a.to, interfaceIds: a.interfaces }]),
    ),
  }) as unknown as DFDGraph;

describe("safety zone — the mark", () => {
  const field = MODEL_FIELDS.find((f) => f.property === "safetyZone")!;
  const shown = (element: VisibilityElement, en50742: boolean) =>
    isFieldShown(field, visibilityContexts([element], [], { en50742 })(element.id)!);

  it("asked on trust boundaries in EN 50742 projects, and wherever it is set", () => {
    expect(shown(tb("T1"), true)).toBe(true);
    expect(shown(tb("T1"), false)).toBe(false);
    expect(shown(zone, false)).toBe(true); // can be taken back after the tag is removed
    expect(MODEL_CONDITIONS.safetyZoneAsked({ element: { id: "p", type: "Process", properties: {} }, incoming: [], outgoing: [], model: { hasMultiprocess: false, en50742: true } })).toBe(false);
  });

  it("safetyZoneIds: the marked trust boundaries only", () => {
    expect(safetyZoneIds([zone, tb("T2"), tb("T3", { safetyZone: "no" }), { id: "PB", type: "PhysicalBoundary", properties: { safetyZone: "yes" } }])).toEqual(["SZ"]);
  });
});

describe("validateSafetyZoneCrossings", () => {
  const run = (elements: unknown[], g: DFDGraph) => {
    const warnings: ValidationFinding[] = [];
    validateSafetyZoneCrossings([flow("DF-1"), flow("DF-2"), flow("DF-3")], elements as DFDElement[], warnings, g);
    return warnings.map((w) => w.elementId);
  };
  const g = graph({
    "DF-1": { from: ["NET"], to: ["NET", "SZ"], interfaces: [] }, // into the zone, no interface
    "DF-2": { from: ["NET", "SZ"], to: ["NET"], interfaces: ["IF-1"] }, // out of the zone, through IF-1
    "DF-3": { from: ["NET", "SZ"], to: ["NET", "SZ"], interfaces: [] }, // inside the zone
  });

  it("warns for a crossing without an interface — not for one with an interface, not inside", () => {
    expect(run([zone, tb("NET")], g)).toEqual(["DF-1"]);
  });

  it("no safety zone: no warning", () => {
    expect(run([tb("SZ"), tb("NET")], g)).toEqual([]);
  });
});
