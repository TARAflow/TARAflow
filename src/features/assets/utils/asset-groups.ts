// ==================== ASSET GROUPS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6c, D20): an asset
// belongs to the multiprocess whose elements and flows hold it. Held in
// several multiprocesses → "Shared". A top-level element or flow that only
// carries the asset into one multiprocess (e.g. the maintenance session that
// writes the alarm configuration) does not make it shared. Held only on the
// top level → "Top level"; held by nothing in the DFD → "Not in the DFD".

import { TOP_LEVEL_GROUP, groupsOfDfdItem, type DfdTableGroups } from "shared";
import type { Asset } from "../models/asset-types";

export const ASSET_SHARED_GROUP = "__shared__";
export const ASSET_NOT_IN_DFD = "__not_in_dfd__";

export interface AssetGroupSection {
  key: string;
  /** Multiprocess label; empty for the top level, "Shared" and "Not in the DFD". */
  label: string;
  assets: Asset[];
}

/** Group key of one asset. */
export function assetGroupOf(groups: DfdTableGroups, asset: Asset): string {
  const keys = new Set<string>();
  for (const link of asset.linkedDFDElements ?? []) {
    const ref =
      link.elementType === "DataFlow"
        ? { connectionId: link.elementId }
        : { elementId: link.elementId };
    for (const key of groupsOfDfdItem(groups, ref)) keys.add(key);
  }
  if (keys.size === 0) return ASSET_NOT_IN_DFD;
  const multiprocesses = [...keys].filter((key) => key !== TOP_LEVEL_GROUP);
  if (multiprocesses.length > 1) return ASSET_SHARED_GROUP;
  return multiprocesses[0] ?? TOP_LEVEL_GROUP;
}

/**
 * Assets per group: top level, the multiprocesses (page-tree order),
 * "Shared", "Not in the DFD". Groups without assets are left out.
 */
export function assetGroupSections(groups: DfdTableGroups, assets: Asset[]): AssetGroupSection[] {
  const byKey = new Map<string, Asset[]>();
  for (const asset of assets) {
    const key = assetGroupOf(groups, asset);
    byKey.set(key, [...(byKey.get(key) ?? []), asset]);
  }
  return [
    ...groups.groups.map((g) => ({ key: g.key, label: g.key === TOP_LEVEL_GROUP ? "" : g.label })),
    { key: ASSET_SHARED_GROUP, label: "" },
    { key: ASSET_NOT_IN_DFD, label: "" },
  ]
    .map((section) => ({ ...section, assets: byKey.get(section.key) ?? [] }))
    .filter((section) => section.assets.length > 0);
}
