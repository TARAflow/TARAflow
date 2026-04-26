// ==================== CONTROL INSTANCE ====================
// Derived control requirement on a specific DFD element property.
//
// Created by useControlInstanceDerivation (src/app/hooks/) when an analyst
// selects mitigations in the Risk Tab. Consumed read-only by the DFD Tab
// to display control gap warnings.
//
// Lifecycle phases:
//   Phase 1 (current): derivation only — status always "missing"
//   Phase 3 (future):  evidence pipeline — evidenceRef, implementedAt,
//                      lastVerified, staleness, confidence

// ==================== TYPES ====================

export type ControlInstanceStatus = "missing" | "partial" | "implemented";

export type ControlInferenceConfidence = "deterministic" | "heuristic";

/**
 * A derived control requirement on a specific DFD element property.
 * Unique by (elementId, property, expectedValue) — see instanceKey.
 */
export interface ControlInstance {
  /** Unique identity key: "{elementId}::{property}::{JSON(expectedValue)}" */
  instanceKey: string;

  /** Target DFD element ID or DataFlow connectionId */
  elementId: string;

  /** Property key on the *Properties interface (e.g. "encryptionInTransit") */
  property: string;

  /** Recommended value for the property after mitigation */
  expectedValue: unknown;

  /** Current status — always "missing" in Phase 1 */
  status: ControlInstanceStatus;

  /** Always "inferred" in Phase 1 (no manual/imported sources yet) */
  source: "inferred";

  /** Confidence of the property mapping from the catalog */
  inferenceConfidence: ControlInferenceConfidence;

  /** All mitigation IDs that require this control (ControlCoverage) */
  coversMitigationIds: string[];

  /** All risk IDs whose selected mitigations require this control */
  coversRiskIds: string[];

  /** All threat IDs whose mitigations produced this control */
  coversThreatIds: string[];
}

// ==================== HELPERS ====================

/**
 * Build the canonical instance key from its components.
 * Consistent with the key generated in useControlInstanceDerivation.
 */
export function makeControlInstanceKey(
  elementId: string,
  property: string,
  expectedValue: unknown
): string {
  return `${elementId}::${property}::${JSON.stringify(expectedValue)}`;
}

/**
 * Returns all ControlInstances for a specific DFD element ID.
 */
export function getControlInstancesForElement(
  instances: ControlInstance[],
  elementId: string
): ControlInstance[] {
  return instances.filter((c) => c.elementId === elementId);
}

/**
 * Returns true if any ControlInstance exists for the given element.
 * Use for DFD badge/indicator rendering.
 */
export function hasControlRequirements(
  instances: ControlInstance[],
  elementId: string
): boolean {
  return instances.some((c) => c.elementId === elementId);
}

/**
 * Returns all element IDs that have at least one control requirement.
 * Use to drive the DFD warning panel element list.
 */
export function getAffectedElementIds(instances: ControlInstance[]): string[] {
  return [...new Set(instances.map((c) => c.elementId))];
}