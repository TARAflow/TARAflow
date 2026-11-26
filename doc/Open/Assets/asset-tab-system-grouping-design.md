# TARAflow — Asset tab grouped by system asset

**Status:** draft v0.2 · 2026-11-26 · planned for 0.21 · v0.2: G2 decided — `held_by`,
not `belongs_to` (user 2026-11-26) · v0.1: idea Juergen (2026-11-26), first cut from the
discussion of the same day · the open decisions in §5 must be settled before any code.

---

## 1. Goal

In a machine TARA built from component TARAs, each component is a **subsystem** from the
machine's point of view: a system asset with its own function assets, and the data those
functions work on. The Asset tab should be able to show the assets in that structure —
*system → its functions → their data* — instead of one flat list per asset group, so the
analyst sees which subsystem an asset belongs to.

The grouping is a **view**. It changes no file content, no threat and no risk result
(roadmap rule 1 and 2: 0.21 already carries the block that changes threat results).

## 2. Starting point (0.20)

- **Asset groups:** `data`, `function`, `system`, `infrastructure`, `process`, `physical`,
  `service`, `human` (`shared/models/asset-group-types.ts`).
- **Asset-to-asset relations** are the canonical place for relations between assets
  (`assets.relations[]`, asset graph D1). The rules (`shared/models/asset-a2a-rules.ts`)
  already allow the edges this view needs:

  | From → to | Allowed relation types |
  |---|---|
  | system → system | `integrates`, `depends_on` |
  | system → function | `implements`, `depends_on` |
  | function → system | `implemented_by`, `depends_on` |
  | process → system | `runs_on`, `depends_on` |
  | function → data | `creates`, `reads`, `modifies`, `deletes` |
  | data → function / process | `required_by`, `configures` (process also `consumed_by`) |
  | data → system | `configures` **only** |

  There is **no neutral relation from a data asset to a system** ("is kept by"):
  `configures` is wrong for, e.g., audit logs or measured values. `belongs_to` is not a
  candidate: the relation documents use it for data → human in the sense of ownership /
  data subject ("Medical Records → belongs_to → Patients", `doc/taraflow-asset-relations.md`),
  as a documentary extension (asset graph process view, D13 (b)). Using it for data →
  system as well would give one type two meanings.
- **The Asset tab already groups by DFD structure** in a leveled DFD (leveled DFD D20,
  `features/assets/utils/asset-groups.ts`): one section per top-level decomposed
  multiprocess, then *Top level*, *Shared* (assets held in several multiprocesses) and
  *Not in the DFD*. An imported component instance is a sub-DFD, so a machine TARA with
  components is grouped by instance today. This grouping is by **where an asset appears
  in the diagram**, not by what the asset model says.
- **Imported assets** carry `importedFrom` (the component instance, e.g.
  `SD1 · Smoke Detector`).

## 3. What the new grouping adds over D20

1. **Semantic, not positional.** A function or data asset is grouped by its relations to
   a system asset, also in a classic (single-page) DFD and for assets that are not on a
   decomposed multiprocess.
2. **Structure inside a group:** the system asset first, its functions below it, the data
   of those functions below them (indented rows or a sub-accordion — G4).
3. **Assignment of data** where the diagram says nothing (data kept in a store on the top
   level but produced by a subsystem's function).

If 1–3 bring too little over D20 in practice, the cheaper alternative is G1 (b): keep the
D20 sections and only name each section by the system asset linked to its multiprocess.

## 4. Rules (proposal)

| ID | Rule |
|---|---|
| R1 | A **system asset with no system asset above it** (no incoming `integrates`) is a group. A system integrated by another is a sub-group of it (one level deep in the first cut — G5). |
| R2 | A **function** belongs to the system that `implements` it (or that it is `implemented_by`). |
| R3 | A **process** belongs to the system it `runs_on`. |
| R4 | A **data asset** belongs to the system of the functions that `create` or `modify` it (R2). Reading alone does not assign it. |
| R5 | An **explicit data → system relation** `held_by` (G2) overrides R4. |
| R6 | An asset that R2–R5 give to **several systems** appears in each of them, marked *shared*, and once in a *Shared* section (as D20 does) — G3. |
| R7 | An asset that no rule assigns goes to **Not assigned**. This section is also a modelling hint: it shows the relations that are missing. |
| R8 | **Imported assets without relations** fall back to their component instance (`importedFrom`) as the group. |
| R9 | Assets of the other groups (infrastructure, physical, service, human) stay in their own sections, unchanged. |
| R10 | The grouping has **no effect on ratings**: a system asset does not inherit the highest impact of its functions. That would be a method decision (risk-factor design, impact aggregation), not a view. |

## 5. Open decisions

| ID | Question | Options | Recommendation |
|---|---|---|---|
| G1 | Relation to the D20 grouping | (a) a second grouping mode next to D20 (switch *by diagram* / *by system*); (b) no new mode: D20 sections named by a system asset linked to the multiprocess / component instance; (c) replace D20 | (a) for leveled and classic DFDs alike, D20 stays the default where it applies today. Decide after looking at one real machine TARA (Müller Martini, EM2) in both views — if (b) answers the question, take (b). |
| G2 | Explicit data → system assignment | **Decided (user 2026-11-26): a new relation type `held_by`** (data → system: the system holds the data and is in charge of protecting it; inverse name *holds*). Additive type, no schema version — as D12 of the process view. Not taken: `belongs_to` (already means ownership / data subject, data → human); `owns_by` / `owned_by` (not idiomatic, or reads as ownership by a person or organisation, the concept kept out in §9, and clashes with `owns` of human → physical); `configures` only (wrong for most data); a new field on the asset (contradicts D1, needs a field-purpose register entry). | — |
| G3 | An asset in several systems | (a) in each system, marked *shared*, plus a *Shared* section; (b) only in *Shared*; (c) in the first system only | (a) — hiding it in one place hides a dependency between subsystems. |
| G4 | Presentation inside a group | (a) indented rows in the existing table (system, then functions, then data); (b) a sub-accordion per system; (c) a tree column | (a): one table, sorting and filters keep working. |
| G5 | Depth of `integrates` | (a) one level (system → subsystem); (b) any depth | (a) in the first cut; deeper nesting when a reference project needs it. |
| G6 | Where the setting lives | (a) a switch in the Asset tab toolbar, remembered per viewer; (b) a project setting in the file | (a) — a view setting does not belong in the file (no audit noise). |
| G7 | Component import | (a) no change — R8 groups by instance; (b) the import creates or links a system asset for the instance and relates the component's functions to it | (a) first. (b) changes the import (and the snapshot) and is a component-TARA decision of its own. |

## 6. Requirements

| ID | Requirement | Level |
|---|---|---|
| FR-G1 | A pure function `systemGroupsOf(assets, relations)` returns the sections, the order inside each section and the *shared* / *not assigned* assets by R1–R9. No React, no DFD access — the asset feature only. | MUST |
| FR-G2 | The Asset tab shows the grouping on demand (G1, G6); default as today. | MUST |
| FR-G3 | *Not assigned* names, per asset, which relation would assign it (e.g. "no system implements this function"), as a link into the asset graph. | SHOULD |
| FR-G4 | "Show in table" from the asset graph opens the asset's group (as D20 does). | MUST |
| FR-G5 | `held_by` (data → system, G2) in `A2ARelationType`, the rules, the inverse name *holds*, its STRIDE / dependency classification (process view D10), i18n (en/de), the relation documents and the cheat sheet; older versions report it as an unknown type (release note). | MUST |
| NFR-G1 | No file change from viewing; the results dump of all example projects stays SAME. | MUST |
| NFR-G2 | All user-facing text through i18n (en/de); no dependency on another feature (depcruise `no-feature-to-feature`). | MUST |

## 7. Steps

1. Settle G1 and G3–G7 (G1 with one real machine TARA in front of us); G2 is decided.
2. `systemGroupsOf` with unit tests: system with functions and data, data shared by two
   systems, a function without a system, `integrates` one level, imported assets without
   relations (R8), relations that point to deleted assets.
3. Asset tab: switch, sections, indented rows, *Not assigned* with its hints.
4. `held_by` (FR-G5) — rules, i18n, documents; validator test for older files.
5. Example project: one of the TARAflow_Examples gets system assets and relations, so the
   view has a reference (no change of threat results).
6. Results dump of all examples: SAME; component tests for the switch and the sections.

## 8. Definition of done

- The decisions G1–G7 are recorded in §5 with the date (G2: 2026-11-26).
- The grouping works for a classic and a leveled DFD and for a machine TARA with an
  imported component.
- Results dump SAME, field register unchanged (no new field), CHANGELOG and user
  documentation updated.

## 9. Not in this plan

- Impact aggregation over a system's functions (R10; risk-factor design).
- Grouping threats or risks by system asset (they follow the DFD groups of D20).
- Changing the component import (G7 (b)).
- **Ownership by a person or organisation** (asset owner in the sense of ISO/IEC 27001 or
  IEC 62443, data subject in the sense of the GDPR). Today only human → physical has
  `owns` / `responsible_for`; there is no human → data relation. A topic of its own,
  kept apart from `held_by` on purpose (user 2026-11-26).
