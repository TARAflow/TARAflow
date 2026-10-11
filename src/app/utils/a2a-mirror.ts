// app/utils/a2a-mirror.ts
//
// Bridge between the canonical A2A edge list (assets.relations[], schema v8)
// and the runtime dfd.assets mirror the DFD asset panel edits.
//
//   load   projectA2AOntoMirror   canonical → mirror (DFDAsset.assetRelations)
//   write  liftA2AFromMirror      mirror → canonical, per source asset
//
// The canonical list is the truth; the mirror is a view of it. The lift only
// touches sources that are on the mirror AND carry an `assetRelations` array:
// a mirror record that lost the field on some copy path (the B1 failure
// class) leaves the canonical edges untouched instead of deleting them.
//
// Both run inside commitAssetSync, i.e. on every load and every write.

import type { A2ARelation, AssetGroup } from "shared";
import { sortA2ARelations } from "shared";
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
    if (current && JSON.stringify(current) === JSON.stringify(entries)) {
      return asset;
    }
    changed = true;
    return { ...asset, assetRelations: entries } as DFDAsset;
  });
  return changed ? result : dfdAssets;
}

// ==================== WRITE: mirror → canonical ====================

function normalized(r: A2ARelation): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: r.id,
    sourceAssetId: r.sourceAssetId,
    targetAssetId: r.targetAssetId,
    relationType: r.relationType,
  };
  copyAttributes(r, out);
  return out;
}

function sameEdges(a: readonly A2ARelation[], b: readonly A2ARelation[]): boolean {
  const s = (list: readonly A2ARelation[]) =>
    JSON.stringify(sortA2ARelations(list).map(normalized));
  return s(a) === s(b);
}

/**
 * Takes the mirror's outgoing lists as the new state of those sources and
 * merges them into the canonical list. Ids are kept: by entry id first, then
 * by (source, target, type). Returns null when the canonical list would not
 * change.
 */
export function liftA2AFromMirror(
  relations: readonly A2ARelation[],
  dfdAssets: readonly DFDAsset[],
  newId: () => string,
): A2ARelation[] | null {
  const sources = new Map<string, AssetToAssetRelation[]>();
  for (const asset of dfdAssets) {
    const list = legacyList(asset);
    if (list) sources.set(asset.id, list);
  }
  if (sources.size === 0) return null;

  const byId = new Map(relations.map((r) => [r.id, r]));
  const key = (s: string, t: string, type: string) => `${s}\u0000${t}\u0000${type}`;
  const byKey = new Map(
    relations.map((r) => [key(r.sourceAssetId, r.targetAssetId, r.relationType), r]),
  );

  const kept = relations.filter((r) => !sources.has(r.sourceAssetId));
  const lifted: A2ARelation[] = [];
  for (const [sourceAssetId, list] of sources) {
    const seen = new Set<string>();
    for (const entry of list) {
      if (typeof entry?.targetAssetId !== "string") continue;
      const k = key(sourceAssetId, entry.targetAssetId, entry.relationType);
      if (seen.has(k)) continue; // exact duplicate on the mirror
      seen.add(k);
      const existing =
        (entry.id && byId.get(entry.id)?.sourceAssetId === sourceAssetId
          ? byId.get(entry.id)
          : undefined) ?? byKey.get(k);
      const relation: Record<string, unknown> = {
        id: existing?.id ?? newId(),
        sourceAssetId,
        targetAssetId: entry.targetAssetId,
        relationType: entry.relationType,
      };
      copyAttributes(entry, relation);
      lifted.push(relation as unknown as A2ARelation);
    }
  }

  const next = sortA2ARelations([...kept, ...lifted]);
  return sameEdges(relations, next) ? null : next;
}
