// ==================== DFD SERVICE ====================
// Single Responsibility: Business logic for DFD operations
// Orchestrates Parser, Validator, and StorageAdapter
// NO dependency on app - uses DFDProjectData from dfd-types

import { PhaseStatus, PhaseStatusMap } from "shared";
import {
  DFDData,
  DFDStats,
  DFDProjectData,
  DFDElement,
  DFDConnection,
} from "../models/dfd-types";
import type { DFDAsset, ElementRelation } from "../models/dfd-asset-types";
import { DFDParser, dfdParser } from "./dfd-parser";
import { DFDValidator, dfdValidator, ValidationResult } from "./dfd-validator";
import {
  DFDStorageAdapter,
  createDFDStorageAdapter,
} from "./dfd-storage-adapter";
import { DefaultDFDGraphBuilder } from "./dfd-graph-builder";
import { dfdChangeDetector } from "../utils/dfd-change-detector";
import { DFDGraphAnalysisContext } from "../adapters/dfd-graph-analysis-context";
import { calculateStats } from "./parsers/stats-calculator";
import {
  isSystemUsesRelation,
  isInfraAccessesRelation,
} from "../models/asset-relation-types";

export interface DFDSaveResult {
  success: boolean;
  dfd: DFDData;
  graphContext: DFDGraphAnalysisContext;
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
  graphContext: DFDGraphAnalysisContext;
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
      const emptyContext = DFDGraphAnalysisContext.createDummyGraph();
      const adapter = createDFDStorageAdapter(project.id);
      adapter.loadToLocalStorage(project.dfd);

      const hasData = Boolean(project.dfd?.xml);

      if (!hasData) {
        project.dfd = {
          xml: undefined,
          elements: [],
          connections: [],
          assets: [],
          stats: undefined,
          lastModified: new Date().toISOString(),
        };
        return {
          success: true,
          hasData: false,
          stats: project.dfd.stats,
          graphContext: emptyContext,
        };
      }

      // Parse XML
      const parseResult = this.parser.parse(project.dfd!.xml!);
      const { elements, connections, unconnectedDataflows } =
        parseResult;

      // Merge with existing user properties
      const mergedElements = this.mergeElementProperties(
        elements,
        project.dfd?.elements || [],
      );
      const mergedConnections = this.mergeConnectionProperties(
        connections,
        project.dfd?.connections || [],
      );
      const mergedAssets = this.mergeAssetProperties(project.dfd?.assets || []);

      // Sync linkedElements
      const syncedAssets = this.syncAssetLinkedElements(
        mergedElements,
        mergedConnections,
        mergedAssets,
      );

      // Recalculate stats **nach merge**
      const stats = calculateStats(
        mergedElements,
        mergedConnections,
        syncedAssets,
      );

      // Build DFD graph
      const graphBuilder = new DefaultDFDGraphBuilder();
      const graph = graphBuilder.build({
        elements: mergedElements,
        connections: mergedConnections,
        assets: syncedAssets,
      });

      const graphContext = new DFDGraphAnalysisContext(graph);

      // Run initial validation
      const validation = this.validator.validate(
        mergedElements,
        mergedConnections,
        syncedAssets,
        stats,
        graph,
        {
          unconnectedDataflows,
        },
      );

      // Assign fully initialized DFD to project
      project.dfd = {
        xml: project.dfd!.xml,
        elements: mergedElements,
        connections: mergedConnections,
        assets: syncedAssets,
        stats,
        validation: this.validator.createValidationData(validation),
        lastModified: new Date().toISOString(),
        graph: graph,
      };

      return { success: true, hasData: true, stats, graphContext };
    } catch (error) {
      return {
        success: false,
        hasData: false,
        error: error instanceof Error ? error.message : "Failed to load DFD",
        graphContext: DFDGraphAnalysisContext.createDummyGraph(),
      };
    }
  }

  // ==================== SAVE OPERATIONS ====================

  /**
   * Merge parsed elements with existing properties
   * Parser gives us fresh geometry/names, but we keep user-defined properties
   */
  private mergeElementProperties(
    parsedElements: DFDElement[],
    existingElements: DFDElement[],
  ): DFDElement[] {
    return parsedElements.map((parsed) => {
      const existing = existingElements.find((e) => e.id === parsed.id);
      if (!existing) return parsed;

      // Keep geometry/name from parser, but preserve user properties
      return {
        ...parsed,
        properties: existing.properties || parsed.properties,
        assetRelations: existing.assetRelations || parsed.assetRelations,
      };
    });
  }

  /**
   * Merge parsed connections with existing properties
   */
  private mergeConnectionProperties(
    parsedConnections: DFDConnection[],
    existingConnections: DFDConnection[],
  ): DFDConnection[] {
    return parsedConnections.map((parsed) => {
      const existing = existingConnections.find((c) => c.id === parsed.id);
      if (!existing) return parsed;

      return {
        ...parsed,
        properties: existing.properties || parsed.properties,
        assetRelations: existing.assetRelations || parsed.assetRelations,
      };
    });
  }

  /**
   * Carry the project's assets through a re-parse of the DrawIO XML.
   *
   * Assets are NOT markers on the canvas — they are references that live in
   * dfd.assets[] and are linked to elements via element.assetRelations. The
   * XML therefore contributes nothing to the asset list; the project's
   * existing assets are the single source of truth and pass through
   * untouched here. linkedElements are cleared and recomputed from
   * assetRelations in syncAssetLinkedElements().
   *
   * (Historically this merged a parsed "asset marker" list against the
   * project's assets — the marker concept has been removed, so there is no
   * parsed list to merge anymore.)
   */
  private mergeAssetProperties(existingAssets: DFDAsset[]): DFDAsset[] {
    return existingAssets.map((a) => ({
      ...a,
      linkedElements: [], // Recomputed by syncAssetLinkedElements()
    }));
  }

  /**
   * Synchronize asset.linkedElements from element.assetRelations
   *
   * This is the SINGLE SOURCE OF TRUTH sync:
   * - element.assetRelations → asset.linkedElements (one-way sync)
   * - Overwrites all linkedElements based on current assetRelations
   * - Called after merge, before validation
   */
  private syncAssetLinkedElements(
    elements: DFDElement[],
    connections: DFDConnection[],
    assets: DFDAsset[],
  ): DFDAsset[] {
    // Build map: assetId → ElementRelation[]
    const assetLinksMap = new Map<string, ElementRelation[]>();

    // Process all elements
    elements.forEach((element) => {
      if (!element.assetRelations || element.assetRelations.length === 0) {
        return;
      }

      element.assetRelations.forEach((relation) => {
        const elementRelation: ElementRelation = {
          elementId: element.id,
          elementName: element.name,
          elementType: element.type,
          displayId: element.displayId,
          relationType: relation.relationType,
          qualifier: isSystemUsesRelation(relation)
            ? relation.qualifier
            : isInfraAccessesRelation(relation)
              ? relation.qualifier
              : undefined,
          notes: relation.notes,
        };

        const existing = assetLinksMap.get(relation.assetId) || [];
        assetLinksMap.set(relation.assetId, [...existing, elementRelation]);
      });
    });

    // Process all connections (DataFlows can also have assetRelations)
    connections.forEach((connection) => {
      if (
        !connection.assetRelations ||
        connection.assetRelations.length === 0
      ) {
        return;
      }

      connection.assetRelations.forEach((relation) => {
        const elementRelation: ElementRelation = {
          elementId: connection.id,
          elementName: connection.name || "Unnamed DataFlow",
          elementType: "DataFlow",
          displayId: connection.displayId,
          relationType: relation.relationType,
          qualifier: isSystemUsesRelation(relation)
            ? relation.qualifier
            : isInfraAccessesRelation(relation)
              ? relation.qualifier
              : undefined,
          notes: relation.notes,
        };

        const existing = assetLinksMap.get(relation.assetId) || [];
        assetLinksMap.set(relation.assetId, [...existing, elementRelation]);
      });
    });

    // Update all assets with computed linkedElements
    return assets.map((asset) => ({
      ...asset,
      linkedElements: assetLinksMap.get(asset.id) || [],
    }));
  }

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
        assets: [], // ← NEW
      },
      graphContext: DFDGraphAnalysisContext.createDummyGraph(),
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
      const { elements, connections, unconnectedDataflows } =
        this.parser.parse(xml || "");

      // Merge with existing properties (preserves assetRelations, user descriptions, etc.)
      const mergedElements = this.mergeElementProperties(
        elements,
        project.dfd?.elements || [],
      );

      const mergedConnections = this.mergeConnectionProperties(
        connections,
        project.dfd?.connections || [],
      );

      const mergedAssets = this.mergeAssetProperties(project.dfd?.assets || []);

      // Sync linkedElements from assetRelations (SINGLE SOURCE OF TRUTH)
      const syncedAssets = this.syncAssetLinkedElements(
        mergedElements,
        mergedConnections,
        mergedAssets,
      );

      // Recalculate stats after merge — assets live in dfd.assets[], not
      // in the XML, so parse-time stats always report 0 assets.
      const stats = calculateStats(
        mergedElements,
        mergedConnections,
        syncedAssets,
      );

      const graphBuilder = new DefaultDFDGraphBuilder();

      // Detect topology changes — only rebuild graph if structure changed.
      // Property-only changes (e.g. TB.exposureLevel) only need deriveExposureLevels().
      const changeResult = dfdChangeDetector.detect(
        project.dfd?.elements ?? [],
        project.dfd?.connections ?? [],
        mergedElements,
        mergedConnections,
      );

      console.debug(
        "[saveDFD] Topology change:",
        changeResult.level,
        "-",
        changeResult.reason,
      );

      let dfdGraph;
      if (changeResult.requiresRebuild || !project.dfd?.graph) {
        // Full rebuild — topology changed or no existing graph
        dfdGraph = graphBuilder.build({
          elements: mergedElements,
          connections: mergedConnections,
          assets: syncedAssets,
        });
      } else {
        // Reuse existing graph — only re-derive exposure levels
        dfdGraph = project.dfd.graph;
        graphBuilder.deriveExposureLevels(
          mergedElements,
          mergedConnections,
          dfdGraph.dataFlowAnalysis,
          dfdGraph.elementTrustBoundaries,
          dfdGraph.elementChipBoundaries,
          dfdGraph.elementPhysicalBoundaries,
        );
      }

      console.debug("[saveDFD] DFDGraph ready", dfdGraph);
      const graphContext = new DFDGraphAnalysisContext(dfdGraph);

      const validation = this.validator.validate(
        mergedElements,
        mergedConnections,
        syncedAssets,
        stats,
        dfdGraph,
        {
          unconnectedDataflows,
        },
      );

      // Create DFD data
      const dfdData: DFDData = {
        xml: xml || undefined,
        elements: mergedElements,
        connections: mergedConnections,
        assets: syncedAssets, // Use synced assets with computed linkedElements
        stats,
        validation: this.validator.createValidationData(validation),
        lastModified: new Date().toISOString(),
        graph: dfdGraph,
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
        graphContext: graphContext,
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

  /**
   * Save DFD from XML passed directly — no localStorage read.
   * Called by scheduleDrawioSave() after draw.io autosave event.
   * The autosave event already carries the XML; reading it back from
   * localStorage is unnecessary and adds a race condition.
   */
  saveDFDFromXml(project: DFDProjectData, xml: string): DFDSaveResult {
    const emptyResult: DFDSaveResult = {
      success: false,
      dfd: { elements: [], connections: [], assets: [] },
      graphContext: DFDGraphAnalysisContext.createDummyGraph(),
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
      const { elements, connections, unconnectedDataflows } =
        this.parser.parse(xml);

      const mergedElements = this.mergeElementProperties(
        elements,
        project.dfd?.elements || [],
      );
      const mergedConnections = this.mergeConnectionProperties(
        connections,
        project.dfd?.connections || [],
      );
      const mergedAssets = this.mergeAssetProperties(project.dfd?.assets || []);
      const syncedAssets = this.syncAssetLinkedElements(
        mergedElements,
        mergedConnections,
        mergedAssets,
      );

      // Recalculate stats after merge — assets live in dfd.assets[], not
      // in the XML, so parse-time stats always report 0 assets.
      const stats = calculateStats(
        mergedElements,
        mergedConnections,
        syncedAssets,
      );

      const graphBuilder = new DefaultDFDGraphBuilder();
      const changeResult = dfdChangeDetector.detect(
        project.dfd?.elements ?? [],
        project.dfd?.connections ?? [],
        mergedElements,
        mergedConnections,
      );

      let dfdGraph;
      if (changeResult.requiresRebuild || !project.dfd?.graph) {
        dfdGraph = graphBuilder.build({
          elements: mergedElements,
          connections: mergedConnections,
          assets: syncedAssets,
        });
      } else {
        dfdGraph = project.dfd.graph;
        graphBuilder.deriveExposureLevels(
          mergedElements,
          mergedConnections,
          dfdGraph.dataFlowAnalysis,
          dfdGraph.elementTrustBoundaries,
          dfdGraph.elementChipBoundaries,
          dfdGraph.elementPhysicalBoundaries,
        );
      }

      const graphContext = new DFDGraphAnalysisContext(dfdGraph);
      const validation = this.validator.validate(
        mergedElements,
        mergedConnections,
        syncedAssets,
        stats,
        dfdGraph,
        { unconnectedDataflows },
      );

      const dfdData: DFDData = {
        xml, // ← direkt, kein localStorage
        elements: mergedElements,
        connections: mergedConnections,
        assets: syncedAssets,
        stats,
        validation: this.validator.createValidationData(validation),
        lastModified: new Date().toISOString(),
        graph: dfdGraph,
      };

      const phaseStatus = this.determinePhaseStatus(validation);
      const updatedPhaseStatus: PhaseStatusMap = {
        ...project.phaseStatus,
        1: phaseStatus,
      };

      return {
        success: true,
        dfd: dfdData,
        graphContext,
        phaseStatus: updatedPhaseStatus,
        lastModified: new Date().toISOString(),
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
  validateCurrentState(project: DFDProjectData): ValidationResult {
    const adapter = createDFDStorageAdapter(project.id);
    adapter.syncFromLegacy();
    const xml = adapter.getXml();
    const { elements, connections, unconnectedDataflows } =
      this.parser.parse(xml || "");

    const mergedConnections = this.mergeConnectionProperties(
      connections,
      project.dfd?.connections || [],
    );
    const mergedElements = this.mergeElementProperties(
      elements,
      project.dfd?.elements || [],
    );

    // NEU — Assets aus project.dfd mergen und linkedElements syncen
    const mergedAssets = this.mergeAssetProperties(project.dfd?.assets || []);
    const syncedAssets = this.syncAssetLinkedElements(
      mergedElements,
      mergedConnections,
      mergedAssets,
    );

    // Recalculate stats after merge — assets live in dfd.assets[], not in
    // the XML, so parse-time stats always report 0 assets.
    const stats = calculateStats(
      mergedElements,
      mergedConnections,
      syncedAssets,
    );

    const graphBuilder = new DefaultDFDGraphBuilder();
    const graph = graphBuilder.build({
      elements: mergedElements,
      connections: mergedConnections,
      assets: syncedAssets, // NEU
    });

    return this.validator.validate(
      mergedElements,
      mergedConnections,
      syncedAssets,
      stats,
      graph,
      { unconnectedDataflows },
    );
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