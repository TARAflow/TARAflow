// app/utils/commit-iso-risk-values.ts
//
// ISO/SAE 21434 conformance plan 3a (decisions 20 and 22): the risk value 1–5
// of every ISO risk (RQ-15-15/16), computed in the app layer because its
// inputs sit in three features — the damage scenario's impact on the asset
// (goal override before asset), the attack feasibility on the attack tree and
// the iso_* fallback on the risk. Stored as Risk.isoRisk with its inputs.
//
//   impact      — damage scenario = asset × property (before Phase 2): the
//                 highest rated category of the resolved ratings. Safety via
//                 Table F.1 from the categorical severity (physicalImpact),
//                 else from the Se number (4 → severe, ambiguous); a goal's
//                 numeric safety override uses the number rule.
//   feasibility — the path's FeasibilityLevel on the tree (asset-anchored:
//                 the risk's path; threat-anchored: the tree's aggregate =
//                 MAX over paths, 15.8 NOTE 2); else the five iso_* factors.
//   residual    — feasibility after mitigation (residual tree likelihood back
//                 through the runtime Mapping B, or the mitigated iso_*
//                 factors) with the same impact.
//
// Runs in mergeProjectPatch after commitHazardSafety (which derives
// physicalImpact) and before commitCalcStamps; only under iso-21434, only when
// prev is the same project (opening never computes), only when risks, assets,
// attack trees or hazards changed. Migration 9 → 10 calls computeIsoRisks.

import type { Project } from "../models/project-types";
import {
  CIANAAA_TO_STRIDE,
  EMPTY_PROJECT_TAGS,
  migrateProjectTags,
  regulationPresetFromTags,
  type FeasibilityBandLevel,
  type ProjectTags,
  type RiskScaleLevels,
  type SecurityGoalType,
  type StrideCategory,
} from "shared";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import {
  ISO_SAFETY_LEVEL_F1,
  feasibilityFromRiskScaleValue,
  higherImpact,
  isoFeasibilityFromFactors,
  isoImpactFromRating,
  isoRiskValue,
  isoSafetyFromRating,
  type IsoImpactLevel,
  type IsoRisk,
} from "features/risks/models/iso-risk-matrix";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "features/risks/models/risk-factor-types";
import type { Risk } from "features/risks/models/risk-assessment-types";
import {
  CRITERION_TO_CATEGORY,
  resolveImpactRatings,
} from "features/assets/services/asset-impact-resolver";
import type { Asset } from "features/assets/models/asset-types";
import type { AttackTree } from "features/attacktree/models/attacktree-types";

/** STRIDE category → the security goals it violates (inverse of CIANAAA_TO_STRIDE). */
const GOALS_BY_STRIDE: Record<string, SecurityGoalType[]> = Object.entries(
  CIANAAA_TO_STRIDE,
).reduce<Record<string, SecurityGoalType[]>>((acc, [goal, stride]) => {
  (acc[stride] ??= []).push(goal as SecurityGoalType);
  return acc;
}, {});

export function isIsoProject(project: Pick<Project, "info">): boolean {
  const raw = project.info?.tags as unknown;
  const tags: ProjectTags = Array.isArray(raw)
    ? migrateProjectTags(raw as string[])
    : ((raw as ProjectTags | undefined) ?? EMPTY_PROJECT_TAGS);
  return regulationPresetFromTags(tags) === "iso-21434";
}

// ==================== IMPACT ====================

/** Impact level of one damage scenario (asset × property). */
export function isoImpactOfDamageScenario(
  asset: Asset,
  goalType: SecurityGoalType | undefined,
): IsoImpactLevel | undefined {
  const goal = goalType
    ? asset.securityGoals?.find((g) => g.type === goalType)
    : undefined;
  const { ratings } = resolveImpactRatings(asset, goal);
  let level: IsoImpactLevel | undefined;
  for (const r of ratings) {
    const category = CRITERION_TO_CATEGORY[r.criterionId] ?? "other";
    if (category !== "safety") {
      level = higherImpact(level, isoImpactFromRating(r.value));
      continue;
    }
    // Safety: a numeric goal override wins (override before asset), then the
    // categorical severity (Table F.1), then the asset's Se number.
    const override = goal?.impactRatings?.find(
      (o) => o.criterionId === r.criterionId && typeof o.value === "number",
    );
    const safety = override
      ? isoSafetyFromRating(override.value)?.level
      : asset.physicalImpact
        ? ISO_SAFETY_LEVEL_F1[asset.physicalImpact]
        : isoSafetyFromRating(r.value)?.level;
    level = higherImpact(level, safety);
  }
  return level;
}

/** Safety rated 4 by number without a categorical severity: ambiguous. */
export function isSafetyAmbiguous(asset: Asset): boolean {
  if (asset.physicalImpact) return false;
  return (asset.impactRatings ?? []).some(
    (r) =>
      CRITERION_TO_CATEGORY[r.criterionId] === "safety" &&
      !!isoSafetyFromRating(r.value)?.ambiguous,
  );
}

// ==================== ONE RISK ====================

interface IsoContext {
  assetsById: Map<string, Asset>;
  treesById: Map<string, AttackTree>;
  scale: RiskScaleLevels | undefined;
}

function damageScenariosOf(
  risk: Risk,
  ctx: IsoContext,
): { asset: Asset; goal: SecurityGoalType | undefined }[] {
  const tree = risk.attackTreeAssessment?.treeId
    ? ctx.treesById.get(risk.attackTreeAssessment.treeId)
    : undefined;
  if (tree?.anchor.type === "asset" && tree.anchor.assetId) {
    const asset = ctx.assetsById.get(tree.anchor.assetId);
    if (asset) return [{ asset, goal: tree.anchor.securityGoal as SecurityGoalType | undefined }];
  }
  const goals = GOALS_BY_STRIDE[risk.strideCategory as StrideCategory] ?? [undefined];
  return (risk.linkedAssetIds ?? [])
    .map((id) => ctx.assetsById.get(id))
    .filter((a): a is Asset => !!a)
    .flatMap((asset) => goals.map((goal) => ({ asset, goal })));
}

function feasibilityOf(risk: Risk, ctx: IsoContext): FeasibilityBandLevel | undefined {
  const assessment = risk.attackTreeAssessment;
  const tree = assessment?.treeId ? ctx.treesById.get(assessment.treeId) : undefined;
  if (tree?.pathAnalysis) {
    const level = assessment?.pathKey
      ? tree.pathAnalysis.paths.find((p) => p.pathKey === assessment.pathKey)
          ?.feasibilityLevel
      : tree.pathAnalysis.aggregatedFeasibility;
    if (level) return level;
  }
  const treeValue = risk.factorRatings?.find(
    (f) => f.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
  )?.value;
  return (
    feasibilityFromRiskScaleValue(treeValue, ctx.scale) ??
    isoFeasibilityFromFactors(risk.factorRatings)?.feasibility
  );
}

function residualFeasibilityOf(
  risk: Risk,
  ctx: IsoContext,
): FeasibilityBandLevel | undefined {
  const residualTree = risk.mitigatedFactorRatings?.find(
    (f) => f.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
  )?.value;
  return (
    feasibilityFromRiskScaleValue(residualTree, ctx.scale) ??
    isoFeasibilityFromFactors(risk.mitigatedFactorRatings)?.feasibility
  );
}

export function computeIsoRisk(risk: Risk, ctx: IsoContext): IsoRisk | undefined {
  let impact: IsoImpactLevel | undefined;
  for (const ds of damageScenariosOf(risk, ctx)) {
    impact = higherImpact(impact, isoImpactOfDamageScenario(ds.asset, ds.goal));
  }
  const feasibility = feasibilityOf(risk, ctx);
  if (!impact || !feasibility) return undefined;
  const residualFeasibility = residualFeasibilityOf(risk, ctx);
  return {
    impact,
    feasibility,
    value: isoRiskValue(impact, feasibility),
    ...(residualFeasibility
      ? {
          residual: {
            feasibility: residualFeasibility,
            value: isoRiskValue(impact, residualFeasibility),
          },
        }
      : {}),
  };
}

// ==================== PROJECT ====================

const sameIsoRisk = (a: IsoRisk | undefined, b: IsoRisk | undefined) =>
  canonicalStringify(a ?? null) === canonicalStringify(b ?? null);

/**
 * isoRisk of every risk of an ISO project, recomputed from the current data.
 * Returns the SAME project when nothing changes; non-ISO projects unchanged.
 */
export function computeIsoRisks(project: Project): Project {
  if (!project.risks?.risks?.length || !isIsoProject(project)) return project;
  const ctx: IsoContext = {
    assetsById: new Map((project.assets?.assets ?? []).map((a) => [a.id, a])),
    treesById: new Map((project.attackTrees?.trees ?? []).map((t) => [t.id, t])),
    scale: project.risks.configuration?.scale,
  };
  let changed = false;
  const risks = project.risks.risks.map((risk) => {
    const isoRisk = computeIsoRisk(risk, ctx);
    if (sameIsoRisk(risk.isoRisk, isoRisk)) return risk;
    changed = true;
    const { isoRisk: _old, ...rest } = risk;
    return isoRisk ? { ...rest, isoRisk } : (rest as Risk);
  });
  return changed ? { ...project, risks: { ...project.risks, risks } } : project;
}

/** Write-channel step: same-project guard, only when an input changed. */
export function commitIsoRiskValues(
  prev: Project | undefined,
  next: Project,
): Project {
  if (!prev || prev.id !== next.id) return next;
  const touched =
    next.risks !== prev.risks ||
    next.assets !== prev.assets ||
    next.attackTrees !== prev.attackTrees ||
    next.hazards !== prev.hazards ||
    next.info?.tags !== prev.info?.tags;
  return touched ? computeIsoRisks(next) : next;
}
