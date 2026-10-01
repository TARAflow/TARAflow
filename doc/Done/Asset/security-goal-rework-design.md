# TARAflow — Asset Impact → Security Goals (CIANAAA) Rework

> **Purpose of this document:** A new chat (or contributor) should know immediately *what* is being reworked, *why*, *how far it is* and *how to continue*. Binding are the **ground rule** (§4), the **invariants** (§4.5) and the **phase plan** (§6) — ask before deviating from them.

**Status:** Design final (rev. 3.1, after three external reviews), Phases 0–5 merged, Phase 6 delivered (pending merge)
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

Active goals filter an element's STRIDE categories in the generator (`CIANAAA_TO_STRIDE`, `UnifiedStrategy.getStrideCategories`). The combination with property modifiers was asymmetric:
- without property modification, only the goal categories applied (base ∩ goals),
- with modification, the union applied (goals ∪ properties).

The union works in **both** directions (observed on SmokeDetector):
- a goal re-adds a category an explicit property assumption removed — `processSemantic = functional_block` removes S and R on P-1, a non-repudiation goal brought R back; in per-interaction mode, `exposureLevel = EL0` ("internal, trusted") removes I on DF-3/4/23/24, a confidentiality goal brought it back;
- a property keeps a category no goal asks for — P-1 kept E without an authorization goal. A property that *reduces* the attack surface thus *added* a threat compared with the same element without it.

A related bug surfaced while verifying: in **per-element** mode, data-flow properties never reached the strategy at all (the data-flow element was built without `properties`), so e.g. EL0 had no effect on data flows there — unlike per-interaction. Fixed in Phase 1 (commit 8).

Whether e.g. Information Disclosure appeared on a data flow depended on whether a property modifier happened to fire. **Resolved in Phase 1** (intersection).

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
  visibility: "card" | "excluded" | "hidden";
  source: "suggested" | "manual" | "legacy";
  assessment: "assessed" | "provisional" | "no-applicable-impact" | "missing";
  level: CIANAAALevel;               // effective level (internal, incl. minimum level)
  displayLevel: CIANAAALevel | null; // null for assessment = "missing"
  levelReason: LevelExplanation;     // from explainLevel()
  suggestionReasons: string[];       // relations ("Config push → transports")
  suggestion: GoalSuggestionSnapshot; // suggested, level, basis, driver
  stale: StaleReason | null;
  rationaleRequired: boolean;
}
```

Which rationale question the UI asks (adjust or exclude) follows from `visibility` and is not a separate field. `goalState()` describes the domain state completely but makes no UI decisions.

`visibility` as implemented (renamed from the earlier draft "suggested / not-suggested / excluded", which mislabelled a manually added, not-suggested active goal): `card` = active or suggested; `excluded` = suggested but deliberately deactivated; `hidden` = neither ("Add goal").

Findings are **not** part of `goalState()`. Validation produces them from the state (`goalFindings(state, goal)`). This keeps one place responsible for codes and severities.

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
| `THREAT_WITHOUT_GOAL` *(Phase 6)* | warning | threat violates no active goal of a linked asset |
| `GOAL_WITHOUT_THREAT` *(Phase 6)* | info | active goal addressed by no threat |

`GOAL_OVERRIDE_STALE` is **one** code. The severity follows from the stale reason (`severityFor(reason)`), the reason is carried as context. No separate codes per reason.

- **Report:** the security-goal table from Phase 0 shows the state from 4.1 in the "Source" column. Excluded goals appear too, with their rationale — a deliberate exclusion is an audit-relevant decision and must not be missing from the report. An exclusion the graph no longer suggests is moot and is left out (Phase 5).

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

*Resolved during review:* minimum level low vs. none (rev. 2) · sensitivity of "basis changed" (rev. 3, reasons with direction) · automatic capping (rev. 3, dropped) · generator filter asymmetry (Phase 1: intersection).

## 6. Implementation phases

Each phase ends with its own commit(s), delivered as per-point `.diff` files for `git apply` plus a separate commit message. **Every commit must build and pass tests on its own.** Phases 2–6 depend on Phase 2; Phase 3 and the model part of Phase 4 can proceed in parallel after it.

### Phase 0 — prerequisites ✅ delivered

See §3. **Done when:** both patches applied, full test suite green locally (the sandbox only ran the asset and documentation suites, `tsc` for app + CLI, depcruise-doc and a CLI smoke test for md + pdf).

### Phase 1 — goal filter semantics in the threat generator

**Goal:** a threat category survives if it is *technically possible* (base STRIDE + property modifiers) **and** violates an active security goal. Today this holds only when no property modifier fired (2.5).

**Decision (confirmed):** intersection instead of union. Explicit analyst assumptions (properties) win over derived security goals — the ground rule of §4 applied to the generator.

```
final = (propsApplied ? propsResult : base) ∩ goalCategories   // when goals applied
final = propsApplied ? propsResult : base                      // when no goals applied (unchanged)
```

This is the consistent generalisation of today's "props not applied" branch.

**Effect on existing projects (analysed before coding):** stored threats do not change — the rules are code, the threats are data. The new rule takes effect only through
- the incremental DFD sync, which generates threats for *new* elements only → mixed semantics in one project;
- a full regeneration, which merges analyst data by natural key (element + STRIDE) but has no successor for a dropped category → the threat's analyst data is lost and the risk sync removes its risk (orphaned) with assessment and mitigations.

Measured on the analyst's SmokeDetector project (drift banner before → after, same copy, no resolution applied):
- per-element: 5 → 7 — the rule change affects P-1 (R, E); the 5 of the baseline are older drift on CB-2 and IF-3 (not goal-related, unrated, no risk);
- per-interaction: 2 → 14 — the rule change affects the I, R, E threats of DF-3, DF-4, DF-23, DF-24 (EL0 flows with a confidentiality goal); visible only after the sync fix (commit 6).

An earlier estimate ("5 elements / 6 threats" per-element) was wrong: it passed data-flow properties to the strategy directly, which the per-element generator never did (see §2.5).

Hence the safety net lands **before** the behaviour change. Delivered as eight commits (patch numbers 01–03 and 05–09; patch 04, an earlier revision of this document, was withdrawn):

1. **`feat(threats)` generation drift detection** — `threat-generation-drift.ts` (pure): `detectGenerationDrift()` runs the current generator without writing and compares natural keys with the stored generated threats → obsolete threats + count to be added; manual threats are never obsolete. Explicit actions `keepThreatsAsManual()` (same id, risk stays linked, survives every regeneration) and `removeThreats()`.
2. **`feat(threats)` drift banner, review dialog, regenerate warning** — banner "N stored threats would no longer be generated (K with a risk assessment) · M would be added", shown only while the DFD sync is clean; review dialog with Keep/Remove per threat, **default Keep**; regenerate confirm warns with counts and offers "Review them first". Risk data reaches the tab via the optional `ThreatProjectData.riskAttachments`, built in `workspace-layout` (threats ⊥ risks). `replaceTables()` on both threat hooks.
3. **`fix(threats)` intersection** — `UnifiedStrategy.getStrideCategories`:

```
final = (propsApplied ? propsResult : base) ∩ goalCategories   // when goals applied
final = propsApplied ? propsResult : base                      // when no goals applied (unchanged)
```

The `suppressedByGoals` info finding originally planned here was dropped: drift detection compares the actual stored threats with the actual generator output and covers the same need more directly.

5. **`feat(threats)` drift on the phase tab** — the Threats tab in the phase bar shows obsolete + added as a warning count with an explanatory tooltip, so the analyst sees drift right after changing security goals in the Asset tab. `projectGenerationDrift()` (same DFD-sync gating as the banner) is evaluated in `workspace-layout`; watch typing latency on large projects — debounce if needed.
6. **`fix(threats)` per-interaction sync scope** — a flow with no effective trust boundary on either side (e.g. External Entity → External Entity) is never covered by the per-interaction generator, but the sync check reported it as "data flow without threats"; syncing added nothing and the banner stayed forever (and hid the drift banner). One predicate `isInteractionFlowInScope()` now serves generator and sync check.
7. **`fix(threats)` flow names in the drift review** — per-interaction threats showed an empty element cell.
8. **`fix(threats)` per-element data flows pass their properties** — see §2.5. On SmokeDetector this adds 21 I threats on EL0 data flows to the drift. Several of them are WLAN/HTTPS streams modelled as EL0 — the EL values should be checked before resolving, otherwise "Remove all without risk" deletes legitimate disclosure threats.
9. **`docs(assets)`** — revision 3.4.

Follow-up commits found while verifying on the analyst's project:

10. **`fix(threats)` drift review column "Name"** — holds element names and data-flow names.
11. **`fix(threats)` threat text lookup** — the texts existed in EN and DE but were unreachable: the cloud and mobile i18n indexes spread their texts flat instead of under the domain key, and four embedded templates (element D-004/D-005, interaction D-003/D-004) declared domain `dataflow`/`physical` although their texts live under `embedded`. The generator silently fell back to `general.<id>` — the text of a different template. New test: every built-in template has threat/attack/cause in EN and DE under its domain.
12. **`fix(threats)` per-element dedup** — the final dedup was keyed on the display label alone; a PhysicalBoundary and a ChipBoundary both labelled "SDC" collided and the chip boundary's T/I/E threats were dropped on every regeneration. Now keyed on element id + label.
13. **`feat(threats)` retained threats** — Keep records `retainedAfterRuleChange { at, previousSource }`; the source badge shows "R" instead of "M"; the threat dialog offers "Undo keep" (the threat returns to its generated source and reappears in the drift review if still not produced).
14. **`fix(threats)` sync scope robustness** — the scope check of commit 6 crashed on graphs without the trust-boundary map (component-test stubs); without that map every flow counts as in scope.
15. **`feat(ui)` reading order** — `shared/utils/display-order.ts`: element kind, natural display id (DF-2 before DF-10), STRIDE S-T-R-I-D-E. Applied to per-element groups, the per-interaction table (new default sort), the drift review and the DFD description view.
16. **`docs(assets)`** — revision 3.5.

Measured result on the analyst's SmokeDetector project after 12: per-element 25, per-interaction 14; after resolution 0 in both modes.

**Tests:** `threat-generation-drift.test.ts` (15), `threat-drift-dialog.test.tsx` (component, 5), `phase-tab.drift-hint.test.tsx` (component, 2), `unified-strategy.goal-filter.test.ts` (8; 4 fail on the old code), `interaction-sync.scope.test.ts` (4), `element-generator.dataflow-properties.test.ts` (3). Threats unit suite and regression suite green.

**Open catalog finding (separate task):** in the embedded per-element denial set, the texts of D-001…D-003 do not match their templates (e.g. D-003 applies to protocol stacks/drivers; EN speaks of a safety-system DoS, DE of injected safety parameters), and EN and DE differ in content. Looks like shifted ids; needs a content review of the catalog, not a code fix.

**Modelling note (SmokeDetector):** DF-29/DF-30/DF-35 (WLAN / internet streams between internal processes, `exposureLevel = EL0`) are still to be remodelled; in the current project they also carry `protocol = https` with `encryptionInTransit = none`, which contradicts itself. As long as they are EL0, WLAN eavesdropping is modelled nowhere: the WLAN interface skips I by design (interception belongs to the data flow), and the flows skip I because of EL0.

**Known limitation:** the DFD sync reports an element or flow as "missing" when it has no stored threats, even if the generator produces none for it (e.g. all categories filtered by properties and goals). Commit 6 fixes the out-of-scope case; the general case would be solved by defining "missing" as drift-to-be-added for that element. Not done yet.

**Release note:** after updating, projects in which property modifiers and security goals meet, and per-element projects with data-flow properties, show the drift banner; check the flagged elements' properties, then resolve via "Review" before regenerating.

**Done:** all commits merged; the drift banner was checked on the analyst's project in both modes.

### Phase 2 — domain: `goalState()`, `goalFindings()`, snapshot ✅ delivered

**Goal:** the single domain truth all surfaces consume (4.1). No UI.

Delivered as three commits (patches 17–19) plus this document (20):

17. **`refactor(assets)` one suggestion rule** — `deriveSecurityGoalSuggestions()` carried a line-by-line copy of `computeSuggestedGoalTypes()`; it now calls it. `goalState()` uses the same function, so stored goals, previews and states cannot diverge.
18. **`feat(assets)` goal state** — `features/assets/services/asset-goal-state.ts`:
    - `SecurityGoal.suggestionAtDecision?: { suggested, level, basis, driver }` (types in `asset-security-goals-types.ts`, with `LevelBasis`, `StaleReason`).
    - `goalStates(asset, scale)` / `goalState(asset, goal, scale)`, `currentSuggestion()`, `staleReason()`.
    - `goalFindings(state, goal)`, `severityFor(reason, isExclusion)` — the stale severity depends on whether the decision was an exclusion, not on the current visibility (an excluded goal that is no longer suggested becomes `hidden`, yet its finding is only info).
    - Explicit actions: `adjustGoal`, `excludeGoal`, `keepDecision`, `resetToSuggestion`, `initializeMissingSnapshots` (to be called when the analyst saves an asset in Phase 3; records the current suggestion as baseline for manual goals decided before snapshots existed).
19. **`feat(assets)` findings in the asset validation** — `AssetValidation.infos?: string[]` (additive, never affects completeness); keys `tabs.assets.validation.<code>[.<reason>]:<displayId>:<goal>` — the asset is named by its display id, not the UUID; asset toolbar lists infos; i18n en/de; swapped `tooltips.cianaaa.excluded` fixed.

Not in Phase 2: `GOAL_OVERRIDE_EXCEEDS_ASSET` and `GOAL_ENVELOPE_SLACK` need per-goal impact and come with Phase 4.

**Tests:** `asset-goal-state.test.ts` (26: assessment per level basis, visibility and source, every stale reason with severity, invariants A, B, D, all actions), `asset-validator.goal-findings.test.ts` (4), `asset-cianaaa-deriver.test.ts` (+4, single suggestion rule).

**Effect on SmokeDetector:** the asset toolbar now shows 3 × "decided manually without a rationale" and 8 × "suggested, but no impact rated — assessment required" (warnings). The phase status is unaffected.

### Phase 3 — security-goal cards (point 3) ✅ delivered

**Goal:** the UI from 4.2, consuming `goalState()` and the action functions from Phase 2.

Delivered as one commit (patch 22) plus this document (23):

- **`security-goal-card.tsx`** — renders only what `goalState()` says:
  - header: goal, level chip — or "Assessment required" when nothing is rated (invariant D), source badge (Suggested / Adjusted / Added / Excluded / Earlier decision), provisional / minimum-level markers, "Review" (warning reasons) or "Suggestion changed" (info reasons), "Rationale missing"; below it the one line that explains the level;
  - expanded: why this goal (relations, violation), why this level (the goal's relevant criteria with the driver marked; `goalRelevantCriteria()` / `goalMechanism()` exported from the deriver), the changed-suggestion block with Keep / Adopt, level selector, rationale with a question per decision type, formal requirement, consequence;
  - actions: "Not relevant for this asset" (exclude), "Adopt suggestion" / "Reactivate (suggestion)" / "Remove goal" (reset — the label depends on the state).
  - Cards that need attention (changed suggestion, assessment missing, rationale missing) open expanded.
- **Asset dialog** — cards for `visibility = card`, a separate list of excluded cards (invariant C), chips "Add a security goal" for hidden goals. All decisions via `adjustGoal` / `excludeGoal` / `keepDecision` / `resetToSuggestion`; the old toggle and level handlers are gone (the dialog shrank from 1986 to 1507 lines).
- **Rationale is enforced:** save is blocked while a manual decision (adjusted, excluded, added) has no rationale; the alert names the goals.
- **On save:** `initializeMissingSnapshots()` gives manual goals decided before snapshots existed their baseline.
- **Consequence** is shown in every mode. `damageScenarioMode` no longer gates it; the prop is kept for callers.

Decisions made during implementation:
- The rationale question is derived, not stored: excluded → "not relevant?", manual + suggested → "why does the suggested level not fit?", manual + not suggested → "why is this goal needed in addition?" (a third case the design had not named).
- Choosing a new level on an already manual goal is a new decision: the snapshot moves to the current suggestion.
- Existing projects: assets whose manual goals have no rationale (e.g. DA-001, DA-004 in SmokeDetector) cannot be saved from the dialog until the rationale is filled in. Intended — the rationale is an audit requirement.

**Tests:** `security-goal-card.test.tsx` (component, 11): every card state, action routing, dialog wiring, rationale blocks save, snapshot on save, adding a not-suggested goal. Component suite (10 files) and asset unit suite green.

**Follow-ups after the analyst's review (patches 24–27):**
- 24 — layout: "Why this goal?" and "Why this level?" side by side on a light grey block; rationale, requirement and consequence fields share one width; a card opens by itself when it starts needing attention; cards keyed per asset.
- 25 — **a rationale justifies a deviation only.** Picking the suggested level returns the goal to the suggestion (rationale and snapshot go); `goalState.rationaleRequired` is false for a manual goal on the suggested level. The rationale field is the last field, outlined red while empty.
- 26 — **findings panel below the asset table** (like the DFD tab): errors and warnings, infos behind their chip; a click opens the asset in the dialog tab where the finding is fixed and focuses the goal card. `collectAssetFindings()` gives structured findings; the persisted strings derive from them. "Goal without formal requirement text" became an info.
- 27 — the panel is resizable (80–500 px) with its own scrollbar.

### Phase 4 — per-goal impact through to the risk (point 4) ✅ delivered

**Goal:** the formal definition from 4.3 in code.

Delivered as three commits (patches 28–30) plus this document (31):

28. **`feat(assets)` impact per goal in the domain**
    - `effectiveGoalRatings(asset, goal)` — eff = override ?? asset value, **per criterion**. `resolveImpactRatings()` merges per criterion as well (it used to replace the whole list; overrides were never settable, so no project changes).
    - Goal levels (deriver, `goalState`, previews) follow the goal's effective ratings.
    - `goalState`: `impactOverrides`, `exceedsAsset`. A per-goal impact is a deviation → rationale required, asked as "Why does this goal's impact differ from the asset's?" (a fourth rationale question).
    - `GOAL_OVERRIDE_EXCEEDS_ASSET` (error) — also where the asset rates n/a or nothing; never capped (invariant E). `GOAL_ENVELOPE_SLACK` (info, `assetImpactFindings`).
    - `setGoalImpact(goal, criterion, value | undefined)`.
29. **`feat(risks)` risk impact from the violated goals** — `shared/utils/threat-impact.ts` `resolveThreatImpactAssets(assets, stride)` implements steps 1, 2, 4, 5 and returns asset snapshots whose ratings are the effective values, so the existing per-factor logic (worst criterion, safety priority via `physicalImpact`) runs unchanged on top. `applyAssetCriteriaToFactorRatings(…, strideCategory?)`; risk sync (both paths) and risk dialog pass the category. `SecurityGoalReference.impactRatings`; `buildAssetDataReference` passes overrides of active goals.
30. **`feat(assets)` impact editor in the card** — "Impact of this goal (n adjusted)": per rated criterion the asset value, a select (inherited / 1…asset value / n/a) and an inherited/adjusted chip; the cap is explained in a tooltip; a conflict shows "Adjustment 3 exceeds asset value 2" with "Reset to asset value" / "Raise asset value".

**The threat-table badge** (`getInitialImpact`) needed no change: it takes the MAX of the matching goals' levels, and those levels follow the effective ratings since 28. Badge and risk impact therefore rest on the same effective values; they are not the same number (the badge is a goal level, the risk has one value per impact factor), which is by design.

**Effect on existing projects:** without overrides, a risk impact changes only where a linked asset *without* a matching goal carried the highest value (step 4). Measured on SmokeDetector: 78 threats with linked assets, 3 risks — no change. The earlier statement "none for existing projects" was too strong; step 4 alone can change values in projects where elements carry several assets with different goals.

**Not done here:** `THREAT_WITHOUT_GOAL` (step 5 finding) — delivered in Phase 6 (cross-checks).

**Tests:** `asset-goal-impact.test.ts` (9), `threat-impact.test.ts` (9: the five mandatory cases through the risk prefill, inactive goals, n/a, previous behaviour without STRIDE, reference builder), `security-goal-card.test.tsx` (+3).

### Phase 5 — overview and report ✅ delivered

**Goal:** the review across all assets without opening every dialog (4.4), and the goal state in the report.

Delivered as three commits (patches 32–34) plus this document (35):

32. **`feat(assets)` goal chips in the asset table**
    - `features/assets/utils/goal-badges.ts` (pure): `goalSourceKey()`, `goalBadges()` (source badge + state markers as i18n key and colour), `goalMarker()` (worst finding of the goal from `goalFindings()`). The goal card now renders the same badges — card and table cannot drift apart. New in the card header: "Impact above asset value" (`exceedsAsset`), so the error is visible even when the card is collapsed.
    - `security-goal-chips.tsx`: one chip per active or excluded goal in canonical order — "I · High"; "I · ?" when the assessment is missing (invariant D); excluded goals greyed and struck through, rationale in the tooltip (invariant C); pen icon for manual decisions; a dot for the worst finding (red = error, amber = warning). Infos stay in the tooltip — they describe legitimate states and would drown the markers.
33. **`feat(assets)` filter "Needs review only"** — `assetIdsNeedingReview(findings)` in the validator: an asset needs review when it has at least one error or warning in `collectAssetFindings()`. Toggle with count in the table bar; an empty result says "No asset needs review." instead of showing an empty grid.
34. **`feat(docs)` goal table from the goal state** — `buildSecurityGoalDocRows()` builds its rows from `goalStates()`:
    - rows for active goals **and deliberately excluded goals** (level "-", rationale as basis, `excluded: true`);
    - "Source" carries the state: Derived / Derived (provisional | minimum level | assessment required) / Adjusted / Added / Excluded / Earlier decision, plus ", impact adjusted" and, for a changed basis, the reason graded like the finding ("— review: suggested level raised to Critical" for warnings, "— suggestion changed: …" for infos);
    - "Level" reads "Assessment required" instead of the minimum level (invariant D);
    - "Basis": a deviation is justified by the rationale (missing → "(no rationale given)") plus the suggestion it deviates from; otherwise relations and level driver. Per-goal impacts are listed with the asset value ("Safety Impact = 2 (asset: 4)" / "… (exceeds asset value 2)");
    - intro text in all four templates and the pdfmake labels; pdfmake sets excluded rows apart (italic, grey) and widens the source column.

Decisions made during implementation:
- **The filter counts every error and warning of the asset**, not only security-goal findings (e.g. also "not linked to the DFD"). It is the same set the findings panel shows; a goal-only filter would hide assets that still need work.
- **Moot exclusions are not reported.** An excluded goal that the graph no longer suggests becomes `hidden` (§4.1); its decision has no object any more (the stale finding is only info). It is left out of table and report.
- **Report wording follows the card:** "Manual" is split into Adjusted / Added, "Unspecified" became "Earlier decision". Existing reports change visibly.
- **Fix carried along:** the report explained a derived level with `explainLevel()` on the **asset** ratings. Since Phase 4 the level follows the goal's effective ratings, so with a per-goal impact the report cited the asset value as driver (SmokeDetector DA-005 A: "Operational = 4" for a level that rests on 3). The basis now uses `state.levelReason`.
- A manual goal on the suggested level deviates from nothing: the report shows the derivation, not "(no rationale given)" — consistent with patch 25.

**Tests:** `goal-badges.test.ts` (4), `security-goal-chips.test.tsx` (component, 8, incl. the real DataGrid), `asset-table.review-filter.test.tsx` (component, 3), `asset-validator.goal-findings.test.ts` (+2), `security-goal-doc-rows.test.ts` (+11: excluded with and without rationale, moot exclusion, assessment missing, provisional, stale warning / info / German, effective driver, override above the asset value, manual goal on the suggestion, markdown and pdfmake rows; 14 of the 23 fail on the old code). CLI smoke test on SmokeDetector (md + pdf, de).

**Follow-up after the analyst's review (patch 36):** chip colour encodes **who decided**, not the level. With the level palette the goal chips read as impact chips in the same row. Now: suggested = blue outline, manual (adjusted / added) = blue filled + pen icon, excluded = grey outline struck through + pen icon, assessment missing = "I · ?" in the suggested style (the amber marker carries the warning). The level stays in the label. The goal card in the dialog keeps the level colours — it shows one goal at a time, with no impact chip next to it.

**Seen on SmokeDetector, not addressed here:** the asset inventory of the report lists the internal UUID in the ID column for some assets (e.g. sensor firmware) instead of the display id.

### Phase 6 — threat ↔ goal cross-checks ✅ delivered

**Goal:** make the step-5 fallback of the risk impact (§4.3) visible, and show per goal which threats realise it.

Delivered as three commits (patches 38–40) plus this document (41):

38. **`refactor(app)` one threat → asset link rule** — `app/utils/threat-asset-links.ts` (`buildElementToAssetIds`, `resolveThreatAssetIds`): the threat's own `linkedAssetIds`, else the assets of its anchor element (element / data flow / source element), via `linkedDFDElements` or an `is_an` relation. Extracted unchanged from `extractThreatReferences` in workspace-layout, which now uses it.
39. **`feat(assets)` threat ↔ goal cross-checks**
    - `shared`: `violatesGoal(goal, stride)` — THE definition of "violates" (active goal, `CIANAAA_TO_STRIDE`), now also used by `resolveThreatImpactAssets`; `goalTypesFor(stride)`; projection type `ThreatGoalLink` (id, display id, STRIDE, linked asset ids).
    - `app/utils/build-threat-goal-links.ts`: projects the threats of all **enabled** generators (per-element, per-interaction, attack-path of relevant paths without the mitigation gate); dismissed threats (`not_relevant`) are left out; same link rule as the risk register.
    - `features/assets/services/asset-threat-crosscheck.ts`: `THREAT_WITHOUT_GOAL` (warning) — no linked asset has an active goal the threat violates; reported per asset × STRIDE category with count and threat ids, opens the card of the missing goal. `GOAL_WITHOUT_THREAT` (info) — active goal no linked threat violates. No threats at all → no cross-check (before threat generation).
    - `collectAssetFindings(assetData, threatLinks?)` adds them to the findings panel (message parameters via `AssetFinding.params`) and thereby to the "Needs review only" filter.
40. **`feat(assets)` back-reference on the goal card** — "N threats" chip in the card header (ids in the tooltip, at most 10 + "+N"); "no threat" when none; not shown for excluded goals or without threat data. `threatsForGoal()` counts the asset's threats of the goal's STRIDE category, independent of whether the goal is active — so the count is right while the analyst edits.

Decisions made during implementation:
- **Evaluation in the asset feature, not the app layer.** The design said "validated at the app layer". The app layer only *projects* the threats (`ThreatGoalLink`, a shared type); the asset feature evaluates the projection against its own working copy of the goals. That way the findings and the card follow unsaved edits in the dialog, and the asset feature still imports nothing from `features/threats`.
- **Panel only, not persisted.** The cross-check findings are not part of `validateAssetData()` / the stored `AssetValidation` (that is built without threat data) and do not change the phase status.
- **Dismissed threats do not count**, unrated and uncertain ones do. A goal only dismissed threats violate has no threat that realises it.
- **Grouping per asset × STRIDE** for `THREAT_WITHOUT_GOAL`: a whole data flow of unmatched threats is one finding, not twenty. A threat linked to several assets appears on each of them — adding the goal on any one resolves it.
- **`suppressedByGoals`** (old scope item): stays dropped, see Phase 1 — drift detection covers it.

**Tests:** `threat-asset-links.test.ts` (2), `build-threat-goal-links.test.ts` (3), `asset-threat-crosscheck.test.ts` (8: matched on one of several assets, grouping, R via N/Acc, excluded goal, unlinked threats, goal without threat, no threats, back-reference count), `asset-validator.goal-findings.test.ts` (+2: message parameters and review filter; nothing without the projection, nothing persisted), `security-goal-card.test.tsx` (+4: count, "no threat", hidden without data / for excluded goals, dialog wiring).

**Seen on SmokeDetector (455 threats, 240 without a linked asset):** 8 `THREAT_WITHOUT_GOAL` groups with 28 threats, 3 `GOAL_WITHOUT_THREAT`. Most of them sit on FU-002 (alarm trigger, goals I and A): per-interaction threats of categories S, R, I and E whose stored `linkedAssetIds` name FU-002, while the generator decided their categories from the goals of the assets on the *data flow*. Generator scope (assets of the flow) and threat link (stored asset ids) are not the same set — a modelling question for a separate look, not a defect of the check. The many threats without any linked asset are not covered by this check.

---

After Phase 2, the concept should only be extended when real projects require it — not by inventing further states up front.

## 7. Change history

- **Rev. 1:** problem analysis, cards with driver, per-goal impact.
- **Rev. 2:** after external review: explicit state model, detection of stale manual decisions via snapshot, floor not shown as an ordinary "Low", separate explanations "why goal / why level", inherited/adjusted per criterion value, explained upper bound, progressive disclosure, separate "Exclude" action, review overview via table and findings. Not adopted: chain display in the asset dialog, "confirmed" state, stored status enum.
- **Rev. 3:** after second review: ground rule "no silent change of analyst decisions"; automatic capping dropped, instead error finding and conservative calculation until resolved; snapshot extended by basis and driver (instead of hash); stale reasons with direction and graded severity; "Assessment required" instead of minimum level when impact is missing; separate rationale questions for adjust and exclude; excluded goals in the report; formal definition of effective value, upper bound and risk impact (envelope corrected from "= MAX" to upper bound); `goalState()` signature as domain function; explicit rule for finding severities. Not adopted: derivation signature (hash), findings inside `goalState()`.
- **Rev. 3.1:** after third review: invariants A–E and the overarching invariant as specification; mandatory risk-impact test cases incl. "linked asset without matching goal contributes nothing"; driver defined as deterministic representative driver; `GOAL_OVERRIDE_STALE` as one code with reason-dependent severity; `suggestion-removed` on excluded goals only info; UI wording per stale reason instead of a blanket "outdated"; `rationalePrompt` removed (derivable from `visibility`); `GOAL_ENVELOPE_SLACK` phrased neutrally; open question 1 marked as a pure product question.
- **Rev. 3.2:** translated to English; detailed implementation phases (§6) with scope, tests, done criteria; validation-infrastructure constraint (`AssetValidation` holds string keys, no info level) and the Phase 1 decision (intersection) made explicit.
- **Rev. 3.3:** Phase 1 implemented. §2.5 corrected: the union worked in both directions. Phase 1 decision confirmed (intersection); drift detection + explicit Keep/Remove resolution ordered before the rule change; planned `suppressedByGoals` finding dropped in favour of drift detection.
- **Rev. 3.4:** measurements replaced by the analyst's test results (per-element 5 → 7, per-interaction 2 → 14); wrong earlier estimate explained; commits 5–8 added (phase-tab drift warning, per-interaction sync scope, flow names, per-element data-flow properties); known limitation of the DFD sync documented.
- **Rev. 3.5:** Phase 1 closed. Follow-up commits 10–15 documented (drift column label, threat text lookup, per-element dedup, retained threats with undo, sync scope robustness, reading order); open catalog finding and SmokeDetector modelling note recorded.
- **Rev. 3.6:** Phase 2 delivered (patches 17–19): single suggestion rule, `goalState()` / `goalFindings()` / snapshot / explicit actions, findings in the asset validation with `infos`. `GoalState.visibility` renamed to `card | excluded | hidden`; stale severity keyed on "decision was an exclusion".
- **Rev. 3.7:** Phase 3 delivered (patch 22): security-goal cards in the asset dialog; rationale enforced on save; baseline snapshots on save; consequence in all modes; third rationale question "added".
- **Rev. 3.8:** Phase 3 follow-ups (patches 24–27: layout, rationale only for deviations, findings panel, resizable panel) and Phase 4 delivered (patches 28–30: per-goal impact domain, risk impact from the violated goals, impact editor). Corrected the Phase 4 risk statement: step 4 can change values in existing projects.
- **Rev. 3.9:** Phase 5 delivered (patches 32–34): goal chips with level and state marker in the asset table (badges shared with the card), filter "Needs review only" (every error or warning of the asset), report rows from `goalStates()` with the state in "Source", excluded goals with rationale, effective ratings as level basis. Moot exclusions not reported.
- **Rev. 3.10:** Phase 5 follow-up (patch 36): goal chips in the asset table coloured by source (blue outline / blue filled), not by level; the card keeps the level colours.
- **Rev. 3.11:** Phase 6 delivered (patches 38–40): one threat → asset link rule (extracted), `violatesGoal` shared with the risk impact, `THREAT_WITHOUT_GOAL` / `GOAL_WITHOUT_THREAT` in the asset findings panel (app layer projects the threats, asset feature evaluates against its working copy; not persisted), "N threats" back-reference on the goal card. SmokeDetector observation: generator scope (flow assets) ≠ stored threat links.
