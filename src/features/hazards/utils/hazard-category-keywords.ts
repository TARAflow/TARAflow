// features/hazards/utils/hazard-category-keywords.ts
//
// Hazard import HI-8 (doc/InProgress/Hazard/hazard-import-iso12100-
// extensions.md): suggest the ISO 12100 hazard category of a free-text cell
// ("Quetschen, Stoss" → mechanical) from keywords. The keywords live in the
// locale files (tabs.hazards.categoryKeywords.<category>), one list per
// language, and a cell is matched against all languages. Only one category
// hit is a suggestion; several are ambiguous and left to the analyst (user),
// none leaves the value as it is. Never applied silently: the profile dialog
// pre-fills the value map and marks the suggestions.

import i18n from "i18next";
import { LANGUAGE_CODES } from "i18n/services/supported_languages";
import type { HazardCategory } from "shared";

/** Categories that have keywords — every language must provide them. */
export const KEYWORD_CATEGORIES: readonly HazardCategory[] = [
  "mechanical",
  "electrical",
  "thermal",
  "noise",
  "vibration",
  "radiation",
  "material_substance",
  "ergonomic",
];

/** Lower case, ß → ss, umlauts → ae/oe/ue, other diacritics dropped. */
export function normalizeWord(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Matching rule, chosen against false hits ("hearing" in "shearing", "hot"
 * in "photo", "gas" in "gasket"):
 * - a keyword of 5 or more characters may stand inside a word (German
 *   compounds: "Handquetschung" ← "quetsch");
 * - a shorter keyword must be a whole word ("hot", "uv", "gas");
 * - a trailing "*" makes a short keyword a word start ("cut*" → "cutting").
 */
const SUBSTRING_MIN = 5;

function matches(value: string, keyword: string): boolean {
  const stem = keyword.endsWith("*");
  const k = normalizeWord(stem ? keyword.slice(0, -1) : keyword).trim();
  if (!k) return false;
  const words = value.split(/[^a-z0-9]+/);
  if (stem) return words.some((w) => w.startsWith(k));
  if (k.length >= SUBSTRING_MIN) return value.includes(k);
  return words.includes(k);
}

/** The keywords of a category in every available language. */
export function categoryKeywords(category: HazardCategory): string[] {
  const out = new Set<string>();
  for (const lng of LANGUAGE_CODES) {
    const v = i18n.getFixedT(lng)(`tabs.hazards.categoryKeywords.${category}`, {
      returnObjects: true,
      defaultValue: [],
    });
    if (Array.isArray(v)) for (const k of v) out.add(String(k));
  }
  return [...out];
}

export interface CategorySuggestion {
  /** Set only when exactly one category matched. */
  category?: HazardCategory;
  /** Every category that matched (several = ambiguous). */
  candidates: HazardCategory[];
}

export function suggestHazardCategory(value: string): CategorySuggestion {
  const v = normalizeWord(value);
  const candidates = KEYWORD_CATEGORIES.filter((c) => categoryKeywords(c).some((k) => matches(v, k)));
  return candidates.length === 1 ? { category: candidates[0], candidates } : { candidates };
}

export interface CategoryPrefill {
  valueMap: Record<string, string>;
  /** Values the pre-fill mapped (shown as "suggested"). */
  suggested: string[];
  /** Values with several candidates — to be mapped by hand. */
  ambiguous: Record<string, HazardCategory[]>;
}

/** Pre-fill the value map for values not mapped yet; a stored mapping is never touched. */
export function prefillCategoryMap(
  values: readonly string[],
  valueMap: Record<string, string> | undefined,
): CategoryPrefill {
  const out: CategoryPrefill = { valueMap: { ...(valueMap ?? {}) }, suggested: [], ambiguous: {} };
  for (const v of values) {
    if (out.valueMap[v] !== undefined) continue;
    const s = suggestHazardCategory(v);
    if (s.category) {
      out.valueMap[v] = s.category;
      out.suggested.push(v);
    } else if (s.candidates.length > 1) {
      out.ambiguous[v] = s.candidates;
    }
  }
  return out;
}
