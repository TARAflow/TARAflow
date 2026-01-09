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
  ThreatSyncStatus,
  ThreatSyncResult,
  DataFlowChange,
  ElementChange,
  STRIDE_PER_ELEMENT_TYPE,
  STRIDE_PER_INTERACTION,
  generateThreatIdPerElement,
  generateThreatIdPerInteraction,
  createDefaultThreatData,
  generateThreatIdForInterface,
  getDefaultInterfaceThreatDescription,
  getDefaultInterfaceAttackDescription,
  isInterfaceTable,
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

  /**
   * Get mitigation templates filtered by STRIDE category and optionally by element type
   * FOR PHYSICAL INTERFACES: Only return templates with "PI" in their ID
   */
  getMitigationTemplates(
    strideCategory?: StrideCategory,
    elementType?: string, // ADD THIS PARAMETER
    customTemplates: MitigationTemplate[] = []
  ): MitigationTemplate[] {
    let templates = [...this.catalog.mitigationTemplates, ...customTemplates];

    // Filter by STRIDE category
    if (strideCategory) {
      templates = templates.filter((t) => t.strideCategory === strideCategory);
    }

    // NEW: Filter by element type for Physical/Interface elements
    if (elementType === "PhysicalInterface" || elementType === "Interface") {
      // Only show physical mitigations (those with -PI- in ID)
      templates = templates.filter((t) => t.id.includes("-IF-"));
    } else if (elementType) {
      // For other elements, exclude physical mitigations
      templates = templates.filter((t) => !t.id.includes("-IF-"));
    }

    return templates;
  }

  /**
   * Get verification templates filtered by STRIDE category and optionally by element type
   * FOR PHYSICAL INTERFACES: Only return templates with "PI" in their ID
   */
  getVerificationTemplates(
    strideCategory?: StrideCategory,
    elementType?: string, // ADD THIS PARAMETER
    customTemplates: VerificationTemplate[] = []
  ): VerificationTemplate[] {
    let templates = [...this.catalog.verificationTemplates, ...customTemplates];

    // Filter by STRIDE category
    if (strideCategory) {
      templates = templates.filter((t) => t.strideCategory === strideCategory);
    }

    // NEW: Filter by element type for Physical/Interface elements
    if (elementType === "PhysicalInterface" || elementType === "Interface") {
      // Only show physical verifications (those with -PI- in ID)
      templates = templates.filter((t) => t.id.includes("-IF-"));
    } else if (elementType) {
      // For other elements, exclude physical verifications
      templates = templates.filter((t) => !t.id.includes("-IF-"));
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
          : this.generateThreatsPerInteraction(
              elements,
              connections,
              configuration
            );

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

      const perElementResult = this.generateThreatsPerElement(
        elements,
        connections
      );
      const perInteractionResult = this.generateThreatsPerInteraction(
        elements,
        connections,
        configuration
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

  // ==================== PER-ELEMENT GENERATION ====================

  private generateThreatsPerElement(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[]
  ): { tables: ThreatTable[]; count: number } {
    const tables: ThreatTable[] = [];
    let totalCount = 0;

    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const externalEntities = elements.filter(
      (e) => e.type === "ExternalEntity"
    );
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

    // Trust Boundary tables (FIRST)
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

    // External Entities table (LAST)
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

        const threatId = generateThreatIdPerElement(
          formattedElementId,
          strideCategory,
          seqNum
        );
        const template = this.findBestThreatTemplate(
          strideCategory,
          element.type
        );

        let threatDescription = template?.threat || "";
        let attackDescription = template?.attack || "";

        if (
          !template &&
          (element.type === "Interface" || element.type === "PhysicalInterface")
        ) {
          // Use default interface descriptions (English - will be localized in UI if needed)
          threatDescription = getDefaultInterfaceThreatDescription(
            strideCategory,
            element.name,
            "en"
          );
          attackDescription = getDefaultInterfaceAttackDescription(
            strideCategory,
            element.name,
            "en"
          );
        }

        threats.push({
          id: threatId,
          trustBoundaryId,
          trustBoundaryName,
          strideCategory,
          sequenceNumber: seqNum,
          linkedElement: {
            elementId: element.id, // XML ID (stable reference)
            elementName: element.name,
            elementType: element.type,
            displayId: element.displayId, // Formatted ID (for display)
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
   *
   * PLUS: Generates threats for physical interfaces
   */
  private generateThreatsPerInteraction(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[],
    configuration: ThreatConfiguration
  ): { tables: ThreatTable[]; count: number } {
    const tables: ThreatTable[] = [];
    let totalCount = 0;

    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const interfaces = elements.filter(
      (e) => e.type === "Interface" || e.type === "PhysicalInterface"
    );

    if (trustBoundaries.length === 0) {
      // All data flows in one table
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

      // All interfaces in one table
      if (interfaces.length > 0) {
        const interfacesTable = this.createThreatTableForInterfaces(
          interfaces,
          elements,
          null,
          "Physical Interfaces [TB-0]",
          "[TB0]",
          0
        );
        tables.push(interfacesTable);
        totalCount += interfacesTable.threats.length;
      }
    } else {
      trustBoundaries.forEach((tb, index) => {
        // Data flows for this trust boundary
        const relevantFlows = this.getDataFlowsForTrustBoundary(
          tb,
          connections,
          elements
        );

        if (relevantFlows.length > 0) {
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

        // Interfaces for this trust boundary
        const interfacesInTB = this.getInterfacesForTrustBoundary(
          tb,
          interfaces
        );
        if (interfacesInTB.length > 0) {
          const tbId = this.extractTBIdentifier(tb.name, index);

          // Format: "Physical Interfaces [TB-ID]"
          const displayName = `Physical Interfaces [${tbId}]`;

          const interfacesTable = this.createThreatTableForInterfaces(
            interfacesInTB,
            elements,
            tb.id,
            displayName,
            `[${tbId}]`,
            index
          );
          tables.push(interfacesTable);
          totalCount += interfacesTable.threats.length;
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

    // Build mapping: connection.id -> ID ohne DF- Präfix
    // displayId ist "DF-2" oder "DF-xx" → speichere "2" oder "xx"
    const dataFlowIdMap: Record<string, string> = {};
    for (const conn of connections) {
      if (!dataFlowIdMap[conn.id]) {
        let dfId: string;
        
        if (conn.displayId) {
          // Entferne "DF-" Präfix: "DF-2" → "2", "DF-xx" → "xx"
          const match = conn.displayId.match(/^DF-(.+)$/i);
          dfId = match ? match[1] : conn.displayId;
        } else {
          // Fallback: Label oder XML-ID
          const label = conn.label || "";
          const bracketMatch = label.match(/\[DF-(.+?)\]/i);
          if (bracketMatch) {
            dfId = bracketMatch[1];
          } else {
            const startMatch = label.match(/^DF-(.+?)(?:\s|$)/i);
            if (startMatch) {
              dfId = startMatch[1];
            } else {
              dfId = conn.id; // XML ID
            }
          }
        }
        
        dataFlowIdMap[conn.id] = dfId;
      }
    }

    const trustBoundary = elements.find((e) => e.id === trustBoundaryId);

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
            connectionId: connection.id, // Stable XML ID for matching
            dataFlowId: dfNum, // Speichere ohne DF- (UI fügt es hinzu)
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

  /**
   * Create threat table for physical interfaces
   * Generates threats for physical attack vectors (tampering, shorts, etc.)
   *
   * For interfaces, we focus on physical STRIDE categories:
   * - T (Tampering): Hardware manipulation, voltage injection
   * - I (Information Disclosure): Sniffing, side-channel attacks
   * - D (Denial of Service): Short circuit, power surge, physical damage
   * - E (Elevation of Privilege): Debug access, firmware manipulation
   */
  private createThreatTableForInterfaces(
    interfaces: DFDElementReference[],
    allElements: DFDElementReference[],
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    displayIdentifier: string,
    tbIndex: number = 0
  ): ThreatTable {
    const threats: Threat[] = [];
    const sequenceCounters: Record<string, Record<StrideCategory, number>> = {};

    const tbId = this.extractTBIdentifier(trustBoundaryName, tbIndex);

    // Determine trust boundary for cross-boundary checks
    const trustBoundary = allElements.find((e) => e.id === trustBoundaryId);

    for (const interfaceElem of interfaces) {
      // For interfaces, we focus on physical attack STRIDE categories
      // T (Tampering), I (Info Disclosure), D (DoS), E (Elevation)
      const applicableCategories: StrideCategory[] = ["T", "I", "D", "E"];

      // Extract formatted interface ID
      const interfaceId = this.extractFormattedInterfaceId(interfaceElem);

      for (const strideCategory of applicableCategories) {
        const counterKey = `${tbId}-IF-${interfaceId}-${strideCategory}`;
        if (!sequenceCounters[counterKey]) {
          sequenceCounters[counterKey] = {
            S: 0,
            T: 0,
            R: 0,
            I: 0,
            D: 0,
            E: 0,
          };
        }
        sequenceCounters[counterKey][strideCategory]++;
        const seqNum = sequenceCounters[counterKey][strideCategory];

        const threatId = generateThreatIdForInterface(
          tbId,
          interfaceId,
          strideCategory,
          seqNum
        );

        // Determine if interface is at trust boundary
        const crossesTrustBoundary = trustBoundary
          ? this.isElementAtTrustBoundary(interfaceElem, trustBoundary)
          : false;

        // Create LinkedDFDElement for the interface
        const linkedElement: LinkedDFDElement = {
          elementId: interfaceElem.id,
          elementName: interfaceElem.name,
          elementType: interfaceElem.type,
          displayId: interfaceElem.displayId,
        };

        // Get default descriptions (will be localized in UI)
        const threatDescription = getDefaultInterfaceThreatDescription(
          strideCategory,
          interfaceElem.name,
          "en"
        );
        const attackDescription = getDefaultInterfaceAttackDescription(
          strideCategory,
          interfaceElem.name,
          "en"
        );

        threats.push({
          id: threatId,
          trustBoundaryId,
          trustBoundaryName,
          strideCategory,
          sequenceNumber: seqNum,
          linkedElement,
          dataFlow: null,
          interactionContext: {
            direction: "incoming", // Interfaces are typically "incoming" physical access
            attackedRole: "target", // The interface itself is the target
            victimRole: "target",
            crossesTrustBoundary,
          },
          threatDescription,
          attackDescription,
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

  private getFallbackThreatDescription(
    strideCategory: StrideCategory,
    direction: InteractionDirection
  ): string {
    const dirLabel = direction === "incoming" ? "Incoming" : "Outgoing";
    const strideNames: Record<StrideCategory, string> = {
      S: "Spoofing",
      T: "Tampering",
      R: "Repudiation",
      I: "Information Disclosure",
      D: "Denial of Service",
      E: "Elevation of Privilege",
    };
    return `${dirLabel} ${strideNames[strideCategory]} threat on data flow`;
  }

  private doesDataFlowCrossTrustBoundary(
    source: DFDElementReference,
    target: DFDElementReference,
    trustBoundary: DFDElementReference
  ): boolean {
    const sourceInside = this.isElementInsideTrustBoundary(
      source,
      trustBoundary
    );
    const targetInside = this.isElementInsideTrustBoundary(
      target,
      trustBoundary
    );
    return sourceInside !== targetInside;
  }

  // ==================== HELPER METHODS ====================

  private extractFormattedElementId(
    element: DFDElementReference,
    typeCounters: Record<string, number>
  ): string {
    // Priority 1: Use displayId if available (e.g., "DF-1", "P-1")
    // Remove hyphens for threat ID format (DF-1 -> DF1)
    if (element.displayId) {
      return element.displayId.replace(/-/g, "");
    }

    // Priority 2: Try to extract from name pattern [XX-N]
    const bracketMatch = element.name.match(/\[([A-Z]+)-?(\d+)\]/i);
    if (bracketMatch) {
      return `${bracketMatch[1].toUpperCase()}${bracketMatch[2]}`;
    }

    // Priority 3: Generate based on type counter
    const typePrefix = this.getTypePrefixForElement(element.type);
    if (!typeCounters[element.type]) typeCounters[element.type] = 0;
    typeCounters[element.type]++;
    return `${typePrefix}${typeCounters[element.type]}`;
  }

  private extractFormattedDataFlowId(
    connection: DFDConnectionReference,
    dfCounter: number
  ): string {
    const label = connection.label || "";
    const bracketMatch = label.match(/\[DF-?(\d+)\]/i);
    return bracketMatch ? bracketMatch[1] : String(dfCounter);
  }

  /**
   * Extract DataFlow ID from connection WITHOUT DF- prefix
   * Returns "2" or "xx" for use in threat IDs
   */
  private extractDataFlowIdFromConnection(
    connection: DFDConnectionReference,
    existingDataFlowId?: string
  ): string {
    // Use displayId: "DF-2" → "2", "DF-xx" → "xx"
    if (connection.displayId) {
      const match = connection.displayId.match(/^DF-(.+)$/i);
      if (match) {
        return match[1];
      }
      return connection.displayId;
    }

    // Try label
    const label = connection.label || "";
    const bracketMatch = label.match(/\[DF-(.+?)\]/i);
    if (bracketMatch) {
      return bracketMatch[1];
    }

    const startMatch = label.match(/^DF-(.+?)(?:\s|$)/i);
    if (startMatch) {
      return startMatch[1];
    }

    // Use existing if available
    if (existingDataFlowId) {
      const match = existingDataFlowId.match(/^DF-(.+)$/i);
      if (match) {
        return match[1];
      }
      return existingDataFlowId;
    }

    // Fallback
    return connection.id;
  }

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

  private extractTBIdentifier(name: string, tbIndex?: number): string {
    const tbMatch = name.match(/\[TB-?(\d+)\]/i);
    if (tbMatch) return `TB${tbMatch[1]}`;

    const bracketMatch = name.match(/\[([^\]]+)\]/);
    if (bracketMatch) return bracketMatch[1].replace(/-/g, "");

    if (tbIndex !== undefined) return `TB${tbIndex + 1}`;

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
    return connections
      .filter((conn) => elementIds.has(conn.from) || elementIds.has(conn.to))
      .map((conn) => ({
        id: conn.id,
        type: "DataFlow",
        name: conn.label || conn.id,
        displayId: conn.displayId,
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
      }));
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

  /**
   * Extract formatted Interface ID from element
   * Priority: displayId > [IF-N] in name > type prefix + counter
   */
  private extractFormattedInterfaceId(
    interfaceElem: DFDElementReference
  ): string {
    // Priority 1: Use displayId if available
    if (interfaceElem.displayId) {
      return interfaceElem.displayId.replace(/-/g, "");
    }

    // Priority 2: Try to extract from name pattern [IF-N] or [USB-N] etc.
    const bracketMatch = interfaceElem.name.match(/\[([A-Z]+)-?(\d+)\]/i);
    if (bracketMatch) {
      return `${bracketMatch[1].toUpperCase()}${bracketMatch[2]}`;
    }

    // Priority 3: Use element type as prefix
    const typePrefix = interfaceElem.type === "PhysicalInterface" ? "PI" : "IF";

    // Try to extract number from name if it ends with a digit
    const numberMatch = interfaceElem.name.match(/(\d+)$/);
    if (numberMatch) {
      return `${typePrefix}${numberMatch[1]}`;
    }

    // Fallback: use element ID
    return `${typePrefix}${interfaceElem.id}`;
  }

  /**
   * Get interfaces that are inside or at the boundary of a trust boundary
   */
  private getInterfacesForTrustBoundary(
    trustBoundary: DFDElementReference,
    interfaces: DFDElementReference[]
  ): DFDElementReference[] {
    return interfaces.filter(
      (iface) =>
        this.isElementInsideTrustBoundary(iface, trustBoundary) ||
        this.isElementAtTrustBoundary(iface, trustBoundary)
    );
  }

  /**
   * Check if element is at the edge/boundary of a trust boundary
   * Useful for interfaces that might be positioned at TB borders
   */
  private isElementAtTrustBoundary(
    element: DFDElementReference,
    trustBoundary: DFDElementReference
  ): boolean {
    const tbLeft = trustBoundary.position.x;
    const tbRight = trustBoundary.position.x + trustBoundary.size.width;
    const tbTop = trustBoundary.position.y;
    const tbBottom = trustBoundary.position.y + trustBoundary.size.height;

    const elemLeft = element.position.x;
    const elemRight = element.position.x + element.size.width;
    const elemTop = element.position.y;
    const elemBottom = element.position.y + element.size.height;

    // Check if element overlaps with trust boundary border (tolerance: 10px)
    const tolerance = 10;
    const atLeftBorder =
      Math.abs(elemLeft - tbLeft) < tolerance ||
      Math.abs(elemRight - tbLeft) < tolerance;
    const atRightBorder =
      Math.abs(elemLeft - tbRight) < tolerance ||
      Math.abs(elemRight - tbRight) < tolerance;
    const atTopBorder =
      Math.abs(elemTop - tbTop) < tolerance ||
      Math.abs(elemBottom - tbTop) < tolerance;
    const atBottomBorder =
      Math.abs(elemTop - tbBottom) < tolerance ||
      Math.abs(elemBottom - tbBottom) < tolerance;

    // Element is at boundary if it's near any border AND within TB bounds in other dimension
    const withinHorizontalBounds =
      elemLeft >= tbLeft - tolerance && elemRight <= tbRight + tolerance;
    const withinVerticalBounds =
      elemTop >= tbTop - tolerance && elemBottom <= tbBottom + tolerance;

    return (
      ((atLeftBorder || atRightBorder) && withinVerticalBounds) ||
      ((atTopBorder || atBottomBorder) && withinHorizontalBounds)
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

      return {
        success: true,
        threats: { ...threatData, validation, lastModified },
        phaseStatus: { ...project.phaseStatus, 3: phaseStatus },
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

    const noDesc = allThreats.filter((t) => !t.threatDescription.trim()).length;
    const noMit = allThreats.filter((t) => !t.mitigation.trim()).length;
    const noVer = allThreats.filter((t) => !t.verification.trim()).length;

    if (noDesc > 0) warnings.push(`${noDesc} threat(s) have no description`);
    if (noMit > 0)
      warnings.push(`${noMit} threat(s) have no mitigation defined`);
    if (noVer > 0)
      warnings.push(`${noVer} threat(s) have no verification method`);

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
    const tables =
      activeMethod === "per-element"
        ? threatData.perElementTables ?? []
        : threatData.perInteractionTables ?? [];
    const table = tables[tableIndex];
    if (!table) throw new Error(`Table at index ${tableIndex} not found`);

    const strideCategory: StrideCategory = "S";
    const threatDirection = direction || "incoming";

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
          t.strideCategory === strideCategory &&
          t.interactionContext?.direction === threatDirection
        );
      }
      return false;
    });

    const sequenceNumber = existingThreats.length + 1;

    let threatId: string;
    if (activeMethod === "per-element" && linkedElement) {
      threatId = `${linkedElement.elementId}-${strideCategory}-${sequenceNumber}`;
    } else if (activeMethod === "per-interaction" && dataFlow) {
      const tbId = this.extractTBIdentifier(table.trustBoundaryName);
      // dataFlowId ist bereits ohne DF-: "2" oder "xx"
      const dfNum = dataFlow.dataFlowId;
      threatId = generateThreatIdPerInteraction(
        tbId,
        dfNum,
        strideCategory,
        threatDirection,
        sequenceNumber
      );
    } else {
      threatId = `THREAT-${Date.now()}`;
    }

    const now = new Date().toISOString();
    const interactionContext: InteractionContext | undefined =
      activeMethod === "per-interaction"
        ? {
            direction: threatDirection,
            attackedRole: threatDirection === "incoming" ? "source" : "target",
            victimRole: threatDirection === "incoming" ? "target" : "source",
            crossesTrustBoundary: false,
          }
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

    tables[tableIndex] = { ...table, threats: [...table.threats, newThreat] };

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

    const updatedThreats = [...table.threats];
    updatedThreats[threatIndex] = {
      ...table.threats[threatIndex],
      ...updates,
      lastModified: new Date().toISOString(),
    };
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

    tables[tableIndex] = {
      ...table,
      threats: table.threats.filter((t) => t.id !== threatId),
    };

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
    byDirection: Record<InteractionDirection, number>;
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

  private validateInteractionContext(
    ctx: unknown
  ): InteractionContext | undefined {
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

  // ==================== SYNC STATUS CHECK ====================

  /**
   * Check synchronization status between DFD and Threats
   *
   * Identifies:
   * - Elements/DataFlows in DFD without corresponding threats
   * - Threats referencing deleted DFD elements/flows
   * - Changed references (name, id, source/target)
   */
  checkSyncStatus(
    project: ThreatProjectData,
    threatData: ThreatData | null,
    method: StrideMethod
  ): ThreatSyncStatus {
    const now = new Date().toISOString();
    const elements = project.dfdElements || [];
    const connections = project.dfdConnections || [];

    // Default empty result
    const emptyStatus: ThreatSyncStatus = {
      inSync: true,
      missingInThreats: { elements: [], dataFlows: [] },
      orphanedThreats: { elementIds: [], dataFlowIds: [], threatIds: [] },
      changedReferences: { elements: [], dataFlows: [] },
      summary: {
        missingElementCount: 0,
        missingDataFlowCount: 0,
        orphanedThreatCount: 0,
        changedReferenceCount: 0,
      },
      lastChecked: now,
    };

    if (!threatData) {
      // No threats yet - check if there are elements that should have threats
      if (method === "per-element") {
        const threatenableElements = elements.filter(
          (e) =>
            e.type !== "TrustBoundary" &&
            STRIDE_PER_ELEMENT_TYPE[e.type]?.length > 0
        );
        return {
          ...emptyStatus,
          inSync: threatenableElements.length === 0,
          missingInThreats: { elements: threatenableElements, dataFlows: [] },
          summary: {
            missingElementCount: threatenableElements.length,
            missingDataFlowCount: 0,
            orphanedThreatCount: 0,
            changedReferenceCount: 0,
          },
        };
      } else {
        return {
          ...emptyStatus,
          inSync: connections.length === 0,
          missingInThreats: { elements: [], dataFlows: connections },
          summary: {
            missingElementCount: 0,
            missingDataFlowCount: connections.length,
            orphanedThreatCount: 0,
            changedReferenceCount: 0,
          },
        };
      }
    }

    if (method === "per-element") {
      return this.checkSyncStatusPerElement(
        elements,
        connections,
        threatData,
        now
      );
    } else {
      return this.checkSyncStatusPerInteraction(
        elements,
        connections,
        threatData,
        now
      );
    }
  }

  private checkSyncStatusPerElement(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[],
    threatData: ThreatData,
    now: string
  ): ThreatSyncStatus {
    const tables = threatData.perElementTables || [];
    const allThreats = tables.flatMap((t) => t.threats);

    // Build lookup maps by XML ID (stable)
    const elementByXmlId = new Map(elements.map((e) => [e.id, e]));
    const connectionByXmlId = new Map(connections.map((c) => [c.id, c]));

    // Build Trust Boundary lookup to check for name changes
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const trustBoundaryById = new Map(trustBoundaries.map((tb) => [tb.id, tb]));

    // Check if any Trust Boundary names changed
    let trustBoundaryNamesChanged = false;
    for (const table of tables) {
      if (table.trustBoundaryId) {
        const tb = trustBoundaryById.get(table.trustBoundaryId);
        if (tb && tb.name !== table.trustBoundaryName) {
          trustBoundaryNamesChanged = true;
          break;
        }
      }
    }

    // Track which elements/connections have threats
    const elementIdsWithThreats = new Set<string>();
    const connectionIdsWithThreats = new Set<string>();

    const orphanedElementIds: string[] = [];
    const orphanedThreatIds: string[] = [];
    const changedElements: ElementChange[] = [];

    for (const threat of allThreats) {
      if (!threat.linkedElement) continue;

      const xmlId = threat.linkedElement.elementId;
      const elementType = threat.linkedElement.elementType;

      if (elementType === "DataFlow") {
        // Match DataFlow by XML ID
        const matchedConn = connectionByXmlId.get(xmlId);

        if (matchedConn) {
          connectionIdsWithThreats.add(matchedConn.id);

          // Check for label changes
          const changes: ("name" | "id")[] = [];

          if (threat.linkedElement.elementName !== matchedConn.label) {
            changes.push("name");
          }

          // Check for displayId changes (DF-1 → DF-1a)
          if (
            threat.linkedElement.displayId &&
            matchedConn.displayId &&
            threat.linkedElement.displayId !== matchedConn.displayId
          ) {
            changes.push("id");
          }

          if (changes.length > 0) {
            changedElements.push({
              threatId: threat.id,
              oldRef: {
                elementId: xmlId,
                elementName: threat.linkedElement.elementName,
                elementType: elementType,
              },
              newRef: {
                id: matchedConn.id,
                name: matchedConn.label || "",
                type: "DataFlow",
                displayId: matchedConn.displayId,
                position: { x: 0, y: 0 },
                size: { width: 0, height: 0 },
              },
              changes,
            });
          }
        } else {
          // DataFlow not found - orphaned
          if (!orphanedElementIds.includes(xmlId)) {
            orphanedElementIds.push(xmlId);
          }
          orphanedThreatIds.push(threat.id);
        }
      } else {
        // Match Element by XML ID
        const matchedElement = elementByXmlId.get(xmlId);

        if (matchedElement) {
          elementIdsWithThreats.add(matchedElement.id);

          // Check for changes
          const changes: ("name" | "type")[] = [];
          if (threat.linkedElement.elementName !== matchedElement.name) {
            changes.push("name");
          }
          if (threat.linkedElement.elementType !== matchedElement.type) {
            changes.push("type");
          }

          if (changes.length > 0) {
            changedElements.push({
              threatId: threat.id,
              oldRef: {
                elementId: xmlId,
                elementName: threat.linkedElement.elementName,
                elementType: threat.linkedElement.elementType,
              },
              newRef: matchedElement,
              changes,
            });
          }
        } else {
          // Element not found - orphaned
          if (!orphanedElementIds.includes(xmlId)) {
            orphanedElementIds.push(xmlId);
          }
          orphanedThreatIds.push(threat.id);
        }
      }
    }

    // Find missing elements (in DFD but no threats)
    const missingElements = elements.filter(
      (e) =>
        e.type !== "TrustBoundary" &&
        STRIDE_PER_ELEMENT_TYPE[e.type]?.length > 0 &&
        !elementIdsWithThreats.has(e.id)
    );

    // Find missing DataFlows
    const missingDataFlows = connections.filter(
      (c) => !connectionIdsWithThreats.has(c.id)
    );

    const inSync =
      missingElements.length === 0 &&
      missingDataFlows.length === 0 &&
      orphanedThreatIds.length === 0 &&
      changedElements.length === 0 &&
      !trustBoundaryNamesChanged;

    return {
      inSync,
      missingInThreats: {
        elements: missingElements,
        dataFlows: missingDataFlows,
      },
      orphanedThreats: {
        elementIds: orphanedElementIds,
        dataFlowIds: [],
        threatIds: orphanedThreatIds,
      },
      changedReferences: { elements: changedElements, dataFlows: [] },
      summary: {
        missingElementCount: missingElements.length,
        missingDataFlowCount: missingDataFlows.length,
        orphanedThreatCount: orphanedThreatIds.length,
        changedReferenceCount: changedElements.length,
      },
      lastChecked: now,
    };
  }

  // ==================== NEW HELPER METHODS ====================

  /**
   * Extract formatted ID from element name (e.g., "[P-1]" -> "P-1")
   * Returns null if no formatted ID found in name
   */
  private extractFormattedIdFromElement(
    element: DFDElementReference
  ): string | null {
    // Look for [XX-N] pattern in name, e.g., "MyProcess [P-1]"
    const bracketMatch = element.name.match(/\[([A-Z]+-?\d+)\]/i);
    if (bracketMatch) {
      return bracketMatch[1].toUpperCase();
    }
    return null;
  }

  /**
   * Extract formatted ID from connection (e.g., "DF-1")
   * Uses displayId if available, otherwise extracts from label
   */
  private extractFormattedIdFromConnection(
    connection: DFDConnectionReference
  ): string | null {
    // Use displayId if available (set by DFD parser from idlabel)
    if (connection.displayId) {
      return connection.displayId;
    }

    // Try to find [DF-N] pattern in label
    const label = connection.label || "";
    const dfMatch = label.match(/\[DF-?(\d+)\]/i);
    if (dfMatch) {
      return `DF-${dfMatch[1]}`;
    }

    // Try to extract DF-N from label that starts with it
    const startMatch = label.match(/^DF-?(\d+)/i);
    if (startMatch) {
      return `DF-${startMatch[1]}`;
    }

    return null;
  }

  private checkSyncStatusPerInteraction(
    elements: DFDElementReference[],
    connections: DFDConnectionReference[],
    threatData: ThreatData,
    now: string
  ): ThreatSyncStatus {
    const tables = threatData.perInteractionTables || [];
    const allThreats = tables.flatMap((t) => t.threats);

    // Separate interface threats from data flow threats
    const dataFlowThreats = allThreats.filter((t) => t.dataFlow !== null);
    const interfaceThreats = allThreats.filter(
      (t) =>
        t.linkedElement &&
        (t.linkedElement.elementType === "Interface" ||
          t.linkedElement.elementType === "PhysicalInterface")
    );

    // Build lookup maps
    const elementById = new Map(elements.map((e) => [e.id, e]));

    // Build Trust Boundary lookup to check for name changes
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const trustBoundaryById = new Map(trustBoundaries.map((tb) => [tb.id, tb]));

    // Check if any Trust Boundary names changed (skip Interface tables)
    let trustBoundaryNamesChanged = false;
    for (const table of tables) {
      if (table.trustBoundaryId && !isInterfaceTable(table)) {
        const tb = trustBoundaryById.get(table.trustBoundaryId);
        if (tb && tb.name !== table.trustBoundaryName) {
          trustBoundaryNamesChanged = true;
          break;
        }
      }
    }

    // Map by displayId for matching (primary)
    const connectionByDisplayId = new Map(
      connections.filter((c) => c.displayId).map((c) => [c.displayId!, c])
    );

    // Map by XML id for fallback matching
    const connectionById = new Map(connections.map((c) => [c.id, c]));

    // Track which connections have threats
    const connectionsWithThreats = new Set<string>();
    const orphanedDataFlowIds: string[] = [];
    const orphanedThreatIds: string[] = [];
    const changedDataFlows: DataFlowChange[] = [];

    for (const threat of allThreats) {
      if (!threat.dataFlow) continue;

      const oldRef = threat.dataFlow;

      // Try matching in order of reliability:
      // 1. By connectionId (stable XML ID) - most reliable
      // 2. By displayId (can change when renumbered)
      let matchedConnection: DFDConnectionReference | undefined;

      if (oldRef.connectionId) {
        matchedConnection = connectionById.get(oldRef.connectionId);
      }

      if (!matchedConnection) {
        // oldRef.dataFlowId ist ohne DF- ("2"), displayId hat DF- ("DF-2")
        const displayIdToMatch = `DF-${oldRef.dataFlowId}`;
        matchedConnection = connectionByDisplayId.get(displayIdToMatch);
      }

      if (matchedConnection) {
        connectionsWithThreats.add(matchedConnection.id);

        // Check for changes
        const changes: ("name" | "id" | "source" | "target")[] = [];

        // ID change (renumbered) - compare without DF- prefix
        if (matchedConnection.displayId) {
          const newId = matchedConnection.displayId.replace(/^DF-/i, '');
          if (oldRef.dataFlowId !== newId) {
            changes.push("id");
          }
        }

        // Name change
        if (
          matchedConnection.label &&
          oldRef.dataFlowName !== matchedConnection.label
        ) {
          changes.push("name");
        }

        // Source/Target ID change (direction changed)
        if (oldRef.sourceId !== matchedConnection.from) {
          changes.push("source");
        }
        if (oldRef.targetId !== matchedConnection.to) {
          changes.push("target");
        }

        // NEW: Check if source/target NAMES changed (element renamed)
        const sourceElem = elementById.get(matchedConnection.from);
        const targetElem = elementById.get(matchedConnection.to);

        if (sourceElem && oldRef.sourceName !== sourceElem.name) {
          changes.push("source");
        }
        if (targetElem && oldRef.targetName !== targetElem.name) {
          changes.push("target");
        }

        if (changes.length > 0) {
          changedDataFlows.push({
            threatId: threat.id,
            oldRef,
            newRef: matchedConnection,
            changes,
          });
        }
      } else {
        // Connection not found at all - orphaned
        if (!orphanedDataFlowIds.includes(oldRef.dataFlowId)) {
          orphanedDataFlowIds.push(oldRef.dataFlowId);
        }
        orphanedThreatIds.push(threat.id);
      }
    }

    // Find missing data flows (in DFD but no threats)
    const missingDataFlows = connections.filter((c) => {
      return !connectionsWithThreats.has(c.id);
    });

    // Check interface threats
    const interfaceStatus = this.checkSyncStatusForInterfaces(
      elements,
      interfaceThreats,
      now
    );

    // Add interface orphaned threats to the main list
    orphanedThreatIds.push(...interfaceStatus.orphanedInterfaceThreats);

    // Combine element changes (interfaces only for per-interaction)
    const changedElements = interfaceStatus.changedInterfaceReferences;

    const inSync =
      missingDataFlows.length === 0 &&
      interfaceStatus.missingInterfaces.length === 0 &&
      orphanedThreatIds.length === 0 &&
      changedDataFlows.length === 0 &&
      changedElements.length === 0 &&
      !trustBoundaryNamesChanged;

    return {
      inSync,
      missingInThreats: {
        elements: interfaceStatus.missingInterfaces,
        dataFlows: missingDataFlows,
      },
      orphanedThreats: {
        elementIds: [], // Could add interface IDs here if needed
        dataFlowIds: orphanedDataFlowIds,
        threatIds: orphanedThreatIds,
      },
      changedReferences: {
        elements: changedElements,
        dataFlows: changedDataFlows,
      },
      summary: {
        missingElementCount: interfaceStatus.missingInterfaces.length,
        missingDataFlowCount: missingDataFlows.length,
        orphanedThreatCount: orphanedThreatIds.length,
        changedReferenceCount: changedDataFlows.length + changedElements.length,
      },
      lastChecked: now,
    };
  }

  /**
   * Check sync status for interface threats
   * Similar to data flow sync but for physical interfaces
   */
  private checkSyncStatusForInterfaces(
    elements: DFDElementReference[],
    interfaceThreats: Threat[],
    now: string
  ): {
    missingInterfaces: DFDElementReference[];
    orphanedInterfaceThreats: string[];
    changedInterfaceReferences: ElementChange[];
  } {
    const elementById = new Map(elements.map((e) => [e.id, e]));
    const interfaces = elements.filter(
      (e) => e.type === "Interface" || e.type === "PhysicalInterface"
    );

    const interfacesWithThreats = new Set<string>();
    const orphanedInterfaceThreats: string[] = [];
    const changedInterfaceReferences: ElementChange[] = [];

    for (const threat of interfaceThreats) {
      if (!threat.linkedElement) continue;

      const xmlId = threat.linkedElement.elementId;
      const matchedInterface = elementById.get(xmlId);

      if (matchedInterface) {
        interfacesWithThreats.add(matchedInterface.id);

        // Check for changes
        const changes: ("name" | "type")[] = [];
        if (threat.linkedElement.elementName !== matchedInterface.name) {
          changes.push("name");
        }
        if (threat.linkedElement.elementType !== matchedInterface.type) {
          changes.push("type");
        }

        if (changes.length > 0) {
          changedInterfaceReferences.push({
            threatId: threat.id,
            oldRef: {
              elementId: xmlId,
              elementName: threat.linkedElement.elementName,
              elementType: threat.linkedElement.elementType,
            },
            newRef: matchedInterface,
            changes,
          });
        }
      } else {
        // Interface not found - orphaned
        orphanedInterfaceThreats.push(threat.id);
      }
    }

    // Find missing interfaces (in DFD but no threats)
    const missingInterfaces = interfaces.filter(
      (iface) => !interfacesWithThreats.has(iface.id)
    );

    return {
      missingInterfaces,
      orphanedInterfaceThreats,
      changedInterfaceReferences,
    };
  }

  // ==================== SYNC THREATS (DELTA GENERATION) ====================

  /**
   * Synchronize threats with DFD changes
   *
   * - Updates changed references (name, id, direction)
   * - Adds threats for new elements/data flows
   * - Optionally removes orphaned threats
   * - Preserves manually edited threats
   */
  syncThreats(
    project: ThreatProjectData,
    threatData: ThreatData,
    method: StrideMethod,
    configuration: ThreatConfiguration,
    options: { removeOrphaned?: boolean; updateReferences?: boolean } = {}
  ): ThreatSyncResult {
    const { removeOrphaned = false, updateReferences = true } = options;

    try {
      const syncStatus = this.checkSyncStatus(project, threatData, method);

      if (syncStatus.inSync) {
        return { success: true, added: 0, removed: 0, updated: 0, threatData };
      }

      // ==================== SIMPLIFIED: Check if all threats deleted ====================
      const activeTables =
        method === "per-element"
          ? threatData.perElementTables
          : threatData.perInteractionTables;

      const hasNoThreats =
        !activeTables ||
        activeTables.length === 0 ||
        activeTables.every((t) => t.threats.length === 0);

      if (hasNoThreats) {
        // ALL THREATS DELETED: Simply regenerate (same as Generate Threats button)
        const result = this.generateThreatsForMethod(
          project,
          configuration,
          method
        );

        if (result.success) {
          const updatedData: ThreatData = {
            ...threatData,
            ...(method === "per-element"
              ? { perElementTables: result.tables }
              : { perInteractionTables: result.tables }),
            lastModified: new Date().toISOString(),
          };

          return {
            success: true,
            added: result.tables.reduce((sum, t) => sum + t.threats.length, 0),
            removed: 0,
            updated: 0,
            threatData: updatedData,
          };
        } else {
          return {
            success: false,
            added: 0,
            removed: 0,
            updated: 0,
            error: result.error,
          };
        }
      }

      // ==================== EXISTING: Delta sync for partial changes ====================
      let updatedData = { ...threatData };
      let added = 0;
      let removed = 0;
      let updated = 0;

      if (method === "per-element") {
        const result = this.syncThreatsPerElement(
          project,
          updatedData,
          syncStatus,
          removeOrphaned,
          updateReferences
        );
        updatedData = result.threatData;
        added = result.added;
        removed = result.removed;
        updated = result.updated;
      } else {
        const result = this.syncThreatsPerInteraction(
          project,
          updatedData,
          syncStatus,
          removeOrphaned,
          updateReferences,
          configuration
        );
        updatedData = result.threatData;
        added = result.added;
        removed = result.removed;
        updated = result.updated;
      }

      updatedData.lastModified = new Date().toISOString();

      return {
        success: true,
        added,
        removed,
        updated,
        threatData: updatedData,
      };
    } catch (error) {
      return {
        success: false,
        added: 0,
        removed: 0,
        updated: 0,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    }
  }

  private syncThreatsPerElement(
    project: ThreatProjectData,
    threatData: ThreatData,
    syncStatus: ThreatSyncStatus,
    removeOrphaned: boolean,
    updateReferences: boolean
  ): {
    threatData: ThreatData;
    added: number;
    removed: number;
    updated: number;
  } {
    let tables = [...(threatData.perElementTables || [])];
    const elements = project.dfdElements || [];
    let added = 0;
    let removed = 0;
    let updated = 0;

    // Build Trust Boundary lookup for name updates
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const trustBoundaryById = new Map(trustBoundaries.map((tb) => [tb.id, tb]));

    // Update Trust Boundary names in tables
    tables = tables.map((table) => {
      if (!table.trustBoundaryId) return table;

      const tb = trustBoundaryById.get(table.trustBoundaryId);
      if (tb && tb.name !== table.trustBoundaryName) {
        updated++;
        return {
          ...table,
          trustBoundaryName: tb.name,
        };
      }
      return table;
    });

    // Update changed references
    if (updateReferences && syncStatus.changedReferences.elements.length > 0) {
      const changeMap = new Map(
        syncStatus.changedReferences.elements.map((c) => [c.threatId, c])
      );

      tables = tables.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          const change = changeMap.get(threat.id);
          if (change && threat.linkedElement) {
            updated++;

            // Update threat ID if displayId changed (for DataFlow elements)
            let newThreatId = threat.id;
            if (
              change.newRef.type === "DataFlow" &&
              change.changes.includes("id") &&
              threat.linkedElement.displayId &&
              change.newRef.displayId
            ) {
              // Replace old displayId with new in threat ID
              // e.g., DF-1-T-1 → DF-1a-T-1
              const oldId = threat.linkedElement.displayId.replace(/^DF-/i, "");
              const newId = change.newRef.displayId.replace(/^DF-/i, "");
              newThreatId = threat.id.replace(`${oldId}-`, `${newId}-`);
            }

            return {
              ...threat,
              id: newThreatId,
              linkedElement: {
                elementId: threat.linkedElement.elementId, // Keep XML ID (stable)
                elementName: change.newRef.name,
                elementType: change.newRef.type,
                displayId: change.newRef.displayId, // Update displayId
              },
              lastModified: new Date().toISOString(),
            };
          }
          return threat;
        }),
      }));
    }

    // Remove orphaned threats if requested
    if (removeOrphaned && syncStatus.orphanedThreats.threatIds.length > 0) {
      const orphanedSet = new Set(syncStatus.orphanedThreats.threatIds);
      tables = tables.map((table) => ({
        ...table,
        threats: table.threats.filter((t) => {
          if (orphanedSet.has(t.id)) {
            removed++;
            return false;
          }
          return true;
        }),
      }));
    }

    // Generate threats for missing elements
    if (
      syncStatus.missingInThreats.elements.length > 0 ||
      syncStatus.missingInThreats.dataFlows.length > 0
    ) {
      const allElements = project.dfdElements || [];
      const connections = project.dfdConnections || [];

      // IMPORTANT: Pass ALL elements (including Trust Boundaries)
      // but generateThreatsPerElement will only create threats for missing ones
      // because existing elements already have threats
      const newThreatsResult = this.generateThreatsPerElement(
        allElements, // <-- Changed from missingInThreats.elements
        connections // <-- Changed from missingInThreats.dataFlows
      );

      // Filter to only keep threats for missing elements/dataflows
      const missingElementIds = new Set(
        syncStatus.missingInThreats.elements.map((e) => e.id)
      );
      const missingDataFlowIds = new Set(
        syncStatus.missingInThreats.dataFlows.map((df) => df.id)
      );

      for (const newTable of newThreatsResult.tables) {
        const existingTable = tables.find(
          (t) => t.trustBoundaryId === newTable.trustBoundaryId
        );

        // Filter new threats to only those for missing elements
        const threatsForMissing = newTable.threats.filter((threat) => {
          if (!threat.linkedElement) return false;
          const elemId = threat.linkedElement.elementId;
          return (
            missingElementIds.has(elemId) || missingDataFlowIds.has(elemId)
          );
        });

        if (existingTable) {
          existingTable.threats = [
            ...existingTable.threats,
            ...threatsForMissing,
          ];
          added += threatsForMissing.length;
        } else if (threatsForMissing.length > 0) {
          tables.push({ ...newTable, threats: threatsForMissing });
          added += threatsForMissing.length;
        }
      }
    }

    return {
      threatData: { ...threatData, perElementTables: tables },
      added,
      removed,
      updated,
    };
  }

  private syncThreatsPerInteraction(
    project: ThreatProjectData,
    threatData: ThreatData,
    syncStatus: ThreatSyncStatus,
    removeOrphaned: boolean,
    updateReferences: boolean,
    configuration: ThreatConfiguration
  ): {
    threatData: ThreatData;
    added: number;
    removed: number;
    updated: number;
  } {
    let tables = [...(threatData.perInteractionTables || [])];
    const elements = project.dfdElements || [];
    let added = 0;
    let removed = 0;
    let updated = 0;

    // Build element lookup for updating source/target names
    const elementById = new Map(elements.map((e) => [e.id, e]));

    // Build Trust Boundary lookup for name updates
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const trustBoundaryById = new Map(trustBoundaries.map((tb) => [tb.id, tb]));

    // Update Trust Boundary names in tables (BUT NOT for Interface tables)
    tables = tables.map((table) => {
      if (!table.trustBoundaryId) return table;

      // Skip interface tables - they have special naming "Physical Interfaces [TB-X]"
      if (isInterfaceTable(table)) return table;

      const tb = trustBoundaryById.get(table.trustBoundaryId);
      if (tb && tb.name !== table.trustBoundaryName) {
        updated++;
        return {
          ...table,
          trustBoundaryName: tb.name,
        };
      }
      return table;
    });

    // Update source/target names in DataFlow threats when elements change
    // This handles cases where Process/ExternalEntity names change but connections don't
    tables = tables.map((table) => ({
      ...table,
      threats: table.threats.map((threat) => {
        if (!threat.dataFlow) return threat;

        const sourceElem = elementById.get(threat.dataFlow.sourceId);
        const targetElem = elementById.get(threat.dataFlow.targetId);

        const sourceChanged =
          sourceElem && sourceElem.name !== threat.dataFlow.sourceName;
        const targetChanged =
          targetElem && targetElem.name !== threat.dataFlow.targetName;

        if (sourceChanged || targetChanged) {
          updated++;
          return {
            ...threat,
            dataFlow: {
              ...threat.dataFlow,
              sourceName: sourceElem?.name || threat.dataFlow.sourceName,
              targetName: targetElem?.name || threat.dataFlow.targetName,
            },
            lastModified: new Date().toISOString(),
          };
        }
        return threat;
      }),
    }));

    // Update changed interface/element references
    if (updateReferences && syncStatus.changedReferences.elements.length > 0) {
      const changeMap = new Map(
        syncStatus.changedReferences.elements.map((c) => [c.threatId, c])
      );

      tables = tables.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          const change = changeMap.get(threat.id);
          if (change && threat.linkedElement) {
            updated++;
            return {
              ...threat,
              linkedElement: {
                elementId: threat.linkedElement.elementId, // Keep XML ID (stable)
                elementName: change.newRef.name,
                elementType: change.newRef.type,
                displayId: change.newRef.displayId, // Update displayId
              },
              lastModified: new Date().toISOString(),
            };
          }
          return threat;
        }),
      }));
    }

    // Update changed data flow references
    if (updateReferences && syncStatus.changedReferences.dataFlows.length > 0) {
      const changeMap = new Map(
        syncStatus.changedReferences.dataFlows.map((c) => [c.threatId, c])
      );

      tables = tables.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          const change = changeMap.get(threat.id);
          if (change && threat.dataFlow) {
            updated++;

            // Get updated source/target info
            const sourceElem = elementById.get(change.newRef.from);
            const targetElem = elementById.get(change.newRef.to);

            // Extract formatted DataFlow ID - preserve existing if new one can't be determined
            const newDataFlowId = this.extractDataFlowIdFromConnection(
              change.newRef,
              threat.dataFlow.dataFlowId
            );
            const oldDataFlowId = threat.dataFlow.dataFlowId;

            // Update threat ID if DataFlow ID changed
            let newThreatId = threat.id;
            if (oldDataFlowId !== newDataFlowId) {
              // Both IDs are without DF- prefix: "2" or "xx"
              // Replace: MTB-2-S-IN-1 → MTB-3-S-IN-1
              newThreatId = threat.id.replace(`-${oldDataFlowId}-`, `-${newDataFlowId}-`);
            }

            return {
              ...threat,
              id: newThreatId,
              dataFlow: {
                connectionId: change.newRef.id, // Preserve/update stable XML ID
                dataFlowId: newDataFlowId,
                dataFlowName:
                  change.newRef.label || threat.dataFlow.dataFlowName,
                sourceId: change.newRef.from,
                sourceName: sourceElem?.name || threat.dataFlow.sourceName,
                sourceType: sourceElem?.type || threat.dataFlow.sourceType,
                targetId: change.newRef.to,
                targetName: targetElem?.name || threat.dataFlow.targetName,
                targetType: targetElem?.type || threat.dataFlow.targetType,
              },
              lastModified: new Date().toISOString(),
            };
          }
          return threat;
        }),
      }));
    }

    // Remove orphaned threats if requested
    if (removeOrphaned && syncStatus.orphanedThreats.threatIds.length > 0) {
      const orphanedSet = new Set(syncStatus.orphanedThreats.threatIds);
      tables = tables.map((table) => ({
        ...table,
        threats: table.threats.filter((t) => {
          if (orphanedSet.has(t.id)) {
            removed++;
            return false;
          }
          return true;
        }),
      }));
    }

    // Generate threats for missing data flows and interfaces
    if (
      syncStatus.missingInThreats.dataFlows.length > 0 ||
      syncStatus.missingInThreats.elements.length > 0
    ) {
      const connections = project.dfdConnections || [];

      // Build set of missing connection IDs for filtering later
      const missingConnectionIds = new Set(
        syncStatus.missingInThreats.dataFlows.map((df) => df.id)
      );
      const missingInterfaceIds = new Set(
        syncStatus.missingInThreats.elements.map((e) => e.id)
      );

      // IMPORTANT: Pass ALL connections so DF numbers are calculated correctly
      // If we only pass missing connections, DF-4 becomes DF-1
      const newThreatsResult = this.generateThreatsPerInteraction(
        elements, // All elements (includes interfaces)
        connections, // <-- Changed: ALL connections, not just missing
        configuration
      );

      // Filter to only keep threats for missing dataflows and interfaces
      for (const newTable of newThreatsResult.tables) {
        const existingTable = tables.find(
          (t) => t.trustBoundaryId === newTable.trustBoundaryId
        );

        // Filter new threats to only those for missing connections or interfaces
        const threatsForMissing = newTable.threats.filter((threat) => {
          if (threat.dataFlow) {
            // DataFlow threat - check if connection is missing
            const connId = threat.dataFlow.connectionId;
            return connId ? missingConnectionIds.has(connId) : false;
          } else if (threat.linkedElement) {
            // Interface threat - check if interface is missing
            return missingInterfaceIds.has(threat.linkedElement.elementId);
          }
          return false;
        });

        if (existingTable) {
          existingTable.threats = [
            ...existingTable.threats,
            ...threatsForMissing,
          ];
          added += threatsForMissing.length;
        } else if (threatsForMissing.length > 0) {
          tables.push({ ...newTable, threats: threatsForMissing });
          added += threatsForMissing.length;
        }
      }
    }

    return {
      threatData: { ...threatData, perInteractionTables: tables },
      added,
      removed,
      updated,
    };
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