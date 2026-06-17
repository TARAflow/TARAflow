// ==================== ASSET GRAPH UTILS ====================
// features/assets/utils/asset-graph-utils.ts
//
// Pure graph traversal functions on Asset-to-Asset relations.
// No state, no side effects — safe to call in useMemo.

import type { AssetToAssetRelationReference } from "../models/dfd-asset-link-types";

/**
 * BFS traversal: counts all downstream assets reachable from assetId.
 * Traverses outgoing Asset-to-Asset edges.
 * DAG assumed — no cycle detection needed.
 */
export function getDownstreamCount(
  assetId: string,
  a2aRelations: AssetToAssetRelationReference[],
): number {
  return getDownstreamAssetIds(assetId, a2aRelations).length;
}

/**
 * BFS traversal: returns all downstream asset IDs reachable from assetId.
 * Used for the clickable Downstream dialog in asset-table.
 */
export function getDownstreamAssetIds(
  assetId: string,
  a2aRelations: AssetToAssetRelationReference[],
): string[] {
  const visited = new Set<string>();
  const queue: string[] = [assetId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const outgoing = a2aRelations.filter(
      (r) => r.sourceAssetId === current,
    );
    for (const rel of outgoing) {
      if (!visited.has(rel.targetAssetId)) {
        visited.add(rel.targetAssetId);
        queue.push(rel.targetAssetId);
      }
    }
  }

  // assetId selbst nicht mitzählen
  visited.delete(assetId);
  return Array.from(visited);
}
