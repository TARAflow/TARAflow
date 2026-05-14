// ==================== RELATION STRATEGY ====================
// STRIDE derived from asset securityGoals (CIANAAA level).
// Used when: all elements have linked assets with full CIANAAA annotations.
//
// Flow:
//   1. Find all assets linked to this element via project.assetDataRef
//   2. Collect active securityGoals (level !== "none")
//   3. Map SecurityGoalType → StrideCategory via CIANAAA_TO_STRIDE
//   4. Union all StrideCategories across all linked assets
//
// initialImpact:
//   MAX(level) of all securityGoals that map to the given StrideCategory.
//   Fallback: undefined when no assets or all levels are "none".

import type {
  CIANAAALevel,
  SecurityGoalReference,
  StrideCategory,
} from "shared";
import { CIANAAA_TO_STRIDE } from "shared";
import type { IGeneratorStrategy, StrategyType } from "../../models/strategy-types";
import type {
  ThreatProjectData,
  DFDElementReference,
  ElementTemplate,
  InteractionTemplate,
} from "../../models/threat-types";
import {
  findElementTemplate,
  findInteractionTemplate,
} from "../threat-catalog-service";

// ==================== LEVEL ORDERING ====================

const LEVEL_ORDER: CIANAAALevel[] = ["none", "low", "medium", "high", "critical"];

function maxLevel(levels: CIANAAALevel[]): CIANAAALevel {
  return levels.reduce<CIANAAALevel>(
    (max, l) =>
      LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(max) ? l : max,
    "none",
  );
}

// ==================== ASSET LOOKUP ====================

/**
 * Returns all active security goals (level !== "none") for assets
 * linked to the given element. Reads from project.assetDataRef —
 * no direct dependency on the asset feature.
 */
function getActiveSecurityGoals(
  elementId: string,
  project: ThreatProjectData,
): SecurityGoalReference[] {
  if (!project.assetDataRef) return [];

  const goals: SecurityGoalReference[] = [];
  for (const asset of project.assetDataRef.assets) {
    if (!asset.linkedElementIds?.includes(elementId)) continue;
    if (!asset.securityGoals?.length) continue;
    for (const goal of asset.securityGoals) {
      if (goal.level !== "none") goals.push(goal);
    }
  }
  return goals;
}

// ==================== RELATION STRATEGY ====================

export class RelationStrategy implements IGeneratorStrategy {
  readonly type: StrategyType = "RelationStrategy";

  getStrideCategories(
    element: DFDElementReference,
    baseCategories: StrideCategory[],
    project: ThreatProjectData,
  ): StrideCategory[] {
    const activeGoals = getActiveSecurityGoals(element.id, project);

    if (activeGoals.length === 0) return baseCategories;

    const derived = new Set<StrideCategory>();
    for (const goal of activeGoals) {
      const stride = CIANAAA_TO_STRIDE[goal.type];
      if (stride) derived.add(stride);
    }

    return derived.size > 0 ? Array.from(derived) : baseCategories;
  }

  getInitialImpact(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    project: ThreatProjectData,
  ): CIANAAALevel | undefined {
    const activeGoals = getActiveSecurityGoals(element.id, project);

    // Only goals that drive this STRIDE category
    const drivingLevels = activeGoals
      .filter((goal) => CIANAAA_TO_STRIDE[goal.type] === strideCategory)
      .map((goal) => goal.level);

    if (drivingLevels.length === 0) return undefined;

    const result = maxLevel(drivingLevels);
    return result === "none" ? undefined : result;
  }

  selectElementTemplate(
    strideCategory: StrideCategory,
    elementType: string,
    project: ThreatProjectData,
    elementProps: Record<string, unknown> | null,
  ): ElementTemplate | undefined {
    return findElementTemplate(
      strideCategory,
      elementType,
      project,
      elementProps ?? undefined,
    );
  }

  selectInteractionTemplate(
    strideCategory: StrideCategory,
    perspective: "sender" | "receiver",
    project: ThreatProjectData,
    elementProps: Record<string, unknown>,
  ): InteractionTemplate | undefined {
    return findInteractionTemplate(
      strideCategory,
      perspective,
      project,
      elementProps,
    );
  }
}