// ==================== EVIDENCE RULES ====================
// How the TARAflow model shows that an IEC 62443-4-2 requirement applies and
// is met — one rule per RequirementId, shared by both editions (D-11).
// Source: iec-62443-4-2-cra-coverage.md §4 ("Applicability in the model",
// "Evidence in the model", "Type"), iec-62443-4-2-2019-coverage.md §3 for the
// 2019-only ids; structure per §9.2.
//
//   quantifier "all" (default)  every applicable element in scope satisfies
//                               (e.g. every flow from a human user, D-13)
//   quantifier "any"            a capability of the component as a whole
//                               (update, backup, account management)
//   type C                      no satisfiedIf — only a statement, a
//                               mitigation reference or a claim meets it
//
// Declared `as const satisfies` (D-18): the literal paths and values stay
// visible to the conformance test (src/tests/…/evidence-rules.conformance.test.ts).

import type { EvidenceRule, RequirementId } from "../models/compliance-types";

// ==================== SHARED PIECES ====================

/** External-entity types that are humans (external-entity-type-registry). */
const HUMAN_ENTITY_TYPES = ["user", "admin_user", "operator", "maintenance", "contractor", "device_owner"] as const;

/** Every flow to or from a human external entity — interfaces with human access. */
const HUMAN_ACCESS_FLOWS = {
  elementTypes: ["DataFlow"],
  endpointIf: { elementTypes: ["ExternalEntity"], checks: [{ property: "entityType", in: HUMAN_ENTITY_TYPES }] },
} as const;

/** Every flow to or from a non-human external entity — other components. */
const MACHINE_FLOWS = {
  elementTypes: ["DataFlow"],
  endpointIf: { elementTypes: ["ExternalEntity"], checks: [{ property: "entityType", notIn: HUMAN_ENTITY_TYPES }] },
} as const;

const PROCESS_WITH_AUTH = {
  elementTypes: ["Process"],
  appliesIf: [{ property: "authenticationRequired", notIn: ["not_specified", "no"] }],
} as const;

const MULTIPROCESS_WITH_AUTH = {
  elementTypes: ["Multiprocess"],
  appliesIf: [{ property: "boundaryAuthentication", notIn: ["not_specified", "none"] }],
} as const;

const WIRELESS_INTERFACES = {
  elementTypes: ["Interface"],
  appliesIf: [{ property: "type", in: ["wifi", "bluetooth", "nfc"] }],
} as const;

const WIRELESS_FLOWS = {
  elementTypes: ["DataFlow"],
  appliesIf: [{ property: "protocol", in: ["wireless_hart", "bluetooth"] }],
} as const;

const DEBUG_INTERFACES = {
  elementTypes: ["Interface"],
  appliesIf: [{ property: "type", in: ["jtag", "swd", "swd_swo", "jtag_trace"] }],
} as const;

const DEBUG_CHIPS = {
  elementTypes: ["ChipBoundary"],
  appliesIf: [{ property: "debugInterfacePresent", notIn: ["none"] }],
} as const;

const PASSWORD_USE = [
  { elementTypes: ["DataFlow"], appliesIf: [{ property: "endpointAuthentication", in: ["password"] }] },
  { elementTypes: ["Multiprocess"], appliesIf: [{ property: "boundaryAuthentication", in: ["password"] }] },
] as const;

const PUBLIC_KEY_USE = [
  { elementTypes: ["DataFlow"], appliesIf: [{ property: "endpointAuthentication", in: ["certificate", "mutual_tls"] }] },
  { elementTypes: ["Multiprocess"], appliesIf: [{ property: "boundaryAuthentication", in: ["certificate", "mtls"] }] },
  { elementTypes: ["Process"], appliesIf: [{ property: "authenticationRequired", in: ["certificate", "mtls"] }] },
] as const;

const SYMMETRIC_KEY_USE = [
  { elementTypes: ["DataFlow"], appliesIf: [{ property: "endpointAuthentication", in: ["symmetric_key"] }] },
  { elementTypes: ["Interface"], appliesIf: [{ property: "implementedControls.linkAuthentication", in: ["pre_shared_key"] }] },
] as const;

const AUTHENTICATION_USE = [PROCESS_WITH_AUTH, MULTIPROCESS_WITH_AUTH] as const;

/** Key / authenticator storage on the elements that carry it. */
const KEY_STORES_HARDWARE = [
  { elementTypes: ["Process", "Multiprocess", "ChipBoundary"], satisfiedIf: [{ property: "authenticatorStorage", in: ["tpm", "secure_element", "hsm"] }] },
] as const;

const AUDIT_LOGGING_USE = [
  { elementTypes: ["Process", "Multiprocess"], appliesIf: [{ property: "nonRepudiation", in: ["audit_log", "digital_signature", "hardware_backed"] }] },
  { elementTypes: ["TrustBoundary"], appliesIf: [{ property: "monitoringEnabled", in: [true] }] },
] as const;

const SENSITIVE_STORES = {
  elementTypes: ["DataStore"],
  appliesIf: [{ property: "dataClassification", in: ["confidential", "restricted", "secret"] }],
} as const;

/** Trust boundaries the component sits on (zone boundary devices). */
const ZONE_BOUNDARIES = {
  elementTypes: ["TrustBoundary"],
  appliesIf: [{ property: "boundaryControlTypes" }],
} as const;

const REMOTE_ACCESS_USE = [
  { elementTypes: ["Multiprocess"], appliesIf: [{ property: "remoteAccessEnabled", in: [true] }] },
  { elementTypes: ["Multiprocess", "Process"], appliesIf: [{ property: "exposedToInternet", in: [true] }] },
] as const;

const HARDWARE_USE = [{ elementTypes: ["PhysicalBoundary"] }, { elementTypes: ["ChipBoundary"] }] as const;

// ==================== RULES ====================

const RULES = [
  // ── FR 1 — Identification and authentication control ──────────────────
  {
    id: "cr-1.1",
    type: "B",
    targets: [{ ...HUMAN_ACCESS_FLOWS, satisfiedIf: [{ property: "endpointAuthentication", notIn: ["none"] }] }],
    checklist: ["each external interface with human access identifies and authenticates the user"],
  },
  { id: "cr-1.1-re1", type: "C", targets: [HUMAN_ACCESS_FLOWS] },
  {
    id: "cr-1.1-re2",
    type: "A",
    targets: [{ ...HUMAN_ACCESS_FLOWS, satisfiedIf: [{ property: "endpointAuthentication", in: ["mfa"] }] }],
  },
  {
    id: "cr-1.2",
    type: "A",
    targets: [
      {
        ...MACHINE_FLOWS,
        satisfiedIf: [{ property: "endpointAuthentication", in: ["certificate", "mutual_tls", "symmetric_key", "token", "apikey"] }],
      },
    ],
  },
  {
    id: "cr-1.2-re1",
    type: "B",
    targets: [{ ...MACHINE_FLOWS, satisfiedIf: [{ property: "endpointAuthentication", in: ["certificate", "mutual_tls"] }] }],
    checklist: ["each device has its own identity (no shared key)"],
  },
  {
    id: "cr-1.3",
    type: "A",
    quantifier: "any",
    targets: [
      { ...PROCESS_WITH_AUTH, satisfiedIf: [{ property: "accountManagement" }] },
      { ...MULTIPROCESS_WITH_AUTH, satisfiedIf: [{ property: "accountManagement" }] },
    ],
  },
  {
    id: "cr-1.4",
    type: "B",
    quantifier: "any",
    targets: [
      { ...PROCESS_WITH_AUTH, satisfiedIf: [{ property: "accountManagement" }] },
      { ...MULTIPROCESS_WITH_AUTH, satisfiedIf: [{ property: "accountManagement" }] },
    ],
    checklist: ["identifiers are managed (unique, not reused)"],
  },
  {
    id: "cr-1.5",
    type: "B",
    quantifier: "any",
    targets: [
      { ...PROCESS_WITH_AUTH, satisfiedIf: [{ property: "authenticatorStorage" }] },
      { ...MULTIPROCESS_WITH_AUTH, satisfiedIf: [{ property: "authenticatorStorage" }] },
    ],
    checklist: [
      "initial authenticators can be provisioned",
      "unchanged default authenticators are recognised",
      "authenticators can be changed or refreshed",
    ],
  },
  { id: "cr-1.5-re1", type: "A", quantifier: "any", appliesWhen: AUTHENTICATION_USE, targets: KEY_STORES_HARDWARE },
  {
    id: "cr-1.6",
    type: "A",
    targets: [
      { ...WIRELESS_INTERFACES, satisfiedIf: [{ property: "implementedControls.linkAuthentication", notIn: ["none"] }] },
      { ...WIRELESS_FLOWS, satisfiedIf: [{ property: "endpointAuthentication", notIn: ["none"] }] },
    ],
  },
  {
    id: "cr-1.6-re1",
    type: "B",
    targets: [
      { ...WIRELESS_INTERFACES, satisfiedIf: [{ property: "implementedControls.linkAuthentication", in: ["certificate_based", "mutual_pairing"] }] },
      { ...WIRELESS_FLOWS, satisfiedIf: [{ property: "endpointAuthentication", in: ["certificate", "mutual_tls"] }] },
    ],
    checklist: ["each wireless user has a unique identity"],
  },
  { id: "cr-1.7", type: "C", targets: PASSWORD_USE },
  { id: "cr-1.7-re1-human", type: "C", targets: PASSWORD_USE },
  { id: "cr-1.7-re2-all-users", type: "C", targets: PASSWORD_USE },
  { id: "cr-1.7-re2-machines", type: "C", targets: PASSWORD_USE },
  { id: "cr-1.8", type: "C", targets: PUBLIC_KEY_USE },
  {
    // The mechanism in use is the evidence; how it validates is the checklist.
    id: "cr-1.9",
    type: "B",
    targets: [
      {
        elementTypes: ["DataFlow"],
        appliesIf: [{ property: "endpointAuthentication", in: ["certificate", "mutual_tls"] }],
        satisfiedIf: [{ property: "endpointAuthentication", in: ["certificate", "mutual_tls"] }],
      },
    ],
    checklist: ["signatures and certificate data are validated", "proof of possession of the private key"],
  },
  { id: "cr-1.9-re1", type: "A", quantifier: "any", appliesWhen: PUBLIC_KEY_USE, targets: KEY_STORES_HARDWARE },
  { id: "cr-1.10", type: "C", targets: [HUMAN_ACCESS_FLOWS] },
  {
    id: "cr-1.11",
    type: "A",
    quantifier: "any",
    appliesWhen: AUTHENTICATION_USE,
    targets: [{ elementTypes: ["Interface"], satisfiedIf: [{ property: "implementedControls.abuseProtection", in: ["lockout"] }] }],
  },
  {
    id: "cr-1.12",
    type: "C",
    targets: [HUMAN_ACCESS_FLOWS, { elementTypes: ["Interface"], appliesIf: [{ property: "type", in: ["touchscreen"] }] }],
  },
  {
    id: "cr-1.13",
    type: "B",
    quantifier: "any",
    appliesWhen: REMOTE_ACCESS_USE,
    targets: [
      {
        elementTypes: ["TrustBoundary"],
        satisfiedIf: [{ property: "boundaryControlTypes", in: ["vpn_gateway", "jump_host", "authentication_gateway", "firewall"] }],
      },
    ],
    checklist: ["all access methods via untrusted networks are monitored and controlled"],
  },
  { id: "cr-1.13-re1", type: "C", targets: REMOTE_ACCESS_USE },
  {
    id: "cr-1.14",
    type: "B",
    quantifier: "any",
    appliesWhen: SYMMETRIC_KEY_USE,
    // The software-only value is named per element type (system_software on a Multiprocess).
    targets: [
      { elementTypes: ["Process", "ChipBoundary"], satisfiedIf: [{ property: "authenticatorStorage", notIn: ["software_only"] }] },
      { elementTypes: ["Multiprocess"], satisfiedIf: [{ property: "authenticatorStorage", notIn: ["system_software"] }] },
    ],
    checklist: ["mutual trust via the symmetric key", "access to the shared secret is restricted", "algorithm and key strength per recognised practice"],
  },
  { id: "cr-1.14-re1", type: "A", quantifier: "any", appliesWhen: SYMMETRIC_KEY_USE, targets: KEY_STORES_HARDWARE },

  // ── FR 2 — Use control ────────────────────────────────────────────────
  {
    id: "cr-2.1",
    type: "A",
    targets: [
      { ...PROCESS_WITH_AUTH, satisfiedIf: [{ property: "authorizationModel", notIn: ["not_specified", "none"] }] },
      { ...MULTIPROCESS_WITH_AUTH, satisfiedIf: [{ property: "authorizationModel", notIn: ["not_specified", "none"] }] },
    ],
  },
  {
    id: "cr-2.1-re1",
    type: "B",
    targets: [
      { ...PROCESS_WITH_AUTH, satisfiedIf: [{ property: "privilegeLevel", in: ["low", "medium"] }] },
    ],
    checklist: ["authorization for all users incl. software processes and devices, least privilege"],
  },
  {
    id: "cr-2.1-re2",
    type: "A",
    targets: [
      { ...PROCESS_WITH_AUTH, satisfiedIf: [{ property: "authorizationModel", in: ["rbac"] }] },
      { ...MULTIPROCESS_WITH_AUTH, satisfiedIf: [{ property: "authorizationModel", in: ["rbac"] }] },
    ],
  },
  { id: "cr-2.1-re3", type: "C", targets: AUTHENTICATION_USE },
  { id: "cr-2.1-re4", type: "C", targets: AUTHENTICATION_USE },
  {
    id: "cr-2.2",
    type: "B",
    targets: [
      { ...WIRELESS_INTERFACES, satisfiedIf: [{ property: "implementedControls.monitoringControl", notIn: ["none"] }] },
    ],
    checklist: ["wireless usage is authorised, monitored and restricted"],
  },
  { id: "cr-2.4", type: "C", targets: [] },
  { id: "cr-2.4-re1", type: "C", targets: [] },
  {
    id: "cr-2.5",
    type: "A",
    quantifier: "any",
    appliesWhen: [HUMAN_ACCESS_FLOWS],
    targets: [{ elementTypes: ["Process"], satisfiedIf: [{ property: "sessionControl.sessionLockEnabled", in: [true] }] }],
  },
  {
    id: "cr-2.6",
    type: "A",
    quantifier: "any",
    appliesWhen: [{ elementTypes: ["Multiprocess"], appliesIf: [{ property: "remoteAccessEnabled", in: [true] }] }],
    targets: [{ elementTypes: ["Process"], satisfiedIf: [{ property: "sessionControl.remoteTerminationEnabled", in: [true] }] }],
  },
  {
    id: "cr-2.7",
    type: "A",
    quantifier: "any",
    targets: [{ elementTypes: ["Process"], satisfiedIf: [{ property: "sessionControl.maxConcurrentSessions" }] }],
  },
  {
    id: "cr-2.8",
    type: "B",
    quantifier: "any",
    targets: [
      { elementTypes: ["Process", "Multiprocess"], satisfiedIf: [{ property: "nonRepudiation", in: ["audit_log", "digital_signature", "hardware_backed"] }] },
      { elementTypes: ["Interface"], satisfiedIf: [{ property: "implementedControls.monitoringControl", in: ["usage_logged", "tamper_logged", "alerted", "active_response"] }] },
    ],
    checklist: ["all security event categories are audited (authentication, account changes, data access, removable media, unauthorised access, configuration)"],
  },
  { id: "cr-2.8-re1", type: "C", targets: [] },
  { id: "cr-2.9", type: "C", targets: AUDIT_LOGGING_USE },
  { id: "cr-2.9-re1", type: "C", targets: AUDIT_LOGGING_USE },
  { id: "cr-2.10", type: "C", targets: AUDIT_LOGGING_USE },
  { id: "cr-2.11", type: "C", targets: AUDIT_LOGGING_USE },
  // Type C until the model marks a time source (model gap P-4).
  { id: "cr-2.11-re1", type: "C", targets: AUDIT_LOGGING_USE },
  { id: "cr-2.11-re2", type: "C", targets: AUDIT_LOGGING_USE },
  {
    id: "cr-2.12",
    type: "A",
    quantifier: "any",
    appliesWhen: [HUMAN_ACCESS_FLOWS],
    targets: [{ elementTypes: ["Process", "Multiprocess"], satisfiedIf: [{ property: "nonRepudiation", notIn: ["none"] }] }],
  },
  {
    id: "cr-2.12-re1",
    type: "A",
    quantifier: "any",
    targets: [{ elementTypes: ["Process", "Multiprocess"], satisfiedIf: [{ property: "nonRepudiation", in: ["digital_signature", "hardware_backed"] }] }],
  },
  {
    id: "cr-2.13",
    type: "A",
    targets: [
      {
        ...DEBUG_INTERFACES,
        satisfiedIf: [
          { property: "implementedControls.debugProtection", notIn: ["none"] },
          { property: "implementedControls.serviceAccessPolicy", in: ["factory_only", "maintenance_only"] },
          { property: "operationalState", in: ["hw_disabled", "permanent_disabled"] },
        ],
      },
      { ...DEBUG_CHIPS, satisfiedIf: [{ property: "debugInterfaceLocked", in: [true] }] },
    ],
  },
  {
    id: "cr-2.13-re1",
    type: "A",
    targets: [
      { ...DEBUG_INTERFACES, satisfiedIf: [{ property: "implementedControls.monitoringControl", in: ["tamper_logged", "alerted", "active_response"] }] },
    ],
  },

  // ── FR 3 — System integrity ───────────────────────────────────────────
  {
    id: "cr-3.1",
    type: "A",
    targets: [
      {
        elementTypes: ["DataFlow"],
        satisfiedIf: [
          { property: "integrityProtection", in: ["hmac", "signature", "aead"] },
          { property: "encryptionInTransit", in: ["tls", "mtls", "vpn"] },
        ],
      },
    ],
  },
  {
    id: "cr-3.1-re1",
    type: "A",
    targets: [{ elementTypes: ["DataFlow"], satisfiedIf: [{ property: "integrityProtection", in: ["hmac", "signature", "aead"] }] }],
  },
  {
    id: "cr-3.2",
    type: "A",
    targets: [{ elementTypes: ["Process", "Multiprocess"], satisfiedIf: [{ property: "malwareProtection", notIn: ["none"] }] }],
  },
  {
    id: "cr-3.2-re1",
    type: "B",
    targets: [{ elementTypes: ["Process", "Multiprocess"], satisfiedIf: [{ property: "malwareProtection", in: ["application_whitelist", "code_signing"] }] }],
    checklist: ["installation of malicious code is detected and prevented"],
  },
  { id: "sar-3.2-qualify", type: "C", targets: [] },
  {
    id: "edr-3.2-unauthorized-software",
    type: "A",
    targets: [{ elementTypes: ["Process", "Multiprocess"], satisfiedIf: [{ property: "malwareProtection", in: ["application_whitelist", "code_signing"] }] }],
  },
  { id: "hdr-3.2-re1-report-version", type: "C", targets: [] },
  { id: "cr-3.3", type: "C", targets: [] },
  { id: "cr-3.3-re1", type: "C", targets: [] },
  {
    id: "cr-3.4",
    type: "B",
    targets: [
      { elementTypes: ["DataStore"], satisfiedIf: [{ property: "integrityProtection", notIn: ["none"] }] },
      { elementTypes: ["ChipBoundary"], satisfiedIf: [{ property: "firmwareProtection", notIn: ["none"] }] },
    ],
    checklist: ["results of the integrity checks are recorded and reported"],
  },
  {
    id: "cr-3.4-re1",
    type: "A",
    targets: [{ elementTypes: ["DataStore"], satisfiedIf: [{ property: "integrityProtection", in: ["signature"] }] }],
  },
  { id: "cr-3.4-re2", type: "C", targets: [] },
  {
    id: "cr-3.5",
    type: "A",
    targets: [{ elementTypes: ["Process"], satisfiedIf: [{ property: "inputValidation", in: ["strict", "schema"] }] }],
  },
  {
    id: "cr-3.6",
    type: "A",
    targets: [
      {
        elementTypes: ["Process"],
        appliesIf: [{ property: "failSafeOutputState" }],
        satisfiedIf: [{ property: "failSafeOutputState", notIn: ["not_defined"] }],
      },
    ],
  },
  {
    id: "cr-3.7",
    type: "A",
    targets: [{ elementTypes: ["Process"], satisfiedIf: [{ property: "errorHandling", in: ["sanitized"] }] }],
  },
  { id: "cr-3.8", type: "C", targets: [] },
  {
    id: "cr-3.9",
    type: "B",
    quantifier: "any",
    appliesWhen: AUDIT_LOGGING_USE,
    targets: [{ elementTypes: ["DataStore"], satisfiedIf: [{ property: "accessControlMechanism", notIn: ["none"] }] }],
    checklist: ["the store holding the audit records is protected against access, change and deletion"],
  },
  { id: "cr-3.9-re1", type: "C", targets: AUDIT_LOGGING_USE },
  {
    id: "cr-3.10",
    type: "A",
    quantifier: "any",
    targets: [{ elementTypes: ["Multiprocess"], satisfiedIf: [{ property: "updateMechanism", notIn: ["none"] }] }],
  },
  {
    id: "cr-3.10-re1",
    type: "A",
    quantifier: "any",
    targets: [{ elementTypes: ["Multiprocess"], satisfiedIf: [{ property: "updateMechanism", in: ["signed_local", "signed_ota"] }] }],
  },
  {
    id: "cr-3.10-re2",
    type: "B",
    quantifier: "any",
    targets: [{ elementTypes: ["Multiprocess"], satisfiedIf: [{ property: "updateMechanism", in: ["signed_ota", "mdm_managed", "ci_cd"] }] }],
    checklist: ["automatic loading, notification or scheduled updating", "recovery to an earlier version on failure (should)"],
  },
  {
    id: "cr-3.11",
    type: "A",
    targets: [
      { elementTypes: ["PhysicalBoundary"], satisfiedIf: [{ property: "tamperProtection", notIn: ["none"] }] },
      { elementTypes: ["ChipBoundary"], satisfiedIf: [{ property: "tamperProtection", notIn: ["none"] }] },
    ],
  },
  {
    id: "cr-3.11-re1",
    type: "A",
    targets: [
      {
        elementTypes: ["PhysicalBoundary"],
        satisfiedIf: [
          { property: "tamperProtection", in: ["active_detection"] },
          { property: "monitoringType", in: ["tamper_monitoring"] },
        ],
      },
      { elementTypes: ["ChipBoundary"], satisfiedIf: [{ property: "tamperProtection", in: ["active"] }] },
    ],
  },
  {
    id: "cr-3.12",
    type: "B",
    quantifier: "any",
    appliesWhen: HARDWARE_USE,
    targets: [
      { elementTypes: ["ChipBoundary"], satisfiedIf: [{ property: "secureBootEnabled", in: [true] }] },
      ...KEY_STORES_HARDWARE,
    ],
    checklist: ["supplier roots of trust are provisioned at manufacture and protected"],
  },
  { id: "cr-3.13", type: "C", targets: [] },
  {
    id: "cr-3.14",
    type: "A",
    targets: [
      {
        elementTypes: ["ChipBoundary"],
        satisfiedIf: [
          { property: "secureBootEnabled", in: [true] },
          { property: "firmwareProtection", notIn: ["none"] },
        ],
      },
    ],
  },
  {
    id: "cr-3.14-re1",
    type: "B",
    targets: [{ elementTypes: ["ChipBoundary"], satisfiedIf: [{ property: "secureBootEnabled", in: [true] }] }],
    checklist: ["the boot verifies authenticity with the supplier root of trust, not only integrity"],
  },

  // ── FR 4 — Data confidentiality ───────────────────────────────────────
  {
    id: "cr-4.1-transit",
    type: "A",
    targets: [
      {
        elementTypes: ["DataFlow"],
        appliesIf: [{ property: "dataClassification", in: ["confidential", "secret"] }],
        satisfiedIf: [{ property: "encryptionInTransit", notIn: ["none"] }],
      },
    ],
  },
  {
    id: "cr-4.1-rest",
    type: "A",
    targets: [{ ...SENSITIVE_STORES, satisfiedIf: [{ property: "encryptionAtRest", notIn: ["none"] }] }],
  },
  {
    id: "cr-4.2",
    type: "A",
    targets: [
      { ...SENSITIVE_STORES, satisfiedIf: [{ property: "deletionMechanism", in: ["overwrite", "crypto_erase", "factory_reset", "physical"] }] },
    ],
  },
  { id: "cr-4.2-re1", type: "C", targets: [SENSITIVE_STORES] },
  { id: "cr-4.2-re2", type: "C", targets: [SENSITIVE_STORES] },
  {
    id: "cr-4.3",
    type: "A",
    targets: [
      {
        elementTypes: ["DataFlow"],
        appliesIf: [{ property: "encryptionInTransit", notIn: ["none"] }],
        satisfiedIf: [{ property: "cryptoStandard", in: ["nist_approved", "fips_140_2", "fips_140_3"] }],
      },
      {
        elementTypes: ["DataStore"],
        appliesIf: [{ property: "encryptionAtRest", notIn: ["none"] }],
        satisfiedIf: [{ property: "cryptoStandard", in: ["nist_approved", "fips_140_2", "fips_140_3"] }],
      },
    ],
  },

  // ── FR 5 — Restricted data flow ───────────────────────────────────────
  {
    id: "cr-5.1",
    type: "B",
    quantifier: "any",
    targets: [
      { elementTypes: ["TrustBoundary"], satisfiedIf: [{ property: "boundaryControlTypes", in: ["network_segmentation", "firewall", "dmz", "data_diode"] }] },
      { elementTypes: ["Multiprocess"], satisfiedIf: [{ property: "airGapped", in: [true] }] },
    ],
    checklist: ["no unintended or undocumented connections between networks"],
  },
  // Applicable boundaries have controls (appliesIf); met when they are also monitored.
  { id: "cr-5.2", type: "A", targets: [{ ...ZONE_BOUNDARIES, satisfiedIf: [{ property: "monitoringEnabled", in: [true] }] }] },
  { id: "cr-5.2-re1", type: "A", targets: [{ ...ZONE_BOUNDARIES, satisfiedIf: [{ property: "defaultDenyPolicy", in: ["deny_all_permit_exception"] }] }] },
  { id: "cr-5.2-re2", type: "A", targets: [{ ...ZONE_BOUNDARIES, satisfiedIf: [{ property: "defaultDenyPolicy", in: ["island_mode"] }] }] },
  { id: "cr-5.2-re3", type: "A", targets: [{ ...ZONE_BOUNDARIES, satisfiedIf: [{ property: "defaultDenyPolicy", in: ["fail_close"] }] }] },
  { id: "ndr-5.3", type: "C", targets: [ZONE_BOUNDARIES] },

  // ── FR 6 — Timely response to events ──────────────────────────────────
  { id: "cr-6.1", type: "C", targets: AUDIT_LOGGING_USE },
  {
    id: "cr-6.1-re1",
    type: "B",
    quantifier: "any",
    appliesWhen: AUDIT_LOGGING_USE,
    targets: [
      {
        elementTypes: ["DataFlow"],
        endpointIf: { elementTypes: ["ExternalEntity"], checks: [{ property: "entityType", in: ["historian"] }] },
        satisfiedIf: [{ property: "protocol" }],
      },
    ],
    checklist: ["audit records are reachable by an API or forwarded to an external system"],
  },
  {
    id: "cr-6.2",
    type: "B",
    quantifier: "any",
    targets: [
      {
        elementTypes: ["TrustBoundary"],
        satisfiedIf: [
          { property: "monitoringEnabled", in: [true] },
          { property: "boundaryControlTypes", in: ["ids_ips"] },
        ],
      },
      { elementTypes: ["Interface"], satisfiedIf: [{ property: "implementedControls.monitoringControl", in: ["alerted", "active_response"] }] },
    ],
    checklist: ["detected security issues are reported for continuous monitoring"],
  },

  // ── FR 7 — Resource availability ──────────────────────────────────────
  {
    id: "cr-7.1",
    type: "B",
    quantifier: "any",
    targets: [
      { elementTypes: ["Interface"], satisfiedIf: [{ property: "implementedControls.abuseProtection", notIn: ["none"] }] },
      { elementTypes: ["DataFlow"], satisfiedIf: [{ property: "redundancy", notIn: ["none"] }] },
    ],
    checklist: ["essential functions continue in degraded mode during a DoS event"],
  },
  {
    id: "cr-7.1-re1",
    type: "A",
    quantifier: "any",
    targets: [{ elementTypes: ["Interface"], satisfiedIf: [{ property: "implementedControls.abuseProtection", in: ["flood_protection", "rate_limited"] }] }],
  },
  { id: "cr-7.2", type: "C", targets: [] },
  {
    id: "cr-7.3",
    type: "A",
    quantifier: "any",
    targets: [
      { elementTypes: ["Multiprocess"], satisfiedIf: [{ property: "backupMechanism", notIn: ["none"] }] },
      { elementTypes: ["DataStore"], satisfiedIf: [{ property: "backupEnabled", in: [true] }] },
    ],
  },
  { id: "cr-7.3-re1", type: "C", targets: [] },
  {
    id: "cr-7.4",
    type: "B",
    quantifier: "any",
    targets: [{ elementTypes: ["Multiprocess"], satisfiedIf: [{ property: "backupMechanism", notIn: ["none"] }] }],
    checklist: ["the component recovers to a known secure state after disruption or failure"],
  },
  { id: "cr-7.6", type: "C", targets: [] },
  { id: "cr-7.6-re1", type: "C", targets: [] },
  {
    id: "cr-7.7",
    type: "B",
    targets: [
      {
        elementTypes: ["Interface"],
        // The state of every interface is decided in the model; whether the
        // enabled ones are needed for the intended use is the checklist.
        satisfiedIf: [{ property: "operationalState" }],
      },
    ],
    checklist: ["each interface, port, protocol and service not needed for the intended use is restricted"],
  },
  { id: "cr-7.8", type: "C", targets: [] },
  {
    id: "cr-7.9",
    type: "B",
    quantifier: "any",
    targets: [{ elementTypes: ["DataStore"], satisfiedIf: [{ property: "deletionMechanism", in: ["factory_reset"] }] }],
    checklist: ["the component can be reset to the supplier-defined state"],
  },
] as const satisfies readonly EvidenceRule[];

/** The rule literals — the conformance test checks them type-level (D-15, D-18). */
export type EvidenceRuleLiterals = typeof RULES;

// ==================== LOOKUP ====================

export const ALL_EVIDENCE_RULES: readonly EvidenceRule[] = RULES;

export const EVIDENCE_RULES: ReadonlyMap<RequirementId, EvidenceRule> = new Map(
  ALL_EVIDENCE_RULES.map((rule) => [rule.id, rule]),
);
