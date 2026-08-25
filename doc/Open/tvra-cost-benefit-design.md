# TARAflow — Mitigation Cost-Benefit Design

> Scope: extend the existing Risk Dialog's `SelectedMitigation` model with a
> Cost-Benefit assessment per selected mitigation candidate — the ETSI TS 102
> 165-1 "Countermeasure Cost-benefit analysis" step (Clause 6.10), reusing
> TARAflow's existing coverage and before/after-risk infrastructure instead of
> introducing a parallel scoring system. General-purpose Mitigation feature,
> **not** preset-exclusive — the `etsi-tvra` preset is the forcing use case,
> but the reasoning is useful on any project.
>
> Normative source: ETSI TS 102 165-1 V5.3.1 (2025-02) — full public document,
> retrieved from `etsi.org/deliver` (not the paywalled iTeh preview used
> earlier). Confirmed through Clause 6.10.3 body text (mid-clause); Clauses
> 6.10.4 (Regulatory impact), 6.10.5 (Market acceptance), 6.11, and Annex H
> were not retrievable in this session and remain `[VERIFY]` below — but the
> five-dimension structure, the three confirmed rating tables, and the
> mandatory ("shall") status of the whole step are now confirmed from the
> standard itself, not a secondary summary.

---

## 1. The Cost-Benefit method (normative model)

### 1.1 What ETSI asks for (confirmed from full Clause 5, 6.9, 6.10.0–6.10.3 text)

- **Clause 5.1.0** (retrieved verbatim): *"A Cost Benefit Analysis (CBA) as
  defined in clause 6.10 **shall** be used to guide this assessment."* — this
  is not optional guidance, it is a mandatory step of the TVRA method. Directly
  resolves §3.6 below.
- **Clause 6.9** "Security countermeasure identification" (6.9.0–6.9.3)
  precedes 6.10: candidates are identified first, "then evaluated and compared
  to identify the costs and benefits of each so that an informed decision can
  be made of which countermeasures to select" (6.9.0, verbatim). Maps directly
  onto TARAflow's existing `proposedMitigations` → `selectedMitigations` split.
  **6.9.3** also defines how *composite* countermeasures combine: "the least
  likely of the two values is taken for each of the likelihood parameters...
  taking the least impact" — a MIN-combination rule for multiple simultaneous
  countermeasures on the same risk. Not needed for this design (single
  candidate assessed at a time) but relevant context if §3.4 later needs a
  portfolio view (see §8).
- **Clause 6.10.0** "Introduction" (retrieved verbatim): *"The goal of the
  analysis is to identify the most cost-effective countermeasure of the
  alternatives. The main benefit of any countermeasure is the mitigation of
  attack measures... Other benefits can be increased market acceptance and
  improved regulatory compliance. Costs are not merely economical aspects,
  but affect standardization, implementation and operation."* — this sentence
  is the key correction to the previous draft of this document: **the five
  6.10.x dimensions are not five uniform "cost" ratings.** They split as:
  - **Cost dimensions (3):** 6.10.1 Standards design, 6.10.2 Implementation,
    6.10.3 Operation.
  - **Benefit dimensions (2):** 6.10.4 Regulatory impact, 6.10.5 Market
    acceptance.
- **The three cost dimensions share one confirmed 4-level ordinal scale**
  (retrieved verbatim from Tables 16, 17, 18):

  | Scale | Assigned value |
  |---|---|
  | No Impact | 0 |
  | Low Impact | 1 |
  | Medium Impact | 4 |
  | Major Impact | 9 |

  Same jump pattern (0, 1, 4, 9) as the Attack Potential factor tables in
  6.6.3.1/6.7 (Time, Expertise, Knowledge, Equipment) — ETSI's house style for
  weighted-summation scales throughout the whole method, not a one-off.

- **The two benefit dimensions use a *different*, bidirectional scale**
  (retrieved verbatim, Tables 19 and 20 — identical structure, only the label
  differs: "regulatory compliance" vs. "market acceptance"):

  | Scale | Assigned value |
  |---|---|
  | Severe Negative Impact | -9 |
  | Negative Impact | -4 |
  | No Impact | 0 |
  | Positive Impact | 4 |
  | Severe Positive Impact | 9 |

  **This corrects the previous draft of this document**, which assumed
  Regulatory impact / Market acceptance reused the unidirectional 0/1/4/9
  cost scale. They do not — they can be *negative* (the countermeasure hurts
  compliance/adoption) or *positive* (it helps), symmetric around 0. A
  countermeasure required by GDPR, for example, scores positively on
  Regulatory impact even if it costs more to implement (6.10.4's own GDPR
  example, retrieved verbatim).

- **Annex H (now retrieved — Table H.1/H.2 example + accompanying text)**
  reveals the real mechanism is richer than "five independent ratings," and
  splits cleanly in two:

  1. **The three cost dimensions are each paired with a risk-count-based
     benefit, not a rating.** Table H.1's worked example pairs each cost row
     (Standards design / Implementation / Operation) with a **Risk Level**
     (Minor / Major / Critical — TVRA's own risk classification, Table 15)
     and an **Original Count** / **Revised Count**: *"The 'Original Count'
     column... should show number of critical, major and minor risks related
     to the countermeasure calculated before its implementation. The 'Revised
     Count' column shows the appropriate numbers of risks calculated after
     the countermeasure has been implemented"* (Annex H text, verbatim). The
     benefit is **counted**, not judged.
  2. **Regulatory impact and Market acceptance stand alone** — Table H.1
     shows both as a single "No Impact"-style cell spanning the whole
     Cost+Benefit row width, i.e. one bidirectional value each (Tables 19/20),
     with no separate count mechanism.

  Worked example (Table H.1, "Reduce frequency of repeated messages"):
  Standards design=Low Impact(1), Implementation=No Impact(0),
  Operation=No Impact(0); risk counts Critical 3→0, Major 0→3, Minor 0→0;
  Regulatory Impact=No Impact(0), Market Acceptance=No Impact(0); **Result =
  14**. `[VERIFY]` — the aggregation formula that turns these inputs into
  `14` is **not stated in the retrieved text**; it lives only in the
  accompanying Excel tool (`ts_10216501v050301p0.zip`), which was not
  retrievable. Do not reverse-engineer it from one example (I tried a couple
  of plausible weightings against the worked numbers and none matched
  cleanly) — see §3.1, now doubly justified.

### 1.2 Three of ETSI's inputs are not analyst questions — TARAflow already computes them

Confirmed now from Annex H (§1.1) plus how the existing Risk model already
carries the data:

| ETSI TS 102 165-1 needs | TARAflow already has |
|---|---|
| Quantified risk before/after mitigation | `beforeValues.risk` / `afterValues.risk` — already computed per Risk (`calculateRiskValues`, Risk Dialog Tab 1/Tab 3) |
| Residual risk (glossary term, Clause 3.1: *"risk remaining after risk treatment"*) | `afterValues.risk` directly |
| **Original Count / Revised Count of Minor/Major/Critical risks (Annex H)** | **derivable**: severity band per Risk already comes from `getRiskLabel()`/`RISK_SCALES`; counting is a group-by over every Risk that references this mitigation ID, before vs. after |
| Whether a countermeasure is already effectively in place | `computeAllMitigationCoverage()` (existing coverage inference) |

Risk reduction (used for the derived summary row, §5) is **derived, never
asked**:

```
riskReduction = beforeValues.risk > 0
  ? (beforeValues.risk - afterValues.risk) / beforeValues.risk
  : 0
```

**The Annex H risk-count mechanism raises a scope question TARAflow doesn't
have for free**, though: ETSI counts risks "related to the countermeasure"
— i.e. *every* risk in the system this countermeasure touches, not just the
one Risk currently open in the dialog. `SelectedMitigation` today lives
per-Risk (`Risk.selectedMitigations`), so a per-Risk-only count would always
be 0 or 1 per band — trivially true, not the aggregate ETSI's template wants.
Getting the real Original/Revised counts means querying **every Risk in the
project whose `selectedMitigations` includes this mitigation ID**, bucketing
each by severity band via `beforeValues.risk`/`afterValues.risk`, project-wide
— structurally the same query shape as `computeAllMitigationCoverage()`
already performs, just aggregating risk severity instead of coverage status.
New open point, §3.7.

This mirrors the "reuse, don't rebuild" principle already applied to
SRSL-required controls (`en-50742-approach-a-design.md` §3.8, "reuse
TARAflow's mitigation / control-instance / verification infrastructure") — the
same mitigation object carries a new dimension of meaning instead of a
parallel model being built alongside it.

---

## 2. Mapping onto the existing TARAflow structure

| ETSI TS 102 165-1 concept | TARAflow |
|---|---|
| Countermeasure candidate (Clause 6.9) | `SelectedMitigation` (already on `Risk.selectedMitigations`) |
| Cost-Benefit Analysis (Clause 6.10) | new `costBenefit?` field on `SelectedMitigation` |
| Residual risk (Clause 3.1 term) | `afterValues.risk` (already computed) |
| Risk reduction | derived from `beforeValues.risk`/`afterValues.risk`, never stored |
| Countermeasure already effective | `computeAllMitigationCoverage()` (already exists, `MitigationCoverageBadge`) |
| Standards design / Implementation / Operation (6.10.1–3, **cost**, confirmed 0/1/4/9 scale) | analyst-rated cost value, ETSI-literal point scale |
| Risk count per severity band, before/after (Annex H "Original/Revised Count") | **derived**, not asked — TARAflow already classifies risk severity per Risk |
| Regulatory impact / Market acceptance (6.10.4–5, confirmed bidirectional -9/-4/0/4/9 scale) | analyst-rated, single value each, no count mechanism |
| Annex H template/tool | the Cost-Benefit mini-panel UI (§5) — not a new document, a UI affordance on the existing Mitigations tab |

**Key fit points:**

- **No new tab.** Tab 2 ("Mitigations") already has the right shape — Proposed
  → analyst selects → Selected. Cost-Benefit is a per-selected-mitigation
  expansion, following the same precedent as the existing Coverage badge on
  the same checkbox row.
- **Risk Treatment / MoSCoW Priority / Ticket Status stay exactly where they
  are, unchanged.** They answer "what do we do about the risk overall";
  Cost-Benefit answers "which of several countermeasure candidates do we
  pick." Deliberately not merged.
- **`Proposed ≠ Selected ≠ Preferred`** is the tri-state that makes the feature
  legible: many mitigations can be *proposed* (catalog), a subset *selected*
  (analyst commits to evaluating them), and some *preferred* (Cost-Benefit
  outcome) — see §3.4 for whether "preferred" is single- or multi-select.

---

## 3. Open points to clarify (decide before coding)

### 3.1 No hard scoring formula (DECIDED)

- [x] **Decided:** no weighted-sum formula
  (`score = riskReduction*0.5 - cost*0.3 - effort*0.2`). ETSI's own dimensions
  (6.10.1–6.10.5) are heterogeneous — "Regulatory impact" and "Implementation"
  are not commensurable on one axis, and collapsing them into a single number
  manufactures false precision. The panel **shows** the dimensions; the
  analyst makes the call (`decision`) — same principle as the EN 50742 SRSL
  design (literal lookup table, not a smooth derived score,
  `en-50742-approach-a-design.md` §1.3).

### 3.2 Which inputs are analyst-rated vs. derived, and cost vs. benefit (DECIDED, revised again)

- [x] **Decided, now confirmed from Annex H, not inferred:**
  - **Derived, never asked:** risk reduction % (summary row, §5), residual
    risk, coverage status, **and — pending §3.7 — the Original/Revised risk
    counts per severity band.**
  - **Analyst-rated, cost (3, confirmed scale):** `standardsDesign`,
    `implementation`, `operation` — each rated on the literal ETSI scale
    **No Impact = 0, Low Impact = 1, Medium Impact = 4, Major Impact = 9**
    (Tables 16–18, verbatim).
  - **Analyst-rated, benefit (2, confirmed bidirectional scale):**
    `regulatoryImpact`, `marketAcceptance` — each rated **Severe Negative =
    -9, Negative = -4, No Impact = 0, Positive = 4, Severe Positive = 9**
    (Tables 19/20, verbatim). No count mechanism for these two — unlike the
    cost dimensions, their "benefit" *is* the rating itself.

### 3.3 Rating scale (DECIDED — use ETSI's own scale, not an invented one)

- [x] **Decided (revised):** the earlier draft of this document proposed
  reusing TARAflow's generic `low/medium/high/very_high` convention. Now that
  the actual scales are confirmed (§3.2), **use ETSI's literal values
  instead** — two separate scales, not one:
  - Cost: `"none" | "low" | "medium" | "major"` → `0 | 1 | 4 | 9`.
  - Regulatory/Market: `"severe_negative" | "negative" | "none" | "positive" |
    "severe_positive"` → `-9 | -4 | 0 | 4 | 9`.

  Same "reuse the norm's own numbers, keep the point table as the sole source
  of weighting" pattern already used for ISO 21434 / ETSI TVRA likelihood
  factors (`iso21434-core.ts`, `etsi-tvra-core.ts`) — no reason to invent a
  parallel scale when the standard already provides confirmed numbers.
  Rendered as dot/bar indicators in the UI (§5, the bidirectional one centred
  on a zero point), the underlying value is the ETSI point, not a re-derived
  label.

### 3.4 Cardinality — one preferred mitigation per risk, or several? (DECIDED)

- [x] **Decided:** multiple simultaneously-`preferred` mitigations are
  allowed. `decision` is set **independently per mitigation** — a three-way
  toggle per row, never a single radio across the whole mitigation list.
  Defense-in-depth (Secure Boot *and* Network Segmentation both `preferred`
  for the same risk) is a legitimate real outcome, not an edge case to design
  around. This also has direct support in the retrieved norm text, not just
  general design judgment: **Clause 6.9.2** ("Composite countermeasures
  applied to the system") explicitly allows "more than one countermeasure...
  applied against a single threat agent, or to protect a single asset," and
  **6.9.3** defines how their combined effect on likelihood/impact is
  computed (MIN-combination, §1.1). ETSI's own model assumes composite
  countermeasures are normal, not exceptional — a single-winner UI would
  fight the standard's own model, not just TARAflow's UX preferences.
  No global `preferredMitigationId` property; `decision` stays exactly where
  it already lives, on `SelectedMitigation`.

### 3.5 Scope: TVRA-only or all presets? (DECIDED)

- [x] **Decided:** general Mitigation feature, available regardless of
  regulation preset — same reasoning as EN 50742's reuse of the generic
  mitigation/verification infrastructure (`en-50742-approach-a-design.md`
  §3.8). `etsi-tvra` is the forcing use case (Clause 6.10 sits inside Clause 6
  "Method process" as a numbered step alongside 6.5 "systematic inventory of
  assets" etc. — those read as mandatory steps of the method, not an optional
  annex), but Cost-Benefit reasoning is useful on every project. No preset
  gate on the feature's *availability*.

### 3.6 Does `etsi-tvra` *require* Cost-Benefit for conformance? (DECIDED — resolved)

- [x] **Decided.** Clause 5.1.0 confirms: *"A Cost Benefit Analysis (CBA) as
  defined in clause 6.10 **shall** be used to guide this assessment."* This is
  a mandatory step of the TVRA method, not optional guidance — the earlier
  "open, blocked on text" status is resolved. A project tagged `ETSI TVRA`
  with selected mitigations but no Cost-Benefit assessment on any of them is
  therefore genuinely incomplete per the norm.

  What remains a design choice (not a norm question): **how TARAflow
  enforces this.** Recommendation unchanged from the earlier draft — a soft
  warning (not a save block), consistent with `tag-validator.ts`'s general
  philosophy of never hard-blocking on tag-derived conformance claims. The
  norm's "shall" is about TVRA *methodological completeness*; TARAflow's own
  UX principle (soft warnings, hard errors only for impossible combinations)
  is a separate, deliberate product decision that stands independent of what
  the norm requires. Do not conflate "the norm says shall" with "TARAflow must
  hard-block" — same reasoning already applied to `useAssetImpact` not being
  force-enabled, only warned about, in the `exclusive`-lock consequence box
  (§3.11 of the EN 50742 design doc).

  **Two follow-on precision points, both needed before the warning ships:**

  - **"Set" needs a real definition.** `costBenefit !== undefined` is not the
    same as "assessment complete" — `Partial<Record<...>>` allows a
    `costBenefit` with only one of five values filled in. Needed: a pure
    `isCostBenefitComplete(costBenefit): boolean` checking all 3 costs set,
    both impacts set, `decision` set (`justification` stays optional — it's
    documentation, not a gate). Three real states result:
    `costBenefit === undefined` → not started;
    `costBenefit !== undefined && !isCostBenefitComplete(...)` → started,
    incomplete; `isCostBenefitComplete(...)` → complete. The warning should
    fire on "not complete," not merely "not present."
  - **"Any selected mitigation" is too broad a trigger.** A project with 30
    `selectedMitigations`, most logged only as documented
    catalog/defense-in-depth candidates rather than the actual adopted
    treatment, would generate warning noise disproportionate to what's
    useful. The natural fix is scoping the warning to mitigations whose
    `status` marks them as the actual chosen treatment (as opposed to merely
    considered) — but this needs the concrete `MitigationStatus` enum values
    to design precisely, which aren't in scope of this document (only
    `"open"` is confirmed, as `risk-dialog.tsx`'s default when adding a
    mitigation). `[VERIFY MitigationStatus's full value set before
    implementing Phase 5.]` Until then, the warning text itself should name
    the affected mitigations directly (`"3 selected mitigations have not
    been assessed"` + links), not just a project-level badge — reduces the
    cost of the warning being broader-scoped than ideal.

### 3.7 Scope of the risk count — this Risk only, or every Risk the mitigation touches? (DECIDED — project-wide, not degenerate)

- [x] **Decided (revised from the earlier "ship option 1 first" plan).**
  ETSI's Original/Revised Count (Annex H) counts risks "related to the
  countermeasure" system-wide. A per-Risk-only count is not a smaller version
  of that — it's a different, degenerate thing (a single risk's own
  before/after classification), and showing it next to explicit "Annex H"
  UI language would overstate how faithful the reproduction actually is.
  Better to build the real thing directly than ship something that *looks*
  like Annex H but isn't:

  ```
  getRisksRelatedToMitigation(project, mitigationId): Risk[]
    -> classifyBeforeAfter(risk): { before: TvraRiskBand; after: TvraRiskBand }
    -> groupByTvraRiskBand(classified[]): RiskBandCounts
  ```

  Same query shape as the already-existing `computeAllMitigationCoverage()` —
  a project-wide scan grouped by mitigation ID, not new architecture. If
  performance ever becomes a concern (large projects, many mitigations),
  memoize per mitigation ID; not a reason to ship a knowingly-mislabelled
  approximation first. See §3.8 for the `classifyBeforeAfter` /
  `TvraRiskBand` mapping this depends on — that mapping, not the aggregation
  query, is the part still genuinely unresolved.

### 3.8 How does a TARAflow risk value become a `TvraRiskBand`? (OPEN, new)

- [ ] **Open — required before §3.7 can be implemented.** `TvraRiskBand`
  (`minor | major | critical`) is ETSI's own 3-band classification (Table 15:
  values 1,2 = Minor; 3,4 = Major; 6,9 = Critical — the discrete outputs of
  ETSI's own 1–3 impact × 1–3 likelihood product space). TARAflow's risk
  scale is project-configurable (`RISK_SCALES`, `configuration.scale`) and
  not guaranteed to share ETSI's exact discrete range. **No implicit
  threshold check anywhere** (e.g. `if (risk < 20) return "minor"`) — that
  would silently assume a specific TARAflow scale shape that may not hold
  once the scale changes. Needed: an explicit, testable function

  ```ts
  function deriveTvraRiskBand(
    risk: number,
    configuration: RiskConfiguration,
  ): TvraRiskBand
  ```

  whose mapping rule is visible in code and covered by a unit test per scale
  variant TARAflow supports — not a one-line inline comparison. Whether the
  mapping is a fixed ratio split of the configured scale's range, or requires
  the `etsi-tvra` preset's own 1–3×1–3 product space specifically (bypassing
  `configuration.scale` entirely when the preset is active), is the actual
  open design question — not something resolvable from the ETSI text alone,
  since it depends on TARAflow's own scale configuration surface.

---

## 4. Data model

```ts
// ==================== COST-BENEFIT (ETSI TS 102 165-1 Clause 6.10) ====================

/** Cost dimensions (6.10.1–3) — confirmed verbatim, literal ETSI point scale
 * (Tables 16–18): No Impact=0, Low Impact=1, Medium Impact=4, Major Impact=9. */
export type CostDimension = "standardsDesign" | "implementation" | "operation";

/** Single source of truth for UI order, labels, tests, and reporting —
 * iterate this instead of hardcoding the three keys anywhere else. */
export const COST_DIMENSIONS: readonly CostDimension[] =
  ["standardsDesign", "implementation", "operation"];

export type CostRating = "none" | "low" | "medium" | "major";

export const COST_POINTS: Record<CostRating, number> = {
  none: 0,
  low: 1,
  medium: 4,
  major: 9,
};

/** Impact dimensions (6.10.4–5) — confirmed verbatim, bidirectional ETSI
 * scale (Tables 19/20). Stand-alone: no risk-count pairing (§1.1/§3.2). */
export type ImpactDimension = "regulatoryImpact" | "marketAcceptance";

export const IMPACT_DIMENSIONS: readonly ImpactDimension[] =
  ["regulatoryImpact", "marketAcceptance"];

export type ImpactRating =
  | "severe_negative" | "negative" | "none" | "positive" | "severe_positive";

export const IMPACT_POINTS: Record<ImpactRating, number> = {
  severe_negative: -9,
  negative: -4,
  none: 0,
  positive: 4,
  severe_positive: 9,
};

/** TVRA's own 3-band risk classification (Table 15: Minor/Major/Critical) —
 * distinct from TARAflow's own project-configurable risk scale/labels.
 * NEVER derive this inline (`if (risk < 20) return "minor"`); always through
 * the explicit mapping function below, and see §3.8 — the mapping rule
 * itself is still an open design question, not a solved conversion. */
export type TvraRiskBand = "minor" | "major" | "critical";

export function deriveTvraRiskBand(
  risk: number,
  configuration: RiskConfiguration,
): TvraRiskBand { /* mapping rule: OPEN, §3.8 — do not implement ad hoc */ }

/** Annex H "Original Count" / "Revised Count", project-wide per mitigation
 * (§3.7 — not a per-Risk degenerate). Derived, never analyst-entered. */
export type RiskBandCounts = Record<TvraRiskBand, { original: number; revised: number }>;

export type MitigationDecision = "preferred" | "acceptable" | "not_preferred";

/**
 * Attached to a SelectedMitigation, not a top-level Risk field (§2 — no new
 * tab, no new top-level Risk property). Risk counts / residual risk are NOT
 * stored here — derived at render time, same "computed, not persisted"
 * pattern as HazardAssuranceVerdict (revision-stamped, recomputed on change,
 * never a stale stored truth).
 *
 * All three fields are individually optional, on purpose — a
 * `MitigationCostBenefit` that exists but has only one cost dimension filled
 * in is a real, valid "assessment in progress" state, not something to force
 * into completeness at the type level. See `isCostBenefitComplete()` below
 * for what "actually done" means — `costBenefit !== undefined` is NOT that.
 */
export interface MitigationCostBenefit {
  costs: Partial<Record<CostDimension, CostRating>>;
  impacts: Partial<Record<ImpactDimension, ImpactRating>>;
  decision?: MitigationDecision;   // optional — "in progress" is a real state
  justification?: string;          // never required — documentation, not a gate
}

/** The only gate that matters for the etsi-tvra soft warning (§3.6): all
 * three costs set, both impacts set, decision set. Justification excluded
 * on purpose. Three real states for a SelectedMitigation:
 *   costBenefit === undefined                              → not started
 *   costBenefit !== undefined && !isCostBenefitComplete(x)  → in progress
 *   isCostBenefitComplete(costBenefit)                      → complete
 */
export function isCostBenefitComplete(cb: MitigationCostBenefit | undefined): boolean {
  if (!cb) return false;
  return (
    COST_DIMENSIONS.every((d) => cb.costs[d] !== undefined) &&
    IMPACT_DIMENSIONS.every((d) => cb.impacts[d] !== undefined) &&
    cb.decision !== undefined
  );
}

// Extension to the existing type (risk-mitigation-types.ts):
export interface SelectedMitigation {
  id: string;
  status: MitigationStatus;                  // unchanged
  scopeOverride?: MitigationPropertyRole[];  // unchanged
  costBenefit?: MitigationCostBenefit;       // NEW — optional, additive
}
```

```ts
// Pure risk math ONLY — no coverage, no decision, no app-shaped types beyond
// numbers in, numbers out. Kept separate from MitigationCostBenefitView
// (below) so the arithmetic core stays unit-testable and reusable (e.g. for
// reporting, §7.4) without dragging in coverage-computation infrastructure.
export interface CostBenefitMetrics {
  riskReductionPct: number;  // (beforeRisk - afterRisk) / beforeRisk — signed,
                              // NOT clamped to 0: a negative value (the
                              // mitigation made things worse) is meaningful
                              // and must survive to the UI, not be hidden.
                              // Only beforeRisk === 0 is special-cased to 0.
  residualRisk: number;      // afterRisk, verbatim
  riskBandCounts: RiskBandCounts;
}

export function deriveCostBenefitMetrics(
  beforeRisk: number,
  afterRisk: number,
  riskBandCounts: RiskBandCounts,
): CostBenefitMetrics {
  return {
    riskReductionPct: beforeRisk > 0 ? (beforeRisk - afterRisk) / beforeRisk : 0,
    residualRisk: afterRisk,
    riskBandCounts,
  };
}

// Assembly happens at the call site, not inside the pure function — coverage
// and decision are TARAflow-shaped concerns, kept out of the math core:
//
//   const metrics = deriveCostBenefitMetrics(beforeRisk, afterRisk, riskBandCounts);
//   const view: MitigationCostBenefitView = {
//     mitigationId,
//     ...metrics,
//     coverage: mitigationCoverage,           // from computeAllMitigationCoverage()
//     costPoints: ...,                        // COST_POINTS[cb.costs[d]] per dimension
//     impactPoints: ...,                      // IMPACT_POINTS[cb.impacts[d]] per dimension
//     decision: cb?.decision,
//   };

export interface MitigationCostBenefitView extends CostBenefitMetrics {
  mitigationId: string;
  coverage: CoverageResult | undefined;
  costPoints: Partial<Record<CostDimension, number>>;
  impactPoints: Partial<Record<ImpactDimension, number>>;
  decision: MitigationDecision | undefined;
}
```

No new top-level `Risk` field, no new `RiskConfiguration` field. `costBenefit`
is entirely optional — legacy risks and projects load unchanged, same
additive-migration pattern as `RiskConfiguration.windowOfOpportunity`.

---

## 5. UI concept (Risk Dialog, Tab 2 — Mitigations)

Collapsed, unselected — unchanged from today:

```
☐ M-043  HSM Key Protection                    Coverage ○
```

Collapsed, selected, no Cost-Benefit assessed yet:

```
☑ M-042  Secure Boot                            Coverage ✓
```

Collapsed, selected + Cost-Benefit complete (`isCostBenefitComplete` true):

```
☑ M-042  Secure Boot                            Coverage ✓   ★ Preferred
   Risk ↓ 68%  ·  Cost: Med/Major/Low  ·  Reg +9  ·  Market +4
```

Never a collapsed single "Cost 5" number — nothing in this design computes a
composite cost score (§3.1), so nothing in the UI should look like one. The
collapsed row always shows the three cost *labels* (or their point values,
`4/9/1`), never a sum.

Expanded ("Details"):

```
ETSI Cost-Benefit inputs — Secure Boot                   (ETSI TS 102 165-1 §6.10)

  Risk reduction (derived)      ████████░░  68%
  Residual risk (derived)       12

  Cost                                    Risk count (project-wide, §3.7)
    Standards design    ●●●○  Medium (4)    Critical:  2 → 0
    Implementation        ●●●●  Major (9)    Major:     1 → 2
    Operation            ●●○○  Low (1)       Minor:     0 → 0

  Regulatory impact     ●────●────○────●────●   Positive (+4)
                        -9   -4    0    +4   +9
  Market acceptance     ●────●────●────●────○   No Impact (0)
                        -9   -4    0    +4   +9

  Justification: [free text]

  ─────────────────────────────────────────────────────────
  Analyst decision (yours, not ETSI's)

              [ Preferred ]   [ Acceptable ]   [ Not preferred ]
```

- Derived rows render straight from `beforeValues`/`afterValues` +
  `mitigationCoverage`, both already computed in the dialog — no extra data
  fetch, no new service call on the hot path.
- **Cost row** (unidirectional 0/1/4/9): three dropdowns, `CostRating` each,
  point value shown alongside the label — not hidden behind an opaque bar.
- **Risk count** (§1.2/§3.7, now project-wide): counts every Risk in the
  project whose `selectedMitigations` includes this mitigation, bucketed by
  `TvraRiskBand` before/after — the real Annex H mechanism, not a
  single-risk stand-in.
- **Regulatory/Market rows** (bidirectional -9..+9, Tables 19/20): a centred
  slider-style indicator, not a dot-fill bar — the zero point must read as
  neutral, not "half full," so it needs a visually distinct treatment from the
  unidirectional cost bars.
- **Section heading says "inputs," not "assessment" or "result."** The panel
  title is deliberately *not* "Cost-Benefit Assessment" or "Cost-Benefit
  Score" — it's ETSI's confirmed rating inputs, nothing more. The visual
  divider before the decision buttons, plus the explicit "(yours, not
  ETSI's)" framing, keeps the boundary from §3.1 visible in the UI itself:
  ETSI supplies dimensions, TARAflow stores the human call that follows from
  them. A star/badge on the collapsed row (`★ Preferred`) is fine as a status
  indicator, as long as nothing nearby implies it was computed rather than
  chosen.
- The three-button decision row writes `MitigationDecision`. **No default
  auto-selected** — unset stays unset until the analyst decides, same
  "no silent default" principle applied to the WoO selector (Overview work).
  Multiple mitigations on the same risk can independently be `preferred`
  (§3.4) — the UI must not force a single-select radio across the list.

---

## 6. Baseline vs. preset-specific behaviour

- **Baseline (all presets):** `costBenefit` exists and is editable on any
  `SelectedMitigation`, regardless of tag/preset (§3.5).
- **`etsi-tvra`-specific (§3.6, now decided):** soft validation warning when a
  TVRA project has selected mitigations with no Cost-Benefit set — the norm's
  "shall" makes this a genuine completeness gap for the method, but the
  enforcement stays a warning, not a save block, consistent with
  `tag-validator.ts`'s stated philosophy ("Hard errors are for impossible
  combinations... this file only emits warnings").

---

## 7. Phased implementation

### 7.1 Phase 1 — Data model
- `CostDimension`, `COST_DIMENSIONS`, `ImpactDimension`, `IMPACT_DIMENSIONS`,
  `CostRating`, `ImpactRating`, `COST_POINTS`, `IMPACT_POINTS`,
  `TvraRiskBand`, `RiskBandCounts`, `MitigationDecision`,
  `MitigationCostBenefit`, `isCostBenefitComplete()` in
  `risk-mitigation-types.ts`, alongside the existing
  `SelectedMitigation`/`MitigationStatus`.
- `SelectedMitigation.costBenefit?` — optional, additive, no migration needed.
- `deriveTvraRiskBand()` — **§3.8 must be resolved first**; this is the
  actual hard part of Phase 1, not a formality. No inline threshold checks
  anywhere else in the codebase once this exists.
- `getRisksRelatedToMitigation()` → `classifyBeforeAfter()` →
  `groupByTvraRiskBand()` (§3.7) — project-wide from the start, same query
  shape as `computeAllMitigationCoverage()`.
- Pure `deriveCostBenefitMetrics()` (§4) — risk math only, no coverage, no
  decision — unit-testable in isolation, no app wiring.

### 7.2 Phase 2 — Risk Dialog UI (Tab 2 extension)
- Collapsed-row summary (risk-reduction % + per-dimension cost labels, never
  a summed number, §5 + point 7 correction + decision badge) on
  already-selected mitigations only; unselected mitigations keep today's
  Coverage-badge-only row.
- Expand/collapse "Details" affordance per §5, headed "ETSI Cost-Benefit
  inputs," visually separated from the "Analyst decision" block beneath it.
- Three cost dropdowns + two bidirectional impact sliders + project-wide
  risk-band before/after display + justification text + three-way decision
  buttons, independently toggleable per mitigation (§3.4).
- Wire into the existing `setLocal` state / auto-save `useEffect` — no new
  save path, no new prop threading beyond what Tab 2 already receives.

### 7.3 Phase 3 — i18n
- `risks.json` (en/de): cost/benefit dimension labels
  (`standardsDesign`/`implementation`/`operation`/`regulatoryImpact`/
  `marketAcceptance`), rating labels (`none`/`low`/`medium`/`major` and
  `severe_negative`/`negative`/`none`/`positive`/`severe_positive`), decision
  labels, "ETSI Cost-Benefit inputs" / "Analyst decision" section headers.
  Tooltips can quote the confirmed 6.10.1–6.10.5 table descriptions directly
  (verbatim text retrieved for all five, §1.1).

### 7.4 Phase 4 — Reporting
- Per risk with selected mitigations: a Cost-Benefit comparison table
  (candidates side by side) plus `justification` rendered as the "why we chose
  X over Y" narrative — the Decision Traceability goal from the design
  discussion. Structurally closest existing precedent: Hazard Item's
  per-`endangers`-target report sections (`IMPLEMENTATION-hazard-item.md`
  Phase 6, "Multi-Target-Reporting").
- Report clearly separates ETSI's rating inputs from TARAflow's stored
  decision, same framing as §5 — a report reader comparing against ETSI's
  own template should never read "Preferred" as an ETSI output.

### 7.5 Phase 5 — `etsi-tvra` soft validation (unblocked, §3.6 decided)
- No longer blocked on standard text — Clause 5.1.0's "shall" is confirmed.
  Soft warning matching the existing `TagWarning` UX pattern, never a save
  block, firing on `!isCostBenefitComplete(costBenefit)` (§3.6) — not merely
  `costBenefit === undefined`. Warning text names the specific incomplete
  mitigations rather than a bare project-level badge. Scoping to
  "actually-adopted" vs. "documented candidate" mitigations via
  `MitigationStatus` is a known refinement, pending `[VERIFY
  MitigationStatus's value set]` (§3.6).

### 7.6 Phase 6 — Tests
- Unit: `deriveCostBenefitMetrics()` — risk-reduction math including the
  *negative* case (mitigation made things worse — must not be clamped, per
  point 8's confirmation that the formula already handles this correctly),
  `beforeRisk === 0` edge case; `isCostBenefitComplete()` across all
  partial-fill combinations; `deriveTvraRiskBand()` per scale variant (§3.8);
  `getRisksRelatedToMitigation()`/`groupByTvraRiskBand()` (§3.7).
- Component: expand/collapse, independent per-mitigation decision toggling
  (multiple simultaneously `preferred`, §3.4), auto-save round-trip,
  legacy-risk load without `costBenefit` (no crash, section shows "not
  started" via the three-state model, not "not assessed").

---

## 8. Out of scope

- **Weighted/configurable scoring formula** — explicitly rejected (§3.1). No
  "weights config" UI, no computed composite score anywhere, including the
  collapsed row (§5, point 7 correction).
- **Cross-risk mitigation portfolio view** ("which mitigations cover the most
  risk across the whole project") — a real ETSI-adjacent idea (Clause 6.9.2
  "composite countermeasures applied to the system" gestures at it), but a
  separate feature from this per-risk Cost-Benefit step. Note: §3.7's
  project-wide risk-band count is *not* this — it's a narrower, single-metric
  aggregation scoped to one mitigation, not a full portfolio view.
- **Monetary cost tracking / budget rollup.** All five ETSI dimensions are
  qualitative-by-scale, not currency (§3.3); a monetary cost model is a
  different, larger feature if ever needed.
- **Reproducing Annex H's "Result" column.** Explicitly out of scope until the
  actual aggregation formula is obtained (§1.1) — not a temporary gap, a
  deliberate decision not to guess at ETSI's arithmetic.

---

## 9. Effort

| Area | Phase | Effort | Note |
|---|---|---|---|
| Data model | 1 | medium | additive, no migration — but §3.8's `deriveTvraRiskBand()` mapping is genuine design work, not boilerplate |
| Risk Dialog UI | 2 | medium | biggest piece — new expand/collapse UI on an already-dense tab, plus independent per-row decision toggling |
| i18n | 3 | small | ~20–25 keys (five dimensions × two scale types + decision + section headers) |
| Reporting | 4 | medium | comparison table + narrative generation |
| TVRA validation | 5 | small | unblocked — §3.6 decided, `isCostBenefitComplete()` does the real work |
| Tests | 6 | small–medium | `deriveTvraRiskBand()` needs one test per supported scale variant |

---

## 10. Definition of Done

A `SelectedMitigation` can:
1. carry an optional `MitigationCostBenefit` with three ETSI-literal cost
   ratings, two ETSI-literal bidirectional impact ratings, an optional
   justification, and an optional decision — each independently fillable,
   with `isCostBenefitComplete()` as the single source of truth for "done";
2. show derived risk reduction (signed, never clamped), residual risk, and
   project-wide Minor/Major/Critical risk-band counts (§3.7) without the
   analyst typing any of it (§1.2);
3. surface the existing Coverage inference in the same panel;
4. render a per-risk Cost-Benefit comparison table in the report, with ETSI
   inputs and the analyst's decision visually and textually distinct (§5, §6);
5. never force a decision — unset stays visibly unset, no silent default,
   and multiple mitigations can independently be `preferred` (§3.4);
6. never claim a "Result" score, a collapsed "Cost N" summary number, or any
   other computed composite it can't actually justify (§1.1, §3.1, §8).

Blocked before this can ship cleanly: only §3.8 (`deriveTvraRiskBand()`'s
actual mapping rule) — a genuine, TARAflow-scale-dependent design question,
not a standard-text question. §3.4, §3.6, and §3.7 are all now resolved.
Still `[VERIFY]`, not blocking: Annex H's Result formula and the accompanying
Excel tool's exact layout — out of scope by design (§8), not a launch
blocker. `MitigationStatus`'s full value set (§3.6) blocks only the
warning-scoping refinement, not the core feature.

---

<sub>© Jürgen Messerer · TARAflow · 2026. Normative content derives from ETSI TS
102 165-1 V5.3.1 (2025-02), retrieved from the full public document at
etsi.org/deliver plus Annex H excerpts (Tables H.1/H.2 and accompanying text)
supplied directly. Confirmed: Clauses 1–6.11 in full, Annex H's table
structure and worked example. Not retrieved: Annex H's underlying "Result"
aggregation formula (lives only in the accompanying Excel tool,
`ts_10216501v050301p0.zip`) — deliberately out of scope (§8), not a gap to
close later.</sub>
