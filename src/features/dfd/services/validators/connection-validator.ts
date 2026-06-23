// ==================== CONNECTION VALIDATOR ====================
// Single Responsibility: Validate DFD connections (dataflows)

import type {
  DFDElement,
  DFDConnection,
  ValidationFinding,
} from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";
import type { DataFlowProperties } from "../../models/element-properties";
import type { DFDGraph } from "../../models/dfd-graph-types";

/**
 * Validate all connections
 */
export function validateConnections(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  validateConnectionsExist(connections, elements, errors);
  validateConnectionIdLabels(connections, warnings);
}

/**
 * Check if connections reference valid elements
 */
function validateConnectionsExist(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: ValidationFinding[],
): void {
  const elementIds = new Set(elements.map((e) => e.id));

  for (const conn of connections) {
    if (!elementIds.has(conn.from)) {
      errors.push({
        key: ValidationMessages.INVALID_DATAFLOW_SOURCE,
        displayId: conn.displayId,
        elementId: conn.id,
        params: { name: conn.name || conn.id },
      });
    }
    if (!elementIds.has(conn.to)) {
      errors.push({
        key: ValidationMessages.INVALID_DATAFLOW_TARGET,
        displayId: conn.displayId,
        elementId: conn.id,
        params: { name: conn.name || conn.id },
      });
    }
  }
}

/**
 * Check for connections missing ID labels
 */
function validateConnectionIdLabels(
  connections: DFDConnection[],
  warnings: ValidationFinding[],
): void {
  for (const connection of connections) {
    const hasDisplayId = Boolean(connection.displayId);
    const hasIdInLabel =
      connection.name && /\[DF-?\d+\]/i.test(connection.name);

    if (!hasDisplayId && !hasIdInLabel) {
      const label = connection.name || `Connection ${connection.id}`;
      warnings.push({
        key: ValidationMessages.ELEMENT_MISSING_IDLABEL,
        elementId: connection.id,
        params: { name: label },
      });
    }
  }
}

/**
 * Check for duplicate connection ID labels
 */
export function validateDuplicateConnectionIdLabels(
  connections: DFDConnection[],
  warnings: ValidationFinding[],
): void {
  const idLabels = new Map<string, string[]>(); // id -> [connection labels]

  for (const connection of connections) {
    if (connection.displayId) {
      const id = connection.displayId.toUpperCase();
      if (!idLabels.has(id)) {
        idLabels.set(id, []);
      }
      idLabels.get(id)!.push(connection.name || `DataFlow ${connection.id}`);
    }

    // Also check for [DF-N] in label
    if (connection.name) {
      const match = connection.name.match(/\[(DF-?\d+)\]/i);
      if (match) {
        const id = match[1].toUpperCase();
        if (!idLabels.has(id)) {
          idLabels.set(id, []);
        }
        // Only add if not already added via displayId
        if (
          !connection.displayId ||
          connection.displayId.toUpperCase() !== id
        ) {
          idLabels.get(id)!.push(connection.name);
        }
      }
    }
  }

  // Report duplicates
  idLabels.forEach((names, id) => {
    if (names.length > 1) {
      warnings.push({
        key: ValidationMessages.DUPLICATE_IDLABEL,
        params: { id },
      });
    }
  });
}

/**
 * Validate unconnected dataflows
 */
export function validateUnconnectedDataflows(
  unconnectedDataflows: string[] | undefined,
  warnings: ValidationFinding[],
): void {
  if (!unconnectedDataflows || unconnectedDataflows.length === 0) return;

  unconnectedDataflows.forEach((label) => {
    warnings.push({
      key: ValidationMessages.UNCONNECTED_DATAFLOW,
      params: { name: label },
    });
  });
}

/**
 * Check for unconnected elements.
 *
 * A ChipBoundary models connectivity in two ways:
 *   (A) direct DataFlow endpoint        — e.g. Developer -> JTAG -> MCU (R9)
 *   (B) spatial container whose enclosed elements carry the flows
 *       — e.g. Application + Firmware inside the chip die.
 * Mirror validateInterfaceUsage: treat the boundary as connected when an
 * enclosed element participates in a DataFlow, not only when the boundary
 * itself is conn.from / conn.to. The `graph` arg supplies the containment map
 * (elementChipBoundaries); when absent only path (A) applies, so a genuinely
 * empty chip is still flagged.
 */
export function validateUnconnectedElements(
  elements: DFDElement[],
  connections: DFDConnection[],
  warnings: ValidationFinding[],
  graph?: DFDGraph,
): void {
  const connectedIds = new Set<string>();

  // Collect all element IDs that have connections
  connections.forEach((conn) => {
    connectedIds.add(conn.from);
    connectedIds.add(conn.to);
  });

  // Check connectable elements
  const connectableTypes = [
    "Process",
    "Multiprocess",
    "DataStore",
    "ExternalEntity",
    "ChipBoundary",
    "Sensor",
    "Actuator",
  ];

  // Path (B): a ChipBoundary counts as connected when any element it encloses
  // participates in a DataFlow. Uses the geometric membership map already built
  // for validateChipBoundaryDebugInterfaces / validateInterfacePhysicalBoundary.
  const chipHasConnectedMember = (chipId: string): boolean => {
    if (!graph?.elementChipBoundaries) return false;
    for (const [elementId, chipIds] of graph.elementChipBoundaries) {
      if (chipIds.includes(chipId) && connectedIds.has(elementId)) return true;
    }
    return false;
  };

  elements.forEach((element) => {
    if (!connectableTypes.includes(element.type)) return;
    if (connectedIds.has(element.id)) return;

    // Containment fallback — enclosed elements carry the connectivity.
    if (element.type === "ChipBoundary" && chipHasConnectedMember(element.id)) {
      return;
    }

    warnings.push({
      key: ValidationMessages.UNCONNECTED_ELEMENT,
      displayId: element.displayId,
      elementId: element.id,
      params: { type: element.type, name: element.name || element.id },
    });
  });
}

/**
 * R9: ChipBoundary may only connect to ExternalEntity, Process, or ChipBoundary.
 * DataStore and TrustBoundary connections are semantically invalid.
 *
 * Severity: error — DataStore→ChipBoundary has no valid threat modelling meaning.
 *
 * Valid:   ExternalEntity ↔ ChipBoundary  (e.g. Developer → JTAG → MCU)
 * Valid:   Process        ↔ ChipBoundary  (e.g. Linux Driver → I2C → SE)
 * Valid:   ChipBoundary   ↔ ChipBoundary  (e.g. MCU → SPI → SE)
 * Invalid: DataStore      ↔ ChipBoundary
 * Invalid: TrustBoundary  ↔ ChipBoundary
 * Invalid: Multiprocess   ↔ ChipBoundary  (use Process inside Multiprocess instead)
 */
export function validateChipBoundaryConnections(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: ValidationFinding[],
): void {
  const elementById = new Map(elements.map((e) => [e.id, e]));

  const FORBIDDEN_WITH_CHIPBOUNDARY = new Set([
    "DataStore",
    "TrustBoundary",
    "Multiprocess",
  ]);

  for (const conn of connections) {
    const source = elementById.get(conn.from);
    const target = elementById.get(conn.to);

    if (!source || !target) continue;

    const sourceIsChip = source.type === "ChipBoundary";
    const targetIsChip = target.type === "ChipBoundary";

    if (!sourceIsChip && !targetIsChip) continue;

    // Check the non-ChipBoundary side
    const other = sourceIsChip ? target : source;

    if (FORBIDDEN_WITH_CHIPBOUNDARY.has(other.type)) {
      errors.push({
        key: ValidationMessages.CHIPBOUNDARY_INVALID_CONNECTION,
        displayId: conn.displayId,
        elementId: conn.id,
        params: { name: `${conn.name || conn.id} [${other.type}]` },
      });
    }
  }
}
/**
 * R10: PhysicalBoundary is non-connectable — no DataFlow may use it as endpoint.
 *
 * Physical Boundaries are spatial containers, not communication endpoints.
 * Interaction through a PhysicalBoundary is modelled via an Interface element
 * that geometrically overlaps the boundary — not via a direct DataFlow connection.
 *
 * Severity: error — a DataFlow terminating at a PhysicalBoundary has no valid
 * threat modelling meaning and indicates a modelling mistake.
 *
 * Invalid: Any element ↔ PhysicalBoundary (direct DataFlow connection)
 * Correct: Interface overlaps PhysicalBoundary geometrically (no DataFlow needed)
 *
 * Note: This is intentionally stricter than ChipBoundary (which allows
 * ExternalEntity/Process/ChipBoundary connections). PhysicalBoundary is purely
 * a spatial container — it has no communication interface of its own.
 */
export function validatePhysicalBoundaryConnections(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: ValidationFinding[],
): void {
  const elementById = new Map(elements.map((e) => [e.id, e]));

  for (const conn of connections) {
    const source = elementById.get(conn.from);
    const target = elementById.get(conn.to);

    if (!source || !target) continue;

    const sourceIsPB = source.type === "PhysicalBoundary";
    const targetIsPB = target.type === "PhysicalBoundary";

    if (!sourceIsPB && !targetIsPB) continue;

    // Any direct connection to/from a PhysicalBoundary is invalid
    errors.push({
      key: ValidationMessages.PHYSICALBOUNDARY_INVALID_CONNECTION,
      displayId: conn.displayId,
      elementId: conn.id,
      params: { name: conn.name || conn.id },
    });
  }
}
/**
 * R11 / R12: Sensor and Actuator (transducers) connection topology.
 *
 * A transducer has two sides, distinguished by the DataFlow `medium`:
 *   - physical side (medium="physical"): the coupling to the sensed/actuated
 *     world — the other end MUST be an ExternalEntity.
 *   - cyber side (medium logical/undefined): the signal/command — the other end
 *     MUST be a Process, Multiprocess or Interface.
 *
 * Rationale (see taraflow-asset-beziehungen.md §Sensor/§Actuator):
 *   Our smart sensor = Process (+ Sensor symbol); a foreign smart sensor is an
 *   ExternalEntity with NO Sensor symbol. So an ExternalEntity is valid at a
 *   transducer only on the physical edge.
 *
 * Severity: error for the forbidden topologies. A transducer with only a cyber
 * connection (Sensor → Process) is a complete, valid model — the physical
 * coupling (medium=physical to an ExternalEntity) is OPTIONAL, so its absence is
 * not flagged. A fully unconnected transducer is covered by
 * validateUnconnectedElements.
 *
 * Valid:   Sensor/Actuator ─physical─ ExternalEntity
 * Valid:   Sensor/Actuator ─cyber────  Process | Multiprocess | Interface
 * Valid:   Sensor ↔ Actuator (dual-role / feedback) — no endpoint rule
 * Invalid: ExternalEntity on a non-physical edge   → TRANSDUCER_EE_NOT_PHYSICAL
 * Invalid: physical medium to a cyber endpoint      → TRANSDUCER_PHYSICAL_MEDIUM_INVALID_ENDPOINT
 * Invalid: DataStore / boundaries                   → SENSOR/ACTUATOR_INVALID_CONNECTION
 */
export function validateTransducerConnections(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: ValidationFinding[],
): void {
  const elementById = new Map(elements.map((e) => [e.id, e]));

  const TRANSDUCER_TYPES = new Set(["Sensor", "Actuator"]);
  const VALID_CYBER_ENDPOINTS = new Set([
    "Process",
    "Multiprocess",
    "Interface",
  ]);

  for (const conn of connections) {
    const source = elementById.get(conn.from);
    const target = elementById.get(conn.to);
    if (!source || !target) continue;

    const sourceIsTransducer = TRANSDUCER_TYPES.has(source.type);
    const targetIsTransducer = TRANSDUCER_TYPES.has(target.type);
    if (!sourceIsTransducer && !targetIsTransducer) continue;

    // Transducer ↔ transducer (dual-role / feedback) — allowed, no endpoint rule.
    if (sourceIsTransducer && targetIsTransducer) continue;

    const transducer = sourceIsTransducer ? source : target;
    const other = sourceIsTransducer ? target : source;

    const medium = (conn.properties as DataFlowProperties | undefined)?.medium;
    const isPhysical = medium === "physical";

    const invalidKey =
      transducer.type === "Sensor"
        ? ValidationMessages.SENSOR_INVALID_CONNECTION
        : ValidationMessages.ACTUATOR_INVALID_CONNECTION;

    if (other.type === "ExternalEntity") {
      // EE endpoint must be the physical coupling (medium="physical").
      if (!isPhysical) {
        errors.push({
          key: ValidationMessages.TRANSDUCER_EE_NOT_PHYSICAL,
          displayId: conn.displayId,
          elementId: conn.id,
          params: { type: transducer.type, name: conn.name || conn.id },
        });
      }
    } else if (VALID_CYBER_ENDPOINTS.has(other.type)) {
      // physical medium is only valid towards an ExternalEntity.
      if (isPhysical) {
        errors.push({
          key: ValidationMessages.TRANSDUCER_PHYSICAL_MEDIUM_INVALID_ENDPOINT,
          displayId: conn.displayId,
          elementId: conn.id,
          params: {
            type: transducer.type,
            targetType: other.type,
            name: conn.name || conn.id,
          },
        });
      }
      // else: valid cyber signal / command
    } else {
      // DataStore, boundaries, etc. — invalid endpoint for a transducer.
      errors.push({
        key: invalidKey,
        displayId: conn.displayId,
        elementId: conn.id,
        params: { targetType: other.type, name: conn.name || conn.id },
      });
    }
  }
}