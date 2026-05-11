// ==================== DATAFLOW SEMANTIC COVERAGE ====================
//
// Replaces field-count-based incompleteFields logic with semantic coverage.
//
// Key principle: "correct by design" is NOT incomplete.
//   - electrical signal without encryption  → complete (not applicable)
//   - network flow without encryption       → incomplete (security gap)
//   - dry_contact without safetyRationale   → complete (only custom needs it)
//
// Usage:
//   const coverage = computeDataFlowCoverage(props, { crossesTrustBoundary });
//   // Replace incompleteFields.length > 0 with coverage.overall !== "complete"

import type { DataFlowProperties, ExposureLevel } from "./element-properties";
import { PROTOCOL_META } from "./protocol-registry";

// ── Types ────────────────────────────────────────────────────────────────────

export type CoverageStatus = "complete" | "partial" | "missing";

export interface DataFlowCoverage {
  /** Protocol, direction, messageType, frequency, location */
  context: CoverageStatus;
  /** Encryption, auth, integrity — N/A for electrical/physical signals */
  transportSecurity: CoverageStatus;
  /** Safety function rationale completeness */
  safety: CoverageStatus;
  /** Exclusion rationale when excludeFromThreatGen is set */
  documentation: CoverageStatus;
  /** Worst-case across all categories */
  overall: CoverageStatus;
  /**
   * Specific field keys that are semantically incomplete.
   * Use for tooltip display — replaces raw missing-field lists.
   */
  incompleteFields: (keyof DataFlowProperties)[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHYSICAL_LOCATIONS = new Set<string>([
  "on_chip",
  "on_board",
  "in_enclosure",
  "field_cable",
]);

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Computes semantic coverage for a DataFlow element.
 * Aware of protocol group — electrical signals are not flagged
 * for missing encryption/auth, since those are not applicable.
 *
 * @param props      Current DataFlowProperties
 * @param options    Context from parent (trust boundary state)
 */
export function computeDataFlowCoverage(
  props: DataFlowProperties,
  options?: { crossesTrustBoundary?: boolean },
): DataFlowCoverage {
  const { crossesTrustBoundary = false } = options ?? {};

  const selectedMeta = props.protocol
    ? PROTOCOL_META[props.protocol]
    : undefined;
  const isElectrical = selectedMeta?.group === "electrical";
  const requiresPhysicalAccess = props.location
    ? PHYSICAL_LOCATIONS.has(props.location)
    : isElectrical;

  // ── Context coverage ──────────────────────────────────────────────────────
  const missingContext: (keyof DataFlowProperties)[] = [];
  if (!props.protocol)     missingContext.push("protocol");
  if (!props.messageType)  missingContext.push("messageType");
  if (!props.direction)    missingContext.push("direction");
  if (!props.frequency)    missingContext.push("frequency");
  if (!props.location)     missingContext.push("location");

  // ── Transport security coverage ───────────────────────────────────────────
  // Not applicable for electrical/physical-access signals
  const missingTransport: (keyof DataFlowProperties)[] = [];
  if (!isElectrical && !requiresPhysicalAccess) {
    if (!props.encryptionInTransit)    missingTransport.push("encryptionInTransit");
    if (!props.endpointAuthentication) missingTransport.push("endpointAuthentication");
    if (!props.integrityProtection)    missingTransport.push("integrityProtection");
  }
  // Exposure level is always relevant
  if (!props.exposureLevel) missingTransport.push("exposureLevel");

  // ── Safety coverage ───────────────────────────────────────────────────────
  // Only incomplete when custom function has no rationale
  const missingSafety: (keyof DataFlowProperties)[] = [];
  const isSafetyRelevant =
    props.safetyFunction !== undefined && props.safetyFunction !== "none";
  if (isSafetyRelevant &&
      props.safetyFunction === "custom" &&
      !props.safetyRationale?.trim()) {
    missingSafety.push("safetyRationale");
  }

  // ── Documentation coverage ────────────────────────────────────────────────
  // Only incomplete when exclusion has no rationale
  const missingDoc: (keyof DataFlowProperties)[] = [];
  if (props.excludeFromThreatGen && !props.excludeFromThreatGenRationale?.trim()) {
    missingDoc.push("excludeFromThreatGenRationale");
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const context      = toStatus(missingContext.length,  5);
  const transport    = toStatus(missingTransport.length, 4);
  const safety       = toStatus(missingSafety.length,   1);
  const documentation = toStatus(missingDoc.length,    1);

  const statuses = [context, transport, safety, documentation];
  const overall: CoverageStatus =
    statuses.every((s) => s === "complete") ? "complete"
    : statuses.some((s) => s === "missing")  ? "missing"
    : "partial";

  return {
    context,
    transportSecurity: transport,
    safety,
    documentation,
    overall,
    incompleteFields: [
      ...missingContext,
      ...missingTransport,
      ...missingSafety,
      ...missingDoc,
    ],
  };
}

// ── Migration helper ──────────────────────────────────────────────────────────

/**
 * Drop-in replacement for existing incompleteFields arrays.
 * Returns field keys using the same shape as before, but
 * filtered semantically — electrical flows no longer pollute the list.
 *
 * @example
 *   // Before:
 *   const incompleteFields = REQUIRED_FIELDS.filter(f => !props[f]);
 *   // After:
 *   const incompleteFields = getIncompleteFields(props, { crossesTrustBoundary });
 */
export function getIncompleteFields(
  props: DataFlowProperties,
  options?: { crossesTrustBoundary?: boolean },
): (keyof DataFlowProperties)[] {
  return computeDataFlowCoverage(props, options).incompleteFields;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function toStatus(missing: number, total: number): CoverageStatus {
  if (missing === 0)         return "complete";
  if (missing === total)     return "missing";
  return "partial";
}