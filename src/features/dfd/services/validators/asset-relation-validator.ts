// ==================== ASSET RELATION VALIDATOR ====================
// Single Responsibility: Validate asset-element relationships
// This is a NEW validator for the asset-based threat analysis feature

import type {
  DFDAsset,
  DFDElement,
  DFDConnection,
} from "../../models/dfd-types";
import type { AnyAssetRelationType } from "../../models/asset-relation-types";
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
  warnings: string[]
): void {
  // Create lookup maps
  const elementMap = new Map<string, DFDElement | DFDConnection>();
  elements.forEach((e) => elementMap.set(e.id, e));
  connections.forEach((c) => elementMap.set(c.id, c));

  const assetMap = new Map<string, DFDAsset>();
  assets.forEach((a) => assetMap.set(a.id, a));

  // Validate from Element perspective
  validateElementAssetRelations(elements, connections, assetMap, errors, warnings);

  // Validate from Asset perspective
  validateAssetElementRelations(assets, elementMap, errors, warnings);

  // Validate bidirectional consistency
  validateBidirectionalConsistency(assets, elements, connections, warnings);
}

/**
 * Validate asset relations from Element perspective
 * Checks:
 * 1. Element has relation to non-existent asset → Error
 * 2. Relation type not allowed for element type → Error
 * 3. Element has marker but no relation → Warning (checked separately)
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
      // Check if asset exists
      const asset = assetMap.get(relation.assetId);
      if (!asset) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_NO_MARKER}:${element.name}→${relation.assetId}`,
        );
        return;
      }

      // Check if element has marker for this asset
      const hasMarker = asset.linkedElements?.some(
        (link) => link.elementId === element.id,
      );
      if (!hasMarker) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_NO_MARKER}:${element.name}→${relation.assetId}`,
        );
      }

      // Check if relation types are allowed for this element type
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
      // Check if asset exists
      const asset = assetMap.get(relation.assetId);
      if (!asset) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_NO_MARKER}:${connection.name || connection.id}→${relation.assetId}`,
        );
        return;
      }

      // Check if relation types are valid for DataFlow
      if (relation.relationType && relation.relationType !== "transports") {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_TYPE_INVALID}:${connection.name || connection.id}→${relation.assetId} (${relation.relationType})`,
        );
      }
    });
  });
}

/**
 * Validate asset relations from Asset perspective
 * Checks:
 * 1. Asset linked to non-existent element → Error
 * 2. Asset marker on element that doesn't allow relations (e.g., TrustBoundary) → Warning
 * 3. Asset has marker but no relation types defined → Warning
 */
function validateAssetElementRelations(
  assets: DFDAsset[],
  elementMap: Map<string, DFDElement | DFDConnection>,
  errors: string[],
  warnings: string[]
): void {
  assets.forEach((asset) => {
    if (!asset.linkedElements || asset.linkedElements.length === 0) {
      return;
    }

    asset.linkedElements.forEach((link) => {
      // Check if element exists
      const element = elementMap.get(link.elementId);
      if (!element) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_INCONSISTENT}:${asset.id}→${link.elementId}`
        );
        return;
      }

      // Get allowed relation types for this element
      const elementType = 'type' in element ? element.type : 'DataFlow';
      const assetRelation = (
        "assetRelations" in element ? element.assetRelations : undefined
      )?.find((r) => r.assetId === asset.id);
      const allowedTypes = assetRelation
        ? getAllowedRelations(elementType, assetRelation.assetGroup)
        : [];

      // Check if element type allows asset relations
      if (allowedTypes.length === 0) {
        warnings.push(
          `${ValidationMessages.ASSET_MARKER_ON_INVALID_ELEMENT}:${asset.id}→${link.elementName || link.elementId}`
        );
      }

      // Check if relation has defined types
      if (!link.relationType) {
        warnings.push(
          `${ValidationMessages.ASSET_MARKER_NO_RELATION}:${asset.id}→${link.elementName || link.elementId}`,
        );
      }
    });
  });
}

/**
 * Validate bidirectional consistency between Element.assetRelations and Asset.linkedElements
 * Ensures that if Element E has relation to Asset A, then Asset A has relation to Element E
 */
function validateBidirectionalConsistency(
  assets: DFDAsset[],
  elements: DFDElement[],
  connections: DFDConnection[],
  warnings: string[]
): void {
  const assetMap = new Map<string, DFDAsset>();
  assets.forEach((a) => assetMap.set(a.id, a));

  // Check Element → Asset consistency
  [...elements, ...connections].forEach((element) => {
    const assetRelations = 'assetRelations' in element ? element.assetRelations : undefined;
    if (!assetRelations) return;

    assetRelations.forEach((relation) => {
      const asset = assetMap.get(relation.assetId);
      if (!asset) return; // Already caught by validateElementAssetRelations

      const hasBacklink = asset.linkedElements?.some(
        (link) => link.elementId === element.id
      );

      if (!hasBacklink) {
        const elementName = element.name || element.id;
        warnings.push(
          `${ValidationMessages.ASSET_RELATION_INCONSISTENT}:${elementName}→${relation.assetId} (missing backlink)`
        );
      }
    });
  });

  // Check Asset → Element consistency
  assets.forEach((asset) => {
    if (!asset.linkedElements) return;

    asset.linkedElements.forEach((link) => {
      const element = elements.find((e) => e.id === link.elementId) ||
                      connections.find((c) => c.id === link.elementId);
      if (!element) return; // Already caught by validateAssetElementRelations

      const assetRelations = 'assetRelations' in element ? element.assetRelations : undefined;
      const hasBacklink = assetRelations?.some(
        (rel) => rel.assetId === asset.id
      );

      if (!hasBacklink) {
        warnings.push(
          `${ValidationMessages.ASSET_RELATION_INCONSISTENT}:${asset.id}→${link.elementName} (missing backlink)`
        );
      }
    });
  });
}