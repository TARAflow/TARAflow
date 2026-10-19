// Physical boundary (enclosure) threats. An enclosure has no flows and no
// interaction partners: both methods take its threats from the physical
// element templates. The per-interaction method used the flow templates with
// sender = receiver = enclosure ("Attacker impersonates Sensor Head
// Enclosure to deceive Sensor Head Enclosure"). Impersonation of personnel
// and a missing audit trail only apply to cabinets, rooms and buildings; a
// category without a matching template gets no threat (no generic fallback).
// A boundary inside a trust boundary keeps its threats in its own table.
import { describe, it, expect } from "vitest";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import { interactionThreatGenerator } from "features/threats/services/per-interaction/interaction-generator";
import type {
  Threat,
  ThreatConfiguration,
  ThreatProjectData,
  ThreatTable,
} from "features/threats/models/threat-types";
import type { DFDAnalysisContext } from "shared";

const ENCLOSURE = {
  boundaryType: "device_enclosure",
  accessibility: "controlled",
  monitoringType: "none",
  physicalMobility: "fixed",
  debugInterfaceAccessible: false,
  removableMediaAccessible: false,
  tamperProtection: "none",
};

function project(pbProps: Record<string, unknown>): ThreatProjectData {
  const tb = { id: "tb", type: "TrustBoundary", name: "Sensor Boundary", displayId: "SB", properties: {} };
  const p = { id: "p1", type: "Process", name: "Sensor Logic", displayId: "P-1", properties: {} };
  const pb = { id: "pb", type: "PhysicalBoundary", name: "Sensor Head Enclosure", displayId: "SHE", properties: pbProps };
  return {
    threats: null,
    dfdGraph: {
      elementsById: new Map([
        [tb.id, tb],
        [p.id, p],
        [pb.id, pb],
      ]),
      connectionsById: new Map(),
      // The enclosure lies inside the trust boundary.
      effectiveElementTrustBoundary: new Map<string, string | null>([
        ["p1", "tb"],
        ["pb", "tb"],
      ]),
      elementPhysicalBoundaries: new Map(),
      elementChipBoundaries: new Map(),
    },
    assetDataRef: { assets: [] },
  } as unknown as ThreatProjectData;
}

const perElement = (data: ThreatProjectData) =>
  elementThreatGenerator.generateThreatsForProject(data, {
    activeMethod: "per-element",
    forceClassicMode: false,
  } as unknown as ThreatConfiguration);

const noFlows = { getDataFlows: () => [], getElement: () => undefined } as unknown as DFDAnalysisContext;
const perInteraction = (data: ThreatProjectData) =>
  interactionThreatGenerator.generateThreatsForProject(data, noFlows);

const pbThreats = (tables: ThreatTable[]): Threat[] =>
  tables.flatMap((t) => t.threats).filter((t) => t.linkedElement?.elementId === "pb");
const templates = (threats: Threat[]) => threats.map((t) => `${t.strideCategory}:${t.templateId}`);

describe("physical boundary threats — per element", () => {
  it("are listed in the enclosure's own table, not in the trust boundary's", () => {
    const tables = perElement(project(ENCLOSURE));
    const own = tables.find((t) => t.trustBoundaryId === "pb");
    const tb = tables.find((t) => t.trustBoundaryId === "tb");
    expect(own?.threats.length).toBeGreaterThan(0);
    expect(own?.threats.every((t) => t.linkedElement?.elementId === "pb")).toBe(true);
    expect(tb?.threats.some((t) => t.linkedElement?.elementId === "pb")).toBe(false);
  });

  it("a device enclosure gets no impersonation and no audit-trail threat", () => {
    expect(templates(pbThreats(perElement(project(ENCLOSURE))))).toEqual([
      "T:T-001",
      "I:I-005",
      "D:D-007",
      "E:E-010",
    ]);
  });

  it("a room gets them", () => {
    const room = { ...ENCLOSURE, boundaryType: "room" };
    expect(templates(pbThreats(perElement(project(room))))).toEqual([
      "S:S-008",
      "T:T-001",
      "R:R-012",
      "I:I-005",
      "D:D-007",
      "E:E-010",
    ]);
  });

  it("opening and destruction propose the tamper-resistant enclosure; opening also active tamper protection", () => {
    const threats = pbThreats(perElement(project(ENCLOSURE)));
    const mitigations = (c: string) =>
      threats.find((t) => t.strideCategory === c)?.proposedMitigations.map((m) => m.id);
    expect(mitigations("T")).toEqual(expect.arrayContaining(["M-PB-T-006", "M-PB-T-002"]));
    expect(mitigations("D")).toContain("M-PB-T-006");
  });

  it("the effective categories (sync, drift) match what is generated", () => {
    const data = project(ENCLOSURE);
    const pb = data.dfdGraph!.elementsById.get("pb")!;
    expect(elementThreatGenerator.getEffectiveStrideCategories(pb, data)).toEqual(["T", "I", "D", "E"]);
  });
});

describe("physical boundary threats — per interaction", () => {
  it("come from the physical element templates, in the enclosure's table", () => {
    const tables = perInteraction(project(ENCLOSURE));
    const threats = pbThreats(tables);
    expect(templates(threats)).toEqual(["T:T-001", "I:I-005", "D:D-007", "E:E-010"]);
    expect(threats.every((t) => t.dataFlow == null && t.trustBoundaryId === "pb")).toBe(true);
  });

  it("are the same as in the per-element method", () => {
    const data = project({ ...ENCLOSURE, boundaryType: "cabinet" });
    expect(templates(pbThreats(perInteraction(data)))).toEqual(templates(pbThreats(perElement(data))));
  });
});

describe("physical boundary with interfaces — per element", () => {
  it("one table holds the interface threats and the enclosure's own threats", () => {
    const data = project(ENCLOSURE);
    const graph = data.dfdGraph as unknown as {
      elementsById: Map<string, unknown>;
      elementPhysicalBoundaries: Map<string, string[]>;
    };
    graph.elementsById.set("if1", { id: "if1", type: "Interface", name: "UART", displayId: "IF-1", properties: {} });
    graph.elementPhysicalBoundaries.set("if1", ["pb"]);
    const own = perElement(data).filter((t) => t.trustBoundaryId === "pb");
    expect(own).toHaveLength(1);
    const types = new Set(own[0].threats.map((t) => t.linkedElement?.elementType));
    expect(types).toEqual(new Set(["Interface", "PhysicalBoundary"]));
  });
});

describe("interface threats — per interaction", () => {
  it("come from the interface element templates, as in the per-element method", () => {
    const data = project(ENCLOSURE);
    const graph = data.dfdGraph as unknown as {
      elementsById: Map<string, unknown>;
      elementPhysicalBoundaries: Map<string, string[]>;
    };
    graph.elementsById.set("if1", {
      id: "if1",
      type: "Interface",
      name: "UART",
      displayId: "IF-1",
      properties: { type: "rs485", location: "field_accessible" },
    });
    graph.elementPhysicalBoundaries.set("if1", ["pb"]);
    const ifThreats = (tables: ThreatTable[]) =>
      tables.flatMap((t) => t.threats).filter((t) => t.linkedElement?.elementId === "if1");
    const tables = perInteraction(data);
    const interaction = ifThreats(tables);
    expect(interaction.length).toBeGreaterThan(0);
    expect(templates(interaction)).toEqual(templates(ifThreats(perElement(data))));
    // In the enclosure's table, no flow perspective.
    expect(interaction.every((t) => t.dataFlow == null && t.interactionContext == null)).toBe(true);
    expect(tables.find((t) => t.trustBoundaryId === "pb")?.threats).toEqual(
      expect.arrayContaining(interaction),
    );
  });
});
