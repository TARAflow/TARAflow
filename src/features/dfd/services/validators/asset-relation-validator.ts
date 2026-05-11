// ==================== ASSET RELATION VALIDATOR ====================
import type { DFDElement, DFDConnection } from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import { getAllowedRelations } from "../../models/asset-constants";
import { ValidationMessages } from "./validator-utils";

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

function validateElementAssetRelations(
  elements: DFDElement[],
  connections: DFDConnection[],
  assetMap: Map<string, DFDAsset>,
  errors: string[],
  warnings: string[],
): void {
  // Check elements
  elements.forEach((element) => {
    if (!element.assetRelations || element.assetRelations.length === 0) return;

    const elementLabel = element.displayId
      ? `${element.displayId} — ${element.name}`
      : element.name;

    element.assetRelations.forEach((relation) => {
      const asset = assetMap.get(relation.assetId);

      if (!asset) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_INCONSISTENT}|${elementLabel}|${relation.assetId} (via "${relation.relationType}")`,
        );
        return;
      }

      const allowedTypes = getAllowedRelations(
        element.type,
        relation.assetGroup,
      );

      if (
        relation.relationType &&
        !allowedTypes.includes(relation.relationType)
      ) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_TYPE_INVALID}|${elementLabel}|${relation.relationType}|${asset.name}|${element.type}`,
        );
      }
    });
  });

  // Check connections (DataFlows)
  connections.forEach((connection) => {
    if (!connection.assetRelations || connection.assetRelations.length === 0)
      return;

    const connectionLabel = connection.displayId
      ? `${connection.displayId} — ${connection.name || connection.id}`
      : connection.name || connection.id;

    connection.assetRelations.forEach((relation) => {
      const asset = assetMap.get(relation.assetId);

      if (!asset) {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_INCONSISTENT}|${connectionLabel}|${relation.assetId} (via "${relation.relationType}")`,
        );
        return;
      }

      if (relation.relationType && relation.relationType !== "transports") {
        errors.push(
          `${ValidationMessages.ASSET_RELATION_TYPE_INVALID}|${connectionLabel}|${relation.relationType}|${asset.name}|DataFlow`,
        );
      }
    });
  });
}
