# Server Trust Validation — Review Addendum to v4

> Scope: this is **not** a v5. It specifies the three points left open in the v4
> review so they can be decided before any schema is touched:
> **(A)** driver-change reset, **(B)** the threat-generator hook, **(C)** schema
> versioning / migration. (A) and (C) are settled below. (B) has one fork that is
> only decidable against the actual generator — the addendum lays out both branches
> and the single check that resolves it.

---

## A. Driver-Change Reset — `serverTrustValidation` depends on `encryptionInTransit`

The v4 §5 plausibility rule only *flags* the invalid state
(`serverTrustValidation` set on a non-certificate transport). That is necessary but
not sufficient: it puts the model into an inconsistent state and relies on the
analyst noticing the flag. `serverTrustValidation` is a **dependent field** of the
driver `encryptionInTransit`, so it belongs to the same class as
`technology`↔`processSemantic`, `protocol`↔`location`, `evaluationMethod`↔DSL-format:
**the dependent field is actively reset on driver change, not merely validated
afterwards.**

### A.1 Forward reset (cert → non-cert)

When `encryptionInTransit` changes to a value for which
`hasCertificateBasedServerAuthentication()` returns `false`, all three trust fields
are cleared in the same property-change handler that already owns the DataFlow edit:

```typescript
// inside the DataFlow encryptionInTransit change handler
function onEncryptionInTransitChange(
  flow: DataFlowProperties,
  next: DataFlowProperties["encryptionInTransit"],
): DataFlowProperties {
  const updated = { ...flow, encryptionInTransit: next };

  // Driver change invalidates the dependent trust fields — reset, don't just flag.
  if (
    !hasCertificateBasedServerAuthentication(next) &&
    flow.serverTrustValidation !== undefined
  ) {
    const cleared = flow; // capture for the notification below
    updated.serverTrustValidation = undefined;
    updated.serverTrustValidationSource = undefined;
    updated.serverTrustValidationRationale = undefined;
    notifyTrustValidationCleared(cleared); // see A.3
  }
  return updated;
}
```

### A.2 The `manual` case is the reason this needs a notification, not a silent drop

A `derived` value carries no analyst work — clearing it is free. A `manual` value
(`serverTrustValidationSource = "manual"`, e.g. an analyst who reviewed the code and
set `pinned_public_key` with a rationale) represents real assessment work. On the
transport becoming non-certificate the field is genuinely *meaningless*, so the reset
is still correct — but silently discarding a manual annotation is the kind of loss
the whole derived/manual split exists to prevent.

Resolution: reset in both cases, but when the cleared value was `manual`, surface it
through the **same DFDNotificationsPanel mechanism** already used for
`securityControlOwnership` — "trust-validation annotation on DF-x was cleared because
the transport changed to `<none>`; re-apply if intended." This keeps the reset
consistent with the bug-class fix *and* keeps the model honest about what was lost.

### A.3 Reverse direction (non-cert → cert) needs no reset

Going `none → tls` leaves `serverTrustValidation` at `undefined`;
`deriveServerTrustValidation()` then yields `{ value: "system_ca", source: "derived" }`
on the next evaluation. No handler action required — the derive path already covers
it. Stated only so the handler is not made symmetric by reflex (an over-eager reverse
reset would clobber a legitimately pre-set manual value on a transport *upgrade*).

### A.4 Keep §5 as a safety net, not the primary fix

The §5 flag still earns its place: it catches invalid states that arrive **bypassing
the handler** — file import of a hand-edited `.tara.json`, a migration, or any
programmatic mutation. Primary fix = active reset in the handler (A.1); §5 = backstop
for states that never went through it.

### A.5 Interaction with persistence of derived values (forward reference to B)

If the team decides derived values are **written back** into the model
(`source: "derived"` persisted, per v4 §6a's open UI/workflow point) rather than kept
transient, then A.1 must fire on *those* too — a persisted derived `system_ca` on a
flow whose transport later drops to `none` is exactly the stale-dependent state this
section removes. If derived values stay transient (recomputed every analysis, never
stored), only `manual` values can ever be stale, and A.1 simplifies to "reset the
manual value + notify." **This is one decision, not two** — resolve the §6a
persistence question and A falls out of it.

---

## B. The Threat-Generator Hook — the make-or-break, and the one check that resolves it

v4 describes a *threat implication* per enum value in prose (§4 doc-comment) but never
shows where in the generator that implication is realized. Until that wiring exists,
the field is documentation, not a model field: it must change a threat's **presence,
feasibility, or mitigation status** to earn its schema slot.

There are exactly two ways it can hook in. Which one is correct depends on a single
fact about the current generator.

### The check that decides the fork

> **Does the STRIDE generator already emit a Spoofing/MITM threat for a DataFlow whose
> `encryptionInTransit = "tls"` today, independent of any trust-validation field?**

Grep the flow/interaction STRIDE generator for where the `S` category is emitted for a
`DataFlow`, and check a plain-TLS flow's generated threats in a scratch project.

- **Yes, a rogue-CA / MITM Spoofing threat is already there** → **Fork A (Modulator)**.
- **No** — TLS flows currently produce no such threat → **Fork B (Emitter)**.

I expect **A** (STRIDE-from-properties on a networked, asset-touching flow almost
always yields Spoofing), but I can't confirm it without the generator, and the wiring
differs materially between the two, so this must be checked, not assumed.

### Fork A — Modulator (expected, recommended if the check is "yes")

`serverTrustValidation` creates and deletes **nothing**. It modulates the existing
Spoofing-via-rogue-CA threat's **feasibility** and attaches a mitigation reference when
pinning/private-CA is in effect. The hook lives in whatever function computes the
feasibility factors (and/or attaches proposed mitigations) for the `S` category on a
`DataFlow` — call it `applyTrustValidationToSpoofing(threat, effective)` where
`effective = deriveServerTrustValidation(flow)`:

| `serverTrustValidation` | Threat presence | Feasibility effect | Mitigation attached |
|---|---|---|---|
| `system_ca` | present | baseline (no reduction) | none |
| `private_ca` | present | reduced — attacker must compromise the *specific* private trust anchor, not any public CA | trust-anchor-selection note |
| `pinned_certificate` / `pinned_public_key` | present | further reduced — **not eliminated** (residual vectors per v4 §4: rooted/jailbroken bypass, hooking, MDM-injected root, supply-chain, TLS-lib CVE) | pinning mitigation ref |
| `custom` | present | **no reduction credited** unless `serverTrustValidationRationale` is set (v4 §5) | only if rationale justifies it |

Feasibility must be expressed **through the existing feasibility model** (ISO
attack-potential factors / `FEASIBILITY_RANK`), not a bespoke number. Concretely, the
reduction is a *raised required attack potential*, and the factors it raises are
specific — which is what makes this defensible rather than a hand-wavy "−1 band":

| Value | AP factors raised (proposed, for analyst review) |
|---|---|
| `private_ca` | Knowledge of the target (which private CA), Window of opportunity |
| `pinned_*` | Equipment + Expertise (rooted device + hooking framework to defeat the pin), Elapsed time |

Treat that mapping as the **analyst-facing catalogue entry** for review, not hard law
— the point is that each value maps to concrete AP factors, so the register can defend
*why* a pinned flow scores lower, and a reviewer can disagree per factor.

### Fork B — Emitter (only if the check is "no")

If TLS flows currently emit no rogue-CA threat, then `serverTrustValidation` **gates
emission** of it: `deriveServerTrustValidation() → system_ca` means "emit the rogue-CA
MITM Spoofing threat"; `pinned_*` means "emit it pre-mitigated / at reduced
feasibility." Functionally similar table to Fork A, but the field now owns threat
*creation*, which is a heavier responsibility (a wrong-defaulted or stale derived value
now adds or removes a whole threat, not just shifts a number). This is the branch where
A.5's persistence decision matters most — a persisted-but-stale derived value could
silently suppress a real threat.

### B.1 Derived-unreviewed input to a risk number (ties to your audit philosophy)

Either fork has the same subtlety: when `effective.source === "derived"`, an
**unreviewed** assumption is driving a threat's feasibility (A) or existence (B). That
is precisely the "accepted-but-unreviewed vs. analyst-confirmed" distinction v4 §6a
keeps the source field for — but here it propagates into the *risk register*, not just
the flow. Recommendation: the generated threat/risk should carry a marker that its
trust-validation input was `derived`, so a review sweep can query "risks whose
feasibility rests on an unreviewed server-trust assumption." That is the same shape as
your audit-tab review sweeps ("everything still on an unreviewed derived value") and is
cheap if you thread `effective.source` through to the emitted reference rather than
dropping it after the feasibility calc.

### B.2 What I need from you to finalize B

Just the answer to the check above (plus the generator function name where `S` is
emitted for a `DataFlow`). With that, Fork A or B collapses to a concrete patch site
and the table above becomes real code.

---

## C. Schema Versioning — additive optional fields, and why a migration would be *wrong*

Adding `serverTrustValidation`, `serverTrustValidationSource`, and
`serverTrustValidationRationale` as **optional** fields on `DataFlowProperties` is
purely additive and backward-compatible: existing `.tara.json` files parse unchanged
(all three read as `undefined`, which is the correct "not yet assessed" state).

**No `migrate_4_to_5.ts` — and this is not just "not needed", it would be
incorrect.** A migration has exactly two honest jobs: transform an existing field, or
backfill a default. There is no prior field to transform, and the only default a
migration could backfill is `system_ca` — which is **the silent mutation v4 §6
explicitly forbids**. Backfilling `system_ca` would make `undefined` (not assessed)
indistinguishable from an actual assessment, destroying the exact honesty property the
derive-don't-mutate design is built on. So the migration is not merely skippable; a
migration that "helpfully" filled the field would reintroduce the v1 mistake at the
persistence layer.

Consequence for the schema-version stamp: this stays **schema v4** (optional additive
fields), no version bump, no migration step. If your `prepareForDisk` writes a
`schemaVersion` that you bump on any shape change as a matter of discipline, that is a
policy call — but the migration *table* gets no new entry, because there is nothing to
migrate. Document the addition in the field changelog (v4 §10 style), not the schema
migration chain.

---

## Summary of decisions

- **A — settled.** Active reset of the three trust fields in the
  `encryptionInTransit` change handler on cert→non-cert; notify (don't silently drop)
  when the cleared value was `manual`; keep §5 as an import/migration backstop; the
  reverse direction needs no reset. The §6a persistence question is the single input
  that fixes whether derived values can also go stale (A.5).
- **B — one check outstanding.** Fork A (modulator) vs. Fork B (emitter) is decided by
  whether the generator already emits a Spoofing/MITM threat for a TLS flow. Expected:
  A. Both branches thread `effective.source` into the emitted reference so derived-
  unreviewed trust assumptions are queryable in a review sweep (B.1).
- **C — settled.** Additive optional fields, stays schema v4, **no migration** — a
  backfill migration would violate v4 §6's no-silent-mutation principle.
