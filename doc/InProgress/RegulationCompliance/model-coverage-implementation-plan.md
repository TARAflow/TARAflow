# TARAflow — Model coverage and multi-standard compliance: implementation plan

**Status:** v0.9 · 2026-11-02 · K-1 … K-15 decided (user 2026-11-02: all as recommended) · CM-1 … CM-4, CM-5a, CM-5c done · base: `main` d8b6d6fd (0.17.0-beta, schema 12) ·
target 0.18.0-beta (stage 1), later releases (stage 2)
**Author:** reviewer instance (v0.1, first draft for the user); instance A (v0.2,
standard references verified against the licensed texts — §4.4).
**Texts verified (v0.2):** IEC 62443-4-2:2019; EN IEC 62443-4-2:2019/prAA:2026 (CENELEC
enquiry draft, incl. Annex H and Annex ZZ); ETSI EN 303 645 V2.1.1 (2020-06); FprEN
18031-1, -2, -3 (final drafts, May 2024). The CRA itself is not among the texts: CRA
letters come from Table ZZ.1 / Annex H of the prAA draft, CRA wording quoted from the
regulation is marked "(CRA text)".
**Inputs:** `iec-62443-4-2-cra-coverage.md` §6 (gaps P-1 … P-7), §7.1 (D-1 … D-31),
§11 (fields F-1 … F-28); review 2026-11-02 (reviewer) of §11; user 2026-11-02:
"a sub-tab per standard in the Compliance tab, shown when a regulation tag of that
standard is set — so the regulations can be changed later".

The K-points of §9 are decided (user 2026-11-02: all as recommended); the steps of §10 follow from them.
Requirement texts are paraphrased; the standards are authoritative and never committed.

---

## 1. Purpose and scope

Two strands that belong together:

1. **Model coverage** — DFD element properties that let the model show what the type C
   rows ask for today only by a statement (§11 of the coverage document: 31 of 90 CRA
   rows, 44 of 122 classic rows). The fields describe the product, not a regulation:
   threat generation, the closed loop, mitigation effects and every matrix read the same
   field.
2. **Multi-standard Compliance tab** — the tab becomes a frame with **one sub-tab per
   standard**, shown when a regulation tag of that standard is set. A standard is a data
   module on one evaluator. Today only IEC 62443-4-2 (classic, CRA edition) exists; ETSI
   EN 303 645 and EN 18031-1/-2/-3 are the next candidates, EN 50742 approach B later.

| Stage | Release | Content |
|---|---|---|
| 1 | 0.18 | sub-tab frame + standard registry; both 62443 editions as sub-tabs; cross-cutting field rules (§3); stage-1 fields (§4.2) with form, evaluator rules, report rows, golden tests; schema 13 (§6) |
| 2 | 0.19+ | remaining fields (§4.3); threat generation and closed-loop coupling of the new fields; ETSI EN 303 645 and EN 18031 modules after their texts are verified (§8) |

Out of scope: process requirements (IEC 62443-4-1, CRA Annex I Part II) except the
project-level support data of F-28; Annex H threat list (D-10).

## 2. Architecture — the Compliance frame

### 2.1 Standard registry (replaces `selectEdition`)

Today `selectEdition(tags)` returns one `Edition`; with both 62443 tags the CRA edition
wins (D-3). The registry returns **every** active standard:

```ts
/** A standard the Compliance tab can evaluate — data only, no code of its own. */
interface StandardModule {
  id: StandardId;                 // "iec-62443-4-2-2019" | "en-iec-62443-4-2-praa-2026" | …
  family: StandardFamilyId;       // "iec-62443-4-2" — statements and component shared inside
  tags: readonly string[];        // regulation tags that show the sub-tab
  edition: Edition;               // rows, groups, requirement ids (existing type, generalised §2.3)
  header: "security-levels" | "conformance";  // SL-T / SL-C per FR, or a conformance summary
  draft: boolean;                 // e.g. prAA enquiry draft — shown as such
}

function activeStandards(tags: Pick<ProjectTags, "regulation">): readonly StandardModule[];
```

- Lives in `features/compliance` (pure, imports `shared` only — unchanged boundary).
- **D-3 is superseded** (K-1): with `IEC 62443` and `EN IEC 62443 (CRA)` both sub-tabs
  appear. D-31 (statements per requirement, shared by both editions) makes this cheap.
- The generic `CRA` tag still selects no matrix (D-1 unchanged).

### 2.2 Sub-tabs

- The frame is **inside** `compliance-tab.tsx`: the workspace passes the list of active
  standards and the project data; the sub-tab state is local to the tab. This keeps the
  change in `workspace-layout.tsx` to the one place that computes `complianceEdition`
  today (line ~1136) — no conflict with MT-1 beyond that line (K-8).
- Sub-tab order: registry order (62443 CRA, 62443 classic, EN 303 645, EN 18031 …).
  The last selected sub-tab is a per-viewer convenience (localStorage, wrapped in
  try/catch).
- Shared building blocks per sub-tab: component selector, header (by `header` kind),
  row table, statement dialog, requirement info dialog, to-do list, quick guide. A new
  standard adds data, not components.

### 2.3 Generalising the edition model

`EditionRow.fr: FoundationalRequirement` and `SlVector` are 62443 concepts. For other
standards:

- `EditionRow.group: string` (62443: the FR id; EN 303 645: the provision group, e.g.
  "5.1"); the edition lists its groups with i18n keys.
- `minSl` stays optional and is used only when `header === "security-levels"`.
- Requirement ids get a **namespace per family** (`iec62443:cr-1.1`, later
  `en303645:5.1-1`) — K-4. Evidence rules stay keyed by requirement id; families may
  reuse rule *building blocks* (the shared target constants of `evidence-rules.ts`),
  never another family's ids.

### 2.4 Project data — one block per family

```ts
interface ComplianceData {
  /** Default component for every family without its own (D-7). */
  componentId?: string;
  families?: Partial<Record<StandardFamilyId, FamilyComplianceData>>;
}
interface FamilyComplianceData {
  componentId?: string;           // overrides the default (K-5)
  target?: Partial<Record<string, TargetLevel>>;   // per group; 62443: SL-T per FR
  deviceCategories?: DeviceCategoryChoice;          // 62443 classic only
  statements?: Record<string, ComplianceStatement>; // key: requirementKey (D-31)
}
```

- Schema 13 moves today's top-level `target`, `deviceCategories`, `statements` 1:1 into
  `families["iec-62443-4-2"]` (§6). K-2 decides whether to reshape or to keep the 62443
  fields at the top level and add `families` for the others only.
- **Removing a tag keeps the data.** The sub-tab disappears; component, target and
  statements stay in the file and return with the tag. The report shows active
  standards only. K-3: the verification hash keeps covering the data of hidden
  standards (recommended — a tag change is not an analysis change, and dropping data
  from the hash on a tag change would make the verification depend on the tags).
- **Statements are shared inside a family, never across families** (K-6). EN 303 645
  5.1 and CR 1.5 are related, not equal. Across families the shared basis is the model
  fields of §4; the UI may show "see also: statement on CR 1.5 (IEC 62443)" as a link,
  never as evidence.

### 2.5 Report

One chapter per active standard, built from the existing chapter (IEC-7) with the
header kind as the only variable part; CLI chapter list and pdfmake included.

## 3. Cross-cutting rules for every new field

These hold for every field of §4 and are tested once, generically.

| # | Rule | Why |
|---|---|---|
| R-1 | **Default `not_specified`** for every new enum; evaluator reads it as `unknown` (D-12). A boolean field is three-valued (`not_specified` / `yes` / `no`) like the session switches of P-2. | An unfinished model never looks better than a complete one. |
| R-2 | **No positive or worst-case default, no derived value written on load.** Threat generation treats `not_specified` exactly as today. | Existing projects keep their threats, risks and verification hash — schema 13 stays analysis-preserving for them (§6). |
| R-3 | **One visibility predicate per field**, defined once in `shared/models/property-visibility.ts` (pure): form, evaluator, threat generator, closed loop and report call the same predicate. | One truth for "shown when"; the evaluator may not import `features/dfd`. |
| R-4 | **A hidden field is ignored everywhere but kept in the file** (K-7). When the driver changes back, the value returns. The evaluator treats a hidden field like an absent one; a conformance test checks that every consumer reads the field through the predicate. | Avoids the recurring "stale dependent field" bug class without silent data loss. |
| R-5 | **One source per capability.** Before a field is added, the plan names the existing property it would duplicate and decides (§4.1). | Two sources contradict each other sooner or later. |
| R-6 | **Element or component** is decided per field (§4.2 column "on"). Component-wide capabilities sit on the Multiprocess; a black-box Multiprocess (D-30) carries the per-element fields too (option c). | Matches D-13 (quantifier) and D-22 (allowlist of `any`). |
| R-7 | Every field: i18n label, help text and value labels EN + DE; report row in the element property table; doc description. | TARAflow code rule (all user-facing text via i18n). |
| R-8 | A field changes a matrix row's type only with a golden test on an example that shows the row before and after (§7). | Keeps the coverage document's counts and the code in step. |

## 4. Fields

### 4.1 Triage of §11 (review 2026-11-02)

| § 11 field | Proposal | Reason |
|---|---|---|
| F-5 `loginAttemptLimit` | **drop**; close P-7 instead (carry `interfaceIds` of the flow into the property view, read the existing `Interface.implementedControls.abuseProtection` = `lockout`) | R-5 — the capability already exists on the interface. v0.2: CR 1.11 needs a limit **and** a denial period → `lockout` only; EN 303 645 5.1-5 and EN 18031 AUM-6 accept rate limiting → `rate_limited` or `lockout` |
| F-2 `passwordPolicy` | **split** (v0.2): `passwordStrength` and `passwordLifetime` | strength (CR 1.7) and lifetime (CR 1.7 RE(1)/RE(2)) are separate rows; prAA voids RE(1) and narrows RE(2) to software processes and devices |
| F-3 `defaultCredentials` | **add** `authenticatorChangeable` as F-3b (v0.2, K-12) | mandatory in EN 303 645 (5.1-4) and EN 18031 (AUM-4); CR 1.5 item c |
| F-27 `updateNotification` | **rename** `updateDelivery`, values after CR 3.10 RE(2) a/b/c; **add** `updateDefaults` as F-27b (v0.2, K-12) | RE(2) accepts any of automatic / notification / on request or schedule; the CRA asks more (enabled by default, opt-out, postpone) |
| F-13 `timeSource` | **keep as field**, close P-4 for the time source (no EE type "time_source"); keep the EE type "siem" question for CR 6.1 RE(1) open | one source; a field is cheaper than a modelling convention |
| F-17 `sessionIdsRandom` | **rename** `sessionControl.sessionIntegrity`, type **B** with checklist (unique, random, invalidated at logout, bound to the session) | CR 3.8 is more than random ids |
| F-25 `securityConfiguration` | **split**: `secureByDefault` and `securityConfigReporting` | v0.2: both halves are CR 7.6 itself — prAA CR 7.6 a) secure-by-default configuration, b) an interface to the deployed settings (2019: same two sentences); RE(1) machine-readable report. CR 7.6 → A needs both fields |
| F-28 support data | **project level** (Overview), not an element; no matrix row in 62443-4-2 | CRA Annex II / 62443-4-1 — process, report header only |
| others | as in §11, names to be confirmed in §4.2 / §4.3 | — |

### 4.2 Stage 1 (0.18) — CRA essentials and EN 303 645 core

Selection: fields that close CRA Annex I Part I points and the mandatory EN 303 645 /
EN 18031 authentication, update and deletion provisions, need no threat-generation
change, and turn C rows into A/B. Verified against the texts in v0.2 (§4.4 for the
references of every field).

| # | Field | On | Shown when (R-3) | Values (`not_specified` first, R-1) | 62443 rows after |
|---|---|---|---|---|---|
| F-1 | `userAccounts` | Process, Multiprocess | the element authenticates (Process `authenticationRequired` ∉ {not_specified, no}; Multiprocess `boundaryAuthentication` ∉ {not_specified, none}) **and** has a human neighbour (D-24) | individual · per role · shared (v0.9: the login per role of industrial devices) | CR 1.1 RE(1) → A (both editions); per role / shared meet CR 1.1, not RE(1) |
| F-2a | `passwordStrength` | Process, Multiprocess | a password is in use: an incoming flow with `endpointAuthentication` = password, or Multiprocess `boundaryAuthentication` = password | none · fixed rules · configurable policy | CR 1.7 → A with "configurable policy" (both editions) |
| F-2b | `passwordLifetime` | Process, Multiprocess | as F-2a | none · human accounts · machine accounts · all accounts | 2019: RE(1) ← human / all (help text: lifetime **and** reuse limit), RE(2) ← all; prAA: RE(1) void, RE(2) ← machine / all |
| F-3 | `defaultCredentials` | Process, Multiprocess | the element authenticates (as F-1, without the human condition) | none pre-installed · unique per device · change enforced at first use · universal | CR 1.5 items a, b (checklist; the row stays B) |
| F-3b | `authenticatorChangeable` | Process, Multiprocess | as F-3 | yes · no | CR 1.5 item c (checklist) |
| F-22 | `userDataDeletion` | Multiprocess; DataStore | Multiprocess: always; DataStore: `storedDataTypes` contains pii, credentials, keys_certificates or config | none · by the user · by factory reset · both | prAA CR 4.2 (erase at rest), CR 7.9 (reset) — checklist items; 2019 CR 4.2 (erase on decommissioning) |
| F-25a | `secureByDefault` | Multiprocess | always | yes · no | CR 7.6 → A with F-25a = yes **and** F-25b ≠ none |
| F-25b | `securityConfigReporting` | Multiprocess | always | none · readable interface · machine-readable report | CR 7.6 RE(1) → A with machine-readable report |
| F-27 | `updateDelivery` | Multiprocess, Process | `updateMechanism` ∉ {not_specified, none} | manual only · notification of available updates · on request or scheduled · automatic | prAA CR 3.10 RE(2) B → A when ≠ manual only (no row in 2019) |
| F-27b | `updateDefaults` | Multiprocess, Process | F-27 = automatic | multi-select: enabled by default · user can disable · user can postpone | — (CRA (2)(c), EN 303 645 5.3-6) |
| F-28 | security contact, support period end, model designation | project (Overview) | always | text · date · text | — (62443-4-1, process) |
| F-29 | `roleMapping` (v0.9, user 2026-11-02) | Process, Multiprocess | `authorizationModel` = rbac (and the element does not state "no authentication") | fixed roles · configurable | CR 2.1 RE(2) stays A, now `roleMapping` = configurable — RBAC alone over-claimed it |

**Answers to the v0.1 open points (instance A, v0.2):**

- **Value lists** — as in the table. Two come straight from the texts: F-3 uses the two
  implementation categories of EN 18031 AUM-5-1 (unique per device with best-practice
  strength, or change enforced at first use; "unique" means random, not derivable from
  serial number or MAC — EN 303 645 5.1-2), F-27 the three alternatives a/b/c of prAA
  CR 3.10 RE(2).
- **F-1 / F-2 on the interface?** No. The interface carries link-layer authentication only
  (`Interface.linkAuthentication`; its doc comment: everything else lives on the
  endpoint). Accounts and password rules belong to the verifier — the Process or the
  Multiprocess. Caveat for the predicate: `Process.authenticationRequired` has no value
  "password"; passwords show up only as `DataFlow.endpointAuthentication` and
  `Multiprocess.boundaryAuthentication`, so F-2a/b read the incoming flows. EN 18031 asks
  per interface (AUM-1-1 network, AUM-1-2 user interface) — that view comes from the
  flows' `interfaceIds` (P-7), not from a field on the interface.
- **CRA letters** — confirmed for every stage-1 field via Table ZZ.1 of the prAA draft
  (subclause numbers there; 5.3 = CR 1.1 … 11.11 = CR 7.9). The fields do not carry CRA
  letters: the edition rows already do (`EditionRow.cra`); a field reaches the CRA through
  its rows (K-13). Side finding: CR 7.6 carried a stray (2)(l) in the prAA edition —
  ZZ.1 lists subclause 7.6 (= CR 3.4) there, not CR 7.6; fixed on main (patch 44).

### 4.3 Stage 2 (0.19+)

F-4, F-6, F-7, F-8, F-9, F-10, audit cluster F-11, F-12, F-13, F-14, F-15, F-16, F-17
(as `sessionIntegrity`), F-18, F-19, F-20, F-21, F-23, F-24, F-26 — specified with the
same columns as §4.2 before stage 2 starts, plus per field:

- **threat generation**: which threat it adds, removes or modulates when set, and the
  guarantee that `not_specified` keeps today's output (R-2);
- **closed loop**: whether it is a control property (SHOULD / IS, Apply);
- **mitigation effects**: catalog mitigations whose DFD effect sets it (D-29).

### 4.4 Verification of the §11 columns (instance A, v0.2)

Replaces the preliminary EN 303 645 / EN 18031 columns of the coverage document §11.
EN 303 645: provision and status from Table B.1 (M mandatory, R recommended, C
conditional). EN 18031: requirement id and the parts that contain it — LGM only in
parts 2 and 3, DLM and UNM only in part 2, RLM / NMM / TCM only in part 1, GEC-8 only
in part 3. "—" = the standard has no matching requirement; "related" = same topic,
different requirement (never counted as evidence).

| # | Field | 62443-4-2 (verified) | CRA (rows: ZZ.1, Annex H for REs) | EN 303 645 V2.1.1 | EN 18031 | v0.1 said |
|---|---|---|---|---|---|---|
| F-1 | `userAccounts` | CR 1.1 RE(1) | (d) | — | — | 5.1 / AUM |
| F-2a | `passwordStrength` | CR 1.7 | (d) | — (5.1-1 only points to NIST SP 800-63B, informative) | AUM-5 (strength for factory-default and generated passwords) — partial | 5.1 / AUM |
| F-2b | `passwordLifetime` | 2019 CR 1.7 RE(1), RE(2); prAA RE(2) only | (d) | — | — | — |
| F-3 | `defaultCredentials` | CR 1.5 a, b | (b), (d) | 5.1-1 M C, 5.1-2 M C | AUM-5-1, AUM-5-2 (1/2/3) | 5.1 / AUM |
| F-3b | `authenticatorChangeable` | CR 1.5 c | (b), (d) | 5.1-4 M C | AUM-4 (1/2/3) | new |
| F-4 | `authenticatorFeedbackMasked` | CR 1.10 | (d) | — | — | — / AUM |
| F-5 | (P-7: interface `abuseProtection`) | CR 1.11 (`lockout`) | (d) | 5.1-5 M C (rate limit suffices) | AUM-6 (1/2/3) | 5.1 / AUM |
| F-6 | `loginBanner` | CR 1.12 | — | — | — | ok |
| F-7 | `certificateManagement` | CR 1.8 | (d), (e), (f) | — (5.5-1 general) | AUM-3 (validate all authenticator properties, e.g. full certificate) | 5.5 / CCK, CRY |
| F-8 | `remoteAccessApproval` | CR 1.13 RE(1) | (j) | — | — | — / ACM |
| F-9 | `supervisorOverride`, `dualApproval` | CR 2.1 RE(3), RE(4) | (d) | — | — | — / ACM |
| F-10 | `mobileCode` | CR 2.4, RE(1) | (j) | — | — | 5.7 / GEC |
| F-11 | `auditCapacity` | CR 2.9, RE(1) | (h) | — | LGM-3 (keep a minimum number of latest events — a ring buffer meets it) (2/3) | — / LGM |
| F-12 | `auditFailureResponse` | CR 2.10 | (h), (l) | — | — | — / LGM |
| F-13 | `timeSource` | CR 2.11, RE(1), RE(2) | (f) | — | LGM-4 (timestamp when real time is available, else relative time) (2/3) | — / LGM |
| F-14 | `auditAccess` | CR 6.1 | (d), (l) | — | — | — / LGM |
| F-15 | `writeOnce` | CR 3.9 RE(1) | — (CR 3.9 not in ZZ.1) | — | — (LGM-2 asks for persistent storage, not write-once) | — / LGM |
| F-16 | `auditOptOut` | prAA CR 2.8 RE(1) (opt-out for authorised users) | (l) — the CRA's opt-out | — | — | ok |
| F-17 | `sessionIntegrity` | CR 3.8 | (f) | — | — (SCM-4 is replay on the channel) | 5.5 / SCM |
| F-18 | `securitySelfTest` | CR 3.3, RE(1) | — (CR 3.3 not in ZZ.1) | — | — | 5.7 / GEC |
| F-19 | `integrityViolationAlert` | CR 3.4 RE(2) | (f), (k), (l) | 5.7-2 R | — (GEC-8, part 3: verified boot, no alert) | 5.7 / SUM, RLM |
| F-20 | `rootOfTrustProvisioning` | CR 3.13 | (d), (e), (f) | related 5.4-2, 5.4-4 | related CCK-3 (pre-installed keys unique per device) | 5.4 / SSM, CCK |
| F-21 | `deletionVerified`, `sharedMemoryErased` | CR 4.2 RE(2), RE(1) | (b), (e), (m) | 5.11-4 R (confirmation of deletion) ~ `deletionVerified` | — | 5.11 / DLM |
| F-22 | `userDataDeletion` | prAA CR 4.2, CR 7.9; 2019 CR 4.2 | (b), (e), (m) | 5.11-1 M (user data = personal data, user configuration, keys and passwords), 5.11-2 R (associated services) | DLM-1 (personal data and sensitive security parameters) (2 only) | 5.11 / DLM |
| F-23 | `resourceLimits` | CR 7.2 | (h), (k) | related 5.9-1 R | related RLM-1 (DoS resilience — closer to CR 7.1) (1 only) | 5.9 / RLM |
| F-24 | `backupVerified` | CR 7.3 RE(1) | (f), (h) | — | — | 5.9 / RLM |
| F-25a | `secureByDefault` | CR 7.6 a) | (b), (k) | no single provision; related 5.6-1 M (unused interfaces disabled), 5.3-6 R | related GEC-2 (factory default exposes only necessary interfaces and services), GEC-3 (optional services switchable) | 5.6 / GEC |
| F-25b | `securityConfigReporting` | CR 7.6 b), RE(1) | (b), (k) | — | — (GEC-4 is user documentation of interfaces) | — |
| F-26 | `inventoryReporting` | CR 7.8 | — (CR 7.8 not in ZZ.1) | related 5.3-16 M (model designation recognisable) | — | — / GEC |
| F-27 | `updateDelivery` | prAA CR 3.10 RE(2) | (c), (f) | 5.3-4 R, 5.3-5 R, 5.3-11 R, 5.3-12 R | SUM-3 — automatic or scheduled/triggered under human approval; notification alone does not meet it; part 2 only for internet-connected equipment (1/2/3) | 5.3 / SUM |
| F-27b | `updateDefaults` | — | (c) (CRA text: automatic security updates on by default, opt-out, postpone) | 5.3-6 R C | — | new |
| F-28 | contact, support period, model designation | — (62443-4-1) | Annex II (CRA text; item numbers to check against the OJ) | 5.2-1 M, 5.3-13 M, 5.3-16 M | — | 5.2, 5.3 / — |

Consequences:

- **EN 303 645 is mostly not about the fields of stage 2.** Of its 32 mandatory
  provisions, the stage-1 fields plus P-7 answer 5.1-1, 5.1-2, 5.1-4, 5.1-5, 5.2-1,
  5.3-13, 5.3-16 and 5.11-1; most of the rest map to existing properties (5.3-2 / 5.3-10
  `updateMechanism`, 5.4-1 storage protection, 5.5-1 / 5.5-5 flow encryption and
  authentication, 5.6-4 debug interface, 5.13-1 input validation) or are manufacturer
  statements (6-1 … 6-5, 5.8-3). The EN 303 645 module (§8) is therefore mostly a mapping,
  not new fields.
- **EN 18031 is per part.** A module needs the part selection (K-14); the decision trees
  and implementation categories (e.g. AUM-5-1) suit the checklist mechanism of type B.
- **Stage 2 shrinks for these two standards:** F-4, F-6, F-8, F-9, F-10, F-12, F-14,
  F-15, F-16, F-17, F-18, F-24, F-25b, F-26 serve 62443 only.

## 5. Evaluator and rules

- New fields enter `evidence-rules.ts` as ordinary `PropertyCheck`s; the conformance
  test (D-15, D-18) covers them automatically once `element-properties.ts` has them.
- The evaluator applies R-4 through the visibility predicate before it reads a field
  (a hidden field = unset → `unknown` only where the rule needs it; where the predicate
  is false the element is usually not applicable anyway).
- D-23 (`custom` on A rules → `unknown`) applies to the new enums unchanged.
- The coverage document's counts (§4 "Count") and the edition files are regenerated by
  the existing script; the completeness test keeps them equal.

## 6. Schema 13 — one fence for 0.18

Contents (each a pure function in its own file, one call line in `migrate-12-to-13.ts`):

| Step | Change | Analysis-preserving? |
|---|---|---|
| S13-a | new optional fields of stage 1 (additive) | yes — no value changes |
| S13-b | `ComplianceData` reshape into `families` (if K-2 = reshape) | yes, 1:1; verification re-sealed on load (as P-1) |
| S13-c | FX-6 path keys (AND gate = one path) + FX-5 relink, release plan 0.18 | **no** for files with AND gates in attack trees |

The current mechanism declares preservation **per version number**
(`ANALYSIS_PRESERVING_MIGRATIONS`): with S13-c in schema 13, every 0.17 verification
would become invalid — also for projects without a single AND gate. K-9: let a
migration step report per file whether it changed an analysis value (S13-c: only when
a tree has an AND gate with several leaves); the version stays analysis-preserving for
the other files. Alternative: FX-6 in its own schema 14.

Older releases: 0.17 refuses schema 13 (existing guard, verified on 0.16.1 for 12).

## 7. Tests

- **Generic** (once): every new field has `not_specified` as default and is
  three-valued where boolean (R-1); every field has a visibility predicate and every
  consumer uses it (R-3, R-4 — a source-level test like the single-writer guard);
  i18n completeness EN / DE for labels, help, values (R-7).
- **Per field**: visibility on driver change and back (value kept, ignored while
  hidden); evaluator row before / after; report row.
- **Golden tests on the examples** (R-8): Pump Station, SmokeDetector-leveled (fixture),
  Headlamp — row status per edition before and after each field step; an unset field
  never improves a row.
- **Registry / sub-tabs**: both 62443 tags → two sub-tabs; tag removed → sub-tab hidden,
  data kept, hash unchanged (K-3); tag re-added → data back.
- **Migration**: S13-a/b round trip; verification re-seal; S13-c per-file preservation
  (K-9).

## 8. Other standards — conditions before a module is built

A module for ETSI EN 303 645 or EN 18031-x is built only when:

1. the licensed text is available to instance A (never committed; paraphrase only);
2. a coverage document like `iec-62443-4-2-cra-coverage.md` lists the provisions,
   their applicability and the model evidence, with the preliminary columns of §11
   verified or corrected;
3. the K-points of that standard are decided (e.g. EN 303 645 "M / R / C" status per
   provision as the conformance header; EN 18031 decision trees as checklists).

Until then the §4.4 columns for these standards are not shown in UI or report.

Versions (v0.2): the texts in `Standards/` are ETSI EN 303 645 **V2.1.1** (2020-06) and
EN 18031-1/-2/-3 as **FprEN (May 2024)** — the module states the version it was built
against (like `draft: true` for prAA); K-15 asks which versions to target.

## 9. Decisions (K) — decided 2026-11-02 (user: all as recommended)

| # | Question | Options | Decision |
|---|---|---|---|
| K-1 | Both 62443 tags set | (a) CRA wins (D-3) · (b) two sub-tabs | **b** — supersedes D-3 |
| K-2 | Project data for several families | (a) reshape into `families` (schema 13, 1:1) · (b) 62443 at top level, `families` only for others | **a** — one shape for all; one-time re-seal |
| K-3 | Hash coverage of hidden standards | (a) keep covering · (b) only active standards | **a** — a tag change is not an analysis change |
| K-4 | Requirement ids across families | (a) namespace per family · (b) flat ids | **a** — avoids collisions, D-11 stays per family |
| K-5 | Component per standard | (a) one for all · (b) per family with shared default | **b** |
| K-6 | Statements across families | (a) shared · (b) per family, "see also" link | **b** |
| K-7 | Hidden field on driver change | (a) keep + ignore · (b) reset | **a** — reversible, no silent loss; tested via R-3/R-4 |
| K-8 | Order to MT-1 (workspace split) | (a) MT-1 first · (b) frame inside the tab, one line in the workspace | **b** — independent of MT-1 |
| K-9 | FX-6 and analysis preservation | (a) per-file preservation report · (b) FX-6 in schema 14 · (c) accept invalidation | **a** |
| K-10 | Stage-1 field list | as §4.2 · smaller · larger | **as §4.2** |
| K-11 | Triage §4.1 (drop F-5, F-13 as field, split F-25, F-17 as B; v0.2: split F-2, rework F-27) | accept · change | **accept** |
| K-12 | F-3b `authenticatorChangeable` and F-27b `updateDefaults` in stage 1 | (a) stage 1 · (b) stage 2 | **a** — F-3b is mandatory in EN 303 645 and EN 18031; F-27b is the part of CRA (2)(c) no 62443 row covers |
| K-13 | Where the CRA letters of a field come from | (a) from the rows (`EditionRow.cra`, ZZ.1 / Annex H) · (b) per field | **a** — one source (R-5); a field has no CRA letter of its own |
| K-14 | EN 18031 module shape | (a) one module, part chosen by tag (`EN 18031-1/-2/-3`) · (b) three modules | **a** — 80 % of the requirements are shared; part-only ones (LGM, DLM, UNM, RLM, NMM, TCM, GEC-8) are flagged per row |
| K-15 | Versions of the other standards | (a) the texts in `Standards/` (EN 303 645 V2.1.1, FprEN 18031 2024) · (b) wait for newer texts | **a** for the mapping, with the version shown; re-check when the user adds newer texts |

## 10. Steps (0.18, stage 1)

Each step is one patch (`.diff` + `.msg`), CI green on its own, design-document status
updated. Owner suggestions: A = standards strand, B = maintenance strand.

| Step | Content | Depends on | Owner |
|---|---|---|---|
| CM-0 | this plan: K-points decided, standard references verified by A (**done**: references verified v0.2, K decided 2026-11-02) | — | A |
| CM-1 | standard registry `activeStandards`, generalised `EditionRow.group`, requirement id namespace (K-4) — no UI change, both editions still evaluate (**done**, see below) | CM-0 | A |
| CM-2 | sub-tab frame in `compliance-tab.tsx`, D-3 superseded, per-viewer last sub-tab (**done**, see §10.1) | CM-1 | A |
| CM-3 | schema 13 skeleton (`migrate-12-to-13.ts`, fence, fixtures) + S13-b reshape + per-file preservation (K-9) (**done**, see §10.1) | CM-0 | A |
| CM-4 | `property-visibility.ts` + generic tests R-1 … R-4 (no field yet) (**done**, see §10.1) | CM-0 | A |
| CM-5a | F-1, F-2a, F-2b (accounts, passwords) — model, form, i18n, rules, report, golden (**done**, see §10.1) | CM-3, CM-4 | A |
| CM-5c | `userAccounts` per role; F-29 `roleMapping`, CR 2.1 RE(2) corrected (user 2026-11-02) (**done**, see §10.1) | CM-5a | A |
| CM-5d | light sub-tabs per category under the Security divider of the Process / Multiprocess forms, open-field count per tab, tabs without fields hidden; context predicates for existing fields where they match the rule's applicability (user 2026-11-02) | CM-5c | A |
| CM-5b | F-3, F-3b (default credentials, changeable authenticators) — checklist items answered by fields (CR 1.5 stays B) | CM-5a | A |
| CM-6 | F-27, F-25a, F-25b (lifecycle / configuration) | CM-5 | A |
| CM-7 | F-22, F-28 (data deletion, support data) | CM-5 | A |
| CM-8 | P-7: interface ids in the property view; CR 1.11 back to A (replaces F-5) | CM-1 | A |
| CM-9 | report: one chapter per active standard | CM-2 | A |
| CM-10 | validation on the examples, coverage document counts, this plan → status | all | A |

FX-5 / FX-6 (S13-c) join the schema-13 fence of CM-3 when the 0.18 release plan
schedules them.

### 10.1 Progress

**CM-1 (done, 2026-11-02).**

- `services/standard-registry.ts` replaces `select-edition.ts`: `STANDARDS` (registry
  order = sub-tab order: CRA edition, classic edition), `activeStandards(tags)` returns
  every selected standard (K-1). `selectEdition` stays as "first active standard" for
  the tab and the report until CM-2 / CM-9 — no visible change yet.
- `StandardModule` as in §2.1 without `draft` (the edition carries it already, one
  source); `StandardFamilyId` lives in `shared` (CM-3 keys `ComplianceData.families`
  by it).
- `Edition<G>` / `EditionRow<G>`: `fr` → `group`, `Edition.family`, `Edition.groups`
  (62443: the seven FRs). `RowResult` and the to-do items mirror the row and carry
  `group` too; the report model keeps its `fr` column until CM-9.
- K-4 implemented as a namespace per family (`REQUIREMENT_NAMESPACES`,
  `qualifyRequirementId`, `parseRequirementId`; 62443: `iec62443`, the name of the
  catalog's reference field). Ids stay **unqualified inside their family** — statement
  keys (`requirementKey`), catalog references and evidence rules are unchanged, so no
  stored data changes; qualified ids are for places that mix families ("see also"
  links, K-6).
- Tests: registry (tags → standards, K-1 order, `MATRIX_TAGS` = registry tags),
  namespaces (round trip, unknown namespace), every row's group in `Edition.groups`,
  catalog field = namespace.

**CM-2 (done, 2026-11-02).**

- `components/compliance-frame.tsx` (new file next to `compliance-tab.tsx`, which stays
  the view of one edition): one sub-tab per active standard, labelled with
  `StandardModule.label` (new, not translated: the standard's short name); no sub-tab
  bar with a single standard, so single-tag projects look as before. The last sub-tab
  is kept in localStorage (`taraflow.compliance.subTab`); a remembered standard whose
  tag was removed falls back to the first one. Each sub-tab mounts the tab afresh
  (filter and dialogs belong to one standard).
- Only the selected standard is evaluated: `compliance-report.ts` splits
  `prepareProjectCompliance(project)` (property view, scope, mitigations, planned
  overlay — once per project state) from `evaluate(edition)`;
  `evaluateProjectCompliance(project, edition?)` keeps the report on the first active
  standard until CM-9.
- Workspace: `activeStandards` instead of `selectEdition`, `ComplianceFrame` instead of
  `ComplianceTab` — the change stays at the compliance block (K-8). D-3 is superseded
  in the tab; the report follows with CM-9.
- Component data (component, SL-T, statements) is still the one `project.compliance`
  block; statements are shared by both editions anyway (D-31). Per-family data comes
  with CM-3.
- Tests: frame (two sub-tabs, CRA first, only the selected one evaluated, remembered,
  fallback after tag removal, no bar for one standard); `prepareProjectCompliance`
  gives the same result per edition as `evaluateProjectCompliance`.

**CM-3 (done, 2026-11-02; branch `feature/0.18-model-coverage`).**

- Schema 13: `CURRENT_SCHEMA_VERSION = 13`, `versions/migrate-12-to-13.ts`, conversion
  dialog text v13 (EN / DE).
- S13-b (K-2): `ComplianceData` = `{ componentId?, families? }`, `FamilyComplianceData` =
  `{ componentId?, target?, deviceCategories?, statements? }` as in §2.4; schema 12's
  `target`, `deviceCategories`, `statements` move 1:1 into
  `families["iec-62443-4-2"]`, `componentId` stays the default (K-5). Data already
  per family passes unchanged.
- The fold of the 0.17-development statement form (D-31) moved from the load path
  (former step 3b of `parseAndRepairWithMetadata`) into the migration, before the
  move: it is a format conversion of schema-12 files and now reports what it drops.
- K-9: from schema 13 on, a migration returns `{ data, analysisChanged }` for the
  file; `applyMigrations` returns `analysisPreserved` (versions < 13: the declared
  set, unchanged; ≥ 13: the per-file report). The reshape reports no change — a TARA
  verification is re-sealed; a legacy statement dropped because both editions held
  different ones on one requirement (newer wins) reports a change → reconfirm. FX-6
  (S13-c) plugs into the same report when it is scheduled.
- Helpers in `shared` take the family: `familyCompliance`, `complianceComponentOf`
  (family's own component, else the default), `withComplianceStatement /
  withoutComplianceStatement / withComplianceTarget / withDeviceCategories (data,
  family, …)`; `withComplianceComponent` sets the default. The tab reads and writes
  the block of its edition's family; the component selector still edits the default
  (no per-family override in the UI until a second family exists).
- `prepareProjectCompliance`: `evaluate(edition)` uses the family's component scope
  and data and returns its own `scope` / `scopeName`; the context keeps the default
  scope (device-category proposal).
- K-3 unchanged: the verification hash covers the whole `project.compliance`,
  hidden families included.
- Tests: `migrate_12_to_13.test.ts` (reshape, no-op cases, legacy fold, per-file
  report, re-seal vs. reconfirm on load), helpers per family incl. K-5, report scope
  per family, fixtures and the Pump Station example in the new form; version checks
  of older migration tests no longer pin 12.

**CM-4 (done, 2026-11-02).**

- `shared/models/property-visibility.ts`: registry `MODEL_FIELDS` (empty until CM-5)
  with `property`, `elementTypes`, `values` (`not_specified` first), `multiple?`,
  `shownWhen(context)`. The context is the element (or flow) with its incoming and
  outgoing flows and the element at their other end (for a flow: its endpoints) —
  enough for the §4.2 drivers (incoming password flow, human neighbour,
  `updateMechanism`). `visibilityContexts(elements, flows)` builds it for the whole
  model.
- Readers: `isFieldShown`, `readModelField` (hidden → unset), `withoutHiddenFields`
  (copies of elements and flows without hidden fields; the stored model untouched —
  K-7). `isUnset` treats absent, empty, `not_specified` and an empty selection alike
  (both conventions of the model exist today).
- Evaluator: `buildGraph` masks hidden fields once, so every check — own properties
  and neighbour checks — sees a hidden field as unset (R-4); the evidence rules stay
  declarative.
- Generic tests, run for every registered field (CM-5 … CM-7 need no extra test for
  these rules): R-1 value list, R-6 element types and the declaration in
  `element-properties.ts`, R-7 label / help / value labels EN + DE under
  `dfd.json` `tabs.dfd.modelFields.<property>`, and a source guard (R-3 / R-4): a
  source file that names a registered field must use the predicate, except the
  declarations (registry, property types, evidence rules, migrations). The guard
  checks itself on `inputValidation`. The evaluator's masking is tested with a test
  registry.
- R-2 (threat generation unchanged for `not_specified`) is checked per field when it
  gets a threat effect (stage 2, §4.3); stage-1 fields have none.

**CM-5a (done, 2026-11-02).** CM-5 split: the CR 1.5 checklist items of F-3 / F-3b need
a mechanism of their own (CM-5b).

- Fields in the registry (values as `const` arrays in `property-visibility.ts`, the
  types in `element-properties.ts` derive from them): `userAccounts` (individual ·
  shared), `passwordStrength` (none · fixed rules · configurable policy),
  `passwordLifetime` (none · human accounts · machine accounts · all accounts) on
  Process and Multiprocess.
- **Shown only where the earlier settings make them meaningful** (user 2026-11-02),
  through named conditions `MODEL_CONDITIONS` shared by the fields and the rules:
  `authenticates` (Process `authenticationRequired` / Multiprocess
  `boundaryAuthentication` set and not "no" / "none"), `humanUsers` (a flow to a
  human external entity), `passwordInUse` (an incoming password flow or a boundary
  password — never where the element states it does not authenticate),
  `humanPasswordUse`, `machinePasswordUse` (by the source of the password flow;
  boundary password: by the kinds of external neighbours). F-1 = authenticates ∧
  humanUsers; F-2a / F-2b = passwordInUse. Value level: `passwordLifetime` offers
  human / machine / all only for the kinds of accounts that log in with a password
  there (`ModelField.valuesFor`); a stored value outside them stays selectable.
- Rules: `EvidenceTarget.when` (condition ids, yes / no) next to the property checks.
  CR 1.1 RE(1) A: `userAccounts` = individual on every element that authenticates
  human users; one that serves humans but states it does not authenticate fails.
  CR 1.7 A: `passwordStrength` = configurable policy where a password reaches the
  element. 2019 RE(1): lifetime human / all where humans log in with a password;
  2019 RE(2): every kind in use covered; prAA RE(2): machine / all where software
  processes or devices do. A password flow to an element outside Process /
  Multiprocess (the component logging in elsewhere) no longer makes CR 1.7
  applicable — it is not the component's password check. HUMAN_ENTITY_TYPES moved to
  `shared` (one list for rules and fields). Rule descriptions name the conditions in
  words (EN / DE).
- Type split: prAA A 39 · B 23 · C 28 (was 36 / 23 / 31); 2019 CR rows A 28 · B 17 ·
  C 25 (was 24 / 17 / 29); coverage documents updated.
- Form: `ModelFieldInputs` (generic, from the registry) in the Process and
  Multiprocess forms after the authenticator storage; the DFD tab provides the model
  (`ModelFieldProvider`: elements and connections → contexts), because the element
  form alone does not know its flows. Labels / help (tooltip) / values in `dfd.json`
  `tabs.dfd.modelFields`.
- Report: the element table lists the shown fields in the security group with the
  form's labels (`getElementPropertiesGrouped(element, lang, context)`; HTML /
  Markdown and pdfmake pass the context); hidden ones are left out.
- Pump Station example: the fields set on P-1 (HMI) and MP-1 (PLC); the statements
  on CR 1.1 RE(1) and CR 1.7 removed — the model shows them now (achieved: met 56,
  needs-statement 8). The generated root file has to be written again
  (`WRITE_EXAMPLES=.`).
- Tests: conditions and visibility per driver value and back (K-7), value filter,
  rules per edition (met / gap / unknown / n/a), form component, report rows, golden
  (SmokeDetector, CNC reference: unset fields never meet a row); the generic R-1 /
  R-3 / R-4 / R-6 / R-7 tests now run for the three fields.

**CM-5c (done, 2026-11-02).** User question 2026-11-02: industrial devices usually
have role-based logins and RBAC — how does the model show it?

- IEC 62443-4-2:2019 CR 1.1 (rationale) allows role- or group-based identification —
  several users may share one identity; CR 1.1 RE(1) (SL 2) asks for unique
  identification. `userAccounts` therefore has three values: one account per person ·
  one login per role · one shared login; per role and shared meet CR 1.1 (decided on
  the flows as before) and fail RE(1).
- CR 2.1 RE(2) (SL 2): an authorised role defines and changes the mapping of
  permissions to roles. The rule accepted `authorizationModel = rbac` alone — an
  over-claim for devices with roles fixed in the product. New field F-29
  `roleMapping` (fixed roles · configurable), shown with `authorizationModel = rbac`
  (condition `roleBasedAuthorization`); RE(2) met only with "configurable"; another
  authorization model has no roles to map → gap; unset → unknown. Projects with RBAC
  see RE(2) as unknown until the field is set (golden: never met while unset).
- Pump Station example: `roleMapping = configurable` on P-1 and MP-1 (counts
  unchanged).
- The Security section gets sub-tabs in CM-5d (user 2026-11-02: light tabs under the
  Security divider; hide a field only when it does not fit the context).
