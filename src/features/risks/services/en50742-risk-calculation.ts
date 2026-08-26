// ==================== EN 50742 APPROACH A — RISK CALCULATION ====================
// Dedicated calc for the en-50742-a preset (design §2.3). NOT a branch inside
// the generic calculateRiskValues and NOT a score-table sum (WoO is a
// multiplier, and this emits an extra output — SRSL).
//
//   likelihood : AP = (EL × WoO) + AC → band → NATURAL-polarity ordinal →
//                project likelihood scale.       (secondary R=I×L lens)
//   srsl       : Table B.6 (band × severity).    (PRIMARY, authoritative)
//
// EL is a DERIVED rating (§3.2); AC is rated in the Risk dialog; WoO is
// project-global (§3.3, passed in); severity from the linked safety-function
// asset (§3.6, passed in).
//
// IMPACT PARITY: EN 50742 changes only likelihood + SRSL. Impact is delegated to
// the generic calculateRiskValues, so it is bit-identical across methods
// (asset-impact, weighted mean, custom factors — whatever the config dictates).
// We never recompute impact here.

import type { FactorRating } from "../models/risk-factor-types";
import type { RiskConfiguration } from "../models/risk-config-types";
import { LIKELIHOOD_SCALES } from "../models/risk-scale-types";
import { normaliseImpactValue } from "shared";
import type { WindowOfOpportunity } from "shared";
import { calculateRiskValues } from "./risk-calculation-service";
import {
  EN50742_AP_BAND_COUNT,
  en50742LevelFromRating,
  evaluateEN50742Likelihood,
  type AttackPotentialBand,
  type AttackerCapability,
  type ExposureLevel,
  type Severity,
  type Srsl,
} from "../models/en50742-approach-a-core";

export const EN50742_EL_FACTOR = "exposure_level";
export const EN50742_AC_FACTOR = "attacker_capability";

export interface EN50742CalculationResult {
  impact: number;
  likelihood: number;
  risk: number;
  /**
   * Authoritative Approach-A output (Table B.6). `null` when the method is not
   * fully rated — deliberately NOT SRSL0, so "unrated" is never mistaken for the
   * genuinely-isolated SRSL0 case (§3.9).
   */
  srsl: Srsl | null;
  apScore: number | null;
  apBand: AttackPotentialBand | null;
}

type NormaliseFn = (value: number, sourceLevels: number, targetLevels: number) => number;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Pure EN 50742 risk computation over already-resolved inputs. Depends only on
 * the core plus an injected `normalise` — no app wiring, fully unit-testable.
 */
export function en50742RiskFromResolved(
  impact: number,
  el: ExposureLevel | undefined,
  ac: AttackerCapability | undefined,
  windowOfOpportunity: WindowOfOpportunity,
  severity: Severity,
  scaleLevels: number,
  normalise: NormaliseFn,
): EN50742CalculationResult {
  if (!el || !ac) {
    return {
      impact: round1(impact),
      likelihood: 0,
      risk: 0,
      srsl: null,
      apScore: null,
      apBand: null,
    };
  }

  const evaluated = evaluateEN50742Likelihood(
    { exposureLevel: el, windowOfOpportunity, attackerCapability: ac },
    severity,
  );
  const likelihood = normalise(
    evaluated.likelihoodOrdinal,
    EN50742_AP_BAND_COUNT,
    scaleLevels,
  );
  const risk = impact > 0 && likelihood > 0 ? impact * likelihood : 0;

  return {
    impact: round1(impact),
    likelihood: round1(likelihood),
    risk: round1(risk),
    srsl: evaluated.srsl,
    apScore: evaluated.attackPotential.score,
    apBand: evaluated.attackPotential.band,
  };
}

/**
 * Wiring: impact via the generic path (parity), EL (derived) + AC (rated) from
 * `ratings`, WoO/severity from the caller.
 */
export function calculateEN50742RiskValues(
  ratings: FactorRating[],
  configuration: RiskConfiguration,
  windowOfOpportunity: WindowOfOpportunity,
  severity: Severity,
): EN50742CalculationResult {
  const scaleLevels = LIKELIHOOD_SCALES[configuration.scale].levels.length;

  // Impact delegated to the generic calc (identical across methods). Its
  // weighted-mean likelihood is deliberately ignored — we derive likelihood
  // from the AP band instead.
  const impact = calculateRiskValues(ratings, configuration).impact;

  const elValue =
    ratings.find((r) => r.factorId === EN50742_EL_FACTOR)?.value ?? 0;
  const acValue =
    ratings.find((r) => r.factorId === EN50742_AC_FACTOR)?.value ?? 0;
  const el = en50742LevelFromRating(EN50742_EL_FACTOR, elValue) as
    | ExposureLevel
    | undefined;
  const ac = en50742LevelFromRating(EN50742_AC_FACTOR, acValue) as
    | AttackerCapability
    | undefined;

  return en50742RiskFromResolved(
    impact,
    el,
    ac,
    windowOfOpportunity,
    severity,
    scaleLevels,
    normaliseImpactValue,
  );
}