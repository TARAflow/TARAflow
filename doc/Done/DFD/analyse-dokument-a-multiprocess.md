# Analyse — Dokument A: Multiprocess System Modeling

## Kontext

**TARAflow** — `Multiprocess` ist heute ein DFD-Element das dieselben Properties
wie `Process` verwendet. Das ist falsch: ein Prozess ist eine konkrete
Ausführungseinheit, ein Multiprocess ist ein System oder Subsystem das intern
aus mehreren Komponenten besteht.

Dieses Dokument definiert:
1. Taxonomie der Systemtypen die Multiprocess abdecken muss
2. `MultiprocessProperties` Interface
3. Neue STRIDE-Mapping-Tabelle für Multiprocess
4. Template-IDs für System-Level Threats
5. Formular-Design im DFD-Tab

---

## Das Problem konkret

Im CNC-Referenzfall sind MES, SCADA, CNC Controller, Robot Controller und
Safety Controller als `Multiprocess` modelliert. Heute bekommen sie:

```typescript
technology: "iot"       // für einen SIL-2 Safety Controller: zu unspezifisch
runsAs: "system"        // welcher Account "ist" ein ganzes System?
privilegeLevel: "root"  // intern hat ein SCADA System mehrere Privilege-Ebenen
```

Diese Properties machen auf Systemebene keine eindeutige Aussage.
`runsAs = "system"` für einen CNC Controller ist semantisch falsch —
ein CNC Controller hat intern Tasks mit unterschiedlichen Rechten.

---

## Taxonomie der Systemtypen

Multiprocess muss folgende reale Systemklassen abdecken:

### Klasse 1 — Dedicated Embedded Controller
PLC, SPS, SIS, CNC Controller, Robot Controller, ECU, MCU-Board

Charakteristik:
- Läuft auf dedizierter Hardware (kein General-Purpose OS)
- Real-Time Betriebssystem oder Bare-Metal
- Direkte Hardware-Anbindung (Sensoren, Aktoren)
- Update nur lokal oder via signiertem OTA
- Sicherheitszertifizierung möglich (SIL, IEC 62443 SL)

Beispiele: Siemens S7 PLC, Beckhoff CX, ABB IRC5, Safety SIS

### Klasse 2 — SCADA / HMI / DCS System
Operator Interface, Supervisory Control, Data Acquisition

Charakteristik:
- Läuft auf Windows/Linux (General-Purpose OS, gehärtet)
- Visualisierung + Steuerung kombiniert
- Netzwerkverbindung zu Feldgeräten und IT
- Operator-Interaktion (HMI)

Beispiele: WinCC, FactoryTalk, Ignition, custom SCADA

### Klasse 3 — Backend Application / Server
MES, ERP Connector, API Server, Microservice Cluster

Charakteristik:
- Läuft auf Standard-Server OS
- Mehrere Services / Microservices
- Datenbank-Backend
- REST/gRPC/MQTT APIs
- Container-basiert möglich

Beispiele: MES Backend, .NET API Server, Spring Boot Cluster

### Klasse 4 — Gateway / Edge Device
VPN Gateway, Protocol Converter, Edge Gateway, Proxy

Charakteristik:
- Vermittler zwischen Zonen / Protokollen
- Oft dedizierte Hardware oder gehärtetes Linux
- Firewall-Funktion integriert
- Kritisch für Trust-Boundary-Übergänge

Beispiele: VPN Concentrator, Modbus-to-MQTT Gateway, OPC-UA Proxy

### Klasse 5 — Mobile / Portable Device
Tablet, Handheld, Smartphone (als Teil des Systems)

Charakteristik:
- iOS / Android / Windows
- Nutzer-interaktiv
- MDM-verwaltbar
- Bluetooth/WiFi-Konnektivität
- App als Steuerungsschicht

Beispiele: Wartungs-Tablet, mobiles HMI, Service-App

### Klasse 6 — Cloud Platform / Service
Cloud-Backend, SaaS, PaaS-Komponente

Charakteristik:
- Multi-Tenant möglich
- Elastisch skalierbar
- IAM/Identity-Systeme
- API-basierter Zugriff
- Compliance: SOC2, ISO 27017

Beispiele: Azure IoT Hub, AWS Greengrass, Custom Cloud Backend

### Klasse 7 — PC / Workstation
Engineering Workstation, Programming Station, Desktop Application

Charakteristik:
- General-Purpose OS (Windows/Linux)
- Nutzer-interaktiv
- Direkte Netzwerkverbindung
- Softwareentwicklungs- oder Konfigurations-Tool

Beispiele: Simatic Manager PC, Engineering Workstation, HMI-PC

### Klasse 8 — Safety System (dedicated)
SIS, Safety PLC, Functional Safety Controller

Charakteristik:
- SIL-zertifiziert (IEC 61508, EN ISO 13849)
- Hardware und Software voneinander getrennt bewertet
- Air-Gap oder streng kontrollierter Zugang
- Kein Remote-Update in Produktion
- Dedizierter Safety Engineer Owner

Beispiele: Pilz PSS, Hima HIMatrix, Rockwell GuardLogix

---

## `MultiprocessProperties` Interface

```typescript
export interface MultiprocessProperties {

  // ── Systemklasse ─────────────────────────────────────────────────────
  /**
   * Übergeordnete Systemklasse — bestimmt welche weiteren Properties
   * im Formular sichtbar sind und welche STRIDE-Templates gelten.
   */
  systemClass?:
    | "embedded_controller"   // Klasse 1: PLC, CNC, Robot, ECU
    | "scada_hmi"             // Klasse 2: SCADA, HMI, DCS
    | "backend_application"   // Klasse 3: MES, API Server, Microservices
    | "gateway"               // Klasse 4: VPN Gateway, Protocol Converter
    | "mobile_device"         // Klasse 5: Tablet, Handheld, Service App
    | "cloud_platform"        // Klasse 6: Cloud Backend, IoT Hub
    | "workstation"           // Klasse 7: Engineering PC, Desktop App
    | "safety_system";        // Klasse 8: SIS, Safety PLC, SIL-zertifiziert

  // ── Plattform / OS ───────────────────────────────────────────────────
  operatingSystem?:
    | "none"                  // Bare-Metal
    | "rtos"                  // FreeRTOS, Zephyr, ThreadX, VxWorks
    | "linux_hardened"        // Yocto, Ubuntu Core, Alpine (gehärtet)
    | "linux_standard"        // Standard Linux
    | "windows_hardened"      // Windows Embedded, LTSC (gehärtet)
    | "windows_standard"      // Standard Windows
    | "ios"                   // Apple iOS
    | "android"               // Android (MDM-verwaltet oder standard)
    | "cloud_managed"         // PaaS/Serverless, kein explizites OS
    | "custom";               // Proprietäres Embedded OS

  // ── Sicherheitszertifizierung ────────────────────────────────────────
  certificationLevel?:
    | "none"
    | "iec62443_sl1"          // IEC 62443 Security Level 1
    | "iec62443_sl2"          // IEC 62443 Security Level 2
    | "iec62443_sl3"          // IEC 62443 Security Level 3
    | "sil1"                  // IEC 61508 SIL 1
    | "sil2"                  // IEC 61508 SIL 2
    | "sil3"                  // IEC 61508 SIL 3
    | "iso21434"              // ISO 21434 Automotive Cybersecurity
    | "fips140_2"             // FIPS 140-2 (cryptographic modules)
    | "cc_eal2"               // Common Criteria EAL 2+
    | "cc_eal4";              // Common Criteria EAL 4+

  // ── Update-Mechanismus ───────────────────────────────────────────────
  updateMechanism?:
    | "none"                  // Kein Update vorgesehen
    | "manual_local"          // Nur physischer Zugang, manuell
    | "signed_local"          // Signiertes Paket, physischer Zugang
    | "signed_ota"            // Signiertes OTA (Over-the-Air)
    | "vendor_only"           // Nur durch Hersteller/Lieferant
    | "mdm_managed"           // Mobile Device Management
    | "ci_cd";                // Automatisiertes Deployment (Cloud/DevOps)

  // ── Zugangskontrolle auf Systemebene ─────────────────────────────────
  boundaryAuthentication?:
    | "not_specified"
    | "none"
    | "password"
    | "mfa"
    | "certificate"
    | "mtls"
    | "oauth"
    | "apikey"
    | "hardware_token";

  authorizationModel?:
    | "not_specified"
    | "none"
    | "rbac"
    | "abac"
    | "acl"
    | "capability_based";    // Embedded systems mit Capability-Modell

  // ── Netzwerk-Exposition ───────────────────────────────────────────────
  exposedToInternet?: boolean;
  remoteAccessEnabled?: boolean;

  /**
   * Physisch oder logisch vom Netz getrennt.
   * Bei true: Threat-Generierung reduziert Netzwerkbasierte Threats.
   */
  airGapped?: boolean;

  // ── Einstiegspunkte ──────────────────────────────────────────────────
  /**
   * Explizit modellierte Einstiegspunkte in das System.
   * Jeder Entry Point ist eine potenzielle Angriffsfläche.
   * Für Coverage-Inference genutzt (Block 4 / Dokument B).
   */
  entryPoints?: Array<{
    name: string;             // z.B. "gRPC API", "Modbus TCP", "JTAG"
    protocol?: string;
    exposureLevel?: ExposureLevel;
    authRequired?: boolean;
  }>;

  // ── Interne Struktur (informativ) ────────────────────────────────────
  /**
   * Informative Beschreibung der internen Komponenten.
   * Wird NICHT für Threat-Generierung verwendet — nur für Dokumentation.
   * Beispiel: "RTOS Tasks: motion_ctrl, comm_stack, safety_monitor + Bootloader"
   */
  internalComponents?: string;

  /**
   * Sicherheitsrelevante Systemkontrollen auf Gesamtebene.
   * Freitext — z.B. "SIL-2-zertifiziert, Hardware-Watchdog, kein Remote-Update"
   */
  securitySummary?: string;

  // ── Safety ───────────────────────────────────────────────────────────
  /**
   * System erfüllt eine Safety-Funktion.
   * Beeinflusst Threat-Priorisierung und STRIDE-Auswahl.
   */
  safetyRelevant?: boolean;
  safetyRationale?: string;

  // ── Multi-Tenant (Cloud/Backend) ─────────────────────────────────────
  multiTenant?: boolean;      // Relevant für Klasse 3 + 6

  owner?: string;
  notes?: string;
}
```

---

## Formular-Design — konditionale Sichtbarkeit

Je nach `systemClass` werden andere Properties angezeigt:

| Property | Klasse 1 | Klasse 2 | Klasse 3 | Klasse 4 | Klasse 5 | Klasse 6 | Klasse 7 | Klasse 8 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `operatingSystem` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| `certificationLevel` | ✓ | — | — | — | — | ✓ | — | ✓ |
| `updateMechanism` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `boundaryAuthentication` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `authorizationModel` | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| `airGapped` | ✓ | ✓ | — | — | — | — | — | ✓ |
| `remoteAccessEnabled` | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `multiTenant` | — | — | ✓ | — | — | ✓ | — | — |
| `safetyRelevant` | ✓ | ✓ | — | — | — | — | — | ✓ |

---

## STRIDE-Mapping für Multiprocess

Multiprocess wird auf System-Boundary-Ebene analysiert, nicht auf
interner Prozess-Ebene. Das ergibt eine andere STRIDE-Auswahl:

```typescript
STRIDE_PER_ELEMENT_TYPE["Multiprocess"] = ["S", "T", "D", "E"];
```

**Wegfall von R und I:**
- **R (Repudiation)** — Abstreitbarkeit ist ein Logging-Problem auf Prozessebene,
  nicht auf Systemebene. Logging läuft auf den enthaltenen DataFlows und Prozessen.
- **I (Information Disclosure)** — Disclosure passiert auf DataFlow-Ebene
  (unverschlüsselter Kanal) oder DataStore-Ebene (ungesicherter Speicher),
  nicht auf der Systemgrenze selbst.

**Verbleibende Kategorien:**
- **S** — System-Identity-Spoofing (welcher Controller ist das wirklich?)
- **T** — Firmware/Software-Tampering, Konfigurationsmanipulation
- **D** — DoS auf Systemebene (Ressourcenerschöpfung, Kommunikationsabbruch)
- **E** — Privilege Escalation an der Systemgrenze (Debug-Interface, Update-Kanal)

---

## System-Level Threat Template IDs

Neue Template-IDs mit `SYS`-Präfix — klar von Prozess-Templates unterscheidbar:

```
S-SYS-001   System identity spoofing (universal)
S-SYS-EMB-001  Controller identity spoofing on fieldbus (Embedded/OT)
S-SYS-CLO-001  Cloud service identity spoofing via token theft

T-SYS-001   Firmware/software tampering (universal)
T-SYS-EMB-001  Firmware manipulation via update channel (Embedded)
T-SYS-EMB-002  Configuration tampering via debug interface (Embedded)
T-SYS-CLO-001  Container image tampering (Cloud)
T-SYS-MOB-001  App binary tampering (Mobile)

D-SYS-001   System-level denial of service (universal)
D-SYS-EMB-001  Controller resource exhaustion via fieldbus flooding (Embedded/OT)
D-SYS-SAF-001  Safety system DoS via invalid safety parameter injection

E-SYS-001   Privilege escalation at system boundary (universal)
E-SYS-EMB-001  Privilege escalation via JTAG/SWD debug interface (Embedded)
E-SYS-EMB-002  Privilege escalation via unsigned firmware update
E-SYS-CLO-001  Privilege escalation via misconfigured IAM (Cloud)
```

---

## Context-Filter Mapping für neue Templates

```json
{ "id": "S-SYS-EMB-001", "context": { "platform": ["Embedded", "OT"] } }
{ "id": "T-SYS-EMB-001", "context": { "platform": ["Embedded"] } }
{ "id": "T-SYS-CLO-001", "context": { "platform": ["Cloud"] } }
{ "id": "T-SYS-MOB-001", "context": { "platform": ["Mobile"] } }
{ "id": "D-SYS-SAF-001", "context": { "domain": ["Industrial"], "platform": ["OT"] } }
{ "id": "E-SYS-EMB-001", "context": { "platform": ["Embedded"] } }
{ "id": "E-SYS-CLO-001", "context": { "platform": ["Cloud"] } }
```

---

## Properties die aus `ProcessProperties` wegfallen

Folgende Properties sind für Multiprocess semantisch falsch und werden
im Formular nicht angezeigt wenn `systemClass` gesetzt ist:

| Property | Grund |
|---|---|
| `runsAs` | "Welcher Account ist ein ganzes System?" — sinnlos |
| `privilegeLevel` | Intern heterogen — kein einzelner Wert aussagekräftig |
| `technology` | Ersetzt durch `systemClass` + `operatingSystem` |
| `processSemantic` | Ersetzt durch `systemClass` |
| `errorHandling` | Interne Implementierungsdetail, nicht Systemgrenze |

---

## Auswirkungen auf andere Teile

**element-properties.ts:**
- `MultiprocessProperties` als neues Interface hinzufügen
- `ElementProperties` Union um `MultiprocessProperties` erweitern
- `ProcessProperties` bleibt unverändert für `Process`-Elemente

**STRIDE-Tabelle:**
- `STRIDE_PER_ELEMENT_TYPE["Multiprocess"]` von `["S","T","R","I","D","E"]`
  auf `["S","T","D","E"]` ändern

**element-templates.json:**
- Neue Template-IDs `S-SYS-*`, `T-SYS-*`, `D-SYS-*`, `E-SYS-*` hinzufügen
- Bestehende Multiprocess-Einträge (`S-P-*` etc.) bleiben für `Process`

**i18n:**
- `en/de element-threats-attacks.json` — neue Template-Texte für SYS-Einträge

**Coverage Inference (Dokument B):**
- `inferCoverage()` erhält `MultiprocessProperties` als eigenen Kontext-Pfad
- Coverage-Regeln für `systemClass` + `certificationLevel` + `updateMechanism`

---

## Definition of Done

- [ ] `MultiprocessProperties` Interface in `element-properties.ts`
- [ ] `ElementProperties` Union aktualisiert
- [ ] DFD-Formular: `systemClass`-Dropdown als primäres Feld
- [ ] DFD-Formular: konditionale Sichtbarkeit der Properties je nach `systemClass`
- [ ] `STRIDE_PER_ELEMENT_TYPE["Multiprocess"]` = `["S","T","D","E"]`
- [ ] Mindestens 5 neue SYS-Template-IDs in `element-templates.json`
- [ ] i18n-Strings (en/de) für alle neuen SYS-Templates
- [ ] Context-Filter korrekt gesetzt auf neuen Templates
- [ ] CNC-Referenzfall: alle 6 Multiprocess-Elemente mit neuen Properties modelliert
- [ ] Keine Regression auf bestehende Process-Elemente
