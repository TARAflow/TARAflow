// ==================== SECURITY-GOAL BADGES ====================
//
// What a surface shows next to a security goal — source badge and state
// markers — derived from goalState() only. The goal card (asset dialog) and
// the goal chips (asset table) both render these, so the two cannot drift
// apart (design doc §4.1: "no surface assembles its own conditions").
//
// Pure: returns i18n keys + colours, no React.

import type { SecurityGoal } from "../models/asset-security-goals-types";
import {
  goalFindings,
  severityFor,
  type GoalFindingSeverity,
  type GoalState,
} from "../services/asset-goal-state";

const K = "tabs.assets.goalCards";

export type GoalSourceKey = "suggested" | "adjusted" | "added" | "excluded" | "legacy";

/** Who decided the goal, as the analyst reads it. */
export function goalSourceKey(state: GoalState): GoalSourceKey {
  if (state.visibility === "excluded") return "excluded";
  if (state.source === "manual") return state.suggestion.suggested ? "adjusted" : "added";
  if (state.source === "legacy") return "legacy";
  return "suggested";
}

const SOURCE_DEFAULT: Record<GoalSourceKey, string> = {
  suggested: "Suggested",
  adjusted: "Adjusted",
  added: "Added",
  excluded: "Excluded",
  legacy: "Earlier decision",
};

export interface GoalBadge {
  /** Stable id for keys and tests. */
  id: "source" | "provisional" | "minimumLevel" | "stale" | "rationaleMissing" | "exceedsAsset";
  /** i18n key + English default. */
  key: string;
  defaultValue: string;
  color: string;
}

/** Source badge first, then the state markers — in display order. */
export function goalBadges(state: GoalState, goal: SecurityGoal): GoalBadge[] {
  const manual = state.source === "manual";
  const src = goalSourceKey(state);
  const out: GoalBadge[] = [
    {
      id: "source",
      key: `${K}.source.${src}`,
      defaultValue: SOURCE_DEFAULT[src],
      color: manual ? "#1d4ed8" : "#7c3aed",
    },
  ];
  if (!manual && state.assessment === "provisional") {
    out.push({ id: "provisional", key: `${K}.provisional`, defaultValue: "provisional", color: "#0284c7" });
  }
  if (!manual && state.assessment === "no-applicable-impact") {
    out.push({ id: "minimumLevel", key: `${K}.minimumLevel`, defaultValue: "minimum level", color: "#6b7280" });
  }
  if (state.stale) {
    const warning = severityFor(state.stale, goal.level === "none") === "warning";
    out.push(
      warning
        ? { id: "stale", key: `${K}.stale.review`, defaultValue: "Review", color: "#d97706" }
        : { id: "stale", key: `${K}.stale.changed`, defaultValue: "Suggestion changed", color: "#0284c7" },
    );
  }
  if (state.rationaleRequired && !goal.rationale?.trim()) {
    out.push({ id: "rationaleMissing", key: `${K}.rationaleMissing`, defaultValue: "Rationale missing", color: "#dc2626" });
  }
  if (state.exceedsAsset.length > 0) {
    out.push({ id: "exceedsAsset", key: `${K}.exceedsAsset`, defaultValue: "Impact above asset value", color: "#dc2626" });
  }
  return out;
}

const RANK: Record<GoalFindingSeverity, number> = { info: 1, warning: 2, error: 3 };

/**
 * Worst finding of the goal (goalFindings — the same source as the validation
 * panel), or null when the goal has none.
 */
export function goalMarker(state: GoalState, goal: SecurityGoal): GoalFindingSeverity | null {
  let worst: GoalFindingSeverity | null = null;
  for (const f of goalFindings(state, goal)) {
    if (!worst || RANK[f.severity] > RANK[worst]) worst = f.severity;
  }
  return worst;
}
