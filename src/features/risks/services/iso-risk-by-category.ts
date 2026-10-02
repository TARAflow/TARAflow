// ==================== ISO/SAE 21434: RISK PER IMPACT CATEGORY ====================
//
// 15.8 NOTE 1 lets the risk value be determined per impact rating. The risk
// register keeps ONE value per risk (with "max" the highest category — the
// same number as the highest per-category value); this shows the four values
// behind it (risk-impact-aggregation design §5.6, phase 5 scope A: display
// only — treatment per category is a separate design together with 1:n
// damage scenarios).
//
// Each category value is the regular calculation with that one impact factor
// and the risk's likelihood factors, so it uses the project's likelihood
// method, scale, rounding and thresholds unchanged.
//
// Pure.

import type { FactorRating } from "../models/risk-factor-types";
import type { RiskConfiguration } from "../models/risk-config-types";
import { DEFAULT_CONFIGURATION } from "../models/risk-config-types";
import { ALL_PREDEFINED_FACTORS } from "../models/risk-factor-types";
import { calculateRiskValues, getRiskLabel } from "./risk-calculation-service";

/** ISO/SAE 21434 15.5 impact categories, in the norm's order (S F O P). */
export const ISO_IMPACT_CATEGORIES = [
  { factorId: "safety", short: "S" },
  { factorId: "financial_damage", short: "F" },
  { factorId: "operational", short: "O" },
  { factorId: "privacy", short: "P" },
] as const;

export interface CategoryRisk {
  factorId: string;
  short: string;
  impact: number;
  risk: number;
  level: string;
}

export function isoRiskByCategory(
  ratings: readonly FactorRating[],
  config: RiskConfiguration,
): CategoryRisk[] {
  // The report also renders partial configurations (old or hand-made project
  // files) — never let a missing list break it.
  const configuration: RiskConfiguration = {
    ...DEFAULT_CONFIGURATION,
    ...Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined)),
  };
  const all = [...ALL_PREDEFINED_FACTORS, ...configuration.customFactors];
  const likelihood = ratings.filter(
    (r) => all.find((f) => f.id === r.factorId)?.category === "likelihood",
  );
  const out: CategoryRisk[] = [];
  for (const { factorId, short } of ISO_IMPACT_CATEGORIES) {
    const rating = ratings.find((r) => r.factorId === factorId && r.value > 0);
    if (!rating) continue;
    const v = calculateRiskValues([rating, ...likelihood], configuration);
    out.push({
      factorId,
      short,
      impact: v.impact,
      risk: v.risk,
      level: getRiskLabel(
        v.risk,
        configuration.scale,
        configuration.roundingMethod,
        configuration.severityThresholds,
      ),
    });
  }
  return out;
}
