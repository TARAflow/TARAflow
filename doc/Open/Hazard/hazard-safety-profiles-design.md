# TARAflow — Safety profiles: domain-specific hazard analysis (medical, railway, automotive, aerospace)

**Status:** v0.1 · 2026-11-07 · draft for decision — D-1 … D-14 proposed (§9), Q-1 … Q-7 open (§10)
**Target:** 0.19 (stage 1: P0 … P3), 0.20+ (stage 2: P4 … P8)
**Scope:** `shared/models` (safety profile registry, canonical severity, native scales,
integrity cores), `shared/services/tag-validator.ts`, `features/hazards` (model, tab,
dialog, importer, findings), `features/documentation` (new chapter), `app` (projection
into assets and risks, migration)
**Related:** `doc/InProgress/HazardTab/IMPLEMENTATION-hazard-tab-ui_v5.md` (hazard tab and
bowtie as built), `doc/Done/Hazard/hazard-import-iso12100-extensions.md` (HI-1 … HI-11),
`doc/taraflow-safety-model.md` (canonical severity scale),
`doc/InProgress/RegulationCompliance/iso-21434-conformance-implementation-plan.md`,
`doc/InProgress/RegulationCompliance/en-50742-approach-a-design.md`,
`doc/Open/Hazard/IMPLEMENTATION-hazard-item-safety-independence.md` (edge-level
security → safety independence, parked), `doc/Open/multi-project-tara-design.md`
(component TARAs carry security threats only, never hazards; schema 14 in 0.19).
**Texts:** not verified against licensed texts. Every table marked *(verify)* comes from
secondary sources and must be checked against ISO 14971:2019, ISO/TR 24971:2020,
EN 50126-1/-2:2017, EN 50129, Regulation (EU) 402/2013 as amended by 2015/1136,
ISO 26262-3:2018, ARP4761A / ED-135 and AMC 25.1309 before a value is committed.
Requirement texts are paraphrased; the standards are authoritative and never committed.

---

## 1. Goal

A project's regulation tags already set the security method (regulation preset) and the
requirement matrices. They shall also set the **safety method** of the Hazard tab — so
that a medical project gets an ISO 14971 risk analysis, a railway project an
EN 50126 / CSM-RA hazard record, an automotive project an ISO 26262 HARA and an aviation
project an ARP4761A functional hazard assessment, each with its own scales, fields,
importer template, findings and report chapter. The safety importer then knows from the
tags what kind of sheet to expect.

Two constraints from the user:

1. **One safety domain per project.** Automotive and railway, or railway and machinery,
   must not be active at the same time. A tag validator rule reports the conflict (§5).
2. **The scale must be extended.** The canonical person scale ends at `fatal`; railway,
   aviation and defence distinguish a single fatality from multiple fatalities.

The security side stays as it is: whatever the profile, the hazard chain still ends in
the canonical severity that drives `physicalImpact`, the Safety Override and the risk
register (§6.4).

## 2. Today (checked against `main`, e0f3524)

### 2.1 What exists

| Part | Code | State |
|---|---|---|
| Hazard Tab gate | `shared/components/safety-analysis-toggle.tsx`, `requiresHazardAnalysis()` in `shared/services/tag-validator.ts` | `HAZARD_REGULATIONS` = EN 50742, IEC 81001, IEC TR 60601, IEC 63452, CLC/TS 50701 force `safetyRelevant` on. The tag decides *whether* there is a Hazard tab, not *how* it works. |
| Hazard model | `shared/models/hazard-types.ts` | `HazardItem` with `hazardType: HazardCategory` (ISO 12100 classes), `physicalHazardPotential`, `combinationType`, `importMeta`, `systemRelevance`. One hazard node per item, no chain (situation, harm). |
| Severity | `shared/models/safety-types.ts`, `shared/models/hazard-impact.ts` | Canonical `SafetyImpact` = `none` + 5 levels up to `fatal`. Environment and infrastructure: `low · medium · high · critical` (environment wording marked *PROPOSED — confirm* in the code). ISO 26262 class S0–S3 is **display only** under the `iso-21434` vocabulary. |
| Severity → security | `app/utils/commit-hazard-safety.ts`, `features/assets/services/asset-physical-impact-deriver.ts` | Cause asset inherits the worst severity of its hazards (`physicalImpact`), the Safety Override applies, the asset's `safety` impact rating becomes the IEC 62061 factor Se1–Se4 (`safetySeverityToFactor`). |
| Importer | `features/hazards/services/safety-hazard-importer.ts`, `apply-import-profile.ts`, `models/import-profile-types.ts` | `CanonicalField` = generic fields + ISO 12100 / 13849 meta fields (`ISO12100_META_FIELDS`, stored in `importMeta`). Value maps, marker groups, stored profiles, re-import with reconciliation (HI-9, HI-10). No profile knows a domain. |
| Configuration | `features/hazards/models/hazard-data-types.ts` | `HazardConfiguration` = default combination type, `requireHazardType`, `maxHops`. No scale or method choice. |
| Tag validator | `shared/services/tag-validator.ts` | Warnings only, never blocking: `missing-context` (regulation without its domain), `mutual-exclusion` for **method** groups (ISO 21434 / EN 50742 / ETSI TVRA) and EN 50742 A vs B. No rule about safety domains. |
| Report | `features/documentation` | **No hazard chapter.** Hazards reach the report only inside the EN 50742 A part of the requirement matrix chapter (`app/services/compliance-report.ts`). |

### 2.2 Findings

**F-1 — No report chapter for the hazard analysis.** Even an EN 50742 / ISO 12100
project has no chapter listing its hazards, bowties, imported ratings and protective
measures. Every profile below needs one (P7); it is worth doing first for ISO 12100.

**F-2 — ISO/SAE 21434 safety impact is projected through IEC 62061, not ISO 26262
(automotive).** In ISO mode the asset's safety rating is the Se factor, labelled with
the ISO words: Se1 Negligible, Se2 Moderate, Se3 Major, Se4 Severe. ISO/SAE 21434 takes
the safety impact from the ISO 26262 severity classes (S3 → severe; *(verify Table F.1)*
S2 → major, S1 → moderate, S0 → negligible). The two disagree:

| Canonical | ISO 26262 class shown on the edge | Se factor → ISO label today | Expected ISO label |
|---|---|---|---|
| none | S0 | — (no rating) | negligible |
| reversible_minor | S1 | 1 → Negligible | moderate |
| reversible_major | S1 | 2 → Moderate | moderate |
| irreversible_minor | S2 | 3 → Major | major |
| irreversible_major | S2 | 4 → Severe | major |
| fatal | S3 | 4 → Severe | severe |

So a light injury rates *negligible* and a survivable severe injury *severe*, while the
same edge shows S1 or S2 next to it. To be confirmed with a test on the ISO example
project before the fix (P0); the fix changes risk values of ISO projects (D-11).

**F-3 — Automotive has no HARA.** No operational situation, malfunctioning behaviour,
exposure (E0–E4), controllability (C0–C3), ASIL, safety goal, safe state or FTTI. The
ISO 21434 tag does not offer the Hazard tab. For a TARA that is acceptable — ISO/SAE
21434 only needs the safety impact — but an automotive customer's HARA cannot be
imported and the S class cannot be cross-checked against it.

**F-4 — The canonical scale cannot express "multiple fatalities".** Railway (CSM-RA:
*catastrophic* = multiple fatalities, *critical* = at least one fatality), aviation
(*catastrophic* vs *hazardous*) and MIL-STD-882E need it.

**F-5 — Hazard categories are ISO 12100 only.** `HazardCategory` (mechanical, electrical,
thermal …) does not fit medical hazards, railway accident types or aircraft failure
conditions.

**F-6 — Integrity levels are not modelled.** PLr / PL exist only as imported strings in
`importMeta`; ASIL, SIL, THR, DAL do not exist at all.

### 2.3 Which tags could bring safety in

From the 15 domain and 19 regulation tags of `shared/utils/tag-categories.ts`:

| Tag | Safety method that fits | Today | Proposal |
|---|---|---|---|
| Industrial + **EN 50742 A** | ISO 12100 / ISO 13849 / IEC 62061 | Hazard tab forced, ISO 12100 import | profile `iso-12100` (formalises today's behaviour) |
| Medical + **IEC 81001**, **IEC TR 60601** | ISO 14971 (+ IEC 62304 software class; AAMI TIR57 / SW96 for the security link) | Hazard tab forced, ISO 12100 vocabulary | profile `iso-14971` |
| Railway + **CLC/TS 50701**, **IEC 63452** | EN 50126 / EN 50129, CSM-RA (Reg. 402/2013) | Hazard tab forced, ISO 12100 vocabulary | profile `en-50126` |
| Automotive + **ISO 21434** | ISO 26262-3 HARA (ISO 21448 SOTIF later) | S class display only | profile `iso-26262` (offered, not forced — D-10) |
| **Aerospace**, **Aviation** | ARP4761A / ED-135 (FHA, PSSA, SSA), DAL per ARP4754B; security: DO-326B / ED-202B, DO-356A / ED-203A | nothing | profile `arp-4761a` + new tag `ED-202 / DO-326` |
| Military | MIL-STD-882E (severity × probability → risk assessment code) | nothing | profile `mil-std-882e` (stage 2) |
| Energy (+ IEC 62351), Water, Pharma, Industrial (process) | IEC 61508 / IEC 61511 (risk graph, LOPA → SIL) | nothing | profile `iec-61508` (stage 2) |
| IEC 62443 | consequence-based zoning; safety via IEC 61511 / IEC TR 63069 | nothing | none — hint only |
| Consumer, Transportation | product-specific (e.g. household appliances), mixed | nothing | none |
| Finance, Public Sector, Telecom | — | — | none |
| AI Act | high-risk AI as safety component of a regulated product | nothing | none — the product's own profile applies |

## 3. Concept — the safety profile

A **safety profile** is a declarative description of a domain's hazard method, analogous
to the regulation preset but **orthogonal** to it (D-1): the preset says how *security*
risk is computed, the profile says how *safety* hazards are described and rated. ISO
21434 preset + `iso-26262` profile, or Standard preset + `iso-14971` profile, are both
valid.

```ts
// shared/models/safety-profile.ts (new) — pure data, no React, no i18n binding
export type SafetyProfileId =
  | "generic"      // today's behaviour, no tag
  | "iso-12100"    // machinery
  | "iso-14971"    // medical devices
  | "en-50126"     // railway (EN 50126 / EN 50129 / CSM-RA)
  | "iso-26262"    // road vehicles (HARA)
  | "arp-4761a"    // civil aircraft (FHA)
  | "mil-std-882e" // stage 2
  | "iec-61508";   // stage 2 (process: IEC 61511)

export interface SafetyProfile {
  id: SafetyProfileId;
  nameKey: string;                       // i18n
  chain: ChainShape;                     // which chain fields the item has (§4.1)
  severityAnchor: "edge" | "item";       // where the native severity is rated (D-7)
  nativeScales: NativeScaleRef[];        // §4.2 — per target kind, or per item
  likelihood: LikelihoodShape;           // P1/P2/P · E/C · frequency class · probability per hour
  integrity?: IntegrityShape;            // PL · ASIL · SIL/THR · DAL — derived by a pure core (§4.3)
  acceptance: AcceptanceShape;           // matrix · ASIL table · acceptance principle · probability objective
  categories: HazardCategoryVocabulary;  // F-5 — profile-owned, project-extendable
  importTemplate: ImportTemplateId;      // §7
  findings: HazardFindingRuleSetId;      // §4.4
  reportSection: HazardReportSectionId;  // §8
}
```

Every profile is a data module plus, where the standard fixes a table, a pure
computation core (like `features/risks/models/en50742-approach-a-core.ts`, but in
`shared/models`, because `features/hazards` must not import `features/risks`). Adding a profile adds a file to a
registry — no switch over profile ids outside the registry (open/closed).

## 4. Hazard model and scales

### 4.1 Chain fields

Today an item is one node. The profiles need up to four links of a chain; the item gets
optional chain fields, shown only when the profile's `chain` declares them:

| Field | 12100 | 14971 | 50126 | 26262 | 4761A |
|---|---|---|---|---|---|
| `hazard` (source, today `description`) | ✓ | ✓ hazard | ✓ hazard | malfunctioning behaviour | failure condition |
| `sequenceOfEvents` | — | ✓ | causes | — | — |
| `situation` | hazardous situation (lifecycle phase, zone) | hazardous situation | operational mode / situation | operational situation | flight phase |
| `harm` → `endangers` edges | ✓ | ✓ harm | accident / consequence | hazardous event → persons | effect on aircraft, occupants, crew |
| function | safety function (import) | — | safety function | item function | aircraft / system function |

One Hazard Item stays the unit of the bowtie and of the asset projection. For ISO 14971
the unit is the **hazardous situation** (the standard requires each hazardous situation to
be documented — D-6); for ISO 26262 the **hazardous event** (malfunction × operational
situation); for ARP4761A the **failure condition**; for EN 50126 the **hazard record
entry**.

### 4.2 Two layers of severity

**Canonical scale (extended, D-5).** `SAFETY_SEVERITIES` gains one level above `fatal`:

```
none · reversible_minor · reversible_major · irreversible_minor · irreversible_major · fatal · catastrophic
```

`catastrophic` = multiple fatalities. Projections that already exist keep their top:
IEC 62061 Se4, ISO 26262 S3, EN 50742 `fatal` (SRSL row), ISO 21434 *severe*, Safety
Override as `fatal`. Ordering, `worseSafetyImpact`, `isOverrideSeverity` and all
dropdowns are rank-based and need only the new entry. A file carrying `catastrophic`
must not open in 0.18 (it would not know the value) → schema fence (D-12).

**Native scale (per profile).** The rating the analyst and the customer's sheet use —
*serious*, *S2*, *marginal*, *hazardous* — is stored as the native value next to the
canonical one, never instead of it. The canonical value is **derived** from the native
one through the profile's projection table; the edge editor shows the native scale and
the derived canonical level beside it. A manual canonical override needs a rationale
(as today for `physicalImpact`).

```ts
export interface NativeSeverity {
  scaleId: string;   // e.g. "iso-14971.default-5", "en-50126.project"
  value: string;     // native level id
}
// EndangersRelation (shared/models/hazard-types.ts) — additive, optional
//   nativeImpact?: NativeSeverity;   // when absent, the edge is canonical-only (today)
```

Where the standard leaves the scale to the manufacturer or the project (ISO 14971,
EN 50126 frequency and severity classes), the profile ships a **default scale** and the
project may edit labels, descriptions and the projection in the hazard configuration —
the risk-management plan's acceptability criteria live there, not in code.

Proposed projections (*verify* the fixed ones; the project-defined ones are defaults):

| Profile | Native level | Canonical | Source |
|---|---|---|---|
| iso-26262 | S0 · S1 · S2 · S3 | none · reversible_major · irreversible_major · fatal | fixed by the standard; conservative upper sub-level, like `normalizeLegacySafetyImpact` |
| iso-14971 (default 5) | negligible · minor · serious · critical · catastrophic | reversible_minor · reversible_major · irreversible_minor · irreversible_major · fatal | manufacturer-defined, editable |
| en-50126 | insignificant · marginal · critical · catastrophic | reversible_major · irreversible_major · fatal · catastrophic | *critical* / *catastrophic* follow the CSM-RA definitions (Reg. 2015/1136, Art. 3 (23), (35)); the lower two are project-defined |
| arp-4761a | no safety effect · minor · major · hazardous · catastrophic | none · reversible_minor · reversible_major · fatal · catastrophic | *(verify)* — the classification is per failure condition and includes non-person effects (safety margins, crew workload) that stay native only |
| mil-std-882e | negligible · marginal · critical · catastrophic | (stage 2) | — |

Environment and infrastructure keep `low · medium · high · critical`; the profile maps
its environmental and property wording onto them. The *PROPOSED* note on the
environment scale in `hazard-impact.ts` is resolved in P2 (Q-5).

### 4.3 Likelihood, integrity and acceptance

Stored on the item in one typed block, discriminated by profile:

```ts
// shared/models/hazard-assessment.ts (new)
export type HazardAssessment =
  | { profile: "iso-12100"; riskGraph?: { s; f; p }; plRequired?; plAchieved?; protectiveMeasures?: Measure[] }
  | { profile: "iso-14971"; p1?; p2?; p?; riskBefore?; riskAfter?; acceptable?; controls?: Measure[];
      residualRisk?; benefitRisk?: { required: boolean; text?: string }; softwareSafetyClass?: "A" | "B" | "C" }
  | { profile: "en-50126"; frequency?; riskClass?; acceptancePrinciple?: "code_of_practice" | "reference_system" | "explicit";
      acceptanceReference?; broadlyAcceptable?: boolean; thr?: number; sil?: 0 | 1 | 2 | 3 | 4;
      designTarget?: "highly_improbable" | "improbable"; directly?: boolean; owner?; status?; transferredTo? }
  | { profile: "iso-26262"; exposure?: "E0" | "E1" | "E2" | "E3" | "E4"; controllability?: "C0" | "C1" | "C2" | "C3";
      asil?: "QM" | "A" | "B" | "C" | "D"; safetyGoal?: { text; safeState?; ftti? } }
  | { profile: "arp-4761a"; dal?: "A" | "B" | "C" | "D" | "E"; probabilityObjective?: number;
      assessedProbability?: number; detection?; crewResponse? };
// HazardItem.assessment?: HazardAssessment   (additive, optional)
```

Rules:

- **Integrity outputs are derived, never typed** (D-8): ASIL from S × E × C (ISO 26262-3
  Table 4), DAL and probability objective from the failure condition classification
  (ARP4761A / AMC 25.1309 — the objective depends on the certification basis, CS-25
  default, project setting), the CSM-RA design target from the CSM-RA severity
  (catastrophic → highly improbable, ≤ 10⁻⁹ per operating hour; critical → improbable,
  ≤ 10⁻⁷) when the failure leads *directly* to the accident, SIL from the THR band
  (*verify* EN 50129 table). An imported integrity value is kept in `importMeta` and
  compared — a mismatch is a warning (like HI-7), never overwritten.
- Each core is a pure module in `shared/models` (`iso26262-asil-core.ts`,
  `arp4761a-dal-core.ts`, `csm-ra-core.ts`, `en50129-sil-core.ts`) with the standard's
  table as data and its own tests.
- The ISO 12100 fields that live in `importMeta` today (HI-5) move into the `iso-12100`
  assessment block (migration in P3); `importMeta` keeps only provenance.
- **Measures** (`Measure = { text; type; verificationRef? }`) carry the profile's type
  vocabulary: ISO 12100 three-step method and ISO 14971 control options (inherent
  safety by design · protective measures · information for safety) share one list;
  EN 50126 safety measures / safety requirements; ARP4761A safety requirements.
- **EN 50126 exported hazards and application conditions** become item-definition
  assumptions (ASM-nn) with the receiving organisation as owner — they are conditions
  other parties must fulfil, not hazards of this system (D-9).

### 4.4 Findings

A pure rule set per profile (`features/hazards/services/findings/<profile>.ts`), shown in
the hazard findings panel (0.18). Examples:

| Profile | Finding |
|---|---|
| iso-14971 | risk not acceptable and no control · residual risk not acceptable without benefit-risk statement · control without verification reference |
| en-50126 | hazard without acceptance principle · explicit estimation without frequency or severity · code of practice / reference system without reference · open hazard without owner · CSM-RA target violated (assessed rate above the design target) |
| iso-26262 | ASIL ≥ A without safety goal · S/E/C incomplete · imported ASIL ≠ derived ASIL |
| arp-4761a | catastrophic / hazardous without probability objective met · DAL below the classification |
| all | native severity without projection · canonical override without rationale |

## 5. Tags and the tag validator

### 5.1 New tags (regulation category)

| Tag | Profile | Note |
|---|---|---|
| `ISO 12100` | iso-12100 | implied by EN 50742 today |
| `ISO 14971` | iso-14971 | |
| `EN 50126` | en-50126 | `CSM-RA` as alias / second tag |
| `ISO 26262` | iso-26262 | |
| `ARP4761A` | arp-4761a | aliases ARP 4761, ED-135 |
| `ED-202 / DO-326` | — (security) | aviation security; `missing-context` → Aerospace / Aviation; a security preset is out of scope here (Q-6) |
| `MIL-STD-882E`, `IEC 61508`, `IEC 61511` | stage 2 | |

Normalisation as in `normalizeTag`; tooltips and document descriptions via i18n
(`tags.tooltips.*`, `tags.docDescriptions.*`). Safety tags get the method marking of
0.17 (they change the workflow).

### 5.2 Deriving the profile

`safetyProfileFromTags(tags): { profile: SafetyProfileId; source: "explicit" | "implied" | "none"; conflict?: SafetyProfileId[] }`
in `shared/services/tag-validator.ts`, next to `regulationPresetFromTags`:

1. **Explicit** safety tags (`ISO 14971`, `EN 50126`, …) win.
2. Otherwise **implied** by a security / method tag: EN 50742 → iso-12100; IEC 81001,
   IEC TR 60601 → iso-14971; CLC/TS 50701, IEC 63452 → en-50126; ISO 21434 → iso-26262
   (offered, D-10); ED-202 / DO-326 → arp-4761a.
3. Otherwise `generic`. **Domain tags never select a profile** — they only feed
   `missing-context` hints ("Medical project without ISO 14971 — add it?").

`requiresHazardAnalysis` keeps its meaning (forces the tab) and is extended by the
explicit safety tags.

### 5.3 Conflict rule (user requirement)

New warning kind `"safety-domain"` in `getRegulationConflicts`, built like the method
conflict:

- **Two different profiles** derived from the regulation tags (explicit or implied):
  e.g. `ISO 26262` + `EN 50126`, `CLC/TS 50701` + `EN 50742 A`, `IEC 81001` + `ISO 21434`.
  One warning per pair, `conflictsWith` filled, i18n
  `projectInfo.tagConflicts.safetyDomain`.
- **Domain tags of different safety domains** (Automotive, Railway, Medical,
  Aerospace / Aviation, Industrial-with-EN-50742) without a resolving safety tag: a
  softer `missing-context` hint ("Railway and Automotive — which safety method applies?").
  Aerospace + Aviation together is no conflict (same profile).
- **Effect** (D-3): while a conflict exists the profile is **unresolved** — the Hazard
  tab shows a banner and stays on `generic`, the importer offers only the generic
  template, nothing is guessed. Existing data is never changed by a tag edit; switching
  the profile later keeps every field (§6.3).

Consistent with the validator's principle (warnings, never a hard block on tags); the
hard choice is the resolved profile, as for the preset.

## 6. Coupling and migration

### 6.1 Into the security side (unchanged path)

native severity → canonical (profile projection) → worst on cause assets
(`commit-hazard-safety.ts`) → `physicalImpact` → Safety Override → `safety` impact
rating → risk. The only changes: `catastrophic` in the rank order, and the ISO 21434
projection fix (F-2, D-11).

### 6.2 Security ↔ safety links per domain

| Profile | Link | Where |
|---|---|---|
| iso-14971 | security risk with safety effect traces to the hazardous situation (TIR57 / SW96) | hazard id on the risk — existing bowtie path; report cross-reference |
| en-50126 | CLC/TS 50701 threat log and SecRACs reference the hazard record; stable hazard ids on re-import (HI-10) | report cross-reference |
| iso-26262 | ISO 21434 safety impact = S class (after F-2); ASIL shown beside the damage scenario | risk dialog impact provenance |
| arp-4761a | DO-326B / ED-202B: severity of a threat condition from the failure condition classification | stage 2, with a security preset (Q-6) |

### 6.3 Switching profiles

All profile data is optional and additive. Changing the tags never deletes: fields of
another profile stay stored but hidden, and the hazard findings list "data of profile X
not shown". Native values without a projection in the new profile keep their canonical
value.

### 6.4 Schema

One fence per release (D-12). The multi-project TARA design already claims schema 14
for 0.19 (`migrate-13-to-14`, additive). If P2 + P3 ship in 0.19 they join that fence:
`catastrophic` and the new optional fields (`assessment`, `nativeImpact`, chain fields,
hazard configuration scales) are declared in schema 14, and `migrate-13-to-14` also moves
the ISO 12100 `importMeta` keys into `assessment` (`profile: "iso-12100"`). If they slip,
they get schema 15 with their own `migrate-14-to-15`. A backup is written as for every
conversion.

## 7. Importer

New canonical fields (normneutral, §4): `situation`, `sequenceOfEvents`, `harm`, `p1`,
`p2`, `riskBefore`, `riskAfter`, `acceptability`, `controls`, `controlType`,
`verificationRef`, `residualRisk`, `benefitRisk`, `owner`, `status`,
`acceptancePrinciple`, `acceptanceReference`, `frequency`, `thr`, `sil`, `exposure`,
`controllability`, `asil`, `safetyGoal`, `safeState`, `ftti`, `function`, `flightPhase`,
`dal`, `probabilityObjective`, `assessedProbability`, `applicationConditions`.

Per profile an **import template** = default column aliases (EN + DE), the native scale
as value-map target, required fields, and the row grouping:

| Template | Unit row | Grouping |
|---|---|---|
| ISO 14971 risk management file / FMEA | hazardous situation | several harms of one situation in follow-up rows → one item, several edges |
| EN 50126 hazard log | hazard record entry | measures in follow-up rows; exported hazards → assumptions |
| ISO 26262 HARA | hazardous event | — |
| ARP4761A FHA worksheet | failure condition | flight phases as separate rows of one condition → one item |
| ISO 12100 (today) | hazard | unchanged |

The template is preselected from the resolved profile; with `generic` or a conflict the
analyst picks one. Stored profiles (HI-9) record the template. Re-import (HI-10) is
unchanged; the reconciliation also compares `assessment` fields.

## 8. Report

New chapter `hazard-analysis` (`DocChapterId`), between `assets` and the threat
chapters, auto-hidden when the project has no hazards. Common part: method and scales
(native scale with its projection), hazard table, bowtie per in-scope hazard, imported
ratings with source. Profile part (`reportSection`): ISO 14971 risk table before / after
with controls and benefit-risk; EN 50126 hazard record with acceptance principle,
status, owner, THR / SIL and exported hazards; ISO 26262 HARA table S / E / C → ASIL
with safety goals; ARP4761A FHA table classification → DAL / objective. Methodology
chapter: one paragraph from the profile. All formats and the CLI.

## 9. Decisions (proposed)

| # | Question | Proposal |
|---|---|---|
| D-1 | Preset and profile one concept? | **No — orthogonal.** The preset is the security method, the profile the safety method; they combine freely. |
| D-2 | What selects the profile? | Regulation tags only (explicit safety tag > implied); domain tags only hint. No separate picker. |
| D-3 | Conflict handling | Warning of kind `safety-domain`; profile **unresolved** until one tag is removed; no guess, no data change. |
| D-4 | Several profiles in one project? | No. A component of another domain is its own TARA (multi-project TARA imports security threats, not hazards). |
| D-5 | Extend the canonical scale? | Yes: `catastrophic` above `fatal`; every existing projection keeps its top. |
| D-6 | ISO 14971 unit | One Hazard Item per hazardous situation. |
| D-7 | Where is the native severity rated? | On the `endangers` edge (persons, environment), except ARP4761A: on the item (failure condition); its edges derive from it. |
| D-8 | Integrity levels | Derived by pure cores from the standard's tables; imported values only compared. |
| D-9 | EN 50126 exported hazards / application conditions | As assumptions (ASM-nn) with the receiving organisation as owner. |
| D-10 | ISO 21434 and the Hazard tab | Offered (profile iso-26262), not forced — ISO/SAE 21434 does not require a HARA. |
| D-11 | Fix F-2 | Yes, in P0, behind a review list: risks whose safety impact changes are listed, the TARA verification is invalidated as for any analysis change. |
| D-12 | Schema | One fence per release: P2 + P3 join the 0.19 schema 14 of the multi-project TARA, otherwise schema 15. |
| D-13 | Aerospace vs Aviation | Both select `arp-4761a`; space (ECSS) out of scope. |
| D-14 | Order of profiles | iso-14971 and en-50126 first (forced tabs today with the wrong vocabulary), then iso-26262, then arp-4761a; mil-std-882e and iec-61508 in stage 2. |

## 10. Open questions

- **Q-1** Names of the new tags (`EN 50126` with or without `CSM-RA`; `ARP4761A` or
  `ARP 4761`; `ED-202 / DO-326` as one tag or two).
- **Q-2** Licensed texts available for ISO 14971, EN 50126-1/-2, EN 50129, ISO 26262-3,
  ARP4761A? Without them the fixed tables stay marked *(verify)* and are not committed.
- **Q-3** Default ISO 14971 scale: 5 levels as proposed, or the scale of a real customer
  RMF?
- **Q-4** Should ISO 21448 (SOTIF) triggering conditions be part of the iso-26262 profile
  or a later profile?
- **Q-5** Environment wording (`low … critical`, marked PROPOSED in code): keep, or adopt
  a profile-native environmental scale with projection like persons?
- **Q-6** Aviation security preset (DO-326B / DO-356A: threat level × threat condition
  severity) — separate document?
- **Q-7** MIL-STD-882E and IEC 61508 / 61511 — stage 2 as proposed, or out of scope?
- **Q-8** Import adapters from the superseded hazard import spec (`doc/Old/taraflow-feature-spec-safety-hazard-import-v2.md`
  §4.7), never built: **ISO 14971 Risk Register XML** (fits the iso-14971 profile) and
  **SISTEMA CSV** (ISO 13849) — with the profiles, or later?

## 11. Phases (each commit works on its own)

Feature boundaries: `features/hazards` imports only `shared`; profile data, scales and
cores live in `shared/models`; the projection into assets and risks stays in `app`. All
user-facing text through i18n (EN + DE). Golden tests for every derived value.

| Phase | Content | Done when |
|---|---|---|
| **P0** Fixes (0.19) | F-2: ISO 21434 safety projection through the ISO 26262 class instead of the Se factor (`iso-21434` vocabulary only) + review list of changed risks; F-1 groundwork: hazard chapter skeleton for the existing ISO 12100 data | test on the Headlamp example shows S1 → moderate, S2 → major; report lists hazards of an EN 50742 project |
| **P1** Profile registry and tags (0.19) | `shared/models/safety-profile.ts` with `generic` + `iso-12100` (today's behaviour as data); `safetyProfileFromTags`; new tags (§5.1) with i18n; `safety-domain` conflict and domain hints (§5.3); profile line in Overview → Methodology | tag combinations of §5.3 produce the expected warnings (unit tests); no behaviour change for existing projects |
| **P2** Scales (0.19) | canonical `catastrophic` (all rank users, Se / S / EN 50742 / ISO 21434 projections, i18n, colours); `NativeSeverity` + projection tables in the profile; hazard configuration holds editable project scales; edge editor shows native scale + derived canonical | every projection table golden-tested; no existing value changes |
| **P3** Model and migration (0.19) | chain fields, `HazardAssessment` union, `Measure`; ISO 12100 `importMeta` → `assessment`; declared in the 0.19 schema fence (§6.4) | round trip of all example projects; 0.18 refuses the file |
| **P4** iso-14971 + en-50126 (0.20) | profile data, default scales, cores (`csm-ra-core`, `en50129-sil-core`), category vocabularies, findings, dialog sections, table columns; application conditions → assumptions | a medical and a railway example project in TARAflow_Examples |
| **P5** Importer templates (0.20) | new canonical fields; templates for ISO 14971 RMF / FMEA and EN 50126 hazard log; row grouping; template preselection from the profile | import of one real RMF and one real hazard log, re-import reconciles |
| **P6** iso-26262 + arp-4761a (0.20+) | HARA (S/E/C → ASIL, safety goal, safe state, FTTI) and FHA (classification → DAL / objective, CS-25 default); their import templates; S class cross-check against ISO 21434 damage scenarios | Headlamp example carries a HARA; an aviation example exists |
| **P7** Report (with P4 / P6) | `hazard-analysis` chapter: common part + profile sections; methodology paragraph; CLI | chapter in all formats for every example |
| **P8** Stage 2 (later) | `mil-std-882e`, `iec-61508` / IEC 61511 (risk graph, LOPA → SIL) for Military, Energy, Water, Pharma, process Industrial; ED-202 / DO-326 security preset (Q-6) | — |

### 11.1 Progress

| Step | State |
|---|---|
| — | nothing started |
