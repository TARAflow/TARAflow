# TARAflow — ISO/SAE 21434 TARA Support Design

> Scope: how TARAflow supports **ISO/SAE 21434 TARA activities (Clause 15) and
> their traceable work products**, driven by the `iso-21434` regulation preset.
> This is deliberately **not** a claim of full ISO/SAE 21434 compliance — see §1.
>
> This document covers the **structural** ISO layer: the damage-scenario framing,
> generator configuration, the STRIDE-per-element ↔ attack-tree centrality, the
> Risk-dialog ISO section, treatment/residual, and the report/traceability. It
> rides the **same preset rails** as EN 50742 A (`en-50742-approach-a-design.md`)
> and the **same likelihood core** in `regulation-likelihood-cores-design.md` §4.
>
> Normative source: ISO/SAE 21434:2021. Clause references are condensed to
> implementation form; the standard is authoritative.

---

## 0. Verification provenance (read this first)

The `EXISTING` claims in this document were checked against the actual source of
branch `feature/iso21434_support` in a code pass, **not** inferred from the README
or from an earlier draft. This matters because an earlier revision of this doc
made a wrong claim (see DS-1) that only surfaced by reading `asset-types.ts` /
`asset-security-goals-types.ts` / `asset-impact-resolver.ts` directly. Two
consequences:

- Where this doc says `EXISTING (verified)` it names the file/symbol so it can be
  re-checked.
- This is a **point-in-time** read. Re-verify before implementing — the branch moves.

The single biggest finding: **the (asset × security-goal) = damage-scenario impact
model is already substantially built** (opt-in, ISO-21434-framed). The ISO work is
far more "surface + wire + label" and far less "design a new data model" than
either this doc's first draft or the external review assumed.

---

## 1. ISO scope boundary — TARA, not compliance (DECIDED)

ISO/SAE 21434 spans governance, culture, planning, item definition, the
cybersecurity concept (Clause 9), requirements, verification/validation, the
cybersecurity case, production, and post-development / vulnerability management.
A tool cannot confer "compliance" by shipping a preset.

**What TARAflow supports:** the **TARA work products of Clause 15** —
asset identification, damage-scenario impact, threat-scenario identification,
attack-path analysis and feasibility, risk determination, and the **risk
treatment decision (15.9)** — plus their traceable evidence.

**Explicitly out of scope (do not claim, do not build as a subsystem):**
Clause 9 cybersecurity concept, cybersecurity goals/requirements as a managed
lifecycle, the cybersecurity case, and the process/governance clauses. A
lightweight *link stub* from a treatment to a cybersecurity-goal ID is the only
concession (DS-6) — not a Clause-9 subsystem.

This boundary is load-bearing: it is what keeps the ISO addition a precise
semantic layer over the existing chain rather than a GRC-tool rewrite.

---

## 2. The ISO 21434 model and how it maps onto TARAflow

ISO 21434 is asset-driven and bottom-up — exactly TARAflow's spine. The Clause 15
chain maps onto the existing structure with **no new analysis paradigm**:

| ISO 21434 concept                                                      | TARAflow — verified mapping                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Item definition, boundary, operational environment (15.3)              | Overview tab + DFD tab (make Scope/Assumptions explicit — DS-5)                                             |
| **Asset** (object with a cybersecurity property; 15.3)                 | `Asset` (DFD-anchored; `securityGoals: SecurityGoal[]` = C/I/A/N/AuthZ/AuthN/Acc) — `asset-types.ts`       |
| **Damage scenario** (compromise of a cybersecurity *property*; 3.1.22/3.1.24), impact over categories (15.5) | **(asset × security goal)** with per-goal impact — `SecurityGoal.impactRatings?` + `asset-impact-resolver.ts` (DS-1) |
| Impact categories S/F/O/P (15.5)                                       | `ImpactCategory` + `CRITERION_TO_CATEGORY` (`asset-impact-resolver.ts`); criteria already exist            |
| **Threat scenario** (3.1.29)                                           | STRIDE-per-element threat anchored to the asset/element                                                     |
| **Attack path** (3.1.2) + **attack feasibility** (15.7, Annex G)      | Attack tree = TARAflow's *representation* of the paths; feasibility per path; `iso21434-core.ts`            |
| Risk value = f(impact, feasibility) (15.8)                            | `R = I × L`, L = feasibility (ISO mode: **likelihood == feasibility**, `attacktree-feasibility.ts`)         |
| **Risk treatment decision** (15.9)                                    | `RiskTreatment` = eliminate/reduce/accept/transfer/share (`risk-scale-types.ts`); before/after risk exists |
| Work products WP-15-*                                                  | Report + traceability matrix (§6)                                                                           |

---

## 3. EXISTING → REQUIRED CHANGE → OPEN DECISION

The consolidated engineering picture, grounded in the code pass. This is the
section to act from.

| Area | Status | Detail (verified file/symbol) |
| --- | --- | --- |
| Asset-level impact | `EXISTING` | `Asset.impactRatings: ImpactRating[]` (`{criterionId, value}`), `overallImpact` via `calculateOverallImpact` (conservative MAX / average). `asset-impact-types.ts`. |
| **(asset × goal) damage-scenario impact** | `EXISTING (opt-in)` | `SecurityGoal.impactRatings?` — optional per-goal override; resolver `asset-impact-resolver.ts` (goal → asset fallback), explicitly ISO 3.1.22/3.1.24. Backward compatible, no migration. |
| SFOP impact categories | `EXISTING` | `ImpactCategory = safety\|financial\|operational\|privacy\|other`, `CRITERION_TO_CATEGORY` maps the 11 criteria onto ISO 15.5; per-category risk value sanctioned by 15.8 NOTE 1. Criteria `safety` (fixed ISO-12100 scale), `financial_damage`, `operational`, `privacy` all predefined. |
| ISO likelihood core | `EXISTING` | `iso21434-core.ts` (+ test) — 18045 5-factor sum, AP bands, feasibility. |
| Feasibility → likelihood | `EXISTING` | ISO mode `feasibility-only`: likelihood **is** feasibility (`attacktree-feasibility.ts` L122; `attacktree-feasibility-types.ts` L30). No lossy remap to version. |
| Attack-path aggregation | `EXISTING` | OR/ROOT → MAX (easiest path), AND → MIN (weakest link) — `attacktree-calculator.ts` L91-98/206-207. Correct polarity for the ISO effort model. |
| Threat ↔ attack tree link | `EXISTING` | Threat-anchored trees, `buildThreatId`, `build-attack-tree-likelihood-references.ts` flow-back (see DS-3). |
| Treatment / residual | `EXISTING` | `calculatedRiskBeforeMitigation` / `calculatedRiskAfterMitigation` / `treatment: RiskTreatment` — `risk-assessment-types.ts`; `RISK_TREATMENTS` = ISO 15.9 options. |
| Audit / reproducibility of the calc | `EXISTING` | TCS canonical serialization + signed commits + AVE already freeze & sign the whole `.tara.json` incl. factor values / AP / feasibility. This *is* the auditable record. |
| `exclusive` factor lock (ISO) | `EXISTING` | `presetFactorLock`→`exclusive`; all non-norm factors incl. impact off. Impact must then come from asset-impact (DS-4). |
| SFOP surfacing in ISO preset | `REQUIRED` | ISO preset seeds/labels the four SFOP categories and surfaces the goal-level override where relevant (small). |
| Per-interaction OFF for ISO | `REQUIRED` | Preset has **no** generator-toggle field today; per-interaction is a standalone module (`features/threats/.../per-interaction/`). Add preset-scoped generator activation (DS-2). Must not affect EN 50742 A / standard. |
| `useAssetImpact = true` enforced | `REQUIRED` | Consequence of `exclusive` lock; enforce/validate for `iso-21434` (DS-4). |
| ISO tree eval method + auto-link | `REQUIRED/OPEN` | Wire `iso21434-core` as the tree eval method under ISO; auto-spawn/entry-point scope open (DS-3). |
| Risk-dialog ISO section | `REQUIRED` | Feasibility factors + feasibility badge, impact read-only from asset-impact; mirror the EN 50742 SRSL section pattern (`risk-dialog.tsx`, `srsl-badge.tsx`). |
| `calcVersion` / `mappingVersion` stamp | `REQUIRED (small)` | Metadata beside the result for cross-run reproducibility. Not a missing audit architecture — an add-on to the existing one. |
| ISO report + traceability matrix | `REQUIRED` | §6; WP-15 evidence + coverage check. |
| Scope/Assumptions capture | `REQUIRED (small)` | Explicit Overview fields (DS-5). |
| Multiple named DS per (asset × goal) | `OPEN (deferred)` | The 1:n-damage-scenario strand (§11-Q1, "deferred for cost"). Not foundational — see DS-1. |
| CS-goal link stub | `OPEN (small)` | ID + `mitigates: DS/TS` at the treatment boundary only; not a Clause-9 subsystem (DS-6). |
| ISO-TARA readiness checker | `OPEN (🟡)` | Nice-to-have completeness gate (DS-5); not on the critical path. |

---

## 4. Architectural decisions

`[x]` DECIDED · `RECOMMEND` (my position) · `[ ]` OPEN.

### DS-1 — Damage-scenario impact: the model is already there (CORRECTED)

**Correction to this doc's first draft.** The earlier text — *"TARAflow already
binds impact to (asset × security goal)"* — was **wrong as a description of the
default**: impact defaults to **asset-level** (`Asset.impactRatings`, criterion-keyed,
aggregated into `overallImpact`). The external review flagged this correctly.

**But the review's proposed fix (build a new `DamageScenario[]` entity, or add a
`damageScenarioId` to `ImpactRating`) is also unnecessary** — because the code pass
shows the (asset × security-goal) impact locus is **already implemented, opt-in,
and explicitly ISO-framed**:

- `SecurityGoal.impactRatings?` — optional per-goal impact override. Comment
  verbatim: *"A damage scenario is the compromise of a cybersecurity property of
  an asset (ISO 21434 3.1.22)… this is where the impact of that damage scenario
  actually belongs."*
- `asset-impact-resolver.ts` — resolution order goal-override → asset fallback,
  category-preserving (`ImpactCategory`, `CRITERION_TO_CATEGORY`), citing ISO 15.5
  NOTE 2/3 and 15.8 NOTE 1 (per-category risk value). Backward compatible: absent
  override ⇒ today's asset-level behaviour; no migration.

So the "Variant A vs Variant B" data-model question is **moot** — the middle path
(per-goal ratings resolving over an asset fallback) is what exists.

**What genuinely remains for ISO is small and mostly surfacing:**

- [x] **DECIDED:** do **not** introduce a top-level `DamageScenario` entity. Use the
  existing `(asset × security goal)` + `SecurityGoal.impactRatings?` locus; ISO mode
  surfaces and labels it as the damage scenario.
- [ ] **OPEN (small):** does a damage scenario need its own **consequence text**, or
  does `SecurityGoal.formalDescription` suffice? Recommend a dedicated consequence
  field only if `formalDescription` is already used for something else.
- [ ] **OPEN (deferred, not foundational):** the review's location-data example
  (Confidentiality → DS-A Privacy-high *and* DS-B Safety-high as **two named
  scenarios → two risks**). One goal's `impactRatings?` already carries **multiple
  categories at once** (Privacy *and* Safety on the same goal), which covers the
  *per-category* reading ISO 15.8 NOTE 1 sanctions. What it does **not** give is two
  *separately named* damage scenarios yielding two separate risks — and that is
  exactly the already-parked **1:n damage-scenario strand (§11-Q1, "deferred for
  cost")**. Treat it as that same deferred item, not a new blocker.

### DS-2 — STRIDE-per-interaction OFF for ISO, preset-scoped (DECIDED)

Methodically right to drop per-interaction for ISO (combinatorial boundary-crossing
generator, poor fit for the asset→DS→threat-scenario chain). No DataFlow coverage
lost — per-element on DataFlow already emits `[T, I, D]`.

- [x] **DECIDED:** preset-scoped, **not** global. EN 50742 A *uses* per-interaction
  for EL on the crossing DataFlow (`en-50742-approach-a-design.md` §11.1); a global
  toggle would break it.
- [ ] **OPEN (verified as genuinely new):** the preset carries **no**
  generator-activation field today. Add one (e.g. `disabledThreatGenerators` on
  `RegulationPreset`); `iso-21434` disables per-interaction, `en-50742-a`/`standard`
  keep it.

### DS-3 — STRIDE-per-element ↔ attack-tree connection (mostly EXISTING)

Verified present: threat-anchored trees, `buildThreatId`, the
`build-attack-tree-likelihood-references.ts` flow-back, and OR=MAX/AND=MIN path
aggregation (`attacktree-calculator.ts`). So the "connection" and the
"path→feasibility aggregation" the review thought were missing **exist**.

- [ ] **OPEN — confirm which piece is actually wanted:**
  - **(c) eval method** — wire `iso21434-core` as the tree evaluation method under
    `iso-21434` (`feasibility-only` likelihood model already exists).
  - **(d) flow-back** — confirm the likelihood-reference bridge carries ISO
    feasibility (believed yes).
  - **(a)/(b) UX** — auto-spawn a stub tree per STRIDE-per-element threat, and/or a
    "create tree from threat" entry point. This is the only part with real new
    surface; scope it explicitly (small vs large).
- **RECOMMEND:** (c)+(d) are correctness and likely near-done; (a)/(b) is UX on top.

### DS-4 — `exclusive` ⇒ `useAssetImpact` mandatory (DECIDED, load-bearing)

`iso-21434` runs the `exclusive` factor lock → all impact factors off → impact
must come from asset-impact, else `R = I × L = 0`.

- [x] **DECIDED:** require `useAssetImpact = true` for `iso-21434`; enforce or
  hard-validate when the ISO calc path is wired. This is *why* DS-1's impact
  surfacing leads the phase order.

### DS-5 — Item definition / scope as explicit input (RECOMMEND)

- [ ] **RECOMMEND:** capture Item definition / boundary / assumptions / operational
  environment as explicit Overview fields (today implicit). A **readiness checker**
  (item def present, boundary set, DFD exists, assets mapped) is **🟡**, not a
  blocker — build after the core chain.

### DS-6 — Cybersecurity goals: link stub only, not a subsystem (DECIDED)

Reconciles the review's internal tension (its point 4 warns against Clause-9
overreach; its point 3 asks for a full CS-goal subsystem). CS goals/requirements
are **Clause 9 (Concept)**, outside the Clause-15 TARA scope of §1.

- [x] **DECIDED:** at most a lightweight **link stub** at the treatment boundary — a
  `cybersecurityGoalId` with `mitigates: [DS/TS ids]`, surfaced in the report for
  traceability. No goal/requirement lifecycle, no verification subsystem. Reuse the
  existing mitigation/claim model for everything else.

### DS-7 — Risk output: `R = I × L`, no SRSL (DECIDED)

- [x] **DECIDED:** ISO has no SRSL and no secondary lens — the method *is* the
  result. L = feasibility on the project likelihood scale; I = asset SFOP impact.
  No new combination rule (unlike EN 50742's Table B.6). The `Risk` type's
  `calculatedSrsl?`/`calculatedApBand?` stay `undefined` for ISO risks.

---

## 5. Phased implementation

Order follows DS-4 (impact first, else risk = 0).

1. **Phase 1 — Damage-scenario surfacing + SFOP (DS-1, DS-4).** Seed/label the four
   SFOP categories in the `iso-21434` preset; surface the `SecurityGoal.impactRatings?`
   override in ISO mode; enforce `useAssetImpact`. Optional consequence field.
   *Mostly surfacing over existing code — small.*
2. **Phase 2 — Preset-scoped generator config (DS-2).** Add generator activation to
   `RegulationPreset`; ISO disables per-interaction; verify EN 50742/standard
   untouched. *Small, independent — safe to start first.*
3. **Phase 3 — ISO likelihood via tree (DS-3 c/d).** Confirm `iso21434-core` as tree
   eval method; confirm ISO feasibility flow-back. *Medium, mostly confirmation.*
4. **Phase 4 — Risk-dialog ISO section.** Feasibility factors + badge, impact
   read-only from asset-impact; mirror the EN 50742 SRSL section. *Medium.*
5. **Phase 5 — ISO tree-centrality UX (DS-3 a/b).** Auto-spawn / entry point, if in
   scope. *Small–large per DS-3 answer.*
6. **Phase 6 — Report + traceability (§6), treatment→residual trace, calcVersion
   stamp, scope capture.** *Large.*

---

## 6. Report: traceability matrix as a coverage check

Not merely a static ISO-mapping table — a **coverage test over the actual chain**
(the review's refinement, adopted). For each risk, walk and assert each link
resolves; a broken link is a reported finding, not a silent gap:

```
AS (Asset) → DS (asset × goal + SFOP impact) → TS (STRIDE threat)
   → AP (attack-tree path) → AF (feasibility, 18045) → Risk (I×L)
   → RT (treatment decision, 15.9) → RR (residual, risk-after)
```

- **ID scheme:** `AS-` / `DS-` / `TS-` / `AP-` / `AF-` / `RT-` / `RR-` (+ optional
  `CSG-` link stub, DS-6).
- **Matrix columns:** ID · ISO concept · TARAflow object · status (resolved / missing
  link). The "missing link" rows are the ISO-TARA completeness signal (the 🟡 readiness
  checker, DS-5, is the interactive version of the same check).
- **Reproducibility:** stamp each feasibility result with `method` / `calcVersion` /
  `mappingVersion` (small metadata add; the TCS/AVE audit layer already freezes and
  signs the underlying values).
- **Methodology section:** `normativeBasis = "ISO/SAE 21434:2021"`, the 18045 factor
  tables, the feasibility=likelihood convention, and the impact-category mapping
  (`CRITERION_TO_CATEGORY`).

---

## 7. Open questions (post code-pass — trimmed)

Most of the first draft's open items were resolved by reading the code. What remains:

1. **DS-1:** dedicated consequence field, or reuse `SecurityGoal.formalDescription`?
   *(Phase 1)*
2. **DS-1:** confirm the 1:n named-damage-scenario case is deferred (= §11-Q1), not
   in this pass. *(scoping)*
3. **DS-3:** which of eval-method / flow-back / auto-spawn / entry-point is actually
   wanted? *(scopes Phases 3 & 5)*
4. **DS-2:** field shape for generator activation on `RegulationPreset`. *(Phase 2)*
5. **DS-6:** confirm CS goals stay a link stub (not a subsystem). *(Phase 6)*

---

## 8. Definition of Done — ISO/SAE 21434 **TARA support**

A project with preset `iso-21434` can:

1. capture assets with per-(asset × security-goal) damage-scenario impact over SFOP
   categories, with `useAssetImpact` enforced;
2. generate threat scenarios via STRIDE-per-element (per-interaction off), anchored
   to assets/elements;
3. derive attack-path feasibility per threat via the attack tree using the 18045
   core (OR=MAX/AND=MIN path aggregation), flowed back as likelihood;
4. determine `R = I × L` (SFOP impact × feasibility), no SRSL;
5. record a risk **treatment decision** (15.9) and residual risk;
6. produce a report with a **traceability coverage matrix**, `normativeBasis`, and a
   reproducibility stamp — scoped as **TARA work-product support, not full ISO/SAE
   21434 compliance** (§1).

---

© Jürgen Messerer · 2026 · All rights reserved. Normative content derives from
ISO/SAE 21434:2021; authoritative wording is the standard.
