// ==================== BIDIRECTIONAL ASSET SYNC HOOK ====================
// app/hooks/use-bidirectional-asset-sync.ts
//
// Keeps DFDAsset and Asset in sync automatically.
// Place this in app layer since it bridges DFD and Assets features.
//
// Loop prevention strategy:
//   Both effects use a shared "last synced" snapshot ref.
//   Before calling onUpdate, the new values are written to the ref.
//   On the next render triggered by that update, the equality check
//   against the ref returns "no change" → no further onUpdate call.

import { useEffect, useRef } from "react";
import type { Project } from "../models/project-types";
import type { DFDAsset } from "features/dfd";
import type { Asset, AssetData } from "features/assets";

interface UseBidirectionalAssetSyncOptions {
  project: Project | undefined;
  onUpdate: (updates: Partial<Project>) => void;
  enabled?: boolean;
}

// Snapshot of the values we last synced — used to detect real changes only
interface SyncSnapshot {
  // assetId → name as last written to Assets feature
  assetNames: Record<string, string>;
  // assetId → description as last written to DFD
  dfdDescriptions: Record<string, string | undefined>;
}

export function useBidirectionalAssetSync({
  project,
  onUpdate,
  enabled = true,
}: UseBidirectionalAssetSyncOptions) {
  // Tracks values already synced so we don't re-fire on our own updates
  const snapshotRef = useRef<SyncSnapshot>({
    assetNames: {},
    dfdDescriptions: {},
  });

  // ==================== DFD → ASSETS SYNC ====================
  // Fires when DFD asset names/descriptions change
  useEffect(() => {
    if (!enabled || !project?.dfd?.assets || !project?.assets) return;

    const dfdAssets = project.dfd.assets;
    const assets = project.assets.assets;
    const snapshot = snapshotRef.current;

    const assetsNeedingUpdate: Asset[] = [];

    for (const dfdAsset of dfdAssets) {
      const asset = assets.find((a) => a.id === dfdAsset.id);
      if (!asset) continue;

      const newName = dfdAsset.name || asset.name;
      const newDesc = dfdAsset.description;

      // Only update if value differs from what we last synced AND from current asset
      const nameChanged =
        newName !== asset.name && newName !== snapshot.assetNames[asset.id];

      const descChanged =
        newDesc !== undefined &&
        newDesc !== asset.properties?.description &&
        newDesc !== snapshot.dfdDescriptions[asset.id];

      if (nameChanged || descChanged) {
        assetsNeedingUpdate.push({
          ...asset,
          name: nameChanged ? newName : asset.name,
          properties: descChanged
            ? { ...asset.properties, description: newDesc }
            : asset.properties,
          lastModified: new Date().toISOString(),
        });
        // Record what we're about to sync so the reverse effect ignores it
        if (nameChanged) snapshot.assetNames[asset.id] = newName;
        if (descChanged) snapshot.dfdDescriptions[asset.id] = newDesc;
      }
    }

    if (assetsNeedingUpdate.length === 0) return;

    const updatedAssets = assets.map((a) => {
      const update = assetsNeedingUpdate.find((u) => u.id === a.id);
      return update ?? a;
    });

    const updatedAssetData: AssetData = {
      ...project.assets,
      assets: updatedAssets,
      lastModified: new Date().toISOString(),
    };

    onUpdate({ assets: updatedAssetData });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.dfd?.assets]);

  // ==================== ASSETS → DFD SYNC ====================
  // Fires when Asset names/descriptions change
  useEffect(() => {
    if (!enabled || !project?.dfd?.assets || !project?.assets) return;

    const dfdAssets = project.dfd.assets;
    const assets = project.assets.assets;
    const snapshot = snapshotRef.current;

    const dfdAssetsNeedingUpdate: DFDAsset[] = [];

    for (const asset of assets) {
      const dfdAsset = dfdAssets.find((d) => d.id === asset.id);
      if (!dfdAsset) continue;

      const newName = asset.name || dfdAsset.name;
      const newDesc = asset.properties?.description;

      const nameChanged =
        newName !== dfdAsset.name && newName !== snapshot.assetNames[asset.id];

      const descChanged =
        newDesc !== undefined &&
        newDesc !== dfdAsset.description &&
        newDesc !== snapshot.dfdDescriptions[asset.id];

      if (nameChanged || descChanged) {
        dfdAssetsNeedingUpdate.push({
          ...dfdAsset,
          name: nameChanged ? newName : dfdAsset.name,
          description: descChanged ? newDesc : dfdAsset.description,
        });
        // Record what we're about to sync
        if (nameChanged) snapshot.assetNames[asset.id] = newName;
        if (descChanged) snapshot.dfdDescriptions[asset.id] = newDesc;
      }
    }

    if (dfdAssetsNeedingUpdate.length === 0) return;

    const updatedDFDAssets = dfdAssets.map((d) => {
      const update = dfdAssetsNeedingUpdate.find((u) => u.id === d.id);
      return update ?? d;
    });

    onUpdate({
      dfd: {
        ...project.dfd!,
        assets: updatedDFDAssets,
        lastModified: new Date().toISOString(),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.assets?.assets]);
}