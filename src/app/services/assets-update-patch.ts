// app/services/assets-update-patch.ts
//
// What the app does with an Asset tab update, as a pure function (the
// counterpart of dfd-update-patch for the DFD tab):
//
//   - name/description edits are mirrored onto dfd.assets in the same patch;
//   - the tab's `relations` copy is ignored: asset links change only through
//     operations for the relations service (AR-5). The commit chain keeps the
//     canonical list (commitAssetSync carries it when the field is absent);
//   - `a2aOps` (asset import) are applied against the canonical list, with the
//     groups of the assets in this update (imported assets exist already).
//
// WorkspaceLayout passes the patch to updateProject; tests call it directly.

import type { Project } from "../models/project-types";
import type { AssetUpdateResult } from "features/assets";
import {
  applyA2AOps,
  type A2AOp,
  type A2ARejection,
  type AssetGroup,
} from "shared";

const normDesc = (s: string | undefined): string | undefined =>
  s && s.trim().length > 0 ? s : undefined;

export interface AssetsUpdateOutcome {
  patch: Partial<Project> & { id: string };
  /** A2A operations the relations service refused (to tell the user). */
  rejectedA2AOps: readonly { op: A2AOp; reason: A2ARejection }[];
}

export function buildAssetsUpdate(
  current: Project,
  updates: AssetUpdateResult,
): AssetsUpdateOutcome {
  // ── Mirror name/description onto dfd.assets ─────────────────────────────
  let dfd = current.dfd;
  const newAssets = updates.assets?.assets;
  if (dfd?.assets && newAssets) {
    let changed = false;
    const mirroredAssets = dfd.assets.map((dfdAsset) => {
      const asset = newAssets.find((a) => a.id === dfdAsset.id);
      if (!asset) return dfdAsset;

      const newName = asset.name || dfdAsset.name;
      const newDesc = normDesc(asset.properties?.description);
      const nameChanged = newName !== dfdAsset.name;
      const descChanged = newDesc !== normDesc(dfdAsset.description);

      if (!nameChanged && !descChanged) return dfdAsset;

      changed = true;
      return { ...dfdAsset, name: newName, description: newDesc };
    });

    if (changed) {
      dfd = {
        ...dfd,
        assets: mirroredAssets,
        lastModified: new Date().toISOString(),
      };
    }
  }

  // ── Asset links: never from the tab's copy, only as operations ──────────
  const { relations: _ignored, ...store } = updates.assets;
  let assets: Project["assets"] = store;
  let rejectedA2AOps: AssetsUpdateOutcome["rejectedA2AOps"] = [];
  if (updates.a2aOps?.length) {
    const groups = new Map(
      store.assets.map((a) => [a.id, a.assetGroup as AssetGroup]),
    );
    const base = current.assets?.relations ?? [];
    const result = applyA2AOps(
      base,
      updates.a2aOps,
      (id) => groups.get(id),
      () => crypto.randomUUID(),
    );
    rejectedA2AOps = result.rejected;
    // Set explicitly (also when unchanged): the field is present, so the
    // commit chain takes this list instead of carrying the previous one.
    assets = { ...store, relations: result.relations };
  }

  return {
    patch: {
      id: current.id,
      assets,
      dfd,
      phaseStatus: updates.phaseStatus,
    },
    rejectedA2AOps,
  };
}
