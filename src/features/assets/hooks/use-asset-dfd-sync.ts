// ==================== USE ASSET DFD SYNC HOOK ====================
// features/assets/hooks/use-asset-dfd-sync.ts
// Handles automatic synchronization between DFD and Assets

import { useEffect, useRef, useCallback } from 'react';
import type {
  AssetData,
  AssetDFDAsset,
  AssetDFDElement,
  AssetDFDConnection,
} from '../models/asset-types';

interface UseAssetDFDSyncOptions {
  /** Current asset data */
  assetData: AssetData;

  /** DFD assets from project */
  dfdAssets?: AssetDFDAsset[];

  /** DFD elements for resolving links */
  dfdElements?: AssetDFDElement[];

  /** DFD connections for resolving links */
  dfdConnections?: AssetDFDConnection[];

  /** Callback when sync completes */
  onSync: (result: AssetDFDSyncResult) => void;

  /** Callback for warnings */
  onWarning?: (warnings: string[]) => void;

  /** Enable auto-sync on DFD changes (default: true) */
  autoSync?: boolean;

  /** Enable initial sync on mount if no assets exist (default: true) */
  initialSync?: boolean;
}

interface AssetDFDSyncResult {
  assetData: AssetData;
  newAssets: string[];
  warnings: string[];
}

/**
 * Hook for managing Asset-DFD synchronization
 *
 * Features:
 * - Auto-sync when DFD data changes
 * - Initial sync on mount if no assets exist
 * - Prevents duplicate syncs
 * - Resolves DFD element links properly
 */
export function useAssetDFDSync({
  assetData,
  dfdAssets,
  dfdElements,
  dfdConnections,
  onSync,
  onWarning,
  autoSync = true,
  initialSync = true,
}: UseAssetDFDSyncOptions) {
  const syncInProgressRef = useRef(false);
  const initialSyncDoneRef = useRef(false);

  /**
   * Core sync logic - resolves DFD assets to full Asset objects
   */
  const performSync = useCallback((): AssetDFDSyncResult | null => {
    // Guard: prevent concurrent syncs
    if (syncInProgressRef.current) {
      console.log("[ASSET-SYNC] Sync already in progress, skipping");
      return null;
    }

    // Guard: check if DFD data is available
    if (!dfdAssets || dfdAssets.length === 0) {
      console.log("[ASSET-SYNC] No DFD assets available");
      const warnings = ["No DFD assets available for synchronization"];
      onWarning?.(warnings);
      return { assetData, newAssets: [], warnings };
    }

    syncInProgressRef.current = true;

    try {
      console.log("[ASSET-SYNC] Starting sync...", {
        dfdAssetCount: dfdAssets.length,
        existingAssetCount: assetData.assets.length,
      });

      const warnings: string[] = [];
      const newAssetIds: string[] = [];
      const updatedAssets = [...assetData.assets];
      const processedIds = new Set<string>();

      for (const dfdAsset of dfdAssets) {
        // Skip placeholder labels
        if (dfdAsset.id === "A-xx" || dfdAsset.id.includes("xx")) {
          warnings.push(`Skipped placeholder: ${dfdAsset.id}`);
          continue;
        }

        processedIds.add(dfdAsset.id);

        // Map linkedElements to DFDElementLink format
        // Each link now has a single relationType + optional qualifier
        // instead of the old relationTypes[] array
        const linkedDFDElements = (dfdAsset.linkedElements || []).map(
          (link) => ({
            elementId: String(link.elementId || ""),
            elementName: String(link.elementName || ""),
            elementType: String(link.elementType || "unknown"),
            displayId: String(link.displayId || ""),
            relationType: String(link.relationType || ""),
            qualifier: link.qualifier,
            notes: link.notes,
          }),
        );

        console.log(`[ASSET-SYNC] Processing ${dfdAsset.id}:`, {
          rawLinks: dfdAsset.linkedElements,
          resolved: linkedDFDElements,
        });

        const existingIndex = updatedAssets.findIndex(
          (a) => a.id === dfdAsset.id,
        );

        if (existingIndex >= 0) {
          // Update existing asset
          updatedAssets[existingIndex] = {
            ...updatedAssets[existingIndex],
            name: dfdAsset.name || updatedAssets[existingIndex].name,
            linkedDFDElements,
            syncedWithDFD: true,
            lastModified: new Date().toISOString(),
          };
        } else {
          // Create new asset
          const newAsset = {
            id: dfdAsset.id,
            numericId: parseInt(dfdAsset.id.replace(/\D/g, ""), 10) || 0,
            name: dfdAsset.name || dfdAsset.id,
            description: "",
            impactRatings: assetData.configuration.impactCriteria.map(
              (criterionId) => ({
                criterionId,
                value: 0,
              }),
            ),
            overallImpact: 0,
            securityGoals: [],
            linkedDFDElements,
            source: "dfd" as const,
            syncedWithDFD: true,
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          };

          updatedAssets.push(newAsset);
          newAssetIds.push(dfdAsset.id);
        }
      }

      // Mark assets no longer in DFD as out of sync
      for (let i = 0; i < updatedAssets.length; i++) {
        if (!processedIds.has(updatedAssets[i].id)) {
          updatedAssets[i] = { ...updatedAssets[i], syncedWithDFD: false };

          if (updatedAssets[i].source === "dfd") {
            warnings.push(`Asset ${updatedAssets[i].id} no longer in DFD`);
          }
        }
      }

      // Sort by numeric ID
      updatedAssets.sort((a, b) => a.numericId - b.numericId);

      const result: AssetDFDSyncResult = {
        assetData: {
          ...assetData,
          assets: updatedAssets,
          lastModified: new Date().toISOString(),
        },
        newAssets: newAssetIds,
        warnings,
      };

      console.log("[ASSET-SYNC] Sync completed:", {
        totalAssets: updatedAssets.length,
        newAssets: newAssetIds.length,
        warnings: warnings.length,
      });

      return result;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [assetData, dfdAssets, dfdElements, dfdConnections]);

  /** Manually trigger a sync */
  const triggerSync = useCallback(() => {
    const result = performSync();
    if (result) onSync(result);
  }, [performSync, onSync]);

  // ==================== EFFECTS ====================

  /** Initial sync on mount if no assets exist */
  useEffect(() => {
    if (!initialSync || initialSyncDoneRef.current) return;
    if (assetData.assets.length > 0) return;
    if (!dfdAssets || dfdAssets.length === 0) return;

    console.log("[ASSET-SYNC] Running initial sync");
    initialSyncDoneRef.current = true;
    triggerSync();
  }, [initialSync, assetData.assets.length, dfdAssets, triggerSync]);

  /** Auto-sync when DFD data changes */
  useEffect(() => {
    if (!autoSync) return;
    if (!initialSyncDoneRef.current) return;
    if (!dfdAssets || dfdAssets.length === 0) return;
    if (assetData.assets.length === 0) return;

    console.log("[ASSET-SYNC] DFD data changed, triggering auto-sync");
    triggerSync();

    // NOTE: triggerSync is intentionally the only dependency here.
    // We sync when DFD data changes, not when triggerSync is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dfdAssets, dfdElements, dfdConnections]);

  return {
    /** Manually trigger a sync */
    sync: triggerSync,
    /** Whether a sync is currently in progress */
    isSyncing: syncInProgressRef.current,
  };
}