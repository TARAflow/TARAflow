# TARAflow — Asset Impact → Security Goals (CIANAAA) Rework

> **Purpose of this document:** A new chat (or contributor) should know immediately *what* is being reworked, *why*, *how far it is* and *how to continue*. Binding are the **ground rule** (§4), the **invariants** (§4.5) and the **phase plan** (§6) — ask before deviating from them.

**Status:** Design final (rev. 3.1, after three external reviews), implementation Phase 0 delivered, Phase 1 next
**Code baseline:** `c080c48` (v0.11.2-alpha)
**Repo:** `https://github.com/TARAflow/TARAflow` · Stack: Electron + Vite + React + TypeScript, tests with Vitest

---

## 1. Context

TARAflow is an open-source tool (GPL-3.0) for Threat Analysis and Risk Assessment (TARA) under IEC 62443, ISO/SAE 21434, EN 50742 and the CRA. It works on a DFD-anchored property graph:

1. Model the **DFD** (processes, data stores, data flows, trust boundaries)
2. Create **assets** and relate them to DFD elements (e.g. `transports`, `stores`, `controls`)
3. Rate **asset impact**: per asset and criterion (safety, financial, operational, reputation, privacy …) a value on the project scale, or `"na"` (not applicable)
4. **Security goals** per asset following CIANAAA: Confidentiality, Integrity, Availability, Non-repudiation, Authorization, Authentication, Accountability, each with a level `none | low | medium | high | critical`
5. **Threat generation** STRIDE per element / per interaction
6. **Risk assessment** likelihood × impact, then mitigations

An existing architecture decision states: *impact belongs to the security goal / damage scenario, not to the asset as a whole.* The code implements this only partially so far.

## 2. Problem

In the Asset tab, the transition from asset impact to security goals does not feel intuitive. The code analysis shows why.

### 2.1 The translation severity → security goal is invisible

- The asset dialog first asks for impact criteria for the **whole asset**. Then comes a list of 7 "cause mechanisms" ("How could the damage occur?"). CIANAAA itself stays hidden.
- *Which* goals are suggested is derived in `asset-cianaaa-deriver.ts` from asset group × relation type (`BASE_RULES`, `CIANAAA_APPLICABLE`). That is sound.
- *How strong* a goal is follows a hard-wired mapping `CAUSE_MECHANISM_CRITERIA`. Confidentiality, for example, takes its level from regulatory/financial/reputation (MAX). The analyst never sees this mapping. The explanation (`explainSuggestion`) appears only in a tooltip.

Consequence: the analyst enters a severity and sees goal levels appear without being able to follow why.

### 2.2 Impact is under-specified

"Firmware has high safety impact" does not say *through which violation*. Losing its integrity can be fatal, losing its confidentiality harmless. The model knows one impact per criterion per asset, not one per security goal.

### 2.3 Impact is aggregated in two different ways

| Place | Source | Aggregation |
|---|---|---|
| Goal level → "initial impact" badge in the threat table (`getInitialImpact` in `unified-strategy.ts`) | goal level | MAX over the mechanism-relevant criteria |
| Risk impact (`applyAssetCriteriaToFactorRatings`) | asset criteria | worst criterion over all linked assets, **independent of STRIDE/goal** |

A C threat and an A threat on the same asset get the same risk impact. Badge and risk can contradict each other.

### 2.4 Per-goal impact exists in the model, but not in the product

`SecurityGoal.impactRatings` (override per goal) and `resolveImpactRatings(asset, goal)` exist. However:
- there is no UI for it,
- `build-asset-data-reference` does not pass the field on to the risk side,
- it is only called in the documentation generator.

### 2.5 Security goals affect threat generation (side finding)

Active goals filter an element's STRIDE categories in the generator (`CIANAAA_TO_STRIDE`, `UnifiedStrategy.getStrideCategories`). The combination with property modifiers is asymmetric:
- without property modification, only the goal categories apply,
- with modification, the union applies — properties can re-add categories the goals excluded.

Whether e.g. Information Disclosure appears on a data flow thus depends on whether a property modifier happened to fire. Relevant here because goal levels have real effects on the threat list.

## 3. Phase 0 — delivered prerequisites

Delivered as patch files (`git apply`) with separate commit messages:

1. **`fix(assets)`: don't inflate a security goal when its criteria are n/a.** If all criteria relevant to a goal were `"na"`, a fallback took the MAX of *all* criteria. Safety = 4 thus made confidentiality "critical" although the analyst had declared confidentiality damage not applicable. New: `explainLevel()` is the single source for level *and* reason, with the cases `mechanism | not-applicable | fallback | floor`. The floor is "low", because "none" would silently remove the STRIDE category from generation. `computeSuggestedLevel` and `explainSuggestion` use the same function. Tests: `asset-cianaaa-deriver.test.ts` (new; the deriver had none).
2. **`feat(docs)`: security-goal table in the assets chapter.** Per asset × active goal: level, source (derived/manual), basis (relations + driving criterion, or the analyst's rationale), consequence. Manual goals without rationale are flagged. Basis comes from `explainLevel()`. All formats incl. pdfmake via the pure `buildSecurityGoalDocRows()`. Tests: `security-goal-doc-rows.test.ts`.

## 4. Solution approach

**Guiding idea:** the workflow "severity first, then security goals" stays. It matches the consequence-first logic of IEC 62443-3-2 or a BIA. What gets reworked is what is visible between the two steps, and where the impact flows afterwards.

Terminology: security goals do not *prevent* anything. They name which property must hold. The chain is:

> Damage to the customer → which property violation leads there (security goal) → how is it violated (threat) → how do I prevent that (mitigation)

**Ground rule for the whole concept:** *The tool never silently changes an analyst's decision.* If the basis of a decision changes, the decision is flagged, not adjusted.

### 4.1 State model (foundation for 4.2–4.4)

The UI can only be as clear as the states behind it. Today a goal can be in several technically distinct situations that partly look identical in the dialog, e.g. as "Low" or as an empty goal. These states are named explicitly:

| State | Meaning | Recognised by | Display |
|---|---|---|---|
| **Not suggested** | graph gives no reason for this goal | not in `computeSuggestedGoalTypes`, not manual | collapsed under "Add goal" |
| **Suggested, assessed** | goal from graph, level from a relevant criterion | `source = suggested`, `kind = mechanism` | level |
| **Suggested, provisional** | relevant criteria still open, level from MAX of all criteria | `kind = fallback` | level + "provisional" |
| **Suggested, no applicable damage** | all relevant criteria `n/a` | `kind = not-applicable` | "Minimum level – no applicable damage" |
| **Suggested, assessment missing** | asset has no impact at all yet | `kind = floor` | **"Assessment required"**, no level |
| **Manually adjusted** | analyst changed the level | `source = manual`, `level ≠ none` | level + "adjusted" |
| **Manually excluded** | analyst deliberately deactivated a suggested goal | `source = manual`, `level = none`, in suggestion | greyed out + "excluded" |
| **Manual, basis changed** | basis of the manual decision has changed | snapshot ≠ current suggestion | extra marker + reason |

`kind` denotes the result of `explainLevel()` from Phase 0.

**Principle: store decisions, derive states.** Except for "basis changed", all states follow from the existing fields (`level`, `source`, `rationale`) plus `explainLevel()`. A stored status enum is deliberately **not** introduced: derived fields that go stale when a driver changes are a recurring bug class in TARAflow.

**Minimum level:** internally it stays "low" so that threats do not silently vanish from generation. It is never displayed as an ordinary "Low". If the assessment is missing entirely (`floor`), the card primarily shows "Assessment required" and no level at all.

#### Snapshot at manual decision

The only model extension. It records a past fact and is therefore not a redundant derivation:

```ts
interface SecurityGoal {
  // … existing: type, level, source, rationale, consequence, impactRatings
  /** Suggestion at the time of the manual decision. Only for source = "manual". */
  suggestionAtDecision?: {
    suggested: boolean;
    level: CIANAAALevel;
    basis: "mechanism" | "not-applicable" | "fallback" | "floor"; // explainLevel().kind
    driver?: string; // criterionId for mechanism/fallback, see below
  };
}
```

**Basis and driver are stored, no signature** (hash) of the whole derivation:
- A hash over relations, element names etc. would fire on every cosmetic change. The result: false alarms and prompts that get clicked away.
- A hash cannot be explained. "Driver was safety impact, is now financial" can.
- Relations matter only through "suggested yes/no". As long as the goal stays suggested, a changed relation does not affect the level decision.

**Driver** is the first criterion reaching the maximum value, in the order of the asset's criteria. This matches `explainLevel()`, which returns exactly one driver. On a tie the driver is thus *representative*, but deterministic. If it drops out while another criterion holds the value, `basis-changed` is reported — rightly so, because the rationale relied on the criterion that dropped out.

This also covers the case where the level stays the same by chance but the driver changes, e.g. from safety 3 to financial 3. A rationale like "safety overstated because of interlock" no longer fits.

Existing manual goals without a snapshot count as "snapshot unknown" (no marker) and are initialised on the next save of the goal. The field is optional; no schema migration is needed.

#### Reasons for "basis changed"

Not stored, but derived by `goalState()`. The direction determines the severity:

| Reason | Example | Severity |
|---|---|---|
| `suggestion-removed` (adjusted) | integrity was suggested, is no longer (relation deleted) | warning – basis gone |
| `suggestion-removed` (excluded) | excluded goal is no longer suggested | info – exclusion no longer needed |
| `level-raised` | suggestion medium → high; manual is medium | warning – decision possibly too low |
| `basis-changed` | driver safety → financial, or assessment was missing and now exists | warning – rationale may no longer fit |
| `level-lowered` | suggestion high → medium; manual is high | info – manual choice is now more conservative |
| `suggestion-added` | manually added goal is now also suggested by the graph | info – return to suggestion possible |

With `level-lowered`, a deliberately conservative manual choice remains valid. It is only made visible, not treated as a problem.

**UI wording:** not every reason means the decision has become wrong. The marker therefore reads "Review" (warnings) or "New suggestion since last review" / "Suggestion changed" (infos), never a blanket "outdated".

#### `goalState()` as a domain function

Pure function in `features/assets/services`, not a UI helper. Card, asset table, validation and report consume it. No surface assembles its own conditions.

```ts
interface GoalState {
  type: SecurityGoalType;
  visibility: "suggested" | "not-suggested" | "excluded";
  source: "suggested" | "manual" | "legacy";
  assessment: "assessed" | "provisional" | "no-applicable-impact" | "missing";
  level: CIANAAALevel;               // effective level (internal, incl. minimum level)
  displayLevel: CIANAAALevel | null; // null for assessment = "missing"
  levelReason: LevelExplanation;     // from explainLevel()
  suggestionReasons: string[];       // relations ("Config push → transports")
  suggestion: { suggested: boolean; level: CIANAAALevel };
  stale: StaleReason | null;
  rationaleRequired: boolean;
}
```

Which rationale question the UI asks (adjust or exclude) follows from `visibility` and is not a separate field. `goalState()` describes the domain state completely but makes no UI decisions.

Findings are **not** part of `goalState()`. Validation produces them from the state (`goalFindings(state)`). This keeps one place responsible for codes and severities.

### 4.2 Point 3 – security-goal cards

**Step 1 – damage potential (as today).** The analyst rates the criteria for the asset. New is the meaning: this is the **worst plausible case** and thus the upper bound.

**Step 2 – one card per suggested goal**, with progressive disclosure.

*Collapsed (default):*

```
┌ Integrity · HIGH            [Suggested] ┐
│ Driver: Safety Impact = 3               │
│ ▸ Details                               │
└─────────────────────────────────────────┘
```

*Expanded:*

```
┌ Integrity · HIGH            [Suggested] ┐
│ Why this goal?                          │
│   Config push → transports              │
│   Violation: content manipulation       │
│ Why this level?                         │
│   ● Safety Impact        3  inherited ← │
│   ○ Operational          2  inherited   │
│   ○ Financial           n/a inherited   │
│ Consequence: […]                        │
│ [Adjust]  [Exclude]                     │
└─────────────────────────────────────────┘
```

*Manual decision whose basis changed:*

```
┌ Integrity · MEDIUM   [Adjusted][Review] ┐
│ Suggestion went up: high → critical     │
│ Rationale: "Interlock limits …"         │
│ [Keep]  [Accept suggestion]             │
└─────────────────────────────────────────┘
```

- **Two separate explanations.** "Why this goal?" comes from graph and relation (`BASE_RULES`), "Why this level?" from the impact criteria (`CAUSE_MECHANISM_CRITERIA`). The deriver separates this internally already; the card makes it visible.
- **Wording.** The cause mechanism appears as the *violation* of the goal ("Violation: content manipulation"), not as a second concept next to the goal. In the code the 7 mechanisms map 1:1 to the 7 goals. An extra layer would add complexity without model content.
- **Source prominent.** The badge in the card header shows the state from 4.1. Warning states (rationale missing, basis changed, assessment required) are colour-coded and visible even when collapsed.
- **Adjust** makes the goal manual, creates the snapshot and makes the rationale mandatory. The question: *"Why does the suggested level not fit?"*
- **Exclude** is a separate action with its own question: *"Why is this security goal not relevant for this asset?"* The card stays visible, greyed out. Both use the same `rationale` field; question, marker and report category differ by state.
- **Resolving a changed basis.** "Keep" only updates the snapshot (the decision was checked against the new suggestion), optionally with an extended rationale. "Accept suggestion" resets to the suggestion and removes snapshot and rationale.
- **Consequence** is shown in all modes, not only in ISO 21434 mode.

Result: defaults are in place. The analyst reviews cards instead of filling a matrix and intervenes only where the suggestion does not fit.

### 4.3 Point 4 – impact per security goal, passed through to the risk

**UI:** in the expanded part, every criterion value has a visible origin:
- `inherited`: comes from the asset, no own value stored
- `adjusted`: own value for this goal, with the action "Reset to asset value"

When adjusting, the selection is capped at the asset value. The UI explains this instead of silently blocking: *"Maximum 3 – from the asset's damage potential. If this damage is more severe, raise the asset impact first."*

#### Formal definition

For asset *X*, active goal *g* and criterion *c*:

- **Active** means `level ≠ none`. Non-suggested and excluded goals contribute nothing.
- **Effective value:** `eff(X, g, c) = override(g, c)` if present, otherwise `asset(X, c)`. This is `resolveImpactRatings`.
- `null` (not rated) and `n/a` enter no aggregation, as today in `isRated`.
- **Upper bound:** for numeric values `override(g, c) ≤ asset(X, c)`. An override `n/a` is always allowed.
- **Envelope:** the asset value is an **upper bound**, not a computed quantity. If the analyst lowers a criterion in *all* active goals, the asset value stays higher than any goal uses. This is reported as info (`GOAL_ENVELOPE_SLACK`), not corrected. The message is neutral: a deliberately higher worst-case envelope is legitimate.

**Risk impact** for a threat with STRIDE category *s* and linked assets *X₁…Xₙ*:

1. Goals for *s* via `CIANAAA_TO_STRIDE⁻¹` (R → N and Acc).
2. Per criterion *c*: MAX over all active matching goals of all linked assets of `eff(Xᵢ, g, c)`.
3. Impact factors from there as today (`applyAssetCriteriaToFactorRatings`).
4. A linked asset without an active matching goal contributes nothing: the threat violates no security goal there.
5. If no linked asset has an active matching goal: fall back to the asset values (today's behaviour) plus finding `THREAT_WITHOUT_GOAL`.

The badge in the threat table and the goal level (`explainLevel` on the effective values) use the same definition.

#### Asset impact drops below an override

The override stays unchanged; automatic capping would violate the ground rule.

- Finding `GOAL_OVERRIDE_EXCEEDS_ASSET` (error); the card shows *"Adjustment 3 exceeds asset value 2"* with the actions "Reset to asset value" and "Raise asset value".
- **Calculation until resolved:** the override keeps applying. It is the higher value and was set explicitly by the analyst. This is conservative, and the conflict stays visible via the error.

**Data model:** the existing `SecurityGoal.impactRatings` is used. A missing entry means the asset value applies. Existing projects do not change behaviour; no migration is needed.

### 4.4 Overview across all assets

With 50 assets, the review must not require opening every dialog. Existing places are used instead of a new view:

- **Asset table:** the security-goal column shows chips with level and state marker. A filter "Needs review only" shows only assets with warnings or errors.
- **Validation findings** via `validateAssetData` (shown in the asset toolbar), with stable codes.

**Severity rule:** it describes the effect on the reliability of the TARA, not the technical oddity.
- **Error:** the calculation rests on contradictory inputs.
- **Warning:** a required assessment or rationale is missing, or a decision may no longer be valid.
- **Info:** the state is legitimate but worth mentioning in a review.

| Code | Severity | Condition |
|---|---|---|
| `GOAL_OVERRIDE_EXCEEDS_ASSET` | error | goal override > asset value |
| `GOAL_UNASSESSED` | warning | suggested goal, asset without impact (`floor`) |
| `GOAL_RATIONALE_MISSING` | warning | adjusted or excluded without rationale |
| `GOAL_OVERRIDE_STALE` | warning / info | severity from the stale reason (table in 4.1) |
| `GOAL_PROVISIONAL` | info | level from fallback, relevant criteria open |
| `GOAL_NO_APPLICABLE_IMPACT` | info | minimum level, all relevant criteria n/a – may be entirely correct |
| `GOAL_ENVELOPE_SLACK` | info | asset value not used by any active goal |
| `THREAT_WITHOUT_GOAL` *(later)* | warning | threat violates no active goal of a linked asset |
| `GOAL_WITHOUT_THREAT` *(later)* | info | active goal addressed by no threat |

`GOAL_OVERRIDE_STALE` is **one** code. The severity follows from the stale reason (`severityFor(reason)`), the reason is carried as context. No separate codes per reason.

- **Report:** the security-goal table from Phase 0 will show the state from 4.1 in the "Source" column. **New:** excluded goals appear too, with their rationale. Today the table filters out all goals with `level = none`. A deliberate exclusion is an audit-relevant decision and must not be missing from the report.

### 4.5 Invariants and test cases

**Overarching invariant:** automatic derivations may only change automatically derived values. Explicitly stored analyst decisions change only through an explicit user action. This applies beyond security goals to all fields with the derived/manual pattern (e.g. `exposureLevelSource`, `accessModelSource`).

Consequences for this concept:

| | Invariant | Must be tested as |
|---|---|---|
| A | Manual wins over derivation | a deriver run after an impact change leaves the `level` of a manual goal unchanged |
| B | Snapshot is historical | a deviation produces `stale` but never changes the current level |
| C | Exclusion is a decision | an excluded goal appears in card, table and report, with rationale |
| D | Floor is not an ordinary Low | `floor` → `assessment = "missing"`, `displayLevel = null`; no consumer checks `level === "low"` directly |
| E | Conflict is an error, not a mutation | asset 2, override 3 → effective 3, override stays 3, `GOAL_OVERRIDE_EXCEEDS_ASSET` |

**Mandatory test cases for the risk impact (Phase 4):**

| Case | Asset A | Asset B | Expected for an integrity threat |
|---|---|---|---|
| 1 | safety 4, goal I adjusted to 2 | safety 3, goal I inherited | 3 (not 4) |
| 2 | safety 4, goal I adjusted to 2 | safety 3, no active goal I | 2 – B contributes nothing |
| 3 | safety 4, no active goal I | safety 3, no active goal I | fallback 4 + `THREAT_WITHOUT_GOAL` |
| 4 | safety 2, goal I adjusted to 3 (conflict) | – | 3 + `GOAL_OVERRIDE_EXCEEDS_ASSET` |
| 5 | goal N 2, goal Acc 3 (R threat) | – | 3 (MAX over N and Acc) |

These cases guard against the old asset-based aggregation silently creeping back into `applyAssetCriteriaToFactorRatings`.

For `goalState()` (Phase 2), the matrix `source × suggested × kind × snapshot × current suggestion` is tested completely.

### 4.6 Deliberately not adopted

- **Chain damage → goal → threat → risk in the asset dialog.** In the workflow, threats are generated *after* assets. The dialog would usually have nothing to show yet. Useful later as a back-reference on the card ("3 threats violate this goal") and in the report.
- **A "confirmed" state per goal.** A click per goal proves nothing but that it was clicked. Approval of an assessment belongs to the audit trail (signed commits, four-eyes principle), not to a field on the goal.
- **Stored status enum.** See 4.1: states are derived, only the snapshot is stored.
- **Derivation signature (hash) in the snapshot.** See 4.1: basis and driver suffice, are explainable and cause no false alarms.
- **Findings inside `goalState()`.** See 4.1: state and evaluation of the state stay separate.

### 4.7 What changes for the analyst

| Today | New |
|---|---|
| Enter severity, goal levels appear "magically" | card separates "why this goal" and "why this level" |
| "Low" can mean assessment or floor | floor is recognisable; missing assessment reads "Assessment required" |
| One impact per asset for all threats | impact per security goal, inherited or adjusted, correctly assigned per threat |
| Deviation from the suggestion leaves no trace | adjusting and excluding each require their own rationale, both appear in the report |
| Manual value goes stale unnoticed | changed basis is flagged with its reason, never silently adjusted |
| Review only by opening every asset | state markers in the table, findings in validation |
| Badge ≠ risk impact possible | one definition for both |

## 5. Open questions / risks

1. **Keep the upper bound in principle?** The implementation follows the invariant "goal impact ≤ asset impact" from 4.3; **no** second model is supported in parallel. Open is only the product question whether this invariant is right long-term. The alternative would be to leave both free and *compute* the asset as the MAX. That shifts input from the envelope to the parts and contradicts the consequence-first workflow.
2. **Analyst effort:** with many assets × up to 7 goals, input load threatens. The assumption is that overrides are the exception and progressive disclosure keeps cards lean. This can only be checked on real projects.
3. **Mapping quality:** `CAUSE_MECHANISM_CRITERIA` is hard-wired. Should the criterion → goal mapping be configurable per project (e.g. via regulation preset)?
4. **Relation to damage scenarios (ISO 21434):** per-goal impact is effectively one damage scenario per asset × property (1:1). Is that enough, or will 1:n (several damage scenarios per goal) be needed?
5. **EN 50742 Approach A:** there, severity (reversible/non-reversible/fatal) hangs on the safety-function asset, not on a security goal. Must per-goal impact be hidden or mapped differently for this preset?

*Resolved during review:* minimum level low vs. none (rev. 2) · sensitivity of "basis changed" (rev. 3, reasons with direction) · automatic capping (rev. 3, dropped) · generator filter asymmetry (moved into Phase 1).

## 6. Implementation phases

Each phase ends with its own commit(s), delivered as per-point `.diff` files for `git apply` plus a separate commit message. **Every commit must build and pass tests on its own.** Phases 2–6 depend on Phase 2; Phase 3 and the model part of Phase 4 can proceed in parallel after it.

### Phase 0 — prerequisites ✅ delivered

See §3. **Done when:** both patches applied, full test suite green locally (the sandbox only ran the asset and documentation suites, `tsc` for app + CLI, depcruise-doc and a CLI smoke test for md + pdf).

### Phase 1 — goal filter semantics in the threat generator

**Goal:** a threat category survives if it is *technically possible* (base STRIDE + property modifiers) **and** violates an active security goal. Today this holds only when no property modifier fired (2.5).

**Proposed decision (confirm before coding):** intersection instead of union.

```
final = (propsApplied ? propsResult : base) ∩ goalCategories   // when goals applied
final = propsApplied ? propsResult : base                      // when no goals applied (unchanged)
```

This is the consistent generalisation of today's "props not applied" branch.

**Scope:**
- `features/threats/services/strategies/unified-strategy.ts` — `getStrideCategories` combination
- `features/threats/models/strategy-types.ts` — extend `GenerationModules` with `suppressedByGoals: StrideCategory[]` (categories that were technically possible but had no active goal)
- Surface `suppressedByGoals` as an info finding; where threat-generation findings are displayed must be checked first — if there is no suitable place, carry it in the metadata only and surface it in Phase 6

**Explicitly not in scope:** per-goal impact, `getInitialImpact`.

**Tests:** unit tests for all four combinations (goals yes/no × props yes/no) including the case "property re-adds a category the goals excluded"; regression run on the fixtures `SmokeDetector.tara.json` and `cnc-ref.tara.json` with a documented before/after threat diff.

**Risk:** projects in which property modifiers fired will produce fewer threats. Check how risk sync handles risks whose threat disappears (orphaned risks) and mention it in the release notes.

**Done when:** the behaviour is symmetric, the threat diff on the fixtures is reviewed and explained.

### Phase 2 — domain: `goalState()`, `goalFindings()`, snapshot

**Goal:** the single domain truth all surfaces consume (4.1). No UI.

**Scope:**
- `features/assets/models/asset-security-goals-types.ts` — optional `suggestionAtDecision`; `StaleReason`, `GoalState` types
- new `features/assets/services/asset-goal-state.ts` — `goalState(asset, goal, impactScale)`, `goalFindings(state, asset)`, `severityFor(reason)`
- **Explicit user actions as pure functions** in the same module: `adjustGoal`, `excludeGoal`, `keepDecision`, `resetToSuggestion`. They are the *only* way to create or change a manual goal and its snapshot. Invariant A is thus enforced in the domain, not in the UI.
- `features/assets/services/asset-validator.ts` — integrate `goalFindings`. **Note:** `AssetValidation` today holds only `errors: string[]` and `warnings: string[]` with i18n keys like `tabs.assets.validation.<code>:<assetId>:<goal>`. Decision needed: extend additively with `infos: string[]` (and show them in the asset toolbar), keeping the key scheme `…:<assetId>:<goal>[:<reason>]`. An error (`GOAL_OVERRIDE_EXCEEDS_ASSET`) sets the phase status to incomplete — intended.
- i18n `assets.json` en/de for all new keys; fix the swapped `tooltips.cianaaa.excluded` strings (en shows German, de shows English)

**Tests:** full matrix `source × suggested × kind × snapshot × current suggestion`; invariants A, B, D; every stale reason with its severity; snapshot initialisation for legacy manual goals.

**Done when:** all states and findings are covered by tests; no consumer yet changed.

### Phase 3 — security-goal cards (point 3)

**Goal:** the UI from 4.2, consuming `goalState()` and the action functions from Phase 2.

**Scope:**
- new component `features/assets/components/security-goal-card.tsx` (collapsed/expanded, badges, the stale variant)
- `asset-dialog.tsx` — replace the cause-mechanism section (~line 1426) and the expert CIANAAA section (~line 1822) with the cards; consequence field in all modes
- i18n en/de

**Tests:** component tests for the card states (vitest component config); invariant C in the dialog (excluded goal stays visible).

**Done when:** the dialog no longer builds goal conditions itself; every displayed state comes from `goalState()`.

### Phase 4 — per-goal impact through to the risk (point 4)

**Goal:** the formal definition from 4.3 in code, one definition for badge and risk.

**Scope:**
- one shared function `resolveThreatImpact(stride, linkedAssets)` implementing steps 1–5 of 4.3. Placement must respect `features/risks ⊥ features/assets`: in `src/app/utils` (app layer bridges both features) or, if the threat generator needs it too, in `src/shared`
- `app/utils/build-asset-data-reference.ts` — pass `SecurityGoal.impactRatings` and the active goals on to the risk side
- `applyAssetCriteriaToFactorRatings` — take the STRIDE category and use `resolveThreatImpact`
- `UnifiedStrategy.getInitialImpact` — same definition
- goal impact editor (inherited/adjusted, cap with explanation, reset) in the card from Phase 3
- findings `GOAL_OVERRIDE_EXCEEDS_ASSET`, `GOAL_ENVELOPE_SLACK`

**Tests:** the five mandatory cases from 4.5; invariant E; badge and risk give the same value for the same threat.

**Risk:** none for existing projects — goal overrides cannot be set today (no UI), so every goal inherits and results are unchanged. Verify this with a fixture regression run.

**Done when:** the mandatory cases pass and the fixtures produce unchanged risk values.

### Phase 5 — overview and report

**Scope:**
- asset table: goal chips with level and state marker, filter "Needs review only"
- `documentation/utils/security-goal-doc-rows.ts` — build rows from `goalState()`; state in the "Source" column; **excluded goals included** with rationale (invariant C); all formats incl. pdfmake

**Tests:** extend `security-goal-doc-rows.test.ts` for states and excluded goals.

### Phase 6 — threat ↔ goal cross-checks

**Scope:**
- `THREAT_WITHOUT_GOAL`, `GOAL_WITHOUT_THREAT` — cross-feature, therefore validated at the app layer
- back-reference on the card: "N threats violate this goal"
- surface `suppressedByGoals` from Phase 1 if not done there

**Tests:** both findings on the fixtures; back-reference count.

---

After Phase 2, the concept should only be extended when real projects require it — not by inventing further states up front.

## 7. Change history

- **Rev. 1:** problem analysis, cards with driver, per-goal impact.
- **Rev. 2:** after external review: explicit state model, detection of stale manual decisions via snapshot, floor not shown as an ordinary "Low", separate explanations "why goal / why level", inherited/adjusted per criterion value, explained upper bound, progressive disclosure, separate "Exclude" action, review overview via table and findings. Not adopted: chain display in the asset dialog, "confirmed" state, stored status enum.
- **Rev. 3:** after second review: ground rule "no silent change of analyst decisions"; automatic capping dropped, instead error finding and conservative calculation until resolved; snapshot extended by basis and driver (instead of hash); stale reasons with direction and graded severity; "Assessment required" instead of minimum level when impact is missing; separate rationale questions for adjust and exclude; excluded goals in the report; formal definition of effective value, upper bound and risk impact (envelope corrected from "= MAX" to upper bound); `goalState()` signature as domain function; explicit rule for finding severities. Not adopted: derivation signature (hash), findings inside `goalState()`.
- **Rev. 3.1:** after third review: invariants A–E and the overarching invariant as specification; mandatory risk-impact test cases incl. "linked asset without matching goal contributes nothing"; driver defined as deterministic representative driver; `GOAL_OVERRIDE_STALE` as one code with reason-dependent severity; `suggestion-removed` on excluded goals only info; UI wording per stale reason instead of a blanket "outdated"; `rationalePrompt` removed (derivable from `visibility`); `GOAL_ENVELOPE_SLACK` phrased neutrally; open question 1 marked as a pure product question.
- **Rev. 3.2:** translated to English; detailed implementation phases (§6) with scope, tests, done criteria; validation-infrastructure constraint (`AssetValidation` holds string keys, no info level) and the Phase 1 decision (intersection) made explicit.
