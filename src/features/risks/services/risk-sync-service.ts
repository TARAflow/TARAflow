// ==================== RISK SYNC SERVICE ====================
// Single Responsibility: Synchronize risks with the current threat state.
//
// Phase 3 additions:
// - Safety factor auto-enable when DFD / Asset safety data detected
// - Safety factor auto-disable dialog trigger (pendingSafetySourceRemoval)
// - Asset criteria prefill applied to new and updated risks on sync
//
// Rules:
//   relevant + uncertain threats  → appear in Risk Tab
//   not_relevant + unrated        → removed / not added
//   uncertain threats             → kept but flagged with threatRelevance = "uncertain"

import type {
  Risk,
  RiskData,
  ThreatReference,
} from "../models/risk-assessment-types";
import type { RiskConfiguration } from "../models/risk-config-types";
import type { ActiveFactor } from "../models/risk-factor-types";
import { createEmptyRisk } from "../models/risk-assessment-types";
import type { AssetReference, AssetDataReference, DFDReference } from "shared";
import { hasSafetyData, hasDFDSafetyAnnotations } from "shared";
import {
  applyAssetCriteriaToFactorRatings,
  calculateRiskValues,
} from "./risk-calculation-service";

// ==================== RESULT TYPES ====================

export interface RiskSyncResult {
  success: boolean;
  riskData: RiskData;
  added: number;
  removed: number;
  updated: number;
  warnings: string[];
}

export interface RiskSyncStatus {
  newThreats: number;
  orphanedRisks: number;
  changedDescriptions: number;
  changedMitigations: number;
  uncertainRisks: number;
  needsSync: boolean;
  /** Safety factor was auto-enabled during this sync check */
  safetyAutoEnabled: boolean;
  /**
   * Safety source removed: safety data is gone but Safety factor was autoEnabled.
   * RisksTab shows the safety removal dialog when this is true.
   */
  safetySourceRemoved: boolean;
}

// ==================== ELIGIBLE THREATS ====================

export function getEligibleThreats(threats: ThreatReference[]): ThreatReference[] {
  return threats.filter(
    (t) => t.relevance === "relevant" || t.relevance === "uncertain",
  );
}

// ==================== SAFETY DETECTION ====================

/**
 * Single authoritative check: does this project have safety-relevant data?
 * Combines DFD safety annotations + Asset Tab safety data.
 */
export function projectHasSafetyData(
  dfd: DFDReference | null | undefined,
  assetDataRef: AssetDataReference | undefined,
): boolean {
  return (
    hasDFDSafetyAnnotations(dfd) ||
    (assetDataRef ? hasSafetyData(assetDataRef.assets) : false)
  );
}

// ==================== SAFETY FACTOR AUTO-ENABLE ====================

/**
 * Updates the Safety ActiveFactor based on whether safety data is present.
 *
 * Never auto-disables when analyst explicitly enabled (autoEnabled !== true).
 * Returns what changed so callers can react (banner / dialog).
 */
export function updateSafetyFactorAutoEnable(
  activeFactors: ActiveFactor[],
  hasSafety: boolean,
): {
  activeFactors: ActiveFactor[];
  safetyAutoEnabled: boolean;
  safetySourceRemoved: boolean;
} {
  const safetyIdx = activeFactors.findIndex((f) => f.factorId === "safety");

  if (safetyIdx === -1) {
    if (hasSafety) {
      return {
        activeFactors: [
          ...activeFactors,
          { factorId: "safety", enabled: true, weight: 1.0, autoEnabled: true },
        ],
        safetyAutoEnabled: true,
        safetySourceRemoved: false,
      };
    }
    return { activeFactors, safetyAutoEnabled: false, safetySourceRemoved: false };
  }

  const current = activeFactors[safetyIdx];

  if (hasSafety && !current.enabled) {
    // Safety data appeared — auto-enable
    const updated = [...activeFactors];
    updated[safetyIdx] = { ...current, enabled: true, autoEnabled: true };
    return { activeFactors: updated, safetyAutoEnabled: true, safetySourceRemoved: false };
  }

  if (!hasSafety && current.enabled && current.autoEnabled === true) {
    // Safety data gone and factor was auto-enabled — flag for dialog, don't disable yet
    return { activeFactors, safetyAutoEnabled: false, safetySourceRemoved: true };
  }

  return { activeFactors, safetyAutoEnabled: false, safetySourceRemoved: false };
}

/**
 * Apply the user's decision from the Safety Removal Dialog.
 *
 * keep=true  → mark as manually enabled (autoEnabled: false), clear pending flag
 * keep=false → disable factor, zero out safety ratings, clear pending flag
 */
export function applySafetyRemovalDecision(
  riskData: RiskData,
  keep: boolean,
): RiskData {
  const activeFactors = riskData.configuration.activeFactors.map((f) => {
    if (f.factorId !== "safety") return f;
    return keep
      ? { ...f, enabled: true, autoEnabled: false }
      : { ...f, enabled: false, autoEnabled: false };
  });

  const risks = keep
    ? riskData.risks
    : riskData.risks.map((risk) => ({
        ...risk,
        factorRatings: risk.factorRatings.map((r) =>
          r.factorId === "safety"
            ? { ...r, value: 0, derivedValue: undefined, source: undefined }
            : r,
        ),
        mitigatedFactorRatings: risk.mitigatedFactorRatings.map((r) =>
          r.factorId === "safety"
            ? { ...r, value: 0, derivedValue: undefined, source: undefined }
            : r,
        ),
      }));

  return {
    ...riskData,
    configuration: {
      ...riskData.configuration,
      activeFactors,
      pendingSafetySourceRemoval: false,
    },
    risks,
    lastModified: new Date().toISOString(),
  };
}

// ==================== SYNC STATUS ====================

export function checkRiskSyncStatus(
  riskData: RiskData,
  allThreats: ThreatReference[],
  dfd?: DFDReference | null,
  assetDataRef?: AssetDataReference,
): RiskSyncStatus {
  const eligible = getEligibleThreats(allThreats);
  const eligibleIds = new Set(eligible.map((t) => t.id));
  const riskThreatIds = new Set(riskData.risks.map((r) => r.threatId));

  const newThreats = eligible.filter((t) => !riskThreatIds.has(t.id)).length;
  const orphanedRisks = riskData.risks.filter(
    (r) => !eligibleIds.has(r.threatId),
  ).length;

  const changedDescriptions = riskData.risks.filter((risk) => {
    const threat = allThreats.find((t) => t.id === risk.threatId);
    return threat && threat.threatDescription !== risk.threatDescription;
  }).length;

  const changedMitigations = riskData.risks.filter((risk) => {
    const threat = allThreats.find((t) => t.id === risk.threatId);
    if (!threat) return false;
    return (
      JSON.stringify(threat.proposedMitigations) !==
      JSON.stringify(risk.proposedMitigations)
    );
  }).length;

  const uncertainRisks = riskData.risks.filter(
    (r) => r.threatRelevance === "uncertain",
  ).length;

  const hasSafety = projectHasSafetyData(dfd, assetDataRef);
  const { safetyAutoEnabled, safetySourceRemoved } =
    updateSafetyFactorAutoEnable(
      riskData.configuration.activeFactors,
      hasSafety,
    );

  return {
    newThreats,
    orphanedRisks,
    changedDescriptions,
    changedMitigations,
    uncertainRisks,
    needsSync: newThreats > 0 || orphanedRisks > 0 || changedDescriptions > 0,
    safetyAutoEnabled,
    safetySourceRemoved,
  };
}

// ==================== ASSET LOOKUP HELPER ====================

function resolveLinkedAssets(
  linkedAssetIds: string[] | undefined,
  assetDataRef: AssetDataReference | undefined,
): AssetReference[] {
  if (!linkedAssetIds?.length || !assetDataRef) return [];
  return linkedAssetIds
    .map((id) => assetDataRef.assets.find((a) => a.id === id))
    .filter((a): a is AssetReference => a !== undefined);
}

// ==================== SYNC EXECUTION ====================

/**
 * Synchronize risk data with the current threat state.
 *
 * Phase 3: also applies Safety auto-enable and asset criteria prefill.
 */
export function syncRisksFromThreats(
  riskData: RiskData,
  allThreats: ThreatReference[],
  dfd?: DFDReference | null,
  assetDataRef?: AssetDataReference,
): RiskSyncResult {
  const warnings: string[] = [];
  const eligible = getEligibleThreats(allThreats);
  const eligibleIds = new Set(eligible.map((t) => t.id));

  // ── Safety auto-enable ────────────────────────────────────────────────────
  const hasSafety = projectHasSafetyData(dfd, assetDataRef);
  const {
    activeFactors: updatedActiveFactors,
    safetyAutoEnabled,
    safetySourceRemoved,
  } = updateSafetyFactorAutoEnable(
    riskData.configuration.activeFactors,
    hasSafety,
  );

  const updatedConfiguration: RiskConfiguration = {
    ...riskData.configuration,
    activeFactors: updatedActiveFactors,
    pendingSafetySourceRemoval: safetySourceRemoved
      ? true
      : riskData.configuration.pendingSafetySourceRemoval,
  };

  if (safetyAutoEnabled) {
    warnings.push(
      "Safety Impact factor auto-enabled — safety annotations detected.",
    );
  }

  // ── Remove orphaned risks ─────────────────────────────────────────────────
  const removed = riskData.risks.filter(
    (r) => !eligibleIds.has(r.threatId),
  ).length;
  const keptRisks = riskData.risks.filter((r) => eligibleIds.has(r.threatId));

  // ── Update kept risks ─────────────────────────────────────────────────────
  let updated = 0;
  const updatedKeptRisks: Risk[] = keptRisks.map((risk) => {
    const threat = allThreats.find((t) => t.id === risk.threatId);
    if (!threat) return risk;

    const descChanged = threat.threatDescription !== risk.threatDescription;
    const attackChanged = threat.attackDescription !== risk.attackDescription;
    const mitigationsChanged =
      JSON.stringify(threat.proposedMitigations) !==
      JSON.stringify(risk.proposedMitigations);
    const verificationsChanged =
      JSON.stringify(threat.proposedVerifications) !==
      JSON.stringify(risk.proposedVerifications);
    const relevanceChanged = threat.relevance !== risk.threatRelevance;

    // Re-apply asset criteria prefill (non-destructive — respects manual overrides)
    const linkedAssets = resolveLinkedAssets(risk.linkedAssetIds, assetDataRef);
    let updatedFactorRatings = risk.factorRatings;
    let updatedMitigatedRatings = risk.mitigatedFactorRatings;

    if (assetDataRef && linkedAssets.length > 0) {
      updatedFactorRatings = applyAssetCriteriaToFactorRatings(
        risk.factorRatings,
        linkedAssets,
        assetDataRef,
        updatedConfiguration,
      );
      // mitigatedFactorRatings not touched — analyst owns Risk After values
    }

    const ratingsChanged =
      JSON.stringify(updatedFactorRatings) !==
      JSON.stringify(risk.factorRatings);

    if (
      descChanged ||
      attackChanged ||
      mitigationsChanged ||
      verificationsChanged ||
      relevanceChanged ||
      ratingsChanged
    ) {
      updated++;
      const beforeValues = calculateRiskValues(
        updatedFactorRatings,
        updatedConfiguration,
      );
      const afterValues = calculateRiskValues(
        updatedMitigatedRatings,
        updatedConfiguration,
      );

      return {
        ...risk,
        threatDescription: threat.threatDescription,
        attackDescription: threat.attackDescription,
        causeDescription: threat.causeDescription,
        linkedAssetIds: threat.linkedAssetIds ?? [],
        proposedMitigations: threat.proposedMitigations,
        proposedVerifications: threat.proposedVerifications,
        threatRelevance: threat.relevance,
        factorRatings: updatedFactorRatings,
        mitigatedFactorRatings: updatedMitigatedRatings,
        calculatedImpact: beforeValues.impact,
        calculatedLikelihood: beforeValues.likelihood,
        calculatedRiskBeforeMitigation: beforeValues.risk,
        calculatedRiskAfterMitigation: afterValues.risk,
        lastModified: new Date().toISOString(),
      };
    }
    return risk;
  });

  // ── Add new risks ─────────────────────────────────────────────────────────
  const existingThreatIds = new Set(keptRisks.map((r) => r.threatId));
  const threatsToAdd = eligible.filter((t) => !existingThreatIds.has(t.id));

  const newRisks: Risk[] = threatsToAdd.map((threat) => {
    const emptyRisk = createEmptyRisk(threat, updatedConfiguration);
    const linkedAssets = resolveLinkedAssets(
      threat.linkedAssetIds,
      assetDataRef,
    );
    if (!assetDataRef || linkedAssets.length === 0) return emptyRisk;

    const prefilled = applyAssetCriteriaToFactorRatings(
      emptyRisk.factorRatings,
      linkedAssets,
      assetDataRef,
      updatedConfiguration,
    );

    const beforeValues = calculateRiskValues(prefilled, updatedConfiguration);

    return {
      ...emptyRisk,
      factorRatings: prefilled,
      // mitigatedFactorRatings stay empty — analyst fills manually or copies from Before
      calculatedImpact: beforeValues.impact,
      calculatedLikelihood: beforeValues.likelihood,
      calculatedRiskBeforeMitigation: beforeValues.risk,
      calculatedRiskAfterMitigation: 0,
    };
  });

  const added = newRisks.length;
  if (added > 0) warnings.push(`Added ${added} new risk(s) for new threats.`);
  if (removed > 0)
    warnings.push(
      `Removed ${removed} risk(s) (not_relevant / unrated / deleted).`,
    );

  return {
    success: true,
    riskData: {
      ...riskData,
      configuration: updatedConfiguration,
      risks: [...updatedKeptRisks, ...newRisks],
      lastModified: new Date().toISOString(),
    },
    added,
    removed,
    updated,
    warnings,
  };
}
