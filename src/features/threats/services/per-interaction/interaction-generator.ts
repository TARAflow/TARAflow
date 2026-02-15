// ==================== INTERACTION THREAT GENERATOR ====================
// Single Responsibility: Generate threats using STRIDE per-interaction method
// Now using DFDGraph for efficient element analysis

import type { StrideCategory } from "shared";
import type {
  Threat,
  ThreatTable,
  ThreatProjectData,
  DFDGraphReference,
  DFDElementReference,
  DataFlowAnalysisReference,
} from "../../models/threat-types";
import {
  InteractionDirection,
  DataFlowReference,
  STRIDE_PER_INTERACTION,
  generateThreatIdPerInteraction,
  createInteractionContext,
  getDefaultInterfaceThreatDescription,
  getDefaultInterfaceAttackDescription,
} from "../../models/per-interaction-types";
import { createEmptyThreat } from "../../models/threat-types";
import { DFDAnalysisContext } from "shared";

// ==================== INTERACTION THREAT GENERATOR ====================

export class InteractionThreatGenerator {
  /**
   * Generate threats for all data flows in project using DFDGraph
   */
  generateThreatsForProject(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
  ): ThreatTable[] {
    // Early exit if no graph
    if (!project.dfdGraph) {
      return [];
    }

    const graph = project.dfdGraph;
    const tables: ThreatTable[] = [];

    // Get trust boundaries from graph
    const trustBoundaries = Array.from(graph.elementsById.values()).filter(
      (e) => e.type === "TrustBoundary",
    );

    // Generate table for each trust boundary
    for (const tb of trustBoundaries) {
      const threats: Threat[] = [];

      threats.push(
        ...this.generateDataFlowThreatsFromGraph(
          dfdContext,
          tb.id,
          tb.name,
          tb.displayId,
        ),
      );

      threats.push(
        ...this.generateInterfaceThreatsFromGraph(
          graph,
          tb.id,
          tb.name,
          tb.displayId,
        ),
      );

      if (threats.length > 0) {
        tables.push({
          trustBoundaryId: tb.id,
          trustBoundaryName: tb.name,
          displayIdentifier: `[${tb.displayId}]`,
          threats,
        });
      }
    }

    // ==================== PHYSICAL INTERFACES TABLE ====================
    // Interfaces without Trust Boundary assignment
    const interfaceThreats = this.generateInterfacesWithoutTB(graph);
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
  private generateInterfacesWithoutTB(graph: DFDGraphReference): Threat[] {
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

      // Generate threats for this interface (all 6 STRIDE categories)
      for (const strideCategory of STRIDE_PER_INTERACTION) {
        threats.push(
          this.createInterfaceThreatFromGraph(
            element.id,
            strideCategory,
            "", // No trust boundary
            "Physical Interfaces", // Table name
            "", // No TB display ID
            graph,
          ),
        );
      }
    }

    return threats;
  }

  /**
   * Generate threats for data flows
   */
  private generateDataFlowThreatsFromGraph(
    context: DFDAnalysisContext,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
  ): Threat[] {
    const threats: Threat[] = [];

    // All DataFlows from context that concern this TrustBoundary
    for (const df of context.getDataFlows()) {
      const crossesTB =
        df.fromEffectiveTrustBoundary === trustBoundaryId ||
        df.toEffectiveTrustBoundary === trustBoundaryId;

      if (!crossesTB) continue;

      const source = context.getElement(df.fromElementId);
      const target = context.getElement(df.toElementId);

      if (!source || !target) continue;

      for (const strideCategory of STRIDE_PER_INTERACTION) {
        // INCOMING Threat
        threats.push(
          this.createDataFlowThreatFromGraph(
            df,
            source,
            target,
            strideCategory,
            "incoming",
            trustBoundaryId,
            trustBoundaryName,
            trustBoundaryDisplayId,
          ),
        );

        // OUTGOING Threat
        threats.push(
          this.createDataFlowThreatFromGraph(
            df,
            source,
            target,
            strideCategory,
            "outgoing",
            trustBoundaryId,
            trustBoundaryName,
            trustBoundaryDisplayId,
          ),
        );
      }
    }

    return threats;
  }

  /**
   * Create a single data flow threat from graph
   */
  private createDataFlowThreatFromGraph(
    dataFlow: DataFlowAnalysisReference,
    source: DFDElementReference,
    target: DFDElementReference,
    strideCategory: StrideCategory,
    direction: InteractionDirection,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
  ): Threat {
    const displayId = dataFlow.connectionId;
    const dataFlowNumber = displayId.replace(/^DF-/, "");
    const dataFlowIdPart = `DF${dataFlowNumber}`;

    const threatId = generateThreatIdPerInteraction(
      trustBoundaryDisplayId,
      dataFlowIdPart,
      strideCategory,
      direction,
      1,
    );

    const interactionContext = createInteractionContext(
      direction,
      dataFlow.crossesTrustBoundary,
    );

    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName,
      trustBoundaryDisplayId,
      interactionContext,
    );

    threat.dataFlow = {
      connectionId: dataFlow.connectionId,
      dataFlowId: displayId,
      dataFlowName: `DataFlow ${displayId}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      targetId: target.id,
      targetName: target.name,
      targetType: target.type,
    } as DataFlowReference;

    threat.source = "auto";
    return threat;
  }

  /**
   * Generate threats for interfaces (PhysicalInterface/Interface) from graph
   */
  private generateInterfaceThreatsFromGraph(
    graph: DFDGraphReference,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
  ): Threat[] {
    const threats: Threat[] = [];

    for (const element of graph.elementsById.values()) {
      if (element.type !== "Interface" && element.type !== "PhysicalInterface")
        continue;

      // Check if element is in this TB
      const effectiveTB = graph.effectiveElementTrustBoundary.get(element.id);
      if (effectiveTB !== trustBoundaryId) continue;

      for (const strideCategory of STRIDE_PER_INTERACTION) {
        threats.push(
          this.createInterfaceThreatFromGraph(
            element.id,
            strideCategory,
            trustBoundaryId,
            trustBoundaryName,
            trustBoundaryDisplayId,
            graph,
          ),
        );
      }
    }

    return threats;
  }

  /**
   * Create a single interface threat from graph
   */
  private createInterfaceThreatFromGraph(
    elementId: string,
    strideCategory: StrideCategory,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    graph: DFDGraphReference,
  ): Threat {
    const iface = graph.elementsById.get(elementId);
    if (!iface) {
      throw new Error(`Element with ID ${elementId} not found in graph`);
    }

    const displayId = iface.displayId || iface.id;
    const interfaceNumber = displayId.replace(/^IF-/, "");
    const interfaceIdPart = `IF${interfaceNumber}`;

    // Generate threat ID
    const threatId = generateThreatIdPerInteraction(
      trustBoundaryDisplayId,
      interfaceIdPart,
      strideCategory,
      "incoming", // Interfaces use incoming by convention
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

    // Set linked element for interface
    threat.linkedElement = {
      elementId: iface.id,
      elementName: iface.name,
      elementType: iface.type,
      displayId: displayId,
    };

    // Default Interface Threat / Attack Description
    threat.threatDescription = getDefaultInterfaceThreatDescription(
      strideCategory,
      iface.name,
      "en",
    );
    threat.attackDescription = getDefaultInterfaceAttackDescription(
      strideCategory,
      iface.name,
      "en",
    );
    threat.source = "auto";

    return threat;
  }
}

// ==================== EXPORT SINGLETON ====================

export const interactionThreatGenerator = new InteractionThreatGenerator();
