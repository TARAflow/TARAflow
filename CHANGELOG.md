## [0.10.0-alpha] - 2026-09-10

The headline of this release is **Source Version Binding**: TARAflow can now
record which source version a security analysis was performed against, resolve
it to a pinned commit, and detect when that source has drifted since — giving
version-exact traceability from the TARA to the implementation it describes
(EN 50742 §7.5 / §8.4, "identification of software"). This release delivers the
project-level scope end to end (Phases 1–3); element-level bindings and the
validation/coverage reporting that builds on them are deferred (see `doc/Open/`).

### Added
- **Source references (project scope).** An analyst can record a project-level
  source reference — repository URL, ref type (branch / release branch / tag /
  commit) and ref label — on the Overview tab, as an optional
  documentation/evidence reference. The full data model (`SourceBinding`,
  `DriftStatus`, `DriftEvent`) ships up front so later phases need no migration.
- **Commit resolution (remote-first, consent-gated).** A per-binding *Resolve*
  action pins a ref to a commit SHA via `git ls-remote`, behind an explicit
  network-consent prompt shown once per host per Electron session (never
  persisted, never silent). Host/network-unreachable is distinguished from
  repo-reached-but-ref-not-found, and on-prem / offline hosts are handled
  explicitly rather than failing silently.
- **Drift detection.** A *Check for changes* action re-resolves a pinned binding
  and classifies the result into six states (in sync, branch advanced, expected
  release-branch advance, tag moved, ref missing, unreachable), with a live
  status badge and an expandable history. Every state *transition* is recorded
  to an append-only `driftEvents` log; repeated or clean checks add no entry,
  keeping the record bounded. A declined-consent or engine-unavailable check
  records nothing, so the log never conflates "chose not to check" with "the
  host was down". Reuses the audit Finding/severity vocabulary.

### Changed
- **Build target raised to es2022** (`tsconfig.json` and
  `tsconfig.electron.json`), with `useDefineForClassFields` pinned to `false` so
  the existing class-field emit is unchanged — a lib/syntax bump only.

### Fixed
- **D-009 (wireless-interface DoS) i18n.** The catalog interface D-009 had no
  threat/attack/cause text and resolved to the raw fallback key; en + de entries
  added. Fixes newly generated threats only — projects generated before this
  text existed have the raw key frozen into their stored descriptions.
- **Missing asset-to-asset relation i18n keys.** `noTargets`, `noRelationTypes`,
  `stepOrder` and `rationale` under `assets.relations.a2a` were absent in en + de
  and logged `missingKey`; added.

Full commit range: `v0.9.0-alpha..v0.10.0-alpha` (9 commits)

## [0.9.0-alpha] - 2026-09-07

The headline of this release is **EN 50742 Approach A (SRSL)**: the Security
Requirement Severity Level is now a first-class, parallel output alongside the
standard R = L × I risk — surfaced in the Risk tab, the mitigation picker, and
every report format. This release also adds risk- and threat-level filtering,
consolidates the asset store into a single source of truth, and fixes a class
of "assets disappearing" bugs.

### Added
- **EN 50742 Approach A — SRSL in the Risk tab.** An SRSL column (en-50742-a
  projects only) renders `calculatedSrsl` as a coloured SRSL0–3 chip (muted "–"
  when not yet determined). The dialog's SRSL section is gated on an
  exposure-bearing anchor (`exposure_level > 0`) — it shows for crossing
  DataFlows and Interfaces, not internal elements — and, when no
  safety-function asset provides a severity, collapses to a single "No linked
  safety-function asset for Severity" note (AP stays visible; it is valid
  without severity) with an info tooltip describing exactly how to resolve it.
- **Mandated 7.4.3 controls.** The SRSL-mandated protection requirements
  (anchor type × STRIDE × SRSL, from `mandatedRequirementsForThreat`) are mixed
  into the mitigation picker with an "EN 50742 A" chip and pre-selected;
  standard catalogue and custom mitigations remain selectable alongside them. A
  "Mandated 7.4.3 Controls" column is added to the SRSL report table.
- **SRSL Assessment report chapter (all formats).** A new "SRSL Assessment
  (EN 50742 Approach A)" chapter — one row per exposure-anchored risk (safety
  asset, severity, EL / WoO / AC → AP → SRSL) plus the "SRSL vs R = L × I"
  separation note — is available in Markdown, AsciiDoc, HTML, StrictDoc and PDF,
  and auto-hides on non-en-50742-a projects. Existing projects pick up the
  chapter without a migration (`withDefaultChapters` merge), and reports now
  resolve asset UUIDs to names and use the asset `displayId` (not the UUID) as
  the relation heading.
- **Risk-level filter.** A "Risk Level" dropdown on the risk filter bar
  (Critical / High / Medium / Low). Options are derived from the active scale
  (`RISK_SCALES`), so 3-/4-/5-level projects all work, each with a colour swatch.
- **Threat relevance filter.** A second dropdown beside the STRIDE filter
  filters threats by triage status (unrated / relevant / uncertain /
  not_relevant) in both per-element and per-interaction views.

### Changed
- **SRSL is now fully separated from the R = L × I risk.** EN 50742 factors
  (EL, AC, WoO) are excluded from the likelihood mean
  (`EN50742_SRSL_FACTOR_IDS`, single source in the core) and drive **only** the
  SRSL, which `calculateGatedRiskValues` overlays as a parallel output.
  Setting EL / AC / WoO no longer changes likelihood or the risk score; the
  residual risk stays the standard L × I. *(Behaviour change — previously these
  factors moved the risk via the attack potential.)*
- **Single canonical asset store (SSOT completion).** `syncFromDFD` is now
  create/update only — it never removes records from a mirror diff. An asset
  whose DFD links are gone becomes *orphaned* (`getAssetsMissingInDFD`) and is
  removed only by an explicit user action, eliminating the mirror-diff
  asset-loss class entirely.
- **Risk notifications consolidated into one accordion.** The separate
  sync-warning, uncertain-threats and out-of-sync banners are replaced by a
  single collapsible notifications accordion (count when collapsed, a bulleted
  list when expanded, "Sync Now" preserved on the out-of-sync entry). This
  removes the nested-`Collapse` height-measurement glitches and banner clipping
  under the parent's `overflow: hidden`.
- **Severity terminology and guidance.** The `physicalImpact` severity label
  "Fatality" → "Fatal" (en + de), aligning with the EN 50742 "fatal" naming;
  the no-severity tooltip now points to the DFD tab as the place to create the
  asset relation (Interface: invokes/monitors; DataFlow: invokes).

### Fixed
- **Assets could silently disappear.** `syncFromDFD` pruned every
  `source:"dfd"` asset absent from the `dfd.assets` mirror — but that mirror is
  stripped on disk and re-derived on load, so a partial/empty mirror wiped the
  canonical feature store. The prune is now skipped when the incoming mirror is
  empty; genuine removals against a non-empty mirror are unaffected. Regression
  test reproduces the loss.
- **False "asset not found" on DFD relations.** The asset-relation validator
  checked `project.dfd.assets` (the mirror, which can lag the canonical store),
  so a relation to a known asset not yet mirrored errored until the Asset tab
  was opened. It now validates against the canonical asset registry threaded
  through `ValidateOptions.knownAssets`, with the mirror as fallback.
- **EN 50742 severity didn't resolve after a relation was added later.** A
  threat's `linkedAssetIds` cache went stale when a DFD asset relation was added
  after generation, so the risk never saw the safety asset and its SRSL could
  not resolve. `syncThreatsWithGraph` now re-derives `linkedAssetIds` from the
  current asset store on every graph sync; the risk gate resolves assets from
  the fresh threat, asset-link drift is an update trigger, and
  `checkRiskSyncStatus` detects the drift so the sync affordance lights up.
- **Manual STRIDE-method switch was silently reverted.** The active method was
  re-derived from confirmed-threat counts on every render, flipping a manual
  switch back to per-element when the target method's threats weren't confirmed
  yet. Auto-selection is now based only on whether a method has any threats at
  all; a dedicated "threats not yet confirmed" empty state replaces the
  misleading "Sync from Threats" prompt (which would have synced nothing).
- **Per-interaction group labels showed the flow name instead of its id.** The
  data-flow accordion headers read "DF-&lt;flow name&gt;" instead of e.g.
  "DF-7", because the id was parsed from a trust-boundary-prefixed display id
  and fell back to the name. Grouping now uses the authoritative
  `dataFlow.dataFlowId` (already in "DF-nn" form).
- **Wrong relations in the asset-assignment dialog for data flows.** A DataFlow
  (a connection) resolved to `elementType=undefined`, so it offered the wrong
  allowed relations (`is_an` instead of `invokes`) and hid its existing ones.
  The dialog now resolves connections too, treats them as DataFlow for the
  allowed-relation lookup, and reads their `assetRelations`.
- **Risk filters never filtered the table.** The Risk tab passed unfiltered
  risks to the table, so the priority and search filters had no effect on the
  rows. It now passes the filtered set with a matching count — fixed alongside
  the new risk-level filter.
- **Mandated-control labels and SRSL fields were unreadable.** Mandated
  controls showed a raw `en50742-<clause>` id; they are now recomposed as
  "EN50742: &lt;category&gt; — &lt;requirement&gt; (&lt;clause&gt;)". The
  risk-table mitigation tooltip resolves every selected mitigation (catalogue,
  custom and mandated, not just proposed) and drops the redundant trailing
  `[status]`; the SRSL report's Severity and WoO now render with spaces instead
  of underscores.

---

Full commit range: `v0.8.8-alpha..v0.9.0-alpha` (20 commits)

---

## [0.8.8-alpha] - 2026-09-02

### Fixed
- **Impact chips showed the raw asset UUID instead of its name.** Since
  the Phase 5b identity split, `asset.id` is the opaque
  `crypto.randomUUID()` reference key, but `ImpactCell` still rendered it
  directly as the chip label — every chip in the Threats table showed a
  UUID instead of a readable asset label. `AssetReference` gained
  `displayId` and `description` (populated in
  `buildAssetDataReference` from `a.displayId` / `a.properties?.description
  ?? ""`); the chip label now uses `asset.name`, and the tooltip header
  switches from `{id} — {name}` to `{displayId}: {name}` with the asset
  description appended below it.
- **EN 50742 exposure level silently dropped for data-flow threats.** The
  Risk tab showed no exposure level even though the DFD had it set on the
  connection, due to two anchor-resolution gaps in series:
  1. `resolveAnchorProperties` only looked `linkedElement.elementId` up in
     `dfd.elements`, but a per-element STRIDE anchor on a DataFlow carries
     the *connection* id with `elementType: "DataFlow"`, which lives in
     `dfd.connections`. DataFlow-typed anchors are now resolved against
     connections, with a defensive elements-to-connections fallback for
     older data lacking `elementType`.
  2. `extractThreatReferences` built the `ThreatReferences` feeding the
     Risk dialog and sync without copying `linkedElement`/`dataFlow` onto
     them, leaving the EL adapter with an anchorless reference. Both are
     now populated on the reference.

  Verified end-to-end against `Simple_Test_Project`: DF-3 (EL3) → rating
  4, DF-4 (EL1) → rating 2, both `source: "derived"`. AP/SRSL still
  require a rated attacker capability (and, for SRSL, a resolvable asset
  severity) as designed. Also updates
  `en-50742-approach-a-design.md` §11.1 (two-anchor → three-anchor model)
  and extends `en50742-exposure-level-adapter.test.ts` with DataFlow-anchor
  regression cases (17/17 green).

---

Full commit range: `v0.8.7-alpha..v0.8.8-alpha` (3 commits)

---

## [0.8.7-alpha] - 2026-09-01

### Added
- **Asset identity: UUID + readable displayId (Phase 5b).** Feature-store
  assets now mint a stable, opaque `crypto.randomUUID()` as `id` — the
  reference key every relation points at — plus a regenerable, human-readable
  `displayId` (e.g. `DA-001`), mirroring the existing Threat identity model.
  On a group change (`data` → `system`, etc.) only `displayId` is
  regenerated; the stable `id` keeps every existing relation resolvable.
  `migrate_5_to_6` rewrites every readable asset id to a UUID and repoints
  all foreign keys (`assetId` / `sourceAssetId` / `targetAssetId` /
  `linkedAssetIds` / `assetIds`) across the project in one idempotent pass.
  Bumps schema version 5 → 6.
- **Single canonical asset store (Phase 5c).** `dfd.assets` is no longer a
  second persisted store: it is now a runtime projection of the canonical
  feature store (`project.assets`), re-derived on load (`commitAssetSync`)
  and emptied on save (`prepareForDisk`). `migrate_5_to_6` drops the
  `dfd.assets` mirror instead of remapping it. This removes the structural
  source of asset drift between the DFD canvas and the Asset tab.
- **Canonical flat `AssetProperties` (Phase 4).** A single shared property
  schema now backs both `Asset.properties` (Asset tab) and
  `DFDAsset.properties` (DFD canvas), replacing two independently-typed
  shapes. Property edits on the DFD canvas now flow through to the feature
  store via sync instead of being silently dropped.
- Manual (`source: "manual"`) threats are now preserved across "Regenerate
  Threats" and "Delete All Threats" unless the analyst explicitly opts in to
  deleting them (new confirmation-dialog checkbox, default off).

### Fixed
- **Asset `assetGroup` drift on group change.** Relation *types* are
  group-bound (`creates`/`reads` are data relations, `uses`/`depends_on` are
  system relations); a group change could leave relations of the old
  family attached to an asset of the new group, with a stale cached
  `assetGroup` on the relation. `updateAsset` now keeps only relations whose
  type is valid for the new group and updates their cached `assetGroup` to
  match, so it can no longer drift. Existing projects with already-drifted
  relations are not retroactively repaired — the fix applies on the next
  group change.
- **Analyst edits silently lost on full threat regeneration.** Regeneration
  rebuilt every threat from scratch with no lookup against the previous
  table, dropping analyst-owned fields (relevance, workflow status,
  evaluation notes, threat actor, customised text, mitigation/verification
  notes) on every run — up to ~470 records in one reported case. A
  natural-key merge pass now overlays analyst-owned fields from the
  predecessor threat onto each freshly generated one, while system-derived
  fields are recomputed from the current graph.
- **Phantom sync drift on un-migrated / legacy threat data.** Drift
  detection compared `threat.displayId` directly, flagging any threat
  without a `displayId` (legacy v4 data, minimal test doubles) as drifted
  even when nothing had changed. Comparison now falls back to `id` when
  `displayId` is absent.
- **Interface security controls rendered as N/A in generated reports.** The
  doc mapper read interface controls from the top level instead of
  `properties.implementedControls`, so every value showed as missing.
  Free-text fields (owner, notes, …) were also incorrectly run through
  enum-option translation, risking mistranslation of values that happened
  to match an enum token.
- **Reports showed raw UUIDs instead of display labels.** After the
  threat/risk identity split, generated reports rendered `threat.id`
  (UUID) instead of `threat.displayId` in every text/PDF format. Report
  tables and cross-reference anchors now use the display labels again.
- `verify:fixtures` script crashed at load after `canonicalStringify` was
  moved out of `prepare-for-disk` into `tcs-serialize`; import path fixed.
- Missing i18n keys (`safetyAnnotation.impact`, `.physicalHazardPotential`,
  `.rationale.label/placeholder`, EN + DE) for the asset-relation selector.

### Changed
- `dfd.assets` on disk is now always empty; consumers reading assets should
  use `project.assets` (the feature store) as the single source of truth.
- Removed a dead, never-wired `onAssetFeatureUpdate` double-write path in
  the DFD asset panel chain (properties already reach the feature store via
  sync since Phase 4b-iii).
- Renamed asset-view DFD reference types (`DFDAssetReference` /
  `DFDElementReference` / `DFDConnectionReference` →
  `AssetDFDAsset` / `AssetDFDElement` / `AssetDFDConnection`) to resolve a
  name collision with the unrelated shared graph-analysis types of the same
  name. Pure rename, no behaviour change.

---

Full commit range: `v0.8.6-alpha..v0.8.7-alpha` (24 commits)