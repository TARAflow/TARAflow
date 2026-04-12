// ==================== PER-INTERACTION TYPES ====================
// Types specific to STRIDE per-interaction threat modeling method

import type { StrideCategory } from "shared";

// ==================== INTERACTION DIRECTION ====================

export type InteractionDirection = "incoming" | "outgoing";
export type InteractionRole = "source" | "target";

// ==================== INTERACTION CONTEXT ====================

export interface InteractionContext {
  direction: InteractionDirection;
  attackedRole: InteractionRole;
  victimRole: InteractionRole;
  crossesTrustBoundary: boolean;
}

// ==================== DATA FLOW REFERENCE ====================

export interface DataFlowReference {
  connectionId?: string;
  dataFlowId: string;
  dataFlowName: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  targetId: string;
  targetName: string;
  targetType: string;
}

// ==================== DATA FLOW CHANGE ====================

export interface DataFlowChange {
  threatId: string;
  oldRef: DataFlowReference;
  newRef: {
    id: string;
    from: string;
    to: string;
    label?: string;
    displayId?: string;
  };
  changes: ("name" | "id" | "source" | "target" | "displayId")[];
}

// ==================== STRIDE MAPPING ====================

export const STRIDE_PER_INTERACTION: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];

// ==================== INTERACTION TEMPLATE TYPE ====================

/**
 * Language-neutral interaction threat template.
 * Strings are in src/i18n/locales/{lang}/interaction-templates.json.
 * Kept here for type reference — data loaded via threat-catalog-service.ts.
 */
export interface InteractionThreatTemplate {
  id: string;
  strideCategory: StrideCategory;
  perspective: "sender" | "receiver";
  context: {
    industry?: string[];
    platform?: string[];
    standards?: string[];
  };
  mitigations: string[];
  verifications: string[];
  isCustom: boolean;
}

/**
 * Placeholders available in interaction templates.
 * Resolved by i18next interpolation — no manual regex replacement needed.
 */
export interface InteractionTemplatePlaceholders {
  sourceName: string;
  targetName: string;
  sourceType: string;
  targetType: string;
  dataFlowName: string;
  trustBoundaryName: string;
}

// ==================== ID GENERATION ====================

export function generateThreatIdPerInteraction(
  trustBoundaryId: string,
  dataFlowId: string,
  strideCategory: StrideCategory,
  direction: InteractionDirection,
  sequenceNumber: number
): string {
  const dirSuffix = direction === "incoming" ? "IN" : "OUT";
  return `${trustBoundaryId}-${dataFlowId}-${strideCategory}-${dirSuffix}-${sequenceNumber}`;
}

export function parseThreatIdPerInteraction(id: string): {
  trustBoundaryId: string;
  dataFlowId: string;
  strideCategory: StrideCategory;
  direction: InteractionDirection;
  sequenceNumber: number;
} | null {
  const match = id.match(/^(TB\d+)-(\d+)-([STRIDE])-(IN|OUT)-(\d+)$/);
  if (!match) return null;
  return {
    trustBoundaryId: match[1],
    dataFlowId: match[2],
    strideCategory: match[3] as StrideCategory,
    direction: match[4] === "IN" ? "incoming" : "outgoing",
    sequenceNumber: parseInt(match[5], 10),
  };
}

// ==================== DISPLAY HELPERS ====================

export function formatDataFlowDisplay(dataFlow: DataFlowReference): string {
  const sourceName = dataFlow.sourceName || dataFlow.sourceId;
  const targetName = dataFlow.targetName || dataFlow.targetId;
  const flowName = dataFlow.dataFlowName || dataFlow.dataFlowId;
  return `${sourceName} → ${targetName}: ${flowName}`;
}

export function createInteractionContext(
  direction: InteractionDirection,
  crossesTrustBoundary: boolean
): InteractionContext {
  return {
    direction,
    attackedRole: direction === "incoming" ? "source" : "target",
    victimRole: direction === "incoming" ? "target" : "source",
    crossesTrustBoundary,
  };
}

// formatInteractionContext uses i18next — call t() at the component level,
// do not pass locale strings into service/model functions.