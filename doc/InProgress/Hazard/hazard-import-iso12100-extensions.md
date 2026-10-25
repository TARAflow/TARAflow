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
| HI-8 | **Hazard category:** the profile dialog offers a pre-filled `valueMap` for German and English keywords (quetsch/scher/stoss/schneid/einklemm, crush/shear/impact/cut/trap → `mechanical`; strom, electric → `electrical`; verbrenn/brand, burn/fire → `thermal`; atem/staub/dampf, breath/dust/vapour → `material_substance`; lärm, noise → `noise`; strahlung, radiation → `radiation`); several hits → `combined`. The analyst can change every mapping. | COULD |
| HI-9 | **Profiles in the project file:** `hazards.importProfiles: ImportProfile[]`. A profile also records its source — file name, sheet and a snapshot of the header row at the last import — and when it was last used. Saved on import (and with "save profile"); the dialog offers the project's profiles. New field → schema fence (K7, §5 D4). Imported Hazard Items record their profile (`importMeta.profileId`). | MUST |
| HI-10 | **Re-import with reconciliation:** importing a file for which a stored profile matches (same file name or same header signature) proposes that profile and shows how the sheet changed against the header snapshot — columns added, removed or renamed, columns not yet mapped; the analyst adjusts or extends the profile, the change is stored. Rows are reconciled by profile and row id (`externalRef`) instead of appended; a preview shows **new / changed / unchanged / removed** (as the threat regeneration dialog). New → created. Changed → imported fields (description, hazard type, physical hazard potential, `importMeta`) and the import-derived person edges (`provenance: "derived"`) are updated, the item is flagged for review. Unchanged → untouched. Removed from the sheet → kept and flagged "removed from source", never deleted automatically. Analyst-owned data stays: label, rationale, combination type, manual edges, bowtie assignments. | MUST |
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
| D4 | Schema | HI-9 / HI-10 store new fields (`hazards.importProfiles`, the review / removed flags on Hazard Items) → schema fence per K7. The ISO plan reserves schema 11 for 1H-S; one number per release — if both ship together they share 11, otherwise the later release takes 12. |
| D5 | Missing severity | HI-11: no edge, warning (user). |
| D6 | HI-8 | In scope, as the last step before HI-1b (user). |

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
| HI-8 | "Quetschen, Scheren" → `mechanical`; "electric shock" → `electrical`; a cell with two keyword groups → `combined`; an analyst override of the pre-filled map wins. |
| HI-9 | After an import the profile is in `hazards.importProfiles` with file name, sheet and header snapshot; reopening the project offers it; an older TARAflow refuses the file (schema fence). |
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
| 5 | HI-2, HI-3; also the edge rationale "Imported affected person: <role>" (English text in stored data, same class as HI-6 — user 2026-10-25) | – | open |
| 6 | HI-5, HI-7 | – | open |
| 7 | HI-9 | – | open |
| 8 | HI-10 | – | open |
| 9 | HI-8 | – | open |
| 10 | HI-1b (after ISO Phase 1H) | – | open |
