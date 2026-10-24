# TARAflow — ISO/SAE 21434 Conformance: Implementation Plan

> **Status:** Draft rev. 2, decisions of §6 taken, clarifications open (§9) ·
> 2026-10-24 · base: v0.14.0-beta (rev. 1: 2026-10-16, v0.13.3-alpha)
> **Supersedes in part:** `doc/InProgress/RegulationCompliance/iso-21434-support-design.md`
> (that document deliberately limited TARAflow to Clause 15 and kept cybersecurity
> goals as a link stub, DS-6. This plan reverses DS-6 and extends the scope to the
> work products a TARA tool can carry; see §1).
>
> Normative source: ISO/SAE 21434:2021. Clause, RQ and WP references were checked
> against the licensed copy (2026-10-16); requirement texts are paraphrased — the
> standard is authoritative.
>
> **Markers** used for every decision in this plan:
> **[N]** normative (ISO requirement, RQ cited) · **[D]** TARAflow design decision ·
> **[K]** configurable project methodology (the customer may choose otherwise).

---

## 1. What "fully conformant" can mean for a tool

ISO/SAE 21434 is a process standard. Conformance is claimed by an
**organisation for a project**, not by a tool. A tool can do two things:

1. **Produce every work product** that the TARA and concept activities require,
   in a form an assessor accepts (complete, consistent, traceable, reproducible).
2. **Make gaps visible** (missing links, unrated items, undecided risks) so the
   organisation can close them.

**Target of this plan:** TARAflow produces, for an `iso-21434` project, all work
products of

| Clause | Activity | In TARAflow after this plan |
|---|---|---|
| 9.3 | Item definition | structured item definition + assumptions |
| 9.4 | TARA, cybersecurity goals, claims, verification (WP-09-02 … 09-05) | goals (with CAL), claims (with assumptions), verification record |
| 9.5 | Cybersecurity concept (WP-09-06, 09-07) | links goal → requirement → allocation |
| 15.3 | Asset identification, damage scenarios | assets + first-class damage scenarios (1:n) |
| 15.4 | Threat scenario identification | threats linked n:m to damage scenarios |
| 15.5 | Impact rating | S/F/O/P per damage scenario on the ISO scale |
| 15.6 | Attack path analysis | attack trees (existing) |
| 15.7 | Attack feasibility rating | attack potential (existing) + optional attack-vector / CVSS |
| 15.8 | Risk value determination | risk value 1–5 per threat scenario [N]; matrix or formula [K] |
| 15.9 | Risk treatment decision | ISO option names, mandatory follow-up (goal or claim) |
| 8.x  | Continual activities (inputs) | re-assessment triggers, vulnerability → attack path link |

**Remains outside the tool** (organisation/process, or other tools): Clauses 5–7
(governance, management, distributed activities / interface agreements), 10–14
(development, validation, production, operations, decommissioning), the
cybersecurity case as an argument. TARAflow exports **evidence** for these; it
does not manage them.

---

## 2. Gap summary (current state, verified against v0.13.3)

| # | Gap | Today | Severity |
|---|---|---|---|
| G1 | Risk value 1–5 (15.8, **RQ-15-16** [N]) | `R = I × L` mapped to a 4-step level — **not conformant**: the standard requires a value from 1 to 5, 1 = minimal risk; no acceptance criteria | **high** (normative, changes values) |
| G2 | Damage scenarios 1:n (15.3) | one per asset × security goal (`SecurityGoal.consequence` + `impactRatings`) | high |
| G3 | Threat ↔ damage scenario (15.4) | implicit via asset; no explicit link | high |
| G4 | Risk per threat scenario (15.8, **RQ-15-15** [N]) | one risk per attack path; the standard determines the risk *for each threat scenario* | **high** (normative) |
| G5 | Treatment options (15.9) | `eliminate/reduce/accept/transfer/share` — not the ISO names `avoid/reduce/share/retain` | low |
| G6 | Cybersecurity goals (9.4) | asset security goals (`SecurityGoal.formalDescription`) exist but are not tied to *reduce* decisions; no CAL | high |
| G7 | Cybersecurity claims (9.4) | justification text on accept/share/transfer and in the Won't list; no claim object, no assumptions | high |
| G8 | Item definition (9.3) | free text in General tab | medium |
| G9 | Concept / requirements traceability (9.5 → 10) | mitigations and verifications per risk; no goal → requirement → verification chain | medium |
| G10 | Impact scales (15.5, Annex F) | 4-level scale; safety on ISO 12100 terms, not the ISO 26262 severity classes | medium (automotive only) |
| G11 | Feasibility methods (15.7, Annex G) | attack potential only | low (attack potential is conformant) |
| G12 | Work products and methodology in the report | traceability matrix exists; no WP structure, no methodology section, no calc stamp | medium |
| G13 | Continual TARA (Clause 8) | re-assessment triggers only in the workflow diagram | low |

**Already in v0.14.0-beta** (from the earlier support design, not repeated in
the phases): STRIDE-per-interaction off for `iso-21434`
(`RegulationPreset.disabledThreatGenerators`), SFOP hard-lock on the asset side,
`iso21434-core` (18045 attack potential, Table G.7 bands), and the *display* of
the risk per impact category (15.8 NOTE 1) in the risk dialog and the ISO
traceability matrix. Not yet in the code: everything of Phase 0 onwards (no
`calcVersion`, no `ItemDefinition`, no `DamageScenario`; `RISK_TREATMENTS`
still eliminate/reduce/accept/transfer/share).

Repo hygiene: the former `iso-21434-support-design-addon.md` was a committed
symlink to a local download path (dangling for everyone else); it is replaced
by this file.

---

## 3. Design principles

1. **Additive where possible.** Every phase except Phase 3 adds data; existing
   projects open unchanged. Phase 3 recomputes risk values and therefore needs a
   schema bump, a migration and a "decisions to review" list.
2. **One project, two modes.** ISO-specific objects and rules (treatment
   names, scale lock, risk value 1–5, goals, claims, CAL) are visible only under
   the `iso-21434` preset. The TARAflow default mode and EN 50742 keep their
   behaviour. Exception: the **Item Definition** (Phase 1) is
   preset-independent; the preset only decides which sections are mandatory
   (decision 8, §6).
3. **Analyst decisions are never overwritten.** Same rule as for security goals
   (`source: "manual"`) and the relevance override (fixed in 0.13.3): derived
   values may change, decisions are kept and flagged when their basis changed.
4. **Every link is checkable.** Each phase adds validator rules to the existing
   completeness validation and rows to the traceability coverage matrix.
5. **Each phase ships on its own** (own release, own tests, own migration if any).
6. **No side effects on other methods.** Every phase has a test that projects
   under every other preset (`standard`, `en-50742-a`, `en-50742-b`,
   `etsi-tvra`) compute and display exactly what they did before.

---

## 4. Phases

Order: foundations first (terminology, item, damage scenarios), then the
value-changing risk step, then what follows from the treatment.

### Phase 0 — Terminology and method baseline (small, no schema change)

Closes G5, prepares G12.

- **Treatment names.** In ISO mode, label the options as ISO 15.9 does and map the
  existing values:

  | stored value | ISO label |
  |---|---|
  | `eliminate` | Avoid |
  | `reduce` | Reduce |
  | `accept` | Retain |
  | `share` | Share |
  | `transfer` | not offered in ISO mode; existing values shown as **"Share (transfer)"** and flagged *decision to review* |

  Keep the stored values (no migration). A new label must not silently
  reinterpret an existing decision: `accept → Retain` is documented as a 1:1
  mapping in the methodology record; `transfer` is shown as such until the
  analyst confirms it as *Share*. See §6.3. [N] RQ-15-17 lists the four options.
- **Methodology record** in the project configuration:
  `normativeBasis`, impact scale and labels, feasibility method, risk matrix id,
  acceptance criteria (filled in Phase 3), aggregation rules (OR = MAX / AND = MIN,
  max over S/F/O/P or per category).
- **Scale lock in the ISO preset [N]** — the three scales are fixed by the
  standard and must not follow the project's general 3/4/5-level setting:

  | Scale | ISO requirement | TARAflow today | ISO preset |
  |---|---|---|---|
  | Impact per category | RQ-15-05: severe / major / moderate / negligible (4) | `impactScale` 3/4/5-level selectable | locked to 4-level, ISO labels |
  | Attack feasibility | RQ-15-10: high / medium / low / very low (4) | `FeasibilityBandLevel`, 4 levels | unchanged |
  | Risk value | RQ-15-16: 1 … 5 | `RiskScaleType` 3/4/5-level | locked to 1–5 (Phase 3/3a) |

  Validator: an ISO project with a 3- or 5-level impact scale is a finding;
  switching to the ISO preset with another impact scale asks to remap and
  flags the ratings for review.
- **Calculation stamp** on every computed risk and feasibility:
  `{ method, calcVersion, mappingVersion }`.
- **CIANAAA ↔ CIA mapping table** in the methodology section (ISO names C, I, A
  only as examples; the extension must be documented):
  AuthN, N, Acc → I; AuthZ → C or I depending on the access; explain why they
  are kept separate (Spoofing / EoP / Repudiation visibility).

*Done when:* ISO projects show ISO treatment names; the report has a methodology
section; every risk carries a calc stamp. Tests: label mapping, stamp present,
default mode unchanged.

### Phase 1 — Item Definition in the General tab (9.3) (medium, small migration)

Closes G8; provides the assumptions used by claims in Phase 4.

**Rev. 2 (decision 8):** the Item Definition is a **preset-independent
feature**, not an ISO add-on. It lives in a sub-tab **"Definition"** of the
Overview tab, for every project. The current project description
(`GeneralTabData.info.description`) moves into the section *Purpose and
functions* (migration, text unchanged). The preset only decides which sections
are mandatory (validator findings): `iso-21434` → RQ-09-01/02,
`en-50742-a`/`en-50742-b`/`etsi-tvra` → open, `standard` → none. IEC 62443-4-1
(SRM-2/3) has no preset today; the rule applies once one exists. Open: scope of the arc42
import and drift detection (§9 K1b), shape of the assumptions (§9 K2).

Normative basis [N]: **RQ-09-01** item boundary (a), functions over the lifecycle
(b), preliminary architecture (c); **RQ-09-02** operational environment relevant
to cybersecurity, including assumptions (NOTE 8) → **WP-09-01**. The same content
is required by IEC 62443-4-1 (prAA) SRM-2 (intended use, functions, data) and
SRM-3 (security context).

- **"Definition" sub-tab in the reworked General (Overview) tab [D]** — see
  *Overview rework* below. Visible in all presets; which sections are mandatory
  follows the preset (rev. 2 note above). Sections follow the requirements, not
  the arc42 order:

  | Section | ISO | arc42 source (typical) | Link into the model |
  |---|---|---|---|
  | Item boundary | RQ-09-01 a) | §3 Context and scope (business + technical) | DFD physical boundaries, interfaces, external entities |
  | Purpose and functions (takes over the project description) | RQ-09-01 b) | §1 Introduction and goals, §6 Runtime view | function assets |
  | Preliminary architecture | RQ-09-01 c) | §5 Building block view (level 1) | top-level DFD / leveled DFD page |
  | Operational environment | RQ-09-02 | §7 Deployment view, §2 Constraints | trust boundaries, external entities |
  | Assumptions | RQ-09-02 NOTE 8 | §2 Constraints, §11 Risks | `Assumption` objects |
  | Constraints, legal requirements | – (supporting) | §2 Constraints | – |

- **Data model:**

  ```ts
  interface ItemDefinition {
    sections: Record<ItemSectionId, {
      text: string;                      // own wording or excerpt
      source?: SourceRef;                // where it comes from
      modelRefs: string[];               // DFD element / page / asset ids
    }>;
    functions: { id: string; name: string; lifecyclePhases: LifecyclePhase[];
                 functionAssetId?: string }[];
  }
  type ItemSectionId = "boundary" | "functions" | "architecture"
                     | "environment" | "constraints";
  interface SourceRef {
    document: string;                    // e.g. "arc42 AiO 2.0"
    section: string;                     // e.g. "§3 Kontextabgrenzung"
    bindingId?: string;                  // existing SourceBinding (repo + pinned commit)
    path?: string;                       // file in that repo, e.g. docs/arc42/03_context.adoc
    version?: string;                    // doc version when not in a repo
    contentHash?: string;                // hash of the imported section text
    importedAt?: string;
  }
  interface Assumption {
    id: string; displayId: string;       // ASM-nn
    text: string; source?: SourceRef; owner?: string;
    reviewBy?: string; status: "open" | "confirmed" | "invalid";
  }
  ```

  `Assumption` replaces copied text in trust-boundary `securityAssumptions`
  (link instead of copy; migration turns existing texts into ASM objects).

- **arc42 as source, not copy [D].** Each section records its `SourceRef`; the
  text is the analyst's summary or an excerpt. The arc42 document stays the
  master for the architecture description.
- **arc42 import [D].** The arc42 template headings are standardised, so an
  import of an AsciiDoc or Markdown arc42 document (German and English
  headings) pre-fills the sections: §1 → functions, §3 → boundary,
  §5 → architecture, §7 → environment, §2 → constraints/assumption candidates.
  The analyst reviews each pre-filled section before it counts as filled.
  Import stores `contentHash` per section.
- **No double modelling [D].** Boundary and architecture reference the DFD;
  they do not redraw it. Validator: every interface on the item boundary in the
  DFD is mentioned in the boundary section, and every external system named
  there exists as external entity or interface — mismatches are findings both
  ways.
- **Reuse the existing source bindings [D].** When the arc42 document lives in a
  repository (docs-as-code), the `SourceRef` points to an existing
  `SourceBinding` plus the file path. The binding's pinned commit and its drift
  check (`source-binding-drift.ts`) then tell when the documentation moved on —
  no second versioning mechanism. For documents outside a repository the
  `version` field and the content hash are used.
- **Change detection → re-assessment [D]** (feeds Phase 8): binding drift or a
  re-import of the arc42 document compares `contentHash` per section. A changed section marks
  the item-definition section *changed since import*, creates a re-assessment
  trigger ("architecture change", with the section and old/new version) and
  flags the linked DFD elements for review. Nothing in the TARA is changed
  automatically.

#### Overview rework (part of Phase 1) [D]

The General tab gets sub-tabs instead of a growing stack of sections:

| View | Content | Today |
|---|---|---|
| **Project** | name, version, roles, tags, progress (without the description) | `ProjectInfo`, `ProjectProgress` |
| **Definition** | purpose and functions (former description), boundary, architecture, environment, constraints, assumptions (ASM) | new (this phase); description from `ProjectInfo` |
| **Methodology** | preset, locked scales, risk method and acceptance criteria (read-only summary), CIANAAA ↔ CIA mapping, `requireCal` | `ProjectSettings` + Phase 0 record |
| **Sources** | source bindings, arc42 references, drift status | `SourceBindingsSection` |

- Each view shows a badge with its open findings; the last selected view is
  remembered per project.
- **Risk matrix / formula and acceptance criteria stay in the Risk tab's
  configuration dialog** (decision 2026-10-16). The Methodology view shows them
  read-only with a link to the dialog. Moving the editor later is possible
  without data changes — the record lives in the project, not in the tab.
- Non-ISO projects see under *Project* what they see today **minus the
  description**, which moves to *Definition* for every project (decision 8).
  Methodology is optional there.

*Done when:* the General tab has the four sub-tabs; the Definition sub-tab produces WP-09-01 as a report chapter with
source references; assumptions are referenceable objects; an arc42 re-import
with a changed section raises a re-assessment trigger.

### Phase 2 — Damage scenarios as first-class objects (15.3, 15.4, 15.5) (medium–large, schema bump)

Closes G2, G3, G10.

- New entity:

  ```ts
  interface DamageScenario {
    id: string;              // UUID
    displayId: string;       // DS-nn
    assetId: string;
    property: SecurityGoalType;          // violated cybersecurity property
    consequence: string;                 // "If … then … resulting in … for …"
    impact: { S?: Level; F?: Level; O?: Level; P?: Level; other?: … };
    hazardRefs?: string[];               // safety link via Hazard Items
    source: "suggested" | "manual";
  }
  ```

- **Migration (schema +1):** for every `SecurityGoal` with `consequence` or
  `impactRatings`, create one `DamageScenario` (same text, same ratings). The
  `SecurityGoal` keeps its level; its impact becomes the MAX over its damage
  scenarios (derived, not stored twice).
- **1:n:** the analyst can add further damage scenarios to the same
  asset × property (e.g. integrity of charging parameters → overheating (S) and
  wrong billing (F)).
- **Threat ↔ damage scenario (15.4):** `Threat.damageScenarioIds[]`, suggested
  from asset + STRIDE → property (the existing goal-intersection rule), editable.
  Validator: every relevant threat has ≥ 1 damage scenario; every damage
  scenario is reached by ≥ 1 threat or marked "no threat identified" with reason.
- **Impact scale (Annex F):** ISO labels *negligible / moderate / major / severe*
  per category. Safety scale follows the preset (§6.1): ISO 26262 severity
  classes for `iso-21434`, ISO 12100 for `en-50742-a`.
- **Structured consequence (not EARS — a damage scenario describes harm, not a
  required behaviour).** Store the parts, render the sentence:

  | Field | Example |
  |---|---|
  | `property` + `assetId` (given) | integrity of charging parameters |
  | `behaviour` — what the item does wrong | charger delivers current above the vehicle limit |
  | `harm` — the adverse consequence | cable/inlet overheats, fire risk |
  | `affected` — who is harmed | `road_user` · `vehicle_user` · `operator` · `manufacturer` · `third_party` |

  Rendered: *If the ⟨property⟩ of ⟨asset⟩ is violated, then ⟨behaviour⟩,
  resulting in ⟨harm⟩ for ⟨affected⟩.* `affected` suggests the S/F/O/P
  categories to rate (road/vehicle user → S, P; operator → O, F;
  manufacturer → F), the analyst decides. Free text stays possible; the
  existing `consequence` strings migrate into `harm` and are flagged
  "unstructured".
- UI: Assets tab gets a damage-scenario list per asset × property with the four
  fields and a live preview of the sentence.

*Done when:* WP-15-01 (damage scenarios) and WP-15-04 (impact ratings) are
separate report tables; a threat shows which damage scenarios it can cause.
Tests: migration round-trip (old file → new → save → reopen), 1:n, validator.

### Phase 3 — ISO risk determination (15.8) (large, value-changing)

Closes G1, G4.

- **Risk value 1–5 [N]** (RQ-15-16: value between 1 and 5, 1 = minimal risk).
  **Only for `iso-21434` (decision 10).** `standard` and `en-50742-a` keep the
  current `RiskScaleType` 3/4/5-level matrix and SRSL unchanged.
  The **method is free [K]** — the standard names risk matrices and risk formulas
  as examples. TARAflow offers both:
  - matrix impact (4 levels) × feasibility (4 levels: very low / low / medium /
    high) → 1–5; default = the informative example of Annex H, **labelled as
    example**, editable per project;
  - formula: existing `I × L`, mapped onto 1–5 by a documented table (keeps
    today's ordering of risks; only the scale changes).
  The choice and the table are stored in the methodology record.
- **Acceptance criteria:** per risk value, which treatment options are
  admissible (e.g. 4–5 must not be retained without a claim approved by role X).
  Validator enforces them in Phase 4.
- **Granularity:** compute
  1. feasibility per attack path (existing),
  2. threat-scenario feasibility = MAX over its paths [K] (RQ-15-15 NOTE 2 names
     this as one possible aggregation),
  3. risk per **threat scenario × damage scenario** [N: per threat scenario,
     RQ-15-15; per damage scenario allowed by NOTE 1], value from the highest
     S/F/O/P rating of that damage scenario [D] (§6.2),
  4. keep the per-path view as drill-down (it is what drives mitigation choice).
- **Migration:** recompute all ISO risks; keep `treatment`, `moscowPriority`,
  justifications; list every risk whose value class changed as
  *"decision to review"* (banner + filter in the Risk tab). Never change a
  treatment automatically.
- Risk tab grouping in ISO mode: by threat scenario, paths nested.

*Done when:* WP-15-06 (feasibility) and WP-15-07 (risk values) are produced per
threat scenario with values 1–5; existing projects migrate with a review list.

**Risk:** the only phase that changes numbers in existing ISO projects. Release
it alone, with a clear release note.

### Phase 4 — Treatment → cybersecurity goals and claims (15.9 → 9.4) (medium–large, additive)

Normative basis [N]: RQ-09-05 — a goal for every threat scenario whose treatment
includes *reducing*; RQ-09-06 — a claim for *sharing* and for *retaining*
(15.9 NOTE: their rationales are recorded as claims and monitored under Clause 8);
RQ-09-07 — verification of the TARA, goals and claims (WP-09-05). CAL: RQ-09-05
NOTE 4 "if applicable", Annex E → optional [K].

Closes G6, G7. Reverses DS-6 of the support design.

- **Goal entity:**

  ```ts
  interface CybersecurityGoal {
    id: string; displayId: string;          // CSG-nn
    statement: string;                      // concept-level requirement
    threatScenarioIds: string[];            // n:m, only threats treated "reduce"
    damageScenarioIds: string[];
    assetGoalRefs: { assetId: string; property: SecurityGoalType }[];
    cal?: 1 | 2 | 3 | 4;                    // informative Annex E; required if project.requireCal
    calRationale?: string;
  }
  ```

  *Suggestion:* for each asset security goal whose threats are treated *reduce*,
  propose a goal with `formalDescription` as statement. The analyst merges,
  splits and confirms; confirmed goals are `manual`.
- **Claim entity:**

  ```ts
  interface CybersecurityClaim {
    id: string; displayId: string;          // CLM-nn
    statement: string;
    riskIds: string[];                      // retained / shared risks
    kind: "retain" | "share";
    assumptionIds: string[];                // Phase 1 objects
    responsibleParty?: string;              // for share: who carries it
    reviewBy?: string;                      // date
  }
  ```

  The Won't list stays a MoSCoW view; claims attach to the **treatment**, not to
  the MoSCoW priority.
- **Validators (the conformance core):**
  - every risk treated *reduce* → ≥ 1 goal;
  - every risk treated *retain/share* → ≥ 1 claim;
  - every *avoid* → justification (what was removed);
  - acceptance criteria from Phase 3 respected;
  - every claim has ≥ 1 assumption; overdue `reviewBy` is a finding.
- Migration helper (optional, manual trigger): parse `CSG-xx` / `CLM-xx`
  prefixes from existing justifications (the workshop convention) into objects.

- **Verification record (WP-09-05):** reviewer, date, scope (TARA consistency,
  goals vs. treatments, claims vs. treatments) — a review form, not automation.

*Done when:* goals and claims (WP-09-03, WP-09-04) are report chapters and appear
in the coverage matrix; no ISO risk ends without a goal, a claim or an avoid
justification.

### Phase 5 — Concept and requirements traceability (9.5 → 10) (medium, additive)

Normative basis: 9.5 cybersecurity concept (WP-09-06) and its verification
(WP-09-07); requirements continue in Clause 10.

Closes G9.

- `CybersecurityRequirement { id: "CSR-nn", text, goalIds[], allocatedTo:
  DFD element ids[], mitigationRefs[] }` — the existing mitigation catalogue
  entries become the implementation side; existing verifications attach to the
  requirement.
- Chain in the coverage matrix:
  `Goal → Requirement → Mitigation → Verification → Residual risk`.
- Validator: every goal has ≥ 1 requirement; every requirement is allocated and
  verified (or planned with a status).
- Push requirements to Jira / ADO (same integration as mitigation tickets);
  Jira/ADO own implementation and verification status, TARAflow reads it back.
  ReqIF / CSV export for other tools. Goals and claims stay in TARAflow (§6.6).

*Done when:* the concept is traceable end to end in the report; export works.

### Phase 6 — Alternative feasibility methods (15.7, Annex G) (small–medium, optional)

Closes G11. Attack potential is already conformant; this is for customers who
use another method.

- Attack-vector-based rating (network / adjacent / local / physical → feasibility).
- CVSS exploitability-based rating.
- Method chosen once per project (methodology record); attack trees keep the
  structure, only the leaf rating form changes.

### Phase 7 — Work products, report and readiness (medium)

Closes G12.

- Report structure for ISO projects by work product: item definition, assets,
  damage scenarios, threat scenarios, impact ratings, attack paths, feasibility,
  risk values, treatment decisions, goals, claims, (concept/requirements link).
- Coverage matrix extended with DS, CSG, CLM, CSR, ASM columns and "missing link"
  findings.
- **Readiness checker** in ISO mode: one view listing every open validator finding
  of Phases 1–5, grouped by clause and RQ.
- **Limit of the checker (shown in UI and report):** it finds missing objects,
  broken links, unrated items and rule violations. It cannot judge whether a
  damage scenario is complete, a feasibility rating justified or a treatment
  acceptable in context. "0 findings" means *structurally complete*, not
  *approved*; approval is the WP-09-05 verification by a person.
- Methodology chapter generated from the Phase 0 record.

### Phase 8 — Continual TARA (Clause 8 inputs) (small–medium)

Closes G13.

- Re-assessment triggers as data (architecture change, new vulnerability,
  regulation change, periodic review) with date and outcome. Architecture
  changes are raised automatically by the arc42 re-import of Phase 1.
- Link a vulnerability (CVE id or internal id) to the attack path / leaf it
  affects; recompute feasibility; flag affected risks for review.
- Review / sign-off record per TARA revision (who, when, what was reviewed) —
  reuses the existing audit trail and signed commits.

---

## 5. Sequencing and releases

> **Rev. 2:** the table below is from rev. 1 (base v0.13.3). 0.14.0-beta has
> shipped without Phase 0/1 and schema 9 is released, so the release and
> schema columns are to be revised (§9 K6).

| Release | Phase | Changes values? | Schema bump |
|---|---|---|---|
| 0.14 | 0 + 1 | no | yes (small: ASM objects replace assumption texts) |
| 0.15 | 2 | no (impact moves, MAX keeps the level) | **yes** |
| 0.16 | 3 | **yes** (risk values) | **yes** |
| 0.17 | 4 | no | no (additive) |
| 0.18 | 5 + 7 | no | no |
| later | 6, 8 | no | no |

Phase 3 before 4 is mandatory (acceptance criteria drive the goal/claim
validators).

**Option — pull the normative part of Phase 3 forward.** G1 and G4 are normative
gaps (RQ-15-15/16), the other gaps are not. Phase 3 can be split:

- **3a** (with 0.14): value 1–5 via the formula mapping and risk per threat
  scenario (MAX over paths), using today's impact per asset × security goal. No
  damage-scenario entity needed. Closes RQ-15-15/16 early.
- **3b** (after Phase 2): matrix option, risk per threat scenario × damage
  scenario, acceptance criteria.

3a changes values once; 3b changes them again only where 1:n damage scenarios are
used. Recommended if ISO projects are delivered before 0.16.

---

## 6. Decisions (2026-10-16)

1. **Safety scale follows the preset.** `iso-21434` → ISO 26262 severity classes
   (S0–S3) **[N]** (RQ-15-06: safety impact ratings derived from ISO 26262-3:2018,
   6.4.3; Table F.1 as mapping aid); `en-50742-a` / Machinery Regulation → ISO 12100
   terms **[D]**. The scale is
   part of the preset, not a project option; switching the preset re-labels and
   flags safety ratings for review.
2. **Damage scenarios 1:n per asset × property** (Phase 2) **[D]**. **Risk granularity [N/D]:**
   one risk per *threat scenario × damage scenario*; the risk value uses the
   highest S/F/O/P rating of that damage scenario. A separate value per impact
   category is **not** built (allowed by RQ-15-15 NOTE 1, but multiplies rows
   without changing decisions). Revisit only if a customer's method requires it.
3. **ISO treatment options** in ISO mode: Avoid / Reduce / Share / Retain **[N]**
   (RQ-15-17). `transfer` is not offered in ISO mode; existing values are shown
   as "Share (transfer)" and flagged for review **[D]**.
4. **[D] Goals are proposed automatically** from asset security goals whose threats
   are treated *Reduce*; the analyst confirms, merges or splits (confirmed =
   `manual`, never overwritten).
5. **[K] CAL is optional** (RQ-09-05 NOTE 4 "if applicable", Annex E). Project setting
   `requireCal` (default off) turns a missing CAL into a validator error for
   customers whose OEM requires it.
6. **[D] Ownership:**
   - **Goals and claims live in the TARAflow project.** They are TARA/concept
     outputs, change with the risks and must stay traceable to them.
   - **Cybersecurity requirements** are drafted in TARAflow (derived from goals)
     and **pushed to Jira / ADO**, which own implementation and verification
     status — same pattern as mitigation tickets today. TARAflow keeps the link
     and reads the status back.
   - **Wording templates:** goals and requirements in **EARS**; claims use a
     claim template (EARS is for requirements, a claim is an argument):

     | Object | Template |
     |---|---|
     | Goal (ubiquitous) | *The ⟨item⟩ shall protect the ⟨property⟩ of ⟨asset⟩ against ⟨threat scenario⟩.* |
     | Requirement – event-driven | *When ⟨trigger⟩, the ⟨component⟩ shall ⟨response⟩.* |
     | Requirement – unwanted behaviour | *If ⟨unwanted condition⟩, then the ⟨component⟩ shall ⟨response⟩.* |
     | Requirement – state-driven | *While ⟨state⟩, the ⟨component⟩ shall ⟨response⟩.* |
     | Claim | *Risk ⟨R⟩ is ⟨retained / shared with ⟨party⟩⟩ because ⟨rationale⟩, provided ⟨ASM-…⟩; review by ⟨date⟩.* |

7. **[D] Damage scenarios use a structured sentence, not EARS** (Phase 2): behaviour,
   harm, affected party as fields; the sentence is rendered.

Added in rev. 2 (2026-10-24):

8. **[D] Item Definition is preset-independent** (Phase 1, sub-tab "Definition"). Sub-tab
   "Definition" in the Overview tab for every project; the project description
   becomes the section *Purpose and functions*. Presets only make sections
   mandatory.
9. **[D] Risk granularity per §6.2 confirmed.** One risk per *threat scenario ×
   damage scenario*; no treatment per impact category. The draft
   `doc/Open/Risk/risk-treatment-per-category-design.md` (rev. 1, option A
   `categoryDecisions`) is superseded by this decision. The display of the risk
   per impact category (15.8 NOTE 1, v0.13) stays as information.
10. **[D] Risk value 1–5 only for `iso-21434`.** Other presets keep their risk
    scale and matrix; no shared code path changes their values.

---

## 7. Definition of done — "ISO/SAE 21434 work-product complete"

An `iso-21434` project in TARAflow:

1. has a structured item definition with assumptions (9.3);
2. has damage scenarios per asset × property, 1:n, with S/F/O/P impact on the
   documented scale (15.3, 15.5);
3. links every relevant threat scenario to its damage scenarios (15.4);
4. rates feasibility per attack path with a documented method (15.6, 15.7);
5. determines risk values 1–5 per threat scenario with a documented matrix or
   formula (15.8, RQ-15-15/16);
6. records a treatment per risk under documented acceptance criteria (15.9);
7. derives a cybersecurity goal for every *reduce* and a claim for every
   *retain/share* (9.4, RQ-09-05/06), records their verification (WP-09-05), and
   traces goals to requirements and verifications (9.5);
8. produces a report structured by work product, with methodology, calc stamps
   and a coverage matrix without open findings;
9. records re-assessments and reviews over the lifecycle.

Still required from the organisation: process evidence for Clauses 5–7 and 10–14
and the cybersecurity case argument. TARAflow supplies the TARA and concept
evidence for it.

## 8. Acceptance tests

Every phase additionally passes the principle-6 test: projects under every
other preset (`standard`, `en-50742-a`, `en-50742-b`, `etsi-tvra`) compute and
display the same values as before.

Each phase is done when its tests pass in addition to the existing suite. Tests
are written against behaviour, not against the report text.

| Phase | Test |
|---|---|
| 0 | An ISO project shows Avoid/Reduce/Share/Retain; a stored `transfer` shows as "Share (transfer)" with a review flag; the default mode shows the old labels unchanged. |
| 0 | Every computed risk and feasibility carries `{method, calcVersion, mappingVersion}`; recomputing with the same inputs yields a byte-identical result. |
| 1 | An ISO project without item definition, or with a boundary interface missing from it, produces a finding. |
| 1 | An external system named in the boundary section without matching external entity / interface in the DFD produces a finding. |
| 1 | Importing an arc42 AsciiDoc and a Markdown document (German and English headings) pre-fills boundary, functions, architecture and environment; pre-filled sections count as unfilled until reviewed. |
| 1 | Re-importing an arc42 document with one changed section marks only that section as changed and creates one re-assessment trigger; no TARA object changes. |
| 1 | Migration: existing trust-boundary `securityAssumptions` texts become ASM objects linked from the boundary; the text is unchanged. |
| 1 | The General tab switches between Project / Definition / Methodology / Sources; each view's badge equals its number of open findings; the Methodology view shows the risk method read-only and links to the Risk configuration dialog. |
| 1 | An assumption referenced by a trust boundary and a claim is one object; editing it changes both views. |
| 2 | Migration: a v0.13 file with `consequence` + `impactRatings` opens, saves and reopens with one damage scenario per goal, identical text and ratings, unchanged goal level. |
| 2 | Two damage scenarios on the same asset × property are rated independently; the goal level is the MAX. |
| 2 | A relevant threat without a damage-scenario link, and a damage scenario reached by no threat (without reason), each produce a finding. |
| 2 | Switching the preset ISO ↔ EN 50742 relabels the safety scale and flags every safety rating for review; no value changes silently. |
| 3 | Every ISO risk value is an integer 1–5 (RQ-15-16); impact × feasibility at both extremes gives 1 and 5 with the default matrix. |
| 3 | A threat scenario with three attack paths has one feasibility (MAX) and one risk per linked damage scenario; the per-path values stay visible as drill-down. |
| 3 | Changing the matrix (or the formula table) flags every risk whose value changed as *decision to review* and changes **no** treatment, MoSCoW priority or justification. |
| 4 | A risk treated *Reduce* without a goal, *Retain/Share* without a claim, *Avoid* without justification — each produces a finding. |
| 4 | A confirmed (manual) goal survives regeneration and re-suggestion unchanged; a changed suggestion is shown as stale, not applied. |
| 4 | With `requireCal` off a goal without CAL is valid; with it on, it is a finding. |
| 4 | A claim whose `reviewBy` date has passed produces a finding. |
| 5 | A goal without requirement, a requirement without allocation or without verification — each produces a finding. |
| 5 | Pushing a requirement to Jira/ADO creates one ticket; re-pushing updates it; the ticket status read back appears in the coverage matrix. |
| 7 | The exported report contains WP-09-01 … 09-05 and WP-15-01 … 15-08 as sections, with the same IDs as in the project; the coverage matrix lists every open finding of the readiness checker. |
| 7 | The readiness view and the report both state the checker's limit (structural completeness ≠ approval). |
| 8 | Linking a vulnerability to an attack-tree leaf recomputes feasibility and flags the affected risks; nothing else changes. |

---

## 9. Open clarifications (rev. 2, 2026-10-24)

Discussed one by one before implementation; answers move into §6.

| # | Topic | State |
|---|---|---|
| K1 | Item Definition preset-independent, description → *Purpose and functions* | decided (decision 8) |
| K1b | arc42 import and drift detection: scope and stage | open |
| K2 | Assumptions as ASM objects instead of trust-boundary text (all presets, schema 10) | open |
| K3 | Link to ISO 26262 (HARA, hazards, safety goals) and extension of the Hazard Items; S0–S3 as view on the canonical 5-level scale | open |
| K4 | Risk granularity | decided (decision 9) |
| K5 | Effect on other methods | decided (decision 10, principle 6) |
| K6 | Releases (0.14.x-beta), schema 10, old support design → `doc/Done` | open |

---

© Jürgen Messerer · 2026. Normative content derives from ISO/SAE 21434:2021;
authoritative wording is the standard.
