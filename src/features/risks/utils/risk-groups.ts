// ==================== RISK GROUPS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6b, D20): a risk
// follows the group of its threat — the threat's element or flow decides
// (top level or a top-level decomposed multiprocess). A risk whose threat is
// gone or whose element / flow is no longer in the DFD gets the group
// "Not in the DFD".

import { TOP_LEVEL_GROUP, groupsOfDfdItem, type DfdTableGroups } from "shared";
import type { ThreatReference } from "shared";
import type { Risk } from "../models/risk-assessment-types";

export const RISK_NOT_IN_DFD = "__not_in_dfd__";

export interface RiskGroupSection {
  key: string;
  /** Multiprocess label; empty for the top level and "Not in the DFD". */
  label: string;
  risks: Risk[];
}

/**
 * Risks per group, in the order of `groups.groups` (top level first), then
 * "Not in the DFD". Groups without risks are left out.
 */
export function riskGroupSections(
  groups: DfdTableGroups,
  risks: Risk[],
  threats: ThreatReference[],
): RiskGroupSection[] {
  const threatById = new Map(threats.map((t) => [t.id, t]));
  const byKey = new Map<string, Risk[]>();
  for (const risk of risks) {
    const threat = threatById.get(risk.threatId);
    const keys = threat
      ? groupsOfDfdItem(groups, {
          elementId: threat.linkedElement?.elementId,
          connectionId: threat.dataFlow?.connectionId,
        })
      : [];
    // Every threat lies in one group (D20); take the first to be safe.
    const key = keys[0] ?? RISK_NOT_IN_DFD;
    byKey.set(key, [...(byKey.get(key) ?? []), risk]);
  }
  return [
    ...groups.groups.map((g) => ({
      key: g.key,
      label: g.key === TOP_LEVEL_GROUP ? "" : g.label,
    })),
    { key: RISK_NOT_IN_DFD, label: "" },
  ]
    .map((section) => ({ ...section, risks: byKey.get(section.key) ?? [] }))
    .filter((section) => section.risks.length > 0);
}
