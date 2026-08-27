// ==================== VALIDATOR UTILS ====================
// Shared utilities for DFD validation

// ==================== VALIDATION FINDING ====================
//
// ValidationFinding now lives in models/dfd-types.ts — it's part of the
// persisted DFDValidation shape (errors/warnings), not just a validator
// implementation detail. Re-exported here so existing
// `import { ValidationFinding } from "./validator-utils"` in the validator
// files keeps working unchanged.
//
// Every validator pushes a ValidationFinding instead of an ad-hoc encoded
// string. `params` is passed 1:1 as i18next interpolation values for `key` —
// no positional parsing, no parts.length branching in the notification panel.
//
// Two param keys carry identifiers that need a *second* i18n lookup, because
// they're names of things (an element type, a field) rather than plain text:
//   - params.type / params.elementType / params.targetType
//       → resolved against `dfdValidation.elementTypes.*`
//   - params.field (always paired with params.elementType in the same finding)
//       → resolved against `tabs.dfd.element_description.<ns>.fields.<field>.label`
// This resolution happens generically in the notification panel (two small
// helper functions), based on the param *name*, not on message shape.
// All other params are interpolated as plain values.
export type { ValidationFinding } from "../../models/dfd-types";
import type { ValidationFinding } from "../../models/dfd-types";

/** Small convenience constructor — purely for terser call sites. */
export function finding(
  key: string,
  opts: { displayId?: string; elementId?: string; params?: ValidationFinding["params"] } = {},
): ValidationFinding {
  return { key, displayId: opts.displayId, elementId: opts.elementId, params: opts.params };
}

// ==================== VALIDATION MESSAGE KEYS ====================

// ==================== VALIDATION MESSAGE KEYS ====================
// These keys are used for i18n translation in the UI layer

export const ValidationMessages = {
  // General
  NO_ELEMENTS: "dfdValidation.noElements",
  NO_PROCESS_OR_DATASTORE: "dfdValidation.noProcessOrDatastore",
  NO_DATAFLOWS: "dfdValidation.noDataflows",
  ELEMENT_MISSING_PROPERTY: "tabs.dfd.validation.element.missingProperty",
  /** Unexpected exception during validation (caught in useDFDValidation) — not a structural finding. */
  INTERNAL_VALIDATION_ERROR: "dfdValidation.internalError",

  // Trust Boundary
  NO_TRUST_BOUNDARY: "dfdValidation.noTrustBoundary",
  NEED_TWO_TRUST_BOUNDARIES: "dfdValidation.needTwoTrustBoundaries",
  EMPTY_TRUST_BOUNDARY: "dfdValidation.emptyTrustBoundary",
  TRUST_BOUNDARY_MISSING_ID: "dfdValidation.trustBoundaryMissingId",

  // Element placement
  NO_ELEMENT_INSIDE_TB: "dfdValidation.noElementInsideTrustBoundary",
  ELEMENT_OUTSIDE_ALL_TB: "dfdValidation.elementOutsideAllTrustBoundaries",
  EXTERNAL_ENTITY_INSIDE_TB: "dfdValidation.externalEntityInsideTrustBoundary",

  // Connections
  NO_INTERNAL_EXTERNAL_FLOW: "dfdValidation.noInternalExternalFlow",
  NO_CROSS_BOUNDARY_FLOW: "dfdValidation.noCrossBoundaryFlow",
  UNCONNECTED_ELEMENT: "dfdValidation.unconnectedElement",
  UNCONNECTED_DATAFLOW: "dfdValidation.unconnectedDataflow",
  INVALID_DATAFLOW_SOURCE: "dfdValidation.invalidDataflowSource",
  INVALID_DATAFLOW_TARGET: "dfdValidation.invalidDataflowTarget",

  // ── DataStore property consistency ──────────────────────────────────────
  DS_ACCESSMODEL_OVERRIDE_NO_RATIONALE:
    "dfdValidation.accessModelOverrideNoRationale",
  DS_ACCESSMODEL_MPU_COMMUNICATION_CONFLICT:
    "dfdValidation.accessModelMpuCommunicationConflict",

  // Chip Boundary
  CHIPBOUNDARY_INVALID_CONNECTION:
    "dfdValidation.chipBoundaryInvalidConnection",

  // Physical Boundary
  PHYSICALBOUNDARY_INVALID_CONNECTION:
    "dfdValidation.physicalBoundaryInvalidConnection",
  INTERFACE_NO_PHYSICAL_BOUNDARY: "dfdValidation.interfaceNoPhysicalBoundary",

  // Transducer (Sensor / Actuator)
  SENSOR_INVALID_CONNECTION: "dfdValidation.sensorInvalidConnection",
  ACTUATOR_INVALID_CONNECTION: "dfdValidation.actuatorInvalidConnection",
  TRANSDUCER_EE_NOT_PHYSICAL: "dfdValidation.transducerEeNotPhysical",
  TRANSDUCER_PHYSICAL_MEDIUM_INVALID_ENDPOINT:
    "dfdValidation.transducerPhysicalMediumInvalidEndpoint",

  // Asset & Interface
  INTERFACE_UNUSED: "dfdValidation.interfaceUnused",
  CHIPBOUNDARY_MISSING_DEBUG_INTERFACE:
    "dfdValidation.chipBoundaryMissingDebugInterface",
  INTERFACE_CONNECTOR_TYPE_INVALID:
    "dfdValidation.interfaceConnectorTypeInvalid",

  // Asset Relations
  ASSET_RELATION_TYPE_INVALID: "dfdValidation.assetRelationTypeInvalid",
  ASSET_RELATION_INCONSISTENT: "dfdValidation.assetRelationInconsistent",
  ASSET_MISSING_NAME: "dfdValidation.assetMissingName",
  ASSET_MISSING_PROTECTION_NEED: "dfdValidation.assetMissingProtectionNeed",
  // Per-group asset property keys
  ASSET_MISSING_DATA_TYPE: "dfdValidation.assetMissingDataType",
  ASSET_MISSING_LIFECYCLE: "dfdValidation.assetMissingLifecycle",
  ASSET_MISSING_CRITICALITY: "dfdValidation.assetMissingCriticality",
  ASSET_MISSING_EXPOSURE: "dfdValidation.assetMissingExposure",
  ASSET_MISSING_PHYSICAL_ACCESS: "dfdValidation.assetMissingPhysicalAccess",
  ASSET_MISSING_SERVICE_TYPE: "dfdValidation.assetMissingServiceType",
  ASSET_MISSING_RESPONSIBILITY: "dfdValidation.assetMissingResponsibility",
  ASSET_MISSING_ROLE: "dfdValidation.assetMissingRole",
  ASSET_MISSING_AUTOMATION_LEVEL: "dfdValidation.assetMissingAutomationLevel",
  // ASSET_MARKER_ON_INVALID_ELEMENT: "dfdValidation.assetMarkerOnInvalidElement",

  // Naming & ID Labels
  ELEMENT_DEFAULT_NAME: "dfdValidation.elementDefaultName",
  ELEMENT_MISSING_IDLABEL: "dfdValidation.elementMissingIdLabel",
  DUPLICATE_IDLABEL: "dfdValidation.duplicateIdLabel",

  // ── Label ───────────────────────────────────────────────────────────────
  DF_EMPTY_LABEL: "tabs.dfd.validation.df.label.empty",
  DF_DEPRECATED_VERB: "tabs.dfd.validation.df.label.deprecatedVerb",
  DF_UNKNOWN_VERB: "tabs.dfd.validation.df.label.unknownVerb",
  DF_MISSING_OBJECT: "tabs.dfd.validation.df.label.missingObject",
  DF_MULTIPLE_TAGS: "tabs.dfd.validation.df.label.multipleTags",
  DF_SYNONYM_VERB: "tabs.dfd.validation.df.label.synonymVerb",
  DF_OBJECT_EMBEDDED_VERB: "tabs.dfd.validation.df.label.objectEmbeddedVerb",

  // ── Pull ────────────────────────────────────────────────────────────────
  DF_PULL_MISSING_FLOW_TYPE: "tabs.dfd.validation.df.pull.missingFlowType",
  DF_PULL_INVALID_FLOW_TYPE: "tabs.dfd.validation.df.pull.invalidFlowType",
  DF_PULL_MISSING_RESPONSE: "tabs.dfd.validation.df.pull.missingResponse",
  DF_PULL_MULTIPLE_RESPONSES: "tabs.dfd.validation.df.pull.multipleResponses",
  DF_PULL_ORPHANED_RESPONSE: "tabs.dfd.validation.df.pull.orphanedResponse",

  // ── Push ────────────────────────────────────────────────────────────────
  DF_PUSH_MISSING_CMD: "tabs.dfd.validation.df.push.missingCmd",
  DF_PUSH_MISSING_FLOW_TYPE: "tabs.dfd.validation.df.push.missingFlowType",
  DF_PUSH_INVALID_FLOW_TYPE: "tabs.dfd.validation.df.push.invalidFlowType",

  // ── Write ───────────────────────────────────────────────────────────────
  DF_WRITE_REDUNDANT_FLOW_TYPE:
    "tabs.dfd.validation.df.write.redundantFlowType",

  // ── Read ────────────────────────────────────────────────────────────────
  DF_READ_REDUNDANT_FLOW_TYPE: "tabs.dfd.validation.df.read.redundantFlowType",

  // ── Stream ──────────────────────────────────────────────────────────────
  DF_STREAM_INVALID_FLOW_TYPE: "tabs.dfd.validation.df.stream.invalidFlowType",
  DF_STREAM_LOGICAL_ANNOTATION_FORBIDDEN:
    "tabs.dfd.validation.df.stream.logicalAnnotationForbidden",

  // ── Compact notation duplication ────────────────────────────────────────
  DF_REQ_RESP_DUPLICATE_COVERAGE:
    "tabs.dfd.validation.df.reqResp.duplicateCoverage",
  DF_EVENT_ACK_DUPLICATE_COVERAGE:
    "tabs.dfd.validation.df.eventAck.duplicateCoverage",

  // ── Object semantics ────────────────────────────────────────────────────
  DF_OBJECT_FORBIDDEN_TERM: "tabs.dfd.validation.df.object.forbiddenTerm",

  // ── Properties ──────────────────────────────────────────────────────────
  DF_PROP_BIDIRECTIONAL_FORBIDDEN:
    "tabs.dfd.validation.df.prop.bidirectionalForbidden",
  DF_PROP_PULL_NOT_REQRESP: "tabs.dfd.validation.df.prop.pullNotReqResp",
  DF_PROP_PUSH_IS_REQRESP: "tabs.dfd.validation.df.prop.pushIsReqResp",
  DF_PROP_PUSH_WRONG_DIRECTION:
    "tabs.dfd.validation.df.prop.pushWrongDirection",
  DF_PROP_WRITE_IS_REQRESP: "tabs.dfd.validation.df.prop.writeIsReqResp",
  DF_PROP_WRITE_NOT_DATASTORE: "tabs.dfd.validation.df.prop.writeNotDatastore",
  DF_PROP_READ_IS_REQRESP: "tabs.dfd.validation.df.prop.readIsReqResp",
  DF_PROP_STREAM_NOT_CONTINUOUS:
    "tabs.dfd.validation.df.prop.streamNotContinuous",
  DF_PROP_STREAM_IS_REQRESP: "tabs.dfd.validation.df.prop.streamIsReqResp",
  DF_PROP_CONTINUOUS_USE_STREAM:
    "tabs.dfd.validation.df.prop.continuousUseStream",
  DF_PROP_PROTOCOL_MISSING: "tabs.dfd.validation.df.prop.protocolMissing",

  // ── Physical coupling (medium="physical") ───────────────────────────────
  DF_PHYSICAL_MISSING_COUPLING:
    "tabs.dfd.validation.df.physical.missingCoupling",

  // ── Threat Analysis ─────────────────────────────────────────────────────
  DF_PROP_EXCLUDE_MISSING_RATIONALE:
    "tabs.dfd.validation.df.prop.excludeMissingRationale",

  // ── Label ↔ Property Semantic Validation ───────────────────────────────
  DF_LP_VERB_DIRECTION_CONFLICT:
    "tabs.dfd.validation.df.label_property.verb_direction_conflict",
  DF_LP_TAG_FREQUENCY_MISMATCH:
    "tabs.dfd.validation.df.label_property.tag_frequency_mismatch",
  DF_LP_TAG_MESSAGETYPE_MISMATCH:
    "tabs.dfd.validation.df.label_property.tag_message_type_mismatch",
  DF_LP_ELECTRICAL_PULL_VERB:
    "tabs.dfd.validation.df.label_property.electrical_pull_verb",
  DF_LP_WRITE_TARGET_NOT_DATASTORE:
    "tabs.dfd.validation.df.label_property.write_target_not_datastore",
  DF_LP_READ_SOURCE_NOT_DATASTORE:
    "tabs.dfd.validation.df.label_property.read_source_not_datastore",
  DF_LP_READ_ON_COMMUNICATION_STORE:
    "tabs.dfd.validation.df.label_property.read_on_communication_store",
  DF_LP_READ_STORE_UNCLASSIFIED:
    "tabs.dfd.validation.df.label_property.read_store_unclassified",
  DF_LP_PULL_ON_DIRECT_ACCESS_STORE:
    "tabs.dfd.validation.df.label_property.pull_on_direct_access_store",

  // ── Transport security (encryptionInTransit capability/usage) ──────────
  DF_TLS_NO_TERMINATOR: "tabs.dfd.validation.df.tls.noTerminator",
  DF_MTLS_REQUIRES_BOTH_MUTUAL:
    "tabs.dfd.validation.df.tls.mtlsRequiresBothMutual",
  DF_TLS_HANDSHAKE_MISMATCH: "tabs.dfd.validation.df.tls.handshakeMismatch",
} as const;

/**
 * Default/placeholder names that indicate user hasn't renamed the element
 */
export const DEFAULT_NAMES = [
  // English defaults
  "process",
  "external entity",
  "data store",
  "datastore",
  "trust boundary",
  "multiprocess",
  "asset",
  "interface",
  "external",
  "entity",
  "boundary",
  "chip boundary",
  "chipboundary",
  "physical boundary",
  "physicalboundary",
  // German defaults
  "prozess",
  "externe entität",
  "datenspeicher",
  "vertrauensgrenze",
  "multiprozess",
  "schnittstelle",
  "physische grenze",
  // Generic
  "name",
  "label",
  "new",
  "neu",
  "untitled",
  "unbenannt",
];

/**
 * Check if element name is a default/placeholder name
 */
export function isDefaultName(name: string): boolean {
  const normalized = name.toLowerCase().trim();

  const isDefault = DEFAULT_NAMES.some(
    (defaultName) =>
      normalized === defaultName ||
      normalized.startsWith(defaultName + " ") ||
      normalized.endsWith(" " + defaultName),
  );

  const isTooShort =
    normalized.length <= 2 && !normalized.match(/^[a-z]{1,2}-?\d+$/i);

  return isDefault || isTooShort;
}

/**
 * Validate Trust Boundary ID format
 * Must match: /\[([a-zA-Z0-9_-]+)\]\s*$/
 */
export function validateTrustBoundaryId(name: string): {
  isValid: boolean;
  id?: string;
} {
  if (!name) return { isValid: false };

  const match = name.match(/\[([a-zA-Z0-9_-]+)\]\s*$/);
  if (!match) return { isValid: false };

  return { isValid: true, id: match[1] };
}