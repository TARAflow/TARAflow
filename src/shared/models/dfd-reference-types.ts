// ==================== DFD REFERENCE TYPES ====================
// Minimal DFD graph snapshot consumed by Threat and Risk features.
// No dependency on dfd feature types — Dependency Inversion.
//
// Consumers import directly from this file:
//   import type { DFDReference } from "shared/models/dfd-reference-types"
//   or via shared barrel: import type { DFDReference } from "shared"

// ==================== ELEMENT / CONNECTION REFS ====================

/**
 * Reference to a linked DFD element on a per-element threat.
 */
export interface LinkedDFDElement {
  /** Stable XML element ID (e.g. "10", "4", "7") */
  elementId: string;
  elementName: string;
  elementType: string;
  displayId?: string;
}

/**
 * Reference to a data flow interaction on a per-interaction threat.
 */
export interface DataFlowReference {
  connectionId?: string;
  dataFlowId: string;
  dataFlowName: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  targetId: string;
  targetName: string;
  targetType: string;
}

// ==================== DFD GRAPH SNAPSHOT ====================

/**
 * Safety severity — mirrors SafetyAnnotation.severity in dfd-types.ts.
 * Keep in sync.
 */
export type SafetySeverityRef =
  | "reversible_minor"
  | "reversible_moderate"
  | "irreversible_injury"
  | "fatality";

export interface SafetyAnnotationRef {
  severity: SafetySeverityRef;
  description?: string;
}

/** Minimal DFD process element — carries safety annotation if present. */
export interface DFDProcessRef {
  id: string;
  label: string;
  safetyAnnotation?: SafetyAnnotationRef;
}

/**
 * Minimal DFD graph snapshot consumed by Threat and Risk features.
 *
 * processes[]  → Safety annotation detection (Risk, Phase 3)
 * elements[]   → Mitigation coverage computation
 * connections[]→ Mitigation coverage computation
 *
 * The full DFDData in the dfd feature is structurally assignable to this.
 */
export interface DFDReference {
  processes?: DFDProcessRef[];
  elements?: Array<{ id: string; properties?: Record<string, unknown> }>;
  connections?: Array<{ id: string; properties?: Record<string, unknown> }>;
}

// ==================== HELPERS ====================

/**
 * True if the DFD has at least one process with a safety annotation.
 * Drives Safety factor auto-enable in the Risk feature.
 */
export function hasDFDSafetyAnnotations(
  dfd: DFDReference | null | undefined,
): boolean {
  if (!dfd?.processes) return false;
  return dfd.processes.some((p) => p.safetyAnnotation !== undefined);
}