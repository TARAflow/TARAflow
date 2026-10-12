// features/assets/utils/asset-links.ts
//
// "Asset Links": the asset-to-asset relations of one asset, outgoing and
// incoming, resolved to the other asset for display (asset table column and
// asset dialog). Read-only — A2A relations are edited in the DFD asset panel
// and later in the graph view, never here (AR-5).

import { a2aRelationName, type AssetGroup, type A2ARelationType } from "shared";
import type { AssetToAssetRelationReference } from "../models/dfd-asset-link-types";

export type AssetLinkDirection = "out" | "in";

export interface AssetLink {
  readonly direction: AssetLinkDirection;
  readonly relationType: A2ARelationType;
  /** The asset at the other end. */
  readonly otherId: string;
  readonly otherDisplayId: string;
  readonly otherName: string;
  readonly otherGroup?: AssetGroup;
  /** The asset this link is listed at. */
  readonly selfDisplayId: string;
  readonly selfName: string;
}

interface AssetLike {
  readonly id: string;
  readonly displayId?: string;
  readonly name: string;
  readonly assetGroup: string;
}

/**
 * Links of every asset, keyed by asset id. Outgoing first, then incoming;
 * within each, by the other asset's display id, then relation type. Edges to
 * an unknown asset are skipped (they are reported by the relation validator).
 */
export function buildAssetLinks(
  assets: readonly AssetLike[],
  relations: readonly AssetToAssetRelationReference[],
): Map<string, AssetLink[]> {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const result = new Map<string, AssetLink[]>(assets.map((a) => [a.id, []]));

  const shortId = (a: AssetLike) => a.displayId ?? a.id.slice(0, 8);
  const link = (
    direction: AssetLinkDirection,
    self: AssetLike,
    other: AssetLike,
    relationType: A2ARelationType,
  ): AssetLink => ({
    direction,
    relationType,
    otherId: other.id,
    otherDisplayId: shortId(other),
    otherName: other.name,
    otherGroup: other.assetGroup as AssetGroup,
    selfDisplayId: shortId(self),
    selfName: self.name,
  });

  for (const r of relations) {
    const source = byId.get(r.sourceAssetId);
    const target = byId.get(r.targetAssetId);
    if (!source || !target) continue;
    result.get(source.id)!.push(link("out", source, target, r.relationType));
    result.get(target.id)!.push(link("in", target, source, r.relationType));
  }

  for (const list of result.values()) {
    list.sort(
      (a, b) =>
        (a.direction === b.direction ? 0 : a.direction === "out" ? -1 : 1) ||
        a.otherDisplayId.localeCompare(b.otherDisplayId, undefined, {
          numeric: true,
        }) ||
        a.relationType.localeCompare(b.relationType),
    );
  }
  return result;
}

/**
 * Chip text, read from the listed asset: the stored type at the source
 * ("required_by FU-001"), the inverse name at the target ("requires DA-002").
 */
export function assetLinkLabel(l: AssetLink): string {
  return `${a2aRelationName(l.relationType, l.direction)} ${l.otherDisplayId}`;
}

/** The stored edge as source and target labels, for the tooltip sentence. */
export function assetLinkEnds(l: AssetLink): { source: string; target: string } {
  const self = `${l.selfDisplayId} ${l.selfName}`;
  const other = `${l.otherDisplayId} ${l.otherName}`;
  return l.direction === "out"
    ? { source: self, target: other }
    : { source: other, target: self };
}
