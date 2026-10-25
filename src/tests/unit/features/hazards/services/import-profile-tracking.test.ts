// tests/unit/features/hazards/services/import-profile-tracking.test.ts
//
// Hazard import design HI-10, part 1 (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): a re-import recognises the stored profile (file
// name, else header) and follows the sheet's changes — header row moved,
// columns moved, renamed, removed, added.

import { describe, it, expect } from "vitest";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { applyImportProfile } from "features/hazards/services/apply-import-profile";
import { headerSnapshot } from "features/hazards/services/import-profile-store";
import {
  findMatchingProfile,
  trackProfileColumns,
} from "features/hazards/services/import-profile-tracking";
import type {
  CellValue,
  ImportProfile,
  StoredImportProfile,
  WorkbookPreview,
} from "features/hazards/models/import-profile-types";

const original = fixture as unknown as WorkbookPreview;

const mapping: ImportProfile = {
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
    { field: "sourceNorm", column: 5 },
    { field: "severity", column: 7, valueMap: { "4": "irreversible_major" } },
    { field: "notes", column: 14 },
  ],
  markerGroups: [],
  metaColumns: [{ key: "Zone", column: 2 }],
};

const stored: StoredImportProfile = {
  ...mapping,
  source: { fileName: "la200.xlsx", sheetName: "Risk assessment", header: headerSnapshot(original, mapping) },
  lastUsed: "t0",
};

/**
 * The revised sheet: a second title row on top, a new column "Hazard source"
 * after "Hazard zone", "Standards" renamed to "Norms", "Residual risks"
 * removed.
 */
const revised = (): WorkbookPreview => {
  const rows = (original.sheets[0].rows as CellValue[][]).map((r) => {
    const row = [...r];
    row.splice(3, 0, null); // new column, filled below
    row.pop(); // residual risks gone
    return row;
  });
  rows[2][3] = "Hazard source";
  rows[2][6] = "Norms";
  rows.forEach((r, i) => {
    if (i > 2) r[3] = "source text";
  });
  return { ...original, sheets: [{ name: "Risk assessment", rows: [["Revision B"], ...rows] }] };
};

describe("findMatchingProfile", () => {
  it("same file name, any case", () => {
    expect(findMatchingProfile([stored], original, "LA200.XLSX")).toMatchObject({ reason: "fileName" });
  });

  it("another file name, same headings → by header (also when the header row moved)", () => {
    expect(findMatchingProfile([stored], original, "la200-v2.xlsx")).toMatchObject({ reason: "header" });
    expect(findMatchingProfile([stored], revised(), "la200-revB.xlsx")).toMatchObject({ reason: "header" });
  });

  it("other headings → no match", () => {
    const other: WorkbookPreview = { format: "spreadsheet", sheets: [{ name: "Risk assessment", rows: [["A", "B", "C"]] }] };
    expect(findMatchingProfile([stored], other, "x.xlsx")).toBeNull();
    expect(findMatchingProfile(undefined, original, "la200.xlsx")).toBeNull();
  });
});

describe("trackProfileColumns", () => {
  it("unchanged sheet: same mapping, no changes", () => {
    const { profile, changes } = trackProfileColumns(stored, original);
    expect(changes).toEqual([]);
    expect(profile).toEqual(mapping);
  });

  it("revised sheet: header row, moved, renamed, removed and added are followed and reported", () => {
    const { profile, changes } = trackProfileColumns(stored, revised());
    expect(profile.headerRow).toBe(3);
    expect(profile.dataStartRow).toBe(4);
    expect(profile.columns).toEqual([
      { field: "id", column: 0 },
      { field: "description", column: 5 },
      { field: "sourceNorm", column: 6 }, // renamed "Standards" → "Norms", follows its neighbours
      { field: "severity", column: 8, valueMap: { "4": "irreversible_major" } },
      // notes: "Residual risks" removed → mapping dropped
    ]);
    expect(profile.metaColumns).toEqual([{ key: "Zone", column: 2 }]);
    expect(changes).toEqual(
      expect.arrayContaining([
        { kind: "headerRowMoved", from: 2, to: 3 },
        { kind: "moved", heading: "Description", from: 4, to: 5 },
        { kind: "renamed", column: 6, from: "Standards", to: "Norms" },
        { kind: "removed", heading: "Residual risks", column: 14 },
        { kind: "added", heading: "Hazard source", column: 3 },
      ]),
    );
    expect(changes.filter((c) => c.kind === "added")).toHaveLength(1);
  });

  it("the tracked profile reads the revised sheet like the old one read the original", () => {
    const before = applyImportProfile(original.sheets, mapping).hazards;
    const after = applyImportProfile(revised().sheets, trackProfileColumns(stored, revised()).profile).hazards;
    expect(after.map((h) => [h.id, h.description, h.severity, h.sourceNorm])).toEqual(
      before.map((h) => [h.id, h.description, h.severity, h.sourceNorm]),
    );
  });
});
