// ==================== USE RISK SYNC HOOK ====================
// Hook for synchronizing risks with threats.
// Delegates all logic to risk-sync-service (Single Responsibility).
//
// Phase 3: dfd + assetDataRef passed through to sync service for
//   - Safety factor auto-enable / pendingSafetySourceRemoval
//   - Asset criteria prefill on new and updated risks
//
// Phase 5b (end-to-end wiring): after syncRisksFromThreats, additively runs
// syncRisksFromAttackTrees on the result. Two independent passes by design —
// see risk-sync-service.ts "ATTACK-TREE SYNC (5b-2)": threats change the
// STRIDE/OWASP factors, trees change only the attack_tree_likelihood factor.
// Chaining them here (rather than inside syncRisksFromThreats) is what keeps
// reconcileFactorRatings' source==="attack-tree" exemption meaningful.
//
// treeLikelihoodContribution (5b Punkt 3) is read from riskData.configuration —
// a real project-wide setting now (RiskConfigDialog), defaulting to "factor"
// for older projects that predate the setting.

import { useState, useCallback, useMemo } from "react";
import { RiskData } from "../models/risk-assessment-types";
import {
  checkRiskSyncStatus,
  syncRisksFromThreats,
  syncRisksFromAttackTrees,
  RiskSyncStatus,
} from "../services/risk-sync-service";
import type {
  AssetDataReference,
  AttackTreeLikelihoodReference,
  DFDReference,
  ThreatReference,
} from "shared";

interface UseRiskSyncOptions {
  allThreats: ThreatReference[];
  riskData: RiskData;
  /** DFD snapshot — used for Safety annotation detection */
  dfd?: DFDReference | null;
  /** Asset data — used for Safety detection + per-criterion impact prefill */
  assetDataRef?: AssetDataReference;
  /**
   * Attack-tree likelihood contributions (5b-2). Optional: absent on projects
   * without attack trees, defaulted to [] so syncRisksFromAttackTrees is a
   * pure no-op in that case (clears any stale attack-tree ratings, adds none).
   */
  attackTreeLikelihoods?: AttackTreeLikelihoodReference[];
  onUpdate: (data: RiskData) => void;
}

interface UseRiskSyncResult {
  isSyncing: boolean;
  syncStatus: RiskSyncStatus;
  syncWarnings: string[];
  setSyncWarnings: (warnings: string[]) => void;
  handleSyncFromThreats: () => Promise<void>;
}

export function useRiskSync({
  allThreats,
  riskData,
  dfd,
  assetDataRef,
  attackTreeLikelihoods,
  onUpdate,
}: UseRiskSyncOptions): UseRiskSyncResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);

  // Pure status check — no mutation.
  // Also evaluates Safety auto-enable state so the tab can react.
  const syncStatus = useMemo(
    () => checkRiskSyncStatus(riskData, allThreats, dfd, assetDataRef),
    [allThreats, riskData, dfd, assetDataRef],
  );

  const handleSyncFromThreats = useCallback(async () => {
    if (allThreats.length === 0) {
      setSyncWarnings(["No threats available for synchronization"]);
      return;
    }

    setIsSyncing(true);
    try {
      const threatSyncResult = syncRisksFromThreats(
        riskData,
        allThreats,
        dfd,
        assetDataRef,
      );

      // Additive second pass: sets/clears the attack_tree_likelihood factor
      // on the result of the threat sync. No-op when no trees feed any risk.
      // contribution now comes from the project-wide setting (5b Punkt 3);
      // undefined (older projects, no explicit choice yet) falls back to the
      // design-doc default "factor".
      const finalRiskData = syncRisksFromAttackTrees(
        threatSyncResult.riskData,
        attackTreeLikelihoods ?? [],
        riskData.configuration.treeLikelihoodContribution ?? "factor",
      );

      onUpdate(finalRiskData);
      setSyncWarnings(threatSyncResult.warnings);
    } finally {
      setIsSyncing(false);
    }
  }, [
    allThreats,
    riskData,
    dfd,
    assetDataRef,
    attackTreeLikelihoods,
    onUpdate,
  ]);

  return {
    isSyncing,
    syncStatus,
    syncWarnings,
    setSyncWarnings,
    handleSyncFromThreats,
  };
}