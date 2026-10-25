// tests/unit/features/hazards/utils/hazard-category-keywords.test.ts
//
// Hazard import design HI-8 (doc/InProgress/Hazard/hazard-import-iso12100-
// extensions.md): the hazard category of a free-text cell suggested from
// keywords in the locale files — one category hit is a suggestion, several are
// left to the analyst, none leaves the value as it is. Every language the app
// offers must provide keywords for every category.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "i18n/services/i18n";

import fixture from "../../../../fixtures/hazards/label-applicator-iso12100.json";
import { LANGUAGE_CODES } from "i18n/services/supported_languages";
import {
  KEYWORD_CATEGORIES,
  normalizeWord,
  prefillCategoryMap,
  suggestHazardCategory,
} from "features/hazards/utils/hazard-category-keywords";
import { distinctColumnValues } from "features/hazards/services/apply-import-profile";
import type { SheetGrid } from "features/hazards/models/import-profile-types";

describe("keywords in every language", () => {
  for (const lang of LANGUAGE_CODES) {
    it(`${lang}: every category has keywords`, () => {
      const kw = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/locales", lang, "hazards.json"), "utf-8")).tabs
        .hazards.categoryKeywords as Record<string, string[]>;
      for (const c of KEYWORD_CATEGORIES) {
        expect(kw?.[c]?.length ?? 0, `${lang} ${c}`).toBeGreaterThan(0);
      }
    });
  }
});

describe("keywords are unambiguous", () => {
  for (const lang of LANGUAGE_CODES) {
    it(`${lang}: each keyword alone suggests exactly its own category`, () => {
      const kw = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/locales", lang, "hazards.json"), "utf-8")).tabs
        .hazards.categoryKeywords as Record<string, string[]>;
      for (const [category, words] of Object.entries(kw)) {
        for (const w of words) {
          expect(suggestHazardCategory(w.replace(/\*$/, "")), `${lang} "${w}"`).toEqual({ category, candidates: [category] });
        }
      }
    });
  }
});

describe("suggestHazardCategory", () => {
  const cat = (v: string) => suggestHazardCategory(v).category;

  it("German and English words, any language of the cell", () => {
    expect(cat("Quetschen, Stoss")).toBe("mechanical");
    expect(cat("Stromschlag")).toBe("electrical");
    expect(cat("Verbrennung")).toBe("thermal");
    expect(cat("Lärm")).toBe("noise");
    expect(cat("electric shock")).toBe("electrical");
    expect(cat("Crushing, shearing")).toBe("mechanical");
    expect(cat("mechanisch")).toBe("mechanical");
  });

  it("long keywords inside compounds, short ones only at a word start", () => {
    expect(cat("Handquetschung")).toBe("mechanical");
    expect(cat("Arbeitslärm")).toBe("noise");
    expect(cat("photo documentation")).toBeUndefined(); // "hot" not inside "photo"
    expect(cat("Druckluftstrom")).toBeUndefined(); // "stromschlag", not "strom"
    expect(cat("Crushing, shearing")).toBe("mechanical"); // "hearing loss", not "hearing" in "shearing"
    expect(cat("gasket failure")).toBeUndefined(); // "gas" is a whole word
    expect(cat("bei bestimmungsgemässem Gebrauch")).toBeUndefined(); // "rauchgas", not "rauch"
    expect(cat("Cutting")).toBe("mechanical"); // "cut*" is a word start
    expect(cat("Gases released")).toBe("material_substance");
  });

  it("ß, umlauts and case", () => {
    expect(normalizeWord("Stoß Hitze Größe")).toBe("stoss hitze groesse");
    expect(cat("STOSS")).toBe("mechanical");
    expect(cat("heiße Oberfläche")).toBe("thermal");
  });

  it("several categories: no suggestion, both candidates; none: nothing", () => {
    expect(suggestHazardCategory("Quetschen, Stromschlag")).toEqual({ candidates: ["mechanical", "electrical"] });
    expect(suggestHazardCategory("Sonstiges")).toEqual({ candidates: [] });
  });
});

describe("prefillCategoryMap", () => {
  it("fills unmapped values, keeps a stored mapping, reports the ambiguous ones", () => {
    const pre = prefillCategoryMap(["Quetschen", "Stromschlag", "Quetschen, Stromschlag", "Sonstiges"], {
      Stromschlag: "other",
    });
    expect(pre.valueMap).toEqual({ Quetschen: "mechanical", Stromschlag: "other" });
    expect(pre.suggested).toEqual(["Quetschen"]);
    expect(pre.ambiguous).toEqual({ "Quetschen, Stromschlag": ["mechanical", "electrical"] });
  });

  it("the fixture's hazard-type column", () => {
    const values = distinctColumnValues(fixture.sheets[0] as unknown as SheetGrid, { dataStartRow: 3, columns: [] }, 3);
    const pre = prefillCategoryMap(values, undefined);
    expect(pre.valueMap).toEqual({
      Crushing: "mechanical",
      "Drawing-in": "mechanical",
      "Crushing, shearing": "mechanical",
      "Electric shock": "electrical",
      Burn: "thermal",
      Noise: "noise",
      Cutting: "mechanical",
      Impact: "mechanical",
      Vapour: "material_substance",
    });
    expect(pre.ambiguous).toEqual({});
  });
});
