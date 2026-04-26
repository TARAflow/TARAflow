// ==================== SHARED REFERENCE TYPES ====================
// Cross-feature reference objects shared between threats, risks, and DFD features.
//
// These types were previously scattered across feature-specific model files,
// causing cross-feature import dependencies. Moving them here breaks those cycles.
//
// Exported via shared barrel (src/shared/index.ts).
//
// Location: src/shared/reference-types.ts

// ==================== DFD REFERENCES ====================

/**
 * Reference to a linked DFD element on a per-element threat.
 * Previously: features/threats/models/per-element-types.ts
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
 * Previously: features/threats/models/per-interaction-types.ts
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

/**
 * Minimal DFD shape for shared utilities (e.g. mitigation-coverage).
 * The full DFDData in the dfd feature is structurally assignable to this.
 * Kept narrow to avoid pulling in dfd feature types.
 */
export interface DFDReference {
  elements?: Array<{ id: string; properties?: Record<string, unknown> }>;
  connections?: Array<{ id: string; properties?: Record<string, unknown> }>;
}

// ==================== ASSET REFERENCES ====================

/**
 * Lightweight asset reference used in Threat and Risk dialogs.
 * Previously: features/threats/models/threat-types.ts
 */
export interface AssetReference {
  id: string;
  name: string;
  assetGroup: string;
  aggregatedImpact?: "LOW" | "MED" | "MED+" | "HIGH" | "HIGH+" | "CRITICAL";
  physicalImpact?: "reversible_injury" | "irreversible_injury" | "fatality";
  isHighValueAsset?: "low" | "medium" | "high" | "critical";
  hasSafetyAnnotation: boolean;
  linkedElementIds?: string[];
}

/**
 * Asset data bundle passed from Asset phase into Threat and Risk dialogs.
 * Previously: features/threats/models/threat-types.ts
 */
export interface AssetDataReference {
  assets: AssetReference[];
  hasSafetyAssets: boolean;
}
