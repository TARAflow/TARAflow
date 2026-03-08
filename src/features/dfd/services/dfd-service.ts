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
  DFDAsset,
  ElementRelation,
} from "../models/dfd-types";
import { DFDParser, dfdParser } from "./dfd-parser";
import { DFDValidator, dfdValidator, ValidationResult } from "./dfd-validator";
import {
  DFDStorageAdapter,
  createDFDStorageAdapter,
} from "./dfd-storage-adapter";
import { DefaultDFDGraphBuilder } from "./dfd-graph-builder";
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
      const { elements, connections, assets, unconnectedDataflows } =
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
      const mergedAssets = this.mergeAssetProperties(
        assets,
        project.dfd?.assets || [],
      );

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
        {
          unconnectedDataflows,
        },
        graph,
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
   * Merge parsed assets with existing properties
   * linkedElements are NOT merged here - they're computed in syncAssetLinkedElements()
   */
  private mergeAssetProperties(
    parsedAssets: DFDAsset[],
    existingAssets: DFDAsset[],
  ): DFDAsset[] {
    // Start with parsed assets from XML (if any)
    const merged = parsedAssets.map((parsed) => {
      const existing = existingAssets.find((a) => a.id === parsed.id);
      if (!existing) return parsed;

      // Keep parsed geometry, keep existing user properties
      return {
        id: parsed.id,
        displayId: parsed.displayId,
        name: existing.name || parsed.name,
        description: existing.description,
        assetGroup: existing.assetGroup ?? parsed.assetGroup,
        protectionNeed: existing.protectionNeed,
        properties: existing.properties || parsed.properties,
        linkedElements: [], // Will be set by syncAssetLinkedElements()
      };
    });

        // ✅ CRITICAL: Add existing assets that are NOT in parsed XML
    // This preserves assets created via AssetRelationSelector
    const parsedIds = new Set(parsedAssets.map(a => a.id));
    const assetsOnlyInProject = existingAssets.filter(a => !parsedIds.has(a.id));
    
    return [...merged, ...assetsOnlyInProject.map(a => ({
      ...a,
      linkedElements: [], // Will be recomputed
    }))];
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
      const { elements, connections, assets, stats, unconnectedDataflows } =
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

      console.debug("[saveDFD] Assets BEFORE merge", {
        parsedAssets: assets.map((a) => ({
          id: a.id,
          name: a.name,
          linkedElements: a.linkedElements,
        })),
        existingAssets: (project.dfd?.assets || []).map((a) => ({
          id: a.id,
          name: a.name,
          linkedElements: a.linkedElements,
        })),
      });

      const mergedAssets = this.mergeAssetProperties(
        assets,
        project.dfd?.assets || [],
      );

      console.debug("[saveDFD] Assets AFTER merge", {
        mergedAssets: mergedAssets.map((a) => ({
          id: a.id,
          name: a.name,
          linkedElements: a.linkedElements,
        })),
      });

      // Sync linkedElements from assetRelations (SINGLE SOURCE OF TRUTH)
      const syncedAssets = this.syncAssetLinkedElements(
        mergedElements,
        mergedConnections,
        mergedAssets,
      );

      console.debug("[saveDFD] Assets AFTER sync", {
        syncedAssets: syncedAssets.map((a) => ({
          id: a.id,
          name: a.name,
          linkedElements: a.linkedElements,
        })),
      });

      const graphBuilder = new DefaultDFDGraphBuilder();
      const dfdGraph = graphBuilder.build({
        elements: mergedElements,
        connections: mergedConnections,
        assets: syncedAssets,
      });

      console.debug("[saveDFD] DFDGraph ready", dfdGraph);
      const graphContext = new DFDGraphAnalysisContext(dfdGraph);

      const validation = this.validator.validate(
        mergedElements,
        mergedConnections,
        syncedAssets,
        stats,
        {
          unconnectedDataflows,
        },
        dfdGraph,
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

  // ==================== VALIDATION ====================

  /**
   * Validate current DFD state (without saving)
   */
  validateCurrentState(project: DFDProjectData): ValidationResult {
    const adapter = createDFDStorageAdapter(project.id);
    adapter.syncFromLegacy();

    const xml = adapter.getXml();
    const { elements, connections, assets, stats, unconnectedDataflows } =
      this.parser.parse(xml || "");

    const graphBuilder = new DefaultDFDGraphBuilder();
    const graph = graphBuilder.build({
      elements,
      connections,
      assets,
    });

    return this.validator.validate(
      elements,
      connections,
      assets,
      stats,
      {
        unconnectedDataflows,
      },
      graph,
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