# Attack-tree tab — UI rework

**Status:** design, nothing implemented
**Replaces:** `attacktree-threat-generator-design.md` §10, Phase 8
("split-handle drag, rename, guarded delete" — too narrow, see §1)
**Depends on:** nothing. Unblocked and parallel to Phase 7.
**Related:** `mitigation-ownership-design.md` (surfaced by the table showing
mitigations per path), `safety-feasibility-coupling-design.md`

---

## 1. Why this is more than polish

Phase 8 was written as three small items. Working through 5b and Phase 6 on the
real UI showed the problem is structural rather than cosmetic:

- **Tree selection lives in the wrong place.** It is a dropdown inside the
  editor view and disappears entirely in the table view, where switching trees
  is just as necessary.
- **The "overview" is not one.** It exists as a `mainView` state with grouped
  accordions, but it reads as a settings page rather than the entry point to
  the tab.
- **The table view is a stranger.** It brings its own `<Table>`, its own
  filters and its own sort, while the Threat and Risk tabs share a common set
  of building blocks. Same data role, different look, different behaviour.
- **Only one of three panes can be resized**, and even that one has no handle.

Fixing these one at a time would mean touching the same components three
times. Hence one rework with a defined target state.

---

## 2. Decisions taken (not up for re-litigation here)

1. **One UI for both methods.** ISO and Standard differ in *content* — which
   leaf syntax is valid, whether benefit is shown — not in layout. Two parallel
   views would drift apart; the Risk tab already demonstrates the alternative,
   where project configuration drives which factors appear.
2. **Grouping follows the ISO model in both modes:** asset × security goal.
   ISO leans on attack trees more heavily, and the Standard view is served
   perfectly well by the same ordering.
3. **The pane arrangement stays as it is** — editor and preview side by side,
   threat list underneath. All three become resizable.
4. **The table view is modelled on the Risk tab's table**, with the generic
   parts promoted to `src/shared/components`.
5. **The table is where paths are decided, not edited.** It shows every path
   with its derived values and its mitigations, and the analyst confirms or
   dismisses each one. Structure and leaf ratings stay in the DSL — see §5.
6. **Every path is a candidate.** The emission policy is retired (DONE, step 5);
   the analyst decides which paths become threats — see §6.

---

## 3. Target structure

```
Attack Tree tab
├── Overview  (entry point)
│     grouped by asset × security goal
│     one card per tree: name, validity, coverage, actions
│     → select a tree → Detail
│
└── Detail  (one tree)
      ├── tree selector — always visible, in both views
      ├── view switch: Editor | Table
      │
      ├── Editor view          ├── Table view
      │   ┌──────┬──────────┐  │   ┌──────────────────┐
      │   │ DSL  │ Preview  │  │   │ paths as a table │
      │   ├──────┴──────────┤  │   ├──────────────────┤
      │   │ threat list     │  │   │ threat list      │
      │   └─────────────────┘  │   └──────────────────┘
```

The threat list stays visible in both views: it is the workflow gate between a
rated path and a risk (`collectAllThreats` filters unrated and not_relevant),
so hiding it behind one particular view is what made 5a look broken.

### Tree selector

Moves out of the editor into the detail header, above the view switch. Shows
the group (asset × goal) alongside the tree name, so the analyst keeps the
context the overview gave them.

### Resizing

Two persisted values instead of one:

| value | separates | persisted today |
|---|---|---|
| `editorWidthPercent` | DSL ↔ preview | yes |
| `detailBottomPercent` | upper panes ↔ threat list | no — new |

`useSplitViewResize` from `src/shared` is used for both rather than a second
drag implementation. Minimum sizes prevent a pane from being dragged shut;
collapsing stays an explicit action (the existing collapse button), not an
accident of dragging.

---

## 4. The shared table

### What is generic, what is not

Reading `risk-table.tsx` and `risk-columns.tsx`, the split is clean:

**Generic — belongs in `src/shared/components`:**
the column contract (`id`, `header`, `width`/`minWidth`/`flex`, `align`,
`renderCell`, `stopRowClick`, `onCellClick`), `colgroup`-based fixed layout,
header and body cell styling, ellipsis handling for flex columns, row hover and
click, the "pass the whole group to the row handler" convention, and the
`minWidth` calculation.

**Risk-specific — stays in `features/risks`:**
every column definition (STRIDE colours, MoSCoW, treatment, mitigation
coverage, implementation status, justification, rationale) and the row
background derived from `calculatedRiskBeforeMitigation` via `RISK_SCALES`.

The row colour is the *only* thing coupling `RiskTable` to the risk model.
Injected as a function, the coupling disappears entirely:

```ts
// src/shared/components/data-table.tsx

export interface DataColumn<T> {
  id: string;
  header: string;
  width?: number;
  minWidth?: number;
  flex?: number;
  align?: "left" | "center" | "right";
  renderCell: (row: T) => React.ReactNode;
  /** Stops row-click propagation on this cell. */
  stopRowClick?: boolean;
  /** Called on cell click instead of the row handler. */
  onCellClick?: (row: T) => void;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  /** Row background — the one thing the table cannot know itself. */
  rowBackground?: (row: T) => string;
  /** Receives the row and the full group it belongs to. */
  onRowClick?: (row: T, group: T[]) => void;
  /** The surrounding group, when it is wider than `rows`. */
  group?: T[];
}
```

`RiskTable` becomes a thin wrapper that supplies `rowBackground` and
`getRowId`; no call site in the Risk tab changes. The attack-tree table becomes
a second wrapper with its own columns.

### Attack-tree columns

Defined in `features/attacktree`, mirroring `useRiskColumns` in shape:

| column | content |
|---|---|
| path | the ROOT→leaf chain, indented as today |
| feasibility | level plus the derived value, in ISO terms where applicable |
| risk score | for Standard mode; hidden in ISO, where the number belongs to the risk |
| mitigations | chips with verification status — the existing `mitigationLookup` already provides this |
| relevance | the confirm/dismiss/uncertain control from the threat table |
| status | critical path marker |

Row background follows feasibility rather than a risk score — the same visual
language, driven by the quantity this table is actually about.

### What the table can and cannot change

The table shows **paths**; the DSL describes **nodes**. A leaf usually lies on
several paths, so "change this path's feasibility" has no single meaning — only
a leaf can be rated, and the rating affects every path through it.

That splits the content three ways:

| kind | examples | editable here |
|---|---|---|
| derived | feasibility level, risk score, critical marker | no — two truths otherwise |
| source | node names, leaf ratings, mitigations, gates | no — DSL is the source |
| decisions | relevance, `evalNote` | **yes** — they are not part of the tree |

Editing source data here would mean rewriting the DSL from the AST.
`generateDSL` exists, but a round-trip loses comments and formatting — the
`# Attack Tree: …` headers would not survive. Not worth it for a gain the
editor already provides.

The decisions live in `AttackPathAssessment` beside the tree, keyed by
`pathKey`, so editing them touches nothing in the tree. `evalNote` is already in
the model (`setPathAssessment`, `applyRelevanceDecision`) and has never had a UI
— the table is where it belongs.

**Mitigations are shown, not assigned.** They already come from the DSL:
`createThreatForPath` sets `proposedMitigations` from `path.mitigations`, and
`createEmptyRisk` copies them into the risk. Assigning them again here would
create a second source. The table displays them with their verification status
via the existing `mitigationLookup` — which is exactly what made the duplicate
ticket problem visible; see `mitigation-ownership-design.md`.

### Duplicate paths across trees

The same name chain in two trees yields the same `pathKey` — it is a content
hash. That is easy to detect (`findPathKeyCollisions` already does it within one
analysis; across trees it is one map).

But in most cases these are **not** duplicates. Two trees are anchored on
different asset × security-goal pairs, so the same chain describes two different
threat scenarios: ISO 3.1.33 defines a threat scenario as the compromise of a
property *of an asset*, and the impact follows the asset. Two confirmations are
correct there, not redundant.

So: **mark, do not merge.** The row shows that this path also occurs in tree X
(asset Y). The analyst still decides per tree, but informed. Carrying a decision
across trees would need a project-level store and would conflate scenarios whose
impact differs; de-duplicating at emission would lose the asset attribution
outright.

Two trees with the *same* anchor carrying the same path is a modelling error and
belongs in the validator, not in de-duplication logic.

Where the real cost is repetitive confirmation rather than correctness,
multi-select in the table solves it without touching the model — and works for
paths that are merely similar, not only identical.

### Filters and sorting

The Risk tab filters through a separate `RiskFilters` component above the
table. The attack-tree table currently builds its own inline. Aligning means
using the same pattern; whether `RiskFilters` itself is generic enough to
promote is a question for implementation, not for this document.

---

## 5. Rename and guarded delete

Both are actions on a tree card in the overview.

**Rename** writes through `updateTree({ ...tree, name })`. One rule needs
settling: an asset-anchored tree's name is generated from asset and security
goal at creation. A manually renamed tree must not be overwritten by the next
asset sync — so a renamed tree needs a marker (`nameIsManual`, or simply
"never regenerate a name that differs from the generated one").

**Guarded delete** replaces the generic confirmation. What is at stake is
concrete and countable: rated paths (`pathAssessments`) and the risks that grew
out of them. A tree with no assessments can go with a plain confirm; one with
assessed paths states how many decisions and how many risks in the Risk tab
disappear with it. The Class B principle from path identity applies —
never silently drop a decision the analyst made.

---

## 6. Emission: every path is a candidate  *(DONE — step 5, 2026-07-24)*

`selectEmittablePaths` used to apply a `PathEmissionPolicy`, defaulting to
`cheapest-per-goal`: per attack goal, only the most feasible path becomes a
threat. The justification is 15.8 NOTE 2 — the attacker takes the easiest route
— and the concern that a tree with 50 leaves would bury the analyst.

Two problems.

**The tie-break is arbitrary.** `FEASIBILITY_RANK` is an ordinal four-level
scale, so "barely cheaper" almost always means *the same level*. The code then
decides by `riskScore` and, failing that, by `pathKey.localeCompare` — the
alphabetical order of a hash. A path that is exactly as feasible disappears from
the register because of a string comparison. At equal rank there is no easiest
route; there are two.

**The tool decides what the analyst should.** Which paths constitute threat
scenarios is an analyst judgement, and under a policy it is neither visible nor
recorded.

**Resolution, now implemented: the policy is gone.** `selectEmittablePaths` is
just the `isEmittable` filter; `PathEmissionPolicy`, its tie-break, and the
`FEASIBILITY_RANK` import it needed are removed. `EmissionOptions` keeps only
`suppressNegligibleBenefit`. Every path is a candidate; the analyst confirms or
dismisses each one in the table. The gate already exists — `collectAllThreats`
filters `unrated` and `not_relevant` — so nothing reaches the register
unconfirmed, and the count is analyst-controlled rather than rule-derived. The
burying concern was written before the table existed as a working surface. A
regression test pins that two equally-feasible siblings are now both emitted —
the exact case the string-comparison tie-break used to drop.

One restriction stays: a path with **no feasibility rating** is never emitted.
It has no likelihood and would sit in the register looking like the safest thing
in the project. It still appears in the table, greyed, so the unfinished work is
visible rather than hidden.

`suppressedPaths` keeps its purpose — it now reports paths the analyst
dismissed, and unrated ones, with a reason, for the report.

This is asset-anchored behaviour. Threat-anchored trees aggregate all paths into
one risk (`aggregatedLikelihoodLevel`, the 15.8 maximum), so per-path
confirmation does not map onto separate risks there; they are handled
separately.

---

## 7. Mode handling

The mode is already known project-wide (feasibility configuration). It drives
content only:

| | ISO | Standard |
|---|---|---|
| leaf syntax accepted | attack-potential (`et=…,se=…,…`) | `f,b,i` or `p,i` |
| benefit shown | no — never enters the risk number | yes |
| risk-score column | hidden — the number belongs to the risk | shown |
| feasibility column | Annex G level plus factors | derived value |

No component exists twice. Where a difference is larger than a hidden column,
it belongs in the DSL validator, which already enforces the ISO rules.

---

## 8. Implementation plan

Each step is independently shippable and green.

**Step 1 — promote the table. DONE.** `DataTable<T>` and `DataColumn<T>` in
`src/shared/components`; `RiskTable` a wrapper. Covered by `data-table.test.tsx`.

**Step 2 — attack-tree table on the shared base. DONE.** `attacktree-path-columns.tsx`
+ `attacktree-tableview.tsx`; the bespoke `<Table>` is gone. Relevance renders one
control per STRIDE category and is show-vs-edit gated — both pinned by
`attacktree-path-columns.test.tsx`. Row tint was dropped; feasibility is shown by
sort order instead, so the green/red/orange of relevance is unambiguous.

**Step 3 — detail layout. DONE.** `attacktree-detail-view.tsx`: tree selector in
the detail header, Editor|Table switch, threat list in both views, two draggable
dividers via the new controlled `useSplitPercentResize`. The view switch calls
`parseImmediately`.

**Step 4 — overview. NOT STARTED — the only remaining step.** Grouped by asset ×
security goal (already the case), cards with rename and guarded delete. Rename:
the derived-title design (utils/attacktree-labels.ts) already means a stored
`tree.name` = "the analyst chose this", so the rule is "a stored name wins over
the derived title, and asset sync must not overwrite it". Guarded delete: the
confirm dialog must name the countable stakes — the tree's rated `pathAssessments`
and the risks grown from them — not ask generically.

**Step 5 — retire the emission policy. DONE (2026-07-24).** See §6.

Steps 1-3 and 5 are done and committed; step 4 is all that remains.

---

## 9. Open points

1. **Is `RiskFilters` generic enough to promote**, or does the attack-tree
   table get its own filter bar? Decide when Step 2 is implemented.
2. **Rename marker** — a `nameIsManual` flag, or inferred by comparing against
   the generated name? The flag is explicit; the comparison avoids a field.
3. **Overview grouping for threat-anchored trees.** Asset × security goal is
   the ISO ordering, but a threat-anchored tree hangs off a threat, not an
   asset. Group it under the asset its threat targets, or as its own group?
4. **Does the table view need the preview at all?** Today the two are
   alternatives. Now that the table is the deciding surface rather than a second
   reading of the editor, the preview looks more like a companion to the editor
   than a sibling of the table.
5. **View switching must force a parse.** `handleDslChange` parses 500 ms after
   the last keystroke, so switching to the table straight after typing would show
   the previous analysis. `parseImmediately` exists in `useAttackTreeEditor` and
   is currently unused — the view switch is its call site.
6. **Threat-anchored trees** aggregate into one risk, so per-path confirmation
   does not apply. What the table offers there is still open: read-only path
   list, or confirmation that only affects which paths feed the aggregate?
