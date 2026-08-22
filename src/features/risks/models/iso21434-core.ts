// ==================== ISO 21434 ATTACK-POTENTIAL CORE ====================
// Pure computation for the ISO/SAE 21434:2021 attack-potential-based attack
// feasibility rating (Annex G.2, Tables G.6 + G.7 — an adaptation of the
// ISO/IEC 18045 / Common Criteria B.4 weighted-summation method).
//
// Score-table family (see regulation-likelihood-cores-design.md §2b): each
// factor has fixed levels with non-linear point values; the values are SUMMED
// to an attack potential, which maps to a 4-level feasibility band. No uniform
// scale, no weight multiplier.
//
// Mirrors en50742-approach-a-core.ts. Pure, no I/O, no framework deps.

// -------------------- Factor levels --------------------

export type Iso21434ElapsedTime =
  | "<=1day"
  | "<=1week"
  | "<=1month"
  | "<=6months"
  | ">6months";

export type Iso21434Expertise =
  | "layman"
  | "proficient"
  | "expert"
  | "multiple-experts";

export type Iso21434Knowledge =
  | "public"
  | "restricted"
  | "confidential"
  | "strictly-confidential";

export type Iso21434WindowOfOpportunity =
  | "unlimited"
  | "easy"
  | "moderate"
  | "difficult";

export type Iso21434Equipment =
  | "standard"
  | "specialized"
  | "bespoke"
  | "multiple-bespoke";

export interface Iso21434Factors {
  elapsedTime: Iso21434ElapsedTime;
  expertise: Iso21434Expertise;
  knowledge: Iso21434Knowledge;
  windowOfOpportunity: Iso21434WindowOfOpportunity;
  equipment: Iso21434Equipment;
}

// -------------------- Point tables (Table G.6, verbatim) --------------------

export const ISO21434_ELAPSED_TIME_POINTS: Record<Iso21434ElapsedTime, number> = {
  "<=1day": 0,
  "<=1week": 1,
  "<=1month": 4,
  "<=6months": 17,
  ">6months": 19,
};

export const ISO21434_EXPERTISE_POINTS: Record<Iso21434Expertise, number> = {
  layman: 0,
  proficient: 3,
  expert: 6,
  "multiple-experts": 8,
};

export const ISO21434_KNOWLEDGE_POINTS: Record<Iso21434Knowledge, number> = {
  public: 0,
  restricted: 3,
  confidential: 7,
  "strictly-confidential": 11,
};

export const ISO21434_WOO_POINTS: Record<Iso21434WindowOfOpportunity, number> = {
  unlimited: 0,
  easy: 1,
  moderate: 4,
  difficult: 10,
};

export const ISO21434_EQUIPMENT_POINTS: Record<Iso21434Equipment, number> = {
  standard: 0,
  specialized: 4,
  bespoke: 7,
  "multiple-bespoke": 9,
};

// -------------------- Attack potential --------------------

/** Attack potential = plain sum of the five factor point values (Table G.6). */
export function iso21434AttackPotential(f: Iso21434Factors): number {
  return (
    ISO21434_ELAPSED_TIME_POINTS[f.elapsedTime] +
    ISO21434_EXPERTISE_POINTS[f.expertise] +
    ISO21434_KNOWLEDGE_POINTS[f.knowledge] +
    ISO21434_WOO_POINTS[f.windowOfOpportunity] +
    ISO21434_EQUIPMENT_POINTS[f.equipment]
  );
}

// -------------------- Attack feasibility (Table G.7) --------------------

export type Iso21434Feasibility = "high" | "medium" | "low" | "very-low";

export interface Iso21434FeasibilityBand {
  min: number;
  max: number; // inclusive; Infinity for the open top band
  feasibility: Iso21434Feasibility;
}

/** Table G.7 — higher attack potential ⇒ lower feasibility. */
export const ISO21434_FEASIBILITY_BANDS: readonly Iso21434FeasibilityBand[] = [
  { min: 0, max: 9, feasibility: "high" },
  { min: 10, max: 13, feasibility: "medium" },
  { min: 14, max: 19, feasibility: "low" },
  { min: 20, max: Infinity, feasibility: "very-low" },
];

export function iso21434Feasibility(attackPotential: number): Iso21434Feasibility {
  const band = ISO21434_FEASIBILITY_BANDS.find(
    (b) => attackPotential >= b.min && attackPotential <= b.max,
  );
  // Bands cover [0, ∞); negative input is out of range.
  if (!band) {
    throw new RangeError(`attackPotential out of range: ${attackPotential}`);
  }
  return band.feasibility;
}

/** Convenience: factors → feasibility in one step. */
export function iso21434RateFeasibility(f: Iso21434Factors): {
  attackPotential: number;
  feasibility: Iso21434Feasibility;
} {
  const attackPotential = iso21434AttackPotential(f);
  return { attackPotential, feasibility: iso21434Feasibility(attackPotential) };
}

// -------------------- Factor-id → level registry --------------------
// Maps the RiskFactorDefinition ids (risk-factor-types ISO21434_FACTORS) to the
// ordered level keys of this core, so a FactorRating.value (1-based index) can
// be resolved to a level. Index i (1-based) → levels[i-1]. Value 0 = not rated.

export const ISO21434_FACTOR_LEVELS = {
  iso_elapsed_time: [
    "<=1day", "<=1week", "<=1month", "<=6months", ">6months",
  ] satisfies Iso21434ElapsedTime[],
  iso_expertise: [
    "layman", "proficient", "expert", "multiple-experts",
  ] satisfies Iso21434Expertise[],
  iso_knowledge: [
    "public", "restricted", "confidential", "strictly-confidential",
  ] satisfies Iso21434Knowledge[],
  iso_window_of_opportunity: [
    "unlimited", "easy", "moderate", "difficult",
  ] satisfies Iso21434WindowOfOpportunity[],
  iso_equipment: [
    "standard", "specialized", "bespoke", "multiple-bespoke",
  ] satisfies Iso21434Equipment[],
} as const;

export type Iso21434FactorId = keyof typeof ISO21434_FACTOR_LEVELS;