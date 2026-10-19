// ==================== DFD TABLE GROUPS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6, D20): the
// asset, threat and risk tables are grouped in one accordion per top-level
// decomposed multiprocess plus "Top level". Computed by the DFD feature
// (multiprocessGroupsOf), consumed by the tabs — a plain structure, so the
// tabs import nothing from the DFD feature.

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
  /** flow tfId → group keys of its two ends (one, or two different ones) */
  flowGroups: Record<string, string[]>;
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
  if (ref.connectionId && groups.elementGroup[ref.connectionId]) {
    return [groups.elementGroup[ref.connectionId]];
  }
  return [];
}
