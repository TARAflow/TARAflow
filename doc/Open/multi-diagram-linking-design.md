# TARAflow — Multi-Diagram Linking — Design

Status: draft for review · Author: (Juergen)

A low-risk, self-contained convenience feature: let a **process element** link to another
diagram/project so an analyst can navigate a large system spread across several `.tara.json`
files. This is **convenience navigation**, not a hierarchical/leveled DFD model — the "proper"
version is parked (see §8).

It honours existing architecture invariants: additive optional schema field (no migration),
diff-service change detection driving the commit gate, no local paths in the committed
`.tara.json` (audit-cleanliness), and out-of-band caching in `localStorage` (the repo-discovery
hybrid).

## 1. Goal & value

Convenient cross-file navigation for systems modelled across multiple projects. A process that
represents a subsystem detailed elsewhere can point to that project; the analyst opens it from
the project navigation.

## 2. Scope & non-goals

In scope:
- An optional link from a process element to another project.
- Path resolution kept out of the committed file (see §4).
- A project-navigation area to **open** a linked document or **link** a document.
- diff-service awareness so links are committable (see §6).

Non-goals (parked — see §8):
- **DFD leveling/balancing:** carrying over boundary dataflows including numbering, and keeping
  parent boundary flows consistent with the linked child's boundary flows. No easy solution
  across independently versioned files; deliberately out of scope for the convenience version.

## 3. Data model

Additive optional field on `ProcessProperties` → **no migration** (consistent with the
schema-versioning approach):

```ts
interface LinkedProjectRef {
  projectUuid: string;    // target project's metadata UUID — stable identifier
  fileNameHint: string;   // display hint only (e.g. "gateway.tara.json")
}

// ProcessProperties
linkedProject?: LinkedProjectRef;
```

**Key by UUID, not filename.** At link time the target is opened/picked, so its `metadata` UUID
is readable and stored. The filename is a display hint only. This survives renames and avoids
collisions between two linked projects that share a filename.

(One link per process for the convenience version; multiple links are a later extension if a real
need appears — see Decisions to confirm.)

## 4. Audit-trail cleanliness (why filename in file, path in localStorage)

Only `{projectUuid, fileNameHint}` is stored in `.tara.json`. **No absolute path is ever written
to the committed file.** The resolved path lives in `localStorage`, keyed by `projectUuid` — the
same out-of-band hybrid already used for repo discovery.

This is not just convenience: a local path in the committed file is exactly the churn / path-leak
bug class already fought (the key-path leak and the churn fix). It would make the file dirty on
every open on another machine and leak local information into the audit trail. Filename-in-file is
therefore the *correct* choice, not merely the easy one.

Resolution seam (mirrors repo discovery):

```
resolveLinkedProjectPath(projectUuid): string | null   // from localStorage map
setLinkedProjectPath(projectUuid, absPath): void        // on link / re-link
```

Missing or stale path → a "needs re-link" state that triggers the link prompt.

## 5. Navigation UX

A section in the **left project-navigation panel**:

- **Linked diagrams** — lists the project's linked references (from all processes carrying a
  `linkedProject`), each with its `fileNameHint` and resolution status.
- Per linked reference / per selected process:
  - **Open linked document** — resolve path via `localStorage` → open the target `.tara.json`
    (recommended: **new window**; see Decisions to confirm). If unresolved → prompt to locate.
  - **Link a document** — pick a file, read its `metadata` UUID, store `{projectUuid,
    fileNameHint}` on the process and the path in `localStorage`.
  - **Re-link** — for a stale/missing path.

## 6. diff-service integration

A link is **semantic project content**, so adding / removing / changing a `linkedProject` must
make the commit button live — otherwise it silently no-ops, repeating the asset-relations bug
(`compareLinkedElements`). Handle it in the process comparison within `compareDFD` (identity =
`processId`; compare `linkedProject.projectUuid`; the `fileNameHint` is display-only and
**ignored** for change detection, like the display fields in `compareLinkedElements`). Surface it
as a commit-message detail line (`Linked diagram: none → gateway`).

## 7. Implementation phases

**Phase 1 — Data model.** `ProcessProperties.linkedProject?` (additive, no migration). Capture the
target UUID at link time (read target `metadata`).

**Phase 2 — Resolution seam.** `localStorage` UUID→path map + resolve/set/re-link; needs-relink
state. No path in `.tara.json` (guarded by the existing prepare-for-disk / single-writer
discipline).

**Phase 3 — Navigation panel.** "Linked diagrams" section + per-process link/open/re-link actions;
open in a new window; missing-path prompt.

**Phase 4 — diff-service hook.** Committable link changes + commit-message detail.

## 8. The parked "proper" version (leveling / balancing) — recommended future approach

Carrying over boundary dataflows and their numbering is DFD **leveling/balancing**: a process's
boundary flows must correspond to the linked child diagram's boundary flows. The hard part is not
the numbering — it is that the linked document is a **separate, independently versioned file** with
no shared transaction, so consistency can never be guaranteed at any instant. **Copied state across
independently edited files always drifts** (the same reason mitigation status is not duplicated
across risks).

If balancing is ever wanted, do **not** copy/sync. Do it as a **soft, non-blocking cross-check** —
the same Option-C pattern already chosen for safety-feasibility coupling: when *both* files are
loadable, compare the linking process's boundary flows against the linked diagram's boundary flows
and raise a **finding** on mismatch. Never auto-derive, never block. This keeps the convenience
version as the base and makes balancing an optional validation layer on top, instead of a coupling
that cannot be kept consistent.

## 9. Testing

- Unit: `linkedProject` add/remove/change is detected by the diff-service (and the
  `fileNameHint`-only change is a no-op); additive field survives serialization round-trip with no
  path leakage.
- Unit: UUID-keyed resolution (hit / miss / stale → needs-relink).
- Manual/UI: link → open (new window) → rename target → re-link flow.

## 10. Decisions to confirm

1. **Open behaviour:** open the linked document in a **new window** *(recommended)* or replace the
   current project view?
2. **Link cardinality:** one link per process for now *(recommended)*, or allow several from the
   start?
3. **Panel model:** a global "Linked diagrams" list *(recommended)* in addition to the per-process
   action, or per-process only?
4. **Element scope:** links on process elements only *(as described)*, or should other element
   types be linkable too later?
