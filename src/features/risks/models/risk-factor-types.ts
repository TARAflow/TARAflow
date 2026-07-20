// ==================== RISK FACTOR TYPES ====================
// Factor definitions, predefined factor catalogs, active factor, factor rating.
// Migration helpers for factor IDs.
//
// Dependencies: risk-scale-types (RiskScaleType, RiskScaleConfig)

import type { RiskScaleType } from "./risk-scale-types";

// ==================== FACTOR CATEGORY ====================

export type RiskFactorCategory = "impact" | "likelihood" | "combined";

// ==================== FACTOR DEFINITION ====================

export interface RiskFactorDefinition {
  id: string;
  category: RiskFactorCategory;
  name: string;
  description: string;
  defaultWeight: number;
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
 * OWASP Risk Rating likelihood factors.
 * Names/descriptions are i18n keys: risks.factors.{id}.name / .description
 */
export const OWASP_LIKELIHOOD_FACTORS: RiskFactorDefinition[] = [
  { id: "skill_level",        category: "likelihood", name: "Skill Level",        description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "motive",             category: "likelihood", name: "Motive",             description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "opportunity",        category: "likelihood", name: "Opportunity",        description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "size",               category: "likelihood", name: "Size",               description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "ease_of_discovery",  category: "likelihood", name: "Ease of Discovery",  description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "ease_of_exploit",    category: "likelihood", name: "Ease of Exploit",    description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "awareness",          category: "likelihood", name: "Awareness",          description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "intrusion_detection",category: "likelihood", name: "Intrusion Detection",description: "", defaultWeight: 1.0, source: "OWASP" },
];

/**
 * Impact factors — IDs aligned with Asset Tab impact criteria (1:1 mapping).
 * Names/descriptions are i18n keys: risks.factors.{id}.name / .description
 */
export const IMPACT_FACTORS: RiskFactorDefinition[] = [
  { id: "financial_damage",      category: "impact", name: "Financial Damage",      description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "regulatory_compliance", category: "impact", name: "Regulatory Compliance", description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "reputation",            category: "impact", name: "Reputation Damage",     description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "privacy",               category: "impact", name: "Privacy Violation",     description: "", defaultWeight: 1.0, source: "OWASP" },
  { id: "operational",           category: "impact", name: "Operational Impact",    description: "", defaultWeight: 1.0, source: "OWASP" },
  // OT/TARA extended
  { id: "affected_users",        category: "impact", name: "Affected Users",        description: "", defaultWeight: 1.0, source: "custom" },
  { id: "recoverability",        category: "impact", name: "Recoverability",        description: "", defaultWeight: 1.0, source: "custom" },
  { id: "accountability",        category: "impact", name: "Accountability Loss",   description: "", defaultWeight: 1.0, source: "custom" },
  // safety: auto-enabled when DFD / Asset Tab safety annotations detected
  { id: "safety",                category: "impact", name: "Safety Impact",         description: "", defaultWeight: 1.0, source: "custom" },
  { id: "physical_damage",       category: "impact", name: "Physical Damage",       description: "", defaultWeight: 1.0, source: "custom" },
  { id: "environmental",         category: "impact", name: "Environmental Impact",  description: "", defaultWeight: 1.0, source: "custom" },
  { id: "supply_chain",          category: "impact", name: "Supply Chain Impact",   description: "", defaultWeight: 1.0, source: "custom" },
];

/** ETSI TVRA likelihood factors */
export const ETSI_FACTORS: RiskFactorDefinition[] = [
  { id: "knowledge", category: "likelihood", name: "Knowledge Factor", description: "", defaultWeight: 1.0, source: "ETSI" },
  { id: "expertise", category: "likelihood", name: "Expertise Factor", description: "", defaultWeight: 1.0, source: "ETSI" },
  { id: "time",      category: "likelihood", name: "Time Factor",      description: "", defaultWeight: 1.0, source: "ETSI" },
  { id: "equipment", category: "likelihood", name: "Equipment Factor", description: "", defaultWeight: 1.0, source: "ETSI" },
];

/** EN 50742 / IEC 62443-3-2 Attacker Potential factors */
export const EN50742_FACTORS: RiskFactorDefinition[] = [
  { id: "window_of_opportunity", category: "likelihood", name: "Window of Opportunity (WoO)", description: "", defaultWeight: 1.0, source: "EN50742" },
  { id: "attacker_capability",   category: "likelihood", name: "Attacker Capability (AC)",    description: "", defaultWeight: 1.0, source: "EN50742" },
  { id: "exposure_level",        category: "likelihood", name: "Exposure Level (EL)",          description: "", defaultWeight: 1.0, source: "EN50742" },
];

/**
 * TARAflow OT/Embedded/IoT specific factors.
 * deployment_scope: can a single attack compromise multiple installations simultaneously?
 * Distinct from affected_users (how many are harmed) — measures attack amplification.
 */
export const TARAFLOW_FACTORS: RiskFactorDefinition[] = [
  {
    id: "deployment_scope",
    category: "likelihood",
    name: "Deployment Scope",
    description: "",
    defaultWeight: 1.0,
    source: "custom",
  },
  // 5b-2: the likelihood contributed by a threat-anchored attack tree. It is an
  // ordinary likelihood factor (default weight 1) that averages into the same
  // weighted mean as the OWASP factors — no special case in calculateRiskValues.
  // The VALUE arrives pre-computed from the attack-tree side (already mapped to
  // the risk scale); features/risks never imports FeasibilityLevel or anything
  // from features/attacktree. See ATTACK_TREE_LIKELIHOOD_FACTOR_ID.
  {
    id: "attack_tree_likelihood",
    category: "likelihood",
    name: "Attack Tree Likelihood",
    description: "",
    defaultWeight: 1.0,
    source: "custom",
  },
];

/**
 * Shared id constant so callers reference the attack-tree likelihood factor
 * without a magic string. Kept in features/risks (this is a risks concept — a
 * likelihood factor — that attack-tree data happens to feed).
 */
export const ATTACK_TREE_LIKELIHOOD_FACTOR_ID = "attack_tree_likelihood";

export const ALL_PREDEFINED_FACTORS: RiskFactorDefinition[] = [
  ...OWASP_LIKELIHOOD_FACTORS,
  ...IMPACT_FACTORS,
  ...ETSI_FACTORS,
  ...EN50742_FACTORS,
  ...TARAFLOW_FACTORS,
];

// ==================== FACTOR RATING ====================

export interface FactorRating {
  factorId: string;
  /** Current value. 0 = not rated, 1–N depending on active scale. */
  value: number;
  weight: number;
  /**
   * Value automatically derived from Asset Tab data.
   * Populated when source === "derived".
   */
  derivedValue?: number;
  /**
   * "derived"    → set from Asset Tab, not manually changed
   * "manual"     → analyst explicitly overrode the derived value
   * "attack-tree" → set from an attack tree's likelihood (5b-2); protected
   *                 from the Asset-Tab prefill just like "manual"
   * undefined    → no derivation available
   */
  source?: "derived" | "manual" | "attack-tree";
}

// ==================== ACTIVE FACTOR ====================

export interface ActiveFactor {
  factorId: string;
  enabled: boolean;
  weight: number;
  /**
   * true  → auto-enabled because safety data detected
   * false / undefined → analyst explicitly enabled
   */
  autoEnabled?: boolean;
}

// ==================== ASSET IMPACT MAPPING ====================

export type AssetImpactLevel = "LOW" | "MED" | "MED+" | "HIGH" | "HIGH+" | "CRITICAL";
export type AssetImpactMapping = Record<AssetImpactLevel, number>;

export const DEFAULT_ASSET_IMPACT_MAPPINGS: Record<RiskScaleType, AssetImpactMapping> = {
  "3-level": { LOW: 1, MED: 2, "MED+": 2, HIGH: 3, "HIGH+": 3, CRITICAL: 3 },
  "4-level": { LOW: 1, MED: 2, "MED+": 2, HIGH: 3, "HIGH+": 4, CRITICAL: 4 },
  "5-level": { LOW: 1, MED: 2, "MED+": 3, HIGH: 4, "HIGH+": 4, CRITICAL: 5 },
};

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

export function migrateFactorRatings(ratings: FactorRating[]): FactorRating[] {
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

export function migrateActiveFactors(activeFactors: ActiveFactor[]): ActiveFactor[] {
  const migrated: ActiveFactor[] = [];
  const seenIds = new Set<string>();

  for (const f of activeFactors) {
    if (LEGACY_DREAD_FACTOR_IDS.includes(f.factorId)) continue;
    const newId = FACTOR_ID_MIGRATION_MAP[f.factorId] ?? f.factorId;
    if (seenIds.has(newId)) continue;
    seenIds.add(newId);
    migrated.push({ ...f, factorId: newId });
  }

  const newDefaults: ActiveFactor[] = [
    { factorId: "deployment_scope",      enabled: true,  weight: 1.0 },
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

// ==================== HELPER ====================

export function getFactorDefinition(
  factorId: string,
  customFactors: RiskFactorDefinition[] = [],
): RiskFactorDefinition | undefined {
  return (
    ALL_PREDEFINED_FACTORS.find((f) => f.id === factorId) ||
    customFactors.find((f) => f.id === factorId)
  );
}