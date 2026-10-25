// features/dfd/asset-graph/mirror-edges.ts
//
// The DFD tab sees asset links only through the dfd.assets mirror:
// commitAssetSync projects the canonical edge list (assets.relations) onto
// each source asset's `assetRelations` (id, target, type, attributes, plus
// computed groups). This reads them back as canonical edges. Read-only — the
// mirror is never a write source (AR-5). The mirror holds DFD-sourced
// assets only; withRegistryAssets adds the manual ones from the registry.

import type { A2ARelation } from "shared";
import type {
  AssetGraphRegistry,
  AssetGraphSource,
  GraphAssetInput,
  GraphElementInput,
} from "./asset-graph-types";

type MirrorEntry = Record<string, unknown> & {
  id?: unknown;
  targetAssetId?: unknown;
  relationType?: unknown;
};

export function a2aEdgesFromMirror(
  assets: readonly { id: string; assetRelations?: unknown }[],
): A2ARelation[] {
  const edges: A2ARelation[] = [];
  for (const asset of assets) {
    const list = asset.assetRelations;
    if (!Array.isArray(list)) continue;
    list.forEach((raw: MirrorEntry, i: number) => {
      if (typeof raw?.targetAssetId !== "string" || typeof raw?.relationType !== "string") {
        return;
      }
      const {
        id,
        sourceGroup: _s,
        targetGroup: _t,
        targetAssetId,
        relationType,
        ...attributes
      } = raw;
      edges.push({
        ...attributes,
        id: typeof id === "string" ? id : `${asset.id}#${i}`,
        sourceAssetId: asset.id,
        targetAssetId,
        relationType,
      } as A2ARelation);
    });
  }
  return edges;
}

/** Graph source from the DFD tab's data: mirror assets, their links, anchors. */
export function assetGraphSourceFromDfd(dfd: {
  assets?: readonly (GraphAssetInput & { assetRelations?: unknown })[];
  elements?: readonly GraphElementInput[];
  connections?: readonly Omit<GraphElementInput, "type">[];
} | null | undefined): AssetGraphSource {
  const assets = dfd?.assets ?? [];
  return {
    assets,
    relations: a2aEdgesFromMirror(assets),
    elements: [
      ...(dfd?.elements ?? []),
      ...(dfd?.connections ?? []).map((c) => ({ ...c, type: "DataFlow" })),
    ],
  };
}

/**
 * The graph source completed with the assets of the canonical registry that
 * the mirror does not hold. dfd.assets holds only DFD-sourced assets; manual
 * ones — typically the protection targets of Hazard Items (persons,
 * environment, the building) — have no DFD element and would be missing,
 * and with them their links and the hazards' endangers edges (FR-V11a).
 * Their canonical links come along unless the mirror has them already.
 */
export function withRegistryAssets(
  source: AssetGraphSource,
  registry: AssetGraphRegistry | null | undefined,
): AssetGraphSource {
  if (!registry) return source;
  const inMirror = new Set(source.assets.map((a) => a.id));
  const extra = registry.assets.filter((a) => !inMirror.has(a.id));
  if (extra.length === 0) return source;
  const extraIds = new Set(extra.map((a) => a.id));
  const key = (r: A2ARelation) => `${r.sourceAssetId}|${r.relationType}|${r.targetAssetId}`;
  const known = new Set(source.relations.flatMap((r) => [r.id, key(r)]));
  const relations = registry.relations.filter(
    (r) =>
      (extraIds.has(r.sourceAssetId) || extraIds.has(r.targetAssetId)) &&
      !known.has(r.id) &&
      !known.has(key(r)),
  );
  return {
    ...source,
    assets: [...source.assets, ...extra],
    relations: [...source.relations, ...relations],
  };
}
