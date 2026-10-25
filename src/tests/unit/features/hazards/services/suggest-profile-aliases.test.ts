// tests/unit/features/hazards/services/suggest-profile-aliases.test.ts
//
// suggestProfile guesses the column of each field from the header aliases in
// the locale files (tabs.hazards.aliases.<field>, en and de). It read them
// under a wrong key (tabs.hazards.import.aliases) and so found none — only a
// heading containing the English field name itself was recognised. Uses the
// app's own i18n set-up, as the dialog does.

import { describe, it, expect } from "vitest";
import "i18n/services/i18n";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { suggestProfile } from "features/hazards/services/apply-import-profile";
import type { WorkbookPreview } from "features/hazards/models/import-profile-types";

const col = (wb: WorkbookPreview, field: string) =>
  suggestProfile(wb).columns.find((c) => c.field === field)?.column;

describe("suggestProfile — header aliases", () => {
  it("English headings of the fixture", () => {
    const wb = fixture as unknown as WorkbookPreview;
    expect(col(wb, "lifecyclePhase")).toBe(1);
    expect(col(wb, "hazardZone")).toBe(2);
    expect(col(wb, "protectiveMeasures")).toBe(13);
  });

  it("German headings", () => {
    const wb: WorkbookPreview = {
      format: "spreadsheet",
      sheets: [
        {
          name: "Risikobeurteilung",
          rows: [
            ["Nr.", "Lebensphase", "Gefahrenstelle", "Beschreibung", "Schwere", "Wahrscheinlichkeit", "Betroffene Personen", "Schutzmaßnahmen", "PL erforderlich"],
            ["1", "Transport", "Rahmen", "Kippen", "4", "2", "Bediener", "Anschlagpunkte", "c"],
          ],
        },
      ],
    };
    expect(col(wb, "description")).toBe(3);
    expect(col(wb, "severity")).toBe(4);
    expect(col(wb, "probability")).toBe(5);
    expect(col(wb, "affectedPersons")).toBe(6);
    expect(col(wb, "lifecyclePhase")).toBe(1);
    expect(col(wb, "hazardZone")).toBe(2);
    expect(col(wb, "protectiveMeasures")).toBe(7);
    expect(col(wb, "plRequired")).toBe(8);
  });
});
