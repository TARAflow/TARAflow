// ==================== SAFETY TYPES ====================
// Safety annotation layer for TARAflow
//
// Concept: Safety as an optional annotation layer on top of the security analysis.
// No separate modeling logic — existing relations are enriched with safety context.
//
// Standard references: EN 50742 / ISO 12100 / IEC 62443
// Not a replacement for formal safety analysis (FMEA, FTA, ISO 13849)

// ==================== SAFETY RELEVANCE ====================

/**
 * Degree of safety relevance of an element or relation
 *
 * - none:     No safety relevance
 * - indirect: Indirectly influences safety functions
 *             (e.g. logging service of a safety system)
 * - direct:   Is itself part of a safety function or can
 *             directly influence a safety function
 *             (e.g. emergency stop logic)
 */
export type SafetyRelevance = "none" | "indirect" | "direct";

// ==================== SAFETY IMPACT ====================

/**
 * Maximum safety impact upon compromise
 * Based on ISO 12100 / IEC 62443 harm categories
 *
 * - none:                No personal injury possible
 * - reversible_injury:   Injury with full recovery possible
 * - irreversible_injury: Permanent damage / disability
 * - fatality:            Fatal outcome possible
 *
 * Note: fatality sets Risk Priority = CRITICAL regardless of
 * business impact (see threat scoring)
 */
export type SafetyImpact =
  | "none"
  | "reversible_injury"
  | "irreversible_injury"
  | "fatality";

// ==================== SAFETY ANNOTATION ====================

/**
 * Safety annotation for DFD elements and asset relations
 *
 * Used uniformly on:
 * - DFDElement (Process, DataStore, Interface, etc.)
 * - DFDConnection (DataFlow)
 * - AssetRelation (for safety-relevant relations)
 *
 * @example
 * // Process with direct safety relevance
 * {
 *   relevance: "direct",
 *   impact: "fatality",
 *   affectedSafetyFunctions: ["Emergency Stop", "Pressure Relief"],
 *   rationale: "Manipulation disables emergency stop function"
 * }
 *
 * @example
 * // DataFlow with indirect safety relevance
 * {
 *   relevance: "indirect",
 *   impact: "reversible_injury",
 *   rationale: "Carries sensor data used by safety-critical process"
 * }
 */
export interface SafetyAnnotation {
  /**
   * Degree of safety relevance
   * Required field when a safety annotation is present
   */
  relevance: SafetyRelevance;

  /**
   * Maximum safety impact upon compromise
   * Relevant when relevance !== "none"
   */
  impact?: SafetyImpact;

  /**
   * Specific to Human Assets:
   * Marks this person/role as a protection target
   * (e.g. operator who can be physically endangered)
   */
  protectionTarget?: boolean;

  /**
   * Physical hazard potential of the element/asset
   * Specific to System Assets with direct machine involvement
   * e.g. CNC machine { physicalHazardPotential: 'high' }
   */
  physicalHazardPotential?: "low" | "medium" | "high";

  /**
   * Element/asset is a physical protection barrier
   * Specific to Infrastructure Assets that protect people
   * e.g. safety enclosure { isPhysicalBarrier: true }
   * → Failure = direct safety impact on Human Assets
   */
  isPhysicalBarrier?: boolean;

  /**
   * Referenced safety functions that are affected
   * (e.g. ["Emergency Stop", "Overpressure Protection"])
   * Enables traceability to safety requirements
   */
  affectedSafetyFunctions?: string[];

  /**
   * Rationale for safety relevance in standards language
   * Used for automatic documentation generation
   *
   * @example
   * "Manipulation of this data store could disable the emergency
   *  stop function, potentially resulting in fatal injuries."
   */
  rationale?: string;
}

// ==================== SAFETY HELPERS ====================

/**
 * Returns true if a safety annotation requires critical priority
 * (independent of business impact)
 *
 * Condition: relevance === "direct" OR impact === "fatality"
 */
export function isSafetyCritical(safety: SafetyAnnotation | undefined): boolean {
  if (!safety) return false;
  return safety.relevance === "direct" || safety.impact === "fatality";
}

/**
 * Returns true if a safety annotation has any safety relevance at all
 */
export function hasSafetyRelevance(safety: SafetyAnnotation | undefined): boolean {
  if (!safety) return false;
  return safety.relevance !== "none";
}

/**
 * Creates an empty safety annotation (default: no relevance)
 */
export function createDefaultSafetyAnnotation(): SafetyAnnotation {
  return { relevance: "none" };
}
