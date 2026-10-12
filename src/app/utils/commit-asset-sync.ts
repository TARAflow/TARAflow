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
import { deriveDfdAssets, dfdSourcedAssets } from "./asset-to-dfd-mapper";
import { projectA2AOntoMirror } from "./a2a-mirror";
import type { AssetGroup } from "shared";

function groupLookup(project: Project): (id: string) => AssetGroup | undefined {
  const groups = new Map(
    (project.assets?.assets ?? []).map((a) => [a.id, a.assetGroup as AssetGroup]),
  );
  return (id) => groups.get(id);
}

/**
 * Guard against the B1 failure class: a writer that rebuilt AssetData without
 * the `relations` field must not delete the canonical A2A edges. Deliberate
 * removal always yields an array (possibly empty), never `undefined`.
 */
function carryRelations(prev: Project | undefined, next: Project): Project {
  const kept = prev?.assets?.relations;
  if (!kept || !next.assets || next.assets.relations !== undefined) return next;
  return { ...next, assets: { ...next.assets, relations: kept } };
}

/**
 * The dfd.assets mirror shows the canonical A2A edges (assets.relations) of
 * each asset as `assetRelations` — a view, never a source: edits reach the
 * canonical list only as operations (DFDUpdateResult.a2aOps → relations
 * service). Re-projected whenever the edges or the mirror changed.
 */
function withA2AProjection(prev: Project | undefined, out: Project): Project {
  const mirror = out.dfd?.assets;
  if (!out.assets || !out.dfd || !mirror || mirror.length === 0) return out;
  if (
    prev &&
    prev.dfd?.assets === mirror &&
    prev.assets?.relations === out.assets?.relations
  ) {
    return out;
  }
  const projected = projectA2AOntoMirror(
    mirror,
    out.assets?.relations ?? [],
    groupLookup(out),
  );
  return projected === mirror
    ? out
    : { ...out, dfd: { ...out.dfd, assets: projected } };
}

/**
 * Returns `next` with AssetData re-synced from its DFD assets.
 *
 * - On a write (updateProject): pass `prev` = the project's previous state. The
 *   reference compare on `dfd.assets` skips the sync when DFD assets did not
 *   change, keeping unchanged updates allocation-free.
 * - On load/backfill: pass `prev = undefined` to force a sync that repairs any
 *   pre-existing drift (stale `linkedDFDElements`, stranded hazard targets).
 *
 * Elements/connections are reserved (unused) params in syncFromDFD → [] is
 * faithful for those two. mapDFDAssetsToAssetFeature's elements/connections
 * are a separate, REQUIRED pair — it rebuilds linkedElements (incl. safety)
 * from their assetRelations, not from a mirror. Do not conflate the two.
 */
export function commitAssetSync(
  prev: Project | undefined,
  nextIn: Project,
): Project {
  return withA2AProjection(prev, syncAssets(prev, nextIn));
}

function syncAssets(prev: Project | undefined, nextIn: Project): Project {
  // Nothing to sync into.
  if (!nextIn.assets) return nextIn;
  const next = carryRelations(prev, nextIn);
  const nextAssets = next.assets!;

  // ── Single-store load (feature store canonical) ───────────────────────────
  // If dfd.assets is empty but the canonical feature store holds dfd-sourced
  // assets, the project was persisted WITHOUT the dfd.assets mirror. Derive the
  // DFD's runtime asset list from the feature store (via assetRelations) rather
  // than running the reconcile below — which, keying off an empty dfd.assets,
  // would prune those very assets. Behaviour-neutral while dfd.assets is still
  // present (the branch simply does not fire).
  const dfdAssetList = next.dfd?.assets ?? [];
  if (dfdAssetList.length === 0 && next.dfd) {
    const sourced = dfdSourcedAssets(nextAssets.assets ?? []);
    if (sourced.length > 0) {
      const derived = deriveDfdAssets(
        sourced,
        next.dfd.elements ?? [],
        next.dfd.connections ?? [],
      );
      return { ...next, dfd: { ...next.dfd, assets: derived } };
    }
  }

  // Write path: DFD assets unchanged since last commit → no work.
  if (prev && prev.dfd?.assets === next.dfd?.assets) return next;

  const { assetData, hasChanges } = syncFromDFD(
    nextAssets,
    mapDFDAssetsToAssetFeature(
      next.dfd?.assets ?? [],
      next.dfd?.elements ?? [],
      next.dfd?.connections ?? [],
    ),
    [],
    [],
  );

  return hasChanges ? { ...next, assets: assetData } : next;
}