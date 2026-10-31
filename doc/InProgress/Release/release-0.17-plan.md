# TARAflow 0.17.0-beta — release plan

**Status:** v1 · 2026-10-31 · base: `main` 90e5a52a (v0.16.0-beta, schema 11) · target
schema **12** (one fence for the whole release)
**Work split:** two Claude instances — **A** (standards strand) and **B** (trackers,
maintainability, fixes). The user reviews, applies and commits every patch.
**Sources:** roadmap and backlog after 0.16 (user 2026-10-31), the design documents
named per strand below.

---

## 1. Scope

| Strand | Content | Owner | Design document |
|---|---|---|---|
| S1 Compliance matrices | IEC 62443-4-2 classic (2019) and CRA edition (EN IEC 62443-4-2/prAA) — mapping, evaluator, SL-C vector per FR, claims, report, tab | A | `doc/InProgress/RegulationCompliance/iec-62443-4-2-cra-coverage.md` (decisions D-1 … D-6), classic sibling to be written |
| S2 Issue trackers | Jira Server / Data Center, Azure DevOps, GitHub, GitLab, OpenProject, Polarion | B | `doc/InProgress/Integration/issue-tracker-adapters.md` (§4 design, §5 steps IT-1 … IT-6 done) |
| S3 Maintainability | split `workspace-layout.tsx` and `risk-dialog.tsx`; threshold-aware risk labels | B | new section §5 of this plan (B writes a short design note before MT-1) |
| S4 Fixes / small features | hazard findings panel, audit commit order, report rejection reasons, i18n of validation messages, attack-tree relink helper, AND-gate paths | B | backlog items, listed in §3.3 |

**Proposed, not decided (user):**

- EN 50742 approach B (roadmap item 2) → **0.18**. It reuses the S1 matrix as a fixed
  subset (prEN 50742 Tables 3 / 4) and needs S1 done first.
- Out of 0.17: hazard graph in the Hazard tab, common document model
  (`doc/Open/Doc/doc-generator-architecture-design.md`), Annex H threat list (K6).

## 2. Order and dependencies

```
A: IEC-0 docs ─ IEC-1 schema-12 skeleton ─ IEC-2 mapping ─ IEC-3 evaluator ─ IEC-4 statements
                       │                                        │
                       │                                IEC-5 catalog refs ─ IEC-7 report
                       │                                                         │
B: MT-1 workspace split ────────────────────────────────────────────── IEC-8 tab (A, after MT-1)
   MT-2 risk-dialog split ─────────────────────────── IEC-6 claims kind (A, after MT-2)
   IT-7 … IT-12 trackers (independent)      FX-1 … FX-6 (independent, FX-1 after MT-1)
                                                                    ↓
                                          IEC-9 model gaps, IEC-10 validation ─ R-1 release
```

Rules that follow from it:

1. **B does MT-1 and MT-2 first** (they touch the files A needs later). Until MT-1 /
   MT-2 are committed, A does not touch `workspace-layout.tsx` or `risk-dialog.tsx`.
2. **A delivers IEC-1 (schema 12 skeleton) early**, before any step that stores a new
   field. Afterwards every new field of either instance goes through it (§4).
3. Trackers (IT-7 …) and FX-2 … FX-6 are independent and can run any time.

## 3. Steps

Each instance updates **only its own rows** (status, patch number) — the other rows are
read-only for it, so two patches never conflict in this file.

### 3.1 Instance A — S1 compliance matrices

| Step | Content | Depends on | Patch | Status |
|---|---|---|---|---|
| IEC-0 | Docs: classic matrix `iec-62443-4-2-2019-coverage.md` (from the 2019 text, licensed, paraphrased); decide K2, K4, K5, K6, K8 with the user; implementation plan section in the coverage doc | — | | open |
| IEC-1 | Schema 12 skeleton: `migrate-11-to-12.ts` (no-op), version fence, `ANALYSIS_PRESERVING_MIGRATIONS` entry, fixtures | — | | open |
| IEC-2 | Mapping types + two versioned mapping files (classic 2019, CRA prAA); regulation tag `EN IEC 62443 (CRA)` (DE / EN tooltip, doc description), tag-validator hint; matrix selection by tags (D-1, D-3) | IEC-0 | | open |
| IEC-3 | Evaluator: applicability per element, A / B rows, planned and achieved SL-C vector per FR, gap list (D-2, D-4); component under evaluation (K2) | IEC-2 | | open |
| IEC-4 | Project data: target vector per FR, analyst statements for C rows / overrides (K4) — schema 12 | IEC-1, IEC-3 | | open |
| IEC-5 | Mitigation catalog: optional `iec62443` CR / RE references (built-in + custom mitigations) (D-6) | IEC-3 | | open |
| IEC-6 | Claims: new kind for SL-C gaps (FR, CR / RE ids, supporting measure, responsible party), visible for projects with a 62443 matrix — amends patch 244 (D-5) | MT-2, IEC-4 | | open |
| IEC-7 | Report chapter (all formats incl. pdfmake, CLI chapter list): SoA table, CRA view, vectors, gaps | IEC-4, IEC-5 | | open |
| IEC-8 | Compliance tab (K5) | MT-1, IEC-7 | | open |
| IEC-9 | Model gaps P-1 … P-6; multi-select `defaultDenyPolicy`, `physicalPathProtection`, `malwareProtection` (backlog "conflicting SHOULDs") — schema 12, analysis-preserving only if values map 1:1 | IEC-1 | | open |
| IEC-10 | Validate on the examples (SmokeDetector-leveled, Headlamp); coverage doc status | all IEC | | open |

### 3.2 Instance B — S2 issue trackers

Continue the step table in `issue-tracker-adapters.md` §5 (IT-7 …); each adapter
implements `TicketAdapter` on the host-bound channel (no token in the renderer), flips
`available` in `shared/models/issue-trackers.ts`, gets an integration test on the chain
(as `issue-tracker-chain.int.test.ts`) with mocked HTTP. A real run per tracker is a
user check (list it in the release test plan).

| Step | Content | Patch | Status |
|---|---|---|---|
| IT-7 | Jira Server / Data Center (REST v2, PAT bearer, wiki markup instead of ADF) — reuse the Jira adapter | | open |
| IT-8 | Azure DevOps (WIQL, JSON Patch, `System.State`) — users stay on 0.15.2 until it returns | | open |
| IT-9 | GitHub Issues (labels, closed state reason) | | open |
| IT-10 | GitLab Issues | | open |
| IT-11 | OpenProject (API v3, API key) | | open |
| IT-12 | Polarion (REST v1) | | open |

### 3.3 Instance B — S3 maintainability, S4 fixes

| Step | Content | Patch | Status |
|---|---|---|---|
| MT-1 | Split `src/app/components/layout/workspace-layout.tsx` (~1500 lines, 10× `exhaustive-deps` disabled) into per-strand hooks; no behaviour change; short design note in §5 first | | open |
| MT-2 | Split `src/features/risks/components/risk-dialog.tsx` (~3260 lines) into panels; no behaviour change | | open |
| MT-3 | `getRiskLabel(score, scale)` in the risk-dialog tooltips gets the project's `severityThresholds` | | open |
| FX-1 | Hazard tab findings window: `asset-notification-panel.tsx` becomes a shared findings panel used by Assets and Hazards (asset panel unchanged); hazard validator / relation messages become structured findings (severity, i18n key, params, hazardId) — also translates the Overview tooltip | | open |
| FX-2 | Audit commit: check out the branch first, then stage the project file | | open |
| FX-3 | Report shows rejection reasons | | open |
| FX-4 | Risk-tab validation messages (`riskService.validate`) via i18n | | open |
| FX-5 | Relink helper for goals / claims orphaned by a renamed attack-tree node (pathKey) | | open |
| FX-6 | AND-gate paths: `extractAllPaths` yields one path per AND gate (combined feasibility), not one per leaf | | open |

### 3.4 Release

| Step | Content | Owner | Status |
|---|---|---|---|
| R-1 | `TESTPLAN-0.17.md` (repo root, untracked), CHANGELOG, release note `doc/release-notes/v0.17.0-beta.md`, README, version 0.17.0-beta; finished design docs → `doc/Done` | A, after both branches are merged | open |

## 4. Schema 12 — one fence

- One schema number per release (ISO plan decision 15 / K7). Owner of
  `src/app/services/versions/migrate-11-to-12.ts` and the fence: **A** (IEC-1).
- B needs the fence only if an older release would drop or misread a new field. If a B
  step needs it, B adds its own pure function in its own file
  (`versions/migrate-11-to-12-<topic>.ts`) and one call line in `migrate-11-to-12.ts`;
  A rebases on it.
- A migration is declared in `ANALYSIS_PRESERVING_MIGRATIONS` only if it keeps every
  analysis value (re-seal after migration, patch 222). The fixed `REFERENCE_HASH` test in
  `verification-state.test.ts` must stay green.

## 5. Design note MT-1 / MT-2 (B)

*(B fills this in before MT-1: hook boundaries, what moves where, how behaviour is kept —
e.g. component tests that already cover the tabs.)*

## 6. Working rules (both instances)

1. **Patches, no commits.** Each step = a plain `git diff` in the repo root plus a commit
   message file next to it; the user applies and commits. Never `git commit`;
   `/workspace/.git` is read-only (no `add -N`, `stash`) — new files via
   `git diff --no-index /dev/null <file>`. After building the patch: `git apply -R`, then
   `git apply --check`, and stop — never re-apply it yourself.
2. **Numbering:** A continues the existing series (`257-…`, `258-…`); B uses
   `B01-<feature>-<step>.diff` / `.msg`, `B02-…`. A delivered patch file is deleted only
   after `git log` shows it committed with this message's subject.
3. **Commit message:** conventional subject (`feat(compliance): … (IEC-3)`), body
   referencing the design doc section / decision, bullets wrapped at ~72 columns, last
   bullets tests and design-doc update. Do not repeat the message in the chat.
4. **CI before delivery** (`.github/workflows/ci.yml`): `npm run build`,
   `npm test -- --run`, `npm run test:component`, `npm run test:integration`,
   `npx depcruise --config utils/depcruise-doc.cjs --output-type err-long src/features/documentation/utils`.
5. **Every step updates its design doc's status** and its own row in §3 of this plan.
6. **New test files:** check `git ls-files <path>` first — never overwrite a tracked
   test.
7. **Stacked patches** (several undelivered steps on top of each other): build each in a
   temporary git repo outside `/workspace/.git` (HEAD files + earlier patches committed,
   workspace copied over → diff).
8. **Branches** (created by the user): A `feature/iec62443-cra-matrix`, B
   `feature/0.17-trackers-maintenance`; doc-only patches (this plan, design decisions)
   go to `main`.
9. **Cross-review:** each instance reviews the other's patches that touch shared files
   (`element-properties.ts`, `shared/models/*`, `versions/*`, i18n locale files) before
   the user applies them; findings go into the owning design doc, not only the chat.
10. **Licensed material:** the standards PDFs in the repo root (ISO/SAE 21434,
    IEC 62443-4-2:2019, EN IEC 62443-4-2/prAA, prEN 50742) are never committed, pushed
    or quoted at length — paraphrase and cite clause / line. Text extraction only with a
    script outside the repo. `Vareo_Risikobeurteilung_Vorschlag.xlsx` and the example
    `.tara.json` files in the root are the user's — never commit, patch or use as
    fixtures.
11. **Language:** chat with the user in German; code, comments, commits and docs in
    English. i18n: every UI string DE + EN.
12. **Clarify first:** open design questions go into the design doc as K-points with
    options and a recommendation; nothing is presented as decided until the user says
    so.

## 7. Open points for the user

| # | Question | Recommendation |
|---|---|---|
| R-K1 | EN 50742 approach B in 0.17 or 0.18? | 0.18 (needs S1 first) |
| R-K2 | Tracker order | Jira Server / DC, ADO, GitHub, GitLab, OpenProject, Polarion (as in §3.2) |
| R-K3 | Ticket texts sent to the tracker stay English? (backlog) | yes for 0.17; per-project language later |
| R-K4 | Branch names (§6.8) | as proposed |
