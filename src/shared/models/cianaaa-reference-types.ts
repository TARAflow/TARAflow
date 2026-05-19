// ==================== CIANAAA REFERENCE TYPES ====================
// CIANAAA protection-need levels, security goal dimensions, STRIDE mapping.
// Used by Asset and Threat features — lives in shared to break the
// cross-feature import cycle.
//
// Consumers import directly from this file.

import type { StrideCategory } from "shared";

// ==================== LEVEL ====================

/**
 * Protection-need level for a single CIANAAA dimension.
 *
 *   none     → not applicable; no threat generated
 *   low      → generate threat, severity = Low
 *   medium   → generate threat, severity = Medium
 *   high     → generate threat, severity = High
 *   critical → severity = Critical (override — always wins)
 */
export type CIANAAALevel = "none" | "low" | "medium" | "high" | "critical";

// ==================== SECURITY GOAL ====================

/**
 * CIANAAA security goal dimensions.
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
 * Lightweight security goal reference.
 * Full SecurityGoal (formalDescription, rationale) stays in asset feature.
 */
export interface SecurityGoalReference {
  type: SecurityGoalType;
  level: CIANAAALevel;
}

// ==================== STRIDE MAPPING ====================

/**
 * Deterministic mapping: SecurityGoalType → StrideCategory.
 * N and Acc both map to R — different audit concerns, same STRIDE category.
 */
export const CIANAAA_TO_STRIDE: Record<SecurityGoalType, StrideCategory> = {
  C:     "I",
  I:     "T",
  A:     "D",
  N:     "R",
  AuthN: "S",
  AuthZ: "E",
  Acc:   "R",
};