// ==================== ELEMENT PROPERTY DEFAULTS ====================
// Default values and heuristics for element properties
// Used by forms to auto-populate fields based on selections

import type {
  ProcessProperties,
  MultiprocessProperties,
  ExternalEntityProperties,
  DataStoreProperties,
  DataFlowProperties,
  InterfaceProperties,
  TrustBoundaryProperties,
  PhysicalBoundaryProperties,
  ChipBoundaryProperties,
} from "./element-properties";
import type {
  StoredDataType,
  InterfaceLocation,
  BoundaryControlType,
  PhysicalExposureLevel,
  PhysicalMonitoringType,
} from "./element-shared-types";
import type { ExternalEntityType } from "./external-entity-type-registry";
import type {
  SensorProperties,
  ActuatorProperties,
} from "./transducer-properties";

// ==================== PROCESS DEFAULTS ====================

/**
 * Default properties based on Process.runsAs selection
 */
export const PROCESS_RUNSAS_DEFAULTS: Record<string, Partial<ProcessProperties>> = {
  user: { privilegeLevel: "low", authenticationRequired: "optional" },
  admin_user: { privilegeLevel: "medium", authenticationRequired: "yes" },
  root: { privilegeLevel: "root", authenticationRequired: "yes" },
  system: { privilegeLevel: "high", authenticationRequired: "yes" },
  service: { privilegeLevel: "medium", authenticationRequired: "yes" },
  guest: { privilegeLevel: "low", authenticationRequired: "no" },
  anonymous: { privilegeLevel: "low", authenticationRequired: "no" },
  contractor: { privilegeLevel: "medium", authenticationRequired: "yes" },
};

/**
 * Default properties based on Process.technology selection
 */
export const PROCESS_TECH_DEFAULTS: Record<
  NonNullable<ProcessProperties["technology"]>,
  Partial<ProcessProperties>
> = {
  api: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  ui: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "yes",
    authorizationModel: "rbac",
    inputValidation: "basic",
    errorHandling: "sanitized",
  },
  microservice: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  batch: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
  },
  lambda: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "oauth",
    authorizationModel: "custom",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  daemon: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "silent",
  },
  websocket: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "strict",
    errorHandling: "sanitized",
  },
  event: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "oauth",
    authorizationModel: "custom",
    inputValidation: "none",
    errorHandling: "silent",
  },
  cli: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "verbose",
  },
  database: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "certificate",
    authorizationModel: "acl",
    inputValidation: "strict",
    errorHandling: "silent",
  },
  cron: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
  },
  iot: {
    processSemantic: "execution_unit", // OS-borne process — only sensible semantic
    authenticationRequired: "certificate",
    authorizationModel: "custom",
    inputValidation: "strict",
    errorHandling: "sanitized",
  },
  // No fields cascaded: unlike embedded technologies (worst-case defaults)
  // and OS technologies (concrete cascaded values), a logic_module can be
  // security-critical (e.g. an auth handler) or not — the analyst must
  // choose explicitly. "not_specified" was tried here but isn't a real
  // MenuItem value in any of these four Selects (they use "" for unset),
  // so leaving the object empty is the correct way to leave fields undefined.
  logic_module: {},
  // Embedded / RTOS / Bare-metal defaults
  rtos_task: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "silent",
    malwareProtection: "none", // Surfaces CR 3.2 / EDR 3.2 gap
  },
  bare_metal: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
    malwareProtection: "none", // Surfaces CR 3.2 / EDR 3.2 gap
    failSafeOutputState: "not_defined", // Surfaces CR 3.6 gap for bare-metal blocks
  },
  isr: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
    malwareProtection: "none", // Surfaces CR 3.2 gap
  },
  state_machine: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "strict",
    errorHandling: "silent",
    malwareProtection: "none", // Surfaces CR 3.2 gap
    failSafeOutputState: "not_defined", // Surfaces CR 3.6 gap — state machines need fail-safe
  },
  bootloader: {
    authenticationRequired: "certificate",
    authorizationModel: "none",
    inputValidation: "strict",
    errorHandling: "silent",
    malwareProtection: "code_signing", // Bootloader baseline: signed firmware only
  },
  driver: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "silent",
    malwareProtection: "none", // Surfaces CR 3.2 gap
  },
  protocol_stack: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "strict",
    errorHandling: "silent",
    malwareProtection: "none", // Surfaces CR 3.2 gap
  },
};

/**
 * Process technologies that run WITHOUT an OS user/account model
 * (bare-metal, RTOS task, kernel/ISR/driver, bootloader, protocol stack,
 * in-process logic modules of a monolithic application).
 *
 * Single source of truth for "is this a no-OS-isolation process" — NOT
 * restricted to embedded hardware; "logic_module" (e.g. an in-app auth
 * handler) belongs here for the same reason: no OS-enforced isolation.
 * The Process form gates its no-OS UI section on this (and disables
 * `runsAs`); the validator skips the `runsAs` requirement via
 * isRunsAsApplicable. Import from here in BOTH so the form's
 * disabled-state and the validator can never drift.
 */
export const NO_OS_TECHNOLOGIES: ReadonlySet<
  NonNullable<ProcessProperties["technology"]>
> = new Set([
  "rtos_task",
  "bare_metal",
  "isr",
  "state_machine",
  "bootloader",
  "driver",
  "protocol_stack",
  "logic_module",
]);

/** No-OS-isolation technology? (undefined technology → false). */
export function isNoOsTechnology(
  technology: ProcessProperties["technology"] | undefined,
): boolean {
  return technology != null && NO_OS_TECHNOLOGIES.has(technology);
}

/**
 * Whether the `runsAs` field applies to a Process. False for:
 *   - no-OS-isolation technologies (see NO_OS_TECHNOLOGIES), and
 *   - non-OS process semantics: functional_block (bare-metal logic / ISR /
 *     state machine / in-process module) and security_boundary
 *     (HSM / OP-TEE TA isolated execution).
 * The form disables the field exactly when this returns false; the validator
 * must not require runsAs in that case.
 */
export function isRunsAsApplicable(
  props: Pick<ProcessProperties, "technology" | "processSemantic">,
): boolean {
  // processSemantic is only meaningful for no-OS technologies (the form only
  // shows the field then, via isProcessSemanticChoiceApplicable — same
  // predicate). A stored processSemantic on an OS technology is stale data
  // (e.g. left over from switching technology away from a no-OS value) and
  // must not gate runsAs.
  if (!isNoOsTechnology(props.technology)) return true;
  return !props.processSemantic || props.processSemantic === "execution_unit";
}

/**
 * Whether the analyst must explicitly CHOOSE a processSemantic.
 *
 * Only no-OS-isolation technologies expose the meaningful choice between
 * functional_block (bare-metal logic / ISR / state machine / in-process
 * module) and security_boundary (HSM / OP-TEE TA isolated execution). For
 * OS technologies the semantic is implicitly execution_unit — cascaded via
 * PROCESS_TECH_DEFAULTS — and the form hides the field.
 *
 * Import in BOTH the form (field visibility) and the validator (requirement)
 * so the "field shown" and "value required" conditions can never drift.
 */
export function isProcessSemanticChoiceApplicable(
  technology: ProcessProperties["technology"] | undefined,
): boolean {
  return isNoOsTechnology(technology);
}

// ==================== MULTIPROCESS DEFAULTS ====================
 
type SystemClass = NonNullable<MultiprocessProperties["systemClass"]>;
 
/**
 * Cascade defaults based on Multiprocess.systemClass selection.
 *
 * Design principles (consistent with PROCESS_TECH_DEFAULTS):
 * - Defaults are conservative / realistic for the system class, not ideal.
 * - Fields left undefined are intentionally not cascaded (analyst must decide).
 * - Cascade is "only if unset" — existing analyst values are never overwritten.
 *
 * safetySystem: safetyRelevant is cascaded to true because any system explicitly
 * modelled as safety_system is, by definition, safety-relevant.
 */
export const MULTIPROCESS_SYSTEMCLASS_DEFAULTS: Record<
  SystemClass,
  Partial<MultiprocessProperties>
> = {
  // Klasse 1 — Dedicated Embedded Controller (PLC, CNC, Robot, ECU)
  embedded_controller: {
    operatingSystem: "rtos",
    updateMechanism: "signed_local",
    boundaryAuthentication: "none", // Fieldbus: auth absent by default → surfaces threat
    authorizationModel: "none",
    remoteAccessEnabled: false,
    airGapped: false,
    exposedToInternet: false,
    malwareProtection: "none", // Surfaces CR 3.2 / EDR 3.2 gap
    accountManagement: "local_only", // Surfaces CR 1.3 gap — no central management
    backupMechanism: "none", // Surfaces CR 7.3 gap
  },

  // Klasse 2 — SCADA / HMI / DCS
  scada_hmi: {
    operatingSystem: "windows_hardened",
    updateMechanism: "vendor_only",
    boundaryAuthentication: "password",
    authorizationModel: "rbac",
    remoteAccessEnabled: true, // Typical: remote HMI access exists
    airGapped: false,
    exposedToInternet: false,
    malwareProtection: "av_software", // SCADA on Windows: AV baseline
    accountManagement: "local_only", // Surfaces CR 1.3 gap — LDAP often missing
    backupMechanism: "manual_local", // Typical baseline for OT systems
  },

  // Klasse 3 — Backend Application / Server (MES, API, Microservices)
  backend_application: {
    operatingSystem: "linux_standard",
    updateMechanism: "ci_cd",
    boundaryAuthentication: "oauth",
    authorizationModel: "rbac",
    remoteAccessEnabled: true,
    multiTenant: false,
    exposedToInternet: false,
    malwareProtection: "none", // Analyst must assess (av / whitelist / container)
    accountManagement: "ldap", // Enterprise default: centralized
    backupMechanism: "automated_remote",
  },

  // Klasse 4 — Gateway / Edge Device
  gateway: {
    operatingSystem: "linux_hardened",
    updateMechanism: "signed_ota",
    boundaryAuthentication: "certificate",
    authorizationModel: "acl",
    remoteAccessEnabled: false,
    exposedToInternet: false,
    malwareProtection: "application_whitelist", // Hardened gateway: whitelist baseline
    accountManagement: "local_only", // Gateway: typically local accounts
    backupMechanism: "automated_remote",
  },

  // Klasse 5 — Mobile / Portable Device
  mobile_device: {
    // operatingSystem: intentionally not cascaded — analyst must choose ios / android
    updateMechanism: "mdm_managed",
    boundaryAuthentication: "mfa",
    exposedToInternet: true, // Mobile devices are internet-connected by nature
    malwareProtection: "sandbox", // Mobile OS sandbox model
    accountManagement: "iam", // MDM-managed → cloud IAM
    backupMechanism: "automated_remote",
  },

  // Klasse 6 — Cloud Platform / Service
  cloud_platform: {
    // operatingSystem: not applicable for cloud_platform — hidden in form
    updateMechanism: "ci_cd",
    boundaryAuthentication: "oauth",
    authorizationModel: "rbac",
    remoteAccessEnabled: true,
    multiTenant: true,
    exposedToInternet: true,
    malwareProtection: "sandbox", // Cloud: container/sandbox model
    accountManagement: "iam", // Cloud IAM is the baseline
    backupMechanism: "automated_remote",
  },

  // Klasse 7 — Workstation / Engineering PC
  workstation: {
    operatingSystem: "windows_standard",
    updateMechanism: "manual_local",
    boundaryAuthentication: "password",
    authorizationModel: "rbac",
    remoteAccessEnabled: false,
    exposedToInternet: false,
    malwareProtection: "av_software", // Workstation: AV baseline
    accountManagement: "active_directory", // Engineering PC: typical AD membership
    backupMechanism: "manual_local",
  },

  // Klasse 8 — Safety System (SIS, Safety PLC, SIL-certified)
  safety_system: {
    operatingSystem: "none", // Bare-metal — safety systems avoid OS
    updateMechanism: "vendor_only",
    boundaryAuthentication: "none", // Air-gapped: no network auth needed
    airGapped: true, // Default: isolated — analyst must justify override
    remoteAccessEnabled: false,
    exposedToInternet: false,
    safetyRelevant: true, // Always true by definition
  },
};
 
/** Fields that are driven by systemClass — used for clearing when driver is reset. */
export const MULTIPROCESS_SYSTEMCLASS_DRIVEN_FIELDS: (keyof MultiprocessProperties)[] =
  [
    "operatingSystem",
    "updateMechanism",
    "boundaryAuthentication",
    "authorizationModel",
    "remoteAccessEnabled",
    "airGapped",
    "exposedToInternet",
    "multiTenant",
    "safetyRelevant",
    "malwareProtection",
    "accountManagement",
    "backupMechanism",
  ];
 
/**
 * Get default properties for a Multiprocess based on systemClass selection.
 * Only cascades into fields that are currently unset — consistent with
 * getProcessDefaults / applyCascadeDefaults pattern in this file.
 *
 * Usage (in multiprocess-description-form.tsx handlePropertyChange):
 *
 *   if (field === "systemClass") {
 *     const newClass = value as MultiprocessProperties["systemClass"];
 *     if (!newClass) {
 *       // systemClass cleared: wipe driven fields
 *       onChange({ properties: {
 *         ...currentProps,
 *         systemClass: undefined,
 *         ...buildClearPatch(MULTIPROCESS_SYSTEMCLASS_DRIVEN_FIELDS),
 *       }});
 *       return;
 *     }
 *     onChange({ properties: getMultiprocessDefaults(currentProps, newClass) });
 *     return;
 *   }
 */
export function getMultiprocessDefaults(
  current: MultiprocessProperties,
  systemClass: SystemClass,
): MultiprocessProperties {
  const next: MultiprocessProperties = { ...current, systemClass };
  const defaults = MULTIPROCESS_SYSTEMCLASS_DEFAULTS[systemClass] ?? {};
 
  // Cascade only into fields that are currently unset
  Object.entries(defaults).forEach(([key, value]) => {
    const currentVal = next[key as keyof MultiprocessProperties];
    if (currentVal === undefined || currentVal === null) {
      (next as any)[key] = value;
    }
  });
 
  return next;
}

// ==================== EXTERNAL ENTITY DEFAULTS ====================

/**
 * Default properties based on ExternalEntity.entityType selection
 */
export const EXTERNAL_ENTITY_TYPE_DEFAULTS: Record<
  string,
  Partial<ExternalEntityProperties>
> = {
  // ── Human ─────────────────────────────────────────────────────────────────

  user: {
    trustLevel: "low",
    authenticationMethod: "password",
    threatActor: "curious",
    ownership: "external",
  },

  admin_user: {
    trustLevel: "medium",
    authenticationMethod: "mfa",
    threatActor: "insider",
    ownership: "internal",
  },

  operator: {
    trustLevel: "medium",
    authenticationMethod: "password",
    threatActor: "curious",
    ownership: "internal",
    // OT operator: physical presence, role-based access, safety-relevant context.
  },

  maintenance: {
    trustLevel: "medium",
    authenticationMethod: "password",
    threatActor: "insider",
    ownership: "external",
    // IEC 62443: maintenance = weakest link — temporarily privileged,
    // vendor laptops, USB sticks, direct PLC access, policy bypass risk.
  },

  contractor: {
    trustLevel: "low",
    authenticationMethod: "password",
    threatActor: "curious",
    ownership: "external",
  },

  device_owner: {
    trustLevel: "medium",
    authenticationMethod: "password",
    threatActor: "curious",
    ownership: "external",
    // Higher rights than user, lower than maintenance/contractor.
    // Can manage user accounts + device config (CR 1.3).
    // Cannot: firmware update, safety params, debug.
  },

  // ── System ────────────────────────────────────────────────────────────────

  service: {
    trustLevel: "medium",
    authenticationMethod: "certificate",
    threatActor: "compromised",
    ownership: "external",
  },

  remote_service: {
    trustLevel: "low",
    authenticationMethod: "certificate",
    threatActor: "advanced",
    ownership: "external",
    // Cloud diagnostics / vendor remote monitoring.
    // Low trust by default: internet-reachable supply-chain component.
  },

  scada_hmi: {
    trustLevel: "medium",
    authenticationMethod: "password",
    threatActor: "compromised",
    ownership: "internal",
  },

  historian: {
    trustLevel: "medium",
    authenticationMethod: "password",
    threatActor: "compromised",
    ownership: "internal",
  },

  gateway: {
    trustLevel: "medium",
    authenticationMethod: "certificate",
    threatActor: "compromised",
    ownership: "internal",
    // Protocol gateway: trusted intermediary, but pivoting risk.
    // certificate default: gateways should authenticate to both sides.
  },

  update_server: {
    trustLevel: "high",
    authenticationMethod: "certificate",
    threatActor: "advanced",
    ownership: "external",
    // Trust anchor for firmware integrity. High trust by design,
    // but advanced threat actor: supply chain compromise = all devices affected.
  },

  identity_provider: {
    trustLevel: "high",
    authenticationMethod: "saml",
    threatActor: "advanced",
    ownership: "external",
  },

  external_system: {
    trustLevel: "low",
    authenticationMethod: "certificate",
    threatActor: "compromised",
    ownership: "external",
  },

  bot: {
    trustLevel: "low",
    authenticationMethod: "apikey",
    threatActor: "compromised",
    ownership: "external",
  },

  // ── Infrastructure ────────────────────────────────────────────────────────

  network_device: {
    trustLevel: "medium",
    authenticationMethod: "password",
    threatActor: "compromised",
    ownership: "internal",
    // Switch, router, firewall. Trusted but compromised → pivot into OT network.
  },

  wireless_access_point: {
    trustLevel: "low",
    authenticationMethod: "password",
    threatActor: "compromised",
    ownership: "internal",
    // Industrial WiFi, 868MHz AP, LoRa. Low trust: wireless = no physical barrier.
  },

  remote_access: {
    trustLevel: "low",
    authenticationMethod: "certificate",
    threatActor: "advanced",
    ownership: "internal",
    // Jump host, VPN appliance, bastion. Common OT compromise entry point.
    // Low trust default: if compromised, attacker gets full network access.
  },

  // ── Field Device ──────────────────────────────────────────────────────────

  controller: {
    trustLevel: "medium",
    authenticationMethod: "none",
    threatActor: "compromised",
    ownership: "internal",
    // PLC, RTU, ECU. No auth default surfaces IEC 62443 CR 1.1 gap.
    // Compromised: process integrity + availability threats.
  },

  safety_controller: {
    trustLevel: "high",
    authenticationMethod: "certificate",
    threatActor: "advanced",
    ownership: "internal",
    // SIS, Safety-PLC. High trust + advanced attacker:
    // compromise = life safety impact (IEC 61508 / IEC 62061).
  },

  sensor: {
    trustLevel: "low",
    authenticationMethod: "none",
    threatActor: "curious",
    ownership: "internal",
    // Field sensor node. No auth default: fieldbus sensors typically unauthenticated.
    // Spoofing threat surfaces automatically.
  },

  actuator: {
    trustLevel: "medium",
    authenticationMethod: "none",
    threatActor: "malicious",
    ownership: "internal",
    // Valve, contactor, siren, relay. Malicious default: unauthorized actuation
    // can have immediate physical / safety consequences.
  },

  iot: {
    trustLevel: "low",
    authenticationMethod: "certificate",
    threatActor: "compromised",
    ownership: "external",
    // Intentionally low trust: undocumented devices, unknown attack surface.
  },

  // ── Engineering ───────────────────────────────────────────────────────────

  debugger: {
    trustLevel: "low",
    authenticationMethod: "none",
    threatActor: "insider",
    ownership: "external",
    // JTAG probe, SWD adapter. No auth: physical access IS the auth mechanism.
    // Insider default: debug access typically requires insider knowledge + hardware.
  },

  engineering_workstation: {
    trustLevel: "medium",
    authenticationMethod: "password",
    threatActor: "insider",
    ownership: "internal",
    // Engineering PC. If compromised: full plant potentially compromised.
    // medium trust + insider: legitimate workstation, but high privilege abuse risk.
  },

  programming_tool: {
    trustLevel: "low",
    authenticationMethod: "none",
    threatActor: "insider",
    ownership: "external",
    // Needle adapter, flash programmer, service dongle.
    // Physical access + no auth = full firmware read/write capability.
  },
};

// ==================== DATA STORE DEFAULTS ====================

/**
 * Cascade defaults based on DataStore.technology selection.
 * undefined values mean "do not cascade this field".
 */
export const DATASTORE_TECH_DEFAULTS: Record<
  NonNullable<DataStoreProperties["technology"]>,
  Partial<DataStoreProperties>
> = {
  database: {
    encryptionAtRest: "tde",
    integrityProtection: "hmac",
    storedDataTypes: ["config"] as StoredDataType[],
    accessModel: "communication", // DB server answers requests → active service
  },
  cloud: {
    encryptionAtRest: "kms",
    integrityProtection: "hmac",
    multiTenant: true,
    storedDataTypes: ["telemetry"] as StoredDataType[],
    accessModel: "communication",
  },
  filesystem: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    multiTenant: false,
    accessModel: "direct_access", // in-process file I/O; NFS/SMB → manual override
  },
  cache: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    accessModel: "direct_access", // in-process cache; Redis-over-TCP → manual override
  },
  queue: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    storedDataTypes: ["telemetry"] as StoredDataType[],
    accessModel: "communication", // broker answers requests → active service
  },
  blockchain: {
    encryptionAtRest: "custom",
    integrityProtection: "signature",
    multiTenant: false,
    accessModel: "communication",
  },
  // Embedded storage: defaults surface threats — insecure by default
  flash: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    storedDataTypes: ["firmware"] as StoredDataType[],
    accessModel: "direct_access",
  },
  eeprom: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    storedDataTypes: ["calibration"] as StoredDataType[],
    accessModel: "direct_access",
  },
  nvram: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    storedDataTypes: ["safety_params"] as StoredDataType[],
    accessModel: "direct_access",
  },
  // Volatile / direct-access memory — no responding actor → read/write, not pull.
  // storedDataTypes intentionally unset: content is buffer-/context-specific,
  // so the property validator's "missing property" finding should fire.
  shared_memory: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    accessModel: "direct_access",
  },
  mmio_register: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    accessModel: "direct_access",
  },
};

/**
 * Effective accessModel for a DataStore: explicit value wins, otherwise the
 * technology default from DATASTORE_TECH_DEFAULTS (single source of truth — no
 * duplicated switch). undefined = neither known → analyst must classify before
 * read/pull gating applies.
 */
export function resolveDataStoreAccessModel(
  props: Pick<DataStoreProperties, "accessModel" | "technology"> | undefined,
): "direct_access" | "communication" | undefined {
  if (!props) return undefined;
  if (props.accessModel) return props.accessModel;
  if (props.technology) return DATASTORE_TECH_DEFAULTS[props.technology]?.accessModel;
  return undefined;
}

/** Fields driven by DataStore.technology — used for clearing on driver reset */
export const DATASTORE_TECH_DRIVEN_FIELDS: (keyof DataStoreProperties)[] = [
  "encryptionAtRest",
  "integrityProtection",
  "multiTenant",
  "storedDataTypes",
  "accessModel",
];

// ==================== DATA FLOW DEFAULTS ====================

/**
 * Design principles:
 * - OT protocols default to insecure state to surface threats.
 * - integrityProtection: CRC where frame-level CRC exists (CAN, Modbus RTU),
 *   but CRC ≠ cryptographic — Tampering threat still fires.
 * - OPC UA / Modbus SEC: certificate + tls + hmac — security is their core contract.
 * - WirelessHART / ISA100: AES-128 mandatory → custom encryption + hmac.
 * - ZigBee: optional encryption → none to surface risk.
 * - Electrical signals: no auth/encryption, physical access is the attack vector.
 * - safetyFunction: only cascaded where semantically unambiguous (dry_contact, relay_output).
 *   All others left undefined — analyst must decide.
 */
export const DATAFLOW_PROTOCOL_DEFAULTS: Record<
  NonNullable<DataFlowProperties["protocol"]>,
  Partial<DataFlowProperties>
> = {
  // ── IT / Cloud ────────────────────────────────────────────────────────────
  https: {
    endpointAuthentication: "token",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "ondemand",
    dataClassification: "internal",
  },
  grpc: {
    endpointAuthentication: "certificate",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "ondemand",
    dataClassification: "internal",
  },
  http: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "ondemand",
    dataClassification: "internal",
  },
  mqtt: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "event_based",
    messageType: "telemetry",
  },
  amqp: {
    endpointAuthentication: "token",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "event_based",
    messageType: "telemetry",
  },
  websocket: {
    endpointAuthentication: "token",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "continuous",
  },
  file: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "batch",
    messageType: "log_audit",
  },
  database: {
    endpointAuthentication: "certificate",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "ondemand",
    dataClassification: "confidential",
  },
  in_process_call: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "ondemand",
    messageType: "command",
    location: "in_process", // cascade the matching location automatically
  },
  // ── Embedded bus (no auth, no encryption — IEC 62443 baseline risk) ────
  can: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // CAN frame CRC — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  modbus_rtu: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // Modbus RTU frame CRC — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
    accessMode: "read_write", // Default surfaces threat — set read_only as CRA mitigation
    dataMinimization: "none",
  },
  modbus_tcp: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none", // No CRC in Modbus/TCP — relies on TCP checksum only
    frequency: "periodic",
    messageType: "measurement",
    accessMode: "read_write", // Default surfaces threat — set read_only as CRA mitigation
    dataMinimization: "none",
  },
  modbus_sec: {
    endpointAuthentication: "certificate",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "periodic",
    messageType: "measurement",
    accessMode: "read_write",
    dataMinimization: "none",
  },
  uart: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
  },
  spi: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
  },
  i2c: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
  },
  lin: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
  },

  // ── Fieldbus (no auth, no encryption — IEC 62443 baseline gap) ───────────
  profibus: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // PROFIBUS frame CRC-16 — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  foundation_fieldbus: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
  },
  dnp3: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // DNP3 CRC-16 per block — not cryptographic
    frequency: "periodic",
    messageType: "status",
  },
  controlnet: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
  },
  devicenet: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // DeviceNet CRC-16 — not cryptographic
    frequency: "periodic",
  },
  ethernet_ip: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // Ethernet FCS CRC-32 — not cryptographic
    frequency: "periodic",
  },
  profinet: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // Ethernet FCS CRC-32 — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  hart: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
  },
  lontalk: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
  },
  bacnet: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // BACnet MS/TP CRC-8/CRC-16 — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  bacnet_ip: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // Ethernet FCS CRC-32 — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  hart_ip: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
  },
  opc_da: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
    accessMode: "read_write",
    dataMinimization: "none",
  },
  canopen: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc",
    frequency: "periodic",
    messageType: "measurement",
  },
  s7comm: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "ondemand",
    messageType: "measurement",
    accessMode: "read_write",
  },
  iec61850: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "event_based",
    messageType: "measurement",
  },

  // ── Secure OT ─────────────────────────────────────────────────────────────
  opc_ua: {
    endpointAuthentication: "certificate",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "ondemand",
    messageType: "measurement",
    accessMode: "read_write",
    dataMinimization: "none",
  },

  // ── Wireless ──────────────────────────────────────────────────────────────
  // WirelessHART (IEC 62591): AES-128 CBC mandatory, network-layer joining keys
  wireless_hart: {
    endpointAuthentication: "symmetric_key",
    encryptionInTransit: "custom",
    integrityProtection: "hmac",
    frequency: "periodic",
    messageType: "measurement",
  },
  // ISA 100.11a: AES-128 CCM mandatory, device certificates optional
  isa100: {
    endpointAuthentication: "symmetric_key",
    encryptionInTransit: "custom",
    integrityProtection: "hmac",
    frequency: "periodic",
    messageType: "measurement",
  },
  // ZigBee (IEEE 802.15.4): optional AES-128 — defaults to none to surface risk
  zigbee: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "event_based",
  },

  // ── Electrical / Hardwired IO ─────────────────────────────────────────────
  // No auth, no encryption — physical access is the primary attack vector.
  // safetyFunction cascaded only where semantically unambiguous.
  digital_io: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "event_based",
    messageType: "status",
  },
  dry_contact: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "event_based",
    messageType: "alarm_event",
    safetyFunction: "safety_gate",
  },
  relay_output: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "event_based",
    messageType: "command",
    safetyFunction: "emergency_stop",
  },
  analog_voltage: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "continuous",
    messageType: "measurement",
  },
  analog_current: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "continuous",
    messageType: "measurement",
  },
  pulse: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "continuous",
    messageType: "measurement",
  },
  pwm: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "continuous",
    messageType: "command",
  },

  // ── Human-Machine Interaction ─────────────────────────────────────────
  // Local operator action: one-way (operator → device), on demand, no network
  // transport. No endpoint auth / encryption applies — protection against
  // unauthorized local operation lives on the target process, not the edge.
  human_input: {
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "ondemand",
    messageType: "command",
  },

  custom: {},
};

/** Fields driven by DataFlow.protocol — cleared on driver reset, then new defaults applied. */
export const DATAFLOW_PROTOCOL_DRIVEN_FIELDS: (keyof DataFlowProperties)[] = [
  "endpointAuthentication",
  "encryptionInTransit",
  "integrityProtection",
  "frequency",
  "messageType",
  "dataClassification",
  "location",
  "redundancy",
  "accessMode",
  "dataMinimization",
];

// ==================== INTERFACE DEFAULTS ====================

/**
 * Cascade defaults based on Interface.type selection.
 *
 * Design principles:
 * - implementedControls are NOT cascaded — they are analyst decisions, not type properties.
 *   The type cascade sets context/exposure fields only (location, operationalState, connectorType).
 * - Serial/bus/debug interfaces default to operationalState: "enabled" to surface
 *   the full attack surface. Analysts must explicitly apply controls.
 * - Debug interfaces (jtag, swd*) default to "hw_disabled" — the expected secure baseline.
 *   If a project has these enabled, a threat is surfaced immediately.
 * - "accessControl" is gone — replaced by implementedControls.linkAuthentication
 *   (link-layer) and endpoint auth on Process/Flow (application layer).
 */
export const INTERFACE_TYPE_DEFAULTS: Record<
  NonNullable<InterfaceProperties["type"]>,
  Partial<InterfaceProperties>
> = {
  // ── Network / Wireless ───────────────────────────────────────────────────
  ethernet: {
    location: "network_port" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "rj45",
  },
  fiber: {
    location: "network_port" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "sfp",
  },
  wifi: {
    location: "wireless" as InterfaceLocation,
    operationalState: "enabled",
    // no connectorType — wireless, no physical connector
  },
  bluetooth: {
    location: "wireless" as InterfaceLocation,
    operationalState: "enabled",
  },
  nfc: {
    location: "external_panel" as InterfaceLocation,
    operationalState: "enabled",
  },
  // ── Serial / Bus ─────────────────────────────────────────────────────────
  // No implementedControls cascaded — analyst must assess and apply
  uart: {
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "gpio_header",
  },
  rs232: {
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "db9",
  },
  rs485: {
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  can: {
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  i2c: {
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "gpio_header",
  },
  spi: {
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "gpio_header",
  },
  lin: {
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  // ── USB ───────────────────────────────────────────────────────────────────
  usb: {
    location: "external_panel" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "usb_a",
  },
  // ── Debug / Programming ───────────────────────────────────────────────────
  // hw_disabled by default — secure production baseline.
  // If operationalState is overridden to "enabled", debug threats are surfaced immediately.
  jtag: {
    location: "on_board" as InterfaceLocation,
    operationalState: "hw_disabled",
    connectorType: "jtag_20pin",
  },
  swd: {
    location: "on_board" as InterfaceLocation,
    operationalState: "hw_disabled",
    connectorType: "swd_10pin",
  },
  swd_swo: {
    location: "on_board" as InterfaceLocation,
    operationalState: "hw_disabled",
    connectorType: "swd_10pin",
  },
  jtag_trace: {
    location: "on_board" as InterfaceLocation,
    operationalState: "hw_disabled",
    connectorType: "jtag_20pin",
  },
  // ── Digital / Analog I/O ─────────────────────────────────────────────────
  gpio: {
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "gpio_header",
  },
  analog_in: {
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  analog_out: {
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  pwm: {
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  // ── Human-Machine Interface ─────────────────────────────────────────────────
  // Integrated touch surface on the device front — externally operable, no
  // pluggable connector (like wireless interfaces).
  touchscreen: {
    location: "external_panel" as InterfaceLocation,
    operationalState: "enabled",
    // no connectorType — integrated surface, no physical connector
  },
  // ── Other ─────────────────────────────────────────────────────────────────
  custom: {
    operationalState: "enabled",
  },
};

/**
 * Safety hint prompts for embedded interface types that are common attack surfaces.
 * Displayed as an info Alert — not auto-filled.
 */
export const INTERFACE_TYPE_SAFETY_HINTS: Partial<
  Record<NonNullable<InterfaceProperties["type"]>, string>
> = {
  usb: "tabs.dfd.element_description.interface.cascade_hints.usb",
  uart: "tabs.dfd.element_description.interface.cascade_hints.uart",
  rs232: "tabs.dfd.element_description.interface.cascade_hints.rs232",
  rs485: "tabs.dfd.element_description.interface.cascade_hints.rs485",
  can: "tabs.dfd.element_description.interface.cascade_hints.can",
  gpio: "tabs.dfd.element_description.interface.cascade_hints.gpio",
  analog_in: "tabs.dfd.element_description.interface.cascade_hints.analog_in",
  analog_out: "tabs.dfd.element_description.interface.cascade_hints.analog_out",
  jtag: "tabs.dfd.element_description.interface.cascade_hints.jtag",
  swd: "tabs.dfd.element_description.interface.cascade_hints.swd",
  swd_swo: "tabs.dfd.element_description.interface.cascade_hints.swd",
  jtag_trace: "tabs.dfd.element_description.interface.cascade_hints.jtag",
};

/** Fields driven by Interface.type — used for clearing on driver reset.
 *  implementedControls is intentionally excluded: it is analyst-owned,
 *  not type-driven, and must survive a type change. */
export const INTERFACE_TYPE_DRIVEN_FIELDS: (keyof InterfaceProperties)[] = [
  "location",
  "operationalState",
  "connectorType",
];

// ==================== TRUST BOUNDARY DEFAULTS ====================

/**
 * Cascade defaults based on TrustBoundary.boundaryType selection.
 */
export const TB_TYPE_DEFAULTS: Record<
  NonNullable<TrustBoundaryProperties["boundaryType"]>,
  Partial<TrustBoundaryProperties>
> = {
  // Network boundary — firewall is the expected baseline control
  network: {
    defaultExposureLevel: "EL3",
    monitoringEnabled: true,
    boundaryControlTypes: ["firewall"] as BoundaryControlType[],
    defaultDenyPolicy: "allow_all", // Surfaces NDR 5.2 RE(1) gap — analyst must tighten
  },
  // Cloud boundary — IAM gateway is the baseline, monitoring mandatory
  cloud: {
    defaultExposureLevel: "EL4",
    monitoringEnabled: true,
    boundaryControlTypes: ["authentication_gateway"] as BoundaryControlType[],
    defaultDenyPolicy: "allow_all", // Surfaces NDR 5.2 RE(1) gap
  },
  // Privilege boundary — no network control, OS-enforced
  privilege: {
    defaultExposureLevel: "EL1",
    monitoringEnabled: false,
  },
  // Device boundary — no default control (analyst must assess)
  device: {
    defaultExposureLevel: "EL1",
    monitoringEnabled: false,
  },
  // Organization boundary — VPN is typical for cross-org connectivity
  organization: {
    defaultExposureLevel: "EL3",
    monitoringEnabled: false,
    boundaryControlTypes: ["vpn_gateway"] as BoundaryControlType[],
  },
  legal: {
    defaultExposureLevel: "EL2",
    monitoringEnabled: false,
  },
  // Embedded-specific — no network controls at chip/boot/debug level
  peripheral: {
    defaultExposureLevel: "EL1",
    monitoringEnabled: false,
  },
  boot: {
    defaultExposureLevel: "EL0",
    monitoringEnabled: false,
  },
  debug: {
    defaultExposureLevel: "EL1",
    monitoringEnabled: false,
  },
};

/**
 * Placeholder text for securityAssumptions field, keyed by boundaryType.
 * These are hints only — not auto-filled — so existing analyst text is never overwritten.
 */
export const TB_SECURITY_ASSUMPTIONS_PLACEHOLDERS: Record<
  NonNullable<TrustBoundaryProperties["boundaryType"]>,
  string
> = {
  network:
    "External network is untrusted. All ingress/egress requires authentication and encryption.",
  cloud:
    "Cloud perimeter is public. IAM policies and encryption are mandatory.",
  privilege:
    "Lower privilege zone cannot initiate connections to higher privilege zone.",
  device: "Device boundary. External interfaces require authentication.",
  organization: "Organizational boundary. Contractual controls apply.",
  legal: "Regulatory boundary. Compliance controls apply.",
  peripheral:
    "MCU to external chip boundary. Bus protocol has no authentication.",
  boot: "Bootloader to application boundary. Secure Boot chain enforced.",
  debug: "Debug interface boundary. Must be locked or disabled in production.",
};

/** Fields driven by TrustBoundary.boundaryType — used for clearing on driver reset */
export const TB_TYPE_DRIVEN_FIELDS: (keyof TrustBoundaryProperties)[] = [
  "defaultExposureLevel",
  "monitoringEnabled",
  "boundaryControlTypes",
];

// ==================== PHYSICAL BOUNDARY DEFAULTS ====================

type PhysicalBoundaryType = NonNullable<PhysicalBoundaryProperties["boundaryType"]>;

/**
 * Cascade defaults based on PhysicalBoundary.boundaryType selection.
 *
 * Design principle: defaults reflect realistic baseline for the boundary type,
 * not ideal state. This surfaces missing controls as threats rather than
 * assuming security that may not be present.
 *
 * physicalExposureLevel follows the EL scale:
 *   EL0 = sealed (tamper_zone with potting)
 *   EL1 = physical tool access required (device_enclosure, vehicle)
 *   EL2 = key/badge controlled (cabinet, room)
 *   EL3 = guarded perimeter (building with security desk)
 */
export const PHYSICAL_BOUNDARY_TYPE_DEFAULTS: Record<
  PhysicalBoundaryType,
  Partial<PhysicalBoundaryProperties>
> = {
  device_enclosure: {
    physicalExposureLevel:     "PEL2",
    physicalMobility:          "fixed",   // Conservative default — override to "portable" for handhelds/calibration devices
    accessibility:             "controlled",
    requiresToolAccess:        true,
    debugInterfaceAccessible:  false,     // Conservative: assume locked in production
    removableMediaAccessible:  false,     // Conservative: assume no exposed media slot
    tamperProtection:          "none",    // Surfaces: No tamper detection threat
    physicalAccessControl:     "none",    // Enclosure opened without auth -> threat
    monitoringType:            "none",
  },
  cabinet: {
    physicalExposureLevel:  "PEL2",   // One barrier: lock on cabinet
    physicalMobility:       "fixed",  // Cabinets are installed, not portable
    accessibility:          "controlled",
    physicalAccessControl:  "key",    // Conservative baseline: mechanical key only
    tamperProtection:       "none",
    monitoringType:         "none",
  },
  room: {
    physicalExposureLevel:  "PEL1",   // Multiple barriers: building + controlled door + badge
    physicalMobility:       "fixed",  // Rooms are fixed by definition
    accessibility:          "controlled",
    physicalAccessControl:  "badge",  // Typical: badge-only -> relay attack threat surfaces
    tamperProtection:       "none",
    monitoringType:         "none",   // Surfaces: No monitoring threat
  },
  building: {
    physicalExposureLevel:  "PEL1",   // Significant restrictions: perimeter + checkpoint
    physicalMobility:       "fixed",  // Buildings are fixed by definition
    accessibility:          "guarded",
    physicalAccessControl:  "badge",
    tamperProtection:       "none",
    monitoringType:         "none",
  },
  vehicle: {
    physicalExposureLevel:     "PEL2",
    physicalMobility:          "vehicle_mounted", // Moves with vehicle — depot attack risk
    accessibility:             "controlled",
    requiresToolAccess:        true,
    debugInterfaceAccessible:  false,    // Conservative: OBD/CAN debug not exposed by default
    removableMediaAccessible:  false,    // Conservative: no exposed media slot by default
    tamperProtection:          "none",
    physicalAccessControl:     "key",
    monitoringType:            "none",
  },
  tamper_zone: {
    physicalExposureLevel:    "PEL0",
    physicalMobility:         "fixed",  // Tamper zones are typically fixed installations
    accessibility:            "controlled", // Sealed nature expressed via PEL0 + tamperProtection
    tamperProtection:         "potting",
    requiresToolAccess:       false,    // PEL0: no tool opens this — destruction required
    debugInterfaceAccessible: false,    // Sealed: no debug access without destruction
    physicalAccessControl:    "none",   // Sealed zone: no access control meaningful
    monitoringType:           "none",
  },
  custom: {},
};

/**
 * Fields driven by PhysicalBoundary.boundaryType — cleared when driver is reset.
 */
export const PHYSICAL_BOUNDARY_TYPE_DRIVEN_FIELDS: (keyof PhysicalBoundaryProperties)[] = [
  "physicalExposureLevel",
  "physicalMobility",
  "accessibility",
  "tamperProtection",
  "physicalAccessControl",
  "requiresToolAccess",
  "debugInterfaceAccessible",
  "removableMediaAccessible",
  "monitoringType",
];

/**
 * Security assumptions placeholder text per boundaryType.
 * Displayed in the Notes/Assumptions field — hints only, never auto-filled.
 */
export const PHYSICAL_BOUNDARY_TYPE_SECURITY_ASSUMPTIONS_PLACEHOLDERS: Record<
  PhysicalBoundaryType,
  string
> = {
  device_enclosure:
    "Device enclosure must be sealed before deployment. Verify no accessible debug ports (JTAG/UART/SWD) remain open inside enclosure. Consider tamper-evident label on screws.",
  cabinet:
    "Schaltschrank must be locked at all times outside maintenance windows. Key management procedure required. Verify no USB ports or removable media slots are accessible.",
  room:
    "Physical access log required. Badge access must be role-restricted. Camera coverage of entry point recommended. Verify no tailgating risk.",
  building:
    "Perimeter access control required. Visitor management procedure must be in place. Deliveries to secure areas must be escorted.",
  vehicle:
    "Vehicle access must be controlled when containing active devices. Verify enclosure integrity before deployment in field. Consider GPS tracking for theft detection.",
  tamper_zone:
    "Tamper zone must be inspected for integrity before each maintenance window. Potting or mesh breach must trigger incident response. Verify zeroize response is functional.",
  custom:
    "Document physical access control, tamper protection, and monitoring measures. Assess exposure level based on attacker reachability in deployment context.",
};

/**
 * Get default properties for a PhysicalBoundary based on boundaryType selection.
 * Only cascades into fields that are currently unset — consistent with
 * applyCascadeDefaults pattern.
 */
export function getPhysicalBoundaryDefaults(
  current: PhysicalBoundaryProperties,
  boundaryType: PhysicalBoundaryType,
): PhysicalBoundaryProperties {
  const next: PhysicalBoundaryProperties = { ...current, boundaryType };
  const defaults = PHYSICAL_BOUNDARY_TYPE_DEFAULTS[boundaryType] ?? {};

  Object.entries(defaults).forEach(([key, value]) => {
    const currentVal = next[key as keyof PhysicalBoundaryProperties];
    if (currentVal === undefined || currentVal === null) {
      (next as any)[key] = value;
    }
  });

  return next;
}

// ==================== CHIP BOUNDARY DEFAULTS ====================

type ChipType = NonNullable<ChipBoundaryProperties["chipType"]>;

/**
 * Cascade defaults based on ChipBoundary.chipType selection.
 *
 * Design principle: MCU/SOM/FPGA/DSP default to the LEAST secure state
 * to surface threats. SE/HSM default to the most secure state because
 * that is their design contract — deviations must be consciously entered.
 */
export const CHIP_TYPE_DEFAULTS: Record<
  ChipType,
  Partial<ChipBoundaryProperties>
> = {
  mcu: {
    defaultExposureLevel: "EL1",
    debugInterfaceLocked: false, // Surfaces: JTAG not locked threat
    secureBootEnabled: false, // Surfaces: Secure Boot missing threat
    firmwareProtection: "none", // Surfaces: Firmware Readback threat
    tamperProtection: "none",
    supplyChainTrust: "unknown",
  },
  som: {
    defaultExposureLevel: "EL1",
    debugInterfaceLocked: false,
    secureBootEnabled: false,
    firmwareProtection: "none",
    tamperProtection: "none",
    supplyChainTrust: "unknown", // SOM: supply chain especially relevant
  },
  fpga: {
    defaultExposureLevel: "EL1",
    debugInterfaceLocked: false,
    secureBootEnabled: false,
    bitstreamEncryption: false, // Surfaces: Bitstream Readback threat
    tamperProtection: "none",
    supplyChainTrust: "unknown",
  },
  se: {
    defaultExposureLevel: "EL0", // SE is always deeply internal
    debugInterfaceLocked: true, // SE has no accessible debug interface
    secureBootEnabled: true, // SE's core contract: secure by design
    firmwareProtection: "locked",
    tamperProtection: "basic", // Most SEs have basic tamper resistance
    supplyChainTrust: "verified",
  },
  hsm: {
    defaultExposureLevel: "EL0",
    debugInterfaceLocked: true,
    secureBootEnabled: true,
    firmwareProtection: "locked",
    tamperProtection: "active", // HSMs typically have active tamper detection
    supplyChainTrust: "verified",
  },
  dsp: {
    defaultExposureLevel: "EL1",
    debugInterfaceLocked: false,
    secureBootEnabled: false,
    firmwareProtection: "none",
    tamperProtection: "none",
    supplyChainTrust: "unknown",
  },
};

/**
 * Security assumptions placeholder text per chipType.
 * Displayed in the Notes/Assumptions field — hints only, never auto-filled.
 */
export const CHIP_TYPE_SECURITY_ASSUMPTIONS_PLACEHOLDERS: Record<
  ChipType,
  string
> = {
  mcu: "MCU is assumed physically accessible only after enclosure is opened. JTAG/SWD must be locked before production release.",
  som: "SOM is a third-party module. Supply chain trust must be verified. Debug interface must be locked in production.",
  fpga: "FPGA bitstream must be encrypted to prevent readback and IP theft. JTAG boundary scan should be disabled in production.",
  se: "Secure Element provides hardware-backed key storage. Keys are non-extractable by design. Verify genuine part from authorized distributor.",
  hsm: "HSM provides highest hardware assurance. Physical tamper response active. Verify certification (FIPS 140-2 or CC EAL4+).",
  dsp: "DSP threat profile similar to MCU. Verify debug interface is locked and firmware is integrity-protected.",
};

/**
 * Fields driven by ChipBoundary.chipType — cleared when driver is reset.
 */
export const CHIP_TYPE_DRIVEN_FIELDS: (keyof ChipBoundaryProperties)[] = [
  "defaultExposureLevel",
  "debugInterfaceLocked",
  "secureBootEnabled",
  "firmwareProtection",
  "bitstreamEncryption",
  "tamperProtection",
  "supplyChainTrust",
];

/**
 * Get default properties for a ChipBoundary based on chipType selection.
 * Only cascades into fields that are currently unset — consistent with
 * applyCascadeDefaults pattern.
 */
export function getChipBoundaryDefaults(
  current: ChipBoundaryProperties,
  chipType: ChipType,
): ChipBoundaryProperties {
  const next: ChipBoundaryProperties = { ...current, chipType };
  const defaults = CHIP_TYPE_DEFAULTS[chipType] ?? {};

  Object.entries(defaults).forEach(([key, value]) => {
    const currentVal = next[key as keyof ChipBoundaryProperties];
    if (currentVal === undefined || currentVal === null) {
      (next as any)[key] = value;
    }
  });

  return next;
}

// ==================== PROCESS PROPERTY HELPERS ====================

/**
 * Get default properties for a Process based on runsAs or technology change
 */
export function getProcessDefaults(
  current: ProcessProperties,
  updates: Partial<ProcessProperties>,
): ProcessProperties {
  const next: ProcessProperties = { ...current, ...updates };

  const defaults =
    (updates.runsAs && PROCESS_RUNSAS_DEFAULTS[updates.runsAs]) ||
    (updates.technology && PROCESS_TECH_DEFAULTS[updates.technology]) ||
    {};

  // Only cascade into fields that are currently unset
  Object.entries(defaults).forEach(([key, value]) => {
    const currentVal = next[key as keyof ProcessProperties];
    if (currentVal === undefined || currentVal === null) {
      next[key as keyof ProcessProperties] = value as any;
    }
  });

  return next;
}

/**
 * Enforce security constraints for Process properties
 * - No auth → no authorization
 * - Authorization requires authentication
 */
export function enforceProcessSecurityConstraints(
  props: ProcessProperties,
): ProcessProperties {
  const next = { ...props };

  // No auth → no authorization
  if (next.authenticationRequired === "no") {
    next.authorizationModel = "none";
  }

  // Authorization without auth is invalid
  if (
    next.authorizationModel &&
    next.authorizationModel !== "none" &&
    next.authenticationRequired === "no"
  ) {
    next.authorizationModel = "none";
  }

  return next;
}

/**
 * Enforce internet exposure security rules
 * - Exposed to internet requires stricter security
 */
export function enforceInternetExposureRules(
  props: ProcessProperties,
): ProcessProperties {
  if (!props.exposedToInternet) return props;

  return {
    ...props,
    authenticationRequired:
      props.authenticationRequired === "no"
        ? "yes"
        : props.authenticationRequired,
    inputValidation: props.inputValidation ?? "strict",
    errorHandling: props.errorHandling ?? "sanitized",
  };
}

/**
 * Normalize Process properties by applying all defaults and constraints
 */
export function normalizeProcessProperties(
  props: ProcessProperties,
): ProcessProperties {
  let next = { ...props };

  next = getProcessDefaults(next, {
    technology: next.technology,
    runsAs: next.runsAs,
  });

  next = enforceProcessSecurityConstraints(next);
  next = enforceInternetExposureRules(next);

  return next;
}

/**
 * Update Process properties with new values, applying defaults and constraints
 */
export function updateProcessProperties(
  current: ProcessProperties,
  updates: Partial<ProcessProperties>,
): ProcessProperties {
  const merged = { ...current, ...updates };
  return normalizeProcessProperties(merged);
}

// ==================== EXTERNAL ENTITY PROPERTY HELPERS ====================

/**
 * Apply default properties for ExternalEntity based on entityType
 * Only applies defaults for fields that are currently empty
 */
export function applyExternalEntityTypeDefaults(
  entityType: string,
  current: ExternalEntityProperties,
): Partial<ExternalEntityProperties> {
  const defaults = EXTERNAL_ENTITY_TYPE_DEFAULTS[entityType];
  if (!defaults) return {};

  return Object.fromEntries(
    Object.entries(defaults).filter(
      ([key, value]) =>
        current[key as keyof ExternalEntityProperties] == null &&
        value !== undefined,
    ),
  ) as Partial<ExternalEntityProperties>;
}

// ==================== CASCADE HELPER ====================

/**
 * Apply cascade defaults to a properties object.
 * A field is only cascaded if it is currently undefined/null (never been set).
 * Cascade entries with undefined value are skipped (= "do not cascade this field").
 */
export function applyCascadeDefaults<T extends object>(
  current: T,
  defaults: Partial<T>,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(defaults).filter(([key, value]) => {
      if (value === undefined) return false;
      const currentValue = current[key as keyof T];
      return currentValue === undefined || currentValue === null;
    }),
  ) as Partial<T>;
}

/**
 * Build a partial object that sets all given keys to undefined.
 * Used to clear driven fields when a driver field is reset.
 */
export function buildClearPatch<T extends object>(
  keys: (keyof T)[],
): Partial<T> {
  return Object.fromEntries(keys.map((k) => [k, undefined])) as Partial<T>;
}
// ==================== TRANSDUCER (SENSOR / ACTUATOR) DEFAULTS ====================
//
// Pessimistic-by-default baseline applied when a Sensor/Actuator is created:
//   - mitigations at their weakest value ("none") — a set value, so the
//     property validator does NOT flag them as missing; instead the threat
//     generator surfaces the corresponding spoofing/tampering/availability
//     threats from the "none" posture.
//   - classifiers at their non-decision sentinel ("unspecified" / "unassessed" /
//     "none_defined") — the property validator surfaces a refinement finding.
//   - measurand and safetyRelevant are intentionally LEFT UNSET so the
//     validator's "missing property" findings fire for them.
//
// Reduction must be earned: the analyst lowers risk by assessing/mitigating,
// never by an optimistic default. No actuatorClass→field cascade is provided on
// purpose — energyDomain / hazardPotential / safeState are context-dependent and
// must be assessed, not guessed (a brake releases on de-energize; "motion" alone
// does not imply a safe direction).
//
// Apply at element creation, e.g. `{ ...SENSOR_DEFAULTS }`, and (only-if-unset)
// when seeding the Sensor/Actuator description forms.

export const SENSOR_DEFAULTS: Partial<SensorProperties> = {
  transductionPrinciple: "unspecified", // refinement finding
  sensingExposure: "exposed", // pessimistic worst case → threat-gen assumes attackable
  signalAuthentication: "none", // weakest posture → threat-gen surfaces spoofing
  plausibilityCheck: "none",
  redundancy: "none",
  lossDetection: "none",
  // measurand + stimulusDomain: left unset → validator "missing property" findings
  // safetyRelevant: left undefined (= unassessed) → validator finding
};

export const ACTUATOR_DEFAULTS: Partial<ActuatorProperties> = {
  actuatorClass: "unspecified", // refinement finding
  energyDomain: "unspecified",
  hazardPotential: "unassessed", // validator finding
  safeState: "none_defined", // validator finding — de-energize is NOT auto-safe
  commandAuthentication: "none", // weakest posture → threat-gen surfaces tampering
  failBehavior: "unassessed",
  feedbackVerification: "none",
  hardwareInterlock: "none",
  // safetyRelevant: left undefined (= unassessed) → validator finding
};