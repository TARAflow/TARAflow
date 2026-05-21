// ==================== CONNECTION VALIDATOR ====================
// Single Responsibility: Validate DFD connections (dataflows)

import type { DFDElement, DFDConnection } from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";

/**
 * Validate all connections
 */
export function validateConnections(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: string[],
  warnings: string[]
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
  errors: string[]
): void {
  const elementIds = new Set(elements.map((e) => e.id));

  for (const conn of connections) {
    if (!elementIds.has(conn.from)) {
      errors.push(
        `${ValidationMessages.INVALID_DATAFLOW_SOURCE}:${conn.name || conn.id}`,
      );
    }
    if (!elementIds.has(conn.to)) {
      errors.push(
        `${ValidationMessages.INVALID_DATAFLOW_TARGET}:${conn.name || conn.id}`,
      );
    }
  }
}

/**
 * Check for connections missing ID labels
 */
function validateConnectionIdLabels(
  connections: DFDConnection[],
  warnings: string[]
): void {
  for (const connection of connections) {
    const hasDisplayId = Boolean(connection.displayId);
    const hasIdInLabel =
      connection.name && /\[DF-?\d+\]/i.test(connection.name);

    if (!hasDisplayId && !hasIdInLabel) {
      const label = connection.name || `Connection ${connection.id}`;
      warnings.push(`${ValidationMessages.ELEMENT_MISSING_IDLABEL}:${label}`);
    }
  }
}

/**
 * Check for duplicate connection ID labels
 */
export function validateDuplicateConnectionIdLabels(
  connections: DFDConnection[],
  warnings: string[]
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
      warnings.push(`${ValidationMessages.DUPLICATE_IDLABEL}:${id}`);
    }
  });
}

/**
 * Validate unconnected dataflows
 */
export function validateUnconnectedDataflows(
  unconnectedDataflows: string[] | undefined,
  warnings: string[]
): void {
  if (!unconnectedDataflows || unconnectedDataflows.length === 0) return;

  unconnectedDataflows.forEach((label) => {
    warnings.push(`${ValidationMessages.UNCONNECTED_DATAFLOW}:${label}`);
  });
}

/**
 * Check for unconnected elements
 */
export function validateUnconnectedElements(
  elements: DFDElement[],
  connections: DFDConnection[],
  warnings: string[]
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
  ];

  elements.forEach((element) => {
    if (connectableTypes.includes(element.type)) {
      if (!connectedIds.has(element.id)) {
        warnings.push(
          `${ValidationMessages.UNCONNECTED_ELEMENT}:${element.name || element.id}`
        );
      }
    }
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
  errors: string[],
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
      errors.push(
        `${ValidationMessages.CHIPBOUNDARY_INVALID_CONNECTION}:${conn.name || conn.id} [${other.type}]`,
      );
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
  errors: string[],
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
    errors.push(
      `${ValidationMessages.PHYSICALBOUNDARY_INVALID_CONNECTION}:${conn.name || conn.id}`,
    );
  }
}