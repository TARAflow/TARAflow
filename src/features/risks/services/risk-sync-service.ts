// ==================== RISK SYNC SERVICE ====================
// Single Responsibility: Synchronize risks with the current threat state.
//
// Phase 3 additions:
// - Safety factor auto-enable when DFD / Asset safety data detected
// - Safety factor auto-disable dialog trigger (pendingSafetySourceRemoval)
// - Asset criteria prefill applied to new and updated risks on sync
// - Impact factor auto-enable: any asset criterion with a rated value > 0
//   automatically enables the matching Risk Tab impact factor (non-destructive)
//
// Rules:
//   relevant + uncertain threats  → appear in Risk Tab
//   not_relevant + unrated        → removed / not added
//   uncertain threats             → kept but flagged with threatRelevance = "uncertain"

import type {
  Risk,
  RiskData,
  RiskProjectData,
} from "../models/risk-assessment-types";
import type { RiskConfiguration } from "../models/risk-config-types";
import type { ActiveFactor, FactorRating } from "../models/risk-factor-types";
import { createEmptyRisk } from "../models/risk-assessment-types";
import type {
  AssetReference,
  AssetDataReference,
  DFDReference,
  ThreatReference,
} from "shared";
import {
  hasSafetyData,
  hasDFDSafetyAnnotations,
  getWorstCriterionValue,
} from "shared";
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

/**
 * The three threat sources a project contributes to the risk register, folded
 * into the eligible set the sync consumes.
 *
 * This existed inline in RisksTab's `allThreats` memo. Extracted here so the
 * concatenation is testable without rendering the tab — and so the memo body
 * and its test share ONE definition. A prior bug had the memo's dependency
 * list include perAttackPathThreats while its body forgot to spread it, so
 * attack-path threats silently never became risks. Colocating body and test
 * makes that class of drift impossible.
 */
export function collectAllThreats(
  project: Pick<
    RiskProjectData,
    "perElementThreats" | "perInteractionThreats" | "perAttackPathThreats"
  >,
): ThreatReference[] {
  return getEligibleThreats(collectAllThreatsUnfiltered(project));
}

/**
 * All threats across the three sources, WITHOUT the relevance filter — the
 * union RisksTab uses for its unfiltered view. perAttackPathThreats is
 * optional (absent on projects without attack trees) → defaulted to [].
 */
export function collectAllThreatsUnfiltered(
  project: Pick<
    RiskProjectData,
    "perElementThreats" | "perInteractionThreats" | "perAttackPathThreats"
  >,
): ThreatReference[] {
  return [
    ...project.perElementThreats,
    ...project.perInteractionThreats,
    ...(project.perAttackPathThreats ?? []),
  ];
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

// ==================== IMPACT FACTOR AUTO-ENABLE ====================

/**
 * Impact factor IDs that map 1:1 to Asset Tab impact criteria.
 * Safety is intentionally excluded — handled separately by updateSafetyFactorAutoEnable.
 */
const IMPACT_FACTOR_IDS = [
  "financial_damage",
  "regulatory_compliance",
  "reputation",
  "privacy",
  "operational",
  "affected_users",
  "recoverability",
  "accountability",
  "physical_damage",
  "environmental",
  "supply_chain",
] as const;

/**
 * Auto-enables impact factors whose matching Asset Tab criterion has a rated
 * value > 0 on at least one linked asset across the whole project.
 *
 * Rules (mirror safety behaviour):
 *   - Only enables, never disables — analyst controls disabling manually.
 *   - Only touches factors with autoEnabled !== false (i.e. not manually disabled).
 *   - Sets autoEnabled: true so the factor is recognisable as auto-enabled.
 *
 * Returns the updated activeFactors array and a count of newly enabled factors.
 */
export function updateImpactFactorsAutoEnable(
  activeFactors: ActiveFactor[],
  assetDataRef: AssetDataReference | undefined,
): {
  activeFactors: ActiveFactor[];
  autoEnabledCount: number;
} {
  if (!assetDataRef?.assets.length) {
    return { activeFactors, autoEnabledCount: 0 };
  }

  let autoEnabledCount = 0;
  const updated = activeFactors.map((factor) => {
    // Only process known impact factors (not safety, not likelihood factors)
    if (!(IMPACT_FACTOR_IDS as readonly string[]).includes(factor.factorId)) {
      return factor;
    }
    // Never re-enable a factor the analyst explicitly disabled
    if (factor.enabled === false && factor.autoEnabled === false) {
      return factor;
    }
    // Already enabled — nothing to do
    if (factor.enabled) {
      return factor;
    }
    // Check whether any asset has a rated value > 0 for this criterion
    const worstValue = getWorstCriterionValue(
      assetDataRef.assets,
      factor.factorId,
    );
    if (worstValue > 0) {
      autoEnabledCount++;
      return { ...factor, enabled: true, autoEnabled: true };
    }
    return factor;
  });

  return { activeFactors: updated, autoEnabledCount };
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

  // Impact factor auto-enable check — used only for needsSync signal here,
  // actual mutation happens in syncRisksFromThreats.
  const { autoEnabledCount: impactAutoEnabledCount } =
    updateImpactFactorsAutoEnable(
      riskData.configuration.activeFactors,
      assetDataRef,
    );

  return {
    newThreats,
    orphanedRisks,
    changedDescriptions,
    changedMitigations,
    uncertainRisks,
    needsSync:
      newThreats > 0 ||
      orphanedRisks > 0 ||
      changedDescriptions > 0 ||
      impactAutoEnabledCount > 0,
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

// ==================== FACTOR RATINGS RECONCILIATION ====================

/**
 * Ensures a risk's factorRatings[] contains an entry for every currently
 * enabled factor in the configuration.
 *
 * This is necessary when factors are auto-enabled *after* the risk was
 * originally created: the risk's factorRatings[] only contains the factors
 * that were enabled at creation time. applyAssetCriteriaToFactorRatings()
 * works via ratings.map() and can only update entries that already exist —
 * so newly enabled factors must be injected here first (value: 0, no source)
 * before the prefill pass runs.
 *
 * Also removes entries for factors that are now disabled, unless the analyst
 * set a manual value (source === "manual") — those are preserved.
 */
function reconcileFactorRatings(
  ratings: FactorRating[],
  configuration: RiskConfiguration,
): FactorRating[] {
  const enabledFactors = configuration.activeFactors.filter((f) => f.enabled);
  const ratingMap = new Map(ratings.map((r) => [r.factorId, r]));

  return enabledFactors.map((af) => {
    const existing = ratingMap.get(af.factorId);
    if (existing) return existing;
    // New factor — inject empty placeholder so applyAssetCriteria can fill it
    return { factorId: af.factorId, value: 0, weight: af.weight };
  });
}



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
    activeFactors: afterSafetyFactors,
    safetyAutoEnabled,
    safetySourceRemoved,
  } = updateSafetyFactorAutoEnable(
    riskData.configuration.activeFactors,
    hasSafety,
  );

  // ── Impact factors auto-enable ────────────────────────────────────────────
  // Enables any impact factor whose criterion has a rated value > 0 in the
  // Asset Tab. Runs after safety so safety is already resolved in the array.
  const { activeFactors: updatedActiveFactors, autoEnabledCount } =
    updateImpactFactorsAutoEnable(afterSafetyFactors, assetDataRef);

  if (autoEnabledCount > 0) {
    warnings.push(
      `${autoEnabledCount} impact factor(s) auto-enabled — rated asset impact criteria detected.`,
    );
  }

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
    // Reconcile: inject entries for any factors newly enabled since this risk
    // was created, so applyAssetCriteriaToFactorRatings can fill them.
    const reconciledRatings = reconcileFactorRatings(
      risk.factorRatings,
      updatedConfiguration,
    );
    let updatedFactorRatings = reconciledRatings;
    let updatedMitigatedRatings = risk.mitigatedFactorRatings;

    if (assetDataRef && linkedAssets.length > 0) {
      updatedFactorRatings = applyAssetCriteriaToFactorRatings(
        reconciledRatings,
        linkedAssets,
        assetDataRef,
        updatedConfiguration,
      );
      // mitigatedFactorRatings not touched — analyst owns Risk After values
    }

    const ratingsChanged =
      JSON.stringify(updatedFactorRatings) !==
      JSON.stringify(reconciledRatings);

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