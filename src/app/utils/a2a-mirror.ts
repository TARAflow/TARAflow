// app/utils/a2a-mirror.ts
//
// Projection of the canonical A2A edge list (assets.relations[], schema v8)
// onto the runtime dfd.assets mirror (DFDAsset.assetRelations), so the DFD
// asset panel can list each asset's outgoing edges with ids and groups.
//
// One direction only: canonical → mirror. Edits never flow back from the
// mirror; they are operations applied by the relations service (AR-5).
// Runs inside commitAssetSync on every load and write.

import type { A2ARelation, AssetGroup } from "shared";
import type { DFDAsset } from "features/dfd/models/dfd-asset-types";
import type { AssetToAssetRelation } from "features/dfd/models/asset-relation-types";

type GroupLookup = (assetId: string) => AssetGroup | undefined;

const ATTRIBUTES = [
  "stepOrder",
  "analyticallyActive",
  "rationale",
  "notes",
  "safety",
  "degradationMode",
  "degradationDescription",
] as const;

function copyAttributes(from: any, to: Record<string, unknown>): void {
  for (const key of ATTRIBUTES) {
    if (from[key] !== undefined) to[key] = from[key];
  }
}

function legacyList(asset: DFDAsset): AssetToAssetRelation[] | undefined {
  const list = (asset as any).assetRelations;
  return Array.isArray(list) ? list : undefined;
}

// ==================== LOAD: canonical → mirror ====================

function toMirrorEntry(
  relation: A2ARelation,
  sourceGroup: AssetGroup,
  groupOf: GroupLookup,
): AssetToAssetRelation {
  const entry: Record<string, unknown> = {
    id: relation.id,
    sourceGroup,
    targetGroup: groupOf(relation.targetAssetId) ?? sourceGroup,
    targetAssetId: relation.targetAssetId,
    relationType: relation.relationType,
  };
  copyAttributes(relation, entry);
  return entry as unknown as AssetToAssetRelation;
}

/**
 * Writes each mirror asset's outgoing canonical edges onto its
 * `assetRelations`. Group fields are computed, never stored (AR-2). Returns
 * the input array unchanged when nothing differs.
 */
export function projectA2AOntoMirror(
  dfdAssets: DFDAsset[],
  relations: readonly A2ARelation[],
  groupOf: GroupLookup,
): DFDAsset[] {
  let changed = false;
  const result = dfdAssets.map((asset) => {
    const entries = relations
      .filter((r) => r.sourceAssetId === asset.id)
      .map((r) => toMirrorEntry(r, asset.assetGroup, groupOf));
    const current = legacyList(asset);
    if ((current ?? []).length === 0 && entries.length === 0) return asset;
    if (current && JSON.stringify(current) === JSON.stringify(entries)) {
      return asset;
    }
    changed = true;
    return { ...asset, assetRelations: entries } as DFDAsset;
  });
  return changed ? result : dfdAssets;
}
