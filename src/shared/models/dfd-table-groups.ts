// ==================== DFD TABLE GROUPS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6, D20): the
// asset, threat and risk tables are grouped in one accordion per top-level
// decomposed multiprocess plus "Top level". Computed by the DFD feature
// (multiprocessGroupsOf), consumed by the tabs — a plain structure, so the
// tabs import nothing from the DFD feature.

import type { DfdScopeIndex } from "./dfd-scope";

/** Key of the group of everything not inside a decomposed multiprocess. */
export const TOP_LEVEL_GROUP = "__top__";

export interface DfdTableGroup {
  /** TOP_LEVEL_GROUP, or the tfId of a top-level decomposed multiprocess. */
  key: string;
  /** displayId and name of the multiprocess; empty for the top level. */
  label: string;
}

export interface DfdTableGroups {
  /** Top level first, then the multiprocesses in page-tree order. */
  groups: DfdTableGroup[];
  /** element tfId → group key */
  elementGroup: Record<string, string>;
  /**
   * flow tfId → its group: the multiprocess both ends lie in, otherwise
   * the top level (exactly one entry — every threat in one group, D20).
   */
  flowGroups: Record<string, string[]>;
  /** Page and analysis-state filter of the tables (6f). */
  scope?: DfdScopeIndex;
}

/** Groups of a DFD element or flow; empty if it is not in the DFD. */
export function groupsOfDfdItem(
  groups: DfdTableGroups,
  ref: { elementId?: string | null; connectionId?: string | null },
): string[] {
  if (ref.connectionId && groups.flowGroups[ref.connectionId]) {
    return groups.flowGroups[ref.connectionId];
  }
  if (ref.elementId && groups.elementGroup[ref.elementId]) {
    return [groups.elementGroup[ref.elementId]];
  }
  // A data-flow threat of the per-element method refers to its flow as
  // linkedElement (element id = flow id), not as dataFlow.
  if (ref.elementId && groups.flowGroups[ref.elementId]) {
    return groups.flowGroups[ref.elementId];
  }
  if (ref.connectionId && groups.elementGroup[ref.connectionId]) {
    return [groups.elementGroup[ref.connectionId]];
  }
  return [];
}
