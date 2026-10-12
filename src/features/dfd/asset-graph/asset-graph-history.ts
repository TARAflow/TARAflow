// features/dfd/asset-graph/asset-graph-history.ts
//
// Undo/redo for link changes made in the asset graph (FR-E9, phase 3).
//
// History entries do not store relation ids: an undone delete re-creates the
// link with a NEW id, so a later redo could not find the old one. Instead
// each step names the link by its key (source, target, type) — unique,
// because the relations service rejects exact duplicates — and is resolved
// to an operation against the current links when it runs.
//
// Scope: link changes (create, delete, attributes). Asset creation and
// deletion run through the DFD's asset path with cascades and are not part
// of this history.

import type { A2AOp, A2ARelation, A2ARelationAttributes, NewA2ARelation } from "shared";

export interface LinkKey {
  readonly sourceAssetId: string;
  readonly targetAssetId: string;
  readonly relationType: string;
}

export type HistoryStep =
  | { readonly kind: "add"; readonly relation: NewA2ARelation }
  | { readonly kind: "remove"; readonly key: LinkKey }
  | { readonly kind: "update"; readonly key: LinkKey; readonly attributes: Partial<A2ARelationAttributes> };

export interface HistoryEntry {
  readonly redo: readonly HistoryStep[];
  readonly undo: readonly HistoryStep[];
}

export const HISTORY_LIMIT = 50;

const ATTRIBUTE_KEYS = [
  "stepOrder",
  "analyticallyActive",
  "rationale",
  "notes",
  "safety",
  "degradationMode",
  "degradationDescription",
] as const;

export function keyOf(r: LinkKey): LinkKey {
  return { sourceAssetId: r.sourceAssetId, targetAssetId: r.targetAssetId, relationType: r.relationType };
}

function find(relations: readonly A2ARelation[], key: LinkKey): A2ARelation | undefined {
  return relations.find(
    (r) =>
      r.sourceAssetId === key.sourceAssetId &&
      r.targetAssetId === key.targetAssetId &&
      r.relationType === key.relationType,
  );
}

/** The link as it would have to be created again (all attributes, no id). */
function recreation(r: A2ARelation): NewA2ARelation {
  const out: Record<string, unknown> = { ...keyOf(r) };
  for (const k of ATTRIBUTE_KEYS) if (r[k] !== undefined) out[k] = r[k];
  return out as unknown as NewA2ARelation;
}

/** History entry for creating a link. */
export function entryForAdd(relation: NewA2ARelation): HistoryEntry {
  return { redo: [{ kind: "add", relation }], undo: [{ kind: "remove", key: keyOf(relation) }] };
}

/** History entry for deleting a link (keeps everything to re-create it). */
export function entryForRemove(relation: A2ARelation): HistoryEntry {
  return {
    redo: [{ kind: "remove", key: keyOf(relation) }],
    undo: [{ kind: "add", relation: recreation(relation) }],
  };
}

/** History entry for changing attributes; undo restores the old values. */
export function entryForUpdate(
  relation: A2ARelation,
  attributes: Partial<A2ARelationAttributes>,
): HistoryEntry {
  const previous: Record<string, unknown> = {};
  for (const k of Object.keys(attributes)) {
    previous[k] = (relation as unknown as Record<string, unknown>)[k];
  }
  const key = keyOf(relation);
  return {
    redo: [{ kind: "update", key, attributes }],
    undo: [{ kind: "update", key, attributes: previous as Partial<A2ARelationAttributes> }],
  };
}

/**
 * Turns steps into operations against the current links. A step whose link
 * is gone (removed elsewhere meanwhile) is skipped; `complete` says whether
 * every step could be resolved.
 */
export function resolveSteps(
  steps: readonly HistoryStep[],
  relations: readonly A2ARelation[],
): { ops: A2AOp[]; complete: boolean } {
  const ops: A2AOp[] = [];
  let complete = true;
  for (const step of steps) {
    if (step.kind === "add") {
      if (find(relations, keyOf(step.relation))) {
        complete = false; // exists already
        continue;
      }
      ops.push({ kind: "add", relation: step.relation });
      continue;
    }
    const current = find(relations, step.key);
    if (!current) {
      complete = false;
      continue;
    }
    ops.push(
      step.kind === "remove"
        ? { kind: "remove", relationId: current.id }
        : { kind: "update", relationId: current.id, attributes: step.attributes },
    );
  }
  return { ops, complete };
}

export interface HistoryState {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
}

export const EMPTY_HISTORY: HistoryState = { past: [], future: [] };

/** A new change: on top of the past, the redo branch is dropped. */
export function pushEntry(h: HistoryState, entry: HistoryEntry): HistoryState {
  return { past: [...h.past, entry].slice(-HISTORY_LIMIT), future: [] };
}

export function popUndo(h: HistoryState): { entry?: HistoryEntry; next: HistoryState } {
  const entry = h.past[h.past.length - 1];
  if (!entry) return { next: h };
  return { entry, next: { past: h.past.slice(0, -1), future: [entry, ...h.future] } };
}

export function popRedo(h: HistoryState): { entry?: HistoryEntry; next: HistoryState } {
  const entry = h.future[0];
  if (!entry) return { next: h };
  return { entry, next: { past: [...h.past, entry], future: h.future.slice(1) } };
}
