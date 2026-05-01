// ==================== THREAT TYPES (SHARED) ====================
// Core domain model for threat management
// Contains types used by BOTH per-element and per-interaction methods

import type {
  AssetReference,
  AssetDataReference,
  DFDReference,
  MitigationPropertyRole,
  PhaseStatusMap,
  ProjectTags,
  StrideCategory,
} from "shared";

// ==================== STRIDE METHOD ====================

export type StrideMethod = "per-element" | "per-interaction";

// ==================== THREAT RELEVANCE ====================

/**
 * Analyst's domain judgement — is this threat real for this system?
 * Set explicitly in the Threat Eval dialog or via inline quick-actions.
 */
export type ThreatRelevance =
  | "unrated"       // not yet reviewed (default)
  | "relevant"      // confirmed as applicable to this system
  | "not_relevant"  // explicitly ruled out for this system
  | "uncertain";    // needs more information or a second opinion

// ==================== THREAT WORKFLOW STATUS ====================

/**
 * Workflow state — where is the threat in the processing pipeline?
 * Transitions: open → reviewed (Threat Eval) → closed (Risk Tab)
 */
export type ThreatWorkflowStatus =
  | "open"      // not yet fully processed
  | "reviewed"  // analyst has evaluated, relevance decision recorded
  | "closed";   // treatment decided in Risk Tab

// ==================== RELEVANCE CHIP COLORS ====================

export const RELEVANCE_COLORS: Record<ThreatRelevance, string> = {
  unrated:      "#9ca3af",
  relevant:     "#16a34a",
  not_relevant: "#dc2626",
  uncertain:    "#d97706",
};

// ==================== MITIGATION DRAFT ====================

/**
 * A mitigation entry in the Threat Eval phase.
 * Catalog entries have an id; custom analyst additions have only notes.
 */
export interface MitigationDraft {
  /** Catalog ID (e.g. "M-S-001"). Undefined = custom entry added by analyst. */
  id?: string;
  /** Annotation for catalog entries, or full description for custom entries. */
  notes?: string;
}

// ==================== VERIFICATION DRAFT ====================

/**
 * A verification entry in the Threat Eval phase.
 * Same structure as MitigationDraft.
 */
export interface VerificationDraft {
  /** Catalog ID (e.g. "V-S-001"). Undefined = custom entry added by analyst. */
  id?: string;
  notes?: string;
}

// ==================== STRIDE DEFINITIONS ====================

export interface StrideDefinition {
  type: StrideCategory;
  /** i18n key — resolved via t('stride.S.name') */
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
 * Core Threat data structure.
 * Used by both per-element and per-interaction methods.
 * Method-specific fields: linkedElement (per-element), dataFlow + interactionContext (per-interaction).
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

  /** Linked DFD element — used by per-element method */
  linkedElement: any | null;

  /** Data flow reference — used by per-interaction method */
  dataFlow: any | null;

  /** Interaction context — used by per-interaction method */
  interactionContext?: any;

  /** Threat description (stored; empty = use i18n template at render time) */
  threatDescription: string;

  /** Possible attack scenario (stored; empty = use i18n template at render time) */
  attackDescription: string;

  /**
   * Root cause — explains why this threat is possible.
   * Pre-filled by generator from i18n catalog; shown read-only in dialog.
   */
  causeDescription: string;

  /** Threat actor */
  threatActor: ThreatActorType;

  /** Linked asset IDs */
  linkedAssetIds: string[];

  /** Source: auto-generated or manually created */
  source: "auto" | "manual";

  /**
   * Proposed mitigations from the catalog generator, optionally annotated by the analyst.
   * Catalog entries carry an id; custom analyst additions carry only notes.
   */
  proposedMitigations: MitigationDraft[];

  /**
   * Proposed verifications from the catalog generator, optionally annotated by the analyst.
   * Same structure as proposedMitigations.
   */
  proposedVerifications: VerificationDraft[];

  // ── Eval fields ──────────────────────────────────────────────────────────

  /**
   * Analyst's domain judgement — is this threat applicable to this system?
   * Setting any value except "unrated" automatically sets workflowStatus = "reviewed".
   */
  relevance: ThreatRelevance;

  /**
   * Workflow state — where is this threat in the processing pipeline?
   * Managed by the Threat Eval dialog and the Risk Tab.
   */
  workflowStatus: ThreatWorkflowStatus;

  /**
   * Optional free-text note explaining the relevance decision.
   * Useful for audit trail (e.g., why a threat was dismissed).
   */
  evalNote?: string;

  /** True when the analyst has manually edited threatDescription or attackDescription */
  isTextCustomized: boolean;

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

/**
 * Language-neutral element threat template (references i18n keys)
 */
export interface ElementTemplate {
  id: string;
  strideCategory: StrideCategory;
  elementTypes: string[];
  context: TemplateContext;
  mitigations: string[];
  verifications: string[];
  isCustom: boolean;
}

/**
 * Language-neutral interaction threat template
 */
export interface InteractionTemplate {
  id: string;
  strideCategory: StrideCategory;
  perspective: "sender" | "receiver";
  context: TemplateContext;
  mitigations: string[];
  verifications: string[];
  isCustom: boolean;
}

/**
 * Language-neutral mitigation catalog entry.
 *
 * affectsProperties: describes which DFD element properties this mitigation
 * should influence when selected. Used by the closed-loop ControlInstance
 * derivation engine to generate DFD update suggestions.
 * Empty array = physical/system-level mitigation with no direct DFD property mapping.
 */
export interface MitigationEntry {
  id: string;
  strideCategory: StrideCategory;
  context: TemplateContext;
  isCustom: boolean;
  /** DFD property effects — drives ControlInstance derivation */
  affectsProperties: MitigationPropertyEffect[];
  /**
   * Verification IDs that should be auto-selected when this mitigation is chosen.
   * Auto-deselected when the mitigation is deselected (unless manually re-added).
   */
  verifications?: string[];
}

// ==================== MITIGATION PROPERTY MAPPING ====================

/**
 * DFD element types that a mitigation can target.
 * Matches DFDElementType — TrustBoundary excluded (not a security control target).
 */
export type MitigationTargetType =
  | "Process"
  | "Multiprocess"
  | "DataFlow"
  | "DataStore"
  | "ExternalEntity"
  | "Interface";

/**
 * Describes the expected effect of a mitigation on a specific DFD element property.
 *
 * Used by the ControlInstance derivation engine (useControlInstanceDerivation)
 * to generate DFD update suggestions when a mitigation is selected in the Risk Tab.
 *
 * confidence:
 *   deterministic → property/value mapping is unambiguous (e.g. TLS → encryptionInTransit = "tls")
 *   heuristic     → likely correct, but analyst confirmation required
 */
export interface MitigationPropertyEffect {
  /** Which DFD element type this effect applies to */
  targetType: MitigationTargetType;

  /**
   * Role in per-interaction context.
   * Omit for per-element mitigations that apply to the element itself.
   */
  role?: MitigationPropertyRole;

  /** Property key on the corresponding *Properties interface */
  property: string;

  /** Expected/recommended value for the property after mitigation */
  expectedValue: unknown;

  /** Confidence level of this inference */
  confidence: "deterministic" | "heuristic";
}

/**
 * Language-neutral verification catalog entry
 */
export interface VerificationEntry {
  id: string;
  strideCategory: StrideCategory;
  context: TemplateContext;
  isCustom: boolean;
}

/**
 * Context field for project-based filtering (Step 4)
 * Empty / missing = universal (shown always)
 * Non-empty = AND across keys, OR within a key
 */
export interface TemplateContext {
  domain?: string[];
  platform?: string[];
  regulation?: string[];
}

// ==================== CONFIGURATION ====================

export interface ThreatConfiguration {
  activeMethod: StrideMethod;
  zeroTrustMode: boolean;
  showThreatActor: boolean;
  customElementTemplates: ElementTemplate[];
  customInteractionTemplates: InteractionTemplate[];
  customMitigations: MitigationEntry[];
  customVerifications: VerificationEntry[];
}

export const DEFAULT_THREAT_CONFIGURATION: ThreatConfiguration = {
  activeMethod: "per-element",
  zeroTrustMode: false,
  showThreatActor: false,
  customElementTemplates: [],
  customInteractionTemplates: [],
  customMitigations: [],
  customVerifications: [],
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
  assetDataRef?: AssetDataReference;
  info?: {
    tags: ProjectTags;
  };
  /** DFD state — used for mitigation coverage badges in Threat Dialog */
  dfd?: DFDReference | null;
  lastModified: string;
}

// ==================== DFD REFERENCES ====================

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
  name?: string;
  label?: string;
  displayId: string;
  excludeFromThreatGen?: boolean;
  assumedTrusted?: boolean;
}

export interface DFDGraphReference {
  elementsById: Map<string, DFDElementReference>;
  connectionsById: Map<string, DFDConnectionReference>;
  assetsById: Map<string, DFDAssetReference>;

  outgoingConnections: Map<string, string[]>;
  incomingConnections: Map<string, string[]>;

  elementTrustBoundaries: Map<string, string[]>;
  trustBoundaryElements: Map<string, string[]>;

  dataFlowAnalysis: Map<string, DataFlowAnalysisReference>;
  trustBoundaryHierarchy: Map<string, TrustBoundaryAnalysisReference>;
  effectiveElementTrustBoundary: Map<string, string | undefined>;
}

export interface DFDAssetReference {
  id: string;
  name: string;
}

export interface DataFlowAnalysisReference {
  connectionId: string;
  fromElementId: string;
  toElementId: string;
  fromElementType: string;
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
  depth: number;
}

// ==================== SYNC STATUS ====================

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
    elements: any[];
    dataFlows: any[];
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
    causeDescription: "",
    threatActor: "external",
    linkedAssetIds: [],
    source: "manual",
    proposedMitigations: [],
    proposedVerifications: [],
    relevance: "unrated",
    workflowStatus: "open",
    evalNote: undefined,
    isTextCustomized: false,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

export function isInterfaceTable(table: ThreatTable): boolean {
  return table.trustBoundaryName.includes("Physical Interfaces");
}

export function isInterfaceThreat(threat: Threat): boolean {
  return (
    threat.linkedElement !== null &&
    (threat.linkedElement.elementType === "Interface" ||
      threat.linkedElement.elementType === "PhysicalInterface")
  );
}