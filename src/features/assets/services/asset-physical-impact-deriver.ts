// ==================== PHYSICAL IMPACT DERIVER ====================
// Derives physicalImpact and aggregatedImpact for an Asset.
//
// Source of truth: taraflow-cnc-referenzfall.md §4.0
// "Formale Aggregationslogik" + "Safety Override Rule"
//
// Two-step process:
//   Step 1: derivePhysicalImpact  — from SafetyAnnotation on linkedDFDElements
//   Step 2: deriveAggregatedImpact — Aggregationsmatrix (business × physical)
//
// Both follow the Derived/Manual Pattern:
//   source:"derived" → computed here, no extra documentation required
//   source:"manual"  → analyst override, rationale mandatory (IEC 62443-4-1)

import type { Asset } from "../models/asset-types";
import type { DFDElementLink } from "../models/dfd-asset-link-types";
import {
  SAFETY_IMPACT_SCALE,
  SAFETY_CRITERION_ID,
} from "../models/asset-impact-types";

// ==================== TYPES ====================

// Severity levels — directly from ISO 12100 / EN 50742 SafetyAnnotation.impact
// undefined = no safety annotation present → shows "–" in asset table
export type PhysicalImpactLevel =
  | "reversible_injury"
  | "irreversible_injury"
  | "fatality";

export type AggregatedImpact = "LOW" | "MED" | "MED+" | "HIGH" | "HIGH+" | "CRITICAL";

/** Numeric rank for comparing severity levels */
const PHYSICAL_RANK: Record<PhysicalImpactLevel, number> = {
  reversible_injury: 0,
  irreversible_injury: 1,
  fatality: 2,
};

/** Business impact from overallImpact (1–4 numeric scale → qualitative) */
export type BusinessImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";


// ==================== SAFETY RATING MAPPER ====================

/**
 * Map numeric safety rating (1–4 from SAFETY_IMPACT_SCALE) to PhysicalImpactLevel.
 * Used when physicalImpact is set manually via the asset-dialog safety dropdown.
 */
export function safetyRatingToPhysicalLevel(
  value: number | null | "na",
): PhysicalImpactLevel | undefined {
  if (!value || value === "na") return undefined;
  const level = SAFETY_IMPACT_SCALE.find((l) => l.value === Number(value));
  if (!level) return undefined;
  switch (level.severity) {
    case "fatality":             return "fatality";
    case "irreversible_injury":  return "irreversible_injury";
    case "reversible_moderate":
    case "reversible_minor":     return "reversible_injury";
  }
}

/**
 * Map PhysicalImpactLevel → SAFETY_IMPACT_SCALE value (for pre-filling dropdown).
 * Uses the higher of the two reversible levels (2) as default.
 */
export function physicalLevelToSafetyRating(
  level: PhysicalImpactLevel | undefined,
): number | null {
  if (!level) return null;
  switch (level) {
    case "fatality":            return 4;
    case "irreversible_injury": return 3;
    case "reversible_injury":   return 2;
  }
}

// ==================== STEP 1: PHYSICAL IMPACT ====================

/**
 * Derive physicalImpact from SafetyAnnotation summaries on linkedDFDElements.
 *
 * Rules (§4.0a Ableitungsregel):
 *   impact: 'fatality' OR 'irreversible_injury'  →  HIGH  (direct path to harm)
 *   relevance: 'indirect'                         →  MED   (systemic influence, Hop 1)
 *   no annotation present                         →  LOW   (default)
 *
 * MAX wins across all relations on the asset.
 *
 * If asset.physicalImpactSource === "manual", the stored value is authoritative —
 * this function is NOT called (caller must check).
 */
export function derivePhysicalImpact(linkedElements: DFDElementLink[]): {
  level: PhysicalImpactLevel | undefined;
  derivedFrom: string[];
} {
  let maxLevel: PhysicalImpactLevel | undefined = undefined;
  const derivedFrom: string[] = [];

  for (const link of linkedElements) {
    const safety = link.safety;
    if (!safety || safety.relevance === "none") continue;

    let level: PhysicalImpactLevel | undefined;

    // Direct mapping from SafetyAnnotation.impact
    if (safety.impact === "fatality") {
      level = "fatality";
    } else if (safety.impact === "irreversible_injury") {
      level = "irreversible_injury";
    } else if (safety.impact === "reversible_injury") {
      level = "reversible_injury";
    } else if (
      safety.relevance === "indirect" ||
      safety.relevance === "direct"
    ) {
      // relevance set but no explicit impact → worst-case indirect → reversible_injury
      level = "reversible_injury";
    }

    if (!level) continue;

    if (
      maxLevel === undefined ||
      PHYSICAL_RANK[level] > PHYSICAL_RANK[maxLevel]
    ) {
      maxLevel = level;
    }

    derivedFrom.push(
      `${link.elementName} → ${link.relationType ?? "?"}` +
        (safety.impact ? ` (${safety.impact})` : "") +
        ` [${safety.relevance}]`,
    );
  }

  // undefined = no safety annotations → shows "–" in asset table
  return { level: maxLevel, derivedFrom };
}

/**
 * Returns the effective physicalImpact for an asset,
 * respecting the manual override if set.
 */
export function effectivePhysicalImpact(
  asset: Asset,
): PhysicalImpactLevel | undefined {
  if (
    (asset.physicalImpactSource === "manual" ||
      asset.physicalImpactSource === "hazard") &&
    asset.physicalImpact
  ) {
    // Manual or hazard-derived value is authoritative.
    return asset.physicalImpact as PhysicalImpactLevel;
  }
  return derivePhysicalImpact(asset.linkedDFDElements).level; // may be undefined
}

// ==================== STEP 2: AGGREGATED IMPACT ====================

/**
 * Convert numeric overallImpact (1–4 scale) to qualitative BusinessImpactLevel.
 * Scale is based on 4-level default (LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4).
 */
export function overallImpactToBusinessLevel(
  overallImpact: number,
): BusinessImpactLevel {
  if (overallImpact >= 4) return "CRITICAL";
  if (overallImpact >= 3) return "HIGH";
  if (overallImpact >= 2) return "MEDIUM";
  return "LOW";
}

export function deriveAggregatedImpact(
  physicalLevel: PhysicalImpactLevel | undefined,
  physicalDirect: boolean,
  businessLevel: BusinessImpactLevel,
  isHighValueAsset?: "low" | "medium" | "high" | "critical",
  assetDestructionImpact?: string,
): AggregatedImpact {
  // ── Safety Override Rule ───────────────────────────────────────
  // fatality or irreversible_injury = HIGH severity → CRITICAL (direct) or HIGH+ (indirect)
  if (physicalLevel === "fatality" || physicalLevel === "irreversible_injury") {
    return physicalDirect ? "CRITICAL" : "HIGH+";
  }
  // reversible_injury → HIGH (direct) or MED+ (indirect)
  if (physicalLevel === "reversible_injury") {
    return physicalDirect ? "HIGH" : "MED+";
  }

  // ── High-Value Override ────────────────────────────────────────
  // MINIMUM-principle: sets a floor, never lowers a higher value.
  // Override hierarchy (§ taraflow-asset-beziehungen.md):
  //   critical → CRITICAL minimum
  //   high     → CRITICAL minimum
  //   medium   → HIGH minimum
  //   low      → no override
  if (isHighValueAsset === "critical" || isHighValueAsset === "high") {
    return "CRITICAL";
  }
  if (isHighValueAsset === "medium") {
    // HIGH minimum — only applies if normal aggregation would be lower
    const normal = deriveNormalAggregation(businessLevel);
    return normal === "LOW" || normal === "MED" || normal === "MED+"
      ? "HIGH"
      : normal;
  }

  // ── Normal Aggregation Matrix ──────────────────────────────────
  return deriveNormalAggregation(businessLevel);
}

function deriveNormalAggregation(
  businessLevel: BusinessImpactLevel,
): AggregatedImpact {
  // No physical impact → purely business-driven
  switch (businessLevel) {
    case "CRITICAL":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MED";
    case "LOW":
      return "LOW";
  }
}

// ==================== CONVENIENCE: FULL DERIVATION ====================

export interface PhysicalImpactDerivationResult {
  physicalImpact: PhysicalImpactLevel | undefined;
  physicalImpactDerivedFrom: string[];
  physicalImpactDirect: boolean;
  aggregatedImpact: AggregatedImpact;
  /** true if Safety Override Rule fired (physicalImpact HIGH) */
  safetyOverrideActive: boolean;
  /** true if High-Value Override Rule fired */
  highValueOverrideActive: boolean;
}

/**
 * Full derivation pipeline for one asset.
 * Respects manual overrides on physicalImpact.
 * Always recomputes aggregatedImpact (never stored manually).
 */
export function deriveAllImpacts(asset: Asset): PhysicalImpactDerivationResult {
  // Hazard-sourced assets are owned by commit-hazard-safety: the bowtie carries
  // the contributes_to relevance needed for the Safety Override Rule, which is
  // not available here. Preserve the stored values instead of re-deriving from
  // the (legacy) SafetyAnnotation.
  if (asset.physicalImpactSource === "hazard") {
    const physicalLevel = asset.physicalImpact as PhysicalImpactLevel | undefined;
    const high =
      physicalLevel === "fatality" || physicalLevel === "irreversible_injury";
    return {
      physicalImpact: physicalLevel,
      physicalImpactDerivedFrom: [
        `[hazard] ${asset.physicalImpactRationale ?? ""}`,
      ],
      physicalImpactDirect: high,
      aggregatedImpact: asset.aggregatedImpact ?? "LOW",
      safetyOverrideActive: high,
      highValueOverrideActive: false,
    };
  }

  // Step 1 — physical impact (undefined = no safety annotations)
  let physicalLevel: PhysicalImpactLevel | undefined;
  let derivedFrom: string[];
  let physicalDirect: boolean;

  if (asset.physicalImpactSource === "manual" && asset.physicalImpact) {
    physicalLevel = asset.physicalImpact as PhysicalImpactLevel;
    derivedFrom = [`[manual] ${asset.physicalImpactRationale ?? ""}`];
    // Conservative: fatality/irreversible treated as direct
    physicalDirect =
      physicalLevel === "fatality" || physicalLevel === "irreversible_injury";
  } else {
    const result = derivePhysicalImpact(asset.linkedDFDElements);
    physicalLevel = result.level; // may be undefined
    derivedFrom = result.derivedFrom;
    // Check if any relation is direct with HIGH impact
    physicalDirect = asset.linkedDFDElements.some(
      (l) =>
        l.safety?.relevance === "direct" &&
        (l.safety.impact === "fatality" ||
          l.safety.impact === "irreversible_injury"),
    );
  }

  // undefined physicalLevel → no safety relevance → purely business-driven
  // Step 2 — business level from stored overallImpact
  const businessLevel = overallImpactToBusinessLevel(asset.overallImpact);

  // Step 3 — aggregated
  const isHighValue = asset.properties?.isHighValueAsset;
  const destructionImpact = asset.properties?.assetDestructionImpact;

  const aggregated = deriveAggregatedImpact(
    physicalLevel,
    physicalDirect,
    businessLevel,
    isHighValue,
    destructionImpact,
  );

  return {
    physicalImpact: physicalLevel,
    physicalImpactDerivedFrom: derivedFrom,
    physicalImpactDirect: physicalDirect,
    aggregatedImpact: aggregated,
    safetyOverrideActive:
      physicalLevel === "fatality" || physicalLevel === "irreversible_injury",
    highValueOverrideActive: !!isHighValue && destructionImpact === "critical",
  };
}