# TARAflow — roadmap to 1.0.0

**Status:** v0.4 · 2026-11-14 · v0.4: review of the order against the design documents and
the code (second instance, user 2026-11-14) — guard rails first in 0.20 (results dump,
catalogue stamp, field register + guard test, `no-feature-to-feature` with a baseline);
the ISO/SAE 21434 risk model as a release of its own (0.23), two releases before the RC;
R-10 (one risk per threat scenario, impact = MAX over its damage scenarios) with three
conditions; snapshot rule for additive fields; rating suggestions (model field purpose
phase 3) to 1.x; format boundary split into structural (until 0.23) and additive (until
0.25); fallback if 0.20 grows too large · v0.3: EN 50742 B coverage done, R-9 · v0.2:
physical / sensor-actuator threats and the field retirements together in 0.21, EN 18031
after them (user 2026-11-14) · v0.1: first cut · sources: gap analysis of all documents in
`doc/Open` and `doc/InProgress` (2026-11-14, spot-checked in code at `ad55a71d`), the 0.19
work, the user's decisions below.

This document says **which release brings what** on the way to 1.0.0. The detailed
work steps of one release stay in its release plan (`doc/Done/Release/release-0.NN-plan.md`
once released); the design of each item stays in its own design document.

---

## 1. What 1.0 promises (user 2026-11-14)

- **Stability is what customers need.** 1.0 promises stable files, stable threat results
  and stable workflows.
- **The standards are in 1.0:** EN 50742 Approach B and EN 18031 first, then EN 303 645 and
  the ISO/SAE 21434 compliance module. The licensed texts are in `Standards/` (not
  versioned); IEC 62443-3-3 is not there (R-9).
- **No further big feature after the component import (0.19.0-beta, released
  2026-11-14).** From there on: correctness, consistency, usability, performance.
- **Issue trackers:** Polarion, Redmine and Gitee come some time — not a 1.0 topic.
- **Not everything has to go into 0.20 / 0.21** — more, smaller releases are fine.

## 2. Rules for the order

1. **Anything that changes files or threat results on purpose comes before the release
   candidate.** 1.0 must not start with a breaking change.
2. **One big block per release:** one standard, or one block that changes threat results,
   or one change of the data model. A release that changes threat results says so in its
   release note (regeneration shows what changed; reconciliation keeps the analyst's data).
3. **Guard rails first (0.20).** Before anything changes results or adds fields:
   1. a dump of the threat and risk results of 0.19 on the example projects as the
      starting point (before any 0.20 change);
   2. the threat catalogue version stamp — committed **before** the first change of
      results in 0.20 (the SRSL0 guard), so the stamp does not already measure a changed
      state;
   3. the field purpose register and its guard test (model field purpose phase 1) — no
      new field without a purpose; 0.20 already adds one (the retention field of
      EN 50742 B);
   4. the depcruise rule `no-feature-to-feature` in CI with today's violations as a
      generated baseline list — no new ones from then on, the old ones are removed in the
      following releases (`utils/depcruise-doc.cjs` has rules for the generation path
      only today).
4. **Field retirements in one batch (0.21).** Each retirement of a model field carried in
   component snapshots makes users "Refresh stored state" once. The retirements of the model
   field purpose design (D2) all go into 0.21, together with the physical / sensor-actuator
   threats — the D2 fields are the asset's copies of the attack-surface context (exposure,
   physical access control, location, …) that 0.21 takes from the elements instead (user
   2026-11-14). **After 0.21 no field carried in snapshots is retired before 1.0**; a field
   found unused later stays (documented as such) until 2.0.
5. **Additive fields leave the snapshot alone** (until the RC; review 2026-11-14). The
   snapshot of a component is built after its file was migrated and repaired
   (`component-source.ts`) and contains its elements, threats, assets and goals — so a new
   field can change the content hash of every imported component, and "Refresh stored
   state" would come back with every release:
   - new fields are **optional**; "not present" means the default, and a default is
     **never written** on save;
   - **no migration or repair step writes defaults** into the parts of a component that
     go into the snapshot; a migration that adds a new object (e.g. damage scenarios in
     0.23) adds it next to the existing data and leaves that data unchanged;
   - a test proves it: a component TARA saved with 0.21 gives the same content hash with
     the current version **when loaded** and **after saving it again**. It complements the
     hash test of 0.23 (damage scenarios not in the snapshot).
6. **Format boundary.** Structural changes of the file (new objects, changed keys or
   granularity) end with **0.23** (the ISO risk model). Additive optional fields under
   rule 5 are possible until **0.25**. Until the RC the version rule stays as it is:
   **a schema bump raises the minor version** (README); the 1.x rule (R-8) applies from
   1.0.
7. **Feature independence and the regression net** (characterization test first,
   before/after dump, mutation check) apply to every step, as since 0.18.
8. **Customer projects never enter the repository.** Regression runs on real customer
   projects run locally, outside the repository, comparing results — no fixtures, no
   golden files, no test protocols with customer content, not even anonymised.

## 3. Releases

| Release | Main block | Also in it | Changes files / threat results? |
|---|---|---|---|
| **0.19.0-beta** | Component import — **released 2026-11-14** | Polarion listed "planned" | file: yes (schema 14, retired asset fields) |
| **0.20** | **Guard rails** (rule 3) and **EN 50742 Approach B** | EN 50742 A SRSL0 guard (after the stamp); repair of raw i18n keys saved as threat / risk text | results: yes (SRSL0 guard); file: additive (retention field), repair |
| **0.21** | **Threat results correct** — physical attacks and sensors / actuators | **the one batch of field retirements** (D2, old values kept as text — R-5); DFD graph builder without side effects; typed `linkedElement` / `dataFlow` | results: yes (on regeneration); file: yes (snapshot hash — "Refresh stored state" once) |
| **0.22** | **EN 18031-1 / -2 / -3** | model coverage stage 2 (threats and matrix react to `updateEncryption`, `keyRenewal`; F-7 certificate management); time source | results: yes (stage 2 threats); file: additive |
| **0.23** | **ISO/SAE 21434 risk model** — alone | phase 2 (damage scenarios as objects) and 3b under R-10; ISO safety impact (Se4); methodology sentences; manual ISO test with a component import | file: yes (schema — last structural change); ISO results: where several damage scenarios exist |
| **0.24** | **EN 303 645** | rating context display (model field purpose phase 2); `DataFlow.frequency: once`; rest of phase 4; audit round model | file: additive (`frequency: once`); config / commits: yes (round field) |
| **0.25** | **ISO/SAE 21434 compliance module** | ISO phase 5 (cybersecurity requirements, additive) | file: additive |
| **1.0.0-rc** | **Feature freeze**, hardening only | see §3.8 | no |
| **1.0.0** | the RC code base when the RC phase finds nothing serious | | no |

**Why this order.** EN 50742 B and EN 18031 follow the user's priority. The physical /
sensor-actuator threats come right after EN 50742 B: they change threat results and carry
the field retirements, so both are behind us before the remaining standards build on the
model. The ISO risk model changes the structure of ISO risks — and what 0.19 built on them
(`creditedResidual` and the assumption-of-use effectiveness, references to imported
threats and risks, the audit diffs, the risk sync); it gets a release of its own (as its
plan demands: "release it alone") with two releases between it and the RC. It concerns
ISO projects only (ISO plan decision 10: the 1–5 risk values are `iso-21434` only), so
EN 18031 and EN 303 645 need not wait for it. EN 303 645 after EN 18031, because both ask
for the same security properties and EN 303 645 reuses the fields EN 18031 brings.

**Fallback if 0.20 grows too large:** the guard rails ship as 0.20 on their own, Approach B
follows as 0.21, and every later release moves up by one number. The depcruise baseline
alone is no reason — it is generated, not worked off in 0.20.

### 3.1 0.20 — guard rails and EN 50742 Approach B

Order inside the release: results dump → catalogue stamp → register + guard test →
depcruise rule → everything else.

- **Results dump of 0.19** (rule 3.1) on the shipped example projects — the reference the
  stamp and every later release is compared with. Customer projects only locally (rule 8).
- **Threat catalogue version stamp** (catalogue divergence design, phase A).
- **Field purpose register + guard test** (`model-field-purpose-and-rating-context-design.md`
  phase 1) — infrastructure, no effect on files or results.
- **`no-feature-to-feature`** depcruise rule in CI with a baseline list (rule 3.4).
- **EN 50742 Approach B** — coverage done (`en-50742-rq-coverage.md` §6, patch 112,
  decisions O13 – O16): component role (Table 4, fixed SL-T, 26 counted rows + 12
  recommended by analogy), system role (8.2) as a statement row (R-9), scope = the
  elements on a path to a safety function, preset `en-50742-b` without `motive`, one
  retention field for 8.5 and 7.3.4 (O8; optional, rule 5). Text: prEN 50742:2025 enquiry
  draft in `Standards/`; on publication of the final EN remap the IDs first (O1).
- Module in the Compliance tab like `en-50742-a`; switch the tag on
  (`shared/utils/tag-categories.ts`, disabled with the outdated reason "no IEC 62443-4-2
  support yet"); update `regulation-presets-design.md` (stale).
- **EN 50742 A:** SRSL 0 only when every interface is EL0 (no guard today — changes risk
  results; after the stamp).
- **Raw i18n keys** can end up as saved threat / risk text — repair on load
  (`persisted-threat-text-fix.md`; its schema numbers are stale: 6 → 7 there, 14 now).

### 3.2 0.21 — physical attacks, sensors and actuators, field retirements

Designs: `doc/Open/Threat/transducer-threat-catalogue-design.md` (phase 0) and
`doc/Open/Threat/taraflow-physicalboundary-threat-spec.md`.

- **First:** the concrete wrong cases Juergen saw → a golden test on such a model (a model
  built for the test, never a customer file), then the generator changes.
- Transducer phase 0 — F1 no-op STRIDE modifiers; F2 endpoint properties shadow the flow's
  (`T-006` / `D-003` never match — not only for transducers); F3 physical couplings get
  cyber threats; F4 the "physical world" external entity gets S/R threats; F5 sensors
  outside every trust boundary get no per-interaction threats.
- Flows crossing a physical boundary: `crossesPhysicalBoundary` is computed and read by
  nothing — build the generator source, or drop the flag (R-4). Adding it after 1.0 would
  change results.
- Sensor / actuator templates: today generic `__generic-<STRIDE>` threats — either authored
  templates now (transducer phases 3 + 4 together) or the generic output frozen as the 1.0
  contract and the templates after 1.0 (R-3).
- DFD graph builder without side effects (writes derived values into properties in place —
  root of the snapshot corruption fixed in patch 82 by copies).
- **The one batch of field retirements** — the D2 fields of
  `model-field-purpose-and-rating-context-design.md` (`exposure`, `physicalAccessControl`,
  `location`, `portability`, `serviceType`, `role` on the asset), retired in **one** commit
  with the existing pattern (`retired-asset-fields.ts`, drop step before every load step,
  verifications re-keyed, one diff entry per drop). Retiring deletes values an analyst may
  have maintained — decide with D2 (R-5) whether the old values are kept as text in the
  asset's notes ("Retired in 0.21: exposure = …") before they are dropped. Upgrade notes:
  "Refresh stored state" once for component imports.
- The snapshot hash test of rule 5 starts here (a component saved with 0.21 is the
  reference).
- Release note: threats on physical edges and on "physical world" entities disappear on
  regeneration.

### 3.3 0.22 — EN 18031

- Licensed texts: FprEN 18031-1 / -2 / -3 (May 2024) in `Standards/`. Coverage document
  per part (requirement IDs exist: `[XXX-n]`), K-points first, then the modules — gate in
  `model-coverage-implementation-plan.md` §8.
- **Model coverage stage 2** — the matrix and the threats react to `updateEncryption` and
  `keyRenewal` (fields since 0.18, so far DFD warnings only); then F-7 certificate
  management (CR 1.8). EN 18031 asks for the same properties (secure update, cryptographic
  keys).
- **Time source** (F-13 `timeSource`; carried from the CRA coverage P-4).
- New fields go into the seven security tabs (mapping in `security-tabs.tsx`); fields only
  where earlier settings make them meaningful; each one in the register (guard test) and
  optional (rule 5).

### 3.4 0.23 — ISO/SAE 21434 risk model

Plan: `iso-21434-conformance-implementation-plan.md` phases 2 and 3.

- **Phase 2 — damage scenarios as objects** (1:n per asset × property, structured
  consequence, threat ↔ damage scenario link). The migration creates them next to the
  security goals and leaves the goals unchanged (rule 5).
- **Phase 3b under R-10:** one risk per threat scenario (RQ-15-15), impact = MAX over its
  damage scenarios — the same rule as the impact aggregation `max` of the `iso-21434`
  preset (`regulation-preset.ts`), not a second one. Risk keys do not change; 3b adds the
  1–5 matrix and the acceptance criteria. Conditions:
  1. **one treatment per threat scenario** — a threat with a safety and a financial damage
     scenario gets one treatment (MAX is conservative); stated in the methodology
     sentence so an assessor does not read it as a gap. A risk per damage scenario
     (NOTE 1) only on customer demand;
  2. **the deciding damage scenario is shown** in the risk dialog and the report
     ("impact from DS-3 (safety S2)") — the traceability ISO asks for;
  3. **imported threats are linked on the machine side:** damage scenarios and
     `Threat.damageScenarioIds` stay out of the snapshot (impact belongs to the machine,
     as for the goals' impact and consequence today); the machine links its imported
     threats to its own damage scenarios — otherwise imported threats have no impact in
     ISO projects. Specified in the plan before coding; hash test: a component with
     damage scenarios has the same snapshot hash as without.
- ISO safety impact: Se4 "ambiguous" for irreversible_major (safety profiles design F-2);
  hazard report chapter skeleton (F-1).
- Methodology sentence "safety enters only via the impact (S)"
  (`safety-feasibility-coupling-design.md`, option C) — a silent simplification is an
  audit finding.
- **Manual test of ISO/SAE 21434 with a component import** — so far automated tests only:
  window of opportunity per step (also AND combinations), attack potential with the
  machine's window in the report, CMP_PATH_* findings, copying window ratings, and now the
  damage-scenario links of imported threats. Option: a small ISO example pair with an
  import.
- Release note: ISO risk values change only where several damage scenarios exist; the
  risks concerned are listed as *decision to review*.

### 3.5 0.24 — EN 303 645

- Licensed text: ETSI EN 303 645 V2.1.1 (2020-06) in `Standards/`; Table B.1 gives the
  status per provision (32 mandatory). Coverage document, then the module.
- **Rating context display** (model field purpose phase 2) — per factor in the risk and
  attack-path dialogs, no suggestions; usability, no effect on values. Decisions D3–D8
  first (R-5b).
- **`DataFlow.frequency: once`** — a new enum value, additive (rule 5).
- Rest of model field purpose phase 4: documentation fields into the report (the asset
  report shows only the description today); `assumedTrustedRationale` input + check.
- **Audit round model:** one language-independent round field; what happens to
  `risk-round-N` (audit tab rework phase 5) — changes what is written into config and
  commits.

### 3.6 0.25 — ISO/SAE 21434 compliance module

- Compliance-tab module for ISO/SAE 21434 on top of `iso-21434-rq-coverage.md` (27 met, 11
  partial, 8 gaps).
- ISO phase 5 (cybersecurity requirements, RQ-09-09 / 10 / 11) — additive.

### 3.7 Decided before 1.0.0-rc

- **Version rule for 1.x:** what makes a major (a file older versions cannot open? changed
  threat IDs / natural keys? removed fields?) and what a minor — written into the README.
  Until the RC "schema bump = minor" stays (rule 6).
- **Support promise:** how long a 1.x reads files of 0.x / 1.(x-1); how long older versions
  get fixes.
- **Beta wording** leaves the README and the app.

### 3.8 1.0.0-rc — hardening only

- Regression run on real customer projects — locally, outside the repository (rule 8),
  results compared with the dump of 0.19 and the catalogue stamp of 0.20.
- Doc generator phase 0: golden report snapshots of the **shipped examples** as the
  regression net of the reports.
- Error classes: autosave disk copy built from the merged state; the rest of the
  `no-feature-to-feature` baseline (should be short by then — it is worked off from 0.21 on).
- Trackers in preview (Jira Server / DC, GitHub, GitLab, OpenProject, Azure DevOps):
  confirmed against live instances, or still clearly marked "preview".
- Ticket texts in the tracker in the document language (English only today).
- PDF with internal links (all other formats have them).
- Asset graph: docs vs rule set (DOC-1 / B16) and the half-defined Downstream count.
- Mark the `etsi-tvra` preset as methodologically incomplete (ETSI §5.1.0 "shall").
- User manual, release notes, upgrade notes 0.x → 1.0.

## 4. Decisions

| # | Question | Needed for | State |
|---|---|---|---|
| R-1 | The cut of §3 | 0.20 start | **decided** — v0.4 (user 2026-11-14) |
| R-2 | EN 50742 text | 0.20 | **solved** — enquiry draft in `Standards/` (2026-11-14) |
| R-3 | Sensor / actuator: authored templates before 1.0, or generic output frozen as the 1.0 contract? | 0.21 | open |
| R-4 | Flows crossing a physical boundary: build the generator source, or drop the flag? | 0.21 | open |
| R-5 | Model field purpose D2: which fields retire; old values kept as text in the notes? | 0.21 | open |
| R-5b | Model field purpose D3–D8 (`model-field-purpose-and-rating-context-design.md` §9) | 0.24 | open |
| R-6 | Measure ownership (one status per measure): before the structural boundary (0.23), or 2.x? | 0.23 | open |
| R-7 | Safety profiles (`hazard-safety-profiles-design.md`): after 1.0? Its schema plan contradicts "only optimisation" | 0.23 | open |
| R-8 | Version rule for 1.x and support promise (§3.7) | 1.0.0-rc | open |
| R-9 | EN 50742 Approach B for a whole machine (8.2, Table 3): an IEC 62443-3-3 SR edition (needs the licensed text) — decide when the first customer chooses B for a machinery system; until then 8.2 is a statement row (`en-50742-rq-coverage.md` O13) | on demand | open |
| R-10 | ISO risk granularity: one risk per threat scenario with impact = MAX over its damage scenarios, instead of one per threat × damage scenario (ISO plan decision 2) | 0.23 | **decided as default** (user 2026-11-14), with the three conditions of §3.4; the per-damage-scenario variant on customer demand. ISO plan decision 2 is updated when 0.23 starts |

## 5. After 1.0 (1.x)

- Issue trackers Polarion, Redmine, Gitee.
- **Rating suggestions** (model field purpose phase 3: suggestions from a validated hint
  table, starting with the window of opportunity; report "rating basis") — additive, they
  change values only of new ratings and need the hint table (D6).
- Audit: pinned anchor, audit report generator, phase 6.
- Doc generator rework (beyond the phase 0 snapshots), reporter leftovers
  (`phase-7-reporter-design.md`: cardinality statement, emission policy, mitigation effect
  per tree, tree image), DocBook export.
- Component import leftovers: read-only view of an imported attack tree, the picker for
  machine elements, the reduced profile for external suppliers
  (`doc/Done/multi-project-tara-design.md` §15).
- Attack-tree leaf editor; hazard tab D3 flow, import report dialog, `importMeta` in the
  report; asset graph process view.
- Catalogue divergence phases C / D; transducer phases 1–6 (if not before 1.0, R-3);
  physical boundary rest (PEL / tamper / access triggers, asset back-mapping, feasibility
  hints from the PEL).
- Source bindings phase 4 validation; safety-feasibility cross-check finding.
- Hazard import adapters ISO 14971 Risk Register XML and SISTEMA CSV (safety profiles Q-8).
- ISO risk per damage scenario (R-10 variant) and the IEC 62443-3-3 SR edition (R-9) — on
  customer demand.

## 6. Not planned for 1.x so far (new features)

BaseDFD generator; server trust validation; hazard safety independence (PL); safety
profiles P1–P8 (R-7); threat enrichment (MITRE / LLM); use-case concept; TVRA cost-benefit;
measure ownership if not before the structural boundary (R-6).
