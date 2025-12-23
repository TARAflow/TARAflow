// ==================== THREAT SERVICE ====================
// Single Responsibility: Business logic for Threat operations
// Supports BOTH per-element and per-interaction methods with separate storage

import type { PhaseStatus, PhaseStatusMap, StrideCategory } from "shared";
import {
  Threat,
  ThreatActorType,
  ThreatData,
  ThreatTable,
  ThreatConfiguration,
  ThreatProjectData,
  ThreatUpdateResult,
  ThreatValidation,
  ThreatTemplate,
  MitigationTemplate,
  VerificationTemplate,
  LinkedDFDElement,
  DataFlowReference,
  DFDElementReference,
  DFDConnectionReference,
  StrideMethod,
  STRIDE_PER_ELEMENT_TYPE,
  STRIDE_PER_INTERACTION,
  generateThreatIdPerElement,
  generateThreatIdPerInteraction,
  createDefaultThreatData,
  getActiveThreatTables,
} from "../models/threat-types";

// Import the catalog
import threatCatalogData from "./threat-catalog.json";

// ==================== CATALOG INTERFACE ====================

interface ThreatCatalog {
  version: string;
  lastUpdated: string;
  description: string;
  threatTemplates: ThreatTemplate[];
  mitigationTemplates: MitigationTemplate[];
  verificationTemplates: VerificationTemplate[];
}

// ==================== SERVICE RESULT TYPES ====================

export interface ThreatGenerationResult {
  success: boolean;
  perElementTables: ThreatTable[];
  perInteractionTables: ThreatTable[];
  error?: string;
}

export interface ThreatSaveResult {
  success: boolean;
  threats: ThreatData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
  validation: ThreatValidation;
  error?: string;
}

// ==================== THREAT SERVICE CLASS ====================

export class ThreatService {
  private catalog: ThreatCatalog;

  constructor() {
    this.catalog = threatCatalogData as ThreatCatalog;
  }

  // ==================== CATALOG ACCESS ====================

  getThreatTemplates(
    strideCategory?: StrideCategory,
    elementType?: string,
    customTemplates: ThreatTemplate[] = []
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
    customTemplates: MitigationTemplate[] = []
  ): MitigationTemplate[] {
    let templates = [...this.catalog.mitigationTemplates, ...customTemplates];

    if (strideCategory) {
      templates = templates.filter((t) => t.strideCategory === strideCategory);
    }

    return templates;
  }

  getVerificationTemplates(
    strideCategory?: StrideCategory,
    customTemplates: VerificationTemplate[] = []
  ): VerificationTemplate[] {
    let templates = [...this.catalog.verificationTemplates, ...customTemplates];

    if (strideCategory) {
      templates = templates.filter((t) => t.strideCategory === strideCategory);
    }

    return templates;
  }

  // ==================== THREAT GENERATION ====================

  /**
   * Generate threats for a SINGLE method (active method only)
   */
  generateThreatsForMethod(
    project: ThreatProjectData,
    configuration: ThreatConfiguration,
    method: StrideMethod
  ): { success: boolean; tables: ThreatTable[]; error?: string } {
    try {
      const elements = project.dfdElements || [];
      const connections = project.dfdConnections || [];

      if (elements.length === 0) {
        return {
          success: false,
          tables: [],
          error: "No DFD elements found. Please create a DFD first.",
        };
      }

      const result =
        method === "per-element"
          ? this.generateThreatsPerElement(elements, connections)
          : this.generateThreatsPerInteraction(elements, connections);

      return {
        success: true,
        tables: result.tables,
      };
    } catch (error) {
      return {
        success: false,
        tables: [],
        error:
          error instanceof Error ? error.message : "Failed to generate threats",
      };
    }
  }

  /**
   * Generate threats for BOTH methods at once
   */
  generateAllThreats(
    project: ThreatProjectData,
    configuration: ThreatConfiguration
  ): ThreatGenerationResult {
    try {
      const elements = project.dfdElements || [];
      const connections = project.dfdConnections || [];

      if (elements.length === 0) {
        return {
          success: false,
          perElementTables: [],
          perInteractionTables: [],
          error: "No DFD elements found. Please create a DFD first.",
        };
      }

      // Generate for per-element method
      const perElementResult = this.generateThreatsPerElement(
        elements,
        connections
      );

      // Generate for per-interaction method
      const perInteractionResult = this.generateThreatsPerInteraction(
        elements,
        connections
      );

      return {
        success: true,
        perElementTables: perElementResult.tables,
        perInteractionTables: perInteractionResult.tables,
      };
    } catch (error) {
      return {
        success: false,
        perElementTables: [],
        perInteractionTables: [],
        error:
          error instanceof Error ? error.message : "Failed to generate threats",
      };
    }
  }

  /**
   * Generate threats using STRIDE-per-element method
   */
  private generateThreatsPerElement(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[]
  ): { tables: ThreatTable[]; count: number } {
    const tables: ThreatTable[] = [];
    let totalCount = 0;

    // Get trust boundaries
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

    // Get external entities (handled separately)
    const externalEntities = elements.filter(
      (e) => e.type === "ExternalEntity"
    );

    // Get internal elements
    const internalElementTypes = [
      "Process",
      "Multiprocess",
      "DataStore",
      "PhysicalInterface",
      "Interface",
    ];
    const internalElements = elements.filter((e) =>
      internalElementTypes.includes(e.type)
    );

    // Create table for External Entities
    if (externalEntities.length > 0) {
      const externalTable = this.createThreatTableForElements(
        externalEntities,
        connections,
        null,
        "External Entities",
        "[EE]"
      );
      tables.push(externalTable);
      totalCount += externalTable.threats.length;
    }

    // Create table for each Trust Boundary
    for (const tb of trustBoundaries) {
      const elementsInTB = this.getElementsInsideTrustBoundary(
        tb,
        internalElements
      );
      const dataFlowsInTB = this.getDataFlowsForElements(
        elementsInTB,
        connections,
        elements
      );
      const allElementsForTB = [...elementsInTB, ...dataFlowsInTB];

      if (allElementsForTB.length > 0) {
        const tbTable = this.createThreatTableForElements(
          allElementsForTB,
          connections,
          tb.id,
          tb.name,
          `[${this.extractTBIdentifier(tb.name)}]`
        );
        tables.push(tbTable);
        totalCount += tbTable.threats.length;
      }
    }

    return { tables, count: totalCount };
  }

  /**
   * Generate threats using STRIDE-per-interaction method
   */
  private generateThreatsPerInteraction(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[]
  ): { tables: ThreatTable[]; count: number } {
    const tables: ThreatTable[] = [];
    let totalCount = 0;

    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

    if (trustBoundaries.length === 0) {
      // No trust boundaries - create single table for all data flows with TB0
      const allFlowsTable = this.createThreatTableForInteractions(
        connections,
        elements,
        null,
        "[TB-0] All Data Flows",
        "[TB0]",
        0
      );
      tables.push(allFlowsTable);
      totalCount += allFlowsTable.threats.length;
    } else {
      // Create table for each Trust Boundary with sequential TB numbers
      trustBoundaries.forEach((tb, index) => {
        const relevantFlows = this.getDataFlowsForTrustBoundary(
          tb,
          connections,
          elements
        );

        if (relevantFlows.length > 0) {
          // Extract TB identifier or assign based on index
          const tbId = this.extractTBIdentifier(tb.name, index);
          const displayName = tb.name.includes("[")
            ? tb.name
            : `[${tbId}] ${tb.name}`;

          const tbTable = this.createThreatTableForInteractions(
            relevantFlows,
            elements,
            tb.id,
            displayName,
            `[${tbId}]`,
            index
          );
          tables.push(tbTable);
          totalCount += tbTable.threats.length;
        }
      });
    }

    return { tables, count: totalCount };
  }

  /**
   * Create threat table for elements (per-element method)
   */
  private createThreatTableForElements(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[],
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    displayIdentifier: string
  ): ThreatTable {
    const threats: Threat[] = [];
    const sequenceCounters: Record<string, Record<StrideCategory, number>> = {};
    const typeCounters: Record<string, number> = {};

    // Build a map of raw element ID to formatted ID
    const elementIdMap: Record<string, string> = {};
    for (const element of elements) {
      const formattedId = this.extractFormattedElementId(element, typeCounters);
      elementIdMap[element.id] = formattedId;
    }

    for (const element of elements) {
      const applicableCategories = STRIDE_PER_ELEMENT_TYPE[element.type] || [];
      const formattedElementId = elementIdMap[element.id];

      for (const strideCategory of applicableCategories) {
        // Counter per formatted element ID per STRIDE category
        if (!sequenceCounters[formattedElementId]) {
          sequenceCounters[formattedElementId] = {
            S: 0,
            T: 0,
            R: 0,
            I: 0,
            D: 0,
            E: 0,
          };
        }
        sequenceCounters[formattedElementId][strideCategory]++;
        const seqNum = sequenceCounters[formattedElementId][strideCategory];

        // Generate T-ID: EE1-S-1 (no dash in element ID)
        const threatId = generateThreatIdPerElement(
          formattedElementId,
          strideCategory,
          seqNum
        );
        const template = this.findBestThreatTemplate(
          strideCategory,
          element.type
        );

        const threat: Threat = {
          id: threatId,
          trustBoundaryId,
          trustBoundaryName,
          strideCategory,
          sequenceNumber: seqNum,
          linkedElement: {
            elementId: formattedElementId, // Use formatted ID
            elementName: element.name,
            elementType: element.type,
          },
          dataFlow: null,
          threatDescription: template?.threat || "",
          attackDescription: template?.attack || "",
          threatActor: "external",
          mitigation: "",
          verification: "",
          linkedAssetIds: [],
          source: "auto",
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        };

        threats.push(threat);
      }
    }

    return {
      trustBoundaryId,
      trustBoundaryName,
      displayIdentifier,
      threats,
    };
  }

  /**
   * Create threat table for interactions (per-interaction method)
   * T-ID Format: {TB}{DF}-{STRIDE}-{Number}
   * Example: TB1-1-S-1 (TrustBoundary1, DataFlow1, Spoofing, Counter1)
   */
  private createThreatTableForInteractions(
    connections: DFDConnectionReference[],
    elements: DFDElementReference[],
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    displayIdentifier: string,
    tbIndex: number = 0
  ): ThreatTable {
    const threats: Threat[] = [];
    const sequenceCounters: Record<string, Record<StrideCategory, number>> = {};

    // Extract TB identifier without dashes: "[TB-1]" → "TB1"
    const tbId = this.extractTBIdentifier(trustBoundaryName, tbIndex);

    // Map connection IDs to sequential DF numbers
    // Also try to extract from label like "[DF-1]"
    const dataFlowIdMap: Record<string, string> = {};
    let dfCounter = 1;
    for (const conn of connections) {
      if (!dataFlowIdMap[conn.id]) {
        const extractedDfNum = this.extractFormattedDataFlowId(conn, dfCounter);
        dataFlowIdMap[conn.id] = extractedDfNum;
        dfCounter++;
      }
    }

    for (const connection of connections) {
      const sourceElement = elements.find((e) => e.id === connection.from);
      const targetElement = elements.find((e) => e.id === connection.to);

      if (!sourceElement || !targetElement) continue;

      const dfNum = dataFlowIdMap[connection.id];

      for (const strideCategory of STRIDE_PER_INTERACTION) {
        // Counter is per DataFlow per STRIDE category
        const counterKey = `${tbId}-${dfNum}`;
        if (!sequenceCounters[counterKey]) {
          sequenceCounters[counterKey] = { S: 0, T: 0, R: 0, I: 0, D: 0, E: 0 };
        }
        sequenceCounters[counterKey][strideCategory]++;
        const seqNum = sequenceCounters[counterKey][strideCategory];

        // Generate T-ID: TB1-1-S-1 (TB1, DF1, Spoofing, Counter1)
        const threatId = `${tbId}-${dfNum}-${strideCategory}-${seqNum}`;
        const template = this.findBestThreatTemplate(
          strideCategory,
          "DataFlow"
        );

        const dataFlowRef: DataFlowReference = {
          dataFlowId: `DF-${dfNum}`, // Display as DF-1 in UI
          dataFlowName:
            connection.label || `${sourceElement.name} → ${targetElement.name}`,
          sourceId: connection.from,
          sourceName: sourceElement.name,
          sourceType: sourceElement.type,
          targetId: connection.to,
          targetName: targetElement.name,
          targetType: targetElement.type,
        };

        const threat: Threat = {
          id: threatId,
          trustBoundaryId,
          trustBoundaryName,
          strideCategory,
          sequenceNumber: seqNum,
          linkedElement: null,
          dataFlow: dataFlowRef,
          threatDescription: template?.threat || "",
          attackDescription: template?.attack || "",
          threatActor: "external",
          mitigation: "",
          verification: "",
          linkedAssetIds: [],
          source: "auto",
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        };

        threats.push(threat);
      }
    }

    return {
      trustBoundaryId,
      trustBoundaryName,
      displayIdentifier,
      threats,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Extract formatted element ID from name or generate one
   * Examples:
   *   "[EE-1] User" → "EE1"
   *   "[P-1] Process" → "P1"
   *   "[TB-1] Boundary" → "TB1"
   *   "[DF-1] Flow" → "DF1"
   *   "User" (with type ExternalEntity, index 0) → "EE1"
   */
  private extractFormattedElementId(
    element: DFDElementReference,
    typeCounters: Record<string, number>
  ): string {
    // Try to extract ID from name pattern [XX-N] or [XXN]
    const bracketMatch = element.name.match(/\[([A-Z]+)-?(\d+)\]/i);
    if (bracketMatch) {
      const prefix = bracketMatch[1].toUpperCase();
      const number = bracketMatch[2];
      return `${prefix}${number}`; // Remove dash: "EE-1" → "EE1"
    }

    // Generate ID based on element type
    const typePrefix = this.getTypePrefixForElement(element.type);
    if (!typeCounters[element.type]) {
      typeCounters[element.type] = 0;
    }
    typeCounters[element.type]++;
    return `${typePrefix}${typeCounters[element.type]}`;
  }

  /**
   * Extract formatted DataFlow ID from connection
   * Examples:
   *   label "[DF-1] Request" → "1"
   *   label "Request" (index 0) → "1"
   */
  private extractFormattedDataFlowId(
    connection: DFDConnectionReference,
    dfCounter: number
  ): string {
    // Try to extract ID from label pattern [DF-N]
    const label = connection.label || "";
    const bracketMatch = label.match(/\[DF-?(\d+)\]/i);
    if (bracketMatch) {
      return bracketMatch[1]; // Just the number
    }
    // Use counter
    return String(dfCounter);
  }

  /**
   * Get type prefix for element type
   */
  private getTypePrefixForElement(elementType: string): string {
    const prefixMap: Record<string, string> = {
      ExternalEntity: "EE",
      Process: "P",
      Multiprocess: "MP",
      DataStore: "DS",
      TrustBoundary: "TB",
      PhysicalInterface: "PI",
      Interface: "IF",
      DataFlow: "DF",
    };
    return prefixMap[elementType] || "E";
  }

  /**
   * Extract Trust Boundary identifier
   * Examples:
   *   "[TB-1] Server Zone" → "TB1"
   *   "Server Zone" (with index) → "TB1"
   */
  private extractTBIdentifier(name: string, tbIndex?: number): string {
    // Try to extract [TB-X] pattern
    const tbMatch = name.match(/\[TB-?(\d+)\]/i);
    if (tbMatch) return `TB${tbMatch[1]}`;

    // Try any [XXX] bracket pattern
    const bracketMatch = name.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      // Remove dashes and return
      return bracketMatch[1].replace(/-/g, "");
    }

    // Use provided index
    if (tbIndex !== undefined) {
      return `TB${tbIndex + 1}`;
    }

    // Fallback: abbreviate name
    return name
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 8)
      .toUpperCase();
  }

  private findBestThreatTemplate(
    strideCategory: StrideCategory,
    elementType: string
  ): ThreatTemplate | null {
    const templates = this.getThreatTemplates(strideCategory, elementType);
    return templates.length > 0 ? templates[0] : null;
  }

  private isElementInsideTrustBoundary(
    element: DFDElementReference,
    trustBoundary: DFDElementReference
  ): boolean {
    const tbLeft = trustBoundary.position.x;
    const tbRight = trustBoundary.position.x + trustBoundary.size.width;
    const tbTop = trustBoundary.position.y;
    const tbBottom = trustBoundary.position.y + trustBoundary.size.height;

    const elemCenterX = element.position.x + element.size.width / 2;
    const elemCenterY = element.position.y + element.size.height / 2;

    return (
      elemCenterX >= tbLeft &&
      elemCenterX <= tbRight &&
      elemCenterY >= tbTop &&
      elemCenterY <= tbBottom
    );
  }

  private getElementsInsideTrustBoundary(
    trustBoundary: DFDElementReference,
    elements: DFDElementReference[]
  ): DFDElementReference[] {
    return elements.filter((e) =>
      this.isElementInsideTrustBoundary(e, trustBoundary)
    );
  }

  private getDataFlowsForElements(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[],
    allElements: DFDElementReference[]
  ): DFDElementReference[] {
    const elementIds = new Set(elements.map((e) => e.id));
    const relevantFlows: DFDElementReference[] = [];

    for (const conn of connections) {
      if (elementIds.has(conn.from) || elementIds.has(conn.to)) {
        relevantFlows.push({
          id: conn.id,
          type: "DataFlow",
          name: conn.label || conn.id,
          position: { x: 0, y: 0 },
          size: { width: 0, height: 0 },
        });
      }
    }

    return relevantFlows;
  }

  private getDataFlowsForTrustBoundary(
    trustBoundary: DFDElementReference,
    connections: DFDConnectionReference[],
    elements: DFDElementReference[]
  ): DFDConnectionReference[] {
    const elementsInTB = elements.filter(
      (e) =>
        e.type !== "TrustBoundary" &&
        this.isElementInsideTrustBoundary(e, trustBoundary)
    );
    const elementIds = new Set(elementsInTB.map((e) => e.id));

    return connections.filter(
      (conn) => elementIds.has(conn.from) || elementIds.has(conn.to)
    );
  }

  // ==================== SAVE & VALIDATION ====================

  saveThreatData(
    project: ThreatProjectData,
    threatData: ThreatData
  ): ThreatSaveResult {
    const emptyResult: ThreatSaveResult = {
      success: false,
      threats: createDefaultThreatData(),
      phaseStatus: { ...project.phaseStatus },
      lastModified: new Date().toISOString(),
      validation: {
        isComplete: false,
        errors: [],
        warnings: [],
        lastValidated: new Date().toISOString(),
      },
    };

    try {
      const activeMethod =
        threatData.configuration?.activeMethod ?? "per-element";
      const validation = this.validateThreatData(threatData, activeMethod);
      const phaseStatus = this.determinePhaseStatus(validation);
      const lastModified = new Date().toISOString();

      const updatedThreats: ThreatData = {
        ...threatData,
        validation,
        lastModified,
      };

      const updatedPhaseStatus: PhaseStatusMap = {
        ...project.phaseStatus,
        3: phaseStatus,
      };

      return {
        success: true,
        threats: updatedThreats,
        phaseStatus: updatedPhaseStatus,
        lastModified,
        validation,
      };
    } catch (error) {
      return {
        ...emptyResult,
        error:
          error instanceof Error ? error.message : "Failed to save threats",
      };
    }
  }

  validateThreatData(
    threatData: ThreatData | null | undefined,
    activeMethod: StrideMethod
  ): ThreatValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tables =
      activeMethod === "per-element"
        ? threatData?.perElementTables ?? []
        : threatData?.perInteractionTables ?? [];

    const allThreats = tables.flatMap((t) => t.threats);

    if (allThreats.length === 0) {
      errors.push("No threats defined");
      return {
        isComplete: false,
        errors,
        warnings,
        lastValidated: new Date().toISOString(),
      };
    }

    const threatsWithoutDescription = allThreats.filter(
      (t) => !t.threatDescription.trim()
    );
    if (threatsWithoutDescription.length > 0) {
      warnings.push(
        `${threatsWithoutDescription.length} threat(s) have no description`
      );
    }

    const threatsWithoutMitigation = allThreats.filter(
      (t) => !t.mitigation.trim()
    );
    if (threatsWithoutMitigation.length > 0) {
      warnings.push(
        `${threatsWithoutMitigation.length} threat(s) have no mitigation defined`
      );
    }

    const threatsWithoutVerification = allThreats.filter(
      (t) => !t.verification.trim()
    );
    if (threatsWithoutVerification.length > 0) {
      warnings.push(
        `${threatsWithoutVerification.length} threat(s) have no verification method`
      );
    }

    return {
      isComplete: errors.length === 0 && warnings.length === 0,
      errors,
      warnings,
      lastValidated: new Date().toISOString(),
    };
  }

  private determinePhaseStatus(validation: ThreatValidation): PhaseStatus {
    if (validation.isComplete) return "complete";
    if (validation.errors.length > 0) return "incomplete";
    if (validation.warnings.length > 0) return "in-progress";
    return "in-progress";
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Create a new threat with generated ID
   */
  createNewThreat(
    threatData: ThreatData,
    activeMethod: StrideMethod,
    tableIndex: number,
    linkedElement?: LinkedDFDElement,
    dataFlow?: DataFlowReference
  ): Threat {
    const tables =
      activeMethod === "per-element"
        ? threatData.perElementTables ?? []
        : threatData.perInteractionTables ?? [];

    const table = tables[tableIndex];
    if (!table) {
      throw new Error(`Table at index ${tableIndex} not found`);
    }

    // Default to Spoofing for new threats
    const strideCategory: StrideCategory = "S";

    // Calculate next sequence number for this element/dataflow and STRIDE category
    const existingThreats = table.threats.filter((t) => {
      if (activeMethod === "per-element" && linkedElement) {
        return (
          t.linkedElement?.elementId === linkedElement.elementId &&
          t.strideCategory === strideCategory
        );
      }
      if (activeMethod === "per-interaction" && dataFlow) {
        return (
          t.dataFlow?.dataFlowId === dataFlow.dataFlowId &&
          t.strideCategory === strideCategory
        );
      }
      return false;
    });

    const sequenceNumber = existingThreats.length + 1;

    // Generate threat ID
    let threatId: string;
    if (activeMethod === "per-element" && linkedElement) {
      threatId = `${linkedElement.elementId}-${strideCategory}-${sequenceNumber}`;
    } else if (activeMethod === "per-interaction" && dataFlow) {
      // Extract TB number from table
      const tbId = this.extractTBIdentifier(table.trustBoundaryName);
      // Extract DF number
      const dfMatch = dataFlow.dataFlowId.match(/DF-(\d+)/);
      const dfNum = dfMatch ? dfMatch[1] : "1";
      threatId = `${tbId}-${dfNum}-${strideCategory}-${sequenceNumber}`;
    } else {
      threatId = `THREAT-${Date.now()}`;
    }

    const now = new Date().toISOString();

    return {
      id: threatId,
      trustBoundaryId: table.trustBoundaryId,
      trustBoundaryName: table.trustBoundaryName,
      strideCategory,
      sequenceNumber,
      linkedElement: linkedElement ?? null,
      dataFlow: dataFlow ?? null,
      threatDescription: "",
      attackDescription: "",
      threatActor: "external",
      mitigation: "",
      verification: "",
      linkedAssetIds: [],
      source: "manual",
      created: now,
      lastModified: now,
    };
  }

  /**
   * Add a new threat to a table
   */
  addThreat(
    threatData: ThreatData,
    activeMethod: StrideMethod,
    tableIndex: number,
    newThreat: Threat
  ): ThreatData {
    const tables =
      activeMethod === "per-element"
        ? [...(threatData.perElementTables ?? [])]
        : [...(threatData.perInteractionTables ?? [])];

    const table = tables[tableIndex];
    if (!table) return threatData;

    // Add the new threat
    const updatedThreats = [...table.threats, newThreat];
    tables[tableIndex] = { ...table, threats: updatedThreats };

    return {
      ...threatData,
      ...(activeMethod === "per-element"
        ? { perElementTables: tables }
        : { perInteractionTables: tables }),
      lastModified: new Date().toISOString(),
    };
  }

  updateThreat(
    threatData: ThreatData,
    activeMethod: StrideMethod,
    tableIndex: number,
    threatId: string,
    updates: Partial<Threat>
  ): ThreatData {
    const tables =
      activeMethod === "per-element"
        ? [...(threatData.perElementTables ?? [])]
        : [...(threatData.perInteractionTables ?? [])];

    const table = tables[tableIndex];
    if (!table) return threatData;

    const threatIndex = table.threats.findIndex((t) => t.id === threatId);
    if (threatIndex === -1) return threatData;

    const updatedThreat: Threat = {
      ...table.threats[threatIndex],
      ...updates,
      lastModified: new Date().toISOString(),
    };

    const updatedThreats = [...table.threats];
    updatedThreats[threatIndex] = updatedThreat;

    tables[tableIndex] = { ...table, threats: updatedThreats };

    return {
      ...threatData,
      ...(activeMethod === "per-element"
        ? { perElementTables: tables }
        : { perInteractionTables: tables }),
      lastModified: new Date().toISOString(),
    };
  }

  deleteThreat(
    threatData: ThreatData,
    activeMethod: StrideMethod,
    tableIndex: number,
    threatId: string
  ): ThreatData {
    const tables =
      activeMethod === "per-element"
        ? [...(threatData.perElementTables ?? [])]
        : [...(threatData.perInteractionTables ?? [])];

    const table = tables[tableIndex];
    if (!table) return threatData;

    const updatedThreats = table.threats.filter((t) => t.id !== threatId);
    tables[tableIndex] = { ...table, threats: updatedThreats };

    return {
      ...threatData,
      ...(activeMethod === "per-element"
        ? { perElementTables: tables }
        : { perInteractionTables: tables }),
      lastModified: new Date().toISOString(),
    };
  }

  // ==================== STATISTICS ====================

  getStatistics(
    threatData: ThreatData | null | undefined,
    activeMethod: StrideMethod
  ): {
    totalThreats: number;
    byStrideCategory: Record<StrideCategory, number>;
    byTrustBoundary: Record<string, number>;
    withMitigation: number;
    withVerification: number;
  } {
    const tables =
      activeMethod === "per-element"
        ? threatData?.perElementTables ?? []
        : threatData?.perInteractionTables ?? [];

    const allThreats = tables.flatMap((t) => t.threats);

    const byStrideCategory: Record<StrideCategory, number> = {
      S: 0,
      T: 0,
      R: 0,
      I: 0,
      D: 0,
      E: 0,
    };

    const byTrustBoundary: Record<string, number> = {};

    let withMitigation = 0;
    let withVerification = 0;

    for (const threat of allThreats) {
      byStrideCategory[threat.strideCategory]++;

      const tbKey = threat.trustBoundaryName || "External";
      byTrustBoundary[tbKey] = (byTrustBoundary[tbKey] || 0) + 1;

      if (threat.mitigation.trim()) withMitigation++;
      if (threat.verification.trim()) withVerification++;
    }

    return {
      totalThreats: allThreats.length,
      byStrideCategory,
      byTrustBoundary,
      withMitigation,
      withVerification,
    };
  }

  // ==================== IMPORT / EXPORT ====================

  /**
   * Result of import validation
   */
  validateImportData(jsonString: string): ImportValidationResult {
    try {
      const data = JSON.parse(jsonString);
      return this.validateImportObject(data);
    } catch (error) {
      return {
        success: false,
        error: "parse_error",
        message:
          "Failed to parse JSON. Please ensure the file contains valid JSON.",
      };
    }
  }

  /**
   * Validate imported data object structure
   */
  private validateImportObject(data: unknown): ImportValidationResult {
    if (!data || typeof data !== "object") {
      return {
        success: false,
        error: "invalid_format",
        message: "Invalid file format. Expected a JSON object.",
      };
    }

    const obj = data as Record<string, unknown>;

    // Check for required arrays
    const hasPerElement = Array.isArray(obj.perElementTables);
    const hasPerInteraction = Array.isArray(obj.perInteractionTables);

    if (!hasPerElement && !hasPerInteraction) {
      return {
        success: false,
        error: "missing_tables",
        message:
          "Invalid file format. File must contain perElementTables or perInteractionTables.",
      };
    }

    // Validate table structures
    const perElementTables = hasPerElement
      ? this.validateThreatTables(obj.perElementTables as unknown[])
      : [];
    const perInteractionTables = hasPerInteraction
      ? this.validateThreatTables(obj.perInteractionTables as unknown[])
      : [];

    // Check if at least one table has valid threats
    const totalThreats =
      perElementTables.reduce((sum, t) => sum + t.threats.length, 0) +
      perInteractionTables.reduce((sum, t) => sum + t.threats.length, 0);

    return {
      success: true,
      data: {
        perElementTables,
        perInteractionTables,
      },
      stats: {
        perElementTables: perElementTables.length,
        perInteractionTables: perInteractionTables.length,
        totalThreats,
      },
    };
  }

  /**
   * Validate and sanitize threat tables array
   */
  private validateThreatTables(tables: unknown[]): ThreatTable[] {
    const validTables: ThreatTable[] = [];

    for (const table of tables) {
      if (!table || typeof table !== "object") continue;

      const t = table as Record<string, unknown>;

      // Validate required fields
      if (typeof t.trustBoundaryName !== "string") continue;
      if (!Array.isArray(t.threats)) continue;

      const validThreats = this.validateThreats(t.threats);

      validTables.push({
        trustBoundaryId:
          typeof t.trustBoundaryId === "string" ? t.trustBoundaryId : null,
        trustBoundaryName: t.trustBoundaryName,
        displayIdentifier:
          typeof t.displayIdentifier === "string" ? t.displayIdentifier : "[?]",
        threats: validThreats,
      });
    }

    return validTables;
  }

  /**
   * Validate and sanitize threats array
   */
  private validateThreats(threats: unknown[]): Threat[] {
    const validThreats: Threat[] = [];
    const validStrideCategories = ["S", "T", "R", "I", "D", "E"];

    for (const threat of threats) {
      if (!threat || typeof threat !== "object") continue;

      const t = threat as Record<string, unknown>;

      // Validate required fields
      if (typeof t.id !== "string" || !t.id) continue;
      if (
        typeof t.strideCategory !== "string" ||
        !validStrideCategories.includes(t.strideCategory)
      )
        continue;

      validThreats.push({
        id: t.id,
        trustBoundaryId:
          typeof t.trustBoundaryId === "string" ? t.trustBoundaryId : null,
        trustBoundaryName:
          typeof t.trustBoundaryName === "string" ? t.trustBoundaryName : null,
        strideCategory: t.strideCategory as StrideCategory,
        sequenceNumber:
          typeof t.sequenceNumber === "number" ? t.sequenceNumber : 1,
        linkedElement: this.validateLinkedElement(t.linkedElement),
        dataFlow: this.validateDataFlow(t.dataFlow),
        threatDescription:
          typeof t.threatDescription === "string" ? t.threatDescription : "",
        attackDescription:
          typeof t.attackDescription === "string" ? t.attackDescription : "",
        threatActor: this.validateThreatActor(t.threatActor),
        mitigation: typeof t.mitigation === "string" ? t.mitigation : "",
        verification: typeof t.verification === "string" ? t.verification : "",
        linkedAssetIds: Array.isArray(t.linkedAssetIds)
          ? t.linkedAssetIds.filter(
              (id): id is string => typeof id === "string"
            )
          : [],
        source:
          t.source === "auto" || t.source === "manual" ? t.source : "manual",
        created:
          typeof t.created === "string" ? t.created : new Date().toISOString(),
        lastModified:
          typeof t.lastModified === "string"
            ? t.lastModified
            : new Date().toISOString(),
      });
    }

    return validThreats;
  }

  private validateLinkedElement(elem: unknown): LinkedDFDElement | null {
    if (!elem || typeof elem !== "object") return null;
    const e = elem as Record<string, unknown>;

    if (typeof e.elementId !== "string") return null;
    if (typeof e.elementName !== "string") return null;
    if (typeof e.elementType !== "string") return null;

    return {
      elementId: e.elementId,
      elementName: e.elementName,
      elementType: e.elementType,
    };
  }

  private validateDataFlow(flow: unknown): DataFlowReference | null {
    if (!flow || typeof flow !== "object") return null;
    const f = flow as Record<string, unknown>;

    if (typeof f.dataFlowId !== "string") return null;

    return {
      dataFlowId: f.dataFlowId,
      dataFlowName:
        typeof f.dataFlowName === "string" ? f.dataFlowName : f.dataFlowId,
      sourceId: typeof f.sourceId === "string" ? f.sourceId : "",
      sourceName: typeof f.sourceName === "string" ? f.sourceName : "",
      sourceType: typeof f.sourceType === "string" ? f.sourceType : "",
      targetId: typeof f.targetId === "string" ? f.targetId : "",
      targetName: typeof f.targetName === "string" ? f.targetName : "",
      targetType: typeof f.targetType === "string" ? f.targetType : "",
    };
  }

  private validateThreatActor(actor: unknown): ThreatActorType {
    const validActors: ThreatActorType[] = [
      "external",
      "internal",
      "nation-state",
      "script-kiddie",
      "competitor",
      "other",
    ];
    if (
      typeof actor === "string" &&
      validActors.includes(actor as ThreatActorType)
    ) {
      return actor as ThreatActorType;
    }
    return "external";
  }
}

// ==================== IMPORT RESULT TYPES ====================

export interface ImportValidationResult {
  success: boolean;
  error?: "parse_error" | "invalid_format" | "missing_tables";
  message?: string;
  data?: {
    perElementTables: ThreatTable[];
    perInteractionTables: ThreatTable[];
  };
  stats?: {
    perElementTables: number;
    perInteractionTables: number;
    totalThreats: number;
  };
}

// Export singleton instance
export const threatService = new ThreatService();
export default threatService;