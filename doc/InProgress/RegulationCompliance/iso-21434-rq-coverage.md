# TARAflow — ISO/SAE 21434 requirement coverage

**Status:** v2 · 2026-10-27 · code base: `main` 96c9269a (v0.15.1-beta; 0a, 0b, 0b2, 0c,
0d, the `levelToRiskScale` fix, 3a and the report fixes F1–F10 released) ·
plan: `main` 6c55d0c
**Belongs to:** `iso-21434-conformance-implementation-plan.md`. This document is the
**exit criterion** of that plan: the normative minimum (plan §5) is done when every [N]
row below is *met* or justified *n/a* / *external*. Plan §7 (Definition of done) refers
here.

> **Source of the numbers.** RQ / RC / PM and WP numbers were read from the licensed copy
> of ISO/SAE 21434:2021 (2026-10-24). The PDF prints the numbers as margin labels that a
> text extract does not contain; they were reconstructed from the order of the
> requirement paragraphs per clause (one counter for RQ, RC and PM together, one for WP)
> and checked against every number verified earlier (RQ-15-05, -06, -10, -15, -16, -17,
> RC-15-11, RQ-09-05, -06, -07). Requirement texts are paraphrased; the standard is
> authoritative.

---

## 1. Purpose and scope

The plan describes *how* the gaps are closed. This document answers *whether every
requirement is covered*, one row per requirement, so that gaps are found before the
implementation, not after it.

- **What it describes:** what the **tool** covers — which requirement TARAflow supports
  with data, calculation, validation or report output, and where in the code.
- **What it does not describe:** whether a customer project is conformant. That is the
  readiness check of a concrete project (plan Phase 7) and, in the end, the assessor.
- **Scope:** Clause 9 (concept phase) and Clause 15 (TARA methods) completely; Clause 8
  and RQ-05-05 only where TARAflow supplies inputs. Clauses 5–7 and 10–14 are
  organisation / process and out of scope (plan §1).

## 2. How to use and maintain

| Column | Meaning |
|---|---|
| ID | RQ = requirement (*shall*), RC = recommendation (*should*), PM = permission (*can / may*); WP = work product |
| Requirement | short paraphrase; the standard is authoritative |
| Marker | **[N]** normative · **[D]** TARAflow design decision · **[K]** configurable methodology (plan legend). RC rows are [N] as recommendations: a deviation needs a rationale, not a fix |
| Status | **met** · **partial** · **gap** · **n/a** (with reason) · **external** (organisation / process) · **met?** (implemented, test reference missing) |
| Plan step | step in plan §5 that closes the row |
| Code | where it is implemented (file / symbol) |
| Test | acceptance test (plan §8) or unit / integration test that proves it |

Rules:

1. A row is **met** only with a test reference. Implemented without a test is **met?**.
2. Every plan step names the rows it closes; the commit that closes a row updates it here.
3. A new finding (bug, wrong assumption) adds or changes a row; it does not stay in a chat.
4. Status refers to the commit named in the header. Since v0.15.0-beta the ISO work is
   merged to `main`; each step's branch is merged after its release.

## 3. Clause 9 — Concept phase

### 9.3 Item definition

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-09-01 | Information on the item identified: a) item boundary, b) item functions (over the lifecycle phases, NOTE 2), c) preliminary architecture | [N] | **gap** — only the free text `info.description` | Phase 1 stage A | – | §8 Phase 1 |
| RQ-09-02 | Operational environment relevant to cybersecurity described; may include assumptions (NOTE 8) | [N] | **partial** — trust-boundary `securityAssumptions` as free text | Phase 1 stage A (ASM) | `element-properties.ts` `securityAssumptions` | §8 Phase 1 |
| WP-09-01 | Item definition | [N] | **gap** | Phase 1 stage A, report Phase 7 | – | §8 Phase 7 |

### 9.4 Cybersecurity goals

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-09-03 | Analysis based on the item definition: asset identification (15.3), threat scenarios (15.4), impact rating (15.5), attack paths (15.6), attack feasibility (15.7), risk values (15.8). NOTE 1: missing information can be assumed | [N] | **partial** — rows of §4: risk value met (3a); item definition (RQ-09-01/02) and damage scenarios open | Phase 1, Phase 2 | see §4 | see §4 |
| RQ-09-04 | Risk treatment options determined for each threat scenario (15.9) | [N] | **met** — ISO names (0a); per threat scenario the union of its paths' options (3a, decision 20) | 0a, 3a | `risk-treatment-vocabulary.ts`, `iso-scenarios.ts` `groupIsoScenarios` | `risk-treatment-vocabulary.test.ts`; `iso-scenarios.test.ts` ("options the union"); `attack-path-risks-chapter.test.ts` ("union of treatments") |
| RQ-09-05 | If the treatment includes reducing → one or more cybersecurity goals; CAL "if applicable" (NOTE 4, Annex E) | [N] / CAL [K] | **gap** — `SecurityGoal.formalDescription` exists but is not tied to Reduce; no CAL | Phase 4 minimal | `asset-security-goals-types.ts` | §8 Phase 4 |
| RQ-09-06 | If the treatment includes sharing, or retaining due to assumptions → one or more cybersecurity claims | [N] | **partial** — `treatmentJustification` / `wontJustification` text, no claim object | Phase 4 minimal (+ ASM from Phase 1 A) | `risk-assessment-types.ts` | §8 Phase 4 |
| RQ-09-07 | Verification confirms a) TARA correct / complete w.r.t. the item definition, b) treatment decisions complete / correct / consistent w.r.t. the TARA, c) goals and claims w.r.t. the treatment decisions, d) consistency of all goals and claims of the item | [N] | **gap** — structural checks partly exist (validators, traceability matrix), no verification record | Phase 4 minimal (verification record), readiness check Phase 7 | – | §8 Phase 4 |
| WP-09-02 | TARA | [N] | **partial** — report with assets, threats, attack trees, risks, traceability matrix, methodology chapter (0d) | Phase 7 (structure by WP) | `features/documentation` | `traceability-matrix.test.ts`, `methodology-chapter.test.ts` |
| WP-09-03 | Cybersecurity goals | [N] | **gap** | Phase 4 minimal | – | §8 Phase 4 |
| WP-09-04 | Cybersecurity claims | [N] | **gap** | Phase 4 minimal | – | §8 Phase 4 |
| WP-09-05 | Verification report for cybersecurity goals (and claims, RQ-09-07) | [N] | **gap** | Phase 4 minimal | – | §8 Phase 4 |

### 9.5 Cybersecurity concept

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-09-08 | Technical and / or operational cybersecurity controls and their interactions to achieve the goals described | [N] | **partial** — mitigations per risk (catalogue), not tied to goals | Phase 5 | `risk-mitigation-types.ts` | §8 Phase 5 |
| RQ-09-09 | Cybersecurity requirements (item and operational environment) defined for the goals | [N] | **gap** | Phase 5 | – | §8 Phase 5 |
| RQ-09-10 | Requirements allocated to the item and, if applicable, its components | [N] | **gap** | Phase 5 | – | §8 Phase 5 |
| RQ-09-11 | Concept verified: complete / correct / consistent w.r.t. goals, consistent w.r.t. claims | [N] | **gap** | Phase 5 | – | §8 Phase 5 |
| WP-09-06 | Cybersecurity concept | [N] | **gap** | Phase 5 | – | §8 Phase 5 |
| WP-09-07 | Verification report for the cybersecurity concept | [N] | **gap** | Phase 5 | – | §8 Phase 5 |

## 4. Clause 15 — TARA methods

### 15.3 Asset identification

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-15-01 | Damage scenarios identified (NOTE 1: relation function ↔ adverse consequence, harm to the road user, relevant assets) | [N] | **met?** — one damage scenario per asset × property: consequence text (ISO) and per-goal impact ratings; 1:n named scenarios are [D] | (Phase 2 for 1:n) | `asset-security-goals-types.ts` (`consequence`, `impactRatings`), `asset-impact-resolver.ts` | to add |
| RQ-15-02 | Assets with cybersecurity properties whose compromise leads to a damage scenario identified | [N] | **met?** — DFD-anchored assets with the seven CIANAAA properties (decision 18: properties of their own, explained in the report) | – | `asset-types.ts`, `CIANAAA_TO_STRIDE` | to add |
| WP-15-01 | Damage scenarios | [N] | **partial** — security-goal table in the assets chapter, no table of its own | Phase 2 / 7 | `security-goal-doc-rows.ts` | §8 Phase 2 |
| WP-15-02 | Assets with cybersecurity properties | [N] | **met?** — asset inventory + security-goal table in the report | – | `base-generator.ts` assets chapter | to add |

### 15.4 Threat scenario identification

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-15-03 | Threat scenarios identified, each with targeted asset, compromised cybersecurity property and cause of compromise | [N] | **met?** — STRIDE-per-element threats on assets (category → property via `CIANAAA_TO_STRIDE`) and asset × property-anchored attack trees (cause = attack description / path); per-interaction generator off under ISO | – | threat generator, `regulation-preset.ts` `disabledThreatGenerators`, `buildThreatId` | `interaction-threat-service.test.ts` (generator off); property + cause: to add |
| – | Threat scenario ↔ damage scenario link | [N] (15.8 RQ-15-15 needs it) | **partial** — implicit via asset × property; explicit with Phase 2 | Phase 2 | – | §8 Phase 2 |
| WP-15-03 | Threat scenarios | [N] | **met?** — threat chapters and attack-path threat chapter of the report | – | `base-generator.ts` | `attack-path-threats.test.ts` (check) |

### 15.5 Impact rating

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-15-04 | Damage scenarios assessed in the impact categories safety, financial, operational, privacy (NOTE 2: further categories possible) | [N] | **met** — SFOP mandatory under ISO (seeded and locked) | – | preset `impactCriteriaIds`, `CRITERION_TO_CATEGORY`, `enforceMandatoryAssetCriteria` | `regulation-preset-orchestrator.test.ts` (SFOP seeding) |
| RQ-15-05 | Impact rating per category: severe / major / moderate / negligible | [N] | **met** — 4-level lock (0b) with finding, ISO names (0b2) | – | `requiredImpactScale`, `threadImpactScale`, `impactScaleFor` | `iso21434-phase0b.test.ts`, `impact-scale-iso-labels.test.ts` |
| RQ-15-06 | Safety-related impact ratings derived from ISO 26262-3:2018, 6.4.3 (Table F.1 as mapping aid) | [N] | **met** — the person severity of the `endangers` edge shows its ISO 26262 class S0–S3 under `iso-21434` (1H-S-2), S0 = edge rated `"none"`, which counts as no harm (1H-S-1); Table F.1 maps the safety rating onto the ISO impact (3a). HARA fields (E, C, ASIL) and import: 1H-HARA [D] | 1H-S | `safety-types.ts` `iso26262SeverityClass`, `hazard-impact.ts`, `build-asset-hazard-links.ts`, `iso-risk-matrix.ts` | `safety-severity.test.ts` ("ISO 26262 severity class"); `build-asset-hazard-links.s0.test.ts`; `hazard-table.s0.test.tsx`; `iso-risk-matrix.test.ts` ("safety categorical (Table F.1)") |
| PM-15-07 | Further categories may be left unanalysed if one rating is argued as more critical | [K] | **met?** — criteria can be rated "n/a" | – | `ImpactRating.value` `"na"` | to add |
| WP-15-04 | Impact ratings with associated impact categories | [N] | **partial** — per asset in the report; per damage scenario with Phase 2 | Phase 2 / 7 | `base-generator.ts` | §8 Phase 2 |

### 15.6 Attack path analysis

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-15-08 | Threat scenarios analysed to identify attack paths | [N] | **met** — attack trees (threat- or asset × property-anchored), paths extracted with stable keys | – | `features/attacktree` (`extractAllPaths`, `computePathKey`) | `attacktree-calculator-feasibility.test.ts`, `hash-helpers-move.test.ts` |
| RQ-15-09 | An attack path associated with the threat scenarios it can realise | [N] | **met?** — path → threat id `buildThreatId(tree, pathKey, stride)`; tree anchored to the scenario | – | `attacktree-threat-sync.ts`, `build-attack-tree-likelihood-references.ts` | `build-attack-tree-likelihood-references.test.ts` (riskId = threat id) |
| WP-15-05 | Attack paths | [N] | **met?** — attack-tree chapter of the report | – | `base-generator.ts` | to add |

### 15.7 Attack feasibility rating

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-15-10 | Attack feasibility per attack path rated high / medium / low / very low (Table 1) | [N] | **met** | – | `FeasibilityBandLevel`, `feasibilityBandFor` (Table G.7) | `iso21434-calc-golden.test.ts`, `attacktree-calculator-feasibility.test.ts` |
| RC-15-11 | Rating method defined: attack potential, CVSS or attack vector based | [N] (RC) / method [K] | **met** for attack potential; documented in the methodology chapter (0d) | (Phase 6 for the others) | `FeasibilityConfiguration.method`, `buildMethodologyRecord` | `methodology-chapter.test.ts` |
| RC-15-12 | Attack potential based: core factors elapsed time, specialist expertise, knowledge of the item, window of opportunity, equipment (Annex G.2) | [N] (RC) | **met** | – | `iso21434-core.ts`, `attacktree-feasibility.ts` | `iso21434-core.test.ts`, `iso21434-calc-golden.test.ts` |
| RC-15-13 | CVSS based: exploitability metrics of the base metric group | [K] | **n/a** — method not offered; RC applies only if chosen | Phase 6 | – | – |
| RC-15-14 | Attack vector based: predominant attack vector | [K] | **n/a** — method not offered; RC applies only if chosen | Phase 6 | – | – |
| – | Aggregation in the attack tree: potential AND = sum / OR = min, probability product / union, ordinal min / max; scenario = most feasible path (15.8 NOTE 2) | [D] | **met** | – | `FEASIBILITY_GATE_RULES` | `iso21434-calc-golden.test.ts`, `iso21434-phase0b.test.ts` |
| WP-15-06 | Attack feasibility ratings | [N] | **met?** — per path in the report (traceability matrix AF column) | Phase 7 (per scenario) | `base-generator.ts` | `traceability-matrix.test.ts` |

### 15.8 Risk value determination

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-15-15 | Risk value for each threat scenario from the impact of its damage scenarios and the feasibility of its attack paths (NOTE 1: per impact rating allowed; NOTE 2: MAX over paths as example) | [N] | **met** — per path impact × feasibility through H.8, per threat scenario the MAX over its paths (3a, decision 20 E3; NOTE 2). The impact is the asset property's rating until damage scenarios are objects (Phase 2) | 3a | `iso-risk-matrix.ts` `isoRiskValue`, `commit-iso-risk-values.ts`, `iso-scenarios.ts` | `commit-iso-risk-values.test.ts`; `iso-scenarios.test.ts` ("MAX over the paths") |
| RQ-15-16 | Risk value between 1 and 5, 1 = minimal; method free (matrix / formula) | [N] / method [K] | **met** — matrix H.8 (decision 20), values 1–5, words Minimal … Critical (3a-w); the `levelToRiskScale` fix (decision 21) | 3a | `iso-risk-matrix.ts`, `feasibilityLevelToRiskScale` | `iso-risk-matrix.test.ts` ("all 16 cells", "extremes are 1 and 5", "Table H.9 examples"); `fix-tree-likelihood-scale.test.ts` |
| WP-15-07 | Risk values | [N] | **met** — register columns (3a-2), threat-scenario view (3a-3), report chapter *Risk Assessment (Threat Scenarios)* (F4) | 3a, F4 | `iso-risk-display.ts`, `iso-scenarios.ts`, `base-generator.ts` | `iso-risk-display.test.ts`; `iso-risk-matrix.test.tsx`; `attack-path-risks-chapter.test.ts` |

### 15.9 Risk treatment decision

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-15-17 | For each threat scenario, considering its risk values, one or more options: avoid, reduce, share, retain (NOTE: rationales of share / retain become claims) | [N] | **partial** — ISO names (0a); per threat scenario with its value and the review list (3a, E5); claims for share / retain open | Phase 4 | `risk-treatment-vocabulary.ts`, `iso-scenarios.ts` | `risk-treatment-vocabulary.test.ts`; `iso-scenarios.test.ts` |
| WP-15-08 | Risk treatment decisions | [N] | **partial** — per threat scenario in the register, the scenario view and the report (3a, F4), the traceability matrix; rationales as claims open | Phase 4 | `base-generator.ts`, `iso-scenarios.ts` | `traceability-matrix.test.ts`; `attack-path-risks-chapter.test.ts` |

## 5. Clause 8 — Continual cybersecurity activities (inputs only)

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-08-01 … RQ-08-03 | Sources selected, triggers defined, cybersecurity information collected and triaged into events (WP-08-01 … 08-03) | [N] | **external** — monitoring process of the organisation | – | – | – |
| RQ-08-04 … RQ-08-06 | Events evaluated for weaknesses; weaknesses analysed for vulnerabilities, rationale for non-vulnerabilities (WP-08-04, 08-05) | [N] | **external** | – | – | – |
| RQ-08-07 | Each vulnerability managed: a) risks assessed and treated per 15.9, or b) eliminated by a remediation (WP-08-06) | [N] | **gap** for the tool part a): vulnerability → attack path / leaf, recompute, flag affected risks | Phase 8 | – | §8 Phase 8 |
| RQ-08-08 | If a treatment decision needs incident response → Clause 13.3 | [N] | **external** | – | – | – |
| – | Re-assessment of the TARA on triggers (change, new vulnerability), review record per revision | [D] (supports Clause 8) | **partial** — signed audit trail (AVE / TCS); triggers as data missing | Phase 8 | `features/audit` | – |

## 6. Clause 5 — only where TARAflow supplies information

| ID | Requirement | Marker | Status | Plan step | Code | Test |
|---|---|---|---|---|---|---|
| RQ-05-05 | Disciplines interacting with cybersecurity identified, communication channels maintained; EXAMPLE 3: exchange threat scenarios ↔ hazards, goals ↔ safety goals, conflicting requirements | [N] (organisation) | **external**; the tool supplies the exchange: hazard items linked to assets (now), safety goal ref (1H-HARA), goals ↔ safety goals (Phase 4) | 1H-HARA, Phase 4 | `hazard-types.ts` | – |

## 7. Cross-cutting (no RQ, needed for the evidence)

| Item | Marker | Status | Plan step | Code |
|---|---|---|---|---|
| Methodology chapter (method, scales, bands, gate rules, treatment names, properties, stamps) | [D] | **met** (branch, 0d) | 0d | `buildMethodologyRecord`, `methodology-sections.ts` |
| Calculation stamp | [D] | **met** (branch, 0c) | 0c | `CalcStamp`, `commit-calc-stamps.ts` |
| Tree likelihood on the risk scale (`levelToRiskScale` fix) | [D] (bug) | **met** (branch, fix) — see O6 | fix | `feasibilityLevelToRiskScale`, `fix-tree-likelihood-scale.ts` |
| Reproducible, signed record of all values | [D] | **met** | – | TCS + AVE (`features/audit`) |
| Report structured by work product, coverage matrix | [D] | **partial** | Phase 7 | `features/documentation` |
| Readiness check (project level, by RQ) | [D] | **gap** | Phase 7 | – |

## 8. Open points

| # | Point | Owner |
|---|---|---|
| O1 | **Done:** all RQ / RC / PM / WP numbers of Clauses 8, 9 and 15 filled from the PDF (method in the header note). Corrections to the plan: "threat scenario names the compromised property" is **RQ-15-03** (plan decision 18 and Phase 0 said RQ-15-07; RQ-15-07 does not exist, the number is PM-15-07); 5.4.1 EXAMPLE 3 is **RQ-05-05** (plan 1H said "RQ-05-03 or RQ-05-05"). Fixed in the plan together with this document. | – |
| O2 | **Done** with plan 6c55d0c: schema 10 for 0c + fix + 3a in one migration, 0.15.0-beta. | – |
| O3 | **Done** with plan 6c55d0c: 3a uses matrix H.8, H.10 not used. | – |
| O4 | **Done:** 0b–0d pushed on the branch. | – |
| O5 | Rows **met?** need a test reference before they count as met (rule 1): RQ-15-01, -02, -03 (property + cause), -09, PM-15-07, WP-15-02, -03, -05, -06. To be added with the step that touches them, at the latest in Phase 7. | per step |
| O6 | The fix commit on the branch (`74ac4670`) contains only the two new files; the changes to the 12 tracked files (shared mapping, references, dialog, migration hook, i18n, tests) are not committed — the pushed commit does not build. Amend with `git commit -a --amend --no-edit` and push. | Juergen |
| O7 | Plan Phase 1 says "RQ-09-01 … functions over the lifecycle (b)": the standard puts the lifecycle into NOTE 2 of b); the requirement is "item functions". No change in substance. | – |
