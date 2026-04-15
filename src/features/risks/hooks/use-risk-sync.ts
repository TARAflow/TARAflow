// ==================== USE RISK SYNC HOOK ====================
// Hook for synchronizing risks with threats.
// Delegates all logic to risk-sync-service (Single Responsibility).

import { useState, useCallback, useMemo } from "react";
import { RiskData, ThreatReference } from "../models/risk-types";
import {
  checkRiskSyncStatus,
  syncRisksFromThreats,
  RiskSyncStatus,
} from "../services/risk-sync-service";

interface UseRiskSyncOptions {
  allThreats: ThreatReference[];
  riskData: RiskData;
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
  onUpdate,
}: UseRiskSyncOptions): UseRiskSyncResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);

  // Pure status check — no mutation, uses eligible-filter internally
  const syncStatus = useMemo(
    () => checkRiskSyncStatus(riskData, allThreats),
    [allThreats, riskData],
  );

  const handleSyncFromThreats = useCallback(async () => {
    if (allThreats.length === 0) {
      setSyncWarnings(["No threats available for synchronization"]);
      return;
    }

    setIsSyncing(true);
    try {
      const result = syncRisksFromThreats(riskData, allThreats);
      onUpdate(result.riskData);
      setSyncWarnings(result.warnings);
    } finally {
      setIsSyncing(false);
    }
  }, [allThreats, riskData, onUpdate]);

  return {
    isSyncing,
    syncStatus,
    syncWarnings,
    setSyncWarnings,
    handleSyncFromThreats,
  };
}