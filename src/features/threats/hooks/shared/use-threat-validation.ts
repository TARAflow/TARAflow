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
        const hasMitigation = !!threat.mitigation?.trim();
        const hasVerification = !!threat.verification?.trim();

        // Check required fields
        if (!hasDescription) {
          errors.push(`Threat ${threat.id}: Missing threat description`);
        }

        // Check warnings
        if (!hasAttack) {
          warnings.push(`Threat ${threat.id}: Missing attack description`);
        }
        if (!hasMitigation) {
          warnings.push(`Threat ${threat.id}: Missing mitigation`);
        }
        if (!hasVerification) {
          warnings.push(`Threat ${threat.id}: Missing verification`);
        }

        // Count as completed if has at minimum: description + mitigation
        if (hasDescription && hasMitigation) {
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