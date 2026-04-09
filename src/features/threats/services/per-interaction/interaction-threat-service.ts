// ==================== INTERACTION THREAT SERVICE ====================
// Main service for STRIDE per-interaction threat operations
// Delegates to generator and sync services
// Now requires DFDGraph for all operations

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
  ThreatCatalog,
  GenerationResult,
  ValidationResult,
  StatisticsResult,
} from "../threat-service";
import { interactionThreatGenerator } from "./interaction-generator";
import { interactionThreatSync } from "./interaction-sync";
import threatCatalogData from "../threat-catalog.json";
import { type DFDAnalysisContext } from "shared";

// ==================== INTERACTION THREAT SERVICE ====================

export class InteractionThreatService implements ThreatService {
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
      // Validate graph exists
      if (!project.dfdGraph) {
        return {
          success: false,
          tables: [],
          error:
            "DFD graph not initialized. Please ensure DFD is properly parsed.",
        };
      }

      // Check if graph has any elements
      if (project.dfdGraph.elementsById.size === 0) {
        return {
          success: false,
          tables: [],
          error: "No DFD elements found in graph",
        };
      }

      // Generate threats using graph-based generator
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
        // For per-interaction, threats can have empty descriptions
        // (UI uses templates for localization)
        // So we only check for mitigation/verification
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

        // For per-interaction, we consider it complete if has mitigation
        // (description is optional, uses templates)
        if (threat.mitigation?.trim()) {
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
    return interactionThreatSync.checkSyncStatus(project, tables);
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
    return interactionThreatSync.synchronizeThreats(
      project,
      dfdContext,
      tables,
      syncStatus,
      options,
    );
  }

  // ==================== CATALOG ACCESS ====================

  getThreatTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates: ThreatTemplate[] = [],
  ): ThreatTemplate[] {
    // Per-interaction doesn't use catalog templates directly
    // It uses interaction-templates.ts instead
    return customTemplates;
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

    // Filter interface-specific templates
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

    // Filter interface-specific templates
    if (elementType === "PhysicalInterface" || elementType === "Interface") {
      templates = templates.filter((t) => t.id.includes("-IF-"));
    } else if (elementType) {
      templates = templates.filter((t) => !t.id.includes("-IF-"));
    }

    return templates;
  }
}

// ==================== EXPORT SINGLETON ====================

export const interactionThreatService = new InteractionThreatService();