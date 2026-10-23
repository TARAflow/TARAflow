# TARAflow: Asset-to-Asset Relationships

> German version: [taraflow-asset-zu-asset-beziehungen.md](taraflow-asset-zu-asset-beziehungen.md) — keep both in sync.

<sub>© Jürgen Messerer · 2026 · All rights reserved</sub>

> **Purpose of this document:** Formal definition of the asset-to-asset relationships in TARAflow.
> These relationships complement the element-to-asset relationships and allow modeling
> direct semantic connections between assets — without a detour through DFD elements.

---

## How to read this document

This document defines the complete relationship rule set. **Completeness is the goal
of the document — not the goal of every model.**

In practice, a few core relationships cover most use cases.
Relationships marked **[CORE]** are the recommended starting point.

### CORE relationships

> **`[CORE]`** = recommended starting relationships, cover ~80% of use cases.

Relationships marked **`[CORE]`** cover most projects.

**Recommendation:**
- Start with `[CORE]` relationships only
- Model only what you can explain — completeness comes through iteration, not exhaustion

**Extend the model only when:**
- impacts cannot be explained (`"Why is this asset critical?"`)
- dependencies are missing in the graph (`"This threat has no entry point"`)
- threats cannot be assigned clearly (`"STRIDE category unclear"`)

**CORE relationships at a glance:**

| Relationship | From → To | Purpose |
|---|---|---|
| `depends_on` | System/Service/Process → * | Availability dependency (DoS) |
| `required_by` | Data → Process/Function | Input dependency (Tampering) |
| `contributes_to` | Asset → Hazard Item | Contribution to a hazard (carries `relevance`) |
| `endangers` | Hazard Item → Human/Environment/Infrastructure | Endangers a protection target (carries `impact`) |
| `affects_privacy` | Data/Process → Human | Privacy relevance |
| `configures` | Data → Function/System | Configuration dependency |
| `runs_on` | Process → System | Execution context |
| `implements` | System/Process → Function | Architecture assignment |
| `hosted_on` | System → Infrastructure | Physical embedding |

> **Safety modeling:** The former direct edge `affects_safety` (Process/Function → Human)
> is replaced by the Hazard Item pattern: `Asset ─contributes_to─► Hazard Item ─endangers─► protection target`.
> For simple single causes without a Hazard Item, the safety annotation on the
> element→asset relation remains. Both paths are separate data sources (no collapsed
> hazard node). Details see "Two modeling paths" in the document "Asset Relationships",
> rationale and code locations in `taraflow-safety-model.md`.

> All other relationships are valid — they are used when the model requires them,
> not because the document lists them.

---

## 1. Concept and place in the graph

The TARAflow graph has two main levels — level 2 consists of the asset node types,
split into a vertical hierarchy and orthogonal categories, complemented by the
Hazard Item as its own hazard node:

```
Level 1:      DFD elements  ──(DataFlows)──  DFD elements
                   ↕ element-to-asset relationships (typed)
Level 2:
  Vertical    Data Assets           ──┐  Static structure
  (abstraction)  Function Assets    ──┤  (What / with what / where)
                 System Assets      ──┤
                 Infrastructure Assets ─┤
                                      ├──(asset-to-asset relationships)──
  Orthogonal  Process Assets        ──┤  Dynamic context
  (context)   Physical Assets       ──┤  (How / with what / who)
              Service Assets        ──┤
              Human Assets          ──┤
              Environment Assets    ──┘  Protection target (environment)

  Hazard      Hazard Item  ◄─contributes_to─ Assets
  (not an asset)           ─endangers─► Human / Environment / Infrastructure
```

**Environment Asset** is an orthogonal category and a **protection target** like Human —
the environment as something worth protecting (water bodies, soil, air), without a personal reference.

**Hazard Item** is **not an asset** but the explicit hazard. It is the
convergence point between hazard-causing assets (`contributes_to`) and
endangered protection targets (`endangers`). How several `contributes_to` inputs on the same
Hazard Item interact is set explicitly by `combinationType`: **ANY** (default, OR —
each cause alone is enough) or **ALL** (AND — only all together). Several inputs
do not imply combinatorics. Details see section "Hazard Item" in the document
"Asset Relationships".

Level 2 is a **heterogeneous graph**. The allowed
relationship types depend on the combination **source category × target category**:

```
Within a category:     Data→Data, Process→Process, ...
Between categories:    Data→Process, Process→Human, System→Infrastructure, ...
```

This follows the same principle as level 1: DFD elements also have different
types (Process, DataStore, ExternalEntity, ...) with type-dependent connection rules.

Asset-to-asset relationships describe **causality that exists independently of the data flow** —
safety, privacy and physical dependencies between assets that are not naturally expressed
through a DFD element.

**Example:**
```
Data Asset "Admin Audit Logs"
└─ affects_privacy → Human Asset "System Admin Role"

→ This relationship exists independently of which DFD element
  creates or reads the audit logs.
```

---

## 2. Two-tier rule set

TARAflow distinguishes two tiers of asset-to-asset relationships:

```
Tier 1: Core Rules
        → generic, domain-independent
        → built into the tool
        → analytically active (STRIDE, safety, criticality)

Tier 2: Domain Extensions
        → domain-specific, configurable
        → can be activated in phase 0 (project profile) or defined manually
        → default: documentary only
        → optional: analytically active (with mandatory rationale)
```

---

## 3. Tier 1: Core Rules (generic)

### 3.1 Within the same asset category

**Data → Data:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `derives_from` | Asset B is derived from asset A | Tampering (A affects B) | transitive |
| `aggregates` | Asset B aggregates several A instances | Tampering, InfoDisc | transitive |
| `supersedes` | Asset B replaces asset A (e.g. new firmware) | Tampering, Repudiation | transitive |

**Function → Function:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `depends_on` | Function A needs function B to execute | DoS | direct if B is safety-critical |
| `supersedes` | Function A replaces function B (new version) | Tampering, Repudiation | transitive |
| `calls` | Function A calls function B (functional dependency at design time) | Tampering, Spoofing | direct if B is safety-critical |

> **`calls` vs. `invokes`:** `calls` describes a **static functional dependency** between two capabilities (design time). `invokes` is reserved for **Process→Function** and describes the dynamic invocation of a tool at runtime.

**Process → Process:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `triggers` | Process A triggers process B | Tampering, Spoofing | direct if B is safety-critical |
| `depends_on` | Process A needs process B | DoS | transitive |
| `suspends` | Process A interrupts process B | DoS | direct if B is safety-critical |

**System → System:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `depends_on` **[CORE]** | System A needs system B | DoS | transitive |
| `integrates` | System A integrates system B | Tampering, Spoofing | transitive |

**Infrastructure → Infrastructure:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `powers` | Infra A supplies infra B with power | DoS | indirect |
| `houses` | Infra A physically houses infra B | Tampering | indirect |

**Human → Human:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `manages` | Person A manages person B | EoP | – |
| `reports_to` | Person A reports to person B | – | – |

---

**Physical → Physical:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `mechanically_linked` | Physical component A acts on B | Tampering | direct if B is safety-critical |
| `powered_by` | Component A is supplied by B | DoS | indirect |

**Service → Service:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `depends_on` | Service A needs service B | DoS | transitive |
| `delegates_to` | Service A hands requests to service B | Spoofing, Tampering | transitive |

---

### 3.2 Between different asset categories

**Semantic guidance — similar-sounding relationships:**

| Relationship | Primary semantics | STRIDE focus | When to choose |
|---|---|---|---|
| `depends_on` | Availability dependency | DoS | When failure of the target stops the source asset |
| `required_by` | Input dependency | Tampering | When data is needed as input for execution |
| `consumed_by` | Transformation | Tampering | When data is changed/consumed by the process |
| `implements` | Architecture (active) | Tampering | System/Process provides a function |
| `implemented_by` | Architecture (passive) | Tampering | Function is realized by system/process (mirror direction) |
| `runs_on` | Execution context | EoP, Tampering | Process physically runs on system |
| `hosted_on` | Infrastructure embedding | Tampering | System is housed in infrastructure |

> **Rule of thumb:** `depends_on` = "If X fails, I fail too."
> `required_by` = "I need X as input to function."
> `consumed_by` = "X is changed by me."

**Data → Process:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `required_by` **[CORE]** | Data is needed for process execution | Tampering, DoS | transitive via process |
| `consumed_by` | Data is transformed by the process | Tampering | transitive |
| `configures [step?]` | Data configures a specific process step — optional `stepOrder` qualifier | Tampering | direct if the process step is safety-critical |

**Data → Function:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `required_by` **[CORE]** | Data is needed for function execution | Tampering, DoS | transitive via function |
| `configures` **[CORE]** | Data configures the behavior of a function | Tampering | direct if the function is safety-critical |

**Data → Human:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `affects_privacy` **[CORE]** | Data contains personal information | InfoDisc | – |
| `exposes` | Data exposes a person to risks | InfoDisc | indirect |

**Function → Data:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `creates` | Function creates data asset | Tampering, Repudiation | transitive |
| `reads` | Function reads data asset | InfoDisc | transitive |
| `modifies` | Function changes data asset | Tampering | direct if data is safety-critical |
| `deletes` | Function deletes data asset | DoS | transitive |

**Function → Process:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `implemented_by` | Function is implemented by a process | Tampering | direct if the function is safety-critical |
| `triggers` | Function triggers a process | Tampering, Spoofing | transitive |

**Function → System:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `implemented_by` | Function is provided by a system | Tampering | direct if the function is safety-critical |
| `depends_on` | Function needs the system to execute | DoS | transitive |

**Function → Human:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `contributes_to` **[CORE]** | Function contributes to a hazard (Hazard Item) | Tampering, DoS | `relevance` on the edge |
| `operated_by` | Function is triggered or monitored by a person | Spoofing, Repudiation | indirect |

> **Safety path:** `Function ─contributes_to─► Hazard Item ─endangers─► Human`.
> Without a Hazard Item, the safety annotation on the element→asset relation carries the
> single cause (ANY semantics).

**Process → Function:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `implements` **[CORE]** | Process implements this function | Tampering | direct if the function is safety-critical |
| `invokes [step?]` | Process invokes a function — optional `stepOrder` qualifier | Tampering, Spoofing | transitive |

> **`stepOrder` qualifier:** If an `invokes` carries a step index (`step: 1`, `step: 2`, ...),
> an ordered sequence results. Manipulating the order = **sequencing attack** —
> a threat type that can only be modeled via Process Assets.

**Process → System:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `runs_on` **[CORE]** | Process runs on the system | Tampering, EoP | transitive |
| `depends_on` | Process critically depends on the system | DoS | transitive |

**Process → Human:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `contributes_to` **[CORE]** | Process contributes to a hazard (Hazard Item) | Tampering, DoS | `relevance` on the edge |
| `affects_privacy` **[CORE]** | Process processes personal data | InfoDisc | – |
| `operated_by` | Process is operated by a person | Spoofing, Repudiation | indirect |

> **Safety path:** `Process ─contributes_to─► Hazard Item ─endangers─► Human`.
> Without a Hazard Item, the safety annotation on the element→asset relation carries the
> single cause (ANY semantics).

**System → Function:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `implements` **[CORE]** | System provides this function | Tampering | direct if the function is safety-critical |
| `depends_on` | System needs the function | DoS | transitive |

**System → Infrastructure:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `hosted_on` **[CORE]** | System runs on infrastructure | Tampering | indirect |
| `powered_by` | System is supplied by infrastructure | DoS | indirect |

**Human → Process:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `responsible_for` | Person is responsible for the process | Repudiation | – |
| `authorized_for` | Person is authorized to execute the process | Spoofing, EoP | – |

---

> **Physical Assets — role in the graph:** Physical Assets are purely passive material assets without
> an embedded system. They do not appear in the DFD flow but are fully integrated into the graph
> via asset-to-asset relationships. Physical is not a subtype of
> Infrastructure — Infrastructure is stationary (building, network), Physical is mobile
> (tool, painting, prototype). The attack path to a Physical Asset always runs
> through Infrastructure or System Assets as the entry point.

**Physical → Function:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `enables` | Physical asset enables the execution of the function | Tampering | **direct** |
| `triggers` | Physical event triggers the function | Spoofing | direct if the function is safety-critical |

> **`enables` instead of `executes`:** A purely passive Physical Asset executes nothing — it *enables* a function through its physical presence or state. A hydraulic brake actuator enables the braking function; a mechanical key enables the access function. `executes` is reserved for DFD elements and Process Assets.

**Physical → System:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `hosts` | Physical device hosts the system | Tampering | indirect |
| `controlled_by` | Physical component is controlled by the system | Tampering, DoS | **direct** |

**Physical → Infrastructure:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `connected_to` | Physical component is connected to infrastructure | Tampering | indirect |
| `powered_by` | Physical component is supplied by infrastructure | DoS | indirect |
| `located_in` | Physical Asset is physically located in infrastructure | Tampering | indirect |

> **`located_in` vs. `connected_to`:** `located_in` describes a pure location relationship (a painting hangs in the museum room); `connected_to` describes a technical connection (a sensor connected to the OT network).

**Service → Function:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `provides` | External service provides the function | Tampering, Spoofing | direct if the function is safety-critical |
| `depends_on` | Service needs the function | DoS | transitive |

**Service → Data:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `exposes` | Service exposes data to the outside | InfoDisc | – |
| `consumes` | Service processes/stores data | Tampering | transitive |

**Service → System:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `integrates_with` | Service communicates with an internal system | Spoofing, Tampering | transitive |
| `monitors` | Service monitors the system | InfoDisc | indirect |

**Human → Function:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `authorized_for` | Person is authorized to trigger the function | Spoofing, EoP | – |
| `responsible_for` | Person is responsible for the function | Repudiation | – |

---

**Physical → Hazard Item:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `contributes_to` | Physical Asset contributes to a hazard (controls/enables the physical action) | Tampering, DoS | `relevance` on the edge (`direct` if the asset immediately controls the physical action) |
| `exposes` | Physical Asset exposes a person to risks (e.g. radiation, substance) | InfoDisc | indirect |

> **Architecture note:** In the current safety model, the `endangers` edge runs
> exclusively from **Hazard Item → protection target** (Human/Environment/Infrastructure).
> A Physical Asset (e.g. an overridden valve, a robot arm) contributes to the Hazard Item
> via `contributes_to`. Full path:
> `Physical ─contributes_to─► Hazard Item ─endangers─► Human`.
> For a single cause without a Hazard Item, the safety annotation on the
> element→asset relation is enough (no internal Hazard Item).

**Service → Human:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `affects_privacy` | Service processes or exposes personal data | InfoDisc | – |
| `endangers` | Failure of the safety-critical service endangers a person | DoS | direct if `isSafetyCritical: true` |

> `endangers` on Service→Human is only relevant if the service carries a safety-critical function (e.g. a remote monitoring service for patient monitoring). Without `isSafetyCritical: true` on the Service Asset there is no automatic safety propagation.

**Service → Infrastructure:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `hosted_on` | Service runs on internal infrastructure | Tampering | indirect |
| `depends_on` | Service depends on infrastructure availability | DoS | transitive |

**Infrastructure → Physical:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `houses` | Infrastructure houses the Physical Asset | Tampering | indirect |

> Reverse view of `Physical → Infrastructure: located_in`. Both relationships can be modeled; `located_in` (Physical→Infra) is the preferred direction, since the Physical Asset is the primary subject of analysis.

**Human → Physical:**

| Relationship | Semantics | STRIDE relevance | Safety relevance |
|---|---|---|---|
| `owns` | Person owns the Physical Asset | Repudiation | – |
| `responsible_for` | Person is responsible for the state and whereabouts of the asset | Repudiation | – |
| `accesses` | Person accesses the Physical Asset | Spoofing (on unauthorized access) | – |

---

### 3.3 Semantic distinctions and conflicts

Some relationship types are semantically similar but cannot be combined for the same asset pair. The following table clarifies edge cases — formal validation is done by the tool.

| Combination | Problem | Recommendation |
|---|---|---|
| `required_by` + `consumed_by` (Data → Process) | Contradiction: input vs. transformation | Choose exactly one semantics. `required_by` if data is read; `consumed_by` if it is transformed/consumed |
| `depends_on` + `implements` (System/Process → Function) | Architecture and runtime dependency mixed | `implements` for static architecture assignment; `depends_on` only for runtime availability dependency |
| `runs_on` + `hosted_on` used wrongly | Execution and infrastructure level mixed | `runs_on` applies to Process→System (execution context); `hosted_on` applies to System→Infrastructure (physical embedding) |
| Several `contributes_to` on the same Hazard Item as `direct` | Confusing combinatorics with redundancy | With `combinationType: ALL`, several `direct` contributions are correct (A AND B). `relevance` describes each asset's functional role in realizing the hazard; topological distance is modeled separately via `hazardDistance`. Assets do not inherit `relevance` automatically from their position in the graph |
| `implements` (bidirectional: A→B and B→A) | Circular architecture statement | `implements` is directed: the carrier implements the capability — not the other way round |
| Mirror pairs: `required_by` (Data → Function) + `reads` (Function → Data); `implements` (Process/System → Function) + `implemented_by` (Function → Process/System); `located_in` (Physical → Infrastructure) + `houses` (Infrastructure → Physical) — each on the same asset pair | The same fact from both directions: two edges in the graph, double counting in propagation | Model only one edge, preferably the first-named direction (`required_by`, `implements`, `located_in`). Use `reads` only if no dependency is meant explicitly. Writing types (`creates`, `modifies`, `deletes`) do not mirror `required_by` and may coexist. The tool points this out in the relationship dialog but does not block it (`A2A_MIRROR_PAIRS`) |

---

### 3.4 Analytical effect of the Core Rules

Core Rules are **analytically active** — they influence:

**STRIDE derivation:**
```
Trigger                                           → mandatory threat
─────────────────────────────────────────────────────────────
Data A derives_from Data B                        → Tampering on B implies Tampering on A
Process A triggers Process B[safety]              → DoS on A = safety-relevant threat
Process A contributes_to Hazard → endangers Human → Tampering + DoS as mandatory threats
Data affects_privacy Human                        → InfoDisc as mandatory threat
Function A depends_on Function B[safety]          → DoS on A = safety-relevant threat
Function A contributes_to Hazard → endangers Human → Tampering + DoS as mandatory threats
Data configures Function[safety]                  → Tampering on Data = safety-relevant threat
Physical enables Function[safety]                 → Tampering on Physical = CRITICAL
Physical endangers Human                          → Tampering + DoS on Physical = safety-relevant threat
Service provides Function[safety]                 → Spoofing on Service = safety-relevant threat
Service endangers Human[isSafetyCritical]         → DoS on Service = safety-relevant threat
Physical located_in Infrastructure                → Tampering on Infra = indirect threat on Physical
```

**Safety propagation (hazardDistance, not relevance):**
```
Process B ─contributes_to [direct] → Hazard Item
Process A ─triggers→ Process B
→ Process A gets NO automatic relevance derivation
→ hazardDistance = 1 (one edge away from the hazard-carrying asset)
→ relevance stays open — the analyst assigns it functionally (direct if A
  also immediately co-controls the physical action, otherwise indirect)

Data ─required_by→ Process B (contributes_to Hazard)
→ Data: hazardDistance = 1, relevance from the analyst (typically indirect — data
  controls no physical action)

Physical ─contributes_to [direct] → Hazard Item
→ Physical: hazardDistance = 0, relevance = direct
  (direct contribution to the hazard)
```

> **`relevance` is not derived across hops.** The position in the graph only produces
> a `hazardDistance` value. `relevance` remains the functional property
> (does the asset control the physical action?) and is assigned by the analyst —
> the tool can at most offer a *suggestion*, not an automatic decision.

**Criticality derivation:**
```
Follows the existing derived/manual pattern:
→ core rule derivations = source: "derived"
→ no additional documentation obligation
→ automatically marked as "systemically derived" in the audit report
```

---


### 3.5 Propagation limits (formal rules)

**Three separate dimensions — no mixing:**

| Dimension | Meaning | Assigned by |
|---|---|---|
| `relevance` | functional contribution to the hazard (does it control the physical action?) | analyst (tool suggests) |
| `hazardDistance` | topological distance to the hazard-carrying asset (0, 1, 2...) | automatically from the graph |
| `physicalHazardPotential` | damage potential of the asset/hazard itself | analyst / Hazard Item |

Example — the same assets, three independent dimensions:

| Asset | relevance | hazardDistance | physicalHazardPotential |
|---|---|---|---|
| Robot arm | direct | 0 | high |
| Motion controller | direct | 1 | low |
| PLC network | indirect | 2 | low |
| Sodium tank | indirect | 0 | high |
| Water pipe | indirect | 0 | low |

> Robot arm and motion controller are **both `direct`** — both immediately co-control
> the physical action. They only differ in `hazardDistance`.
> The sodium tank is `indirect` (controls nothing actively), but has `hazardDistance: 0`
> (it sits directly at the hazard) and `physicalHazardPotential: high`. These three dimensions
> explain exactly the cases that kept leading to category errors in flat
> `relevance` modeling.

Asset-to-asset relationships extend the safety analysis to a second semantic
level. Without a formal limit there is a risk of **transitive closure explosion**:
dense dependency graphs in safety-critical systems pull almost all
assets into the analysis — the CRITICAL inflation problem on a new level.

The following rules formally limit **automatic analysis propagation**
(not relevance — that remains functional and is assigned by the analyst):

---

**Rule 1: Primary causality carrier**

The DFD level (element→asset) takes precedence over the asset level (asset→asset).
On the asset→asset level, automatic analysis sets `hazardDistance ≥ 1` — `relevance`
stays open and is assigned functionally by the analyst:

```
Element→asset relationship with SafetyAnnotation:
  → may carry relevance: 'direct' (analyst decision on the DFD canvas)
  → hazardDistance: 0
  → Safety Override Rule applies with direct + fatal
  → primary source for safety criticality

contributes_to → Hazard Item:
  → hazardDistance: 0 (direct contribution to the hazard)
  → relevance functional (direct if the asset controls the physical action)

Asset→asset core rule (triggers, depends_on, required_by, ...):
  → sets hazardDistance automatically (hop count), source: "derived"
  → relevance stays open — NO automatic decision
  → analyst assigns relevance functionally; for 'direct' beyond hazardDistance 0:
      • source: "manual" required
      • rationale required ("Why does this asset co-control the physical action?")
```

> **No automatic `indirect` any more.** The hop logic used to set `relevance: indirect`
> automatically. That mixed topological distance with functional role. Now
> the position only produces `hazardDistance`; `relevance` is always a functional statement.

---

**Rule 2: hazardDistance calculation & analysis limit**

Automatic analysis propagation over asset→asset relationships stops after
**hazardDistance 1** (default). What is limited is the *automatic propagation*,
not relevance:

```
C  contributes_to  Hazard    → C: hazardDistance 0  (direct contribution)
B  depends_on      C         → B: hazardDistance 1  (captured automatically, derived)
A  depends_on      B         → A: hazardDistance 2  (NOT captured automatically)
                               → requires an explicit analyst decision
                               → source: "manual" + rationale required
```

`relevance` is not set automatically on any of these steps — it is always
functional and assigned by the analyst.

Combined distance across both levels:

```
DFD element → asset (element→asset)         → hazardDistance 0
Asset → asset (one edge)                    → hazardDistance 1 (derived)
Asset → asset (two edges)                   → hazardDistance 2+ (not automatic)
```

**Configuration in phase 0 (project profile):**

The analysis limit is configurable per project:

```
maxHazardDistance: 1  (default — recommended for most projects)
maxHazardDistance: 2  (optional — for OT plants with known long cascades)
```

With `maxHazardDistance: 2`, an additional safeguard against `direct` inflation applies:

```
IF hazardDistance === 2 AND relevance === 'direct'
THEN validation error (blocking):
     "direct relevance at hazardDistance 2 requires a rationale.
      Explain why this asset immediately co-controls the physical action
      although it is two edges away from the hazard-carrying asset."
```

> **Why this brake?** An asset two edges away can well be functionally
> `direct` (e.g. a PLC that controls a valve that controls a valve). But
> that is rare and should be justified. The rationale requirement ensures
> that every such annotation is a deliberate, documented decision.

---

**Rule 3: No automatic escalation from indirect to CRITICAL**

`indirect` safety-relevant assets must not escalate to CRITICAL automatically —
regardless of whether the connection arose on the DFD level or the asset level:

```
fatal + relevance: 'direct'    → CRITICAL  (Safety Override applies)
fatal + relevance: 'indirect'  → HIGH+     (no automatic override)

HIGH+ can become CRITICAL through high likelihood in the risk table —
but not through further automatic propagation.
```

This rule is consistent with the corrected Safety Override Rule
(see taraflow-cnc-referenzfall.md, section 4.0, and `taraflow-safety-model.md`).

---

**Rule 4: Prevent double propagation**

If an asset already has a SafetyAnnotation from the DFD level,
the asset level must not override or strengthen it:

```
Asset X already has:
  Element→asset: relevance: 'direct', impact: 'fatal'  (from the DFD canvas)

Asset→asset core rule on X:
  → ignored for safety propagation (already the highest level)
  → stays effective as documentation (STRIDE derivation)

Asset→asset domain extension (analytical) on X:
  → validation warning:
    "Asset X already has a direct SafetyAnnotation from the DFD level.
     The asset→asset safety annotation is redundant."
```

---

**Rule 5: Override hierarchy and MINIMUM principle**

Several override rules can act on the same asset. The order is fixed:

```
1. Safety override  (fatal / irreversible_major + relevance: 'direct') → CRITICAL
2. HVA critical                                                             → CRITICAL minimum
3. HVA high                                                                 → HIGH minimum
4. HVA medium                                                               → HIGH minimum
5. Operational critical                                                     → HIGH minimum
6. HVA low                                                                  → no override
```

**MINIMUM principle:** Every override sets a minimum level — it does not override
higher ratings from other sources. The safety override always takes precedence.

```
Example: asset with isHighValueAsset: 'high' + fatal + relevance: 'direct'
→ Safety override applies → CRITICAL
→ HVA high (HIGH minimum) is already met — no conflict

Example: asset with isHighValueAsset: 'high' + fatal + relevance: 'indirect'
→ Safety override does NOT apply (indirect)
→ HVA high → HIGH minimum
→ fatal + indirect → HIGH+ (possibly CRITICAL via the risk table)
```

---

**Summary of the propagation limits:**

| Level | relevance (functional) | `direct` possible? | Override | Max. hazardDistance |
|---|---|---|---|---|
| Element→asset (DFD) | analyst decision | ✅ on the canvas | ✅ with direct + fatal | 0 |
| contributes_to → Hazard | analyst (direct if the physical action is controlled) | ✅ | ✅ via Hazard Item | 0 |
| Asset→asset core rule | analyst (tool suggests) | ✅ manual + rationale required beyond distance 0 | ✅ only with direct + fatal | 1 |
| Asset→asset domain (documentary) | – | ❌ | ❌ | – |
| Asset→asset domain (analytical) | analyst | ✅ manual + rationale required | ✅ only with direct + rationale | 0 (once) |

> `relevance` is not set automatically on any level — the column describes
> who assigns it. `hazardDistance` is computed automatically from the graph.

---

## 4. Tier 2: Domain Extensions

### 4.1 Concept

Domain Extensions are **domain-specific relationships** that the analyst defines
or activates from a predefined domain catalog.

**Default behavior: documentary**
```
Domain relationship "administered_to":
→ appears in documentation and the asset inventory
→ does NOT influence the STRIDE analysis
→ does NOT influence safety propagation
→ no influence on criticality
```

**Optional: analytically active**
```
Domain relationship "administered_to" (analytically activated):
→ analyst marks the relationship as "analytically active"
→ mandatory rationale: e.g. "implies affects_safety on Human Asset"
→ mandatory STRIDE mapping: which categories are derived?
→ source: "manual" → documented verbatim in the audit report
```

### 4.2 Predefined domain catalogs

> **Note on the column "Analytically active as":** `safety` means that the
> domain verb is mapped onto the Hazard Item pattern
> (`contributes_to → Hazard → endangers`). For a single cause, a safety
> annotation can be used instead (no collapsed hazard node). `privacy` maps to `affects_privacy`.

**Medical (IEC 81001-5-1, ISO 14971):**

| Relationship | From → To | Default | Analytically active as |
|---|---|---|---|
| `administered_to` | Process → Human | documentary | safety (hazard path) |
| `treats` | Process → Human | documentary | safety (hazard path) |
| `diagnoses` | Data → Human | documentary | affects_privacy |
| `prescribes_for` | Data → Human | documentary | affects_privacy |
| `contraindicated_with` | Data → Data | documentary | required_by |

**Automotive (ISO 21434):**

| Relationship | From → To | Default | Analytically active as |
|---|---|---|---|
| `transports` | System → Human | documentary | safety (hazard path) |
| `controls_vehicle` | Process → System | documentary | runs_on |

**OT / Industrial (IEC 62443):**

| Relationship | From → To | Default | Analytically active as |
|---|---|---|---|
| `operates_near` | Process → Human | documentary | safety (hazard path) |
| `exposes_to_hazard` | Infrastructure → Human | documentary | safety (hazard path) |
| `physically_contains` | Infrastructure → Human | documentary | – |
| `controls_actuator` | Process → System | documentary | runs_on |

**Generic IT:**

| Relationship | From → To | Default | Analytically active as |
|---|---|---|---|
| `authenticates` | System → Human | documentary | authorized_for |
| `audits` | Process → Data | documentary | responsible_for |
| `encrypts` | System → Data | documentary | – |
| `backs_up` | Process → Data | documentary | required_by |

---

### 4.3 User-defined relationships

The analyst can define their own relationship types:

```
User-defined relationship:
├── name:           e.g. "calibrates"
├── from:           asset category (e.g. Process)
├── to:             asset category (e.g. System)
├── semantics:      free-text description
├── analytical:     true / false
├── if analytical:
│   ├── stride_mapping:   [ "Tampering", "Repudiation" ]
│   ├── safety_relevance: "direct" | "indirect" | "none"
│   └── rationale:        mandatory (free text)
└── domain:         e.g. "Medical", "Custom"
```

**Validation rule:**
```
IF analytical === true AND rationale === ""
THEN validation warning:
     "A rationale is mandatory for an analytically active domain relationship
      (IEC 62443-4-1 traceability)"
```

---

## 5. UI integration in the DFD tab

Asset-to-asset relationships are managed in the **Asset Description side panel** —
analogous to the Element Description panel with two tabs (General / Asset Relations):

```
Side panel (overlay, vertical split):
┌─────────────────────────────────────┐
│  Asset List                         │
│  📄 Manufacturing recipes            │
│  ⚙️  Machining process               │
│  [+] New asset                      │
├─────────────────────────────────────┤
│  Asset Properties                   │
│  ┌─────────────┬───────────────────┐│
│  │   General   │  Asset Relations  ││
│  └─────────────┴───────────────────┘│
│                                     │
│  Asset Relations tab:               │
│  ┌─────────────────────────────┐    │
│  │ Element relationships       │    │
│  │ (read-only, from canvas)    │    │
│  │ □ CNC controller reads      │    │
│  │ 🗄 NC file system stores     │    │
│  ├─────────────────────────────┤    │
│  │ Asset relationships         │    │
│  │ Core Rules + Domain Ext.    │    │
│  │ [+] Add relationship        │    │
│  │                             │    │
│  │ derives_from →              │    │
│  │   📄 Raw data                │    │
│  │   [SafetyAnnotation]        │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Add relationship — workflow:**
```
1. [+] Add relationship
2. Choose the relationship type
   → Core Rules (always available)
   → Domain Extensions (if activated in phase 0)
   → User-defined
3. Choose the target asset (from the asset list)
4. Optional: set a SafetyAnnotation
5. If the domain extension is analytical:
   → enter a rationale (mandatory)
```

---

## 6. Effect on the overall analysis

### 6.1 Overview

| | Core Rules | Domain (documentary) | Domain (analytical) |
|---|---|---|---|
| STRIDE derivation | ✅ automatic | ❌ | ✅ defined manually |
| Safety propagation | ✅ hazardDistance calculation | ❌ | ✅ according to safety_relevance |
| Criticality | ✅ derived | ❌ | ✅ manual + rationale |
| Documentation | ✅ automatic | ✅ asset inventory | ✅ rationale verbatim |

### 6.2 Traceability chain

```
Mitigation
  → Risk
  → Threat (STRIDE category)
  → Asset-to-asset relationship (core rule or domain extension)
  → Asset
  → DFD element
```

Fully traceable — even when the threat was derived via an
asset-to-asset relationship.

---

## 7. Distinction from element-to-asset relationships

| Property | Element-to-asset | Asset-to-asset |
|---|---|---|
| Where modeled | DFD canvas | Asset Properties side panel |
| Direction | DFD element → asset | Asset → asset |
| Visualization | Canvas edge | Side panel list |
| Analytically active | always | Core: always / Domain: optional |
| SafetyAnnotation | ✅ | ✅ |
| Derived/manual pattern | ✅ | ✅ |

---

## 8. Examples

### 8.1 CNC system (OT domain)

```
Process Asset "Machining process"
└─ depends_on (Core) → Process Asset "Emergency stop process"
   → mandatory threat: DoS on emergency stop = DoS on machining process
   → hazardDistance 1; relevance: indirect (the machining process does not itself
     control the safety shutdown)

Data Asset "Manufacturing recipes"
└─ required_by (Core) → Process Asset "Machining process"
   → mandatory threat: Tampering on recipes = Tampering on machining process
   → hazardDistance 1; relevance: indirect (data controls no physical action)
```

### 8.2 Medical device (medical domain)

```
Process Asset "Bolus delivery sequence"
└─ administered_to (Domain, analytical) → Human Asset "Patient"
   Rationale: "Direct administration — hazard path: contributes_to → Hazard → endangers Patient"
   stride_mapping: [ "Tampering", "DoS" ]
   safety_relevance: "direct"
   → mandatory threat: Tampering on bolus sequence = CRITICAL (Safety Override)

Data Asset "Medication limits"
└─ required_by (Core) → Process Asset "Medication validation flow"
   → Tampering on limits = Tampering on validation flow
   → hazardDistance 1; relevance: indirect (limit data does not itself control delivery)
```

### 8.3 OT plant with Function Assets (integrator perspective)
```
Function Asset "Brake Control Function"  [FU-001]
└─ implemented_by (Core) → System Asset "Safety Controller"
   → Tampering on Safety Controller = Tampering on Brake Control Function
   → Safety Override Rule applies: fatal → CRITICAL

Data Asset "Safety Parameters"
└─ configures (Core) → Function Asset "Brake Control Function"  [FU-001]
   → Tampering on Safety Parameters = mandatory threat
   → hazardDistance 1; relevance: indirect (parameters only configure)

Physical Asset "Hydraulic Brake Actuator"
└─ contributes_to (Core) → Hazard Item "uncontrolled braking"
   → Tampering on actuator = direct contribution to the hazard
   → hazardDistance 0; relevance: direct → Safety Override Rule applies: fatal → CRITICAL

Service Asset "Remote Monitoring Service"
└─ monitors (Core) → System Asset "Safety Controller"
   → compromise of the remote service = indirect path to the safety function
   → hazardDistance 1; relevance: indirect (monitoring controls nothing)
```

---

### 8.4 Derived attack path via asset relationships

This example shows how the attack path arises implicitly from the asset-to-asset relationships
— without an explicit "attack path" having to be modeled.

```
Data Asset "Safety Parameters"
└─ configures → Function Asset "Brake Control Function"
   └─ implemented_by → System Asset "Safety Controller"
      └─ contributes_to → Hazard Item "uncontrolled braking"
         └─ endangers → Human Asset "Operator"
```

**Derived threat chain:**

```
1. Entry point: Tampering on Data Asset "Safety Parameters"
   (e.g. via a DFD element that has modifies → Safety Parameters)

2. configures → Function "Brake Control Function"
   → Tampering on parameters = Tampering on function
   → hazardDistance 1; relevance: indirect (parameters only configure)

3. implemented_by → System "Safety Controller"
   → the system carries the compromised function
   → hazardDistance 1; relevance: indirect

4. contributes_to → Hazard Item "uncontrolled braking"
   → Safety Controller controls the physical action → hazardDistance 0, relevance: direct

5. endangers → Human "Operator"
   → end point: safety impact on the protected person, impact: fatal

Result:
→ Tampering on "Safety Parameters" becomes CRITICAL
   (Safety Override Rule applies: fatal on the Hazard Item)
→ mandatory threats: Tampering, DoS on Safety Parameters
```

> This path arises without explicitly modeling an "attack path" —
> it follows automatically from the combination of asset relationships,
> STRIDE derivation and safety propagation.

---

<sub>© Jürgen Messerer · 2026 · All rights reserved</sub>
