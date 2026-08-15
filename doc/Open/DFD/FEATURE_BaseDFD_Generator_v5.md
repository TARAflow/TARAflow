# Feature Design: Base DFD Generator

**Status:** Draft v5
**Author:** Juergen
**Scope:** TARAflow — DFD generation from a configurable building-block catalog (DFD-tab)
**Related:** `dfd-graph-builder.ts`, asset relationship model, bidirectional DFD-Asset sync,
Rauchmelder reference (v2)

**Changelog v4 → v5 (the six open questions resolved):**
- **CIANAAA / protection-goal assignment removed from generator scope.** The generator lives in
  the **DFD-tab** and only sets an asset's DFD-level parameters; protection-goal assessment is a
  later **asset-tab** phase, out of scope (§1, §2, §3, §11, §12, §14).
- **Review-state granularity = per-element.** Any DFD-level parameter change or new relationship
  flips the whole asset to `adapted` (§6.1).
- **Cloud block resolved:** always direct-to-internet, **no transport trust boundary**; flows are
  created but connected **only on the cloud side**, the device-side ends are left **open** for the
  analyst (§3.3, §5.2).
- **Placement default = `right`** (§4, §5.2).
- **Asset-only view = review-only for v1**; authoring of assets/relationships stays in DFD mode (§9).
- **Batch dissolution refined (post-v5 review):** a single edit no longer dissolves the batch.
  "Discard all" stays available while the batch has any `pending` member; its blast-radius
  confirmation surfaces how many `adapted` (analyst-edited) members it would also delete. The
  batch dissolves only on **Accept all**, **Discard all**, or when **no `pending` member remains**
  (§7.1–§7.3, §13).
- **Persistence & backward compatibility** added: new persisted fields are optional with safe
  absence semantics, so pre-alpha projects load without migration (§7.5).

---

## 1. Motivation

Embedded products follow a recurring archetype: one or more **data input ports** acquire
measurement data, the data is **transformed** and **forwarded**, and a set of cross-cutting
processes (config, update, persistence, logging, cloud connectivity) surrounds the core path.

The Base DFD Generator exploits this regularity. Instead of starting from an empty canvas,
the analyst configures a small set of **building blocks** and the generator produces a
**complete DFD** — data and function assets, processes, data stores, external entities,
interactions, and the typed asset relationships between them.

The generated DFD is a **starting basis**. The analyst then extends, adapts, or removes
elements. The generator owns the boilerplate; the analyst owns the system-specific judgement.

A second use case falls out for free: because blocks are self-contained, a user can
**augment an existing DFD** by instantiating additional blocks (e.g. adding cloud
connectivity to a system that previously had none).

> **Scope note:** the generator operates entirely in the **DFD-tab**. It creates assets with
> their DFD-level parameters and relationships. Protection goals (CIANAAA) are **not** set here —
> they are assigned later during asset impact assessment in the **asset-tab**.

---

## 2. Goals / Non-Goals

### Goals
- Produce a **complete, valid DFD** from a block configuration, ready for analyst editing.
- Provide an **extensible catalog** of building blocks. Adding a block must not require
  touching the generator core.
- Treat **assets — data and function — as first-class**: blocks are defined around the assets
  they introduce, with supporting topology.
- Instantiate assets with their **DFD-level parameters** per the block template.
- Generate **typed asset-to-asset relationships** consistent with the existing relation model.
- Track a per-asset **review state** so the analyst can see untouched template output vs.
  confirmed vs. adapted, and confirm or discard a generation.
- Support both **fresh-project generation** and **augmenting an existing system**, where augment
  is purely additive.
- Load **pre-alpha projects** that predate these fields without any migration step (§7.5).

### Non-Goals
- **No CIANAAA / protection-goal assignment** — that is an asset-tab phase, not the generator's.
- No automatic threat generation — that remains the downstream threat generator's job.
- No "AI guesses your architecture" inference. Block selection is explicit and analyst-driven.
- No exotic / one-off architectures. Blocks cover the common archetype; the rest is manual.
- No aggressive auto-wiring in augment mode — connecting flows is partly left to the analyst (§5).
- **No mutation of existing elements in augment mode** — no boundary resizing, re-parenting, or
  rewiring (§5.2).
- **No regeneration / re-sync of an already-inserted block** — by design (§6.4).
- **No semantic merging of assets across blocks** — by design (§3.5).

---

## 3. Building-Block Catalog

### 3.1 Core invariant (read first)

> **A block is a generation-time stamp, not a persistent component.**
> It carries **no domain logic** and **no persistent identity**. It exists only to emit graph
> artifacts; once stamped, those artifacts are ordinary members of the graph, which is the
> single source of truth. Anything that smells like domain semantics (`securityAssumptions`,
> `threatHints`, `trustModel`, semantic asset merging, …) does **not** belong in a block — it
> must map onto existing asset properties, or be an analyst decision. If a desired feature
> cannot be expressed that way, that is a signal to extend the **asset model**, never to grow
> the block into a second metamodel.

This is the single most important constraint in the design. The long-term risk is not the
generator; it is the block catalog silently accreting into a parallel domain model.

### 3.2 Asset-first block definition (data and function)

A block is defined **around the assets it introduces** — not around processes. The point is not
that everything derives from data, but that **assets — the things a TARA actually protects — are
modeled explicitly rather than left implicit behind processes**. Both kinds are first-class:

- **Data assets** (Measurement Data, Processed Data, Config Data, Firmware Image, Logs).
- **Function assets** (Authentication, Authorization, Diagnostics, the Update process itself) —
  equally first-class; they do not "derive from data", they co-exist with it.

Processes, stores, external entities, and interactions are the **supporting topology** around
those assets. The block sets each asset's **DFD-level parameters** only — never protection goals.

```ts
interface BuildingBlock {
  id: BlockId;                            // stable catalog key (data only)
  label: string;                          // i18n key, not literal text
  params?: BlockParamSchema;              // e.g. number of input ports, cloud direct/gateway, ...

  // Assets the block introduces (both kinds are first-class)
  dataAssets: BlockDataAsset[];           // with their DFD-level parameters (NOT CIANAAA)
  functionAssets: BlockFunctionAsset[];   // may be empty for a purely data block

  // Supporting topology
  nodes: BlockNodeTemplate[];             // processes / stores / external entities
  interactions: BlockInteractionTemplate[];
  relationships: BlockRelationTemplate[]; // typed asset-to-asset (existing relation types only)

  preferredBoundaryAffinity: BoundarySpec; // PREFERENCE for the KIND of new boundary (§5)
}
```

No version field: the catalog is source code, versioned by git. A `catalogVersion` on the
definition would be consumed by nobody (there is no instance→block link, §6.4) and would be a
latent temptation to reintroduce the excluded regeneration back-link. Deliberately omitted.

### 3.3 Initial catalog

| Block | Primary asset(s) | Kind | Supporting topology | Notes |
|-------|------------------|------|---------------------|-------|
| **Data Acquisition** | Measurement Data | data | `N` input ports + ingress interface(s) + measurement store | `N` configurable. |
| **Processing / Transformation** | Processed Data | data | Transform process + optional intermediate store | Consumes measurement, produces processed. |
| **Output / Forwarding** | (forwards Processed Data) | — | Egress interface(s) + downstream ext. entity | Off-device forwarding. |
| **Config** | Config Data | data | Config process + config store + config interface | Inbound configuration. |
| **Update** | Firmware Image (data) + Update capability (function) | data + function | Update process + image store + trust-anchor node | — |
| **Persistence** | (persisted state) | data | Persistence process + persistent store | Survives reboot. |
| **Logging** | Logs | data | Log process + log store | — |
| **Auth** | Authentication / Authorization | function | Auth process + credential store | Function assets. |
| **Diagnostics** | Diagnostics capability | function | Diagnostics process + interface | Function asset. |
| **Cloud Connectivity** | (transports Processed Data) | — | Cloud-egress process + cloud interface | Always direct-to-internet; **no transport TB**; device-side flow ends left **open** (§5.2). |

Adding a block = adding one definition object. The generator core iterates the catalog; it has
no per-block branching.

### 3.4 Inter-block wiring

Blocks expose **named ports** (logical connection points, e.g. `measurementData.out`,
`processedData.in`). The generator wires blocks by matching exposed ports, so the catalog stays
composable and a block can be added or omitted without rewiring the others.

### 3.5 Block composition: no semantic merging

Selecting several blocks raises an obvious question: if Logging and Persistence both want a
store, do they share it? When are assets merged? The answer is **forced by §3.1**, not chosen
for convenience: deciding that two separately-created stores are "really the same" is domain
reasoning — exactly what a block must not contain. Therefore:

- The generator performs **no semantic merging**. Each block emits its own artifacts.
- Two blocks that could plausibly share a store **produce two stores**; consolidation is an
  **analyst decision** — a manual merge in the asset-only view (keep one, rewire its
  relationships, cascade-delete the other, §8).
- The **only** cross-block sharing is explicit **named-port wiring** declared by the catalog
  author at design time (§3.4): a block can be authored to *consume another block's exposed
  port* instead of creating a duplicate. That is a mechanical, design-time match — never a
  runtime semantic judgment.

This makes "why did the generator create two Log Stores?" a question with a deliberate answer:
because two blocks created them and you have not consolidated them yet.

---

## 4. Configuration Model

```ts
interface GeneratorConfig {
  blocks: SelectedBlock[];           // which blocks, in what quantity
  mode: 'fresh' | 'augment';         // new DFD vs. add to existing
  boundaryTarget?: BoundaryTarget;   // augment mode: own new TB, or none (NEVER existing)
  placement?: Placement;             // augment mode: where the new block lands (default 'right')
}

interface SelectedBlock {
  blockId: BlockId;
  params: Record<string, unknown>;       // e.g. { inputPorts: 3 }, { cloudTransport: 'direct' }
  boundaryOverride?: BoundarySpec;        // overrides preferredBoundaryAffinity (kind of new TB)
}

type BoundaryTarget =
  | { kind: 'new' }      // block gets its own new trust boundary
  | { kind: 'none' };    // block created without a trust boundary

type Placement = 'top' | 'bottom' | 'left' | 'right';  // relative to existing diagram; default 'right'
```

Note what is **absent**: there is no `{ kind: 'existing' }`. The generator never inserts into,
nor enlarges, a pre-existing boundary (§5.2).

---

## 5. Two Generation Modes

Both modes share asset/node/relationship creation but differ fundamentally in **boundary
resolution** and **wiring**.

### 5.1 Fresh Start (primary mode)

The generator owns the whole canvas. Boundaries are **created** from the block definitions,
inter-block wiring is **deterministic** (the catalog knows every exposed port), there is no
pre-existing graph to stay consistent with. The generator emits the full DFD and is done.
`placement` and `boundaryTarget` do not apply — there is nothing to place relative to.

### 5.2 Augment (extend an existing system) — purely additive

> **Invariant: in augment mode the generator is purely additive.** It creates new artifacts in a
> chosen region and **never mutates pre-existing elements** — no boundary resize, no re-parenting,
> no rewiring. Integration is the analyst's job.

1. **Own boundary, or none — never an existing one.** The block is created with **its own new
   trust boundary** (`boundaryTarget: new`) or **without a TB** (`boundaryTarget: none`). The
   generator does **not** insert the block into an existing TB and does **not** enlarge any
   existing TB. (Automatic enlargement was considered and rejected: it couples the new block to
   existing structure immediately, undermines clean discard (§7), and reopens the
   Interface/ChipBoundary grouping-geometry bug class.)

2. **Placement is analyst-chosen, default `right`.** `placement` puts the new block
   **top / bottom / left / right** of the existing diagram (default `right`). The generator
   computes the existing diagram's bounding box and offsets the new region to that side with a
   margin, so nothing overlaps.

3. **Boundary is a preference for the *kind* of new boundary.** `preferredBoundaryAffinity` (and
   `boundaryOverride`) describe what kind of new boundary to create; they never mean "merge into
   an existing one". Deployment-topology variation belongs in `params`, not in fixed structure.

4. **Wiring — deliberately minimal; new flows are open on the existing-system side.** The
   generator does **not** auto-connect new blocks to the existing graph. Remaining data flows are
   **left for the analyst to draw**.

   **Cloud block is the canonical example:** it is always **direct-to-internet** with **no
   transport trust boundary**. Its data flows to/from the cloud are created and connected **only
   on the cloud side** (to the cloud-egress process / cloud interface); the **device-side ends are
   left open**, and the analyst connects them to the existing system. Those open ends *are* the
   unconnected-port diagnostic (next point) in action, and they keep the block a clean isolated
   component (§7.4).

5. **Unconnected-port diagnostic (a lint, not a review state).** Open exposed ports (e.g.
   "Cloud block: 2 unconnected ports") are surfaced as a **non-blocking diagnostic**, *separate*
   from the review-state machine (§6) — it must not become a fourth state.

6. **Identity — no collision risk.** Element identity is the draw.io **UUID**, not the display
   label (`DF-1`, `P-2`, …). A second Logging block cannot overwrite an existing log store.

7. **Manual integration is normal editing.** If the analyst wants the new block inside an existing
   TB, he **resizes that TB himself and drags the block in** — standard draw.io editing, explicitly
   outside the generator's scope.

---

## 6. Asset Review State

The generator does exactly what an analyst does: create an asset, parametrise it (DFD-level), set
up its relationships. The only thing the analyst additionally needs is to **review and confirm**
generated output. So provenance is a simple **review state**, not an ownership hierarchy.

### 6.1 States (per asset) — granularity is per-element

- **`pending`** — created by the generator, untouched and unreviewed.
- **`confirmed`** — the analyst explicitly accepted it unchanged.
- **`adapted`** — the analyst changed **any DFD-level parameter** or **added any relationship**;
  the edit *is* the confirmation, so the **whole asset** transitions out of `pending`.

Granularity is **per-element**, not per-property: touching one parameter flips the whole asset.
(Per-property tracking was rejected as over-modeling — at the DFD stage assets have only a few
parameters and no protection-goal values; CIANAAA is assigned later, in the asset-tab.)

`reviewState` is a **persisted, optional** field — see §7.5 for absence semantics on pre-alpha
projects. Manually created assets do not carry it (owned from birth, ≈ `adapted`). Deletion
removes the asset entirely; there is no separate "rejected" state.

### 6.2 "What happens if the analyst doesn't agree?"

Disagreement is not one action — it decomposes into three existing operations:
- **Doesn't belong** → delete it.
- **Right but parameters/relationship wrong** → edit it (→ `adapted`).
- **Right but not ready to commit** → leave it (`pending`, visually flagged).

There is **no dedicated "reject" verb**.

### 6.3 Relationships: bulk + visual, not per-edge mandatory

Per-asset review state makes sense. Per-relationship review **must not** be mandatory: a typical
DFD has far more relationships than assets, and most are mechanical (`processed-by`, `stored-in`,
`forwarded-to`). But relationships are **exactly the high-risk area** (§10) — most likely
generated wrong — so they stay reviewable, just not via per-edge confirmation:
- **Default: bulk-confirm** relationships alongside their assets.
- **Visual surfacing** in the asset-only view (§9) makes a wrong edge obvious at a glance.
- Editing or deleting a single relationship is the only per-edge interaction; it marks that edge
  `adapted`.

> Note: relationships **inherit-from-endpoints** was rejected — it would auto-confirm a wrong
> edge between two correct, confirmed assets, defeating review exactly where it matters most.

### 6.4 No regeneration — by design

There is **no back-link** from a generated instance to its block definition, hence **no "update
the block from 2 to 4 ports later"** operation. This is deliberate:
- The block is a stamp (§3.1); after stamping only the graph exists.
- "I now need 4 ports" is handled the normal way: the analyst **edits** two more in, or
  **re-stamps** via augment — because the generator does exactly what an analyst does.
- Retroactive migration into an analyst-edited model would be **dangerous** (could overwrite
  deliberate decisions). Omitting it is simpler **and** safer.

### 6.5 `pending` blocks nothing

`pending` is purely informational. The generated DFD exists in full and is immediately usable;
review is an overlay, not a gate. At most a **soft warning** ("N assets still pending") on entry
to the threat phase — never a block.

---

## 7. Generation Lifecycle: Accept / Discard a whole generation

### 7.1 Transient generation batch

At generation time, all artifacts of one run are tagged with a **`generationBatchId`** — an
**opaque grouping label only**: a set of member element-UUIDs with **no reference whatsoever** to
the block, recipe, or version that produced them. By construction it cannot enable regeneration
(no back-link) and cannot overwrite analyst decisions; the only operations keyed on it are
"highlight as batch" and "discard batch".

It is conceptually **transient** (it retires once the generation has been reviewed — §7.2), but
it is **persisted** so that whole-block discard survives save/reload (§7.2, §7.3). "Transient"
refers to its lifecycle, not its storage. Storage form: a field on each member element (lives and
dies with the element, simplest to keep in sync with deletion).

> **Do not derive batch membership from draw.io XML id ordering or document position.**
> IDs are UUIDs (random — no temporal order), and document order is perturbed by re-serialization
> and z-order changes. "What was just generated" is recorded **explicitly** by the batch tag.

### 7.2 Flow

1. Generate → full DFD + batch `B`, all members `pending`.
2. A review affordance offers **Accept all** and **Discard all**, plus per-item actions (§9.3).
3. The analyst reviews, primarily in the asset-only view.
4. Editing a member marks **that asset** `adapted` (§6.1); it does **not** dissolve the batch.
   The other members stay `pending`, and the batch stays a valid grouping ("these were generated
   together" remains true regardless of one edit).
5. Batch exits (terminal) — the batch dissolves and its tag is cleared on any of:
   - **Accept all** *(explicit button)* → all remaining `pending` → `confirmed`.
   - **Discard all** → unified cascade-delete (§8) of the whole batch (see §7.3 for the
     confirmation when `adapted` members are present).
   - **No `pending` member remains** → everything has been individually confirmed, adapted, or
     deleted; the "fresh, unreviewed generation" concept is over, so the batch-level affordance
     retires. Individual elements remain editable/deletable as normal.

### 7.3 Lifetime of "Discard all" — by state, not by clock, and not killed by one edit

"Discard all" is available **as long as the batch has at least one `pending` member**. A single
edit does **not** withdraw it — that would let a typo fix in 1 of 100 assets silently kill the
escape hatch for the other 99 untouched ones (architecturally tidy, but a genuine UX trap).
Instead, when the batch contains `adapted` members, "Discard all" reuses the existing
**blast-radius confirmation** (§8): *"This removes 100 elements, including 1 you edited."* The
analyst decides with full information — the same way every other cross-category deletion works.

**No wall-clock timer** — the boundary is semantic (does a reviewable, still-partly-`pending`
generation exist?). Because the tag is persisted, this works even after closing and reopening the
project. The deliberate consequence: the surprising "one edit irreversibly disables Discard all"
moment **does not exist** — it was designed out rather than papered over with a warning dialog.

### 7.4 Connected-component check (validation only) — reinforced by additive augment

Because augment mode is purely additive and places a block in **its own new TB / its own region**
with **open device-side flow ends** (§5.2), a freshly generated block stays a topologically
**isolated connected component** until the analyst deliberately wires it in. This keeps both the
whole-batch discard and a connected-component sanity check clean for longer.

The connected-component check remains **validation only** ("the cluster you are discarding is
indeed isolated"), not the identification mechanism: it is a topological proxy, breaks the instant
the analyst draws a connecting flow, and cannot distinguish a block-origin island from a stray
manual one. **The batch tag remains the source of truth.**

### 7.5 Persistence & backward compatibility (pre-alpha projects)

TARAflow has already shipped a pre-alpha; projects exist that predate `reviewState` and
`generationBatchId`. The rule: **every new persisted field is optional, and its absence has an
explicit, safe meaning — no project ever requires a migration step to load.**

- **Absent `reviewState`** → treat as **owned** (≈ `adapted`); the element is **never** shown as
  `pending`. Pre-existing elements were authored by the analyst, not generated, so "unreviewed
  generated output" would be the wrong interpretation.
- **Absent `generationBatchId`** → the element belongs to **no batch**; no whole-block-discard
  affordance applies — exactly like any manually-created element.

Net effect: elements from pre-alpha projects behave precisely like manually-authored elements,
which is what they are from the generator's perspective. No backfill, no version gate.

*Forward note:* an older app version opening a newer project simply ignores the unknown fields
(losing batch-discard, not corrupting data). Keep additive-optional as the standing convention for
all new persisted fields.

---

## 8. Unified Cascade-Delete (one path, three entry points)

Deleting a block's three artifact categories (DFD elements, assets, relationships) is **one
mechanism** — referentially-correct cascade delete, driven by the existing bidirectional
DFD-Asset sync — reached from three entry points:

1. **Whole-batch discard** (§7) — batch tag supplies the selection.
2. **Single-element delete** — cascade-aware with a **blast-radius confirmation**
   ("Deleting this also removes: 1 asset, 3 relationships").
3. **Multi-select bulk delete** — for fast cleanup, in both the DFD canvas and the asset-only view.

Cascade rules:
- Delete asset → its relationships go (a relationship cannot exist without an endpoint).
- Delete DFD element → its bound asset goes **only if** bound solely to this element; if shared,
  the asset stays.
- Every cross-category cascade shows the blast-radius confirmation before acting.

This is **not** a stateful "delete mode"; deletion is *inherently* cascade-aware, plus multi-select
for bulk. The code is written once; all three entries call it. Consolidating duplicate stores from
§3.5 uses exactly this path.

---

## 9. Asset-only Graph View (review surface) — review-only for v1

Review happens on the layer that matters for the TARA: **assets and their typed relationships** —
not the draw.io topology. Rationale: for many users the **DFD is a drawing surface**, whereas the
**asset graph is the security model**. This view is plausibly the eventual primary review screen
(a direction, not a v1 commitment).

### 9.1 Scope: review-only (v1)

For v1 the view is a **review lens, not a second editor**. The analyst can look, confirm, discard,
delete, and open an asset to edit its existing DFD-level values — but **creating new assets and
drawing new relationships stays in the DFD-tab** (normal editing happens in DFD mode). Rationale:
full editing here would force the question "may an asset exist without a DFD element?", reopening
the bidirectional-sync invariants. Review-only keeps those closed and is also the cheap experiment
that tells us whether analysts even want to author at the asset level before we build it.

### 9.2 Visual encoding
- Distinct styling per review state (`pending` / `confirmed` / `adapted`) for nodes and edges.
- Highlight freshly generated (`generationBatchId`) clusters for whole-batch Accept/Discard (§7).
- Surface the pending count (soft warning, §6.5) and unconnected-port diagnostics (§5.2.5).
- Make duplicate stores/assets from independent blocks visible (§3.5) so the analyst can consolidate.

### 9.3 Interactions
- **Accept all** / **Discard all** — batch-level (§7.2).
- **Confirm** — single or bulk; `pending` → `confirmed`, no change.
- **Edit** — opens existing asset parametrisation (DFD-level); on save → `adapted`.
- **Delete** — unified cascade-delete (§8).
- **Leave** — stays `pending`.

---

## 10. Relationship & Boundary Generation (highest-risk area)

The nodes are the easy part. Value and failure risk are in:

1. **Typed asset-to-asset relationships** — must use the existing relation discriminated-union
   types; the generator must not invent new relation kinds.
2. **Boundary placement** — block definitions declare `preferredBoundaryAffinity` (the *kind* of
   new boundary) **explicitly**; no inferred grouping (what the Interface/ChipBoundary grouping
   fixes in `dfd-graph-builder.ts` protect). In augment mode the generator only ever **creates a
   new boundary or none** and **never mutates existing boundaries** (§5.2).

**Recommendation:** reuse the existing graph-builder paths for node + relationship creation rather
than a parallel construction path. The generator produces the same intermediate representation the
manual editor produces, then hands it to the existing builder — inheriting the grouping fixes and
avoiding divergence.

---

## 11. Implementation Sketch

1. **Catalog module** — `block-catalog.ts`: pure data, one asset-first `BuildingBlock` per entry
   (data + function assets). No logic, no domain semantics, no version field, **no CIANAAA**.
2. **Generator core** — `base-dfd-generator.ts`: takes `GeneratorConfig`, iterates blocks,
   instantiates assets → supporting nodes/interactions/relationships into the shared IR, resolves
   inter-block ports, sets each asset's **DFD-level parameters** per template, sets review state
   `pending`, assigns the transient `generationBatchId`. Emits its own artifacts per block — **no
   cross-block merging** (§3.5).
3. **Boundary resolver** — applies `preferredBoundaryAffinity` / `boundaryOverride` to create a
   **new** boundary or **none**; honours `placement` (default `right`, offset against existing
   diagram bbox); **never mutates existing elements** (§5.2).
4. **Hand-off to existing builder** — feed the IR into the current DFD construction path; shared
   grouping/relationship logic, not duplicated.
5. **Review + batch lifecycle** — `pending` on generation; a single edit marks only that asset
   `adapted` (no batch side-effect); **Accept all** → remaining `pending` → `confirmed`;
   **Discard all** available while ≥1 `pending` member, with blast-radius confirmation counting
   any `adapted` members; batch retires on Accept all / Discard all / no-`pending`-left (§7.2–§7.3);
   honour absence semantics for old projects (§7.5).
6. **Unified cascade-delete** — one referentially-correct path, three entry points (§8).
7. **Unconnected-port diagnostic** — lint over exposed ports, non-blocking, separate from review
   state (§5.2.5).
8. **Asset-only view** — review-only projection + state-transition + batch actions (§9).
9. **i18n** — all block labels/descriptions via translation keys; **code comments in English**.

### Suggested file layout (clean architecture, no cross-feature imports)
```
src/features/dfd-generator/
  block-catalog.ts          // data only, asset-first, no version field, no CIANAAA
  base-dfd-generator.ts     // core, no cross-block merging
  boundary-resolver.ts      // new TB | none, placement (default right), additive only
  generation-batch.ts       // opaque transient tag + lifecycle + absence semantics
  generator-config.ts       // types
  __tests__/                // per-block, augment (additive), composition, cascade-delete, legacy-load
src/features/asset-view/    // asset-only graph view (review-only, separate feature)
  ...
src/shared/                 // cascade-delete lives with the DFD-Asset sync it reuses
```

---

## 12. Testability

Each block is independently testable: instantiate one block, assert expected data + function
assets, supporting nodes, relationships, boundary preference, **DFD-level parameters**, initial
`pending` state, and batch tagging. Second layer: inter-block wiring **and composition** (two
blocks that could share a store produce two stores; named-port wiring connects where declared —
§3.5). Third layer: augment mode is **additive** (block into existing graph → new TB or none,
placed by `placement` defaulting to `right`, existing elements unchanged, no UUID collisions,
cloud device-side ends open, unconnected-port diagnostic raised). Fourth layer: lifecycle (Accept
all → confirmed + tag cleared; Discard all + cascade-delete removes
all three categories with no orphaned relationships; persisted batch survives reload; a single
edit marks only that asset `adapted` and **leaves the batch and Discard all intact**; Discard all
with `adapted` members present shows the correct blast-radius count; batch retires on Accept all /
no-`pending`-left). Fifth
layer: **legacy load** (pre-alpha project without the fields → no element shown as `pending`, no
batch affordances, no crash).

---

## 13. Decision Log (resolved)

1. **Review-state granularity** → **per-element**. Any DFD-level parameter change or new
   relationship flips the whole asset to `adapted`. Per-property rejected as over-modeling (§6.1).
2. **CIANAAA defaults location** → **out of scope**. Protection goals are assigned in the
   asset-tab impact phase, not by the generator (DFD-tab). Removed throughout.
3. **Cloud block transport boundary** → **none**. Always direct-to-internet; flows connected
   cloud-side only, device-side ends left open for the analyst (§5.2.4).
4. **Batch persistence across save/reload** → **persist** an opaque grouping tag (no block
   reference). Backward-compatible via absence semantics for pre-alpha projects (§7.1, §7.5).
5. **Default placement** → **`right`** (analyst-overridable to top/bottom/left) (§4, §5.2).
6. **Asset-only view scope** → **review-only** for v1; asset/relationship authoring stays in DFD
   mode; "primary security-model screen" remains a future direction (§9).
7. **Batch dissolution on edit** *(post-v5 review)* → a single edit does **not** dissolve the
   batch. "Discard all" stays available while ≥1 `pending` member exists; with `adapted` members
   present it relies on the blast-radius confirmation (§8) to count analyst edits. The batch
   retires only on Accept all / Discard all / no-`pending`-left. Chosen over a warning dialog:
   the surprising irreversible moment is designed out, not papered over (§7.2, §7.3).

---

## 14. Summary

A configurable, catalog-driven generator (DFD-tab) that emits a **complete DFD** from
**self-contained, asset-first building blocks** (data **and** function assets as first-class
citizens), with **typed relationships** and **explicit but overridable boundary preference**.
**Protection goals (CIANAAA) are not set here** — that is a later asset-tab phase. The block is a
**stamp with no persistent identity and no version field** — the graph is the only truth,
**regeneration is intentionally absent**, and the generator performs **no semantic merging** across
blocks (two blocks → two stores; consolidation is the analyst's job). Two modes: **Fresh**
(deterministic) and **Augment** (**purely additive** — own new TB or none, placed `right` by
default, existing elements never mutated; minimal wiring; the Cloud block is always direct with
device-side flow ends left open; UUID identity → no collisions). Generated output carries a
per-asset **review state** (`pending` → `confirmed` / `adapted`, per-element); relationships are
**bulk-confirmed and visually surfaced**. A persisted but **opaque transient generation batch**
enables **Accept all / Discard all**, with whole-block discard available **while any `pending`
member remains** (a single edit does not kill it; the blast-radius confirmation counts analyst
edits) and surviving save/reload. **Pre-alpha projects load without
migration** via safe absence semantics. All deletion flows through **one unified cascade-delete**.
The **asset-only graph view is review-only** for v1. The catalog is the extension point — and the
core invariant is that it must **never** grow into a second domain model.
