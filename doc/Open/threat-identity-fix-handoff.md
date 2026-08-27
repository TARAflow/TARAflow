# TARAflow — Cross-Feature Identity Fix: Handoff Document

**Status:** Planning phase. Threat model fix fully specified and ready to
implement. Risk and Attack-Tree fixes scoped at the type level; both are
blocked on a few more source files (see "Files Still Needed").

Paste this whole document into a new chat along with the relevant source files
to resume work.

---

## 1. The Bug (root cause, applies across all three features)

**Original symptom:** Analyst edits to a threat (custom cause text,
`linkedAssetIds`, `relevance` rating, etc.) are silently lost whenever threats
are regenerated after a DFD element gets renumbered (e.g. `EE-1` ↔ `EE-2` swap
after adding/removing an element). In the reported case, ~470 threat records
were affected by a single renumbering event.

**Root cause (confirmed by code review):** A threat's only identifier is `id`
(e.g. `EE1-S-1`), which is *derived from* the element's current `displayId` —
a value that is explicitly documented elsewhere as mutable. The full
regeneration path (`ElementThreatGenerator.generateThreatsForProject()` /
`createThreatForElement()`, and the analogous `InteractionThreatGenerator`)
has **no lookup against existing threats at all** — it builds every threat
from scratch via `createEmptyThreat()` on every call. There is no natural-key
match against `(elementId, strideCategory)`, so a full regeneration always
produces a brand-new set of threat objects.

**Important nuance vs. the original bug report:** The "silent sync" path
(`checkSyncStatus` / `applyChangedReferences` in `element-sync.ts` /
`interaction-sync.ts`) is **already correct**. It matches existing threats by
`linkedElement.elementId` (stable UUID) against the current graph and does a
non-destructive `{...threat, id: newId, ...}` update, preserving all
analyst-owned fields. The actual data loss only happens on a **full
regeneration** (e.g. a "Regenerate Threats" action), which bypasses this safe
path entirely.

**This is a general pattern, not a one-off Threat-feature bug**: anywhere a
piece of persisted, analyst-owned data is keyed on a *value that is also a
regenerable display label*, the same failure mode is latent. Sections 1a/1b
below show it recurring in Risk and Attack-Tree — discovered when the user
asked "we probably have the same problem there".

**Non-goals (per original bug report, still holds):**
- Do not change which STRIDE templates apply to which element/flow types.
- Do not change the visible display-ID format (`EE1-S-1` etc.) — it should keep
  updating on renumber, that's expected. Only loss of analyst content is the bug.

---

## 1a. Downstream Impact — Risk Feature (confirmed, more severe)

`risk-assessment-types.ts`:

```ts
export function generateRiskId(threatId: string): string {
  return `R-${threatId}`;
}

export function createEmptyRisk(threatRef: ThreatReference, ...): Risk {
  return {
    id: generateRiskId(threatRef.id),   // ← "R-EE1-S-1" — composed from the SAME mutable string
    threatId: threatRef.id,             // ← "EE1-S-1"   — the foreign key to the threat
    ...
  };
}
```

**Two coupling points, both broken by threat renumbering:**
1. `Risk.threatId` is the foreign key back to the owning threat. Once the
   Threat-feature fix lands (`Threat.id` = stable UUID, `Threat.displayId` =
   regenerable label), `Risk.threatId` must point at `Threat.id`, not at
   whatever `ThreatReference.id` currently mirrors. **Until then, this FK
   silently breaks on every threat renumbering** — a risk becomes orphaned
   (no threat resolves) or a duplicate risk gets created because the lookup
   comes up empty.
2. `Risk.id` **itself** is composed from `threatId`. This is more severe than
   the original threat bug: a `Risk` carries the heaviest analyst investment
   in the whole tool — `factorRatings`, `treatment`, `treatmentJustification`,
   `moscowPriority`, `riskBeforeRationale`/`riskAfterRationale`,
   `selectedMitigations[]` including live **Jira/ADO ticket links**
   (`ticketId`, `ticketUrl`, `ticketStatus`). If the Risk's own identity
   shifts with renumbering, all of that — including external ticket
   integration state — is at risk of being orphaned or duplicated.

**No mitigating sync logic found**: `migrateRiskData` (the only
risk-side migration present in the reviewed files) only repairs
`configuration`/`factorRatings` shape, not identity. No natural-key
reconciliation against threats was found in the files reviewed so far.

**Separate, lower-severity finding (staleness, not identity):**
`createEmptyRisk` **copies** `threatDescription`, `attackDescription`,
`causeDescription`, `linkedAssetIds`, `threatRelevance`, `proposedMitigations`,
`proposedVerifications` from the threat into the risk **once, at creation
time**. If the analyst later edits these on the Threat tab (e.g. adds a
`causeDescriptionExtension`, changes `relevance`), the Risk's copy goes stale
unless some resync mechanism refreshes it — haven't seen `risk-sync-service.ts`
yet to know if this is handled. Related to the identity bug (same "copy vs.
live reference across features" family) but analytically distinct — track
separately.

**Proposed design for Risk (mirrors the Threat fix):**
- `Risk.id`: independently generated UUID (`crypto.randomUUID()`), no longer
  composed from `threatId`. `generateRiskId()` as a *storage key* generator
  goes away.
- `Risk.threatId`: continues to reference the threat, but now resolves against
  `Threat.id` (UUID) once that fix lands — meaning the adapter that builds
  `ThreatReference` from `Threat` must expose the UUID as `ThreatReference.id`,
  not the display string. **Needs verification against the `shared` package's
  `ThreatReference` type** (not yet reviewed — see Files Still Needed).
- Display string "R-EE1-S-1" must be computed at render time from the live,
  currently-linked threat's `displayId` (`` `R-${liveThreat.displayId}` ``),
  never persisted as-is.

---

## 1b. Downstream Impact — Attack-Tree Feature (confirmed, three separate coupling points)

`attacktree-types.ts` duplicates the same shallow reference shape locally
(deliberately, per its own comment, to keep the module weakly coupled):

```ts
export interface ThreatReference {
  id: string;               // ← same mutable string, no displayId split
  strideCategory: StrideCategory;
  threatDescription: string;
  mitigation?: string;
  linkedAssetIds?: string[];
}

export interface RiskReference {
  id: string;
  threatId: string;         // ← same FK problem as Risk.threatId
  calculatedRiskBeforeMitigation: number;
  moscowPriority: string;
}
```

Three distinct places this bites, in increasing order of repair difficulty:

1. **`AttackTreeAnchor.threatId` / `.riskId`** — a "Standard Workflow" tree is
   anchored 1:1 to an existing threat or risk (`AttackTree` comment: "one per
   anchor"). This is a clean struct field — repairable via the same kind of
   migration as Threat/Risk, once the anchor is repointed at the stable UUID.
2. **`RiskReference.threatId`** (local copy, read-only display use as far as
   reviewed) — same FK fragility as 1a above, but lower stakes since it looks
   display-only here; needs confirming against actual usage sites.
3. **`AttackTreeNode.threatRef?: string`** — a **per-node reference embedded
   in analyst-edited DSL text**, not a clean struct field. This is the hardest
   case: even after a migration fixes stored struct fields, this reference
   lives inside free-form text the analyst keeps hand-editing, so it can't be
   silently repaired the way `Risk.threatId` can. Needs its own investigation
   once the DSL parser file is available (see Files Still Needed) — in
   particular: does `threatRef` resolve by exact string match against
   `Threat.id`, and does the DSL editor offer autocomplete that would need to
   switch to resolving against the stable UUID while still *displaying* the
   short label?

**Also found: `AttackTreeAnchor.threatId` is baked into the tree's initial DSL
source as free text** at tree-creation time (`createEmptyAttackTree` →
`generateInitialDSL`):
```ts
"# Threat: " + (anchor.threatId || "T-XXX") + ... +
(anchor.threatTitle || "Threat Goal") + " [" + (anchor.threatId || "T-XXX") + "];ROOT\n"
```
This is a **one-time cosmetic snapshot**, not a live reference — the DSL text
itself is never re-parsed to resolve the anchor. Renumbering makes this
initial comment/label stale-looking but does **not** cause data loss (distinct
from point 3 above, which is a live, functionally-resolved reference). Flagged
for awareness, not in scope for the identity fix itself.

**Positive finding — existing precedent to reuse:** `AttackPath` in this same
file **already solves an identical problem correctly**, and states the
principle almost word-for-word what we designed for `Threat.id`/`displayId`:

```ts
export interface AttackPath {
  /**
   * Enumeration label ("path-1", "path-2", ...). DISPLAY ONLY.
   * NOT an identity: it is assigned in traversal order, so inserting one DSL
   * line renumbers every subsequent path. Never persist it, never key an
   * assessment off it. Use `pathKey`.
   */
  id: string;

  /**
   * Stable identity, derived from the ROOT→leaf node-name chain.
   * Survives sibling insertion, branch reordering and reformatting; changes
   * only when a node ON the path is renamed. This is the key an analyst's
   * confirm/dismiss decision, risk rating and Jira link hang on.
   */
  pathKey: string;
  ...
}
```
`AttackPathAssessment` is correctly keyed on `(pathKey, strideCategory)`, not
on the derived display id. **This confirms the id/displayId pattern is already
an accepted convention in this codebase** — good precedent to cite when
proposing the same split for `Threat`/`Risk`.

**Threats emitted BY attack trees** (`sourceStrideMethod: "attack-path"`,
format `AT-<treeId>-<pathKey>-<STRIDE>`) are themselves ordinary `Threat`
objects stored in `perAttackPathThreats`. Since both `treeId` and `pathKey`
are already designed to be stable, these should automatically inherit the
Threat-feature fix's benefits (`id` = UUID, `displayId` = the `AT-...` string)
**provided** `attacktree-threat-generator.ts` (not yet reviewed) uses the same
`createEmptyThreat()` / merge machinery as the other two generators, rather
than its own ad-hoc object construction. **Needs verification.**

---

## 2. Decisions Made So Far (Threat feature — final)

| Topic | Decision |
|---|---|
| Identity field naming | `Threat.id` becomes the stable UUID (generated once, never changes). `Threat.displayId` becomes the human-readable, regenerable label (`EE1-S-1` etc.) — mirrors the existing `DFDElementReference` pattern AND the `AttackPath.id`/`pathKey` pattern found in the attack-tree module (see section 1b) — this is already an accepted convention in the codebase. |
| Natural key — per-element | `(linkedElement.elementId, strideCategory)`. Deliberately **excludes** `templateId` — `sequenceNumber` is currently always `1`, and a template swap for the same slot (e.g. due to a property change) is the same conceptual threat, not a new one. |
| Natural key — per-interaction | `(dataFlow.connectionId, strideCategory, interactionContext.direction)`. `direction` is required because sender and receiver perspectives produce two independent threats for the same connection. |
| `causeDescription` | Analysts can **extend** it but the original catalog text must be preserved. New field `causeDescriptionExtension?: string` added — purely analyst-owned, generator never writes to it. On natural-key match, `causeDescription` itself is always kept verbatim (never re-pulled from the template); only set fresh when a threat is genuinely new. |
| `linkedAssetIds` | **Not** analyst-editable (confirmed) — shown in the threat dialog for information only, sourced from the element↔asset linkage. Always recomputed from the current graph/asset index on regeneration. No merge needed. |
| `proposedMitigations` / `proposedVerifications` | Must **not** be frozen — `alreadyImplemented` / `implementedByProperty` / `implementedByValue` depend on the live DFD model state (close-loop drift detection, confirmed by user) and must always be recomputed. Only the analyst's free-text `notes` on catalog entries, and any fully custom (no-`id`) entries, must be preserved across regeneration. See merge algorithm in Phase 1. |
| `threatActor` | Always preserved — generator never actively sets it after initial creation, but a full regen via `createEmptyThreat` would otherwise reset it to `"external"`. |
| `linkedElement`, `dataFlow`, `trustBoundary*` | Always recomputed from the current graph (source of truth). |
| `relevance`, `workflowStatus`, `evalNote` | Always preserved. |
| `initialImpact`, `source`, `templateId` | Always recomputed (system/strategy-derived). |

### Known, deliberately out-of-scope limitation (Threat feature)
If an analyst actively **removes** a catalog-suggested mitigation/verification
entry (because it doesn't apply), it will reappear on the next regeneration if
the template still suggests it — there's currently no tombstone/suppression
field. Flagged as a possible follow-up (`suppressedMitigationIds?: string[]`),
**not** part of this fix unless the user says otherwise.

---

## 3. Open Questions

**Threat feature:**
1. Function renaming: rename `generateThreatIdPerElement`,
   `generateThreatIdForInterface`, `generateThreatIdPerInteraction` (and
   `ElementChange.newId`) to `generateDisplayId...` / `newDisplayId`, or keep
   old names to minimize diff size? — awaiting decision.
2. UI/lookup files not yet reviewed (Threat table, Threat Eval dialog,
   export/report) — requested, not yet received.

**Risk feature:**
3. Need to see `shared`'s canonical `ThreatReference` type (not the local
   attack-tree copy) to confirm how the Threat→Risk bridge maps `id`, and
   whether it needs a `displayId` field added too.
4. Need the risk generation entry point (likely `risk-generation-service.ts`,
   analogous to `element-generator.ts`) to see whether "Generate Risks" already
   does any `threatId`-based matching against existing `RiskData.risks`, or is
   as unguarded as the Threat generator was.
5. Need `risk-sync-service.ts` (referenced in a code comment re:
   `attackTreeAssessment`) to see the existing sync/reconciliation pattern for
   Risks, and to check whether the "copy goes stale" issue (section 1a) is
   already partially handled.

**Attack-Tree feature:**
6. Need `attacktree-threat-generator.ts` to confirm attack-path-emitted
   threats reuse the shared `createEmptyThreat()`/merge machinery (if not,
   they need the same fix independently applied).
7. Need whatever DSL parser/service resolves `AttackTreeNode.threatRef` to
   understand how deep the free-text coupling goes and whether it's
   practically fixable at all versus documented as a known limitation.
8. Need to see how attack trees get **re-anchored** when their underlying
   threat/risk changes (is there a sync/banner mechanism analogous to
   `ThreatSyncStatus`, or does the tree just silently keep the stale
   `threatId` forever once created?).

---

## 4. Implementation Phases

### Phase 0 — Threat data model
- `threat-types.ts`: keep `Threat.id` as UUID identity; add
  `Threat.displayId: string`; add `Threat.causeDescriptionExtension?: string`.
- `createEmptyThreat()`: generate the UUID internally (`crypto.randomUUID()`)
  instead of requiring callers to pass one in.
- Update `ElementChange.newId` → `newDisplayId` in `per-element-types.ts`, and
  the equivalent in `per-interaction-types.ts` (`DataFlowChange`).

### Phase 1 — Shared merge utility (Threat)
New file `services/threat-identity.ts`:
- `buildElementThreatIndex(tables): Map<string, Threat>` — key
  `` `${linkedElement.elementId}::${strideCategory}` ``
- `buildInteractionThreatIndex(tables): Map<string, Threat>` — key
  `` `${dataFlow.connectionId}::${strideCategory}::${direction}` ``
- `mergeGeneratedThreat(existing: Threat | undefined, generated: Threat): Threat`
  implementing the field-by-field policy in section 2.
- `mergeProposedMitigations(existing, freshMerged): MitigationDraft[]` and the
  verification equivalent — recompute `alreadyImplemented`/`implementedByProperty`/
  `implementedByValue` from `freshMerged` always; carry over `notes` from
  matching existing entries by `id`; append existing no-`id` (custom) entries
  unchanged.

### Phase 2 — Generator changes (Threat)
- `element-generator.ts`: `generateThreatsForProject()` builds the index from
  `project.threats?.perElementTables` up front and threads it through to
  `createThreatForElement()`, which calls `mergeGeneratedThreat()` instead of
  returning the freshly-created threat directly. `generateThreatsForSingleElement()`
  accepts an optional index parameter (default empty) for the sync add-path.
- `interaction-generator.ts`: same pattern with `buildInteractionThreatIndex`.

### Phase 3 — Sync path adjustments (Threat)
- `element-sync.ts` / `interaction-sync.ts`: matching logic that currently keys
  on `threat.id` (`changeMap.get(threat.id)`, `orphanedSet.has(t.id)`) keeps
  working unchanged — it now matches on the UUID instead of the display string,
  which is strictly more robust. Assignment sites that currently do
  `{...threat, id: newThreatId, ...}` switch to `displayId: newDisplayId`.
- `apply-dfd-change-sync.ts`: no logic change expected, just flows through the
  updated `ElementThreatSync`/`InteractionThreatSync` methods.

### Phase 4 — Migration (Threat)
New `migrateThreatIdentity(threatData: ThreatData): ThreatData`, modeled on the
existing `migrateAssetConfiguration` pattern, called on project load. For every
threat in `perElementTables` / `perInteractionTables` without a valid UUID `id`
(i.e. loaded from a pre-fix `.tara.json`), moves the old `id` value into
`displayId` and generates a fresh UUID for `id`. Idempotent.

### Phase 5 — UI / lookup layer (Threat)
Blocked on receiving the relevant files (Open Question 2). Expected scope:
Threat table row keys, Threat Eval dialog's "which threat is being edited"
reference, export/report generation, possibly undo/redo references — switch
stable-identity usages from `id` (old, display string) to `id` (new, UUID),
keep displaying `displayId`.

### Phase 6 — Regression test (Threat)
Reproduce the original bug end-to-end:
1. Generate threats for a DFD.
2. Customize a threat: edit `causeDescriptionExtension`, set `relevance`,
   annotate a mitigation's `notes`.
3. Trigger a DFD change that swaps the `displayId` of two elements (not their
   underlying `elementId`).
4. Trigger a **full regeneration** (not just sync) — this is the path that
   previously lost data.
5. Assert: `id` (UUID) unchanged, `displayId` updated to reflect new numbering,
   `causeDescription` + `causeDescriptionExtension` + `relevance` +
   mitigation `notes` all preserved, `linkedAssetIds` freshly recomputed,
   mitigation `alreadyImplemented` flags freshly recomputed from current
   element properties.

### Phase 7 — Risk identity fix (scoped, not yet fully specified)
Pending Open Questions 3–5. Expected shape:
- `Risk.id`: independent UUID, `generateRiskId()` retired as a storage-key
  generator.
- `Risk.threatId`: repointed to resolve against `Threat.id` (UUID) — requires
  Phase 0 to have landed first, and requires knowing how `ThreatReference` is
  built (Open Question 3).
- Display label "R-EE1-S-1": computed at render time from the live threat's
  `displayId`, never persisted.
- Migration: `migrateRiskIdentity`, same idempotent shape as
  `migrateThreatIdentity`, run **after** the threat migration (Risk migration
  needs the threat's new UUID to already exist to repoint `threatId`
  correctly).
- Needs a merge/reconciliation pass analogous to Phase 1/2 if "Generate Risks"
  turns out to be as unguarded as the Threat generator was (Open Question 4).
- Separate, lower-priority follow-up: address the "Risk copies threat fields
  once, then goes stale" issue (section 1a) — likely a `risk-sync-service.ts`
  change, scope TBD pending Open Question 5.

### Phase 8 — Attack-Tree identity fix (scoped, not yet fully specified)
Pending Open Questions 6–8. Expected shape:
- `AttackTreeAnchor.threatId` / `.riskId`: repointed to the stable UUIDs,
  migration analogous to Phase 4/7, run after both Threat and Risk migrations.
- Local `ThreatReference`/`RiskReference` copies in `attacktree-types.ts`:
  add `displayId` alongside `id` so the attack-tree UI can keep showing the
  short label while resolving identity via `id`.
- `AttackTreeNode.threatRef` (DSL-embedded reference): investigate feasibility
  of a real fix once the parser is available; may end up documented as a known
  limitation rather than fixed, depending on how deep the DSL coupling goes.
- Verify (or fix) `attacktree-threat-generator.ts` to use the shared
  `createEmptyThreat()`/merge machinery from Phase 1/2.
- No fix needed for `AttackPath.pathKey` — already correct, cited as
  precedent for the whole effort.

---

## 5. Files Already Reviewed

**Threat feature:**
- `threat-types.ts` — core `Threat`/`ThreatTable`/`ThreatProjectData` model
- `per-element-types.ts` — STRIDE-per-element ID generation, `ElementChange`
- `per-interaction-types.ts` — STRIDE-per-interaction ID generation, `DataFlowChange`
- `strategy-types.ts` — `IGeneratorStrategy`, `GenerationModules`
- `element-generator.ts` — full per-element generation pipeline (confirmed root cause)
- `element-sync.ts` — `checkSyncStatus` / `applyChangedReferences` / `synchronizeThreats` (confirmed already-correct Class-A path)
- `interaction-generator.ts` — per-interaction generation (partial read; header + `createDataFlowThreat`)
- `interaction-sync.ts` — `synchronizeThreats` (confirmed additive/safe "missing" path)
- `sync-threats-with-graph.ts` — orchestration entry point
- `apply-dfd-change-sync.ts` — per-DFD-change re-sync wrapper
- `threat-service.ts` — base `ThreatService` interface
- `implemented-controls-mapper.ts` — `getImplementedMitigationHints` / `mergeMitigationHints` (close-loop mechanism, informs Phase 1 merge design)

**Risk feature:**
- `risk-assessment-types.ts` — core `Risk`/`RiskData`/`RiskProjectData`, `generateRiskId`, `createEmptyRisk`, `migrateRiskData` (confirmed identity coupling)
- `risk-config-types.ts` — `RiskConfiguration`, factor/method config
- `risk-factor-types.ts` — factor catalog, `FactorRating`, factor-id migration helpers
- `risk-scale-types.ts` — scales, treatments, MoSCoW, risk matrix (no identity coupling found)
- `risk-mitigation-types.ts` — `SelectedMitigation`, mitigation status lifecycle, ticket fields
- `risk-integration-types.ts` — Jira/ADO ticket types (no identity coupling found, but the ticket link lives on `SelectedMitigation` inside `Risk`, so it's at risk transitively via `Risk.id`)

**Attack-Tree feature:**
- `attacktree-types.ts` — full type file: `ThreatReference`/`RiskReference` local copies, `AttackTreeAnchor`, `AttackTreeNode`, `AttackPath`/`pathKey` (existing correct precedent), `AttackTree`, `AttackTreeProjectData`, DSL-generation functions (confirmed all three coupling points in section 1b)
- `attacktree-feasibility-types.ts` — ISO 21434 / IEC 62443 feasibility scoring config (no identity coupling — self-contained scoring model)

## 6. Files Still Needed

**Threat feature:**
- Threat table UI component (whatever renders `perElementTables`/`perInteractionTables` as rows)
- Threat Eval dialog component
- Export / report generation code that references `threat.id`
- `element-threat-service.ts` / `interaction-threat-service.ts` (concrete `ThreatService` implementations — referenced in the original bug report but not yet uploaded)

**Risk feature:**
- `shared` package's canonical `ThreatReference` type definition (distinct from the local copy in attacktree-types.ts)
- Risk generation entry point (likely `risk-generation-service.ts`)
- `risk-sync-service.ts`

**Attack-Tree feature:**
- `attacktree-threat-generator.ts`
- DSL parser / service that resolves `AttackTreeNode.threatRef`
- Whatever handles re-anchoring / sync when a tree's underlying threat or risk changes
