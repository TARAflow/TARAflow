// ==================== PARENT-LEVEL FLOWS ====================
// Leveled-DFD Phase 5j (leveled-dfd-multi-diagram-design.md §6.5, §7, D4,
// D10): the data flows analysed on a parent level — effective flows in
// state "fallback". Their threats refer to a fallback endpoint (usually a
// decomposed multiprocess) and are provisional, never a confirmed modelling
// result. The threats tab shows them in a banner.

import type { DfdGraphSource } from "../build-dfd-graph";
import { effectiveModelOf, isLeveled } from "../build-dfd-graph";
import type { FallbackReason } from "./effective-model";

export interface ParentLevelFlow {
  tfId: string;
  /** displayId and name of the flow */
  label: string;
  /** The endpoints the flow is analysed with (displayId and name). */
  from: string;
  to: string;
  /** Most severe reason: ambiguous > dangling > unresolved (§6.5). */
  reason: FallbackReason;
}

/** Empty for a classic DFD (one page) — there is no effective model. */
export function parentLevelFlowsOf(source: DfdGraphSource): ParentLevelFlow[] {
  if (!isLeveled(source.xml)) return [];
  const { model, records } = effectiveModelOf(source);
  const label = (r: { id: string; displayId?: string; name?: string } | undefined, id: string) =>
    r ? [r.displayId, r.name].filter(Boolean).join(" ") || r.id : id;
  return model.flows
    .filter((f) => f.state === "fallback")
    .map((f) => ({
      tfId: f.tfId,
      label: label(records.connections.get(f.tfId), f.tfId),
      from: label(records.elements.get(f.from), f.from),
      to: label(records.elements.get(f.to), f.to),
      reason: f.fallbackReason ?? "unresolved",
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}
