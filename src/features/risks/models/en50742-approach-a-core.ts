/**
 * EN 50742 Approach A — pure computation core.
 *
 * No TARAflow dependencies: factor score tables, the attack-potential formula,
 * the SRSL lookup (Table B.6 + the confirmed `fatal` extension row), and the
 * Clause 7.4.3 protection-requirement catalogue (SRSLProfile).
 *
 * Normative source: prEN 50742:2025 (E), Annex B + Clause 7.4.3. The `fatal`
 * severity row is a TARAflow extension (see design doc §1.3). Requirement
 * wording is condensed to implementation form; authoritative text is the norm.
 */

/**
 * Window of Opportunity — one value for the whole machinery. Table B.3.
 * Canonical declaration lives in shared/regulation-preset.ts (the Overview
 * feature needs to read/write it without a risks↔overview import cycle — see
 * design doc §3.3).
 */

import type { WindowOfOpportunity } from "shared";
import { WINDOW_OF_OPPORTUNITY_MULTIPLIERS } from "shared";

// ---------------------------------------------------------------------------
// Factor scales (Annex B)
// ---------------------------------------------------------------------------

/** Exposure Level — per interface / connection. Table B.4. */
export type ExposureLevel = "EL0" | "EL1" | "EL2" | "EL3" | "EL4";
export const EXPOSURE_LEVEL_SCORE: Record<ExposureLevel, number> = {
  EL0: 0, // Internal
  EL1: 2, // Physical
  EL2: 5, // Local
  EL3: 16, // Adjacent
  EL4: 24, // Public
};

/**
 * Attacker Capability — per threat. Table B.2.
 * NOTE inverted polarity: a lower-capability-sufficient attack scores HIGHER
 * (basic = 4) and therefore yields a HIGHER attack potential.
 */
export type AttackerCapability =
  | "advanced" // Extensive knowledge + Advanced skill
  | "specialist" // Moderate knowledge + Specialist skill
  | "medium" // Moderate knowledge + Medium-level skill
  | "basic"; // Minimal knowledge + Basic skills
export const ATTACKER_CAPABILITY_SCORE: Record<AttackerCapability, number> = {
  advanced: 1,
  specialist: 2,
  medium: 3,
  basic: 4,
};

// ---------------------------------------------------------------------------
// Attack Potential — AP = (EL × WoO) + AC  (Annex B, line 592)
// ---------------------------------------------------------------------------

export type AttackPotentialBand = "AP0" | "AP1" | "AP2" | "AP3" | "AP4";

export interface AttackPotentialInput {
  exposureLevel: ExposureLevel; // per interface (higher-EL-wins across boundaries)
  windowOfOpportunity: WindowOfOpportunity; // project-global
  attackerCapability: AttackerCapability; // per threat
}

export interface AttackPotentialResult {
  score: number; // raw AP, may be fractional (WoO is a multiplier)
  band: AttackPotentialBand;
}

/**
 * Precision rule: raw AP is rounded to one decimal place before banding, so
 * boundary values land deterministically against the one-decimal Table B.5
 * bands (5.0 vs 5.1, etc.). Matches the norm's worked example (5×0.8)+4 = 8.
 */
export function computeAttackPotential(input: AttackPotentialInput): AttackPotentialResult {
  const el = EXPOSURE_LEVEL_SCORE[input.exposureLevel];
  const woo = WINDOW_OF_OPPORTUNITY_MULTIPLIERS[input.windowOfOpportunity];
  const ac = ATTACKER_CAPABILITY_SCORE[input.attackerCapability];

  const raw = el * woo + ac;
  const score = Math.round(raw * 10) / 10;

  return { score, band: bandForAttackPotential(score) };
}

/** Table B.5 — Attack potential score → band. */
export function bandForAttackPotential(score: number): AttackPotentialBand {
  if (score <= 5) return "AP0"; // 0 – 5
  if (score <= 10) return "AP1"; // 5.1 – 10
  if (score <= 15) return "AP2"; // 10.1 – 15
  if (score <= 20) return "AP3"; // 15.1 – 20
  return "AP4"; // > 20
}

// ---------------------------------------------------------------------------
// SRSL determination — Table B.6 (+ confirmed `fatal` extension row)
// ---------------------------------------------------------------------------

export type Severity = "reversible" | "non_reversible" | "fatal";
export type Srsl = "SRSL0" | "SRSL1" | "SRSL2" | "SRSL3";

/**
 * Table B.6 — SRSL as a literal lookup (AP band × severity). The first two rows
 * are the norm; `fatal` is the confirmed TARAflow extension (never SRSL0;
 * saturates SRSL3 one AP-band earlier than non_reversible).
 */
export const SRSL_LOOKUP: Record<Severity, Record<AttackPotentialBand, Srsl>> = {
  reversible: { AP0: "SRSL0", AP1: "SRSL1", AP2: "SRSL1", AP3: "SRSL2", AP4: "SRSL3" },
  non_reversible: { AP0: "SRSL0", AP1: "SRSL1", AP2: "SRSL2", AP3: "SRSL3", AP4: "SRSL3" },
  fatal: { AP0: "SRSL1", AP1: "SRSL2", AP2: "SRSL3", AP3: "SRSL3", AP4: "SRSL3" },
};

export function determineSrsl(band: AttackPotentialBand, severity: Severity): Srsl {
  return SRSL_LOOKUP[severity][band];
}

/** Convenience: full AP → SRSL pass for one (interface, threat, safety-function). */
export function evaluateApproachA(
  ap: AttackPotentialInput,
  severity: Severity,
): { attackPotential: AttackPotentialResult; srsl: Srsl } {
  const attackPotential = computeAttackPotential(ap);
  return { attackPotential, srsl: determineSrsl(attackPotential.band, severity) };
}

// ---------------------------------------------------------------------------
// SRSLProfile — Clause 7.4.3 security protection requirements, tiered SRSL0–3
// Condensed to implementation form; authoritative wording is the standard.
// `null` = "None" for that tier.
// ---------------------------------------------------------------------------

export interface SrslRequirement {
  clause: string;
  category: string;
  tiers: Record<Srsl, string | null>;
}
export type SrslProfile = SrslRequirement[];

export const EN50742_SRSL_PROFILE: SrslProfile = [
  {
    clause: "7.4.3.2.1",
    category: "Authentication",
    tiers: {
      SRSL0: null,
      SRSL1: "Entities authenticated.",
      SRSL2: "Entities authenticated.",
      SRSL3: "Entities uniquely authenticated.",
    },
  },
  {
    clause: "7.4.3.3.1",
    category: "Authorization enforcement",
    tiers: {
      SRSL0: null,
      SRSL1: "Interventions require authorization.",
      SRSL2: "Interventions require authorization.",
      SRSL3: "Interventions require authorization with specific privileges (e.g. RBAC).",
    },
  },
  {
    clause: "7.4.3.4.1",
    category: "Software and information integrity",
    tiers: {
      SRSL0: null,
      SRSL1: "Integrity verified at startup (e.g. checksums).",
      SRSL2: "Integrity verified at startup and periodically (e.g. checksums).",
      SRSL3:
        "Integrity cryptographically verified at startup and periodically (hashes, HMACs, CMACs).",
    },
  },
  {
    clause: "7.4.3.4.2",
    category: "Integrity of boot process",
    tiers: {
      SRSL0: null,
      SRSL1: "Boot integrity protected and verified at startup (e.g. checksums).",
      SRSL2: "Boot integrity protected and verified at startup.",
      SRSL3:
        "Secure boot: crypto signature verification with trusted roots; rollback or safe state on failure.",
    },
  },
  {
    clause: "7.4.3.4.3",
    category: "Information exchange integrity",
    tiers: {
      SRSL0: null,
      SRSL1: "Integrity of exchanged information verified.",
      SRSL2: "Integrity of exchanged information verified.",
      SRSL3:
        "Guaranteed by secure cryptographic protocols that detect and reject modified/replayed messages.",
    },
  },
  {
    clause: "7.4.3.4.4",
    category: "Input data validation",
    tiers: {
      SRSL0: null,
      SRSL1: "Validate against defined boundaries; reject invalid.",
      SRSL2: "Validate rigorously (syntax, semantics, format, data-type); reject invalid.",
      SRSL3:
        "Validate rigorously with strict context-aware checks (syntactic, semantic, boundary, protocol-specific); reject invalid.",
    },
  },
  {
    clause: "7.4.3.4.5",
    category: "Physical tampering",
    tiers: {
      SRSL0: null,
      SRSL1: "Physical tampering detected (e.g. seal breaking).",
      SRSL2: "Physical tampering detected.",
      SRSL3: "Physical tampering detected.",
    },
  },
  {
    clause: "7.4.3.5.1",
    category: "Authenticity of SRESW/SRASW",
    tiers: {
      SRSL0: null,
      SRSL1: null,
      SRSL2:
        "Authenticity of critical data (SRESW/SRASW, critical config) verified via crypto signatures or equivalent at installation time.",
      SRSL3:
        "Authenticity of critical data (SRESW/SRASW, critical config) verified via crypto signatures or equivalent at installation time.",
    },
  },
];

/** The set of protection requirements that apply at (or below) a determined SRSL. */
export function requirementsForSrsl(
  srsl: Srsl,
  profile: SrslProfile = EN50742_SRSL_PROFILE,
): { clause: string; category: string; requirement: string | null }[] {
  return profile.map((r) => ({
    clause: r.clause,
    category: r.category,
    requirement: r.tiers[srsl],
  }));
}

// ===========================================================================
// SCORE-TABLE RATING INTEGRATION  (design §2.2 / §2.3 / §3.2)
// Added for the pure-logic core: level registries, band→likelihood ordinal,
// combined evaluation, and DFD exposure-level resolution.
// ===========================================================================

// ---------------------------------------------------------------------------
// Rating-level registries
// ---------------------------------------------------------------------------
// A FactorRating.value is a 1-based index into the factor's ordered level list
// (0 = not rated), mirroring the ISO 21434 / ETSI TVRA cores. EN 50742 exposes
// registries for the two RATED factors only:
//   - exposure_level      (derived from the DFD, overridable — §3.2)
//   - attacker_capability (per threat, rated in the Risk dialog)
// WoO is NOT a per-risk factor (project-global config, §3.3); its ordered list
// is provided for the Overview dropdown, not for rating indexing.

export const EN50742_EXPOSURE_LEVELS: readonly ExposureLevel[] = [
  "EL0", "EL1", "EL2", "EL3", "EL4",
];

/**
 * Ordered most-capable → least-capable, so the level index rises WITH the
 * (inverted-polarity) AC score: index 1 = advanced (score 1) … index 4 = basic
 * (score 4). See ATTACKER_CAPABILITY_SCORE — a basic-skill-sufficient attack
 * scores highest and yields the highest attack potential.
 */
export const EN50742_ATTACKER_CAPABILITY_LEVELS: readonly AttackerCapability[] = [
  "advanced", "specialist", "medium", "basic",
];

/** Overview dropdown order (least → most opportunity). NOT a rating registry. */
export const EN50742_WOO_LEVELS: readonly WindowOfOpportunity[] = [
  "very_restricted", "moderately_restricted", "limited", "unlimited",
];

/** factorId → ordered level keys, for the two rated EN 50742 factors. */
export const EN50742_FACTOR_LEVELS: Record<string, readonly string[]> = {
  exposure_level: EN50742_EXPOSURE_LEVELS,
  attacker_capability: EN50742_ATTACKER_CAPABILITY_LEVELS,
};

/**
 * Map a 1-based FactorRating.value to its level key, or undefined if unrated
 * (value <= 0) or out of range.
 */
export function en50742LevelFromRating(
  factorId: string,
  value: number,
): string | undefined {
  const levels = EN50742_FACTOR_LEVELS[factorId];
  if (!levels || value <= 0 || value > levels.length) return undefined;
  return levels[value - 1];
}

// ---------------------------------------------------------------------------
// Band → likelihood ordinal — NATURAL polarity (§2.2)
// ---------------------------------------------------------------------------
// EN 50742 AC has inverted polarity at the FACTOR level (basic attacker → high
// AP), but the band→likelihood mapping is NATURAL: a higher AP band means a MORE
// likely attack. This is the OPPOSITE of ISO 21434 / ETSI TVRA, where higher
// attack potential means LOWER feasibility/occurrence. Do NOT copy the ISO/TVRA
// inversion here.

/** Number of AP bands = source scale for normalising onto the project scale. */
export const EN50742_AP_BAND_COUNT = 5;

const EN50742_BAND_ORDINAL: Record<AttackPotentialBand, number> = {
  AP0: 1, // Very Low  → lowest likelihood
  AP1: 2,
  AP2: 3,
  AP3: 4,
  AP4: 5, // Very High → highest likelihood
};

export function en50742LikelihoodOrdinal(band: AttackPotentialBand): number {
  return EN50742_BAND_ORDINAL[band];
}

// ---------------------------------------------------------------------------
// Combined EN 50742 likelihood evaluation (§2.3)
// ---------------------------------------------------------------------------

export interface EN50742LikelihoodEval {
  attackPotential: AttackPotentialResult; // { score, band }
  /**
   * 1..EN50742_AP_BAND_COUNT, natural polarity. Feed to normaliseImpactValue
   * (source scale = EN50742_AP_BAND_COUNT) to reach the project likelihood scale.
   */
  likelihoodOrdinal: number;
  /**
   * Authoritative Approach-A output — Table B.6 (band × severity). Independent
   * of the likelihood ordinal; the two may diverge in ordering (§2.2).
   */
  srsl: Srsl;
}

export function evaluateEN50742Likelihood(
  ap: AttackPotentialInput,
  severity: Severity,
): EN50742LikelihoodEval {
  const attackPotential = computeAttackPotential(ap);
  return {
    attackPotential,
    likelihoodOrdinal: en50742LikelihoodOrdinal(attackPotential.band),
    srsl: determineSrsl(attackPotential.band, severity),
  };
}
