// ==================== CLASSIC STRATEGY ====================
// Wraps existing generator behaviour — no STRIDE modulation.
// Used when: no assets linked, no project tags set.

import type { CIANAAALevel, StrideCategory } from "shared";
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
    _element: DFDElementReference,
    baseCategories: StrideCategory[],
    _project: ThreatProjectData,
  ): StrideCategory[] {
    // No modulation — return base categories unchanged
    return baseCategories;
  }

  getInitialImpact(
    _element: DFDElementReference,
    _strideCategory: StrideCategory,
    _project: ThreatProjectData,
  ): CIANAAALevel | undefined {
    // No asset-level CIANAAA data available in classic mode
    return undefined;
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