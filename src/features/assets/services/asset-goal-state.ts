// ==================== SECURITY GOAL STATE ====================
//
// The single domain truth about a security goal of an asset. Card, asset
// table, validation and report all consume goalStates(); no surface builds
// its own conditions. See doc/InProgress/Asset/security-goal-rework-design.md
// §4.1 (state model) and §4.5 (invariants).
//
// Principle: store decisions, derive states. The only stored addition is the
// snapshot of the suggestion at a manual decision (suggestionAtDecision) — a
// past fact. Everything else follows from level / source / rationale plus the
// current derivation (computeSuggestedGoalTypes + explainLevel).
//
// Ground rule: the tool never silently changes an analyst decision. The
// explicit actions at the bottom are the ONLY way to create or change a manual
// goal and its snapshot.
//
// Pure: no React, no project state.

import type { Asset } from "../models/asset-types";
import type { ImpactScaleType } from "../models/asset-impact-types";
import type {
  CIANAAALevel,
  GoalSuggestionSnapshot,
  LevelBasis,
  SecurityGoal,
  SecurityGoalType,
  StaleReason,
} from "../models/asset-security-goals-types";
import {
  computeSuggestedGoalTypes,
  explainLevel,
  explainSuggestion,
  type LevelExplanation,
} from "./asset-cianaaa-deriver";

// ==================== TYPES ====================

export interface GoalState {
  type: SecurityGoalType;
  /**
   * Where the goal belongs in the UI:
   *   card     — active, or suggested by the graph
   *   excluded — suggested, but deliberately deactivated by the analyst
   *   hidden   — neither suggested nor active ("add goal")
   */
  visibility: "card" | "excluded" | "hidden";
  /** Who decided the level. legacy = active goal from before `source` existed. */
  source: "suggested" | "manual" | "legacy";
  /**
   * What a SUGGESTED level rests on. Manual and legacy goals are "assessed"
   * (a decision exists); hidden goals too (nothing to assess).
   */
  assessment: "assessed" | "provisional" | "no-applicable-impact" | "missing";
  /** Effective level, internal (incl. the minimum level "low"). */
  level: CIANAAALevel;
  /** Level to display; null when the assessment is missing — never a plain "Low". */
  displayLevel: CIANAAALevel | null;
  /** Why the SUGGESTED level is what it is (explainLevel). */
  levelReason: LevelExplanation;
  /** Why the goal is suggested at all — relations ("Config push → transports"). */
  suggestionReasons: string[];
  /** The tool's current suggestion for this goal. */
  suggestion: GoalSuggestionSnapshot;
  /** Set when a manual decision's basis has changed since it was made. */
  stale: StaleReason | null;
  /**
   * A manual decision that deviates from the suggestion (excluded, added, or
   * another level) must be justified.
   */
  rationaleRequired: boolean;
}

export type GoalFindingCode =
  | "GOAL_RATIONALE_MISSING"
  | "GOAL_OVERRIDE_STALE"
  | "GOAL_UNASSESSED"
  | "GOAL_PROVISIONAL"
  | "GOAL_NO_APPLICABLE_IMPACT";

export type GoalFindingSeverity = "error" | "warning" | "info";

export interface GoalFinding {
  code: GoalFindingCode;
  severity: GoalFindingSeverity;
  goal: SecurityGoalType;
  /** Only for GOAL_OVERRIDE_STALE. */
  reason?: StaleReason;
}

// ==================== SUGGESTION ====================

const LEVEL_RANK: Record<CIANAAALevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function driverOf(e: LevelExplanation): string | undefined {
  return e.kind === "mechanism" || e.kind === "fallback"
    ? e.criterionId
    : undefined;
}

/** The tool's current suggestion for one goal type. */
export function currentSuggestion(
  asset: Asset,
  type: SecurityGoalType,
  impactScale: ImpactScaleType,
  suggestedTypes: Set<SecurityGoalType> = computeSuggestedGoalTypes(asset),
): GoalSuggestionSnapshot {
  const e = explainLevel(type, asset.impactRatings ?? [], impactScale);
  const suggested = suggestedTypes.has(type);
  return {
    suggested,
    level: suggested ? e.level : "none",
    basis: e.kind as LevelBasis,
    driver: driverOf(e),
  };
}

/**
 * Compare the snapshot of a manual decision with the current suggestion.
 * Returns null when nothing relevant changed or the snapshot is unknown.
 */
export function staleReason(
  snapshot: GoalSuggestionSnapshot | undefined,
  current: GoalSuggestionSnapshot,
): StaleReason | null {
  if (!snapshot) return null; // decided before snapshots existed — unknown
  if (snapshot.suggested && !current.suggested) return "suggestion-removed";
  if (!snapshot.suggested && current.suggested) return "suggestion-added";
  if (!snapshot.suggested && !current.suggested) return null;
  const delta = LEVEL_RANK[current.level] - LEVEL_RANK[snapshot.level];
  if (delta > 0) return "level-raised";
  if (delta < 0) return "level-lowered";
  if (snapshot.basis !== current.basis || snapshot.driver !== current.driver)
    return "basis-changed";
  return null;
}

// ==================== STATE ====================

const ASSESSMENT_BY_BASIS: Record<LevelBasis, GoalState["assessment"]> = {
  mechanism: "assessed",
  fallback: "provisional",
  "not-applicable": "no-applicable-impact",
  floor: "missing",
};

function stateOf(
  asset: Asset,
  goal: SecurityGoal,
  impactScale: ImpactScaleType,
  suggestedTypes: Set<SecurityGoalType>,
): GoalState {
  const levelReason = explainLevel(
    goal.type,
    asset.impactRatings ?? [],
    impactScale,
  );
  const suggestion = currentSuggestion(
    asset,
    goal.type,
    impactScale,
    suggestedTypes,
  );
  const manual = goal.source === "manual";
  const active = goal.level !== "none";

  const visibility: GoalState["visibility"] =
    manual && !active && suggestion.suggested
      ? "excluded"
      : active || suggestion.suggested
        ? "card"
        : "hidden";

  const source: GoalState["source"] = manual
    ? "manual"
    : goal.source === "suggested" || !active
      ? "suggested"
      : "legacy";

  const assessment: GoalState["assessment"] =
    source === "suggested" && visibility === "card"
      ? ASSESSMENT_BY_BASIS[suggestion.basis]
      : "assessed";

  return {
    type: goal.type,
    visibility,
    source,
    assessment,
    level: goal.level,
    displayLevel: assessment === "missing" ? null : goal.level,
    levelReason,
    suggestionReasons: explainSuggestion(asset, goal.type, impactScale).reasons,
    suggestion,
    stale: manual ? staleReason(goal.suggestionAtDecision, suggestion) : null,
    // A rationale justifies a DEVIATION from the suggestion: an exclusion, an
    // added (not suggested) goal, or a level other than the suggested one. A
    // manual goal that sits on the suggested level deviates from nothing.
    rationaleRequired:
      manual &&
      (!active || !suggestion.suggested || goal.level !== suggestion.level),
  };
}

/** State of one goal. Prefer goalStates() for all goals of an asset. */
export function goalState(
  asset: Asset,
  goal: SecurityGoal,
  impactScale: ImpactScaleType,
): GoalState {
  return stateOf(asset, goal, impactScale, computeSuggestedGoalTypes(asset));
}

/** State of every goal of an asset (suggestion computed once). */
export function goalStates(
  asset: Asset,
  impactScale: ImpactScaleType,
): GoalState[] {
  const suggestedTypes = computeSuggestedGoalTypes(asset);
  return (asset.securityGoals ?? []).map((g) =>
    stateOf(asset, g, impactScale, suggestedTypes),
  );
}

// ==================== FINDINGS ====================
// Severity = effect on the reliability of the TARA, not technical oddity:
//   error   — the calculation rests on contradictory inputs (Phase 4)
//   warning — a required assessment / rationale is missing, or a decision
//             may no longer be valid
//   info    — legitimate, but worth mentioning in a review

/** GOAL_OVERRIDE_STALE is ONE code; its severity follows the reason. */
export function severityFor(
  reason: StaleReason,
  isExclusion: boolean,
): GoalFindingSeverity {
  switch (reason) {
    case "suggestion-removed":
      // an exclusion whose goal is no longer suggested is simply moot
      return isExclusion ? "info" : "warning";
    case "level-raised":
    case "basis-changed":
      return "warning";
    case "level-lowered":
    case "suggestion-added":
      return "info";
  }
}

export function goalFindings(
  state: GoalState,
  goal: SecurityGoal,
): GoalFinding[] {
  const out: GoalFinding[] = [];
  const f = (
    code: GoalFindingCode,
    severity: GoalFindingSeverity,
    reason?: StaleReason,
  ) => out.push({ code, severity, goal: state.type, ...(reason ? { reason } : {}) });

  if (state.rationaleRequired && !goal.rationale?.trim()) {
    f("GOAL_RATIONALE_MISSING", "warning");
  }
  if (state.stale) {
    f("GOAL_OVERRIDE_STALE", severityFor(state.stale, goal.level === "none"), state.stale);
  }
  if (state.source === "suggested" && state.visibility === "card") {
    if (state.assessment === "missing") f("GOAL_UNASSESSED", "warning");
    if (state.assessment === "provisional") f("GOAL_PROVISIONAL", "info");
    if (state.assessment === "no-applicable-impact")
      f("GOAL_NO_APPLICABLE_IMPACT", "info");
  }
  return out;
}

// ==================== EXPLICIT ANALYST ACTIONS ====================
// The only way to create or change a manual goal. Each records the snapshot
// of the suggestion the decision was made against. Pure: return the new goal.

/** Adjust the level (also: add a goal the graph does not suggest). */
export function adjustGoal(
  asset: Asset,
  goal: SecurityGoal,
  level: Exclude<CIANAAALevel, "none">,
  rationale: string,
  impactScale: ImpactScaleType,
): SecurityGoal {
  return {
    ...goal,
    level,
    source: "manual",
    rationale,
    suggestionAtDecision: currentSuggestion(asset, goal.type, impactScale),
  };
}

/** Deliberately deactivate a suggested goal ("not relevant for this asset"). */
export function excludeGoal(
  asset: Asset,
  goal: SecurityGoal,
  rationale: string,
  impactScale: ImpactScaleType,
): SecurityGoal {
  return {
    ...goal,
    level: "none",
    source: "manual",
    rationale,
    suggestionAtDecision: currentSuggestion(asset, goal.type, impactScale),
  };
}

/**
 * Keep a manual decision after reviewing a changed suggestion: the level
 * stays, the snapshot moves to the current suggestion (the decision was
 * checked against it). Optionally extend the rationale.
 */
export function keepDecision(
  asset: Asset,
  goal: SecurityGoal,
  impactScale: ImpactScaleType,
  rationale?: string,
): SecurityGoal {
  if (goal.source !== "manual") return goal;
  return {
    ...goal,
    rationale: rationale ?? goal.rationale,
    suggestionAtDecision: currentSuggestion(asset, goal.type, impactScale),
  };
}

/** Drop the manual decision and return to the tool's suggestion. */
export function resetToSuggestion(
  asset: Asset,
  goal: SecurityGoal,
  impactScale: ImpactScaleType,
): SecurityGoal {
  const s = currentSuggestion(asset, goal.type, impactScale);
  const { suggestionAtDecision: _snap, rationale: _r, ...rest } = goal;
  return s.suggested
    ? { ...rest, level: s.level, source: "suggested" }
    : { ...rest, level: "none", source: undefined };
}

/**
 * Manual goals decided before snapshots existed have no baseline to compare
 * against. Record the current suggestion as their baseline — call when the
 * analyst saves the asset. Goals that already have a snapshot are untouched.
 */
export function initializeMissingSnapshots(
  asset: Asset,
  impactScale: ImpactScaleType,
): SecurityGoal[] {
  const suggestedTypes = computeSuggestedGoalTypes(asset);
  return (asset.securityGoals ?? []).map((g) =>
    g.source === "manual" && !g.suggestionAtDecision
      ? {
          ...g,
          suggestionAtDecision: currentSuggestion(
            asset,
            g.type,
            impactScale,
            suggestedTypes,
          ),
        }
      : g,
  );
}
