// ==================== USE THREAT FILTERS ====================
// Shared hook for filtering threats by STRIDE category and search text;
// for a leveled DFD also by page and analysis state (6f).

import { useState, useMemo, useCallback } from "react";
import {
  NO_DFD_SCOPE_FILTER,
  dfdScopePredicate,
  isDfdScopeFilterActive,
  type DfdScopeFilter,
  type DfdScopeIndex,
  type StrideCategory,
} from "shared";
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
  /** Leveled DFD: page and analysis state. */
  scope: DfdScopeFilter;
}

export interface UseThreatFiltersResult {
  filters: ThreatFilters;
  setStrideFilter: (category: StrideCategory | "") => void;
  setRelevanceFilter: (relevance: ThreatRelevanceFilter) => void;
  setSearchText: (text: string) => void;
  setScopeFilter: (scope: DfdScopeFilter) => void;
  clearFilters: () => void;
  filterThreats: (threats: Threat[]) => Threat[];
  hasActiveFilters: boolean;
}

// ==================== HOOK ====================

/** `scopeIndex`: the page index of a leveled DFD; absent for a classic one. */
export function useThreatFilters(scopeIndex?: DfdScopeIndex): UseThreatFiltersResult {
  const [strideCategory, setStrideCategory] = useState<StrideCategory | "">("");
  const [relevance, setRelevance] = useState<ThreatRelevanceFilter>("");
  const [searchText, setSearchText] = useState("");
  const [scope, setScopeFilter] = useState<DfdScopeFilter>(NO_DFD_SCOPE_FILTER);
  const inScope = useMemo(() => dfdScopePredicate(scopeIndex, scope), [scopeIndex, scope]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!strideCategory || !!relevance || !!searchText.trim() || !!inScope;
  }, [strideCategory, relevance, searchText, inScope]);

  // Filter function
  const filterThreats = useCallback(
    (threats: Threat[]): Threat[] => {
      let filtered = threats;

      // Filter by page / analysis state (leveled DFD)
      if (inScope) {
        filtered = filtered.filter((t) =>
          inScope({
            elementId: t.linkedElement?.elementId,
            connectionId: t.dataFlow?.connectionId,
          }),
        );
      }

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
    [strideCategory, relevance, searchText, inScope],
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setStrideCategory("");
    setRelevance("");
    setSearchText("");
    setScopeFilter(NO_DFD_SCOPE_FILTER);
  }, []);

  return {
    filters: { strideCategory, relevance, searchText, scope },
    setStrideFilter: setStrideCategory,
    setRelevanceFilter: setRelevance,
    setSearchText,
    setScopeFilter,
    clearFilters,
    filterThreats,
    hasActiveFilters,
  };
}