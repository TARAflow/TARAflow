// ==================== RISK DIALOG — useRiskDialogState ====================
// Split out of risk-dialog.tsx (MT-2): the risk list order, the open risk, the tab, the
// editable copy (initialised with the asset / EL pre-fill when the risk changes).

import { useState, useMemo, useRef, useEffect } from "react";
import type { RiskDialogProps } from "./types";
import { riskToLocal, type LocalRiskState } from "./local-risk-state";
import { compareDisplayIds } from "shared";
import type { AssetReference } from "shared";
import { applyAssetCriteriaToFactorRatings, applyAssetImpactToFactorRatings } from "../../services/risk-calculation-service";
import { applyExposureLevelToFactorRatings } from "../../services/en50742-risk-calculation";

export type UseRiskDialogStateInput = Pick<RiskDialogProps, "open" | "risks" | "initialIndex" | "configuration" | "threats" | "assetDataRef" | "dfdData">;

export function useRiskDialogState({
  open,
  risks,
  initialIndex,
  configuration,
  threats,
  assetDataRef,
  dfdData,
}: UseRiskDialogStateInput) {
  // ── Sidebar sort: highest risk score first ───────────────────────────────
  // Ascending display id (AT-1.1 … AT-10.2), as the risk table (user
  // 2026-10-30). The classic score order looked random under ISO/SAE 21434,
  // whose risk value is not calculatedRiskBeforeMitigation.
  const sortedRisks = useMemo(
    () =>
      [...risks].sort((a, b) =>
        compareDisplayIds(a.threatDisplayId, b.threatDisplayId),
      ),
    [risks],
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(() => {
    const id = risks[initialIndex]?.id;
    const idx = sortedRisks.findIndex((r) => r.id === id);
    return idx >= 0 ? idx : initialIndex;
  });
  const currentRisk = sortedRisks[currentIndex] ?? null;

  const [tabValue, setTabValue] = useState(0);
  const [local, setLocal] = useState<LocalRiskState | null>(null);
  const [showSrslTables, setShowSrslTables] = useState(false);
  const isProcessing = useRef(false);

  // ── Init local state when risk changes (with optional asset-impact pre-fill) ─
  useEffect(() => {
    if (!currentRisk) return;
    let state = riskToLocal(currentRisk);

    if (
      configuration.useAssetImpact &&
      currentRisk.linkedAssetIds?.length &&
      assetDataRef
    ) {
      const linkedAssets = currentRisk.linkedAssetIds
        .map((id) => assetDataRef.assets.find((a) => a.id === id))
        .filter((a): a is AssetReference => Boolean(a));

      if (linkedAssets.length > 0) {
        const hasPerCriterionData = linkedAssets.some(
          (a) => a.impactRatings && a.impactRatings.length > 0,
        );

        if (hasPerCriterionData) {
          // Phase 3: direct 1:1 criterion → factor mapping (non-destructive)
          state = {
            ...state,
            factorRatings: applyAssetCriteriaToFactorRatings(
              state.factorRatings,
              linkedAssets,
              assetDataRef,
              configuration,
              currentRisk.strideCategory,
            ),
          };
        } else {
          // Legacy fallback: aggregated impact → all impact factors
          const levels = linkedAssets
            .map((a) => a.aggregatedImpact)
            .filter(Boolean) as string[];
          if (levels.length > 0) {
            state = {
              ...state,
              factorRatings: applyAssetImpactToFactorRatings(
                state.factorRatings,
                levels as any,
                configuration,
              ),
            };
          }
        }
      }
    }

    // EN 50742 EL prefill (§11.2, Variante A) — independent of asset linkage,
    // reads exposureLevel from the threat's DFD anchor (Interface / crossing
    // DataFlow). No-op when the risk has no exposure_level entry
    // (non-en-50742-a projects) or it's already rated/manual.
    const currentThreatForEL = threats?.find(
      (t) => t.id === currentRisk.threatId,
    );
    state = {
      ...state,
      factorRatings: applyExposureLevelToFactorRatings(
        state.factorRatings,
        currentThreatForEL ?? {},
        dfdData,
      ),
    };

    setLocal(state);
    // Only when another risk opens — later prop changes must not overwrite
    // the analyst's edits in the local copy.
  }, [currentRisk?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      const id = risks[initialIndex]?.id;
      const idx = sortedRisks.findIndex((r) => r.id === id);
      setCurrentIndex(idx >= 0 ? idx : initialIndex);
      setTabValue(0);
    }
  }, [open, initialIndex]);

  return {
    sortedRisks,
    currentRisk,
    isProcessing,
    currentIndex,
    setCurrentIndex,
    tabValue,
    setTabValue,
    local,
    setLocal,
    showSrslTables,
    setShowSrslTables,
  };
}
