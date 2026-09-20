# Attack-tree structured leaf editor — implementation design (deferred)

Design note for open point **2** of `iso21434-support-design.md` ("labeled
dropdowns instead of raw DSL tokens"). Written to capture the analysis; the
feature itself is **deferred**. The quick-win subset (editor hover tooltips,
"A1") ships separately and does not depend on this.

---

## 1. Goal

Let an analyst set a leaf's attack-potential factors in the attack-tree tab via
five labeled dropdowns — same level names, ordering and per-entry tooltip as the
risk dialog's ISO factor rows — instead of hand-typing the audit DSL
(`et=1w,se=expert,kn=restricted,wo=easy,eq=standard`).

## 2. Why this is a feature, not a relabel (current state)

- There are **no** factor dropdowns today. Leaf ratings are free-text DSL typed
  in the **CodeMirror 6** editor (`attacktree-editor.tsx`); the file
  `attacktree-editor-monaco-backup.tsx` is dead history.
- The audit factors are only ever **parsed** (`attacktree-feasibility-parser.ts`)
  and consumed by the calculator/feasibility services. No component renders the
  parsed `AttackPotentialFactors` structurally.
- There is **no leaf/node selection state**, **no DSL write-back path**, and
  **no factors→DSL serializer**. `generateDSL` (`attacktree-parser.ts`) emits
  `simple` (`p=,i=`) and `extended` only — it does **not** currently serialize
  the audit `et=/se=/kn=/wo=/eq=` tokens, so the tree↔DSL round-trip is already
  lossy in audit mode.
- The attack-tree owns its **own** level keys (`le-1-day … gt-6-months`, plus
  shared `layman/…`, `public/…`, etc.) and its **own configurable** weight/band
  tables (`DEFAULT_ATTACK_POTENTIAL_WEIGHTS`, `DEFAULT_FEASIBILITY_BANDS` in
  `attacktree-feasibility-types.ts`) — not the risk-dialog core. This is the
  duplication flagged in open point 9.
- i18n: `attacktree:tabs.attacktree.feasibility.factor.{et,se,kn,wo,eq}` (factor
  names) and `.level.*` (band levels) already exist; factor **value** level
  labels (`le-1-week`, `proficient`, …) are added by A1 under
  `…feasibility.value.*`.

## 3. Architectural rules to respect

- **DSL stays the source of truth.** Audit mode requires all five factors; a
  partially rated leaf must refuse to parse (parser design note). The editor
  writes a complete factor set or nothing.
- **Feature boundary.** Do not import the risk feature's `ISO21434_FACTOR_LEVELS`
  or `risks.isoLevels.*` here — different keys (`le-1-week` vs `<=1week`) and a
  different namespace. Attack-tree levels/labels live in the attacktree feature.
- **Points come from the resolved feasibility weights**
  (`FeasibilityConfiguration.weights` ?? `DEFAULT_ATTACK_POTENTIAL_WEIGHTS`),
  **not** the risk core's fixed Table G.6 points. They agree today but are
  configurable — see point 9.
- **UX consistency with the risk dialog (point 1):** canonical G.6 order in the
  dropdown, clean level names in the label, attack-potential points in a
  per-entry tooltip (here sourced from the resolved weights).

## 4. Proposed design

1. **Leaf selection.** Add selection state so a leaf row/node in the table or
   tree view becomes the "active leaf" for editing. (New state; none exists.)
2. **Serializer.** Extend `generateDSL` (and add a single-line serializer) to
   emit audit factors: `et=<alias>,se=…,kn=…,wo=…,eq=…[,b=…]`, preserving the
   node's benefit, quick-mode fields, `@goal`, `[mitigations]` and inline
   comments. Round-trip test: parse → serialize → parse is stable.
3. **Structured editor panel.** For the active leaf, render five labeled
   dropdowns (reuse the risk-dialog pattern: canonical order, `value` = level
   index, per-entry tooltip with the resolved points). On change, rewrite **only
   that leaf's line** in the DSL via the serializer and feed it back through the
   existing `onDslChange`. Never rewrite the whole document blindly.
4. **i18n.** Reuse `…feasibility.factor.*`; consume `…feasibility.value.*`
   (added by A1). Add residual/summary strings if the panel shows an
   AP→band→feasibility readout.

Placement decision (open): additive panel beside the CodeMirror editor (DSL
stays primary) vs. a leaf-click dialog. Recommendation: **additive panel**, DSL
remains editable — lowest risk, no either/or migration.

## 5. Dependency / sequencing

Do **point 9 (consolidate the two feasibility tables) first**, or this panel
hard-codes a second points/level source into the UI that point 9 then has to
unwind. Order: (1) single level/weight source → (2) this panel on top.

## 6. Open questions

- Where does the panel live (beside editor vs. dialog)?
- Do we surface points in the dropdown tooltip here, given weights are
  project-configurable and not currently passed to the editor?
- Does writing back audit factors require the serializer to also learn quick
  mode and `extended`, to avoid a lossy round-trip on mixed trees?

## 7. Effort (rough)

Serializer + round-trip tests: M. Selection state + panel UI: M. i18n: S.
Gated behind point 9: S–M. Net: a multi-part feature, not a single patch.
