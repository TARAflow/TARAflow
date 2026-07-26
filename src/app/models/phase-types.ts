// app/models/phase-types.ts
//
// Single source of truth for phase IDENTITY. Phase NUMBERS live ONLY here —
// every other file refers to a phase via PhaseId.X, so a future renumber is a
// one-line change here and never a silent semantic shift (a bare
// `activePhase === 2` stays valid TypeScript but would change meaning).
//
// Display ORDER used to also live here (PHASE_ORDER, and before that
// STANDARD_/CRITICAL_PHASE_ORDER) but had no caller left once Attack Tree's
// position stopped depending on workflow mode — removed 2026-07-25. The
// order now lives solely in PHASES (shared/models/common-types.ts), which is
// already listed in its final display order; nothing derives it from here
// anymore.

/**
 * Stable phase identities.
 * With the v2 renumbering, Hazard is inserted at position 1 and the ids line up
 * with the standard workflow order. Integration is reached via a separate entry
 * point and is therefore not part of the linear order arrays below.
 *
 * v3: Attack Tree moved from 6 to 5 (between Threats and Risk) — it now
 * always sits before Risk, in every workflow, no longer conditional on
 * isHighImpact ("Critical System"). Risk moved from 5 to 6 to make room.
 */
export const PhaseId = {
  General: 0,
  Hazard: 1,
  DFD: 2,
  Assets: 3,
  Threats: 4,
  AttackTree: 5,
  Risk: 6,
  Documentation: 7,
  Audit: 8,
  Integration: 9,
} as const;

export type PhaseId = (typeof PhaseId)[keyof typeof PhaseId];

/**
 * Phases that count toward project progress (the "work" phases).
 * Documentation, Audit, and Integration are excluded: they never reach a
 * normal "complete" state and would otherwise cap progress below 100%.
 * Hazard is listed here but only surfaced when a project is safety-relevant —
 * use getProgressPhaseIds(safetyRelevant) instead of this array directly.
 */
export const PROGRESS_PHASE_IDS: number[] = [
  PhaseId.General,
  PhaseId.Hazard,
  PhaseId.DFD,
  PhaseId.Assets,
  PhaseId.Threats,
  PhaseId.Risk,
  PhaseId.AttackTree,
];

/** Progress phases, with Hazard included only when safety analysis is on. */
export function getProgressPhaseIds(safetyRelevant: boolean): number[] {
  return safetyRelevant
    ? PROGRESS_PHASE_IDS
    : PROGRESS_PHASE_IDS.filter((id) => id !== PhaseId.Hazard);
}