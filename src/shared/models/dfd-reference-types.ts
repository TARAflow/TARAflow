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

// ==================== DFD GRAPH REFERENCE ====================
// Full analysis graph snapshot — richer than DFDReference.
// Consumed by threat generators (element-generator, interaction-generator)
// and any future consumer needing boundary membership and topology.
//
// Moved here from features/threats/models/threat-types.ts so that:
//   - dfd-graph-builder.ts can import without depending on the threat feature
//   - Risk and Audit features can consume without a threat-feature import
//   - to-reference-graph.ts (app/utils) has a single source of truth
//
// Import via shared barrel:
//   import type { DFDGraphReference } from "shared"

/**
 * Minimal element descriptor in the analysis graph.
 * properties carries the parsed element properties
 * (InterfaceProperties, ProcessProperties, etc.) so threat generators
 * can read operationalState, implementedControls, technology, chipType,
 * etc. without accessing raw DFD XML.
 */
export interface DFDElementReference {
  id: string;
  type: string;
  name: string;
  displayId: string;
  properties?: Record<string, unknown>;
}

/**
 * Minimal connection descriptor in the analysis graph.
 * properties carries the parsed DataFlowProperties so threat generators
 * can read physicalPathProtection, encryptionInTransit, integrityProtection,
 * excludeFromThreatGen, etc. without accessing raw DFD XML.
 * excludeFromThreatGen and assumedTrusted are surfaced directly for
 * convenience — generators no longer need (conn as any) casts.
 */
export interface DFDConnectionReference {
  id: string;
  from: string;
  to: string;
  name?: string;
  label?: string;
  displayId: string;
  excludeFromThreatGen?: boolean;
  assumedTrusted?: boolean;
  properties?: Record<string, unknown>;
}

export interface DFDAssetReference {
  id: string;
  name: string;
}

/**
 * Per-data-flow analysis result.
 * crossesChipBoundary / crossesPhysicalBoundary added so the threat
 * generator can distinguish physical from logical boundary crossings
 * without re-running geometry analysis.
 */
export interface DataFlowAnalysisReference {
  connectionId: string;
  fromElementId: string;
  toElementId: string;
  fromElementType: string;
  toElementType: string;
  fromTrustBoundaryIds: string[];
  toTrustBoundaryIds: string[];
  fromEffectiveTrustBoundary?: string | null;
  toEffectiveTrustBoundary?: string | null;
  crossesTrustBoundary: boolean;
  crossesMultipleTrustBoundaries: boolean;
  viaInterface?: boolean;
  crossingType?: "none" | "inbound" | "outbound" | "lateral";
  /** Flow endpoints are in different ChipBoundary contexts. */
  crossesChipBoundary?: boolean;
  terminatesAtChipBoundary?: boolean;
  /** Flow endpoints are in different PhysicalBoundary zones. */
  crossesPhysicalBoundary?: boolean;
  terminatesAtPhysicalBoundary?: boolean;
}

/**
 * TrustBoundary nesting analysis.
 * parentTrustBoundaryId is undefined (not null) for root-level boundaries.
 */
export interface TrustBoundaryAnalysisReference {
  trustBoundaryId: string;
  parentTrustBoundaryId?: string;
  depth: number;
}

/**
 * Full DFD analysis graph as consumed by threat generators, risk analysis,
 * and audit features.
 *
 * Built by dfd-graph-builder.ts (features/dfd) and adapted to this shape
 * by to-reference-graph.ts (app/utils/to-reference-graph.ts).
 *
 * Boundary membership maps follow the same overlap-based logic as the
 * TrustBoundary membership, extended for ChipBoundary and PhysicalBoundary:
 *   elementChipBoundaries    elementId → chipBoundaryId[]
 *   elementPhysicalBoundaries elementId → physicalBoundaryId[]
 *
 * These maps are needed by:
 *   - interaction-generator.ts: resolves parent boundary name for Interface
 *     threats when no TrustBoundary is present (JTAG/SWD inside ChipBoundary,
 *     physical ports inside PhysicalBoundary)
 *   - element-generator.ts: PhysicalBoundary threat generation
 *   - matchesContext(): systemClass/chipType context filtering
 */
export interface DFDGraphReference {
  elementsById: Map<string, DFDElementReference>;
  connectionsById: Map<string, DFDConnectionReference>;
  assetsById: Map<string, DFDAssetReference>;

  outgoingConnections: Map<string, string[]>;
  incomingConnections: Map<string, string[]>;

  // TrustBoundary membership (overlap-based, supports nesting hierarchy)
  elementTrustBoundaries: Map<string, string[]>;
  trustBoundaryElements: Map<string, string[]>;

  // ChipBoundary membership — no nesting, overlap-based
  // Enables: JTAG/SWD interface threat routing, chipType context matching
  elementChipBoundaries: Map<string, string[]>;
  chipBoundaryElements: Map<string, string[]>;

  // PhysicalBoundary membership — no nesting, overlap-based
  // Enables: PhysicalBoundary threat generation, PB-context template matching,
  //          interface parent-name resolution in threat tables
  elementPhysicalBoundaries: Map<string, string[]>;
  physicalBoundaryElements: Map<string, string[]>;

  dataFlowAnalysis: Map<string, DataFlowAnalysisReference>;
  trustBoundaryHierarchy: Map<string, TrustBoundaryAnalysisReference>;

  // Deepest TrustBoundary per element (innermost TB wins for nesting).
  // undefined = element has no TB membership.
  effectiveElementTrustBoundary: Map<string, string | undefined>;
}

import type { DFDGraph } from "features/dfd";

/**
 * Widen the concrete builder graph to its analysis-only reference view.
 *
 * DFDGraph and DFDGraphReference are structurally identical except that the
 * reference view types `properties` as Record<string, unknown> while the
 * concrete graph uses the property unions. TS won't structurally relate the
 * two (interfaces lack an index signature), but at runtime they are the same
 * object. This is the single sanctioned boundary cast; the analysis path
 * never reads properties type-specifically.
 */
export function toGraphReference(graph: DFDGraph): DFDGraphReference {
  return graph as unknown as DFDGraphReference;
}