# Custom threats in the closed loop — project mitigation catalog

**Status:** v1 · 2026-10-29 · decisions taken (§3) · branch `feature/iso21434-item-definition`,
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

Side finding for the closed-loop step (not part of this design): the derivation treats
`"none"` as empty, so an expected value `"none"` (Interface
`implementedControls.serviceAccessPolicy`) can never be "implemented".

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
  `isCustom: true`. Ids `M-C-nnn`, never reused.
- **Effects editor:** target (the element itself; for interaction threats channel /
  source / target), property and value chosen from the catalog vocabulary (finding 5).
  Confidence fixed to `heuristic` (analyst-defined). No free property names in this step.
- **Resolution:** one function `mitigationCatalogOf(project)` = built-in + project entries;
  the derivation, drift, coverage, mapper, risk dialog, Jira export and report generators
  (app and CLI) take it instead of `getAllMitigations()`.
- **Delete:** only when no threat and no risk uses the entry; merge rewrites the ids in
  threats and risks.
- **Custom verifications:** out of scope (no DFD effect).
- **Audit:** the audit diff must show added / changed / removed project mitigations.

## 4. Steps

| Step | Content | Patch | Status |
|---|---|---|---|
| CM-1 | Bug fix: create dialog stores catalog ids (a picked mitigation brings its catalog verifications); edit dialog: "Add from catalog" (threat's STRIDE category) and remove for catalog entries — manual threats only, a generated threat's list is rebuilt by its template; "Link to …" for free text equal to a catalog text (mitigations and verifications, whitespace-insensitive); manual threats get the "already implemented" flags on regeneration — only for entries on their list, nothing appended; interaction threats: both ends count (the perspective is not stored). `catalog-draft-ops.ts`, `catalog-entry-picker.tsx`, `refreshImplementedFlags`, `mergeGeneratedTables({ manualHints })` | 189 | done |
| CM-2 | Model and resolution: `customMitigations` entries, `M-C-nnn`, `mitigationCatalogOf(project)` in every consumer (app, CLI); persistence and audit diff | – | open |
| CM-3 | UI: "New catalog mitigation" (create / edit threat dialog) with effects editor; "Convert to catalog mitigation"; list in the threat configuration dialog (edit, merge, delete unused) | – | open |
| CM-4 | Closed loop end-to-end: SHOULD / drift / coverage / already implemented for `M-C` ids, report text (all formats, CLI); test with a manual threat on the SmokeDetector | – | open |
