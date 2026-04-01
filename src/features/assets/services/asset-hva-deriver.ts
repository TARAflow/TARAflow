// ==================== HVA DERIVER ====================
// Derives isHighValueAsset for Infrastructure and Physical assets.
//
// Source of truth: taraflow-asset-beziehungen.md §Ableitungslogik isHighValueAsset
//
// Derivation inputs:
//   1. assetDestructionImpact — derived from MAX(financial_damage, operational, physical_damage)
//   2. replacementLeadTime    — analyst-set in asset-dialog
//   3. vendorDependency       — analyst-set in asset-dialog
//   4. spareAvailability      — analyst-set in asset-dialog
//
// NOTE: Safety Impact does NOT feed into HVA — safety-relevant assets are
// handled separately by the Safety Override Rule in deriveAggregatedImpact.

import type { Asset } from "../models/asset-types";
import type { ImpactRating, WeightedImpactCriterion } from "../models/asset-impact-types";

// ==================== TYPES ====================

export type HVALevel = "low" | "medium" | "high" | "critical";

// Numeric rank for comparing lead time brackets
const LEAD_TIME_RANK: Record<string, number> = {
  "<3m (low)":       0,
  "3-6m (medium)":   1,
  "6-12m (high)":    2,
  ">12m (critical)": 3,
};

// ==================== HELPERS ====================

/**
 * Derive assetDestructionImpact from impactRatings.
 * = MAX of financial_damage, operational, physical_damage criteria.
 * Returns qualitative level: "low" | "medium" | "high" | "critical"
 */
export function deriveAssetDestructionImpact(
  impactRatings: ImpactRating[],
  scaleMax: number = 4,
): "low" | "medium" | "high" | "critical" | undefined {
  const relevantIds = ["financial_damage", "operational", "physical_damage"];
  const values = impactRatings
    .filter(
      (r): r is ImpactRating & { value: number } =>
        relevantIds.includes(r.criterionId) && typeof r.value === "number",
    )
    .map((r) => r.value);

  if (values.length === 0) return undefined;

  const max = Math.max(...values);

  // Map numeric scale to qualitative — based on 4-level default
  if (max >= scaleMax)      return "critical";
  if (max >= scaleMax - 1)  return "high";
  if (max >= scaleMax - 2)  return "medium";
  return "low";
}

// ==================== CORE DERIVER ====================

export interface HVADerivationResult {
  level: HVALevel | undefined;
  source: "derived" | "manual" | "not_applicable";
  /** Reason string for UI tooltip / audit trail */
  derivedFrom?: string;
}

/**
 * Derive isHighValueAsset for one asset.
 *
 * Only applies to Infrastructure and Physical asset groups.
 * For other groups returns { source: "not_applicable" }.
 *
 * If isHighValueAssetSource === "manual", the stored value is authoritative.
 *
 * Derive logic (§ taraflow-asset-beziehungen.md):
 *
 *   HVA "low":      destructionImpact === "medium" AND leadTime >= "3-6m"
 *   HVA "medium":   destructionImpact === "high"   AND leadTime >= "3-6m"
 *   HVA "high":     destructionImpact === "high"   AND leadTime >= "6-12m"
 *                   AND (vendor === "limited" OR spare === "supplier")
 *   HVA "critical": destructionImpact === "high"   AND leadTime >= "6-12m"
 *                   AND (vendor === "single_source" OR spare === "none")
 */
export function deriveHVA(asset: Asset): HVADerivationResult {
  // Only applies to infrastructure and physical
  const group = asset.assetGroup;
  if (group !== "infrastructure" && group !== "physical") {
    return { level: undefined, source: "not_applicable" };
  }

  // Respect manual override
  if (
    asset.properties?.isHighValueAssetSource === "manual" &&
    asset.properties?.isHighValueAsset
  ) {
    return {
      level: asset.properties.isHighValueAsset,
      source: "manual",
    };
  }

  const props = asset.properties;
  const leadTimeRank = LEAD_TIME_RANK[props?.replacementLeadTime ?? ""] ?? -1;
  const vendor = props?.vendorDependency;
  const spare = props?.spareAvailability;

  // Derive destruction impact from ratings (4-level scale assumed)
  const destruction =
    props?.assetDestructionImpact ??
    deriveAssetDestructionImpact(asset.impactRatings, 4);

  if (!destruction || leadTimeRank < 0) {
    return { level: undefined, source: "derived", derivedFrom: "Insufficient data" };
  }

  let level: HVALevel | undefined;

  if (destruction === "high" && leadTimeRank >= LEAD_TIME_RANK["6-12m (high)"]) {
    if (vendor === "single_source" || spare === "none") {
      level = "critical";
    } else if (vendor === "limited" || spare === "supplier") {
      level = "high";
    } else {
      level = "medium"; // high destruction + long lead, but multi-vendor + on-site spare
    }
  } else if (destruction === "high" && leadTimeRank >= LEAD_TIME_RANK["3-6m (medium)"]) {
    level = "medium";
  } else if (destruction === "medium" && leadTimeRank >= LEAD_TIME_RANK["3-6m (medium)"]) {
    level = "low";
  }

  const derivedFrom = level
    ? `destruction=${destruction}, leadTime=${props?.replacementLeadTime}, ` +
      `vendor=${vendor ?? "?"}, spare=${spare ?? "?"}`
    : "Below HVA threshold";

  return { level, source: "derived", derivedFrom };
}

/**
 * Apply HVA derivation result back to asset properties.
 * Updates isHighValueAsset and isHighValueAssetSource.
 * Also updates assetDestructionImpact if not manually set.
 */
export function applyHVAToAsset(asset: Asset): Asset {
  // Skip manual override
  if (asset.properties?.isHighValueAssetSource === "manual") {
    return asset;
  }

  const result = deriveHVA(asset);
  if (result.source === "not_applicable") return asset;

  const derivedDestruction = deriveAssetDestructionImpact(asset.impactRatings, 4);

  return {
    ...asset,
    properties: {
      ...asset.properties,
      isHighValueAsset: result.level,
      isHighValueAssetSource: "derived",
      // Update assetDestructionImpact from latest ratings if not manually set
      assetDestructionImpact:
        derivedDestruction ?? asset.properties?.assetDestructionImpact,
    },
  };
}