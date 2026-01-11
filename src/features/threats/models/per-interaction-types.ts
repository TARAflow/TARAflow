// ==================== PER-INTERACTION TYPES ====================
// Types specific to STRIDE per-interaction threat modeling method

import type { StrideCategory } from "shared";

// ==================== INTERACTION DIRECTION ====================

/**
 * Direction of the threat in the data flow
 * - incoming: Attacker targets the receiver (spoofs sender, manipulates data going IN)
 * - outgoing: Attacker targets the sender (spoofs receiver, intercepts data going OUT)
 */
export type InteractionDirection = "incoming" | "outgoing";

/**
 * Role in the interaction being threatened
 * - source: The sending component
 * - target: The receiving component
 */
export type InteractionRole = "source" | "target";

// ==================== INTERACTION CONTEXT ====================

/**
 * Context for STRIDE-per-Interaction threat generation
 * Captures the directional nature of data flow threats
 */
export interface InteractionContext {
  /** Direction of attack relative to data flow */
  direction: InteractionDirection;

  /** Which component is being impersonated/attacked */
  attackedRole: InteractionRole;

  /** Which component is being deceived/affected */
  victimRole: InteractionRole;

  /** Whether this data flow crosses a trust boundary */
  crossesTrustBoundary: boolean;
}

// ==================== DATA FLOW REFERENCE ====================

/**
 * Reference to a data flow/connection in per-interaction threats
 */
export interface DataFlowReference {
  /** XML/mxGraph cell ID - stable identifier for matching */
  connectionId?: string;
  /** Display ID like "DF-1" - can change when renumbered */
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

/**
 * Detected change in a DataFlow reference during sync
 */
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
  changes: ("name" | "id" | "source" | "target")[];
}

// ==================== STRIDE MAPPING ====================

/**
 * STRIDE categories for per-interaction method
 * All 6 categories apply to each data flow
 */
export const STRIDE_PER_INTERACTION: StrideCategory[] = [
  "S",
  "T",
  "R",
  "I",
  "D",
  "E",
];

// ==================== INTERACTION TEMPLATES ====================

/**
 * Template for generating directional threats in STRIDE-per-Interaction
 * Uses placeholders: {{sourceName}}, {{targetName}}, {{dataFlowName}}
 */
export interface InteractionThreatTemplate {
  id: string;
  strideCategory: StrideCategory;
  direction: InteractionDirection;

  /** Template with placeholders */
  threat: string;
  threatDE: string;
  attack: string;
  attackDE: string;

  /** Suggested mitigations for this direction */
  suggestedMitigations: string[];
  suggestedMitigationsDE: string[];
}

/**
 * Placeholders available in interaction templates
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

/**
 * Generate threat ID for STRIDE-per-interaction method
 * Format: {TrustBoundaryID}-{DataFlowID}-{STRIDE}-{Direction}-{Number}
 * Example: TB1-1-S-IN-1, TB1-1-S-OUT-1
 */
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

/**
 * Parse per-interaction threat ID
 */
export function parseThreatIdPerInteraction(id: string): {
  trustBoundaryId: string;
  dataFlowId: string;
  strideCategory: StrideCategory;
  direction: InteractionDirection;
  sequenceNumber: number;
} | null {
  // Format: TB1-1-S-IN-1 or TB1-1-S-OUT-1
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

/**
 * Format data flow display string
 * Format: "Source → Target: DataFlow Name"
 */
export function formatDataFlowDisplay(dataFlow: DataFlowReference): string {
  const sourceName = dataFlow.sourceName || dataFlow.sourceId;
  const targetName = dataFlow.targetName || dataFlow.targetId;
  const flowName = dataFlow.dataFlowName || dataFlow.dataFlowId;
  return `${sourceName} → ${targetName}: ${flowName}`;
}

/**
 * Format interaction context for display
 */
export function formatInteractionContext(
  context: InteractionContext,
  locale: "en" | "de" = "en"
): string {
  if (locale === "de") {
    const direction =
      context.direction === "incoming" ? "Eingehend" : "Ausgehend";
    const role = context.attackedRole === "source" ? "Sender" : "Empfänger";
    return `${direction} (${role}-Spoofing)`;
  }
  const direction = context.direction === "incoming" ? "Incoming" : "Outgoing";
  const role = context.attackedRole === "source" ? "Sender" : "Receiver";
  return `${direction} (${role} Spoofing)`;
}

/**
 * Create interaction context for a data flow threat
 */
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

// ==================== TEMPLATE PLACEHOLDER REPLACEMENT ====================

/**
 * Replace placeholders in template text
 */
export function replacePlaceholders(
  template: string,
  placeholders: InteractionTemplatePlaceholders
): string {
  return template
    .replace(/\{\{sourceName\}\}/g, placeholders.sourceName)
    .replace(/\{\{targetName\}\}/g, placeholders.targetName)
    .replace(/\{\{sourceType\}\}/g, placeholders.sourceType)
    .replace(/\{\{targetType\}\}/g, placeholders.targetType)
    .replace(/\{\{dataFlowName\}\}/g, placeholders.dataFlowName)
    .replace(/\{\{trustBoundaryName\}\}/g, placeholders.trustBoundaryName);
}

// ==================== INTERFACE THREAT HELPERS ====================

/**
 * Get default threat description for interface threats
 */
export function getDefaultInterfaceThreatDescription(
  strideCategory: StrideCategory,
  interfaceName: string,
  locale: "en" | "de" = "en"
): string {
  const descriptions = {
    en: {
      T: `Physical tampering through ${interfaceName} (e.g., hardware manipulation, voltage injection)`,
      I: `Information disclosure through ${interfaceName} (e.g., sniffing, side-channel attacks)`,
      D: `Denial of Service through ${interfaceName} (e.g., short circuit, power surge, connector damage)`,
      E: `Privilege escalation through ${interfaceName} (e.g., debug access, firmware manipulation)`,
      S: `Identity spoofing through ${interfaceName} (e.g., impersonating legitimate device)`,
      R: `Action repudiation through ${interfaceName} (e.g., denying physical access)`,
    },
    de: {
      T: `Physische Manipulation über ${interfaceName} (z.B. Hardware-Manipulation, Spannungsinjektion)`,
      I: `Informationspreisgabe über ${interfaceName} (z.B. Abhören, Seitenkanalangriffe)`,
      D: `Dienstverweigerung über ${interfaceName} (z.B. Kurzschluss, Spannungsspitzen, Steckerbeschädigung)`,
      E: `Rechteausweitung über ${interfaceName} (z.B. Debug-Zugriff, Firmware-Manipulation)`,
      S: `Identitätsfälschung über ${interfaceName} (z.B. Vortäuschen eines legitimen Geräts)`,
      R: `Aktionsabstreitbarkeit über ${interfaceName} (z.B. Leugnen des physischen Zugriffs)`,
    },
  };

  return (
    descriptions[locale][strideCategory] ||
    `Physical threat to ${interfaceName}`
  );
}

/**
 * Get default attack description for interface threats
 */
export function getDefaultInterfaceAttackDescription(
  strideCategory: StrideCategory,
  interfaceName: string,
  locale: "en" | "de" = "en"
): string {
  const descriptions = {
    en: {
      T: `Attacker connects manipulated hardware to ${interfaceName} to alter device behavior or data`,
      I: `Attacker connects monitoring equipment to ${interfaceName} to extract sensitive information`,
      D: `Attacker deliberately damages ${interfaceName} or causes electrical faults (short circuit, overvoltage)`,
      E: `Attacker uses ${interfaceName} to gain unauthorized access or escalate privileges (e.g., JTAG debugging)`,
      S: `Attacker connects fake device to ${interfaceName} to impersonate legitimate hardware`,
      R: `Attacker performs actions through ${interfaceName} that cannot be traced or logged`,
    },
    de: {
      T: `Angreifer verbindet manipulierte Hardware mit ${interfaceName}, um Geräteverhalten oder Daten zu ändern`,
      I: `Angreifer verbindet Überwachungsgerät mit ${interfaceName}, um sensible Informationen zu extrahieren`,
      D: `Angreifer beschädigt ${interfaceName} absichtlich oder verursacht elektrische Fehler (Kurzschluss, Überspannung)`,
      E: `Angreifer nutzt ${interfaceName}, um unbefugten Zugriff zu erlangen oder Rechte auszuweiten (z.B. JTAG-Debugging)`,
      S: `Angreifer verbindet gefälschtes Gerät mit ${interfaceName}, um legitime Hardware vorzutäuschen`,
      R: `Angreifer führt Aktionen über ${interfaceName} aus, die nicht nachvollziehbar oder protokolliert werden können`,
    },
  };

  return (
    descriptions[locale][strideCategory] ||
    `Physical attack scenario for ${interfaceName}`
  );
}