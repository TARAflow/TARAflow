// ==================== MITIGATION COVERAGE ====================
// Pure utility: checks whether a mitigation is already implemented
// in the current DFD model by comparing element property values
// against catalog affectsProperties expectations.
//
// Used by Risk Dialog and Threat Dialog to show "✓ Already implemented"
// badges on mitigation checkboxes/entries.
//
// Location: src/shared/utils/mitigation-coverage.ts

import type { MitigationPropertyRole, DFDReference } from "shared";

// ==================== TYPES ====================

export interface MitigationPropertyCoverage {
  elementId: string;
  property: string;
  expectedValue: unknown;
  currentValue: unknown;
  /** True when currentValue === expectedValue and is non-empty */
  isCovered: boolean;
}

export interface MitigationCoverage {
  mitigationId: string;
  /** True when ALL affectsProperties entries are covered */
  fullyImplemented: boolean;
  /** True when SOME (but not all) affectsProperties entries are covered */
  partiallyImplemented: boolean;
  /** Per-property coverage details */
  details: MitigationPropertyCoverage[];
}

// ==================== MINIMAL CATALOG SHAPE ====================
// Structural types — MitigationEntry from threat-types is assignable to these.

interface MitigationEffectShape {
  targetType: string;
  role?: MitigationPropertyRole;
  property: string;
  expectedValue: unknown;
}

interface MitigationEntryShape {
  id: string;
  affectsProperties?: MitigationEffectShape[];
}

// ==================== THREAT SHAPE ====================
// Structural type — ThreatReference and Threat are assignable to this
// once linkedElement and dataFlow fields are present.

export interface ThreatForCoverage {
  linkedElement?: { elementId: string; elementType: string } | null;
  dataFlow?: {
    connectionId?: string;
    sourceId: string;
    sourceType: string;
    targetId: string;
    targetType: string;
  } | null;
}

// ==================== HELPERS ====================

const EMPTY_VALUES = new Set([undefined, null, "", "none", "not_specified", false]);

function isEmptyValue(v: unknown): boolean {
  return EMPTY_VALUES.has(v as any);
}

function resolveTargetElementId(
  threat: ThreatForCoverage,
  effect: MitigationEffectShape,
): string | null {
  if (threat.linkedElement) {
    return threat.linkedElement.elementType === effect.targetType
      ? threat.linkedElement.elementId
      : null;
  }

  if (threat.dataFlow) {
    const df = threat.dataFlow;
    if (!effect.role) return null;
    switch (effect.role) {
      case "channel":
        return effect.targetType === "DataFlow" && df.connectionId
          ? df.connectionId
          : null;
      case "source":
        return df.sourceType === effect.targetType ? df.sourceId : null;
      case "target":
        return df.targetType === effect.targetType ? df.targetId : null;
      default:
        return null;
    }
  }

  return null;
}

function readProperty(
  elementId: string,
  property: string,
  dfd: DFDReference,
): unknown {
  const el = (dfd.elements ?? []).find((e) => e.id === elementId);
  if (el) return el.properties?.[property];
  const conn = (dfd.connections ?? []).find((c) => c.id === elementId);
  if (conn) return conn.properties?.[property];
  return undefined;
}

// ==================== CORE FUNCTIONS ====================

/**
 * Computes coverage for a single mitigation against the current DFD state.
 * Returns null when the mitigation has no affectsProperties.
 */
export function computeMitigationCoverage(
  mitigationId: string,
  threat: ThreatForCoverage,
  dfdData: DFDReference | null | undefined,
  catalog: MitigationEntryShape[],
): MitigationCoverage | null {
  if (!dfdData) return null;

  const entry = catalog.find((m) => m.id === mitigationId);
  if (!entry?.affectsProperties?.length) return null;

  const details: MitigationPropertyCoverage[] = [];

  for (const effect of entry.affectsProperties) {
    const elementId = resolveTargetElementId(threat, effect);
    if (!elementId) continue;

    const currentValue = readProperty(elementId, effect.property, dfdData);
    const isCovered =
      !isEmptyValue(currentValue) && currentValue === effect.expectedValue;

    details.push({
      elementId,
      property: effect.property,
      expectedValue: effect.expectedValue,
      currentValue,
      isCovered,
    });
  }

  if (details.length === 0) return null;

  const coveredCount = details.filter((d) => d.isCovered).length;
  const fullyImplemented = coveredCount === details.length;
  const partiallyImplemented = !fullyImplemented && coveredCount > 0;

  return { mitigationId, fullyImplemented, partiallyImplemented, details };
}

/**
 * Batch coverage computation for all mitigations of a threat.
 * Returns Map<mitigationId, MitigationCoverage | null>.
 */
export function computeAllMitigationCoverage(
  mitigationIds: string[],
  threat: ThreatForCoverage,
  dfdData: DFDReference | null | undefined,
  catalog: MitigationEntryShape[],
): Map<string, MitigationCoverage | null> {
  const result = new Map<string, MitigationCoverage | null>();
  for (const id of mitigationIds) {
    result.set(id, computeMitigationCoverage(id, threat, dfdData, catalog));
  }
  return result;
}