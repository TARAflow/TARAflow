// ==================== VALIDATOR UTILS ====================
// Shared utilities for DFD validation

// ==================== VALIDATION MESSAGE KEYS ====================
// These keys are used for i18n translation in the UI layer

export const ValidationMessages = {
  // General
  NO_ELEMENTS: "dfdValidation.noElements",
  NO_PROCESS_OR_DATASTORE: "dfdValidation.noProcessOrDatastore",
  NO_DATAFLOWS: "dfdValidation.noDataflows",

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

  // Asset & Interface
  ASSET_NOT_PLACED: "dfdValidation.assetNotPlaced",
  INTERFACE_UNUSED: "dfdValidation.interfaceUnused",

  // Asset Relations (NEW)
  // ASSET_MARKER_NO_RELATION: "dfdValidation.assetMarkerNoRelation",
  // ASSET_RELATION_NO_MARKER: "dfdValidation.assetRelationNoMarker",
  ASSET_RELATION_TYPE_INVALID: "dfdValidation.assetRelationTypeInvalid",
  ASSET_RELATION_INCONSISTENT: "dfdValidation.assetRelationInconsistent",
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

  // ── Pull ────────────────────────────────────────────────────────────────
  DF_PULL_MISSING_FLOW_TYPE: "tabs.dfd.validation.df.pull.missingFlowType",
  DF_PULL_INVALID_FLOW_TYPE: "tabs.dfd.validation.df.pull.invalidFlowType",
  DF_PULL_MISSING_RESPONSE: "tabs.dfd.validation.df.pull.missingResponse",
  DF_PULL_MULTIPLE_RESPONSES: "tabs.dfd.validation.df.pull.multipleResponses",
  DF_PULL_ORPHANED_RESPONSE: "tabs.dfd.validation.df.pull.orphanedResponse",

  // ── Push ────────────────────────────────────────────────────────────────
  DF_PUSH_MISSING_CMD: "tabs.dfd.validation.df.push.missingCmd",
  DF_PUSH_INVALID_FLOW_TYPE: "tabs.dfd.validation.df.push.invalidFlowType",

  // ── Write ───────────────────────────────────────────────────────────────
  DF_WRITE_REDUNDANT_FLOW_TYPE:
    "tabs.dfd.validation.df.write.redundantFlowType",

  // ── Stream ──────────────────────────────────────────────────────────────
  DF_STREAM_INVALID_FLOW_TYPE: "tabs.dfd.validation.df.stream.invalidFlowType",

  // ── Properties ──────────────────────────────────────────────────────────
  DF_PROP_BIDIRECTIONAL_FORBIDDEN:
    "tabs.dfd.validation.df.prop.bidirectionalForbidden",
  DF_PROP_PULL_NOT_REQRESP: "tabs.dfd.validation.df.prop.pullNotReqResp",
  DF_PROP_PUSH_IS_REQRESP: "tabs.dfd.validation.df.prop.pushIsReqResp",
  DF_PROP_PUSH_WRONG_DIRECTION:
    "tabs.dfd.validation.df.prop.pushWrongDirection",
  DF_PROP_WRITE_IS_REQRESP: "tabs.dfd.validation.df.prop.writeIsReqResp",
  DF_PROP_WRITE_NOT_DATASTORE: "tabs.dfd.validation.df.prop.writeNotDatastore",
  DF_PROP_STREAM_NOT_CONTINUOUS:
    "tabs.dfd.validation.df.prop.streamNotContinuous",
  DF_PROP_STREAM_IS_REQRESP: "tabs.dfd.validation.df.prop.streamIsReqResp",
  DF_PROP_CONTINUOUS_USE_STREAM:
    "tabs.dfd.validation.df.prop.continuousUseStream",

  // ── Threat Analysis ─────────────────────────────────────────────────────
  DF_PROP_EXCLUDE_MISSING_RATIONALE:
    "tabs.dfd.validation.df.prop.excludeMissingRationale",
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
  // German defaults
  "prozess",
  "externe entität",
  "datenspeicher",
  "vertrauensgrenze",
  "multiprozess",
  "schnittstelle",
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

  // Check if name matches a default name
  const isDefault = DEFAULT_NAMES.some(
    (defaultName) =>
      normalized === defaultName ||
      normalized.startsWith(defaultName + " ") ||
      normalized.endsWith(" " + defaultName)
  );

  // Also check for very short names (1-2 chars) that aren't ID labels
  const isTooShort = normalized.length <= 2 && !normalized.match(/^[a-z]{1,2}-?\d+$/i);

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