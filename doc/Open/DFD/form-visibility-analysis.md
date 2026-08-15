# TARAflow — Form Field Visibility Analysis
## Systematische Überprüfung aller Forms auf fehlende / inkonsistente Conditional Logic

**Datum:** 2026-05-24  
**Scope:** Alle 8 DFD-Element-Forms  
**Ziel:** Saubere, konsistente Visibility-Logik für alle Felder — kein UI-Noise, kein semantischer Unsinn

---

## Bewertungskriterien

Für jedes Feld wird geprüft:

| Frage | Wenn ja → Aktion |
|---|---|
| Ist das Feld für alle Ausprägungen des Drivers sinnvoll? | Keine Condition nötig |
| Ist das Feld nur für bestimmte Driver-Werte sinnvoll? | `isVisible` / bedingtes Rendering |
| Macht das Feld für keinen Driver-Wert Sinn? | Feld entfernen oder Options filtern |
| Haben Options semantisch keinen Sinn für bestimmte Driver-Werte? | Options-Filter nötig |

**Bestehende Patterns:**
- `ProcessForm`: `isEmbedded` Set (rtos_task, bare_metal, isr, state_machine, bootloader, driver, protocol_stack)
- `MultiprocessForm`: `isVisible(sc, SHOW_XY)` Sets — Gold Standard ✅
- `ChipBoundaryForm`: `isFpga`, `isMcuLike` Booleans
- `PhysicalBoundaryForm`: direkte `boundaryType`-Checks

---

## 1. ProcessProperties Form

**Driver:** `technology`  
**Bestehende Logik:** `isEmbedded` Boolean — gut, aber unvollständig

### Felder-Analyse

| Feld | Alle Tech | Nur IT | Nur Embedded | Aktuelle Logic | Soll |
|---|---|---|---|---|---|
| `technology` | ✅ | — | — | immer | ✅ ok |
| `processSemantic` | — | — | ✅ | `isEmbedded` | ✅ ok |
| `runsAs` | — | ✅ | ❌ | `disabled` wenn embedded | ✅ ok (disabled ist besser als hidden) |
| `privilegeLevel` | — | ✅ | ❌ | `disabled` wenn embedded | ✅ ok |
| `authenticationRequired` | ✅ | — | — | immer | ✅ ok |
| `authorizationModel` | ✅ | — | — | immer | ✅ ok |
| `inputValidation` | ✅ | — | — | immer | ✅ ok |
| `errorHandling` | ✅ | — | — | immer | ✅ ok |
| `exposedToInternet` | — | ✅ | ❌ | immer | ⚠️ **sollte ausgeblendet bei embedded** |
| **`malwareProtection`** | — | — | — | immer | ⚠️ **Options-Filter + Visibility nötig** |
| **`failSafeOutputState`** | — | — | ✅ | `processSemantic=functional_block OR safetyRelevant` | ✅ ok |
| **`accountManagement`** | — | ✅ | ❌ | immer | ⚠️ **ausblenden bei embedded** |
| **`authenticatorStorage`** | ✅ | — | — | immer | ✅ ok (relevant für alle die Credentials verwalten) |
| **`nonRepudiation`** | — | ✅ | ❌ | `technology IN [ui, api, websocket, cli]` | ✅ ok |
| **`sessionControl`** | — | ✅ | ❌ | `technology IN [ui, api, websocket, cli]` | ✅ ok |

### Konkrete Probleme

**Problem 1: `exposedToInternet` bei Embedded**  
Ein `rtos_task` oder `bare_metal`-Prozess ist per Definition nicht "exposed to internet" — das ist eine Systemgrenze, nicht eine Prozess-Eigenschaft. Sollte bei `isEmbedded` ausgeblendet werden.

**Problem 2: `malwareProtection` Options-Filter**  
```
rtos_task, isr, state_machine  → [none, code_signing, custom]
bare_metal                     → [none, code_signing, custom]
bootloader                     → [none, code_signing, custom]           // code_signing ist hier der Hauptfall
driver                         → [none, code_signing, nx_dep, custom]
protocol_stack                 → [none, code_signing, application_whitelist, custom]
api, lambda, microservice      → [none, application_whitelist, sandbox, custom]
ui, cli                        → [none, av_software, application_whitelist, sandbox, custom]
daemon, cron                   → [none, av_software, application_whitelist, nx_dep, sandbox, custom]
database                       → [none, application_whitelist, sandbox, custom]
iot                            → [none, code_signing, application_whitelist, custom]
batch, event, websocket        → [none, application_whitelist, sandbox, custom]
// Fallback (technology nicht gesetzt): alle zeigen
```

**Problem 3: `accountManagement` bei Embedded**  
`local_only`, `ldap`, `active_directory`, `radius`, `iam` machen auf einem RTOS-Task oder ISR keinen Sinn. Sollte bei `isEmbedded` ausgeblendet werden.

### Neue Visibility-Sets für Process

```typescript
// Neue Sets
const SHOW_EXPOSED_TO_INTERNET = new Set([
  "api", "batch", "ui", "microservice", "lambda", "daemon",
  "websocket", "event", "cli", "database", "cron", "iot",
]);

const SHOW_ACCOUNT_MANAGEMENT = new Set([
  "api", "batch", "ui", "microservice", "lambda", "daemon",
  "websocket", "event", "cli", "database", "cron", "iot",
]);

// malwareProtection Options per technology
const MALWARE_PROTECTION_OPTIONS: Record<string, string[]> = {
  rtos_task:      ["none", "code_signing", "custom"],
  bare_metal:     ["none", "code_signing", "custom"],
  isr:            ["none", "custom"],
  state_machine:  ["none", "custom"],
  bootloader:     ["none", "code_signing", "custom"],
  driver:         ["none", "code_signing", "nx_dep", "custom"],
  protocol_stack: ["none", "code_signing", "application_whitelist", "custom"],
  api:            ["none", "application_whitelist", "sandbox", "custom"],
  ui:             ["none", "av_software", "application_whitelist", "sandbox", "custom"],
  daemon:         ["none", "av_software", "application_whitelist", "nx_dep", "sandbox", "custom"],
  cron:           ["none", "av_software", "application_whitelist", "custom"],
  database:       ["none", "application_whitelist", "sandbox", "custom"],
  iot:            ["none", "code_signing", "application_whitelist", "custom"],
  microservice:   ["none", "application_whitelist", "sandbox", "custom"],
  lambda:         ["none", "application_whitelist", "sandbox", "custom"],
  batch:          ["none", "application_whitelist", "custom"],
  websocket:      ["none", "application_whitelist", "sandbox", "custom"],
  event:          ["none", "application_whitelist", "custom"],
  cli:            ["none", "av_software", "application_whitelist", "custom"],
};
// Fallback (undefined): alle Optionen zeigen
```

---

## 2. MultiprocessProperties Form

**Driver:** `systemClass`  
**Bestehende Logik:** `isVisible(sc, SHOW_XY)` — Gold Standard ✅

### Neue Felder analysieren

| Feld | embedded_controller | scada_hmi | backend_application | gateway | mobile_device | cloud_platform | workstation | safety_system |
|---|---|---|---|---|---|---|---|---|
| `malwareProtection` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| `accountManagement` | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ |
| `authenticatorStorage` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `backupMechanism` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `nonRepudiation` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |

**Legende:** ✅ sinnvoll, ⚠️ eingeschränkt sinnvoll, ❌ nicht sinnvoll

**Erläuterungen:**
- `malwareProtection` bei `safety_system`: SIS-Systeme haben in der Regel keine AV-Software und kein dynamisches Code-Loading. `code_signing` ist der einzig sinnvolle Wert. → Options-Filter nötig
- `accountManagement` bei `mobile_device`: MDM ist das Äquivalent, aber keiner der Werte passt sauber. → Optional zeigen, `iam` als Default
- `accountManagement` bei `safety_system`: Safety PLCs haben typischerweise keine Account-Verwaltung im IT-Sinne. → Ausblenden
- `backupMechanism` bei `mobile_device`: Mobile Geräte werden über MDM verwaltet, kein klassisches Backup-Konzept. → Ausblenden
- `nonRepudiation` nur für Systeme mit Human-Operator-Interaktion: scada_hmi, backend_application, workstation, cloud_platform

### Neue SHOW_ Sets

```typescript
const SHOW_MALWARE_PROTECTION = new Set<SystemClass>([
  "embedded_controller", "scada_hmi", "backend_application",
  "gateway", "mobile_device", "cloud_platform", "workstation", "safety_system",
]); // Alle — aber Options gefiltert per systemClass

const SHOW_ACCOUNT_MANAGEMENT = new Set<SystemClass>([
  "embedded_controller", "scada_hmi", "backend_application",
  "gateway", "mobile_device", "cloud_platform", "workstation",
  // safety_system: kein Account-Management-Konzept
]);

const SHOW_AUTHENTICATOR_STORAGE = new Set<SystemClass>([
  "embedded_controller", "scada_hmi", "backend_application",
  "gateway", "mobile_device", "cloud_platform", "workstation", "safety_system",
]); // Alle

const SHOW_BACKUP_MECHANISM = new Set<SystemClass>([
  "embedded_controller", "scada_hmi", "backend_application",
  "gateway", "cloud_platform", "workstation", "safety_system",
  // mobile_device: kein klassisches Backup
]);

const SHOW_NON_REPUDIATION = new Set<SystemClass>([
  "scada_hmi", "backend_application", "cloud_platform", "workstation",
  // embedded_controller, gateway, safety_system: keine Human-Operator-UI
  // mobile_device: App-intern, nicht Boundary-Level
]);

// malwareProtection Options per systemClass
const MALWARE_PROTECTION_OPTIONS_MP: Record<SystemClass, string[]> = {
  embedded_controller: ["none", "code_signing", "application_whitelist", "custom"],
  scada_hmi:           ["none", "av_software", "application_whitelist", "custom"],
  backend_application: ["none", "application_whitelist", "sandbox", "av_software", "custom"],
  gateway:             ["none", "application_whitelist", "code_signing", "custom"],
  mobile_device:       ["none", "sandbox", "application_whitelist", "custom"],
  cloud_platform:      ["none", "sandbox", "application_whitelist", "custom"],
  workstation:         ["none", "av_software", "application_whitelist", "nx_dep", "sandbox", "custom"],
  safety_system:       ["none", "code_signing", "custom"],
};
```

---

## 3. TrustBoundaryProperties Form

**Driver:** `boundaryType`  
**Bestehende Logik:** Nur dynamischer Placeholder — keine Visibility-Conditions

### Felder-Analyse

| Feld | network | privilege | organization | cloud | legal | device | peripheral | boot | debug |
|---|---|---|---|---|---|---|---|---|---|
| `boundaryControlTypes` | ✅ | ⚠️ | ✅ | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ |
| `customBoundaryControls` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `monitoringEnabled` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| `defaultDenyPolicy` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `securityAssumptions` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `complianceRelevance` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Erläuterungen:**
- `boundaryControlTypes` bei `legal`: Eine rechtliche Grenze hat keine technischen Boundary-Controls. → Ausblenden
- `boundaryControlTypes` bei `peripheral`/`boot`/`debug`: Diese embedded-Grenzen haben keine Netzwerkkontrollen. → Ausblenden
- `monitoringEnabled` bei `legal`/`peripheral`/`boot`: Macht semantisch keinen Sinn. → Ausblenden
- `defaultDenyPolicy` bereits korrekt: nur network/cloud ✅

### Neue Visibility-Sets

```typescript
const SHOW_BOUNDARY_CONTROLS = new Set([
  "network", "privilege", "organization", "cloud", "device",
  // legal, peripheral, boot, debug: keine technischen Controls
]);

const SHOW_MONITORING = new Set([
  "network", "privilege", "organization", "cloud", "device", "debug",
  // legal, peripheral, boot: semantisch sinnlos
]);
```

---

## 4. DataFlowProperties Form

**Driver:** `protocol` (über `isElectrical`)  
**Bestehende Logik:** `isElectrical` → Encryption/Auth ausblenden ✅

### Neue Felder analysieren

| Feld | Electrical | Wireless | Serial/Bus | Network/IT | Condition |
|---|---|---|---|---|---|
| `physicalPathProtection` | ✅ | ❌ | ✅ | ⚠️ | Zeigen wenn `location` ∈ {on_chip, on_board, in_enclosure, field_cable} |
| `cryptoStandard` | ❌ | ✅ | ⚠️ | ✅ | Zeigen wenn `encryptionInTransit ≠ none/undefined` ODER `integrityProtection ∈ {hmac, signature}` |

**Erläuterungen:**
- `physicalPathProtection`: bereits korrekt konditioniert via `requiresPhysicalAccess` ✅
- `cryptoStandard`: sollte nur sichtbar sein wenn tatsächlich Kryptographie verwendet wird — sonst sinnloser leerer Select

### Konkrete Condition für `cryptoStandard`

```typescript
const showCryptoStandard =
  (props.encryptionInTransit != null && props.encryptionInTransit !== "none") ||
  (props.integrityProtection === "hmac" || props.integrityProtection === "signature");
```

---

## 5. DataStoreProperties Form

**Driver:** `technology`  
**Bestehende Logik:** Cascade-Defaults, aber keine Visibility-Conditions auf Felder

### Neue Felder + bestehende analysieren

| Feld | database | cloud | filesystem | cache | queue | blockchain | flash | eeprom | nvram |
|---|---|---|---|---|---|---|---|---|---|
| `encryptionAtRest` | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `integrityProtection` | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `accessControlMechanism` | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `deletionMechanism` | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ✅ |
| `multiTenant` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `backupEnabled` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `cryptoStandard` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

**Erläuterungen:**
- `queue`: Ein Message-Queue ist flüchtig — Encryption, Integrity, Deletion sind irrelevant
- `cache`: Flüchtig — meist kein Backup, keine Deletion, eingeschränkte Encryption
- `multiTenant`: Nur bei cloud/database sinnvoll — wird aktuell schon richtig gehandhabt via Cascade
- `cryptoStandard`: Nur zeigen wenn `encryptionAtRest ≠ none/undefined` ODER `integrityProtection ∈ {hmac, signature}`

### Neue Visibility-Logik

```typescript
const VOLATILE_STORE = new Set(["cache", "queue"]);
const isVolatile = VOLATILE_STORE.has(props.technology ?? "");

// Zeige persistent-only Felder nur wenn nicht flüchtig
const showPersistentControls = !isVolatile;

// cryptoStandard: nur wenn Kryptographie verwendet
const showCryptoStandard =
  (props.encryptionAtRest != null && props.encryptionAtRest !== "none") ||
  (props.integrityProtection === "hmac" || props.integrityProtection === "signature");
```

---

## 6. InterfaceProperties Form

**Driver:** `type`  
**Bestehende Logik:**  
- `connectorType` gefiltert via `INTERFACE_TYPE_META.validConnectors` ✅  
- `debugProtection` bedingt via `type IN [jtag, swd, swd_swo, jtag_trace, uart, usb]` ✅  
- `abuseProtection` bedingt via `type IN [uart, bluetooth, can, ...]` ✅  
- `safetyHintKey` via `INTERFACE_TYPE_SAFETY_HINTS` ✅

### Neue Felder + bestehende analysieren

| Feld | Debug (jtag/swd) | Serial (uart/rs485) | Network (eth/wifi) | Wireless (bt/nfc) | Analog/GPIO | Aktuelle Logik | Soll |
|---|---|---|---|---|---|---|---|
| `logicalAccessControl` | ✅ (auth_required) | ✅ | ✅ | ✅ | ❌ | immer | ⚠️ **ausblenden bei analog/gpio/spi/i2c/pwm** |
| `physicalAccessProtection` | ✅ | ✅ | ✅ | ✅ | ✅ | immer | ✅ ok |
| `debugProtection` | ✅ | ⚠️ (uart) | ❌ | ❌ | ❌ | bedingt | ✅ ok |
| `serviceAccessPolicy` | ✅ | ✅ | ✅ | ✅ | ❌ | immer | ⚠️ **ausblenden bei analog/gpio/spi/i2c/pwm** |
| `abuseProtection` | ❌ | ✅ | ✅ | ✅ | ❌ | bedingt | ✅ ok |
| `monitoringControl` | ✅ | ✅ | ✅ | ✅ | ✅ | immer | ✅ ok |
| `signalProtection` | ⚠️ | ✅ | ⚠️ | ❌ | ✅ | immer | ⚠️ **ausblenden bei wireless** |
| `mfa` Option | ❌ | ❌ | ✅ | ✅ | ❌ | in allen | ⚠️ **nur anzeigen wenn relevant** |

### Konkrete Fixes

```typescript
// Interfaces ohne Auth-Fähigkeit (kein logisches Protokoll)
const NO_AUTH_INTERFACES = new Set([
  "gpio", "analog_in", "analog_out", "pwm", "spi", "i2c",
]);

// Zeige logicalAccessControl und serviceAccessPolicy nur wenn Auth möglich
const showLogicalControls = !NO_AUTH_INTERFACES.has(props.type ?? "");

// signalProtection: nicht bei Wireless (kein physisches Medium)
const WIRELESS_INTERFACES = new Set(["wifi", "bluetooth", "nfc"]);
const showSignalProtection = !WIRELESS_INTERFACES.has(props.type ?? "");

// mfa Option in logicalAccessControl: nur für netzwerkfähige Interfaces
const MFA_RELEVANT = new Set([
  "ethernet", "wifi", "bluetooth", "usb", "uart", "rs232", "rs485", "fiber",
]);
```

---

## 7. ChipBoundaryProperties Form

**Driver:** `chipType`  
**Bestehende Logik:**
- `isFpga` Boolean für `bitstreamEncryption` ✅
- `isMcuLike` Boolean für `firmwareProtection` ✅
- Gut implementiert

### Analyse — keine Änderungen nötig ✅

Das bestehende Pattern ist sauber. Die ChipBoundary-Form hat die differenzierteste Visibility-Logik im gesamten Codebase.

---

## 8. PhysicalBoundaryProperties Form

**Driver:** `boundaryType`  
**Bestehende Logik:** Direkte `boundaryType`-Checks für `physicalMobility`, `physicalAccessControl`, `tamperProtection` — korrekt

### Analyse — keine strukturellen Änderungen nötig ✅

Die bestehende Logik ist konsistent und sauber.

---

## 9. ExternalEntityProperties Form

**Driver:** `entityType`  
**Bestehende Logik:** Keine Visibility-Conditions

### Analyse

| Feld | Alle entityTypes | Einschränkung |
|---|---|---|
| `trustLevel` | ✅ | ok |
| `authenticationMethod` | ✅ | ok |
| `threatActor` | ✅ | ok |
| `contractExists` | ⚠️ | Nur bei partner, thirdparty, payment, contractor sinnvoll |
| `rateLimited` | ⚠️ | Nur bei service, bot, webhook, iot sinnvoll |
| `threatProfile` | ✅ | ok |

**Einschätzung:** Die Einschränkungen bei `contractExists` und `rateLimited` sind schwach — der Analyst kann beide für jeden Type setzen wollen. Kein dringlicher Handlungsbedarf.

---

## Zusammenfassung: Priorisierte Änderungen

### Prio 1 — Direkt umsetzen (klare semantische Fehler)

| Form | Feld | Problem | Fix |
|---|---|---|---|
| Process | `malwareProtection` | AV auf RTOS macht keinen Sinn | Options-Filter per technology |
| Process | `exposedToInternet` | Auf embedded-Process nicht anwendbar | Ausblenden wenn `isEmbedded` |
| Process | `accountManagement` | Auf embedded-Process nicht anwendbar | Ausblenden wenn `isEmbedded` |
| Interface | `logicalAccessControl` | GPIO/analog hat keine Auth-Fähigkeit | Ausblenden bei NO_AUTH_INTERFACES |
| Interface | `serviceAccessPolicy` | GPIO/analog hat keine Policy | Ausblenden bei NO_AUTH_INTERFACES |
| Interface | `signalProtection` | Wireless hat kein physisches Medium | Ausblenden bei WIRELESS_INTERFACES |
| DataFlow | `cryptoStandard` | Sinnlos ohne Kryptographie | Nur zeigen wenn Encryption/HMAC gesetzt |
| DataStore | `cryptoStandard` | Sinnlos ohne Kryptographie | Nur zeigen wenn Encryption/HMAC gesetzt |

### Prio 2 — Sinnvoll aber nicht kritisch

| Form | Feld | Problem | Fix |
|---|---|---|---|
| Multiprocess | `malwareProtection` | AV auf Safety-System unsinnig | Options-Filter per systemClass |
| Multiprocess | `accountManagement` | Nicht sinnvoll für safety_system | SHOW_ Set |
| Multiprocess | `backupMechanism` | Nicht sinnvoll für mobile_device | SHOW_ Set |
| Multiprocess | `nonRepudiation` | Nur für HMI-Systeme relevant | SHOW_ Set — bereits in Form korrekt |
| TrustBoundary | `boundaryControlTypes` | Nicht sinnvoll für legal/peripheral/boot/debug | SHOW_ Set |
| TrustBoundary | `monitoringEnabled` | Nicht sinnvoll für legal/peripheral/boot | SHOW_ Set |
| DataStore | `encryptionAtRest` etc. | Sinnlos für volatile stores | `isVolatile` Boolean |

### Prio 3 — Nice to have

| Form | Feld | Problem | Fix |
|---|---|---|---|
| Interface | `mfa` Option | Sinnlos bei non-protocol interfaces | Options-Filter |
| ExternalEntity | `contractExists` | Nur bei Partner/Contractor sinnvoll | Visibility-Condition |
| ExternalEntity | `rateLimited` | Nur bei Services/Bots sinnvoll | Visibility-Condition |

---

## Implementierungsreihenfolge

1. **Process Form** — `malwareProtection` Options-Filter + `exposedToInternet`/`accountManagement` bei embedded ausblenden
2. **Multiprocess Form** — neue SHOW_ Sets für alle neuen Felder
3. **Interface Form** — `logicalAccessControl`/`serviceAccessPolicy` bei NO_AUTH ausblenden, `signalProtection` bei Wireless
4. **DataFlow + DataStore** — `cryptoStandard` konditionell
5. **TrustBoundary** — `boundaryControlTypes`/`monitoringEnabled` konditionell
6. **DataStore** — volatile store Condition

Jede Änderung ist isoliert und rückwärtskompatibel — kein bestehender Analyst-Wert geht verloren, nur die UI wird sauberer.
