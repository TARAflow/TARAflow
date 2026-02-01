// ==================== THREAT TYPES (SHARED) ====================
// Core domain model for threat management
// Contains types used by BOTH per-element and per-interaction methods

import type { PhaseStatusMap, StrideCategory } from "shared";

// ==================== STRIDE METHOD ====================

export type StrideMethod = "per-element" | "per-interaction";

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

// ==================== THREAT (CORE) ====================

/**
 * Core Threat data structure
 * Used by both per-element and per-interaction methods
 * Method-specific fields: linkedElement (per-element), dataFlow + interactionContext (per-interaction)
 */
export interface Threat {
  /** Unique Threat ID */
  id: string;

  /** Trust Boundary ID this threat belongs to */
  trustBoundaryId: string | null;

  /** Trust Boundary name */
  trustBoundaryName: string | null;

  trustBoundaryDisplayId: string | null;

  /** STRIDE category */
  strideCategory: StrideCategory;

  /** Sequential number per STRIDE category */
  sequenceNumber: number;

  /** Linked DFD element - used by per-element method */
  linkedElement: any | null; // Import from per-element/types

  /** Data flow reference - used by per-interaction method */
  dataFlow: any | null; // Import from per-interaction/types

  /** Interaction context - used by per-interaction method */
  interactionContext?: any; // Import from per-interaction/types

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

// ==================== THREAT TABLE ====================

export interface ThreatTable {
  /** Trust Boundary ID */
  trustBoundaryId: string | null;

  /** Trust Boundary name */
  trustBoundaryName: string;

  /** Display identifier (e.g., "[TB-1]" or "[External Entities]") */
  displayIdentifier: string;

  /** Threats in this table */
  threats: Threat[];
}

// ==================== TEMPLATES ====================

export interface ThreatTemplate {
  id: string;
  strideCategory: StrideCategory;
  elementTypes: string[];
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

// ==================== CONFIGURATION ====================

export interface ThreatConfiguration {
  activeMethod: StrideMethod;
  customThreatTemplates: ThreatTemplate[];
  customMitigationTemplates: MitigationTemplate[];
  customVerificationTemplates: VerificationTemplate[];
}

export const DEFAULT_THREAT_CONFIGURATION: ThreatConfiguration = {
  activeMethod: "per-element",
  customThreatTemplates: [],
  customMitigationTemplates: [],
  customVerificationTemplates: [],
};

// ==================== THREAT DATA ====================

export interface ThreatData {
  configuration: ThreatConfiguration;
  perElementTables: ThreatTable[];
  perInteractionTables: ThreatTable[];
  validation?: ThreatValidation;
  lastModified: string;
}

export interface ThreatValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== PROJECT INTERFACE ====================

export interface ThreatProjectData {
  id: string;
  name: string;
  threats: ThreatData | null;
  phaseStatus: PhaseStatusMap;
  dfdXml?: string;
  dfdElements?: DFDElementReference[];
  dfdConnections?: DFDConnectionReference[];
  dfdPreviewImage?: string;
  assetIds?: string[];
  dfdGraph?: DFDGraphReference;
  lastModified: string;
}

// Simplified DFD references
export interface DFDElementReference {
  id: string;
  type: string;
  name: string;
  displayId: string;
}

export interface DFDConnectionReference {
  id: string;
  from: string;
  to: string;
  label?: string;
  displayId: string;
}

export interface DFDGraphReference {
  elementsById: Map<string, DFDElementReference>;
  connectionsById: Map<string, DFDConnectionReference>;
  assetsById: Map<string, DFDAssetReference>;

  outgoingConnections: Map<string, string[]>; // elementId -> connectionIds
  incomingConnections: Map<string, string[]>; // elementId -> connectionIds

  elementTrustBoundaries: Map<string, string[]>; // elementId -> trustBoundaryIds
  trustBoundaryElements: Map<string, string[]>; // trustBoundaryId -> elementIds

  dataFlowAnalysis: Map<string, DataFlowAnalysisReference>;
  trustBoundaryHierarchy: Map<string, TrustBoundaryAnalysisReference>;
  effectiveElementTrustBoundary: Map<string, string | undefined>;
}

export interface DFDConnectionReference {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface DFDAssetReference {
  id: string;
  name: string;
}

export interface DataFlowAnalysisReference {
  connectionId: string;
  fromElementId: string;
  toElementId: string;
  fromElementType: string; // DFDElementType als string
  toElementType: string;
  fromTrustBoundaryIds: string[];
  toTrustBoundaryIds: string[];
  fromEffectiveTrustBoundary?: string | null;
  toEffectiveTrustBoundary?: string | null;
  crossesTrustBoundary: boolean;
  crossesMultipleTrustBoundaries: boolean;
  viaInterface?: boolean;
  crossingType?: "none" | "inbound" | "outbound" | "lateral";
}
export interface TrustBoundaryAnalysisReference {
  trustBoundaryId: string;
  parentTrustBoundaryId?: string;
  depth: number; // 0 = outermost
}

// ==================== SYNC STATUS (SHARED) ====================

export interface ThreatSyncStatus {
  inSync: boolean;
  missingInThreats: {
    elements: DFDElementReference[];
    dataFlows: DFDConnectionReference[];
  };
  orphanedThreats: {
    elementIds: string[];
    dataFlowIds: string[];
    threatIds: string[];
  };
  changedReferences: {
    elements: any[]; // ElementChange from per-element
    dataFlows: any[]; // DataFlowChange from per-interaction
  };
  summary: {
    missingElementCount: number;
    missingDataFlowCount: number;
    orphanedThreatCount: number;
    changedReferenceCount: number;
  };
  lastChecked: string;
}

export interface ThreatSyncResult {
  success: boolean;
  added: number;
  removed: number;
  updated: number;
  threatData?: ThreatData;
  error?: string;
}

// ==================== UPDATE RESULT ====================

export interface ThreatUpdateResult {
  threats: ThreatData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== HELPERS ====================

export function createDefaultThreatData(): ThreatData {
  return {
    configuration: { ...DEFAULT_THREAT_CONFIGURATION },
    perElementTables: [],
    perInteractionTables: [],
    lastModified: new Date().toISOString(),
  };
}

export function getActiveThreatTables(
  threatData: ThreatData | null | undefined
): ThreatTable[] {
  if (!threatData?.configuration) return [];

  return threatData.configuration.activeMethod === "per-element"
    ? threatData.perElementTables ?? []
    : threatData.perInteractionTables ?? [];
}

export function createEmptyThreat(
  id: string,
  strideCategory: StrideCategory,
  trustBoundaryId: string | null,
  trustBoundaryName: string | null,
  trustBoundaryDisplayId: string | null,
  interactionContext?: any
): Threat {
  return {
    id,
    trustBoundaryId,
    trustBoundaryName,
    trustBoundaryDisplayId,
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
 * Type guard to check if a ThreatTable contains Interface threats
 * Interface tables have "Physical Interfaces" in their name
 */
export function isInterfaceTable(table: ThreatTable): boolean {
  return table.trustBoundaryName.includes("Physical Interfaces");
}

/**
 * Type guard to check if a Threat is an Interface threat
 * Interface threats have linkedElement of type Interface/PhysicalInterface
 */
export function isInterfaceThreat(threat: Threat): boolean {
  return (
    threat.linkedElement !== null &&
    (threat.linkedElement.elementType === "Interface" ||
      threat.linkedElement.elementType === "PhysicalInterface")
  );
}
