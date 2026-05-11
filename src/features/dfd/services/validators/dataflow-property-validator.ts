// ==================== DATAFLOW PROPERTY VALIDATOR ====================
// Single Responsibility: Validate consistency between DF label verb
// and DataFlowProperties.
//
// Rules:
//   C1  pull  → direction must be "requestresponse"
//   C2  push  → direction must be "unidirectional"
//   C3  stream→ frequency should be "continuous"
//   C4  write → protocol should be "database" or "file"
//   C5  push or pull + frequency "continuous" → suggest stream
//   C6  write + direction "requestresponse" → ERROR
//   C7  direction "bidirectional" (any verb) → ERROR (forbidden globally)
//   C8  stream + direction "requestresponse" → WARNING
//   C9  excludeFromThreatGen=true + empty rationale → WARNING
//   C10 protocol not specified (any verb) → WARNING
//       Fires even when no properties are set at all.
//       Rationale: unknown transport = highest risk assumption in threat modeling.
//       write is exempt when protocol is intentionally omitted (C4 covers the
//       wrong-protocol case; a write to a local store may legitimately have no
//       network protocol).
//
// Message format: `${ValidationMessages.KEY}:${context}`
//   context = "DF-3 — read safety params [req]"
//   Uses em dash (—) not colon to avoid breaking the KEY:name split
//   in dfd-validation-panel.tsx translateMessage().

import type { DFDConnection } from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";
import type {
  DataFlowProperties,
  Protocol,
} from "../../models/element-properties";

// ---------------------------------------------------------------------------
// DataFlowProperties — local mirror to avoid import coupling.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build context string for UI display.
 * Uses em dash (—) to avoid breaking the KEY:name split.
 */
function buildContext(conn: DFDConnection): string {
  const name = conn.name || `(unnamed DF ${conn.id})`;
  return conn.displayId ? `${conn.displayId} \u2014 ${name}` : name;
}

/** Extract verb (first word, lowercased) from a DF label. */
function extractVerb(label: string): string | null {
  const trimmed = label
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();

  if (!trimmed) return null;

  const withoutFlowType = trimmed.replace(/\[[^\]]*\]\s*$/, "").trim();
  const tokens = withoutFlowType.split(/\s+/);
  return tokens[0] ? tokens[0].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate consistency between DF label verbs and DataFlowProperties.
 * C10 fires for all dataflows regardless of whether properties are set.
 * All other rules only apply when properties are present.
 */
export function validateDataflowProperties(
  connections: DFDConnection[],
  errors: string[],
  warnings: string[],
): void {
  const dataflows = connections.filter(
    (c) =>
      (c as { type?: string }).type === "dataflow" ||
      !(c as { type?: string }).type,
  );

  for (const conn of dataflows) {
    const context = buildContext(conn);
    const verb = extractVerb(conn.name || "");

    const props = conn.properties;

    // C10: protocol not specified — fires regardless of whether props exist.
    // write is exempt: local datastores legitimately have no network protocol,
    // and C4 already covers the wrong-protocol case for write.
    if (verb !== "write") {
      const protocol =
        props && typeof props === "object" ? props.protocol : undefined;
      if (protocol === undefined) {
        warnings.push(
          `${ValidationMessages.DF_PROP_PROTOCOL_MISSING}:${context}`,
        );
      }
    }

    if (!props || typeof props !== "object") continue;

    // C9: excludeFromThreatGen without rationale — fires regardless of verb
    if (
      props.excludeFromThreatGen &&
      !props.excludeFromThreatGenRationale?.trim()
    ) {
      warnings.push(
        `${ValidationMessages.DF_PROP_EXCLUDE_MISSING_RATIONALE}:${context}`,
      );
    }

    if (!verb) continue;

    // C7: bidirectional forbidden — check first, always fires regardless of verb
    if (props.direction === "bidirectional") {
      errors.push(
        `${ValidationMessages.DF_PROP_BIDIRECTIONAL_FORBIDDEN}:${context}`,
      );
    }

    switch (verb) {
      case "pull":
        checkPull(context, props, errors, warnings);
        break;
      case "push":
        checkPush(context, props, errors, warnings);
        break;
      case "write":
        checkWrite(context, props, errors, warnings);
        break;
      case "stream":
        checkStream(context, props, errors, warnings);
        break;
      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Per-verb checks
// ---------------------------------------------------------------------------

function checkPull(
  context: string,
  props: DataFlowProperties,
  errors: string[],
  warnings: string[],
): void {
  // C1
  if (
    props.direction !== undefined &&
    props.direction !== "requestresponse" &&
    props.direction !== "bidirectional" // already reported via C7
  ) {
    errors.push(
      `${ValidationMessages.DF_PROP_PULL_NOT_REQRESP}:${context} [${props.direction}]`,
    );
  }

  // C5
  if (props.frequency === "continuous") {
    warnings.push(
      `${ValidationMessages.DF_PROP_CONTINUOUS_USE_STREAM}:${context}`,
    );
  }
}

function checkPush(
  context: string,
  props: DataFlowProperties,
  errors: string[],
  warnings: string[],
): void {
  // C2a
  if (props.direction === "requestresponse") {
    errors.push(`${ValidationMessages.DF_PROP_PUSH_IS_REQRESP}:${context}`);
  } else if (
    props.direction !== undefined &&
    props.direction !== "unidirectional" &&
    props.direction !== "bidirectional" // already reported via C7
  ) {
    // C2b: unexpected direction value
    warnings.push(
      `${ValidationMessages.DF_PROP_PUSH_WRONG_DIRECTION}:${context} [${props.direction}]`,
    );
  }

  // C5
  if (props.frequency === "continuous") {
    warnings.push(
      `${ValidationMessages.DF_PROP_CONTINUOUS_USE_STREAM}:${context}`,
    );
  }
}

function checkWrite(
  context: string,
  props: DataFlowProperties,
  errors: string[],
  warnings: string[],
): void {
  // C4
  const dataStoreProtocols: Protocol[] = ["database", "file"];
  if (
    props.protocol !== undefined &&
    !dataStoreProtocols.includes(props.protocol)
  ) {
    warnings.push(
      `${ValidationMessages.DF_PROP_WRITE_NOT_DATASTORE}:${context} [${props.protocol}]`,
    );
  }

  // C6
  if (props.direction === "requestresponse") {
    errors.push(`${ValidationMessages.DF_PROP_WRITE_IS_REQRESP}:${context}`);
  }
}

function checkStream(
  context: string,
  props: DataFlowProperties,
  errors: string[],
  warnings: string[],
): void {
  // C3
  if (props.frequency !== undefined && props.frequency !== "continuous") {
    warnings.push(
      `${ValidationMessages.DF_PROP_STREAM_NOT_CONTINUOUS}:${context} [${props.frequency}]`,
    );
  }

  // C8
  if (props.direction === "requestresponse") {
    warnings.push(
      `${ValidationMessages.DF_PROP_STREAM_IS_REQRESP}:${context}`,
    );
  }
}