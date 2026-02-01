// ==================== FIXED DFD REFERENCE TYPES ====================
// features/assets/models/dfd-reference-types.ts
// 
// FIX: Add relationTypes to linkedElements!

/**
 * Read-only reference to a DFD Asset
 * Used for sync and display in Assets Tab
 */
export interface DFDAssetReference {
  readonly id: string;
  readonly displayId: string;
  readonly name?: string;
  
  /**
   * Elements this asset overlaps/protects in the DFD
   * Populated by DFD geometric analysis
   * 
   * ✅ FIX: Now includes relationTypes!
   */
  readonly linkedElements?: ReadonlyArray<{
    readonly elementId: string;
    readonly elementName: string;
    readonly elementType: string;
    readonly displayId: string;
    readonly relationTypes?: ReadonlyArray<string>;  // ✅ ADDED!
    readonly notes?: string;
  }>;
  
  // Geometric info (optional, for advanced features)
  readonly positions?: ReadonlyArray<{ x: number; y: number }>;
  readonly sizes?: ReadonlyArray<{ width: number; height: number }>;
  readonly xmlIds?: ReadonlyArray<string>;
}

/**
 * Read-only reference to a DFD Element
 * Used for sync and display
 */
export interface DFDElementReference {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly displayId: string;
  
  /**
   * Assets this element is related to
   * Defined by user in Element forms (Process, DataStore, etc.)
   */
  readonly assetRelations?: ReadonlyArray<{
    readonly assetId: string;
    readonly relationTypes: ReadonlyArray<string>;
    readonly notes?: string;
  }>;
}

/**
 * Read-only reference to a DFD Connection (DataFlow)
 * Used for sync and display
 */
export interface DFDConnectionReference {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly displayId: string;
  
  /**
   * Assets this dataflow transports
   */
  readonly assetRelations?: ReadonlyArray<{
    readonly assetId: string;
    readonly relationTypes: ReadonlyArray<string>;
    readonly notes?: string;
  }>;
}

/**
 * Helper type: Simple element link for display in Asset Table
 * Maps from DFDAssetReference.linkedElements
 * 
 * ✅ FIX: Now includes relationTypes!
 */
export interface DFDElementLink {
  elementId: string;
  elementName: string;
  elementType: string;
  displayId: string;
  relationTypes?: string[];  // ✅ ADDED!
  notes?: string;
}

/**
 * Check if an asset has a DFD marker
 */
export function hasAssetMarkerInDFD(
  assetId: string,
  dfdAssets?: ReadonlyArray<DFDAssetReference>
): boolean {
  return dfdAssets?.some(a => a.id === assetId) ?? false;
}

/**
 * Get DFD elements linked to an asset
 * 
 * ✅ FIX: Now preserves relationTypes!
 */
export function getLinkedElementsForAsset(
  assetId: string,
  dfdAssets?: ReadonlyArray<DFDAssetReference>
): DFDElementLink[] {
  const dfdAsset = dfdAssets?.find(a => a.id === assetId);
  if (!dfdAsset?.linkedElements) return [];
  
  return Array.from(dfdAsset.linkedElements).map(link => ({
    elementId: link.elementId,
    elementName: link.elementName,
    elementType: link.elementType,
    displayId: link.displayId,
    relationTypes: link.relationTypes ? Array.from(link.relationTypes) : undefined,  // ✅ PRESERVE!
    notes: link.notes,
  }));
}