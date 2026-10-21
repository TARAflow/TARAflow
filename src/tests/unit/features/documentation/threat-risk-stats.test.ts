// Report statistics (2026-10-22): per element type the threats per STRIDE
// category and the risks per risk level before mitigation, with a total
// row; one summary line per group.
import { describe, it, expect } from "vitest";
import {
  riskGroupSummary,
  riskStatsTable,
  threatElementType,
  threatGroupSummary,
  threatStatsTable,
} from "features/documentation/utils/threat-risk-stats";

const flow = (s: string) => ({ strideCategory: s, dataFlow: { connectionId: "df" }, linkedElement: null });
const el = (s: string, elementType: string) => ({ strideCategory: s, linkedElement: { elementType } });
const THREATS = [flow("T"), flow("I"), flow("D"), el("S", "Interface"), el("T", "Interface"), el("D", "PhysicalBoundary"), el("S", "Process")];
const label = (type: string) => `<${type}>`;

describe("threat statistics", () => {
  it("counts per element type and STRIDE category, in palette order, with a total", () => {
    const table = threatStatsTable(THREATS, "en", label);
    expect(table.headers).toEqual(["Element type", "Threats", "S", "T", "R", "I", "D", "E"]);
    expect(table.rows).toEqual([
      ["<Process>", "1", "1", "0", "0", "0", "0", "0"],
      ["<DataFlow>", "3", "0", "1", "0", "1", "1", "0"],
      ["<Interface>", "2", "1", "1", "0", "0", "0", "0"],
      ["<PhysicalBoundary>", "1", "0", "0", "0", "0", "1", "0"],
    ]);
    expect(table.total).toEqual(["Total", "7", "2", "2", "0", "1", "2", "0"]);
  });

  it("a flow threat counts as data flow even when it names an element", () => {
    expect(threatElementType({ strideCategory: "S", dataFlow: {}, linkedElement: { elementType: "Process" } })).toBe("DataFlow");
  });

  it("summarises a group in one line, in German too", () => {
    expect(threatGroupSummary(THREATS, "en")).toBe("7 threats — S 2 · T 2 · R 0 · I 1 · D 2 · E 0");
    expect(threatStatsTable(THREATS, "de", label).headers.slice(0, 2)).toEqual(["Element-Typ", "Bedrohungen"]);
    expect(threatGroupSummary(THREATS, "de")).toMatch(/^7 Bedrohungen — S 2/);
  });
});

describe("risk statistics", () => {
  const risk = (value: number, type: string) => ({ calculatedRiskBeforeMitigation: value, type });
  const RISKS = [risk(4, "DataFlow"), risk(4, "DataFlow"), risk(2, "Interface"), risk(3, "Interface"), risk(0, "Interface")];
  const typeOf = (r: { type?: string }) => r.type ?? "-";
  const SCALE = { scale: "4-level" as const, roundingMethod: "round" as const };

  it("counts per element type and risk level (highest first), unrated only when there are", () => {
    const table = riskStatsTable(RISKS, typeOf, SCALE, "en", label);
    expect(table.headers).toEqual(["Element type", "Risks", "Critical", "High", "Medium", "Low", "Not rated"]);
    expect(table.rows).toEqual([
      ["<DataFlow>", "2", "2", "0", "0", "0", "0"],
      ["<Interface>", "3", "0", "1", "1", "0", "1"],
    ]);
    expect(table.total).toEqual(["Total", "5", "2", "1", "1", "0", "1"]);
    expect(riskStatsTable(RISKS.slice(0, 4), typeOf, SCALE, "en", label).headers).not.toContain("Not rated");
  });

  it("summarises a group with the levels that occur, in German too", () => {
    expect(riskGroupSummary(RISKS, SCALE, "en")).toBe("5 risks — Critical 2 · High 1 · Medium 1 · Not rated 1");
    expect(riskGroupSummary(RISKS, SCALE, "de")).toBe("5 Risiken — Kritisch 2 · Hoch 1 · Mittel 1 · Nicht bewertet 1");
    expect(riskStatsTable(RISKS, typeOf, { scale: "5-level" }, "de", label).headers).toContain("Sehr hoch");
  });
});
