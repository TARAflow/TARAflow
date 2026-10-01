# TARAflow — Risk Factors: Impact Aggregation and Likelihood Scales

> **Purpose of this document:** decide (A) how the impact of a risk is aggregated from its impact factors, per regulation preset, and how existing projects move to it, and (B) how the levels of the likelihood factors are labelled so they read in the direction they count. Binding once accepted: the decisions in §5, §7.4 and the migration rules in §6, §7.5. Nothing is implemented yet.

**Status:** Draft rev. 2 — open for review
**Code baseline:** `a0f177e`
**Related:** `doc/InProgress/Asset/security-goal-rework-design.md` (Phase 4 delivers per-goal impact *values* to the risk; this document is about how those values are *combined*)

---

## 1. Context

The risk of a threat is `R = Impact × Likelihood` (`calculateRiskValues`, `features/risks/services/risk-calculation-service.ts`), banded into a risk level by the matrix of the configured scale.

Impact factors are prefilled from the linked assets (`applyAssetCriteriaToFactorRatings`): one risk impact factor per asset impact criterion (`financial_damage`, `operational`, `regulatory_compliance`, `privacy`, `safety`, …). Since the security-goal rework Phase 4, the values come from the security goals the threat violates.

This document is about the step after that: how the impact factor **values** of one risk become **one impact**.

## 2. Current state (verified in code)

| Aspect | Asset tab | Risk tab |
|---|---|---|
| Aggregation | `AssetConfiguration.calculationMethod`: `"conservative"` (MAX, default) or `"average"` (weighted mean) | always the **weighted mean** of all rated impact factors (`weightedAvg` in `calculateRiskValues`); no alternative |
| Weights | per criterion, `AssetConfiguration.impactCriteria[].weight` | per factor, `RiskConfiguration.activeFactors[].weight`, default 1.0 — **independent** of the asset weights; nothing copies them over |
| Safety | one criterion among others | one impact factor among others, averaged like the rest |

Further facts:
- The option "Standard / Conservative" in the risk configuration dialog is `RiskConfiguration.roundingMethod` (`round` / `ceil`, label "Level Threshold Calculation"). It rounds the result; it does **not** choose between MAX and mean.
- Regulation presets (`shared/models/regulation-preset.ts`) define the likelihood method (`likelihoodMethod`). They define nothing about the impact. The ISO 21434 preset seeds the SFOP criteria (safety, financial_damage, operational, privacy) — and the risk then **averages** them.
- The matrix: `generateRiskMatrix` bands `ceil(impact × likelihood / size)`; optional `severityThresholds`.

## 3. Problem

### 3.1 Dilution

A weighted mean pulls every impact towards the middle as soon as not all factors are high. The worst consequence is negotiated down by harmless ones:

| Safety | Financial | Operational | Privacy | Weighted mean (all weights 1) |
|---|---|---|---|---|
| 4 | 1 | 1 | 1 | **1.75** |
| 4 | 4 | 1 | 1 | 2.5 |
| 4 | 4 | 4 | 4 | 4 |

A possibly fatal outcome (safety 4) ends up as a low-to-medium impact. The more harmless factors are rated, the lower the risk — although nothing about the worst outcome changed. Conservative rounding (`ceil`) does not repair this: 1.75 → 2.

### 3.2 Inconsistency between asset and risk

With the asset default `"conservative"`, an asset can have overall impact 4 while every risk built on it has impact below 4.

### 3.3 Two weight sets for the same quantities

Asset criteria and risk impact factors are the same quantities (the sync copies the value 1:1), but carry independent weights. With identical data, the asset tab's mean and the risk tab's mean differ, and the UI does not show why.

### 3.4 ISO/SAE 21434 is not followed

ISO 21434 rates the impact **per category** (15.5: safety, financial, operational, privacy) and lets the risk value be determined per impact rating (15.8, NOTE 1). It treats the categories equally — no category weighs more than another — and nowhere averages them. "Equally" means *unweighted*, not *averaged*.

### 3.5 What is not the problem: the matrix thresholds

The weighted mean divides by the sum of the weights, so its result always lies within the scale (1…4 on a 4-level scale). Impact 4 is reachable whenever all impact factors are 4, whatever the weights. Weights only shift which factors pull the mean harder; they do not shrink the reachable range. Lowering the thresholds would hide the dilution and break comparability with other projects and with the standards. **The thresholds stay.**

## 4. Requirements

1. The worst consequence must not be diluted by unrelated mild ones where a standard or safety demands it.
2. The aggregation is a property of the regulation preset, like the likelihood method — the analyst should not have to know which method a standard expects.
3. The default for the standard preset is **not** a pure maximum (analyst decision): business consequences may be weighed against each other.
4. Safety is never diluted.
5. One source of weights for impact.
6. Existing projects never change silently (ground rule of the security-goal rework: no silent change of analyst decisions or results).
7. The analyst sees how the impact of a risk was formed.

## 5. Proposal

### 5.1 New setting: `RiskConfiguration.impactAggregation`

| Value | Impact of a risk |
|---|---|
| `"weighted-mean"` | weighted mean of all rated impact factors — **today's behaviour** |
| `"safety-floor"` | `max(safety, weighted mean of the other rated impact factors)`; without a safety rating = weighted mean |
| `"max"` | maximum of all rated impact factors, no weights |

`safety-floor` is the proposal for "safety always at 1.0": safety enters the impact fully and undiluted; the business factors are still weighed. A mere safety weight of 1.0 would not achieve this — with the mean divided by the weight sum, safety at 1.0 is exactly as strong as every other factor at 1.0.

### 5.2 Defaults per preset

`RegulationPreset` gets `impactAggregation`, applied like `likelihoodMethod`:

| Preset | `impactAggregation` | Reason |
|---|---|---|
| `standard` | `safety-floor` | weighs business consequences, never dilutes safety (req. 3, 4) |
| `iso-21434` | `max` | SFOP rated equally and unweighted; the worst category determines the risk (15.5, 15.8) |
| `etsi-tvra` | `safety-floor` | *open — §8* |
| `en-50742-a` | — | *open — §8*: the SRSL path uses its own severity on the safety-function asset |
| `en-50742-b` | `safety-floor` | *open — §8* |

### 5.3 One source of weights for impact

Impact factor weights are **taken from the asset criterion weights** (`AssetConfiguration.impactCriteria[].weight`) and shown read-only in the risk configuration, with a hint where they are set. Likelihood factor weights stay in the risk configuration — they have no counterpart in the asset tab.

With `max`, weights do not apply and are hidden for the impact.

### 5.4 Worked examples

| S | F | O | P | `weighted-mean` | `safety-floor` | `max` |
|---|---|---|---|---|---|---|
| 4 | 1 | 1 | 1 | 1.75 | **4** | 4 |
| 1 | 4 | 1 | 1 | 1.75 | 2 | **4** |
| 2 | 4 | 4 | 1 | 2.75 | 3 | 4 |
| — | 3 | 1 | — | 2 | 2 | 3 |

Row 2 shows the deliberate trade-off of `safety-floor`: a severe financial consequence is still weighed against mild others. Under ISO 21434 (`max`) it is not.

### 5.5 Making the impact explainable

The risk dialog shows next to the impact how it was formed, e.g.:
- `Impact 4 — safety (floor)`
- `Impact 4 — highest category: financial`
- `Impact 2.5 — weighted mean of 4 factors`

### 5.6 ISO 21434: risk per category (later, optional)

15.8 NOTE 1 allows one risk value per impact category. That would mean four risk values per risk (S, F, O, P), treatment decided per category, the highest shown in the register. It changes the risk model and the register; it is listed as a later phase (§8) and not a prerequisite. `max` already gives the same *highest* risk value.

## 6. Existing projects

- A project without `impactAggregation` behaves as `weighted-mean` — exactly as today. Loading never changes a risk value.
- Changing the aggregation (in the risk configuration, or by setting a regulation tag whose preset defines it) is an **explicit decision**: a preview lists every risk whose impact or risk level changes (before → after), and only "apply" changes them — the same pattern as the drift review for threats.
- New projects get the preset default.
- The change is recorded like any configuration change (audit trail).

## 7. Likelihood factor scales

### 7.1 Current state (verified in code)

Likelihood factors of the weighted-mean presets (`standard`, the OWASP-derived set, and further optional factors) are rated on the **generic likelihood scale** (`LIKELIHOOD_SCALES`): the risk dialog offers `1 – Very Low`, `2 – Low`, `3 – Medium`, `4 – High` for every factor, whatever it measures (`risk-dialog.tsx`, branch `def.category === "likelihood"`). Factor-specific level texts exist only for:
- ISO 21434 (`ISO21434_FACTOR_LEVELS`, own rendering `renderIsoFactorRow`) — e.g. expertise *layman … multiple experts*;
- EN 50742-A (`EN50742_FACTOR_LEVELS`) — EL0…EL4, attacker capability bands;
- ETSI TVRA has a level registry in its core (`TVRA_FACTOR_LEVELS`), but the risk dialog does **not** use it (no reference found) — TVRA factors appear to be labelled with the generic scale. *To be verified in the app.*

The factor values are oriented **towards likelihood**: a higher value means the attack is more likely (OWASP Risk Rating: skill level 9 = "no technical skills"). The factor *names*, however, describe a property of the attacker or the weakness.

### 7.2 Problem

Name and level label read in opposite directions:

| Factor | Selected | Reads as | Means |
|---|---|---|---|
| Skill level | 4 – High | "the attacker needs high skill" | **no** skill needed — the attack is likely |
| Opportunity | 4 – High | "a lot of opportunity is required" | **no** access or resources required |
| Intrusion detection | 4 – High | "detection is good" | the attack is **not** logged |

The analyst has to translate every rating mentally; a misread inverts the factor. For TVRA (§7.1) the generic label may even run against the stored level order (value 1 = `<=1day`, the fastest attack, labelled "Very Low").

### 7.3 Requirements

1. Each level of each likelihood factor names the **situation** it stands for, not a direction-free "high / low".
2. The order stays: value 1 = least likely … highest value = most likely. Calculation, matrix and stored values do not change.
3. Labels are translatable (i18n), keyed by a stable level key, not by the number.
4. Works for the 3-, 4- and 5-level scale.
5. Custom factors without own labels still show the direction.

### 7.4 Proposal

**Per-factor level anchors** — a registry `LIKELIHOOD_FACTOR_LEVELS: Record<factorId, levelKey[]>` (5 anchors, least → most likely), like the existing ISO / TVRA / EN 50742 registries. The 4- and 3-level scales use fixed subsets. Labels: `risks.factorLevels.<factorId>.<levelKey>` (en/de). The dialog shows `4 – No technical skills` instead of `4 – High`; the generic likelihood label stays visible as a small colour chip, so the contribution is still readable.

Proposed anchors — the level descriptions of the OWASP Risk Rating Methodology, from which the standard factor set is derived (OWASP uses 0–9 with three to six named steps per factor); `deployment_scope` is TARAflow's own. Final wording during implementation:

| Factor | 1 (least likely) | 2 | 3 | 4 | 5 (most likely) |
|---|---|---|---|---|---|
| `skill_level` — skill required | security penetration skills | network & programming skills | advanced computer user | some technical skills | no technical skills |
| `motive` — reward for the attacker | low or no reward | | possible reward | | high reward |
| `opportunity` — access / resources required | full access or expensive resources | special access or resources | some access or resources | | no access or resources |
| `size` — group of potential attackers | developers, system administrators | intranet users | partners | authenticated users | anonymous internet users |
| `ease_of_discovery` | practically impossible | difficult | easy | | automated tools available |
| `ease_of_exploit` | theoretical | difficult | easy | | automated tools available |
| `awareness` — how known | unknown | hidden | obvious | | public knowledge |
| `intrusion_detection` | active detection in the application | logged and reviewed | logged, not reviewed | | not logged |
| `deployment_scope` | single installation | several systems of one customer | all installations of a product type | | all customers (supply chain) |

Empty cells: OWASP names fewer steps for that factor than the 5-level scale has (motive: three; opportunity, discovery, exploit, awareness, detection, deployment scope: four). How three or four anchors spread over the 3-, 4- and 5-level scale is open question 6 (§9).

**Factor names follow the direction where that helps** — e.g. *Skill level* → *Skill required*; descriptions state "higher = attack more likely".

**TVRA:** render `TVRA_FACTOR_LEVELS` in the dialog like the ISO levels (separate fix; verify the order first).

**Custom factors:** keep the generic scale, with the header hint "1 = attack unlikely … N = attack likely".

### 7.5 Existing projects

None affected: only labels change; stored values, calculation and matrix stay as they are. The report shows the new labels as well.

## 8. Implementation phases

1. **Calculation** — `impactAggregation` in `RiskConfiguration` (optional, absent = `weighted-mean`), the three variants in `calculateRiskValues`, preset field and defaults. Pure, fully tested; no UI, no behaviour change for existing projects.
2. **Configuration and migration** — setting in the risk configuration dialog with explanation and the worked example; preview of changed risks before applying; preset application through the same preview.
3. **Explanation** — "how the impact was formed" in the risk dialog and in the report.
4. **One weight source** — impact factor weights from the asset configuration, read-only in the risk configuration.
5. **Optional: ISO risk per category** (§5.6).
6. **Likelihood factor labels** (§7) — independent of 1–5, can come first: level registry, i18n en/de, risk dialog and report; TVRA levels in the dialog. No calculation change.

## 9. Open questions

1. **ETSI TVRA and EN 50742-B:** `safety-floor` or `max`? TVRA's own impact scale is a single value per threat — does it need an aggregation at all?
2. **EN 50742-A:** severity is a 3-level criterion on the safety-function asset (reversible / non-reversible / fatal) and feeds the SRSL, not `R = I × L`. Does the R-path need a rule there, or is it out of scope?
3. **Floor for further harm to people and environment?** `physical_damage` and `environmental` describe physical harm as well. Should they share the floor with safety (`max(safety, physical_damage, environmental, mean of the rest)`)?
4. **Asset tab:** keep `calculationMethod` as an asset-prioritisation setting independent of the risk, or align its default with the preset? (It does not feed the risk.)
5. **Scope of the preview:** only risk level changes, or also impact changes within the same level?
6. **Anchors on 3/4/5 levels:** OWASP names three to five steps per factor. Use the named steps where they exist and interpolate wording for the gaps, or keep fewer selectable levels for such factors (e.g. motive: 1 / 3 / 5 only)?
7. **Rename factors** (*Skill level* → *Skill required*, *Opportunity* → *Access required*)? Changes names in existing reports; keys stay.
8. **TVRA:** confirm in the app that the dialog shows the generic scale for TVRA factors and in which direction the stored index runs.

## 10. Change history

- **Rev. 1:** draft — problem analysis from code, proposal (three aggregation variants, preset defaults, one weight source, explicit migration), phases, open questions.
- **Rev. 2:** added Part B (§7): likelihood factor scales — the generic "Very Low … High" labels read against the direction of factors like skill level; proposal: per-factor level anchors (i18n), names following the direction, TVRA levels in the dialog. Phase 6 and open questions 6–8.
