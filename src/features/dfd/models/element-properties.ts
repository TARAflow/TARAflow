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

// ==================== PHYSICAL EXPOSURE LEVELS ====================
//
// PEL — Physical Exposure Level.
// Describes how physically reachable an interface or boundary is.
// Direction is aligned with network ExposureLevel: higher = more exposed.
// Designed to be combined with PhysicalBoundary.accessibility which captures
// the environmental context (public / controlled / guarded / sealed).
//
// PEL0 (Inaccessible): No access without physical destruction — potted, welded,
//                       chip-decap required. No practical attack surface.
// PEL1 (Deep Internal): Multiple physical barriers to overcome — e.g. JTAG behind
//                       two nested enclosures, or inside a sealed sub-module.
// PEL2 (Internal):      One physical barrier to bypass — open enclosure, unlock
//                       cabinet, remove screws. Tool or key access required.
// PEL3 (Externally Protected): Accessible from outside but with a barrier —
//                       locked panel, service door, badge-controlled port.
// PEL4 (Directly Exposed): No barrier — touchscreen, outdoor port, public USB.
//                       Highest physical attack surface. Combine with
//                       PB.accessibility="public" for full threat context.
//
// Example — Ticket machine:
//   Touchscreen: PEL4, PB.accessibility="public"  → maximum exposure
//   USB-Service: PEL2, PB.accessibility="public"  → one barrier, public context
//   JTAG/SWD:    PEL1, PB.accessibility="public"  → deep internal, public context
//
export type PhysicalExposureLevel = "PEL0" | "PEL1" | "PEL2" | "PEL3" | "PEL4";

// PhysicalMobility — can the device be removed from its security environment?
// This is a qualitatively different threat dimension from PEL or accessibility.
// Mobility determines whether an attacker can control the attack environment:
//
// fixed         → Attack must happen on-site, under time pressure, limited tools.
//                 Offline lab attacks, device substitution: not applicable.
// removable     → Device can be extracted (DIN-Rail module, plug-in card) with some
//                 effort. Enables Depot Attack, Maintenance Abuse, Hardware Swap.
// portable      → Device can be taken home by attacker. Enables full Lab analysis:
//                 Evil-Maid, Firmware Implant, Side-Channel, Chip-Off, Fault Injection,
//                 Device Substitution. Especially critical if safetyRelevant=true
//                 (e.g. calibration device → rogue calibration data injection).
// vehicle_mounted → Device moves with a vehicle. Mobile but not easily hand-carried.
//                 Enables: vehicle theft scenario, depot attack during maintenance.
//
// Key insight: a fixed PLC and a portable calibration device may share identical
// PEL/accessibility/tamper values but have completely different threat landscapes.
export type PhysicalMobility = "fixed" | "removable" | "portable" | "vehicle_mounted";

// ==================== PHYSICAL MONITORING TYPE ====================
//
// Structured vocabulary for physical monitoring mechanisms on PhysicalBoundary.
//
// Threat-reduction mapping (attack feasibility scoring):
//   none             -> No detection — attacker operates unobserved
//   camera           -> Post-hoc evidence only — does not prevent access
//   alarm            -> Real-time alert on breach — reduces dwell time
//   soc              -> Alarm routed to SOC — active response capability
//   guard_patrol     -> Periodic human presence — detection window varies
//   tamper_monitoring -> Electronic tamper detection (mesh, switch, sensor)
//                        often paired with zeroize response on ChipBoundary
export type PhysicalMonitoringType =
  | "none"
  | "camera"            // CCTV / IP camera — evidence, not prevention
  | "alarm"             // Motion / door alarm — real-time alert, no active response
  | "soc"               // Alarm routed to Security Operations Centre — active response
  | "guard_patrol"      // Periodic manned patrol — detection gap depends on interval
  | "tamper_monitoring"; // Electronic tamper detection (switch, mesh, voltage sensor)

// ==================== STORED DATA TYPES ====================
//
// Controlled vocabulary for DataStore.storedDataTypes[].
// Represents threat classes, not storage technologies — kept deliberately
// stable so new domains (automotive, medical, rail) extend via custom
// entries rather than breaking existing threat templates.
//
// Threat implications:
//   credentials / keys_certificates → Spoofing, Elevation of Privilege
//   firmware                        → Tampering (Secure Boot bypass)
//   pii                             → Information Disclosure (GDPR)
//   safety_params                   → Tampering + DoS (SIL-relevant)
//   calibration                     → Tampering (process accuracy)
//   config                          → Tampering (system behaviour)
//   audit_logs                      → Repudiation (log deletion/manipulation)
//   telemetry                       → Information Disclosure
//   custom                          → Analyst must describe in notes

export type StoredDataType =
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

// ==================== INTERFACE LOCATION ====================
//
// Physical location of a connector/port on a device boundary.
// Mirrors DataFlow.location (the path) — Interface.location is the point.
// Used for ExposureLevel derivation and physical attack surface assessment.
//
// Semantically distinct from:
//   DataFlow.location   — the medium/path the flow traverses
//   exposureLevel       — the resulting attack surface (consequence)
//
// location is the cause; exposureLevel is the effect.

export type InterfaceLocation =
  | "on_chip"          // Internal chip pad / register — EL0 (debug interface only)
  | "on_board"         // PCB-mounted connector, same board — EL0/EL1
  | "in_enclosure"     // Port inside sealed enclosure — EL1 (requires disassembly)
  | "external_panel"   // Panel-mounted port on device exterior — EL1
  | "field_accessible" // Field-accessible connector (M12, DIN, terminal) — EL1/EL2
  | "network_port"     // Standard network port (RJ45, SFP) — EL2/EL3
  | "wireless"         // Wireless interface (antenna, built-in radio) — EL3
  | "internet_facing"  // Internet-exposed interface — EL4
  | "custom";          // Non-standard location — describe in notes

// ==================== BOUNDARY CONTROL TYPES ====================
//
// Structured vocabulary for TrustBoundary security controls.
// Intentionally kept at a stable semantic core — OT-specific or
// vendor-specific controls go in customBoundaryControls?: string.
//
// Mitigation mapping:
//   firewall / ids_ips          → Network-level threat reduction
//   data_diode                  → Unidirectional enforcement (IEC 62443 SL3+)
//   vpn_gateway                 → Encrypted tunnel across boundary
//   dmz                         → Demilitarised zone separation
//   authentication_gateway      → Identity enforcement at boundary
//   unidirectional_gateway      → Hardware-enforced one-way data flow
//   network_segmentation        → VLAN / logical separation
//   jump_host                   → Bastion host for remote access control
//   custom                      → Describe in customBoundaryControls

export type BoundaryControlType =
  | "firewall"               // Stateful packet inspection firewall
  | "ids_ips"                // Intrusion Detection / Prevention System
  | "data_diode"             // Hardware data diode — unidirectional enforcement
  | "vpn_gateway"            // VPN concentrator / encrypted tunnel endpoint
  | "dmz"                    // Demilitarised zone (dual-firewall architecture)
  | "authentication_gateway" // Identity / auth enforcement at boundary
  | "unidirectional_gateway" // Software-enforced one-way gateway (e.g. Waterfall)
  | "network_segmentation"   // VLAN, microsegmentation, ACL-based separation
  | "jump_host"              // Bastion / jump server for admin access
  | "custom";                // Vendor/domain-specific — use customBoundaryControls

// ==================== SECURITY CONTROL RECORD ====================
 
/**
 * Audit record for a security control intentionally set on a DFD element.
 *
 * Populated when:
 *   - Analyst clicks "Apply" in DFDNotificationsPanel (setBy: "apply_suggestion")
 *   - Analyst documents an existing control manually (setBy: "analyst")
 *
 * Persisted on the element — survives project reload.
 * Basis for SecurityDrift calculation: compares SHOULD (ControlInstance)
 * vs WAS (SecurityControlRecord) vs IS (actual property value).
 */
export interface SecurityControlRecord {
  /** Property key on this element, e.g. "encryptionInTransit" */
  property: string;
 
  /** The value that was intentionally set, e.g. "tls" */
  value: unknown;
 
  /**
   * How was this control set?
   *   analyst          → manually in form, no mitigation reference
   *   apply_suggestion → via Apply button in DFDNotificationsPanel
   */
  setBy: "analyst" | "apply_suggestion";
 
  /** ISO timestamp when the control was set */
  setAt: string;
 
  /**
   * Mitigation ID that drove this control.
   * Only present when setBy = "apply_suggestion". e.g. "M-T-005"
   */
  mitigationId?: string;
 
  /**
   * Risk ID that drove this control.
   * Only present when setBy = "apply_suggestion". e.g. "R-CNA-DF1-T-IN-1"
   */
  riskId?: string;
}

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
  | "ethernet"       // Wired Ethernet (10/100/1000, PoE)
  | "wifi"           // IEEE 802.11 — no physical access required
  | "bluetooth"      // BT Classic / BLE — no physical access required
  | "nfc"            // NFC — proximity required (~10cm)
  | "fiber"          // Fibre optic — physical tap required
  // ── Serial / Bus ────────────────────────────────────────────────────
  | "uart"           // UART/USART — often unprotected console/config
  | "rs232"          // RS-232 — point-to-point serial, legacy
  | "rs485"          // RS-485 / Modbus — multi-drop, industrial
  | "can"            // CAN Bus — automotive/industrial, no auth by default
  | "i2c"            // I²C — short-range internal bus to sensors/EEPROMs
  | "spi"            // SPI — high-speed internal bus, peripherals
  | "lin"            // LIN Bus — automotive, single-wire serial
  // ── USB ─────────────────────────────────────────────────────────────
  | "usb"            // USB (any class) — DFU, HID, CDC, storage
  // ── Debug / Programming ─────────────────────────────────────────────
  | "jtag"           // JTAG — full debug: CPU halt, memory R/W, flash
  | "swd"            // SWD (ARM) — debug + flash programming
  | "swd_swo"        // SWD + SWO — debug + lightweight trace (ITM)
  | "jtag_trace"     // JTAG + ETM Trace Port — full debug + instruction trace
  // ── Digital I/O ─────────────────────────────────────────────────────
  | "gpio"           // General Purpose I/O — digital in/out
  | "analog_in"      // Analog Input — ADC channel (sensor, signal)
  | "analog_out"     // Analog Output — DAC channel (actuator, signal)
  | "pwm"            // PWM Output — motor control, dimming
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
  isShieldedCable?: boolean;

  // EN 50742 Annex B — Exposure Level (primary EL carrier in the graph)
  // Placed in Context: location is the cause, exposureLevel is the effect.
  exposureLevel?: ExposureLevel;
  exposureLevelSource?: "derived" | "manual";
  exposureLevelRationale?: string;

  // ── Security ─────────────────────────────────────────────────────────────

  accessControl?:
    | "none"
    | "physical_lock"
    | "credentials"
    | "card"
    | "certificate";

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
    | "mcu"   // Microcontroller — STM32, NXP, Renesas, etc.
    | "som"   // System-on-Module — Toradex, RPi CM, Variscite, etc.
    | "fpga"  // Field Programmable Gate Array — Xilinx, Intel/Altera, Lattice
    | "se"    // Secure Element — ATECC608, SLB9670, etc.
    | "hsm"   // Hardware Security Module — higher assurance than SE
    | "dsp";  // Digital Signal Processor — threat profile similar to MCU
 
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
    | "jtag"          // Full JTAG — CPU halt, memory access, flash R/W
    | "jtag_trace"    // JTAG + Trace Port (ETM) — full debug + instruction trace
    | "swd"           // SWD (ARM) — similar capabilities to JTAG
    | "swd_swo"       // SWD + SWO — debug + lightweight software trace (ITM)
    | "custom";       // Proprietary debug interface
 
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
  | ChipBoundaryProperties;