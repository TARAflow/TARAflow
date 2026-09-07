// ==================== USE RISK FILTERS HOOK ====================
// Manages filter state and filtering logic for risks.
// RiskStatus removed — risks no longer have a status field.
// Filter by: searchText, priorityFilter (MoSCoW), treatmentFilter, riskLevelFilter.

import { useState, useCallback, useMemo } from "react";
import type { Risk } from "../../models/risk-assessment-types";
import type {
  MoSCoWPriority,
  RiskTreatment,
  RiskScaleType,
  RiskRoundingMethod,
} from "../../models/risk-scale-types";
import { RISK_SCALES } from "../../models/risk-scale-types";

// ==================== TYPES ====================

export interface RiskFilters {
  searchText: string;
  priorityFilter: MoSCoWPriority | "";
  treatmentFilter: RiskTreatment | "";
  /** Selected risk level (RiskScaleLevel.value, 1..N) or "" for all. */
  riskLevelFilter: number | "";
}

/** Scale context needed to map a numeric risk score to a discrete level. */
export interface RiskLevelContext {
  scale: RiskScaleType;
  roundingMethod: RiskRoundingMethod;
}

// ==================== HELPERS ====================

/**
 * Discrete level (1..N) a numeric risk score falls into for the active scale.
 * Mirrors calculateLevelIndex in risk-scale-types (the same mapping used by
 * getRiskLabel and the accordion header chips). 0 means "not rated".
 */
function riskLevelValue(
  value: number,
  scale: RiskScaleType,
  roundingMethod: RiskRoundingMethod,
): number {
  if (value <= 0) return 0;
  const levels = RISK_SCALES[scale].levels.length;
  const idx =
    roundingMethod === "ceil"
      ? Math.min(Math.max(Math.ceil(value) - 1, 0), levels - 1)
      : Math.min(Math.max(Math.round(value) - 1, 0), levels - 1);
  return idx + 1;
}

// ==================== HOOK ====================

export function useRiskFilters() {
  const [filters, setFilters] = useState<RiskFilters>({
    searchText: "",
    priorityFilter: "",
    treatmentFilter: "",
    riskLevelFilter: "",
  });

  const setSearchText = useCallback((text: string) => {
    setFilters((prev) => ({ ...prev, searchText: text }));
  }, []);

  const setPriorityFilter = useCallback((priority: MoSCoWPriority | "") => {
    setFilters((prev) => ({ ...prev, priorityFilter: priority }));
  }, []);

  const setTreatmentFilter = useCallback((treatment: RiskTreatment | "") => {
    setFilters((prev) => ({ ...prev, treatmentFilter: treatment }));
  }, []);

  const setRiskLevelFilter = useCallback((level: number | "") => {
    setFilters((prev) => ({ ...prev, riskLevelFilter: level }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      searchText: "",
      priorityFilter: "",
      treatmentFilter: "",
      riskLevelFilter: "",
    });
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.searchText ||
        filters.priorityFilter ||
        filters.treatmentFilter ||
        filters.riskLevelFilter !== "",
      ),
    [filters],
  );

  const filterRisks = useCallback(
    (risks: Risk[], context?: RiskLevelContext): Risk[] => {
      if (!hasActiveFilters) return risks;
      let filtered = risks;

      if (filters.priorityFilter) {
        filtered = filtered.filter(
          (r) => r.moscowPriority === filters.priorityFilter,
        );
      }
      if (filters.treatmentFilter) {
        filtered = filtered.filter(
          (r) => r.treatment === filters.treatmentFilter,
        );
      }
      // Risk-level filter needs the scale/rounding to map the score to a level.
      // Skipped when no context is supplied (keeps the filter a no-op rather
      // than guessing a scale).
      if (filters.riskLevelFilter !== "" && context) {
        filtered = filtered.filter(
          (r) =>
            riskLevelValue(
              r.calculatedRiskBeforeMitigation,
              context.scale,
              context.roundingMethod,
            ) === filters.riskLevelFilter,
        );
      }
      if (filters.searchText.trim()) {
        const search = filters.searchText.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.id.toLowerCase().includes(search) ||
            r.threatDisplayId.toLowerCase().includes(search) ||
            r.threatDescription.toLowerCase().includes(search) ||
            r.selectedMitigations.some(
              (m) =>
                (m.id ?? "").toLowerCase().includes(search) ||
                (m.notes ?? "").toLowerCase().includes(search),
            ),
        );
      }
      return filtered;
    },
    [filters, hasActiveFilters],
  );

  return {
    filters,
    setSearchText,
    setPriorityFilter,
    setTreatmentFilter,
    setRiskLevelFilter,
    clearFilters,
    filterRisks,
    hasActiveFilters,
  };
}