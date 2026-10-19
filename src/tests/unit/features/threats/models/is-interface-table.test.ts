// isInterfaceTable — per-interaction tables of interfaces render by
// element, not by data flow. Reported with leveled DFD 6a: a table filtered
// to a group (D20) that starts with a threat of the enclosure itself was
// taken for a flow table and rendered empty.
import { describe, it, expect } from "vitest";
import { isInterfaceTable, type Threat, type ThreatTable } from "features/threats/models/threat-types";

const elementThreat = (elementType: string) =>
  ({ linkedElement: { elementId: "x", elementType }, dataFlow: null }) as unknown as Threat;
const flowThreat = () =>
  ({ linkedElement: null, dataFlow: { connectionId: "df" } }) as unknown as Threat;
const table = (threats: Threat[]): ThreatTable => ({
  trustBoundaryId: "PB-1",
  trustBoundaryName: "Sensor Head Enclosure [SHE]",
  displayIdentifier: "[SHE]",
  threats,
});

describe("isInterfaceTable", () => {
  it("is an interface table when no threat is bound to a flow", () => {
    expect(isInterfaceTable(table([elementThreat("Interface"), elementThreat("PhysicalBoundary")]))).toBe(true);
  });

  it("stays one when filtered to the enclosure's own threats", () => {
    expect(isInterfaceTable(table([elementThreat("PhysicalBoundary")]))).toBe(true);
  });

  it("is a flow table as soon as threats are bound to flows, and never when empty", () => {
    expect(isInterfaceTable(table([flowThreat(), flowThreat()]))).toBe(false);
    expect(isInterfaceTable(table([]))).toBe(false);
  });
});
