# TARAflow — Save-Path Cartography

Derived from `save-paths-report.txt`. This is the ground-truth map of how
`project` state is mutated and persisted. It is the basis for the
consolidation refactor — no code changes before this is agreed.

## The single source of truth

The entire project state lives in **one place**:

```
src/app/hooks/use-project-manager.ts:84   const [projects, setProjects]        = useState<Project[]>([])
src/app/hooks/use-project-manager.ts:85   const [activeProjectId, setActive…] = useState<string | null>(null)
```

Nothing else holds project state. (The Jira/ADO `projects` useStates are
unrelated integration data; dialog form state is local and irrelevant.)

This is a *good* starting position: consolidation does not require inventing a
store — it already exists.

## The intended write channel: `updateProject`

`use-project-manager.ts` exposes `updateProject(patch)`, which merges the patch
into the freshest state **inside** a functional `setProjects((prev) => …)`
updater (line 181). It is explicitly hardened against lost updates
(comments L150–159; regression test `update-project-lost-update.test.ts`).

**Consumers that correctly go through it:**

- `workspace-layout.tsx` — ~14 call sites (phase change, all feature-tab
  `onUpdate` handlers: DFD, assets, threats, risks, hazards, attacktree,
  docs, audit, integration). This is the clean path.
- `project-context.ts` — declares the channel type.
- `project-service.ts` — the service-level `updateProject`.

## The problem: a SECOND write path that bypasses the channel

`src/app/components/layout/project-shell.tsx` calls `setProjects` /
`setActiveProjectId` **directly**, ~14 times, bypassing `updateProject`:

```
project-shell.tsx:110  setProjects((prev) => …)      # open / mark-opened
project-shell.tsx:182  setProjects((prev) => …)
project-shell.tsx:191  setProjects((prev) => …)
project-shell.tsx:225  setProjects((prev) => …)      # close
project-shell.tsx:275  setProjects((prev) => …)
project-shell.tsx:309  setProjects((prev) => prev.filter(…))   # delete
project-shell.tsx:533  setProjects((prev) => [...prev, savedProject])   # new
project-shell.tsx:553  setProjects((prev) => [...prev, result.data!])   # duplicate/import
```

These are lifecycle operations (open, close, delete, duplicate, new, import).
They mutate the SAME `projects` array that `updateProject` merges into — but
through a different door.

### Why this is the root cause

Two independent writers into one `useState` array. Even though each uses a
functional updater, they are not serialized *with respect to each other*:
a lifecycle `setProjects` and an in-flight `updateProject` (fired from a
debounced feature-tab autosave) can interleave, and last-writer-wins on the
array replacement. This is the exact "asset there, then gone" / "edit reverts
after save" class we chased per-symptom.

The per-fix refs (`pendingSaveRef`, `lastCommittedDfdRef`, `activeProjectRef`,
`projectRef`, `projectsRef` — §10, 103 matches) are all local compensations
for the absence of a single serialized writer. They are symptoms, not the cure.

## The three save *regimes* (from the user's mental model)

| Regime | Trigger | Cadence | Path today |
|---|---|---|---|
| DFD autosave | element props, asset create, relations | debounced (500ms) | feature-tab `onUpdate` → `updateProject` ✅ |
| draw.io XML autosave | canvas change (invisible to user) | debounced (1500ms) | `scheduleDrawioSave` → `onUpdate` → `updateProject` ✅ (but stale-base bugs) |
| Assets dialog save | explicit "Save" button | transactional | `onUpdate` → `updateProject` ✅ |
| **Lifecycle** | open/close/delete/new/dup/import | immediate | **`project-shell` → `setProjects` directly ❌** |

The first three already funnel through `updateProject`. Only the **lifecycle**
regime bypasses it. That is the seam to close.

## Persistence endpoints (disk)

Writes reach disk only via `serialiseProject`/`prepareForDisk` →
`project-repository` / `use-project-persistence`. §2 shows these are localized
(no rogue `JSON.stringify(project)` writers — the
`no-raw-project-serialisation` guard already enforces this). Disk layer is
NOT part of the problem.

## Consolidation strategy (proposed — not yet executed)

**Goal:** one serialized writer into `projects`. Everything — feature edits AND
lifecycle — goes through `updateProject` (or a small sibling for
add/remove that shares the same `setProjects` updater discipline).

**Order (each step green before the next):**

1. **Characterization tests first.** Encode the 7 user actions (4 DFD-tab
   autosave + 3 Assets-tab dialog-save) plus the 6 lifecycle ops as tests that
   pin *exactly which slice of `project` changes* per action. Freeze current
   behaviour before touching anything.
2. **Route lifecycle through the channel.** Replace `project-shell`'s direct
   `setProjects` calls with `updateProject` / a shared `addProject` /
   `removeProject` that live in `use-project-manager` and use the same
   functional-updater discipline. Removes the second writer.
3. **Fold draw.io XML into the same channel.** `scheduleDrawioSave` already
   ends at `updateProject`; ensure its base is always the freshest committed
   state (the stale-base bugs), ideally by having it emit a patch the merge
   applies, not a whole-dfd replacement.
4. **Retire the compensating refs** where the single writer makes them
   redundant.

## Open questions before step 1

- **`project-shell.tsx`**: is it the ONLY lifecycle writer, or does
  `use-project-manager` also expose add/remove that lifecycle should use
  instead? (L342, L384, L420 in use-project-manager already do
  `setProjects((prev) => [...prev, …])` — so a create path may already exist
  in the manager; project-shell may be duplicating it.)
- Does any lifecycle op need to be *synchronous* with a subsequent
  `updateProject` (ordering dependency), or are they independent?

---

## UPDATE — manager internals confirmed

### The construction fault: raw setters are part of the public API

`use-project-manager` returns BOTH the hardened channel AND the raw setters:

```
return {
  …
  setActiveProjectId,   // L446  ← raw
  setProjects,          // L448  ← raw  ← this is what project-shell uses to bypass
  updateProject,        // L450  ← hardened channel
}
```

So the bypass isn't rogue code reaching into internals — the manager *hands
out* the raw setter. Closing the seam means **removing `setProjects` from the
returned API** and giving lifecycle ops their own named, hardened methods.

### The manager already owns most lifecycle logic

Encapsulated in the manager (good, keep):

- `loadProjects` (L266) → `setProjects(projectsWithGraph)` — bulk load, fine.
- `handleOpenFromFile` (L353) → `setProjects((prev) => …)` (L384) + `setActiveProjectId` (L390)
- `handleImportFile` (L399) → `setProjects((prev) => [...prev, project])` (L420)
- `saveProject` (L328) → `setProjects((prev) => …)` (L342)
- `switchProject` (L321) → `setActiveProjectId`

So `project-shell`'s ~14 direct calls are **partly duplicating** logic the
manager already encapsulates. The fix is largely *deletion*: route
project-shell to the manager's named methods, add the few that are missing
(close, delete, mark-opened), and stop exporting the raw setters.

### `updateProject` shape (the pattern lifecycle ops should match)

Two `setProjects` per call:
1. **L181** immediate in-memory merge (`commitAssetSync` + `commitProjectSafety`).
2. **L229** post-autosave replacement with the persisted `savedProject`.

Known, documented race tolerance (L197–208): the autosave disk-write recomputes
from `projectsRef.current`, which can lag one render behind on two truly
simultaneous `updateProject` calls. In-memory state is always correct; only the
one extra immediate disk-write can lag, and the next autosave/manual save
corrects it. This is the acceptable residual — lifecycle ops should adopt the
same discipline, not invent a different one.

## Concrete step-2 plan (route lifecycle through the channel)

1. Add named lifecycle methods to `use-project-manager` where missing:
   `closeProject(id)`, `deleteProject(id)`, `markProjectOpened(id)`,
   `duplicateProject(id)`, `addProject(project)` — each using the same
   functional-`setProjects` discipline as `updateProject`/`handleImportFile`.
2. Replace every direct `setProjects`/`setActiveProjectId` in
   `project-shell.tsx` with a call to the corresponding manager method.
3. Stop returning `setProjects` from the manager (and `setActiveProjectId`
   unless a genuine external need remains — `switchProject` already wraps it).
   Removing them from the return type makes a future bypass a compile error.
4. Characterization tests FIRST so this deletion is provably
   behaviour-preserving.

### Still to confirm against project-shell.tsx

- Which of the ~14 direct calls map to an existing manager method vs. need a
  new one.
- Whether any project-shell call does something the manager method does NOT
  (e.g. extra `setActiveProjectId` sequencing) — those are the risky ones.
