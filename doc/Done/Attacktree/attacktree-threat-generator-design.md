# TARAflow — Attack Tree as Threat Generator

**Status:** Design approved — 5a shipped, 5b core shipped (sync + factor + builder green); 5b end-to-end wiring + 5b-1b/c owed. Phase 8 (UI rework) and Phase 9 (phase reordering) shipped 2026-07-25/26.
**Version target:** post-0.6.0-alpha
**Author:** Juergen Messerer / TARAflow
**Normative basis:** ISO/SAE 21434:2021 Cl. 15 (verified), IEC 62443-3-2, EN 50742

> **Revision history**
> **v9** — Phase 8 (UI rework) and Phase 9 (phase reordering, §9) DONE and shipped, 2026-07-25/26 — see below. §8 gains DocBook as a sixth report format, with a configurable XSLT stylesheet — detail moved to Phase 7's own doc, `phase-7-reporter-design.md`, since Phase 7 hadn't started and the scope note was getting long for a revision-history line. No model change.
> **v8.1** — §5.7 corrected to match the shipped 5b-1a: ISO mode requires an *audit-grade RC-15-11 method* (not "attack-potential only") — three methods are permitted (attack-potential / CVSS / attack-vector), narrowing keyed on `FeasibilityConfiguration`, enforced only on explicit opt-in; `f,b,i`/`p,i` rejected as the non-audit-grade quick form. Method scoping corrected from "per tree" to **project-wide**. No model change.
> **v8** — 5b as-built. The model from v7 is unchanged (one likelihood factor, averages in), but implementation surfaced three refinements, now recorded in §"Implementation reality": (1) the tree factor is written by a **separate `syncRisksFromAttackTrees` pass**, chained after `syncRisksFromThreats` — not routed through the threat sync, which would discard it via `reconcileFactorRatings` (rebuilds from enabled activeFactors only); (2) `reconcileFactorRatings` **exempts `source: "attack-tree"`** so the threat sync passes it through (the earlier "auto-enable the factor" plan is dropped); (3) Mapping B lives in the **app-layer builder** `build-attack-tree-likelihood-references.ts` producing the shared `AttackTreeLikelihoodReference` type — `features/risks` imports only from `shared`. Asset-anchored trees emit per-path, threat-anchored aggregated; unrated → no contribution. **All trees feed risk** (both anchors, both methods) since risk treatment lives in the Risk tab. Also records the independent `fix(risks): always enable impact factors` bug. 5b-1a shipped (project-wide feasibility config + ISO method enforcement per RC-15-11); 5b-1b/c (CVSS, attack-vector) still owed.
> **v7** — 5b reworked. The `likelihoodSource` discriminator and `mode: supplementary/authoritative` from v6 are **dropped** — the tree likelihood is instead **a predefined likelihood factor (`attack_tree_likelihood`, default weight 1, adjustable in the config like any factor)** that averages into `calculateRiskValues`, so all three cases (Standard refine / new asset-anchored / ISO) fall out with no special-casing. A **project-global** `treeLikelihoodContribution: "factor" | "advisory"` (default `factor`) decides, for the Standard refine case, whether the tree writes an active factor or is shown as an advisory hint only (`advisory` = the old `supplementary` intent, achieved by not writing the factor rather than by a discriminator). The tree contributes likelihood only; the leaf's impact `i` never enters the risk. Tree feeds before-mitigation only. §5 tightened: **ISO mode REQUIRES the attack-potential leaf format**; `f,b,i` and `p,i` are validator errors in ISO (5a done and shipped in the interim).
> **v6** — Phase 5 splits into 5a (asset-anchored, new threats) and 5b (threat-anchored, feasibility into existing risk). Adds the anchor-driven two-use-cases model (§1), the `likelihoodSource` discriminator, and read-only impact/feasibility in the risk dialog (SSoT). Tab order fixed by the data flow, not deferred. *(5b model superseded by v7.)*
> **v5** — §4 settles damage scenario cardinality: **1:1 (asset × security goal), as a declared simplification**, not a normative violation. Adds `SecurityGoal.damageScenario` and makes the simplification mandatory in the report's methodology section. Phase 3 marked done.
> **v4** — §5 gains the gate-aggregation rules (SUM for effort, PRODUCT for probability, MIN only for bare ordinals). This was missing from v3 and is a substantive methodological decision, not an implementation detail. Phase 1 and 2 marked done.
> **v3** — Dual likelihood model (§5): benefit counts in 62443 mode, never in ISO mode. Impact moves to the security goal (§4), identically in both modes. S/F/O/P preserved via Option C.
> **v2** — Corrected §4 (impact does not vary per leaf); clause refs verified against the standard.
> **v1** — Initial proposal.

---

## 1. Core decision

TARAflow supports **two rating methods**. Both converge on **one** risk register (the Risks tab). There is no "STRIDE risk" and no "attack tree risk" — there is *the* risk. Non-negotiable for auditability.

**The key move:** the attack tree emits **ThreatReferences**, not Risks.

`Risk.threatId` stays intact. `generateRiskId()` stays `R-${threatId}`. `syncRisksFromThreats()` stays unchanged. The Risks tab does not know or care which generator produced a threat.

The attack tree becomes a **third threat generator** alongside per-element and per-interaction STRIDE — and `ThreatReference.sourceStrideMethod` already exists to distinguish them. No `RiskAnchor` discriminator, no risk-model migration.

### The attack tree is not a niche tool

Two independent reasons make it load-bearing in **both** modes:

1. **Coverage gap.** Attacks STRIDE cannot reach — supply chain, physical access via a maintenance hatch, social engineering of a service technician. There is no DFD element to hang them on. The tree models them and **pulls them into the register**.
2. **Uncertainty.** A STRIDE threat whose exploitability is unclear. Build the tree, see the paths, rate it on evidence instead of intuition.

In STRIDE-focused mode the tree is used opportunistically (gaps + uncertainty); in attack-tree-focused mode it is used comprehensively. **The mathematics is identical either way.**

### Two use cases, driven by the anchor — not the project mode

The tree behaves differently depending on what it is anchored to, and this is the
same in both methods. The project mode (ISO vs. Standard) only changes whether the
tree's numbers *drive* or *inform*.

| Anchor | Use case | Emits a new threat? | Where feasibility goes |
|---|---|---|---|
| `threat` | **Refine** an existing STRIDE threat | No | into that threat's existing risk |
| `asset` | **New** threat STRIDE cannot express (supply chain, physical access) | Yes | into the new risk it creates |
| `standalone` | Vulnerability analysis (Cl. 8.5) | No | nowhere — analysis only |

**The refinement case (`threat` anchor) is the ISO normal case.** In ISO 21434 the
attack tree is where attack feasibility is determined (15.6/15.7), so the expected
workflow is: generate STRIDE threats → analyst confirms relevance (that confirmed,
asset-linked threat *is* the ISO "threat scenario", 15.4) → build a tree for it →
the tree supplies its feasibility. STRIDE is one threat-*identification* method
(15.4 NOTE 2 lists it beside EVITA, PASTA); the tree does the path analysis.

In Standard mode the same `threat`-anchored tree is used only on *uncertainty*.
How its output is used is a **project-wide** choice (`treeLikelihoodContribution`,
default `factor`):

- **`factor`** — the tree becomes **one more likelihood factor**
  (`attack_tree_likelihood`, default weight 1, adjustable in the risk-config
  dialog like any factor) that averages in with the OWASP factors. It supplements
  them, never overwrites them, and the analyst does not have to transcribe the
  tree's number into the factors by hand.
- **`advisory`** — the tree's value is shown to the analyst as a provenance hint
  only; it is not written as an active factor and does not drive the number. The
  analyst adjusts the OWASP factors himself, informed by the tree.

Either way the tree never *overrides* the factors. See Phase 5b for how this one
setting, plus "are there other likelihood factors at all", makes all three cases
(Standard refine, new asset-anchored, ISO) fall out without a discriminator.

**This fixes the tab order as a consequence, not an ergonomic choice:**

```
DFD → Assets → Threats → Attack Tree → Risks
```

The tree sits *after* Threats (it refines them) and *before* Risks (it informs
their assessment), in both methods. §9's "reorder later" note is superseded: the
order follows the data flow.

**The tree is a before-mitigation instrument.** The analyst rates the tree without
mitigations; it produces risks; mitigation is assessed in the Risk tab exactly as
for STRIDE risks. This is required by the close loop
(`DFD-element → Asset → Threat → AT-branch → Risk`, and back): if mitigation lived
in the tree, the tracker's "implemented" signal could not flow back through the
Risk to the DFD. The `pathKey` (Phase 1) is the "AT-branch" in that chain.

---

## 2. What ISO 21434 actually says

Verified against ISO/SAE 21434:2021.

| Clause | Activity | WP |
|---|---|---|
| 15.3 | Asset identification (incl. **damage scenarios**) | 15-01, 15-02 |
| 15.4 | Threat scenario identification | 15-03 |
| 15.5 | **Impact rating** — per damage scenario, categories S/F/O/P | 15-04 |
| 15.6 | **Attack path analysis** | 15-05 |
| 15.7 | **Attack feasibility rating** — per attack path | 15-06 |
| 15.8 | Risk value determination | 15-07 |
| 15.9 | Risk treatment decision | 15-08 |

Definitions that drive the design (Cl. 3.1):

- **3.1.24 impact** — magnitude of damage from a **damage scenario**
- **3.1.22 damage scenario** — adverse consequence from compromise of a **cybersecurity property** of an asset
- **3.1.3 attack feasibility** — attribute of an **attack path**: the ease of carrying it out
- **3.1.29 risk** — expressed in terms of attack feasibility **and** impact

**Two independent axes.** Impact belongs to the *goal*; feasibility belongs to the *route*. They meet only at 15.8. Annex H shows both a risk matrix (H.8) and a formula (H.10) on exactly these two inputs.

**Attack trees are explicitly sanctioned:** 15.6 permits top-down derivation of attack paths via attack trees; Annex H.2.5 shows one.

**"Cheapest path" has normative backing:** 15.8 NOTE 2 permits aggregating the feasibility of several attack paths, and gives **the maximum** as the example. Max(feasibility) = the easiest route = the attacker's choice.

---

## 3. Attack path → ThreatReference

**One threat = one attack path** (ROOT → leaf). The path *is* the threat scenario.

| `ThreatReference` field | Source |
|---|---|
| `id` | `AT-<treeId>-<pathKey>` — see §7 |
| `threatDescription` | ROOT node name |
| `attackDescription` | `path.path.join(" > ")` |
| `strideCategory` | `ATTACK_GOAL_TO_STRIDE[attackGoal]` — **already exists** |
| `linkedAssetIds` | `[anchor.assetId]` when asset-anchored, else `[]` |
| `proposedMitigations` | `path.mitigations` |
| `proposedVerifications` | resolved from the catalog (as in the STRIDE path) |
| `sourceStrideMethod` | new value `"attack-path"` |
| `relevance` | `"unrated"` → user sets confirm / dismiss / uncertain |

```ts
export type StrideMethod = "per-element" | "per-interaction" | "attack-path";
```

Audit every `switch` on `StrideMethod` for exhaustiveness. `RiskTableView` currently branches binary — make it an explicit map.

### Only asset-anchored trees emit threats

3.1.33: a threat scenario is by definition the compromise of a cybersecurity property **of one or more assets**. No asset → no threat scenario → no damage scenario → no impact → no risk value.

Standalone trees remain **allowed** but are pure analysis instruments — normatively fine, since 15.6 is also invoked from **8.5 (vulnerability analysis)**, where the question is only whether a weakness is exploitable at all.

Validator **info** on a standalone tree: *"Not asset-anchored — does not contribute to the risk register. Analysis only (Cl. 8.5)."*

### Emission policy (configurable)

**Location: Attack Tree config dialog** — *not* the Risk config dialog. The policy decides which paths *constitute a threat scenario*: a property of the analysis, not of risk rating. In the Risk config a user could silently change the threat population without ever opening the Attack Tree tab.

```ts
export type PathEmissionPolicy =
  | "cheapest-per-goal"    // default — backed by 15.8 NOTE 2
  | "above-threshold"
  | "all";
```

- **`cheapest-per-goal`** (default): the most feasible path per (tree × attackGoal). Bounded count. Non-emitted paths stay documented in the tree and the report (§8).

> **Superseded — REMOVED in code (2026-07-24).** `PathEmissionPolicy` and the
> whole selection step are gone; `selectEmittablePaths` is just the `isEmittable`
> filter. Every rated path is a candidate and the analyst confirms or dismisses
> it in the table (`attacktree-ui-rework-design.md` §6). Two reasons drove it —
> the tie-break between equally feasible paths fell back to comparing hash
> strings, dropping a genuinely equivalent path from the register; and which
> paths constitute threat scenarios is an analyst judgement a policy neither
> records nor makes visible. `collectAllThreats` already filters unrated and
> dismissed threats, so the gate exists. The `cheapest-per-goal` /
> `above-threshold` / `all` description below is retained only to explain what
> was removed and why.
- **`above-threshold`**: every path at or above a feasibility level. For genuinely independent routes.
- **`all`**: honest but explosive (20–50 leaves per realistic tree). Offer it; never default to it.

In **62443 mode**, a path with negligible benefit is not emitted regardless of policy (see §5) — an attack nobody profits from is not a foreseeable scenario.

---

## 4. Impact — at the security goal, in both modes

### The rule

**Impact belongs to (Asset × Security Goal), never to a tree node.**

This is *not* a method question. Whether likelihood is later computed per ISO or per 62443 does not change the fact that a confidentiality loss on a config database causes a different damage than an availability loss on the same database. That is a property of the system, not of the rating method.

Both standards support this independently:

- **ISO 21434:** damage scenario = compromise of a *cybersecurity property* (3.1.22 + 3.1.33). Property = security goal. Impact attaches to the damage scenario (3.1.24).
- **IEC 62443 / classic:** consequence analysis likewise asks what happens when *this specific* goal falls.

### What TARAflow has today

`Asset.impactRatings: ImpactRating[]` — **11 criteria**, a clean superset of ISO's four (15.5 NOTE 2 explicitly permits additional categories):

| ISO 15.5 | TARAflow criterion |
|---|---|
| **S** | `safety` — with its own 4-level scale (ISO 12100 / EN 50742) |
| **F** | `financial_damage` |
| **O** | `operational` |
| **P** | `privacy` |
| — | `regulatory_compliance`, `reputation`, `affected_users`, `recoverability`, `physical_damage`, `environmental`, `supply_chain` |

**But** they hang on the **Asset**, not on the security goal — so confidentiality and availability loss currently share one impact. And `overallImpact: number` collapses all 11 into a single figure, discarding the category.

### The change (additive, no migration)

```ts
export interface SecurityGoal {
  // ... existing
  /**
   * Optional per-goal impact override. When absent, Asset.impactRatings applies
   * (current behaviour — every existing project keeps working untouched).
   * This is where a damage scenario actually lives in TARAflow's model:
   * asset × compromised security goal.
   */
  impactRatings?: ImpactRating[];
}
```

Resolution order for a tree anchored on `(asset, goal)`:
1. `securityGoal.impactRatings` if present
2. else `asset.impactRatings`

**No override in the tree. No `i` in the DSL. No complaining validator.** The tree is impact-free; it fetches impact through its anchor.

### Preserve the category (Option C)

`overallImpact = 4` does not say whether that is a fatality or a reputational dent. 15.8 NOTE 1 permits a **separate risk value per impact category**, and a safety auditor needs exactly that.

```ts
Risk.impactByCategory: {
  safety: number;       // from impactRatings["safety"]
  financial: number;    // financial_damage
  operational: number;  // operational
  privacy: number;      // privacy
  other: number;        // MAX of the remaining 7
};
Risk.impact: number;    // = MAX(all) — stays the default display
```

UI: `overallImpact` plus a chip for the **dominant category** ("4 ⚠S"), expandable to the breakdown.

> **Warning about `average`:** an asset with `safety=4` (fatality) and ten criteria at 1 averages to ≈1.3 — the fatality vanishes. **Force `conservative` (MAX) in ISO mode** and state the method in the report.

### Damage scenario cardinality — 1:1, declared

**Decision: one damage scenario per (asset × security goal). Not a normative violation — a declared simplification.**

The standard says a property compromise can lead to "**one or more**" damage scenarios (3.1.2 Note 1). That is a statement about reality, not a requirement on the data model. What it actually *requires* is:

- [RQ-15-01] damage scenarios shall be identified
- [RQ-15-05] impact shall be rated **per damage scenario**, per category (S/F/O/P)
- [RQ-15-15] the risk value shall be determined from the impact of the associated damage scenarios

So the question is not "1:1 or 1:n" but **is the information preserved**.

| | ISO 21434 | TARAflow |
|---|---|---|
| Cardinality | (asset × property) → **n** damage scenarios | (asset × security goal) → **1** damage scenario |
| Impact | one rating per damage scenario | one rating per (asset × goal), broken down by category |

**What 1:1 costs — and what it does not:**

- **No arithmetic loss.** If violating firmware integrity leads to two consequences (machine drives into an end stop → safety 4; faulty products shipped → financial 2), `impactByCategory` records exactly that: `safety: 4, financial: 2`. Both consequences are present, in the right category, at the right severity. 15.8 NOTE 1 permits a risk value per category, which is the same information.
- **A traceability loss.** The auditor sees `safety: 4` but not *which* scenario produced it. This is a documentation gap, not a modelling one — and it is closed by the `damageScenario` description field (below) plus the report's methodology section.
- **One edge case.** Two scenarios in the *same* category with different severities collapse onto the maximum. Conservative, therefore defensible — but the weaker one disappears from the report.

**Why not 1:n:** it would break the entire anchor chain. `AttackTreeAnchor` points at `asset + securityGoal`. Under 1:n it would have to point at a damage scenario — a new first-class object with its own id, tab and persistence — and `pathKey` (Phase 1), the threat generator (Phase 4) and the Risks tab (Phase 6) all hang off that. A larger rebuild than the whole attack-tree refactor, for a gain that is primarily documentary.

**The cheap 90%:** a description on the security goal.

```ts
export interface SecurityGoal {
  impactRatings?: ImpactRating[];
  /**
   * The damage scenario: what happens when this goal is violated (ISO 3.1.22).
   *
   * TARAflow models ONE damage scenario per (asset × security goal). Where a
   * single property compromise leads to several distinct consequences, describe
   * them here; their impacts are consolidated onto this one scenario, with the
   * maximum taken per impact category.
   */
  damageScenario?: string;
}
```

**Mandatory in the report (§8):** the methodology section states the simplification explicitly.

> *"Damage scenarios are modelled as one per (asset × security goal). Where a single property compromise leads to several distinct consequences, the impact ratings are consolidated onto that one scenario, with the maximum taken per impact category."*

A **declared** simplification is defensible. A silent one is an audit finding. That distinction is the whole point of writing it down.

**Revisit 1:n when** customers need *separate risk treatment decisions per consequence* — e.g. "we accept the equipment damage but not the injury", though both stem from the same integrity violation. That needs two risks, two treatments, two tickets. Until then the analyst can model it as two goals or two assets: inelegant, but workable.

---

## 5. Likelihood — the one place the methods genuinely fork

This is the real reason two modes exist. Not `f,b,i` vs. `p,i` — but **whether attacker motivation counts**.

### ISO 21434: benefit is excluded, deliberately

3.1.29 expresses risk in terms of attack feasibility and impact. Nothing else. The five attack-potential factors (Annex G.2, from ISO/IEC 18045) are purely **effort** measures: elapsed time, specialist expertise, knowledge of the item, window of opportunity, equipment. **Not one asks whether it is worth doing.**

That is a deliberate choice. Attacker motivation is not attributable — you cannot know whether your device becomes interesting to a script kiddie, a competitor or a state actor next year. Building motivation into the risk means baking in an unprovable assumption about the attacker, which in practice becomes a licence to argue a risk away ("nobody would bother"). The standard forecloses that.

**In ISO mode, feasibility IS the likelihood axis.** Not a component of it.

### IEC 62443 / classic: benefit counts

And TARAflow already does this: `factorRatings` carries **`motive`** alongside `skill_level`, `opportunity`, `ease_of_exploit`. IEC 62443 works with threat-actor profiles (skill + **motivation** + resources). Classic attack trees (Schneier) use benefit the same way.

### The model

```ts
export type LikelihoodModel =
  | "feasibility-only"          // ISO 21434 — Annex G, benefit excluded
  | "feasibility-x-motivation"; // IEC 62443 / classic — benefit counts
```

Project-wide, bound to the ISO chip in the Overview tab.

| | ISO 21434 | IEC 62443 / classic |
|---|---|---|
| **Impact** | Asset × Security Goal | Asset × Security Goal ← **identical** |
| **Likelihood** | Feasibility | Feasibility × Motivation |
| **Benefit (`b`)** | analysis attribute only | part of likelihood |
| **Factors** | Annex G (5, per ISO/IEC 18045) | OWASP (incl. `motive`) / threat-actor profile |

**In ISO mode `b` is still parsed and still useful** — it drives path plausibility (high feasibility, zero benefit → probably not a real scenario), path ordering in the tree, emission policy, and CRA Art. 13 "reasonably foreseeable misuse" reasoning. It simply never enters the risk number.

Validator **info** in ISO mode when `b` is present:
*"Benefit does not enter the risk calculation in ISO 21434 mode (Cl. 3.1.29). Used for path plausibility and ordering."*

**The report must state the likelihood model.** A 62443-mode TARA presented as ISO-conformant is an audit finding waiting to happen.

### Feasibility: express it in attack-potential terms

15.7 [RC-15-11] permits attack-potential-based, CVSS-based or attack-vector-based approaches (Annex G details all three).

**Prefer attack-potential-based (G.2).** G.2.2.6 / Table G.7 map the summed factors onto the four feasibility ratings — so the feasibility → risk-scale mapping comes **from the standard**, not from a house convention. An auditor asking "why did 0.62 become *high*?" gets a normative answer.

It also aligns with what TARAflow already has: the EN 50742 factors (`window_of_opportunity`, `attacker_capability`, `exposure_level`) are recognisably from the same family.

#### ISO mode requires an audit-grade RC-15-11 method — the DSL enforces it

"Prefer" is a Standard-mode statement. In **ISO mode an audit-grade RC-15-11
method is mandatory**, and the validator enforces it. ISO 21434 15.7 [RC-15-11]
permits three approaches — attack-potential (RC-15-12), CVSS (RC-15-13), and
attack-vector — so ISO mode does not narrow to attack-potential *alone*; it
narrows to *an implemented, audit-grade RC-15-11 method*. Today only
attack-potential is implemented (`IMPLEMENTED_FEASIBILITY_METHODS`), so in
practice an ISO leaf carries the attack-potential form; CVSS (5b-1b) and
attack-vector (5b-1c) extend this without touching the validator, which checks
against `IMPLEMENTED_FEASIBILITY_METHODS`, not a hardcoded method.

```
# ISO mode, attack-potential method — the accepted leaf evaluation today:
Extract Data;et=1w,se=expert,kn=restricted,wo=easy,eq=standard

# REJECTED by the validator in ISO mode (syntax error, not a warning):
Extract Data;0.6,0.8,4     # f,b,i  — a bare guessed feasibility, plus benefit, plus impact
Extract Data;p=0.8,i=3     # p,i    — a bare guessed probability, plus impact
```

`f,b,i` and `p,i` are rejected in ISO not because they are "not attack-potential"
but because they are the non-audit-grade *quick* form — they are no RC-15-11
method at all.

Three reasons, each normative, not stylistic:

1. **Feasibility must be derived, not guessed.** A bare `f=0.6` (the `f,b,i`
   form) or `p=0.8` is the *quick mode* that Cl. 15.7 does not sanction as
   audit-grade — Annex G derives feasibility from the five 18045 factors. In ISO
   mode the guessed number is not a weaker option, it is a non-conformity.
2. **Benefit may not appear.** Cl. 3.1.29: risk is feasibility × impact.
   Motivation is unattributable and never enters the risk number. The `,b`
   component of `f,b,i` has no place in an ISO leaf at all.
3. **Impact does not belong on the leaf.** The `,i` component of every legacy
   form is an impact, and impact belongs to the (asset × security-goal) damage
   scenario (§4), not to a tree node. A leaf-level impact would fork the one
   impact that is meant to be shared.

Standard mode keeps all forms (`p,i`, `f,b,i`, attack-potential) — the analyst
chooses. Only ISO mode narrows to an audit-grade RC-15-11 method. The narrowing
lives in the **validator**, keyed on the project's `FeasibilityConfiguration`
(`likelihoodModel: "feasibility-only"` = ISO, plus the chosen `method`), so a
Standard tree parses byte-identically to before. The config is **project-wide**
(anchored on `AttackTreeProjectConfiguration.feasibilityConfiguration`), and ISO
enforcement fires only when the project has *explicitly* opted in — an
unconfigured project defaults to Standard, so the bundled templates are never
rejected.

**Dual-mode DSL:**

```
# Quick mode (drafting — not audit-grade):
Extract Data;p=0.8

# Audit mode (attack-potential, ISO/IEC 18045):
Extract Data;et=1w,se=expert,kn=restricted,wo=easy,eq=standard

# Benefit (optional, both modes; only counts in 62443 mode):
Extract Data;et=1w,se=expert,kn=restricted,wo=easy,eq=standard,b=high
```

```ts
export type FeasibilityLevel  = "very-low" | "low" | "medium" | "high";
export type FeasibilityMethod = "quick" | "attack-potential" | "cvss" | "attack-vector";
```

The method is recorded **project-wide** (on `AttackTreeProjectConfiguration.feasibilityConfiguration`, normatively required — a mixed-method TARA is not comparable and is an audit finding) and printed in the report: a quick-mode TARA is not audit-grade and must say so.

**Band boundaries and factor→value tables are organisation-specific.** Configurable (Attack Tree config dialog) and printed in the report. Populate defaults from Annex G Tables G.1–G.7 of the licensed copy — deliberately not reproduced here.

### Gate aggregation follows the quantity, not a config switch

An AND gate composes its children differently depending on **what** is being composed. These are different kinds of thing and they do not share an arithmetic:

| Quantity | AND | OR |
|---|---|---|
| **Attack potential** (effort: time, expertise, equipment) | **SUM** | **MIN** (attacker takes the cheapest branch) |
| **Probability** | **PRODUCT** — P(A∧B) = P(A)·P(B) | **UNION** — 1 − ∏(1 − pᵢ) |
| **Ordinal level only** (graded "high", no number behind it) | **MIN** (bottleneck) | **MAX** |

**This is deliberately not exposed as a setting.** Applying `min()` to an attack potential would claim that two weeks of work plus two weeks of work equals two weeks of work — a maths error, not a "conservative approach", and one an auditor who knows Annex G spots immediately. Likewise `min()` on probability reports 0.8 AND 0.8 as 0.8 rather than 0.64, understating the effort: the optimistic, i.e. dangerous, direction.

A config option whose wrong setting produces nonsense is not flexibility. It is a trap.

The bottleneck heuristic survives where it belongs: when a node is graded ordinally with no number behind it, no arithmetic is available and the weakest link is all there is. (The TARAflow methodology handbook documents min/max as the conservative heuristic for *reporting and prioritisation*, and explicitly points to probabilistic models for quantitative analysis. This is that distinction, made operational.)

**Two consequences that must be respected in the implementation:**

1. **Band once, at the end.** The aggregation runs on the *raw* quantity; the `FeasibilityLevel` is derived from the aggregated result. Banding the children first and then aggregating the levels would round twice and lose exactly the composition being computed.

2. **Mixed methods under one gate are an error.** An attack-potential child next to a quick-mode child cannot be combined — effort is not probability. The calculator returns undefined and the validator surfaces it, rather than inventing a number.

**Path feasibility** inherits the aggregated quantity of the deepest AND gate on the path, because that gate has already priced in the siblings the attacker must also clear. Rating the leaf in isolation reports a leaf under an AND as easy as if it stood alone.

### Two mappings, both in the same direction

Impact and feasibility are the two **independent** axes. Mapping one onto the other would collapse the matrix. What is needed is two inflows into one formula:

| | From | To | Status |
|---|---|---|---|
| **A** | Asset/Goal impact (11 criteria) | Impact on the risk scale | `assetImpactMapping` — **exists** |
| **B** | Path feasibility | `FeasibilityLevel` → risk scale | **missing** (Phase 2) |

Both feed `Risk = f(Impact, Likelihood)` — matrix (H.8) or formula (H.10).

---

## 6. Where mitigations live

| Concern | Owner | Other tab |
|---|---|---|
| **Where** a mitigation bites (which node, which paths die, which becomes cheapest next) | **Attack Tree** | Risks mirrors read-only |
| **Whether** the risk is accepted (treatment, MoSCoW, residual sign-off, ticket, verification) | **Risks tab** | Tree mirrors read-only |

Deciding which paths a control eliminates is inherently a tree operation and cannot be done in a flat table. That is the analytical value of the tree over STRIDE.

**"Risk after mitigation"** = feasibility of the cheapest path counting only mitigations marked `implemented` / `verified`. The tree computes it; the Risks tab displays it.

Read-only mirroring of `MitigationStatus` / `ticketId` into the tree is **already implemented** (`extractMitigationReferences`, `MitigationReference.status`).

---

## 7. Path identity — the biggest trap

**Problem:** `extractAllPaths` currently issues `id: "path-" + (++pathIdCounter)` — **index-based**. An analyst confirms 40 attack-path threats, edits one DSL line, every ID shifts, and all relevance decisions, ratings, mitigations and Jira links are silently orphaned.

**Requirement:** identity stable under unrelated edits.

```
pathKey  = sha1(rootName ␟ ... ␟ leafName).slice(0, 8)
threatId = `AT-${treeId}-${pathKey}`
```

Renaming a node still breaks identity — **correct**, it is a different scenario. Adding an unrelated sibling branch does not.

**Sync policy** — reuse the DFD↔Threat Class A/B pattern:
- **Class A (silent):** new path → new `unrated` threat.
- **Class B (banner):** a path backing a *confirmed* threat disappears or changes identity → banner; never silently delete an assessment.

Settle before the generator ships. Retrofitting stable identity onto persisted projects is painful.

---

## 8. Documentation / reporter

Without this, an attack-tree-focused TARA is not auditable.

1. **Per tree:** anchor (asset + security goal), the DSL, the rendered tree (SVG → `@resvg/resvg-js` for PDF), all paths with feasibility.
2. **Traceability:** for every attack-path threat in the register, which tree and which path produced it.
3. **Methodology section — mandatory:**
   - **likelihood model** (ISO `feasibility-only` vs. 62443 `feasibility-x-motivation`)
   - **gate aggregation** (SUM for effort, PRODUCT for probability, MIN for bare ordinals — §5)
   - **damage scenario cardinality** — the 1:1 simplification, stated explicitly (§4). A *declared* simplification is defensible; a silent one is a finding.
   - emission policy
   - feasibility method per tree (quick / attack-potential / CVSS / attack-vector)
   - feasibility band boundaries and factor values
   - impact source per tree (asset default vs. per-goal override) and aggregation method
4. **Non-emitted paths:** listed (documented, not risk-bearing). Silence looks like an omission.
5. **Mitigation effect:** cheapest path before vs. after, per tree.

Formats: Markdown / AsciiDoc / HTML / PDF / StrictDoc / **DocBook** (with a
configurable XSLT stylesheet — added v9, detail in `phase-7-reporter-design.md`
since Phase 7 hasn't started yet and this doc stays the normative summary,
not the working scope doc).

---

## 9. Phase ordering — DONE (v9)

~~For attack-tree-focused mode the natural tab order is `DFD → Assets →
Threats → Attack Tree → Risks`. But correctness comes from the **data
flow**, not tab position. Reordering touches `PhaseId`, `phaseStatus`,
migration and the reporter — ergonomics only. **Data flow first; tabs
last.**~~

Done, 2026-07-25/26 (Phase 9 of the implementation plan, §10): Attack Tree
now sits between Threats and Risk in every workflow — `isHighImpact`
("Critical System") no longer affects its position at all, and the
workflow-mode-based ordering machinery that used to implement the
conditional (`STANDARD_/CRITICAL_PHASE_ORDER`, `phase-navigation.ts`'s
mode-dependent functions) was removed down to nothing rather than left in
place unused. `PhaseId` renumbered accordingly (`Threats:4, AttackTree:5,
Risk:6`). See `taraflow.md` memory area for the full breakdown.

---

## 10. Implementation plan

**Principles:** inside-out (model → service → hook → UI), feature by feature, every phase tested, every phase its own commit.

Phases 1 and 2 are the expensive-to-retrofit ones. Do not reorder.

### Phase 0 — Decisions ✅ CLOSED
- **S/F/O/P:** Option C — preserve categories in `Risk.impactByCategory`; `overallImpact` stays the default display.
- **Impact location:** at the security goal (optional override of the asset default). **Both modes, identically.**
- **Benefit:** counts in the likelihood in 62443 mode only; analysis attribute in ISO mode.

### Phase 1 — Path identity ✅ DONE
`computePathKey`, `AttackPath.pathKey`, Class A/B diff between two `PathAnalysis` snapshots.
**Tests (unit):** stable under sibling insertion, branch reordering, whitespace/comment edits; changes on rename; collision-free; Class A vs. B classification.
**Commit:** `feat(attacktree): stable path identity via node-chain hash`

### Phase 2 — Feasibility model + Mapping B ✅ DONE
`FeasibilityLevel`, `FeasibilityMethod`, `LikelihoodModel`; attack-potential factors; `feasibilityMapping` config; quantity-driven gate aggregation (§5); calculator max-aggregation across paths (15.8 NOTE 2); parser audit mode.
**Commit:** `feat(attacktree): attack-potential feasibility per ISO 21434 Annex G`

> **Carried into Phase 3:** the calculator returns `undefined` for a gate mixing
> attack-potential and quick-mode children. The validator must turn that into an
> explicit error ("mixed rating methods under one gate"), otherwise the path
> silently has no feasibility and drops out of the analysis.

> **Outstanding, not phase-blocking:** calibrate `DEFAULT_ATTACK_POTENTIAL_WEIGHTS`
> and `DEFAULT_FEASIBILITY_BANDS` against Annex G Tables G.6/G.7 of the licensed
> standard. The shipped values are structurally correct but are not the standard's.
> Must happen before any customer TARA.

### Phase 3 — Impact at the security goal ✅ DONE
`SecurityGoal.impactRatings?` (optional override; absent → asset default, so existing projects are untouched); `asset-impact-resolver` with resolution order and category preservation (S/F/O/P + other, MAX within category, `null`/`"na"` excluded rather than coerced to 0); `averagingWouldBurySafety` guard; validator error for mixed rating methods (carried from Phase 2); validator info for the deprecated leaf `i=`.
**Commit:** `feat(assets): impact belongs to the security goal, not the asset`

> **The service is dormant.** Like Phase 1's `pathKey`, it is complete and tested
> but nothing calls it. Phase 6 is its first consumer.

> **Deferred from Phase 3, deliberately:**
> - `SecurityGoal.damageScenario?: string` (§4) — the description that closes the
>   traceability gap. Small, add it with the override UI.
> - `Risk.impactByCategory` — the resolver produces the breakdown, but writing it
>   into `Risk` touches `risk-assessment-types.ts` and the risk table. Phase 6.
> - Forcing `conservative` (MAX) in ISO mode — belongs in
>   `asset-impact-calculator.ts`, which Phase 3 does not touch.
>   `averagingWouldBurySafety()` is the predicate it will use.
> - UI for the per-goal override. Model and resolution are in; the editor is not.

### Phase 4 — Threat generator
`StrideMethod` += `"attack-path"`; `generateThreatsFromAttackTree` (pure); emission policy in the config dialog; standalone trees emit nothing.
**Tests (unit):** correct `strideCategory`; each policy emits the right set; mitigations carried over; `pathKey` in the id; standalone → no threats; zero-benefit path suppressed in 62443 mode.
**Commit:** `feat(attacktree): emit threat scenarios from attack paths`

### Phase 5a — Threat sync, asset-anchored path (new threats)
The direct successor to Phase 4. An `asset`-anchored tree emits new threats; the
app layer translates `ThreatReference` → `Threat` and feeds the existing
`syncRisksFromThreats`. Class A/B sync (Phase 1 `diffPathAnalysis`): a new path
appears silently as `unrated`; a path backing a *confirmed* threat that vanishes
or changes `pathKey` raises a banner. Attack-path threat table (confirm / dismiss
/ uncertain), reusing the existing relevance workflow.
**Prerequisite:** merge the duplicate `ThreatReference` — `risks/` carries a near-
identical copy of the `shared/` one (differs only by `initialImpact`, which shared
already has). risks imports from shared; the local definition is deleted.
**Tests (unit + component):** new path → silent `unrated`; vanished confirmed path
→ banner, assessment retained; relevance survives an unrelated edit; standalone /
threat-anchored trees produce no new threats here.
**Commit:** `feat(attacktree): sync asset-anchored attack-path threats (Class A/B)`

### Phase 5b — Tree likelihood into the referenced risk, threat-anchored path

A `threat`-anchored tree emits **no** new threat. It contributes its likelihood
to the *existing* risk of the threat it refines.

#### The model: the tree is one likelihood factor (project may make it advisory)

**Superseded:** an earlier draft gave `Risk` a `likelihoodSource: "factors" |
"attack-tree"` discriminator and a `mode: "supplementary" | "authoritative"`.
Both are **dropped.** They encoded "either the factors *or* the tree drives",
and analysis of the three real cases shows the tree never *overrides* existing
factors — so the discriminator described a case that does not exist.

The rule is one line:

> The tree likelihood is a predefined **likelihood-category factor**
> (`attack_tree_likelihood`), default weight 1, that averages into the same
> weighted mean as the OWASP likelihood factors in `calculateRiskValues`.

All three cases fall out of that single rule, with **no** special-casing:

| Case | Anchor | Mode | Other likelihood factors present? | Result |
|---|---|---|---|---|
| **1 — refine** | `threat` | Standard | yes (OWASP) | tree factor **averages in** — supplements, does not override |
| **2 — new** | `asset` | Standard | no | tree factor is the **only** likelihood factor → likelihood = tree value |
| **3 — ISO** | `threat`/`asset` | ISO | no (ISO has no OWASP factors) | tree factor is the **only** one → likelihood = tree value |

"The tree overrides all factors" (`authoritative`) never occurs: in case 1 there
are factors and the tree *supplements* them; in cases 2 and 3 there are no
factors to override. A weighted mean of a single factor is that factor — so
cases 2 and 3 need no code path of their own.

**Two orthogonal knobs, both already part of the factor machinery — no special
mechanism to build:**

1. **Project-global: `treeLikelihoodContribution: "factor" | "advisory"`**
   (default `factor`). Governs **case 1 only**.
   - `factor` — the `attack_tree_likelihood` rating is written into the risk's
     `factorRatings[]` and averages in.
   - `advisory` — the tree value is recorded as provenance
     (`attackTreeAssessment`) and **shown** to the analyst, but **no active
     factor is written**, so `calculateRiskValues` never sees it and the analyst
     drives the factors himself. This is the old `supplementary` intent, done by
     *not creating the factor* rather than by a discriminator — so the
     calculation still has no branch.
   - Cases 2 and 3 ignore this setting: there are no other factors, so the tree
     drives regardless of `factor`/`advisory`.

2. **Per-factor: `weight`** — when the factor *is* active, its weight defaults to
   1 but is adjustable in the risk-config dialog exactly like `motive`,
   `skill_level`, and every other factor. `attack_tree_likelihood` is an ordinary
   predefined factor and inherits the whole `ActiveFactor` weight/enable/config
   machinery. Nothing bespoke.

`attackTreeAssessment` provenance (treeId, pathKey, raw value) is persisted in
**both** modes — the audit trail records which tree/branch informed the risk even
when the project chose `advisory`.

#### What the tree contributes — likelihood only, never impact

Every DSL leaf formula carries an impact (`p,i`, `f,b,i`, or the impact implied
by attack-potential + goal). **That impact never enters the risk.** Impact
belongs to the (asset × security-goal) damage scenario (§4). The tree contributes
only the **likelihood component**, mapped to the risk scale via Mapping B:

| Leaf form | Likelihood component taken | Impact `i` |
|---|---|---|
| `p,i` (simple) | `p` | discarded |
| `f,b,i` (extended) | `f` (ISO) · or `f`+`b` folded via `computeLikelihood` (62443) | discarded |
| attack-potential | banded `FeasibilityLevel` → Mapping B | — (impact from goal) |

Benefit `b` folds in only in 62443 mode (Cl. 3.1.29). This is exactly the
`computeLikelihood` already built in Phase 2 — 5b reuses it, adds no arithmetic.

#### Branch selection (case 1)

A refining tree has 1..n branches. Unlike 5a (asset-anchored, where competing
paths are max-aggregated — the attacker's easiest route), a `threat`-anchored
tree refines **one** STRIDE threat whose attack vector is already fixed. So the
analyst **picks** the relevant branch; its likelihood component becomes the
factor value. No max-over-branches — a selection.

#### Before-mitigation only

The tree feeds **only** the before-mitigation likelihood. Residual
(after-mitigation) likelihood stays an analyst assessment in the Risk tab — the
close loop lives there, not in the tree. The tree is a before-mitigation
instrument.

#### Provenance (not a discriminator)

```ts
interface Risk {
  // Provenance — records WHICH tree/branch informed this risk, for the audit
  // trail and AT-Branch traceability. Persisted in BOTH modes. In `factor` mode
  // the active attack_tree_likelihood entry in factorRatings[] does the work;
  // in `advisory` mode THIS is all there is — the value is shown, not applied.
  // It is never itself a discriminator; behaviour comes from whether the factor
  // was written, which the project setting decides.
  attackTreeAssessment?: {
    treeId: string;
    pathKey: string;                 // the picked branch (Phase-1 identity)
    likelihoodComponent: number;     // raw 0..1 (p or f/f·b) before Mapping B
    strideCategory: StrideCategory;
  };
}
```

The `attack_tree_likelihood` entry in `factorRatings[]` carries
`source: "attack-tree"` (a new `FactorRating.source` value alongside
`"derived"` / `"manual"`), so the asset-criteria prefill never overwrites it —
the same protection `"manual"` already gets.

#### Implementation reality — as built (supersedes the sketch above where they differ)

Building 5b surfaced three refinements the sketch did not anticipate. They do not
change the *model* (one likelihood factor, averages in) but they fix *where* the
factor is written and *how* it survives.

**1. Two independent syncs, not one.** The tree factor does **not** travel through
`syncRisksFromThreats`. That function rebuilds each risk's `factorRatings[]` via
`reconcileFactorRatings`, which reconstructs the list from **enabled
`activeFactors` only** — and `attack_tree_likelihood` is deliberately *not* an
enabled activeFactor (it is data-driven, not analyst-configured). Routed through
the threat sync it was discarded on every second sync.

The fix follows the natural seam: the STRIDE sync and the attack-tree sync have
**different triggers** (a threat changes vs. a tree changes). So they are
**separate passes**, chained additively:

```
syncRisksFromThreats(riskData, threats, …)        // STRIDE: threats → risks + OWASP/impact factors
  → syncRisksFromAttackTrees(riskData, refs, contribution)   // trees → the attack_tree_likelihood factor
```

`syncRisksFromAttackTrees(riskData, attackTreeLikelihoods, contribution) →
RiskData` is the **sole owner** of the factor: it sets it where a tree feeds a
risk (matched by `riskId === risk.threatId`), clears it where none does or in
`advisory` mode, and recomputes only the before-mitigation values. The threat
sync no longer references the factor at all.

**2. `reconcileFactorRatings` exempts `source: "attack-tree"`.** So the threat
sync passes the tree factor through untouched instead of discarding it — the two
syncs stay independent, and no auto-enable of the factor into `activeFactors` is
needed. (An earlier plan to auto-enable it, mirroring safety, is **dropped** —
the exemption is the cleaner seam and keeps "enabled activeFactor" and
"tree-derived rating" as distinct concepts.)

**3. The app-layer builder does Mapping B.** `build-attack-tree-likelihood-references.ts`
(app/utils, twin of `build-attack-path-threat-references.ts`) reads the tree
store and emits `AttackTreeLikelihoodReference[]` — a **shared** type
(`src/shared/attacktree-reference-types.ts`) carrying `mappedValue` already on
the risk scale. `features/risks` imports only from `shared`, never from
`features/attacktree`. Asset-anchored trees emit **per path** (each emitted path
is its own risk, keyed by `buildThreatId(treeId, pathKey, stride)` = the 5a
threat id); threat-anchored trees emit **once**, aggregated
(`aggregatedLikelihoodLevel`, the ISO 15.8 max). An unrated path — or a
threat-anchored tree with no `strideCategory` — contributes **nothing** (never a
silent low).

**Related bug fixed alongside (own commit).** Impact factors were only enabled
when a linked asset carried a rated criterion, so a threat with **no** asset link
showed *no* impact factors in the risk dialog (the dialog renders only enabled
factors). Impact is intrinsic to a risk, so `updateImpactFactorsAutoEnable` now
enables all impact factors unconditionally; they stay unrated (value 0) until the
analyst fills them. This is independent of 5b and ships as
`fix(risks): always enable impact factors so asset-less threats show them`.

**All trees feed risk, both anchors, both methods** (Juergen's call): the risk
treatment — MoSCoW, mitigations, prioritisation — lives in the Risk tab, so every
tree that determines a likelihood feeds a risk there rather than duplicating that
workflow in the attack-tree tab.

**Impact stays read-only in the risk dialog, editable only at source (SSoT):**
Impact S/F/O/P shown with a provenance link to the Asset tab (`ResolvedImpact.source`
from Phase 3 says goal-override vs. asset-default). Editing it in the risk dialog
would fork the one impact that belongs to (asset × goal).

**Close loop unaffected.** `Risk → threat → linkedAssetIds → element` is intact
(Phase 4 sets `linkedAssetIds`); verify only.

**Tests (unit + integration):**
- Case 1, `factor` mode: tree factor + OWASP factors → correct weighted mean;
  removing the tree factor leaves the OWASP-only result byte-identical.
- Case 1, `advisory` mode: no `attack_tree_likelihood` rating is written;
  `calculateRiskValues` gives the OWASP-only number; `attackTreeAssessment`
  provenance is still persisted.
- Cases 2 & 3: tree factor alone → likelihood equals the mapped tree value, with
  no special code path.
- Adjusting the `attack_tree_likelihood` weight in the config changes the mean as
  for any other factor (it is not pinned to 1).
- Impact `i` from the leaf never appears in the risk (impact comes from the goal).
- 62443 folds benefit, ISO does not, from the same tree.
- Asset-criteria prefill does not overwrite a `source: "attack-tree"` rating.
- An existing factor-only risk with no tree is unchanged.

**Commit split (as built):**
- ✅ `refactor(attacktree): i18n keys for ValidationError` + `refactor(attacktree): move all UI strings to i18n, remove isGerman branching` (prereq: validator/parser/UI moved to i18n before the ISO messages landed)
- ✅ `feat(attacktree): project-wide feasibility config + ISO method enforcement (5b-1a)` — RC-15-11 method axis, project-wide, ISO enforces an *implemented* method; CVSS (5b-1b) and attack-vector (5b-1c) still owed
- ✅ `fix(risks): always enable impact factors so asset-less threats show them` (independent bug)
- ✅ `feat(risks): attack-tree likelihood as a project-configurable likelihood factor` — the factor, `setAttackTreeLikelihoodFactor`, the shared reference type
- ✅ `feat(risks): sync attack-tree likelihood into risks via a separate pass` — `syncRisksFromAttackTrees`, the `reconcileFactorRatings` exemption, the app-layer builder

**Still owed to finish 5b end-to-end:**
- `use-risk-sync.ts` chains `syncRisksFromThreats → syncRisksFromAttackTrees` and threads `attackTreeLikelihoods` from the `RiskProjectData` prop
- `RiskProjectData.attackTreeLikelihoods` field + the `buildAttackTreeLikelihoodReferences` call in `workspace-layout.tsx`
- `treeLikelihoodContribution` as a real project setting + UI toggle (defaults to `"factor"` at the call site today)
- `attackTreeAssessment` provenance field on `Risk` (persisted in both modes)
- 5b-1b (CVSS RC-15-13) + 5b-1c (attack-vector) parsers/banding + the config-dialog method selector

### Phase 6 — Risks tab UI integration
Wire the model of 5a/5b into the dialog and table: render the
`attack_tree_likelihood` factor with its provenance link (treeId/pathKey → Attack
Tree tab), show it read-only (edited at source, not in the risk dialog), render
the before/after mitigation split. When it is the only likelihood factor (cases 2
and 3) the factor UI collapses to that single row — driven by which factors are
present, not by a discriminator. `getRisksByStrideMethod` and friends gain
`"attack-path"`.
**Tests (integration):** end-to-end asset → tree → threat → confirmed → risk;
ISO vs. 62443 differ from the same tree; STRIDE-mode project unaffected.
**Commit:** `feat(risks): attack-tree provenance and factor-hiding in the dialog`

### Phase 7 — Documentation + reporter
Per §8, including the mandatory methodology section and DocBook (v9).
**Superseded as the working scope doc by `phase-7-reporter-design.md`** —
not started yet; this section stays the normative summary.
**Tests:** golden/snapshot per format; methodology present; traceability risk → tree → path.
**Commit:** `feat(report): attack tree analysis, traceability and methodology section`

### Phase 8 — UI rework (unblocked, parallel)
Originally scoped as polish — split-handle drag, rename, guarded delete. Working
through 5b and Phase 6 on the real UI showed the problem is structural: the tree
selector lives inside one view and vanishes in the other, the "overview" reads as
a settings page, and the table view shares nothing with the Threat and Risk tabs.

**Superseded by `attacktree-ui-rework-design.md`.** Steps 1-3 (shared table,
attack-tree table on it, detail view) and step 5 (retire the emission policy)
are DONE and committed as of 2026-07-24/25, with tests. Only step 4 — overview
rename and guarded delete — remains.

### Phase 9 — Phase reordering — DONE (v9)
Per §9. Shipped 2026-07-25/26.

---

## 11. Open questions

1. **1:n damage scenarios** — OPEN. Revisit when a customer needs *separate risk treatment decisions per consequence* ("we accept the equipment damage but not the injury", both from one integrity violation). Until then the 1:1 simplification holds (§4). Trigger, not a deadline.
   *Intermediate option, should this be reopened:* treatment and MoSCoW per impact category on one risk. `impactByCategory` already exists and 15.8 NOTE 1 permits a risk value per category, so "financial: accept, safety: reduce" becomes expressible without a damage-scenario entity — leaving `AttackTreeAnchor`, `pathKey`, the generator and the Risks tab untouched. It does not separate two consequences in the *same* category, which is the loss §4 already names.
2. **EN 50742 vs. Annex G** — CLOSED. The two factor sets are different and are never applied in parallel: method choice is exclusive per project, so there is nothing to map. Consequence worth recording: a project cannot be converted between the two without re-rating.
3. **Hazards toggle** — MOVED to `safety-feasibility-coupling-design.md`. Safety is impact-side only today by omission rather than by decision; that document frames the options and recommends keeping it impact-side while adding a validation cross-check.
4. **Mitigation ownership** — NEW, see `mitigation-ownership-design.md`. Status and ticket live on `SelectedMitigation`, i.e. per risk, so the same catalog measure selected in three risks produces three tickets. Surfaced by the attack-tree table showing mitigations per path.
