// app/services/asset-deletion.ts
//
// Deleting an asset is ONE project-wide operation. The asset store (SSOT) never
// loses records as a side effect of a mirror diff (see syncFromDFD), so the
// deletion must be explicit and must reach every holder of a reference:
//
//   assets.assets            the record itself
//   dfd                      record, element/connection relations, A2A relations
//   hazards.relations        contributes_to.from / endangers.to
//   risks[].linkedAssetIds   cached from the threat; stripped so no stale id stays
//
// threats[].linkedAssetIds is re-derived by syncThreatsWithGraph from the new
// graph — the caller runs that sync, this module stays free of it.
//
// Attack trees anchored on the asset BLOCK deletion (collectAssetUsage reports
// them); purgeAssetFromProject refuses rather than leave a dangling anchor.

import type { Project } from "app/models/project-types";
import type { AssetUsage } from "shared";
import { isContributesTo, isEndangers } from "shared";
import {
  countDfdAssetReferences,
  finalizeDfd,
  stripAssetFromDfd,
} from "features/dfd";
import { getTreesForAsset } from "features/attacktree";

export function collectAssetUsage(
  project: Project,
  assetId: string,
): AssetUsage {
  const dfdCounts = countDfdAssetReferences(project.dfd, assetId);
  const hazardRelations = (project.hazards?.relations ?? []).filter(
    (r) =>
      (isContributesTo(r) && r.from === assetId) ||
      (isEndangers(r) && r.to === assetId),
  ).length;
  const blockingAttackTrees = project.attackTrees
    ? getTreesForAsset(project.attackTrees, assetId).map((t) => ({
        id: t.id,
        name: t.name,
      }))
    : [];
  return {
    dfdRelations: dfdCounts.elementRelations,
    assetToAssetRelations: dfdCounts.assetToAssetRelations,
    hazardRelations,
    blockingAttackTrees,
  };
}

export type AssetPurge = Pick<Project, "assets" | "dfd" | "hazards" | "risks">;

export class AssetDeletionBlockedError extends Error {
  constructor(readonly usage: AssetUsage) {
    super(
      `Asset is the anchor of ${usage.blockingAttackTrees.length} attack tree(s)`,
    );
    this.name = "AssetDeletionBlockedError";
  }
}

/**
 * Removes the asset from every store. Idempotent: holders that no longer
 * reference it (e.g. the DFD, when the DFD tab already stripped it) are left
 * content-equal. Throws AssetDeletionBlockedError while attack trees anchor it.
 */
export function purgeAssetFromProject(
  project: Project,
  assetId: string,
): AssetPurge {
  const usage = collectAssetUsage(project, assetId);
  if (usage.blockingAttackTrees.length > 0) {
    throw new AssetDeletionBlockedError(usage);
  }
  const now = new Date().toISOString();

  const assets = project.assets?.assets.some((a) => a.id === assetId)
    ? {
        ...project.assets,
        assets: project.assets.assets.filter((a) => a.id !== assetId),
        lastModified: now,
      }
    : project.assets;

  const dfd = project.dfd
    ? finalizeDfd(stripAssetFromDfd(project.dfd, assetId))
    : project.dfd;

  const hazards =
    project.hazards && usage.hazardRelations > 0
      ? {
          ...project.hazards,
          relations: project.hazards.relations.filter(
            (r) =>
              !(isContributesTo(r) && r.from === assetId) &&
              !(isEndangers(r) && r.to === assetId),
          ),
          lastModified: now,
        }
      : project.hazards;

  const risks =
    project.risks &&
    project.risks.risks.some((r) => r.linkedAssetIds?.includes(assetId))
      ? {
          ...project.risks,
          risks: project.risks.risks.map((r) =>
            r.linkedAssetIds?.includes(assetId)
              ? {
                  ...r,
                  linkedAssetIds: r.linkedAssetIds.filter(
                    (id) => id !== assetId,
                  ),
                }
              : r,
          ),
          lastModified: now,
        }
      : project.risks;

  return { assets, dfd, hazards, risks };
}
