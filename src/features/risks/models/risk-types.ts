// ==================== RISK TYPES ====================
// Core data models for the Risk Assessment feature
// NO dependency on app - follows Dependency Inversion Principle
//
// Architecture:
// - Risk entity per Threat (linked via threatId)
// - Configurable assessment methods (Simple/Complex)
// - Predefined factor templates (OWASP, ETSI, EN50742, custom)
// - MoSCoW prioritization with Won't-Risk filtering

import type { PhaseStatusMap, StrideCategory, StrideMethod } from "shared";
import type { AssetDataReference } from "features/threats/models/threat-types";

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
}

export interface RiskScaleConfig {
  type: RiskScaleType;
  levels: RiskScaleLevel[];
}

export const RISK_SCALES: Record<RiskScaleType, RiskScaleConfig> = {
  "3-level": {
    type: "3-level",
    levels: [
      { value: 1, label: "Low", color: "#22c55e" },
      { value: 2, label: "Medium", color: "#eab308" },
      { value: 3, label: "High", color: "#ef4444" },
    ],
  },
  "4-level": {
    type: "4-level",
    levels: [
      { value: 1, label: "Low", color: "#22c55e" },
      { value: 2, label: "Medium", color: "#eab308" },
      { value: 3, label: "High", color: "#f97316" },
      { value: 4, label: "Critical", color: "#ef4444" },
    ],
  },
  "5-level": {
    type: "5-level",
    levels: [
      { value: 1, label: "Low", color: "#22c55e" },
      { value: 2, label: "Medium", color: "#eab308" },
      { value: 3, label: "High", color: "#f97316" },
      { value: 4, label: "Very High", color: "#ef4444" },
      { value: 5, label: "Critical", color: "#a855f7" },
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
 */
export const OWASP_LIKELIHOOD_FACTORS: RiskFactorDefinition[] = [
  // Threat Agent Factors
  {
    id: "skill_level",
    category: "likelihood",
    name: "Skill Level",
    description: "How technically skilled is the attacker?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "motive",
    category: "likelihood",
    name: "Motive",
    description: "How motivated is the attacker?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "opportunity",
    category: "likelihood",
    name: "Opportunity",
    description: "What resources and opportunities are required?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "size",
    category: "likelihood",
    name: "Size",
    description: "How large is the group of potential attackers?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  // Vulnerability Factors
  {
    id: "ease_of_discovery",
    category: "likelihood",
    name: "Ease of Discovery",
    description: "How easy is it to find the vulnerability?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "ease_of_exploit",
    category: "likelihood",
    name: "Ease of Exploit",
    description: "How easy is it to actually exploit the vulnerability?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "awareness",
    category: "likelihood",
    name: "Awareness",
    description: "How well known is the vulnerability?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "intrusion_detection",
    category: "likelihood",
    name: "Intrusion Detection",
    description: "How likely is detection of an exploit?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
];

export const OWASP_IMPACT_FACTORS: RiskFactorDefinition[] = [
  // Technical Impact
  {
    id: "loss_of_confidentiality",
    category: "impact",
    name: "Loss of Confidentiality",
    description: "How much data could be disclosed?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "loss_of_integrity",
    category: "impact",
    name: "Loss of Integrity",
    description: "How much data could be corrupted?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "loss_of_availability",
    category: "impact",
    name: "Loss of Availability",
    description: "How much service could be lost?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "loss_of_accountability",
    category: "impact",
    name: "Loss of Accountability",
    description: "Are actions traceable to the attacker?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  // Business Impact (optional)
  {
    id: "financial_damage",
    category: "impact",
    name: "Financial Damage",
    description: "How much financial damage would result?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "reputation_damage",
    category: "impact",
    name: "Reputation Damage",
    description: "Would reputation be affected?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "non_compliance",
    category: "impact",
    name: "Non-Compliance",
    description: "How much regulation exposure?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "privacy_violation",
    category: "impact",
    name: "Privacy Violation",
    description: "How much personally identifiable information affected?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
];

/**
 * ETSI TVRA factors (alternative complex method)
 */
export const ETSI_FACTORS: RiskFactorDefinition[] = [
  {
    id: "knowledge",
    category: "likelihood",
    name: "Knowledge Factor",
    description: "Required knowledge to exploit",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "expertise",
    category: "likelihood",
    name: "Expertise Factor",
    description: "Required expertise level",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "time",
    category: "likelihood",
    name: "Time Factor",
    description: "Time required to exploit",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "equipment",
    category: "likelihood",
    name: "Equipment Factor",
    description: "Equipment required to exploit",
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
    description: "How long is the vulnerability accessible to an attacker?",
    defaultWeight: 1.0,
    source: "EN50742",
  },
  {
    id: "attacker_capability",
    category: "likelihood",
    name: "Attacker Capability (AC)",
    description: "Skill level, motivation and resources of a potential attacker.",
    defaultWeight: 1.0,
    source: "EN50742",
  },
  {
    id: "exposure_level",
    category: "likelihood",
    name: "Exposure Level (EL)",
    description: "How exposed is the asset or system to potential attackers?",
    defaultWeight: 1.0,
    source: "EN50742",
  },
];

/**
 * All predefined factors grouped by source
 */
export const ALL_PREDEFINED_FACTORS: RiskFactorDefinition[] = [
  ...OWASP_LIKELIHOOD_FACTORS,
  ...OWASP_IMPACT_FACTORS,
  ...ETSI_FACTORS,
  ...EN50742_FACTORS,
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

export type RiskStatus = "open" | "in-review" | "mitigated" | "accepted" | "wont-do";

export interface RiskStatusDefinition {
  value: RiskStatus;
  label: string;
  color: string;
}

export const RISK_STATUSES: RiskStatusDefinition[] = [
  { value: "open", label: "Open", color: "#ef4444" },
  { value: "in-review", label: "In Review", color: "#3b82f6" },
  { value: "mitigated", label: "Mitigated", color: "#22c55e" },
  { value: "accepted", label: "Accepted", color: "#eab308" },
  { value: "wont-do", label: "Won't Do", color: "#6b7280" },
];

// ==================== FACTOR RATING ====================

/**
 * Rating for a single factor
 */
export interface FactorRating {
  factorId: string;
  value: number; // 0 = not rated, 1-5 depending on scale
  weight: number; // 0.0 - 1.0
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
   * IDs of selected mitigations from proposedMitigations.
   * For catalog entries: the catalog ID (e.g. "M-S-001").
   * For custom entries: the notes text is used as identifier.
   */
  selectedMitigations: string[];

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

  /** Current status */
  status: RiskStatus;

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

  /** Is this factor currently active? */
  enabled: boolean;

  /** Current weight (can be modified from default) */
  weight: number;
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
    // Likelihood — OWASP + EN 50742
    { factorId: "skill_level", enabled: true, weight: 1.0 },
    { factorId: "motive", enabled: true, weight: 1.0 },
    { factorId: "opportunity", enabled: true, weight: 1.0 },
    { factorId: "ease_of_exploit", enabled: true, weight: 1.0 },
    { factorId: "window_of_opportunity", enabled: false, weight: 1.0 },
    { factorId: "attacker_capability", enabled: false, weight: 1.0 },
    { factorId: "exposure_level", enabled: false, weight: 1.0 },
    // Impact — OWASP
    { factorId: "loss_of_confidentiality", enabled: true, weight: 1.0 },
    { factorId: "loss_of_integrity", enabled: true, weight: 1.0 },
    { factorId: "loss_of_availability", enabled: true, weight: 1.0 },
    { factorId: "financial_damage", enabled: true, weight: 1.0 },
  ],
  showIndividualFactors: false,
  customFactors: [],
  useAssetImpact: false,
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
  notes?: string;
}

export interface ThreatReference {
  id: string;
  strideCategory: StrideCategory;
  threatDescription: string;
  attackDescription: string;
  /** Source STRIDE method */
  sourceStrideMethod: StrideMethod;
  /** Analyst relevance decision from Threat Eval phase */
  relevance: ThreatRelevanceRef;
  /** Proposed mitigations from catalog + analyst custom entries */
  proposedMitigations: MitigationDraftRef[];
  /** Proposed verifications from catalog + analyst custom entries */
  proposedVerifications: MitigationDraftRef[];
  /** Cause description from catalog (read-only, for Risk Dialog display) */
  causeDescription?: string;
  /** Linked asset IDs for impact pre-fill */
  linkedAssetIds?: string[];
  /** Element or DataFlow name for display */
  elementName?: string;
  dataFlowName?: string;
  /** Trust boundary info */
  trustBoundaryId: string | null;
  trustBoundaryName: string | null;
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
    status: "open",
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
  byStatus: Record<RiskStatus, number>;
  highRiskCount: number;
  unratedCount: number;
} {
  const byPriority: Record<MoSCoWPriority, number> = {
    must: 0,
    should: 0,
    could: 0,
    wont: 0,
  };
  const byStatus: Record<RiskStatus, number> = {
    open: 0,
    "in-review": 0,
    mitigated: 0,
    accepted: 0,
    "wont-do": 0,
  };
  let highRiskCount = 0;
  let unratedCount = 0;

  for (const risk of risks) {
    byPriority[risk.moscowPriority]++;
    byStatus[risk.status]++;
    if (risk.calculatedRiskBeforeMitigation >= 3) highRiskCount++;
    if (risk.calculatedRiskBeforeMitigation === 0) unratedCount++;
  }

  return {
    total: risks.length,
    byPriority,
    byStatus,
    highRiskCount,
    unratedCount,
  };
}