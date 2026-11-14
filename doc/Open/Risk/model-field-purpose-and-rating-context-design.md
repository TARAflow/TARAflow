# TARAflow — Model Field Purpose and Rating Context

> **Purpose of this document:** many asset and DFD fields are entered (some even demanded by a validator) but read by nothing — not by threat generation, not by the risk rating, not by compliance, not by the report. This document (A) records that finding with evidence, (B) states what these fields were meant for — *context that makes the rating of attack feasibility better founded* — (C) designs the missing bridge from the model to the rating ("rating context"), and (D) proposes a rule plus a guard test so that no input field is without a purpose again. Binding once accepted: the principles in §4 and the decisions in §9.

**Status:** Rev. 2 — proposal; D1 decided for 0.19 (2026-11-14), other decisions open (§9)
**Code baseline:** `5fe3b693` (branch `feature/0.19-component-tara`, after "retire the asset field protection need")
**Related:**
- `doc/Done/Risk/risk-impact-aggregation-design.md` — how impact factor values are combined (this document is about the *likelihood* side)
- `doc/Done/Asset/security-goal-rework-design.md` — CIANAAA goals and the deriver inputs that *are* live
- `doc/Done/multi-project-tara-design.md` — intrinsic vs context factors, factor prefill of imported components
- `doc/InProgress/Sensor_Actuator/ELEMENT-sensor-actuator_v0_5.md` — `injectability` / `controllability` (planned feasibility gating)
- `doc/Assetbasierte_Steuerung_Bedrohungsanalyse.md` — asset-driven analysis depth (vertieft / fokussiert / hochstufig)

---

## 1. Context

The asset field *Protection need* was retired in 0.19 (`5fe3b693`): a free low…critical dropdown that no calculation read, that could contradict the impact rating, and whose validator warning claimed it was "required for threat prioritisation". Looking for more of the same showed that it was not an isolated case.

The review question was first "does the threat generator read the field?". That is the wrong test for most of these fields. Their original intent was different:

> The fields should give enough context to rate a threat better. Example: frequency has a large effect on the window of opportunity — whether certain data is sent only once or always/often makes a big difference.

So the fields are meant for the **attack feasibility rating** (window of opportunity, equipment, knowledge, opportunity, intrusion detection, …), not for **threat selection**. The gap is not that a generator forgot them; it is that no path from the model into the rating exists at all — with one exception (§2.3).

## 2. Current state (verified in code at `5fe3b693`)

### 2.1 How threats and risks see assets

The threat and risk features receive assets only through the `AssetReference` read model (`shared/models/asset-reference-types.ts`): id, name, group, aggregated impact, `physicalImpact`, high-value-asset level, hazard-target flag, linked elements, active security goals, impact ratings. **None of the group properties of §2.2 are in it.**

Threats are generated per DFD element and per interaction (`features/threats/services/per-element`, `per-interaction`, STRIDE modifier, threat catalogue). They read **element** properties. The asset contributes the damage side (goals, impact). This is the "active-impact model" of `doc/taraflow-asset-relations.md` and it is sound: attack surface lives on elements, damage lives on assets.

### 2.2 Asset properties (`AssetProperties`, `shared/models/asset-property-types.ts`)

"Read by" counts code that calculates, derives, prefills or reports with the field. Plumbing (types, mappers, asset sync, diff, form, validator) does not count.

**Live** (read by a deriver or the rating):
`category`, `isSecureStorage`, `isBusinessSecret`, `isPersonalData` (CIANAAA deriver); `isHighValueAsset(+Source)`, `assetDestructionImpact`, `replacementLeadTime`, `vendorDependency`, `spareAvailability` (HVA deriver); `physicalImpact(+Source, +Rationale)`; `description` (report).

**A — demanded by the validator, read by nothing.** The warnings (`asset-property-validator.ts`, texts in `dfd.json` → `dfdValidation.assetMissing*`) promise an effect that does not exist:

| Field (group) | Warning text claims |
|---|---|
| `dataType` (data) | "required for Information Disclosure / Tampering threat selection" |
| `lifecycle` (data) | "required for retention and deletion threat scenarios" |
| `criticality` (system) | "required for threat prioritisation" |
| `exposure` (system) | "required for attack surface assessment" |
| `physicalAccessControl` (infrastructure) | — (no reason given) |
| `serviceType` (service) | "required for supply chain threat assessment" |
| `responsibility` (service) | "required for CRA Art. 13 supply chain obligations" |
| `role` (human) | "required for privilege escalation / insider threat scenarios" |
| `automationLevel` (process) | — (no reason given) |

**B — in the form, not validated, read by nothing, not in the report:**
`changeFrequency`, `domain`, `regulatoryReference`, `isValidatedProcess`, `validationRationale`, `location`, `environmentalHazard`, `isUnique`, `uniquenessRationale`, `portability`, `responsibilityScope`, `providerName`, `slaReference`, `securityRelevant`, `isProtectionTarget`, `isSafetyFunction`, `externalRefs`, `owner`, `notes`.

Note on `isSafetyFunction`: `doc/taraflow-asset-relations.md` ("Threat derivation", Function assets) states that Tampering, DoS and Spoofing are *prioritised automatically* for function assets with this flag. That is not implemented. A reader who sets the flag relies on behaviour that does not happen.

**C — dead model fields** (no input, no writer, no reader):
`businessImpact`, `businessImpactCategory`, `aggregatedCriticality`, `strideDepth`, `physicalHazardPotential` (the live one is on `SafetyAnnotation` / the hazard), and the eleven "legacy asset-tab strings" at the end of the type (`dataClassification` … `trainingRequired`; the type itself says "retirement is a separate step"). Only `isProtectionTarget` and `environmentalHazard` occur in a test fixture (one each).

Verified 2026-11-14 against fixtures, the examples and local working files: none of these carries data — except `physicalHazardPotential`, which older hand-made files hold on a human asset (`HU-001 … "physicalHazardPotential": "high"`, written by no code today). "No writer, no reader" is therefore not "no data": a retirement must use the drop-on-load pattern with a diff entry (§8), never a silent type deletion. Same for `criticality` (form field, 80 assets with a value in the fixtures).

The report shows only `description` of an asset (`report-chapter-data.ts`, `base-generator.ts`, `pdfmake-converter.ts`).

### 2.3 DFD element properties (`features/dfd/models/element-properties.ts`)

Largely healthy: the STRIDE modifier, the threat catalogue, the compliance evidence rules and the `property-visibility` registry read most fields; the rest is at least rendered by `property-doc-mappers.ts` in the report. Exceptions:

| Field | Finding |
|---|---|
| `DataFlow.frequency` (`continuous \| periodic \| ondemand \| batch \| event_based`) | Read by the label/property validators, counted in the flow's completeness (`dataflow-coverage.ts`, "missing context") and rendered in the report (`property-doc-mappers.ts`). **Not** used for any likelihood factor — although it is exactly the "sent once vs. always" fact of §1. The value set also has **no value for "once"** (commissioning, provisioning, key exchange, initial pairing). |
| `DataFlow.exposureLevel` | Read by the STRIDE modifier and compliance; prefilled into the EN 50742 factor `exposure_level` (§2.4). Not offered as context for the window of opportunity of the other methods. |
| `ExternalEntity.threatProfile` (+ type `ExternalEntityThreatProfile` with `baseFeasibility`) | Dead. Commented "Phase 3 deterministic F-scoring", never built. |
| `mechanismDetail` | Dead (model only). |
| `injectability`, `controllability` (sensor/actuator coupling) | Model only, no form, no reader — **planned** as feasibility gating in the sensor/actuator design (v0.5 §5; property table and threat gating). Keep. |
| `dataMinimization`, `exposureLevelRationale` | In the form, not read, not in the report. A rationale that is not in the report is worthless for an audit. |
| `assumedTrustedRationale` | Gap, not ballast: `assumedTrusted` is read (`to-reference-graph.ts`), the comment says the rationale is required (IEC 62443), but there is no input and no check. |

### 2.4 The bridges from model to rating that already exist

| Bridge | Where | What |
|---|---|---|
| Asset impact criteria → impact factors | `applyAssetCriteriaToFactorRatings` (risk sync) | prefill, non-destructive |
| EN 50742 exposure level | `applyExposureLevelToFactorRatings` (risk sync, §11.2 Variante A) reads `exposureLevel` off the threat's DFD anchor (`extract-threat-references.ts`) | prefill, non-destructive, manual values win |
| Imported component factors | `applyFactorPrefill(…, threat.factorPrefill)` | intrinsic factor values from the component TARA |

So the pattern "a model fact pre-fills a rating factor, the analyst keeps the last word" exists — for one likelihood factor of one method.

### 2.5 Likelihood factors and their class

`risk-factor-types.ts` classifies every likelihood factor as *intrinsic* (property of the attack/component) or *context* (property of the integrating system):

| Method | Intrinsic | Context |
|---|---|---|
| ISO 21434 / ISO 18045 | `iso_elapsed_time`, `iso_expertise`, `iso_knowledge`, `iso_equipment` | `iso_window_of_opportunity` |
| Standard | `skill_level`, `ease_of_discovery`, `ease_of_exploit`, `knowledge`, `expertise`, `time`, `equipment` | `motive`, `opportunity`, `size`, `awareness`, `intrusion_detection` |
| TVRA | — | `etsi_opportunity`, `etsi_intensity` |
| EN 50742 A | `attacker_capability` | `exposure_level`, `window_of_opportunity` (project-global) |

The fields of §2.2/§2.3 overwhelmingly describe the **context** factors. That matches the component import: context factors are rated by the integrating (machine) TARA — so the rating context must come from the model the factor is rated in.

## 3. Problem statement

1. **Users enter data that has no effect** and are told by warnings that it does. That costs effort and creates false confidence ("the tool considers the lifecycle").
2. **Facts that matter for the rating exist in the model but do not reach the rating.** The analyst rates the window of opportunity in the risk dialog without seeing that the flow is a one-time commissioning transfer, or that the interface is in the field.
3. **Duplicated facts can contradict each other.** `exposure` on the asset vs. `exposureLevel` on the flow; `physicalAccessControl` on the asset vs. on the physical boundary; `criticality` vs. the impact rating.
4. **Nothing prevents new purpose-less fields.** The `property-visibility` guard test covers registered coverage fields only.

## 4. Principles

- **P1 — Place:** facts about the *attack surface* (how reachable, how often, where, who) belong to DFD elements; facts about the *damage* belong to the asset. An asset field that describes the attack surface is a duplicate by construction, unless it describes something no element can (e.g. the life cycle of one piece of data across several elements).
- **P2 — Purpose:** every input field has exactly one declared purpose: it feeds a **calculation/derivation**, it is **rating context** for named factors, or it is **documentation** — and then it is in the report. A field with none of these is retired.
- **P3 — Context informs, the analyst decides:** rating context is shown next to the factor it informs; a suggested value is optional, carries its source, never overwrites a manual value (same rule as the EN 50742 EL prefill), and is never a hidden calculation.
- **P4 — Honest messages:** a validator message states the real effect of the field. A field that is only context may produce an *info*, not a *warning*, and must not claim to drive threat selection.
- **P5 — One truth:** results of a rating (impact, criticality, protection need) are never also entered as a field.

## 5. Field purpose register

One entry per input field. The proposed column is a draft for decision (§9); "context → X" means: shown as rating context for factor(s) X (§6).

### 5.1 Asset fields

| Field | Today | Element counterpart (live) | Proposed purpose |
|---|---|---|---|
| `criticality` | warn, unused | impact rating / goals | **retire** (P5, like protection need) |
| `exposure` | warn, unused | `DataFlow.exposureLevel`, Interface | **retire** asset copy; context comes from the element |
| `physicalAccessControl` | warn, unused | `PhysicalBoundary.physicalAccessControl`, `secured_by` | **retire** asset copy; context from the boundary |
| `location` | unused | Interface / transducer / flow `location` | **retire** asset copy |
| `portability` | unused | `PhysicalBoundary.physicalMobility` | **retire** asset copy |
| `serviceType` | warn, unused | `ExternalEntity.entityType` (service, remote_service, …) | **retire** or derive from the linked EE |
| `role` | warn, unused | `ExternalEntity.entityType` (user, admin_user, operator, maintenance, contractor), `Process.privilegeLevel` | context → `size`, `motive`, `iso_knowledge` (insider) — **from the EE**; asset copy retire |
| `lifecycle` | warn, unused | partly: DataStore `deletionMechanism`/`deletionPolicy`, relations `stores`/`transports` | context → window of opportunity (transient vs. stored vs. archived = how long the data can be reached). Asset is a defensible place (one datum across several elements) — **keep** |
| `automationLevel` | warn, unused | — | context → `intrusion_detection`, window of opportunity ("unnoticed opportunity": a human in the loop notices more) — **keep** |
| `changeFrequency` | unused | — | context → window of opportunity (maintenance/change windows) — **keep, confirm meaning** |
| `responsibility` | warn, unused | per control only (`securityControlOwnership`) | context → `iso_knowledge`, threat source (third party); input for assumptions on use (AoU) / supply chain — **keep, strongest candidate** |
| `dataType` | warn, unused | flow/store `dataClassification`; CIANAAA flags | candidate **deriver input** (credentials/keys → C+authenticity goals, firmware → integrity) rather than rating context — **decide** (§9 D4) |
| `isSafetyFunction` | unused | derived safety chain (`isHazardTarget`, `physicalImpact`, schema v9) | **retire**; correct the claim in `taraflow-asset-relations.md` |
| `isProtectionTarget` | unused | `isHazardTarget` | **retire** |
| `environmentalHazard` | unused | hazard tab | **retire** |
| `isUnique`, `uniquenessRationale` | unused | HVA factors (lead time, spares) | **retire** or report |
| `securityRelevant` | unused | — (every modelled asset is) | **retire** |
| `domain` | unused | project tag "domain" | **retire** |
| `isValidatedProcess`, `regulatoryReference`, `validationRationale` | unused | — | documentation → **report**; later maybe a hint for the impact criterion `regulatory_compliance` |
| `providerName`, `slaReference`, `responsibilityScope`, `externalRefs`, `owner`, `notes` | unused | — | documentation → **report** |
| §2.2 C (dead fields) | — | — | **retire**; `strideDepth` returns as *derived* analysis depth (§8 phase 5), never as input |

### 5.2 Element fields

| Field | Proposed purpose |
|---|---|
| `DataFlow.frequency` | context → `iso_window_of_opportunity`, `opportunity`, `etsi_opportunity`; **add value `once`** (commissioning, provisioning, key exchange, pairing) |
| `DataFlow.exposureLevel`, Interface `location`, `PhysicalBoundary.physicalAccessControl`, `physicalMobility` | context → window of opportunity / opportunity, `iso_equipment` (physical access needs tools) |
| `ExternalEntity.entityType`, `trustLevel`, `Process.privilegeLevel` | context → `size`, `motive`, `iso_knowledge` |
| `injectability`, `controllability` | keep; wired by the sensor/actuator work (feasibility gating) |
| `dataMinimization`, `exposureLevelRationale` | documentation → report |
| `assumedTrustedRationale` | input + check when `assumedTrusted` is set (it is required by the field's own definition) |
| `threatProfile` (+ `ExternalEntityThreatProfile`), `mechanismDetail` | retire |

## 6. Rating context — design

### 6.1 What it is

For every risk (and every attack tree path) the facts of the model that bear on its likelihood factors, collected, shown next to the factor they inform, with their source. Example in the risk dialog, factor *Window of Opportunity*:

> Context: F3 *Commissioning upload* — frequency **once** · Interface *Service port* — location **external_panel** · DataFlow F3 — exposure level **EL1** (physical)

### 6.2 Where the facts come from

| Anchor of the risk | Facts collected from |
|---|---|
| element threat | the element; its interfaces / physical boundary; flows touching it |
| interaction / flow threat | the flow; source and target elements; boundaries the flow crosses |
| attack tree path | every flow and element on the path (the path dialog already shows "chain + feasibility") |
| linked assets | asset fields with purpose "context" (`lifecycle`, `automationLevel`, `changeFrequency`, `responsibility`) |
| imported component threat | the **machine's** model: the boundary flow / instance / EE mapping — context factors are rated in the machine (§2.5) |

### 6.3 Architecture (no feature-to-feature dependency)

- **Register** (pure, `shared/models/field-purpose-register.ts`): field → purpose (`calculation` / `context` / `documentation` / `retired`) → for context: factor ids + an optional hint function `(value) → suggested level | undefined`. One truth, read by the read-model builder, the report and the guard test.
- **Read model** (`app/utils/build-rating-context.ts`, app layer like `build-asset-data-reference.ts` and `extract-threat-references.ts`): produces `RatingContextReference` (shared type) per risk id / path id: `{ factorId, facts: { source, field, value, label }[], suggestion? }[]`.
- **Consumers:** `features/risks` (risk dialog, before tab, per factor row) and `features/attacktree` (path dialog). Neither imports the other or `features/dfd`.
- **Report (optional, phase 3):** per risk a "rating basis" line listing the facts that were shown — the traceable rationale ISO 21434 asks for attack feasibility.

### 6.4 Suggestions (phase 3)

Same rules as the EN 50742 EL prefill: non-destructive, a manual value wins, the source is recorded, the dialog shows "suggested from F3 (frequency: once)". Several hints for one factor → show all, suggest the **most attacker-favourable** (conservative), the analyst decides.

Draft hint table for the window of opportunity — **to be validated (§9 D6)**, not a norm mapping:

| Fact | ISO 18045 WoO hint | Standard `opportunity` hint |
|---|---|---|
| frequency `continuous` / `periodic` | unlimited / easy | high |
| frequency `event_based` / `ondemand` | easy … moderate (who can trigger it?) | medium |
| frequency `batch` | moderate | medium |
| frequency `once` (new) | difficult | low |
| exposure level `EL4` (public) / `EL3` (adjacent) | unlimited / easy | high |
| interface location `external_panel` (or more exposed), physical access control `none` | easy | high |
| interface location `on_chip` / `in_enclosure`, physical access control `lock` / `biometric`, mobility `fixed` | moderate … difficult | low |
| asset lifecycle `transient` vs. `stored` / `archived` | narrower vs. wider | — |
| automation `manual` (human in the loop) | — (affects `intrusion_detection`) | — |

The table deliberately suggests and never computes: the window of opportunity also depends on detection and on who can trigger a flow, which the model does not capture fully.

### 6.5 Scope per method

- **ISO 21434 / IEC 62443 / CRA with attack trees:** main beneficiary (window of opportunity per path; equipment, knowledge as secondary).
- **Standard method:** `opportunity`, `intrusion_detection`, `size`, `motive`.
- **EN 50742 A:** exposure level already prefilled; the window of opportunity is project-global — context can be shown as an aid for that one project-level choice, not per risk.

## 7. Validator messages and the guard test

- Every message key in `dfdValidation.assetMissing*` (and the element equivalents) states the real effect per P4. Until phase 2 ships, the context fields produce an **info** ("… documents context for the rating"), not a warning; after phase 2 the text names the factor ("… is shown as context for the window of opportunity").
- **Guard test** (`src/tests/unit/shared/models/field-purpose-register.guard.test.ts`, analogous to `property-visibility.guard.test.ts`): every key of `AssetProperties` and of each element-properties interface must have a register entry; a `context` entry must name at least one existing factor id; a `documentation` entry must be rendered by the report mapper; a `retired` entry must be listed in the load-time drop (`drop-retired-asset-fields.ts` pattern) and must not appear in the type. A new field without an entry fails the build.

## 8. Phases

| Phase | Content | Release |
|---|---|---|
| 0 | Honest messages (P4) for the asset group fields, **as infos** (§7; review 2026-11-14 — the only effect is that the DFD phase can reach "complete", which is then correct: no calculation reads these fields); correct the `isSafetyFunction` claim in `taraflow-asset-relations.md`; retire `criticality` (P5, like protection need) and the dead fields of §2.2 C with the drop pattern | 0.19 (decided, D1) |
| 1 | Field purpose register with the *current* truth (incl. `unused – decision pending`) + guard test | 0.20 |
| 2 | Rating context read model + display in risk dialog and path dialog (no suggestions) | 0.20 |
| 3 | Suggestions per §6.4, starting with the window of opportunity; `DataFlow.frequency` gains `once`; report "rating basis" | 0.20 / 0.21 |
| 4 | Cleanup per §5: retire duplicates with the 0.19 retire pattern (drop on load, `LegacyAssetFields` in the diff, one diff entry, upgrade note); documentation fields into the report; `assumedTrustedRationale` input + check | 0.21 |
| 5 | Analysis depth derived from the impact (concept doc, section on analysis depth; former `strideDepth`), shown per asset, never entered | later |

Retiring follows the pattern of `5fe3b693`: dropped on load before every other step, the previous state read raw in the commit diff so the drop shows once, verification re-keyed, CHANGELOG "Removed" + upgrade note.

**Retire in batches (component snapshots).** Asset properties cross into the snapshot of an imported component. Every retirement of such a field changes the content hash of the imports made before it: the drift check then offers "Refresh stored state" once per import (builder changed — the normal update path, but work per import, and the component's repository must be at hand). Before 0.19 only test repositories carry snapshots; from 0.20 on customers do. Retirements after 0.19 therefore go into **one** release together, named in its upgrade notes, so that every import is refreshed once, not once per retired field.

## 9. Decisions (open)

| # | Question | Proposal |
|---|---|---|
| D1 | Phase 0 in 0.19? | **Decided 2026-11-14:** yes — honest messages as infos (§7), the doc correction, retiring `criticality` and the dead fields of §2.2 C. Everything else in one batch in 0.20 (§8): the D2 retirements in **one** commit, so users see "Refresh stored state" once **Release cut changed (roadmap to 1.0 v0.4, user 2026-11-14):** phase 1 (register + guard test) in 0.20; the D2 retirements in 0.21 (with the physical threats); phase 2 (display) and the rest of phase 4 in 0.24; phase 3 (suggestions) after 1.0. |
| D2 | Duplicate attack-surface fields on the asset (`exposure`, `physicalAccessControl`, `location`, `portability`, `serviceType`, `role`) | Retire; context comes from the elements (P1) |
| D3 | Keep on the asset as context: `lifecycle`, `automationLevel`, `changeFrequency`, `responsibility` | Yes; confirm the meaning of `changeFrequency` (process changes vs. data frequency) |
| D4 | `dataType` | Deriver input for CIANAAA goals, or documentation — not rating context |
| D5 | `DataFlow.frequency`: add `once` | Yes |
| D6 | Hint table §6.4 | Juergen validates the levels before phase 3 |
| D7 | Suggestions or display only? | Display first (phase 2), suggestions only for factors with a validated hint table |
| D8 | Report "rating basis" per risk | Yes, phase 3 |

## 10. Implementation status

Phase 0 (0.19): honest messages and the doc correction (patch 106), the asset group findings as infos with "recorded with the asset; … not in the report yet" (patch 108); `criticality` and the dead fields of §2.2 C retired with the drop pattern, one list of retired asset fields shared by the load and the commit diff (patch 107). Phases 1–5 open.
