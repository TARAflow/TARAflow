// ==================== USE THREAT FILTERS ====================
// Shared hook for filtering threats by STRIDE category and search text

import { useState, useMemo, useCallback } from "react";
import type { StrideCategory } from "shared";
import type { Threat } from "../../models/threat-types";

// ==================== TYPES ====================

// Derived from the model instead of redeclared, so a future change to
// Threat["relevance"] (e.g. a new status) surfaces here as a type error
// instead of silently falling out of sync.
export type ThreatRelevanceFilter = Threat["relevance"] | "";

export interface ThreatFilters {
  strideCategory: StrideCategory | "";
  relevance: ThreatRelevanceFilter;
  searchText: string;
}

export interface UseThreatFiltersResult {
  filters: ThreatFilters;
  setStrideFilter: (category: StrideCategory | "") => void;
  setRelevanceFilter: (relevance: ThreatRelevanceFilter) => void;
  setSearchText: (text: string) => void;
  clearFilters: () => void;
  filterThreats: (threats: Threat[]) => Threat[];
  hasActiveFilters: boolean;
}

// ==================== HOOK ====================

export function useThreatFilters(): UseThreatFiltersResult {
  const [strideCategory, setStrideCategory] = useState<StrideCategory | "">("");
  const [relevance, setRelevance] = useState<ThreatRelevanceFilter>("");
  const [searchText, setSearchText] = useState("");

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!strideCategory || !!relevance || !!searchText.trim();
  }, [strideCategory, relevance, searchText]);

  // Filter function
  const filterThreats = useCallback(
    (threats: Threat[]): Threat[] => {
      let filtered = threats;

      // Filter by STRIDE category
      if (strideCategory) {
        filtered = filtered.filter((t) => t.strideCategory === strideCategory);
      }

      // Filter by relevance / triage status
      if (relevance) {
        filtered = filtered.filter((t) => t.relevance === relevance);
      }

      // Filter by search text
      if (searchText.trim()) {
        const searchLower = searchText.toLowerCase();
        filtered = filtered.filter((t) => {
          // Search in ID
          if (t.id.toLowerCase().includes(searchLower)) return true;

          // Search in descriptions
          if (t.threatDescription?.toLowerCase().includes(searchLower))
            return true;
          if (t.attackDescription?.toLowerCase().includes(searchLower))
            return true;
          if (
            t.proposedMitigations.some((m) =>
              m.notes?.toLowerCase().includes(searchLower),
            )
          )
            return true;

          // Search in linked element name
          if (t.linkedElement?.elementName.toLowerCase().includes(searchLower))
            return true;

          // Search in data flow names
          if (t.dataFlow) {
            if (t.dataFlow.sourceName.toLowerCase().includes(searchLower))
              return true;
            if (t.dataFlow.targetName.toLowerCase().includes(searchLower))
              return true;
            if (t.dataFlow.dataFlowName.toLowerCase().includes(searchLower))
              return true;
          }

          return false;
        });
      }

      return filtered;
    },
    [strideCategory, relevance, searchText],
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setStrideCategory("");
    setRelevance("");
    setSearchText("");
  }, []);

  return {
    filters: { strideCategory, relevance, searchText },
    setStrideFilter: setStrideCategory,
    setRelevanceFilter: setRelevance,
    setSearchText,
    clearFilters,
    filterThreats,
    hasActiveFilters,
  };
}