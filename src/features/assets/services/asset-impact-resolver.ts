// src/features/assets/services/asset-impact-resolver.ts
//
// PHASE 3 — Where impact lives, and why the category must survive.
//
// TWO PROBLEMS THIS SOLVES
// ------------------------
//
// 1. Impact hangs on the ASSET, so a confidentiality loss and an availability
//    loss on the same config database currently carry the SAME impact. That is
//    coarser than either standard allows:
//
//      ISO 21434 3.1.22 — a damage scenario is the compromise of a *cybersecurity
//        property* (C/I/A) of an asset. Property = security goal. Impact attaches
//        to the damage scenario (3.1.24), not to the asset in the abstract.
//      IEC 62443 — consequence analysis likewise asks what happens when THIS
//        goal falls. An integrity loss on a controller is safety-relevant; a
//        confidentiality loss on the same controller usually is not.
//
//    So (asset × security goal) is where a damage scenario actually lives in
//    TARAflow's model, and that is where the impact belongs.
//
//    This is NOT a method question: it holds identically in ISO and 62443 mode.
//    Only the LIKELIHOOD axis forks (see attacktree-feasibility-types.ts).
//
// 2. `overallImpact: number` collapses 11 criteria into one figure and throws
//    the CATEGORY away. A 4 does not tell you whether that is a fatality or a
//    reputational dent — and ISO 15.8 NOTE 1 explicitly permits a separate risk
//    value per impact category, precisely because a safety auditor needs it.
//
// BACKWARD COMPATIBILITY
// ----------------------
// SecurityGoal.impactRatings is OPTIONAL. When absent, the asset's ratings apply
// — which is exactly today's behaviour. Every existing project keeps working
// untouched; no migration, no schema bump. Analysts opt in per goal where the
// distinction matters.

import type {
  ImpactCalculationMethod,
  ImpactRating,
} from "../models/asset-impact-types";
import { SAFETY_CRITERION_ID } from "../models/asset-impact-types";
import type { SecurityGoal } from "../models/asset-security-goals-types";
import type { Asset } from "../models/asset-types";

// ==================== IMPACT CATEGORIES (ISO 21434 15.5) ====================

/**
 * The four impact categories of ISO 21434 15.5, plus a bucket for TARAflow's
 * additional criteria.
 *
 * 15.5 NOTE 2 explicitly permits additional categories, and NOTE 3 asks that the
 * rationale be shareable across the supply chain — so TARAflow's 11 criteria are
 * a legitimate superset, not a deviation. They are reported under `other` so the
 * four normative categories stay individually visible.
 */
export type ImpactCategory =
  | "safety"
  | "financial"
  | "operational"
  | "privacy"
  | "other";

/** Which of TARAflow's 11 criteria map onto ISO's four categories. */
export const CRITERION_TO_CATEGORY: Record<string, ImpactCategory> = {
  safety: "safety",
  financial_damage: "financial",
  operational: "operational",
  privacy: "privacy",
  // Everything below is TARAflow's own superset (permitted by 15.5 NOTE 2).
  regulatory_compliance: "other",
  reputation: "other",
  affected_users: "other",
  recoverability: "other",
  physical_damage: "other",
  environmental: "other",
  supply_chain: "other",
};

/** Impact broken down by category. `undefined` = nothing rated in that category. */
export type ImpactByCategory = Record<ImpactCategory, number | undefined>;

// ==================== RESOLUTION ====================

export interface ResolvedImpact {
  /** The ratings actually used. */
  ratings: ImpactRating[];
  /** Where they came from — shown in the UI and printed in the report. */
  source: "security-goal" | "asset";
  /** The security goal, when resolution went through one. */
  securityGoalType?: string;
}

/**
 * Resolve the impact ratings for a damage scenario (asset × security goal).
 *
 * Order:
 *   1. securityGoal.impactRatings, if the analyst rated this goal specifically
 *   2. asset.impactRatings          (the default — and today's only behaviour)
 *
 * An EMPTY array on the goal is treated as "not overridden", not as "everything
 * is zero": an analyst who opens the override editor and saves without entering
 * anything must not silently zero out the asset's ratings.
 */
export function resolveImpactRatings(
  asset: Asset,
  securityGoal: SecurityGoal | undefined,
): ResolvedImpact {
  if (securityGoal?.impactRatings && securityGoal.impactRatings.length > 0) {
    return {
      ratings: securityGoal.impactRatings,
      source: "security-goal",
      securityGoalType: securityGoal.type,
    };
  }

  return {
    ratings: asset.impactRatings ?? [],
    source: "asset",
    securityGoalType: securityGoal?.type,
  };
}

// ==================== CATEGORY BREAKDOWN ====================

/**
 * Is this rating an actual number the analyst entered?
 *
 * ImpactRating.value is `number | null | "na"`:
 *   null — not rated yet
 *   "na" — deliberately not applicable
 * Both must be EXCLUDED from aggregation. Coercing them to 0 would drag a
 * conservative MAX down and, worse, make an unrated asset look harmless.
 */
function isRated(rating: ImpactRating): rating is ImpactRating & { value: number } {
  return typeof rating.value === "number";
}

/**
 * Break the ratings down by ISO impact category, taking the MAX within each.
 *
 * MAX within a category, never an average: two moderate financial damages do not
 * average into something milder than either. The category's impact is the worst
 * thing that happens in it.
 */
export function deriveImpactByCategory(
  ratings: ImpactRating[],
): ImpactByCategory {
  const result: ImpactByCategory = {
    safety: undefined,
    financial: undefined,
    operational: undefined,
    privacy: undefined,
    other: undefined,
  };

  for (const rating of ratings) {
    if (!isRated(rating)) continue;

    const category = CRITERION_TO_CATEGORY[rating.criterionId] ?? "other";
    const current = result[category];
    result[category] =
      current === undefined ? rating.value : Math.max(current, rating.value);
  }

  return result;
}

/**
 * The dominant category — the one driving the overall impact.
 *
 * This is what the risk table shows next to the number ("4 ⚠S"), because a bare
 * 4 does not tell an auditor whether it is a fatality or a reputational dent.
 *
 * Safety wins ties. If a fatality and a financial loss both rate 4, the risk is
 * a SAFETY risk — that is the one that determines how the organisation must
 * treat it, and burying it behind an alphabetically-earlier category would be a
 * reporting failure.
 */
const CATEGORY_TIE_ORDER: ImpactCategory[] = [
  "safety",
  "privacy",
  "operational",
  "financial",
  "other",
];

export function findDominantCategory(
  byCategory: ImpactByCategory,
): ImpactCategory | undefined {
  let best: ImpactCategory | undefined;
  let bestValue = -1;

  for (const category of CATEGORY_TIE_ORDER) {
    const value = byCategory[category];
    if (value === undefined) continue;

    if (value > bestValue) {
      best = category;
      bestValue = value;
    }
  }

  return best;
}

// ==================== SAFETY GUARD ====================

/**
 * `average` can bury a fatality.
 *
 * An asset with safety = 4 (fatality) and ten other criteria at 1 averages to
 * roughly 1.3. The fatality vanishes into the mean, and the risk register reports
 * a trivial number for something that kills someone.
 *
 * `conservative` (MAX) keeps the figure — which is why ISO mode forces it. This
 * predicate lets the validator flag the combination explicitly rather than
 * letting a project quietly compute nonsense.
 */
export function averagingWouldBurySafety(
  ratings: ImpactRating[],
  method: ImpactCalculationMethod,
): boolean {
  if (method !== "average") return false;

  const safety = ratings.find((r) => r.criterionId === SAFETY_CRITERION_ID);
  if (!safety || !isRated(safety)) return false;

  // A safety rating at all is enough to make averaging suspect; a severe one
  // makes it indefensible.
  return safety.value >= 3; // irreversible injury or fatality
}

// ==================== EXPORT ====================

export const assetImpactResolver = {
  resolveImpactRatings,
  deriveImpactByCategory,
  findDominantCategory,
  averagingWouldBurySafety,
  CRITERION_TO_CATEGORY,
};
