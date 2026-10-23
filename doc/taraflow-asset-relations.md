# Asset Relationships in TARAflow

> German version: [taraflow-asset-beziehungen.md](taraflow-asset-beziehungen.md) — keep both in sync.

## Concept

The relationships between DFD elements and assets follow the **"active-impact model"** for precise threat analysis (TARA):

```txt
DFD element → acts on → asset
```

### Two perspectives for a complete threat analysis

1. **Attack vector** (`uses` with qualifiers): *How* can an attacker compromise the system?
2. **Damage potential** (`depends_on`): *Which* cascading effects arise on failure?

| Relationship | Focus         | TARA relevance |
|--------------|---------------|---------------|
| `uses`       | Interaction   | Where is the attack vector? (likelihood) |
| `depends_on` | Availability  | How severe is the damage on failure? (impact) |

## is_an — special relationship

The `is_an` relationship is an **exclusive, definitional relationship**:

- A DFD element is either an instance of the asset (`is_an`)
- **OR** it has impact relationships to the same asset
- **Never both at the same time to the same asset** — relationships to other assets remain allowed without restriction
- **Formally:** `is_an(A, X)` ⇒ no further relationships between A and X allowed
- **Not transitively inherited:** `is_an(A, X)` does not pass relationships of X on to A
- **Mathematical meaning**: `is_an` creates a logically unambiguous bridge for transitive derivations (see section "Transitivity")

**Example:**

- External Entity "Administrator" → `is_an` → Human Asset "System Admin Role"  
  *(cannot have further relationships to this asset)*
- Process "User Management" → `creates` → Data Asset "Admin Audit Logs"  
  *(is not is_an; e.g. by logging admin actions)*
- Data Asset "Admin Audit Logs" → affects_privacy → Human Asset "System Admin Role"

---

## Asset categories & abstraction hierarchy

### Vertical hierarchy

The four vertical asset categories form a **static abstraction hierarchy** —
the higher, the fewer implementation details are known or needed.

```txt
Infrastructure    ← highest level, lowest precision (environment / arena)
  ↓ houses
System            ← black-box component (what does the function provide?)
  ↓ realizes
Function          ← capability (what must the system be able to do?)
  ↓ relies on
Data              ← lowest level, highest precision (atomic values)
```

The entry point into the hierarchy determines the analyst's perspective:

| Perspective         | Typical level   | Example                           |
|---------------------|-----------------|-----------------------------------|
| Product developer   | Function / Data | "Brake Control Function", "Safety Parameters" |
| Integrator          | System          | "Safety Controller" as a black box |
| Operator / CISO     | Infrastructure  | OT network segment                |

The same method — only the scope shifts.

### Orthogonal categories

These categories are not part of the vertical hierarchy
but **cut across all levels** — they describe the dynamic context
of the system under analysis:

| Category       | Character | Examples                                              |
|----------------|-----------|--------------------------------------------------------|
| **Process**    | Orchestrator — temporal sequence of steps, know-how asset | Manufacturing recipe, GMP production instruction, treatment protocol |
| **Physical**   | Passive material asset without an embedded system | Valuables, museum painting, prototype, physical key |
| **Service**    | External/internal service outside the own system boundary | Cloud service, OTA update server, external maintenance service |
| **Human**      | Protection subject and actor | Operator, patient, administrator |

### Function vs. Process

These two types (orthogonal and vertical respectively) are often confused:

| Criterion           | Function                              | Process                                |
|---------------------|---------------------------------------|----------------------------------------|
| Character           | Capability                            | Temporal sequence / know-how           |
| Question            | *What must the system be able to do?* | *How is a result produced step by step?* |
| Value of the asset  | The behavior itself                   | The order of the steps                 |
| Changeability       | Stable (standard requirement)         | Changeable (recipe, procedure, protocol)|
| Implementation      | Unknown / black box                   | Describable concretely as a sequence   |
| Threat focus        | Failure / manipulation of the capability | IP theft, sequence manipulation     |
| Hierarchy           | Vertical (capability level)           | Orthogonal (orchestrator)              |

**Decision tree (three test questions):**

```txt
1. Do you know the temporal order of the steps?
   No → Function

2. Is the asset's value in the order at runtime?
   (= would a sequencing attack or race condition be a relevant threat?)
   No → Function

3. Is the flow instantiated at runtime?
   (= is there a concrete "running instance" that can be started/stopped?)
   No → Function
   Yes → Process
```

> **Edge case:** Even simple, linear flows without a security-relevant sequence
> are Process Assets if they exist as a runtime instance (e.g. cron jobs, batch processes).
> Question 3 decides — instantiability at runtime.

**Typical use cases:**

| Situation | Correct category |
|---|---|
| Safety requirement from ISO 26262 / MDR / ISO 12100 | **Function** |
| NC program as a file on the server | **Data** |
| GMP production instruction as a document | **Data** |
| Treatment protocol as a document | **Data** |
| Active CNC milling operation at runtime | **Process** |
| Running therapy execution of the infusion pump | **Process** |
| Braking function as a black box | **Function** |
| Single software flow (source code known) | Model as a Process element in the DFD |

### Example: CNC manufacturing across all perspectives

```txt
Product developer:
  Function Asset "Machining capability"          ← what the CNC must be able to do
    └─ implemented_by → System Asset "CNC controller"

  Process Asset "Turbine blade milling recipe"   ← the know-how / the sequence
    └─ [Step 1] invokes → Function Asset "Roughing"
    └─ [Step 2] invokes → Function Asset "Finishing"
    └─ [Step 3] invokes → Function Asset "Quality inspection"
    └─ runs_on → System Asset "CNC controller"

Integrator:
  System "CNC controller" [black box]
    └─ implements → Function Asset "Machining capability"

Operator:
  Infrastructure "OT network segment manufacturing"
    └─ hosts → System Asset "CNC controller"
```

---

## Safety Annotation Layer

> **Reference:** Why, how and where the safety model is implemented (scale,
> worst-of, override rule, migration, code locations): `taraflow-safety-model.md`.
> This section describes how it is embedded in the asset graph.

### Concept

TARAflow integrates safety aspects through an **optional annotation layer** that introduces no new modeling logic but enriches existing relationships with safety context.

### Two modeling paths: annotation and Hazard Item

Safety can be modeled in TARAflow in two ways. Both are valid and
coexist in the same project:

| | Safety annotation | Hazard Item |
|---|---|---|
| Location | `safety` on an element→asset relation | own node with `contributes_to` / `endangers` |
| Causes | **one** relation = **one** single cause | any number of causes, combined explicitly |
| Combination | **ANY** only (implicit: maximum over all relations) | `combinationType`: **ANY** or **ALL** |
| Protection target | implicit (the asset of the relation) | explicit (`endangers` → Human/Environment/Infrastructure) |
| Use | quick start, simple single causes without a hazard register | combinatorics, several protection targets, import from FMEA/hazard register |

**Annotation = single cause with ANY semantics.** Every annotated relation acts
as if it triggered the harm on its own. Several annotations on one asset are
aggregated via the maximum. An **ALL** hazard (only A *and* B together trigger it)
**cannot be expressed** with annotations — if it is modeled with two
annotations anyway, the model overestimates each single cause (conservative, but imprecise).
Combinatorial hazards need a Hazard Item.

**Rating an asset** (`resolveAssetPhysicalImpact`):

1. `manual` — the analyst's override with rationale always wins.
2. Otherwise **worst-of** `hazard` (worst severity of the Hazard Item chain,
   cause side) and `annotation` (worst safety annotation). On a tie,
   `hazard` applies (richer audit trail); if either source is `direct`, the
   impact counts as direct.

**Double modeling raises a warning.** If an asset has a safety annotation *and*
takes part in a Hazard Item (as cause or protection target), asset validation
reports a warning ("use only one of the two"). Until it is resolved,
the worse rating applies — ignoring the warning never leads to an
under-rating. The asset table tooltip shows the origin (`hazard` / `annotation`).

> **No collapsed hazard node.** A direct element→human edge (`endangers`)
> with an annotation does **not** create an internal Hazard Item. Annotation and Hazard Item are
> two separate data sources, combined by the rating rule above.

#### Planned follow-up: strict separation per asset

A stricter variant makes double rating impossible instead of only handling it:

- As soon as an asset `contributes_to` a Hazard Item, the
  safety annotations of its relations are shown **read-only**.
- An action **"Convert to Hazard Item"** creates a Hazard Item from the annotations
  (one `contributes_to` per annotated relation, `relevance` taken over,
  `combinationType: ANY`) and removes the annotations.
- The analyst has to choose the protection target of the `endangers` edge — the annotation
  does not know it. It is **not** created automatically.

This variant is deliberately not implemented (UI effort); it is the direction to take if
coexistence in projects causes confusion.

**Principle:**

- ✅ **Optional** - only needed for safety-relevant systems
- ✅ **Qualitative** - no complex calculations, explanatory ratings
- ✅ **Non-invasive** - does not change the core security analysis
- ✅ **Norm-compliant** - enables EN 50742 / ISO 12100 compliance

### The safety annotation pattern

```typescript
type FunctionAssetId = string & { readonly __brand: 'FunctionAssetId' };

safety: {
  relevance: "none" | "indirect" | "direct";
  impact?: "none" | SafetySeverity;   // canonical 5-level scale, see below
  /**
   * Physical hazard potential — qualitative hazard rating
   * for the affected person/plant.
   * Set by the analyst on the respective asset relation
   * (e.g. is_an → CNC machine, affects_safety → machine operator).
   * Fixed 3 levels following the ISO 12100 / EN 50742 principle.
   */
  physicalHazardPotential?: "low" | "medium" | "high";
  protectionTarget?: boolean;   // specifically for Human Assets (persons)
  rationale?: string;
}
```

### Severity of harm to persons (canonical scale)

Annotation, `endangers` edge (human target), `physicalImpact` on the asset and the
safety rating in the asset dialog use **one** scale (`SafetySeverity`):

| Level | Meaning | IEC 62061 Se | ISO 26262 S | EN 50742 |
|---|---|---|---|---|
| `reversible_minor` | reversible, first aid | Se1 | S1 | reversible |
| `reversible_major` | reversible, medical treatment | Se2 | S1 | reversible |
| `irreversible_minor` | irreversible, minor (e.g. finger) | Se3 | S2 | non_reversible |
| `irreversible_major` | irreversible, major (e.g. arm, eye) | Se4 | S2 | non_reversible |
| `fatal` | fatal | Se4 | S3 | fatal |

`fatal` stays separate from `irreversible_major` so that mode-specific scales
(ISO 26262 S3) can be mapped without loss. The numeric safety factor (1–4)
is the Se column; the categorical level is the source of truth.

**Migration (schema v9):** old values are mapped conservatively to the upper sub-level
— `reversible_injury` → `reversible_major`, `irreversible_injury` →
`irreversible_major`, `fatality` → `fatal`.

**This pattern is uniform** across all DFD elements and asset relationships:

- External Entities
- Processes
- Data Stores
- Data Flows
- Interfaces
- Chip Boundaries
- Asset relationships

### Hazard Item — the explicit hazard node

A **Hazard Item** is its own node type on an orthogonal level
(next to Physical, Process, Service, Human, Environment). It is **not an asset** —
an asset is something worth protecting, a Hazard Item is the hazard itself.
The Hazard Item is the **convergence point** where one or more
hazard-causing assets meet and from which one or more
protection targets are endangered.

```txt
Asset ─contributes_to [relevance]─► Hazard Item ─endangers [impact]─► protection target
```

**Two edge types, cleanly separated:**

| Edge | From → To | Carries | Meaning |
|---|---|---|---|
| `contributes_to` | Asset → Hazard Item | `relevance` (direct/indirect) | Does this asset control/enable the physical action that makes up the hazard? |
| `endangers` | Hazard Item → protection target | `impact` | What harm threatens the protection target? |

**The Hazard Item carries** the ISO 12100 information and the hazard potential:

```typescript
type HazardItem = {
  id: string;
  label: string;                  // e.g. "exothermic reaction", "collision/crushing"
  hazardType?: string;            // ISO 12100 hazard type (mechanical, thermal, chemical, ...)
  physicalHazardPotential?: "low" | "medium" | "high";  // 3 levels per ISO 12100
  combinationType: "ANY" | "ALL"; // how several contributes_to inputs interact
  externalRef?: string;           // link to the external safety analysis (e.g. "HAZ-007")
  rationale?: string;
};
```

**`combinationType`** decides the logic of several inputs:
- `ANY` (default): each cause alone triggers the hazard (OR gate).
  Example: overpressure *or* overheating → tank explosion.
- `ALL`: only all contributions together trigger it (AND gate, combinatorics).
  Example: sodium *and* water → exothermic reaction.

> Several `contributes_to` inputs do **not** automatically imply combinatorics.
> Whether they are independent causes (ANY) or a joint condition (ALL)
> is set explicitly via `combinationType`. In FTA terms:
> ANY = OR gate, ALL = AND gate.

**Protection target derivation:** The impact dimension of the `endangers` edge is derived from the
target type — no explicit edge type per dimension is needed:

| Target node | Derived dimension | Impact scale / standard |
|---|---|---|
| Human | Safety | canonical scale `reversible_minor` … `fatal` (see above) |
| Environment | Environmental | minor · moderate · severe (Seveso / environmental liability) |
| Infrastructure | Asset destruction | minor · major · critical |

```typescript
type HazardImpact =
  | { target: "human";          severity: SafetySeverity }
  | { target: "environment";    severity: "minor" | "moderate" | "severe" }
  | { target: "infrastructure"; severity: "minor" | "major" | "critical" };
```

**Transducers as a deliberate exception — direct effect on protection target categories.**
In principle, protection targets (Human, Environment, Infrastructure) are reached via the
Hazard Item chain: `Asset ─contributes_to─► Hazard Item ─endangers─► protection target`.
Sensors and actuators are cyber-physical effect elements and carry **additionally**
a direct element→asset relation to the affected category:

- **Sensor** — `monitors` Environment, `affects_privacy`/`identifies`/`tracks` Human
  (pure observation, *no* hazard).
- **Actuator** — `endangers` Human, `endangers`/`contaminates` Environment,
  `damages` Physical/Infrastructure (the effect *is* the hazard).

This direct relation (with a safety annotation) is the **fast path** for the
single-cause case. For multi-stage or combinatorial hazards (several
`contributes_to` inputs, ANY/ALL), a Hazard Item is modeled as the convergence point.
Both representations coexist as **separate data sources** — see
"Two modeling paths". Accordingly, `getAllowedRelations` now returns the
transducer relations for `environment` (instead of `[]`);
for all other element types, Environment remains a protection target only.

#### Combinatorics on the Hazard Item

```txt
Sodium dosing valve  ─┐
                       ├─contributes_to─► Hazard "exothermic reaction" ─endangers─► Operator
Water inlet valve    ─┘
```

With `combinationType: 'ALL'` an **AND** results — the contributions converge as a
joint condition on the same hazard node. With `combinationType: 'ANY'`
they are independent causes (OR). No explicit Boolean operator on the edges,
no fault-tree algebra — the logic sits as one field on the Hazard Item.
(For auditors familiar with FTA: ALL corresponds to an AND gate, ANY to an OR gate.)

**Rules:**
- `relevance` lives on `contributes_to`, `impact` on `endangers`
- `physicalHazardPotential` + ISO 12100 fields live on the Hazard Item
- For the single-cause case without a Hazard Item, the safety annotation is enough
  (see "Two modeling paths")

#### Example: combinatorial hazard (sodium/water)

Neither the sodium dosing valve nor the water inlet valve alone causes
the disaster. Only the **joint override** of both valves brings
sodium and water together — the exothermic reaction occurs.

```txt
Physical "Sodium dosing valve" ─contributes_to [direct]─┐
                                                          │
                                  Hazard "sodium-water reaction"
                                    hazardType: chemical/thermal
                                    physicalHazardPotential: high
                                    combinationType: ALL
                                                          │
Physical "Water inlet valve"   ─contributes_to [direct]─┘
                                                          │
                          ┌───────────────────────────────┼───────────────────────────┐
                          ▼                                ▼                           ▼
              endangers [fatal]              endangers [severe]          endangers [critical]
                          │                                │                           │
                    Human "Operator"          Environment "Water body"   Infrastructure "Production plant"
```

The valves carry `relevance: direct` — they immediately control the physical
action (flow rate). The tanks themselves are passive containers and not the
`contributes_to` carrier; their hazard potential is represented by the Hazard Item
(`physicalHazardPotential: high`).

> **Link to Function Assets:**
> The relationship between a DFD element and the affected safety functions
> is not modeled as a property field but via asset-to-asset relationships
> (e.g. `implements`, `depends_on`, `required_by`).
> Traceability to the external safety analysis (ISO 12100 SF IDs) is provided
> via `externalRefs` on the Function Asset itself.

**Where do these Function Assets come from?**
The analyst derives them from the accompanying safety analysis:

1. ISO 12100 / FMEA identifies safety functions (e.g. "Emergency Stop", "Brake Control")
2. The analyst creates a Function Asset in TARAflow for each safety function
3. An optional `externalRef` field on the Function Asset links it to the external ID (e.g. `"SF-001"`)
4. `affectedSafetyFunctions` everywhere in the model references the TARAflow-internal UUIDs of these assets

The model is therefore self-contained — external safety analysis and TARAflow model
are traceably linked via `externalRef` but do not depend on each other.
External `SF-001` IDs appear **only** in `externalRef`, never directly in `affectedSafetyFunctions`.

### Methodical chain: Threat → Impact → Injury

TARAflow models safety consequences along the following chain:

```txt
Threat → Impact → [Hazardous Situation] → Injury / Harm
```

**Explanation of the brackets:**  
The *hazardous situation* sits conceptually between `impact` and `injury`.
It is modeled as a **Hazard Item** (see section "Hazard Item").
In the simplest case (one cause, one protection target) the safety annotation is enough;
the hazardous situation then stays implicit (worst-case assumption, see below).

#### Worst-case assumption

TARAflow works conservatively: as soon as a threat produces an impact on a
safety-relevant asset, the resulting hazardous situation is taken
as **given**. The question "Is the operator in the danger zone right now?"
is not rated separately — in the worst case they are.

> *"If a safety-relevant asset is compromised, TARAflow assumes the worst-case
> hazardous situation has materialized."*

This assumption is deliberately conservative and follows the principle of
erring on the safe side (ISO 12100, section 5.6).

#### Distinction from the formal safety analysis

The probabilistic rating of the exposure probability
(How often is a person in the danger zone?) belongs to the scope
of the formal safety analysis:

| Question                           | Responsibility       |
|------------------------------------|----------------------|
| Which cyber threat triggers it?    | TARAflow (TARA)      |
| What impact does it have on assets?| TARAflow (TARA)      |
| Is anyone in the danger zone?      | Safety analysis (ISO 12100 / FMEA) |
| What is the PL / SIL?              | Safety analysis (ISO 13849 / IEC 62061) |

#### Answer for auditors

When auditors ask: *"Where is the hazardous situation documented?"*

**Answer:** TARAflow models the cyber trigger (`Threat → Impact`).
The hazardous situation is conservatively implied by the worst-case
assumption. The formal rating of exposure takes place in the
accompanying safety analysis, which TARAflow references via
`affectedSafetyFunctions`.

### Formal definition: relevance

The `relevance` property of the SafetyAnnotation is defined functionally,
not architecturally:

**relevance: `direct`**\
The asset immediately controls one of the following safety functions:
  - energy output / physical motion / flow rate
  - medication dosing / therapy execution
  - safety interlock / emergency stop function
  - validation decision in the safety loop
  → compromise of this asset = immediate control over the harm

> **Semantic clarification:** `direct` in the safety annotation (`relevance: 'direct'`)
> means **causal immediacy** — not physical contact.
> Separate from this is `direct` as a qualifier on `Human → Physical: accesses [direct]`,
> which describes **physical contact** with an object.
> Both uses deliberately share the word but live in different dimensions —
> in the future they will be separated as `relevance: direct` vs. `contact: direct`.

**relevance: `indirect`**\
The asset does not immediately control the hazardous physical action.
`indirect` has **two causes** that are functionally different:

*1. Systemic influence* — the asset only affects:
  - availability of systems or networks
  - configuration or parameterization
  - infrastructure or transmission paths
  - access or authentication
  → compromise = systemic influence, no direct lever
  (e.g. network switch, engineering workstation, Active Directory)

*2. Hazard carrier without a control function* — the asset contains the hazard
  (substance, energy) but does not actively control it:
  - passive container (chlorine tank, sodium tank, pressure vessel)
  - energy storage (battery system)
  → compromise alone controls nothing — the hazard lies in the asset,
  it is triggered via a controlling asset (valve, controller)

> **Distinction via `physicalHazardPotential`:** Both classes are formally
> `indirect` but analytically different. A network switch is
> `indirect` + `physicalHazardPotential: low`; a sodium tank is
> `indirect` + `physicalHazardPotential: high`. Only this second dimension
> makes the difference visible in the model.

> **`relevance` is functional, not topological.** The position in a chain
> does not change `relevance`. Several links can be `direct` at the same time if
> each immediately co-controls the physical action:
> ```
> Valve            relevance: direct    (controls flow rate immediately)
> PLC              relevance: direct    (controls the valve immediately)
> Engineering Stn. relevance: indirect  (only configures)
> ```
> The *topological* distance to the hazard is carried separately via `hazardDistance` on the
> `contributes_to` edge (1, 2, 3...). The hop limit (see the asset-to-asset
> document, rule 2) lives on `hazardDistance` — not on `relevance`. This way
> `relevance` is never silently reinterpreted topologically.

**Test question:**\
"If exactly this asset is compromised — does it immediately control the physical action that causes the harm?"\
**Yes**  → relevance: 'direct'\
**No** → relevance: 'indirect'

>**Important for auditors:**\
  An asset can theoretically lead to **fatal** harm and still be `indirect`.
  The reason: it does not control the hazard immediately but only influences
  it systemically. This distinction is functional, not topological.

### Why no separate safety model?

**Avoids:**

- ❌ double maintenance (security + safety separate)
- ❌ inconsistencies between models
- ❌ hard-coded standards (e.g. built-in SRSL values)
- ❌ maintenance hell when standards change

**Instead:**

- ✅ safety as a property of the security analysis
- ✅ one graph, two perspectives (security & safety)
- ✅ automatic documentation generation

### Application

**Without safety annotation:**

```txt
Process "User Login"
└─ reads → Data Asset "User Credentials"
   → standard STRIDE analysis
```

**With safety annotation:**

```txt
Process "Emergency Stop Logic" 
└─ Properties: { safetyRelevant: true }
└─ modifies → Data Asset "Stop Configuration"
   └─ safety: {
        relevance: 'direct',
        impact: 'fatal',
        rationale: 'Manipulation disables emergency stop function'
      }
   → highest priority in the threat analysis
   → automatic safety documentation
```

### Documentation generation

Sentences in standards language are generated automatically from the safety annotation layer:

**External Entity (Operator):**
> *"The operator is considered a protection target. Compromise of associated system elements may result in severe safety hazards."*

**Data Store (Safety Parameters):**
> *"This data store contains safety-relevant configuration data. Unauthorized modification could lead to loss of risk reduction measures."*

**Data Flow:**
> *"This communication path is safety-relevant as it supports the execution of safety functions."*

**Interface (USB/Ethernet):**
> *"This interface is safety-relevant due to its potential use for manipulation of safety-critical components."*

### Integration with the threat analysis

Safety-annotated relationships influence threat prioritization:
```
Threat scoring without safety:
Risk = Likelihood × Impact

Threat scoring with safety (Safety Override Rule, deriveAggregatedImpact):
impact                     direct      indirect
irreversible_major | fatal  CRITICAL    HIGH+      ← override
irreversible_minor          HIGH+       HIGH
reversible_minor | _major   HIGH        MED+
```

`relevance: 'direct'` alone does **not** trigger the override — it also needs
severe irreversible or fatal harm. Conversely, `fatal` with `indirect`
only triggers HIGH+.

### What the safety annotation is NOT

- ❌ no replacement for a formal safety analysis (FMEA, FTA)
- ❌ no SRSL calculation
- ❌ no ISO 13849 performance level determination
- ❌ no automatic safety certification

**Instead:**
- ✅ documentation of safety relevance in the cyber context
- ✅ bridge between cybersecurity and functional safety
- ✅ compliance evidence for EN 50742
- ✅ traceable prioritization of security measures

### Workflow in the tool

1. **Modeling** - create the DFD and assets as usual
2. **Safety identification** - mark safety-relevant elements (optional)
3. **Annotation** - fill in safety properties only where useful
4. **Analysis** - the system takes safety into account automatically in threat prioritization
5. **Documentation** - automatic generation of safety chapters for audits

**No extra effort day to day. Maximum effect in the review.**

---

## Data Assets

Describes impacts on data and information.

### Relationships
```
creates      - DFD element creates the data asset
reads        - DFD element reads the data asset
modifies     - DFD element changes the data asset
deletes      - DFD element deletes the data asset
stores       - DFD element stores the data asset
transports   - DFD element transports the data asset
is_an        - DFD element is an instance of the data asset
```

### Examples

```txt
Process "User Registration"
├─ creates → Data Asset "User Credentials"
└─ stores → Data Asset "User Profile"

Data Store "Customer Database"
└─ is_an → Data Asset "Customer Records"

Data Flow "Encrypted Session"
└─ transports → Data Asset "Session Token"
```

---

> **Asset level: derived, not entered (schema v9).** An asset no longer carries
> safety fields of its own (`safetyRelevant`, `containsSafetyRelevantData`,
> `safetyImpact`, `safetyRationale` are gone). An asset's safety relevance and severity
> follow from `physicalImpact` — derived from safety annotations and
> Hazard Items, or as a justified manual override. On the **DFD element level**,
> `safetyRelevant` remains an input (drives threat generation, has
> registry defaults).

### Safety-relevant Data Stores
Data Stores inherit their safety relevance primarily via the linked asset. 
The annotation is made on the asset to ensure consistency across several instances (e.g. backup stores).
Data Stores can contain **safety-critical configuration data** whose manipulation can lead to hazardous system states:

```typescript
interface DataStoreProperties {
  // ... standard properties

  // Safety-specific
  containsSafetyRelevantData?: boolean;   // element input, drives threat escalation
  safetyRationale?: string;
  // Severity is not entered on the Data Store but derived on the asset
  // (physicalImpact, see taraflow-safety-model.md).
  // The link to affected Function Assets is made via
  // asset-to-asset relationships, not as a property field
}
```

**Use:**

- automatic prioritization of `modifies` and `deletes` relationships to these stores
- generation of safety-specific threat scenarios
- compliance documentation (EN 50742: "Identification of safety-related data assets")

**Examples:**

```txt
Data Store "Emergency Stop Configuration"
└─ is_an → Data Asset "Safety Parameters"
   └─ Properties: {
        containsSafetyRelevantData: true,
        safety: { relevance: 'direct', impact: 'fatal' },
        rationale: 'Manipulation could disable emergency stop function'
        // relationship to FU-001, FU-003 → asset-to-asset relation
      }

Process "Configuration Manager"
└─ modifies → Data Store "Emergency Stop Configuration"
   → automatically highest threat priority (safety-critical!)

Data Store "Machine Calibration Data"
└─ is_an → Data Asset "Operational Parameters"
   └─ Properties: {
        containsSafetyRelevantData: true,
        safety: { relevance: 'indirect', impact: 'irreversible_major' },
        rationale: 'Incorrect calibration can cause uncontrolled movement'
      }
```

**Threat derivation:**
For Data Stores with `containsSafetyRelevantData: true`, the following threats are prioritized automatically:

- **Tampering (integrity):** unauthorized change of safety parameters
- **Denial of service (availability):** deleting or corrupting the safety configuration

---

## Data Flows — special case for `transports`

### The redundancy problem

Data Flows transport data by definition. The `transports` relationship would therefore be redundant — **but**: for a precise threat analysis it must be explicit **which** assets are actually transported.

### Solution: explicit with UI support (option C)

**Principle**:

- Every Data Flow **must** explicitly declare which Data Assets it transports
- The UI makes this easy with smart suggestions
- A Data Flow without a `transports` relationship is incomplete

**Why explicit?**

1. **Payload precision**: "HTTPS Request" can contain `Password` (highly critical) or `Language Setting` (low criticality)
2. **Multiple assets**: one flow can transport several assets at the same time
3. **Threat generation**: automatic STRIDE analysis per asset on this communication path
4. **Transitivity**: without an explicit assignment the derivation chain breaks (see section "Transitivity")

### UI workflow for Data Flows

```txt
User creates: Data Flow "API Response" from Process "Login Service"
                                        ↓
UI analyzes: Which assets does "Login Service" know?
               - creates: "Session Token"
               - reads: "User Profile"
               - reads: "User Credentials"
                                        ↓
UI suggests: "Does this flow transport all 3 assets?" 
                [ Select all ] [ Choose individually ]
                                        ↓
User confirms: flow transports "Session Token" + "User Profile"
                (credentials stay internal)
                                        ↓
Validation: ✓ flow is fully defined
```

### Restrictions for Data Flow elements

Data Flows have **only** the following allowed relationships:

- `transports` → Data Asset (mandatory, may occur several times)
- `is_an` → Data Asset (optional, e.g. for protocol assets such as "TLS 1.3 Connection")

**Not allowed** for Data Flows:

- `creates`, `reads`, `modifies`, `deletes`, `stores` (that is what Processes/Data Stores do)

### Warning for incomplete flows

```txt
⚠️ Data Flow "API Request" has no transports relationship
   → threat analysis for this communication path not possible
```

### Example

```txt
Data Flow "Payment Transaction"
├─ transports → Data Asset "Credit Card Number"
├─ transports → Data Asset "Transaction Amount"
└─ transports → Data Asset "Customer ID"

→ STRIDE analysis generates automatically:
  - Tampering: Can the transaction amount be manipulated?
  - Information disclosure: Can the credit card number be intercepted?
  - Spoofing: Can the customer ID be forged?
```

### Edge case: bidirectional communication (request/response)

TARAflow allows **unidirectional flows only**. Bidirectional communication
is always modeled as two separate flows:

```txt
┌─────────┐                           ┌──────────┐
│ Client  │──── Login Request ────→   │  Server  │
│         │                           │          │
│         │←─── Login Response ────   │          │
└─────────┘                           └──────────┘

Flow "Login Request"
└─ transports → Data Asset "Login Credentials"

Flow "Login Response"
└─ transports → Data Asset "Session Token"
```

**Validation rule:**

```txt
IF two flows between the same nodes in opposite directions
→ INFO: "Bidirectional communication detected (request/response pattern) —
         check that assets are distributed correctly across the flows"
```

> **Why no direction qualifier?** The DFD arrow is the primary direction —
> a second direction on the attribute would lead to competing semantics.
> Two separate flows are more precise and force explicit thinking about payload direction.

### Safety relevance of Data Flows

Data Flows can transport safety-relevant data or connect safety-critical areas:

```typescript
interface DataFlowProperties {
  // ... standard properties

  // Safety-specific
  safetyRelevant?: boolean;
  crossesSafetyBoundary?: boolean;  // connects a safety with a non-safety area
  safetyRationale?: string;
  // The link to affected Function Assets is made via
  // asset-to-asset relationships, not as a property field
}
```

**Important: safety context/boundary ≠ visual DFD element**

**The safety context/boundary is NOT a separate line** in the DFD (like a trust boundary) but a **logical categorization** by properties:

- **Trust boundary** = own DFD element (dashed line)
- **Safety annotation** = property on existing elements + automatic detection

**Automatic derivation:**

```typescript
function detectSafetyBoundaryCrossing(flow: DataFlow): boolean {
  const source = getDFDElement(flow.sourceId);
  const target = getDFDElement(flow.targetId);
  
  // Flow crosses the "safety context/boundary" if:
  return (source.safetyRelevant && !target.safetyRelevant) ||
         (!source.safetyRelevant && target.safetyRelevant);
}
```

**Visual representation (optional):**

- Safety-relevant elements: e.g. red frame or background
- Safety context/boundary-crossing flows: e.g. red dashed
- **No new DFD element type!** Only properties + visualization

**Examples:**

```txt
Data Flow "Emergency Stop Signal"
├─ transports → Data Asset "Stop Command"
└─ Properties: {
     safetyRelevant: true,
     crossesSafetyBoundary: false,  // both ends are safety-relevant
     safetyRationale: 'Critical for machine safety function',
     // relationship to FU-001 → asset-to-asset relation
   }

Process "Safety PLC" [safetyRelevant: true]
    ↓ Data Flow "Status Update" [crossesSafetyBoundary: true]
Process "Monitoring Dashboard" [safetyRelevant: false]

→ detected automatically: flow crosses the safety context/boundary
→ higher priority in the threat analysis
→ risk: compromise of the non-safety side could spread to the safety side


Data Flow "Remote Monitoring"
├─ transports → Data Asset "Production Metrics"
└─ Properties: {
     safetyRelevant: false,
     crossesSafetyBoundary: false,
     safetyRationale: 'No safety function impact'
   }
```

**Trust boundary vs. safety context/boundary:**

| Aspect | Trust boundary | Safety context/boundary |
|--------|----------------|-----------------|
| **Visual in the DFD?** | ✅ Yes (dashed line) | ❌ No (marking only) |
| **Property of?** | Zone/group of elements | Individual elements + flows |
| **Representation** | Own DFD element | Property + visual highlighting |
| **Example** | Internet → firewall → LAN | Safety process → non-safety |

**Threat relevance:**
A flow that crosses a safety context/boundary has **higher priority** in the analysis because:
- compromise of the non-safety area could spread to the safety area
- EN 50742 explicitly requires the "Identification of safety-relevant interfaces and communication paths"

**Documentation gain (EN 50742):**
- automatic generation: *"This communication path is safety-relevant as it supports the execution of safety functions."*
- identification of all safety-boundary-crossing flows for audits

---

## Chip Boundary — asset relationships
 
### Concept
 
A Chip Boundary represents a hardware chip as an independent
security boundary in the DFD. It is connectable — DataFlows can
terminate on it via an interface symbol on the boundary edge.
 
### Relevant asset relationships
 
| Relation | Example | Threat relevance |
|---|---|---|
| `uses` | MCU ChipBoundary `uses` firmware asset | Attack vector: firmware tampering |
| `uses` | MCU ChipBoundary `uses` crypto key asset | Attack vector: key extraction via JTAG |
| `depends_on` | Application process `depends_on` SE ChipBoundary | Impact: crypto failure on SE compromise |
| `is_an` | ATECC608 ChipBoundary `is_an` secure element System Asset | Instance relationship: the chip is the instance of the System Asset |
| `hosts` | MCU ChipBoundary `hosts` bootloader Function Asset | Structural relationship: the chip houses the function |
 
### Forbidden connections (validator R9)
 
DataStore and TrustBoundary must not be connected to a
ChipBoundary via a DataFlow. Reason: a DataStore is not a
physical access point — it is modeled inside the chip as a process or
DataStore element (e.g. flash memory as a DataStore inside
the ChipBoundary).
 
### Safety relevance
 
ChipBoundaries can house safety-critical hardware:
 
- Safety MCU (SIL-certified): `safetyRelevant = true`
- SE as key store for safety PLC authentication: `safetyRelevant = true`
- Standard MCU without a safety function: `safetyRelevant = false`
**Planned extension (phase 2):**
`ChipBoundaryProperties.safetyRelevant + safetyRationale` — analogous to
`InterfaceProperties` and `DataFlowProperties`. Allows automatic
prioritization of threats on safety-critical chips (e.g. JTAG attack
on a safety MCU → highest priority).


---

## Physical Boundary — asset relationships

### Concept

A Physical Boundary represents a spatial-physical access barrier in the DFD.
It answers the question: **"Who can physically get at it?"** — semantically orthogonal to
TrustBoundary (logical/policy) and ChipBoundary (hardware isolation).

A Physical Boundary is **not connectable** — no DataFlow terminates on it.
Instead, interfaces are placed geometrically inside or on the edge of the boundary.
Elements inside inherit the physical access precondition.

### Relevant asset relationships

| Relation | Example | Threat relevance |
|---|---|---|
| `located_in` | Control unit Physical Asset `located_in` control cabinet PhysicalBoundary | Theft, physical access |
| `secured_by` | PLC Infrastructure Asset `secured_by` server room PhysicalBoundary | Access control threats |
| `is_an` | Housing Physical Asset `is_an` device_enclosure PhysicalBoundary | Instance relationship |
| `damages` | ExternalEntity `damages` PhysicalBoundary (via Physical Asset) | Sabotage, destruction |

**Main relationships by asset category:**

```
Physical Asset    → located_in    PhysicalBoundary  (the material asset is inside it)
Infrastructure    → secured_by    PhysicalBoundary  (the infra asset is physically protected)
Infrastructure    → is_an         PhysicalBoundary  (the infra instance is this boundary)
System Asset      → depends_on    PhysicalBoundary  (the system needs physical protection)
```

### Forbidden connections (validator R10)

DataFlows must not be connected to a PhysicalBoundary (no endpoint).
A PhysicalBoundary has no communication interface — interaction is modeled via
interface elements on the boundary edge.

### physicalMobility — a new threat dimension

The field `physicalMobility` on `PhysicalBoundaryProperties` opens qualitatively new
threat classes that go beyond PEL and accessibility:

| physicalMobility | Threat class | Example |
|---|---|---|
| `fixed` | On-site attacks only | Wall-mounted PLC, control cabinet |
| `removable` | Depot attack, hardware swap | DIN-rail gateway, plug-in module |
| `portable` | Evil maid, firmware implant, lab side channel | Calibration device, handheld |
| `vehicle_mounted` | Vehicle theft, depot attack during maintenance | CAN gateway, vehicle controller |

**Calibration device scenario (safety-critical):**
```
boundaryType:          "device_enclosure"
physicalMobility:      "portable"      ← evil-maid threat class
safetyRelevant:        true            ← rogue calibration threat
tamperProtection:      "seal"          ← the only practical countermeasure
```
→ Automatically generated threats: evil maid, firmware implant, **calibration data
manipulation** (safety impact), tamper seal bypass.

### Reverse mapping (dfd-to-asset-mapper)

The following asset relations are derived automatically when an asset
lies geometrically inside a PhysicalBoundary:

```typescript
// Physical Asset inside PhysicalBoundary → located_in
// Infrastructure Asset inside PhysicalBoundary → secured_by
// physicalExposureLevel of the PB → derivedPhysicalExposure on the asset
// safetyRelevant of the PB stays an element input — it is not copied to assets
// (an asset's safety relevance is derived, schema v9)
```

### Three orthogonal boundary dimensions

| Boundary | Question | Protection mechanism | Threats |
|---|---|---|---|
| `TrustBoundary` | Who trusts whom? | Firewall, auth, policy | MITM, auth bypass |
| `ChipBoundary` | Which HW isolation? | MPU, TrustZone, debug fuse | JTAG bypass, fault injection |
| `PhysicalBoundary` | Who can physically get at it? | Housing, lock, badge, seal | Physical access, evil maid, cable tamper |

---

## Sensor — asset relationships
 
### Concept
 
A sensor is a transducer **physical → cyber**: it converts a physical
quantity into a signal. It is connectable — the **cyber side** terminates via a
DataFlow at a Process/Interface (the measured value), the **physical side** at
an ExternalEntity (the physical environment) via a DataFlow with
`medium="physical"`. Threat focus: **integrity / authenticity / availability
of the measured value**.
 
Active sensors (radar/LiDAR/ultrasound) are **not** handled here as a flag
but modeled as a dual-role element (sensor + emission actuator).
 
> Modeling question "camera = sensor or ExternalEntity?": a camera as a
> measuring element (optical transducer) is legitimately a **sensor** — then
> privacy relationships to Human Assets apply (see below).
 
### Relevant asset relationships
 
| Relation | Example | Threat relevance |
|---|---|---|
| `creates` (data) | Speed sensor `creates` measured value "Speed" Data Asset | Spoofing/injection of the measured value |
| `accesses` (physical, indirect) | Camera sensor `accesses` "Road" Physical Asset | Optical injection / blinding |
| `monitors` (physical) | Temperature sensor `monitors` "Reactor vessel" Physical Asset | Suppressed alarm via forged value |
| `monitors` (environment) | Air quality sensor `monitors` "Ambient air" Environment Asset | Falsified environmental data |
| `affects_privacy` / `identifies` / `tracks` (human) | Camera sensor `tracks` "Person" Human Asset | Surveillance / privacy violation |
| `implements` / `monitors` (function) | Sensor `implements` "Speed measurement" Function Asset | Function degradation |
| `is_an` (system) | MEMS IMU `is_an` "Inertial Measurement Unit" System Asset | Instance relationship |
| `depends_on` (system) | Sensor `depends_on` "Sensor supply" System Asset | DoS via power failure |
 
**Main relationships by asset category:**
 
```
Physical Asset     → accesses (indirect) / monitors   (measures/observes the quantity)
Data Asset         → creates                          (produces the measured value)
Environment Asset  → monitors                         (observes the environmental state)
Human Asset        → affects_privacy / identifies / tracks   (surveilling sensors)
System Asset       → is_an / depends_on               (device; supply/bus)
Function Asset     → implements / monitors            (realizes the measuring function)
```
 
### Forbidden connections (validator R11)
 
- The **physical side** of a sensor terminates exclusively at an
  ExternalEntity via a DataFlow with `medium="physical"` — not at a
  Process, DataStore or boundary.
- The **cyber side** terminates at a Process or Interface.
- A sensor must **not** be connected directly to a DataStore (the
  measured value is modeled as a Data Asset or a downstream Process/DataStore).
- `damages` / `secures` / `endangers` are not allowed for sensors — a sensor
  *observes*, it does *not act* (that is the actuator side).
### Safety relevance
 
A sensor is the **input side of the bowtie**: a forged or suppressed
measured value can defeat a safety function (defeated barrier).
 
- `safetyRelevant = true` if a corrupt measured value can drive a hazard
  (e.g. a temperature reported too low → missing shutdown).
- `safetyClassification` by consequence magnitude (standard-agnostic, projected
  onto SIL/ASIL/class).
- Mitigation properties damp the threat set: `signalAuthentication`,
  `plausibilityCheck`, `redundancy` (only `diverse` against common mode), `lossDetection`.
- `safetyRelevant = undefined` ⇒ validator finding (not assessed), **not** silent
  suppression.
---
 
## Actuator — asset relationships
 
### Concept
 
An actuator is a transducer **cyber → physical**: it converts a command into
a physical effect. It is connectable — the **cyber side** receives via a
DataFlow from a Process/Interface (the command), the **physical side** acts
on an ExternalEntity (the controlled environment) via a DataFlow with
`medium="physical"`. Threat focus: **integrity / authenticity of the command** and
**availability of the safe-state function**. An actuator is typically the
**top event of the bowtie**.
 
### Relevant asset relationships
 
| Relation | Example | Threat relevance |
|---|---|---|
| `reads` (data) | Valve actuator `reads` "open/close command" Data Asset | Forged command |
| `accesses` (physical, direct) | Robot arm `accesses` "Workpiece" Physical Asset | Forced motion / crushing |
| `damages` (physical) | Motor actuator `damages` "Conveyor belt" Physical Asset | Destructive over-drive |
| `secures` (physical) | Lock actuator `secures` "Access door" Physical Asset | Unauthorized unlocking |
| `endangers` (human) | Robot arm `endangers` "Operator" Human Asset | Physical injury (hazard top event) |
| `endangers` / `contaminates` (environment) | Dosing pump `contaminates` "Process water" Environment Asset | Overdosing / leakage |
| `implements` (function) | Actuator `implements` "Emergency stop" Function Asset | Failure of the protective function |
| `is_an` (system) | Servo drive `is_an` "Drive Unit" System Asset | Instance relationship |
| `depends_on` (system) | Actuator `depends_on` "Power supply" System Asset | DoS → loss of safe state |
| `damages` (infrastructure) | Pump `damages` "Pipeline" Infrastructure Asset | Overpressure |
 
**Main relationships by asset category:**
 
```
Physical Asset     → accesses (direct) / damages / secures   (acts on/destroys/secures)
Human Asset        → endangers                               (hazard top event)
Environment Asset  → endangers / contaminates                (emission/flow/dispensing)
Data Asset         → reads                                   (consumes the command)
System Asset       → is_an / depends_on                      (device; supply/controller)
Function Asset     → implements                              (realizes the actuation)
Infrastructure     → damages                                 (e.g. overpressure)
```
 
> `damages` is the **legitimate hazard relation** here (consequence of a
> faulty/abusive actuation), not the sabotage exception as for ExternalEntity.
 
### Forbidden connections (validator R12)
 
- The **physical side** of an actuator terminates exclusively at an
  ExternalEntity via a DataFlow with `medium="physical"`.
- The **cyber side** receives from a Process or Interface (the command).
- An actuator must **not** be connected directly to a DataStore.
- `creates` (data) is not allowed — an actuator does not *produce* a measured value. A
  feedback is the **sensor side** of a bidirectional element,
  not the actuator itself.
### Safety relevance
 
The actuator is usually the **top event**: forced, blocked or missing
actuation *is* the hazard.
 
- `hazardPotential` (intrinsic, context-free — fan vs. robot arm) seeds the
  prioritization; separate from the rated `safetyClassification`.
- Central safety properties: `safeState`, `failBehavior`, `feedbackVerification`,
  `hardwareInterlock`. **De-energize is not automatically safe** (a brake releases on
  power loss) — always read `safeState` together with `actuatorClass`.
- `endangers` (human) / `endangers`|`contaminates` (environment) ⇒ `safetyRelevant = true`.
- `hardwareInterlock = "independent"` is the mechanical path that survives a
  controller compromise — bounding value for the worst case.

---

## Function Assets

Describes capabilities of a system — independent of how or where
they are implemented. Function is the abstraction level between
Process and System: the behavior is known, not the implementation.

**Typical perspective:** integrator / plant builder with black-box components.

**Decision rule:**
> If the place of implementation is known and can be modeled in the DFD → **Process Asset**.
> If only the behavior is known → **Function Asset**.

### Relationships

```txt
implements   - DFD element provides this function
invokes      - DFD element invokes this function
depends_on   - DFD element depends on this function
is_an        - DFD element is an instance of this function
```

### Examples

```txt
System "Safety Controller" [black box]
└─ is_an → Function Asset "Brake Control Function"

System "Vision System" [black box]
└─ implements → Function Asset "Object Detection Function"

Process "Motion Controller"
└─ depends_on → Function Asset "Brake Control Function"
```

### Distinction from Process

| Criterion           | Function Asset                        | Process Asset                     |
|---------------------|---------------------------------------|-----------------------------------|
| Place of implementation | Unknown / irrelevant              | Known, can be modeled in the DFD  |
| Perspective         | Integrator / black box                | Product developer                 |
| Degree of abstraction | "Can brake"                         | "Set Brake Level"                 |
| Typical element     | System → is_an                        | Process → is_an                   |

### Safety-relevant functions

Safety functions are the most common use case for Function Assets
in the OT/machinery context:

```typescript
interface ExternalSafetyRef {
  id: string;        // e.g. "SF-001" from the external safety analysis
  standard: string;  // e.g. "ISO 12100", "ISO 13849", "IEC 62061"
  document?: string; // e.g. "Safety Analysis Rev. 2.3"
  rationale?: string;// e.g. "Emergency stop function per clause 6.2.4"
}

interface FunctionAssetProperties {
  // standard properties

  // Safety-specific
  isSafetyFunction?: boolean;
  // Severity is not a property: it is the asset's physicalImpact, derived
  // from annotations / Hazard Items or set as a manual override
  // (see taraflow-safety-model.md).

  // Traceability to the external safety analysis (e.g. ISO 12100, ISO 13849)
  externalRefs?: ExternalSafetyRef[];
}
```

**Example:**
```txt

Function Asset "Brake Control Function"  [ID: FU-001]
└─ Properties: {
     isSafetyFunction: true,
     externalRefs: [
       {
         id: 'SF-001',
         standard: 'ISO 12100',
         document: 'Safety Analysis Rev. 2.3',
         rationale: 'Brake control function per clause 6.2.4'
       }
     ]
   }
└─ physicalImpact: 'fatal'  (e.g. from an annotation: loss of brake control
                             leads to uncontrolled motion)

Function Asset "Emergency Stop Logic"  [ID: FU-002]
└─ Properties: {
     isSafetyFunction: true,
     externalRefs: [
       {
         id: 'SF-002',
         standard: 'ISO 12100',
         document: 'Safety Analysis Rev. 2.3',
         rationale: 'Emergency stop function per clause 6.2.4'
       }
     ]
   }
└─ physicalImpact: 'fatal'  (disabling the emergency stop allows uncontrolled
                             machine motion)

System "Safety Controller"
└─ is_an → Function Asset "Brake Control Function"  [FU-001]
└─ implements → Function Asset "Emergency Stop Logic"  [FU-002]
   → automatically highest threat priority (safety-critical)
   → Safety Override Rule applies: fatal → CRITICAL

// Link between Data Asset and Function Asset:
// → via asset-to-asset relationships (see taraflow-asset-to-asset-relations.md)
// → not as a property field
```

### Threat derivation

For Function Assets with `isSafetyFunction: true`, the following threats
are prioritized automatically:

- **Tampering (integrity):** manipulation of the function logic or parameters
- **Denial of service (availability):** deactivation or interruption of the function
- **Spoofing:** faking a validated safety function

### Note on the hierarchy

Several Function Assets can form a Process. This relationship
is informative, not mandatory in the model:
```
Function "Read Sensor Value"   ─┐
Function "Evaluate Threshold"  ─┼─→ together form → Process "Safety Monitor"
Function "Trigger Emergency Stop" ─┘
```

For the integrator who only sees the black box, the function level is enough.
The product developer models deeper on the process level.

---

## Process Assets

A Process Asset describes an **active flow at runtime** — information *in motion*.
It is not the document or file that describes the flow (that is a Data Asset)
but the **running execution itself**: the state, the timing and the continuity of
execution.

**The fundamental distinction:**

| | What it is | Example | Threat |
|---|---|---|---|
| **Data Asset** | Information *at rest* | NC program as a file, therapy profile as a document | Theft, manipulation of the file |
| **Process Asset** | Information *in motion* | The active milling operation, the running therapy execution | Timing manipulation, race condition, deadlock |
| **Function Asset** | The tool | "Roughing", "Calculate dose" | Function delivers a wrong result |

> **Rule of thumb:** If the attacker targets neither the file (Data) nor the tool (Function)
> but the **timeline** — then a Process Asset is the target.

**Typical Process Assets:**

- Active CNC milling operation (not: the NC program — that is Data)
- Running therapy execution of an infusion pump (not: the therapy profile — that is Data)
- Active production run in pharma manufacturing (not: the GMP instruction — that is Data)
- Running dialysis treatment (not: the treatment protocol — that is Data)

**Threat focus:**

- **Timing manipulation:** latency injection into the control loop — the file is unchanged,
  the function intact, but the timing is corrupted → loss of quality or patient harm
- **Race condition:** two functions run concurrently instead of sequentially → invalid
  process state although both functions work correctly
- **Sequencing attack:** order of steps changed → harm arises from
  the combination, not from individual faulty components
- **Deadlock / suspension:** the process is frozen or delayed indefinitely →
  loss of availability of the running operation

### DFD entry (level 1)

Process Assets have DFD entry points — a DFD element interacts with the
running process:

```txt
executes     - DFD element executes the process (starts and controls the execution)
invokes      - DFD element starts the process
terminates   - DFD element ends the process (emergency abort, regular end)
suspends     - DFD element pauses the running process
monitors     - DFD element monitors the process state at runtime
```

### Ordered vs. unordered asset-to-asset relationships

A Process Asset has **two kinds** of outgoing asset-to-asset relationships:

**Step relationships (ordered) — the timeline:**

```txt
Process → [step: 1] invokes → Function A
Process → [step: 2] invokes → Function B
Process → [step: 3] invokes → Function C
```

Manipulating the order = sequencing attack.
Race condition between steps = concurrent execution that is not intended.

**Resource relationships (unordered) — what the process runs with:**

```txt
Process → runs_on     → System
Process → uses        → Data      (reads configuration data at runtime)
Process → operated_by → Human
Process → depends_on  → Service
```

### Examples

```
Data Asset "NC program turbine blade v3.2"      ← the document, at rest
Process Asset "Milling turbine blade"           ← the active run, in motion
├─ [step: 1] invokes → Function Asset "Roughing"
│              uses  → Data Asset "NC program turbine blade v3.2"
├─ [step: 2] invokes → Function Asset "Finishing"
├─ [step: 3] invokes → Function Asset "Quality inspection"
├─ runs_on   → System Asset "5-axis CNC controller"
└─ operated_by → Human Asset "CNC setter"

Threat 1 — timing manipulation:
  The attacker injects latency into the control loop between step 1 and 2.
  NC program unchanged ✓, function "Finishing" intact ✓
  → timing corrupted → surface tolerance violated → scrap

Threat 2 — sequencing attack:
  Steps 2 and 3 swapped.
  → quality inspection before finishing → defect is not detected
  → no single asset compromised — only the order
```

```
Data Asset "Therapy profile patient XY"          ← the values, at rest
Process Asset "Therapy execution infusion pump"  ← the active execution, in motion
├─ [step: 1] invokes → Function Asset "Calculate bolus"
│              uses  → Data Asset "Therapy profile patient XY"
├─ [step: 2] invokes → Function Asset "Administer dose"
├─ [step: 3] invokes → Function Asset "Monitor vital signs"
├─ runs_on   → System Asset "Infusion pump"
└─ operated_by → Human Asset "Nurse"

Threat — race condition:
  Steps 2 and 3 run concurrently instead of sequentially.
  Therapy profile correct ✓, both functions intact ✓
  → overdose because monitoring only intervenes after delivery
  → Safety Override applies: fatal → CRITICAL
```

### Process Asset properties

```typescript
interface ProcessAssetProperties {
  // standard properties

  // Classification
  domain?: string;                    // e.g. "OT-Manufacturing", "Medical", "Pharma"
  regulatoryReference?: string;       // e.g. "GMP Annex 11", "MDR Annex I ch. 17"
  isValidatedProcess?: boolean;       // validated/certified flow?
  validationRationale?: string;       // required if isValidatedProcess === true

  // Safety
  isSafetyCritical?: boolean;
  // Severity: the asset's physicalImpact (derived or manual override),
  // not a property — see taraflow-safety-model.md
}
```

---

## System Assets

Describes impacts on systems. System relationships distinguish between active use (with a qualifier for attack vectors) and dependencies (for impact analysis).

**Distinction from Service Assets:**
> A System Asset is under **own technical control** — the analyst can configure it, monitor it and access its interfaces directly. Responsibility lies entirely with the own team (`responsibility: owner`).
> A Service Asset, by contrast, lies fully or partly **outside own control** — SLA-bound, shared or third-party responsibility.
>
> **Decision rule:** AWS S3 is a **Service Asset** (`responsibility: shared`) — even though the technical interface is an API. The boundary of responsibility, not the interface, decides.

### Relationships
```
controls     - DFD element has comprehensive control (start/stop/suspend/configure)
configures   - DFD element changes the configuration
monitors     - DFD element observes/reads the system state.
uses         - DFD element uses functionality [REQUIRES QUALIFIER]
depends_on   - DFD element depends on the system (cascading effect on failure)
is_an        - DFD element is an instance of the System Asset
```

> [!IMPORTANT]
> **Security-specific distinction:**
> - **monitors:** only describes the visibility of the system state. A failure or compromise leads to a **loss of insight (repudiation)**, but not to a direct standstill of the observing element.
> - **depends_on:** defines an availability dependency. Whether failure leads to total failure or degradation depends on the `degradationMode` attribute (see below).

**`depends_on` — transitivity brake via `degradationMode`:**

An uncontrolled `depends_on` chain leads to **criticality inflation**: if A depends on B, B on C, and C is safety-critical, all assets quickly become CRITICAL. To prevent this, every `depends_on` relationship carries an optional attribute:

```typescript
interface DependsOnRelation {
  type: "depends_on";
  degradationMode?: boolean;   // default: false
  degradationDescription?: string; // required if degradationMode === true
                                   // e.g. "Local cache available for 24h"
}
```

| `degradationMode` | Meaning | Impact propagation |
|---|---|---|
| `false` (default) | Total failure when the target asset fails | full criticality is propagated |
| `true` | System keeps running degraded | criticality is damped by one level |

```
Example without degradation:
  System A depends_on[degradationMode: false] System B[CRITICAL]
  → System A inherits CRITICAL automatically

Example with degradation:
  System A depends_on[degradationMode: true] System B[CRITICAL]
  degradationDescription: "Local fallback for 24h, then failure"
  → System A inherits HIGH (damped)
  → validation hint: "Document the fallback for the audit"
```

> **Resilience incentive:** The attribute forces the analyst to think about fallback mechanisms
> — not just list dependencies. A documented degradation mode
> is at the same time mitigation evidence for the audit report.

### System qualifiers for `uses`

The `uses` relationship **requires** a qualifier that specifies the attack vector:

```
api        - use via API/REST/RPC (→ injection, authentication bypass)
network    - communication over the network (→ man-in-the-middle, eavesdropping)
hardware   - physical access (→ tampering, physical attack)
library    - shared library/code inclusion (→ code injection, dependency confusion)
```

**Important**: Without a qualifier, the threat analysis cannot be carried out precisely.

### Examples
```
Process "Container Orchestrator"
└─ controls → System Asset "Application Server"

Process "Config Manager"
└─ configures → System Asset "Database Server"

Process "Health Check Service"
└─ monitors → System Asset "Application Server"

Process "Web Application"
└─ uses [api] → System Asset "Database Server"

Process "API Gateway"
├─ uses [network] → System Asset "Auth Service"
└─ depends_on → System Asset "Auth Service"
   (both relationships are possible and meaningful!)

External Entity "Cloud VM"
└─ is_an → System Asset "Virtual Machine Infrastructure"
```

### Safety relevance of System Assets

System Assets and their interfaces can have physical hazard potential, especially for machines and OT systems:

```typescript
interface SystemAssetProperties {
  // ... standard properties

  // Safety-specific
  physicalHazardPotential?: 'low' | 'medium' | 'high';
  // Safety relevance and severity are derived on the asset (physicalImpact),
  // not entered here — see taraflow-safety-model.md.
  // The link to affected Function Assets is made via
  // asset-to-asset relationships (implements, depends_on)
}

interface InterfaceProperties {
  // ... standard properties
  
  // Safety-specific (especially important for physical interfaces)
  safetyRelevant?: boolean;          // element input, drives threat escalation
  physicalHazardPotential?: 'low' | 'medium' | 'high';
  safetyRationale?: string;
}
```

**Physical hazard potential:**

- `low`    - minimal risk (e.g. monitoring port without a control function)
- `medium` - moderate risk (e.g. configuration interface)
- `high`   - high risk (e.g. direct access to safety logic)

**Important for physical interfaces:**
A USB port or Ethernet interface is not only an IT risk (information disclosure) but can also be an **engineering risk** (manipulation, bypass of safety functions).

**Examples:**

```txt
System Asset "Safety PLC"
└─ Properties: {
     physicalHazardPotential: 'high',
     // relationship to FU-001, FU-002, FU-005 → asset-to-asset relations
   }
└─ physicalImpact: 'fatal'  (e.g. from the annotation "controls emergency stop
                             and safety interlocks")

Interface "Maintenance USB Port" (on Safety PLC)
└─ Properties: {
     safetyRelevant: true,
     physicalHazardPotential: 'high',
     rationale: 'Direct access to safety-critical programming interface'
   }

Process "Firmware Update Service"
├─ uses [hardware] → Interface "Maintenance USB Port"
│  └─ Threat: manipulation of safety logic via physical access
└─ modifies → System Asset "Safety PLC"
   └─ Safety impact: CRITICAL

System Asset "HMI Display"
└─ Properties: {
     physicalHazardPotential: 'low',
   }
└─ no physicalImpact (no direct control over safety functions)

Interface "Ethernet Port" (on the gateway to the production plant)
└─ Properties: {
     safetyRelevant: true,
     physicalHazardPotential: 'medium',
     rationale: 'Network access to safety-related control systems'
   }
```

**Documentation gain (EN 50742):**

- explicit marking of physical interfaces as safety-relevant
- very important in machinery audits and OT security
- automatic generation: *"Physical interfaces are explicitly safety-relevant"*

---

## Infrastructure Assets

Describes impacts on physical facilities, hardware and the environment. Infrastructure relationships focus on the physical state and on access protection.

### Relationships

```txt
accesses     - DFD element has physical access to the asset
secures      - DFD element protects the physical asset (e.g. locking system)
damages      - DFD element can physically damage the asset (sabotage)
powers       - DFD element ensures the power supply
monitors     - DFD element monitors physical parameters (temp, smoke, intrusion)
is_an        - DFD element is an instance of the Infrastructure Asset
```

> [!IMPORTANT]
**Security-specific distinction:**
> - **accesses:** defines the possibility of physical contact. Security consequence: facilitates attacks such as hardware tampering or theft.
> - **secures:** describes a protective measure. Security consequence: reduces the likelihood of physical attacks.
> - **damages:** describes destruction of the asset. Security consequence: total failure (availability) through physical impact.

### Infrastructure qualifiers for accesses

The `accesses` relationship requires a qualifier for the kind of access:

```txt
on-site    - on-site access to the premises / facility (e.g. plant site, machine room)
proximity  - access from nearby (e.g. RFID range, WLAN radius)
internal   - access to the inside of the housing (e.g. debug header on the PCB)
```

> **`on-site` vs. `direct` (Human→Physical):** `on-site` describes **access to a place** (stationary infrastructure). `direct` describes **physical contact with an object** (mobile Physical Asset). Shared: `proximity` is identical for both.

### Examples

```txt
External Entity "Technician"
└─ accesses [on-site] → Infrastructure Asset "CNC Machine"

Process "Electronic Lock Controller"
└─ secures → Infrastructure Asset "Server Rack"

Process "UPS (Uninterruptible Power Supply)"
└─ powers → Infrastructure Asset "Main Control Cabinet"

Process "Intrusion Detection System"
└─ monitors → Infrastructure Asset "Warehouse Perimeter"

External Entity "Cooling Unit"
└─ is_an → Infrastructure Asset "HVAC System"
```

### Safety relevance of Infrastructure Assets
Physical infrastructure is often the last barrier for personal protection or the source of hazards (e.g. heat, moving parts):

```typescript
interface InfrastructureAssetProperties {
  // ... standard properties
  
  // Safety-specific
  isPhysicalBarrier?: boolean; // e.g. guard fences, housings
  environmentalHazard?: 'fire' | 'chemical' | 'mechanical' | 'none';
  // Severity: the asset's physicalImpact (derived or manual override),
  // not a property — see taraflow-safety-model.md

// High-value asset (financial/operational protection)
  isHighValueAsset?: 'low' | 'medium' | 'high' | 'critical'; // derived — from impact criteria + recoverability fields
  isHighValueAssetSource?: 'derived' | 'manual';              // manual requires highValueRationale
  replacementLeadTime?: '<3m (low)' | '3-6m (medium)' | '6-12m (high)' | '>12m (critical)';
  replacementLeadTimeNote?: string;              // optional, e.g. "18-24 months, ASML allocation queue"
  vendorDependency?: 'multi_vendor' | 'limited' | 'single_source'; // supplier dependency
  spareAvailability?: 'on_site' | 'supplier' | 'none';             // spare parts situation
  highValueRationale?: string;                   // required if source==='manual' OR isHighValueAsset∈{'high','critical'}
}
```

> **Important:** Destroying (damages) an infrastructure component can immediately defeat safety functions (e.g. breaking through a guard fence).

**Examples:**

```txt
Infrastructure Asset "CNC Guarding"
└─ Properties: {
     isPhysicalBarrier: true,
   }
└─ physicalImpact: 'fatal'  (prevents contact with high-speed cutting tools)

Process "Manual Override"
└─ accesses [internal] → Infrastructure Asset "CNC Guarding"
   └─ Threat: bypass of physical safety interlocks
   └─ Safety impact: CRITICAL

Infrastructure Asset "Chemical Storage Tank"
└─ Properties: {
     environmentalHazard: 'chemical',
   }
└─ physicalImpact: 'irreversible_major'  (rupture causes exposure to hazardous substances)

Infrastructure Asset "Production recipe database"
└─ Properties: {
     operational: 'critical',
     assetDestructionImpact: 'high',    // no harm to persons, but production stop
     replacementLeadTime: '3-6m (medium)',
     vendorDependency: 'multi_vendor',
     spareAvailability: 'supplier',
     highValueRationale: 'All production processes depend on recipe data.
                          Loss causes complete production halt until restore.'
     // → operational criticality override applies: threat priority = HIGH minimum
   }

Infrastructure Asset "Safety PLC Controller"
└─ Properties: {
     operational: 'critical',
     assetDestructionImpact: 'critical',
     replacementLeadTime: '6-12m (high)',
     vendorDependency: 'single_source',
     spareAvailability: 'none',
     highValueRationale: 'Single-source vendor, no spare on site.
                          Loss halts production and disables safety functions.'
     // → isHighValueAsset = true (derived)
     // → high-value override applies: threat priority = CRITICAL
   }
```

**Documentation gain (ISO 12100):**
- systematic capture of physical barriers as safety assets.
- linking physical access (accesses) with bypassing protective devices.
- automatic generation: "Physical barriers are identified and monitored against unauthorized access and damage."

---

### High-value asset override

Certain infrastructure assets are not safety assets in the sense of ISO 12100
(no personal protection), but their loss or destruction causes such
high financial or operational damage that an automatic
priority escalation is justified.

**Distinction from `isProtectionTarget` (Human Assets):**

| Concept | Carrier | Normative basis | Reason for override |
|---|---|---|---|
| `isProtectionTarget` | Human Asset | ISO 12100 | Human life cannot be offset |
| `isHighValueAsset` | Infrastructure Asset | internal/contractual | Destruction damage not tolerable |

**Semantics of the fields:**

- `isHighValueAsset`: **derived** from `assetDestructionImpact` + `replacementLeadTime` +
  `vendorDependency` + `spareAvailability`. Can only be overridden with `isHighValueAssetSource: 'manual'`
  — then `highValueRationale` is mandatory.

- `assetDestructionImpact`: **derived** in the asset impact phase as MAX over all
  impact dimensions (financial, operational, safety, privacy). Not entered manually.

- `replacementLeadTime`: combines the actual time span and the derived criticality level.
  The analyst chooses the matching level; `replacementLeadTimeNote` allows refinement:

  | Value | Time span | Criticality |
  |---|---|---|
  | `<3m (low)` | under 3 months | low |
  | `3-6m (medium)` | 3 to 6 months | medium |
  | `6-12m (high)` | 6 to 12 months | high |
  | `>12m (critical)` | over 12 months | critical |

- `vendorDependency`: supplier dependency for replacement procurement:

  | Value | Meaning |
  |---|---|
  | `multi_vendor` | Several suppliers available |
  | `limited` | Few suppliers, limited availability |
  | `single_source` | Single supplier, no replacement available |

- `spareAvailability`: availability of spares on site or at the supplier:

  | Value | Meaning |
  |---|---|
  | `on_site` | Spare available on site |
  | `supplier` | Spare can be ordered from the supplier |
  | `none` | No spare available |

- `replacementLeadTimeNote`: optional free text for refinements, e.g.
  "18-24 months, ASML allocation queue" or
  "Parallel unit in fab B available as fallback → downgraded to high".

- `highValueRationale`: mandatory if `isHighValueAsset` is set (any value).
  Explains *why* the asset is worth protecting — not the time span.
  Documented verbatim in the audit report.

**Derivation logic of `isHighValueAsset`:**
```
HVA: 'low'
  MAX(financial_damage, operational, physical_damage) === 'medium'
  AND replacementLeadTime >= '3-6m (medium)'

HVA: 'medium'
  MAX(financial_damage, operational, physical_damage) === 'high'
  AND replacementLeadTime >= '3-6m (medium)'

HVA: 'high'
  MAX(financial_damage, operational, physical_damage) === 'high'
  AND replacementLeadTime >= '6-12m (high)'
  AND (vendorDependency === 'limited' OR spareAvailability === 'supplier')

HVA: 'critical'
  MAX(financial_damage, operational, physical_damage) === 'high'
  AND replacementLeadTime >= '6-12m (high)'
  AND (vendorDependency === 'single_source' OR spareAvailability === 'none')
```

>The three impact criteria come from the asset impact phase (low/medium/high).
>Safety impact (`safety`) does not enter the HVA derivation —
>safety-relevant assets are handled separately by the Safety Override Rule.

**High-value override rule:**

> **Basic principle:** The high-value override sets a **MINIMUM level** — it does not override higher ratings from other sources (safety override, manual analyst decision).

```txt
IF isHighValueAsset === 'critical'
THEN threat priority = CRITICAL minimum
     → mandatory threats: Tampering, Denial of Service, Physical Damage
     → highValueRationale is documented verbatim in the risk report

IF isHighValueAsset === 'high'
THEN threat priority = HIGH minimum
     → mandatory threats: Tampering, Denial of Service, Physical Damage
     → highValueRationale is documented verbatim in the risk report

IF isHighValueAsset === 'medium'
THEN threat priority = HIGH minimum
     → mandatory threats: Tampering, Denial of Service

IF isHighValueAsset === 'low'
THEN no override — included in the report for information
```

**Order of the override rules (descending):**

1. Safety override      — irreversible_major/fatal + direct → CRITICAL
2. HVA critical         → CRITICAL minimum
3. HVA high             → HIGH minimum
4. HVA medium           → HIGH minimum
5. Operational critical → HIGH minimum
6. HVA low              → no override

> **Interaction safety + HVA:** The safety override always takes precedence. An asset that has both
> `isHighValueAsset: 'high'` and `safety.relevance: 'direct'` + `fatal`
> gets CRITICAL via the safety override — the HVA override is thereby already met.

**`highValueRationale` mandatory condition:**
```
Mandatory if:
  isHighValueAssetSource === 'manual'
  OR isHighValueAsset ∈ {'high', 'critical'}

Optional (recommended) if:
  isHighValueAsset ∈ {'low', 'medium'} AND source === 'derived'
  → the derivation logic is itself the justification
```

> **Note for later refactorings:** `replacementLeadTime` deliberately combines time span
> and criticality level in one field (option A). Should a domain need finer time intervals,
> this field can be split into `replacementLeadTime` (free text/enum) +
> `replacementCriticality` (low/medium/high/critical) (option B).

**Examples:**

```txt
Infrastructure Asset "EUV Lithography Machine"
└─ Properties: {
     assetDestructionImpact: 'critical',
     isHighValueAsset: 'critical',        // derived
     isHighValueAssetSource: 'derived',
     replacementLeadTime: '>12m (critical)',
     replacementLeadTimeNote: '18-24 months, subject to ASML allocation queue',
     highValueRationale: 'Single unit, core of 7nm production line.
                          Loss causes complete production halt.'
   }

Infrastructure Asset "5-Axis CNC Machining Center"
└─ Properties: {
     assetDestructionImpact: 'high',
     isHighValueAsset: 'high',            // derived
     isHighValueAssetSource: 'derived',
     replacementLeadTime: '6-12m (high)',
     highValueRationale: 'Custom configuration for titanium aerospace parts,
                          requalification required after replacement.'
   }

Infrastructure Asset "CNC Machining Center" (with fallback)
└─ Properties: {
     assetDestructionImpact: 'high',
     isHighValueAsset: 'medium',          // manual — fallback damps the rating
     isHighValueAssetSource: 'manual',
     highValueRationale: 'Primary unit for titanium part production.
                          Parallel unit in fab B available as fallback.',
     replacementLeadTime: '>12m (critical)',
     replacementLeadTimeNote: 'Lead time >12m but parallel unit in fab B available
                               as fallback → isHighValueAsset downgraded to medium'
   }
```

**Documentation gain:**
- automatic generation: *"The following infrastructure assets are classified as
  high-value assets. Their destruction or prolonged unavailability would result in
  critical operational or financial impact."*
- all threats against high-value assets are consolidated in the risk report.

---

## Physical Assets

Describes mobile, purely passive material assets **without an embedded system**. Physical Assets
process no data and have no logic of their own. They are completely passive.

**Distinction rule:**
> If the asset contains an embedded system, a CPU or software → **System Asset**.
> If the asset is purely passive, without logic of its own → **Physical Asset**.

**Typical examples:** museum paintings, antiques, jewelry, cash, physical prototypes
without electronics, production molds, tools, physical keys.

**Not meant:** infusion pumps, machines, control units — these are System Assets.

### No DFD entry — level 2 only

Physical Assets have **no element-to-asset relationships** (level 1). A DFD models
information flows — processes, data stores, data flows. A purely passive Physical Asset
does not appear there, because no data flow passes through it and no software runs
on it.

The cyber threat path to a Physical Asset **always** runs through other asset types
in the asset-to-asset graph (level 2):

```
Attack path example: compromise of the surveillance system
                     → access to the physical object

System Asset "Video surveillance"         ← DFD entry here (Process → controls)
  └─ implements → Function Asset "Intrusion Detection"
                    (protects indirectly)
Physical Asset "Rembrandt painting"
  └─ located_in → Infrastructure Asset "Exhibition room"
                    (access via this)

→ Threat: compromise of the video surveillance allows
          undetected physical access to the painting
```

**Exception: direct sabotage by an External Entity**

For sabotage scenarios in OT/plant security, a **narrowly limited exception** is allowed:
an `ExternalEntity` in the DFD may relate `damages` directly to a Physical Asset —
without the Physical Asset itself becoming a DFD flow element.

```
External Entity "Attacker / insider"
└─ damages → Physical Asset "Static support cable"
   → Threat: sabotage of passive components = DoS on the dependent function
   → STRIDE: Tampering, DoS
   → Safety: indirect if the asset has a protective function

External Entity "Maintenance technician (compromised)"
└─ damages → Physical Asset "Protective housing control unit"
   → Threat: physical destruction enables subsequent access
              to the System Asset behind it
```

> **Restriction:** Only `damages` is allowed as a direct External Entity→Physical relationship.
> All other relationships (theft, access, surveillance) remain level 2.
> `damages` is the only relationship that does not presuppose an information flow —
> it describes pure physical impact.

All relationships to Physical Assets are defined in
`taraflow-asset-to-asset-relations.md` — in particular:
- `Human → Physical` (`owns`, `responsible_for`, `accesses`)
- `Infrastructure → Physical` (`houses`)
- `Physical → Infrastructure` (`located_in`)
- `Physical → Function` (`enables`, `triggers`)
- `Physical → System` (`hosts`, `controlled_by`)
- `Physical → Human` (`endangers`, `exposes`)

**Mandatory anchoring — validation rule:**
```
IF Physical Asset has NONE of the following relationships:
   - located_in → Infrastructure Asset
   - controlled_by → System Asset
   - hosts → System Asset
THEN validation warning:
     "Physical Asset not anchored in the graph —
      at least one relationship required:
      located_in (Infrastructure) OR controlled_by/hosts (System).
      Recommended: both, if applicable."
```

> Physical Assets can never be modeled in isolation. An unanchored Physical Asset
> cannot be reached by the threat analysis — the attack path is missing.

### Physical Asset properties

```typescript
interface PhysicalAssetProperties {
  // standard properties

  // Classification
  isUnique: boolean;                 // one of a kind (artwork, prototype) vs. replaceable (standard part)
  portability: "fixed" | "portable"; // stationary vs. transportable

  // High-value properties — identical to Infrastructure Assets (Physical inherits these fields)
  assetDestructionImpact?: 'low' | 'medium' | 'high' | 'critical';
  isHighValueAsset?: 'low' | 'medium' | 'high' | 'critical';
  isHighValueAssetSource?: 'derived' | 'manual';
  replacementLeadTime?: "<3m (low)" | "3-6m (medium)" | "6-12m (high)" | ">12m (critical)";
  replacementLeadTimeNote?: string;
  highValueRationale?: string;       // required if source==='manual' OR isHighValueAsset∈{'high','critical'}

  // Uniqueness
  uniquenessRationale?: string;      // required if isUnique === true
                                     // e.g. "Historical original, no reproduction possible"
}
```

> Override rule, derivation logic and order are identical to Infrastructure Assets —
> see section "High-value asset override" in the Infrastructure chapter.

### Distinction from Infrastructure Assets

| | Infrastructure Asset | Physical Asset |
|---|---|---|
| Mobility | Stationary (real estate, network) | Mobile valuable |
| Logic | Houses systems | Completely passive |
| Example | Server room, production hall | Painting, prototype, tool |
| DFD entry | ✅ via `accesses` element-to-asset | ⚠️ only `damages` from an External Entity (sabotage exception) |
| Threat focus | Access, sabotage, hosting | Theft, damage, forgery |

### Threat derivation (via asset-to-asset)

Threats against Physical Assets are **not** derived directly from the DFD but from
the asset-to-asset relationships in the graph:

| Threat | Asset-to-asset trigger | STRIDE | Safety relevance |
|---|---|---|---|
| Theft | `Human → Physical: accesses [direct]` | DoS | – |
| Damage | `Physical → Human: endangers` (counterpart) | DoS | indirect |
| **Sabotage** | **`External Entity → damages` (level 1 exception)** | **Tampering, DoS** | **indirect if protective function** |
| Forgery/swap | `isUnique: true` + access via infra | Spoofing, Tampering | – |
| Unauthorized access | `Infrastructure: houses` compromised | Tampering | – |
| Surveillance failure | `System: implements Function` → protection lost | DoS | indirect |

**High-value override for Physical Assets:**\
`isHighValueAsset === 'critical'` → threat priority CRITICAL\
`isHighValueAsset === 'high'` → threat priority CRITICAL\
Mandatory threats: Tampering (forgery), DoS (theft/destruction)\
For `isUnique === true` additionally: Spoofing (swap for a forgery)

---

## Service Assets

Describes internal or external services the system under analysis relies on —
and that lie **fully or partly outside own control**.

**Primary distinguishing feature from System Assets: boundary of responsibility**

| | System Asset | Service Asset |
|---|---|---|
| Control | Full technical control | Fully or partly external |
| Responsibility | `responsibility: owner` | `shared` or `third-party` |
| Configuration | Directly by the own team | Limited via SLA / contract |
| Interface | Any (API, SDK, HW...) | Any — irrelevant for the classification |
| Typical example | Own auth service, internal SIEM | AWS S3, external OTA server |

> **Rule of thumb:** The **technical interface** (REST API, SDK, ...) does **not** decide between System and Service. The **boundary of responsibility** decides. AWS S3 has a REST API — it is still a Service Asset because responsibility is shared.

**Typical examples:**
- Cloud services (AWS S3, Azure IoT Hub, Google Cloud AI)
- External APIs (payment providers, map services, OTA update servers)
- Internal services of other teams (IAM service, SIEM, PKI)
- Maintenance and support services of external providers

### Relationships

```txt
uses [qualifier]    - DFD element uses the service [qualifier mandatory]
depends_on          - DFD element critically depends on the service (total failure on outage)
monitors            - DFD element monitors the service status or availability
configures          - DFD element configures the service (parameters, settings)
is_an               - DFD element is an instance of the Service Asset
```

> **`uses` vs. `depends_on`** — the same distinction as for System Assets:
> - `uses` (soft dependency): service outage → degradation mode possible
> - `depends_on` (hard dependency): service outage → total failure, unless `degradationMode: true`
>
> The same `degradationMode` attribute as for System Assets applies to `depends_on` —
> a documented fallback damps criticality propagation.

### Service qualifiers for `uses`

The `uses` relationship **requires** a qualifier:

```
api       - integration via REST/SOAP/gRPC/GraphQL  (→ injection, auth bypass)
sdk       - integration via SDK or library          (→ dependency confusion, code injection)
webhook   - event-based integration                 (→ spoofing, replay attack)
managed   - fully managed service without own API   (→ availability risk, vendor lock-in)
```

### Examples

```
Process "OTA Update Manager"
├─ uses [api] → Service Asset "Vendor Update Service"
└─ depends_on → Service Asset "Vendor Update Service"
   → hard dependency: no firmware update possible without the update service
   → mandatory threat: supply chain attack via compromise of the update service

Process "Remote Monitoring Agent"
└─ uses [api] → Service Asset "Cloud Monitoring Platform"
   (uses, not depends_on — the device keeps working without the cloud, degradation mode)

Process "Payment Handler"
├─ uses [api] → Service Asset "Payment Gateway"
└─ depends_on → Service Asset "Payment Gateway"

External Entity "Maintenance technician"
└─ is_an → Service Asset "External maintenance service"
```

### Service Asset properties

```typescript
type ServiceType = "internal" | "external" | "cloud" | "managed";
type ResponsibilityModel = "owner" | "shared" | "third-party";

interface ServiceAssetProperties {
  // standard properties

  // Service classification
  serviceType: ServiceType;

  // Shared responsibility model
  responsibility: ResponsibilityModel;
  responsibilityScope?: string;   // required if responsibility === "third-party"
                                  // recommended if responsibility === "shared"
                                  // What is in own responsibility?
                                  // e.g. "App security, data encryption;
                                  //        provider is responsible for OS hardening, network isolation"
  providerName?: string;          // name of the external provider
  slaReference?: string;          // reference to SLA / contract / document

  // Safety
  isSafetyCritical?: boolean;
  // Severity: the asset's physicalImpact (derived or manual override),
  // not a property — see taraflow-safety-model.md
}
```

**Responsibility models:**

| Value | Meaning | Typical example |
|---|---|---|
| `owner` | Full own responsibility | Self-operated internal service |
| `shared` | Shared responsibility | AWS: own app security, AWS: OS hardening |
| `third-party` | Fully external | SaaS service without configuration access |

**Validation rules:**
```
IF responsibility === "third-party" AND responsibilityScope === ""
THEN validation error (blocking):
     "responsibilityScope is mandatory for a fully external service —
      the content must describe:
      - Which interfaces / API endpoints are in own responsibility?
      - Which security controls does the provider take over?
      - Which SLA applies to security incidents?
      (CRA Art. 13 – third-party component obligation)"

IF responsibility === "shared" AND responsibilityScope === ""
THEN validation warning:
     "responsibilityScope recommended for shared responsibility
      (CRA Art. 13 – supply chain security)"

IF responsibility === "third-party" AND depends_on present AND depends_on.degradationMode === true
THEN INFO: "External service with degradation mode — check the SLA for failover behavior"

IF responsibility === "third-party" AND no depends_on present
THEN validation warning:
     "External service without an explicit dependency — is that intended?
      If an outage of the service has an impact: add depends_on"
```

> **Single trigger:** The trigger is exclusively `responsibility`, not
> `serviceType`. A `serviceType: managed` service typically has
> `responsibility: third-party` — the ERROR then applies automatically.
> No implicit `!= owner`.

### Threat derivation

| Threat | Relationship trigger | STRIDE | Safety relevance |
|---|---|---|---|
| Supply chain attack | `uses [api\|sdk]` on an external service | Tampering, Spoofing | transitive if safety-critical |
| Service outage | `depends_on` service | Denial of Service | direct if `isSafetyCritical: true` |
| Data disclosure | `uses [api]` with personal data | Information Disclosure | – |
| Vendor impersonation | `uses [webhook]` | Spoofing | – |
| Scope creep | `managed` with `responsibility: third-party` | Elevation of Privilege | – |

---

## Human Assets

Describes impacts on people as **protection subjects** (safety/security/privacy).

### Relationships

```txt
endangers         - Hazard Item affects physical safety
affects_safety    - DEPRECATED (legacy). Replaced by `endangers` (introduced with
                    the Hazard Item). `endangers` is the canonical safety relation
                    to Human/Environment protection targets. `affects_safety` is kept for now
                    only for backward compatibility; new models use `endangers`.
affects_privacy   - DFD element affects privacy/GDPR
identifies        - DFD element identifies/de-anonymizes a person
tracks            - DFD element tracks/monitors a person  
exposes           - DFD element endangers/exposes a person
is_an             - DFD element represents this person/role
```

### Safety-specific properties

Human Assets can additionally be marked as **protection targets** (ISO 12100/EN 50742 terminology):
```typescript
interface HumanAssetProperties {
  // ... standard asset properties
  
  // Safety-specific
  isProtectionTarget?: boolean;  // person as a protected good (standards language!)
  // Severity: the asset's physicalImpact or the endangers edges of a
  // Hazard Item — not a property (see taraflow-safety-model.md)
}
```

**Important difference:**
- `isProtectionTarget = true` → person as a **protected good** per ISO 12100 (not just as an asset)
- Enables automatic documentation in standards language: *"The operator is considered a protection target according to ISO 12100."*

**Safety impact classification** (canonical scale, see `taraflow-safety-model.md`):
- `reversible_minor` / `reversible_major` - reversible injuries (e.g. minor bruising / treatment needed)
- `irreversible_minor` / `irreversible_major` - irreversible injuries (e.g. a finger / an amputation)
- `fatal` - death


### Example: Human Asset as a protection subject

Here the safety properties sit directly on the **Human Asset**. 
Every DFD element linked to this asset via `is_an` is thereby automatically recognized as part of the critical zone.

**1. Definition of the Human Asset (carrier of the information):**
Human Asset "Machine Operator"
└─ Properties: {
     isProtectionTarget: true,
   }
   // severity e.g. fatal (physical presence in the hazardous area of the CNC machine),
   // from an annotation or an endangers edge

**2. Link in the DFD (instantiation):**
External Entity "Local Operator"
└─ is_an → Human Asset "Machine Operator"
   // inherits automatically: protection target status

**3. Active effect (physical safety):**
Process "CNC Axis Control"
└─ endangers → Human Asset "Machine Operator"
   └─ safety: { relevance: 'direct', impact: 'fatal', rationale: 'Malfunction causes uncontrolled tool movement' }

### Examples

```txt
External Entity "Machine Operator"
└─ is_an → Human Asset "Machine Operator"
   └─ Properties: {
        isProtectionTarget: true,
      }
      // direct exposure to machinery hazards

Process "CNC Emergency Stop"
└─ endangers → Human Asset "Machine Operator"
   (severe injuries can occur on malfunction)

Process "Employee Location Tracking"
├─ tracks → Human Asset "Staff Members"
└─ affects_privacy → Human Asset "Staff Members"

Process "Unauthorized Access"
└─ exposes → Human Asset "Patients"
   └─ Context: {
        isProtectionTarget: true,
        // severity irreversible_major: compromise of medical device control
      }

Process "Medical Record Access"
└─ identifies → Human Asset "Patients"
```

**Note on Data Stores and Human Assets:**  
Data Stores are passive storage and have no direct "active effect" on Human Assets. The threat arises from processes that access these stores:

```
✓ CORRECT (via a process):
Process "Unauthorized Access"
└─ exposes → Human Asset "Patients"
   (this process, if compromised, exposes patients)

✓ CORRECT (via transitivity):
Data Store "Patient Database"
└─ is_an → Data Asset "Medical Records"

Process "Record Query" → reads → Data Store "Patient Database"
                                  └─ is_an → Data Asset "Medical Records"

[Optional: documentation relationship]
Data Asset "Medical Records" → belongs_to → Human Asset "Patients"

[Derived for the threat analysis]
Process "Record Query" → exposes → Human Asset "Patients"
(if the process is compromised, patients are exposed)

❌ WRONG (a Data Store cannot actively expose):
Data Store "Patient Database"
└─ exposes → Human Asset "Patients"
   (a passive store does not expose — only compromised processes do)
```

The relationship between Data Assets and Human Assets (e.g. `belongs_to`) is an **optional documentation relationship** for compliance and impact analysis, but not an active effect relationship in the sense of the STRIDE analysis.

**Note on transitive derivation:**  
Many threats to Human Assets arise from transitive chains. Example:
```
Process "Web Server" (compromised)
└─ reads → Data Store "Patient DB"
           └─ is_an → Data Asset "Medical Records"

[Documentation relationship]
Data Asset "Medical Records"
└─ belongs_to → Human Asset "Patients"

While the direct relationships are modeled explicitly, the actual
threat to the Human Asset arises from the compromised component.
The documentation relationship Data Asset → Human Asset helps with the impact analysis
but is not an active effect relationship.

Resulting threat:
→ Process "Web Server" [derived via transitivity] → exposes → Human Asset "Patients"
```

---

## CIANAAA security goals and asset relationships

### Extending STRIDE

While STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) is a proven framework for threat modeling, **CIANAAA** offers a more precise mapping to asset relationships and safety aspects:

**CIANAAA:**
- **C**onfidentiality
- **I**ntegrity
- **A**vailability
- **N**on-Repudiation
- **A**uthentication
- **A**uthorization
- **A**ccountability

### Mapping: security goal → asset relationship → threat

This table shows which asset relationships endanger which security goals and how attack tree branches result from them:

| Security goal | Primary asset relationships | Attack tree branch logic | Safety relevance |
|------------|---------------------------|--------------------------|-----------------|
| **Confidentiality** | `reads`, `transports` | Eavesdropping on data flows, reading out storage | ⚠️ For PII/medical data |
| **Integrity** | `modifies`, `creates` | Manipulation of data, injection of false values | ⭐ **Critical for safety!** |
| **Availability** | `deletes`, `stores`, `transports`, `depends_on` | DoS, blocking, resource exhaustion | ⭐ **Critical for safety!** |
| **Non-Repudiation** | `deletes`, `modifies` (on logs) | Manipulation of audit trails, denial of actions | ⚠️ Compliance-relevant |
| **Authentication** | `creates`, `transports` | Spoofing, identity theft, session hijacking | ⭐ **Gateway to safety assets** |
| **Authorization** | `modifies`, `reads` (on permissions) | Privilege escalation, bypassing access controls | ⭐ **Gateway to safety assets** |
| **Accountability** | `deletes`, `modifies` (on logs) | Hiding the perpetrator's identity, destroying audit data | ⚠️ Forensics-relevant |

### CIANAAALevel — protection levels

Security goals are not set in a binary way (active/inactive) but weighted with a **protection level** (protection strength):

| Level      | Meaning                                           | Threat generation   |
|------------|---------------------------------------------------|---------------------|
| `none`     | Not applicable or not rated                       | No threat           |
| `low`      | Protection required, low risk                     | Impact = Low        |
| `medium`   | Medium protection need                            | Impact = Medium     |
| `high`     | High protection need                              | Impact = High       |
| `critical` | Protection existential (safety-relevant)          | Impact = Critical (override) |

The level is **derived deterministically** — the analyst does not set it directly but confirms or corrects the system suggestion.

### Cause mechanisms — analyst input

Instead of configuring CIANAAA dimensions directly, the analyst chooses **cause mechanisms** in plain language. The system derives the CIANAAA dimension and level internally:

| Cause mechanism           | CIANAAA dim   | Relevant impact criteria                                            |
|---------------------------|---------------|---------------------------------------------------------------------|
| Content Manipulation      | Integrity (I) | safety, operational, financial_damage, regulatory_compliance        |
| Unavailability / Outage   | Availability (A) | operational, recoverability                                      |
| Content Disclosure        | Confidentiality (C) | regulatory_compliance, financial_damage, reputation           |
| Identity Abuse            | Authentication (AuthN) | safety, operational, regulatory_compliance               |
| Unauthorized Access       | Authorization (AuthZ) | safety, operational, regulatory_compliance, financial_damage |
| Missing Evidence          | Non-Repudiation (N) | regulatory_compliance                                        |
| Missing Accountability    | Accountability (Acc) | regulatory_compliance, operational                          |

### Derivation pipeline

```
1. DFD relations → BASE_RULES[assetGroup:relationType] → applicable SecurityGoalTypes
   (assetGroup-aware; e.g. "data:stores" → [I, A], "system:controls" → [I, A, AuthZ])

2. CIANAAA_APPLICABLE[assetGroup] → filters dimensions unsuitable for the category
   (e.g. AuthN/AuthZ not on the data level, N not on the infrastructure level)

3. Cause mechanism × MAX(relevant impact criteria) → CIANAAALevel
   Fallback: MAX(all impactRatings) if no specific criteria are rated
   Absolute minimum: "low" — never "none" for graph-suggested goals

4. source: "suggested" (graph) | "manual" (analyst override)
   Rationale: mandatory if source === "manual" (IEC 62443-4-1 audit trail)
```

### CIANAAA_APPLICABLE — category filter

Which CIANAAA dimensions are conceptually applicable to which asset category:

| Category       | C  | I  | A  | N  | AuthN | AuthZ | Acc |
|----------------|----|----|----|----|-------|-------|-----|
| Data           | ✓  | ✓  | ✓  | ✓  | ✗     | ✗     | ✓   |
| Function       | ✗  | ✓  | ✓  | ✓  | ✓     | ✓     | ✓   |
| Process        | ✗  | ✓  | ✓  | ✓  | ✓     | ✓     | ✓   |
| System         | ✓  | ✓  | ✓  | ✗  | ✓     | ✓     | ✓   |
| Infrastructure | ✓  | ✓  | ✓  | ✗  | ✓     | ✓     | ✗   |
| Physical       | ✗  | ✓  | ✓  | ✗  | ✗     | ✗     | ✓   |
| Service        | ✓  | ✓  | ✓  | ✓  | ✓     | ✓     | ✓   |
| Human          | ✓  | ✗  | ✗  | ✗  | ✓     | ✓     | ✓   |

> **Reasoning:** AuthN/AuthZ on the data level are handled on the element level (not on the asset itself).  
> N on System/Infrastructure: no audit trail concept on this level.  
> I/A on Human: people are protection targets (ISO 12100), not data containers.

### Safety-critical security goals

For safety-relevant systems (e.g. machinery under the Machinery Regulation 2027) **three security goals are especially critical:**

#### 1. Integrity

**Why critical:**  
Manipulation of safety parameters or logic leads directly to hazards.

**Asset relationships:**
- `modifies` → safety parameters, configuration, control logic
- `creates` → false commands, forged sensor values

**Example:**
```
Threat: manipulation of the emergency stop configuration
├─ Security goal: Integrity
├─ Asset relationship: Process "Config Manager" → modifies → Data Asset "Emergency Stop Parameters"
└─ Attack tree branch:
    ├─ attacker gains access to the Config Manager (authentication bypass)
    ├─ bypasses authorization (authorization failure)
    └─ changes safety parameters (integrity violation)
        → Safety impact: fatal
```

#### 2. Availability

**Why critical:**  
Failure of safety functions on demand = hazard.

**Asset relationships:**
- `deletes` → deleting safety data
- `depends_on` → cascading failure through dependencies
- `transports` → blocking critical communication

**Example:**
```
Threat: DoS on safety communication
├─ Security goal: Availability
├─ Asset relationship: Data Flow "Safety Signal" → transports → Data Asset "Stop Command"
└─ Attack tree branch:
    ├─ attacker floods the network (network DoS)
    └─ safety signal does not get through (availability violation)
        → Safety impact: irreversible injury
```

#### 3. Authentication & authorization (access protection)

**Why critical:**  
Gateway to safety assets — without them, integrity and availability cannot be protected.

**Asset relationships:**
- All relationships to safety assets need strong authentication/authorization

**Example:**
```
Threat: unauthorized access to the safety control
├─ Security goal: Authentication + Authorization
├─ Asset relationship: External Entity "Maintenance Interface" → uses [hardware] → System Asset "Safety PLC"
└─ Attack tree branch:
    ├─ attacker uses an unsecured USB port (authentication: none)
    ├─ gets full access (authorization: admin)
    └─ can now attack integrity and availability
        → Safety impact: fatal (potentially)
```

### Automatic threat generation

Based on this mapping, TARAflow can generate threats automatically:
```typescript
interface ThreatGenerationRule {
  schutzziel: CIANAAA;
  assetRelation: RelationType;
  threatTemplate: string;
  safetyRelevant: boolean;
}

const rules: ThreatGenerationRule[] = [
  {
    schutzziel: 'Integrity',
    assetRelation: 'modifies',
    threatTemplate: 'Unauthorized modification of {assetName} via {dfdElement}',
    safetyRelevant: true  // if the asset is safety-relevant
  },
  {
    schutzziel: 'Availability',
    assetRelation: 'depends_on',
    threatTemplate: 'Cascading failure: {dfdElement} unavailable affects {assetName}',
    safetyRelevant: true
  },
  // ... further rules
];
```

### Prioritization by security goal

Not all security goal violations are equally critical:

**For safety systems (machines, medical devices):**
1. **Integrity** - highest priority (direct manipulation)
2. **Availability** - very high priority (failure on demand)
3. **Authentication/Authorization** - high priority (gateway)
4. **Accountability** - medium priority (forensics)
5. **Confidentiality** - variable priority (depends on the data)
6. **Non-Repudiation** - low priority (unless required by regulation)

**For IT systems (business-critical):**
1. **Confidentiality** - highest priority (data protection)
2. **Integrity** - very high priority (data quality)
3. **Availability** - high priority (business continuity)
4. **Authentication/Authorization** - high priority (access control)
5. **Accountability** - medium priority (compliance)
6. **Non-Repudiation** - variable priority (depending on context)

### Integration into attack trees

CIANAAA security goals structure attack trees logically:

```txt
[Root] Endangering the asset "Emergency Stop Logic"
│
├─ [Branch 1: Integrity Violation]
│  ├─ Sub-goal: Authentication Bypass
│  ├─ Sub-goal: Authorization Escalation
│  └─ Final: Modify Emergency Stop Parameters
│
├─ [Branch 2: Availability Violation]
│  ├─ Sub-goal: Network Access
│  └─ Final: DoS on Safety Communication
│
└─ [Branch 3: Confidentiality] (low priority for safety)
   └─ Information Disclosure (only relevant for reverse engineering)
```

### Documentation gain (EN 50742)

The CIANAAA structure enables precise documentation:

> *"The system protects the **integrity** of safety-related data through authentication and authorization controls at all interfaces with `modify` relationships to safety assets. **Availability** of safety functions is ensured through redundancy and monitoring of `depends_on` relationships."*

### Summary

| Aspect | STRIDE | CIANAAA |
|--------|--------|---------|
| **Granularity** | 6 categories | 7 security goals |
| **Asset mapping** | Indirect | Direct |
| **Safety focus** | Weak | Strong (I, A) |
| **Attack tree integration** | Complex | Natural |
| **Standards conformance** | Good | Very good (ISO 27001, IEC 62443) |

**Recommendation:** CIANAAA as the primary framework, STRIDE as a complementary perspective.

---

## Transitivity and derived relationships

### The concept

If a DFD element interacts with another DFD element that in turn has an `is_an` relationship to an asset, a **mathematically unambiguous transitive relationship** results:

```
Data Store "User DB" IS_AN Data Asset "User Records"
Process "Login" reads Data Store "User DB"
────────────────────────────────────────────────────
∴ Process "Login" reads Data Asset "User Records" [DERIVED]
```

### Why transitivity matters

**For TARA:**

- ✅ prevents "blind spots" (overlooked asset threats)
- ✅ complete threat coverage across all system levels
- ✅ compliance evidence (ISO 21434, IEC 62443)

**Risks without transitivity:**

- ❌ threats are only detected on the DFD element level, not on the asset level
- ❌ regulatory requirements (e.g. GDPR for PII assets) are overlooked
- ❌ incomplete impact rating

### Semantic rule for transitive derivations

Not every relationship is semantically suitable to be derived transitively
across an `is_an` bridge.

**Basic rule:**  
Only relationships that describe a **substantive effect on the asset itself**
may be propagated.

Relationships that concern **operation, monitoring, state, availability
or infrastructure** are **not** propagated, since they affect the
carrier of the asset, not the asset itself.

**Examples:**

✓ Substantive propagation:  
Process --reads--> Data Store --is_an--> Data Asset  
⇒ Process --reads--> Data Asset  

✗ No propagation:  
Process --monitors--> Data Store --is_an--> Data Asset  
⇒ **NO derivation**  
*(what is monitored is the service, not the information)*

This rule is implemented technically by an **asset-group-specific
allow list** of derivable relationship types
(see section "Graph algorithm").

### Hybrid approach: assisted, but not automatic

**Principle**: the system **computes** derived relationships, but the user **confirms** them.

```typescript
interface DerivedRelation {
  id: string;
  dfdElementId: string;      // Process "Login"
  assetId: string;           // Data Asset "User Records"
  relationType: string;      // 'reads'
  
  // Derivation metadata
  derivedFrom: string;       // Data Store "User DB" ID
  bridgeRelation: string;    // is_an relation ID
  status: 'pending' | 'confirmed' | 'rejected';
  
  // Optional: scope refinement
  scope?: {
    attributes?: string[];   // only certain asset attributes
    qualifier?: string;      // additional context
    restrictions?: string;   // restrictions
  };
  
  // Audit trail
  derivedAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
}
```

### UI workflow for derived relationships

#### 1. Discovery mode (automatic)

```
User links: Data Store "User DB" → is_an → Data Asset "User Records"
                                                ↓
System scans: Which processes access "User DB"?
               - Process "Login" → reads
               - Process "Profile Display" → reads
               - Process "Admin Panel" → modifies
                                                ↓
System generates: 3 derived relationships (status: pending)
```

#### 2. Visualization

Derived relationships are shown **visually distinguishable**:

```
Process "Login"
├─ reads → Data Store "User DB"           [solid line]
└─ 🪄 reads → Data Asset "User Records"   [dashed line, grey]
   └─ Status: Pending ⏸️
```

**Visual indicators:**
- 🪄 = derived (magic wand icon)
- ✓ = confirmed (green dashed line)
- ✗ = rejected (not shown)
- ⚠️ = needs review (orange)

#### 3. Action buttons

```
┌─────────────────────────────────────────────────────────┐
│ Process "Login" → Data Asset "User Records"            │
│ Derived from: Data Store "User DB" (is_an)             │
│                                                         │
│ [✅ Accept] [❌ Ignore] [🔍 Define scope]               │
└─────────────────────────────────────────────────────────┘
```

**Actions:**
- **Accept**: status → 'confirmed', the relationship is anchored firmly in the model
- **Ignore**: status → 'rejected', hidden (important for noise reduction!)
- **Define scope**: the user specifies which parts of the asset are affected
#### 4. Scope editor (refinement)

```
Which attributes of "User Records" does Process "Login" read?

Data Asset "User Records" contains:
☐ user_id
☐ username
☐ password_hash
☐ email
☐ phone_number
☐ payment_info
☐ medical_data

User chooses: ☑ user_id, ☑ username, ☑ password_hash

Scope saved: {attributes: ["user_id", "username", "password_hash"]}
```

### Separate storage (CRITICAL!)

Derived relationships are stored **separately** from explicit relationships:

**Why separate?**
1. **Update propagation**: if the bridge relationship is deleted → recompute all derivations
2. **Audit trail**: traceability of how the relationship came about
3. **Performance**: no filter logic on every query
4. **Rollback**: the user can undo a confirmation

```
// WRONG - disaster waiting to happen
interface AssetRelation {
  isDerived?: boolean;  // ❌ mixes explicit and derived
}

// RIGHT - separate data structures
database/
  ├─ explicit_relations/
  │    └─ {id, dfdElementId, assetId, relationType, ...}
  └─ derived_relations/
       └─ {id, dfdElementId, assetId, relationType, derivedFrom, status, ...}
```

### Graph algorithm

```typescript
// Defines which relationships are semantically "substantive" enough
// to be propagated across an is_an bridge.
// Non-substantive relations (e.g. monitors, controls) are deliberately excluded.
const DERIVABLE_RELATIONS: Record<AssetGroup, Set<string>> = {
  data: new Set(['creates', 'reads', 'modifies', 'deletes', 'stores']),
  process: new Set(['executes', 'invokes', 'monitors']),
  system: new Set(['uses', 'depends_on', 'monitors', 'configures']),
  human: new Set(['affects_safety', 'affects_privacy', 'identifies', 'tracks', 'exposes'])
};

function deriveRelations(graph: TaraGraph): DerivedRelation[] {
  const derived: DerivedRelation[] = [];
  
  // Find all is_an relationships (the "bridges")
  const bridges = graph.relations.filter(r => r.relationType === 'is_an');
  
  for (const bridge of bridges) {
    // bridge: DFD element X → is_an → asset A
    
    // Find all elements that access X
    const accessors = graph.relations.filter(r => 
      r.assetId === bridge.dfdElementId && 
      r.relationType !== 'is_an'
    );
    
    for (const accessor of accessors) {
      // Check whether this relation is derivable for this asset group
      const asset = graph.assets.find(a => a.id === bridge.assetId);
      if (!asset) continue;
      
      const isDerivable = DERIVABLE_RELATIONS[asset.group]?.has(accessor.relationType);
      if (!isDerivable) {
        console.debug(`Skipping non-derivable relation: ${accessor.relationType} for ${asset.group}`);
        continue;
      }
      
      // accessor: element Y → [relationType] → element X
      // derivation: element Y → [relationType] → asset A
      
      // Check whether it already exists (avoids duplicates)
      const existingExplicit = graph.relations.find(r =>
        r.dfdElementId === accessor.dfdElementId &&
        r.assetId === bridge.assetId &&
        r.relationType === accessor.relationType
      );
      
      if (!existingExplicit) {
        derived.push({
          id: generateId(),
          dfdElementId: accessor.dfdElementId,
          assetId: bridge.assetId,
          relationType: accessor.relationType,
          derivedFrom: bridge.dfdElementId,
          bridgeRelation: bridge.id,
          status: 'pending',
          derivedAt: new Date()
        });
      }
    }
  }
  
  return derived;
}
```

**Why an allow list?**

Not all relationships make sense transitively:
- ❌ `terminates` on Data Store → asset (meaningless)
- ❌ `controls` on Process → asset (not transitive)
- ✅ `reads` on Data Store → Data Asset (meaningful)
- ✅ `uses` on System → System Asset (meaningful)

The allow list prevents meaningless derivations and keeps the system maintainable for future extensions.

### Advanced features

#### Bulk actions

```
You have 12 derived relationships for "Process Login":

[✅ Accept all] [❌ Ignore all] [🔍 Review individually]
```

#### Smart suggestions

```
💡 The similar Process "User Registration" has confirmed this relation.
   Accept it for "Login" as well?
   
   [Yes, accept] [No, review manually]
```

#### Conflict resolution

```
⚠️ Conflict detected:
   - Explicit relation: Process "Login" → reads → Data Asset "User Records"
   - Derived relation: Process "Login" → reads → Data Asset "User Records"
   
   Action: the derived relation is automatically marked as 'confirmed'
```

### Example: complete chain

```
[Explicit relationships]
External Entity "Admin User"
└─ is_an → Human Asset "System Administrator"

Process "Admin Panel"
└─ affects_safety → Human Asset "System Administrator"
   (on malfunction, wrong commands can be executed)


Data Store "User DB"
└─ is_an → Data Asset "User Credentials"

Process "Login Service"
├─ creates → Data Asset "Session Token"
└─ reads → Data Store "User DB"


[Derived relationships]
Process "Login Service"
└─ 🪄 reads → Data Asset "User Credentials"
   ├─ Status: Pending
   ├─ Derived from: Data Store "User DB" (is_an)
   └─ Action: [✅ Accept with scope: {user_id, password_hash}]


[Threat analysis result]
Process "Admin Panel":
- affects_safety on "System Administrator" [explicit]
  → Threat: unintended system damage through faulty admin actions

Process "Login Service":
- Information disclosure on "User Credentials" [derived, confirmed]
  → Threat: credential leakage through process memory
```

---

## Attack tree generation from asset relationships

### Concept: asset relationships as attack paths

Asset relationships in the DFD are not just documentation — they are **potential attack paths**. TARAflow uses the DFD graph to generate attack tree branches automatically.

**Basic principle:**
```
Security goal (goal) → asset relationship (path) → DFD element (branch) → External Entity (entry point)
```

### From security goals to branches

For every asset with a defined security goal (integrity, availability, etc.) the relevant attack paths can be derived systematically:

**Algorithm:**
```typescript
function generateAttackTreeBranches(
  asset: Asset,
  protectionGoal: CIANAAA
): AttackTreeBranch[] {
  
  // 1. Identify relevant asset relationships based on the security goal
  const relevantRelations = getRelevantRelations(asset, protectionGoal);
  
  // 2. For every relationship: find the path to the External Entity
  const branches: AttackTreeBranch[] = [];
  
  for (const relation of relevantRelations) {
    const path = findPathToExternalEntity(relation.dfdElementId, asset.id);
    
    branches.push({
      goal: `Violate ${protectionGoal} of ${asset.name}`,
      path: path,
      feasibility: calculateFeasibility(path),
      barriers: identifyBarriers(path),
      impact: asset.physicalImpact || asset.businessImpact
    });
  }
  
  return branches;
}

function getRelevantRelations(
  asset: Asset, 
  goal: CIANAAA
): AssetRelation[] {
  
  const mapping = {
    'Integrity': ['modifies', 'creates'],
    'Confidentiality': ['reads', 'transports'],
    'Availability': ['deletes', 'stores', 'transports', 'depends_on'],
    'Authentication': ['creates', 'transports'],
    'Authorization': ['modifies', 'reads'],
    'Accountability': ['deletes', 'modifies'],
    'NonRepudiation': ['deletes', 'modifies']
  };
  
  const relevantTypes = mapping[goal] || [];
  
  return graph.relations.filter(r => 
    r.assetId === asset.id && 
    relevantTypes.includes(r.relationType)
  );
}
```

### Step-by-step example

#### Starting point:
```
Asset: "Emergency Stop Configuration" (safety-critical, impact: fatal)
Security goal: Integrity
```

#### Step 1: find direct branches
```
Search: Which DFD elements have a 'modifies' or 'creates' relationship?

Result:
├─ Process "Configuration Manager" → modifies → Asset "Emergency Stop Configuration"
└─ Process "Firmware Update" → modifies → Asset "Emergency Stop Configuration"
```

#### Step 2: indirect paths (via transport)
```
Search: Which data flows lead to these processes?

Result:
├─ Data Flow "Config Data" → transports → (leads to) Process "Configuration Manager"
└─ Data Flow "Update Package" → transports → (leads to) Process "Firmware Update"
```

#### Step 3: entry points (External Entities)
```
Search: follow the path back to the External Entity

Result:
├─ External Entity "Maintenance Laptop" → uses [hardware] → Interface "USB Port" 
│  → Process "Configuration Manager" → modifies → Asset
│
└─ External Entity "Update Server" → uses [network] → Interface "Ethernet" 
   → Process "Firmware Update" → modifies → Asset
```

#### Step 4: attack tree structure
```
[Root goal] Violate Integrity of "Emergency Stop Configuration"
│
├─ [Branch 1: via maintenance interface]
│  ├─ Entry point: External Entity "Maintenance Laptop" [F: Low - physical access]
│  ├─ Interface "USB Port" [B: Medium - no authentication]
│  ├─ Process "Configuration Manager" [B: Low - weak access control]
│  └─ modifies → Asset [I: CRITICAL - fatal]
│     → Overall risk: HIGH (low F + weak B + critical I)
│
└─ [Branch 2: via network update]
   ├─ Entry point: External Entity "Update Server" [F: Medium - network accessible]
   ├─ Interface "Ethernet" [B: High - strong encryption + auth]
   ├─ Process "Firmware Update" [B: High - signature verification]
   └─ modifies → Asset [I: CRITICAL - fatal]
      → Overall risk: MEDIUM (medium F + strong B + critical I)
```

### External Entity as threat source

External Entities serve as **entry points** (threat sources) in attack trees.
They determine the **initial feasibility (F)** of an attack tree branch:

#### Feasibility catalog

| EE category | Description | Base F | Reasoning | Example |
|--------------|--------------|---------|------------|----------|
| **Public Network** | Internet, cloud backends, remote maintenance (unencrypted) | Very high | Worldwide, anonymous access, automated script attacks possible | Cloud API without auth |
| **Corporate IT** | Company network (MES, ERP connection) | Medium | Requires an initial compromise of IT; lateral movement needed | ERP system |
| **Adjacent Wireless** | WLAN, Bluetooth, 5G campus network within range of the plant | Medium-high | Physical proximity to the site, but no building access needed | Parking lot attack |
| **Local Physical** | USB ports, on-site HMI, local service ports on the machine | Low | Physical access to the machine required (access control) | Maintenance USB |
| **Supply Chain** | Software updates from the manufacturer, firmware signing | Very low | High effort for attackers (supply chain attack), but huge impact | Signed updates |
| **Authorized Person** | Operators, maintenance staff with valid credentials | Variable | Focus on insider threat or credential theft | Service technician |

**TypeScript definition:**
```typescript
interface ExternalEntityThreatProfile {
  category: 'public_network' | 'corporate_it' | 'adjacent_wireless' | 
            'local_physical' | 'supply_chain' | 'authorized_person';
  baseFeasibility: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  rationale: string;
}

interface ExternalEntityProperties {
  // ... other properties
  threatProfile?: ExternalEntityThreatProfile;
}
```

**Use in the attack tree:**
```
External Entity "Internet" 
└─ Threat profile: { category: 'public_network', baseFeasibility: 'very_high' }
   └─ branch starts with F = very_high

External Entity "Service Technician (Physical)"
└─ Threat profile: { category: 'local_physical', baseFeasibility: 'low' }
   └─ branch starts with F = low
```

### F × B × I scoring

Every attack tree branch is rated according to the **attacker-centric model**:

**F (feasibility)** - feasibility for the attacker
- comes from the External Entity (base F)
- is reduced by barriers (B)

**B (barriers)** - obstacles on the path
- authentication (strong/weak/none)
- encryption (yes/no)
- physical barriers (access protection)
- network segmentation

**I (impact)** - effect on the asset
- safety impact (fatal > irreversible > reversible)
- business impact (financial, reputation)
- compliance impact

**Formula:**
```
Branch Risk = F - B + I

Where:
- F ∈ [0, 10] (External Entity feasibility)
- B ∈ [0, 10] (sum of all barriers on the path)
- I ∈ [0, 10] (asset impact, for safety: 10 = fatal)
```

### Several assets per DFD element

If a DFD element (e.g. a PLC) touches many assets, there are two strategies:

#### Strategy A: asset-centered trees (recommended for compliance)

**Separate attack tree per asset:**

```txt
Asset 1: "Emergency Stop Logic" [Safety: fatal]
└─ Attack tree 1 (only for this asset)

Asset 2: "Production Counter" [Business: Low]
└─ Attack tree 2 (only for this asset)
```

**Advantage:**

- clear separation by impact
- audit-ready (present only safety-critical trees)
- different security goals per asset

#### Strategy B: cluster assets (efficiency)

**Combine assets with identical impact/security goals:**
```
Asset cluster "Safety Parameters Group"
├─ Emergency Stop Config
├─ Speed Limit Config
└─ Interlock Config

→ one shared attack tree for all
```

**When to use:**

- assets are technically inseparable
- identical safety impact
- an attack always affects all of them at once

### Transitive paths in attack trees

Derived relationships feed into attack trees:
```
[Explicit]
Process "Login Service" → reads → Data Store "User DB"
Data Store "User DB" → is_an → Data Asset "User Credentials"

[Derived via transitivity]
Process "Login Service" → reads → Data Asset "User Credentials" [derived, confirmed]

[Attack tree branch]
Goal: Information Disclosure of "User Credentials"
│
├─ [Direct path] via Data Store "User DB"
│  └─ Process "Login Service" → reads → Data Store → is_an → Asset
│
└─ [Derived path] directly to the asset (confirmed)
   └─ Process "Login Service" → reads → Asset
   
→ Both paths lead to the same goal, but with different barriers!
```

### Prioritizing branches

**Automatic prioritization by:**

1. **Safety impact** (highest priority)
   - fatal / irreversible_major → CRITICAL
   - irreversible_minor → HIGH
   - reversible_minor / reversible_major → MEDIUM

2. **Feasibility × barrier gap**
   - high F + low B → very likely
   - low F + high B → unlikely

3. **Business/compliance impact**
   - only if there is no safety impact

**Example ordering:**
```
Branch 1: F=High, B=Low,  I=fatal           → Priority: 1 (CRITICAL)
Branch 2: F=High, B=High, I=fatal           → Priority: 2 (HIGH)
Branch 3: F=High, B=Low,  I=Business High   → Priority: 3 (MEDIUM)
Branch 4: F=Low,  B=High, I=fatal           → Priority: 4 (LOW - but document it!)
```

### Automatic mitigation suggestions

Based on the branch scoring:
```typescript
function suggestMitigations(branch: AttackTreeBranch): Mitigation[] {
  const suggestions: Mitigation[] = [];
  
  // high F and low B
  if (branch.feasibility >= 7 && branch.barriers <= 3) {
    suggestions.push({
      type: 'barrier_strengthening',
      target: branch.weakestBarrier,
      action: 'Implement multi-factor authentication',
      priority: 'HIGH'
    });
  }
  
  // safety impact
  if (branch.impact.safety === 'fatal') {
    suggestions.push({
      type: 'safety_critical',
      action: 'Implement independent safety monitoring',
      standard: 'ISO 13849, IEC 62061',
      priority: 'CRITICAL'
    });
  }
  
  return suggestions;
}
```

### Documentation gain (Machinery Regulation 2027 / EN 50742)

Attack tree generation from asset relationships enables:

**For the manufacturer:**
> *"Attack paths were systematically derived from the DFD asset relationships. Each branch represents a concrete threat scenario with quantified feasibility, barriers, and impact."*

**For the integrator:**
> *"The following attack trees focus on scenarios with potential safety impact. Branch priorities are based on ISO 12100 injury classifications."*

**For the auditor:**
> *"Threat analysis is reproducible and traceable. Each attack tree branch can be mapped back to specific DFD elements and asset relationships."*

### Example: complete workflow
```
1. Modeling
   └─ DFD with processes, data stores, flows, External Entities
   └─ assets with safety annotation

2. Define asset relationships
   └─ Process "Safety PLC" → modifies → Asset "Emergency Stop Config"

3. Automatic attack tree generation
   └─ the system finds all paths to this asset
   └─ computes F × B × I for every branch

4. Review & refinement
   └─ confirm the critical branches
   └─ refine the barrier rating

5. Mitigations
   └─ automatic suggestions based on branch scoring
   └─ assignment to DFD elements

6. Documentation
   └─ automatic generation of attack tree chapters
   └─ EN 50742 compliant format
```

---

## Implementation notes

### TypeScript type definitions

```typescript
// ============================================================================
// Safety annotation layer (optional for all asset relationships)
// ============================================================================

interface SafetyAnnotation {
  relevance: 'none' | 'indirect' | 'direct';
  impact?: 'none' | SafetySeverity;
  protectionTarget?: boolean;  // specifically for Human Assets
  rationale?: string;
  // The link to affected Function Assets is made via
  // asset-to-asset relationships, not as a property field
}

type AssetGroup =
  // Vertical hierarchy (ascending by degree of abstraction)
  | 'data'
  | 'function'
  | 'process'
  | 'system'
  | 'infrastructure'
  // Orthogonal categories
  | 'physical' // still to be weighed up
  | 'service'  // still to be weighed up
  | 'human';

// Qualifier for System Assets (only with 'uses')
type SystemQualifier = 'api' | 'hardware' | 'network' | 'library';

// Base interface
interface BaseAssetRelation {
  assetId: string;
  assetGroup: AssetGroup;
  
  // Safety annotation layer (optional)
  safety?: SafetyAnnotation;
}

// Asset-specific relationships (explicit)
type DataRelation = BaseAssetRelation & {
  assetGroup: 'data';
  relationType: 'creates' | 'reads' | 'modifies' | 'deletes' | 'stores' | 'transports' | 'is_an';
};

type FunctionRelation = BaseAssetRelation & {
  assetGroup: 'function';
  relationType:
    | 'implements'    // DFD element implements this function
    | 'invokes'       // DFD element invokes this function
    | 'depends_on'    // DFD element depends on this function
    | 'creates'       // function creates data asset
    | 'reads'         // function reads data asset
    | 'modifies'      // function changes data asset — safety-critical if the data is safety-relevant
    | 'deletes'       // function deletes data asset
    | 'is_an';
};

type ProcessRelation = BaseAssetRelation & {
  assetGroup: 'process';
  relationType: 'executes' | 'invokes' | 'terminates' | 'suspends' | 'monitors' | 'is_an';
};

// System relations with a qualifier for 'uses'
type SystemRelation = BaseAssetRelation & ({
  assetGroup: 'system';
  relationType: 'controls' | 'configures' | 'monitors' | 'depends_on' | 'is_an';
} | {
  assetGroup: 'system';
  relationType: 'uses';
  qualifier: SystemQualifier;  // REQUIRED for 'uses'
});

type InfrastructureRelation = BaseAssetRelation & {
  assetGroup: 'infrastructure';
  relationType: 'hosts' | 'powers' | 'connects' | 'is_an';
};

type HumanRelation = BaseAssetRelation & {
  assetGroup: 'human';
  relationType: 'affects_safety' | 'affects_privacy' | 'identifies' | 'tracks' | 'exposes' | 'is_an';
  
  isProtectionTarget?: boolean;  // ISO 12100 terminology
};

// Union of all explicit relationships
type ExplicitAssetRelation =
  | DataRelation
  | FunctionRelation
  | ProcessRelation
  | SystemRelation
  | InfrastructureRelation
  | PhysicalRelation
  | ServiceRelation
  | HumanRelation;

// Derived relationships (stored separately!)
interface DerivedAssetRelation {
  id: string;
  dfdElementId: string;
  assetId: string;
  assetGroup: AssetGroup;
  relationType: string;
  
  // Derivation context
  derivedFrom: string;       // ID of the bridge element (e.g. Data Store)
  bridgeRelation: string;    // ID of the is_an relation
  status: 'pending' | 'confirmed' | 'rejected';
  
  // Optional: refinement
  scope?: {
    attributes?: string[];
    qualifier?: string;
    restrictions?: string;
  };

  // Safety annotation (inherited from the source relation)
  safety?: SafetyAnnotation;
  
  // Audit trail
  derivedAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
}

// Helper functions
function validateRelations(
  relations: ExplicitAssetRelation[], 
  assetId: string
): boolean {
  const relationsToAsset = relations.filter(r => r.assetId === assetId);
  const hasIsAn = relationsToAsset.some(r => r.relationType === 'is_an');
  const hasOthers = relationsToAsset.some(r => r.relationType !== 'is_an');
  
  // is_an XOR other relationships
  return !(hasIsAn && hasOthers);
}

function requiresQualifier(relation: ExplicitAssetRelation): boolean {
  return relation.assetGroup === 'system' && relation.relationType === 'uses';
}

// Safety-specific helpers
function hasSafetyImpact(relation: ExplicitAssetRelation): boolean {
  return relation.safety?.impact !== 'none' && relation.safety?.impact !== undefined;
}

// Safety Override Rule: direct AND (irreversible_major | fatal)
function isSafetyCritical(relation: ExplicitAssetRelation): boolean {
  return relation.safety?.relevance === 'direct' &&
         (relation.safety?.impact === 'fatal' ||
          relation.safety?.impact === 'irreversible_major');
}

function detectSafetyBoundaryCrossing(
  sourceElement: { safetyRelevant?: boolean },
  targetElement: { safetyRelevant?: boolean }
): boolean {
  return (sourceElement.safetyRelevant && !targetElement.safetyRelevant) ||
         (!sourceElement.safetyRelevant && targetElement.safetyRelevant);
}

// Optional: asset-to-asset relationships (documentation only)
interface AssetToAssetRelation {
  sourceAssetId: string;
  targetAssetId: string;
  relationType: 'belongs_to' | 'contains' | 'depends_on';
  purpose: 'documentation' | 'compliance';
  
  // These relationships are NOT used for STRIDE
  excludeFromThreatAnalysis: true;
}

// ============================================================================
// DFD element properties (for safety marking)
// ============================================================================

interface DFDElementSafetyProperties {
  safetyRelevant?: boolean;       // element input, drives threat escalation
  safetyRationale?: string;
  // Severity is not an element property — it is rated on the asset
  // (physicalImpact, see taraflow-safety-model.md).
  // The link to affected Function Assets is made via
  // asset-to-asset relationships, not as a property field
}

interface ProcessProperties extends DFDElementSafetyProperties {
  // ... other process properties
}

interface DataStoreProperties extends DFDElementSafetyProperties {
  containsSafetyRelevantData?: boolean;
  // ... other DataStore properties
}

interface DataFlowProperties extends DFDElementSafetyProperties {
  crossesSafetyBoundary?: boolean;  // can be derived automatically
  // ... other DataFlow properties
}

interface InterfaceProperties extends DFDElementSafetyProperties {
  physicalHazardPotential?: 'low' | 'medium' | 'high';
  // ... other interface properties
}

interface ExternalEntityProperties extends DFDElementSafetyProperties {
  isProtectionTarget?: boolean;  // for human External Entities
  // ... other ExternalEntity properties
}
```

### UI behavior

1. **Dynamic relationship choice:** 
   - Available relationship types are filtered by the asset group of the selected asset
   - For System Assets with `uses`: the qualifier choice opens automatically

2. **is_an exclusivity:**
   - If the user chooses `is_an` → all other relationship types are disabled
   - If the user chooses another relationship → `is_an` is disabled
   - Per DFD element/asset pair: either `is_an` **or** 1-n impact relationships
   - On choosing `is_an` → the system automatically triggers the computation of derived relationships

3. **Enforcing the qualifier for System Assets:**
   ```
   User chooses: Process "API Gateway" → uses → System Asset "Auth Service"
                                               ↓
   UI blocks: "Please choose a qualifier:"
                 ○ api        - API/REST/RPC call
                 ○ network    - network communication
                 ○ hardware   - physical access
                 ○ library    - shared library
   ```

4. **Data Flow validation:**
   - When creating a Data Flow: automatic prompt to assign assets
   - Warning for incomplete flows: ⚠️ "No assets transported"
   - Smart suggestions based on the source/target element

5. **Derived relationships:**
   - Visualization with dashed lines and icons (🪄/✓/✗)
   - Action buttons: Accept / Ignore / Define scope
   - Bulk actions for several derivations
   - Notification when new derivations are available

6. **Multiple relationships:** 
   A DFD element can have several impact relationships to the same asset (except with `is_an`)
   ```
   Process "User Service"
   ├─ creates → Data Asset "User Profile"
   ├─ reads → Data Asset "User Profile"
   └─ modifies → Data Asset "User Profile"
   ```

7. **Conflict resolution:**
   - Warning if an explicit and a derived relationship are identical
   - Automatic marking of the derivation as 'confirmed'
   - The user can refine the scope afterwards

---

## Critical design decisions — summary

### 1. Semantic overlap for System Assets (solved)

**Problem:** `uses` was too vague for a precise threat analysis.

**Solution: active-impact model**
- `uses [qualifier]` → attack vector (likelihood)
- `depends_on` → cascading effect (impact)

**Implementation:**
```typescript
// Process "API Gateway" accesses the Auth Service
{
  relationType: 'uses',
  qualifier: 'network',  // REQUIRED
  // → Threat: man-in-the-middle, eavesdropping
}

// Process "API Gateway" fails if the Auth Service fails
{
  relationType: 'depends_on'
  // → Threat: denial of service, cascading failure
}
```

### 2. Redundancy of `transports` (solved)

**Problem:** Data Flows transport data by definition → apparent redundancy.

**Solution: explicit with UI support**
- Every Data Flow must explicitly declare which assets are transported
- The UI makes this easy with smart suggestions
- Enables a precise threat analysis per asset on the communication path
- Critical for transitivity chains

**Why it matters:**
- "HTTPS Request" can contain `Password` OR `Language Setting`
- Different criticality → different threats
- Automatic STRIDE generation per asset

### 3. Transitivity (solved)

**Problem:** relationships across several levels are overlooked.

**Solution: hybrid approach**
- The system **computes** derived relationships (mathematically unambiguous via `is_an`)
- The user **confirms** them (prevents alert fatigue + compliance evidence)
- **Separate storage** (critical for maintainability)

**Advantages:**
- ✅ no blind spots
- ✅ complete threat coverage
- ✅ the user stays in control
- ✅ compliance-ready (audit trail)

Propagation happens only for semantically substantive relationships; 
state or infrastructure relations are deliberately not derived.

### 4. Validation rules (edge cases)

**Important restrictions:**
- `is_an` only for representative DFD elements (e.g. only External Entities for System Assets)
- Data Flows may only use `transports` and `is_an`
- Bidirectional communication should be modeled as separate flows
- See section "Validation rules and edge cases" for details

### 5. Basic assumptions

**Made explicit:**
- **DFD-to-DFD relationships** exist in the DFD itself and are the basis for derivations
- **Asset-to-asset relationships** are optional for documentation/compliance (not for STRIDE)
- **Threats** often arise through transitive chains (see section "Basic assumptions")

---

## Basic assumptions and concepts

### DFD-to-DFD vs. DFD-to-asset relationships

This document defines **DFD element → asset relationships**. Alongside, **DFD-to-DFD relationships** exist implicitly in the data flow diagram:

```
DFD-to-DFD (in the DFD itself):
- Process "Login" → reads from → Data Store "User DB"
- External Entity "User" → sends data to → Process "API Gateway"
- Process "Service A" → communicates with → Process "Service B"

DFD-to-asset (defined in TARAflow):
- Process "Login" → reads → Data Asset "User Credentials"
- Data Store "User DB" → is_an → Data Asset "User Credentials"
```

**Important:** 
- DFD-to-DFD relationships are the **foundation** for asset derivations
- Transitivity uses DFD-to-DFD connections + `is_an` bridges
- DFD-to-DFD relationships are captured by the DFD drawing tool (draw.io)

### Asset-to-asset relationships (documentation purpose)

**Rule:** In principle, the relationships describe **DFD element → asset**.

**Exception:** For documentation purposes, asset-to-asset relationships can exist:

```typescript
// Allowed as a documentation relationship (not an active effect):

// 1. belongs_to - data ownership/membership
Data Asset "Medical Records" → belongs_to → Human Asset "Patients"
Data Asset "Payment Info" → belongs_to → Human Asset "Customers"

// 2. contains - hierarchical structures
Data Asset "Complete Patient File" → contains → Data Asset "Lab Results"
Data Asset "Complete Patient File" → contains → Data Asset "Diagnoses"
System Asset "Kubernetes Cluster" → contains → System Asset "Worker Nodes"

// 3. depends_on - architecture dependencies on the asset level
Data Asset "Monthly Sales Report" → depends_on → Data Asset "Daily Transaction Logs"
System Asset "Frontend Architecture" → depends_on → System Asset "API Gateway"
Process Asset "Order Fulfillment" → depends_on → Process Asset "Inventory Check"

// These relationships:
// ✓ document data ownership/membership
// ✓ support compliance (GDPR: which data concerns which persons?)
// ✗ are NOT active effect relationships
// ✗ are NOT used for the STRIDE analysis
```

**Use:**
**`belongs_to`:**
- automatic generation of data protection reports
- GDPR compliance: "show all Data Assets concerning patients"
- impact analysis: "If this Data Asset is compromised, which Human Assets are affected?"

**`contains`:**
- documentation of asset hierarchies and structures
- visualization of complex system architectures
- completeness check: "Are all parts of the system modeled?"

**`depends_on`:**
- architecture documentation on the logical level
- difference to the DFD-level `depends_on`: this is a conceptual dependency, not a runtime dependency
- example: "Payment Processing Workflow" (asset) depends conceptually on "Fraud Detection Workflow" (asset), 
  even if concrete processes in the DFD model the runtime dependency

**Important:** These relationships are to be stored and managed **separately** from the DFD element → asset relationships.

### Threats arising through transitivity

Threats to assets often do not arise directly but through chains:

```
Example: how a patient is exposed

[Active threat]
External Entity "Hacker"
└─ compromises → Process "Web Server"

[Transitive chain]
Process "Web Server" (compromised)
└─ reads → Data Store "Patient DB"
           └─ is_an → Data Asset "Medical Records"
                     └─ [documented] belongs_to → Human Asset "Patients"

[Resulting threat]
→ Human Asset "Patients" is exposed by the compromised web server
  (information disclosure via compromised process)
```

The `belongs_to` documentation relationship helps complete the **final impact analysis** but is not an active effect of the Data Store.

---

## Asset impact rating — Safety Override Rule

### The problem with averages

When rating asset impact, a simple mean of physical and business factors could "whitewash" a high physical risk with low business impact:
```
❌ WRONG (average):
Asset "Emergency Stop Button"
├─ Physical factor: fatal (10/10)
├─ Business factor: low (2/10) - cheap component
└─ Average impact: medium (6/10)

→ A critical safety asset is underestimated!
```

**Basic principle (EN 50742, ISO 12100):**
> A human life cannot be offset against downtime costs.

### Safety override rule

**Rule:**  
If an asset has a physical factor >= "severe injury":
```
IF physicalImpact ∈ { 'fatal', 'irreversible_major' }
   AND relevance === 'direct'
THEN aggregatedCriticality := CRITICAL
     strideDepth            := 'in-depth'
     riskPriority           := 1

IF physicalImpact ∈ { 'fatal', 'irreversible_major' }
   AND relevance === 'indirect'
THEN aggregatedCriticality := MAX(businessImpact, HIGH+)
     strideDepth            := 'focused'
     riskPriority           := 2

IF physicalImpact === 'irreversible_minor'
THEN aggregatedCriticality := HIGH+ (direct) / HIGH (indirect)

Reasoning:
  Severity is a property of the harm — not of the asset.
  An asset that influences fatal harm only systemically (indirect) has no
  immediate control over it. The override rule therefore requires direct relevance.
```

**Independent of** business factors, reputation factors or other categories.

### Aggregation matrix

The matrix shows how business impact and safety impact together lead to the
aggregated asset criticality. `relevance` acts as a damper:
the full override only applies with direct control responsibility.

| Business impact | Safety impact | relevance | Aggregated |
|---|---|---|---|
| any | HIGH (fatal / irreversible_major) | direct | **CRITICAL** |
| any | HIGH (fatal / irreversible_major) | indirect | **HIGH+** |
| any | irreversible_minor | direct | **HIGH+** |
| any | irreversible_minor | indirect | **HIGH** |
| CRITICAL | – or MED | – | **CRITICAL** |
| HIGH | MED (indirect, hop 1) | – | **HIGH** |
| HIGH | – | – | **HIGH** |
| MEDIUM | MED (indirect, hop 1) | – | **MEDIUM+** |
| MEDIUM | – | – | **MEDIUM** |
| LOW | MED (indirect, hop 1) | – | **MEDIUM** |
| LOW | – | – | **LOW** |

> **Note on HIGH+/MEDIUM+:** These intermediate values mean "upper end of the level"
> and can escalate to CRITICAL/HIGH through high likelihood in the risk table.
> The final risk rating results from impact × likelihood — not from the
> aggregated criticality value alone.

---

## Business & physical impact factors — applicability by asset category

Legend: ✅ suitable · ⚠️ conditionally suitable · ➖ not applicable

| Factor | Data | Function | System | Infra | Physical | Process | Service | Human |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Financial Damage** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ |
| **Regulatory / Compliance** | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ |
| **Reputation / Brand** | ✅ | ⚠️ | ✅ | ⚠️ | ➖ | ⚠️ | ✅ | ➖ |
| **Privacy / Data Protection** | ✅ | ⚠️ | ⚠️ | ➖ | ➖ | ⚠️ | ✅ | ✅ |
| **Operational Impact** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| **Affected Users / Systems** | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ➖ |
| **Recoverability** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ |
| **Safety Impact** | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ |
| **Physical Asset Damage** | ➖ | ➖ | ✅ | ✅ | ✅ | ➖ | ➖ | ➖ |
| **Environmental Impact** | ➖ | ➖ | ⚠️ | ✅ | ✅ | ⚠️ | ➖ | ➖ |
| **Supply Chain / Logistics** | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ➖ |

> **Explanations of ⚠️ entries:**
> - **Safety impact on Data** – only if the asset directly configures safety-critical processes (e.g. NC programs, safety parameters)
> - **Safety impact on Function / Service** – only if `isSafetyCritical: true` is set
> - **Regulatory on Physical / Human** – only for GDPR-relevant personal data or regulated physical goods
> - **Privacy on Process / Function** – only if personal data is processed
> - **Supply chain on Data / Service** – only if the asset directly controls supply chain processes (e.g. order data, ERP interfaces)

> **Note for TARAflow:** The project-wide selection of 5–6 factors applies globally to all assets.
> ⚠️ fields are context-dependent – the analyst decides per asset whether the factor applies.
> ➖ fields are hidden automatically in the UI.

---

### Implementation
```typescript
// Simplified illustration. The implemented rule (with relevance) is
// deriveAggregatedImpact — see taraflow-safety-model.md.
interface AssetImpact {
  physicalFactors: {
    injury: 'none' | SafetySeverity;
    score: number;  // 0-10
  };
  businessFactors: {
    financialLoss: number;
    downtime: number;
    score: number;  // 0-10
  };
  // ... further factors
}

function calculateFinalImpact(impact: AssetImpact): ImpactLevel {
  // Safety override check
  if (impact.physicalFactors.injury === 'fatal' ||
      impact.physicalFactors.injury === 'irreversible_major') {
    return 'CRITICAL';
  }
  
  if (impact.physicalFactors.injury === 'irreversible_minor') {
    return 'HIGH';
  }
  
  if ((impact.physicalFactors.injury === 'reversible_minor' ||
       impact.physicalFactors.injury === 'reversible_major') && 
      impact.physicalFactors.score >= 7) {
    return 'HIGH';
  }
  
  // Only without safety impact: normal calculation
  return calculateWeightedAverage(impact);
}
```

### Weighted factors (alternative to the override)

If you need a more nuanced rating (e.g. for regulatory documentation), physical factors can be weighted higher:
```typescript
function calculateWeightedImpact(impact: AssetImpact): number {
  const weights = {
    physical: 2.0,   // double weight
    business: 1.0,
    reputation: 1.0,
    compliance: 1.5
  };
  
  return (
    impact.physicalFactors.score * weights.physical +
    impact.businessFactors.score * weights.business +
    // ... further factors
  ) / (weights.physical + weights.business + ...);
}
```

**But:** For safety-critical assets (fatal / irreversible injury) the **override rule** stays active.

### Examples

#### Example 1: safety-critical asset
```
Asset "Robot Control Logic"
├─ Physical factor: fatal (10/10)
│  └─ Rationale: "Malfunction can cause uncontrolled robot movement"
├─ Business factor: medium (5/10)
│  └─ Rationale: "Production downtime ~4 hours"
├─ Reputation factor: high (8/10)
│
└─ Final impact: CRITICAL
   └─ Reason: safety override (physical = fatal)
```

**Consequences:**
- highest priority in the threat analysis
- strict requirements on mitigations (e.g. multi-factor authentication)
- explicit documentation in the safety chapter
- audit trail for all changes

#### Example 2: business-critical asset (without safety)
```
Asset "Customer Database"
├─ Physical factor: none (0/10)
├─ Business factor: very high (9/10)
│  └─ Rationale: "Contains all customer orders and contracts"
├─ Reputation factor: very high (10/10)
│
└─ Final impact: HIGH
   └─ Reason: weighted average (no safety override)
```

**Consequences:**
- high priority, but not CRITICAL
- standard security measures sufficient
- normal documentation

#### Example 3: mixed impact
```
Asset "Machine Calibration Data"
├─ Physical factor: irreversible_major (8/10)
│  └─ Rationale: "Incorrect calibration → collision risk"
├─ Business factor: low (3/10)
│  └─ Rationale: "Easy to recalibrate"
├─ Compliance factor: medium (5/10)
│
└─ Final impact: HIGH
   └─ Reason: safety override (physical = irreversible injury)
```

### Safety asset flag

An asset's safety relevance is **derived**, not set as a flag (schema v9):
an asset is safety-related if it has a `physicalImpact` (from annotations, Hazard Items
or a manual override) or takes part in a Hazard Item.

```typescript
interface Asset {
  id: string;
  name: string;
  group: AssetGroup;
  
  // Safety-specific (derived / manual override with rationale)
  physicalImpact?: SafetySeverity;
}
```

**If the asset is safety-related:**
- automatic prioritization of all relationships to this asset
- `modifies` and `deletes` relationships in particular get the highest priority
- the tool shows clear warnings on changes
- audit logging is enabled

### Documentation gain (EN 50742 / Machinery Regulation 2027)

The Safety Override Rule enables the automatic generation of:

**For the integrator:**
> *"This asset has been identified as safety-critical. Any `modify` relationship to this asset requires hardened authentication according to Machinery Regulation (EU) 2023/1230."*

**For the auditor:**
> *"The manufacturer has implemented a systematic approach to prioritize safety-critical assets. Physical impact to human life takes precedence over business impact in the risk assessment."*

**For the compliance documentation:**
> *"Asset risk prioritization follows the principle that human safety is not negotiable against economic factors (ISO 12100, Clause 5.2)."*

### Summary

| Criterion | Without safety override | With safety override |
|-----------|---------------------|---------------------|
| **Rating method** | Average of all factors | Physical impact dominates |
| **Result for fatal harm** | Can become "Medium" | Always CRITICAL (with direct relevance) |
| **Standards conformance** | Questionable | ISO 12100 / EN 50742 compliant |
| **Auditor acceptance** | Low | High |
| **Implementation** | Simple (avg) | IF statement (trivial) |

**Clear recommendation:** implement the Safety Override Rule.

---

## Validation rules and edge cases

### Rule 1: `is_an` only for representative elements

**Problem:**  
A process can accidentally be linked to a System Asset with `is_an` although it actually only runs on it or depends on it.

**Example of the problem:**
```
❌ WRONG:
Process "Web Application" → is_an → System Asset "Application Server"
(A process IS NOT a server, it runs on it!)

✓ CORRECT:
External Entity "App Server Instance" → is_an → System Asset "Application Server"
Process "Web Application" → uses [api] → System Asset "Application Server"
Process "Web Application" → depends_on → System Asset "Application Server"
```

**Validation rule:**

```typescript
function validateIsAnRelation(
  dfdElement: DFDElement, 
  asset: Asset
): ValidationResult {
  
  // System Assets: only External Entities or Data Stores may be is_an
  if (asset.group === 'system') {
    if (dfdElement.type !== 'external_entity' && dfdElement.type !== 'data_store') {
      return {
        valid: false,
        error: 'Processes can only use System Assets (uses/depends_on), not represent them (is_an)'
      };
    }
  }
  
  // Data Assets: only Data Stores may be is_an
  if (asset.group === 'data') {
    if (dfdElement.type !== 'data_store') {
      return {
        valid: false,
        error: 'Only Data Stores can represent Data Assets (is_an)'
      };
    }
  }
  
  // Process Assets: only Processes may be is_an
  if (asset.group === 'process') {
    if (dfdElement.type !== 'process') {
      return {
        valid: false,
        error: 'Only Processes can represent Process Assets (is_an)'
      };
    }
  }
  
  // Human Assets: only External Entities may be is_an
  if (asset.group === 'human') {
    if (dfdElement.type !== 'external_entity') {
      return {
        valid: false,
        error: 'Only External Entities can represent Human Assets (is_an)'
      };
    }
  }
  
  return { valid: true };
}
```



### Rule 2: `is_an` is exclusive

```typescript
function validateExclusiveIsAn(
  relations: AssetRelation[], 
  dfdElementId: string,
  assetId: string
): ValidationResult {
  const relationsToAsset = relations.filter(r => 
    r.dfdElementId === dfdElementId && 
    r.assetId === assetId
  );
  
  const hasIsAn = relationsToAsset.some(r => r.relationType === 'is_an');
  const hasOthers = relationsToAsset.some(r => r.relationType !== 'is_an');
  
  if (hasIsAn && hasOthers) {
    return {
      valid: false,
      error: 'is_an must not be combined with other relationships'
    };
  }
  
  return { valid: true };
}
```

### Rule 3: system `uses` requires a qualifier

```typescript
function validateSystemUsesQualifier(
  relation: AssetRelation
): ValidationResult {
  if (relation.assetGroup === 'system' && 
      relation.relationType === 'uses' &&
      !relation.qualifier) {
    return {
      valid: false,
      error: 'A uses relationship to a System Asset requires a qualifier (api/network/hardware/library)'
    };
  }
  
  return { valid: true };
}
```

### Rule 4: Data Flows only with `transports` and `is_an`

```typescript
function validateDataFlowRelations(
  dfdElement: DFDElement,
  relation: AssetRelation
): ValidationResult {
  if (dfdElement.type === 'data_flow') {
    const allowedTypes = ['transports', 'is_an'];
    
    if (!allowedTypes.includes(relation.relationType)) {
      return {
        valid: false,
        error: `Data Flows can only have 'transports' or 'is_an' relationships, not '${relation.relationType}'`
      };
    }
  }
  
  return { valid: true };
}
```

### Rule 5: at least one asset for Data Flows

```typescript
function validateDataFlowCompleteness(
  dfdElement: DFDElement,
  relations: AssetRelation[]
): ValidationResult {
  if (dfdElement.type === 'data_flow') {
    const hasTransports = relations.some(r => 
      r.dfdElementId === dfdElement.id && 
      r.relationType === 'transports'
    );
    
    if (!hasTransports) {
      return {
        valid: false,
        warning: true,
        error: 'Data Flow has no transports relationship. Threat analysis not possible.'
      };
    }
  }
  
  return { valid: true };
}
```

### UI integration of the validation rules

**When creating a relationship:**
```
User tries: Process "API" → is_an → System Asset "Server"
                                        ↓
UI blocks: ❌ "Processes can only use System Assets or 
                  depend on them, not represent them.
                  
                  Did you mean:
                  ○ uses [network] → System Asset 'Server'
                  ○ depends_on → System Asset 'Server'"
```

**When creating a flow without assets:**
```
User creates: Data Flow "API Response"
                                        ↓
UI warns: ⚠️ "This flow does not transport any assets yet.
              Threat analysis not possible.
              
              [Assign assets]"
```

**On conflict:**
```
User tries: Process "Login" → is_an → Data Asset "User"
               (already has): Process "Login" → reads → Data Asset "User"
                                        ↓
UI blocks: ❌ "is_an cannot be combined with other relationships.
                  
                  Options:
                  • remove is_an and keep only 'reads'
                  • remove 'reads' and set is_an"
```

---

## Special scenarios

### Dual role (actor & protection subject)

A person can be an actor and a protection subject at the same time:

```
Human Asset "Machine Operator"
├─ External Entity "Operator" → is_an
│  └─ [triggers: derived relationships for all processes accessing the entity]
│
├─ Process "CNC Control" → affects_safety
│  └─ Context: direct physical control of the machine - risk of injury on malfunction
│
└─ Process "Logging Service" → affects_privacy
   └─ Scope: {tracking_data, location, work_hours}
   
[Documentation relationship]
Data Asset "Operator Logs"
└─ belongs_to → Human Asset "Machine Operator"
   (for GDPR compliance)
```

### System hierarchies with qualifiers

In distributed systems, relationships can exist on different levels:

```
System Asset "Production Environment"
├─ External Entity "Cloud Platform" → is_an
│
├─ Process "Deployment Pipeline" → configures
│
├─ Process "API Gateway" → uses [network]
│  └─ Threat: man-in-the-middle on the prod environment
│
└─ Process "Frontend App" → depends_on
   └─ Threat: cascading failure if the prod environment fails
```

### Transitivity with Data Flows

Complete chain from DFD element via flow to asset:

```
[Explicit relationships]
Process "Login Service"
├─ creates → Data Asset "Session Token"
└─ reads → Data Store "User DB"

Data Store "User DB"
└─ is_an → Data Asset "User Credentials"

Data Flow "Login Response"
├─ transports → Data Asset "Session Token" (explicitly confirmed)
└─ transports → Data Asset "User Profile"  (explicitly confirmed)


[Derived relationships]
Process "Login Service"
└─ 🪄 reads → Data Asset "User Credentials"
   ├─ Status: Pending
   ├─ Derived from: Data Store "User DB" (is_an)
   └─ Action: [✅ Accept with scope: {user_id, password_hash}]


[Threat analysis result]
Data Flow "Login Response":
- Tampering on "Session Token" → session hijacking
- Information disclosure on "User Profile" → privacy violation
- [NOT analyzed]: "User Credentials" (not transported!)

Process "Login Service":
- Information disclosure on "User Credentials" [derived, confirmed]
  → Threat: credential leakage through process memory
```
### Hierarchical asset structures with `contains`

Complex systems can be documented through asset hierarchies:

```txt
[Asset-to-asset hierarchy]
System Asset "E-Commerce Platform"
├─ contains → System Asset "Web Frontend"
├─ contains → System Asset "API Gateway"
├─ contains → System Asset "Payment Service"
└─ contains → System Asset "Database Cluster"

Data Asset "Complete Order Record"
├─ contains → Data Asset "Customer Data"
├─ contains → Data Asset "Payment Information"
├─ contains → Data Asset "Shipping Details"
└─ contains → Data Asset "Order Items"

[DFD-to-asset relationships remain independent of this]
Process "Checkout Service"
├─ creates → Data Asset "Complete Order Record"
└─ reads → Data Asset "Customer Data"

[The impact analysis uses both]
On compromise of "Complete Order Record":
→ all contained assets (via contains) are potentially affected
→ all Human Assets (via belongs_to of the sub-assets) are exposed
```

## The TARAflow advantage: end-to-end threat chains

The model allows building a fully automated
threat analysis engine that computes end-to-end chains from the
attack surface to the damage target.

A typical threat chain can:

- start at the **attack vector**  
  (e.g. `uses [API]`, `uses [Network Interface]`)
- run through **communication and dependency relationships**  
  (e.g. `transports [source_to_target]`, `depends_on`)
- and end at the **damage target**  
  (e.g. `affects_safety`, `affects_privacy`, `exposes`)

Through the clear separation of **likelihood-related relationships**
(`uses`, `transports`) and **impact-related relationships**
(`depends_on`, `affects_*`), threat paths can be derived
purely graph-based and without heuristic assumptions.

This enables a traceable, reproducible and
scalable TARA in which every threat rests on an explicit
relationship chain.

## Next development steps (roadmap)

The model is deliberately designed so that it can evolve step by step from an
assisted hazard assessment to a fully
graph-based, deterministic threat analysis. The following phases describe this evolution.

### Phase 1: modeling & assisted STRIDE analysis with safety annotation

The first phase focuses on the structured capture
of the system, an assisted STRIDE threat analysis and the
**optional** annotation of safety-relevant aspects.

**Scope:**

**1. DFD modeling**
- creating DFDs (Processes, Data Stores, External Entities, Data Flows)
- manual definition of relationships between DFD elements and assets
- optional marking of safety-relevant elements

**2. Assisted STRIDE analysis**
- **Automatic threat generation** based on:
  - STRIDE per element (e.g. Process → Tampering, Elevation of Privilege)
  - STRIDE per interaction (e.g. Data Flow → Tampering, Information Disclosure)
- **Manual control:**
  - the security engineer can accept, reject or ignore generated threats
  - own threats can be added manually
  - rating, prioritization and mitigations are done manually

**3. Safety annotation (optional)**
- The **safety annotation layer** can be enabled for:
  - DFD elements (Processes, Data Stores, Interfaces, External Entities)
  - asset relationships
  - Data Flows
- **Properties on the SafetyAnnotation (asset relation level):**
  - `relevance: "none" | "indirect" | "direct"`
  - `impact: "none" | SafetySeverity`
  - `physicalHazardPotential: "low" | "medium" | "high"` ← on the relation, not on the element
  - `protectionTarget: boolean` ← only for Human Assets
  - `affectedSafetyFunctions: FunctionAssetId[]` // ['<uuid-of-function-asset>']
  - `rationale: string`
- **Derived fields on AssetProperties (strict default, override possible):**
  - `physicalImpact` — worst of `safety.impact` over all asset relations and the
    Hazard Item chain (see `taraflow-safety-model.md`)
  - `securityGoals: SecurityGoal[]` — one entry per CIANAAA dimension with:
    - `level: CIANAAALevel` (`none | low | medium | high | critical`) — protection level
    - `source: "suggested" | "manual"` — origin of the level
    - `formalDescription: string` — binding protection requirement (audit-relevant)
    - `rationale?: string` — mandatory if `source === "manual"` (IEC 62443-4-1)
    - derived via: BASE_RULES[assetGroup:relationType] → cause mechanism × impact → CIANAAALevel
- **Derived/manual pattern:**
  ```
  Every derived field has an origin attribute:
    *Source:    "derived" (default) | "manual"
    *Rationale: string (mandatory if source === "manual")

  Example:
    physicalImpactSource:    "manual"
    physicalImpactRationale: "Assessed directly, SafetyAnnotation pending"

  In the audit report:
    source === "derived" → no documentation obligation
    source === "manual"  → rationale is documented verbatim (IEC 62443-4-1)
  ```
- **Purpose:**
  - marking safety-critical elements
  - prioritizing threats with safety impact
  - automatic documentation generation for EN 50742 / Machinery Regulation 2027

**4. Manual rating & prioritization**
- qualitative threat rating (High/Medium/Low)
- **Safety Override Rule:**
  - assets with physical impact "irreversible_major" or "fatal" and direct relevance automatically get the highest priority
  - a human life cannot be offset against business impact (ISO 12100)
- **High-value override rule:**
  - Infrastructure Assets with `isHighValueAsset === true` and `assetDestructionImpact === "critical"`
    automatically get the highest priority
  - strategically irreplaceable assets cannot be offset against normal residual risk
- incomplete modeling is allowed (quick first assessment)
- implicit assumptions are documented explicitly

**Goal:**
- building a consistent base graph (DFD + assets + relationships)
- first threat identification with the proven STRIDE method
- **optional:** documenting safety aspects without a formal safety analysis
- identifying missing or unclear relationships
- supporting the modeling process, not automating it

**What phase 1 is NOT:**
- ❌ no fully automatic threat derivation (that comes in phase 3)
- ❌ no formal safety analysis (FMEA, FTA)
- ❌ no SRSL calculation or ISO 13849 performance level
- ❌ no deterministic attack trees (that comes in phase 3)

**What phase 1 IS:**
- ✅ classic STRIDE threat modeling with tool support
- ✅ optional: safety context for later compliance documentation
- ✅ flexibility for iterative refinement
- ✅ pragmatic entry without methodological constraints

**Safety integration in phase 1:**

The safety annotation in phase 1 is deliberately **optional and non-invasive**:

- **For non-safety-relevant systems:** can be ignored completely
- **For safety-relevant systems:** enables early documentation without methodological constraints
- **No separate safety model:** safety is an additional property of the security analysis
- **Documentation preparation:** safety annotations later feed into EN 50742 / Machinery Regulation 2027 reports

**Typical workflow with safety:**
```
1. Model the DFD (as usual)
2. Mark safety-critical elements (e.g. "Safety PLC", "Emergency Stop")
3. Generate STRIDE threats (automatically)
4. Threats with safety impact are prioritized automatically
5. Manual review & refinement
6. Export → the safety chapter in the documentation is generated automatically
```

**Documentation gain:**
- automatic generation: *"The following system elements have been identified as safety-relevant..."*
- automatic generation: *"Threats with potential safety impact have been prioritized according to ISO 12100."*
- no manual extra effort, maximum compliance effect

---

### Phase 2: rule-based completion & derivations

In the second phase, the graph is supplemented by formal rules and
partly completed automatically.

**Scope:**

- activation of `is_an`-based derivations
- transitive derivation of semantically suitable relationships
- activation of **transitive derivation** (e.g. a process inherits relationships from the Data Store via `is_an`).
- **Validation engine:** validation rules to detect:
  - incomplete nodes
  - invalid relationship types
  - semantically contradictory modeling
- **Explainability:** every automatic derivation is explained to the user (e.g. *"Derived from asset X via relation Y"*).
- first automatic derivation of potential threat paths
  (read-only, explainable)

**Goal:**

- reducing manual modeling errors
- consistent, rule-based extension of the graph
- preparing a fully deterministic analysis
- reducing user errors and increasing data quality without manual extra effort.

**Safety integration in phase 2:**
- transitive derivation respects safety annotations
- derived relationships to safety-relevant assets are prioritized higher
- the validation engine warns about missing safety annotations for critical relationships

---

### Phase 3: deterministic threat derivation

In the third phase, the graph is fully used as the
basis for an automated and reproducible TARA.

**Scope:**

- strict separation of:
  - likelihood-related relationships (e.g. `uses`, `transports`)
  - impact-related relationships (e.g. `depends_on`, `affects_*`)
- **complete path computation** from attack vectors to damage targets
- use of explicit and derived relationships only
  (no heuristic assumptions)
- clear marking of the analysis mode (deterministic)

**Goal:**

- reproducible, traceable threat chains
- fully graph-based threat analysis
- minimizing subjective ratings

**Safety integration in phase 3:**
- attack tree generation uses the CIANAAA mapping
- External Entities as threat sources with a feasibility catalog
- F × B × I scoring takes safety impact into account automatically
- Safety Override Rule: irreversible_major / fatal (direct) → highest priority
- automatic mitigation suggestions for safety-critical branches
- fully EN 50742 / Machinery Regulation 2027 compliant documentation

---

### Phase 4: analysis support & governance (optional)

Optionally, the model can be extended with governance and analysis support
functions.

**Possible extensions:**

- prioritization and filtering of threat paths
- traceable documentation of modeling decisions
- support for reviews, audits and standards conformance
- versioning and comparison of graphs

**Goal:**
- scalability to larger systems
- higher acceptance among reviewers and auditors
- sustainable maintenance of the model over the lifecycle

---

**For phase 1:**
**Step 1:** core safety types (foundation)
First define the basic safety interfaces:

- `SafetyAnnotation` interface (incl. `physicalHazardPotential`)
- `SafetyImpact` type
- `ValueSource` type (`"derived" | "manual"`)
- `ExternalEntityThreatProfile` interface

**Step 2:** extend DFD element properties
All DFD element types with safety properties (in `element-properties.ts`):

- `ProcessProperties`
- `DataStoreProperties`
- `DataFlowProperties`
- `InterfaceProperties`
- `ExternalEntityProperties`

**Step 3:** AssetProperties — derived/manual pattern
Derived fields with origin annotation (in `element-properties.ts`):

- `physicalImpact` + `physicalImpactSource` + `physicalImpactRationale`
- `securityGoals[].level` (CIANAAALevel) + `securityGoals[].source` + `securityGoals[].rationale`
  — replaces the former boolean flags (`nonRepudiationRelevant` etc.)
  — derived via `asset-cianaaa-deriver.ts` (BASE_RULES × impact ratings → CIANAAALevel)

**Step 4:** extend asset relationships

- `BaseAssetRelation` with `safety?: SafetyAnnotation`
- `HumanRelation` with `isProtectionTarget`
- `DerivedAssetRelation` with safety inheritance

**Step 5:** validations & helpers

- safety-specific validation functions
- helper functions (`hasSafetyImpact`, `isSafetyCritical`, `aggregatePhysicalImpact`)
- derivation engine: `asset-cianaaa-deriver.ts`
  - `BASE_RULES[assetGroup:relationType]` → applicable SecurityGoalTypes
  - `CIANAAA_APPLICABLE[assetGroup]` → category filter
  - `CAUSE_MECHANISM_CRITERIA[mechanism]` → relevant impact criteria
  - `MAX(impactRatings)` → `CIANAAALevel`
  - fallback: `computeMaxRatingLevel()` if no specific criteria are rated
  - `explainSuggestion()` → derivation trace for UI transparency (audit trail)
