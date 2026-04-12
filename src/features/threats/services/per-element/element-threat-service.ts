// ==================== ELEMENT THREAT SERVICE ====================

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
import type { DFDAnalysisContext, StrideCategory } from "shared";
import type {
  ThreatService,
  GenerationResult,
  ValidationResult,
  StatisticsResult,
} from "../threat-service";
import { elementThreatGenerator } from "./element-generator";
import { elementThreatSync } from "./element-sync";
import {
  getLegacyThreatTemplates,
  getLegacyMitigationTemplates,
  getLegacyVerificationTemplates,
} from "../threat-catalog-service";

export class ElementThreatService implements ThreatService {
  generateThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    _configuration: ThreatConfiguration,
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

      // Catalog no longer passed as parameter — generator uses catalog service directly
      const tables = elementThreatGenerator.generateThreatsForProject(project);

      if (tables.length === 0) {
        return {
          success: false,
          tables: [],
          error:
            "No threats generated. Ensure DFD has elements with applicable STRIDE categories.",
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
        if (!threat.threatDescription?.trim())
          errors.push(`Threat ${threat.id}: Missing threat description`);
        if (!threat.attackDescription?.trim())
          warnings.push(`Threat ${threat.id}: Missing attack description`);
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
        if (
          threat.threatDescription?.trim() &&
          threat.attackDescription?.trim() &&
          threat.mitigation?.trim()
        ) {
          completedThreats++;
        }
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
    return elementThreatSync.checkSyncStatus(project, tables);
  }

  synchronizeThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    tables: ThreatTable[],
    syncStatus: ThreatSyncStatus,
    options: { updateReferences: boolean; removeOrphaned: boolean },
  ): ThreatSyncResult {
    // Sync service still receives a catalog-like object for compatibility;
    // provide a minimal shim using the catalog service
    const catalogShim = {
      threatTemplates: getLegacyThreatTemplates(),
      mitigationTemplates: [],
      verificationTemplates: [],
    };
    return elementThreatSync.synchronizeThreats(
      project,
      dfdContext,
      tables,
      syncStatus,
      options,
    );
  }

  getThreatTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates: ThreatTemplate[] = [],
  ): ThreatTemplate[] {
    return getLegacyThreatTemplates(
      strideCategory,
      elementType,
      customTemplates,
    );
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

export const elementThreatService = new ElementThreatService();
