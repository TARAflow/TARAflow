# TARAflow — prEN 50742 requirement coverage

**Status:** v0.4 · 2026-11-14 · v0.4: Approach B rows from the text (§6: Clauses 6 and 8 complete, findings B-F1 … B-F8 decided (O13 – O16, user 2026-11-14), row list of the sub-tab `en-50742-b`; 0.20, roadmap) — source checked again: BSI DPC 25/30551049 DC (2025-12-05) carries the same CENELEC enquiry draft, line numbers identical · v0.3: CT-A rows evaluate (CM-12, CM-12b) and are in the report (CM-13) — §4, §5, §7 rows with a CT-A row set to met / tracked with test references · v0.2: the §9.2 rows are the module `en-50742-a` (CM-11; completeness test) · source: prEN 50742:2025 (E), Draft for Enquiry
(CLC/TC 44X), licensed copy · code base: `main` 3570655c (CM-2) · v0.1: rows of Approach A
mapped to the Compliance sub-tab `en-50742-a` (§9, user 2026-11-02); Approach B deferred
**Belongs to:** `en-50742-approach-a-design.md` (Approach A) and the Compliance sub-tab
`en-50742-a` (`model-coverage-implementation-plan.md` §8.1). Approach B (§6) is the main
block of 0.20 (`doc/InProgress/Release/roadmap-to-1.0.md` §3.1; until 2026-11-14 it waited
for the IEC 62443 support, user 2026-11-02). Same role as `iso-21434-rq-coverage.md`:
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
| EN-4.3/217 | After the EN ISO 12100 risk assessment, perform a threat assessment where hazards can be caused via corruption | 1.1.9, 1.2.1a | method | [N] | **met** — CT-A project check `hazards-linked` (hazards imported and linked, every safety function has risks), in the report part (CM-12, CM-13) | P1 + hazard import + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-4.3/220 | Define the security context of the machine | 1.1.9, 1.2.1a | method | [N] | **met** — CT-A check `system-definition` (WoO, item definition boundary / environment) + checklist (intended use, misuse, user groups, connections) | P3 (WoO done) + system definition + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-4.3/221–229 | Principles: a) eliminate vulnerabilities, b) else mitigate, c) remaining ones in the information for use | 1.1.9, 1.2.1a | method | [N] | **tracked** — c) via CT-A row EN-4.3/229 (remaining requirements named per risk, statement) | P4 / P5 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-4.3/235 | Threat assessment shall be performed (connected machinery) | 1.1.9, 1.2.1a | method | [N] | see EN-4.3/217 | – | – |
| EN-4.3/238 | Countermeasures shall not negatively affect functional safety | 1.1.9, 1.2.1a | method | [N] | **tracked** — CT-A statement row (with 7.2.1/272), in the report; a field per mandated control stays open (O11) | P4 + CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-4.3/242 | Likelihood of being a target not relevant | 1.1.9, 1.2.1a | method | [N] | **met?** — F4 | P3 | preset `likelihoodFactorIds` / to add |
| EN-4.3/244, 247 | Choice of approach (A without, B with EN IEC 62443) | – | method | [N] | see EN-4.1/198 | – | – |

## 5. Clauses 5 and 7 — Approach A

### 5 / 7.1 Interfaces

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.1/260 | Identify all accessible interfaces that can affect safety and protect them (countermeasures or compensating) | 1.1.9, 1.2.1a | method | [N] | **met** — CT-A check `interfaces-assessed` on the derived paths to the safety functions (CM-12b) | P2 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts`, `safety-function-paths.test.ts` |

### 7.2 Security measures

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.2.1/268 | Select security measures risk-based so that they are adequate | 1.1.9, 1.2.1a | method | [N] | **partial** — SRSL-driven mandated controls + free mitigations | P4 | `en50742-mandated-controls.test.ts` |
| EN-7.2.1/270 | Risk-based approach considers safety risks and threat risks, intended use and security context | 1.1.9, 1.2.1a | method | [N] | **partial** | P3/P4 | – |
| EN-7.2.1/272 | Security measures shall not negatively affect functional safety | 1.1.9, 1.2.1a | method | [N] | **tracked** — see EN-4.3/238 | P4 + CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.2.2/… | Cryptography (state of the art; references in the bibliography) | – | track | [N]? | **gap** — check whether 7.2.2 contains "shall" (none extracted) | – | – |

### 7.3 Information collection (logging)

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.3.1/281 | Types of interventions to be considered (list a–e) | – | track | [N] | **tracked** — CT-A statement row | CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.3.2/295–296 | Record interventions that change software or data; minimum content | 1.1.9, 1.2.1f | track | [N] | **tracked** — CT-A model row (logging element) + checklist | CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.3.3/304–311 | Means for traceability; readable/accessible evidence; documentation how to access; automatic collection | 1.1.9, 1.2.1f | track | [N] | **tracked** — CT-A model row + checklist (readable, documented access, automatic) | CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.3.4/317–319 | Storage: last intervention of each type; ≥ 5 years; from putting into service | 1.1.9, 1.2.1f | track | [N] | **tracked** — CT-A statement row (B with the audit cluster F-11 … F-14) | CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.3.5/321–322 | Logs protected against tampering; deletion only by authorised procedure | – | track | [N] | **tracked** — CT-A model row (audit log stores integrity protected) + checklist | CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |

### 7.4 Protection measures against corruption

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.4.2/334 | Determine and document an SRSL for each safety function | 1.1.9, 1.2.1a | method | [N] | **met** — `calculatedSrsl` per risk; CT-A check `srsl-complete` per safety function, SRSL per safety function in tab and report | P4 + CT-A | `en50742-risk-calculation.test.ts`, `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.2/335 | SRSL based on the threat assessment; correlates with risk reduction of the measure and likelihood of exploitation | 1.1.9, 1.2.1a | method | [N] (method [K], F1) | **partial** — Annex B method implemented; classification as [K] missing (F1) | P3/P4 | `en50742-approach-a-core.test.ts` |
| EN-7.4.2/342 | Select the measures associated with the SRSL | 1.1.9, 1.2.1a | method | [N] | **partial** — mandated controls in the picker | P4 | `en50742-mandated-controls.test.ts` |
| EN-7.4.2/344 | Table 2: SRSL0 only for a completely isolated safety system; SRSL1–3 per attack potential (and reversibility) | 1.1.9, 1.2.1a | method | [N] | **met** — CT-A check `srsl-consistent` (SRSL0 on an interface above EL0 → gap, F2) | P4 (validator) + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.1/347–349 | Meet at least the protection requirements of the determined SRSL; they apply to the safety function and its interfaces | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A summary row `all-mandated` | P4 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.2.1/356–360 | Authentication (SRSL1/2: entities authenticated; SRSL3: uniquely) | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A risk row: mandated control done per risk (planned run: chosen) | P4 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.3.1/370–374 | Authorization enforcement (SRSL3: specific privileges, e.g. RBAC) | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A risk row | P4 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.4.1/380–386 | Software and information integrity (SRSL3: cryptographic, at startup and …) | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A risk row (Interface × T: one integrity control suffices) | P4 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.4.2/392–396 | Boot process integrity (SRSL3: secure boot) | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A risk row | P4 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.4.3/402–406 | Information exchange integrity (SRSL3: secure cryptographic protocols) | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A risk row (DataFlow × T) | P4 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.4.4/412–421 | Input data validation; reject invalid input (graded rigour) | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A risk row | P4 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.4.5/426–430 | Physical tampering detected | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A risk row | P4 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-7.4.3.5.1/438–441 | Authenticity of SRESW/SRASW and critical configuration data | 1.1.9, 1.2.1a | track | [N] | **tracked** — CT-A model row from SRSL 2 (update / code signing, firmware / safety parameter stores signed) + checklist | P4 + CT-A | `evaluate-matrix.en50742.test.ts`, `en50742-a.golden.test.ts` |

### 7.5 Identification of software versions and configuration

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-7.5/444–445 | Software versions and configuration relevant for protection available on demand, human-readable | 1.1.9, 1.2.1f | track | [N] | **tracked** — CT-A statement row (B once a version-reporting field exists, O9) | CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |

## 6. Clauses 6 and 8 — Approach B

Approach B replaces the risk-derived Approach A (Clauses 5 + 7: EL, WoO, AC, SRSL, mandated
controls) by a **fixed subset of EN IEC 62443**. Common to both approaches stay the
EN ISO 12100 risk assessment, Clause 4 (§4 above — incl. the threat assessment of 4.3 and
F4) and Clause 9 (§7). The rows below are the complete normative content of Clauses 6
and 8 (text checked 2026-11-14).

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-6/257 | The requirements of EN IEC 62443-4-1:2018 apply (secure development process) | – | ext | [N] | **ext** — organisation; TARAflow supplies the threat model / TARA evidence for the 4-1 practices (SR-2, SM) and says so in the report | CT-B statement | – |
| EN-8.2/458–459 | Machinery **systems**: EN IEC 62443-3-3:2019 with the SRs of Table 3 for their safety function(s) — FR1 SL-C2 SR 1.1; FR2 SL-C2 SR 2.1, 2.8, 2.9; FR3 SL-C2 SR 3.1, 3.4, 3.5, 3.6; FR4 none; FR5 SL-C1 SR 5.1; FR6 SL-C1 SR 6.1; FR7 SL-C2 SR 7.1, 7.2. Per FR the listed SRs are the required subset of what the SL requires (NOTE 1); the essential functions include the safety functions (NOTE 2) | **–** (B-F2) | track | [N] | **gap** — no IEC 62443-3-3 SR set in TARAflow, text not in `Standards/` (B-F1) | CT-B (role system, O13) | – |
| EN-8.3/465–466 | Machinery **components**: EN IEC 62443-4-2:2019 with the CRs of Table 4 for their safety function(s) — FR1 SL-C2 CR 1.1, 1.2; FR2 SL-C2 CR 2.1, 2.6, 2.8, 2.9, 2.12, EDR 2.13; FR3 SL-C2 CR 3.1, 3.4, 3.5, 3.6, EDR 3.2, EDR 3.11, EDR 3.14; FR4 none; FR5 SL-C1 CR 5.1; FR6 SL-C1 CR 6.1; FR7 SL-C2 CR 7.1, 7.2 (NOTE 1, 2 as Table 3) | 1.1.9, 1.2.1f | track | [N] | **gap** — rows exist in the 2019 edition; subset + fixed SL-T missing (§6.2) | CT-B | – |
| EN-8.3/471–472 | Components comply with 62443-4-2 4.2 support of essential functions (CCSC 1) and 4.4 least privilege (CCSC 3) | 1.1.9, 1.2.1f | track | [N] | **gap** — no CCSC row in the 2019 edition | CT-B statement | – |
| EN-8.3/473–478 | Compensating countermeasures of the machinery system may count for a component (CCSC 2): a component may have a lower SL-C than Table 4 when the system provides countermeasures so that the system reaches the SL-C of Table 3; then the component's information for use names the needed countermeasures and the CRs it does not meet | 1.1.9, 1.2.1f | track + doc | [N] | **partial** — supporting measures and claims exist (D-14, "with measures of the system"); the link to Table 3 and to the information for use is missing | CT-B | supporting-measure evaluation of the 62443 sub-tabs |
| EN-8.3/479–480 | Components serving safety **and** non-safety functions comply with Table 4 as well | 1.1.9, 1.2.1f | track | [N] | **gap** — scope rule (B-F4) | CT-B | – |
| EN-8.4/482–484 | Software versions and configuration relevant for safety functions available on demand, human-readable (built-in or external tool) | 1.2.1f | track | [N] | **gap** — same content as EN-7.5/444–445 of Approach A (statement row, O9) | CT-B | – |
| EN-8.5/487–488 | Audit records of CR 2.8 (auditable events) persist for at least 5 years; for safety functions only (NOTE) | – (B-F2) | track | [N] | **gap** — no retention field (O8, B-F6) | CT-B | – |

### 6.1 Findings from the B pass (decide before coding)

**B-F1 — Table 3 needs IEC 62443-3-3, which TARAflow does not have.** The system role (8.2)
asks for 13 SRs of EN IEC 62443-3-3:2019. TARAflow evaluates IEC 62443-4-2 CRs only; the
3-3 text is not in `Standards/`. The SR numbers match the CR numbers (4-2 was derived from
3-3), but the content differs (system vs component) — the CR rows cannot stand in for the
SR rows. → Options: (a) Approach B for the **component role** first (8.3, 8.4, 8.5 + common
clauses), the system role as one statement row until the 3-3 text is available;
(b) obtain IEC 62443-3-3:2019 and build an SR edition (one more edition like 2019 / prAA,
13 SRs + their REs at SL 1–2). **Decided (O13, user 2026-11-14):** (a) in 0.20; (b) is a
roadmap decision once the first customer chooses Approach B for a whole machine (a
machine builder on Approach B usually holds the 3-3 text anyway).

**B-F2 — Annex ZZ covers 8.3 and 8.4 only.** Table ZZ.1 lists 8.3 (1.1.9, 1.2.1f) and 8.4
(1.2.1f), but **not 8.2 and not 8.5**. The presumption of conformity under Reg. (EU)
2023/1230 through Approach B therefore rests on the component requirements; 8.2 and 8.5
are normative but outside ZZ. → The sub-tab marks rows outside ZZ like Approach A (ZZ
column); no consequence for the evaluation.

**B-F3 — Table 4 names EDR variants only.** For 2.13, 3.2, 3.11, 3.14 the table names the
embedded-device requirement (EDR); IEC 62443-4-2 has the same requirement for host devices
(HDR), network devices (NDR) and, for 3.2, software applications (SAR). Read literally, a
machinery component that is a host or network device (industrial PC, managed switch) is
exempt from them — probably not intended, the enquiry closed 2026-02-27. → Options:
(a) literal — only EDR rows; (b) by analogy — the device-category variant counts (12 more
rows); (c) literal, the variants shown as a recommendation. **Decided (O14, user
2026-11-14): (c).** The report claims conformity to the standard, not to TARAflow's reading —
a host device must not show open rows the text does not ask for. The EDR rows count for
the status; the HDR / NDR / SAR variants appear as "recommended (analogy, B-F3)" and stay
out of the met / open summary [D]. If the final EN corrects Table 4, the recommendation
becomes a required row — a data change under O1.

**B-F4 — Scope: "for their safety function(s)".** Tables 3 and 4 apply to the system /
component **for its safety functions**; 8.3/479–480 extends a mixed component to the full
table. TARAflow can derive the safety path already (§9.2, CM-12b: from safety-function
assets backwards along the flows). **Decided (O15, user 2026-11-14):** the rows are evaluated on the DFD elements on a path to
a safety function (and on the safety function's own elements); an element with mixed
functions is evaluated in full (8.3/479–480); elements outside are listed as out of scope,
never as met. A component without a safety function makes the module `unknown`, not met
(as Approach A).

**B-F5 — Fixed SL-T, nothing to enter.** The SL-T vector is fixed by Table 4: FR1 2, FR2 2,
FR3 2, FR4 0, FR5 1, FR6 1, FR7 2 — but only for the listed CRs; per listed CR the REs
selected by that SL apply (NOTE 1: the listed requirements are the required subset of the
requirements defined by the SL). Computed from the 2019 edition (`minSl` ≤ SL of the FR):
26 rows (§6.2). The header shows the fixed vector read-only, SL-C per FR as in the 62443
sub-tabs.

**B-F6 — 8.5 and 7.3.4 ask for the same kind of field.** Approach A 7.3.4 keeps the last
intervention per type ≥ 5 years; Approach B 8.5 keeps the CR 2.8 audit records ≥ 5 years.
One field on the store that holds the audit records (e.g. `retentionYears` on
`audit_logs` stores, carried from the CRA coverage P-6 as `auditLogRetentionYears`) serves
both rows — B for 8.5, and 7.3.4 of Approach A from C to B. Field addition only, no
retirement (roadmap rule 4). **O8.**

**B-F7 — 4.3/242 applies to Approach B too.** "Likelihood of being targeted is not
relevant" is a common clause. The preset `en-50742-b` leaves the project's likelihood
factors as they are (`regulation-preset.ts`: no `likelihoodFactorIds`) — the default
weighted-mean set (preset `standard`: `skill_level`, `motive`, `opportunity`,
`ease_of_exploit`) rates the attacker's motive. **Decided (O16, user 2026-11-14):**
`en-50742-b` manages the factors as `standard` without `motive` (`size` of the threat agent
group, off by default, stays off);
the B sub-tab checks it like F4 does for A. Changes risk values of existing B projects —
there are none in the field yet, the tag is switched off since 0.17. **O16.**

**B-F8 — No SRSL in Approach B.** Annex B and Table 2 belong to Approach A (Clause 7). In
B the risk tab keeps its normal risk calculation; the SRSL column and the Annex B
likelihood are not used. The safety-path search (B-F4) still needs the safety-function
assets (asset with a physical impact) and the hazard link of 4.3/217 — the P rows of
Approach A for Clause 4 apply unchanged.

### 6.2 Sub-tab `en-50742-b` — row list (component role)

Evidence kinds and statuses as §9.1. The 62443 rows are the 2019 edition's rows (same
requirement ids, same model rules, statements shared inside the family `iec-62443-4-2`
— K-6), filtered and with the fixed SL-T; the EN rows are new rows of the family
`en-50742` (statements shared with Approach A where the clause is common).

| Group | Rows | Type / evidence | Met when |
|---|---|---|---|
| Common (4, 9) | EN-4.3/217, EN-4.3/220, EN-4.3/238, EN-4.3/229, EN-9/491–496 | as §9.2 | as §9.2 (shared statements with `en-50742-a`) |
| Process (6) | EN-6/257 | C / S | statement: development process per IEC 62443-4-1 (organisation); TARAflow evidence named |
| FR1 IAC, SL 2 | CR 1.1, CR 1.1 RE(1), CR 1.2 | rows of the 2019 edition | as the 2019 sub-tab, on the safety-path elements |
| FR2 UC, SL 2 | CR 2.1, CR 2.1 RE(1), CR 2.1 RE(2), CR 2.6, CR 2.8, CR 2.9, CR 2.12, EDR 2.13 | as above | as above |
| FR3 SI, SL 2 | CR 3.1, CR 3.1 RE(1), EDR 3.2, CR 3.4, CR 3.4 RE(1), CR 3.5, CR 3.6, EDR 3.11, EDR 3.14, EDR 3.14 RE(1) | as above | as above |
| Recommended (B-F3, not counted) | HDR 2.13, NDR 2.13, SAR 3.2, HDR 3.2, HDR 3.2 RE(1), NDR 3.2, HDR 3.11, NDR 3.11, HDR 3.14, HDR 3.14 RE(1), NDR 3.14, NDR 3.14 RE(1) | rows of the 2019 edition, marked recommended | evaluated and shown for the component's device category; outside the met / open summary and the header SL-C |
| FR4 DC | — | — | none required |
| FR5 RDF, SL 1 | CR 5.1 | as above | as above |
| FR6 TRE, SL 1 | CR 6.1 | as above | as above |
| FR7 RA, SL 2 | CR 7.1, CR 7.1 RE(1), CR 7.2 | as above | as above |
| CCSC (8.3) | EN-8.3/471–472 | C / S | statement per CCSC 1 and CCSC 3 |
| | EN-8.3/473–478 | B / M + S | every Table 4 row below its SL that is met only with supporting measures / claims is named in the information-for-use statement with the countermeasure the system must provide |
| | EN-8.3/479–480 | A / P | scope check: every element that serves a safety function is evaluated in full (no partial scope inside an element) |
| Identification (8.4) | EN-8.4/482–484 | C / S | statement, shared with EN-7.5/444–445 (O9) |
| Persistency (8.5) | EN-8.5/487–488 | B / M + S | the audit-record store on the safety path has a retention ≥ 5 years (field of B-F6); checklist: records survive restart / replacement |
| System role (8.2) | EN-8.2/458–459 | C / S | statement: the machinery system meets Table 3 per IEC 62443-3-3 (O13) |

26 counted rows from the 2019 edition plus 12 recommended ones (O14). The completeness test of the
module reads this table, as `en50742-a-module.test.ts` does for §9.2.

## 7. Clause 9 — Information for use

| ID | Requirement | ZZ | Role | Marker | Status | Plan | Code / Test |
|---|---|---|---|---|---|---|---|
| EN-9/491–496 | Information for use includes: security context, software identification, how to access intervention evidence, permission/prohibition of modifications … | 1.1.9 | doc | [N] | **tracked** — CT-A statement row; the report part lists the open rows (CM-13) | P5 + CT-A | `evaluate-matrix.en50742.test.ts`, report `compliance-matrix-chapter.test.ts` |
| EN-4.3/229 (link) | Remaining vulnerabilities documented in the information for use | 1.1.9, 1.2.1a | doc | [N] | **tracked** — CT-A row EN-4.3/229: risks with a remaining requirement named, statement | P5 + CT-A | `evaluate-en50742.test.ts`, `en50742-a.golden.test.ts`, report `compliance-matrix-chapter.test.ts` |

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

**Implementation (CM-11, 2026-11-03):** `src/features/compliance/data/edition-en-50742-a.ts`
(rows), `en50742-a-rules.ts` (type, evidence kind), `en50742-a-texts.ts` (EN / DE); the test
`en50742-a-module.test.ts` reads this table and fails when a row, its order, group, type or
evidence kind differs. Row ids in code: `en-<clause>-<first draft line>`, e.g.
`en-7.3.2-295`. M rows from the model (CM-11); R and P rows from the En50742View
(CM-12, `evaluate-en50742.ts`); 7.4.3.5.1 applies once a risk reaches SRSL 2.

**Paths to a safety function (EN-7.1/260, CM-12b, user 2026-11-03):** derived, no
relation to maintain. A safety function is an asset with a physical impact; its DFD
elements are the asset's `linkedDFDElements`. From them the search runs backwards against
the flow direction, transitively and without a hop limit, and collects the flows and the
interfaces they pass (`DataFlowAnalysis.interfaceIds`); it does not cross a trust boundary
with the control `data_diode` or `unidirectional_gateway`. Each interface or flow on such
a path with an EL above EL0 needs a risk with SRSL there, or the threat excluded with a
justification ("won't"); an Interface without EL is unknown, a safety function without DFD
elements too. A statement overrules the row for special cases.

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
| O8 | Approach B (§6) is deferred until IEC 62443 support is complete; the `en-50742-b` rows and the 62443 table subsets stay unplanned until then. **Update 2026-11-14:** the IEC 62443-4-2 editions are implemented (0.17/0.18); Approach B is a 1.0 priority (user), rows in §6. Input carried over from the CRA coverage (P-6): the audit log retention (`auditLogRetentionYears`) for 8.5 — B-F6: one retention field on the audit-record store serves 8.5 and 7.3.4; `DS.deletionMechanism` already covers CR 4.2. | user 2026-11-02, 2026-11-14 |
| O9 | 7.5 has no model field: decide a version-reporting field (shared with HDR 3.2 RE(1)) in the stage-2 triage of the model coverage plan, or keep the row C. | model coverage plan §4.3 |
| O10 | 7.4.3.5.1 (authenticity of SRESW/SRASW) is mandated by no STRIDE row of design §11.4 (`EN50742_MANDATED_CLAUSES`). Decided (E-4): the sub-tab evaluates it from the model with the existing 62443 security properties (§9.2). Still open: check against the final EN whether it belongs into the mandate table as well. | design doc §11.4 |
| O11 | Row EN-4.3/238 + 7.2.1/272 is a statement per safety function; a field per mandated control ("does not affect the safety function") would make it B. Decide with P4. | design doc §3.8 |
| O12 | Approach B is switched off in `shared/utils/tag-categories.ts` with the outdated reason "no IEC 62443-4-2 support yet"; `regulation-presets-design.md` is stale. Switch on with the sub-tab. | 0.20 |
| O13 | B-F1: system role (8.2, Table 3). **Decided 2026-11-14:** component role + statement row for 8.2 in 0.20; an IEC 62443-3-3 SR edition once a customer chooses B for a whole machine (roadmap §4 R-9). | done |
| O14 | B-F3: Table 4 EDR-only rows. **Decided 2026-11-14:** literal for the status; HDR / NDR / SAR variants shown as recommended, not counted. Re-check with the final EN (O1). | done |
| O15 | B-F4: scope. **Decided 2026-11-14:** elements on a path to a safety function (CM-12b search), mixed elements in full, outside = out of scope, no safety function = unknown. | done |
| O16 | B-F7. **Decided 2026-11-14:** preset `en-50742-b` = the `standard` factors without `motive` (4.3/242 is common to both approaches). | done |
