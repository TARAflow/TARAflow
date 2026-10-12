// features/dfd/asset-graph/asset-graph-query.ts
//
// Questions the context bar asks about a prepared graph (FR-V10, UX-6):
// which relation types exist, which assets match a search, and — for a
// match that is not drawn — why not.

import { compareDisplayIds } from "shared";
import { layerRank } from "./asset-graph-layers";
import type { AssetGraph, AssetGraphOptions, AssetGraphSource, GraphAssetInput } from "./asset-graph-types";

export interface RelationTypeCount {
  readonly type: string;
  readonly kind: "a2a" | "anchor";
  readonly count: number;
}

/** All relation types in the source, asset links first, then by name. */
export function relationTypesIn(source: AssetGraphSource): RelationTypeCount[] {
  const counts = new Map<string, RelationTypeCount>();
  const add = (type: string, kind: "a2a" | "anchor") => {
    const key = `${kind}:${type}`;
    const c = counts.get(key);
    counts.set(key, { type, kind, count: (c?.count ?? 0) + 1 });
  };
  for (const r of source.relations) add(r.relationType, "a2a");
  for (const el of source.elements) {
    for (const r of el.assetRelations ?? []) add(r.relationType, "anchor");
  }
  return [...counts.values()].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "a2a" ? -1 : 1) || a.type.localeCompare(b.type),
  );
}

/** Assets whose displayId or name contains the query (case-insensitive). */
export function searchAssets(
  source: AssetGraphSource,
  query: string,
): GraphAssetInput[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return source.assets
    .filter(
      (a) =>
        (a.displayId ?? "").toLowerCase().includes(q) ||
        (a.name ?? "").toLowerCase().includes(q),
    )
    .sort(
      (a, b) =>
        layerRank(a.assetGroup) - layerRank(b.assetGroup) ||
        compareDisplayIds(a.displayId ?? a.id, b.displayId ?? b.id),
    );
}

export type AssetVisibility =
  | { readonly state: "visible" }
  | { readonly state: "hiddenLayer"; readonly layer: string }
  | { readonly state: "outsideFocus" }
  | { readonly state: "unknown" };

/** Why an asset is (not) drawn — the answer to "why don't I see X?" (UX-6). */
export function assetVisibility(
  graph: Pick<AssetGraph, "nodes">,
  source: AssetGraphSource,
  options: Pick<AssetGraphOptions, "layers">,
  assetId: string,
): AssetVisibility {
  if (graph.nodes.some((n) => n.kind === "asset" && n.id === assetId)) {
    return { state: "visible" };
  }
  const asset = source.assets.find((a) => a.id === assetId);
  if (!asset) return { state: "unknown" };
  if (!options.layers.includes(asset.assetGroup as never)) {
    return { state: "hiddenLayer", layer: String(asset.assetGroup) };
  }
  return { state: "outsideFocus" };
}
