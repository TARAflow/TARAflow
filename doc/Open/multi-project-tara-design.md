# TARAflow — Multi-Project TARA (Component Import) — Design

Status: **v3 · 2026-11-07 · decided; phase 0 done (patch 04)** · target release **0.19**, project
schema **≥ 14** · Author: (Juergen) · Supersedes the content scope of
`doc/Old/multi-diagram-linking-design.md` (§12).

History: v1 (2026-11-03) and v2 (2026-11-04) described a *Component Security Profile* that the
component team exports and the machine team binds to a multiprocess it drew itself. v3 (user
2026-11-07) replaces that with a **direct import of the component TARA while drawing the machine
DFD**: the import creates the multiprocess and its child page. The decisions of v2 that still apply
are carried over (§16); the profile export is kept only as an outlook for external suppliers (§15).

## 1. Use case

A **component team** (e.g. a camera system) builds the TARA of its component. Its environment —
machine controller, HMI, service laptop, network — is drawn as **external entities (EEs)**.

A **machine team** builds the TARA of a machine that uses the camera system. While drawing the
machine DFD it chooses **"Import component TARA"** and picks the camera's `.tara.json`. TARAflow

1. creates a **multiprocess** "Camera system" on the current page,
2. makes the camera's DFD its **child page** (all levels of the camera DFD, read-only),
3. asks which **machine element** each camera EE stands for,
4. creates on the parent page **one flow per camera boundary flow** between the multiprocess and
   that machine element,
5. takes over the camera's **threats, attack trees, measures, assets and assumptions**, read-only,
6. leaves to the machine what depends on the machine: impact, context-dependent likelihood factors,
   risk treatment of handed-over risks, the status of the camera's assumptions in this machine.

**All interfaces of the component are always used.** An interface the machine would not draw still
exists physically (a USB service port, a debug header); dropping its threats would lose exactly the
analysis that is reused. The import therefore always brings every boundary flow; reachability in
the machine is expressed through the machine's context factors (exposure, window of opportunity),
not by omitting flows.

Cardinality: a machine can import **several components**; the same component can be used **several
times** in one machine (two cameras → two instances, §6.4) and by **several machines**. Component
and machine TARA may live in **separate repositories** with separate audit trails.

Scope for 0.19: **internal teams only** (user 2026-11-07) — the import needs the full component
TARA. Components from external suppliers who do not hand over their internals need a reduced
profile (§15, not in 0.19).

## 2. Scope & non-goals

In scope:
- Import of a committed component TARA into a multiprocess with child page(s), EE mapping,
  read-only imported content with provenance.
- Threats, attack trees, measures, assets, assumptions taken over; machine-side rating of impact
  and context factors; AoU checklist per instance.
- Pinning (commit + content hash), change detection, update / rollback with reconciliation preview.
- Audit: the machine TARA stays verifiable without the component repository.

Non-goals:
- **Editing component content in the machine.** Changes are made by the component team and come in
  through an update (§9).
- **Impact transfer.** The component team cannot know the damage in a machine (§7.3).
- **Safety hazards** of the component. Each TARA keeps its own hazard analysis; the machine may link
  its hazards to imported assets (§7.5).
- **Two versions of one component in one machine** (user 2026-11-07: not supported, §6.4).
- **Browser mode** — not supported at present; the import is an Electron feature (needs git and file
  access, D6 below).
- **External suppliers** with a reduced profile (§15).
- **Additional flows** on an imported multiprocess that the component TARA does not know (Q3,
  §6.3).

## 3. Why a pinned import, not a link or a free copy

`multi-diagram-linking-design.md` §8 parked the "proper" version because copied state across
independently versioned files always drifts. That holds for **mutable** state. It does not hold for
an **immutable, pinned snapshot** of a committed state:

| | Free copy of project data | Live link to project | Pinned import (this doc) |
|---|---|---|---|
| What crosses | arbitrary, then edited | everything, unpinned | the component TARA at one commit, read-only |
| Drift | silent | silent, every open differs | explicit: pin vs. branch tip (§9) |
| Audit | not reproducible | not reproducible (other repo) | reproducible (embedded + hash, §8) |
| Reuse n:m | no | yes, but unstable | yes |

The import behaves like a dependency in a lockfile: the machine pins commit *X* of the component,
sees that a newer analysis exists, and decides when to move.

## 4. What is imported

### 4.1 Source requirements (D6, D8)

- The source is a component `.tara.json` inside a **git working copy**. The file must be
  **committed and clean**; a dirty file blocks the import (no draft imports).
- Stored with the import: `repoUrl` (the remote URL of the component repo — never a local path),
  the **branch** the commit was taken from, optional **tag pattern** (§9.1), the **commit sha**, the
  component's project id and name, its schema version.
- The local path of the component checkout lives in `localStorage` only (same hybrid as repo
  discovery and `LocalCheckoutHint`); nothing path-like enters the machine's `.tara.json`.
- **Schema:** a component TARA with an older schema is migrated on import (the normal migration
  chain, in memory); a component written by a newer TARAflow is refused.
- **Cycles:** a component whose project id equals the machine's, or that contains the machine
  through its own imports (§6.5), is refused.
- Any TARAflow project can be imported; no project tag is needed. It must have at least one flow
  between its system and an EE, otherwise there is nothing to connect.

### 4.2 The snapshot

The machine embeds a **snapshot**: the analysis-relevant parts of the component project, in the
machine's schema, written in TCS canonical form (`canonicalStringify`), with its content hash. It
is not a new exchange format — it is the component's own data model, reduced:

| Part | Imported | Notes |
|---|---|---|
| DFD (all pages, elements, properties) | yes | becomes the child page(s), read-only (§6) |
| Threats incl. relevance decision and rationale | yes | no regeneration (Q2, §7.1) |
| Attack trees | yes, read-only | incl. attack-path threats (§7.1) |
| Likelihood factor values of the risks | **intrinsic factors only**, raw | §7.2 |
| Impact values, risk levels, aggregated feasibility | **no** | rated by the machine (§7.3) |
| Risk treatment | reduce → measures; share / transfer → handed over (§7.4) | |
| Mitigations, cybersecurity goals, claims | yes, read-only, with status | §7.4 |
| Assets incl. CIANAAA | yes, read-only | per instance (§7.5) |
| Assumptions of the Item Definition | yes | AoU checklist (§7.6) |
| Methodology fingerprint | derived | §7.2 |
| Hazards, Item Definition sections, tickets, audit trail, people | **no** | |

Texts stay in the language of the component project; they are not translated.

## 5. Machine side — the import flow

1. **DFD → "Import component TARA"** (on any page). File picker for the component `.tara.json`;
   checks of §4.1.
2. If the component is **already imported** (same project id), see §6.4.
3. **Instance prefix**, e.g. `CAM1`, proposed from the component name, unique in the project (E9).
4. **EE mapping dialog** (E1): every EE of the component that has a flow into the component must
   be mapped — to an **existing** machine element (any type, also another imported multiprocess) or
   **taken over as a new element** (default; created as EE on the parent page with the component's
   name). One machine element may stand for several component EEs (e.g. "PLC" for "Controller" and
   "Configuration tool"). The mapping is complete before the import finishes.
5. TARAflow creates the multiprocess, its child page(s), the boundary flows on the parent page and
   the imported threats / assets / measures / AoU entries — one commit-gate change.

## 6. DFD structure

### 6.1 Multiprocess and child page

The import uses the leveled DFD (`doc/Done/DFD/leveled-dfd-multi-diagram-design.md`): the imported
multiprocess is a decomposed multiprocess whose child page shows the component's top page; deeper
component pages become deeper child pages. v2's rule "bound **or** decomposed, never both" (D3) is
obsolete: an imported multiprocess is both, by construction.

- The multiprocess itself belongs to the machine: name, position, its number (`MP-n`) and its
  parent-page context are machine data. Its "inside" fields (D-30c) are hidden as for every
  decomposed multiprocess — the child page describes the inside (v2 §15 point 5a).
- The multiprocess shows the provenance in the details panel (component name, commit, tag if any,
  imported on) and offers **"Open component TARA"** when a local checkout is known (the navigation
  of the old linking design, §12).

### 6.2 Read-only child pages (Q1)

- The child pages are **derived from the snapshot**. The machine cannot edit them: cells are locked
  in the editor, and on save the pages are re-rendered from the snapshot. A divergence found in the
  XML (e.g. edited in external draw.io) is a consistency finding and is repaired from the snapshot,
  like the leveled DFD repairs label divergence from the logical record.
- The component's EEs appear on the child page as **context copies of the mapped machine
  elements**. The component's boundary flows are defined on the parent page (multiprocess ↔ machine
  element) and appear on the child page with their inner endpoint; endpoint stitching (leveled
  design §6.2, "deepest wins") resolves them to the component element. Balancing therefore holds
  by construction.
- Flow properties of boundary flows (protocol, data, security tabs) come from the component and are
  read-only; the machine may route them on the parent page (layout only).

### 6.3 No additional flows (Q3)

The machine cannot attach a flow to an imported multiprocess that the component TARA does not
know. If the machine needs another interface, the component team adds it to its TARA and the
machine updates (§9). A flow drawn to the multiprocess anyway is an error finding
`CMP_FLOW_NOT_IN_COMPONENT` and is excluded from threat generation.

### 6.4 Several instances, one state per component (E12)

- The component is identified by the **project id** of its TARA. A machine holds **exactly one
  state per component** (user 2026-11-07: two versions of a component are not supported).
- **Same state imported again** (a second camera): the snapshot is not embedded twice. A new
  **instance** is created: its own multiprocess, its own child page(s), prefix (`CAM2`), EE mapping,
  threats, risks, assets and AoU status. Threats are per instance because location and exposure can
  differ.
- **Newer state on a second import:** "Component is imported at state *X*. Update all instances to
  *Y*?" — yes runs the update preview for all instances together (§9.2); no creates the new
  instance at *X*.
- **Older state:** only as an explicit rollback, with a warning and the same preview.

### 6.5 Nested components (E8)

If the component TARA itself imported other components (e.g. a sensor in the camera), they come
along **as they are**: part of the camera's snapshot, rendered as deeper child pages. They are not
updated separately — only through an update of the camera. The cycle check of §4.1 covers the
nested project ids.

### 6.6 Numbering (E9)

- Imported elements and threats keep the component's display ids with the **instance prefix**:
  `CAM1:P-3`, `CAM1:DF-7`, threats `CAM1:P3-S-1`. They stay traceable to the component TARA.
- The machine's renumber action does **not** touch imported pages; it numbers the multiprocess and
  the boundary flows on the parent page like any machine element.
- Identity is never the display id: imported elements keep the component's `tfId`s, namespaced per
  instance (deterministic hash of instance id + component `tfId`), so two instances never collide
  and ids stay stable across updates.

### 6.7 Deleting an instance

Deleting the multiprocess removes the instance: child pages, threats, risks, assets, AoU status.
A confirmation lists what goes. The snapshot is removed with the last instance.

## 7. Threats, risks, measures

### 7.1 Threats are taken over (Q2, Q4)

- Every threat of the component (all generators: per element, per interaction, attack paths) is
  taken over per instance — text, STRIDE category, relevance decision and rationale. **No generator
  runs on imported elements or imported boundary flows**: regenerating would duplicate the analysis
  and drop the component team's decisions.
- Machine elements connected to the boundary flows (the PLC) get their own threats as usual.
- Threat id: deterministic hash of (instance id, component threat UUID) — stable across updates as
  long as the component threat keeps its UUID; the display id never takes part.
- Text, relevance and attack trees are read-only, provenance shown (`CAM1 · camera system @ commit
  · T-12`). Risks of imported threats come through the **normal risk sync**; orphaned risks are
  deleted, as everywhere in TARAflow (v2 §15 point 3).
- Attack trees are read-only (Q4). Their leaf ratings follow the methodology rule of
  §7.2.

### 7.2 Feasibility — methodology rule (D5, decided 2026-11-04)

Likelihood factors are global per project: every risk of the machine is rated with the same
method, the same active factors and the same scales. Imported risks are therefore rated in the
**machine's** methodology, never in the component's. Converting an aggregated level between
methods is not traceable and is not done.

**Factor class.** Every likelihood factor definition gets a `factorClass`:

| Class | Factors (ids in the code) | Who rates it |
|---|---|---|
| intrinsic | Standard: `skill_level`, `ease_of_discovery`, `ease_of_exploit` · ETSI TVRA: `knowledge`, `expertise`, `time`, `equipment` · EN 50742: `attacker_capability` · ISO/SAE 21434: `iso_elapsed_time`, `iso_expertise`, `iso_knowledge`, `iso_equipment` | the component — taken over as raw value |
| context-dependent | Standard: `motive`, `opportunity`, `size`, `awareness`, `intrusion_detection` · ETSI TVRA: `etsi_opportunity`, `etsi_intensity` · EN 50742: `window_of_opportunity`, `exposure_level` · ISO/SAE 21434: `iso_window_of_opportunity` · `deployment_scope`, `attack_tree_likelihood` | always the machine |

Custom factors default to context-dependent; the analyst can classify them. (v2 named a
"benefit (IEC 62443)" factor: there is none — IEC 62443 has no likelihood method of its own in
TARAflow; the methods are `weighted-mean`, `en-50742-a`, `iso-21434`, `etsi-tvra`.)

**Methodology fingerprint.** Derived, never edited: the likelihood method plus, per active
intrinsic factor, a `scaleHash` = 12-hex FNV-1a over the canonical JSON of that factor's scale
definition (levels and numeric values). Per factor and method-independent on purpose; the calc
stamps' `mappingVersion` is not used (it hashes the whole risk configuration incl. the impact scale,
is project-wide and exists only under ISO/SAE 21434). Impact scale, risk matrix and thresholds are
not part of the fingerprint.

- **Same fingerprint:** the component's intrinsic factor values are **prefilled**, marked
  `source: "component"` with the commit. The machine can override a prefilled value; a rationale is
  mandatory. Context-dependent factors are rated by the machine as for its own threats.
- **Different fingerprint:** the import still runs. Every factor that cannot be taken over 1:1 stays
  **unrated**; the component's values are shown read-only beside the factor (method, factor, value)
  as a hint. Info finding `CMP_METHOD_MISMATCH` on the instance; warning `CMP_FACTOR_UNRATED` per
  imported threat until all of its factors are rated.
- **Partial overlap:** a factor whose id **and** `scaleHash` are identical on both sides is
  prefilled even on a fingerprint mismatch. Since factor ids belong to one method (`iso_…`, ETSI
  `time`, …), this applies in practice to the same method with a changed scale of another factor,
  and to custom factors — not across methods.

No conversion tables between methods in this version. A factor-level mapping registry can be added
later without changing the snapshot, because it carries raw factor values; such mappings would be
TARAflow extensions and be listed in the report's methodology section.

### 7.3 Impact

Impact belongs to the damage scenario and is rated by the machine, on the imported assets of the
instance (§7.5). The component's impact values are not imported: the same threat can be negligible
in one machine and severe in another. An imported threat whose asset has no machine impact yet
stays unrated.

### 7.4 Measures and handed-over risks (E2, E3)

- **Reduce** in the component: its mitigations, goals and claims come along read-only, attached to
  the imported risk, **with their status**. The machine does not create tickets for them.
  - `implemented` / `verified`: count as implemented in the machine.
  - any other status: warning `CMP_MEASURE_PENDING` "depends on a component release" on the risk.
- **Share / transfer to the integrator** (a claim with `responsibleParty`): the risk arrives
  **untreated** in the machine, the component's claim shown as the reason. Warning
  `CMP_HANDOVER_OPEN` until the machine decides the treatment.
- **Retain / accept** in the component: arrives untreated as well — acceptance is a decision in the
  context of the machine.
- The machine can add its own measures to any imported risk (e.g. a firewall in front of the camera).

### 7.5 Assets (E5)

- Component assets are imported **per instance** (`CAM1:` prefix), read-only in name, group and
  CIANAAA. The machine adds damage scenarios and impact.
- The machine may link its **hazards** to imported assets. This covers a safety function
  implemented inside the component (v2 §15 point 5c): it is a function asset of the component, its
  severity (reversible / non-reversible / fatal) is rated by the machine.
- EN 50742 approach A paths to a safety function continue through the imported child pages like
  through any leveled DFD — the component's DFD is part of the machine's effective model.

### 7.6 Assumptions on the integrator (E4, D7)

Each assumption of the component's Item Definition becomes a checklist entry **per instance**:

```ts
interface ComponentAssumptionStatus {
  instanceId: string;
  assumptionId: string;    // component Assumption.id (display ASM-nn with prefix)
  status: "open" | "fulfilled" | "not_fulfilled" | "not_applicable";
  evidence?: { elementIds?: string[]; mitigationIds?: string[]; note?: string };
  rationale?: string;      // mandatory for not_applicable
}
```

`open` → `CMP_AOU_OPEN` (warning), `not_fulfilled` → `CMP_AOU_VIOLATED` (**error**): the component's
analysis is not valid in this machine until resolved. The component's own assumption status
(`open` / `confirmed` / `invalid`) is shown beside it as information.

## 8. Findings, compliance, audit

### 8.1 Findings on imported content (E6)

- The DFD validator and the Compliance tab run over imported elements too — they are part of the
  system. The IEC 62443 / CRA matrix evaluates them with the **machine's** settings, so the
  component's properties are evidence automatically.
- Findings on imported elements are shown but marked **"owned by component CAM1"**; the machine
  cannot fix them there. Findings on the boundary (EE mapping, flows on the parent page) belong to
  the machine.
- Component claims can be cited as evidence in requirement-matrix rows like the machine's own
  claims (v2 §15 point 5b), without automatic evaluation.

### 8.2 Audit — separate repositories

- The snapshot is embedded in the machine's `.tara.json` (D1): report, CLI reporter and AVE never
  need the component repository.
- New AVE check `component-import`: snapshot canonical and its hash matches the import record →
  `CMP_SNAPSHOT_HASH_MISMATCH` (error); child pages consistent with the snapshot.
- Optional, when the component repo is reachable: the commit exists and the component's own AVE
  passes at that commit — informational; the component trail is the component team's
  responsibility.
- diff-service: import record, instances, EE mapping, AoU status, machine ratings of imported
  risks are semantic content → commit gate + commit message detail lines. Import, update and
  rollback are one change each.

### 8.3 Report (E10)

- Imported threats, risks and measures appear **in the normal tables**, with provenance (prefix,
  component).
- One section per imported component: name, repo, branch / tag, commit, imported on, instances with
  their EE mapping, AoU status, pending measures, methodology match.

## 9. Change detection and update (E11)

### 9.1 Detecting a newer state

- The import stores repo URL, branch, optional tag pattern, commit and snapshot hash.
- The check reads the component TARA at the **branch tip in the local checkout**; `git fetch` only
  on request, no automatic network access.
- **Content decides, not the commit:** a newer state exists only if the analysis-relevant content
  differs (the same semantic comparison as the commit gate, diff-service). A commit that changes
  only layout or unrelated files is not a newer state.
- **Tag pattern (optional):** e.g. `camera-tara/v*` — then only tagged states are offered, i.e.
  releases of the component team instead of every intermediate commit.
- Result on the import: `up_to_date` / `newer_available` (info) / `unreachable` (info, no checkout
  or branch missing).
- **Never automatic.** Taking the newest state silently would change ratings and risks unnoticed;
  an update is always an explicit action and one commit in the machine repo.

### 9.2 Update and rollback

- Preview over **all instances** together, per item: **new / unchanged / changed / obsolete** for
  elements, flows, threats, measures, assets, assumptions (pattern of the leveled-DFD threat
  reconciliation, D9). Ratings are never transferred automatically to new items; changed threats
  are flagged for review.
- **New EEs / boundary flows** in the component need a mapping in the preview (§5 step 4).
- **Risks follow their threats:** obsolete threats lose their risks; the preview lists the risks
  that will go (rating, treatment) before the update is confirmed, and the audit diff names them.
- **Manual pairing obsolete ↔ new:** a threat whose component element was deleted and re-created
  arrives as one obsolete plus one new. The analyst can pair them (as in the leveled-DFD assignment
  dialog): the machine threat keeps its id, risk and machine ratings and is flagged changed.
  Explicit, never automatic; the update commit lists each pairing.
- **Rollback** to an older state uses the same preview, with a warning.

## 10. Data model (schema 14)

Additive fields; a `migrate-13-to-14` only where data is reshaped (schema 13 is closed with 0.18).

```ts
// project level
interface ComponentImport {
  id: string;
  componentId: string;          // project id of the component TARA
  name: string;
  source: {
    repoUrl?: string;           // remote URL, never a local path
    branch?: string;
    tagPattern?: string;
    tag?: string;               // tag of the imported commit, if any
    commitSha: string;
    schemaVersion: number;      // of the component file before migration
  };
  importedAt: string;
  methodology: MethodologyFingerprint;
  snapshot: ComponentSnapshot;  // canonical, §4.2
  contentHash: string;          // over canonicalStringify(snapshot)
}

interface ComponentInstance {
  id: string;
  importId: string;
  multiprocessTfId: string;
  prefix: string;               // "CAM1"
  eeMapping: { componentEeId: string; machineTfId: string }[];
  assumptions: ComponentAssumptionStatus[];
}

interface MethodologyFingerprint {
  likelihoodMethod: string;
  factors: { factorId: string; scaleHash: string }[];  // active intrinsic factors, by factorId
  hash: string;
}

// RiskFactorDefinition
factorClass?: "intrinsic" | "context";   // absent = context

// on imported risk factor values
source?: "component";                    // prefilled from the snapshot (§7.2)
```

## 11. Architecture

Every feature stands alone — no imports between features (user 2026-11-07); what several features
need goes to `shared/`, what reads several features' data lives in the app layer.

- `shared/models/component-import-types.ts`: the feature-agnostic types — `FactorClass`,
  `FactorScaleDefinition`, `MethodologyFingerprint`, `ComponentImport`, `ComponentInstance`,
  `ComponentAssumptionStatus`.
- `shared/utils/methodology-fingerprint.ts`: `scaleHash`, `buildMethodologyFingerprint`,
  `compareFingerprints` — pure, without factor knowledge.
- `features/risks` owns the factors: `factorClass` on the factor definitions, `factorClassOf`,
  `factorScaleDefinition` / `intrinsicFactorScales` (the scale of a factor as the calculation
  reads it), exported through its barrel.
- App layer: `app/models/component-snapshot-types.ts` (the snapshot, typed with the features' data)
  and `app/services/component-import/snapshot-builder.ts` (`buildComponentSnapshot`,
  `snapshotContentHash`, `projectMethodologyFingerprint` — joins the risks scales with the shared
  fingerprint). Later phases: import checks, instance rendering, update preview.
- New feature `features/components` (from phase 1): the UI only — import dialog, EE mapping
  dialog, AoU checklist, update preview; imports only `shared`.
- The app layer bridges: builds the imported threat references per instance and feeds them to the
  threat sync (like `build-attack-path-threat-references.ts`), suppresses the generators on imported
  elements, feeds imported measures to the risk view, AoU / measure findings to the findings panels.
- Git access (clean check, sha, remote, branch tip, tags) through the existing Electron git service.
- All user-facing text via i18n (en/de).
- Examples: own examples only — SmokeDetector as component, a small "fire alarm panel" as machine
  importing it twice. No customer models in docs, tests or fixtures.

## 12. Relation to `multi-diagram-linking-design.md`

That doc's navigation (open the linked project, path in `localStorage`) becomes the "Open component
TARA" action of an imported multiprocess (§6.1). The separate `linkedProject` field is not
introduced; the import record carries the identity. The linking doc moved to `doc/Old/` with v3.

## 13. Implementation phases

Each phase ships on its own and leaves the app consistent.

**Phase 0 — Model and snapshot builder.** Schema 14 types, `factorClass` on all factor definitions
(§7.2 table), fingerprint with `scaleHash`, pure snapshot builder, canonical hash, unit tests
against the SmokeDetector example.
*Done (patch 04, 2026-11-07):* placement per §11; the scale of a factor follows the calculation —
ISO/SAE 21434 Table G levels + points, EN 50742 EL / AC levels + scores (en-50742-a), ETSI TVRA
levels + points (etsi-tvra), otherwise the project's likelihood scale. The snapshot also drops
timestamps (`created`, `lastModified`, `statusChangedAt`), the DFD's derived data (graph, stats,
validation, thumbnail) and an asset's `protectionNeed` (a rating in the component's context, like
impact), so a save without analysis change keeps the hash. The schema bump to 14 moves to phase 1,
with the first stored field (the import record); phase 0 stores nothing. Tests use the cnc-ref
(weighted mean, rated factors) and Headlamp (ISO/SAE 21434) fixtures — the SmokeDetector fixture
has no rated factors.

**Phase 1 — Import into the DFD.** Import action, source checks (clean, committed, schema, cycle),
already-imported handling (§6.4), prefix, EE mapping dialog, multiprocess + read-only child pages +
boundary flows, numbering with prefix, `CMP_FLOW_NOT_IN_COMPONENT`, delete instance, "Open component
TARA".

**Phase 2 — Threats and risks.** Bridge into the threat sync per instance, generators suppressed on
imported elements, attack trees read-only, assets per instance, prefill / unrated per fingerprint,
impact from the machine.

**Phase 3 — Measures and assumptions.** Imported measures with status, `CMP_MEASURE_PENDING`,
handed-over / accepted risks untreated, `CMP_HANDOVER_OPEN`, AoU checklist per instance with
evidence.

**Phase 4 — Findings and compliance.** Ownership marking of findings on imported elements, matrix
evaluation over imported elements, component claims as matrix evidence, hazards on imported assets.

**Phase 5 — Change detection and update.** Drift check (content, tag pattern), update preview over
all instances incl. new EE mappings, pairing, rollback.

**Phase 6 — Audit and report.** AVE `component-import`, diff-service detail lines, report section
per component, provenance in the tables.

## 14. Testing

- Snapshot: contains threats, attack trees, intrinsic factors, measures, assets, assumptions; no
  impact, no risk levels, no context factors, no hazards; canonical round-trip; identical project →
  identical hash.
- Import checks: dirty file, newer schema, cycle (direct and nested) refused; older schema migrated.
- DFD: every boundary flow created; EE mapping mandatory, one machine element for several EEs;
  child pages read-only and repaired from the snapshot; extra flow → `CMP_FLOW_NOT_IN_COMPONENT`;
  renumber leaves imported pages alone.
- Instances: second import of the same state reuses the snapshot; distinct, stable threat ids per
  instance; newer state offers the update of all instances; no second state of one component.
- Methodology: same fingerprint → intrinsic factors prefilled with provenance, context factors
  unrated; different fingerprint → unrated + hint, `CMP_METHOD_MISMATCH`, `CMP_FACTOR_UNRATED`;
  identical id + `scaleHash` prefilled across a mismatch; an impact-scale change on the component
  side leaves the fingerprint unchanged.
- Measures: implemented counts, pending → `CMP_MEASURE_PENDING`; share / transfer / accept arrive
  untreated → `CMP_HANDOVER_OPEN`.
- AoU: per instance, `not_fulfilled` → error, `not_applicable` needs a rationale.
- Update: new / unchanged / changed / obsolete; ratings never copied; pairing keeps id, risk and
  ratings; listed risks deleted; content-only drift (layout commit is not newer); tag pattern.
- AVE: tampered snapshot, non-canonical snapshot, child page diverging from the snapshot.
- diff-service: import, mapping, AoU status, update open the commit gate.

## 15. Outlook — external suppliers (not in 0.19)

Components of external suppliers who do not hand over their internal DFD need a **reduced
profile**: interfaces, threats seen from outside, assumptions, capabilities, intrinsic factors —
the v2 *Component Security Profile* (export rule "reachable / handed over / override with
rationale", capabilities instead of internally reduced threats). It would be imported into a
multiprocess the same way, with a profile-shaped child page instead of the full DFD. Decided when
needed; the snapshot / fingerprint / AoU / update parts of this design are meant to be reused.

## 16. Decisions

All decided with the user on 2026-11-04 (D5) and 2026-11-07 (all others).

| # | Topic | Decision |
|---|---|---|
| D1 | Where the imported content lives | Embedded in the machine's `.tara.json` with content hash (§8.2) |
| D2 | Export rule | **Obsolete** in v3 — the whole component TARA is imported; kept for the supplier profile (§15) |
| D3 | Bound vs. decomposed | **Obsolete** — an imported multiprocess is decomposed by construction (§6.1) |
| D4 | STRIDE on the imported multiprocess | No generator on imported elements and boundary flows; threats are taken over (§7.1) |
| D5 | Methodology | Intrinsic factors as raw values, fingerprint, prefill on match, re-rate on mismatch, no conversion (§7.2) |
| D6 | Source state | Committed and clean only; no draft imports; Electron only (§4.1) |
| D7 | AoU violation | `not_fulfilled` is an error (§7.6) |
| D8 | Repo URL | Taken from the component repo's remote at import, stored in the import record (§4.1) |
| Q1 | Child page editable | Read-only, re-rendered from the snapshot (§6.2) |
| Q2 | Threats taken over or regenerated | Taken over (§7.1) |
| Q3 | Extra flows on the multiprocess | Not allowed (§6.3) |
| Q4 | Attack trees | Taken over, read-only (§7.1) |
| Q5 | External suppliers | Internal teams only in 0.19 (§15) |
| E1 | EE mapping | Mandatory; default "take over as new element"; one machine element for several EEs (§5) |
| E2 | Risks and measures | Impact not imported; measures read-only with status; pending → warning; no tickets (§7.3, §7.4) |
| E3 | Share / transfer to the integrator | Arrive untreated, warning until decided (§7.4) |
| E4 | AoU | Checklist per instance, `not_fulfilled` = error (§7.6) |
| E5 | Assets | Read-only per instance, machine adds impact, may link hazards (§7.5) |
| E6 | Findings on imported elements | Shown, marked as owned by the component; matrix evaluates them (§8.1) |
| E7 | Source state / browser | Committed and clean; browser mode not supported at present (§4.1) |
| E8 | Nested components | Come along as they are, updated only with the outer component (§6.5) |
| E9 | Display ids | Component ids with instance prefix, untouched by the machine's renumber (§6.6) |
| E10 | Report | Normal tables with provenance + one section per component (§8.3) |
| E11 | Change detection | Content-based against the branch tip, optional tag pattern, never automatic (§9.1) |
| E12 | Several imports of one component | One state per component; same state → new instance; newer → update all; older → explicit rollback; two versions not supported (§6.4) |

## 17. Open points found during implementation

| # | Found | Point | Proposal |
|---|---|---|---|
| I1 | Phase 0 (2026-11-07) | **Migration must be deterministic.** Old component files get fresh ids on every migration: migrate 4→5 and 5→6 (and 6→7 on an id collision, the legacy asset-link lift) use `crypto.randomUUID` — e.g. the schema-2 cnc-ref fixture gets new threat UUIDs each time. Migrated on import (§4.1) and again on every drift check or update, the same component state would give different threat ids → every imported threat "obsolete + new", ratings and risks lost. | Decide before phase 1: the import migrates the file twice and compares the snapshot hashes; if they differ, it refuses with "open and save the component TARA in TARAflow ≥ 0.19 and commit it first". Generic, no list of affected schema versions to maintain. |

