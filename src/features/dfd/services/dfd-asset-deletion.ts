// features/dfd/services/dfd-asset-deletion.ts
//
// Removes an asset and every DFD reference to it: the asset record and the
// element/connection assetRelations. Pure and idempotent (an absent asset
// yields the same content). Does NOT restore derived invariants — callers run
// finalizeDfd() (useDFDData does this via updateDFD).
//
// Asset-to-asset relations are not touched here: they live in the canonical
// list assets.relations, are removed by purgeAssetFromProject (app layer) and
// the dfd.assets mirror is re-projected from that list on commit.

import type { DFDData } from "../models/dfd-types";

export function stripAssetFromDfd(dfd: DFDData, assetId: string): DFDData {
  return {
    ...dfd,
    assets: dfd.assets
      .filter((a) => a.id !== assetId),
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

/** How many element/connection relations point at the asset (confirm dialog). */
export function countDfdAssetReferences(
  dfd: DFDData | null | undefined,
  assetId: string,
): { elementRelations: number } {
  if (!dfd) return { elementRelations: 0 };
  const elementRelations = [...dfd.elements, ...dfd.connections].reduce(
    (n, x) =>
      n + (x.assetRelations?.filter((r) => r.assetId === assetId).length ?? 0),
    0,
  );
  return { elementRelations };
}
