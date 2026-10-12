// app/services/dfd-update-patch.ts
//
// What the app does with a DFD tab update, as a pure function: reconcile the
// asset store against the new DFD, propagate explicit asset deletions, then
// re-sync threats against the new graph. WorkspaceLayout.handleDFDUpdate
// passes the result to updateProject; integration tests call it directly so
// they run exactly the production chain.

import type { Project } from "../models/project-types";
import type { DFDUpdateResult } from "features/dfd";
import { syncThreatsWithGraph } from "features/threats";
import { syncFromDFD } from "features/assets/services/asset-sync-service";
import {
  EMPTY_PROJECT_TAGS,
  applyA2AOps,
  regulationPresetFromTags,
  toGraphReference,
  type A2AOp,
  type A2ARejection,
  type AssetGroup,
} from "shared";
import {
  mapDFDAssetsToAssetFeature,
  mapDFDConnectionsToAssetFeature,
  mapDFDElementsToAssetFeature,
} from "../utils/dfd-to-asset-mapper";
import { buildAssetHazardLinks } from "../utils/build-asset-hazard-links";
import { buildAssetDataReference } from "../utils/build-asset-data-reference";
import { resolveDfdGraph } from "../utils/resolve-dfd-graph";
import { purgeAssetFromProject } from "./asset-deletion";

const normDesc = (s: string | undefined): string | undefined =>
  s && s.trim().length > 0 ? s : undefined;

export interface DfdUpdateOutcome {
  patch: Partial<Project> & { id: string };
  /** A2A operations the relations service refused (to tell the user). */
  rejectedA2AOps: readonly { op: A2AOp; reason: A2ARejection }[];
}

export function buildDfdUpdatePatch(
  current: Project,
  updates: DFDUpdateResult,
): Partial<Project> & { id: string } {
  return buildDfdUpdate(current, updates).patch;
}

export function buildDfdUpdate(
  current: Project,
  updates: DFDUpdateResult,
): DfdUpdateOutcome {
  const graph =
    updates.dfd?.graph ??
    current.dfd?.graph ??
    resolveDfdGraph({ ...current.dfd, ...updates.dfd } as Project["dfd"]);
  if (!graph) {
    throw new Error(
      "[DFD] Invariant violation: graph must exist after DFD update",
    );
  }

  // Merge the incoming DFD changes — the new single source of truth.
  const dfd = { ...current.dfd, ...updates.dfd, graph };

  // 1) Asset-sync FIRST. Reconcile the asset store against the new DFD so
  //    newly drawn elements exist as linked assets BEFORE threats sync —
  //    otherwise new-element threats would resolve empty linkedAssetIds.
  //    Mirrors the canonical DFD→Assets sync in handleHazardsUpdate.
  let assets = current.assets;
  if (dfd.assets && current.assets) {
    const { assetData } = syncFromDFD(
      current.assets,
      mapDFDAssetsToAssetFeature(
        dfd.assets,
        dfd.elements ?? [],
        dfd.connections ?? [],
      ),
      mapDFDElementsToAssetFeature(dfd.elements ?? []),
      mapDFDConnectionsToAssetFeature(dfd.connections ?? []),
    );

    // syncFromDFD deliberately never touches `description` (see
    // asset-sync-service.ts) — that was previously the sole
    // responsibility of the now-removed useBidirectionalAssetSync.
    // Mirror it here explicitly, synchronously, in the same
    // updateProject call — symmetric to the Asset→DFD mirroring added
    // in handleAssetsUpdate. Without this, a description edited in the
    // DFD tab never reaches the Assets tab.
    const dfdAssetsList = dfd.assets;
    assets = {
      ...assetData,
      assets: assetData.assets.map((asset) => {
        const dfdAsset = dfdAssetsList.find((a) => a.id === asset.id);
        if (!dfdAsset) return asset;
        const newDesc = normDesc(dfdAsset.description);
        if (newDesc === normDesc(asset.properties?.description)) {
          return asset;
        }
        return {
          ...asset,
          properties: { ...asset.properties, description: newDesc },
        };
      }),
    };
  }

  // 1b) Explicit deletions from the DFD tab. The DFD already lacks the
  //     asset (the tab stripped it and its relations), but syncFromDFD
  //     never removes store records — purge the remaining holders here,
  //     or the asset stays visible in the Asset/Hazard tabs.
  let hazards = current.hazards;
  let risks = current.risks;
  for (const assetId of updates.deletedAssetIds ?? []) {
    try {
      const purged = purgeAssetFromProject(
        { ...current, dfd: dfd as Project["dfd"], assets, hazards, risks },
        assetId,
      );
      ({ assets, hazards, risks } = purged);
    } catch (err) {
      // The DFD confirm dialog blocks this case; reaching it means a
      // caller bypassed the dialog. Keep the other stores untouched.
      console.error("[DFD] asset deletion not propagated:", err);
    }
  }

  // 1c) Asset-to-asset operations (relation dialog, DFD import) — the single
  //     write path to the canonical list (AR-5). Applied after the sync and
  //     the deletions, so imported assets exist and deleted ones are gone.
  let rejectedA2AOps: DfdUpdateOutcome["rejectedA2AOps"] = [];
  if (updates.a2aOps?.length && assets) {
    const groups = new Map(
      assets.assets.map((a) => [a.id, a.assetGroup as AssetGroup]),
    );
    const base = assets.relations ?? [];
    const result = applyA2AOps(
      base,
      updates.a2aOps,
      (id) => groups.get(id),
      () => crypto.randomUUID(),
    );
    rejectedA2AOps = result.rejected;
    if (result.relations !== base) {
      assets = { ...assets, relations: result.relations };
    }
  }

  // 2) Build the enriched asset reference from the freshly-synced store.
  const assetDataRef = assets
    ? buildAssetDataReference(
        assets.assets,
        buildAssetHazardLinks(hazards ?? null),
        assets.configuration?.impactScale ?? "4-level",
      )
    : undefined;

  // 3) Threat-sync SECOND, against the fresh graph and asset reference.
  const threats = syncThreatsWithGraph(
    current.threats ?? null,
    toGraphReference(graph),
    assetDataRef,
    regulationPresetFromTags(current.info?.tags ?? EMPTY_PROJECT_TAGS) ===
      "iso-21434",
  );


  const patch = {
    id: current.id,
    dfd,
    assets, // persist the reconciled asset store too
    phaseStatus: updates.phaseStatus,
    threats,
    ...(updates.deletedAssetIds?.length ? { hazards, risks } : {}),
  };
  return { patch, rejectedA2AOps };
}
