// app/models/phase-types.ts
//
// Single source of truth for phase identity and workflow ordering.
// Phase NUMBERS live ONLY here — every other file refers to a phase via PhaseId.X,
// so a future renumber is a one-line change here and never a silent semantic shift
// (a bare `activePhase === 2` stays valid TypeScript but would change meaning).

/**
 * Stable phase identities.
 * With the v2 renumbering, Hazard is inserted at position 1 and the ids line up
 * with the standard workflow order. Integration is reached via a separate entry
 * point and is therefore not part of the linear order arrays below.
 */
export const PhaseId = {
  General: 0,
  Hazard: 1,
  DFD: 2,
  Assets: 3,
  Threats: 4,
  Risk: 5,
  AttackTree: 6,
  Documentation: 7,
  Audit: 8,
  Integration: 9,
} as const;

export type PhaseId = (typeof PhaseId)[keyof typeof PhaseId];

/**
 * Standard workflow (non-critical systems):
 * General -> Hazard -> DFD -> Assets -> Threats -> Risk -> Attack Tree -> Documentation -> Audit
 */
export const STANDARD_PHASE_ORDER: number[] = [
  PhaseId.General,
  PhaseId.Hazard,
  PhaseId.DFD,
  PhaseId.Assets,
  PhaseId.Threats,
  PhaseId.Risk,
  PhaseId.AttackTree,
  PhaseId.Documentation,
  PhaseId.Audit,
];

/**
 * Critical workflow (high-impact systems): Attack Tree before Threats, because
 * understanding attack paths first informs threat identification.
 * General -> Hazard -> DFD -> Assets -> Attack Tree -> Threats -> Risk -> Documentation -> Audit
 */
export const CRITICAL_PHASE_ORDER: number[] = [
  PhaseId.General,
  PhaseId.Hazard,
  PhaseId.DFD,
  PhaseId.Assets,
  PhaseId.AttackTree,
  PhaseId.Threats,
  PhaseId.Risk,
  PhaseId.Documentation,
  PhaseId.Audit,
];

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
