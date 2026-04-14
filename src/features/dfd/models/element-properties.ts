// ==================== ELEMENT PROPERTIES ====================
// Property interfaces for DFD canvas elements (Describe View).
//
// Conceptual separation:
//   element-properties.ts  → DFD canvas element descriptions (this file)
//   asset-types.ts         → Asset Tab impact analysis (AssetProperties, DFDAsset)
//
// NO dependencies on dfd-types to avoid circular imports.
//
// Exposure Levels for crossing dataflows and interfaces:
// ------------------------------------------------------
// EL0 (Internal): Fully trusted, isolated environment with no external access
// EL1 (Physical): Access only through direct physical interaction with interfaces (e.g., USB, RJ45, buttons)
// EL2 (Local): Access via local OT/production network (e.g., fieldbus, SCADA systems)
// EL3 (Adjacent): Access through extended factory/enterprise network (OT–IT boundary)
// EL4 (Public): Access via untrusted external networks (e.g., Internet, remote connections
export type ExposureLevel = "EL0" | "EL1" | "EL2" | "EL3" | "EL4";

// ==================== PROCESS PROPERTIES ====================

export interface ProcessProperties {
  runsAs?:
    | "not_specified"
    | "user"
    | "admin_user"
    | "root"
    | "system"
    | "service"
    | "guest"
    | "anonymous"
    | "contractor";
  privilegeLevel?: "not_specified" | "low" | "medium" | "high" | "root";
  authenticationRequired?:
    | "not_specified"
    | "no"
    | "yes"
    | "optional"
    | "oauth"
    | "saml"
    | "certificate"
    | "apikey"
    | "jwt"
    | "mtls";
  authorizationModel?:
    | "not_specified"
    | "none"
    | "rbac"
    | "abac"
    | "acl"
    | "custom";
  inputValidation?: "not_specified" | "none" | "basic" | "strict" | "schema";
  errorHandling?: "not_specified" | "silent" | "verbose" | "sanitized";
  securityControls?: string;
  exposedToInternet?: boolean;
  technology?:
    | "api"
    | "batch"
    | "ui"
    | "microservice"
    | "lambda"
    | "daemon"
    | "websocket"
    | "event"
    | "cli"
    | "database"
    | "cron"
    | "iot"
    // Embedded / RTOS / Bare-metal
    | "rtos_task" // RTOS task (FreeRTOS, Zephyr, ThreadX)
    | "bare_metal" // Bare-metal logic block / main loop
    | "isr" // Interrupt Service Routine
    | "state_machine" // Safety-relevant FSM
    | "bootloader" // Bootloader — own threat class (firmware integrity)
    | "driver" // Hardware driver — often HW-adjacent, low validation
    | "protocol_stack"; // Protocol stack — own attack surface (CAN, Modbus, etc.)

  /**
   * Semantic role of this process in the model.
   * Separates implementation type (technology) from modelling intent.
   *
   * execution_unit:   OS process, RTOS task, thread — OS-enforced isolation
   * functional_block: Logical responsibility unit — no OS isolation (bare-metal, ISR)
   * security_boundary: Explicit security enforcement point (HSM, OP-TEE TA, Crypto Engine)
   */
  processSemantic?: "execution_unit" | "functional_block" | "security_boundary";
  owner?: string;
  notes?: string;
}

// ==================== MULTI PROCESS PROPERTIES ====================
export interface MultiprocessProperties {
  // ── System Class (primary field) ─────────────────────────────────────────
  /**
   * Overarching system class — determines visible form fields and applicable
   * threat templates. Must be set before the element contributes to threat gen.
   *
   * Class 1 — Dedicated Embedded Controller (PLC, CNC, Robot, ECU, MCU)
   * Class 2 — SCADA / HMI / DCS
   * Class 3 — Backend Application / Server (MES, API, Microservices)
   * Class 4 — Gateway / Edge Device (VPN, Protocol Converter, OPC-UA Proxy)
   * Class 5 — Mobile / Portable Device (Tablet, Handheld, Service App)
   * Class 6 — Cloud Platform / Service (IoT Hub, SaaS, PaaS)
   * Class 7 — Workstation / Engineering PC
   * Class 8 — Safety System — SIS, Safety PLC (SIL-certified, dedicated)
   */
  systemClass?:
    | "embedded_controller" // Class 1: PLC, CNC, Robot, ECU
    | "scada_hmi" // Class 2: SCADA, HMI, DCS
    | "backend_application" // Class 3: MES, API Server, Microservices
    | "gateway" // Class 4: VPN Gateway, Protocol Converter
    | "mobile_device" // Class 5: Tablet, Handheld, Service App
    | "cloud_platform" // Class 6: Cloud Backend, IoT Hub
    | "workstation" // Class 7: Engineering PC, Desktop App
    | "safety_system"; // Class 8: SIS, Safety PLC, SIL-certified

  // ── Platform / OS ────────────────────────────────────────────────────────
  /** Not shown for cloud_platform (PaaS/Serverless — no explicit OS). */
  operatingSystem?:
    | "none" // Bare-Metal
    | "rtos" // FreeRTOS, Zephyr, ThreadX, VxWorks
    | "linux_hardened" // Yocto, Ubuntu Core, Alpine (hardened)
    | "linux_standard" // Standard Linux
    | "windows_hardened" // Windows Embedded, LTSC (hardened)
    | "windows_standard" // Standard Windows
    | "ios" // Apple iOS
    | "android" // Android (MDM-managed or standard)
    | "cloud_managed" // PaaS / Serverless — no explicit OS
    | "custom"; // Proprietary embedded OS

  // ── Security Certification ───────────────────────────────────────────────
  /** Formal security or safety certification achieved or targeted. */
  certificationLevel?:
    | "none"
    | "iec62443_sl1" // IEC 62443 Security Level 1
    | "iec62443_sl2" // IEC 62443 Security Level 2
    | "iec62443_sl3" // IEC 62443 Security Level 3
    | "sil1" // IEC 61508 SIL 1
    | "sil2" // IEC 61508 SIL 2
    | "sil3" // IEC 61508 SIL 3
    | "iso21434" // ISO 21434 Automotive Cybersecurity
    | "fips140_2" // FIPS 140-2 (cryptographic modules)
    | "cc_eal2" // Common Criteria EAL 2+
    | "cc_eal4"; // Common Criteria EAL 4+

  // ── Update Mechanism ─────────────────────────────────────────────────────
  updateMechanism?:
    | "none" // No update planned
    | "manual_local" // Physical access, manual (no signing required)
    | "signed_local" // Signed package, physical access
    | "signed_ota" // Signed Over-the-Air
    | "vendor_only" // Only through manufacturer / supplier
    | "mdm_managed" // Mobile Device Management
    | "ci_cd"; // Automated CI/CD deployment (Cloud / DevOps)

  // ── System-Level Access Control ──────────────────────────────────────────
  /**
   * Authentication mechanism at the system boundary (not internal processes).
   * Semantically distinct from ProcessProperties.authenticationRequired
   * which describes a single process's incoming request auth.
   */
  boundaryAuthentication?:
    | "not_specified"
    | "none"
    | "password"
    | "mfa"
    | "certificate"
    | "mtls"
    | "oauth"
    | "apikey"
    | "hardware_token";

  /**
   * Authorization model enforced at the system boundary.
   * Not applicable for mobile_device (app-internal) or safety_system
   * (hardware-enforced, not configurable at model level).
   */
  authorizationModel?:
    | "not_specified"
    | "none"
    | "rbac"
    | "abac"
    | "acl"
    | "capability_based"; // Common in embedded systems

  // ── Network Exposure ─────────────────────────────────────────────────────
  exposedToInternet?: boolean;
  remoteAccessEnabled?: boolean;

  /**
   * Physically or logically isolated from the network.
   * When true: threat generation reduces or excludes network-based threat paths.
   */
  airGapped?: boolean;

  // ── Multi-Tenant (Cloud / Backend) ───────────────────────────────────────
  /** Relevant for backend_application and cloud_platform only. */
  multiTenant?: boolean;

  // ── Safety ───────────────────────────────────────────────────────────────
  /**
   * This system fulfils a safety function.
   * Influences threat prioritisation and STRIDE template selection.
   * Always true for safety_system — can be set for embedded_controller / scada_hmi.
   */
  safetyRelevant?: boolean;

  /**
   * Rationale for safety classification.
   * Required when safetyRelevant = true for EN 50742 / MVO documentation.
   * @example "Controls emergency stop. SIL-2 certified per IEC 61508."
   */
  safetyRationale?: string;

  // ── Internal Structure (informative) ────────────────────────────────────
  /**
   * Free-text description of internal components.
   * NOT used for threat generation — documentation only.
   * @example "RTOS Tasks: motion_ctrl, comm_stack, safety_monitor + Bootloader"
   */
  internalComponents?: string;

  /**
   * Free-text summary of security controls at system level.
   * @example "SIL-2 certified, Hardware watchdog, no remote update in production"
   */
  securitySummary?: string;

  owner?: string;
  notes?: string;
}

// ==================== EXTERNAL ENTITY PROPERTIES ====================

/**
 * Threat profile for an External Entity — determines the base feasibility
 * of attack tree branches originating from this entity.
 *
 * Used by the attack tree generation engine (Phase 3) to initialise
 * branch feasibility F in the F × B × I scoring model.
 */
export interface ExternalEntityThreatProfile {
  /**
   * Category of the external entity as threat source.
   * Determines base feasibility before barrier reduction.
   *
   * public_network:    Internet, cloud backend, unauthenticated remote access → very_high
   * corporate_it:      Corporate network (MES, ERP) — requires prior IT compromise → medium
   * adjacent_wireless: WiFi, Bluetooth, 5G campus — physical proximity needed → high
   * local_physical:    USB ports, HMI on-site, local service ports → low
   * supply_chain:      Vendor software updates, firmware signing → very_low (high effort)
   * authorized_person: Operator, maintenance with valid credentials → variable
   */
  category:
    | "public_network"
    | "corporate_it"
    | "adjacent_wireless"
    | "local_physical"
    | "supply_chain"
    | "authorized_person";
  /** Base feasibility before barrier reduction */
  baseFeasibility: "very_low" | "low" | "medium" | "high" | "very_high";
  /** Rationale for this assessment (IEC 62443-4-1 traceability) */
  rationale: string;
}

export interface ExternalEntityProperties {
  entityType?:
    | "user"
    | "admin_user"
    | "partner"
    | "thirdparty"
    | "service"
    | "identity_provider"
    | "payment"
    | "contractor"
    | "bot"
    | "webhook"
    | "mobile_app"
    | "iot";
  trustLevel?: "low" | "medium" | "high";
  authenticationMethod?:
    | "none"
    | "password"
    | "mfa"
    | "oauth"
    | "saml"
    | "certificate"
    | "apikey"
    | "mutual_tls"
    | "jwt";
  authorizationScope?: string;
  ownership?: "internal" | "external" | "partner";
  threatActor?:
    | "benign"
    | "curious"
    | "malicious"
    | "advanced"
    | "insider"
    | "compromised";
  contractExists?: boolean;
  rateLimited?: boolean;
  /**
   * Threat profile — base feasibility for attack tree branches from this entity.
   * Optional: set when the analyst wants deterministic F-scoring in Phase 3.
   */
  threatProfile?: ExternalEntityThreatProfile;
  owner?: string;
  notes?: string;
}

// ==================== DATA STORE PROPERTIES ====================

export interface DataStoreProperties {
  storedDataTypes?: string;
  dataClassification?:
    | "public"
    | "internal"
    | "confidential"
    | "restricted"
    | "secret";
  encryptionAtRest?: "none" | "yes" | "aes256" | "tde" | "kms" | "custom";
  accessControl?: string;
  integrityProtection?: boolean;
  backupEnabled?: boolean;
  deletionPolicy?: string;
  technology?:
    | "database"
    | "filesystem"
    | "cloud"
    | "cache"
    | "queue"
    | "blockchain"
    // Embedded storage
    | "flash" // NOR/NAND Flash (firmware, config)
    | "eeprom" // EEPROM (calibration data, device identity)
    | "nvram"; // Non-volatile RAM (safety parameters, last-state);
  multiTenant?: boolean;

  // ---- Safety annotation (convenience flags — full traceability via linked Asset) ----
  // Safety context is canonical on the linked Asset's SafetyAnnotation.
  // These flags enable quick UI filtering without traversing the asset graph.

  /**
   * Store contains safety-relevant configuration data.
   * → Automatic threat prioritisation for modifies / deletes
   * → EN 50742: "Identification of safety-related data assets"
   * When true: mandatory threats: Tampering (integrity), DoS (availability)
   */
  containsSafetyRelevantData?: boolean;

  /**
   * Rationale for safety classification.
   * Used in EN 50742 / MVO 2027 documentation.
   * @example "Manipulation could disable emergency stop function"
   */
  safetyRationale?: string;

  owner?: string;
  notes?: string;
}

// ==================== DATA FLOW PROPERTIES ====================

export interface DataFlowProperties {
  dataTypes?: string;
  protocol?:
    | "http"
    | "https"
    | "grpc"
    | "mqtt"
    | "amqp"
    | "websocket"
    | "file"
    | "database"
    | "custom"
    // Embedded field-bus and serial protocols
    // All default to: direction=unidirectional, endpointAuth=none, encryptionInTransit=none
    | "can" // CAN bus — no auth, no encryption by design
    | "modbus" // Modbus RTU/TCP — no auth, no encryption by design
    | "uart" // UART serial — no auth, no encryption by design
    | "spi" // SPI bus — no auth, no encryption by design
    | "i2c"; // I2C bus — no auth, no encryption by design
  direction?: "unidirectional" | "bidirectional" | "requestresponse";
  frequency?: "continuous" | "periodic" | "ondemand" | "batch";
  volume?: string;
  encryptionInTransit?: "none" | "tls" | "mtls" | "vpn" | "custom";
  integrityProtection?: boolean;
  endpointAuthentication?:
    | "none"
    | "token"
    | "certificate"
    | "apikey"
    | "oauth"
    | "mutual_tls";

  // EN 50742 Annex B — Exposure Level
  exposureLevel?: ExposureLevel;
  exposureLevelSource?: "derived" | "manual";
  exposureLevelRationale?: string;

  // ---- Safety annotation (optional, non-invasive) ----
  // "Safety Context/Boundary" is NOT a separate DFD element (unlike TrustBoundary).
  // It is a logical categorisation via element properties + automatic detection.
  //
  // Auto-derivation of crossesSafetyBoundary:
  //   source.safetyRelevant XOR target.safetyRelevant → crossesSafetyBoundary = true
  //
  // Threat implication: flows crossing the safety boundary require extra scrutiny
  // for Tampering and Information Disclosure (EN 50742: safety-relevant interfaces).

  /**
   * This flow carries safety-relevant data or supports safety functions.
   * Set manually or derived when any linked asset has SafetyAnnotation.relevance !== 'none'.
   */
  safetyRelevant?: boolean;

  /**
   * This flow connects a safety-relevant element to a non-safety element (or vice versa).
   * Auto-derived by comparing safetyRelevant flags of source and target elements.
   * Can be manually overridden by the analyst.
   */
  crossesSafetyBoundary?: boolean;

  /**
   * Rationale for safety classification — used in EN 50742 / MVO 2027 documentation.
   * @example "Carries sensor data used by emergency stop logic"
   */
  safetyRationale?: string;

  /**
   * This flow is assumed to operate in a trusted context.
   * Set explicitly to separate Security modelling intent from Tool behaviour.
   * IEC 62443: "trusted" must be justified — a rationale is required.
   */
  assumedTrusted?: boolean;
  assumedTrustedRationale?: string;

  /**
   * Exclude this data flow from automated threat generation.
   * Only valid when assumedTrusted=true or flow is demonstrably non-reachable.
   * IEC 62443-4-1: Exclusions require documented rationale for audit traceability.
   */
  excludeFromThreatGen?: boolean;
  excludeFromThreatGenRationale?: string;

  notes?: string;
}

// ==================== INTERFACE PROPERTIES ====================

export interface InterfaceProperties {
  type?:
    | "ethernet"
    | "serial"
    | "usb"
    | "gpio"
    | "bluetooth"
    | "wifi"
    | "nfc"
    | "fiber"
    | "custom";
  accessControl?:
    | "none"
    | "physical_lock"
    | "credentials"
    | "card"
    | "certificate";
  connectionSpeed?: "low" | "medium" | "high";
  isShieldedCable?: boolean;
  location?: string;

  // EN 50742 Annex B — Exposure Level (primary EL carrier in the graph)
  exposureLevel?: ExposureLevel;
  exposureLevelSource?: "derived" | "manual";
  exposureLevelRationale?: string;

  // ---- Safety annotation ----
  /**
   * This interface connects to a safety-relevant element or function.
   * Used for: EN 50742 "Identification of safety-relevant interfaces".
   * @example USB programming interface on a Safety PLC → safetyRelevant: true
   */
  safetyRelevant?: boolean;
  safetyRationale?: string;

  notes?: string;
}

// ==================== TRUST BOUNDARY PROPERTIES ====================

export interface TrustBoundaryProperties {
  boundaryId?: string;
  boundaryType?:
    | "network"
    | "privilege"
    | "organization"
    | "cloud"
    | "physical"
    | "legal"
    | "device"
    // Embedded-specific boundaries
    | "peripheral" // MCU ↔ external chip (SPI, I2C, UART sensor/EEPROM)
    | "boot" // Bootloader ↔ Application boundary
    | "debug"; // Debug/programming interface (SWD, JTAG, UART console)
  defaultExposureLevel?: ExposureLevel;
  securityAssumptions?: string;
  boundaryControls?: string;
  monitoringEnabled?: boolean;
  complianceRelevance?: string;
  owner?: string;
  notes?: string;
}

// ==================== UNION TYPE ====================

export type ElementProperties =
  | ProcessProperties
  | MultiprocessProperties
  | ExternalEntityProperties
  | DataStoreProperties
  | DataFlowProperties
  | InterfaceProperties
  | TrustBoundaryProperties;