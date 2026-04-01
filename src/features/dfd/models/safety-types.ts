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

// ==================== SAFETY IMPACT ====================

/**
 * Maximum safety impact upon compromise (ISO 12100 / IEC 62443 harm categories).
 *
 * Safety Override Rule (triggers only when relevance === 'direct'):
 *   fatality | irreversible_injury + relevance:'direct' → CRITICAL regardless of business impact
 *   fatality | irreversible_injury + relevance:'indirect' → HIGH+ (no automatic override)
 */
export type SafetyImpact =
  | "none"
  | "reversible_injury"
  | "irreversible_injury"
  | "fatality";

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
  physicalHazardPotential?: "low" | "medium" | "high";

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
 * Condition: relevance === "direct" AND impact is fatality or irreversible_injury.
 *
 * Note: fatality + relevance:'indirect' does NOT trigger override → HIGH+ only.
 */
export function isSafetyCritical(safety: SafetyAnnotation | undefined): boolean {
  if (!safety) return false;
  return (
    safety.relevance === "direct" &&
    (safety.impact === "fatality" || safety.impact === "irreversible_injury")
  );
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
 */
export function aggregateSafetyImpact(
  annotations: (SafetyAnnotation | undefined)[]
): SafetyImpact {
  const order: SafetyImpact[] = ["none", "reversible_injury", "irreversible_injury", "fatality"];
  let max = 0;
  for (const ann of annotations) {
    if (!ann?.impact) continue;
    const idx = order.indexOf(ann.impact);
    if (idx > max) max = idx;
  }
  return order[max];
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
