# TARAflow — Multi-Project TARA (Component Profiles) — Design

Status: draft v2 · 2026-11-04 · **target release 0.19** (user 2026-11-04), project schema
**≥ 14** · review findings and the user's answers in §15 · Author: (Juergen) · Supersedes the
content scope of `multi-diagram-linking-design.md` (its navigation link becomes one action of
this feature, §11).

A machine TARA (integrator) consumes the security-relevant result of one or more **platform
component TARAs** (supplier side, possibly another team, another repository). The component TARA
publishes a **Component Security Profile**: the threats that are visible from outside the
component, the assumptions it places on its integrator, and the security capabilities it
provides. The machine TARA binds that profile to the multiprocess that represents the component,
generates its own threats from it and rates them in machine context.

## 1. Goal & value

- Platform teams analyse a component once; every machine that uses it reuses the result.
- Machine teams do not re-analyse component internals, but they do not lose the component's
  externally visible threats either.
- The hand-over between the two teams becomes an explicit, versioned, auditable artifact instead of
  copy-paste between spreadsheets.

Cardinality (confirmed): a machine TARA can bind **several** component profiles; the **same**
component profile can be bound by **several** machine TARAs. The two TARAs can live in
**separate repositories** with separate audit trails. Only **security threats** cross the boundary
(no safety hazards — each TARA keeps its own hazard import).

## 2. Scope & non-goals

In scope:
- Component side: declare the component boundary, classify threats as exported/internal, export a
  profile from a committed state.
- Machine side: bind a profile to a multiprocess, map interfaces, generate component threats, rate
  them locally, check assumptions, use provided capabilities as mitigations.
- Version pinning, drift detection, reconciliation on profile update.
- Audit: the machine TARA stays verifiable without access to the platform repository.

Non-goals:
- **Live coupling / editing across projects.** The machine never edits the component TARA, the
  component never sees machine data.
- **Impact transfer.** The component team cannot know the damage in a machine (§5.3).
- **Safety hazards** across projects.
- **Nested profiles** (a component profile that itself bundles other profiles) — later, if needed.
- **DFD balancing** between the machine's multiprocess and the component's DFD beyond the explicit
  interface mapping (§6).

## 3. Why a published profile, not a link or a copy

`multi-diagram-linking-design.md` §8 parked the "proper" version because copied state across
independently versioned files always drifts. That argument holds for **mutable** state. It does
not hold for an **immutable, versioned release**:

| | Copy of project data | Live link to project | Published profile (this doc) |
|---|---|---|---|
| What crosses | arbitrary internals | everything, unpinned | a defined subset, pinned |
| Drift | silent | silent, every open differs | explicit: pin vs. upstream (§9) |
| Audit | not reproducible | not reproducible (other repo) | reproducible (vendored + hash, §8) |
| Reuse n:m | no | yes, but unstable | yes |

The profile behaves like a dependency release (a lockfile entry): the platform team publishes
version N; the machine pins N, sees that N+1 exists, and decides when to move.

## 4. The Component Security Profile

A separate file type, `*.tara-component.json`, written in TCS canonical form
(`canonicalStringify`) so its content hash is stable.

```ts
interface ComponentSecurityProfile {
  profileFormat: 1;
  component: {
    id: string;            // platform project id — stable identity across versions
    name: string;
    version: string;       // component release the analysis covers, analyst-entered
    profileRevision: number; // monotonically increasing per component id
  };
  source: {
    repoUrl?: string;      // remote URL, never a local path (SourceBinding rule)
    commitSha?: string;    // commit of the component TARA the export was taken from
    tcsVersion: number;
  };
  methodology: MethodologyFingerprint;   // §7.2 — decides prefill vs. re-rating
  interfaces: ExportedInterface[];
  threats: ExportedThreat[];
  assumptions: ExportedAssumption[];     // requirements on the integrator (AoU)
  capabilities: ProvidedCapability[];    // what the component guarantees
  assetTypes: ExportedAsset[];           // component assets threats refer to
}

interface ExportedInterface {
  key: string;             // stable, from the component's interface element id
  name: string;
  protocol?: string;       // same vocabulary as DataFlowProperties.protocol
  attackVectors: AttackVector[];
  description?: string;
}

interface ExportedThreat {
  key: string;             // stable: hash(component.id, source threat UUID) — the threat's
                           // `id`, never its displayId, so a DFD renumber changes nothing (§15)
  stride: StrideCategory;
  title: string;
  description: string;
  interfaceKeys: string[]; // entry points; ≥ 1 unless exported via treatment (§5.2 rule 2)
  assetKeys: string[];     // component assets affected
  /** Raw factor values at the interface — component-intrinsic factors only (§7.2).
   *  Never an aggregated feasibility/likelihood level. */
  factors?: ExportedFactorRating[];
  feasibilityRationale?: string;
  residual: "open" | "shared" | "transferred"; // what the integrator inherits
  integratorAction?: string; // from the share/transfer claim
}

interface MethodologyFingerprint {
  likelihoodMethod: string;      // LikelihoodMethod of the component project
  factorIds: string[];           // active likelihood factors, sorted
  scaleVersion: number;          // version of the factor scale definitions
  hash: string;                  // hash over the three fields above
}

interface ExportedFactorRating {
  factorId: string;              // e.g. elapsed_time, expertise, attacker_capability
  level: string;                 // the factor's own scale value, unconverted
}

interface ExportedAssumption {
  key: string;             // from Assumption.id (ASM-nn as display id)
  displayId: string;
  statement: string;
  interfaceKeys?: string[];
}

interface ProvidedCapability {
  key: string;             // from CybersecurityGoal / implemented control
  displayId: string;
  statement: string;
  interfaceKeys?: string[];
  mitigatesThreatKeys?: string[]; // internal threats it covers (titles only, see §5.2)
}

interface ExportedAsset {
  key: string;
  name: string;
  group: string;           // AssetGroup
  cianaaa: SecurityGoalType[];
}
```

What is deliberately **not** in the profile: internal DFD, internal flows, attack trees, impact
values, risk values, aggregated feasibility/likelihood levels, context-dependent factors (§7.2), mitigation ticket state, names of people, local paths.

## 5. Component side — what gets exported

### 5.1 Component boundary

The component TARA declares which of its interfaces are reachable by an integrator. Default:
the interface elements on the **physical boundary that encloses the component** — the
multiprocess (or system) of the component sits inside a physical boundary, its interfaces on that
boundary are the component's border (user 2026-11-04: a clear boundary, no further rule). The analyst can add or
remove interfaces with a flag `exposedToIntegrator` on the interface element. The component TARA
is marked as a component project (project tag `component`), which enables the export action.

### 5.2 Export rule — "seen from the machine"

Deterministic, derived first, override only with rationale:

1. **Reachable:** the threat's entry point is an exposed interface, or a data flow crossing one.
2. **Handed over:** the threat's risk is treated `share` or `transfer` (a claim with
   `responsibleParty` = integrator). Exported even without a reachable interface.
3. **Internal:** everything else stays inside. A reachable threat that is treated `reduce` inside
   the component is exported as a **capability** (the goal that covers it), not as a threat —
   unless its residual risk is still open.
4. **Override:** the analyst can mark a threat `export` or `internal` against the derived class;
   a rationale is mandatory and appears in the export preview and the component report.

Threats with relevance `not_relevant` are never exported.

### 5.3 Why impact stays behind

Impact belongs to the damage scenario (durable decision). A damage scenario names an asset of
the system that is harmed — the component team only knows its own assets. The same component
threat can be negligible in one machine and severe in another. Exporting impact would import
a rating made without the context it depends on. Of the likelihood factors only the
component-intrinsic ones are exported, as raw values — they describe the component, not the
machine (§7.2).

### 5.4 Export flow

- Export only from a **committed, clean** component TARA; the commit sha goes into `source`.
  A dirty working tree blocks export (or exports with a "draft" marker that the machine side
  refuses to pin — decision D6).
- Export preview: interfaces, exported threats with their export reason (rule 1/2/4),
  assumptions, capabilities — and the internal threats counted, not listed.
- `profileRevision` increments on every export with changed content (content hash differs).

## 6. Machine side — binding and interface mapping

### 6.1 Binding

```ts
// project level
interface ComponentBinding {
  id: string;
  componentId: string;
  profileRevision: number;
  contentHash: string;     // hash of the vendored profile (§8)
  repoUrl?: string;        // where newer revisions are looked for
  refLabel?: string;       // e.g. "main", "release/2.x"
}

// on MultiprocessProperties
componentBindingId?: string;
```

- One binding per (component, revision) and project; several multiprocesses can point to the same
  binding (two identical drives in one machine).
- A multiprocess is either **decomposed** (leveled DFD child page) or **bound** to a profile,
  never both (decision D3).
- A bound multiprocess shows the profile read-only in the description panel and offers
  "open component TARA" when a local checkout is known (the former linking feature, §11).

### 6.2 Interface mapping

Every flow on the machine DFD that touches the bound multiprocess is mapped to one profile
interface:

```ts
interface ComponentInterfaceMapping {
  bindingId: string;
  multiprocessId: string;
  flowId: string;          // machine data flow
  interfaceKey: string;    // profile interface
}
```

- Suggested automatically when protocol and name match; confirmed by the analyst.
- Findings: `CMP_FLOW_UNMAPPED` (warning — the component's threats cannot attach to this flow),
  `CMP_INTERFACE_UNUSED` (info — exposed interface without a machine flow; the analyst confirms it
  is physically not reachable), `CMP_PROTOCOL_MISMATCH` (warning).
- This is the only form of balancing: explicit and checked, never auto-derived.

## 7. Machine side — threats and risks

### 7.1 Fourth threat generator

Component threats are generated beside per-element STRIDE, per-interaction STRIDE and attack trees:

- One threat per (bound multiprocess × exported threat × mapped flow of its interfaces).
  Threats exported via rule 2 without an interface attach to the multiprocess itself.
- Threat id: deterministic hash of (bindingId-independent component id, exported threat key,
  multiprocess id, flow id) → stable across profile revisions as long as the key exists.
- Text read-only, provenance shown (`component X rev N, threat key`). Relevance, ratings,
  mitigations: local.
- Per-element STRIDE on a bound multiprocess is suppressed (the component analysis replaces it);
  per-interaction STRIDE on its flows stays — the machine side of the flow is the machine's
  business (decision D4).

### 7.2 Feasibility and impact — methodology rule

Likelihood factors are global per project: every risk of the machine is rated with the same
method, the same active factors and the same scales. Imported threats must therefore be rated in
the **machine's** methodology, never in the component's. Converting an aggregated level between
methods is not traceable and is not done.

**Factor split.** Every likelihood factor is classified once, in the factor definitions:

| Class | Examples | Who rates it |
|---|---|---|
| component-intrinsic | elapsed time, specialist expertise, knowledge of the item, equipment, attacker capability (EN 50742 AC) | the component team — exported as raw value |
| context-dependent | window of opportunity, exposure level (EN 50742 EL, derived from trust-boundary crossing), benefit (IEC 62443) | always the machine, from its own DFD — never exported |

**Methodology fingerprint.** The profile carries the component's `MethodologyFingerprint`
(likelihood method + sorted active factor ids + scale version, hashed). It is derived from the
methodology record, never edited by hand. The machine compares it with its own fingerprint at
bind time and again on every revision move:

- **Same fingerprint:** the exported intrinsic factor values are taken as **prefill**, marked
  `source: "component"` with the profile revision. The machine can override a prefilled value;
  a rationale is mandatory. Context-dependent factors are rated by the machine as for its own
  threats.
- **Different fingerprint:** the import still runs — threats, interfaces, assumptions and
  capabilities do not depend on the method. Every factor that cannot be taken over 1:1 stays
  **unrated**; the source values are shown read-only beside the factor (method, factor, value) as
  a hint. The analyst re-rates them in the machine's method. Info finding `CMP_METHOD_MISMATCH`
  on the binding; warning `CMP_FACTOR_UNRATED` per component threat until all of its factors are
  rated.
- **Partial overlap:** a factor whose id **and** scale exist identically on both sides (e.g. the
  same elapsed-time scale used by two presets) is taken as prefill even on a fingerprint mismatch;
  everything else is re-rated. "Identical" is decided by factor id + scale version, never by label.

No conversion tables between methods in this version. If a method pair is needed later, a
factor-level mapping registry (source method, factor → target method, factor, with a documented
rule) can be added without changing the profile format, because the profile already carries raw
factor values. Such mappings would be TARAflow extensions and must be listed in the report's
methodology section.

**Impact:** from the machine's own assets. Exported component assets are mapped to machine
assets once per binding (`assetKey → machine asset id`); unmapped exported assets give
`CMP_ASSET_UNMAPPED` (warning) and the risk stays unrated.

### 7.3 Assumptions on the integrator (AoU)

Each exported assumption becomes a checklist entry in the machine TARA:

```ts
interface ComponentAssumptionStatus {
  bindingId: string;
  assumptionKey: string;
  status: "open" | "fulfilled" | "not_fulfilled" | "not_applicable";
  evidence?: { elementIds?: string[]; mitigationIds?: string[]; note?: string };
  rationale?: string;      // mandatory for not_applicable
}
```

`open` → `CMP_AOU_OPEN` (warning), `not_fulfilled` → `CMP_AOU_VIOLATED` (error) — the component's
analysis is not valid in this machine until resolved. This is arguably the most valuable part of
the feature: it is exactly what gets lost in today's hand-overs.

### 7.4 Provided capabilities

Capabilities are selectable as mitigations on machine risks (`source: "component"`), shown with
their provenance. They count as implemented by the component; the machine does not track tickets
for them.

## 8. Audit — separate repositories

- The bound profile is **imported into the machine's `.tara.json`** (recommended, §15 point 6 /
  D1): the binding holds the profile content in canonical form and its content hash. Everything
  the machine needs — threats, interfaces, assumptions, capabilities, the report — comes from
  that copy; the platform repository is never needed, not for the report and not for the CLI
  reporter, and the browser mode works without file access. (Alternative: a vendored file
  `.tara/components/<componentId>/rev-<N>.tara-component.json` in the machine repo — then the CLI
  reporter and the browser mode need that file too.)
- The machine TARA is therefore verifiable without the platform repo. New AVE check
  `component-profile`: the embedded profile is canonical and its hash matches the binding →
  `CMP_PROFILE_HASH_MISMATCH` (error).
- Optional (when the platform repo is reachable): verify that `source.commitSha` exists and the
  platform repo's own AVE passes at that commit — informational, the platform trail is the
  platform team's responsibility.
- Local checkout paths of the platform repo live in `localStorage` only (same hybrid as repo
  discovery and `LocalCheckoutHint`); nothing path-like enters `.tara.json`.

## 9. Updates — drift and reconciliation

- Drift check against `repoUrl`/`refLabel` (reuses the source-binding drift idea):
  `up_to_date`, `newer_revision` (info), `unreachable` (info).
- Moving the binding to revision N+1 runs a reconciliation preview, per exported threat:
  **new** / **unchanged** / **changed** (text, interfaces, feasibility or residual) / **obsolete**;
  same for assumptions and capabilities. Same pattern as the leveled-DFD threat reconciliation
  (D9): ratings never transferred automatically, changed threats are flagged for review.
- **Risks follow their threats (user 2026-11-04):** an imported component threat gets its risk
  through the normal risk sync like every generated threat; a threat that becomes obsolete loses
  its risk — orphaned risks are deleted, as everywhere in TARAflow. The preview lists the risks
  that will go (with their rating and treatment) before the move is confirmed, and the audit
  diff of the move commit names them.
- The move is one commit in the machine repo (vendored file + binding + reconciled threats).

## 10. Architecture

- New feature `features/components`: profile schema, exporter (pure), binding/mapping UI,
  assumption checklist, fingerprint comparison (pure). It does not import `features/threats` or `features/risks`.
- Shared types for what other features consume: `shared/models/component-profile-types.ts`
  (profile, binding, mapping refs).
- The app layer bridges: builds `ComponentThreatReference`s from bindings + mappings and feeds them
  to the threat sync (like `build-attack-path-threat-references.ts`); feeds capabilities to the
  mitigation selection.
- Export reads the project through the existing serialisation path; the profile is written with
  `canonicalStringify` (one canonical form).
- diff-service: binding, mapping, assumption status are semantic content → commit gate + commit
  message detail lines.
- All user-facing text via i18n (en/de).
- Examples: own example only — SmokeDetector as component, a small "fire alarm panel" as machine
  binding it twice. No customer models in docs, tests or fixtures.

## 11. Relation to `multi-diagram-linking-design.md`

That doc's navigation (open the linked project, re-link, path in `localStorage`) becomes the
"open component TARA" action of a bound multiprocess. The separate `linkedProject` field is not
introduced; the binding carries the identity. Once this doc is accepted, the linking doc moves to
`doc/Old/` with a pointer here.

## 12. Implementation phases

Each phase ships on its own and leaves the app consistent.

**Phase 0 — Profile schema + pure exporter.** Types, `exportComponentProfile(project)` with the
export rule of §5.2 (derived classes only), methodology fingerprint, intrinsic factors only, canonical writer, unit tests against the SmokeDetector
example.

**Phase 1 — Component side UI.** `component` tag, `exposedToIntegrator` flag on interfaces,
export override with rationale on threats, export preview, clean-tree guard, profile revision.

**Phase 2 — Binding + vendoring.** Bind a profile file to a multiprocess, vendor it into
`.tara/components/`, read-only profile view, decomposition/binding exclusion, open component TARA.

**Phase 3 — Interface and asset mapping.** Mapping UI with suggestions, `CMP_*` findings.

**Phase 4 — Component threat generator.** App-layer bridge, threat sync, suppressed per-element
STRIDE on bound multiprocesses, impact from mapped assets. Factor classification
(intrinsic/context), methodology fingerprint, prefill on match, unrated + source hint on mismatch
(§7.2).

**Phase 5 — Assumptions and capabilities.** AoU checklist with evidence, capabilities as
mitigations.

**Phase 6 — Update path.** Drift check, reconciliation preview, binding move as one commit.

**Phase 7 — Audit and report.** AVE `component-profile` check, report section per binding
(profile identity, mapping, AoU status, component threats with provenance), component-side report
section "exported vs. internal".

## 13. Testing

- Exporter: each export rule (reachable, handed over, reduced → capability, override, not
  relevant excluded); no impact, no paths, no internal threats in the output; canonical
  round-trip; identical project → identical hash.
- Machine: same binding on two multiprocesses yields distinct, stable threat ids; ids survive a
  profile revision that keeps the keys; unmapped flow / unused interface / unmapped asset findings.
- Methodology: same fingerprint → intrinsic factors prefilled with provenance, context factors
  unrated; different fingerprint → all non-identical factors unrated, source hint shown,
  `CMP_METHOD_MISMATCH` + `CMP_FACTOR_UNRATED`; identical factor id + scale version is prefilled
  across a mismatch; context-dependent factors never appear in an export.
- Reconciliation: new / unchanged / changed / obsolete for threats, assumptions, capabilities;
  ratings never copied.
- AVE: vendored profile missing, tampered (hash mismatch), non-canonical.
- diff-service: binding / mapping / AoU status changes open the commit gate.

## 14. Decisions to confirm

- **D1 Export unit.** A separate profile file written by the component side, **imported into the
  machine's `.tara.json` with its hash** *(recommended, v2 — no file access for report, CLI and
  browser, §8, §15 point 6)* — or vendored as a file in the machine repo — or read the component
  `.tara.json` directly at a pinned commit?
- **D2 Export rule.** Reachable + handed over + override with rationale *(recommended)*; reduced
  threats as capabilities, not threats.
- **D3 Bound vs. decomposed.** A multiprocess is either bound or decomposed, never both
  *(recommended)*.
- **D4 STRIDE on bound multiprocesses.** Per-element STRIDE suppressed, per-interaction STRIDE on
  its flows kept *(recommended)*.
- **D5 Methodology — DECIDED (2026-11-04).** Soft rule: methods may differ. Only
  component-intrinsic factors are exported, as raw values. Same fingerprint → prefill; different
  fingerprint → import without feasibility, everything not identical is re-rated by the analyst
  in the machine's method (§7.2). No conversion between methods in this version.
- **D6 Draft exports.** Block export from a dirty tree *(recommended)*, or allow "draft" profiles
  the machine cannot pin?
- **D7 AoU violation severity.** `not_fulfilled` as error *(recommended)* or warning?
- **D8 Who owns `repoUrl`.** In the profile (platform team publishes where it lives)
  *(recommended)* or only in the machine's binding?

## 15. Review 2026-11-04 — findings and answers

Code check of the draft against TARAflow 0.18 (feature/0.18-model-coverage), answers by the user
(2026-11-04):

| # | Finding | Answer / consequence |
|---|---|---|
| 1 | Binding, mappings, AoU status, `componentBindingId`, `exposedToIntegrator` are stored project data — the draft names no schema | **Schema ≥ 14.** Schema 13 is closed with 0.18; this feature opens its own fence (additive fields, a `migrate-13-to-14` only where data is reshaped) |
| 2 | The export key must not depend on display ids (a DFD renumber) | Threats already carry a UUID `id` next to `displayId` — the key uses it (§4); nothing else to do |
| 3 | §9 said obsolete threats are "retired with history", but the risk sync deletes orphaned risks | **Risks follow their threats:** imported threats get their risks through the normal sync, orphaned risks are deleted. The reconciliation preview lists the risks that will go before the move (§9) |
| 4 | No field "intrinsic / context-dependent" in `RiskFactorDefinition`, no scale version | **Accepted:** a `factorClass` on the factor definitions (component-intrinsic / context-dependent, §7.2); the scale version is the existing tables hash `mappingVersion` of the calc stamps — no new version counter |
| 5 | Interplay with 0.18 features | **To be worked out** before phase 4: (a) a bound multiprocess is a black box — its "inside" fields (D-30c) are hidden, the profile replaces them; (b) component capabilities as evidence in the requirement matrix (62443 rows, claims as in IEC-6) or not; (c) EN 50742 A paths to a safety function (CM-12b) continue through the interface mapping into the component's exported interfaces |
| 6 | Report / CLI / browser need the profile | Everything the plant report needs is imported (§8): the component repository is never needed. Recommendation: profile embedded in the machine's `.tara.json` (D1) — then no file access at all |
| 7 | "Outermost physical boundary of the top page" ambiguous | A multiprocess inside a physical boundary with interfaces on it is a clear border — that is the default (§5.1) |

Release: **0.19** (user 2026-11-04) — not 0.18, which is closed in scope. Before phase 0: decide
D1 (embedded, recommended), D2 – D4, D6 – D8, and work out §15 point 5.
