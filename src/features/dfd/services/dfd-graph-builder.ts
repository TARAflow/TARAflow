// ==================== DFD GRAPH BUILDER ====================
// Builds analysis graph from DFDData with TB membership logic

import type { DFDElement, DFDConnection } from "../models/dfd-types";
import type {
  InterfaceProperties,
  DataFlowProperties,
  TrustBoundaryProperties,
  ChipBoundaryProperties,
} from "../models/element-properties";
import type { ExposureLevel } from "../models/element-shared-types";
// PhysicalBoundaryProperties imported for type guard in membership building
import type { PhysicalBoundaryProperties } from "../models/element-properties";
import type { DFDAsset } from "../models/dfd-asset-types";
import type {
  DFDGraph,
  DataFlowAnalysis,
  BoundingBox,
  TrustBoundaryAnalysis,
} from "../models/dfd-graph-types";
import type {
  SensorProperties,
  ActuatorProperties,
  TransducerLocation,
} from "../models/transducer-properties";
import { dfdAnalyzer } from "../utils/dfd-analyzer";
import { geometryAnalyzer } from "../utils/geometry-analyzer";

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

    // 3b. Chip Boundary membership (overlap-based, analog to TB)
    const { elementChipBoundaries, chipBoundaryElements } =
      this.buildChipBoundaryMembership(elements);

    // 3c. Physical Boundary membership (overlap-based, analog to ChipBoundary)
    const { elementPhysicalBoundaries, physicalBoundaryElements } =
      this.buildPhysicalBoundaryMembership(elements);

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
      elementChipBoundaries,
      elementPhysicalBoundaries,
    );

    // 7. Derive Exposure Levels
    this.deriveExposureLevels(
      elements,
      connections,
      dataFlowAnalysis,
      elementTrustBoundaries,
      elementChipBoundaries,
    );

    // 8. Derive transducer location (Sensor/Actuator) from PhysicalBoundary containment
    this.deriveTransducerLocations(elements, elementPhysicalBoundaries);

    return {
      elementsById,
      connectionsById,
      assetsById,
      outgoingConnections,
      incomingConnections,
      elementTrustBoundaries,
      trustBoundaryElements,
      elementChipBoundaries,
      chipBoundaryElements,
      elementPhysicalBoundaries,
      physicalBoundaryElements,
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

      // Skip Interfaces — they belong to PhysicalBoundary or ChipBoundary,
      // never to a TrustBoundary. TB grouping handled by parent PB/CB.
      if (element.type === "Interface") {
        elementTrustBoundaries.set(element.id, []);
        continue;
      }

      // Skip ChipBoundary — it is a standalone boundary type,
      // not a member of a TrustBoundary even if geometrically nested.
      if (element.type === "ChipBoundary") {
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

  /**
   * Build ChipBoundary membership based on geometric overlap.
   * Rule: Process, ExternalEntity, Interface may be inside a ChipBoundary.
   * Unlike TrustBoundary: ExternalEntity IS allowed inside (e.g. Developer
   * with JTAG access inside Device Boundary).
   * No hierarchy — ChipBoundaries do not nest.
   */
  private buildChipBoundaryMembership(elements: DFDElement[]): {
    elementChipBoundaries: Map<string, string[]>;
    chipBoundaryElements: Map<string, string[]>;
  } {
    const elementChipBoundaries = new Map<string, string[]>();
    const chipBoundaryElements = new Map<string, string[]>();

    const chipBoundaries = elements.filter((e) => e.type === "ChipBoundary");

    for (const element of elements) {
      // ChipBoundary itself is not a member of another ChipBoundary
      if (element.type === "ChipBoundary") continue;
      // TrustBoundary is not a member
      if (element.type === "TrustBoundary") continue;
      // PhysicalBoundary is not a member of ChipBoundary
      if (element.type === "PhysicalBoundary") continue;

      const memberChips: string[] = [];
      const elementBox = getBoundingBox(element);

      for (const chip of chipBoundaries) {
        const chipBox = getBoundingBox(chip);

        if (boundingBoxesOverlap(elementBox, chipBox)) {
          memberChips.push(chip.id);

          const chipElems = chipBoundaryElements.get(chip.id) || [];
          chipElems.push(element.id);
          chipBoundaryElements.set(chip.id, chipElems);
        }
      }

      elementChipBoundaries.set(element.id, memberChips);
    }

    return { elementChipBoundaries, chipBoundaryElements };
  }

  /**
   * Build PhysicalBoundary membership based on geometric overlap.
   * Rule: Process, ExternalEntity, Interface, ChipBoundary may be inside a PhysicalBoundary.
   * PhysicalBoundaries model spatial access barriers — elements inside share the same
   * physical access precondition for threat feasibility.
   * No hierarchy — PhysicalBoundaries do not nest (unlike TrustBoundaries).
   */
  private buildPhysicalBoundaryMembership(elements: DFDElement[]): {
    elementPhysicalBoundaries: Map<string, string[]>;
    physicalBoundaryElements: Map<string, string[]>;
  } {
    const elementPhysicalBoundaries = new Map<string, string[]>();
    const physicalBoundaryElements = new Map<string, string[]>();

    const physicalBoundaries = elements.filter(
      (e) => e.type === "PhysicalBoundary",
    );

    for (const element of elements) {
      // PhysicalBoundary itself is not a member of another PhysicalBoundary
      if (element.type === "PhysicalBoundary") continue;
      // TrustBoundary is not a member
      if (element.type === "TrustBoundary") continue;

      const memberPBs: string[] = [];
      const elementBox = getBoundingBox(element);

      for (const pb of physicalBoundaries) {
        const pbBox = getBoundingBox(pb);

        if (boundingBoxesOverlap(elementBox, pbBox)) {
          memberPBs.push(pb.id);

          const pbElems = physicalBoundaryElements.get(pb.id) || [];
          pbElems.push(element.id);
          physicalBoundaryElements.set(pb.id, pbElems);
        }
      }

      elementPhysicalBoundaries.set(element.id, memberPBs);
    }

    return { elementPhysicalBoundaries, physicalBoundaryElements };
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
      // Interface and ChipBoundary are excluded from TB membership
      // → they are grouped under PhysicalBoundary/ChipBoundary in generators
      if (element.type === "Interface" || element.type === "ChipBoundary") {
        effective.set(element.id, undefined);
        continue;
      }

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
    elementChipBoundaries: Map<string, string[]>,
    elementPhysicalBoundaries: Map<string, string[]>,
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

      // Check which interfaces this dataflow passes through.
      //
      // Two detection rules:
      //
      // Rule 1 — Geometric: The DataFlow line (source→target, with waypoints)
      //   intersects the Interface bounding box.
      //   Covers: EE → Interface → Process (classic external crossing).
      //
      // Rule 2 — Endpoint containment: source or target element center lies
      //   inside the Interface bounding box.
      //   Covers: DataFlows that terminate AT the interface (e.g. EE-2/Debugger
      //   → JTAG Interface), where the flow does not geometrically cross IF but
      //   one endpoint is spatially contained within it.

      const interfaceIds: string[] = [];

      for (const iface of interfaces) {
        // Rule 1: geometric intersection
        const dataflowsThrough = dfdAnalyzer.findDataflowsThroughInterface(
          iface,
          [conn],
          allElements,
        );
        if (dataflowsThrough.length > 0) {
          interfaceIds.push(iface.id);
          continue;
        }

        // Rule 2: endpoint containment — source or target element center
        // lies inside the Interface bounding box.
        // Covers: DataFlows that terminate AT the interface (e.g. Debugger → JTAG),
        // where the flow does not geometrically cross the interface rectangle
        // but one endpoint is spatially inside it.
        const ifaceBox = {
          position: iface.position,
          size: iface.size,
        };

        const sourceCenter = fromElement
          ? {
              x: fromElement.position.x + fromElement.size.width / 2,
              y: fromElement.position.y + fromElement.size.height / 2,
            }
          : null;

        const targetCenter = toElement
          ? {
              x: toElement.position.x + toElement.size.width / 2,
              y: toElement.position.y + toElement.size.height / 2,
            }
          : null;

        const sourceInside =
          sourceCenter !== null &&
          geometryAnalyzer.elementInsideBoundary(
            { position: sourceCenter, size: { width: 0, height: 0 } },
            ifaceBox,
          );

        const targetInside =
          targetCenter !== null &&
          geometryAnalyzer.elementInsideBoundary(
            { position: targetCenter, size: { width: 0, height: 0 } },
            ifaceBox,
          );

        if (sourceInside || targetInside) {
          interfaceIds.push(iface.id);
          continue;
        }
      }

      const viaInterface = interfaceIds.length > 0;

      // Check if flow crosses a ChipBoundary
      const fromChips = elementChipBoundaries.get(conn.from) || [];
      const toChips = elementChipBoundaries.get(conn.to) || [];
      const fromChipSet = new Set(fromChips);
      const toChipSet = new Set(toChips);
      const crossesChipBoundary =
        fromChips.some((id) => !toChipSet.has(id)) ||
        toChips.some((id) => !fromChipSet.has(id));

      // Check if flow terminates at a ChipBoundary element directly
      const terminatesAtChipBoundary =
        fromElement.type === "ChipBoundary" ||
        toElement.type === "ChipBoundary";

      // Check if flow crosses a PhysicalBoundary (endpoints in different PB zones)
      const fromPBs = elementPhysicalBoundaries.get(conn.from) || [];
      const toPBs = elementPhysicalBoundaries.get(conn.to) || [];
      const fromPBSet = new Set(fromPBs);
      const toPBSet = new Set(toPBs);
      const crossesPhysicalBoundary =
        fromPBs.some((id) => !toPBSet.has(id)) ||
        toPBs.some((id) => !fromPBSet.has(id));

      // Check if flow terminates at a PhysicalBoundary element directly
      const terminatesAtPhysicalBoundary =
        fromElement.type === "PhysicalBoundary" ||
        toElement.type === "PhysicalBoundary";

      // Physical coupling: a DataFlow modelled with medium="physical" between a
      // transducer (Sensor/Actuator) and the physical environment (modelled as an
      // ExternalEntity). The explicit medium flag — not the endpoint types — is the
      // authoritative discriminator, so a Sensor↔EE *cyber* flow is not misread as
      // physical. Cyber controls do not apply to this edge.
      const dfProps = conn.properties as DataFlowProperties | undefined;
      const isPhysicalCoupling = dfProps?.medium === "physical";

      let physicalCouplingRole: "sensor_input" | "actuator_output" | undefined;
      if (isPhysicalCoupling) {
        if (fromElement.type === "Sensor" || toElement.type === "Sensor") {
          physicalCouplingRole = "sensor_input";
        } else if (
          fromElement.type === "Actuator" ||
          toElement.type === "Actuator"
        ) {
          physicalCouplingRole = "actuator_output";
        }
      }

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
        crossesChipBoundary,
        terminatesAtChipBoundary,
        crossesPhysicalBoundary,
        terminatesAtPhysicalBoundary,
        isPhysicalCoupling,
        physicalCouplingRole,
      });
    }

    return analysis;
  }

  public deriveExposureLevels(
    elements: DFDElement[],
    connections: DFDConnection[],
    dataFlowAnalysis: Map<string, DataFlowAnalysis>,
    elementTrustBoundaries: Map<string, string[]>,
    elementChipBoundaries: Map<string, string[]>,
    // PhysicalBoundary uses PEL0–PEL4 scale, mapped 1:1 to EL0–EL4.
    // Used as final fallback when neither TB nor ChipBoundary provides an EL.
    _elementPhysicalBoundaries?: Map<string, string[]>,
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
        const tbEL = (tb?.properties as TrustBoundaryProperties)
          ?.defaultExposureLevel;
        derivedEL = maxEL(derivedEL, tbEL);
      }
      const canDerive =
        props.exposureLevelSource === "derived" || !props.exposureLevel;

      if (derivedEL && canDerive) {
        (element.properties as InterfaceProperties).exposureLevel =
          derivedEL as ExposureLevel;
        (element.properties as InterfaceProperties).exposureLevelSource =
          "derived";
      } else if (!derivedEL && props.exposureLevelSource === "derived") {
        (element.properties as InterfaceProperties).exposureLevel = undefined;
        (element.properties as InterfaceProperties).exposureLevelSource =
          undefined;
      }
    }

    // Interface inside ChipBoundary: derive EL from ChipBoundary if no TB-EL found
    for (const element of elements) {
      if (element.type !== "Interface") continue;
      const props = element.properties as InterfaceProperties;
      if (props.exposureLevelSource === "manual") continue;
      if (props.exposureLevel) continue; // Already derived from TB

      const chipIds = elementChipBoundaries.get(element.id) ?? [];
      let derivedEL: string | undefined;
      for (const chipId of chipIds) {
        const chip = elements.find((e) => e.id === chipId);
        const chipEL = (chip?.properties as ChipBoundaryProperties)
          ?.defaultExposureLevel;
        derivedEL = maxEL(derivedEL, chipEL);
      }

      if (derivedEL) {
        (element.properties as InterfaceProperties).exposureLevel =
          derivedEL as ExposureLevel;
        (element.properties as InterfaceProperties).exposureLevelSource =
          "derived";
      }
    }

    // Interface inside PhysicalBoundary: derive EL from PB.physicalExposureLevel
    // as final fallback when neither a TB nor a ChipBoundary provided an EL.
    //
    // PEL and EL share the same 0–4 scale by design (both: higher = more exposed),
    // so the mapping is 1:1: PEL0→EL0, PEL1→EL1, PEL2→EL2, PEL3→EL3, PEL4→EL4.
    //
    // Rationale: a PhysicalBoundary without an overlapping TrustBoundary is a valid
    // modelling pattern for purely physical access contexts (e.g. a sealed enclosure
    // with on-board debug interfaces but no logical network boundary). Without this
    // loop those interfaces would have no EL at all, making threat feasibility scoring
    // impossible. The PB.physicalExposureLevel is the best available approximation.
    for (const element of elements) {
      if (element.type !== "Interface") continue;
      const props = element.properties as InterfaceProperties;
      if (props.exposureLevelSource === "manual") continue;
      if (props.exposureLevel) continue; // Already derived from TB or ChipBoundary

      const pbIds = _elementPhysicalBoundaries?.get(element.id) ?? [];
      let derivedEL: string | undefined;

      for (const pbId of pbIds) {
        const pb = elements.find((e) => e.id === pbId);
        const pbProps = pb?.properties as
          | PhysicalBoundaryProperties
          | undefined;
        // physicalExposureLevel is "PEL0"–"PEL4"; strip the "PEL" prefix to get "EL0"–"EL4"
        const pel = pbProps?.physicalExposureLevel;
        if (pel) {
          const mappedEL = ("EL" + pel.slice(3)) as ExposureLevel;
          derivedEL = maxEL(derivedEL, mappedEL);
        }
      }

      if (derivedEL) {
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
        const tbEL = (tb?.properties as TrustBoundaryProperties)
          ?.defaultExposureLevel;
        derivedEL = maxEL(derivedEL, tbEL);
      }
      const canDerive =
        props?.exposureLevelSource === "derived" || !props?.exposureLevel;

      if (derivedEL && canDerive) {
        if (!conn.properties) conn.properties = {};
        (conn.properties as DataFlowProperties).exposureLevel =
          derivedEL as ExposureLevel;
        (conn.properties as DataFlowProperties).exposureLevelSource = "derived";
      } else if (!derivedEL && props?.exposureLevelSource === "derived") {
        (conn.properties as DataFlowProperties).exposureLevel = undefined;
        (conn.properties as DataFlowProperties).exposureLevelSource = undefined;
      }
    }
  }

  /**
   * Derive TransducerLocation (internal / external / boundary_spanning) for every
   * Sensor and Actuator from PhysicalBoundary containment — the SSOT for a
   * transducer's topological position (@see transducer-properties.ts).
   *
   * Geometry → location:
   *   - touches no PhysicalBoundary            → "external"
   *       (sensing surface faces the environment directly)
   *   - crosses ≥1 PhysicalBoundary edge       → "boundary_spanning"
   *       (the typical mount: body inside, sensing/acting side outside — and the
   *        security-relevant case, since the transducer bridges a physical barrier;
   *        this wins even when the element also sits inside a larger enclosure)
   *   - fully inside every overlapping PB      → "internal"
   *
   * Respects a manual override: when locationProvenance === "override" the analyst
   * value is left untouched (e.g. probe body internal, sensing tip protruding,
   * where geometry alone cannot tell). Derived values are stamped "derived".
   */
  private deriveTransducerLocations(
    elements: DFDElement[],
    elementPhysicalBoundaries: Map<string, string[]>,
  ): void {
    const pbById = new Map(
      elements
        .filter((e) => e.type === "PhysicalBoundary")
        .map((pb) => [pb.id, pb] as const),
    );

    for (const element of elements) {
      if (element.type !== "Sensor" && element.type !== "Actuator") continue;

      const props = element.properties as SensorProperties | ActuatorProperties;

      // Never overwrite an analyst override.
      if (props.locationProvenance === "override") continue;

      const overlappingPbIds = elementPhysicalBoundaries.get(element.id) ?? [];

      let location: TransducerLocation;
      if (overlappingPbIds.length === 0) {
        location = "external";
      } else {
        const elementBox = getBoundingBox(element);
        // Membership is overlap-based, so each overlapping PB is either
        // fully-containing or edge-spanning relative to this element.
        const spansABoundary = overlappingPbIds.some((pbId) => {
          const pb = pbById.get(pbId);
          return pb
            ? !isCompletelyContained(elementBox, getBoundingBox(pb))
            : false;
        });
        location = spansABoundary ? "boundary_spanning" : "internal";
      }

      props.location = location;
      props.locationProvenance = "derived";
    }
  }
}