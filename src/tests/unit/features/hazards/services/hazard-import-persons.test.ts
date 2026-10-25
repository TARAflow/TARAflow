// tests/unit/features/hazards/services/hazard-import-persons.test.ts
//
// Hazard import design HI-2 / HI-3 (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): a default affected person for rows (or sheets)
// without one, a configurable list separator, and no hard-coded rationale on
// the imported person edge.

import { describe, it, expect } from "vitest";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { applyImportProfile } from "features/hazards/services/apply-import-profile";
import { bridgeSafetyHazards } from "features/hazards/services/hazard-bridge";
import { splitList, type ImportProfile, type SheetGrid } from "features/hazards/models/import-profile-types";
import type { SafetyHazard } from "features/hazards/models/safety-hazard-types";

const sheets = fixture.sheets as unknown as SheetGrid[];
const VS = { "1": "reversible_minor", "2": "reversible_major", "3": "irreversible_minor", "4": "irreversible_major" };

const base = (over: Partial<ImportProfile> = {}): ImportProfile => ({
  id: "p",
  name: "p",
  format: "spreadsheet",
  sheetName: "Risk assessment",
  headerRow: 2,
  dataStartRow: 3,
  idPattern: "^[1-9]\\d*(\\.\\d+)?$",
  columns: [
    { field: "id", column: 0 },
    { field: "description", column: 4 },
    { field: "severity", column: 7, valueMap: VS },
  ],
  markerGroups: [],
  metaColumns: [],
  ...over,
});

const bridge = (hazards: SafetyHazard[]) => {
  let n = 0;
  let a = 0;
  return bridgeSafetyHazards(hazards, {
    makeHazardItemId: () => `HZ-${++n}` as never,
    existingAssets: [],
    mintHumanAsset: (name: string) =>
      ({ id: `H-${++a}`, displayId: `HU-${a}`, name, assetGroup: "human" }) as never,
  });
};

describe("HI-2 — default affected persons", () => {
  it("no person column, default Operator: every rated hazard endangers the one Operator asset", () => {
    const { hazards } = applyImportProfile(sheets, base({ defaultAffectedPersons: ["Operator"] }));
    const { relations, createdAssets } = bridge(hazards);
    expect(createdAssets.map((c) => c.name)).toEqual(["Operator"]);
    const edges = relations.filter((r) => r.type === "endangers");
    expect(edges).toHaveLength(8); // rows 1 … 7 (incl. 2.1 / 2.2); row 8 has no severity (HI-11)
    expect(new Set(edges.map((e) => e.to))).toEqual(new Set([createdAssets[0].id]));
  });

  it("no person column and no default: no edges", () => {
    const { relations } = bridge(applyImportProfile(sheets, base()).hazards);
    expect(relations.filter((r) => r.type === "endangers")).toEqual([]);
  });

  it("the default fills only rows without their own person", () => {
    const grid: SheetGrid[] = [
      {
        name: "S",
        rows: [
          ["Id", "Text", "Sev", "Persons"],
          ["1", "A", "4", "Setter"],
          ["2", "B", "4", null],
        ],
      },
    ];
    const p: ImportProfile = {
      id: "g", name: "g", format: "spreadsheet", sheetName: "S", headerRow: 0, dataStartRow: 1,
      columns: [
        { field: "id", column: 0 },
        { field: "description", column: 1 },
        { field: "severity", column: 2, valueMap: VS },
        { field: "affectedPersons", column: 3 },
      ],
      markerGroups: [],
      metaColumns: [],
      defaultAffectedPersons: ["Operator"],
    };
    expect(applyImportProfile(grid, p).hazards.map((h) => h.affectedPersons)).toEqual([["Setter"], ["Operator"]]);
  });
});

describe("HI-3 — list separator", () => {
  const grid: SheetGrid[] = [
    { name: "S", rows: [["Id", "Text", "Persons"], ["1", "A", "Bediener/Einrichter, Wartung"]] },
  ];
  const p = (listSeparator?: string): ImportProfile => ({
    id: "s", name: "s", format: "spreadsheet", sheetName: "S", headerRow: 0, dataStartRow: 1,
    columns: [{ field: "id", column: 0 }, { field: "description", column: 1 }, { field: "affectedPersons", column: 2 }],
    markerGroups: [],
    metaColumns: [],
    listSeparator,
  });

  it("default , and / — as before", () => {
    expect(applyImportProfile(grid, p()).hazards[0].affectedPersons).toEqual(["Bediener", "Einrichter", "Wartung"]);
  });

  it('"," keeps "Bediener/Einrichter" as one person', () => {
    expect(applyImportProfile(grid, p(",")).hazards[0].affectedPersons).toEqual(["Bediener/Einrichter", "Wartung"]);
  });

  it("splitList", () => {
    expect(splitList(" a; b ;;c ", ";")).toEqual(["a", "b", "c"]);
    expect(splitList("a,b/c")).toEqual(["a", "b", "c"]);
    expect(splitList("a/b", "")).toEqual(["a", "b"]); // empty separator → default
  });
});

describe("no hard-coded text on the imported edge", () => {
  it("the endangers edge has no rationale", () => {
    const { relations } = bridge(applyImportProfile(sheets, base({ defaultAffectedPersons: ["Operator"] })).hazards);
    const edges = relations.filter((r) => r.type === "endangers");
    expect(edges.every((e) => (e as { rationale?: string }).rationale === undefined)).toBe(true);
    expect(edges.every((e) => (e as { provenance?: string }).provenance === "derived")).toBe(true);
  });
});
