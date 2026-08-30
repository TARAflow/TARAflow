// ==================== ASSET PROPERTY TYPES (shared) ====================
// app/features-neutral home for the canonical asset property vocabulary.
//
// Asset-Store SoT consolidation, Phase 4: the enum unions below were moved
// here verbatim from features/dfd/models/dfd-asset-types.ts (re-exported there
// as shims so DFD consumers are unaffected) so that BOTH the DFD feature and
// the Asset feature can reference them without importing each other.
//
// It also defines the CANONICAL, flat `AssetProperties` — the single merged
// property schema (see asset-store-ssot-refactor-v2.md §3.3). It unifies the
// former DFDAsset.properties (rich analytical/safety/CIANAAA block) and the
// asset-tab Asset.properties (HVA block + legacy strings). Naming/type
// conflicts resolved as agreed:
//   - dataType / criticality / location / role  → the typed DFD unions win
//   - secureStorage/businessSecret/personalData → the is-prefixed names win
//     (isSecureStorage / isBusinessSecret / isPersonalData)
//   - ownership: DFD owns structural + CIANAAA derivation; the asset tab fills
//     the HVA sub-block. Fields are written by disjoint tabs, sequentially.
//
// NOT YET WIRED. The DFD-side AssetProperties and the asset-tab
// Asset.properties still exist; this canonical type is introduced additively
// for review. Wiring (point the form at it, drop the double-write) follows in
// the next step.

import type { AssetGroup } from "./asset-group-types";
import type { ValueSource } from "./safety-types";

// ==================== ASSET ENUM TYPES ====================

/**
 * Semantic data types for Data Assets.
 * Parallel to StoredDataType on DataStore — kept separate because
 * Asset and DataStore have different threat implications.
 */
export type AssetDataType =
  | "credentials"       // Passwords, tokens, session keys, API keys
  | "keys_certificates" // Cryptographic keys, X.509 certificates, PKI material
  | "firmware"          // Firmware images, bootloader, software update packages
  | "pii"               // Personal Identifiable Information (GDPR-relevant)
  | "safety_params"     // Safety-relevant parameters (SIL, emergency stop config)
  | "calibration"       // Sensor calibration data, process parameters
  | "config"            // System or application configuration
  | "audit_logs"        // Audit trail, event logs, diagnostic data
  | "telemetry"         // Operational metrics, aggregated sensor data
  | "custom";           // Domain-specific — describe in notes

/**
 * Domain / industry sector of a Process Asset.
 * Values mirror tag-categories.ts domain tags for consistency.
 */
export type AssetDomain =
  | "aerospace"
  | "automotive"
  | "aviation"
  | "consumer"
  | "energy"
  | "finance"
  | "industrial"
  | "medical"
  | "military"
  | "pharma"
  | "public_sector"
  | "railway"
  | "telecom"
  | "transportation"
  | "water";

/**
 * Automation level of a Process Asset.
 * Replaces the boolean `automated` field.
 * Affects threat scenarios: fully_automated processes have no human
 * oversight path — DoS and Tampering threats have higher impact.
 */
export type AutomationLevel =
  | "manual"            // Human-operated, no automation
  | "partly_automated"  // Human-in-the-loop, assisted by automation
  | "fully_automated";  // No human intervention at runtime

/**
 * Physical access control mechanism for Infrastructure Assets.
 * Replaces physicalAccessPossible (boolean) + isPhysicalBarrier (boolean).
 *
 * none:      No physical access control — anyone can reach the asset
 * lock:      Key or combination lock
 * biometric: Fingerprint, iris, or face recognition
 * guard:     Human guard or security personnel
 * barrier:   Physical barrier (cage, enclosure, sealed cabinet)
 * custom:    Domain-specific — document in notes
 */
export type PhysicalAccessControl =
  | "none"
  | "lock"
  | "biometric"
  | "guard"
  | "barrier"
  | "custom";

/**
 * Portability of a Physical Asset.
 * Extends the previous binary fixed/portable with transport method.
 *
 * fixed:             Cannot be moved (installed machinery, embedded component)
 * portable_human:    Can be carried by a person (prototype, key, tool)
 * portable_machine:  Requires mechanical transport (forklift, crane)
 * portable_vehicle:  Transported by vehicle (container, equipment truck)
 */
export type Portability =
  | "fixed"
  | "portable_human"
  | "portable_machine"
  | "portable_vehicle";

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

// ==================== CANONICAL ASSET PROPERTIES (flat) ====================

/**
 * The single, canonical property bag on the asset record. Flat by design:
 * the "group" headings below are documentation, not nested structure — every
 * consumer reads flat (`properties?.isSafetyFunction`). A field applies where
 * its group is relevant; not all fields apply to all asset groups.
 */
export interface AssetProperties {
  // ---- Identity mirrors (canonical value lives on the Asset record) ----
  category?: AssetGroup;
  protectionNeed?: "low" | "medium" | "high" | "critical";
  description?: string;
  owner?: string;
  notes?: string;

  // ---- DATA ----
  /** Canonical: typed array (the asset-tab side was a loose string). */
  dataType?: AssetDataType[];
  lifecycle?: "transient" | "stored" | "archived";
  containsSafetyRelevantData?: boolean;

  // ---- FUNCTION ----
  isSafetyFunction?: boolean;
  externalRefs?: ExternalSafetyRef[];

  // ---- PROCESS ----
  automationLevel?: AutomationLevel;
  changeFrequency?: "rarely" | "regular" | "frequent";
  domain?: AssetDomain;
  regulatoryReference?: string;
  isValidatedProcess?: boolean;
  validationRationale?: string;

  // ---- SYSTEM ----
  /** Canonical: DFD union (the asset-tab side was a loose string). */
  criticality?: "supporting" | "essential" | "safety_critical";
  exposure?: "internal" | "dmz" | "internet";
  safetyRelevant?: boolean;

  // ---- INFRASTRUCTURE ----
  physicalAccessControl?: PhysicalAccessControl;
  /** Canonical: DFD union (the asset-tab side was a loose string). */
  location?: "factory" | "datacenter" | "field" | "cloud";
  environmentalHazard?: "fire" | "chemical" | "mechanical" | "none";

  // ---- PHYSICAL ----
  isUnique?: boolean;
  uniquenessRationale?: string;
  portability?: Portability;

  // ---- SERVICE ----
  serviceType?: "internal" | "external" | "cloud" | "managed";
  responsibility?: "owner" | "shared" | "third-party";
  responsibilityScope?: string;
  providerName?: string;
  slaReference?: string;

  // ---- HUMAN ----
  /** Canonical: DFD union (the asset-tab side was a loose string). */
  role?: "operator" | "admin" | "developer" | "external";
  securityRelevant?: boolean;
  isProtectionTarget?: boolean;

  // ---- SHARED SAFETY (all groups) ----
  safetyImpact?: "none" | "reversible_injury" | "irreversible_injury" | "fatality";
  safetyRationale?: string;
  physicalHazardPotential?: "low" | "medium" | "high";

  // ---- CIANAAA protection goals ----
  // NOT modelled here. Protection goals are formulated per-goal in
  // Asset.securityGoals[] (type/level/formalDescription/source/rationale),
  // which is the live, dialog-backed CIANAAA mechanism. The former flat
  // confidentialityImpact/integrityImpact/availabilityImpact and the
  // nonRepudiation/authentication/authorization/accountability *Relevant/
  // *Source/*Rationale fields were a dead parallel representation (never read,
  // written, or rendered) and are intentionally omitted. The is-prefixed flags
  // below remain — they are live INPUTS to asset-cianaaa-deriver.ts.

  // ---- CIANAAA conditional flags (canonical: is-prefixed names) ----
  /** was DFD `secureStorage` — TPM/HSM/OP-TEE → Confidentiality for "stores". */
  isSecureStorage?: boolean;
  /** was DFD `businessSecret` — trade secret → Confidentiality for is_an on Process. */
  isBusinessSecret?: boolean;
  /** was DFD `personalData` — GDPR Art. 5 → Accountability derived. */
  isPersonalData?: boolean;

  // ---- IMPACT ----
  businessImpact?: "low" | "medium" | "high" | "critical";
  businessImpactCategory?: "operational" | "financial" | "privacy" | "reputational";
  physicalImpact?: "none" | "reversible_injury" | "irreversible_injury" | "fatality";
  physicalImpactSource?: ValueSource;
  physicalImpactRationale?: string;

  // ---- AGGREGATED (derived, read-only) ----
  aggregatedCriticality?: "low" | "medium" | "high" | "critical";
  strideDepth?: "vertieft" | "fokussiert" | "hochstufig";

  // ---- HIGH-VALUE ASSET (asset-tab owned) ----
  isHighValueAsset?: "low" | "medium" | "high" | "critical";
  isHighValueAssetSource?: "derived" | "manual";
  assetDestructionImpact?: "low" | "medium" | "high" | "critical";
  replacementLeadTime?:
    | "<3m (low)"
    | "3-6m (medium)"
    | "6-12m (high)"
    | ">12m (critical)";
  replacementLeadTimeNote?: string;
  vendorDependency?: "multi_vendor" | "limited" | "single_source";
  spareAvailability?: "on_site" | "supplier" | "none";
  highValueRationale?: string;

  // ---- Legacy asset-tab strings (carried over; retirement is a separate step) ----
  dataClassification?: string;
  retentionPeriod?: string;
  systemType?: string;
  backupInterval?: string;
  infrastructureType?: string;
  redundancy?: string;
  processType?: string;
  updateFrequency?: string;
  dependencies?: string;
  clearanceLevel?: string;
  trainingRequired?: string;
}
