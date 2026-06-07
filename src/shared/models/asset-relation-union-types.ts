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

// ==================== HUMAN ASSET RELATIONS ====================

/**
 * Human Assets: people as protection subjects (Safety / Security / Privacy).
 * Not threat actors — threat actors are External Entities in the DFD.
 */
export type HumanAssetRelationType =
  | "endangers" // Element influences physical safety of this person
  | "affects_safety" // Element influences physical safety of this person
  | "affects_privacy" // Element affects privacy / GDPR
  | "identifies" // Element identifies / de-anonymises a person
  | "tracks" // Element tracks / monitors a person
  | "exposes" // Element exposes a person to risk
  | "is_an"; // Element represents this person / role

  export type EnvironmentAssetRelationType =
    | "endangers" // Element gefährdet die Umwelt direkt
    | "monitors" // Element überwacht Umweltparameter (Sensoren)
    | "contaminates" // Element kann Umwelt kontaminieren (Chemie, OT)
    | "is_an";

  // ==================== UNION TYPES ====================
  
  export type AnyAssetRelationType =
    | DataAssetRelationType
    | FunctionAssetRelationType
    | ProcessAssetRelationType
    | SystemAssetRelationType
    | InfraAssetRelationType
    | PhysicalAssetRelationType
    | ServiceAssetRelationType
    | HumanAssetRelationType
    | EnvironmentAssetRelationType;