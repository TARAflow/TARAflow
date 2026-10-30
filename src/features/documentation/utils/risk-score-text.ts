// ==================== RISK SCORE IN THE REPORT ====================
// A risk value R = I × L (not ISO/SAE 21434) as the report shows it — level by
// the thresholds of the risk scale, the same rule as the risk tab
// (riskSeverityLevel). Review 2026-10-30: the report used fixed limits for
// values 1–4, so with R up to 16 nearly every risk read "Critical" (Smoke
// Detector: 188 of 199) and the app's report showed the word without the value
// while the CLI showed the value without the word.

import type { DocLanguage } from "../models/doc-types";
import {
  RISK_SCALES,
  riskSeverityLevel,
  type RiskScaleType,
} from "../../risks/models/risk-scale-types";

export interface RiskScoreConfig {
  scale?: RiskScaleType;
  severityThresholds?: Record<number, number>;
}

/** Level words per scale, lowest first (the RISK_SCALES levels, translated). */
const LEVEL_WORDS: Record<RiskScaleType, Record<DocLanguage, string[]>> = {
  "3-level": { en: ["Low", "Medium", "High"], de: ["Niedrig", "Mittel", "Hoch"] },
  "4-level": { en: ["Low", "Medium", "High", "Critical"], de: ["Niedrig", "Mittel", "Hoch", "Kritisch"] },
  "5-level": {
    en: ["Low", "Medium", "High", "Very High", "Critical"],
    de: ["Niedrig", "Mittel", "Hoch", "Sehr hoch", "Kritisch"],
  },
};

/** Pale table fills per level, lowest first (5-level: purple on top, as RISK_SCALES). */
const LEVEL_FILLS: Record<RiskScaleType, string[]> = {
  "3-level": ["#bbf7d0", "#fef08a", "#fecaca"],
  "4-level": ["#bbf7d0", "#fef08a", "#fed7aa", "#fecaca"],
  "5-level": ["#bbf7d0", "#fef08a", "#fed7aa", "#fecaca", "#f5d0fe"],
};

const scaleOf = (config: RiskScoreConfig | undefined): RiskScaleType => config?.scale ?? "4-level";

/** Level number 1..n of a value (0 = unrated). */
export function riskScoreLevel(value: number, config: RiskScoreConfig | undefined): number {
  if (!(value > 0)) return 0;
  return riskSeverityLevel(value, scaleOf(config), config?.severityThresholds).value;
}

/** The level words of the scale, highest first (stats table columns). */
export function riskLevelWords(config: RiskScoreConfig | undefined, lang: DocLanguage): string[] {
  return [...LEVEL_WORDS[scaleOf(config)][lang]].reverse();
}

/** "5.3 – Medium"; "-" when unrated. */
export function riskScoreText(value: number, config: RiskScoreConfig | undefined, lang: DocLanguage): string {
  const level = riskScoreLevel(value, config);
  if (level === 0) return "-";
  return `${value.toFixed(1)} – ${LEVEL_WORDS[scaleOf(config)][lang][level - 1]}`;
}

/** Table fill of a value's level; undefined when unrated. */
export function riskScoreFill(value: number, config: RiskScoreConfig | undefined): string | undefined {
  const level = riskScoreLevel(value, config);
  return level === 0 ? undefined : LEVEL_FILLS[scaleOf(config)][level - 1];
}

/** In the highest level of the scale ("Critical"). */
export function isCriticalRiskScore(value: number, config: RiskScoreConfig | undefined): boolean {
  return riskScoreLevel(value, config) === RISK_SCALES[scaleOf(config)].levels.length;
}
