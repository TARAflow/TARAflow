# TARAflow — Threat Catalog Divergence: Findings & Remediation Plan

**Status:** Phase A in progress (0.20): stamp, version, guard test and audit diff done
(0.20 patch 02, 2026-11-20); banner, phase tooltip and report in patch 03. Phases B–D
open. See §8 for what changed since the analysis.
**Scope:** `src/features/threats/services/{per-element,per-interaction}/*`, `threat-types`, `ThreatSyncBanner`, `audit`
**Related work:** debug-interface fix (`stride-modifier.ts` `!== true`), ChipBoundary connectivity fix (`connection-validator.ts`) — both committed
**Author context:** raised by the question "what happens when users run TARAflow on a real project across tool updates?"

---

## 1. Problem statement

Once users keep a TARA project open across TARAflow releases, the stored threat
set can diverge from what the *current* tool would generate. The trigger is not
the user editing their model — it is a **tool/catalog update** changing
generation logic while the model stays untouched.

Concrete instance: the debug-interface fix. A project saved under `0.3.1` has a
ChipBoundary with `debugInterfacePresent: "jtag"`, `debugInterfaceLocked:
undefined`. Under `0.3.1` (the `=== false` bug) no debug escalation was
produced. Under `0.3.2` (the `!== true` fix) the `E`/`I` escalation *would* be
produced. The user opens the unchanged project with the new tool — and nothing
flags the shift in threat posture.

---

## 2. What already exists (and is good)

The sync layer is a mature, non-destructive diff-merge — not a bare
notification. Verified in `element-sync.ts` / `interaction-sync.ts`:

- **Four-category diff** in `ThreatSyncStatus`: `missingInThreats` (new),
  `orphanedThreats` (removed/orphaned), `changedReferences` (reference drift),
  `trustBoundaryChanges`. Surfaced via `ThreatSyncBanner`.
- **Stable threat identity** via `generateThreatIdPerElement` /
  `…ForInterface` / `…PerInteraction`:
  - per-element:      `{elementId}-{stride}-{seq}`
  - interface:        `{TB}-IF-{ifaceId}-{stride}-{seq}`
  - per-interaction:  `{TB}-{DF/IF}-{stride}-{direction}-{seq}`
- **Curated layer protected:** `if (threat.source === "manual") continue;` —
  manual threats survive sync. Orphan removal gated behind
  `options.removeOrphaned`, not blind.

This correctly handles **structural divergence** (graph ≠ threats): add/remove/
re-link as the model is edited, with a reviewable banner.

---

## 3. Core findings

### F1 — Sync detects structural divergence, not semantic divergence
`checkSyncStatus` asks "does every threat still map to a graph element, and does
every element have threats?" It never asks "would today's generator produce a
*different* threat set for this *unchanged* element?" A catalog change with an
unchanged graph reports **"in sync"** — no banner.

### F2 — "Missing" granularity is per-element, not per-threat
`missingInThreats.elements` fires only for elements absent from
`threatenedElements`, i.e. elements with **zero** threats. An element that
already has threats is never "missing", so a newly-applicable threat for an
already-threatened element is invisible even structurally.

### F3 — `sequenceNumber` is hardcoded `1` everywhere
Both generators pass `1` as the sequence number
(`element-generator.ts` `createThreatForElement`; `interaction-generator.ts`
both id calls). The generation model is **one threat per
`(element/edge, strideCategory[, direction])`**. `seq` is not a discriminator —
it is dead weight in the schema. The `.map((strideCategory) => …)` iterates
STRIDE categories; each yields exactly one threat.

Consequence (good): identity is **deterministic and position-independent** — no
phantom-diff failure mode from shifting sequence numbers. `seq` stability is a
non-issue *because `seq` distinguishes nothing*.

### F4 — The real gap is identity that is *too* stable, not unstable
Because there is one threat per category, a catalog update like the JTAG fix
usually does **not** change the *existence* of a threat ID — it changes the
*content* of an existing ID (priority, escalated STRIDE letters, rationale)
while the ID stays identical. Two sub-cases:

- **F4a — category becomes newly applicable** (was eliminated, now isn't):
  `{CB}-E-1` is genuinely new → an ID-set diff *can* catch it.
- **F4b — category already present, only content shifts** (the common case):
  `{CB}-E-1` already existed; the fix only escalates/re-prioritises it → ID is
  identical → an ID-set diff sees **"unchanged"**. This is the silent gap.

### F5 — No catalog/tool version is recorded on the threat set
No version comparison exists in the sync layer
(`grep version|catalogVersion|toolVersion` → empty in both sync files). The
sync is keyed entirely on graph-vs-threats, never catalog-vs-threats. Without a
stored catalog version, F4b is undetectable by construction.

> ⚠ To verify before building: confirm no catalog version is persisted
> *elsewhere* (project `audit` / `schemaVersion` blocks were not exhaustively
> checked). If one exists, Phase A reuses it instead of adding a new field.

### F6 — Compliance angle
For CRA / IEC 62443, a silent catalog change altering the threat set without an
audit trail is a defensibility problem. The version stamp (Phase A) doubles as
the audit artifact: "generated under catalog vX, re-evaluated under vY on Z".

---

## 4. Three candidate mechanisms

| Mechanism | Catches | Cost | Verdict |
|---|---|---|---|
| **(A) Catalog version stamp** | F4b (content drift on existing IDs), coarse | Low | **First — only thing that sees the common case** |
| **(B) ID-set diff** | F4a (newly-applicable categories) | Medium | Niche; partially covered by existing structural sync |
| **(C) Content fingerprint per threat** | F4b precisely (which threats changed) | High | Later, only if (A) proves too noisy |

Rationale for ordering: with content-independent identity (F3/F4), an ID diff
(B) *cannot* see the common case (F4b). The version stamp (A) is therefore not
"first of several equals" — it is the only mechanism that observes the dominant
failure mode at acceptable cost. (C) is the precise-but-expensive upgrade,
justified only if (A)'s whole-set flag generates too many false re-evaluations.

---

## 5. Remediation phases

### Phase A — Catalog version stamp + outdated detection  *(first slice)*
**Goal:** after a catalog change, sync can never falsely report "in sync".

1. Define a single `THREAT_CATALOG_VERSION` constant (bump deliberately when
   generation logic changes — e.g. the JTAG fix would have bumped it).
2. Stamp it onto the threat set at generation time, alongside the existing
   `lastModified` (likely `threats.configuration`). Verify against F5 whether a
   field already exists before adding one.
3. Extend `checkSyncStatus`: compare stored vs current version → new
   `ThreatSyncStatus` flag `catalogOutdated` (kept *separate* from the
   structural categories, so the banner can distinguish "model changed" from
   "rules changed").
4. `ThreatSyncBanner` state + i18n (DE/EN) for the catalog-outdated case.
5. The offered action is **non-destructive**: "re-evaluate" regenerates threats
   but preserves the curated layer (Mitigation/Risk/Verification,
   `source === "manual"`) via the *existing* merge path — never a blind replace.
6. Record the stamp + each re-evaluation in the `audit` block (F6).

**Verification (golden test):** project stored under old version + unchanged
graph → status reports `catalogOutdated`, *not* "in sync"; curated fields on a
regenerated threat survive the re-evaluation.

**Non-goals:** does not say *which* threats changed (that is Phase C).

---

### Phase B — ID-set diff for newly-applicable categories  *(optional)*
**Goal:** catch F4a — a STRIDE category that becomes applicable under the new
catalog (previously eliminated by `shouldEliminateThreat`, now not).

1. During sync-check, for each element/edge compute the *generated* identity set
   and compare to the *stored* set.
2. Generated-not-stored → genuinely new threat → additive insert (safe: no
   curation to lose).
3. Stored-not-generated-by-catalog → "orphan-by-catalog" → mark for review,
   **do not** auto-delete (distinct from graph-orphans).
4. Reuse the deterministic ids from F3 — no numbering work needed.

**Prerequisite met:** F3 confirms identity is deterministic, so (B) will not
produce phantom diffs. Lower priority because the structural sync already
covers most add/remove variants and F4a is the rarer case.

---

### Phase C — Content fingerprint per threat  *(later, conditional)*
**Goal:** precisely identify *which* existing threats changed content (F4b),
instead of Phase A's whole-set flag.

1. Persist a per-threat fingerprint hash over the content-bearing inputs:
   `strideCategory + escalated priority + templateId + modifier result`
   (the exact tuple TBD — must capture everything a catalog change can move).
2. Sync-check recomputes and compares fingerprints → per-threat "content drift"
   findings.
3. Only pursue if Phase A's coarse flag proves too noisy in practice
   (re-evaluating whole sets when little actually changed).

**Risk:** fingerprint must be complete (miss an input → silent drift returns)
and stable (over-include → spurious drift). Needs its own golden corpus.

---

### Phase D — Schema hygiene  *(independent, low priority)*
1. `sequenceNumber` is structurally always `1` (F3). Either remove it from the
   identity scheme, or — if multiple threats per `(element, category)` are ever
   wanted — give it real meaning (e.g. bind to `templateId`). Touching the
   identity scheme implies persisted-id migration (cf. `migration-service` +
   `schemaVersion`), so this is a deliberate, separate effort, not folded into
   A/B/C.
2. If the identity scheme is revised, prefer including `templateId` so two
   distinct threats of the same category at one element become representable —
   which would also make Phase C's fingerprint simpler.

---

## 6. Recommended sequence

1. **Phase A** — closes the silent hole, is the audit artifact, low cost.
2. Observe whether A's whole-set flag is precise enough in real use.
3. **Phase B** if newly-applicable-category cases show up and matter.
4. **Phase C** only if A is too noisy.
5. **Phase D** opportunistically, as its own migration-bearing slice.

Each phase is an independently committable, test-backed slice. Phase A is the
only one required to make cross-release usage safe; B/C/D are precision and
hygiene upgrades on top.

---

## 7. Open questions to resolve before Phase A code

*Answered 2026-11-20 (user decisions in brackets) — §8.*

- **OQ1:** Does any catalog/tool version already persist on the threat set or in
  `audit`/`schemaVersion`? (Reuse vs. add — F5.)
- **OQ2:** Where exactly does `THREAT_CATALOG_VERSION` belong —
  `threats.configuration` (whole set) or per-table? Whole-set is simpler and
  matches the coarse semantics of Phase A.
- **OQ3:** What is the bump policy? Manual bump on any generation-logic change is
  simplest and explicit; deriving it automatically is fragile. Recommend manual.
- **OQ4:** Does the non-destructive "re-evaluate" path already exist end-to-end
  in `synchronizeThreats`, or does Phase A need to add a regenerate-but-merge
  variant distinct from the structural sync?

---

## 8. Phase A as built (0.20)

Since this analysis, 0.19 added the **generation drift** (`threat-generation-drift.ts`:
stored generated threats the rules no longer produce, threats they would add — keys only)
and the **regeneration with preview** (`threat-reconciliation.ts`, leveled DFD 6e: new /
unchanged / changed / obsolete, analyst data kept, changed threats flagged for review).
Both cover F4a. F4b — same key, other content — stays invisible to them; the stamp closes
it.

- **OQ1:** nothing persisted. The risk side has `CalcStamp` (`shared/models/calc-stamp.ts`,
  `RISK_CALC_VERSION`, bumped by hand, golden-guarded) — the stamp follows that pattern.
- **OQ2:** `ThreatData.catalogStamp`, **per STRIDE method** (`{ "per-element"?: n,
  "per-interaction"?: n }`) — each method is generated on its own, so a whole-set stamp
  would claim a regeneration the other method never had. Type and the default rule in
  `shared/models/threat-catalog-stamp.ts` (the audit diff reads it), version and stamping
  in `features/threats/services/threat-catalog-version.ts`. Optional, never written as a
  default, written by no migration; not in a component snapshot (only the tables cross) —
  so it leaves the snapshot hash alone (roadmap rule 5, test in `snapshot-builder.test.ts`).
- **OQ3:** manual bump of `THREAT_CATALOG_VERSION` (1 = the catalogue of 0.19). The guard
  test `threat-catalog-version.golden.test.ts` hashes a fresh generation of four fixtures
  (both methods, normalised like the results dump) and fails until the version is bumped
  and the hashes are updated.
- **OQ4:** the non-destructive path exists — the regeneration with preview. The stamp is
  written by a **full (re)generation** of a method only (the hooks' `generateThreats`), not
  by the incremental DFD sync, not on load, not by resolving a drift; every other update
  carries the stored stamp.
- **Absent stamp** (files before 0.20) counts as version 1 (user 2026-11-20): 0.20 does not
  change the catalogue, so updating to 0.20 shows no banner; from the first bump on, such
  files are outdated.
- **Audit (F6):** the DiffService lists a changed stamp ("Threat catalogue (per-element):
  v1 → v2") — a regeneration that changes no threat is still a listed change, not an
  "unlisted" one.
- **Results dump:** the header names `threatCatalogVersion`.
- **Patch 03:** outdated stamp → own line in the drift banner of the Threats tab (action:
  the regeneration with preview) and in the phase tooltip; the report's methodology names
  the catalogue version.

