# EdGe2 per-element generation — test suite

Vitest suites and fixtures that lock the per-element threat-generation fix
(Finding 2 / Finding 3). They follow the handover
`TARAflow-per-element-generation-fix-handover.md`, one suite per root cause,
RED-first (TDD).

## Placement

```
src/features/threats/__tests__/edge2/
├── fixtures/
│   ├── edge2-asset-index-legacy.fixture.json      (uploaded — legacy linkedElementIds)
│   ├── edge2-asset-index-linked-dfd.fixture.json  (generated from EdGe2 — new field)
│   ├── edge2-cianaaa-anchors.fixture.json         (generated — 3 anchors + assets)
│   ├── edge2-per-element-categories.fixture.json  (generated — per-node expected sets)
│   └── edge2-sync.fixture.json                    (uploaded — sync status, encodes 2a)
├── element-generator.asset-index.test.ts
├── unified-strategy.cianaaa.test.ts
├── cianaaa-to-stride.consolidation.test.ts
├── element-generator.sensor-coverage.test.ts
├── stride-modifier.sensor-actuator.test.ts
├── element-generator.id-uniqueness.test.ts
└── threat-elimination-filter.test.ts
```

Relative imports in the suites assume this folder. If you colocate differently,
adjust the `../../services/...`, `../../models/...`, `../../utils/...` prefixes.
`shared` and the `../../../assets/...` path use your existing path aliases.

## Test ↔ phase map

| Suite | Root cause | Step | RED before fix? |
|-------|-----------|------|-----------------|
| `element-generator.asset-index.test.ts` | RC-1 (asset link field) | 1 | new-field suite RED; legacy suite GREEN |
| `unified-strategy.cianaaa.test.ts` | RC-1 (Module 2) | 1 | RED (anchors fall back to base) |
| `cianaaa-to-stride.consolidation.test.ts` | RC-6 (single constant) | 2 | mapping GREEN; identity RED |
| `element-generator.sensor-coverage.test.ts` | RC-2 (coverage pass) | 3 | RED (orphan Sensor not iterated) |
| `stride-modifier.sensor-actuator.test.ts` | RC-3 (Module 1 Sensor/Actuator) | 4 | RED (functions don't exist yet) |
| `element-generator.id-uniqueness.test.ts` | RC-5 (id/sequence) | 5 | GREEN invariant + 1 `todo` |
| `threat-elimination-filter.test.ts` | guard | — | GREEN (regression pin) |

## Golden anchors (from the handover, reproduced by the fixtures)

- `EE-2` (id 189): base `[S,R]` ∩ CIANAAA `{T,E}` = `∅` → **0 threats is correct.**
- `SE-1` (id 206): base `[T,D]` ∩ CIANAAA `{T,E}` = `[T]`.
- `EE-1` (id 174): base `[S,R]` ∩ CIANAAA `{T,R,D,E}` = `[R]`.

The sync fixture independently encodes the 2a gap:
`unthreatenedNonTB: ["189","206"]` and `realStrategyMissing: ["206"]` — EE-2 (189)
correctly empty, SE-1 (206) the genuine miss that RC-2 closes.

## Suggested commit sequence (TDD)

1. Add `asset-index` + `cianaaa` suites → RED. Implement RC-1 (`getLinkedElementIds`
   helper in `buildElementToAssetsIndex` and `getActiveSecurityGoals`) → GREEN.
2. Add `consolidation` suite → identity RED. Delete the asset-feature
   `CIANAAA_TO_STRIDE`, re-export from `shared` → GREEN.
3. Add `sensor-coverage` suite → RED. Add the fallback coverage pass to
   `generateThreatsForProject` → GREEN.
4. Add `stride-modifier` suite → RED. Implement `modifySensorStride` /
   `modifyActuatorStride` + wire cases in `applyElementProperties` → GREEN.
5. Add `id-uniqueness` suite → GREEN; tackle the `todo` when `sequenceNumber` is
   made incremental.

Conventional commits, English, one concern per commit.

## Notes / caveats

- `sensor-coverage` and `id-uniqueness` drive the full generator, which performs a
  catalog lookup. They assume the same i18n/catalog test bootstrap the existing
  per-element golden tests use. The third case in `sensor-coverage`
  (`getEffectiveStrideCategories`) needs no catalog and proves the strategy
  independently of the iteration fix.
- The DFD graph stubs include only the fields the generator reads
  (`elementsById`, `connectionsById`, `effectiveElementTrustBoundary`,
  `elementPhysicalBoundaries`, `elementChipBoundaries`). If `DFDGraphReference`
  gains required fields, extend the stubs.
- Base STRIDE values in the fixtures were validated against
  `STRIDE_PER_ELEMENT_TYPE` in `per-element-types.ts`.
