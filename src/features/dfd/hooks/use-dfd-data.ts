// ==================== USE DFD DATA HOOK ====================
// Single Responsibility: Manage DFD data consistency
// Ensures: Graph is ALWAYS rebuilt on any change
// Ensures: Asset linkedElements are ALWAYS synced
// Ensures: Stats are ALWAYS recalculated

import { useCallback, useMemo } from "react";
import type {
  DFDData,
  DFDProjectData,
  DFDElement,
  DFDAsset,
  DFDConnection,
  DFDStats,
  ElementRelation,
} from "../models/dfd-types";
import {
  isSystemUsesRelation,
  isInfraAccessesRelation,
} from "../models/asset-relation-types";
import { DefaultDFDGraphBuilder } from "../services/dfd-graph-builder";
import { calculateStats } from "../services/parsers/stats-calculator";
import type { DFDGraph } from "../models/dfd-graph-types";

// ==================== TYPES ====================

export interface UseDFDDataReturn {
  // Current state
  dfd: DFDData | null;
  graph: DFDGraph | undefined;
  stats: DFDStats | undefined;

  // Atomic update operations (always rebuild graph)
  updateElement: (elementId: string, updates: Partial<DFDElement>) => DFDData;
  updateAsset: (assetId: string, updates: Partial<DFDAsset>) => DFDData;
  updateConnection: (
    connectionId: string,
    updates: Partial<DFDConnection>,
  ) => DFDData;

  // Low-level update (for advanced use cases)
  updateDFD: (updater: (dfd: DFDData) => DFDData) => DFDData;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Synchronize asset.linkedElements from element.assetRelations
 * This is the SINGLE SOURCE OF TRUTH sync
 */
function syncAssetLinkedElements(
  elements: DFDElement[],
  connections: DFDConnection[],
  assets: DFDAsset[],
): DFDAsset[] {
  // Build map: assetId → ElementRelation[]
  const assetLinksMap = new Map<string, ElementRelation[]>();

  // Process all elements
  elements.forEach((element) => {
    if (!element.assetRelations || element.assetRelations.length === 0) return;

    element.assetRelations.forEach((relation) => {
      // ← missing loop
      const elementRelation: ElementRelation = {
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
      };

      const existing = assetLinksMap.get(relation.assetId) || [];
      assetLinksMap.set(relation.assetId, [...existing, elementRelation]);
    }); // ← closing inner forEach
  });

connections.forEach((connection) => {
  if (!connection.assetRelations || connection.assetRelations.length === 0)
    return;

  connection.assetRelations.forEach((relation) => {
    // ← missing loop
    const elementRelation: ElementRelation = {
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
    };

    const existing = assetLinksMap.get(relation.assetId) || [];
    assetLinksMap.set(relation.assetId, [...existing, elementRelation]);
  }); // ← closing inner forEach
});

  // Update all assets with computed linkedElements
  return assets.map((asset) => ({
    ...asset,
    linkedElements: assetLinksMap.get(asset.id) || [],
  }));
}

/**
 * Rebuild graph from DFD data
 */
function rebuildGraph(dfd: DFDData): DFDGraph {
  const builder = new DefaultDFDGraphBuilder();
  return builder.build(dfd);
}

/**
 * Recalculate stats from DFD data
 */
function recalculateStats(
  elements: DFDElement[],
  connections: DFDConnection[],
  assets: DFDAsset[],
): DFDStats {
  return calculateStats(elements, connections, assets);
}

// ==================== HOOK ====================

export function useDFDData(project: DFDProjectData): UseDFDDataReturn {
  const dfd = project.dfd;

  // Memoized derived state
  const graph = useMemo(() => dfd?.graph, [dfd?.graph]);
  const stats = useMemo(() => dfd?.stats, [dfd?.stats]);

  /**
   * ATOMIC UPDATE FUNCTION
   * Guarantees:
   * 1. Asset linkedElements are synced
   * 2. Graph is rebuilt
   * 3. Stats are recalculated
   * 4. lastModified is updated
   */
  const updateDFD = useCallback(
    (updater: (dfd: DFDData) => DFDData): DFDData => {
      if (!dfd) {
        throw new Error("Cannot update DFD: project.dfd is null");
      }

      // 1. Apply user updates
      const updated = updater(dfd);

      // 2. Sync asset linkedElements (SINGLE SOURCE OF TRUTH)
      const syncedAssets = syncAssetLinkedElements(
        updated.elements,
        updated.connections,
        updated.assets,
      );

      // 3. Rebuild graph
      const graphBuilder = new DefaultDFDGraphBuilder();
      const newGraph = graphBuilder.build({
        ...updated,
        assets: syncedAssets,
      });

      // 4. Recalculate stats
      const newStats = recalculateStats(
        updated.elements,
        updated.connections,
        syncedAssets,
      );

      // 5. Return fully consistent DFD
      const result: DFDData = {
        ...updated,
        assets: syncedAssets,
        graph: newGraph,
        stats: newStats,
        lastModified: new Date().toISOString(),
      };

      return result;
    },
    [dfd],
  );

  /**
   * Update element properties (description, properties, assetRelations, etc.)
   */
  const updateElement = useCallback(
    (elementId: string, updates: Partial<DFDElement>): DFDData => {
      return updateDFD((dfd) => ({
        ...dfd,
        elements: dfd.elements.map((el) =>
          el.id === elementId ? { ...el, ...updates } : el,
        ),
      }));
    },
    [updateDFD],
  );

  /**
   * Update asset properties (name, properties, etc.)
   * Note: linkedElements will be re-synced automatically
   */
  const updateAsset = useCallback(
    (assetId: string, updates: Partial<DFDAsset>): DFDData => {
      return updateDFD((dfd) => ({
        ...dfd,
        assets: dfd.assets.map((a) =>
          a.id === assetId ? { ...a, ...updates } : a,
        ),
      }));
    },
    [updateDFD],
  );

  /**
   * Update connection properties (label, properties, assetRelations, etc.)
   */
  const updateConnection = useCallback(
    (connectionId: string, updates: Partial<DFDConnection>): DFDData => {
      return updateDFD((dfd) => ({
        ...dfd,
        connections: dfd.connections.map((c) =>
          c.id === connectionId ? { ...c, ...updates } : c,
        ),
      }));
    },
    [updateDFD],
  );

  return {
    dfd,
    graph,
    stats,
    updateElement,
    updateAsset,
    updateConnection,
    updateDFD,
  };
}

export default useDFDData;