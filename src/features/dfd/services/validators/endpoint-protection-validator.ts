// ==================== ENDPOINT PROTECTION VALIDATOR ====================
// Single Responsibility: TLS capability/usage invariant (pair-level).
//
// A DataFlow may only *use* transport encryption that its endpoints *enable*
// (decision #3 of the Interface refactor plan):
//
//   Flow.encryptionInTransit   (usage — "this transmission uses TLS/mTLS")
//        must be backed by
//   endpoint tlsTermination     (capability — "this endpoint can terminate TLS")
//
// PAIR-LEVEL, NOT DIRECTIONAL. The channel is encrypted; at least one endpoint
// terminates. A single flow's data direction is irrelevant — e.g. a device
// uploads to a cloud AND the cloud pushes an update notice back over the same
// device-initiated connection where the cloud is always the TLS server. A
// directional "terminator = to" rule would falsely demand the device terminate
// TLS on the update flow. So we check the endpoint PAIR, not from/to.
//
// CAPABILITY (Option B): explicit `tlsTermination` on Process/Multiprocess,
// decoupled from authenticationRequired. Encryption capability and auth
// mechanism are independent facts (Sigrist: an HTTPS server with password login
// has tlsTermination="server" AND authenticationRequired="password").

import type {
  DFDElement,
  DFDConnection,
  ValidationFinding,
} from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";
import type {
  DataFlowProperties,
  ProcessProperties,
  MultiprocessProperties,
} from "../../models/element-properties";

/** TLS termination capability of an endpoint. mutual ⊃ server ⊃ none. */
type TlsTermination = "none" | "server" | "mutual";

/** Read the explicit tlsTermination capability (Option B). Defaults to none. */
function endpointTls(el: DFDElement | undefined): TlsTermination {
  if (!el) return "none";
  const p = el.properties as
    | (ProcessProperties & MultiprocessProperties)
    | undefined;
  return p?.tlsTermination ?? "none";
}

/**
 * A5 — validate transport-encryption capability vs. usage on every TLS-using
 * flow, at the endpoint-pair level.
 *
 * Rule 1a (tls): at least one endpoint must terminate TLS.
 *   violation iff both = none → DF_TLS_NO_TERMINATOR
 * Rule 1b (mtls): both endpoints must be mutual.
 *   violation iff either ≠ mutual → DF_MTLS_REQUIRES_BOTH_MUTUAL
 * Rule 2 (tls): one side requires mutual but the other cannot present a client
 *   cert (is none) → handshake would fail.
 *   violation iff (a=mutual ∧ b=none) ∨ (b=mutual ∧ a=none)
 *   → DF_TLS_HANDSHAKE_MISMATCH
 *   (a server+mutual pair still succeeds: the mutual side also serves simple TLS.)
 *
 * Only `tls` / `mtls` usage is gated. `vpn` / `custom` / `none` / undefined and
 * physical-medium edges are out of scope.
 */
export function validateEndpointProtection(
  connections: DFDConnection[],
  elements: DFDElement[],
  errors: ValidationFinding[],
): void {
  const elementById = new Map(elements.map((e) => [e.id, e]));

  for (const conn of connections) {
    const props = conn.properties as DataFlowProperties | undefined;
    if (!props) continue;

    // Physical coupling edges (Sensor/Actuator ↔ environment) carry no protocol.
    if (props.medium === "physical") continue;

    const enc = props.encryptionInTransit;
    if (enc !== "tls" && enc !== "mtls") continue; // only TLS usage is gated

    const a = elementById.get(conn.from);
    const b = elementById.get(conn.to);
    if (!a || !b) continue; // dangling — reported elsewhere

    const capA = endpointTls(a);
    const capB = endpointTls(b);
    const detail = conn.name || `(unnamed DF ${conn.id})`;
    const displayId = conn.displayId ?? conn.id;

    if (enc === "mtls") {
      // Rule 1b — mTLS requires BOTH endpoints mutual.
      if (capA !== "mutual" || capB !== "mutual") {
        errors.push({
          key: ValidationMessages.DF_MTLS_REQUIRES_BOTH_MUTUAL,
          displayId,
          elementId: conn.id,
          params: { detail },
        });
      }
      continue;
    }

    // enc === "tls" from here.

    // Rule 1a — no endpoint terminates any TLS.
    if (capA === "none" && capB === "none") {
      errors.push({
        key: ValidationMessages.DF_TLS_NO_TERMINATOR,
        displayId,
        elementId: conn.id,
        params: { detail: `${detail} [tls]` },
      });
      continue;
    }

    // Rule 2 — one side requires mutual, the other cannot present a client cert.
    const mismatch =
      (capA === "mutual" && capB === "none") ||
      (capB === "mutual" && capA === "none");
    if (mismatch) {
      errors.push({
        key: ValidationMessages.DF_TLS_HANDSHAKE_MISMATCH,
        displayId,
        elementId: conn.id,
        params: { detail },
      });
    }
  }
}