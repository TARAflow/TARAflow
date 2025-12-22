// ==================== PHASE HELPERS ====================
// Helper functions for phase navigation and validation
// These are specific to the overview feature

import {
  PhaseDefinition,
  PhaseStatus,
  PhaseStatusMap,
  PHASES,
} from "shared";

export const getPhaseById = (id: number): PhaseDefinition | undefined => {
  return PHASES.find((p) => p.id === id);
};

export const getNextPhase = (currentPhase: number): PhaseDefinition | null => {
  return PHASES.find((p) => p.id === currentPhase + 1) || null;
};

export const getPreviousPhase = (
  currentPhase: number
): PhaseDefinition | null => {
  return PHASES.find((p) => p.id === currentPhase - 1) || null;
};

export const calculatePhaseProgress = (
  phaseStatus: PhaseStatusMap
): number => {
  const statuses = Object.values(phaseStatus);
  const completed = statuses.filter((s) => s === "complete").length;
  return Math.round((completed / statuses.length) * 100);
};

export const isPhaseAccessible = (
  targetPhase: number,
  currentPhaseStatus: PhaseStatusMap,
  strictMode: boolean
): { accessible: boolean; reason?: string } => {
  if (targetPhase === 0) {
    return { accessible: true };
  }

  if (!strictMode) {
    return { accessible: true };
  }

  // In strict mode, previous phase must be complete
  const previousPhase = targetPhase - 1;
  const previousStatus = currentPhaseStatus[previousPhase as keyof PhaseStatusMap];

  if (previousStatus !== "complete") {
    return {
      accessible: false,
      reason: `Phase ${previousPhase} must be completed before accessing Phase ${targetPhase}`,
    };
  }

  return { accessible: true };
};