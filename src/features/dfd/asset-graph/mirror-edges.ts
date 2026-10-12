// features/dfd/asset-graph/mirror-edges.ts
//
// The DFD tab sees asset links only through the dfd.assets mirror:
// commitAssetSync projects the canonical edge list (assets.relations) onto
// each source asset's `assetRelations` (id, target, type, attributes, plus
// computed groups). This reads them back as canonical edges. Read-only — the
// mirror is never a write source (AR-5).

import type { A2ARelation } from "shared";
import type { GraphAssetInput, GraphElementInput, AssetGraphSource } from "./asset-graph-types";

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
