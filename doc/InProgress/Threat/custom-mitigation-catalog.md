# Custom threats in the closed loop — project mitigation catalog

**Status:** v2 · 2026-10-29 · CM-1 … CM-4 done (§4) · branch `feature/iso21434-item-definition`,
release 0.16.0-beta (schema 11 fence already in place)
**Origin:** user request 2026-10-27: "self-defined threats need a link to the security
properties so that the closed loop also works for them".

---

## 1. How the closed loop works today

The closed loop compares, per DFD element property, what the risk decisions require
(SHOULD), what was applied (WAS) and what the element carries (IS):

| Step | Code | Input |
|---|---|---|
| SHOULD | `app/hooks/use-control-instance-derivation.ts` | risk → `selectedMitigations[].id` → catalog `MitigationEntry.affectsProperties` (target type, role, property, expected value) → element of the threat |
| WAS / IS, drift | `app/hooks/use-security-drift.ts` | `securityControlOwnership` on the element, `element.properties` |
| "already implemented" | `threats/services/implemented-controls-mapper.ts`, threat sync | element properties → `MitigationDraft.alreadyImplemented` for catalog ids |
| Coverage | `threat-dialog.tsx` `computeAllMitigationCoverage` | `proposedMitigations[].id` |

Everything is keyed by the **catalog id**. The link to the security properties is the
catalog entry's `affectsProperties`.

## 2. Findings

1. **Free-text mitigations have no link.** A mitigation the analyst writes is stored as
   `{ notes }` without an id (`MitigationDraft`, `SelectedMitigation`). It never yields a
   SHOULD, never becomes "already implemented", never shows coverage.
2. **Bug — catalog picks lose their id.** "Create threat" offers the catalog entries of
   the STRIDE category, but stores the picked *text*:
   `threat.proposedMitigations = mitigations.map((notes) => ({ notes }))`
   (`create-threat-dialog.tsx`). A manual threat therefore never reaches the closed loop,
   even with catalog mitigations. The edit dialog (`threat-dialog.tsx`) can only add free
   text.
3. **Manual threats never get "already implemented".** The flags are computed only when
   threats are regenerated (`getImplementedMitigationHints` / `mergeMitigationHints`,
   `mergeProposedMitigations` takes them from the fresh threat); manual threats are
   re-attached unchanged (`threat-identity.ts`).
4. `threats.configuration.customMitigations: MitigationEntry[]` exists in the model but is
   unused (always `[]`); `getAllMitigations()` returns the built-in catalog only.
5. The effects of the 136 catalog mitigations use **56 target type × property pairs** with
   their expected values — the vocabulary the closed loop knows.

Side findings for the closed-loop step (not part of this design):
- an element whose property already carries **another non-empty value** (e.g. the
  default `inputValidation: "basic"`) yields drift status **conflict** for every
  SHOULD on it, although nothing was ever applied — a likely source of notifications
  "without any mitigation implemented" (pinned in the CM-4 integration test);
- the derivation treats `"none"` as empty, so an expected value `"none"` (Interface
  `implementedControls.serviceAccessPolicy`) can never be "implemented";
- the derivation looks up a risk's threat in the per-element / per-interaction tables
  only, so attack-path risks (threat ids `AT-…`) never yield a SHOULD.

## 3. Decisions (user 2026-10-29)

1. **Project mitigation catalog.** Own mitigations become project catalog entries
   `M-C-001 …` with text, STRIDE category, optional attack vectors and DFD effects
   (`affectsProperties`). Reusable across threats; selected by id, so every id-based path
   (SHOULD / drift, already implemented, coverage, Jira, report) works unchanged. Free
   text stays possible; it is marked "no DFD link — not in the closed loop" and offers
   **Convert to catalog mitigation**.
2. **Maintained at the threat and in a list.** "New catalog mitigation" in the threat
   dialogs (create and edit); an overview in the threat configuration dialog to edit,
   merge and delete unused entries.
3. **The id bug is fixed in the first step.** Catalog picks store the id; the edit dialog
   gets the catalog selection too. Existing manual threats whose free text equals a
   catalog text get a one-click **Link to M-x-nnn** in the edit dialog [D: proposed, not
   automatic on load — the analyst may have meant the text only].

Further design choices [D] (to confirm in review):

- **Storage:** `project.threats.configuration.customMitigations` (exists; older releases
  keep the field). Entry = `MitigationEntry` + `text` (and optional `description`),
  `isCustom: true` (`ProjectMitigation`). Ids `M-C-nnn`, never reused
  (`customMitigationSeq`).
- **Effects editor:** target (the element itself; for interaction threats channel /
  source / target), property and value chosen from the catalog vocabulary (finding 5).
  Confidence fixed to `heuristic` (analyst-defined). No free property names in this step.
- **Resolution** (revised in CM-2): the open project **registers** its entries with the
  catalog service (`setProjectMitigations` — app: workspace layout on project change;
  CLI: before generating). `getAllMitigations`, `getLocalizedMitigation` and
  `resolveMitigationDrafts` then include them, so the ~17 readers (derivation, drift,
  coverage, dialogs, Jira export, report generators) need no new parameter; readers that
  memoize the catalog depend on `useMitigationCatalogVersion()`. Generation keeps using
  the built-in catalog only (a generated threat's controls come from its template).
  Chosen over passing `mitigationCatalogOf(project)` to every reader: same result, a
  fraction of the change; the catalog was a module singleton already.
- **Delete:** only when no threat, risk or attack tree uses the entry; merge rewrites the
  ids in threats, risks and attack trees. Attack-tree DSL lists (`[M-001,M-C-001]`) are
  read and rewritten by the attacktree parser's own list reader (`dslMitigationIds`,
  `replaceDslMitigation`), never by a string search (review 2026-10-30, CM-5).
- **Custom verifications:** out of scope (no DFD effect).
- **Audit:** the audit diff must show added / changed / removed project mitigations.

## 4. Steps

| Step | Content | Patch | Status |
|---|---|---|---|
| CM-1 | Bug fix: create dialog stores catalog ids (a picked mitigation brings its catalog verifications); edit dialog: "Add from catalog" (threat's STRIDE category) and remove for catalog entries — manual threats only, a generated threat's list is rebuilt by its template; "Link to …" for free text equal to a catalog text (mitigations and verifications, whitespace-insensitive); manual threats get the "already implemented" flags on regeneration — only for entries on their list, nothing appended; interaction threats: both ends count (the perspective is not stored). `catalog-draft-ops.ts`, `catalog-entry-picker.tsx`, `refreshImplementedFlags`, `mergeGeneratedTables({ manualHints })` | 189 | done |
| CM-2 | Model and resolution: `ProjectMitigation`, `M-C-nnn` with `customMitigationSeq`, add / update / remove (`project-mitigations.ts`); registration with the catalog (app, CLI) and `useMitigationCatalogVersion`; usage across threats, risks and attack trees (`app/services/project-mitigation-usage.ts`); audit diff "Project mitigation"; the derivation is a pure `deriveControlInstances` (the hook memoizes it) | 190 | done |
| CM-3 | UI: "New project mitigation" in the create and edit threat dialogs, form with effects editor (target / property / value from the built-in vocabulary, `effectVocabulary`, always heuristic); "Convert to project mitigation" on free text; edit on the entry; list in the threat configuration dialog (usage, edit, merge, delete only unused; changes apply at once). Project mitigations work on **every** threat [D]: they are the analyst's choice, so regeneration keeps them (`mergeProposedMitigations`), and a generated threat's picker offers project mitigations only. Merge rewrites threats, risks, attack-tree path assessments and DSL refs (`mergeProjectMitigationRefs`). Fix on the way: the configuration dialog's Save rebuilt the configuration field by field and dropped unknown fields (now spreads it). | 191 | done |
| CM-4 | Closed loop end-to-end, integration test on the SmokeDetector DFD (`project-mitigation-closed-loop.int.test.ts`): a manual threat with M-C-001 and a risk selecting it → SHOULD (`deriveControlInstances`) → drift (`computeSecurityDrifts`, extracted as a pure function like the derivation) → coverage "already implemented" (`computeAllMitigationCoverage`) → usage. The report resolves the text (all formats via `resolveMitigationDrafts` / `getLocalizedMitigation`; CLI checked with a SmokeDetector copy in CM-2). No further code: the stored `MitigationDraft.alreadyImplemented` flag is not read by any view — "already implemented" comes from the coverage, which uses `affectsProperties` and so covers project mitigations. | 192 | done |
| CM-5 | Review 2026-10-30: the usage check found `[M-C-001]` only as a lone list — `[M-001,M-C-001]` let a used entry be deleted, and the merge left the reference behind. Both now go through the parser's list reader (`dslMitigationIds`, `replaceDslMitigation` in `attacktree-parser.ts`, the parser uses the same function); comments and node names never count | 210 | done |
