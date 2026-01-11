// ==================== ELEMENT THREAT GENERATOR ====================
// Single Responsibility: Generate threats using STRIDE per-element method

import type { StrideCategory } from "shared";
import type {
  Threat,
  ThreatTable,
  ThreatTemplate,
  ThreatProjectData,
  DFDElementReference,
  DFDConnectionReference,
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
   * Generate threats for all elements in project
   */
  generateThreatsForProject(
    project: ThreatProjectData,
    catalog: { threatTemplates: ThreatTemplate[] }
  ): ThreatTable[] {
    const elements = project.dfdElements || [];
    const connections = project.dfdConnections || [];
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const tables: ThreatTable[] = [];

    // Generate table for each trust boundary
    for (const tb of trustBoundaries) {
      const elementsInBoundary = this.getElementsInTrustBoundary(
        elements,
        tb.id
      );

      if (elementsInBoundary.length === 0) continue;

      const tbId = this.extractTBIdentifier(tb.name, 0);

      const threats = this.generateThreatsForElements(
        elementsInBoundary,
        tb.id,
        tb.name,
        catalog
      );

      if (threats.length > 0) {
        tables.push({
          trustBoundaryId: tb.id,
          trustBoundaryName: tb.name,
          displayIdentifier: `[${tbId}]`,
          threats,
        });
      }
    }

    // Generate table for dataflows
    const dataFlowElements = this.getDataFlowsForElements(connections);
    const dfThreats = this.generateThreatsForElements(
      dataFlowElements,
      null,
      "Data Flows",
      catalog
    );
    if (dfThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "Data Flows",
        displayIdentifier: "[DF]",
        threats: dfThreats,
      });
    }

    // Generate table for external entities (outside trust boundaries)
    const externalEntities = elements.filter(
      (e) => e.type === "ExternalEntity"
    );
    if (externalEntities.length > 0) {
      const threats = this.generateThreatsForElements(
        externalEntities,
        null,
        "External Entities",
        catalog
      );
      if (threats.length > 0) {
        tables.push({
          trustBoundaryId: null,
          trustBoundaryName: "External Entities",
          displayIdentifier: `[EE]`,
          threats,
        });
      }
    }

    return tables;
  }

  /**
   * Extract the trust boundary id from name [TB]
   */
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

  private getDataFlowsForElements(
    connections: DFDConnectionReference[]
  ): DFDElementReference[] {
    return connections.map((conn) => ({
      id: conn.id,
      type: "DataFlow",
      name: conn.label || conn.id,
      displayId: conn.displayId,
      position: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
    }));
  }

  /**
   * Generate threats for multiple elements
   */
  private generateThreatsForElements(
    elements: DFDElementReference[],
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    catalog: { threatTemplates: ThreatTemplate[] }
  ): Threat[] {
    const threats: Threat[] = [];

    for (const element of elements) {
      const elementThreats = this.generateThreatsForElement(
        element,
        trustBoundaryId,
        trustBoundaryName,
        catalog
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
    catalog: { threatTemplates: ThreatTemplate[] }
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
        isInterface,
        catalog
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
    isInterface: boolean,
    catalog: { threatTemplates: ThreatTemplate[] }
  ): Threat {
    // Generate threat ID
    const threatId = isInterface
      ? generateThreatIdForInterface(
          trustBoundaryId || "TB-EXT",
          element.displayId || element.id,
          strideCategory,
          1
        )
      : generateThreatIdPerElement(
          element.displayId || element.id,
          strideCategory,
          1
        );

    // Create base threat
    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName
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
      catalog.threatTemplates
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
    templates: ThreatTemplate[]
  ): ThreatTemplate | undefined {
    return templates.find(
      (t) =>
        t.strideCategory === strideCategory &&
        t.elementTypes.includes(elementType)
    );
  }

  /**
   * Get elements within a trust boundary
   */
  private getElementsInTrustBoundary(
    elements: DFDElementReference[],
    trustBoundaryId: string
  ): DFDElementReference[] {
    // Filter applicable elements (not trust boundaries themselves)
    return elements.filter((e) => {
      if (e.type === "TrustBoundary") return false;
      if (e.type === "ExternalEntity") return false; // External entities in separate table

      // Check if element has applicable STRIDE categories
      const applicableStride = STRIDE_PER_ELEMENT_TYPE[e.type];
      if (!applicableStride || applicableStride.length === 0) return false;

      // TODO: Add proper boundary membership logic
      // For now, include all applicable elements
      return true;
    });
  }
}

// ==================== EXPORT SINGLETON ====================

export const elementThreatGenerator = new ElementThreatGenerator();