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
  isIrreversibleOrWorse,
  isOverrideSeverity,
  safetyImpactRank,
  safetySeverityToFactor,
  type SafetySeverity,
} from "shared";

// ==================== TYPES ====================

// Severity levels — the canonical SafetySeverity scale (shared/models/safety-types.ts).
// undefined = no safety annotation present → shows "–" in asset table
export type PhysicalImpactLevel = SafetySeverity;

export type AggregatedImpact = "LOW" | "MED" | "MED+" | "HIGH" | "HIGH+" | "CRITICAL";

/** Business impact from overallImpact (1–4 numeric scale → qualitative) */
export type BusinessImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";


// ==================== SAFETY RATING MAPPER ====================

/**
 * Map PhysicalImpactLevel → fixed 4-level safety factor (IEC 62061 Se1–Se4),
 * stored as the "safety" ImpactRating.value. irreversible_major and fatal
 * share Se4 — the categorical physicalImpact keeps the distinction.
 */
export function physicalLevelToSafetyRating(
  level: PhysicalImpactLevel | undefined,
): number | null {
  return level ? safetySeverityToFactor(level) : null;
}

// ==================== STEP 1: PHYSICAL IMPACT ====================

/**
 * Severity a single SafetyAnnotation contributes. relevance set but no
 * explicit impact → reversible_major (conservative worst reversible level).
 */
function annotationLevel(
  safety: DFDElementLink["safety"],
): PhysicalImpactLevel | undefined {
  if (!safety || safety.relevance === "none") return undefined;
  if (safety.impact && safety.impact !== "none") return safety.impact;
  return "reversible_major";
}

/**
 * Derive physicalImpact from SafetyAnnotation summaries on linkedDFDElements.
 *
 * Each annotated relation is an independent single cause (ANY semantics):
 * MAX wins across all relations on the asset. Combinatorial (ALL) hazards
 * cannot be expressed by annotations — they need a Hazard Item.
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
    const level = annotationLevel(safety);
    if (!level || !safety) continue;

    if (safetyImpactRank(level) > safetyImpactRank(maxLevel)) {
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
 * Whether the physical impact is reached DIRECTLY (relevance 'direct'), which
 * selects the upper tier in deriveAggregatedImpact.
 *
 *   manual  → conservative: irreversible or worse counts as direct
 *   derived → a 'direct' annotation reaches the asset's worst level
 */
export function isPhysicalImpactDirect(
  level: PhysicalImpactLevel | undefined,
  source: Asset["physicalImpactSource"],
  linkedElements: readonly DFDElementLink[],
): boolean {
  if (!level) return false;
  if (source === "manual") return isIrreversibleOrWorse(level);
  return linkedElements.some(
    (l) =>
      l.safety?.relevance === "direct" &&
      safetyImpactRank(annotationLevel(l.safety)) >= safetyImpactRank(level),
  );
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
  // irreversible_major | fatal → CRITICAL (direct) or HIGH+ (indirect)
  if (isOverrideSeverity(physicalLevel)) {
    return physicalDirect ? "CRITICAL" : "HIGH+";
  }
  // irreversible_minor → HIGH+ (direct) or HIGH (indirect)
  if (physicalLevel === "irreversible_minor") {
    return physicalDirect ? "HIGH+" : "HIGH";
  }
  // reversible_minor | reversible_major → HIGH (direct) or MED+ (indirect)
  if (physicalLevel) {
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
  /** true if the physical level is an override severity (irreversible_major | fatal) */
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
    return {
      physicalImpact: physicalLevel,
      physicalImpactDerivedFrom: [
        `[hazard] ${asset.physicalImpactRationale ?? ""}`,
      ],
      physicalImpactDirect: isIrreversibleOrWorse(physicalLevel),
      aggregatedImpact: asset.aggregatedImpact ?? "LOW",
      safetyOverrideActive: isOverrideSeverity(physicalLevel),
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
    physicalDirect = isPhysicalImpactDirect(
      physicalLevel,
      "manual",
      asset.linkedDFDElements,
    );
  } else {
    const result = derivePhysicalImpact(asset.linkedDFDElements);
    physicalLevel = result.level; // may be undefined
    derivedFrom = result.derivedFrom;
    physicalDirect = isPhysicalImpactDirect(
      physicalLevel,
      "derived",
      asset.linkedDFDElements,
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
    safetyOverrideActive: isOverrideSeverity(physicalLevel),
    highValueOverrideActive: !!isHighValue && destructionImpact === "critical",
  };
}