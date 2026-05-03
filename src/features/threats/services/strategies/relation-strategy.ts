// ==================== RELATION STRATEGY ====================
// STRIDE derived from asset relation types combined with CIANAAA goals.
// Used when: all elements have linked assets with full CIANAAA annotations.
//
// Relation → STRIDE mapping:
//   creates, modifies, deletes → T (Tampering)
//   reads, transports          → I (Information Disclosure)
//   stores                     → T + I
//   executes, invokes          → E (Elevation of Privilege)
//   monitors                   → R (Repudiation — audit trail)
//   depends_on                 → D (Denial of Service — availability)
//   is_an                      → S (Spoofing — identity)
 
import type { AnyAssetRelationType, StrideCategory } from "shared";
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
  
const RELATION_TO_STRIDE: Partial<Record<AnyAssetRelationType, StrideCategory[]>> = {
  creates:    ["T"],
  modifies:   ["T"],
  deletes:    ["T"],
  reads:      ["I"],
  transports: ["I"],
  stores:     ["T", "I"],
  executes:   ["E"],
  invokes:    ["E"],
  monitors:   ["R"],
  depends_on: ["D"],
  is_an:      ["S"],
  uses:       ["T", "I"],
  controls:   ["E"],
  configures: ["T"],
  accesses:   ["I"],
};
 
export class RelationStrategy implements IGeneratorStrategy {
  readonly type: StrategyType = "RelationStrategy";

  getStrideCategories(
    element: DFDElementReference,
    baseCategories: StrideCategory[],
    project: ThreatProjectData,
  ): StrideCategory[] {
    // Find asset relations for this element
    const assetRelations = (element as any).assetRelations ?? [];

    if (assetRelations.length === 0) {
      // No relations — fall back to base categories
      return baseCategories;
    }

    // Derive STRIDE from relation types
    const derived = new Set<StrideCategory>();
    for (const relation of assetRelations) {
      const strideForRelation =
        RELATION_TO_STRIDE[relation.relationType as AnyAssetRelationType];
      if (strideForRelation) {
        strideForRelation.forEach((s) => derived.add(s));
      }
    }

    return derived.size > 0 ? Array.from(derived) : baseCategories;
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