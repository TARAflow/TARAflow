// ==================== TABLE GROUPS ====================
// Leveled-DFD Phase 6a (leveled-dfd-multi-diagram-design.md Phase 6, D20):
// which accordion group of the asset / threat / risk tables an element or
// flow belongs to.
//
//   element   the top-level decomposed multiprocess it lies in (following
//             the containment parents to the one below Top); a decomposed
//             MP itself (a fallback endpoint) is its own group; a boundary
//             the group of the page it is defined on (a chip boundary on
//             the Sensor page belongs to the Sensor MP; boundaries have no
//             containment parent, §5.3.1); anything else — EEs, elements
//             on Top, MPs not decomposed — "Top level"
//   flow      the group of its two resolved ends if both lie in the same
//             multiprocess; otherwise — between two multiprocesses, or
//             between the top level and a multiprocess — "Top level"
//             (D20, revised 2026-10-19: every threat in exactly one group;
//             a multiprocess shows only what lies entirely inside it)

import { TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";
import type { DfdGraphSource } from "../build-dfd-graph";
import { effectiveModelOf, isLeveled } from "../build-dfd-graph";

/**
 * Undefined for a classic DFD and for a leveled DFD without a decomposed
 * multiprocess — the tables stay as they are (D20).
 */
export function multiprocessGroupsOf(source: DfdGraphSource): DfdTableGroups | undefined {
  if (!isLeveled(source.xml)) return undefined;
  const { model, records, tree, homePages } = effectiveModelOf(source);
  const parent = model.containmentParent;
  const decomposed = new Set(parent.values());
  if (decomposed.size === 0) return undefined;

  const topOf = (tfId: string): string => {
    let current = tfId;
    const seen = new Set<string>();
    while (parent.has(current) && !seen.has(current)) {
      seen.add(current);
      current = parent.get(current)!;
    }
    return current;
  };
  // Page → the decomposed multiprocess it details (placed child pages).
  const pageDetails = new Map(
    tree.pages.filter((p) => p.decomposes && decomposed.has(p.decomposes)).map((p) => [p.pageId, p.decomposes!]),
  );
  const BOUNDARIES = new Set(["TrustBoundary", "ChipBoundary", "PhysicalBoundary"]);
  const groupOf = (tfId: string): string => {
    if (parent.has(tfId) || decomposed.has(tfId)) return topOf(tfId);
    const record = records.elements.get(tfId);
    if (record && BOUNDARIES.has(record.type)) {
      const home = homePages.elements.get(tfId);
      const mp = home ? pageDetails.get(home) : undefined;
      if (mp) return topOf(mp);
    }
    return TOP_LEVEL_GROUP;
  };

  const elementGroup: Record<string, string> = {};
  for (const id of records.elements.keys()) elementGroup[id] = groupOf(id);
  const flowGroups: Record<string, string[]> = {};
  for (const flow of model.flows) {
    const from = groupOf(flow.from);
    flowGroups[flow.tfId] = [from === groupOf(flow.to) ? from : TOP_LEVEL_GROUP];
  }

  // Multiprocess groups in page-tree order (the order of their child pages).
  const order = new Map(tree.pages.map((p, i) => [p.decomposes, i]));
  const label = (id: string) => {
    const r = records.elements.get(id);
    return r ? [r.displayId, r.name].filter(Boolean).join(" ") || id : id;
  };
  const used = new Set(Object.values(elementGroup).concat(...Object.values(flowGroups)));
  const mpGroups = [...used]
    .filter((key) => key !== TOP_LEVEL_GROUP)
    .sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) || a.localeCompare(b))
    .map((key) => ({ key, label: label(key) }));

  return {
    groups: [{ key: TOP_LEVEL_GROUP, label: "" }, ...mpGroups],
    elementGroup,
    flowGroups,
  };
}
