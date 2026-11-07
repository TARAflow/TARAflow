// ==================== RISK DIALOG — MODEL ====================
// Split out of risk-dialog.tsx (MT-2): composes the state hooks in their original order (the
// effects run in that order) and adds the values that need the open risk.

import { useTranslation } from "react-i18next";
import type { RiskDialogProps } from "./types";
import { useRiskDialogState } from "./use-risk-dialog-state";
import { useRiskDialogDerived } from "./use-risk-dialog-derived";
import { useRiskDialogActions } from "./use-risk-dialog-actions";
import { useMitigationSelection } from "./use-mitigation-selection";
import { ISO_AP_FACTOR_IDS } from "./local-risk-state";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "../../models/risk-factor-types";
import { liveIsoRisk } from "../../models/iso-risk-display";
import { getFactorDefinition } from "../../models/risk-assessment-types";
import { RISK_TREATMENTS } from "../../models/risk-scale-types";

export function useRiskDialogModel(props: RiskDialogProps) {
  const { t } = useTranslation();
  const {
    open,
    risks,
    initialIndex,
    configuration,
    threats,
    assetDataRef,
    dfdData,
    onSave,
    onClose,
  } = props;

  const state = useRiskDialogState({ open, risks, initialIndex, configuration, threats, assetDataRef, dfdData });
  const { sortedRisks, isProcessing, currentIndex, setCurrentIndex, setTabValue, setLocal } = state;
  const derived = useRiskDialogDerived({
    configuration, threats, assetDataRef, sortedRisks,
    currentRisk: state.currentRisk, local: state.local, setLocal,
  });
  const actions = useRiskDialogActions({
    onSave, onClose, sortedRisks, currentRisk: state.currentRisk, isProcessing,
    currentIndex, setCurrentIndex, setTabValue, local: state.local, setLocal,
    beforeValues: derived.beforeValues, afterValues: derived.afterValues,
  });
  const selection = useMitigationSelection({ threats, dfdData, currentRisk: state.currentRisk, setLocal });

  const currentRisk = state.currentRisk;
  const local = state.local;
  if (!currentRisk || !local) return null;
  const { isISO } = derived;

  const isUncertain = currentRisk.threatRelevance === "uncertain";
  const isPerInteraction = currentRisk.sourceStrideMethod === "per-interaction";
  // When treatment is "accept" or "transfer": no mitigations needed,
  // risk after = risk before (auto-synced on treatment change).
  const isAccepted =
    local.treatment === "accept" || local.treatment === "transfer";
  const treatment = RISK_TREATMENTS.find((tr) => tr.value === local.treatment);
  const passiveTreatment = ["accept", "transfer", "share"].includes(
    local.treatment,
  );
  // ISO/SAE 21434 risk value 1–5 (3a-2): stored inputs, dialog edits live.
  const liveIso = isISO
    ? liveIsoRisk(
        currentRisk.isoRisk,
        local.factorRatings,
        local.mitigatedFactorRatings,
        configuration,
        !!currentRisk.attackTreeAssessment,
      )
    : undefined;

  // ── Attack-tree likelihood contribution (Phase 6) ─────────────────────────
  // attack_tree_likelihood is deliberately NOT in configuration.activeFactors
  // (design doc 5b: data-driven, not analyst-configured), so it never shows up
  // via the normal likelihoodFactors iteration above. It has to be rendered
  // separately, driven by whether a rating/provenance is actually present —
  // not by a discriminator. Before-mitigation only; the tree never feeds the
  // residual, so this never renders in the "after" pass.
  const treeFactorRating = local.factorRatings.find(
    (r) => r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
  );
  const treeFactorDef = getFactorDefinition(
    ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
    configuration.customFactors,
  );
  const treeAssessment = currentRisk.attackTreeAssessment;

  // Whether this risk carries the tree-seeded ISO factor breakdown (audit-mode
  // trees). Quick-mode trees have none — those fall back to the consolidated
  // residual band.
  const hasTreeIsoFactors = ISO_AP_FACTOR_IDS.some(
    (id) =>
      (local.factorRatings.find((r) => r.factorId === id)?.value ?? 0) > 0,
  );

  return {
    t,
    ...props,
    ...state,
    currentRisk,
    local,
    ...derived,
    ...actions,
    ...selection,
    isUncertain,
    isPerInteraction,
    isAccepted,
    treatment,
    passiveTreatment,
    liveIso,
    treeFactorRating,
    treeFactorDef,
    treeAssessment,
    hasTreeIsoFactors,
  };
}

/** Everything the dialog's parts render from — the open risk is set. */
export type RiskDialogModel = NonNullable<ReturnType<typeof useRiskDialogModel>>;
