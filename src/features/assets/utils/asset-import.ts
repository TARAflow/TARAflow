// features/assets/utils/asset-import.ts
//
// Asset import (B14): imported assets are ADDED to the project. An imported
// asset that is the same as one already in the project is a conflict, and
// the analyst decides per asset: keep the project's asset, or replace its
// content with the imported one. Nothing is ever deleted.
//
// "Same asset":
//   1. the same id (a re-import of an own export, or a copy of the project);
//   2. otherwise the same group and the same name (trimmed, case-insensitive)
//      — the usual case between two projects, whose ids differ.
// Each project asset is matched at most once.
//
// Replacing keeps the project asset's identity — id, displayId, group,
// source — and everything derived from the project (linked DFD elements,
// physical impact from the DFD or hazards). Every reference into the project
// (DFD relations, risks, hazards) therefore stays valid. All other content
// comes from the file.
//
// Keeping means nothing of the file applies to that asset — neither content
// nor links. Added assets keep their id unless it is taken; their displayId
// is minted anew when it is taken in the project. Links in the file are
// re-pointed to the project's ids (a replaced asset is the project's asset).
// Pure; the caller writes the result and turns the links into A2A operations.

import { generateAssetId } from "shared/services/asset-creation";
import type { Asset, AssetConfiguration, AssetData } from "../models/asset-types";

export type ImportDecision = "keep" | "replace";

export interface ImportConflict {
  readonly imported: Asset;
  readonly existing: Asset;
  readonly matchedBy: "id" | "name";
}

export interface AssetImportPlan {
  /** Imported assets that are new to the project. */
  readonly added: readonly Asset[];
  /** Imported assets that match a project asset. */
  readonly conflicts: readonly ImportConflict[];
}

const nameKey = (a: Pick<Asset, "assetGroup" | "name">) =>
  `${a.assetGroup}\u0000${(a.name ?? "").trim().toLowerCase()}`;

export function planAssetImport(existing: readonly Asset[], imported: readonly Asset[]): AssetImportPlan {
  const byId = new Map(existing.map((a) => [a.id, a]));
  const byName = new Map<string, Asset>();
  for (const a of existing) if ((a.name ?? "").trim() && !byName.has(nameKey(a))) byName.set(nameKey(a), a);
  const taken = new Set<string>();
  const added: Asset[] = [];
  const conflicts: ImportConflict[] = [];
  for (const asset of imported) {
    const sameId = byId.get(asset.id);
    if (sameId && !taken.has(sameId.id)) {
      taken.add(sameId.id);
      conflicts.push({ imported: asset, existing: sameId, matchedBy: "id" });
      continue;
    }
    const sameName = (asset.name ?? "").trim() ? byName.get(nameKey(asset)) : undefined;
    if (sameName && !taken.has(sameName.id)) {
      taken.add(sameName.id);
      conflicts.push({ imported: asset, existing: sameName, matchedBy: "name" });
      continue;
    }
    added.push(asset);
  }
  return { added, conflicts };
}

/** Ratings for exactly the configuration's criteria (missing → 0). */
function alignRatings(asset: Asset, configuration: AssetConfiguration): Asset["impactRatings"] {
  return configuration.impactCriteria.map(
    ({ id }) => asset.impactRatings?.find((r) => r.criterionId === id) ?? { criterionId: id, value: 0 },
  );
}

export interface AssetImportResult {
  /** Assets of the project after the import (recalculation is the caller's). */
  readonly assets: Asset[];
  /** Ids of assets that were added or replaced — to recalculate. */
  readonly touchedIds: readonly string[];
  /** File id → project id for every added or replaced asset (kept: none). */
  readonly idMap: ReadonlyMap<string, string>;
  readonly counts: { readonly added: number; readonly replaced: number; readonly kept: number };
}

export function applyAssetImport(
  assetData: Pick<AssetData, "assets" | "configuration">,
  plan: AssetImportPlan,
  decisions: Readonly<Record<string, ImportDecision>>,
  now: string = new Date().toISOString(),
): AssetImportResult {
  const { configuration } = assetData;
  const idMap = new Map<string, string>();
  const touched: string[] = [];
  let replaced = 0;
  let kept = 0;

  const replacements = new Map<string, Asset>();
  for (const c of plan.conflicts) {
    if ((decisions[c.imported.id] ?? "keep") === "replace") {
      // Links of the file now attach to the project's asset.
      idMap.set(c.imported.id, c.existing.id);
      replaced += 1;
      touched.push(c.existing.id);
      replacements.set(c.existing.id, {
        ...c.imported,
        // Identity and everything derived from THIS project stay.
        id: c.existing.id,
        displayId: c.existing.displayId,
        numericId: c.existing.numericId,
        assetGroup: c.existing.assetGroup,
        source: c.existing.source,
        syncedWithDFD: c.existing.syncedWithDFD,
        linkedDFDElements: c.existing.linkedDFDElements,
        physicalImpact: c.existing.physicalImpact,
        physicalImpactSource: c.existing.physicalImpactSource,
        physicalImpactRationale: c.existing.physicalImpactRationale,
        created: c.existing.created,
        impactRatings: alignRatings(c.imported, configuration),
        lastModified: now,
      });
    } else {
      kept += 1;
    }
  }

  const assets = assetData.assets.map((a) => replacements.get(a.id) ?? a);
  const ids = new Set(assets.map((a) => a.id));
  const displayIds = assets.map((a) => a.displayId ?? a.id);
  for (const imported of plan.added) {
    const id = ids.has(imported.id) ? crypto.randomUUID() : imported.id;
    const wanted = imported.displayId ?? "";
    const displayId =
      wanted && !displayIds.includes(wanted) ? wanted : generateAssetId(displayIds, imported.assetGroup);
    const numericId = parseInt(displayId.split("-").pop() ?? "", 10);
    // Derived from the OTHER project: links to its DFD, its hazards.
    const ownPhysical = imported.physicalImpactSource === "manual";
    assets.push({
      ...imported,
      id,
      displayId,
      numericId: Number.isNaN(numericId) ? imported.numericId : numericId,
      linkedDFDElements: [],
      physicalImpact: ownPhysical ? imported.physicalImpact : undefined,
      physicalImpactSource: ownPhysical ? "manual" : undefined,
      physicalImpactRationale: ownPhysical ? imported.physicalImpactRationale : undefined,
      impactRatings: alignRatings(imported, configuration),
      created: now,
      lastModified: now,
    });
    ids.add(id);
    displayIds.push(displayId);
    idMap.set(imported.id, id);
    touched.push(id);
  }

  return { assets, touchedIds: touched, idMap, counts: { added: plan.added.length, replaced, kept } };
}

/** Links in the file, re-pointed to the project's ids; links to assets not imported are dropped. */
export function remapImportedRelations(
  relations: readonly unknown[] | undefined,
  idMap: ReadonlyMap<string, string>,
): unknown[] {
  const out: unknown[] = [];
  for (const raw of (relations ?? []) as Record<string, unknown>[]) {
    const s = idMap.get(raw?.sourceAssetId as string);
    const t = idMap.get(raw?.targetAssetId as string);
    if (!s || !t || s === t) continue;
    out.push({ ...raw, sourceAssetId: s, targetAssetId: t });
  }
  return out;
}
