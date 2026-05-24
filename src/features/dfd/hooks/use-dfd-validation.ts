// ==================== USE DFD VALIDATION HOOK ====================
// Single Responsibility: Manage DFD validation state and scheduling

import { useState, useCallback, useRef, useEffect } from "react";
import type { DFDProjectData } from "../models/dfd-types";
import type { ValidationResult } from "../services/dfd-validator";
import dfdService from "../services/dfd-service";

// ==================== TYPES ====================

export interface UseDFDValidationOptions {
  autoValidateDelay?: number; // Delay in ms for auto-validation (0 = disabled)
}

export interface UseDFDValidationReturn {
  // Current validation state
  current: ValidationResult | null;

  // Actions
  validate: () => ValidationResult;
  scheduleValidation: (delay?: number) => void;
  clearValidation: () => void;
}

// ==================== HOOK ====================

export function useDFDValidation(
  project: DFDProjectData,
  options: UseDFDValidationOptions = {},
): UseDFDValidationReturn {
  const { autoValidateDelay = 500 } = options;

  // ==================== STATE ====================

  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // ==================== REFS ====================

  const validateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Always-current project ref — validate() reads from here instead of
  // closing over project directly. This means validate() never needs to
  // be recreated when project.dfd changes, but it always validates the
  // latest data. Without this, validate() would use a stale project
  // (missing newly-set properties) until the component remounts.
  const projectRef = useRef<DFDProjectData>(project);
  projectRef.current = project;

  // ==================== VALIDATION ====================

  /**
   * Run validation immediately against the current project state.
   */
  const validate = useCallback((): ValidationResult => {
    try {
      console.log("[useDFDValidation] Running validation...");

      // Read from ref — always current, never stale
      const result = dfdService.validateCurrentState(projectRef.current);
      setValidation(result);

      console.log(
        `[useDFDValidation] Validation complete: ${result.isValid ? "VALID" : "INVALID"} (${result.errors.length} errors, ${result.warnings.length} warnings)`,
      );

      return result;
    } catch (error) {
      console.error("[useDFDValidation] Validation failed:", error);

      const emptyResult: ValidationResult = {
        isValid: false,
        isComplete: false,
        errors: ["Validation error: " + (error as Error).message],
        warnings: [],
        scenario: null,
      };

      setValidation(emptyResult);
      return emptyResult;
    }
    // Stable — reads current project via ref, no deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Schedule validation with debounce
   */
  const scheduleValidation = useCallback(
    (delay?: number) => {
      const actualDelay = delay ?? autoValidateDelay;

      if (actualDelay <= 0) {
        return; // Auto-validation disabled
      }

      // Clear existing timeout
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }

      // Schedule new validation
      validateTimeoutRef.current = setTimeout(() => {
        validate();
        validateTimeoutRef.current = null;
      }, actualDelay);

      console.log(
        `[useDFDValidation] Validation scheduled in ${actualDelay}ms`,
      );
    },
    [autoValidateDelay, validate],
  );

  /**
   * Clear current validation state
   */
  const clearValidation = useCallback(() => {
    setValidation(null);
  }, []);

  // ==================== CLEANUP ====================

  useEffect(() => {
    return () => {
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }
    };
  }, []);

  // ==================== RETURN ====================

  return {
    current: validation,
    validate,
    scheduleValidation,
    clearValidation,
  };
}

export default useDFDValidation;