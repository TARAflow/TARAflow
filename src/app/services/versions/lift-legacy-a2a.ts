// ==================== LIFT LEGACY A2A RELATIONS ====================
// Migration helper (schema v8). Up to v7, asset-to-asset relations lived on the
// runtime mirror dfd.assets[] — as `assetRelations` (written by the A2A
// selector) or the never-written `assetToAssetRelations`. This lifts every
// entry that names a target asset into the canonical edge list
// assets.relations[] (A2ARelation).
//
// Rules:
//   - an entry counts as A2A when it has a string `targetAssetId`; element
//     relations never carry one
//   - group copies (sourceGroup/targetGroup) are dropped (AR-2)
//   - exact duplicates (same source, target, type) are merged, existing
//     canonical edges win
//   - relations are NOT validated against the rule set here; a broken edge is
//     kept and reported later (validateA2ARelations), never silently dropped
//   - the result is sorted (sortA2ARelations), an empty list is not written

import { sortA2ARelations } from "shared/services/a2a-relation-service";
import type { A2ARelation } from "shared/models/a2a-relation-types";

const ATTRIBUTE_KEYS = [
  "stepOrder",
  "analyticallyActive",
  "rationale",
  "notes",
  "safety",
  "degradationMode",
  "degradationDescription",
] as const;

function legacyEntries(asset: any): any[] {
  const a = Array.isArray(asset?.assetRelations) ? asset.assetRelations : [];
  const b = Array.isArray(asset?.assetToAssetRelations)
    ? asset.assetToAssetRelations
    : [];
  return [...a, ...b].filter(
    (r) => r && typeof r.targetAssetId === "string" && typeof r.relationType === "string",
  );
}

/**
 * Returns `data` with legacy A2A relations from dfd.assets[] merged into
 * assets.relations[]. Does not touch dfd.assets itself. `newId` is injected
 * for testability.
 */
export function liftLegacyA2ARelations(
  data: any,
  newId: () => string = () => crypto.randomUUID(),
): any {
  const dfdAssets: any[] = Array.isArray(data?.dfd?.assets) ? data.dfd.assets : [];
  const existing: A2ARelation[] = Array.isArray(data?.assets?.relations)
    ? data.assets.relations
    : [];

  const key = (s: string, t: string, type: string) => `${s}\u0000${t}\u0000${type}`;
  const seen = new Set(
    existing.map((r) => key(r.sourceAssetId, r.targetAssetId, r.relationType)),
  );
  const lifted: A2ARelation[] = [];

  for (const asset of dfdAssets) {
    if (typeof asset?.id !== "string") continue;
    for (const entry of legacyEntries(asset)) {
      const k = key(asset.id, entry.targetAssetId, entry.relationType);
      if (seen.has(k)) continue;
      seen.add(k);
      const relation: Record<string, unknown> = {
        id: newId(),
        sourceAssetId: asset.id,
        targetAssetId: entry.targetAssetId,
        relationType: entry.relationType,
      };
      for (const attr of ATTRIBUTE_KEYS) {
        if (entry[attr] !== undefined) relation[attr] = entry[attr];
      }
      lifted.push(relation as unknown as A2ARelation);
    }
  }

  if (lifted.length === 0 || !data?.assets) return data;
  return {
    ...data,
    assets: {
      ...data.assets,
      relations: sortA2ARelations([...existing, ...lifted]),
    },
  };
}
