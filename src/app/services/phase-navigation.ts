// app/services/phase-navigation.ts
//
// Phase progress calculation.
//
// Used to also own workflow-mode-based phase ordering and navigation
// (getPhaseOrder, getNextPhase, getPreviousPhase, sortPhasesByWorkflow,
// isPhaseAccessible, getPhaseDisplayIndex) — removed (2026-07-25): Attack
// Tree's position no longer depends on WorkflowMode (see phase-types.ts's
// PHASE_ORDER), and none of those functions had any caller outside this file
// to begin with. `PHASES` (shared/models/common-types.ts) is already in its
// final display order, so no sorting step is needed anywhere anymore.

import type { PhaseStatus } from "shared";

/**
 * Overall completion percentage. When `progressPhaseIds` is given, only those
 * "work" phases form numerator and denominator (SSOT-aligned). Without it,
 * falls back to counting every phase present in the status map.
 */
export const calculatePhaseProgress = (
  phaseStatus: Record<number, PhaseStatus>,
  progressPhaseIds?: number[],
): number => {
  const ids = progressPhaseIds ?? Object.keys(phaseStatus).map(Number);
  if (ids.length === 0) return 0;
  const complete = ids.filter((id) => phaseStatus[id] === "complete").length;
  return Math.round((complete / ids.length) * 100);
};