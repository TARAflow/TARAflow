// ==================== THREAT ↔ GOAL CROSS-CHECKS ====================
//
// Security-goal rework, Phase 6 (design doc §4.4, §4.3 step 5). Two checks
// between the security goals of the assets and the threats linked to them:
//
//   THREAT_WITHOUT_GOAL (warning) — a threat linked to assets violates no
//     active goal on any of them. Its risk impact falls back to the asset
//     values (step 5): either a goal is missing, or the threat does not
//     belong to these assets. Reported per asset × STRIDE category, so many
//     threats do not drown the panel.
//   GOAL_WITHOUT_THREAT (info) — an active goal that no threat violates. The
//     goal may be unnecessary, or a threat is missing. Legitimate early in a
//     TARA, hence info.
//
// "Violates" is ONE definition shared with the risk impact (violatesGoal in
// shared/utils/threat-impact.ts). The threats come as a projection from the
// app layer (ThreatGoalLink — dismissed threats already left out); the goals
// are the asset feature's own working copy, so findings follow edits before
// they are saved. Without any threat there is nothing to cross-check.
//
// Pure: no React, no project state.

import type { StrideCategory, ThreatGoalLink } from "shared";
import { goalTypesFor, violatesGoal } from "shared";
import type { Asset } from "../models/asset-types";
import type { SecurityGoalType } from "../models/asset-security-goals-types";

export type ThreatGoalFindingCode = "THREAT_WITHOUT_GOAL" | "GOAL_WITHOUT_THREAT";

export interface ThreatGoalFinding {
  code: ThreatGoalFindingCode;
  severity: "warning" | "info";
  assetId: string;
  /** THREAT_WITHOUT_GOAL: first goal type the category would need (card to open). */
  goal: SecurityGoalType;
  /** THREAT_WITHOUT_GOAL only. */
  strideCategory?: StrideCategory;
  /** THREAT_WITHOUT_GOAL: the threats concerned. */
  threats: ThreatGoalLink[];
}

/**
 * Threats linked to the asset that violate goal `type` if it is active — the
 * back-reference of the goal card ("N threats violate this goal").
 */
export function threatsForGoal(
  assetId: string,
  type: SecurityGoalType,
  links: readonly ThreatGoalLink[],
): ThreatGoalLink[] {
  return links.filter(
    (l) => l.linkedAssetIds.includes(assetId) && goalTypesFor(l.strideCategory).includes(type),
  );
}

const STRIDE_ORDER: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];

export function threatGoalFindings(
  assets: readonly Asset[],
  links: readonly ThreatGoalLink[],
): ThreatGoalFinding[] {
  if (links.length === 0) return [];
  const byId = new Map(assets.map((a) => [a.id, a]));
  const out: ThreatGoalFinding[] = [];

  // THREAT_WITHOUT_GOAL, grouped per asset × STRIDE category.
  const unmatched = new Map<string, Map<StrideCategory, ThreatGoalLink[]>>();
  for (const link of links) {
    const linked = link.linkedAssetIds
      .map((id) => byId.get(id))
      .filter((a): a is Asset => !!a);
    if (linked.length === 0) continue; // not linked to an asset — not this check
    const matched = linked.some((a) =>
      (a.securityGoals ?? []).some((g) => violatesGoal(g, link.strideCategory)),
    );
    if (matched) continue;
    for (const a of linked) {
      const perStride = unmatched.get(a.id) ?? new Map<StrideCategory, ThreatGoalLink[]>();
      perStride.set(link.strideCategory, [...(perStride.get(link.strideCategory) ?? []), link]);
      unmatched.set(a.id, perStride);
    }
  }

  for (const asset of assets) {
    const perStride = unmatched.get(asset.id);
    for (const stride of STRIDE_ORDER) {
      const threats = perStride?.get(stride);
      if (!threats) continue;
      out.push({
        code: "THREAT_WITHOUT_GOAL",
        severity: "warning",
        assetId: asset.id,
        goal: goalTypesFor(stride)[0],
        strideCategory: stride,
        threats,
      });
    }
    // GOAL_WITHOUT_THREAT
    for (const goal of asset.securityGoals ?? []) {
      if (goal.level === "none") continue;
      if (threatsForGoal(asset.id, goal.type, links).length > 0) continue;
      out.push({
        code: "GOAL_WITHOUT_THREAT",
        severity: "info",
        assetId: asset.id,
        goal: goal.type,
        threats: [],
      });
    }
  }
  return out;
}
