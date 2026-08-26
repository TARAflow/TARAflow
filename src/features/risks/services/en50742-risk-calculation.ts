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
import type { WindowOfOpportunity, DFDReference } from "shared";
import { calculateRiskValues } from "./risk-calculation-service";
import {
  EN50742_AP_BAND_COUNT,
  en50742LevelFromRating,
  evaluateEN50742Likelihood,
  EN50742_EXPOSURE_LEVELS,
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

// ---------------------------------------------------------------------------
// Exposure-level read-adapter (§11.2, "Variante A" — read, don't recompute)
// ---------------------------------------------------------------------------
// deriveExposureLevels() (dfd-graph-builder.ts) is the SINGLE SOURCE OF TRUTH
// for EL: it already resolves the higher-EL-wins MAX and writes the result
// onto element/connection `properties.exposureLevel` on every saveDFD. This
// adapter only READS that already-derived value for a threat's anchor and
// mirrors it into the exposure_level FactorRating — no MAX logic here (that
// would duplicate dfd-graph-builder.ts and risk drift out of sync with it).
//
// Anchor per threat method (§11.1, mutually exclusive on a Threat):
//   per-element    → threat.linkedElement.elementId → dfd.elements[].id
//   per-interaction→ threat.dataFlow.connectionId   → dfd.connections[].id
//
// Non-destructive, same discipline as applyAssetCriteriaToFactorRatings
// (risk-calculation-service.ts): only fills in when an exposure_level rating
// entry already exists, is currently unrated (value === 0), and was not
// manually overridden. Unlike the asset-impact prefill, an already-derived
// non-zero value is intentionally left alone (no silent refresh) — EL doesn't
// vary across multiple criteria the way impact does, so there's nothing to
// reconcile on re-application, and re-deriving here would risk masking a
// DFD change that should instead flow through the normal sync path.

/**
 * Minimal structural threat shape the adapter needs — mirrors the
 * ThreatForCoverage pattern (shared/utils/mitigation-coverage.ts) rather than
 * depending on the full features/threats Threat type (features/risks must not
 * import features/threats).
 */
export interface ExposureLevelAnchorThreat {
  linkedElement?: { elementId: string } | null;
  dataFlow?: { connectionId?: string } | null;
}

function resolveAnchorProperties(
  threat: ExposureLevelAnchorThreat,
  dfd: DFDReference | null | undefined,
): Record<string, unknown> | undefined {
  const elementId = threat.linkedElement?.elementId;
  if (elementId) {
    return dfd?.elements?.find((e) => e.id === elementId)?.properties;
  }
  const connectionId = threat.dataFlow?.connectionId;
  if (connectionId) {
    return dfd?.connections?.find((c) => c.id === connectionId)?.properties;
  }
  return undefined;
}

/**
 * Reads the anchor's already-derived exposureLevel and writes it as a derived
 * exposure_level FactorRating. No-op (returns `ratings` unchanged) when: no
 * exposure_level entry exists yet, it's already rated (value !== 0), it was
 * manually overridden, no anchor can be resolved, or the anchor carries no
 * (valid) exposureLevel.
 */
export function applyExposureLevelToFactorRatings(
  ratings: FactorRating[],
  threat: ExposureLevelAnchorThreat,
  dfd: DFDReference | null | undefined,
): FactorRating[] {
  const idx = ratings.findIndex((r) => r.factorId === EN50742_EL_FACTOR);
  if (idx === -1) return ratings;

  const rating = ratings[idx];
  if (rating.value !== 0 || rating.source === "manual") return ratings;

  const rawEL = resolveAnchorProperties(threat, dfd)?.exposureLevel;
  const el =
    typeof rawEL === "string" &&
    (EN50742_EXPOSURE_LEVELS as readonly string[]).includes(rawEL)
      ? (rawEL as ExposureLevel)
      : undefined;
  if (!el) return ratings;

  const value = EN50742_EXPOSURE_LEVELS.indexOf(el) + 1;
  const next = [...ratings];
  next[idx] = { ...rating, value, derivedValue: value, source: "derived" };
  return next;
}