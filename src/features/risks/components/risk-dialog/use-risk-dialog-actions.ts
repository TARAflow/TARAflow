// ==================== RISK DIALOG — useRiskDialogActions ====================
// Split out of risk-dialog.tsx (MT-2): saving (on switch, OK and auto-save), navigation
// and the updaters of the editable copy.

import { useCallback, useEffect } from "react";
import type { RiskDialogProps } from "./types";
import type { useRiskDialogState } from "./use-risk-dialog-state";
import type { useRiskDialogDerived } from "./use-risk-dialog-derived";
import type { MitigationPropertyRole } from "shared";
import { resetFactorToDerived } from "../../services/risk-calculation-service";
import { EN50742_EL_FACTOR } from "../../services/en50742-risk-calculation";

export type UseRiskDialogActionsInput = Pick<RiskDialogProps, "onSave" | "onClose"> &
  Pick<ReturnType<typeof useRiskDialogState>, "sortedRisks" | "currentRisk" | "isProcessing" | "currentIndex" | "setCurrentIndex" | "setTabValue" | "local" | "setLocal"> &
  Pick<ReturnType<typeof useRiskDialogDerived>, "beforeValues" | "afterValues">;

export function useRiskDialogActions({
  onSave,
  onClose,
  sortedRisks,
  currentRisk,
  isProcessing,
  currentIndex,
  setCurrentIndex,
  setTabValue,
  local,
  setLocal,
  beforeValues,
  afterValues,
}: UseRiskDialogActionsInput) {
  // ── Save current risk ─────────────────────────────────────────────────────
  const saveCurrentRisk = useCallback(() => {
    if (!currentRisk || !local) return;
    onSave(currentRisk.id, {
      factorRatings: local.factorRatings,
      mitigatedFactorRatings: local.mitigatedFactorRatings,
      selectedMitigations: local.selectedMitigations,
      selectedVerifications: local.selectedVerifications,
      treatment: local.treatment,
      treatmentJustification: local.treatmentJustification,
      moscowPriority: local.moscowPriority,
      wontJustification: local.wontJustification,
      riskBeforeRationale: local.riskBeforeRationale,
      riskAfterRationale: local.riskAfterRationale,

      calculatedImpact: beforeValues.impact,
      calculatedLikelihood: beforeValues.likelihood,
      calculatedRiskBeforeMitigation: beforeValues.risk,
      calculatedRiskAfterMitigation: afterValues.risk,
      calculatedSrsl: beforeValues.srsl,
      calculatedApScore: beforeValues.apScore,
      calculatedApBand: beforeValues.apBand,
    });
  }, [currentRisk, local, beforeValues, afterValues, onSave]);

  // ── Navigate ──────────────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (index: number) => {
      saveCurrentRisk();
      setCurrentIndex(index);
      setTabValue(0);
    },
    [saveCurrentRisk],
  );

  const handlePrev = useCallback(() => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    navigateTo(Math.max(0, currentIndex - 1));
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  }, [currentIndex, navigateTo]);

  const handleNext = useCallback(() => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    navigateTo(Math.min(sortedRisks.length - 1, currentIndex + 1));
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  }, [currentIndex, sortedRisks.length, navigateTo]);

  const handleSave = useCallback(() => {
    saveCurrentRisk();
    onClose();
  }, [saveCurrentRisk, onClose]);

  // ── Local state updaters ──────────────────────────────────────────────────
  const updateFactor = useCallback(
    (factorId: string, value: number, mitigated: boolean) => {
      setLocal((prev) => {
        if (!prev) return prev;
        const key = mitigated ? "mitigatedFactorRatings" : "factorRatings";
        const existing = prev[key].find((r) => r.factorId === factorId);

        if (!existing) {
          // Factor missing from ratings (e.g. added after risk was created) — add it
          return {
            ...prev,
            [key]: [...prev[key], { factorId, value, weight: 1.0 }],
          };
        }

        return {
          ...prev,
          [key]: prev[key].map((r) => {
            if (r.factorId !== factorId) return r;

            // EL-specific: choosing "Not rated" means "I don't want to
            // override this — let the DFD derive it again", not "I insist
            // the value is exposed level zero forever". Every other derived
            // factor (impact, etc.) keeps the general rule below, where any
            // value the analyst picks — including 0 — is a deliberate manual
            // choice that freezes until reset. EL differs because its
            // "derived" source (the DFD) can change on its own at any time,
            // unprompted by the analyst, unlike Asset Tab data which the
            // analyst is actively editing when they'd want an override to
            // stick. Mirrors what the ↺ Reset button already does, just
            // reachable without a second click, and without requiring a
            // prior derivedValue to exist (works even if EL was never
            // derived yet).
            if (r.factorId === EN50742_EL_FACTOR && value === 0) {
              return {
                ...r,
                value: 0,
                derivedValue: undefined,
                source: undefined,
              };
            }

            const isReturningToDerived =
              r.derivedValue !== undefined && value === r.derivedValue;
            return {
              ...r,
              value,
              source: isReturningToDerived
                ? ("derived" as const)
                : r.derivedValue !== undefined
                  ? ("manual" as const)
                  : undefined,
            };
          }),
        };
      });
    },
    [],
  );

  /** Reset a factor back to its Asset-derived value. Clears the Overridden chip. */
  const handleResetFactor = useCallback(
    (factorId: string, mitigated: boolean) => {
      setLocal((prev) => {
        if (!prev) return prev;
        const key = mitigated ? "mitigatedFactorRatings" : "factorRatings";
        return {
          ...prev,
          [key]: prev[key].map((r) =>
            r.factorId === factorId ? resetFactorToDerived(r) : r,
          ),
        };
      });
    },
    [],
  );

  const setScopeOverride = useCallback(
    (id: string, scopeOverride: MitigationPropertyRole[] | undefined) => {
      setLocal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedMitigations: prev.selectedMitigations.map((m) =>
            m.id === id ? { ...m, scopeOverride } : m,
          ),
        };
      });
    },
    [],
  );

  const toggleVerification = useCallback((id: string) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const has = prev.selectedVerifications.includes(id);
      return {
        ...prev,
        selectedVerifications: has
          ? prev.selectedVerifications.filter((v) => v !== id)
          : [...prev.selectedVerifications, id],
      };
    });
  }, []);

  const handleCopyToMitigated = useCallback(() => {
    setLocal((prev) =>
      prev
        ? {
            ...prev,
            mitigatedFactorRatings: prev.factorRatings.map((r) => ({ ...r })),
          }
        : prev,
    );
  }, []);

  // Auto-save whenever local state changes
  useEffect(() => {
    if (!currentRisk || !local) return;
    onSave(currentRisk.id, {
      factorRatings: local.factorRatings,
      mitigatedFactorRatings: local.mitigatedFactorRatings,
      selectedMitigations: local.selectedMitigations,
      selectedVerifications: local.selectedVerifications,
      treatment: local.treatment,
      treatmentJustification: local.treatmentJustification,
      moscowPriority: local.moscowPriority,
      wontJustification: local.wontJustification,
      riskBeforeRationale: local.riskBeforeRationale,
      riskAfterRationale: local.riskAfterRationale,

      calculatedImpact: beforeValues.impact,
      calculatedLikelihood: beforeValues.likelihood,
      calculatedRiskBeforeMitigation: beforeValues.risk,
      calculatedRiskAfterMitigation: afterValues.risk,
      calculatedSrsl: beforeValues.srsl,
      calculatedApScore: beforeValues.apScore,
      calculatedApBand: beforeValues.apBand,
    });
    // Every edit of the local copy is saved; the calculated values follow
    // from it in the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return {
    saveCurrentRisk,
    navigateTo,
    handlePrev,
    handleNext,
    handleSave,
    updateFactor,
    handleResetFactor,
    setScopeOverride,
    toggleVerification,
    handleCopyToMitigated,
  };
}
