# TARAflow — Hazard import: extensions for ISO 12100 risk assessments

**Status:** Draft v1 · 2026-10-24 · base: `main` after v0.14.0-beta (schema 9)
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

## 4. Requirements

| ID | Requirement | Prio |
|---|---|---|
| HI-1 | **Canonical severity:** the profile field `severity` maps directly onto `SafetyImpact` (`none`, `reversible_minor`, `reversible_major`, `irreversible_minor`, `irreversible_major`, `fatal`). Dropdown and marker groups in the profile dialog offer these six values (i18n labels from `common: safetySeverity.*`). `"none"` only after HI-1b. | MUST |
| HI-1a | **Backward compatible:** saved profiles and `valueMap`s with the old values (`negligible`, `marginal`, `critical`, `catastrophic`) still load and map as before (`SEVERITY_TO_HUMAN` stays as legacy mapping). When an old profile is loaded the dialog shows a notice "old severity values, please re-map". Hazard Items already imported do not change. | MUST |
| HI-1b | **`none` = S0 / "no injury":** only once Phase 1H of the ISO plan has extended `HumanHarmSeverity` by `"none"` (including the `isHazardTarget` change). Then `none` creates a person edge with `severity: "none"`. Until then the dialog does not offer `none`. | MUST (after 1H) |
| HI-2 | **Default person in the profile:** `ImportProfile.defaultAffectedPersons?: string[]`. Applies to rows without a value in the person column, or when no column is mapped. The dialog warns when neither a column nor a default is set ("without an affected person no severity is imported"). | MUST |
| HI-3 | **Configurable separator:** `ImportProfile.listSeparator` (default `",/"` = today's behaviour). Applies to `affectedPersons` and the new multi-value fields (HI-5). | SHOULD |
| HI-4 | **Keep the customer's rating:** `probability` and `rpn` are stored in `HazardItem.importMeta` under fixed keys (`probability`, `rpn`), plus the raw source values (`severity.raw`, `probability.raw`). No model change. Shown in the hazard dialog under "Imported rating" (i18n). | MUST |
| HI-5 | **New canonical fields** (selectable in the profile dialog, stored in `importMeta` under fixed keys, i18n labels): `lifecyclePhase` (multi), `hazardZone`, `protectiveMeasures`, `protectiveMeasureType` (`inherent` / `technical` / `information` / `combined`, ISO 12100 three-step method), `residualRisk`, `riskGraphS`, `riskGraphF`, `riskGraphP`, `plRequired` (a–e), `plAchieved` (a–e), `safetyFunction`. | MUST |
| HI-6 | **No text in data:** the `Restrisiken:` prefix is dropped; `notes`/`residualRisk` is stored as `importMeta.residualRisk`, the label comes from i18n. Existing `rationale` texts stay unchanged (no migration). | MUST |
| HI-7 | **Plausibility warning VS ↔ S:** if both `severity` and `riskGraphS` are mapped, the import warns per row when `severity ∈ {reversible_*}` and `S = S2`, or `severity ∈ {irreversible_*, fatal}` and `S = S1`. Warning only — no abort, no value is changed. | SHOULD |
| HI-8 | **Hazard category:** the profile dialog offers a pre-filled `valueMap` for German and English keywords (quetsch/scher/stoss/schneid/einklemm, crush/shear/impact/cut/trap → `mechanical`; strom, electric → `electrical`; verbrenn/brand, burn/fire → `thermal`; atem/staub/dampf, breath/dust/vapour → `material_substance`; lärm, noise → `noise`; strahlung, radiation → `radiation`); several hits → `combined`. The analyst can change every mapping. | COULD |

**Deliberately out of scope:** safety function and PLr as objects of their own (e.g. a
safety-function asset carrying the PLr, the protective measure as a mitigation). HI-5
stores them as structured import metadata so nothing is lost. The modelling (safety
function = asset per EN 50742 Approach A, protective measure as evidence per
`safety-feasibility-coupling-design.md`) is a separate decision.

## 5. Open points

| # | Question | Proposal |
|---|---|---|
| O1 | Where are import profiles persisted (file export, localStorage, project file)? | Check before HI-2/HI-3. If they live in the project file, K7 (a) applies: new fields → schema fence. |
| O2 | `importMeta` is `Record<string, string>`. Is that enough for multi-value fields (`lifecyclePhase`)? | Yes: store comma-separated, split for display. No type change. |
| O3 | Should the import propose affected persons from `lifecyclePhase` (transport → transport staff, maintenance → maintenance staff, …)? | Not automatically. At most as a suggestion in the profile dialog; the mapping belongs to the analyst. |

## 6. Implementation (each commit works on its own)

1. `fix(hazards): keep imported probability and RPN` — HI-4.
2. `fix(hazards): no hard-coded text in imported rationale` — HI-6.
3. `feat(hazards): default affected persons in the import profile` — HI-2 (+ HI-3 once O1 is settled).
4. `feat(hazards): import severity on the canonical scale` — HI-1, HI-1a.
5. `feat(hazards): import ISO 12100 / 13849 fields` — HI-5 (+ HI-7).
6. `feat(hazards): keyword suggestions for the hazard category` — HI-8 (optional).
7. `feat(hazards): import "none" as no injury` — HI-1b, **after** Phase 1H of the ISO plan.

## 7. Acceptance tests

Fixture: an anonymised table with the structure of §2 (same columns, invented machine),
with one row per severity level, multi-value cells, one row without an affected person
and two rows with a VS/S contradiction.

| Req. | Test |
|---|---|
| HI-1 | VS mapping 1→`reversible_minor`, 2→`reversible_major`, 3→`irreversible_minor`, 4→`irreversible_major`, 5→`fatal` yields exactly these edge severities. |
| HI-1a | A profile with `negligible/marginal/critical/catastrophic` loads, shows the notice and imports as before the change (golden comparison). |
| HI-1b | After 1H: `none` yields a person edge `severity: "none"`; the target asset is not safety-relevant. |
| HI-2 | No person column, default "operator": every hazard has an edge to the asset "operator". No column and no default: dialog notice before the import. |
| HI-3 | `listSeparator: ","`: "Bediener/Einrichter" stays one person. Default: behaviour as today. |
| HI-4 | AW and RPZ are in `importMeta` and in the hazard dialog after the import. |
| HI-5 | All HI-5 fields appear with an i18n label in the hazard dialog; multi-values as separate chips. |
| HI-6 | Newly imported items contain no "Restrisiken:"; labels en/de exist. |
| HI-7 | The two contradicting rows of the fixture each produce one warning, no other row does. |
| all | Projects without a hazard import, and items already imported, stay byte-identical. |
