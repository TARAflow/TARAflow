/**
 * Part of the schema 9 step (migrate_8_to_9).
 * Asset-level safety properties become derived. AssetProperties no longer
 * stores safetyRelevant, containsSafetyRelevantData, safetyImpact and
 * safetyRationale — an asset's safety relevance and severity come from
 * physicalImpact (SafetyAnnotation / Hazard Item / manual override).
 *
 * Per asset (assets.assets[]):
 *   - safetyRelevant, containsSafetyRelevantData: dropped (pure flags).
 *   - safetyImpact (≠ "none") with NO physicalImpact on the asset: kept as a
 *     manual override (physicalImpactSource "manual") so the rating is not
 *     lost. The rationale carries the old safetyRationale plus a [MIGRATED]
 *     marker. No other path rated the asset, so the override cannot hide a
 *     worse rating.
 *   - safetyImpact when the asset already has a physicalImpact: dropped —
 *     annotation / hazard / manual rate the asset already.
 *
 * Element properties (DFD elements) are NOT touched: there safetyRelevant
 * stays an input for threat generation.
 *
 * Idempotent: a migrated file has none of the dropped keys.
 */

const DROPPED_KEYS = [
  "safetyRelevant",
  "containsSafetyRelevantData",
  "safetyImpact",
  "safetyRationale",
] as const;

const MIGRATION_MARKER =
  "[MIGRATED] from asset property 'Safety Impact' (schema v9).";

function migrateAsset(asset: any): any {
  const props = asset?.properties;
  if (!props || !DROPPED_KEYS.some((k) => k in props)) return asset;

  const nextProps: Record<string, unknown> = { ...props };
  for (const k of DROPPED_KEYS) delete nextProps[k];

  const next: any = { ...asset, properties: nextProps };

  const impact = props.safetyImpact;
  if (impact && impact !== "none" && !asset.physicalImpact) {
    const rationale = typeof props.safetyRationale === "string"
      ? props.safetyRationale.trim()
      : "";
    next.physicalImpact = impact;
    next.physicalImpactSource = "manual";
    next.physicalImpactRationale = rationale
      ? `${rationale}\n${MIGRATION_MARKER}`
      : MIGRATION_MARKER;
  }
  return next;
}

/** Applies the asset-level safety derivation; does not touch schemaVersion. */
export function deriveAssetSafety(data: any): any {
  const assets = data?.assets?.assets;
  if (!Array.isArray(assets)) return data;
  return { ...data, assets: { ...data.assets, assets: assets.map(migrateAsset) } };
}
