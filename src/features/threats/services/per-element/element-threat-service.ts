// ==================== ELEMENT THREAT SERVICE ====================
// Main service for STRIDE per-element threat operations
// Delegates to generator and sync services

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
  ThreatCatalog,
  GenerationResult,
  ValidationResult,
  StatisticsResult,
} from "../threat-service";
import { elementThreatGenerator } from "./element-generator";
import { elementThreatSync } from "./element-sync";
import threatCatalogData from "../threat-catalog.json";

// ==================== ELEMENT THREAT SERVICE ====================

export class ElementThreatService implements ThreatService {
  private catalog: ThreatCatalog;

  constructor() {
    this.catalog = threatCatalogData as ThreatCatalog;
  }

  // ==================== GENERATION ====================

  generateThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    configuration: ThreatConfiguration,
  ): GenerationResult {
    try {
      const elements = project.dfdElements || [];

      if (elements.length === 0) {
        return {
          success: false,
          tables: [],
          error: "No DFD elements found",
        };
      }

      const tables = elementThreatGenerator.generateThreatsForProject(
        project,
        this.catalog,
      );

      return {
        success: true,
        tables,
      };
    } catch (error) {
      return {
        success: false,
        tables: [],
        error: error instanceof Error ? error.message : "Generation failed",
      };
    }
  }

  // ==================== VALIDATION ====================

  validateThreats(tables: ThreatTable[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const table of tables) {
      for (const threat of table.threats) {
        // Check required fields
        if (!threat.threatDescription?.trim()) {
          errors.push(`Threat ${threat.id}: Missing threat description`);
        }
        if (!threat.attackDescription?.trim()) {
          warnings.push(`Threat ${threat.id}: Missing attack description`);
        }
        if (!threat.mitigation?.trim()) {
          warnings.push(`Threat ${threat.id}: Missing mitigation`);
        }
        if (!threat.verification?.trim()) {
          warnings.push(`Threat ${threat.id}: Missing verification`);
        }
      }
    }

    return {
      isComplete: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==================== STATISTICS ====================

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

  // ==================== SYNC ====================

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
    options: {
      updateReferences: boolean;
      removeOrphaned: boolean;
    },
  ): ThreatSyncResult {
    return elementThreatSync.synchronizeThreats(
      project,
      dfdContext,
      tables,
      syncStatus,
      options,
      this.catalog,
    );
  }

  // ==================== CATALOG ACCESS ====================

  getThreatTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates: ThreatTemplate[] = [],
  ): ThreatTemplate[] {
    let templates = [...this.catalog.threatTemplates, ...customTemplates];

    if (strideCategory) {
      templates = templates.filter((t) => t.strideCategory === strideCategory);
    }

    if (elementType) {
      templates = templates.filter((t) => t.elementTypes.includes(elementType));
    }

    return templates;
  }

  getMitigationTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates: MitigationTemplate[] = [],
  ): MitigationTemplate[] {
    let templates = [...this.catalog.mitigationTemplates, ...customTemplates];

    if (strideCategory) {
      templates = templates.filter((t) => t.strideCategory === strideCategory);
    }

    // Filter by element type for Physical/Interface elements
    if (elementType === "PhysicalInterface" || elementType === "Interface") {
      templates = templates.filter((t) => t.id.includes("-IF-"));
    } else if (elementType) {
      templates = templates.filter((t) => !t.id.includes("-IF-"));
    }

    return templates;
  }

  getVerificationTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates: VerificationTemplate[] = [],
  ): VerificationTemplate[] {
    let templates = [...this.catalog.verificationTemplates, ...customTemplates];

    if (strideCategory) {
      templates = templates.filter((t) => t.strideCategory === strideCategory);
    }

    // Filter by element type for Physical/Interface elements
    if (elementType === "PhysicalInterface" || elementType === "Interface") {
      templates = templates.filter((t) => t.id.includes("-IF-"));
    } else if (elementType) {
      templates = templates.filter((t) => !t.id.includes("-IF-"));
    }

    return templates;
  }
}

// ==================== EXPORT SINGLETON ====================

export const elementThreatService = new ElementThreatService();