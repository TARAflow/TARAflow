# TARAflow — ISO/SAE 21434 Conformance: Implementation Plan

> **Status:** Rev. 2, decisions of §6 taken, §9 decided ·
> 2026-10-24 · base: v0.14.0-beta (rev. 1: 2026-10-16, v0.13.3-alpha)
> **Supersedes:** `doc/Done/RegulationCompliance/iso-21434-support-design.md`
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

1. **Additive where possible.** Most steps only add data; existing projects
   open unchanged. Steps that move data or recompute values (3a, 2, 3b — see §5)
   need a schema bump and a migration; 3a and 3b also a "decisions to review"
   list.
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

### Phase 0 — Terminology and method baseline (small; schema fence 10 with the calc stamp)

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
- **Methodology record — derived, not stored (decision 16).**
  `buildMethodologyRecord(project)` in the app layer (`src/app/services/`),
  because it reads the assets, risks and attack-tree configuration and features
  must not depend on each other. Sources:

  | Item | Source |
  |---|---|
  | `normativeBasis` | regulation preset |
  | impact scale and labels | `assets.configuration.impactScale` |
  | feasibility method | `risks.configuration.likelihoodMethod` |
  | impact aggregation | `risks.configuration.impactAggregation` |
  | attack-tree gate rules per kind of rating (attack potential AND = sum / OR = min; probability AND = product / OR = union; ordinal level AND = min / OR = max) | `FEASIBILITY_GATE_RULES`, exported and applied by the attack-tree calculator |
  | Avoid/Retain ↔ eliminate/accept | ISO treatment vocabulary (0a, `risk-treatment-vocabulary.ts`) |
  | cybersecurity properties (CIANAAA) | the threat generator's set (`CIANAAA_TO_STRIDE`); explained, not mapped (decision 18) |
  | risk matrix / formula, acceptance criteria | stored from 3a / 3b on |

  Fixed rules are never duplicated as text: the report can only describe the
  rule the calculator applies. 0b stores nothing (no schema fence); the fence
  10 of Phase 0 comes with the calculation stamp (0c).
- **Scale lock in the ISO preset [N]** — the three scales are fixed by the
  standard and must not follow the project's general 3/4/5-level setting:

  | Scale | ISO requirement | TARAflow today | ISO preset |
  |---|---|---|---|
  | Impact per category | RQ-15-05: severe / major / moderate / negligible (4) | `impactScale` 3/4/5-level selectable | locked to 4-level, ISO labels |
  | Attack feasibility | RQ-15-10: high / medium / low / very low (4) | `FeasibilityBandLevel`, 4 levels | unchanged |
  | Risk value | RQ-15-16: 1 … 5 | `RiskScaleType` 3/4/5-level | locked to 1–5 (Phase 3/3a) |

  Impact scale lock under `iso-21434` (decision 16) — no remapping:
  - Switching to ISO while no asset is rated (all `impactRatings[].value === 0`)
    sets the scale silently to 4-level (same pattern as `threadImpactCriteria`).
  - With rated assets the scale stays as it is and no value changes. Finding:
    "ISO requires 4 levels (RQ-15-05), N assets to re-rate", listing ratings
    outside the 4-level scale. Reason: `asset-service.updateConfiguration`
    neither remaps nor clamps (`existing ?? { value: 0 }`), so 5 → 4 leaves
    values of 5 outside the scale.
  - The asset configuration dialog locks the selector to 4-level under ISO;
    while the scale is not 4-level it only allows the switch to 4-level and
    warns first if ratings exist ("values are not converted").
  - Switching from ISO to another preset keeps the 4-level scale (no reset).
  - Other presets are unaffected.
- **Calculation stamp (decision 17)** — only under `iso-21434`:
  `CalcStamp { method, calcVersion, mappingVersion }`, type in `src/shared/models`
  (used by `features/risks` and `features/attacktree`).
  - **Two stamps.** On `PathAnalysis` (per tree, not per path —
    `AttackPathAssessment` is an analyst decision, not a calculation):
    G.6 factor tables + G.7 bands. On the ISO risk: everything the value runs
    through — G.6 tables, G.7 bands (also the `iso_*` fallback without a tree),
    feasibility → likelihood mapping, impact scale, `impactAggregation`, risk
    scale, from 3b the matrix.
  - `method`: calculation method (e.g. `iso-21434`). `calcVersion`: constant per
    calculation core, bumped by hand; a golden test per core (fixed inputs →
    expected outputs) fails with "formula changed → bump calcVersion".
    `mappingVersion`: short FNV-1a hash over `canonicalStringify` of the
    tables actually used (key order irrelevant; change detection, not
    security).
  - No timestamp in the stamp; recomputing with unchanged inputs leaves the
    file byte-identical. 0c only writes the stamp; the check on load comes with
    3a; nothing is recomputed automatically.
  - Schema 10 is global: every project gets `schemaVersion: 10` on the next
    save (one line, as with 9); the stamps only appear in ISO projects.
  - **Where (2026-10-24):** in the app layer, `commitCalcStamps(prev, next)`
    in `mergeProjectPatch` (pattern `commitHazardSafety`; `features/risks`
    stays unaware). Only when `prev` is the same project (open, load and
    project switch never stamp); only risks that are new in `prev` or whose
    computed values / `factorRatings` changed, and new or changed path
    analyses. No stamp = computed before 0c. The risk stamp also carries
    `FEASIBILITY_CALC_VERSION`.
  - **Prerequisite commit (c):** `canonicalStringify` + `TCS_VERSION` and
    `fnv1a32` move to `src/shared/utils/` (exported; `pathKey` /
    `computeNodeId` bit-identical). `app/services/tcs-serialize.ts` stays as a
    pure re-export (imported by `electron/services/audit-verify-main.ts` and
    `taraflow-verifier/taraflow-verify.ts`); the single-writer guard
    (`prepare-for-disk.single-writer.test.ts`) points to the new file. Checked
    with `build:electron-dev` (incl. `bundle:audit-main`) and the verifier
    build.
  - **`analysisDate` churn fix (d1, all presets, no value change):** the
    calculator stays pure; where a new `PathAnalysis` replaces the old one,
    `keepDateIfUnchanged(prev, next)` keeps the old `analysisDate` when the
    analysis without `analysisDate` (stamp included) is unchanged. Same for
    `tree.lastModified`: a re-parsed tree equal to the previous one apart from
    the date fields keeps the previous object (canonical comparison without
    the dates, else the comparison triggers itself). `info.lastModified`,
    bumped by every write, stays a separate point.
- **Cybersecurity properties explained (decision 18)** in the methodology
  section: the seven CIANAAA goals with their meaning. ISO/SAE 21434 3.1.20
  names C, I, A only as examples ("attributes include …"), and RQ-15-03 only
  asks for the compromised property — so the seven are properties of their own.
  No mapping onto CIA.

*Done when:* ISO projects show ISO treatment names; the report has a methodology
section built from the derived record; ISO projects use the 4-level impact
scale or carry the finding; every ISO risk and ISO path analysis carries a
calc stamp. Tests: label
mapping, record = configuration, scale lock, stamp present, default mode
unchanged.

### Phase 1 — Item Definition in the General tab (9.3) (medium, additive)

Closes G8; provides the assumptions used by claims in Phase 4.

**Rev. 2 (decision 8):** the Item Definition is a **preset-independent
feature**, not an ISO add-on. It lives in a sub-tab **"Definition"** of the
Overview tab, for every project. The current project description
(`GeneralTabData.info.description`) is shown as the section *Purpose and
functions* (stored in `info.description`, no migration). The preset only decides which sections
are mandatory (validator findings): `iso-21434` → RQ-09-01/02,
`en-50742-a`/`en-50742-b`/`etsi-tvra` → open, `standard` → none. IEC 62443-4-1
(SRM-2/3) has no preset today; the rule applies once one exists. arc42 in
three stages (decision 11), assumptions additive (decision 12).

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

  **Additive, no migration (decision 12).** Assumptions are listed in the
  Definition sub-tab, for every preset. A trust boundary gets
  `assumptionIds: string[]` in addition to its free text
  `securityAssumptions`, which stays as it is. A button *Convert to assumption*
  creates an ASM object from the text and links it; nothing is converted
  automatically. An assumption set to `invalid` flags every boundary and (from
  Phase 4) every claim that references it.

- **arc42 as source, not copy [D].** Each section records its `SourceRef`; the
  text is the analyst's summary or an excerpt. The arc42 document stays the
  master for the architecture description.
- **arc42 in three stages [D] (decision 11):**
  - **Stage A (Phase 1):** sections filled by hand, `SourceRef` as reference
    (document, section, version). No import.
  - **Stage B (right after Phase 1):** import of a *local* arc42 file, see next
    bullet; re-import compares the section hashes.
  - **Stage C (with Phase 8):** drift from the repository itself. Today's drift
    check only sees that the bound commit SHA moved (`git ls-remote`); reading
    a file at a commit needs a new IPC (auth, network consent, security
    review).
- **arc42 import [D] (stage B).** The arc42 template headings are standardised, so an
  import of an AsciiDoc or Markdown arc42 document (German and English
  headings; also split chapter files joined with `include::`) pre-fills the
  sections: §1 → functions, §3 → boundary,
  §5 → architecture, §7 → environment, §2 → constraints/assumption candidates.
  The analyst reviews each pre-filled section before it counts as filled.
  Import stores `contentHash` per section.
- **No double modelling [D].** Boundary and architecture reference the DFD;
  they do not redraw it. Validator: every interface on the item boundary in the
  DFD is mentioned in the boundary section, and every external system named
  there exists as external entity or interface — mismatches are findings both
  ways.
- **Reuse the existing source bindings [D] (stage C).** When the arc42 document lives in a
  repository (docs-as-code), the `SourceRef` points to an existing
  `SourceBinding` plus the file path. The binding's pinned commit and its drift
  check (`source-binding-drift.ts`) then tell when the documentation moved on —
  no second versioning mechanism. For documents outside a repository the
  `version` field and the content hash are used.
- **Change detection → re-assessment [D]** (stage B for re-import, stage C
  for binding drift; the trigger as data is Phase 8): binding drift or a
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
| **Methodology** | preset, locked scales, risk method and acceptance criteria (read-only summary), cybersecurity properties (CIANAAA) explained, `requireCal` | `ProjectSettings` + Phase 0 record |
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

*Done when:* the General tab has the four sub-tabs; the Definition sub-tab
produces WP-09-01 as a report chapter with source references; assumptions are
referenceable objects. Stage B is done when an arc42 re-import with a changed
section marks that section as changed.

### Phase 1H — ISO 26262 fields and HARA import (prerequisite of Phase 2)

**Split (decision 19):** **1H-S** [N] — RQ-15-06: under `iso-21434` the
person-harm severity on the `endangers` edge is shown and rated as S0–S3
(point 1 and the S0 rule of point 3 below, incl. the four code changes and the
hazard-table rank), small, in the normative minimum. **1H-HARA** [D] — the
further Hazard Item fields (`hazardousEvent`, E, C, ASIL, `safetyGoalRef`) and
the HARA import profile (points 2, 4, 5), deferred. Without a HARA the analyst
rates S directly by Table F.1.

Decision 13. Additive; the ISO 26262 fields are shown only under `iso-21434`,
the edge value `"none"` (S0) exists in every preset. Normative basis [N]:
**RQ-15-06** (15.5.2) — safety impact ratings are derived from ISO 26262-3:2018,
6.4.3 (severity classification of the HARA); Table F.1 maps S0–S3 onto
negligible / moderate / major / severe; the footnote of Table F.1 allows
exposure and controllability "if a rationale is provided"; 15.5.2 NOTE 6 lets
the functional-safety evaluation be reused. 5.4.1 EXAMPLE 3 (requirement on
communication between disciplines, **RQ-05-05**) names the exchange threat scenarios ↔ hazards and
cybersecurity goals ↔ safety goals. ISO 21434 does **not** require an ISO 26262
analysis first; without a HARA the analyst rates S directly by Table F.1.

Same pattern as ISO 12100 → EN 50742: the safety analysis supplies the
severity, the security analysis uses it. Unlike EN 50742 there is no SRSL
table; S only enters the impact.

**Not part of this plan:** the Hazard Item as the single safety source. The
safety source stays as today — worst-of over annotation and Hazard Item plus
the double-modelling warning. The strict separation per asset stays an open
point of `doc/taraflow-safety-model.md` §11 (point 1), as does the duplicate
`physicalHazardPotential` (point 3). No step of this plan changes safety values
in any preset.

1. **Severity stays on the `endangers` edge** (`shared/models/hazard-impact.ts`),
   as today — no UI change, no change of the edge model. Under `iso-21434`
   S0–S3 is only the display of that edge value (mapping in
   `safety-types.ts`). There is **no** separate S field on the Hazard Item, so
   there is one severity, not two.
2. **New optional fields on the Hazard Item** (shown under `iso-21434`):
   `hazardousEvent` (operational situation), `exposure` E0–E4,
   `controllability` C0–C3, `asil`, `safetyGoalRef` (id/text of the safety
   team's goal). `externalRef` keeps the HARA id. `asil` is imported or derived
   from the edge S + E + C — never a third, independent severity source.
3. **S0 is a rating on the edge** (decision 13 C): the hazard endangers the
   person, the analyst rates the severity S0 (no injuries → negligible by
   Table F.1). `HumanHarmSeverity` widens from `SafetySeverity` to
   `SafetyImpact` (adds `"none"`); under `iso-21434` `"none"` shows as S0. The
   comment "an edge implies harm" in `hazard-impact.ts` is adjusted. *Not
   rated* = no `endangers` edge to a person → finding "not rated". The value
   `"none"` is preset-independent, additive and changes no value. Required code
   changes so that principle 6 holds:
   - `build-asset-hazard-links.ts`: `link.severity` keeps the raw edge value
     (incl. `"none"`) for display and the *rated* status; the aggregation
     (pass 1 `hazardWorstSeverity`, `worstSeverity`, hence `causeSeverity`)
     goes through `humanSeverity()` with `"none"` → `undefined`;
     `isHazardTarget` is set only when the aggregated person severity, or the
     severity of a non-person edge, is defined — a pure `"none"` edge does
     not set it. Otherwise the asset would become safety-relevant
     (`hasSafetyData`, `hasSafetySignal` in `stride-modifier.ts`), the
     validator in `asset-validator.ts` would fire, and via `causeSeverity`
     `commit-hazard-safety.ts` would write `physicalImpact = "none"` with
     source `hazard`.
   - `build-asset-data-reference.ts`: the cast of `worstSeverity` to
     `SafetySeverity` stays valid because `"none"` no longer reaches it.
   - `hazard-table.tsx`: start value `worstRank = -1`; `severityRank()`
     handles `"none"` explicitly (→ 0), only for person edges — unknown values
     on environment / infrastructure edges stay below the display;
     `_worstRank` defaults to −1 so *not rated* sorts below S0.
   - i18n `tabs.hazards.severity.none` (en, de); under `iso-21434` "S0".
4. **Import:** S0 → edge `"none"`, S1 → `reversible_major`, S2 →
   `irreversible_major`, S3 → `fatal`, no S → no edge.
5. **HARA import** as a new import profile of the existing hazard importer
   (`features/hazards/services/importer/csv-importer.ts`, `xlsx-ods-importer.ts`,
   `apply-import-profile.ts`).
6. Used by Phase 2 (`DamageScenario.hazardRefs` → S = MAX over the linked
   hazards' edge severities, analyst override with rationale) and Phase 4
   (safety goal ↔ cybersecurity goal link).

*Done when:* an ISO project shows and imports S/E/C/ASIL; S0 is imported as an
edge `"none"`; projects under every other preset show and compute as before.

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
  classes for `iso-21434`, ISO 12100 for `en-50742-a` — both as views on the
  canonical scale; S comes from the linked Hazard Items (Phase 1H).
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
- **Stamp check (from 0c):** a risk whose calculation stamp differs from the
  current one (or has none) is recomputed in memory first; only a real value
  difference puts it on the *decision to review* list. Reason: 0c restamps
  only when a value changed, so a configuration change that leaves a value
  equal keeps the old stamp — without the recomputation that would be a false
  alarm.
- Risk tab grouping in ISO mode: by threat scenario, paths nested.

*Done when:* WP-15-06 (feasibility) and WP-15-07 (risk values) are produced per
threat scenario with values 1–5; existing projects migrate with a review list.

**Risk:** the only phase that changes numbers in existing ISO projects. Release
it alone, with a clear release note.

#### 3a as decided (decision 20, 2026-10-24)

Supersedes the 3a parts above where they differ (formula mapping of `I × L`,
review list by value class).

- **E1 — Matrix H.8, inputs as levels.** Fixed default matrix (Annex H, Table
  H.8, informative example, labelled so in the methodology chapter; editable
  from 3b on):

  | Impact \ Feasibility | Very low | Low | Medium | High |
  |---|---|---|---|---|
  | Severe | 2 | 3 | 4 | 5 |
  | Major | 1 | 2 | 3 | 4 |
  | Moderate | 1 | 2 | 2 | 3 |
  | Negligible | 1 | 1 | 1 | 1 |

  - Impact level: the highest S/F/O/P rating of the damage scenario
    (asset × property — before Phase 2) on the ISO 4-level scale, read through
    the resolver (`asset-impact-resolver.ts`: security-goal override before
    asset), not `overallImpact`, and independent of `impactAggregation`.
  - Safety via Table F.1 onto the four ISO levels — fixed constant with test:
    `none` → negligible (S0), `reversible_*` → moderate (S1),
    `irreversible_*` → major (S2), `fatal` → severe (S3).
  - Feasibility as `FeasibilityLevel` (tree path level, G.7; else the `iso_*`
    fallback), never via `levelToRiskScale`.
  - Checked against the standard: H.8 as above (extremes 1 and 5). The formula
    of H.10 (R = 1 + I × F, I and F ∈ {0, 1, 1.5, 2}) does **not** match H.8 in
    every cell (Severe × Very low: formula 1, matrix 2; rounding of 2.5 open) —
    not used in 3a.
- **E2 — Threat scenario:** an attack tree anchored at asset × property; a
  threat-anchored tree belongs to its threat; a STRIDE threat without a tree is
  a scenario of its own (`iso_*` fallback).
- **E3 — Value per path, scenario derived, treatment per path.** Every ISO risk
  (per path) stores `isoRiskValue` 1–5. The scenario value is derived: MAX
  feasibility over its paths (15.8 NOTE 2) with the scenario's impact; its
  residual is the MAX of the residual values of its paths. The scenario's
  treatment options are the union of its paths' options (15.9 "one or more").
  No scenario object of its own. Register heatmap, sorting and filters use
  `isoRiskValue` and the 4 × 4 matrix under ISO.
- **E4 — Display:** under `iso-21434` 1–5 is the risk value in register,
  dialog and report (incl. the traceability matrix); `I × L` is not shown.
  Other presets unchanged.
- **E5 — Migration and review list.** `isoRiskValue` is stored. The migration
  computes it for every ISO risk, changes no treatment and **stamps** the
  recomputed risks — a deliberate exception to "loading never stamps" (0c):
  the value was just computed with the current configuration. Review list:
  *Retain* at value ≥ 4 (warning), *Reduce* at value 1 (info). *Avoid* and
  *Share* never (Avoid is the strongest treatment; sharing with the OEM /
  integrator is often legitimate). Hard rules come with the acceptance
  criteria of 3b.
- **Implementation details (decision 22, 2026-10-24):**
  - **Where:** app layer, `commitIsoRiskValues(prev, next)` in
    `mergeProjectPatch`, order `commitHazardSafety` → `commitIsoRiskValues` →
    `commitCalcStamps`. Runs only under `iso-21434`, only when `prev` is the
    same project (never on open), and only when risks, assets, attack trees,
    hazards or the asset / risk / feasibility configuration changed. Stored per
    risk: `isoRisk { impact, feasibility, value, residual? }` (inputs kept so
    dialog and report can explain the value). A change of `isoRisk` counts as a
    recomputation for the stamp. Migration 9 → 10 calls the same function.
  - **Safety level (Table F.1):** if the asset (or the goal) has a categorical
    severity (`physicalImpact`), F.1: `none` → negligible, `reversible_*` →
    moderate, `irreversible_*` → major, `fatal` → severe. Otherwise the numeric
    safety rating (the Se factor of `safetySeverityToFactor`): 1, 2 → moderate,
    3 → major, 4 → severe — conservative, because 4 is irreversible_major *or*
    fatal — plus a finding "safety 4 ambiguous, rate it categorically"; 0 = not
    rated (not negligible). A security-goal override of safety exists only as a
    number and uses the same numeric rule, so "override before asset" (E1)
    holds for safety too. Headlamp: DA-001 (fatal) severe, DA-002 (3) major,
    DA-003 (2) and FU-001 (1) moderate.
  - **Methodology chapter:** the safety number is the Se factor (1 = reversible
    minor = *moderate*), while 1 in the other ISO categories is *negligible* —
    same number, different meaning, stated explicitly.
  - **Safety names normalised in 9 → 10:** only the name part of
    `normalize-safety-severity.ts` (annotations, `endangers` edges,
    `physicalImpact` / `safetyImpact`) runs again — it is idempotent. The rating
    step "safety rating 3 → 4" (old Se3 = irreversible injury) is **not**
    idempotent and stays in 8 → 9 only; repeating it would raise every v9
    safety rating 3 (irreversible_minor) to 4. This closes the open beta point
    "normalise v9 files" (e.g. `fatality` in Headlamp and on the SmokeDetector
    edges). The F.1 table reads canonical names only; a test shows that no old
    name survives the migration and that a v9 rating 3 stays 3.
  - **Residual per path:** residual feasibility from the ratings after
    mitigation — the residual `attack_tree_likelihood` translated back with
    the runtime Mapping B (`feasibilityLevelToRiskScale`, decision 21; not the
    stored snapshot), ambiguous on a 3-level scale (1/1/2/3) → the higher
    level; or the mitigated `iso_*` factors. Residual impact = the scenario
    impact. Nothing rated after mitigation → no residual value.
  - **Patches:** 3a-1 core (H.8, F.1, `commitIsoRiskValues`, migration incl.
    name normalisation, golden tests), 3a-2 display (register column /
    heatmap / sort / filter, dialog, report, `I × L` hidden under ISO), 3a-3
    scenario view (grouping, scenario value and residual, review list as
    banner + filter). Released only after 3a-3, as 0.15.0-beta.
- **Tests:** golden test from the Annex H inputs (all 16 cells of H.8, the two
  cases of H.9: High × Severe → 5, Low × Moderate → 2); a Headlamp test with
  the values today's example data give (the example deviates from Annex H: the
  spoofing scenario is rated *medium* via attack potential, Annex H rates it
  *high* attack-vector based; the DoS scenario is *high*, Annex H *low*).

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
  - acceptance criteria from Phase 3b respected — only once 3b exists; the
    norm has no risk acceptance criteria ([K]), so the minimal Phase 4 runs
    without them (decision 19);
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

Rev. 2 (decision 14). Base: v0.14.0-beta, schema 9. Work happens on the
feature branch `feature/iso21434-conformance`; each step is merged/released on
its own. Steps that only add data are the next beta patch; steps that migrate
data or change values get their own minor version and a release note.

**Schema (decision 15, K7):** every release that stores new fields bumps the
schema — one number per release, not per step. For a purely additive release
the step is a *version fence, no data change* (marked so in the
`schema-version.ts` history), like schema 9. Reason: an older release refuses a
newer file only through the version (`applyMigrations` throws on
`schemaVersion > CURRENT_SCHEMA_VERSION`), and without a bump it would open the
file and can drop the new fields on save (e.g. `buildGeneralTabPatch` replaces
`info` / `settings` as a whole). Accepted drawback: a file of 0.15.1 does not
open in 0.15.0. The numbers below assume one release per row and shift if rows
are combined.

**Rev. 3 (decision 19, 2026-10-24): normative minimum first.** The steps
are ordered by what ISO/SAE 21434 requires [N]; design decisions [D] and
configurable methodology [K] follow after the minimum. Releases and schema
numbers follow decision 15 (one fence per release that stores new fields;
migrations and value changes get their own minor beta); numbers below assume
one release per row.

**Normative minimum [N]**

| Order | Step | Norm | Release | Changes values? | Schema |
|---|---|---|---|---|---|
| done | 0a — ISO treatment names | RQ-15-17 | **0.15.0-beta** | no | – |
| done | 0b — ISO impact scale lock (4 levels), methodology record | RQ-15-05 | **0.15.0-beta** | no | – |
| done | 0c — calculation stamp ([D], already built) | – | **0.15.0-beta** | no | **10** (shared with the fix and 3a) |
| done | 0d — methodology chapter | – (documents the method) | **0.15.0-beta** | no | – |
| 0 | Fix `levelToRiskScale` — mapping derived from the risk scale (decision 21) | – (bug) | **0.15.0-beta** | **yes** (all presets with attack trees on a 3- or 4-level scale) | **10** |
| 1 | 3a — risk value 1–5, risk per threat scenario | RQ-15-15/16 | **0.15.0-beta** | **yes** (ISO risks only) | **10** (migration) |
| 2 | 1H-S — S0–S3 on the person edge under ISO | RQ-15-06 | 0.15.x-beta | no | 11 (fence: `"none"` on the edge) |
| 3 | Phase 1 stage A — Definition sub-tab, assumptions (ASM) | RQ-09-01/02 | 0.15.x-beta | no | 12 (fence) |
| 4 | Phase 4 minimal — goal for every Reduce, claim for Retain/Share, Avoid justification, verification record | RQ-09-05/06, WP-09-05 | 0.15.x-beta | no | 13 (fence) |

Assumptions (stage A) come before Phase 4 because claims refer to them; the
norm itself only requires the claim (RQ-09-06).

**0.15.0-beta = Phase 0 + fix + 3a, schema 10 (decisions 20, 21).** Schema 10 is
on the feature branch only, never released, so migration 9 → 10 takes all
three: the version fence of 0c, the correction of the stored
`attack_tree_likelihood` / `I × L` values (fix) and `isoRiskValue` (3a). One
release note explains both value changes. Consequence: none of the three may be
released before the others — otherwise the next one needs its own number.
Local test files saved as schema 10 by a branch build are not migrated again;
discard them or set them back to `schemaVersion: 9` before the release.

**After the minimum [D]/[K]**

| Order | Step | Release | Changes values? | Schema |
|---|---|---|---|---|
| 5 | Phase 2 — damage scenarios 1:n | **0.16.0-beta** | no (impact moves, MAX keeps the level) | **14** (migration) |
| 6 | Phase 3b — matrix option, risk per threat × damage scenario, acceptance criteria [K] | **0.17.0-beta** | **yes** where 1:n damage scenarios exist | **15** (migration) |
| 7 | 1H-HARA — E, C, ASIL, hazardous event, safety goal ref, HARA import | x-beta | no | fence |
| 8 | Phase 1 stage B — arc42 import | x-beta | no | fence |
| 9 | Phases 5 + 7 — concept traceability, report by work product, readiness check | x-beta | no | fence |
| later | Phases 6, 8 (stage C of arc42 with 8) | x-beta | no | fence if new fields are stored |

**Why 3a first:** an ISO project (APS) is running in TARAflow under
`iso-21434`; RQ-15-15/16 are the normative gaps an assessor stops at
immediately. 3a: value 1–5 via the formula mapping and risk per threat
scenario (MAX over paths), using today's impact per asset × security goal; no
damage-scenario entity needed. 3b (after Phase 2): matrix option, risk per
threat scenario × damage scenario, acceptance criteria. 3a changes ISO values
once; 3b changes them again only where 1:n damage scenarios are used. Both
produce the *decision to review* list and never change a treatment. The stamp
check of 3a (recompute in memory on a stamp mismatch) is a convenience, not a
requirement: TCS and the signed commits already freeze the values.

**3b is no longer a prerequisite of Phase 4** (decision 19): the norm defines
no risk acceptance criteria; the minimal Phase 4 validators (Reduce → goal,
Retain/Share → claim, Avoid → justification) do not need them. Acceptance
criteria join the validators once 3b exists.

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

8. **[D] Item Definition is preset-independent** (Phase 1). Sub-tab
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
11. **[D] arc42 in three stages:** A manual sections with source reference
    (Phase 1), B import of a local file with section hashes (right after
    Phase 1), C drift from the repository (with Phase 8).
12. **[D] Assumptions additive:** ASM objects plus `assumptionIds` on the trust
    boundary; the free text stays; conversion only on request. No migration
    (schema fence only, decision 15).
13. **[D] ISO 26262 link via Hazard Items (Phase 1H, rev. 2026-10-24):**
    A. The safety source stays as today (worst-of plus warning); the Hazard
    Item as single safety source is not part of this plan (open point in
    `taraflow-safety-model.md` §11). B. Only the ISO 26262 fields (hazardous
    event, S/E/C, ASIL, safety goal ref; `externalRef` = HARA id), a HARA
    import profile of the existing hazard importer and S0–S3 as a view on the
    canonical scale — ISO only, additive, prerequisite of Phase 2.
    C (replaced 2026-10-24): S0 is a rating on the existing `endangers`
    edge — `HumanHarmSeverity` gains `"none"`, shown as S0 under
    `iso-21434`; no marker on the Hazard Item and no separate S field. *Not
    rated* = no person edge → finding. A `"none"` edge feeds no safety
    aggregation and does not set `isHazardTarget` (Phase 1H point 3).
14. **[D] Order and releases (§5):** 0 → 3a → 1 → 1 stage B → 1H → 2 → 3b → 4 →
    5+7 → 6, 8, on the branch `feature/iso21434-conformance`. 3a is pulled
    forward because the APS project runs under `iso-21434`. Migrations (3a,
    2, 3b) and value changes get their own minor beta; additive releases stay
    a beta patch even though they bump the schema (decision 15). The superseded support design moved to `doc/Done`, the old
    `taraflow-iso21434-todo.md` checklist to `doc/Old`.
15. **[D] Schema fence per release (K7, 2026-10-24):** every release that
    stores new fields bumps the schema, one number per release; purely
    additive bumps are marked "version fence, no data change" in
    `schema-version.ts`. A file of a newer beta does not open in an older one.
16. **[D] Phase 0b (2026-10-24):** the methodology record is derived
    (`buildMethodologyRecord` in the app layer), fixed rules come from
    exported constants, nothing is stored in 0b. The ISO impact scale lock
    does not remap: silent 4-level only while nothing is rated, otherwise a
    finding incl. ratings outside the scale; the dialog warns before the
    switch; leaving ISO keeps 4-level.
17. **[D] Phase 0c calculation stamp (2026-10-24):** ISO only; type in
    shared; two stamps (path analysis per tree: G.6 + G.7; risk: everything
    the value runs through); `calcVersion` by hand + golden test,
    `mappingVersion` = FNV-1a over `canonicalStringify`; no timestamp, no
    churn; check on load with 3a. Hash helpers move to `src/shared/utils/`
    in a separate commit first; `analysisDate` kept when the analysis is
    unchanged (d1, all presets).
18. **[D] No CIANAAA → CIA mapping (2026-10-24):** ISO/SAE 21434 3.1.20
    lists C, I, A only as examples of cybersecurity properties; RQ-15-03 asks
    only for the compromised property. The seven CIANAAA goals are used as
    properties of their own and explained in the methodology chapter (meaning
    of each). The mapping constant of 0b is removed again with 0d.
19. **[D] Normative minimum first (2026-10-24):** §5 is ordered by what the
    norm requires: 3a (RQ-15-15/16) → 1H-S (RQ-15-06, S0–S3 under ISO) →
    Phase 1 stage A with assumptions (RQ-09-01/02) → Phase 4 minimal
    (RQ-09-05/06, WP-09-05). Then Phase 2, 3b, 1H-HARA, arc42 stage B,
    Phases 5 + 7, later 6 and 8. 1H is split into 1H-S [N] and 1H-HARA [D].
    3b is no longer a prerequisite of Phase 4 (acceptance criteria are [K]).
    0c stays as built; it is not required by the norm.
20. **[D] 3a (2026-10-24):** E1 matrix H.8 with level inputs (impact through
    the resolver, safety via Table F.1, feasibility as `FeasibilityLevel`);
    E2 threat scenario = tree / threat; E3 `isoRiskValue` per path, scenario
    value and residual derived (MAX), treatment per path, register views on
    1–5; E4 1–5 replaces `I × L` under ISO; E5 stored, migrated and stamped
    (exception to 0c's load rule), narrow review list (Retain ≥ 4, Reduce = 1).
    Golden test from the Annex H inputs; H.10 not used.
21. **[D] Fix `levelToRiskScale` (2026-10-24):** the feasibility → risk scale
    mapping (Mapping B) is derived at runtime from `RiskScaleType`: 3 levels
    → 1/1/2/3, 4 levels → 1/2/3/4, 5 levels → 1/2/3/5 (unchanged). The stored
    `FeasibilityConfiguration.levelToRiskScale` is ignored — no dialog ever
    wrote it, so every project carried the 5-level default `{1, 2, 3, 5}`;
    the risk dialog's fallback uses the same function. Own commit before 3a;
    the stored values are corrected in migration 9 → 10. Changes `I × L` in
    all presets with attack trees on a 3- or 4-level scale — deliberate
    exception to principle 6, release note. Shipped with 3a as 0.15.0-beta.
22. **[D] 3a implementation details (2026-10-24):** computed in the app layer
    (`commitIsoRiskValues`, after `commitHazardSafety`, before the stamps,
    same-project guard, configuration changes as triggers); safety level from
    the categorical severity via F.1, else from the Se number (4 → severe +
    finding); goal overrides use the number rule; only the idempotent name part
    of the safety normalisation repeats in 9 → 10; residual feasibility via the
    runtime Mapping B (3-level: higher level), residual impact = scenario
    impact; patches 3a-1 / 3a-2 / 3a-3, released together.
23. **[D] Words for the risk value (2026-10-24):** next to the number the
    risk value shows Minimal / Low / Medium / High / Critical (de: Minimal /
    Niedrig / Mittel / Hoch / Kritisch) — "Minimal" because RQ-15-16 calls 1
    "minimal risk", and to avoid "very low" of the attack feasibility. Display
    only: stored, filtered, sorted and reviewed is the number. Own i18n keys,
    not the labels of the TARAflow 5-level risk scale (there "Low" is 1, here
    2); the two scales stay separate — renaming the old one would change every
    preset (principle 6), and they never meet in one project. Every display
    names all three quantities where they meet ("Impact Major × feasibility
    High → risk 4 · High"; report "4 – High (Impact Major × AF High)").
    Colours of the 5-level scale, never without the number. Under
    `iso-21434` no label of the old risk scale appears: the configuration
    dialog hides rating scale, thresholds / `I × L` matrix and asset-impact
    mapping and states that the risk value comes from matrix H.8.

---

## 7. Definition of done — "ISO/SAE 21434 work-product complete"

Checked row by row in `iso-21434-rq-coverage.md` (every RQ / RC / PM and WP of
Clauses 9 and 15, Clause 8 inputs, RQ-05-05): the normative minimum is done
when every [N] row there is *met* or justified *n/a* / *external*.

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
| 0 | The methodology record equals the configuration it is derived from (preset, impact scale, likelihood method, impact aggregation); the gate rules come from the exported constant; the report explains the seven cybersecurity properties without a CIA mapping. |
| 0 | Switching to ISO without ratings → the impact scale is 4-level, silently. |
| 0 | Switching to ISO with a rated 5-level scale → scale unchanged, finding with the number of assets and the ratings outside the scale, no value changed. |
| 0 | Switching from ISO to another preset keeps the 4-level scale. |
| 0 | Every ISO risk and every ISO `PathAnalysis` carries `{method, calcVersion, mappingVersion}`; projects under other presets carry none (save diff = `schemaVersion` only). |
| 0 | Analysing twice with unchanged inputs leaves `attackTrees` and `risks` byte-identical (`info.lastModified` excluded, separate point); a changed input gives a new `analysisDate`. |
| 0 | Opening and saving a project writes no stamp — except migration 9 → 10, which stamps the ISO risks it gives an `isoRisk` (3a, E5); a project without computable ISO values changes no byte except `schemaVersion`; changing one risk stamps only that risk. |
| 0 | Changing a G.7 band changes `mappingVersion` of the path and of the risk stamp; changing `impactAggregation` changes only the risk stamp. |
| 0 | Golden test per calculation core: a changed formula fails with "bump calcVersion". |
| 0 | After moving the hash helpers: `pathKey` / `computeNodeId` and the TCS output are unchanged; Electron and verifier bundles build. |
| 1 | An ISO project without item definition, or with a boundary interface missing from it, produces a finding. |
| 1 | An external system named in the boundary section without matching external entity / interface in the DFD produces a finding. |
| 1 (B) | Importing an arc42 AsciiDoc and a Markdown document (German and English headings) pre-fills boundary, functions, architecture and environment; pre-filled sections count as unfilled until reviewed. |
| 1 (B) | Re-importing an arc42 document with one changed section marks only that section as changed and creates one re-assessment trigger; no TARA object changes. |
| 1 | A project with trust-boundary `securityAssumptions` texts opens unchanged; *Convert to assumption* creates one ASM object linked from the boundary with the same text; setting it `invalid` flags the boundary. |
| 1 | The General tab switches between Project / Definition / Methodology / Sources; each view's badge equals its number of open findings; the Methodology view shows the risk method read-only and links to the Risk configuration dialog. |
| 1 | An assumption referenced by a trust boundary and a claim is one object; editing it changes both views. |
| 1H | A HARA CSV with S0 / S1 / S2 / S3 / empty imports as edge `none` / `reversible_major` / `irreversible_major` / `fatal` / no edge. |
| 1H | An asset endangered only through a `none` edge: `isHazardTarget = false`, `worstSeverity` undefined, no finding from `asset-validator.ts`, threats unchanged; the link shows `none`. |
| 1H | A cause asset of a hazard with only `none` edges keeps its `physicalImpact` and `physicalImpactSource`. |
| 1H | A Hazard Item without a person edge produces the finding "not rated". |
| 1H | Hazard table: a hazard with only a `none` edge shows "none" (under ISO "S0"); a hazard without a person edge shows "–"; sorted by severity, *not rated* is below S0. |
| 1H | Projects under every other preset show and compute the same safety values as before. |
| 2 | Migration: a file with the schema before Phase 2 (13 per §5) with `consequence` + `impactRatings` opens, saves and reopens with one damage scenario per goal, identical text and ratings, unchanged goal level. |
| 2 | Two damage scenarios on the same asset × property are rated independently; the goal level is the MAX. |
| 2 | A relevant threat without a damage-scenario link, and a damage scenario reached by no threat (without reason), each produce a finding. |
| 2 | Switching the preset ISO ↔ EN 50742 relabels the safety scale and flags every safety rating for review; no value changes silently. |
| 3 | Every ISO risk value is an integer 1–5 (RQ-15-16); impact × feasibility at both extremes gives 1 and 5 with the default matrix. |
| 3a | Golden test: all 16 cells of H.8; the H.9 cases High × Severe → 5 and Low × Moderate → 2; Headlamp gives the values of today's example data. |
| 3a | Migration 9 → 10 computes and stamps `isoRiskValue` for every ISO risk, changes no treatment; the review list holds only Retain at ≥ 4 (warning) and Reduce at 1 (info). |
| 3a | An ISO project shows no label of the `I × L` risk scale (e.g. "Very High") in UI or report; a standard project shows the old labels unchanged. Risk words are display only — filter and review list use the number. |
| 3a | Headlamp safety: DA-001 (fatal) severe, DA-002 (3) major, DA-003 (2) and FU-001 (1) moderate; an asset with safety 4 and no categorical severity gives severe plus the finding "ambiguous". |
| 3a | After migration 9 → 10 no old safety name is left (assets, annotations, `endangers` edges); a v9 safety rating 3 stays 3. |
| fix | A 4-level project with an attack tree: a *high* path gives likelihood 4, not 5; a 5-level project is unchanged; stored values are corrected by migration 9 → 10. |
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
| K1b | arc42 import and drift detection: scope and stage | decided (decision 11) |
| K2 | Assumptions as ASM objects | decided (decision 12) |
| K3 | Link to ISO 26262 and extension of the Hazard Items | decided (decision 13, Phase 1H) |
| K4 | Risk granularity | decided (decision 9) |
| K5 | Effect on other methods | decided (decision 10, principle 6) |
| K6 | Releases, schema, order, old documents | decided (decision 14, §5) |
| K7 | Schema bump for additive steps | decided (decision 15, §5): one fence per release that stores new fields |

---

## 10. Implementation status

Branch `feature/iso21434-conformance`.

| Step | Content | Patch | State |
|---|---|---|---|
| 0a | ISO treatment names (G5): `risk-treatment-vocabulary.ts` — Avoid / Reduce / Share / Retain for the `iso-21434` risk method, stored values unchanged; `transfer` not offered, a stored one shows as "Share (transfer)" with a review hint (dialog), a dashed chip (register) and a validation warning; traceability matrix uses the ISO names. Other methods unchanged (test). | 114 | done |
| 0b | Methodology record and ISO impact scale lock (decision 16): `app/services/methodology-record.ts` derives the record (preset, impact scale/criteria/aggregation, likelihood and feasibility method, treatment options, gate rules, cybersecurity properties); `FEASIBILITY_GATE_RULES` exported and applied by the attack-tree calculator (potential AND = sum / OR = min, probability product / union, ordinal min / max — the "OR = MAX / AND = MIN" of Phase 0 holds only for ordinal levels); `CIANAAA_TO_CIA` in shared, removed again with 0d (decision 18). Preset field `requiredImpactScale` (iso-21434 → 4-level); `threadImpactScale` sets it only while nothing is rated; asset findings `impactScaleRequired` / `impactOutsideScale`; config dialog offers only 4-level under ISO and warns that values are not converted. Nothing stored, no schema fence. | 118 | done |
| 0b2 | ISO labels for the 4-level impact scale (RQ-15-05): `impactScaleFor(scale, vocabulary)` gives negligible / moderate / major / severe (de: vernachlässigbar / moderat / erheblich / schwerwiegend) under `iso-21434` on the 4-level scale — asset table, asset dialog, config dialog preview, report impact labels. Display only; other scales and presets unchanged. | 119 | done |
| 0c-pre | Hash helpers to shared (decision 17, commit (c)): `canonicalStringify` + `TCS_VERSION` → `shared/utils/tcs-canonical.ts` (`app/services/tcs-serialize.ts` re-exports for Electron, verifier, scripts); `fnv1a32` / `fnv1aHex12` → `shared/utils/fnv1a.ts`, used by the path identity. pathKey / node id pinned by golden values from before the move; single-writer guard points to the new file; Electron and verifier bundles build. | 122 | done |
| 0c | Calculation stamps (decision 17): `CalcStamp` in `shared/models/calc-stamp.ts`; `Risk.calcStamp`, `PathAnalysis.calcStamp`. Written by `app/utils/commit-calc-stamps.ts` in `mergeProjectPatch` — only under `iso-21434`, only for the same project (open/load/switch never stamp), only for risks that are new or whose computed values / factor ratings changed and for new or changed path analyses. Path: `feasibility-<FEASIBILITY_CALC_VERSION>` + hash of G.6/G.7; risk: `risk-<RISK_CALC_VERSION>+feasibility-<…>` + hash of risk configuration, impact scale, feasibility configuration incl. `levelToRiskScale`, ISO tables (`ISO_RISK_CALC_TABLES`). Churn fix (all presets): unchanged re-parsed trees keep the previous object, unchanged analyses keep `analysisDate` (`keepDateIfUnchanged`). Golden tests per core. Schema 10 = version fence (`migrate_9_to_10`, reason text en/de). `info.lastModified` still bumps on every write (separate point). | 123 | done |
| 0d | Methodology chapter (`methodology`, after *Applicable Regulations*, only `iso-21434`): rendered from `buildMethodologyRecord` via `DocComputedValues.methodology` (app `doc-transform` and CLI mapper) — method overview, G.7 bands of the project, attack-tree gate rules, ISO treatment names ↔ stored values, the seven cybersecurity properties (CIANAAA) with their meaning — no mapping onto CIA (decision 18), current calculation stamps. Markdown, AsciiDoc, HTML, StrictDoc, PDF (HTML path). Record extended by the bands and the current stamps. Note: the CLI uses the project's stored chapter list without `withDefaultChapters`, so a project saved before 0d gets the chapter in the CLI only after it was opened in the app (pre-existing gap, also for the traceability matrix). | 125 | done |
| fix | `levelToRiskScale` (decision 21): Mapping B derived from the risk scale via shared `feasibilityLevelToRiskScale` (3: 1/1/2/3, 4: 1/2/3/4, 5: 1/2/3/5) in the likelihood references, the risk dialog (incl. residual options) and the risk stamp hash; the stored field is deprecated and no longer in the default. Migration 9 → 10 corrects stored `attack_tree_likelihood` (before and residual), the assessment snapshot and the recomputed values — Headlamp: R 12.5 → 10. Reason text v10 extended. | 129 | done |
| 3a-1 | Core of the ISO risk value (decisions 20, 22): `features/risks/models/iso-risk-matrix.ts` (matrix H.8, Table F.1, Se-number rule, `iso_*` fallback, reverse Mapping B); `app/utils/commit-iso-risk-values.ts` (`computeIsoRisks`, `commitIsoRiskValues` in `mergeProjectPatch` between safety and stamps) → `Risk.isoRisk { impact, feasibility, value, residual? }`; the stamp counts `isoRisk`; asset finding `safetyAmbiguous` under ISO. Migration 9 → 10: safety names only (`normalizeSafetySeverityNames`, the rating step stays in 8 → 9), the fix, `isoRisk` for every ISO risk, stamped. Headlamp fixture (`src/tests/fixtures/headlamp-iso21434.tara.json`, trimmed copy of the example) with today's values; golden H.8 (16 cells) and H.9. Display (3a-2) and scenario view (3a-3) open. | 132 | done |
| 3a-2 | Display of the ISO risk value (decision 20 E4): register columns *Impact* / *Feasibility* as levels, *Risk (1–5)* / *Residual (1–5)* with the H.8 explanation as tooltip; filter on the values 5 … 1; heat map = 4 × 4 Annex H.8 matrix (`iso-risk-matrix.tsx`, before / after); risk dialog `IsoRiskPanel` (live: iso_* fallback and residual edits, stored impact / tree feasibility); report risk tables, won't list and traceability matrix show "4 (Major × High)", header *Risk value (1–5)*; methodology chapter with the H.8 matrix and the safety-number note. The `I × L` risk per impact category (15.8 NOTE 1 display, risk-impact-aggregation phase 5 A) is no longer shown under ISO. Other methods unchanged. | 133 | done |
| 3a-3 | Threat-scenario view and review list (decision 20 E2/E3/E5): `iso-scenarios.ts` groups the attack-path risks per tree ("AT-2" for AT-2.1 …; a risk without a tree is its own scenario), scenario value and residual = MAX over the paths, options = union; the attack-tree section of the register shows one inner section per scenario with these values. Review list `isoReviewItems`: Retain at ≥ 4 (warning), Reduce at 1 (info), never Avoid / Share; banner with the risks (click opens the dialog) and the switch "only these" (register, attack-path section and won't list). Under ISO the register filters apply to the attack-path risks too (without the page filter). | 134 | done |
| 3a-w | Words for the risk value (decision 23): Minimal / Low / Medium / High / Critical (de: Minimal / Niedrig / Mittel / Hoch / Kritisch), own keys `risks.isoRiskValue.1…5`, display only. Register "4 · High" with tooltip "Impact Major × feasibility High → risk 4 · High"; heat map "4 High"; filter "4 – High"; dialog panel and sidebar; scenario header; banner; group headers count per value; row background by value. Report "4 – High (Impact Major × AF High)" in risk tables, won't list, traceability matrix and the PDF converter; risk statistics and group summaries count the values 5 … 1; executive summary "critical" = value 5. Configuration dialog under ISO: rating scale, thresholds / I × L matrix and asset-impact mapping hidden, note "risk value 1–5 from matrix H.8" — no RISK_SCALES label appears under ISO. | 136 | done |
| F1 | Regeneration preview: removed threats that were marked *not relevant* are not counted as obsolete (Headlamp: 8 physical-boundary S/R threats removed, preview said 0). Not ISO; found with the Headlamp check. | – | open, before the release |
| F2 | Risk sync sets `lastModified` on every existing risk on each run, also without a change (Headlamp: all 10). Same class as `info.lastModified`. | – | open, before the release |
| F3 | CLI report uses the project's stored chapter list without `withDefaultChapters`: a project saved before a new chapter existed gets no methodology / attack-path / traceability chapter in the CLI (Headlamp: no risk chapter at all). | – | open |

---

© Jürgen Messerer · 2026. Normative content derives from ISO/SAE 21434:2021;
authoritative wording is the standard.
