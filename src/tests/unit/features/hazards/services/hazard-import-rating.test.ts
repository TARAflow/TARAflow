// tests/unit/features/hazards/services/hazard-import-rating.test.ts
//
// Hazard import design HI-4 (doc/InProgress/Hazard/hazard-import-iso12100-
// extensions.md): the customer's rating survives the import — probability and
// RPN in importMeta under fixed keys, plus the source values of severity and
// probability before any value map; the hazard dialog lists them.

import { describe, it, expect } from "vitest";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { applyImportProfile } from "features/hazards/services/apply-import-profile";
import { bridgeSafetyHazards } from "features/hazards/services/hazard-bridge";
import { importedDataRows } from "features/hazards/utils/imported-data-rows";
import type { ImportProfile, SheetGrid } from "features/hazards/models/import-profile-types";

const sheets = fixture.sheets as unknown as SheetGrid[];

/** The profile an analyst builds for the fixture (old severity scale for now). */
const profile = (): ImportProfile => ({
  id: "p-la200",
  name: "LA-200",
  format: "spreadsheet",
  sheetName: "Risk assessment",
  headerRow: 2,
  dataStartRow: 3,
  idPattern: "^[1-9]\\d*(\\.\\d+)?$",
  columns: [
    { field: "id", column: 0 },
    { field: "hazardCategory", column: 3 },
    { field: "description", column: 4 },
    { field: "sourceNorm", column: 5 },
    {
      field: "probability",
      column: 6,
      valueMap: { "1": "very_low", "2": "low", "3": "medium", "4": "high", "5": "very_high" },
    },
    {
      field: "severity",
      column: 7,
      valueMap: { "1": "negligible", "2": "marginal", "3": "critical", "4": "catastrophic" },
    },
    { field: "rpn", column: 8 },
    { field: "notes", column: 14 },
  ],
  markerGroups: [],
  metaColumns: [
    { key: "Lifecycle phase", column: 1 },
    { key: "Hazard zone", column: 2 },
  ],
});

const bridge = (hazards: Parameters<typeof bridgeSafetyHazards>[0]) => {
  let n = 0;
  return bridgeSafetyHazards(hazards, {
    makeHazardItemId: () => `HZ-${++n}` as never,
    existingAssets: [],
    mintHumanAsset: (name: string) => ({ id: `H-${name}`, displayId: `HU-${name}`, name }) as never,
  });
};

describe("HI-4 — the customer's rating survives the import", () => {
  const result = applyImportProfile(sheets, profile(), "la200.xlsx");
  const row = (id: string) => result.hazards.find((h) => h.id === id)!;

  it("section rows are skipped by the id filter", () => {
    expect(result.hazards.map((h) => h.id)).toEqual(["1", "2.1", "2.2", "3", "4", "5", "6", "7", "8"]);
  });

  it("source values of severity and probability before the value map", () => {
    expect(row("2.2").importMeta).toMatchObject({
      "severity.raw": "4",
      "probability.raw": "3",
      "Lifecycle phase": "Machine in operation, Cleaning",
      "Hazard zone": "Applicator head",
    });
    expect(row("2.2").severity).toBe("catastrophic");
    expect(row("8").importMeta?.["severity.raw"]).toBeUndefined(); // no severity in the source
  });

  it("an x-matrix keeps the header label of the marked column", () => {
    const grid: SheetGrid[] = [
      { name: "S", rows: [["Id", "Text", "Low", "High"], ["1", "A", null, "x"]] },
    ];
    const p: ImportProfile = {
      id: "m", name: "m", format: "spreadsheet", sheetName: "S", headerRow: 0, dataStartRow: 1,
      columns: [{ field: "id", column: 0 }, { field: "description", column: 1 }],
      markerGroups: [{ field: "severity", columns: [{ column: 2, value: "marginal" }, { column: 3, value: "critical" }] }],
      metaColumns: [],
    };
    const [h] = applyImportProfile(grid, p).hazards;
    expect(h.severity).toBe("critical");
    expect(h.importMeta?.["severity.raw"]).toBe("High");
  });

  it("the bridge keeps probability and RPN under fixed keys, the other metadata untouched", () => {
    const { items } = bridge(result.hazards);
    const item = items.find((i) => i.externalRef === "2.2")!;
    expect(item.importMeta).toEqual({
      "severity.raw": "4",
      "probability.raw": "3",
      "Lifecycle phase": "Machine in operation, Cleaning",
      "Hazard zone": "Applicator head",
      probability: "medium",
      rpn: "12",
      residualRisk: "Overrun after stop", // HI-6
      profileId: "p-la200", // HI-9
      sourceFile: "la200.xlsx", // HI-10
    });
  });

  it("a hazard without any of it gets no importMeta", () => {
    const { items } = bridge([
      { id: "x", description: "d", hazardCategory: "other", severity: "marginal" } as never,
    ]);
    expect(items[0].importMeta).toBeUndefined();
  });

  it("dialog rows: known keys first in fixed order, then the extra columns", () => {
    const { items } = bridge(result.hazards);
    const rows = importedDataRows(items.find((i) => i.externalRef === "2.2")!);
    expect(rows.map((r) => r.key)).toEqual([
      "severity.raw",
      "probability",
      "probability.raw",
      "rpn",
      "residualRisk",
      "Lifecycle phase",
      "Hazard zone",
    ]);
    expect(rows[0].labelKey).toBe("tabs.hazards.imported.key.severity_raw");
    expect(rows[5].labelKey).toBeUndefined();
  });
});
