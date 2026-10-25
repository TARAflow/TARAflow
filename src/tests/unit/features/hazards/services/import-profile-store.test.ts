// tests/unit/features/hazards/services/import-profile-store.test.ts
//
// Hazard import design HI-9 (doc/InProgress/Hazard/hazard-import-iso12100-
// extensions.md): profiles are stored in the project with the file, sheet
// and header row they last read; imported items name their profile.

import { describe, it, expect } from "vitest";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { applyImportProfile } from "features/hazards/services/apply-import-profile";
import {
  headerSnapshot,
  recordProfileUse,
  saveProfile,
} from "features/hazards/services/import-profile-store";
import { importedDataRows } from "features/hazards/utils/imported-data-rows";
import type { ImportProfile, SheetGrid, WorkbookPreview } from "features/hazards/models/import-profile-types";

const workbook = fixture as unknown as WorkbookPreview;

const profile = (over: Partial<ImportProfile> = {}): ImportProfile => ({
  id: "p-la200",
  name: "LA-200",
  format: "spreadsheet",
  sheetName: "Risk assessment",
  headerRow: 2,
  dataStartRow: 3,
  columns: [{ field: "id", column: 0 }, { field: "description", column: 4 }],
  markerGroups: [],
  metaColumns: [],
  ...over,
});

const source = { fileName: "la200.xlsx", sheetName: "Risk assessment", header: ["Ref. no."] };

describe("HI-9 — profiles in the project", () => {
  it("headerSnapshot reads the header row of the profile's sheet", () => {
    const header = headerSnapshot(workbook, profile());
    expect(header.slice(0, 3)).toEqual(["Ref. no.", "Lifecycle phase", "Hazard zone"]);
    expect(header).toHaveLength(15);
  });

  it("recordProfileUse stores the profile with source and time; same id replaces", () => {
    const first = recordProfileUse(undefined, profile(), source, "t1");
    expect(first).toEqual([{ ...profile(), source, lastUsed: "t1" }]);
    const second = recordProfileUse(first, profile({ name: "LA-200 v2" }), { ...source, fileName: "la200-v2.xlsx" }, "t2");
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ name: "LA-200 v2", lastUsed: "t2", source: { fileName: "la200-v2.xlsx" } });
  });

  it("saveProfile stores the mapping and keeps where it was last used", () => {
    const used = recordProfileUse(undefined, profile(), source, "t1");
    const saved = saveProfile(used, { ...profile({ idPattern: "^\\d+$" }), source: { fileName: "x", header: [] }, lastUsed: "t9" } as ImportProfile);
    expect(saved[0]).toMatchObject({ idPattern: "^\\d+$", source, lastUsed: "t1" });
    expect(saveProfile(saved, profile({ id: "other" }))).toHaveLength(2);
    expect(saveProfile(undefined, profile())[0]).toEqual(profile());
  });

  it("imported items name their profile; the dialog does not show it", () => {
    const [h] = applyImportProfile(workbook.sheets as SheetGrid[], profile({ idPattern: "^1$" })).hazards;
    expect(h.importMeta?.profileId).toBe("p-la200");
    expect(importedDataRows({ importMeta: h.importMeta }).map((r) => r.key)).not.toContain("profileId");
  });
});
