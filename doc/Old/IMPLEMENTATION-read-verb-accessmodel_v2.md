# IMPLEMENTATION — `read` verb & DataStore `accessModel`

**Status:** Draft / requirements captured — not yet implemented
**Version:** v2 (adds §5 architecture decision: SharedMemory node type vs. property)
**Scope:** Dataflow labeling convention + `element-properties.ts` (DataStore) + label validator + threat generator
**Related artifacts:** `dataflow-labeling-convention_v3.md`, `element-properties.ts`

---

## 1. Problem statement

The labeling convention currently allows four physical verbs: `pull`, `push`, `write`, `stream`.
`read` is explicitly forbidden; reads from repositories/services are modeled as `pull [req]/[resp]`,
and only persistence mutations use `write`.

This encodes an implicit assumption:

> **Every read is a request/response interaction with a responding actor.**

That assumption holds for services, APIs, databases-as-servers, and RPC. It **breaks** for
passive memory access where there is no responding actor:

- Shared memory between cores (ARM ↔ DSP, dual-port RAM)
- Memory-mapped registers / MMIO
- DMA buffers, ring buffers, mailboxes, scratchpad RAM
- MPU-isolated regions

For these, `pull <object> [req]/[resp]` is semantically false (no request, no responder) and —
more importantly — **generates the wrong threat set** (see §8).

The original framing ("should `read` exist as the symmetric counterpart to `write`?") is the weak
version of the question. The strong version is:

> **Do we need `read` for storage access that has no communication semantics?**

Answer: **yes, but tightly scoped.**

---

## 2. Key decision

Introduce `read` as a **scoped** verb, gated by an explicit **access-semantics axis**, not by
symmetry and **not** by `technology`.

### 2.1 Why not gate on `technology`

`technology` and access model are **orthogonal axes**. Counterexamples:

| Node | `technology` | Real access semantics |
|---|---|---|
| Embedded SQLite file (in-process) | `filesystem` | direct load/store |
| PostgreSQL server (remote) | `database` | request/response |
| Network filesystem (NFS/SMB) | `filesystem` | request/response |
| In-process LRU cache | `cache` | direct |
| Redis over TCP | `cache` | request/response |

A technology whitelist would mis-gate all of the above. It was rejected.

### 2.2 The gate: `accessModel`

Gate the verb on an explicit, authoritative property on the DataStore:

```
accessModel: "direct_access" | "communication"
```

- `direct_access` → load/store, syscall, memory-mapped → **`read` / `write`** allowed
- `communication` → pull/push/stream semantics → **`pull` / `push` / `stream`** required;
  `read`/`write` forbidden on that store edge

Pole naming note: the communication pole is named `communication` (not `request_response`)
because it must also cover `push` and `stream`, not only request/response.
(`passive_storage` / `active_service` is an acceptable alternative naming — it names the *why*.)

### 2.3 Derived + manual + rationale (reuse existing pattern)

Mirror the existing `exposureLevel` triad (`exposureLevel` / `exposureLevelSource` /
`exposureLevelRationale`). `technology` becomes a **default heuristic** and a threat-template
source — **not** the gate.

```ts
accessModel?: "direct_access" | "communication";
accessModelSource?: "derived" | "manual";
accessModelRationale?: string; // required when source = "manual" AND value deviates from technology default
```

This resolves the orthogonality problem: in-process SQLite (`filesystem` → default
`direct_access`) and PostgreSQL (`database` → default `communication`) are correct by default; the
rare mismatched node (e.g. an embedded SQLite node tagged `database`) is overridden to
`direct_access` with a mandatory rationale (IEC 62443-4-1 traceability). The technology enum can
grow freely (`dma_buffer`, `dual_port_ram`, `scratchpad_ram`, …) without touching the verb rule.

---

## 3. Semantics clarification (per-edge vs per-store)

`accessModel` is a **store** property, but a verb sits on an **edge**.

In a correctly modeled DFD, the direct edge to a **passive** store is *always* `direct_access` —
a passive store does not answer requests, regardless of who connects to it. Therefore:

- An `accessModel = "communication"` override on a store-shaped node is the explicit statement:
  **"this node drawn as storage is actually a fronted service."**
- This surfaces the modeling smell (a `Process`/`ExternalEntity` mis-drawn as a `DataStore`)
  **without forcing** a disruptive re-typing of the node. The override is the pragmatic escape hatch.

The verb at the edge is then resolved from the store endpoint's effective `accessModel`.

---

## 4. `write` stays ungated (decision)

`write` is **not** gated by `accessModel`. Rationale (three-way consensus in the discussion):

- `write` marks an **effect** (persistence: durability, retention, integrity, tamper-relevance),
  which is access-path-independent and always security-relevant.
- Gating `write` would lose the persistence flag exactly where compliance needs it (e.g. database writes).
- `read` names an **access pattern** whose semantics depend on the mechanism → must be gated.

The asymmetry (`write` universal, `read` gated) is intentional and justified by purpose.

---

## 5. Architecture decision: SharedMemory — node type vs. property

A recurring counter-proposal: instead of a `read` verb / `accessModel` property, introduce a
dedicated **SharedMemory node type** (alongside `ChipBoundary`, `PhysicalBoundary`, `TrustBoundary`).

### 5.1 These are NOT alternatives at the same level

`accessModel` and a SharedMemory node type are **orthogonal**, not competing options:

- **`accessModel` is required regardless of the node-type decision.** Flash, EEPROM, NVRAM and the
  in-process SQLite file are *persistent direct-access datastores* — direct access, but **not**
  shared memory. A SharedMemory type would not cover them; they still need `read`/`write` gating,
  which only `accessModel` provides.
- A dedicated node type at most replaces the `technology: "shared_memory"` **enum value** — it never
  replaces the `accessModel` **concept**.

Therefore the node-type question must not block the `accessModel` work, and does not invalidate it.

### 5.2 What the node-type question is actually about

It is a separate architectural question on two axes — **not** about the verb:

**(a) Property-set fit.** `DataStoreProperties` is oriented toward *persistence at rest*:
`encryptionAtRest`, `deletionMechanism`, `backupEnabled`, `integrityProtection` (at rest), retention.
Most of these are meaningless for volatile dual-port RAM. Shared memory instead needs:

- two owners / masters (e.g. ARM + DSP)
- concurrency model / locking mechanism
- cache coherency
- MPU/MMU region configuration

This is a different property set.

**(b) A distinct concurrency threat class.** TOCTOU, race conditions, coherency violation, priority
inversion across masters, MPU bypass. Precedent in the codebase: `ChipBoundary`,
`PhysicalBoundary`, `TrustBoundary` are their own types **because** they have distinct threat
classes and property sets. If volatile inter-master memory has the same justification, a dedicated
type is consistent with the existing architecture.

### 5.3 Decision criterion

> Can the concurrency threats be driven from `technology: "shared_memory"` plus a few fields on
> `DataStoreProperties` — or do they require a property set that does not fit `DataStore`?

- Fits in DataStore + a few fields → **property is enough; a node type would be over-engineering.**
- Needs its own property set → **dedicated `SharedMemory` node type is justified.**

### 5.4 Sequencing (relative to the active asset-store consolidation refactor)

- **Now:** ship `accessModel` (3 fields on one interface + derivation helper + validator rule).
  Independent, cheap, unblocks the convention, the validator, and ARM/DSP modeling immediately.
- **Later (post-refactor stabilization):** evaluate the SharedMemory node type against §5.3.
  A new node type touches schema (→ **schema v3**), doc-gen mappers (`ELEMENT_FIELD_LAYOUT`), UI
  forms, draw.io shapes, and the asset store — a large surface to open during an active refactor.

**Do not** sequence the node-type investigation *before* the verb fix: the verb fix is independently
needed and is not invalidated by whatever is decided about the node type. Decouple, don't serialize.

---

## 6. Required changes

### 6.1 `element-properties.ts` — `DataStoreProperties`

- [ ] Add `accessModel?: "direct_access" | "communication"`
- [ ] Add `accessModelSource?: "derived" | "manual"`
- [ ] Add `accessModelRationale?: string`
- [ ] Add doc comments in the file's existing style (cause/effect, threat implications)
- [ ] Extend `DataStoreProperties.technology` with memory-class values:
  - `shared_memory` — volatile inter-core / inter-process memory (DPRAM, mailbox, SRAM region)
  - `mmio_register` — memory-mapped I/O registers
  - (document that these default to `direct_access`)

### 6.2 Derivation helper

```ts
function deriveAccessModel(tech?: DataStoreTechnology): "direct_access" | "communication" {
  switch (tech) {
    case "flash": case "eeprom": case "nvram":
    case "shared_memory": case "mmio_register":
      return "direct_access";
    case "database": case "cloud": case "queue": case "blockchain":
      return "communication";
    // ambiguous — default to common case; override carries the exceptions:
    case "filesystem": case "cache":
    default:
      return "direct_access";
  }
}

function effectiveAccessModel(store: DataStoreProperties): "direct_access" | "communication" {
  return store.accessModelSource === "manual" && store.accessModel
    ? store.accessModel
    : deriveAccessModel(store.technology);
}
```

> Note: `filesystem` and `cache` are the ambiguous technologies where manual override is most often
> needed (network FS, Redis). Defaults bias to the embedded/in-process common case.

### 6.3 Labeling convention (`dataflow-labeling-convention_v3.md`) — DONE in v3

- [x] Added `read` to **Allowed Verbs** (no flow-type, no annotation; same as `write`).
- [x] Removed `read` from the forbidden synonyms list; added scoping note.
- [x] Added a dedicated **# 5. read** section (mirrors `# 3. write`).
- [x] Added a dedicated **Access Model** section (direct_access vs communication, derived+override).
- [x] Updated **Hard Invariants** (read/write/stream do not participate in pairing; read gated).
- [x] Updated **Formal Grammar** (`read` in verb production; no-tag + access-model + direction constraints).
- [x] Updated **Communication Semantics**, **Naming Format**, **Good Examples**, **Summary** tables.
- [x] Added a v3 version note at the top.

### 6.4 Validator (TODO)

- [ ] Verb/endpoint gate:
  - `read`  (store → actor) allowed ⟺ `effectiveAccessModel(store) === "direct_access"`
  - `write` (actor → store) allowed on any datastore (ungated)
  - `pull` / `push` / `stream` on a store edge ⟺ `effectiveAccessModel(store) === "communication"`
- [ ] Direction check: `read` = store → actor; `write` = actor → store. Wrong direction = violation.
- [ ] Tag check: `read` MUST NOT carry any tag (same as `write`).
- [ ] Violation messages:
  - `read` on a `communication` store → `"use pull [req_resp]; this node answers requests (active service), not passive storage"`
  - `pull` on a `direct_access` store → `"use read/write; this is passive memory/storage with no responding actor"`
  - `read` while `accessModel`/`technology` unset → block and force classification.

### 6.5 Threat generator (TODO)

- [ ] Drive the threat-template family from `effectiveAccessModel` (see §8 mapping).
- [ ] Ensure `read` flows feed the memory/storage family, `pull` flows feed the channel family.

---

## 7. Open questions / decisions still to make

- [ ] **Default for `filesystem` / `cache`**: confirm `direct_access` as default, or force
  `accessModelSource = "manual"` (no default) for these two ambiguous technologies?
- [ ] **Migration**: existing models have datastores with no `accessModel`. Run derivation on load
  and persist as `derived`, or leave lazy? (Mirror exposureLevel migration behavior.)
- [ ] **`push`/`stream` on stores**: are these realistic for `communication` datastores, or should a
  `communication` datastore restrict to `pull` only? (Likely: allow `pull`; warn on `push`/`stream`.)
- [ ] **SharedMemory node type**: resolve §5.3 criterion after the asset-store refactor. Decide
  whether `technology: "shared_memory"` + DataStore fields suffice, or a dedicated type is needed.
- [ ] **`mmio_register` vs `shared_memory`**: confirm both are needed, or is `shared_memory`
  sufficient for v1?

---

## 8. Threat-family mapping (the payoff)

`accessModel` earns first-class status by driving **both** verb validation **and** threat selection.

| `accessModel` | Verbs | Threat family | Example threats |
|---|---|---|---|
| `direct_access` | `read` / `write` | Memory / Storage | TOCTOU, race conditions, stale/residual data exposure, MPU misconfiguration, readout via debug |
| `communication` | `pull` / `push` / `stream` | Channel | spoofing (request), MITM / tampering (response), injection, replay |

Cross-coupling for `direct_access` / `read`:

- Readout via debug → couples to `ChipBoundary.firmwareProtection` / `debugProtection`
- Residual data exposure → couples to `DataStoreProperties.deletionMechanism`
- Tampering / integrity → couples to `DataStoreProperties.integrityProtection`
- Region access control → couples to `accessControlMechanism = "mpu_protected"`

**Security justification for the whole change:** modeling shared memory as `pull` generates
request-spoofing / response-tampering / MITM threats on a channel that does not exist, and misses
TOCTOU / race / region-access / residual-data threats that do. The verb is not cosmetic — it
selects the threat set.

---

## 9. Acceptance criteria

- [ ] ARM ↔ shared-memory ↔ DSP can be modeled with `write input buffer` / `read input buffer`
  and `write result buffer` / `read result buffer`; no `pull` artifacts.
- [ ] A PostgreSQL datastore rejects `read`/`write` and requires `pull [req_resp]`.
- [ ] An embedded SQLite datastore tagged `database` can be overridden to `direct_access`
  (with rationale) and then accepts `read`/`write`.
- [ ] `read` carrying any tag → validation error.
- [ ] `read` in the actor → store direction → validation error.
- [ ] Threat generation on a `direct_access` `read` edge produces memory/storage threats and
  no request/response channel threats.
- [ ] Threat generation on a `communication` `pull` edge is unchanged from current behavior.
- [ ] Existing models without `accessModel` derive a sensible default and remain valid.

---

## 10. Affected files (checklist)

- [ ] `element-properties.ts` — `DataStoreProperties` (new fields), `DataStoreTechnology` (new values)
- [ ] derivation helper (`deriveAccessModel` / `effectiveAccessModel`) — location TBD (shared util)
- [x] `dataflow-labeling-convention_v3.md` — verb table, grammar, `# 5. read`, Access Model, invariants, summary
- [ ] label validator — verb/endpoint/direction/tag rules + messages
- [ ] threat generator — accessModel → threat-family routing
- [ ] migration path for existing models (derive + persist `accessModel`)
- [ ] tests — validator rules, derivation defaults, override path, threat routing (§9)
- [ ] (deferred) SharedMemory node type — only if §5.3 criterion says so; schema v3 + UI + draw.io + doc-gen
