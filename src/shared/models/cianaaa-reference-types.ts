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
 * Deterministic mapping: SecurityGoalType → STRIDE category.
 * Used by the threat generator to determine which STRIDE threats to produce.
 *
 * Note: Both N (Non-Repudiation) and Acc (Accountability) map to Repudiation (R).
 * They represent different audit concerns but the same STRIDE threat category.
 */
export const CIANAAA_TO_STRIDE: Record<SecurityGoalType, StrideCategory> = {
  C: "I", // Information Disclosure
  I: "T", // Tampering
  A: "D", // Denial of Service
  N: "R", // Repudiation
  AuthN: "S", // Spoofing
  AuthZ: "E", // Elevation of Privilege
  Acc: "R", // Repudiation
};