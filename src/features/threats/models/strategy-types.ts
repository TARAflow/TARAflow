// ==================== STRATEGY TYPES ====================
// Defines the Strategy Pattern for threat generation.
//
// Three strategies:
//   ClassicStrategy  — fixed STRIDE per element type, generic templates
//   HybridStrategy   — STRIDE modulated by element properties + context templates
//   RelationStrategy — STRIDE derived from asset securityGoals (CIANAAA)
//
// Auto-detection:
//   assetCoverage === 1.0 → RelationStrategy
//   assetCoverage > 0 || hasTags → HybridStrategy
//   else → ClassicStrategy

import type { CIANAAALevel, StrideCategory } from "shared";
import type {
  ThreatTable,
  ThreatProjectData,
  ThreatConfiguration,
  DFDElementReference,
  ElementTemplate,
  InteractionTemplate,
} from "./threat-types";
import type { DFDAnalysisContext } from "shared";

// ==================== STRATEGY TYPE ====================

export type StrategyType =
  | "ClassicStrategy"
  | "HybridStrategy"
  | "RelationStrategy";

// ==================== STRIDE MODIFIER RESULT ====================

/**
 * Result of applying a strategy's STRIDE modulation.
 * priority: 1 (highest) → 5 (lowest) — used for threat sorting.
 * skip: true → this STRIDE category is excluded for this element.
 */
export interface StrideModulation {
  categories: StrideCategory[];
  priorityOverrides?: Partial<Record<StrideCategory, number>>;
  skipped?: StrideCategory[];
}

// ==================== STRATEGY INTERFACE ====================

export interface IGeneratorStrategy {
  readonly type: StrategyType;

  /**
   * Modulate STRIDE categories for a given element based on its properties.
   * ClassicStrategy returns baseCategories unchanged.
   * HybridStrategy adds/removes/escalates based on element properties.
   * RelationStrategy derives from asset securityGoals via CIANAAA_TO_STRIDE.
   */
  getStrideCategories(
    element: DFDElementReference,
    baseCategories: StrideCategory[],
    project: ThreatProjectData,
  ): StrideCategory[];

  /**
   * Returns the initial severity derived from CIANAAA level of linked assets.
   *
   * RelationStrategy: MAX(level) of all securityGoals that map to strideCategory
   *   via CIANAAA_TO_STRIDE. Used to pre-populate threat.initialImpact.
   *
   * ClassicStrategy / HybridStrategy: returns undefined — no asset-level
   *   CIANAAA data available to drive the initial impact.
   */
  getInitialImpact(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    project: ThreatProjectData,
  ): CIANAAALevel | undefined;

  /**
   * Select the best matching template for a given stride/element combination.
   * Allows strategy to influence template selection beyond context filtering.
   */
  selectElementTemplate(
    strideCategory: StrideCategory,
    elementType: string,
    project: ThreatProjectData,
    elementProps: Record<string, unknown> | null,
  ): ElementTemplate | undefined;

  /**
   * Select the best matching interaction template.
   */
  selectInteractionTemplate(
    strideCategory: StrideCategory,
    perspective: "sender" | "receiver",
    project: ThreatProjectData,
    elementProps: Record<string, unknown>,
  ): InteractionTemplate | undefined;
}