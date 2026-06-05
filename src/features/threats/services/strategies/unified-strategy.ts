// ==================== UNIFIED STRATEGY ====================
// Single additive pipeline replacing Classic/Hybrid/Relation.
//
// Module 1 — Element Properties:
//   Applied when element has DFD properties (technology, protocol, semantic, etc.)
//   Uses existing stride-modifier functions.
//
// Module 2 — Asset CIANAAA Goals:
//   Applied when element has linked assets with active securityGoals.
//   Derives STRIDE via CIANAAA_TO_STRIDE + initialImpact via MAX(level).
//
// forceClassicMode: both modules skipped → base STRIDE only.
//
// GenerationModules tracks which modules were active → drives ThreatSource.

import type {
  CIANAAALevel,
  DFDElementReference,
  SecurityGoalReference,
  StrideCategory,
} from "shared";
import { CIANAAA_TO_STRIDE } from "shared";
import type { IGeneratorStrategy, StrategyType, GenerationModules } from "../../models/strategy-types";
import type {
  ThreatProjectData,
  ThreatConfiguration,
  ElementTemplate,
  InteractionTemplate,
} from "../../models/threat-types";
import {
  modifyProcessStride,
  modifyDataFlowStride,
  modifyDataStoreStride,
  modifyTrustBoundaryStride,
  modifyInterfaceStride,
  modifyChipBoundaryStride,
  modifyMultiprocessStride,
} from "../../utils/stride-modifier";
import type {
  ProcessModifierProps,
  MultiprocessModifierProps,
  DataFlowModifierProps,
  DataStoreModifierProps,
  TrustBoundaryModifierProps,
  InterfaceModifierProps,
  ChipBoundaryModifierProps,
} from "../../utils/stride-modifier";
import {
  findElementTemplate,
  findInteractionTemplate,
} from "../threat-catalog-service";

// ==================== LEVEL ORDERING ====================

const LEVEL_ORDER: CIANAAALevel[] = ["none", "low", "medium", "high", "critical"];

function maxLevel(levels: CIANAAALevel[]): CIANAAALevel {
  return levels.reduce<CIANAAALevel>(
    (max, l) => LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(max) ? l : max,
    "none",
  );
}

// ==================== MODULE 1: ELEMENT PROPERTIES ====================

/**
 * Applies element-property-based STRIDE modulation.
 * Returns modified categories and whether any modification occurred.
 */
function applyElementProperties(
  element: DFDElementReference,
  baseCategories: StrideCategory[],
): { categories: StrideCategory[]; applied: boolean } {
  const props = (element as any).properties ?? {};

  let modified: StrideCategory[];
  switch (element.type) {
    case "Process":
      modified = modifyProcessStride(baseCategories, props as ProcessModifierProps);
      break;
    case "Multiprocess":
      modified = modifyMultiprocessStride(baseCategories, props as MultiprocessModifierProps);
      break;
    case "DataFlow":
      modified = modifyDataFlowStride(baseCategories, props as DataFlowModifierProps);
      break;
    case "DataStore":
      modified = modifyDataStoreStride(baseCategories, props as DataStoreModifierProps);
      break;
    case "TrustBoundary":
      modified = modifyTrustBoundaryStride(baseCategories, props as TrustBoundaryModifierProps);
      break;
    case "Interface":
    case "PhysicalInterface":
      modified = modifyInterfaceStride(baseCategories, props as InterfaceModifierProps);
      break;
    case "ChipBoundary":
      modified = modifyChipBoundaryStride(baseCategories, props as ChipBoundaryModifierProps);
      break;
    default:
      return { categories: baseCategories, applied: false };
  }

  // Applied = result differs from base (something was actually modified)
  const applied =
    modified.length !== baseCategories.length ||
    modified.some((c) => !baseCategories.includes(c));

  return { categories: modified, applied };
}

// ==================== MODULE 2: CIANAAA SECURITY GOALS ====================

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

/**
 * Derives STRIDE categories from asset CIANAAA security goals.
 * Returns derived categories and whether any goals were found.
 */
function applyCIANAAA(
  elementId: string,
  project: ThreatProjectData,
): { categories: StrideCategory[]; applied: boolean } {
  const activeGoals = getActiveSecurityGoals(elementId, project);
  if (activeGoals.length === 0) return { categories: [], applied: false };

  const derived = new Set<StrideCategory>();
  for (const goal of activeGoals) {
    const stride = CIANAAA_TO_STRIDE[goal.type];
    if (stride) derived.add(stride);
  }

  return {
    categories: derived.size > 0 ? Array.from(derived) : [],
    applied: derived.size > 0,
  };
}

// ==================== UNIFIED STRATEGY ====================

export class UnifiedStrategy implements IGeneratorStrategy {
  readonly type: StrategyType = "UnifiedStrategy";

  getStrideCategories(
    element: DFDElementReference,
    baseCategories: StrideCategory[],
    project: ThreatProjectData,
    config: ThreatConfiguration,
  ): { categories: StrideCategory[]; modules: GenerationModules } {
    // forceClassicMode: skip all modules → base STRIDE only
    if (config.forceClassicMode) {
      return {
        categories: baseCategories,
        modules: { propertiesApplied: false, cianaaaApplied: false },
      };
    }

    // Module 1: Element Properties
    const propsResult = applyElementProperties(element, baseCategories);

    // Module 2: CIANAAA Security Goals
    const cianaaaResult = applyCIANAAA(element.id, project);

    // Combine: CIANAAA overrides/extends properties result when both active
    let finalCategories: StrideCategory[];
    if (cianaaaResult.applied) {
      const combined = new Set([
        ...cianaaaResult.categories,
        ...(propsResult.applied ? propsResult.categories : []),
      ]);
      // baseCategories are law — CIANAAA and properties cannot add new categories
      finalCategories = Array.from(combined).filter((c) =>
        baseCategories.includes(c),
      );
    } else if (propsResult.applied) {
      finalCategories = propsResult.categories.filter((c) =>
        baseCategories.includes(c),
      );
    } else {
      finalCategories = baseCategories;
    }

    return {
      categories: finalCategories,
      modules: {
        propertiesApplied: propsResult.applied,
        cianaaaApplied: cianaaaResult.applied,
      },
    };
  }

  getInitialImpact(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    project: ThreatProjectData,
  ): CIANAAALevel | undefined {
    const activeGoals = getActiveSecurityGoals(element.id, project);

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
    return findElementTemplate(strideCategory, elementType, project, elementProps ?? undefined);
  }

  selectInteractionTemplate(
    strideCategory: StrideCategory,
    perspective: "sender" | "receiver",
    project: ThreatProjectData,
    elementProps: Record<string, unknown>,
  ): InteractionTemplate | undefined {
    return findInteractionTemplate(strideCategory, perspective, project, elementProps);
  }
}