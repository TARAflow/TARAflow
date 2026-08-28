# TARAflow — Cross-Feature Identity Fix: Handoff Document

**Status:** In implementation. Verified end-to-end against the live repo
(`github.com/TARAflow/TARAflow` @ `fe0f604`). **Every file previously listed as
"still needed" is now available** — no section is type-level-only anymore.

**Patch 1 (merge-first, Strategy B) is built, validated and delivered** — it stops
the actual data loss with near-zero regression risk and works on already-saved
`.tara.json` files. The identity split (Strategy A), Risk, and Attack-Tree follow
as Patches 2–4. See §0 (progress) and §4 (sequencing).

Inline markers below: **[Verified]** = confirmed exactly as the draft described;
**[Correction]** = the draft was wrong or incomplete, fixed here;
**[New]** = discovered during review, not in the original draft.

---

## 0. Progress & sequencing (read this first)

`A` = the UUID/`displayId` identity split (Phases 0–6 below). `B` = a natural-key
merge in the generator with **no** identity change.

- **Patch 1 = B — DONE.** Stops the actual data loss (~470 records) with the
  smallest possible blast radius: 2 new files + a ~15-line change in each generator.
  **No** model change, **no** migration, **no** sync change, **no** UI change → all
  existing tests stay green, and it works on already-saved `.tara.json` immediately
  (the merge keys on `linkedElement.elementId` / `dataFlow.connectionId`, which every
  stored threat already carries). Downside: does **not** fix the Risk/attack-tree FK
  fragility — a *pre-existing* concern it also doesn't worsen.
  - Files: new `src/features/threats/services/threat-identity.ts` (natural keys +
    field-by-field merge per §2), merge post-pass wired into the end of
    `generateThreatsForProject` in both generators, vitest at
    `src/tests/unit/features/threats/services/threat-identity.test.ts`.
  - Validated via esbuild+Node harness (23/23) mirroring the vitest cases; patch
    dry-run-applies cleanly to a fresh clone.
- **Patch 2 = A.** The architectural hardening: `Threat.id` → UUID, `displayId` →
  label, `migrate_4_to_5`, sync-detection redirect (§Phase 3), UI display/sort switch
  (§Phase 5), dedup re-key (§Phase 2 caveat). **Reuses Patch 1's
  `mergeGeneratedThreat` / `mergeGeneratedTables` verbatim** — only the
  identity-preservation line differs (`id: fresh.id` → keep `existing.id`, recompute
  `displayId`). Nothing in Patch 1 is thrown away.
- **Patch 3 = Risk** (independent `Risk.id` UUID + `migrateRiskIdentity` repoint,
  `R-<displayId>` computed at render — Phase 7).
- **Patch 4 = Attack-tree** (anchors, local ref copies, DSL `threatRef`
  investigation — Phase 8).

Rationale: ship the fix testable today at near-zero regression risk, then layer the
identity split. Going straight to A is also viable — Patch 1's merge machinery is
already the code A needs, so it would be *extended*, not replaced.

---

## 1. The Bug (root cause, applies across all three features)

**Original symptom:** Analyst edits to a threat (custom cause text,
`linkedAssetIds`, `relevance` rating, etc.) are silently lost whenever threats
are regenerated after a DFD element gets renumbered (e.g. `EE-1` ↔ `EE-2` swap
after adding/removing an element). In the reported case, ~470 threat records
were affected by a single renumbering event.

**Root cause — [Verified] (`element-generator.ts` `createThreatForElement`):** A
threat's only identifier is `id` (e.g. `EE1-S-1`), built from
`element.displayId || element.id` — a value explicitly documented elsewhere as
mutable. The full regeneration path
(`ElementThreatGenerator.generateThreatsForProject()` / `createThreatForElement()`,
and the analogous `InteractionThreatGenerator`) has **no lookup against existing
threats at all** — it builds every threat from scratch via `createEmptyThreat()`
on every call. There is no natural-key match against `(elementId, strideCategory)`,
so a full regeneration always produces a brand-new set of threat objects.

**Important nuance vs. the original bug report — [Verified]:** The "silent sync"
path (`checkSyncStatus` / `applyChangedReferences` in `element-sync.ts` /
`interaction-sync.ts`) is **already correct**. It matches existing threats by
`linkedElement.elementId` (stable UUID) against the current graph and does a
non-destructive `{...threat, id: newId, ...}` update, preserving all
analyst-owned fields. The actual data loss only happens on a **full
regeneration** (e.g. a "Regenerate Threats" action), which bypasses this safe
path entirely.

**Natural keys are already present on the stored threat — [Verified]:**
per-element `(linkedElement.elementId, strideCategory)`; per-interaction data-flow
`(dataFlow.connectionId, strideCategory, interactionContext.direction)`;
per-interaction interface `(linkedElement.elementId, strideCategory)` (always
`direction="incoming"`). This is what makes Patch 1 work on existing files with no
migration.

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

**[Correction] Risk FK is fixed *for new risks* as a side effect of the Threat
UUID.** `extractThreatReferences` (`workspace-layout.tsx:709`) copies
`Threat.id → ThreatReference.id` straight through, and `createEmptyRisk` copies
`ThreatReference.id → Risk.threatId`. So once `Threat.id` is a UUID, newly created
risks are stable across renumbering automatically. Only **existing** risks (with
`threatId="EE1-S-1"`) need `migrateRiskIdentity` to repoint `threatId` to the
matching threat's new UUID — run after the threat migration. This narrows Phase 7's
risk considerably.

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
unless some resync mechanism refreshes it — `risk-sync-service.ts` (now available)
must be checked to know if this is handled. Related to the identity bug (same
"copy vs. live reference across features" family) but analytically distinct — track
separately.

**Proposed design for Risk (mirrors the Threat fix):**
- `Risk.id`: independently generated UUID (`crypto.randomUUID()`), no longer
  composed from `threatId`. `generateRiskId()` as a *storage key* generator
  goes away.
- `Risk.threatId`: continues to reference the threat, but now resolves against
  `Threat.id` (UUID) once that fix lands — the `extractThreatReferences` bridge
  already exposes the UUID as `ThreatReference.id` (confirmed against
  `src/shared/models/threat-reference-types.ts`).
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
   with the DSL parser (now available) — in particular: does `threatRef` resolve
   by exact string match against `Threat.id`, and does the DSL editor offer
   autocomplete that would need to switch to resolving against the stable UUID
   while still *displaying* the short label?

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

**Positive finding — existing precedent to reuse — [Verified]:** `AttackPath` in
this same file **already solves an identical problem correctly**, and states the
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
**provided** `attacktree-threat-generator.ts` (now available) uses the same
`createEmptyThreat()` / merge machinery as the other two generators, rather
than its own ad-hoc object construction. **Needs verification during Patch 4.**

---

## 2. Decisions Made So Far (Threat feature — final)

| Topic | Decision |
|---|---|
| Identity field naming | `Threat.id` becomes the stable UUID (generated once, never changes). `Threat.displayId` becomes the human-readable, regenerable label (`EE1-S-1` etc.) — mirrors the existing `DFDElementReference` pattern AND the `AttackPath.id`/`pathKey` pattern found in the attack-tree module (see §1b) — already an accepted convention in the codebase. |
| Natural key — per-element | `(linkedElement.elementId, strideCategory)`. Deliberately **excludes** `templateId` — `sequenceNumber` is currently always `1`, and a template swap for the same slot (e.g. due to a property change) is the same conceptual threat, not a new one. |
| Natural key — per-interaction | `(dataFlow.connectionId, strideCategory, interactionContext.direction)`. `direction` is required because sender and receiver perspectives produce two independent threats for the same connection. Interface threats use `(linkedElement.elementId, strideCategory)`. |
| `causeDescription` | Analysts can **extend** it but the original catalog text must be preserved. New field `causeDescriptionExtension?: string` (Strategy A) — purely analyst-owned, generator never writes to it. On natural-key match, `causeDescription` itself is always kept verbatim (never re-pulled from the template); only set fresh when a threat is genuinely new. |
| `linkedAssetIds` | **Not** analyst-editable (confirmed) — shown in the threat dialog for information only, sourced from the element↔asset linkage. Always recomputed from the current graph/asset index on regeneration. No merge needed. |
| `proposedMitigations` / `proposedVerifications` | Must **not** be frozen — `alreadyImplemented` / `implementedByProperty` / `implementedByValue` depend on the live DFD model state (close-loop drift detection, confirmed by user) and must always be recomputed. Only the analyst's free-text `notes` on catalog entries, and any fully custom (no-`id`) entries, must be preserved across regeneration. See merge algorithm in Phase 1. |
| `threatActor` | Always preserved — generator never actively sets it after initial creation, but a full regen via `createEmptyThreat` would otherwise reset it to `"external"`. |
| `linkedElement`, `dataFlow`, `trustBoundary*` | Always recomputed from the current graph (source of truth). |
| `relevance`, `workflowStatus`, `evalNote` | Always preserved. |
| `isTextCustomized` + customised `threatDescription`/`attackDescription` | Preserved when the analyst has customised; otherwise recomputed. |
| `created` / `lastModified` | Preserved on merge (avoids audit churn — a regeneration is not an analyst edit). |
| `initialImpact`, `source`, `templateId` | Always recomputed (system/strategy-derived). |
| **Merge placement — [Correction]** | A **post-pass** at the end of `generateThreatsForProject` (match each fresh threat to its predecessor by natural key, overlay analyst fields) — **not** threading an index through `createThreatForElement`'s 8 private call sites. Semantically identical, ~15-line diff. This is what Patch 1 does; keep it for the UUID phase too. |
| **`createEmptyThreat` signature (Strategy A) — [Correction]** | First parameter becomes `displayId`; the UUID `id` is generated internally (`crypto.randomUUID()`, already used in `hazard-tab.tsx`, global on Node 24 / Electron). All **four** callers already pass the display string first → zero argument churn, only internal semantics change. |

### Known, deliberately out-of-scope limitation (Threat feature)
If an analyst actively **removes** a catalog-suggested mitigation/verification
entry (because it doesn't apply), it will reappear on the next regeneration if
the template still suggests it — there's currently no tombstone/suppression
field. Flagged as a possible follow-up (`suppressedMitigationIds?: string[]`),
**not** part of this fix unless the user says otherwise.

---

## 3. Open Questions — now largely resolved against the repo

**Threat feature:**
1. Function renaming — **[Resolved: recommendation]** Rename the **struct field**
   `ElementChange.newId → newDisplayId` (and the `DataFlowChange` equivalent): its
   meaning genuinely changes (it now feeds `displayId`), and leaving it `newId` is
   exactly the latent-confusion trap. **Keep** the `generateThreatId*` function
   names — they produce the label string; renaming is high-churn/low-value.
2. UI/lookup files — **[Resolved]** all available; concrete scope is 5 display/sort
   sites (see Phase 5).

**Risk feature:**
3. shared `ThreatReference` — **[Resolved]** `src/shared/models/threat-reference-types.ts`;
   `extractThreatReferences` passes `Threat.id` through, so the UUID reaches
   `Risk.threatId` for new risks automatically (see §1a correction).
4. Risk generation entry point — **[Available, not yet deep-reviewed]** confirm during
   Patch 3 whether "Generate Risks" does any `threatId`-based matching against existing
   `RiskData.risks` or is as unguarded as the Threat generator was.
5. `risk-sync-service.ts` — **[Available, not yet deep-reviewed]** check the existing
   sync/reconciliation pattern and whether the "copy goes stale" issue (§1a) is already
   partially handled.

**Attack-Tree feature:**
6. `attacktree-threat-generator.ts` — **[Available, not yet deep-reviewed]** confirm
   attack-path-emitted threats reuse the shared `createEmptyThreat()`/merge machinery.
7. DSL parser resolving `AttackTreeNode.threatRef` — **[Available, not yet
   deep-reviewed]** understand how deep the free-text coupling goes and whether it's
   practically fixable versus documented as a known limitation.
8. Re-anchoring/sync when a tree's underlying threat/risk changes — **[Available, not
   yet deep-reviewed]**.

---

## 3b. Newly discovered adjacent issues — [New] (flagged, NOT silently fixed)

### 3b-i. Manual threats are dropped on full regeneration (pre-existing)
`use-element-threats.ts` `generateThreats` does `setTables(result.tables)` — a
wholesale replace. The generator only emits graph-derived threats, so an analyst's
**manually created** threat is not re-emitted:
- If it shares a natural key with a generated threat, the merge preserves its analyst
  fields onto the generated row, but the manual row as such disappears (one row
  remains).
- If it uses a STRIDE the generator wouldn't emit for that element, it's dropped
  entirely.

**Out of scope** for the reported bug (which is about generated-threat edits); Patch 1
doesn't make it worse. **Decision needed:** should regeneration also carry over manual
threats (a table-level union — cheap to add, but a behaviour change worth a deliberate
call)? The "Regenerate Threats?" confirm dialog is the current guard.

### 3b-ii. Debug log leak in `interaction-generator.ts`
A `// TEMP DEBUG` block (~lines 253–270) runs `console.log("[DEBUG] …")` on **every**
per-interaction generation. Same class as the `audit-git-adapters.ts` path leak.
Remove.

---

## 4. Implementation Phases

> **Patch 1 (Strategy B, merge-only) implements the merge algorithm of Phase 1 as a
> post-pass and wires it into Phase 2's generators, with NO Phase 0/3/4/5 changes.**
> Phases 0/3/4/5 below are Strategy A (Patch 2). Phases 7–8 are Patches 3–4.

### Phase 0 — Threat data model (Patch 2)
- `threat-types.ts`: keep `Threat.id` as UUID identity; add
  `Threat.displayId: string`; add `Threat.causeDescriptionExtension?: string`.
- `createEmptyThreat()`: first param becomes `displayId`; generate the UUID
  internally (`crypto.randomUUID()`) instead of requiring callers to pass one in
  (see §2 signature note — zero caller churn).
- Update `ElementChange.newId` → `newDisplayId` in `per-element-types.ts`, and the
  equivalent in `per-interaction-types.ts` (`DataFlowChange`).

### Phase 1 — Shared merge utility (Threat) — DONE in Patch 1
`services/threat-identity.ts`:
- `elementThreatNaturalKey` / `interactionThreatNaturalKey` — the keys above.
- `buildThreatIndex(tables): Map<string, Threat>`.
- `mergeGeneratedThreat(existing: Threat | undefined, generated: Threat): Threat`
  implementing the field-by-field policy in §2 (undefined existing → fresh unchanged).
- `mergeProposedMitigations(existing, freshMerged)` + verification equivalent —
  recompute `alreadyImplemented`/`implementedByProperty`/`implementedByValue` from
  `freshMerged` always; carry over `notes` from matching existing entries by `id`;
  append existing no-`id` (custom) entries unchanged.
- `mergeGeneratedTables(freshTables, existingTables, keyFn)` — the single call the
  generators make.

### Phase 2 — Generator changes (Threat) — DONE in Patch 1 (merge post-pass)
- `element-generator.ts`: end of `generateThreatsForProject()` returns
  `mergeGeneratedTables(deduplicatedTables, project.threats?.perElementTables,
  elementThreatNaturalKey)` instead of the raw tables.
- `interaction-generator.ts`: same with `perInteractionTables` +
  `interactionThreatNaturalKey`.
- **[Correction] Dedup caveat for Patch 2 (Strategy A only):** `element-generator.ts`
  ends with a dedup keyed on `threat.id`. Under the UUID split, `createEmptyThreat`
  mints a fresh UUID every call, so dedup-by-`id` would never dedup. When Phase 0
  lands, re-key that dedup on `displayId` (or the natural key). Not an issue for the
  merge-only Patch 1 (ids stay display strings there).

### Phase 3 — Sync path adjustments (Threat) — [Correction] (Patch 2)
The draft's "keeps working unchanged" is only half right. Two different uses of
`threat.id` in `element-sync.ts` / `interaction-sync.ts`:
- **Identity lookups** — `changeMap.get(threat.id)`, `orphanedSet.has(t.id)`. These
  keep working *because the map is also keyed on `threat.id`*; both sides move to the
  UUID together. ✅ (as the draft said, strictly more robust)
- **Drift DETECTION** — the code computes an `expectedId`/`newThreatId` (a *display
  string*, from the element's current `displayId`) and compares it to `threat.id`
  (`if (threat.id !== expectedId) changes.push("id")`). Once `threat.id` is a UUID
  this comparison is **always true → every threat flagged as drifted forever**. It
  MUST be redirected to compare against `threat.displayId`. Likewise
  `applyChangedReferences` (`id: change.newId` → `displayId: change.newDisplayId`) and
  the "Update Threat IDs" pass in `synchronizeThreats` must assign the regenerated
  label to `threat.displayId`, **not** `threat.id`.
  - Concrete sites: `element-sync.ts` `checkSyncStatus` (`expectedId` for DataFlow +
    normal/interface), `applyChangedReferences`, `synchronizeThreats` "Update Threat
    IDs" block; mirror in `interaction-sync.ts`.
- `apply-dfd-change-sync.ts`: no logic change expected, flows through the updated
  methods.

### Phase 3b — Serialization — [Correction] no change needed (Patch 2)
`prepare-for-disk.ts` does **not** touch threat fields (it strips signing config,
audit, `dfd.graph`, thumbnails). `Threat.displayId` and the UUID `id` persist
automatically. Nothing to add on the write side.

### Phase 4 — Migration (Threat) — [Correction] versioned, not ad-hoc (Patch 2)
The repo has a real schema-migration pipeline: `CURRENT_SCHEMA_VERSION`
(`src/app/services/schema-version.ts`, currently **4**), `migrate_N_to_N+1` files in
`src/app/services/versions/`, registered in `applyMigrations`
(`migration-service.ts`). The identity change is **structural**, so it should be
**`migrate_4_to_5.ts`** (bump `CURRENT_SCHEMA_VERSION` to 5), modelled on
`migrate_3_to_4.ts` — **not** an idempotent "legacy" migration. It walks
`data.threats.perElementTables[].threats[]` and `…perInteractionTables[].threats[]`,
and for every threat whose `id` is not a UUID: move `id → displayId`, generate a fresh
UUID `id`. Risk/attack-tree repointing rides the **same** `migrate_4_to_5` (they need
the new threat UUIDs in the same pass) or a `_5_to_6` if sequenced separately.

### Phase 5 — UI / lookup layer (Threat) — [Correction] concrete, 5 sites (Patch 2)
Switch **display + sort** from `id` to `displayId`; leave **identity** on `id`.
- Display: `element-threat-table.tsx:356` and `interaction-threat-table.tsx:346`
  (`<ThreatIdCell id={threat.id}>` → `displayId`); `threat-dialog.tsx:478` and `:661`
  (`{currentThreat.id}` / `{threat.id}` → `displayId`).
- Sort: `threat-table-utils.tsx:32` (`a.id.localeCompare(b.id, {numeric})` →
  `displayId`); `element-threat-table.tsx:561` (secondary id sort → `displayId`).
  Numeric sort on a UUID is meaningless, so this matters for row order.
- **Leave on `id` (opaque identity, becomes MORE robust):** `threat-dialog.tsx`
  `findIndex(t => t.id === …)`, `onSave(currentThreat.id, …)`, `onDelete(threat.id)`,
  React `key={threat.id}`, and `threats-tab.tsx`
  `handleOpenEditDialog`/`handleSaveThreat`.
- Also: `use-threat-export-import.ts` should export `displayId` as the human column
  (low priority) and must not choke on the new field on import.

### Phase 6 — Regression test (Threat)
Reproduce the original bug end-to-end:
1. Generate threats for a DFD.
2. Customize a threat: edit `causeDescriptionExtension`, set `relevance`, annotate a
   mitigation's `notes`.
3. Trigger a DFD change that swaps the `displayId` of two elements (not their
   underlying `elementId`).
4. Trigger a **full regeneration** (not just sync) — the path that previously lost
   data.
5. Assert: `id` (UUID) unchanged, `displayId` updated to reflect new numbering,
   `causeDescription` + `causeDescriptionExtension` + `relevance` + mitigation `notes`
   all preserved, `linkedAssetIds` freshly recomputed, mitigation
   `alreadyImplemented` flags freshly recomputed from current element properties.
- **Note:** `src/tests/component/renumber-roundtrip.test.ts` currently encodes the
  *old* contract (after `P-1`→`P-2` renumber, `threat.id` `P1-S-1`→`P2-S-1`). Under
  Strategy A this becomes the regression test and must be rewritten to assert `id`
  (UUID) stable / `displayId` updated. Patch 1 leaves it green as-is (ids still move).

### Phase 7 — Risk identity fix (Patch 3, scoped)
Pending Open Questions 4–5 (deep review). Expected shape:
- `Risk.id`: independent UUID, `generateRiskId()` retired as a storage-key generator.
- `Risk.threatId`: repointed to resolve against `Threat.id` (UUID) — requires Phase 0
  first; the `extractThreatReferences` bridge already exposes the UUID (§1a).
- Display label "R-EE1-S-1": computed at render time from the live threat's
  `displayId`, never persisted.
- Migration: `migrateRiskIdentity`, run **after** the threat migration (needs the
  threat's new UUID to exist to repoint `threatId`). For existing risks only.
- Needs a merge/reconciliation pass analogous to Phase 1/2 if "Generate Risks" turns
  out to be as unguarded as the Threat generator was (Open Question 4).
- Separate, lower-priority follow-up: the "Risk copies threat fields once, then goes
  stale" issue (§1a) — likely a `risk-sync-service.ts` change (Open Question 5).

### Phase 8 — Attack-Tree identity fix (Patch 4, scoped)
Pending Open Questions 6–8 (deep review). Expected shape:
- `AttackTreeAnchor.threatId`/`.riskId`: repointed to the stable UUIDs, migration
  analogous to Phase 4/7, run after both Threat and Risk migrations.
- Local `ThreatReference`/`RiskReference` copies in `attacktree-types.ts`: add
  `displayId` alongside `id` so the attack-tree UI can keep showing the short label
  while resolving identity via `id`.
- `AttackTreeNode.threatRef` (DSL-embedded reference): investigate feasibility of a
  real fix once the parser is read; may end up documented as a known limitation.
- Verify (or fix) `attacktree-threat-generator.ts` to use the shared
  `createEmptyThreat()`/merge machinery from Phase 1/2.
- No fix needed for `AttackPath.pathKey` — already correct, cited as precedent.

---

## 5. Files Reviewed

**Threat feature:**
- `threat-types.ts` — core `Threat`/`ThreatTable`/`ThreatProjectData` model
- `per-element-types.ts` — STRIDE-per-element ID generation, `ElementChange`
- `per-interaction-types.ts` — STRIDE-per-interaction ID generation, `DataFlowChange`
- `strategy-types.ts` — `IGeneratorStrategy`, `GenerationModules`
- `element-generator.ts` — full per-element generation pipeline (confirmed root cause)
- `element-sync.ts` — `checkSyncStatus`/`applyChangedReferences`/`synchronizeThreats` (confirmed already-correct sync path; drift-detection redirect needed under Strategy A — Phase 3)
- `interaction-generator.ts` — per-interaction generation (+ found the `[DEBUG]` leak, §3b-ii)
- `interaction-sync.ts` — `synchronizeThreats` (confirmed additive/safe "missing" path)
- `sync-threats-with-graph.ts` — orchestration entry point
- `apply-dfd-change-sync.ts` — per-DFD-change re-sync wrapper
- `threat-service.ts` — base `ThreatService` interface
- `element-threat-service.ts` / `interaction-threat-service.ts` — concrete services (call `generator.generateThreatsForProject` with no merge — now covered by Patch 1's post-pass)
- `use-element-threats.ts` — `generateThreats` (found wholesale `setTables` replace, §3b-i)
- `implemented-controls-mapper.ts` — close-loop mechanism (informs Phase 1 merge design)
- UI: `element-threat-table.tsx`, `interaction-threat-table.tsx`, `threat-table-utils.tsx`, `threat-dialog.tsx`, `threats-tab.tsx` (Phase 5 sites catalogued)
- Migration infra: `schema-version.ts`, `migration-service.ts`, `versions/migrate-3-to-4.ts` (model for `migrate_4_to_5`); `prepare-for-disk.ts` (no change needed)

**Risk feature:**
- `risk-assessment-types.ts` — `Risk`/`RiskData`, `generateRiskId`, `createEmptyRisk`, `migrateRiskData` (confirmed identity coupling)
- `risk-config-types.ts`, `risk-factor-types.ts`, `risk-scale-types.ts`, `risk-mitigation-types.ts`, `risk-integration-types.ts` — see original notes; ticket links live on `SelectedMitigation` inside `Risk`, at risk transitively via `Risk.id`
- `shared/models/threat-reference-types.ts` + `workspace-layout.tsx` `extractThreatReferences` — the Threat→Risk bridge (confirmed `Threat.id` passthrough)

**Attack-Tree feature:**
- `attacktree-types.ts` — `ThreatReference`/`RiskReference` copies, `AttackTreeAnchor`, `AttackTreeNode`, `AttackPath`/`pathKey` precedent, DSL-generation functions (all three coupling points confirmed, §1b)
- `attacktree-feasibility-types.ts` — feasibility scoring (no identity coupling)

## 6. Files still to deep-review for later patches

All are present in the repo; listed here as the reading queue for Patches 3–4, not as
blockers:
- **Risk (Patch 3):** risk generation entry point (`risk-generation-service.ts` or
  equivalent), `risk-sync-service.ts`.
- **Attack-Tree (Patch 4):** `attacktree-threat-generator.ts`, the DSL parser/service
  resolving `AttackTreeNode.threatRef`, and whatever handles re-anchoring/sync when a
  tree's underlying threat or risk changes.
