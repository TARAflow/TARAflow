# TARAflow — prEN 50742 requirement coverage

**Status:** v0.1 · 2026-11-02 · source: prEN 50742:2025 (E), Draft for Enquiry
(CLC/TC 44X), licensed copy · code base: `main` 3570655c (CM-2) · v0.1: rows of Approach A
mapped to the Compliance sub-tab `en-50742-a` (§9, user 2026-11-02); Approach B deferred
**Belongs to:** `en-50742-approach-a-design.md` (Approach A) and the Compliance sub-tab
`en-50742-a` (`model-coverage-implementation-plan.md` §8.1). Approach B (§6) waits until
IEC 62443 support is complete (user 2026-11-02). Same role as `iso-21434-rq-coverage.md`:
the list is the exit criterion — EN 50742 Approach A support is done when every row of
§4, §5 and §7 is *met*, *tracked* or justified *n/a*.

> **Licence:** the source is a licensed DIN Media copy. This document paraphrases
> requirements and cites clause and draft line number; it does **not** reproduce the
> normative text.

---

## 1. Purpose and scope

prEN 50742 has **no requirement IDs** (unlike ISO/SAE 21434 with RQ-xx-yy). Requirements
are the "shall" statements of the normative clauses. This list gives each one an ID so it
can be traced.

- **ID scheme:** `EN-<clause>/<draft line>`, e.g. `EN-7.4.2/334`. The draft line numbers
  change with the final EN; the IDs are remapped then (O1). Graded requirements of 7.4.3
  (SRSL1/2/3) are one row per subclause, the tiers in the text.
- **Scope:** normative Clauses 4–9 (78 "shall" statements in the draft; Annex C example
  text excluded). Annexes A–D are **informative**. Annex ZZ (informative) maps clauses to
  the essential requirements of Regulation (EU) 2023/1230, Annex III — it defines which
  rows matter for the presumption of conformity (column "ZZ").
- **What it describes:** what the **tool** covers. Many requirements of Clause 7 are
  requirements on the **machine** (logging, secure boot, authentication). TARAflow cannot
  meet them; it can make them visible, track them and report their verification. Hence the
  extra column *Role*.

## 2. Columns, roles and rules

| Column | Meaning |
|---|---|
| ID | `EN-<clause>/<line>` |
| Requirement | short paraphrase; the standard is authoritative |
| ZZ | essential requirement of Reg. (EU) 2023/1230 Annex III (Table ZZ.1): `1.1.9`, `1.2.1a`, `1.2.1f`, or – |
| Role | **method** — TARAflow performs or supports the analysis step · **track** — requirement on the machine, TARAflow derives/lists it, tracks verification, reports it · **doc** — content of the information for use / report · **ext** — organisation or other standard, outside the tool |
| Marker | **[N]** normative · **[D]** TARAflow design decision · **[K]** configurable / informative method |
| Status | **met** · **tracked** (role *track*: listed + verification + report) · **partial** · **gap** · **n/a** · **ext** |
| Plan | phase in `en-50742-approach-a-design.md` §7 (P1 … P5); **CT-A** = row of the Compliance sub-tab `en-50742-a` (§9, steps CM-11 … CM-13 of the model coverage plan); CP-B = Approach B, deferred |
| Code / Test | where it is implemented, which test proves it |

Rules as in the ISO list: *met*/*tracked* only with a test reference; every plan step names
the rows it closes; new findings go into this list. A row with role *track* or *doc* counts
as *tracked* once its CT-A row evaluates (model evidence, risk evidence or a statement) and
appears in the report chapter of the sub-tab — the tool cannot make the machine meet it.

## 3. Findings from the first pass (decide before coding)

**F1 — Annex B is informative.** The AP formula `AP = (EL × WoO) + AC`, Table B.5 (AP
bands) and Table B.6 (SRSL mapping) are guidance (7.4.2 NOTE: "Annex B provides
guidance"). Normative is only: an SRSL per safety function, based on the threat
assessment, correlated with the risk reduction of the protective measure and the
likelihood of a successful exploitation (7.4.2), and the SRSL descriptions of Table 2.
→ In TARAflow the Annex B method is **[K]**, not [N]. `en-50742-approach-a-design.md` §1
calls it the "normative model" and should be corrected. Same situation as ISO/SAE 21434
matrix H.8.

**F2 — Table B.6 conflicts with normative Table 2 at SRSL0.** B.6 gives **SRSL0 for AP0**
at both severities. Table 2 reserves SRSL0 for a *completely isolated* safety system (no
external interfaces). AP0 covers scores 0–5; a physical interface (EL1 = 2) with a small
WoO and AC can score ≤ 5. → B.6 can yield SRSL0 for a non-isolated function.
Proposal: validator "SRSL0 only if every interface of the safety function has EL0;
otherwise at least SRSL1" ([N], Table 2 wins over informative B.6). Candidate for an
enquiry comment.

**F3 — PLr as severity source.** Annex B NOTE 1 (l. 585–588): PLr/SIL from the separate
safety risk assessment can express the safety impact. Severity in B.6 is only "low / e.g.
reversible" and "high / e.g. non reversible". → The PLr from an ISO 12100 / 13849
assessment (hazard import HI-5, `plRequired`) is a legitimate severity input. TARAflow's
`fatal` row is a [D] extension (design doc §3.6).

**F4 — Likelihood of being targeted.** 4.3 (l. 242): not relevant for the threat
assessment. → Under `en-50742-a` no motivation / benefit factor ([N]); the preset already
sets `likelihoodFactorIds: ["exposure_level", "attacker_capability"]`.

## 4. Clause 4 — Protection against corruption

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-4.1/198 | Apply either Approach A (Cl. 5 + 7) or B (Cl. 6 + 8) | – | method | [N] | **met?** — exclusive presets `en-50742-a` / `en-50742-b`, tag-driven | P1 | `regulation-preset.ts` / to add |
| EN-4.2/200 | Design and construction shall not allow hazardous situations via connections | – | method | [N] | **partial** — goal of the whole TARA, no single check | – | – |
| EN-4.3/217 | After the EN ISO 12100 risk assessment, perform a threat assessment where hazards can be caused via corruption | 1.1.9, 1.2.1a | method | [N] | **partial** — hazard layer + threat generation; hazard import gaps (HI-1, HI-2) | P1 + hazard import + CT-A | `features/hazards`, `features/threats` |
| EN-4.3/220 | Define the security context of the machine | 1.1.9, 1.2.1a | method | [N] | **partial** — WoO in Overview depends on it; no explicit security-context section | P3 (WoO done) + system definition + CT-A | `project.info` WoO |
| EN-4.3/221–229 | Principles: a) eliminate vulnerabilities, b) else mitigate, c) remaining ones in the information for use | 1.1.9, 1.2.1a | method | [N] | **partial** — treatment options exist; no rule "remaining → information for use" | P4 / P5 + CT-A | `RISK_TREATMENTS` |
| EN-4.3/235 | Threat assessment shall be performed (connected machinery) | 1.1.9, 1.2.1a | method | [N] | see EN-4.3/217 | – | – |
| EN-4.3/238 | Countermeasures shall not negatively affect functional safety | 1.1.9, 1.2.1a | method | [N] | **gap** — no field / check | P4 + CT-A | – |
| EN-4.3/242 | Likelihood of being a target not relevant | 1.1.9, 1.2.1a | method | [N] | **met?** — F4 | P3 | preset `likelihoodFactorIds` / to add |
| EN-4.3/244, 247 | Choice of approach (A without, B with EN IEC 62443) | – | method | [N] | see EN-4.1/198 | – | – |

## 5. Clauses 5 and 7 — Approach A

### 5 / 7.1 Interfaces

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.1/260 | Identify all accessible interfaces that can affect safety and protect them (countermeasures or compensating) | 1.1.9, 1.2.1a | method | [N] | **partial** — interfaces as assets, EL derived from trust-boundary crossing | P2 + CT-A | `en50742-exposure-level-adapter.test.ts` |

### 7.2 Security measures

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.2.1/268 | Select security measures risk-based so that they are adequate | 1.1.9, 1.2.1a | method | [N] | **partial** — SRSL-driven mandated controls + free mitigations | P4 | `en50742-mandated-controls.test.ts` |
| EN-7.2.1/270 | Risk-based approach considers safety risks and threat risks, intended use and security context | 1.1.9, 1.2.1a | method | [N] | **partial** | P3/P4 | – |
| EN-7.2.1/272 | Security measures shall not negatively affect functional safety | 1.1.9, 1.2.1a | method | [N] | **gap** (see EN-4.3/238) | P4 + CT-A | – |
| EN-7.2.2/… | Cryptography (state of the art; references in the bibliography) | – | track | [N]? | **gap** — check whether 7.2.2 contains "shall" (none extracted) | – | – |

### 7.3 Information collection (logging)

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.3.1/281 | Types of interventions to be considered (list a–e) | – | track | [N] | **partial** — baseline, no evaluation yet (design §6) | CT-A | – |
| EN-7.3.2/295–296 | Record interventions that change software or data; minimum content | 1.1.9, 1.2.1f | track | [N] | **partial** — baseline, no evaluation yet | CT-A | – |
| EN-7.3.3/304–311 | Means for traceability; readable/accessible evidence; documentation how to access; automatic collection | 1.1.9, 1.2.1f | track | [N] | **partial** — baseline, no evaluation yet | CT-A | – |
| EN-7.3.4/317–319 | Storage: last intervention of each type; ≥ 5 years; from putting into service | 1.1.9, 1.2.1f | track | [N] | **partial** — baseline, no evaluation yet | CT-A | – |
| EN-7.3.5/321–322 | Logs protected against tampering; deletion only by authorised procedure | – | track | [N] | **partial** — baseline, no evaluation yet | CT-A | – |

### 7.4 Protection measures against corruption

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.4.2/334 | Determine and document an SRSL for each safety function | 1.1.9, 1.2.1a | method | [N] | **met?** — `calculatedSrsl` per risk; per (safety function × interface) | P4 + CT-A | `en50742-risk-calculation.test.ts` |
| EN-7.4.2/335 | SRSL based on the threat assessment; correlates with risk reduction of the measure and likelihood of exploitation | 1.1.9, 1.2.1a | method | [N] (method [K], F1) | **partial** — Annex B method implemented; classification as [K] missing (F1) | P3/P4 | `en50742-approach-a-core.test.ts` |
| EN-7.4.2/342 | Select the measures associated with the SRSL | 1.1.9, 1.2.1a | method | [N] | **partial** — mandated controls in the picker | P4 | `en50742-mandated-controls.test.ts` |
| EN-7.4.2/344 | Table 2: SRSL0 only for a completely isolated safety system; SRSL1–3 per attack potential (and reversibility) | 1.1.9, 1.2.1a | method | [N] | **gap** — F2 conflict B.6 ↔ Table 2 unchecked | P4 (validator) + CT-A | – |
| EN-7.4.3.1/347–349 | Meet at least the protection requirements of the determined SRSL; they apply to the safety function and its interfaces | 1.1.9, 1.2.1a | track | [N] | **partial** — `EN50742_SRSL_PROFILE` | P4 + CT-A | `en50742-mandated-controls.test.ts` |
| EN-7.4.3.2.1/356–360 | Authentication (SRSL1/2: entities authenticated; SRSL3: uniquely) | 1.1.9, 1.2.1a | track | [N] | **tracked?** — in profile | P4 + CT-A | check |
| EN-7.4.3.3.1/370–374 | Authorization enforcement (SRSL3: specific privileges, e.g. RBAC) | 1.1.9, 1.2.1a | track | [N] | **tracked?** | P4 + CT-A | check |
| EN-7.4.3.4.1/380–386 | Software and information integrity (SRSL3: cryptographic, at startup and …) | 1.1.9, 1.2.1a | track | [N] | **tracked?** | P4 + CT-A | check |
| EN-7.4.3.4.2/392–396 | Boot process integrity (SRSL3: secure boot) | 1.1.9, 1.2.1a | track | [N] | **tracked?** | P4 + CT-A | check |
| EN-7.4.3.4.3/402–406 | Information exchange integrity (SRSL3: secure cryptographic protocols) | 1.1.9, 1.2.1a | track | [N] | **tracked?** | P4 + CT-A | check |
| EN-7.4.3.4.4/412–421 | Input data validation; reject invalid input (graded rigour) | 1.1.9, 1.2.1a | track | [N] | **tracked?** | P4 + CT-A | check |
| EN-7.4.3.4.5/426–430 | Physical tampering detected | 1.1.9, 1.2.1a | track | [N] | **tracked?** | P4 + CT-A | check |
| EN-7.4.3.5.1/438–441 | Authenticity of SRESW/SRASW and critical configuration data | 1.1.9, 1.2.1a | track | [N] | **tracked?** | P4 + CT-A | check |

### 7.5 Identification of software versions and configuration

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.5/444–445 | Software versions and configuration relevant for protection available on demand, human-readable | 1.1.9, 1.2.1f | track | [N] | **partial** — baseline, no evaluation yet | CT-A | – |

## 6. Clauses 6 and 8 — Approach B

**Deferred** (user 2026-11-02): Approach B builds on EN IEC 62443-3-3 / -4-2; it is planned
only after TARAflow's IEC 62443 support is complete. The rows stay as the scope reminder;
nothing of §9 depends on them.

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-6/257 | EN IEC 62443-4-1:2018 applies (process) | – | ext | [N] | **ext** — organisation; TARAflow supplies TARA evidence (SR/SRM practices) | CP-B | – |
| EN-8.2/458 | Machinery systems: EN IEC 62443-3-3 with the SRs of Table 3 | – | track | [N] | **gap** — compliance profile `en-50742-b` | CP-B | – |
| EN-8.3/465–479 | Machinery components: EN IEC 62443-4-2 with Table 4; CCSC 1; compensating countermeasures in the information for use; mixed safety/non-safety components | 1.1.9, 1.2.1f | track | [N] | **gap** | CP-B | – |
| EN-8.4/482–483 | Identification of software versions / configuration for safety functions | 1.2.1f | track | [N] | **gap** | CP-B | – |
| EN-8.5/487 | Audit records (CR 2.8) persistent for at least … | – | track | [N] | **gap** | CP-B | – |

## 7. Clause 9 — Information for use

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-9/491–496 | Information for use includes: security context, software identification, how to access intervention evidence, permission/prohibition of modifications … | 1.1.9 | doc | [N] | **gap** — no report chapter "input for the information for use" | P5 + CT-A | – |
| EN-4.3/229 (link) | Remaining vulnerabilities documented in the information for use | 1.1.9, 1.2.1a | doc | [N] | **gap** — retained risks not exported as such | P5 + CT-A | – |

## 8. Informative parts used by TARAflow ([K])

| Source | Used for | Status |
|---|---|---|
| Annex B, B.1–B.4 (WoO, AC, EL scores) | likelihood inputs | implemented (`en50742-approach-a-core.ts`) |
| Annex B, B.5 (AP bands) | AP band | implemented |
| Annex B, B.6 (SRSL mapping) | SRSL lookup; `fatal` row is [D] | implemented; F2 open |
| Annex C (threat modelling example) | method guidance, examples | – |
| Annex D (threats and mitigations) | catalogue candidates | check against mitigation catalogue |

## 9. Compliance sub-tab `en-50742-a` — row list (v0.1)

The rows of Approach A that the risk engine does not cover — the baseline requirements of
7.3 and 7.5, the information for use (9) and the method checks — need a place where they
are evaluated, stated and reported. The Compliance tab has one sub-tab per active standard
since CM-2; Approach A becomes one more standard module there (user 2026-11-02). It is
shown when the regulation tag `EN50742_A` (or one of its aliases, design §3.12) is set.
Implementation steps and the module data: `model-coverage-implementation-plan.md` §8.1.

The sub-tab does **not** duplicate the risk tab: the SRSL comes from the risk calculation
and the 7.4.3 controls are selected there (design §11.4). The sub-tab reads both and shows
per clause whether the mandated controls are in place — the same picture the report needs.

### 9.1 Evidence kinds

| Kind | Source | Used for |
|---|---|---|
| **M** model | element properties, as the 62443 rules (`PropertyCheck`, D-13) | logging, log protection, authenticity of safety software |
| **R** risk | per risk with `calculatedSrsl`: the clauses `mandatedRequirementsForThreat` mandates at that tier, and the selected mandated controls (`en50742-<clause>`) with their status; planned controls use the planned overlay of the frame | 7.4.3 clause rows |
| **P** project | a named pure check over the project (hazards, risks, safety-function assets, WoO, system definition) | method rows of Clause 4 / 7.1 / 7.4.2 |
| **S** statement | analyst statement per row (K-6: per family), with a checklist where the row is type B | everything the model cannot show |

Type A / B / C keeps its meaning (A derivable, B partly with checklist, C statement).
The evaluator stays in `features/compliance` and imports `shared` only: the app layer
builds an `En50742View` (safety functions with their SRSL per interface, risks with
mandated clauses and selected controls, WoO, hazard summary) next to the property view of
`prepareProjectCompliance`.

### 9.2 Rows

Row ids are the ids of this list (unqualified inside the family `en-50742`, namespace
`en50742`, K-4). "See also" is a link to the IEC 62443-4-2 row, never evidence (K-6).

| Group | Row | Type | Evidence | Met when | See also |
|---|---|---|---|---|---|
| Threat assessment | EN-4.3/217 | A | P | hazard data imported, every in-scope hazard has a `contributes_to` input, every safety-function asset has risks | — |
| | EN-4.3/220 | B | P + S | WoO set; system definition sections `boundary` and `environment` filled. Checklist: intended use, reasonably foreseeable misuse, user groups, connections of the machine | — |
| | EN-4.3/238 + EN-7.2.1/272 | C | S | statement per safety function: the selected measures do not degrade the safety function (one row, both clauses) | — |
| | EN-7.1/260 | A | P | every interface on a path to a safety function has a risk with SRSL (or an elimination rationale) | — |
| | EN-7.4.2/334 | A | P | every safety-function asset has an SRSL on every risk of its interfaces | — |
| | EN-7.4.2/344 | A | P | no SRSL0 while an interface of the safety function has EL > EL0 (F2) | — |
| Information collection (7.3) | EN-7.3.1/281 | C | S | statement: which intervention types a–e the machine has and which are logged | CR 2.8 |
| | EN-7.3.2/295–296 | B | M + S | an element on the safety path logs changes (`nonRepudiation` ∈ audit_log / digital_signature / hardware_backed, or an `audit_logs` store). Checklist: minimum content of each record | CR 2.8, CR 2.9 |
| | EN-7.3.3/304–311 | B | M + S | as above, plus a readable access path. Checklist: evidence readable, access documented, collection automatic | CR 2.8 |
| | EN-7.3.4/317–319 | C | S | statement: last intervention per type kept ≥ 5 years from putting into service (B once the audit cluster F-11 … F-14 brings a retention field) | CR 2.9 |
| | EN-7.3.5/321–322 | B | M + S | every `audit_logs` store has `integrityProtection` ≠ none. Checklist: deletion only by an authorised procedure | CR 3.9 |
| SW identification (7.5) | EN-7.5/444–445 | C | S | statement: safety-relevant software versions and configuration readable on demand (B once F-25b `securityConfigReporting` and a version-reporting field exist, §10 O9) | HDR 3.2 RE(1), CR 7.6 |
| Protection measures (7.4.3) | EN-7.4.3.1/347–349 | A | R | summary: every clause row below is met for every (safety function, interface) | — |
| | EN-7.4.3.2.1/356–360 | A | R | every risk whose STRIDE and anchor mandate the clause has a selected mandated control for it, status done | CR 1.1, CR 1.2 |
| | EN-7.4.3.3.1/370–374 | A | R | as above | CR 2.1 |
| | EN-7.4.3.4.1/380–386 | A | R | as above (Interface × T: one of the integrity clauses suffices, design §11.4) | CR 3.4 |
| | EN-7.4.3.4.2/392–396 | A | R | as above | CR 3.14 |
| | EN-7.4.3.4.3/402–406 | A | R | as above (DataFlow × T) | CR 3.1 |
| | EN-7.4.3.4.4/412–421 | A | R | as above | CR 3.5 |
| | EN-7.4.3.4.5/426–430 | A | R | as above | CR 3.11 |
| | EN-7.4.3.5.1/438–441 | B | M + S | applies when some SRSL ≥ SRSL2; the element that loads safety software or critical configuration has `updateMechanism` ∈ signed_local / signed_ota or `malwareProtection` = code_signing, and stores with `firmware` or `safety_params` on the safety path have `integrityProtection` = signature — the properties the IEC 62443-4-2 rules use (plan §8.1, E-4). Checklist: verified at installation time. No STRIDE row mandates this clause (§10 O10) | CR 3.4 RE(1), CR 3.10 RE(1) |
| Information for use (9) | EN-9/491–496 | C | S | one statement per item: security context, software identification, access to intervention evidence, permitted / prohibited modifications | — |
| | EN-4.3/229 | B | R + S | every risk with a remaining requirement (mandated control not done, or treatment retained) is named in the information-for-use statement | — |

Row status as in the 62443 sub-tabs (met · planned · stated · open · gap · n/a · unknown).
An unrated risk or an unset WoO makes the R and P rows `unknown`, never met (D-12).

### 9.3 Header

No target level to enter: the SRSL is derived. The header shows per safety function the
highest SRSL over its interfaces (read-only, from the risk tab), the WoO, and the number
of rows per status. Header kind `srsl` next to `security-levels` and `conformance`
(plan §2.1).

## 10. Open points

| # | Point | Owner |
|---|---|---|
| O1 | Draft line numbers change with the final EN; remap IDs on publication. Check whether the final text changes Annex B / Table 2. | Juergen (standards body) |
| O2 | F1: re-classify the Annex B method as [K] in `en-50742-approach-a-design.md` §1. | design doc |
| O3 | F2: validator SRSL0 ⇒ all interfaces EL0; consider an enquiry comment on B.6 vs Table 2. | Juergen / design doc |
| O4 | F3: PLr as severity input for B.6 (link to hazard import HI-5). | design doc |
| O5 | 7.2.2 cryptography and 7.3.1 list items: confirm whether they contain normative "shall" beyond the extracted lines. | completion pass |
| O6 | Rows "met?" / "tracked?" need a test reference before they count (rule). | per step |
| O7 | Design doc refresh: canonical 5-level severity (view reversible / non-reversible / fatal) instead of a new 3-level criterion; §7.6 obsolete (ISO is covered by the conformance plan); schema fence per release; `levelToRiskScale` fix and 9→10 safety normalisation affect EN projects too. | design doc |
| O8 | Approach B (§6) is deferred until IEC 62443 support is complete; the `en-50742-b` rows and the 62443 table subsets stay unplanned until then. | user 2026-11-02 |
| O9 | 7.5 has no model field: decide a version-reporting field (shared with HDR 3.2 RE(1)) in the stage-2 triage of the model coverage plan, or keep the row C. | model coverage plan §4.3 |
| O10 | 7.4.3.5.1 (authenticity of SRESW/SRASW) is mandated by no STRIDE row of design §11.4 (`EN50742_MANDATED_CLAUSES`). Decided (E-4): the sub-tab evaluates it from the model with the existing 62443 security properties (§9.2). Still open: check against the final EN whether it belongs into the mandate table as well. | design doc §11.4 |
| O11 | Row EN-4.3/238 + 7.2.1/272 is a statement per safety function; a field per mandated control ("does not affect the safety function") would make it B. Decide with P4. | design doc §3.8 |
