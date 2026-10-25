# TARAflow — Asset graph: show Hazard Items, move nodes with Ctrl

**Status:** v2 · 2026-10-25 · decisions taken (§3), implementation on branch
`feature/asset-graph-hazards` · base: `main` after the hazard import
**Scope:** `features/dfd/asset-graph`, app layer (data passed to the DFD tab)
**Related:** `doc/Done/DFD/asset-graph-view-requirements.md` (FR-V1 … FR-V16, AR-10 … AR-12,
D3), `doc/Open/DFD/asset-graph-process-view-requirements.md` (FR-V11 there as COULD),
`doc/taraflow-safety-model.md`

---

## 1. Goal

1. **Make Hazard Items visible in the asset graph.** Today the graph shows only assets,
   A2A relations and element anchors. In the SmokeDetector example (5 Hazard Items,
   21 `contributes_to`, 10 `endangers`) one therefore sees neither the hazards nor which
   data, function and system assets contribute to them and whom they endanger. This
   chain (Data → Function → System → Hazard → Human) is the core of the safety model.
   This document concretises **FR-V11** and raises it from COULD to **MUST**.
2. **Move single nodes horizontally** (Ctrl or ⌘ + drag) so that overlapping nodes can be
   untangled by hand. Today every drag moves the whole view (pan).

## 2. Current state (checked against the code)

- `AssetGraphSource` (`asset-graph-types.ts`) has `assets`, `relations`, `elements` — no
  hazards. The DFD tab builds the source with `assetGraphSourceFromDfd` (`mirror-edges.ts`)
  from the DFD; `dfd-tab.tsx` has no access to `project.hazards`.
- The hazard types (`HazardItem`, `HazardRelation`, `HazardImpact`) live in
  `shared/models` — `features/dfd` may import them without touching `features/hazards`.
- Layout (`layout-asset-graph.ts`): vertical layers are horizontal lanes (data at the
  bottom … infrastructure at the top), anchors below, orthogonal layers in a side column
  (environment in the row of human). A stored position counts for vertical lanes only while
  `|y − laneY| ≤ LANE_HEIGHT/2`; for orthogonal lanes always.
- Positions are stored locally per project (FR-V15, `asset-graph-positions-store.ts`),
  never in the project file (D3, AR-10). Known positions are fixed (AR-12).
- Zoom/pan (`asset-graph-view.tsx` ~l. 386): the filter does not let a drag with
  **Ctrl** pressed through as a pan (`!e.ctrlKey || e.type === "wheel"`), so Ctrl + drag
  is free today. **⌘ (metaKey) is not filtered** — ⌘ + drag pans today.
- Checked 2026-10-25, further:
  - ISO 26262 S-classes exist only as a comment in `safety-types.ts` (table level → Se / S /
    EN 50742), no function; S0 comes with ISO plan Phase 1H.
  - The severity colours of the hazard table (`RANK_COLOR`) are local to
    `features/hazards`; `features/dfd` may not import that feature.
  - No way exists to open another tab with an item selected ("Open in Hazard tab").
  - The SmokeDetector figures (5 / 21 / 10) are those of the leveled example
    (`SmokeDetector-leveled.tara.json`), not of the committed fixture `SmokeDetector.tara.json`
    (70 / 1 / 101).

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| G1 | Where do Hazard Items sit in the layout? | Own lane **`hazards`** in the side column, directly **above `human`** (protection targets). `contributes_to` then runs from the left (vertical lanes) into the column, `endangers` a short way down to human/environment or back to infrastructure. |
| G2 | Editable in the graph? | **No, read-only** (as in FR-V11). Hazard Items and their edges are edited in the Hazard tab. Clicking a hazard node opens a read-only card with "Open in Hazard tab". |
| G3 | Show / hide | Toggle "Hazards" like "Anchors" (`showHazards`). Default: on in the **Protection targets** and **All** presets (user, 2026-10-25), off in the other presets; in the focus view on when the focus asset has hazard edges. |
| G4 | Moving: which direction? | **Horizontal only**, `y` stays the lane centre. The layer semantics are kept, and the stored position stays valid (lane rule from §2). |
| G5 | Key combination | **Ctrl + drag** (Windows/Linux) **or ⌘ + drag** (macOS). On macOS Ctrl + click is the right click, so ⌘ applies there. Both are accepted. |
| G6 | Is a move stored? | Like every position: locally per project (FR-V15), **never** in the project file (D3). No entry in the link undo history; "Rearrange" (FR-V12) resets. |
| G7 | Severity labels under `iso-21434` | **Canonical labels for now** ("Irreversible, major" …); the S-classes S0–S3 come with ISO plan Phase 1H, which defines them (user, 2026-10-25). FR-V11a's "S0–S3" moves there. |
| G8 | Severity colours | The hazard table's colours per severity move to `shared` and are used by both the hazard table and the graph — one source. |
| G9 | "Open in Hazard tab" | New wiring in the app layer: the DFD tab reports the hazard id; `workspace-layout` switches to the Hazard phase and hands the id to the Hazard tab, which opens its dialog for that item. |
| G10 | Test data | A trimmed fixture derived from the leveled SmokeDetector example (assets, Hazard Items, edges only) in `src/tests/fixtures/` (user). |

## 4. Requirements

### 4.1 Hazard Items in the graph

| ID | Requirement | Prio |
|---|---|---|
| FR-V11 | **Hazard Items in the graph** (concretised, now MUST): node kind `hazard` (id prefix `hz:`, never collides with asset or anchor ids), own shape (diamond or warning triangle), label `externalRef` or label. Colour by the worst person severity of its `endangers` edges (same colours as the hazard table). | MUST |
| FR-V11a | **Edges:** `contributes_to` (asset → hazard) dashed in warning colour, `relevance` (direct/indirect) as stroke width; `endangers` (hazard → protection target) solid in warning colour, severity as edge label (`common: safetySeverity.*`; S-classes under `iso-21434` follow with ISO Phase 1H, G7). Edges to assets in hidden layers appear as stubs (FR-V4). | MUST |
| FR-V11b | **Focus view:** Hazard Items count as neighbours. Depth 1 from an asset: the hazards it contributes to or that endanger it; depth 2: also the endangered or contributing assets. A hazard can itself be the focus. | MUST |
| FR-V11c | **Context bar** (FR-V14): counter "hazards visible / total"; toggle "Hazards". | MUST |
| FR-V11d | **Read-only card:** clicking shows label, description, category, cause assets, protection targets with severity, `systemRelevance`; action "Open in Hazard tab". In edit mode hazard nodes have no connection handles. | MUST |
| FR-V11e | Hazard Items **without** edges appear in the hazard lane with the notice "not linked" (same presentation as a finding, UX-4). | SHOULD |

**Data flow (AR-11 stays pure):** `AssetGraphSource` gets an optional
`hazards?: { items: readonly HazardItem[]; relations: readonly HazardRelation[] }` (types
from `shared`). The app layer (`workspace-layout.tsx`) passes `project.hazards` to the DFD
tab, as it does with the asset data today. `build-asset-graph.ts` derives nodes and edges
from it; without `hazards` everything behaves as today.

### 4.2 Moving nodes

| ID | Requirement | Prio |
|---|---|---|
| FR-V17 | **Move a node horizontally:** Ctrl + drag or ⌘ + drag on a node (asset, anchor, hazard) moves only that node along its lane; `y` stays fixed. Edges follow live. Works in view and edit mode. Without the key a drag stays a pan; a drag on a connection handle stays a connect. | MUST |
| FR-V17a | **Zoom filter:** the pan filter excludes `metaKey` as well as `ctrlKey` (except for wheel zoom), so that ⌘ + drag does not pan. | MUST |
| FR-V17b | **Feedback:** while the key is held over a node the cursor is `ew-resize`; during the drag the node stays highlighted. | SHOULD |
| FR-V17c | **Storage:** the new position is fixed (AR-12) and stored locally through the existing mechanism (FR-V15). No re-layout of other nodes. "Rearrange" also discards moved positions. | MUST |
| FR-V17d | **Side column:** orthogonal lanes and the hazard lane stay in the side column when moved (x is clamped to the column range), so they cannot be pushed into the vertical lanes. | SHOULD |
| FR-V17e | **Keyboard (NFR-4):** Ctrl/⌘ + Shift + ←/→ moves the focused node by `NODE_SPACING / 3`. | COULD |

**Implementation:** a pure function `moveNodeHorizontally(positions, id, dx, lane)` → new
positions (only the node's `x` changes, clamped per FR-V17d) in `layout-asset-graph.ts`;
the view calls it from the pointer handler and writes `positionsRef` as the layout does.
No change to `layoutAssetGraph`: nodes moved horizontally stay in their lane and thus count
as known positions.

## 5. Out of scope

- Creating Hazard Items or drawing hazard edges in the graph (stays in the Hazard tab).
- Free 2D moving (would break the lane semantics).
- Positions in the project file (D3 stays).
- Hazard relations in the audit diff (finding B8, separate item).

## 6. Implementation (each commit works on its own)

1. `fix(asset-graph): do not pan on Cmd-drag` — FR-V17a.
2. `feat(asset-graph): move single nodes horizontally with Ctrl/Cmd-drag` — FR-V17, b, c, d (+ e).
3. `feat(asset-graph): pass hazard items to the graph source` — app layer + optional `hazards` in `AssetGraphSource`, no rendering yet (no visible change).
4. `feat(asset-graph): show hazard items and their edges` — FR-V11, a, c, d, e, preset "Protection targets".
5. `feat(asset-graph): hazards as neighbours in the focus view` — FR-V11b.

## 7. Acceptance tests

| Req. | Test |
|---|---|
| FR-V11 | SmokeDetector fixture (G10), presets "Protection targets" and "All": 5 hazard nodes in the hazard lane, 10 `endangers` edges to HU-001/HU-002/IF-001 (or stubs), `contributes_to` from FU/DA/SY as edges or stubs depending on the visible layers. |
| FR-V11 | Project without Hazard Items: graph unchanged (golden comparison of the preparation). |
| FR-V11a | Edge label shows the canonical severity label (S-classes with ISO Phase 1H, G7). |
| FR-V11b | Focus on FU-001, depth 1: shows the hazards FU-001 contributes to; depth 2: also their protection targets. |
| FR-V11d | Edit mode: hazard node has no handles; "Open in Hazard tab" switches to the Hazard tab and selects the item. |
| FR-V17 | Ctrl + drag by 200 px: only the dragged node changes `x` by 200/k, `y` unchanged, all other positions unchanged. Without Ctrl: pan, no position change. |
| FR-V17a | ⌘ + drag on the canvas does not pan. |
| FR-V17c | After a move, hiding and showing a layer: position stays. After reopening the project: position stays (localStorage). "Rearrange": deterministic layout. Project file byte-identical. |
| FR-V17d | A human node cannot be pushed left into the vertical lanes. |

## 8. Implementation status

| Step | Content | Patch | State |
|---|---|---|---|
| 1 | FR-V17a: the zoom filter excludes ⌘ (metaKey) as well as Ctrl from panning (wheel zoom stays), and never pans during a node move. Steps 1 and 2 in one patch (same place). | 164 | done |
| 2 | FR-V17: Ctrl / ⌘ + drag on a node (asset or anchor) moves it along its lane — `moveNodeHorizontally` in `layout-asset-graph.ts` (x only, y the lane centre); the moved x overlays the layout while dragging; on release it becomes a known position (AR-12), is stored locally (FR-V15) and the layout is recomputed; the click that ends a move does not select; Esc cancels. b: cursor `ew-resize` while Ctrl / ⌘ is held, the moving node shows the focus ring. c: "Rearrange" discards moved positions. d: a side-column node stops one spacing left of the column. e: Ctrl / ⌘ + Shift + ←/→ moves the focused node by a third of the spacing. | 164 | done |
| 3 | Hazards in the graph source (app layer, G8 colours to shared) | – | open |
| 4 | FR-V11, a, c, d, e (+ G9 navigation) | – | open |
| 5 | FR-V11b | – | open |
