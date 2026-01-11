// ==================== INTERACTION THREAT GENERATOR ====================
// Single Responsibility: Generate threats using STRIDE per-interaction method

import type { StrideCategory } from "shared";
import type {
  Threat,
  ThreatTable,
  ThreatProjectData,
  DFDElementReference,
  DFDConnectionReference,
} from "../../models/threat-types";
import {
  InteractionContext,
  InteractionDirection,
  DataFlowReference,
  STRIDE_PER_INTERACTION,
  generateThreatIdPerInteraction,
  createInteractionContext,
  getDefaultInterfaceThreatDescription,
  getDefaultInterfaceAttackDescription,
} from "../../models/per-interaction-types";
import { createEmptyThreat } from "../../models/threat-types";

// ==================== INTERACTION THREAT GENERATOR ====================

export class InteractionThreatGenerator {
  /**
   * Generate threats for all data flows in project
   */
  generateThreatsForProject(project: ThreatProjectData): ThreatTable[] {
    const elements = project.dfdElements || [];
    const connections = project.dfdConnections || [];
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const tables: ThreatTable[] = [];

    // Generate table for each trust boundary
    for (const tb of trustBoundaries) {
      const threats: Threat[] = [];

      const tbId = this.extractTBIdentifier(tb.name, 0);

      // Generate threats for data flows crossing this boundary
      const dataFlowThreats = this.generateDataFlowThreats(
        connections,
        elements,
        tb.id,
        tb.name
      );
      threats.push(...dataFlowThreats);

      // Generate threats for interfaces in this boundary
      const interfaceThreats = this.generateInterfaceThreats(
        elements,
        tb.id,
        tb.name
      );
      threats.push(...interfaceThreats);

      if (threats.length > 0) {
        tables.push({
          trustBoundaryId: tb.id,
          trustBoundaryName: tb.name,
          displayIdentifier: `[${tbId}]`,
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

  /**
   * Generate threats for data flows
   */
  private generateDataFlowThreats(
    connections: DFDConnectionReference[],
    elements: DFDElementReference[],
    trustBoundaryId: string,
    trustBoundaryName: string
  ): Threat[] {
    const threats: Threat[] = [];
    const elementMap = new Map(elements.map((e) => [e.id, e]));

    for (const connection of connections) {
      const source = elementMap.get(connection.from);
      const target = elementMap.get(connection.to);

      if (!source || !target) continue;

      // Check if this data flow crosses the trust boundary
      // TODO: Implement proper boundary crossing logic
      const crossesTrustBoundary = true;

      // Generate threats for each STRIDE category
      for (const strideCategory of STRIDE_PER_INTERACTION) {
        // Generate INCOMING threat (attacker spoofs sender)
        const incomingThreat = this.createDataFlowThreat(
          connection,
          source,
          target,
          strideCategory,
          "incoming",
          trustBoundaryId,
          trustBoundaryName,
          crossesTrustBoundary
        );
        threats.push(incomingThreat);

        // Generate OUTGOING threat (attacker spoofs receiver)
        const outgoingThreat = this.createDataFlowThreat(
          connection,
          source,
          target,
          strideCategory,
          "outgoing",
          trustBoundaryId,
          trustBoundaryName,
          crossesTrustBoundary
        );
        threats.push(outgoingThreat);
      }
    }

    return threats;
  }

  /**
   * Create a single data flow threat
   */
  private createDataFlowThreat(
    connection: DFDConnectionReference,
    source: DFDElementReference,
    target: DFDElementReference,
    strideCategory: StrideCategory,
    direction: InteractionDirection,
    trustBoundaryId: string,
    trustBoundaryName: string,
    crossesTrustBoundary: boolean
  ): Threat {
    // Extract data flow ID (remove "DF-" prefix if present)
    const dataFlowId = (connection.displayId || connection.id).replace(
      /^DF-/,
      ""
    );

    // Generate threat ID
    const threatId = generateThreatIdPerInteraction(
      trustBoundaryId,
      dataFlowId,
      strideCategory,
      direction,
      1
    );

    // Create interaction context
    const interactionContext = createInteractionContext(
      direction,
      crossesTrustBoundary
    );

    // Create base threat
    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName,
      interactionContext
    );

    // Set data flow reference
    threat.dataFlow = {
      connectionId: connection.id,
      dataFlowId,
      dataFlowName: connection.label || `DataFlow ${dataFlowId}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      targetId: target.id,
      targetName: target.name,
      targetType: target.type,
    } as DataFlowReference;

    // Descriptions are empty - UI will use templates for localization
    threat.source = "auto";

    return threat;
  }

  /**
   * Generate threats for interfaces (PhysicalInterface/Interface)
   */
  private generateInterfaceThreats(
    elements: DFDElementReference[],
    trustBoundaryId: string,
    trustBoundaryName: string
  ): Threat[] {
    const threats: Threat[] = [];
    const interfaces = elements.filter(
      (e) => e.type === "Interface" || e.type === "PhysicalInterface"
    );

    for (const iface of interfaces) {
      for (const strideCategory of STRIDE_PER_INTERACTION) {
        const threat = this.createInterfaceThreat(
          iface,
          strideCategory,
          trustBoundaryId,
          trustBoundaryName
        );
        threats.push(threat);
      }
    }

    return threats;
  }

  /**
   * Create a single interface threat
   */
  private createInterfaceThreat(
    iface: DFDElementReference,
    strideCategory: StrideCategory,
    trustBoundaryId: string,
    trustBoundaryName: string
  ): Threat {
    // Generate threat ID
    const threatId = generateThreatIdPerInteraction(
      trustBoundaryId,
      `IF-${iface.displayId || iface.id}`,
      strideCategory,
      "incoming", // Interfaces use incoming by convention
      1
    );

    // Create base threat
    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName
    );

    // Set linked element for interface
    threat.linkedElement = {
      elementId: iface.id,
      elementName: iface.name,
      elementType: iface.type,
      displayId: iface.displayId,
    };

    // Use default interface descriptions
    threat.threatDescription = getDefaultInterfaceThreatDescription(
      strideCategory,
      iface.name,
      "en"
    );
    threat.attackDescription = getDefaultInterfaceAttackDescription(
      strideCategory,
      iface.name,
      "en"
    );
    threat.source = "auto";

    return threat;
  }
}

// ==================== EXPORT SINGLETON ====================

export const interactionThreatGenerator = new InteractionThreatGenerator();