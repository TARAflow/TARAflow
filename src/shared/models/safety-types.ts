// ==================== SAFETY TYPES ====================
// Safety annotation layer for TARAflow
// Standard references: EN 50742 / ISO 12100 / IEC 62443

// ==================== VALUE SOURCE ====================

/**
 * Provenance marker for derived vs. analyst-set values.
 *
 * derived: Calculated automatically by the derivation engine.
 *          No audit documentation required.
 * manual:  Analyst explicitly set or overrode the value.
 *          Corresponding rationale field REQUIRED (IEC 62443-4-1 traceability).
 *
 * Used on:
 *   AssetProperties.physicalImpactSource
 *   AssetProperties.nonRepudiationSource / authenticationSource / ...
 *   AssetProperties.isHighValueAssetSource
 *   SafetyAnnotation.source
 */
export type ValueSource = "derived" | "manual";

// ==================== SAFETY RELEVANCE ====================

/**
 * Degree of safety relevance.
 *
 * none:     No safety relevance.
 * indirect: Influences safety functions systemically
 *           (availability, configuration, infrastructure).
 *           Compromise = systemic influence, no direct lever.
 * direct:   Directly controls a safety function
 *           (energy output, motion, dosage, safety interlock, validation decision).
 *           Compromise = immediate control over the physical harm.
 *
 * Key question: "If exactly this asset is compromised — does it directly control
 * the physical action that causes the harm?"
 *   Yes → direct     No → indirect
 *
 * Note: An asset can theoretically lead to fatality and still be 'indirect'
 * if it influences the situation systemically rather than controlling it directly.
 *
 * On Asset→Asset level:
 *   Default propagation is always 'indirect' (source: "derived").
 *   'direct' requires source: "manual" + rationale (Pflicht).
 */
export type SafetyRelevance = "none" | "indirect" | "direct";

// ==================== Physical Hazard Potential ====================

/**
 * Physical hazard potential — qualitative assessment per ISO 12100 / EN 50742.
 * Rates how much physical-safety leverage an asset (or a hazard) carries,
 * independent of likelihood.
 *
 * low:    Minimal risk — no control over the physical action
 *         (e.g. monitoring port, read-only interface).
 * medium: Moderate risk — indirect/systemic influence on the safety situation
 *         (e.g. configuration interface, parameter access).
 * high:   High risk — direct access to safety logic or energetic motion
 *         (e.g. drive control, safety interlock, dosage actuator).
 */
export type PhysicalHazardPotential = "low" | "medium" | "high";


// ==================== SAFETY SEVERITY (canonical scale) ====================

/**
 * Canonical 5-level harm severity for persons — the ONE vocabulary shared by
 * the SafetyAnnotation, the Hazard Item `endangers` edge (human target), the
 * asset physicalImpact and the asset-dialog safety rating.
 *
 * Ordered ascending. The split of irreversible harm follows IEC 62061
 * (Se3 = irreversible minor, e.g. loss of a finger; Se4 = irreversible major,
 * e.g. loss of an arm or eye). `fatal` stays a separate level so that
 * mode-specific scales can map without loss:
 *
 *   level               IEC 62061 Se   ISO 26262 S   EN 50742
 *   reversible_minor         1             1         reversible
 *   reversible_major         2             1         reversible
 *   irreversible_minor       3             2         non_reversible
 *   irreversible_major       4             2         non_reversible
 *   fatal                    4             3         fatal
 */
export const SAFETY_SEVERITIES = [
  "reversible_minor",
  "reversible_major",
  "irreversible_minor",
  "irreversible_major",
  "fatal",
] as const;

export type SafetySeverity = (typeof SAFETY_SEVERITIES)[number];

// ==================== SAFETY IMPACT ====================

/**
 * Maximum safety impact upon compromise — the canonical severity plus "none".
 *
 * Safety Override Rule — see deriveAggregatedImpact() and isSafetyCritical():
 *   irreversible_major | fatal + relevance:'direct'   → CRITICAL regardless of business impact
 *   irreversible_major | fatal + relevance:'indirect' → HIGH+
 *   irreversible_minor + relevance:'direct'            → HIGH+
 *   irreversible_minor + relevance:'indirect'          → HIGH
 */
export type SafetyImpact = "none" | SafetySeverity;

/** Ordered ascending, "none" first — drives dropdown order and comparisons. */
export const SAFETY_IMPACTS: readonly SafetyImpact[] = [
  "none",
  ...SAFETY_SEVERITIES,
];

/** i18n key of a safety impact label (common namespace). */
export function safetyImpactI18nKey(impact: SafetyImpact): string {
  return `safetySeverity.${impact}`;
}

/** Display colour per severity (ascending green → red). */
export const SAFETY_SEVERITY_COLOR: Readonly<Record<SafetySeverity, string>> = {
  reversible_minor: "#22c55e",
  reversible_major: "#eab308",
  irreversible_minor: "#f97316",
  irreversible_major: "#ea580c",
  fatal: "#dc2626",
};

/** Rank for comparisons: none = 0 … fatal = 5. Unknown values rank 0. */
export function safetyImpactRank(impact: SafetyImpact | undefined): number {
  if (!impact) return 0;
  const idx = SAFETY_IMPACTS.indexOf(impact);
  return idx < 0 ? 0 : idx;
}

/** Worst of two impacts (undefined-safe). */
export function worseSafetyImpact<T extends SafetyImpact | undefined>(
  a: T,
  b: T,
): T {
  return safetyImpactRank(b) > safetyImpactRank(a) ? b : a;
}

/** Worst severity of a list; undefined when the list carries none. */
export function worstSafetySeverity(
  impacts: readonly (SafetyImpact | undefined)[],
): SafetySeverity | undefined {
  let worst: SafetySeverity | undefined;
  for (const i of impacts) {
    if (!i || i === "none") continue;
    if (safetyImpactRank(i) > safetyImpactRank(worst)) worst = i;
  }
  return worst;
}

/** Irreversible harm or worse (irreversible_minor, irreversible_major, fatal). */
export function isIrreversibleOrWorse(impact: SafetyImpact | undefined): boolean {
  return safetyImpactRank(impact) >= safetyImpactRank("irreversible_minor");
}

/**
 * Severity that triggers the Safety Override Rule (with relevance 'direct'):
 * irreversible_major or fatal.
 */
export function isOverrideSeverity(impact: SafetyImpact | undefined): boolean {
  return safetyImpactRank(impact) >= safetyImpactRank("irreversible_major");
}

/**
 * Fixed 4-level safety factor value (IEC 62061 Se1–Se4) used by the risk
 * calculation and stored as the asset "safety" ImpactRating.value.
 * irreversible_major and fatal share Se4; the categorical severity stays the
 * source of truth for the distinction.
 */
export function safetySeverityToFactor(severity: SafetySeverity): 1 | 2 | 3 | 4 {
  switch (severity) {
    case "reversible_minor":   return 1;
    case "reversible_major":   return 2;
    case "irreversible_minor": return 3;
    case "irreversible_major":
    case "fatal":              return 4;
  }
}

/**
 * Maps a persisted value of the pre-v9 vocabularies onto the canonical scale.
 * Conservative: an undifferentiated level maps to the upper sub-level.
 * Returns the value unchanged when it is already canonical, undefined when it
 * is not a known severity.
 *
 *   reversible_injury / reversible / reversible_moderate → reversible_major
 *   irreversible_injury / irreversible                   → irreversible_major
 *   fatality                                             → fatal
 */
export function normalizeLegacySafetyImpact(
  value: unknown,
): SafetyImpact | undefined {
  if (typeof value !== "string") return undefined;
  if ((SAFETY_IMPACTS as readonly string[]).includes(value)) {
    return value as SafetyImpact;
  }
  switch (value) {
    case "reversible_injury":
    case "reversible":
    case "reversible_moderate":
      return "reversible_major";
    case "irreversible_injury":
    case "irreversible":
      return "irreversible_major";
    case "fatality":
      return "fatal";
    default:
      return undefined;
  }
}

// ==================== SAFETY ANNOTATION ====================

/**
 * Safety annotation — used uniformly on:
 *   DFDElement, DFDConnection, AssetRelation, AssetToAssetRelation
 *
 * Propagation rules (§3.5 taraflow-asset-zu-asset-beziehungen.md):
 *   Element→Asset:      relevance may be 'direct' (automatically set by analyst)
 *   Asset→Asset Core:   default 'indirect' (derived); 'direct' requires manual + rationale
 *   Asset→Asset Domain: same rules when analyticallyActive === true
 *   Hop limit:          maxHops: 1 (default, project-configurable to 2)
 *
 * Double propagation prevention:
 *   If an asset already has Element→Asset: relevance:'direct', the Asset→Asset
 *   level may not override or strengthen this (already highest level).
 */
export interface SafetyAnnotation {
  /** Degree of safety relevance — required when annotation is present */
  relevance: SafetyRelevance;

  /** Maximum impact upon compromise — relevant when relevance !== "none" */
  impact?: SafetyImpact;

  /**
   * Person is a protection target (ISO 12100 / EN 50742 terminology).
   * Specific to Human Assets.
   */
  protectionTarget?: boolean;

  /**
   * Physical hazard potential — qualitative assessment per ISO 12100 / EN 50742.
   * low:    Minimal risk (monitoring port, no control function)
   * medium: Moderate risk (configuration interface)
   * high:   High risk (direct access to safety logic, machine motion)
   */
  physicalHazardPotential?: PhysicalHazardPotential;

  /**
   * Asset is a physical protection barrier (guard, enclosure, fence).
   * Failure = direct safety impact on Human Assets in the vicinity.
   * Specific to Infrastructure Assets.
   */
  isPhysicalBarrier?: boolean;

  /**
   * Affected safety function UUIDs (TARAflow-internal).
   * References Function Asset UUIDs in this project — NOT external SF-xxx IDs
   * (those live in FunctionAsset.externalRefs[].id).
   */
  affectedSafetyFunctions?: string[];

  /**
   * Rationale in standards language — for documentation generation.
   * REQUIRED when source === "manual".
   * @example "Manipulation could disable the emergency stop function, leading to fatality."
   */
  rationale?: string;

  /**
   * Provenance of this annotation.
   * derived: engine-calculated, no documentation obligation
   * manual:  analyst-set — rationale REQUIRED
   */
  source?: ValueSource;
}

// ==================== SAFETY HELPERS ====================

/**
 * Returns true if the Safety Override Rule applies.
 * Condition: relevance === "direct" AND impact is irreversible_major or fatal.
 *
 * Note: irreversible_minor + direct and any severity + indirect do NOT trigger
 * the override (HIGH+ / HIGH at most — see deriveAggregatedImpact).
 */
export function isSafetyCritical(safety: SafetyAnnotation | undefined): boolean {
  if (!safety) return false;
  return safety.relevance === "direct" && isOverrideSeverity(safety.impact);
}

/** Returns true if the annotation has any safety relevance */
export function hasSafetyRelevance(safety: SafetyAnnotation | undefined): boolean {
  return !!safety && safety.relevance !== "none";
}

/** Returns true if the annotation has direct safety relevance */
export function isDirectSafetyRelevant(safety: SafetyAnnotation | undefined): boolean {
  return !!safety && safety.relevance === "direct";
}

/**
 * Returns the highest safety impact across a set of annotations.
 * Used when aggregating impact across multiple relations or hops.
 * Annotations are independent single causes → worst case (ANY semantics).
 */
export function aggregateSafetyImpact(
  annotations: (SafetyAnnotation | undefined)[]
): SafetyImpact {
  return worstSafetySeverity(annotations.map((a) => a?.impact)) ?? "none";
}

/** Creates an empty safety annotation (default: no relevance) */
export function createDefaultSafetyAnnotation(): SafetyAnnotation {
  return { relevance: "none" };
}

/** Creates a derived indirect annotation (used by the propagation engine) */
export function createDerivedIndirectAnnotation(
  impact: SafetyImpact,
  rationale: string
): SafetyAnnotation {
  return { relevance: "indirect", impact, source: "derived", rationale };
}
