// tests/unit/features/hazards/services/hazard-reimport.test.ts
//
// Hazard import design HI-10, part 2 (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): a re-import reconciles the rows with the items of
// the earlier import — new / changed / unchanged / removed — instead of
// appending them again, and keeps what the analyst did.

import { describe, it, expect } from "vitest";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { applyImportProfile } from "features/hazards/services/apply-import-profile";
import { bridgeSafetyHazards } from "features/hazards/services/hazard-bridge";
import {
  applyReimport,
  clearImportStatus,
  planReimport,
  previousItemsOf,
} from "features/hazards/services/hazard-reimport";
import { createEmptyHazardData, type HazardData } from "features/hazards/models/hazard-data-types";
import type { CellValue, ImportProfile, SheetGrid } from "features/hazards/models/import-profile-types";
import type { HazardItem, HazardRelation } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const profile: ImportProfile = {
  id: "p-la200",
  name: "LA-200",
  format: "spreadsheet",
  sheetName: "Risk assessment",
  headerRow: 2,
  dataStartRow: 3,
  idPattern: "^[1-9]\\d*(\\.\\d+)?$",
  columns: [
    { field: "id", column: 0 },
    { field: "description", column: 4 },
    { field: "severity", column: 7, valueMap: { "1": "reversible_minor", "2": "reversible_major", "3": "irreversible_minor", "4": "irreversible_major" } },
    { field: "notes", column: 14 },
  ],
  markerGroups: [],
  metaColumns: [],
  defaultAffectedPersons: ["Operator"],
};

const originalRows = () => (fixture.sheets[0].rows as CellValue[][]).map((r) => [...r]);

/** The revised sheet: row 2.2 VS 4 → 3, row 4 described anew, row 5 gone, new row 9. */
const revisedRows = () => {
  const rows = originalRows().filter((r) => r[0] !== "5");
  rows.find((r) => r[0] === "2.2")![7] = 3;
  rows.find((r) => r[0] === "4")![4] = "Contact with the hot glue nozzle during refilling";
  rows.push(["9", "Machine in operation", "Infeed", "Crushing", "Hand caught at the infeed", null, 2, 4, 8, null, null, null, null, null, null]);
  return rows;
};

let nextId = 0;
const run = (rows: CellValue[][], fileName: string, existingAssets: Any[] = []) => {
  const sheets: SheetGrid[] = [{ name: "Risk assessment", rows }];
  const { hazards } = applyImportProfile(sheets, profile, fileName);
  return bridgeSafetyHazards(hazards, {
    makeHazardItemId: () => `HZ-${++nextId}` as never,
    existingAssets,
    mintHumanAsset: (name: string) => ({ id: "H-1", displayId: "HU-1", name, assetGroup: "human" }) as never,
  });
};

const operator = { id: "H-1", displayId: "HU-1", name: "Operator", assetGroup: "human" };
const byRef = (data: HazardData, ref: string) => data.hazards.find((h) => h.externalRef === ref)!;
const derivedEdges = (data: HazardData, item: HazardItem) =>
  data.relations.filter((r: Any) => r.type === "endangers" && r.from === item.id && r.provenance === "derived");

/** First import, then the analyst's own work on top. */
const earlier = (): HazardData => {
  nextId = 0;
  const first = run(originalRows(), "la200.xlsx");
  const data: HazardData = { ...createEmptyHazardData(), hazards: first.items, relations: first.relations };
  const item1 = byRef(data, "1");
  const item21 = byRef(data, "2.1");
  const item3 = byRef(data, "3");
  return {
    ...data,
    hazards: data.hazards.map((h) =>
      h.id === item1.id ? { ...h, label: "Tipping during lift" } : h.id === item3.id ? { ...h, rationale: "Checked with the electrician" } : h,
    ),
    relations: [
      ...data.relations,
      { type: "endangers", from: item21.id, to: "A-Setter", impact: { target: "human", severity: "reversible_minor" }, provenance: "manual" } as HazardRelation,
    ],
  };
};

describe("HI-10 — plan", () => {
  it("new / changed / unchanged / removed by row id", () => {
    const data = earlier();
    const incoming = run(revisedRows(), "la200.xlsx", [operator]);
    const plan = planReimport(data, incoming, "p-la200", "la200.xlsx");
    expect(plan.added.map((h) => h.externalRef)).toEqual(["9"]);
    expect(plan.changed.map((c) => c.existing.externalRef).sort()).toEqual(["2.2", "4"]);
    expect(plan.removed.map((h) => h.externalRef)).toEqual(["5"]);
    expect(plan.unchanged.map((h) => h.externalRef)).toEqual(["1", "2.1", "3", "6", "7", "8"]);
  });

  it("the same sheet again: everything unchanged", () => {
    const data = earlier();
    const plan = planReimport(data, run(originalRows(), "la200.xlsx", [operator]), "p-la200", "la200.xlsx");
    expect([plan.added.length, plan.changed.length, plan.removed.length]).toEqual([0, 0, 0]);
  });

  it("items of another file with the same profile are left out when the file has its own", () => {
    const data = earlier();
    const other = run(originalRows(), "machine-b.xlsx", [operator]);
    const both: HazardData = { ...data, hazards: [...data.hazards, ...other.items] };
    expect(previousItemsOf(both, "p-la200", "machine-b.xlsx")).toHaveLength(other.items.length);
    expect(previousItemsOf(both, "p-la200", "la200-revB.xlsx")).toHaveLength(both.hazards.length);
  });
});

describe("HI-10 — apply (update existing)", () => {
  const data = earlier();
  const incoming = run(revisedRows(), "la200.xlsx", [operator]);
  const plan = planReimport(data, incoming, "p-la200", "la200.xlsx");
  const out = applyReimport(data, incoming, plan, "2026-10-26T10:00:00.000Z");

  it("no duplicates: only the new row is added", () => {
    expect(out.hazards).toHaveLength(data.hazards.length + 1);
    expect(byRef(out, "9").importMeta?.profileId).toBe("p-la200");
    expect(derivedEdges(out, byRef(out, "9"))).toHaveLength(1);
  });

  it("a changed row updates the item and its import-derived edge, flagged for review", () => {
    const item = byRef(out, "2.2");
    expect(item.id).toBe(byRef(data, "2.2").id);
    expect(item.importMeta).toMatchObject({ importStatus: "changed", importStatusSince: "2026-10-26T10:00:00.000Z", "severity.raw": "3" });
    expect(derivedEdges(out, item).map((e: Any) => e.impact.severity)).toEqual(["irreversible_minor"]);
  });

  it("the label follows the description only while the analyst has not changed it", () => {
    expect(byRef(out, "4").label).toBe("Contact with the hot glue nozzle during refilling");
    expect(byRef(out, "1").label).toBe("Tipping during lift");
  });

  it("a removed row is kept and flagged; analyst data survives", () => {
    expect(byRef(out, "5").importMeta?.importStatus).toBe("removed");
    expect(byRef(out, "3").rationale).toBe("Checked with the electrician");
    expect(out.relations.some((r: Any) => r.provenance === "manual" && r.to === "A-Setter")).toBe(true);
  });

  it("a row that comes back clears the removed flag; Reviewed clears a flag", () => {
    const again = planReimport(out, run(originalRows(), "la200.xlsx", [operator]), "p-la200", "la200.xlsx");
    const back = applyReimport(out, run(originalRows(), "la200.xlsx", [operator]), again, "t2");
    expect(byRef(back, "5").importMeta?.importStatus).toBeUndefined();
    const cleared = clearImportStatus(byRef(out, "2.2"));
    expect(cleared.importMeta?.importStatus).toBeUndefined();
    expect(cleared.importMeta?.importStatusSince).toBeUndefined();
    expect(cleared.importMeta?.profileId).toBe("p-la200");
  });
});
