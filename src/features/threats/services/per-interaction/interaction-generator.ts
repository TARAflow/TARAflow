// ==================== INTERACTION THREAT GENERATOR ====================
// STRIDE per-interaction: generates threats from sender AND/OR receiver perspective.
//
// Threat allocation rules:
//   Process-A (TB-A) → Process-B (TB-B):
//     Sender perspective  → TB-A (always)
//     Receiver perspective → TB-B (only if zeroTrustMode OR crossesTrustBoundary)
//
//   ExternalEntity → Process-B (TB-B):
//     EE has no TB → only receiver perspective → TB-B
//
//   Process-A (TB-A) → ExternalEntity:
//     EE has no TB → only sender perspective → TB-A
//
//   Internal flow (same TB):
//     Sender perspective only → that TB

import type { StrideCategory } from "shared";
import type {
  Threat,
  ThreatTable,
  ThreatProjectData,
  ThreatConfiguration,
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

// ==================== TYPES ====================

type Perspective = "sender" | "receiver";

// ==================== INTERACTION THREAT GENERATOR ====================

export class InteractionThreatGenerator {
  generateThreatsForProject(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    configuration?: ThreatConfiguration,
  ): ThreatTable[] {
    if (!project.dfdGraph) return [];

    const graph = project.dfdGraph;
    const zeroTrust = configuration?.zeroTrustMode ?? false;

    // ==================== ASSET INDEX ====================
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

    // ==================== TABLE MAP ====================
    // tbId → threats[]  (built incrementally)
    const tableMap = new Map<string, Threat[]>();

    const addThreat = (tbId: string, threat: Threat) => {
      const existing = tableMap.get(tbId) ?? [];
      existing.push(threat);
      tableMap.set(tbId, existing);
    };

    // ==================== DATAFLOW THREATS ====================
    for (const df of dfdContext.getDataFlows()) {
      const source = dfdContext.getElement(df.fromElementId);
      const target = dfdContext.getElement(df.toElementId);
      if (!source || !target) continue;

      // Resolve displayId from graph — connectionId is the XML internal ID
      const connection = graph.connectionsById.get(df.connectionId);
      const dfDisplayId = connection?.displayId ?? df.connectionId;

      const senderTB = df.fromEffectiveTrustBoundary ?? null;
      const receiverTB = df.toEffectiveTrustBoundary ?? null;
      const internalFlow = senderTB !== null && senderTB === receiverTB;

      // Sender perspective: always when sender has a TB
      if (senderTB) {
        for (const stride of STRIDE_PER_INTERACTION) {
          addThreat(
            senderTB,
            this.createDataFlowThreat(
              df,
              dfDisplayId,
              source,
              target,
              stride,
              "sender",
              senderTB,
              this.getTBName(graph, senderTB),
              this.getTBDisplayId(graph, senderTB),
              elementToAssets,
            ),
          );
        }
      }

      // Receiver perspective:
      // - always when sender has no TB (EE → Process)
      // - when crosses boundary (zeroTrust or different TBs)
      const needsReceiverPerspective =
        !senderTB || // EE as sender
        (!internalFlow && (zeroTrust || df.crossesTrustBoundary));

      if (needsReceiverPerspective && receiverTB) {
        for (const stride of STRIDE_PER_INTERACTION) {
          addThreat(
            receiverTB,
            this.createDataFlowThreat(
              df,
              dfDisplayId,
              source,
              target,
              stride,
              "receiver",
              receiverTB,
              this.getTBName(graph, receiverTB),
              this.getTBDisplayId(graph, receiverTB),
              elementToAssets,
            ),
          );
        }
      }
    }

    // ==================== INTERFACE THREATS ====================
    for (const element of graph.elementsById.values()) {
      if (element.type !== "Interface" && element.type !== "PhysicalInterface")
        continue;

      const effectiveTB = graph.effectiveElementTrustBoundary.get(element.id);
      const tbId = effectiveTB ?? null;
      const tbName = tbId ? this.getTBName(graph, tbId) : "Physical Interfaces";
      const tbDisplayId = tbId ? this.getTBDisplayId(graph, tbId) : "";
      const tableKey = tbId ?? "__no_tb__";

      for (const stride of STRIDE_PER_INTERACTION) {
        const threat = this.createInterfaceThreat(
          element,
          stride,
          tbId,
          tbName,
          tbDisplayId,
          graph,
          elementToAssets,
        );
        const existing = tableMap.get(tableKey) ?? [];
        existing.push(threat);
        tableMap.set(tableKey, existing);
      }
    }

    // ==================== BUILD TABLES ====================
    const tables: ThreatTable[] = [];

    for (const [tbId, threats] of tableMap) {
      if (threats.length === 0) continue;

      if (tbId === "__no_tb__") {
        tables.push({
          trustBoundaryId: null,
          trustBoundaryName: "Physical Interfaces",
          displayIdentifier: "[IF]",
          threats,
        });
      } else {
        const tb = graph.elementsById.get(tbId);
        tables.push({
          trustBoundaryId: tbId,
          trustBoundaryName: tb?.name ?? tbId,
          displayIdentifier: `[${tb?.displayId ?? tbId}]`,
          threats,
        });
      }
    }

    return tables;
  }

  // ==================== HELPERS ====================

  private getTBName(graph: DFDGraphReference, tbId: string): string {
    return graph.elementsById.get(tbId)?.name ?? tbId;
  }

  private getTBDisplayId(graph: DFDGraphReference, tbId: string): string {
    return graph.elementsById.get(tbId)?.displayId ?? tbId;
  }

  // ==================== THREAT CREATION ====================

  private createDataFlowThreat(
    dataFlow: DataFlowAnalysisReference,
    dfDisplayId: string,
    source: DFDElementReference,
    target: DFDElementReference,
    strideCategory: StrideCategory,
    perspective: Perspective,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    elementToAssets: Map<string, string[]>,
  ): Threat {
    // Map perspective to direction for UI context (incoming=receiver, outgoing=sender)
    const direction: InteractionDirection =
      perspective === "sender" ? "outgoing" : "incoming";

    // Build clean threat ID: TB-DF1-S-1 (no IN/OUT suffix)
    const dataFlowNumber = dfDisplayId.replace(/^DF-/, "");
    const dataFlowIdPart = `DF${dataFlowNumber}`;
    const threatId = `${trustBoundaryDisplayId}-${dataFlowIdPart}-${strideCategory}-1`;

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
      dataFlowId: dfDisplayId,
      dataFlowName: `DataFlow ${dfDisplayId}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      targetId: target.id,
      targetName: target.name,
      targetType: target.type,
    } as DataFlowReference;

    // Asset linking: connection + source + target
    const connAssets = elementToAssets.get(dataFlow.connectionId) ?? [];
    const sourceAssets = elementToAssets.get(dataFlow.fromElementId) ?? [];
    const targetAssets = elementToAssets.get(dataFlow.toElementId) ?? [];
    threat.linkedAssetIds = [
      ...new Set([...connAssets, ...sourceAssets, ...targetAssets]),
    ];

    threat.source = "auto";
    return threat;
  }

  private createInterfaceThreat(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    graph: DFDGraphReference,
    elementToAssets: Map<string, string[]>,
  ): Threat {
    const displayId = element.displayId || element.id;
    const interfaceNumber = displayId.replace(/^IF-/, "");
    const interfaceIdPart = `IF${interfaceNumber}`;

    const threatId = generateThreatIdPerInteraction(
      trustBoundaryDisplayId,
      interfaceIdPart,
      strideCategory,
      "incoming",
      1,
    );

    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName,
      trustBoundaryDisplayId,
    );

    threat.linkedElement = {
      elementId: element.id,
      elementName: element.name,
      elementType: element.type,
      displayId,
    };

    threat.threatDescription = getDefaultInterfaceThreatDescription(
      strideCategory,
      element.name,
      "en",
    );
    threat.attackDescription = getDefaultInterfaceAttackDescription(
      strideCategory,
      element.name,
      "en",
    );

    threat.linkedAssetIds = elementToAssets.get(element.id) ?? [];
    threat.source = "auto";
    return threat;
  }
}

// ==================== EXPORT SINGLETON ====================

export const interactionThreatGenerator = new InteractionThreatGenerator();