// ==================== USE CONTROL INSTANCE DERIVATION ====================
// App-layer hook: derives ControlInstance[] from selected mitigations in Risk Tab.
//
// Data flow:
//   project.risks.risks[]          → selected mitigation IDs per risk
//   project.threats (full objects) → element/dataFlow references (elementId, sourceId, etc.)
//   project.dfd                    → current element property values
//   mitigations catalog            → affectsProperties[] per mitigation
//
// Output consumed by DFD Tab (read-only) to display control gap warnings.
// The DFD Tab never writes back — analyst confirms updates manually.
//
// Deduplication: ControlInstance is unique by (elementId, property, expectedValue).
// Multiple mitigations/risks can reference the same instance — all sources are tracked.

import { useMemo } from "react";
import type { ThreatData } from "features/threats/models/threat-types";
import type { RiskData, SelectedMitigation } from "features/risks/models/risk-types";
import type { MitigationEntry, MitigationPropertyEffect } from "features/threats/models/threat-types";
import type { DFDData } from "features/dfd/models/dfd-types";
import type { ControlInstance, MitigationPropertyRole } from "shared";

// ==================== HELPERS ====================

const EMPTY_VALUES = new Set([undefined, null, "", "none", "not_specified", false]);

function isEmptyValue(value: unknown): boolean {
  return EMPTY_VALUES.has(value as any);
}

/**
 * Derive status by comparing the current DFD property value against expected.
 * "implemented" when already set correctly, "missing" otherwise.
 */
function deriveStatus(
  currentValue: unknown,
  expectedValue: unknown
): ControlInstance["status"] {
  if (!isEmptyValue(currentValue) && currentValue === expectedValue) {
    return "implemented";
  }
  return "missing";
}

// ==================== IDENTITY KEY ====================

function makeInstanceKey(
  elementId: string,
  property: string,
  expectedValue: unknown
): string {
  return `${elementId}::${property}::${JSON.stringify(expectedValue)}`;
}

// ==================== ELEMENT ID RESOLUTION ====================

/**
 * Resolves the target element ID from a threat + property effect.
 *
 * Per-element threat:
 *   effect.targetType must match linkedElement.elementType.
 *   effect.role is ignored (no interaction roles on per-element threats).
 *
 * Per-interaction threat:
 *   role "channel" → dataFlow.connectionId (the DataFlow itself)
 *   role "source"  → dataFlow.sourceId  (if sourceType matches effect.targetType)
 *   role "target"  → dataFlow.targetId  (if targetType matches effect.targetType)
 *   no role        → not resolvable for interaction threats (skip)
 */
function resolveTargetElementId(
  threat: {
    linkedElement: { elementId: string; elementType: string } | null;
    dataFlow: {
      connectionId?: string;
      sourceId: string;
      sourceType: string;
      targetId: string;
      targetType: string;
    } | null;
  },
  effect: MitigationPropertyEffect
): string | null {
  // Per-element threat
  if (threat.linkedElement !== null) {
    if (threat.linkedElement.elementType === effect.targetType) {
      return threat.linkedElement.elementId;
    }
    return null;
  }

  // Per-interaction threat
  if (threat.dataFlow !== null) {
    const df = threat.dataFlow;

    if (!effect.role) {
      // No role specified on a per-interaction threat — not resolvable
      return null;
    }

    switch (effect.role) {
      case "channel":
        // DataFlow itself — targetType must be "DataFlow"
        if (effect.targetType === "DataFlow" && df.connectionId) {
          return df.connectionId;
        }
        return null;

      case "source":
        // Sending element — check type matches
        if (df.sourceType === effect.targetType) {
          return df.sourceId;
        }
        return null;

      case "target":
        // Receiving element — check type matches
        if (df.targetType === effect.targetType) {
          return df.targetId;
        }
        return null;

      default:
        return null;
    }
  }

  return null;
}

// ==================== HOOK ====================

/**
 * Derives ControlInstance[] from all selected mitigations across all risks.
 *
 * Inputs (from main-layout or app-level project slice):
 *   threatData  — full ThreatData (perElementTables + perInteractionTables)
 *   riskData    — full RiskData (risks[].selectedMitigations)
 *   dfdData     — full DFDData (elements + connections with their current properties)
 *   catalog     — MitigationEntry[] with affectsProperties (from threat-catalog-service)
 *
 * Output:
 *   Deduplicated ControlInstance[] — one entry per unique (elementId, property, expectedValue).
 *   status = "implemented" when element property already matches expected value.
 *   status = "missing" when property is absent or differs.
 *   Empty array when any required input is null/empty.
 *
 * Memoized: only recomputes when threatData, riskData, dfdData or catalog changes.
 */
export function useControlInstanceDerivation(
  threatData: ThreatData | null,
  riskData: RiskData | null,
  dfdData: DFDData | null,
  catalog: MitigationEntry[]
): ControlInstance[] {
  return useMemo(() => {
    if (!threatData || !riskData || catalog.length === 0) return [];

    // Build flat threat lookup: threatId → Threat
    const threatById = new Map<string, {
      linkedElement: { elementId: string; elementType: string } | null;
      dataFlow: {
        connectionId?: string;
        sourceId: string;
        sourceType: string;
        targetId: string;
        targetType: string;
      } | null;
    }>();

    for (const table of threatData.perElementTables) {
      for (const threat of table.threats) {
        threatById.set(threat.id, {
          linkedElement: threat.linkedElement,
          dataFlow: null,
        });
      }
    }
    for (const table of threatData.perInteractionTables) {
      for (const threat of table.threats) {
        threatById.set(threat.id, {
          linkedElement: null,
          dataFlow: threat.dataFlow,
        });
      }
    }

    // Build mitigation catalog lookup: mitigationId → MitigationEntry
    const catalogById = new Map<string, MitigationEntry>();
    for (const entry of catalog) {
      catalogById.set(entry.id, entry);
    }

    // Build DFD property lookups for status derivation
    const elementById = new Map<string, { properties?: any }>();
    const connectionById = new Map<string, { properties?: any }>();
    if (dfdData) {
      for (const el of dfdData.elements ?? []) elementById.set(el.id, el);
      for (const conn of dfdData.connections ?? []) connectionById.set(conn.id, conn);
    }

    // Accumulator: instanceKey → ControlInstance (for deduplication)
    const instances = new Map<string, ControlInstance>();

    for (const risk of riskData.risks) {
      if (risk.selectedMitigations.length === 0) continue;

      // accept   → risk retained as-is, no control action needed
      // eliminate → feature/function removed entirely, no DFD property to set
      // transfer  → risk moved to third party, no internal DFD change
      // reduce    → mitigate with controls (primary case) → process
      // share     → distributed responsibility, controls may still apply → process
      if (
        risk.treatment === "accept" ||
        risk.treatment === "eliminate" ||
        risk.treatment === "transfer"
      ) continue;

      const threat = threatById.get(risk.threatId);
      if (!threat) continue;

      for (const mitigation of risk.selectedMitigations) {
        // Skip rejected mitigations — analyst decided not to implement
        if (mitigation.status === "rejected") continue;

        const mitigationId = mitigation.id;
        if (!mitigationId) continue; // custom entries have no catalog ID

        const catalogEntry = catalogById.get(mitigationId);
        if (!catalogEntry || !catalogEntry.affectsProperties?.length) continue;

        for (const effect of catalogEntry.affectsProperties) {
          // Apply scopeOverride for per-interaction threats:
          // If analyst restricted scope, skip effects whose role is not included.
          if (
            mitigation.scopeOverride !== undefined &&
            mitigation.scopeOverride.length > 0 &&
            threat.dataFlow !== null // only applies to per-interaction threats
          ) {
            const roleMatches =
              effect.role === undefined
                ? true // no role = applies universally regardless of scope
                : (mitigation.scopeOverride as MitigationPropertyRole[]).includes(
                    effect.role as MitigationPropertyRole
                  );
            if (!roleMatches) continue;
          }

          const elementId = resolveTargetElementId(threat, effect);
          if (!elementId) continue;

          // Read current property value from DFD for status derivation
          const el = elementById.get(elementId);
          const conn = connectionById.get(elementId);
          const currentValue = el?.properties?.[effect.property]
            ?? conn?.properties?.[effect.property];

          const status = deriveStatus(currentValue, effect.expectedValue);
          const key = makeInstanceKey(elementId, effect.property, effect.expectedValue);

          const existing = instances.get(key);
          if (existing) {
            // Keep "implemented" if any source sees it as already satisfied
            if (status === "implemented") existing.status = "implemented";
            // Deduplicate: merge source tracking arrays
            if (!existing.coversMitigationIds.includes(mitigationId)) {
              existing.coversMitigationIds.push(mitigationId);
            }
            if (!existing.coversRiskIds.includes(risk.id)) {
              existing.coversRiskIds.push(risk.id);
            }
            if (!existing.coversThreatIds.includes(risk.threatId)) {
              existing.coversThreatIds.push(risk.threatId);
            }
          } else {
            instances.set(key, {
              instanceKey: key,
              elementId,
              property: effect.property,
              expectedValue: effect.expectedValue,
              status,
              source: "inferred",
              inferenceConfidence: effect.confidence,
              coversMitigationIds: [mitigationId],
              coversRiskIds: [risk.id],
              coversThreatIds: [risk.threatId],
            });
          }
        }
      }
    }

    return Array.from(instances.values());
  }, [threatData, riskData, dfdData, catalog]);
}

// ==================== SELECTOR HELPERS ====================

/**
 * Returns all ControlInstances for a specific DFD element ID.
 * Use in DFD Tab to check which controls are required for an element.
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