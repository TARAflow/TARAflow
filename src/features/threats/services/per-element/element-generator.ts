// ==================== ELEMENT THREAT GENERATOR ====================
// Single Responsibility: Generate threats using STRIDE per-element method
// Now using DFDGraph for efficient element analysis

import type { StrideCategory } from "shared";
import type {
  Threat,
  ThreatTable,
  ThreatTemplate,
  ThreatProjectData,
  DFDElementReference,
  DFDGraphReference,
} from "../../models/threat-types";
import {
  LinkedDFDElement,
  STRIDE_PER_ELEMENT_TYPE,
  generateThreatIdPerElement,
  generateThreatIdForInterface,
} from "../../models/per-element-types";
import { createEmptyThreat } from "../../models/threat-types";

// ==================== ELEMENT THREAT GENERATOR ====================

export class ElementThreatGenerator {
  /**
   * Generate threats for all elements in project using DFDGraph
   */
  generateThreatsForProject(
    project: ThreatProjectData,
    catalog: { threatTemplates: ThreatTemplate[] },
  ): ThreatTable[] {
    // Early exit if no graph
    if (!project.dfdGraph) {
      return [];
    }

    const graph = project.dfdGraph;
    const tables: ThreatTable[] = [];

    // ==================== TRUST BOUNDARY TABLES ====================
    // Generate one table per trust boundary
    for (const [trustBoundaryId, elementIds] of graph.trustBoundaryElements) {
      const trustBoundary = graph.elementsById.get(trustBoundaryId);
      if (!trustBoundary) continue;

      // Filter for elements with applicable STRIDE categories
      const applicableElements = elementIds
        .map((id) => graph.elementsById.get(id))
        .filter((el): el is NonNullable<typeof el> => {
          if (!el) return false;

          // Skip Trust Boundaries and External Entities
          if (el.type === "TrustBoundary" || el.type === "ExternalEntity") {
            return false;
          }

          // Check if element has applicable STRIDE categories
          const applicableStride = STRIDE_PER_ELEMENT_TYPE[el.type];
          return applicableStride && applicableStride.length > 0;
        });

      if (applicableElements.length === 0) continue;

      const threats = this.generateThreatsForElements(
        applicableElements,
        trustBoundaryId,
        trustBoundary.name,
        trustBoundary.displayId ?? "",
        catalog,
      );

      if (threats.length > 0) {
        tables.push({
          trustBoundaryId: trustBoundaryId,
          trustBoundaryName: trustBoundary.name,
          displayIdentifier: `[${trustBoundary.displayId}]`,
          threats,
        });
      }
    }

    // ==================== DATA FLOWS TABLE ====================
    const dataFlowThreats = this.generateDataFlowThreats(graph, catalog);
    if (dataFlowThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "Data Flows",
        displayIdentifier: "[DF]",
        threats: dataFlowThreats,
      });
    }

    // ==================== EXTERNAL ENTITIES TABLE ====================
    const externalEntityThreats = this.generateExternalEntityThreats(
      graph,
      catalog,
    );
    if (externalEntityThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "External Entities",
        displayIdentifier: "[EE]",
        threats: externalEntityThreats,
      });
    }

    // ==================== PHYSICAL INTERFACES TABLE ====================
    // Interfaces without Trust Boundary assignment
    const interfaceThreats = this.generateInterfacesWithoutTB(graph, catalog);
    if (interfaceThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "Physical Interfaces",
        displayIdentifier: "[IF]",
        threats: interfaceThreats,
      });
    }

    return tables;
  }

  /**
   * Generate threats for Interfaces without Trust Boundary from graph
   */
  private generateInterfacesWithoutTB(
    graph: DFDGraphReference,
    catalog: { threatTemplates: ThreatTemplate[] },
  ): Threat[] {
    const threats: Threat[] = [];

    for (const element of graph.elementsById.values()) {
      // Only Interfaces
      if (
        element.type !== "Interface" &&
        element.type !== "PhysicalInterface"
      ) {
        continue;
      }

      // Only those WITHOUT effective TB
      const effectiveTB = graph.effectiveElementTrustBoundary.get(element.id);
      if (effectiveTB !== undefined) {
        continue; // This interface has a TB, will be in TB table
      }

      const elementThreats = this.generateThreatsForElement(
        element,
        null, // No trust boundary
        "Physical Interfaces",
        "",
        catalog,
      );

      threats.push(...elementThreats);
    }

    return threats;
  }

  /**
   * Generate threats for Data Flows from graph
   */
  private generateDataFlowThreats(
    graph: DFDGraphReference,
    catalog: { threatTemplates: ThreatTemplate[] },
  ): Threat[] {
    const threats: Threat[] = [];

    for (const connection of graph.connectionsById.values()) {
      const dataFlowElement: DFDElementReference = {
        id: connection.id,
        type: "DataFlow",
        name: connection.label || connection.id,
        displayId: connection.displayId,
      };

      const elementThreats = this.generateThreatsForElement(
        dataFlowElement,
        null,
        "Data Flows",
        "",
        catalog,
      );

      threats.push(...elementThreats);
    }

    return threats;
  }

  /**
   * Generate threats for External Entities from graph
   * All External Entities go into separate table
   */
  private generateExternalEntityThreats(
    graph: DFDGraphReference,
    catalog: { threatTemplates: ThreatTemplate[] },
  ): Threat[] {
    const threats: Threat[] = [];

    for (const element of graph.elementsById.values()) {
      if (element.type !== "ExternalEntity") continue;

      const elementThreats = this.generateThreatsForElement(
        element,
        null,
        "External Entities",
        "",
        catalog,
      );

      threats.push(...elementThreats);
    }

    return threats;
  }

  /**
   * Generate threats for multiple elements
   */
  private generateThreatsForElements(
    elements: DFDElementReference[],
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    catalog: { threatTemplates: ThreatTemplate[] },
  ): Threat[] {
    const threats: Threat[] = [];

    for (const element of elements) {
      const elementThreats = this.generateThreatsForElement(
        element,
        trustBoundaryId,
        trustBoundaryName,
        trustBoundaryDisplayId,
        catalog,
      );
      threats.push(...elementThreats);
    }

    return threats;
  }

  /**
   * Generate threats for a single element
   */
  private generateThreatsForElement(
    element: DFDElementReference,
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    catalog: { threatTemplates: ThreatTemplate[] },
  ): Threat[] {
    const threats: Threat[] = [];
    const applicableStride = STRIDE_PER_ELEMENT_TYPE[element.type] || [];

    const isInterface =
      element.type === "Interface" || element.type === "PhysicalInterface";

    for (const strideCategory of applicableStride) {
      const threat = this.createThreatForElement(
        element,
        strideCategory,
        trustBoundaryId,
        trustBoundaryName,
        trustBoundaryDisplayId,
        isInterface,
        catalog,
      );

      threats.push(threat);
    }

    return threats;
  }

  /**
   * Create a single threat for an element
   */
  private createThreatForElement(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    isInterface: boolean,
    catalog: { threatTemplates: ThreatTemplate[] },
  ): Threat {
    // Generate threat ID
    const threatId = isInterface
      ? generateThreatIdForInterface(
          trustBoundaryDisplayId || "TB-EXT",
          element.displayId || element.id,
          strideCategory,
          1,
        )
      : generateThreatIdPerElement(
          element.displayId || element.id,
          strideCategory,
          1,
        );

    // Create base threat
    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName,
      trustBoundaryDisplayId,
    );

    // Link element
    threat.linkedElement = {
      elementId: element.id,
      elementName: element.name,
      elementType: element.type,
      displayId: element.displayId,
    } as LinkedDFDElement;

    // Apply template from catalog if available
    const template = this.findTemplateForElement(
      element.type,
      strideCategory,
      catalog.threatTemplates,
    );

    if (template) {
      threat.threatDescription = template.threat;
      threat.attackDescription = template.attack;
      threat.source = "auto";
    }

    return threat;
  }

  /**
   * Find template for element type and STRIDE category
   */
  private findTemplateForElement(
    elementType: string,
    strideCategory: StrideCategory,
    templates: ThreatTemplate[],
  ): ThreatTemplate | undefined {
    return templates.find(
      (t) =>
        t.strideCategory === strideCategory &&
        t.elementTypes.includes(elementType),
    );
  }
}

// ==================== EXPORT SINGLETON ====================

export const elementThreatGenerator = new ElementThreatGenerator();