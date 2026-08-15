# DFD Element Properties — Structure & Rationale

## Design Philosophy

Each DFD element form is structured in three tiers. The order mirrors the analyst's natural thinking process:

> **"What is this?" → "How is it protected?" → "Who owns it?"**

This structure ensures that the fields most relevant to automated threat generation are always visible and filled in first, while documentation and governance fields remain accessible without cluttering the primary workflow.

---

## Three-Tier Structure

### Tier 1 — Context
**Purpose:** Establish what the element is and how it operates.

These fields directly determine which threats the generator produces. An unset `technology` field means the generator cannot distinguish between a bare-metal bootloader and a REST API. An unset `dataClassification` means it cannot prioritise information disclosure threats appropriately.

**Rule:** Every analyst should fill these fields before moving to the next section.

### Tier 2 — Security
**Purpose:** Describe what protections are in place (or missing).

These fields refine the threat analysis. A process with `authenticationRequired = none` will produce Spoofing threats with higher priority. A data flow with `encryptionInTransit = none` crossing a trust boundary will trigger an explicit warning. A data store with `containsSafetyRelevantData = true` will escalate Tampering and DoS threats.

**Rule:** These fields should be set during the threat modelling session, not afterwards.

### Tier 3 — Documentation
**Purpose:** Capture governance, audit trail and free-form description.

These fields are used by the documentation generator (IEC 62443-4-1 traceability, EN 50742 safety documentation, MVO compliance). They do not influence threat generation directly.

**Rule:** These fields can be filled iteratively — they do not block the threat analysis workflow.

---

## Why No Accordions

The previous form design used an "Advanced / Optional" accordion. This was removed for two reasons:

1. **"Optional" signals to analysts that the field can be skipped.** Technology, safety relevance, and exposure level are not optional — they are core inputs to the threat model.
2. **Accordions in a scrollable panel create double navigation.** The forms live in a 500px slide-over panel that already scrolls. Adding a collapse layer creates unnecessary friction.

The replacement pattern is a thin `Divider` with an `overline` label — visible structure without cognitive overhead.

---

## Parameter Reference

### Process

| Field | Tier | Threat Impact | Notes |
|---|---|---|---|
| `technology` | Context | High — determines applicable STRIDE categories | e.g. `bootloader` triggers Tampering + EoP; `rtos_task` scopes to embedded threats |
| `processSemantic` | Context | High — distinguishes OS isolation from logical blocks | `functional_block` = no hardware boundary; `security_boundary` = HSM/TEE |
| `runsAs` | Context | Medium — privilege context for EoP threats | |
| `privilegeLevel` | Context | High — root/high privilege escalates EoP priority | |
| `authenticationRequired` | Security | High — none/optional triggers Spoofing threats | |
| `authorizationModel` | Security | Medium — none triggers EoP threats | |
| `inputValidation` | Security | Medium — none/basic triggers Tampering threats | |
| `errorHandling` | Security | Low — verbose can trigger Information Disclosure | |
| `exposedToInternet` | Security | High — escalates all STRIDE when true | |
| `owner` | Documentation | None | Governance / audit |
| `notes` | Documentation | None | |
| `description` | Documentation | None | Doc generator input |

---

### External Entity

| Field | Tier | Threat Impact | Notes |
|---|---|---|---|
| `entityType` | Context | Medium — sets base threat profile defaults | Drives `trustLevel` and `threatActor` defaults |
| `trustLevel` | Context | High — low trust escalates Spoofing and Repudiation | |
| `ownership` | Context | Medium — external entities are higher risk | |
| `threatActor` | Security | Medium — used in attack tree feasibility scoring | `advanced` / `nation-state` escalates branch feasibility |
| `authenticationMethod` | Security | High — none triggers Spoofing | |
| `rateLimited` | Security | Low — false can escalate DoS threats | |
| `contractExists` | Security | Low — governance signal | |
| `authorizationScope` | Security | Low | |
| `owner` | Documentation | None | |
| `notes` | Documentation | None | |
| `description` | Documentation | None | |

---

### Data Store

| Field | Tier | Threat Impact | Notes |
|---|---|---|---|
| `technology` | Context | High — determines threat templates | `flash`/`eeprom` = embedded-specific threats; `cloud` = misconfiguration threats |
| `dataClassification` | Context | High — `confidential`/`secret` escalates Information Disclosure | |
| `storedDataTypes` | Context | Medium — free text used in doc generator | |
| `encryptionAtRest` | Security | High — none triggers Tampering + Information Disclosure | |
| `accessControl` | Security | High — missing control triggers EoP + Tampering | |
| `integrityProtection` | Security | High — false triggers Tampering | |
| `multiTenant` | Security | Medium — escalates Information Disclosure between tenants | |
| `backupEnabled` | Security | Low — false triggers DoS (data loss) priority | |
| `containsSafetyRelevantData` | Security | **Critical** — escalates Tampering and DoS to Safety impact | EN 50742 / MVO 2027 requirement |
| `safetyRationale` | Security | None (audit trail) | Required when `containsSafetyRelevantData = true` |
| `deletionPolicy` | Documentation | None | GDPR / compliance |
| `owner` | Documentation | None | |
| `notes` | Documentation | None | |
| `description` | Documentation | None | |

---

### Data Flow

| Field | Tier | Threat Impact | Notes |
|---|---|---|---|
| `protocol` | Context | High — determines applicable attack vectors | `modbus`/`can` = OT-specific; `mqtt` = broker threats |
| `direction` | Context | Medium — `bidirectional` is forbidden (validator C7) | |
| `dataTypes` | Context | Medium — used in doc generator | |
| `frequency` | Context | Low — `continuous` with wrong verb triggers validator warning | |
| `exposureLevel` | Security | **Critical** — EL4 = all STRIDE at maximum priority | Primary attack surface signal per EN 50742 Annex B |
| `encryptionInTransit` | Security | High — none + TB crossing triggers explicit warning | |
| `endpointAuthentication` | Security | High — none triggers Spoofing | |
| `integrityProtection` | Security | High — false triggers Tampering | |
| `safetyRelevant` | Security | **Critical** — escalates to physical impact | EN 50742: safety-relevant interfaces require extra scrutiny |
| `crossesSafetyBoundary` | Security | **Critical** — auto-derived, read-only | True when one side is safety-relevant and the other is not |
| `excludeFromThreatGen` | Security | Direct — skips this DF in generator | Requires rationale for IEC 62443-4-1 audit trail |
| `excludeFromThreatGenRationale` | Security | None (audit trail) | Required when `excludeFromThreatGen = true` (validator C9) |
| `notes` | Documentation | None | |
| `description` | Documentation | None | |

---

### Interface

| Field | Tier | Threat Impact | Notes |
|---|---|---|---|
| `type` | Context | High — `usb`/`jtag`/`gpio` = physical attack surface | |
| `location` | Context | Low — physical context for threat assessment | |
| `exposureLevel` | Security | **Critical** — primary EL carrier in the graph | Inherited by connected DFs if not overridden |
| `accessControl` | Security | High — none triggers Spoofing + Tampering | |
| `safetyRelevant` | Security | **Critical** — EN 50742 "safety-relevant interfaces" | e.g. programming port on Safety PLC |
| `isShieldedCable` | Security | Low — affects EMI-related physical threats | |
| `notes` | Documentation | None | |
| `description` | Documentation | None | |

---

### Trust Boundary

| Field | Tier | Threat Impact | Notes |
|---|---|---|---|
| `boundaryType` | Context | High — determines applicable boundary controls | `peripheral`/`boot`/`debug` = embedded-specific |
| `defaultExposureLevel` | Context | **Critical** — inherited by all elements and interfaces inside | Sets baseline EL for the entire zone |
| `securityAssumptions` | Security | High — explicit trust assumptions required for IEC 62443 | "Inside is trusted, outside is hostile" |
| `boundaryControls` | Security | Medium — describes what enforces the boundary | |
| `monitoringEnabled` | Security | Low — false can escalate Repudiation threats | Note: use PhysicalBoundary.monitoringType for physical monitoring |
| `complianceRelevance` | Documentation | None | IEC 62443 zone / conduit reference |
| `owner` | Documentation | None | |
| `notes` | Documentation | None | |
| `description` | Documentation | None | |

---

### Chip Boundary
 
Represents a hardware chip boundary — a physical silicon component with its own
security perimeter. Unlike a Trust Boundary (logical) or Device Boundary (physical
enclosure), a Chip Boundary is connectable: DataFlows may terminate at or originate
from it via an Interface element placed on the boundary edge.
 
**Connectable:** Yes — DFs may terminate at the boundary via an Interface symbol.
 
**Valid connections:** ExternalEntity ↔ ChipBoundary, Process ↔ ChipBoundary,
ChipBoundary ↔ ChipBoundary. DataStore and TrustBoundary connections are forbidden (R9).
 
| Field | Tier | Threat Impact | Notes |
|---|---|---|---|
| `chipType` | Context | **Critical** — determines threat generator selection | `mcu`/`som`/`dsp` → Firmware/JTAG threats; `fpga` → Bitstream threats; `se`/`hsm` → Key/Side-Channel threats |
| `defaultExposureLevel` | Context | **Critical** — EL0 = internal only, EL1 = physical access required | SE/HSM default EL0; MCU/SOM/FPGA default EL1 |
| `debugInterfacePresent` | Security | **Critical** — `jtag`/`swd` present triggers Debug Access threat | If present and not locked: mandatory Elevation of Privilege threat |
| `debugInterfaceLocked` | Security | High — false + interface present = active attack surface | STM32: RDP≥1; FPGA: JTAG fuse blown |
| `secureBootEnabled` | Security | High — false triggers Bootloader Tampering threat | Required for firmware integrity |
| `firmwareProtection` | Security | High — `none` triggers Firmware Readback threat | MCU/SOM/DSP only; FPGA uses `bitstreamEncryption` |
| `bitstreamEncryption` | Security | High — false triggers Bitstream Readback / IP Theft threat | FPGA only |
| `tamperProtection` | Security | Medium — `none` reduces physical attack cost | `active` = voltage glitch / temperature / mesh detection |
| `safetyRelevant` | Security | Critical — escalates all chip threats to Safety impact | EN 50742: safety-relevant hardware requires extra scrutiny |
| `safetyRationale` | Security | None (audit trail) | Required when safetyRelevant = true |
| `supplyChainTrust` | Security | Medium — `unverified` triggers Hardware Trojan threat class | Especially relevant for SOM (third-party module) |
| `notes` | Documentation | None | Context-specific guidance auto-populated from `chipType` |
| `description` | Documentation | None | Doc generator input |
 
**chipType → Threat Generator mapping:**
 
| chipType | Primary Threats | STRIDE |
|---|---|---|
| `mcu` | JTAG Access, Firmware Tampering, Secure Boot Bypass, Firmware Readback | T, I, E |
| `som` | JTAG Access, Firmware Tampering, Supply Chain Compromise | T, I, E |
| `fpga` | Bitstream Tampering, Bitstream Readback, Partial Reconfiguration Attack | T, I, E |
| `se` | Key Extraction, Side Channel Attack, Physical Tampering | T, I |
| `hsm` | Physical Tampering, Key Extraction (requires active tamper bypass) | T, I |
| `dsp` | Firmware Tampering, JTAG Access (same profile as MCU) | T, I, E |

---


### Physical Boundary

Represents a spatially-defined physical access barrier — enclosure, cabinet, room,
building, vehicle, or tamper zone. Answers the question: **"Who can physically reach this?"**

Semantically distinct from TrustBoundary (logical/policy) and ChipBoundary (hardware
isolation). PhysicalBoundary is a **spatial container** — not connectable via DataFlow.
Elements inside share the same physical access precondition for threat feasibility.

**Connectable:** No — PhysicalBoundary has no communication interface of its own.
Interaction through a PhysicalBoundary is modelled via an Interface element that
geometrically overlaps the boundary edge.

**Membership:** Elements that geometrically overlap a PhysicalBoundary are considered
inside it. This determines `crossesPhysicalBoundary` on DataFlows and drives
`physicalExposureLevel` inheritance on Assets.

| Field | Tier | Threat Impact | Notes |
|---|---|---|---|
| `boundaryType` | Context | **Critical** — selects threat templates and cascade defaults | `device_enclosure`/`vehicle` = device threats; `cabinet`/`room` = access control threats; `tamper_zone` = PEL0 sealed |
| `physicalExposureLevel` | Context | **Critical** — PEL0–PEL4; higher = more exposed | Distinct from EL scale on DataFlow. PEL4 = directly exposed (touchscreen, outdoor USB) |
| `physicalMobility` | Context | **Critical** — opens Evil-Maid / Depot Attack threat class | Only for `device_enclosure` + `vehicle`. `portable` = full lab attack possible |
| `accessibility` | Context | High — public/controlled/guarded determines attacker environment | Orthogonal to PEL: same PEL device in public vs. guarded = different threat landscape |
| `physicalAccessControl` | Security | High — `none` triggers Uncontrolled Access threat; `badge` triggers Relay Attack | |
| `tamperProtection` | Security | High — `none` = manipulation leaves no trace | `active_detection` = voltage/temp sensor with zeroize response |
| `monitoringType` | Security | Medium — `none` triggers Repudiation threat; `soc` = active response | Distinct threat-reduction levels: camera ≠ SOC |
| `requiresToolAccess` | Security | Medium — raises attacker effort, reduces opportunistic attack risk | Only for `device_enclosure`, `vehicle`, `cabinet` |
| `debugInterfaceAccessible` | Security | **Critical** — `true` triggers Debug Attachment + Firmware Readback threats | Physical reachability of port — distinct from ChipBoundary.debugInterfacePresent (existence) |
| `removableMediaAccessible` | Security | High — `true` triggers Removable Media Insertion + Data Exfiltration | Physical accessibility, not SW policy |
| `safetyRelevant` | Security | **Critical** — escalates all physical threats to Safety impact | EN 50742 / MVO 2027: safety-relevant physical boundaries require documented controls |
| `safetyRationale` | Security | None (audit trail) | Required when `safetyRelevant = true` |
| `owner` | Documentation | None | Governance / audit |
| `notes` | Documentation | None | Security assumptions placeholder auto-populated from `boundaryType` |
| `description` | Documentation | None | Doc generator input |

**physicalMobility → Threat Generator mapping:**

| physicalMobility | Primary Threats | STRIDE |
|---|---|---|
| `fixed` | Unauthorized Physical Access, Cable Tampering (on-site only) | S, T, R |
| `removable` | Depot Attack, Hardware Swap, Maintenance Abuse | T |
| `portable` | Evil-Maid Attack, Firmware Implant, Lab Side-Channel, Device Substitution | T, I, E |
| `vehicle_mounted` | Vehicle Theft, Field Manipulation during Maintenance | T, D |

**physicalMobility=portable + safetyRelevant=true** → additionally generates:
Rogue Calibration Device, Safety-Critical Firmware Implant.

**Three orthogonal boundary dimensions** (no overlap in semantics):

| Boundary | Question | Protection via |
|---|---|---|
| `TrustBoundary` | Who trusts whom? | Firewall, Auth, Policy |
| `ChipBoundary` | What HW isolation exists? | MPU, TrustZone, Debug fuses |
| `PhysicalBoundary` | Who can physically reach this? | Enclosure, lock, badge, seal |

---

## Future Extensions

The following properties are reserved for the **Generator Strategy Pattern** (planned):

- `ProcessProperties.processSemantic` → will reduce STRIDE categories for `functional_block` (no hardware isolation boundary, Tampering and DoS only for internal DFs)
- `DataFlowProperties.assumedTrusted` → will reduce STRIDE to T + D for explicitly trusted internal flows
- `ExternalEntityProperties.threatProfile` → will initialise branch feasibility scores in attack tree generation (Phase 3)
- `technology` mapping → `bootloader + !secureBootEnabled → T, E` / `protocol_stack → S, D` / `driver + externalPeripheral → T`
- `ChipBoundaryProperties.chipType` → will gate threat generator selection:
  `mcu/dsp` → Firmware + JTAG threat class; `fpga` → Bitstream threat class;
  `se/hsm` → Key Extraction + Side Channel threat class.
  `debugInterfaceLocked = false` + interface present → mandatory EoP threat.
  `secureBootEnabled = false` → mandatory Tampering threat.
  `supplyChainTrust = unverified` → Hardware Trojan threat class (Phase 3).
