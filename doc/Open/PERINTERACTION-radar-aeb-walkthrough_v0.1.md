# Per-Interaction Walkthrough — Active Radar in an AEB Chain

**Version:** 0.1 (draft) · Companion to `ELEMENT-sensor-actuator_v0.4.md` §8.2 · **Purpose:** make per-interaction concrete on one real active sensor before building Phase 6.

The same pattern applies, at lower severity, to the RINCO ultrasonic rangefinder and to a Sigrist optical path — radar is used here because the consequence is unambiguous (automatic emergency braking).

---

## 1. The modelled chain

The radar is a **dual-role** element (Sensor + `emission` Actuator), per v0.4 §2.2.

```
                         (E) emission                    (R) reception
 Radar[emission role] --[PhysChan rf, emission]--> Environment
 Environment          --[PhysChan rf, active_reflection]--> Radar[sensor role]
 Radar[sensor role]   --[DataFlow]--> Perception/Fusion (Process)
 Perception (Process) --[DataFlow]--> Brake (Actuator, class=motion/flow, hazardPotential=catastrophic)
 Brake (Actuator)     --[PhysChan mechanical, actuation]--> Environment   ← hazard manifests here
```

Five interactions, four kinds:

| # | Interaction | Kind | Connector / couplingMode |
|---|---|---|---|
| I1 | Radar → Env | `physical-actuation` (emission) | PhysChan rf, `emission` |
| I2 | Env → Radar | `physical-stimulus` | PhysChan rf, `active_reflection` |
| I3 | Radar → Process | `transducer-readout` | DataFlow |
| I4 | Process → Brake | `actuation-command` | DataFlow |
| I5 | Brake → Env | `physical-actuation` | PhysChan mechanical, `actuation` |

## 2. Threats generated per interaction

| ID | At | STRIDE / goal | Threat | Gated by | Mitigations (and where they live) |
|---|---|---|---|---|---|
| T5 | I1 | Info disclosure (recon) | Waveform characterisation — attacker learns the radar's signal to craft spoofing | `couplingMode=emission`, channel `exposure` | Waveform randomisation (channel/emission role). **Enabler for T1/T4.** |
| T1 | I2 | Spoofing / Integrity | **Ghost-target injection** — false echoes create non-existent obstacles | `couplingMode=active_reflection`, `injectability` | Diverse redundancy = camera/LiDAR fusion (Sensor role `redundancy=diverse`); micro-Doppler/plausibility (`plausibilityCheck`); chirp randomisation (channel) |
| T2 | I2 | Tampering / Integrity | **Target masking** — real obstacle hidden/absorbed | `active_reflection`, `exposure` | Cross-sensor fusion; `lossDetection` |
| T3 | I2 | DoS / Availability | Jamming / saturation — loss of detection | `exposure`, `injectability` | `lossDetection` → safe degradation (handover / minimal-risk manoeuvre) |
| T4 | I2 | Spoofing | Replay of captured scene — stale/false world | `active_reflection` | Freshness/sequence checks; waveform randomisation |
| T6 | I3 | Tampering (receiver view) | Process consumes spoofed object list as truth | — | **Mitigations live upstream** (T1/T2 controls) + at Process (fusion sanity, temporal consistency) |
| T7 | I4 | Tampering / Spoofing | Command injection / wrong brake command | `commandAuthentication` | `commandAuthentication`, `feedbackVerification` |
| T8 | I5 | (consequence) | Unintended braking **or** failure to brake | `safeState`, `hardwareInterlock` | `hardwareInterlock=independent`; driver override |

Note T6: this is the **upstream-mitigation** case. The threat surfaces where the Process trusts the input (I3), but nothing on I3 itself fixes it — the controls sit on the Sensor role and the I2 channel. The generator must read source-element + connector properties when scoring an interaction, not just the interaction.

## 3. Two-hop propagation (the actual chain)

The dangerous threat is not "a threat at I2". It is a **path**:

```
T1 ghost target        (cause: I2, active_reflection)
   → false object list (I3 transducer-readout)
   → phantom-brake decision (I4 actuation-command)
   → emergency braking on empty road (effect: I5 physical-actuation)
   → rear-end collision                              [HAZARD]
```

Cause and effect are **three interactions apart**. A classic STRIDE-DFD records the threat at one node and loses the chain. The risk-register entry here needs a triple: **(cause-interaction, propagation-path, effect-interaction)**.

## 4. What this forces on the Phase 6 generator

Four concrete requirements fell out of this one example:

1. **Walk the chain, don't score nodes in isolation.** A transducer-chain threat is a path from an injection interaction to a hazard interaction.
2. **Threat = (cause-interaction, effect-interaction, path).** Not a single location. The risk register links both ends.
3. **Mitigations are collected along the path** (channel waveform randomisation → sensor plausibility → process fusion → actuator interlock). This is defence-in-depth *across elements* — a single element never "fixes" a chain threat. Residual risk = the weakest combination along the path.
4. **Severity propagates *backward*.** I2 (the radar reception) is only `catastrophic` because of what it eventually drives at I5. Severity is inherited from the **effect end** (`Brake.hazardPotential`), not computed at the injection point. → the generator needs a **backward severity pass** from each Actuator's `hazardPotential`/`safetyClassification`, then a **forward cause pass** from each injectable interaction. The same ghost-target threat on a parking-assist chirp (low hazardPotential) is a nuisance; on AEB it is catastrophic — identical mechanism, severity set by the endpoint.

Point 4 is the non-obvious one and the reason per-interaction is worth the effort: it is what lets TARAflow say *why* two structurally identical attacks rank completely differently.

## 5. Open questions this surfaced

- Path explosion: in a real vehicle one radar feeds many decisions. Cap path enumeration depth, or stop at the first Actuator? (Likely: enumerate to each reachable Actuator, dedupe by mechanism.)
- Where does the residual-risk number attach — to the path, or to the cause interaction with the path as evidence?
- Fusion as a mitigation is itself attackable (defeat camera *and* radar together). Does the model need to express correlated/common-mode defeat of `redundancy=diverse`?
