// ==================== ASSET LINK VALIDATOR ====================
// Asset-to-asset links (A2A) that are no longer valid — typically after a
// group change: the link is kept (never deleted silently), the analyst fixes
// or removes it in the asset panel. Same rules and wording basis as the
// asset-tab findings (features/assets/services/asset-validator.ts); the DFD
// tab shows them too because the links are edited there.
//
// Reads the dfd.assets mirror: commitAssetSync projects the canonical edge
// list (assets.relations) onto each source asset's `assetRelations`.

import {
  a2aRelationName,
  validateA2ARelations,
  type A2ARelation,
  type AssetGroup,
} from "shared";
import type { ValidationFinding } from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";

export const ASSET_LINK_MESSAGE_PREFIX = "dfdValidation.assetLink.";

interface MirrorEntry {
  id?: string;
  targetAssetId?: string;
  relationType?: string;
}

/** The canonical edges as projected onto the mirror. */
function edgesFromMirror(assets: readonly DFDAsset[]): A2ARelation[] {
  const edges: A2ARelation[] = [];
  for (const asset of assets) {
    const list = (asset as { assetRelations?: unknown }).assetRelations;
    if (!Array.isArray(list)) continue;
    list.forEach((raw: MirrorEntry, i: number) => {
      if (typeof raw?.targetAssetId !== "string" || typeof raw?.relationType !== "string") {
        return;
      }
      edges.push({
        id: raw.id ?? `${asset.id}#${i}`,
        sourceAssetId: asset.id,
        targetAssetId: raw.targetAssetId,
        relationType: raw.relationType,
      } as A2ARelation);
    });
  }
  return edges;
}

/** Called from dfd-validator.ts. */
export function validateAssetLinks(
  assets: readonly DFDAsset[],
  warnings: ValidationFinding[],
): void {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const groupOf = (id: string) => byId.get(id)?.assetGroup as AssetGroup | undefined;
  const edges = edgesFromMirror(assets);
  const byEdgeId = new Map(edges.map((e) => [e.id, e]));

  for (const f of validateA2ARelations(edges, groupOf)) {
    const edge = byEdgeId.get(f.relationId)!;
    const source = byId.get(edge.sourceAssetId)!;
    const target = byId.get(edge.targetAssetId);
    const displayId = source.displayId ?? source.name;
    warnings.push({
      key: `${ASSET_LINK_MESSAGE_PREFIX}${f.reason}`,
      displayId,
      elementId: source.id,
      params: {
        name: displayId,
        relation: `${a2aRelationName(edge.relationType, "out")} ${
          target?.displayId ?? edge.targetAssetId.slice(0, 8)
        }`,
        sourceGroup: source.assetGroup,
        targetGroup: target?.assetGroup ?? "–",
      },
    });
  }
}
