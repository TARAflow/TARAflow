// ==================== RISK CALCULATION SERVICE ====================
// Single Responsibility: All risk score calculations and asset impact mapping.
// Extracted from risk-types.ts and risk-service.ts.

import type {
  FactorRating,
  RiskConfiguration,
  RiskScaleType,
  RiskRoundingMethod,
  AssetImpactLevel,
  AssetImpactMapping,
} from "../models/risk-types";
import {
  RISK_SCALES,
  ALL_PREDEFINED_FACTORS,
  DEFAULT_ASSET_IMPACT_MAPPINGS,
} from "../models/risk-types";

// ==================== CALCULATION RESULTS ====================

export interface RiskCalculationResult {
  impact: number;
  likelihood: number;
  risk: number;
}

// ==================== ASSET IMPACT MAPPING ====================

/**
 * Returns the risk scale value for a given asset impact level.
 * Uses the configured mapping or falls back to the default for the active scale.
 */
export function getAssetImpactValue(
  assetImpact: AssetImpactLevel,
  configuration: RiskConfiguration
): number {
  const mapping: AssetImpactMapping =
    configuration.assetImpactMapping ??
    DEFAULT_ASSET_IMPACT_MAPPINGS[configuration.scale];
  return mapping[assetImpact] ?? 1;
}

/**
 * Given a list of asset impact levels (from linked assets),
 * returns the worst-case mapped risk value.
 * Returns 0 if no assets provided (unrated).
 */
export function getWorstAssetImpactValue(
  assetImpacts: AssetImpactLevel[],
  configuration: RiskConfiguration
): number {
  if (!assetImpacts.length) return 0;

  const ORDER: AssetImpactLevel[] = [
    "LOW", "MED", "MED+", "HIGH", "HIGH+", "CRITICAL",
  ];

  const worst = assetImpacts.reduce<AssetImpactLevel>((acc, cur) => {
    return ORDER.indexOf(cur) > ORDER.indexOf(acc) ? cur : acc;
  }, "LOW");

  return getAssetImpactValue(worst, configuration);
}

/**
 * Builds a pre-filled set of FactorRatings where all impact factors
 * are set to the asset-derived value.
 * Only applies when configuration.useAssetImpact === true.
 */
export function applyAssetImpactToFactorRatings(
  ratings: FactorRating[],
  assetImpacts: AssetImpactLevel[],
  configuration: RiskConfiguration
): FactorRating[] {
  if (!configuration.useAssetImpact || !assetImpacts.length) return ratings;

  const assetValue = getWorstAssetImpactValue(assetImpacts, configuration);
  const allFactors = [...ALL_PREDEFINED_FACTORS, ...configuration.customFactors];

  return ratings.map((rating) => {
    const factor = allFactors.find((f) => f.id === rating.factorId);
    if (factor?.category === "impact" && rating.value === 0) {
      // Only pre-fill if not yet rated by analyst
      return { ...rating, value: assetValue };
    }
    return rating;
  });
}

// ==================== RISK SCORE CALCULATION ====================

/**
 * Calculate impact, likelihood, and overall risk score.
 * Method: R = Impact × Likelihood (ISO 31000 / IEC 62443-3-2 severity matrix)
 * Severity range: 1 to N² where N = number of scale levels (e.g. 1–16 for 4-level)
 * Level mapping is threshold-based via RISK_SCALES or configuration.severityThresholds.
 */
export function calculateRiskValues(
  ratings: FactorRating[],
  configuration: RiskConfiguration,
): RiskCalculationResult {
  const allFactors = [
    ...ALL_PREDEFINED_FACTORS,
    ...configuration.customFactors,
  ];

  const impactRatings = ratings.filter((r) => {
    const factor = allFactors.find((f) => f.id === r.factorId);
    return factor?.category === "impact" && r.value > 0;
  });

  const likelihoodRatings = ratings.filter((r) => {
    const factor = allFactors.find((f) => f.id === r.factorId);
    return factor?.category === "likelihood" && r.value > 0;
  });

  const weightedAvg = (items: FactorRating[]): number => {
    if (items.length === 0) return 0;
    const weightedSum = items.reduce((sum, r) => sum + r.value * r.weight, 0);
    const totalWeight = items.reduce((sum, r) => sum + r.weight, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  const impact = weightedAvg(impactRatings);
  const likelihood = weightedAvg(likelihoodRatings);

  // R = I × L — raw severity, no normalization
  const risk = impact > 0 && likelihood > 0 ? impact * likelihood : 0;

  return {
    impact: Math.round(impact * 10) / 10,
    likelihood: Math.round(likelihood * 10) / 10,
    risk: Math.round(risk * 10) / 10,
  };
}

// ==================== DISPLAY HELPERS ====================

/**
 * Resolve the scale level for a severity value (R = I × L) using thresholds.
 * Returns the matching RiskScaleLevel, or the last level if above all thresholds.
 */
function getSeverityLevel(
  severity: number,
  scale: RiskScaleType,
  severityThresholds?: Record<number, number>,
) {
  const levels = RISK_SCALES[scale].levels;
  for (const level of levels) {
    const threshold = severityThresholds?.[level.value] ?? level.threshold;
    if (severity <= threshold) return level;
  }
  return levels[levels.length - 1];
}

/**
 * Get color for a risk severity value (R = I × L) based on thresholds.
 * Returns gray for unrated (value <= 0).
 * roundingMethod kept for call-site compatibility but no longer used.
 */
export function getRiskColor(
  value: number,
  scale: RiskScaleType,
  _roundingMethod?: RiskRoundingMethod,
  severityThresholds?: Record<number, number>,
): string {
  if (value <= 0) return "#6b7280";
  return getSeverityLevel(value, scale, severityThresholds).color;
}

/**
 * Get label for a risk severity value (R = I × L) based on thresholds.
 * Returns "-" for unrated.
 */
export function getRiskLabel(
  value: number,
  scale: RiskScaleType,
  _roundingMethod?: RiskRoundingMethod,
  severityThresholds?: Record<number, number>,
): string {
  if (value <= 0) return "-";
  return getSeverityLevel(value, scale, severityThresholds).label;
}

// ==================== FACTOR DISPLAY HELPERS ====================

/**
 * Get color for a factor average value (Impact or Likelihood, range 1–N).
 * Uses direct index mapping: value 1 → level[0], value N → level[N-1].
 * This is separate from getRiskColor which uses severity thresholds for R=I×L.
 */
export function getFactorColor(value: number, scale: RiskScaleType): string {
  if (value <= 0) return "#6b7280";
  const levels = RISK_SCALES[scale].levels;
  const idx = Math.min(Math.max(Math.round(value) - 1, 0), levels.length - 1);
  return levels[idx].color;
}

/**
 * Get label for a factor average value (Impact or Likelihood, range 1–N).
 */
export function getFactorLabel(value: number, scale: RiskScaleType): string {
  if (value <= 0) return "-";
  const levels = RISK_SCALES[scale].levels;
  const idx = Math.min(Math.max(Math.round(value) - 1, 0), levels.length - 1);
  return levels[idx].label;
}

// ==================== EN 50742 ATTACKER POTENTIAL ====================

/**
 * Calculate Attacker Potential per EN 50742 / IEC 62443-3-2.
 * Formula: AP = (EL × WoO) + AC
 *
 * @param el  Exposure Level (1–scale max)
 * @param woo Window of Opportunity (1–scale max)
 * @param ac  Attacker Capability (1–scale max)
 */
export function calculateAttackerPotential(
  el: number,
  woo: number,
  ac: number
): number {
  if (el <= 0 || woo <= 0 || ac <= 0) return 0;
  return (el * woo) + ac;
}

/**
 * Extract EN 50742 factor values from a set of FactorRatings.
 * Returns { el, woo, ac } with 0 if not rated.
 */
export function extractEN50742Factors(ratings: FactorRating[]): {
  el: number;
  woo: number;
  ac: number;
  ap: number;
} {
  const get = (id: string) => ratings.find((r) => r.factorId === id)?.value ?? 0;
  const el  = get("exposure_level");
  const woo = get("window_of_opportunity");
  const ac  = get("attacker_capability");
  return { el, woo, ac, ap: calculateAttackerPotential(el, woo, ac) };
}