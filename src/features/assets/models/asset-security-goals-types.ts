// ==================== SECURITY GOALS (CIANAAA) ====================

import type { ImpactRating } from "./asset-impact-types";

// ==================== CIANAAA LEVEL ====================

/**
 * Protection-need level for a single CIANAAA dimension.
 *
 * Semantics:
 *   none     → dimension not applicable or not rated; no threat generated
 *   low      → generate threat, base severity = Low
 *   medium   → generate threat, base severity = Medium
 *   high     → generate threat, base severity = High
 *   critical → generate threat, severity = Critical (override — always wins)
 *
 * Derived automatically from Cause Mechanism × Impact ratings.
 * Analyst can override via Expert Mode (source: "manual").
 */
export type CIANAAALevel = "none" | "low" | "medium" | "high" | "critical";

// ==================== SECURITY GOAL TYPE ====================

export type SecurityGoalType =
  | "C"     // Confidentiality
  | "I"     // Integrity
  | "A"     // Availability
  | "N"     // Non-repudiation
  | "AuthZ" // Authorization
  | "AuthN" // Authentication
  | "Acc";  // Accountability

// ==================== SECURITY GOAL ====================

/**
 * Security goal with protection-need level and formal description.
 *
 * Migration note: replaces the previous boolean `enabled` field.
 *   enabled: true  → level: "high"  (conservative)
 *   enabled: false → level: "none"
 */
export interface SecurityGoal {
  type: SecurityGoalType;

  /**
   * Per-goal impact override (Phase 3).
   *
   * A damage scenario is the compromise of a *cybersecurity property* of an
   * asset (ISO 21434 3.1.22) — i.e. asset × security goal. So this is where the
   * impact of that damage scenario actually belongs: a confidentiality loss on a
   * config database causes different damage than an availability loss on the
   * same database.
   *
   * OPTIONAL. When absent (or empty), Asset.impactRatings applies — today's
   * behaviour, so every existing project keeps working untouched. Analysts opt
   * in per goal, only where the distinction matters.
   *
   * Holds in BOTH rating methods: only the likelihood axis forks between ISO and
   * IEC 62443, never the impact axis.
   *
   * Resolution order lives in services/asset-impact-resolver.ts — do not
   * re-implement it at call sites.
   */
  impactRatings?: ImpactRating[];

  /**
   * Protection-need level — derived from Cause Mechanism × Impact.
   * "none" = not applicable or not suggested for this asset.
   *
   * Replaces the former boolean `enabled` field.
   */
  level: CIANAAALevel;

  /** Formal requirement statement — displayed in audit report. */
  formalDescription: string;

  /**
   * "suggested" = derived from DFD graph via relation type (BASE_RULES)
   * "manual"    = analyst explicitly set or overrode the suggestion
   * undefined   = legacy / not yet evaluated
   */
  source?: "suggested" | "manual";

  /** Required when analyst deviates from graph suggestion (IEC 62443-4-1). */
  rationale?: string;
}

// ==================== CAUSE MECHANISM ====================

/**
 * What the analyst sees in the UI — plain language, domain-agnostic.
 * CIANAAA is derived internally; the analyst never sets it directly.
 *
 * Domain specificity lives in the Impact ratings, not here.
 * Same mechanism, different impact levels = different protection needs.
 *
 * UI labels and descriptions are in i18n:
 *   t(`${CAUSE_MECHANISM_KEY_PREFIX}.${mechanism}.label`)
 *   t(`${CAUSE_MECHANISM_KEY_PREFIX}.${mechanism}.description`)
 */
export type CauseMechanismType =
  | "content_manipulation"    // → Integrity
  | "content_disclosure"      // → Confidentiality
  | "unavailability"          // → Availability
  | "identity_abuse"          // → Authentication
  | "unauthorized_access"     // → Authorization
  | "missing_evidence"        // → Non-repudiation
  | "missing_accountability"; // → Accountability

/**
 * Deterministic mapping: CauseMechanismType → SecurityGoalType (CIANAAA dimension).
 * One mechanism → one dimension, no ambiguity.
 */
export const CAUSE_MECHANISM_TO_GOAL: Record<CauseMechanismType, SecurityGoalType> = {
  content_manipulation:    "I",
  content_disclosure:      "C",
  unavailability:          "A",
  identity_abuse:          "AuthN",
  unauthorized_access:     "AuthZ",
  missing_evidence:        "N",
  missing_accountability:  "Acc",
};

/**
 * Impact criterion IDs that drive the CIANAAALevel for each mechanism.
 * Level = MAX() over all listed criteria that exist in the project configuration
 * and have a non-null rating.
 *
 * Falls back to "none" when no relevant criteria are rated — no artificial defaults.
 * This prevents inflated threat models on incomplete assessments.
 *
 * Criterion IDs match PREDEFINED_IMPACT_CRITERIA in asset-impact-types.ts.
 */
export const CAUSE_MECHANISM_CRITERIA: Record<CauseMechanismType, string[]> = {
  // Integrity: universal — manipulation impacts safety, operations, finances, compliance
  content_manipulation:    ["safety", "operational", "financial_damage", "regulatory_compliance"],

  // Confidentiality: disclosure primarily regulatory/financial/reputational
  content_disclosure:      ["regulatory_compliance", "financial_damage", "reputation"],

  // Availability: operational continuity + recoverability effort
  unavailability:          ["operational", "recoverability"],

  // Authentication: guards access to safety-critical and regulated functions
  identity_abuse:          ["safety", "operational", "regulatory_compliance"],

  // Authorization: broader than AuthN — also covers financial asset access
  unauthorized_access:     ["safety", "operational", "regulatory_compliance", "financial_damage"],

  // Non-Repudiation: purely compliance-driven
  missing_evidence:        ["regulatory_compliance"],

  // Accountability: compliance + operational audit trail
  missing_accountability:  ["regulatory_compliance", "operational"],
};

// ==================== CIANAAA APPLICABILITY MATRIX ====================

/**
 * Which CIANAAA dimensions are conceptually applicable per asset category.
 * false = not applicable at asset level (may still apply at element level).
 *
 * Source: Handover v3 §4 + taraflow-asset-beziehungen.md
 *
 * Key design notes:
 *   AuthN/AuthZ on Data/Physical: handled at element level, not asset level
 *   N on System/Infrastructure: not applicable (no audit trail concept)
 *   I/A on Human: not applicable (humans are protection targets, not data containers)
 */
export type CIANAAAApplicability = Record<SecurityGoalType, boolean>;

export const CIANAAA_APPLICABLE: Record<string, CIANAAAApplicability> = {
  data: {
    C: true,
    I: true,
    A: true,
    N: true,
    AuthN: false,
    AuthZ: false,
    Acc: true,
  },
  function: {
    C: false,
    I: true,
    A: true,
    N: true,
    AuthN: true,
    AuthZ: true,
    Acc: true,
  },
  system: {
    C: true,
    I: true,
    A: true,
    N: false,
    AuthN: true,
    AuthZ: true,
    Acc: true,
  },
  infrastructure: {
    C: true,
    I: true,
    A: true,
    N: false,
    AuthN: true,
    AuthZ: true,
    Acc: false,
  },
  physical: {
    C: false,
    I: true,
    A: true,
    N: false,
    AuthN: false,
    AuthZ: false,
    Acc: true,
  },
  process: {
    C: false,
    I: true,
    A: true,
    N: true,
    AuthN: true,
    AuthZ: true,
    Acc: true,
  },
  service: {
    C: true,
    I: true,
    A: true,
    N: true,
    AuthN: true,
    AuthZ: true,
    Acc: true,
  },
  human: {
    C: true,
    I: false,
    A: false,
    N: false,
    AuthN: true,
    AuthZ: true,
    Acc: true,
  },
};

// ==================== SECURITY GOAL DEFINITIONS ====================

/**
 * Structural definition of a security goal type.
 * All display text lives in i18n — see key convention below.
 *
 * i18n key convention (namespace: asset.json):
 *   name:        t(`${SECURITY_GOAL_KEY_PREFIX}.${type}.name`)
 *   description: t(`${SECURITY_GOAL_KEY_PREFIX}.${type}.description`)
 *   template:    t(`${SECURITY_GOAL_KEY_PREFIX}.${type}.template`)
 */
export interface SecurityGoalDefinition {
  type: SecurityGoalType;
}

/** Ordered list of all security goal types — use for rendering loops. */
export const SECURITY_GOALS: SecurityGoalDefinition[] = [
  { type: "C" },
  { type: "I" },
  { type: "A" },
  { type: "N" },
  { type: "AuthZ" },
  { type: "AuthN" },
  { type: "Acc" },
];

// ==================== I18N KEY PREFIXES ====================
// Centralised constants — avoids magic strings scattered across components.

/**
 * i18n key prefix for security goal translations.
 * Usage: t(`${SECURITY_GOAL_KEY_PREFIX}.${type}.name`)
 *        t(`${SECURITY_GOAL_KEY_PREFIX}.${type}.description`)
 *        t(`${SECURITY_GOAL_KEY_PREFIX}.${type}.template`)
 */
export const SECURITY_GOAL_KEY_PREFIX = "tabs.assets.securityGoals" as const;

/**
 * i18n key prefix for cause mechanism translations.
 * Usage: t(`${CAUSE_MECHANISM_KEY_PREFIX}.${mechanism}.label`)
 *        t(`${CAUSE_MECHANISM_KEY_PREFIX}.${mechanism}.description`)
 */
export const CAUSE_MECHANISM_KEY_PREFIX = "tabs.assets.causeMechanism" as const;

/**
 * i18n key prefix for CIANAAA level translations.
 * Usage: t(`${CIANAAA_LEVEL_KEY_PREFIX}.${level}`)
 */
export const CIANAAA_LEVEL_KEY_PREFIX = "tabs.assets.cianaaa.level" as const;