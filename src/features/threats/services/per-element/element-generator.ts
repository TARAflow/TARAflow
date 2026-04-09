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

    // ==================== ASSET INDEX ====================
    // Build reverse index: elementId -> assetIds[]
    // Source: assetDataRef.assets[].linkedDFDElements
    const elementToAssets = new Map<string, string[]>();
    if (project.assetDataRef) {
      for (const asset of project.assetDataRef.assets) {
        for (const elementId of asset.linkedElementIds ?? []) {
          const existing = elementToAssets.get(elementId) ?? [];
          existing.push(asset.id);
          elementToAssets.set(elementId, existing);
        }
      }
    }

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
        elementToAssets,
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
    // Internal DFs are merged into their TB table; cross-boundary DFs get own table.
    const { tbThreats, crossBoundaryThreats } =
      this.generateDataFlowThreatsGrouped(graph, catalog, elementToAssets);

    // Merge internal DF threats into existing TB tables
    for (const table of tables) {
      if (!table.trustBoundaryId) continue;
      const dfThreats = tbThreats.get(table.trustBoundaryId);
      if (dfThreats && dfThreats.length > 0) {
        table.threats = [...table.threats, ...dfThreats];
      }
    }

    // Also create TB tables for TBs that only have DFs (no other elements)
    for (const [tbId, dfThreats] of tbThreats) {
      if (tables.some((t) => t.trustBoundaryId === tbId)) continue;
      const tb = graph.elementsById.get(tbId);
      if (!tb) continue;
      tables.push({
        trustBoundaryId: tbId,
        trustBoundaryName: tb.name,
        displayIdentifier: `[${tb.displayId}]`,
        threats: dfThreats,
      });
    }

    if (crossBoundaryThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "Data Flows",
        displayIdentifier: "[DF]",
        threats: crossBoundaryThreats,
      });
    }

    // ==================== EXTERNAL ENTITIES TABLE ====================
    const externalEntityThreats = this.generateExternalEntityThreats(
      graph,
      catalog,
      elementToAssets,
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
    elementToAssets?: Map<string, string[]>,
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
        elementToAssets,
      );

      threats.push(...elementThreats);
    }

    return threats;
  }

  /**
   * Generate threats for Data Flows from graph.
   * Returns threats grouped by TB: internal DFs go into their TB bucket,
   * cross-boundary DFs go into the "Data Flows" fallback bucket.
   */
  generateDataFlowThreatsGrouped(
    graph: DFDGraphReference,
    catalog: { threatTemplates: ThreatTemplate[] },
    elementToAssets?: Map<string, string[]>,
  ): { tbThreats: Map<string, Threat[]>; crossBoundaryThreats: Threat[] } {
    const tbThreats = new Map<string, Threat[]>();
    const crossBoundaryThreats: Threat[] = [];

    for (const connection of graph.connectionsById.values()) {
      const dataFlowElement: DFDElementReference = {
        id: connection.id,
        type: "DataFlow",
        name: connection.name || connection.label || connection.id,
        displayId: connection.displayId,
      };

      // Determine if source and target share exactly one TB
      const sourceTBs = graph.elementTrustBoundaries.get(connection.from) ?? [];
      const targetTBs = graph.elementTrustBoundaries.get(connection.to) ?? [];
      const sharedTBs = sourceTBs.filter((tb) => targetTBs.includes(tb));

      if (sharedTBs.length === 1) {
        // Internal DF — belongs to this TB
        const tbId = sharedTBs[0];
        const tb = graph.elementsById.get(tbId);
        const threats = this.generateThreatsForElement(
          dataFlowElement,
          tbId,
          tb?.name ?? "Unknown",
          tb?.displayId ?? "",
          catalog,
          elementToAssets,
        );
        const existing = tbThreats.get(tbId) ?? [];
        tbThreats.set(tbId, [...existing, ...threats]);
      } else {
        // Cross-boundary or unassigned DF — goes to fallback table
        const threats = this.generateThreatsForElement(
          dataFlowElement,
          null,
          "Data Flows",
          "",
          catalog,
          elementToAssets,
        );
        crossBoundaryThreats.push(...threats);
      }
    }

    return { tbThreats, crossBoundaryThreats };
  }

  /**
   * Generate threats for External Entities from graph
   * All External Entities go into separate table
   */
  private generateExternalEntityThreats(
    graph: DFDGraphReference,
    catalog: { threatTemplates: ThreatTemplate[] },
    elementToAssets?: Map<string, string[]>,
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
        elementToAssets,
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
    elementToAssets?: Map<string, string[]>,
  ): Threat[] {
    const threats: Threat[] = [];

    for (const element of elements) {
      const elementThreats = this.generateThreatsForElement(
        element,
        trustBoundaryId,
        trustBoundaryName,
        trustBoundaryDisplayId,
        catalog,
        elementToAssets,
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
    elementToAssets?: Map<string, string[]>,
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
        elementToAssets,
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
    elementToAssets?: Map<string, string[]>,
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

    // Link assets via reverse index
    threat.linkedAssetIds = elementToAssets?.get(element.id) ?? [];

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