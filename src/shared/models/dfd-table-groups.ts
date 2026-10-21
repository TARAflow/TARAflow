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
   * the top level (exactly one entry — every threat in one group, D20). A
   * per-interaction threat of a flow goes to the side it attacks instead
   * (D20, revised 2026-10-21; see groupsOfDfdItem).
   */
  flowGroups: Record<string, string[]>;
  /** Page and analysis-state filter of the tables (6f). */
  scope?: DfdScopeIndex;
}

/** The DFD item a threat refers to, for its group. */
export interface DfdItemRef {
  elementId?: string | null;
  connectionId?: string | null;
  /**
   * Per-interaction threat: the flow end it attacks (IN → target, OUT →
   * source). Its group is the threat's group — a flow between two
   * multiprocesses is the business of both teams, each for its own side.
   */
  victimElementId?: string | null;
}

/** The DFD item of a threat or threat reference (per element or per interaction). */
export function dfdItemRefOfThreat(threat: {
  linkedElement?: { elementId?: string } | null;
  dataFlow?: { connectionId?: string; sourceId?: string; targetId?: string } | null;
  interactionContext?: { victimRole?: string } | null;
}): DfdItemRef {
  const role = threat.interactionContext?.victimRole;
  const victim =
    role === "target" ? threat.dataFlow?.targetId : role === "source" ? threat.dataFlow?.sourceId : undefined;
  return {
    elementId: threat.linkedElement?.elementId,
    connectionId: threat.dataFlow?.connectionId,
    ...(victim ? { victimElementId: victim } : {}),
  };
}

/** Groups of a DFD element or flow; empty if it is not in the DFD. */
export function groupsOfDfdItem(groups: DfdTableGroups, ref: DfdItemRef): string[] {
  if (ref.connectionId && groups.flowGroups[ref.connectionId]) {
    // The attacked side decides (IN at the receiver, OUT at the sender).
    const side = ref.victimElementId ? groups.elementGroup[ref.victimElementId] : undefined;
    return side ? [side] : groups.flowGroups[ref.connectionId];
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
