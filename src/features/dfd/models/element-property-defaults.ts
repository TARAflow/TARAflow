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
  StoredDataType,
  InterfaceLocation,
  BoundaryControlType,
  PhysicalExposureLevel,
  PhysicalMonitoringType,
} from "./element-properties";

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
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  ui: {
    authenticationRequired: "yes",
    authorizationModel: "rbac",
    inputValidation: "basic",
    errorHandling: "sanitized",
  },
  microservice: {
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  batch: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
  },
  lambda: {
    authenticationRequired: "oauth",
    authorizationModel: "custom",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  daemon: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "silent",
  },
  websocket: {
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "strict",
    errorHandling: "sanitized",
  },
  event: {
    authenticationRequired: "oauth",
    authorizationModel: "custom",
    inputValidation: "none",
    errorHandling: "silent",
  },
  cli: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "verbose",
  },
  database: {
    authenticationRequired: "certificate",
    authorizationModel: "acl",
    inputValidation: "strict",
    errorHandling: "silent",
  },
  cron: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
  },
  iot: {
    authenticationRequired: "certificate",
    authorizationModel: "custom",
    inputValidation: "strict",
    errorHandling: "sanitized",
  },
  // Embedded / RTOS / Bare-metal defaults
  rtos_task: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "silent",
  },
  bare_metal: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
  },
  isr: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
  },
  state_machine: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "strict",
    errorHandling: "silent",
  },
  bootloader: {
    authenticationRequired: "certificate",
    authorizationModel: "none",
    inputValidation: "strict",
    errorHandling: "silent",
  },
  driver: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "silent",
  },
  protocol_stack: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "strict",
    errorHandling: "silent",
  },
};

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
    operatingSystem:          "rtos",
    updateMechanism:          "signed_local",
    boundaryAuthentication:   "none",      // Fieldbus: auth absent by default → surfaces threat
    authorizationModel:       "none",
    remoteAccessEnabled:      false,
    airGapped:                false,
    exposedToInternet:        false,
  },
 
  // Klasse 2 — SCADA / HMI / DCS
  scada_hmi: {
    operatingSystem:          "windows_hardened",
    updateMechanism:          "vendor_only",
    boundaryAuthentication:   "password",
    authorizationModel:       "rbac",
    remoteAccessEnabled:      true,         // Typical: remote HMI access exists
    airGapped:                false,
    exposedToInternet:        false,
  },
 
  // Klasse 3 — Backend Application / Server (MES, API, Microservices)
  backend_application: {
    operatingSystem:          "linux_standard",
    updateMechanism:          "ci_cd",
    boundaryAuthentication:   "oauth",
    authorizationModel:       "rbac",
    remoteAccessEnabled:      true,
    multiTenant:              false,
    exposedToInternet:        false,
  },
 
  // Klasse 4 — Gateway / Edge Device
  gateway: {
    operatingSystem:          "linux_hardened",
    updateMechanism:          "signed_ota",
    boundaryAuthentication:   "certificate",
    authorizationModel:       "acl",
    remoteAccessEnabled:      false,
    exposedToInternet:        false,
  },
 
  // Klasse 5 — Mobile / Portable Device
  mobile_device: {
    // operatingSystem: intentionally not cascaded — analyst must choose ios / android
    updateMechanism:          "mdm_managed",
    boundaryAuthentication:   "mfa",
    exposedToInternet:        true,         // Mobile devices are internet-connected by nature
  },
 
  // Klasse 6 — Cloud Platform / Service
  cloud_platform: {
    // operatingSystem: not applicable for cloud_platform — hidden in form
    updateMechanism:          "ci_cd",
    boundaryAuthentication:   "oauth",
    authorizationModel:       "rbac",
    remoteAccessEnabled:      true,
    multiTenant:              true,
    exposedToInternet:        true,
  },
 
  // Klasse 7 — Workstation / Engineering PC
  workstation: {
    operatingSystem:          "windows_standard",
    updateMechanism:          "manual_local",
    boundaryAuthentication:   "password",
    authorizationModel:       "rbac",
    remoteAccessEnabled:      false,
    exposedToInternet:        false,
  },
 
  // Klasse 8 — Safety System (SIS, Safety PLC, SIL-certified)
  safety_system: {
    operatingSystem:          "none",       // Bare-metal — safety systems avoid OS
    updateMechanism:          "vendor_only",
    boundaryAuthentication:   "none",       // Air-gapped: no network auth needed
    airGapped:                true,         // Default: isolated — analyst must justify override
    remoteAccessEnabled:      false,
    exposedToInternet:        false,
    safetyRelevant:           true,         // Always true by definition
  },
};
 
/** Fields that are driven by systemClass — used for clearing when driver is reset. */
export const MULTIPROCESS_SYSTEMCLASS_DRIVEN_FIELDS: (keyof MultiprocessProperties)[] = [
  "operatingSystem",
  "updateMechanism",
  "boundaryAuthentication",
  "authorizationModel",
  "remoteAccessEnabled",
  "airGapped",
  "exposedToInternet",
  "multiTenant",
  "safetyRelevant",
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
  user: {
    trustLevel: "low",
    authenticationMethod: "password",
    threatActor: "curious",
  },
  admin_user: {
    trustLevel: "medium",
    authenticationMethod: "mfa",
    threatActor: "insider",
  },
  partner: {}, // No defaults
  thirdparty: {}, // No defaults
  service: {}, // No defaults
  identity_provider: {
    trustLevel: "high",
    authenticationMethod: "saml",
    threatActor: "advanced",
  },
  payment: {
    trustLevel: "medium",
    authenticationMethod: "certificate",
    threatActor: "malicious",
  },
  contractor: {}, // No defaults
  bot: {
    trustLevel: "low",
    authenticationMethod: "apikey",
    threatActor: "compromised",
  },
  webhook: {
    trustLevel: "low",
    authenticationMethod: "none",
    threatActor: "malicious",
  },
  mobile_app: {}, // No defaults
  iot: {
    trustLevel: "low",
    authenticationMethod: "certificate",
    threatActor: "compromised",
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
  },
  cloud: {
    encryptionAtRest: "kms",
    integrityProtection: "hmac",
    multiTenant: true,
    storedDataTypes: ["telemetry"] as StoredDataType[],
  },
  filesystem: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    multiTenant: false,
  },
  cache: { encryptionAtRest: "none", integrityProtection: "none" },
  queue: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    storedDataTypes: ["telemetry"] as StoredDataType[],
  },
  blockchain: {
    encryptionAtRest: "custom",
    integrityProtection: "signature",
    multiTenant: false,
  },
  // Embedded storage: defaults surface threats — insecure by default
  flash: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    storedDataTypes: ["firmware"] as StoredDataType[],
  },
  eeprom: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    storedDataTypes: ["calibration"] as StoredDataType[],
  },
  nvram: {
    encryptionAtRest: "none",
    integrityProtection: "none",
    storedDataTypes: ["safety_params"] as StoredDataType[],
  },
};

/** Fields driven by DataStore.technology — used for clearing on driver reset */
export const DATASTORE_TECH_DRIVEN_FIELDS: (keyof DataStoreProperties)[] = [
  "encryptionAtRest",
  "integrityProtection",
  "multiTenant",
  "storedDataTypes",
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
    direction: "requestresponse",
    endpointAuthentication: "token",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "ondemand",
    dataClassification: "internal",
  },
  grpc: {
    direction: "requestresponse",
    endpointAuthentication: "certificate",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "ondemand",
    dataClassification: "internal",
  },
  http: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "ondemand",
    dataClassification: "internal",
  },
  mqtt: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "event_based",
    messageType: "telemetry",
  },
  amqp: {
    direction: "unidirectional",
    endpointAuthentication: "token",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "event_based",
    messageType: "telemetry",
  },
  // websocket uses "unidirectional" to avoid triggering validator C7
  websocket: {
    direction: "unidirectional",
    endpointAuthentication: "token",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "continuous",
  },
  file: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "batch",
    messageType: "log_audit",
  },
  database: {
    direction: "requestresponse",
    endpointAuthentication: "certificate",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "ondemand",
    dataClassification: "confidential",
  },

  // ── Embedded bus (no auth, no encryption — IEC 62443 baseline risk) ────
  can: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // CAN frame CRC — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  modbus_rtu: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // Modbus RTU frame CRC — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
    accessMode: "read_write", // Default surfaces threat — set read_only as CRA mitigation
    dataMinimization: "none",
  },
  modbus_tcp: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none", // No CRC in Modbus/TCP — relies on TCP checksum only
    frequency: "periodic",
    messageType: "measurement",
    accessMode: "read_write", // Default surfaces threat — set read_only as CRA mitigation
    dataMinimization: "none",
  },
  modbus_sec: {
    direction: "requestresponse",
    endpointAuthentication: "certificate",
    encryptionInTransit: "tls",
    integrityProtection: "hmac",
    frequency: "periodic",
    messageType: "measurement",
    accessMode: "read_write",
    dataMinimization: "none",
  },
  uart: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
  },
  spi: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
  },
  i2c: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
  },

  // ── Fieldbus (no auth, no encryption — IEC 62443 baseline gap) ───────────
  profibus: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // PROFIBUS frame CRC-16 — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  foundation_fieldbus: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
  },
  dnp3: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // DNP3 CRC-16 per block — not cryptographic
    frequency: "periodic",
    messageType: "status",
  },
  controlnet: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
  },
  devicenet: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // DeviceNet CRC-16 — not cryptographic
    frequency: "periodic",
  },
  ethernet_ip: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // Ethernet FCS CRC-32 — not cryptographic
    frequency: "periodic",
  },
  profinet: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // Ethernet FCS CRC-32 — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  hart: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
  },
  lontalk: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
  },
  bacnet: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // BACnet MS/TP CRC-8/CRC-16 — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  bacnet_ip: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "crc", // Ethernet FCS CRC-32 — not cryptographic
    frequency: "periodic",
    messageType: "measurement",
  },
  hart_ip: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
  },
  opc_da: {
    direction: "requestresponse",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "periodic",
    messageType: "measurement",
    accessMode: "read_write",
    dataMinimization: "none",
  },

  // ── Secure OT ─────────────────────────────────────────────────────────────
  opc_ua: {
    direction: "requestresponse",
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
    direction: "unidirectional",
    endpointAuthentication: "symmetric_key",
    encryptionInTransit: "custom",
    integrityProtection: "hmac",
    frequency: "periodic",
    messageType: "measurement",
  },
  // ISA 100.11a: AES-128 CCM mandatory, device certificates optional
  isa100: {
    direction: "unidirectional",
    endpointAuthentication: "symmetric_key",
    encryptionInTransit: "custom",
    integrityProtection: "hmac",
    frequency: "periodic",
    messageType: "measurement",
  },
  // ZigBee (IEEE 802.15.4): optional AES-128 — defaults to none to surface risk
  zigbee: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    frequency: "event_based",
  },

  // ── Electrical / Hardwired IO ─────────────────────────────────────────────
  // No auth, no encryption — physical access is the primary attack vector.
  // safetyFunction cascaded only where semantically unambiguous.
  digital_io: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "event_based",
    messageType: "status",
  },
  dry_contact: {
    direction: "unidirectional",
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
    direction: "unidirectional",
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
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "continuous",
    messageType: "measurement",
  },
  analog_current: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "continuous",
    messageType: "measurement",
  },
  pulse: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "continuous",
    messageType: "measurement",
  },
  pwm: {
    direction: "unidirectional",
    endpointAuthentication: "none",
    encryptionInTransit: "none",
    integrityProtection: "none",
    location: "field_cable",
    redundancy: "none",
    frequency: "continuous",
    messageType: "command",
  },

  custom: {},
};

/** Fields driven by DataFlow.protocol — cleared on driver reset, then new defaults applied. */
export const DATAFLOW_PROTOCOL_DRIVEN_FIELDS: (keyof DataFlowProperties)[] = [
  "direction",
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
 * usb, serial, gpio intentionally default to "none" to surface attack surface.
 */
export const INTERFACE_TYPE_DEFAULTS: Record<
  NonNullable<InterfaceProperties["type"]>,
  Partial<InterfaceProperties>
> = {
  // ── Network / Wireless ───────────────────────────────────────────────────
  ethernet: {
    accessControl: "credentials",
    location: "network_port" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "rj45",
  },
  fiber: {
    accessControl: "credentials",
    location: "network_port" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "sfp",
  },
  wifi: {
    accessControl: "credentials",
    location: "wireless" as InterfaceLocation,
    operationalState: "enabled",
    // no connectorType — wireless, no physical connector
  },
  bluetooth: {
    accessControl: "credentials",
    location: "wireless" as InterfaceLocation,
    operationalState: "enabled",
  },
  nfc: {
    accessControl: "none",
    location: "external_panel" as InterfaceLocation,
    operationalState: "enabled",
  },
  // ── Serial / Bus ─────────────────────────────────────────────────────────
  // No access control by default — surfaces attack surface for threat generation
  uart: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "gpio_header",
  },
  rs232: {
    accessControl: "none",
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "db9",
  },
  rs485: {
    accessControl: "none",
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  can: {
    accessControl: "none",
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  i2c: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "gpio_header",
  },
  spi: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "gpio_header",
  },
  lin: {
    accessControl: "none",
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  // ── USB ───────────────────────────────────────────────────────────────────
  usb: {
    accessControl: "none",
    location: "external_panel" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "usb_a",
  },
  // ── Debug / Programming ───────────────────────────────────────────────────
  // hw_disabled by default — must be explicitly enabled; surfaces threat if enabled
  jtag: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "hw_disabled",
    connectorType: "jtag_20pin",
  },
  swd: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "hw_disabled",
    connectorType: "swd_10pin",
  },
  swd_swo: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "hw_disabled",
    connectorType: "swd_10pin",
  },
  jtag_trace: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "hw_disabled",
    connectorType: "jtag_20pin",
  },
  // ── Digital / Analog I/O ─────────────────────────────────────────────────
  gpio: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "gpio_header",
  },
  analog_in: {
    accessControl: "none",
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  analog_out: {
    accessControl: "none",
    location: "in_enclosure" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  pwm: {
    accessControl: "none",
    location: "on_board" as InterfaceLocation,
    operationalState: "enabled",
    connectorType: "terminal",
  },
  // ── Other ─────────────────────────────────────────────────────────────────
  custom: {
    accessControl: "none",
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

/** Fields driven by Interface.type — used for clearing on driver reset */
export const INTERFACE_TYPE_DRIVEN_FIELDS: (keyof InterfaceProperties)[] = [
  "accessControl",
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
  },
  // Cloud boundary — IAM gateway is the baseline, monitoring mandatory
  cloud: {
    defaultExposureLevel: "EL4",
    monitoringEnabled: true,
    boundaryControlTypes: ["authentication_gateway"] as BoundaryControlType[],
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