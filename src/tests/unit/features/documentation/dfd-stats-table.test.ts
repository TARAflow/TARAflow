// The DFD chapter's statistics: one row per element type present plus the
// data flows; the total is the sum of the rows. Before, five fixed rows and
// dfd.stats.totalElements as total (Headlamp: rows 16, total 20).
import { describe, it, expect } from "vitest";
import { dfdStatsTable } from "features/documentation/utils/dfd-stats-table";
import type { DFDData } from "features/dfd";

const t = (key: string, fallback?: string) => fallback ?? key.split(".").pop()!;
const el = (type: string) => ({ type }) as DFDData["elements"][number];

describe("dfdStatsTable", () => {
  const dfd = {
    elements: [el("Multiprocess"), el("ExternalEntity"), el("Sensor"), el("ExternalEntity"), el("PhysicalBoundary")],
    connections: [{}, {}, {}] as DFDData["connections"],
  };

  it("one row per type present (fixed order), then the data flows; total = sum of rows", () => {
    const table = dfdStatsTable(dfd, "en", t);
    expect(table.rows.map(([, n]) => n)).toEqual(["2", "1", "1", "1", "3"]);
    expect(table.rows.at(-1)![0]).toBe("Data Flows");
    expect(table.total).toEqual(["Total", "8"]);
  });

  it("German labels", () => {
    const table = dfdStatsTable({ elements: [], connections: [] }, "de", t);
    expect(table.headers).toEqual(["Element-Typ", "Anzahl"]);
    expect(table.rows).toEqual([["Datenflüsse", "0"]]);
    expect(table.total).toEqual(["Gesamt", "0"]);
  });
});
