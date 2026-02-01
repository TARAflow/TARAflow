// ==================== BASE THREAT SERVICE ====================
// Interface for threat service operations
// Both per-element and per-interaction services implement this

import type {
  ThreatTable,
  ThreatConfiguration,
  ThreatProjectData,
  ThreatSyncStatus,
  ThreatSyncResult,
  ThreatValidation,
  ThreatTemplate,
  MitigationTemplate,
  VerificationTemplate,
} from "../models/threat-types";
import type { DFDAnalysisContext, StrideCategory } from "shared";

// ==================== CATALOG INTERFACE ====================

export interface ThreatCatalog {
  version: string;
  lastUpdated: string;
  description: string;
  threatTemplates: ThreatTemplate[];
  mitigationTemplates: MitigationTemplate[];
  verificationTemplates: VerificationTemplate[];
}

// ==================== SERVICE RESULT TYPES ====================

export interface GenerationResult {
  success: boolean;
  tables: ThreatTable[];
  error?: string;
}

export interface ValidationResult {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
}

export interface StatisticsResult {
  totalThreats: number;
  completedThreats: number;
  trustBoundaries: number;
  strideDistribution: Record<StrideCategory, number>;
}

// ==================== BASE THREAT SERVICE INTERFACE ====================

export interface ThreatService {
  /**
   * Generate threats from DFD data
   */
  generateThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    configuration: ThreatConfiguration,
  ): GenerationResult;

  /**
   * Validate threat completeness
   */
  validateThreats(tables: ThreatTable[]): ValidationResult;

  /**
   * Get statistics for threat tables
   */
  getStatistics(tables: ThreatTable[]): StatisticsResult;

  /**
   * Check synchronization status with DFD
   */
  checkSyncStatus(
    project: ThreatProjectData,
    tables: ThreatTable[],
  ): ThreatSyncStatus;

  /**
   * Synchronize threats with DFD changes
   */
  synchronizeThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    tables: ThreatTable[],
    syncStatus: ThreatSyncStatus,
    options: {
      updateReferences: boolean;
      removeOrphaned: boolean;
    },
  ): ThreatSyncResult;

  /**
   * Get threat templates from catalog
   */
  getThreatTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates?: ThreatTemplate[],
  ): ThreatTemplate[];

  /**
   * Get mitigation templates from catalog
   */
  getMitigationTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates?: MitigationTemplate[],
  ): MitigationTemplate[];

  /**
   * Get verification templates from catalog
   */
  getVerificationTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates?: VerificationTemplate[],
  ): VerificationTemplate[];
}
