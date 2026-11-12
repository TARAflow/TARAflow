# TARAflow — Sensor & Actuator Threat Catalogue and Generator Support (per-element + per-interaction)

**Version:** 0.1 · **Status:** proposed — not implemented · **Date:** 2026-11-09
**Extends / supersedes:** §8 ("Threat coupling") and the threat-related open points in §10 of `ELEMENT-sensor-actuator_v0_5.md`. The element model (§1–§7 there) is unchanged and assumed.
**Baseline:** `main` @ `28f41fb`.

> **Status legend:** ✅ decided · ⬜ open · 🔧 defect in the current code that this work fixes.

---

## 0. Summary

Sensor and Actuator have a rich property model (`transducer-properties.ts`), but the threat generator uses almost none of it: six context-free templates give every sensor the same three threats, whether it is a MEMS microphone, a PT100 or a camera. Physical couplings (`medium="physical"`) get **cyber** templates (eavesdropping, repudiation) in both methods.

This document specifies:

1. A **shared transducer context** (self + physical edge + peer). Both generators read it, so per-element and per-interaction see the same facts (§4).
2. **Per-element** variants keyed on the model properties (`stimulusDomain`, `actuatorClass`, `safeState`, `lossDetection`, `secondaryChannelCapabilities`, …) (§6).
3. **Per-interaction** support with transducer interaction kinds, a STRIDE set per kind, peer-aware templates and placement for Variant B (§7).
4. A **slot mechanism** in the generator: more than one threat per STRIDE category, where the attacks are genuinely distinct (§5). ✅ *Decided: with generator change.*
5. New mitigations and verifications, plus closed-loop `affectsProperties` on the existing ones (§8).
6. Fixes for the defects found on the way (§2), and a phased plan in which each phase is a self-contained commit (§10).

**Guiding requirement ✅ — symmetry.** Per-element must not be able to do more than per-interaction, or the reverse. Every transducer threat exists in both methods with the same mitigation and verification sets. A parity test enforces this (§9).

---

## 1. Current state (facts)

| Area | State |
|---|---|
| Templates | 6 in `catalog/threats/per-element/embedded`: Sensor `S-003`, `T-015`, `D-007`; Actuator `S-004`, `T-016`, `D-008`. All have `context: {}`. |
| Interaction templates | None for transducers. Flows touching a Sensor/Actuator fall through to `per-interaction/general` (`S-001…E-002`, context-free) or to protocol-keyed embedded templates. |
| Mitigations / verifications | 17 mitigations (`M-S-009…015`, `M-T-014…019`, `M-D-011…015`) and 10 verifications. All have `affectsProperties: []`. |
| STRIDE base | `STRIDE_PER_ELEMENT_TYPE`: Sensor and Actuator = `[S, T, D]`. |
| Model properties read by the generator | None of `stimulusDomain`, `sensingExposure`, `transductionPrinciple`, `secondaryChannelCapabilities`, `actuatorClass`, `safeState`, `feedbackVerification`, `hardwareInterlock`, `lossDetection`, `signalAuthentication`, `plausibilityCheck`. None of them is in `MATCHED_CONTEXT_KEYS`. |
| Template selection | Exactly one template per (element, STRIDE) — `findElementTemplate(...)[0]` after `bySpecificity`. Per-interaction: one per (flow, STRIDE, direction). |
| Natural keys | `el::<elementId>::<stride>` (per-element) and `df::<connId>::<stride>::<direction>` (per-interaction), see `threat-identity.ts`. |

---

## 2. Defects found (fixed by this work)

| # | Defect | Where | Consequence |
|---|---|---|---|
| 🔧 F1 | `modifySensorStride` / `modifyActuatorStride` only `add()` categories already in the base `[S,T,D]`, so they are **no-ops**. They also read properties that do not exist in the model: `failSafeState` (model: `safeState`), `physicalImpact`, `isHazardTarget`, and `redundancy` documented as `dual/triple` (model: `none/homogeneous/diverse`). | `utils/stride-modifier.ts` | Dead code that suggests property-driven behaviour which does not happen. |
| 🔧 F2 | **Property shadowing in per-interaction.** Template matching gets `{ ...connectionProps, ...endpointProps }`, so the endpoint wins. A Sensor/Actuator `location` (`internal/external/boundary_spanning`) overwrites the flow's `location` (`field_cable`, …). The Sensor `redundancy` (`none/homogeneous/diverse`) overwrites the flow's `redundancy` (`none/failover/…`). | `interaction-generator.ts` (sender/receiver blocks) | The existing embedded templates `T-006` and `D-003` (keyed on flow `location`/`redundancy`) **never match** on a flow whose endpoint is a transducer, and they match on wrong data elsewhere. This is a latent bug independent of transducers. |
| 🔧 F3 | Physical couplings get cyber threats. Per-element: the physical `DataFlow` gets the generic DataFlow `[T,I,D]` templates. Per-interaction: up to 12 general templates (S…E × sender/receiver), e.g. "eavesdropping", "sender repudiation". | both generators, `modifyDataFlowStride` ignores `medium` | Noise in the register; physically meaningless threats. |
| 🔧 F4 | An `ExternalEntity` that is reached only over physical edges (the "physical world") gets per-element `[S, R]` threats ("world repudiates…"). | `generateExternalEntityThreats` | Noise. |
| 🔧 F5 | **Scope asymmetry.** Per-element has a coverage fallback (`TB_ONLY_TYPES` incl. Sensor/Actuator) for elements outside every TrustBoundary. Per-interaction drops any flow where neither end has a TB (`isInteractionFlowInScope`). A Sensor outside every TB, fed by the physical world (also no TB), gets **no** per-interaction threats at all. | `interaction-generator.ts` | Silent coverage gap in exactly the common OT case. |
| 🔧 F6 | `implemented-controls-mapper` has no Sensor/Actuator entries, and all transducer mitigations have `affectsProperties: []`. | mapper + catalogue | The closed loop (mitigation → DFD property suggestion, property → implemented hint) is dead for transducers. |
| F7 | `DFDAnalysisContext.getDataFlows()` does not forward `isPhysicalCoupling` / `physicalCouplingRole` (already open point in v0.5 §10). | `shared/ports/dfd-analysis-context.ts` | Resolved differently: the generator reads `medium` from the connection properties (single source of truth, as the graph builder does). No port change needed. |

---

## 3. Design principles ✅

- **P1 — Symmetry.** Every transducer threat has a per-element template and at least one per-interaction counterpart. The two share the mitigation set and the verification set, and their texts say the same thing (the interaction text adds `{{sourceName}}`/`{{targetName}}`). Parity is declared in one table in code and tested (§9).
- **P2 — One data basis.** Both generators obtain the transducer facts from one pure function, `buildTransducerContext` (§4.2). No generator reads physical-edge properties on its own.
- **P3 — No double counting within a method.** A physical injection surface yields one threat per method instance: per-element on the transducer element; per-interaction on the physical edge (Variant A) or element-anchored on the transducer (Variant B, §7.4).
- **P4 — Entry vs. consequence.** The physical *stimulus* edge (world → Sensor) is an attack **entry** and carries threats. The physical *actuation* edge (Actuator → world) is a **consequence** exit. It carries no threats of its own and serves as the impact anchor (§7.2). This asymmetry is intended, not a gap.
- **P5 — Pessimistic defaults.** New "weak control" keys use the existing FX-7 `weak()` semantics: unset = weakest value, counted as an assumption in specificity. An unfinished model never looks safer.
- **P6 — Specificity, not filtering.** Variants are more specific templates. The existing generic templates stay as fallbacks (`context: {}` scores 0). Nothing that matches today stops matching, except where §2 removes noise on purpose.
- **P7 — Feasibility vs. applicability.** `sensingExposure`, `injectability` and `controllability` are **feasibility** inputs. They never suppress a threat. They appear in the cause text and in the attack-potential rationale. Suppression only comes from what an element **is** (domain, class, capabilities), never from how well it is protected.

---

## 4. Context model

### 4.1 New self-scoped context keys

Added to `TemplateContext` and `MATCHED_CONTEXT_KEYS`. They are matched against the element itself. The weak value applies per FX-7.

| Context key | Reads property | Kind | Weak value (unset ⇒) |
|---|---|---|---|
| `stimulusDomain` | Sensor.`stimulusDomain` | identity | — (must be set) |
| `transductionPrinciple` | Sensor.`transductionPrinciple` | identity | — |
| `secondaryChannel` | `secondaryChannelCapabilities` (array; any-of) | identity | — |
| `actuatorClass` | Actuator.`actuatorClass` | identity | — |
| `signalAuthentication` | Sensor | control | `none` |
| `plausibilityCheck` | Sensor | control | `none` |
| `sensorRedundancy` | Sensor.`redundancy` | control | `none` |
| `lossDetection` | Sensor | control | `none` |
| `commandAuthentication` | Actuator | control | `none` |
| `safeState` | Actuator | control | `none_defined` |
| `feedbackVerification` | Actuator | control | `none` |
| `hardwareInterlock` | Actuator | control | `none` |

`sensorRedundancy` is a deliberately distinct key name. The existing `redundancy` key keeps its DataFlow meaning (`none/failover/…`), so the two vocabularies never collide in one key.

### 4.2 Scoped keys `edge` and `peer` ✅

Interaction templates need facts from three places: the endpoint whose perspective is taken (**self**), the flow (**edge**), and the other endpoint (**peer**). This is what makes "the Process consumes a spoofed reading, mitigated on the upstream Sensor" expressible. Two optional nested objects are added to `TemplateContext`:

```jsonc
"context": {
  "actuatorClass": ["motion"],                       // self (flat = self, as today)
  "edge": { "medium": ["physical"], "couplingMode": ["active_reflection"] },
  "peer": { "elementType": ["Sensor"], "plausibilityCheck": ["none", "range"] }
}
```

- **`edge.*` keys:** `medium`, `couplingMode` (weak: `passive_stimulus`), `injectability` (weak: `feasible`), `controllability` (weak: `uncontrolled`), `messageType`, plus the existing flow keys (`location`, `redundancy`, `protocol`, `safetyFunction`, `accessMode`, `encryptionInTransit`, `physicalPathProtection`).
- **`peer.*` keys:** `elementType`, plus every self key from §4.1.
- **Also on self:** `elementType` (new flat key), so a template can say "self is a Sensor". Interaction templates have no `elementTypes` field today.

`contextMatch` signature changes from `(ctx, project, elementProps)` to `(ctx, project, scope)` with `scope = { self, edge?, peer? }`. The per-element call passes `{ self: elementProps, edge: transducerCtx?.inboundEdge }`.

**F2 fix — legacy flat keys in interaction templates.** Flow-intrinsic flat keys (`location`, `redundancy`, `protocol`, `safetyFunction`, `accessMode`, `encryptionInTransit`, `physicalPathProtection`) resolve from **edge**. All other flat keys resolve from **self**. This replaces the merge `{...connectionProps, ...endpointProps}`. Existing catalogue entries need no edits. The resolution table is one constant (`FLOW_SCOPED_FLAT_KEYS`), and a regression test pins it (T-006/D-003 now match on a field-cable flow to an Actuator).

### 4.3 `buildTransducerContext` (shared, pure) ✅

```ts
// src/features/threats/services/transducer/transducer-context.ts
export interface TransducerContext {
  role: "sensor" | "actuator";
  /** Inbound physical couplings (EE → Sensor), Variant A. Empty ⇒ Variant B. */
  physicalInbound: { connectionId: string; props: DataFlowProperties }[];
  /** Outbound physical couplings (Actuator → EE). */
  physicalOutbound: { connectionId: string; props: DataFlowProperties }[];
  /** Worst case over physicalInbound — the per-element "edge" scope. */
  inboundEdge?: { couplingMode: CouplingMode[]; injectability: Injectability; controllability: Controllability };
  /** Declared secondary channels without a modelled reverse logical flow. */
  unmodelledSecondaryChannels: SecondaryChannelCapability[];
}
export function buildTransducerContext(graph: DFDGraphReference, elementId: string): TransducerContext | null;
```

- Worst case: `injectability` max(`feasible` > `difficult` > `none`), `controllability` max (`uncontrolled` worst). `couplingMode` is the **union**, because `active_reflection` on any inbound edge enables the false-echo variant.
- `unmodelledSecondaryChannels`: a capability counts as modelled when a logical flow Process→transducer (or transducer→Process for `diagnostics`/`health_status`) carries the matching `messageType` (`firmware` ↔ `firmware_update`; `config` ↔ `config`/`calibration`; `status`/`telemetry` ↔ `diagnostics`/`health_status`). This decides element-anchored fallback placement in per-interaction (§7.4).
- `isPhysical(conn) = conn.properties?.medium === "physical"`, the same predicate as the graph builder (F7).

---

## 5. Generator change: slots ✅

### 5.1 Why

One threat per STRIDE category merges genuinely different attacks into one risk. Ultrasonic injection and a manipulated firmware update are both Tampering, but their attack potential differs completely. One merged feasibility rating is wrong for at least one of them, which breaks ISO/SAE 21434 §15.7 and EN 50742 Approach A, both of which rate per attack.

### 5.2 Mechanism

- `ElementTemplate` and `InteractionTemplate` get an optional **`slot?: string`**. Templates without a slot form the **primary slot** of their STRIDE category. Selection there is unchanged: most specific wins.
- Templates **with** a slot are selected **per slot**: for each distinct slot value whose templates match, the most specific one is emitted **in addition to** the primary.
- **Allowed slots (closed set, guarded by a catalogue test):** `firmware`, `calibration`, `diagnostics`. Slots are restricted to transducers in this version (catalogue test: `slot` ⇒ `elementTypes ⊆ {Sensor, Actuator}` or `self.elementType ⊆ {Sensor, Actuator}`). The mechanism is generic, but rolling it out to other element types is a separate decision.
- **Natural keys:** the primary keeps today's key, so existing projects keep their analyst fields. Slotted threats append the slot:
  `el::<elementId>::<stride>::<slot>` · `df::<connId>::<stride>::<direction>::<slot>`.
- **Display IDs:** the existing sequence number in `generateThreatIdPerElement(elementId, stride, n)` is used. The primary is `n=1`; slots follow in fixed slot order (firmware=2, calibration=3, diagnostics=4) so numbering is stable across regenerations.
- **Sync:** `getEffectiveStrideCategories` becomes `getEffectiveThreatSlots` → `{stride, slot?}[]`. `element-sync` and `interaction-sync` compare on `(stride, slot)`. The "missing threat" banner logic is otherwise unchanged.
- **Elimination:** `shouldEliminateThreat` applies per slot with the same arguments (no slot-specific elimination rules in this version).

### 5.3 What uses slots

| Slot | STRIDE | Trigger (per-element) | Per-interaction placement |
|---|---|---|---|
| `firmware` | T | `secondaryChannel ∋ firmware_update` | on the modelled reverse flow; else element-anchored (§7.4) |
| `calibration` | T | `secondaryChannel ∋ calibration` or `config` | same |
| `diagnostics` | I | `secondaryChannel ∋ diagnostics` or `health_status` | on the modelled status flow; else element-anchored |

Domain variants (acoustic, optical, …) are **not** slots. A sensor has one `stimulusDomain`, so its physical Tampering threat is one primary-slot variant.

---

## 6. Per-element

### 6.1 STRIDE scoping (rewrite of F1)

```
modifySensorStride / modifyActuatorStride (base [S,T,D]):
  secondaryChannelCapabilities ∋ diagnostics|health_status|config  → add I
  (no other add/skip — controls never remove scope, P7)

modifyDataFlowStride:
  medium = physical → []          // owned by the transducer element (P3), fixes F3

ExternalEntity:
  all connected edges medium = physical → []   // the physical world, fixes F4
```

The obsolete modifier props (`failSafeState`, `physicalImpact`, `isHazardTarget`) are removed from `SensorModifierProps` / `ActuatorModifierProps`.

### 6.2 Templates (domain `embedded`)

Existing IDs keep their meaning and become the fallbacks. New IDs continue the per-element embedded sequence (current maxima: S-004, T-016, I-005, D-008).

**Sensor**

| ID | STRIDE | Slot | Context | Threat (short) | Mitigations | Verifications |
|---|---|---|---|---|---|---|
| S-003 | S | — | — (fallback) | Rogue/cloned sensor, forged readings | M-S-009, M-S-010, M-S-011 | V-S-006, V-S-007 |
| S-005 | S | — | `edge.couplingMode ∋ active_reflection` | False echo / ghost target injected into an active sensor (radar, LiDAR, ultrasonic) | M-TD-S-001, M-TD-T-004, M-TD-T-005 | V-TD-S-001, V-TD-T-003 |
| T-015 | T | — | — (fallback) | Measurement tampering (signal path or stimulus) — unchanged | M-T-014, M-T-015, M-T-016 | V-T-009, V-T-010 |
| T-017 | T | — | `stimulusDomain: [acoustic]` | Acoustic/ultrasonic injection: out-of-band sound demodulated by front-end nonlinearity, or driving a MEMS resonance | M-TD-T-001, M-TD-T-002, M-TD-T-003, M-TD-T-004, M-TD-T-005, M-TD-T-006 | V-TD-T-001, V-TD-T-003, V-TD-T-004, V-TD-T-005 |
| T-018 | T | — | `stimulusDomain: [optical]` | Light/laser injection, projected or spoofed scene | same set + M-TD-T-002 emphasis | same set |
| T-019 | T | — | `stimulusDomain: [rf, electric_field]` | EMI injection into front end or leads (lead acts as antenna) | M-TD-T-001, M-TD-T-003, M-TD-T-004, M-TD-T-005, M-TD-T-006 | V-TD-T-001, V-TD-T-003, V-TD-T-004, V-TD-T-005 |
| T-020 | T | — | `stimulusDomain: [magnetic]` | Magnetic field spoofing (Hall, magnetometer, inductive) | M-TD-T-002, M-TD-T-004, M-TD-T-005 | V-TD-T-001, V-TD-T-003, V-TD-T-004 |
| T-021 | T | — | `stimulusDomain: [thermal, mechanical]` | Local manipulation of the measurand (heating/cooling, vibration, force) | M-T-015, M-TD-T-004, M-TD-T-005 | V-T-010, V-TD-T-003, V-TD-T-004 |
| T-022 | T | — | `stimulusDomain: [chemical]` | Cross-sensitivity or poisoning of the sensing element | M-TD-T-004, M-TD-T-005 | V-TD-T-003, V-TD-T-004 |
| D-007 | D | — | — (fallback) | Reading denial (jam, drop, flood) — unchanged | M-D-011, M-D-012, M-D-013 | V-D-009 |
| D-009 | D | — | `stimulusDomain: [optical, acoustic, rf, electric_field, magnetic]`, `lossDetection: [none]` (weak) | Undetected blinding/saturation: sensor reports a plausible stuck value instead of failing | M-TD-D-001, M-D-011, M-TD-T-004 | V-TD-D-001, V-D-009 |

**Sensor and Actuator (shared, slotted)**

| ID | STRIDE | Slot | Context | Threat (short) | Mitigations | Verifications |
|---|---|---|---|---|---|---|
| T-023 | T | `firmware` | `secondaryChannel: [firmware_update]` | Persistent compromise via a manipulated transducer firmware update | M-TD-T-007, M-T-014 | V-TD-T-006 |
| T-024 | T | `calibration` | `secondaryChannel: [calibration, config]` | Manipulated calibration/configuration shifts every reading or command (offset, gain, limits) | M-TD-T-008, M-TD-T-005 | V-TD-T-007 |
| I-006 | I | `diagnostics` | `secondaryChannel: [diagnostics, health_status, config]` | Disclosure via diagnostic/health/config read-out (configuration, calibration, process state) | M-TD-I-001 | V-TD-I-001 |

**Actuator**

| ID | STRIDE | Slot | Context | Threat (short) | Mitigations | Verifications |
|---|---|---|---|---|---|---|
| S-004 | S | — | — (fallback) | Command or feedback spoofing — unchanged | M-S-012, M-S-013, M-S-015 | V-S-008, V-S-009 |
| T-016 | T | — | — (fallback) | Unauthorized actuation — unchanged | M-T-017, M-T-018, M-T-019 | V-T-011, V-T-012 |
| T-025 | T | — | `actuatorClass: [motion]` | Forced movement beyond safe envelope (crushing, impact, entanglement) | M-T-017, M-T-018, M-T-019, M-TD-D-003 | V-T-011, V-TD-T-008 |
| T-026 | T | — | `actuatorClass: [flow]` | Forced open/close → overpressure, leakage, loss of cooling | M-T-017, M-T-018, M-T-019 | V-T-011, V-TD-T-008 |
| T-027 | T | — | `actuatorClass: [power_switching]` | Unexpected energization / de-energization | M-T-017, M-T-019, M-TD-D-003 | V-T-011, V-TD-T-008 |
| T-028 | T | — | `actuatorClass: [thermal]` | Overheating / overcooling beyond limits | M-T-017, M-T-018, M-T-019 | V-T-011, V-TD-T-008 |
| T-029 | T | — | `actuatorClass: [dispensing]` | Over- or under-dosing, contamination | M-T-017, M-T-018, M-T-019 | V-T-011, V-TD-T-008 |
| T-030 | T | — | `actuatorClass: [signaling]` | Misleading indication → wrong operator action (frozen or falsified display/lamp) | M-T-017, M-TD-T-011 | V-T-011, V-TD-T-009 |
| D-008 | D | — | — (fallback) | Actuation denial — unchanged | M-D-014, M-D-015 | V-D-010 |
| D-010 | D | — | `safeState: [none_defined, hold_last]` (weak) | Denial leaves the actuator in an undefined or last state; no safe state is reached | M-TD-D-002, M-TD-D-003, M-D-014 | V-TD-D-002 |
| D-011 | D | — | `actuatorClass: [motion]`, `safeState: [de_energize_to_safe]` | De-energizing releases a holding brake or load: the "safe" state is dangerous | M-TD-D-002 | V-TD-D-002 |

Notes:
- `emission`-class actuators fall back to T-016/D-008 until the actuator emission domain exists (v0.5 §10, still open).
- Initial impact: unchanged (`getInitialImpact` from security goals). Additionally, for Actuator T/D threats, `hazardPotential`/`safetyClassification` feed the existing Safety Override when `safetyRelevant = true` (this is already the contract in v0.5 §5.5; the generator only has to pass the actuator props through).

---

## 7. Per-interaction

### 7.1 Interaction kinds

A pure classifier, `classifyTransducerInteraction(df, from, to, conn)`, returns one kind, or `null` for ordinary flows (unchanged behaviour):

| Kind | Topology | `medium` | Notes |
|---|---|---|---|
| `physical-stimulus` | ExternalEntity → Sensor | physical | attack entry (Variant A) |
| `physical-actuation` | Actuator → ExternalEntity | physical | consequence exit (P4) |
| `transducer-readout` | Sensor → Process/Multiprocess/Interface | logical | measurement path |
| `actuation-command` | Process/Multiprocess/Interface → Actuator, `messageType ∉ {firmware, config}` | logical | command path |
| `actuator-feedback` | Actuator → Process/Multiprocess/Interface | logical | status / position feedback |
| `secondary-channel` | Process → Sensor/Actuator with `messageType ∈ {firmware, config}`, or Process → Sensor (any logical) | logical | reverse channel |
| `transducer-coupling` | Sensor ↔ Actuator | any | out of scope in this version → no transducer templates, generic behaviour (⬜ §11) |

### 7.2 STRIDE set and perspectives per kind

| Kind | STRIDE | Perspectives | Table key |
|---|---|---|---|
| `physical-stimulus` | `couplingMode = active_reflection` → S, T, D; otherwise (incl. unset) → T, D | **receiver only** (the world has no perspective) | receiverTB ?? Sensor's PhysicalBoundary ?? `__no_tb__` |
| `physical-actuation` | ∅ (P4) | — | — |
| `transducer-readout` | unchanged (S…E) | sender + receiver as today | as today |
| `actuation-command` | unchanged | sender + receiver | as today |
| `actuator-feedback` | unchanged | sender + receiver | as today |
| `secondary-channel` | unchanged | sender + receiver | as today |

Logical transducer flows keep the full STRIDE set: the underlying line (Modbus, 4–20 mA + HART, SPI, …) still has its cyber threats. The transducer templates win on specificity where they apply; the general templates fill the remaining categories. Only the physical edges are narrowed.

**Physical-actuation is the impact anchor.** Threats on `actuation-command` and the per-element Actuator threats take `linkedAssetIds` from the actuator **and** from the assets linked to its outbound physical edge(s) and target EE (`endangers` relations). This is the minimal two-hop propagation; the full consequence chain stays open (§11).

**Scope fix F5.** `isInteractionFlowInScope` becomes: in scope if either end has an effective TB, **or** either end is a Sensor/Actuator. The table key falls back to the transducer's PhysicalBoundary, then `__no_tb__`, which is the same fallback the Interface pass already uses.

### 7.3 Interaction templates (domain `embedded`)

Current per-interaction embedded maxima: S-003, T-010, I-003, D-005, E-004. "Mirrors" names the per-element template whose mitigation/verification sets are reused 1:1 (P1).

| ID | STRIDE | Persp. | Slot | Context | Mirrors |
|---|---|---|---|---|---|
| S-004 | S | receiver | — | `self.elementType: [Sensor]`, `edge.medium: [physical]`, `edge.couplingMode: [active_reflection]` | S-005 |
| T-011 | T | receiver | — | `edge.medium: [physical]`, `self.elementType: [Sensor]` | T-015 (physical half) |
| T-012 | T | receiver | — | + `stimulusDomain: [acoustic]` | T-017 |
| T-013 | T | receiver | — | + `stimulusDomain: [optical]` | T-018 |
| T-014 | T | receiver | — | + `stimulusDomain: [rf, electric_field]` | T-019 |
| T-015 | T | receiver | — | + `stimulusDomain: [magnetic]` | T-020 |
| T-016 | T | receiver | — | + `stimulusDomain: [thermal, mechanical]` | T-021 |
| T-017 | T | receiver | — | + `stimulusDomain: [chemical]` | T-022 |
| D-006 | D | receiver | — | `edge.medium: [physical]`, `self.elementType: [Sensor]` | D-007 |
| D-007 | D | receiver | — | + `stimulusDomain: [optical, acoustic, rf, electric_field, magnetic]`, `lossDetection: [none]` | D-009 |
| S-005 | S | sender | — | `self.elementType: [Sensor]`, `edge.medium: [logical]` (readout) | S-003 |
| T-018 | T | sender | — | `self.elementType: [Sensor]`, `edge.medium: [logical]` | T-015 (signal-path half) |
| T-019 | T | receiver | — | `peer.elementType: [Sensor]`, `peer.plausibilityCheck: [none, range]` | consumer side of T-015: the Process acts on a manipulated reading. Mitigations come from the upstream Sensor (M-S-011, M-TD-T-004, M-TD-T-005) |
| D-008 | D | receiver | — | `peer.elementType: [Sensor]` | D-007 (consumer: missing/stale reading) |
| S-006 | S | receiver | — | `self.elementType: [Actuator]`, `edge.messageType: [command]` or unset | S-004 (command half) |
| S-007 | S | sender | — | `self.elementType: [Actuator]` (feedback flow) | S-004 (feedback half) |
| T-020 | T | receiver | — | `self.elementType: [Actuator]` | T-016 |
| T-021 … T-026 | T | receiver | — | + `actuatorClass: [motion]`, `[flow]`, `[power_switching]`, `[thermal]`, `[dispensing]`, `[signaling]` | T-025 … T-030 |
| D-009 | D | receiver | — | `self.elementType: [Actuator]` | D-008 |
| D-010 | D | receiver | — | + `safeState: [none_defined, hold_last]` | D-010 (pe) |
| D-011 | D | receiver | — | + `actuatorClass: [motion]`, `safeState: [de_energize_to_safe]` | D-011 (pe) |
| T-027 | T | receiver | `firmware` | `self.elementType: [Sensor, Actuator]`, `edge.messageType: [firmware]` | T-023 |
| T-028 | T | receiver | `calibration` | `self.elementType: [Sensor, Actuator]`, `edge.messageType: [config]` | T-024 |
| I-004 | I | sender | `diagnostics` | `self.elementType: [Sensor, Actuator]`, `secondaryChannel: [diagnostics, health_status, config]`, `edge.messageType: [status, telemetry, config]` | I-006 |

Interaction texts use the existing placeholders (`{{sourceName}}`, `{{targetName}}`, …), e.g. T-019: *"{{targetName}} acts on a reading from {{sourceName}} that was manipulated at the sensor or on the line"*.

### 7.4 Element-anchored placement in per-interaction ✅

There is precedent: Interface and PhysicalBoundary threats in per-interaction are already element-anchored (`generateInterfaceElementThreats`, `generatePhysicalBoundaryElementThreats`). Two transducer cases use the same route and the **per-element templates directly**, which gives exact parity:

1. **Variant B (no inbound physical edge).** `physicalInbound` is empty, so the Sensor's physical-surface threats (S-005 if applicable, T-015/T-017…T-022, D-007/D-009) are generated element-anchored on the Sensor. The readout flow keeps its own templates (S-005/T-018/T-019 interaction).
2. **Declared but unmodelled secondary channels.** For each capability in `unmodelledSecondaryChannels`, the slotted per-element template (T-023, T-024, I-006) is generated element-anchored.

Element-anchored threats use the natural key `el::<id>::<stride>[::<slot>]`, which is today's interface key plus the slot. A validator **info** finding (`transducerSecondaryChannelUnmodelled`) tells the analyst that modelling the reverse flow would give a flow-anchored, more precise threat. It is info, not warning: the threat is still covered.

### 7.5 Parity check (by construction)

| Per-element threat | Per-interaction equivalent |
|---|---|
| Sensor physical T/D/S (T-015…T-022, D-007, D-009, S-005) | Variant A: T-011…T-017, D-006, D-007, S-004 on the physical edge. Variant B: the same per-element templates, element-anchored |
| Sensor S-003 (rogue sensor) | S-005 sender on the readout flow |
| Sensor T-015 signal path | T-018 sender + T-019 receiver on the readout flow |
| Actuator T-016/T-025…T-030 | T-020…T-026 receiver on the command flow |
| Actuator D-008/D-010/D-011 | D-009…D-011 receiver on the command flow |
| Actuator S-004 | S-006 (command) + S-007 (feedback) |
| Slots T-023/T-024/I-006 | T-027/T-028/I-004 on the modelled flow, else element-anchored |

---

## 8. Mitigations and verifications

### 8.1 New file `mitigations-transducer.json` (prefix `M-TD-`, following `M-CB-`/`M-PB-`/`M-IF-`)

| ID | STRIDE | Mitigation | attackVectors | iec62443 | affectsProperties |
|---|---|---|---|---|---|
| M-TD-T-001 | T | Harden the analogue front end against out-of-band coupling: input filtering and anti-aliasing with margin above the measurement band, shielded/twisted/short leads, layout and grounding for immunity beyond the product EMC test levels | physical | — | — |
| M-TD-T-002 | T | Shield the sensing surface for its domain (optical filter/hood, acoustic damping mesh, magnetic shielding) without degrading the intended measurand | physical | — | Sensor.`sensingExposure` = `shielded` (heuristic) |
| M-TD-T-003 | T | Detect out-of-band energy in the sensor's domain (ultrasound, RF, laser) and flag or reject readings taken while it is present | physical | cr-3.4 | — |
| M-TD-T-004 | T | Diverse redundancy: cross-check with a second sensor using a different transduction principle or supplier; homogeneous redundancy does not cover common-mode injection | physical | — | Sensor.`redundancy` = `diverse` (deterministic) |
| M-TD-T-005 | T | Model-based plausibility: check readings against a physical/process model, rate limits and correlated quantities | physical | cr-3.5 | Sensor.`plausibilityCheck` = `model_based` (deterministic) |
| M-TD-T-006 | T | Component provenance: authorized distribution, HBOM, incoming inspection against a reference sample (component values, visual/X-ray, impedance profile) to detect counterfeit or manipulated analogue parts | physical | — | — |
| M-TD-S-001 | S | Authenticate echoes of active sensors (coded/randomised probing, timing consistency) | physical | — | — |
| M-TD-D-001 | D | Detect saturation, stuck-at and blinding (signal-quality flags, noise-floor monitoring) and treat as loss of reading | physical | cr-3.4 | Sensor.`lossDetection` = `detected_degraded` (heuristic) |
| M-TD-T-007 | T | Signed, versioned transducer firmware with anti-rollback, verified on the device before activation | network, local | cr-3.4, cr-3.14 | — |
| M-TD-T-008 | T | Protect calibration: authorized calibration only, bounded adjustment range, integrity-protected and logged calibration records | network, local | cr-2.1, cr-3.1 | — |
| M-TD-I-001 | I | Restrict diagnostic/health/config read-out: authentication, minimal content, disable or lock in operation | network, local | cr-2.1, cr-4.1-transit | — |
| M-TD-T-011 | T | Fail-obvious indication: independent liveness/heartbeat on displays and signal lamps, redundant indication path for safety-relevant states | network, local | — | — |
| M-TD-D-002 | D | Define and design the safe state per actuator class (e.g. spring-applied brake for motion, normally-closed/-open selection for flow) and verify it under power and command loss | physical | cr-3.6 | Actuator.`safeState` ≠ `none_defined` (heuristic) |
| M-TD-D-003 | D | Independent safe-state trigger path (hardwired emergency stop / STO) that does not depend on the command channel | physical | — | Actuator.`hardwareInterlock` = `independent` (heuristic) |

### 8.2 `affectsProperties` on existing mitigations (closed loop, F6)

| ID | affectsProperties |
|---|---|
| M-S-009 | Sensor.`signalAuthentication` = `cryptographic` (deterministic) |
| M-S-010 | Sensor.`signalAuthentication` = `source_authenticated` (heuristic) |
| M-S-011 | Sensor.`plausibilityCheck` = `range_rate` (heuristic) |
| M-S-012, M-T-017 | Actuator.`commandAuthentication` = `cryptographic` (deterministic) |
| M-S-015 | Actuator.`feedbackVerification` = `closed_loop_independent` (deterministic) |
| M-T-016 | Sensor.`redundancy` = `homogeneous` (heuristic; text clarified: "does not cover common-mode") |
| M-T-019 | Actuator.`hardwareInterlock` = `independent` (deterministic) |
| M-D-011 | Sensor.`lossDetection` = `detected_failsafe` (heuristic) |
| M-D-014 | Actuator.`failBehavior` = `fail_safe` (heuristic) |

`implemented-controls-mapper` gets the reverse direction: a property set to a strong value yields the mitigation as an "implemented" hint (e.g. `redundancy = diverse` → M-TD-T-004; `hardwareInterlock = independent` → M-T-019).

### 8.3 New file `verifications-transducer.json` (prefix `V-TD-`)

| ID | Verification |
|---|---|
| V-TD-T-001 | Out-of-band susceptibility sweep in the sensor's stimulus domain **beyond** the product-standard EMC levels and frequency range (e.g. amplitude-modulated ultrasound, RF incl. lead resonances, modulated light); record output deviation |
| V-TD-T-003 | Inject a controlled deviation into one channel of the diverse pair; verify detection and the specified reaction |
| V-TD-T-004 | Feed physically implausible profiles (step, excessive rate, frozen value, inconsistent correlated quantity); verify rejection |
| V-TD-T-005 | Incoming inspection on a sample basis against the reference sample and HBOM (component values, visual/X-ray, impedance profile) |
| V-TD-S-001 | Replay/forge echoes against the active sensor; verify detection |
| V-TD-D-001 | Drive the sensor into saturation/blinding; verify the loss detection triggers instead of a stuck plausible value |
| V-TD-T-006 | Attempt to install unsigned, modified and older firmware; verify rejection |
| V-TD-T-007 | Attempt unauthorized and out-of-range calibration; verify rejection and logging |
| V-TD-I-001 | Access the diagnostic/health interface unauthenticated and in operation; verify restriction |
| V-TD-T-008 | With the controller assumed compromised (HIL/test bench), command beyond limits; verify the independent physical limit holds |
| V-TD-T-009 | Freeze or falsify the indication path; verify the operator can detect it (liveness indicator) |
| V-TD-D-002 | Safe-state test per actuator class under power loss, command loss and controller reset; verify the load is held or released safely |

(`V-TD-T-002` is intentionally unused: the shielding-effectiveness check is part of V-TD-T-001.)

### 8.4 Source note

M-TD-T-006, V-TD-T-001 and V-TD-T-005 respond directly to analogue supply-chain implants (SenTrojan, arXiv 2611.06103) and to signal-injection work (DolphinAttack, Ghost Talk). By design, implants are **not** a default template: they would add a rarely realistic threat to every sensor. The physical-injection templates cover them through these mitigations, because the countermeasures largely coincide (immunity, diverse redundancy, plausibility).

---

## 9. Tests

| Test | Asserts |
|---|---|
| `catalog-integrity` (extend) | All new IDs resolve; every template mitigation/verification exists; `slot` ∈ allowed set; slotted templates restricted to transducers; en+de texts present for every new template, mitigation and verification |
| `threat-catalog-service.unset-weak` (extend) | `MATCHED_CONTEXT_KEYS` includes all §4.1 keys; `edge.*`/`peer.*` keys are matched (guard: no unknown nested key) |
| `context-scope.test.ts` (new) | Flat key resolution: `FLOW_SCOPED_FLAT_KEYS` from edge, others from self; **regression F2**: embedded interaction T-006/D-003 match a `field_cable` flow into an Actuator |
| `transducer-context.test.ts` (new) | Variant A/B detection; worst-case aggregation; `unmodelledSecondaryChannels` vs `messageType` |
| `transducer-stride.test.ts` (new) | Sensor/Actuator +I with diagnostics; physical DataFlow → ∅ per-element; physical-world EE → ∅; physical-stimulus S only with `active_reflection` |
| `slots.test.ts` (new) | Primary + slotted emission; natural keys (primary unchanged, slot suffixed); stable sequence numbers; sync compares `(stride, slot)` |
| `interaction-transducer.test.ts` (new) | Classifier per kind; receiver-only on physical edges; F5 scope (Sensor without TB fed by EE); Variant B element-anchored; peer-aware T-019 |
| `transducer-parity.test.ts` (new) | For a fixture matrix (domains × classes × Variant A/B × slots), the **multiset of (mitigation set, verification set)** emitted per transducer is equal in both methods. The parity table lives in `transducer-parity.ts` (per-element id ↔ interaction ids) |
| `threat-generation-drift` (update snapshot) | Expected changes only: removed cyber threats on physical edges/world EE; new variants |

---

## 10. Implementation phases

Each phase builds and tests on its own and is delivered as its own `.diff` + commit message. Order matters: 0 and 1 are infrastructure without catalogue content.

| Phase | Scope | Touches | Standalone effect |
|---|---|---|---|
| **0 — Defect fixes** | F1 modifier rewrite (no new behaviour, just real props); F2 scoped resolution (`FLOW_SCOPED_FLAT_KEYS`); F3 physical DataFlow → ∅ in both methods; F4 world EE → ∅; F5 scope fallback | `stride-modifier.ts`, `threat-catalog-service.ts`, both generators | Less noise, T-006/D-003 work for transducer flows |
| **1 — Context model** | §4.1 keys, `edge`/`peer` scopes, `elementType` key, `buildTransducerContext` | `threat-types.ts` (`TemplateContext`), `threat-catalog-service.ts`, new `services/transducer/` | No visible change; enables 3–5 |
| **2 — Mitigations / verifications** | §8.1, §8.3 files + i18n en/de; §8.2 `affectsProperties`; mapper entries | catalogue JSON, `threat-catalog-service.ts` imports, `implemented-controls-mapper.ts` | New controls selectable in the Risk tab; closed loop for transducers |
| **3 — Per-element templates** | §6.1 I-extension, §6.2 non-slotted variants + i18n | embedded per-element JSON + locales | Specific per-element threats |
| **4 — Per-interaction** | Classifier, §7.2 STRIDE/perspectives, §7.3 non-slotted templates, §7.4 Variant B, impact anchor | `interaction-generator.ts`, new classifier, embedded per-interaction JSON + locales | Per-interaction on par with per-element |
| **5 — Slots** | §5 mechanism in both generators + sync + identity; slotted templates T-023/T-024/I-006 and T-027/T-028/I-004; §7.4 case 2; validator info finding | generators, `threat-identity.ts`, `element-sync.ts`, `interaction-sync.ts`, validator, catalogue | Distinct firmware/calibration/diagnostics threats in both methods |
| **6 — Parity, examples, docs** | `transducer-parity.ts` + test; `TARAflow_Examples` fixture (SmokeDetector + a CPS example with Variant A, active sensor, actuator classes); update `ELEMENT-sensor-actuator_v0_5.md` §8/§9/§10 to point here | tests, examples, docs | Locks symmetry against regression |

Phase 3 without phase 4 temporarily recreates the asymmetry this document wants to avoid. **Ship 3 and 4 in the same release** (separate commits are fine).

### Migration / release note

- No schema change: all new fields are template/catalogue fields; the project file is untouched.
- On regeneration: threats previously generated on physical edges and on world EEs disappear. `mergeGeneratedTables` treats them as removed. Threats carrying analyst data surface through the existing reconciliation path, so nothing is lost silently. The release note says so explicitly.
- Primary-slot natural keys are unchanged, so analyst fields on existing transducer threats (S/T/D) are kept even when their template switches from the fallback to a variant. The template text changes; `templateId` documents the change.

---

## 11. Out of scope / open

- ⬜ **Actuator emission domain** (v0.5 §10). `emission`-class actuators use the fallbacks until an actuator-side domain field exists.
- ⬜ **`transducer-coupling` / direct physical loop** (Sensor → physical → Actuator, `hardwareInterlock = independent` path).
- ⬜ **Full two-hop consequence propagation** beyond the asset-linking impact anchor of §7.2 (risk-level chaining stimulus → readout → command → physical effect).
- ⬜ **Feasibility defaults** from `sensingExposure` / `injectability` / `controllability` into the attack-potential presets (ISO 21434, EN 50742 Approach A). Today they are rationale only (P7). The natural next step once the presets read element facts.
- ⬜ **Active-sensor authoring affordance** (dual-role element, v0.5 §2.2).
- ⬜ **Slots for other element types** (e.g. Process firmware update). The mechanism is generic, but the rollout is a separate decision.
- ⬜ **Template ID collision hygiene**: IDs are scoped by domain and by per-element vs per-interaction locale path (`S-003` exists in three places). Works today; a later catalogue-wide prefix scheme would make cross-references in reports unambiguous.
