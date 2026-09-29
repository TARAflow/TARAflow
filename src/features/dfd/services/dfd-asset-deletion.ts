// features/dfd/services/dfd-asset-deletion.ts
//
// Removes an asset and EVERY reference to it from the DFD: the asset record,
// element/connection assetRelations and asset-to-asset relations held by other
// assets. Pure and idempotent (an absent asset yields the same content). Does
// NOT restore derived invariants — callers run finalizeDfd() (useDFDData does
// this via updateDFD).

import type { DFDData } from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";
import type { AssetToAssetRelation } from "../models/asset-relation-types";

// A2A relations live on the source asset. The typed field is
// assetToAssetRelations; the asset description form writes `assetRelations`.
// Both are stripped so no dangling target survives either spelling.
type AssetWithA2A = DFDAsset & { assetRelations?: AssetToAssetRelation[] };

function stripA2A(asset: DFDAsset, assetId: string): DFDAsset {
  const a = asset as AssetWithA2A;
  const typed = a.assetToAssetRelations;
  const legacy = a.assetRelations;
  const typedHit = typed?.some((r) => r.targetAssetId === assetId) ?? false;
  const legacyHit = legacy?.some((r) => r.targetAssetId === assetId) ?? false;
  if (!typedHit && !legacyHit) return asset;
  return {
    ...a,
    ...(typedHit
      ? {
          assetToAssetRelations: typed!.filter(
            (r) => r.targetAssetId !== assetId,
          ),
        }
      : {}),
    ...(legacyHit
      ? { assetRelations: legacy!.filter((r) => r.targetAssetId !== assetId) }
      : {}),
  } as DFDAsset;
}

export function stripAssetFromDfd(dfd: DFDData, assetId: string): DFDData {
  return {
    ...dfd,
    assets: dfd.assets
      .filter((a) => a.id !== assetId)
      .map((a) => stripA2A(a, assetId)),
    elements: dfd.elements.map((el) =>
      el.assetRelations?.some((r) => r.assetId === assetId)
        ? {
            ...el,
            assetRelations: el.assetRelations.filter(
              (r) => r.assetId !== assetId,
            ),
          }
        : el,
    ),
    connections: dfd.connections.map((conn) =>
      conn.assetRelations?.some((r) => r.assetId === assetId)
        ? {
            ...conn,
            assetRelations: conn.assetRelations.filter(
              (r) => r.assetId !== assetId,
            ),
          }
        : conn,
    ),
  };
}

/** How many DFD-side references point at the asset (for the confirm dialog). */
export function countDfdAssetReferences(
  dfd: DFDData | null | undefined,
  assetId: string,
): { elementRelations: number; assetToAssetRelations: number } {
  if (!dfd) return { elementRelations: 0, assetToAssetRelations: 0 };
  const elementRelations = [...dfd.elements, ...dfd.connections].reduce(
    (n, x) =>
      n + (x.assetRelations?.filter((r) => r.assetId === assetId).length ?? 0),
    0,
  );
  const assetToAssetRelations = dfd.assets.reduce((n, a) => {
    const x = a as AssetWithA2A;
    return (
      n +
      (x.assetToAssetRelations?.filter((r) => r.targetAssetId === assetId)
        .length ?? 0) +
      (x.assetRelations?.filter((r) => r.targetAssetId === assetId).length ??
        0)
    );
  }, 0);
  return { elementRelations, assetToAssetRelations };
}
