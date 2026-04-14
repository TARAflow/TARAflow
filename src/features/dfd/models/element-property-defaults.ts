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
  database:   { encryptionAtRest: "tde",    integrityProtection: true  },
  cloud:      { encryptionAtRest: "kms",    integrityProtection: true,  multiTenant: true },
  filesystem: { encryptionAtRest: "none",   integrityProtection: false, multiTenant: false },
  cache:      { encryptionAtRest: "none",   integrityProtection: false },
  queue:      { encryptionAtRest: "none",   integrityProtection: false },
  blockchain: { encryptionAtRest: "custom", integrityProtection: true,  multiTenant: false },
  flash:  { encryptionAtRest: "none", integrityProtection: false },
  eeprom: { encryptionAtRest: "none", integrityProtection: false },
  nvram:  { encryptionAtRest: "none", integrityProtection: false },
};

/** Fields driven by DataStore.technology — used for clearing on driver reset */
export const DATASTORE_TECH_DRIVEN_FIELDS: (keyof DataStoreProperties)[] = [
  "encryptionAtRest",
  "integrityProtection",
  "multiTenant",
];

// ==================== DATA FLOW DEFAULTS ====================

/**
 * Cascade defaults based on DataFlow.protocol selection.
 * Note: websocket uses "unidirectional" to avoid triggering validator C7.
 */
export const DATAFLOW_PROTOCOL_DEFAULTS: Record<
  NonNullable<DataFlowProperties["protocol"]>,
  Partial<DataFlowProperties>
> = {
  https:     { direction: "requestresponse", endpointAuthentication: "token",       encryptionInTransit: "tls"  },
  grpc:      { direction: "requestresponse", endpointAuthentication: "certificate", encryptionInTransit: "tls"  },
  http:      { direction: "requestresponse", endpointAuthentication: "none",        encryptionInTransit: "none" },
  mqtt:      { direction: "unidirectional",  endpointAuthentication: "none",        encryptionInTransit: "none" },
  amqp:      { direction: "unidirectional",  endpointAuthentication: "token",       encryptionInTransit: "none" },
  websocket: { direction: "unidirectional",  endpointAuthentication: "token",       encryptionInTransit: "tls"  },
  file:      { direction: "unidirectional",  endpointAuthentication: "none",        encryptionInTransit: "none" },
  database:  { direction: "requestresponse", endpointAuthentication: "certificate", encryptionInTransit: "none" },
  // Embedded protocols — no auth, no encryption by design; forces analyst to consciously add controls
  can:       { direction: "unidirectional",  endpointAuthentication: "none",        encryptionInTransit: "none" },
  modbus:    { direction: "requestresponse", endpointAuthentication: "none",        encryptionInTransit: "none" },
  uart:      { direction: "unidirectional",  endpointAuthentication: "none",        encryptionInTransit: "none" },
  spi:       { direction: "unidirectional",  endpointAuthentication: "none",        encryptionInTransit: "none" },
  i2c:       { direction: "unidirectional",  endpointAuthentication: "none",        encryptionInTransit: "none" },
  custom:    {},
};

/** Fields driven by DataFlow.protocol — used for clearing on driver reset */
export const DATAFLOW_PROTOCOL_DRIVEN_FIELDS: (keyof DataFlowProperties)[] = [
  "direction",
  "endpointAuthentication",
  "encryptionInTransit",
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
  ethernet:  { accessControl: "credentials" },
  wifi:      { accessControl: "credentials" },
  bluetooth: { accessControl: "credentials" },
  fiber:     { accessControl: "credentials" },
  usb:       { accessControl: "none" },
  serial:    { accessControl: "none" },
  gpio:      { accessControl: "none" },
  nfc:       { accessControl: "none" },
  custom:    { accessControl: "none" },
};

/**
 * Safety hint prompts for embedded interface types that are common attack surfaces.
 * Displayed as an info Alert — not auto-filled.
 */
export const INTERFACE_TYPE_SAFETY_HINTS: Partial<Record<
  NonNullable<InterfaceProperties["type"]>,
  string
>> = {
  usb:    "tabs.dfd.element_description.interface.cascade_hints.usb",
  serial: "tabs.dfd.element_description.interface.cascade_hints.serial",
  gpio:   "tabs.dfd.element_description.interface.cascade_hints.gpio",
};

/** Fields driven by Interface.type — used for clearing on driver reset */
export const INTERFACE_TYPE_DRIVEN_FIELDS: (keyof InterfaceProperties)[] = [
  "accessControl",
];

// ==================== TRUST BOUNDARY DEFAULTS ====================

/**
 * Cascade defaults based on TrustBoundary.boundaryType selection.
 */
export const TB_TYPE_DEFAULTS: Record<
  NonNullable<TrustBoundaryProperties["boundaryType"]>,
  Partial<TrustBoundaryProperties>
> = {
  network:      { defaultExposureLevel: "EL3", monitoringEnabled: true  },
  cloud:        { defaultExposureLevel: "EL4", monitoringEnabled: true  },
  privilege:    { defaultExposureLevel: "EL1", monitoringEnabled: false },
  device:       { defaultExposureLevel: "EL1", monitoringEnabled: false },
  physical:     { defaultExposureLevel: "EL1", monitoringEnabled: false },
  organization: { defaultExposureLevel: "EL3", monitoringEnabled: false },
  legal:        { defaultExposureLevel: "EL2", monitoringEnabled: false },
  peripheral:   { defaultExposureLevel: "EL1", monitoringEnabled: false },
  boot:         { defaultExposureLevel: "EL0", monitoringEnabled: false },
  debug:        { defaultExposureLevel: "EL1", monitoringEnabled: false },
};

/**
 * Placeholder text for securityAssumptions field, keyed by boundaryType.
 * These are hints only — not auto-filled — so existing analyst text is never overwritten.
 */
export const TB_SECURITY_ASSUMPTIONS_PLACEHOLDERS: Record<
  NonNullable<TrustBoundaryProperties["boundaryType"]>,
  string
> = {
  network:      "External network is untrusted. All ingress/egress requires authentication and encryption.",
  cloud:        "Cloud perimeter is public. IAM policies and encryption are mandatory.",
  privilege:    "Lower privilege zone cannot initiate connections to higher privilege zone.",
  device:       "Device boundary. External interfaces require authentication.",
  physical:     "Physical access required for attack. Tamper-evident enclosure assumed.",
  organization: "Organizational boundary. Contractual controls apply.",
  legal:        "Regulatory boundary. Compliance controls apply.",
  peripheral:   "MCU to external chip boundary. Bus protocol has no authentication.",
  boot:         "Bootloader to application boundary. Secure Boot chain enforced.",
  debug:        "Debug interface boundary. Must be locked or disabled in production.",
};

/** Fields driven by TrustBoundary.boundaryType — used for clearing on driver reset */
export const TB_TYPE_DRIVEN_FIELDS: (keyof TrustBoundaryProperties)[] = [
  "defaultExposureLevel",
  "monitoringEnabled",
];

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