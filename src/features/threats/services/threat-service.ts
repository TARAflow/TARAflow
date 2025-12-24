// ==================== THREAT SERVICE ====================
// Single Responsibility: Business logic for Threat operations
// Supports BOTH per-element and per-interaction methods with separate storage
// 
// STRIDE-per-Interaction Enhancement:
// - Generates TWO threats per STRIDE category per data flow:
//   1. Incoming (IN): Attacker spoofs sender to deceive receiver
//   2. Outgoing (OUT): Attacker spoofs receiver to intercept from sender
// - Uses template-based generation with placeholders
// - Captures directional context in InteractionContext

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
  InteractionDirection,
  InteractionContext,
  STRIDE_PER_ELEMENT_TYPE,
  STRIDE_PER_INTERACTION,
  generateThreatIdPerElement,
  generateThreatIdPerInteraction,
  createDefaultThreatData,
} from "../models/threat-types";

// No interaction-templates import needed - service is language-neutral
// UI handles localization via interaction-templates.ts

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

      const perElementResult = this.generateThreatsPerElement(elements, connections);
      const perInteractionResult = this.generateThreatsPerInteraction(elements, connections);

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
        error: error instanceof Error ? error.message : "Failed to generate threats",
      };
    }
  }

  // ==================== PER-ELEMENT GENERATION ====================

  private generateThreatsPerElement(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[]
  ): { tables: ThreatTable[]; count: number } {
    const tables: ThreatTable[] = [];
    let totalCount = 0;

    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const externalEntities = elements.filter((e) => e.type === "ExternalEntity");
    const internalElementTypes = ["Process", "Multiprocess", "DataStore", "PhysicalInterface", "Interface"];
    const internalElements = elements.filter((e) => internalElementTypes.includes(e.type));

    // External Entities table
    if (externalEntities.length > 0) {
      const externalTable = this.createThreatTableForElements(
        externalEntities, connections, null, "External Entities", "[EE]"
      );
      tables.push(externalTable);
      totalCount += externalTable.threats.length;
    }

    // Trust Boundary tables
    for (const tb of trustBoundaries) {
      const elementsInTB = this.getElementsInsideTrustBoundary(tb, internalElements);
      const dataFlowsInTB = this.getDataFlowsForElements(elementsInTB, connections, elements);
      const allElementsForTB = [...elementsInTB, ...dataFlowsInTB];

      if (allElementsForTB.length > 0) {
        const tbTable = this.createThreatTableForElements(
          allElementsForTB, connections, tb.id, tb.name, `[${this.extractTBIdentifier(tb.name)}]`
        );
        tables.push(tbTable);
        totalCount += tbTable.threats.length;
      }
    }

    return { tables, count: totalCount };
  }

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

    const elementIdMap: Record<string, string> = {};
    for (const element of elements) {
      const formattedId = this.extractFormattedElementId(element, typeCounters);
      elementIdMap[element.id] = formattedId;
    }

    for (const element of elements) {
      const applicableCategories = STRIDE_PER_ELEMENT_TYPE[element.type] || [];
      const formattedElementId = elementIdMap[element.id];

      for (const strideCategory of applicableCategories) {
        if (!sequenceCounters[formattedElementId]) {
          sequenceCounters[formattedElementId] = { S: 0, T: 0, R: 0, I: 0, D: 0, E: 0 };
        }
        sequenceCounters[formattedElementId][strideCategory]++;
        const seqNum = sequenceCounters[formattedElementId][strideCategory];

        const threatId = generateThreatIdPerElement(formattedElementId, strideCategory, seqNum);
        const template = this.findBestThreatTemplate(strideCategory, element.type);

        threats.push({
          id: threatId,
          trustBoundaryId,
          trustBoundaryName,
          strideCategory,
          sequenceNumber: seqNum,
          linkedElement: {
            elementId: formattedElementId,
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
        });
      }
    }

    return { trustBoundaryId, trustBoundaryName, displayIdentifier, threats };
  }

  // ==================== PER-INTERACTION GENERATION (ENHANCED) ====================

  /**
   * Generate threats using STRIDE-per-interaction method
   * 
   * ENHANCED: Generates TWO threats per STRIDE category per data flow:
   * 1. Incoming (IN): Attack targets the receiver by spoofing sender
   * 2. Outgoing (OUT): Attack targets the sender by spoofing receiver
   */
  private generateThreatsPerInteraction(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[]
  ): { tables: ThreatTable[]; count: number } {
    const tables: ThreatTable[] = [];
    let totalCount = 0;

    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

    if (trustBoundaries.length === 0) {
      const allFlowsTable = this.createThreatTableForInteractions(
        connections, elements, null, "[TB-0] All Data Flows", "[TB0]", 0
      );
      tables.push(allFlowsTable);
      totalCount += allFlowsTable.threats.length;
    } else {
      trustBoundaries.forEach((tb, index) => {
        const relevantFlows = this.getDataFlowsForTrustBoundary(tb, connections, elements);

        if (relevantFlows.length > 0) {
          const tbId = this.extractTBIdentifier(tb.name, index);
          const displayName = tb.name.includes("[") ? tb.name : `[${tbId}] ${tb.name}`;

          const tbTable = this.createThreatTableForInteractions(
            relevantFlows, elements, tb.id, displayName, `[${tbId}]`, index
          );
          tables.push(tbTable);
          totalCount += tbTable.threats.length;
        }
      });
    }

    return { tables, count: totalCount };
  }

  /**
   * Create threat table for interactions with DIRECTIONAL threats
   * 
   * For each data flow (A → B) and each STRIDE category, generates:
   * 1. INCOMING: Attacker attacks from A's direction toward B (B is victim)
   * 2. OUTGOING: Attacker attacks from B's direction toward A (A is victim)
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
    const sequenceCounters: Record<string, number> = {};

    const tbId = this.extractTBIdentifier(trustBoundaryName, tbIndex);

    // Map connection IDs to DF numbers
    const dataFlowIdMap: Record<string, string> = {};
    let dfCounter = 1;
    for (const conn of connections) {
      if (!dataFlowIdMap[conn.id]) {
        dataFlowIdMap[conn.id] = this.extractFormattedDataFlowId(conn, dfCounter);
        dfCounter++;
      }
    }

    const trustBoundary = elements.find(e => e.id === trustBoundaryId);

    for (const connection of connections) {
      const sourceElement = elements.find((e) => e.id === connection.from);
      const targetElement = elements.find((e) => e.id === connection.to);

      if (!sourceElement || !targetElement) continue;

      const dfNum = dataFlowIdMap[connection.id];

      // Determine if flow crosses trust boundary
      const crossesTrustBoundary = trustBoundary
        ? this.doesDataFlowCrossTrustBoundary(
            sourceElement,
            targetElement,
            trustBoundary
          )
        : false;

      // Generate BOTH directions for each STRIDE category
      for (const strideCategory of STRIDE_PER_INTERACTION) {
        const directions: InteractionDirection[] = ["incoming", "outgoing"];

        for (const direction of directions) {
          const counterKey = `${tbId}-${dfNum}-${strideCategory}-${direction}`;
          sequenceCounters[counterKey] =
            (sequenceCounters[counterKey] || 0) + 1;
          const seqNum = sequenceCounters[counterKey];

          const threatId = generateThreatIdPerInteraction(
            tbId,
            dfNum,
            strideCategory,
            direction,
            seqNum
          );

          const interactionContext: InteractionContext = {
            direction,
            attackedRole: direction === "incoming" ? "source" : "target",
            victimRole: direction === "incoming" ? "target" : "source",
            crossesTrustBoundary,
          };

          const dataFlowRef: DataFlowReference = {
            dataFlowId: `DF-${dfNum}`,
            dataFlowName:
              connection.label ||
              `${sourceElement.name} → ${targetElement.name}`,
            sourceId: connection.from,
            sourceName: sourceElement.name,
            sourceType: sourceElement.type,
            targetId: connection.to,
            targetName: targetElement.name,
            targetType: targetElement.type,
          };

          // Store empty descriptions - UI will localize via interaction-templates
          threats.push({
            id: threatId,
            trustBoundaryId,
            trustBoundaryName,
            strideCategory,
            sequenceNumber: seqNum,
            linkedElement: null,
            dataFlow: dataFlowRef,
            interactionContext,
            threatDescription: "", // Empty - localized in UI
            attackDescription: "", // Empty - localized in UI
            threatActor: "external",
            mitigation: "", // Empty - user fills or selects from suggestions
            verification: "",
            linkedAssetIds: [],
            source: "auto",
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          });
        }
      }
    }

    return { trustBoundaryId, trustBoundaryName, displayIdentifier, threats };
  }

  private getFallbackThreatDescription(strideCategory: StrideCategory, direction: InteractionDirection): string {
    const dirLabel = direction === "incoming" ? "Incoming" : "Outgoing";
    const strideNames: Record<StrideCategory, string> = {
      S: "Spoofing", T: "Tampering", R: "Repudiation",
      I: "Information Disclosure", D: "Denial of Service", E: "Elevation of Privilege",
    };
    return `${dirLabel} ${strideNames[strideCategory]} threat on data flow`;
  }

  private doesDataFlowCrossTrustBoundary(
    source: DFDElementReference,
    target: DFDElementReference,
    trustBoundary: DFDElementReference
  ): boolean {
    const sourceInside = this.isElementInsideTrustBoundary(source, trustBoundary);
    const targetInside = this.isElementInsideTrustBoundary(target, trustBoundary);
    return sourceInside !== targetInside;
  }

  // ==================== HELPER METHODS ====================

  private extractFormattedElementId(element: DFDElementReference, typeCounters: Record<string, number>): string {
    const bracketMatch = element.name.match(/\[([A-Z]+)-?(\d+)\]/i);
    if (bracketMatch) {
      return `${bracketMatch[1].toUpperCase()}${bracketMatch[2]}`;
    }

    const typePrefix = this.getTypePrefixForElement(element.type);
    if (!typeCounters[element.type]) typeCounters[element.type] = 0;
    typeCounters[element.type]++;
    return `${typePrefix}${typeCounters[element.type]}`;
  }

  private extractFormattedDataFlowId(connection: DFDConnectionReference, dfCounter: number): string {
    const label = connection.label || "";
    const bracketMatch = label.match(/\[DF-?(\d+)\]/i);
    return bracketMatch ? bracketMatch[1] : String(dfCounter);
  }

  private getTypePrefixForElement(elementType: string): string {
    const prefixMap: Record<string, string> = {
      ExternalEntity: "EE", Process: "P", Multiprocess: "MP",
      DataStore: "DS", TrustBoundary: "TB", PhysicalInterface: "PI",
      Interface: "IF", DataFlow: "DF",
    };
    return prefixMap[elementType] || "E";
  }

  private extractTBIdentifier(name: string, tbIndex?: number): string {
    const tbMatch = name.match(/\[TB-?(\d+)\]/i);
    if (tbMatch) return `TB${tbMatch[1]}`;

    const bracketMatch = name.match(/\[([^\]]+)\]/);
    if (bracketMatch) return bracketMatch[1].replace(/-/g, "");

    if (tbIndex !== undefined) return `TB${tbIndex + 1}`;

    return name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8).toUpperCase();
  }

  private findBestThreatTemplate(strideCategory: StrideCategory, elementType: string): ThreatTemplate | null {
    const templates = this.getThreatTemplates(strideCategory, elementType);
    return templates.length > 0 ? templates[0] : null;
  }

  private isElementInsideTrustBoundary(element: DFDElementReference, trustBoundary: DFDElementReference): boolean {
    const tbLeft = trustBoundary.position.x;
    const tbRight = trustBoundary.position.x + trustBoundary.size.width;
    const tbTop = trustBoundary.position.y;
    const tbBottom = trustBoundary.position.y + trustBoundary.size.height;

    const elemCenterX = element.position.x + element.size.width / 2;
    const elemCenterY = element.position.y + element.size.height / 2;

    return elemCenterX >= tbLeft && elemCenterX <= tbRight && elemCenterY >= tbTop && elemCenterY <= tbBottom;
  }

  private getElementsInsideTrustBoundary(trustBoundary: DFDElementReference, elements: DFDElementReference[]): DFDElementReference[] {
    return elements.filter((e) => this.isElementInsideTrustBoundary(e, trustBoundary));
  }

  private getDataFlowsForElements(elements: DFDElementReference[], connections: DFDConnectionReference[], allElements: DFDElementReference[]): DFDElementReference[] {
    const elementIds = new Set(elements.map((e) => e.id));
    return connections
      .filter(conn => elementIds.has(conn.from) || elementIds.has(conn.to))
      .map(conn => ({
        id: conn.id,
        type: "DataFlow",
        name: conn.label || conn.id,
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
      }));
  }

  private getDataFlowsForTrustBoundary(trustBoundary: DFDElementReference, connections: DFDConnectionReference[], elements: DFDElementReference[]): DFDConnectionReference[] {
    const elementsInTB = elements.filter(e => e.type !== "TrustBoundary" && this.isElementInsideTrustBoundary(e, trustBoundary));
    const elementIds = new Set(elementsInTB.map((e) => e.id));
    return connections.filter(conn => elementIds.has(conn.from) || elementIds.has(conn.to));
  }

  // ==================== SAVE & VALIDATION ====================

  saveThreatData(project: ThreatProjectData, threatData: ThreatData): ThreatSaveResult {
    const emptyResult: ThreatSaveResult = {
      success: false,
      threats: createDefaultThreatData(),
      phaseStatus: { ...project.phaseStatus },
      lastModified: new Date().toISOString(),
      validation: { isComplete: false, errors: [], warnings: [], lastValidated: new Date().toISOString() },
    };

    try {
      const activeMethod = threatData.configuration?.activeMethod ?? "per-element";
      const validation = this.validateThreatData(threatData, activeMethod);
      const phaseStatus = this.determinePhaseStatus(validation);
      const lastModified = new Date().toISOString();

      return {
        success: true,
        threats: { ...threatData, validation, lastModified },
        phaseStatus: { ...project.phaseStatus, 3: phaseStatus },
        lastModified,
        validation,
      };
    } catch (error) {
      return { ...emptyResult, error: error instanceof Error ? error.message : "Failed to save threats" };
    }
  }

  validateThreatData(threatData: ThreatData | null | undefined, activeMethod: StrideMethod): ThreatValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const tables = activeMethod === "per-element" ? threatData?.perElementTables ?? [] : threatData?.perInteractionTables ?? [];
    const allThreats = tables.flatMap((t) => t.threats);

    if (allThreats.length === 0) {
      errors.push("No threats defined");
      return { isComplete: false, errors, warnings, lastValidated: new Date().toISOString() };
    }

    const noDesc = allThreats.filter(t => !t.threatDescription.trim()).length;
    const noMit = allThreats.filter(t => !t.mitigation.trim()).length;
    const noVer = allThreats.filter(t => !t.verification.trim()).length;

    if (noDesc > 0) warnings.push(`${noDesc} threat(s) have no description`);
    if (noMit > 0) warnings.push(`${noMit} threat(s) have no mitigation defined`);
    if (noVer > 0) warnings.push(`${noVer} threat(s) have no verification method`);

    return { isComplete: errors.length === 0 && warnings.length === 0, errors, warnings, lastValidated: new Date().toISOString() };
  }

  private determinePhaseStatus(validation: ThreatValidation): PhaseStatus {
    if (validation.isComplete) return "complete";
    if (validation.errors.length > 0) return "incomplete";
    return "in-progress";
  }

  // ==================== CRUD OPERATIONS ====================

  createNewThreat(
    threatData: ThreatData,
    activeMethod: StrideMethod,
    tableIndex: number,
    linkedElement?: LinkedDFDElement,
    dataFlow?: DataFlowReference,
    direction?: InteractionDirection
  ): Threat {
    const tables = activeMethod === "per-element" ? threatData.perElementTables ?? [] : threatData.perInteractionTables ?? [];
    const table = tables[tableIndex];
    if (!table) throw new Error(`Table at index ${tableIndex} not found`);

    const strideCategory: StrideCategory = "S";
    const threatDirection = direction || "incoming";

    const existingThreats = table.threats.filter((t) => {
      if (activeMethod === "per-element" && linkedElement) {
        return t.linkedElement?.elementId === linkedElement.elementId && t.strideCategory === strideCategory;
      }
      if (activeMethod === "per-interaction" && dataFlow) {
        return t.dataFlow?.dataFlowId === dataFlow.dataFlowId && t.strideCategory === strideCategory && t.interactionContext?.direction === threatDirection;
      }
      return false;
    });

    const sequenceNumber = existingThreats.length + 1;

    let threatId: string;
    if (activeMethod === "per-element" && linkedElement) {
      threatId = `${linkedElement.elementId}-${strideCategory}-${sequenceNumber}`;
    } else if (activeMethod === "per-interaction" && dataFlow) {
      const tbId = this.extractTBIdentifier(table.trustBoundaryName);
      const dfMatch = dataFlow.dataFlowId.match(/DF-(\d+)/);
      const dfNum = dfMatch ? dfMatch[1] : "1";
      threatId = generateThreatIdPerInteraction(tbId, dfNum, strideCategory, threatDirection, sequenceNumber);
    } else {
      threatId = `THREAT-${Date.now()}`;
    }

    const now = new Date().toISOString();
    const interactionContext: InteractionContext | undefined = activeMethod === "per-interaction" 
      ? { direction: threatDirection, attackedRole: threatDirection === "incoming" ? "source" : "target", victimRole: threatDirection === "incoming" ? "target" : "source", crossesTrustBoundary: false }
      : undefined;

    return {
      id: threatId,
      trustBoundaryId: table.trustBoundaryId,
      trustBoundaryName: table.trustBoundaryName,
      strideCategory,
      sequenceNumber,
      linkedElement: linkedElement ?? null,
      dataFlow: dataFlow ?? null,
      interactionContext,
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

  addThreat(threatData: ThreatData, activeMethod: StrideMethod, tableIndex: number, newThreat: Threat): ThreatData {
    const tables = activeMethod === "per-element" ? [...(threatData.perElementTables ?? [])] : [...(threatData.perInteractionTables ?? [])];
    const table = tables[tableIndex];
    if (!table) return threatData;

    tables[tableIndex] = { ...table, threats: [...table.threats, newThreat] };

    return {
      ...threatData,
      ...(activeMethod === "per-element" ? { perElementTables: tables } : { perInteractionTables: tables }),
      lastModified: new Date().toISOString(),
    };
  }

  updateThreat(threatData: ThreatData, activeMethod: StrideMethod, tableIndex: number, threatId: string, updates: Partial<Threat>): ThreatData {
    const tables = activeMethod === "per-element" ? [...(threatData.perElementTables ?? [])] : [...(threatData.perInteractionTables ?? [])];
    const table = tables[tableIndex];
    if (!table) return threatData;

    const threatIndex = table.threats.findIndex((t) => t.id === threatId);
    if (threatIndex === -1) return threatData;

    const updatedThreats = [...table.threats];
    updatedThreats[threatIndex] = { ...table.threats[threatIndex], ...updates, lastModified: new Date().toISOString() };
    tables[tableIndex] = { ...table, threats: updatedThreats };

    return {
      ...threatData,
      ...(activeMethod === "per-element" ? { perElementTables: tables } : { perInteractionTables: tables }),
      lastModified: new Date().toISOString(),
    };
  }

  deleteThreat(threatData: ThreatData, activeMethod: StrideMethod, tableIndex: number, threatId: string): ThreatData {
    const tables = activeMethod === "per-element" ? [...(threatData.perElementTables ?? [])] : [...(threatData.perInteractionTables ?? [])];
    const table = tables[tableIndex];
    if (!table) return threatData;

    tables[tableIndex] = { ...table, threats: table.threats.filter((t) => t.id !== threatId) };

    return {
      ...threatData,
      ...(activeMethod === "per-element" ? { perElementTables: tables } : { perInteractionTables: tables }),
      lastModified: new Date().toISOString(),
    };
  }

  // ==================== STATISTICS ====================

  getStatistics(threatData: ThreatData | null | undefined, activeMethod: StrideMethod): {
    totalThreats: number;
    byStrideCategory: Record<StrideCategory, number>;
    byTrustBoundary: Record<string, number>;
    byDirection: Record<InteractionDirection, number>;
    withMitigation: number;
    withVerification: number;
  } {
    const tables = activeMethod === "per-element" ? threatData?.perElementTables ?? [] : threatData?.perInteractionTables ?? [];
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
    const byDirection: Record<InteractionDirection, number> = {
      incoming: 0,
      outgoing: 0,
    };

    let withMitigation = 0;
    let withVerification = 0;

    for (const threat of allThreats) {
      byStrideCategory[threat.strideCategory]++;
      const tbKey = threat.trustBoundaryName || "External";
      byTrustBoundary[tbKey] = (byTrustBoundary[tbKey] || 0) + 1;
      if (threat.interactionContext?.direction)
        byDirection[threat.interactionContext.direction]++;
      if (threat.mitigation.trim()) withMitigation++;
      if (threat.verification.trim()) withVerification++;
    }

    return {
      totalThreats: allThreats.length,
      byStrideCategory,
      byTrustBoundary,
      byDirection,
      withMitigation,
      withVerification,
    };
  }

  // ==================== IMPORT / EXPORT ====================

  validateImportData(jsonString: string): ImportValidationResult {
    try {
      const data = JSON.parse(jsonString);
      return this.validateImportObject(data);
    } catch {
      return {
        success: false,
        error: "parse_error",
        message: "Failed to parse JSON.",
      };
    }
  }

  private validateImportObject(data: unknown): ImportValidationResult {
    if (!data || typeof data !== "object") {
      return {
        success: false,
        error: "invalid_format",
        message: "Expected a JSON object.",
      };
    }

    const obj = data as Record<string, unknown>;
    const hasPerElement = Array.isArray(obj.perElementTables);
    const hasPerInteraction = Array.isArray(obj.perInteractionTables);

    if (!hasPerElement && !hasPerInteraction) {
      return {
        success: false,
        error: "missing_tables",
        message: "File must contain perElementTables or perInteractionTables.",
      };
    }

    const perElementTables = hasPerElement
      ? this.validateThreatTables(obj.perElementTables as unknown[])
      : [];
    const perInteractionTables = hasPerInteraction
      ? this.validateThreatTables(obj.perInteractionTables as unknown[])
      : [];

    const totalThreats =
      perElementTables.reduce((sum, t) => sum + t.threats.length, 0) +
      perInteractionTables.reduce((sum, t) => sum + t.threats.length, 0);

    return {
      success: true,
      data: { perElementTables, perInteractionTables },
      stats: {
        perElementTables: perElementTables.length,
        perInteractionTables: perInteractionTables.length,
        totalThreats,
      },
    };
  }

  private validateThreatTables(tables: unknown[]): ThreatTable[] {
    return tables
      .filter(
        (t): t is Record<string, unknown> =>
          !!t &&
          typeof t === "object" &&
          typeof (t as Record<string, unknown>).trustBoundaryName ===
            "string" &&
          Array.isArray((t as Record<string, unknown>).threats)
      )
      .map((t) => ({
        trustBoundaryId:
          typeof t.trustBoundaryId === "string" ? t.trustBoundaryId : null,
        trustBoundaryName: t.trustBoundaryName as string,
        displayIdentifier:
          typeof t.displayIdentifier === "string" ? t.displayIdentifier : "[?]",
        threats: this.validateThreats(t.threats as unknown[]),
      }));
  }

  private validateThreats(threats: unknown[]): Threat[] {
    const validStrideCategories = ["S", "T", "R", "I", "D", "E"];
    return threats
      .filter(
        (t): t is Record<string, unknown> =>
          !!t &&
          typeof t === "object" &&
          typeof (t as Record<string, unknown>).id === "string" &&
          validStrideCategories.includes(
            (t as Record<string, unknown>).strideCategory as string
          )
      )
      .map((t) => ({
        id: t.id as string,
        trustBoundaryId:
          typeof t.trustBoundaryId === "string" ? t.trustBoundaryId : null,
        trustBoundaryName:
          typeof t.trustBoundaryName === "string" ? t.trustBoundaryName : null,
        strideCategory: t.strideCategory as StrideCategory,
        sequenceNumber:
          typeof t.sequenceNumber === "number" ? t.sequenceNumber : 1,
        linkedElement: this.validateLinkedElement(t.linkedElement),
        dataFlow: this.validateDataFlow(t.dataFlow),
        interactionContext: this.validateInteractionContext(
          t.interactionContext
        ),
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
      }));
  }

  private validateLinkedElement(elem: unknown): LinkedDFDElement | null {
    if (!elem || typeof elem !== "object") return null;
    const e = elem as Record<string, unknown>;
    if (
      typeof e.elementId !== "string" ||
      typeof e.elementName !== "string" ||
      typeof e.elementType !== "string"
    )
      return null;
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

  private validateInteractionContext(ctx: unknown): InteractionContext | undefined {
    if (!ctx || typeof ctx !== "object") return undefined;
    const c = ctx as Record<string, unknown>;
    const validDirections: InteractionDirection[] = ["incoming", "outgoing"];
    const validRoles = ["source", "target"];
    if (!validDirections.includes(c.direction as InteractionDirection))
      return undefined;
    if (
      !validRoles.includes(c.attackedRole as string) ||
      !validRoles.includes(c.victimRole as string)
    )
      return undefined;
    return {
      direction: c.direction as InteractionDirection,
      attackedRole: c.attackedRole as "source" | "target",
      victimRole: c.victimRole as "source" | "target",
      crossesTrustBoundary:
        typeof c.crossesTrustBoundary === "boolean"
          ? c.crossesTrustBoundary
          : false,
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
    return typeof actor === "string" &&
      validActors.includes(actor as ThreatActorType)
      ? (actor as ThreatActorType)
      : "external";
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