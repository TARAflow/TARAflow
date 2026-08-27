# TARAflow — Threat Identity Fix: Handoff Document

**Status:** Planning complete, ready for implementation. No code has been written yet.

Paste this whole document into a new chat along with the relevant source files
(see "Files needed" at the bottom) to resume work.

---

## 1. The Bug

**Symptom:** Analyst edits to a threat (custom `causeDescription`, `linkedAssetIds`,
`relevance` rating, etc.) are silently lost whenever threats are regenerated after
a DFD element gets renumbered (e.g. `EE-1` ↔ `EE-2` swap after adding/removing an
element). In the reported case, ~470 threat records were affected by a single
renumbering event.

**Root cause (confirmed by code review):** A threat's only identifier is `id`
(e.g. `EE1-S-1`), which is *derived from* the element's current `displayId`. The
full regeneration path (`ElementThreatGenerator.generateThreatsForProject()` /
`createThreatForElement()`, and the analogous `InteractionThreatGenerator`) has
**no lookup against existing threats at all** — it builds every threat from
scratch via `createEmptyThreat()` on every call. There is no natural-key match
against `(elementId, strideCategory)`, so a full regeneration always produces a
brand-new set of threat objects.

**Important nuance vs. the original bug report:** The "silent sync" path
(`checkSyncStatus` / `applyChangedReferences` in `element-sync.ts` /
`interaction-sync.ts`) is **already correct**. It matches existing threats by
`linkedElement.elementId` (stable UUID) against the current graph and does a
non-destructive `{...threat, id: newId, ...}` update, preserving all
analyst-owned fields. The actual data-loss only happens when a **full
regeneration** is triggered (e.g. a "Regenerate Threats" action calling
`generateThreatsForProject()`), which bypasses this safe path entirely.

**Non-goals (per original bug report):**
- Do not change which STRIDE templates apply to which element/flow types.
- Do not change the visible display-ID format (`EE1-S-1` etc.) — it should keep
  updating on renumber, that's expected. Only loss of analyst content is the bug.

---

## 2. Decisions Made So Far

| Topic | Decision |
|---|---|
| Identity field naming | `Threat.id` becomes the stable UUID (generated once, never changes). `Threat.displayId` becomes the human-readable, regenerable label (`EE1-S-1` etc.) — mirrors the existing `DFDElementReference` pattern (`element.id` = UUID, `element.displayId` = "EE-1"), so it's immediately familiar to developers. |
| Natural key — per-element | `(linkedElement.elementId, strideCategory)`. Deliberately **excludes** `templateId` — `sequenceNumber` is currently always `1`, and a template swap for the same slot (e.g. due to a property change) is the same conceptual threat, not a new one. |
| Natural key — per-interaction | `(dataFlow.connectionId, strideCategory, interactionContext.direction)`. `direction` is required because sender and receiver perspectives produce two independent threats for the same connection. |
| `causeDescription` | Analysts can **extend** it but the original catalog text must be preserved. New field `causeDescriptionExtension?: string` added — purely analyst-owned, generator never writes to it. On natural-key match, `causeDescription` itself is always kept verbatim (never re-pulled from the template); only set fresh when a threat is genuinely new. |
| `linkedAssetIds` | **Not** analyst-editable (confirmed) — shown in the threat dialog for information only, sourced from the element↔asset linkage. Always recomputed from the current graph/asset index on regeneration. No merge needed. |
| `proposedMitigations` / `proposedVerifications` | Must **not** be frozen — `alreadyImplemented` / `implementedByProperty` / `implementedByValue` depend on the live DFD model state (close-loop drift detection) and must always be recomputed. Only the analyst's free-text `notes` on catalog entries, and any fully custom (no-`id`) entries, must be preserved across regeneration. See merge algorithm in section 4. |
| `threatActor` | Always preserved — generator never actively sets it after initial creation, but a full regen via `createEmptyThreat` would otherwise reset it to `"external"`. |
| `linkedElement`, `dataFlow`, `trustBoundary*` | Always recomputed from the current graph (source of truth). |
| `relevance`, `workflowStatus`, `evalNote` | Always preserved. |
| `initialImpact`, `source`, `templateId` | Always recomputed (system/strategy-derived). |

### Known, deliberately out-of-scope limitation
If an analyst actively **removes** a catalog-suggested mitigation/verification
entry (because it doesn't apply), it will reappear on the next regeneration if
the template still suggests it — there's currently no tombstone/suppression
field. Flagged as a possible follow-up (`suppressedMitigationIds?: string[]`),
**not** part of this fix unless the user says otherwise.

---

## 3. Open Questions (need answer before/during implementation)

1. **Function renaming:** Should `generateThreatIdPerElement`,
   `generateThreatIdForInterface`, `generateThreatIdPerInteraction` (and
   `ElementChange.newId`) be renamed to `generateDisplayId...` / `newDisplayId`
   for clarity, or keep the old names to minimize diff size? — **awaiting
   user decision.**
2. **UI/lookup files not yet reviewed:** need the Threat table component,
   Threat Eval dialog, and export/report generation code to plan the
   `id` (now UUID) vs `displayId` (now display string) switch in the UI layer —
   **files requested from user, not yet received.**

---

## 4. Implementation Phases

### Phase 0 — Data model
- `threat-types.ts`: rename `Threat.id` → keep as UUID identity; add
  `Threat.displayId: string`; add `Threat.causeDescriptionExtension?: string`.
- `createEmptyThreat()`: generate the UUID internally (`crypto.randomUUID()`)
  instead of requiring callers to pass one in.
- Update `ElementChange.newId` → `newDisplayId` in `per-element-types.ts`, and
  the equivalent in `per-interaction-types.ts` (`DataFlowChange`).

### Phase 1 — Shared merge utility
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

### Phase 2 — Generator changes
- `element-generator.ts`: `generateThreatsForProject()` builds the index from
  `project.threats?.perElementTables` up front and threads it through to
  `createThreatForElement()`, which calls `mergeGeneratedThreat()` instead of
  returning the freshly-created threat directly. `generateThreatsForSingleElement()`
  accepts an optional index parameter (default empty) for the sync add-path.
- `interaction-generator.ts`: same pattern with `buildInteractionThreatIndex`.

### Phase 3 — Sync path adjustments
- `element-sync.ts` / `interaction-sync.ts`: matching logic that currently keys
  on `threat.id` (`changeMap.get(threat.id)`, `orphanedSet.has(t.id)`) keeps
  working unchanged — it now matches on the UUID instead of the display string,
  which is strictly more robust. Assignment sites that currently do
  `{...threat, id: newThreatId, ...}` switch to `displayId: newDisplayId`.
- `apply-dfd-change-sync.ts`: no logic change expected, just flows through the
  updated `ElementThreatSync`/`InteractionThreatSync` methods.

### Phase 4 — Migration
New `migrateThreatIdentity(threatData: ThreatData): ThreatData`, modeled on the
existing `migrateAssetConfiguration` pattern, called on project load. For every
threat in `perElementTables` / `perInteractionTables` without a valid UUID `id`
(i.e. loaded from a pre-fix `.tara.json`), moves the old `id` value into
`displayId` and generates a fresh UUID for `id`. Idempotent.

### Phase 5 — UI / lookup layer
Blocked on receiving the relevant files (see Open Question 2). Expected scope:
Threat table row keys, Threat Eval dialog's "which threat is being edited"
reference, export/report generation, possibly undo/redo references — switch
stable-identity usages from `id`(old, display string) to `id`(new, UUID), keep
displaying `displayId`.

### Phase 6 — Regression test
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

---

## 5. Files Already Reviewed

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

## 6. Files Still Needed

- Threat table UI component (whatever renders `perElementTables`/`perInteractionTables` as rows)
- Threat Eval dialog component
- Export / report generation code that references `threat.id`
- `element-threat-service.ts` / `interaction-threat-service.ts` (the concrete
  `ThreatService` implementations — referenced in the original bug report but
  not yet uploaded; `element-generator.ts`/`element-sync.ts` were provided
  instead, which cover the actual logic, but the service-layer wiring hasn't
  been seen)
