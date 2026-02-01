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

  // ==================== VALIDATION ====================

  /**
   * Run validation immediately
   */
  const validate = useCallback((): ValidationResult => {
    try {
      console.log("[useDFDValidation] Running validation...");

      const result = dfdService.validateCurrentState(project.id);
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
  }, [project.id]);

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