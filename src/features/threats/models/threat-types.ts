// ==================== THREAT TYPES (SHARED) ====================
// Core domain model for threat management
// Contains types used by BOTH per-element and per-interaction methods

import type {
  AssetReference,
  AssetDataReference,
  CIANAAALevel,
  DFDReference,
  MitigationPropertyRole,
  PhaseStatusMap,
  ProjectTags,
  StrideCategory,
} from "shared";

import type { StrategyType } from "./strategy-types";

// DFDGraphReference and its supporting types now live in shared/models/dfd-reference-types.
// Re-exported here so existing imports from "features/threats" continue to work
// without changes in consumers (element-generator, interaction-generator, etc.).
import type {
  DFDElementReference,
  DFDConnectionReference,
  DFDAssetReference,
  DataFlowAnalysisReference,
  TrustBoundaryAnalysisReference,
  DFDGraphReference,
} from "shared/models/dfd-reference-types";

// ==================== THREAT SOURCE ====================

/**
 * How the threat was created.
 *
 *   manual               → created by analyst in the Threat Tab
 *   generated:classic    → UnifiedStrategy, no modules active (forced or no data)
 *   generated:properties → UnifiedStrategy, element properties module only
 *   generated:cianaaa    → UnifiedStrategy, CIANAAA security goals module only
 *   generated:full       → UnifiedStrategy, both modules active
 */
export type ThreatSource =
  | "manual"
  | "generated:classic"
  | "generated:properties"
  | "generated:cianaaa"
  | "generated:full";

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
  /**
   * True when the corresponding security control is already implemented on the
   * DFD element at threat-generation time (derived from element properties).
   *
   * Drives the "already implemented" badge in the Threat Eval dialog.
   * Risk treatment implication: threat exists but is Reduced, not Open.
   *
   * Reset to false on the next threat sync if implementedByProperty reverts
   * to "none" — this is the close-loop drift detection mechanism.
   */
  alreadyImplemented?: boolean;
  /**
   * The element property path that drives the implemented state.
   * Used for drift detection on threat sync.
   * @example "implementedControls.logicalAccessControl"
   */
  implementedByProperty?: string;
  /**
   * The property value that triggered the implemented state.
   * @example "certificate"
   */
  implementedByValue?: string;
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

  /**
   * Initial severity derived from CIANAAA level of linked assets.
   * Set at generation time by RelationStrategy (MAX level of driving securityGoals).
   * undefined for ClassicStrategy and HybridStrategy — no asset CIANAAA data available.
   * Used by Risk Tab as pre-populated impact baseline.
   */
  initialImpact?: CIANAAALevel;

  /** How this threat was created — strategy used or manually added */
  source: ThreatSource;

  /**
   * Proposed mitigations from the catalog generator, optionally annotated by the analyst.
   * Catalog entries carry an id; custom analyst additions carry only notes.
   * alreadyImplemented = true when the mitigation is already reflected in the
   * element's security control properties at generation time (close-loop).
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
  | "Interface"
  | "PhysicalBoundary"
  | "ChipBoundary";

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
 * Context field for template filtering.
 * Empty / missing = universal (shown always).
 * Non-empty = AND across keys, OR within a key.
 */
export interface TemplateContext {
  /**
   * Element-level: matches Multiprocess.systemClass.
   * Preferred over platform for Multiprocess templates.
   */
  systemClass?: string[];

  /**
   * Element-level: matches ChipBoundary.chipType.
   * Used for chip-specific templates.
   */
  chipType?: string[];

  /**
   * Element-level: matches Process.technology or DataStore.technology.
   * Used for technology-specific templates (bootloader, rtos_task, flash, etc.)
   */
  technology?: string[];

  /**
   * Element-level: matches DataFlow.protocol.
   * Used for protocol-specific templates (modbus, spi, i2c, mqtt, etc.)
   */
  protocol?: string[];

  /**
   * Element-level: matches ExternalEntity.entityType.
   * Used for entity-type-specific templates (iot, mobile_app, service, etc.)
   */
  entityType?: string[];

  /**
   * Element-level: matches Interface.type (InterfaceType enum value).
   * Used for interface-type-specific templates (usb, gpio, serial, jtag, etc.)
   * Note: stored as "type" on InterfaceProperties, not "interfaceType".
   */
  interfaceType?: string[];

  /**
   * Project-level: matches project.info.tags.regulation.
   * Used for regulatory-specific templates.
   */
  regulation?: string[];

  /**
   * Project-level: matches project.info.tags.platform.
   * @deprecated Prefer element-level keys (technology, protocol, interfaceType).
   * Kept for backwards compatibility with existing templates.
   */
  platform?: string[];

  /**
   * Project-level: matches project.info.tags.domain.
   * @deprecated Prefer regulation for domain-specific requirements.
   */
  domain?: string[];

  // ── Physical Boundary context ─────────────────────────────────────────────

  /**
   * Element-level: matches PhysicalBoundary.boundaryType.
   * @example ["device_enclosure", "cabinet"]
   */
  boundaryType?: string[];

  /**
   * Element-level: matches Interface.implementedControls.serviceAccessPolicy.
   * Used to generate "factory interface active in production" gap threat.
   * @example ["factory_only"]
   */
  serviceAccessPolicy?: string[];

  /**
   * Element-level: matches PhysicalBoundary.physicalMobility.
   * @example ["portable", "removable"]
   */
  physicalMobility?: string[];

  /**
   * Element-level: matches PhysicalBoundary.accessibility.
   * @example ["public"]
   */
  accessibility?: string[];

  /**
   * Element-level: matches PhysicalBoundary.monitoringType.
   * Used to generate R-PB-001 (no physical audit trail).
   * @example ["none"]
   */
  monitoringType?: string[];

  /**
   * Element-level boolean flag: matches PhysicalBoundary.debugInterfaceAccessible.
   * When true in context: template only matches elements where this flag is true.
   * Omit (undefined) for templates that are universal regardless of debug access.
   */
  debugInterfaceAccessible?: boolean;

  /**
   * Element-level boolean flag: matches PhysicalBoundary.removableMediaAccessible.
   * When true in context: template only matches elements where this flag is true.
   */
  removableMediaAccessible?: boolean;

  // ── Process / Multiprocess context ───────────────────────────────────────

  /**
   * Element-level: matches Process.failSafeOutputState.
   * Used to generate CR 3.6 gap threat when no fail-safe state is defined.
   * @example ["not_defined"]
   */
  failSafeOutputState?: string[];

  /**
   * Element-level: matches Process.processSemantic.
   * Restricts templates to specific process roles (functional_block, execution_unit).
   * @example ["functional_block"]
   */
  processSemantic?: string[];

  /**
   * Element-level: matches Process.accountManagement or Multiprocess.accountManagement.
   * Used to generate CR 1.3 gap threat when no central account management exists.
   * @example ["local_only"]
   */
  accountManagement?: string[];

  /**
   * Element-level: matches Multiprocess.updateMechanism.
   * Used to generate CR 7.2 gap threat when update signing is absent.
   * @example ["none", "manual_local"]
   */
  updateMechanism?: string[];

  /**
   * Element-level: matches Process.authenticatorStorage,
   * Multiprocess.authenticatorStorage, or ChipBoundary.authenticatorStorage.
   * Used to generate CR 1.5 RE1 gap threat when keys are software-only.
   * @example ["software_only"]
   */
  authenticatorStorage?: string[];

  /**
   * Element-level: matches Multiprocess.backupMechanism.
   * Used to generate CR 7.3 gap threat when no backup is configured.
   * @example ["none"]
   */
  backupMechanism?: string[];

  /**
   * Element-level: matches ChipBoundary.cryptoStandard, DataFlow.cryptoStandard,
   * or DataStore.cryptoStandard.
   * Used to generate CR 4.3 gap threat when crypto compliance is unassessed.
   * @example ["not_assessed"]
   */
  cryptoStandard?: string[];

  // ── DataFlow context ──────────────────────────────────────────────────────

  /**
   * Element-level: matches DataFlow.location (physical routing medium).
   * Used to trigger physical cable protection templates.
   * @example ["field_cable", "in_enclosure", "on_board"]
   */
  location?: string[];

  /**
   * Element-level: matches DataFlow.redundancy.
   * Used to generate DoS threat when safety-critical flow has no redundant path.
   * @example ["none"]
   */
  redundancy?: string[];

  /**
   * Element-level: matches DataFlow.safetyFunction.
   * Used to generate critical Tampering and DoS threats on safety-relevant flows.
   * @example ["emergency_stop", "safety_gate", "pressure_relief"]
   */
  safetyFunction?: string[];

  /**
   * Element-level: matches DataFlow.accessMode.
   * Used to generate Tampering threat on OT protocols with read_write access.
   * @example ["read_write"]
   */
  accessMode?: string[];
}

// ==================== CONFIGURATION ====================

export interface ThreatConfiguration {
  activeMethod: StrideMethod;
  zeroTrustMode: boolean;
  showThreatActor: boolean;
  /**
   * Disables all STRIDE modulation — generates generic base categories only.
   * Useful for quick generation or debugging.
   * Replaces the former strategyOverride: StrategyType.
   */
  forceClassicMode?: boolean;
  /**
   * Enrichment provider configuration.
   * Phase E1: Mitre ATT&CK — maps STRIDE threats to ATT&CK techniques.
   * Phase E2: LLM — generates domain-specific threat descriptions.
   */
  enrichment?: {
    mitreEnabled?: boolean;
    llmEnabled?: boolean;
  };
  customElementTemplates: ElementTemplate[];
  customInteractionTemplates: InteractionTemplate[];
  customMitigations: MitigationEntry[];
  customVerifications: VerificationEntry[];
}

export const DEFAULT_THREAT_CONFIGURATION: ThreatConfiguration = {
  activeMethod: "per-element",
  zeroTrustMode: false,
  showThreatActor: false,
  forceClassicMode: false,
  enrichment: {
    mitreEnabled: false,
    llmEnabled: false,
  },
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
  // Detect by threat content — not by table name.
  // Interface tables are grouped under PhysicalBoundary or ChipBoundary
  // and can have any boundary name (e.g. "Device Boundary [DB]").
  // All threats in an interface table have linkedElement set; dataFlow is null.
  if (table.threats.length === 0) return false;
  const first = table.threats[0];
  return (
    first.linkedElement != null &&
    first.linkedElement.elementType === "Interface"
  );
}

export function isInterfaceThreat(threat: Threat): boolean {
  return (
    threat.linkedElement != null &&
    threat.linkedElement.elementType === "Interface"
  );
}