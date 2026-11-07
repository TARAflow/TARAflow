// ==================== RISK DIALOG — useRiskDialogDerived ====================
// Split out of risk-dialog.tsx (MT-2): linked assets, EN 50742 severity / SRSL formula,
// the active factors, the before / after values, the ISO residual sync and the
// mandated EN 50742 controls (pre-selected).

import { useMemo, useEffect } from "react";
import type { RiskDialogProps } from "./types";
import type { useRiskDialogState } from "./use-risk-dialog-state";
import { ISO_AP_FACTOR_IDS, isoFactorPoints } from "./local-risk-state";
import { MitigationStatus } from "../../models/risk-mitigation-types";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "../../models/risk-factor-types";
import { iso21434Feasibility } from "../../models/iso21434-core";
import { treatmentVocabulary } from "../../models/risk-treatment-vocabulary";
import { getFactorDefinition } from "../../models/risk-assessment-types";
import { RISK_SCALES } from "../../models/risk-scale-types";
import { calculateRiskValues } from "../../services/risk-calculation-service";
import { resolveMitigationDrafts, resolveVerificationDrafts } from "../../../threats/services/threat-catalog-service";
import type { AssetReference } from "shared";
import { feasibilityLevelToRiskScale } from "shared";
import { calculateGatedRiskValues, resolveEN50742Severity } from "../../services/en50742-risk-calculation";
import type { ExposureLevel, AttackerCapability } from "../../models/en50742-approach-a-core";
import { en50742LevelFromRating, mandatedRequirementsForThreat, formatMandatedControlLabel, EN50742_SRSL_FACTOR_IDS, EXPOSURE_LEVEL_SCORE, ATTACKER_CAPABILITY_SCORE } from "../../models/en50742-approach-a-core";
import type { SrslAnchorType } from "../../models/en50742-approach-a-core";
import { WINDOW_OF_OPPORTUNITY_MULTIPLIERS } from "shared";

export type UseRiskDialogDerivedInput = Pick<RiskDialogProps, "configuration" | "threats" | "assetDataRef"> &
  Pick<ReturnType<typeof useRiskDialogState>, "sortedRisks" | "currentRisk" | "local" | "setLocal">;

export function useRiskDialogDerived({
  configuration,
  threats,
  assetDataRef,
  sortedRisks,
  currentRisk,
  local,
  setLocal,
}: UseRiskDialogDerivedInput) {
  // ── Computed values ───────────────────────────────────────────────────────
  const scale = RISK_SCALES[configuration.scale];

  // §11.2: WoO/AC/EL feed AP/SRSL, not the standard weighted mean — gates
  // both the severity lookup below and the factor-list split further down.
  const isEN50742 = configuration.likelihoodMethod === "en-50742-a";
  // ISO 21434: likelihood comes from the attack tree (attack_tree_likelihood,
  // rendered read-only below), never from likelihood factors rated on the risk.
  // Hide the editable likelihood factors so the analyst rates feasibility on the
  // tree (attack-potential / 18045), not here.
  const isISO = configuration.likelihoodMethod === "iso-21434";
  // ISO/SAE 21434 15.9 names for the treatment options (Avoid / Reduce /
  // Share / Retain); stored values unchanged.
  const vocabulary = treatmentVocabulary(configuration);

  // ── Linked assets — fallback to threatRef if Risk has no linkedAssetIds ────
  // Moved above beforeValues: calculateGatedRiskValues (§11.2 gate) needs
  // linkedAssets to resolve EN 50742 severity (resolveEN50742Severity).
  const currentThreatRef = useMemo(
    () => threats?.find((t) => t.id === currentRisk?.threatId),
    [threats, currentRisk?.threatId],
  );

  const effectiveLinkedAssetIds = useMemo(
    () =>
      currentRisk?.linkedAssetIds?.length
        ? currentRisk.linkedAssetIds
        : (currentThreatRef?.linkedAssetIds ?? []),
    [currentRisk?.linkedAssetIds, currentThreatRef?.linkedAssetIds],
  );

  const linkedAssets = useMemo(() => {
    if (!assetDataRef || !effectiveLinkedAssetIds.length) return [];
    const found = effectiveLinkedAssetIds
      .map((id) => assetDataRef.assets.find((a) => a.id === id))
      .filter((a): a is AssetReference => Boolean(a));
    return found;
  }, [assetDataRef, effectiveLinkedAssetIds]);

  // Read-only display (§3.6/§3.7) — same worst-case resolution the gate
  // itself uses (resolveEN50742Severity), so the badge never disagrees with
  // what actually produced calculatedSrsl.
  const en50742Severity = useMemo(
    () => (isEN50742 ? resolveEN50742Severity(linkedAssets) : undefined),
    [isEN50742, linkedAssets],
  );

  // §11.3 gate — the SRSL section applies only to an EL-bearing anchor
  // (a crossing DataFlow or an Interface). An exposure_level rating > 0 means
  // an EL was resolved (EL0..EL4 map to 1..5; 0 = no anchor). Internal elements
  // (Process / DataStore) carry no EL → no SRSL, so the whole section is hidden
  // rather than shown as an eternal "not determined".
  const hasExposureAnchor = useMemo(
    () =>
      (local?.factorRatings.find((r) => r.factorId === "exposure_level")
        ?.value ?? 0) > 0,
    [local],
  );

  // Resolved multiplicands for the AP formula tooltip (AP box) — display
  // only, the actual apScore/apBand always come from beforeValues (the gate's
  // own computation). Looked up from the same tables computeAttackPotential
  // uses (en50742-approach-a-core.ts / shared), never re-derived.
  const srslFormula = useMemo(() => {
    if (!isEN50742 || !local) return undefined;
    const elValue =
      local.factorRatings.find((r) => r.factorId === "exposure_level")?.value ??
      0;
    const acValue =
      local.factorRatings.find((r) => r.factorId === "attacker_capability")
        ?.value ?? 0;
    const elLevel = en50742LevelFromRating("exposure_level", elValue) as
      | ExposureLevel
      | undefined;
    const acLevel = en50742LevelFromRating("attacker_capability", acValue) as
      | AttackerCapability
      | undefined;
    const woo = configuration.windowOfOpportunity;
    if (!elLevel || !acLevel || !woo) return undefined;
    return {
      elScore: EXPOSURE_LEVEL_SCORE[elLevel],
      wooMultiplier: WINDOW_OF_OPPORTUNITY_MULTIPLIERS[woo],
      acScore: ATTACKER_CAPABILITY_SCORE[acLevel],
    };
  }, [isEN50742, local?.factorRatings, configuration.windowOfOpportunity]);

  const beforeValues = useMemo(
    () =>
      local
        ? calculateGatedRiskValues(
            local.factorRatings,
            configuration,
            linkedAssets,
          )
        : { impact: 0, likelihood: 0, risk: 0 },
    [local?.factorRatings, configuration, linkedAssets],
  );
  // mitigatedFactorRatings NEVER go through the §11.2 gate — SRSL is a target
  // level satisfied by controls, not "mitigated down" (§3.8); the After lens
  // stays the plain generic R×L calc regardless of method.
  const afterValues = useMemo(
    () =>
      local
        ? calculateRiskValues(local.mitigatedFactorRatings, configuration)
        : { impact: 0, likelihood: 0, risk: 0 },
    [local?.mitigatedFactorRatings, configuration],
  );

  // Keep the residual attack_tree_likelihood in sync with the edited residual
  // ISO factors (audit-mode trees). Derived here because the calc consumes
  // attack_tree_likelihood — it wins over iso_*. Self-contained (reads
  // currentRisk + module helpers, writes via setLocal) and placed with the
  // other top-level hooks, so hook order stays stable on every render path.
  useEffect(() => {
    if (!local) return;
    const assessment = currentRisk.attackTreeAssessment;
    if (!assessment) return;

    let ap = 0;
    for (const id of ISO_AP_FACTOR_IDS) {
      const v =
        local.mitigatedFactorRatings.find((r) => r.factorId === id)?.value ?? 0;
      if (v <= 0) return; // not fully rated → nothing to derive
      ap += isoFactorPoints(id, v);
    }
    const band = iso21434Feasibility(ap);
    const map: Record<string, number> = feasibilityLevelToRiskScale(configuration.scale);
    const derived = map[band] ?? 0;

    const current = local.mitigatedFactorRatings.find(
      (r) => r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
    )?.value;
    if (current === derived) return;

    setLocal((prev) => {
      if (!prev) return prev;
      const exists = prev.mitigatedFactorRatings.some(
        (r) => r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
      );
      const mitigatedFactorRatings = exists
        ? prev.mitigatedFactorRatings.map((r) =>
            r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID
              ? { ...r, value: derived }
              : r,
          )
        : [
            ...prev.mitigatedFactorRatings,
            {
              factorId: ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
              value: derived,
              weight: 1,
            },
          ];
      return { ...prev, mitigatedFactorRatings };
    });
    // Re-derive only when the residual factors (or the tree) change; the
    // write above changes local itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.mitigatedFactorRatings, currentRisk.attackTreeAssessment]);

  const assessedCount = useMemo(
    () =>
      sortedRisks.filter((r) => r.calculatedRiskBeforeMitigation > 0).length,
    [sortedRisks],
  );

  // Trust boundary name from first threat reference
  const trustBoundaryName = useMemo(() => {
    if (!threats?.length) return "";
    const threat = threats.find((t) => t.id === currentRisk?.threatId);
    return threat?.trustBoundaryName ?? "";
  }, [threats, currentRisk?.id]);

  // §11.2: WoO/AC/EL feed AP/SRSL, not the standard weighted mean — they move
  // into their own section only for en-50742-a projects. Outside that method,
  // an analyst can still enable e.g. window_of_opportunity as an ordinary
  // rated factor, so nothing is filtered there.
  // EN50742_SRSL_FACTOR_IDS imported from the core (single source of truth).

  // ── Active factors ────────────────────────────────────────────────────────
  const { impactFactors, likelihoodFactors, elFactor, acFactor } =
    useMemo(() => {
      const all = configuration.activeFactors
        .filter((af) => af.enabled)
        .map((af) => ({
          ...af,
          definition: getFactorDefinition(
            af.factorId,
            configuration.customFactors,
          ),
        }))
        .filter((f) => f.definition !== undefined);

      const likelihood = all.filter(
        (f) => f.definition!.category === "likelihood",
      );

      return {
        impactFactors: all.filter((f) => f.definition!.category === "impact"),
        likelihoodFactors: isEN50742
          ? likelihood.filter(
              (f) => !EN50742_SRSL_FACTOR_IDS.includes(f.factorId),
            )
          : isISO
            ? []
            : likelihood,
        elFactor: likelihood.find((f) => f.factorId === "exposure_level"),
        acFactor: likelihood.find((f) => f.factorId === "attacker_capability"),
      };
    }, [configuration, isEN50742, isISO]);

  // ── Resolved mitigations/verifications for checkboxes ────────────────────
  const resolvedMitigations = useMemo(
    () =>
      currentRisk
        ? resolveMitigationDrafts(currentRisk.proposedMitigations ?? [])
        : [],
    [currentRisk],
  );
  const resolvedVerifications = useMemo(
    () =>
      currentRisk
        ? resolveVerificationDrafts(currentRisk.proposedVerifications ?? [])
        : [],
    [currentRisk],
  );

  // ── EN 50742 mandated 7.4.3 controls (§11.4) ─────────────────────────────
  // The threat's anchor type + STRIDE + the computed SRSL determine which
  // 7.4.3 protection requirements are mandated. They are mixed into the same
  // mitigation list, marked with an "EN 50742 A" chip and pre-selected.
  const currentThreat = useMemo(
    () => threats?.find((t) => t.id === currentRisk?.threatId),
    [threats, currentRisk],
  );

  const mandatedControls = useMemo(() => {
    if (!isEN50742 || !hasExposureAnchor) return [];
    const srsl = beforeValues.srsl;
    if (!srsl) return [];
    const et = currentThreat?.linkedElement?.elementType;
    const anchorType: SrslAnchorType | undefined =
      et === "Interface"
        ? "Interface"
        : et === "DataFlow" || currentThreat?.dataFlow
          ? "DataFlow"
          : undefined;
    const stride = currentRisk?.strideCategory;
    if (!anchorType || !stride) return [];
    return mandatedRequirementsForThreat(anchorType, stride, srsl).map((r) => ({
      id: `en50742-${r.clause}`,
      // Full "EN50742: <category> — <requirement> (<clause>)" label, matching
      // the risk-table tooltip style.
      text:
        formatMandatedControlLabel(r.clause, srsl) ??
        `EN50742: ${r.category} — ${r.requirement} (${r.clause})`,
      notes: undefined as string | undefined,
      isCustom: false,
      isMandated: true,
    }));
  }, [
    isEN50742,
    hasExposureAnchor,
    beforeValues.srsl,
    currentThreat,
    currentRisk,
  ]);

  const displayedMitigations = useMemo(() => {
    const mandatedIds = new Set(mandatedControls.map((m) => m.id));
    return [
      ...mandatedControls,
      ...resolvedMitigations.filter((m) => !mandatedIds.has(m.id ?? "")),
    ];
  }, [mandatedControls, resolvedMitigations]);

  // Pre-select the mandated controls (they are required by the SRSL tier).
  useEffect(() => {
    if (mandatedControls.length === 0) return;
    setLocal((prev) => {
      if (!prev) return prev;
      const missing = mandatedControls.filter(
        (mc) => !prev.selectedMitigations.some((sm) => sm.id === mc.id),
      );
      if (missing.length === 0) return prev;
      return {
        ...prev,
        selectedMitigations: [
          ...prev.selectedMitigations,
          ...missing.map((mc) => ({
            id: mc.id,
            status: "open" as MitigationStatus,
          })),
        ],
      };
    });
    // Only when the mandated set changes — a deselected mandated control is
    // not forced back on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mandatedControls]);

  const effectiveCauseDescription =
    currentRisk?.causeDescription || currentThreatRef?.causeDescription;

  const assetImpactLevels = useMemo(
    () =>
      linkedAssets.map((a) => a.aggregatedImpact).filter(Boolean) as string[],
    [linkedAssets],
  );

  return {
    scale,
    isEN50742,
    isISO,
    vocabulary,
    currentThreatRef,
    effectiveLinkedAssetIds,
    linkedAssets,
    en50742Severity,
    hasExposureAnchor,
    srslFormula,
    beforeValues,
    afterValues,
    assessedCount,
    trustBoundaryName,
    resolvedMitigations,
    resolvedVerifications,
    currentThreat,
    mandatedControls,
    displayedMitigations,
    effectiveCauseDescription,
    assetImpactLevels,
    impactFactors,
    likelihoodFactors,
    elFactor,
    acFactor,
  };
}
