# Source Version Binding — Open (element scope + Phases 4–6)

**Status: deferred.** The project-level scope through Phase 3 has shipped — see
`source-version-binding-DONE.md`. What remains here is the *element-level*
scope (§3.5) and Phases 4–6.

## Why deferred, and when to pick it up

Element-level bindings (§3.5) are the gate for the rest: Phase 4's headline
coverage indicator ("N of M safety-relevant elements have a resolved,
non-drifted binding") is not buildable without them, and Phase 6's per-element
report sections depend on them too.

Three things to weigh before building it, from the review discussion:

- **Real value is concentrated on multi-source analysis objects.** For a single
  product behind one repo, the shipped project-level binding already expresses
  the traceability; element-level adds little. It pays off when one DFD has
  several Function/Process/System assets from *different* repos/versions
  (e.g. DataTrack: BLE sensor + Flutter app + cloud; IMIR in an SMGW context).
  Trigger (a): a real analysis object with 2+ code elements from distinct
  sources where project-level demonstrably no longer expresses the traceability.

- **Blocked by the in-flight SSOT refactor.** The plan (§3.5) assumes separate
  `FunctionAssetProperties` / `ProcessAssetProperties` / `SystemAssetProperties`
  interfaces. In the code there is a single flat `AssetProperties` with a
  `category` field, and the canonical merged schema is marked *NOT YET WIRED*
  (`asset-store-ssot-refactor-v2`) — two property schemas (DFD-side + asset-tab)
  are still live. Attaching `sourceBindings` now means building into a moving
  target and choosing a schema that is changing. Trigger (b): the SSOT merge has
  landed, so element `sourceBindings` can be attached to the canonical schema in
  one clean pass. When it does, gate the categories with a
  `*_APPLICABLE`-style set (Function/Process/System only — mirroring
  `CIANAAA_APPLICABLE`), and extend `prepareForDisk` to strip
  `currentDriftStatus` from element bindings too (only project-level is stripped
  today).

- **Question the level.** The value raised for the feature — "when I set a
  mitigation, I know which repo it belongs to" — sits at the *mitigation*, not
  the element; element-level supplies it only transitively
  (mitigation → threat → element → repo). Worth deciding whether a reference at
  requirement/mitigation level would serve that need more directly than element
  bindings. Element-level remains the plan's route, but not the only one.

**Available now, refactor-independent:** the Phase-4 validation *rules* over the
existing project-level bindings — error "binding with no `resolvedCommitSha`",
warning "latest `driftEvents` entry is `tag_moved`/`ref_missing`/`unreachable`
with no `note`" — wired into `ProjectProgress` via the existing `validationInfo`
pattern. This is a usable Phase-4 slice and yields the `validateSourceBindings`
logic full Phase 4 reuses; only the element-coverage indicator waits on §3.5.
The `driftFindingFor` / `DriftFinding` mapping already exists (see DONE doc) for
the panel this would feed.

---

_The sections below are carried verbatim from the original implementation plan._

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


---

## 3. Data model — remaining items

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


---

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


---

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
