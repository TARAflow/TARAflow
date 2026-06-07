// features/hazards/services/eligible-assets-service.ts
//
// eligibleAssets(assets, role) — which existing assets may sit on each side of
// a Hazard Item, driving the Bowtie autocompletes:
//   - "contributor" (contributes_to, left side): allowed source categories
//   - "target"      (endangers, right side)    : protection-target categories
//
// Allowed categories per IMPLEMENTATION-hazard-item.md change 7. Consumes the
// shared AssetReference snapshot (Dependency Inversion) so the Hazard slice
// never imports the Assets feature.
//
// NOTE: "environment" as an asset group is introduced by Phase-1 change 2.
// Until the AssetGroup union carries it, environment targets simply will not
// appear in results — no runtime error, the filter is string-based.

import type { AssetReference } from "shared";

export type HazardRelationRole = "contributor" | "target";

/** Asset groups allowed as a contributes_to source (left side of the Bowtie). */
export const HAZARD_CONTRIBUTOR_GROUPS: readonly string[] = [
  "data",
  "function",
  "process",
  "system",
  "physical",
  "infrastructure",
];

/** Asset groups allowed as an endangers target (right side of the Bowtie). */
export const HAZARD_TARGET_GROUPS: readonly string[] = [
  "human",
  "environment",
  "infrastructure",
];

/** Filters the asset snapshot to those eligible for the given Bowtie side. */
export function eligibleAssets(
  assets: readonly AssetReference[],
  role: HazardRelationRole,
): AssetReference[] {
  const allowed =
    role === "contributor" ? HAZARD_CONTRIBUTOR_GROUPS : HAZARD_TARGET_GROUPS;
  return assets.filter((a) => allowed.includes(a.assetGroup));
}

/**
 * Maps an asset group to the HazardImpact target discriminator.
 * Only meaningful for endangers targets; returns undefined for non-target
 * groups so callers can detect a mismatch instead of guessing a scale.
 */
export function targetKindForAssetGroup(
  assetGroup: string,
): "human" | "environment" | "infrastructure" | undefined {
  if (assetGroup === "human") return "human";
  if (assetGroup === "environment") return "environment";
  if (assetGroup === "infrastructure") return "infrastructure";
  return undefined;
}
