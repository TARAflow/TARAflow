// ==================== BIDIRECTIONAL ASSET SYNC HOOK ====================
// app/hooks/use-bidirectional-asset-sync.ts
// 
// Keeps DFDAsset and Asset in sync automatically
// Place this in app layer since it bridges DFD and Assets features

import { useEffect, useRef } from 'react';
import type { Project } from '../models/project-types';
import type { DFDAsset } from 'features/dfd';
import type { Asset, AssetData } from 'features/assets';

interface UseBidirectionalAssetSyncOptions {
  /** Current project */
  project: Project | undefined;
  
  /** Update callback */
  onUpdate: (updates: Partial<Project>) => void;
  
  /** Enable sync (default: true) */
  enabled?: boolean;
}

/**
 * Hook to keep DFDAsset and Asset synchronized
 * 
 * Syncs:
 * - DFD → Assets: When DFD asset name/properties change
 * - Assets → DFD: When Asset name changes
 */
export function useBidirectionalAssetSync({
  project,
  onUpdate,
  enabled = true,
}: UseBidirectionalAssetSyncOptions) {
  const syncInProgressRef = useRef(false);
  
  // ==================== DFD → ASSETS SYNC ====================
  useEffect(() => {
    if (!enabled || !project?.dfd?.assets || !project?.assets) {
      return;
    }
    
    if (syncInProgressRef.current) {
      console.log('[ASSET-SYNC] Sync in progress, skipping DFD→Assets');
      return;
    }
    
    const dfdAssets = project.dfd.assets;
    const assetData = project.assets;
    const assets = assetData.assets;
    
    // Find assets where DFD name differs from Asset name
    const assetsNeedingUpdate: Asset[] = [];
    
    for (const dfdAsset of dfdAssets) {
      const asset = assets.find(a => a.id === dfdAsset.id);
      
      if (!asset) {
        // Asset exists in DFD but not in Assets feature
        // This should be handled by asset-service syncFromDFD
        continue;
      }
      
      // Check if name differs
      const nameChanged = dfdAsset.name && dfdAsset.name !== asset.name;
      const dfdDescription = dfdAsset.description;
      const descriptionChanged =
        dfdDescription !== undefined &&
        dfdDescription !== asset.properties?.description;

      if (nameChanged || descriptionChanged) {
        console.log(`[ASSET-SYNC] DFD→Assets: ${asset.id} changed`);
        assetsNeedingUpdate.push({
          ...asset,
          name: nameChanged ? dfdAsset.name : asset.name,
          properties: descriptionChanged
            ? { ...asset.properties, description: dfdDescription }
            : asset.properties,
          lastModified: new Date().toISOString(),
        });
      }
    }
    
    if (assetsNeedingUpdate.length === 0) {
      return;
    }
    
    // Apply updates
    syncInProgressRef.current = true;
    
    try {
      const updatedAssets = assets.map(a => {
        const update = assetsNeedingUpdate.find(u => u.id === a.id);
        return update || a;
      });
      
      const updatedAssetData: AssetData = {
        ...assetData,
        assets: updatedAssets,
        lastModified: new Date().toISOString(),
      };
      
      console.log(`[ASSET-SYNC] DFD→Assets: Updated ${assetsNeedingUpdate.length} asset(s)`);
      
      onUpdate({
        assets: updatedAssetData,
      });
    } finally {
      // Reset flag after a short delay to allow update to propagate
      setTimeout(() => {
        syncInProgressRef.current = false;
      }, 100);
    }
    
    // Dependency: Only sync when DFD assets change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.dfd?.assets]);
  
  // ==================== ASSETS → DFD SYNC ====================
  useEffect(() => {
    if (!enabled || !project?.dfd?.assets || !project?.assets) {
      return;
    }
    
    if (syncInProgressRef.current) {
      console.log('[ASSET-SYNC] Sync in progress, skipping Assets→DFD');
      return;
    }
    
    const dfdAssets = project.dfd.assets;
    const assets = project.assets.assets;
    
    // Find DFD assets where name differs from Asset name
    const dfdAssetsNeedingUpdate: DFDAsset[] = [];
    
    for (const asset of assets) {
      const dfdAsset = dfdAssets.find(d => d.id === asset.id);
      
      if (!dfdAsset) {
        // Asset exists in Assets feature but not in DFD
        // This is OK (manually created assets)
        continue;
      }
      
      // Check if name differs
      const nameChanged = asset.name && asset.name !== dfdAsset.name;
      const assetDescription = asset.properties?.description;
      const descriptionChanged =
        assetDescription !== undefined &&
        assetDescription !== dfdAsset.description;

      if (nameChanged || descriptionChanged) {
        console.log(`[ASSET-SYNC] Assets→DFD: ${dfdAsset.id} changed`);
        dfdAssetsNeedingUpdate.push({
          ...dfdAsset,
          name: nameChanged ? asset.name : dfdAsset.name,
          description: descriptionChanged
            ? assetDescription
            : dfdAsset.description,
        });
      }
    }
    
    if (dfdAssetsNeedingUpdate.length === 0) {
      return;
    }
    
    // Apply updates
    syncInProgressRef.current = true;
    
    try {
      const updatedDFDAssets = dfdAssets.map(d => {
        const update = dfdAssetsNeedingUpdate.find(u => u.id === d.id);
        return update || d;
      });
      
      console.log(`[ASSET-SYNC] Assets→DFD: Updated ${dfdAssetsNeedingUpdate.length} DFD asset(s)`);
      
      onUpdate({
        dfd: {
          ...project.dfd!,
          assets: updatedDFDAssets,
          lastModified: new Date().toISOString(),
        },
      });
    } finally {
      // Reset flag after a short delay
      setTimeout(() => {
        syncInProgressRef.current = false;
      }, 100);
    }
    
    // Dependency: Only sync when Assets change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.assets?.assets]);
}