# Integration tests

Tests that deliberately cross feature / layer boundaries. Distinct from `unit/`
(one function in isolation) and `component/` (React rendering + interaction).

## Conventions

- **Suffix:** `*.integration.test.ts`. Vitest's default `include`
  (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) picks these up automatically — no config
  change, no `setupFiles` entry.
- **Folder layout mirrors features, not layers** (`threats/`, `assets/`, `dfd/`…),
  because an integration test by definition spans layers. Name it after the
  feature whose behaviour it pins.
- **Fixtures stay central** in `src/tests/fixtures/` — never duplicated here.
- **No catalog / i18n in the harness.** `setup-tests.ts` is jest-dom only and is
  not globally loaded. A test that needs the threat catalog must either stub it
  (as the per-element golden tests do) or stay on a catalog-free path. Prefer
  catalog-free chains here.

## Current tests

| File | Chain under test |
|------|------------------|
| `threats/asset-link-to-threat-index.integration.test.ts` | `Asset.linkedDFDElements` → `buildAssetDataReference` (app) → `buildElementToAssetsIndex` (threats). Locks the link mapping, RC-1' de-dup propagation, and reverse-index inversion against real EdGe2 data. |

## Candidate for later (Option B)

A full `generateThreatsForProject` golden against an EdGe2 subset (per-element
expected threat table) would cover RC-1' + RC-2 + category computation together.
It requires either a real catalog/i18n bootstrap (absent today) or a documented
stub of `getEffectiveStrideCategories` like `element-sync-status.golden.test.ts`.
Add once the catalog test bootstrap exists, otherwise it is no more faithful than
the unit + integration coverage already in place.
