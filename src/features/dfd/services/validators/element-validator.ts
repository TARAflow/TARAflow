// ==================== ELEMENT VALIDATOR ====================
// Single Responsibility: Validate DFD elements

import type { DFDElement } from "../../models/dfd-types";
import { ValidationMessages, isDefaultName, validateTrustBoundaryId } from "./validator-utils";

/**
 * Validate all elements
 */
export function validateElements(
  elements: DFDElement[],
  errors: string[],
  warnings: string[]
): void {
  validateElementNames(elements, warnings);
  validateIdLabels(elements, warnings);
  validateTrustBoundaryIds(elements, errors);
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
  errors: string[]
): void {
  const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

  for (const tb of trustBoundaries) {
    const validation = validateTrustBoundaryId(tb.name);
    
    if (!validation.isValid) {
      errors.push(
        `${ValidationMessages.TRUST_BOUNDARY_MISSING_ID}:${tb.name}`
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