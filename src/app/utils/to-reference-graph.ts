import type {
  DFDGraph,
  DataFlowAnalysis,
  TrustBoundaryAnalysis,
} from "features/dfd";

import type {
  DFDGraphReference,
  DFDConnectionReference,
  DataFlowAnalysisReference,
  TrustBoundaryAnalysisReference,
} from "shared";

export function toReferenceGraph(graph: DFDGraph): DFDGraphReference {
  // ── Elements ──────────────────────────────────────────────────────────────
  // properties passed through so threat generators can read InterfaceProperties,
  // ProcessProperties, etc. without re-parsing raw DFD XML.
  const elementsById = new Map(
    Array.from(graph.elementsById.entries()).map(([id, e]) => [
      id,
      {
        id: e.id,
        type: e.type,
        name: e.name,
        displayId: e.displayId,
        position: { x: e.position.x, y: e.position.y },
        size: { width: e.size.width, height: e.size.height },
        properties: e.properties as Record<string, unknown> | undefined,
      },
    ]),
  );

  // ── Connections ───────────────────────────────────────────────────────────
  // properties (DataFlowProperties) passed through for physicalPathProtection,
  // encryptionInTransit, integrityProtection, etc.
  // excludeFromThreatGen and assumedTrusted surfaced directly on the ref
  // so generators don't need (conn as any)?.properties casts.
  const connectionsById = new Map(
    Array.from(graph.connectionsById.entries()).map(([id, c]) => {
      const props = c.properties as Record<string, unknown> | undefined;
      return [
        id,
        {
          id: c.id,
          from: c.from,
          to: c.to,
          name: c.name,
          label: c.name,
          displayId: c.displayId,
          excludeFromThreatGen: props?.["excludeFromThreatGen"] === true,
          assumedTrusted: props?.["assumedTrusted"] === true,
          properties: props,
        } satisfies DFDConnectionReference,
      ];
    }),
  );

  // ── Assets ────────────────────────────────────────────────────────────────
  const assetsById = new Map(
    Array.from(graph.assetsById.entries()).map(([id, a]) => [
      id,
      {
        id: a.id,
        name: a.name,
        linkedElements: a.linkedElements,
      },
    ]),
  );

  // ── DataFlow analysis ─────────────────────────────────────────────────────
  // crossesChipBoundary / crossesPhysicalBoundary forwarded so the threat
  // generator can distinguish physical from logical boundary crossings.
  const dataFlowAnalysis = new Map(
    Array.from(graph.dataFlowAnalysis.entries()).map(
      ([id, df]: [string, DataFlowAnalysis]) => [
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
          crossesChipBoundary: df.crossesChipBoundary ?? false,
          terminatesAtChipBoundary: df.terminatesAtChipBoundary ?? false,
          crossesPhysicalBoundary: df.crossesPhysicalBoundary ?? false,
          terminatesAtPhysicalBoundary:
            df.terminatesAtPhysicalBoundary ?? false,
        } satisfies DataFlowAnalysisReference,
      ],
    ),
  );

  // ── Trust Boundary hierarchy ──────────────────────────────────────────────
  // parentTrustBoundaryId: null → undefined to match TrustBoundaryAnalysisReference.
  const trustBoundaryHierarchy = new Map(
    Array.from(graph.trustBoundaryHierarchy.entries()).map(
      ([id, tb]: [string, TrustBoundaryAnalysis]) => [
        id,
        {
          trustBoundaryId: tb.trustBoundaryId,
          parentTrustBoundaryId: tb.parentTrustBoundaryId ?? undefined,
          depth: tb.depth,
        } satisfies TrustBoundaryAnalysisReference,
      ],
    ),
  );

  return {
    elementsById,
    connectionsById,
    assetsById,
    outgoingConnections: new Map(graph.outgoingConnections),
    incomingConnections: new Map(graph.incomingConnections),
    elementTrustBoundaries: new Map(graph.elementTrustBoundaries),
    trustBoundaryElements: new Map(graph.trustBoundaryElements),
    // ChipBoundary membership — needed for interface threat routing (JTAG/SWD)
    // and context-aware template selection (chipType, debugProtection).
    elementChipBoundaries: new Map(graph.elementChipBoundaries),
    chipBoundaryElements: new Map(graph.chipBoundaryElements),
    // PhysicalBoundary membership — needed for PhysicalBoundary threat generation
    // and interface parent-boundary name resolution in threat tables.
    elementPhysicalBoundaries: new Map(graph.elementPhysicalBoundaries),
    physicalBoundaryElements: new Map(graph.physicalBoundaryElements),
    dataFlowAnalysis,
    trustBoundaryHierarchy,
    effectiveElementTrustBoundary: new Map(graph.effectiveElementTrustBoundary),
  };
}