import type {
  DFDGraph,
  DataFlowAnalysis,
  TrustBoundaryAnalysis
} from "features/dfd";

import type {
  DFDGraphReference,
  DFDConnectionReference,
  DataFlowAnalysisReference,
  TrustBoundaryAnalysisReference
} from "features/threats";

export function toReferenceGraph(graph: DFDGraph): DFDGraphReference {
  const elementRefs = Object.fromEntries(
    Array.from(graph.elementsById.entries()).map(([id, e]) => [
      id,
      {
        id: e.id,
        type: e.type,
        name: e.name,
        displayId: e.displayId,
        position: { x: e.position.x, y: e.position.y },
        size: { width: e.size.width, height: e.size.height },
      },
    ])
  );

  const connectionRefs = Object.fromEntries(
    Array.from(graph.connectionsById.entries()).map(([id, c]) => [
      id,
      {
        id: c.id,
        from: c.from,
        to: c.to,
        label: c.name,
      },
    ]),
  );

  const assetRefs = Object.fromEntries(
    Array.from(graph.assetsById.entries()).map(([id, a]) => [
      id,
      {
        id: a.id,
        name: a.name,
        linkedElements: a.linkedElements,
      },
    ])
  );

  const outgoing = Object.fromEntries(graph.outgoingConnections);
  const incoming = Object.fromEntries(graph.incomingConnections);

  const dataFlows = Object.fromEntries(
    Array.from(graph.dataFlowAnalysis.entries()).map(([id, df]: [string, DataFlowAnalysis]) => [
      id,
      {
        connectionId: df.connectionId,
        fromElementId: df.fromElementId,
        toElementId: df.toElementId,
        fromElementType: df.fromElementType.toString(),
        toElementType: df.toElementType.toString(),
        fromTrustBoundaryIds: [...df.fromTrustBoundaryIds],
        toTrustBoundaryIds: [...df.toTrustBoundaryIds],
        fromEffectiveTrustBoundary: df.fromEffectiveTrustBoundary ?? null,
        toEffectiveTrustBoundary: df.toEffectiveTrustBoundary ?? null,
        crossesTrustBoundary: df.crossesTrustBoundary,
        crossesMultipleTrustBoundaries: df.crossesMultipleTrustBoundaries,
        viaInterface: df.viaInterface ?? false,
        crossingType: df.crossingType ?? "none",
      } as DataFlowAnalysisReference,
    ])
  );

  const tbHierarchy = Object.fromEntries(
    Array.from(graph.trustBoundaryHierarchy.entries()).map(([id, tb]: [string, TrustBoundaryAnalysis]) => [
      id,
      {
        trustBoundaryId: tb.trustBoundaryId,
        parentTrustBoundaryId: tb.parentTrustBoundaryId ?? null,
        depth: tb.depth,
      } as TrustBoundaryAnalysisReference,
    ])
  );

  return {
    elementsById: new Map(Object.entries(elementRefs)),
    connectionsById: new Map(
  Object.entries(connectionRefs) as [string, DFDConnectionReference][]
),
    assetsById: new Map(Object.entries(assetRefs)),
    outgoingConnections: new Map(Object.entries(outgoing)),
    incomingConnections: new Map(Object.entries(incoming)),
    dataFlowAnalysis: new Map(Object.entries(dataFlows)),
    trustBoundaryHierarchy: new Map(Object.entries(tbHierarchy)),
    elementTrustBoundaries: new Map(graph.elementTrustBoundaries),
    trustBoundaryElements: new Map(graph.trustBoundaryElements),
    effectiveElementTrustBoundary: new Map(graph.effectiveElementTrustBoundary),
  };
}
