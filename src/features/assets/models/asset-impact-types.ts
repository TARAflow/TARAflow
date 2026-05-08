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

/**
 * A single level within an impact scale.
 * Label text lives in i18n — use t(labelKey) in components.
 *
 * i18n key convention (namespace: asset.json):
 *   t(labelKey)  →  tabs.assets.impactScale.{scaleType}.{value}.label
 */
export interface ImpactLevel {
  value: number;
  /** Pre-computed i18n key — call t(level.labelKey) directly. */
  labelKey: string;
  color: string;
}

export const IMPACT_SCALES: Record<ImpactScaleType, ImpactScaleConfig> = {
  "3-level": {
    type: "3-level",
    levels: [
      {
        value: 1,
        labelKey: "tabs.assets.impactScale.3-level.1.label",
        color: "green",
      },
      {
        value: 2,
        labelKey: "tabs.assets.impactScale.3-level.2.label",
        color: "yellow",
      },
      {
        value: 3,
        labelKey: "tabs.assets.impactScale.3-level.3.label",
        color: "red",
      },
    ],
  },
  "4-level": {
    type: "4-level",
    levels: [
      {
        value: 1,
        labelKey: "tabs.assets.impactScale.4-level.1.label",
        color: "green",
      },
      {
        value: 2,
        labelKey: "tabs.assets.impactScale.4-level.2.label",
        color: "yellow",
      },
      {
        value: 3,
        labelKey: "tabs.assets.impactScale.4-level.3.label",
        color: "orange",
      },
      {
        value: 4,
        labelKey: "tabs.assets.impactScale.4-level.4.label",
        color: "red",
      },
    ],
  },
  "5-level": {
    type: "5-level",
    levels: [
      {
        value: 1,
        labelKey: "tabs.assets.impactScale.5-level.1.label",
        color: "green",
      },
      {
        value: 2,
        labelKey: "tabs.assets.impactScale.5-level.2.label",
        color: "yellow",
      },
      {
        value: 3,
        labelKey: "tabs.assets.impactScale.5-level.3.label",
        color: "orange",
      },
      {
        value: 4,
        labelKey: "tabs.assets.impactScale.5-level.4.label",
        color: "red",
      },
      {
        value: 5,
        labelKey: "tabs.assets.impactScale.5-level.5.label",
        color: "purple",
      },
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
 * Predefined impact criterion definition.
 * Display text (name, description) lives in i18n — see key convention below.
 *
 * i18n key convention (namespace: asset.json):
 *   name:        t(`${IMPACT_CRITERION_KEY_PREFIX}.${id}.name`)
 *   description: t(`${IMPACT_CRITERION_KEY_PREFIX}.${id}.description`)
 */
export interface ImpactCriterionDefinition {
  id: string;
  category: ImpactCriteriaCategory;
}

/**
 * All available predefined impact criteria.
 * Order determines display order in the UI.
 */
export const PREDEFINED_IMPACT_CRITERIA: ImpactCriterionDefinition[] = [
  // Business / Organizational
  { id: "financial_damage", category: "business" },
  { id: "regulatory_compliance", category: "business" },
  { id: "reputation", category: "business" },
  { id: "privacy", category: "business" },
  { id: "operational", category: "business" },
  { id: "affected_users", category: "business" },
  { id: "recoverability", category: "business" },
  // Physical
  { id: "safety", category: "physical" },
  { id: "physical_damage", category: "physical" },
  { id: "environmental", category: "physical" },
  { id: "supply_chain", category: "physical" },
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
  /** i18n key: tabs.assets.safetyScale.{value}.label */
  labelKey: string;
  /** i18n key: tabs.assets.safetyScale.{value}.severity */
  severityKey: string;
  severity:
    | "reversible_minor"
    | "reversible_moderate"
    | "irreversible_injury"
    | "fatality";
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

// ==================== I18N KEY PREFIXES ====================
// Centralised constants — avoids magic strings scattered across components.

/**
 * i18n key prefix for impact scale level labels.
 * Usage: t(`${IMPACT_SCALE_KEY_PREFIX}.${scaleType}.${level.value}.label`)
 *
 * Alternatively, use the pre-computed labelKey on each ImpactLevel:
 *   t(level.labelKey)
 */
export const IMPACT_SCALE_KEY_PREFIX = "tabs.assets.impactScale" as const;

/**
 * i18n key prefix for impact criterion translations.
 * Usage: t(`${IMPACT_CRITERION_KEY_PREFIX}.${id}.name`)
 *        t(`${IMPACT_CRITERION_KEY_PREFIX}.${id}.description`)
 */
export const IMPACT_CRITERION_KEY_PREFIX = "tabs.assets.impactCriteria" as const;

// NOTE: calculateOverallImpact → services/asset-impact-calculator.ts
// NOTE: getImpactLevel         → services/asset-impact-calculator.ts