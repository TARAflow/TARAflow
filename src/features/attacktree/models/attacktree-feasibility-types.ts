// src/features/attacktree/models/attacktree-feasibility-types.ts
//
// PHASE 2 — Attack feasibility, and the one place the two rating methods fork.
//
// ISO/SAE 21434 (3.1.29) expresses risk in terms of attack feasibility and
// impact. Nothing else. The five attack-potential factors of Annex G.2 (taken
// from ISO/IEC 18045) are purely EFFORT measures: elapsed time, expertise,
// knowledge, window of opportunity, equipment. Not one of them asks whether the
// attack is worth doing.
//
// That is deliberate. Attacker motivation is not attributable — you cannot know
// whether your device becomes interesting to a script kiddie, a competitor or a
// state actor next year. Building motivation into the risk bakes in an
// unprovable assumption that, in practice, becomes a licence to argue a risk
// away ("nobody would bother"). ISO forecloses that.
//
// IEC 62443 and classic attack trees (Schneier) take the opposite view and rate
// threat actors by skill + MOTIVATION + resources. TARAflow's own OWASP factor
// set already carries `motive`.
//
// Both are defensible. They are not interchangeable. So the model is explicit
// about which one a project uses, and the report must state it: a 62443-mode
// TARA presented as ISO-conformant is an audit finding waiting to happen.

// ==================== LIKELIHOOD MODEL ====================

/**
 * How the likelihood axis of the risk matrix is computed.
 *
 * "feasibility-only"          ISO 21434. Likelihood == attack feasibility.
 *                             Benefit is parsed and used for analysis, but
 *                             NEVER enters the risk number (Cl. 3.1.29).
 *
 * "feasibility-x-motivation"  IEC 62443 / classic attack trees. Benefit is part
 *                             of the likelihood, consistent with the `motive`
 *                             factor TARAflow's STRIDE path already uses.
 *
 * Project-wide, bound to the ISO chip in the Overview tab.
 */
export type LikelihoodModel = "feasibility-only" | "feasibility-x-motivation";

export const DEFAULT_LIKELIHOOD_MODEL: LikelihoodModel = "feasibility-only";

// ==================== FEASIBILITY LEVEL ====================

/**
 * The four attack feasibility ratings of ISO 21434 Cl. 15.7 (Table 1).
 * Ordered from hardest to easiest — `high` means the attack takes LOW effort.
 */
export type FeasibilityLevel = "very-low" | "low" | "medium" | "high";

export const FEASIBILITY_LEVELS: FeasibilityLevel[] = [
  "very-low",
  "low",
  "medium",
  "high",
];

/** Ordinal rank, for comparison and max-aggregation. Higher == more feasible. */
export const FEASIBILITY_RANK: Record<FeasibilityLevel, number> = {
  "very-low": 0,
  low: 1,
  medium: 2,
  high: 3,
};

export const FEASIBILITY_DISPLAY: Record<
  FeasibilityLevel,
  { label: string; labelDE: string; color: string }
> = {
  "very-low": { label: "Very Low", labelDE: "Sehr tief", color: "#22c55e" },
  low: { label: "Low", labelDE: "Tief", color: "#84cc16" },
  medium: { label: "Medium", labelDE: "Mittel", color: "#f59e0b" },
  high: { label: "High", labelDE: "Hoch", color: "#ef4444" },
};

// ==================== FEASIBILITY METHOD ====================

/**
 * ISO 21434 [RC-15-11] permits three approaches. Annex G details all three.
 * "quick" is TARAflow's own drafting mode — a bare probability. It is NOT one
 * of the three, and a TARA rated in quick mode is not audit-grade. The report
 * says so rather than letting a reader assume otherwise.
 */
export type FeasibilityMethod =
  | "quick"
  | "attack-potential"
  | "cvss"
  | "attack-vector";

export const DEFAULT_FEASIBILITY_METHOD: FeasibilityMethod = "attack-potential";

/** Only attack-potential is fully implemented; the others are declared, not built. */
export const IMPLEMENTED_FEASIBILITY_METHODS: FeasibilityMethod[] = [
  "quick",
  "attack-potential",
];

// ==================== ATTACK POTENTIAL (ISO/IEC 18045) ====================

/**
 * The five core factors of ISO 21434 Annex G.2 / ISO/IEC 18045.
 *
 * The enumerated levels below are the scale labels. The NUMERIC WEIGHTS live in
 * AttackPotentialWeights (below) and are organisation-specific: Annex G presents
 * them as an example, and NOTE 3 of 15.5 requires the rationale to be shareable
 * across the supply chain. So they are configuration, not constants, and the
 * report prints them.
 */

/** Time to identify the vulnerability, develop and successfully apply an exploit. */
export type ElapsedTime =
  | "le-1-day"
  | "le-1-week"
  | "le-1-month"
  | "le-6-months"
  | "gt-6-months";

/** Attacker capability, relative to skill and experience. */
export type SpecialistExpertise =
  | "layman"
  | "proficient"
  | "expert"
  | "multiple-experts";

/** How much information about the item the attacker has acquired. */
export type KnowledgeOfItem =
  | "public"
  | "restricted"
  | "confidential"
  | "strictly-confidential";

/** Access conditions: type and duration of access needed to carry the attack out. */
export type WindowOfOpportunity =
  | "unlimited"
  | "easy"
  | "moderate"
  | "difficult";

/** Tools the attacker needs to find the vulnerability and/or run the attack. */
export type Equipment =
  | "standard"
  | "specialized"
  | "bespoke"
  | "multiple-bespoke";

export interface AttackPotentialFactors {
  elapsedTime: ElapsedTime;
  specialistExpertise: SpecialistExpertise;
  knowledgeOfItem: KnowledgeOfItem;
  windowOfOpportunity: WindowOfOpportunity;
  equipment: Equipment;
}

/** DSL keys → factor. Kept short because they are typed by hand in the editor. */
export const ATTACK_POTENTIAL_DSL_KEYS = {
  et: "elapsedTime",
  se: "specialistExpertise",
  kn: "knowledgeOfItem",
  wo: "windowOfOpportunity",
  eq: "equipment",
} as const;

/** DSL value aliases → canonical level. Accepts the shorthand an analyst types. */
export const ELAPSED_TIME_ALIASES: Record<string, ElapsedTime> = {
  "1d": "le-1-day",
  day: "le-1-day",
  "1w": "le-1-week",
  week: "le-1-week",
  "1m": "le-1-month",
  month: "le-1-month",
  "6m": "le-6-months",
  "6months": "le-6-months",
  ">6m": "gt-6-months",
  gt6m: "gt-6-months",
};

export const EXPERTISE_ALIASES: Record<string, SpecialistExpertise> = {
  layman: "layman",
  proficient: "proficient",
  expert: "expert",
  experts: "multiple-experts",
  "multiple-experts": "multiple-experts",
};

export const KNOWLEDGE_ALIASES: Record<string, KnowledgeOfItem> = {
  public: "public",
  restricted: "restricted",
  confidential: "confidential",
  strict: "strictly-confidential",
  "strictly-confidential": "strictly-confidential",
};

export const WINDOW_ALIASES: Record<string, WindowOfOpportunity> = {
  unlimited: "unlimited",
  easy: "easy",
  moderate: "moderate",
  difficult: "difficult",
};

export const EQUIPMENT_ALIASES: Record<string, Equipment> = {
  standard: "standard",
  specialized: "specialized",
  specialised: "specialized",
  bespoke: "bespoke",
  "multiple-bespoke": "multiple-bespoke",
};

// ==================== WEIGHTS + BANDS (CONFIGURABLE) ====================

/**
 * Numeric weight per factor level. Summed to an attack potential; the sum is
 * then banded into a FeasibilityLevel.
 *
 * ⚠️  CALIBRATE THESE AGAINST YOUR LICENSED COPY OF ISO/SAE 21434 ANNEX G.
 *
 * The values below are structurally correct (monotonic: more effort ⇒ higher
 * value ⇒ lower feasibility) and usable, but they are NOT the standard's table
 * and are not claimed to be. Annex G Table G.6 gives an example weighting; 15.5
 * NOTE 2/3 make clear the organisation chooses and must be able to justify it.
 * Whatever you settle on is printed in the report's methodology section.
 */
export interface AttackPotentialWeights {
  elapsedTime: Record<ElapsedTime, number>;
  specialistExpertise: Record<SpecialistExpertise, number>;
  knowledgeOfItem: Record<KnowledgeOfItem, number>;
  windowOfOpportunity: Record<WindowOfOpportunity, number>;
  equipment: Record<Equipment, number>;
}

export const DEFAULT_ATTACK_POTENTIAL_WEIGHTS: AttackPotentialWeights = {
  // TODO: calibrate against Annex G Table G.6 of the licensed standard.
  elapsedTime: {
    "le-1-day": 0,
    "le-1-week": 1,
    "le-1-month": 4,
    "le-6-months": 17,
    "gt-6-months": 19,
  },
  specialistExpertise: {
    layman: 0,
    proficient: 3,
    expert: 6,
    "multiple-experts": 8,
  },
  knowledgeOfItem: {
    public: 0,
    restricted: 3,
    confidential: 7,
    "strictly-confidential": 11,
  },
  windowOfOpportunity: {
    unlimited: 0,
    easy: 1,
    moderate: 4,
    difficult: 10,
  },
  equipment: {
    standard: 0,
    specialized: 4,
    bespoke: 7,
    "multiple-bespoke": 9,
  },
};

/**
 * Band boundaries: attack potential sum → feasibility level.
 * `minPotential` is inclusive; bands must be contiguous and cover 0..∞.
 * Higher potential (more effort) ⇒ LOWER feasibility.
 *
 * ⚠️  CALIBRATE AGAINST ANNEX G TABLE G.7. Printed in the report.
 */
export interface FeasibilityBand {
  level: FeasibilityLevel;
  minPotential: number;
}

export const DEFAULT_FEASIBILITY_BANDS: FeasibilityBand[] = [
  // TODO: calibrate against Annex G Table G.7 of the licensed standard.
  { level: "high", minPotential: 0 },
  { level: "medium", minPotential: 14 },
  { level: "low", minPotential: 20 },
  { level: "very-low", minPotential: 25 },
];

/**
 * Quick mode: bare probability (0..1) → feasibility level.
 * Coarse by construction — that is the point. Quick mode is for drafting.
 */
export interface QuickFeasibilityBand {
  level: FeasibilityLevel;
  minProbability: number;
}

export const DEFAULT_QUICK_BANDS: QuickFeasibilityBand[] = [
  { level: "very-low", minProbability: 0 },
  { level: "low", minProbability: 0.25 },
  { level: "medium", minProbability: 0.5 },
  { level: "high", minProbability: 0.75 },
];

// ==================== BENEFIT (62443 MODE ONLY) ====================

/**
 * Attacker benefit / motivation.
 *
 * ISO mode: parsed, shown, used for path plausibility, ordering and emission
 *           policy — but NEVER folded into the likelihood (Cl. 3.1.29).
 * 62443 mode: raises or lowers the likelihood, like OWASP's `motive`.
 */
export type BenefitLevel = "negligible" | "low" | "medium" | "high";

export const BENEFIT_ALIASES: Record<string, BenefitLevel> = {
  none: "negligible",
  negligible: "negligible",
  low: "low",
  medium: "medium",
  high: "high",
};

/**
 * How benefit shifts feasibility to produce likelihood, in 62443 mode.
 * Expressed as a shift in FEASIBILITY_RANK steps, then clamped.
 *
 * Rationale for the shape: a trivially easy attack that profits nobody is not a
 * realistic scenario (shift down), while a lucrative one attracts attackers who
 * will invest more effort than the bare technical rating suggests (shift up).
 */
export const DEFAULT_BENEFIT_SHIFT: Record<BenefitLevel, number> = {
  negligible: -2,
  low: -1,
  medium: 0,
  high: +1,
};

// ==================== CONFIGURATION ====================

export interface FeasibilityConfiguration {
  likelihoodModel: LikelihoodModel;
  method: FeasibilityMethod;
  weights: AttackPotentialWeights;
  bands: FeasibilityBand[];
  quickBands: QuickFeasibilityBand[];
  benefitShift: Record<BenefitLevel, number>;
  /**
   * Mapping B: feasibility level → a value on the project's risk scale
   * (3/4/5-level), so it can be combined with impact per 15.8.
   * Populated per RiskScaleType, mirroring DEFAULT_ASSET_IMPACT_MAPPINGS.
   */
  levelToRiskScale: Record<FeasibilityLevel, number>;
}

export const DEFAULT_FEASIBILITY_CONFIGURATION: FeasibilityConfiguration = {
  likelihoodModel: DEFAULT_LIKELIHOOD_MODEL,
  method: DEFAULT_FEASIBILITY_METHOD,
  weights: DEFAULT_ATTACK_POTENTIAL_WEIGHTS,
  bands: DEFAULT_FEASIBILITY_BANDS,
  quickBands: DEFAULT_QUICK_BANDS,
  benefitShift: DEFAULT_BENEFIT_SHIFT,
  // 5-level default; the config dialog swaps this per RiskScaleType.
  levelToRiskScale: {
    "very-low": 1,
    low: 2,
    medium: 3,
    high: 5,
  },
};
