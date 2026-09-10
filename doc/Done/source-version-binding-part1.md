# Source Version Binding — Done (project-level scope)

**Status: shipped** on `feature/source-version-binding`.
Covers the *project-level* source binding through Phase 3. The element-level
scope (§3.5) and Phases 4–6 remain open — see
`source-version-binding-OPEN.md`.

Goal and motivation are unchanged from the original plan (§1): version-exact
traceability of a TARA to the source it was performed against, supporting
EN 50742 §7.5 / §8.4 ("identification of software"), with drift detection for
on-prem/offline Git hosts.

## What shipped

| Phase | Deliverable | Commit(s) |
|---|---|---|
| 0 | Audit-findings reuse decision (no overlap; reuse credential + Finding patterns) | — |
| 1 | Data model (`SourceBinding`, `DriftStatus`, `DriftEvent`) + static entry UI, remote-URL-only persistence — **project scope only** | `8af6096` |
| 1-fix | Persist project-level bindings from the Overview tab (the read/write wiring gap) | `a24ba70` |
| 2 | Remote-first commit resolution via `git ls-remote`, consent-gated network access | `77d5844` |
| 3 | Drift detection (6 states incl. `unreachable`) + transition-only `DriftEvent` logging + Finding/severity catalogue | `a79efb7` |
| 3 | Drift wired into the UI, core hardening, i18n, es2022 | `bd64196` |

The project-level story is now usable end to end: enter a repo + ref on the
Overview tab, resolve it to a pinned commit SHA (consent-gated), check for
drift on demand, and keep a bounded, append-only record of every drift
transition — with unreachable on-prem hosts handled as their own state.

## As-shipped decisions / divergences from the original plan

- **Consent-denied / engine-unavailable are never recorded.** A declined
  network-consent prompt (or the git bridge missing in a non-Electron build)
  is *not* written to `driftEvents` as `unreachable` — that would conflate
  "chose not to check" with "host was down" (§3.2 keeps these distinct). Only a
  genuine `ls-remote` failure records `unreachable`. `checkAndRecordDrift`
  returns a discriminated `DriftCheckOutcome` (`ran:true …` | `ran:false,
  reason`); the service flags the two did-not-run cases with stable error codes
  (`consent_denied`, `engine_unavailable`).
- **Drift severities follow §7, applied early.** All non-clean drift statuses
  are `warning`, an expected release-branch advance is `info`; `error` is
  reserved for the Phase-4 "no `resolvedCommitSha`" condition. Kept so the
  Finding severity and the (future) §7 validation nudge stay in sync.
- **`currentDriftStatus` is never persisted.** It's a live value recomputed on
  demand; `prepareForDisk` strips it per project-level binding while keeping the
  append-only `driftEvents` log, so a drift check never churns the `.tara.json`.
  The live badge is session state only.
- **es2022.** `target`/`lib` bumped to es2022 in both `tsconfig.json` and
  `tsconfig.electron.json`, with `useDefineForClassFields: false` pinned so
  class-field emit for the ~40 existing service classes is unchanged (the bump
  is lib/syntax only — e.g. `Array.prototype.at`). Flipping class-field
  semantics is a separate, test-gated migration if ever wanted.
- **i18n.** `sourceBinding.*` and `sourceBinding.drift.*` namespaces added
  (en + de); history count uses `{{n}}` to avoid i18next plural resolution.

## Ready but not yet consumed

- `driftFindingFor()` / `DriftFinding` (the DriftEvent → Finding mapping,
  §6.2) are implemented and unit-tested but have no consumer yet — they await
  the drift/validation panel, which is part of Phase 4. Harmless as exported
  symbols; listed here so it's not mistaken for dead code.

## Tests

Drift status/transition/severity units; `checkAndRecordDrift` orchestration
(consent/engine → no record, genuine unreachable → record); the
`currentDriftStatus` disk strip + `driftEvents` retention; section component
tests (transition persists, clean no-persist, consent → no record); the
project-level persistence round-trip. Build + full suite green.
