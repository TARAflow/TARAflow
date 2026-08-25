# TARAflow — EN 50742 Approach A Design

> Scope: how TARAflow supports an **EN 50742 Approach A compliant** analysis and
> report, driven by the `en-50742-a` regulation preset. Content is mainly the
> Approach A method (Clause 7 + Annex B of prEN 50742:2025) and how it maps onto
> the existing TARAflow structure.
>
> **Approach B** (Clause 8 — the fixed IEC 62443-3-3/-4-2 subset, Tables 3/4) is
> **out of scope here** and is delivered by the Compliance feature
> (`taraflow-compliance-architecture.md`) as the `en-50742-b` preset's
> `complianceProfile`. This document does not duplicate it.
>
> **ISO 21434** rides the same preset rails (see `regulation-presets-design.md`
> and `taraflow-iso21434-todo.md`); the shared layers below are built once.
>
> Normative source: prEN 50742:2025 (E), CENELEC CLC/TC 44X (Draft for Enquiry,
> Dec 2025). Requirement wording below is condensed into implementation form;
> the authoritative text is the standard itself. Numeric tables are reproduced
> as data.

---

## 1. The Approach A method (normative model)

Approach A is **risk-derived**: for each safety function, per interface, an
attack potential is computed, combined with the safety severity, and mapped to a
Safety-related Security Level (SRSL 0–3). The SRSL then selects a tiered set of
security protection requirements (Clause 7.4.3).

### 1.1 Attack Potential (Annex B, Clause B / line 592)

```
AP = (EL × WoO) + AC
```

| Factor | Scope | Table |
|---|---|---|
| `EL` — Exposure Level | per interface / connection | B.4 |
| `WoO` — Window of Opportunity | whole machinery (project-global), depends on Security Context | B.3 |
| `AC` — Attacker Capability | per threat | B.2 |

**Exposure Level score (Table B.4)** — static, = attack surface:

| Exposure | EL | Value |
|---|---|---|
| Internal | EL0 | 0 |
| Physical | EL1 | 2 |
| Local | EL2 | 5 |
| Adjacent | EL3 | 16 |
| Public | EL4 | 24 |

Rule (B, line 546): if a connection crosses trust boundaries, its EL is the
**higher** one (EL1↔EL2 → EL2). Trust boundaries in the DFD are labelled with EL
(Annex C.7).

**Window of Opportunity score (Table B.3)** — a multiplier, one per machine:

| WoO | Multiplier |
|---|---|
| Very Restricted | 0.6 |
| Moderately Restricted | 0.8 |
| Limited | 0.9 |
| Unlimited | 1.0 |

**Attacker Capability score (Table B.2)** — **note inverted polarity**:

| Capability | Value |
|---|---|
| Extensive knowledge + Advanced skill | 1 |
| Moderate knowledge + Specialist skill | 2 |
| Moderate knowledge + Medium-level skill | 3 |
| Minimal knowledge + Basic skills | 4 |

AC = 4 (a basic-skill attacker is sufficient) yields the **highest** AP → highest
likelihood. This is the opposite polarity of the ISO/IEC 18045 attack-potential
convention (higher effort → lower feasibility). See §3.1.

### 1.2 AP banding (Table B.5)

| AP score | Band | Label |
|---|---|---|
| 0 – 5 | AP0 | Very Low |
| 5.1 – 10 | AP1 | Low |
| 10.1 – 15 | AP2 | Medium |
| 15.1 – 20 | AP3 | High |
| > 20 | AP4 | Very High |

Worked example from the norm (line 604): moderately restricted access (WoO 0.8),
bus between EL1/EL2 → EL2 (5), basic attacker (AC 4):
`AP = (5 × 0.8) + 4 = 8 → AP1`.

### 1.3 SRSL determination (Table B.6) — AP × severity

Severity is sourced from the functional-safety assessment (SIL/PLr; Table B.4
NOTE 1 permits using PLr to express safety impact, SIL↔PLr per Annex A of
EN ISO 13849). TARAflow uses **three** severity levels; the third (`fatal`) is a
TARAflow extension — the norm's Table B.6 defines only the first two rows.

| Severity ＼ AP | AP0 | AP1 | AP2 | AP3 | AP4 | Source |
|---|---|---|---|---|---|---|
| reversible | SRSL0 | SRSL1 | SRSL1 | SRSL2 | SRSL3 | Table B.6 (norm) |
| non-reversible | SRSL0 | SRSL1 | SRSL2 | SRSL3 | SRSL3 | Table B.6 (norm) |
| **fatal** (extension) | **SRSL1** | **SRSL2** | **SRSL3** | **SRSL3** | **SRSL3** | TARAflow — CONFIRMED |

The first two rows are the norm verbatim. The `fatal` row is a confirmed TARAflow
extension: a third severity level (minor / serious / fatal) mirrors the graded
severity scales common in functional-safety risk estimation (e.g. EN ISO 12100
and related safety-norm risk graphs), where death / irreversible catastrophic
harm is its own top tier rather than folded into "non-reversible". Behaviour:
`fatal` never maps to SRSL0 (even at very low AP) and saturates SRSL3 one AP-band
earlier than non-reversible.

This is a fixed lookup, not a smooth numeric threshold (AP2 → SRSL1 / SRSL2 /
SRSL3 depending on severity). Implement it as a literal table, not a derived band.

SRSL applies **per safety function, per interface** (line 590). SRSL0 corresponds
to a completely isolated safety function (no external interfaces).

---

## 2. Mapping onto the existing TARAflow structure

It fits — no new analysis paradigm is needed. Approach A is DFD → assets → STRIDE
→ per-threat likelihood → risk output, which is exactly TARAflow's spine.

| EN 50742 Approach A | TARAflow |
|---|---|
| Item / machine definition + Security Context (C.5) | Overview tab |
| **Safety function** | **Asset** (carries severity reversible/non-reversible) |
| **Interface** | **Asset** (carries EL, or EL derived from trust-boundary crossing) |
| Other safety assets (safety config data, SRESW/SRASW, memory devices — C.4) | Assets |
| Data flow diagram (C.6): assets, data stores, processes, actors, network equipment, data flows | DFD tab |
| Trust boundaries labelled with EL (C.7) | Trust boundaries (EL as boundary/connection property) |
| Threat identification via STRIDE per element (C.8) | STRIDE threat generation (already the default generator) |
| Attack potential `AP=(EL×WoO)+AC` | New likelihood method `en50742-attack-potential` |
| Severity (SIL/PLr → reversible / non-reversible / fatal) | 3-level impact criterion on the safety-function asset |
| SRSL (Table B.6) | Risk-output axis (SRSL0–3), via a literal AP×severity lookup |
| Security protection requirements per SRSL (7.4.3) | `SRSLProfile` catalogue (§5) → Risk-tab requirement set |
| Eliminate / mitigate / compensating countermeasure (Fig 1, 4.3) | Mitigation + Won't/claim model |

**Key fit points:**

- Impact stays on the asset / security goal (severity on the safety-function
  asset), never on a tree node — consistent with the existing rule.
- The risk matrix already combines axes numerically with independent
  vocabularies, so likelihood = AP0–AP4, impact = reversible/non-reversible,
  output = SRSL0–3 is expressible — **except** the AP×severity step is a fixed
  lookup (Table B.6), so it bypasses the numeric-threshold matrix and uses the
  literal table.
- EL following the "crosses trust boundary → higher EL" rule fits the existing
  derived/manual-source pattern (like `exposureLevelSource`): EL derived from the
  boundary the connection crosses, manually overridable.

### 2.1 What genuinely does NOT come from the risk engine

Approach A's Clause 7 also carries **baseline product requirements** that are not
risk-derived and apply regardless of SRSL:

- 7.3 Information collection — tracing log of interventions, evidence content,
  storage ≥ 5 years (7.3.4), tamper protection (7.3.5).
- 7.5 Identification of software versions and configuration (human-readable, on
  demand).

These are a static checklist, closer to the Compliance-feature style than the
risk engine. See §6 for the scope decision.

### 2.2 Output model — SRSL primary, R=I×L secondary (DECIDED)

- [x] **Decided (Output Model C):** an `en-50742-a` project produces **both**
  outputs, but **SRSL is the authoritative one** and R=I×L is a secondary
  TARAflow lens.
  - **SRSL0–3** — the normative Approach-A output, via the literal Table B.6
    lookup `(AP band × severity)`. This is what the report, the traceability
    chain, and the protection-requirement selection (§5) run on. It is *not* a
    likelihood and *not* R=I×L — it already folds in severity.
  - **R = I × L** — kept as TARAflow's native risk number so this project still
    populates the risk matrix / dashboard / cross-project comparison. Here L is
    the AP-band mapped onto the project likelihood scale (natural polarity:
    AP4 → highest likelihood), I is the impact factors as usual.

**Warning — the two axes can disagree in ordering, by design.** R=I×L is a
*smooth product*; SRSL=TableB.6(band, severity) is an *irregular lookup* (AP2 →
SRSL1/2/3 depending on severity, §3.5). So R may read "medium" while SRSL reads
"SRSL3". Do **not** try to make R=I×L reproduce SRSL — they are two deliberately
different combination rules over the same two axes (severity, AP band). Surface
both, label SRSL as the governing one, and let them differ.

### 2.3 Dedicated calculation function (DECIDED)

- [x] **Decided:** EN 50742 gets its **own** `calculateEN50742RiskValues`
  function, **not** a branch inside the generic `calculateRiskValues` and **not**
  a third case in `scoreTableLikelihood`. Reasons:
  - the aggregation is `(EL × WoO) + AC` with WoO as a **multiplier** (0.6–1.0),
    which `sumScoreTablePoints` (pure additive) structurally cannot express;
  - it needs two inputs the generic signature does not carry: **WoO** (project-
    global config, §3.3) and **severity** (from the linked safety-function
    asset, §3.6) — neither lives in `ratings`;
  - it emits an extra output (SRSL) that `RiskCalculationResult` does not model.

  Signature (shape): `(ratings, configuration, severity) → { impact, likelihood,
  risk, srsl }`, where `configuration` now carries `windowOfOpportunity` and
  `severity` is resolved from the linked asset by the caller. Internally it calls
  the core's `computeAttackPotential` → `{ score, band }`, then
  `bandForAttackPotential`/`determineSrsl`. AC is the only truly *rated* factor;
  EL is a **derived** rating (§3.2); WoO is config, not a factor.

  Consequence for the preset: `en-50742-a.likelihoodFactorIds` becomes
  `[attacker_capability, exposure_level]` — **WoO is removed as a per-risk
  factor** (see §4).

---

## 3. Open points to clarify (decide before coding)

### 3.1 Flat per-threat AP vs. attack-tree aggregation — biggest one

The norm computes AP **flat, per threat / per (safety function, interface)** — it
has no attack-tree AND/OR aggregation anywhere (Annex C uses a flat STRIDE threat
table). So for a faithful Approach A, AP is a per-threat computation, and the
Attack Tree tab is **optional**, not on the critical path.

**Decided:** the AttackTree tab is **central only for ISO 21434**, and
**optional for EN 50742** — EN 50742 uses the flat per-threat AP as its primary
likelihood path. If attack trees are used anyway on an EN 50742 project (a
project may want them), the polarity is inverted vs. the ISO effort model, so
aggregation must be:

```
OR-Node:  MAX(AP)   ← attacker takes the most-likely alternative path
AND-Node: MIN(AP)   ← the least-likely necessary step gates the chain
```

- [x] **Decided:** EN 50742 AP is a flat per-threat factor; attack trees optional
  for EN 50742, central for ISO 21434. The `en-50742-a` preset does not require
  the AttackTree tab.

### 3.2 EL source in the DFD (DECIDED)

- [x] **Decided:** EL is authored on **trust boundaries, interfaces, AND data
  flows** (all three carry it in the current DFD model) and is resolved onto each
  threat by a **dedicated step** `resolveExposureLevelForThreat` — separate from
  the impact prefill (`applyAssetCriteriaToFactorRatings`), because EL comes from
  boundaries/flows, not from asset impact criteria. The resolved value is written
  as an `exposure_level` rating with `source="derived"` and is **manually
  overridable** (mirroring the derived/manual pattern).

**Resolution rule — local, higher-EL-wins, NOT transitive.** For a given threat,
`EL = MAX` over the EL-carrying elements the threat's location **itself** touches:

| Threat kind | EL used |
|---|---|
| per-interaction / data-flow threat | `MAX(DF's own EL, EL of boundaries this DF crosses)` |
| per-element threat on an interface | `MAX(interface's own EL, EL of the boundary it is exposed through)` |
| per-element threat, internal element with no external interface | EL0 → `AP = (0×WoO)+AC = AC` → low band → typically SRSL0 (the "isolated safety function", §3.9) |

The trust boundary's EL is **never applied to a threat directly** (boundaries are
not STRIDE elements). It propagates into the DF/interface that crosses or sits on
it, and *wins* when it is the highest **local** source. Critically, higher-EL-wins
applies only to boundaries the element/flow **itself** crosses — **not** the whole
upstream chain. Otherwise every element behind a Public boundary would inherit
EL4 and zoning would be meaningless: a DF that stays internal after crossing one
public boundary keeps its local (internal) EL. EL measures *direct* attack
surface, not multi-hop reachability.

> **VERIFY:** prEN 50742:2025 is a Draft and Annex C.7 does not fully spell out
> the flat-DFD resolution (boundary label vs. flow/interface EL). The local,
> non-transitive higher-EL-wins rule above is TARAflow's engineering
> interpretation; confirm against the final norm.

### 3.3 WoO is machinery-global (DECIDED)

- [x] **Decided:** WoO is a single **project-global** field on the Security
  Context, entered in the **Overview tab** and stored on `project.info` (it is
  fachlicher Input, not a tool setting, so `info` over `settings`). It is
  **not** a per-risk factor. The value is threaded to the risk engine via
  `RiskConfiguration.windowOfOpportunity` (set by the preset orchestrator when
  the Overview value changes — same write path as the tag→preset wiring), and
  read by `calculateEN50742RiskValues` (§2.3). Changing WoO recomputes AP/SRSL
  for **all** `en-50742-a` risks. (Norm: "estimated for the whole machinery",
  line 578.)

  **Implemented.** `WindowOfOpportunitySelector` (Overview tab, dropdown,
  self-hides outside `en-50742-a`) feeds `project.info.windowOfOpportunity` →
  `applyRegulationFromTags()` → `threadWindowOfOpportunity()` →
  `RiskConfiguration.windowOfOpportunity`, wired from both the General-tab and
  Risks-tab update handlers in `workspace-layout.tsx`. Pure/idempotent — returns
  the same `Project` reference when nothing changed. The type + Table B.3
  multipliers (`WindowOfOpportunity`, `WINDOW_OF_OPPORTUNITY_MULTIPLIERS`,
  `WINDOW_OF_OPPORTUNITY_OPTIONS`) live in `shared/models/regulation-preset.ts`,
  not in `en50742-approach-a-core.ts` — the Overview feature needs to read/write
  WoO without a risks↔overview import cycle (same reasoning as the preset id
  itself, §0 note at the top of `regulation-preset.ts`).

  > **Known gap:** `en50742-approach-a-core.ts` and `risk-config-types.ts`
  > still reference a **locally-declared** `WindowOfOpportunity` instead of the
  > shared one. Same string-literal shape, so it compiles and behaves
  > identically today — but it's two sources of truth for one norm value.
  > Consolidate: have `en50742-approach-a-core.ts` import the type (and ideally
  > the multiplier table) from `shared` and drop its local copy.

### 3.4 AP precision / band boundaries

WoO is fractional, so `EL×WoO` is fractional (e.g. 16×0.6 = 9.6). Bands split at
5.0/5.1, 10.0/10.1, etc.
- [ ] Fix a rounding/precision rule so values on a boundary land deterministically
  (norm gives one-decimal bands; the worked example is exact).

### 3.5 Table B.6 as a literal lookup

- [ ] Confirm Table B.6 is hardcoded (AP × {reversible|non-reversible} → SRSL),
  not derived from the numeric risk matrix (the steps are irregular).

### 3.6 Severity entry

- [x] **Decided:** 3-level manual severity per safety-function asset —
  `reversible / non-reversible / fatal` — with optional SIL/PLr annotation for
  the report. TARAflow is not a functional-safety tool, so it does not compute
  SIL/PLr. The `fatal` SRSL-lookup row (§1.3) is **confirmed** — no open items
  remain.

### 3.7 Cardinality: per (safety function × interface)

- [ ] One safety function reachable via N interfaces → N SRSL determinations
  (one per interface, each with its own protection-requirement set on that
  interface). Confirm the asset-relation model carries an SRSL per
  (safety-function asset, interface asset) pair.

### 3.8 What happens after SRSL — requirement-driven, NOT discretionary (DECIDED)

This is the second fundamental break from the standard risk flow. Standard-Risk:
threat → assess → analyst **freely selects** mitigations → residual. Approach A:
(safety function × interface) → SRSL → the SRSL row of the **Clause 7.4.3
catalogue (§5) DICTATES** the protection requirements. Not a menu — a mandate.

- [x] **Decided:** SRSL → `requirementsForSrsl(srsl)` (already in the core)
  produces the required protection requirement per category (Authentication,
  Authorization, Software/Info Integrity, Boot Integrity, Info-exchange Integrity,
  Input Validation, Physical Tampering, SRESW/SRASW Authenticity). The analyst's
  job is to **demonstrate each required control is implemented and verified**, not
  to pick controls to reduce a number.

Two semantics that invert vs. standard risk:

1. **SRSL is not "mitigated down."** It is a *target* level (like SL-T in
   IEC 62443), derived from inherent AP × severity. Adding controls **satisfies**
   the SRSL; it does not lower it. What lowers SRSL is **elimination** (Fig 1,
   2.A) — e.g. removing an interface → EL drops → AP drops → SRSL re-derived. That
   is a design change on the **input**, not an in-place countermeasure that
   re-rates likelihood.
2. **Unmet requirement → compensating countermeasure** (2.C), documented as a
   claim in information-for-use (avoidance / acceptance / sharing).

**Reuse, don't rebuild:** the SRSL-mandated requirements reuse TARAflow's
mitigation / control-instance / verification infrastructure
(`verification_method` / `verification_status`). The only difference is
**provenance** — SRSL-mandated, not analyst-selected. In the Risk tab they should
appear as pre-determined control rows to verify, **not** in the free mitigation
picker. Mapping to existing types: elimination ≈ removal (re-derives EL/AP);
required protection requirement ≈ a mandated control to verify;
compensating-countermeasure-by-user ≈ a claim in information-for-use.

### 3.9 SRSL0 special case

- [ ] SRSL0 emerges from AP0 in Table B.6, but Table 2 also describes it as
  "completely isolated safety function (no external interfaces)". Decide whether
  SRSL0 is purely AP-driven or also gated on "no external interfaces".

### 3.10 7.4.3.4.2 wording quirk (carry faithfully)

The norm's boot-integrity SRSL2 ("protected and verified at startup") reads
weaker than SRSL1 ("... e.g. checksums"). Reproduce the catalogue as written;
do not "fix" it.

---

### 3.11 Preset factor lock — the norm tag is a conformance claim (DECIDED)

While a norm tag is set, the project asserts "I follow this method". The
likelihood factors ARE the method (EL/WoO/AC for Approach A), so they are **not
negotiable** while the tag is present. Two honest states only:

1. **Conformant** — tag set, factors = preset. Deviation is not allowed.
2. **Deliberately deviating** — the analyst removes the norm tag; the project
   falls back to `standard` (weighted-mean) and factors become freely editable.

What must never exist: tag set (= "EN 50742 A conformant") AND factors deviating
— a silent false claim in the report.

- [x] **Decided (enforcement = A2, lock + hint):** the Risk config dialog
  **locks factors** while a score-table preset is active, rather than allowing a
  toggle and snapping it back (A1, which reads as a broken control). The lock has
  **two modes** — the norm decides which:
  - **`method` (EN 50742-a):** norm factors (EL/AC) locked ON; other regimes'
    likelihood factors locked OFF; **impact + custom factors stay EDITABLE.** The
    authoritative output (SRSL) uses asset severity, so impact factors feed only
    the secondary R=I×L lens and cannot corrupt the norm result. (Per-risk
    `window_of_opportunity` is NOT a target — WoO is project-global now, §3.3 —
    so it stays locked OFF like any other non-target regime factor.)
  - **`exclusive` (ISO 21434, ETSI TVRA):** **only the norm factors are active;
    everything else is locked OFF, impact factors included.** These methods have
    no decoupled second output — the method IS the result — so no free factor may
    enter.
  - **`none` (standard, en-50742-b):** nothing locked.
  - In both locking modes: target factors → checked + locked; weight sliders on
    score-table factors → disabled (the per-level point table IS the weighting,
    cores design §2b); a banner explains the lock and the escape hatch ("remove
    the {norm} tag in the Overview — the current likelihood ratings will be
    cleared").

  > **Consequence of `exclusive`:** with all impact factors off, impact can no
  > longer come from impact-factor ratings — it **must** come from asset-impact
  > (`useAssetImpact`), or R = I × L = 0. This is ISO-correct (impact from the
  > damage scenario / SFOP, not OWASP factors), but ISO/TVRA projects therefore
  > require `useAssetImpact = true`. Enforce or validate when the ISO/TVRA calc
  > is built.

  Pure helpers (`regulation-preset-service.ts`): `presetFactorLock(presetId)` →
  `{ mode, targets, lockedLikelihood }` drives the dialog; `factorLockState(id,
  lock)` → `locked-on | locked-off | editable` per factor;
  `detectPresetFactorDrift(activeFactors, presetId)` is the backstop predicate
  (in `method` mode only foreign regime likelihood counts as drift; in
  `exclusive` mode any enabled non-norm factor does).

**Consequence — the two-layer model.** With the UI locking factors per mode
(§3.11 above), interactive drift can no longer originate. The service layer is the
**backstop** for non-interactive paths (import, migration, legacy projects):
`detectPresetFactorDrift` reports drift per mode — in `method` mode a disabled
norm target or an enabled foreign *regime likelihood* factor; in `exclusive` mode
a disabled norm target or *any* enabled non-norm factor — and the reconcile
repairs it silently, which is correct when no human is toggling. (In `method`
mode the reconcile must NOT strip impact/custom factors — they are legitimately
editable; only norm-likelihood conformance is enforced.)

**Escape hatch = method change.** Removing the last norm tag flips the method to
`weighted-mean`, which **clears the score-table likelihood ratings** (EL/WoO/AC
are meaningless under weighted mean — cores design §6). So "remove tag" must run
through the method-change confirmation flow (rating reset with confirmation),
not silently.

**Pure helpers (in `regulation-preset-service.ts`):**
- `lockedLikelihoodFactorIds(presetId)` → `{ locked, lockedOn }` drives the
  dialog's disabled state (only the norm factors). `locked=false` for
  weighted-mean presets (standard, en-50742-b) → nothing locked.
- `detectPresetFactorDrift(activeFactors, presetId)` → `{ drifted,
  disabledTargets }` — the ONLY conformance-breaking deviation is a norm factor
  turned OFF; added factors are not drift. Backstop for `handleRisksUpdate` /
  import.

### 3.12 Tag split: "EN 50742 A" / "EN 50742 B" (DONE)

§3.11 above was written when there was a single `EN 50742` tag. It has since
split into two, mirroring Clause 4.1's real structure:

- **`EN 50742 A`** — this document's method. Selects the `en-50742-a` preset
  (the "norm tag" §3.11 talks about) and therefore locks factors in the Risk
  config dialog.
- **`EN 50742 B`** — Clause 8 compliance subset (§8, out of scope here).
  Selects `en-50742-b`, which is `weighted-mean` with no
  `likelihoodFactorIds` — **no factor lock**, the default TARAflow factors
  apply unchanged.
- The two tags are **mutually exclusive** (`tagConflicts.en50742Approach`
  fires a soft warning if both are set on one project — consistent with §3.11's
  "two honest states only," now enforced per-approach instead of per-norm).
- Both tags still force the Hazard tab (`requiresHazardAnalysis`) — Approach B
  needs it too, even without an AP/SRSL computation, since it shares the safety
  severity axis with Approach A's asset model.

`regulationPresetFromTags()` resolves the preset directly from these tag
strings (normalized, punctuation/case-insensitive — `"EN 50742 A"`,
`"EN50742_A"`, `"EN 50742 Approach A"` all resolve the same way). A bare
`"EN 50742"` tag with no approach suffix defaults to Approach A.

## 4. `en-50742-a` preset

| Field | Value |
|---|---|
| `id` | `en-50742-a` |
| `likelihoodMethod` | `en50742-attack-potential` (distinct from ISO 18045 sum; own function §2.3, not the score-table sum path) |
| `likelihoodFactorIds` | `attacker_capability` (rated, per threat), `exposure_level` (**derived** from DFD, §3.2, manual override). **WoO removed** — it is project-global config (§3.3), not a per-risk factor. |
| `windowOfOpportunity` | project-global, on `project.info` (Overview / Security Context); threaded via `RiskConfiguration.windowOfOpportunity` (§3.3) |
| `motivationModel` | `not-applicable` — benefit/motivation must NOT enter (line 241: "the likelihood of being a target/victim shall not be relevant") |
| `severityAxis` | 3-level `reversible | non_reversible | fatal` on the safety-function asset (from safety assessment; `fatal` is a TARAflow extension, §1.3, §3.6) |
| `riskOutput` | **primary:** `SRSL0..SRSL3` via literal Table B.6 lookup `(AP band × severity)`. **secondary:** `R = I × L` with L = AP band on the project likelihood scale (Output Model C, §2.2 — SRSL governs; the two may diverge in ordering by design). |
| `srslProfile` | §5 |
| `complianceProfile` | absent (that is `en-50742-b`) |
| `hazardSwitch` | forced active (see §7.1) |
| `normativeBasis` | `"prEN 50742:2025 (Draft), Clause 7.4.2/7.4.3, Annex B"` |

> Correction to `regulation-presets-design.md` §10.5: `motivationModel` for
> `en-50742-a` should be `not-applicable`/feasibility-only, not
> `feasibility-supplement` — Clause 4.3 explicitly forbids likelihood-of-being-
> targeted from entering the assessment. Confirm and align the preset table.

---

## 5. `SRSLProfile` — Clause 7.4.3 protection-requirement catalogue

Tiered per SRSL0–3, grouped by category. Statements below are condensed to
implementation form; the authoritative wording is prEN 50742:2025 Clause 7.4.3.

**7.4.3.2.1 Authentication**
- SRSL0: none
- SRSL1: entities authenticated
- SRSL2: entities authenticated
- SRSL3: entities **uniquely** authenticated

**7.4.3.3.1 Authorization enforcement**
- SRSL0: none
- SRSL1: interventions require authorization
- SRSL2: interventions require authorization
- SRSL3: interventions require authorization with specific privileges (e.g. RBAC)

**7.4.3.4.1 Software & information integrity**
- SRSL0: none
- SRSL1: integrity verified at startup (e.g. checksums)
- SRSL2: integrity verified at startup and periodically (e.g. checksums)
- SRSL3: integrity **cryptographically** verified at startup and periodically (hashes, HMACs, CMACs)

**7.4.3.4.2 Integrity of boot process**
- SRSL0: none
- SRSL1: boot integrity protected + verified at startup (e.g. checksums)
- SRSL2: boot integrity protected + verified at startup
- SRSL3: secure boot (crypto signature verification with trusted roots; rollback or safe state on failure)

**7.4.3.4.3 Information exchange integrity**
- SRSL0: none
- SRSL1: integrity of exchanged information verified
- SRSL2: integrity of exchanged information verified
- SRSL3: guaranteed by secure cryptographic protocols that detect and reject modified/replayed messages

**7.4.3.4.4 Input data validation**
- SRSL0: none
- SRSL1: validate against defined boundaries; reject invalid
- SRSL2: validate rigorously (syntax, semantics, format, data-type); reject invalid
- SRSL3: validate rigorously with strict context-aware checks (syntactic, semantic, boundary, protocol-specific); reject invalid

**7.4.3.4.5 Physical tampering**
- SRSL0: none
- SRSL1: physical tampering detected (e.g. seal breaking)
- SRSL2: physical tampering detected
- SRSL3: physical tampering detected

**7.4.3.5.1 Authenticity of SRESW/SRASW**
- SRSL0: none
- SRSL1: none
- SRSL2: authenticity of critical data (SRESW/SRASW, critical config) verified via crypto signatures or equivalent at installation time
- SRSL3: as SRSL2

Data shape:

```ts
// per (safety function, interface) the determined SRSL selects the row;
// each category yields the requirement(s) for that tier.
type SrslTier = "SRSL0" | "SRSL1" | "SRSL2" | "SRSL3";
interface SrslRequirement {
  clause: string;          // "7.4.3.4.1"
  category: string;        // "Software & information integrity"
  tiers: Record<SrslTier, string | null>;  // null = "none"
}
type SRSLProfile = SrslRequirement[];
```

---

## 6. Baseline (non-risk-derived) Approach A requirements

Scope decision needed. These apply regardless of SRSL and are a static checklist,
not a risk output:

- 7.3.1–7.3.5 Tracing log: which interventions to log, evidence content,
  storage ≥ 5 years, tamper protection, authorized-only deletion.
- 7.5 Identification of software versions and configuration on demand,
  human-readable.
- 9 Information for use: security context, software/config identification,
  permission/prohibition of modifications.

- [ ] **Decide:** include as a fixed Approach-A checklist in the report now, or
  defer to the Compliance-feature checklist engine. Recommended: a small static
  section in the Approach-A report (they are few and fixed), independent of the
  SRSL loop.

---

## 7. Phased implementation

### 7.1 Phase 1 — Preset infrastructure + Hazard switch
- Build the preset core (`regulation-presets-design.md` §2–§7): `RegulationPresetId`,
  `RegulationPreset`, `REGULATION_PRESETS`, `ProjectSettingsData.regulationPreset`,
  Overview selector, non-destructive apply (Class-B on downgrade).
- Tag `EN 50742 A` / `EN 50742 B` selected → **Hazard Slide Switch forced active**
  (Approach A cannot be evaluated without the severity axis). Auto-enable pattern
  like `updateSafetyFactorAutoEnable`; wire the safety layer (`safetyRelevant` +
  3-level severity criterion: reversible / non-reversible / fatal).

  **[DONE]** `SafetyAnalysisToggle` (`requiresHazardAnalysis`) forces the switch
  on for either tag, tag-locked and disabled while forced. It now also
  **releases** the lock on the forced→not-forced transition (reset to off when
  the last forcing tag is removed) instead of leaving a stale "on" no tag backs
  — a manually-enabled switch with no forcing tag is left untouched. The
  3-level severity criterion (§3.6) is tracked separately; see Phase 2.

### 7.2 Phase 2 — Asset tab
- Safety function = asset; add the 3-level severity criterion (reversible /
  non-reversible / fatal), optional SIL/PLr note.
- Interface = asset; EL property (derived from trust-boundary crossing, manual
  override).
- Asset-relation carries the (safety function × interface) pairing that an SRSL
  attaches to (§3.7).

### 7.3 Phase 3 — Likelihood (AP)
- **Dedicated** `calculateEN50742RiskValues` (§2.3), not a branch in the generic
  calc and not a score-table case: `AP = (EL × WoO) + AC` via the core's
  `computeAttackPotential`; band via Table B.5.
- WoO entered in the Overview tab (`project.info`), threaded via
  `RiskConfiguration.windowOfOpportunity` (§3.3). EL resolved by a dedicated step
  `resolveExposureLevelForThreat` → `exposure_level` derived rating (§3.2).
  AC per threat, rated in the Risk dialog. Precision rule (§3.4).

  **[DONE]** WoO-in-Overview half of this bullet — see §3.3 for the
  implementation. `resolveExposureLevelForThreat` and the precision rule
  (§3.4) are not covered by this status update; verify separately.
- Flat per-threat (attack trees optional; if used, OR=MAX/AND=MIN — §3.1).
- Level registry on `en50742-approach-a-core.ts` (factorId → ordered levels),
  analog to the ISO/TVRA cores, so the rated factors map level-index → enum.

### 7.4 Phase 4 — Risk tab (SRSL + requirements)
- **SRSL primary output** via literal Table B.6 lookup (AP band × severity);
  R=I×L kept as secondary lens (Output Model C, §2.2 — they may diverge).
- `SRSLProfile` (§5) drives the required protection-requirement set per determined
  SRSL, per (function, interface) — **requirement-driven, not discretionary**
  (§3.8): rendered as pre-determined control rows to verify, not the free
  mitigation picker; verification reuses `verification_method`/`verification_status`.
- Residual/compensating mapping (§3.8).

### 7.5 Phase 5 — Report (Approach A evidence)
- Per (safety function, interface): severity + source, AP (EL, WoO, AC, formula,
  band), SRSL, the SRSL-required protection requirements with verification status.
- Baseline checklist (§6).
- Methodology section with `normativeBasis`; optionally surface the Annex ZZ
  mapping (which clauses give presumption of conformity to Regulation (EU)
  2023/1230, Annex III 1.1.9 / 1.2.1 a) / f)).
- Full traceability: `measure → threat → STRIDE → safety function → severity →
  interface → EL/WoO/AC → AP → SRSL → protection requirement (7.4.3)`.

### 7.6 Phase 6 — ISO 21434 on the same rails
- Instantiate `iso-21434` preset; fold in the `Modus_21434` todo (Threat-tab
  columns, 18045 5-factor leaf form, SFOP severity, cybersecurity goals/claims,
  WP-15 output). Confirms the infrastructure generalizes.

---

## 8. Out of scope

- **Approach B** (`en-50742-b`): Clause 8, IEC 62443-3-3/-4-2 fixed subset
  (Tables 3/4), system/component role, `ComplianceProfile`, compensating-
  countermeasure/SL-C reduction (8.3), persistency (8.5). Delivered by the
  Compliance feature (`taraflow-compliance-architecture.md`); this document does
  not restate it.
- No new calculation math beyond the AP formula + Table B.6 lookup.

---

## 9. Effort

| Area | Phase | Effort | Note |
|---|---|---|---|
| Preset infra + Hazard switch | 1 | medium | shared with ISO 21434 |
| Asset tab (severity + EL) | 2 | small–medium | both are assets already |
| Likelihood (AP) | 3 | medium | new method + precision + polarity |
| Risk tab (SRSL + SRSLProfile) | 4 | medium–large | Table B.6 lookup + catalogue content |
| Report | 5 | large | full Approach-A evidence path |
| ISO 21434 fold-in | 6 | medium | rides 1–5 |

---

## 10. Definition of Done — EN 50742 Approach A compliant

A project with preset `en-50742-a` can:
1. mark safety functions and interfaces as assets, with severity (reversible /
   non-reversible / fatal) and EL respectively;
2. set the machinery-global WoO and per-threat AC;
3. compute `AP = (EL × WoO) + AC` and band it (Table B.5);
4. derive the SRSL per (safety function, interface) via Table B.6;
5. select and verify the SRSL-required protection requirements (Clause 7.4.3);
6. produce a report with the baseline checklist (7.3/7.5/9), full traceability,
   and `normativeBasis`.

---

<sub>© Jürgen Messerer · 2026 · All rights reserved. Normative content derives
from prEN 50742:2025 (Draft for Enquiry); authoritative wording is the standard.</sub>
