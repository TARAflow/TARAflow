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
import type { WindowOfOpportunity, DFDReference, AssetReference } from "shared";
import {
  calculateRiskValues,
  worstPhysicalImpact,
} from "./risk-calculation-service";
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
 *
 * `severity` is optional (§11.2 gate): a risk can have EL+AC fully rated
 * without a linked safety-function asset carrying a resolvable severity. AP/
 * likelihood are still computed for the R×L lens; `srsl` is `null` in that
 * case (evaluateEN50742Likelihood's convention, not the "el/ac unrated" null
 * below — see EN50742CalculationResult.srsl doc).
 */
export function en50742RiskFromResolved(
  impact: number,
  el: ExposureLevel | undefined,
  ac: AttackerCapability | undefined,
  windowOfOpportunity: WindowOfOpportunity,
  severity: Severity | undefined,
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
 * `ratings`, WoO/severity from the caller. `severity` is optional — see
 * resolveEN50742Severity() below for the standard resolution from linked assets.
 */
export function calculateEN50742RiskValues(
  ratings: FactorRating[],
  configuration: RiskConfiguration,
  windowOfOpportunity: WindowOfOpportunity,
  severity: Severity | undefined,
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
// (risk-calculation-service.ts): only ever touches an exposure_level rating
// that was NOT manually overridden (source !== "manual"). A manual override
// always wins, permanently, until the analyst clears it.
//
// Unlike an earlier version of this adapter, a derived value is NOT frozen
// after the first successful derivation — every re-application (dialog init,
// threat sync) re-reads the DFD anchor and keeps the rating in sync with it,
// exactly like the asset-impact prefill keeps impact factors in sync with
// Asset Tab data. If the DFD's EL for this anchor changes (e.g. EL1 → EL3),
// the rating follows. If the DFD no longer provides a valid EL for this
// anchor at all (element deleted, property removed, ...), the rating resets
// to unrated (0) rather than keeping a stale value — again mirroring
// applyAssetCriteriaToFactorRatings' behaviour when asset data disappears.

/**
 * Minimal structural threat shape the adapter needs — mirrors the
 * ThreatForCoverage pattern (shared/utils/mitigation-coverage.ts) rather than
 * depending on the full features/threats Threat type (features/risks must not
 * import features/threats).
 */
export interface ExposureLevelAnchorThreat {
  linkedElement?: { elementId: string; elementType?: string } | null;
  dataFlow?: { connectionId?: string } | null;
}

function resolveAnchorProperties(
  threat: ExposureLevelAnchorThreat,
  dfd: DFDReference | null | undefined,
): Record<string, unknown> | undefined {
  const linked = threat.linkedElement;
  if (linked?.elementId) {
    // A per-element STRIDE threat can be anchored to a DataFlow
    // (STRIDE_PER_ELEMENT_TYPE.DataFlow = T,I,D). In that case linkedElement
    // is the DataFlow itself and elementId is a CONNECTION id, which lives in
    // dfd.connections, not dfd.elements. Interfaces (and every other element
    // anchor) live in dfd.elements. draw.io cell ids are unique across the
    // whole graph, so the elementType check is the primary signal and the
    // cross-collection fallback is safe for older data lacking elementType.
    if (linked.elementType === "DataFlow") {
      return dfd?.connections?.find((c) => c.id === linked.elementId)
        ?.properties;
    }
    return (
      dfd?.elements?.find((e) => e.id === linked.elementId)?.properties ??
      dfd?.connections?.find((c) => c.id === linked.elementId)?.properties
    );
  }
  const connectionId = threat.dataFlow?.connectionId;
  if (connectionId) {
    return dfd?.connections?.find((c) => c.id === connectionId)?.properties;
  }
  return undefined;
}

/**
 * Reads the anchor's current exposureLevel from the DFD and keeps the
 * exposure_level FactorRating in sync with it — re-applied on every dialog
 * init / threat sync, not just once. No-op (returns `ratings` unchanged)
 * when: no exposure_level entry exists, or it was manually overridden
 * (source === "manual" always wins). When the anchor no longer resolves to a
 * valid EL, the rating resets to unrated (0) rather than keeping a stale
 * value.
 */
export function applyExposureLevelToFactorRatings(
  ratings: FactorRating[],
  threat: ExposureLevelAnchorThreat,
  dfd: DFDReference | null | undefined,
): FactorRating[] {
  const idx = ratings.findIndex((r) => r.factorId === EN50742_EL_FACTOR);
  if (idx === -1) return ratings;

  const rating = ratings[idx];
  // A manual EL of exactly 0 can no longer be freshly created (updateFactor
  // in risk-dialog.tsx now clears `source` entirely when the analyst picks
  // "Not rated" for EL specifically) — any {value: 0, source: "manual"}
  // still around is leftover corruption from before that fix, not a
  // deliberate "the value is zero forever" choice (that assertion is
  // meaningless for EL anyway: 0 already means unrated). Self-heals old
  // data without a migration step. A manual NONZERO value still wins,
  // permanently, exactly as before.
  if (rating.source === "manual" && rating.value !== 0) return ratings;

  const rawEL = resolveAnchorProperties(threat, dfd)?.exposureLevel;
  const el =
    typeof rawEL === "string" &&
    (EN50742_EXPOSURE_LEVELS as readonly string[]).includes(rawEL)
      ? (rawEL as ExposureLevel)
      : undefined;

  if (!el) {
    // DFD no longer provides a valid EL for this anchor — reset to unrated
    // rather than leaving a stale derived value in place.
    if (rating.value === 0 && rating.derivedValue === undefined) {
      return ratings; // already unrated — no-op, avoid needless churn
    }
    const next = [...ratings];
    next[idx] = {
      ...rating,
      value: 0,
      derivedValue: undefined,
      source: undefined,
    };
    return next;
  }

  const value = EN50742_EXPOSURE_LEVELS.indexOf(el) + 1;
  if (rating.value === value && rating.source === "derived") {
    return ratings; // already in sync — no-op, avoid needless churn
  }
  const next = [...ratings];
  next[idx] = { ...rating, value, derivedValue: value, source: "derived" };
  return next;
}

// ---------------------------------------------------------------------------
// Severity resolver (§3.6/§3.7) — worst-case physicalImpact over linked assets
// ---------------------------------------------------------------------------
// Severity is NOT a new concept: asset.physicalImpact is already the
// hazard-chain-resolved severity for that asset (resolveAssetPhysicalImpact,
// app/utils/resolve-asset-physical-impact.ts — manual override, else worst
// HazardItem.endangers severity, else legacy annotation). The existing
// "Safety Impact" business factor already takes the worst physicalImpact
// across a risk's linkedAssets (deriveSafetyValue, risk-calculation-service.ts);
// EN 50742 severity reuses the SAME worst-case selection via the shared
// worstPhysicalImpact() helper — just mapped onto the 3-level EN 50742
// vocabulary instead of the 4-level business-impact scale.
//
// §3.7 (SRSL per safety-function × interface) falls out of this for free: a
// Risk is already anchored to exactly one EL-bearing interface/DataFlow via
// its threat (§11.1), so different interfaces naturally produce different
// Risks with independently-resolved severities. The one gap vs. a fully
// norm-literal reading: if a single Risk has linkedAssets belonging to
// multiple DIFFERENT safety functions with different severities, worst-case
// collapses them into one severity rather than two separate SRSL
// determinations. Accepted simplification — no explicit "this asset IS the
// safety function relevant to this interface" relation exists in the asset
// model today (would require new asset-relation modeling, out of scope here).

const PHYSICAL_IMPACT_TO_SEVERITY: Record<
  "reversible_injury" | "irreversible_injury" | "fatality",
  Severity
> = {
  reversible_injury: "reversible",
  irreversible_injury: "non_reversible",
  fatality: "fatal",
};

/**
 * Resolves EN 50742 severity from a risk's linked assets: worst-case
 * physicalImpact (already hazard-chain-resolved on the asset, see module
 * comment above), mapped onto the 3-level EN 50742 vocabulary. `undefined`
 * when no linked asset carries a physicalImpact — the caller (§11.2 gate)
 * still computes AP/likelihood for the R×L lens; only SRSL is affected
 * (evaluateEN50742Likelihood returns srsl: null in that case).
 */
export function resolveEN50742Severity(
  linkedAssets: AssetReference[],
): Severity | undefined {
  const worst = worstPhysicalImpact(linkedAssets);
  return worst ? PHYSICAL_IMPACT_TO_SEVERITY[worst] : undefined;
}

// ---------------------------------------------------------------------------
// Per-risk gate (§11.2) — EN 50742 AP/SRSL vs. generic R = I × L
// ---------------------------------------------------------------------------
// The choice is made PER RISK, not project-wide. Gate: does this risk's
// anchor carry an EL? Reduces to a rating check, not a DFD/threat lookup —
// applyExposureLevelToFactorRatings() (§11.2 Variante A) has already written
// the resolved EL into `ratings` by the time this runs (both call sites
// apply it before computing risk values), so this function only ever reads
// `ratings`, never `dfd`/`threat` itself.
//
//   method !== "en-50742-a"            → generic path, srsl/apScore/apBand
//                                         simply absent (not an EN 50742
//                                         project at all).
//   method === "en-50742-a":
//     exposure_level unrated (value 0)
//     OR windowOfOpportunity not yet configured on the project
//                                       → generic R×L path, srsl/apScore/
//                                         apBand explicitly null (§11.2: "no
//                                         EL anchor" — one of two reasons
//                                         srsl is null, never SRSL0).
//     exposure_level rated             → calculateEN50742RiskValues: SRSL
//                                         (primary) + R×L (secondary lens,
//                                         L = AP band on the project scale).
//                                         severity resolved from linkedAssets
//                                         via resolveEN50742Severity(); may
//                                         itself be unresolved → srsl null
//                                         for that separate reason (§11.2
//                                         gate docs on EN50742LikelihoodEval).

export interface GatedRiskCalculationResult {
  impact: number;
  likelihood: number;
  risk: number;
  /** Present (possibly null) only for en-50742-a projects — see module doc. */
  srsl?: Srsl | null;
  apScore?: number | null;
  apBand?: AttackPotentialBand | null;
}

/**
 * Routes a risk's calculation between the generic R=I×L path and the EN 50742
 * AP/SRSL path, per the §11.2 gate. Single entry point for both call sites
 * (risk-dialog.tsx, risk-sync-service.ts) so the gate logic exists exactly
 * once.
 */
export function calculateGatedRiskValues(
  ratings: FactorRating[],
  configuration: RiskConfiguration,
  linkedAssets: AssetReference[],
): GatedRiskCalculationResult {
  // SRSL and R = L × I are SEPARATE assessments (EN 50742 Approach A yields an
  // SRSL + mandated controls; the residual risk stays the standard L × I).
  // Likelihood, impact and risk therefore ALWAYS come from the standard calc —
  // EL/AC/WoO are excluded from L (see EN50742_SRSL_FACTOR_IDS) and only drive
  // the SRSL, which is overlaid here as a parallel output. Setting EL/AC/WoO
  // never moves the risk.
  const generic = calculateRiskValues(ratings, configuration);
  if (configuration.likelihoodMethod !== "en-50742-a") {
    return generic;
  }

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

  if (!el || !ac || !configuration.windowOfOpportunity) {
    return { ...generic, srsl: null, apScore: null, apBand: null };
  }

  const severity = resolveEN50742Severity(linkedAssets);
  const evaluated = evaluateEN50742Likelihood(
    {
      exposureLevel: el,
      windowOfOpportunity: configuration.windowOfOpportunity,
      attackerCapability: ac,
    },
    severity,
  );
  return {
    ...generic,
    srsl: evaluated.srsl,
    apScore: evaluated.attackPotential.score,
    apBand: evaluated.attackPotential.band,
  };
}