// ==================== DATAFLOW LABEL VALIDATOR ====================
// Single Responsibility: Validate DF naming convention
//
// Convention: <verb> <object> [<flow-type>]
//
// Valid verbs:
//   pull   → Request/Response
//              Physical:  [req] / [resp]  — explicit pair (opposite direction, same object)
//              Compact:   [req_resp]      — standalone notation; both directions expanded internally
//   push   → One-way asynchronous
//              Physical:  [cmd]           — command / action
//              Physical:  [event]         — notification
//              Compact:   [event_ack]     — event with expected acknowledgement (metadata only)
//   write  → Persistence into datastore — MUST NOT carry any tag (error if present)
//   read   → Direct read from a passive (direct_access) datastore —
//              MUST NOT carry any tag (error if present). store → actor.
//   stream → Continuous data flow — [stream] optional; logical annotations forbidden (error)
//
// Deprecated verbs → ERROR: send, recv
// Synonym verbs    → ERROR: fetch, query, emit, notify, publish, receive
//
// Duplication checks (Option B — compact notations are valid standalone):
//   D1: pull [req_resp] + pull [req]    same direction same object → WARNING
//   D2: pull [req_resp] + pull [resp]   reverse direction same object → WARNING
//   D3: push [event_ack] + push [event] same direction same object → WARNING
//
// Object rules:
//   - Must be present (error if missing)
//   - MUST NOT contain transport/encoding terms → WARNING
//   - MUST NOT begin with a verb → WARNING
//   - Canonical identity: lowercase, strip HTML, normalize whitespace
//
// Hard Invariant 2:
//   A flow may carry either a physical flow-type OR a logical annotation — not both.
//   Multiple [...] tags → ERROR
//
// Message format: `${ValidationMessages.KEY}|${displayId}|${detail}`
//   displayId = "DF-3"                        — rendered as Chip in notification panel
//   detail    = "read safety params [req]"    — human-readable context for translated message
//   The | separator avoids conflict with the i18next namespace separator (:)
//   and allows the panel to extract displayId without regex.

import type { DFDElement } from "../../models/dfd-types";
import type { DFDConnection, ValidationFinding } from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";
import { validateDataflowLabelProperties } from "./dataflow-label-property-validator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedLabel {
  raw: string;
  verb: string;
  object: string;
  flowType: string | null;
  extraTags: string[]; // additional [...] tags beyond the last one — Hard Invariant 2
  parseable: boolean;
}

interface ParsedConnection {
  conn: DFDConnection;
  displayId: string; // "DF-3" — for Chip rendering in notification panel
  detail: string; // "read safety params [req]" — for message text
  parsed: ParsedLabel;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_VERBS = ["pull", "push", "write", "read", "stream"] as const;
type ValidVerb = (typeof VALID_VERBS)[number];

/** Formerly used verbs — replaced by pull/push */
const DEPRECATED_VERBS = ["send", "recv"] as const;

/**
 * Common synonyms explicitly forbidden by the convention.
 * Provide a targeted hint toward the correct verb.
 */
const SYNONYM_VERBS = [
  "fetch",
  "query",
  "emit",
  "notify",
  "publish",
  "receive",
] as const;

const VALID_FLOW_TYPES_PULL = ["req", "resp", "req_resp"] as const;
const VALID_FLOW_TYPES_PUSH = ["cmd", "event", "event_ack"] as const;

const FORBIDDEN_OBJECT_TERMS = [
  "json",
  "mqtt",
  "http",
  "grpc",
  "rest",
  "payload",
  "message",
  "packet",
] as const;

/**
 * Verbs that must not appear as the first word of the object.
 * Covers all deprecated, synonym, and valid verbs to catch
 * patterns like "get vehicle state", "send data", "push config".
 */
const OBJECT_FORBIDDEN_START_VERBS = [
  // valid verbs
  "pull",
  "push",
  "write",
  "read",
  "stream",
  // deprecated
  "send",
  "recv",
  // synonyms
  "fetch",
  "query",
  "emit",
  "notify",
  "publish",
  "receive",
  // other common embedded verbs from the convention doc
  "get",
  "set",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDetail(conn: DFDConnection): string {
  return conn.name || `(unnamed DF ${conn.id})`;
}

function parseLabel(raw: string): ParsedLabel {
  const trimmed = raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();

  if (!trimmed) {
    return {
      raw,
      verb: "",
      object: "",
      flowType: null,
      extraTags: [],
      parseable: false,
    };
  }

  // Collect ALL [...] tags at the end of the string, right to left
  const allTags: string[] = [];
  let rest = trimmed;
  const tagPattern = /\[([^\]]+)\]\s*$/;

  let match = rest.match(tagPattern);
  while (match) {
    allTags.unshift(match[1].toLowerCase().trim());
    rest = rest.slice(0, match.index).trim();
    match = rest.match(tagPattern);
  }

  // Last tag = flowType, any preceding tags = extraTags (Hard Invariant 2)
  const flowType = allTags.length > 0 ? allTags[allTags.length - 1] : null;
  const extraTags = allTags.slice(0, allTags.length - 1);

  const tokens = rest.split(/\s+/);
  if (!tokens[0]) {
    return { raw, verb: "", object: "", flowType, extraTags, parseable: false };
  }

  return {
    raw,
    verb: tokens[0].toLowerCase(),
    object: tokens.slice(1).join(" ").trim(),
    flowType,
    extraTags,
    parseable: true,
  };
}

function normalizeObject(obj: string): string {
  return obj
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function validateDataflowLabels(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  const dataflows = connections.filter(
    (c) =>
      (c as { type?: string }).type === "dataflow" ||
      !(c as { type?: string }).type,
  );

  const parsed: ParsedConnection[] = dataflows.map((conn) => ({
    conn,
    displayId: conn.displayId ?? conn.id,
    detail: buildDetail(conn),
    parsed: parseLabel(conn.name || ""),
  }));

  for (const { conn, displayId, detail, parsed: p } of parsed) {
    const elementId = conn.id;

    if (!p.parseable || !p.verb) {
      warnings.push({
        key: ValidationMessages.DF_EMPTY_LABEL,
        displayId,
        elementId,
        params: { detail },
      });
      continue;
    }

    // Hard Invariant 2: only one [...] tag allowed
    if (p.extraTags.length > 0) {
      errors.push({
        key: ValidationMessages.DF_MULTIPLE_TAGS,
        displayId,
        elementId,
        params: { detail, tags: p.extraTags },
      });
      continue;
    }

    // Deprecated: send / recv
    if ((DEPRECATED_VERBS as readonly string[]).includes(p.verb)) {
      errors.push({
        key: ValidationMessages.DF_DEPRECATED_VERB,
        displayId,
        elementId,
        params: { detail, verb: p.verb },
      });
      continue;
    }

    // Synonym: read, fetch, query, emit, notify, publish, receive
    if ((SYNONYM_VERBS as readonly string[]).includes(p.verb)) {
      errors.push({
        key: ValidationMessages.DF_SYNONYM_VERB,
        displayId,
        elementId,
        params: { detail, verb: p.verb },
      });
      continue;
    }

    // Fully unknown verb
    if (!(VALID_VERBS as readonly string[]).includes(p.verb)) {
      errors.push({
        key: ValidationMessages.DF_UNKNOWN_VERB,
        displayId,
        elementId,
        params: { detail, verb: p.verb },
      });
      continue;
    }

    if (!p.object) {
      errors.push({
        key: ValidationMessages.DF_MISSING_OBJECT,
        displayId,
        elementId,
        params: { detail },
      });
      continue;
    }

    switch (p.verb as ValidVerb) {
      case "pull":
        if (p.flowType === null) {
          errors.push({
            key: ValidationMessages.DF_PULL_MISSING_FLOW_TYPE,
            displayId,
            elementId,
            params: { detail },
          });
        } else if (
          !(VALID_FLOW_TYPES_PULL as readonly string[]).includes(p.flowType)
        ) {
          errors.push({
            key: ValidationMessages.DF_PULL_INVALID_FLOW_TYPE,
            displayId,
            elementId,
            params: { detail, flowType: p.flowType },
          });
        }
        break;

      case "push":
        if (p.flowType === null) {
          errors.push({
            key: ValidationMessages.DF_PUSH_MISSING_FLOW_TYPE,
            displayId,
            elementId,
            params: { detail },
          });
        } else if (
          !(VALID_FLOW_TYPES_PUSH as readonly string[]).includes(p.flowType)
        ) {
          errors.push({
            key: ValidationMessages.DF_PUSH_INVALID_FLOW_TYPE,
            displayId,
            elementId,
            params: { detail, flowType: p.flowType },
          });
        }
        break;

      case "read":
        if (p.flowType !== null) {
          errors.push({
            key: ValidationMessages.DF_READ_REDUNDANT_FLOW_TYPE,
            displayId,
            elementId,
            params: { detail, flowType: p.flowType },
          });
        }
        break;

      case "write":
        if (p.flowType !== null) {
          errors.push({
            key: ValidationMessages.DF_WRITE_REDUNDANT_FLOW_TYPE,
            displayId,
            elementId,
            params: { detail, flowType: p.flowType },
          });
        }
        break;

      case "stream":
        if (p.flowType !== null && p.flowType !== "stream") {
          if (p.flowType === "req_resp" || p.flowType === "event_ack") {
            errors.push({
              key: ValidationMessages.DF_STREAM_LOGICAL_ANNOTATION_FORBIDDEN,
              displayId,
              elementId,
              params: { detail, flowType: p.flowType },
            });
          } else {
            errors.push({
              key: ValidationMessages.DF_STREAM_INVALID_FLOW_TYPE,
              displayId,
              elementId,
              params: { detail, flowType: p.flowType },
            });
          }
        }
        break;
    }
  }

  validatePullPairs(parsed, errors, warnings);
  validateReqRespDuplication(parsed, warnings);
  validateEventAckDuplication(parsed, warnings);
  validateObjectForbiddenTerms(parsed, warnings);
  validateObjectEmbeddedVerb(parsed, warnings);
  // Phase 2
  validateDataflowLabelProperties(connections, elements, errors, warnings);
}

// ---------------------------------------------------------------------------
// Explicit [req] / [resp] pair validation
// ---------------------------------------------------------------------------

function validatePullPairs(
  parsed: ParsedConnection[],
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  const reqs = parsed.filter(
    (p) => p.parsed.verb === "pull" && p.parsed.flowType === "req",
  );
  const resps = parsed.filter(
    (p) => p.parsed.verb === "pull" && p.parsed.flowType === "resp",
  );

  for (const req of reqs) {
    const matches = resps.filter(
      (r) =>
        normalizeObject(r.parsed.object) ===
          normalizeObject(req.parsed.object) &&
        r.conn.from === req.conn.to &&
        r.conn.to === req.conn.from,
    );
    if (matches.length === 0) {
      warnings.push({
        key: ValidationMessages.DF_PULL_MISSING_RESPONSE,
        displayId: req.displayId,
        elementId: req.conn.id,
        params: { detail: req.detail },
      });
    } else if (matches.length > 1) {
      warnings.push({
        key: ValidationMessages.DF_PULL_MULTIPLE_RESPONSES,
        displayId: req.displayId,
        elementId: req.conn.id,
        params: { detail: req.detail },
      });
    }
  }

  for (const resp of resps) {
    const matches = reqs.filter(
      (r) =>
        normalizeObject(r.parsed.object) ===
          normalizeObject(resp.parsed.object) &&
        r.conn.from === resp.conn.to &&
        r.conn.to === resp.conn.from,
    );
    if (matches.length === 0) {
      errors.push({
        key: ValidationMessages.DF_PULL_ORPHANED_RESPONSE,
        displayId: resp.displayId,
        elementId: resp.conn.id,
        params: { detail: resp.detail },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// D1 / D2: [req_resp] duplication check
// ---------------------------------------------------------------------------

function validateReqRespDuplication(
  parsed: ParsedConnection[],
  warnings: ValidationFinding[],
): void {
  const reqResps = parsed.filter(
    (p) => p.parsed.verb === "pull" && p.parsed.flowType === "req_resp",
  );

  if (reqResps.length === 0) return;

  const reqs = parsed.filter(
    (p) => p.parsed.verb === "pull" && p.parsed.flowType === "req",
  );
  const resps = parsed.filter(
    (p) => p.parsed.verb === "pull" && p.parsed.flowType === "resp",
  );

  for (const rr of reqResps) {
    const obj = normalizeObject(rr.parsed.object);

    const conflictingReq = reqs.find(
      (r) =>
        normalizeObject(r.parsed.object) === obj &&
        r.conn.from === rr.conn.from &&
        r.conn.to === rr.conn.to,
    );
    const conflictingResp = resps.find(
      (r) =>
        normalizeObject(r.parsed.object) === obj &&
        r.conn.from === rr.conn.to &&
        r.conn.to === rr.conn.from,
    );

    if (conflictingReq) {
      warnings.push({
        key: ValidationMessages.DF_REQ_RESP_DUPLICATE_COVERAGE,
        displayId: rr.displayId,
        elementId: rr.conn.id,
        params: {
          detail: rr.detail,
          conflictDisplayId: conflictingReq.displayId,
          conflictDetail: conflictingReq.detail,
        },
      });
    }
    if (conflictingResp) {
      warnings.push({
        key: ValidationMessages.DF_REQ_RESP_DUPLICATE_COVERAGE,
        displayId: rr.displayId,
        elementId: rr.conn.id,
        params: {
          detail: rr.detail,
          conflictDisplayId: conflictingResp.displayId,
          conflictDetail: conflictingResp.detail,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// D3: [event_ack] duplication check
// ---------------------------------------------------------------------------

function validateEventAckDuplication(
  parsed: ParsedConnection[],
  warnings: ValidationFinding[],
): void {
  const eventAcks = parsed.filter(
    (p) => p.parsed.verb === "push" && p.parsed.flowType === "event_ack",
  );

  if (eventAcks.length === 0) return;

  const pushEvents = parsed.filter(
    (p) => p.parsed.verb === "push" && p.parsed.flowType === "event",
  );

  for (const ea of eventAcks) {
    const obj = normalizeObject(ea.parsed.object);

    const conflictingEvent = pushEvents.find(
      (e) =>
        normalizeObject(e.parsed.object) === obj &&
        e.conn.from === ea.conn.from &&
        e.conn.to === ea.conn.to,
    );

    if (conflictingEvent) {
      warnings.push({
        key: ValidationMessages.DF_EVENT_ACK_DUPLICATE_COVERAGE,
        displayId: ea.displayId,
        elementId: ea.conn.id,
        params: {
          detail: ea.detail,
          conflictDisplayId: conflictingEvent.displayId,
          conflictDetail: conflictingEvent.detail,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Object forbidden-term validation
// Whole-word match after normalization. Severity: warning.
// ---------------------------------------------------------------------------

function validateObjectForbiddenTerms(
  parsed: ParsedConnection[],
  warnings: ValidationFinding[],
): void {
  for (const { conn, displayId, detail, parsed: p } of parsed) {
    if (!p.parseable || !p.object) continue;

    const tokens = normalizeObject(p.object).split(/\s+/);
    const found = FORBIDDEN_OBJECT_TERMS.filter((term) =>
      tokens.some((token) => token === term),
    );

    if (found.length > 0) {
      warnings.push({
        key: ValidationMessages.DF_OBJECT_FORBIDDEN_TERM,
        displayId,
        elementId: conn.id,
        params: { detail, terms: [...found] },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Object embedded-verb validation
// First word of object must not be a verb. Severity: warning.
// Catches: "get vehicle state", "send data", "push config" etc.
// ---------------------------------------------------------------------------

function validateObjectEmbeddedVerb(
  parsed: ParsedConnection[],
  warnings: ValidationFinding[],
): void {
  for (const { conn, displayId, detail, parsed: p } of parsed) {
    if (!p.parseable || !p.object) continue;

    const firstToken = normalizeObject(p.object).split(/\s+/)[0];

    if (
      (OBJECT_FORBIDDEN_START_VERBS as readonly string[]).includes(firstToken)
    ) {
      warnings.push({
        key: ValidationMessages.DF_OBJECT_EMBEDDED_VERB,
        displayId,
        elementId: conn.id,
        params: { detail, verb: firstToken },
      });
    }
  }
}