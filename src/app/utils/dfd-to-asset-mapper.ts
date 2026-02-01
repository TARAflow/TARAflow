// ==================== FIXED DFD TO ASSET MAPPER ====================
// Problem: relationTypes wurden beim Mapping nicht übertragen!

import type { DFDAsset, DFDElement, DFDConnection } from "features/dfd";
import type {
  DFDAssetReference,
  DFDElementReference,
  DFDConnectionReference,
} from "features/assets";

/**
 * Map DFD Assets to Asset Feature references
 *
 * FIX: linkedElements must include relationTypes!
 */
export function mapDFDAssetsToAssetFeature(
  dfdAssets: DFDAsset[],
): DFDAssetReference[] {
  return dfdAssets.map((asset) => ({
    id: asset.id,
    displayId: asset.displayId,
    name: asset.name,

    // ✅ FIX: Include relationTypes in linkedElements!
    linkedElements: asset.linkedElements?.map((link) => ({
      elementId: link.elementId,
      elementName: link.elementName,
      elementType: link.elementType,
      displayId: link.displayId,
      // ✅ CRITICAL: Add relationTypes!
      relationTypes: link.relationTypes || [],
    })),

    // Geometric info (optional)
    positions: asset.positions,
    sizes: asset.sizes,
    xmlIds: asset.xmlIds,
  }));
}

/**
 * Map DFD Elements to Asset Feature references
 */
export function mapDFDElementsToAssetFeature(
  dfdElements: DFDElement[],
): DFDElementReference[] {
  return dfdElements.map((element) => ({
    id: element.id,
    type: element.type,
    name: element.name,
    displayId: element.displayId,

    // ✅ assetRelations with relationTypes
    assetRelations: element.assetRelations?.map((relation) => ({
      assetId: relation.assetId,
      relationTypes: Array.from(relation.relationTypes || []),
      notes: relation.notes,
    })),
  }));
}

/**
 * Map DFD Connections to Asset Feature references
 */
export function mapDFDConnectionsToAssetFeature(
  dfdConnections: DFDConnection[],
): DFDConnectionReference[] {
  return dfdConnections.map((conn) => ({
    id: conn.id,
    from: conn.from,
    to: conn.to,
    label: conn.label,
    displayId: conn.displayId,

    // ✅ assetRelations with relationTypes
    assetRelations: conn.assetRelations?.map((relation) => ({
      assetId: relation.assetId,
      relationTypes: Array.from(relation.relationTypes || []),
      notes: relation.notes,
    })),
  }));
}
