// ==================== USE ELEMENT THREATS ====================
// Hook for managing per-element threat state and operations
// CORRECTED: Proper immutability for React.memo compatibility

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  startTransition,
} from "react";
import type {
  Threat,
  ThreatTable,
  ThreatData,
  ThreatProjectData,
  ThreatConfiguration,
  ThreatSyncStatus,
} from "../../models/threat-types";
import { elementThreatService } from "../../services/per-element/element-threat-service";
import type { StatisticsResult } from "../../services/threat-service";
import { DFDAnalysisContext } from "shared";

// ==================== TYPES ====================

export interface UseElementThreatsOptions {
  project: ThreatProjectData;
  dfdContext: DFDAnalysisContext;
  configuration: ThreatConfiguration;
  onUpdate?: (data: ThreatData) => void;
}

export interface UseElementThreatsResult {
  // State
  tables: ThreatTable[];
  syncStatus: ThreatSyncStatus | null;
  isGenerating: boolean;
  isSyncing: boolean;

  // Statistics
  stats: StatisticsResult;

  // Operations
  generateThreats: () => Promise<boolean>;
  deleteAllThreats: () => void;
  synchronizeThreats: (options: {
    updateReferences: boolean;
    removeOrphaned: boolean;
  }) => Promise<boolean>;
  updateThreat: (tableIndex: number, threat: Threat) => void;
  deleteThreat: (tableIndex: number, threatId: string) => void;
  addThreat: (tableIndex: number, threat: Threat) => void;
  updateTable: (tableIndex: number, table: ThreatTable) => void;
}

// ==================== HOOK ====================

export function useElementThreats({
  project,
  dfdContext,
  configuration,
  onUpdate,
}: UseElementThreatsOptions): UseElementThreatsResult {
  // ==================== STATE ====================

  const [tables, setTables] = useState<ThreatTable[]>(
    () => project.threats?.perElementTables ?? [],
  );
  const [syncStatus, setSyncStatus] = useState<ThreatSyncStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ==================== SYNC STATUS CHECK ====================

  useEffect(() => {
    if (project.dfdElements && project.dfdElements.length > 0) {
      const status = elementThreatService.checkSyncStatus(project, tables);
      setSyncStatus(status);
    } else {
      setSyncStatus(null);
    }
  }, [project.dfdElements, project.dfdConnections, tables]);

  // ==================== STATISTICS ====================

  const stats = useMemo(() => {
    return elementThreatService.getStatistics(tables);
  }, [tables]);

  // ==================== NOTIFY PARENT ====================

  const notifyUpdate = useCallback(
    (updatedTables: ThreatTable[]) => {
      onUpdate?.({
        configuration,
        perElementTables: updatedTables,
        perInteractionTables: project.threats?.perInteractionTables ?? [],
        lastModified: new Date().toISOString(),
      });
    },
    [configuration, project, onUpdate],
  );

  useEffect(() => {
    setTables(project.threats?.perElementTables ?? []);
  }, [project.threats?.perElementTables]);

  // ==================== OPERATIONS ====================

  const generateThreats = useCallback(async (): Promise<boolean> => {
    setIsGenerating(true);
    try {
      const result = elementThreatService.generateThreats(
        project,
        dfdContext,
        configuration,
      );

      if (result.success) {
        startTransition(() => {
          setTables(result.tables);
          notifyUpdate(result.tables);
          setIsGenerating(false);
        });
        return true;
      }

      console.error("Generation failed:", result.error);
      setIsGenerating(false);
      return false;
    } catch (error) {
      console.error("Generation error:", error);
      setIsGenerating(false);
      return false;
    }
  }, [project, dfdContext, configuration, notifyUpdate]);

  const deleteAllThreats = useCallback(() => {
    setTables([]);
    notifyUpdate([]);
  }, [notifyUpdate]);

  const synchronizeThreats = useCallback(
    async (options: {
      updateReferences: boolean;
      removeOrphaned: boolean;
    }): Promise<boolean> => {
      if (!syncStatus) return false;

      setIsSyncing(true);
      try {
        const result = elementThreatService.synchronizeThreats(
          project,
          dfdContext,
          tables,
          syncStatus,
          options,
        );

        if (result.success && result.threatData) {
          const updatedTables = result.threatData.perElementTables ?? [];
          setTables(updatedTables);
          notifyUpdate(updatedTables);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Sync error:", error);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [syncStatus, project, dfdContext, tables, notifyUpdate],
  );

  // ==================== IMMUTABLE STATE UPDATES ====================

  const updateThreat = useCallback(
    (tableIndex: number, updatedThreat: Threat) => {
      setTables((prev) => {
        const newTables = [...prev];
        const oldTable = newTables[tableIndex];

        if (!oldTable) return prev;

        const threatIndex = oldTable.threats.findIndex(
          (t) => t.id === updatedThreat.id,
        );
        if (threatIndex === -1) return prev;

        // Create new table with new threats array
        const newThreats = [...oldTable.threats];
        newThreats[threatIndex] = {
          ...updatedThreat,
          lastModified: new Date().toISOString(),
        };

        const newTable: ThreatTable = {
          ...oldTable,
          threats: newThreats,
        };

        newTables[tableIndex] = newTable;
        notifyUpdate(newTables);
        return newTables;
      });
    },
    [notifyUpdate],
  );

  const deleteThreat = useCallback(
    (tableIndex: number, threatId: string) => {
      setTables((prev) => {
        const newTables = [...prev];
        const oldTable = newTables[tableIndex];

        if (!oldTable) return prev;

        // Create new table with filtered threats
        const newTable: ThreatTable = {
          ...oldTable,
          threats: oldTable.threats.filter((t) => t.id !== threatId),
        };

        newTables[tableIndex] = newTable;
        notifyUpdate(newTables);
        return newTables;
      });
    },
    [notifyUpdate],
  );

  const addThreat = useCallback(
    (tableIndex: number, newThreat: Threat) => {
      setTables((prev) => {
        const newTables = [...prev];
        const oldTable = newTables[tableIndex];

        if (!oldTable) return prev;

        // Create new table with new threat added
        const newTable: ThreatTable = {
          ...oldTable,
          threats: [
            ...oldTable.threats,
            {
              ...newThreat,
              created: new Date().toISOString(),
              lastModified: new Date().toISOString(),
            },
          ],
        };

        newTables[tableIndex] = newTable;
        notifyUpdate(newTables);
        return newTables;
      });
    },
    [notifyUpdate],
  );

  const updateTable = useCallback(
    (tableIndex: number, updatedTable: ThreatTable) => {
      setTables((prev) => {
        const newTables = [...prev];
        newTables[tableIndex] = updatedTable;
        notifyUpdate(newTables);
        return newTables;
      });
    },
    [notifyUpdate],
  );

  // ==================== RETURN ====================

  return {
    tables,
    syncStatus,
    isGenerating,
    isSyncing,
    stats,
    generateThreats,
    deleteAllThreats,
    synchronizeThreats,
    updateThreat,
    deleteThreat,
    addThreat,
    updateTable,
  };
}