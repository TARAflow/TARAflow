// app/utils/commit-hazard-safety.ts
//
// Stored committer for the HazardItem safety chain. For every CAUSE asset
// (it contributes_to a hazard) it writes:
//   physicalImpact       = worst severity inherited from its hazards (cause side)
//   physicalImpactSource = "hazard"
//   physicalImpactRationale = audit trail (which hazard, relevance)
//   aggregatedImpact     = recomputed via the canonical deriveAggregatedImpact,
//                          applying the Safety Override using the cause directness
//                          (a contributes_to with relevance === "direct").
//
// Pure protection targets (endangered but not a cause) are NOT rated here — a
// human is a consequence, not an attack surface. They stay flagged via the
// projection (isHazardTarget + worstSeverity) for display and EN 50742 docs.
//
// Precedence (via resolveAssetPhysicalImpact): manual > hazard > annotation.
// Manual and annotation assets are left to the normal derivation pipeline.
//
// Runs in the project chokepoint AFTER commitAssetSync, on hazard OR asset change
// (reference-guarded, so a no-op is cheap). Pure — no timestamp churn, so golden
// snapshots stay deterministic.

import type { Asset, AssetData } from "features/assets";
import {
  deriveAllImpacts,
  deriveAggregatedImpact,
  overallImpactToBusinessLevel,
  type PhysicalImpactLevel,
} from "features/assets/services/asset-physical-impact-deriver";
import type { AssetHazardSummary } from "shared/models/asset-hazard-reference-types";
import { resolveAssetPhysicalImpact } from "./resolve-asset-physical-impact";

/** Audit rationale: the contributes_to edge(s) at the worst cause severity. */
function hazardRationale(summary: AssetHazardSummary): string {
  const sev = summary.causeSeverity;
  const parts = summary.contributesTo
    .filter((l) => l.severity === sev)
    .map((l) => `contributes [${l.relevance ?? "?"}] to "${l.label}" (${sev})`);
  return `Derived from HazardItem chain: ${parts.join("; ")}`;
}

/**
 * Returns the asset with hazard-derived safety values applied, or the SAME
 * reference when nothing changes (enables a cheap reference-guard upstream).
 */
export function applyHazardSafetyToAsset(
  asset: Asset,
  summary: AssetHazardSummary | undefined,
): Asset {
  const resolved = resolveAssetPhysicalImpact(
    {
      physicalImpact: asset.physicalImpact,
      // resolver only distinguishes "manual"; map hazard/derived alike.
      physicalImpactSource:
        asset.physicalImpactSource === "manual" ? "manual" : "derived",
    },
    summary,
  );

  // ── Hazard governs this asset (cause side only) ─────────────────────────
  if (resolved.source === "hazard" && resolved.level && summary?.causeSeverity) {
    const level = resolved.level as PhysicalImpactLevel;
    const physicalDirect = !!summary.causeDirect;
    const businessLevel = overallImpactToBusinessLevel(asset.overallImpact);
    const aggregatedImpact = deriveAggregatedImpact(
      level,
      physicalDirect,
      businessLevel,
      asset.properties?.isHighValueAsset,
      asset.properties?.assetDestructionImpact,
    );
    const rationale = hazardRationale(summary);

    if (
      asset.physicalImpact === level &&
      asset.physicalImpactSource === "hazard" &&
      asset.aggregatedImpact === aggregatedImpact &&
      asset.physicalImpactRationale === rationale
    ) {
      return asset; // already up to date
    }

    return {
      ...asset,
      physicalImpact: level as Asset["physicalImpact"],
      physicalImpactSource: "hazard",
      physicalImpactRationale: rationale,
      aggregatedImpact,
    };
  }

  // ── Revert: was hazard-sourced, but the hazard is gone ──────────────────
  // Hand the asset back to the annotation-derived pipeline.
  if (asset.physicalImpactSource === "hazard") {
    const reverted = deriveAllImpacts({
      ...asset,
      physicalImpactSource: "derived",
      physicalImpact: undefined,
      physicalImpactRationale: undefined,
    });
    return {
      ...asset,
      physicalImpact: reverted.physicalImpact as Asset["physicalImpact"],
      physicalImpactSource: reverted.physicalImpact ? "derived" : undefined,
      physicalImpactRationale: undefined,
      aggregatedImpact: reverted.aggregatedImpact,
    };
  }

  // ── Manual / annotation / uninvolved — not our concern ──────────────────
  return asset;
}

/**
 * Apply the hazard safety chain across all assets. Returns the SAME AssetData
 * reference when nothing changed.
 */
export function commitHazardSafety(
  assetData: AssetData | null | undefined,
  hazardSummaries: Record<string, AssetHazardSummary>,
): AssetData | null | undefined {
  if (!assetData?.assets?.length) return assetData;

  let changed = false;
  const assets = assetData.assets.map((a) => {
    const next = applyHazardSafetyToAsset(a, hazardSummaries[a.id]);
    if (next !== a) changed = true;
    return next;
  });

  return changed ? { ...assetData, assets } : assetData;
}