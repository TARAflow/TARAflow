# TARAflow 0.18.0-beta — release plan

**Status:** v4 · 2026-11-03 · S1 done (patches 21 – 31) · FX-6 done (patch 32) · one branch, one instance (user 2026-11-03) · base: `main` 9d80b637 (0.17.0-beta + fix of the stale flow
exposure level), schema **13** on `feature/0.18-model-coverage`
**Work split (user 2026-11-03, replaces the split of 2026-11-02):** instance **A** does every
strand on `feature/0.18-model-coverage` — the other instance keeps no branch. Order: FX-6,
FX-7, IT-8 Azure DevOps, FX-1 … FX-5 and MT-3, I18N-1, MT-1 / MT-2, further trackers by effort
(some may move to 0.19). The user reviews, applies and commits every patch.
**Sources:** release plan 0.17 (`doc/Done/Release/release-0.17-plan.md`: §3.2 / §3.3 and the
note "B scope moves to 0.18 unchanged"), release note 0.17 (Azure DevOps promised for
0.18), `iec-62443-4-2-cra-coverage.md` §9.6, `model-coverage-implementation-plan.md` §8.1 /
§10, the backlog after 0.16.

---

## 1. Scope

| Strand | Content | Owner | Design document |
|---|---|---|---|
| S1 Compliance | model coverage stage 1 (**done**, CM-1 … CM-10, patches 01 – 20 on `feature/0.18-model-coverage`); EN 50742 approach A module (CM-11 … CM-13); IEC-6, IEC-8b, D-30 option c; multi-select `physicalPathProtection` / `malwareProtection`; form fields for existing properties | A | `model-coverage-implementation-plan.md`, `iec-62443-4-2-cra-coverage.md`, `en-50742-approach-a-design.md`, `en-50742-rq-coverage.md` |
| S2 Issue trackers | **Azure DevOps first** (promised in the 0.17 release note), then Jira Server / Data Center, GitHub, GitLab, OpenProject, Polarion | A | `doc/InProgress/Integration/issue-tracker-adapters.md` (§4 design, §5 steps IT-7 …) |
| S3 Maintainability | split `workspace-layout.tsx` and `risk-dialog.tsx`; threshold-aware risk labels | A | §5 of this plan (a short design note before MT-1) |
| S4 Fixes / small features | hazard findings panel, audit commit order, report rejection reasons, i18n of risk validation messages, attack-tree relink helper, AND-gate paths; split of `common.json` (`overview.json`) | A | backlog items, §3.3 |

Not in 0.18: EN 50742 approach B (user: after the IEC 62443 support is complete), model
coverage stage 2 (§4.3 of the model coverage plan), hazard graph, common document model,
EN 303 645 / EN 18031 modules (texts verified, modules later).

## 2. Order and dependencies

```
A: CM-1 … CM-10 (done) ─ S13 data steps (MS-1, EN 50742 data) ─ CM-11 ─ CM-12 ─ CM-13
                          │                                   IEC-6, IEC-8b, D-30c, FF-1 (independent)
B: IT-8 ADO ─ IT-7, IT-9 … IT-12 (independent)
   MT-1, MT-2 (before any A step that touches workspace-layout / risk-dialog)
   FX-1 … FX-5 (independent)     FX-6 (schema 13, K-9 per-file report)
                                                     ↓
                                     R-1 release (TESTPLAN-0.18.md, notes, version)
```

1. **One schema fence (13)** for everything that changes stored data: the reshape of
   `project.compliance` (done, CM-3), EN 50742 A data in `families["en-50742"]`, the
   multi-select migrations (MS-1) and FX-6. Owner of
   `src/app/services/versions/migrate-12-to-13.ts`: **A**. B adds its own pure function in
   its own file (`versions/migrate-12-to-13-<topic>.ts`) and one call line; a step reports
   per file whether it changed an analysis value (K-9).
2. **MT-1 / MT-2 before A touches** `workspace-layout.tsx` or `risk-dialog.tsx` again (A's
   remaining steps need neither, except IEC-8b in the custom mitigation dialog — that is
   not the risk dialog).
3. B branches from `main`; A's branch is merged into `main` before the release; both bring
   `main` in with `git merge main` (no rebase).

## 3. Steps

### 3.1 Instance A — S1 compliance

| Step | Content | Status |
|---|---|---|
| CM-1 … CM-10 | model coverage stage 1: standard registry, sub-tabs, schema 13 per family, visibility predicates, fields F-1 … F-29 (without F-28, dropped), Security sub-tabs, CR 1.11 on the verifier, report part per standard, validation | **done** (patches 01 – 20) |
| CM-11 | EN 50742 A module: registry entry, groups, rows of coverage §9.2, header `srsl` (model coverage plan §8.1) | **done** (patch 23): 23 rows, rules, EN / DE texts; one rule / text lookup for every family; tag aliases via the normaliser; whole-machine scope; tab without SL parts; 7.3 rows from the model, R / P rows need a statement until CM-12; report part with CM-13 |
| CM-12 | EN 50742 A evidence: risk and project rule kinds, `En50742View`, model rules 7.3 / 7.4.3.5.1, golden tests on an own example | **done** (patch 24): view built in the app layer, risk checks per clause (done / planned), project checks (hazards, WoO, system definition, interfaces, SRSL), `minSrsl` for 7.4.3.5.1, SRSL header per safety function, risks in notes and to-do; golden on the SmokeDetector with the tag set in the test; CM-12b (patch 25): interfaces on a path to a safety function derived from the asset's DFD elements backwards along the flows (one-way boundaries end it) |
| CM-13 | EN 50742 A report part (CM-9 structure), coverage rows → tracked | **done** (patch 26): own part without levels (basis, SRSL per safety function, SoA with groups and risks, open requirements); chapter renamed "Requirement Matrix"; coverage v0.3 with test references |
| IEC-6 | claims as evidence for SL-C gaps (D-5) | **done** (patch 28): supporting claims CLM-nn in the row info dialog, rows claimed in every edition, report section; ISO views unchanged |
| IEC-8b | `iec62443` references on project mitigations in the custom mitigation dialog | **done** (patch 29): field with the active editions' requirements (only with a 62443 tag), derived ones listed |
| D-30c | per-element fields on a black-box Multiprocess (D-30 option c) | **done** (patch 30): seven "inside" fields (core set, user 2026-11-03) in a sub-tab "Inside (black box)", shown only without child page; checked with the Process / DataStore rules, also beside modelled processes |
| MS-1 | `physicalPathProtection`, `malwareProtection` multi-select (conflicting SHOULDs, backlog after 0.16) — schema-13 step, 1:1 | **done** (patch 22): selections with "none" exclusive (shared helpers `selectionOf` / `withSelected`, also behind `defaultDenyPolicy`); one `MultiSelectField` in the Process, Multiprocess and DataFlow forms (per-technology / per-system-class options kept); defaults, elimination filter (`buried` in a selection), implemented-control hints and the closed loop (`MULTI_SELECT_CONTROL_PROPERTIES`, "none" exclusive) read selections; migration step in `migrate-12-to-13` ("x" → ["x"], analysis-preserving); R-2 test: the same threats for single values and selections. The other pairs of conflicting SHOULDs are true alternatives and stay single-valued |
| FF-1 | form fields for properties the model has but no form shows: `accessMode`, `dataMinimization`, `volume`, `assumedTrusted`, `connectionSpeed` (with visibility by context) | **done** (patch 31), reduced (user 2026-11-03): `accessMode` (drives the tampering threats of field protocols, closes M-I-007; flows with a transport medium) and `dataMinimization` (CRA (2)(g); flows from / to an external entity) in the data-flow form. Not built: `volume`, `connectionSpeed` (documentation only), `assumedTrusted` (no reader, overlaps "exclude from threat generation") — backlog: remove it from model and report |
| P-4 | time source — not in 0.18 (R-K1 decided): model coverage stage 2, F-13 | moved |

### 3.2 Instance B — S2 issue trackers

Each adapter implements `TicketAdapter` on the host-bound channel (no token in the
renderer), flips `available` in `shared/models/issue-trackers.ts`, gets an integration test
on the chain (as `issue-tracker-chain.int.test.ts`) with mocked HTTP. A real run per
tracker is a user check (listed in TESTPLAN-0.18.md).

| Step | Content | Status |
|---|---|---|
| IT-8 | **Azure DevOps first**: organisation URL + PAT (`Basic base64(:pat)`, already in §4.1 of the tracker design), WIQL for the batch of states, JSON Patch for creating work items, `System.State` → `TicketState` (incl. "Removed" / closed without fix → `done_without_fix`); issue types from the process template | **done** (patch 34): adapter, organization-bound PAT, shared `adapter-support.ts`; real run against an ADO organization in the test plan |
| IT-7 | Jira Server / Data Center (REST v2, PAT bearer, wiki markup instead of ADF) — reuse the Jira adapter | **done** (patch 35, preview): Jira adapter flavour "server" (REST v2, wiki markup, Bearer PAT); every tracker except Polarion in 0.18, marked "preview" until a real run (user 2026-11-03) |
| IT-9 | GitHub Issues (labels, closed state reason) | **done** (patch 36, preview) |
| IT-10 | GitLab Issues | **done** (patch 37, preview) |
| IT-11 | OpenProject (API v3, API key) | open |
| IT-12 | Polarion (REST v1) | moved: later (user 2026-11-03) |

### 3.3 Instance B — S3 maintainability, S4 fixes

| Step | Content | Status |
|---|---|---|
| MT-1 | split `src/app/components/layout/workspace-layout.tsx` into per-strand hooks; no behaviour change; design note in §5 first | open |
| MT-2 | split `src/features/risks/components/risk-dialog.tsx` into panels; no behaviour change | open |
| MT-3 | `getRiskLabel(score, scale)` in the risk-dialog tooltips gets the project's `severityThresholds` | open |
| FX-1 | Hazard tab findings window: the asset notification panel becomes a shared findings panel; hazard messages as structured findings (also translates the Overview tooltip) | open |
| FX-2 | audit commit: check out the branch first, then stage the project file | open |
| FX-3 | report shows rejection reasons | open |
| FX-4 | risk-tab validation messages (`riskService.validate`) via i18n | open |
| FX-5 | relink helper for goals / claims orphaned by a renamed attack-tree node (pathKey) | open |
| FX-6 | AND-gate paths: one path per AND gate (combined feasibility) — schema-13 step with the per-file report (K-9) | **done** (patch 32): one path per combination of an AND gate's steps (minimal cut set; OR below the gate multiplied out), feasibility of the gate over that combination, key from the sorted legs; S13-c carries assessments (merged; disagreement kept for review), risks (renamed / merged with review note) and goal / claim risk ids over; analysis changed only for files with an AND gate |
| FX-7 | threat catalog context keys the matcher ignores: `matchesContext` does not read `physicalPathProtection`, so the condition `physicalPathProtection: ["none"]` in `threats-physical.json` has no effect (found with MS-1, 2026-11-02) — a guard test for unknown context keys, then decide per key (wire it in — changes threats, R-2 note in the release notes — or drop it from the catalog). Same check for **unset values** (found with FF-1, 2026-11-03): a condition such as `accessMode: ["read_write"]` (threats-tampering, embedded) drops the threat when the flow leaves the property unset — against "unset = unknown, never safe" (R-1); decide with the R-2 note. **Must be in 0.18** (user 2026-11-03) | **done** (patch 33): `matchesContext` reads `physicalPathProtection` (multi-select) and `encryptionInTransit`; keys that name a missing / weak control match an unset property as the weak value (`accountManagement`, `authenticatorStorage` only where the element authenticates); selector keys still need a value; templates matched by facts rank before those matched by an assumption; guard test: every catalog key is read. Effect on the examples: a few template switches (SmokeDetector 2, Pump Station 2, Simple 2, Headlamp 1, CNC 5, Vareo 0), no new or vanished threats — **release note (R-2)**: regenerated threats may name the weak-control variant |
| I18N-1 | split `common.json` into `overview.json` / `common.json` (insert / move keys textually, never re-dump the JSON) | open |

### 3.4 Release

| Step | Content | Owner | Status |
|---|---|---|---|
| R-1 | `TESTPLAN-0.18.md` (repo root, untracked; one section per step), CHANGELOG, release note `doc/release-notes/v0.18.0-beta.md`, README, version 0.18.0-beta; finished design docs → `doc/Done` | A, after the user ran the test plan | open |

## 4. Working rules (both instances)

As in the 0.17 plan §6, in short:

1. **Patches, no commits:** a plain `git diff` plus a commit message file in the repo
   root; line 2 of the message is empty. After building: `git apply -R`, `git apply
   --check`, stop. `/workspace/.git` is read-only; new files via `git diff --no-index
   /dev/null <file>`.
2. **Numbering:** A continues `21-…` on its branch; B uses `B01-<topic>.diff` / `.msg`.
3. **CI before delivery:** build, unit, component, integration, depcruise, CLI smoke test
   (`.github/workflows/ci.yml`). `electron/tests/update/window-navigation.test.ts` fails in
   the sandbox only.
4. **Branches** (created by the user): A `feature/0.18-model-coverage`; B e.g.
   `feature/0.18-trackers-maintenance` from `main`. Doc-only patches go to `main`.
5. **Cross-review** of shared files (`element-properties.ts`, `shared/models/*`,
   `versions/*`, locale files) before the user applies them.
6. **i18n JSON:** insert keys textually next to an existing key; `git diff --stat` shows
   insertions only.
7. **Licensed texts** in `Standards/` are never committed or quoted at length; root
   `.tara.json` files and `Vareo_Risikobeurteilung_Vorschlag.xlsx` are the user's.
8. **Language:** chat German; code, commits, docs English; every UI string DE + EN.

## 5. Design note MT-1 / MT-2 (B)

*(B fills this in before MT-1: hook boundaries, what moves where, how behaviour is kept.)*

## 6. Open points for the user

| # | Question | Recommendation |
|---|---|---|
| R-K1 | P-4 time source in 0.18 or with model coverage stage 2? | **decided** (user 2026-11-03): not in 0.18 — with stage 2 (F-13 with the audit cluster F-11 … F-14) |
| R-K2 | Order of the trackers after ADO | **decided** (user 2026-11-03): Jira Server / DC (reuses the Jira adapter), then GitHub, GitLab, OpenProject, Polarion |
