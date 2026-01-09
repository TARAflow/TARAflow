// ==================== RISK TYPES ====================
// Core data models for the Risk Assessment feature
// NO dependency on app - follows Dependency Inversion Principle
//
// Architecture:
// - Risk entity per Threat (linked via threatId)
// - Configurable assessment methods (Simple/Complex)
// - Predefined factor templates (DREAD, OWASP, ETSI, etc.)
// - MoSCoW prioritization with Won't-Risk filtering

import type { PhaseStatusMap, StrideCategory, StrideMethod } from "shared";

// ==================== RISK METHOD ====================

/**
 * Risk assessment method type
 * - simple: Combined factors (DREAD-like), single risk score
 * - complex: Separate Impact/Likelihood factors (OWASP/ETSI-like)
 */
export type RiskMethodType = "simple" | "complex";

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
  labelDE: string;
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
      { value: 1, label: "Low", labelDE: "Niedrig", color: "#22c55e" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "#eab308" },
      { value: 3, label: "High", labelDE: "Hoch", color: "#ef4444" },
    ],
  },
  "4-level": {
    type: "4-level",
    levels: [
      { value: 1, label: "Low", labelDE: "Niedrig", color: "#22c55e" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "#eab308" },
      { value: 3, label: "High", labelDE: "Hoch", color: "#f97316" },
      { value: 4, label: "Critical", labelDE: "Kritisch", color: "#ef4444" },
    ],
  },
  "5-level": {
    type: "5-level",
    levels: [
      { value: 1, label: "Low", labelDE: "Niedrig", color: "#22c55e" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "#eab308" },
      { value: 3, label: "High", labelDE: "Hoch", color: "#f97316" },
      { value: 4, label: "Very High", labelDE: "Sehr Hoch", color: "#ef4444" },
      { value: 5, label: "Critical", labelDE: "Kritisch", color: "#a855f7" },
    ],
  },
};

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
  nameDE: string;
  description: string;
  descriptionDE: string;
  /** Default weight (0.0 - 1.0) */
  defaultWeight: number;
  /** Source methodology */
  source: "DREAD" | "OWASP" | "ETSI" | "ISO27005" | "FAIR" | "CVSS" | "custom";
}

// ==================== PREDEFINED FACTORS ====================

/**
 * DREAD factors (simple method default)
 */
export const DREAD_FACTORS: RiskFactorDefinition[] = [
  {
    id: "damage_potential",
    category: "combined",
    name: "Damage Potential",
    nameDE: "Schadenspotential",
    description: "How much damage could result from the threat?",
    descriptionDE: "Wie viel Schaden könnte durch die Bedrohung entstehen?",
    defaultWeight: 1.0,
    source: "DREAD",
  },
  {
    id: "reproducibility",
    category: "combined",
    name: "Reproducibility",
    nameDE: "Reproduzierbarkeit",
    description: "How easy is it to reproduce the attack?",
    descriptionDE: "Wie einfach ist es, den Angriff zu reproduzieren?",
    defaultWeight: 1.0,
    source: "DREAD",
  },
  {
    id: "exploitability",
    category: "combined",
    name: "Exploitability",
    nameDE: "Ausnutzbarkeit",
    description: "How much skill is needed to exploit the vulnerability?",
    descriptionDE: "Welche Fähigkeiten werden benötigt, um die Schwachstelle auszunutzen?",
    defaultWeight: 1.0,
    source: "DREAD",
  },
  {
    id: "affected_users",
    category: "combined",
    name: "Affected Users",
    nameDE: "Betroffene Nutzer",
    description: "How many users would be affected?",
    descriptionDE: "Wie viele Nutzer wären betroffen?",
    defaultWeight: 1.0,
    source: "DREAD",
  },
  {
    id: "discoverability",
    category: "combined",
    name: "Discoverability",
    nameDE: "Entdeckbarkeit",
    description: "How easy is it to discover the vulnerability?",
    descriptionDE: "Wie einfach ist es, die Schwachstelle zu entdecken?",
    defaultWeight: 1.0,
    source: "DREAD",
  },
];

/**
 * OWASP Risk Rating factors (complex method default)
 */
export const OWASP_LIKELIHOOD_FACTORS: RiskFactorDefinition[] = [
  // Threat Agent Factors
  {
    id: "skill_level",
    category: "likelihood",
    name: "Skill Level",
    nameDE: "Fähigkeitsniveau",
    description: "How technically skilled is the attacker?",
    descriptionDE: "Wie technisch versiert ist der Angreifer?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "motive",
    category: "likelihood",
    name: "Motive",
    nameDE: "Motivation",
    description: "How motivated is the attacker?",
    descriptionDE: "Wie motiviert ist der Angreifer?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "opportunity",
    category: "likelihood",
    name: "Opportunity",
    nameDE: "Gelegenheit",
    description: "What resources and opportunities are required?",
    descriptionDE: "Welche Ressourcen und Gelegenheiten sind erforderlich?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "size",
    category: "likelihood",
    name: "Size",
    nameDE: "Größe",
    description: "How large is the group of potential attackers?",
    descriptionDE: "Wie groß ist die Gruppe potenzieller Angreifer?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  // Vulnerability Factors
  {
    id: "ease_of_discovery",
    category: "likelihood",
    name: "Ease of Discovery",
    nameDE: "Einfachheit der Entdeckung",
    description: "How easy is it to find the vulnerability?",
    descriptionDE: "Wie einfach ist es, die Schwachstelle zu finden?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "ease_of_exploit",
    category: "likelihood",
    name: "Ease of Exploit",
    nameDE: "Einfachheit der Ausnutzung",
    description: "How easy is it to actually exploit the vulnerability?",
    descriptionDE: "Wie einfach ist es, die Schwachstelle auszunutzen?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "awareness",
    category: "likelihood",
    name: "Awareness",
    nameDE: "Bekanntheit",
    description: "How well known is the vulnerability?",
    descriptionDE: "Wie bekannt ist die Schwachstelle?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "intrusion_detection",
    category: "likelihood",
    name: "Intrusion Detection",
    nameDE: "Einbruchserkennung",
    description: "How likely is detection of an exploit?",
    descriptionDE: "Wie wahrscheinlich ist die Erkennung eines Angriffs?",
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
    nameDE: "Vertraulichkeitsverlust",
    description: "How much data could be disclosed?",
    descriptionDE: "Wie viele Daten könnten offengelegt werden?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "loss_of_integrity",
    category: "impact",
    name: "Loss of Integrity",
    nameDE: "Integritätsverlust",
    description: "How much data could be corrupted?",
    descriptionDE: "Wie viele Daten könnten beschädigt werden?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "loss_of_availability",
    category: "impact",
    name: "Loss of Availability",
    nameDE: "Verfügbarkeitsverlust",
    description: "How much service could be lost?",
    descriptionDE: "Wie viel Dienst könnte ausfallen?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "loss_of_accountability",
    category: "impact",
    name: "Loss of Accountability",
    nameDE: "Nachweisbarkeitsverlust",
    description: "Are actions traceable to the attacker?",
    descriptionDE: "Sind Aktionen zum Angreifer rückverfolgbar?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  // Business Impact (optional)
  {
    id: "financial_damage",
    category: "impact",
    name: "Financial Damage",
    nameDE: "Finanzieller Schaden",
    description: "How much financial damage would result?",
    descriptionDE: "Wie viel finanzieller Schaden würde entstehen?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "reputation_damage",
    category: "impact",
    name: "Reputation Damage",
    nameDE: "Reputationsschaden",
    description: "Would reputation be affected?",
    descriptionDE: "Würde die Reputation beeinträchtigt?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "non_compliance",
    category: "impact",
    name: "Non-Compliance",
    nameDE: "Nichteinhaltung",
    description: "How much regulation exposure?",
    descriptionDE: "Wie viel Regulierungsrisiko?",
    defaultWeight: 1.0,
    source: "OWASP",
  },
  {
    id: "privacy_violation",
    category: "impact",
    name: "Privacy Violation",
    nameDE: "Datenschutzverletzung",
    description: "How much personally identifiable information affected?",
    descriptionDE: "Wie viele personenbezogene Daten betroffen?",
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
    nameDE: "Wissensfaktor",
    description: "Required knowledge to exploit",
    descriptionDE: "Erforderliches Wissen zur Ausnutzung",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "expertise",
    category: "likelihood",
    name: "Expertise Factor",
    nameDE: "Expertisefaktor",
    description: "Required expertise level",
    descriptionDE: "Erforderliches Expertenniveau",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "time",
    category: "likelihood",
    name: "Time Factor",
    nameDE: "Zeitfaktor",
    description: "Time required to exploit",
    descriptionDE: "Erforderliche Zeit zur Ausnutzung",
    defaultWeight: 1.0,
    source: "ETSI",
  },
  {
    id: "equipment",
    category: "likelihood",
    name: "Equipment Factor",
    nameDE: "Ausrüstungsfaktor",
    description: "Equipment required to exploit",
    descriptionDE: "Erforderliche Ausrüstung zur Ausnutzung",
    defaultWeight: 1.0,
    source: "ETSI",
  },
];

/**
 * All predefined factors grouped by source
 */
export const ALL_PREDEFINED_FACTORS: RiskFactorDefinition[] = [
  ...DREAD_FACTORS,
  ...OWASP_LIKELIHOOD_FACTORS,
  ...OWASP_IMPACT_FACTORS,
  ...ETSI_FACTORS,
];

// ==================== MOSCOW PRIORITY ====================

export type MoSCoWPriority = "must" | "should" | "could" | "wont";

export interface MoSCoWDefinition {
  value: MoSCoWPriority;
  label: string;
  labelDE: string;
  description: string;
  descriptionDE: string;
  color: string;
}

export const MOSCOW_PRIORITIES: MoSCoWDefinition[] = [
  {
    value: "must",
    label: "Must",
    labelDE: "Muss",
    description: "Critical - must be addressed",
    descriptionDE: "Kritisch - muss behandelt werden",
    color: "#ef4444",
  },
  {
    value: "should",
    label: "Should",
    labelDE: "Sollte",
    description: "Important - should be addressed if possible",
    descriptionDE: "Wichtig - sollte wenn möglich behandelt werden",
    color: "#f97316",
  },
  {
    value: "could",
    label: "Could",
    labelDE: "Könnte",
    description: "Nice to have - could be addressed",
    descriptionDE: "Wünschenswert - könnte behandelt werden",
    color: "#eab308",
  },
  {
    value: "wont",
    label: "Won't",
    labelDE: "Wird nicht",
    description: "Accepted risk - won't be addressed this iteration",
    descriptionDE: "Akzeptiertes Risiko - wird nicht in dieser Iteration behandelt",
    color: "#6b7280",
  },
];

// ==================== RISK STATUS ====================

export type RiskStatus = "open" | "in-review" | "mitigated" | "accepted" | "wont-do";

export interface RiskStatusDefinition {
  value: RiskStatus;
  label: string;
  labelDE: string;
  color: string;
}

export const RISK_STATUSES: RiskStatusDefinition[] = [
  { value: "open", label: "Open", labelDE: "Offen", color: "#ef4444" },
  { value: "in-review", label: "In Review", labelDE: "In Prüfung", color: "#3b82f6" },
  { value: "mitigated", label: "Mitigated", labelDE: "Mitigiert", color: "#22c55e" },
  { value: "accepted", label: "Accepted", labelDE: "Akzeptiert", color: "#eab308" },
  { value: "wont-do", label: "Won't Do", labelDE: "Wird nicht gemacht", color: "#6b7280" },
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

  /** Original mitigation from threat (read-only reference) */
  originalMitigation: string;

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

  /** Mitigation info (copied from threat, can be modified) */
  selectedMitigations: string[];

  /** Re-rated factors after mitigation */
  mitigatedFactorRatings: FactorRating[];

  /** Calculated risk after mitigation */
  calculatedRiskAfterMitigation: number;

  /** MoSCoW priority */
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
}

/**
 * Default configuration for simple method
 */
export const DEFAULT_SIMPLE_CONFIGURATION: RiskConfiguration = {
  method: "simple",
  scale: "4-level",
  roundingMethod: "round",
  activeStrideMethod: "per-element",
  activeFactors: DREAD_FACTORS.map((f) => ({
    factorId: f.id,
    enabled: true,
    weight: f.defaultWeight,
  })),
  showIndividualFactors: false,
  customFactors: [],
};

/**
 * Default configuration for complex method
 */
export const DEFAULT_COMPLEX_CONFIGURATION: RiskConfiguration = {
  method: "complex",
  scale: "4-level",
  roundingMethod: "round",
  activeStrideMethod: "per-element",
  activeFactors: [
    // Likelihood (subset of OWASP)
    { factorId: "skill_level", enabled: true, weight: 1.0 },
    { factorId: "motive", enabled: true, weight: 1.0 },
    { factorId: "opportunity", enabled: true, weight: 1.0 },
    { factorId: "ease_of_exploit", enabled: true, weight: 1.0 },
    // Impact (subset of OWASP)
    { factorId: "loss_of_confidentiality", enabled: true, weight: 1.0 },
    { factorId: "loss_of_integrity", enabled: true, weight: 1.0 },
    { factorId: "loss_of_availability", enabled: true, weight: 1.0 },
    { factorId: "financial_damage", enabled: true, weight: 1.0 },
  ],
  showIndividualFactors: false,
  customFactors: [],
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
  /** DFD preview image */
  dfdPreviewImage?: string;
  lastModified: string;
}

/**
 * Simplified threat reference (no circular dependency)
 */
export interface ThreatReference {
  id: string;
  strideCategory: StrideCategory;
  threatDescription: string;
  attackDescription: string;
  mitigation: string;
  /** Source STRIDE method */
  sourceStrideMethod: StrideMethod;
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
  labelDE: string;
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
        labelDE: level.labelDE,
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
    originalMitigation: threatRef.mitigation || "",
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
    selectedMitigations: threatRef.mitigation ? [threatRef.mitigation] : [],
    mitigatedFactorRatings: enabledFactors.map((f) => ({
      factorId: f.factorId,
      value: 0,
      weight: f.weight,
    })),
    calculatedRiskAfterMitigation: 0,
    moscowPriority: "should",
    wontJustification: "",
    status: "open",
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

/**
 * Calculate risk values based on method
 */
export function calculateRiskValues(
  ratings: FactorRating[],
  configuration: RiskConfiguration
): { impact: number; likelihood: number; risk: number } {
  const scale = RISK_SCALES[configuration.scale];
  const maxValue = scale.levels.length;

  if (configuration.method === "simple") {
    // DREAD: Average of all factors
    const ratedFactors = ratings.filter((r) => r.value > 0);
    if (ratedFactors.length === 0) {
      return { impact: 0, likelihood: 0, risk: 0 };
    }

    const weightedSum = ratedFactors.reduce(
      (sum, r) => sum + r.value * r.weight,
      0
    );
    const totalWeight = ratedFactors.reduce((sum, r) => sum + r.weight, 0);
    const avgRisk = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      impact: avgRisk,
      likelihood: avgRisk,
      risk: Math.round(avgRisk * 10) / 10,
    };
  } else {
    // Complex: Separate Impact and Likelihood
    const allFactors = [...ALL_PREDEFINED_FACTORS, ...configuration.customFactors];

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
  isGerman: boolean,
  roundingMethod: RiskRoundingMethod = "round"
): string {
  if (value <= 0) return "-";
  const scaleConfig = RISK_SCALES[scale];
  const levelIndex = calculateLevelIndex(
    value,
    scaleConfig.levels.length,
    roundingMethod
  );
  return isGerman
    ? scaleConfig.levels[levelIndex].labelDE
    : scaleConfig.levels[levelIndex].label;
}

/**
 * Create default RiskData for new projects
 */
export function createDefaultRiskData(): RiskData {
  return {
    configuration: { ...DEFAULT_SIMPLE_CONFIGURATION },
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