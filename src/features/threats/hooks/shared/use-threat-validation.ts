// ==================== USE THREAT VALIDATION ====================
// Shared hook for threat validation logic

import { useMemo } from "react";
import type { ThreatTable } from "../../models/threat-types";

// ==================== TYPES ====================

export interface ValidationResult {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    total: number;
    completed: number;
    incomplete: number;
  };
}

// ==================== HOOK ====================

export function useThreatValidation(tables: ThreatTable[]): ValidationResult {
  return useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let total = 0;
    let completed = 0;

    for (const table of tables) {
      for (const threat of table.threats) {
        total++;

        const hasDescription = !!threat.threatDescription?.trim();
        const hasAttack = !!threat.attackDescription?.trim();
        const hasMitigations = threat.proposedMitigations.length > 0;
        const hasVerifications = threat.proposedVerifications.length > 0;

        // Check required fields
        if (!hasDescription) {
          errors.push(`Threat ${threat.id}: Missing threat description`);
        }

        // Check warnings
        if (!hasAttack) {
          warnings.push(`Threat ${threat.id}: Missing attack description`);
        }
        if (!hasMitigations) {
          warnings.push(`Threat ${threat.id}: No mitigations proposed`);
        }
        if (!hasVerifications) {
          warnings.push(`Threat ${threat.id}: No verifications proposed`);
        }

        // Count as completed if reviewed or closed
        if (
          threat.workflowStatus === "reviewed" ||
          threat.workflowStatus === "closed"
        ) {
          completed++;
        }
      }
    }

    return {
      isComplete: errors.length === 0 && total > 0,
      errors,
      warnings,
      stats: {
        total,
        completed,
        incomplete: total - completed,
      },
    };
  }, [tables]);
}