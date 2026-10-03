// ==================== ASSET-TO-ASSET RULES ====================
// Rule set for asset-to-asset (A2A, layer 2) relations.
//
// Lives in shared (not features/dfd) because both the DFD asset panel and the
// asset graph view (features/assets) need it, and features must not import
// each other (asset-graph-view-requirements.md, AR-4 / finding B3).
//
// Pure data and pure functions — no React, no i18n binding.

import type { AssetGroup, A2ARelationType } from "./asset-group-types";

// ==================== ALLOWED RELATIONS ====================
// Core Rules matrix: sourceGroup × targetGroup → allowed A2ARelationType[]
//
// Derived from: taraflow-asset-zu-asset-beziehungen.md §3 Core Rules
// KERN relations are marked explicitly in KERN_A2A_RELATIONS below; the order
// within each array carries no meaning.
//
// Usage:
//   getAllowedA2ARelations(sourceGroup, targetGroup) → A2ARelationType[]
//
// Note: Empty array = no defined relation for this pair (not modelled in Core Rules)

type A2ARelMatrix = Partial<Record<AssetGroup, A2ARelationType[]>>;

export const ALLOWED_A2A_RELATIONS: Record<AssetGroup, A2ARelMatrix> = {
  data: {
    data: ["derives_from", "aggregates", "supersedes"],
    process: ["required_by", "consumed_by", "configures"],
    function: ["required_by", "configures"],
    system: ["configures"],
    human: ["affects_privacy", "exposes"],
  },
  function: {
    function: ["depends_on", "supersedes", "calls"],
    data: ["creates", "reads", "modifies", "deletes"],
    process: ["implemented_by", "triggers"],
    system: ["implemented_by", "depends_on"],
    human: ["endangers", "operated_by"],
  },
  process: {
    process: ["triggers", "depends_on", "suspends"],
    function: ["implements", "invokes"],
    system: ["runs_on", "depends_on"],
    human: ["endangers", "affects_privacy", "operated_by"],
    infrastructure: ["hosted_on"],
    environment: ["endangers", "contaminates"],
  },
  system: {
    system: ["depends_on", "integrates"],
    function: ["implements", "depends_on"],
    infrastructure: ["hosted_on", "powered_by"],
  },
  infrastructure: {
    infrastructure: ["powers", "houses"],
    physical: ["houses"],
    environment: ["endangers"],
  },
  physical: {
    physical: ["mechanically_linked", "powered_by"],
    function: ["enables", "triggers"],
    system: ["hosts", "controlled_by"],
    infrastructure: ["connected_to", "powered_by", "located_in"],
    human: ["endangers", "exposes"],
    environment: ["endangers"],
  },
  service: {
    service: ["depends_on", "delegates_to"],
    function: ["provides", "depends_on"],
    data: ["exposes", "consumes"],
    system: ["integrates_with", "monitors"],
    human: ["affects_privacy", "endangers"],
    environment: ["endangers"],
    infrastructure: ["hosted_on", "depends_on"],
  },
  human: {
    human: ["manages", "reports_to"],
    process: ["responsible_for", "authorized_for"],
    function: ["authorized_for", "responsible_for"],
    physical: ["owns", "responsible_for", "accesses"],
  },
  // Environment is a protection target only — no outgoing A2A relations.
  environment: {},
};

/**
 * Returns the allowed A2A relation types for a given source → target group pair.
 * Returns empty array if no Core Rules are defined for this combination.
 */
export function getAllowedA2ARelations(
  sourceGroup: AssetGroup,
  targetGroup: AssetGroup,
): A2ARelationType[] {
  return ALLOWED_A2A_RELATIONS[sourceGroup]?.[targetGroup] ?? [];
}

// ==================== KERN RELATIONS ====================
// The recommended starting set ("KERN-Beziehungen im Überblick" in
// taraflow-asset-zu-asset-beziehungen.md), as explicit source × target data.
//
// Explicit on purpose: the matrix above was meant to list KERN relations
// first, but its order does not match the document (e.g. process → human lists
// `endangers` before the KERN relation `affects_privacy`, service → function
// lists `provides` before `depends_on`). Order is therefore not a reliable
// marker, and the type chooser (asset-graph-view-requirements.md, FR-E4) needs
// one. `contributes_to` / `endangers` from the overview belong to the hazard
// relation system (hazards.relations), not to A2A, and are not listed here.
//
// Every entry must also be allowed by ALLOWED_A2A_RELATIONS (checked by test).

export const KERN_A2A_RELATIONS: Record<
  AssetGroup,
  Partial<Record<AssetGroup, readonly A2ARelationType[]>>
> = {
  data: {
    process: ["required_by"],
    function: ["required_by", "configures"],
    system: ["configures"],
    human: ["affects_privacy"],
  },
  function: {},
  process: {
    process: ["depends_on"],
    function: ["implements"],
    system: ["runs_on", "depends_on"],
    human: ["affects_privacy"],
  },
  system: {
    system: ["depends_on"],
    function: ["implements", "depends_on"],
    infrastructure: ["hosted_on"],
  },
  infrastructure: {},
  physical: {},
  service: {
    service: ["depends_on"],
    function: ["depends_on"],
    infrastructure: ["depends_on"],
  },
  human: {},
  environment: {},
};

/** True if `relationType` is a KERN relation for this source → target pair. */
export function isKernA2ARelation(
  sourceGroup: AssetGroup,
  targetGroup: AssetGroup,
  relationType: A2ARelationType,
): boolean {
  return (
    KERN_A2A_RELATIONS[sourceGroup]?.[targetGroup]?.includes(relationType) ??
    false
  );
}

export interface A2ARelationOption {
  readonly relationType: A2ARelationType;
  readonly kern: boolean;
}

/**
 * Allowed relation types for a pair, KERN first and marked (FR-E4). Within
 * each part the matrix order is kept, so the result is deterministic.
 */
export function getA2ARelationOptions(
  sourceGroup: AssetGroup,
  targetGroup: AssetGroup,
): A2ARelationOption[] {
  const options = getAllowedA2ARelations(sourceGroup, targetGroup).map(
    (relationType) => ({
      relationType,
      kern: isKernA2ARelation(sourceGroup, targetGroup, relationType),
    }),
  );
  return [...options.filter((o) => o.kern), ...options.filter((o) => !o.kern)];
}

// ==================== TARGET CLASSIFICATION ====================
// Basis for target highlighting while dragging a connection (FR-E4) and for
// the direction hint (FR-E5). Derived from the matrix only — never maintained
// separately (AR-4).

/**
 * - `valid`        — at least one type is allowed source → target
 * - `reverse_only` — nothing source → target, but target → source is allowed
 * - `invalid`      — no direction allowed (also: the source asset itself)
 */
export type A2ATargetClass = "valid" | "reverse_only" | "invalid";

export interface A2ATargetClassification {
  readonly targetClass: A2ATargetClass;
  /** Allowed types source → target, KERN first. */
  readonly forward: readonly A2ARelationOption[];
  /** Allowed types target → source, KERN first (for the direction hint). */
  readonly reverse: readonly A2ARelationOption[];
}

/** Classifies a target group relative to a source group. */
export function classifyA2ATargetGroup(
  sourceGroup: AssetGroup,
  targetGroup: AssetGroup,
): A2ATargetClassification {
  const forward = getA2ARelationOptions(sourceGroup, targetGroup);
  const reverse = getA2ARelationOptions(targetGroup, sourceGroup);
  const targetClass: A2ATargetClass =
    forward.length > 0 ? "valid" : reverse.length > 0 ? "reverse_only" : "invalid";
  return { targetClass, forward, reverse };
}

const NO_TARGET: A2ATargetClassification = {
  targetClass: "invalid",
  forward: [],
  reverse: [],
};

/**
 * Classifies every candidate asset relative to the source asset, keyed by
 * asset id. The source itself is always `invalid` (no self relations).
 */
export function classifyA2ATargets(
  source: { readonly id: string; readonly assetGroup: AssetGroup },
  candidates: readonly { readonly id: string; readonly assetGroup: AssetGroup }[],
): Map<string, A2ATargetClassification> {
  const byGroup = new Map<AssetGroup, A2ATargetClassification>();
  const result = new Map<string, A2ATargetClassification>();
  for (const candidate of candidates) {
    if (candidate.id === source.id) {
      result.set(candidate.id, NO_TARGET);
      continue;
    }
    let classification = byGroup.get(candidate.assetGroup);
    if (!classification) {
      classification = classifyA2ATargetGroup(
        source.assetGroup,
        candidate.assetGroup,
      );
      byGroup.set(candidate.assetGroup, classification);
    }
    result.set(candidate.id, classification);
  }
  return result;
}
