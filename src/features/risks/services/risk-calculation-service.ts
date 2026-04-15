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
 * Method: Likelihood × Impact (OWASP / EN 50742)
 * Risk = (Impact × Likelihood) / maxScale
 */
export function calculateRiskValues(
  ratings: FactorRating[],
  configuration: RiskConfiguration
): RiskCalculationResult {
  const scale = RISK_SCALES[configuration.scale];
  const maxValue = scale.levels.length;

  // Likelihood × Impact method
  const allFactors = [...ALL_PREDEFINED_FACTORS, ...configuration.customFactors];

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

  // Risk = Impact × Likelihood, normalized to scale
  const risk = maxValue > 0 ? (impact * likelihood) / maxValue : 0;

  return {
    impact: Math.round(impact * 10) / 10,
    likelihood: Math.round(likelihood * 10) / 10,
    risk: Math.round(risk * 10) / 10,
  };
}

// ==================== DISPLAY HELPERS ====================

/**
 * Helper to calculate level index based on rounding method
 */
function calculateLevelIndex(
  value: number,
  maxLevels: number,
  roundingMethod: RiskRoundingMethod = "round"
): number {
  if (roundingMethod === "ceil") {
    return Math.min(Math.max(Math.ceil(value) - 1, 0), maxLevels - 1);
  }
  return Math.min(Math.max(Math.round(value) - 1, 0), maxLevels - 1);
}

/**
 * Get color for a risk value based on the active scale.
 * Returns gray for unrated (value <= 0).
 */
export function getRiskColor(
  value: number,
  scale: RiskScaleType,
  roundingMethod: RiskRoundingMethod = "round"
): string {
  if (value <= 0) return "#6b7280";
  const scaleConfig = RISK_SCALES[scale];
  const idx = calculateLevelIndex(value, scaleConfig.levels.length, roundingMethod);
  return scaleConfig.levels[idx].color;
}

/**
 * Get label for a risk value based on the active scale.
 * Returns "-" for unrated.
 */
export function getRiskLabel(
  value: number,
  scale: RiskScaleType,
  roundingMethod: RiskRoundingMethod = "round"
): string {
  if (value <= 0) return "-";
  const scaleConfig = RISK_SCALES[scale];
  const idx = calculateLevelIndex(value, scaleConfig.levels.length, roundingMethod);
  return scaleConfig.levels[idx].label;
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