// ==================== DFD GRAPH BUILDER ====================
// Builds the analysis graph from persisted DFDData

import type {
  DFDData,
  DFDElement,
  DFDConnection,
} from "../models/dfd-types";

import type {
  DFDGraph,
  DataFlowAnalysis,
  BoundingBox,
  TrustBoundaryAnalysis,
} from "../models/dfd-graph-types";

// ==================== BUILDER API ====================

export interface DFDGraphBuilder {
  build(dfd: DFDData): DFDGraph;
}

// ==================== DEFAULT IMPLEMENTATION ====================

export class DefaultDFDGraphBuilder implements DFDGraphBuilder {
  // ==================== ENTRY POINT ====================

  build(dfd: DFDData): DFDGraph {
    const elementsById = this.indexById(dfd.elements);
    const connectionsById = this.indexById(dfd.connections);
    const assetsById = this.indexById(dfd.assets);

    const outgoingConnections = this.buildOutgoing(dfd.connections);
    const incomingConnections = this.buildIncoming(dfd.connections);

    const trustBoundaries = dfd.elements.filter(
      e => e.type === "TrustBoundary"
    );

    const elementTrustBoundaries =
      this.resolveElementTrustBoundaries(dfd.elements, trustBoundaries);

    const trustBoundaryElements =
      this.buildReverseTrustBoundaryIndex(elementTrustBoundaries);

    const trustBoundaryHierarchy =
      this.resolveTrustBoundaryHierarchy(trustBoundaries);

    const effectiveElementTrustBoundary =
      this.resolveEffectiveElementTrustBoundary(
        elementTrustBoundaries,
        trustBoundaryHierarchy
      );

    const dataFlowAnalysis =
      this.analyzeDataFlows(
        dfd.connections,
        elementsById,
        elementTrustBoundaries,
        effectiveElementTrustBoundary
      );

    return {
      elementsById,
      connectionsById,
      assetsById,
      outgoingConnections,
      incomingConnections,
      elementTrustBoundaries,
      trustBoundaryElements,
      trustBoundaryHierarchy,
      effectiveElementTrustBoundary,
      dataFlowAnalysis,
    };
  }

  // ==================== INDEXING ====================

  private indexById<T extends { id: string }>(items: T[]): Map<string, T> {
    return new Map(items.map(item => [item.id, item]));
  }

  // ==================== GRAPH TOPOLOGY ====================

  private buildOutgoing(connections: DFDConnection[]): Map<string, string[]> {
    const map = new Map<string, string[]>();

    for (const c of connections) {
      if (!map.has(c.from)) map.set(c.from, []);
      map.get(c.from)!.push(c.id);
    }

    return map;
  }

  private buildIncoming(connections: DFDConnection[]): Map<string, string[]> {
    const map = new Map<string, string[]>();

    for (const c of connections) {
      if (!map.has(c.to)) map.set(c.to, []);
      map.get(c.to)!.push(c.id);
    }

    return map;
  }

  // ==================== TRUST BOUNDARY RESOLUTION ====================

  private resolveElementTrustBoundaries(
    elements: DFDElement[],
    trustBoundaries: DFDElement[]
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();

    const tbBoxes = trustBoundaries.map(tb => ({
      id: tb.id,
      box: this.toBoundingBox(tb),
    }));

    for (const element of elements) {
      if (element.type === "TrustBoundary") continue;

      const elementBox = this.toBoundingBox(element);
      const containedIn: string[] = [];

      for (const tb of tbBoxes) {
        if (this.isContained(elementBox, tb.box)) {
          containedIn.push(tb.id);
        }
      }

      result.set(element.id, containedIn);
    }

    return result;
  }

  private buildReverseTrustBoundaryIndex(
    elementTBs: Map<string, string[]>
  ): Map<string, string[]> {
    const reverse = new Map<string, string[]>();

    for (const [elementId, tbIds] of elementTBs) {
      for (const tbId of tbIds) {
        if (!reverse.has(tbId)) reverse.set(tbId, []);
        reverse.get(tbId)!.push(elementId);
      }
    }

    return reverse;
  }

  // ==================== TRUST BOUNDARY HIERARCHY ====================

  private resolveTrustBoundaryHierarchy(
    trustBoundaries: DFDElement[]
  ): Map<string, TrustBoundaryAnalysis> {
    const result = new Map<string, TrustBoundaryAnalysis>();

    const boxes = trustBoundaries.map(tb => ({
      id: tb.id,
      box: this.toBoundingBox(tb),
    }));

    for (const tb of trustBoundaries) {
      let parent: string | undefined;
      let minArea = Infinity;

      const box = this.toBoundingBox(tb);

      for (const candidate of boxes) {
        if (candidate.id === tb.id) continue;

        if (this.isContained(box, candidate.box)) {
          const area = candidate.box.width * candidate.box.height;
          if (area < minArea) {
            minArea = area;
            parent = candidate.id;
          }
        }
      }

      result.set(tb.id, {
        trustBoundaryId: tb.id,
        parentTrustBoundaryId: parent,
        depth: 0,
      });
    }

    const computeDepth = (id: string): number => {
      const tb = result.get(id)!;
      if (!tb.parentTrustBoundaryId) return 0;
      return 1 + computeDepth(tb.parentTrustBoundaryId);
    };

    result.forEach(tb => {
      tb.depth = computeDepth(tb.trustBoundaryId);
    });

    return result;
  }

  private resolveEffectiveElementTrustBoundary(
    elementTBs: Map<string, string[]>,
    hierarchy: Map<string, TrustBoundaryAnalysis>
  ): Map<string, string | undefined> {
    const result = new Map<string, string | undefined>();

    for (const [elementId, tbIds] of elementTBs) {
      if (tbIds.length === 0) {
        result.set(elementId, undefined);
        continue;
      }

      const deepest = tbIds.reduce((a, b) =>
        hierarchy.get(a)!.depth > hierarchy.get(b)!.depth ? a : b
      );

      result.set(elementId, deepest);
    }

    return result;
  }

  // ==================== DATA FLOW ANALYSIS ====================

  private analyzeDataFlows(
    connections: DFDConnection[],
    elementsById: Map<string, DFDElement>,
    elementTBs: Map<string, string[]>,
    effectiveElementTB: Map<string, string | undefined>
  ): Map<string, DataFlowAnalysis> {
    const result = new Map<string, DataFlowAnalysis>();

    for (const c of connections) {
      const fromElement = elementsById.get(c.from);
      const toElement = elementsById.get(c.to);

      if (!fromElement || !toElement) continue;

      const fromTBs = elementTBs.get(c.from) ?? [];
      const toTBs = elementTBs.get(c.to) ?? [];

      const fromEffectiveTB = effectiveElementTB.get(c.from);
      const toEffectiveTB = effectiveElementTB.get(c.to);

      const crosses = !this.sameSet(fromTBs, toTBs);

      const crossingType = this.determineCrossingType(
        fromEffectiveTB,
        toEffectiveTB
      );

      const viaInterface =
        fromElement.type === "Interface" ||
        toElement.type === "Interface";

      result.set(c.id, {
        connectionId: c.id,
        fromElementId: c.from,
        toElementId: c.to,
        fromElementType: fromElement.type,
        toElementType: toElement.type,
        fromTrustBoundaryIds: fromTBs,
        toTrustBoundaryIds: toTBs,
        fromEffectiveTrustBoundary: fromEffectiveTB,
        toEffectiveTrustBoundary: toEffectiveTB,
        crossesTrustBoundary: crosses,
        crossesMultipleTrustBoundaries:
          crosses && (fromTBs.length + toTBs.length > 1),
        viaInterface,
        crossingType,
      });
    }

    return result;
  }

  private determineCrossingType(
    from?: string,
    to?: string
  ): "none" | "inbound" | "outbound" | "lateral" {
    if (!from && !to) return "none";
    if (!from && to) return "inbound";
    if (from && !to) return "outbound";
    if (from !== to) return "lateral";
    return "none";
  }

  // ==================== GEOMETRY HELPERS ====================

  private toBoundingBox(element: DFDElement): BoundingBox {
    return {
      x: element.position.x,
      y: element.position.y,
      width: element.size.width,
      height: element.size.height,
    };
  }

  private isContained(inner: BoundingBox, outer: BoundingBox): boolean {
    return (
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height
    );
  }

  private sameSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every(x => setA.has(x));
  }
}
