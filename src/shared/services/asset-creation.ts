// shared/services/asset-creation.ts
//
// Single source of truth for *creating* an asset identity (group-prefixed id +
// minimal record). Both the DFD feature (useDFDData.createAsset) and the Hazard
// feature (Bowtie quick-capture) call this, so the id scheme and shape never
// diverge and no creation code is duplicated.
//
// This module is intentionally pure and dependency-free:
//   - no React, no feature imports
//   - generic over the asset-group string union, so it never needs to import a
//     concrete AssetGroup type; callers keep their own AssetGroup typing
//   - returns a minimal CreatedAsset that is structurally assignable to the
//     feature-side asset records (DFDAsset has these as its only required fields)
//
// The full DFDAsset type stays in features/dfd — only the creation primitive is
// shared. The feature widens the seed (e.g. DFD adds linkedElements: []).

export type AssetProtectionNeed = "low" | "medium" | "high" | "critical";

export interface CreatedAsset<G extends string = string> {
  id: string;
  displayId: string;
  name: string;
  assetGroup: G;
  protectionNeed?: AssetProtectionNeed;
}

/**
 * Group → id prefix. String-keyed (not Record<AssetGroup>) so this module stays
 * decoupled from any concrete AssetGroup definition. Mirrors the existing scheme
 * in use-dfd-data.ts and adds "environment" (EN) for hazard protection targets.
 * NOTE: "environment" only becomes a real asset group with Phase-1 change 2; the
 * prefix is already here so creation works the moment the enum gains it.
 */
export const ASSET_GROUP_PREFIX: Record<string, string> = {
  data: "DA",
  function: "FU",
  process: "PR",
  system: "SY",
  service: "SV",
  infrastructure: "IF",
  physical: "PH",
  human: "HU",
  environment: "EN",
};

/**
 * Next sequential id for a group (e.g. "HU-001"), counting only same-group ids so
 * mixed-group deletions leave no gaps. Throws on an unknown group rather than
 * silently minting an "undefined-001" id.
 */
export function generateAssetId(existingIds: readonly string[], group: string): string {
  const prefix = ASSET_GROUP_PREFIX[group];
  if (!prefix) {
    throw new Error(`generateAssetId: no id prefix registered for asset group "${group}"`);
  }
  const max = existingIds
    .filter((id) => id.startsWith(`${prefix}-`))
    .map((id) => parseInt(id.slice(prefix.length + 1), 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((acc, n) => Math.max(acc, n), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/**
 * Mints a new asset identity. `existingIds` is the list of ids already in use
 * (e.g. dfd.assets.map(a => a.id)) so the new id does not collide — pass any
 * ids created earlier in the same unsaved session too.
 */
export function createAsset<G extends string>(
  existingIds: readonly string[],
  name: string,
  group: G,
  protectionNeed?: AssetProtectionNeed,
): CreatedAsset<G> {
  const id = generateAssetId(existingIds, group);
  return {
    id,
    displayId: id,
    name,
    assetGroup: group,
    ...(protectionNeed ? { protectionNeed } : {}),
  };
}
