// ==================== ASSET FILTER ====================
// Asset tab filter (AF-1): asset type and criticality, across all group
// accordions. The filter is a view setting — it is kept per project for the
// session, never written to the project file. Criticality is the level the
// "Overall" column shows; "from level" keeps that level and every higher one.

import { ASSET_GROUP_CONFIG, type AssetGroup } from "shared";
import type { Asset } from "../models/asset-types";
import type { ImpactRoundingMethod } from "../models/asset-impact-types";
import { getImpactLevel } from "../services/asset-impact-calculator";

// ==================== CATEGORY LOOKUP ====================
// Primary:  asset.properties.category  — set by asset-sync-service from dfdAsset.assetGroup
// Fallback: ID prefix heuristic        — for assets in storage before the sync fix was deployed
//   DA-xxx → data  |  SY-xxx → system  |  PR-xxx → process
//   IN-xxx → infrastructure  |  HU-xxx → human

const ID_PREFIX_TO_CATEGORY: Record<string, AssetGroup> = {
  DA: "data",
  FU: "function",
  SY: "system",
  IF: "infrastructure",
  PR: "process",
  PH: "physical",
  SV: "service",
  HU: "human",
  EN: "environment",
};

export function getCategoryFromAsset(asset: Asset): AssetGroup | undefined {
  // 1. Canonical field on the Asset itself (used elsewhere, e.g. showHVAColumn's
  //    `a.assetGroup === "infrastructure"` check) — this was previously not
  //    consulted here at all, which is why Physical/Process/Service/Human/
  //    Environment assets fell through to "–": their properties.category was
  //    unset and their ID prefix didn't match ID_PREFIX_TO_CATEGORY.
  if (asset.assetGroup && asset.assetGroup in ASSET_GROUP_CONFIG)
    return asset.assetGroup as AssetGroup;

  // 2. properties.category — populated by asset-sync-service since sync fix
  const fromProperties = asset.properties?.category;
  if (fromProperties && fromProperties in ASSET_GROUP_CONFIG)
    return fromProperties as AssetGroup;

  // 3. Fallback: derive from displayId prefix for legacy / manually-created
  //    assets (displayId keeps the group prefix even once id becomes a UUID).
  const prefix = (asset.displayId ?? asset.id)?.split("-")[0]?.toUpperCase();
  return prefix ? ID_PREFIX_TO_CATEGORY[prefix] : undefined;
}

// ==================== FILTER ====================

export interface AssetFilter {
  /** Asset types shown; empty = every type. */
  types: readonly AssetGroup[];
  /** Lowest criticality level shown; null = every level, unrated included. */
  minLevel: number | null;
  /** With a lowest level: show the assets without a rating too. */
  includeUnrated: boolean;
}

export const NO_ASSET_FILTER: AssetFilter = { types: [], minLevel: null, includeUnrated: false };

export function isAssetFilterActive(filter: AssetFilter): boolean {
  return filter.types.length > 0 || filter.minLevel !== null;
}

/** The level the "Overall" column shows; 0 = not rated. */
export function assetCriticalityLevel(asset: Asset, rounding?: ImpactRoundingMethod): number {
  return getImpactLevel(asset.overallImpact ?? 0, rounding);
}

export function filterAssets(
  assets: readonly Asset[],
  filter: AssetFilter,
  rounding?: ImpactRoundingMethod,
): Asset[] {
  if (!isAssetFilterActive(filter)) return [...assets];
  const types = new Set(filter.types);
  return assets.filter((asset) => {
    if (types.size > 0) {
      const type = getCategoryFromAsset(asset);
      if (!type || !types.has(type)) return false;
    }
    if (filter.minLevel === null) return true;
    const level = assetCriticalityLevel(asset, rounding);
    return level === 0 ? filter.includeUnrated : level >= filter.minLevel;
  });
}

/** The asset types present, in the order of the type config, with their count. */
export function assetTypeCounts(assets: readonly Asset[]): { type: AssetGroup; count: number }[] {
  const counts = new Map<AssetGroup, number>();
  for (const asset of assets) {
    const type = getCategoryFromAsset(asset);
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return (Object.keys(ASSET_GROUP_CONFIG) as AssetGroup[])
    .filter((type) => counts.has(type))
    .map((type) => ({ type, count: counts.get(type)! }));
}
