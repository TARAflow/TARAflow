# Regulation Presets — Design

> **Status:** proposal / not yet scheduled. This is a *future* feature. It is
> deliberately decoupled from Phase 5b-1, which introduces only the minimal
> `likelihoodModel` field it needs. The preset system, when built, becomes the
> thing that *sets* `likelihoodModel` (and much more) — but 5b-1 does not wait
> for it.
>
> **Relationship to the attack-tree/risk work:** the attack-tree design doc
> (v7) settles how tree likelihood enters a risk. This doc is orthogonal — it
> governs *which likelihood factors exist and how they combine* for a given
> regulatory context. Where they touch is named explicitly in §7.

---

## 1. The problem

Today a project's regulatory context lives in `ProjectTags.regulation` — a free
list of strings (`"ISO 21434"`, `"IEC 62443"`, `"CRA"`, …). Tags are a
**search / categorisation** feature (`flattenProjectTags`: "backwards-compat
checks, search, and validation counts"). They carry no behaviour.

But regulatory context is not merely a label. Each regime prescribes:

- **which likelihood factors are meaningful** — EN 50742 / the Machinery
  Regulation works in Window of Opportunity, Attacker Capability, Exposure
  Level; ISO 21434 works in the five ISO/IEC 18045 attack-potential factors
  (elapsed time, expertise, knowledge, window, equipment); OWASP works in its
  own eight;
- **how those factors combine into a likelihood** — attack potential (summed &
  banded) vs. a weighted mean vs. feasibility-only;
- **whether motivation/benefit may enter the risk at all** — forbidden under
  ISO 21434 Cl. 3.1.29, permitted under IEC 62443 / classic.

Encoding that as a free-text tag has three concrete failure modes in the current
data model:

1. **Non-exclusive.** `regulation: string[]` allows `["ISO 21434", "IEC 62443"]`
   at once. A calculation mode must be single-valued. Which wins is undefined.
2. **Free-editable without semantics.** `addTagToProject` accepts any string; a
   typo (`"ISO21434"` without the space) silently means "no regime".
3. **No default path.** A project with no regulation tag has no regime, but the
   calculation always needs one.

A regulatory regime is a **typed, exclusive, behaviour-bearing choice**. It
belongs in an enum with presets behind it, not in a string list.

## 2. What a preset is

A **regulation preset** bundles everything a regime prescribes:

```ts
interface RegulationPreset {
  id: RegulationPresetId;              // exclusive enum, not a free string
  label: string;                       // "ISO/SAE 21434", "EN 50742 (Machinery)"
  labelDE: string;

  /** The likelihood factors this regime activates (by factor id). */
  likelihoodFactorIds: string[];

  /** How those factors combine into a likelihood value. */
  likelihoodMethod:
    | "attack-potential"               // sum factors → band → level (ISO, EN 50742 Approach A / Annex B)
    | "weighted-mean"                   // OWASP-style average
    | "feasibility-only"               // likelihood IS feasibility
    | "not-applicable";                 // regime has no risk-derived likelihood (EN 50742 Approach B — see §10)

  /** Whether attacker benefit/motivation may enter the risk number. */
  motivationModel: "feasibility-only" | "feasibility-supplement" | "not-applicable";

  /** Which impact criteria the regime expects (Asset tab). Optional. */
  impactCriteriaIds?: string[];

  /** Free-text provenance for the report's methodology section. */
  normativeBasis: string;              // e.g. "ISO/SAE 21434 Annex G.2 / ISO-IEC 18045"
}
```

`motivationModel` uses the corrected naming (see §6): `feasibility-only` (ISO —
benefit never enters) vs. `feasibility-supplement` (benefit supplements, does
not multiply).

### Two initial presets (illustrative — calibrate factor sets on build)

| Preset | likelihoodMethod | likelihoodFactorIds | motivationModel | normativeBasis |
|---|---|---|---|---|
| **ISO 21434** | attack-potential | et, se, kn, wo, eq (the 18045 five) | feasibility-only | Annex G.2 / ISO-IEC 18045 |
| **EN 50742 — Approach A** | attack-potential | window_of_opportunity, attacker_capability, exposure_level | feasibility-supplement | prEN 50742, Clause 7.4.2 / Annex B |
| **EN 50742 — Approach B** | not-applicable | *(none)* | not-applicable | prEN 50742, Clause 8 / Tables 3+4 |
| **OWASP** (Standard default) | weighted-mean | the 8 OWASP likelihood factors | feasibility-supplement | OWASP Risk Rating |

**Note (corrected from an earlier draft of this doc):** Annex B (EL/WoO/AC → Attack
Potential → SRSL, Tables B.5/B.6) is referenced only from Clause 7.4.2 — i.e. only
Approach A uses it. Approach B (Clause 8, Tables 3+4) prescribes a fixed SL-C per
Foundational Requirement with no risk-derived likelihood step at all, so it carries
no likelihood factors and no attack-potential calculation. This is why EN 50742
became **two** presets (`en-50742-a`, `en-50742-b`) rather than one preset with an
internal approach switch — see §10.

The factor ids already exist in `risk-factor-types.ts`
(`EN50742_FACTORS`, the OWASP set, the attack-potential factors in
`attacktree-feasibility-types.ts`) — they were split out in anticipation of
exactly this. The preset system is what finally *activates* the right subset per
project instead of enabling them by hand.

## 3. Data model & where it lives

```ts
// shared/models/regulation-preset-types.ts (new)
export type RegulationPresetId =
  | "owasp"          // Standard default
  | "iso-21434"
  | "en-50742-a"     // Machinery Reg., Approach A — SRSL / Annex B attack-potential model
  | "en-50742-b";    // Machinery Reg., Approach B — IEC 62443 fixed-subset compliance model
  // extensible: cra, iec-62443, etc.

export const REGULATION_PRESETS: Record<RegulationPresetId, RegulationPreset>;
```

The **selected preset** is a project-level field:

```ts
// ProjectSettingsData (features/overview) — the home of project-wide switches
interface ProjectSettingsData {
  strictMode: boolean;
  autoSave: boolean;
  autoSaveInterval?: number;
  regulationPreset?: RegulationPresetId;   // NEW. undefined → "owasp" default.
}
```

Chosen in the Overview tab (the "ISO chip" that
`attacktree-feasibility-types.ts` already references but that was never built).
Single-select, exclusive — replacing the free-text `regulation` tag as the
*behavioural* source, while the tag stays for search/reporting.

## 4. What applying a preset does

Selecting a preset is a **non-destructive** configuration action:

1. Enables its `likelihoodFactorIds` in `RiskConfiguration.activeFactors`,
   disables likelihood factors from *other* regimes (impact factors untouched).
   Never deletes analyst-entered ratings — mirrors the existing safety
   auto-enable pattern (`updateSafetyFactorAutoEnable`).
2. Sets the derived `likelihoodModel` (§7) so the attack-tree DSL validator and
   `computeLikelihood` behave correctly.
3. Records `normativeBasis` for the report's methodology section — the audit
   trail an assessor asks for ("why did 0.62 become *high*?").

Switching presets warns if it would disable a factor that carries analyst
ratings (Class-B-style banner), never silently discards them.

## 5. Migration

Existing projects carry `ProjectTags.regulation` strings. Migration is
best-effort and non-destructive:

- `"ISO 21434"` / `"ISO/SAE 21434"` → suggest `regulationPreset: "iso-21434"`.
- `"EN 50742"` / machinery regulation tags → **ambiguous** (a plain tag doesn't say
  which Approach was used) → banner asks the analyst to pick `"en-50742-a"` or
  `"en-50742-b"` explicitly; no silent default to either, since they activate
  entirely different requirement models (SRSL vs. fixed IEC 62443 subset).
- No recognised tag → `undefined` (= OWASP default), unchanged behaviour.

Migration only *suggests* (a one-time banner), it does not auto-switch — because
switching changes the active factor set, which is the analyst's call. The
`regulation` tag is kept as-is for search/reporting; the preset is the new
behavioural field.

## 6. Naming correction carried in

The existing `LikelihoodModel = "feasibility-only" | "feasibility-x-motivation"`
is renamed `"feasibility-only" | "feasibility-supplement"`. Rationale: in the
settled 5b model the tree likelihood *supplements* (enters a weighted mean),
it does not *multiply* — so `-x-motivation` misdescribes the operation.
`feasibility-supplement` states what actually happens. (Done as its own small
refactor commit before 5b-1, with a check that `computeLikelihood`'s
`benefitShift` still reads correctly under the new name — the benefit component
lives there and is what "supplement" now refers to.)

## 7. Boundary with the attack-tree / 5b work

These two systems meet at exactly one field and must not blur:

- **This doc owns:** which likelihood factors exist for a regime, how they
  combine, whether benefit may enter — i.e. it *sets* `likelihoodModel` and the
  active factor set.
- **The attack-tree doc (v7) owns:** how a tree's likelihood becomes one
  `attack_tree_likelihood` factor (weight 1, project-global factor/advisory),
  and — the 5b-1 slice — that ISO mode forbids non-attack-potential DSL leaves.

The single shared field is `likelihoodModel` (`feasibility-only` = ISO). 5b-1
introduces it minimally *now*, reading it as a plain project setting. When the
preset system ships, the preset *derives* `likelihoodModel` instead — 5b-1's
consumer code (the DSL validator) does not change, because it already reads the
field, not the preset. That is the whole point of decoupling: 5b-1 depends on
the field, not on this feature.

## 8. Out of scope (explicitly)

- No new *calculation math* — the preset selects among methods that already
  exist (`computeAttackPotential`, `calculateRiskValues`, `computeLikelihood`).
- No change to the impact model — impact stays (asset × security-goal); a
  preset may *suggest* impact criteria but does not compute impact.
- No report-generator changes beyond surfacing `normativeBasis` (separate work).

## 9. Suggested commit sequence (when scheduled)

1. `refactor(attacktree): rename feasibility-x-motivation → feasibility-supplement`
   (independent, can land before 5b-1).
2. `feat(shared): RegulationPreset types + REGULATION_PRESETS catalog`.
3. `feat(overview): regulation preset selector, sets ProjectSettingsData.regulationPreset`.
4. `feat(risks): apply preset → active factor set (non-destructive, Class-B on downgrade)`.
5. `feat(overview): one-time migration banner from regulation tags`.
6. `feat(compliance): en-50742-b complianceProfile + machineryRole project setting` (see §10 — lands after the compliance-tab evaluator exists, per `taraflow-compliance-architecture.md` Phase 2b).
7. `feat(risks): en-50742-a srslProfile` (Approach A, SRSL/Annex B model — design not yet detailed, tracked as Phase 2c in `taraflow-compliance-architecture.md`).

---

## 10. EN 50742 — Approach A / Approach B Split

prEN 50742 offers two independent compliance routes (Clause 4.1: "Either
approach A ... or approach B ... shall be applied"), and — this is the
correction to an earlier draft of this section — **they do not share a
requirement model**. Only Approach A (Clause 7.4.2) references Annex B
(EL/WoO/AC → Attack Potential → SRSL, Tables B.5/B.6); Approach B (Clause 8,
Tables 3+4) prescribes a fixed SL-C per Foundational Requirement with no
risk-derived likelihood step at all. Treating "EN 50742" as one preset that
"activates both the likelihood factors and the compliance view" was wrong —
the two routes need **two separate, mutually exclusive presets**:

- **`en-50742-a`** — SRSL / Annex B model. Activates the `attack-potential`
  likelihood method with the WoO/AC/EL factors; no `ComplianceProfile`.
- **`en-50742-b`** — IEC 62443 fixed-subset compliance model
  (`ComplianceProfile`, Tables 3+4). No likelihood factors, no attack-potential
  calculation — `likelihoodMethod`/`motivationModel` are `"not-applicable"`.

An analyst picks the tag/preset that matches which Approach the manufacturer
is actually following; the tooltip on each explains what it does (see below),
so the choice doubles as the Approach A/B decision itself — no separate
`machineryApproach` field is needed.

### 10.1 Why this belongs here, not in a separate system

A preset already bundles "what a regime prescribes." `en-50742-b` prescribes,
instead of a likelihood model, a **fixed subset of IEC 62443-3-3/-4-2
requirements per Foundational Requirement**, at a fixed SL-C, split by
machinery role (system vs. component). That is exactly the kind of
regime-specific configuration `RegulationPreset` exists to carry — so it gets
a new optional field rather than a parallel preset mechanism. `en-50742-a`
will eventually carry the analogous `srslProfile` field (§10.6).

### 10.2 Extended `RegulationPreset`

```ts
interface RegulationPreset {
  // ...existing fields unchanged (§2)...

  /** Present only on en-50742-b. Consumed by compliance-evaluator.ts. */
  complianceProfile?: ComplianceProfile;

  /** Present only on en-50742-a (Phase 2c, not yet designed in detail).
   *  SRSL-tiered control catalogue (Clause 7.4.3), keyed per safety function
   *  rather than a fixed requirement-ID list. */
  srslProfile?: SRSLProfile;
}
```

`ComplianceProfile` (and `MachineryRole`, `CompensatingCountermeasureReference`,
the new `CRStatus: "compensated"`) is defined and owned by the compliance
architecture doc — this doc only attaches it to `en-50742-b`. No duplication
of the requirement-ID list: `en-50742-b`'s `complianceProfile.requirementIds`
is the single source of truth referenced by the compliance side
(`compliance-evaluator.ts`); `en-50742-a` has no equivalent list, since its
controls scale continuously with each safety function's own SRSL rather than
being enumerated per fixed ID.

### 10.3 Tooltip text (UI)

Shown in the preset selector so the choice is self-explanatory:

- **`en-50742-a`**: "Generic protection requirements per safety function
  (SRSL0–3), derived from attack potential and severity. No fixed IEC 62443
  requirement list — controls scale with each function's own risk."
- **`en-50742-b`**: "IEC 62443-3-3/-4-2 based. Fixed SL-C2/SL-C1 target per
  Foundational Requirement, evaluated against a defined subset of SR/CR-IDs
  (Tables 3/4)."

### 10.4 `en-50742-b` preset, complete

| Field | Value |
|---|---|
| `likelihoodMethod` | `not-applicable` |
| `likelihoodFactorIds` | *(empty)* |
| `motivationModel` | `not-applicable` |
| `complianceProfile.frTargetSL[role]` | `{FR1: 2, FR2: 2, FR3: 2, FR4: null, FR5: 1, FR6: 1, FR7: 2}` (same target SL for both roles; only the requirement-ID list differs) |
| `complianceProfile.requirementIds.system` | SR1.1; SR2.1, SR2.8, SR2.9; SR3.1, SR3.4, SR3.5, SR3.6; SR5.1; SR6.1; SR7.1, SR7.2 |
| `complianceProfile.requirementIds.component` | CR1.1, CR1.2; CR2.1, CR2.6, CR2.8, CR2.9, CR2.12, EDR2.13; CR3.1, CR3.4, CR3.5, CR3.6, EDR3.2, EDR3.11, EDR3.14; CR5.1; CR6.1; CR7.1, CR7.2 |
| `complianceProfile.allowsCompensatingCountermeasures` | `true` |
| `complianceProfile.numericOverrides` | `{ "CR-2.8": { minValue: 5, unit: "years" } }` (Clause 8.5 persistency) |
| `normativeBasis` | `"prEN 50742:2025 (Draft), Clause 8.2/8.3, Tables 3+4"` |

### 10.5 `en-50742-a` preset, current scope

| Field | Value |
|---|---|
| `likelihoodMethod` | `attack-potential` |
| `likelihoodFactorIds` | `window_of_opportunity, attacker_capability, exposure_level` |
| `motivationModel` | `feasibility-supplement` |
| `complianceProfile` | *(absent — no fixed requirement-ID list under Approach A)* |
| `srslProfile` | *(Phase 2c, TBD)* |
| `normativeBasis` | `"prEN 50742:2025 (Draft), Clause 7.4.2/7.4.3, Annex B"` |

### 10.6 `machineryRole` is a project setting, read only for `en-50742-b`

Table 3 (system) vs. Table 4 (component) is a project-scope decision — the
same manufacturer might run TARAflow once against their own component and
once against the integrated machine. It has no meaning under `en-50742-a`
(Approach A's SRSL model doesn't distinguish system/component tables), so it
lives as its own field, read conditionally:

```ts
interface ProjectSettingsData {
  // ...existing fields...
  regulationPreset?: RegulationPresetId;
  machineryRole?: "system" | "component";  // NEW. Only read when
                                             // regulationPreset === "en-50742-b".
                                             // undefined → prompt on first
                                             // Compliance-tab visit.
}
```

`compliance-evaluator.ts` reads `frTargetSL`/`requirementIds` from
`complianceProfile`, keyed by `machineryRole`, to decide the active
requirement set for the current project.

### 10.7 Applying the preset — additive step

Step 4 in §4 ("apply preset → active factor set") gains one more action when
`complianceProfile` is present (i.e. `en-50742-b` only): seed the Compliance
tab's target-SL and requirement-scope from
`frTargetSL`/`requirementIds[machineryRole]`. This is read directly by the
compliance tab — it is not written into `RiskConfiguration.activeFactors`,
since compliance status is a separate concern from risk-factor weighting. No
migration/Class-B concern here: the compliance tab is new and has no prior
analyst state to preserve when a preset is (re-)applied. For `en-50742-a`,
this step instead enables the WoO/AC/EL likelihood factors as usual (§4,
step 1) — no compliance-tab seeding occurs.

### 10.8 Out of scope (carried over from §8, restated)

- `ComplianceProfile`, `CompensatingCountermeasureReference`, and the
  `compliance-evaluator.ts` filter logic (`isInScope`/`targetSLFor`) are owned
  by `taraflow-compliance-architecture.md` — this doc only wires the preset
  selector to them.
- `SRSLProfile` (Approach A's control catalogue per SRSL/safety function) is
  not designed yet — tracked as Phase 2c in `taraflow-compliance-architecture.md`.
- No change to how `likelihoodModel`/`motivationModel` are derived otherwise —
  `en-50742-a`'s likelihood dimension and `en-50742-b`'s compliance dimension
  are evaluated by entirely separate services (`computeLikelihood` vs.
  `compliance-evaluator`) and never share state.
