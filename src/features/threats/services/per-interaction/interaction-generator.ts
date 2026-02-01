// ==================== INTERACTION THREAT GENERATOR ====================
// Single Responsibility: Generate threats using STRIDE per-interaction method

import type { StrideCategory } from "shared";
import type {
  Threat,
  ThreatTable,
  ThreatProjectData,
  DFDGraphReference,
  DFDElementReference,
  DFDConnectionReference,
  DataFlowAnalysisReference,
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
import { DFDAnalysisContext } from "shared";

// ==================== INTERACTION THREAT GENERATOR ====================

export class InteractionThreatGenerator {
  /**
   * Generate threats for all data flows in project
   */
  generateThreatsForProject(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
  ): ThreatTable[] {
    const elements = project.dfdElements || [];
    const connections = project.dfdConnections || [];
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const tables: ThreatTable[] = [];
    const graph = project.dfdGraph;
    const localDfdContext = dfdContext;

    if (!graph) return [];

    // Generate table for each trust boundary
    for (const tb of trustBoundaries) {
      const threats: Threat[] = [];

      // 1️⃣ DataFlow-Threats für alle Flows, die diese Trust Boundary berühren
      const flows = Array.from(graph.dataFlowAnalysis.values()).filter(
        (flow) =>
          flow.fromEffectiveTrustBoundary === tb.id ||
          flow.toEffectiveTrustBoundary === tb.id,
      );

      threats.push(
        ...this.generateDataFlowThreatsFromGraph(
          localDfdContext,
          tb.id,
          tb.name,
          tb.displayId,
        ),
      );

      // 2️⃣ Interface-Threats innerhalb dieser Boundary
      const interfaces = Array.from(graph.elementsById.values())
        .filter((e) => e.type === "Interface")
        .filter((e) => graph.effectiveElementTrustBoundary.get(e.id) === tb.id);

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
    //     for (const tb of trustBoundaries) {
    //       const threats: Threat[] = [];
    // console.debug("generateThreatsForProject ", tb);
    //       // Generate threats for data flows crossing this boundary
    //       const dataFlowThreats = this.generateDataFlowThreats(
    //         connections,
    //         elements,
    //         tb.id,
    //         tb.name,
    //         tb.displayId ?? ""
    //       );
    //       threats.push(...dataFlowThreats);

    //       // Generate threats for interfaces in this boundary
    //       const interfaceThreats = this.generateInterfaceThreats(
    //         elements,
    //         tb.id ?? "",
    //         tb.name,
    //         tb.displayId ?? ""
    //       );
    //       threats.push(...interfaceThreats);

    //       if (threats.length > 0) {
    //         tables.push({
    //           trustBoundaryId: tb.id,
    //           trustBoundaryName: tb.name,
    //           displayIdentifier: `[${tb.displayId}]`,
    //           threats,
    //         });
    //       }
    //     }

    return tables;
  }

  /**
   * Generate threats for data flows
   */
  private generateDataFlowThreats(
    connections: DFDConnectionReference[],
    elements: DFDElementReference[],
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
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
          trustBoundaryDisplayId,
          crossesTrustBoundary,
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
          trustBoundaryDisplayId,
          crossesTrustBoundary,
        );
        threats.push(outgoingThreat);
      }
    }

    return threats;
  }

  private generateDataFlowThreatsFromGraph(
    context: DFDAnalysisContext,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
  ): Threat[] {
    const threats: Threat[] = [];

    // Alle DataFlows aus dem Context filtern, die die TrustBoundary betreffen
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
   * Create a single data flow threat
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
    const displayId = dataFlow.connectionId; // wir nehmen die ID aus dem Graph
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
      dataFlowName: `DataFlow ${displayId}`, // Label aus DataFlowAnalysis gibt es nicht, ggf. optional
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

  private createDataFlowThreat(
    connection: DFDConnectionReference,
    source: DFDElementReference,
    target: DFDElementReference,
    strideCategory: StrideCategory,
    direction: InteractionDirection,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    crossesTrustBoundary: boolean,
  ): Threat {
    // ✅ Use displayId if available, otherwise fall back to id
    const displayId = connection.displayId || connection.id;

    // ✅ Extract pure number part (remove "DF-" prefix if present)
    const dataFlowNumber = displayId.replace(/^DF-/, "");

    // ✅ Construct ID part for threat ID (always "DF" + number)
    const dataFlowIdPart = `DF${dataFlowNumber}`;

    console.log(
      `Creating DataFlow Threat: tbid=${trustBoundaryDisplayId} displayId=${displayId}, number=${dataFlowNumber}, idPart=${dataFlowIdPart}`,
    );

    // Generate threat ID
    const threatId = generateThreatIdPerInteraction(
      trustBoundaryDisplayId,
      dataFlowIdPart,
      strideCategory,
      direction,
      1,
    );

    // Create interaction context
    const interactionContext = createInteractionContext(
      direction,
      crossesTrustBoundary,
    );

    // Create base threat
    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName,
      trustBoundaryDisplayId,
      interactionContext,
    );

    // Set data flow reference
    threat.dataFlow = {
      connectionId: connection.id,
      dataFlowId: displayId, // ✅ Store complete displayId (e.g., "DF-1")
      dataFlowName: connection.label || `DataFlow ${displayId}`,
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
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
  ): Threat[] {
    const threats: Threat[] = [];
    const interfaces = elements.filter(
      (e) => e.type === "Interface" || e.type === "PhysicalInterface",
    );

    for (const iface of interfaces) {
      for (const strideCategory of STRIDE_PER_INTERACTION) {
        const threat = this.createInterfaceThreat(
          iface,
          strideCategory,
          trustBoundaryId,
          trustBoundaryName,
          trustBoundaryDisplayId,
        );
        threats.push(threat);
      }
    }

    return threats;
  }

  private generateInterfaceThreatsFromGraph(
    graph: DFDGraphReference,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
  ): Threat[] {
    const threats: Threat[] = [];

    for (const [, element] of graph.elementsById) {
      if (element.type !== "Interface" && element.type !== "PhysicalInterface")
        continue;

      // Prüfen, ob Element in dieser TB ist
      const effectiveTB = graph.effectiveElementTrustBoundary.get(element.id);
      if (effectiveTB !== trustBoundaryId) continue;

      for (const strideCategory of STRIDE_PER_INTERACTION) {
        threats.push(
          this.createInterfaceThreatFromGraph(
            element.id,
            strideCategory,
            graph,
          ),
        );
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
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
  ): Threat {
    // ✅ Use displayId if available, otherwise fall back to id
    const displayId = iface.displayId || iface.id;

    // ✅ Extract pure number part (remove "IF-" prefix if present)
    const interfaceNumber = displayId.replace(/^IF-/, "");

    // ✅ Construct ID part for threat ID (always "IF" + number)
    const interfaceIdPart = `IF${interfaceNumber}`;

    console.log(
      `Creating Interface Threat: displayId=${displayId}, number=${interfaceNumber}, idPart=${interfaceIdPart}`,
    );

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
      displayId: displayId, // ✅ Store complete displayId (e.g., "IF-1")
    };

    // Use default interface descriptions
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

  private createInterfaceThreatFromGraph(
    elementId: string,
    strideCategory: StrideCategory,
    graph: DFDGraphReference,
  ): Threat {
    const iface = graph.elementsById.get(elementId);
    if (!iface) {
      throw new Error(`Element with ID ${elementId} not found in graph`);
    }

    const displayId = iface.displayId || iface.id;
    const interfaceNumber = displayId.replace(/^IF-/, "");
    const interfaceIdPart = `IF${interfaceNumber}`;

    console.log(
      `Creating Interface Threat from Graph: displayId=${displayId}, number=${interfaceNumber}, idPart=${interfaceIdPart}`,
    );

    // Bestimme TrustBoundary-Daten aus dem Graphen, falls vorhanden
    const tbIds = graph.elementTrustBoundaries.get(elementId) || [];
    const effectiveTB = tbIds.length > 0 ? tbIds[tbIds.length - 1] : undefined;
    const tb = effectiveTB
      ? graph.trustBoundaryHierarchy.get(effectiveTB)
      : undefined;
    const trustBoundaryId = tb?.trustBoundaryId || null;
    const trustBoundaryName = iface.name; // Fallback: Element-Name, kann angepasst werden
    const trustBoundaryDisplayId = effectiveTB || displayId;

    // Generate threat ID
    const threatId = generateThreatIdPerInteraction(
      trustBoundaryDisplayId,
      interfaceIdPart,
      strideCategory,
      "incoming", // Interfaces nutzen incoming per Konvention
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

    // Optional: Default Interface Threat / Attack Beschreibung
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