// tests/unit/features/risks/utils/factor-level-options.test.ts
//
// Risk-impact-aggregation design, Part B (§7.4): likelihood factor levels name
// the situation they stand for, so the label reads in the direction the factor
// counts. Before, every factor showed "1 – Very Low … 4 – High" — "4 – High"
// on Skill level read as "high skill needed" but means "no skill needed".
// TVRA factors showed the generic scale instead of the norm's levels.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { factorLevelOptions } from "features/risks/utils/factor-level-options";
import {
  LIKELIHOOD_FACTOR_LEVELS,
  LIKELIHOOD_FACTOR_LEVEL_TEXT,
  TVRA_LEVEL_TEXT,
} from "features/risks/models/likelihood-factor-levels";
import { TVRA_FACTOR_LEVELS } from "features/risks/models/etsi-tvra-core";
import { LIKELIHOOD_SCALES } from "features/risks/models/risk-scale-types";
import type { RiskScaleType } from "features/risks/models/risk-scale-types";

// i18n stand-in: the English default (what the CLI and an unlocalised build show)
const t = (key: string, o?: Record<string, unknown>) =>
  String(o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n]));

const cfg = (scale: RiskScaleType, likelihoodMethod?: string) =>
  ({ scale, likelihoodMethod }) as never;
const labels = (factorId: string, scale: RiskScaleType, method?: string, cat: "impact" | "likelihood" = "likelihood") =>
  factorLevelOptions(factorId, cat, cfg(scale, method), false, t).options.map((o) => o.label);

describe("likelihood factors: situation labels", () => {
  it("skill level reads in the direction it counts", () => {
    expect(labels("skill_level", "4-level")).toEqual([
      "1 – Security penetration skills",
      "2 – Network and programming skills",
      "3 – Some technical skills",
      "4 – No technical skills",
    ]);
    expect(labels("skill_level", "3-level")[2]).toBe("3 – No technical skills");
    expect(labels("skill_level", "5-level")[2]).toBe("3 – Advanced computer user");
  });

  it("values and the generic level colour stay", () => {
    const o = factorLevelOptions("intrusion_detection", "likelihood", cfg("4-level"), false, t).options;
    expect(o.map((x) => x.value)).toEqual([1, 2, 3, 4]);
    expect(o.map((x) => x.color)).toEqual(LIKELIHOOD_SCALES["4-level"].levels.map((l) => l.color));
    expect(o[3].label).toBe("4 – Not logged");
  });

  it("one complete label set per factor and scale size", () => {
    for (const [factorId, sets] of Object.entries(LIKELIHOOD_FACTOR_LEVELS)) {
      for (const scale of ["3-level", "4-level", "5-level"] as const) {
        expect(sets[scale].length, `${factorId} ${scale}`).toBe(LIKELIHOOD_SCALES[scale].levels.length);
        for (const key of sets[scale]) {
          expect(LIKELIHOOD_FACTOR_LEVEL_TEXT[factorId][key], `${factorId}.${key}`).toBeTruthy();
        }
      }
    }
  });

  it("custom likelihood factor: generic scale plus the direction hint; impact: no hint", () => {
    const custom = factorLevelOptions("my_factor", "likelihood", cfg("5-level"), false, t);
    expect(custom.options[4].label).toBe("5 – Very High");
    expect(custom.directionHint).toBe("1 = attack unlikely … 5 = attack likely");
    expect(factorLevelOptions("skill_level", "likelihood", cfg("4-level"), false, t).directionHint).toBeNull();
    const impact = factorLevelOptions("safety", "impact", cfg("4-level"), false, t);
    expect(impact.directionHint).toBeNull();
    expect(impact.options[0].label).toBe("1 – Low");
  });
});

describe("ETSI TVRA: the norm's levels with the value", () => {
  it("each factor its own number of levels, in the norm's table order", () => {
    expect(labels("time", "4-level", "etsi-tvra")).toEqual([
      "≤ 1 day (1)",
      "≤ 1 week (2)",
      "≤ 1 month (3)",
      "≤ 6 months (4)",
      "> 6 months (5)",
    ]);
    expect(labels("etsi_intensity", "4-level", "etsi-tvra")).toEqual([
      "Single (1)",
      "Moderate (multiple) (2)",
      "Heavy (multiple) (3)",
    ]);
    expect(labels("expertise", "5-level", "etsi-tvra")).toHaveLength(4);
  });

  it("every TVRA level key has a text", () => {
    for (const keys of Object.values(TVRA_FACTOR_LEVELS)) {
      for (const k of keys) expect(TVRA_LEVEL_TEXT[k], k).toBeTruthy();
    }
  });

  it("outside the TVRA method the legacy ETSI ids keep the generic scale", () => {
    expect(labels("time", "4-level")[0]).toBe("1 – Very Low");
  });
});

describe("i18n en/de carry every level", () => {
  for (const lang of ["en", "de"]) {
    it(lang, () => {
      const r = JSON.parse(readFileSync(`src/i18n/locales/${lang}/risks.json`, "utf8")).risks;
      for (const [factorId, texts] of Object.entries(LIKELIHOOD_FACTOR_LEVEL_TEXT)) {
        for (const key of Object.keys(texts)) {
          expect(r.factorLevels?.[factorId]?.[key], `${lang} ${factorId}.${key}`).toBeTruthy();
        }
      }
      for (const key of Object.keys(TVRA_LEVEL_TEXT)) {
        expect(r.tvraLevels?.[key], `${lang} tvra ${key}`).toBeTruthy();
      }
      if (lang === "en") {
        expect(r.factorLevels).toEqual(LIKELIHOOD_FACTOR_LEVEL_TEXT);
        expect(r.tvraLevels).toEqual(TVRA_LEVEL_TEXT);
      }
    });
  }
});
