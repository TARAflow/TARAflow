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
  DFDConnection,
  DFDStats,
} from "../models/dfd-types";
import type { DFDAsset, ElementRelation } from "../models/dfd-asset-types";
import type { AssetGroup, AssetRelation } from "../models/asset-relation-types";
import {
  isSystemUsesRelation,
  isInfraAccessesRelation,
} from "../models/asset-relation-types";
import { DefaultDFDGraphBuilder } from "../services/dfd-graph-builder";
import { calculateStats } from "../services/parsers/stats-calculator";
import type { DFDGraph } from "../models/dfd-graph-types";
import type { AvailableAsset } from "../components/forms/asset-relation-selector";
// Asset creation now lives in shared so DFD and Hazard mint identical ids/seeds.
import { createAsset as createAssetSeed, generateAssetId } from "shared";

// ==================== TYPES ====================

export interface UseDFDDataReturn {
  // Current state
  dfd: DFDData | null;
  graph: DFDGraph | undefined;
  stats: DFDStats | undefined;

  // Atomic update operations (always rebuild graph + sync + stats)
  updateElement: (elementId: string, updates: Partial<DFDElement>) => DFDData;
  updateAsset: (assetId: string, updates: Partial<DFDAsset>) => DFDData;
  updateConnection: (
    connectionId: string,
    updates: Partial<DFDConnection>,
  ) => DFDData;

  /**
   * Create a new asset in dfd.assets[] and return it.
   * Called by AssetRelationSelector via onCreateAsset.
   * updateDFD guarantees graph rebuild + stats + linkedElements sync.
   *
   * Returns both the updated DFD (for scheduleSave) and the new asset
   * (so the selector can immediately use the real assetId in the relation).
   */
  createAsset: (
    name: string,
    assetGroup: AssetGroup,
    protectionNeed?: DFDAsset["protectionNeed"],
  ) => { newDfd: DFDData; asset: DFDAsset };

  /**
   * Delete an asset from dfd.assets[] and remove all its relations
   * from elements and connections atomically.
   */
  deleteAsset: (assetId: string) => DFDData;

  /**
   * Derive AvailableAsset[] from dfd.assets for the AssetRelationSelector.
   * Memoized — only recomputed when dfd.assets changes.
   */
  availableAssets: AvailableAsset[];

  // Low-level update (for advanced use cases)
  updateDFD: (updater: (dfd: DFDData) => DFDData) => DFDData;
}

// ==================== HELPER: SYNC LINKED ELEMENTS ====================

/**
 * Synchronize asset.linkedElements from element.assetRelations
 * and connection.assetRelations.
 *
 * This is the SINGLE SOURCE OF TRUTH sync — called after every updateDFD.
 */
function syncAssetLinkedElements(
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

// ==================== HELPER: AVAILABLE ASSETS ====================

function toAvailableAssets(assets: DFDAsset[]): AvailableAsset[] {
  return assets.map((a) => ({
    id: a.id,
    displayId: a.displayId,
    name: a.name,
    assetGroup: a.assetGroup,
    protectionNeed: a.protectionNeed,
  }));
}

// ==================== HOOK ====================

export function useDFDData(project: DFDProjectData): UseDFDDataReturn {
  const dfd = project.dfd;

  // Memoized derived state
  const graph = useMemo(() => dfd?.graph, [dfd?.graph]);
  const stats = useMemo(() => dfd?.stats, [dfd?.stats]);

  /**
   * Memoized AvailableAsset[] for the AssetRelationSelector.
   * Recomputed only when dfd.assets reference changes.
   */
  const availableAssets = useMemo(
    () => toAvailableAssets(dfd?.assets ?? []),
    [dfd?.assets],
  );

  // ==================== ATOMIC UPDATE ====================

  /**
   * ATOMIC UPDATE FUNCTION
   * Guarantees after every call:
   *   1. Asset linkedElements are synced
   *   2. Graph is rebuilt
   *   3. Stats are recalculated
   *   4. lastModified is updated
   */
  const updateDFD = useCallback(
    (updater: (dfd: DFDData) => DFDData): DFDData => {
      if (!dfd) {
        throw new Error("Cannot update DFD: project.dfd is null");
      }

      // 1. Apply caller's changes
      const updated = updater(dfd);

      // 2. Sync asset linkedElements (SINGLE SOURCE OF TRUTH)
      const syncedAssets = syncAssetLinkedElements(
        updated.elements,
        updated.connections,
        updated.assets,
      );

      // 3. Rebuild graph
      const graphBuilder = new DefaultDFDGraphBuilder();
      const newGraph = graphBuilder.build({ ...updated, assets: syncedAssets });

      // 4. Recalculate stats
      const newStats = calculateStats(
        updated.elements,
        updated.connections,
        syncedAssets,
      );

      // 5. Return fully consistent DFD
      return {
        ...updated,
        assets: syncedAssets,
        graph: newGraph,
        stats: newStats,
        lastModified: new Date().toISOString(),
      };
    },
    [dfd],
  );

  // ==================== ELEMENT / ASSET / CONNECTION UPDATES ====================

  /**
   * Update element properties (description, properties, assetRelations, …)
   */
  const updateElement = useCallback(
    (elementId: string, updates: Partial<DFDElement>): DFDData =>
      updateDFD((current) => ({
        ...current,
        elements: current.elements.map((el) =>
          el.id === elementId ? { ...el, ...updates } : el,
        ),
      })),
    [updateDFD],
  );

  /**
   * Update asset properties (name, protectionNeed, properties, …).
   * linkedElements will be re-synced automatically by updateDFD.
   *
   * ✅ CLEANUP: If assetGroup changes, all existing asset relations
   * in elements/connections are automatically removed (incompatible relations).
   * ✅ ID REGENERATION: If assetGroup changes, a new ID with the correct
   * prefix is generated (DA-001 → SY-001) via the shared generateAssetId.
   */
  const updateAsset = useCallback(
    (assetId: string, updates: Partial<DFDAsset>): DFDData => {
      // Detect category change
      const oldAsset = dfd?.assets.find((a) => a.id === assetId);
      const categoryChanged =
        updates.assetGroup &&
        oldAsset &&
        updates.assetGroup !== oldAsset.assetGroup;

      return updateDFD((current) => {
        let elements = current.elements;
        let connections = current.connections;
        let finalUpdates = { ...updates };

        // ✅ Cleanup asset relations if category changed
        if (categoryChanged) {
          // Generate new ID with correct prefix (shared primitive — takes ids).
          const newId = generateAssetId(
            current.assets.map((a) => a.id),
            updates.assetGroup!,
          );
          finalUpdates = {
            ...updates,
            id: newId,
            displayId: newId,
          };

          elements = elements.map((el) => {
            const hasRelation = el.assetRelations?.some(
              (r) => r.assetId === assetId,
            );
            if (!hasRelation) return el;

            return {
              ...el,
              assetRelations: el.assetRelations!.filter(
                (r) => r.assetId !== assetId,
              ),
            };
          });

          connections = connections.map((conn) => {
            const hasRelation = conn.assetRelations?.some(
              (r) => r.assetId === assetId,
            );
            if (!hasRelation) return conn;

            return {
              ...conn,
              assetRelations: conn.assetRelations!.filter(
                (r) => r.assetId !== assetId,
              ),
            };
          });
        }

        // Update asset (using old ID to find it, but applying new ID if category changed)
        const assets = current.assets.map((a) =>
          a.id === assetId ? { ...a, ...finalUpdates } : a,
        );

        return {
          ...current,
          elements,
          connections,
          assets,
        };
      });
    },
    [dfd?.assets, updateDFD],
  );

  /**
   * Update connection properties (label, properties, assetRelations, …)
   */
  const updateConnection = useCallback(
    (connectionId: string, updates: Partial<DFDConnection>): DFDData =>
      updateDFD((current) => ({
        ...current,
        connections: current.connections.map((c) =>
          c.id === connectionId ? { ...c, ...updates } : c,
        ),
      })),
    [updateDFD],
  );

  // ==================== ASSET CREATION ====================

  /**
   * Create a new DFDAsset in dfd.assets[] atomically.
   *
   * The asset id + seed come from the shared createAsset primitive (same code
   * the Hazard Bowtie uses); this hook only widens the seed to a DFDAsset
   * (linkedElements []) and runs the atomic updateDFD (graph + stats + sync).
   *
   * Returns { newDfd, asset } so the caller can:
   *   - pass newDfd to scheduleSave()
   *   - return asset to AssetRelationSelector as AvailableAsset
   *     so the new assetId is immediately used in the relation
   *
   * ID scheme:  DA-001 / SY-001 / PR-001 / IF-001 / HU-001
   * Sequential per group — no gaps from mixed-group deletions.
   */
  const createAsset = useCallback(
    (
      name: string,
      assetGroup: AssetGroup,
      protectionNeed?: DFDAsset["protectionNeed"],
    ): { newDfd: DFDData; asset: DFDAsset } => {
      if (!dfd) throw new Error("Cannot create asset: project.dfd is null");

      const seed = createAssetSeed(
        dfd.assets.map((a) => a.id),
        name,
        assetGroup,
        protectionNeed,
      );

      const newAsset: DFDAsset = {
        ...seed,
        linkedElements: [], // will be populated by syncAssetLinkedElements
      };

      const newDfd = updateDFD((current) => ({
        ...current,
        assets: [...current.assets, newAsset],
      }));

      return { newDfd, asset: newAsset };
    },
    [dfd, updateDFD],
  );

  // ==================== ASSET DELETION ====================

  /**
   * Delete an asset and remove all its relations from elements/connections.
   * Atomically: graph rebuild + stats + linkedElements sync guaranteed by updateDFD.
   */
  const deleteAsset = useCallback(
    (assetId: string): DFDData =>
      updateDFD((current) => ({
        ...current,
        assets: current.assets.filter((a) => a.id !== assetId),
        elements: current.elements.map((el) =>
          el.assetRelations?.some((r) => r.assetId === assetId)
            ? {
                ...el,
                assetRelations: el.assetRelations!.filter(
                  (r) => r.assetId !== assetId,
                ),
              }
            : el,
        ),
        connections: current.connections.map((conn) =>
          conn.assetRelations?.some((r) => r.assetId === assetId)
            ? {
                ...conn,
                assetRelations: conn.assetRelations!.filter(
                  (r) => r.assetId !== assetId,
                ),
              }
            : conn,
        ),
      })),
    [updateDFD],
  );

  // ==================== RETURN ====================

  return {
    dfd,
    graph,
    stats,
    availableAssets,
    updateElement,
    updateAsset,
    updateConnection,
    createAsset,
    deleteAsset,
    updateDFD,
  };
}

export default useDFDData;