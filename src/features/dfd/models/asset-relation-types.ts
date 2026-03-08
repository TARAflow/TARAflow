// ==================== ASSET RELATION TYPES ====================
// Type definitions for all asset groups and their relation types
//
// Concept: "Active-Impact Model"
// DFD Element → acts on → Asset
//
// Two perspectives:
// - Attack vector:    How can an attacker compromise the system? (Likelihood)
// - Damage potential: What cascade effects occur on failure? (Impact)
//
// is_an is EXCLUSIVE: an element is either an instance of an asset
// OR has impact relations — never both simultaneously.

import type { SafetyAnnotation } from "./safety-types";

// ==================== ASSET GROUP ====================

/**
 * The five asset groups in TARAflow
 * Corresponds to UI tabs: [Data] [Systems] [Process] [Infra] [People]
 */
export type AssetGroup =
  | "data"
  | "system"
  | "process"
  | "infrastructure"
  | "human";

// ==================== DATA ASSET RELATIONS ====================

/**
 * Relation types for Data Assets
 * Describes impact on data and information
 */
export type DataAssetRelationType =
  | "creates"    // Element creates the Data Asset
  | "reads"      // Element reads the Data Asset
  | "modifies"   // Element modifies the Data Asset
  | "deletes"    // Element deletes the Data Asset
  | "stores"     // Element stores the Data Asset
  | "transports" // Element transports the Data Asset
  | "is_an";     // Element is an instance of the Data Asset

// ==================== PROCESS ASSET RELATIONS ====================

/**
 * Relation types for Process Assets
 * Describes impact on processes and workflows
 */
export type ProcessAssetRelationType =
  | "executes"   // Element executes the process
  | "invokes"    // Element starts/calls the process
  | "terminates" // Element terminates the process
  | "suspends"   // Element suspends the process
  | "monitors"   // Element monitors the process
  | "is_an";     // Element is an instance of the Process Asset

// ==================== SYSTEM ASSET RELATIONS ====================

/**
 * Relation types for System Assets
 * Distinguishes active use (attack vector) from dependencies (impact)
 *
 * IMPORTANT: "uses" requires a SystemUsesQualifier
 */
export type SystemAssetRelationType =
  | "controls"   // Element has full control (start/stop/suspend/configure)
  | "configures" // Element changes configuration
  | "monitors"   // Element observes/reads system state
  | "uses"       // Element uses functionality [REQUIRES QUALIFIER]
  | "depends_on" // Element depends on the system (cascade effect on failure)
  | "is_an";     // Element is an instance of the System Asset

/**
 * Qualifier for "uses" relation on System Assets
 * Specifies which system functionality is used
 * Enables precise attack vector analysis
 */
export type SystemUsesQualifier =
  | "network"         // Network access (uses [network]) → Authentication + Authorization
  | "local"           // Local access (uses [local])     → Authorization
  | "authentication"  // Uses auth function (login, token validation)
  | "authorization"   // Uses permission check (RBAC, ACL)
  | "api"             // Uses API endpoint (REST, gRPC, GraphQL)
  | "storage"         // Uses storage function (DB, filesystem, cache)
  | "computation"     // Uses compute function (ML inference, cryptography)
  | "messaging"       // Uses messaging/queue (MQTT, AMQP, Kafka)
  | "configuration"   // Uses configuration function (settings, feature flags)
  | "monitoring"      // Uses monitoring/logging (metrics, traces)
  | "networking";     // Uses network function (DNS, proxy, load balancer)

/**
 * Qualifier for "accesses" relation on Infrastructure Assets
 * Determines protection goals: remote additionally requires Authentication
 *
 * - local:    Physical on-site access         → Authorization, Non-Repudiation
 * - internal: Access within the facility      → Authorization, Non-Repudiation
 * - remote:   Remote access via network/VPN   → Authentication, Authorization,
 *                                               Non-Repudiation, Accountability
 */
export type InfraAccessesQualifier = "local" | "internal" | "remote";

// ==================== INFRASTRUCTURE ASSET RELATIONS ====================

/**
 * Relation types for Infrastructure Assets
 * Focus on physical state and access protection
 */
export type InfraAssetRelationType =
  | "accesses"  // Element has physical access to the asset
  | "secures"   // Element protects the physical asset (e.g. lock system)
  | "damages"   // Element can physically damage the asset (sabotage)
  | "powers"    // Element provides power supply
  | "monitors"  // Element monitors physical parameters (temp, smoke, intrusion)
  | "is_an";    // Element is an instance of the Infrastructure Asset

// ==================== HUMAN ASSET RELATIONS ====================

/**
 * Relation types for Human Assets
 * People as protection objects (Safety / Security / Privacy)
 */
export type HumanAssetRelationType =
  | "affects_safety"   // Element influences physical safety
  | "affects_privacy"  // Element affects privacy / GDPR
  | "identifies"       // Element identifies / de-anonymises a person
  | "tracks"           // Element tracks / monitors a person
  | "exposes"          // Element endangers / exposes a person
  | "is_an";           // Element represents this person / role

// ==================== UNION TYPES ====================

/**
 * All relation types across all asset groups
 * For generic functions that work group-independently
 */
export type AnyAssetRelationType =
  | DataAssetRelationType
  | ProcessAssetRelationType
  | SystemAssetRelationType
  | InfraAssetRelationType
  | HumanAssetRelationType;

// ==================== DISCRIMINATED UNION: ASSET RELATIONS ====================
// is_an is EXCLUSIVE — it excludes all other relations
// Enforced at the type level, not just by UI validation

/**
 * is_an relation — exclusive, no further relations possible
 * Creates a logically unique bridge for transitive derivations
 */
export interface IsAnRelation {
  readonly relationType: "is_an";
  assetId: string;
  assetGroup: AssetGroup;
  notes?: string;
  safety?: SafetyAnnotation;
}

// ==================== DATA ASSET RELATION ====================

export interface DataAssetInteractionRelation {
  readonly relationType: Exclude<DataAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "data";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type DataAssetRelation = IsAnRelation | DataAssetInteractionRelation;

// ==================== PROCESS ASSET RELATION ====================

export interface ProcessAssetInteractionRelation {
  readonly relationType: Exclude<ProcessAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "process";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type ProcessAssetRelation = IsAnRelation | ProcessAssetInteractionRelation;

// ==================== SYSTEM ASSET RELATION ====================

/**
 * "uses" relation with required qualifier
 * Modelled separately so that qualifier is enforced at compile time
 */
export interface SystemUsesRelation {
  readonly relationType: "uses";
  assetId: string;
  assetGroup: "system";
  qualifier: SystemUsesQualifier; // REQUIRED for uses
  notes?: string;
  safety?: SafetyAnnotation;
}

export interface SystemOtherRelation {
  readonly relationType: Exclude<SystemAssetRelationType, "is_an" | "uses">;
  assetId: string;
  assetGroup: "system";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type SystemAssetRelation =
  | IsAnRelation
  | SystemUsesRelation
  | SystemOtherRelation;

// ==================== INFRASTRUCTURE ASSET RELATION ====================

/**
 * "accesses" relation with required qualifier
 * Determines protection goals: remote additionally requires Authentication
 */
export interface InfraAccessesRelation {
  readonly relationType: "accesses";
  assetId: string;
  assetGroup: "infrastructure";
  qualifier: InfraAccessesQualifier; // REQUIRED for accesses
  notes?: string;
  safety?: SafetyAnnotation;
}

export interface InfraOtherRelation {
  readonly relationType: Exclude<InfraAssetRelationType, "is_an" | "accesses">;
  assetId: string;
  assetGroup: "infrastructure";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type InfraAssetRelation =
  | IsAnRelation
  | InfraAccessesRelation
  | InfraOtherRelation;

// ==================== HUMAN ASSET RELATION ====================

export interface HumanAssetInteractionRelation {
  readonly relationType: Exclude<HumanAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "human";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type HumanAssetRelation = IsAnRelation | HumanAssetInteractionRelation;

// ==================== UNIFIED ASSET RELATION ====================

/**
 * Unified type for all asset relations
 * Used in DFDElement.assetRelations and DFDConnection.assetRelations
 *
 * Discriminated union over assetGroup + relationType enables
 * type-safe processing without casts
 */
export type AssetRelation =
  | DataAssetRelation
  | ProcessAssetRelation
  | SystemAssetRelation
  | InfraAssetRelation
  | HumanAssetRelation;

// ==================== TYPE GUARDS ====================

export function isIsAnRelation(relation: AssetRelation): relation is IsAnRelation {
  return relation.relationType === "is_an";
}

export function isDataRelation(
  relation: AssetRelation
): relation is DataAssetRelation {
  return (relation as DataAssetInteractionRelation).assetGroup === "data"
    || (isIsAnRelation(relation));
}

export function isSystemUsesRelation(
  relation: AssetRelation
): relation is SystemUsesRelation {
  return relation.relationType === "uses";
}

export function isInfraAccessesRelation(
  relation: AssetRelation
): relation is InfraAccessesRelation {
  return relation.relationType === "accesses";
}

/**
 * Returns true if a relation has a qualifier
 * (SystemUsesRelation or InfraAccessesRelation)
 */
export function hasQualifier(
  relation: AssetRelation
): relation is SystemUsesRelation | InfraAccessesRelation {
  return isSystemUsesRelation(relation) || isInfraAccessesRelation(relation);
}

/**
 * Returns true if a set of relations for one asset contains an is_an conflict
 * (is_an must not be combined with other relations for the same asset)
 */
export function hasIsAnConflict(relations: AssetRelation[], assetId: string): boolean {
  const forAsset = relations.filter((r) => r.assetId === assetId);
  const hasIsAn = forAsset.some(isIsAnRelation);
  return hasIsAn && forAsset.length > 1;
}

// ==================== ASSET-TO-ASSET RELATION TYPES ====================
// Layer 2: Direct semantic connections between assets
// Complement the Element→Asset relations (Layer 1)
//
// Two-tier rule set:
//   Tier 1: Core Rules     — generic, analytically active, max. Hop 1
//   Tier 2: Domain Extensions — domain-specific, documentary by default
//
// Propagation limit: Asset→Asset may only propagate relevance: 'indirect'.
// Safety Override Rule does NOT apply at the asset level (only DFD level).
// Standard reference: taraflow-asset-zu-asset-beziehungen.md §3.4

/**
 * All Asset-to-Asset relation types (Core Rules)
 *
 * Within the same category:
 *   Data→Data:           derives_from, aggregates, supersedes
 *   Process→Process:     triggers, depends_on, suspends
 *   System→System:       depends_on, integrates
 *   Infra→Infra:         powers, houses
 *   Human→Human:         manages, reports_to
 *
 * Across categories:
 *   Data→Process:        required_by, consumed_by
 *   Data→Human:          affects_privacy, exposes
 *   Process→System:      runs_on, requires
 *   Process→Human:       affects_safety, affects_privacy, operated_by
 *   System→Infrastructure: hosted_on, powered_by
 *   Human→Process:       responsible_for, authorized_for
 */
export type A2ARelationType =
  // ---- Data → Data ----
  | "derives_from"    // Asset B is derived from Asset A → Tampering transitive
  | "aggregates"      // Asset B aggregates multiple A instances → Tampering, Disclosure
  | "supersedes"      // Asset B replaces Asset A (new firmware etc.) → Tampering, Repudiation
  // ---- Process → Process ----
  | "triggers"        // Process A triggers Process B → Tampering, Spoofing
  | "suspends"        // Process A suspends Process B → DoS
  // ---- System → System ----
  | "integrates"      // System A integrates System B → Tampering, Spoofing
  // ---- Infrastructure → Infrastructure ----
  | "powers"          // Infra A supplies power to Infra B → DoS
  | "houses"          // Infra A physically houses Infra B → Tampering
  // ---- Human → Human ----
  | "manages"         // Person A manages Person B → Elevation of Privilege
  | "reports_to"      // Person A reports to Person B → documentary only
  // ---- Data → Process ----
  | "required_by"     // Data is required for process execution → Tampering, DoS
  | "consumed_by"     // Data is transformed by process → Tampering
  // ---- Data → Human ----
  | "exposes"         // Data exposes a person to risks → Disclosure
  // ---- Process → System ----
  | "runs_on"         // Process runs on system → Tampering, EoP
  | "requires"        // Process requires system → DoS
  // ---- Process → Human ----
  | "operated_by"     // Process is operated by a person → Spoofing, Repudiation
  // ---- System → Infrastructure ----
  | "hosted_on"       // System runs on infrastructure → Tampering
  | "powered_by"      // System is powered by infrastructure → DoS
  // ---- Human → Process ----
  | "responsible_for" // Person is responsible for process → Repudiation
  | "authorized_for"  // Person is authorised to execute process → Spoofing, EoP
  // ---- Shared (multiple categories) ----
  | "depends_on"      // A depends on B (Process→Process, System→System) → DoS
  | "affects_safety"  // Process/Data can endanger people → Tampering, DoS (direct)
  | "affects_privacy"; // Process/Data contains personal data → Disclosure

/**
 * Asset-to-Asset relation (Layer 2 in the TARAflow graph)
 *
 * analyticallyActive:
 *   false (default) → documentary only, no STRIDE/Safety influence
 *   true            → analytically active (Tier 2 Domain Extension)
 *                     Required: rationale must be set
 *                     Safety propagation: max. relevance: 'indirect', one hop only
 */
export interface AssetToAssetRelation {
  /** Source asset group (which category the relation originates from) */
  sourceGroup: AssetGroup;
  /** Target asset group (which category the relation points to) */
  targetGroup: AssetGroup;
  /** ID of the target asset */
  targetAssetId: string;
  /** Relation type */
  relationType: A2ARelationType;
  /**
   * Tier 2: relation is analytically active
   * Default: false (documentary only)
   * If true: required rationale + STRIDE mapping
   */
  analyticallyActive?: boolean;
  /**
   * Rationale — required when analyticallyActive === true
   * Reproduced verbatim in the audit report
   */
  rationale?: string;
  notes?: string;
  safety?: SafetyAnnotation;
}
