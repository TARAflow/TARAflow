// ==================== THREAT ASSET UTILITIES ====================
// Shared helpers for asset-enriched threat display.
// Used by ElementThreatTable and InteractionThreatTable.

import type { AssetDataReference, AssetReference } from "shared";
import type { Threat } from "../models/threat-types";

// ==================== COLOR MAPS ====================

export const IMPACT_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  "HIGH+": "#ea580c",
  HIGH: "#f97316",
  "MED+": "#ca8a04",
  MED: "#eab308",
  LOW: "#16a34a",
};

export function getImpactColor(impact?: string): string {
  return impact ? (IMPACT_COLORS[impact] ?? "#6b7280") : "#6b7280";
}

export function getPhysicalImpactColor(impact?: string): string {
  if (impact === "fatality") return "#dc2626";
  if (impact === "irreversible_injury") return "#f97316";
  if (impact === "reversible_injury") return "#eab308";
  return "#6b7280";
}

// ==================== PRIORITY ====================

/**
 * Returns a sort priority for a threat based on linked asset criticality.
 * Lower value = higher priority.
 *
 * 0 — Safety direct + CRITICAL
 * 1 — CRITICAL (no safety or safety indirect)
 * 2 — Safety direct (fatality / irreversible_injury)
 * 3 — HIGH / HIGH+
 * 4 — MED+ / MED
 * 5 — LOW or no linked assets
 */
export function getThreatPriority(
  threat: Threat,
  assetDataRef?: AssetDataReference,
): number {
  if (!assetDataRef || threat.linkedAssetIds.length === 0) return 5;

  const linked = threat.linkedAssetIds
    .map((id) => assetDataRef.assets.find((a) => a.id === id))
    .filter((a): a is AssetReference => Boolean(a));

  const hasCritical = linked.some((a) => a.aggregatedImpact === "CRITICAL");
  const hasSafetyDirect = linked.some(
    (a) =>
      a.physicalImpact === "fatality" ||
      a.physicalImpact === "irreversible_injury",
  );
  const hasHigh = linked.some(
    (a) => a.aggregatedImpact === "HIGH" || a.aggregatedImpact === "HIGH+",
  );
  const hasMed = linked.some(
    (a) => a.aggregatedImpact === "MED" || a.aggregatedImpact === "MED+",
  );

  if (hasSafetyDirect && hasCritical) return 0;
  if (hasCritical) return 1;
  if (hasSafetyDirect) return 2;
  if (hasHigh) return 3;
  if (hasMed) return 4;
  return 5;
}

/**
 * Sort a list of threats by asset-based priority (in-place safe — returns new array).
 */
export function sortThreatsByPriority(
  threats: Threat[],
  assetDataRef?: AssetDataReference,
): Threat[] {
  if (!assetDataRef) return threats;
  return [...threats].sort(
    (a, b) =>
      getThreatPriority(a, assetDataRef) - getThreatPriority(b, assetDataRef),
  );
}
