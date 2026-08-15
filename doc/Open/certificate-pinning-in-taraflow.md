# Certificate Pinning in TARAflow — Modeling Proposal

## 1. Problem Statement

TARAflow's `DataFlowProperties` currently models transport security through three fields:

```typescript
encryptionInTransit?: "none" | "tls" | "mtls" | "vpn" | "custom";
endpointAuthentication?: "none" | "password" | "certificate" | "mutual_tls" | ... ;
integrityProtection?: "none" | "crc" | "hash" | "hmac" | "signature" | "custom";
```

None of these fields capture **certificate/public-key pinning**. This is not an oversight in naming — pinning is orthogonal to all three:

| Field                    | Answers                                                            |
|--------------------------|---------------------------------------------------------------------|
| `encryptionInTransit`    | Is the channel encrypted, and with what protocol class?             |
| `endpointAuthentication` | Does the endpoint present credentials, and of what type?             |
| `integrityProtection`    | Can in-transit tampering be detected?                                |
| **(missing)**            | **Which specific certificate/key is the client willing to trust?**  |

A flow can have `encryptionInTransit = "tls"` and `endpointAuthentication = "certificate"` and still be fully vulnerable to MITM via a rogue, compromised, or coerced CA — because the client accepts *any* certificate signed by *any* CA in the OS truststore. Pinning narrows that trust set. It is a refinement of the trust model underlying `tls`/`mtls`, not a new encryption or auth mechanism.

## 2. Why It Belongs on the DataFlow (not Process, Interface, or Trust Boundary)

- **Process** (`tlsTermination`, `authenticationRequired`) describes the endpoint's own capabilities — it doesn't know or care what the *other side* chooses to trust.
- **Interface** (`implementedControls.linkAuthentication`) is scoped to link-layer association (WiFi/BLE pairing), not application-layer TLS trust.
- **TrustBoundary** (`boundaryControlTypes`) describes controls enforced *at* a boundary crossing generically, not the specific client-side validation logic of one flow.
- **DataFlow** is the only element that represents a directed, endpoint-specific channel — exactly the granularity pinning operates at (this flow, to this specific host, trusts this specific cert/key).

This also matches the existing precedent of `integrityProtection` and `cryptoStandard` living on `DataFlowProperties`: they are per-channel trust refinements layered on top of `encryptionInTransit`, following the same "cause vs. effect" separation TARAflow already uses elsewhere (e.g. `location` → `exposureLevel`).

## 3. Proposed Schema Addition

```typescript
export interface DataFlowProperties {
  // ... existing fields ...

  /**
   * Client-side trust-anchor validation beyond default OS/CA-truststore trust.
   * Only meaningful when encryptionInTransit = "tls" | "mtls".
   * DECOUPLED from endpointAuthentication — pinning hardens WHICH certificate/key
   * the client accepts, not HOW the endpoint proves its identity in-protocol.
   *
   *   none              → Default CA-trust only — any CA-signed cert accepted
   *                        Threat: Spoofing via rogue/compromised/coerced CA (MITM)
   *   pinned_cert       → Exact leaf certificate pinned — breaks on cert rotation
   *   pinned_public_key → SPKI/public-key pinning — survives cert renewal if key stable
   *   pinned_ca         → Custom/private CA pinned — narrower trust than system store
   *   custom            → Proprietary mechanism — document in notes
   *
   * Threat implication:
   *   none      → Spoofing (rogue CA / MDM-injected root) threat generated on this flow
   *   pinned_*  → Spoofing via rogue CA mitigated; residual: pin-bypass exploit,
   *               pinning-library vulnerability, or app-level bypass on
   *               jailbroken/rooted/MDM-managed device
   */
  certificatePinning?:
    | "none"
    | "pinned_cert"
    | "pinned_public_key"
    | "pinned_ca"
    | "custom";

  /**
   * Rationale when certificatePinning deviates from the flow's default
   * risk posture, or documentation of the pinning strategy chosen.
   * @example "SPKI pinning on leaf cert public key; rotated via app update
   *           before cert expiry to avoid hard-fail on renewal."
   */
  certificatePinningRationale?: string;
}
```

## 4. Plausibility / Cascade Rules

Following TARAflow's existing pattern of derived-vs-manual fields with rationale gates (see `exposureLevelSource`, `accessModelSource`):

```typescript
// Plausibility check
if (certificatePinning !== "none" && encryptionInTransit === "none") {
  // Invalid state — pinning requires TLS in the first place
  requireRationale("certificatePinningRationale");
}

if (encryptionInTransit === "tls" && certificatePinning === undefined) {
  // Default to "none" explicitly rather than leaving unset —
  // an unset field should not silently suppress the Spoofing threat template
  certificatePinning = "none";
}
```

## 5. Threat Generation Impact

For any DataFlow where `encryptionInTransit ∈ {tls, mtls}`:

| `certificatePinning` | Spoofing Threat (rogue-CA MITM) |
|---|---|
| `none` (or unset)    | **Generated**, severity based on flow's `dataClassification` / `messageType` |
| `pinned_cert` / `pinned_public_key` / `pinned_ca` | **Mitigated**, residual threat noted (pin-bypass, library CVE, managed-device root injection) |
| `custom`             | Held open — requires `certificatePinningRationale` before mitigation is credited |

This mirrors exactly how `integrityProtection: "none" | "crc"` vs. `"hmac" | "signature"` toggles the Tampering threat today.

## 6. Worked Example — Nussbaum DataTrack (Flutter App)

Applying this to the reviewed DFD:

| Flow ID | Path | `encryptionInTransit` | `endpointAuthentication` | `certificatePinning` (current state) |
|---|---|---|---|---|
| DF-12 / DF-13 | App → Entra ID / B2C (Authentication) | `tls` | `oauth` | `none` |
| DF-16 / DF-18 | App → mdv-backend (report pull, measurement sync) | `tls` | `oauth` (Bearer via MSAL token) | `none` |

Both flows currently rely on the platform's default CA-truststore validation (confirmed via code review: no `HttpClient`/`Dio` override, no `SecurityContext` customization, generated OpenAPI client uses the plain `http` package with the app-supplied `basePath`). With the new field, this becomes an explicit, auditable model state — `certificatePinning: "none"` on DF-12, DF-13, DF-16, and DF-18 — rather than an implicit gap only visible via source-code grep.

## 7. Migration Note

No backward-compatibility concern: this is a new optional field. Existing DataFlow objects without `certificatePinning` should be treated as `"none"` for threat-generation purposes (see cascade rule in §4) so the Spoofing template fires by default until an analyst explicitly reviews and sets the flow.

## 8. Summary

- Pinning is a **DataFlow-level** property — it belongs in `DataFlowProperties`, not on Process, Interface, or TrustBoundary.
- It is **orthogonal** to `encryptionInTransit`, `endpointAuthentication`, and `integrityProtection` — none of the existing fields can represent it without overloading their meaning.
- A new `certificatePinning` enum (+ `certificatePinningRationale`) follows TARAflow's established authoring conventions (enum + doc-comment threat implication + rationale gate) and slots cleanly into the existing Spoofing/MITM threat-generation logic for `tls`/`mtls` flows.
