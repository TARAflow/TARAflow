// ==================== USE RISK FILTERS HOOK ====================
// Manages filter state and filtering logic for risks.
// RiskStatus removed — risks no longer have a status field.
// Filter by: searchText, priorityFilter (MoSCoW), treatmentFilter, riskLevelFilter.

import { isoReviewItems } from "../../models/iso-scenarios";
import { useState, useCallback, useMemo } from "react";
import {
  NO_DFD_SCOPE_FILTER,
  dfdScopePredicate,
  type DfdScopeFilter,
  type DfdScopeIndex,
  type ThreatReference,
} from "shared";
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
  /** Leveled DFD: page and analysis state of the risk's threat (6f). */
  scope: DfdScopeFilter;
  /** ISO/SAE 21434: only the decisions to review (plan 3a-3, E5). */
  isoReviewOnly?: boolean;
}

/** Scale context needed to map a numeric risk score to a discrete level. */
export interface RiskLevelContext {
  scale: RiskScaleType;
  roundingMethod: RiskRoundingMethod;
  /** iso-21434: the filter compares the ISO risk value 1–5 (plan 3a-2). */
  likelihoodMethod?: string;
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

/** `scopeIndex`: the page index of a leveled DFD; absent for a classic one. */
export function useRiskFilters(scopeIndex?: DfdScopeIndex) {
  const [filters, setFilters] = useState<RiskFilters>({
    searchText: "",
    priorityFilter: "",
    treatmentFilter: "",
    riskLevelFilter: "",
    scope: NO_DFD_SCOPE_FILTER,
    isoReviewOnly: false,
  });
  const inScope = useMemo(
    () => dfdScopePredicate(scopeIndex, filters.scope),
    [scopeIndex, filters.scope],
  );

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

  const setScopeFilter = useCallback((scope: DfdScopeFilter) => {
    setFilters((prev) => ({ ...prev, scope }));
  }, []);

  const setIsoReviewOnly = useCallback((isoReviewOnly: boolean) => {
    setFilters((prev) => ({ ...prev, isoReviewOnly }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      searchText: "",
      priorityFilter: "",
      treatmentFilter: "",
      riskLevelFilter: "",
      scope: NO_DFD_SCOPE_FILTER,
      isoReviewOnly: false,
    });
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.searchText ||
        filters.priorityFilter ||
        filters.treatmentFilter ||
        filters.riskLevelFilter !== "" ||
        filters.isoReviewOnly ||
        inScope,
      ),
    [filters, inScope],
  );

  const filterRisks = useCallback(
    /** `threats`: the threats of the risks, for the page filter.
     *  `ignoreScope`: risks without a DFD item (attack-path risks) — the page
     *  filter does not apply to them. */
    (
      risks: Risk[],
      context?: RiskLevelContext,
      threats?: ThreatReference[],
      ignoreScope = false,
    ): Risk[] => {
      if (!hasActiveFilters) return risks;
      let filtered = risks;

      if (filters.isoReviewOnly) {
        const review = new Set(isoReviewItems(filtered).map((i) => i.risk.id));
        filtered = filtered.filter((r) => review.has(r.id));
      }

      if (inScope && !ignoreScope) {
        const threatById = new Map((threats ?? []).map((t) => [t.id, t]));
        filtered = filtered.filter((r) => {
          const threat = threatById.get(r.threatId);
          return (
            !!threat &&
            inScope({
              elementId: threat.linkedElement?.elementId,
              connectionId: threat.dataFlow?.connectionId,
            })
          );
        });
      }

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
      if (filters.riskLevelFilter !== "" && context?.likelihoodMethod === "iso-21434") {
        filtered = filtered.filter((r) => r.isoRisk?.value === filters.riskLevelFilter);
      } else if (filters.riskLevelFilter !== "" && context) {
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
    [filters, hasActiveFilters, inScope],
  );

  return {
    filters,
    setSearchText,
    setPriorityFilter,
    setTreatmentFilter,
    setRiskLevelFilter,
    setScopeFilter,
    setIsoReviewOnly,
    clearFilters,
    filterRisks,
    hasActiveFilters,
  };
}