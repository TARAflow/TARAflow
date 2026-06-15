// ==================== ASSET REFERENCE TYPES ====================
// Minimal asset snapshot consumed by Threat and Risk features.
// No dependency on asset feature types — Dependency Inversion.
//
// Consumers import directly from this file.

import type { SecurityGoalReference } from "./cianaaa-reference-types";

// ==================== IMPACT RATING REF ====================

/**
 * Per-criterion impact rating snapshot for Risk Tab prefill.
 * criterionId mirrors PREDEFINED_IMPACT_CRITERIA IDs:
 *   financial_damage | regulatory_compliance | reputation | privacy |
 *   operational | affected_users | recoverability | safety |
 *   physical_damage | environmental | supply_chain
 */
export interface AssetImpactRatingRef {
  criterionId: string;
  /** null = not rated, "na" = not applicable, number = 1–N on asset scale */
  value: number | null | "na";
}

// ==================== ASSET REFERENCE ====================

/**
 * Lightweight asset snapshot used in Threat and Risk dialogs.
 *
 * Phase 3: extended with impactRatings[] for direct 1:1 criterion→factor
 * prefill in Risk Tab. Optional for backward compatibility.
 */
export interface AssetReference {
  id: string;
  name: string;
  assetGroup: string;
  aggregatedImpact?: "LOW" | "MED" | "MED+" | "HIGH" | "HIGH+" | "CRITICAL";
  physicalImpact?: "reversible_injury" | "irreversible_injury" | "fatality";
  isHighValueAsset?: "low" | "medium" | "high" | "critical";
  hasSafetyAnnotation?: boolean;
  linkedElementIds?: string[];
  /** Active security goals (level !== "none") — populated by app layer. */
  securityGoals?: SecurityGoalReference[];
  /**
   * Per-criterion impact ratings from Asset Tab.
   * Populated by memoizedAssetDataRef in main-layout.tsx.
   */
  impactRatings?: AssetImpactRatingRef[];
}

// ==================== ASSET DATA REFERENCE ====================

/**
 * Asset data bundle passed from Asset phase into Threat and Risk dialogs.
 *
 * Phase 3: extended with impactScale for normalisation when
 * Asset scale ≠ Risk scale.
 */
export interface AssetDataReference {
  assets: AssetReference[];
  hasSafetyAssets: boolean;
  /** Asset Tab impact scale — defaults to "4-level" when not set. */
  impactScale?: "3-level" | "4-level" | "5-level";
}

// ==================== HELPERS ====================

/**
 * Returns true if any asset has safety-relevant data:
 * physicalImpact set, hasSafetyAnnotation, or safety impactRating > 0.
 */
export function hasSafetyData(assets: AssetReference[]): boolean {
  return assets.some(
    (a) =>
      a.physicalImpact !== undefined ||
      a.hasSafetyAnnotation ||
      (a.impactRatings?.some(
        (r) => r.criterionId === "safety" &&
               typeof r.value === "number" &&
               r.value > 0,
      ) ?? false),
  );
}

/**
 * Worst-case numeric value for a given criterion across a set of assets.
 * Returns 0 if no asset has a rated numeric value for that criterion.
 */
export function getWorstCriterionValue(
  assets: AssetReference[],
  criterionId: string,
): number {
  let worst = 0;
  for (const asset of assets) {
    if (!asset.impactRatings) continue;
    const rating = asset.impactRatings.find((r) => r.criterionId === criterionId);
    if (rating && typeof rating.value === "number" && rating.value > worst) {
      worst = rating.value;
    }
  }
  return worst;
}

/**
 * Proportional scale normalisation — conservative (Math.ceil).
 * Used when Asset scale ≠ Risk scale.
 *
 * Example: value=3 on 4-level → value=4 on 5-level
 */
export function normaliseImpactValue(
  assetValue: number,
  assetScaleLevels: number,
  riskScaleLevels: number,
): number {
  if (assetScaleLevels === riskScaleLevels) return assetValue;
  return Math.min(
    riskScaleLevels,
    Math.ceil((assetValue / assetScaleLevels) * riskScaleLevels),
  );
}