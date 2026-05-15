// ==================== STRATEGY TYPES ====================
// Defines the UnifiedStrategy pattern for threat generation.
//
// Single additive pipeline — modules applied based on available data:
//   Module 1: Element Properties  → STRIDE modulated by DFD element properties
//   Module 2: Asset CIANAAA Goals → STRIDE derived from securityGoals + initialImpact
//
// If forceClassicMode is true: both modules are skipped → base STRIDE only.
//
// Future enrichment (Phase E1, E2) via IEnrichmentProvider hook — called after
// STRIDE derivation, before threat is returned to the generator.

import type { CIANAAALevel, StrideCategory } from "shared";
import type {
  ThreatProjectData,
  ThreatConfiguration,
  ThreatSource,
  DFDElementReference,
  ElementTemplate,
  InteractionTemplate,
} from "./threat-types";

// ==================== STRATEGY TYPE ====================

export type StrategyType = "UnifiedStrategy";

// ==================== GENERATION MODULES ====================

/**
 * Which modules were active during generation of a specific threat.
 * Drives ThreatSource value.
 */
export interface GenerationModules {
  /** Element properties module was active and modified STRIDE */
  propertiesApplied: boolean;
  /** CIANAAA security goals module was active and derived STRIDE */
  cianaaaApplied: boolean;
}

/**
 * Derives ThreatSource from active generation modules.
 */
export function modulesToSource(modules: GenerationModules): ThreatSource {
  const { propertiesApplied, cianaaaApplied } = modules;
  if (propertiesApplied && cianaaaApplied) return "generated:full";
  if (propertiesApplied) return "generated:properties";
  if (cianaaaApplied) return "generated:cianaaa";
  return "generated:classic";
}

// ==================== STRATEGY INTERFACE ====================

export interface IGeneratorStrategy {
  readonly type: StrategyType;

  /**
   * Derive STRIDE categories for a given element via the additive pipeline.
   * Returns both the categories and which modules were active.
   */
  getStrideCategories(
    element: DFDElementReference,
    baseCategories: StrideCategory[],
    project: ThreatProjectData,
    config: ThreatConfiguration,
  ): { categories: StrideCategory[]; modules: GenerationModules };

  /**
   * Returns initial severity derived from CIANAAA level of linked assets.
   * undefined when CIANAAA module was not active for this element/stride.
   */
  getInitialImpact(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    project: ThreatProjectData,
  ): CIANAAALevel | undefined;

  /**
   * Select the best matching element template.
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

// ==================== ENRICHMENT PROVIDER ====================

/**
 * Interface for Phase E1 (Mitre ATT&CK) and Phase E2 (LLM) enrichment.
 * Called after STRIDE derivation — adds technique references, descriptions, etc.
 * Returning an empty object means no enrichment for this threat.
 */
export interface IEnrichmentProvider {
  readonly id: string;
  readonly phase: "E1" | "E2";

  enrich(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    project: ThreatProjectData,
  ): EnrichmentResult;
}

export interface EnrichmentResult {
  mitreReferences?: MitreReference[];
  llmDescription?: string;
}

export interface MitreReference {
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  url: string;
  source: "auto" | "manual";
}