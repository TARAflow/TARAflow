// app/utils/resolve-asset-physical-impact.ts
//
// Resolves an asset's effective physical (safety) impact from its two
// modelling paths — the HazardItem bowtie and the SafetyAnnotation on the
// asset's DFD relations — plus the analyst's manual override.
//
// Rules:
//   1. manual      — analyst override (physicalImpactSource === "manual") wins,
//                    with audit rationale. A deliberate, documented decision.
//   2. worst-of    — otherwise the WORSE of
//                      hazard:     cause-side severity from the HazardItem chain
//                      annotation: worst SafetyAnnotation on linkedDFDElements
//                    Ties go to the hazard (richer audit trail).
//
// Both paths present for one asset is a modelling smell (double bookkeeping);
// the resolver flags it as `conflict` and the asset validator reports a
// warning. Worst-of guarantees that ignoring the warning never under-rates
// safety. The stricter follow-up (annotations read-only once the asset is a
// hazard cause, "convert to Hazard Item") is documented in
// doc/taraflow-asset-beziehungen.md, "Zwei Modellierungspfade".
//
// This resolves the LEVEL only. Whether the level triggers the Safety Override
// Rule (→ CRITICAL) additionally requires relevance === "direct" — see
// isSafetyCritical() in shared/models/safety-types.ts and the stored committer
// commit-hazard-safety.ts.

import {
  safetyImpactRank,
  type SafetyImpact,
  type ValueSource,
} from "shared/models/safety-types";
import type { AssetHazardSummary } from "shared/models/asset-hazard-reference-types"; // or barrel: "shared"
import type { DFDElementLink } from "features/assets/models/dfd-asset-link-types";
import { derivePhysicalImpact } from "features/assets/services/asset-physical-impact-deriver";

/** Provenance of the resolved level — richer than ValueSource (adds "hazard"). */
export type PhysicalImpactSource = "manual" | "hazard" | "annotation";

export interface ResolvedPhysicalImpact {
  level?: SafetyImpact;
  source?: PhysicalImpactSource;
  /** true when hazard chain AND annotation both rate this asset. */
  conflict?: boolean;
}

export interface ResolvablePhysicalImpactAsset {
  physicalImpact?: SafetyImpact;
  physicalImpactSource?: ValueSource | "hazard";
  /** Source of the annotation level. Absent → stored non-hazard value. */
  linkedDFDElements?: readonly DFDElementLink[];
}

/**
 * Annotation-derived level of an asset. Derived fresh from the DFD links when
 * given (the stored physicalImpact may hold a hazard-written value); else the
 * stored value, unless it was written by the hazard chain.
 */
export function annotationPhysicalImpact(
  asset: ResolvablePhysicalImpactAsset,
): SafetyImpact | undefined {
  if (asset.linkedDFDElements) {
    return derivePhysicalImpact([...asset.linkedDFDElements]).level;
  }
  if (asset.physicalImpactSource === "hazard") return undefined;
  return asset.physicalImpact;
}

export function resolveAssetPhysicalImpact(
  asset: ResolvablePhysicalImpactAsset,
  hazard?: AssetHazardSummary,
): ResolvedPhysicalImpact {
  // 1. Manual override always wins.
  if (asset.physicalImpactSource === "manual" && asset.physicalImpact) {
    return { level: asset.physicalImpact, source: "manual" };
  }

  // 2. Worst of hazard chain (cause side only — a pure protection target has
  //    no causeSeverity → no attack-surface rating) and annotation.
  const hz = hazard?.causeSeverity;
  const fromHazard = hz && hz !== "none" ? hz : undefined;
  const ann = annotationPhysicalImpact(asset);
  const fromAnnotation = ann && ann !== "none" ? ann : undefined;

  if (fromHazard && fromAnnotation) {
    return safetyImpactRank(fromAnnotation) > safetyImpactRank(fromHazard)
      ? { level: fromAnnotation, source: "annotation", conflict: true }
      : { level: fromHazard, source: "hazard", conflict: true };
  }
  if (fromHazard) return { level: fromHazard, source: "hazard" };
  if (fromAnnotation) return { level: fromAnnotation, source: "annotation" };

  return {};
}
