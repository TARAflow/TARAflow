// tests/unit/features/hazards/services/hazard-import-severity-scale.test.ts
//
// Hazard import design HI-1 / HI-1a (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): the profile maps severity directly onto the
// canonical person-harm scale; the legacy intermediate values stay valid input
// and map exactly as before.

import { describe, it, expect } from "vitest";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import {
  applyImportProfile,
  distinctColumnValues,
} from "features/hazards/services/apply-import-profile";
import { bridgeSafetyHazards } from "features/hazards/services/hazard-bridge";
import { finalizeImport } from "features/hazards/services/safety-hazard-importer";
import { SEVERITY_OPTIONS, markerValueOptions } from "features/hazards/models/import-profile-types";
import type { ImportProfile, SheetGrid } from "features/hazards/models/import-profile-types";
import type { SafetyHazard } from "features/hazards/models/safety-hazard-types";

const sheets = fixture.sheets as unknown as SheetGrid[];

const profile = (severityMap: Record<string, string>): ImportProfile => ({
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
    { field: "severity", column: 7, valueMap: severityMap },
  ],
  markerGroups: [],
  metaColumns: [],
});

/** Edge severity per source row, with one affected person on every row. */
const edgeSeverities = (hazards: SafetyHazard[]) => {
  let n = 0;
  const withPerson = hazards.map((h) => ({ ...h, affectedPersons: ["Operator"] }));
  const { items, relations } = bridgeSafetyHazards(withPerson, {
    makeHazardItemId: () => `HZ-${++n}` as never,
    existingAssets: [],
    mintHumanAsset: (name: string) => ({ id: "H-1", displayId: "HU-1", name, assetGroup: "human" }) as never,
  });
  const byItem = new Map<string, string | undefined>(items.map((i) => [i.id as unknown as string, i.externalRef]));
  return Object.fromEntries(
    relations
      .filter((r) => r.type === "endangers")
      .map((r) => [byItem.get((r as { from: string }).from), (r as { impact: { severity: string } }).impact.severity]),
  );
};

describe("HI-1 — the canonical scale", () => {
  it("the dialog offers the five canonical levels, neither legacy values nor none", () => {
    expect([...SEVERITY_OPTIONS]).toEqual([
      "reversible_minor",
      "reversible_major",
      "irreversible_minor",
      "irreversible_major",
      "fatal",
    ]);
    expect(markerValueOptions("severity")).toBe(SEVERITY_OPTIONS);
  });

  it("VS mapped onto the canonical levels gives exactly these edge severities", () => {
    const result = applyImportProfile(
      sheets,
      profile({ "1": "reversible_minor", "2": "reversible_major", "3": "irreversible_minor", "4": "irreversible_major" }),
    );
    expect(edgeSeverities(result.hazards)).toEqual({
      "1": "irreversible_minor",
      "2.1": "reversible_major",
      "2.2": "irreversible_major",
      "3": "irreversible_major",
      "4": "reversible_minor",
      "5": "reversible_minor",
      "6": "reversible_major",
      "7": "irreversible_minor",
      // "8": no severity → no edge (HI-11)
    });
  });

  it("fatal passes through from a file", () => {
    const { hazards } = finalizeImport([{ row: 1, data: { id: "a", description: "d", severity: "fatal" } }], "json");
    expect(edgeSeverities(hazards)).toEqual({ a: "fatal" });
  });
});

describe("HI-1a — legacy values map as before", () => {
  it("golden: negligible / marginal → reversible_minor, critical → irreversible_major, catastrophic → fatal", () => {
    const result = applyImportProfile(
      sheets,
      profile({ "1": "negligible", "2": "marginal", "3": "critical", "4": "catastrophic" }),
    );
    expect(result.warnings.filter((w) => w.field === "severity").map((w) => w.row)).toHaveLength(1); // row 8 only
    expect(edgeSeverities(result.hazards)).toEqual({
      "1": "irreversible_major",
      "2.1": "reversible_minor",
      "2.2": "fatal",
      "3": "fatal",
      "4": "reversible_minor",
      "5": "reversible_minor",
      "6": "reversible_minor",
      "7": "irreversible_major",
    });
  });
});

describe("value map editor input", () => {
  it("distinct values of a column over the data rows, section rows and empty cells left out", () => {
    expect(distinctColumnValues(sheets[0], profile({}), 7)).toEqual(["3", "2", "4", "1"]);
    expect(distinctColumnValues(sheets[0], profile({}), 3).slice(0, 3)).toEqual(["Crushing", "Drawing-in", "Crushing, shearing"]);
  });
});
