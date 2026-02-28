// ==================== FIXED DFD TO ASSET MAPPER ====================
// Problem: relationTypes wurden beim Mapping nicht übertragen!

import type { DFDAsset, DFDElement, DFDConnection } from "features/dfd";
import type {
  DFDAssetReference,
  DFDElementReference,
  DFDConnectionReference,
} from "features/assets";
import { isSystemUsesRelation, isInfraAccessesRelation } from "features/dfd";

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
    description: asset.description,
    assetGroup: asset.assetGroup,
    protectionNeed: asset.protectionNeed,

    linkedElements: asset.linkedElements?.map((link) => ({
      elementId: link.elementId,
      elementName: link.elementName,
      elementType: link.elementType,
      displayId: link.displayId,
      relationType: link.relationType,
      qualifier: link.qualifier,
      notes: link.notes,
    })),
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

    assetRelations: element.assetRelations?.map((relation) => ({
      assetId: relation.assetId,
      assetGroup: relation.assetGroup,
      relationType: relation.relationType,
      // Qualifier nur bei uses (System) und accesses (Infra)
      qualifier: isSystemUsesRelation(relation)
        ? relation.qualifier
        : isInfraAccessesRelation(relation)
          ? relation.qualifier
          : undefined,
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
    name: conn.name, // war: conn.label
    displayId: conn.displayId,

    assetRelations: conn.assetRelations?.map((relation) => ({
      assetId: relation.assetId,
      assetGroup: relation.assetGroup,
      relationType: relation.relationType,
      qualifier: isSystemUsesRelation(relation)
        ? relation.qualifier
        : isInfraAccessesRelation(relation)
          ? relation.qualifier
          : undefined,
      notes: relation.notes,
    })),
  }));
}
