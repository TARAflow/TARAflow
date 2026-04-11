// ==================== ASSET RELATION VALIDATOR ====================
// Single Responsibility: Validate asset-element relationships
// This is a NEW validator for the asset-based threat analysis feature

import type { DFDElement, DFDConnection } from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import { getAllowedRelations } from "../../models/asset-constants";
import { ValidationMessages } from "./validator-utils";

/**
 * Validate asset-element relationships
 */
export function validateAssetRelations(
  assets: DFDAsset[],
  elements: DFDElement[],
  connections: DFDConnection[],
  errors: string[],
  warnings: string[],
): void {
  const assetMap = new Map<string, DFDAsset>();
  assets.forEach((a) => assetMap.set(a.id, a));

  validateElementAssetRelations(
    elements,
    connections,
    assetMap,
    errors,
    warnings,
  );
}

/**
 * Validate asset relations from Element perspective
 * Checks:
 * 1. Element has relation to non-existent asset → Error
 * 2. Relation type not allowed for element type → Error
 */
function validateElementAssetRelations(
  elements: DFDElement[],
  connections: DFDConnection[],
  assetMap: Map<string, DFDAsset>,
  errors: string[],
  warnings: string[]
): void {
  // Check elements
  elements.forEach((element) => {
    if (!element.assetRelations || element.assetRelations.length === 0) {
      return;
    }

    element.assetRelations.forEach((relation) => {
      // Check if referenced asset exists
      const asset = assetMap.get(relation.assetId);
      if (!asset) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_INCONSISTENT}:${element.name}→${relation.assetId}`,
        );
        return;
      }

      // Check if relation type is allowed for this element type
      const allowedTypes = getAllowedRelations(
        element.type,
        relation.assetGroup,
      );
      if (
        relation.relationType &&
        !allowedTypes.includes(relation.relationType)
      ) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_TYPE_INVALID}:${element.name}→${relation.assetId} (${relation.relationType})`,
        );
      }
    });
  });

  // Check connections (DataFlows)
  connections.forEach((connection) => {
    if (!connection.assetRelations || connection.assetRelations.length === 0) {
      return;
    }

    connection.assetRelations.forEach((relation) => {
      // Check if referenced asset exists
      const asset = assetMap.get(relation.assetId);
      if (!asset) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_INCONSISTENT}:${connection.name || connection.id}→${relation.assetId}`,
        );
        return;
      }

      // Check if relation type is valid for DataFlow
      if (relation.relationType && relation.relationType !== "transports") {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_TYPE_INVALID}:${connection.name || connection.id}→${relation.assetId} (${relation.relationType})`,
        );
      }
    });
  });
}