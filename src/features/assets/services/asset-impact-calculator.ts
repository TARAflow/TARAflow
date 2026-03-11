// ==================== ASSET IMPACT CALCULATOR ====================
// Pure calculation functions for asset impact.
// No side effects, no service dependencies.

import type { Asset, AssetData } from "../models/asset-types";
import type {
  ImpactRating,
  ImpactCalculationMethod,
  ImpactRoundingMethod,
  WeightedImpactCriterion,
} from "../models/asset-impact-types";

// ==================== SINGLE ASSET IMPACT ====================

/**
 * Calculate overall impact for a set of ratings.
 *
 * conservative (MAX): weights are ignored — worst case always wins.
 * average:            weighted average; falls back to equal weights
 *                     if no criteria config is provided.
 */
export function calculateOverallImpact(
  ratings: ImpactRating[],
  method: ImpactCalculationMethod,
  roundingMethod: ImpactRoundingMethod = "round",
  criteria?: WeightedImpactCriterion[],
): number {
  if (ratings.length === 0) return 0;

  const active = ratings.filter((r) => r.value > 0);
  if (active.length === 0) return 0;

  if (method === "conservative") {
    return Math.max(...active.map((r) => r.value));
  }

  // Weighted average
  let totalWeight = 0;
  let weightedSum = 0;

  for (const rating of active) {
    const criterion = criteria?.find((c) => c.id === rating.criterionId);
    const weight = criterion?.weight ?? 1;
    weightedSum += rating.value * weight;
    totalWeight += weight;
  }

  const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return roundingMethod === "ceil"
    ? Math.ceil(avg * 10) / 10
    : Math.round(avg * 10) / 10;
}

/**
 * Get discrete level for a calculated impact value.
 */
export function getImpactLevel(
  value: number,
  roundingMethod: ImpactRoundingMethod = "round",
): number {
  if (value <= 0) return 0;
  return roundingMethod === "ceil" ? Math.ceil(value) : Math.round(value);
}

// ==================== BATCH RECALCULATION ====================

/**
 * Recalculate overallImpact for all assets.
 * Called after configuration changes (method, scale, weights).
 */
export function recalculateAllImpacts(assetData: AssetData): AssetData {
  const { configuration } = assetData;

  const updatedAssets: Asset[] = assetData.assets.map((asset) => ({
    ...asset,
    overallImpact: calculateOverallImpact(
      asset.impactRatings,
      configuration.calculationMethod,
      configuration.roundingMethod,
      configuration.impactCriteria,  // pass weights
    ),
  }));

  return {
    ...assetData,
    assets: updatedAssets,
    lastModified: new Date().toISOString(),
  };
}