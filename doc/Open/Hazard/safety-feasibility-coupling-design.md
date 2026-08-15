# Safety coupling: impact-side only, or does it constrain feasibility?

**Status:** open — decision document, nothing implemented
**Extracted from:** `attacktree-threat-generator-design.md` §11, open question 3
**Scope:** how the hazard/safety layer may influence a risk value

---

## 1. Why this needs its own document

The other two open questions in §11 are *waiting* questions: 1:n damage
scenarios wait for a customer need, EN 50742 vs. Annex G dissolves once method
choice is exclusive per project. This one is different — it is a modelling
decision that gets harder to reverse the more safety-relevant projects exist,
because reversing it re-rates existing assessments.

It also sits exactly on the seam the attack-tree refactoring was built to keep
clean: **impact belongs to the damage scenario, feasibility belongs to the
attack path.** Any answer that couples safety into feasibility puts pressure on
that seam, so the reasoning has to be explicit rather than incidental.

---

## 2. What exists today

Safety influences the risk value on the impact side only.

```
HazardItem  ──endangers──▶  Asset
                             │
                             ├── physicalImpact  (reversible_injury |
                             │                    irreversible_injury | fatality)
                             ├── isHazardTarget / hazardSeverity
                             └── impactRatings[safety]
                                        │
                                        ▼
                        deriveSafetyValue()          → safety factor value (1–4)
                        updateSafetyFactorAutoEnable → factor becomes active
                                        │
                                        ▼
                        calculateRiskValues(): impact side of R = I × L
```

`deriveSafetyValue` takes `physicalImpact` first and falls back to the worst
rated `safety` criterion. The likelihood side never sees any of it: the five
OWASP likelihood factors, the EN 50742 factors and the attack-tree contribution
are all computed without reference to hazards.

So today's answer is implicitly **impact-side only** — by omission, not by
decision. That is what this document is meant to fix.

---

## 3. The question

> Does the presence of a hazard say anything about how *feasible* an attack is,
> or only about how *bad* the consequence is?

Two concrete situations make it non-academic:

**A safety function behind a physical interlock.** The emergency stop is
reachable only from inside a locked cell. That plausibly changes Window of
Opportunity and Exposure Level. If safety data knows about the interlock and
feasibility does not, the likelihood is rated too high.

**A safety-rated device on an isolated network segment.** Segmentation is often
a *consequence* of the safety classification. The safety layer therefore
carries information the feasibility rating would otherwise have to rediscover
by hand.

---

## 4. Options

### Option A — impact-side only (status quo, declared)

Safety raises the S category and nothing else. Feasibility is derived purely
from the attack path.

*For:* the seam stays clean and each number has one owner. An auditor asking
"why is feasibility *high*?" gets an answer entirely within Annex G — the same
argument that made attack-potential the preferred method in the first place.
Nothing double-counts.

*Against:* the analyst has to re-enter, as feasibility factors, protections
that the model already knows about. Nothing forces consistency between "this
asset is behind an interlock" and the Window of Opportunity actually rated.

### Option B — safety constrains feasibility, derived and overridable

Hazard/safety data pre-fills specific feasibility factors — the same
`derived` / `manual` mechanism the impact prefill already uses, with the source
marked and an override possible.

*For:* uses information the model has instead of asking twice; consistent with
the asset-criteria prefill pattern already established.

*Against:* requires a defensible rule for *which* factor a hazard maps onto,
and there is no normative table for it. Annex G derives feasibility from the
five 18045 factors, not from the consequence. A house rule here is exactly the
kind of thing ISO mode was built to reject. It also risks a circularity: safety
classification often *follows* from exposure, so deriving exposure back from
safety can smuggle in an assumption rather than an observation.

### Option C — safety as a validation cross-check, not an input

Safety data never changes a number. It raises a **finding** when the two sides
contradict each other: an asset endangered by a `fatality` hazard, rated as
trivially reachable, with no protective measure recorded, gets flagged for
review.

*For:* keeps the arithmetic clean (Option A's advantage) while stopping the
inconsistency Option A tolerates. Fits the existing validation architecture —
`ValidationError` with `messageKey`/`params`, Class A/B change policy — rather
than adding a new derivation path. An auditor sees that the contradiction was
surfaced and decided, which is stronger than either number alone.

*Against:* more analyst work than Option B; the tool points at the problem
instead of solving it.

---

## 5. Normative footing

Neither ISO 21434 nor IEC 62443 asks for a safety→feasibility coupling.

- ISO 21434 Cl. 3.1.29: risk is **feasibility × impact**. The two factors are
  independent by construction; anything that feeds both needs justification.
- Annex G.2 derives feasibility from the five 18045 factors. Consequence
  severity is not among them.
- The S/F/O/P impact categories are the standard's own place for safety. It is
  already represented, once.

That does not forbid Option B — a project may rate Window of Opportunity using
whatever evidence it has, including the interlock. It does mean the *evidence*
is the interlock, not the hazard. The distinction matters for defensibility:
"WoO is `difficult` because access requires opening a locked cell" is an Annex
G argument; "WoO is `difficult` because this asset is safety-relevant" is not.

---

## 6. Recommendation

**Option C, with Option A as the underlying rule.**

Safety stays impact-side. Where safety data and feasibility rating contradict
each other, the tool says so and the analyst resolves it — recorded, not
silently averaged away.

The reasoning: the informational gain Option B promises is real, but the
protective measure is the actual evidence, not the hazard. TARAflow already
models protective measures (interface capabilities, endpoint protection,
mitigations); if the goal is "feasibility should know about the interlock",
the honest path is to derive it from the interlock, which is an entirely
separate question from safety coupling and can be decided on its own merits.

Option C also fails safe: if the cross-check is wrong, the analyst dismisses a
finding. If a derivation is wrong, a risk number is wrong and nobody notices.

---

## 7. What a decision needs to settle

1. **Trigger condition for the cross-check.** Which combination counts as
   contradictory? A first cut: hazard severity `irreversible_injury` or
   `fatality`, combined with a feasibility band of `high` and no mitigation on
   any path to that asset.
2. **Severity of the finding.** Warning, or error in ISO mode? ISO mode already
   enforces audit-grade feasibility methods, so an error is arguable there and
   a warning elsewhere.
3. **Where it runs.** The attack-tree validator sees paths and feasibility; the
   risk sync sees the safety factor. The check needs both, which suggests the
   app layer — the same place `buildAttackTreeLikelihoodReferences` lives,
   since it already bridges the two features without coupling them.
4. **Whether Option B stays open.** If the answer is "derive feasibility from
   protective measures", record it as its own question rather than folding it
   in here.

---

## 8. Consequences of deferring

Low, and reversible. Option C adds a check; it changes no stored value and no
existing rating. That is deliberate — it is the option that stays cheap to
adopt later, which is why it can wait for a project with real hazards without
accumulating debt.

The one thing worth doing now is writing the current behaviour down as a
decision rather than leaving it implicit: the report's methodology section
should state that safety enters the risk value through the S impact category
only, and that feasibility is derived solely from the attack path. A declared
simplification is defensible; a silent one is an audit finding — the same
principle already applied to 1:1 damage scenarios.
