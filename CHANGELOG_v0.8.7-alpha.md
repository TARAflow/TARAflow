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
