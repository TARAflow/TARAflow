// ==================== USE SECURITY DRIFT ====================
// App-layer hook: computes SecurityDrift[] by comparing three states per element:
//
//   SHOULD  = ControlInstance (derived from Risk decisions)
//   WAS     = SecurityControlRecord (persisted on element via Apply or manual)
//   IS      = element.properties[property] (current actual value in DFD)
//
// Drift status:
//   aligned  → IS === SHOULD.expectedValue  (property correctly set)
//   missing  → no WAS, IS empty/wrong       (nothing done yet)
//   drift    → WAS exists, but IS has changed away from expectedValue
//              (someone reverted the property after Apply)
//   conflict → IS is set to something, but differs from SHOULD.expectedValue
//              AND differs from what WAS recorded (three-way conflict)
//
// Output consumed by DFDNotificationsPanel (conflict warnings) and
// SecurityControlOwnershipDisplay (per-element status badges).

import { useMemo } from "react";
import type { ControlInstance } from "shared/models/control-instance";
import type { DFDData } from "features/dfd/models/dfd-types";
import type { SecurityControlRecord } from "features/dfd/models/element-properties";

// ==================== TYPES ====================

export type DriftStatus = "aligned" | "missing" | "drift" | "conflict";

export interface SecurityDrift {
  /** Same key format as ControlInstance: "{elementId}::{property}::{expectedValue}" */
  instanceKey: string;

  elementId: string;
  property: string;

  /** What the Risk decision requires */
  expectedValue: unknown;

  /** What IS currently on the element */
  currentValue: unknown;

  /** What WAS applied (from securityControlOwnership), undefined if never applied */
  recordedValue: unknown;

  /** Computed drift status */
  status: DriftStatus;

  /** Source mitigation IDs for traceability */
  coversMitigationIds: string[];

  /** Source risk IDs for traceability */
  coversRiskIds: string[];

  /**
   * Conflict detail — only present when status = "conflict" or "drift".
   * Explains the three-way discrepancy for the analyst.
   */
  conflictDetail?: {
    /** "IS !== SHOULD but WAS === SHOULD" → drifted after apply */
    isDriftAfterApply: boolean;
    /** "IS is set but !== SHOULD and no WAS" → manual override conflict */
    isManualOverride: boolean;
    /** Who set it according to WAS record */
    setBy?: SecurityControlRecord["setBy"];
    /** When it was last applied */
    setAt?: string;
  };
}

// ==================== HELPERS ====================

const EMPTY_VALUES = new Set([undefined, null, "", "none", "not_specified", false]);

function isEmptyValue(value: unknown): boolean {
  return EMPTY_VALUES.has(value as any);
}

/**
 * Compute drift status from the three-way comparison.
 *
 * IS      = currentValue (actual property value on element)
 * SHOULD  = expectedValue (from ControlInstance / Risk decision)
 * WAS     = recordedValue (from SecurityControlRecord, may be undefined)
 */
function computeDriftStatus(
  currentValue: unknown,
  expectedValue: unknown,
  recordedValue: unknown
): DriftStatus {
  const isCorrect = !isEmptyValue(currentValue) && currentValue === expectedValue;

  if (isCorrect) return "aligned";

  // Not correct. Was it ever applied?
  if (recordedValue === undefined) {
    // Never applied, and not set correctly either
    if (isEmptyValue(currentValue)) return "missing";
    // IS is set to something, but it's wrong and there's no WAS record
    return "conflict";
  }

  // WAS exists — something was applied previously
  if (currentValue === recordedValue) {
    // IS matches WAS but not SHOULD → the record is stale (SHOULD changed)
    return "conflict";
  }

  // IS differs from both WAS and SHOULD → drifted after apply
  return "drift";
}

function buildConflictDetail(
  status: DriftStatus,
  currentValue: unknown,
  expectedValue: unknown,
  record: SecurityControlRecord | undefined
): SecurityDrift["conflictDetail"] | undefined {
  if (status !== "conflict" && status !== "drift") return undefined;

  return {
    isDriftAfterApply: status === "drift",
    isManualOverride:
      status === "conflict" &&
      !isEmptyValue(currentValue) &&
      currentValue !== expectedValue &&
      record === undefined,
    setBy: record?.setBy,
    setAt: record?.setAt,
  };
}

// ==================== HOOK ====================

/**
 * Computes SecurityDrift[] from ControlInstances and current DFD state.
 *
 * Inputs:
 *   controlInstances — derived from useControlInstanceDerivation
 *   dfdData          — full DFDData (elements + connections with properties)
 *
 * Output:
 *   SecurityDrift[] — one entry per ControlInstance.
 *   Only non-aligned entries are typically relevant for display,
 *   but all are returned for completeness (filter by status at call site).
 *
 * Memoized: recomputes when controlInstances or dfdData changes.
 */
export function useSecurityDrift(
  controlInstances: ControlInstance[],
  dfdData: DFDData | null
): SecurityDrift[] {
  return useMemo(() => {
    if (controlInstances.length === 0 || !dfdData) return [];

    // Build DFD lookups
    const elementById = new Map(
      (dfdData.elements ?? []).map((e) => [e.id, e])
    );
    const connectionById = new Map(
      (dfdData.connections ?? []).map((c) => [c.id, c])
    );

    return controlInstances.map((instance) => {
      // Resolve element or connection
      const el = elementById.get(instance.elementId);
      const conn = connectionById.get(instance.elementId);

      const properties: any = el?.properties ?? conn?.properties ?? {};

      // IS — current actual value
      const currentValue = properties[instance.property];

      // WAS — find matching SecurityControlRecord on element
      const ownership: SecurityControlRecord[] =
        properties.securityControlOwnership ?? [];
      const record = ownership.find(
        (r) => r.property === instance.property
      );
      const recordedValue = record?.value;

      // Compute status
      const status = computeDriftStatus(
        currentValue,
        instance.expectedValue,
        recordedValue
      );

      return {
        instanceKey: instance.instanceKey,
        elementId: instance.elementId,
        property: instance.property,
        expectedValue: instance.expectedValue,
        currentValue,
        recordedValue,
        status,
        coversMitigationIds: instance.coversMitigationIds,
        coversRiskIds: instance.coversRiskIds,
        conflictDetail: buildConflictDetail(
          status,
          currentValue,
          instance.expectedValue,
          record
        ),
      } satisfies SecurityDrift;
    });
  }, [controlInstances, dfdData]);
}

// ==================== SELECTORS ====================

/**
 * Returns only non-aligned drift entries.
 * Use for notification counts and warning display.
 */
export function getActiveDrifts(drifts: SecurityDrift[]): SecurityDrift[] {
  return drifts.filter((d) => d.status !== "aligned");
}

/**
 * Returns drift entries for a specific element.
 */
export function getDriftsForElement(
  drifts: SecurityDrift[],
  elementId: string
): SecurityDrift[] {
  return drifts.filter((d) => d.elementId === elementId);
}

/**
 * Returns true if any conflict or drift exists for an element.
 * Use for badge rendering in DFD canvas.
 */
export function hasActiveDrift(
  drifts: SecurityDrift[],
  elementId: string
): boolean {
  return drifts.some(
    (d) => d.elementId === elementId && d.status !== "aligned"
  );
}

/**
 * Summary counts for display in panel header.
 */
export function getDriftSummary(drifts: SecurityDrift[]): {
  aligned: number;
  missing: number;
  drift: number;
  conflict: number;
  total: number;
} {
  const counts = { aligned: 0, missing: 0, drift: 0, conflict: 0 };
  for (const d of drifts) counts[d.status]++;
  return { ...counts, total: drifts.length };
}