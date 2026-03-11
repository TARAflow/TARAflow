// ==================== ASSET MIGRATION ====================
// Forward-compatibility for stored asset data.
// Called on load before any business logic touches the data.

import type { AssetConfiguration } from "../models/asset-types";
import { DEFAULT_ASSET_CONFIGURATION } from "../models/asset-types";

/**
 * Migrate AssetConfiguration to current schema.
 *
 * Handles:
 * - Legacy impactCriteria: string[]  →  WeightedImpactCriterion[]
 *   (equal weights assigned: 1/n)
 * - Missing fields filled with defaults
 */
export function migrateAssetConfiguration(
  config: Partial<AssetConfiguration> & { impactCriteria?: unknown },
): AssetConfiguration {
  let impactCriteria = config.impactCriteria;

  // Legacy: string[] → WeightedImpactCriterion[]
  if (
    Array.isArray(impactCriteria) &&
    impactCriteria.length > 0 &&
    typeof impactCriteria[0] === "string"
  ) {
    const n = impactCriteria.length;
    impactCriteria = (impactCriteria as unknown as string[]).map((id) => ({
      id,
      weight: 1 / n,
    }));
  }

  return {
    impactCriteria:
      (impactCriteria as AssetConfiguration["impactCriteria"]) ??
      DEFAULT_ASSET_CONFIGURATION.impactCriteria,
    impactScale:
      config.impactScale ?? DEFAULT_ASSET_CONFIGURATION.impactScale,
    calculationMethod:
      config.calculationMethod ?? DEFAULT_ASSET_CONFIGURATION.calculationMethod,
    roundingMethod:
      config.roundingMethod ?? DEFAULT_ASSET_CONFIGURATION.roundingMethod,
  };
}