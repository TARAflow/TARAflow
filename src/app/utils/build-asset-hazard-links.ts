// app/utils/build-asset-hazard-links.ts
//
// Phase 3 of the Asset-Store SoT refactor (asset-store-ssot-refactor-v2.md, §6).
//
// Projects the hazard graph into a per-asset summary the assets feature can
// render, without features/assets importing features/hazards. Pure; the app
// layer wires it in (analogous to memoizedAssetDataRef).
//
// Edge directions (verified against fixtures):
//   endangers:      from = hazardId → to = assetId   (asset is target)
//   contributes_to: from = assetId  → to = hazardId  (asset is cause)

import type { HazardData } from "features/hazards";
import {
  worseSafetyImpact,
  type SafetyImpact,
  type SafetyRelevance,
} from "shared/models/safety-types";
import type {
  AssetHazardLink,
  AssetHazardSummary,
} from "shared/models/asset-hazard-reference-types"; // or barrel: "shared"
import type { HazardImpact } from "shared/models/hazard-impact";

// Severity ranking follows the canonical SafetyImpact order (safety-types.ts).
// The hazards domain emits the same scale on human endangers edges.
const worse = worseSafetyImpact<SafetyImpact | undefined>;

/**
 * Person-harm severity of an endangers edge. Environment / infrastructure
 * impacts use their own scales and carry no person-harm severity.
 */
function humanSeverity(impact: HazardImpact | undefined): SafetyImpact | undefined {
  return impact?.target === "human" ? impact.severity : undefined;
}

export function buildAssetHazardLinks(
  hazards: HazardData | null | undefined,
): Record<string, AssetHazardSummary> {
  const byAsset: Record<string, AssetHazardSummary> = {};
  if (!hazards) return byAsset;

  const itemsById = new Map(hazards.hazards.map((h) => [h.id, h]));

  const ensure = (assetId: string): AssetHazardSummary => {
    if (!byAsset[assetId]) {
      byAsset[assetId] = {
        endangeredBy: [],
        contributesTo: [],
        worstSeverity: undefined,
        isHazardTarget: false,
      };
    }
    return byAsset[assetId];
  };

  // Pass 1 — worst endangers severity per hazard. A cause asset inherits this
  // (bowtie: a robot arm contributing to a fatal collision inherits "fatal").
  const hazardWorstSeverity: Record<string, SafetyImpact | undefined> = {};
  for (const rel of hazards.relations) {
    if (rel.type === "endangers") {
      hazardWorstSeverity[rel.from] = worse(
        hazardWorstSeverity[rel.from],
        humanSeverity(rel.impact),
      );
    }
  }

  // Pass 2 — build per-asset links.
  for (const rel of hazards.relations) {
    if (rel.type === "endangers") {
      const item = itemsById.get(rel.from);
      const severity = humanSeverity(rel.impact);
      const link: AssetHazardLink = {
        hazardId: rel.from,
        externalRef: item?.externalRef,
        label: item?.label ?? rel.from,
        role: "endangered",
        severity,
      };
      const summary = ensure(rel.to);
      summary.endangeredBy.push(link);
      summary.isHazardTarget = true;
      summary.worstSeverity = worse(summary.worstSeverity, severity);
    } else if (rel.type === "contributes_to") {
      const item = itemsById.get(rel.to);
      const inherited = hazardWorstSeverity[rel.to];
      const link: AssetHazardLink = {
        hazardId: rel.to,
        externalRef: item?.externalRef,
        label: item?.label ?? rel.to,
        role: "cause",
        severity: inherited,
        relevance: rel.relevance as SafetyRelevance | undefined,
      };
      const summary = ensure(rel.from);
      summary.contributesTo.push(link);
      summary.worstSeverity = worse(summary.worstSeverity, inherited);
    }
  }

  // Derive the cause-side (attack-surface) severity + directness per asset.
  // Pure protection targets (endangered only) get no causeSeverity → no override.
  for (const summary of Object.values(byAsset)) {
    let causeSeverity: SafetyImpact | undefined;
    for (const l of summary.contributesTo) {
      causeSeverity = worse(causeSeverity, l.severity);
    }
    summary.causeSeverity = causeSeverity;
    summary.causeDirect =
      causeSeverity !== undefined &&
      summary.contributesTo.some(
        (l) => l.severity === causeSeverity && l.relevance === "direct",
      );
  }

  return byAsset;
}