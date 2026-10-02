# Risk treatment per impact category — design

**Status:** Draft rev. 1 — open for review, nothing implemented
**Scope:** TARAflow risk model, risk dialog, risk register, report
**Origin:** risk-impact-aggregation design §5.6, phase 5 scope B; the parked
1:n damage-scenario strand (attack-tree threat generator design §4, §11 Q1;
ISO 21434 support design DS-1)

---

## 1. Context

Since patch 48 an ISO/SAE 21434 project shows the risk **per impact category**
next to the one register value (15.8 NOTE 1): "Risk per impact category:
S High · F Low · P Medium". The analyst sees that one threat scenario carries
several consequences of different weight — but can only decide **once** per
risk: one treatment, one MoSCoW priority, one justification.

The attack-tree design names the trigger for revisiting this (§4, "Revisit 1:n
when"): *"we accept the equipment damage but not the injury", though both stem
from the same integrity violation. That needs two risks, two treatments, two
tickets.* This document answers that trigger — without building the 1:n
damage-scenario model.

## 2. Current state (verified in code)

| What | Where | Today |
|---|---|---|
| Treatment | `Risk.treatment` (`eliminate \| reduce \| accept \| transfer \| share`) + `treatmentJustification` | one per risk |
| Priority | `Risk.moscowPriority` + `wontJustification` | one per risk |
| Mitigations | `Risk.selectedMitigations[]`, `mitigatedFactorRatings` | one set per risk; they act on likelihood (and, where rated, on impact factors) |
| Residual risk | `calculatedRiskAfterMitigation` | one value |
| Per-category risk | `isoRiskByCategory()` (patch 48) | computed on the fly, before and after mitigation; display only |
| Accepted risks chapter | `generateAcceptedRisks()` | lists risks with MoSCoW `wont` — keyed on the priority, **not** on `treatment === "accept"` |
| Damage scenario | (asset × security goal), `SecurityGoal.consequence`, optional `SecurityGoal.impactRatings` | 1:1, declared simplification |

## 3. What the norm asks — and what it does not

- 15.8: risk value per threat scenario; NOTE 1 permits a value per impact
  category. Delivered (display).
- 15.9 (risk treatment decision): for each threat scenario, **one or more**
  treatment options are determined, considering its risk values.

So ISO does **not** require a decision per category. It requires a decision
per threat scenario that may combine options. "Reduce for the safety
consequence, retain the financial one" is exactly such a combination — today
TARAflow can only store one option, so the combination ends up in free text.

The need is therefore practice- and audit-driven, not a conformity gap:
the decision should be traceable to the consequence it is about.

## 4. Options

| | A — decisions per category on one risk | B — one risk per category | C — 1:n named damage scenarios |
|---|---|---|---|
| Model | `Risk.categoryDecisions?` (optional, additive) | n risks per threat, id suffix per category | new `DamageScenario` entity; anchors, trees, threats, risks re-keyed |
| Likelihood, mitigations | shared (one threat, one feasibility) | duplicated n times, must be kept in sync | per scenario |
| Register | one row, decision shown per category | n rows per threat | n rows per threat |
| Covers "accept equipment damage, not the injury" | yes (different categories) | yes | yes |
| Covers two consequences in the **same** category | no | no | yes |
| Cost | small–medium | medium, permanent sync burden | very large (attack-tree design §4: larger than the attack-tree refactor) |

**Recommendation: A.** It matches 15.9 ("one or more options per threat
scenario, considering its risk values"), keeps one feasibility and one
mitigation set per threat — which is what the threat really has — and needs no
migration. B duplicates the likelihood side for no gain. C stays parked; the
remaining case (two consequences in the same category) keeps the existing
workaround (two goals or two assets) and the declared 1:1 simplification.

The rest of this document details A.

## 5. Proposal

### 5.1 Model

```ts
/** ISO/SAE 21434 15.5 impact categories (risk impact factor ids). */
type ImpactCategoryId = "safety" | "financial_damage" | "operational" | "privacy";

interface CategoryDecision {
  category: ImpactCategoryId;
  treatment: RiskTreatment;
  justification: string;          // required for accept / transfer / share
  moscowPriority?: MoSCoWPriority; // see Q3
  wontJustification?: string;
}

interface Risk {
  // … unchanged …
  /**
   * Per-category treatment decisions (15.9 "one or more options"). Absent or
   * empty → the single decision in treatment / moscowPriority applies, as
   * today. Present → one entry per rated category; treatment / moscowPriority
   * are DERIVED from them (5.3) and kept for every consumer that reads one
   * value.
   */
  categoryDecisions?: CategoryDecision[];
}
```

Additive and optional: existing project files load unchanged, the TCS
serialiser and the audit trail see one new optional field, no schema
migration.

### 5.2 Decision mode

A risk is decided either **as a whole** (today) or **per category**. The risk
dialog offers the switch only when at least two categories are rated —
with one category there is nothing to split.

- Whole → per category: every rated category starts with the current
  treatment, priority and justification (nothing is lost).
- Per category → whole: the analyst picks the resulting single decision; the
  dialog proposes the derived one (5.3). The per-category entries are dropped
  only after confirmation.

### 5.3 Derived single values

Consumers that read one value (register sort, filters, phase status, exports,
the risk matrix) keep working through derived fields:

- **treatment:** the most demanding category decision, order
  `eliminate > reduce > transfer > share > accept`.
- **moscowPriority:** the highest priority, order `must > should > could > wont`.
- **treatmentJustification:** generated summary, e.g.
  "S: reduce · F: accept — <justification>".

Derived on every change of `categoryDecisions`, never edited directly in
per-category mode.

### 5.4 Residual risk per category

Mitigations act on the threat, so the mitigated likelihood is shared; a
mitigation that rates an impact factor down acts on that category only. The
residual per category is the existing `isoRiskByCategory(mitigatedFactorRatings)`
— no new calculation. The register value after mitigation stays as today
(highest category under `max`).

### 5.5 Validation

| Finding | Severity |
|---|---|
| per-category mode, a rated category without a decision | error |
| decision for a category that is no longer rated (ratings changed) | warning — kept, not deleted, until the analyst resolves it |
| accept / transfer / share without justification | error (as today for the single decision) |
| `reduce` for a category, but no mitigation selected for the risk | warning |
| `accept` for a category whose residual is above the acceptance threshold | info |

### 5.6 Register and report

- **Risk register:** one row per risk as today. The treatment cell shows the
  per-category decisions compactly ("S Reduce · F Accept"); sort and filter use
  the derived values.
- **ISO traceability matrix:** RT and RR per category, matching the RR column
  that patch 48 already annotates.
- **Accepted risks chapter:** lists (risk × category) entries with their
  justification. Open point Q4: today the chapter keys on MoSCoW `wont`, not on
  the treatment `accept`.
- **Methodology section:** one sentence that treatment may be decided per
  impact category (15.9, "one or more options").

### 5.7 What stays out

- Named damage scenarios and two consequences in the same category (option C).
- Mitigations or tickets per category — they stay per risk
  (mitigation-ownership design unaffected).
- Cybersecurity goals / claims derived from the treatment (ISO Clause 9) —
  a follow-up once the decision is per category.

## 6. Scope across presets

The per-category view exists for ISO/SAE 21434 only (four fixed categories,
`max` aggregation). Open point Q1: offer per-category decisions in other
presets too (standard, EN 50742-B), with the categories being the rated
impact factors?

## 7. Implementation phases

1. **Model + derivation** — `CategoryDecision`, `deriveSingleDecision()`,
   validation findings. Pure, tested; no UI.
2. **Risk dialog** — decision mode switch, one decision block per rated
   category with its before/after risk, derived summary.
3. **Register and report** — treatment cell, traceability RT/RR per category,
   accepted risks per category, methodology sentence.
4. **Drift** — ratings change after a per-category decision (5.5 warning);
   no automatic deletion.

## 8. Open questions

1. **Presets:** ISO/SAE 21434 only, or every preset with rated impact factors?
2. **Derived treatment order** (5.3): is `eliminate > reduce > transfer > share
   > accept` the right "most demanding" order?
3. **MoSCoW per category** or one priority per risk? A priority schedules
   work on the risk (its mitigations), which is per risk — argues for one.
4. **Accepted risks chapter:** keep keying on MoSCoW `wont`, or switch to
   treatment `accept` (per category)? The current keying looks like a separate
   inconsistency worth fixing either way.
5. **1:n named damage scenarios:** confirm option C stays parked, with the
   revisit trigger narrowed to "two consequences in the same category that need
   different decisions".

## 9. Change history

- **Rev. 1:** first draft — options A/B/C, recommendation A, model,
  derivation, validation, register/report, phases, open questions.
