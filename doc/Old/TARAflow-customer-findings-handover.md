# TARAflow — Customer Findings Handover

**Status:** open findings from a live customer deployment, not yet implemented
**Purpose:** hand these to a fresh working session with enough context to act on
them without the originating conversation.
**Context:** TARAflow is in production use at a customer. The findings below were
reported from real project work. Two are *correctness* problems (wrong/missing
analysis output) and rank highest; the rest are quality/UX/feature gaps.

> Triage principle used throughout: distinguish **silently wrong** (user trusts a
> wrong result) from **visibly wrong/annoying** (user can see the problem).
> Silent-correctness issues outrank everything else, because a TARA that hides
> findings is worse than one that is merely inconvenient.

---

## Priority ordering (agreed)

1. **Sync cluster** (structural DFD ↔ threat sync) — *silently wrong, urgent*
2. **Threat generation quality** (generic, not embedded-specific) — *core value*
3. **Asset-ID missing in protection goals** — *small, likely refactor fallout*
4. **Risk assessment rationale field** — *customer-requested feature, additive*
5. **Risk config dialog width** (weight column clipped) — *UX blocker, small*
6. **Threat dialog scroll/jump on selection** — *cosmetic*

Deferred (separate, already documented): **threat catalog divergence** (tool
updates changing threats for unchanged models) — see
`TARAflow-threat-catalog-divergence.md`. This is a *latent* problem (triggers on
tool update), distinct from the *active* structural sync bug below.

Also deferred: **Asset-Store SSoT refactor** — paused in favour of the customer
findings. HazardItems completion and Sensor/Actuator completion remain partially
done but stable; lowest urgency.

---

## Finding 1 — Sync cluster (structural DFD ↔ threat sync)  ⚠ HIGHEST

"Sync nicht gut" is the customer's umbrella term. It decomposes into four
symptoms that are very likely **one root cause**, not four bugs. Treat as a
single fix with four acceptance criteria.

**Symptoms:**
- New elements added to the DFD → no new threats generated for them.
- Element property change → not reflected in the Threat tab.
- Renumbering (DisplayID reassignment) → not picked up in the Threat tab.
- General "sync between DFD and threats is poor".

**Leading hypothesis — identity coupled to DisplayID:**
Threat identity is built from the DisplayID:
- per-element:     `{elementId}-{stride}-{seq}`  (e.g. `P-1-S-1`)
- interface:       `{TB}-IF-{ifaceId}-{stride}-{seq}`
- per-interaction: `{TB}-{DF/IF}-{stride}-{direction}-{seq}`

If the customer renumbers elements, the DisplayID changes → the derived identity
of *all* that element's threats changes → a sync keyed on identity equality sees
"all old threats gone, all new threats appeared". This single mechanism could
explain renumbering-not-applied **and** new-threats-missing **and**
general-drift simultaneously.

**Relevant code (verified):**
- `src/features/threats/services/per-element/element-sync.ts`
  (`checkSyncStatus`, `synchronizeThreats`)
- `src/features/threats/services/per-interaction/interaction-sync.ts`
- `src/features/threats/models/per-element-types.ts` /
  `per-interaction-types.ts` (id build/parse — `parseInt(match[…])`)
- Generators: `element-generator.ts`, `interaction-generator.ts`

**Known facts about identity (verified earlier):**
- `sequenceNumber` is **hardcoded `1`** in both generators
  (`createThreatForElement`; both id calls in interaction generator). The model
  is *one threat per `(element/edge, strideCategory[, direction])`*. So `seq`
  distinguishes nothing — identity is deterministic and position-independent.
- The structural sync already has the right *shape*: `ThreatSyncStatus` carries
  `missingInThreats` (new), `orphanedThreats` (removed), `changedReferences`
  (reference drift), `trustBoundaryChanges`. Manual threats are protected
  (`source === "manual"` is skipped). Orphan deletion is gated behind
  `options.removeOrphaned`.
- ⚠ Granularity gap: `missingInThreats.elements` only fires for elements with
  **zero** threats. A new threat for an already-threatened element is invisible
  structurally — relevant if a property change should *add* a threat category to
  an element that already has others.

**Diagnosis path (do this BEFORE writing code):**
1. Obtain the customer project file (or a model reproducing the symptoms).
2. Reproduce each symptom against `checkSyncStatus` individually:
   - Add an element → does it surface as `missingInThreats`?
   - Change a property → does it surface (and where)?
   - Renumber an element → is the threat treated as "same element, new number"
     or "old gone / new appeared"? **This single experiment decides the fix
     depth.**
3. If the root is DisplayID coupling: change identity to bind to the **stable
   internal `element.id`** rather than the DisplayID. This survives renumbering.
   Note: this touches the identity scheme → implies persisted-id migration
   (cf. `migration-service`, `schemaVersion`). Deliberate, not a local patch.

**Important architectural note:** fixing identity to use `element.id` also hardens
the foundation the *catalog* divergence work (separate doc) sits on. A
well-chosen structural fix feeds the later feature rather than duplicating it.

**Acceptance criteria (one slice, four checks):**
- New element → new threats generated and surfaced.
- Property change → reflected in threat set.
- Renumber → threats follow the element, references intact.
- Each as a golden test from the reproduction model.

---

## Finding 2 — Threat generation too generic (both methods)

Threat generation for both STRIDE methods (per-element and per-interaction) is
**generic, not embedded/OT-specific**. This undercuts TARAflow's core
differentiator versus generic STRIDE tools — embedded/OT specificity is the
reason the customer uses it.

**Classification:** quality, not correctness (the user *sees* the generic
threats). Important but second to Finding 1, because visible-poor beats
silent-missing.

**Where to look:**
- `element-generator.ts` / `interaction-generator.ts` (generation entry points)
- `stride-modifier.ts` (property → STRIDE modulation; consumed by the sole
  `UnifiedStrategy`). This is where element/dataflow properties escalate/add/
  skip STRIDE categories. Embedded specificity largely lives or dies here and in
  the threat catalog templates.
- Threat catalog templates (i18n namespace catalogs under
  `i18n/locales/*/threats/per-element|per-interaction/embedded/…`).

**Direction (to be scoped with the customer's examples):** collect concrete
cases where the output was generic, trace whether the gap is (a) missing
catalog templates for embedded contexts, (b) missing/weak modifier rules that
should escalate embedded-specific categories, or (c) strategy not selecting
embedded templates. Do this evidence-first — get the customer's "this threat is
too generic" examples before changing generation logic.

---

## Finding 3 — Asset-ID not generated into protection goals (Asset tab)

The asset ID is not written into the protection-goal entries in the Asset tab.

**Classification:** localized data bug. **Suspected refactor fallout** — the
Asset-Store SSoT refactor recently touched this layer; this may be a regression
remnant. Worth looking at early precisely because it is small *and* it reveals
whether the refactor is bleeding elsewhere.

**Where to look:** asset protection-goal generation / the CIANAAA protection
goal derivation, and the asset-creation primitive
(`shared/services/asset-creation.ts`) plus the DFD→asset mapper
(`features/assets/services/dfd-to-asset-mapper.ts`). Check where protection-goal
records are built and whether the asset ID is populated at creation.

---

## Finding 4 — Risk assessment rationale field (customer-requested)

The customer wants a field to record *why* likelihood and impact were chosen,
for later traceability — mirrors the rationale column in their safety-analysis
Excel. Regulatorily this fills a real audit gap (ISO 21434 / IEC 62443 both
require traceable risk rationale).

**Design decided (analysis complete — ready to implement):**
- **Two free-text fields**, not a separate Notes tab, not per-L/I, not ADR yet.
  Rationale: the dialog has **no explicit L/I inputs** — L and I are *computed*
  from factors (likelihood factors + impact factors). So "why L=4" doesn't fit
  the model; a single rationale per assessment block does. This matches the
  customer's own safety-Excel pattern (one rationale column) and the existing
  `Bewertung → Begründung` pattern in the tool (`treatmentJustification`,
  `wontJustification`).
- `riskBeforeRationale: string` → **Tab 1 (Risk Before)**, under `RiskScorePanel`.
- `riskAfterRationale: string` → **Tab 3 (Risk After)**, under `RiskScorePanel`.
- Required string defaulting to `""` (consistent with the existing two
  justification fields). NOT optional.
- Risk table: add a **named** "Assessment Rationale" column (the
  before-rationale), truncated 80–120 chars + tooltip/detail. Not an unnamed
  trailing column.

**Semantic disambiguation (label carefully):** the existing
`treatmentJustification` (Tab 2, "why this treatment") and `wontJustification`
(Tab 2, "why accept / won't") are a *different axis* (decision rationale) from
the new fields (score rationale). They sit in different tabs; keep labels
distinct so `riskAfterRationale` and `wontJustification` don't blur for accepted
risks.

**Implementation footprint (verified against code):**
- `models/risk-assessment-types.ts`:
  - add both fields to the `Risk` interface after `wontJustification`
  - init both to `""` in `createEmptyRisk`
  - backfill both in `migrateRiskData` — **both branches** (`?? ""`), else old
    customer projects load them as `undefined` despite the `string` type →
    controlled/uncontrolled React warning + possible lost input
- `components/risk-dialog.tsx` — the dialog uses a `local` working-copy mirror
  with explicit per-field copy-in/out. **Five touch points**, easy to miss one:
  - `local` interface (~line 145)
  - copy-in (~line 163, `?? ""`)
  - copy-out at **both** ~line 375 and ~line 522 (two save paths)
  - two `TextField`s under `RiskScorePanel` (Tab 1 ~line 1257, Tab 3 ~line 1874)
- risk table component (not yet inspected): the rationale column
- i18n: four label keys DE/EN

**Sync survival (verified — safe):** `syncRisksFromThreats`
(`risk-sync-service.ts`, kept-risk merge ~line 480) is a clean
`{...risk, <threat-derived fields only>}`. It overwrites only threat-sourced
fields (descriptions, proposed mitigations/verifications, relevance, calculated
scores). Everything else — including `treatmentJustification`, `wontJustification`,
mitigations, and the new rationales — survives via the spread. The new fields
are pure analyst data (never threat-sourced), so they land on the preserved side
by construction. Code even states `mitigatedFactorRatings not touched — analyst
owns Risk After values`, the same principle.

**Golden test (required):** set both rationales, run `syncRisksFromThreats` with
a **changed** threat (must mutate e.g. `threatDescription`, otherwise the merge
short-circuits with `return risk` and proves nothing) → assert both rationales
unchanged. This pins the protection if someone later extends the overwrite list.

**Optional follow-up (separate mini-slice):** add a non-blocking *warning* in
`riskService.validate` — "N risk(s) without assessment rationale" — analogous to
the existing "not rated" warning. Makes empty rationale visible in audit without
making existing projects fail. Do NOT make it a hard error.

**Deferred V2 (do not build now):** model is intentionally shaped so the two
fields can later split into `beforeLikelihoodRationale` / `beforeImpactRationale`
/ after-variants, or grow into an ADR-like structure (context / chosen value /
alternative considered / reason) — without migration trauma. Only pursue if
users ask for finer granularity.

---

## Finding 5 — Risk config dialog too narrow (weight column clipped)

In the **risk configuration dialog**, the factor list on the right side clips
the **weight** control: for factors at the far right, the weight setting is not
visible and therefore cannot be adjusted.

**Classification:** UX blocker (a configuration control is unreachable), small
fix. Higher practical urgency than it looks — if the analyst cannot set factor
weights, the whole weighted L/I calculation can't be tuned.

**Where to look:** the risk configuration dialog component (the editor for
`RiskConfiguration.activeFactors` — each `ActiveFactor` has `enabled` + `weight`).
Likely a fixed dialog width / column layout where the weight column overflows.
Check the factor-row layout and the dialog's max-width / responsive sizing.

**Acceptance:** weight control visible and editable for *every* active factor,
including the rightmost, at typical window sizes. Verify with the full factor set
enabled (the default config enables ~5; the customer may have enabled many more,
which is likely what exposed the overflow).

---

## Finding 6 — Threat dialog does not scroll to selected threat

Selecting a threat in the threat table opens the dialog but does not jump/scroll
to the correct threat/position inside the dialog.

**Classification:** pure UX/navigation. Data is correct; only the in-dialog
focus/scroll is wrong. Lowest urgency — nothing is wrong, just inconvenient.

**Where to look:** the threat dialog open/select handler and the list-to-detail
focus logic. Likely a missing scroll-into-view / selected-index sync when the
dialog mounts or when the selection changes.

---

## Suggested working order for the receiving session

1. **Finding 1** first, diagnosis-before-code: reproduce on the customer file,
   settle the DisplayID-vs-internal-id identity question, then fix as one slice
   with four golden tests. This is the only *actively wrong* item.
2. **Finding 5** (config width) and **Finding 3** (asset-ID) are small and
   independent — good quick wins to interleave; Finding 3 also tells you whether
   the asset refactor is bleeding.
3. **Finding 4** (rationale) — design is done, additive, sync-safe; implement
   when convenient (does not depend on Finding 1).
4. **Finding 2** (generic threats) — evidence-first; gather customer examples
   before changing generation logic.
5. **Finding 6** (scroll) — cosmetic, last.

Each item is an independently committable, test-backed slice. Keep the
established workflow: surgical `str_replace` patches, conventional commits in
English, TDD with Vitest, one concern per commit.
