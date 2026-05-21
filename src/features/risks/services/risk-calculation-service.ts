// ==================== RISK CALCULATION SERVICE ====================
// Single Responsibility: All risk score calculations and asset impact mapping.
//
// Phase 3 additions:
//   applyAssetCriteriaToFactorRatings() — 1:1 criterion→factor prefill from Asset Tab
//   deriveSafetyValue()                 — physicalImpact → safety factor value
//   resetFactorToDerived()              — reset manual override back to derived value
//
// Dependencies: shared AssetReference / AssetDataReference (no custom reference types)

import type {
  FactorRating,
  AssetImpactLevel,
  AssetImpactMapping,
} from "../models/risk-factor-types";
import type {
  RiskScaleType,
  RiskRoundingMethod,
} from "../models/risk-scale-types";
import type { RiskConfiguration } from "../models/risk-config-types";
import { RISK_SCALES } from "../models/risk-scale-types";
import {
  ALL_PREDEFINED_FACTORS,
  DEFAULT_ASSET_IMPACT_MAPPINGS,
} from "../models/risk-factor-types";
import type { AssetReference, AssetDataReference } from "shared";
import { getWorstCriterionValue, normaliseImpactValue } from "shared";

// ==================== CALCULATION RESULTS ====================

export interface RiskCalculationResult {
  impact: number;
  likelihood: number;
  risk: number;
}

// ==================== RISK SCORE CALCULATION ====================

/**
 * Calculate impact, likelihood, and overall risk score.
 * Method: R = Impact × Likelihood (ISO 31000 / IEC 62443-3-2)
 * Severity range: 1 to N² where N = number of scale levels.
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
  const risk = impact > 0 && likelihood > 0 ? impact * likelihood : 0;

  return {
    impact: Math.round(impact * 10) / 10,
    likelihood: Math.round(likelihood * 10) / 10,
    risk: Math.round(risk * 10) / 10,
  };
}

// ==================== DISPLAY HELPERS ====================

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
 * Get color for a risk severity value (R = I×L) using threshold mapping.
 * Returns gray (#6b7280) for unrated (value <= 0).
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
 * Get label for a risk severity value (R = I×L) using threshold mapping.
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

/**
 * Get color for a factor average value (Impact or Likelihood, range 1–N).
 * Uses direct index mapping — separate from getRiskColor which uses severity thresholds.
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

// ==================== ASSET IMPACT MAPPING (aggregated fallback) ====================

/**
 * Returns the risk scale value for a given aggregated asset impact level.
 * Used as fallback when no per-criterion match exists.
 */
export function getAssetImpactValue(
  assetImpact: AssetImpactLevel,
  configuration: RiskConfiguration,
): number {
  const mapping: AssetImpactMapping =
    configuration.assetImpactMapping ??
    DEFAULT_ASSET_IMPACT_MAPPINGS[configuration.scale];
  return mapping[assetImpact] ?? 1;
}

/**
 * Given a list of aggregated asset impact levels, returns the worst-case
 * mapped risk scale value. Returns 0 if no assets provided.
 */
export function getWorstAssetImpactValue(
  assetImpacts: AssetImpactLevel[],
  configuration: RiskConfiguration,
): number {
  if (!assetImpacts.length) return 0;

  const ORDER: AssetImpactLevel[] = [
    "LOW", "MED", "MED+", "HIGH", "HIGH+", "CRITICAL",
  ];

  const worst = assetImpacts.reduce<AssetImpactLevel>(
    (acc, cur) => (ORDER.indexOf(cur) > ORDER.indexOf(acc) ? cur : acc),
    "LOW",
  );

  return getAssetImpactValue(worst, configuration);
}

// ==================== SAFETY FACTOR DERIVATION ====================

/**
 * Maps a physicalImpact annotation to a 4-level safety factor value.
 * Aligned with SAFETY_IMPACT_SCALE in asset-impact-types.ts.
 *
 * reversible_injury   → 2  (moderate — covers reversible_minor + reversible_moderate)
 * irreversible_injury → 3
 * fatality            → 4
 *
 * Note: "reversible_injury" maps to 2 (not 1) to be conservative —
 * the Asset model doesn't distinguish minor from moderate at this level.
 */
export function deriveSafetyValueFromPhysicalImpact(
  physicalImpact: "reversible_injury" | "irreversible_injury" | "fatality",
): number {
  switch (physicalImpact) {
    case "reversible_injury":   return 2;
    case "irreversible_injury": return 3;
    case "fatality":            return 4;
  }
}

/**
 * Derives the safety factor value for a risk from linked assets.
 *
 * Priority order (highest wins):
 * 1. Worst physicalImpact → deriveSafetyValueFromPhysicalImpact()
 * 2. Worst "safety" impactRating numeric value (normalised to risk scale)
 * 3. 0 (no safety data)
 *
 * Safety factor uses a fixed 4-level scale — no normalisation applied
 * for physicalImpact path. Normalisation is applied for the impactRating path.
 */
export function deriveSafetyValue(
  linkedAssets: AssetReference[],
  assetScaleLevels: number,
  riskScaleLevels: number,
): number {
  // Priority 1: physicalImpact annotation (fixed 4-level, no normalisation)
  const ORDER = [
    "reversible_injury",
    "irreversible_injury",
    "fatality",
  ] as const;

  const physicalImpacts = linkedAssets
    .map((a) => a.physicalImpact)
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  if (physicalImpacts.length > 0) {
    const worst = physicalImpacts.reduce((acc, cur) =>
      ORDER.indexOf(cur) > ORDER.indexOf(acc) ? cur : acc,
    );
    return deriveSafetyValueFromPhysicalImpact(worst);
  }

  // Priority 2: safety impactRating numeric value (normalised)
  const safetyRatingValue = getWorstCriterionValue(linkedAssets, "safety");
  if (safetyRatingValue > 0) {
    return normaliseImpactValue(safetyRatingValue, assetScaleLevels, riskScaleLevels);
  }

  return 0;
}

// ==================== ASSET CRITERIA PREFILL ====================

/**
 * Pre-fills impact FactorRatings from linked asset criteria using 1:1 ID matching.
 *
 * Rules:
 * - Only applied when configuration.useAssetImpact === true
 * - Only pre-fills when source !== "manual" (never overwrites analyst entries)
 * - Sets source = "derived", derivedValue = computed value
 * - Safety factor handled via deriveSafetyValue() (physicalImpact takes priority)
 * - Scale normalisation applied when asset scale ≠ risk scale
 *
 * @param ratings       Current FactorRating[] for the risk
 * @param linkedAssets  Assets linked to this threat (resolved from linkedAssetIds)
 * @param assetDataRef  Full asset data bundle (provides impactScale)
 * @param configuration Risk configuration (provides scale + useAssetImpact flag)
 */
export function applyAssetCriteriaToFactorRatings(
  ratings: FactorRating[],
  linkedAssets: AssetReference[],
  assetDataRef: AssetDataReference,
  configuration: RiskConfiguration,
): FactorRating[] {
  if (!configuration.useAssetImpact || linkedAssets.length === 0) return ratings;

  const assetScaleStr = assetDataRef.impactScale ?? "4-level";
  const assetScaleLevels = parseInt(assetScaleStr.split("-")[0], 10);
  const riskScaleLevels = RISK_SCALES[configuration.scale].levels.length;
  const allFactors = [...ALL_PREDEFINED_FACTORS, ...configuration.customFactors];

  return ratings.map((rating) => {
    // Only process impact factors
    const factor = allFactors.find((f) => f.id === rating.factorId);
    if (!factor || factor.category !== "impact") return rating;

    // Never overwrite a manually set value
    if (rating.source === "manual") return rating;

    let derivedValue = 0;

    if (rating.factorId === "safety") {
      // Safety: uses physicalImpact annotation with priority over impactRatings
      derivedValue = deriveSafetyValue(linkedAssets, assetScaleLevels, riskScaleLevels);
    } else {
      // All other impact factors: direct 1:1 criterion ID match
      const worstValue = getWorstCriterionValue(linkedAssets, rating.factorId);
      if (worstValue > 0) {
        derivedValue = normaliseImpactValue(worstValue, assetScaleLevels, riskScaleLevels);
      }
    }

    if (derivedValue === 0) {
      // No asset data for this factor — clear stale derivedValue if present
      if (rating.source === "derived") {
        return { ...rating, value: 0, derivedValue: undefined, source: undefined };
      }
      return rating;
    }

    return {
      ...rating,
      value: derivedValue,
      derivedValue,
      source: "derived" as const,
    };
  });
}

/**
 * Legacy wrapper — used by RiskDialog init when configuration.useAssetImpact
 * is true but only aggregatedImpact is available (no per-criterion data).
 * Sets all impact factors to the same worst-case value.
 *
 * @deprecated Prefer applyAssetCriteriaToFactorRatings() when impactRatings[] is available.
 */
export function applyAssetImpactToFactorRatings(
  ratings: FactorRating[],
  assetImpacts: AssetImpactLevel[],
  configuration: RiskConfiguration,
): FactorRating[] {
  if (!configuration.useAssetImpact || !assetImpacts.length) return ratings;

  const assetValue = getWorstAssetImpactValue(assetImpacts, configuration);
  const allFactors = [...ALL_PREDEFINED_FACTORS, ...configuration.customFactors];

  return ratings.map((rating) => {
    const factor = allFactors.find((f) => f.id === rating.factorId);
    if (factor?.category === "impact" && rating.value === 0 && rating.source !== "manual") {
      return { ...rating, value: assetValue, derivedValue: assetValue, source: "derived" as const };
    }
    return rating;
  });
}

/**
 * Reset a single FactorRating back to its derived value.
 * Called when analyst clicks "Reset to derived" in the Risk Dialog.
 */
export function resetFactorToDerived(rating: FactorRating): FactorRating {
  if (rating.derivedValue === undefined) return rating;
  return {
    ...rating,
    value: rating.derivedValue,
    source: "derived",
  };
}

// ==================== EN 50742 ATTACKER POTENTIAL ====================

/**
 * Calculate Attacker Potential per EN 50742 / IEC 62443-3-2.
 * Formula: AP = (EL × WoO) + AC
 */
export function calculateAttackerPotential(
  el: number,
  woo: number,
  ac: number,
): number {
  if (el <= 0 || woo <= 0 || ac <= 0) return 0;
  return el * woo + ac;
}

/**
 * Extract EN 50742 factor values from a FactorRating[].
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