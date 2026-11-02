# TARAflow — Model coverage and multi-standard compliance: implementation plan

**Status:** draft v0.1 · 2026-11-02 · base: `main` d8b6d6fd (0.17.0-beta, schema 12) ·
target 0.18.0-beta (stage 1), later releases (stage 2)
**Author:** reviewer instance (first draft for the user); instance A verifies every
standard reference against the licensed texts before anything is decided.
**Inputs:** `iec-62443-4-2-cra-coverage.md` §6 (gaps P-1 … P-7), §7.1 (D-1 … D-31),
§11 (fields F-1 … F-28); review 2026-11-02 (reviewer) of §11; user 2026-11-02:
"a sub-tab per standard in the Compliance tab, shown when a regulation tag of that
standard is set — so the regulations can be changed later".

Nothing in this document is decided until the user decides the K-points in §9.
Requirement texts are paraphrased; the standards are authoritative and never committed.

---

## 1. Purpose and scope

Two strands that belong together:

1. **Model coverage** — DFD element properties that let the model show what the type C
   rows ask for today only by a statement (§11 of the coverage document: 31 of 90 CRA
   rows, 44 of 122 classic rows). The fields describe the product, not a regulation:
   threat generation, the closed loop, mitigation effects and every matrix read the same
   field.
2. **Multi-standard Compliance tab** — the tab becomes a frame with **one sub-tab per
   standard**, shown when a regulation tag of that standard is set. A standard is a data
   module on one evaluator. Today only IEC 62443-4-2 (classic, CRA edition) exists; ETSI
   EN 303 645 and EN 18031-1/-2/-3 are the next candidates, EN 50742 approach B later.

| Stage | Release | Content |
|---|---|---|
| 1 | 0.18 | sub-tab frame + standard registry; both 62443 editions as sub-tabs; cross-cutting field rules (§3); stage-1 fields (§4.2) with form, evaluator rules, report rows, golden tests; schema 13 (§6) |
| 2 | 0.19+ | remaining fields (§4.3); threat generation and closed-loop coupling of the new fields; ETSI EN 303 645 and EN 18031 modules after their texts are verified (§8) |

Out of scope: process requirements (IEC 62443-4-1, CRA Annex I Part II) except the
project-level support data of F-28; Annex H threat list (D-10).

## 2. Architecture — the Compliance frame

### 2.1 Standard registry (replaces `selectEdition`)

Today `selectEdition(tags)` returns one `Edition`; with both 62443 tags the CRA edition
wins (D-3). The registry returns **every** active standard:

```ts
/** A standard the Compliance tab can evaluate — data only, no code of its own. */
interface StandardModule {
  id: StandardId;                 // "iec-62443-4-2-2019" | "en-iec-62443-4-2-praa-2026" | …
  family: StandardFamilyId;       // "iec-62443-4-2" — statements and component shared inside
  tags: readonly string[];        // regulation tags that show the sub-tab
  edition: Edition;               // rows, groups, requirement ids (existing type, generalised §2.3)
  header: "security-levels" | "conformance";  // SL-T / SL-C per FR, or a conformance summary
  draft: boolean;                 // e.g. prAA enquiry draft — shown as such
}

function activeStandards(tags: Pick<ProjectTags, "regulation">): readonly StandardModule[];
```

- Lives in `features/compliance` (pure, imports `shared` only — unchanged boundary).
- **D-3 is superseded** (K-1): with `IEC 62443` and `EN IEC 62443 (CRA)` both sub-tabs
  appear. D-31 (statements per requirement, shared by both editions) makes this cheap.
- The generic `CRA` tag still selects no matrix (D-1 unchanged).

### 2.2 Sub-tabs

- The frame is **inside** `compliance-tab.tsx`: the workspace passes the list of active
  standards and the project data; the sub-tab state is local to the tab. This keeps the
  change in `workspace-layout.tsx` to the one place that computes `complianceEdition`
  today (line ~1136) — no conflict with MT-1 beyond that line (K-8).
- Sub-tab order: registry order (62443 CRA, 62443 classic, EN 303 645, EN 18031 …).
  The last selected sub-tab is a per-viewer convenience (localStorage, wrapped in
  try/catch).
- Shared building blocks per sub-tab: component selector, header (by `header` kind),
  row table, statement dialog, requirement info dialog, to-do list, quick guide. A new
  standard adds data, not components.

### 2.3 Generalising the edition model

`EditionRow.fr: FoundationalRequirement` and `SlVector` are 62443 concepts. For other
standards:

- `EditionRow.group: string` (62443: the FR id; EN 303 645: the provision group, e.g.
  "5.1"); the edition lists its groups with i18n keys.
- `minSl` stays optional and is used only when `header === "security-levels"`.
- Requirement ids get a **namespace per family** (`iec62443:cr-1.1`, later
  `en303645:5.1-1`) — K-4. Evidence rules stay keyed by requirement id; families may
  reuse rule *building blocks* (the shared target constants of `evidence-rules.ts`),
  never another family's ids.

### 2.4 Project data — one block per family

```ts
interface ComplianceData {
  /** Default component for every family without its own (D-7). */
  componentId?: string;
  families?: Partial<Record<StandardFamilyId, FamilyComplianceData>>;
}
interface FamilyComplianceData {
  componentId?: string;           // overrides the default (K-5)
  target?: Partial<Record<string, TargetLevel>>;   // per group; 62443: SL-T per FR
  deviceCategories?: DeviceCategoryChoice;          // 62443 classic only
  statements?: Record<string, ComplianceStatement>; // key: requirementKey (D-31)
}
```

- Schema 13 moves today's top-level `target`, `deviceCategories`, `statements` 1:1 into
  `families["iec-62443-4-2"]` (§6). K-2 decides whether to reshape or to keep the 62443
  fields at the top level and add `families` for the others only.
- **Removing a tag keeps the data.** The sub-tab disappears; component, target and
  statements stay in the file and return with the tag. The report shows active
  standards only. K-3: the verification hash keeps covering the data of hidden
  standards (recommended — a tag change is not an analysis change, and dropping data
  from the hash on a tag change would make the verification depend on the tags).
- **Statements are shared inside a family, never across families** (K-6). EN 303 645
  5.1 and CR 1.5 are related, not equal. Across families the shared basis is the model
  fields of §4; the UI may show "see also: statement on CR 1.5 (IEC 62443)" as a link,
  never as evidence.

### 2.5 Report

One chapter per active standard, built from the existing chapter (IEC-7) with the
header kind as the only variable part; CLI chapter list and pdfmake included.

## 3. Cross-cutting rules for every new field

These hold for every field of §4 and are tested once, generically.

| # | Rule | Why |
|---|---|---|
| R-1 | **Default `not_specified`** for every new enum; evaluator reads it as `unknown` (D-12). A boolean field is three-valued (`not_specified` / `yes` / `no`) like the session switches of P-2. | An unfinished model never looks better than a complete one. |
| R-2 | **No positive or worst-case default, no derived value written on load.** Threat generation treats `not_specified` exactly as today. | Existing projects keep their threats, risks and verification hash — schema 13 stays analysis-preserving for them (§6). |
| R-3 | **One visibility predicate per field**, defined once in `shared/models/property-visibility.ts` (pure): form, evaluator, threat generator, closed loop and report call the same predicate. | One truth for "shown when"; the evaluator may not import `features/dfd`. |
| R-4 | **A hidden field is ignored everywhere but kept in the file** (K-7). When the driver changes back, the value returns. The evaluator treats a hidden field like an absent one; a conformance test checks that every consumer reads the field through the predicate. | Avoids the recurring "stale dependent field" bug class without silent data loss. |
| R-5 | **One source per capability.** Before a field is added, the plan names the existing property it would duplicate and decides (§4.1). | Two sources contradict each other sooner or later. |
| R-6 | **Element or component** is decided per field (§4.2 column "on"). Component-wide capabilities sit on the Multiprocess; a black-box Multiprocess (D-30) carries the per-element fields too (option c). | Matches D-13 (quantifier) and D-22 (allowlist of `any`). |
| R-7 | Every field: i18n label, help text and value labels EN + DE; report row in the element property table; doc description. | TARAflow code rule (all user-facing text via i18n). |
| R-8 | A field changes a matrix row's type only with a golden test on an example that shows the row before and after (§7). | Keeps the coverage document's counts and the code in step. |

## 4. Fields

### 4.1 Triage of §11 (review 2026-11-02)

| § 11 field | Proposal | Reason |
|---|---|---|
| F-5 `loginAttemptLimit` | **drop**; close P-7 instead (carry `interfaceIds` of the flow into the property view, read the existing `Interface.implementedControls.abuseProtection` = `lockout`) | R-5 — the capability already exists on the interface |
| F-13 `timeSource` | **keep as field**, close P-4 for the time source (no EE type "time_source"); keep the EE type "siem" question for CR 6.1 RE(1) open | one source; a field is cheaper than a modelling convention |
| F-17 `sessionIdsRandom` | **rename** `sessionControl.sessionIntegrity`, type **B** with checklist (unique, random, invalidated at logout, bound to the session) | CR 3.8 is more than random ids |
| F-25 `securityConfiguration` | **split**: `secureByDefault` (CRA Annex I (2)(b), EN 303 645) and `securityConfigReporting` (CR 7.6, RE(1)) | two requirements, two answers |
| F-28 support data | **project level** (Overview), not an element; no matrix row in 62443-4-2 | CRA Annex II / 62443-4-1 — process, report header only |
| others | as in §11, names to be confirmed in §4.2 / §4.3 | — |

### 4.2 Stage 1 (0.18) — CRA essentials and EN 303 645 core

Selection: fields that close CRA Annex I Part I points and the first three EN 303 645
provisions, need no threat-generation change, and turn C rows into A/B.

| # | Field | On | Shown when (R-3) | Values (`not_specified` first, R-1) | Rows after (62443) | CRA Annex I / EN 303 645 (prelim.) |
|---|---|---|---|---|---|---|
| F-1 | `userAccounts` | Process, Multiprocess | a human neighbour (D-24) and authentication ≠ none | individual · shared | CR 1.1 RE(1) → A | (2)(d) / 5.1 |
| F-2 | `passwordPolicy` | Process, Multiprocess | authentication = password | none · fixed · configurable · configurable with lifetime | CR 1.7 → A, RE(1)/(2) → A | (2)(d) / 5.1 |
| F-3 | `defaultCredentials` | Process, Multiprocess | authentication ≠ none | none · unique per device · set at first use · universal | — (CR 1.5 item a, checklist) | (2)(b)(d) / 5.1-1, 5.1-2 |
| F-22 | `userDataDeletion` | DataStore with personal data, Multiprocess | store holds personal data | none · by the user · by factory reset | — (CR 4.2 / 7.9 checklist) | (2)(m) / 5.11 |
| F-25a | `secureByDefault` | Multiprocess | always | not specified · yes · no | — | (2)(b) / 5.6 (prelim.) |
| F-25b | `securityConfigReporting` | Multiprocess | always | none · readable · machine-readable | CR 7.6 → A, RE(1) → A | — |
| F-27 | `updateNotification` | Multiprocess, Process with `updateMechanism` | `updateMechanism` ≠ none | none · user notified · automatic with notice | CR 3.10 RE(2) B → A | (2)(c) / 5.3 |
| F-28 | support contact, support period | project (Overview) | always | text · date | — | Annex II / 5.2 |

Open per field (instance A against the texts): exact value lists, whether F-2 / F-1
belong on the interface instead (§11 open point), the CRA letters.

### 4.3 Stage 2 (0.19+)

F-4, F-6, F-7, F-8, F-9, F-10, audit cluster F-11, F-12, F-13, F-14, F-15, F-16, F-17
(as `sessionIntegrity`), F-18, F-19, F-20, F-21, F-23, F-24, F-26 — specified with the
same columns as §4.2 before stage 2 starts, plus per field:

- **threat generation**: which threat it adds, removes or modulates when set, and the
  guarantee that `not_specified` keeps today's output (R-2);
- **closed loop**: whether it is a control property (SHOULD / IS, Apply);
- **mitigation effects**: catalog mitigations whose DFD effect sets it (D-29).

## 5. Evaluator and rules

- New fields enter `evidence-rules.ts` as ordinary `PropertyCheck`s; the conformance
  test (D-15, D-18) covers them automatically once `element-properties.ts` has them.
- The evaluator applies R-4 through the visibility predicate before it reads a field
  (a hidden field = unset → `unknown` only where the rule needs it; where the predicate
  is false the element is usually not applicable anyway).
- D-23 (`custom` on A rules → `unknown`) applies to the new enums unchanged.
- The coverage document's counts (§4 "Count") and the edition files are regenerated by
  the existing script; the completeness test keeps them equal.

## 6. Schema 13 — one fence for 0.18

Contents (each a pure function in its own file, one call line in `migrate-12-to-13.ts`):

| Step | Change | Analysis-preserving? |
|---|---|---|
| S13-a | new optional fields of stage 1 (additive) | yes — no value changes |
| S13-b | `ComplianceData` reshape into `families` (if K-2 = reshape) | yes, 1:1; verification re-sealed on load (as P-1) |
| S13-c | FX-6 path keys (AND gate = one path) + FX-5 relink, release plan 0.18 | **no** for files with AND gates in attack trees |

The current mechanism declares preservation **per version number**
(`ANALYSIS_PRESERVING_MIGRATIONS`): with S13-c in schema 13, every 0.17 verification
would become invalid — also for projects without a single AND gate. K-9: let a
migration step report per file whether it changed an analysis value (S13-c: only when
a tree has an AND gate with several leaves); the version stays analysis-preserving for
the other files. Alternative: FX-6 in its own schema 14.

Older releases: 0.17 refuses schema 13 (existing guard, verified on 0.16.1 for 12).

## 7. Tests

- **Generic** (once): every new field has `not_specified` as default and is
  three-valued where boolean (R-1); every field has a visibility predicate and every
  consumer uses it (R-3, R-4 — a source-level test like the single-writer guard);
  i18n completeness EN / DE for labels, help, values (R-7).
- **Per field**: visibility on driver change and back (value kept, ignored while
  hidden); evaluator row before / after; report row.
- **Golden tests on the examples** (R-8): Pump Station, SmokeDetector-leveled (fixture),
  Headlamp — row status per edition before and after each field step; an unset field
  never improves a row.
- **Registry / sub-tabs**: both 62443 tags → two sub-tabs; tag removed → sub-tab hidden,
  data kept, hash unchanged (K-3); tag re-added → data back.
- **Migration**: S13-a/b round trip; verification re-seal; S13-c per-file preservation
  (K-9).

## 8. Other standards — conditions before a module is built

A module for ETSI EN 303 645 or EN 18031-x is built only when:

1. the licensed text is available to instance A (never committed; paraphrase only);
2. a coverage document like `iec-62443-4-2-cra-coverage.md` lists the provisions,
   their applicability and the model evidence, with the preliminary columns of §11
   verified or corrected;
3. the K-points of that standard are decided (e.g. EN 303 645 "M / R / C" status per
   provision as the conformance header; EN 18031 decision trees as checklists).

Until then the §11 columns for these standards are not shown in UI or report.

## 9. Open points (K) — options and recommendation

| # | Question | Options | Recommendation |
|---|---|---|---|
| K-1 | Both 62443 tags set | (a) CRA wins (D-3) · (b) two sub-tabs | **b** — supersedes D-3 |
| K-2 | Project data for several families | (a) reshape into `families` (schema 13, 1:1) · (b) 62443 at top level, `families` only for others | **a** — one shape for all; one-time re-seal |
| K-3 | Hash coverage of hidden standards | (a) keep covering · (b) only active standards | **a** — a tag change is not an analysis change |
| K-4 | Requirement ids across families | (a) namespace per family · (b) flat ids | **a** — avoids collisions, D-11 stays per family |
| K-5 | Component per standard | (a) one for all · (b) per family with shared default | **b** |
| K-6 | Statements across families | (a) shared · (b) per family, "see also" link | **b** |
| K-7 | Hidden field on driver change | (a) keep + ignore · (b) reset | **a** — reversible, no silent loss; tested via R-3/R-4 |
| K-8 | Order to MT-1 (workspace split) | (a) MT-1 first · (b) frame inside the tab, one line in the workspace | **b** — independent of MT-1 |
| K-9 | FX-6 and analysis preservation | (a) per-file preservation report · (b) FX-6 in schema 14 · (c) accept invalidation | **a** |
| K-10 | Stage-1 field list | as §4.2 · smaller · larger | **as §4.2** |
| K-11 | Triage §4.1 (drop F-5, F-13 as field, split F-25, F-17 as B) | accept · change | **accept** |

## 10. Steps (0.18, stage 1)

Each step is one patch (`.diff` + `.msg`), CI green on its own, design-document status
updated. Owner suggestions: A = standards strand, B = maintenance strand.

| Step | Content | Depends on | Owner |
|---|---|---|---|
| CM-0 | this plan: K-points decided, standard references verified by A | — | A |
| CM-1 | standard registry `activeStandards`, generalised `EditionRow.group`, requirement id namespace (K-4) — no UI change, both editions still evaluate | CM-0 | A |
| CM-2 | sub-tab frame in `compliance-tab.tsx`, D-3 superseded, per-viewer last sub-tab | CM-1 | A |
| CM-3 | schema 13 skeleton (`migrate-12-to-13.ts`, fence, fixtures) + S13-b reshape + per-file preservation (K-9) | CM-0 | A |
| CM-4 | `property-visibility.ts` + generic tests R-1 … R-4 (no field yet) | CM-0 | A |
| CM-5 | F-1, F-2, F-3 (identity) — model, form, i18n, rules, report, golden | CM-3, CM-4 | A |
| CM-6 | F-27, F-25a, F-25b (lifecycle / configuration) | CM-5 | A |
| CM-7 | F-22, F-28 (data deletion, support data) | CM-5 | A |
| CM-8 | P-7: interface ids in the property view; CR 1.11 back to A (replaces F-5) | CM-1 | A |
| CM-9 | report: one chapter per active standard | CM-2 | A |
| CM-10 | validation on the examples, coverage document counts, this plan → status | all | A |

FX-5 / FX-6 (S13-c) join the schema-13 fence of CM-3 when the 0.18 release plan
schedules them.
