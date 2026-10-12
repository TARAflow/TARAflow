// ==================== A2A RELATION SERVICE ====================
// The single write path for asset-to-asset relations (AR-5). Pure functions,
// no React, no project access: callers pass the current relation list and a
// group lookup, and get a new list (or a rejection) back. Side panel, detail
// panel and graph canvas all go through these functions.
//
// Asset groups are never stored on a relation (AR-2); `groupOf` resolves them
// from the assets at call time, so a group change is seen immediately (B5).

import type { AssetGroup, A2ARelationType } from "../models/asset-group-types";
import type {
  A2ARelation,
  A2ARelationAttributes,
} from "../models/a2a-relation-types";
import { getA2AMirror, getAllowedA2ARelations } from "../models/asset-a2a-rules";

/** Resolves an asset id to its group; undefined = asset does not exist. */
export type AssetGroupLookup = (assetId: string) => AssetGroup | undefined;

export type A2ARejection =
  | "source_missing"
  | "target_missing"
  | "self_relation"
  | "type_not_allowed"
  | "duplicate"
  | "relation_missing";

export type A2AResult =
  | { readonly ok: true; readonly relations: A2ARelation[] }
  | { readonly ok: false; readonly reason: A2ARejection };

export interface NewA2ARelation extends A2ARelationAttributes {
  readonly sourceAssetId: string;
  readonly targetAssetId: string;
  readonly relationType: A2ARelationType;
}

// ==================== ORDER ====================

/**
 * Deterministic order for storage and diffing (AR-9): source, target, type,
 * then id. Returns a new array.
 */
export function sortA2ARelations(
  relations: readonly A2ARelation[],
): A2ARelation[] {
  const key = (r: A2ARelation) =>
    [r.sourceAssetId, r.targetAssetId, r.relationType, r.id] as const;
  return [...relations].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
}

// ==================== CHECKS ====================

function checkEndpoints(
  sourceAssetId: string,
  targetAssetId: string,
  relationType: A2ARelationType,
  groupOf: AssetGroupLookup,
): A2ARejection | null {
  const sourceGroup = groupOf(sourceAssetId);
  if (!sourceGroup) return "source_missing";
  const targetGroup = groupOf(targetAssetId);
  if (!targetGroup) return "target_missing";
  if (sourceAssetId === targetAssetId) return "self_relation";
  if (!getAllowedA2ARelations(sourceGroup, targetGroup).includes(relationType)) {
    return "type_not_allowed";
  }
  return null;
}

function isDuplicate(
  relations: readonly A2ARelation[],
  candidate: Pick<A2ARelation, "sourceAssetId" | "targetAssetId" | "relationType">,
  ignoreId?: string,
): boolean {
  return relations.some(
    (r) =>
      r.id !== ignoreId &&
      r.sourceAssetId === candidate.sourceAssetId &&
      r.targetAssetId === candidate.targetAssetId &&
      r.relationType === candidate.relationType,
  );
}

// ==================== MUTATIONS ====================

/** Adds a relation. `newId` is injected so the function stays pure. */
export function addA2ARelation(
  relations: readonly A2ARelation[],
  input: NewA2ARelation,
  groupOf: AssetGroupLookup,
  newId: () => string,
): A2AResult {
  const rejection = checkEndpoints(
    input.sourceAssetId,
    input.targetAssetId,
    input.relationType,
    groupOf,
  );
  if (rejection) return { ok: false, reason: rejection };
  if (isDuplicate(relations, input)) return { ok: false, reason: "duplicate" };
  const relation: A2ARelation = { ...input, id: newId() };
  return { ok: true, relations: sortA2ARelations([...relations, relation]) };
}

/** Removes one relation by id. */
export function removeA2ARelation(
  relations: readonly A2ARelation[],
  relationId: string,
): A2AResult {
  if (!relations.some((r) => r.id === relationId)) {
    return { ok: false, reason: "relation_missing" };
  }
  return { ok: true, relations: relations.filter((r) => r.id !== relationId) };
}

/** Changes attributes; endpoints and type stay (that is a new edge). */
export function updateA2ARelationAttributes(
  relations: readonly A2ARelation[],
  relationId: string,
  attributes: Partial<A2ARelationAttributes>,
): A2AResult {
  const index = relations.findIndex((r) => r.id === relationId);
  if (index < 0) return { ok: false, reason: "relation_missing" };
  const next = [...relations];
  next[index] = { ...relations[index], ...attributes };
  return { ok: true, relations: next };
}

/** Changes the relation type of an existing edge, keeping its id. */
export function changeA2ARelationType(
  relations: readonly A2ARelation[],
  relationId: string,
  relationType: A2ARelationType,
  groupOf: AssetGroupLookup,
): A2AResult {
  const current = relations.find((r) => r.id === relationId);
  if (!current) return { ok: false, reason: "relation_missing" };
  const rejection = checkEndpoints(
    current.sourceAssetId,
    current.targetAssetId,
    relationType,
    groupOf,
  );
  if (rejection) return { ok: false, reason: rejection };
  const changed = { ...current, relationType };
  if (isDuplicate(relations, changed, relationId)) {
    return { ok: false, reason: "duplicate" };
  }
  return {
    ok: true,
    relations: sortA2ARelations(
      relations.map((r) => (r.id === relationId ? changed : r)),
    ),
  };
}

// ==================== CASCADE ====================

/** Relations touching an asset, incoming and outgoing (delete dialog, AR-8). */
export function relationsOfAsset(
  relations: readonly A2ARelation[],
  assetId: string,
): { outgoing: A2ARelation[]; incoming: A2ARelation[] } {
  return {
    outgoing: relations.filter((r) => r.sourceAssetId === assetId),
    incoming: relations.filter((r) => r.targetAssetId === assetId),
  };
}

/** Cascade on asset delete: drops every relation touching the asset. */
export function removeA2ARelationsOfAsset(
  relations: readonly A2ARelation[],
  assetId: string,
): { relations: A2ARelation[]; removed: A2ARelation[] } {
  const removed = relations.filter(
    (r) => r.sourceAssetId === assetId || r.targetAssetId === assetId,
  );
  return {
    relations: relations.filter(
      (r) => r.sourceAssetId !== assetId && r.targetAssetId !== assetId,
    ),
    removed,
  };
}

// ==================== VALIDATION ====================

export interface A2AFinding {
  readonly relationId: string;
  readonly reason: Exclude<A2ARejection, "duplicate" | "relation_missing">;
}

/**
 * Checks every relation against the current assets and rules. Used after an
 * asset group change (B5, in- and outgoing) and on load. Reports, never
 * deletes: whether to drop or fix an invalid edge is the analyst's decision.
 */
export function validateA2ARelations(
  relations: readonly A2ARelation[],
  groupOf: AssetGroupLookup,
): A2AFinding[] {
  const findings: A2AFinding[] = [];
  for (const r of relations) {
    const reason = checkEndpoints(
      r.sourceAssetId,
      r.targetAssetId,
      r.relationType,
      groupOf,
    );
    if (reason) {
      findings.push({
        relationId: r.id,
        reason: reason as A2AFinding["reason"],
      });
    }
  }
  return findings;
}

// ==================== MIRROR ====================

/**
 * The existing relation in the opposite direction that states the same fact
 * as `candidate` (see A2A_MIRROR_PAIRS), or undefined. A hint for the UI —
 * the add itself is not rejected.
 */
export function findMirrorRelation(
  relations: readonly A2ARelation[],
  candidate: Pick<A2ARelation, "sourceAssetId" | "targetAssetId" | "relationType">,
  groupOf: AssetGroupLookup,
): A2ARelation | undefined {
  const sourceGroup = groupOf(candidate.sourceAssetId);
  const targetGroup = groupOf(candidate.targetAssetId);
  if (!sourceGroup || !targetGroup) return undefined;
  const mirror = getA2AMirror({
    sourceGroup,
    targetGroup,
    relationType: candidate.relationType,
  });
  if (!mirror) return undefined;
  return relations.find(
    (r) =>
      r.sourceAssetId === candidate.targetAssetId &&
      r.targetAssetId === candidate.sourceAssetId &&
      r.relationType === mirror.counterpart.relationType,
  );
}

// ==================== OPERATIONS ====================
// What a UI (relation dialog, DFD import, later the graph canvas) asks for.
// Operations are data so they can travel with a DFD update and be applied by
// the app layer to the canonical list — the single write path (AR-5).

export type A2AOp =
  | { readonly kind: "add"; readonly relation: NewA2ARelation }
  | { readonly kind: "remove"; readonly relationId: string }
  | {
      readonly kind: "update";
      readonly relationId: string;
      readonly attributes: Partial<A2ARelationAttributes>;
    };

export interface A2AOpsResult {
  readonly relations: A2ARelation[];
  readonly rejected: readonly { op: A2AOp; reason: A2ARejection }[];
}

/**
 * Applies operations in order. A rejected operation is skipped and reported;
 * the others still apply. Returns the input list itself when nothing changed.
 */
export function applyA2AOps(
  relations: readonly A2ARelation[],
  ops: readonly A2AOp[],
  groupOf: AssetGroupLookup,
  newId: () => string,
): A2AOpsResult {
  let current = relations as A2ARelation[];
  const rejected: { op: A2AOp; reason: A2ARejection }[] = [];
  for (const op of ops) {
    const res =
      op.kind === "add"
        ? addA2ARelation(current, op.relation, groupOf, newId)
        : op.kind === "remove"
          ? removeA2ARelation(current, op.relationId)
          : updateA2ARelationAttributes(current, op.relationId, op.attributes);
    if (res.ok) current = res.relations;
    else rejected.push({ op, reason: res.reason });
  }
  return { relations: current, rejected };
}
