// ==================== DATAFLOW LABEL VALIDATOR ====================
// Single Responsibility: Validate DF naming convention
//
// Convention: <verb> <object> [<flow-type>]
//
// Valid verbs:
//   pull   → Request/Response pair (always paired, same verb both ways)
//   push   → One-way action / fire-and-forget [cmd]
//   write  → One-way write to Data Store (no flow-type)
//   stream → Continuous data flow [stream] optional
//
// Deprecated verbs → ERROR: send, recv
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
  /** Context shown in the UI: "DF-3 — read safety params [req]" */
  context: string;
  parsed: ParsedLabel;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_VERBS = ["pull", "push", "write", "stream"] as const;
type ValidVerb = (typeof VALID_VERBS)[number];

const DEPRECATED_VERBS = ["send", "recv"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the context string shown in the UI.
 * Uses em dash (—) instead of colon to avoid breaking the KEY:name split
 * in translateMessage().
 */
function buildContext(conn: DFDConnection): string {
  const name = conn.name || `(unnamed DF ${conn.id})`;
  return conn.displayId ? `${conn.displayId} \u2014 ${name}` : name;
}

/**
 * Parse a DF label into verb / object / flow-type.
 * Handles multi-line labels from draw.io (<br>, \n).
 */
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

/**
 * Validate all dataflow labels against the TARAflow naming convention.
 *
 * Message format: `${ValidationMessages.KEY}:${context}`
 * The UI (dfd-validation-panel.tsx) splits on the first ":" to get:
 *   parts[0] → i18n key  (e.g. "dfdValidation.dfUnknownVerb")
 *   parts[1] → {{name}}  (e.g. "DF-3 — read safety params [req] [read]")
 */
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

    // R1a: Deprecated verb — append [verb] for clarity
    if ((DEPRECATED_VERBS as readonly string[]).includes(p.verb)) {
      errors.push(
        `${ValidationMessages.DF_DEPRECATED_VERB}:${context} [${p.verb}]`,
      );
      continue;
    }

    // R1b: Unknown verb — append [verb] for clarity
    if (!(VALID_VERBS as readonly string[]).includes(p.verb)) {
      errors.push(
        `${ValidationMessages.DF_UNKNOWN_VERB}:${context} [${p.verb}]`,
      );
      continue;
    }

    // R2: Object must be present
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
        } else if (p.flowType !== "req" && p.flowType !== "resp") {
          errors.push(
            `${ValidationMessages.DF_PULL_INVALID_FLOW_TYPE}:${context} [${p.flowType}]`,
          );
        }
        break;

      case "push":
        if (p.flowType === null) {
          errors.push(`${ValidationMessages.DF_PUSH_MISSING_CMD}:${context}`);
        } else if (p.flowType !== "cmd") {
          errors.push(
            `${ValidationMessages.DF_PUSH_INVALID_FLOW_TYPE}:${context} [${p.flowType}]`,
          );
        }
        break;

      case "write":
        if (p.flowType !== null) {
          warnings.push(
            `${ValidationMessages.DF_WRITE_REDUNDANT_FLOW_TYPE}:${context} [${p.flowType}]`,
          );
        }
        break;

      case "stream":
        if (p.flowType !== null && p.flowType !== "stream") {
          warnings.push(
            `${ValidationMessages.DF_STREAM_INVALID_FLOW_TYPE}:${context} [${p.flowType}]`,
          );
        }
        break;
    }
  }

  validatePullPairs(parsed, errors, warnings);
}

// ---------------------------------------------------------------------------
// Pair validation
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