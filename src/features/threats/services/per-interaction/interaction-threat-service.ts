// ==================== INTERACTION THREAT SERVICE ====================

import type {
  ThreatTable,
  ThreatConfiguration,
  ThreatProjectData,
  ThreatSyncStatus,
  ThreatSyncResult,
} from "../../models/threat-types";
import type { DFDAnalysisContext, StrideCategory } from "shared";
import type {
  ThreatService,
  GenerationResult,
  ValidationResult,
  StatisticsResult,
} from "../threat-service";
import { interactionThreatGenerator } from "./interaction-generator";
import { interactionThreatSync } from "./interaction-sync";

export class InteractionThreatService implements ThreatService {
  generateThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    configuration: ThreatConfiguration,
    options?: { keepManual?: boolean },
  ): GenerationResult {
    try {
      if (!project.dfdGraph) {
        return {
          success: false,
          tables: [],
          error: "DFD graph not initialized.",
        };
      }
      if (project.dfdGraph.elementsById.size === 0) {
        return {
          success: false,
          tables: [],
          error: "No DFD elements found in graph.",
        };
      }

      const tables = interactionThreatGenerator.generateThreatsForProject(
        project,
        dfdContext,
        configuration,
        options,
      );

      if (tables.length === 0) {
        return {
          success: false,
          tables: [],
          error:
            "No threats generated. Ensure DFD has trust boundaries with data flows or interfaces.",
        };
      }
      return { success: true, tables };
    } catch (error) {
      return {
        success: false,
        tables: [],
        error: error instanceof Error ? error.message : "Generation failed",
      };
    }
  }

  validateThreats(tables: ThreatTable[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    for (const table of tables) {
      for (const threat of table.threats) {
        if (threat.proposedMitigations.length === 0)
          warnings.push(`Threat ${threat.displayId}: No mitigations proposed`);
        if (threat.proposedVerifications.length === 0)
          warnings.push(`Threat ${threat.displayId}: No verifications proposed`);
      }
    }
    return { isComplete: errors.length === 0, errors, warnings };
  }

  getStatistics(tables: ThreatTable[]): StatisticsResult {
    const strideDistribution: Record<StrideCategory, number> = {
      S: 0,
      T: 0,
      R: 0,
      I: 0,
      D: 0,
      E: 0,
    };
    let totalThreats = 0;
    let reviewedThreats = 0;
    for (const table of tables) {
      for (const threat of table.threats) {
        totalThreats++;
        strideDistribution[threat.strideCategory]++;
        if (
          threat.workflowStatus === "reviewed" ||
          threat.workflowStatus === "closed"
        )
          reviewedThreats++;
      }
    }
    return {
      totalThreats,
      reviewedThreats,
      trustBoundaries: tables.length,
      strideDistribution,
    };
  }

  checkSyncStatus(
    project: ThreatProjectData,
    tables: ThreatTable[],
  ): ThreatSyncStatus {
    return interactionThreatSync.checkSyncStatus(project, tables);
  }

  synchronizeThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    tables: ThreatTable[],
    syncStatus: ThreatSyncStatus,
    options: { updateReferences: boolean; removeOrphaned: boolean },
  ): ThreatSyncResult {
    return interactionThreatSync.synchronizeThreats(
      project,
      dfdContext,
      tables,
      syncStatus,
      options,
    );
  }
}

export const interactionThreatService = new InteractionThreatService();