// app/utils/resolve-asset-physical-impact.ts
//
// Resolves an asset's effective physical (safety) impact under the current
// model, where the HazardItem bowtie is the primary source and the legacy DFD
// SafetyAnnotation is a fallback.
//
// Precedence (highest wins):
//   1. manual    — analyst override (physicalImpactSource === "manual"), audit rationale.
//   2. hazard    — worst severity from the HazardItem bowtie (endangers / inherited cause).
//   3. annotation — whatever the legacy SafetyAnnotation already derived onto the asset.
//
// NOTE (safety policy): manual wins even over a worse hazard severity, matching
// the existing "manual override" semantics. If the project requires that safety
// is never under-rated, change rule 1 to keep the WORST of {manual, hazard}.
// That is a deliberate safety-policy decision — left to the analyst/standard.
//
// This resolves the LEVEL only. Whether the level triggers the Safety Override
// Rule (→ CRITICAL) additionally requires relevance === "direct" — see
// isSafetyCritical() in shared/models/safety-types.ts. The stored committer that
// recomputes aggregatedImpact applies that rule using the contributes_to
// relevance carried on AssetHazardLink.

import type { SafetyImpact, ValueSource } from "shared/models/safety-types";
import type { AssetHazardSummary } from "shared/models/asset-hazard-reference-types"; // or barrel: "shared"

/** Provenance of the resolved level — richer than ValueSource (adds "hazard"). */
export type PhysicalImpactSource = "manual" | "hazard" | "annotation";

export interface ResolvedPhysicalImpact {
  level?: SafetyImpact;
  source?: PhysicalImpactSource;
}

export function resolveAssetPhysicalImpact(
  asset: {
    physicalImpact?: SafetyImpact;
    physicalImpactSource?: ValueSource | "hazard";
  },
  hazard?: AssetHazardSummary,
): ResolvedPhysicalImpact {
  // 1. Manual override always wins.
  if (asset.physicalImpactSource === "manual" && asset.physicalImpact) {
    return { level: asset.physicalImpact, source: "manual" };
  }

  // 2. HazardItem chain — only the CAUSE side rates the asset as an attack
  //    surface (a pure protection target has no causeSeverity → no override).
  const hz = hazard?.causeSeverity;
  if (hz && hz !== "none") return { level: hz, source: "hazard" };

  // 3. Legacy SafetyAnnotation-derived value already on the asset.
  if (asset.physicalImpact) {
    return { level: asset.physicalImpact, source: "annotation" };
  }

  return {};
}