// ==================== RISK SYNC SERVICE ====================
// Single Responsibility: Synchronize risks with the current threat state.
//
// Rules:
//   relevant + uncertain threats  → appear in Risk Tab
//   not_relevant + unrated        → removed / not added
//   uncertain threats             → kept but flagged with threatRelevance = "uncertain"

import {
  Risk,
  RiskData,
  ThreatReference,
  ThreatRelevanceRef,
  createEmptyRisk,
} from "../models/risk-types";

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
  /** Threats with relevance=relevant|uncertain that have no risk entry yet */
  newThreats: number;
  /** Risk entries whose threat has been deleted or made not_relevant/unrated */
  orphanedRisks: number;
  /** Risks whose threat description changed since last sync */
  changedDescriptions: number;
  /** Risks whose proposed mitigations changed since last sync */
  changedMitigations: number;
  /** Uncertain threats that have a risk entry (need visual warning) */
  uncertainRisks: number;
  needsSync: boolean;
}

// ==================== ELIGIBLE THREATS ====================

/**
 * Returns only threats that should appear in the Risk Tab.
 * relevant + uncertain are eligible; not_relevant + unrated are excluded.
 */
export function getEligibleThreats(threats: ThreatReference[]): ThreatReference[] {
  return threats.filter(
    (t) => t.relevance === "relevant" || t.relevance === "uncertain"
  );
}

// ==================== SYNC STATUS ====================

/**
 * Calculate detailed sync status without mutating any data.
 */
export function checkRiskSyncStatus(
  riskData: RiskData,
  allThreats: ThreatReference[]
): RiskSyncStatus {
  const eligible = getEligibleThreats(allThreats);
  const eligibleIds = new Set(eligible.map((t) => t.id));
  const riskThreatIds = new Set(riskData.risks.map((r) => r.threatId));

  const newThreats = eligible.filter((t) => !riskThreatIds.has(t.id)).length;

  const orphanedRisks = riskData.risks.filter(
    (r) => !eligibleIds.has(r.threatId)
  ).length;

  const changedDescriptions = riskData.risks.filter((risk) => {
    const threat = allThreats.find((t) => t.id === risk.threatId);
    return (
      threat &&
      threat.threatDescription !== risk.threatDescription
    );
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
    (r) => r.threatRelevance === "uncertain"
  ).length;

  return {
    newThreats,
    orphanedRisks,
    changedDescriptions,
    changedMitigations,
    uncertainRisks,
    needsSync:
      newThreats > 0 ||
      orphanedRisks > 0 ||
      changedDescriptions > 0,
  };
}

// ==================== SYNC EXECUTION ====================

/**
 * Synchronize risk data with the current threat state.
 *
 * - Adds risks for new eligible threats (relevant + uncertain)
 * - Removes risks for threats that became not_relevant / unrated / deleted
 * - Updates descriptions and proposed mitigations for kept risks
 * - Sets threatRelevance on all kept/new risks
 */
export function syncRisksFromThreats(
  riskData: RiskData,
  allThreats: ThreatReference[]
): RiskSyncResult {
  const warnings: string[] = [];
  const eligible = getEligibleThreats(allThreats);
  const eligibleIds = new Set(eligible.map((t) => t.id));

  // ── Risks to remove ───────────────────────────────────────────────────────
  const risksToRemove = riskData.risks.filter(
    (r) => !eligibleIds.has(r.threatId)
  );
  const removed = risksToRemove.length;

  // ── Keep existing eligible risks ─────────────────────────────────────────
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

    if (
      descChanged ||
      attackChanged ||
      mitigationsChanged ||
      verificationsChanged ||
      relevanceChanged
    ) {
      updated++;
      return {
        ...risk,
        threatDescription: threat.threatDescription,
        attackDescription: threat.attackDescription,
        proposedMitigations: threat.proposedMitigations,
        proposedVerifications: threat.proposedVerifications,
        threatRelevance: threat.relevance,
        lastModified: new Date().toISOString(),
      };
    }
    return risk;
  });

  // ── Add new risks ─────────────────────────────────────────────────────────
  const existingThreatIds = new Set(keptRisks.map((r) => r.threatId));
  const threatsToAdd = eligible.filter((t) => !existingThreatIds.has(t.id));
  const newRisks = threatsToAdd.map((threat) =>
    createEmptyRisk(threat, riskData.configuration)
  );
  const added = newRisks.length;

  // ── Warnings ──────────────────────────────────────────────────────────────
  if (added > 0) warnings.push(`Added ${added} new risk(s) for new threats`);
  if (removed > 0)
    warnings.push(`Removed ${removed} risk(s) (not_relevant / unrated / deleted)`);

  const uncertainCount = [...updatedKeptRisks, ...newRisks].filter(
    (r) => r.threatRelevance === "uncertain"
  ).length;
  if (uncertainCount > 0) {
    warnings.push(
      `${uncertainCount} risk(s) are based on uncertain threats — review recommended`
    );
  }

  return {
    success: true,
    riskData: {
      ...riskData,
      risks: [...updatedKeptRisks, ...newRisks],
      lastModified: new Date().toISOString(),
    },
    added,
    removed,
    updated,
    warnings,
  };
}