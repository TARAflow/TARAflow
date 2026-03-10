// ==================== DFD GRAPH BUILDER ====================
// Builds analysis graph from DFDData with TB membership logic

import type { DFDElement, DFDConnection } from "../models/dfd-types";
import type {
  InterfaceProperties,
  DataFlowProperties,
  TrustBoundaryProperties,
  ExposureLevel,
} from "../models/element-properties";
import type { DFDAsset } from "../models/asset-types";
import type {
  DFDGraph,
  DataFlowAnalysis,
  BoundingBox,
  TrustBoundaryAnalysis,
} from "../models/dfd-graph-types";
import { dfdAnalyzer } from "../utils/dfd-analyzer";

// ==================== GEOMETRY HELPERS ====================

/**
 * Check if two bounding boxes overlap (even partially)
 */
function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  const aLeft = a.x;
  const aRight = a.x + a.width;
  const aTop = a.y;
  const aBottom = a.y + a.height;

  const bLeft = b.x;
  const bRight = b.x + b.width;
  const bTop = b.y;
  const bBottom = b.y + b.height;

  // Check for overlap (returns true if rectangles touch or overlap)
  return !(
    aRight < bLeft || // A is completely left of B
    aLeft > bRight || // A is completely right of B
    aBottom < bTop || // A is completely above B
    aTop > bBottom // A is completely below B
  );
}

/**
 * Check if box A is completely contained within box B
 */
function isCompletelyContained(
  inner: BoundingBox,
  outer: BoundingBox,
): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Extract bounding box from DFDElement
 */
function getBoundingBox(element: DFDElement): BoundingBox {
  return {
    x: element.position.x,
    y: element.position.y,
    width: element.size.width,
    height: element.size.height,
  };
}

// ==================== EXPOSURE LEVEL HELPERS ====================

// EL numeric order for comparison
const EL_ORDER: Record<string, number> = {
  EL0: 0, EL1: 1, EL2: 2, EL3: 3, EL4: 4,
};

function maxEL(a?: string, b?: string): string | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  return (EL_ORDER[a] ?? 0) >= (EL_ORDER[b] ?? 0) ? a : b;
}

// ==================== GRAPH BUILDER ====================

export interface DFDGraphBuilderInput {
  elements: DFDElement[];
  connections: DFDConnection[];
  assets: DFDAsset[];
}

export interface DFDGraphBuilder {
  build(input: DFDGraphBuilderInput): DFDGraph;
}

// ==================== DEFAULT IMPLEMENTATION ====================

export class DefaultDFDGraphBuilder implements DFDGraphBuilder {
  build(input: DFDGraphBuilderInput): DFDGraph {
    const { elements, connections, assets } = input;

    // 1. Basic lookup maps
    const elementsById = new Map(elements.map((e) => [e.id, e]));
    const connectionsById = new Map(connections.map((c) => [c.id, c]));
    const assetsById = new Map(assets.map((a) => [a.id, a]));

    // 2. Topology maps
    const { outgoingConnections, incomingConnections } =
      this.buildTopologyMaps(connections);

    // 3. Trust Boundary membership (overlap-based)
    const { elementTrustBoundaries, trustBoundaryElements } =
      this.buildTrustBoundaryMembership(elements);

    // 4. Trust Boundary hierarchy (containment-based)
    const trustBoundaryHierarchy = this.buildTrustBoundaryHierarchy(elements);

    // 5. Effective TB (deepest nested)
    const effectiveElementTrustBoundary = this.computeEffectiveTrustBoundaries(
      elements,
      elementTrustBoundaries,
      trustBoundaryHierarchy,
    );

    // 6. DataFlow analysis
    const dataFlowAnalysis = this.buildDataFlowAnalysis(
      connections,
      elementsById,
      elementTrustBoundaries,
      effectiveElementTrustBoundary,
    );

    // 7. Derive Exposure Levels
    this.deriveExposureLevels(
      elements,
      connections,
      dataFlowAnalysis,
      elementTrustBoundaries,
    );

    return {
      elementsById,
      connectionsById,
      assetsById,
      outgoingConnections,
      incomingConnections,
      elementTrustBoundaries,
      trustBoundaryElements,
      dataFlowAnalysis,
      trustBoundaryHierarchy,
      effectiveElementTrustBoundary,
    };
  }

  // ==================== TOPOLOGY ====================

  private buildTopologyMaps(connections: DFDConnection[]): {
    outgoingConnections: Map<string, string[]>;
    incomingConnections: Map<string, string[]>;
  } {
    const outgoingConnections = new Map<string, string[]>();
    const incomingConnections = new Map<string, string[]>();

    for (const conn of connections) {
      // Outgoing from source
      const outgoing = outgoingConnections.get(conn.from) || [];
      outgoing.push(conn.id);
      outgoingConnections.set(conn.from, outgoing);

      // Incoming to target
      const incoming = incomingConnections.get(conn.to) || [];
      incoming.push(conn.id);
      incomingConnections.set(conn.to, incoming);
    }

    return { outgoingConnections, incomingConnections };
  }

  // ==================== TRUST BOUNDARY MEMBERSHIP ====================

  /**
   * Build TB membership based on geometric overlap
   * Rule: Interface, Process, DataStore use overlap detection
   * External Entities are never members
   */
  private buildTrustBoundaryMembership(elements: DFDElement[]): {
    elementTrustBoundaries: Map<string, string[]>;
    trustBoundaryElements: Map<string, string[]>;
  } {
    const elementTrustBoundaries = new Map<string, string[]>();
    const trustBoundaryElements = new Map<string, string[]>();

    // Get all trust boundaries
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

    // For each non-TB, non-EE element, find overlapping TBs
    for (const element of elements) {
      // Skip Trust Boundaries (handled separately)
      if (element.type === "TrustBoundary") continue;

      // Skip External Entities (never inside TB)
      if (element.type === "ExternalEntity") {
        elementTrustBoundaries.set(element.id, []);
        continue;
      }

      // Check overlap with each TB
      const memberTBs: string[] = [];
      const elementBox = getBoundingBox(element);

      for (const tb of trustBoundaries) {
        const tbBox = getBoundingBox(tb);

        if (boundingBoxesOverlap(elementBox, tbBox)) {
          memberTBs.push(tb.id);

          // Also update reverse map
          const tbElements = trustBoundaryElements.get(tb.id) || [];
          tbElements.push(element.id);
          trustBoundaryElements.set(tb.id, tbElements);
        }
      }

      elementTrustBoundaries.set(element.id, memberTBs);
    }

    return { elementTrustBoundaries, trustBoundaryElements };
  }

  // ==================== TRUST BOUNDARY HIERARCHY ====================

  /**
   * Build TB hierarchy based on complete containment
   * Rule: TB must be COMPLETELY contained in parent TB
   */
  private buildTrustBoundaryHierarchy(
    elements: DFDElement[],
  ): Map<string, TrustBoundaryAnalysis> {
    const hierarchy = new Map<string, TrustBoundaryAnalysis>();

    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

    // For each TB, find its parent (if any)
    for (const tb of trustBoundaries) {
      const tbBox = getBoundingBox(tb);
      let parentTB: DFDElement | undefined = undefined;
      let smallestParentArea = Infinity;

      // Find the smallest TB that completely contains this TB
      for (const potentialParent of trustBoundaries) {
        if (potentialParent.id === tb.id) continue;

        const parentBox = getBoundingBox(potentialParent);

        if (isCompletelyContained(tbBox, parentBox)) {
          const parentArea = parentBox.width * parentBox.height;

          // Pick the smallest containing TB (most direct parent)
          if (parentArea < smallestParentArea) {
            parentTB = potentialParent;
            smallestParentArea = parentArea;
          }
        }
      }

      // Store initial analysis (depth will be computed later)
      hierarchy.set(tb.id, {
        trustBoundaryId: tb.id,
        parentTrustBoundaryId: parentTB?.id,
        depth: 0, // Will be computed in next pass
      });
    }

    // Compute depths
    this.computeDepths(hierarchy);

    return hierarchy;
  }

  /**
   * Compute depth for each TB in hierarchy
   */
  private computeDepths(hierarchy: Map<string, TrustBoundaryAnalysis>): void {
    const computeDepth = (
      tbId: string,
      visited = new Set<string>(),
    ): number => {
      // Avoid infinite loops
      if (visited.has(tbId)) return 0;
      visited.add(tbId);

      const analysis = hierarchy.get(tbId);
      if (!analysis || !analysis.parentTrustBoundaryId) {
        return 0; // Root level
      }

      return 1 + computeDepth(analysis.parentTrustBoundaryId, visited);
    };

    for (const [tbId, analysis] of hierarchy) {
      analysis.depth = computeDepth(tbId);
    }
  }

  // ==================== EFFECTIVE TRUST BOUNDARY ====================

  /**
   * Compute the "effective" TB for each element
   * This is the DEEPEST nested TB the element is in
   */
  private computeEffectiveTrustBoundaries(
    elements: DFDElement[],
    elementTrustBoundaries: Map<string, string[]>,
    trustBoundaryHierarchy: Map<string, TrustBoundaryAnalysis>,
  ): Map<string, string | undefined> {
    const effective = new Map<string, string | undefined>();

    for (const element of elements) {
      if (element.type === "TrustBoundary") continue;

      const memberTBs = elementTrustBoundaries.get(element.id) || [];

      if (memberTBs.length === 0) {
        effective.set(element.id, undefined);
        continue;
      }

      // Find the TB with the highest depth (most nested)
      let deepestTB: string | undefined = undefined;
      let maxDepth = -1;

      for (const tbId of memberTBs) {
        const analysis = trustBoundaryHierarchy.get(tbId);
        const depth = analysis?.depth ?? 0;

        if (depth > maxDepth) {
          maxDepth = depth;
          deepestTB = tbId;
        }
      }

      effective.set(element.id, deepestTB);
    }

    return effective;
  }

  // ==================== DATAFLOW ANALYSIS ====================

  /**
   * Build DataFlow analysis for each connection
   */
  private buildDataFlowAnalysis(
    connections: DFDConnection[],
    elementsById: Map<string, DFDElement>,
    elementTrustBoundaries: Map<string, string[]>,
    effectiveElementTrustBoundary: Map<string, string | undefined>,
  ): Map<string, DataFlowAnalysis> {
    const analysis = new Map<string, DataFlowAnalysis>();

    // Get all interfaces for geometric intersection checks
    const interfaces = Array.from(elementsById.values()).filter(
      (e) => e.type === "Interface",
    );
    const allElements = Array.from(elementsById.values());

    for (const conn of connections) {
      const fromElement = elementsById.get(conn.from);
      const toElement = elementsById.get(conn.to);

      if (!fromElement || !toElement) continue;

      const fromTBs = elementTrustBoundaries.get(conn.from) || [];
      const toTBs = elementTrustBoundaries.get(conn.to) || [];

      const fromEffectiveTB = effectiveElementTrustBoundary.get(conn.from);
      const toEffectiveTB = effectiveElementTrustBoundary.get(conn.to);

      // Check if crossing TBs
      const crossesTrustBoundary = fromEffectiveTB !== toEffectiveTB;

      // Count unique TBs crossed
      const allTBs = new Set([...fromTBs, ...toTBs]);
      const crossesMultipleTrustBoundaries = allTBs.size > 1;

      // Determine crossing type
      let crossingType: "none" | "inbound" | "outbound" | "lateral" = "none";
      if (crossesTrustBoundary) {
        if (!fromEffectiveTB && toEffectiveTB) {
          crossingType = "inbound"; // From outside to inside
        } else if (fromEffectiveTB && !toEffectiveTB) {
          crossingType = "outbound"; // From inside to outside
        } else {
          crossingType = "lateral"; // Between different TBs
        }
      }

      // Check which interfaces this dataflow passes through (geometric intersection)
      const interfaceIds: string[] = [];
      for (const iface of interfaces) {
        const dataflowsThrough = dfdAnalyzer.findDataflowsThroughInterface(
          iface,
          [conn],
          allElements,
        );
        if (dataflowsThrough.length > 0) {
          interfaceIds.push(iface.id);
        }
      }

      const viaInterface = interfaceIds.length > 0;

      analysis.set(conn.id, {
        connectionId: conn.id,
        fromElementId: conn.from,
        toElementId: conn.to,
        fromElementType: fromElement.type,
        toElementType: toElement.type,
        fromTrustBoundaryIds: fromTBs,
        toTrustBoundaryIds: toTBs,
        crossesTrustBoundary,
        crossesMultipleTrustBoundaries,
        fromEffectiveTrustBoundary: fromEffectiveTB,
        toEffectiveTrustBoundary: toEffectiveTB,
        interfaceIds,
        viaInterface,
        crossingType,
      });
    }

    return analysis;
  }

  private deriveExposureLevels(
    elements: DFDElement[],
    connections: DFDConnection[],
    dataFlowAnalysis: Map<string, DataFlowAnalysis>,
    elementTrustBoundaries: Map<string, string[]>,
  ): void {
    // Interface → TB-EL als Default
    for (const element of elements) {
      if (element.type !== "Interface") continue;
      const props = element.properties as InterfaceProperties;
      if (props.exposureLevelSource === "manual") continue;

      const tbIds = elementTrustBoundaries.get(element.id) ?? [];
      let derivedEL: string | undefined;
      for (const tbId of tbIds) {
        const tb = elements.find((e) => e.id === tbId);
        const tbEL = (tb?.properties as TrustBoundaryProperties)?.exposureLevel;
        derivedEL = maxEL(derivedEL, tbEL);
      }
      if (
        derivedEL &&
        (!props.exposureLevel ||
          EL_ORDER[derivedEL] > EL_ORDER[props.exposureLevel ?? "EL0"])
      ) {
        (element.properties as InterfaceProperties).exposureLevel =
          derivedEL as ExposureLevel;
        (element.properties as InterfaceProperties).exposureLevelSource =
          "derived";
      }
    }

    // Crossing DF → max(TB_from.EL, TB_to.EL)
    for (const conn of connections) {
      const props = conn.properties as DataFlowProperties | undefined;
      if (props?.exposureLevelSource === "manual") continue;

      const analysis = dataFlowAnalysis.get(conn.id);
      if (!analysis?.crossesTrustBoundary) continue;

      const fromTBIds = analysis.fromTrustBoundaryIds ?? [];
      const toTBIds = analysis.toTrustBoundaryIds ?? [];
      let derivedEL: string | undefined;

      for (const tbId of [...fromTBIds, ...toTBIds]) {
        const tb = elements.find((e) => e.id === tbId);
        const tbEL = (tb?.properties as TrustBoundaryProperties)?.exposureLevel;
        derivedEL = maxEL(derivedEL, tbEL);
      }
      if (
        derivedEL &&
        (!props?.exposureLevel ||
          EL_ORDER[derivedEL] > EL_ORDER[props?.exposureLevel ?? "EL0"])
      ) {
        if (!conn.properties) conn.properties = {};
        (conn.properties as DataFlowProperties).exposureLevel =
          derivedEL as ExposureLevel;
        (conn.properties as DataFlowProperties).exposureLevelSource = "derived";
      }
    }
  }
}
