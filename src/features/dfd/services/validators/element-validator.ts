// ==================== ELEMENT VALIDATOR ====================
// Single Responsibility: Validate DFD elements

import type { DFDElement } from "../../models/dfd-types";
import { ValidationMessages, isDefaultName, validateTrustBoundaryId } from "./validator-utils";
import { validateElementProperties } from "./element-property-validator";
import type { DFDGraph } from "../../models/dfd-graph-types";

/**
 * Validate all elements
 */
export function validateElements(
  elements: DFDElement[],
  errors: string[],
  warnings: string[],
  graph: DFDGraph,
): void {
  validateElementNames(elements, warnings);
  validateIdLabels(elements, warnings);
  validateTrustBoundaryIds(elements, errors);
  validateElementProperties(elements, warnings);
  validateInterfaceUsage(elements, warnings, graph);
  validateInterfacePhysicalBoundary(elements, warnings, graph);
}

/**
 * Validate that Interfaces have at least one dataflow passing through them.
 * Message format: KEY|displayId|elementType
 */
function validateInterfaceUsage(
  elements: DFDElement[],
  warnings: string[],
  graph?: DFDGraph,
): void {
  const interfaces = elements.filter((e) => e.type === "Interface");

  for (const iface of interfaces) {
    let hasDataflow = false;

    if (graph) {
      hasDataflow = Array.from(graph.dataFlowAnalysis.values()).some(
        (analysis) => analysis.interfaceIds.includes(iface.id),
      );
    }

    if (!hasDataflow) {
      const displayId = iface.displayId ?? iface.name;
      warnings.push(
        `${ValidationMessages.INTERFACE_UNUSED}|${displayId}|Interface`,
      );
    }
  }
}

/**
 * Check for elements with default/placeholder names
 */
function validateElementNames(
  elements: DFDElement[],
  warnings: string[]
): void {
  const connectableTypes = [
    "Process",
    "Multiprocess",
    "DataStore",
    "ExternalEntity",
    "TrustBoundary",
    "ChipBoundary",
    "PhysicalBoundary",
  ];

  for (const element of elements) {
    if (!connectableTypes.includes(element.type)) continue;

    if (isDefaultName(element.name)) {
      warnings.push(
        `${ValidationMessages.ELEMENT_DEFAULT_NAME}:${element.name}`
      );
    }
  }
}

/**
 * Check for elements missing ID labels (displayId)
 */
function validateIdLabels(
  elements: DFDElement[],
  warnings: string[]
): void {
  const typesNeedingIds = [
    "Process",
    "Multiprocess",
    "DataStore",
    "ExternalEntity",
  ];

  for (const element of elements) {
    if (!typesNeedingIds.includes(element.type)) continue;

    const hasDisplayId = Boolean(element.displayId);
    const hasIdInName = /\[[A-Z]+-?\d+\]/i.test(element.name);

    if (!hasDisplayId && !hasIdInName) {
      warnings.push(
        `${ValidationMessages.ELEMENT_MISSING_IDLABEL}:${element.name}`
      );
    }
  }
}

/**
 * Validate Trust Boundary IDs
 * Must have [ID] suffix in name
 */
function validateTrustBoundaryIds(
  elements: DFDElement[],
  errors: string[],
): void {
  // Validate both TrustBoundary and ChipBoundary — same [ID] convention
  const boundaryElements = elements.filter(
    (e) =>
      e.type === "TrustBoundary" ||
      e.type === "ChipBoundary" ||
      e.type === "PhysicalBoundary",
  );

  for (const boundary of boundaryElements) {
    const validation = validateTrustBoundaryId(boundary.name);
    if (!validation.isValid) {
      errors.push(
        `${ValidationMessages.TRUST_BOUNDARY_MISSING_ID}:${boundary.name}`,
      );
    }
  }
}

/**
 * Validate that each Interface geometrically overlaps at least one PhysicalBoundary.
 *
 * Rationale: An Interface without a physical context has no defined reachability.
 * The PhysicalBoundary it overlaps determines whether an attacker must cross it
 * to reach the interface (interface on boundary edge) or must first open the
 * boundary (interface fully inside).
 *
 * Rule only fires when at least one PhysicalBoundary exists in the diagram —
 * in early modelling phases analysts may not have drawn PBs yet.
 *
 * Severity: WARNING — not an error, since PBs may be added iteratively.
 *
 * Message format: KEY|displayId|elementType
 */
function validateInterfacePhysicalBoundary(
  elements: DFDElement[],
  warnings: string[],
  graph?: DFDGraph,
): void {
  // Only enforce when at least one PB exists — otherwise rule has no context
  const hasPhysicalBoundaries = elements.some(
    (e) => e.type === "PhysicalBoundary",
  );
  if (!hasPhysicalBoundaries || !graph) return;

  const interfaces = elements.filter((e) => e.type === "Interface");

  for (const iface of interfaces) {
    const memberPBs = graph.elementPhysicalBoundaries?.get(iface.id) ?? [];

    if (memberPBs.length === 0) {
      const displayId = iface.displayId ?? iface.name;
      warnings.push(
        `${ValidationMessages.INTERFACE_NO_PHYSICAL_BOUNDARY}|${displayId}|Interface`,
      );
    }
  }
}

/**
 * Check for duplicate ID labels
 */
export function validateDuplicateIdLabels(
  elements: DFDElement[],
  warnings: string[]
): void {
  const idLabels = new Map<string, string[]>(); // id -> [element names]

  for (const element of elements) {
    if (element.displayId) {
      const id = element.displayId.toUpperCase();
      if (!idLabels.has(id)) {
        idLabels.set(id, []);
      }
      idLabels.get(id)!.push(element.name);
    }

    // Also check for [ID] in name
    const match = element.name.match(/\[([A-Z]+-?\d+)\]/i);
    if (match) {
      const id = match[1].toUpperCase();
      if (!idLabels.has(id)) {
        idLabels.set(id, []);
      }
      // Only add if not already added via displayId
      if (!element.displayId || element.displayId.toUpperCase() !== id) {
        idLabels.get(id)!.push(element.name);
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