// ==================== USE RISK SYNC HOOK ====================
// Hook for synchronizing risks with threats
// Handles sync status calculation, warnings, and sync execution

import { useState, useCallback, useMemo } from "react";
import { RiskData, ThreatReference } from "../models/risk-types";
import { riskService } from "../services/risk-service";

interface SyncStatus {
  newThreats: number;
  orphanedRisks: number;
  changedDescriptions: number;
  changedAttacks: number;
  changedMitigations: number;
  needsSync: boolean;
}

interface UseRiskSyncOptions {
  allThreats: ThreatReference[];
  riskData: RiskData;
  onUpdate: (data: RiskData) => void;
}

interface UseRiskSyncResult {
  isSyncing: boolean;
  syncStatus: SyncStatus;
  syncWarnings: string[];
  setSyncWarnings: (warnings: string[]) => void;
  handleSyncFromThreats: () => Promise<void>;
}

/**
 * Hook for managing risk-threat synchronization
 * 
 * @param options - Configuration with threats, risk data, and update callback
 * @returns Sync state and handlers
 * 
 * @example
 * const { isSyncing, syncStatus, handleSyncFromThreats } = useRiskSync({
 *   allThreats: [...perElementThreats, ...perInteractionThreats],
 *   riskData,
 *   onUpdate: (data) => setRiskData(data)
 * });
 */
export function useRiskSync({
  allThreats,
  riskData,
  onUpdate,
}: UseRiskSyncOptions): UseRiskSyncResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);

  // Calculate detailed sync status
  const syncStatus = useMemo((): SyncStatus => {
    const threatIds = new Set(allThreats.map((t) => t.id));
    const riskThreatIds = new Set(riskData.risks.map((r) => r.threatId));

    // New threats without risks
    const newThreats = allThreats.filter((t) => !riskThreatIds.has(t.id));

    // Orphaned risks (threat deleted)
    const orphanedRisks = riskData.risks.filter(
      (r) => !threatIds.has(r.threatId)
    );

    // Changed threat descriptions
    const changedDescriptions = riskData.risks.filter((risk) => {
      const threat = allThreats.find((t) => t.id === risk.threatId);
      return threat && threat.threatDescription !== risk.threatDescription;
    });

    // Changed attack descriptions
    const changedAttacks = riskData.risks.filter((risk) => {
      const threat = allThreats.find((t) => t.id === risk.threatId);
      return threat && threat.attackDescription !== risk.attackDescription;
    });

    // Changed mitigations (originalMitigation differs)
    const changedMitigations = riskData.risks.filter((risk) => {
      const threat = allThreats.find((t) => t.id === risk.threatId);
      return threat && threat.mitigation !== risk.originalMitigation;
    });

    return {
      newThreats: newThreats.length,
      orphanedRisks: orphanedRisks.length,
      changedDescriptions: changedDescriptions.length,
      changedAttacks: changedAttacks.length,
      changedMitigations: changedMitigations.length,
      needsSync:
        newThreats.length > 0 ||
        orphanedRisks.length > 0 ||
        changedDescriptions.length > 0,
    };
  }, [allThreats, riskData.risks]);

  // Perform sync from threats
  const handleSyncFromThreats = useCallback(async () => {
    if (allThreats.length === 0) {
      setSyncWarnings(["No threats available for synchronization"]);
      return;
    }

    setIsSyncing(true);
    try {
      const result = riskService.syncFromThreats(riskData, allThreats);
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