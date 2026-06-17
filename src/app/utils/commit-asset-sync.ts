// app/utils/commit-asset-sync.ts
//
// Phase 2 of the Asset-Store SoT refactor (asset-store-ssot-refactor-v2.md).
//
// Enforces the DFD → AssetData sync at the SINGLE project write channel
// (updateProject) and at project load (backfill). This is the generalization of
// QF-1: no write path can strand or drift assets, because every write and every
// load passes through here.
//
// syncFromDFD is itself hasChanges-guarded and idempotent (verified by the
// Phase 0 golden tests), so a redundant run is a cheap no-op.

import type { Project } from "../models/project-types";
import { syncFromDFD } from "features/assets/services/asset-sync-service"; // or barrel: "features/assets"
import { mapDFDAssetsToAssetFeature } from "./dfd-to-asset-mapper";

/**
 * Returns `next` with AssetData re-synced from its DFD assets.
 *
 * - On a write (updateProject): pass `prev` = the project's previous state. The
 *   reference compare on `dfd.assets` skips the sync when DFD assets did not
 *   change, keeping unchanged updates allocation-free.
 * - On load/backfill: pass `prev = undefined` to force a sync that repairs any
 *   pre-existing drift (stale `linkedDFDElements`, stranded hazard targets).
 *
 * Elements/connections are reserved (unused) params in syncFromDFD → [] is faithful.
 */
export function commitAssetSync(
  prev: Project | undefined,
  next: Project,
): Project {
  // Nothing to sync into.
  if (!next.assets) return next;

  // Write path: DFD assets unchanged since last commit → no work.
  if (prev && prev.dfd?.assets === next.dfd?.assets) return next;

  const { assetData, hasChanges } = syncFromDFD(
    next.assets,
    mapDFDAssetsToAssetFeature(next.dfd?.assets ?? []),
    [],
    [],
  );

  return hasChanges ? { ...next, assets: assetData } : next;
}