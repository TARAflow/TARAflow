/**
 * Single source of truth for the ISO/SAE 21434 Annex G / Table G.7 attack-
 * feasibility band thresholds. Both the risk core (features/risks
 * iso21434-core.ts) and the attack-tree feasibility config
 * (features/attacktree attacktree-feasibility-types.ts) derive their band
 * tables from here, so the two can no longer drift (open point 9). Living in
 * shared keeps the feature boundary intact — neither feature imports the other.
 *
 * Boundaries are verbatim from ISO/SAE 21434:2021 Table G.7 "Example attack
 * potential mapping": High covers the two ISO 18045 sub-ranges 0–9 AND 10–13
 * (a single merged "High" cell in the standard), i.e. High = 0–13;
 * Medium = 14–19; Low = 20–24; Very low = ≥25.
 */
export type FeasibilityBandLevel = "high" | "medium" | "low" | "very-low";

/** Inclusive lower bound per band, in ascending attack-potential order. */
export const FEASIBILITY_BAND_MINIMA: readonly {
  level: FeasibilityBandLevel;
  minPotential: number;
}[] = [
  { level: "high", minPotential: 0 },
  { level: "medium", minPotential: 14 },
  { level: "low", minPotential: 20 },
  { level: "very-low", minPotential: 25 },
];

/**
 * Map an attack potential (≥ 0) to its feasibility band: the band with the
 * highest lower bound not exceeding the potential.
 */
export function feasibilityBandFor(
  attackPotential: number,
): FeasibilityBandLevel {
  if (attackPotential < 0) {
    throw new RangeError(`attackPotential out of range: ${attackPotential}`);
  }
  let level: FeasibilityBandLevel = FEASIBILITY_BAND_MINIMA[0].level;
  for (const band of FEASIBILITY_BAND_MINIMA) {
    if (attackPotential >= band.minPotential) {
      level = band.level;
    }
  }
  return level;
}

// ==================== MAPPING B: FEASIBILITY → RISK SCALE ====================

/** The risk scale sizes (same literals as the risk feature's RiskScaleType). */
export type RiskScaleLevels = "3-level" | "4-level" | "5-level";

const LEVEL_TO_RISK_SCALE: Record<
  RiskScaleLevels,
  Readonly<Record<FeasibilityBandLevel, number>>
> = {
  "3-level": { "very-low": 1, low: 1, medium: 2, high: 3 },
  "4-level": { "very-low": 1, low: 2, medium: 3, high: 4 },
  "5-level": { "very-low": 1, low: 2, medium: 3, high: 5 },
};

/**
 * Feasibility level → value on the project's risk scale ("Mapping B"),
 * derived from the risk scale at runtime (conformance plan decision 21).
 * Before, every project carried the stored 5-level default {1, 2, 3, 5}
 * (no dialog ever swapped it), so a 3- or 4-level project got a likelihood
 * of 5 outside its scale. Unknown / absent scale → 4-level (the default).
 */
export function feasibilityLevelToRiskScale(
  scale: RiskScaleLevels | undefined,
): Readonly<Record<FeasibilityBandLevel, number>> {
  return LEVEL_TO_RISK_SCALE[scale ?? "4-level"] ?? LEVEL_TO_RISK_SCALE["4-level"];
}

/** The mapping every project stored before decision 21 (5-level default). */
export const LEGACY_LEVEL_TO_RISK_SCALE: Readonly<Record<FeasibilityBandLevel, number>> =
  LEVEL_TO_RISK_SCALE["5-level"];
