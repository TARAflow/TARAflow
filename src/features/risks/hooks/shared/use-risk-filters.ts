// ==================== USE RISK FILTERS HOOK ====================
// Manages filter state and filtering logic for risks
// Analog to use-threat-filters.ts

import { useState, useCallback, useMemo } from "react";
import type { Risk, MoSCoWPriority, RiskStatus } from "../../models/risk-types";

// ==================== TYPES ====================

export interface RiskFilters {
  searchText: string;
  priorityFilter: MoSCoWPriority | "";
  statusFilter: RiskStatus | "";
}

// ==================== HOOK ====================

export function useRiskFilters() {
  const [filters, setFilters] = useState<RiskFilters>({
    searchText: "",
    priorityFilter: "",
    statusFilter: "",
  });

  // Individual setters
  const setSearchText = useCallback((text: string) => {
    setFilters((prev) => ({ ...prev, searchText: text }));
  }, []);

  const setPriorityFilter = useCallback((priority: MoSCoWPriority | "") => {
    setFilters((prev) => ({ ...prev, priorityFilter: priority }));
  }, []);

  const setStatusFilter = useCallback((status: RiskStatus | "") => {
    setFilters((prev) => ({ ...prev, statusFilter: status }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      searchText: "",
      priorityFilter: "",
      statusFilter: "",
    });
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.searchText || filters.priorityFilter || filters.statusFilter
      ),
    [filters]
  );

  // Filter risks based on current filters
  const filterRisks = useCallback(
    (risks: Risk[]): Risk[] => {
      if (!hasActiveFilters) return risks;

      let filtered = risks;

      // Filter by priority
      if (filters.priorityFilter) {
        filtered = filtered.filter(
          (r) => r.moscowPriority === filters.priorityFilter
        );
      }

      // Filter by status
      if (filters.statusFilter) {
        filtered = filtered.filter((r) => r.status === filters.statusFilter);
      }

      // Filter by search text
      if (filters.searchText.trim()) {
        const search = filters.searchText.toLowerCase();
        filtered = filtered.filter((r) => {
          return (
            r.id.toLowerCase().includes(search) ||
            r.threatId.toLowerCase().includes(search) ||
            r.threatDescription.toLowerCase().includes(search) ||
            r.selectedMitigations.some((m) => m.toLowerCase().includes(search))
          );
        });
      }

      return filtered;
    },
    [filters, hasActiveFilters]
  );

  return {
    filters,
    setSearchText,
    setPriorityFilter,
    setStatusFilter,
    clearFilters,
    filterRisks,
    hasActiveFilters,
  };
}