# TARAflow — Leveled DFDs (Multiple Diagrams per Project) — Design

Status: rev. 4.2 — decisions D1–D14 locked (§15) · Phase 0 done · Phase 1 done (identity, occurrences, adoption logic), Phase 2 next
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

**Page *System*** (root, `pageId sys`)

| Element | Notes |
|---|---|
| `MP-1 Sensor Module`, `MP-2 Controller Module` | multiprocesses, each decomposed on its own page |
| `EE-1 Debugger`, `EE-2 Fire Panel`, `EE-3 Maintenance Technician`, `EE-4 WiFi Gateway`, `EE-5 Update Server` | external entities |
| `SB Sensor Boundary` around `MP-1`, `CB Controller Boundary` around `MP-2` | trust boundaries |
| `PB Smoke Detector Case` around both | physical boundary — drawn **only** on *System* |

| Flow | Drawn on *System* |
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
   element defined on *System*, not a new element.
3. **Flows are split across pages ("half-refinement").** `DF-7 stream sensor data`:

   | Page | Source | Target | crossed interface |
   |---|---|---|---|
   | System | MP-1 | MP-2 | – |
   | Sensor Module | **P-2** Sensor Communication | MP-2 | IF-1 |
   | Controller Module | MP-1 | **P-5** Alarm Processing | IF-3 |

   Neither child page alone knows both real endpoints. Only the combination yields the effective
   flow `P-2 → P-5` leaving through `IF-1` and arriving through `IF-3` — the two ends of the RS485
   bus. **This is the core mechanism the tool must implement** ("endpoint stitching", §6.2).
4. **1:n refinement.** *System* shows one `DF-27 push alarm` to the fire panel. The *Controller
   Module* page shows it as `DF-27` (`P-6 → EE-2` via `IF-6 Alarm`, the data channel) **plus**
   `DF-19 push alarm relay` (`P-5 → EE-2` via `IF-5 Alarm Relay`, the potential-free contact). `DF-19`
   is an *additional* flow that refines `DF-27`; without a `refines` link a balancing check flags it
   as "boundary flow missing on the parent level" (§7, D2).
5. **Boundary membership is page-local but must be inherited.** `PB Smoke Detector Case` is drawn
   only on *System*; the parts on the child pages are still inside the case → membership is
   **inherited from the decomposed parent** (§6.3).
6. **Interfaces exist on the detail pages.** *System* has no `IF-*` shapes; ports appear when a
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
| **Paste** (draw.io copy/paste, duplicate page) | **Paste = new element.** A pasted cell has a new cell id and no link, thus a new identity. If two definitions end up with the same `tfId` (a duplicated page keeping its cell ids), the cell that was **not** in the last saved state gets a fresh `tfId` (a `definition` link) and a new displayId. Info finding `ID_PASTE_REASSIGNED`. Never merged. |
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

- Exactly **one root page** (`decomposes` absent).
- Only **multiprocesses** can be decomposed (D1). A multiprocess has at most one child page.
  Nesting is unlimited.
- A decomposed multiprocess must **not** appear on its own child page (on *Controller Module*,
  `MP-2` is replaced by its parts); it may appear as a context copy on sibling pages (`MP-2` on
  *Sensor Module*).
- Every element **defined** on a child page is a **descendant** of the decomposed multiprocess.
  This gives the containment tree: `MP-1 ⊃ {P-1…P-4, DS-1, DS-2, IF-1, IF-2}`.
- Navigation uses draw.io's native page link on the multiprocess cell
  (`link="data:page/id,<pageId>"`), so double-click/Ctrl-click opens the child page also in plain
  draw.io.

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
  exists; otherwise they have none.
- `a ⊆ M` ("a inside M") means: `a == M` or `M` is reached by following `containmentParent` from `a`.
  EEs and boundaries are never inside any MP.

### 5.4 Home page (D5)

The home page of an element **is** the page of its definition cell — persisted implicitly in the
XML, no separate field, no re-derivation on load.

- Elements created on a child page live there (`P-1…P-4`, `DS-1`, `IF-1`, `SDS` on *Sensor Module*).
- Elements used on several levels (EEs, cross-level boundaries) should be defined on the **highest
  page** they occur on. Formally: `depth(root) = 0`, `depth(child) = depth(parent page) + 1`;
  "highest" = minimal depth among the pages the element occurs on (`EE-1`, `SB` → *System*). If an
  element was first created on a child page and is later inserted as context on a higher page,
  TARAflow does **not** move the definition automatically; the info finding `BAL_HOME_NOT_HIGHEST`
  offers the action "Move definition here".
- Properties, asset relations and geometric boundary membership are read from the home page.

## 6. Effective model (what the threat generators see)

### 6.1 Leaves

The effective element set = all logical elements that are **not decomposed**. `MP-1` and `MP-2`
disappear and are replaced by their descendants; all EEs and any not-yet-decomposed multiprocess are
leaves. A decomposed multiprocess generates no own STRIDE-per-element threats — **except** as a
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
`MP-1` on *System*. Crossings of a stitched flow are computed from the resolved endpoints'
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
   drawn `MP-2 → EE-2` on *System* and resolves to `P-6 → EE-2`; `DF-19 P-5 → EE-2` is compatible
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

### 6.5 Flow analysis state

Each effective flow carries a computed state (not persisted):

| State | Meaning | Threat generation |
|---|---|---|
| `resolved` | both endpoints are leaves | normal |
| `fallback` | at least one endpoint could not be resolved to a confirmed leaf | normal, on the fallback endpoint; threat marked with the reason |
| `excluded` | `abstract`, EE→EE, or `excludeFromThreatGen` | none |

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
| `ID_ADOPTION_PENDING` | warning | File contains pages whose occurrences have not been adopted yet (§11.2.1) | – |
| `ID_PASTE_REASSIGNED` | info | A pasted definition received a fresh `tfId` (§5.2) | – |
| `DFD_EE_TO_EE_FLOW` | info | Flow between two external entities (out of analysis scope) | `DF-39` |

Page-tree findings (structural, computed by `buildPageTree` since 1.3, reported by the validator in
Phase 4): `PAGE_UNASSIGNED` (page in the XML but not in `dfd.pages`; with several pages this is
`ID_ADOPTION_PENDING`), `PAGE_MISSING`, `PAGE_NO_ROOT`, `PAGE_MULTIPLE_ROOTS`,
`PAGE_DECOMPOSES_UNKNOWN`, `PAGE_DECOMPOSES_NOT_MULTIPROCESS` (D1), `PAGE_DECOMPOSED_TWICE`,
`PAGE_PARENT_UNRESOLVED` (decomposed MP dangling or defined outside the tree), `PAGE_CYCLE`, plus
`BAL_DECOMPOSED_ON_OWN_PAGE` above. A page that cannot be placed keeps no depth and is never
attached somewhere silently; its content stays in the logical model (D10).

Note on `BAL_LABEL_DIVERGENCE`: the label is a property of the logical record. Editing the label of
any occurrence updates the logical record and all occurrences on save; divergence can only arise
from external editing and is repaired from the **logical record** (also when the definition is
missing).

## 8. Numbering

**One namespace per prefix per project**, across all pages. The ID belongs to the logical element,
not to the drawn cell.

- **New element:** next number from a **persisted high-water mark per prefix**
  (`autoNumberingConfig.nextNumber[prefix]`, monotonic). Deleted numbers are **not reused** until an
  explicit renumber — gaps are accepted; reuse would silently re-attach old commit messages, reports
  and external references to a different element.
- **Context copies** inherit the definition's displayId and never consume a number.
- **Invalid or manually typed IDs** (not matching `^(P|MP|DF|DS|EE|IF|…)-\d+$`) → finding; they get a
  regular number on the next renumber. Manually typed valid IDs raise the high-water mark if higher.
- **Renumber (explicit action only):** traverse pages in tree order (root, then child pages
  depth-first by `order`), sort definitions per page with the existing position strategy, assign
  per prefix from 1, reset the high-water mark. Context copies are updated from their definition.
  Threat display ids follow through the existing renumber path (threat identity is the UUID).
- Renumbering a single page in isolation is **not** offered — it cannot be done without gaps or
  collisions in a global namespace.
- `dfd-auto-numbering` therefore changes from "XML-global, positional" to "logical-model, page-aware,
  definitions only".

## 9. Assets (D3)

**One asset register per project** — unchanged. Assets are not diagram-scoped; a firmware image or
a credential is the same asset regardless of which page shows its holder.

Element→asset relations stay on `dfd.elements[].assetRelations`, keyed by `tfId`:

- **Leaf elements:** relations are edited as today.
- **Decomposed multiprocess:** its relations are a **derived, read-only roll-up**: the **set** of
  distinct `(assetId, relationType)` pairs held by its descendants (deduplicated, not summed).
  Displayed with provenance ("via P-4, DS-2").
- **Pending relations:** relations an MP held *before* it was decomposed are kept on the MP with
  `pending: true` and shown separately ("not yet assigned to a part").
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
- The risk matrix gains an optional roll-up per decomposed multiprocess (max / count per risk level
  of its subtree, each threat counted once). Pure view, no stored data.
- Attack trees anchor on assets (unchanged) and may reference leaf elements on any page.

**Lifecycle.** Threat identity (UUID), threat generation and risk rating are kept separate. Every
re-generation produces a reconciliation result with four categories, shown before it is applied:

| Category | Meaning | Effect on risk rating |
|---|---|---|
| **new** | no existing threat with the same generator key | unrated |
| **unchanged** | same generator key, same resolved references | kept |
| **reference changed** | same generator key, but a resolved endpoint/interface changed | kept but flagged **"review"**; never silently confirmed |
| **obsolete** | existing threat without a generated counterpart | becomes orphan (existing orphan handling) |

Generator key = (element or flow `tfId`, STRIDE category, template id, interface `tfId` for
interface-bound flow threats). Because the key contains the logical `tfId`, not the resolved
endpoint, a flow whose endpoint moves from fallback `MP-2` to `P-5` keeps its threats as
**reference changed**.

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
  `<mxGraphModel>`) and initialises the numbering high-water marks. Both are additive.
- **Decided in 1.3:** `dfd.pages` stays **optional and absent** for classic projects (no churn, no
  bump for it). The schema is bumped to 9 only when the Phase 0 guard is lifted (Phase 2/5), as a
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

- **Page tree** in the DFD tab's left area: root page + child pages, badge with finding count.
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
    new displayId lives in the id label in the XML and needs the high-water mark, so applying the
    decision **lands in Phase 3**.
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
    analyst's decisions (reject a group, another definition, another or no decomposition) and writes
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
Gate: golden test on the leveled Smoke Detector fixture (§3, §16) + ambiguity/self-loop/EE→EE cases.
The fixture is built from the single-page `SmokeDetector` example; its threats for elements and
flows that are unchanged by the leveling must equal the single-page result.
A generated three-page version exists (System with MP-1 *Sensor Head* and MP-2 *Smoke Detector
Controller*; *Sensor Head*; *Controller*; all original cell ids kept, copies linked in
`dfd.pages`). Checked against the single-page original with the current parser and graph builder:
same 36 elements + 2 MPs and 41 flows, no dangling copies, stitched endpoints and the union of
crossed interfaces identical for every flow, trust/chip/physical membership identical for every
element under the interface rule of §6.3; adoption (1.5) of the same file without links proposes
exactly its links and decomposition.

**Phase 3 — Numbering.** High-water mark, definition-only, global namespace; explicit renumber in
tree order. Also applies the duplicate-definition decision of 1.3 (fresh `tfId` link + new
displayId on save, `ID_PASTE_REASSIGNED`).

**Phase 4 — Validator.** Findings from §7; `refines` and `abstract` in the connection form; error
policy (§7).

**Phase 5 — UI.** Page tree, decompose action, context-copy styling and actions; the adoption /
assignment dialog on top of the 1.5 logic (one dialog, two entry points: `ID_ADOPTION_PENDING` and
the paste hint).

**Phase 6 — Assets & threat/risk lifecycle.** Roll-up with provenance, pending relations, undo
decomposition, reconciliation dialog (§10), page/subtree/state filters, risk roll-up.

**Phase 7 — Reporter.** One figure per page, consolidated element/threat tables, decomposition tree,
flows analysed on parent level listed explicitly.

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
- New element on a child page gets the high-water mark; deleted numbers not reused; context copies
  never consume a number; renumber idempotent.

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
<!-- page sys (System) — plain draw.io; identity comes from dfd.pages[].links (lazy, §5.2) -->
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
  { "pageId": "sys", "name": "System", "order": 0 },
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
| `sys` | `df7` | definition | `mp1` | `mp2` | – (*System* has no interface shapes) |
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
