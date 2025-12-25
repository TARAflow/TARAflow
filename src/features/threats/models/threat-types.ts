// ==================== SYNC STATUS TYPES ====================

/**
 * Detected change in a DataFlow reference
 */
export interface DataFlowChange {
  threatId: string;
  oldRef: DataFlowReference;
  newRef: DFDConnectionReference;
  changes: ("name" | "id" | "source" | "target")[];
}

/**
 * Detected change in an Element reference
 */
export interface ElementChange {
  threatId: string;
  oldRef: LinkedDFDElement;
  newRef: DFDElementReference;
  changes: ("name" | "id" | "type")[];
}

/**
 * Status of synchronization between DFD and Threats
 */
export interface ThreatSyncStatus {
  /** Whether threats are in sync with DFD */
  inSync: boolean;

  /** Elements/DataFlows in DFD but without threats */
  missingInThreats: {
    elements: DFDElementReference[];
    dataFlows: DFDConnectionReference[];
  };

  /** Threats referencing deleted DFD elements/flows */
  orphanedThreats: {
    elementIds: string[];
    dataFlowIds: string[];
    threatIds: string[];
  };

  /** Threats with changed references (name, id, direction) */
  changedReferences: {
    elements: ElementChange[];
    dataFlows: DataFlowChange[];
  };

  /** Summary counts for UI */
  summary: {
    missingElementCount: number;
    missingDataFlowCount: number;
    orphanedThreatCount: number;
    changedReferenceCount: number;
  };

  /** When sync was last checked */
  lastChecked: string;
}

/**
 * Result of sync operation
 */
export interface ThreatSyncResult {
  success: boolean;

  /** Number of new threats added */
  added: number;

  /** Number of orphaned threats removed (if requested) */
  removed: number;

  /** Number of references updated */
  updated: number;

  /** Updated threat data */
  threatData?: ThreatData;

  /** Error message if failed */
  error?: string;
}

// ==================== THREAT TYPES ====================
// Core data models for the Threats feature
// NO dependency on app - follows Dependency Inversion Principle

import type { PhaseStatusMap, StrideCategory } from "shared";

// ==================== STRIDE METHOD ====================

export type StrideMethod = "per-element" | "per-interaction";

// ==================== INTERACTION CONTEXT (NEW) ====================

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

// ==================== STRIDE ELEMENT MAPPING ====================

/**
 * STRIDE categories applicable per DFD element type
 * Based on TARA Table 2
 */
export const STRIDE_PER_ELEMENT_TYPE: Record<string, StrideCategory[]> = {
  ExternalEntity: ["S", "R"],
  Process: ["S", "T", "R", "I", "D", "E"],
  Multiprocess: ["S", "T", "R", "I", "D", "E"],
  DataFlow: ["T", "I", "D"],
  DataStore: ["T", "R", "I", "D"],
  PhysicalInterface: ["T", "I", "D", "E"],
  Interface: ["T", "I", "D", "E"],
};

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

// ==================== STRIDE DEFINITIONS ====================

export interface StrideDefinition {
  type: StrideCategory;
  name: string;
  nameDE: string;
  securityProperty: string;
  securityPropertyDE: string;
  description: string;
  descriptionDE: string;
}

export const STRIDE_DEFINITIONS: StrideDefinition[] = [
  {
    type: "S",
    name: "Spoofing",
    nameDE: "Spoofing",
    securityProperty: "Authentication",
    securityPropertyDE: "Authentifizierung",
    description: "Pretending to be something or someone you're not",
    descriptionDE: "Vorgeben, etwas oder jemand anderes zu sein",
  },
  {
    type: "T",
    name: "Tampering",
    nameDE: "Manipulation",
    securityProperty: "Integrity",
    securityPropertyDE: "Integrität",
    description: "Modifying something you're not supposed to modify",
    descriptionDE: "Ändern von etwas, das nicht geändert werden sollte",
  },
  {
    type: "R",
    name: "Repudiation",
    nameDE: "Abstreitbarkeit",
    securityProperty: "Non-repudiation",
    securityPropertyDE: "Nichtabstreitbarkeit",
    description:
      "Claiming you didn't do something, whether or not you actually did",
    descriptionDE: "Behaupten, etwas nicht getan zu haben",
  },
  {
    type: "I",
    name: "Information Disclosure",
    nameDE: "Informationspreisgabe",
    securityProperty: "Confidentiality",
    securityPropertyDE: "Vertraulichkeit",
    description:
      "Exposing information to people who aren't authorized to see it",
    descriptionDE: "Offenlegung von Informationen an Unbefugte",
  },
  {
    type: "D",
    name: "Denial of Service",
    nameDE: "Dienstverweigerung",
    securityProperty: "Availability",
    securityPropertyDE: "Verfügbarkeit",
    description: "Taking actions to prevent the system from providing service",
    descriptionDE:
      "Aktionen, die das System am Bereitstellen von Diensten hindern",
  },
  {
    type: "E",
    name: "Elevation of Privilege",
    nameDE: "Rechteausweitung",
    securityProperty: "Authorization",
    securityPropertyDE: "Autorisierung",
    description:
      "Being able to perform operations you aren't supposed to be able to do",
    descriptionDE: "Ausführen von Operationen ohne entsprechende Berechtigung",
  },
];

// ==================== THREAT ACTOR ====================

export type ThreatActorType =
  | "external"
  | "internal"
  | "nation-state"
  | "script-kiddie"
  | "competitor"
  | "other";

export interface ThreatActorDefinition {
  type: ThreatActorType;
  name: string;
  nameDE: string;
  description: string;
  descriptionDE: string;
}

export const THREAT_ACTORS: ThreatActorDefinition[] = [
  {
    type: "external",
    name: "External Attacker",
    nameDE: "Externer Angreifer",
    description: "Malicious actor from outside the organization",
    descriptionDE: "Böswilliger Akteur von außerhalb der Organisation",
  },
  {
    type: "internal",
    name: "Insider",
    nameDE: "Insider",
    description: "Malicious or negligent employee/contractor",
    descriptionDE: "Böswilliger oder fahrlässiger Mitarbeiter/Auftragnehmer",
  },
  {
    type: "nation-state",
    name: "Nation-State",
    nameDE: "Staatlicher Akteur",
    description: "Government-sponsored attacker with significant resources",
    descriptionDE: "Staatlich geförderter Angreifer mit erheblichen Ressourcen",
  },
  {
    type: "script-kiddie",
    name: "Script Kiddie",
    nameDE: "Script Kiddie",
    description: "Unskilled attacker using pre-made tools",
    descriptionDE: "Unerfahrener Angreifer mit vorgefertigten Tools",
  },
  {
    type: "competitor",
    name: "Competitor",
    nameDE: "Wettbewerber",
    description: "Business competitor seeking advantage",
    descriptionDE: "Geschäftlicher Konkurrent auf der Suche nach Vorteilen",
  },
  {
    type: "other",
    name: "Other",
    nameDE: "Andere",
    description: "Other threat actor type",
    descriptionDE: "Anderer Bedrohungsakteur-Typ",
  },
];

// ==================== LINKED DFD ELEMENT ====================

export interface LinkedDFDElement {
  elementId: string;
  elementName: string;
  elementType: string;
}

// ==================== DATA FLOW REFERENCE ====================

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

// ==================== THREAT ====================

/**
 * Core Threat data structure
 * Extended with InteractionContext for per-interaction method
 */
export interface Threat {
  /** Unique Threat ID */
  id: string;

  /** Trust Boundary ID this threat belongs to (null for external entities in per-element) */
  trustBoundaryId: string | null;

  /** Trust Boundary name */
  trustBoundaryName: string | null;

  /** STRIDE category */
  strideCategory: StrideCategory;

  /** Sequential number per STRIDE category */
  sequenceNumber: number;

  /** Linked DFD element (for per-element method) */
  linkedElement: LinkedDFDElement | null;

  /** Data flow reference (for per-interaction method) */
  dataFlow: DataFlowReference | null;

  /**
   * Interaction context (for per-interaction method)
   * Captures direction and role information for contextual threats
   */
  interactionContext?: InteractionContext;

  /** Threat description */
  threatDescription: string;

  /** Possible attack scenario */
  attackDescription: string;

  /** Threat actor */
  threatActor: ThreatActorType;

  /** Mitigation description */
  mitigation: string;

  /** Verification/Testing description */
  verification: string;

  /** Linked asset IDs */
  linkedAssetIds: string[];

  /** Source: auto-generated or manual */
  source: "auto" | "manual";

  /** Timestamps */
  created: string;
  lastModified: string;
}

// ==================== THREAT TABLE (PER TRUST BOUNDARY) ====================

export interface ThreatTable {
  /** Trust Boundary ID (null for External Entities table in per-element) */
  trustBoundaryId: string | null;

  /** Trust Boundary name */
  trustBoundaryName: string;

  /** Display identifier (e.g., "[TB-1]" or "[External Entities]") */
  displayIdentifier: string;

  /** Threats in this table */
  threats: Threat[];
}

// ==================== THREAT CONFIGURATION ====================

/**
 * Project-specific threat configuration
 */
export interface ThreatConfiguration {
  /** Currently active STRIDE analysis method for display */
  activeMethod: StrideMethod;

  /** Custom threat templates (additions to catalog) */
  customThreatTemplates: ThreatTemplate[];

  /** Custom mitigation templates (additions to catalog) */
  customMitigationTemplates: MitigationTemplate[];

  /** Custom verification templates (additions to catalog) */
  customVerificationTemplates: VerificationTemplate[];
}

/**
 * Default configuration for new projects
 */
export const DEFAULT_THREAT_CONFIGURATION: ThreatConfiguration = {
  activeMethod: "per-element",
  customThreatTemplates: [],
  customMitigationTemplates: [],
  customVerificationTemplates: [],
};

// ==================== TEMPLATE TYPES ====================

export interface ThreatTemplate {
  id: string;
  strideCategory: StrideCategory;
  elementTypes: string[]; // Which element types this applies to
  threat: string;
  threatDE: string;
  attack: string;
  attackDE: string;
  isCustom: boolean;
}

export interface MitigationTemplate {
  id: string;
  strideCategory: StrideCategory;
  mitigation: string;
  mitigationDE: string;
  isCustom: boolean;
}

export interface VerificationTemplate {
  id: string;
  strideCategory: StrideCategory;
  verification: string;
  verificationDE: string;
  isCustom: boolean;
}

// ==================== INTERACTION TEMPLATE TYPES (NEW) ====================

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

// ==================== THREAT DATA CONTAINER ====================

/**
 * Complete threat data for a project
 * Stores BOTH per-element and per-interaction data to allow switching
 */
export interface ThreatData {
  /** Project-specific configuration */
  configuration: ThreatConfiguration;

  /** Threat tables for STRIDE-per-element method */
  perElementTables: ThreatTable[];

  /** Threat tables for STRIDE-per-interaction method */
  perInteractionTables: ThreatTable[];

  /** Validation state */
  validation?: ThreatValidation;

  /** Last modified timestamp */
  lastModified: string;
}

export interface ThreatValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== THREAT PROJECT INTERFACE ====================
// What Threats feature needs from a project (Dependency Inversion)

export interface ThreatProjectData {
  id: string;
  name: string;
  threats: ThreatData | null;
  phaseStatus: PhaseStatusMap;
  /** DFD data for extracting elements and trust boundaries */
  dfdXml?: string;
  dfdElements?: DFDElementReference[];
  dfdConnections?: DFDConnectionReference[];
  dfdPreviewImage?: string;
  /** Assets for linking */
  assetIds?: string[];
  lastModified: string;
}

// Simplified DFD references (no circular dependency)
export interface DFDElementReference {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface DFDConnectionReference {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** Formatted display ID like "DF-1", extracted from idlabel child element */
  displayId?: string;
}

// ==================== THREAT UPDATE RESULT ====================
// What Threats returns to app layer after updates

export interface ThreatUpdateResult {
  threats: ThreatData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== THREAT TAB PROPS ====================

export interface ThreatTabProps {
  project: ThreatProjectData;
  onUpdate: (updates: ThreatUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate threat ID for STRIDE-per-element method
 * Format: {ElementID}-{STRIDE}-{Number}
 * Example: P-1-S-1, DS-1-T-1
 */
export function generateThreatIdPerElement(
  elementId: string,
  strideCategory: StrideCategory,
  sequenceNumber: number
): string {
  return `${elementId}-${strideCategory}-${sequenceNumber}`;
}

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
 * Parse threat ID to extract components
 */
export function parseThreatId(id: string): {
  elementId?: string;
  trustBoundaryId?: string;
  dataFlowId?: string;
  strideCategory: StrideCategory;
  direction?: InteractionDirection;
  sequenceNumber: number;
} | null {
  // Try per-interaction format with direction: TB1-1-S-IN-1 or TB1-1-S-OUT-1
  const perInteractionWithDir = id.match(
    /^(TB\d+)-(\d+)-([STRIDE])-(IN|OUT)-(\d+)$/
  );
  if (perInteractionWithDir) {
    return {
      trustBoundaryId: perInteractionWithDir[1],
      dataFlowId: perInteractionWithDir[2],
      strideCategory: perInteractionWithDir[3] as StrideCategory,
      direction: perInteractionWithDir[4] === "IN" ? "incoming" : "outgoing",
      sequenceNumber: parseInt(perInteractionWithDir[5], 10),
    };
  }

  // Try legacy per-interaction format: TB-1-DF-1-S-1
  const perInteractionLegacy = id.match(/^(TB-\d+)-(DF-\d+)-([STRIDE])-(\d+)$/);
  if (perInteractionLegacy) {
    return {
      trustBoundaryId: perInteractionLegacy[1],
      dataFlowId: perInteractionLegacy[2],
      strideCategory: perInteractionLegacy[3] as StrideCategory,
      sequenceNumber: parseInt(perInteractionLegacy[4], 10),
    };
  }

  // Try per-element format: P-1-S-1 or EE-1-S-1
  const perElementMatch = id.match(/^([A-Z]+-\d+)-([STRIDE])-(\d+)$/);
  if (perElementMatch) {
    return {
      elementId: perElementMatch[1],
      strideCategory: perElementMatch[2] as StrideCategory,
      sequenceNumber: parseInt(perElementMatch[3], 10),
    };
  }

  return null;
}

/**
 * Get STRIDE definition by type
 */
export function getStrideDefinition(
  type: StrideCategory
): StrideDefinition | undefined {
  return STRIDE_DEFINITIONS.find((s) => s.type === type);
}

/**
 * Get applicable STRIDE categories for an element type
 */
export function getApplicableStrideCategories(
  elementType: string
): StrideCategory[] {
  return STRIDE_PER_ELEMENT_TYPE[elementType] || [];
}

/**
 * Create default ThreatData for new projects
 */
export function createDefaultThreatData(): ThreatData {
  return {
    configuration: { ...DEFAULT_THREAT_CONFIGURATION },
    perElementTables: [],
    perInteractionTables: [],
    lastModified: new Date().toISOString(),
  };
}

/**
 * Get active threat tables based on current method
 */
export function getActiveThreatTables(
  threatData: ThreatData | null | undefined
): ThreatTable[] {
  if (!threatData?.configuration) {
    return [];
  }
  if (threatData.configuration.activeMethod === "per-element") {
    return threatData.perElementTables ?? [];
  }
  return threatData.perInteractionTables ?? [];
}

/**
 * Create an empty threat with defaults
 */
export function createEmptyThreat(
  id: string,
  strideCategory: StrideCategory,
  trustBoundaryId: string | null,
  trustBoundaryName: string | null,
  interactionContext?: InteractionContext
): Threat {
  return {
    id,
    trustBoundaryId,
    trustBoundaryName,
    strideCategory,
    sequenceNumber: 1,
    linkedElement: null,
    dataFlow: null,
    interactionContext,
    threatDescription: "",
    attackDescription: "",
    threatActor: "external",
    mitigation: "",
    verification: "",
    linkedAssetIds: [],
    source: "manual",
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

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
