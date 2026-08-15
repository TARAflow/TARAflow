# TARAflow — Risk Assessment Rationale: Implementation Plan

**Status:** design complete, ready to implement
**Feature:** customer-requested traceability for *why* likelihood/impact were
chosen — explicitly including the **residual** (after-mitigation) values.
**Decision:** two fields, `riskBeforeRationale` + `riskAfterRationale`. The
customer's stated need is the **after** case ("why I adjusted L and I after
mitigation"); the **before** field is added for symmetry so both assessment
points can be documented.

> Why two, not one: the dialog has two assessment points (Risk Before tab and
> Risk After tab). The customer asked about the residual adjustment → that is
> `riskAfterRationale` (the required part). `riskBeforeRationale` is the
> symmetric companion. Not per-L/I (L and I are computed from factors, not
> entered directly), not a Notes tab, not ADR — those are deferred V2.

---

## Verified facts the plan relies on

- **Sync is safe.** `syncRisksFromThreats` (`risk-sync-service.ts`, kept-risk
  merge ~line 480) is `{...risk, <threat-derived fields only>}`. Analyst fields
  (`treatmentJustification`, `wontJustification`, mitigations, …) survive via
  the spread. New rationale fields are pure analyst data → survive by the same
  mechanism. No extra protection needed; a golden test pins it.
- **Existing pattern to mirror in the model:** `treatmentJustification` and
  `wontJustification` are both `string` (required, default `""`).
- **Existing pattern to mirror in the table:** the `justification` column in
  `risk-columns.tsx` (~line 690) already does text + `Tooltip` + truncation +
  a visible *missing* state (red, italic, "Missing justification!"). The
  rationale column copies this pattern.
- **Dialog uses a `local` working-copy mirror** with explicit per-field
  copy-in/out → multiple touch points, easy to miss one.
- **Table column model:** `RiskColumn { id, header, width?, flex?, minWidth?,
  renderCell, stopRowClick?, align? }`. Columns built in `useRiskColumns`
  (`risk-columns.tsx`). Current order: threatId, threatDescription, impact,
  likelihood, riskBefore, mitigation, riskAfter, treatment, moscowPriority,
  implementation, [justification — Won't table only], actions.

---

## Phase 1 — Data model  (`models/risk-assessment-types.ts`)

1. Add to the `Risk` interface, after `wontJustification`:
   ```ts
   /** Rationale for the before-mitigation assessment (why these L/I factors). */
   riskBeforeRationale: string;
   /** Rationale for the residual assessment (why L/I changed after mitigation). */
   riskAfterRationale: string;
   ```
2. `createEmptyRisk`: initialise both to `""`.
3. `migrateRiskData`: backfill in **both** branches of the `risks.map(...)`
   (the no-configuration branch *and* the normal branch):
   ```ts
   riskBeforeRationale: risk.riskBeforeRationale ?? "",
   riskAfterRationale:  risk.riskAfterRationale ?? "",
   ```
   Required: old customer projects predate the fields → without backfill they
   load as `undefined` despite the `string` type → React controlled/uncontrolled
   warning + possible lost input.

**Acceptance:** new risks have both fields = `""`; loading a pre-existing
project yields `""` (not `undefined`) for both.

---

## Phase 2 — Dialog  (`components/risk-dialog.tsx`)

Five touch points (the `local` mirror is the trap — miss one save path and the
text is silently dropped):

1. `local` state interface (~line 145): add both fields.
2. Copy-in from `risk` (~line 163): `riskBeforeRationale: risk.riskBeforeRationale ?? ""`
   and the after equivalent.
3. Copy-out **both** save paths (~line 375 **and** ~line 522): include both
   fields.
4. `TextField` (multiline) under `RiskScorePanel` in **Tab 1 / Risk Before**
   (~line 1257) bound to `riskBeforeRationale`.
5. `TextField` (multiline) under `RiskScorePanel` in **Tab 3 / Risk After**
   (~line 1874) bound to `riskAfterRationale`.

**Labels (disambiguate from Tab-2 justifications):**
- Before: "Assessment Rationale — explain the assumptions and reasoning behind
  the risk assessment."
- After: "Residual Risk Rationale — explain why likelihood/impact changed after
  mitigation."
  (The after label must point at the *values*, not the decision, so it does not
  blur with `treatmentJustification` / `wontJustification` in Tab 2.)

**Acceptance:** typing in either field and saving via *either* save path
persists the text; reopening shows it.

---

## Phase 3 — Table column  (`components/.../risk-columns.tsx`)

Mirror the existing `justification` column. **One visible column, both texts in
the tooltip** — avoids widening an already-busy table.

1. Add an `assessmentRationale` column (placement: after `riskAfter`, or near
   the end before `actions` — pick per visual balance):
   - `flex: 1, minWidth: 160`
   - `renderCell`: show `riskBeforeRationale` truncated (ellipsis, nowrap);
     `Tooltip` title shows **both**: `Assessment: …  /  Residual: …`.
   - Visible empty state copied from `justification`: if *both* are empty, render
     muted/italic placeholder (not error-red — rationale is recommended, not
     mandatory, unlike Won't justification). Distinguish "recommended-missing"
     (muted) from Won't's "required-missing" (error).
2. Decide visibility scope: show in the main risk table (not only the Won't
   table, unlike `justification`).

**Optional refinement (later):** instead of text, a filled/empty icon indicator
("has rationale?") per before/after — makes the audit *gap* scannable without
width cost. Start with the single text column; add icons only if requested.

**Acceptance:** column shows the before-rationale, tooltip shows both, empty
state is visible but not alarming.

---

## Phase 4 — i18n

Add DE/EN keys:
- `tabs.risks.dialog.riskBeforeRationale` (label)
- `tabs.risks.dialog.riskAfterRationale` (label)
- `tabs.risks.columns.assessmentRationale` (column header, e.g. "Rationale")
- `tabs.risks.noRationale` (muted placeholder, e.g. "No rationale recorded")

DE in Swiss style ("ss" not "ß").

---

## Phase 5 — Golden test  (sync survival)

The critical test — pins the protection if someone later extends the sync's
overwrite list.

1. Build a risk with non-empty `riskBeforeRationale` and `riskAfterRationale`.
2. Run `syncRisksFromThreats` with a **changed** threat — must mutate e.g.
   `threatDescription`, otherwise the kept-risk merge short-circuits with
   `return risk` and the test proves nothing (it must exercise the real merge
   branch).
3. Assert both rationales are unchanged after sync.
4. Second case: brand-new threat → new risk via `createEmptyRisk` → both
   rationales = `""` (not `undefined`).

---

## Phase 6 — Optional: validation warning  (separate mini-slice)

In `riskService.validate`, add a **non-blocking warning** (not an error):
"N risk(s) without assessment rationale", analogous to the existing
"not rated" warning. Makes empty rationale visible in audit/report without
failing existing projects. Keep separate from the field slice; do not gate
`isComplete` on it.

---

## Suggested order & scope

- Phases 1–2 + 5 are the **core slice** (model + dialog + sync test) — fully
  specified, depends on nothing external.
- Phase 3 (table) + 4 (i18n) complete the visible feature.
- Phase 6 is an independent follow-up.

Each phase is independently committable. Suggested single commit for 1–4 (one
coherent feature), separate commit for 5 if TDD-first (test red → implement →
green), separate commit for 6.

**Dependencies:** none on the Sync-cluster fix (Finding 1). This slice is
additive and can land independently — but it is *not* urgent (customer-requested
feature, nothing is wrong), so schedule it after the actively-wrong Sync fix.

---

## Commit message (draft, Phases 1–4)

```
feat(risks): add before/after assessment rationale fields

Customers need to record why likelihood/impact were chosen — in particular why
residual L/I were adjusted after mitigation (mirrors the rationale column in
safety-analysis worksheets). Add riskBeforeRationale (Risk Before tab) and
riskAfterRationale (Risk After tab), shown under the respective RiskScorePanel.
Surface the before-rationale as a risk-table column with both texts in the
tooltip and a visible empty state. Fields are analyst-owned and survive
syncRisksFromThreats via the existing kept-risk spread (covered by test).

Migration backfills both to "" for pre-existing projects.
```
