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
//   stream → Continuous data flow — [stream] optional; logical annotations forbidden (error)
//
// Deprecated verbs → ERROR: send, recv
//
// Duplication checks (Option B — compact notations are valid standalone):
//   D1: pull [req_resp] + pull [req]    same direction same object → WARNING
//   D2: pull [req_resp] + pull [resp]   reverse direction same object → WARNING
//   D3: push [event_ack] + push [event] same direction same object → WARNING
//
// Object rules:
//   - Must be present (error if missing)
//   - MUST NOT contain transport/encoding terms → WARNING
//   - Canonical identity: lowercase, strip HTML, normalize whitespace
//
// Message format: `${ValidationMessages.KEY}:${context}`
//   context = "DF-3 — read safety params [req]"
//   Uses em dash (—) not colon to avoid breaking the KEY:name split
//   in dfd-validation-panel.tsx translateMessage().

import type { DFDConnection } from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedLabel {
  raw: string;
  verb: string;
  object: string;
  flowType: string | null;
  parseable: boolean;
}

interface ParsedConnection {
  conn: DFDConnection;
  context: string;
  parsed: ParsedLabel;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_VERBS = ["pull", "push", "write", "stream"] as const;
type ValidVerb = (typeof VALID_VERBS)[number];

const DEPRECATED_VERBS = ["send", "recv"] as const;

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
  "frame",
  "buffer",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(conn: DFDConnection): string {
  const name = conn.name || `(unnamed DF ${conn.id})`;
  return conn.displayId ? `${conn.displayId} \u2014 ${name}` : name;
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
  errors: string[],
  warnings: string[],
): void {
  const dataflows = connections.filter(
    (c) =>
      (c as { type?: string }).type === "dataflow" ||
      !(c as { type?: string }).type,
  );

  const parsed: ParsedConnection[] = dataflows.map((conn) => ({
    conn,
    context: buildContext(conn),
    parsed: parseLabel(conn.name || ""),
  }));

  for (const { context, parsed: p } of parsed) {
    if (!p.parseable || !p.verb) {
      warnings.push(`${ValidationMessages.DF_EMPTY_LABEL}:${context}`);
      continue;
    }

    if ((DEPRECATED_VERBS as readonly string[]).includes(p.verb)) {
      errors.push(
        `${ValidationMessages.DF_DEPRECATED_VERB}:${context} [${p.verb}]`,
      );
      continue;
    }

    if (!(VALID_VERBS as readonly string[]).includes(p.verb)) {
      errors.push(
        `${ValidationMessages.DF_UNKNOWN_VERB}:${context} [${p.verb}]`,
      );
      continue;
    }

    if (!p.object) {
      errors.push(`${ValidationMessages.DF_MISSING_OBJECT}:${context}`);
      continue;
    }

    switch (p.verb as ValidVerb) {
      case "pull":
        if (p.flowType === null) {
          errors.push(
            `${ValidationMessages.DF_PULL_MISSING_FLOW_TYPE}:${context}`,
          );
        } else if (
          !(VALID_FLOW_TYPES_PULL as readonly string[]).includes(p.flowType)
        ) {
          errors.push(
            `${ValidationMessages.DF_PULL_INVALID_FLOW_TYPE}:${context} [${p.flowType}]`,
          );
        }
        break;

      case "push":
        if (p.flowType === null) {
          errors.push(
            `${ValidationMessages.DF_PUSH_MISSING_FLOW_TYPE}:${context}`,
          );
        } else if (
          !(VALID_FLOW_TYPES_PUSH as readonly string[]).includes(p.flowType)
        ) {
          errors.push(
            `${ValidationMessages.DF_PUSH_INVALID_FLOW_TYPE}:${context} [${p.flowType}]`,
          );
        }
        break;

      case "write":
        if (p.flowType !== null) {
          errors.push(
            `${ValidationMessages.DF_WRITE_REDUNDANT_FLOW_TYPE}:${context} [${p.flowType}]`,
          );
        }
        break;

      case "stream":
        if (p.flowType !== null && p.flowType !== "stream") {
          if (p.flowType === "req_resp" || p.flowType === "event_ack") {
            errors.push(
              `${ValidationMessages.DF_STREAM_LOGICAL_ANNOTATION_FORBIDDEN}:${context} [${p.flowType}]`,
            );
          } else {
            errors.push(
              `${ValidationMessages.DF_STREAM_INVALID_FLOW_TYPE}:${context} [${p.flowType}]`,
            );
          }
        }
        break;
    }
  }

  validatePullPairs(parsed, errors, warnings);
  validateReqRespDuplication(parsed, warnings);
  validateEventAckDuplication(parsed, warnings);
  validateObjectForbiddenTerms(parsed, warnings);
}

// ---------------------------------------------------------------------------
// Explicit [req] / [resp] pair validation
// ---------------------------------------------------------------------------

function validatePullPairs(
  parsed: ParsedConnection[],
  errors: string[],
  warnings: string[],
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
      warnings.push(
        `${ValidationMessages.DF_PULL_MISSING_RESPONSE}:${req.context}`,
      );
    } else if (matches.length > 1) {
      warnings.push(
        `${ValidationMessages.DF_PULL_MULTIPLE_RESPONSES}:${req.context}`,
      );
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
      errors.push(
        `${ValidationMessages.DF_PULL_ORPHANED_RESPONSE}:${resp.context}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// D1 / D2: [req_resp] duplication check
// ---------------------------------------------------------------------------

function validateReqRespDuplication(
  parsed: ParsedConnection[],
  warnings: string[],
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
      warnings.push(
        `${ValidationMessages.DF_REQ_RESP_DUPLICATE_COVERAGE}:${rr.context} \u2014 conflicts with ${conflictingReq.context}`,
      );
    }
    if (conflictingResp) {
      warnings.push(
        `${ValidationMessages.DF_REQ_RESP_DUPLICATE_COVERAGE}:${rr.context} \u2014 conflicts with ${conflictingResp.context}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// D3: [event_ack] duplication check
// ---------------------------------------------------------------------------

function validateEventAckDuplication(
  parsed: ParsedConnection[],
  warnings: string[],
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
      warnings.push(
        `${ValidationMessages.DF_EVENT_ACK_DUPLICATE_COVERAGE}:${ea.context} \u2014 conflicts with ${conflictingEvent.context}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Object forbidden-term validation
// Whole-word match after normalization. Severity: warning.
// ---------------------------------------------------------------------------

function validateObjectForbiddenTerms(
  parsed: ParsedConnection[],
  warnings: string[],
): void {
  for (const { context, parsed: p } of parsed) {
    if (!p.parseable || !p.object) continue;

    const tokens = normalizeObject(p.object).split(/\s+/);
    const found = FORBIDDEN_OBJECT_TERMS.filter((term) =>
      tokens.some((token) => token === term),
    );

    if (found.length > 0) {
      warnings.push(
        `${ValidationMessages.DF_OBJECT_FORBIDDEN_TERM}:${context} | terms: ${found.join(", ")}`,
      );
    }
  }
}