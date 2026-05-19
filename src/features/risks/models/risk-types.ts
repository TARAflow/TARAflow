// ==================== RISK TYPES ====================
// Core data models for the Risk Assessment feature
// NO dependency on app - follows Dependency Inversion Principle
//
// Architecture:
// - Risk entity per Threat (linked via threatId)
// - Configurable assessment methods (Simple/Complex)
// - Predefined factor templates (OWASP, ETSI, EN50742, custom)
// - MoSCoW prioritization with Won't-Risk filtering

import type {
  MitigationPropertyRole,
  PhaseStatusMap,
  StrideCategory,
  StrideMethod,
  LinkedDFDElement,
  DataFlowReference,
  AssetDataReference,
  DFDReference,
} from "shared";

// ==================== RISK METHOD ====================

/**
 * Risk assessment method type
 * Likelihood × Impact method — separate Impact and Likelihood factors.
 */
export type RiskMethodType = "complex";

/**
 * Rounding method for risk level thresholds
 * - round: Standard rounding (1.5-2.49 = Medium, 2.5-3.49 = High)
 * - ceil: Conservative rounding (1.01-2.0 = Medium, 2.01-3.0 = High)
 */
export type RiskRoundingMethod = "round" | "ceil";

// ==================== QUALITATIVE SCALE ====================

/**
 * Configurable qualitative rating scale
 */
export type RiskScaleType = "3-level" | "4-level" | "5-level";

export interface RiskScaleLevel {
  value: number;
  label: string;
  color: string;
  /** Max severity (R = I×L) that maps to this level. Last level acts as catch-all. */
  threshold: number;
}

export interface RiskScaleConfig {
  type: RiskScaleType;
  levels: RiskScaleLevel[];
}

export const RISK_SCALES: Record<RiskScaleType, RiskScaleConfig> = {
  // Severity range 1–9  (3×3)
  "3-level": {
    type: "3-level",
    levels: [
      { value: 1, label: "Low", color: "#22c55e", threshold: 2 },
      { value: 2, label: "Medium", color: "#eab308", threshold: 6 },
      { value: 3, label: "High", color: "#ef4444", threshold: 9 },
    ],
  },
  // Severity range 1–16 (4×4)
  "4-level": {
    type: "4-level",
    levels: [
      { value: 1, label: "Low", color: "#22c55e", threshold: 3 },
      { value: 2, label: "Medium", color: "#eab308", threshold: 6 },
      { value: 3, label: "High", color: "#f97316", threshold: 11 },
      { value: 4, label: "Critical", color: "#ef4444", threshold: 16 },
    ],
  },
  // Severity range 1–25 (5×5)
  "5-level": {
    type: "5-level",
    levels: [
      { value: 1, label: "Low", color: "#22c55e", threshold: 4 },
      { value: 2, label: "Medium", color: "#eab308", threshold: 8 },
      { value: 3, label: "High", color: "#f97316", threshold: 14 },
      { value: 4, label: "Very High", color: "#ef4444", threshold: 20 },
      { value: 5, label: "Critical", color: "#a855f7", threshold: 25 },
    ],
  },
};

// ==================== RISK TREATMENT ====================

/**
 * ISO 31000 / IEC 62443-3-2 risk treatment options.
 * Orthogonal to MoSCoW: treatment = WHAT, MoSCoW = WHEN/PRIORITY.
 */
export type RiskTreatment =
  | "eliminate"  // Remove the risk source entirely (avoid the feature/function)
  | "reduce"     // Mitigate via countermeasures (most common)
  | "accept"     // Consciously retain the risk without action
  | "transfer"   // Move risk to third party (outsourcing, contract)
  | "share";     // Distribute risk across multiple parties (joint responsibility)

export interface RiskTreatmentDefinition {
  value: RiskTreatment;
  label: string;
  description: string;
  color: string;
}

export const RISK_TREATMENTS: RiskTreatmentDefinition[] = [
  {
    value: "eliminate",
    label: "Eliminate",
    description: "Remove the risk source entirely",
    color: "#16a34a",
  },
  {
    value: "reduce",
    label: "Reduce",
    description: "Mitigate via countermeasures",
    color: "#2563eb",
  },
  {
    value: "accept",
    label: "Accept",
    description: "Consciously retain the risk without action",
    color: "#d97706",
  },
  {
    value: "transfer",
    label: "Transfer",
    description: "Move risk to third party",
    color: "#7c3aed",
  },
  {
    value: "share",
    label: "Share",
    description: "Distribute risk across multiple parties",
    color: "#0891b2",
  },
];

// ==================== RISK FACTOR CATEGORY ====================

/**
 * Factor categories for complex method
 */
export type RiskFactorCategory = "impact" | "likelihood" | "combined";

// ==================== RISK FACTOR DEFINITION ====================

/**
 * Definition of a risk assessment factor
 */
export interface RiskFactorDefinition {
  id: string;
  category: RiskFactorCategory;
  name: string;
  description: string;
  /** Default weight (0.0 - 1.0) */
  defaultWeight: number;
  /** Source methodology */
  source:
    | "OWASP"
    | "ETSI"
    | "EN50742"
    | "ISO27005"
    | "FAIR"
    | "CVSS"
    | "custom";
}

// ==================== PREDEFINED FACTORS ====================



/**
 * OWASP Risk Rating factors (complex method default)
 * Names and descriptions are i18n keys: risks.factors.{id}.name / .description
 */
export const OWASP_LIKELIHOOD_FACTORS: RiskFactorDefinition[] = [
  // Threat Agent Factors
  {
    id: "skill_level",
    category: "likelihood",
    name: "Skill Level",
    description: "",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "motive",
    category: "likelihood",
    name: "Motive",
    description: "",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "opportunity",
    category: "likelihood",
    name: "Opportunity",
    description: "",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "size",
    category: "likelihood",
    name: "Size",
    description: "",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  // Vulnerability Factors
  {
    id: "ease_of_discovery",
    category: "likelihood",
    name: "Ease of Discovery",
    description: "",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "ease_of_exploit",
    category: "likelihood",
    name: "Ease of Exploit",
    description: "",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "awareness",
    category: "likelihood",
    name: "Awareness",
    description: "",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "intrusion_detection",
    category: "likelihood",
    name: "Intrusion Detection",
    description: "",
    defaultWeight: 1.0,
    source: "OWASP",
  },
];

/**
 * Impact factors — IDs aligned with Asset impact criteria (1:1 mapping).
 * Replaces the old OWASP loss_of_* factors which duplicated STRIDE categories.
 *
 * @deprecated Use IMPACT_FACTORS instead. Kept as alias for call-site compatibility.
 */
export const IMPACT_FACTORS: RiskFactorDefinition[] = [
  // ── Business / Organisational ─────────────────────────────────────────
  // Names and descriptions are i18n keys: risks.factors.{id}.name / .description
  { id: "financial_damage",      category: "impact", name: "Financial Damage",      description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "regulatory_compliance", category: "impact", name: "Regulatory Compliance", description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "reputation",            category: "impact", name: "Reputation Damage",     description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "privacy",               category: "impact", name: "Privacy Violation",     description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "operational",           category: "impact", name: "Operational Impact",    description: "", defaultWeight: 1.0, source: "OWASP" },
  // OT/TARA extended: persons, machines or plants affected at this specific asset
  { id: "affected_users",        category: "impact", name: "Affected Users",        description: "", defaultWeight: 1.0, source: "TARAflow" as any },
  { id: "recoverability",        category: "impact", name: "Recoverability",        description: "", defaultWeight: 1.0, source: "TARAflow" as any },
  { id: "accountability",        category: "impact", name: "Accountability Loss",   description: "", defaultWeight: 1.0, source: "TARAflow" as any },
  // ── Physical ──────────────────────────────────────────────────────────
  // safety: auto-enabled when DFD / Asset Tab safety annotations detected
  { id: "safety",                category: "impact", name: "Safety Impact",         description: "", defaultWeight: 1.0, source: "TARAflow" as any },
  { id: "physical_damage",       category: "impact", name: "Physical Damage",       description: "", defaultWeight: 1.0, source: "TARAflow" as any },
  // ── Extended (disabled by default) ────────────────────────────────────
  { id: "environmental",         category: "impact", name: "Environmental Impact",  description: "", defaultWeight: 1.0, source: "TARAflow" as any },
  { id: "supply_chain",          category: "impact", name: "Supply Chain Impact",   description: "", defaultWeight: 1.0, source: "TARAflow" as any },
];

/**
 * ETSI TVRA factors (alternative complex method)
 * Names and descriptions are i18n keys: risks.factors.{id}.name / .description
 */
export const ETSI_FACTORS: RiskFactorDefinition[] = [
  {
    id: "knowledge",
    category: "likelihood",
    name: "Knowledge Factor",
    description: "",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "expertise",
    category: "likelihood",
    name: "Expertise Factor",
    description: "",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "time",
    category: "likelihood",
    name: "Time Factor",
    description: "",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "equipment",
    category: "likelihood",
    name: "Equipment Factor",
    description: "",
    defaultWeight: 1.0,
    source: "ETSI",
  },
];


/**
 * EN 50742 / IEC 62443-3-2 Attacker Potential factors
 * Formula: AP = (EL × WoO) + AC
 * AP feeds into the Likelihood dimension.
 */
export const EN50742_FACTORS: RiskFactorDefinition[] = [
  {
    id: "window_of_opportunity",
    category: "likelihood",
    name: "Window of Opportunity (WoO)",
    description: "",
    defaultWeight: 1.0,
    source: "EN50742",
  },
  {
    id: "attacker_capability",
    category: "likelihood",
    name: "Attacker Capability (AC)",
    description: "",
    defaultWeight: 1.0,
    source: "EN50742",
  },
  {
    id: "exposure_level",
    category: "likelihood",
    name: "Exposure Level (EL)",
    description: "",
    defaultWeight: 1.0,
    source: "EN50742",
  },
];

/**
 * TARAflow OT/Embedded/IoT specific factors
 * Names and descriptions are i18n keys: risks.factors.{id}.name / .description
 */
export const TARAFLOW_FACTORS: RiskFactorDefinition[] = [
  {
    // Likelihood factor: can a single attack compromise multiple installations simultaneously?
    // Distinct from affected_users (Impact: how many are harmed) —
    // deployment_scope measures attack amplification, not damage breadth.
    id: "deployment_scope",
    category: "likelihood",
    name: "Deployment Scope",
    description: "",
    defaultWeight: 1.0,
    source: "TARAflow" as any,
  },
];

/**
 * All predefined factors grouped by source
 */
export const ALL_PREDEFINED_FACTORS: RiskFactorDefinition[] = [
  ...OWASP_LIKELIHOOD_FACTORS,
  ...IMPACT_FACTORS,
  ...ETSI_FACTORS,
  ...EN50742_FACTORS,
  ...TARAFLOW_FACTORS,
];

// ==================== MOSCOW PRIORITY ====================

export type MoSCoWPriority = "must" | "should" | "could" | "wont";

export interface MoSCoWDefinition {
  value: MoSCoWPriority;
  label: string;
  description: string;
  color: string;
}

export const MOSCOW_PRIORITIES: MoSCoWDefinition[] = [
  {
    value: "must",
    label: "Must",
    description: "Critical - must be addressed",
    color: "#ef4444",
  },
  {
    value: "should",
    label: "Should",
    description: "Important - should be addressed if possible",
    color: "#f97316",
  },
  {
    value: "could",
    label: "Could",
    description: "Nice to have - could be addressed",
    color: "#eab308",
  },
  {
    value: "wont",
    label: "Won't",
    description: "Accepted risk - won't be addressed this iteration",
    color: "#6b7280",
  },
];

// ==================== RISK STATUS ====================

// ==================== RISK HEALTH INDICATOR ====================
// ==================== TICKET INTEGRATION MAPPING ====================

/**
 * Maps external ticket status to internal MitigationStatus.
 * "closed" and "reopened" are Jira/ADO concepts — they map to domain states.
 * Use in the integration layer only — not in the domain model.
 *
 * Jira → TARAflow:
 *   To Do       → open
 *   In Progress → in_progress
 *   In Review   → in_review
 *   Done        → implemented
 *   Closed      → verified
 *   Won't Fix   → rejected
 *   Reopened    → in_progress
 *
 * AzureDevOps → TARAflow:
 *   New         → open
 *   Active      → in_progress
 *   Resolved    → implemented
 *   Closed      → verified
 *   Won't Fix   → rejected
 */
export function mapTicketStatusToMitigationStatus(
  ticketStatus: string,
): MitigationStatus | null {
  const mapping: Record<string, MitigationStatus> = {
    // Jira
    "to do":        "open",
    "in progress":  "in_progress",
    "in review":    "in_review",
    "done":         "implemented",
    "closed":       "verified",
    "won't fix":    "rejected",
    "wont fix":     "rejected",
    "reopened":     "in_progress",
    // AzureDevOps
    "new":          "open",
    "active":       "in_progress",
    "resolved":     "implemented",
    "completed":    "implemented",
  };
  return mapping[ticketStatus.toLowerCase().trim()] ?? null;
}

// ==================== FACTOR RATING ====================

/**
 * Rating for a single factor
 */
export interface FactorRating {
  factorId: string;
  /** Current value. 0 = not rated, 1–N depending on active scale. */
  value: number;
  /** Weight for weighted average calculation (0.0–1.0). */
  weight: number;
  /**
   * The value automatically derived from Asset Tab data (asset criteria or CIANAAA).
   * Populated when source === "derived". Undefined if no derivation was available.
   * Displayed in the Risk Dialog as the "suggested" value alongside the analyst's override.
   */
  derivedValue?: number;
  /**
   * How the current value was set:
   * - "derived"  → set from Asset Tab data, not manually changed
   * - "manual"   → analyst explicitly overrode the derived value
   * - undefined  → no derivation available; analyst entered from scratch
   *
   * Overridden chip shown in Risk Dialog when:
   *   source === "manual" && value !== derivedValue
   */
  source?: "derived" | "manual";
}

// ==================== MITIGATION STATUS ====================

/**
 * Lifecycle state of a selected mitigation — set by the implementer
 * in RiskMitigationStatusDialog.
 *
 * State machine:
 *   open → in_progress → in_review → implemented → verified
 *                                                ↘ rejected (any time)
 *
 * open         — selected by analyst, not yet started
 * in_progress  — implementation underway
 * in_review    — code review / QA / test pending
 * implemented  — deployed / applied, not yet verified
 * verified     — independently confirmed (audit, pentest, CI check)
 * rejected     — consciously decided NOT to implement (requires reason)
 */
export type MitigationStatus =
  | "open"
  | "in_progress"
  | "in_review"
  | "implemented"
  | "verified"
  | "rejected";

export interface MitigationStatusConfig {
  value: MitigationStatus;
  label: string;
  color: string;
  icon: string;
}

/**
 * Single source of truth for MitigationStatus display properties.
 * Replaces MITIGATION_STATUS_COLORS and MITIGATION_STATUS_LABELS.
 */
export const MITIGATION_STATUS_CONFIGS: MitigationStatusConfig[] = [
  { value: "open",        label: "Open",        color: "#9ca3af", icon: "⚪" },
  { value: "in_progress", label: "In Progress", color: "#3b82f6", icon: "🔵" },
  { value: "in_review",   label: "In Review",   color: "#8b5cf6", icon: "🟣" },
  { value: "implemented", label: "Implemented", color: "#22c55e", icon: "🟢" },
  { value: "verified",    label: "Verified",    color: "#16a34a", icon: "✅" },
  { value: "rejected",    label: "Rejected",    color: "#ef4444", icon: "🔴" },
];

// ==================== IMPLEMENTATION PROGRESS (UI-derived) ====================
// Aggregated view of a risk's mitigation progress — derived at render time,
// never stored. Used for the chip in risk-columns and statistics.

export type ImplementationProgress =
  | "not_started"  // no mitigations started (all open)
  | "in_progress"  // at least one in_progress or in_review
  | "partial"      // at least one implemented/verified, not all
  | "implemented"  // all non-rejected implemented (not all verified)
  | "verified"     // all non-rejected verified
  | "rejected";    // all non-rejected rejected

/**
 * Derives the aggregated implementation progress from a risk's mitigations.
 * Pure function — call at render time, never store result.
 */
export function deriveImplementationProgress(
  selectedMitigations: SelectedMitigation[],
): ImplementationProgress {
  const active = selectedMitigations.filter((m) => m.status !== "rejected");
  if (active.length === 0) {
    return selectedMitigations.length > 0 &&
      selectedMitigations.every((m) => m.status === "rejected")
      ? "rejected"
      : "not_started";
  }
  if (active.every((m) => m.status === "verified"))                               return "verified";
  if (active.every((m) => m.status === "implemented" || m.status === "verified")) return "implemented";
  if (active.some((m) => m.status === "implemented" || m.status === "verified"))  return "partial";
  if (active.some((m) => m.status === "in_progress" || m.status === "in_review")) return "in_progress";
  return "not_started";
}
 
/**
 * A selected mitigation within a Risk — rich object replacing the bare string ID.
 *
 * Migration: existing string[] entries are normalized to
 * { id, status: "selected" } by normalizeMitigationEntry().
 */
export interface SelectedMitigation {
  /** Catalog ID (e.g. "M-S-001"). Undefined = custom analyst entry. */
  id?: string;
 
  /** Analyst-provided text for custom entries, or annotation for catalog entries. */
  notes?: string;
 
  /** Current lifecycle status. Default: "selected". */
  status: MitigationStatus;
 
  /**
   * Required when status = "rejected".
   * Recorded in audit trail — IEC 62443-4-1 compliance.
   */
  rejectionReason?: string;
 
  /** ISO timestamp when status last changed. */
  statusChangedAt?: string;
 
  /**
   * External reference for evidence (provisional — replaces Jira/ADO until integration).
   * e.g. ticket ID, PR link, audit document reference, commit hash.
   */
  evidenceRef?: string;

  /**
   * Free-text evidence note (provisional Traceability).
   * Replaces Jira/AzureDevOps ticket link until integration is built.
   * e.g. "Firewall rule applied on 2025-03-15", "WAF config committed #abc123"
   */
  evidenceNote?: string;

  /**
   * Scope override for per-interaction threats.
   * When set, only catalog affectsProperties with matching role are processed.
   * When undefined, all roles from the catalog are used (default behaviour).
   *
   * Only meaningful when the parent Risk.sourceStrideMethod = "per-interaction".
   * For per-element risks this field is ignored.
   *
   * Example: ["channel"] → only apply TLS to the DataFlow, not to source/target.
   */
  scopeOverride?: MitigationPropertyRole[];
}
 
// ==================== MIGRATION HELPER ====================
 
/**
 * Normalizes a raw mitigation entry from project JSON to SelectedMitigation.
 * Handles both old format (string ID) and new format (SelectedMitigation object).
 * Safe to call on already-migrated data.
 */
export function normalizeMitigationEntry(
  entry: string | SelectedMitigation
): SelectedMitigation {
  if (typeof entry === "string") {
    // Old format: bare ID string → migrate to open
    return { id: entry, status: "open" };
  }
  // New format: status is required on SelectedMitigation — just copy it
  return { ...entry };
}
 
/**
 * Normalizes Risk.selectedMitigations from legacy string[] to SelectedMitigation[].
 * Call when loading projects from disk/localStorage.
 */
export function normalizeMitigations(
  entries: (string | SelectedMitigation)[]
): SelectedMitigation[] {
  return entries.map(normalizeMitigationEntry);
}

// ==================== RISK ASSESSMENT ====================

/**
 * Complete risk assessment for a single threat
 */
export interface Risk {
  /** Unique risk ID (format: R-{threatId}) */
  id: string;

  /** Reference to the threat being assessed */
  threatId: string;

  /** Copy of threat description for display (denormalized for performance) */
  threatDescription: string;

  /** Copy of attack description for display (denormalized for performance) */
  attackDescription: string;

  /** Cause description from catalog (read-only, amber display) */
  causeDescription?: string;

  /** Linked asset IDs — used for asset-impact pre-fill */
  linkedAssetIds?: string[];

  /**
   * Threat relevance — determines if this risk should appear in Risk Tab.
   * Synced from Threat Eval phase. uncertain risks show a warning.
   */
  threatRelevance: ThreatRelevanceRef;

  /**
   * Proposed mitigations from Threat Eval (catalog refs + custom).
   * Displayed as checkboxes in Risk Dialog Tab 2.
   */
  proposedMitigations: MitigationDraftRef[];

  /**
   * Proposed verifications from Threat Eval.
   */
  proposedVerifications: MitigationDraftRef[];

  /** STRIDE category from threat */
  strideCategory: StrideCategory;

  /** Source STRIDE method (per-element or per-interaction) */
  sourceStrideMethod: StrideMethod;

  /** Factor ratings for this risk */
  factorRatings: FactorRating[];

  /** Calculated values */
  calculatedImpact: number;
  calculatedLikelihood: number;
  calculatedRiskBeforeMitigation: number;

  /**
   * Mitigations selected by analyst — rich objects with lifecycle status.
   * Migration: old string[] entries normalized via normalizeMitigations().
   */
  selectedMitigations: SelectedMitigation[];

  /**
   * IDs of selected verifications from proposedVerifications.
   */
  selectedVerifications: string[];

  /** Re-rated factors after mitigation */
  mitigatedFactorRatings: FactorRating[];

  /** Calculated risk after mitigation */
  calculatedRiskAfterMitigation: number;

  /**
   * Risk treatment decision (ISO 31000 / IEC 62443-3-2).
   * WHAT will be done with this risk.
   */
  treatment: RiskTreatment;

  /** Treatment justification — required for accept/transfer/share */
  treatmentJustification: string;

  /** MoSCoW priority — WHEN / with what priority */
  moscowPriority: MoSCoWPriority;

  /** Won't justification (required when moscowPriority === 'wont') */
  wontJustification: string;

  /** Timestamps */
  created: string;
  lastModified: string;
}

// ==================== ACTIVE FACTOR ====================

/**
 * Factor instance with current configuration
 */
export interface ActiveFactor {
  /** Reference to factor definition */
  factorId: string;

  /** Is this factor currently included in calculations? */
  enabled: boolean;

  /** Current weight (can be modified from default) */
  weight: number;

  /**
   * Was this factor automatically enabled (not by explicit analyst action)?
   *
   * Used for Safety factor auto-enable/disable logic:
   * - true  → enabled because safety data was detected in DFD/Asset Tab
   * - false / undefined → analyst explicitly enabled this factor
   *
   * When safety data disappears:
   * - autoEnabled === true  → show dialog asking to keep or remove
   * - autoEnabled === false → never auto-disable (analyst's explicit choice)
   */
  autoEnabled?: boolean;
}

// ==================== RISK CONFIGURATION ====================

/**
 * Project-specific risk configuration
 */
/**
 * Asset impact level — mirrors aggregatedImpact from AssetReference.
 * Kept here to avoid circular dependency with threat-types.
 */
export type AssetImpactLevel = "LOW" | "MED" | "MED+" | "HIGH" | "HIGH+" | "CRITICAL";

/**
 * Mapping from asset impact level to risk scale value.
 * One entry per AssetImpactLevel. Values must be within the active scale range.
 */
export type AssetImpactMapping = Record<AssetImpactLevel, number>;

/**
 * Default mappings per scale — proportional from top.
 */
export const DEFAULT_ASSET_IMPACT_MAPPINGS: Record<RiskScaleType, AssetImpactMapping> = {
  "3-level": { LOW: 1, MED: 2, "MED+": 2, HIGH: 3, "HIGH+": 3, CRITICAL: 3 },
  "4-level": { LOW: 1, MED: 2, "MED+": 2, HIGH: 3, "HIGH+": 4, CRITICAL: 4 },
  "5-level": { LOW: 1, MED: 2, "MED+": 3, HIGH: 4, "HIGH+": 4, CRITICAL: 5 },
};

export interface RiskConfiguration {
  /** Assessment method */
  method: RiskMethodType;

  /** Rating scale */
  scale: RiskScaleType;

  /** Rounding method for risk level thresholds */
  roundingMethod: RiskRoundingMethod;

  /** Active STRIDE method for display (per-element or per-interaction) */
  activeStrideMethod: StrideMethod;

  /** Active factors for current method */
  activeFactors: ActiveFactor[];

  /** Show individual factors or only aggregates in table */
  showIndividualFactors: boolean;

  /** Custom factor definitions */
  customFactors: RiskFactorDefinition[];

  /**
   * When true: impact factor for complex method is pre-filled from
   * the worst aggregatedImpact of linked assets using assetImpactMapping.
   * Analyst can still override per risk.
   */
  useAssetImpact: boolean;

  /**
   * Configurable mapping from asset impact level to risk scale value.
   * Defaults to DEFAULT_ASSET_IMPACT_MAPPINGS[scale].
   */
  assetImpactMapping: AssetImpactMapping;

  /**
   * Per-level severity threshold overrides for R = I × L mapping.
   * Key = level value (1-based), Value = max severity for that level.
   * Falls back to RISK_SCALES defaults when not set.
   */
  severityThresholds?: Record<number, number>;

  /**
   * Tracks whether the Safety factor source check has flagged a removal.
   * Set to true by risk-sync-service when safety data disappears and the
   * Safety factor was autoEnabled. Cleared after the user responds to the dialog.
   */
  pendingSafetySourceRemoval?: boolean;
}



/**
 * Default risk configuration — Likelihood × Impact (EN 50742 / OWASP)
 */
export const DEFAULT_CONFIGURATION: RiskConfiguration = {
  method: "complex",
  scale: "4-level",
  roundingMethod: "round",
  activeStrideMethod: "per-element",
  activeFactors: [
    // ── Likelihood — OT/Embedded default (5 factors) ─────────────────────
    { factorId: "skill_level", enabled: true, weight: 1.0 },
    { factorId: "motive", enabled: true, weight: 1.0 },
    { factorId: "opportunity", enabled: true, weight: 1.0 },
    { factorId: "ease_of_exploit", enabled: true, weight: 1.0 },
    { factorId: "deployment_scope", enabled: true, weight: 1.0 },
    // Likelihood — available but disabled by default
    { factorId: "window_of_opportunity", enabled: false, weight: 1.0 },
    { factorId: "attacker_capability", enabled: false, weight: 1.0 },
    { factorId: "exposure_level", enabled: false, weight: 1.0 },
    { factorId: "size", enabled: false, weight: 1.0 },
    { factorId: "ease_of_discovery", enabled: false, weight: 1.0 },
    { factorId: "awareness", enabled: false, weight: 1.0 },
    { factorId: "intrusion_detection", enabled: false, weight: 1.0 },
    // ── Impact — all start disabled; syncActiveFactorsFromAssets enables ──
    // them based on which criteria are rated in the Asset Tab
    { factorId: "financial_damage", enabled: false, weight: 1.0 },
    { factorId: "regulatory_compliance", enabled: false, weight: 1.0 },
    { factorId: "operational", enabled: false, weight: 1.0 },
    { factorId: "recoverability", enabled: false, weight: 1.0 },
    { factorId: "affected_users", enabled: false, weight: 1.0 },
    { factorId: "reputation", enabled: false, weight: 1.0 },
    { factorId: "privacy", enabled: false, weight: 1.0 },
    { factorId: "accountability", enabled: false, weight: 1.0 },
    { factorId: "physical_damage", enabled: false, weight: 1.0 },
    { factorId: "environmental", enabled: false, weight: 1.0 },
    { factorId: "supply_chain", enabled: false, weight: 1.0 },
    // Safety — auto-enabled when DFD / Asset Tab safety annotations detected
    { factorId: "safety", enabled: false, weight: 1.0, autoEnabled: false },
  ],
  showIndividualFactors: false,
  customFactors: [],
  useAssetImpact: true, // Phase 3: enabled by default
  assetImpactMapping: DEFAULT_ASSET_IMPACT_MAPPINGS["4-level"],
};

// ==================== RISK DATA CONTAINER ====================

/**
 * Complete risk data for a project
 */
export interface RiskData {
  /** Project-specific configuration */
  configuration: RiskConfiguration;

  /** List of risk assessments */
  risks: Risk[];

  /** Validation state */
  validation?: RiskValidation;

  /** Last modified timestamp */
  lastModified: string;
}

export interface RiskValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== RISK PROJECT INTERFACE ====================
// What Risk feature needs from a project (Dependency Inversion)

export interface RiskProjectData {
  id: string;
  name: string;
  risks: RiskData | null;
  phaseStatus: PhaseStatusMap;
  /** Threats from per-element method */
  perElementThreats: ThreatReference[];
  /** Threats from per-interaction method */
  perInteractionThreats: ThreatReference[];
  /** Asset data for impact display and pre-fill in Risk Dialog */
  assetDataRef?: AssetDataReference;
  /** DFD preview image */
  dfdPreviewImage?: string;
  /** DFD state — used for mitigation coverage badges in Risk Dialog */
  dfd?: DFDReference | null;
  lastModified: string;
}


/**
 * Simplified threat reference (no circular dependency)
 */
/**
 * Relevance values mirrored from threat-types — no circular import.
 * Keep in sync with ThreatRelevance in threat-types.ts.
 */
export type ThreatRelevanceRef = "unrated" | "relevant" | "not_relevant" | "uncertain";

/**
 * MitigationDraft mirrored from threat-types — no circular import.
 */
export interface MitigationDraftRef {
  id?: string;
  /** Resolved display text — populated at sync time from threat catalog */
  text?: string;
  notes?: string;
  isCustom?: boolean;
}

export interface ThreatReference {
  id: string;
  strideCategory: StrideCategory;
  threatDescription: string;
  attackDescription: string;
  sourceStrideMethod: StrideMethod;
  relevance: ThreatRelevanceRef;
  proposedMitigations: MitigationDraftRef[];
  proposedVerifications: MitigationDraftRef[];
  causeDescription?: string;
  linkedAssetIds?: string[];
  elementName?: string;
  dataFlowName?: string;
  trustBoundaryId: string | null;
  trustBoundaryName: string | null;
  /**
   * Per-element threat target — used for mitigation coverage derivation.
   * Null for per-interaction threats.
   */
  linkedElement?: LinkedDFDElement | null;
  /**
   * Per-interaction threat dataflow — used for mitigation coverage derivation.
   * Null for per-element threats.
   */
  dataFlow?: DataFlowReference | null;
}

// ==================== RISK UPDATE RESULT ====================
// What Risk returns to app layer after updates

export interface RiskUpdateResult {
  risks: RiskData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== RISK TAB PROPS ====================

export interface RiskTabProps {
  project: RiskProjectData;
  onUpdate: (updates: RiskUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== RISK MATRIX ====================

/**
 * Risk matrix cell definition
 */
export interface RiskMatrixCell {
  impact: number;
  likelihood: number;
  riskLevel: number;
  color: string;
  label: string;
}

/**
 * Generates risk matrix cells based on scale
 */
export function generateRiskMatrix(scale: RiskScaleType): RiskMatrixCell[][] {
  const scaleConfig = RISK_SCALES[scale];
  const size = scaleConfig.levels.length;
  const matrix: RiskMatrixCell[][] = [];

  for (let i = size; i >= 1; i--) {
    // Impact (rows, high to low)
    const row: RiskMatrixCell[] = [];
    for (let l = 1; l <= size; l++) {
      // Likelihood (columns, low to high)
      const riskLevel = Math.ceil((i * l) / size);
      const level = scaleConfig.levels[Math.min(riskLevel - 1, size - 1)];
      row.push({
        impact: i,
        likelihood: l,
        riskLevel,
        color: level.color,
        label: level.label,
      });
    }
    matrix.push(row);
  }

  return matrix;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate risk ID from threat ID
 */
export function generateRiskId(threatId: string): string {
  return `R-${threatId}`;
}

/**
 * Create empty risk for a threat
 */
export function createEmptyRisk(
  threatRef: ThreatReference,
  configuration: RiskConfiguration
): Risk {
  const enabledFactors = configuration.activeFactors.filter((f) => f.enabled);

  return {
    id: generateRiskId(threatRef.id),
    threatId: threatRef.id,
    threatDescription: threatRef.threatDescription,
    attackDescription: threatRef.attackDescription || "",
    causeDescription: threatRef.causeDescription,
    linkedAssetIds: threatRef.linkedAssetIds ?? [],
    threatRelevance: threatRef.relevance,
    proposedMitigations: threatRef.proposedMitigations ?? [],
    proposedVerifications: threatRef.proposedVerifications ?? [],
    strideCategory: threatRef.strideCategory,
    sourceStrideMethod: threatRef.sourceStrideMethod,
    factorRatings: enabledFactors.map((f) => ({
      factorId: f.factorId,
      value: 0,
      weight: f.weight,
    })),
    calculatedImpact: 0,
    calculatedLikelihood: 0,
    calculatedRiskBeforeMitigation: 0,
    selectedMitigations: [],
    selectedVerifications: [],
    mitigatedFactorRatings: enabledFactors.map((f) => ({
      factorId: f.factorId,
      value: 0,
      weight: f.weight,
    })),
    calculatedRiskAfterMitigation: 0,
    treatment: "reduce",
    treatmentJustification: "",
    moscowPriority: "should",
    wontJustification: "",
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

/**
 * @deprecated Use riskCalculationService.calculateRiskValues() instead.
 * Kept here temporarily for backward compatibility.
 */
export function calculateRiskValues(
  ratings: FactorRating[],
  configuration: RiskConfiguration
): { impact: number; likelihood: number; risk: number } {
  const scale = RISK_SCALES[configuration.scale];
  const maxValue = scale.levels.length;

  {
    // Complex: Separate Impact and Likelihood
    const allFactors = [
      ...ALL_PREDEFINED_FACTORS,
      ...configuration.customFactors,
    ];

    const impactRatings = ratings.filter((r) => {
      const factor = allFactors.find((f) => f.id === r.factorId);
      return factor?.category === "impact" && r.value > 0;
    });

    const likelihoodRatings = ratings.filter((r) => {
      const factor = allFactors.find((f) => f.id === r.factorId);
      return factor?.category === "likelihood" && r.value > 0;
    });

    const calculateWeightedAvg = (items: FactorRating[]): number => {
      if (items.length === 0) return 0;
      const weightedSum = items.reduce((sum, r) => sum + r.value * r.weight, 0);
      const totalWeight = items.reduce((sum, r) => sum + r.weight, 0);
      return totalWeight > 0 ? weightedSum / totalWeight : 0;
    };

    const impact = calculateWeightedAvg(impactRatings);
    const likelihood = calculateWeightedAvg(likelihoodRatings);

    // Risk = Impact × Likelihood, normalized to scale
    const risk = (impact * likelihood) / maxValue;

    return {
      impact: Math.round(impact * 10) / 10,
      likelihood: Math.round(likelihood * 10) / 10,
      risk: Math.round(risk * 10) / 10,
    };
  }
}

/**
 * Get factor definition by ID
 */
export function getFactorDefinition(
  factorId: string,
  customFactors: RiskFactorDefinition[] = []
): RiskFactorDefinition | undefined {
  return (
    ALL_PREDEFINED_FACTORS.find((f) => f.id === factorId) ||
    customFactors.find((f) => f.id === factorId)
  );
}

/**
 * Helper to calculate level index based on rounding method
 */
function calculateLevelIndex(
  value: number,
  maxLevels: number,
  roundingMethod: RiskRoundingMethod = "round"
): number {
  if (roundingMethod === "ceil") {
    // Conservative: 2.01-3.0 = High (index 2)
    return Math.min(Math.max(Math.ceil(value) - 1, 0), maxLevels - 1);
  } else {
    // Standard rounding: 2.5-3.49 = High (index 2)
    return Math.min(Math.max(Math.round(value) - 1, 0), maxLevels - 1);
  }
}

/**
 * Get color for risk value based on scale
 */
export function getRiskColor(
  value: number,
  scale: RiskScaleType,
  roundingMethod: RiskRoundingMethod = "round"
): string {
  if (value <= 0) return "#6b7280"; // gray for unrated
  const scaleConfig = RISK_SCALES[scale];
  const levelIndex = calculateLevelIndex(
    value,
    scaleConfig.levels.length,
    roundingMethod
  );
  return scaleConfig.levels[levelIndex].color;
}

/**
 * Get label for risk value based on scale
 */
export function getRiskLabel(
  value: number,
  scale: RiskScaleType,
  roundingMethod: RiskRoundingMethod = "round",
): string {
  if (value <= 0) return "-";
  const scaleConfig = RISK_SCALES[scale];
  const levelIndex = calculateLevelIndex(
    value,
    scaleConfig.levels.length,
    roundingMethod,
  );
  return scaleConfig.levels[levelIndex].label;
}

/**
 * Create default RiskData for new projects
 */
export function createDefaultRiskData(): RiskData {
  return {
    configuration: { ...DEFAULT_CONFIGURATION },
    risks: [],
    lastModified: new Date().toISOString(),
  };
}

/**
 * Filter risks to show in main table (excludes Won't)
 */
export function getActiveRisks(risks: Risk[]): Risk[] {
  return risks.filter((r) => r.moscowPriority !== "wont");
}

/**
 * Filter risks for Won't table
 */
export function getWontRisks(risks: Risk[]): Risk[] {
  return risks.filter((r) => r.moscowPriority === "wont");
}

/**
 * Filter risks by STRIDE method
 */
export function getRisksByStrideMethod(risks: Risk[], method: StrideMethod): Risk[] {
  return risks.filter((r) => r.sourceStrideMethod === method);
}

/**
 * Get active risks filtered by STRIDE method
 */
export function getActiveRisksByStrideMethod(risks: Risk[], method: StrideMethod): Risk[] {
  return risks.filter(
    (r) => r.moscowPriority !== "wont" && r.sourceStrideMethod === method
  );
}

/**
 * Get Won't risks filtered by STRIDE method
 */
export function getWontRisksByStrideMethod(risks: Risk[], method: StrideMethod): Risk[] {
  return risks.filter(
    (r) => r.moscowPriority === "wont" && r.sourceStrideMethod === method
  );
}

/**
 * Get statistics for risks
 */
export function getRiskStatistics(risks: Risk[]): {
  total: number;
  byPriority: Record<MoSCoWPriority, number>;
  byTreatment: Record<RiskTreatment, number>;
  highRiskCount: number;
  unratedCount: number;
} {
  const byPriority: Record<MoSCoWPriority, number> = {
    must: 0,
    should: 0,
    could: 0,
    wont: 0,
  };
  const byTreatment: Record<RiskTreatment, number> = {
    reduce: 0,
    eliminate: 0,
    accept: 0,
    transfer: 0,
    share: 0,
  };
  let highRiskCount = 0;
  let unratedCount = 0;

  for (const risk of risks) {
    byPriority[risk.moscowPriority]++;
    if (risk.treatment) byTreatment[risk.treatment]++;
    if (risk.calculatedRiskBeforeMitigation >= 3) highRiskCount++;
    if (risk.calculatedRiskBeforeMitigation === 0) unratedCount++;
  }

  return {
    total: risks.length,
    byPriority,
    byTreatment,
    highRiskCount,
    unratedCount,
  };
}

// ==================== FACTOR ID MIGRATION ====================

const LEGACY_DREAD_FACTOR_IDS = [
  "damage_potential", "reproducibility", "exploitability", "discoverability",
];

export const FACTOR_ID_MIGRATION_MAP: Record<string, string> = {
  loss_of_confidentiality: "privacy",
  loss_of_integrity:       "operational",
  loss_of_availability:    "operational",
  loss_of_accountability:  "accountability",
  reputation_damage:       "reputation",
  non_compliance:          "regulatory_compliance",
  privacy_violation:       "privacy",
};

function migrateFactorRatings(ratings: FactorRating[]): FactorRating[] {
  const migrated = new Map<string, FactorRating>();
  for (const rating of ratings) {
    const newId = FACTOR_ID_MIGRATION_MAP[rating.factorId] ?? rating.factorId;
    const existing = migrated.get(newId);
    if (!existing || rating.value > existing.value) {
      migrated.set(newId, { ...rating, factorId: newId });
    }
  }
  return Array.from(migrated.values());
}

function migrateActiveFactors(activeFactors: ActiveFactor[]): ActiveFactor[] {
  const migrated: ActiveFactor[] = [];
  const seenIds = new Set<string>();

  for (const f of activeFactors) {
    // Drop legacy DREAD factors entirely
    if (LEGACY_DREAD_FACTOR_IDS.includes(f.factorId)) continue;
    // Rename old IDs
    const newId = FACTOR_ID_MIGRATION_MAP[f.factorId] ?? f.factorId;
    if (seenIds.has(newId)) continue; // deduplicate
    seenIds.add(newId);
    migrated.push({ ...f, factorId: newId });
  }

  // Add new default factors if missing
  const newDefaults: ActiveFactor[] = [
    // Likelihood — OT/Embedded default
    { factorId: "deployment_scope",      enabled: true,  weight: 1.0 },
    // Impact — all disabled; syncActiveFactorsFromAssets enables from Asset Tab
    { factorId: "financial_damage",      enabled: false, weight: 1.0 },
    { factorId: "regulatory_compliance", enabled: false, weight: 1.0 },
    { factorId: "reputation",            enabled: false, weight: 1.0 },
    { factorId: "privacy",               enabled: false, weight: 1.0 },
    { factorId: "operational",           enabled: false, weight: 1.0 },
    { factorId: "affected_users",        enabled: false, weight: 1.0 },
    { factorId: "recoverability",        enabled: false, weight: 1.0 },
    { factorId: "accountability",        enabled: false, weight: 1.0 },
    { factorId: "physical_damage",       enabled: false, weight: 1.0 },
    { factorId: "environmental",         enabled: false, weight: 1.0 },
    { factorId: "supply_chain",          enabled: false, weight: 1.0 },
    { factorId: "safety",                enabled: false, weight: 1.0, autoEnabled: false },
  ];
  for (const f of newDefaults) {
    if (!seenIds.has(f.factorId)) {
      migrated.push(f);
      seenIds.add(f.factorId);
    }
  }

  return migrated;
}

export function migrateRiskData(data: RiskData | null | undefined): RiskData | null {
  if (!data) return null;

  // Guard: risks may not be an array in corrupt / partially deleted projects
  const risksArray = Array.isArray(data.risks) ? data.risks : [];

  if (!data.configuration) {
    return {
      ...data,
      configuration: { ...DEFAULT_CONFIGURATION },  // ← Default einsetzen
      risks: risksArray.map((risk) => ({
        ...risk,
        factorRatings: migrateFactorRatings(risk.factorRatings ?? []),
        mitigatedFactorRatings: migrateFactorRatings(
          risk.mitigatedFactorRatings ?? [],
        ),
      })),
    };
  }

  return {
    ...data,
    configuration: {
      ...data.configuration,
      activeFactors: migrateActiveFactors(data.configuration.activeFactors ?? []),
      useAssetImpact: true,
    },
    risks: risksArray.map((risk) => ({
      ...risk,
      factorRatings: migrateFactorRatings(risk.factorRatings ?? []),
      mitigatedFactorRatings: migrateFactorRatings(risk.mitigatedFactorRatings ?? []),
    })),
  };
}