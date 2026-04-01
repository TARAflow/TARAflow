// ==================== ASSET RELATION TYPES ====================
// Type definitions for all asset groups and their relation types
//
// Concept: "Active-Impact Model"
// DFD Element → acts on → Asset
//
// Asset taxonomy (8 categories):
//   Vertical hierarchy: data → function → system → infrastructure
//   Orthogonal:         process | physical | service | human

import type { SafetyAnnotation } from "./safety-types";

// ==================== ASSET GROUP ====================

export type AssetGroup =
  | "data"
  | "function"
  | "system"
  | "infrastructure"
  | "process"
  | "physical"
  | "service"
  | "human";

// ==================== DATA ASSET RELATIONS ====================

export type DataAssetRelationType =
  | "creates"
  | "reads"
  | "modifies"
  | "deletes"
  | "stores"
  | "transports"
  | "is_an";

// ==================== FUNCTION ASSET RELATIONS ====================

/**
 * Function Assets: "What must the system be able to do?"
 * Abstraction between Process (known impl) and System (blackbox).
 * Primary use case: Safety Functions per ISO 12100, IEC 61508.
 */
export type FunctionAssetRelationType =
  | "executes" // Element executes this function (runtime)
  | "invokes" // Element invokes/triggers this function
  | "implements" // Element provides/implements this capability
  | "monitors" // Element monitors this function's state
  | "depends_on" // Element depends on this function (cascade on failure)
  | "is_an";

// ==================== PROCESS ASSET RELATIONS ====================

/**
 * Process Assets: "How is a result produced step by step?" (information in motion)
 * Threat focus: timing manipulation, race conditions, sequencing attacks, deadlocks.
 */
export type ProcessAssetRelationType =
  | "executes" // Element executes the process (runtime instance)
  | "invokes" // Element starts the process
  | "terminates" // Element terminates the process
  | "suspends" // Element suspends the process
  | "monitors" // Element monitors process state at runtime
  | "is_an";

// ==================== SYSTEM ASSET RELATIONS ====================

/**
 * IMPORTANT: "uses" requires a SystemUsesQualifier.
 * "monitors" ≠ "depends_on": monitors = read-only observation (loss → Repudiation),
 * depends_on = hard availability dependency (loss → cascade failure).
 * Both can coexist for the same asset.
 */
export type SystemAssetRelationType =
  | "controls" // Full control (start/stop/configure)
  | "configures" // Changes configuration
  | "monitors" // Read-only observation
  | "uses" // Uses functionality [REQUIRES SystemUsesQualifier]
  | "depends_on" // Hard availability dependency (optional degradationMode in relation)
  | "is_an";

/**
 * Qualifier for "uses" on System Assets.
 *
 * hardware:  Physical hardware interface → Tampering, Physical Attack
 * library:   Shared library/SDK dependency → Dependency Confusion, Code Injection
 * network:   Network communication → MitM, Eavesdropping
 * local:     Local access (IPC, shared memory) → Authorization
 * api:       REST/gRPC/GraphQL endpoint → Injection, Auth Bypass
 * authentication, authorization, storage, computation,
 * messaging, configuration, monitoring, networking: specific subsystem usage
 */
export type SystemUsesQualifier =
  | "hardware"
  | "library"
  | "network"
  | "local"
  | "authentication"
  | "authorization"
  | "api"
  | "storage"
  | "computation"
  | "messaging"
  | "configuration"
  | "monitoring"
  | "networking";

// ==================== INFRASTRUCTURE ASSET RELATIONS ====================

/**
 * Infrastructure: stationary physical environment (buildings, networks, enclosures).
 * Distinct from Physical: Infrastructure is fixed, Physical is mobile.
 * IMPORTANT: "accesses" requires InfraAccessesQualifier.
 */
export type InfraAssetRelationType =
  | "accesses" // Physical zone access [REQUIRES InfraAccessesQualifier]
  | "secures" // Protects the physical asset (lock, access control)
  | "damages" // Can physically damage (sabotage)
  | "powers" // Provides power supply
  | "monitors" // Monitors physical parameters (temp, smoke, intrusion)
  | "is_an";

/**
 * Qualifier for "accesses" on Infrastructure Assets.
 * Describes the access zone (not mobile object contact).
 *
 * on-site:   Access to the premises/facility (factory floor, machine room)
 * proximity: Close-range without entering (RFID range, WiFi perimeter)
 * internal:  Access to enclosure interior (debug header, cabinet interior)
 *
 * Note: "on-site" vs "direct" (PhysicalContactQualifier):
 *   on-site = entering a LOCATION (stationary infra)
 *   direct  = physical CONTACT with an OBJECT (mobile physical asset)
 */
export type InfraAccessesQualifier = "on-site" | "proximity" | "internal";

// ==================== PHYSICAL ASSET RELATIONS ====================

/**
 * Physical Assets: mobile, purely passive objects without embedded systems.
 * (prototypes, tools, physical keys, artwork, machine components without electronics)
 *
 * No DFD element-to-asset path in general — exception: ExternalEntity may use "damages".
 * All other threat paths run via Asset-to-Asset relations (Layer 2).
 *
 * IMPORTANT: "accesses" requires PhysicalContactQualifier.
 */
export type PhysicalAssetRelationType =
  | "accesses" // Physical contact [REQUIRES PhysicalContactQualifier]
  | "damages" // Can damage the asset (ExternalEntity only in DFD)
  | "secures" // Physically secures the asset
  | "monitors" // Monitors physical state (camera, sensor)
  | "is_an";

/**
 * Qualifier for "accesses" on Physical Assets.
 * Describes contact type with a mobile object.
 *
 * direct:   Hands-on manipulation (physical touch)
 * indirect: Proximity without contact (camera, sensor from distance)
 * remote:   Remote access to a networked component controlling the physical object
 *
 * Note: "direct" here = physical contact (≠ SafetyAnnotation.relevance:'direct' = causal immediacy).
 */
export type PhysicalContactQualifier = "direct" | "indirect" | "remote";

// ==================== SERVICE ASSET RELATIONS ====================

/**
 * Service Assets: services fully or partially outside own system boundary.
 * KEY DISTINCTION from System: RESPONSIBILITY BOUNDARY (not interface type).
 *   System Asset: full technical control, own team responsible.
 *   Service Asset: shared or third-party responsibility, SLA-bound.
 *
 * AWS S3 with REST-API = Service Asset (shared responsibility).
 * Own internal auth service = System Asset (full control).
 *
 * IMPORTANT: "uses" requires ServiceUsesQualifier (distinct from SystemUsesQualifier).
 * "configures" = element changes service parameters/settings.
 * "depends_on" = hard dependency with optional degradationMode.
 */
export type ServiceAssetRelationType =
  | "uses" // Uses the service [REQUIRES ServiceUsesQualifier]
  | "configures" // Changes service parameters/settings
  | "monitors" // Monitors service status / availability
  | "depends_on" // Hard availability dependency
  | "is_an";

/**
 * Qualifier for "uses" on Service Assets.
 * Focused on integration patterns (distinct from SystemUsesQualifier).
 *
 * api:     REST/SOAP/gRPC/GraphQL → Injection, Auth Bypass
 * sdk:     SDK/library integration → Dependency Confusion, Code Injection
 * webhook: Event-based integration → Spoofing, Replay Attack
 * managed: Fully managed, no own API access → Availability Risk, Vendor Lock-in
 */
export type ServiceUsesQualifier = "api" | "sdk" | "webhook" | "managed";

// ==================== HUMAN ASSET RELATIONS ====================

/**
 * Human Assets: people as protection subjects (Safety / Security / Privacy).
 * Not threat actors — threat actors are External Entities in the DFD.
 */
export type HumanAssetRelationType =
  | "affects_safety" // Element influences physical safety of this person
  | "affects_privacy" // Element affects privacy / GDPR
  | "identifies" // Element identifies / de-anonymises a person
  | "tracks" // Element tracks / monitors a person
  | "exposes" // Element exposes a person to risk
  | "is_an"; // Element represents this person / role

// ==================== UNION TYPES ====================

export type AnyAssetRelationType =
  | DataAssetRelationType
  | FunctionAssetRelationType
  | ProcessAssetRelationType
  | SystemAssetRelationType
  | InfraAssetRelationType
  | PhysicalAssetRelationType
  | ServiceAssetRelationType
  | HumanAssetRelationType;

// ==================== DISCRIMINATED UNION: ASSET RELATIONS ====================
// is_an is EXCLUSIVE — no other relation for the same asset simultaneously.

export interface IsAnRelation {
  readonly relationType: "is_an";
  assetId: string;
  assetGroup: AssetGroup;
  notes?: string;
  safety?: SafetyAnnotation;
}

// ---- Data ----
export interface DataAssetInteractionRelation {
  readonly relationType: Exclude<DataAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "data";
  notes?: string;
  safety?: SafetyAnnotation;
}
export type DataAssetRelation = IsAnRelation | DataAssetInteractionRelation;

// ---- Function ----
export interface FunctionAssetInteractionRelation {
  readonly relationType: Exclude<FunctionAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "function";
  notes?: string;
  safety?: SafetyAnnotation;
  /** Criticality brake — only for relationType === "depends_on" */
  degradationMode?: boolean;
  degradationDescription?: string;
}
export type FunctionAssetRelation =
  | IsAnRelation
  | FunctionAssetInteractionRelation;

// ---- Process ----
export interface ProcessAssetInteractionRelation {
  readonly relationType: Exclude<ProcessAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "process";
  notes?: string;
  safety?: SafetyAnnotation;
}
export type ProcessAssetRelation =
  | IsAnRelation
  | ProcessAssetInteractionRelation;

// ---- System ----
export interface SystemUsesRelation {
  readonly relationType: "uses";
  assetId: string;
  assetGroup: "system";
  qualifier: SystemUsesQualifier;
  notes?: string;
  safety?: SafetyAnnotation;
}
export interface SystemOtherRelation {
  readonly relationType: Exclude<SystemAssetRelationType, "is_an" | "uses">;
  assetId: string;
  assetGroup: "system";
  notes?: string;
  safety?: SafetyAnnotation;
  /** Criticality brake — only for relationType === "depends_on" */
  degradationMode?: boolean;
  degradationDescription?: string;
}
export type SystemAssetRelation =
  | IsAnRelation
  | SystemUsesRelation
  | SystemOtherRelation;

// ---- Infrastructure ----
export interface InfraAccessesRelation {
  readonly relationType: "accesses";
  assetId: string;
  assetGroup: "infrastructure";
  qualifier: InfraAccessesQualifier;
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

// ---- Physical ----
export interface PhysicalAccessesRelation {
  readonly relationType: "accesses";
  assetId: string;
  assetGroup: "physical";
  qualifier: PhysicalContactQualifier;
  notes?: string;
  safety?: SafetyAnnotation;
}
export interface PhysicalOtherRelation {
  readonly relationType: Exclude<
    PhysicalAssetRelationType,
    "is_an" | "accesses"
  >;
  assetId: string;
  assetGroup: "physical";
  notes?: string;
  safety?: SafetyAnnotation;
}
export type PhysicalAssetRelation =
  | IsAnRelation
  | PhysicalAccessesRelation
  | PhysicalOtherRelation;

// ---- Service ----
export interface ServiceUsesRelation {
  readonly relationType: "uses";
  assetId: string;
  assetGroup: "service";
  qualifier: ServiceUsesQualifier;
  notes?: string;
  safety?: SafetyAnnotation;
}
export interface ServiceOtherRelation {
  readonly relationType: Exclude<ServiceAssetRelationType, "is_an" | "uses">;
  assetId: string;
  assetGroup: "service";
  notes?: string;
  safety?: SafetyAnnotation;
  /** Criticality brake — only for relationType === "depends_on" */
  degradationMode?: boolean;
  degradationDescription?: string;
}
export type ServiceAssetRelation =
  | IsAnRelation
  | ServiceUsesRelation
  | ServiceOtherRelation;

// ---- Human ----
export interface HumanAssetInteractionRelation {
  readonly relationType: Exclude<HumanAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "human";
  notes?: string;
  safety?: SafetyAnnotation;
}
export type HumanAssetRelation = IsAnRelation | HumanAssetInteractionRelation;

// ==================== UNIFIED ASSET RELATION ====================

export type AssetRelation =
  | DataAssetRelation
  | FunctionAssetRelation
  | ProcessAssetRelation
  | SystemAssetRelation
  | InfraAssetRelation
  | PhysicalAssetRelation
  | ServiceAssetRelation
  | HumanAssetRelation;

// ==================== TYPE GUARDS ====================

export function isIsAnRelation(r: AssetRelation): r is IsAnRelation {
  return r.relationType === "is_an";
}
export function isDataRelation(r: AssetRelation): r is DataAssetRelation {
  return r.assetGroup === "data";
}
export function isFunctionRelation(
  r: AssetRelation,
): r is FunctionAssetRelation {
  return r.assetGroup === "function";
}
export function isPhysicalRelation(
  r: AssetRelation,
): r is PhysicalAssetRelation {
  return r.assetGroup === "physical";
}
export function isServiceRelation(r: AssetRelation): r is ServiceAssetRelation {
  return r.assetGroup === "service";
}
export function isSystemUsesRelation(
  r: AssetRelation,
): r is SystemUsesRelation {
  return r.relationType === "uses" && r.assetGroup === "system";
}
export function isServiceUsesRelation(
  r: AssetRelation,
): r is ServiceUsesRelation {
  return r.relationType === "uses" && r.assetGroup === "service";
}
export function isInfraAccessesRelation(
  r: AssetRelation,
): r is InfraAccessesRelation {
  return r.relationType === "accesses" && r.assetGroup === "infrastructure";
}
export function isPhysicalAccessesRelation(
  r: AssetRelation,
): r is PhysicalAccessesRelation {
  return r.relationType === "accesses" && r.assetGroup === "physical";
}
export function hasQualifier(
  r: AssetRelation,
): r is
  | SystemUsesRelation
  | ServiceUsesRelation
  | InfraAccessesRelation
  | PhysicalAccessesRelation {
  return (
    isSystemUsesRelation(r) ||
    isServiceUsesRelation(r) ||
    isInfraAccessesRelation(r) ||
    isPhysicalAccessesRelation(r)
  );
}
export function hasIsAnConflict(
  relations: AssetRelation[],
  assetId: string,
): boolean {
  const forAsset = relations.filter((r) => r.assetId === assetId);
  return forAsset.some(isIsAnRelation) && forAsset.length > 1;
}

// ==================== ASSET-TO-ASSET RELATION TYPES ====================

export type A2ARelationType =
  // Data → Data
  | "derives_from"
  | "aggregates"
  | "supersedes"
  // Function → Function
  | "calls"
  // Process → Process
  | "triggers"
  | "suspends"
  // System → System
  | "integrates"
  // Infrastructure → Infrastructure
  | "powers"
  | "houses"
  // Physical → Physical
  | "mechanically_linked"
  // Service → Service
  | "delegates_to"
  // Human → Human
  | "manages"
  | "reports_to"
  // Data → Process / Function / System / Human
  | "required_by"
  | "consumed_by"
  | "configures"
  | "exposes"
  // Function → Data
  | "creates"
  | "reads"
  | "modifies"
  | "deletes"
  // Function/System → Process/System
  | "implemented_by"
  // Process/System → Function
  | "implements"
  | "invokes"
  // Process/System/Service → Infrastructure
  | "hosted_on"
  | "powered_by"
  // Process → Human / System
  | "operated_by"
  | "runs_on"
  // Physical → Function / System / Infrastructure / Human
  | "enables"
  | "hosts"
  | "controlled_by"
  | "connected_to"
  | "located_in"
  | "endangers"
  // Service → Function / Data / System / Human
  | "provides"
  | "consumes"
  | "integrates_with"
  | "monitors"
  // Human → Physical / Process / Function
  | "owns"
  | "accesses"
  | "responsible_for"
  | "authorized_for"
  // Shared / multi-category
  | "depends_on"
  | "affects_safety"
  | "affects_privacy";

/**
 * Asset-to-Asset relation (Layer 2)
 *
 * Safety propagation defaults:
 *   Core Rules → relevance: 'indirect', source: "derived" (automatic)
 *   To assign 'direct' → requires safety.source: "manual" + rationale (Pflicht)
 *   Hop limit: 1 (project-configurable to max 2)
 *
 * stepOrder: sequential index for invokes (Process→Function) and configures
 *   (Data→Process, Data→Function). Enables detection of Sequencing Attacks.
 */
export interface AssetToAssetRelation {
  sourceGroup: AssetGroup;
  targetGroup: AssetGroup;
  targetAssetId: string;
  relationType: A2ARelationType;
  stepOrder?: number;
  analyticallyActive?: boolean;
  rationale?: string;
  notes?: string;
  safety?: SafetyAnnotation;
  /**
   * Transitive criticality brake — only relevant when relationType === "depends_on".
   * false (default): total failure when target fails → full criticality propagation.
   * true:            source continues in degraded state → criticality damped one level.
   * Documented degradation mode = mitigation evidence for audit report.
   */
  degradationMode?: boolean;
  /** Required when degradationMode === true (IEC 62443-4-1 audit trail) */
  degradationDescription?: string;
}