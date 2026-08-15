# DFD Element Properties — Cascade Rules

When an analyst selects a value for a "driver" field, dependent fields are
automatically pre-filled with sensible defaults. This reduces cognitive load
and produces more complete models without manual effort.

Existing implementations: `getProcessDefaults()`, `EXTERNAL_ENTITY_TYPE_DEFAULTS`
Planned: DataStore, DataFlow, Interface, TrustBoundary cascades

---

## Process

### Driver: `technology`

| technology | authRequired | authModel | inputValidation | errorHandling |
|---|---|---|---|---|
| `api` | `oauth` | `rbac` | `schema` | `sanitized` |
| `microservice` | `oauth` | `rbac` | `schema` | `sanitized` |
| `ui` | `yes` | `rbac` | `basic` | `sanitized` |
| `websocket` | `oauth` | `rbac` | `strict` | `sanitized` |
| `lambda` | `oauth` | `custom` | `schema` | `sanitized` |
| `database` | `certificate` | `acl` | `strict` | `silent` |
| `daemon` | `no` | `none` | `basic` | `silent` |
| `batch` | `no` | `none` | `none` | `silent` |
| `cron` | `no` | `none` | `none` | `silent` |
| `event` | `oauth` | `custom` | `none` | `silent` |
| `cli` | `no` | `none` | `basic` | `verbose` |
| `iot` | `certificate` | `custom` | `strict` | `sanitized` |
| `rtos_task` | `no` | `none` | `basic` | `silent` |
| `bare_metal` | `no` | `none` | `none` | `silent` |
| `isr` | `no` | `none` | `none` | `silent` |
| `state_machine` | `no` | `none` | `strict` | `silent` |
| `bootloader` | `certificate` | `none` | `strict` | `silent` |
| `driver` | `no` | `none` | `basic` | `silent` |
| `protocol_stack` | `no` | `none` | `strict` | `silent` |

**Rationale:**
- Embedded types (`rtos_task`, `bare_metal`, `isr`) have no authentication concept — setting `no` avoids false positives in Spoofing threat generation.
- `bootloader` uses `certificate` because Secure Boot requires a cryptographic root of trust.
- `state_machine` uses `strict` input validation because safety FSMs must reject invalid state transitions.

### Driver: `technology` (Embedded-group) → `runsAs` and `privilegeLevel` disabled

When any embedded technology is selected, `runsAs` and `privilegeLevel` are
**disabled** (grayed out with tooltip) because bare-metal and RTOS systems have
no OS user context. The fields remain visible so the analyst understands they
exist — they are just not applicable in this context.

| technology | runsAs | privilegeLevel | tooltip |
|---|---|---|---|
| `rtos_task` | disabled | disabled | "Not applicable — RTOS tasks run without OS user context" |
| `bare_metal` | disabled | disabled | "Not applicable — bare-metal has no OS user context" |
| `isr` | disabled | disabled | "Not applicable — ISRs execute in interrupt context, no user concept" |
| `state_machine` | disabled | disabled | "Not applicable — state machines have no OS user context" |
| `bootloader` | disabled | disabled | "Not applicable — bootloader runs before OS initialisation" |
| `driver` | disabled | disabled | "Not applicable — hardware drivers run in kernel/privileged context without user concept" |
| `protocol_stack` | disabled | disabled | "Not applicable — protocol stacks operate below OS user layer" |

If the analyst later switches from an embedded technology back to an IT
technology (e.g. `api`), `runsAs` and `privilegeLevel` become enabled again.
Any values set before the embedded selection was made are restored.

**UX choice — disabled vs. hidden:**
Disabled with tooltip is preferred over hiding. Hiding creates confusion when
analysts look for a field they expect to exist. Disabling communicates intent
without removing discoverability.

### Driver: `runsAs`

| runsAs | privilegeLevel | authRequired (if technology not set) |
|---|---|---|
| `root` | `root` | `yes` |
| `system` | `high` | `yes` |
| `admin_user` | `medium` | `yes` |
| `service` | `medium` | `yes` |
| `contractor` | `medium` | `yes` |
| `user` | `low` | `optional` |
| `guest` | `low` | `no` |
| `anonymous` | `low` | `no` |

### Driver: `processSemantic`

| processSemantic | Suggested note to analyst | inputValidation (hint only, no auto-fill) |
|---|---|---|
| `functional_block` | "No hardware isolation boundary — trust assumptions must be explicit on all incoming DFs" | `strict` recommended |
| `security_boundary` | "This process enforces a security boundary — all DFs crossing it should have encryptionInTransit set" | `strict` recommended |
| `execution_unit` | No hint | — |

**Note:** `processSemantic` does not auto-fill other fields — it controls UI hints only, to avoid overriding analyst intent.

---

## External Entity

### Driver: `entityType`

| entityType | trustLevel | authMethod | threatActor |
|---|---|---|---|
| `user` | `low` | `password` | `curious` |
| `admin_user` | `medium` | `mfa` | `insider` |
| `partner` | `medium` | — | — |
| `thirdparty` | `low` | — | — |
| `service` | `medium` | `certificate` | — |
| `identity_provider` | `high` | `saml` | `advanced` |
| `payment` | `medium` | `certificate` | `malicious` |
| `contractor` | `medium` | `mfa` | `insider` |
| `bot` | `low` | `apikey` | `compromised` |
| `webhook` | `low` | `none` | `malicious` |
| `mobile_app` | `low` | `oauth` | `curious` |
| `iot` | `low` | `certificate` | `compromised` |

**Rationale:**
- `identity_provider` gets `high` trust because it is by definition a trusted authentication source — the threat is in compromising it (`advanced` actor).
- `webhook` gets `none` auth because webhooks are typically unauthenticated by default — this flags Spoofing immediately.
- `iot` gets `compromised` because IoT devices are frequently the vector for supply chain or firmware attacks.

### Driver: `trustLevel`

| trustLevel | authMethod (hint, not auto-fill) | contractExists (hint) |
|---|---|---|
| `high` | `certificate` or `mfa` recommended | `true` expected |
| `medium` | at minimum `password` | `true` recommended |
| `low` | do not assume authentication | `false` expected |

---

## Data Store

### Driver: `technology`

| technology | encryptionAtRest | integrityProtection | multiTenant |
|---|---|---|---|
| `database` | `tde` | `true` | — |
| `cloud` | `kms` | `true` | `true` |
| `filesystem` | `none` | `false` | `false` |
| `cache` | `none` | `false` | — |
| `queue` | `none` | `false` | — |
| `blockchain` | `custom` | `true` | `false` |

**Planned embedded additions:**
| technology | encryptionAtRest | integrityProtection |
|---|---|---|
| `flash` | `none` | `false` |
| `eeprom` | `none` | `false` |
| `nvram` | `none` | `false` |

**Rationale:**
- `filesystem` defaults to `none` / `false` to surface the threat immediately — analysts must consciously set encryption if it exists.
- `cloud` defaults to `multiTenant = true` because cloud storage is shared infrastructure unless explicitly isolated.
- `cache` and `queue` default to no encryption because in-memory stores rarely have encryption at rest — the gap is intentional.

### Driver: `dataClassification`

| dataClassification | encryptionAtRest (minimum recommended) | integrityProtection |
|---|---|---|
| `secret` | `aes256` or `kms` | `true` |
| `restricted` | `aes256` | `true` |
| `confidential` | `yes` minimum | `true` |
| `internal` | — | — |
| `public` | — | — |

**Note:** These are hints displayed to the analyst, not auto-fills. Overriding a `secret` classification to `none` encryption should require explicit action.

### Driver: `containsSafetyRelevantData`

When set to `true`:
- `integrityProtection` → prompted if not already set (warning if false)
- `safetyRationale` field becomes visible and required for audit

---

## Data Flow

### Driver: `protocol`

| protocol | direction | endpointAuthentication | encryptionInTransit |
|---|---|---|---|
| `https` | `requestresponse` | `token` | `tls` |
| `grpc` | `requestresponse` | `certificate` | `tls` |
| `mqtt` | `unidirectional` | `none` | `none` |
| `amqp` | `unidirectional` | `token` | `none` |
| `websocket` | `bidirectional`* | `token` | `tls` |
| `file` | `unidirectional` | `none` | `none` |
| `database` | `requestresponse` | `certificate` | `none` |
| `http` | `requestresponse` | `none` | `none` |

*`bidirectional` will trigger validator error C7 — the analyst must correct this.

**Embedded protocols (planned):**
| protocol | direction | endpointAuthentication | encryptionInTransit |
|---|---|---|---|
| `can` | `unidirectional` | `none` | `none` |
| `modbus` | `requestresponse` | `none` | `none` |
| `uart` | `unidirectional` | `none` | `none` |
| `spi` | `unidirectional` | `none` | `none` |
| `i2c` | `unidirectional` | `none` | `none` |

**Rationale:**
- Embedded protocols default to `none` authentication and `none` encryption because that reflects reality — the analyst must consciously add controls, not remove them.
- `https` / `grpc` default to `tls` because using them without encryption is exceptional.
- `mqtt` defaults to no encryption because most embedded MQTT deployments are on isolated OT networks — flagging it forces the analyst to confirm.

### Driver: `safetyRelevant`

When set to `true`:
- `safetyRationale` field becomes visible
- `exposureLevel` → prompt if not set (safety flows must have explicit EL)
- `integrityProtection` → warning if false

### Driver: `excludeFromThreatGen`

When set to `true`:
- `excludeFromThreatGenRationale` field becomes visible and required (validator C9)

---

## Interface

### Driver: `type`

| type | accessControl (default) | safetyRelevant (hint) |
|---|---|---|
| `ethernet` | `credentials` | — |
| `wifi` | `credentials` | — |
| `bluetooth` | `credentials` | — |
| `nfc` | `none` | — |
| `usb` | `none` | prompt: "Is this a programming/debug port?" |
| `serial` | `none` | prompt: "Is this connected to a safety-critical component?" |
| `gpio` | `none` | prompt: "Does this connect to safety actuators or sensors?" |
| `fiber` | `credentials` | — |
| `custom` | `none` | — |

**Rationale:**
- `usb`, `serial`, `gpio` prompt for safety relevance because these are the most common attack surfaces on embedded systems (JTAG/SWD over serial, USB firmware update ports, GPIO to sensors/actuators).
- Network interfaces (`ethernet`, `wifi`) default to `credentials` because unauthenticated network access is unusual in documented systems.

### Driver: `safetyRelevant`

When set to `true`:
- `safetyRationale` field becomes visible
- `accessControl` → warning if `none`
- `exposureLevel` → prompt if not set

---

## Trust Boundary

### Driver: `boundaryType`

| boundaryType | defaultExposureLevel | monitoringEnabled | securityAssumptions (placeholder text) |
|---|---|---|---|
| `network` | `EL3` | `true` | "External network is untrusted. All ingress/egress requires authentication and encryption." |
| `cloud` | `EL4` | `true` | "Cloud perimeter is public. IAM policies and encryption are mandatory." |
| `privilege` | `EL1` | `false` | "Lower privilege zone cannot initiate connections to higher privilege zone." |
| `device` | `EL1` | `false` | "Device boundary. External interfaces require authentication." |
| `physical` | `EL1` | `false` | "Physical access required for attack. Tamper-evident enclosure assumed." |
| `organization` | `EL3` | `false` | "Organizational boundary. Contractual controls apply." |
| `legal` | `EL2` | `false` | "Regulatory boundary. Compliance controls apply." |
| `peripheral` | `EL1` | `false` | "MCU to external chip boundary. Bus protocol has no authentication." |
| `boot` | `EL0` | `false` | "Bootloader to application boundary. Secure Boot chain enforced." |
| `debug` | `EL1` | `false` | "Debug interface boundary. Must be locked or disabled in production." |

**Rationale:**
- `network` and `cloud` default to higher EL (EL3/EL4) because they face external networks by definition.
- `peripheral`, `boot`, `debug` default to EL1 because they require physical or privileged access.
- `boot` defaults to EL0 (fully trusted, isolated) because a locked Secure Boot chain assumes no external access to the boot boundary.
- `monitoringEnabled` defaults to `true` only for network-facing boundaries where logging is standard practice.

### Driver: `defaultExposureLevel`

The `defaultExposureLevel` is inherited by all Interface elements within the boundary. If an Interface sets a lower EL than its parent TrustBoundary, the validator flags it as an override requiring rationale.

---

## Implementation Notes

- **Auto-fill vs. hint:** Fields marked "auto-fill" set the value programmatically when the driver changes. Fields marked "hint" display a warning or placeholder but do not overwrite existing values.
- **Clearing a driver:** When a driver field is cleared (set to empty), all fields it drove should also be cleared — unless the analyst has modified them after the initial auto-fill. This prevents stale defaults from persisting.
- **Precedence:** `runsAs` and `technology` both drive some Process fields. If both are set, `technology` takes precedence for auth-related fields because the runtime type is a stronger signal than the OS user.
