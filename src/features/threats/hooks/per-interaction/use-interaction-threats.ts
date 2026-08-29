// ==================== USE INTERACTION THREATS ====================
// Hook for managing per-interaction threat state and operations
// CORRECTED: Proper immutability for React.memo compatibility

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
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
import { interactionThreatService } from "../../services/per-interaction/interaction-threat-service";
import { retainManualThreatTables } from "../../services/threat-identity";
import type { StatisticsResult } from "../../services/threat-service";
import type { DFDAnalysisContext } from "shared";

// ==================== TYPES ====================

export interface UseInteractionThreatsOptions {
  project: ThreatProjectData;
  dfdContext: DFDAnalysisContext;
  configuration: ThreatConfiguration;
  onUpdate?: (data: ThreatData) => void;
}

export interface UseInteractionThreatsResult {
  // State
  tables: ThreatTable[];
  syncStatus: ThreatSyncStatus | null;
  isGenerating: boolean;
  isSyncing: boolean;

  // Statistics
  stats: StatisticsResult;

  // Operations
  generateThreats: (options?: { keepManual?: boolean }) => Promise<boolean>;
  deleteAllThreats: (options?: { keepManual?: boolean }) => void;
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

export function useInteractionThreats({
  project,
  dfdContext,
  configuration,
  onUpdate,
}: UseInteractionThreatsOptions): UseInteractionThreatsResult {
  const projectRef = useRef<ThreatProjectData>(project);
  const dfdContextRef = useRef<DFDAnalysisContext | null>(
    dfdContext && !dfdContext.isDummy() ? dfdContext : null,
  );

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    if (dfdContext && !dfdContext.isDummy()) {
      dfdContextRef.current = dfdContext;
    }
  }, [dfdContext]);
  // ==================== STATE ====================

  const [tables, setTables] = useState<ThreatTable[]>(
    () => project.threats?.perInteractionTables ?? [],
  );
  const [syncStatus, setSyncStatus] = useState<ThreatSyncStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ==================== SYNC STATUS CHECK ====================
  useEffect(() => {
    if (
      project.dfdElements &&
      project.dfdElements.length > 0 &&
      project.dfdConnections
    ) {
      const status = interactionThreatService.checkSyncStatus(project, tables);
      setSyncStatus(status);
    } else {
      setSyncStatus(null);
    }
  }, [project.dfdElements, project.dfdConnections, tables]);

  // ==================== STATISTICS ====================

  const stats = useMemo(() => {
    return interactionThreatService.getStatistics(tables);
  }, [tables]);

  // ==================== NOTIFY PARENT ====================

  const notifyUpdate = useCallback(
    (updatedTables: ThreatTable[]) => {
      onUpdate?.({
        configuration,
        perElementTables: project.threats?.perElementTables ?? [],
        perInteractionTables: updatedTables,
        lastModified: new Date().toISOString(),
      });
    },
    [project, configuration, onUpdate],
  );

  useEffect(() => {
    setTables(project.threats?.perInteractionTables ?? []);
  }, [project.threats?.perInteractionTables]);

  // ==================== OPERATIONS ====================
  const generateThreats = useCallback(
    async (options?: { keepManual?: boolean }): Promise<boolean> => {
    const ctx = dfdContextRef.current || dfdContext;
    const proj = projectRef.current;

    if (!ctx || ctx.isDummy()) {
      console.warn(
        "🔥 DFDContext noch nicht bereit, warte auf Aktualisierung...",
      );
      return false;
    }

    setIsGenerating(true);
    try {
      const result = interactionThreatService.generateThreats(
        proj,
        ctx,
        configuration,
        options,
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
    } catch {
      setIsGenerating(false);
      return false;
    }
  }, [configuration, notifyUpdate]);

  const deleteAllThreats = useCallback(
    (options?: { keepManual?: boolean }) => {
      const kept = options?.keepManual
        ? retainManualThreatTables(tables)
        : [];

      setTables(kept);

      // Aktuelle Threats oder Default
      const oldThreats: ThreatData = projectRef.current.threats ?? {
        configuration,
        perElementTables: [],
        perInteractionTables: [],
        lastModified: new Date().toISOString(),
      };

      // Aktualisiere projectRef
      projectRef.current = {
        ...projectRef.current,
        threats: {
          ...oldThreats,
          perInteractionTables: kept,
          lastModified: new Date().toISOString(),
        },
      };

      // Notify parent
      notifyUpdate(kept);
    },
    [tables, configuration, notifyUpdate],
  );

  const synchronizeThreats = useCallback(
    async (options: {
      updateReferences: boolean;
      removeOrphaned: boolean;
    }): Promise<boolean> => {
      if (!syncStatus) return false;

      setIsSyncing(true);
      try {
        const result = interactionThreatService.synchronizeThreats(
          project,
          dfdContext,
          tables,
          syncStatus,
          options,
        );

        if (result.success && result.threatData) {
          const updatedTables = result.threatData.perInteractionTables ?? [];
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