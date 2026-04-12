// ==================== INTERACTION THREAT SERVICE ====================

import type {
  ThreatTable,
  ThreatConfiguration,
  ThreatProjectData,
  ThreatSyncStatus,
  ThreatSyncResult,
  ThreatTemplate,
  MitigationTemplate,
  VerificationTemplate,
} from "../../models/threat-types";
import type { StrideCategory } from "shared";
import type {
  ThreatService,
  GenerationResult,
  ValidationResult,
  StatisticsResult,
} from "../threat-service";
import { interactionThreatGenerator } from "./interaction-generator";
import { interactionThreatSync } from "./interaction-sync";
import {
  getLegacyMitigationTemplates,
  getLegacyVerificationTemplates,
} from "../threat-catalog-service";
import { type DFDAnalysisContext } from "shared";

export class InteractionThreatService implements ThreatService {
  generateThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    configuration: ThreatConfiguration,
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
        if (!threat.mitigation?.trim())
          warnings.push(`Threat ${threat.id}: Missing mitigation`);
        if (!threat.verification?.trim())
          warnings.push(`Threat ${threat.id}: Missing verification`);
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
    let completedThreats = 0;
    for (const table of tables) {
      for (const threat of table.threats) {
        totalThreats++;
        strideDistribution[threat.strideCategory]++;
        if (threat.mitigation?.trim()) completedThreats++;
      }
    }
    return {
      totalThreats,
      completedThreats,
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

  // Per-interaction does not use element threat templates
  getThreatTemplates(
    _strideCategory?: StrideCategory,
    _elementType?: string,
    customTemplates: ThreatTemplate[] = [],
  ): ThreatTemplate[] {
    return customTemplates;
  }

  getMitigationTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates: MitigationTemplate[] = [],
  ): MitigationTemplate[] {
    return getLegacyMitigationTemplates(
      strideCategory,
      elementType,
      customTemplates,
    );
  }

  getVerificationTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates: VerificationTemplate[] = [],
  ): VerificationTemplate[] {
    return getLegacyVerificationTemplates(
      strideCategory,
      elementType,
      customTemplates,
    );
  }
}

export const interactionThreatService = new InteractionThreatService();
