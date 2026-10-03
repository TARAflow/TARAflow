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
// [KERN] relations are listed first in each array.
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
