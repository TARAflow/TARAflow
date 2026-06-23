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
// Message format: `${ValidationMessages.KEY}|${displayId}|${detail}`
//   displayId = "DF-3"                        — rendered as Chip in notification panel
//   detail    = "read safety params [req]"    — human-readable context for translated message
//   The | separator avoids conflict with the i18next namespace separator (:)
//   and allows the panel to extract displayId without regex.

import type { DFDConnection, ValidationFinding } from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";
import type {
  DataFlowProperties,
  Protocol,
} from "../../models/element-properties";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDetail(conn: DFDConnection): string {
  return conn.name || `(unnamed DF ${conn.id})`;
}

/** Extract verb (first word, lowercased) from a DF label.
 *  Strips ALL trailing [...] tags before tokenizing — consistent
 *  with parseLabel() in dataflow-label-validator.ts.
 */
function extractVerb(label: string): string | null {
  const trimmed = label
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();

  if (!trimmed) return null;

  // Strip ALL trailing [...] tags
  let rest = trimmed;
  const tagPattern = /\[[^\]]*\]\s*$/;
  while (tagPattern.test(rest)) {
    rest = rest.replace(tagPattern, "").trim();
  }

  const tokens = rest.split(/\s+/);
  return tokens[0] ? tokens[0].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function validateDataflowProperties(
  connections: DFDConnection[],
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  const dataflows = connections.filter(
    (c) =>
      (c as { type?: string }).type === "dataflow" ||
      !(c as { type?: string }).type,
  );

  for (const conn of dataflows) {
    const displayId = conn.displayId ?? conn.id;
    const detail = buildDetail(conn);
    const verb = extractVerb(conn.name || "");
    const props = conn.properties;

    // Physical coupling short-circuit: a medium="physical" edge (Sensor/Actuator
    // ↔ environment) carries no protocol/verb — the cyber checks C1–C10 do not
    // apply and would otherwise raise false positives (e.g. C10 "protocol
    // missing"). Validate the physical group instead, then skip the rest.
    if (
      props &&
      typeof props === "object" &&
      (props as DataFlowProperties).medium === "physical"
    ) {
      const p = props as DataFlowProperties;
      if (!p.couplingMode) {
        warnings.push({
          key: ValidationMessages.DF_PHYSICAL_MISSING_COUPLING,
          displayId,
          elementId: conn.id,
          params: { detail },
        });
      }
      continue;
    }

    // C10: protocol not specified — fires regardless of whether props exist.
    // write is exempt: local datastores legitimately have no network protocol,
    // and C4 already covers the wrong-protocol case for write.
    if (verb !== "write" && verb !== "read") {
      const protocol =
        props && typeof props === "object" ? props.protocol : undefined;
      if (protocol === undefined) {
        warnings.push({
          key: ValidationMessages.DF_PROP_PROTOCOL_MISSING,
          displayId,
          elementId: conn.id,
          params: { detail },
        });
      }
    }

    if (!props || typeof props !== "object") continue;

    // C9: excludeFromThreatGen without rationale — fires regardless of verb
    if (
      props.excludeFromThreatGen &&
      !props.excludeFromThreatGenRationale?.trim()
    ) {
      warnings.push({
        key: ValidationMessages.DF_PROP_EXCLUDE_MISSING_RATIONALE,
        displayId,
        elementId: conn.id,
        params: { detail },
      });
    }

    if (!verb) continue;

    // C7: bidirectional forbidden — check first, always fires regardless of verb
    if (props.direction === "bidirectional") {
      errors.push({
        key: ValidationMessages.DF_PROP_BIDIRECTIONAL_FORBIDDEN,
        displayId,
        elementId: conn.id,
        params: { detail },
      });
    }

    switch (verb) {
      case "pull":
        checkPull(displayId, detail, conn.id, props, errors, warnings);
        break;
      case "push":
        checkPush(displayId, detail, conn.id, props, errors, warnings);
        break;
      case "write":
        checkWrite(displayId, detail, conn.id, props, errors, warnings);
        break;
      case "read":
        checkRead(displayId, detail, conn.id, props, errors, warnings);
        break;
      case "stream":
        checkStream(displayId, detail, conn.id, props, errors, warnings);
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
  displayId: string,
  detail: string,
  elementId: string,
  props: DataFlowProperties,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  // C1
  if (
    props.direction !== undefined &&
    props.direction !== "requestresponse" &&
    props.direction !== "bidirectional" // already reported via C7
  ) {
    errors.push({
      key: ValidationMessages.DF_PROP_PULL_NOT_REQRESP,
      displayId,
      elementId,
      params: { detail: `${detail} [${props.direction}]` },
    });
  }

  // C5
  if (props.frequency === "continuous") {
    warnings.push({
      key: ValidationMessages.DF_PROP_CONTINUOUS_USE_STREAM,
      displayId,
      elementId,
      params: { detail },
    });
  }
}

function checkPush(
  displayId: string,
  detail: string,
  elementId: string,
  props: DataFlowProperties,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  // C2a
  if (props.direction === "requestresponse") {
    errors.push({
      key: ValidationMessages.DF_PROP_PUSH_IS_REQRESP,
      displayId,
      elementId,
      params: { detail },
    });
  } else if (
    props.direction !== undefined &&
    props.direction !== "unidirectional" &&
    props.direction !== "bidirectional" // already reported via C7
  ) {
    // C2b: unexpected direction value
    warnings.push({
      key: ValidationMessages.DF_PROP_PUSH_WRONG_DIRECTION,
      displayId,
      elementId,
      params: { detail: `${detail} [${props.direction}]` },
    });
  }

  // C5
  if (props.frequency === "continuous") {
    warnings.push({
      key: ValidationMessages.DF_PROP_CONTINUOUS_USE_STREAM,
      displayId,
      elementId,
      params: { detail },
    });
  }
}

function checkWrite(
  displayId: string,
  detail: string,
  elementId: string,
  props: DataFlowProperties,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  // C4
  // Direct-access store writes carry a transport that reaches a passive store.
  // IT/server stores use file/database; embedded flash/EEPROM/NVRAM stores are
  // reached over a hardware bus (SPI/I2C) or memory-mapped access (custom).
  // The protocol only names the path — it does not change the store's passive
  // nature, so all of these are legitimate targets for the `write` verb.
  // NOTE: this remains a protocol heuristic. The precise check is whether the
  // edge targets a DataStore with accessModel="direct_access"; that requires the
  // target node here (not currently passed in) — tracked as a follow-up.
  const dataStoreProtocols: Protocol[] = [
    "database",
    "file",
    "spi",
    "i2c",
    "custom",
  ];
  if (
    props.protocol !== undefined &&
    !dataStoreProtocols.includes(props.protocol)
  ) {
    warnings.push({
      key: ValidationMessages.DF_PROP_WRITE_NOT_DATASTORE,
      displayId,
      elementId,
      params: { detail: `${detail} [${props.protocol}]` },
    });
  }

  // C6
  if (props.direction === "requestresponse") {
    errors.push({
      key: ValidationMessages.DF_PROP_WRITE_IS_REQRESP,
      displayId,
      elementId,
      params: { detail },
    });
  }
}

function checkRead(
  displayId: string,
  detail: string,
  elementId: string,
  props: DataFlowProperties,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  // C6r: read is store → actor (direct passive-storage access), never req/resp.
  if (props.direction === "requestresponse") {
    errors.push({
      key: ValidationMessages.DF_PROP_READ_IS_REQRESP,
      displayId,
      elementId,
      params: { detail },
    });
  }
}

function checkStream(
  displayId: string,
  detail: string,
  elementId: string,
  props: DataFlowProperties,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  // C3
  if (props.frequency !== undefined && props.frequency !== "continuous") {
    warnings.push({
      key: ValidationMessages.DF_PROP_STREAM_NOT_CONTINUOUS,
      displayId,
      elementId,
      params: { detail: `${detail} [${props.frequency}]` },
    });
  }

  // C8
  if (props.direction === "requestresponse") {
    warnings.push({
      key: ValidationMessages.DF_PROP_STREAM_IS_REQRESP,
      displayId,
      elementId,
      params: { detail },
    });
  }
}