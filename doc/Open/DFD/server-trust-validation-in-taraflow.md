# Server Trust Validation in TARAflow — Modeling Proposal (v4)

> **Revision history:** v1 used the field name `certificatePinning`, which external
> review found too narrow (enum values like `pinned_ca` were not actually pinning) and
> semantically ambiguous (`none` read as "no validation" rather than "default CA-store
> validation"). v2 renamed the field to `serverTrustValidation` and restructured the
> enum. v3 refined `private_ca` wording, made `custom`'s threat treatment explicit,
> centralized the transport check, and flagged an unrelated `endpointAuthentication`
> question. v4 (this version) tightens terminology, renames two helper functions for
> clarity, trims §9, and softens threat-implication phrasing. One point from the v3
> review round — removing the persisted `serverTrustValidationSource` field — was
> considered and **not** adopted; see §6a for the reasoning. Full changelogs: §8 (v1→v2),
> §9b (v2→v3), §10 (v3→v4).

## 1. Problem Statement

TARAflow's `DataFlowProperties` currently models transport security through three fields:

```typescript
encryptionInTransit?: "none" | "tls" | "mtls" | "vpn" | "custom";
endpointAuthentication?: "none" | "password" | "certificate" | "mutual_tls" | ... ;
integrityProtection?: "none" | "crc" | "hash" | "hmac" | "signature" | "custom";
```

None of these fields capture **how strongly the client validates the server's trust
anchor beyond default CA-chain trust**. This is not an oversight in naming — it is a
genuinely separate dimension:

| Field                    | Answers                                                            |
|--------------------------|---------------------------------------------------------------------|
| `encryptionInTransit`    | Is the channel encrypted, and with what protocol class?             |
| `endpointAuthentication` | Does the endpoint present credentials, and of what type?             |
| `integrityProtection`    | Can in-transit tampering be detected?                                |
| **(missing)**            | **Which trust anchor(s) is the client willing to accept for server trust validation?** |

A flow can have `encryptionInTransit = "tls"` and `endpointAuthentication = "certificate"`
and still be vulnerable to MITM via a rogue, compromised, or coerced CA — because the
client accepts *any* certificate signed by *any* CA in the OS truststore. Narrowing that
trust set is the actual security-relevant decision. **Certificate/public-key pinning is
one implementation of server trust validation — not the concept itself.**

## 2. Why "Pinning" Was the Wrong Frame (and What the Right Frame Is)

Strict certificate/public-key pinning is only one of several mechanisms that answer the
same underlying question — *how strongly is server trust validated?* Others include:

- Trusting a **private/enterprise root CA** instead of the system truststore (not pinning
  — it's trust-anchor *selection*, full chain validation still applies)
- **DANE/TLSA** (DNS-based trust anchor assertions)
- **TOFU** (Trust-On-First-Use, common in SSH-adjacent and IoT provisioning flows)
- **Certificate Transparency enforcement**
- **TPM-bound trust** / platform-managed trust stores (Android Network Security Config,
  Apple ATS overrides)

Framing the field around "pinning" specifically forced values like `pinned_ca` into a box
they don't fit — a private CA is a different trust anchor, not a narrower pin. The field
is therefore renamed and reframed as **server trust validation strength**, with pinning
as one of several possible values.

## 3. Placement — Unchanged from v1

The placement on `DataFlowProperties` is correct and not affected by the renaming. Trust
validation strength is a property of a specific, directed, endpoint-specific channel —
not of the Process, Interface, or TrustBoundary:

- **Process** (`tlsTermination`, `authenticationRequired`) describes the endpoint's own
  capabilities, not what the *other side* chooses to trust.
- **Interface** (`implementedControls.linkAuthentication`) is scoped to link-layer
  association, not application-layer TLS trust decisions.
- **TrustBoundary** (`boundaryControlTypes`) describes controls enforced generically at a
  boundary crossing, not the specific client-side validation logic of one flow.
- **DataFlow** is the only element with the right granularity: *this flow, to this host,
  trusts this anchor.*

## 4. Revised Schema Proposal

```typescript
export interface DataFlowProperties {
  // ... existing fields ...

  /**
   * Strength of client-side server-identity validation, beyond the base fact that
   * TLS is used (see encryptionInTransit). Only meaningful when
   * encryptionInTransit = "tls" | "mtls".
   *
   * DECOUPLED from endpointAuthentication — this field describes WHICH trust anchor(s)
   * the client accepts for the server's identity, not HOW the endpoint proves identity
   * in-protocol (that is endpointAuthentication's job).
   *
   *   system_ca         → Default OS/platform CA-truststore validation. Full chain
   *                        validation IS performed — this is NOT "no validation".
   *                        Threat: Spoofing via rogue/compromised/coerced CA (MITM)
   *   private_ca        → Client validates the server certificate against a dedicated
   *                        private trust anchor rather than relying solely on the
   *                        platform trust store. Full PKIX chain validation still
   *                        applies — only the trust anchor differs. This is
   *                        trust-anchor selection, not pinning.
   *   pinned_certificate → Exact leaf certificate pinned. Breaks on cert rotation
   *                        unless rotation is coordinated with app releases.
   *   pinned_public_key  → SPKI/public-key pinning. Survives cert renewal as long as
   *                        the key pair is stable.
   *   custom             → Other mechanism (DANE/TLSA, TOFU, Certificate Transparency
   *                        enforcement, TPM-bound trust, etc.) — document in
   *                        serverTrustValidationRationale.
   *
   * Threat implication:
   *   system_ca  → Spoofing via rogue CA remains an active threat on this flow.
   *   private_ca → Spoofing risk is reduced to compromise of the private trust
   *                anchor — not eliminated; only as strong as that CA's own key
   *                protection.
   *   pinned_*   → Rogue-CA attacks are reduced, not eliminated. Residual vectors
   *                remain regardless of pinning strategy: compromised endpoint,
   *                compromised build/supply chain, malware with API hooking, TLS
   *                library CVEs, root/jailbreak bypass of the pinning check, MDM-
   *                injected root certificates on managed devices, or DNS manipulation
   *                combined with a stolen private key.
   *   custom     → Held open — requires serverTrustValidationRationale before any
   *                threat reduction is credited. Threat reduction for "custom" is
   *                never assumed by default: DANE/TLSA, TOFU, Certificate
   *                Transparency enforcement, and TPM-bound trust have materially
   *                different security strength, and the analyst must justify the
   *                specific mechanism's assurance level in the rationale before the
   *                threat generator treats it as a reduction rather than as
   *                equivalent to system_ca.
   */
  serverTrustValidation?:
    | "system_ca"
    | "private_ca"
    | "pinned_certificate"
    | "pinned_public_key"
    | "custom";

  /**
   * Provenance of the serverTrustValidation value, mirroring the derived/manual
   * pattern used elsewhere (exposureLevelSource, accessModelSource). This IS
   * persisted — it is not a throwaway resolver artifact. See §6a for why.
   *   derived → The currently stored value was computed by
   *             deriveServerTrustValidation() (§6) and applied without manual
   *             review. Subject to being recomputed/overwritten on re-analysis.
   *   manual  → An analyst has explicitly reviewed and set this value after
   *             confirming the actual implementation. Will not be silently
   *             overwritten by re-analysis.
   */
  serverTrustValidationSource?: "derived" | "manual";

  /**
   * Rationale — required when serverTrustValidation = "custom", or when the analyst
   * overrides a derived value, or to document the chosen mechanism's specifics.
   * @example "SPKI pinning on leaf cert public key; key rotated via app update
   *           ahead of cert expiry to avoid hard-fail on renewal."
   * @example "DANE/TLSA record enforced at the OS resolver level for this host."
   */
  serverTrustValidationRationale?: string;
}
```

## 5. Plausibility Rules

```typescript
// Invalid state — server trust validation presumes a certificate-authenticated
// transport is in use at all. Uses the same predicate as deriveServerTrustValidation
// (§6) so the plausibility check and the derivation logic can never silently disagree.
if (
  serverTrustValidation !== undefined &&
  !hasCertificateBasedServerAuthentication(encryptionInTransit)
) {
  flagInconsistency("serverTrustValidation requires a certificate-authenticated transport");
}

// custom requires rationale before any threat reduction is credited
if (serverTrustValidation === "custom" && !serverTrustValidationRationale) {
  requireRationale("serverTrustValidationRationale");
}
```

## 6. Deriving an Effective Value, Not Implicit Mutation

v1 proposed silently defaulting an unset field to `"none"` during threat generation. This
is inconsistent with TARAflow's own conventions elsewhere (e.g. `exposureLevelSource`,
`accessModelSource`), which distinguish an analyst-confirmed value from an
automatically-derived one. Revised approach:

```typescript
/**
 * Whether a given encryptionInTransit value provides a server trust anchor that
 * serverTrustValidation can even be evaluated against — i.e. whether the question
 * "how strongly is this validated?" has a meaningful answer at all.
 *
 * Deliberately NOT an inline ["tls", "mtls"].includes(...) check: hardcoding the
 * transport list at every call site means every future transport that also
 * authenticates the server via a certificate (QUIC, HTTP/3, DTLS, gRPC-over-QUIC)
 * requires a multi-site find/replace. Centralizing it here means only this function
 * needs updating once those values are added to the encryptionInTransit enum.
 */
function hasCertificateBasedServerAuthentication(
  encryptionInTransit: DataFlowProperties["encryptionInTransit"]
): boolean {
  switch (encryptionInTransit) {
    case "tls":
    case "mtls":
      return true;
    // Future: case "quic": case "dtls": return true;
    default:
      return false;
  }
}

function deriveServerTrustValidation(flow: DataFlowProperties): ServerTrustValidationResult {
  if (flow.serverTrustValidation !== undefined) {
    return { value: flow.serverTrustValidation, source: flow.serverTrustValidationSource ?? "manual" };
  }
  if (hasCertificateBasedServerAuthentication(flow.encryptionInTransit)) {
    return { value: "system_ca", source: "derived" };
  }
  return { value: undefined, source: "derived" };
}
```

This keeps the model honest — `undefined` in the stored data means "not yet assessed",
never "assessed as system_ca". `deriveServerTrustValidation()` computes the effective
value the threat generator should use; whether that computed value gets written back
into the persisted model (with `source: "derived"`) or stays a transient suggestion is a
UI/workflow decision (see §6a), not something this function decides on its own.

## 6a. Why `serverTrustValidationSource` Stays in the Persisted Model

One review comment suggested dropping `serverTrustValidationSource` from the schema
entirely, on the grounds that a value which is "derived and not persisted" doesn't need a
provenance field in the model — the derived/manual distinction could live purely in
`deriveServerTrustValidation()`'s return type instead.

This is not adopted, because it would make `serverTrustValidation` **inconsistent** with
the two existing fields it was explicitly modeled after. `exposureLevelSource` and
`accessModelSource` are themselves persisted fields on `InterfaceProperties` /
`DataStoreProperties` — and `securityControlOwnership`'s own doc comment describes
exactly this workflow: a computed value is surfaced to the analyst, applied via the
DFDNotificationsPanel "Apply" action, and only then written into the model together with
its provenance. The value that ends up stored can absolutely have originated as
`"derived"` — the field is what lets the model later distinguish *"an automated
suggestion was accepted without independent review"* from *"an analyst actively
confirmed this after checking the implementation"*. That distinction has audit value on
its own (e.g. a review sweep filtering for "everything still on an unreviewed derived
value"), independent of whether the value is currently correct.

Removing the field would mean two flows with identical `serverTrustValidation = "system_ca"`
become indistinguishable — one where an analyst checked the code and confirmed it, and one
where nobody has looked yet. That distinction is exactly what the field exists to preserve,
and losing it here would be a step backward relative to how `exposureLevelSource` and
`accessModelSource` already work.

## 7. Worked Example — Nussbaum DataTrack (Flutter App)

Applying this to the reviewed DFD:

| Flow ID | Path | `encryptionInTransit` | `endpointAuthentication`¹ | `serverTrustValidation` (resolved) |
|---|---|---|---|---|
| DF-12 / DF-13 | App → Entra ID / B2C (Authentication) | `tls` | `oauth` | `system_ca` *(derived)* |
| DF-16 / DF-18 | App → mdv-backend (report pull, measurement sync) | `tls` | `oauth` (Bearer via MSAL token) | `system_ca` *(derived)* |

¹ `endpointAuthentication = oauth` here describes how the **client authenticates
itself to the server** (bearer token acquired via an OAuth flow) — it says nothing
about server identity. That is exactly why `serverTrustValidation` needs to exist as
a separate field: without it, "the flow uses OAuth" gives no information about
whether the app validates Entra ID's / mdv-backend's certificate against the system
truststore, a private CA, or a pinned key.

Both flows currently rely on the platform's default CA-truststore validation (confirmed
via code review: no `HttpClient`/`Dio` override, no `SecurityContext` customization, and
the generated OpenAPI client uses the plain `http` package with the app-supplied
`basePath`). With `deriveServerTrustValidation()` from §6, this is now an explicit,
auditable, *derived* model state — `system_ca` on DF-12, DF-13, DF-16, and DF-18 — rather
than an implicit gap only visible via source-code grep. Should the team decide to
implement pinning later, an analyst would set `serverTrustValidation = "pinned_public_key"`
with `serverTrustValidationSource = "manual"` and a rationale, and future derivation
calls would defer to that stored value.

## 8. Changelog (v1 → v2)

| # | v1 | v2 | Reason |
|---|---|---|---|
| 1 | Field name `certificatePinning` | `serverTrustValidation` | Field covered mechanisms broader than pinning (private CA); name now matches the actual concept being modeled |
| 2 | Value `none` | `system_ca` | `none` read as "no validation performed" — misleading, since standard CA-chain validation *is* happening |
| 3 | `pinned_ca` bundled with pinning values | `private_ca` (separated) | Trusting a private root CA is trust-anchor *selection* with full chain validation, not pinning — a different threat-reduction mechanism with a different residual risk profile |
| 4 | "Spoofing ... mitigated" | "Spoofing ... reduced" | Pinning/private-CA reduces but does not eliminate MITM risk; residual vectors (compromised endpoint, malware hooking, TLS CVEs, root/jailbreak bypass, MDM root injection, DNS manipulation + stolen key) now listed explicitly |
| 5 | Cascade rule silently sets `certificatePinning = "none"` when unset | `resolveServerTrustValidation()` computes a *derived* value without persisting it | Matches TARAflow's existing derived/manual separation (`exposureLevelSource`, `accessModelSource`); stored model state stays honest about what has actually been assessed |
| 6 | Enum implicitly scoped to pinning only | Enum framed as trust-validation strength, `custom` explicitly covers DANE/TLSA, TOFU, CT enforcement, TPM-bound trust, etc. | Keeps the model extensible to non-pinning trust mechanisms without further schema churn |

## 9. Open Question — Out of Scope for This Proposal

Reviewer pointed out that `endpointAuthentication` currently mixes authentication and
authorization concepts (e.g. `oauth` is authorization-delegation, not strictly
authentication). This proposal intentionally leaves that pre-existing modeling question
unchanged — see the footnote in §7 for where it surfaced.

## 9a. Naming — `serverTrustValidation` vs. `serverTrustPolicy`

Both names were suggested during review as equally defensible. `serverTrustValidation`
is kept because it matches the naming pattern of its sibling fields —
`encryptionInTransit`, `integrityProtection` — which describe an assessed **state**
("what mechanism is present"), not a prescriptive rule. `...Policy` is already used
elsewhere in TARAflow (`TrustBoundaryProperties.defaultDenyPolicy`) specifically for
*enforcement rules* the boundary applies to traffic — a different naming domain from a
per-flow assessed trust mechanism. Keeping `...Validation` avoids overloading that
naming convention.

## 9b. Changelog (v2 → v3)

| # | v2 | v3 | Reason |
|---|---|---|---|
| 1 | `private_ca`: "instead of (or in addition to) the system store" | "rather than relying solely on the platform trust store" | Removed ambiguity about whether private_ca implies dual-trust or single-trust; now states full PKIX validation still applies, only the anchor differs |
| 2 | `custom` threat reduction implicit | Explicit statement: threat reduction for `custom` is never assumed by default, requires rationale | DANE/TOFU/CT/TPM-bound trust have materially different assurance levels; should not be silently credited as equivalent mitigations |
| 3 | Resolver hardcoded `["tls", "mtls"].includes(...)` at two call sites | Centralized `certificateAuthenticatedTransport()` predicate used by both the resolver and the plausibility check | Avoids multi-site edits when transports with certificate-based server auth (QUIC, DTLS, HTTP/3, gRPC-over-QUIC) are added to `encryptionInTransit` later |
| 4 | Worked example listed `endpointAuthentication = oauth` without comment | Added footnote clarifying this describes client-to-server authentication, not server identity — and flagged the underlying `endpointAuthentication` auth-vs-authorization ambiguity as a separate, pre-existing, out-of-scope question (§9) | OAuth is an authorization-delegation protocol, not strictly authentication; worth flagging without redesigning an unrelated existing field as part of this proposal |
| 5 | No explicit naming rationale for `serverTrustValidation` vs. `serverTrustPolicy` | Added §9a | Both names were raised as valid in review; documenting why `Validation` was kept avoids re-litigating the choice later |

## 10. Changelog (v3 → v4)

| # | v3 | v4 | Reason |
|---|---|---|---|
| 1 | Terminology mixed "trust validation", "trust anchor", "validation strength", "identity validation" | Unified around "server trust validation" as the umbrella term | Consistency, per review |
| 2 | `resolveServerTrustValidation()` | `deriveServerTrustValidation()` | "Resolve" implied disambiguating a reference; the function actually computes an effective/derived value — name now matches the `source: "derived"` vocabulary it returns |
| 3 | `certificateAuthenticatedTransport()` | `hasCertificateBasedServerAuthentication()` | Reframed from "is this TLS?" to "does this transport even provide a server trust anchor to evaluate?" — clearer intent, matches unified terminology |
| 4 | §9 (OAuth open question) ran ~1 page | Reduced to two sentences | Reviewer correctly noted it was starting to read like a second design paper; the point only needs stating, not re-arguing |
| 5 | Threat-implication text used ALL CAPS (`ACTIVE`, `REDUCED`, `NEVER`) | Sentence case throughout | Reads calmer, less like a warning label |
| 6 | — | §6a added | One review suggestion — dropping `serverTrustValidationSource` from the persisted model — was considered and **rejected**: it would make the field inconsistent with the existing `exposureLevelSource`/`accessModelSource` pattern it was explicitly modeled after, and would lose the "accepted-but-unreviewed vs. analyst-confirmed" distinction those fields exist to preserve |

## 11. Summary

- Server trust validation strength is a **DataFlow-level** property — placement is
  unchanged from v1 and was independently confirmed as correct.
- It is **orthogonal** to `encryptionInTransit`, `endpointAuthentication`, and
  `integrityProtection`.
- The concept is broader than certificate pinning; pinning is one of several trust-anchor
  mechanisms the field can represent (`pinned_certificate`, `pinned_public_key`), alongside
  trust-anchor *selection* (`private_ca`) and the default baseline (`system_ca`).
- Threat-generation language distinguishes *reduced* from *eliminated*, with residual
  attack vectors documented per value.
- Effective-value derivation follows TARAflow's existing derived/manual provenance
  pattern (`exposureLevelSource`, `accessModelSource`) rather than silently mutating
  stored model state.
