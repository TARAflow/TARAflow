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
  /**
   * Per-goal impact overrides (criterion → value). Absent = the goal inherits
   * every criterion from the asset. See shared/utils/threat-impact.ts.
   */
  impactRatings?: { criterionId: string; value: number | null | "na" }[];
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
// ==================== ISO/SAE 21434 PROPERTY MAPPING ====================

/** The cybersecurity properties ISO/SAE 21434 names (3.1.20 Note 1). */
export type CiaProperty = "C" | "I" | "A";

/**
 * CIANAAA → C/I/A, for the methodology record of ISO projects (conformance
 * plan 0b). ISO/SAE 21434 3.1.20 names confidentiality, integrity and
 * availability only as examples of cybersecurity properties; TARAflow's four
 * extra goals are kept separate because each drives its own STRIDE category
 * (CIANAAA_TO_STRIDE: N/Acc → Repudiation, AuthN → Spoofing, AuthZ →
 * Elevation of Privilege), which a pure CIA view would hide.
 *   N, Acc  — integrity of the evidence (who did what)
 *   AuthN   — integrity of the identity claim
 *   AuthZ   — confidentiality or integrity, depending on the access gained
 */
export const CIANAAA_TO_CIA: Readonly<Record<SecurityGoalType, readonly CiaProperty[]>> = {
  C: ["C"],
  I: ["I"],
  A: ["A"],
  N: ["I"],
  AuthN: ["I"],
  AuthZ: ["C", "I"],
  Acc: ["I"],
};
