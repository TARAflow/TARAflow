# TARAflow — Hazard import: extensions for ISO 12100 risk assessments

**Status:** v2 · 2026-10-25 · decisions taken (§5), implementation on branch
`feature/hazard-import-iso12100` · base: `main` after v0.15.0-beta (schema 10)
**Scope:** `features/hazards` (importer, import profile, bridge), `shared/models`
**Related:** `taraflow-feature-spec-safety-hazard-import-v2.md` (importer architecture),
`doc/taraflow-safety-model.md` (canonical severity scale),
`doc/InProgress/RegulationCompliance/iso-21434-conformance-implementation-plan.md`
(Phase 1H: `"none"` on the person edge)

---

## 1. Goal

So far the profile importer has been tested with a single customer file. A second,
typical risk assessment according to EN ISO 12100 / EN ISO 13849-1 (machine building,
47 hazards) shows gaps through which an import either yields **no severity at all** or
loses information. This document describes the changes needed so that such assessments
import completely, without manual rework.

The customer file itself is **not** added to the repository (customer data, GPL repo).
Tests use an anonymised fixture with the same structure (§7).

## 2. Structure of the test file

Columns (one row per hazard, reference numbers with sub-items such as `7.1`):

| Column | Content | Importer today |
|---|---|---|
| Ref. no. | `1`, `2.1`, `13.10` | `id` ✓ |
| Lifecycle phase | transport, commissioning, machine in operation, … (several) | – (`metaColumns` only) |
| Hazard zone | component / station ("clamps", "glue unit nozzle") | – (`metaColumns` only) |
| Hazard type | free text ("crushing, shearing", "electric shock") | `hazardCategory` via `valueMap` |
| Description | free text | `description` ✓ |
| Standards | e.g. "EN ISO 13855" | `sourceNorm` ✓ |
| AW 1–5 | probability of occurrence | `probability` ✓, **discarded by the bridge** |
| VS 1–4 | severity of injury | `severity`, **lossy** (§3.2) |
| RPZ | AW × VS | `rpn` ✓, **discarded by the bridge** |
| S / F / P / PLr | risk graph EN ISO 13849-1 Annex A | – |
| Protective measures | free text | – (`metaColumns` only) |
| Residual risks | free text | `notes` → `rationale` with a hard-coded prefix |
| Affected persons | **not in the document** | `affectedPersons` |

## 3. Findings (checked against the code)

### 3.1 Without "affected persons" there is no severity (blocking)

`hazard-bridge.ts` creates the `endangers` edges — and with them the severity — only
from `affectedPersons` (l. ~123). Without that column the import creates Hazard Items
without a person edge; the severity from VS is lost entirely. For the test file:
47 Hazard Items, 0 edges.

### 3.2 The intermediate scale loses levels

The importer maps via `HazardSeverity` (`negligible | marginal | critical |
catastrophic`, `safety-hazard-types.ts`) and then `SEVERITY_TO_HUMAN`
(`hazard-bridge.ts` l. 35) onto the canonical scale:

| Intermediate | Canonical | Problem |
|---|---|---|
| `negligible` ("no personal injury") | `reversible_minor` | contradicts its own comment; "no injury" becomes an injury |
| `marginal` | `reversible_minor` | collapses with `negligible` |
| `critical` | `irreversible_major` | – |
| `catastrophic` | `fatal` | – |

`none`, `reversible_major` and `irreversible_minor` cannot be reached. The canonical
scale (`SafetyImpact` = `none` + 5 levels, since schema 9) covers all of them. **TARAflow
does not need a new scale; only the importer has to use the existing one.**

### 3.3 Probability and RPN are lost

`SafetyHazard.probability` and `.rpn` are read but not carried into the `HazardItem` by
the bridge (no field, not in `importMeta`). After the import it is no longer traceable
how the customer rated the hazard.

### 3.4 Hard-coded German text in stored data

`rationale: \`Restrisiken: ${h.notes}\`` (`hazard-bridge.ts` l. 118) writes a German
prefix into the project file. This violates "all user-facing text via i18n" and is wrong
in English projects.

### 3.5 Separator for persons

`apply-import-profile.ts` l. 49 splits `affectedPersons` at `,` **and** `/`. A role such
as "Bediener/Einrichter" (operator/setter) becomes two persons.

### 3.6 Two severities in one row

The file contains VS (risk assessment, 4 levels) **and** S1/S2 (13849 risk graph). In 6
of 47 rows they contradict the document's own legend (VS 1–2 = S1, VS 3–4 = S2). The
importer reads only one severity and does not notice the contradiction.

### 3.7 Import profiles are not stored

The profile dialog offers "saved profiles" and "save profile", but neither is wired
(`hazard-tab.tsx`: `savedProfiles` / `onSaveProfile` commented out, "später:
Profil-Store"). A profile lives only while the dialog is open; the next import of the
same customer template starts from scratch.

### 3.8 A second import duplicates everything

`hazard-tab.tsx` appends the imported items and relations to the existing ones
(`hazards: [...hazardData.hazards, ...outcome.items]`). Re-importing a revised sheet
yields every hazard twice; changes in the sheet cannot be carried into the project.

### 3.9 A missing severity becomes an injury

`finalizeImport` coerces a missing or unknown severity to `marginal`, which the bridge
maps to `reversible_minor` — an invented injury on the person edge, with only a warning.
With a default person (HI-2) this would happen for every row without a severity.

### 3.10 No value map for a single column

The profile dialog maps values only in an x-matrix (one column per level). A single
column — "VS" with 1…4, "Hazard type" with free words — is read as it is: the
`valueMap` of `FieldColumnMapping` exists, but no part of the dialog sets it. Such a
severity is unknown and, since HI-11, creates no edge. HI-1 therefore includes a
value-map editor.

### 3.11 The column suggestion never used its aliases

`suggestProfile` read the header aliases under `tabs.hazards.import.aliases`; the
locale files keep them under `tabs.hazards.aliases`. No alias was ever found — only a
heading containing the English field name itself was recognised. Fixed with HI-10b;
a test runs the suggestion through the app's own i18n set-up.

## 4. Requirements

| ID | Requirement | Prio |
|---|---|---|
| HI-1 | **Canonical severity:** the profile field `severity` maps directly onto `SafetyImpact` (`none`, `reversible_minor`, `reversible_major`, `irreversible_minor`, `irreversible_major`, `fatal`). Dropdown and marker groups in the profile dialog offer these six values (i18n labels from `common: safetySeverity.*`). `"none"` only after HI-1b. | MUST |
| HI-1a | **Backward compatible:** the old values (`negligible`, `marginal`, `critical`, `catastrophic`) stay valid input — the TARAflow JSON / CSV / spreadsheet adapters read them, and a `valueMap` may still produce them; they map as before (`SEVERITY_TO_HUMAN` stays as legacy mapping). Hazard Items already imported do not change. No "old profile" notice: profiles are stored only from HI-9 on, after HI-1, so no stored profile can contain old values (§3.7). | MUST |
| HI-1b | **`none` = S0 / "no injury":** only once Phase 1H of the ISO plan has extended `HumanHarmSeverity` by `"none"` (including the `isHazardTarget` change). Then `none` creates a person edge with `severity: "none"`. Until then the dialog does not offer `none`. | MUST (after 1H) |
| HI-2 | **Default person in the profile:** `ImportProfile.defaultAffectedPersons?: string[]`. Applies to rows without a value in the person column, or when no column is mapped. The dialog warns when neither a column nor a default is set ("without an affected person no severity is imported"). | MUST |
| HI-3 | **Configurable separator:** `ImportProfile.listSeparator` (default `",/"` = today's behaviour). Applies to `affectedPersons` and the new multi-value fields (HI-5). | SHOULD |
| HI-4 | **Keep the customer's rating:** `probability` and `rpn` are stored in `HazardItem.importMeta` under fixed keys (`probability`, `rpn`), plus the raw source values (`severity.raw`, `probability.raw`). No model change. Shown in the hazard dialog under "Imported rating" (i18n). | MUST |
| HI-5 | **New canonical fields** (selectable in the profile dialog, stored in `importMeta` under fixed keys, i18n labels): `lifecyclePhase` (multi), `hazardZone`, `protectiveMeasures`, `protectiveMeasureType` (`inherent` / `technical` / `information` / `combined`, ISO 12100 three-step method), `residualRisk`, `riskGraphS`, `riskGraphF`, `riskGraphP`, `plRequired` (a–e), `plAchieved` (a–e), `safetyFunction`. | MUST |
| HI-6 | **No text in data:** the `Restrisiken:` prefix is dropped; `notes`/`residualRisk` is stored as `importMeta.residualRisk`, the label comes from i18n. Existing `rationale` texts stay unchanged (no migration). | MUST |
| HI-7 | **Plausibility warning VS ↔ S:** if both `severity` and `riskGraphS` are mapped, the import warns per row when `severity ∈ {reversible_*}` and `S = S2`, or `severity ∈ {irreversible_*, fatal}` and `S = S1`. Warning only — no abort, no value is changed. | SHOULD |
| HI-8 | **Hazard category:** the profile dialog pre-fills the `valueMap` of the hazard-category column from keywords (e.g. quetsch/scher/stoss, crush/shear/cut → `mechanical`; stromschlag, electric → `electrical`; verbrenn/brand, burn/fire → `thermal`; atem/staub/dampf, breath/dust/vapour → `material_substance`; lärm, noise → `noise`; strahlung, radiation → `radiation`; also vibration, ergonomic). The keywords live in the locale files, one list per language (`tabs.hazards.categoryKeywords`), and a cell is matched against every language the app offers. Exactly one category hit is a suggestion (marked "suggested"); several hits are **ambiguous and left to the analyst** (shown with their candidates — `combined` stays a manual choice); none leaves the value as it is. A stored mapping is never overwritten. The analyst can change every mapping. | COULD |
| HI-9 | **Profiles in the project file:** `hazards.importProfiles: ImportProfile[]`. A profile also records its source — file name, sheet and a snapshot of the header row at the last import — and when it was last used. Saved on import (and with "save profile"); the dialog offers the project's profiles. No schema fence (§5 D4). Imported Hazard Items record their profile (`importMeta.profileId`). | MUST |
| HI-10 | **Re-import with reconciliation:** importing a file for which a stored profile matches (same file name or same header signature) proposes that profile and shows how the sheet changed against the header snapshot — columns added, removed or renamed, columns not yet mapped; the analyst adjusts or extends the profile, the change is stored. Rows are reconciled by profile and row id (`externalRef`) instead of appended; a preview shows **new / changed / unchanged / removed** (as the threat regeneration dialog). New → created. Changed → imported fields (description, hazard type, physical hazard potential, `importMeta`) and the import-derived person edges (`provenance: "derived"`) are updated, the item is flagged for review. Unchanged → untouched. Removed from the sheet → kept and flagged "removed from source", never deleted automatically. The flags live in `importMeta` (`importStatus`, `importStatusSince`), not in new item fields (§5 D4). Analyst-owned data stays: label, rationale, combination type, manual edges, bowtie assignments. | MUST |
| HI-11 | **No invented severity:** a row with a missing or unknown severity is imported as a Hazard Item **without** a person edge, with one warning per row ("severity missing — assign it in the bowtie"); also when a default person applies. Replaces the coercion to `marginal` (§3.9). | MUST |

**Deliberately out of scope:** safety function and PLr as objects of their own (e.g. a
safety-function asset carrying the PLr, the protective measure as a mitigation). HI-5
stores them as structured import metadata so nothing is lost. The modelling (safety
function = asset per EN 50742 Approach A, protective measure as evidence per
`safety-feasibility-coupling-design.md`) is a separate decision.

## 5. Decisions (2026-10-25)

| # | Question | Decision |
|---|---|---|
| D1 (O1) | Where are import profiles persisted? | Today nowhere (§3.7). From HI-9 on **in the project file** — the profile travels with the project, is versioned and audited, and a re-import of a revised sheet can be compared with it (user). |
| D2 (O2) | Is `importMeta: Record<string, string>` enough for multi-value fields? | Yes: comma-separated, split for display. New keys in the existing map are no new field — no schema fence for HI-4 / HI-5. |
| D3 (O3) | Propose affected persons from `lifecyclePhase`? | No. The mapping belongs to the analyst. |
| D4 | Schema | **No schema fence** (user, 2026-10-25 — schema 10 shipped the day before). K7 fences against an older release dropping new fields on save; that cannot happen here: every hazard write path of 0.15.0-beta spreads the existing object (hazard service, import, asset purge, hazard reference repair, `prepareForDisk`, write channel), so `hazards.importProfiles` and keys in `importMeta` survive. HI-10 keeps its flags in `importMeta` for the same reason — the only new field is `importProfiles`. An older release keeps the data but does not show it; a re-import there appends as today. Guarded by `hazard-data-passthrough.test.ts`; ISO plan decision 15 refined accordingly. |
| D5 | Missing severity | HI-11: no edge, warning (user). |
| D6 | HI-8 | In scope, as the last step before HI-1b (user). Ambiguous cells are assigned by hand, not set to `combined` (user); keywords translated in every available language, enforced by a test (user). Only the profile dialog uses them — the import paths without a dialog (TARAflow JSON, CSV by column name) keep "other" + warning: a suggestion nobody sees would be an unreviewed mapping. Matching: keywords of ≥ 5 characters inside a word (compounds), shorter ones whole words, a trailing `*` marks a word start. |

## 6. Implementation (each commit works on its own)

1. `fix(hazards): keep imported probability and RPN` — HI-4, with the "Imported data"
   section in the hazard dialog (today `importMeta` is shown nowhere).
2. `fix(hazards): no hard-coded text in imported rationale` — HI-6.
3. `fix(hazards): no invented severity on import` — HI-11.
4. `feat(hazards): import severity on the canonical scale` — HI-1, HI-1a.
5. `feat(hazards): default affected persons and list separator` — HI-2, HI-3.
6. `feat(hazards): import ISO 12100 / 13849 fields` — HI-5, HI-7.
7. `feat(hazards): import profiles in the project file` — HI-9, schema fence.
8. `feat(hazards): re-import with reconciliation` — HI-10.
9. `feat(hazards): keyword suggestions for the hazard category` — HI-8.
10. `feat(hazards): import "none" as no injury` — HI-1b, **after** Phase 1H of the ISO plan.

## 7. Acceptance tests

Fixture: an anonymised table with the structure of §2 (same columns, invented machine),
with one row per severity level, multi-value cells, one row without an affected person
and two rows with a VS/S contradiction.

| Req. | Test |
|---|---|
| HI-1 | VS mapping 1→`reversible_minor`, 2→`reversible_major`, 3→`irreversible_minor`, 4→`irreversible_major`, 5→`fatal` yields exactly these edge severities. |
| HI-1a | Input with `negligible/marginal/critical/catastrophic` (JSON adapter and `valueMap`) imports as before the change (golden comparison). |
| HI-1b | After 1H: `none` yields a person edge `severity: "none"`; the target asset is not safety-relevant. |
| HI-2 | No person column, default "operator": every hazard has an edge to the asset "operator". No column and no default: dialog notice before the import. |
| HI-3 | `listSeparator: ","`: "Bediener/Einrichter" stays one person. Default: behaviour as today. |
| HI-4 | AW and RPZ are in `importMeta` and in the hazard dialog after the import. |
| HI-5 | All HI-5 fields appear with an i18n label in the hazard dialog; multi-values as separate chips. |
| HI-6 | Newly imported items contain no "Restrisiken:"; labels en/de exist. |
| HI-7 | The two contradicting rows of the fixture each produce one warning, no other row does. |
| HI-8 | "Quetschen, Stoss" → `mechanical`; "electric shock" → `electrical`; a cell with two categories ("Quetschen, Stromschlag") is not pre-filled and names both; "photo", "gasket", "Gebrauch", "shearing" give no false hit; every language has keywords for every category and each keyword alone suggests its own category; a stored mapping is not overwritten. |
| HI-9 | After an import the profile is in `hazards.importProfiles` with file name, sheet and header snapshot; reopening the project offers it; unknown fields under `hazards` survive every write path (pass-through test, D4). |
| HI-10 | Re-import of the fixture with one row changed, one added, one removed and one new column: preview shows 1 new / 1 changed / 1 removed / rest unchanged and the new column as unmapped; after confirming no duplicates, the changed item is flagged, the removed one flagged and kept, a manual edge and a renamed label survive. |
| HI-11 | A row without severity, with a default person: item imported, no person edge, one warning. |
| all | Projects without a hazard import, and items already imported, stay byte-identical. |

## 8. Implementation status

| Step | Content | Patch | State |
|---|---|---|---|
| 1 | HI-4: the profile import keeps the source values of severity and probability (`severity.raw`, `probability.raw` — the cell before the value map, or the header label of the marked x-matrix column); the bridge keeps `probability` and `rpn` in `importMeta`. Hazard dialog: read-only "Imported data" block (source row, rating, extra columns; i18n en/de). Fixture `src/tests/fixtures/hazards/label-applicator-iso12100.json` (invented machine, structure of §2). | 154 | done |
| 2 | HI-6: no `Restrisiken:` prefix — the source's residual-risk note goes to `importMeta.residualRisk` ("Residual risk (source)" in the dialog, en/de); the importer sets no rationale. Existing rationales unchanged. | 155 | done |
| 3 | HI-11: a missing or unknown severity stays undefined (`SafetyHazard.severity` optional) with a warning "no person edge; assign the severity in the bowtie"; the bridge creates no endangers edge for it (and no "no affected person" hint). Steps 2 and 3 in one patch (user). | 155 | done |
| 4 | HI-1: the profile offers the canonical levels `reversible_minor … fatal` (`SEVERITY_OPTIONS = SAFETY_SEVERITIES`, labels from `safetySeverity.*`); value-map editor for a single mapped column of severity, probability and hazard category — one row per distinct value of the column, "—" keeps the value as it is (§3.10); x-matrix and preview show the labels. HI-1a: `HazardSeverity` = canonical scale or the legacy values; the importer accepts both, the bridge passes canonical values through and maps legacy ones as before (golden test). No "old profile" notice (D1). | 156 | done |
| 5 | HI-2: `ImportProfile.defaultAffectedPersons` — rows without a person (or no person column) get the default; the dialog has the field (comma-separated) and warns when neither a column nor a default is set. HI-3: `ImportProfile.listSeparator` (default `",/"`, `splitList`), used for affected persons. The imported person edge carries no rationale text any more ("Imported affected person: …", user); `provenance: "derived"` marks it. | 157 | done |
| 6 | HI-5: profile fields `lifecyclePhase` (multi-value, split with the list separator, stored "a, b", chips in the dialog), `hazardZone`, `protectiveMeasures`, `protectiveMeasureType` (inherent / technical / information / combined), `riskGraphS/F/P` (S1/S2 …), `plRequired`, `plAchieved` (a–e), `safetyFunction` — in `importMeta` under the field name, i18n labels en/de; the ones with fixed values have the value-map editor and the x-matrix; header aliases en/de (none for S / F / P: one letter would match nearly every heading). The residual risk stays the existing `notes` field (stored as `importMeta.residualRisk` since HI-6) instead of a second field. HI-7: warning per row when a reversible severity meets S2 or an irreversible / fatal one meets S1 (legacy values by their mapping); nothing changed. | 158 | done |
| 7 | HI-9: `HazardData.importProfiles` (`StoredImportProfile` = profile + `source` {file, sheet, header row} + `lastUsed`); stored on every profile import and with "save profile" (`import-profile-store.ts`); the dialog offers the project's profiles ("load profile"; the default-persons field follows a loaded profile); imported items carry `importMeta.profileId` (not shown in the dialog). No schema fence (D4): `hazard-data-passthrough.test.ts` checks that unknown hazard fields survive hazard service, reference repair, asset purge, write channel and disk form. | 159 | done |
| 8a | HI-10, part 1 — recognition and column tracking (`import-profile-tracking.ts`): a stored profile matches by file name (case-insensitive), else by its header row (≥ 60 % of the stored headings, searched in the first 15 rows — rows inserted above move it). Mapped columns are found again by heading and follow automatically (user); a column whose heading is gone is placed by its found neighbours (consistent gap → renamed) or dropped (removed); new headings are reported as added; a moved header row shifts header and data start. The dialog starts from the tracked profile and lists every change (en/de). | 160 | done |
| 8b | HI-10, part 2 — row reconciliation (`hazard-reimport.ts`): items of the profile (of the same file when the profile served several, `importMeta.sourceFile`) matched by row id; preview dialog new / changed / unchanged / removed with the choice "update existing" or "import as additional" (additional preselected for another file name, user). Update: changed rows update description, type, physical hazard potential, `importMeta` and the import-derived person edges and are flagged (`importMeta.importStatus` / `importStatusSince`); the label follows only while the analyst has not changed it; removed rows are kept and flagged; a row that comes back clears its flag; rationale, combination, manual and cause edges stay. Marker chip in the hazard table, notice with "Reviewed" in the hazard dialog (user). Also: the alias key of the column suggestion (§3.11) and German aliases (Lebensdauerphase, RPZ, Restgefahren, Art der Schutzmassnahme). Checked with a customer risk assessment (not in the repo): 47 hazards, 127 person edges to 6 persons, all severity levels, 6 VS/S warnings (as the sheet's own note says), 13 columns suggested automatically, a second import of the same file all unchanged. | 161 | done |
| 9 | HI-8: `hazard-category-keywords.ts` (`suggestHazardCategory`, `prefillCategoryMap`), keywords en/de in the locale files; the profile dialog pre-fills on assigning the category column and for a recognised profile (unmapped values only), the value-map editor marks "suggested" and names the candidates of an ambiguous value. Header aliases now also use every available language (`LANGUAGE_CODES`) instead of a fixed `en`/`de`. Checked with a customer sheet: 19 free hazard types → 15 suggested, 3 ambiguous (real combinations), 1 open. | 162 | done |
| 10 | HI-1b (after ISO Phase 1H) | – | open |
