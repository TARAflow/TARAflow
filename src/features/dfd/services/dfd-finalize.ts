// features/dfd/services/dfd-finalize.ts
//
// Restores every derived DFD invariant after a structural change: asset
// linkedElements (from element/connection assetRelations), graph and stats.
// Pure — shared by useDFDData.updateDFD and by app-layer operations that must
// rewrite the DFD outside the DFD tab (e.g. deleting an asset from the Asset tab).

import type { DFDData, DFDElement, DFDConnection } from "../models/dfd-types";
import type { DFDAsset, ElementRelation } from "../models/dfd-asset-types";
import {
  isSystemUsesRelation,
  isInfraAccessesRelation,
} from "../models/asset-relation-types";
import { DefaultDFDGraphBuilder } from "./dfd-graph-builder";
import { calculateStats } from "./parsers/stats-calculator";

// ==================== HELPER: SYNC LINKED ELEMENTS ====================

/**
 * Synchronize asset.linkedElements from element.assetRelations
 * and connection.assetRelations.
 *
 * This is the SINGLE SOURCE OF TRUTH sync — called after every updateDFD.
 */
export function syncAssetLinkedElements(
  elements: DFDElement[],
  connections: DFDConnection[],
  assets: DFDAsset[],
): DFDAsset[] {
  // Build map: assetId → ElementRelation[]
  const linksMap = new Map<string, ElementRelation[]>();

  const pushLink = (assetId: string, link: ElementRelation) => {
    const existing = linksMap.get(assetId) ?? [];
    linksMap.set(assetId, [...existing, link]);
  };

  // Elements
  for (const element of elements) {
    for (const relation of element.assetRelations ?? []) {
      pushLink(relation.assetId, {
        elementId: element.id,
        elementName: element.name,
        elementType: element.type,
        displayId: element.displayId,
        relationType: relation.relationType,
        qualifier:
          isSystemUsesRelation(relation) || isInfraAccessesRelation(relation)
            ? relation.qualifier
            : undefined,
        notes: relation.notes,
      });
    }
  }

  // Connections (DataFlows)
  for (const connection of connections) {
    for (const relation of connection.assetRelations ?? []) {
      pushLink(relation.assetId, {
        elementId: connection.id,
        elementName: connection.name || "Unnamed DataFlow",
        elementType: "DataFlow",
        displayId: connection.displayId,
        relationType: relation.relationType,
        qualifier:
          isSystemUsesRelation(relation) || isInfraAccessesRelation(relation)
            ? relation.qualifier
            : undefined,
        notes: relation.notes,
      });
    }
  }

  return assets.map((asset) => ({
    ...asset,
    linkedElements: linksMap.get(asset.id) ?? [],
  }));
}

/**
 * Returns a fully consistent DFD: linkedElements synced, graph rebuilt, stats
 * recalculated, lastModified bumped.
 */
export function finalizeDfd(updated: DFDData): DFDData {
  const syncedAssets = syncAssetLinkedElements(
    updated.elements,
    updated.connections,
    updated.assets,
  );
  const graph = new DefaultDFDGraphBuilder().build({
    ...updated,
    assets: syncedAssets,
  });
  const stats = calculateStats(
    updated.elements,
    updated.connections,
    syncedAssets,
  );
  return {
    ...updated,
    assets: syncedAssets,
    graph,
    stats,
    lastModified: new Date().toISOString(),
  };
}
