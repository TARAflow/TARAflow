// app/services/phase-navigation.ts
//
// Workflow orchestration: phase order, navigation and strict-mode gating.
// Consumes the workflow-mode signal from overview; everything here is pure and
// ORDER-based. No id +/- 1 arithmetic — that silently breaks the critical
// workflow, where Attack Tree sits between Assets and Threats.

import type { PhaseStatus, WorkflowMode } from "shared";
import { STANDARD_PHASE_ORDER, CRITICAL_PHASE_ORDER } from "../models/phase-types";

export const getPhaseOrder = (mode: WorkflowMode): number[] =>
  mode === "critical" ? CRITICAL_PHASE_ORDER : STANDARD_PHASE_ORDER;

/** Display index of a phase within the active workflow (drives tab numbering). */
export const getPhaseDisplayIndex = (
  phaseId: number,
  mode: WorkflowMode,
): number => getPhaseOrder(mode).indexOf(phaseId);

export const getNextPhase = (
  currentPhase: number,
  mode: WorkflowMode,
): number | null => {
  const order = getPhaseOrder(mode);
  const i = order.indexOf(currentPhase);
  if (i === -1 || i >= order.length - 1) return null;
  return order[i + 1];
};

export const getPreviousPhase = (
  currentPhase: number,
  mode: WorkflowMode,
): number | null => {
  const order = getPhaseOrder(mode);
  const i = order.indexOf(currentPhase);
  if (i <= 0) return null;
  return order[i - 1];
};

/** Sort phase definitions into the active workflow order. */
export const sortPhasesByWorkflow = <T extends { id: number }>(
  phases: T[],
  mode: WorkflowMode,
): T[] => {
  const order = getPhaseOrder(mode);
  return [...phases].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
};

/**
 * Strict-mode gate: the PREDECESSOR IN THE WORKFLOW ORDER (not id - 1) must be
 * complete before the target phase becomes accessible.
 */
export const isPhaseAccessible = (
  targetPhase: number,
  phaseStatus: Record<number, PhaseStatus>,
  strictMode: boolean,
  mode: WorkflowMode,
): { accessible: boolean; reason?: string } => {
  if (!strictMode) return { accessible: true };

  const order = getPhaseOrder(mode);
  const i = order.indexOf(targetPhase);
  if (i <= 0) return { accessible: true }; // first phase (or not ordered) -> always open

  const previousPhase = order[i - 1];
  if (phaseStatus[previousPhase] !== "complete") {
    return {
      accessible: false,
      reason: `Phase ${previousPhase} must be completed before accessing phase ${targetPhase}`,
    };
  }
  return { accessible: true };
};

/** Overall completion percentage across all known phases. */
export const calculatePhaseProgress = (
  phaseStatus: Record<number, PhaseStatus>,
): number => {
  const statuses = Object.values(phaseStatus);
  if (statuses.length === 0) return 0;
  const complete = statuses.filter((s) => s === "complete").length;
  return Math.round((complete / statuses.length) * 100);
};
