// ==================== USE RISK FILTERS HOOK ====================
// Manages filter state and filtering logic for risks.
// RiskStatus removed — risks no longer have a status field.
// Filter by: searchText, priorityFilter (MoSCoW), treatmentFilter.

import { useState, useCallback, useMemo } from "react";
import type {
  Risk,
  MoSCoWPriority,
  RiskTreatment,
} from "../../models/risk-types";

// ==================== TYPES ====================

export interface RiskFilters {
  searchText: string;
  priorityFilter: MoSCoWPriority | "";
  treatmentFilter: RiskTreatment | "";
}

// ==================== HOOK ====================

export function useRiskFilters() {
  const [filters, setFilters] = useState<RiskFilters>({
    searchText: "",
    priorityFilter: "",
    treatmentFilter: "",
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

  const clearFilters = useCallback(() => {
    setFilters({ searchText: "", priorityFilter: "", treatmentFilter: "" });
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.searchText || filters.priorityFilter || filters.treatmentFilter,
      ),
    [filters],
  );

  const filterRisks = useCallback(
    (risks: Risk[]): Risk[] => {
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
      if (filters.searchText.trim()) {
        const search = filters.searchText.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.id.toLowerCase().includes(search) ||
            r.threatId.toLowerCase().includes(search) ||
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
    clearFilters,
    filterRisks,
    hasActiveFilters,
  };
}