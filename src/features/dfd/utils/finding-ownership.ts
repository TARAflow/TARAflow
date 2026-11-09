// ==================== FINDING OWNERSHIP ====================
// Multi-project TARA, phase 4a (design §8.1, review 2026-11-09): a finding on
// a part of an imported component can only be fixed in the component's TARA
// — the machine shows it, marked with its owner. Generic: the app layer
// knows which cells belong to which component and passes `FindingOwnerOf`;
// this file only knows which findings are about STRUCTURE.
//
// A boundary flow (component element ↔ machine element) belongs to the
// machine as a connection, but its properties come read-only from the
// component. So on a boundary flow a structural finding (endpoints, the
// connection itself, the leveled DFD's identity / page checks) is the
// machine's to fix, any other (properties, label, protocol, TLS …) the
// component's — otherwise the analyst looks for a field they cannot change.

import { ValidationMessages } from "../services/validators/validator-utils";

/** Who owns a finding, for its chip: a short label and a tooltip. */
export interface FindingOwner {
  label: string;
  tooltip: string;
}

/** cell id (+ finding key, absent for property suggestions) → owner; undefined = the machine's own. */
export type FindingOwnerOf = (elementId: string, findingKey?: string) => FindingOwner | undefined;

/**
 * Every DFD validation message, classified — complete by type: a new key in
 * ValidationMessages does not compile until it is placed here (review
 * 2026-11-09: an open allow list would let a new structural check carry the
 * component's chip on a boundary flow without any test noticing).
 *   structure  the drawing: elements, connections, endpoints, boundaries,
 *              placement, pages — the machine's on a boundary flow
 *   property   values of a cell: properties, label, names / id labels,
 *              protocol, transport security, asset properties — the
 *              component's on a boundary flow
 */
export const FINDING_CLASS: Record<keyof typeof ValidationMessages, "structure" | "property"> = {
  NO_ELEMENTS: "structure",
  NO_PROCESS_OR_DATASTORE: "structure",
  NO_DATAFLOWS: "structure",
  ELEMENT_MISSING_PROPERTY: "property",
  INTERNAL_VALIDATION_ERROR: "structure",
  ADOPTION_PENDING: "structure",
  COMPRESSED_PAGE_NOT_SUPPORTED: "structure",
  NO_TRUST_BOUNDARY: "structure",
  NEED_TWO_TRUST_BOUNDARIES: "structure",
  EMPTY_TRUST_BOUNDARY: "structure",
  TRUST_BOUNDARY_MISSING_ID: "structure",
  NO_ELEMENT_INSIDE_TB: "structure",
  ELEMENT_OUTSIDE_ALL_TB: "structure",
  EXTERNAL_ENTITY_INSIDE_TB: "structure",
  NO_INTERNAL_EXTERNAL_FLOW: "structure",
  NO_CROSS_BOUNDARY_FLOW: "structure",
  UNCONNECTED_ELEMENT: "structure",
  UNCONNECTED_DATAFLOW: "structure",
  INVALID_DATAFLOW_SOURCE: "structure",
  INVALID_DATAFLOW_TARGET: "structure",
  DS_ACCESSMODEL_OVERRIDE_NO_RATIONALE: "property",
  DS_ACCESSMODEL_MPU_COMMUNICATION_CONFLICT: "property",
  CHIPBOUNDARY_INVALID_CONNECTION: "structure",
  PHYSICALBOUNDARY_INVALID_CONNECTION: "structure",
  INTERFACE_NO_PHYSICAL_BOUNDARY: "structure",
  SENSOR_INVALID_CONNECTION: "structure",
  ACTUATOR_INVALID_CONNECTION: "structure",
  TRANSDUCER_EE_NOT_PHYSICAL: "structure",
  TRANSDUCER_PHYSICAL_MEDIUM_INVALID_ENDPOINT: "structure",
  INTERFACE_UNUSED: "structure",
  CHIPBOUNDARY_MISSING_DEBUG_INTERFACE: "structure",
  INTERFACE_CONNECTOR_TYPE_INVALID: "property",
  ASSET_RELATION_TYPE_INVALID: "property",
  ASSET_RELATION_INCONSISTENT: "property",
  ASSET_MISSING_NAME: "property",
  ASSET_MISSING_PROTECTION_NEED: "property",
  ASSET_MISSING_DATA_TYPE: "property",
  ASSET_MISSING_LIFECYCLE: "property",
  ASSET_MISSING_CRITICALITY: "property",
  ASSET_MISSING_EXPOSURE: "property",
  ASSET_MISSING_PHYSICAL_ACCESS: "property",
  ASSET_MISSING_SERVICE_TYPE: "property",
  ASSET_MISSING_RESPONSIBILITY: "property",
  ASSET_MISSING_ROLE: "property",
  ASSET_MISSING_AUTOMATION_LEVEL: "property",
  ELEMENT_DEFAULT_NAME: "property",
  ELEMENT_MISSING_IDLABEL: "property",
  DUPLICATE_IDLABEL: "property",
  DF_EMPTY_LABEL: "property",
  DF_DEPRECATED_VERB: "property",
  DF_UNKNOWN_VERB: "property",
  DF_MISSING_OBJECT: "property",
  DF_MULTIPLE_TAGS: "property",
  DF_SYNONYM_VERB: "property",
  DF_OBJECT_EMBEDDED_VERB: "property",
  DF_PULL_MISSING_FLOW_TYPE: "property",
  DF_PULL_INVALID_FLOW_TYPE: "property",
  DF_PULL_MISSING_RESPONSE: "property",
  DF_PULL_MULTIPLE_RESPONSES: "property",
  DF_PULL_ORPHANED_RESPONSE: "property",
  DF_PUSH_MISSING_CMD: "property",
  DF_PUSH_MISSING_FLOW_TYPE: "property",
  DF_PUSH_INVALID_FLOW_TYPE: "property",
  DF_WRITE_REDUNDANT_FLOW_TYPE: "property",
  DF_READ_REDUNDANT_FLOW_TYPE: "property",
  DF_STREAM_INVALID_FLOW_TYPE: "property",
  DF_STREAM_LOGICAL_ANNOTATION_FORBIDDEN: "property",
  DF_REQ_RESP_DUPLICATE_COVERAGE: "property",
  DF_EVENT_ACK_DUPLICATE_COVERAGE: "property",
  DF_OBJECT_FORBIDDEN_TERM: "property",
  DF_PROP_BIDIRECTIONAL_FORBIDDEN: "property",
  DF_PROP_PULL_NOT_REQRESP: "property",
  DF_PROP_PUSH_IS_REQRESP: "property",
  DF_PROP_PUSH_WRONG_DIRECTION: "property",
  DF_PROP_WRITE_IS_REQRESP: "property",
  DF_PROP_WRITE_NOT_DATASTORE: "property",
  DF_PROP_READ_IS_REQRESP: "property",
  DF_PROP_STREAM_NOT_CONTINUOUS: "property",
  DF_PROP_STREAM_IS_REQRESP: "property",
  DF_PROP_CONTINUOUS_USE_STREAM: "property",
  DF_PROP_PROTOCOL_MISSING: "property",
  DF_PHYSICAL_MISSING_COUPLING: "property",
  DF_PROP_EXCLUDE_MISSING_RATIONALE: "property",
  DF_LP_VERB_DIRECTION_CONFLICT: "property",
  DF_LP_TAG_FREQUENCY_MISMATCH: "property",
  DF_LP_TAG_MESSAGETYPE_MISMATCH: "property",
  DF_LP_ELECTRICAL_PULL_VERB: "property",
  DF_LP_WRITE_TARGET_NOT_DATASTORE: "property",
  DF_LP_READ_SOURCE_NOT_DATASTORE: "property",
  DF_LP_READ_ON_COMMUNICATION_STORE: "property",
  DF_LP_READ_STORE_UNCLASSIFIED: "property",
  DF_LP_PULL_ON_DIRECT_ACCESS_STORE: "property",
  DF_TLS_NO_TERMINATOR: "property",
  DF_MTLS_REQUIRES_BOTH_MUTUAL: "property",
  DF_TLS_HANDSHAKE_MISMATCH: "property",
  DF_SSH_NO_ENDPOINT: "property",
  DF_APPLICATION_REQUIRES_BOTH: "property",
  KEY_RENEWAL_PLAINTEXT: "property",
  KEY_RENEWAL_NO_CHANNEL: "property",
  KEY_RENEWAL_UPDATE_NOT_ENCRYPTED: "property",
  EL_CHANNEL_UNUSED: "property",
};

const STRUCTURAL = new Set<string>(
  (Object.keys(FINDING_CLASS) as (keyof typeof ValidationMessages)[])
    .filter((k) => FINDING_CLASS[k] === "structure")
    .map((k) => ValidationMessages[k]),
);

/**
 * A finding about the structure (connection, endpoints, leveled identity) —
 * not about property values or labels. Keys outside ValidationMessages are
 * the property validators' own (tabs.dfd.validation.…) and count as
 * property; the leveled findings (dfdValidation.leveled.…) as structure.
 */
export function isStructuralFinding(key: string): boolean {
  return STRUCTURAL.has(key) || key.startsWith("dfdValidation.leveled.");
}
