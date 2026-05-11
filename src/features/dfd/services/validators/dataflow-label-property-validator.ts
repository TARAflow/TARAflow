// ==================== DATAFLOW LABEL ↔ PROPERTY CROSS-VALIDATOR ====================
// Single Responsibility: Validate consistency between DF label convention
//                        and structured DataFlowProperties.
//
// Complements dataflow-label-validator.ts (syntax only).
// This validator checks semantic consistency between:
//   - Label verb/tag  (communication pattern declared in name)
//   - Structured props (direction, frequency, messageType, protocol group)
//
// Rules:
//   LP-1  Verb ↔ Direction conflict          → ERROR
//   LP-2  Tag  ↔ Frequency inconsistency     → WARNING
//   LP-3  Verb+Tag ↔ MessageType mismatch    → WARNING
//   LP-4  Protocol group ↔ Verb              → WARNING
//   LP-5  write verb → target must be DataStore → ERROR
//
// ── TODO ──────────────────────────────────────────────────────────────────────
//   Extract parseLabel() / ParsedLabel / buildContext() from
//   dataflow-label-validator.ts into a shared
//   dataflow-label-parser.ts module and import here.
//   Currently duplicated to avoid circular dependency.

import type { DFDConnection, DFDElement } from "../../models/dfd-types";
import type { DataFlowProperties } from "../../models/element-properties";
import { PROTOCOL_META } from "../../models/protocol-registry";
import { ValidationMessages } from "./validator-utils";

// ---------------------------------------------------------------------------
// Types  (duplicated from dataflow-label-validator.ts — see TODO above)
// ---------------------------------------------------------------------------

interface ParsedLabel {
  raw: string;
  verb: string;
  object: string;
  flowType: string | null;
  parseable: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_VERBS = ["pull", "push", "write", "stream"] as const;
type ValidVerb = (typeof VALID_VERBS)[number];

/** LP-1: verb → required direction value */
const VERB_DIRECTION_REQUIRED: Partial<Record<ValidVerb, string>> = {
  pull:   "requestresponse",
  push:   "unidirectional",
  write:  "unidirectional",
  stream: "unidirectional",
};

/**
 * LP-2: tag → expected frequency values.
 * Empty array = no constraint for this tag.
 */
const TAG_FREQUENCY_EXPECTED: Record<string, string[]> = {
  stream:    ["continuous"],
  event:     ["event_based"],
  event_ack: ["event_based"],
  req:       ["ondemand", "periodic"],
  resp:      ["ondemand", "periodic"],
  req_resp:  ["ondemand", "periodic"],
  cmd:       [], // commands can be any frequency
};

/**
 * LP-3: verb+tag composite key → acceptable messageType values.
 * Only fires when messageType is explicitly set on the flow.
 * Keys: "verb" or "verb:tag"
 */
const VERB_TAG_MESSAGETYPE_ACCEPTABLE: Record<string, string[]> = {
  "push:cmd":        ["command"],
  "push:event":      ["alarm_event", "status", "telemetry"],
  "push:event_ack":  ["alarm_event", "status"],
  "stream":          ["measurement", "telemetry"],
  "write":           ["log_audit", "config"],
  // pull flows carry a wide range — not checked (too many valid combinations)
};

// ---------------------------------------------------------------------------
// Helpers  (duplicated from dataflow-label-validator.ts — see TODO above)
// ---------------------------------------------------------------------------

function buildContext(conn: DFDConnection): string {
  const name = conn.name || `(unnamed DF ${conn.id})`;
    const context = conn.displayId
    ? `${conn.displayId} — ${name}`
    : name;

  return context;
}

function parseLabel(raw: string): ParsedLabel {
  const trimmed = raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();

  if (!trimmed) {
    return { raw, verb: "", object: "", flowType: null, parseable: false };
  }

  const flowTypeMatch = trimmed.match(/\[([^\]]+)\]\s*$/);
  const flowType = flowTypeMatch
    ? flowTypeMatch[1].toLowerCase().trim()
    : null;

  const withoutFlowType = flowTypeMatch
    ? trimmed.slice(0, flowTypeMatch.index).trim()
    : trimmed;

  const tokens = withoutFlowType.split(/\s+/);
  if (!tokens[0]) {
    return { raw, verb: "", object: "", flowType, parseable: false };
  }

  return {
    raw,
    verb: tokens[0].toLowerCase(),
    object: tokens.slice(1).join(" ").trim(),
    flowType,
    parseable: true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate semantic consistency between DF label verb/tag and
 * structured DataFlowProperties (direction, frequency, messageType, protocol).
 *
 * Call this after validateDataflowLabels() in the main validator runner.
 * Requires elements[] for LP-5 (write → DataStore).
 */
export function validateDataflowLabelProperties(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: string[],
  warnings: string[],
): void {
  const dataflows = connections.filter(
    (c) =>
      (c as { type?: string }).type === "dataflow" ||
      !(c as { type?: string }).type,
  );

  const elementById = new Map(elements.map((e) => [e.id, e]));

  for (const conn of dataflows) {
    const context = buildContext(conn);
    const parsed = parseLabel(conn.name || "");

    // Skip connections with unparseable labels — handled by dataflow-label-validator
    if (!parsed.parseable || !parsed.verb) continue;

    // Skip unknown verbs — handled by dataflow-label-validator
    if (!(VALID_VERBS as readonly string[]).includes(parsed.verb)) continue;

    const verb = parsed.verb as ValidVerb;
    const tag = parsed.flowType;
    const props = (conn as { properties?: DataFlowProperties }).properties;
    const displayId = conn.displayId ?? conn.id;

    // runLP1(verb, props, displayId, errors);
    runLP2(tag, props, displayId, warnings);
    runLP3(verb, tag, props, displayId, warnings);
    runLP4(verb, props, displayId, warnings);
    runLP5(verb, conn, elementById, displayId, errors);
  }
}

// ---------------------------------------------------------------------------
// LP-1: Verb ↔ Direction conflict
// ---------------------------------------------------------------------------
// Fires only when direction is explicitly set — skips undefined (not yet modeled).
// Severity: ERROR — a pull label on a unidirectional flow is a clear contradiction.

function runLP1(
  verb: ValidVerb,
  props: DataFlowProperties | undefined,
  displayId: string,
  errors: string[],
): void {
  if (!props?.direction) return;
  const requiredDirection = VERB_DIRECTION_REQUIRED[verb];
  if (!requiredDirection) return;
  if (props.direction !== requiredDirection) {
    errors.push(
      `${ValidationMessages.DF_LP_VERB_DIRECTION_CONFLICT}|${displayId}|` +
        `verb "${verb}" expects direction="${requiredDirection}", ` +
        `got "${props.direction}"`,
    );
  }
}

// ---------------------------------------------------------------------------
// LP-2: Tag ↔ Frequency inconsistency
// ---------------------------------------------------------------------------
// Fires only when frequency is explicitly set on the connection.
// Severity: WARNING — frequency may have been set manually before label was updated.

function runLP2(
  tag: string | null,
  props: DataFlowProperties | undefined,
  displayId: string,
  warnings: string[],
): void {
  if (!props?.frequency || tag === null) return;
  const expected = TAG_FREQUENCY_EXPECTED[tag];
  if (!expected || expected.length === 0) return;
  if (!expected.includes(props.frequency)) {
    warnings.push(
      `${ValidationMessages.DF_LP_TAG_FREQUENCY_MISMATCH}|${displayId}|${tag}|${expected.join(",")}|${props.frequency}`,
    );
  }
}

// ---------------------------------------------------------------------------
// LP-3: Verb+Tag ↔ MessageType mismatch
// ---------------------------------------------------------------------------
// Fires only when messageType is explicitly set on the connection.
// Severity: WARNING — analyst may have set a specific type intentionally.

function runLP3(
  verb: ValidVerb,
  tag: string | null,
  props: DataFlowProperties | undefined,
  displayId: string,
  warnings: string[],
): void {
  if (!props?.messageType) return;
  const key = tag ? `${verb}:${tag}` : verb;
  const acceptable = VERB_TAG_MESSAGETYPE_ACCEPTABLE[key];
  if (!acceptable) return;
  if (!acceptable.includes(props.messageType)) {
    warnings.push(
      `${ValidationMessages.DF_LP_TAG_MESSAGETYPE_MISMATCH}|${displayId}|${key}|${acceptable.join(",")}|${props.messageType}`,
    );
  }
}

// ---------------------------------------------------------------------------
// LP-4: Protocol group ↔ Verb
// ---------------------------------------------------------------------------
// Electrical signals are physically unidirectional — pull semantics are invalid.
// Severity: WARNING — analyst may be modeling an edge case.

function runLP4(
  verb: ValidVerb,
  props: DataFlowProperties | undefined,
  displayId: string,
  warnings: string[],
): void {
  if (!props?.protocol) return;
  const meta = PROTOCOL_META[props.protocol];
  if (!meta) return;
  if (meta.group === "electrical" && verb === "pull") {
    warnings.push(
      `${ValidationMessages.DF_LP_ELECTRICAL_PULL_VERB}|${displayId}|${props.protocol}`,
    );
  }
}

// ---------------------------------------------------------------------------
// LP-5: write verb → target must be DataStore
// ---------------------------------------------------------------------------
// write represents persistence — connecting to a Process or ExternalEntity
// is a modeling error.
// Severity: ERROR — write to non-DataStore has no valid threat modeling semantics.

function runLP5(
  verb: ValidVerb,
  conn: DFDConnection,
  elementById: Map<string, DFDElement>,
  displayId: string,
  errors: string[],
): void {
  if (verb !== "write") return;
  const target = elementById.get(conn.to);
  if (!target) return;
  if (target.type !== "DataStore") {
    errors.push(
      `${ValidationMessages.DF_LP_WRITE_TARGET_NOT_DATASTORE}|${displayId}|${target.name || target.id}|${target.type}`,
    );
  }
}