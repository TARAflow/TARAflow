// ==================== ASSET TYPES ====================
// Type definitions for assets in the Asset Tab.
//
// Conceptual separation from element-properties.ts:
//   element-properties.ts  → DFD canvas descriptions (ProcessProperties etc.)
//   asset-types.ts         → Asset Tab impact analysis (AssetProperties, DFDAsset)
//
// Import hierarchy (no cycles):
//   safety-types.ts
//     ↓
//   asset-relation-types.ts
//     ↓
//   asset-types.ts          ← this file
//     ↓
//   dfd-types.ts

import type { AssetGroup } from "./asset-relation-types";
import type {
  AnyAssetRelationType,
  SystemUsesQualifier,
  InfraAccessesQualifier,
  AssetToAssetRelation,
} from "./asset-relation-types";
import type { DFDElementType } from "./dfd-element-types";

// ==================== ASSET PROPERTIES ====================

/**
 * Detailed asset properties for the Asset Tab
 * (impact analysis, CIANAAA protection goals, safety derivation)
 *
 * NOTE: AssetGroup and protectionNeed are top-level attributes
 * on DFDAsset — not here. These properties contain only the
 * detailed, group-specific fields for the Asset Tab.
 *
 * assetGroup here serves as a mirror for category-dependent
 * form fields — the canonical value lives on DFDAsset.assetGroup.
 */
export interface AssetProperties {
  /**
   * Asset group — mirrored from DFDAsset.assetGroup
   * Controls which group-specific fields are displayed
   * Canonical value: DFDAsset.assetGroup (change there, this follows)
   */
  category?: AssetGroup;

  /**
   * Protection need — mirrored from DFDAsset.protectionNeed
   * Canonical value: DFDAsset.protectionNeed
   */
  protectionNeed?: "low" | "medium" | "high" | "critical";

  // ---- Category: Data ----
  /** Data types contained in this asset */
  dataType?: string[];
  /** Data lifecycle */
  lifecycle?: "transient" | "stored" | "archived";

  // ---- Category: System ----
  /** System criticality */
  criticality?: "supporting" | "essential" | "safety_critical";
  /** Network exposure */
  exposure?: "internal" | "dmz" | "internet";

  // ---- Category: Infrastructure ----
  /** Physical access possible */
  physicalAccessPossible?: boolean;
  /** Physical location */
  location?: "factory" | "datacenter" | "field" | "cloud";
  /**
   * Environmental hazard posed by the asset or its location
   * Relevant for the Safety Annotation Layer (EN 50742 / ISO 12100)
   * fire:       Fire hazard (e.g. high-voltage cabinet, battery system)
   * chemical:   Chemical hazard (e.g. coolant system)
   * mechanical: Mechanical hazard (e.g. robot, press, CNC machine)
   * none:       No special environmental hazard
   */
  environmentalHazard?: "fire" | "chemical" | "mechanical" | "none";

  // ---- Category: Process ----
  /** Process is automated */
  automated?: boolean;
  /** Change frequency */
  changeFrequency?: "rarely" | "regular" | "frequent";

  // ---- Category: Human ----
  /** Person's role */
  role?: "operator" | "admin" | "developer" | "external";
  /** Person is security-relevant */
  securityRelevant?: boolean;

  // ---- CIANAAA Protection Goals ----
  // Derived from relation types — analyst confirms or overrides.

  /** Confidentiality */
  confidentialityImpact?: "low" | "medium" | "high" | "critical";

  /** Integrity */
  integrityImpact?: "low" | "medium" | "high" | "critical";

  /** Availability */
  availabilityImpact?: "low" | "medium" | "high" | "critical";

  /**
   * Non-Repudiation (= R in STRIDE)
   * Relevant for: modifies, creates, deletes, transports, executes, monitors
   */
  nonRepudiationRelevant?: boolean;

  /**
   * Authentication — identity proof required
   * Relevant for: reads (critical), uses[network], accesses[remote]
   */
  authenticationRelevant?: boolean;

  /**
   * Authorization — permission check required
   * Relevant for: almost all relation types except is_an
   */
  authorizationRelevant?: boolean;

  /**
   * Accountability — GDPR proof obligation / regulatory responsibility
   * In addition to Non-Repudiation when personalData: true
   */
  accountabilityRelevant?: boolean;

  // ---- Conditional Confidentiality Flags ----

  /**
   * Asset in secure storage (TPM, HSM, OP-TEE)
   * → Activate Confidentiality for "stores" relation
   */
  secureStorage?: boolean;

  /**
   * Asset has trade-secret character
   * → Activate Confidentiality for "is_an" on Process Assets
   */
  businessSecret?: boolean;

  // ---- Accountability Flag ----

  /**
   * Asset contains personal data (GDPR Art. 5 para. 2)
   * → Accountability is derived in addition to Non-Repudiation
   */
  personalData?: boolean;

  // ---- High-Value Asset (Infrastructure) ----
  // Models strategic irreplaceability of Infrastructure Assets.
  // Override Rule: isHighValueAsset === true AND assetDestructionImpact === 'critical'
  //   → Threat priority = CRITICAL, mandatory threats: Tampering, DoS, Physical Damage

  /**
   * Asset is a High-Value Asset (strategically irreplaceable)
   * Required: highValueRationale must be set when true
   */
  isHighValueAsset?: boolean;

  /**
   * Damage extent upon physical destruction of the asset
   * high:     Severe but manageable (e.g. extended downtime)
   * critical: Existentially threatening / not replaceable short-term → Override to CRITICAL
   */
  assetDestructionImpact?: "high" | "critical";

  /**
   * Replacement lead time after total loss
   * Determines the High-Value classification together with assetDestructionImpact
   */
  replacementLeadTime?:
    | "<3m (low)"
    | "3-6m (medium)"
    | "6-12m (high)"
    | ">12m (critical)";

  /**
   * Free-text note on replacement lead time
   * e.g. "Reconfiguration + safety acceptance requires 3 months"
   */
  replacementLeadTimeNote?: string;

  /**
   * Rationale for High-Value classification
   * Required when isHighValueAsset === true
   * Reproduced verbatim in audit documentation
   */
  highValueRationale?: string;

  // ---- Impact Assessment ----

  /** Business impact — financial/operational damage */
  businessImpact?: "low" | "medium" | "high" | "critical";
  businessImpactCategory?: "operational" | "financial" | "privacy" | "reputational";

  /**
   * Physical impact — safety impact on people
   * Automatically mirrored from asset.safety.impact — read-only in UI
   */
  physicalImpact?: "none" | "reversible_injury" | "irreversible_injury" | "fatality";

  // ---- Aggregated Criticality (derived, read-only) ----

  /**
   * Aggregated asset criticality (Business + Physical Impact)
   * Safety Override Rule: fatality/irreversible_injury → always CRITICAL
   */
  aggregatedCriticality?: "low" | "medium" | "high" | "critical";

  /**
   * STRIDE analysis depth — derived from aggregatedCriticality + Trust Boundary
   * Calculated automatically — do not set manually
   */
  strideDepth?: "vertieft" | "fokussiert" | "hochstufig";

  owner?: string;
  notes?: string;
}

// ==================== ELEMENT RELATION ====================

/**
 * Element relation from Asset perspective (Asset → Element)
 * Mirrored representation stored in DFDAsset.linkedElements
 * Automatically mirrored when an AssetRelation is saved
 */
export interface ElementRelation {
  /** Element ID */
  elementId: string;

  /** Element name */
  elementName: string;

  /** Element type */
  elementType: DFDElementType;

  /** Display ID (e.g. "P-1", "DS-1") */
  displayId: string;

  /**
   * Relation type — type-safe across all asset groups
   * e.g. "reads", "stores", "controls", "is_an", "affects_safety"
   */
  relationType?: AnyAssetRelationType;

  /**
   * Qualifier — only for SystemUsesRelation (relationType === "uses")
   * e.g. "authentication", "api", "storage"
   */
  qualifier?: SystemUsesQualifier | InfraAccessesQualifier;

  /** Optional notes */
  notes?: string;
}

// ==================== DFD ASSET ====================

/**
 * Asset in TARAflow
 *
 * Assets are created contextually from the element description form
 * or directly from the Asset Accordion in the Description View.
 *
 * No longer created via DrawIO markers (marker logic removed).
 */
export interface DFDAsset {
  /** Asset identifier (e.g. "A-001") */
  id: string;

  /** Display ID (same as id for consistency) */
  displayId: string;

  /** Asset name */
  name: string;

  description?: string;

  /**
   * Asset group — top-level attribute (not buried in properties)
   * Controls the tab bar [Data] [Systems] [Process] [Infra] [People]
   * and colour coding in the DrawIO layer
   */
  assetGroup: AssetGroup;

  /**
   * Protection need — top-level attribute
   * Displayed directly in AssetRelationSelector (chip colour)
   * without digging into properties
   */
  protectionNeed?: "low" | "medium" | "high" | "critical";

  /**
   * DFD elements linked to this asset
   * Automatically mirrored when an AssetRelation is saved
   * Enables "Asset → which elements?" queries
   */
  linkedElements?: ElementRelation[];

  /**
   * Asset-to-Asset relations (Layer 2 in the TARAflow graph)
   * Direct semantic connections to other assets —
   * independent of DFD elements.
   *
   * Tier 1 Core Rules: analytically active, safety propagation max. Hop 1
   * Tier 2 Domain Extensions: documentary by default, optionally analytical
   *
   * @see taraflow-asset-zu-asset-beziehungen.md
   */
  assetToAssetRelations?: AssetToAssetRelation[];

  /** Detailed asset properties (for the Asset Tab) */
  properties?: AssetProperties;
}