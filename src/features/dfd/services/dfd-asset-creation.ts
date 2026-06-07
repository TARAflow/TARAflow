// features/dfd/services/dfd-asset-creation.ts
//
// Folds assets created elsewhere (e.g. the Hazard Bowtie quick-capture) into
// dfd.assets — the canonical asset store. Pure: appends + bumps lastModified,
// deduping by id. No graph rebuild needed: freshly created assets are unplaced
// (no element relations), so dfd.graph/stats stay valid and self-heal on the
// next DFD edit. Widens the shared CreatedAsset seed to a DFDAsset.
//
// project.dfd is genuinely nullable (the Hazard phase precedes the DFD, and no
// eager init exists). So this helper accepts null and materialises a minimal
// empty DFD when needed — dfd.assets is the only place a created asset can live.

import type { CreatedAsset } from "shared";
import type { DFDData } from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";
import type { AssetGroup } from "../models/asset-relation-types";

/**
 * Minimal valid empty DFD for the "no DFD yet" case. graph/stats/xml are
 * derived later by the DFD service/parser, so they are intentionally omitted.
 *
 * NOTE: reconcile with the DFDData type — if DFDData has further *required*
 * fields, add their empty defaults here.
 */
function createEmptyDFD(): DFDData {
  return {
    elements: [],
    connections: [],
    assets: [],
    lastModified: new Date().toISOString(),
  } as DFDData;
}

export function addCreatedAssets(
  dfd: DFDData | null,
  created: readonly CreatedAsset[],
): DFDData {
  const base = dfd ?? createEmptyDFD();
  if (created.length === 0) return base;

  const existing = new Set(base.assets.map((a) => a.id));
  const additions: DFDAsset[] = created
    .filter((c) => !existing.has(c.id))
    .map((c) => ({
      id: c.id,
      displayId: c.displayId,
      name: c.name,
      // `as AssetGroup`: the shared seed is group-agnostic. "environment" only
      // becomes a real AssetGroup with Phase-1 change 2 — see safety-independence doc.
      assetGroup: c.assetGroup as AssetGroup,
      ...(c.protectionNeed ? { protectionNeed: c.protectionNeed } : {}),
      linkedElements: [],
    }));

  if (additions.length === 0) return base;
  return {
    ...base,
    assets: [...base.assets, ...additions],
    lastModified: new Date().toISOString(),
  };
}
