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

import type { WindowOfOpportunity, StrideCategory } from "shared";
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

/** Table B.5 — Attack potential score → band, as data (not just the function
 * below) so a reference-table UI can render it without duplicating the
 * thresholds. `maxScore: null` means "no upper bound" (AP4). */
export interface ApBandThreshold {
  band: AttackPotentialBand;
  maxScore: number | null;
}
export const AP_BAND_TABLE: readonly ApBandThreshold[] = [
  { band: "AP0", maxScore: 5 },
  { band: "AP1", maxScore: 10 },
  { band: "AP2", maxScore: 15 },
  { band: "AP3", maxScore: 20 },
  { band: "AP4", maxScore: null },
];

/** Table B.5 — Attack potential score → band. */
export function bandForAttackPotential(score: number): AttackPotentialBand {
  for (const t of AP_BAND_TABLE) {
    if (t.maxScore === null || score <= t.maxScore) return t.band;
  }
  return "AP4"; // unreachable — AP_BAND_TABLE always ends in a null upper bound
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

// ---------------------------------------------------------------------------
// STRIDE → mandated 7.4.3 control  (design §11.4)
// ---------------------------------------------------------------------------
// Which 7.4.3 clauses are mandated for a threat depends on its anchor type
// (Interface vs DataFlow) and its STRIDE category. SRSL itself is computed for
// every EL-bearing anchor (§11.3); STRIDE only decides WHICH catalogue controls
// are mandated. R/I/D are handled by the standard method only ("Option B") → no
// mandated control. The exact Integrity sub-clauses for Interface × T and
// whether Interface × E also pulls Authenticity carry a VERIFY against the
// final norm — all clause lists are centralised here for a one-line change.

export type SrslAnchorType = "Interface" | "DataFlow";

export const EN50742_MANDATED_CLAUSES: Record<
  SrslAnchorType,
  Partial<Record<StrideCategory, readonly string[]>>
> = {
  Interface: {
    S: ["7.4.3.2.1"], // Authentication (unique)
    T: ["7.4.3.4.1", "7.4.3.4.2", "7.4.3.4.4", "7.4.3.4.5"], // Integrity (pick ≥1)
    E: ["7.4.3.3.1"], // Authorization enforcement
    // R / I / D → standard method only (no mandated control)
  },
  DataFlow: {
    T: ["7.4.3.4.3"], // Information exchange integrity (unique)
    // I / D → standard method only; S / R / E belong to the endpoint Interface
  },
};

/**
 * The mandated 7.4.3 protection requirements for a threat, given its anchor
 * type, STRIDE category and the computed SRSL. Returns the non-null profile
 * requirements at that SRSL tier for the mapped clauses. Empty when STRIDE
 * mandates nothing (R/I/D) or the SRSL tier is "None" for those clauses.
 */
/**
 * A display label for a mandated control selected on a risk. The
 * SelectedMitigation only stores the id `en50742-<clause>`; the human text
 * depends on the SRSL tier, so it is recomposed from the profile here. Returns
 * null if the clause is unknown or "None" at that tier. Shape mirrors the
 * catalogue labels ("<id>: <text>") but keyed on the norm, not a catalogue id:
 *   "EN50742: <category> — <requirement> (<clause>)"
 */
export function formatMandatedControlLabel(
  clause: string,
  srsl: Srsl,
  profile: SrslProfile = EN50742_SRSL_PROFILE,
): string | null {
  const req = profile.find((r) => r.clause === clause);
  const requirement = req?.tiers[srsl];
  if (!req || requirement == null) return null;
  return `EN50742: ${req.category} — ${requirement} (${clause})`;
}

/** Extract the clause from a mandated-control mitigation id, or null. */
export function clauseFromMandatedId(id: string): string | null {
  return id.startsWith("en50742-") ? id.slice("en50742-".length) : null;
}

export function mandatedRequirementsForThreat(
  anchorType: SrslAnchorType,
  stride: StrideCategory,
  srsl: Srsl,
  profile: SrslProfile = EN50742_SRSL_PROFILE,
): { clause: string; category: string; requirement: string }[] {
  const clauses = EN50742_MANDATED_CLAUSES[anchorType]?.[stride] ?? [];
  if (clauses.length === 0) return [];
  return profile
    .filter((r) => clauses.includes(r.clause))
    .map((r) => ({
      clause: r.clause,
      category: r.category,
      requirement: r.tiers[srsl],
    }))
    .filter(
      (r): r is { clause: string; category: string; requirement: string } =>
        r.requirement != null,
    );
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
/**
 * Factor ids that belong to the EN 50742 SRSL / attack-potential dimension —
 * NOT to the R = L × I likelihood. SRSL and Risk are separate assessments:
 * these inputs drive the SRSL (via the AP computation) and must be excluded
 * from the standard likelihood weighted mean, so setting EL/AC/WoO never moves
 * the residual risk. (window_of_opportunity is project-global but listed here
 * so any per-risk rating of it is likewise kept out of L.)
 */
export const EN50742_SRSL_FACTOR_IDS: readonly string[] = [
  "exposure_level",
  "attacker_capability",
  "window_of_opportunity",
];

export const EN50742_FACTOR_LEVELS: Record<string, readonly string[]> = {
  exposure_level: EN50742_EXPOSURE_LEVELS,
  attacker_capability: EN50742_ATTACKER_CAPABILITY_LEVELS,
};

/**
 * Human-readable labels for the two rated EN 50742 level factors, for the Risk
 * dialog dropdowns. The dropdown MUST show the NORM level (EL0..EL4 / AC skill
 * bands), NOT the 1-based FactorRating.value — otherwise EL3 renders as "4"
 * (its rating index) and the analyst reads a wrong exposure level. Kept as norm
 * text here (the same Table B.4 / B.2 wording used in the score maps above),
 * co-located with the levels they label.
 */
export const EXPOSURE_LEVEL_LABEL: Record<ExposureLevel, string> = {
  EL0: "EL0 – Internal",
  EL1: "EL1 – Physical",
  EL2: "EL2 – Local",
  EL3: "EL3 – Adjacent",
  EL4: "EL4 – Public",
};

export const ATTACKER_CAPABILITY_LABEL: Record<AttackerCapability, string> = {
  advanced: "Advanced (extensive knowledge)",
  specialist: "Specialist (moderate knowledge)",
  medium: "Medium (moderate knowledge)",
  basic: "Basic (minimal knowledge)",
};

/**
 * Label for a level KEY of an EN 50742 rated factor (exposure_level /
 * attacker_capability). Falls back to the raw key for anything else.
 */
export function en50742LevelLabel(factorId: string, levelKey: string): string {
  if (factorId === "exposure_level") {
    return EXPOSURE_LEVEL_LABEL[levelKey as ExposureLevel] ?? levelKey;
  }
  if (factorId === "attacker_capability") {
    return ATTACKER_CAPABILITY_LABEL[levelKey as AttackerCapability] ?? levelKey;
  }
  return levelKey;
}

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
   * `null` when `severity` could not be resolved (§11.2 gate: a risk can have
   * a fully-rated EL/AC without a linked safety-function asset carrying a
   * physicalImpact — AP/likelihood are still meaningful for the R×L lens, but
   * there is nothing to look up in Table B.6). Same "null ≠ unrated" convention
   * as the caller's overall unrated case (§ EN50742CalculationResult.srsl).
   */
  srsl: Srsl | null;
}

export function evaluateEN50742Likelihood(
  ap: AttackPotentialInput,
  severity: Severity | undefined,
): EN50742LikelihoodEval {
  const attackPotential = computeAttackPotential(ap);
  return {
    attackPotential,
    likelihoodOrdinal: en50742LikelihoodOrdinal(attackPotential.band),
    srsl: severity ? determineSrsl(attackPotential.band, severity) : null,
  };
}