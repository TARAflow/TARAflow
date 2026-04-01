// ==================== IMPACT RATING SCALES ====================

/**
 * Available impact rating scales
 */
export type ImpactScaleType = "3-level" | "4-level" | "5-level";

/**
 * Impact rating for a single criterion
 */
export interface ImpactRating {
  criterionId: string;
  value: number | null | "na"; // not rated, not applicable or 1-3, 1-4, or 1-5 depending on scale
}

/**
 * Impact criterion with weight for weighted average calculation.
 * weights should sum to 1.0 across all active criteria.
 * For conservative (MAX) method, weight has no effect.
 */
export interface WeightedImpactCriterion {
  id: string;
  /** Relative weight 0.0–1.0. All active criteria weights should sum to 1.0 */
  weight: number;
}

export interface ImpactScaleConfig {
  type: ImpactScaleType;
  levels: ImpactLevel[];
}

export interface ImpactLevel {
  value: number;
  label: string;
  labelDE: string;
  color: string; // Tailwind color class or hex
}

export const IMPACT_SCALES: Record<ImpactScaleType, ImpactScaleConfig> = {
  "3-level": {
    type: "3-level",
    levels: [
      { value: 1, label: "Low", labelDE: "Niedrig", color: "green" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "yellow" },
      { value: 3, label: "High", labelDE: "Hoch", color: "red" },
    ],
  },
  "4-level": {
    type: "4-level",
    levels: [
      { value: 1, label: "Low", labelDE: "Niedrig", color: "green" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "yellow" },
      { value: 3, label: "High", labelDE: "Hoch", color: "orange" },
      { value: 4, label: "Critical", labelDE: "Kritisch", color: "red" },
    ],
  },
  "5-level": {
    type: "5-level",
    levels: [
      { value: 1, label: "Low", labelDE: "Niedrig", color: "green" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "yellow" },
      { value: 3, label: "High", labelDE: "Hoch", color: "orange" },
      { value: 4, label: "Very High", labelDE: "Sehr Hoch", color: "red" },
      { value: 5, label: "Critical", labelDE: "Kritisch", color: "purple" },
    ],
  },
};

// ==================== IMPACT CALCULATION ====================

export type ImpactCalculationMethod = "conservative" | "average";

// ==================== LEVEL THRESHOLD CALCULATION ====================

/**
 * How to round calculated impact values to level thresholds
 * - "round": Standard rounding (Math.round) - symmetric thresholds at .5
 * - "ceil": Conservative rounding (Math.ceil) - always round up to higher level
 */
export type ImpactRoundingMethod = "round" | "ceil";

// ==================== IMPACT CRITERIA ====================

/**
 * Categories for impact criteria
 */
export type ImpactCriteriaCategory = "business" | "physical";

/**
 * Predefined impact criteria that users can choose from
 */
export interface ImpactCriterionDefinition {
  id: string;
  category: ImpactCriteriaCategory;
  name: string;
  nameDE: string;
  description: string;
  descriptionDE: string;
}

/**
 * All available predefined impact criteria
 */
export const PREDEFINED_IMPACT_CRITERIA: ImpactCriterionDefinition[] = [
  // Business / Organizational
  {
    id: "financial_damage",
    category: "business",
    name: "Financial Damage",
    nameDE: "Finanzieller Schaden",
    description: "Costs from outages, SLA violations, RMA, fines",
    descriptionDE: "Kosten durch Ausfälle, SLA-Verletzungen, RMA, Bußgelder",
  },
  {
    id: "regulatory_compliance",
    category: "business",
    name: "Regulatory / Compliance",
    nameDE: "Regulatorik / Compliance",
    description: "Violations of GDPR, ISO 27001, FDA, etc.",
    descriptionDE: "Verstöße gegen DSGVO, ISO 27001, FDA, etc.",
  },
  {
    id: "reputation",
    category: "business",
    name: "Reputation / Brand",
    nameDE: "Reputation / Marke",
    description: "Loss of customer trust, negative media",
    descriptionDE: "Verlust von Kundenvertrauen, negative Medien",
  },
  {
    id: "privacy",
    category: "business",
    name: "Privacy / Data Protection",
    nameDE: "Datenschutz",
    description: "Sensitivity/amount of affected personal data",
    descriptionDE: "Sensitivität/Anzahl betroffener personenbezogener Daten",
  },
  {
    id: "operational",
    category: "business",
    name: "Operational Impact",
    nameDE: "Betriebliche Auswirkung",
    description: "Disruption of critical processes",
    descriptionDE: "Störung kritischer Prozesse",
  },
  {
    id: "affected_users",
    category: "business",
    name: "Affected Users / Systems",
    nameDE: "Betroffene Nutzer / Systeme",
    description: "How many users, units, machines or systems are affected",
    descriptionDE: "Wie viele Nutzer, Einheiten, Maschinen oder Systeme sind betroffen",
  },
  {
    id: "recoverability",
    category: "business",
    name: "Recoverability",
    nameDE: "Wiederherstellbarkeit",
    description: "Effort and time to restore asset after loss or manipulation",
    descriptionDE: "Aufwand und Zeit zur Wiederherstellung nach Verlust oder Manipulation",
  },
  // Physical
  {
    id: "safety",
    category: "physical",
    name: "Safety Impact",
    nameDE: "Sicherheitsauswirkung",
    description: "Risk to persons through physical damage",
    descriptionDE: "Gefährdung von Personen durch physische Schäden",
  },
  {
    id: "physical_damage",
    category: "physical",
    name: "Physical Asset Damage",
    nameDE: "Physischer Anlagenschaden",
    description: "Destruction or damage to physical assets",
    descriptionDE: "Zerstörung oder Beschädigung physischer Assets",
  },
  {
    id: "environmental",
    category: "physical",
    name: "Environmental Impact",
    nameDE: "Umweltauswirkung",
    description: "Environmental damage through manipulated processes",
    descriptionDE: "Umweltschäden durch manipulierte Prozesse",
  },
  {
    id: "supply_chain",
    category: "physical",
    name: "Supply Chain / Logistics",
    nameDE: "Lieferkette / Logistik",
    description: "Disruption of physical supply and transport chains",
    descriptionDE: "Störung physischer Liefer- und Transportketten",
  },
];


// ==================== SAFETY IMPACT SCALE ====================
// Fixed 4-level scale for the "safety" criterion — independent of project scale.
// Maps to ISO 12100 / EN 50742 injury severity categories.
//
// Values 1–4 are stored as ImpactRating.value and used in overallImpact calculation.
// The severity label is shown in the UI alongside the numeric level.

/**
 * Safety impact level — all labels are in i18n.
 * Use t("tabs.assets.safetyScale.{value}.label") and
 *     t("tabs.assets.safetyScale.{value}.severity")
 */
export interface SafetyImpactLevel {
  value: number;
  /** i18n key suffix: tabs.assets.safetyScale.{value}.label */
  labelKey: string;
  /** i18n key suffix: tabs.assets.safetyScale.{value}.severity */
  severityKey: string;
  severity: "reversible_minor" | "reversible_moderate" | "irreversible_injury" | "fatality";
  color: string;
}

export const SAFETY_IMPACT_SCALE: SafetyImpactLevel[] = [
  {
    value: 1,
    labelKey: "tabs.assets.safetyScale.1.label",
    severityKey: "tabs.assets.safetyScale.1.severity",
    severity: "reversible_minor",
    color: "#22c55e",
  },
  {
    value: 2,
    labelKey: "tabs.assets.safetyScale.2.label",
    severityKey: "tabs.assets.safetyScale.2.severity",
    severity: "reversible_moderate",
    color: "#eab308",
  },
  {
    value: 3,
    labelKey: "tabs.assets.safetyScale.3.label",
    severityKey: "tabs.assets.safetyScale.3.severity",
    severity: "irreversible_injury",
    color: "#f97316",
  },
  {
    value: 4,
    labelKey: "tabs.assets.safetyScale.4.label",
    severityKey: "tabs.assets.safetyScale.4.severity",
    severity: "fatality",
    color: "#dc2626",
  },
];

/** The criterion ID for the safety impact rating */
export const SAFETY_CRITERION_ID = "safety";

// NOTE: calculateOverallImpact → services/asset-impact-calculator.ts
// NOTE: getImpactLevel         → services/asset-impact-calculator.ts