// ==================== USE DFD COMPLETION HOOK ====================
// Single Responsibility: Manage DFD completion business rules

import { useMemo, useCallback } from "react";
import type { DFDStats } from "../models/dfd-types";
import type { UseDFDValidationReturn } from "./use-dfd-validation";
import type { UseDFDPersistenceReturn } from "./use-dfd-persistence";

// ==================== TYPES ====================

export interface UseDFDCompletionOptions {
  onPhaseComplete?: () => void;
}

export interface UseDFDCompletionReturn {
  // Computed state
  canProceed: boolean;
  completionStatus: {
    isDirty: boolean;
    isValid: boolean;
    allDescribed: boolean;
    hasStats: boolean;
  };

  // Actions
  proceed: () => void;
}

// ==================== HOOK ====================

export function useDFDCompletion(
  validation: UseDFDValidationReturn,
  persistence: UseDFDPersistenceReturn,
  stats: DFDStats | undefined,
  options: UseDFDCompletionOptions = {},
): UseDFDCompletionReturn {
  const { onPhaseComplete } = options;

  // ==================== COMPLETION LOGIC ====================

  /**
   * Compute completion status
   */
  const completionStatus = useMemo(() => {
    const isDirty = persistence.isDirty;
    const isValid = validation.current?.isValid ?? false;
    const hasStats = stats !== null;

    let allDescribed = false;
    if (stats) {
      const totalCountable = stats.totalElements - stats.dataFlows;
      allDescribed =
        stats.describedElements === totalCountable &&
        stats.describedConnections === stats.dataFlows;
    }

    return {
      isDirty,
      isValid,
      allDescribed,
      hasStats,
    };
  }, [persistence.isDirty, validation.current, stats]);

  /**
   * Can proceed to next phase?
   * Requirements:
   * 1. Not dirty (all changes saved)
   * 2. Valid (no validation errors)
   * 3. All elements described
   * 4. Stats available
   */
  const canProceed = useMemo(() => {
    return (
      !completionStatus.isDirty &&
      completionStatus.isValid &&
      completionStatus.allDescribed &&
      completionStatus.hasStats
    );
  }, [completionStatus]);

  // ==================== ACTIONS ====================

  /**
   * Proceed to next phase
   * Only works if canProceed is true
   */
  const proceed = useCallback(() => {
    if (!canProceed) {
      console.warn(
        "[useDFDCompletion] Cannot proceed - requirements not met:",
        completionStatus,
      );
      return;
    }

    console.log("[useDFDCompletion] Proceeding to next phase");
    onPhaseComplete?.();
  }, [canProceed, completionStatus, onPhaseComplete]);

  // ==================== RETURN ====================

  return {
    canProceed,
    completionStatus,
    proceed,
  };
}

export default useDFDCompletion;