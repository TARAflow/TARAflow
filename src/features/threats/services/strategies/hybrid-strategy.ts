// ==================== HYBRID STRATEGY ====================
// STRIDE categories modulated by element properties.
// Used when: some assets linked OR any project tag set.
import type { IGeneratorStrategy, StrategyType } from "../../models/strategy-types";
import {DFDElementReference, ElementTemplate, InteractionTemplate,ThreatProjectData} from "../../models/threat-types"
import {StrideCategory} from "shared"

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
 
export class HybridStrategy implements IGeneratorStrategy {
  readonly type: StrategyType = "HybridStrategy";

  getStrideCategories(
    element: DFDElementReference,
    baseCategories: StrideCategory[],
    _project: ThreatProjectData,
  ): StrideCategory[] {
    const props = (element as any).properties ?? {};

    switch (element.type) {
      case "Process":
        return modifyProcessStride(
          baseCategories,
          props as ProcessModifierProps,
        );

      case "Multiprocess":
        return modifyMultiprocessStride(
          baseCategories,
          props as MultiprocessModifierProps,
        );

      case "DataFlow":
        return modifyDataFlowStride(
          baseCategories,
          props as DataFlowModifierProps,
        );

      case "DataStore":
        return modifyDataStoreStride(
          baseCategories,
          props as DataStoreModifierProps,
        );

      case "TrustBoundary":
        return modifyTrustBoundaryStride(
          baseCategories,
          props as TrustBoundaryModifierProps,
        );

      case "Interface":
      case "PhysicalInterface":
        return modifyInterfaceStride(
          baseCategories,
          props as InterfaceModifierProps,
        );

      case "ChipBoundary":
        return modifyChipBoundaryStride(
          baseCategories,
          props as ChipBoundaryModifierProps,
        );

      default:
        return baseCategories;
    }
  }

  selectElementTemplate(
    strideCategory: StrideCategory,
    elementType: string,
    project: ThreatProjectData,
    elementProps: Record<string, unknown>,
  ): ElementTemplate | undefined {
    // Context-filtered — project.info.tags drives template selection
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