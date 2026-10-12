// ==================== ASSET RELATION VALIDATOR ====================
import type {
  DFDElement,
  DFDConnection,
  ValidationFinding,
} from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import { getAllowedRelations } from "../../models/asset-constants";
import { ValidationMessages } from "./validator-utils";

// Existence, name and group of an asset are all this check needs. The
// allowed-type check uses the ASSET's group (B15) — the copy on the relation
// can be wrong in older files (service "uses" stored as system) and is only a
// fallback. Accepting the minimal shape lets callers validate against the
// CANONICAL feature store (the truth) rather than the possibly-lagging
// dfd.assets mirror.
type KnownAsset = Pick<DFDAsset, "id" | "name"> & { readonly assetGroup?: DFDAsset["assetGroup"] };

export function validateAssetRelations(
  assets: readonly KnownAsset[],
  elements: DFDElement[],
  connections: DFDConnection[],
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  const assetMap = new Map<string, KnownAsset>();
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
  assetMap: Map<string, KnownAsset>,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
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
        errors.push({
          key: ValidationMessages.ASSET_RELATION_INCONSISTENT,
          displayId: element.displayId,
          elementId: element.id,
          params: {
            detail: `${elementLabel} — ${relation.assetId} (via "${relation.relationType}")`,
          },
        });
        return;
      }

      const allowedTypes = getAllowedRelations(
        element.type,
        asset.assetGroup ?? relation.assetGroup,
      );

      if (
        relation.relationType &&
        !allowedTypes.includes(relation.relationType)
      ) {
        errors.push({
          key: ValidationMessages.ASSET_RELATION_TYPE_INVALID,
          displayId: element.displayId,
          elementId: element.id,
          params: {
            relationType: relation.relationType,
            assetName: asset.name,
            elementType: element.type,
          },
        });
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
        errors.push({
          key: ValidationMessages.ASSET_RELATION_INCONSISTENT,
          displayId: connection.displayId,
          elementId: connection.id,
          params: {
            detail: `${connectionLabel} — ${relation.assetId} (via "${relation.relationType}")`,
          },
        });
        return;
      }

      // Same rules as for elements and as the dialogs offer (B15): a flow
      // is a DataFlow. (Before, everything but "transports" was rejected —
      // also types the rules allow, e.g. DataFlow → Function "invokes".)
      if (
        relation.relationType &&
        !getAllowedRelations("DataFlow", asset.assetGroup ?? relation.assetGroup).includes(
          relation.relationType,
        )
      ) {
        errors.push({
          key: ValidationMessages.ASSET_RELATION_TYPE_INVALID,
          displayId: connection.displayId,
          elementId: connection.id,
          params: {
            relationType: relation.relationType,
            assetName: asset.name,
            elementType: "DataFlow",
          },
        });
      }
    });
  });
}
