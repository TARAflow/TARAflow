// ==================== THREAT REFERENCE TYPES ====================
// Minimal threat snapshot consumed by the Risk feature.
// No dependency on threat feature types — Dependency Inversion.
//
// Consumers import directly from this file.

import type { StrideCategory, StrideMethod } from "shared";
import type { LinkedDFDElement, DataFlowReference } from "./dfd-reference-types";
import type { CIANAAALevel } from "./cianaaa-reference-types";

// ==================== THREAT RELEVANCE ====================

/**
 * Relevance values — mirrored from threat-types.ts.
 * Keep in sync with ThreatRelevance there.
 */
export type ThreatRelevanceRef =
  | "unrated"
  | "relevant"
  | "not_relevant"
  | "uncertain";

// ==================== MITIGATION DRAFT REF ====================

/**
 * Resolved mitigation draft — display text populated at sync time from catalog.
 * Mirrors MitigationDraft without circular import.
 */
export interface MitigationDraftRef {
  id?: string;
  text?: string;
  notes?: string;
  isCustom?: boolean;
}

// ==================== THREAT REFERENCE ====================

/**
 * Minimal threat snapshot consumed by the Risk feature.
 * Populated by app layer (extractThreatReferences in main-layout.tsx).
 *
 * Phase 3: initialImpact added for CIANAAA → Risk factor prefill (Phase 3b).
 */
export interface ThreatReference {
  id: string;
  strideCategory: StrideCategory;
  threatDescription: string;
  attackDescription: string;
  sourceStrideMethod: StrideMethod;
  relevance: ThreatRelevanceRef;
  proposedMitigations: MitigationDraftRef[];
  proposedVerifications: MitigationDraftRef[];
  causeDescription?: string;
  linkedAssetIds?: string[];
  elementName?: string;
  dataFlowName?: string;
  trustBoundaryId: string | null;
  trustBoundaryName: string | null;
  linkedElement?: LinkedDFDElement | null;
  dataFlow?: DataFlowReference | null;
  /**
   * Derived CIANAAA impact level from UnifiedStrategy.getInitialImpact().
   * Phase 3b: used to pre-fill matching Risk impact factor.
   */
  initialImpact?: CIANAAALevel;
}