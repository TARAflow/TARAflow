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
  storedDataTypes?: string;
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

  /**
   * Audit trail of security controls intentionally applied to this element.
   * Managed via DFDNotificationsPanel Apply or manual analyst entry.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

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

  /**
   * Audit trail of security controls intentionally applied to this element.
   * Managed via DFDNotificationsPanel Apply or manual analyst entry.
   * @see SecurityControlRecord
   */
  securityControlOwnership?: SecurityControlRecord[];

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

// ==================== UNION TYPE ====================

export type ElementProperties =
  | ProcessProperties
  | MultiprocessProperties
  | ExternalEntityProperties
  | DataStoreProperties
  | DataFlowProperties
  | InterfaceProperties
  | TrustBoundaryProperties
  | ChipBoundaryProperties;