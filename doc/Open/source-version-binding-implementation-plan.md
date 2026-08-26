# Source Version Binding — Implementation Plan

## 1. Goal

Close the gap between "this TARAflow analysis references a known
implementation state" and "this analysis can be traced to the software
actually deployed on the machine". This is deliberately worded more
narrowly than an earlier draft ("matches what is actually deployed") —
Phases 1–4 establish source-state traceability only. Even Phase 5 (build
provenance, §8) only gets to "this source commit is traceably linked to a
specific build artifact" — it does **not** by itself confirm that artifact
is what's currently running on a specific physical unit. That last step
would need a runtime identification/verification query against the machine
itself (the mechanism EN 50742 §7.5/§8.4 actually describes — "available on
demand" from the device) and is out of scope for this plan; Source Version
Binding closes the source-state part of the chain, not the full
deployment-verification part.

Concretely:

- Let the analyst attach one or more source-repository references (branch,
  release branch, tag, or commit) as an **optional documentation reference**
  — not a modelled relation with threat-generation semantics. Two
  independent, non-inheriting scopes, both using the same `SourceBinding`
  shape (§3.5):
  - **Element-level**: attached to a specific Function/Process/System Asset
    that represents a known implementation — an *implementation reference*
    ("this System Asset is implemented by repo Y").
  - **Project-level**: attached to the project as a whole, for cases where
    the entire analysed system corresponds to one repository/release and
    per-element binding would be redundant — an *analysis/evidence
    reference* ("this TARA was performed against repo X, release Y"),
    deliberately **not** implied to apply to every element automatically.
- Persist the **remote** repo URL only — never a local filesystem path — so
  the binding stays valid and portable regardless of who opens the project
  file or on which machine. A local checkout may be used as an input
  convenience, cached machine-locally, never written into the project file.
- Pin every ref to an immutable commit SHA at link time, not just a mutable
  tag/branch label. Always store both.
- Detect drift on demand, with explicit, disclosed network access — never a
  silent background call: has the referenced state moved since the binding
  was made? Distinguish *expected* movement (a release branch advancing)
  from *unexpected* movement (a tag pointing to a different commit than
  recorded), from a *broken* reference (ref no longer exists in a reachable
  repo), from an *unreachable* repo (network/VPN/firewall — relevant for
  on-prem Git hosts).
- **Document every drift transition for traceability**, using the same
  Finding/severity architecture the Audit Verification Engine already has,
  not a bespoke UI — and log on *state change*, not on every check, to stay
  within the project file's size budget.
- Eventually bridge from "source commit" to "build artifact that is actually
  flashed onto the machine" (build provenance), and freeze the resolved
  values into the exported Technical File report so the binding survives
  repo migrations/deletions over the 10-year MVO retention period.

This directly supports EN 50742 §7.5 / §8.4 ("Identification of software
versions and configuration... available on demand, human readable form") and
MVO Anhang III 1.1.9 ("Maschine muss die installierte Software... kenntlich
machen").

## 2. Phase 0 — audit findings (resolved)

`project-types.ts` reserves `audit: AuditData | null // Git/Version Control`.
Having now read `audit-types.ts`, `git-types.ts`, and the Audit tab
components, this is **fully resolved**: `AuditData` models the TARA
project's *own* audit-trail repository — where changes to the TARA document
itself get committed, signed, and verified for tamper-evidence (config,
signing, `commitHistory`, the Audit Verification Engine). It has **no
overlap** with Source Version Binding, which tracks *external* implementation
repositories the analysed system is built from. Decision: **new, separate
types**, not an extension of `AuditData`.

That said, three things from the audit feature should be reused directly
rather than reinvented:

1. **Credential pattern.** `GitAuthConfig` already solves "store a PAT/SSH
   key without putting it in the project file":
   ```ts
   export interface GitAuthConfig {
     method: AuthMethod; // "pat" | "ssh"
     patAccount?: string; // Account identifier for Keytar
     sshKeyPath?: string;
   }
   ```
   This exists **twice already** (Audit + Integration/Jira), confirmed by
   the team. Source Binding should be the third consumer of the same
   pattern, not a fourth bespoke credential store — see §3.4.

2. **Finding/severity UI architecture.** `audit-verify-panel.tsx` +
   `useAuditVerify` already implement exactly the shape drift reporting
   needs: a `Finding { id, severity: "error"|"warning"|"info", commit? }`
   type, an `explainFinding(id, t)` mapping IDs to human title+hint, and a
   panel that groups findings by severity with a plain-language verdict up
   top and technical detail collapsed. Drift Detection (§6) reuses this
   verbatim instead of inventing new badge/alert patterns.

3. **`GitOperationResult<T>`** from `git-types.ts` — the existing wrapper
   (`{ success, data?, error?, warnings? }`) for IPC git calls. Any new IPC
   handler for resolving refs should return this same shape for consistency.

`GIT_PROVIDERS` (github/gitlab/bitbucket/generic) is also reusable if a
provider hint is wanted on a `SourceBinding` later, but is not required for
v1.

## 3. Data model

### 3.1 Design decision: reference field, not a modelled relation

`taraflow-asset-beziehungen.md` already has the right pattern for linking to
an external system-of-record without pulling it into the STRIDE/threat graph:

```ts
interface ExternalSafetyRef {
  id: string;        // e.g. "SF-001" from the external safety analysis
  standard: string;
  document?: string;
  rationale?: string;
}

interface FunctionAssetProperties {
  isSafetyFunction?: boolean;
  externalRefs?: ExternalSafetyRef[];
}
```

`SourceBinding` follows the same shape and rule: not a `uses`/`depends_on`
relation, no threat-derivation participation, not mandatory anywhere. A
Function Asset modelled at blackbox level legitimately has *no* binding —
that's the normal case, not a gap. Where the implementation *is* known
(Process Asset, System Asset, or a Function Asset with `implements`),
`SourceBinding[]` can optionally be attached.

### 3.2 Types

```ts
// features/source-binding/models/source-binding-types.ts
// New feature, deliberately separate from features/audit — see §2.

/** How the ref was specified. "release_branch" is distinct from "branch":
 * expected to keep advancing (backported fixes) — its drift reads as
 * informational, not a warning, unlike a regular branch moving on. */
export type SourceRefType = "branch" | "release_branch" | "tag" | "commit";

export interface SourceBinding {
  id: string;
  /** ALWAYS the remote URL (https or git@), never a local path. This is
   * what makes the binding portable across machines and analysts — see
   * §3.3 for where the optional local-checkout convenience lives instead. */
  repoUrl: string;
  refType: SourceRefType;
  /** Human-entered label, e.g. "main", "release/2.x", "v2.3.1". Mutable —
   * never treat this alone as proof of a specific state. */
  refLabel: string;
  /** Immutable pin, resolved from refLabel at binding time. This is what
   * gets cited in the compliance report — refLabel is display-only. */
  resolvedCommitSha?: string;
  resolvedAt?: string; // ISO timestamp of the last successful resolution
  /** Optional build provenance, added once CI integration exists (Phase 5). */
  buildArtifactHash?: string;
  buildRecordUrl?: string;
  /** Live-computed, not persisted as truth — recomputed on demand. The
   * persisted, audit-relevant record is `driftEvents` below. */
  currentDriftStatus?: DriftStatus;
  /** Log of every OBSERVED STATE TRANSITION (not every check — see §6.3).
   * Append-only. This is the traceability record. */
  driftEvents: DriftEvent[];
  /** Optional credential reference for private repos — see §3.4. Absent
   * for public repos. */
  credentialRef?: CredentialRef;
}

/** Six possible outcomes of comparing recorded vs. current state.
 * "unreachable" is distinct from "ref_missing": the repo/host could not be
 * contacted at all (network, VPN, firewall, DNS — the common case for
 * on-prem Git servers) vs. the repo WAS reached but the specific ref no
 * longer exists there. Conflating these would hide genuine connectivity
 * problems behind a "your tag was deleted" message, and vice versa. */
export type DriftStatus =
  | "clean"                    // current commit matches resolvedCommitSha
  | "branch_advanced"          // refType "branch": moved on — TARA out of sync
  | "branch_advanced_expected" // refType "release_branch": moved on — expected
  | "tag_moved"                // refType "tag": points to a DIFFERENT commit
                                // than recorded. More severe than staleness —
                                // an integrity signal, not just an age signal.
  | "ref_missing"               // repo reached, but ref no longer resolves there
  | "unreachable";              // could not contact the repo/host at all

/** One documented state TRANSITION. Persisted, append-only — see §6.3 for
 * why this logs on transition rather than on every check. */
export interface DriftEvent {
  id: string;
  bindingId: string;
  detectedAt: string; // ISO timestamp
  status: Exclude<DriftStatus, "clean">;
  previousStatus: DriftStatus; // what it was before this transition
  previousResolvedCommitSha: string;
  /** Absent for "ref_missing" and "unreachable" — nothing to compare. */
  currentCommitSha?: string;
  /** Optional analyst note, e.g. "release branch fast-forwarded with an
   * approved security patch, re-reviewed 2026-03-02". Not required to
   * create the event. */
  note?: string;
}
```

### 3.3 Local-checkout convenience — explicitly NOT part of the project file

Per the requirement that only the remote URL is persisted:

```ts
// Machine-local only. Electron: userData / a local SQLite/JSON side-store,
// keyed by (projectId, bindingId) — NEVER serialized into the .tara.json
// project file, and never synced or exported.
interface LocalCheckoutHint {
  bindingId: string;
  localPath: string;
}
```

Workflow: the analyst can point the "Repo URL" field at a local working
copy; the tool runs `git remote get-url origin` there once to **prefill**
`SourceBinding.repoUrl` with the discovered remote, and may cache the local
path in `LocalCheckoutHint` purely as a machine-local shortcut (faster,
offline-capable `git rev-parse` instead of `git ls-remote` on that machine
only). If the project file is opened on a different machine, or by a
different analyst, the hint is simply absent and resolution falls back to
the remote-only path — this is expected, not an error state.

This also answers the mono-repo/multi-repo/TARA-in-its-own-repo question
implicitly: none of that matters, because every binding is independently
keyed by an explicit remote URL, regardless of where the TARAflow project
file itself happens to live.

### 3.4 Credential handling — reuse the existing pattern, third consumer

```ts
/** Deliberately shaped like AuditConfig.auth (GitAuthConfig) — same
 * mechanism, same Keytar-backed storage, just a third feature using it
 * (after Audit and Integration/Jira). No new secret-storage design needed. */
export interface CredentialRef {
  method: "pat" | "ssh";
  /** Keytar account identifier — ideally keyed by host (e.g.
   * "github.com", "gitlab.internal.example.com") so a token entered once
   * for a host is reusable across every SourceBinding pointing at that
   * host, rather than re-prompting per binding. */
  account?: string;
  sshKeyPath?: string;
}
```

Recommendation worth raising with whoever owns Audit + Integration: since
this credential shape now exists in three places, consider extracting one
shared `features/credentials` module (Keytar wrapper + a small "credential
picker" UI) that all three features consume, keyed by host — rather than
three parallel implementations of the same Keytar calls. Not a blocker for
this feature; can ship with its own instance of the pattern first and be
refactored to share later.

### 3.5 Where the binding gets attached — two independent scopes

Same `SourceBinding` type (§3.2), two separate collections, deliberately
**not** unified via a `scope` field on the type itself — the storage
location already determines the scope unambiguously, and a redundant field
risks drifting out of sync with where the object actually lives.

**Element-level** — add `sourceBindings?: SourceBinding[]` to:

- `FunctionAssetProperties`
- `ProcessAssetProperties`
- `SystemAssetProperties`

Not on `Data`, `Physical`, `Infrastructure`, `Service`, `Human` — those
don't represent "code that runs" (mirrors the `CIANAAA_APPLICABLE`-style
category filtering already used elsewhere in the model for the same reason).

**Project-level** — add `sourceBindings?: SourceBinding[]` at the project
root (e.g. on the `Project` interface in `project-types.ts`, or wherever
`GeneralTabData` is ultimately backed):

```ts
interface Project {
  // ...
  sourceBindings?: SourceBinding[]; // project-wide analysis/evidence references
}
```

**No inheritance between the two.** An element with no `sourceBindings` of
its own does **not** implicitly pick up the project-level bindings — the
two stay semantically distinct (implementation reference vs. analysis
evidence reference) precisely so a report can state which is which without
ambiguity about whether a given element "has" a binding through some
fallback rule. If an analyst wants an element to be traceable, they bind it
explicitly at that element.

## 4. UI — Phase 1: static entry, no resolution yet

- New component `SourceBindingsSection`, structurally mirroring
  `ProjectInfo`/`ProjectSettings` (card layout, edit/display toggle,
  `useTranslation` pattern). Reused for **both** scopes (§3.5) with a label
  prop distinguishing "Implementation source reference" (element-level) from
  "Project source reference" (project-level) — same component, same fields,
  different heading/copy so the analyst always sees which kind they're
  editing.
- Element-level: attach wherever the analyst edits a Function/Process/System
  Asset's properties — same place `externalRefs` would be edited.
- Project-level: attach as its own section in `GeneralTab` (e.g. after
  `ProjectSettings`), since it's a project-wide statement, not tied to any
  one element's edit view.
- Fields per row: repo URL (text input, with an optional "detect from local
  checkout…" affordance per §3.3), ref type (select:
  branch/release_branch/tag/commit), ref label (text input). No resolution,
  no drift check yet.
- Follow the `WindowOfOpportunitySelector` pattern for tooltip-documented
  fields (why `refLabel` alone isn't sufficient, why `release_branch` is
  distinct from `branch`).

Acceptance: analyst can record "this Process Asset ↔ remote repo Y @ tag Z"
and it persists with the project file, with no local path ever written to
disk in the project file.

## 5. Phase 2 — Commit resolution (remote-first, consent-gated)

- Primary path, always: `git ls-remote <repoUrl> <ref>` against the
  persisted remote URL — works without any local clone. This is the only
  path that matches what's actually stored (§3.2/3.3), so it's the
  canonical resolution mechanism, not a fallback.
- Secondary, machine-local speed-up only: if a `LocalCheckoutHint` exists
  for this binding on this machine, `git rev-parse <ref>` there instead
  (faster, works offline) — but the result is cross-checked against/still
  ultimately validated the same way; the local shortcut never becomes the
  system of record.
- **Explicit network consent, not a silent call.** Before the first outbound
  `git ls-remote` in a session (or per new host), show a clear notice: *"This
  will make a read-only network request to `<host>` to check the current
  state of this repository. Continue?"* — with a "don't ask again for this
  host in this session" option, not a permanent silent bypass. This matters
  specifically because TARAflow's typical deployment context (OT/machine
  environments) often has strict network policies; the tool must not
  surprise anyone with outbound calls.
- Return shape: `GitOperationResult<{ sha: string }>` (§2), reusing the
  existing wrapper rather than inventing a new result shape.
- On-prem host reachability: surface connectivity **separately** from ref
  resolution — a host that cannot be reached at all (`unreachable`, §3.2)
  must read differently in the UI than "repo reached, ref not found"
  (`ref_missing`). This is the concrete ask behind "on-prem servers must
  show that they are reachable": don't collapse both into one generic
  failure message.
- On failure: surface as a UI error next to the row; never silently leave
  the binding half-resolved.
- IPC handler lives in the Electron main process, alongside the existing
  audit git IPC handlers, following the same "domain-specific file"
  extraction already underway.

## 6. Phase 3 — Drift detection and documentation

### 6.1 Detection logic

```ts
function checkDrift(
  binding: SourceBinding,
  result: GitOperationResult<{ sha: string }>,
): DriftStatus {
  if (binding.refType === "commit") return "clean"; // cannot drift by definition
  if (!result.success) return "unreachable";
  const currentSha = result.data?.sha;
  if (currentSha === undefined) return "ref_missing";
  if (currentSha === binding.resolvedCommitSha) return "clean";
  if (binding.refType === "tag") return "tag_moved";
  if (binding.refType === "release_branch") return "branch_advanced_expected";
  return "branch_advanced";
}
```

- On demand (button), respecting the consent gate from §5. No silent
  periodic background polling in v1 — the network-policy concern raised
  makes "opens a tab and quietly phones home" the wrong default for this
  tool's typical deployment context.
- `tag_moved` and `ref_missing` read as errors (reusing `Finding.severity =
  "error"`); `unreachable` reads as a warning, not an error, since it's
  often transient (VPN not connected right now) rather than a fact about
  the binding itself; `branch_advanced` is a warning; `branch_advanced_expected`
  is informational.

### 6.2 Reuse the existing Finding/severity architecture

Map `DriftStatus` transitions onto the same `Finding` shape
`audit-verify-panel.tsx` already renders, instead of building a parallel UI:

```ts
// Mirrors features/audit/services/verify/findings.ts
interface DriftFinding {
  id: string; // e.g. "source-binding.tag-moved"
  severity: "error" | "warning" | "info";
  commit?: string; // currentCommitSha, when available
}

function driftFindingFor(event: DriftEvent): DriftFinding {
  const severity: Record<DriftEvent["status"], DriftFinding["severity"]> = {
    tag_moved: "error",
    ref_missing: "error",
    unreachable: "warning",
    branch_advanced: "warning",
    branch_advanced_expected: "info",
  };
  return {
    id: `source-binding.${event.status.replace(/_/g, "-")}`,
    severity: severity[event.status],
    commit: event.currentCommitSha,
  };
}
```

Add corresponding entries to the existing `explainFinding`-style mapping so
the plain-language title/hint pattern (`FindingRow` in
`audit-verify-panel.tsx`) renders drift findings identically to Audit
Verification Engine findings — same visual language, same component if
feasible, rather than a bespoke badge design.

### 6.3 Mandatory documentation — log on TRANSITION, not on every check

This is the resolution to the file-size constraint (§9.4 below): with a
1 MB / 2 MB project-file budget, logging a new `DriftEvent` on *every* check
of a long-lived binding (e.g. daily checks over a multi-year project) would
grow unbounded and dominate the file. Instead:

**A `DriftEvent` is appended only when `currentDriftStatus` differs from
the status recorded in the most recent `DriftEvent` for that binding** (or
there is no prior event and the status is non-"clean"). Repeated checks that
keep finding the same already-logged drift do not create new entries —
only genuine transitions do (clean→stale, stale→worse, worse→resolved,
resolved→drifted-again, etc.).

```ts
function recordDriftIfTransitioned(
  binding: SourceBinding,
  newStatus: DriftStatus,
  currentSha: string | undefined,
): SourceBinding {
  const lastLogged = binding.driftEvents.at(-1)?.status ?? "clean";
  binding.currentDriftStatus = newStatus; // always update the live badge

  if (newStatus === "clean" || newStatus === lastLogged) {
    return binding; // no transition — nothing to log
  }

  const event: DriftEvent = {
    id: generateId(),
    bindingId: binding.id,
    detectedAt: new Date().toISOString(),
    status: newStatus,
    previousStatus: lastLogged,
    previousResolvedCommitSha: binding.resolvedCommitSha!,
    currentCommitSha: currentSha,
  };

  return { ...binding, driftEvents: [...binding.driftEvents, event] };
}
```

- `driftEvents` remains append-only — no delete, no edit of existing
  entries. A `note` can be added to an existing event to record a review
  decision, but the event itself is permanent.
- The UI still shows two layers: the live `currentDriftStatus` badge (can
  read "clean" again after a rebind/re-resolve even though history exists)
  and the separate, expandable `driftEvents` history — "is it fine *now*"
  vs. "did something ever happen" stay distinct questions.
- For `refType: "commit"` bindings: no drift possible by definition, no
  drift UI/events apply.

## 7. Phase 4 — Validation integration

```ts
export interface GeneralTabData {
  // ...
  dfdValidation?: ValidationResult;
  sourceBindingsValidation?: ValidationResult; // new
}
```

- **No warning for missing bindings** — a safety-relevant Function/Process/
  System Asset with no `SourceBinding` is a legitimate blackbox case.
- Warning: a binding's latest `driftEvents` entry is `tag_moved`,
  `ref_missing`, or `unreachable` with no `note` — nudges review without
  blocking.
- Error: a binding has no `resolvedCommitSha` at all.
- Neutral, project-level coverage indicator (not a red/yellow per-element
  badge): "N of M safety-relevant elements have a resolved, non-drifted
  source binding."
- Wire into `ProjectProgress` following the existing `validationInfo`
  computation pattern in `general-tab.tsx`.

## 8. Phase 5 — Build provenance (optional, second iteration)

Only after Phases 1–4 are stable. The "source commit ≠ deployed binary" gap
— needs CI integration, not just git:

- Extend with `buildArtifactHash` / `buildRecordUrl` (already in §3.2).
- v1: manual entry (analyst pastes a CI build URL/hash after a release).
- v2: IPC/webhook integration with CI to auto-populate on release build,
  keyed by the same commit SHA.
- Does not block Phases 1–4.

## 9. Phase 6 — Snapshot & freeze for Technical File export

- Satisfies the 10-year retention requirement (MVO Art. 10(3)/11(3)/13(8))
  instead of being a live convenience link.
- On Technical File export, **resolve and inline** the current state of
  every referenced `SourceBinding` — repo URL, ref label, resolved SHA,
  resolution timestamp, build artifact hash if present, **and its full
  `driftEvents` transition history** — as static text, not a live hyperlink.
- Render the two scopes as **separate report sections**, not merged:
  - *"Project source reference"* — the project-level bindings (§3.5), e.g.
    "This TARA was performed against Repository X, release/2.x, commit
    `abc123`."
  - *"Implementation source references"* — the element-level bindings,
    grouped by the element they document, e.g. "Safety Controller —
    Repository Y — tag `v4.2.1` — commit `def456`."
  Keeping them visually and structurally separate in the output mirrors the
  data-model separation and avoids a reader conflating "the analysis was
  based on this state" with "this specific component is implemented by
  this state."
- The transition log is what turns this into actual compliance evidence: it
  lets the report state, provably, whether the cited state was ever found to
  have moved/changed after the fact, and whether that was reviewed.
- Consider a dedicated **snapshot record** at release/CE-marking time (a
  frozen copy of all resolved bindings + drift history to that point),
  separate from the live/editable bindings, so later re-resolution doesn't
  retroactively alter what a specific past report cited.

## 10. Suggested build order (summary)

| Phase | Deliverable | Depends on |
|---|---|---|
| 0 | Audit `AuditData` — **done**: no overlap, reuse credential + Finding patterns | — |
| 1 | Data model + static entry UI, remote-URL-only persistence | 0 |
| 2 | Remote-first commit resolution via IPC, consent-gated network access | 1 |
| 3 | Drift detection (6 states incl. `unreachable`) + transition-based `DriftEvent` logging, reusing Finding/severity UI | 2 |
| 4 | Validation integration (neutral coverage indicator) | 3 |
| 5 | Build provenance (manual, then CI-automated) | 1 (independent of 2–4) |
| 6 | Snapshot/freeze into Technical File export, including drift history | 1, and ideally 2–4 |

Phases 1–4 form the minimum viable version: know which commit an analysis
corresponds to, know if that's drifted (with on-prem/offline hosts handled
explicitly), and keep a bounded, permanent record of every time it did.
Phases 5–6 close deployed-binary provenance and long-term archival and can
ship later without blocking the core feature.

## 11. Open questions — status

All four original open questions are now resolved:

1. **`AuditData` overlap** — none; separate `features/source-binding`
   module, reusing the credential and Finding/severity *patterns* only
   (§2).
2. **Local vs. remote resolution** — remote-first, always
   (`git ls-remote` against a persisted remote URL); local checkout is a
   machine-local, non-persisted convenience only (§3.3, §5). Network access
   is consent-gated with an explicit read-only-access notice, and on-prem
   host reachability is surfaced as its own state (`unreachable`),
   distinct from a genuinely missing ref (§3.2, §5).
3. **Credential handling** — reuse the existing Keytar-backed
   `GitAuthConfig` pattern as a third consumer (`CredentialRef`, §3.4);
   flagged as a good future refactor into a shared `features/credentials`
   module given it now exists three times, but not a blocker for this
   feature.
4. **Retention/size policy** — single project file, ~1–2 MB budget
   confirmed. Addressed by logging `DriftEvent`s on state **transition**
   only, not on every check (§6.3), which keeps the log bounded to actual
   history rather than check frequency. Worth a lightweight monitoring note
   for later: if a binding's status genuinely flaps often (e.g. a very
   active branch checked frequently), re-visit whether transition-only
   logging is still sufficient, or whether a snapshot-then-prune step tied
   to Phase 6 exports is also needed — not expected to be necessary at v1
   scale, but worth keeping in view rather than assuming solved forever.

A fifth point surfaced during review and is now resolved too:

5. **Element-level vs. project-level binding** — both are supported, as two
   independent, non-inheriting collections sharing the same `SourceBinding`
   shape (§3.5): element-level for "this component is implemented by..."
   (implementation reference), project-level for "this TARA was analysed
   against..." (analysis/evidence reference). Kept visually and structurally
   separate through the UI (§4) and the exported report (§9) so the two
   meanings never get conflated.

No blocking open questions remain before Phase 1 starts.
