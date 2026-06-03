// ==================== PER-ELEMENT TYPES ====================
// Types specific to STRIDE per-element threat modeling method

import type { DFDElementReference, StrideCategory } from "shared";
import type { LinkedDFDElement } from "shared";

// ==================== STRIDE MAPPING ====================

/**
 * STRIDE categories applicable per DFD element type
 * Based on TARA Table 2
 * Chipboundary:
 * T — Firmware/Bitstream/Key Tampering
 * I — Readback, Side-Channel, Key Extraction
 * E — JTAG Privilege Escalation, Secure Boot Bypass
 */
export const STRIDE_PER_ELEMENT_TYPE: Record<string, StrideCategory[]> = {
  ExternalEntity: ["S", "R"],
  Process: ["S", "T", "R", "I", "D", "E"],
  Multiprocess: ["S", "T", "R", "I", "D", "E"],
  DataFlow: ["T", "I", "D"],
  DataStore: ["T", "R", "I", "D"],
  PhysicalInterface: ["S", "T", "R", "I", "D", "E"],
  Interface: ["S", "T", "R", "I", "D", "E"],
  ChipBoundary: ["T", "I", "E"],
  PhysicalBoundary: ["S", "T", "R", "I", "D", "E"],
};


// ==================== ELEMENT CHANGE ====================

/**
 * Detected change in an Element reference during sync
 */
export interface ElementChange {
  threatId: string;
  oldRef: LinkedDFDElement;
  newRef: DFDElementReference;
  changes: ("name" | "id" | "type")[];
}

// ==================== ID GENERATION ====================

/**
 * Generate threat ID for STRIDE-per-element method
 * Format: {ElementID}-{STRIDE}-{Number}
 * Example: P-1-S-1, DS-1-T-1
 */
export function generateThreatIdPerElement(
  elementId: string,
  strideCategory: StrideCategory,
  sequenceNumber: number
): string {
  // Normalize: "P-1" -> "P1" (remove dashes)
  const normalizedId = elementId.replace(/-/g, "");
  return `${normalizedId}-${strideCategory}-${sequenceNumber}`;
}

/**
 * Generate threat ID for Interface elements
 * Format: {TrustBoundaryID}-IF-{InterfaceID}-{STRIDE}-{Number}
 * Example: TB1-IF-USB1-T-1
 */
export function generateThreatIdForInterface(
  trustBoundaryId: string,
  interfaceId: string,
  strideCategory: StrideCategory,
  sequenceNumber: number
): string {
  // Normalize: "IF-1" -> "IF1" (remove dashes)
  const normalizedId = interfaceId.replace(/-/g, "");
  return `${trustBoundaryId}-${normalizedId}-${strideCategory}-${sequenceNumber}`;
}

// ==================== TYPE GUARDS ====================

/**
 * Check if element type has applicable STRIDE categories
 */
export function hasApplicableStride(elementType: string): boolean {
  const categories = STRIDE_PER_ELEMENT_TYPE[elementType];
  return categories !== undefined && categories.length > 0;
}

/**
 * Get applicable STRIDE categories for an element type
 */
export function getApplicableStrideCategories(
  elementType: string
): StrideCategory[] {
  return STRIDE_PER_ELEMENT_TYPE[elementType] || [];
}

/**
 * Check if a threat is an Interface threat
 */
export function isInterfaceThreat(linkedElement: LinkedDFDElement | null): boolean {
  if (!linkedElement) return false;
  return linkedElement.elementType === "Interface";
}