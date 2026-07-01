// ==================== ELEMENT PROPERTIES ====================
// Property interfaces for DFD canvas elements (Describe View).
//
// Conceptual separation:
//   element-properties.ts  → DFD canvas element descriptions (this file)
//   asset-types.ts         → Asset Tab impact analysis (AssetProperties, DFDAsset)
//
// NO dependencies on dfd-types to avoid circular imports.
//

import type {
  ExposureLevel,
  PhysicalExposureLevel,
  PhysicalMobility,
  PhysicalMonitoringType,
  StoredDataType,
  InterfaceLocation,
  BoundaryControlType,
  SecurityControlRecord,
} from "./element-shared-types";

import type {
  SensorProperties,
  ActuatorProperties,
  CouplingMode,
  Injectability,
  Controllability,
} from "./transducer-properties";

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
  /**
   * TLS termination capability of this endpoint — DECOUPLED from auth.
   * Encryption capability ≠ auth mechanism (an HTTPS server with a password
   * login is tlsTermination="server" + authenticationRequired="password").
   * Usage side: DataFlow.encryptionInTransit. Validated pair-level in A5b.
   *   none   → does not terminate TLS
   *   server → server-side TLS (presents server cert)
   *   mutual → mutual TLS (presents + verifies client cert)  [mutual ⊃ server]
   */
  tlsTermination?: "none" | "server" | "mutual";

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

  // ── Security Controls (CR mapping) ──────────────────────────────────────────

  /**
   * Protection from malicious code / unauthorized software execution.
   * CR 3.2 / SAR 3.2 / EDR 3.2 / HDR 3.2 / NDR 3.2
   * SL-1 through SL-4 (all levels).
   *
   * Threat-gen implication:
   *   none                → Malware injection / unauthorized code execution threat active
   *   av_software         → AV/EDR installed — detects known malware signatures (HDR 3.2)
   *   application_whitelist → Only allowlisted binaries may execute — strong control
   *   code_signing        → Only cryptographically signed code executes (EDR 3.2 RE1)
   *   nx_dep              → Hardware NX/DEP — prevents code execution in data regions
   *   sandbox             → Sandbox / container isolation — limits blast radius
   *   custom              → Proprietary mechanism — document in notes
   *
   * Relevant for: rtos_task, driver, bootloader, bare_metal, protocol_stack
   */
  malwareProtection?:
    | "none"
    | "av_software"
    | "application_whitelist"
    | "code_signing"
    | "nx_dep"
    | "sandbox"
    | "custom";

  /**
   * Fail-safe output state when normal operation cannot be maintained.
   * CR 3.6 — Deterministic output. SL-1 through SL-4.
   *
   * Defines what this process outputs when it detects an attack, error, or
   * loss of normal operation. Critical for safety-relevant processes.
   *
   * not_defined      → No fail-safe defined — Tampering threat fully active
   * unpowered        → Outputs fall to de-energized / unpowered state
   * hold_last_value  → Outputs hold last known good value (PLC "hold" mode)
   * fixed_value      → Outputs go to a configurable safe fixed value
   * dynamic          → Context-dependent — describe in notes
   *
   * Threat implication:
   *   not_defined → CR 3.6 Gap — uncontrolled output state under attack
   *   Any other value → CR 3.6 satisfied at SL-1
   *
   * Only meaningful for processSemantic = "functional_block" with direct
   * process I/O, or safetyRelevant = true.
   */
  failSafeOutputState?:
    | "not_defined"
    | "unpowered"
    | "hold_last_value"
    | "fixed_value"
    | "dynamic";

  /**
   * Account management mechanism — how user accounts are provisioned and managed.
   * CR 1.3 — Account management. SL-1 through SL-4.
   *
   * Threat-gen implication:
   *   local_only       → No central revocation — stale/rogue accounts persist
   *   ldap / active_directory / radius → Central revocation possible; CR 1.3 satisfied
   *   iam              → Cloud IAM — centralized, policy-driven
   *   custom           → Proprietary — document in notes
   *
   * Combined with authorizationModel for full CR 1.3 compliance evidence.
   */
  accountManagement?:
    | "local_only"
    | "ldap"
    | "active_directory"
    | "radius"
    | "iam"
    | "custom";

  /**
   * Where authenticators (credentials, keys, tokens) are stored and protected.
   * CR 1.5 RE(1) — Hardware security for authenticators. SL-3, SL-4.
   *
   * Threat-gen implication:
   *   software_only → Key material extractable from memory — key theft threat active
   *   tpm           → TPM-protected keys — extraction requires physical attack on TPM
   *   secure_element → SE-protected keys — hardware-enforced non-extractability
   *   hsm           → HSM — highest assurance, tamper-responsive
   *   keychain_os   → OS keychain (iOS Keychain, Android Keystore) — app-level isolation
   *   custom        → Proprietary mechanism
   *
   * Relevant for processes that handle: credentials, certificates, symmetric keys.
   */
  authenticatorStorage?:
    | "software_only"
    | "tpm"
    | "secure_element"
    | "hsm"
    | "keychain_os"
    | "custom";

  /**
   * Session management controls for human-user-facing processes.
   * CR 2.5 (session lock, SL-1+), CR 2.6 (remote termination, SL-2+),
   * CR 2.7 (concurrent session control, SL-3+).
   *
   * Only meaningful for processes with a human user interface:
   * technology = "ui" | "websocket" | "cli" | "api" (with HMI access).
   *
   * sessionLockEnabled:          CR 2.5 — lock after inactivity timeout
   * remoteTerminationEnabled:    CR 2.6 — manual termination by authority
   * maxConcurrentSessions:       CR 2.7 — per-user session limit (0 = unlimited)
   */
  sessionControl?: {
    sessionLockEnabled?: boolean;
    remoteTerminationEnabled?: boolean;
    maxConcurrentSessions?: number;
  };

  /**
   * Non-repudiation mechanism — ability to prove a user took a specific action.
   * CR 2.12 — Non-repudiation. SL-1 through SL-4.
   *
   * none             → No proof possible — Repudiation threat fully active
   * audit_log        → Audit log with user identity + timestamp (CR 2.12 base)
   * digital_signature → Cryptographic signature of actions (CR 2.12 RE1)
   * hardware_backed  → HSM/TPM-secured audit trail (strongest guarantee)
   *
   * Only meaningful for processes with human user interaction.
   */
  nonRepudiation?:
    | "none"
    | "audit_log"
    | "digital_signature"
    | "hardware_backed";

  /**
   * Audit trail of security controls intentionally applied to this element.
   * Managed via DFDNotificationsPanel Apply or manual analyst entry.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

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
   * TLS termination capability of this endpoint — DECOUPLED from auth.
   * Encryption capability ≠ auth mechanism (an HTTPS server with a password
   * login is tlsTermination="server" + authenticationRequired="password").
   * Usage side: DataFlow.encryptionInTransit. Validated pair-level in A5b.
   *   none   → does not terminate TLS
   *   server → server-side TLS (presents server cert)
   *   mutual → mutual TLS (presents + verifies client cert)  [mutual ⊃ server]
   */
  tlsTermination?: "none" | "server" | "mutual";

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

  // ── Security Controls (CR mapping) ──────────────────────────────────────────

  /**
   * Protection from malicious code at system level.
   * CR 3.2 / EDR 3.2 / HDR 3.2 / NDR 3.2 — SL-1 through SL-4.
   *
   * Applies to the system as a whole (complements per-Process malwareProtection).
   * For embedded_controller / gateway: code_signing or application_whitelist.
   * For scada_hmi / workstation: av_software is baseline.
   *
   * @see ProcessProperties.malwareProtection for per-process granularity.
   */
  malwareProtection?:
    | "none"
    | "av_software"
    | "application_whitelist"
    | "code_signing"
    | "nx_dep"
    | "sandbox"
    | "custom";

  /**
   * Account management at system boundary.
   * CR 1.3 — Account management. SL-1 through SL-4.
   *
   * Combined with boundaryAuthentication + authorizationModel for
   * full CR 1.3 compliance evidence.
   *
   * @see ProcessProperties.accountManagement for process-level granularity.
   */
  accountManagement?:
    | "local_only"
    | "ldap"
    | "active_directory"
    | "radius"
    | "iam"
    | "custom";

  /**
   * Where system-level authenticators (credentials, keys, tokens) are protected.
   * CR 1.5 RE(1) — Hardware security for authenticators. SL-3, SL-4.
   *
   * system_software → Keys in software/firmware — extractable
   * tpm             → TPM-bound keys
   * secure_element  → Dedicated SE on the board
   * hsm             → Hardware Security Module (external or on-board)
   * custom          → Proprietary mechanism
   */
  authenticatorStorage?:
    | "system_software"
    | "tpm"
    | "secure_element"
    | "hsm"
    | "custom";

  /**
   * Backup and recovery mechanism for this system.
   * CR 7.3 — Control system backup. CR 7.4 — Recovery and reconstitution.
   * SL-1 through SL-4.
   *
   * Threat-gen implication:
   *   none              → No recovery possible — DoS impact permanent; CR 7.3 Gap
   *   manual_local      → Local backup, manual process — CR 7.3 SL-1 satisfied
   *   automated_local   → Automated local backup — CR 7.3 SL-2 satisfied
   *   automated_remote  → Off-site automated backup — CR 7.3 SL-3 satisfied
   *   redundant_system  → Hot-standby / active-active — CR 7.4 satisfied
   *   vendor_managed    → Vendor-provided backup service
   *
   * CR 7.4 (reconstitution to known secure state) additionally requires
   * updateMechanism to be set to a value that supports rollback.
   */
  backupMechanism?:
    | "none"
    | "manual_local"
    | "automated_local"
    | "automated_remote"
    | "redundant_system"
    | "vendor_managed";

  /**
   * Non-repudiation for system-level actions.
   * CR 2.12 — Non-repudiation. SL-1 through SL-4.
   *
   * Only meaningful for systems with human operator interaction
   * (scada_hmi, workstation, backend_application).
   *
   * @see ProcessProperties.nonRepudiation for process-level granularity.
   */
  nonRepudiation?:
    | "none"
    | "audit_log"
    | "digital_signature"
    | "hardware_backed";

  /**
   * Audit trail of security controls intentionally applied to this element.
   * Managed via DFDNotificationsPanel Apply or manual analyst entry.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

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

export type ExternalEntityType =
  // ── Human ─────────────────────────────────────────────────────────────────
  | "user"                    // End user, operator (IT context)
  | "admin_user"              // Privileged IT admin
  | "operator"                // Machine/plant operator (OT context)
  | "maintenance"             // Maintenance technician — temporarily privileged
  | "contractor"              // External contractor / service technician
  | "device_owner"            // Device/asset owner — manages config + user accounts (IEC 62443: Asset Owner)
 
  // ── System ────────────────────────────────────────────────────────────────
  | "service"                 // Backend service, cloud service, API
  | "remote_service"          // Cloud diagnostics, vendor remote monitoring
  | "scada_hmi"               // SCADA / HMI / DCS system
  | "historian"               // SCADA historian, data archive
  | "gateway"                 // Protocol gateway, OPC-UA proxy, VPN endpoint
  | "update_server"           // OTA / firmware update server
  | "identity_provider"       // IdP, OAuth server, AD/LDAP
  | "external_system"         // ERP, MES, generic third-party system
  | "bot"                     // Automated client, CI/CD pipeline
 
  // ── Infrastructure ────────────────────────────────────────────────────────
  | "network_device"          // Switch, router, firewall
  | "wireless_access_point"   // Industrial WiFi, 868MHz AP, LoRa gateway
  | "remote_access"           // Jump host, VPN appliance, cellular router
 
  // ── Field Device ──────────────────────────────────────────────────────────
  | "controller"              // PLC, RTU, ECU, MCU node
  | "safety_controller"       // SIS, Safety-PLC (IEC 61508)
  | "sensor"                  // Field sensor, sensor node
  | "actuator"                // Valve, contactor, siren, relay output
  | "iot"                     // Connected device — unclassified/mixed
 
  // ── Engineering ───────────────────────────────────────────────────────────
  | "debugger"                // JTAG probe, SWD adapter, Lauterbach, J-Link
  | "engineering_workstation" // Engineering PC, PLC programming station
  | "programming_tool";       // Needle adapter, flash programmer, service dongle

export interface ExternalEntityProperties {
  entityType?: ExternalEntityType;
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

  /**
   * Audit trail of security controls intentionally applied to this element.
   * Managed via DFDNotificationsPanel Apply or manual analyst entry.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

  owner?: string;
  notes?: string;
}

// ==================== DATA STORE PROPERTIES ====================

export interface DataStoreProperties {
  /**
   * Semantic categories of data stored in this store.
   * Multi-select — real stores often contain multiple data classes simultaneously.
   * Drives threat template selection (Information Disclosure, Tampering, etc.).
   * Use "custom" + notes for domain-specific types not covered by the vocabulary.
   * @see StoredDataType
   */
  storedDataTypes?: StoredDataType[];
  dataClassification?:
    | "public"
    | "internal"
    | "confidential"
    | "restricted"
    | "secret";
  encryptionAtRest?: "none" | "yes" | "aes256" | "tde" | "kms" | "custom";

  /**
   * Technical mechanism enforcing access to this store.
   * A DataStore is passive — enforcement always lives in a guarding Process or hardware.
   * This field makes the enforcement mechanism explicit and machine-queryable.
   *
   * Distinct from accessControl (string) which describes the policy
   * (which processes may read/write and under what conditions).
   *
   * none             → No access control — physical access = full access
   * process_enforced → Access only via a dedicated guarding process (API gate)
   * mpu_protected    → MCU Memory Protection Unit isolates the memory region
   * os_permissions   → OS-level file/block permissions
   * crypto_erase     → Encryption-as-access-control — no key = no plaintext
   * custom           → Proprietary mechanism (document in accessControl)
   *
   * Threat implication: "none" → Information Disclosure + Tampering threats generated
   * regardless of dataClassification.
   */
  accessControlMechanism?:
    | "none"
    | "process_enforced"
    | "mpu_protected"
    | "os_permissions"
    | "crypto_erase"
    | "custom";

  /**
   * Policy description — which processes or actors may read/write this store
   * and under what conditions. Free text, complements accessControlMechanism.
   * @example "Write: only P-4 (Persistence Controller) after Auth via P-9.
   *           Read: P-1 (Modbus RTU Master) via pull. No direct external access."
   */
  accessControl?: string;

  /**
   * Integrity protection mechanism for stored data.
   *
   * Replaces boolean — the mechanism determines actual security guarantees:
   *   none      → No protection — undetected manipulation possible
   *   crc       → CRC (detects transmission errors, NOT targeted manipulation)
   *   hash      → Cryptographic hash (SHA-256) — detects changes, no key → attacker
   *               can recompute hash after manipulation
   *   hmac      → HMAC — keyed hash, protects against manipulation if key is secret
   *   signature → Digital signature — asymmetric, strongest guarantee
   *   custom    → Proprietary mechanism
   *
   * Threat implication:
   *   none / crc  → Tampering threat generated (undetected manipulation possible)
   *   hash        → Tampering threat generated (hash recomputable without key)
   *   hmac / signature → Tampering threat mitigated (requires key compromise first)
   *
   * @example DS-3 (Firmware) → "signature" (Secure Boot verification)
   * @example DS-6 (Calibration params) → "none" → Critical Tampering threat
   */
  integrityProtection?:
    | "none"
    | "crc"
    | "hash"
    | "hmac"
    | "signature"
    | "custom";

  backupEnabled?: boolean;

  /**
   * Cryptographic standard compliance for encryption and integrity algorithms.
   * CR 4.3 — Use of cryptography. SL-1 through SL-4.
   *
   * Only meaningful when encryptionAtRest ≠ "none" or integrityProtection ∈ {hmac, signature}.
   *
   * not_assessed  → No assessment performed — CR 4.3 unknown
   * nist_approved → NIST-approved (AES-256, SHA-256+)
   * fips_140_2    → FIPS 140-2 certified module
   * fips_140_3    → FIPS 140-3 certified module
   * custom        → Proprietary — document in notes
   */
  cryptoStandard?:
    | "not_assessed"
    | "nist_approved"
    | "fips_140_2"
    | "fips_140_3"
    | "custom";

  /**
   * Technical mechanism for secure data deletion.
   * Relevant for: device return, end-of-life, GDPR compliance.
   *
   * Distinct from deletionPolicy (string) which describes when/what is deleted.
   *
   * none             → No secure deletion planned — data remains on returned device
   * overwrite        → Overwrite with zeros / random data (note: Flash wear-leveling
   *                    may retain copies — crypto_erase preferred for Flash)
   * factory_reset    → Device-level factory reset clears this store
   * crypto_erase     → Key deletion — only effective if encryptionAtRest ≠ none
   * physical         → Physical destruction of storage medium (end-of-life)
   * retention_period → Automatic deletion after configured retention duration
   * custom           → Proprietary mechanism
   *
   * Threat implication: "none" → Residual Data Exposure threat on device return / DoS
   */
  deletionMechanism?:
    | "none"
    | "overwrite"
    | "factory_reset"
    | "crypto_erase"
    | "physical"
    | "retention_period"
    | "custom";

  /**
   * Policy description — which data is deleted at which event and what is retained.
   * Free text, complements deletionMechanism.
   * @example "Factory Reset clears DS-2 (config) and DS-4 (logs).
   *           DS-3 (firmware) is retained — requires separate service-tool step."
   */
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
    | "nvram" // Non-volatile RAM (safety parameters, last-state);
    // Volatile / direct-access memory (no request/response actor)
    | "shared_memory" // Inter-core / inter-process memory (DPRAM, mailbox, SRAM region)
    | "mmio_register"; // Memory-mapped I/O registers

  /**
   * Access semantics of this store — does access go through a responding actor,
   * or is it direct passive-storage access?
   *
   * Determines the legal dataflow verb on edges touching this store
   * (see dataflow labeling convention):
   *
   * direct_access → Passive memory/storage (load/store, syscall, memory-mapped).
   *                 No responding actor. Read uses `read`, write uses `write`.
   * communication → Active service that answers requests (DB server, broker, cloud).
   *                 Read uses `pull [req]/[resp]`; `read` is NOT permitted.
   *
   * technology is the cause / default driver (via DATASTORE_TECH_DEFAULTS);
   * accessModel is the effect. technology is a heuristic only — it does NOT
   * determine the verb. The analyst may override (accessModelSource = "manual")
   * with a rationale, e.g. an in-process SQLite file tagged "database" →
   * direct_access, or an NFS-mounted filesystem → communication.
   *
   * `write` is NOT gated by accessModel (persistence mutation always uses `write`);
   * only `read` is gated, because it names an access pattern whose semantics depend
   * on whether a responding actor exists.
   *
   * Threat implication:
   *   direct_access → Memory/Storage threat family (TOCTOU, race, residual data,
   *                   MPU bypass, readout via debug)
   *   communication → Channel threat family (request spoofing, response tampering,
   *                   MITM, injection)
   *
   * Plausibility check with accessControlMechanism:
   *   mpu_protected + communication → accessModelRationale required
   *     (an MPU-isolated region is direct memory, not a request/response service)
   */
  accessModel?: "direct_access" | "communication";
  accessModelSource?: "derived" | "manual";
  accessModelRationale?: string;

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

  /**
   * Audit trail of security controls intentionally applied to this element.
   * Managed via DFDNotificationsPanel Apply or manual analyst entry.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

  owner?: string;
  notes?: string;
}

// ==================== DATA FLOW PROPERTIES ====================

// ---------------------------------------------------------------------------
// protocol — grouped by ICS/OT category for clarity
// ---------------------------------------------------------------------------
//
// IT protocols
//   http, https, grpc, mqtt, amqp, websocket, file, database, custom
//
// Embedded bus (no auth, no encryption by design — IEC 62443 baseline risk)
//   can, modbus_rtu, modbus_tcp, modbus_sec, uart, spi, i2c
//
// Fieldbus protocols (IEC 61158 / IEC 61784 family)
//   profibus, foundation_fieldbus, dnp3, controlnet, devicenet, ethernet_ip,
//   profinet, hart, lontalk, bacnet, bacnet_ip, hart_ip, opc_da
//
// IIoT / Secure OT
//   opc_ua  — OPC UA with security profiles (sign + encrypt)
//
// Wireless (ISA/IEC course: wireless field device protocols)
//   wireless_hart  — WirelessHART (IEC 62591) — AES-128 mandatory
//   isa100         — ISA 100.11a — AES-128 mandatory
//   zigbee         — ZigBee (IEEE 802.15.4) — encryption optional
//
// Electrical / Hardwired IO (no protocol — physical signal types)
//   digital_io, dry_contact, relay_output, analog_voltage,
//   analog_current, pulse, pwm

export type Protocol =
  // ── IT / Cloud ────────────────────────────────────────────────────────────
  | "http"
  | "https"
  | "grpc"
  | "mqtt"
  | "amqp"
  | "websocket"
  | "file"
  | "database"
  // ── Embedded bus ─────────────────────────────────────────────────────────
  | "can" // CAN bus — no auth, no encryption
  | "lin" // LIN bus — no auth, no encryption
  | "modbus_rtu" // Modbus RTU/ASCII (RS-232/RS-485) — no auth, no encryption
  | "modbus_tcp" // Modbus/TCP (port 502) — no auth, no encryption
  | "modbus_sec" // Modbus/TCP Security (port 802, TLS) — IEC 62443 SL2+
  | "uart" // UART serial — no auth, no encryption
  | "spi" // SPI bus — no auth, no encryption
  | "i2c" // I2C bus — no auth, no encryption
  // ── Fieldbus ─────────────────────────────────────────────────────────────
  | "profibus" // Profibus DP/PA (IEC 61158) — no auth, no encryption
  | "foundation_fieldbus" // Foundation Fieldbus H1/H2 — no auth, no encryption
  | "dnp3" // DNP3 (IEEE 1815) — no auth by default
  | "controlnet" // ControlNet (IEC 61158) — no auth, no encryption
  | "devicenet" // DeviceNet (IEC 62026-3) — no auth, no encryption
  | "ethernet_ip" // EtherNet/IP (IEC 61158 type 2) — no auth by default
  | "profinet" // PROFINET (IEC 61158 type 10) — no auth by default
  | "hart" // HART (IEC 61518) — no auth, no encryption
  | "lontalk" // LonTalk / LonWorks — no auth, no encryption
  | "bacnet" // BACnet MS/TP — no auth, no encryption
  | "bacnet_ip" // BACnet/IP (ASHRAE 135) — no auth by default
  | "hart_ip" // HART-IP — no auth by default
  | "opc_da" // OPC DA / AE / HDA (DCOM-based) — no auth
  | "canopen" // CANopen (CiA 301) — no auth, no encryption
  | "s7comm" // Siemens S7 (S7comm / ISO-on-TCP) — no auth by default
  | "iec61850" // IEC 61850 MMS/GOOSE/SV — no auth by default
  // ── Secure OT ────────────────────────────────────────────────────────────
  | "opc_ua" // OPC UA — sign + encrypt via security profiles
  // ── Wireless ─────────────────────────────────────────────────────────────
  | "wireless_hart" // WirelessHART (IEC 62591) — AES-128 mandatory
  | "isa100" // ISA 100.11a — AES-128 mandatory
  | "zigbee" // ZigBee (IEEE 802.15.4) — optional AES-128
  // ── Electrical / Hardwired IO ─────────────────────────────────────────────
  | "digital_io" // Generic discrete I/O — no auth, physical access required
  | "dry_contact" // Potential-free contact / relay — safety-relevant
  | "relay_output" // Relay-switched output — safety-relevant
  | "analog_voltage" // Generic analog voltage (0-10V range) — spoofable
  | "analog_current" // Current loop (4-20mA range) — spoofable
  | "pulse" // Pulse/frequency signal — counter manipulation
  | "pwm" // Pulse-width modulation — control manipulation
  // ── Human-Machine Interaction ─────────────────────────────────────────────
  | "human_input" // Local operator interaction (touch, keypad, buttons) — no
  //                  network transport; logical abstraction of a human action.
  //                  Threat focus: unauthorized local operation, input spoofing.
  // ── Other ────────────────────────────────────────────────────────────────
  | "custom";

// ---------------------------------------------------------------------------
// endpointAuthentication — extended with OT/ICS auth methods
// ---------------------------------------------------------------------------
//
// ISA/IEC 62443 auth categories:
//   Password-based   — username + password (SCADA HMI, OPC server login)
//   Biometric        — fingerprint, facial recognition (operator stations)
//   Token-based      — smart card, hardware token, security key
//   MFA              — two-factor or multi-factor combination
//   Symmetric key    — shared secret (WirelessHART, ISA100, legacy OT)
//   Certificate      — X.509 PKI (OPC UA, HTTPS, mTLS)
//   API key          — pre-shared key (REST APIs, cloud connectors)
//   OAuth            — delegated auth (cloud, IIoT platforms)
//   Mutual TLS       — client + server cert (high-assurance OT gateways)

type EndpointAuthentication =
  | "none"
  | "password" // Username + password (SCADA, HMI login)
  | "symmetric_key" // Shared symmetric key (WirelessHART, ISA100, legacy OT)
  | "token" // Hardware token / smart card / security key
  | "mfa" // Multi-factor authentication (combination of ≥2 factors)
  | "biometric" // Biometric (fingerprint, facial recognition — operator stations)
  | "certificate" // X.509 certificate — PKI-based
  | "apikey" // Pre-shared API key
  | "oauth" // OAuth 2.0 / delegated authorization
  | "mutual_tls"; // Mutual TLS — client + server certificate

/**
 * Nature of a DataFlow edge — ORTHOGONAL to `location` (which is the cyber
 * routing PATH of a logical flow: on_chip … internet).
 *
 *   logical   → carries data/signals. Default. All classic cyber templates apply.
 *   physical  → a transduction COUPLING between a transducer (Sensor/Actuator)
 *               and the physical environment (modelled as an ExternalEntity).
 *               No data semantics — the "payload" is the measurand/effect itself
 *               (road→radar, sound→mic, motor→shaft). Cyber controls (encryption,
 *               endpoint auth, TB crossing, routing-medium DoS) do NOT apply;
 *               the physical-coupling group below gates transduction threats.
 *
 * undefined is treated as "logical".
 */
export type DataFlowMedium = "logical" | "physical";

export interface DataFlowProperties {
  protocol?: Protocol;
  direction?: "unidirectional" | "bidirectional" | "requestresponse";

  /**
   * Transmission frequency pattern.
   *   continuous   → Uninterrupted stream (analog signals, video)
   *   periodic     → Regular polling interval (Modbus, HART, SCADA)
   *   ondemand     → Request-triggered (HTTP, OPC UA, database)
   *   batch        → Bulk transfer at intervals (file sync, log upload)
   *   event_based  → Triggered by state change (dry contact, alarm, MQTT pub)
   */
  frequency?: "continuous" | "periodic" | "ondemand" | "batch" | "event_based";

  /**
   * Primary semantic type of data carried by this flow.
   * Drives threat heuristics — e.g. credentials → Spoofing priority,
   * firmware → Tampering critical, command → Repudiation + Tampering.
   *
   *   measurement  → Sensor value (temperature, pressure, current, flow)
   *   command      → Control instruction (setpoint, enable, start/stop)
   *   status       → State report (running, fault, ready, position)
   *   alarm_event  → Alarm or event notification (E-Stop, limit breach)
   *   config       → Configuration or parameter data
   *   credentials  → Auth tokens, certificates, keys, passwords
   *   firmware     → Firmware or software update package
   *   log_audit    → Log, audit trail, or diagnostic data
   *   pii          → Personal data (GDPR-relevant)
   *   telemetry    → Aggregated operational / diagnostic metrics
   *   custom       → Other — describe in dataTypeNotes
   */
  messageType?:
    | "measurement"
    | "command"
    | "status"
    | "alarm_event"
    | "config"
    | "credentials"
    | "firmware"
    | "log_audit"
    | "pii"
    | "telemetry"
    | "custom";

  /**
   * Confidentiality classification of data in this flow.
   *   public       → Freely shareable, no confidentiality required
   *   internal     → Internal use only — not for external parties
   *   confidential → Restricted — limited distribution, needs protection
   *   secret       → Highest sensitivity — credentials, keys, PII
   */
  dataClassification?: "public" | "internal" | "confidential" | "secret";

  /** Free-text details when messageType=custom or to clarify content. */
  dataTypeNotes?: string;

  /**
   * Access permission enforced on this data flow.
   * Relevant for protocols without native access control (Modbus, CAN, OPC DA).
   *
   * read_only  → Consumer may only read — write/command operations blocked
   *              Modbus: only FC1-4 (read coils/registers) permitted
   *              OPC UA: SessionSecurityDiagnostics.userRolePermissions = read
   *              Threat implication: eliminates Tampering via Write (FC5/FC6/FC15/FC16)
   * read_write → Full bidirectional access (default for most protocols)
   * write_only → Producer may only write — read-back blocked
   *              Rare, but relevant for actuator-only outputs
   *
   * CRA relevance: Article 13 — "minimise attack surfaces"
   * IEC 62443-3-3 SR 2.1: "Authorisation Enforcement"
   */
  accessMode?: "read_only" | "read_write" | "write_only";

  /**
   * Data minimization applied to this flow.
   * Relevant for CRA Article 13 and GDPR data minimization principle.
   *
   * none           → All available data points are exposed (default)
   * filtered       → Subset of registers/topics exposed via allowlist/filter
   * aggregated_only → Only aggregated/anonymised values — no raw data
   *
   * Threat implication:
   *   none       → Information Disclosure surface is maximal
   *   filtered   → Reduces attack surface; filter bypass is a residual threat
   *   aggregated_only → PII/sensitive data not directly accessible
   *
   * CRA relevance: Article 13(1)(d) — "minimise data exposure"
   * GDPR: Article 5(1)(c) — data minimisation
   */
  dataMinimization?: "none" | "filtered" | "aggregated_only";

  volume?: string;
  encryptionInTransit?: "none" | "tls" | "mtls" | "vpn" | "custom";
  /**
   * Integrity protection mechanism for data in transit.
   *
   * Replaces boolean — the mechanism determines actual security guarantees:
   *   none      → No protection
   *   crc       → CRC (detects transmission errors, NOT targeted manipulation —
   *               Modbus RTU frame CRC falls here)
   *   hash      → Cryptographic hash — detects changes, no key
   *   hmac      → HMAC — keyed hash, manipulation-resistant if key is secret
   *   signature → Digital signature — asymmetric, strongest guarantee
   *               (use for firmware update flows)
   *   custom    → Proprietary mechanism
   *
   * Threat implication:
   *   none / crc  → Tampering (MITM data manipulation) threat generated
   *   hmac / signature → Tampering threat mitigated
   *
   * @example DF-1 (Modbus RTU sensor values) → "crc"  — frame CRC present,
   *          not cryptographic — Tampering threat still active
   * @example DF-6 (Firmware Update) → "signature" (SHOULD) — critical gap if absent
   * @example DF-5 (HTTPS Web UI) → "hmac"  — TLS record MAC provides HMAC integrity
   */
  integrityProtection?:
    | "none"
    | "crc"
    | "hash"
    | "hmac"
    | "signature"
    | "custom";
  endpointAuthentication?: EndpointAuthentication;

  // EN 50742 Annex B — Exposure Level
  exposureLevel?: ExposureLevel;
  exposureLevelSource?: "derived" | "manual";
  exposureLevelRationale?: string;

  // ── Physical routing / medium ─────────────────────────────────────────────

  /**
   * Physical medium or routing path this data flow traverses.
   *
   * Semantically distinct from:
   *   Interface.location  — a point (where the connector is)
   *   DataFlow.location   — a path (the medium the flow traverses)
   *   exposureLevel       — the resulting attack surface (the consequence)
   *
   * location is the cause; exposureLevel is the effect.
   * Knowing both enables plausibility checks and medium-specific threat templates.
   *
   * on_chip          → Internal chip bus / register — EL0
   *                    (only reachable via open debug interface)
   * on_board         → PCB trace, same board — EL0/EL1
   * in_enclosure     → Cable/trace within sealed enclosure — EL1
   *                    (requires disassembly to access)
   * field_cable      → External field cable (M12, DIN rail, cable duct) — EL1/EL2
   *                    DoS: plug pull (seconds, no tools) → DoS-Physical threat
   * local_network    → Wired local OT/IT network segment — EL2
   *                    DoS: port flooding, switch overload
   * enterprise_network → OT-IT boundary, enterprise network — EL3
   * wireless_local   → Local wireless (WLAN, Bluetooth) within facility — EL3
   *                    DoS: RF jammer (~30 CHF), 802.11 Deauth attack (no network
   *                    access required) → DoS-Wireless threat
   * internet         → Public network — EL4
   *                    DoS: DDoS, BGP hijack
   * custom           → Proprietary medium
   *
   * Cascade rules:
   *   field_cable | in_enclosure | on_board →
   *     Threat: "Physical Disconnection / Cable Tampering" (STRIDE: D)
   *   wireless_local →
   *     Threat: "RF Jamming / 802.11 Deauth Attack" (STRIDE: D)
   *
   * Plausibility check with exposureLevel:
   *   field_cable + EL1  → consistent (normal case)
   *   field_cable + EL2  → locationRationale required (cable through public area?)
   *   wireless_local + EL4 → locationRationale required (AP internet-exposed?)
   */
  location?:
    | "on_chip"
    | "on_board"
    | "in_enclosure"
    | "field_cable"
    | "local_network"
    | "enterprise_network"
    | "wireless_local"
    | "internet"
    | "custom";

  /**
   * Rationale when location and exposureLevel deviate from the standard mapping,
   * or when the physical path has circumstances requiring documentation.
   * @example "Field cable runs through publicly accessible corridor → EL2 not EL1."
   * @example "WLAN AP is internet-connected in this installation → EL4."
   */
  locationRationale?: string;

  // ── Physical coupling (transduction) ───────────────────────────────────────
  // Only meaningful when medium === "physical". Describes the physical channel
  // that replaced the struck PhysicalChannel element. Value types are shared with
  // Sensor/Actuator (transducer-properties.ts): a coupling and the transducer it
  // feeds reason over the same domain/exposure vocabulary.

  /**
   * Edge nature. "physical" marks a transduction coupling; see DataFlowMedium.
   * Flips the threat templates from cyber to physical and gates the fields below.
   * The graph-builder reads exactly this: `dfProps?.medium === "physical"`.
   */
  medium?: DataFlowMedium;

  /**
   * Channel role — gates which channel threats apply (passive_stimulus vs
   * active_reflection vs emission vs actuation). For an active sensor
   * (radar/LiDAR) the inbound coupling is "active_reflection" → false-echo /
   * ghost-target. @see CouplingMode
   */
  couplingMode?: CouplingMode;

  /**
   * How feasible it is to inject a crafted physical stimulus on this channel.
   * Mitigated by plausibility / diverse redundancy on the Sensor side.
   * @see Injectability
   */
  injectability?: Injectability;

  /**
   * How freely an attacker can shape the environment behind this coupling.
   * @see Controllability
   */
  controllability?: Controllability;

  /**
   * System behaviour when this data flow is interrupted.
   * Drives DoS impact assessment — a flow with no redundancy is a single point
   * of failure; disruption causes immediate, full loss of that data path.
   *
   * Cascade rule: location=field_cable + redundancy=none + high operationalImpact
   *   → Critical DoS threat (physical plug-pull = process blind, no tools required)
   *
   * none      → Single point of failure — complete loss on interruption
   *             @example DF-1 (sensor values via UART): cable pull = process blind
   * failover  → Automatic failover to backup path (transparent to application)
   * degraded  → System continues with reduced functionality
   *             @example DF-5 (WLAN Web UI): device keeps measuring, only HMI lost
   * buffered  → Local buffering bridges short interruptions
   *             @example DF-3 (Profibus): PLC may buffer last known value
   */
  redundancy?: "none" | "failover" | "degraded" | "buffered";

  /**
   * Physical protection applied to the cable or transmission path.
   * Relevant only for physically routed flows: on_board, in_enclosure, field_cable.
   * NOT meaningful for: local_network, enterprise_network, wireless_local, internet.
   *
   * Distinct from Interface.implementedControls.signalProtection:
   *   signalProtection        -> medium property of the cable itself (shielding, fiber)
   *   physicalPathProtection  -> access barrier protecting the routing path
   *
   * Threat-gen implication:
   *   none           -> Physical path unprotected — cable tap / plug-pull feasible
   *   cable_duct     -> Routed inside cable duct/tray — reduces casual access
   *   conduit        -> Inside metal/plastic conduit — raises physical access effort
   *   armored_cable  -> Mechanical cable protection against cut/tap
   *   tamper_seal    -> Tamper-evident seal on connectors/access points — detects breach
   *   locked_cabinet -> Path segments inside locked cabinet — key/tool required
   *   buried         -> Underground cable — excavation required for physical access
   *
   * CRA relevance: Article 13 "minimise attack surfaces"
   * IEC 62443-3-3 SR 3.4: Physical access to communication paths
   */
  physicalPathProtection?:
    | "none"
    | "cable_duct"
    | "conduit"
    | "armored_cable"
    | "tamper_seal"
    | "locked_cabinet"
    | "buried";

  // ---- Safety annotation (optional, non-invasive) ----
  // "Safety Context/Boundary" is NOT a separate DFD element (unlike TrustBoundary).
  // It is a logical categorisation via element properties + automatic detection.
  //
  // Auto-derivation of crossesSafetyBoundary:
  //   source.safetyFunction !== "none" XOR target.safetyFunction !== "none"
  //   → crossesSafetyBoundary = true
  //
  // Computed helper (not stored): safetyRelevant = safetyFunction !== undefined
  //                                              && safetyFunction !== "none"
  //
  // Threat implication: flows crossing the safety boundary require extra scrutiny
  // for Tampering and Information Disclosure (EN 50742: safety-relevant interfaces).

  /**
   * Safety function supported or carried by this data flow.
   *
   * Replaces safetyRelevant: boolean — the specific function determines threat
   * priority, IEC 61511 SIL relevance, and EN 50742 documentation requirements.
   *
   *   none              → Not safety-relevant
   *   emergency_stop    → E-Stop / STO (Safe Torque Off) signal
   *   safety_gate       → Safety door / light curtain / guard
   *   pressure_relief   → Pressure or temperature safety limit
   *   limit_switch      → End-of-travel / overflow protection
   *   fire_gas          → Fire & gas detection signal
   *   motor_protection  → Motor protection relay / thermal overload
   *   custom            → Other — safetyRationale is required
   *
   * Threat implication:
   *   emergency_stop / safety_gate → Critical Tampering + DoS (SIL-relevant)
   *   pressure_relief / limit_switch → High Tampering (process safety)
   *   fire_gas → High Spoofing + DoS (false alarm / suppression)
   *   motor_protection → Medium Tampering
   */
  safetyFunction?:
    | "none"
    | "emergency_stop"
    | "safety_gate"
    | "pressure_relief"
    | "limit_switch"
    | "fire_gas"
    | "motor_protection"
    | "custom";

  /**
   * This flow connects a safety-relevant element to a non-safety element (or vice versa).
   * Auto-derived by comparing safetyFunction of source and target elements.
   * Can be manually overridden by the analyst.
   */
  crossesSafetyBoundary?: boolean;

  /**
   * Rationale for safety classification — used in EN 50742 / MVO 2027 documentation.
   * Required when safetyFunction === "custom".
   * @example "Carries sensor data used by emergency stop logic"
   */
  safetyRationale?: string;

  /**
   * Cryptographic standard compliance for algorithms used on this flow.
   * CR 4.3 — Use of cryptography. SL-1 through SL-4.
   *
   * Applies when encryptionInTransit ≠ "none" or integrityProtection ∈ {hmac, signature}.
   * Only set this when the specific standard has been assessed.
   *
   * not_assessed  → No compliance assessment performed — CR 4.3 unknown
   * nist_approved → NIST-approved algorithms (AES-256, SHA-256+, ECDH P-256)
   * fips_140_2    → FIPS 140-2 certified implementation
   * fips_140_3    → FIPS 140-3 certified implementation
   * custom        → Proprietary or region-specific — document in notes
   */
  cryptoStandard?:
    | "not_assessed"
    | "nist_approved"
    | "fips_140_2"
    | "fips_140_3"
    | "custom";

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

  /**
   * Audit trail of security controls intentionally applied to this element.
   * Managed via DFDNotificationsPanel Apply or manual analyst entry.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

  notes?: string;
}

// ==================== INTERFACE TYPE ====================
// Exported as a standalone type (like Protocol) so interface-type-registry.ts
// can use it as the Record key without importing from element-properties.

export type InterfaceType =
  // ── Network / Wireless ───────────────────────────────────────────────
  | "ethernet" // Wired Ethernet (10/100/1000, PoE)
  | "wifi" // IEEE 802.11 — no physical access required
  | "bluetooth" // BT Classic / BLE — no physical access required
  | "nfc" // NFC — proximity required (~10cm)
  | "fiber" // Fibre optic — physical tap required
  // ── Serial / Bus ────────────────────────────────────────────────────
  | "uart" // UART/USART — often unprotected console/config
  | "rs232" // RS-232 — point-to-point serial, legacy
  | "rs485" // RS-485 / Modbus — multi-drop, industrial
  | "can" // CAN Bus — automotive/industrial, no auth by default
  | "i2c" // I²C — short-range internal bus to sensors/EEPROMs
  | "spi" // SPI — high-speed internal bus, peripherals
  | "lin" // LIN Bus — automotive, single-wire serial
  // ── USB ─────────────────────────────────────────────────────────────
  | "usb" // USB (any class) — DFU, HID, CDC, storage
  // ── Debug / Programming ─────────────────────────────────────────────
  | "jtag" // JTAG — full debug: CPU halt, memory R/W, flash
  | "swd" // SWD (ARM) — debug + flash programming
  | "swd_swo" // SWD + SWO — debug + lightweight trace (ITM)
  | "jtag_trace" // JTAG + ETM Trace Port — full debug + instruction trace
  // ── Digital I/O ─────────────────────────────────────────────────────
  | "gpio" // General Purpose I/O — digital in/out
  | "analog_in" // Analog Input — ADC channel (sensor, signal)
  | "analog_out" // Analog Output — DAC channel (actuator, signal)
  | "pwm" // PWM Output — motor control, dimming
  // ── Human-Machine Interface ─────────────────────────────────────────
  | "touchscreen" // Local touch HMI — operator interaction surface
  // ── Other ───────────────────────────────────────────────────────────
  | "custom";        // Proprietary / not listed above

// ==================== INTERFACE PROPERTIES ====================

export interface InterfaceProperties {
  // ── Context ──────────────────────────────────────────────────────────────

  type?: InterfaceType;

  /**
   * Physical location of this interface on the device.
   * Structured enum — mirrors DataFlow.location semantics.
   * Used for ExposureLevel derivation and physical attack surface assessment.
   * location is the cause; exposureLevel is the effect.
   * @see InterfaceLocation
   */
  location?: InterfaceLocation;

  /**
   * Operational state of this interface.
   *
   * enabled              → Fully active — full threat surface applies
   * enabled_read_only    → Output only, no input accepted (e.g. UART log-only mode)
   *                        Threat: information disclosure; no command injection path
   * sw_disabled          → Disabled via config/firmware/registry — reversible without
   *                        hardware access. Residual threat: re-enable via SW exploit.
   * hw_disabled          → Disabled via jumper/DIP-switch — requires physical access
   *                        to re-enable. Lower residual risk than sw_disabled.
   * permanent_disabled   → Irreversibly disabled: OTP fuse blown (e.g. STM32 RDP2,
   *                        JTAG-disable fuse), pad unpopulated on PCB, epoxy-filled.
   *                        Threat eliminated — no threat generated for this interface.
   *
   * Threat-gen implication:
   *   enabled             → all threats active
   *   enabled_read_only   → command injection threats suppressed
   *   sw_disabled         → threats at reduced priority + "SW re-enable" attack path
   *   hw_disabled         → threats at low priority + "physical re-enable" residual
   *   permanent_disabled  → no threats generated
   */
  operationalState?:
    | "enabled"
    | "enabled_read_only"
    | "sw_disabled"
    | "hw_disabled"
    | "permanent_disabled";

  /**
   * Physical connector type — attack surface assessment.
   * Relevant for physical penetration testing and CRA Article 13 (attack surface).
   * @example "usb_a" → standard consumer cable usable, no special tool needed
   * @example "swd_10pin" → requires debug probe, higher attacker capability needed
   */
  connectorType?:
    | "rj45" // Standard Ethernet — ubiquitous, no special tool
    | "sfp" // SFP/SFP+ module — requires specific hardware
    | "m12" // Industrial M12 — rugged, field-accessible
    | "usb_a" // USB Type-A — standard consumer cable
    | "usb_c" // USB Type-C — standard consumer cable
    | "micro_usb" // Micro-USB — standard consumer cable
    | "db9" // RS-232 D-Sub 9 — serial console, common on industrial HW
    | "db25" // RS-232 D-Sub 25 — legacy serial
    | "terminal" // Screw/spring terminal block — fieldbus, power
    | "swd_10pin" // SWD 10-pin header — requires debug probe
    | "jtag_20pin" // JTAG 20-pin header — requires debug probe
    | "gpio_header" // 0.1" pin header — requires jumper/probe
    | "pcie" // PCIe slot — internal, board-level
    | "custom"; // Non-standard — document in notes

  connectionSpeed?: "low" | "medium" | "high";

  // EN 50742 Annex B — Exposure Level (primary EL carrier in the graph)
  // Placed in Context: location is the cause, exposureLevel is the effect.
  exposureLevel?: ExposureLevel;
  exposureLevelSource?: "derived" | "manual";
  exposureLevelRationale?: string;

  // ── Implemented Security Controls ────────────────────────────────────────
  //
  // Applied mitigations on this interface — not intrinsic properties.
  // Populated by the analyst directly, or via the Close-Loop apply flow
  // (Risk-Tab mitigation marked "implemented" → DFD notification → Apply).
  //
  // Design principles:
  //   - physical and logical access controls are separated (different threat classes)
  //   - debugProtection is embedded-specific; relevant for jtag/swd/uart/usb
  //   - serviceAccessPolicy complements operationalState (policy vs. actual state)
  //   - abuseProtection relevant for protocol-level flooding (can, uart, ble, modbus)
  //   - monitoringControl: "implemented" framing — a process monitors, not the interface itself
  //   - signalProtection: replaces isShieldedCable boolean with a meaningful enum

  implementedControls?: {
    /**
     * Logical/software access restriction at this interface.
     * Relevant for: uart, usb, ethernet, wifi, bluetooth, rs232, rs485, can, modbus.
     * NOT meaningful for: gpio, analog_in, analog_out, pwm, spi, i2c (no auth capability).
     *
     * Threat-gen implication:
     *   none       → Spoofing / Elevation of Privilege threats active
     *   password   → Spoofing threat reduced; credential theft residual threat
     *   certificate → Spoofing threat mitigated (PKI-based); requires key mgmt
     *   challenge_response → Spoofing mitigated; relay attack residual
     *   secure_pairing     → BLE/NFC specific; MITM risk during pairing window
     *   hardware_token     → Strongest single-factor; physical token loss residual
     */
    logicalAccessControl?:
      | "none"
      | "password"
      | "certificate"
      | "challenge_response"
      | "secure_pairing"
      | "hardware_token"
      | "mfa"; // CR 1.1 RE(2) — Multi-factor authentication; SL-3/SL-4

    /**
     * Link-layer authentication of the interface medium itself.
     * Applies ONLY to interface types with hasLinkAuth=true (wifi, bluetooth,
     * nfc) — the link authenticates association/pairing before any process
     * sees data. For all other types authentication lives on the endpoint
     * (Process.authenticationRequired / DataFlow.endpointAuthentication), NOT
     * here. Abstract mechanism, not a concrete technology (WPA2/WPA3, BLE LE
     * Secure Connections go in mechanismDetail).
     *
     * Threat-gen implication:
     *   none            → link-layer Spoofing threat active (open association)
     *   pre_shared_key  → shared secret; key disclosure / offline-crack residual
     *   certificate_based → PKI (e.g. EAP-TLS); requires key management
     *   pairing         → one-sided pairing; MITM risk during pairing window
     *   mutual_pairing  → both sides authenticated; strongest link-layer option
     *
     * Note: link authentication ("who may associate") is independent of app
     * authorization on the terminating process ("who may do what"). WPA3 on the
     * link does NOT authorize a Modbus write on the process behind it.
     */
    linkAuthentication?:
      | "none"
      | "pre_shared_key"
      | "certificate_based"
      | "pairing"
      | "mutual_pairing";

    /**
     * Optional free-text detail of the concrete link-auth technology, e.g.
     * "WPA3-SAE", "BLE LE Secure Connections", "EAP-TLS". Keeps
     * linkAuthentication abstract while preserving the real-world mechanism for
     * documentation. Analyst-owned; never cascaded.
     */
    mechanismDetail?: string;

    /**
     * Physical access restriction preventing direct connector interaction.
     * Relevant for all interface types — raises attacker effort (IEC 62443 attack feasibility).
     *
     * Threat-gen implication:
     *   none             → Physical access = full attack surface
     *   inside_enclosure → Requires enclosure access (effort: medium)
     *   locked_panel     → Requires key/tool (effort: medium-high)
     *   sealed           → Destructive access only (effort: high)
     *   requires_tool    → Non-destructive but tool-gated (effort: medium)
     *   tamper_evident   → Reduces dwell time; does not prevent access
     */
    physicalAccessProtection?:
      | "none"
      | "inside_enclosure"
      | "locked_panel"
      | "sealed"
      | "requires_tool"
      | "tamper_evident";

    /**
     * Debug interface hardening control.
     * Relevant for: jtag, swd, swd_swo, jtag_trace, uart (console use), usb (DFU).
     * NOT meaningful for network, fieldbus, analog, gpio interfaces.
     *
     * Threat-gen implication:
     *   none              → Full debug access — CPU halt, memory R/W, flash readback
     *   auth_required     → Debug access gated by auth challenge; credential theft residual
     *   limited_commands  → Read-only debug / restricted command set; partial threat reduction
     *   readout_protection → Memory readback blocked (e.g. STM32 RDP1); flash dump mitigated
     *   fused_off         → OTP fuse blown / pad unpopulated — equivalent to permanent_disabled
     *                       for debug; no debug threats generated
     */
    debugProtection?:
      | "none"
      | "auth_required"
      | "limited_commands"
      | "readout_protection"
      | "fused_off";

    /**
     * Policy controlling when this interface is accessible.
     * Complements operationalState (actual state) — this captures the intended policy.
     * Especially relevant for service/debug interfaces in embedded OT systems.
     *
     * always_enabled    → No lifecycle restriction; full production attack surface
     * maintenance_only  → Access restricted to declared maintenance windows
     * factory_only      → Accessible only during manufacturing; should be disabled post-production
     * temporary_enable  → Access granted on-demand (e.g. via service token, time-limited)
     *
     * CRA relevance: Article 13 "minimise attack surfaces" — factory/maintenance policies
     * reduce production attack surface without permanent physical changes.
     */
    serviceAccessPolicy?:
      | "always_enabled"
      | "maintenance_only"
      | "factory_only"
      | "temporary_enable";

    /**
     * Protection against protocol-level abuse (flooding, brute force, spam).
     * Relevant for: uart (brute force), bluetooth (pairing spam), can (flooding),
     *               rs485/modbus (request flooding), ethernet interfaces.
     * NOT meaningful for: gpio, analog, spi, i2c, debug interfaces.
     *
     * none           → No abuse protection — flooding/brute-force threat active
     * rate_limited   → Request rate capped; sustained flood mitigated
     * lockout        → Interface locked after N failed attempts; brute-force mitigated
     * flood_protection → Protocol-level flood detection (e.g. CAN bus load limiter)
     */
    abuseProtection?: "none" | "rate_limited" | "lockout" | "flood_protection";

    /**
     * Implemented monitoring/detection mechanism for this interface.
     * The monitoring logic runs in a process (firmware, OS, security agent) —
     * this field captures whether such a mechanism has been implemented.
     *
     * none           → No detection — attacker operates unobserved
     * usage_logged   → All accesses logged (USB insert, UART connect, login attempt)
     * tamper_logged  → Physical tampering events logged (enclosure open, cable pull)
     * alerted        → Real-time alert on anomalous access; reduces attacker dwell time
     * active_response → Automated response on detection (disable interface, zeroize)
     */
    monitoringControl?:
      | "none"
      | "usage_logged"
      | "tamper_logged"
      | "alerted"
      | "active_response";

    /**
     * Signal/medium protection applied to the cable or transmission path.
     * Replaces isShieldedCable: boolean — the mechanism determines the threat class.
     * Relevant for physical interfaces with external cabling (field_cable, in_enclosure).
     * NOT meaningful for: on_chip/on_board interfaces, wireless interfaces.
     *
     * none              → No medium protection — eavesdropping / physical tap possible
     * shielded          → EM shielding (foil/braid); reduces passive eavesdropping
     * twisted_pair      → Differential signalling; reduces common-mode noise/crosstalk
     * fiber_optic       → Optical medium; eliminates galvanic eavesdropping entirely
     * isolated          → Galvanic isolation (optocoupler/transformer); no ground path
     * conduit_protected → Cable inside protected conduit; raises physical access effort
     */
    signalProtection?:
      | "none"
      | "shielded"
      | "twisted_pair"
      | "fiber_optic"
      | "isolated"
      | "conduit_protected";
  };

  // ── Safety annotation ────────────────────────────────────────────────────

  /**
   * This interface connects to a safety-relevant element or function.
   * EN 50742: "Identification of safety-relevant interfaces".
   * @example USB programming interface on a Safety PLC → safetyRelevant: true
   */
  safetyRelevant?: boolean;
  safetyRationale?: string;

  // ── Audit ─────────────────────────────────────────────────────────────────

  /**
   * Audit trail of security controls intentionally applied to this element.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

  notes?: string;
}

// ==================== TRUST BOUNDARY PROPERTIES ====================

export interface TrustBoundaryProperties {
  boundaryId?: string;
  boundaryType?:
    | "network" // Network segment boundary (VLAN, subnet, firewall zone)
    | "privilege" // Privilege level change (user ↔ admin, process ↔ kernel)
    | "organization" // Organisational boundary (company, department, partner)
    | "cloud" // Cloud service boundary (tenant, region, provider)
    | "legal" // Legal/contractual boundary (data processing agreement)
    | "device" // Logical device boundary (between two connected devices)
    // Embedded-specific boundaries
    | "peripheral" // MCU ↔ external chip (SPI, I2C, UART sensor/EEPROM)
    | "boot" // Bootloader ↔ Application boundary
    | "debug"; // Debug/programming interface (SWD, JTAG, UART console)
  defaultExposureLevel?: ExposureLevel;
  securityAssumptions?: string;

  /**
   * Structured security controls enforced at this boundary.
   * Multi-select from a stable semantic vocabulary.
   * Use customBoundaryControls for vendor/domain-specific controls.
   * @see BoundaryControlType
   */
  boundaryControlTypes?: BoundaryControlType[];

  /**
   * Free-text for vendor-specific, domain-specific, or composite controls
   * not covered by BoundaryControlType.
   * @example "Siemens SCALANCE S615 with Deep Packet Inspection for Profinet"
   * @example "OPC UA Reverse Proxy with certificate allowlist"
   */
  customBoundaryControls?: string;

  /**
   * @deprecated Use boundaryControlTypes + customBoundaryControls instead.
   * Retained for backwards compatibility — migrated on next save.
   */
  boundaryControls?: string;

  monitoringEnabled?: boolean;
  complianceRelevance?: string;

  /**
   * Default traffic policy enforced at this boundary.
   * NDR 5.2 RE(1) — Deny all, permit by exception (SL-2+).
   * NDR 5.2 RE(2) — Island mode capability (SL-3+).
   * NDR 5.2 RE(3) — Fail close on mechanism failure (SL-3+).
   *
   * Only meaningful for boundaryType = "network" | "cloud".
   *
   * allow_all                → No restriction — all zone-crossing flows permitted
   * deny_all_permit_exception → Whitelist-based; only explicitly permitted flows pass
   *                             NDR 5.2 RE(1) satisfied
   * island_mode              → Boundary can isolate zone completely on incident
   *                             NDR 5.2 RE(2) satisfied (implies RE1)
   * fail_close               → On mechanism failure: no traffic passes (fail-safe)
   *                             NDR 5.2 RE(3) satisfied (implies RE1 + RE2)
   *
   * Threat implication:
   *   allow_all → Restricted Data Flow threats active; lateral movement possible
   *   deny_all_permit_exception → Reduces attack surface to explicitly allowed flows
   */
  defaultDenyPolicy?:
    | "allow_all"
    | "deny_all_permit_exception"
    | "island_mode"
    | "fail_close";

  owner?: string;
  notes?: string;
}

// ==================== CHIP BOUNDARY PROPERTIES ====================
// Represents a hardware chip boundary in the DFD.
// Connectable: DataFlows may terminate at or originate from this boundary
// via an Interface element placed on the boundary edge.
//
// Threat classes triggered by chipType:
//   mcu / dsp / som → Firmware Tampering, JTAG Access, Secure Boot Bypass
//   fpga            → Bitstream Tampering, Readback Attack, Partial Reconfig
//   se / hsm        → Key Extraction, Side Channel Attack, Physical Tampering
//
// STRIDE relevance:
//   S — Spoofing via debug interface impersonation
//   T — Tampering with firmware, bitstream, or key material
//   R — Repudiation (no audit trail at hardware level)
//   I — Information Disclosure via readback / side channel
//   D — DoS via debug halt, firmware brick
//   E — Elevation via JTAG full access
 
export interface ChipBoundaryProperties {
  // ── Primary classifier ────────────────────────────────────────────────────
  /**
   * Hardware type of the chip boundary.
   * Drives cascade defaults and threat generator selection.
   */
  chipType?:
    | "mcu" // Microcontroller — STM32, NXP, Renesas, etc.
    | "som" // System-on-Module — Toradex, RPi CM, Variscite, etc.
    | "fpga" // Field Programmable Gate Array — Xilinx, Intel/Altera, Lattice
    | "se" // Secure Element — ATECC608, SLB9670, etc.
    | "hsm" // Hardware Security Module — higher assurance than SE
    | "dsp"; // Digital Signal Processor — threat profile similar to MCU

  // ── Exposure ──────────────────────────────────────────────────────────────
  /**
   * Default exposure level for interfaces on this chip boundary.
   * EL0 = internal only, EL1 = physical access required.
   * SE/HSM typically EL0; MCU/SOM/FPGA typically EL1 (requires disassembly).
   */
  defaultExposureLevel?: ExposureLevel;

  // ── Debug Interface ───────────────────────────────────────────────────────
  /**
   * Type of debug/programming interface present on this chip.
   * "none" = no debug interface (or fully disabled).
   * Drives Interface symbol type suggestion in the form.
   */
  debugInterfacePresent?:
    | "none"
    | "jtag" // Full JTAG — CPU halt, memory access, flash R/W
    | "jtag_trace" // JTAG + Trace Port (ETM) — full debug + instruction trace
    | "swd" // SWD (ARM) — similar capabilities to JTAG
    | "swd_swo" // SWD + SWO — debug + lightweight software trace (ITM)
    | "custom"; // Proprietary debug interface

  /**
   * Debug interface is locked / disabled in production firmware.
   * STM32: RDP Level ≥ 1. FPGA: JTAG fuse blown.
   * Default: false — surfaces threat if interface is present.
   */
  debugInterfaceLocked?: boolean;

  // ── Boot Security ─────────────────────────────────────────────────────────
  /**
   * Secure Boot is enabled — boot chain is cryptographically verified.
   * If false: Bootloader Tampering threat is automatically generated.
   */
  secureBootEnabled?: boolean;

  /**
   * Firmware readback / tampering protection level.
   * Specific to MCU/SOM. Not applicable to FPGA (use bitstreamEncryption).
   *
   * none        → No protection — firmware readable and replaceable
   * rdp_level1  → STM32 RDP1: readback disabled, debug limited
   * rdp_level2  → STM32 RDP2: JTAG fully disabled, mass erase on tamper
   * locked      → Generic: write-protected, no debug
   * encrypted   → Firmware image is encrypted at rest
   */
  firmwareProtection?:
    | "none"
    | "rdp_level1"
    | "rdp_level2"
    | "locked"
    | "encrypted";

  /**
   * FPGA bitstream encryption enabled.
   * Only relevant when chipType = "fpga".
   * If false: Bitstream Readback / Reverse Engineering threat is generated.
   */
  bitstreamEncryption?: boolean;

  // ── Physical / Tamper Protection ──────────────────────────────────────────
  /**
   * Physical tamper protection present on the chip or module.
   *
   * none   → No tamper protection
   * basic  → Enclosure seal, tamper-evident label, potting
   * active → Active tamper detection: voltage glitch, temperature, mesh
   */
  tamperProtection?: "none" | "basic" | "active";

  // ── Supply Chain ──────────────────────────────────────────────────────────
  /**
   * Confidence in the chip supply chain.
   * Relevant for: Hardware Trojan threat class, SOM vendor trust.
   *
   * verified   → Authorized distributor, traceability confirmed
   * unverified → Unknown or grey-market source
   * unknown    → Not assessed
   */
  supplyChainTrust?: "verified" | "unverified" | "unknown";

  // ── Security Controls (CR mapping) ──────────────────────────────────────────

  /**
   * Where authenticators (keys, certificates) are stored and protected on this chip.
   * CR 1.5 RE(1) — Hardware security for authenticators. SL-3, SL-4.
   * EDR 3.12 / 3.13 — Roots of trust provisioning. SL-2+.
   *
   * Derives from chipType when chipType = "se" | "hsm":
   *   se  → authenticatorStorage = "secure_element" (automatic)
   *   hsm → authenticatorStorage = "hsm" (automatic)
   *
   * For mcu / som / fpga: analyst must explicitly set this field if a
   * separate SE/HSM/TPM is present on the chip boundary.
   *
   * software_only   → Keys in firmware/RAM — extractable via debug or side-channel
   * tpm             → TPM on same board — hardware-bound, not extractable normally
   * secure_element  → Dedicated SE (ATECC608, SLB9670) — non-extractable by design
   * hsm             → Full HSM — tamper-responsive, highest assurance
   * custom          → Proprietary mechanism — document in notes
   */
  authenticatorStorage?:
    | "software_only"
    | "tpm"
    | "secure_element"
    | "hsm"
    | "custom";

  /**
   * Cryptographic standard compliance for algorithms used on this chip.
   * CR 4.3 — Use of cryptography. SL-1 through SL-4.
   * EDR 3.12 RE — Roots of trust using approved algorithms.
   *
   * Applies to: encryption, signing, MAC, key derivation functions.
   *
   * not_assessed     → No compliance assessment performed — CR 4.3 unknown
   * nist_approved    → NIST-approved algorithms (AES-256, SHA-256+, ECDH P-256)
   * fips_140_2       → FIPS 140-2 Level 1-4 certified cryptographic module
   * fips_140_3       → FIPS 140-3 certified (newer standard)
   * common_criteria  → Common Criteria EAL 2+ (SE) or EAL 4+ (HSM)
   * custom           → Proprietary or region-specific standard — document in notes
   */
  cryptoStandard?:
    | "not_assessed"
    | "nist_approved"
    | "fips_140_2"
    | "fips_140_3"
    | "common_criteria"
    | "custom";

  // ── Documentation ─────────────────────────────────────────────────────────
  /**
   * Audit trail of security controls intentionally applied to this element.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

  // ---- Safety annotation ----
  /**
   * This chip boundary contains or supports safety-relevant hardware or functions.
   * Used for: EN 50742 "Identification of safety-relevant interfaces".
   * @example Safety MCU (SIL-certified) → safetyRelevant: true
   * @example SE protecting Safety PLC auth key → safetyRelevant: true
   */
  safetyRelevant?: boolean;
  safetyRationale?: string;

  notes?: string;
}

// ==================== PHYSICAL BOUNDARY PROPERTIES ====================
// Represents a spatially-defined physical access barrier in the DFD.
//
// Semantically distinct from TrustBoundary (logical/policy) and
// ChipBoundary (hardware/electrical isolation). PhysicalBoundary models
// the question: "Who can physically reach this?"
//
// Threat classes triggered:
//   device_enclosure / tamper_zone → Firmware Extraction, Debug Attach, Cable Tamper
//   cabinet / room                 → Unauthorized Physical Access, Relay Attack
//   building / vehicle             → Theft, Maintenance Abuse, Sensor Spoofing
//
// STRIDE relevance:
//   S — Relay attack (badge cloning), maintenance impersonation
//   T — Cable tampering, USB insertion, sensor spoofing, debug attachment
//   R — No physical audit trail if monitoringEnabled = false
//   I — Side-channel preparation, debug port access, removable media
//   D — Device theft, physical destruction, power disruption
//   E — Debug access, JTAG attachment, bypassing logical controls physically
//
// Visual convention (draw.io):
//   Color: #1B4F8A (dark navy)   Stroke: long dash   Weight: same as TB/CB

export interface PhysicalBoundaryProperties {
  // ── Primary classifier ────────────────────────────────────────────────────
  /**
   * Physical boundary type.
   * Drives cascade defaults and threat template selection.
   *
   * device_enclosure: Device housing — screws/clips to open, tool required
   * cabinet:          Lockable enclosure (Schaltschrank, server rack)
   * room:             Access-controlled room (server room, production hall)
   * building:         Building or facility perimeter
   * vehicle:          Vehicle, machine, or mobile plant
   * tamper_zone:      Sealed zone with tamper protection (potting, tamper bag)
   */
  boundaryType?:
    | "device_enclosure"
    | "cabinet"
    | "room"
    | "building"
    | "vehicle"
    | "tamper_zone"
    | "custom";

  // ── Exposure ──────────────────────────────────────────────────────────────
  /**
   * Physical exposure level — how reachable is this boundary or its interfaces?
   * Higher = more exposed, aligned with network ExposureLevel direction.
   *
   * PEL0 = Inaccessible (destruction required — potted, chip-decap)
   * PEL1 = Deep internal (multiple barriers to overcome)
   * PEL2 = Internal (one barrier — enclosure, lock, screws)
   * PEL3 = Surface accessible (externally reachable, not directly usable)
   * PEL4 = Directly exposed (no barrier — touchscreen, outdoor port)
   *
   * Combine with accessibility for environmental context (public / controlled).
   * @see PhysicalExposureLevel
   */
  physicalExposureLevel?: PhysicalExposureLevel;

  /**
   * Physical mobility — can the device be removed from its security environment?
   * This is orthogonal to PEL and accessibility. It determines whether an attacker
   * can control the attack environment (time, tools, lab equipment).
   *
   * Only meaningful for boundaryType: "device_enclosure" | "vehicle".
   *
   * fixed          → On-site attack only. Limited time/tools.
   * removable      → Can be extracted (DIN-Rail, plug-in module). Depot attack risk.
   * portable       → Can be taken home. Full lab attack possible. Evil-Maid threat.
   * vehicle_mounted → Moves with vehicle. Mobile but not hand-carried.
   *
   * Critical: portable + safetyRelevant=true generates Calibration Manipulation
   * and Safety-Critical Firmware Implant threats (e.g. calibration device).
   * @see PhysicalMobility
   */
  physicalMobility?: PhysicalMobility;

  /**
   * Physical exposure category of this boundary.
   * Describes HOW OPEN the boundary is — not what mechanism protects it.
   * The protection mechanism is captured separately in physicalAccessControl.
   *
   * Keeping these two fields separate allows clean feasibility scoring:
   *   accessibility  = exposure dimension  ("How open is it?")
   *   physicalAccessControl = mechanism dimension ("What protects it?")
   *
   * public:     No barrier — freely reachable (lobby, outdoor, public area)
   * controlled: Access is restricted by some mechanism (key, badge, PIN)
   * guarded:    Manned + monitored entry — active human presence at boundary
   * sealed:     Destructive access only — potted, welded, tamper-zoned
   */
  accessibility?:
    | "public"
    | "controlled"
    | "guarded"
    | "sealed";

  // ── Physical Security Controls ─────────────────────────────────────────────
  /**
   * Tamper protection mechanism present on or inside this boundary.
   *
   * none:             No tamper protection
   * seal:             Tamper-evident label or seal
   * switch:           Tamper-detection microswitch (triggers on enclosure open)
   * mesh:             Active tamper mesh (conductive — triggers on cut/drill)
   * potting:          Epoxy potting — no rework possible without destruction
   * active_detection: Voltage/temperature/light sensor with zeroize response
   */
  tamperProtection?:
    | "none"
    | "seal"
    | "switch"
    | "mesh"
    | "potting"
    | "active_detection";

  /**
   * Physical access control mechanism enforced at this boundary.
   *
   * none:       No access control
   * key:        Mechanical key (standard or high-security)
   * badge:      RFID/NFC badge (cloneable without second factor)
   * badge_pin:  Badge + PIN — mitigates relay attack risk
   * biometric:  Biometric (fingerprint, iris) — strongest single factor
   * guard:      Manned entry point — identity checked by personnel
   */
  physicalAccessControl?:
    | "none"
    | "key"
    | "badge"
    | "badge_pin"
    | "biometric"
    | "guard";

  /**
   * Physical monitoring mechanism present at this boundary.
   * Drives attack feasibility reduction in the threat scoring model.
   *
   * none             -> No detection capability — attacker operates unobserved
   * camera           -> CCTV/IP camera — post-hoc evidence, not prevention
   * alarm            -> Real-time alert on breach — reduces attacker dwell time
   * soc              -> Alarm routed to SOC — active response capability
   * guard_patrol     -> Periodic manned patrol — detection gap depends on interval
   * tamper_monitoring -> Electronic tamper sensor — often triggers zeroize on ChipBoundary
   *
   * @see PhysicalMonitoringType
   */
  monitoringType?: PhysicalMonitoringType;

  // ── Attack Surface Hints ───────────────────────────────────────────────────
  /**
   * A debug or programming port (JTAG, SWD, UART console) is physically
   * accessible inside or on this boundary without further disassembly.
   * Relevant for: device_enclosure, vehicle, tamper_zone.
   * When true: Debug Attachment and Firmware Readback threats are generated.
   * Distinct from ChipBoundary.debugInterfacePresent which models the port itself —
   * this models whether it is physically reachable from outside the boundary.
   */
  debugInterfaceAccessible?: boolean;

  /**
   * Removable media (USB flash, SD card, CF card) is physically accessible
   * at this boundary without further disassembly.
   * Relevant for: device_enclosure, vehicle.
   * When true: Removable Media Insertion and Data Exfiltration threats generated.
   * Note: models physical accessibility, not policy (allowed/denied by SW).
   */
  removableMediaAccessible?: boolean;

  /**
   * Opening this boundary requires a tool (screwdriver, hex key, etc.).
   * Contributes to physical exposure assessment — raises attacker effort.
   */
  requiresToolAccess?: boolean;

  // ── Safety / Compliance ────────────────────────────────────────────────────
  /**
   * This physical boundary protects safety-relevant hardware or functions.
   * Used for: EN 50742 "Identification of safety-relevant interfaces".
   * @example Schaltschrank housing a safety PLC → safetyRelevant: true
   */
  safetyRelevant?: boolean;
  safetyRationale?: string;

  // ── Audit ──────────────────────────────────────────────────────────────────
  /**
   * Audit trail of security controls intentionally applied to this element.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

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
  | TrustBoundaryProperties
  | PhysicalBoundaryProperties
  | ChipBoundaryProperties
  | SensorProperties
  | ActuatorProperties;