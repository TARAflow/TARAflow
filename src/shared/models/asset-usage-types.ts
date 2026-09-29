// shared/models/asset-usage-types.ts
//
// What deleting an asset would touch, computed by the app layer and shown by
// the confirm dialog in BOTH the DFD tab and the Asset tab (features cannot
// import each other, so the contract lives here).

export interface AssetUsageBlocker {
  id: string;
  name: string;
}

export interface AssetUsage {
  /** element/connection assetRelations in the DFD. */
  dfdRelations: number;
  /** asset-to-asset relations pointing AT this asset from other assets. */
  assetToAssetRelations: number;
  /** contributes_to / endangers edges in the hazard analysis. */
  hazardRelations: number;
  /**
   * Attack trees anchored on this asset. Deletion is BLOCKED while any exist:
   * a tree is analyst work, it must be re-anchored or deleted deliberately.
   */
  blockingAttackTrees: AssetUsageBlocker[];
}

export type AssetUsageLookup = (assetId: string) => AssetUsage;
