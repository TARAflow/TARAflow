// ==================== THREAT IMPACT FROM THE VIOLATED GOALS ====================
//
// The impact of a threat belongs to the security goals it violates, not to
// the asset as a whole (security-goal rework design doc §4.3):
//
//   1. goals for STRIDE s via CIANAAA_TO_STRIDE⁻¹ (R → N and Acc)
//   2. per criterion c: MAX over all ACTIVE matching goals of all linked
//      assets of eff(X, g, c) = override(g, c) ?? asset(X, c)
//   3. impact factors from there as before (applyAssetCriteriaToFactorRatings)
//   4. a linked asset without an active matching goal contributes nothing
//   5. no linked asset has an active matching goal → fall back to the asset
//      values (previous behaviour); `matched` is false
//
// resolveThreatImpactAssets() returns asset snapshots whose impactRatings ARE
// the effective values for this threat, so the existing per-factor logic
// (worst criterion, safety priority) runs unchanged on top of it.
//
// Pure; shared so threats and risks use the same definition.

import type { AssetImpactRatingRef, AssetReference } from "../models/asset-reference-types";
import { CIANAAA_TO_STRIDE } from "../models/cianaaa-reference-types";
import type { SecurityGoalType } from "../models/cianaaa-reference-types";
import type { StrideCategory } from "../models/common-types";

/**
 * THE definition of "a threat of STRIDE category s violates goal g": the goal
 * is active (level ≠ none) and maps to s (CIANAAA_TO_STRIDE; R ← N and Acc).
 * Risk impact (below) and the threat ↔ goal cross-checks both use it.
 */
export function violatesGoal(
  goal: { type: SecurityGoalType; level: string },
  strideCategory: StrideCategory,
): boolean {
  return goal.level !== "none" && CIANAAA_TO_STRIDE[goal.type] === strideCategory;
}

/** Goal types a threat of this STRIDE category would violate (R → N, Acc). */
export function goalTypesFor(strideCategory: StrideCategory): SecurityGoalType[] {
  return (Object.keys(CIANAAA_TO_STRIDE) as SecurityGoalType[]).filter(
    (g) => CIANAAA_TO_STRIDE[g] === strideCategory,
  );
}

export interface ThreatImpactAssets {
  /** Assets that carry the threat's impact, with effective ratings. */
  assets: AssetReference[];
  /** false = no linked asset has an active matching goal (fallback, step 5). */
  matched: boolean;
}

function aggregate(values: AssetImpactRatingRef["value"][]): AssetImpactRatingRef["value"] {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length > 0) return Math.max(...nums);
  // null (not rated) and n/a enter no aggregation; keep "na" if that is all there is
  return values.includes("na") ? "na" : null;
}

export function resolveThreatImpactAssets(
  linkedAssets: AssetReference[],
  strideCategory: StrideCategory,
): ThreatImpactAssets {
  const carried: AssetReference[] = [];

  for (const asset of linkedAssets) {
    const goals = (asset.securityGoals ?? []).filter((g) =>
      violatesGoal(g, strideCategory),
    );
    if (goals.length === 0) continue; // step 4

    const impactRatings = (asset.impactRatings ?? []).map((r) => ({
      criterionId: r.criterionId,
      value: aggregate(
        goals.map(
          (g) => g.impactRatings?.find((o) => o.criterionId === r.criterionId)?.value ?? r.value,
        ),
      ),
    }));
    carried.push({ ...asset, impactRatings });
  }

  return carried.length > 0
    ? { assets: carried, matched: true }
    : { assets: linkedAssets, matched: false }; // step 5
}
