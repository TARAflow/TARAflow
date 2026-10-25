// features/hazards/services/hazard-reimport.ts
//
// Hazard import HI-10, part 2 (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): a re-import reconciles the sheet with the items an
// earlier import of the same profile created, instead of appending them
// again. Pure.
//
//   new        → created (with its import-derived edges)
//   changed    → imported fields and import-derived person edges updated,
//                flagged "changed" (importMeta.importStatus)
//   unchanged  → untouched (a "removed" flag is cleared: the row is back)
//   removed    → kept, flagged "removed" — never deleted automatically
//
// Analyst-owned data stays: rationale, combination type, review state, manual
// edges, cause edges, bowtie; the label follows the description only while
// the analyst has not changed it.

import { isContributesTo, isEndangers, type HazardItem, type HazardRelation } from "shared";
import { shortLabel } from "./hazard-bridge";
import type { HazardData } from "../models/hazard-data-types";

export type ImportStatus = "changed" | "removed";

/** Keys of importMeta that are bookkeeping, not content of the source row. */
const BOOKKEEPING_KEYS = new Set(["profileId", "sourceFile", "importStatus", "importStatusSince"]);

export interface ReimportPlan {
  profileId: string;
  /** Incoming items without an earlier counterpart. */
  added: HazardItem[];
  changed: { existing: HazardItem; incoming: HazardItem }[];
  unchanged: HazardItem[];
  /** Earlier items whose row is no longer in the sheet. */
  removed: HazardItem[];
}

export interface IncomingImport {
  items: HazardItem[];
  relations: HazardRelation[];
}

const profileOf = (h: HazardItem) => h.importMeta?.profileId;
const fileOf = (h: HazardItem) => h.importMeta?.sourceFile;

/** What the source row says about the item — compared to detect a change. */
function content(item: HazardItem, edges: HazardRelation[]): string {
  const meta = Object.entries(item.importMeta ?? {})
    .filter(([k]) => !BOOKKEEPING_KEYS.has(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const persons = edges
    .filter(isEndangers)
    .filter((e) => e.from === item.id && e.provenance === "derived")
    .map((e) => `${e.to}:${JSON.stringify(e.impact)}`)
    .sort();
  return JSON.stringify([item.description ?? "", item.hazardType ?? "", item.physicalHazardPotential ?? "", meta, persons]);
}

/**
 * The earlier items this import reconciles with: the profile's items — only
 * those of the same file when the profile was used for several files.
 */
export function previousItemsOf(data: HazardData, profileId: string, fileName?: string): HazardItem[] {
  const ofProfile = data.hazards.filter((h) => profileOf(h) === profileId);
  const sameFile = fileName ? ofProfile.filter((h) => fileOf(h) === fileName) : [];
  return sameFile.length > 0 ? sameFile : ofProfile;
}

export function planReimport(
  data: HazardData,
  incoming: IncomingImport,
  profileId: string,
  fileName?: string,
): ReimportPlan {
  const previous = previousItemsOf(data, profileId, fileName);
  const byRef = new Map(previous.map((h) => [h.externalRef, h]));
  const seen = new Set<HazardItem>();
  const plan: ReimportPlan = { profileId, added: [], changed: [], unchanged: [], removed: [] };
  for (const item of incoming.items) {
    const existing = item.externalRef !== undefined ? byRef.get(item.externalRef) : undefined;
    if (!existing) {
      plan.added.push(item);
      continue;
    }
    seen.add(existing);
    if (content(existing, data.relations) === content({ ...item, id: existing.id }, retarget(incoming.relations, item.id, existing.id))) {
      plan.unchanged.push(existing);
    } else {
      plan.changed.push({ existing, incoming: item });
    }
  }
  plan.removed = previous.filter((h) => !seen.has(h));
  return plan;
}

/** The incoming item's edges, pointed at the existing item. */
function retarget(relations: HazardRelation[], from: string, to: string): HazardRelation[] {
  return relations.filter(isEndangers).filter((e) => e.from === from).map((e) => ({ ...e, from: to as never }));
}

function withStatus(item: HazardItem, status: ImportStatus | undefined, now: string): HazardItem {
  const meta = { ...(item.importMeta ?? {}) };
  if (status) {
    if (meta.importStatus !== status) meta.importStatusSince = now;
    meta.importStatus = status;
  } else {
    delete meta.importStatus;
    delete meta.importStatusSince;
  }
  return { ...item, importMeta: meta };
}

/** Clear the flag after the analyst reviewed the item. */
export function clearImportStatus(item: HazardItem): HazardItem {
  return withStatus(item, undefined, "");
}

/** "Update existing": apply the plan to the hazard data. */
export function applyReimport(
  data: HazardData,
  incoming: IncomingImport,
  plan: ReimportPlan,
  now: string,
): HazardData {
  const updates = new Map<string, HazardItem>();
  const replacedEdgesOf = new Set<string>();
  const newEdges: HazardRelation[] = [];

  for (const { existing, incoming: item } of plan.changed) {
    const labelWasDerived = existing.label === shortLabel(existing.description ?? "");
    const keep = { profileId: existing.importMeta?.profileId, sourceFile: item.importMeta?.sourceFile };
    const updated: HazardItem = {
      ...existing,
      description: item.description,
      hazardType: item.hazardType,
      physicalHazardPotential: item.physicalHazardPotential,
      ...(labelWasDerived ? { label: item.label } : {}),
      importMeta: Object.fromEntries(
        Object.entries({ ...item.importMeta, ...keep, importStatus: existing.importMeta?.importStatus, importStatusSince: existing.importMeta?.importStatusSince })
          .filter(([, v]) => v !== undefined) as [string, string][],
      ),
    };
    updates.set(existing.id, withStatus(updated, "changed", now));
    replacedEdgesOf.add(existing.id);
    newEdges.push(...retarget(incoming.relations, item.id, existing.id));
  }
  for (const existing of plan.unchanged) {
    if (existing.importMeta?.importStatus === "removed") updates.set(existing.id, withStatus(existing, undefined, now));
  }
  for (const existing of plan.removed) {
    updates.set(existing.id, withStatus(existing, "removed", now));
  }

  const addedIds = new Set(plan.added.map((h) => h.id as string));
  const relations = [
    ...data.relations.filter(
      (r) => !(isEndangers(r) && replacedEdgesOf.has(r.from) && r.provenance === "derived"),
    ),
    ...newEdges,
    // every edge of a new item: its person edges and its cause edges
    ...incoming.relations.filter((r) =>
      isEndangers(r) ? addedIds.has(r.from) : isContributesTo(r) && addedIds.has(r.to),
    ),
  ];

  return {
    ...data,
    hazards: [...data.hazards.map((h) => updates.get(h.id) ?? h), ...plan.added],
    relations,
  };
}
