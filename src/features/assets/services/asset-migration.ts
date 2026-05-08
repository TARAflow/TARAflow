// ==================== ASSET MIGRATION ====================
// Forward-compatibility for stored asset data.
// Called on load before any business logic touches the data.

import type {
  AssetConfiguration,
  AssetData,
  Asset,
} from "../models/asset-types";
import type { SecurityGoal } from "../models/asset-security-goals-types";
import { DEFAULT_ASSET_CONFIGURATION } from "../models/asset-types";

// ==================== CONFIGURATION MIGRATION ====================

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

// ==================== SECURITY GOAL MIGRATION ====================

/**
 * Migrate a single SecurityGoal from the legacy boolean schema.
 *
 * Legacy schema:  { type, enabled: boolean, formalDescription, source?, rationale? }
 * Current schema: { type, level: CIANAAALevel, formalDescription, source?, rationale? }
 *
 * Migration rule (conservative):
 *   enabled: true  → level: "high"
 *   enabled: false → level: "none"
 *
 * "high" is conservative: if the analyst had previously enabled a goal,
 * we assume it was relevant and give it the highest non-critical level.
 * The analyst can downgrade via Expert Mode.
 *
 * Already-migrated goals (have `level` field) are passed through unchanged.
 */
export function migrateSecurityGoal(raw: unknown): SecurityGoal {
  const sg = raw as Record<string, unknown>;

  // Already on current schema
  if (typeof sg["level"] === "string") {
    return sg as unknown as SecurityGoal;
  }

  // Legacy schema: enabled: boolean
  const enabled = sg["enabled"];
  return {
    type: sg["type"] as SecurityGoal["type"],
    level: enabled === true ? "high" : "none",
    formalDescription: (sg["formalDescription"] as string) ?? "",
    source: sg["source"] as SecurityGoal["source"],
    rationale: sg["rationale"] as string | undefined,
  };
}

/**
 * Migrate all SecurityGoals on a single asset.
 * Safe to call on already-migrated data (idempotent).
 */
export function migrateAssetSecurityGoals(asset: Asset): Asset {
  if (!asset.securityGoals?.length) return asset;

  // Check if migration is needed (any entry still has boolean enabled)
  const needsMigration = asset.securityGoals.some(
    (sg) => typeof (sg as unknown as Record<string, unknown>)["enabled"] === "boolean",
  );
  if (!needsMigration) return asset;

  return {
    ...asset,
    securityGoals: asset.securityGoals.map(migrateSecurityGoal),
    lastModified: new Date().toISOString(),
  };
}

// ==================== FULL ASSET DATA MIGRATION ====================

/**
 * Migrate a complete AssetData object to the current schema.
 * Applies all migrations in order — safe to call on already-migrated data.
 *
 * Call this on load before any business logic touches the data.
 */
export function migrateAssetData(raw: unknown): AssetData {
  const data = raw as AssetData;

  const migratedConfiguration = migrateAssetConfiguration(
    data.configuration ?? {},
  );

  const migratedAssets = (data.assets ?? []).map(migrateAssetSecurityGoals);

  const hasChanges =
    migratedConfiguration !== data.configuration ||
    migratedAssets.some((a, i) => a !== data.assets[i]);

  return hasChanges
    ? {
        ...data,
        configuration: migratedConfiguration,
        assets: migratedAssets,
        lastModified: new Date().toISOString(),
      }
    : data;
}