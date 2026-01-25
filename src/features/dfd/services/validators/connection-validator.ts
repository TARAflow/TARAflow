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
        `${ValidationMessages.INVALID_DATAFLOW_SOURCE}:${conn.label || conn.id}`
      );
    }
    if (!elementIds.has(conn.to)) {
      errors.push(
        `${ValidationMessages.INVALID_DATAFLOW_TARGET}:${conn.label || conn.id}`
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
      connection.label && /\[DF-?\d+\]/i.test(connection.label);

    if (!hasDisplayId && !hasIdInLabel) {
      const label = connection.label || `Connection ${connection.id}`;
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
      idLabels.get(id)!.push(connection.label || `DataFlow ${connection.id}`);
    }

    // Also check for [DF-N] in label
    if (connection.label) {
      const match = connection.label.match(/\[(DF-?\d+)\]/i);
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
          idLabels.get(id)!.push(connection.label);
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