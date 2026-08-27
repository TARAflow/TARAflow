// ==================== ASSET TO DFD MAPPER ====================
// app/utils/asset-to-dfd-mapper.ts
//
// Inverse of app/utils/dfd-to-asset-mapper.ts (mapDFDAssetsToAssetFeature).
//
// Step 2 of the asset-store consolidation (single canonical store): the
// feature store (project.assets) becomes the ONE source of asset objects,
// and DFDData.assets is being removed. Inner DFD consumers (graph builder,
// stats, validator, dfd-service) still speak the DFDAsset shape, so this
// function reconstructs that shape on demand from the canonical feature
// assets + the diagram — a bridge that lets the storage collapse to one
// store without rewriting every DFDAsset consumer at once.
//
// linkedElements is DERIVED here from element/connection.assetRelations —
// the actual source of truth — exactly as mapDFDAssetsToAssetFeature and
// use-dfd-data.syncAssetLinkedElements do. It is never read back from a
// stored mirror (Asset.linkedDFDElements / DFDAsset.linkedElements), which
// is precisely the drift this consolidation removes.

import type {
  DFDAsset,
  DFDElement,
  DFDConnection,
  ElementRelation,
  AssetRelation,
  AssetProperties,
} from "features/dfd";
import { isSystemUsesRelation, isInfraAccessesRelation } from "features/dfd";
import type { Asset } from "features/assets";

function extractQualifier(
  relation: AssetRelation,
): ElementRelation["qualifier"] {
  if (isSystemUsesRelation(relation)) return relation.qualifier;
  if (isInfraAccessesRelation(relation)) return relation.qualifier;
  return undefined;
}

/**
 * Build assetId → ElementRelation[] from the diagram's assetRelations.
 * Mirrors use-dfd-data.syncAssetLinkedElements (elements first, then
 * connections as DataFlow links).
 */
function deriveLinkedElements(
  elements: DFDElement[],
  connections: DFDConnection[],
): Map<string, ElementRelation[]> {
  const linksByAssetId = new Map<string, ElementRelation[]>();

  const addLink = (assetId: string, link: ElementRelation): void => {
    const existing = linksByAssetId.get(assetId) ?? [];
    linksByAssetId.set(assetId, [...existing, link]);
  };

  for (const element of elements) {
    for (const relation of element.assetRelations ?? []) {
      addLink(relation.assetId, {
        elementId: element.id,
        elementName: element.name,
        elementType: element.type,
        displayId: element.displayId,
        relationType: relation.relationType,
        qualifier: extractQualifier(relation),
        notes: relation.notes,
      });
    }
  }

  for (const connection of connections) {
    for (const relation of connection.assetRelations ?? []) {
      addLink(relation.assetId, {
        elementId: connection.id,
        elementName: connection.name || "Unnamed DataFlow",
        elementType: "DataFlow",
        displayId: connection.displayId,
        relationType: relation.relationType,
        qualifier: extractQualifier(relation),
        notes: relation.notes,
      });
    }
  }

  return linksByAssetId;
}

/**
 * Reconstruct the DFDAsset[] shape from the canonical feature-store assets
 * plus the current diagram.
 *
 * Field mapping (feature Asset → DFDAsset):
 *   id            ← asset.id
 *   displayId     ← asset.id           (the feature id already IS the
 *                                        display id, e.g. "DA-001")
 *   name          ← asset.name
 *   assetGroup    ← asset.assetGroup
 *   description   ← asset.properties?.description
 *   protectionNeed← asset.properties?.protectionNeed
 *   properties    ← asset.properties   (carried through)
 *   linkedElements← DERIVED from element/connection.assetRelations
 *
 * `assetToAssetRelations` is intentionally omitted: it is declared on
 * DFDAsset but never written or read anywhere in the app (dead field).
 */
export function deriveDfdAssets(
  featureAssets: Asset[],
  elements: DFDElement[],
  connections: DFDConnection[],
): DFDAsset[] {
  const linksByAssetId = deriveLinkedElements(elements, connections);

  return featureAssets.map((asset) => {
    const dfdAsset: DFDAsset = {
      id: asset.id,
      displayId: asset.id,
      name: asset.name,
      assetGroup: asset.assetGroup,
      linkedElements: linksByAssetId.get(asset.id) ?? [],
    };

    const description = asset.properties?.description;
    if (description !== undefined) dfdAsset.description = description;

    const protectionNeed = asset.properties?.protectionNeed;
    if (protectionNeed !== undefined) dfdAsset.protectionNeed = protectionNeed;

    if (asset.properties !== undefined) {
      dfdAsset.properties = asset.properties as AssetProperties;
    }

    return dfdAsset;
  });
}
