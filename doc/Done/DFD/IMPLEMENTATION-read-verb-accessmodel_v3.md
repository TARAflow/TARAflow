# IMPLEMENTATION — `read` verb & DataStore `accessModel`

**Status:** ✅ Shipped (DFD-tab + threat-generator). Ready to move to `done/`.
**Version:** v3 (final — reflects the as-built state across the feature commits)
**Scope:** Dataflow labeling convention + `element-properties.ts` + validators + threat generator + tests
**Related artifacts:** `dataflow-labeling-convention_v3.md`

> v3 records what was actually built and what was consciously deferred. Open items
> in §7 are tracked debt / follow-up decisions, NOT gaps in the delivered feature.

---

## 1. Problem statement

The labeling convention allowed four physical verbs (`pull`, `push`, `write`, `stream`) and forbade
`read`, modelling all repository reads as `pull [req]/[resp]`. That encodes the implicit assumption
that **every read is a request/response interaction with a responding actor**, which breaks for
passive memory access with no responder (shared memory, MMIO, DMA buffers, flash). For those,
`pull` both misdescribes the flow and generates the wrong threat set.

Resolution: introduce `read` as the store→actor counterpart of `write`, scoped to passive storage,
gated by an explicit DataStore access-semantics axis.

---

## 2. Core design (as built)

- **`read`** is the store→actor counterpart of `write`. No flow-type, no logical annotation. It does
  not participate in `req_resp`/`event_ack` pairing.
- **`accessModel`** axis on DataStore: `direct_access` (passive memory/storage → `read`/`write`) vs
  `communication` (active service → `pull`). Gate keys off `accessModel`, **not** `technology`
  (orthogonal axes — SQLite-file vs PostgreSQL-server).
- **`technology`** is the default driver (via `DATASTORE_TECH_DEFAULTS` cascade) and the threat
  sub-family signal; it is a heuristic, not the gate. Analyst may override with a rationale.
- **`write` stays ungated** — persistence marks an effect (durability/retention/integrity/tamper)
  that is access-path-independent; only `read` is gated (an access pattern).
- **Memory/Storage threats are element-level** (the store is the shared resource; fires once per
  region). **Per-interaction parity** added because users pick one method (per-element *or*
  per-interaction) — omitting interaction templates would leave per-interaction users with zero
  shared-memory coverage. Gating uses perspective (sender↔source / receiver↔target) + `technology`.

---

## 3. Delivered — checklist (all ✅)

### 3.1 Model
- [x] `DataStoreProperties`: `accessModel` / `accessModelSource` / `accessModelRationale` (+ JSDoc)
- [x] `DataStoreTechnology`: `shared_memory`, `mmio_register`
- [x] `DATASTORE_TECH_DEFAULTS`: `accessModel` per technology; added to `DATASTORE_TECH_DRIVEN_FIELDS`
- [x] `resolveDataStoreAccessModel()` — explicit value, else technology default (SSOT)

### 3.2 Convention
- [x] `dataflow-labeling-convention_v3.md`: `read` verb, Access Model section, grammar, invariants,
  summary; `read` removed from forbidden synonyms; `buffer`/`frame` removed from forbidden object terms

### 3.3 Validation
- [x] label validator: `read` valid (no tag), synonym removal, forbidden-term removal
- [x] property validator: `read` must not be `requestresponse`; exempt from protocol-missing
- [x] label-property validator: LP-6 (read source = DataStore), LP-7 (direct_access required; error on
  communication, warn on unclassified), LP-8 (pull on direct_access store → suggest read)
- [x] element-property validator: override-rationale check; `mpu_protected` + `communication` conflict
- [x] 8 `ValidationMessages` keys (6 under `tabs.dfd.validation.*`, 2 under `dfdValidation.*`) + en/de
- [x] `translate-finding`: `sourceType` resolver

### 3.4 UI / docs
- [x] DataStore form: `accessModel` select + derived/manual + reset + conditional rationale; memory
  technologies in the dropdown
- [x] `property-doc-mappers`: `accessModel` + rationale in DataStore layout
- [x] en/de i18n for fields, options, technology values

### 3.5 Threat generator
- [x] `TemplateContext.storeAccessModel`; `matchesContext` branch
- [x] per-element: I-004, I-005, T-012, T-013, D-006 (DataStore = T/R/I/D — all reachable)
- [x] per-interaction: I-003, T-009, T-010, D-005 (sender/receiver, technology-gated)
- [x] mitigations M-T-013, M-D-010; verifications V-T-008, V-I-006, V-D-008
- [x] threat text en/de complete (D-005 / T-009-T-010 gap closed via amend)

### 3.6 Tests & build
- [x] unit: `element-property-defaults` (defaults + resolve)
- [x] validators: label / property / label-property / element-property + `dfd-factory`
- [x] `translate-finding` (sourceType)
- [x] `catalog-integrity` — no dangling mitigation/verification refs + de/en text completeness
- [x] surfaced & fixed 3 pre-existing general/Multiprocess text gaps (D-007, E-006, R-006)
- [x] build: tests excluded from production `tsc`; `import.meta.glob` typed for Vitest

---

## 4. Key decisions (locked)

- Gate on `accessModel`, not `technology` (orthogonality).
- `write` ungated; `read` gated.
- Pole names: `direct_access` / `communication` (the latter covers pull/push/stream).
- `accessMode` (DataFlow) ≠ our context key → named `storeAccessModel` to avoid the one-letter clash.
- Memory/Storage threats element-level; per-interaction parity required because methods are mutually
  exclusive at use time.
- `filesystem` / `cache` default to `direct_access` (override path covers NFS / networked Redis).
- MPU bypass modelled as I (read) + T (write), not E — DataStore STRIDE has no E.

---

## 5. Threat-family mapping

| `accessModel` | Verbs | Threat family | Example threats |
|---|---|---|---|
| `direct_access` | `read` / `write` | Memory / Storage | residual data, MPU bypass (R/W), TOCTOU/race, mailbox deadlock |
| `communication` | `pull` / `push` / `stream` | Channel | request spoofing, response tampering, MITM, injection |

Concurrency sub-family (TOCTOU/race, deadlock) additionally gated on
`technology ∈ {shared_memory, mmio_register}`; at-rest subset (residual, tamper-at-rest) applies to
all `direct_access` stores.

---

## 6. Architecture note — SharedMemory node type vs property (unchanged from v2)

`accessModel` and a dedicated `SharedMemory` node type are orthogonal, not alternatives. `accessModel`
is required regardless (flash/eeprom/SQLite are direct_access but not shared memory). A node type
would at most replace the `technology: shared_memory` enum value. Decision criterion: can the
concurrency property set live on `DataStore`, or does it need its own (two masters, locking, cache
coherency, MPU region)? Deferred to **after** the asset-store consolidation refactor (it would be
schema v3 + UI + draw.io + doc-gen). Does not block this feature.

---

## 7. Open / deferred (tracked — not gaps in the shipped feature)

1. **End-to-end generation test + golden (Block C/D remainder).** Catalog *integrity* is tested;
   not yet tested that an ARM/DSP `read` flow actually *emits* I-003/T-009/D-005. Remaining test debt.
2. **Migration / backfill of `accessModel`** on pre-existing DataStores. `matchesContext` reads
   `accessModel` raw, so the Memory family does not fire for legacy stores that have only
   `technology` set. Fix: backfill migration, or switch `matchesContext` to `resolveDataStoreAccessModel`.
3. **Domain-scoped integrity check.** The i18n completeness check currently flattens all per-element
   domains into one set; with cross-domain shared IDs this can mask a missing domain-specific
   translation. Tighten to per-domain comparison.
4. **§7 decisions:** confirm `filesystem`/`cache` default; evaluate the SharedMemory node type
   (criterion in §6) after the asset-store refactor.

---

## 8. Acceptance criteria — status

- [x] ARM ↔ shared-memory ↔ DSP modelled with `read`/`write`; no `pull` artifacts
- [x] PostgreSQL store rejects `read`, requires `pull`
- [x] Embedded SQLite tagged `database` → override to `direct_access` (with rationale) accepts `read`
- [x] `read` with a tag → error; `read` in actor→store direction → error
- [x] `direct_access` `read` edge → Memory/Storage threats; `communication` `pull` edge unchanged
- [x] Existing models without `accessModel` derive a sensible default and remain valid (validation)
- [ ] **End-to-end:** generation emits the new templates for a shared-memory project (deferred → §7.1)

---

## 9. Commits

1. `feat(dfd): add read verb and DataStore accessModel axis` — model, validators, form, doc-mapper, i18n
2. `feat(catalog): add storeAccessModel context gate and shared-memory threat family` — generator
   templates, mitigations/verifications, threat text, validator tests; amended to add the missing
   per-interaction texts, the catalog-integrity test, and the 3 surfaced general/Multiprocess texts
3. build fix — tests excluded from production `tsc`; `import.meta.glob` typed for Vitest
