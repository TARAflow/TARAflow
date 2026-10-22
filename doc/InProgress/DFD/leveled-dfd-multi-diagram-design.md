# TARAflow — Leveled DFDs (Multiple Diagrams per Project) — Design

Status: rev. 4.5 — decisions D1–D19 locked (§15) · Phase 0 done · Phase 1 done (identity, occurrences, adoption logic) · Phase 2 done (effective model, analysis graph, adopted multi-page DFDs analysable, schema 9) · Phase 3 done (hierarchical numbering, duplicate reassignment) · Phase 4 done (leveled findings, refines / abstract) · Phase 5 done (UI, 5a–5l) · Phase 6 next
Author: (Juergen) · Date: 2026-10-13
Location: `doc/InProgress/DFD/` (code comments reference the file name only, so moves need no code change)
Running example: a leveled version of the `SmokeDetector` example project (§3)

Revision history (short):

- rev. 1–3.1 — concept, decisions D1–D13, three review rounds (occurrence model, identity
  lifecycle, stitching algorithm, threat lifecycle, error policy, interface chain, dangling
  definitions, adoption, containment parent).
- rev. 3.2 — findings from implementing Phase 1.1: TARAflow has no `via` attribute, the interfaces
  of a flow are determined geometrically (§6.2.1); lazy identity instead of an XML migration
  (§5.2, §11.2); compressed pages are not decoded (§11.1).
- rev. 4 — all examples rebuilt on a self-made leveled Smoke Detector (§3, §16). No external or
  customer model is used anywhere in this document, its tests or fixtures.
- rev. 4.1 — identity links live in the project (`dfd.pages[].links`) instead of `tfId`/`tfRole`
  attributes in the XML; the XML stays plain draw.io and every identity action is a JSON change
  (§5.2). Pasted copies are linked via an assignment dialog, shared with adoption (§5.2, §11.2.1).
- rev. 4.2 — D14: interfaces inherit physical and chip boundaries, not trust boundaries (§6.3);
  generated three-page Smoke Detector checked against the single-page original (§13, Phase 2 gate).
- rev. 4.3 — D15–D17: a child page is created automatically with every multiprocess, but the
  decomposition takes effect only with the page's first own part; tab name = multiprocess name;
  the root page is *Top* (§5.3, §6.1, §12).

## 1. Goal

Allow one TARAflow project to hold **several DFD pages** that form a **leveled DFD**: a top-level
system diagram plus child diagrams that decompose individual multiprocesses (e.g. `MP-2 Controller
Module` → Alarm Processing, Fire Panel Communication, WiFi Manager, …).

The analyst models at the level of detail each part needs, while TARAflow keeps **one** element
namespace, **one** asset register and **one** threat/risk register for the whole project.

## 2. Relation to `multi-diagram-linking-design.md`

That document (convenience link from a process to *another project file*) explicitly parked DFD
leveling/balancing because the linked file is **independently versioned** — copied state across
files always drifts.

This design is different in the one point that mattered: **all pages live in the same
`.tara.json`, are saved in one write and committed in one signed commit.** There is no
cross-file transaction problem, so balancing becomes tractable. Both features stay separate (D6):

| | Cross-project linking (existing doc) | Leveled DFD (this doc) |
|---|---|---|
| Scope | several `.tara.json` files | one `.tara.json`, several pages |
| Consistency | not guaranteed (soft cross-check at best) | enforced by one model + validator |
| Threat/risk register | per file | one per project |
| Typical use | separate products / supplier subsystems | one product, different abstraction levels |

## 3. Running example: the leveled Smoke Detector

The single-page `SmokeDetector` example (TARAflow_Examples) already has two natural subsystems,
separated by its two trust boundaries: the **sensor** (`SB`) and the **controller** (`CB`), linked by
an RS485 bus. Leveled, it becomes three pages. This example is the basis of the Phase 2 golden
fixture.

**Page *Top*** (root, `pageId sys`; the root page is always named *Top*, D17)

| Element | Notes |
|---|---|
| `MP-1 Sensor Module`, `MP-2 Controller Module` | multiprocesses, each decomposed on its own page |
| `EE-1 Debugger`, `EE-2 Fire Panel`, `EE-3 Maintenance Technician`, `EE-4 WiFi Gateway`, `EE-5 Update Server` | external entities |
| `SB Sensor Boundary` around `MP-1`, `CB Controller Boundary` around `MP-2` | trust boundaries |
| `PB Smoke Detector Case` around both | physical boundary — drawn **only** on *Top* |

| Flow | Drawn on *Top* |
|---|---|
| `DF-7 stream sensor data` | `MP-1 → MP-2` |
| `DF-9 pull calibration command` | `MP-2 → MP-1` |
| `DF-27 push alarm` | `MP-2 → EE-2` |
| `DF-34 push config` | `EE-3 → MP-2` |
| `DF-37 push firmware update` | `MP-2 → EE-4` |
| `DF-39 push firmware update` | `EE-4 → EE-5` (EE→EE) |
| `DF-8 pull debug commands`, `DF-18 push debug commands` | `EE-1 → MP-1`, `EE-1 → MP-2` |

**Page *Sensor Module*** (`sen`, decomposes `MP-1`): parts `P-1 Optical Detection`, `P-2 Sensor
Communication`, `P-3 Sensor Diagnostics`, `P-4 Sensor Update Handler`, `DS-1 Calibration`, `DS-2
Sensor Firmware`; interfaces `IF-1 RS485`, `IF-2 JTAG`; chip boundary `SDS`; context copies of `MP-2`,
`EE-1` and `SB`.

**Page *Controller Module*** (`ctl`, decomposes `MP-2`): parts `P-5 Alarm Processing` … `P-12
Firmware Update Manager`, `DS-3 … DS-5`; interfaces `IF-3 RS485`, `IF-4 JTAG`, `IF-5 Alarm Relay`,
`IF-6 Alarm`, `IF-7 WLAN`; chip boundary `SDC`; context copies of `MP-1`, `EE-1 … EE-4` and `CB`.

What the example shows:

1. **IDs are global.** `EE-1 Debugger` appears on all three pages and is one entity; no displayId is
   reused for a different thing.
2. **Reappearance = identity.** `MP-2` on the *Sensor Module* page is a **context copy** of the
   element defined on *Top*, not a new element.
3. **Flows are split across pages ("half-refinement").** `DF-7 stream sensor data`:

   | Page | Source | Target | crossed interface |
   |---|---|---|---|
   | Top | MP-1 | MP-2 | – |
   | Sensor Module | **P-2** Sensor Communication | MP-2 | IF-1 |
   | Controller Module | MP-1 | **P-5** Alarm Processing | IF-3 |

   Neither child page alone knows both real endpoints. Only the combination yields the effective
   flow `P-2 → P-5` leaving through `IF-1` and arriving through `IF-3` — the two ends of the RS485
   bus. **This is the core mechanism the tool must implement** ("endpoint stitching", §6.2).
4. **1:n refinement.** *Top* shows one `DF-27 push alarm` to the fire panel. The *Controller
   Module* page shows it as `DF-27` (`P-6 → EE-2` via `IF-6 Alarm`, the data channel) **plus**
   `DF-19 push alarm relay` (`P-5 → EE-2` via `IF-5 Alarm Relay`, the potential-free contact). `DF-19`
   is an *additional* flow that refines `DF-27`; without a `refines` link a balancing check flags it
   as "boundary flow missing on the parent level" (§7, D2).
5. **Boundary membership is page-local but must be inherited.** `PB Smoke Detector Case` is drawn
   only on *Top*; the parts on the child pages are still inside the case → membership is
   **inherited from the decomposed parent** (§6.3).
6. **Interfaces exist on the detail pages.** *Top* has no `IF-*` shapes; ports appear when a
   multiprocess is opened up. The top level stays relevant for the analysis — its EEs and flows are
   part of the effective model (§6).
7. **EE→EE.** `DF-39` (WiFi gateway → update server) runs between two external entities: kept in
   the model and the report, no threats (§6.2).

## 4. Current state of the code (why this is not "just add pages")

| Area | Today | Consequence with several pages |
|---|---|---|
| `element-parser` / `connection-parser` | `doc.getElementsByTagName("object")` over the whole mxfile (fixed in Phase 1.1) | all pages merged into one element list; context copies become duplicate elements (`EE-1` × 3) |
| Element identity | `DFDElement.id` = draw.io cell id | the same logical element has a different cell id per page |
| Connection model | one `from`/`to` per connection | cannot represent a flow with different endpoints per page |
| Boundary membership and interfaces (`dfd-graph-builder`) | geometric overlap / crossing | coordinates of different pages overlap → wrong memberships and interfaces |
| `dfd-auto-numbering` | positional sort over the whole XML | renumbers context copies independently; the cross-page IDs are destroyed |
| `dfd-overlay-builder` | uses the first `<diagram>` only | other pages are ignored for overlays |
| Compressed pages | not readable | a compressed page is silently invisible |
| Threat display ids | derived from element displayId (`P1-S-1`) | require globally unique displayIds |

The first row was a **latent bug**: a user who added a second page in the embedded draw.io got a
silently wrong model. → Phase 0 (guard) and Phase 1.1 (per-page parsing).

The good news: threat generators consume `DFDGraphReference` only. If the builder produces a
correct **effective graph** from all pages, `element-generator` / `interaction-generator` and the
risk feature need no structural change (except an interface list per flow, §6.2.1).

## 5. Concept

### 5.1 Three layers and the occurrence model

```
Pages (draw.io views)        →  Logical model (one per project)     →  Effective model (analysis)
 <diagram>, cells, geometry      elements / flows / boundaries by tfId    leaves only, stitched flows,
 = occurrences                   properties, asset relations,             interface chains,
                                 refines, abstract, page tree             inherited boundaries
 source of truth: dfd.xml        source of truth: dfd.elements/            derived, never persisted
                                 connections/pages                         → DFDGraphReference
```

**Single source of truth per fact (D7):**

| Fact | Lives in | Never duplicated in |
|---|---|---|
| Which cells exist on which page, geometry, page-local endpoints (and thus crossed interfaces) | `dfd.xml` (occurrences) | logical records |
| Identity, displayId, properties, asset relations, `refines`, `abstract` | logical record (`dfd.elements[]`, `dfd.connections[]`) | — |
| Page tree, identity links (cell → `tfId`, role) | `dfd.pages[]` | `<diagram>` / cell attributes in the XML |
| Resolved endpoints, effective boundaries, crossings | effective model (computed) | disk |

Occurrences are **parsed from the XML on every load**, exactly like `from`/`to` today. They are not
persisted as a separate structure — a second copy of what the XML already says would drift.

```ts
// Parsed, in memory (not persisted separately)
interface DFDOccurrence {
  pageId: string;          // draw.io <diagram id>
  cellId: string;          // draw.io cell id — identifies ONE graphical occurrence
  tfId: string;            // logical identity
  role: "definition" | "ref";
}

interface DFDFlowOccurrence extends DFDOccurrence {
  sourceTfId: string;      // endpoint as drawn on THIS page
  targetTfId: string;
  interfaces: string[];    // tfIds of the interfaces this occurrence crosses ON THIS PAGE,
                           // determined geometrically (§6.2.1)
}

// Persisted logical flow — no from/to any more
interface DFDConnection {
  tfId: string;
  displayId: string;
  name: string;
  properties: DataFlowProperties;
  refines?: string;        // tfId of the parent-level flow (§6.4)
  abstract?: boolean;      // umbrella flow, no own threats (§6.4)
}
```

```ts
// Effective model (computed, never persisted)
interface EffectiveFlow {
  tfId: string;
  from: string;                    // resolved endpoint tfId
  to: string;
  interfaces: EffectiveInterface[]; // §6.2.1, ordered outer → inner per side
  state: "resolved" | "fallback" | "excluded";
  fallbackReason?: FallbackReason;     // most severe, for display (§6.5)
  fallbackReasons?: FallbackReason[];  // all collected reasons, for diagnosis
}

type FallbackReason = "unresolved" | "ambiguous" | "dangling";

interface EffectiveElement {
  tfId: string;
  homePageId?: string;             // absent while dangling (§5.2.1)
  boundaries: string[];            // effective boundary tfIds (§6.3)
  provenance: "definition" | "dangling";
  boundaryProvenance: "home-page" | "context-copies";   // provisional when dangling
}

interface EffectiveInterface {
  tfId: string;
  side: "source" | "target" | "none";
  level: number;                   // depth of the INTERFACE's home page (root = 0), §6.2.1
}
```

Consumers that today read `connection.from/to` (threat references, overlays, description view) read
the **resolved** endpoints from the effective model. A compatibility getter keeps single-page
projects unchanged (there, resolved = drawn).

### 5.2 Identity: `pageId`, `cellId`, `tfId`

Three distinct concepts that must never be mixed:

- **`pageId`** — identity of a page (draw.io `<diagram id>`), independent of its display name.
- **`cellId`** — identity of one graphical occurrence. May change (paste, recreate) without
  semantic effect.
- **`tfId`** — identity of the logical element/flow. Stable for its whole life, survives
  renumbering, renaming and moving between pages. All references (threats, risks, asset relations,
  attack-tree anchors) point to `tfId`.

`role` distinguishes the **definition** (exactly one per `tfId`, on the home page) from **context
copies** (`ref`, any number, styled grey/dashed, not editable — the form opens the definition).

**Identity links, lazy.** Which cell shows which logical element is stored in the project, per page,
in `dfd.pages[].links` (§5.3) — **not** in the XML. The XML stays plain draw.io. A cell is
addressed by `(pageId, cellId)`, because draw.io cell ids are unique within a page only.

| Link of the cell | Meaning |
|---|---|
| none | definition; `tfId` = cell id (all existing projects, every normally drawn element) |
| `{ cellId, tfId, role: "ref" }` | context copy of the element/flow with that `tfId` |
| `{ cellId, tfId, role: "definition" }` | definition whose identity differs from its cell id (after "Move definition" or adoption) |

TARAflow stores a link **only** where the identity differs from the cell id. Consequences:

- Existing projects need **no migration**: their references (threats, asset relations,
  attack-tree anchors) already hold cell ids, which *are* the `tfId`s. No XML is touched, which also
  matters because migrations run in the CLI reporter, where no DOMParser is available.
- Every identity action (insert as context, promote, move definition, adoption, paste reassignment)
  is a **JSON change only**; nothing writes identity into the XML.
- Links do **not** travel with draw.io copy/paste: a pasted cell has a new cell id and no link, so it
  is a new element (D8 for free). Linking it as a context copy is an explicit decision in the
  assignment dialog (below).
- draw.io keeps cell ids stable across edits. "Duplicate page" keeps the cell ids on a new `pageId`
  → several definitions with the same `tfId`; that is the reassignment rule below.
- **Stale links:** on every save, links whose `(pageId, cellId)` no longer exists in the XML are
  dropped, so a link can never attach to a different cell later. A link whose cell type does not
  match the type of its `tfId`'s definition is ignored for identity and reported (Phase 4).
- Malformed links (empty ids, a second link for the same cell) are ignored, never guessed into a
  merge. A `ref` link whose `tfId` equals its own cell id is valid: it is the former definition cell
  after "Make this the definition" moved the definition elsewhere.

#### Identity lifecycle (D8)

| Action | Rule |
|---|---|
| Create element in TARAflow | Plain definition, identity = cell id, displayId per §8 |
| **Paste** (draw.io copy/paste, duplicate page) | **Paste = new element.** A pasted cell has a new cell id and no link, thus a new identity. If two definitions end up with the same `tfId` (a duplicated page keeping its cell ids), the cell that was **not** in the last saved state gets a fresh `tfId` (a `definition` link, `<pageId>:<cellId>`) on save; its new displayId follows with the next explicit renumber (§8, the save never rewrites the XML). Info finding `ID_PASTE_REASSIGNED` (Phase 4). Never merged. |
| Pasted copy of an existing element (same displayId and type as an existing definition, no link) | Stays a new element until decided (analysed, `BAL_DUPLICATE_DISPLAY_ID`). After save a non-blocking hint offers the **assignment dialog**: one row per such cell, choice *context copy of X* / *new element*; default *context copy* when the cell is on another page than the definition, *new element* on the same page; "apply to all" for copied groups with their flows. Same mechanism as adoption (§11.2.1). |
| "Insert as context…" (TARAflow action) | Pick an existing element, place a cell on the current page and store its `ref` link. Also available on an existing cell as **"Make this a context copy of…"** (element form, list of candidates of the same type). |
| Delete a context copy | Graphical change only. |
| Delete the definition while copies remain | Copies become dangling → `BAL_DANGLING_REF` (error). Repair action **"Promote to definition"** on a chosen copy. **Never automatic** — promotion changes home page and boundary membership. Analysis until repair: §5.2.1. |
| Delete the definition, no copies left | Element is deleted (as today: threats become orphans, asset relations removed via `dfd-asset-deletion`). |
| **Move definition** (explicit action "Make this the definition") | The new definition cell gets a `definition` link with the `tfId`; the old cell gets a `ref` link. Semantic change: home page, geometric boundaries and possibly the analysis change. Recorded by the diff-service. |
| Delete a page | Its definitions are treated as deleted (above); its context copies vanish. If the page decomposed an MP, the MP becomes a leaf again (§10). Confirmation dialog lists the consequences. |
| A linked cell is recreated (deleted and redrawn, or cut and pasted, also in external draw.io) | The new cell has a new cell id and no link → new element; the stale link is dropped on save. If the cell was the definition of a moved/adopted `tfId`, the **old** logical record has lost its definition: with remaining context copies it becomes dangling (§5.2.1); without, it is treated as deleted — **but only after a confirmation on save** that lists the affected threats, asset relations and attack-tree anchors, with the option to re-attach the old `tfId` to the new cell instead (a `definition` link). |
| Import of a DFD / project merge | Imported `tfId`s that already exist are re-keyed (fresh `tfId`), never merged silently. |

#### 5.2.1 Dangling definitions (D12)

While a logical element has context copies but no definition cell:

| Aspect | Rule |
|---|---|
| Logical record | Persists unchanged (displayId, properties, asset relations, `refines`). Not editable except via "Promote to definition" or "Delete element". |
| Home page | **None** until repaired. Page filters list the element under "Dangling". |
| Geometric boundary membership | **Union over all remaining context copies** (each on its own page), plus the inherited set from ancestors (§6.3). Marked with provenance "from context copies". |
| Analysis | The element stays analysable: its per-element threats are generated as usual, anchored to the same `tfId`, with `EffectiveElement.provenance = dangling` and `boundaryProvenance = context-copies` (provisional). Its flows get `state: fallback`, `fallbackReason: dangling`. |
| Reconciliation | A missing definition is **not** a reference change: threats stay **unchanged** as long as `tfId` and the effective boundaries are the same; they only carry the dangling marker. A changed boundary union (copies added/removed) is a normal **reference changed**. |
| Label | Taken from the logical record (D7), never from a copy. Divergent copy labels are repaired from the logical record. |
| Navigation | Threats and findings navigate to the context copies, with a banner "definition missing — promote one copy or delete the element". |

Rationale for the union: using no geometry at all would give a top-level element an empty boundary
set → fewer crossings → silently missing threats, which contradicts D10. Picking *one* copy would be
arbitrary. The union of *all* copies is conservative, deterministic and visibly flagged.

### 5.3 Page tree and decomposition

New persisted structure (additive):

```ts
interface DFDPage {
  pageId: string;          // draw.io <diagram id>
  name: string;            // display name, mirrors <diagram name>
  decomposes?: string;     // tfId of the multiprocess this page details; absent = root page
  order: number;           // sibling order for navigation and numbering
  links?: DFDCellLink[];   // identity links of this page's cells, only where tfId ≠ cell id (§5.2)
}

interface DFDCellLink {
  cellId: string;          // draw.io cell id (page-local)
  tfId: string;
  role: "definition" | "ref";
}

// DFDData
pages?: DFDPage[];         // absent or length 1 = classic single-page project
```

Rules:

- Exactly **one root page** (`decomposes` absent). It is named **Top** (D17) — from the moment a
  project gets its second page, and from the start for new projects. Classic single-page projects
  keep their page name until then, so their XML does not churn.
- **Every multiprocess gets its child page automatically** when it is created, on any level (D15).
  The page **name follows the multiprocess name** in one direction: renaming the MP renames the tab
  on save; renaming the tab in draw.io is overwritten on the next save (D16). Identity is the
  `pageId`, so equal names are only a cosmetic issue. The MP cell carries the draw.io page link
  (below).
- Only **multiprocesses** can be decomposed (D1). A multiprocess has at most one child page.
  Nesting is unlimited.
- A decomposed multiprocess must **not** appear on its own child page (on *Controller Module*,
  `MP-2` is replaced by its parts); it may appear as a context copy on sibling pages (`MP-2` on
  *Sensor Module*).
- Every element **defined** on a child page is a **descendant** of the decomposed multiprocess.
  This gives the containment tree: `MP-1 ⊃ {P-1…P-4, DS-1, DS-2, IF-1, IF-2}`.
- Navigation uses draw.io's native page link on the multiprocess cell
  (`link="data:page/id,<pageId>"`), so the child page can be opened also in plain draw.io via the
  link. A double-click does not open it: draw.io starts editing the label. In TARAflow the details
  panel of the multiprocess has an "Open page" button.

The page tree and the identity links live in the JSON (`dfd.pages`), not as custom attributes in
the XML: draw.io does not guarantee to preserve unknown attributes on the `<diagram>` element, and
keeping the XML plain draw.io means no identity can be lost or duplicated by editing in draw.io.

#### 5.3.1 Containment parent (formal)

Three relations must not be confused:

| Relation | Definition | Source |
|---|---|---|
| `containmentParent(e)` | the multiprocess decomposed by the page that holds the **definition** of `e` | page tree + home page |
| `geometricBoundaries(e, p)` | boundaries whose shape contains the cell of `e` on page `p` | geometry of page `p` |
| `effectiveBoundaries(e)` | §6.3 | derived |

Rules:

- `containmentParent` exists **only** for processes, multiprocesses, data stores and interfaces
  defined on a child page. It is never derived from a context copy, nor from the page on which a
  boundary is defined.
- **External entities never have a containment parent**, wherever they are defined. An EE is outside
  the system by definition; if `EE-3 Maintenance Technician` were first created on the *Controller
  Module* page, it must not become a part of `MP-2` and must not inherit `CB`/`PB`. (It still gets
  `BAL_HOME_NOT_HIGHEST` if it also appears higher up.)
- **Boundaries never have a containment parent.** Their nesting is purely geometric
  (`trustBoundaryHierarchy`), and a boundary's membership in other boundaries is not inherited along
  the decomposition.
- **Dangling elements** keep the containment parent of their last definition page if that page still
  exists; otherwise they have none. *Implementation note (2a):* the last definition page is not
  known without history, so a dangling element has no containment parent for now; its boundaries
  are the union over its copies (§5.2.1). Revisit with 2b if the persisted record should carry it.
- `a ⊆ M` ("a inside M") means: `a == M` or `M` is reached by following `containmentParent` from `a`.
  EEs and boundaries are never inside any MP.

### 5.4 Home page (D5)

The home page of an element **is** the page of its definition cell — persisted implicitly in the
XML, no separate field, no re-derivation on load.

- Elements created on a child page live there (`P-1…P-4`, `DS-1`, `IF-1`, `SDS` on *Sensor Module*).
- Elements used on several levels (EEs, cross-level boundaries) should be defined on the **highest
  page** they occur on. Formally: `depth(root) = 0`, `depth(child) = depth(parent page) + 1`;
  "highest" = minimal depth among the pages the element occurs on (`EE-1`, `SB` → *Top*). If an
  element was first created on a child page and is later inserted as context on a higher page,
  TARAflow does **not** move the definition automatically; the info finding `BAL_HOME_NOT_HIGHEST`
  offers the action "Move definition here". The opposite direction asks first: "Make this the
  definition" / "Promote to definition" on a copy below the highest occurrence shows "MP-3 … then
  becomes part of MP-1 …: its threats and risks are grouped under MP-1 …. Continue?".
- Properties, asset relations and geometric boundary membership are read from the home page.

## 6. Effective model (what the threat generators see)

### 6.1 Leaves

The effective element set = all logical elements that are **not decomposed**. `MP-1` and `MP-2`
disappear and are replaced by their descendants; all EEs and any not-yet-decomposed multiprocess are
leaves.

**A decomposition takes effect only once its page defines at least one part of its own** (a
process, multiprocess, data store, interface, sensor or actuator — not an EE, not a boundary, not a
context copy) (D15). An automatically created, still empty child page, or one holding only context
copies, therefore leaves the multiprocess a **leaf with its own threats**; its flows end at the MP,
resolved, without fallback findings. Without this rule every new MP would lose its threats and turn
its flows into `unresolved` fallbacks the moment it is drawn. A decomposed multiprocess generates no own STRIDE-per-element threats — **except** as a
fallback endpoint of individual flows (§6.2, §6.5).

### 6.2 Flow endpoint stitching (deterministic algorithm)

Input: one logical flow with its occurrences `O₁…Oₙ` (all pages), the containment tree.

```
for side in (source, target):
  C = { o.side for o in occurrences }                 // drawn endpoints of this side

  // 1. Chain check: all candidates must lie on ONE root-to-leaf path
  if exists a, b in C with not (a ancestorOrSelf b or b ancestorOrSelf a):
      finding BAL_AMBIGUOUS_ENDPOINT (error)
      resolved.side = lowestCommonAncestor(C)          // conservative fallback, never "pick one"
                    ?? endpoint drawn by the flow's definition   // no common ancestor (e.g. an EE)
      state = fallback
      continue

  // 2. Deepest wins
  e = the deepest element of C

  // 3. Decomposed leftovers
  if e is a decomposed MP:                              // nobody drew the flow below it
      finding BAL_UNRESOLVED_ENDPOINT (info)            // D4
      resolved.side = e ; state = fallback
  else
      resolved.side = e

  // 4. Interfaces: see §6.2.1 (computed per flow, not per side candidate)
```

Properties of the algorithm:

- **Deterministic:** depends only on the set of occurrences and the containment tree, not on page
  order or cell order.
- **One-sided refinement** works without special cases: `DF-34 EE-3 → MP-2` is only refined on the
  controller side (`EE-3 → P-9`); the source chain has one element and resolves to itself.
- **Siblings conflict** (one page draws a flow into `P-1`, another into `P-3`, both under `MP-1`):
  not a chain → `BAL_AMBIGUOUS_ENDPOINT`, fallback to `MP-1`. The analyst must split the flow (one of
  them gets a new `tfId`, optionally `refines`).
- **Self-loop** (a multiprocess talking to another instance of itself, e.g. a redundant pair):
  allowed, resolved normally; the interaction generator treats it as instance-to-instance
  communication (no boundary crossing unless the MP itself has an interface on the flow).
- **EE→EE** (`DF-39 EE-4 → EE-5`): kept in the logical model and the report, excluded from threat
  generation, info finding `DFD_EE_TO_EE_FLOW`.

Additionally, a logical flow may have **at most one occurrence per page**; a second one is
`BAL_DUPLICATE_OCCURRENCE` (error) and both occurrences are used for stitching and interfaces
(conservative).

#### 6.2.1 Interface chain (D11)

A flow that leaves a nested part can pass **several** physical ports: if a part of `MP-2` were itself
a multiprocess and decomposed, a flow from `EE-4` to one of its parts would pass `IF-7 WLAN` (level 1)
*and* an internal port of that part (level 2). These are not competing values but a chain.
Therefore the effective flow carries a **list** of interfaces.

**Source of the interfaces.** TARAflow has no `via` attribute. Which interfaces a flow uses is
determined **geometrically**, as today in `dfd-graph-builder`: the flow path crosses the interface
shape, or one endpoint lies inside it. In a leveled DFD this is evaluated **per occurrence, on that
occurrence's page**, against the interface cells drawn there (definitions or context copies). The
result is `o.interfaces` (§5.1).

Each page is exactly one decomposition border (the MP it decomposes; the root page decomposes
nothing). Each interface `i` in `o.interfaces` is attributed as follows:

```
for each occurrence o, for each interface i in o.interfaces:
  P = page(o) ; M = decomposedMP(P)          // undefined for the root page
  srcInside = M defined and o.source ⊆ M     // ⊆ per §5.3.1; EEs/boundaries never inside
  tgtInside = M defined and o.target ⊆ M
  if M undefined:              side = "none"   // root page: today's single-page semantics
  elif srcInside and not tgtInside: side = "source"
  elif tgtInside and not srcInside: side = "target"
  elif srcInside and tgtInside:     side = "none"   // internal flow of M, internal interface
  else:                                             // neither endpoint inside M — cannot happen
      finding BAL_INTERFACE_UNATTRIBUTED (warning)  // for a definition on a correct child page;
      side = "none"                                 // possible with misplaced context copies
  add { tfId: i, side, level: depth(homePage(i)) }
interfaces = deduplicate by (tfId, side), sort by side, then level ascending (outer → inner)
```

- **Level belongs to the port, not to the drawing.** An interface is a port of exactly one
  decomposition border: the MP decomposed by its home page (root page = system border, level 0). If
  `IF-7` (defined on *Controller Module*, level 1) is drawn again as a context copy on a deeper page
  and crossed there, it is still the same physical port at level 1. Hence `(tfId, side)` identifies
  an entry completely and deduplication cannot lose information or shorten a chain. A real chain
  consists of **different** interfaces at different levels.
- **Deterministic:** depends only on the occurrences, the page tree and the interfaces' home pages.
- **No conflicts by construction:** several interfaces of one border crossed by the same flow are
  all attack surfaces and all kept, as today on a single page. Two interfaces on the same side at
  different levels are a legitimate chain.
- **Single-page projects:** every crossed interface gets `side: "none"` → exactly today's behaviour.

Generator contract (Phase 2): the interaction generator iterates `interfaces`; each entry is an
attack surface of the flow, with the crossing context of its level. Interface-element threats are
still generated once per interface element (its home page), independent of how many flows use it.

### 6.3 Boundary membership (hard rule, no opt-out)

```
effectiveBoundaries(e) = geometricBoundaries(e, homePage(e))
                       ∪ inherited(e)
inherited(e)           = effectiveBoundaries(containmentParent(e))   // §5.3.1; ∅ if none
                         minus its trust boundaries if e is an interface
// dangling e (§5.2.1): geometricBoundaries(e, homePage(e)) is replaced by
//                      ∪ { geometricBoundaries(e, p) | p hosts a context copy of e }
```

- **Always additive.** A part of a device is inside every boundary the device is in. There is no
  way to "leave" an inherited boundary on a deeper level; if that seems necessary, the element is
  not really a part of that multiprocess and is modelled in the wrong place.
- **Interfaces inherit physical and chip boundaries, not trust boundaries** (decided 2026-10-15).
  An interface is always related to a physical or chip boundary: the physical boundary that encloses
  a multiprocess encloses its interfaces too. Trust boundaries are a different matter — an interface
  is the crossing point drawn on a trust boundary's border, not a member of the zone, exactly as in
  single-page models today. Its trust boundary membership is therefore only the geometry on its
  home page. Processes, multiprocesses and data stores inherit all three kinds.
- **Child-only boundaries are allowed** and expected for chip boundaries, which belong to the
  detailed DFD (`SDS`, `SDC` exist only on the module pages); they apply to the elements inside them
  and their descendants.
- **Nesting and overlap** are evaluated geometrically per page exactly as today
  (`trustBoundaryHierarchy`, innermost TB = effective TB), then the inherited set is added.
  The effective (innermost) trust boundary of a leaf is taken from its home page if it has one
  there, otherwise from the nearest ancestor.

Example: `P-2` is geometrically inside `SB` and `SDS` on *Sensor Module* and inherits `PB` from
`MP-1` on *Top*. Crossings of a stitched flow are computed from the resolved endpoints'
effective boundaries, so `DF-7` (`P-2 → P-5`) crosses `SB → CB` and `SDS → SDC`, but not `PB` — both
ends are inside the case.

Boundaries are logical elements like any other: `SB` on two pages is one boundary with one set of
properties; only its geometry differs per page.

### 6.4 Refinement (`refines`)

A child-level flow may carry `refines = <tfId of a parent-level flow>` (e.g. `DF-19 → DF-27`).

Rules:

1. **Cardinality:** a flow refines **at most one** parent flow; a parent may be refined by any
   number of flows.
2. **Acyclic:** chains are allowed (`A refines B refines C`), cycles are an error
   (`BAL_REFINES_CYCLE`).
3. **Target must exist** (`BAL_REFINES_TARGET_MISSING`).
4. **Compatibility:** each resolved endpoint of the refining flow must be identical to, or a
   descendant of, the corresponding endpoint of the parent flow's **top-most occurrence** (EEs:
   identical). Same direction. Violation → `BAL_REFINES_INCOMPATIBLE` (warning).
   The check deliberately uses the top-most occurrence, not the parent's resolved leaf: `DF-27` is
   drawn `MP-2 → EE-2` on *Top* and resolves to `P-6 → EE-2`; `DF-19 P-5 → EE-2` is compatible
   because `P-5 ⊂ MP-2`, although `P-5` is not `P-6`.
   An incompatible refining flow is **analysed normally**, but the claimed refinement does **not**
   count as balancing: the parent-level check (`BAL_MISSING_PARENT_FLOW`) is evaluated as if
   `refines` were absent, and the report lists the flow as "refinement not confirmed".
   The same applies to every **invalid** `refines` (cycle, missing target): the flow is analysed,
   the relation never counts as a successful balancing link.
5. **Purpose:** balancing and roll-up only. The parent flow and the refining flow are both effective
   flows and get their own threats — they are different channels (data line vs. relay contact).

**`abstract: true`** marks a pure umbrella flow (all real traffic is in its refinements):

- stays a logical object: navigation target, shown on its pages, in the report and in the audit diff;
- generates **no threats** of its own;
- requires at least one refining flow, else `BAL_ABSTRACT_WITHOUT_REFINEMENT` (warning) — an
  abstract flow without children would silently drop threats.
- **Decided in 4b (D10):** the exclusion takes effect only while at least one **valid** refinement
  exists. Without one (none, or only invalid ones) the abstract flow is analysed normally and keeps
  its threats, plus the warning — never a silent drop.

Storage (4b): `refines` and `abstract` are data-flow properties (`DataflowProperties`, JSON
record like `excludeFromThreatGen`), not XML attributes. They only take effect in a leveled DFD; on
a single page there is no effective model and both are ignored.

### 6.5 Flow analysis state

Each effective flow carries a computed state (not persisted):

| State | Meaning | Threat generation |
|---|---|---|
| `resolved` | both endpoints are leaves | normal |
| `fallback` | at least one endpoint could not be resolved to a confirmed leaf | normal, on the fallback endpoint; threat marked with the reason |
| `excluded` | `abstract` (with a valid refinement), EE→EE, or `excludeFromThreatGen` | none |

`fallbackReasons` collects **all** causes (both sides, all checks) for diagnosis and the report;
`fallbackReason` is the most severe one for display, order `ambiguous > dangling > unresolved`:

| Reason | Cause | Fallback endpoint |
|---|---|---|
| `unresolved` | flow never drawn below a decomposed MP (`BAL_UNRESOLVED_ENDPOINT`) | the decomposed MP |
| `ambiguous` | drawn endpoints not on one chain (`BAL_AMBIGUOUS_ENDPOINT`) | lowest common ancestor |
| `dangling` | an endpoint has no definition (`BAL_DANGLING_REF`) | the dangling element itself (§5.2.1) |

Elements carry the analogous marker `EffectiveElement.provenance` (`definition` | `dangling`, §5.2.1);
elements have no `fallback` state because they are never replaced by another element.

Downstream components (threat table, risk view, report) must treat a fallback endpoint as
**provisional**, never as a confirmed modelling result. The state is shown in the connection form and
as a filter in the threat table. Transitions between states are handled by the threat lifecycle
(§10).

## 7. Validation findings and error policy (D10)

Findings never block editing or saving. Their effect on the **analysis**:

| Class | Effect | Findings |
|---|---|---|
| **Valid** | full analysis | — |
| **Incomplete but analysable** | analysis runs; affected flows/elements analysed conservatively (fallback to parent), threat tab banner "N flows analysed on parent level" | `BAL_UNRESOLVED_ENDPOINT`, `BAL_AMBIGUOUS_ENDPOINT`, `BAL_DANGLING_REF`, `BAL_REFINES_*`, `BAL_MISSING_PARENT_FLOW`, … |
| **Not readable** | threat generation blocked, clear error | XML not parseable, unsupported page format (§11.1) |

**Incomplete or ambiguous modelling must never by itself cause a flow or element to be excluded
from threat generation. Intentional exclusions defined by the model semantics (`abstract`, EE→EE,
`excludeFromThreatGen`) remain valid.**

Rationale: a **conservative fallback** is preferred over excluding a flow. An excluded flow means
silently missing threats; a threat on a too-coarse endpoint is visible, reviewable and gets refined
later. Global blocking would also hit every incremental modelling step.

| Id | Severity | Rule | Example (§3) |
|---|---|---|---|
| `BAL_MISSING_PARENT_FLOW` | warning | A child-page flow crosses the decomposed parent's border, has **no** occurrence on the parent page **and no** `refines` (a `refines` is a valid substitute for a parent occurrence, D2) | `DF-19` without `refines` |
| `BAL_UNRESOLVED_ENDPOINT` | info | A flow touching a decomposed MP is never drawn on its child page | `DF-7` before *Controller Module* draws it |
| `BAL_AMBIGUOUS_ENDPOINT` | error | Drawn endpoints of one side are not on one containment chain (§6.2) | – |
| `BAL_DUPLICATE_OCCURRENCE` | error | A logical flow has more than one occurrence on the same page (§6.2) | – |
| `BAL_INTERFACE_UNATTRIBUTED` | warning | A crossed interface cannot be attributed to a side of the page's decomposition border (§6.2.1) | – |
| `BAL_DECOMPOSED_ON_OWN_PAGE` | error | A decomposed MP appears on its own child page | – |
| `BAL_DANGLING_REF` | error | Context copy whose `tfId` has no definition | – |
| `BAL_DUPLICATE_DISPLAY_ID` | error | Two different `tfId`s share a displayId | – |
| `BAL_HOME_NOT_HIGHEST` | info | Definition is not on the highest page the element occurs on (D5) | – |
| `BAL_LABEL_DIVERGENCE` | warning | Occurrences of one logical element/flow carry different labels | – |
| `BAL_REFINES_CYCLE` / `_TARGET_MISSING` | error | §6.4 rules 2–3 | – |
| `BAL_REFINES_INCOMPATIBLE` | warning | §6.4 rule 4; refinement not counted for balancing | – |
| `BAL_ABSTRACT_WITHOUT_REFINEMENT` | warning | §6.4 | – |
| `BAL_ASSET_NOT_REALISED` | warning | A pending asset relation on a decomposed MP is held by none of its descendants (§9) | – |
| `ID_ADOPTION_PENDING` | error (5b) | File contains pages whose occurrences have not been adopted yet (§11.2.1) | – |
| `ID_PASTE_REASSIGNED` | info | A pasted definition received a fresh `tfId` (§5.2) and still shows another element's displayId (until the next renumber) | – |
| `DFD_EE_TO_EE_FLOW` | info | Flow between two external entities (out of analysis scope) | `DF-39` |

Page-tree findings (structural, computed by `buildPageTree` since 1.3, reported by the validator in
Phase 4): `PAGE_UNASSIGNED` (page in the XML but not in `dfd.pages`; with several pages this is
`ID_ADOPTION_PENDING`), `PAGE_MISSING`, `PAGE_NO_ROOT`, `PAGE_MULTIPLE_ROOTS`,
`PAGE_DECOMPOSES_UNKNOWN`, `PAGE_DECOMPOSES_NOT_MULTIPROCESS` (D1), `PAGE_DECOMPOSED_TWICE`,
`PAGE_PARENT_UNRESOLVED` (decomposed MP dangling or defined outside the tree), `PAGE_CYCLE`, plus
`BAL_DECOMPOSED_ON_OWN_PAGE` above. Severities (4a): errors `PAGE_NO_ROOT`, `PAGE_MULTIPLE_ROOTS`,
`PAGE_DECOMPOSES_NOT_MULTIPROCESS`, `PAGE_DECOMPOSED_TWICE`, `PAGE_CYCLE`; warnings the others. A page that cannot be placed keeps no depth and is never
attached somewhere silently; its content stays in the logical model (D10).

Note on `BAL_LABEL_DIVERGENCE`: the label is a property of the logical record. Editing the label of
any occurrence updates the logical record and all occurrences on save; divergence can only arise
from external editing and is repaired from the **logical record** (also when the definition is
missing).

## 8. Numbering (D19)

**Hierarchical numbers.** The root page numbers its definitions `1..n` per prefix (`MP-1`, `P-1`,
`DF-1`, …). The child page of the multiprocess `MP-m` numbers **its own** definitions `m.1..m.n` per
prefix: `P-1.3` is the third process in `MP-1`, `DS-1.1`, `IF-1.2`, `DF-1.4`. A nested multiprocess
on that page is `MP-1.2`, its parts `P-1.2.1`. Since only multiprocesses are decomposed (D1),
`P-1.3` can never be read as a part of `P-1`. The ID belongs to the logical element, not to the
drawn cell.

- **Context copies** show the number of their definition and never consume one: a flow drawn on
  *Top* as `DF-3` stays `DF-3` on every child page it is copied to; only flows defined on the child
  page get `DF-m.k`.
- **Dangling elements** (copies, no definition) and definitions on a page the tree cannot place take
  numbers of the root namespace after the root page's own definitions — unique, and flagged anyway.
  A child page whose multiprocess has no number yet uses the root namespace too.
- **Renumber (explicit action, as today):** pages in tree order (root, then child pages depth-first
  by `order`), so every multiprocess has its number before its child page; each page sorted with the
  existing position strategy on its own geometry; counters per page namespace and type. A single
  page has no links, so the result is exactly the classic numbering.
- **Consequences, accepted:** renumbering *Top* can change an `MP` number and with it every ID
  below it (cascade); moving an element to another page changes its ID. In return a change on one
  child page no longer shifts the numbers of any other page, and renumbering a single page becomes
  possible (UI, Phase 5).
- **No high-water mark.** TARAflow has no automatic numbering of new elements: a new element keeps
  its placeholder (`P-xx`) until the explicit action. The persisted per-prefix high-water mark of
  earlier revisions is dropped (2026-10-17); it would have changed numbering for every project,
  single-page included, and is not needed here.
- **Invalid or manually typed IDs** (not matching `^(P|MP|DF|DS|EE|IF|…)-\d+(\.\d+)*$`) →
  finding; they get a regular number on the next renumber.
- Threat display ids follow through the existing renumber path (threat identity is the UUID):
  `P-1.3` → `P1.3-S-1`, `IF-2.1` → `SB-IF2.1-T-1`; natural sorting orders `1.9` before `1.10`.

## 9. Assets (D3)

**One asset register per project** — unchanged. Assets are not diagram-scoped; a firmware image or
a credential is the same asset regardless of which page shows its holder.

Element→asset relations stay on `dfd.elements[].assetRelations`, keyed by `tfId`:

- **Leaf elements:** relations are edited as today.
- **Decomposed multiprocess:** its relations are a **derived, read-only roll-up**: the **set** of
  distinct `(assetId, relationType)` pairs held by its descendants (deduplicated, not summed).
  Displayed with provenance ("via P-4, DS-2").
- **Pending relations:** relations an MP held *before* it was decomposed are kept on the MP and
  shown separately ("not yet assigned to a part"). No flag is needed: once decomposed, every own
  relation of an MP is pending — it can no longer be edited, only removed (6d).
  - A pending relation is **removed automatically** as soon as a descendant holds the same
    `(assetId, relationType)` — it is then covered by the roll-up. The diff-service records the
    removal.
  - Until then `BAL_ASSET_NOT_REALISED`. If no single part can hold the asset, the model is missing
    a holder (typically a data store); the finding is the intended outcome, not a second kind of
    relation.
  - Pending relations are **not** copied to all children — the sensor firmware asset of `MP-1`
    belongs to `P-4 Sensor Update Handler` and `DS-2 Sensor Firmware`, not to `P-1 Optical
    Detection`.
- **Descendant deleted:** the roll-up shrinks accordingly; no pending relation is re-created (the
  deletion is an explicit analyst action and visible in the diff).
- **Undo decomposition** (child page deleted, §5.2): the MP becomes a leaf again; the current roll-up
  is **materialised** as its direct relations so no asset coverage is lost.
- The asset graph view gets a page filter (assets of the elements on the current page / of a
  subtree).

## 10. Threats and risks (D9)

**One threat register and one risk register per project** — unchanged.

- Threats are generated on the **effective model** only (§6). No duplicate threats from the same
  element on several pages, no threats on decomposed containers except as fallback endpoints.
- Every threat references logical elements by `tfId`; the UI derives the page(s) for navigation.
- New filters in the threat and risk tables: **by page**, **by subtree** (all threats below `MP-2`)
  and **by analysis state** (`fallback`).
- The risk matrix can be narrowed to one group — top level or a top-level decomposed multiprocess
  (revised in 6f; first planned as a roll-up table per MP). Pure view, no stored data.
- Attack trees anchor on assets (unchanged) and may reference leaf elements on any page.

**Lifecycle.** Threat identity (UUID), threat generation and risk rating are kept separate. Every
re-generation produces a reconciliation result with four categories, shown before it is applied:

| Category | Meaning | Effect on risk rating |
|---|---|---|
| **new** | no existing threat with the same generator key | unrated |
| **unchanged** | same generator key, same resolved references | kept |
| **reference changed** | same generator key, but a resolved endpoint/interface changed | kept but flagged **"review"**; never silently confirmed |
| **obsolete** | existing threat without a generated counterpart | becomes orphan (existing orphan handling) |

Generator key = (element or flow `tfId`, STRIDE category, direction for flow threats) — the
natural key of the merge. Because the key contains the logical `tfId`, not the resolved
endpoint, a flow whose endpoint moves from fallback `MP-2` to `P-5` keeps its threats as
**reference changed**. *Revised in 6e:* the template id is **not** part of the key — a new
catalog template would otherwise discard the analyst's rating (obsolete + new); it is a
**reference changed (template)** instead. Interface-bound flow threats do not exist (interfaces
have element threats of their own, patch 54), so there is no interface part either.

| Model change | Result |
|---|---|
| Leaf MP gets decomposed | its per-element threats → **obsolete**; its flows → **reference changed** (endpoint moves to a part, or stays fallback); new parts → **new** |
| Decomposition undone | parts' threats → **obsolete**; MP per-element threats → **new** (old orphans can be re-linked manually); flows → **reference changed** |
| Flow re-routed (endpoint changed) | **reference changed** |
| Flow split into a parent + refining flow | parent → unchanged/reference changed; refining flow → **new** |
| Flow loses one interface | threats bound to that interface entry → **obsolete**; others → **reference changed** |
| Definition moved to another page | **reference changed** only if effective boundaries changed, else unchanged |
| Definition deleted with dangling copies | element threats kept (fallback), `BAL_DANGLING_REF` |

**Model change ≠ analysis change.** The diff-service (§11.3) classifies changes to the *model*; the
reconciliation classifies changes to the *analysis result*. Both are intended to diverge: a moved
definition is a semantic model change, but yields **unchanged** threats if resolved references and
effective boundaries stay the same. A semantic model change does **not** by itself trigger a
re-rating of threats.

**Risk ratings are never transferred** from one threat to another. Re-linking an orphan to a new
threat is a manual analyst action and recorded in the audit diff.

## 11. Persistence, diff-service, audit

### 11.1 XML format and round-trip

1. All `<diagram>` pages are detected on load and parsed separately (Phase 1.1, `page-reader`).
2. **Persisted format: uncompressed pages.** TARAflow's embedded draw.io writes uncompressed XML, so
   the TCS diff stays readable.
3. **Compressed pages are not decoded.** There is no source of compressed XML in TARAflow today;
   the Phase 0 guard refuses them with a visible error and the page reader throws instead of reading
   them as empty. If a source appears (e.g. importing external `.drawio` files), decoding can be
   added with `pako` (the native `DecompressionStream` is asynchronous, the parser is synchronous)
   plus normalisation to uncompressed before `prepareForDisk`.
4. draw.io data not relevant to TARAflow (styles, layers, page settings) is preserved unchanged.
5. A page that cannot be read is a **visible error that blocks threat generation** — never a silent
   partial analysis.

### 11.2 Schema migration 8 → 9

- **No XML change** (lazy identity, §5.2): the XML of existing projects stays byte-identical.
- JSON only: creates `pages[]` (one root page from the `<diagram>`, or none for a bare
  `<mxGraphModel>`). Additive. (The numbering high-water marks planned here were dropped with D19.)
- **Decided in 1.3, done in 2c-2:** `dfd.pages` stays **optional and absent** for classic projects
  (no churn). The schema is bumped to 9 when the Phase 0 guard is lifted (Phase 2c-2), as a
  **version fence**: every released TARAflow before Phase 0 silently merges the pages of a
  multi-page file (§4); a newer schema makes it refuse the file instead
  (`migration-service` rejects `schemaVersion > CURRENT_SCHEMA_VERSION`). The 8 → 9 step itself
  changes no data.
- **Multi-page files:** see §11.2.1 (adoption runs in the renderer, where the XML can be edited).
- **Idempotent:** running it twice yields the identical result.
- **Atomic:** migration runs in memory and is written once via the single writer; an abort leaves the
  file untouched.
- **No semantic change:** no threat, risk, asset relation or rating is altered. Unknown or ambiguous
  references (e.g. a threat pointing to a cell id that does not exist) are reported as findings,
  not repaired.
- **Audit:** the migrated file is committed as a normal signed commit. Older versions stay untouched
  in history; the AVE TCS check is per blob, so historical schema-8 blobs remain reproducible.
- Golden round-trip test over all `TARAflow_Examples` projects (§14).

#### 11.2.1 Adoption of files that are already multi-page (D13)

A multi-page file drawn before this feature (or outside TARAflow) has context copies that are plain
cells with their own cell ids and no links. Lazy identity alone would make every copy an
independent definition with a duplicate displayId.

Such files (detected by Phase 0, finding `ID_ADOPTION_PENDING`) go through an **adoption step**:

1. Cells that are **already linked** to one `tfId` stay together; this grouping has priority.
   The groups are then merged by `(displayId, type)`. A displayId only counts if it is a real id
   (numbered types: their prefix, e.g. `MP-2`; boundaries: their bracket id, e.g. `SB`); a cell
   without one is a **singleton group** of its own and is never merged with anything (the analyst
   can merge it manually afterwards with "Make this a context copy of …"). A `(displayId, type)`
   bucket holding two or more already-linked `tfId`s is a **conflict**: nothing in it is merged,
   the groups are listed with the identities they collide with.
2. Per group, choose the definition — an **adoption heuristic**, not a statement about where the
   definition semantically belongs. An already-linked group keeps its existing definition
   (reason `existing`); otherwise:
   1. the root page, if the element occurs there;
   2. otherwise the page with minimal depth (§5.4);
   3. on a tie, the page first in tree order (`order`), then the lower cell id — a purely technical
      tie-breaker, **shown explicitly in the dialog** so the analyst can override it.
   All other members become `ref` with the definition's `tfId`.
3. Groups whose members disagree on label or properties are flagged `BAL_LABEL_DIVERGENCE` and listed
   separately in the dialog.
4. The decomposition tree is proposed from the page content, starting at the root (pages already in
   `dfd.pages` keep their place). An unplaced page P is proposed to decompose the multiprocess M of
   an already placed page K that is **missing on P** and whose **flow neighbourhood on K** (flows
   touching M, elements at their other end — exactly what "Decompose…" pre-populates, §12) appears
   most often on P. E.g. *Sensor Module* → `MP-1`: `MP-1` is missing there, while its neighbours
   `MP-2`, `EE-1`, `DF-7`, `DF-9`, `DF-8` appear as copies. A tie between two MPs is **ambiguous**, no
   candidate at all **unplaced**; both are left to the analyst (candidates listed). Placed pages
   get depth `depth(K) + 1`, which feeds step 2. The analyst confirms or corrects each page.
5. The whole proposal is shown in **one confirmation dialog**; nothing is merged silently, because
   grouping by displayId is an assumption. On confirmation TARAflow stores `ref` links for the
   context copies in `dfd.pages[].links` (and a `definition` link only where a definition's identity
   differs from its cell id). The XML is not changed.
6. The same dialog serves pasted copies (§5.2, lifecycle): adoption is the case "all pages at
   once", the paste hint the case "these few new cells".

Until adoption is confirmed, the file stays read-only for threat generation (Phase 0 behaviour).

### 11.3 diff-service: graphical vs. semantic changes

| Change | Classification |
|---|---|
| Context copy added / removed | graphical |
| Position / size changed | graphical |
| Label edited (any occurrence) | semantic (label of the logical record) |
| Label divergence from external editing | consistency finding, repaired from the logical record — no separate change |
| Definition moved to another page | semantic (home page, boundaries) |
| Flow endpoint changed, or flow re-routed across a different interface, on any page | semantic |
| `refines` / `abstract` added or changed | semantic |
| Page added or removed | structural; additionally semantic if the logical model or the effective model changes |
| Page renamed | graphical |
| `tfId` changed | identity change (paste reassignment or adoption only), never an ordinary edit |

A new page that contains only context copies is a **structural** change without analysis impact; the
commit dialog shows structure and analysis effect as separate lines, e.g.
`Page added: Controller Module (decomposes MP-2)` / `Analysis: 3 flows now resolved below MP-2`.

The single-writer / `prepareForDisk` discipline is unchanged; the effective model is never written
to disk.

## 12. UI

- **Automatic child page (D15–D17):** creating a multiprocess creates its child page, named like the
  MP, linked from the MP cell (`link="data:page/id,<pageId>"` — also on its context copies; opened
  with "Open page" in the details panel, a double-click edits the label). Until the page has a part of its own, the MP stays a leaf (§6.1). Deleting
  the MP asks whether to delete its page as well (lifecycle "Delete a page", §5.2). The root tab is
  *Top*.
- **Page tree:** no panel of its own — draw.io's page tabs at the bottom are the page list and the
  navigation. TARAflow decorates them: tooltip with the page's place in the tree (top level /
  details MP-x / decomposition not in effect yet / not in the tree) and its finding counts, badge
  with the error count, else the warning count (5c, decided 2026-10-17).
- **"Decompose…"** on a multiprocess creates the child page and pre-populates it with context copies
  of exactly:
  1. every element directly connected to the MP by a flow (**flow neighbours** — for `MP-1`:
     `MP-2`, `EE-1`),
  2. every flow touching the MP, as a context occurrence still attached to the MP's border
     position (to be dragged onto the new parts),
  3. the boundaries containing the MP **or** any flow neighbour (for `MP-1`: `SB`, `CB`, `PB`), so
     crossings stay visible.
  Not included: second-degree neighbours, unrelated elements.
  It also sets the page link on the MP cell. The analyst only has to add the parts and drag the flow
  ends onto them.
  **Idempotent:** on an MP that already has a child page, the action becomes **"Sync context"**: it
  adds only the context copies and flow occurrences that are missing on the child page; it never
  duplicates an existing occurrence (`BAL_DUPLICATE_OCCURRENCE` cannot arise from it) and never
  removes anything.
- **"Insert as context…"**, **"Go to definition"**, **"Show occurrences"**, **"Make this the
  definition"**, **"Promote to definition"** (repair).
- Description view and reporter: per page, plus one consolidated element list.
- **One thumbnail per page (D18)**, see §12.1.

### 12.1 Thumbnails per page (D18)

**Today:** one `dfd.thumbnail` (base64 SVG data URL), produced by draw.io's embed export
(`{action: "export", format: "svg"}`) after an autosave and normalised in `prepareForDisk`. Consumers:
the DFD preview panel in the other tabs (`dfdPreviewImage`), the documentation generators
(`base-generator`, `pdfmake-converter`, PNG conversion in `pdf-helpers`) and the CLI reporter (resvg
rasterisation, no headless draw.io). The export renders the **current page only**, so in a
multi-page file the stored thumbnail is whichever tab was active at the last save — today's leveled
projects can therefore show a child page as "the DFD" in preview and report. Until Phase 5 this is a
known limitation.

**Target:**
1. **Persistence:** `dfd.pages[].thumbnail?` — one SVG data URL per page, next to the page it shows
   (the page's identity is its `pageId`, §5.3). `dfd.thumbnail` stays and always holds the **root
   page (*Top*)**, so classic projects, older readers and every existing consumer keep working
   unchanged. Classic single-page projects have no `dfd.pages` and keep exactly today's format. The
   field is optional and additive inside schema 9; `prepareForDisk` normalises every page thumbnail
   like `dfd.thumbnail` (pinned `ge-svg-*` id) so the TCS diff stays stable.
2. **Generation:** after a save, export each page whose content changed (per-page XML hash) — not
   only the active one. To verify in Phase 5: whether the embed export can address a page directly
   (page id / index in the export message) or whether the bridge must select each page, export and
   restore the user's tab. Either way the user's view must not visibly jump. A page without a
   thumbnail yet shows a placeholder plus the existing "regenerate" action.
3. **Preview panel:** a page selector (tabs or dropdown with the page tree order and names, *Top*
   first) above the image; default *Top*; the selection is a per-viewer convenience (not persisted
   in the project). Single-page projects show no selector.
4. **Reports (Phase 7):** one figure per page in tree order, captioned with the page name and — for
   child pages — the decomposed MP (`MP-1 Sensor Head`). The CLI reporter needs nothing new: it
   rasterises stored SVGs exactly as today, so per-page figures come without a headless draw.io.

**Size:** n pages = n SVGs in the project file. Acceptable (a thumbnail is typically tens of kB);
regenerating only changed pages keeps the TCS diff to the pages actually edited.

## 13. Implementation phases

**Phase 0 — Guard and inventory (small, ship first). ✅ Guard done** (commits "fix(dfd): refuse
multi-page and compressed draw.io layouts" and "fix(threats): block generation and sync on
multi-page DFD layouts"); the inventory script is still open. On load, before any parse result
reaches the threat or risk feature: detect more than one `<diagram>` or a compressed one; show a
blocking message "multiple pages / compressed pages are not supported yet" and do **not** run
threat generation on a partial model. Inventory script over `TARAflow_Examples` to find files that
already contain several pages.

**Phase 1 — Identity and occurrence model.** Split into commits:

- **1.1 ✅** page-aware parsing: `page-reader`, parser runs per page, `ParseResult.pages`
  / `occurrences` (in memory); golden gate against the former whole-document parse.
- **1.2 ✅** identity: read the identity links (lazy, §5.2), merge context copies into their
  definition, resolve connection endpoints from page-local cell ids to `tfId`s. Since rev. 4.1 the
  links come from `dfd.pages[].links` (`DFDParser.parse(xml, pages)`), not from XML attributes;
  `parsers/identity-reader`;
  `ParseResult.occurrences` carry `tfId`, `role` and, for flows, the endpoints as drawn on that page
  (`sourceTfId`/`targetTfId`) — the input of the stitching algorithm (§6.2). Record selection per
  `tfId`: the first definition in document order; without any definition the first context copy
  (the element stays in the model, detection is 1.4); further definitions of the same `tfId` are
  kept as occurrences only (reassignment: 1.3 decides, Phase 3 applies). A `ref` without `tfId` is a plain definition of
  its own cell, never guessed into a merge. Consumers that address XML cells by id (label/property
  write-back, auto-numbering, id-label visibility) stay cell-id based; they only diverge from the
  `tfId` once links exist (1.4 / 1.5) and are made `tfId`-aware there.
- **1.3 ✅** `services/leveled/`, pure and derived:
  - `dfd.pages` is persisted as written (`prepareForDisk`); classic projects get none. No schema bump
    (§11.2).
  - `computeHomePages` (§5.4): page of the definition cell — the same definition the parser takes
    the record from; no home page while dangling.
  - `buildPageTree`: reconciles `dfd.pages` with the XML pages (XML names win), derives root, parent
    page (= home page of the decomposed MP, §5.3.1), depth and tree order; reports inconsistencies as
    issues instead of repairing them (§7, page-tree findings).
  - `findDuplicateDefinitions` (D8): decides which definition cell keeps a duplicated `tfId` (the one
    in the last saved state, otherwise tree order, then document order). Since links are page-local
    the only source is a duplicated page with plain cell ids. The fresh `tfId` is a JSON link, but the
    new displayId lives in the id label in the XML and needs the numbering, so applying the
    decision **lands in Phase 3** (3.3).
  - Stale-link pruning on save (§5.2): done in 1.4.
- **1.4 ✅** `services/leveled/dangling` and `identity-links` — the only writers of `dfd.pages[].links`,
  all pure (new array, or the same one if nothing changes; the XML is never touched):
  - `findDanglingReferences` (§5.2.1, `BAL_DANGLING_REF`): `tfId`s with context copies but no
    definition. The element stays in the model (record from the first copy, persisted properties
    merged by id).
  - `promoteToDefinition`: a chosen copy of a dangling element becomes its definition. Refused if the
    element still has a definition.
  - `makeDefinition` ("Make this the definition"): the copy becomes the definition, the former
    definition cell a `ref` — a `ref` link with `tfId` = own cell id, which the reader accepts. Moving
    back restores the lazy state (no link). Refused for dangling elements, duplicate definitions, or a
    page without a `dfd.pages` entry.
  - `pruneStaleLinks`, called by `saveDFD` / `saveDFDFromXml`: drops links whose cell no longer
    exists in the XML (existence only — a present but unparsed cell keeps its link); pages missing
    from the XML stay untouched (`PAGE_MISSING`). Saving never adds `dfd.pages` to a classic project.
  - The buttons for these actions come with the UI (Phase 5).
- **1.5 ✅** adoption and paste assignment **logic** (the dialog itself comes with the UI, Phase 5,
  when the guard falls and the effect is visible):
  - `signatures`: `(displayId, type)` grouping signature; only real ids count (prefix / bracket id).
  - `proposeAdoption` / `applyAdoption` (§11.2.1): groups, conflicts, label divergence, definition
    with reason (`existing` / `root` / `highest` / `tie-break`), decomposition proposal per page
    (`root` / `existing` / `proposed` / `ambiguous` / `unplaced`, with candidates). Applying takes the
    analyst's decisions (reject a group, another definition, another decomposition) and writes
    one `dfd.pages` entry per XML page; a second proposal on an adopted file finds nothing to merge
    and re-applying is a no-op.
  - `proposeCopyAssignments` / `applyCopyAssignments` (§5.2 lifecycle): new plain cells whose
    `(displayId, type)` matches exactly one existing element/flow; default *copy* on another page,
    *new* on the definition's own page; applying is all-or-nothing.
  - `linkAsContextCopy` ("Make this a context copy of …"): refuses linked cells, self links, targets
    without definition, type mismatches and pages without entry.

Phase 1 is complete: identity, occurrences, page tree and every identity action exist as pure,
tested functions; nothing of it is reachable from the UI yet, and multi-page files stay refused by
the Phase 0 guard until Phase 2 delivers the effective model.

Gate: every existing example project loads and produces identical threats **including** threat
attributes, references, display ids and asset relations (golden test).

**Phase 2 — Effective model and analysis contract.** Leaves, stitching algorithm (§6.2), interface
chain (§6.2.1), boundary inheritance, analysis state with reason → `DFDGraphReference`. Interaction
generator iterates the interface list. Document which graph properties the generators may rely on
(every endpoint is a leaf or a flagged fallback; boundary sets are complete; no EE→EE flows).
Split into commits:

- **2a ✅** `services/leveled/effective-model`, pure: containment parents (§5.3.1), leaves (§6.1),
  stitching per flow side (§6.2: one chain → deepest; otherwise lowest common ancestor, or — without
  a common ancestor — the endpoint drawn by the flow's definition; a decomposed MP nobody drew below
  → `unresolved`), dangling endpoints, `BAL_DUPLICATE_OCCURRENCE` (all occurrences still used),
  states `resolved` / `fallback` (reasons ordered `ambiguous > dangling > unresolved`) / `excluded`
  (EE→EE with `DFD_EE_TO_EE_FLOW`, `excludeFromThreatGen`; `abstract` follows with Phase 4). Gate
  part: the leveled Smoke Detector's leaves are exactly the single-page elements and all 41 flows
  resolve to the single-page endpoints, no findings (`regression/leveled-smoke-detector-gate`,
  fixture `fixtures/leveled/smoke-detector-leveled.json`).
- **2b ✅** interface chain per flow (§6.2.1) and effective boundaries with inheritance (§6.3, D14).
  The per-page geometry is computed by the existing graph builder on each page alone
  (`page-geometry`, fed by the new `ParseResult.pageCells` — the cells as drawn, copies included), so
  there is one geometry implementation. `buildEffectiveModel` takes it as `pageGeometry` and adds
  `EffectiveFlow.interfaces` (side by the page's decomposition border, level = depth of the
  interface's home page, deduplicated by (tfId, side), `BAL_INTERFACE_UNATTRIBUTED` instead of a
  guess) and `EffectiveElement.boundaries` (home-page geometry ∪ the parent's effective boundaries;
  interfaces without the parent's trust boundaries; dangling: union over the copies,
  `boundaryProvenance: context-copies`). Gate part: for the leveled Smoke Detector every flow
  crosses exactly the single-page interfaces and every element lies in exactly the single-page
  trust/chip/physical boundaries; DF-7 carries `IF-1` (source, level 1) and `IF-3` (target, level 1).
  D15 is part of the effective model: only pages that define a part of their own decompose their
  MP.
- **2c-1 ✅** hand-over to the analysis graph, guard still in place. `DefaultDFDGraphBuilder` accepts
  optional precomputed facts (boundary membership, trust boundary nesting, crossed interfaces) and
  takes them instead of the geometry of one page; key sets and orders follow the geometric
  builders. `buildDfdGraph` is the one entry point (all seven former builder calls: load, save,
  save-from-XML, validation, finalize, `ensureProjectGraph`, `resolveDfdGraph`): one page → as
  before; several pages → effective model, leaves as elements, stitched flows (excluded flows left
  out), facts from 2b. Gate part (`regression/leveled-smoke-detector-threats`, fixture now with the
  records and assets): the leveled graph has the single-page elements, flows, boundary membership
  (member lists compared as sets — they follow page order), nesting, effective trust boundaries and
  an identical data-flow analysis; element and interaction generation give **exactly the same 451
  threats**.
- **2c-2 ✅** guard narrowed, schema 9, reporter note.
  - `inspectDrawioPages(xml, adoptedPageIds)`: a multi-page layout is supported once every page has
    an entry in `dfd.pages`; compressed pages stay refused. All service guards pass the ids
    (`dfd-service` load/save/validate, threat generation and sync via `ThreatProjectData.dfdPageIds`,
    threats-tab banner). Imports of DFD files and auto-numbering keep the strict check (no
    `dfd.pages` on import; numbering across pages is Phase 3). Messages now say "not adopted".
  - **Validation sees the analysis view too** (`buildAnalysisView`, shared with the graph): leaves
    and stitched flows. Found with the leveled Smoke Detector: with the raw records the validator
    reported a missing TLS terminator on two flows drawn to `MP-2` on *Top* and property warnings
    for the decomposed MPs. Now its findings equal the single page exactly
    (`regression/leveled-dfd-service`).
  - Schema 9 (`migrate_8_to_9`, no data change) as the version fence of §11.2; reason text in the
    conversion dialog.
  - **CLI reporter: note instead of refusal** (deviation from the plan). The reporter builds no
    graph and generates no threats — it prints stored data. For a leveled project the threat and
    risk tables are complete and correct; only the DFD figure (stored thumbnail) and the flow list
    (endpoints as drawn by the definition, i.e. the top level) are simplified. A refusal would block
    reports of leveled projects altogether, so the CLI prints a note until Phase 7.
Gate: golden test on the leveled Smoke Detector fixture (§3, §16) + ambiguity/self-loop/EE→EE cases.
The fixture is built from the single-page `SmokeDetector` example; its threats for elements and
flows that are unchanged by the leveling must equal the single-page result.
A generated three-page version exists (*Top* with MP-1 *Sensor Head* and MP-2 *Smoke Detector
Controller*; *Sensor Head*; *Smoke Detector Controller*; page links on the multiprocesses; all original cell ids kept, copies linked in
`dfd.pages`). Checked against the single-page original with the current parser and graph builder:
same 36 elements + 2 MPs and 41 flows, no dangling copies, stitched endpoints and the union of
crossed interfaces identical for every flow, trust/chip/physical membership identical for every
element under the interface rule of §6.3; adoption (1.5) of the same file without links proposes
exactly its links and decomposition.

**Phase 3 — Numbering.** (rev. 2026-10-17: hierarchical numbers, D19)

- **3.1 ✅** dotted IDs accepted everywhere (no behaviour change): risk grouping by element and
  interface detection on threat ids, description view, validator id tags in names, adoption
  signatures, id-label recognition and whole-number replacement in auto-numbering, attack tree
  highlighting.
- **3.2 ✅** hierarchical renumber across pages (§8). `DFDAutoNumbering.autoNumber(xml, pages)`:
  - every page is its own search scope (cell ids are page-local); pages in tree order from the same
    page tree as the analysis, unplaced pages after them in document order;
  - counters per page namespace and type; only definitions take numbers, once per logical element
    (`kind` + `tfId`); every occurrence shows the number of its logical element; a duplicated
    definition (same `tfId`) shows the same number until 3.3 reassigns it;
  - the guard is narrowed like in 2c-2: numbering runs once every page is adopted; the editor hook
    reads `dfd.pages` at the moment of numbering;
  - single page: byte-identical output to the previous implementation (checked on all example DFDs
    with all three sort strategies before the old code was replaced).
- **3.3 ✅** duplicate definitions (decision of 1.3). `reassignDuplicateDefinitions` runs in both
  save paths after stale-link pruning: `findDuplicateDefinitions` against the last saved state
  (tree order as fallback), then `giveFreshIdentities` (the link writer, `identity-links`) gives
  every non-keeper a `definition` link with the fresh `tfId` `<pageId>:<cellId>` (counter suffix
  on a clash). Flows on that page attach to the new identities through the page's links, so a
  duplicated page becomes a set of new elements and flows — never merged. Stable on the next save.
  - **Deviation:** the new displayId is **not** written on save. The save path never rewrites the
    XML — the editor owns it, and a rewritten label would be overwritten by the next autosave. The
    duplicate keeps its drawn label until the next explicit renumber, which numbers it as the new
    definition it is (next free number in its page's namespace). Until then the existing
    duplicate-id warning shows the clash.
  - `ID_PASTE_REASSIGNED` comes with the other leveled findings in Phase 4 (none reaches the
    validator yet).
  - Reachable in practice only with Phase 5: a duplicated page is a new, unadopted page and
    refused until the adoption dialog adopts it.

**Phase 4 — Validator.** (split 2026-10-17)

- **4a ✅** leveled findings in the DFD validation.
  - `leveled/leveled-findings`: `collectLeveledFindings` turns the page-tree issues, the
    effective-model findings and the occurrences into `ValidationFinding`s with the §7 severities;
    message keys `dfdValidation.leveled.<CODE>` (en/de), parameters are human-readable names
    (displayId + name, page names as in the XML — the XML name wins, §5.3). Rules computed here:
    `BAL_HOME_NOT_HIGHEST`, `BAL_LABEL_DIVERGENCE`, `BAL_MISSING_PARENT_FLOW` (without `refines`
    until 4b), `ID_PASTE_REASSIGNED`.
  - `AnalysisView.leveledFindings` (built with the view, single page: none) → validator option
    `leveledFindings`, appended in every validation (load, both saves, `validateCurrentState`).
  - **New severity `infos`** (`ValidationResult.infos`, `DFDValidation.infos`, optional, absent =
    none): never affects `isValid` / `isComplete`. The DFD notification panel shows them like the
    asset panel — hidden by default, the info chip (or the "Notes" filter) shows them.
  - Error policy (D10) confirmed in the code: validation errors only set the DFD phase status;
    nothing gates threat generation on them.
  - `ID_PASTE_REASSIGNED` is **derived from the state** (a `definition` link `<pageId>:<cellId>`
    whose displayId is still shared with another record), not handed over from the save: the panel
    shows `validateCurrentState`, which knows nothing about the last save. It disappears with the
    next renumber.
  - `BAL_DUPLICATE_DISPLAY_ID` is **not** a separate finding: the existing duplicate-id check on
    the records covers it (one finding per fact).
  - Leveled SmokeDetector: no leveled finding at all (regression).
  - Known limit until Phase 5: clicking a finding selects the cell by record id, which misses
    linked cells (see Phase 5 prerequisite; fixed in 5a).
- **4b ✅** `refines` and `abstract` (§6.4).
  - `DataflowProperties.refines` / `.abstract` (JSON, persisted with the flow record).
  - Effective model, second pass after stitching (`applyRefinements`): target missing (or the flow
    itself → cycle), cycle along the `refines` chain, compatibility of the refining flow's
    resolved endpoints with the drawn endpoints of the target's **top-most occurrence**
    (ancestor-or-self in the containment tree, same direction). `EffectiveFlow.refines =
    { target, valid }`. Exclusion reason `abstract` only with ≥ 1 valid refinement (decision above).
  - Findings `BAL_REFINES_TARGET_MISSING`, `BAL_REFINES_CYCLE` (errors),
    `BAL_REFINES_INCOMPATIBLE`, `BAL_ABSTRACT_WITHOUT_REFINEMENT` (warnings), en/de.
    `BAL_MISSING_PARENT_FLOW` accepts a **valid** refinement as substitute (D2); an invalid one
    counts as absent.
  - Data-flow form: section "Leveling" (only when the DFD has several pages) with *Refines* (all
    other flows, natural id order; validity is the validator's job) and *Abstract*.
- Moved: `BAL_ASSET_NOT_REALISED` → Phase 6 (asset roll-up); threat-tab banner "N flows analysed
  on parent level" → Phase 5 (UI).

**Phase 5 — UI.** **Prerequisite (gap found in 3.3):** UI code still addresses draw.io cells by the
record id — selection (`selectCell(element.id)`), the details/property forms and their write-back,
id-label visibility. For every cell with an identity link (adoption, "Make this the definition",
duplicate reassignment) record id (`tfId`) and cell id differ, so these paths miss the cell. 1.2
planned to make them `tfId`-aware in 1.4/1.5; that did not happen. Needed: a cell ↔ `tfId` map per
page (from the occurrences) used in both directions, plus "which occurrence" when a record has
several. Page tree, decompose action, context-copy styling and actions; the adoption /
assignment dialog on top of the 1.5 logic (one dialog, two entry points: `ID_ADOPTION_PENDING` and
the paste hint). Per-page thumbnails (generation of changed pages, `dfd.thumbnail` = *Top*) and the
page selector in the preview panel (§12.1, D18).

- **5a ✅** cell ↔ `tfId` (the prerequisite above).
  - `leveled/cell-identity`, pure: `buildCellIdentityIndex(pages, occurrences)`.
    `tfIdOf(cellId, pageId)` reads the page's links like the parser (so a cell the last parse has
    not seen yet resolves too); without a page id only a cell id that is unique across pages is
    resolved, otherwise the cell id is kept — never a guess. `cellOf(tfId, preferredPageId)`: the
    occurrence on the page the user is looking at (its definition first), else the definition,
    else the first copy (dangling). `occurrencesOf(tfId)` for "Show occurrences" later.
  - `useCellIdentity(dfd)`: classic projects (no `dfd.pages`, or one page without links) skip the
    parse and get the identity — selection unchanged.
  - draw.io is page-aware: the injected plugin sends the current `pageId` with every selection and
    an empty selection on `pageSelected`; `drawio:selectCell(cellId, pageId)` opens the page first
    (ids passed as JSON literals instead of being spliced into the script).
  - `useDFDEditor`: every selected cell gets `tfId`, the side panel opens the logical record (also
    for context copies); `selectCell(tfId)` — findings, asset graph, notification panel — picks the
    cell via `cellOf` and the remembered current page.
  - Scope check against the list above: the forms write only the JSON records (keyed by `tfId`),
    never the XML, so they needed no change. `useIdLabelVisibility` is unused (no caller), left
    alone. Still cell-id / first-page based: the asset overlay (`dfd-overlay-builder`, first
    `<diagram>` only, §4) — with the page tree.
- **5b ✅** adoption / assignment dialog (§11.2.1, §5.2 lifecycle, D8, D13) on top of the 1.5 logic.
  - `leveled/identity-review`, pure: `reviewAdoption(xml, pages)` (only while pages are
    unadopted), `reviewCopyAssignments(current, baseline)` (adopted DFDs only, and only if at
    least one cell is proposed as a *copy* — a duplicate on the definition's own page alone is an
    ordinary paste), `confirmAdoption` / `confirmCopyAssignments` → new `dfd.pages`.
  - `ID_ADOPTION_PENDING` replaces the Phase 0 message "multi-page not supported" (en/de).
    **Deviation from §7:** severity *error*, not warning — while it is pending the save is still
    refused (the model is not derived from unadopted pages), so the finding does block.
  - One dialog (`IdentityReviewDialog`), two entry points as hints above the diagram
    (`IdentityReviewHints`): *Adopt pages…* while `ID_ADOPTION_PENDING` is reported, *Assign…*
    after a save that brought pasted copies. Adoption: page table (decomposed MP per page, status
    root / adopted / proposed / ambiguous / unplaced, candidates first), groups (merge on/off,
    definition per group with the tie-break marked, label divergence and conflicts shown —
    conflicts are never merged). Assignment: *context copy* / *new element* per cell, "all as
    copies", "keep all as new".
  - `useIdentityReview`: the adoption proposal is made for the current draw.io XML (storage
    adapter, as `saveDFD`); the paste hint compares the saved state with a baseline that moves on
    with every decision (apply or dismiss) and is taken when a classic project gets its pages, so
    every pasted cell is asked about once and adopted copies are not asked about again.
  - `savePages(pages)` (persistence / editor): immediate save of the current XML with the new
    `dfd.pages`; the XML is not touched. The root page keeps its name; renaming it to *Top* (D17)
    writes the XML and comes with the page tree.
  - **Fix (found in use):** a page without `decomposes` *is* a root page — there is no "outside
    the tree". The dialog offered "no decomposition" for an unplaced page and adopted it as a second
    root (`PAGE_MULTIPLE_ROOTS`). Now `applyAdoption` refuses every non-root page without a
    decomposed multiprocess (`PAGE_NOT_PLACED`); the dialog requires the choice (only multiprocesses
    no other page details are offered; none left → the page has to be deleted or its MP drawn first).
  - **Repair:** the same dialog also opens for adopted entries the tree cannot use — extra root
    pages and pages gone from the XML (`misplacedPages`, hint *Review pages…* on
    `PAGE_MULTIPLE_ROOTS` / `PAGE_MISSING`). Extra roots (all but the first by order) are proposed
    again like unadopted pages, missing entries are dropped; links of all other pages are kept.
- **5c ✅** page information on draw.io's own page tabs (§12) instead of a page tree panel
  (decided 2026-10-17 after a first version with a panel: the tab bar already lists and switches
  the pages; a second list next to it only costs space). The automatic child page (D15–D17)
  follows in 5d.
  - `leveled/page-outline`, pure: `buildPageOutline` — pages in tree order with depth and the
    detailed multiprocess, unplaced pages after the tree, `pendingDecomposition` for a child page
    without a part of its own (D15: the MP is still analysed as a whole; the rule is shared with
    the effective model as `pagesWithOwnParts`), finding counts per page by the home page of the
    element / flow a finding names (findings without an element count on no page).
  - `leveled/page-tab-info`, pure: tooltip lines and badge (error count, else warning count) per
    page; texts through `t`.
  - The injected plugin decorates the tabs after every `ui.updateTabContainer` (all `.gePageTab`,
    page by `data-index`): tooltip (`title`) and a small badge; without info the tab stays as it
    is. (Fix after checking the draw.io source: the first version wrapped `createTabForPage`, but
    draw.io caches tabs in `btPageTabCache` and resets a reused tab's title to the page name.) `drawio:setPageTabInfo` (info as JSON literal) stores the info and redraws
    the tabs (`updateTabContainer`). The DFD tab sends it whenever the outline or the findings
    change, once the plugin is ready (`pluginReady`, ~3 s after load). Electron only.
- **5d ✅** child page per new multiprocess, tab names (§5.3, §12, D15–D17).
  - `leveled/child-pages`, pure: `planPageSync` — every **new** multiprocess (definition, no child
    page yet) gets a page named like the MP with the page link on all its cells; the root is named
    *Top* from the second page on; a child page's name follows its MP (D16). A classic project
    gets its `dfd.pages` (root + child) only with its first child page.
  - **Classic projects: only new multiprocesses** — those that exist when a classic DFD is opened
    get no page; opening a project with multiprocesses must not level it (such an MP gets its page
    with "Decompose…", 5e). **Leveled projects: every multiprocess without a child page** gets one,
    also right after opening (fix after first use: the first version applied the "only new" rule
    to leveled projects too, so an MP that missed its page never got one). A new MP that looks like
    a copy of an existing one (same real displayId) is left to the copy assignment (5b).
  - Diagnosis: `useChildPages` logs every reason for doing nothing once (`[useChildPages] nothing
    to do: …`) and every sync; the plugin logs the draw.io page API it finds (`[Plugin] page
    API: …`), and a refused `syncPages` reports which functions are missing.
  - `drawio:syncPages` (spec as JSON literal) creates the pages (`createPage` / `insertPage`), sets
    the links (`setLinkForCell`, switching to the MP's page if needed) and renames
    (`RenamePage`), then shows the user's page again; idempotent; without the page API it
    changes nothing and reports the failure. API checked against the draw.io source
    (`diagramly/Pages.js`): `createPage(name, id, node)`, `insertPage(page, index)` — a no-op
    while the graph is not editable, so the script checks that the page exists afterwards and
    only reports created pages —, `selectPage`, `RenamePage(ui, page, name)`,
    `Graph.setLinkForCell`.
  - `useChildPages` after every save: draw.io first, then `dfd.pages` (before draw.io's autosave
    brings the page, so it arrives adopted). Guards: one sync at a time, one attempt per MP and
    per rename per session; when draw.io refuses, a classic project stays classic (no *Top*, no
    `dfd.pages`). `settling` hides the page-repair hint while the new page is on its way.
  - **Deleted child page** (decided 2026-10-17, "stays away"): a child page deleted in draw.io
    leaves `dfd.pages` automatically (the XML says which pages exist) — no `PAGE_MISSING` that
    only a dialog could clear. If its multiprocess still exists, it gets
    `MultiprocessProperties.noChildPage` and no page automatically again; "Decompose…" (5e)
    creates one explicitly. A page created in this session counts as on its way (`settling`)
    only until it has appeared in the saved XML once — before that it is never taken for deleted
    (fix: the first version kept a deleted page "settling" for ever, which hid the repair hint).
  - Consequence of D17 for leveled projects saved before 5d: their root page is renamed to *Top*
    when they are opened.
  - Open after 5d: see 5e.
- **5e ✅** child page actions (§5.2 "Delete a page", §12).
  - **Deleted multiprocess:** `planPageSync` reports child pages whose multiprocess is gone
    (`orphans`; a dangling MP keeps its record from its copies and is no orphan). The DFD tab asks
    once per page and session: *Delete page* (`drawio:syncPages` `remove`, draw.io `removePage`;
    the entry then leaves `dfd.pages` like any page deleted in draw.io) or *Keep page* (it reports
    `PAGE_DECOMPOSES_UNKNOWN` until it is deleted or the MP is drawn again). Fix after first use:
    `removePage` silently does nothing while the graph is not enabled — the script then executes
    the same undoable `ChangePage` directly, reports `graphEnabled` and the page counts if the page
    is still there, and the dialog stays open with the error instead of closing.
  - The *Review pages…* hint (5b repair) only appears for what needs a decision — an extra or
    a missing **root** page (`needsPageRepair`, from the saved state). A deleted child page is
    cleaned up automatically (5d); deriving the hint from the validation made it flash for a few
    seconds after every page deletion until that save.
  - **"Create child page"** in the details panel of a multiprocess without one — the "Decompose…"
    of §12 for multiprocesses the automatic rule leaves out (classic project, MP that existed at
    opening, `noChildPage`). Clears `noChildPage`; refused for an MP that already has a page.
    The panel names the child page of a decomposed MP. Electron only (draw.io plugin).
  - **Page links on later copies:** `planPageSync` compares the `link` attribute of every
    occurrence of a decomposed MP (`readCellLinks`) with its page link and has draw.io set the
    missing ones (`link`), once per cell and target per session.
  - Pre-population and "Sync context": 5f.
- **5f ✅** context copies (§12 "Decompose…" / "Sync context").
  - `leveled/context-copies`, pure: `planContextCopies` — from the MP's home page the boundaries
    around the MP or a flow neighbour (page geometry), the flow neighbours and the flows touching
    the MP; never the MP itself, no self-loops, no second-degree neighbours. Only what the child
    page does not show yet (by tfId), so it is idempotent and never causes
    `BAL_DUPLICATE_OCCURRENCE`; a flow copied later is connected to the neighbour copy already
    there (`existing`).
  - draw.io (`drawio:syncPages` `context`): `graph.cloneCells(…, keepPosition)` with the home
    page shown — the copies keep the parent's layout and a flow whose MP end is not cloned keeps a
    **free end at the MP's border position**, to be dragged onto the new parts (mxGraph sets the
    terminal point from the view state). Nested DFD elements are removed from the clones, ID labels
    kept. Returns original → clone per cell.
  - Every child page gets its context when it is created (automatically, 5d, or by "Create child
    page", 5e); "Sync context" in the details panel adds what is missing on an existing one.
  - **Pure context pages follow automatically** (fix after first use: an MP's page is created at
    the first save, usually before its flows are drawn, so it stayed empty). While a child page
    has no part of its own (D15), its missing context is copied after every save; once the
    analyst draws parts there, "Sync context" is manual — nothing removed on purpose comes back.
    Each context cell is requested once per page and session.
  - **Both ways** (decided after first use of 5g): a pure context page also drops context copies
    that left the context — the copy of a flow deleted or re-routed on the home page, a neighbour
    without a flow to the MP, a boundary around none of them (`planContextRemovals`, draw.io
    `removeCells` without connected edges). Only context copies, never a definition; nothing for an
    MP without home page (orphan question, 5e). On a page with parts of its own a copy whose
    definition was deleted stays and reports `BAL_DANGLING_REF` (§5.2): there work may hang on it
    (a flow attached to a part), so the analyst decides ("Promote to definition" or delete).
  - **Links after the autosave:** the clones become context copies (`ref` links to the originals'
    tfIds) as soon as draw.io's autosave has brought the cells into the saved XML — a link written
    earlier would be dropped as stale by the same save (`pruneStaleLinks`). Until then
    `settling` hides the paste hint (5b) and the clones get no automatic page.
  - **Loose flows:** a copied flow with a free end is no occurrence for the parser yet (and reports
    an unconnected data flow until its end is attached). It is linked as soon as the cell is in the
    saved XML — not only once attached — and `planContextCopies` counts linked cells of the child
    page as present (`childLinks`), so it is never copied a second time, also after reopening.
- **5g ✅** context copies visible, identity actions (§5.2, §12; the buttons promised in 1.4 / 1.5).
  - **Display:** context copies are shown faded and dashed (opacity, dashed stroke), with their ID
    label. In the display only — the plugin wraps `graph.getCellStyle`; the XML style is not
    touched (§5.2: plain draw.io, no diff noise). The DFD tab pushes the copy cells per page
    (`drawio:setContextCells`, JSON literal) after every save — `contextCellsOf`: every `ref`
    occurrence plus every cell with a `ref` link (fix after first use: a copied flow with a free
    end is no occurrence for the parser and was not faded).
  - `leveled/identity-info`, pure: `describeIdentity(parse, pages, cell)` — role of the selected
    cell, definition, all occurrences, and which actions apply.
  - Details panel, section *Identity* (leveled DFDs): *Context copy* / *Definition*; for a copy its
    definition with **"Go to definition"** and all occurrences as links (**"Show occurrences"**,
    `selectCellAt` opens the page); **"Make this the definition"** (copy with a definition
    elsewhere), **"Promote to definition"** (copy of a dangling element, the `BAL_DANGLING_REF`
    repair), **"Make this a context copy of …"** (plain cell, same type, with a warning that its own
    record is dropped and its threats become orphans). Each writes `dfd.pages` through the 1.4 /
    1.5 writers and `savePages`; a refusal is shown with its code.
  - Not here: the form of a copy is still editable — it edits the logical record, which is the
    same record the definition shows (§5.2 asks for "not editable", but the record is shared, so
    nothing diverges).
- **5h ✅** "Insert as context…" (§5.2 lifecycle, §12).
  - `leveled/context-copies`: `insertCandidates(parse, pages, page)` — elements and flows with a
    definition that do not occur on the page yet, never the MP the page details;
    `planInsertAsContext` — clones the definition cell (5f mechanism, same position as on its own
    page); an inserted flow is connected to copies of its ends already on the page.
  - Toolbar button (leveled DFDs, Electron) → dialog: one tab per category that still has
    candidates (element types in palette order, then data flows and boundaries, with counts),
    below it a searchable list of that category only, each entry with its definition page
    (changed after first use from one list for everything); the target is the page draw.io shows
    (selection events; before the first one the first page of the document).
  - **`DFDCellLink.manual`** (additive JSON): an inserted copy is marked as inserted by hand — a
    pure context page never removes it automatically (`planContextRemovals` skips it), although
    it is not part of the MP's flow context.
  - An action of the analyst ("Insert", "Sync context") waits up to 5 s for a sync that is
    running instead of failing with "busy".
- **5i ✅** one thumbnail per page (§12.1, D18).
  - **Export without switching the page:** draw.io's embed SVG export renders the current page
    only (`pageId` exists for PNG only, checked in `diagramly/EditorUi.js`). `drawio:exportPageSvgs`
    does what draw.io does for a page that is not shown: a temporary graph
    (`createTemporaryGraph`, `updatePageRoot`, `model.setRoot(page.root)`), `getSvg`, removed
    again; the current page renders directly. The DFD shapes are stencils, so no image embedding
    is needed.
  - `leveled/page-thumbnails`, pure: `pageFingerprints` (FNV over each `<diagram>`),
    `pagesToExport` (pages without thumbnail, or changed since their export — a stored thumbnail
    counts as current at opening), `withPageThumbnails` (`dfd.thumbnail` mirrors the root page).
  - `usePageThumbnails` after every save, once the plugin is ready and the iframe can render
    (`waitForRenderable`, as the single thumbnail); stores via `scheduleSave` (JSON only).
    The single-thumbnail export after the autosave and at plugin start is skipped for a leveled
    DFD — it would put the page that happens to be shown into `dfd.thumbnail`.
  - `prepareForDisk` pins the random `ge-svg-*` id of every page thumbnail like `dfd.thumbnail`.
  - Fix after first use (thumbnails appeared only after several edits): an update replaces
    `dfd.pages` wholesale, and the page-tree writers (`savePages`: child pages, adoption, identity
    actions) pass pages without thumbnails — `savePages` now keeps the thumbnails of the base. And a
    try that could not export (iframe not visible yet, export failed) is repeated after 3 s instead
    of waiting for the next change; a thumbnail lost by another save is exported again at once.
  - **Preview:** `dfdPreviewPagesOf(dfd)` (shared) — pages Top first, Top falling back to
    `dfd.thumbnail`; `DFDPreviewPanel` shows a page selector for several pages (assets, threats,
    risks, attack trees), per viewer, not persisted. Classic DFDs unchanged.
  - Reports (one figure per page) remain Phase 7.
- **5j ✅** threat-tab banner "N flows analysed on parent level" (§6.5, §7, D4, D10; moved here
  from Phase 4).
  - `leveled/parent-level-flows`: `parentLevelFlowsOf(dfd)` — the effective flows in state
    `fallback` with label, the endpoints they are analysed with and the most severe reason;
    empty for a classic DFD. Computed in the app layout (memoised on the DFD) and handed to the
    threats tab as `dfdParentLevelFlows`, so the threats feature imports nothing from the DFD
    feature.
  - `ParentLevelFlowsBanner` (info, not an error — analysis runs, nothing is excluded): count,
    "Show" lists each flow with its endpoints and reason (not drawn below the MP / drawn to
    different parts / endpoint without definition). Hidden while the layout blocks generation.
  - The filter "by analysis state" in the threat table remains Phase 6.
  - The blocked-layout message (Phase 0 guard) now names the way out ("Adopt pages…").
- **5k ✅** a linked definition cell recreated (§5.2 lifecycle).
  - `leveled/lost-definitions`, pure: `findLostDefinitions(before, after, parse)` — `definition`
    links (tfId ≠ cell id: moved, adopted, promoted) whose cell is gone from the XML and whose
    element no longer exists at all (with copies left it is dangling — "Promote", 5g). Keeps the
    record; candidates are new plain cells of the same kind and type on that page, the same
    displayId first. `reattachDefinition` writes the `definition` link. A plain cell drawn again
    is a new element as in a classic DFD and is not reported.
  - **"Confirmation on save" as a question after the save:** the autosave cannot wait, so
    `useLostDefinitions` compares each saved state with the one before. Dialog: what refers to the
    element (threats — counted by the app layer, `threatCountOf` — and asset relations; attack-tree
    anchors hang on the threats), **Re-attach** to the new cell (link, then properties and asset
    relations written back, threats match again by tfId), **Accept deletion**, or **Later** (the
    modal must not block drawing the new cell; the question returns with a new candidate). The
    candidates follow the drawing; an undo that brings the cell back ends the question.
- **5l ✅** renumber one page (§8).
  - `DFDAutoNumbering.autoNumber(xml, pages, onlyPageId)`: the page **and the pages below it** —
    their namespaces hang on its multiprocesses (MP-2 → MP-3 would leave P-2.1 under MP-3).
    Every other page keeps its numbers: its definitions are read from their labels and seed the
    namespaces and the counters (a child page whose MP has no number yet numbers in the root
    namespace, after the highest number outside — no collision). Copies of renumbered elements
    on other pages follow. Root page or a page the tree cannot place: everything, as before.
  - Toolbar (leveled DFDs): the numbering button opens "Renumber all pages" / "Renumber «page»
    and its child pages" (the page draw.io shows); classic DFDs keep the one-click button.

Phase 5 is complete. Moved: per-page grouping of the description view → Phase 7 (with the
per-page report sections).

**Phase 6 — Assets & threat/risk lifecycle.** Roll-up with provenance, pending relations, undo
decomposition, reconciliation dialog (§10), page/subtree/state filters, risk roll-up.
**Grouping by multiprocess (D20, 2026-10-19, analyst's idea):** the asset, threat and risk
tables are grouped in one accordion per **top-level decomposed multiprocess** (the MP a child
page of *Top* details; parts of nested MPs belong to its group, no second accordion level), plus
a group **"Top level"** for everything not inside a decomposed MP (external entities, elements
drawn on *Top*, multiprocesses that are not decomposed). The subtree filter of §10 as a layout.
  - **Every threat in exactly one group** (revised 2026-10-19 after first use — first decided
    "flow threats in both groups"): a multiprocess group shows only its parts and the flows that
    lie **entirely inside it**; flows between multiprocesses, or between the top level and a
    multiprocess, are **top level**. Threats are generated once per logical flow on its stitched
    leaf endpoints (DF-7: P-1.1 → P-2.1, with the interfaces crossed, §6.2) — there is no second
    set "MP-1 → MP-2", which would double the register and the risk (§10). On the top level a
    flow end inside a multiprocess is labelled ("P-1.1 (in MP-1 …)").
  - **Revised 2026-10-21 (analyst, after the report):** for two teams, "top level" is the wrong
    answer to "which threats are mine". A **per-interaction** threat of a flow between groups
    belongs to the **side it attacks** — IN (victim = target) at the receiver, OUT (victim =
    source) at the sender: `CB-DF3-T-IN-1` (DF-3 MP-1 → MP-3) under MP-3, `SB-DF3-T-OUT-1` under
    MP-1; an EE's side stays top level. Still every threat once, the sums unchanged; risks follow
    their threats. Per-element threats (no side) keep the flow rule. `groupsOfDfdItem` with
    `DfdItemRef.victimElementId`, `dfdItemRefOfThreat` (shared; from `interactionContext.
    victimRole` and the flow's resolved ends) used by the threat and risk tabs and the report;
    `ThreatReference.interactionContext.victimRole` carries the side to the risks tab. A flow end
    in another multiprocess is labelled in every group. Leveled SmokeDetector per interaction:
    threats 76 / 35 / 103 → 33 / 44 / 137, risks 47 / 11 / 25 → 21 / 17 / 45 (top / MP-1 /
    MP-3).
  - **Summary row** per decomposed multiprocess in the top-level group: threats of its parts per
    STRIDE category, "Details" opens its group. A view — the multiprocess has no threats of its
    own once decomposed (§6.1).
  - **Assets** held in one multiprocess appear there; held in several multiprocesses → group
    **"Shared"**; held only on the top level, or linked to no element at all (people, the
    building — endangered by the system as a whole) → "Top level"; linked only to elements that
    are gone → group "Not in the DFD". A top-level element or flow that only carries an asset into
    one multiprocess does not make it shared (revised in 6c).
  - **Threat tables keep their trust-boundary grouping** inside each multiprocess group.
  - **Risks follow their threat's group(s).**
  - Classic DFDs (one page) and leveled DFDs without a decomposed MP: tables as today.

Order (Phase 6):
- **6a ✅** grouping model and the threats tab:
  - `leveled/table-groups`: `multiprocessGroupsOf(dfd)` — group of each element (the top-level
    decomposed MP along its containment parents; a decomposed MP as fallback endpoint is its own
    group; everything else "Top level") and of each flow (its MP if both resolved ends lie in it,
    otherwise "Top level" — revised, see D20).
    Undefined for a classic DFD or without a decomposed MP. The structure (`DfdTableGroups`,
    `groupsOfDfdItem`) lives in `shared`, computed once in the app layout.
  - `ThreatGroupSections` in both threat views (per element, per interaction): one accordion per
    group (count, expanded), the trust-boundary tables inside filtered to the group, the original
    table index kept (edit / delete / add unchanged); a threat whose element or flow is gone gets
    the group "Not in the DFD". Revision: summary rows on the top level, flow ends inside an MP
    labelled there (`endpointLabelFor`, interaction tables).
  - Fix after first use with the leveled SmokeDetector: a **boundary** belongs to the group of the
    page it is defined on (chip boundaries of a module page → that MP; an enclosure on Top → top
    level). And `isInterfaceTable` checks every threat (no threat bound to a flow) instead of the
    first: an enclosure table filtered to the enclosure's own threats was taken for a flow table
    and rendered as an empty accordion.
- **Fix before 6b — physical boundary (enclosure) threats** (not leveled-specific, found with the
  leveled SmokeDetector):
  - per interaction, an enclosure got the flow templates with sender = receiver = enclosure
    ("Attacker impersonates the enclosure to deceive the enclosure"). It has no flows and no
    partners: both methods now take its threats from the physical element templates.
  - per element, an enclosure inside a trust boundary was generated in the trust boundary's table
    too; the de-duplication then dropped its own table. Physical and chip boundaries are left out
    of the trust-boundary pass. Its own threats and those of its interfaces form one table
    (before: two tables with the same name).
  - catalog: impersonation of personnel (S-008, S-009) and the missing audit trail (R-012) only
    for `boundaryType` cabinet / room / building; a category without a matching template gets no
    threat for a physical boundary (no generic fallback; sync and drift use the same rule).
    Opening (T-001) proposes active tamper protection (M-PB-T-002) and the new tamper-resistant
    enclosure (M-PB-T-006: security screws, lockable or sealed cover, vandal-resistant), as does
    destruction (D-007).
  - stored projects: the drift banner offers to remove the threats no longer generated; a
    regeneration replaces the content of the others (analyst fields kept).
- **6b ✅** risks tab: `riskGroupSections` (risks utils) — a risk follows its threat's group (the
  threat's element or flow); a risk whose threat is gone or not in the DFD → "Not in the DFD".
  `RiskGroupSections` renders the trust-boundary view (per element / per interaction) once per
  group, the filters once above; summary rows per multiprocess on the top level (risks of its
  parts per risk level, assessment progress, "Details"). The groups reach the tab as
  `RiskProjectData.dfdTableGroups`. Not grouped: attack-tree risks (no DFD element) and the
  Won't table.
- **Fix before 6c — interface threats per interaction:** like the enclosures, interfaces got the
  flow templates with the interface on both ends ("Attacker impersonates the RS-485 bus to
  deceive the RS-485 bus"). Both methods now take interface threats from the interface element
  templates (`generateInterfaceElementThreats`); the natural key (element + STRIDE) is unchanged,
  so a regeneration keeps identity and ratings.
- **6c ✅** assets tab: `assetGroupOf` / `assetGroupSections` (assets utils) group an asset by the
  elements and flows of `linkedDFDElements`; `AssetGroupSections` renders the asset table once
  per group (top level, multiprocesses, "Shared", "Not in the DFD"), the table takes the height
  of its rows (`autoHeight`); "Show in table" from the asset graph opens the asset's group. The
  groups reach the tab as `AssetProjectData.dfdTableGroups`.
  - Fix found with the leveled SmokeDetector: a data-flow threat of the per-element method refers
    to its flow as `linkedElement`; `groupsOfDfdItem` now also looks an element id up among the
    flows. Before, these threats (and their risks) of top-level flows were listed under "Not in
    the DFD".
  - After first use: "Show factors" and "Needs review only" sit once above all groups
    (`AssetTableToolbar`; the group tables follow `view`); the review filter applies before the
    grouping, groups without a match disappear; the toolbar stays outside the scroll area. "Show
    in table" scrolls the row into view (a table with autoHeight has no scroll area of its own),
    repeated until the layout has settled — the group accordion may still be opening and the row
    heights are measured after the first paint, so one scroll fell short for a row further down. Assets without any DFD link go to the
    top level instead of "Not in the DFD".
- **6d ✅** asset roll-up on decomposed MPs with provenance, pending relations,
  `BAL_ASSET_NOT_REALISED` (§9):
  - `leveled/asset-rollup`: `assetRollupsOf(model, records)` — per decomposed MP the distinct
    (asset, relation type) pairs of its leaves and of the flows between its parts, with the
    holders (`via`); its own relations not covered = pending. A decomposed MP below it contributes
    nothing (its pending relations are not realised by a part).
  - `reconcileAssetRollup(before, after)` in both save paths (`saveDFD`, `saveDFDFromXml`): removes
    pending relations a part now covers; when a decomposition ends (child page deleted, last own
    part removed) the roll-up of the previous state becomes the MP's own relations. The previous
    state is analysed only if an MP of the previous page tree is no longer decomposed. A deleted
    part just leaves the roll-up.
  - `BAL_ASSET_NOT_REALISED` (warning) per pending relation, with the asset's name.
  - "Asset" tab of a decomposed MP (`AssetRollupView` via `AssetRollupContext`, computed in the DFD
    tab): read-only roll-up "via P-1.1, DS-1.1", pending relations with a remove action, no
    relation selector.
  - Open: page filter of the asset graph (§9, last bullet) → 6f with the other filters.
- **Fix (not leveled-specific): element stuck to the pointer after a click in draw.io.** A selection
  is made on mouse down; TARAflow set `pointer-events: none` on the draw.io iframe for one frame
  on every selection (to keep the opening details panel from moving the diagram mid-gesture). The
  pointerup then went past draw.io, mxGraph kept `isMouseDown`, dropped every further mousedown
  as out of sequence and the element followed the pointer. Now the plugin reports a selection made
  with the mouse only after the release (graph mouse listener, window pointerup / mouseup /
  pointercancel); the iframe workaround is gone.
- **Fix (not leveled-specific): diagram opened tiny.** draw.io fits the diagram into the window on
  load and on every page switch (`Editor.fitDiagramOnLoad` / `fitDiagramOnPage`, default true);
  a large diagram, or one loaded before the iframe was laid out, opened at a small zoom and needed
  "Reset view". The configure message now sets both to false: the diagram opens at 100 %.
- **6e ✅** reconciliation on re-generation — new / unchanged / reference changed / obsolete (§10):
  - `threat-reconciliation`: `reconcileThreats(stored, fresh, keyFn)` / `reconcileForProject`
    (runs the generator on a copy); manual threats take no part.
  - `referenceChanges(previous, fresh)` (threat-identity): `endpoint` (resolved source/target of
    the flow), `boundary` (trust boundary or crossing), `template`. `mergeGeneratedThreat` sets
    `Threat.review = { reasons, since }` on such a threat — id, relevance and risk stay; further
    reasons are added, the date stays. Saving the threat in its dialog ends the flag.
  - "Regenerate" dialog: the four counts, the flagged threats with their reasons, the new ones
    (`ThreatReconciliationSummary`); the existing drift link for obsolete threats stays.
  - "Review" badge in both threat tables and the threat dialog; in the risk tables the T-ID chip of
    a risk whose threat is flagged is outlined (`ThreatReference.review`).
  - Tested for every model change of the §10 table (review 2026-10-22): leaf MP decomposed;
    decomposition undone (the parts' threats obsolete, the MP's new; per interaction the flow
    keeps its threats as "reference changed: endpoint"); flow split into a parent and a refining
    flow (parent kept, refining flow new, nothing obsolete); definition moved to another page
    (unchanged — same effective boundaries); definition deleted with a copy left (threats kept).
    `threat-reconciliation.leveled.test.ts`, `threat-reconciliation.leveled-changes.test.ts`.
- **Fix (not leveled-specific): every risk "mitigations changed" after reopening.** The risk sync
  compared the proposed mitigations / verifications of risk and threat with `JSON.stringify`; the
  project file is written with sorted keys, the threat references list `{ id, text, notes,
  isCustom }`, and `text` follows the UI language. Now `sameDrafts` compares id, note and the
  custom marker only.
- **6f ✅** filters by page and analysis state, risk matrix per group (§10), asset-graph page
  filter (§9).
  - **✅ page and analysis-state filter** in the filter bars of the threat tables (both methods)
    and the risk table. "Page": the elements and flows shown on the page — definitions and
    context copies — optionally "with sub-pages" (offered when the page has some; the subtree
    filter of §10 below the top-level MPs, which the D20 accordions cover). "Only flows analysed
    on parent level (N)": threats of flows in state `fallback` (§6.5), offered while there are
    such flows. A flow threat is decided by its flow, not by the element it also names; a risk
    by its threat. Attack-path risks are not filtered (no DFD item, like the other risk
    filters). `DfdTableGroups.scope` (`DfdScopeIndex`: pages in tree order with depth, items per
    page, child pages, parent-level flows) is built with the groups (`dfdScopeFrom`); the filter
    is `dfdScopePredicate` (shared), the controls `DfdScopeFilterControls` (shared), held by
    `useThreatFilters` / `useRiskFilters`; "clear" resets it.
  - **✅ risk matrix per group** (revised after first use: a roll-up table below the matrix —
    counts per level per decomposed MP — was not helpful; the analyst wants to see the matrix
    itself for one part of the system): a drop-down next to Before / After — "All", "Top level",
    one entry per top-level decomposed multiprocess (the groups of the tables, D20). The matrix
    then shows only the risks of that group (`riskGroupSections`); attack-path risks only under
    "All" (no DFD item). `RiskMatrixGroupSelect`, `RiskMatrix.headerControls`. Pure view; the
    choice falls back to "All" when its group disappears. §10's "roll-up per decomposed
    multiprocess" is replaced by this.
  - **✅ page filter of the asset graph** (§9, last bullet): the same "Page" / "with sub-pages"
    controls in the graph's context bar. The graph then shows the elements and flows on the
    page(s), the assets they hold, and the asset links among those assets (`sourceOnPages`).
    Only the drawing is filtered — search, cards and edits keep every asset; a search hit
    outside the filter says so ("held by no element on the selected page", "Show all pages"),
    and going to such an asset from a card ends the filter (`assetVisibility` state
    `outsidePage`). The index comes from the façade (`useLeveledDfd().pageScope`); a page that
    is gone ends the filter.

**Review findings (2026-10-20), before Phase 7.** One patch per finding, each runnable and tested.
- **R1 ✅ shared leveled analysis** — one parse and one effective model per DFD state:
  - `leveled/leveled-analysis`: `parseDfd(xml, pages, parser?)` caches the parse per (XML, page
    structure without thumbnails); `analyseLeveled(source)` caches tree, home pages and model per
    parse plus the structural signature of the records (element types; `excludeFromThreatGen`,
    `refines`, `abstract` of flows). Records are merged on every call. Small LRU (4 states).
  - `effectiveModelOf` delegates to it, so save path, validator, asset roll-up, table groups and
    parent-level flows share one model; the app layout analyses once and derives groups and
    banner from it (`multiprocessGroupsFrom`, `parentLevelFlowsFrom`).
  - Every direct `dfdParser.parse` of the feature goes through `parseDfd`; `usePageOutline` takes
    the DFD tab's parse instead of parsing. Explicit hand-over to the remaining hooks follows with
    the façade (R4) and the split of `use-child-pages` (R3).
  - The save path gives every record its own copy of the parsed properties (later steps write
    into them, `deriveExposureLevels`); the cached parse stays untouched.
  - Measured: a save parses its XML once, a save without a change of the drawing not at all; a
    change of an ordinary property neither parses nor rebuilds the model.
- **R4 ✅ façade `useLeveledDfd(project, editor, selection)`** — the leveled flows of the DFD tab
  (4b refinement candidates, 5b review, 5c outline and page tabs, 5d/5e child pages, 5g context
  copies and cell identity, 5h insert as context, 5i thumbnails, 5k lost definitions, 5l page
  renumbering, 6d roll-up of the selection) moved out of `dfd-tab.tsx` (1328 → 1078 lines). The
  façade holds the shared analysis and hands its parse to `usePageOutline` and
  `useLostDefinitions`; the roll-up of the selection comes from the same model. Its
  dependencies are complete — three `exhaustive-deps` suppressions are gone (`getCurrentPageId`
  and `selectCellAt` are stable callbacks of the editor now).
- **R3 ✅ child pages split, serial queue** — `use-child-pages.ts` (642 lines, one 230-line
  effect, twelve refs) becomes:
  - `utils/serial-queue`: tasks strictly one after another; a failing task does not stop it.
  - `leveled/child-pages-steps`: the pure steps (deleted pages, arrived links, auto context of
    pure context pages, remembered copies, `callSync`, page ids).
  - `leveled/child-pages-orchestrator`: outside React, holds the session state; every step and
    every analyst action (Sync context, Insert as context, orphan decision) runs through the
    queue. A saved state that arrives during a running step is reconciled afterwards — once, the
    newest (fixes: the busy flag returned without rescheduling and the state was lost). Actions
    wait for their turn instead of polling 50 ms and failing with "busy" after 5 s. The DFD as
    opened is taken from the first saved state at once (the queue may skip to a newer one).
  - `useChildPages` (98 lines): binds it to React (`useSyncExternalStore`), hands over each saved
    state with the façade's parse.
- **R2 ✅ error codes, translated in the UI** — `models/leveled-errors`: union
  `LeveledActionError` (`NOT_AVAILABLE`, `NOT_POSSIBLE`, `DRAWIO_FAILED`, `NOTHING_COPIED`,
  `PAGE_NOT_DELETED`, `SAVE_FAILED`, `NO_REVIEW`, the adoption refusals and the
  `LinkEditRefusal` codes); the list derives from a `Record` over the union, so a new code
  without entry does not compile. Child pages, lost definitions, identity review and the cell
  identity return codes only; draw.io's technical messages go to the log. The five dialogs show
  `tabs.dfd.leveledErrors.<CODE>` (en/de, completeness test). The typing found three codes that
  had passed through as free text (`INVALID_DEFINITION`, `PAGE_NOT_PLACED`, `NO_PAGES` → now
  `NOT_AVAILABLE`). German texts of 6d aligned to the "Sie" form of the DFD texts.
- **R5 ✅ draw.io scripts in .js files** — the plugin (selection listener, page tabs, context
  copies, viewport), `syncPages` and `exportPageSvgs` moved from template strings in
  `electron/ipc/drawio-handlers.ts` (735 → 264 lines) to `electron/drawio-scripts/*.js`. Each file
  is one function expression; the handler imports it with `?raw` (Vite / Vitest natively,
  esbuild via the `raw-text` plugin in `scripts/build-electron.mjs`, `electron/types/raw-imports.d.ts`
  for tsc) and runs `(script)(<JSON literal>)` — the JSON-literal hand-over stays. The executed code
  is identical apart from the parameter (checked whitespace-insensitively). A test parses each
  script and runs it without draw.io's API. The small one-off scripts (select cell, context
  cells, page-tab info, scroll) stay inline.
- **Minor ✅ one group accordion** — `shared/components/group-accordions` (`GroupAccordions`):
  one accordion per group with label, count and hint, content rendered only while open, summary
  rows with an "open" link in one group, opening on request from outside. `ThreatGroupSections`,
  `RiskGroupSections` and `AssetGroupSections` only compute their groups, figures and texts
  (i18n stays in the features). The asset group of a "Show in table" request is derived on a new
  request only, via a ref instead of an `exhaustive-deps` suppression.
- **✅ confirm a definition moved down** (found with the SmokeDetector example: the definition of
  MP-3 had been moved to the *Sensor Head* page, so MP-3 became part of MP-1 and its threat and
  risk accordions disappeared under MP-1). `deeperHomeContainer` (identity-info) names the
  multiprocess whose page holds the selected copy when that page is deeper than the highest
  occurrence of the element (elements only). The façade passes `becomesPartOf` (labels of element
  and container) to `IdentitySection`, which asks with `ConfirmDialog` before "Make this the
  definition" and "Promote to definition"; cancel changes nothing. `BAL_HOME_NOT_HIGHEST` stays
  info.
- **Minor ✅ `noChildPage` typed** — `DFDElement.properties` now includes `MultiprocessProperties`
  (it already was in `ElementProperties`). The façade's `setNoChildPage` checks the element type and
  writes `MultiprocessProperties` without the `as unknown as` cast; the orchestrator narrows with
  `"noChildPage" in properties` instead of a structural cast.
- **Minor ✅ no `exhaustive-deps` suppression left from the leveled work** — the last four:
  the "Regenerate" confirmation computes its reconciliation once when it opens (state instead of a
  memo keyed on the dialog flag); the assets tab lifts the review filter once per "Show in table"
  request (request remembered in a ref); the paste assignment derives its proposals with a pure
  `proposalsOf(review)`; "Insert as context" resets when it opens by adjusting state during render
  (a save while it is open keeps the chosen category). The suppressions that remain in the code
  base predate the leveled DFD.
- **Process ✅ general fixes marked** — fixes on this branch that are not leveled-specific and
  belong on `main` as well (cherry-picked by hand; each is self-contained):

  | Fix | Branch | `main` |
  |-----|--------|--------|
  | Physical boundary (enclosure) threats from the physical templates | `8fd3e1c` | `0205520` |
  | One per-element table per physical boundary | `1c37730` | `0d408d0` |
  | Interface threats from the interface templates | `20ca0bb` | `aed33a3` |
  | Element no longer sticks to the pointer after a click | `aa1212c` | `057bcfb` |
  | Diagram opens at 100 % instead of a tiny fit | `0827daf` | `310b185` |
  | No false "mitigations changed" after reopening (`sameDrafts`) | `7018e7e` | `b06a151` |
  | Assets warning banner no longer covered by the DFD preview | `5530047` | `8a03a6f` |

  Not general despite the `fix` prefix: page-sync rejection (`75aada9`), multi-page layout refusal
  (`dd43982`, `9d7b362`), child page by button (`82875cd`), group toolbar (`89318c8`) — they fix
  leveled code.

**Phase 7 — Reporter.** One figure per page from the stored page thumbnails (§12.1; app and CLI),
consolidated element/threat tables, decomposition tree (became the element overview per page,
7b), flows analysed on parent level listed
explicitly.
- **7.0 ✅ same analysis in the CLI** (decided 2026-10-21): the project file stores records and
  pages, but which page shows which element, the parts of a multiprocess and the flows analysed on
  parent level are derived from `dfd.xml`, as in the app. The CLI runs under Node, which has no
  `DOMParser` / `XMLSerializer`; `@xmldom/xmldom` (^0.8.15, MIT, already in the tree via
  electron-builder, now a direct dependency, bundled by esbuild) provides both
  (`taraflow-reporter/cli/dom-parser-node.ts`, `installDomParser`, installed as a pair and only
  where no DOM exists). The parsers use DOM Level 2 Core only (`firstByTag`, `parentHasTag`
  instead of `querySelector` / `parentElement`, which xmldom 0.8 lacks). A parity test analyses
  the leveled SmokeDetector with the browser DOM and with xmldom and requires identical parse,
  tree, home pages, effective model, groups and parent-level flows; a Node-environment test runs
  the analysis without any browser DOM. So CLI and app reports are the same.
  Build warnings removed on the way (not leveled-specific): the duplicate key
  `treatmentJustificationRequired` in `de/risks.json` (the overridden first entry dropped, the
  shown text is unchanged); the CLI's `package.json` declares `"type": "module"` (the bundle is
  ESM) and is shipped next to it in the Debian package, so Node no longer warns
  `MODULE_TYPELESS_PACKAGE_JSON`.
- **7a/7b ✅ DFD chapter per page** (§12.1, item 4; reworked twice after first use, 2026-10-21 —
  first captioned figures one after another plus a decomposition tree, then the element overview
  split by page; the analyst wants each page as a unit). A leveled DFD's DFD chapter reads:
  title and intro → statistics → one section per page in page-tree order, each with the heading
  `Page "Sensor Head" (decomposes MP-1 Sensor Head)` / `Seite „Sensor Head“ (zerlegt MP-1 Sensor
  Head)`, the page's figure (root page falls back to `dfd.thumbnail`; a page without stored image
  says "open the project in TARAflow and save it once") and the table of the elements defined on
  that page (each element once, record order; records on no drawn cell close in "Not on any
  page"). The element descriptions chapter keeps its detailed sections but no longer repeats the
  overview. A classic project renders exactly as before (figure, statistics, one overview).
  - `reportPagesOf` (dfd; order and depth from the page tree, the page itself from the input —
    the analysis is cached per page structure, not per thumbnail; `defined` from the home pages),
    `dfdPageSectionsOf` (documentation), template placeholder `{{dfdPages}}` at the end of the DFD
    chapter, templates `dfdPageSection` / `dfdElementOverviewPageTable` per format (StrictDoc: a
    nested section per page), `formatDfdFigure` per format; pdfmake the same order. The browser PDF
    converts every page thumbnail to PNG (`createProjectWithPng`; a failing one is left out); the
    CLI PDF rasterises every SVG image as before.
- **7c ✅ flows analysed on parent level:** at the end of the DFD chapter (after the page sections)
  a section "Data flows analysed on a parent level" / "Auf Elternebene analysierte Datenflüsse":
  the note that their threats are provisional and refine when the flows are drawn on the child
  page, and a table flow / from / to / reason — the endpoints the flow is analysed with and the
  reason of the threats tab's banner (unresolved / ambiguous / dangling). Only when there are such
  flows. `dfdParentLevelFlowsOf` (documentation, on `parentLevelFlowsFrom`), templates
  `dfdParentLevelFlows` / `dfdParentLevelFlowRow` per format; pdfmake a table.
- **7d ✅ threat and risk tables grouped:** in both threat chapters and both risk chapters, one
  table per group as the app's accordions (D20) — "Top level" / "Oberste Ebene", one group per
  top-level decomposed multiprocess in page order, "Not in the DFD" / "Nicht im DFD" last; every
  item in exactly one group (the app's `multiprocessGroupsFrom` + `groupsOfDfdItem` decide), a
  risk follows its threat. `reportGroupsOf` (documentation), `formatReportGroup` per format (a
  heading one level below the chapter; StrictDoc a nested section); pdfmake the same. A classic
  DFD keeps one table per chapter. Checked against the leveled SmokeDetector: 229 per-element and
  214 per-interaction threats, the same split as the accordions.
  - The CLI no longer warns about multi-page DFDs: the report covers them (Phase 7 complete).
  - **Statistics** (2026-10-22, analyst; classic and leveled alike): below the intro of each
    threat chapter a table per element type (data flow, interface, physical boundary, process,
    …; a flow threat counts as data flow) with the threats per STRIDE category and a total row;
    below the intro of each risk chapter the same per risk level before mitigation (highest
    first, "Not rated" only when there are). Leveled: below each group heading one line,
    "44 threats — S 2 · T 13 · …" / "17 risks — Critical 15 · High 2". `threat-risk-stats`
    (documentation), `formatStatsTable` per format (StrictDoc: a section "Statistics" with a
    list-table, as a section holds one free text), `formatReportGroup(title, body, summary)`;
    pdfmake a small table and the summary line.
  - Found on the way, not leveled-specific, open: the StrictDoc "DFD element descriptions"
    chapter leaves one `[SECTION]` per element type unclosed (`closeInnerSections`; classic
    SmokeDetector 83 open / 75 closed).
  - The app's document preview converts Markdown / AsciiDoc / StrictDoc with its own small
    converters (`doc-preview-converters`), which knew neither nested lists nor figures: the then
    decomposition tree showed as raw "  - Seite …" lines, AsciiDoc captions as ".Seite …",
    StrictDoc figures were dropped. Now: Markdown lists nested by indentation, `&nbsp;` kept; AsciiDoc block title +
    `image::` → `<figure>` with caption, other block titles as caption lines, `{nbsp}`; StrictDoc
    `.. figure::` with alt and caption, the empty line block, blank-line separated lists nested
    by indentation (`nestedListWriter`). The written files were right; only the preview was off.

## 14. Testing

All fixtures are built from TARAflow's own example projects; no external or customer model is
used.

Identity and persistence
- Definitions and context copies stable across save/reload.
- Copy/paste between pages creates neither unintended identities nor merges (`ID_PASTE_REASSIGNED`).
- Delete definition, keep copy → `BAL_DANGLING_REF` → "Promote to definition" repair path.
- A compressed page is refused with a visible error, never read as empty.
- Migration 8 → 9 leaves the XML byte-identical; references preserved.
- Adoption of the leveled Smoke Detector **without** identity links: proposal groups `MP-1`,
  `MP-2`, `EE-1`, `SB`, … correctly, proposes *Sensor Module* → `MP-1`, *Controller Module* →
  `MP-2`; nothing merged before confirmation.
- Dangling definition: boundaries = union of copies + inherited, `fallbackReason: dangling`; a
  top-level dangling element never ends with an empty boundary set if copies lie in boundaries;
  its element threats stay **unchanged** in the reconciliation and carry the dangling marker.
- Containment parent: an EE first defined on a child page inherits **no** boundaries of the
  decomposed MP and is never "inside" for interface attribution; boundaries never inherit.
- Adoption: existing `tfId`s win over displayId grouping; objects without displayId stay
  singletons; the tie-breaker is shown in the proposal.
- Externally removed `tfId`: confirmation on save lists affected threats; re-attach option restores
  the old identity.
- "Decompose…" run twice → "Sync context", no duplicate occurrences.
- Fallback reasons: both sides with different problems → all reasons collected, most severe shown.

Graph and balancing
- Leveled Smoke Detector (§16): stitched endpoints, interface chain, inherited `PB`, expected
  findings (`DF-19` without `refines` → `BAL_MISSING_PARENT_FLOW`; none after adding `refines`;
  `DF-39` → `DFD_EE_TO_EE_FLOW`).
- Ambiguous endpoint (siblings) detected, fallback to the common ancestor — never an arbitrary pick.
- Interface chain: two-level decomposition yields outer and inner interface on the same side in
  order; an interface drawn again and crossed on a deeper page keeps its home-page level and
  appears once; duplicate occurrence on one page → `BAL_DUPLICATE_OCCURRENCE`; misplaced copy →
  `BAL_INTERFACE_UNATTRIBUTED`.
- Fallback reason priority (`ambiguous > dangling > unresolved`).
- Incompatible `refines`: flow analysed, `BAL_MISSING_PARENT_FLOW` evaluated as without `refines`.
- Multi-level decomposition with refinement chains.
- `refines` cycles, missing targets, incompatible endpoints, abstract without refinement.
- Boundary inheritance over several nesting levels; child-only boundaries.
- EE→EE flows and MP self-loops have the defined semantics.

Threats and risks
- Decomposition and its undo never transfer ratings; reconciliation categories correct (§10 table).
- Threat generation deterministic across page order and cell order.
- Interface and endpoint changes reflected as "reference changed".
- Moved definition with identical effective boundaries → reconciliation "unchanged" although the
  diff-service reports a semantic model change.
- Subtree roll-up reproducible, each threat counted once.

Numbering
- Root page `1..n`, child page of `MP-m` `m.1..m.n` per prefix without gaps, nested pages deeper;
  context copies show their definition's number and never consume one; dangling elements and
  unplaced pages in the root namespace; renumber idempotent; single page byte-identical to the
  classic numbering (D19, `unit/.../leveled/leveled-numbering`).

Diff and audit
- Graphical vs. semantic vs. structural changes distinguished (§11.3).
- Page deletion and definition moves produce traceable diffs.
- Same logical input → same effective graph after reload.
- Migration commit verifies with the AVE; historical blobs stay reproducible.

## 15. Decisions (locked 2026-10-13)

| # | Question | Decision | Consequence |
|---|---|---|---|
| D1 | Decomposable element types | **Multiprocess only** | `P-*` stays atomic; "Decompose…" is offered on MPs only; a child page always has an MP as `decomposes` |
| D2 | 1:n refinement of flows | **`refines` attribute** | Child flows over additional channels carry `refines`; a `refines` substitutes a parent-page occurrence for balancing (§6.4, §7) |
| D3 | Asset relations on decomposed MPs | **Derived, read-only roll-up** | Set of the descendants' relations with provenance; pre-decomposition relations kept as *pending* until covered (§9) |
| D4 | Unresolved flow endpoints | **Analyse on the parent level + info finding** | Effective flow falls back to the decomposed MP; state `fallback`; `BAL_UNRESOLVED_ENDPOINT` |
| D5 | Home page of shared EEs/boundaries | **Highest page** | Home page = page of the definition cell; TARAflow suggests moving it up (`BAL_HOME_NOT_HIGHEST`), never moves it automatically |
| D6 | Cross-project linking | **Separate convenience feature** | `multi-diagram-linking-design.md` stays independent |
| D7 | Flow occurrences | **Parsed from the XML, not persisted separately** | Logical record has no `from/to`; one source of truth per fact (§5.1) |
| D8 | Identity lifecycle | **Paste = new element; context copies only via explicit action (insert as context, assignment dialog); no automatic promotion** | Lazy identity links in `dfd.pages[].links`, XML stays plain draw.io (rev. 4.1, §5.2); lifecycle table §5.2 |
| D9 | Threat lifecycle | **Reconciliation with new / unchanged / reference changed / obsolete; ratings never transferred** | Generator key based on `tfId` (§10) |
| D10 | Error policy | **Block only on unreadable XML. Incomplete or ambiguous modelling never by itself excludes a flow — conservative fallback instead; intentional exclusions (`abstract`, EE→EE, `excludeFromThreatGen`) stay valid** | Banner for fallback flows; `fallbackReason` (§6.5, §7) |
| D11 | Interfaces of a stitched flow | **Ordered interface list per flow, attributed per side by the page's decomposition border** | Interfaces determined geometrically per occurrence and page; multi-level port chains supported; single-page = `side: none` (§6.2.1) |
| D12 | Analysis of dangling definitions | **Keep logical record; no home page; boundaries = union of all copies + inherited; flagged** | Conservative, never an empty boundary set by accident (§5.2.1) |
| D13 | Files that are already multi-page | **Adoption step with one confirmation dialog** (group by displayId+type, definition per D5, decomposition proposal) | Lazy identity alone would make every copy a definition; the dialog is shared with pasted copies (§11.2.1) |
| D14 | Boundary inheritance of interfaces | **Interfaces inherit physical and chip boundaries of their multiprocess, not its trust boundaries** (2026-10-15) | Interfaces relate to physical/chip boundaries; on a trust boundary they are the crossing point, not a zone member. Keeps the leveled Smoke Detector identical to the single-page model (§6.3) |
| D15 | Child page of a multiprocess | **Created automatically with the MP; the decomposition takes effect only with the page's first own part** (2026-10-16) | Navigation without an extra step, but an empty page never costs the MP its threats or turns its flows into fallbacks (§6.1, §12) |
| D16 | Tab name of a child page | **= name of the decomposed MP, one direction (MP → tab)** (2026-10-16) | One name to maintain; identity is the pageId (§5.3) |
| D17 | Name of the root page | **Always *Top*** — from the second page on, and for new projects from the start (2026-10-16) | Recognisable entry point; classic projects do not churn (§5.3) |
| D18 | Thumbnails of a leveled DFD | **One thumbnail per page in `dfd.pages[].thumbnail`; `dfd.thumbnail` = *Top*; the preview panel lets the user pick the page** (2026-10-17) | Preview and reports no longer depend on the tab active at save time; the reporter gets one figure per page without a headless draw.io; existing consumers unchanged (§12.1) |
| D19 | Numbering of a leveled DFD | **Hierarchical: root page `1..n`, child page of `MP-m` numbers its own definitions `m.1..m.n` per prefix; copies show their definition's number; no high-water mark** (2026-10-17) | IDs show where an element lives; a change on one page never shifts the numbers of another; renumbering *Top* cascades to the pages below; dotted IDs accepted everywhere (§8) |
| D20 | Tables of a leveled DFD | **Assets, threats and risks grouped in one accordion per top-level decomposed multiprocess plus "Top level"; a multiprocess shows only what lies entirely inside it, flows across groups are top level (every threat once) — per-interaction threats of such a flow on the side they attack (IN receiver, OUT sender; 2026-10-21); summary row per MP on the top level; assets of several groups under "Shared"; trust-boundary tables kept inside each group; risks follow their threats** (2026-10-19, flow rule revised the same day) | The subtree view of §10 as a layout; nothing is filtered away or doubled (Phase 6) |

## 16. End-to-end example: `DF-7 stream sensor data`

Leveled Smoke Detector (§3). Cell ids are illustrative; the fixture of Phase 2 fixes the real
ones. Four kinds of identifiers appear and are never mixed:

| Kind | Example | Meaning |
|---|---|---|
| `pageId` | `sen` | the page (draw.io `<diagram id>`) |
| `cellId` | `sen_mp2` | one graphical occurrence |
| `tfId` | `mp2` | the logical element (= cell id of its definition, lazy identity §5.2) |
| displayId | `MP-2` | the visible number, used only for display |

**0. Identity table**

| displayId | tfId | Definition (page / cell) | Context copies (page / cell) |
|---|---|---|---|
| MP-1 | `mp1` | `sys` / `mp1` | `ctl` / `ctl_mp1` |
| MP-2 | `mp2` | `sys` / `mp2` | `sen` / `sen_mp2` |
| P-2 | `sen_p2` | `sen` / `sen_p2` | – |
| P-5 | `ctl_p5` | `ctl` / `ctl_p5` | – |
| IF-1 | `sen_if1` | `sen` / `sen_if1` | – |
| IF-3 | `ctl_if3` | `ctl` / `ctl_if3` | – |
| DF-7 | `df7` | `sys` / `df7` | `sen` / `sen_df7`, `ctl` / `ctl_df7` |

Page tree: `sys` (root) · `sen` decomposes `mp1` · `ctl` decomposes `mp2`.

**1. XML (abbreviated)**

```xml
<!-- page sys (Top) — plain draw.io; identity comes from dfd.pages[].links (lazy, §5.2) -->
<object id="mp1" type="multiprocess" label="Sensor Module"/>
<object id="mp2" type="multiprocess" label="Controller Module"/>
<object id="df7" type="dataflow" label="stream sensor data [stream]">
  <mxCell edge="1" source="mp1" target="mp2"/>
</object>

<!-- page sen (Sensor Module) -->
<object id="sen_p2"  type="process" label="Sensor Communication Controller"/>
<object id="sen_if1" type="interface" label="RS485"/>               <!-- shape on the module border -->
<object id="sen_mp2" type="multiprocess" label="Controller Module"/>     <!-- linked: ref of mp2 -->
<object id="sen_df7" type="dataflow" label="stream sensor data [stream]"> <!-- linked: ref of df7 -->
  <mxCell edge="1" source="sen_p2" target="sen_mp2"/>               <!-- path crosses sen_if1 -->
</object>

<!-- page ctl (Controller Module) -->
<object id="ctl_mp1" type="multiprocess" label="Sensor Module"/>         <!-- linked: ref of mp1 -->
<object id="ctl_p5"  type="process" label="Alarm Processing Controller"/>
<object id="ctl_if3" type="interface" label="RS485"/>
<object id="ctl_df7" type="dataflow" label="stream sensor data [stream]"> <!-- linked: ref of df7 -->
  <mxCell edge="1" source="ctl_mp1" target="ctl_p5"/>               <!-- path crosses ctl_if3 -->
</object>
```

Identity links (`dfd.pages`, abbreviated):

```json
[
  { "pageId": "sys", "name": "Top", "order": 0 },
  { "pageId": "sen", "name": "Sensor Module", "decomposes": "mp1", "order": 0,
    "links": [ { "cellId": "sen_mp2", "tfId": "mp2", "role": "ref" },
               { "cellId": "sen_df7", "tfId": "df7", "role": "ref" } ] },
  { "pageId": "ctl", "name": "Controller Module", "decomposes": "mp2", "order": 1,
    "links": [ { "cellId": "ctl_mp1", "tfId": "mp1", "role": "ref" },
               { "cellId": "ctl_df7", "tfId": "df7", "role": "ref" } ] }
]
```

Note: `mxCell source/target` reference **cell ids** (draw.io's own wiring, page-local). The parser
resolves each to the `tfId` of the referenced cell on the same page: `sen_mp2 → mp2`,
`ctl_mp1 → mp1`. The interfaces of an occurrence come from geometry on its page (§6.2.1).

**2. Parsed occurrences of `df7`**

| pageId | cellId | role | sourceTfId | targetTfId | interfaces (geometric) |
|---|---|---|---|---|---|
| `sys` | `df7` | definition | `mp1` | `mp2` | – (*Top* has no interface shapes) |
| `sen` | `sen_df7` | ref | `sen_p2` | `mp2` | `[sen_if1]` |
| `ctl` | `ctl_df7` | ref | `mp1` | `ctl_p5` | `[ctl_if3]` |

One occurrence per page → no `BAL_DUPLICATE_OCCURRENCE`.

**3. Logical record** (persisted in `dfd.connections[]`):
`{ tfId: "df7", displayId: "DF-7", name: "stream sensor data [stream]", properties: {…} }` — no
endpoints, no interfaces.

**4. Stitching (§6.2)**

- source candidates `{mp1, sen_p2}` → chain (`sen_p2 ⊂ mp1`) → deepest `sen_p2`
- target candidates `{mp2, ctl_p5}` → chain (`ctl_p5 ⊂ mp2`) → deepest `ctl_p5`
- state `resolved`, no fallback reason

**5. Interface chain (§6.2.1)**

| Occurrence | Page decomposes | source inside? | target inside? | Entry |
|---|---|---|---|---|
| `sen_df7`, crosses `sen_if1` | `mp1` (MP-1), depth 1 | `sen_p2 ⊆ mp1` yes | `mp2 ⊆ mp1` no | `{tfId: sen_if1, side: source, level: 1}` |
| `ctl_df7`, crosses `ctl_if3` | `mp2` (MP-2), depth 1 | `mp1 ⊆ mp2` no | `ctl_p5 ⊆ mp2` yes | `{tfId: ctl_if3, side: target, level: 1}` |

**6. Effective boundaries (§6.3)** — boundary ids shown by displayId for brevity, they are `tfId`s too

- `sen_p2` (P-2): geometric on `sen` `{SB, SDS}` ∪ inherited from `mp1` on `sys` `{SB, PB}`
  = `{SB, SDS, PB}`
- `ctl_p5` (P-5): geometric on `ctl` `{CB, SDC}` ∪ inherited from `mp2` on `sys` `{CB, PB}`
  = `{CB, SDC, PB}`
- crossings: trust `SB → CB`, chip `SDS → SDC`; `PB` not crossed (both ends inside the case)

**7. Effective flow**

```ts
{
  tfId: "df7",
  from: "sen_p2",
  to: "ctl_p5",
  interfaces: [
    { tfId: "sen_if1", side: "source", level: 1 },
    { tfId: "ctl_if3", side: "target", level: 1 },
  ],
  state: "resolved",
}
```

→ `DFDConnectionReference` with `crossesTrustBoundary = true`, `crossesChipBoundary = true`,
`crossesPhysicalBoundary = false`.

**8. Threats**

The interaction generator produces the per-interaction STRIDE threats for `df7` once (displayed with
`DF-7`), with the crossing context `SB → CB` and both RS485 ends as attack surfaces (generator key
includes the interface `tfId`, §10). The interface-element threats of `sen_if1` (IF-1) and
`ctl_if3` (IF-3) are generated once each from their home pages. No per-element threats for `mp1` /
`mp2` (decomposed).

**9. Variant — *Controller Module* page not yet drawn**

Occurrences: only `df7` and `sen_df7`. Target candidates `{mp2}`; `mp2` is decomposed (its page
exists, but `df7` is not drawn on it) → `BAL_UNRESOLVED_ENDPOINT`, `state: fallback`,
`fallbackReason: unresolved`, `to = mp2`, interfaces = `[{sen_if1, source, 1}]`. Threats are generated
against `mp2` and marked provisional. Once `ctl_df7` is drawn, the next generation reports them as
**reference changed** (endpoint `mp2 → ctl_p5`, new interface entry `ctl_if3` → its interface-bound
threats are **new**) — ratings kept, marked for review.

**10. Variant — definition of P-2 deleted, a copy remains elsewhere**

Suppose `sen_p2` was also shown as a copy on a further page and the definition is deleted:
`BAL_DANGLING_REF`; `sen_p2` keeps its logical record, has no home page, its geometric boundaries are
the union over the remaining copies (§5.2.1) plus the inherited `{SB, PB}` from `mp1`; `df7` is
analysed with `state: fallback`, `fallbackReason: dangling`.
