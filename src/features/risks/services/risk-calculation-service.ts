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
import { RISK_SCALES, LIKELIHOOD_SCALES } from "../models/risk-scale-types";
import {
  ALL_PREDEFINED_FACTORS,
  DEFAULT_ASSET_IMPACT_MAPPINGS,
  ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
} from "../models/risk-factor-types";
import type {
  AssetReference,
  AssetDataReference,
  AttackTreeLikelihoodReference,
  LikelihoodMethod,
} from "shared";
import { getWorstCriterionValue, normaliseImpactValue } from "shared";
import {
  ISO21434_FACTOR_LEVELS,
  ISO21434_ELAPSED_TIME_POINTS,
  ISO21434_EXPERTISE_POINTS,
  ISO21434_KNOWLEDGE_POINTS,
  ISO21434_WOO_POINTS,
  ISO21434_EQUIPMENT_POINTS,
  iso21434Feasibility,
} from "../models/iso21434-core";
import {
  TVRA_FACTOR_LEVELS,
  TVRA_TIME_POINTS,
  TVRA_EXPERTISE_POINTS,
  TVRA_KNOWLEDGE_POINTS,
  TVRA_OPPORTUNITY_POINTS,
  TVRA_EQUIPMENT_POINTS,
  TVRA_INTENSITY_POINTS,
  TVRA_AP_LEVEL_LIKELIHOOD,
  tvraApLevel,
} from "../models/etsi-tvra-core";


// ==================== CALCULATION RESULTS ====================

export interface RiskCalculationResult {
  impact: number;
  likelihood: number;
  risk: number;
}

// ==================== RISK SCORE CALCULATION ====================

// ==================== SCORE-TABLE LIKELIHOOD ====================
// ISO 21434 / ETSI TVRA compute likelihood from per-level point tables (summed
// to an attack potential, mapped to a band), not a weighted mean. A
// FactorRating.value is the 1-based level index into the factor's level list;
// value 0 = not rated. The band ordinal is normalised onto the project
// likelihood scale via the same helper the asset-impact path uses.

const ISO_POINTS: Record<string, Record<string, number>> = {
  iso_elapsed_time: ISO21434_ELAPSED_TIME_POINTS,
  iso_expertise: ISO21434_EXPERTISE_POINTS,
  iso_knowledge: ISO21434_KNOWLEDGE_POINTS,
  iso_window_of_opportunity: ISO21434_WOO_POINTS,
  iso_equipment: ISO21434_EQUIPMENT_POINTS,
};

const TVRA_POINTS: Record<string, Record<string, number>> = {
  time: TVRA_TIME_POINTS,
  expertise: TVRA_EXPERTISE_POINTS,
  knowledge: TVRA_KNOWLEDGE_POINTS,
  etsi_opportunity: TVRA_OPPORTUNITY_POINTS,
  equipment: TVRA_EQUIPMENT_POINTS,
  etsi_intensity: TVRA_INTENSITY_POINTS,
};

// ISO 21434 feasibility → likelihood ordinal (higher feasibility = more likely).
const ISO_FEASIBILITY_ORDINAL: Record<string, number> = {
  high: 4,
  medium: 3,
  low: 2,
  "very-low": 1,
};

function sumScoreTablePoints(
  ratings: FactorRating[],
  levels: Record<string, readonly string[]>,
  points: Record<string, Record<string, number>>,
): { sum: number; rated: number } {
  let sum = 0;
  let rated = 0;
  for (const factorId of Object.keys(points)) {
    const value = ratings.find((r) => r.factorId === factorId)?.value ?? 0;
    if (value <= 0) continue; // not rated
    const key = levels[factorId]?.[value - 1]; // 1-based level index
    if (key === undefined) continue;
    sum += points[factorId][key] ?? 0;
    rated++;
  }
  return { sum, rated };
}

/**
 * Likelihood for a score-table method, expressed on the project likelihood
 * scale (1..scaleLevels). Returns 0 when no method factor is rated (mirrors the
 * weighted-mean path's "empty → 0").
 */
function scoreTableLikelihood(
  ratings: FactorRating[],
  method: "iso-21434" | "etsi-tvra",
  scaleLevels: number,
): number {
  if (method === "iso-21434") {
    const { sum, rated } = sumScoreTablePoints(
      ratings,
      ISO21434_FACTOR_LEVELS,
      ISO_POINTS,
    );
    if (rated === 0) return 0;
    const ordinal = ISO_FEASIBILITY_ORDINAL[iso21434Feasibility(sum)];
    return normaliseImpactValue(ordinal, 4, scaleLevels);
  }
  // etsi-tvra
  const { sum, rated } = sumScoreTablePoints(
    ratings,
    TVRA_FACTOR_LEVELS,
    TVRA_POINTS,
  );
  if (rated === 0) return 0;
  const ordinal = TVRA_AP_LEVEL_LIKELIHOOD[tvraApLevel(sum)];
  return normaliseImpactValue(ordinal, 5, scaleLevels);
}

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

  // Likelihood: score-table methods (ISO 21434 / ETSI TVRA) compute from
  // per-level point tables; everything else uses the weighted mean.
  const method: LikelihoodMethod =
    configuration.likelihoodMethod ?? "weighted-mean";
  const scaleLevels = LIKELIHOOD_SCALES[configuration.scale].levels.length;
  const likelihood =
    method === "iso-21434" || method === "etsi-tvra"
      ? scoreTableLikelihood(ratings, method, scaleLevels)
      : weightedAvg(likelihoodRatings);
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

// ==================== ATTACK-TREE LIKELIHOOD (5b-2) ====================

/**
 * Project-wide policy for how a threat-anchored tree contributes its likelihood
 * (5b design, Fall 1): "factor" writes an active attack_tree_likelihood rating
 * that averages in; "advisory" records provenance only and writes NO factor, so
 * calculateRiskValues never sees it. Default "factor".
 */
export type TreeLikelihoodContribution = "factor" | "advisory";

/**
 * Set (or clear) the attack_tree_likelihood factor rating on a risk's ratings.
 *
 * - contribution "factor":   upserts an attack_tree_likelihood rating with
 *   value = input.mappedValue, weight = the factor's default (1) unless already
 *   present (keeps an analyst-adjusted weight), source = "attack-tree".
 * - contribution "advisory": REMOVES any attack_tree_likelihood rating, so the
 *   value is not averaged in. Provenance lives on the Risk (attackTreeAssessment),
 *   handled by the caller — not here.
 *
 * Pure and stateless; returns a new array. No attack-tree import — the mapped
 * value is supplied by the caller.
 */
export function setAttackTreeLikelihoodFactor(
  ratings: FactorRating[],
  input: AttackTreeLikelihoodReference | null,
  contribution: TreeLikelihoodContribution = "factor",
): FactorRating[] {
  const withoutTree = ratings.filter(
    (r) => r.factorId !== ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
  );

  // Advisory, or nothing to set → the factor simply does not exist.
  if (!input || contribution === "advisory") {
    return withoutTree;
  }

  // Preserve an existing analyst-adjusted weight if the factor was already there.
  const existing = ratings.find(
    (r) => r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
  );
  const weight = existing?.weight ?? 1;

  return [
    ...withoutTree,
    {
      factorId: ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
      value: input.mappedValue,
      weight,
      source: "attack-tree",
    },
  ];
}