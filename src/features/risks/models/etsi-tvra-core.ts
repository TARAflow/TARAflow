// ==================== ETSI TVRA ATTACK-POTENTIAL CORE ====================
// Pure computation for the ETSI TS 102 165-1 (TVRA) attack potential via the
// Common Criteria B.4 / ISO/IEC 18045 weighted-summation method.
//
// Score-table family (see regulation-likelihood-cores-design.md §2b + §5).
// Six factors: the five CC/18045 factors (same basis ISO 21434 adapts) plus the
// ETSI-specific Intensity factor. Values SUMMED to an attack potential, mapped
// to a 5-level attack-potential band (Basic … Beyond High).
//
// VERIFY: the ETSI source OCR was corrupted for the numeric columns. The five
// shared-factor point tables below use the CC B.4 / ISO 18045 basis (identical
// to ISO 21434 Table G.6, which is clean); Intensity is verbatim from TS 102
// 165-1 Table 3. Confirm the exact ETSI time granularity and band mapping
// against a clean copy of the standard. All numbers are centralized here for a
// one-line adjustment. Mirrors en50742-approach-a-core.ts. Pure, no deps.

// -------------------- Factor levels --------------------

export type TvraTime =
  | "<=1day"
  | "<=1week"
  | "<=1month"
  | "<=6months"
  | ">6months";

export type TvraExpertise =
  | "layman"
  | "proficient"
  | "expert"
  | "multiple-experts";

export type TvraKnowledge =
  | "public"
  | "restricted"
  | "sensitive"
  | "critical";

export type TvraOpportunity =
  | "unlimited"
  | "easy"
  | "moderate"
  | "difficult";

export type TvraEquipment =
  | "standard"
  | "specialized"
  | "bespoke"
  | "multiple-bespoke";

/** ETSI-specific sixth factor (TS 102 165-1 Table 3). */
export type TvraIntensity = "single" | "moderate-multiple" | "heavy-multiple";

export interface TvraFactors {
  time: TvraTime;
  expertise: TvraExpertise;
  knowledge: TvraKnowledge;
  opportunity: TvraOpportunity;
  equipment: TvraEquipment;
  intensity: TvraIntensity;
}

// -------------------- Point tables --------------------
// Five CC B.4 / ISO 18045 factors (VERIFY exact ETSI values, see header):

export const TVRA_TIME_POINTS: Record<TvraTime, number> = {
  "<=1day": 0,
  "<=1week": 1,
  "<=1month": 4,
  "<=6months": 17,
  ">6months": 19,
};

export const TVRA_EXPERTISE_POINTS: Record<TvraExpertise, number> = {
  layman: 0,
  proficient: 3,
  expert: 6,
  "multiple-experts": 8,
};

export const TVRA_KNOWLEDGE_POINTS: Record<TvraKnowledge, number> = {
  public: 0,
  restricted: 3,
  sensitive: 7,
  critical: 11,
};

export const TVRA_OPPORTUNITY_POINTS: Record<TvraOpportunity, number> = {
  unlimited: 0,
  easy: 1,
  moderate: 4,
  difficult: 10,
};

export const TVRA_EQUIPMENT_POINTS: Record<TvraEquipment, number> = {
  standard: 0,
  specialized: 4,
  bespoke: 7,
  "multiple-bespoke": 9,
};

/** Intensity (TS 102 165-1 Table 3 — verbatim). */
export const TVRA_INTENSITY_POINTS: Record<TvraIntensity, number> = {
  single: 0,
  "moderate-multiple": 1,
  "heavy-multiple": 2,
};

// -------------------- Attack potential --------------------

/** Attack potential = weighted summation of all six factor point values. */
export function tvraAttackPotential(f: TvraFactors): number {
  return (
    TVRA_TIME_POINTS[f.time] +
    TVRA_EXPERTISE_POINTS[f.expertise] +
    TVRA_KNOWLEDGE_POINTS[f.knowledge] +
    TVRA_OPPORTUNITY_POINTS[f.opportunity] +
    TVRA_EQUIPMENT_POINTS[f.equipment] +
    TVRA_INTENSITY_POINTS[f.intensity]
  );
}

// -------------------- Attack potential level (CC B.4 resistance) -----------

export type TvraApLevel =
  | "basic"
  | "enhanced-basic"
  | "moderate"
  | "high"
  | "beyond-high";

export interface TvraApBand {
  min: number;
  max: number; // inclusive; Infinity for the open top band
  level: TvraApLevel;
}

/** CC B.4 / ISO 18045 attack-potential resistance mapping. */
export const TVRA_AP_BANDS: readonly TvraApBand[] = [
  { min: 0, max: 9, level: "basic" },
  { min: 10, max: 13, level: "enhanced-basic" },
  { min: 14, max: 19, level: "moderate" },
  { min: 20, max: 24, level: "high" },
  { min: 25, max: Infinity, level: "beyond-high" },
];

export function tvraApLevel(attackPotential: number): TvraApLevel {
  const band = TVRA_AP_BANDS.find(
    (b) => attackPotential >= b.min && attackPotential <= b.max,
  );
  if (!band) {
    throw new RangeError(`attackPotential out of range: ${attackPotential}`);
  }
  return band.level;
}

/**
 * Occurrence likelihood, higher AP required ⇒ lower likelihood. Ordinal 5..1
 * (5 = highest likelihood, from a Basic attack potential; 1 = lowest, from
 * Beyond High). Map to the project likelihood scale at the call site.
 */
export const TVRA_AP_LEVEL_LIKELIHOOD: Record<TvraApLevel, number> = {
  basic: 5,
  "enhanced-basic": 4,
  moderate: 3,
  high: 2,
  "beyond-high": 1,
};

/** Convenience: factors → attack potential, level, and ordinal likelihood. */
export function tvraRate(f: TvraFactors): {
  attackPotential: number;
  level: TvraApLevel;
  likelihood: number;
} {
  const attackPotential = tvraAttackPotential(f);
  const level = tvraApLevel(attackPotential);
  return { attackPotential, level, likelihood: TVRA_AP_LEVEL_LIKELIHOOD[level] };
}

// -------------------- Factor-id → level registry --------------------
// Maps the RiskFactorDefinition ids (risk-factor-types ETSI_FACTORS, the TVRA
// 6-set) to the ordered level keys of this core. FactorRating.value (1-based)
// → levels[value-1]. Value 0 = not rated. NOTE the id naming: the four legacy
// ETSI ids stay (knowledge/expertise/time/equipment); opportunity + intensity
// were added as etsi_opportunity / etsi_intensity to avoid id collisions.

export const TVRA_FACTOR_LEVELS = {
  time: [
    "<=1day", "<=1week", "<=1month", "<=6months", ">6months",
  ] satisfies TvraTime[],
  expertise: [
    "layman", "proficient", "expert", "multiple-experts",
  ] satisfies TvraExpertise[],
  knowledge: [
    "public", "restricted", "sensitive", "critical",
  ] satisfies TvraKnowledge[],
  etsi_opportunity: [
    "unlimited", "easy", "moderate", "difficult",
  ] satisfies TvraOpportunity[],
  equipment: [
    "standard", "specialized", "bespoke", "multiple-bespoke",
  ] satisfies TvraEquipment[],
  etsi_intensity: [
    "single", "moderate-multiple", "heavy-multiple",
  ] satisfies TvraIntensity[],
} as const;

export type TvraFactorId = keyof typeof TVRA_FACTOR_LEVELS;