// ==================== SHARED REFERENCE TYPES ====================
// Cross-feature reference objects shared between threats, risks, and DFD features.
//
// These types were previously scattered across feature-specific model files,
// causing cross-feature import dependencies. Moving them here breaks those cycles.
//
// Exported via shared barrel (src/shared/index.ts).
//
// Location: src/shared/reference-types.ts

import type { StrideCategory } from "shared";

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

// ==================== CIANAAA ====================

/**
 * Protection-need level for a single CIANAAA dimension.
 * Moved to shared so both asset and threat features can use it
 * without a cross-feature import dependency.
 *
 * Semantics:
 *   none     → dimension not applicable or not rated; no threat generated
 *   low      → generate threat, base severity = Low
 *   medium   → generate threat, base severity = Medium
 *   high     → generate threat, base severity = High
 *   critical → generate threat, severity = Critical (override — always wins)
 */
export type CIANAAALevel = "none" | "low" | "medium" | "high" | "critical";

/**
 * CIANAAA security goal dimensions.
 * Moved to shared — used by asset feature (full SecurityGoal) and
 * threat feature (SecurityGoalReference + CIANAAA_TO_STRIDE).
 */
export type SecurityGoalType =
  | "C"     // Confidentiality
  | "I"     // Integrity
  | "A"     // Availability
  | "N"     // Non-repudiation
  | "AuthZ" // Authorization
  | "AuthN" // Authentication
  | "Acc";  // Accountability

/**
 * Lightweight security goal reference — only what the threat feature needs.
 * Full SecurityGoal (with formalDescription, rationale, source) stays in asset feature.
 */
export interface SecurityGoalReference {
  type: SecurityGoalType;
  level: CIANAAALevel;
}

/**
 * Deterministic mapping: SecurityGoalType → StrideCategory.
 * Lives in shared — used by both asset and threat features.
 *
 * Note: Both N (Non-Repudiation) and Acc (Accountability) map to R (Repudiation).
 * They represent different audit concerns but the same STRIDE threat category.
 */
export const CIANAAA_TO_STRIDE: Record<SecurityGoalType, StrideCategory> = {
  C:     "I", // Information Disclosure
  I:     "T", // Tampering
  A:     "D", // Denial of Service
  N:     "R", // Repudiation
  AuthN: "S", // Spoofing
  AuthZ: "E", // Elevation of Privilege
  Acc:   "R", // Repudiation
};

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
  /**
   * Active security goals (level !== "none") — populated by asset feature
   * via memoizedAssetDataRef in main-layout.tsx.
   * Used by RelationStrategy to derive STRIDE categories and initialImpact.
   */
  securityGoals?: SecurityGoalReference[];
}

/**
 * Asset data bundle passed from Asset phase into Threat and Risk dialogs.
 * Previously: features/threats/models/threat-types.ts
 */
export interface AssetDataReference {
  assets: AssetReference[];
  hasSafetyAssets: boolean;
}