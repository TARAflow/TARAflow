# TARAflow — Multi-Project TARA (Component Import) — Design

Status: **v3 · 2026-11-07 · decided; phase 0 done (patch 04), phase 1 done (patches 05–10), phase 2 done (patches 11–17), manual-test and review fixes 18–37; phase 3: 3a done (patch 38), 3b done (patch 39), 3c done (patch 40), 3d-1 done (patch 41), 3d-2a done (patch 42), 3d-2b done (patch 43), evidence rule (patches 45, 46) — phase 3 complete; phase 4: 4a-1 done (patch 47), 4a-2 done (patch 48), 4a-3 done (patch 49), 4b done (patch 50), 4a-4 done (patch 51), 4c done (patch 52), 53 — phase 4 complete; phase 5: 5a done (patches 54–56; per import, rollback via git revert decided), 5b done (patches 57, 58), 5c done (patches 59–63), 5d = git revert + "discard update" (no own patch); component overview: 69 (`about`), 70 (Overview tab "Components"), 71 (refresh the stored state), 72 (no credentials in URLs), 73 (stored credentials flagged) done; phase 6 cut 2026-11-11 (6a-1 … 6d): 6a-1 done (patches 74–77), 6a-2 done (patches 78, 79), 6a-3 done (patches 80, 81), 6b done (patch 82), 6c next (dialog, discard, review list) (delta and the inventory of machine decisions)** · target release **0.19**, project
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

- The source is a component `.tara.json`, normally inside a **git working copy**, **committed and
  clean** — then the import is **pinned** to that commit.
- **Unpinned import (user 2026-11-07, revises D6/E7):** a file outside a repository, untracked or
  with uncommitted changes is imported anyway, *unpinned*: no commit, branch or tag, the reason is
  recorded (`unpinned: "no_repo" | "untracked" | "dirty"`), only the content hash identifies the
  state. The import asks for an explicit confirmation, the machine shows a permanent warning
  `CMP_SOURCE_UNPINNED` on the import, the report names it. Useful for trying the mechanism and for
  teams without git; an audited machine should pin its components.
- Stored with the import: `repoUrl` (the remote URL of the component repo — never a local path),
  the **path of the file inside its repository** (`path`, e.g. `components/camera.tara.json` —
  needed to read the file at the branch tip), `sameRepo` when the component lies in the machine's
  own repository, the **branch** the commit was taken from, optional **tag pattern** (§9.1), the
  **commit sha**, the component's project id and name, its schema version.
- **Same repository as the machine** (likely the common case, one repository per product line):
  works like any other repository; `sameRepo` lets "Open component TARA" and the drift check find
  the file without a stored local path, and the AVE check "commit exists" runs offline. A repository
  without a remote has no `repoUrl`; the drift check then needs `sameRepo` or the local checkout
  path.
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
| Overview (`about`): description, responsible, tags, safety relevance, Item Definition texts and functions, source bindings (repo, ref, pinned commit) | yes, read-only | user 2026-11-11: the machine's Overview shows it per component (tab "Components"), the report (§8.3) uses it; pinned and hashed — a changed description is a newer state |
| Methodology fingerprint | derived | §7.2 |
| Hazards, tickets, audit trail, the team; the Item Definition texts' links into the component model, the functions' asset links, the source bindings' drift log and credentials | **no** | |

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
- **Shells on the parent page (I4).** The component's outer boundaries — those every part of the
  component is inside (by the analysis' membership; a trust boundary without the interfaces, which
  sit on its border, D14) — appear around the multiprocess on the parent page as **attached copies**
  (link role `ref`, `attached`) of their definitions on the component's (locked) page: the machine's
  top page shows the case and the trust zone the component brings, but they stay the component's
  (user 2026-11-08). An attached copy may sit above its definition (no `BAL_HOME_NOT_HIGHEST`) and
  goes with it: once the component's page is deleted, the child-page step removes it instead of
  leaving a dangling boundary in the machine. Inner boundaries (e.g. a chip that not every interface
  is on) stay on the child page only. Position and size on the parent page are machine layout; the
  analysis is unchanged (inheritance is additive, the children are inside them on the child page
  anyway).

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

**Attack paths (ISO/SAE 21434).** The window of opportunity of a component attack path is
context-dependent: a path is rated **only with the machine's rating** (per instance and pathKey),
and its attack potential and feasibility are computed with the **machine's** feasibility
configuration (weights, bands, likelihood model) — never the component's. Without the machine's
rating the path stays unrated: no feasibility, no attack-path threat, no likelihood
(`CMP_PATH_WINDOW_UNRATED`); the component's value is offered as a suggestion and taken over only
explicitly. Quick-mode paths (no factor breakdown) cannot be rated per path and make no risk
(`CMP_PATH_NOT_RATABLE` — the component rates them in audit mode).

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
- The check reads the component TARA **as committed at the branch tip** (`git show <branch>:<path>`),
  never the working copy — an uncommitted edit of the component team in the same checkout is not a
  newer state. `git fetch` only on request, no automatic network access.
- **Unpinned imports** have no branch to look at: the check compares the content hash of the file
  at the local path (remembered in `localStorage`) and offers it as a newer state when it differs;
  still never automatic.
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

Additive fields in one optional block `project.components`
(`ProjectComponents { imports: ComponentImport[]; instances: ComponentInstance[] }`, shared types);
`migrate-13-to-14` is a version fence without data change (an older release would drop the block on
save), reporting no analysis change. The repair path keeps the block; the audit diff shows imports
(without the snapshot — the content hash stands for it) and instances; the TARA verification hash
includes the block when present.

```ts
// project level
interface ComponentImport {
  id: string;
  componentId: string;          // project id of the component TARA
  name: string;
  source: {
    repoUrl?: string;           // remote URL, never a local path
    path?: string;              // path of the file inside its repository
    sameRepo?: boolean;         // the machine's own repository
    branch?: string;
    tagPattern?: string;
    tag?: string;               // tag of the imported commit, if any
    commitSha?: string;         // absent when unpinned
    unpinned?: "no_repo" | "untracked" | "dirty";
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

**Phase 1 — Import into the DFD.** In four patches: 05 schema 14 + source loader, 06 DFD
generation (pure), 07 import UI, 08 read-only + rest. No developer switch (nobody works on an
untagged build), but no release tag before phase 2. Until the update path (phase 5) a second import
with a newer state creates the instance at the existing state, with a hint.
*Patch 05 done (2026-11-07):* `project.components`, schema 14 fence, repair / diff / verification
hash; `readComponentSource` (app layer, injected git runner and file reader; Electron adapters via
the one git path `git:rawInDir`) with the checks valid project, git working copy, tracked, clean,
schema not too new, migration deterministic (I1), and the source record (commit, branch, remote,
tag — never the local path); `isComponentCycle` over nested components (the snapshot keeps the
component's own `components` block, §6.5).
*Patch 10 (2026-11-07):* read-only pages and instance lifecycle (user 2026-11-07: "just implement it,
using it will tell whether it is right"). The pages of imported components are locked in the editor
— the draw.io plugin's `isCellLocked` / `isCellDeletable` / `isCellEditable` / `isCellConnectable`
read the page ids pushed by `drawio:setLockedPages` (Electron). A change that gets in anyway (e.g.
external draw.io) is detected, not repaired yet: `CMP_COMPONENT_PAGE_CHANGED` (warning: component
elements missing, foreign definitions on the component pages) — the repair comes with the update
path (phase 5), which re-renders the instance. Deleting the multiprocess removes the instance with
the next DFD save (and the import with its last instance) and says what went; no confirmation
before (draw.io deletes at once — undo before the save, the audit diff names it); an instance
whose multiprocess was never saved stays (`CMP_INSTANCE_ORPHANED`). "Open component TARA" in the
details of an imported multiprocess (name, prefix, source): the file is found from the machine's
repository root + the path in the repository (`sameRepo`), otherwise from the local path remembered
at import in `localStorage` only, and opened as a further project (`openProjectFile` in the project
context).
*Patch 09 (2026-11-07):* findings and numbering. App layer `component-findings.ts`, shown with the
DFD's own findings (DFD tab: toolbar chip and notification panel, `externalFindings`):
`CMP_SOURCE_UNPINNED` (warning, on the instance's multiprocess), `CMP_INSTANCE_ORPHANED` (error —
the multiprocess is gone, e.g. the DFD save of the import was refused; closes the open point of
patch 08), `CMP_FLOW_NOT_IN_COMPONENT` (error, Q3 — the instance's boundary flows are recomputed with
`componentInstanceTfId`). The renumber skips the pages of imported components (`lockedPageIdsOf`
over the instance's and the component's own multiprocesses): the component's ids keep their prefix,
the multiprocess and the boundary flows are numbered, copies of machine elements on the component
page follow their definition. Fixed from patch 07: the instance prefix is now written into the
idlabels (it only reached the records, the save read the ids back without it); boundaries keep their
label-borne display id unprefixed. The phase-bar badge does not count the component findings yet.
Patch 10: read-only component pages (draw.io plugin lock, repair from the snapshot), delete an
instance, "Open component TARA".
*Patch 08 (2026-11-07):* import UI. DFD toolbar "Import component TARA…" (only with the
Electron draw.io plugin); the DFD tab hands the diagram as it is in the editor and the page shown
to the app (`ComponentImportRunner`), the result becomes the base of the save (`primeBase`), is
loaded into draw.io and saved — the renumber pattern. New feature `features/components` (UI only,
imports `shared`): the import dialog — file, source summary, unpinned warning with a mandatory
confirmation, multiprocess name, prefix (valid and unique), EE mapping (default: take over as new
element; options: the mappable elements on the page shown), hints for an existing import (E12) and
for flows that will not resolve (I2). App layer: `import-flow.ts` (candidate, mappable elements,
default prefix, `applyComponentImport`) and `useComponentImport` (dialog state, Electron reading,
`project.components` written on confirm). A second import of the same component reuses the import
and its state. The instance is recorded when the import is confirmed — a refused DFD save leaves an instance
without its multiprocess (finding `CMP_INSTANCE_ORPHANED`, patch 09).
*Patch 07 (2026-11-07):* `insertComponentInstance` (features/dfd, pure, XML in / out): the
multiprocess with its page link, the component's pages as child pages (ids per instance, FNV-1a of
instance id + component id), EEs as context copies of the mapped machine elements or of new EEs on
the parent page, boundary flows defined on the parent page with their occurrence on the child page,
EE → EE flows dropped, records with the component's properties. Display ids with the instance
prefix; the multiprocess and the boundary flows get the machine placeholders (MP-xx, DF-xx).
Asset relations of elements and flows are not taken over yet (assets per instance come with
phase 2, E5). Checked through the real save path (parse, links, effective model, findings): one
record per logical element, boundary flows resolve to the inner element, no balancing or page-tree
error — except I2.
*Patch 06 (2026-11-07):* unpinned import (no repository, untracked, uncommitted) with its reason;
`path` in the repository and `sameRepo` in the source record; drift reads the committed state.
Then: import action, source checks (clean, committed, schema, cycle),
already-imported handling (§6.4), prefix, EE mapping dialog, multiprocess + read-only child pages +
boundary flows, numbering with prefix, `CMP_FLOW_NOT_IN_COMPONENT`, delete instance, "Open component
TARA".

**Phase 2 — Threats and risks.** Plan (2026-11-07, with the review of the other instance):
- *Patch 11* `fix(components)`: the snapshot drops the per-goal impact and consequence of the
  security goals (damage scenarios) and the asset mirror's protection need — a phase-0 gap; it
  changes the snapshot hash, so components imported on the branch before read as changed.
- *Patch 12* generators off on instance elements (`excludedElementIds` on the threat data, read by
  every generator / sync / drift path incl. the phase badge). Boundary flows by
  `interactionContext.victimRole`: victim = the component element → the component's threat is
  imported; victim = the EE side (now a machine element) → the component's threat is dropped and the
  machine generator produces it on that flow, for that role only. Per-element threats on the flow
  itself belong to the component; the machine end keeps its own element threats. Threats of the
  component on its EEs are never imported — an EE becomes a machine element (E1) whose threats the
  machine generates.
- *Patch 13* assets per instance (E5): the import takes over the component's asset mirror with
  instance ids and prefix and remaps the elements' asset relations; the DFD→asset sync creates the
  store records; deleting the instance purges them.
- *Patch 14* imported threats as ONE pure read model `componentThreatReferences(project)`
  (app/utils) — derived per instance from the embedded snapshot, never stored (D1: one source,
  nothing drifts; like the attack-path threats). Consumers, connected in this or the named phase:
  risk sync and the read-only section in the Threats tab (14), threat ↔ goal links (14), findings
  (phase 4), compliance matrix (phase 4, E6), report incl. provenance (phase 6, E10), CLI reporter
  (phase 6 — it can use the read model, the snapshot is embedded). Risk ids stay stable
  (`R-<instance threat id>`).
- *Patch 15* relevance override on boundary-flow threats (I3): stored per instance, rationale
  mandatory, component decision shown beside it, diff-detected (test: the commit gate opens).
- *Patch 16* prefill of the intrinsic factors per fingerprint (§7.2, `source: "derived"` — the
  override chip exists), `CMP_METHOD_MISMATCH` (info), `CMP_FACTOR_UNRATED` (warning).
- *Patch 17* ISO/SAE 21434: in an ISO machine only attack-path threats make risks, so the
  component's attack trees are derived per instance too — tree ids hashed per instance before
  deriving (`buildThreatId(tree.id, pathKey, stride)` would collide for two instances). The window of
  opportunity is a path rating there and context-dependent (§7.2): the machine rates it in an overlay
  per instance and pathKey (like `pathAssessments`), with a path list to rate in this patch; the
  read-only tree view follows later. `CMP_NO_ATTACK_PATHS` (warning) when an ISO machine imports a
  component without attack trees (e.g. EN 50742) — otherwise it would get no risks, silently.

*Patch 12 done (2026-11-07):* `ThreatProjectData.excludedElementIds` (app layer:
`componentExcludedIds` — the instance tfIds of the component's elements except its EEs and of its
flows except EE → EE). Read in `generateThreatsForElement` (every per-element path incl. data flows
and boundaries), `getEffectiveStrideCategories` (sync "missing"), the per-element missing-flow
check, the per-interaction flow loop (a perspective is skipped when its victim is excluded —
sender → source, receiver → target; a flow with both ends excluded is skipped), the interface loop
and the per-interaction missing-flow / missing-interface checks. Passed to the Threats tab and the
phase-badge drift. Threats generated for instance elements before this patch now show as drift
("obsolete") and can be removed there.

*Patch 13 done (2026-11-07):* assets per instance (E5). `insertComponentInstance` takes the
component's DFD asset mirror over as instance assets (`instanceAssetId`, prefixed display ids) and
remaps the elements' and flows' asset relations to them; links to the component's EEs and to
dropped EE → EE flows are left out. The import also adds the component's asset records to the
store — name, group, security goals from the snapshot (impact already dropped there), linked to
the instance elements, `importedFrom: "<prefix> · <component>"` — so the asset sync finds them and
the machine rates their impact and damage scenarios. Deleting the instance purges them (the sync
never removes store records). Not yet: the Assets tab does not lock name / group / goals of an
imported asset (only the `importedFrom` marker is stored) — with the ownership marking (phase 4).

*Patch 14 done (2026-11-07):* `app/utils/component-threats.ts` — the read model:
`componentThreatData` (one table per method and instance, `[<prefix>]`), `componentThreatGroups`
(Threats tab), `componentThreatReferences` (risk register), `withComponentThreats` (stored + imported
for whole-data consumers). Per instance: ids `componentInstanceTfId(instance, "threat|" + id)`,
element / flow / boundary / asset references and display ids remapped; threats on the component's
EEs and on dropped EE → EE flows, and per-interaction threats whose victim is the EE side, are not
taken over; text, STRIDE and relevance as the component decided. Connected: risk sync (the Risk
tab's per-element / per-interaction references include them — risks `R-<instance threat id>`),
threat ↔ goal links, the read-only section "Threats from imported components" in the Threats tab
(above the method's tables, per instance). Still to connect (as planned): findings and matrix
(phase 4), report and CLI (phase 6). ISO machines: only attack-path threats make risks — patch 17.

*Patch 15 done (2026-11-07):* relevance override on boundary-flow threats (I3).
`ComponentInstance.relevanceOverrides` (`threatKey` = the component's threat id, `relevance`,
`rationale`, `componentRelevance` at the time, `date`); `withRelevanceOverride` (rationale mandatory,
remove = back to the component's decision). The read model applies an override only to a threat
on a boundary flow (component flow with exactly one EE end — per-element flow threats and
per-interaction threats on it); a stored override on an internal threat has no effect. The Threats
tab section shows the component's decision struck through beside the machine's, "Override" /
"Change" only on boundary-flow rows, a dialog with relevance (both directions) and mandatory
rationale, "Back to the component's decision"; an override whose component decision changed since
is marked "to review" (`stale`). Raised to relevant, the threat gets a risk through the normal sync.
The audit diff sees the change with the instance (test: the commit gate opens). Not yet: the report
section "Deviations from the component's assessment" (phase 6) and the update preview listing
stale overrides (phase 5).

*Patch 16 done (2026-11-07):* prefill per fingerprint (§7.2). `componentFactorPrefills` (read model):
per import `compareFingerprints(component, machine)` → the intrinsic factor values of each imported
risk that may be taken over, keyed by the instance threat id; attached to the risk references as
`ThreatReference.factorPrefill`. The risk sync (`applyFactorPrefill`) fills them as derived values
(`source: "derived"`, `derivedFrom: "component"`) on new and existing risks; an override keeps its
value (only the derived value follows, so "reset" returns to the component's current value).
The risk dialog labels the origin "Component" and asks for a rationale on an override
(`FactorRating.overrideRationale`, saved with the rating). Findings: `CMP_METHOD_MISMATCH` (info),
`CMP_FACTOR_UNRATED` (warning, with a mismatch, imported risks with unrated intrinsic likelihood
factors), `CMP_FACTOR_OVERRIDE_RATIONALE` (warning). Found and fixed on the way: the audit diff did
not compare a risk's factor ratings at all (only the calculated values, priority and mitigations) —
a rationale or a value change that leaves the risk value unchanged left the commit gate silent; it
now lists "Factor ratings" (before / after mitigation) as a change (test: the commit gate opens on a
rationale alone).

*Patch 17 done (2026-11-07):* ISO/SAE 21434. `app/utils/component-attack-trees.ts` derives the
component's attack trees per instance — tree id hashed per instance before deriving (path threat ids
`AT-<instance tree id>-<pathKey>-<S>` cannot collide), anchor asset / threat / risk remapped, tree
names and path-threat display ids with the prefix. The Risk tab gets their path threats and tree
likelihoods next to the machine's own. Window of opportunity: `ComponentInstance.pathOverlays`
(treeKey, pathKey, level, date) — the path's attack potential and feasibility are recomputed with
the machine's rating (audit-mode paths with the factor breakdown; quick-mode paths are rated on the
tree). The rating list is shown in the Attack Tree tab (generic `extraSection` slot, the UI in
`features/components`), ISO projects only; the read-only tree view follows later. The audit diff
sees a rating with the instance (test: the commit gate opens). `CMP_NO_ATTACK_PATHS` (warning) for an
ISO machine importing a component without asset-anchored attack paths. Paths under an AND gate:
the overlay changes the leaf's factors; the gate's combined quantity is not recomputed — noted for
the update / report work.
Phase 2 done with patch 17 — the first tag is possible again.

*Patch 18 done (2026-11-07, manual test):* the import's save is committed at once. The import
primed the base of the next save and left the save to draw.io's autosave; until that autosave the
project prop still held the page tree before the import, and the thumbnail save after the autosave
(`persistence.save`, which read the prop) refused the new child page as not adopted
(`ID_ADOPTION_PENDING`). Confirming "Adopt pages" re-linked the copies by display id — the EE copies
came back, the boundary flows (`DF-xx`, no real display id) did not: their child-page occurrences
became flows of their own, the parent-page flows ended on the multiprocess (`BAL_MISSING_PARENT_FLOW`,
invalid flow ends). Now `persistence.commitXml` saves the import's XML with its records at once and
hands it on before draw.io loads it (replaces `primeBase`), and `save()` uses the freshest base like
`savePages` and the autosave.
*Patch 20 done (2026-11-07, code review):* attack paths rated by the machine only (§7.2). Before,
a path without the machine's overlay kept the component's window of opportunity and feasibility —
the component's context judgement entered the machine's risks silently; and overlays were computed
with the component's feasibility configuration, the tree data for the likelihoods carried the first
instance's configuration for all. Now unrated and quick-mode paths have no feasibility (no threat,
no likelihood; `CMP_PATH_WINDOW_UNRATED`, `CMP_PATH_NOT_RATABLE`), the machine's configuration is
used throughout, the trees' aggregates (most feasible path) follow the machine's ratings, and the
rating section offers the component's value as an explicit "Take …". Threat / attack-tree data of
the read models are built complete (no casts). Test added for the sync and the generator seeing the
same stitched ends of boundary flows (no false "missing" in the drift badge) — they do; no code
change. Noted for E10 (phase 6): the factor prefill marks `derivedFrom: "component"` without the
instance or commit; the report's provenance wants the commit.
*Phase 3 plan (2026-11-08, reviewed):* 3a measures and handovers of the component (§7.4), 3b AoU
checklist per instance (§7.6), 3c measure → AoU dependency on the component side, 3d effectiveness
and residual risk (I7). Decided for 3c: the dependency lives on the assumption
(`Assumption.mitigationIds`, the measures relying on it) — catalog ids (M-S-…) and the component's
project mitigations (M-C-nnn, stable ids since the catalog rework) alike; legacy free-text measures
have no id and must be converted to a project mitigation first; ids that no longer resolve get a
finding in the component and are not exported in the snapshot; the reverse direction is shown
read-only at the measure in the risk dialog ("relies on ASM-03"), in the component and the machine.
For 3d: effectiveness needs the AoUs derived as met AND the measure's status implemented / verified (a
pending measure counts like "unclear"); a component assumption marked "invalid" by the component makes
its measures not effective in every instance; with the same measure on two risks, the status of this
risk decides (until the measure-ownership rework).
*Patch 38 done (2026-11-08, phase 3a):* the component's treatment of each imported risk
(`componentTreatments`, app read model): reduce → its measures read-only with their status
(implemented / verified count; others pending → `CMP_MEASURE_PENDING`, "depends on a component
release"); share / transfer / accept → the risk arrives untreated, the component's claims shown as the
reason, `CMP_HANDOVER_OPEN` until the machine sets its own treatment (an own measure, or a treatment
other than reduce with a justification — a justification alone does not decide). Shown in the risk
dialog above the risk's own mitigations through a generic slot (`RiskDialogProps.extraSection`,
`RisksTab.riskExtraSection`; the UI in features/components). The machine adds its own measures as for
any risk. Release notes (PLAN): the safety card for people / physical / infrastructure assets (patch
37); report (phase 6): both relevance decisions written out.
*3d cut (2026-11-08, reviewed):* 3d-1 derives and shows the effectiveness (no analyst decision yet);
3d-2 brings the machine's override "not effective here" together with its effect on the residual
risk (an override that changes nothing would be worse than none). 3d-2 reads the residual risk
through one function of the risks feature (e.g. `creditedResidual(risk, uncredited)`, the app layer
passing a generic "do not credit" set with reasons — the pattern of `excludedElementIds`); every
reader that evaluates or shows a residual risk goes through it, except those meaning the stored
values (editing the after-values, the audit diff, serialisation); a source guard test (like the
single-writer guard of prepare-for-disk) allows direct reads of `calculatedRiskAfterMitigation` only
from an allow list. "Acceptance to review" is derived, not stored (user 2026-11-08): it disappears by
itself once the residual risk counts again.
*Patch 46 done (2026-11-09, review of patch 45):* "implemented" for evidence means implemented /
verified on EVERY machine risk choosing the measure (rejected choices aside) — the status is still
kept per risk, so one firewall may be implemented on risk A and open on risk B; the stricter reading
holds until the measure ownership design keeps one status per measure. Evidence no machine risk
chooses never gets a status or a ticket: `CMP_AOU_EVIDENCE_NOT_CHOSEN` ("choose the measure on the
risk it treats") instead of `CMP_AOU_MET_BY_PENDING`; the assumption stays unclear meanwhile.
*Patch 45 done (2026-11-09, review of patch 42 with the user):* credited is only what is
implemented, in both directions. An assumption of use marked "fulfilled" with machine measures as
its evidence counts for the effectiveness only once those measures are implemented / verified on a
machine risk; until then the component measures relying on it are unclear (reason
`aou_evidence_pending`, naming the measures) and the residual risk is not credited. Derived — the
stored status stays "fulfilled", `CMP_AOU_MET_BY_PENDING` stays and says the consequence. The closed
loop drives the crediting directly: the evidence measure's ticket open → not credited; closed, status
implemented → the residual counts. Not built (decided 2026-11-09): a per-risk declaration "residual
rated without the component's measures" for a machine that temporarily compensates a component measure
not delivered yet (case (a): a measure inside the component reaches the machine only with a new
component revision, phase 5) — the machine waits for the revision; built only if the case occurs in
practice. The source guard documents that the report is credited at its data entry
(`docResidualView`, reached by the app's transform and the CLI) and checks the CLI's entry too
(patch 44 made the CLI use the app's transform).
*Patch 43 done (2026-11-09, phase 3d-2b):* the machine override (I7 (5)).
`ComponentInstance.measureOverrides` ({measureId, rationale, date}; optional, no schema bump — absent
means none): the machine marks a component measure "not effective here" per instance — downgrade only,
rationale mandatory, withdrawn the same way (`withMeasureOverride`). Keyed by the measure id, so it
acts on every risk of the instance relying on that measure; free-text measures (no id) and rejected
ones cannot be marked. The treatments read model makes a marked measure not effective with the reason
`overridden_here` (the rationale) — so 3d-2a does the rest: the residual risk is not credited, the
banner, the report note and the ticket text name the rationale. Edited in the component's treatment
section of the risk dialog ("Not effective here…", rationale field, "Withdraw"). Findings
`CMP_MEASURE_OVERRIDDEN` (warning: the signal to the component team that an AoU is missing; an
overridden measure no longer also counts under `CMP_MEASURE_NOT_EFFECTIVE`) and
`CMP_MEASURE_OVERRIDE_UNKNOWN` (a mark on a measure the component no longer chooses — acts on
nothing; the update path, phase 5, will list it). The audit diff detects it with the instance (test
with the commit gate); copying ratings takes it with the decisions (I7 (6)). The report section
"Deviations from the component's assessment" follows in phase 6.
*Patch 42 done (2026-11-08, phase 3d-2a):* the residual risk is credited only while the component's
measures hold (I7 (4)). `creditedResidual(risk, uncredited)` lives in `shared/services` (not in the
risks feature as sketched: the report reads it too, and features do not import each other); the app
layer derives the set once (`uncreditedResiduals` in the treatments read model: risk id → measure,
instance, state, causes — every chosen component measure not effective or unclear in the instance).
Under ISO/SAE 21434 a component risk on an attack-path threat is mapped to the instance's path threat
(`AT-<instance tree>-<pathKey>-<stride>`), so the rule applies per attack path. Not credited = the
values before treatment count (riskAfter, factor ratings, ISO residual); the stored after-values stay.
Readers: the Risk tab provides the set by context (`useCreditedOf`) to the I × L and H.8 matrices,
the register columns (with a marker and its reasons), the ISO scenario roll-up and the dialog sidebar;
the After tab shows a banner ("Not credited: M-C-012 of the component in SD2 not effective (ASM-03 not
fulfilled)") above the ratings, which stay editable. The report applies it once at transform time —
`docResidualView`, called by the app's `doc-transform` and the CLI's `toDocProjectData` alike (a test
compares both outputs) — and adds "Not credited: …" next to the residual. The ticket text keeps the
stored target value and adds "Residual risk currently not credited: …". "Acceptance to review" is
derived: banner line and `CMP_ACCEPTANCE_TO_REVIEW`. The source guard
(`credited-residual-guard.test.ts`) allows stored reads only from an allow list with reasons; the
findings files may check completeness only — a value check goes through `creditedResidual`.
*Patch 41 done (2026-11-08, phase 3d-1):* effectiveness of the component's measures per instance,
derived in the treatments read model (`effectivenessOf`): effective (implemented / verified and every
assumption it relies on fulfilled or not applicable here — none relied on counts as effective), not
effective (an assumption not fulfilled here, or invalid in the component), unclear (not implemented
yet, or an assumption still open here); rejected measures count neither way. Shown at each component
measure of an imported risk with its reasons ("not effective here: ASM-03 not fulfilled"), "unclear"
told apart from "not effective". Findings `CMP_MEASURE_NOT_EFFECTIVE` and `CMP_MEASURE_UNCLEAR` (open
assumptions; pending alone stays `CMP_MEASURE_PENDING`) name measure and assumption. No stored data —
nothing for the diff or copying.
*Patch 40 done (2026-11-08, phase 3c):* the dependency of a measure on assumptions, maintained in the
component. `Assumption.mitigationIds` (shared): the measures whose effectiveness relies on the
assumption — catalog ids and project mitigations (M-C-nnn); free-text measures have no id. Edited in
the Item Definition's assumptions card (a multi-select of the project's measures — its project
mitigations and the measures its risks chose, `projectMeasureOptions`; also outside ISO in the neutral
wording) and shown read-only there ("Measures relying on it: …"). Ids the project no longer has give
`ITEM_ASSUMPTION_MEASURE_UNKNOWN` (warning) and are not exported in the snapshot. The reverse direction
is shown at the measure: "relies on ASM-03" in the risk dialog's mitigations (from the project's own
assumptions — the component's and the machine's own risks alike) and in the component's treatment
section of an imported risk (from the snapshot's assumptions).
*Patch 39 done (2026-11-08, phase 3b):* the assumptions of use per instance (§7.6, I7 (2)/(6)). The
multiprocess's details panel shows the component's assumptions as a checklist of the instance
(`instanceAssumptions`, `withAssumptionStatus`; UI `ComponentAssumptionsChecklist` in
features/components through the details panel's `renderExtra` slot): status open / fulfilled / not
fulfilled / not applicable, the component's own status beside it, evidence (this machine's measures —
its project mitigations and the measures its risks chose — and a note), "not applicable" only with a
rationale (asked first, then saved). Findings: `CMP_AOU_OPEN` (warning), `CMP_AOU_VIOLATED` (error —
the component's analysis is not valid here until resolved), `CMP_AOU_MET_BY_PENDING` (fulfilled backed
by a machine measure not implemented on any of its risks — no status coupling). The audit diff sees the
status with the instance; copying ratings takes it as a decision (open entries are none). Evidence by
machine elements stays in the data model, its picker comes later.
*Patch 37 done (2026-11-08, manual test steps 6–9):* three details. (1) Asset dialog: people,
physical and infrastructure assets always show the safety card (harm to them is what safety is
about), with where the value comes from — safety annotations in the DFD or hazard items in
safety-relevant projects, else the manual override; other assets keep hiding it while it cannot be
set (patch 29). (2) Threats tab: an overridden imported threat showed "machine: not_relevant" beside a
struck-through "relevant" — now one chip with the relevance that counts (translated): the
component's outlined, the machine's override filled with an edit mark and a tooltip naming the
date, the rationale and the component's decision. (3) Risk dialog: the rationale of an overridden
component factor is collapsed to exactly one line when written (whole text in a tooltip), expanded
to edit; empty (it is required) it opens expanded.
*Patch 35 done (2026-11-08, review of 32–34):* copying ratings takes only the machine's decisions:
factor ratings with source "manual" (incl. the overrides of prefilled factors with their rationale)
or without a source. Derived values ("derived" from the Asset Tab or the DFD — e.g. the EN 50742
exposure level from the anchor's boundary crossing — and "attack-tree") belong to the target's own
context: copying them made the recalculation use the source's position until the next sync re-derived
or reset them, and the toast counted them as copied. The sync derives them for the target.
Phase 2 closed (review). Open question for phase 3 (asked by the review): can a component capability
chosen as a measure hold per instance differently — implemented by the component, but tied to an AoU
that instance 2 does not meet? Then measure status and AoU status belong together in the data model.
*Patch 34 done (2026-11-08, I6):* window of opportunity per step of an AND combination. The
steps of one combination often sit in different contexts (one over the network, one with physical
access) — the window is exactly the factor that varies per step. `ComponentPathOverlay.leafId`
gives a step its own window; a path-wide entry (earlier overlays) still applies to every step
without its own. The combination is rated once every step has a window: the sum over the steps'
potentials with their windows, banded with the machine's configuration; until then it is unrated
(`CMP_PATH_WINDOW_UNRATED`). The rating list shows one row per step (its name, the component's
window of that step as the suggestion); copying ratings carries the step windows along.
*Patch 33 done (2026-11-08, I5):* copy ratings between instances. The multiprocess's details panel
offers "Copy ratings from another instance…" when another instance of the same import exists
(threat keys, path keys and factors match only within one state). Options: decisions (likelihood
factors of the imported risks — context factors and the overrides of prefilled intrinsic factors
with their rationale —, relevance overrides, windows of opportunity; default on) and asset impact
(the instance assets' ratings and the risks' impact factors; default off); mode "fill" (default —
only what the target has not rated) or "overwrite". Copied once; afterwards the instances are
independent (no live coupling, no inheritance level). Risk treatment stays out (phase 3). The copied
risks are recalculated (`recalculateRiskValues`, risks feature), the assets through the asset
service; a toast counts what was copied.
*Patch 32 done (2026-11-08, review of 26–31):* follow-ups before copying ratings. (1) The two texts
of the grouped view are in en/de (they only had default values). (2) A click on an instance's line
opens that instance's copy read-only (its decision, its names), browsing its threats; a click
elsewhere on the row stays with the first instance. (3) Boundary-flow threats named the component's
EE at the outer end for every instance — `remapThreat` maps sourceName / targetName of an EE end to
its machine counterpart, and the instance's line shows the counterpart ("↔ PLC"); the read model
takes the machine's elements for the names. (4) Quantity: the asset dialog of an instance asset with
more than one unit asks whether the impact covers all units failing together (the same weakness hits
every unit at once); the quantity at the risk in the report is noted for phase 6. Release note
(PLAN): the safety card is hidden while it cannot be set — for every asset (patch 29).
*Patch 31 done (2026-11-08, I5):* the Threats tab groups the imported threats per component. A
component with several instances shows each threat once — id and element without the instance
prefix — with a line per instance: its relevance (the component's, struck through when overridden),
the machine's override with its rationale, "to review", and the override button on boundary-flow
threats acting on that instance. A click opens the threat read-only (the first instance's copy,
browsing the component's threats once). A component with one instance keeps the instance table. The
read model names the component of every instance group (componentKey, componentLabel, prefix).
*Patch 30 done (2026-11-08, manual test, I5):* quantity and the "imported already" question. An
instance can stand for identical units in the same installation context (`ComponentInstance.quantity`,
absent = 1): one child page, one set of threats and risks, the quantity in the instance labels
("SD1 · Smoke Detector ×4"), in the import dialog and in the multiprocess's details panel (editable);
the audit diff sees it with the instance. A second import of the same component asks first in a dialog
of its own (the hint in the form was easy to miss): raise the quantity of an existing instance (same
place, same connections — no DFD change) or add a further instance (other context), with the note
when the file is another state than the one imported.
*Patch 29 done (2026-11-08, manual test):* two asset-tab details. The safety criterion card showed
without a value and could not be set (no derived safety impact, no manual override) — it is hidden
until there is something to show or set (the override checkbox brings it back). The ID column cut
prefixed display ids ("SDC1:DA-001") in half — it grows with the longest id, the chip shows the full
id as tooltip.
*Patch 28 done (2026-11-08, manual test):* the instance assets can be rated. They came with empty
impact ratings (the component's impact is dropped, E5) and the asset dialog listed only the rows
the asset carries — no criterion to rate, only the manual safety override. The import now gives
every instance asset one unrated row per criterion of the machine's asset configuration (as a new
asset gets), and the asset dialog shows every configured criterion for any asset (missing rows
unrated; existing files are repaired when the asset is opened and saved). Note for phase 4: the
read-only lock of imported assets must leave impact and the machine's goal fields editable.
*Patch 27 done (2026-11-08, review):* AND combinations of component attack paths. The open note
("the overlay changes the leaf's factors; the gate's combined quantity is not recomputed") turned
out worse on a test: an AND combination (FX-6) carries no factor breakdown of its own, so it was
counted as quick mode and stayed unrated forever — the component contributed no risk for it. Its
potential is the sum over its leaves (the calculator's AND → SUM); the leaves' factors come from the
tree's DSL (deterministic node ids). The machine's window is applied to every leaf and the sum
banded with the machine's configuration; the rating section offers the component's window only when
all steps agree. Single-leaf paths are never under an AND (an AND yields combinations only), so no
other path was affected.
*Patch 26 done (2026-11-08, manual test + review):* shells as attached copies (§6.2, I4). The
shells were definitions on the parent page and stayed behind when the instance was deleted — an
orphaned trust / physical boundary that changes the membership of machine elements drawn into it.
Now they are `ref` copies with `attached: true` (DFDCellLink); their definitions stay on the
component's page; `BAL_HOME_NOT_HIGHEST` skips attached copies; `danglingAttachedCopies`
(child-pages step) finds those whose definition is gone and the orchestrator removes them through
draw.io once the component's page is deleted.
*Patch 25 done (2026-11-08, review of 23–24):* single-page DFDs explain the EE → EE scope too:
`DFD_EE_TO_EE_FLOW` (info) on every flow between two external entities, as the effective model
gives a leveled DFD — no threats in either method, existing ones listed as obsolete at the next
regeneration, "if one of the two belongs to the system, model it as a process or multiprocess".
Decided (user 2026-11-08): release note plus this finding, no extra dialog on open.
*Patch 24 done (2026-11-07, review of 21–22):* an override no longer hides the component's note:
the machine's rationale moved from `evalNote` into its own field (`Threat.importedOverride`:
component relevance, rationale, date); the read-only dialog shows "Component: <relevance> — <note>"
and, if overridden, "This machine: <relevance> — <rationale>" (I3: the component's decision stays
visible). The read-only dialog drops the ISO hint on asset-derived relevance (the relevance comes
from the component) and hides its controls uniformly by conditional rendering.
*Patch 23 done (2026-11-07, manual test):* EE → EE flows out of scope on every DFD. A machine with
threats lost three per-element threats on an EE → EE flow (Wifi Gateway → Update Server) when the
import made its DFD leveled: the effective model excludes such flows (`DFD_EE_TO_EE_FLOW`), the
single-page per-element generator did not; deleting the instance brought them back. Now the
per-element generator leaves EE → EE flows out on single-page DFDs too (`isEeToEeFlow`), as the
leveled model, per-interaction mode and the component import do, and the sync never reports them
missing. Existing single-page projects: a regeneration lists such threats as obsolete (release note).
*Patch 22 done (2026-11-07, manual test):* imported threats in the Threats tab. A click on an
imported threat opened nothing — it now opens the threat dialog read-only (`readOnly`: a note on the
source, no edit / add / delete controls, the fields disabled, the footer only navigates and closes,
nothing is saved), navigating within the instance's shown threats. The section shows only the active
method's threats (each read-model row names its method), so its count matches the machine's own
tables (it showed both methods: 157 instead of 80). UX note: the section is a collapsed accordion
above the empty state and easy to miss before the machine generates its own threats. New test for
the usual order — the machine has its threats and risks before the import: its threats survive
untouched (no orphan, removal or change), the sync adds nothing on the component's parts (boundary
flows: only the machine-side perspective), both methods are in sync afterwards, the machine's risks
stay and the imported ones join.
*Patch 21 done (2026-11-07, review of 18–20):* the machine's attack trees are a required input of
the component attack-tree read model (`attackTrees: … | null`) — a caller that forgot them rated
with the default bands silently; ties at the most feasible level go to the lowest attack potential
the machine computed (not the component's riskScore). Noted as open: a path's attacker benefit is
the component's; it acts on the likelihood only in the IEC 62443 model (a context quantity like
motivation) — to be decided if component trees are to feed 62443 machines.
*Patch 19 done (2026-11-07, manual test):* shells on the parent page (§6.2, I4).
`shellBoundaryIds` (features/dfd, pure) takes the membership from the component's dfd graph; the
shells are nested around the multiprocess (outer first, behind the machine's cells), their records
follow the parent-page geometry, the child-page cells become `ref` copies. Superseded by patch 26 (attached copies, removed with the component's page).

Further constraints (review 2026-11-07):
- The threats are derived, but the machine's own ratings on them are stored data: the WoO overlay
  per instance and pathKey (patch 17), the overrides of prefilled factors with their rationale
  (patch 16) and the relevance overrides on boundary flows (patch 15) get fields in
  `project.components` (schema 14) and must be detected by the diff-service — otherwise the commit
  gate stays silent (same failure class as compareLinkedElements). Patches 15, 16 and 17 each get a
  test that a change opens the commit gate.
- `pathKey` is a hash of the node-name chain root → leaf: a renamed node in the component's tree
  orphans every overlay entry below it after an update, silently. The update preview (§9.2) lists
  orphaned overlay entries like the risks that go, and the manual obsolete ↔ new pairing applies to
  paths too — for ISO components the most common "obsolete + new" case.
- Relevance of threats on boundary flows — decided I3: the machine may override, boundary flows only,
  with rationale, re-checked on update, reported back (own patch after 14).

Original scope: Bridge into the threat sync per instance, generators suppressed on
imported elements, attack trees read-only, assets per instance, prefill / unrated per fingerprint,
impact from the machine.

**Phase 3 — Measures and assumptions.** Imported measures with status, `CMP_MEASURE_PENDING`,
handed-over / accepted risks untreated, `CMP_HANDOVER_OPEN`, AoU checklist per instance with
evidence. Effectiveness of the component's measures per instance and its effect on the residual
risk: §17 I7 (decided 2026-11-08) — settled in the data model before the UI.

**Phase 4 — Findings and compliance.** Ownership marking of findings on imported elements, matrix
evaluation over imported elements, component claims as matrix evidence, hazards on imported assets.
*Cut and decisions (user with the second instance, 2026-11-09):* 4a ownership (4a-1 findings,
4a-2 asset lock), 4b matrix and hazards, 4c component claims citable.
- Boundary flows: the connection is the machine's, its properties come read-only from the
  component — a finding there belongs to whoever can fix it: structure (endpoints, connection,
  leveled identity) the machine, property values / label / protocol the component.
- Imported assets: name, description and DFD links are the component's. Security goals:
  the machine may ADD goal types (with a mandatory rationale) but not remove the component's
  (a type the component has active stays active); the level of a suggested goal still follows
  the impact, which is the machine's. The addition is derivable against the snapshot and goes
  into the report section "Deviations from the component" (phase 6).
- Matrix evidence from component measures: only measures EFFECTIVE in the instance (the I7 rule —
  credited is only what is implemented, from the component or the machine); "unclear" stays
  distinguishable from "planned" (planned: it is coming; unclear: an AoU lacks evidence — another
  action).
- Component claims cited by the machine: the citation is stored per instance; whether it counts as
  evidence is derived — only when the AoUs behind the claim are fulfilled in that instance with
  implemented evidence, otherwise shown as "unclear" like a measure.
*Patch 82 done (2026-11-12, phase 6b):* **AVE check `component-import`** (AVE v2): in every committed
`*.tara.json` each embedded snapshot must hash to its recorded `contentHash` (FNV-1a over the TCS
canonical form, as on import) — else `CMP_SNAPSHOT_HASH_MISMATCH` (error) at the commit that changed
it. Only the hash: the component pages are regenerated through the DOM, which the CLI, the Electron
main process and the hooks do not have — the app reports changed pages itself
(`CMP_COMPONENT_PAGE_CHANGED`, review 2026-11-12). **Found with the check:** the imported DFD records
shared their property objects with the snapshot, and the graph builder writes derived exposure levels
into element properties in place — the stored snapshot changed under its hash within the session of
the import. `insertComponentInstance` and the instance asset records now work on copies; a regression
test runs import, graph, read models, risk sync, save and load and checks the hash (fails without the
copy). A file already saved that way gets "Refresh stored state…" (`updateTargetOf` also on a damaged
snapshot). **diff-service:** an instance change is no longer "Component instance modified: n field(s)"
with `[object Object]` values but detail lines in the component's words — "ASM-01: open → fulfilled
[evidence: M-C-004, P-2 Comm]", "EE Controller: P-1 Alarm → P-2 Comm", quantity, relevance / measure
overrides, windows of opportunity, cited claims, reviews open; instances named "CAM1 · Camera system".
*Patch 81 done (2026-11-12, review of 80):* a sixth group, **factors rated anew** — an intrinsic factor
the component prefilled and this TARA rated differently ("skill level 2 → 4 — <rationale>"): the
component likely delivers the same rating to every other machine. **Cited claims are no deviation**:
listed apart under "This TARA relies on — a change affects it" (report: its own sub-section; Markdown:
its own part; Overview: its own block), so the platform team does not read a cited claim as a fault.
The revision signal is now tested against the asset check itself: an instance asset on a component
element, an added goal with a component threat (no signal) and one without (signal).
*Patch 80 done (2026-11-12, phase 6a-3):* **"Deviations from the component"** — per component ONE list
for its platform team, derived from the stored decisions (nothing new stored, `componentDeviations`):
goals this TARA added to a component asset (with "the component has no threat for it: request a new
revision" where the asset check finds no threat for the goal — patch 51), measures marked "not
effective here", assumptions of use not fulfilled (with this TARA's evidence), threat relevances
overridden, supporting claims cited; grouped in that order — what only the component can fix first —
with the instance prefix per line. The texts come from one shared formatter
(`shared/services/component-deviations.ts`, structured data in, texts through `t`): the report shows
the list as the last sub-section of each component in "Imported components" (the responsible from
`about` as the contact), the Overview's accordion shows it and copies it as Markdown in the app's
language ("Copy as text": title with component @ state, "For: <responsible>", one group per kind).
The evidence of an assumption has one form for both (`assumptionEvidenceOf`, `evidenceText`).
*Patch 79 done (2026-11-12, review of 78):* the assumptions table of an instance gets the
**evidence** — this TARA's measures with their state ("implemented", "not implemented yet", "chosen
by no risk"), its elements, the note: whether a component measure counts depends on it, and a reader
sees why a measure is "unclear" although its assumption is "fulfilled". **One measure on several
risks:** its status is kept per risk, so the reasons are united and the worse effectiveness wins
("not effective" before "unclear") — before, the first risk's reasons stood alone. A different
methodology names its consequence ("the component's factor values are not taken over; this TARA rates
them anew"). The casts over `imported.snapshot` in `doc-imported.ts` are gone (the error class of
patch 57).
*Patch 78 done (2026-11-12, phase 6a-2):* report chapter **"Imported components"** (after the item
definition; only with imports). The introduction says what the import means and states the credit
rule (I7): a component's measure counts only while the component implemented it and every assumption
it relies on is fulfilled in the instance with this TARA's evidence implemented — otherwise "unclear"
or "not effective", and a risk relying on it is reported with its value before treatment. One
section per component: description, version, responsible, tags, safety relevance, repository / file /
branch / tag / commit, imported on, last update, methodology match, source references. One
sub-section per instance: quantity, the EE mapping (component EE → machine element), the measures
"not effective here" / "unclear here" with their reasons (the same cause texts as the "not credited"
note), and the assumptions of use with this TARA's status and rationale. Built in the app layer
(`docImportedComponents`, on the Overview's view model and `componentTreatments`), one helper for all
formats (`importedComponentsReportSections`), the PDF included. The Documentation tab's chapter list
offers the threat chapters and the attack-tree chapter also when only imported content exists (the
same gap as in 74, in the tab).
*Patch 77 done (2026-11-12, review of 76):* a cell's steps break the line in every format like the
other multi-line cells of the report — `<br>` in Markdown and HTML, a hard break in AsciiDoc, `\n` in
the PDF; StrictDoc's list-table cells hold one line ("; "). The AsciiDoc path table had fixed five
columns — an imported tree's sixth (the factors per step) gets its own column widths.
*Patch 76 done (2026-11-12, review of 75):* the attack potential of an imported path can be
recomputed from the report. The structure stays without the component's leaf ratings; the path table
shows per step every factor that enters the potential, with its origin: "ET … · SE … · KoI … · Eq …
(component) · WoO … (rated by this TARA)" (or "WoO not rated yet — component: …"); an AND combination
one line per step (a line break in the PDF, "; " in the text formats); the abbreviations explained in
the section. `ComponentAttackPathRow.componentFactors` carries the component's four factors per step.
*Patch 75 done (2026-11-11, 6a-1b, review of 74):* (1) **ISO: the component's attack trees in the
report.** In an ISO/SAE 21434 machine the component's risks come from its paths; the attack-tree
chapter showed only the machine's own trees. Now per component and tree the structure once (without
the component's leaf ratings), the paths per instance ("SD1:AT-1.2", the attack-path threats'
numbering) with the window of opportunity per step and its origin ("rated by this TARA", else "not
rated yet — component: …"), attack potential and feasibility with this TARA's configuration, the
relevance (`docImportedAttackTrees`, `importedAttackTreeSections`). (2) **The counterpart always:**
a boundary threat names the machine element at the flow's outer end in its element column ("↔ Alarm
Processing Controller") also with one instance; per instance below only when instances differ. Per
element too: the counterpart is now computed for a threat whose element is the boundary flow (from
the component's connection) — the Threats tab shows it as well. (3) **The PDF** (its own converter,
`pdfmake-converter.ts`) had none of 6a-1: the imported threat groups, the provenance at the risk
(on its own line, `\n`, no literal `<br>`) and the imported trees are there now; the texts come from
one helper for every format (`imported-report.ts`). The PDF has no internal links at all (no link
annotations — also not for the machine's own threats); a click on a risk id does not jump there —
noted, not part of this patch.
*Patch 74 done (2026-11-11, phase 6a-1):* the report's threat chapters show the imported threats —
per component and method a group "Smoke Detector Case @ a1b2c3d4 — imported (SD1, SD2)", each threat
once (its id in the component), below it only the instances that differ: a relevance override of this
TARA ("SD2: relevance overridden by this TARA — relevant → not relevant: …"), another counterpart on
a boundary flow. Every instance threat id stays a link target of its risk row (further anchors in
the row: Markdown / HTML `<a id>`, AsciiDoc `[[…]]`; StrictDoc links by UID). The risk rows of
imported risks name their provenance below the risk before treatment: instance and component @
commit, the factors prefilled from the component, the factors this TARA rated anew (with the
rationale), the quantity ×n. Built in the app layer (`doc-imported.ts`, from the Threats tab's
read model) and handed to the generators through `computed`; the CLI report through the same
transform. The STRIDE method chapters appear also when only imported threats exist.
*Patch 73 done (2026-11-11, review of 72):* a source reference **stored** with credentials (source
bindings exist since before 0.19 — a token may sit in customer projects; the editor only refuses new
ones): the Overview's Sources view says so at the reference — clean the URL **and revoke the token**
at the provider, it stays in the git history — and the Sources tab counts it. Tokens as query
parameters (`?private_token=`) are not detected (rare for git remotes; noted in the function).
*Patch 72 done (2026-11-11, review of 69):* **no credentials in URLs.** `snapshotAbout` copied the
source bindings' URLs unchanged — `https://user:token@host/…` would have gone into every machine
importing the component, its repositories and reports; the component's remote URL
(`ComponentSource.repoUrl`, from `git remote get-url`) likewise (a clone over `https://token@…`).
`withoutUrlCredentials` (shared): http(s), git, … drop the whole user part; ssh drops the password and
keeps the user; the scp form `git@host:path` stays. Used by the snapshot builder, the source reader
and — for snapshots taken before — the Overview's view model. Capture: the Overview's source
reference editor does not save a URL with credentials (red hint, Save disabled); private
repositories use stored credentials (`credentialRef`).
*Patch 71 done (2026-11-11, review of 69):* **refresh the stored state.** Correction of patch 69's
note: a pinned import taken before does not show a newer state — the check rebuilds the imported
commit with the running builder (patch 54) and says up to date with `builderChanged`, and no update
was offered: the stored snapshot (without `about`) could never take in what the newer builder reads.
Now `updateTargetOf`: a newer state as before, or — builder changed, pinned — the imported commit
again; the component section offers "Refresh stored state…", the normal update onto that commit
(preview, reviews, commit lines as for any update; the delta mostly empty or only `about`). The same
for every future builder change. Unpinned imports compare the stored hash and see a newer state
anyway. Texts of the builder-changed hint and the Overview's "overview missing" point to the button.
*Patch 70 done (2026-11-11, user):* the machine's Overview has a tab **"Components"** — only while
something is imported. One accordion per import (a machine can carry several; the first open), in a
list that scrolls on its own. Per component, read-only and in its language: description,
responsible, tags, safety relevance; where the component TARA comes from (repository or "this
repository", file, branch / tag, commit, imported on, last update); the methodology match (same
fingerprint as the machine or not); the component's own source references; its Item Definition texts
and functions; the instances with their assumptions of use ("1 of 2 decided, 0 not fulfilled") and
"Show in DFD" (selects the multiprocess). The drift status as a chip; a newer or diverged state counts
on the tab. App layer: `componentOverviewItems` builds a flat view model (`ComponentOverviewItem` in
the Overview's types) — the Overview does not import the component feature.
*Patch 69 done (2026-11-11, user):* the component's overview crosses — `snapshot.about`:
description, responsible (the contact for revision requests; not the team), tags, safety relevance,
the Item Definition texts with their document reference (without `modelRefs`), the functions
(without the asset link), the project source bindings (repo, ref type and label, pinned commit; no
drift log, no credentials). In the hash: a changed description is a newer state, and the update
dialog names it ("The component's overview changed …"). Imports taken before carry no `about` (0.19
unreleased, no migration); their next check shows a newer state once. Next (patch 70): the
Overview's tab "Components".
*Patch 64 done (2026-11-10, found on the example project):* deleting an instance removes the risks of
its imported threats too (incl. attack-path threats) and the goals' / claims' references to them.
Before, the instance's assets and pages went, but its risks stayed — stored records the risk sync
never removes (the example machine carried 52 orphaned `SDC1:` risks after step 11 of the manual
test). `RemovedComponentInstance.threatIds` from the import's snapshot (`instanceThreatKeys`).
*Patch 63 done (2026-11-10, review of patch 62):* "Discard update" asks first — it restores the whole
state before the update, so everything changed since then (confirmed reviews, ratings, DFD) goes too.
Always asked, not only when something changed since: a reliable detection is not trivial (the DFD
commit after the runner creates new objects anyway), and a question that comes only sometimes is
worse than one that always comes. "Cancel" is the default (focused), the action button says what it
does ("Discard"). No partial rollback — "the whole state back" stays the rule. 5d needs no patch of
its own: the rollback after saving is git revert, before saving "discard update".
*Patch 62 done (2026-11-10, phase 5c-2):* the update in the app. The component section offers
"Update…" for a newer state; the update runs through the DFD tab's runner path like the import (the
DFD outcome committed and loaded into draw.io there — one way into the editor), the other stores are
written by the app. The dialog (features/components, presentational) over every instance of the
import: what changed in the component; every new EE needs a decision — mapped to a machine element on
the instance's page or taken over as a new EE — before Apply (no silent default, review 2026-11-10);
pairings offered UNCHECKED, one new item per obsolete one; what applying does — "afterwards N
decisions to review", the decisions dropped by kind, the tickets losing their risk — computed by a dry
run of the very `applyComponentUpdate` "Apply" runs (`updatePreview`, `updateInputOf`,
`updateOutcomeOf`), so the numbers shown are the numbers applied; the tag pattern is set here. Texts
through i18n from the structured delta — never the English lines of `lastUpdate` (comment on the
field: only the last update, the history is git's). "Discard update" while not saved: the WHOLE
project as before (all stores and the DFD through the same runner path, not each change undone), and
the drift status returns to "newer available" by itself (the import's content hash is back); once
saved, the rollback is git revert. Right after applying the drift check runs again (the hash changed)
and reports up to date. The open reviews (`openReviews`) are listed in the component section with the
item in the component's words and "Confirm" (`withReviewConfirmed`).
*Patch 61 done (2026-11-10, phase 5c, groundwork for the dialog):* the newer state found by the drift
check is read for the update at exactly that commit (`readNewerComponentState`, `git show`, never the
working copy; an unpinned import from its path), with the source record moved to it — after applying,
the drift check says up to date (tested against a real repository, the same test the dialog relies
on). Pairing candidates (`pairingCandidates`): threats with the same STRIDE and target (or the same
text), paths in the same tree, boundary flows with the same ends and protocol — OFFERED only, never
applied by themselves (review 2026-11-10: the same STRIDE on the same element is no proof; a pairing
always goes to review, so confirming costs one click and guards against a silent wrong match). The
update is recorded on the import (`ComponentImport.lastUpdate`: when, from which state, the lines);
the audit diff writes the lines as details of the import change, so the commit message names what
the update dropped or put to review. Review of 60: a machine threat moved to a paired boundary flow
survives the regular threat sync — the real per-interaction generator and reconciliation keep it with
its id as unchanged (nothing obsolete, nothing new on the flow); without the pairing it would be gone
and a new one generated (test).
*Patch 60 done (2026-11-10, review of patch 59):* boundary flows can be paired too
(`ComponentUpdatePairing.flows`, old → new flow): a component that renamed or re-created a boundary
flow dropped the machine's own threats on it (victimRole) with their risks, ratings, measures and
tickets — now they move: their ids stay, only the flow they name changes (`dataFlow.connectionId`,
`linkedElement.elementId`), so the risks stay with them; to review under the new flow key, marked
`paired:`. The dialog (5c-2) proposes pairs where ends and protocol match. A removed asset's hazard
links and the machine's A2A relations to it (purged like a deleted asset) are named one by one in the
commit lines ("hazard Fire not detected loses its link to SD1:A-04", "relation A-01 → SD1:A-04
(depends_on) removed") — they are the machine's decisions and must not vanish silently.
*Patch 59 done (2026-11-10, phase 5c-1):* applying an update, pure (`applyComponentUpdate`), per
import, as one change. DFD: `replaceComponentInstance` (features/dfd) removes what the insert laid down
for an instance — its child pages, on the parent page the multiprocess, the boundary-flow definitions
and the attached shell copies with their id labels, the records — and inserts it again with the SAME
instance id: the ids are deterministic, so whatever the new state still has keeps its machine id and
the machine's decisions on it stay valid; the multiprocess keeps place and name, it and the boundary
flows keep their display ids; EEs the import took over are the machine's and are mapped again.
Decisions per the inventory: orphaned ones dropped (relevance / measure overrides, overlays, AoU
status, cited claims, EE mappings; risks of removed threats with the concept's references; the
machine's own threats on removed boundary flows with their risks; removed assets purged like a
deleted asset), basis changed → reviewBasis. Pairing (review 2026-11-09): an obsolete threat / path
paired with a new one moves its decisions — relevance override, overlay, the risk (threat id and risk
id, the concept's references follow) — and puts them to review under the NEW key with the OLD basis,
marked `paired:` so the review stays open even when the two bases are equal (a rename) until the
analyst confirms. Instance assets: the component's parts (name, group, description, links, its goals'
requirement text) from the new state, the machine's impact, goal levels and added goals kept; new
assets as on import (`instanceAssetRecords`, now shared with the import); the component's relations
replaced. New EEs: mapped as chosen in the dialog or taken over as new machine EEs — recorded in the
mapping either way. The import records the new snapshot, hash, source, methodology and the update
time. Result: the project after, the snapshot delta, per instance the decisions and pairings, and
the lines for the commit message (dropped decisions, "ticket ABC-123 loses its risk", pairings to
review).
*Patch 58 done (2026-11-09, review of patch 57):* casts hid field names again. The threat basis read
`description` (the field is `threatDescription`), so a changed threat text never put its rating or
relevance override to review; and the hazard links read `affectedAssets`, a field only the import
format has — hazard ↔ asset links live in `hazards.relations` (contributes_to: asset → hazard;
endangers: hazard → asset), so none was ever found. The casts are gone where the snapshot and the
machine data are typed (the compiler checks the names now); the threat basis is threat text, attack
text, template id (an empty text means the i18n template), STRIDE, element / flow. The treatment
basis is the component's treatment, justification and per measure only id and status — not its notes
or tracker fields (its ticket state must not put the machine's treatment to review; a measure
delivered now may, so the status stays). For 5c (review): the open reviews need a visible place after
the update — a list in the component section with "Confirm".
*Patch 57 done (2026-11-09, phase 5b):* the inventory and the delta, pure, no UI
(`update-inventory.ts`). `DECISION_KINDS` is a Record over every kind of stored machine decision —
EE mapping, WoO overlay (path / step), relevance override, AoU status, measure override, cited
claim, rating and treatment of an imported risk (incl. attack-path risks), instance asset rating,
the machine's A2A relations to instance assets, hazard links, goals / claims naming imported
risks, the machine's own threats on boundary flows, quantity — each with `decided` (the keys, in the
component's terms), `basis` (hash of the snapshot part the decision rests on; undefined = no
counterpart) and `orphaned` (drop / unlink). `decisionDelta` gives per decision take over / review /
orphaned (an orphaned treatment names its tracker tickets); `snapshotDelta` what changed in the
component (elements, new EEs needing a mapping, flows, threats, paths, measures, assumptions,
supporting claims, assets, relations). Reviews (review 2026-11-09): only the OPEN ones are stored,
`ComponentInstance.reviewBasis` ("<kind>|<key>" → the basis hash of the oldest state not reviewed);
derived "to review" while it differs from the current basis (`openReviews`), settles by itself when
a later state restores the basis, removed when the analyst confirms (`withReviewConfirmed`);
`nextReviewBasis` keeps the oldest basis over several updates and drops orphaned decisions. Nothing is
stored for unchanged decisions, new decisions between updates need nothing, and projects of the
0.19 branch need no special case. The audit diff detects reviewBasis with the instance (test);
copying ratings takes a copied decision's open review along. Comment from the review of 56: a clone
that had the imported commit before the history was rewritten keeps it, so the check reports
"diverged" instead of "imported state gone" — same action, both messages expected.
*Patch 56 done (2026-11-09, review of patch 55):* history rewritten. "Clone behind — fetch first"
went in circles when the component's repository rewrote its history (a force push after a rebase,
sensitive data removed — it happened to TARAflow itself): the imported commit is missing after the
fetch too. Missing after `fetch: true` → `imported_state_gone` ("the imported state no longer exists
in the component's repository (history rewritten?) — check with the component team").
*Patch 55 done (2026-11-09, review of patch 54):* only a state AFTER the imported one is newer —
the check compared content only, so an older state was offered as "newer" (and 5c would have
downgraded): a clone on a second computer still before the imported commit (the commit not even
present → no rebuild → compared with the stored hash), or a tag pattern set later whose newest tag
points to an ancestor. Ancestry first: the imported commit not in the clone → `unreachable` /
`clone_behind` ("this clone is older than the imported state — fetch first"), nothing compared; the
state found an ancestor of the imported commit (`git merge-base --is-ancestor`) → up to date; the two
on separate branches (e.g. after a rebase in the component's repository) with other content → a
status of its own, `diverged`, info `CMP_SOURCE_DIVERGED` ("neither newer nor older — check with the
component team"), never offered as an update without a look. A failed `git fetch` is `fetch_failed`
("remote not reachable" — offline is the normal case), no longer "branch missing".
*Patch 54 done (2026-11-09, phase 5a):* drift, read-only. `checkComponentDrift` (pure, git and
file reader injected): a pinned import reads the component TARA AS COMMITTED at its branch tip
(`git show <commit>:<path>`; with a tag pattern the newest matching tag), never the working copy; an
unpinned one the file at its local path (`resolveComponentPath`: same repository, else remembered in
localStorage). Content decides: the state is reduced exactly as on import
(`componentSnapshotOfText`, steps 1–3 of `readComponentSource`, now shared) and compared by snapshot
content hash — a layout-only commit is not a newer state. `git fetch` only on request ("Fetch and
check" → the remote branch). Status per import (`up_to_date` / `newer_available` with tag or commit /
`unreachable` with its reason: path unknown, no repository, branch or tag missing, file missing,
unreadable) lives in the app, never in the file (`useComponentDrift`: checked locally when a project
with imports opens and on request); info findings `CMP_NEWER_STATE_AVAILABLE` and
`CMP_SOURCE_UNREACHABLE` on the instance's multiprocess; the component section shows the status with
"Check" / "Fetch and check". Nothing in the project changes. The tag pattern has no UI yet (set with
the update dialog, 5c). Review: a newer TARAflow may reduce a component differently (a new snapshot
field, a fix like patch 11) — every stored hash would differ without any component change (I1 covers
determinism within one app, not across releases). For a pinned import the check also rebuilds the
IMPORTED commit with the running app and compares the two rebuilt states; when the imported commit's
rebuilt hash differs from the stored one: `builderChanged` and info `CMP_SNAPSHOT_BUILDER_CHANGED`
("this TARAflow reads it differently — an update refreshes the stored state"), not a newer state
(unpinned imports have no commit to rebuild — there the stored hash is all there is). Tag pattern:
"newest" is by VERSION (`git tag --sort=-v:refname`): v1.10 after v1.9, and a tag set later on an
older commit (a hotfix tag) is ordered by its version, not its date. Tested against real git repositories (temp dir: branch tip, layout-only
commit, uncommitted edit, tag pattern, missing branch / file, no repository, unpinned, a clone behind
its remote with and without fetch).
*Patch 53 done (2026-11-09, review of patch 52):* claims cover a row TOGETHER. Patch 52 checked
each cited claim alone against all open elements of the row, so two instances citing their claim
(or a component claim beside one of the machine) each covered only part and none counted. Now the
effective claims are united: a project claim (no element scope) covers the whole row; the open
elements minus everything the effective cited claims cover — nothing left → claimed; something
left → the row stays open, its notes name only the elements still open, and the claims that helped
are listed as partial. Unclear / not-effective citations are listed as before.
*Patch 52 done (2026-11-09, phase 4c, with the review of patch 50):* component claims citable.
Only the component's SUPPORTING claims (the ones that cover requirement-matrix rows). The machine
cites one for a row's requirements in the row's claim dialog ("Claims of imported components",
offered where the component links the claim to those requirements); stored per instance
(`ComponentInstance.citedClaims`: claimId, qualified requirement ids, date; `withCitedClaim`). Whether
a citation counts is derived (`instanceClaims`), by the measures' rule (I7): the claim's
`assumptionIds` in the instance — all fulfilled with implemented evidence or not applicable →
counts; open or evidence not implemented → unclear; not fulfilled / invalid in the component → not
effective. And it covers only the instance's elements: `MatrixClaim.concernsElementIds` — a row is
claimed only when every element still open there is the instance's (the matrix evaluates per
element, so no separate partial coverage). Uncounted citations are listed on the row with why
(`RowResult.uncountedClaims`: unclear, not effective, partial) in the Compliance tab and the report.
Display id `SD1 CLM-03` (no clash with the machine's CLM-nn). Diff-detected with the instance
(test), copied with the decisions. Review of 50: the planned overlay stays on the machine's own
threats and risks on purpose (it models the SHOULD values the machine applies to its model; a
component's cells change only with a new revision) — commented; the evidence risks are a narrow
type (`EvidenceRisks`) instead of a cast to the stored risk type.
*Patch 51 done (2026-11-09, phase 4a-4, review of 48/49):* what a goal the machine adds to a
component asset effects. Threats on a component's elements come only from the component (the
machine's generators are off there), so an added goal type (e.g. availability the component did not
mark) makes no threat and no risk — the machine's impact hangs on nothing, and "goal without threat"
stood as a machine finding the machine cannot fix. Decided by the user 2026-11-09 — **signal, not
analysis** (consistent with the relevance and measure overrides; no manual machine threats on
component elements, which would break the single source of their threats and add a reconciliation
to the update path): such a finding becomes `goalAddedNoComponentThreat` with the component's chip
("goal added — the component has no threats for it, request a new revision"). A machine asset tied
only by A2A relations to a component's assets and to no DFD element gets its own text,
`linkedOnlyToComponent`, naming both ways out (link it to an element of the machine, or — if the
data is processed only inside the component — request a revision), but stays the MACHINE's finding:
the machine can fix it itself, and the component's chip is kept for what only the component can fix
(review 2026-11-09). The gap of an added goal stays open until the component's new revision, but
visible; the added goal goes into "Deviations from the component" (phase 6, derivable against the
snapshot). Phase 6, noted (review 2026-11-09): the report collects per component the signals for the
platform team — goals added without component threats ("request a new revision"), overridden
relevances, measures marked "not effective here" — as one list, not scattered findings.
Only finding owner and text change (`assetFindingView` in the asset panel); nothing new is stored.
*Patch 50 done (2026-11-09, phase 4b):* matrix and hazards. The matrix already evaluated the
imported elements (they are in the machine's DFD; test). Evidence from measures: imported threats now
give their risks' measures element targets (`withComponentThreats` in the evidence build — before, the
machine's own measures on imported risks concerned no element), and the component's chosen measures
count as evidence only when effective in the instance (`withComponentMeasures`, derived for the
evidence only): effective → done; merely not implemented yet → planned; unclear because an
assumption lacks evidence → `MitigationEvidence.unclear`: counted in neither run, shown on the row as
"unclear (assumption of use without evidence)" (Compliance tab and report notes) — told apart from
planned; not effective → left out. Handed-over risks bring no component measures; a measure the
machine chose itself keeps the machine's status. Hazards: the instance assets are in the asset
reference and offered in the hazard picker by their group, with their prefixed display id (test; no
change needed).
*Patch 49 done (2026-11-09, phase 4a-3):* asset relations. The import takes the component's
asset-to-asset relations over (`AppliedComponentImport.relations`: ids
`componentInstanceTfId(instance, "rel|" + id)`, ends remapped to the instance assets, stored sorted
in `assets.relations`; deleting the instance purges them with its assets). Where the machine edits
relations — decided by the user 2026-11-09: the asset graph's edit mode (DFD tab, third view), the
one place where component and machine assets stand side by side and a link is drawn between two
nodes in either direction, through the existing single A2A write path (`commitA2AOps`); no second
editor, the DFD asset form unchanged. Generic `lockedBy` (id → owner label; app:
`componentLockedIds` — the component's elements, flows and instance assets): a link between two
component assets is the component's (chip, no update / delete, Delete key ignored); a component's
asset cannot be deleted (also guarded in the DFD tab's delete handler) and its properties form is
not offered (impact and added goals are rated in the Assets tab, 4a-2); a new link needs at least one
machine asset (refused with a notice otherwise); element → asset relations of a component element
are locked and the element picker does not offer component elements.
*Patch 48 done (2026-11-09, phase 4a-2, with the review of patch 47):* imported assets read-only
where they are the component's. Asset dialog: name and description disabled, a banner says what is
read-only and what the machine rates. Security goals: `componentAssetGoals` (instance asset id → the
goal types the component has active in the snapshot) — on those cards no "Not relevant" / "Remove
goal", the formal requirement read-only (no template), a chip "from SD1"; level, impact, consequence
and rationale stay the machine's (the suggested level follows the machine's impact). Other goal types
the machine may add — a manual goal, so its rationale is required as for any manual decision. Delete
in the asset table disabled for imported assets ("removed with its component instance"). Findings:
on a component goal "no requirement text" and "goal without threat" belong to the component; an
added goal's findings and rationale / impact / safety findings stay the machine's. Review of 47: the
classification of DFD findings is now complete by type — `FINDING_CLASS: Record<keyof typeof
ValidationMessages, "structure" | "property">` (a new message does not compile until classified).
Found while building it (→ 4a-3): the component's asset-to-asset relations are in the snapshot
(`assetRelations`) but the import does not take them over; and A2A relations are edited only in
the DFD asset form, outgoing from the asset — for a component asset that form is on a locked page, so
a relation "component asset → machine asset" has no place to be entered yet.
*Patch 47 done (2026-11-09, phase 4a-1):* findings carry their owner. `componentOwnership`
(machine tfId → instance prefix / label, boundary flows marked) and `findingOwner` (a structural
finding on a boundary flow — `isStructuralFinding` in features/dfd: connection-validator keys and the
leveled findings — stays the machine's). DFD notification panel: a chip "Component SD1" (tooltip:
fixed in the component's TARA) on validation rows, and on property suggestions / drift rows of a
component cell, which offer no Apply there (read-only). Asset notification panel (shared
FindingsPanel `owner`): on an imported asset only name and DFD-link findings are the component's;
impact, safety and goal findings stay the machine's.

**Phase 5 — Change detection and update.** Drift check (content, tag pattern), update preview over
all instances incl. new EE mappings, pairing, rollback.
*Cut (user with the second instance, 2026-11-09):* everything DERIVED needs no migration on update
(threats, effectiveness, crediting of the residual risk, matrix evidence recompute from the new
snapshot); only the machine's STORED decisions per instance do. 5a drift, read-only (status per
import: up to date / newer available / unreachable, info finding; first, because it is the only
part with I/O — local path, foreign repo, tag pattern, unreachable source — to be tried early on
real repositories). 5b delta, pure, no UI: old vs new snapshot, and for every stored machine
decision the outcome — take over / to review / orphaned — from an INVENTORY that is a Record over all
kinds of decision, each with its key and its rule (like FINDING_CLASS: a new kind of decision does
not compile without an update rule). Inventory: EE mappings; WoO overlays per path and step;
relevance overrides; factor ratings and overrides of imported risks; AoU status with evidence;
measure overrides; cited claims; added security goals; the machine's A2A relations to component
assets; impact of the instance assets; the instance quantity; the machine's treatment, measures,
justification and acceptance on imported risks (with their tracker tickets — an orphaned risk with an
open ticket needs its own line in the preview, "ticket ABC-123 loses its risk"); hazard links to
instance assets; goals / claims of the machine naming imported risks (`R-<instance threat>`); the
machine's own threats and risks on boundary flows (generated by the machine, victimRole, but their
ids hang on the component's flow ids — a renamed or new flow orphans them). 5c preview and apply:
one dialog over all instances (new EE mappings, pairing obsolete ↔ new for threats and paths, risks
and decisions that go), applied as one change = one commit with the orphaned decisions in the commit
message, repair of changed component pages. 5d rollback.
*Decided 2026-11-09 (left to me by the user; recommended by both instances):* granularity — update
per IMPORT (all instances at once; mixed states do not exist: a second import always uses the state
already imported, `existingImportOf`); rollback — no second snapshot archive in the file: the update
is one commit, `git revert` is the rollback, the app offers "discard update" while not saved.

**Phase 6 — Audit and report.** AVE `component-import`, diff-service detail lines, report section
per component, provenance in the tables. Cut 2026-11-11 (user, review 2026-11-11):

- **6a-1 — report tables.** Found: the report showed the imported risks but none of their threats
  (`transformProjectToDocData` passed only the machine's own threats). The threat chapters get the
  imported threats **per component** (heading "Smoke Detector Case @ a1b2c3d4"), **each threat
  once**, below it only where an instance differs ("SD2: relevance overridden by this TARA — …",
  a different counterpart on a boundary flow) — the same picture as the Threats tab (patch 31). The
  instance ids stay link targets of the risk rows. The risk tables stay per instance and show the
  provenance of the prefill: which factors came from the component (instance and commit), which
  this TARA overrode (with its rationale), and the quantity ×n.
- **6a-2 — chapter "Imported components"**, one section per component: its overview (`about`),
  origin (repository, commit, tag, imported on, last update), methodology match, instances with
  their EE mapping, assumptions per instance, measures "not effective here" / "unclear" — and a short
  statement of the rule by which a residual risk is not credited (a TARAflow rule the reader does not
  know).
- **6a-3 — "Deviations from the component"**, per component the list for the platform team: added
  goals with the "request a revision" signals (patch 51), overridden relevances, measures "not
  effective here", assumptions not fulfilled, cited claims; the responsible from `about` as the
  contact. In the report, and "Copy as text" on the Overview's accordion — in the app's language from
  the structured data through i18n (never the English `lastUpdate` lines), Markdown.
- **6b — audit.** AVE check `component-import`: the snapshot canonical and its hash matching the
  import record (`CMP_SNAPSHOT_HASH_MISMATCH`, error); the **locked** component pages regenerate
  from the snapshot — only those, not the parent page, where the machine draws the boundary flows.
  diff-service detail lines for instance changes (assumption status, EE mapping, quantity,
  overrides) instead of "Component instance modified".
- **6c — findings visible.** The phase badge counts the component findings; a source reference
  with credentials becomes a finding of the validation panel (review of patch 73).
- **6d — update usability** (review 2026-11-11 points 1, 2, 5): "Check", "Fetch and check",
  "Update…" on the Overview's accordion too (same dialog, same runner path); a fast path for
  trivial updates (no new EE, no pairing, nothing dropped or to review → "No decision of this
  machine affected", Apply at once — still the dialog); a test for deleting the last / one of two
  instances.
- Then: end-to-end test, example and test protocol, release notes. The example pair gets the ISO path
  (review 2026-11-12): a small attack tree with a ratable AND combination of two steps (e.g. "open
  the housing" AND "use the debug port") — the report's path table of an AND combination is then
  covered by the full test and the PDF check, not only by constructed data.

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
| D6 | Source state | Committed and clean = pinned; otherwise unpinned with warning (revised 2026-11-07); Electron only (§4.1) |
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
| E7 | Source state / browser | Pinned when committed and clean, else unpinned with a clear warning (user 2026-11-07); path in the repository and same-repository flag recorded; browser mode not supported at present (§4.1) |
| E8 | Nested components | Come along as they are, updated only with the outer component (§6.5) |
| E9 | Display ids | Component ids with instance prefix, untouched by the machine's renumber (§6.6) |
| E10 | Report | Normal tables with provenance + one section per component (§8.3) |
| E11 | Change detection | Content-based against the branch tip, optional tag pattern, never automatic (§9.1) |
| E12 | Several imports of one component | One state per component; same state → new instance; newer → update all; older → explicit rollback; two versions not supported (§6.4) |

## 17. Open points found during implementation

| # | Found | Point | Proposal |
|---|---|---|---|
| I1 | Phase 0 (2026-11-07) | **Migration must be deterministic.** Old component files get fresh ids on every migration: migrate 4→5 and 5→6 (and 6→7 on an id collision, the legacy asset-link lift) use `crypto.randomUUID` — e.g. the schema-2 cnc-ref fixture gets new threat UUIDs each time. Migrated on import (§4.1) and again on every drift check or update, the same component state would give different threat ids → every imported threat "obsolete + new", ratings and risks lost. | **Decided (user 2026-11-07):** the import migrates the file twice and compares the snapshot hashes; if they differ, it refuses with "open and save the component TARA in TARAflow ≥ 0.19 and commit it first". Generic, no list of affected schema versions to maintain. Applies to every read of a component state (import, drift check, update). |
| I2 | Patch 07 (2026-11-07) | **Flows from an EE to a boundary element.** A component flow that ends on a boundary (e.g. the SmokeDetector's debugger flows into a chip boundary, DF-8 / DF-18) cannot be stitched in the machine: boundaries are never inside a decomposed multiprocess (leveled design §5.3.1), so the inner end is ambiguous → `BAL_AMBIGUOUS_ENDPOINT` (error) on the boundary flow. Valid on a single page, so the component team sees nothing. | **Decided (user 2026-11-07): (a).** The import preview lists these flows as "will not resolve — draw the flow to the element inside the boundary in the component TARA"; the import still runs. (b) — the leveled model treating a boundary defined on a child page as inside — only if it turns out to be common. Rationale: e.g. a debugger is quickly re-attached to the right element and carries its own threats. |
| I3 | Review 2026-11-07 | **Relevance of threats on boundary flows.** Per-element flow threats on a boundary flow belong to the component (the flow's properties come from it), but whether tampering or information disclosure on it is relevant depends on where the flow runs in the machine (inside the cabinet or over the plant network). The component judged it with its own EE, without the machine context; a component `not_relevant` would make a risk vanish in the machine silently. | **Decided (user 2026-11-07): the machine may override.** (1) Only threats on **boundary flows** — threats on component-internal elements stay read-only (otherwise the machine re-analyses the internals and the model tips over). (2) **Both directions**, each with a mandatory rationale (raising to relevant is the common case; lowering is legitimate too, e.g. the flow runs entirely inside a locked cabinet). (3) The component's decision stays visible beside the override. (4) Stored per instance in `project.components`, detected by the diff-service (commit gate). (5) **Re-check on update:** if the component later changes its relevance decision for an overridden threat, the override does not simply carry on — the update preview marks it "to review" like a changed threat. (6) **Feedback channel:** the report gets per component a short section "Deviations from the component's assessment" that can be handed back to the platform team — the source for assumptions (AoU) in its next revision. Rejected alternative (AoU only): the platform team cannot foresee every installation context under n:m reuse, and a forgotten assumption is the worst case. |
| I4 | Manual test 2026-11-07 | **Top page shows the multiprocess alone.** The component's case and trust zone were only on the child page; the machine's top page lost the visual context a hand-drawn leveled DFD has (the analysis was right: the child page's boundaries are inherited additively). | **Decided (user 2026-11-07): shells on the parent page too.** Boundaries every part of the component is inside are defined around the multiprocess on the parent page, copies on the child page (§6.2, patch 19). Inner boundaries stay on the child page. |
| I5 | Manual test 2026-11-08 | **Several instances of one component.** Every instance brings its own child page and its own imported threats and risks; identical units in the same context only multiply the same analysis (noise in register and report, ratings repeated n times), units in different contexts really differ (impact on other machine assets, context factors, overrides, window of opportunity). | **Decided (user 2026-11-08, reviewed by the second instance): both, chosen at insertion.** Same context → one instance with a quantity "×n" (patch 30); different context → separate instances as before, with the import asking first in a dialog of its own (patch 30), the Threats tab grouping the imported threats per component with a row per instance (patch 31) and an explicit one-off "copy ratings to other instances" (patch 32, no live coupling, no inheritance level). Report per component with only the deviations between instances: phase 6. |
| I6 | Review 2026-11-08 | **One window for all steps of an AND combination.** Patch 27 applied the machine's window of opportunity to every leaf of a combination; the steps often differ exactly in that factor. | **Decided (user 2026-11-08): per step.** An overlay per step (pathKey + leaf id), the path-wide entry as the fallback for steps without one; the combination is rated when every step has a window (patch 34). |
| I7 | Review 2026-11-08 (phase 3 preparation) | **A component measure may hold in one instance and not in another.** The component implements a capability, but its effectiveness depends on assumptions of use (AoU) that instance 2 may not meet. Measure status and AoU status must belong together from the start, without two stored statuses that drift apart. | **Decided (user 2026-11-08, reviewed by the second instance).** (1) **Dependency:** every component measure names the AoUs its effectiveness depends on (in the snapshot); a measure without AoU dependency is effective. (2) **AoU status per instance:** open / met / not met / not applicable; "not applicable" counts as met but needs a mandatory rationale; "met" backed by a machine measure that is not implemented yet gives a finding ("AoU met by a measure not implemented") — no stored status coupling; **amended 2026-11-09:** for the effectiveness such an AoU counts only once its evidence measures are implemented / verified (until then the component measures relying on it are unclear) — credited is only what is implemented, whether from the component or from the machine. (3) **Effectiveness is derived, never stored**, three states: effective (all AoUs met or n/a), not effective (one not met), unclear (one open); the display tells "unclear" (a gap in the evidence) from "not effective" (a real problem). (4) **Residual risk:** TARAflow does not compute the residual risk from measures — the analyst rates the factors after treatment (mitigatedFactorRatings, riskAfterRationale). If one of a risk's chosen component measures is not effective or unclear in the instance, the residual risk of that risk is **not credited**: matrix, report and acceptance use the values before treatment, and a finding names the measure and its AoU; the analyst's after-values stay stored and count again once the AoUs are met. An **accepted** risk whose residual risk no longer counts is marked "to review" (like a stale override) and the finding names the acceptance — it must not stand silently beside a now higher risk. **ISO/SAE 21434:** the residual risk per attack path (attack-tree rating after treatment) follows the same rule; the scenario takes the maximum of its paths as before. (5) **Machine override** (as I3): the machine may mark a component measure "not effective here" per instance with a mandatory rationale — downgrade only, no upgrade; it acts exactly like "not effective" in (4) (residual risk not credited — not a display only) and goes into the report section "Deviations from the component's assessment", the signal to the platform team to add an AoU. (6) **Audit, update, copy:** the diff-service detects AoU status and overrides (each with a test that opens the commit gate); the update preview lists new or changed AoUs and resets their status to open; the AoU status per instance belongs to the "decisions" when copying ratings (patch 33). |

