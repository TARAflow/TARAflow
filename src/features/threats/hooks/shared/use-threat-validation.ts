// ==================== USE THREAT VALIDATION ====================
// Counts reviewed vs total threats — no field completeness check.

import { useMemo } from "react";
import type { ThreatTable } from "../../models/threat-types";
import { isThreatRated } from "../../services/threat-phase-status";

export interface ValidationResult {
  stats: {
    total: number;
    reviewed: number;
  };
}

export function useThreatValidation(tables: ThreatTable[]): ValidationResult {
  return useMemo(() => {
    let total = 0;
    let reviewed = 0;

    for (const table of tables) {
      for (const threat of table.threats) {
        total++;
        if (isThreatRated(threat)) reviewed++;
      }
    }

    return { stats: { total, reviewed } };
  }, [tables]);
}