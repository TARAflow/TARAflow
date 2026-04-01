// ==================== USE DFD AUTO NUMBERING HOOK ====================
// Single Responsibility: Manage auto-numbering of DFD elements

import { useState, useCallback } from "react";
import type { UseDrawioBridgeReturn } from "./use-drawio-bridge";
import type { UseDFDValidationReturn } from "./use-dfd-validation";
import type { UseDFDPersistenceReturn } from "./use-dfd-persistence";
import { DFDAutoNumbering } from "../services/dfd-auto-numbering";

// ==================== TYPES ====================

export interface UseDFDAutoNumberingOptions {
  /** Alignment tolerance in px (default: 50) */
  tolerance?: number;
  /** Sort strategy (default: diagonal) */
  sortStrategy?: "top-down" | "left-right" | "diagonal";
  /** X weight for diagonal scoring (default: 0.8) */
  weightX?: number;
  /** Y weight for diagonal scoring (default: 1.0) */
  weightY?: number;
  /** Whether to validate after auto-numbering (default: true) */
  validateAfter?: boolean;
  /** Delay in ms before validation (default: 500) */
  validationDelay?: number;
}

export interface UseDFDAutoNumberingReturn {
  // State
  isNumbering: boolean;

  // Actions
  autoNumber: () => Promise<void>;
}

// ==================== HOOK ====================

export function useDFDAutoNumbering(
  bridge: UseDrawioBridgeReturn,
  validation: UseDFDValidationReturn,
  persistence: UseDFDPersistenceReturn,
  options: UseDFDAutoNumberingOptions = {},
): UseDFDAutoNumberingReturn {
  const {
    tolerance = 50,
    sortStrategy = "diagonal",
    weightX = 0.8,
    weightY = 1.0,
    validateAfter = true,
    validationDelay = 500,
  } = options;

  // ==================== STATE ====================

  const [isNumbering, setIsNumbering] = useState(false);

  // ==================== AUTO NUMBERING ====================

  /**
   * Auto-number all elements in the DFD using the configured sort strategy.
   */
  const autoNumber = useCallback(async () => {
    if (isNumbering) {
      console.log("[useDFDAutoNumbering] Already numbering, skipping...");
      return;
    }

    setIsNumbering(true);
    console.log("[useDFDAutoNumbering] Starting auto-numbering...");

    try {
      const currentXml = bridge.getCurrentXML();

      if (!currentXml) {
        console.warn("[useDFDAutoNumbering] No XML found");
        setIsNumbering(false);
        return;
      }

      const numbering = new DFDAutoNumbering(
        tolerance,
        sortStrategy,
        weightX,
        weightY,
      );

      // Apply auto-numbering
      const numberedXml = numbering.autoNumber(currentXml);

      // Check if anything changed
      if (numberedXml === currentXml) {
        console.log("[useDFDAutoNumbering] No changes after auto-numbering");
        setIsNumbering(false);
        return;
      }

      // Load numbered XML back into editor
      await bridge.loadXML(numberedXml);

      // Mark as dirty
      persistence.markDirty();

      // Schedule validation
      if (validateAfter) {
        validation.scheduleValidation(validationDelay);
      }

      console.log("[useDFDAutoNumbering] Auto-numbering complete");
    } catch (error) {
      console.error("[useDFDAutoNumbering] Auto-numbering failed:", error);
    } finally {
      setIsNumbering(false);
    }
  }, [
    isNumbering,
    bridge,
    persistence,
    validation,
    tolerance,
    sortStrategy,
    weightX,
    weightY,
    validateAfter,
    validationDelay,
  ]);

  // ==================== RETURN ====================

  return {
    isNumbering,
    autoNumber,
  };
}

export default useDFDAutoNumbering;