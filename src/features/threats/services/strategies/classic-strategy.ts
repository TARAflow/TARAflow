// ==================== CLASSIC STRATEGY ====================
// Wraps existing generator behaviour — no STRIDE modulation.
// Used when: no assets linked, no project tags set.
 
import type { StrideCategory } from "shared";
import type {
  ThreatProjectData,
  DFDElementReference,
  ElementTemplate,
  InteractionTemplate,
} from "../../models/threat-types";
import type { IGeneratorStrategy, StrategyType } from "../../models/strategy-types";
import {
  findElementTemplate,
  findInteractionTemplate,
} from "../threat-catalog-service";
 
export class ClassicStrategy implements IGeneratorStrategy {
  readonly type: StrategyType = "ClassicStrategy";

  getStrideCategories(
    element: DFDElementReference,
    baseCategories: StrideCategory[],
    _project: ThreatProjectData,
  ): StrideCategory[] {
    // No modulation — return base categories unchanged
    return baseCategories;
  }

  selectElementTemplate(
    strideCategory: StrideCategory,
    elementType: string,
    project: ThreatProjectData,
    elementProps: Record<string, unknown>,
  ): ElementTemplate | undefined {
    return findElementTemplate(
      strideCategory,
      elementType,
      project,
      elementProps,
    );
  }

  selectInteractionTemplate(
    strideCategory: StrideCategory,
    perspective: "sender" | "receiver",
    project: ThreatProjectData,
  ): InteractionTemplate | undefined {
    return findInteractionTemplate(strideCategory, perspective, project);
  }
}