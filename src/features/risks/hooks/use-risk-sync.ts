// ==================== USE RISK SYNC HOOK ====================
// Hook for synchronizing risks with threats.
// Delegates all logic to risk-sync-service (Single Responsibility).
//
// Phase 3: dfd + assetDataRef passed through to sync service for
//   - Safety factor auto-enable / pendingSafetySourceRemoval
//   - Asset criteria prefill on new and updated risks

import { useState, useCallback, useMemo } from "react";
import { RiskData } from "../models/risk-types";
import type { ThreatReference } from "../models/risk-types";
import {
  checkRiskSyncStatus,
  syncRisksFromThreats,
  RiskSyncStatus,
} from "../services/risk-sync-service";
import type { AssetDataReference, DFDReference } from "shared";

interface UseRiskSyncOptions {
  allThreats: ThreatReference[];
  riskData: RiskData;
  /** DFD snapshot — used for Safety annotation detection */
  dfd?: DFDReference | null;
  /** Asset data — used for Safety detection + per-criterion impact prefill */
  assetDataRef?: AssetDataReference;
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
      const result = syncRisksFromThreats(
        riskData,
        allThreats,
        dfd,
        assetDataRef,
      );
      onUpdate(result.riskData);
      setSyncWarnings(result.warnings);
    } finally {
      setIsSyncing(false);
    }
  }, [allThreats, riskData, dfd, assetDataRef, onUpdate]);

  return {
    isSyncing,
    syncStatus,
    syncWarnings,
    setSyncWarnings,
    handleSyncFromThreats,
  };
}