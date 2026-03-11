import { DFDAnalysisContext } from "shared";
import { DFDGraph } from "../models/dfd-graph-types";
import { ExposureLevel } from "../models/element-properties";

export class DFDGraphAnalysisContext implements DFDAnalysisContext {
  constructor(private graph: DFDGraph) {}

  // ==================== Factory für Dummy Graph ====================
  static createDummyGraph(): DFDGraphAnalysisContext {
    const dummyGraph: DFDGraph = {
      elementsById: new Map(),
      connectionsById: new Map(),
      assetsById: new Map(),
      outgoingConnections: new Map(),
      incomingConnections: new Map(),
      dataFlowAnalysis: new Map(),
      trustBoundaryHierarchy: new Map(),
      elementTrustBoundaries: new Map(),
      trustBoundaryElements: new Map(),
      effectiveElementTrustBoundary: new Map(),
    };
    return new DFDGraphAnalysisContext(dummyGraph);
  }

  isDummy(): boolean {
    return this.graph.elementsById.size === 0;
  }

  getElement(id: string) {
    return this.graph.elementsById.get(id);
  }

  *getDataFlows() {
    for (const df of this.graph.dataFlowAnalysis.values()) {
      const fromTBs =
        this.graph.elementTrustBoundaries.get(df.fromElementId) || [];
      const toTBs = this.graph.elementTrustBoundaries.get(df.toElementId) || [];
      yield {
        connectionId: df.connectionId,
        fromElementId: df.fromElementId,
        toElementId: df.toElementId,
        fromElementType:
          this.graph.elementsById.get(df.fromElementId)?.type ?? "Unknown",
        toElementType:
          this.graph.elementsById.get(df.toElementId)?.type ?? "Unknown",
        fromTrustBoundaryIds: fromTBs,
        toTrustBoundaryIds: toTBs,
        fromEffectiveTrustBoundary: df.fromEffectiveTrustBoundary ?? null,
        toEffectiveTrustBoundary: df.toEffectiveTrustBoundary ?? null,
        crossesTrustBoundary: df.crossesTrustBoundary,
        crossesMultipleTrustBoundaries: fromTBs.length + toTBs.length > 1,
        viaInterface: df.viaInterface ?? false,
        crossingType: df.crossingType ?? "none",
      };
    }
  }

  *getTrustBoundaries() {
    for (const tb of this.graph.trustBoundaryHierarchy.values()) {
      const el = this.graph.elementsById.get(tb.trustBoundaryId);
      if (!el) continue;

      yield {
        id: el.id,
        name: el.name,
        displayId: el.displayId,
      };
    }
  }

  getEffectiveTrustBoundary(elementId: string) {
    return this.graph.effectiveElementTrustBoundary.get(elementId);
  }

  getEffectiveDefaultExposureLevel(
    elementId: string,
  ): ExposureLevel | undefined {
    // For Elemente (Interface): TB-Ownership
    const tbId = this.graph.effectiveElementTrustBoundary.get(elementId);
    if (tbId) {
      const tb = this.graph.elementsById.get(tbId);
      return (tb?.properties as Record<string, any>)?.exposureLevel as
        | ExposureLevel
        | undefined;
    }

    // For DataFlow Connections: max(from TB EL, to TB EL)
    const df = this.graph.dataFlowAnalysis.get(elementId);
    if (df) {
      const fromTBId = df.fromEffectiveTrustBoundary;
      const toTBId = df.toEffectiveTrustBoundary;
      const EL_ORDER: Record<string, number> = {
        EL0: 0,
        EL1: 1,
        EL2: 2,
        EL3: 3,
        EL4: 4,
      };

      const fromEL = fromTBId
        ? (
            this.graph.elementsById.get(fromTBId)?.properties as Record<
              string,
              any
            >
          )?.exposureLevel
        : undefined;
      const toEL = toTBId
        ? (
            this.graph.elementsById.get(toTBId)?.properties as Record<
              string,
              any
            >
          )?.exposureLevel
        : undefined;

      if (!fromEL && !toEL) return undefined;
      if (!fromEL) return toEL as ExposureLevel;
      if (!toEL) return fromEL as ExposureLevel;
      return (
        EL_ORDER[fromEL] >= EL_ORDER[toEL] ? fromEL : toEL
      ) as ExposureLevel;
    }

    return undefined;
  }
}
