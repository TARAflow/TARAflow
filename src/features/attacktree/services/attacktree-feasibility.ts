// src/features/attacktree/services/attacktree-feasibility.ts
//
// PHASE 2 — Computing attack feasibility, and turning it into a likelihood.
//
// Pipeline:
//
//   attack-potential factors ──sum──> potential ──band──> FeasibilityLevel
//   (or quick: probability   ──band──────────────────────> FeasibilityLevel)
//                                                              │
//                                     ISO mode ────────────────┤ (unchanged)
//                                     62443 mode ─── + benefit ┤
//                                                              ▼
//                                                         LIKELIHOOD
//                                                              │
//                                              Mapping B ──────┤
//                                                              ▼
//                                                    value on the risk scale
//
// Everything here is pure and synchronous. No config is read from globals —
// callers pass a FeasibilityConfiguration, so the report generator and the app
// provably agree.

import {
  type AttackPotentialFactors,
  type BenefitLevel,
  type FeasibilityConfiguration,
  type FeasibilityLevel,
  FEASIBILITY_LEVELS,
  FEASIBILITY_RANK,
} from "../models/attacktree-feasibility-types";

// ==================== ATTACK POTENTIAL ====================

/**
 * Sum the five factors into an attack potential (ISO 21434 Annex G.2 /
 * ISO/IEC 18045). Higher potential = more effort required = LESS feasible.
 */
export function computeAttackPotential(
  factors: AttackPotentialFactors,
  config: FeasibilityConfiguration,
): number {
  const w = config.weights;
  return (
    w.elapsedTime[factors.elapsedTime] +
    w.specialistExpertise[factors.specialistExpertise] +
    w.knowledgeOfItem[factors.knowledgeOfItem] +
    w.windowOfOpportunity[factors.windowOfOpportunity] +
    w.equipment[factors.equipment]
  );
}

/**
 * Band an attack potential into a feasibility level.
 *
 * Bands are sorted by minPotential ascending; we pick the last band whose
 * threshold the potential reaches. Sorting defensively rather than trusting the
 * config's array order — a mis-ordered config would otherwise silently produce
 * wrong ratings, which is exactly the class of error an auditor catches and we
 * do not.
 */
export function bandAttackPotential(
  potential: number,
  config: FeasibilityConfiguration,
): FeasibilityLevel {
  const sorted = [...config.bands].sort(
    (a, b) => a.minPotential - b.minPotential,
  );

  let level: FeasibilityLevel = sorted[0]?.level ?? "high";
  for (const band of sorted) {
    if (potential >= band.minPotential) {
      level = band.level;
    } else {
      break;
    }
  }
  return level;
}

/** Quick mode: bare probability → level. Coarse by design. */
export function bandProbability(
  probability: number,
  config: FeasibilityConfiguration,
): FeasibilityLevel {
  const sorted = [...config.quickBands].sort(
    (a, b) => a.minProbability - b.minProbability,
  );

  let level: FeasibilityLevel = sorted[0]?.level ?? "very-low";
  for (const band of sorted) {
    if (probability >= band.minProbability) {
      level = band.level;
    } else {
      break;
    }
  }
  return level;
}

// ==================== LIKELIHOOD ====================

/**
 * Fold benefit into feasibility to produce the likelihood.
 *
 * ISO 21434 mode: benefit is IGNORED. Cl. 3.1.29 expresses risk in terms of
 * attack feasibility and impact; the Annex G factors measure effort only. This
 * is not an oversight to be "improved" — motivation is unattributable, and
 * admitting it into the risk number turns into a licence to argue risks away.
 *
 * IEC 62443 / classic mode: benefit shifts the likelihood, consistent with the
 * `motive` factor TARAflow's OWASP factor set already carries.
 *
 * The shift is applied on the ordinal rank and clamped — it can never push a
 * rating outside the four defined levels.
 */
export function computeLikelihood(
  feasibility: FeasibilityLevel,
  benefit: BenefitLevel | undefined,
  config: FeasibilityConfiguration,
): FeasibilityLevel {
  if (config.likelihoodModel === "feasibility-only") {
    return feasibility; // ISO: likelihood IS feasibility.
  }

  if (!benefit) {
    return feasibility; // 62443, but no benefit stated — nothing to fold in.
  }

  const shift = config.benefitShift[benefit] ?? 0;
  const rank = FEASIBILITY_RANK[feasibility] + shift;
  const clamped = Math.max(0, Math.min(FEASIBILITY_LEVELS.length - 1, rank));

  return FEASIBILITY_LEVELS[clamped];
}

// ==================== AGGREGATION ====================

/**
 * Aggregate the feasibility of several attack paths onto their threat scenario.
 *
 * ISO 21434 15.8 NOTE 2 permits aggregation and gives THE MAXIMUM as its
 * example: an attacker takes the easiest route, so the threat scenario is as
 * feasible as its most feasible path. Averaging would let a pile of hard paths
 * mask one trivial one — precisely the error this guards against.
 */
export function aggregateFeasibility(
  levels: FeasibilityLevel[],
): FeasibilityLevel | undefined {
  if (levels.length === 0) return undefined;

  return levels.reduce((best, current) =>
    FEASIBILITY_RANK[current] > FEASIBILITY_RANK[best] ? current : best,
  );
}

/** Same, for likelihoods (identical ordinal scale). */
export const aggregateLikelihood = aggregateFeasibility;

// ==================== MAPPING B ====================

/**
 * Feasibility/likelihood level → a value on the project's risk scale, so it can
 * be combined with impact per 15.8 (matrix H.8 or formula H.10).
 *
 * This is "Mapping B" in the design doc. Mapping A (asset impact → risk scale)
 * already exists as assetImpactMapping. They are two INFLOWS to one formula,
 * not a conversion between each other: impact and feasibility are the two
 * independent axes of the matrix, and collapsing one onto the other would make
 * the matrix meaningless.
 */
export function feasibilityToRiskScale(
  level: FeasibilityLevel,
  config: FeasibilityConfiguration,
): number {
  return config.levelToRiskScale[level];
}

// ==================== COMPARISON HELPERS ====================

export function isMoreFeasible(
  a: FeasibilityLevel,
  b: FeasibilityLevel,
): boolean {
  return FEASIBILITY_RANK[a] > FEASIBILITY_RANK[b];
}

export function meetsThreshold(
  level: FeasibilityLevel,
  threshold: FeasibilityLevel,
): boolean {
  return FEASIBILITY_RANK[level] >= FEASIBILITY_RANK[threshold];
}

// ==================== EXPORT ====================

export const attackTreeFeasibility = {
  computeAttackPotential,
  bandAttackPotential,
  bandProbability,
  computeLikelihood,
  aggregateFeasibility,
  aggregateLikelihood,
  feasibilityToRiskScale,
  isMoreFeasible,
  meetsThreshold,
};
