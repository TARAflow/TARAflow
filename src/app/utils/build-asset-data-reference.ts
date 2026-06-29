// ==================== BUILD ASSET DATA REFERENCE ====================
// App-layer read-model builder.
//
// Produces the AssetDataReference consumed by the Threat and Risk features.
// This is NOT a subset projection of Asset: it fuses asset fields with
// hazard-chain data (isHazardTarget, hazardSeverity, resolved physicalImpact)
// so that downstream features depend on neither features/assets nor
// features/hazards.
//
// That cross-feature fusion is exactly why this lives in the app layer — the
// only layer that holds both the asset store and the hazard chain. It must NOT
// move into shared (would need hazard data shared deliberately lacks) nor into
// a feature (would couple assets to hazards).

import type { Asset } from "features/assets";
import {
  type AssetReference,
  type AssetDataReference,
  hasSafetyData,
} from "shared";
import { buildAssetHazardLinks } from "./build-asset-hazard-links";
import { resolveAssetPhysicalImpact } from "./resolve-asset-physical-impact";

type AssetHazardLinks = ReturnType<typeof buildAssetHazardLinks>;

/**
 * Build the enriched AssetDataReference from the asset store plus the
 * hazard→asset projection.
 *
 * @param assets       The current asset store (project.assets.assets).
 * @param hazardLinks  Output of buildAssetHazardLinks(project.hazards).
 * @param impactScale  Asset Tab impact scale (defaults applied by caller).
 */
export function buildAssetDataReference(
  assets: Asset[],
  hazardLinks: AssetHazardLinks,
  impactScale: "3-level" | "4-level" | "5-level",
): AssetDataReference {
  const assetRefs: AssetReference[] = assets.map((a) => ({
    id: a.id,
    name: a.name,
    assetGroup: a.assetGroup,
    aggregatedImpact: a.aggregatedImpact,
    // Effective physical impact: manual > HazardItem chain > legacy annotation.
    // Resolver returns SafetyImpact ("none" guarded out); narrow to the ref type.
    physicalImpact: resolveAssetPhysicalImpact(a, hazardLinks[a.id])
      .level as typeof a.physicalImpact,
    isHighValueAsset: a.properties?.isHighValueAsset,
    hasSafetyAnnotation:
      a.linkedDFDElements?.some(
        (el) => (el as any).safety && (el as any).safety.relevance !== "none",
      ) ?? false,
    // HazardItem chain — the current safety model. A physical asset
    // contributes_to a hazard that endangers a human/environment target; the
    // target's worst endangers severity is its safety signal. SafetyAnnotation
    // (above) is legacy / override.
    isHazardTarget: hazardLinks[a.id]?.isHazardTarget ?? false,
    hazardSeverity: hazardLinks[a.id]?.worstSeverity as
      | "reversible_injury"
      | "irreversible_injury"
      | "fatality"
      | undefined,
    linkedElementIds: a.linkedDFDElements?.map((el) => el.elementId) ?? [],
    securityGoals:
      a.securityGoals
        ?.filter((g) => g.level !== "none")
        .map((g) => ({ type: g.type, level: g.level })) ?? [],
    impactRatings:
      a.impactRatings?.map((r) => ({
        criterionId: r.criterionId,
        value: r.value,
      })) ?? [],
  }));

  return {
    assets: assetRefs,
    // Canonical safety definition — the same predicate Threat/Risk use
    // downstream. The previous inline check in workspace-layout omitted the
    // safety-impactRating case (a narrower, divergent definition); routing
    // through hasSafetyData unifies it and removes that silent drift.
    hasSafetyAssets: hasSafetyData(assetRefs),
    impactScale,
  };
}