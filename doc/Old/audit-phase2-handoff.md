# Audit-tab rework — handoff (Phase 2)

_Bridge note for continuing in a fresh chat. Full detail lives in memory
(`/areas/taraflow.md`) and the three spec files below._

## Where it stands
- **Phase 2 walking skeleton is COMMITTED + PUSHED** as `a86a6fb`
  (`feat(audit): repo discovery, canonical serialization & signed commits`),
  on top of tag `v0.7.0-alpha` (543995c). Build + tests green.
- Includes: repo discovery + `setRepoPath` on open, TCS v1 canonical
  serialization (+ single-writer guard), `.gitattributes` guard, GPG/SSH signing
  (default SSH) with the per-commit toggle threaded end-to-end, extracted
  commit-flow + hooks (`useAuditRepo`, `useAuditGit`), real diff vs committed
  HEAD (`audit-prev-state`), `Project:` + canonical git trailers. All pure logic
  unit-tested.

## To CLOSE Phase 2 (two items)
1. **Safe-staging fix (next `fix(audit)` commit).** The incident cause. Scoping
   `stageAll` alone is NOT enough: a plain `git commit` commits the whole index,
   so pre-existing staged files get swept in. The audit commit must be
   **path-scoped**: `git add <relpath>` **and** `git commit -- <relpath>`
   (relpath from `repoRelativePath(repoRoot, filePath)`). Touches
   `git-service-main` (path-aware stage + commit), `audit-commit-flow` (pass
   paths), call sites `audit-tab.handleCommit` + `useAuditGit`. Needs a look at
   `git-service-main.ts` `stageAll`/`commit`.
2. **End-to-end run-test** (not yet done): open a project in a repo → discover →
   signed commit → 2nd commit shows the real diff → `git log --show-signature`.

## NOT Phase-2 gates (optional cleanup)
- Full de-fatten of `audit-tab` (inline `handleCommit` → `useAuditGit`; add
  `useAuditChanges`).
- `validateGitConfig` signing check (safe without it — commit path refuses to
  sign with no key).

## Key decisions (carry forward)
- **Repo-path = HYBRID**: discover the audit repo from the project file
  (`git rev-parse --show-toplevel`); the containing repo IS the audit repo;
  cache root out-of-band per-project in localStorage, never in `.tara.json`.
- **Scoping = JEIN**: multi-project-per-repo allowed; distinguish via `Project:`
  trailer + path-based `git log -- <file>`; NO squash-merge ever.
- **ONE git path**: renderer never runs git; all via IPC → single main
  `GitService`. `git:rawInDir(dir,args)` for arbitrary-dir read checks.
- **ONE serialization writer**: `prepare-for-disk.ts` (guard test).
- Real project file extension is **`.tara.json`** (the specs say `.taraflow` as a
  placeholder — needs fixing in the docs).
- `git-signing.ts` lives in **`electron/services/`** (electron-only consumer);
  its test in `electron/tests/`; `electron` alias added to vite/vitest.

## Design docs (the record; don't re-derive)
`audit-tab-rework-design.md` (rev.4), `TCS-v1.md`, `AVE-v1.md`.
Phases ahead: (3) remote + branch-protection checklist + signer manifest,
(4) Audit Verification Engine + CLI + thin git hooks, (5) audit-report,
(6) reviewer signatures / snapshots / long-term validity.

## Docs to update before/at handoff
- `.taraflow` → `.tara.json` throughout the three specs.
- Record the safe-staging / commit-pathspec decision (§5.C or an implementation
  note).
