// ==================== USE ASSET DFD SYNC HOOK ====================
// features/assets/hooks/use-asset-dfd-sync.ts
//
// Single Responsibility: UI binding layer between DFD data changes
// and asset-sync-service. Handles timing, deduplication and callbacks.
//
// Business logic (asset creation, impact derivation) lives in:
//   asset-sync-service.ts → DFD sync + physicalImpact derivation
//   asset-service.ts      → updateAsset + HVA + aggregatedImpact derivation

import { useEffect, useRef, useCallback } from "react";
import type {
  AssetData,
  AssetDFDAsset,
  AssetDFDElement,
  AssetDFDConnection,
} from "../models/asset-types";
import { syncFromDFD } from "../services/asset-sync-service";
import type { DFDAssetSyncResult } from "../services/asset-sync-service";

// ==================== TYPES ====================

interface UseAssetDFDSyncOptions {
  assetData: AssetData;
  dfdAssets?: AssetDFDAsset[];
  dfdElements?: AssetDFDElement[];
  dfdConnections?: AssetDFDConnection[];
  onSync: (result: DFDAssetSyncResult) => void;
  onWarning?: (warnings: string[]) => void;
  autoSync?: boolean;
  initialSync?: boolean;
}

// ==================== HOOK ====================

export function useAssetDFDSync({
  assetData,
  dfdAssets,
  dfdElements = [],
  dfdConnections = [],
  onSync,
  onWarning,
  autoSync = true,
  initialSync = true,
}: UseAssetDFDSyncOptions) {
  const syncInProgressRef = useRef(false);
  const initialSyncDoneRef = useRef(false);
  const prevDfdAssetsHashRef = useRef<string>("");

  // Delegate entirely to asset-sync-service
  const performSync = useCallback((): DFDAssetSyncResult | null => {
    if (syncInProgressRef.current) return null;

    if (!dfdAssets || dfdAssets.length === 0) {
      const warnings = ["No DFD assets available for synchronization"];
      onWarning?.(warnings);
      return { assetData, newAssets: [], warnings };
    }

    syncInProgressRef.current = true;
    try {
      return syncFromDFD(assetData, dfdAssets, dfdElements, dfdConnections);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [assetData, dfdAssets, dfdElements, dfdConnections, onWarning]);

  const triggerSync = useCallback(() => {
    const result = performSync();
    if (result) {
      if (result.warnings.length > 0) onWarning?.(result.warnings);
      onSync(result);
    }
  }, [performSync, onSync, onWarning]);

  // Initial sync on mount
  useEffect(() => {
    if (!initialSync) return;
    if (!dfdAssets || dfdAssets.length === 0) return;

    const result = performSync();
    if (!result) return;
    if (result.warnings.length > 0) onWarning?.(result.warnings);
    // Only notify parent if something actually changed
    if (result.hasChanges) onSync(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync on DFD content change (content hash prevents loops)
  useEffect(() => {
    if (!autoSync) return;
    if (!dfdAssets || dfdAssets.length === 0) return;
    if (assetData.assets.length === 0) return;

    const hash = JSON.stringify(
      dfdAssets.map((a) => ({
        id: a.id,
        name: a.name,
        group: a.assetGroup,
        links: a.linkedElements?.map((l) => l.elementId + l.relationType),
      })),
    );

    if (hash === prevDfdAssetsHashRef.current) return;
    prevDfdAssetsHashRef.current = hash;

    triggerSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dfdAssets, dfdElements, dfdConnections]);

  return {
    sync: triggerSync,
    isSyncing: syncInProgressRef.current,
    resetHash: () => {
      prevDfdAssetsHashRef.current = "";
    },
  };
}