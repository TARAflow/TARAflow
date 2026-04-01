// ==================== DFD ASSET TYPES ====================
// Renamed from asset-types.ts → dfd-asset-types.ts to avoid confusion
// with asset-tab/models/asset-types.ts.
// Update all imports: import ... from "./asset-types" → "./dfd-asset-types"
// Type definitions for assets in the Asset Tab.
//
// Import hierarchy (no cycles):
//   safety-types.ts → asset-relation-types.ts → asset-types.ts → dfd-types.ts

import type { ValueSource } from "./safety-types";
import type {
  AssetGroup,
  AssetToAssetRelation,
  AnyAssetRelationType,
  SystemUsesQualifier,
  InfraAccessesQualifier,
  PhysicalContactQualifier,
  ServiceUsesQualifier,
} from "./asset-relation-types";
import type { DFDElementType } from "./dfd-element-types";

// ==================== SHARED SUB-TYPES ====================

/**
 * Structured reference to an external safety analysis document.
 * Used on Function Assets to link to ISO 12100 / FMEA / ISO 13849 safety function IDs.
 * External IDs (SF-001 etc.) live ONLY here — never in affectedSafetyFunctions elsewhere.
 */
export interface ExternalSafetyRef {
  /** External safety function ID, e.g. "SF-001" */
  id: string;
  /** Safety standard, e.g. "ISO 12100", "ISO 13849", "IEC 62061" */
  standard: string;
  /** Source document, e.g. "Safety Analysis Rev. 2.3" */
  document?: string;
  /** Context note, e.g. "Brake control function per clause 6.2.4" */
  rationale?: string;
}

// NOTE: HighValueAssetFields removed — HVA assessment belongs to
// asset-tab/models/asset-types.ts (Asset.properties). See taraflow-asset-beziehungen.md.

// ==================== ASSET PROPERTIES ====================

/**
 * Detailed asset properties for the Asset Tab (impact analysis, CIANAAA, safety).
 *
 * Derived/Manual Pattern (ValueSource):
 *   Fields suffixed ...Source indicate provenance.
 *   "derived" = calculated automatically, no documentation obligation.
 *   "manual"  = analyst override — corresponding ...Rationale field REQUIRED.
 */
export interface AssetProperties {
  /**
   * Mirror of DFDAsset.assetGroup — drives category-specific form sections.
   * Canonical value lives on DFDAsset.assetGroup.
   */
  category?: AssetGroup;

  /** Mirror of DFDAsset.protectionNeed — canonical value on DFDAsset. */
  protectionNeed?: "low" | "medium" | "high" | "critical";

  // ================================================================
  // ---- DATA (group: "data") ----
  // ================================================================

  /** Semantic data types contained in this asset */
  dataType?: string[];
  /** Lifecycle phase of the data */
  lifecycle?: "transient" | "stored" | "archived";
  /**
   * Asset contains safety-relevant configuration data.
   * → Automatic threat prioritisation for modifies / deletes
   * → EN 50742: "Identification of safety-related data assets"
   */
  containsSafetyRelevantData?: boolean;

  // ================================================================
  // ---- FUNCTION (group: "function") ----
  // ================================================================

  /**
   * This is a safety function (ISO 12100, IEC 61508, IEC 62061).
   * When true: Safety Override Rule applies if safetyImpact is set.
   * → Mandatory threats: Tampering, DoS, Spoofing
   */
  isSafetyFunction?: boolean;

  /**
   * Structured references to the accompanying safety analysis.
   * Links this Function Asset to external safety function IDs (SF-xxx).
   * External IDs appear ONLY here — affectedSafetyFunctions elsewhere
   * uses TARAflow-internal UUIDs.
   */
  externalRefs?: ExternalSafetyRef[];

  // ================================================================
  // ---- PROCESS (group: "process") ----
  // ================================================================

  /** Process is automated (no human intervention required at runtime) */
  automated?: boolean;

  /**
   * How frequently this process changes (relevant for IP-theft threat scenarios).
   * rarely:   Stable, seldom updated (e.g. certified safety procedure)
   * regular:  Periodically updated (e.g. batch recipe revised quarterly)
   * frequent: Continuously changing (e.g. live production parameters)
   */
  changeFrequency?: "rarely" | "regular" | "frequent";

  /**
   * Domain / regulatory context of this process.
   * e.g. "OT-Manufacturing", "Medical", "Pharma", "Automotive"
   */
  domain?: string;

  /**
   * Regulatory reference applicable to this process.
   * e.g. "GMP Annex 11", "MDR Annex I Ch. 17", "ISO 13485 §7.5"
   */
  regulatoryReference?: string;

  /**
   * Process is formally validated or certified.
   * When true: validationRationale REQUIRED.
   * → Affects threat priority for Tampering (validated process = higher impact)
   */
  isValidatedProcess?: boolean;
  validationRationale?: string;

  // ================================================================
  // ---- SYSTEM (group: "system") ----
  // ================================================================

  /** System criticality classification */
  criticality?: "supporting" | "essential" | "safety_critical";
  /** Network exposure zone */
  exposure?: "internal" | "dmz" | "internet";
  /**
   * System has direct involvement in safety-critical operations.
   * Enables physicalHazardPotential assessment and Safety Override.
   */
  safetyRelevant?: boolean;

  // ================================================================
  // ---- INFRASTRUCTURE (group: "infrastructure") ----
  // ================================================================

  /** Physical access is possible (relevant for accesses threat scenarios) */
  physicalAccessPossible?: boolean;
  /** Physical deployment location */
  location?: "factory" | "datacenter" | "field" | "cloud";
  /**
   * Environmental hazard at this location (ISO 12100 / EN 50742).
   * fire:       Fire/explosion hazard (high-voltage cabinet, battery)
   * chemical:   Chemical hazard (coolant, tank)
   * mechanical: Mechanical hazard (robot, press, CNC machine)
   * none:       No special environmental hazard
   */
  environmentalHazard?: "fire" | "chemical" | "mechanical" | "none";
  /**
   * Asset is a physical protection barrier (safety enclosure, guard).
   * Failure = direct safety impact on Human Assets (Safety Override may apply).
   */
  isPhysicalBarrier?: boolean;

  // ================================================================
  // ---- PHYSICAL (group: "physical") ----
  // ================================================================

  /**
   * Asset is a unique, irreplaceable object (artwork, prototype, one-of-a-kind).
   * When true: uniquenessRationale REQUIRED.
   * → Enables Spoofing threat: substitution with a forgery.
   */
  isUnique?: boolean;
  uniquenessRationale?: string;

  /**
   * Fixed: asset cannot be moved (installed machinery component).
   * Portable: asset can be transported (prototype, physical key, tool).
   * → Affects theft and smuggling threat scenarios.
   */
  portability?: "fixed" | "portable";

  // ================================================================
  // ---- SERVICE (group: "service") ----
  // ================================================================

  /**
   * Service type / hosting model.
   * internal: Own team operates the service (but may have shared responsibility boundary)
   * external: Third-party operated, no direct infrastructure access
   * cloud:    Cloud-hosted (SaaS, PaaS, IaaS)
   * managed:  Fully managed service, no own API access
   */
  serviceType?: "internal" | "external" | "cloud" | "managed";

  /**
   * Responsibility model — primary classifier for System vs. Service distinction.
   * REQUIRED for Service Assets.
   *
   * owner:       Full technical control, own team fully responsible.
   * shared:      Shared responsibility (e.g. own app-security, provider OS-hardening).
   * third-party: Fully external — responsibilityScope REQUIRED.
   *
   * Validation:
   *   third-party + no responsibilityScope → blocking error (CRA Art. 13)
   *   shared + no responsibilityScope      → warning (CRA Art. 13 supply chain)
   */
  responsibility?: "owner" | "shared" | "third-party";

  /**
   * Scope clarification for shared/third-party responsibility.
   * Documents which security controls are in own vs. provider scope.
   * REQUIRED when responsibility === "third-party".
   * Recommended when responsibility === "shared".
   */
  responsibilityScope?: string;

  /** External service provider name (for audit trail) */
  providerName?: string;

  /** Reference to applicable SLA / contract / document */
  slaReference?: string;

  // ================================================================
  // ---- HUMAN (group: "human") ----
  // ================================================================

  /** Person's role in the system context */
  role?: "operator" | "admin" | "developer" | "external";
  /** Person has security-sensitive access or responsibilities */
  securityRelevant?: boolean;
  /**
   * Person is a protection target per ISO 12100 / EN 50742.
   * When true: Safety Override Rule applies for affects_safety relations.
   * Enables documentation: "The operator is considered a protection target."
   */
  isProtectionTarget?: boolean;

  // ================================================================
  // ---- SHARED SAFETY FIELDS (all groups) ----
  // Applies to: Function, Process, System, Infrastructure, Physical, Service, Human
  // These fields appear where relevant; not all fields apply to all groups.
  // ================================================================

  /**
   * Maximum safety impact upon compromise of this asset.
   * Drives Safety Override Rule (when combined with relevance:'direct' on linked relation).
   * Note: 'none' is omitted for Infrastructure/Physical/System/Human where
   * absence of the field implies no safety relevance.
   */
  safetyImpact?:
    | "none"
    | "reversible_injury"
    | "irreversible_injury"
    | "fatality";

  /**
   * Rationale for safety relevance — used in EN 50742 / MVO 2027 documentation.
   * @example "Disabling this function allows uncontrolled machine motion"
   */
  safetyRationale?: string;

  /**
   * Physical hazard potential of this asset (qualitative, ISO 12100 / EN 50742).
   * Relevant for System and Infrastructure Assets with direct machine involvement.
   * low:    Minimal risk (monitoring port, no control function)
   * medium: Moderate risk (configuration interface)
   * high:   High risk (direct access to safety logic)
   */
  physicalHazardPotential?: "low" | "medium" | "high";

  // NOTE: HVA fields (isHighValueAsset, replacementLeadTime, etc.) removed —
  // they belong to asset-tab/models/asset-types.ts (Asset.properties).

  // ================================================================
  // ---- CIANAAA PROTECTION GOALS ----
  // Derived from relation types — analyst confirms or overrides.
  // Derived/Manual pattern: source field indicates provenance.
  // source === "derived": no audit documentation obligation.
  // source === "manual":  corresponding rationale REQUIRED (IEC 62443-4-1).
  // ================================================================

  confidentialityImpact?: "low" | "medium" | "high" | "critical";
  integrityImpact?: "low" | "medium" | "high" | "critical";
  availabilityImpact?: "low" | "medium" | "high" | "critical";

  /** Non-Repudiation — relevant for: modifies, creates, deletes, transports, executes, monitors */
  nonRepudiationRelevant?: boolean;
  nonRepudiationSource?: ValueSource;
  nonRepudiationRationale?: string;

  /** Authentication — relevant for: reads (critical), uses[network], accesses[remote] */
  authenticationRelevant?: boolean;
  authenticationSource?: ValueSource;
  authenticationRationale?: string;

  /** Authorization — relevant for: almost all relations except is_an */
  authorizationRelevant?: boolean;
  authorizationSource?: ValueSource;
  authorizationRationale?: string;

  /** Accountability — GDPR obligation in addition to Non-Repudiation when personalData */
  accountabilityRelevant?: boolean;
  accountabilitySource?: ValueSource;
  accountabilityRationale?: string;

  // ---- Conditional flags driving CIANAAA derivation ----

  /** Asset in secure storage (TPM, HSM, OP-TEE) → Confidentiality for "stores" */
  secureStorage?: boolean;
  /** Asset has trade-secret character → Confidentiality for "is_an" on Process */
  businessSecret?: boolean;
  /** Asset contains personal data (GDPR Art. 5 §2) → Accountability derived */
  personalData?: boolean;

  // ================================================================
  // ---- IMPACT ASSESSMENT ----
  // ================================================================

  businessImpact?: "low" | "medium" | "high" | "critical";
  businessImpactCategory?:
    | "operational"
    | "financial"
    | "privacy"
    | "reputational";

  /**
   * Physical impact on people — mirrored from SafetyAnnotation.impact on linked relations.
   * Read-only in UI unless manually overridden.
   * source === "derived": from SafetyAnnotation (no doc obligation)
   * source === "manual":  analyst override — rationale REQUIRED
   */
  physicalImpact?:
    | "none"
    | "reversible_injury"
    | "irreversible_injury"
    | "fatality";
  physicalImpactSource?: ValueSource;
  physicalImpactRationale?: string;

  // ================================================================
  // ---- AGGREGATED CRITICALITY (derived, read-only) ----
  // ================================================================

  /**
   * Aggregated asset criticality.
   * Override hierarchy (highest wins, Safety Override always takes precedence):
   *   1. Safety Override:   fatality/irreversible_injury + relevance:direct → CRITICAL
   *   2. HVA critical:      isHighValueAsset:'critical' → CRITICAL minimum
   *   3. HVA high:          isHighValueAsset:'high'     → CRITICAL minimum
   *   4. HVA medium:        isHighValueAsset:'medium'   → HIGH minimum
   *   5. Operational:       businessImpact:'critical'   → HIGH minimum
   *   6. Calculated from businessImpact + physicalImpact
   */
  aggregatedCriticality?: "low" | "medium" | "high" | "critical";

  /** STRIDE analysis depth — derived from aggregatedCriticality + Trust Boundary */
  strideDepth?: "vertieft" | "fokussiert" | "hochstufig";

  owner?: string;
  notes?: string;
}

// ==================== ELEMENT RELATION ====================

/**
 * Element relation from Asset perspective (Asset → Element).
 * Mirrored representation stored in DFDAsset.linkedElements.
 */
export interface ElementRelation {
  elementId: string;
  elementName: string;
  elementType: DFDElementType;
  displayId: string;
  relationType?: AnyAssetRelationType;
  /**
   * Qualifier for relations that require one:
   *   SystemUsesRelation:      SystemUsesQualifier
   *   ServiceUsesRelation:     ServiceUsesQualifier
   *   InfraAccessesRelation:   InfraAccessesQualifier
   *   PhysicalAccessesRelation: PhysicalContactQualifier
   */
  qualifier?:
    | SystemUsesQualifier
    | ServiceUsesQualifier
    | InfraAccessesQualifier
    | PhysicalContactQualifier;
  notes?: string;
}

// ==================== DFD ASSET ====================

export interface DFDAsset {
  id: string;
  displayId: string;
  name: string;
  description?: string;
  assetGroup: AssetGroup;
  protectionNeed?: "low" | "medium" | "high" | "critical";
  linkedElements?: ElementRelation[];
  assetToAssetRelations?: AssetToAssetRelation[];
  properties?: AssetProperties;
}
