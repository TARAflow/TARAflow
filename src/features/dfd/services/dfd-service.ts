// ==================== DFD SERVICE ====================
// Single Responsibility: Business logic for DFD operations
// Orchestrates Parser, Validator, and StorageAdapter
// NO dependency on app - uses DFDProjectData from dfd-types

import { PhaseStatus, PhaseStatusMap } from "shared";
import { DFDData, DFDStats, DFDProjectData } from "../models/dfd-types";
import { DFDParser, dfdParser } from "./dfd-parser";
import { DFDValidator, dfdValidator, ValidationResult } from "./dfd-validator";
import {
  DFDStorageAdapter,
  createDFDStorageAdapter,
} from "./dfd-storage-adapter";

export interface DFDSaveResult {
  success: boolean;
  dfd: DFDData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
  validation: ValidationResult;
  error?: string;
}

export interface DFDLoadResult {
  success: boolean;
  hasData: boolean;
  stats?: DFDStats;
  error?: string;
}

/**
 * DFDService - Orchestrates DFD operations
 * 
 * Follows Single Responsibility: Only handles DFD business logic
 * Depends on: DFDParser, DFDValidator, DFDStorageAdapter (Dependency Inversion)
 * 
 * Uses DFDProjectData instead of Project to avoid circular dependency with app.
 * Returns DFDSaveResult with just the DFD-related updates, not a full Project.
 */
class DFDService {
  private parser: DFDParser;
  private validator: DFDValidator;

  constructor(parser: DFDParser, validator: DFDValidator) {
    this.parser = parser;
    this.validator = validator;
  }

  // ==================== LOAD OPERATIONS ====================

  /**
   * Load DFD data from project into localStorage for DrawIO
   */
  loadDFDForEditing(project: DFDProjectData): DFDLoadResult {
    try {
      const adapter = createDFDStorageAdapter(project.id);
      adapter.loadToLocalStorage(project.dfd);

      const hasData = Boolean(project.dfd?.xml);
      const stats = hasData
        ? this.parser.parse(project.dfd!.xml!).stats
        : undefined;

      return { success: true, hasData, stats };
    } catch (error) {
      return {
        success: false,
        hasData: false,
        error: error instanceof Error ? error.message : "Failed to load DFD",
      };
    }
  }

  // ==================== SAVE OPERATIONS ====================

  /**
   * Save current DFD state
   * Returns DFDSaveResult with DFD data and phase status updates
   * App layer is responsible for merging this into the full Project
   */
  saveDFD(project: DFDProjectData): DFDSaveResult {
    const emptyResult: DFDSaveResult = {
      success: false,
      dfd: {
        elements: [],
        connections: [],
      },
      phaseStatus: { ...project.phaseStatus },
      lastModified: new Date().toISOString(),
      validation: {
        isValid: false,
        isComplete: false,
        errors: [],
        warnings: [],
        scenario: null,
      },
    };

    try {
      const adapter = createDFDStorageAdapter(project.id);

      // Sync from legacy keys (DrawIO writes to legacy keys)
      adapter.syncFromLegacy();

      // Get current XML
      const xml = adapter.getXml();

      // Parse and validate
      const { elements, connections, stats, unconnectedDataflows } =
        this.parser.parse(xml || "");
      const validation = this.validator.validate(elements, connections, stats, {
        unconnectedDataflows,
      });

      // Create DFD data
      const dfdData: DFDData = {
        xml: xml || undefined,
        elements,
        connections,
        stats,
        validation: this.validator.createValidationData(validation),
        lastModified: new Date().toISOString(),
      };

      // Determine phase status
      const phaseStatus = this.determinePhaseStatus(validation);
      const lastModified = new Date().toISOString();

      // Create updated phase status map
      const updatedPhaseStatus: PhaseStatusMap = {
        ...project.phaseStatus,
        1: phaseStatus,
      };

      return {
        success: true,
        dfd: dfdData,
        phaseStatus: updatedPhaseStatus,
        lastModified,
        validation,
      };
    } catch (error) {
      return {
        ...emptyResult,
        error: error instanceof Error ? error.message : "Failed to save DFD",
      };
    }
  }

  // ==================== VALIDATION ====================

  /**
   * Validate current DFD state (without saving)
   */
  validateCurrentState(projectId: string): ValidationResult {
    const adapter = createDFDStorageAdapter(projectId);
    adapter.syncFromLegacy();

    const xml = adapter.getXml();
    const { elements, connections, stats, unconnectedDataflows } =
      this.parser.parse(xml || "");

    return this.validator.validate(elements, connections, stats, {
      unconnectedDataflows,
    });
  }

  /**
   * Get current DFD stats
   */
  getCurrentStats(projectId: string): DFDStats {
    const adapter = createDFDStorageAdapter(projectId);
    adapter.syncFromLegacy();

    const xml = adapter.getXml();
    return this.parser.parse(xml || "").stats;
  }

  // ==================== PHASE STATUS ====================

  private determinePhaseStatus(validation: ValidationResult): PhaseStatus {
    if (validation.isComplete) return "complete";
    if (validation.isValid) return "in-progress";
    if (validation.errors.length > 0) return "incomplete";
    return "in-progress";
  }

  // ==================== PROJECT SWITCHING ====================

  /**
   * Clear DFD data when switching projects
   */
  clearForProjectSwitch(projectId: string): void {
    const adapter = createDFDStorageAdapter(projectId);
    adapter.clearLocalStorage();
    DFDStorageAdapter.clearLegacyStorage();
  }

  // ==================== EXPORT ====================

  /**
   * Get DFD data for project export
   */
  exportDFDData(projectId: string): {
    xml: string | null;
    overviewTable: unknown[];
    threatTables: unknown[][];
  } {
    const adapter = createDFDStorageAdapter(projectId);
    adapter.syncFromLegacy();

    return {
      xml: adapter.getXml(),
      overviewTable: adapter.getOverviewTable(),
      threatTables: adapter.getThreatTables(),
    };
  }
}

// Export singleton instance with injected dependencies
export const dfdService = new DFDService(dfdParser, dfdValidator);
export default dfdService;