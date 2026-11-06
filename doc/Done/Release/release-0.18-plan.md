# TARAflow 0.18.0-beta — release plan

**Status:** v5 · 2026-11-04 · AF-1 (patch 39), MT-3 (patch 40), FX-2 (patch 41), FX-3 (patch 42), FX-4 (patch 43), FX-8 (patch 44), FX-1 (patch 45), FX-5 (patch 46), I18N-1 (patch 47), R-1 (patch 48) done — released as 0.18.0-beta, MT-1 / MT-2 moved to 0.19 · order: AF-1, MT-3, FX-2, FX-3, FX-4, FX-8, FX-1, FX-5, I18N-1 · S1 done (patches 21 – 31) · FX-6 done (patch 32) · one branch, one instance (user 2026-11-03) · base: `main` 9d80b637 (0.17.0-beta + fix of the stale flow
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
| IT-11 | OpenProject (API v3, API key) | **done** (patch 38, preview) |
| IT-12 | Polarion (REST v1) | moved: later (user 2026-11-03) |

### 3.3 Instance B — S3 maintainability, S4 fixes

| Step | Content | Status |
|---|---|---|
| AF-1 | asset tab filter (user 2026-11-04): asset type and criticality "from level" across all group accordions | **done** (patch 39): one bar above the table — also without groups — with chips for the asset types present (count each; none selected = all) and criticality "from level" on the level of the Overall column, unrated assets on request; combines (AND) with "Needs review only"; accordion counts follow, empty accordions disappear; "x of y assets shown" with "Reset filter"; kept per project for the session, never in the file; "Show in table" lifts a filter that hides the asset |
| AG-1 | asset graph: three rows per category lane, also in the free rows (user 2026-11-06), automatic spread by links (variant 2) | **done** (patch 51): ROW_HEIGHT 100, three rows per vertical lane, anchor lane and free row (lane 300); a lane's node snaps onto its rows (drag, Ctrl / ⌘ + Shift + ↑ / ↓), the side column onto the 100 px grid; a full layout spreads lanes from 7 nodes by links (up → top row, down → bottom row, else middle; ≤ ⌈n/3⌉ per row, weakest preference moves first; deterministic); new nodes on the middle row; remembered positions of 0.17 placed anew once |
| AG-2 | asset graph: show only the assets without an asset-to-asset relation (user 2026-11-06) | **done** (patch 52): chip "Without asset relation (n)" next to the presets, layer view only, combinable with presets / layers; DFD-element and hazard links do not count, nor a relation to a deleted asset; view state, Reset turns it off |
| AG-3 | the filter as a choice, plus "without hazard relation" and "without any relation" (user 2026-11-06) | **done** (patch 53): select next to the presets — all / without asset relation / without hazard relation (only with hazards) / without any relation (no asset, hazard or DFD link); counts per entry for the chosen layers; replaces the AG-2 chip |
| AG-4 | relation filter entry "DFD element relation, no asset relation" (user 2026-11-06) | **done** (patch 54): assets linked to a DFD element but to no other asset — drawn in the DFD, not yet placed in the asset model |
| AG-5 | relation filter as checkboxes for all combinations; only relevant hazards in the graph (user 2026-11-06) | **done** (patch 55): menu "Relations" with DFD element / asset / hazard, all ticked; an unticked kind hides every node with such a relation — a hazard is a node like an asset, its links to assets count as "asset"; nothing ticked = nodes without any relation; replaces the AG-3 / AG-4 choice. The graph shows only hazards with system relevance "in scope" (counts too) |
| AG-6 | lane labels visible wherever the graph is scrolled horizontally (user 2026-11-06) | **done** (patch 56): the label of a lane with rows (categories, DFD elements, free rows) sits left of the lane but never left of the visible area (`laneLabelX`), with a halo for legibility over nodes; side-column labels unchanged |
| AG-7 | lane labels: free rows covered by nodes, labels not aligned, side column not sticky (user 2026-11-06) | **done** (patch 57): all lane labels in one top layer after nodes and edges; left-aligned on one line (`LANE_LABEL_LEFT`), at the visible left edge when scrolled; a side-column label stays at its column while in view, else joins the left edge stacked below the label of the same height (`laneLabels`) |
| FX-9 | security sub-tabs: chosen tab cut off after switching P-1 → MP-1 → P-1 (test plan C2, user 2026-11-06) | **done** (patch 58): the rebuilt bar scrolled the tab into view while the panel was still settling; the bar now scrolls itself (horizontally only) so the chosen tab is fully visible on every change of its width and of the chosen tab |
| FX-10 | multiprocess safety fields out of the security tabs (test plan C3, user 2026-11-06) | **done** (patch 59): "Safety-relevant system" and its rationale below the tabs, visible on every tab (still only for the system classes that show them); tab "Safety" removed |
| FX-11 | black-box "inside" fields in the tabs of their topic instead of an own tab (user 2026-11-06) | **done** (patch 59): input validation, error handling, output state on failure → Robustness (as on the process); deletion → Operation; data classification, encryption at rest, integrity → new tab "Data" (black boxes only); labels keep "Inside:"; tab "Inside (black box)" removed |
| FX-12 | security tabs still at another place after P → MP → P; "Inside:" prefix not needed (user 2026-11-06) | **done** (patch 60): the bar no longer scrolls — tabs wrap in a narrow panel, fixed underline for the chosen tab (MUI's sliding indicator off); the FX-9 scroll correction removed; the kept tab per element type (P: Operation, MP: Data) tested across the switch; black-box field labels without "Inside:" |
| DV-1 | create assets from the DFD description view (user 2026-11-06) | **done** (patch 61): Assets accordion always shown; "+" opens an inline form (name, category, Enter / Create / Cancel) using the DFD tab's onCreateAsset; the new asset opens; a hint when there is none |
| FX-13 | security tabs checked against the standards; TLS termination out of "Login & accounts" (user 2026-11-06) | **done** (patch 62): tab set verified against the categories of EN 303 645, EN 18031 and IEC 62443-4-2 (mapping in `security-tabs.tsx`); new tab "Communication" (EN 303 645 5.5, EN 18031 SCM / CCK / CRY, CR 1.2 / 3.1 / 4.1) with TLS termination and the multiprocess's boundary authentication; TLS termination only where a flow can carry a secure channel (network / bus; unset protocol or no flow = shown); exposed to Internet stays in Operation (context, not a control). Generalised in patch 63 (FX-14) |
| FX-14 | secure channel instead of TLS only (user 2026-11-06: "TLS is not the only way") | **done** (patch 63): `tlsTermination` (key kept) is a multi-select of SECURE_CHANNEL_OPTIONS — none · TLS server · mutual TLS · VPN / IPsec · SSH · application level (OPC UA Secure Channel) · other; "none" exclusive; label "Secure channel (endpoint)"; the A5 validator reads TLS / mTLS from the selection (other channels pair no TLS); schema-13 step converts a single value 1:1 (MS-1 pattern), readers accept an older single value |
| FX-15 | DFD messages of the TLS check named the internal key `tlsTermination` (user 2026-11-06) | **done** (patch 64): the three findings (no TLS endpoint, mTLS needs both, handshake mismatch) say where to fix it — Communication → Secure channel (endpoint), with the option to tick; EN / DE |
| FX-16 | secure channels end to end (user 2026-11-06: P-1 offers SSH, MP-1 only TLS — what then?) | **done** (patch 65): flow `encryptionInTransit` + ssh, application (readers: CR 4.1 rule, control semantics "custom", options); A5 checks SSH flows (one endpoint offers SSH) and application-level flows (both offer it); new warning: a channel an element offers that none of its flows uses (`channelUnused`, channel named via the `channel` param resolver); VPN stays unchecked (ends at a gateway) |
| FX-17 | ask for the secure channel when nothing is chosen (user 2026-11-06) | **done** (patch 66): warning "missing property" (field "Secure channel (endpoint)") on a process / multiprocess with a flow over a network or fieldbus (known protocol; not human input, in-process, electrical or on-board chip buses UART / SPI / I²C — offered there, not asked) and no choice; "none" counts as a choice; examples: Pump Station none, SmokeDetector 10, Headlamp none, Vareo v4 13, Simple 1; example base model: P-1 / P-2 "none" |
| FX-18 | "Exposed to Internet" on the process up to the context (user 2026-11-06) | **done** (patch 67): out of the Operation tab into the Context section, as on the multiprocess; not for embedded processes |
| FX-19 | update package encryption and key renewal (user 2026-11-06: new keys must travel encrypted) | **done** (patch 68): model fields `updateEncryption` (none / per type / per device; Operation, shown when updated) and `keyRenewal` (not possible / encrypted update / secure channel / on site / plaintext; Communication, shown where the element holds keys — a secure channel or certificate authentication); DFD warnings: renewal in plain, over a channel the element does not offer, in an update that is not encrypted (read through the field predicates, R-3). No threat or matrix coupling yet — with model coverage stage 2 (0.19), F-7 builds on `keyRenewal` |
| FX-20 | CR 1.7 shown "met" while the dialog says properties missing (user 2026-11-06) | **done** (patch 69): the row is met by the analyst's statement, the model alone is unknown — by design; list note "model still open — properties missing on …" and an info box in the dialog ("Met by the statement …") for rows met by a statement / mitigation / supporting measure / claim whose model status is unknown or gap |
| FX-21 | "Unknown" says nothing about what to do (user 2026-11-06) | **done** (patch 70): status / filter "Information missing" / "Angaben fehlen" (tab and report); the evaluator records per unknown element the unset fields the row reads (`RowResult.unsetFields`, a black box's inside field for stand-ins); row note and dialog name them with the DFD label |
| FX-22 | Void rows (CR 1.7 RE(1), CR 1.14, CR 2.3, CR 3.3, CR 5.3, CR 5.4, CR 7.5) without link (user 2026-11-06) | **done** (patch 71): link with the reason as tooltip; the info dialog shows "Why not applicable" with the edition's reason (EN / DE, `VOID_REASONS`; a guard test covers every void reason of both editions), no summary / check / statement sections |
| FX-23 | Report "Gaps against the SL-T" lists only mitigation ids (user 2026-11-06, test plan G) | **done** (patch 72): `DocComplianceRow.suggestions` carries `{ id, text }` — catalog text in the document language (`i18n.getFixedT(language, "mitigations")`), project mitigations with their own text; the table cell reads "id: text" joined with "; ", the id alone when no text exists |
| MT-1 | split `src/app/components/layout/workspace-layout.tsx` into per-strand hooks; no behaviour change; design note in §5 first | moved: first step of 0.19 (user 2026-11-04) |
| MT-2 | split `src/features/risks/components/risk-dialog.tsx` into panels; no behaviour change | moved: first step of 0.19 (user 2026-11-04) |
| MT-3 | `getRiskLabel(score, scale)` in the risk-dialog tooltips gets the project's `severityThresholds` | **done** (patch 40): `getRiskColor` / `getRiskLabel` / `generateRiskMatrix` take the risk configuration (scale + thresholds) instead of the scale; fixed callers: risk dialog list, score panel, risk table chips and tooltips, matrix tooltips; matrix cells now use the level of I × L by the same rule (before: `ceil(I·L / levels)` — I=2, L=2 read Low in the matrix, Medium on the chip); impact / likelihood chips in the table use their axis scale (before: risk thresholds — impact 4 showed yellow); unused `RiskScoreChip` removed; guard test: no call passes the scale alone. Display only, no data change |
| FX-1 | Hazard tab findings window: the asset notification panel becomes a shared findings panel; hazard messages as structured findings (also translates the Overview tooltip) | **done** (patch 45): `shared/components/findings-panel.tsx` (resizable, errors / warnings / infos, click opens the object) — the Asset tab maps its findings onto it unchanged, the Hazard tab shows it below the table (click opens the hazard dialog); hazard validator and relation service yield coded findings (12 codes, `tabs.hazards.findings.*` EN / DE; edge findings name their hazard); phase indicators and Overview tooltip translated; `errors` / `warnings` keep the English sentences word for word (not stored in the file) |
| FX-2 | audit commit: check out the branch first, then stage the project file | **done** (patch 41): `runCommitFlow` creates / checks out the branch, then stages, commits, pushes; a failed switch leaves nothing staged on the old branch (before: the project file stayed staged there and went into the next plain `git commit`); tests for the order and for a failed checkout / branch creation |
| FX-3 | report shows rejection reasons | **done** (patch 42): risk tables (Markdown, AsciiDoc, HTML, StrictDoc, PDF) and the attack-path threat chapter list rejected mitigations after the active ones as "Rejected: ID — text · Reason: …" (analyst reason and / or "Ticket KEY closed as RESOLUTION"; "none given" when missing), in the report language; before they were dropped. Residual risk unchanged |
| FX-4 | risk-tab validation messages (`riskService.validate`) via i18n | **done** (patch 43): `riskFindings` returns codes with count and named ids; toolbar chip tooltip and phase indicators translate them (EN / DE, singular / plural, `tabs.risks.findings.*`); `validate` renders the same English sentences as before from the findings, so `risks.validation` in the file is unchanged (schema 13 closed — a coded stored form would be schema 14) |
| FX-5 | relink helper for goals / claims orphaned by a renamed attack-tree node (pathKey) | **done** (patch 46): "Goals & Claims" shows each dead link of a goal / claim with "Re-link to …" (attack-path risks of the same tree and STRIDE category the item does not have yet; paths no goal / claim of that kind covers first) and "Remove link"; no automatic relink — a renamed step may be another scenario (path identity rule); `services/concept-relink.ts` reads the tree / STRIDE match from the candidate's own id |
| FX-6 | AND-gate paths: one path per AND gate (combined feasibility) — schema-13 step with the per-file report (K-9) | **done** (patch 32): one path per combination of an AND gate's steps (minimal cut set; OR below the gate multiplied out), feasibility of the gate over that combination, key from the sorted legs; S13-c carries assessments (merged; disagreement kept for review), risks (renamed / merged with review note) and goal / claim risk ids over; analysis changed only for files with an AND gate · follow-up after the release review (patch 49): a step without assessment is "not assessed", never "not relevant" — the combination is relevant, the old assessments stay for review; every carried risk notes its origin; threat ids through `buildThreatId`; golden test pins the step's output for a frozen schema-12 file (OR below AND) |
| FX-7 | threat catalog context keys the matcher ignores: `matchesContext` does not read `physicalPathProtection`, so the condition `physicalPathProtection: ["none"]` in `threats-physical.json` has no effect (found with MS-1, 2026-11-02) — a guard test for unknown context keys, then decide per key (wire it in — changes threats, R-2 note in the release notes — or drop it from the catalog). Same check for **unset values** (found with FF-1, 2026-11-03): a condition such as `accessMode: ["read_write"]` (threats-tampering, embedded) drops the threat when the flow leaves the property unset — against "unset = unknown, never safe" (R-1); decide with the R-2 note. **Must be in 0.18** (user 2026-11-03) | **done** (patch 33): `matchesContext` reads `physicalPathProtection` (multi-select) and `encryptionInTransit`; keys that name a missing / weak control match an unset property as the weak value (`accountManagement`, `authenticatorStorage` only where the element authenticates); selector keys still need a value; templates matched by facts rank before those matched by an assumption; guard test: every catalog key is read. Effect on the examples: a few template switches (SmokeDetector 2, Pump Station 2, Simple 2, Headlamp 1, CNC 5, Vareo 0), no new or vanished threats — **release note (R-2)**: regenerated threats may name the weak-control variant |
| FX-8 | cross-project writes, rest (follow-up of the 0.17.2 fixes): the writing workspace handlers still resolved "the active project" | **done** (patch 44): DFD, threats, assumptions, compliance, concept, documentation, integration and project-mitigation merge handlers move into `app/hooks/use-project-update-handlers.ts`, pinned to the project id like assets / hazards / risks / audit (a DFD save flushed on unmount after a switch wrote into the incoming project); `ThreatsTab` keyed per project; tests: handlers of A write into A after the switch, read A's latest state, write nothing for a closed project (4 of 6 fail with the old resolution) |
| I18N-1 | split `common.json` into `overview.json` / `common.json` (insert / move keys textually, never re-dump the JSON) | **done** (patch 47): `verificationStatus`, `overviewViews`, `itemDefinition`, `sourceBinding` cut textually from `common.json` into a new `overview.json` (EN / DE; `common.json` has deletions only, every text identical — checked by script); namespace `overview` in NAMESPACES / resources / fallbackNS of the app and of the CLI reporter, so no `t()` call changed; tests: each key in one file only, EN / DE parity, both setups resolve the moved keys |

### 3.4 Release

| Step | Content | Owner | Status |
|---|---|---|---|
| R-1 | `TESTPLAN-0.18.md` (repo root, untracked; one section per step), CHANGELOG, release note `doc/release-notes/v0.18.0-beta.md`, README, version 0.18.0-beta; finished design docs → `doc/Done` | A, after the user ran the test plan | **done** (patch 48): CHANGELOG 0.18.0-beta (incl. the R-2 notes: AND-gate conversion FX-6, catalog matcher FX-7, trackers in preview), release note, README (version, schema 13, trackers, EN 50742 A, release list), version 0.18.0-beta; this plan → `doc/Done/Release`; committed after the user's test run |

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
