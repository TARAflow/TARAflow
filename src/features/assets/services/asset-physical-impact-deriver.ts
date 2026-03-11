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
import type { DFDElementLink } from "../models/dfd-reference-types";

// ==================== TYPES ====================

export type PhysicalImpactLevel = "LOW" | "MED" | "HIGH";

export type AggregatedImpact = "LOW" | "MED" | "MED+" | "HIGH" | "HIGH+" | "CRITICAL";

/** Numeric rank for comparing impact levels */
const PHYSICAL_RANK: Record<PhysicalImpactLevel, number> = {
  LOW: 0,
  MED: 1,
  HIGH: 2,
};

/** Business impact from overallImpact (1–4 numeric scale → qualitative) */
export type BusinessImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

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
export function derivePhysicalImpact(
  linkedElements: DFDElementLink[],
): { level: PhysicalImpactLevel; derivedFrom: string[] } {
  let maxLevel: PhysicalImpactLevel = "LOW";
  const derivedFrom: string[] = [];

  for (const link of linkedElements) {
    const safety = link.safety;
    if (!safety || safety.relevance === "none") continue;

    let level: PhysicalImpactLevel = "LOW";

    if (
      safety.impact === "fatality" ||
      safety.impact === "irreversible_injury"
    ) {
      level = "HIGH";
    } else if (safety.relevance === "indirect") {
      level = "MED";
    } else if (safety.relevance === "direct") {
      // direct + reversible_injury or no impact specified → MED
      level = "MED";
    }

    if (PHYSICAL_RANK[level] > PHYSICAL_RANK[maxLevel]) {
      maxLevel = level;
    }

    if (level !== "LOW") {
      derivedFrom.push(
        `${link.elementName} → ${link.relationType ?? "?"}` +
        (safety.impact ? ` (${safety.impact})` : "") +
        ` [${safety.relevance}]`,
      );
    }
  }

  return { level: maxLevel, derivedFrom };
}

/**
 * Returns the effective physicalImpact for an asset,
 * respecting the manual override if set.
 */
export function effectivePhysicalImpact(asset: Asset): PhysicalImpactLevel {
  if (asset.physicalImpactSource === "manual" && asset.physicalImpact) {
    // Manual override — map CRITICAL to HIGH for internal use
    // (CRITICAL only exists on aggregatedImpact, not physicalImpact)
    return asset.physicalImpact as PhysicalImpactLevel;
  }
  return derivePhysicalImpact(asset.linkedDFDElements).level;
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

/**
 * Derive aggregatedImpact from physicalImpact × businessImpact.
 *
 * Aggregationsmatrix (§4.0):
 *
 * physicalImpact HIGH + relevance direct   → CRITICAL  (Safety Override)
 * physicalImpact HIGH + relevance indirect → HIGH+
 * businessImpact CRITICAL                  → CRITICAL
 * businessImpact HIGH   + physical MED     → HIGH
 * businessImpact HIGH                      → HIGH
 * businessImpact MEDIUM + physical MED     → MED+
 * businessImpact MEDIUM                    → MED
 * businessImpact LOW    + physical MED     → MED   (uplift by indirect safety)
 * businessImpact LOW                       → LOW
 *
 * High-Value Override (additional rule):
 *   isHighValueAsset AND assetDestructionImpact === "critical" → CRITICAL
 *
 * @param physicalLevel  - from derivePhysicalImpact / effectivePhysicalImpact
 * @param physicalDirect - true if ANY relation has relevance:"direct" with HIGH impact
 * @param businessLevel  - from overallImpactToBusinessLevel(asset.overallImpact)
 * @param isHighValueAsset         - asset.properties?.isHighValueAsset
 * @param assetDestructionImpact   - asset.properties?.assetDestructionImpact
 */
export function deriveAggregatedImpact(
  physicalLevel: PhysicalImpactLevel,
  physicalDirect: boolean,
  businessLevel: BusinessImpactLevel,
  isHighValueAsset?: boolean,
  assetDestructionImpact?: string,
): AggregatedImpact {
  // ── High-Value Override ────────────────────────────────────────
  // Infrastructure assets whose destruction is critical → CRITICAL
  // regardless of safety or business impact
  if (isHighValueAsset && assetDestructionImpact === "critical") {
    return "CRITICAL";
  }

  // ── Safety Override Rule ───────────────────────────────────────
  // physicalImpact HIGH = fatality OR irreversible_injury
  if (physicalLevel === "HIGH") {
    return physicalDirect ? "CRITICAL" : "HIGH+";
  }

  // ── Normal Aggregation Matrix ──────────────────────────────────
  const hasMedPhysical = physicalLevel === "MED";

  switch (businessLevel) {
    case "CRITICAL":
      return "CRITICAL";

    case "HIGH":
      return "HIGH";  // MED physical adds no uplift beyond HIGH already

    case "MEDIUM":
      return hasMedPhysical ? "MED+" : "MED";

    case "LOW":
      return hasMedPhysical ? "MED" : "LOW";  // indirect safety uplifts LOW → MED
  }
}

// ==================== CONVENIENCE: FULL DERIVATION ====================

export interface PhysicalImpactDerivationResult {
  physicalImpact: PhysicalImpactLevel;
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
export function deriveAllImpacts(
  asset: Asset,
): PhysicalImpactDerivationResult {
  // Step 1 — physical impact
  let physicalLevel: PhysicalImpactLevel;
  let derivedFrom: string[];
  let physicalDirect: boolean;

  if (asset.physicalImpactSource === "manual" && asset.physicalImpact) {
    physicalLevel = asset.physicalImpact as PhysicalImpactLevel;
    derivedFrom = [`[manual] ${asset.physicalImpactRationale ?? ""}`];
    // For aggregation, treat manual HIGH as direct (conservative)
    physicalDirect = physicalLevel === "HIGH";
  } else {
    const result = derivePhysicalImpact(asset.linkedDFDElements);
    physicalLevel = result.level;
    derivedFrom = result.derivedFrom;
    // Check if any relation is direct with HIGH impact
    physicalDirect = asset.linkedDFDElements.some(
      (l) =>
        l.safety?.relevance === "direct" &&
        (l.safety.impact === "fatality" ||
          l.safety.impact === "irreversible_injury"),
    );
  }

  // Step 2 — business level from stored overallImpact
  const businessLevel = overallImpactToBusinessLevel(asset.overallImpact);

  // Step 3 — aggregated
  const isHighValue = asset.properties?.isHighValueAsset ?? false;
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
    safetyOverrideActive: physicalLevel === "HIGH",
    highValueOverrideActive:
      isHighValue && destructionImpact === "critical",
  };
}