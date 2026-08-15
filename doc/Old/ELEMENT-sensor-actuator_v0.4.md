# TARAflow — Element Types: Sensor, Actuator & Physical Environment

**Version:** 0.4 (draft) · **Status:** in discussion · **Schema target:** v3 (new element types)

> Changes vs v0.3: removed the `activeEmission` shortcut — active sensors (radar/LiDAR/ultrasonic) are now modelled as **dual-role** elements (Sensor + `emission` Actuator) using the existing composition primitive; added `PhysicalChannel.couplingMode`; sharpened open points (PhysicalEnvironment vs PhysicalActor; direct physical transducer coupling).
> Changes vs v0.2: explicit `PhysicalEnvironment` + `PhysicalChannel` (closes the unmodelled-stimulus gap); shared `Transducer` base **with roles kept separate**; transducer-only scoping rule; reworked severity model (intrinsic vs assessed, standard-agnostic); `secondaryChannelCapabilities`; connection-rule matrix; implementation phases.

---

## 1. Motivation & scope

Sensor and Actuator are the **transducers** at the cyber-physical boundary — the points where classic STRIDE-DFD goes blind (transduction / signal-injection attacks below the digital layer). v0.3 also makes the **physical world itself** explicit, so that an attack on the *environment* (GPS spoofing, laser on a camera, ultrasonic injection, magnetic manipulation) is separable from an attack on the *device* (open enclosure, replace sensor, manipulate wiring).

**Scoping rule (normative).** `Sensor` and `Actuator` represent **exclusively the transducer** — the physical↔electrical conversion. Signal conditioning, ADC/DAC, driver stages, ISP/image pipelines remain `Process`. This is fixed here to prevent "where does the sensor end" disputes (e.g. camera sensor vs. ISP vs. image processor → the sensor is only the imager; ISP is a Process).

Out of scope of the transducer types (handled elsewhere): enclosure/tamper and fault-injection on the compute element → `PhysicalBoundary`; tapping/cutting a physical *data* line → `DataFlow` over a physical medium.

## 2. Element model

### 2.1 The cyber-physical chain

```
PhysicalEnvironment --[PhysicalChannel]--> Sensor --[DataFlow]--> Process
                                                                    |
                                                                 [DataFlow]
                                                                    v
PhysicalEnvironment <--[PhysicalChannel]-- Actuator <--[DataFlow]-- Process
```

- The **stimulus** enters at `PhysicalEnvironment` and is carried by a `PhysicalChannel` to the Sensor — this is where transduction attacks are injected.
- The Sensor transduces and hands a value to a `Process` over a normal `DataFlow`.
- Symmetrically, a `Process` commands an Actuator, which acts on the `PhysicalEnvironment` — this is where the **hazard / bowtie top event** lands.

### 2.2 Transducer base — roles stay separate

A shared abstract base **`Transducer`** holds only the *structural* commons (id, name, `location`, `physicalAccessibility`, `secondaryChannelCapabilities`, ports, asset linkage, channel link). `Sensor` and `Actuator` are **distinct roles** layered on top, each with its own Context and Security/Safety property set and — crucially — its own threat/safety semantics.

They are **not** collapsed into one type with a `direction` flag. Rationale: their Context and Security/Safety properties differ substantially (a merged form would be overloaded), and the threat specs are asymmetric by nature — Sensor = integrity/authenticity of *input*; Actuator = *consequence*/hazard (usual bowtie top event). The base exists for code reuse and for the dual-role case, not to erase the asymmetry.

**Dual-role devices** (touchscreen, HMI, RFID/NFC, transceiver) are modelled as **one element carrying both roles**, each role contributing its property set and its threat set — the same composition principle as the secondary channel. Not a single direction-flagged type.

**Active sensors** (radar, LiDAR, ultrasonic rangefinder) are the canonical dual-role case: they are a Sensor *and* an `emission`-class Actuator. They are modelled as such — one element with both roles, an **emission** `PhysicalChannel` outward and a **reception** `PhysicalChannel` inward (the reflection returns through the environment). The emission threats come from the Actuator role, the reception/transduction threats from the Sensor role; no special-case boolean is needed. (This replaces the v0.3 `activeEmission` flag, which folded a second role into a property.)

### 2.3 `PhysicalEnvironment`

The untrusted physical world a Sensor measures and an Actuator acts upon. It is the explicit entry point for stimulus attacks and the explicit endpoint for actuation consequences. It is deliberately **not** a stereotyped `External Entity`: keeping it a separate type avoids overloading External Entity with physical-channel semantics and keeps the cyber and physical domains from blurring (same overloading argument as §2.2).

## 3. Symbolism

| Element | Symbol | Notes |
|---|---|---|
| Sensor | Hexagon | Symmetric intake; flat L/R edges for ports. |
| Actuator | Flared trapezoid | Narrow (command) → wide (amplified effect); direction read from the flare. Diamond also viable — draw.io allows user-defined connection points. |
| PhysicalEnvironment | Cloud / irregular blob | Visually "not part of the system"; signals the uncontrolled domain. |
| PhysicalChannel | Wavy / double-stroke connector | Distinguishes a physical coupling from a `DataFlow`. |

## 4. Direction, bidirectionality & secondary channels

- `primaryDirection` is fixed per role: Sensor = `input`, Actuator = `output`.
- Bidirectionality is expressed by **actual reverse DataFlows** in the diagram plus a declared capability list — not a boolean.
- **`secondaryChannelCapabilities`**: `[]` of `calibration | config | diagnostics | firmware_update | health_status`. Each capability pulls in **its own threat template**:
  - `firmware_update` — highest-value target (persistent compromise); supply-chain / integrity.
  - `calibration` / `config` — integrity of the measurement/command path (actuator-command-like threats on a sensor; sensor-reading-like threats on an actuator feedback).
  - `diagnostics` / `health_status` — information disclosure.

The earlier "reverse channel inherits the counterpart's threat set" rule is the special case of this for `calibration`/feedback.

## 5. Property model

Conventions: identifiers and enum values in English. Enum order is weakest → strongest; the leftmost value is the pessimistic default (§7).

### 5.0 Shared (`Transducer` base): `type`, `location`

- **`type`** — concrete device category (extensible, descriptive). The threat-driving classifier is `transductionPrinciple` (Sensor) / `actuatorClass` (Actuator), not `type`.
- **`location`** — `internal | external | boundary_spanning`, **derived from `PhysicalBoundary` containment** (SSOT). Carries `locationOverride` + provenance (`derived | override`) for the case where physical placement ≠ logical nesting (probe body internal, tip protruding → `boundary_spanning`). Unresolved → treated conservatively as `external`.
- **`physicalAccessibility`** — `internal | shared_zone | exposed`, **defaults from `location`**. This is *device-tamper* feasibility only (open/replace/wire). Sensing-side exposure is a property of the `PhysicalChannel`, not the device (see §5.3) — this split is what keeps "camera behind glass" (device internal, optically exposed) honest.

### 5.1 Sensor

**Context**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `type` | string (extensible) | `unspecified` | Concrete sensor kind. |
| `measurand` | enum: `temperature \| pressure \| position \| velocity \| flow \| optical \| acoustic \| chemical \| electrical \| other \| unspecified` | `unspecified` | Physical quantity. |
| `transductionPrinciple` | enum: `capacitive \| resistive \| piezoelectric \| magnetic \| optical \| mems_inertial \| ultrasonic \| electrochemical \| thermal \| other \| unspecified` | `unspecified` | Device physics; which injection couples in. `unspecified` → refinement finding. |

> Active sensors (radar/LiDAR/ultrasonic) are not flagged on the Sensor — they are modelled as a dual-role element (Sensor + `emission` Actuator), see §2.2.

**Security / Safety**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `signalAuthentication` | enum: `none \| plausibility_only \| source_authenticated \| cryptographic` | `none` | Spoofing/Integrity mitigation. 62443-4-2 FR1/FR3. |
| `plausibilityCheck` | enum: `none \| range \| range_rate \| model_based` | `none` | Mitigates injected/spoofed values. |
| `redundancy` | enum: `none \| homogeneous \| diverse` | `none` | Only `diverse` mitigates common-mode transduction. |
| `lossDetection` | enum: `none \| detected_degraded \| detected_failsafe` | `none` | Gates jamming/blinding (Availability) → hazard escalation. |
| `safetyRelevance` | enum: `unassessed \| not_relevant \| relevant` | `unassessed` | Gate; `relevant` triggers Safety Override and expects `safetyClassification` (§5.5). |
| `safetyClassification` | see §5.5 | `unassessed` | Magnitude of a corrupted-reading consequence. |

### 5.2 Actuator

**Context**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `type` | string (within `actuatorClass`) | `unspecified` | Concrete actuator kind. |
| `actuatorClass` | enum: see §5.4 | `unspecified` | Hazard archetype + safe-state semantics. `unspecified` → refinement finding. |
| `energyDomain` | enum: `electrical \| hydraulic \| pneumatic \| thermal \| mechanical \| other \| unspecified` | `unspecified` | How it is driven (orthogonal to class). |
| `hazardPotential` | enum: `informational \| low \| medium \| high \| catastrophic` | `unassessed` | **Intrinsic** worst-case capability, context-free (fan vs. robot arm). Seeds prioritisation; distinct from assessed severity (§5.5). |

**Security / Safety**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `commandAuthentication` | enum: `none \| integrity_checked \| source_authenticated \| cryptographic` | `none` | Tampering/Spoofing of commands. 62443-4-2 FR1/FR3. |
| `safeState` | enum: `none_defined \| de_energize_to_safe \| energize_to_safe \| hold_last` | `none_defined` | Central safety property; outcome under DoS/power loss. Read with class nuance (§5.4). |
| `failBehavior` | enum: `unassessed \| fail_dangerous \| fail_safe \| fail_operational` | `unassessed` | Behaviour on internal failure. |
| `feedbackVerification` | enum: `none \| closed_loop_shared \| closed_loop_independent` | `none` | Detects forced/failed actuation; `*_independent` is also the Sensor side of a bidirectional element. |
| `hardwareInterlock` | enum: `none \| sw_bypassable \| independent` | `none` | Bounds worst case independently of a compromised controller. |
| `safetyRelevance` | enum: `unassessed \| not_relevant \| relevant` | `unassessed` | Gate; `relevant` triggers Safety Override. |
| `safetyClassification` | see §5.5 | `unassessed` | Assessed consequence magnitude. |

### 5.3 PhysicalEnvironment & PhysicalChannel

**PhysicalEnvironment (Context)**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `type` | string | `unspecified` | e.g. open-air, enclosed cabinet, fluid, human-facing. |
| `controllability` | enum: `uncontrolled \| partially_controlled \| controlled` | `uncontrolled` | How freely an attacker can shape the physical conditions. |

**PhysicalChannel (the connector carrying the stimulus / actuation)**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `stimulusDomain` | enum: `rf \| optical \| acoustic \| magnetic \| electric_field \| chemical \| mechanical \| thermal \| other` | required | **Attack-catalog key** — attacks couple to the domain, not just the device's transduction principle (camera vs. LiDAR vs. photodiode are all "optical" devices but different domains/attacks). |
| `couplingMode` | enum: `passive_stimulus \| active_reflection \| emission \| actuation` | `passive_stimulus` | Channel role for threat gating. `passive_stimulus` = environment emits, transducer receives (thermal, passive optical). `active_reflection` = device emits, reflection returns (radar/LiDAR/ultrasonic) → adds false-echo/spoofing threats. `emission`/`actuation` = device acts outward. Direction itself stays topological (which port/element). |
| `exposure` | enum: `shielded \| partially_exposed \| exposed` | `exposed` | Sensing-side exposure (the real attack surface). Independent of device `physicalAccessibility`. |
| `injectability` | enum: `none \| difficult \| feasible` | `feasible` | Feasibility of injecting/spoofing into this channel. |

### 5.4 Actuator classes

Effect-based grouping (small closed set); concrete device in `type`.

| `actuatorClass` | Examples | Hazard archetype | Safe-state nuance |
|---|---|---|---|
| `motion` | motor, servo, stepper, linear actuator, solenoid | crushing, impact, entanglement | de-energize may *release* a brake → can be dangerous |
| `flow` | valve, pump, damper | overpressure, leakage, loss of cooling | depends on normally-open vs normally-closed |
| `power_switching` | relay, contactor, breaker, FET driver | unexpected energization, arc | usually de-energize-to-safe |
| `thermal` | heater, cooler, Peltier | fire/overheat, freezing | off usually safe; loss of *cooling* can be dangerous |
| `emission` | RF/laser/ultrasonic emitter, speaker | exposure, interference, EMC | off |
| `dispensing` | dosing pump, injector, sprayer | over/under-dose, contamination | stop dispensing |
| `signaling` | lamp, display, buzzer, HMI output | **misleading indication → wrong operator action** (information integrity, no physical energy) | last-known-good / fail-obvious |

### 5.5 Severity model (standard-agnostic)

Three distinct, non-redundant fields — do **not** collapse them and do **not** hardcode one standard's scale:

- **`hazardPotential`** (Actuator Context, §5.2) — *intrinsic* capability, context-free, seeds prioritisation.
- **`safetyRelevance`** — tri-state gate (`unassessed | not_relevant | relevant`).
- **`safetyClassification`** — *assessed* consequence magnitude on a generic internal scale: `unassessed | minor | major | severe | catastrophic`. A **mapping layer** projects this onto the applicable domain standard rather than baking one in:
  - SIL 1–4 (IEC 61508 / EN 50128), ASIL A–D (ISO 26262), Class A/B/C (IEC 62304), …

This keeps TARAflow usable across automotive (ASIL), industrial (SIL) and medical (class) without a schema rewrite.

### 5.6 Meta (all transducer types)

| Property | Type | Notes |
|---|---|---|
| `id` / `name` / `elementType` | — | `Sensor \| Actuator \| PhysicalEnvironment` discriminator. |
| `linkedAssets` | ref[] | Via `shared/services/asset-creation.ts`; route through `commitAssetSync`. |
| `implementedControls` | ref[] | Reuses `InterfaceProperties.implementedControls` (62443 controls). |
| `requirementRefs` | ref[] | Traceability to clauses. |
| `schemaVersion` | int | Migration. |
| `notes` | string | Free text. |

## 6. Connection rules (DFD validator)

Cyber side via `DataFlow`; physical side via `PhysicalChannel`.

| From → To | Connector | Allowed | Note |
|---|---|---|---|
| PhysicalEnvironment → Sensor | PhysicalChannel | ✅ | Stimulus in. Absent → refinement finding "physical source unmodelled". |
| Sensor → Process | DataFlow | ✅ | Measurement readout (primary). |
| Process → Sensor | DataFlow | ✅ (opt) | Secondary channel (calibration/config/firmware/diagnostics). |
| Process → Actuator | DataFlow | ✅ | Command (primary). |
| Actuator → PhysicalEnvironment | PhysicalChannel | ✅ | Actuation / consequence endpoint. |
| Actuator → Process | DataFlow | ✅ (opt) | Feedback. |
| Sensor/Actuator ↔ External Entity | any | ❌ | Physical role belongs to PhysicalEnvironment; cyber role to Process. |
| Sensor/Actuator ↔ DataStore | any | ❌ | Always via a Process driver (scoping rule). |
| Sensor ↔ Sensor / Actuator ↔ Actuator | any | ❌ | Implies a Process between them. |
| Sensor → Actuator | DataFlow | ❌ | No cyber shortcut — must go through a Process. |
| Sensor → Actuator | PhysicalChannel | ⚠️ see note | Direct *physical* control loop (mechanical governor, float valve, bimetal thermostat). |
| Transducer physical port ↔ Process / cyber port ↔ PhysicalEnvironment | — | ❌ | Wrong port/domain. |

> **Note on direct transducer coupling.** The principle is: *cyber* coupling between transducers is forbidden (a `DataFlow` must pass through a Process), but a *physical* coupling (`PhysicalChannel`) represents a real, software-free control loop. This is exactly the `hardwareInterlock = independent` / mechanical-safety-function case — relevant to the safety-security story because it is the path that survives cyber compromise. Whether to admit it in v3 or defer is an open point (§10); if admitted, it introduces a `direct-physical-loop` interaction kind.

## 7. Default strategy

1. **Pessimistic by default.** Mitigation properties default to weakest → a freshly placed element generates its full threat set; risk reduction is *earned* by explicit, evidence-backed (`implementedControls`) assertions.
2. **Safety is tri-state.** `safetyRelevance`, `failBehavior`, `safetyClassification`, `hazardPotential` default to `unassessed`, never silently `none`.
3. **Unspecified context refines, it does not hide.** `transductionPrinciple` / `actuatorClass` / `stimulusDomain` unspecified → refinement finding, not threat suppression.
4. **Channel defaults are conservative.** `exposure = exposed`, `injectability = feasible`, `controllability = uncontrolled` until argued down.
5. **Secondary channels opt-in**, but each enabled capability adds its threat template.

## 8. Threat coupling

### 8.1 STRIDE-per-element

- **Sensor** (Integrity/Authenticity/Availability of the measurand): transduction/spoofing gated by `PhysicalChannel.stimulusDomain` × `exposure` × `injectability`, mitigated by `signalAuthentication` / `plausibilityCheck` / `redundancy=diverse`; jamming/blinding via `lossDetection`.
- **Actuator** (Integrity/Authenticity of commands; Availability of safe-state; bowtie top event): `actuatorClass` selects the hazard archetype; forced state via `commandAuthentication` / `feedbackVerification` / `hardwareInterlock=independent`; prevented safe-state via `safeState`; magnitude via `hazardPotential` → `safetyClassification`.
- **PhysicalEnvironment**: source of stimulus-injection threats; `controllability` gates feasibility.

### 8.2 STRIDE-per-interaction (the hard part)

Per-interaction must add the cyber-physical crossings as first-class interaction kinds and handle two things classic per-interaction does not:

1. **New interaction kinds**, each with its own template set: `physical-stimulus` (Environment→Sensor), `transducer-readout` (Sensor→Process), `actuation-command` (Process→Actuator), `physical-actuation` (Actuator→Environment).
2. **Upstream-property-aware mitigation.** The threat *"Process consumes spoofed/injected sensor data"* surfaces at the `transducer-readout` interaction, but its mitigations live on the **upstream Sensor** (`plausibilityCheck`, `signalAuthentication`) and on the **channel** (`exposure`). The generator must read source-element + connector properties when evaluating an interaction — not only the interaction itself.
3. **Two-hop consequence propagation.** A transduction attack is *injected* at `physical-stimulus` but its *consequence* is realised downstream (`transducer-readout` → Process → `actuation-command` → hazard at `physical-actuation`). Per-interaction needs to express that an interaction-level cause has a separated, downstream effect.

Recommendation: gate per-interaction for transducers behind a flag (cf. existing `forceClassicMode`) so it can mature without destabilising per-element generation.

## 9. Implementation phases

**Phase 0 — Spec & schema (v3).** Freeze this document; design the `Transducer` base + `Sensor`/`Actuator`/`PhysicalEnvironment` types and `PhysicalChannel` connector; v2→v3 migration plan.

**Phase 1 — Symbols / stencils.** draw.io shapes (Sensor hexagon, Actuator trapezoid, PhysicalEnvironment cloud, PhysicalChannel connector) with user-defined connection points. Visual only.

**Phase 2 — Models.** TS types: `Transducer` base interface, role models, `PhysicalEnvironment`, `PhysicalChannel`; Context/Security-Safety/Meta structures; `secondaryChannelCapabilities`; asset linkage through `commitAssetSync` / `buildAssetHazardLinks`.

**Phase 3 — Parser.** Read/write the new elements and the two connector kinds (DataFlow vs PhysicalChannel) between diagram and model. Compute `location` from PhysicalBoundary containment here (provenance + override).

**Phase 4 — Validator.** Enforce the §6 connection matrix; resolve `location`; emit refinement findings (unspecified threat-driving context, missing PhysicalEnvironment, etc.). Gate generation on a valid topology.

**Phase 5 — Threat generator: per-element.** Property-driven templates for the new types (transduction, jamming, forced-state, hazard archetype per `actuatorClass`); wire CIANAAA + Safety Override; severity from `hazardPotential` → `safetyClassification`.

**Phase 6 — Threat generator: per-interaction.** New interaction kinds, upstream-property-aware mitigation, two-hop consequence propagation (§8.2). Behind a flag initially.

**Phase 7 — UI / property panels.** Forms per role (avoid one overloaded Transducer form — this is *why* the roles are separate); `secondaryChannelCapabilities` editor; reverse-channel display.

**Phase 8 — Docs & mapping.** `safetyClassification` → SIL/ASIL/medical mapping layer; `property-doc-mappers` integration + cross-linking.

Dependency order matches the build: 0 → 1 → (2 → 3 → 4) → (5 → 6) → 7 → 8. Per-interaction (6) is the schedule risk.

## 10. Open points

- **PhysicalEnvironment will eventually overload** (source / sink / medium / human). Mid-term, split off an intelligent actor — `PhysicalActor` / `Human` — which has *intent* and a different threat profile (deception, coercion, shoulder-surfing) than a passive medium. When doing so, reconcile it with the existing `External Entity` (a human is an external entity that couples *physically*) rather than creating a third overlapping concept. Not for v3.
- **Direct physical transducer coupling** (Sensor →`PhysicalChannel`→ Actuator): admit the software-free control loop in v3, or defer? Ties to `hardwareInterlock = independent` (§6 note). If admitted, needs a `direct-physical-loop` interaction kind.
- **Decided:** `PhysicalChannel` stays a **fully separate connector** (not a `DataFlow` subtype). Keeps the domains clean — `DataFlow` = information, `PhysicalChannel` = physical coupling — and avoids "is an optical path a DataFlow?" debates.
- **Decided:** `boundary_spanning` stays a **first-class `location` value**. The two-element alternative needlessly complicates common cases (probe in a pipe, membrane pressure sensor, exterior camera, GNSS/RFID antenna).
- Per-interaction: confirm the generator can carry an interaction-level cause with a downstream-separated effect without distorting the risk register.
- Resolved in v0.4: `activeEmission` is no longer a property — active sensors are dual-role (Sensor + `emission` Actuator); the channel carries `couplingMode`.
