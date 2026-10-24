// ==================== ISO/SAE 21434 RISK VALUE (15.8) ====================
// Conformance plan 3a (decisions 20 and 22). The risk value of a threat
// scenario is a value 1–5 (RQ-15-16) determined from the impact of its damage
// scenario and the attack feasibility of its attack paths (RQ-15-15). Method
// [K]: the risk matrix of Annex H, Table H.8 (informative example, labelled so
// in the methodology chapter; editable from 3b on). Inputs are LEVELS, never
// the numbers of `I × L`.
//
// Pure; no feature imports apart from this feature's ISO core.

import type { FeasibilityBandLevel, SafetyImpact } from "shared";
import { feasibilityLevelToRiskScale, type RiskScaleLevels } from "shared";
import {
  ISO21434_FACTOR_LEVELS,
  iso21434RateFeasibility,
  type Iso21434Factors,
} from "./iso21434-core";

// ==================== LEVELS ====================

/** Impact rating per category, RQ-15-05 — ascending. */
export const ISO_IMPACT_LEVELS = ["negligible", "moderate", "major", "severe"] as const;
export type IsoImpactLevel = (typeof ISO_IMPACT_LEVELS)[number];

/** Attack feasibility, RQ-15-10 — ascending. */
export const ISO_FEASIBILITY_LEVELS: readonly FeasibilityBandLevel[] = [
  "very-low",
  "low",
  "medium",
  "high",
];

const IMPACT_RANK: Record<IsoImpactLevel, number> = {
  negligible: 0,
  moderate: 1,
  major: 2,
  severe: 3,
};
const FEASIBILITY_RANK: Record<FeasibilityBandLevel, number> = {
  "very-low": 0,
  low: 1,
  medium: 2,
  high: 3,
};

export const higherImpact = (a: IsoImpactLevel | undefined, b: IsoImpactLevel | undefined) =>
  a === undefined ? b : b === undefined ? a : IMPACT_RANK[b] > IMPACT_RANK[a] ? b : a;

export const higherFeasibility = (
  a: FeasibilityBandLevel | undefined,
  b: FeasibilityBandLevel | undefined,
) => (a === undefined ? b : b === undefined ? a : FEASIBILITY_RANK[b] > FEASIBILITY_RANK[a] ? b : a);

// ==================== MATRIX H.8 ====================

/**
 * ISO/SAE 21434:2021 Annex H, Table H.8 "Risk matrix example" — checked
 * against the standard (2026-10-24). Rows: impact; columns: feasibility.
 * Not the formula of H.10, which differs in single cells.
 */
export const ISO_RISK_MATRIX_H8: Readonly<
  Record<IsoImpactLevel, Readonly<Record<FeasibilityBandLevel, number>>>
> = {
  severe: { "very-low": 2, low: 3, medium: 4, high: 5 },
  major: { "very-low": 1, low: 2, medium: 3, high: 4 },
  moderate: { "very-low": 1, low: 2, medium: 2, high: 3 },
  negligible: { "very-low": 1, low: 1, medium: 1, high: 1 },
};

/** Risk value 1–5 (RQ-15-16) of an impact level and a feasibility level. */
export function isoRiskValue(
  impact: IsoImpactLevel,
  feasibility: FeasibilityBandLevel,
): number {
  return ISO_RISK_MATRIX_H8[impact][feasibility];
}

/** What a risk carries: the inputs, so dialog and report can explain the value. */
export interface IsoRisk {
  impact: IsoImpactLevel;
  feasibility: FeasibilityBandLevel;
  value: number;
  /** After mitigation; absent when nothing is rated after mitigation. */
  residual?: { feasibility: FeasibilityBandLevel; value: number };
}

// ==================== IMPACT LEVELS ====================

/**
 * Non-safety categories under ISO: the 4-level asset scale is the RQ-15-05
 * scale, 1 = negligible … 4 = severe. 0 / null / "na" = not rated.
 */
export function isoImpactFromRating(value: unknown): IsoImpactLevel | undefined {
  if (typeof value !== "number" || value <= 0) return undefined;
  return ISO_IMPACT_LEVELS[Math.min(Math.round(value), 4) - 1];
}

/**
 * Safety from the categorical person-harm severity (Table F.1):
 * none → negligible (S0), reversible_* → moderate (S1),
 * irreversible_* → major (S2), fatal → severe (S3). Canonical names only —
 * migration 9 → 10 normalises old names.
 */
export const ISO_SAFETY_LEVEL_F1: Readonly<Record<SafetyImpact, IsoImpactLevel>> = {
  none: "negligible",
  reversible_minor: "moderate",
  reversible_major: "moderate",
  irreversible_minor: "major",
  irreversible_major: "major",
  fatal: "severe",
};

/**
 * Safety from the numeric rating — the Se factor (safetySeverityToFactor),
 * NOT the 1 = negligible scale of the other categories: 1, 2 (reversible) →
 * moderate, 3 (irreversible minor) → major, 4 → severe. 4 stands for
 * irreversible_major OR fatal, so it is read conservatively and `ambiguous`
 * asks for a categorical rating. 0 / null / "na" = not rated.
 */
export function isoSafetyFromRating(
  value: unknown,
): { level: IsoImpactLevel; ambiguous: boolean } | undefined {
  if (typeof value !== "number" || value <= 0) return undefined;
  if (value >= 4) return { level: "severe", ambiguous: true };
  if (value >= 3) return { level: "major", ambiguous: false };
  return { level: "moderate", ambiguous: false };
}

// ==================== FEASIBILITY FROM RATINGS ====================

/**
 * Attack feasibility from the five Annex G.2 factors on a risk (the `iso_*`
 * fallback when no tree drives the risk). All five must be rated.
 */
export function isoFeasibilityFromFactors(
  ratings: readonly { factorId: string; value: number }[] | undefined,
): { attackPotential: number; feasibility: FeasibilityBandLevel } | null {
  const levelFor = <K extends keyof typeof ISO21434_FACTOR_LEVELS>(id: K) => {
    const r = ratings?.find((f) => f.factorId === id);
    if (!r || !(r.value > 0)) return undefined;
    return ISO21434_FACTOR_LEVELS[id][r.value - 1] as
      | (typeof ISO21434_FACTOR_LEVELS)[K][number]
      | undefined;
  };
  const factors = {
    elapsedTime: levelFor("iso_elapsed_time"),
    expertise: levelFor("iso_expertise"),
    knowledge: levelFor("iso_knowledge"),
    windowOfOpportunity: levelFor("iso_window_of_opportunity"),
    equipment: levelFor("iso_equipment"),
  };
  if (Object.values(factors).some((v) => v === undefined)) return null;
  return iso21434RateFeasibility(factors as Iso21434Factors);
}

/**
 * A tree likelihood on the risk scale back to a feasibility level, through
 * the runtime Mapping B (decision 21; never the stored snapshot). Where two
 * levels share a value (3-level scale: very low and low = 1) the higher level
 * wins — conservative.
 */
export function feasibilityFromRiskScaleValue(
  value: number | undefined,
  scale: RiskScaleLevels | undefined,
): FeasibilityBandLevel | undefined {
  if (!value || value <= 0) return undefined;
  const map = feasibilityLevelToRiskScale(scale);
  let found: FeasibilityBandLevel | undefined;
  for (const level of ISO_FEASIBILITY_LEVELS) {
    if (map[level] === value) found = level; // ascending → last match is highest
  }
  return found;
}
