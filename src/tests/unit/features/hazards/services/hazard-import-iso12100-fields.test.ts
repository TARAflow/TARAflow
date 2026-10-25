// tests/unit/features/hazards/services/hazard-import-iso12100-fields.test.ts
//
// Hazard import design HI-5 / HI-7 (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): the EN ISO 12100 / 13849-1 columns of a risk
// assessment are profile fields stored in importMeta under fixed keys; a
// severity that contradicts the risk-graph S gives a warning (only).

import { describe, it, expect } from "vitest";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyImportProfile } from "features/hazards/services/apply-import-profile";
import { CANONICAL_FIELDS } from "features/hazards/services/safety-hazard-importer";
import { importedDataRows } from "features/hazards/utils/imported-data-rows";
import {
  MARKER_CAPABLE_FIELDS,
  VALUE_MAPPED_FIELDS,
  markerValueOptions,
  type ImportProfile,
  type SheetGrid,
} from "features/hazards/models/import-profile-types";

const sheets = fixture.sheets as unknown as SheetGrid[];

const profile = (severity: Record<string, string>): ImportProfile => ({
  id: "p",
  name: "p",
  format: "spreadsheet",
  sheetName: "Risk assessment",
  headerRow: 2,
  dataStartRow: 3,
  idPattern: "^[1-9]\\d*(\\.\\d+)?$",
  columns: [
    { field: "id", column: 0 },
    { field: "lifecyclePhase", column: 1 },
    { field: "hazardZone", column: 2 },
    { field: "description", column: 4 },
    { field: "severity", column: 7, valueMap: severity },
    { field: "riskGraphS", column: 9 },
    { field: "riskGraphF", column: 10 },
    { field: "riskGraphP", column: 11 },
    { field: "plRequired", column: 12 },
    { field: "protectiveMeasures", column: 13 },
  ],
  markerGroups: [],
  metaColumns: [],
});

const CANONICAL = { "1": "reversible_minor", "2": "reversible_major", "3": "irreversible_minor", "4": "irreversible_major" };

describe("HI-5 — ISO 12100 / 13849 fields", () => {
  const result = applyImportProfile(sheets, profile(CANONICAL));
  const meta = (id: string) => result.hazards.find((h) => h.id === id)!.importMeta;

  it("are profile fields, the ones with fixed values mappable", () => {
    for (const f of ["lifecyclePhase", "hazardZone", "protectiveMeasures", "protectiveMeasureType", "riskGraphS", "riskGraphF", "riskGraphP", "plRequired", "plAchieved", "safetyFunction"]) {
      expect(CANONICAL_FIELDS).toContain(f);
    }
    expect(VALUE_MAPPED_FIELDS).toEqual(expect.arrayContaining(["riskGraphS", "plRequired", "protectiveMeasureType"]));
    expect(MARKER_CAPABLE_FIELDS).toContain("riskGraphS");
    expect(markerValueOptions("plAchieved")).toEqual(["a", "b", "c", "d", "e"]);
    expect(markerValueOptions("protectiveMeasureType")).toEqual(["inherent", "technical", "information", "combined"]);
  });

  it("land in importMeta under their field name", () => {
    expect(meta("2.2")).toMatchObject({
      lifecyclePhase: "Machine in operation, Cleaning",
      hazardZone: "Applicator head",
      riskGraphS: "S2",
      riskGraphF: "F2",
      riskGraphP: "P2",
      plRequired: "d",
      protectiveMeasures: "Light curtain with safe stop",
    });
  });

  it("a multi-value cell is split with the list separator and normalised", () => {
    const grid: SheetGrid[] = [{ name: "S", rows: [["Id", "Text", "Phase"], ["1", "A", "Transport/ Cleaning,Maintenance"]] }];
    const p: ImportProfile = {
      id: "g", name: "g", format: "spreadsheet", sheetName: "S", headerRow: 0, dataStartRow: 1,
      columns: [{ field: "id", column: 0 }, { field: "description", column: 1 }, { field: "lifecyclePhase", column: 2 }],
      markerGroups: [], metaColumns: [],
    };
    expect(applyImportProfile(grid, p).hazards[0].importMeta?.lifecyclePhase).toBe("Transport, Cleaning, Maintenance");
  });

  it("the hazard dialog lists them after the rating, with a label key", () => {
    const rows = importedDataRows({ importMeta: meta("2.2") });
    expect(rows.map((r) => r.key)).toEqual([
      "severity.raw",
      "lifecyclePhase",
      "hazardZone",
      "protectiveMeasures",
      "riskGraphS",
      "riskGraphF",
      "riskGraphP",
      "plRequired",
    ]);
    expect(rows.every((r) => r.labelKey)).toBe(true);
  });

  it("header aliases (en/de locale files) match the sheet headings", () => {
    // suggestProfile matches a heading when it equals or contains an alias
    const aliases = (lang: string) =>
      JSON.parse(readFileSync(join(process.cwd(), "src/i18n/locales", lang, "hazards.json"), "utf-8")).tabs.hazards
        .aliases as Record<string, string[]>;
    const hit = (lang: string, field: string, heading: string) =>
      aliases(lang)[field].some((a) => heading.toLowerCase().includes(a));
    expect(hit("en", "lifecyclePhase", "Lifecycle phase")).toBe(true);
    expect(hit("en", "hazardZone", "Hazard zone")).toBe(true);
    expect(hit("en", "protectiveMeasures", "Protective measures")).toBe(true);
    expect(hit("de", "lifecyclePhase", "Lebensphase")).toBe(true);
    expect(hit("de", "hazardZone", "Gefahrenstelle")).toBe(true);
    expect(hit("de", "plRequired", "PL erforderlich")).toBe(true);
    // no one-letter alias that would match nearly every heading
    for (const lang of ["en", "de"]) {
      for (const f of ["riskGraphS", "riskGraphF", "riskGraphP"]) expect(aliases(lang)[f]).toBeUndefined();
    }
  });
});

describe("HI-7 — severity against risk graph S", () => {
  it("exactly the two contradicting rows of the fixture warn; values stay unchanged", () => {
    const result = applyImportProfile(sheets, profile(CANONICAL));
    const warned = result.warnings.filter((w) => w.field === "riskGraphS");
    expect(warned.map((w) => w.message.match(/^"([^"]+)"/)?.[1])).toEqual(["6", "7"]);
    expect(result.hazards.find((h) => h.id === "6")!.severity).toBe("reversible_major");
    expect(result.hazards.find((h) => h.id === "6")!.importMeta?.riskGraphS).toBe("S2");
  });

  it("legacy severity values are checked by their mapping", () => {
    const legacy = { "1": "negligible", "2": "marginal", "3": "critical", "4": "catastrophic" };
    const warned = applyImportProfile(sheets, profile(legacy)).warnings.filter((w) => w.field === "riskGraphS");
    expect(warned).toHaveLength(2);
  });

  it("no S column, no check", () => {
    const p = profile(CANONICAL);
    p.columns = p.columns.filter((c) => c.field !== "riskGraphS");
    expect(applyImportProfile(sheets, p).warnings.filter((w) => w.field === "riskGraphS")).toEqual([]);
  });
});
