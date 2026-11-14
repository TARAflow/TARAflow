# TARAflow — roadmap to 1.0.0

**Status:** v0.3 · 2026-11-14 · v0.3: EN 50742 B coverage done, R-9 (IEC 62443-3-3 on demand) · v0.2: physical / sensor-actuator threats and the field
retirements together in 0.21, EN 18031 in 0.22 (user 2026-11-14) · v0.1: proposal — the cut
per release is **to be confirmed by Juergen** · sources: gap analysis of all documents in `doc/Open` and `doc/InProgress`
(2026-11-14, spot-checked in code at `ad55a71d`), the 0.19 work, the user's decisions below.

This document says **which release brings what** on the way to 1.0.0. The detailed
work steps of one release stay in its release plan (`doc/Done/Release/release-0.NN-plan.md`
once released); the design of each item stays in its own design document.

---

## 1. What 1.0 promises (user 2026-11-14)

- **Stability is what customers need.** 1.0 promises stable files, stable threat results
  and stable workflows.
- **The standards are in 1.0:** EN 50742 Approach B and EN 18031 first, then EN 303 645 and
  the ISO/SAE 21434 compliance module (all licensed texts except EN 50742 are in
  `Standards/`, see §5).
- **No further big feature after the component import (0.19).** From there on:
  correctness, consistency, usability, performance.
- **Issue trackers:** Polarion, Redmine and Gitee come some time — not a 1.0 topic.
- **Not everything has to go into 0.20 / 0.21** — more, smaller releases are fine.

## 2. Rules for the order

1. **Anything that changes files or threat results on purpose comes before the release
   candidate.** 1.0 must not start with a breaking change.
2. **One big block per release:** one standard, or one block that changes threat results,
   or the format changes. A release that changes threat results says so in its release
   note (regeneration shows what changed; reconciliation keeps the analyst's data).
3. **The threat catalogue version stamp comes first** (0.20). Without it, "stable threat
   results across releases" cannot be checked — every later release that changes results
   is measured against it.
4. **Field retirements in one batch (0.21).** Each retirement of a model field carried in
   component snapshots makes users "Refresh stored state" once. The retirements of the model
   field purpose design (D2) all go into 0.21, together with the physical / sensor-actuator
   threats — the D2 fields are the asset's copies of the attack-surface context (exposure,
   physical access control, location, …) that 0.21 takes from the elements instead (user
   2026-11-14). **After 0.21 no field carried in snapshots is retired before 1.0**; a field
   found unused later stays (documented as such) until 2.0.
5. **Format changes end with 0.24.** The schema changes of ISO/SAE 21434 phases 2 / 3b / 5
   are the last file-format change before the release candidate.
6. **Feature independence and the regression net** (characterization test first,
   before/after dump, mutation check) apply to every step, as since 0.18.

## 3. Releases

| Release | Main block | Also in it | Changes files / threat results? |
|---|---|---|---|
| **0.19.0-beta** | Component import (phases 4–6, E2E, example) — **finishing**: manual test, version, tag | Polarion listed "planned" (patch 110) | file: yes (schema 15, retired asset fields) |
| **0.20** | **EN 50742 Approach B** | threat catalogue version stamp; EN 50742 A SRSL0 guard; repair of raw i18n keys saved as threat / risk text | results: yes (SRSL0 guard); file: repair only |
| **0.21** | **Threat results correct** — physical attacks and sensors / actuators | **the one batch of field retirements** (model field purpose D2); DFD graph builder without side effects; typed `linkedElement` / `dataFlow` in the threat model | results: yes (on regeneration); file: yes (snapshot hash — "Refresh stored state" once) |
| **0.22** | **EN 18031-1 / -2 / -3** | model coverage stage 2 (`updateEncryption`, `keyRenewal` in threats and matrix; F-7 certificate management); time source | results: yes (stage 2 threats) |
| **0.23** | **EN 303 645** | model field purpose phases 1–3 (register, rating context, suggestions) and the rest of phase 4; audit round model | config / commits: yes (round field) |
| **0.24** | **ISO/SAE 21434 compliance module** — last format release | ISO phases 2 / 3b / 5; ISO safety impact (Se4); methodology sentence on safety | file: yes (schema) |
| **1.0.0-rc** | **Feature freeze**, hardening only | see §3.7 | no |
| **1.0.0** | the RC code base when the RC phase finds nothing serious | | no |

The order of the standards follows the user's priority (EN 50742 B, EN 18031) and the
dependencies: EN 303 645 after EN 18031, because both ask for the same security
properties (secure update, credentials, cryptography) and EN 303 645 reuses the fields
that EN 18031 brings; ISO/SAE 21434 last, because its open phases change the file format.
The physical / sensor-actuator threats come right after EN 50742 B (user 2026-11-14): they
change threat results and carry the field retirements, so both are behind us before the
remaining standards build on the model.

### 3.1 0.20 — EN 50742 Approach B

- **Prerequisite:** the licensed EN 50742 text. Approach A was built from prEN 50742:2025
  (Draft for Enquiry, DIN Media copy); it is **not** in `Standards/` any more. Needed again —
  or the final EN, if it is published (then O1 of `en-50742-rq-coverage.md`: remap the
  draft line IDs first).
- Coverage of Approach B (Clause 8) in `en-50742-rq-coverage.md` §6 — done 2026-11-14
  (patch 112), decisions O13 – O16: component role (Table 4, fixed SL-T, 26 counted rows
  + 12 recommended by analogy), system role (8.2) as a statement row (R-9), scope = the
  elements on a path to a safety function, preset without `motive`, one retention field
  for 8.5 and 7.3.4 (O8).
- Module in the Compliance tab like `en-50742-a`; switch the tag on
  (`shared/utils/tag-categories.ts`, disabled with the outdated reason "no IEC 62443-4-2
  support yet"); update `regulation-presets-design.md` (stale).
- **Threat catalogue version stamp** (catalogue divergence design, phase A).
- **EN 50742 A:** SRSL 0 only when every interface is EL0 (no guard today — changes risk
  results).
- **Raw i18n keys** can end up as saved threat / risk text — repair on load
  (`persisted-threat-text-fix.md`; its schema numbers are stale: 6 → 7 there, 15 now).

### 3.2 0.21 — physical attacks, sensors and actuators, field retirements

Designs: `doc/Open/Threat/transducer-threat-catalogue-design.md` (phase 0) and
`doc/Open/Threat/taraflow-physicalboundary-threat-spec.md`.

- **First:** the concrete wrong cases Juergen saw → a golden test on such a model, then
  the generator changes.
- Transducer phase 0 — F1 no-op STRIDE modifiers; F2 endpoint properties shadow the flow's
  (`T-006` / `D-003` never match — not only for transducers); F3 physical couplings get
  cyber threats; F4 the "physical world" external entity gets S/R threats; F5 sensors
  outside every trust boundary get no per-interaction threats.
- Flows crossing a physical boundary: `crossesPhysicalBoundary` is computed and read by
  nothing — build the generator source, or drop the flag. Adding it after 1.0 would change
  results.
- Sensor / actuator templates: today generic `__generic-<STRIDE>` threats — either authored
  templates now (transducer phases 3 + 4 together) or the generic output frozen as the 1.0
  contract and the templates after 1.0. **Decision needed** (§4).
- DFD graph builder without side effects (writes derived values into properties in place —
  root of the snapshot corruption fixed in patch 82 by copies).
- **The one batch of field retirements** — the D2 fields of
  `model-field-purpose-and-rating-context-design.md` (`exposure`, `physicalAccessControl`,
  `location`, `portability`, `serviceType`, `role` on the asset), retired in **one** commit
  with the existing pattern (`retired-asset-fields.ts`, drop step before every load step,
  verifications re-keyed, one diff entry per drop). Needs decision D2 (R-5) before 0.21
  starts. D1 of the design planned the batch for 0.20 — moved here with the physical work.
  Upgrade notes: "Refresh stored state" once for component imports.
- Release note: threats on physical edges and on "physical world" entities disappear on
  regeneration.

### 3.3 0.22 — EN 18031

- Licensed texts: FprEN 18031-1 / -2 / -3 (May 2024) in `Standards/`. Coverage document
  per part (requirement IDs exist: `[XXX-n]`), K-points first, then the modules — gate in
  `model-coverage-implementation-plan.md` §8.
- **Model coverage stage 2** — the matrix and the threats react to `updateEncryption` and
  `keyRenewal` (0.18 raises DFD warnings only); then F-7 certificate management (CR 1.8).
  EN 18031 asks for the same properties (secure update, cryptographic keys).
- **Time source** (F-13 `timeSource`; carried from the CRA coverage P-4).
- New fields go into the seven security tabs (mapping in `security-tabs.tsx`); fields only
  where earlier settings make them meaningful.

### 3.4 0.23 — EN 303 645

- Licensed text: ETSI EN 303 645 V2.1.1 (2020-06) in `Standards/`; Table B.1 gives the
  status per provision (32 mandatory). Coverage document, then the module.
- **Model field purpose** phases 1–3 (`model-field-purpose-and-rating-context-design.md`):
  decisions D3–D8 first; field purpose register + guard test; rating context per factor in
  the risk and attack-path dialogs; suggestions only with a validated hint table (starting
  with the window of opportunity), `DataFlow.frequency: once`, report "rating basis".
- Rest of model field purpose phase 4 (the retirements are done in 0.21): documentation
  fields into the report (the asset report shows only the description today);
  `assumedTrustedRationale` input + check.
- **Audit round model:** one language-independent round field; what happens to
  `risk-round-N` (audit tab rework phase 5) — changes what is written into config and
  commits.

### 3.5 0.24 — ISO/SAE 21434 compliance module, format release

- Compliance-tab module for ISO/SAE 21434 on top of `iso-21434-rq-coverage.md` (27 met, 11
  partial, 8 gaps).
- Open phases of `iso-21434-conformance-implementation-plan.md` that change the file:
  2 (damage scenarios as first-class objects), 3b (risk per threat × damage scenario),
  5 (cybersecurity requirements, RQ-09-09 / 10 / 11).
- ISO safety impact: Se4 "ambiguous" for irreversible_major (safety profiles design F-2);
  hazard report chapter skeleton (F-1).
- Methodology sentence "safety enters only via the impact (S)"
  (`safety-feasibility-coupling-design.md`, option C) — a silent simplification is an
  audit finding.
- Manual test of ISO/SAE 21434 with a component import (window of opportunity per step,
  CMP_PATH_* findings) — option: a small ISO example pair with an import.

### 3.6 Release candidate prerequisites decided before 1.0.0-rc

- **Version rule for 1.x:** today "schema bump = minor". For 1.x: what makes a major (a
  file older versions cannot open? changed threat IDs / natural keys? removed fields?) and
  what a minor — written into the README.
- **Support promise:** how long a 1.x reads files of 0.x / 1.(x-1); how long older versions
  get fixes.
- **Beta wording** leaves the README and the app.

### 3.7 1.0.0-rc — hardening only

- Regression run on real customer projects (results compared with the catalogue version
  stamp of 0.20).
- Doc generator phase 0: golden report snapshots as the regression net of the reports.
- Error classes: autosave disk copy built from the merged state; feature-to-feature
  dependencies moved to `shared/` or the app layer + depcruise rule
  `no-feature-to-feature` in CI.
- Trackers in preview (Jira Server / DC, GitHub, GitLab, OpenProject, Azure DevOps):
  confirmed against live instances, or still clearly marked "preview".
- Ticket texts in the tracker in the document language (English only today).
- PDF with internal links (all other formats have them).
- Asset graph: docs vs rule set (DOC-1 / B16) and the half-defined Downstream count.
- Mark the `etsi-tvra` preset as methodologically incomplete (ETSI §5.1.0 "shall").
- User manual, release notes, upgrade notes 0.x → 1.0.

## 4. Decisions needed

| # | Question | Needed for |
|---|---|---|
| R-1 | Confirm the cut of §3 (or move blocks) | 0.20 start |
| R-2 | EN 50742 text: provide the draft copy again, or wait for the final EN? | 0.20 |
| R-3 | Sensor / actuator: authored templates before 1.0, or generic output frozen as the 1.0 contract? | 0.21 |
| R-4 | Flows crossing a physical boundary: build the generator source, or drop the flag? | 0.21 |
| R-5 | Model field purpose: D2 (which fields retire) | 0.21 |
| R-5b | Model field purpose: D3–D8 (`model-field-purpose-and-rating-context-design.md` §9) | 0.23 |
| R-6 | Measure ownership (one status per measure): before the format freeze (0.24), or 2.x? | 0.24 |
| R-7 | Safety profiles (`hazard-safety-profiles-design.md`): after 1.0? Its schema-14 plan contradicts "only optimisation" | 0.24 |
| R-8 | Version rule and support promise (§3.6) | 1.0.0-rc |
| R-9 | EN 50742 Approach B for a whole machine (8.2, Table 3): an IEC 62443-3-3 SR edition (needs the licensed text) — decide when the first customer chooses B for a machinery system; until then 8.2 is a statement row (`en-50742-rq-coverage.md` O13) | on demand |

## 5. After 1.0 (1.x)

- Issue trackers Polarion, Redmine, Gitee.
- Audit: pinned anchor, audit report generator, phase 6.
- Doc generator rework (beyond the phase 0 snapshots), reporter leftovers
  (`phase-7-reporter-design.md`: cardinality statement, emission policy, mitigation effect
  per tree, tree image), DocBook export.
- Attack-tree leaf editor; hazard tab D3 flow, import report dialog, `importMeta` in the
  report; asset graph process view.
- Catalogue divergence phases C / D; transducer phases 1–6 (if not before 1.0, R-3);
  physical boundary rest (PEL / tamper / access triggers, asset back-mapping, feasibility
  hints from the PEL).
- Source bindings phase 4 validation; safety-feasibility cross-check finding.
- Hazard import adapters ISO 14971 Risk Register XML and SISTEMA CSV (safety profiles Q-8).

## 6. Not planned for 1.x so far (new features)

BaseDFD generator; server trust validation; hazard safety independence (PL); safety
profiles P1–P8 (R-7); threat enrichment (MITRE / LLM); use-case concept; TVRA cost-benefit;
measure ownership if not before the format freeze (R-6).
