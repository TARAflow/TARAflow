# TARAflow — Element Types: Sensor & Actuator (cyber-physical transducers)

**Version:** 0.5 · **Status:** core implemented — threat generation pending · **Schema target:** v3 (new element types)

> **Status legend:** ✅ implemented · 🔄 partial · ⬜ open / not started. Markers reflect the state after the "feat(dfd): add Sensor and Actuator cyber-physical transducer elements" commit.

> **Changes vs v0.4 — the architectural pivot.** Implementation deliberately diverged from the v0.4 spec on three load-bearing points:
> 1. **`PhysicalEnvironment` and `PhysicalChannel` were NOT created as element/connector types.** The untrusted physical world is modelled as a normal **`ExternalEntity`**; the physical coupling is a **`DataFlow` with `medium="physical"`**. This avoids two new top-level types and reuses the existing connectable/flow machinery. (Reverses the v0.4 "PhysicalChannel stays a fully separate connector" decision.)
> 2. **The physical attack-surface properties were split by ownership** (v0.5 §5): the *sensor-intrinsic* ones — `stimulusDomain`, `sensingExposure` — live on the **Sensor**; the *channel/environment* ones — `couplingMode`, `injectability`, `controllability` — live on the **physical `DataFlow`**. This closes the gap created by point 3.
> 3. **Two legitimate modelling variants** (§2.4): **A** (full, with a physical-coupling edge to an `ExternalEntity`) and **B** (simplified, `Sensor → Process` only). B is explicitly valid; the sensor-intrinsic fields keep B analysable.
>
> Renames vs v0.4: `physicalAccessibility` → **`physicalExposureLevel`** (reuses the PhysicalBoundary PEL scale); `PhysicalChannel.exposure` → **`Sensor.sensingExposure`**; `safetyRelevance` (tri-state enum) → **`safetyRelevant?: boolean`** (`undefined`=unassessed, `false`=not relevant, `true`=relevant) plus `safetyRationale`.

---

## 1. Motivation & scope ✅

Sensor and Actuator are the **transducers** at the cyber-physical boundary — the points where classic STRIDE-DFD goes blind (transduction / signal-injection attacks below the digital layer).

**Scoping rule (normative).** ✅ `Sensor` and `Actuator` represent **exclusively the transducer** — the physical↔electrical conversion. Signal conditioning, ADC/DAC, driver stages, ISP/image pipelines remain `Process` (camera sensor vs. ISP vs. image processor → the sensor is only the imager; ISP is a Process).

Out of scope of the transducer types (handled elsewhere): enclosure/tamper and fault-injection on the compute element → `PhysicalBoundary`; tapping/cutting a physical *data* line → `DataFlow` over a physical medium.

## 2. Element model ✅

### 2.1 The cyber-physical chain ✅

The physical world is an **`ExternalEntity`**; the coupling to it is a **`DataFlow` with `medium="physical"`**. No `PhysicalEnvironment` / `PhysicalChannel` types.

```
ExternalEntity --[DataFlow medium=physical]--> Sensor --[DataFlow]--> Process
                                                                        |
                                                                     [DataFlow]
                                                                        v
ExternalEntity <--[DataFlow medium=physical]-- Actuator <--[DataFlow]-- Process
```

- The **stimulus** enters at the `ExternalEntity` and is carried by a physical `DataFlow` to the Sensor — where transduction attacks are injected.
- The Sensor transduces and hands a value to a `Process` over a normal (logical) `DataFlow`.
- Symmetrically, a `Process` commands an Actuator, which acts on the world — where the **hazard / bowtie top event** lands.

### 2.2 Transducer base — roles stay separate ✅

A shared base **`TransducerBaseProperties`** holds the *structural* commons (`type`, `location`, `locationProvenance`, `physicalExposureLevel`, `secondaryChannelCapabilities`, `securityControlOwnership`, `owner`, `notes`, `description`). `Sensor` and `Actuator` are **distinct roles** layered on top, each with its own Context and Security/Safety property set and its own threat/safety semantics.

They are **not** collapsed into one type with a `direction` flag: Context and Security/Safety properties differ substantially, and the threat specs are asymmetric — Sensor = integrity/authenticity of *input*; Actuator = *consequence*/hazard (usual bowtie top event). The base exists for code reuse and the dual-role case, not to erase the asymmetry. *(Implemented as a single shared base interface plus two role interfaces in `transducer-properties.ts`.)*

**Dual-role devices** (touchscreen, HMI, RFID/NFC, transceiver) ✅ are modelled as **one element carrying both roles** — the connection validator allows Sensor↔Actuator coupling without an endpoint rule (dual-role / feedback).

**Active sensors** (radar, LiDAR, ultrasonic) 🔄 are the canonical dual-role case (Sensor + `emission`-class Actuator): an emission coupling outward and a reception coupling inward. Modelled by composition, no special-case boolean. *(Topology is permitted by the validator; the dedicated dual-role authoring affordance and the `emission`-domain field on the Actuator are still open — §10.)*

### 2.3 The physical world — `ExternalEntity`, not a new type ✅

The untrusted physical world a Sensor measures / an Actuator acts on is a normal `ExternalEntity`, reached over a `medium="physical"` `DataFlow`. Rationale for not adding a `PhysicalEnvironment` type: it would duplicate the connectable/trust machinery `ExternalEntity` already provides, and the modelling distinction (this EE is reached physically) is fully carried by the edge's `medium`.

> **Foreign smart sensor.** If a smart sensor is **ours**, model it as a `Process` (+ the `Sensor` transducer symbol) — the Sensor's cyber side connects to that Process. If it is **third-party** (unknown firmware), model the whole device as an `ExternalEntity` with **no** Sensor symbol. Consequence: an `ExternalEntity` is valid at a transducer **only on the physical edge** (`medium="physical"`), never on the cyber side.

### 2.4 Two modelling variants — A (full) and B (simplified) ✅

- **Variant A — full CPS model.** `ExternalEntity ─[medium=physical]→ Sensor ─[DataFlow]→ Process`. The channel/environment fields (`couplingMode`, `injectability`, `controllability`) are captured on the physical edge.
- **Variant B — simplified model.** `Sensor ─[DataFlow]→ Process` only, **no** physical edge. **Explicitly legitimate** — not modelling the physical coupling is a valid scoping choice (e.g. the smoke-detector reference case). The sensor-intrinsic fields (`stimulusDomain`, `sensingExposure`) keep B analysable: physical threats (blinding, injection, EMI) can still be generated without a drawn edge.

This is *why* `stimulusDomain` / `sensingExposure` live on the Sensor (§5.1) rather than on the edge: they must be capturable in Variant B.

## 3. Symbolism 🔄

| Element | Canvas stencil | Description-view icon (MUI) | Notes |
|---|---|---|---|
| Sensor | dedicated stencil ✅ | `Sensors` ✅ | Type set explicitly on the shape — **not** via style→type mapping (the hexagon glyph would collide with `ChipBoundary`). |
| Actuator | dedicated stencil ✅ | `PrecisionManufacturing` ✅ | Flare reads command→amplified effect. |
| Physical world | — | (uses `ExternalEntity` icon) | No own symbol — it *is* an ExternalEntity (§2.3). |
| Physical coupling | physical `DataFlow` styling 🔄 | — | A `DataFlow` with `medium="physical"`; distinct edge styling is cosmetic/optional. |

## 4. Direction, bidirectionality & secondary channels ✅

- Direction is fixed per role: Sensor = input, Actuator = output (topological — which port/element).
- Bidirectionality is expressed by **actual reverse DataFlows** plus the declared capability list — not a boolean.
- **`secondaryChannelCapabilities`** ✅: `[]` of `calibration | config | diagnostics | firmware_update | health_status`. Each capability is meant to pull in **its own threat template** (template wiring is Phase 5, ⬜):
  - `firmware_update` — highest-value target (persistent compromise); supply-chain / integrity.
  - `calibration` / `config` — integrity of the measurement/command path.
  - `diagnostics` / `health_status` — information disclosure.

## 5. Property model ✅ (model + forms)

Conventions: identifiers and enum values in English. Enum order weakest → strongest; the leftmost mitigation value is the pessimistic default (§7). All fields below are implemented in `transducer-properties.ts` and editable in `sensor-/actuator-description-form.tsx` (+ shared `transducer-form-shared.tsx`).

### 5.0 Shared base (`TransducerBaseProperties`) ✅

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `type` | string (extensible) | unset | Concrete device kind (descriptive, **not** the threat classifier). |
| `location` | `internal \| external \| boundary_spanning` | derived | **Derived from `PhysicalBoundary` containment** (SSOT). |
| `locationProvenance` | `derived \| override` | `derived` | Set to `override` when the analyst picks a location manually. |
| `physicalExposureLevel` | PEL scale (`PEL0…PEL4`) | unset | *Device-tamper* reachability (open/replace/wire). Reuses the PhysicalBoundary PEL. Sensing-side exposure is separate (`sensingExposure`, §5.1). |
| `secondaryChannelCapabilities` | multi-select (§4) | `[]` | Reverse-channel attack surfaces. |
| `securityControlOwnership` | `SecurityControlRecord[]` | `[]` | Implemented 62443 controls (shared record type). |
| `owner` / `notes` / `description` | string | unset | Documentation. |

### 5.1 Sensor ✅

**Context**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `measurand` | `temperature \| pressure \| position \| velocity \| flow \| optical \| acoustic \| chemical \| electrical \| other \| unspecified` | unset → finding | Physical quantity (descriptive). |
| `transductionPrinciple` | `capacitive \| resistive \| piezoelectric \| magnetic \| optical \| mems_inertial \| ultrasonic \| electrochemical \| thermal \| other \| unspecified` | `unspecified` → finding | Device physics; which injection couples in. |
| **`stimulusDomain`** (moved here from the channel) | `rf \| optical \| acoustic \| magnetic \| electric_field \| chemical \| mechanical \| thermal \| other` | unset → finding | **Attack-catalog key** (optical→blinding, acoustic→injection, magnetic→spoofing, rf→EMI). Intrinsic to the sensor → capturable in Variant B. |
| **`sensingExposure`** (moved here from the channel) | `shielded \| partially_exposed \| exposed` | `exposed` | Exposure of *this sensor instance's* sensing surface, independent of `physicalExposureLevel` (camera behind glass: device internal, optically exposed). |

> Active sensors (radar/LiDAR/ultrasonic) are not flagged here — modelled as a dual-role element (Sensor + `emission` Actuator), see §2.2.

**Security / Safety**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `signalAuthentication` | `none \| plausibility_only \| source_authenticated \| cryptographic` | `none` | Spoofing/Integrity mitigation. 62443-4-2 FR1/FR3. |
| `plausibilityCheck` | `none \| range \| range_rate \| model_based` | `none` | Mitigates injected/spoofed values. |
| `redundancy` | `none \| homogeneous \| diverse` | `none` | Only `diverse` mitigates common-mode transduction. |
| `lossDetection` | `none \| detected_degraded \| detected_failsafe` | `none` | Gates jamming/blinding (Availability) → hazard escalation. |
| `safetyRelevant` | `boolean?` (`undefined`=unassessed) | `undefined` → finding | `true` triggers Safety Override and expects `safetyClassification`. |
| `safetyRationale` | string | unset | Justification for the safety call. |
| `safetyClassification` | see §5.5 | unset (`unassessed`) | Magnitude of a corrupted-reading consequence. |

### 5.2 Actuator ✅

**Context**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `actuatorClass` | see §5.4 (`… \| other \| unspecified`) | `unspecified` → finding | Hazard archetype + safe-state semantics. |
| `energyDomain` | `electrical \| hydraulic \| pneumatic \| thermal \| mechanical \| other \| unspecified` | `unspecified` | How it is driven (orthogonal to class). |
| `hazardPotential` | `unassessed \| informational \| low \| medium \| high \| catastrophic` | `unassessed` → finding | **Intrinsic** worst-case capability, context-free (fan vs. robot arm). Distinct from assessed severity (§5.5). |

**Security / Safety**

| Property | Type / values | Default | Purpose |
|---|---|---|---|
| `commandAuthentication` | `none \| integrity_checked \| source_authenticated \| cryptographic` | `none` | Tampering/Spoofing of commands. 62443-4-2 FR1/FR3. |
| `safeState` | `none_defined \| de_energize_to_safe \| energize_to_safe \| hold_last` | `none_defined` → finding | Central safety property; outcome under DoS/power loss. Read with class nuance (§5.4) — de-energize is **not** automatically safe. |
| `failBehavior` | `unassessed \| fail_dangerous \| fail_safe \| fail_operational` | `unassessed` | Behaviour on internal failure. |
| `feedbackVerification` | `none \| closed_loop_shared \| closed_loop_independent` | `none` | Detects forced/failed actuation; `*_independent` is also the Sensor side of a bidirectional element. |
| `hardwareInterlock` | `none \| sw_bypassable \| independent` | `none` | Bounds worst case independently of a compromised controller. |
| `safetyRelevant` | `boolean?` | `undefined` → finding | `true` triggers Safety Override. |
| `safetyRationale` | string | unset | Justification. |
| `safetyClassification` | see §5.5 | unset (`unassessed`) | Assessed consequence magnitude. |

### 5.3 Physical coupling — on the `DataFlow`, not a separate type ✅

The physical coupling is a `DataFlow` with `medium="physical"`. Its physical group (`DataFlowProperties`) carries the **channel/environment** fields only — the sensor-intrinsic `stimulusDomain`/`sensingExposure` were moved to the Sensor (§5.1).

| Property (on physical `DataFlow`) | Type / values | Default | Purpose |
|---|---|---|---|
| `medium` | `logical \| physical` | `logical` | `physical` flips threat templates cyber→physical and gates the fields below. The graph-builder reads `medium === "physical"`. |
| `couplingMode` | `passive_stimulus \| active_reflection \| emission \| actuation` | unset → finding | Channel role. `passive_stimulus` = environment emits, transducer receives. `active_reflection` = device emits, reflection returns (radar/LiDAR) → false-echo/spoofing. `emission`/`actuation` = device acts outward. |
| `injectability` | `none \| difficult \| feasible` | (conservative) | Feasibility of injecting/spoofing on **this** channel (a sensor model may have several couplings with different injectability). |
| `controllability` | `uncontrolled \| partially_controlled \| controlled` | (conservative) | How freely an attacker can shape the environment behind this coupling. |

### 5.4 Actuator classes ✅

Effect-based grouping (small closed set); concrete device in `type`.

| `actuatorClass` | Examples | Hazard archetype | Safe-state nuance |
|---|---|---|---|
| `motion` | motor, servo, stepper, linear actuator, solenoid | crushing, impact, entanglement | de-energize may *release* a brake → can be dangerous |
| `flow` | valve, pump, damper | overpressure, leakage, loss of cooling | depends on normally-open vs normally-closed |
| `power_switching` | relay, contactor, breaker, FET driver | unexpected energization, arc | usually de-energize-to-safe |
| `thermal` | heater, cooler, Peltier | fire/overheat, freezing | off usually safe; loss of *cooling* can be dangerous |
| `emission` | RF/laser/ultrasonic emitter, speaker | exposure, interference, EMC | off |
| `dispensing` | dosing pump, injector, sprayer | over/under-dose, contamination | stop dispensing |
| `signaling` | lamp, display, buzzer, HMI output | **misleading indication → wrong operator action** | last-known-good / fail-obvious |

### 5.5 Severity model (standard-agnostic) ✅

Three distinct, non-redundant fields — do **not** collapse them and do **not** hardcode one standard's scale:

- **`hazardPotential`** (Actuator Context, §5.2) — *intrinsic* capability, context-free, seeds prioritisation.
- **`safetyRelevant`** — boolean gate (`undefined`=unassessed, `false`=not relevant, `true`=relevant). *(v0.4's tri-state enum was replaced by a boolean + `safetyRationale`.)*
- **`safetyClassification`** — *assessed* consequence magnitude on a generic internal scale: `unassessed \| minor \| major \| severe \| catastrophic`. A **mapping layer** (⬜, §9 Phase 8) projects this onto SIL (IEC 61508/EN 50128), ASIL (ISO 26262), Class A/B/C (IEC 62304), … rather than baking one in.

### 5.6 Meta ✅

`id` / `name` / element-type discriminator (`Sensor \| Actuator`); asset linkage via `shared/services/asset-creation.ts` through the single-write `updateProject` channel; `securityControlOwnership` for implemented 62443 controls.

## 6. Connection rules (DFD validator) ✅

Implemented as R11/R12 in `connection-validator.ts` (`validateTransducerConnections`), gated on the edge `medium`. Severity: **error** for the forbidden topologies. A `Sensor → Process` model with no physical edge (Variant B) is valid — there is **no** "missing physical coupling" finding (removed as a false positive).

| Other end of a transducer edge | `medium="physical"` | `medium` logical / unset |
|---|---|---|
| **ExternalEntity** | ✅ physical coupling | ❌ error `transducerEeNotPhysical` |
| **Process / Multiprocess / Interface** | ❌ error `transducerPhysicalMediumInvalidEndpoint` | ✅ cyber signal / command |
| **DataStore** | ❌ `sensor/actuatorInvalidConnection` | ❌ `sensor/actuatorInvalidConnection` |
| **Trust / Chip / PhysicalBoundary** | ❌ | ❌ |
| **Sensor / Actuator** | ✅ (dual-role / feedback) | ✅ (dual-role / feedback) |

Companion checks: ✅ `dataflow-property-validator` skips the cyber checks (C1–C10) on a `medium="physical"` edge and instead asks for `couplingMode`; ✅ Sensor/Actuator are in the unconnected-element check; ✅ `element-property-validator` raises refinement findings for unset/unspecified threat-driving context (`measurand`, `transductionPrinciple`, `stimulusDomain`, `actuatorClass`, `hazardPotential`, `safeState`, `safetyRelevant`).

> **Direct physical transducer coupling** (Sensor ↔ Actuator over a physical edge — mechanical governor, float valve, bimetal thermostat) is *permitted* by the dual-role rule but has **no** dedicated `direct-physical-loop` interaction kind yet (⬜, ties to `hardwareInterlock = independent`).

## 7. Default strategy ✅

Implemented in `element-property-defaults.ts` (`SENSOR_DEFAULTS` / `ACTUATOR_DEFAULTS`).

1. **Pessimistic by default.** ✅ Mitigations default to weakest (`none`) — a freshly placed element generates its full threat set; reduction is *earned*. (`none` is a *decided* value → no "missing" finding, but the generator reads it as the weakest posture.)
2. **Classifiers default to their non-decision sentinel** ✅ (`transductionPrinciple="unspecified"`, `actuatorClass="unspecified"`, `hazardPotential="unassessed"`, `safeState="none_defined"`) → validator refinement findings.
3. **`sensingExposure="exposed"`** ✅ — worst-case until argued down.
4. **`measurand`, `stimulusDomain`, `safetyRelevant` left unset** ✅ → "missing property" findings (force an explicit decision).
5. **No `actuatorClass→field` cascade** ✅ — `energyDomain`/`hazardPotential`/`safeState` are context-dependent and must be assessed, not guessed.
6. ⬜ **Wiring:** `SENSOR_/ACTUATOR_DEFAULTS` are defined; applying them at element **creation** (factory) still needs to be verified/completed.

> Process aside: `runsAs` is no longer required for embedded/RTOS technologies — `EMBEDDED_TECHNOLOGIES` + `isRunsAsApplicable` in `element-property-defaults.ts` are the single source of truth, shared by the Process form (disable) and the validator (requirement). ✅

## 8. Threat coupling ⬜ (the remaining payoff)

The model, validator, defaults and forms are in place; the **threat generator** for the new types is not yet wired.

### 8.1 STRIDE-per-element ⬜

- **Sensor** (Integrity/Authenticity/Availability of the measurand): transduction/spoofing gated by `stimulusDomain` × `sensingExposure` (Sensor) × `injectability` (physical edge, if present), mitigated by `signalAuthentication` / `plausibilityCheck` / `redundancy=diverse`; jamming/blinding via `lossDetection`.
- **Actuator** (Integrity/Authenticity of commands; Availability of safe-state; bowtie top event): `actuatorClass` selects the hazard archetype; forced state via `commandAuthentication` / `feedbackVerification` / `hardwareInterlock=independent`; prevented safe-state via `safeState`; magnitude via `hazardPotential` → `safetyClassification`.
- **Physical edge / ExternalEntity**: `controllability` gates feasibility; `couplingMode=active_reflection` adds false-echo threats.

### 8.2 STRIDE-per-interaction ⬜ (the hard part)

1. **New interaction kinds**, each with its own template set: `physical-stimulus` (EE→Sensor), `transducer-readout` (Sensor→Process), `actuation-command` (Process→Actuator), `physical-actuation` (Actuator→EE).
2. **Upstream-property-aware mitigation.** "Process consumes spoofed sensor data" surfaces at `transducer-readout` but its mitigations live on the upstream **Sensor** (`plausibilityCheck`, `signalAuthentication`, `stimulusDomain`, `sensingExposure`) and on the **physical edge** (`injectability`). The generator must read source-element + connector properties.
3. **Two-hop consequence propagation.** A transduction attack is *injected* at `physical-stimulus` but its *consequence* is realised downstream (`transducer-readout` → Process → `actuation-command` → hazard at `physical-actuation`).

Recommendation: gate per-interaction for transducers behind a flag so it can mature without destabilising per-element generation.

## 9. Implementation phases — status

| Phase | Scope | Status |
|---|---|---|
| 0 — Spec & schema | Freeze model; `Transducer` base + roles; physical coupling via `medium` | ✅ |
| 1 — Symbols / stencils | draw.io shapes; description-view MUI icons | ✅ (edge styling cosmetic) |
| 2 — Models | `transducer-properties.ts`; physical group on `DataFlowProperties`; `ElementProperties` union | ✅ |
| 3 — Parser | read/write Sensor/Actuator + `medium`; `location` from PhysicalBoundary | ✅ |
| 4 — Validator | §6 connection matrix; property findings; `location` resolution | ✅ |
| 5 — Threat generator: per-element | property-driven templates; CIANAAA + Safety Override; `hazardPotential→safetyClassification` | ⬜ |
| 6 — Threat generator: per-interaction | new interaction kinds, upstream-aware mitigation, two-hop propagation | ⬜ |
| 7 — UI / property panels | per-role forms + shared field module; `secondaryChannelCapabilities` editor | ✅ |
| 8 — Docs & mapping | `safetyClassification` → SIL/ASIL/medical mapping; `property-doc-mappers` | 🔄 (i18n done; mapping layer open) |

Supporting work also landed: structured `ValidationFinding` objects + `translate-finding`; auto-revalidate hook (no manual button); language-free `asset-constants`/`dfd-constants`/`dfd-formatters`; Sensor/Actuator asset-relation + environment matrices; `affects_safety → endangers` migration (incl. A2A); de/en `dfd.json` keys.

## 10. Open points

- ⬜ **Threat templates (Phase 5/6)** — the main remaining payoff. Per-element first (behind nothing), per-interaction behind a flag.
- ⬜ **`dfd-graph-analysis-context.getDataFlows()`** does not forward `isPhysicalCoupling` / `physicalCouplingRole` (it lists fields explicitly). When wiring transducer threat-gen, forward them **and** extend the shared `DFDAnalysisContext` interface.
- ⬜ **Field-move follow-through:** if the graph-builder / generator read `stimulusDomain` / `sensingExposure` from the `DataFlow`, move those reads to the Sensor — the fields are no longer on the edge.
- ⬜ **Defaults wiring** at element creation (factory) — verify `SENSOR_/ACTUATOR_DEFAULTS` are actually applied on new elements.
- ⬜ **Actuator emission domain** — `emission`-class actuators emit into a domain (optical/acoustic/rf). Add an actuator-side domain field (analogous to Sensor `stimulusDomain`) for emission threats. Deferred.
- ⬜ **`affects_safety` final removal** from `HumanAssetRelationType` — cross-cutting (forms, validator, threat-gen, the Safety Override Rule in `dfd-asset-types.ts`). Currently `endangers` is canonical and used everywhere; `affects_safety` remains only as a deprecated union member + its label key.
- ⬜ **Active sensors** — modelling guidance + the dual-role authoring affordance (one element, two roles) and the `emission` reception/emission coupling pair.
- ⬜ **Direct physical control loop** (Sensor →physical→ Actuator): if promoted from "permitted" to a first-class `direct-physical-loop` interaction kind, it needs its own template (the `hardwareInterlock=independent` survives-cyber-compromise path).
- **Decided (v0.5):** physical coupling is a **`DataFlow` with `medium="physical"`**, *not* a separate connector and *not* a `PhysicalEnvironment`/`PhysicalChannel` type. (This reverses the v0.4 "PhysicalChannel stays a fully separate connector" decision.)
- **Decided:** sensor-intrinsic physical-surface fields (`stimulusDomain`, `sensingExposure`) live on the **Sensor**; channel/environment fields (`couplingMode`, `injectability`, `controllability`) on the **physical edge**. One SSOT per field.
- **Decided:** `boundary_spanning` stays a first-class `location` value, derived from PhysicalBoundary containment.
- **Decided:** the "transducer without a physical coupling" warning is **removed** — Variant B is legitimate.
