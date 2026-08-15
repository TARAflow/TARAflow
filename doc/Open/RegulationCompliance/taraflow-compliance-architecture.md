# TARAflow — Compliance Architecture Roadmap
## IEC 62443-4-2 Close-Loop & Compliance-Report

**Status:** Architektur-Entscheidung  
**Datum:** 2026-05-24  
**Scope:** Property-Gaps, CR-Mapping, Compliance-Report-Feature

---

## Ziel

TARAflow soll nicht nur ein Threat-Modelling-Tool sein, sondern als Nebenprodukt einer TARA automatisch eine **IEC 62443-4-2 CR-Compliance-Matrix** generieren können.

```
DFD-Modell + Properties
        ↓
  CR_MAPPING.json
        ↓
  Compliance-Report
  ┌─────────────────────────────────────────────────────┐
  │ CR 1.1  ✅ Implemented  ← IF-3 logicalAccessControl │
  │ CR 3.1  ✅ Implemented  ← DF-2 integrityProtection  │
  │ CR 3.2  ❌ Gap          ← no malwareProtection set  │
  │ EDR 2.13 ✅ Implemented ← IF-1 debugProtection      │
  └─────────────────────────────────────────────────────┘
```

**Prinzip:** Single Source of Truth. Keine doppelte Dateneingabe. Der Analyst modelliert das System — der Compliance-Report entsteht automatisch.

---

## Drei-Phasen-Plan

### Phase 1 — Property-Gaps schliessen *(aktuell)*
Fehlende Properties in `element-properties.ts` ergänzen, damit alle relevanten CRs automatisch ableitbar sind.

### Phase 2 — CR-Mapping definieren
`cr-mapping.json` erstellen: Welche Property auf welchem Element-Typ welche CR(s) mit welchem SL nachweist.

### Phase 3 — Compliance-Report-Feature implementieren
Neuer Tab oder generiertes Dokument das den CR-Status automatisch aus dem Modell ableitet.

---

## Phase 1: Property-Gaps

### Klassifikation

**Typ A — Vollständig automatisch ableitbar**  
Property-Wert → CR direkt erfüllt. Kein manueller Eingriff nötig.

**Typ B — Partiell automatisch ableitbar**  
Mehrere Properties zusammen ergeben einen CR-Nachweis, oder Property ist ein valider aber nicht perfekter Nachweis.

**Typ C — Manueller Override erforderlich**  
CR ist nicht aus Properties ableitbar. Analyst muss Rationale eintragen. Report zeigt "Manual" Status.

**Typ D — Bewusst nicht modellierbar**  
Reine Implementation-Details (Code-Level, Timeout-Configs) die keine Architektur-Aussage darstellen.

---

### 1.1 Fehlende Properties — Tier 1 (Direkt threat-relevant, Close-Loop-tauglich)

#### `logicalAccessControl: "mfa"` auf `InterfaceProperties.implementedControls`

**CR:** CR 1.1 RE(2) — Multifactor authentication for all interfaces  
**SL:** SL-3, SL-4  
**Typ:** A  
**Threat-Impact:** Eliminiert Spoofing-Threats für HMI/SCADA-Interfaces; reduziert EoP  
**Betroffene Interface-Types:** `ethernet`, `wifi`, `bluetooth`, `uart` (mit HMI), `usb`

```typescript
logicalAccessControl?:
  | "none"
  | "password"
  | "certificate"
  | "challenge_response"
  | "secure_pairing"
  | "hardware_token"
  | "mfa";          // ← NEU: CR 1.1 RE(2)
```

**Action:** Enum-Wert in `element-properties.ts` ergänzen + i18n.

---

#### `malwareProtection` auf `ProcessProperties` und `MultiprocessProperties`

**CR:** CR 3.2 (alle Device-Typen) — SAR/EDR/HDR/NDR 3.2 — Protection from malicious code  
**SL:** SL-1 bis SL-4 (alle Levels)  
**Typ:** A  
**Threat-Impact:** Reduziert Tampering-Threats durch Code-Injection; eliminiert Malware-Ausführung  
**Betroffene Element-Types:** Process (rtos_task, driver, bootloader), Multiprocess (embedded_controller, scada_hmi, workstation, gateway)

```typescript
malwareProtection?:
  | "none"                  // Kein Schutz — Threat aktiv
  | "av_software"           // Antivirus/Antimalware (HDR 3.2)
  | "application_whitelist" // Allowlist-basierte Ausführungskontrolle
  | "code_signing"          // Nur signierter Code ausführbar (EDR 3.2)
  | "nx_dep"                // NX/DEP Hardware-Schutz
  | "sandbox"               // Sandbox/Container-Isolation
  | "custom";               // Proprietär — Rationale in notes
```

**Action:** Property zu `ProcessProperties` und `MultiprocessProperties` hinzufügen + Defaults + i18n + Form.

---

#### `failSafeOutputState` auf `ProcessProperties`

**CR:** CR 3.6 — Deterministic output  
**SL:** SL-1 bis SL-4  
**Typ:** A  
**Threat-Impact:** Direkte Safety-Relevanz; verhindert dass Tampering-Angriffe unkontrollierte Prozessausgaben erzeugen  
**Betroffene Element-Types:** Process mit `processSemantic: "functional_block"` und direktem Prozessbezug; besonders relevant bei `safetyRelevant: true`

```typescript
failSafeOutputState?:
  | "not_defined"       // Kein Fail-Safe definiert — Tampering-Threat aktiv
  | "unpowered"         // Outputs fallen auf unpowered state
  | "hold_last_value"   // Outputs halten letzten bekannten guten Wert
  | "fixed_value"       // Outputs gehen auf konfigurierten fixen Wert
  | "dynamic";          // Kontextabhängig — beschreiben in notes
```

**Action:** Property zu `ProcessProperties` + Form (nur wenn `processSemantic !== "execution_unit"` oder `safetyRelevant: true`) + i18n.

---

#### `accountManagement` auf `ProcessProperties` und `MultiprocessProperties`

**CR:** CR 1.3 — Account management  
**SL:** SL-1 bis SL-4  
**Typ:** B (partiell — kombiniert mit `authorizationModel` für vollständigen Nachweis)  
**Threat-Impact:** Reduziert Spoofing und EoP durch zentralisierte Identity-Kontrolle  
**Betroffene Element-Types:** Process (api, ui, daemon), Multiprocess (scada_hmi, backend_application, workstation)

```typescript
accountManagement?:
  | "local_only"      // Lokale Accounts — kein zentrales Management
  | "ldap"            // LDAP-Directory (z.B. OpenLDAP)
  | "active_directory"// Microsoft AD
  | "radius"          // RADIUS-Server
  | "iam"             // Cloud IAM (AWS, Azure, GCP)
  | "custom";         // Proprietär
```

**Action:** Property zu `ProcessProperties` und `MultiprocessProperties` + Form + i18n.

---

#### `authenticatorStorage` auf `ProcessProperties`, `MultiprocessProperties`, `ChipBoundaryProperties`

**CR:** CR 1.5 RE(1) — Hardware security for authenticators  
**SL:** SL-3, SL-4  
**Typ:** A  
**Threat-Impact:** Reduziert Key-Extraction-Threats; Credential-Theft-Threats  
**Betroffene Element-Types:** Alle die Credentials speichern oder verarbeiten

```typescript
authenticatorStorage?:
  | "software_only"   // Credentials in Software — extrahierbar
  | "tpm"             // Trusted Platform Module
  | "secure_element"  // Dedicated Secure Element (ATECC608 etc.)
  | "hsm"             // Hardware Security Module
  | "keychain_os"     // OS-managed keychain (iOS Keychain, Android Keystore)
  | "custom";         // Proprietär
```

**Action:** Property zu allen drei Element-Types + Form + i18n.  
**Hinweis:** Auf `ChipBoundary` ist `chipType: "se" | "hsm"` bereits ein impliziter Nachweis — Mapping berücksichtigt das.

---

#### `defaultDenyPolicy` auf `TrustBoundaryProperties`

**CR:** NDR 5.2 RE(1) — Deny all, permit by exception; RE(2) — Island mode; RE(3) — Fail close  
**SL:** SL-2 (RE1), SL-3/4 (RE2, RE3)  
**Typ:** A  
**Threat-Impact:** Reduziert Restricted-Data-Flow-Threats drastisch; verhindert laterale Bewegung  
**Betroffene Element-Types:** TrustBoundary mit `boundaryType: "network"` oder `"cloud"`

```typescript
defaultDenyPolicy?:
  | "allow_all"                  // Keine Restriktion — alle Threats aktiv
  | "deny_all_permit_exception"  // NDR 5.2 RE(1) — Whitelist-basiert
  | "island_mode"                // NDR 5.2 RE(2) — vollständige Isolation möglich
  | "fail_close";                // NDR 5.2 RE(3) — bei Failure keine Kommunikation
```

**Action:** Property zu `TrustBoundaryProperties` + Form (nur für `boundaryType: "network" | "cloud"`) + i18n.

---

#### `secureErase` auf `DataStoreProperties`

**CR:** CR 4.2 — Information persistence / secure erase at decommissioning  
**SL:** SL-2 bis SL-4  
**Typ:** A  
**Threat-Impact:** Eliminiert Information-Disclosure-Threats bei Gerätewechsel/Dekommissionierung  
**Betroffene Element-Types:** DataStore mit `storedDataTypes` enthält `credentials`, `keys_certificates`, `pii`, `firmware`

```typescript
secureErase?:
  | "not_supported"     // Kein Secure Erase — Information Disclosure Threat aktiv
  | "software_wipe"     // Software-basiertes Überschreiben (NIST 800-88 DoD)
  | "crypto_erase"      // Encryption-as-erase — Key löschen = Daten unlesbar
  | "physical_destroy"  // Physische Zerstörung
  | "vendor_procedure"; // Hersteller-definierter Prozess
```

**Action:** Property zu `DataStoreProperties` + Form + i18n.

---

#### `backupMechanism` auf `MultiprocessProperties`

**CR:** CR 7.3 — Control system backup; CR 7.4 — Recovery and reconstitution  
**SL:** SL-1 bis SL-4  
**Typ:** B (kombiniert mit `updateMechanism` für vollständigen CR 7.4-Nachweis)  
**Threat-Impact:** Reduziert DoS-Impact; Availability-Threats  
**Betroffene Element-Types:** Multiprocess (embedded_controller, scada_hmi, backend_application)

```typescript
backupMechanism?:
  | "none"              // Kein Backup — DoS-Impact maximal
  | "manual_local"      // Manuelles lokales Backup
  | "automated_local"   // Automatisiertes lokales Backup
  | "automated_remote"  // Automatisiertes Remote-Backup (CR 7.3)
  | "redundant_system"  // Hot-Standby / Redundanz (CR 7.4)
  | "vendor_managed";   // Vom Hersteller verwaltet
```

**Action:** Property zu `MultiprocessProperties` + Form + i18n.

---

### 1.2 Fehlende Properties — Tier 2 (Compliance-Report, indirekt threat-relevant)

#### `sessionControl` auf `ProcessProperties`

**CR:** CR 2.5 — Session lock; CR 2.6 — Remote session termination; CR 2.7 — Concurrent session control  
**SL:** CR 2.5 SL-1+, CR 2.6 SL-2+, CR 2.7 SL-3+  
**Typ:** B  
**Betroffene Element-Types:** Process (api, ui, websocket), Multiprocess (scada_hmi, backend_application)

```typescript
sessionControl?: {
  sessionLockEnabled?: boolean;         // CR 2.5 — Session lock nach Inaktivität
  remoteTerminationEnabled?: boolean;   // CR 2.6 — Manuelle Remote-Session-Terminierung
  maxConcurrentSessions?: number;       // CR 2.7 — Limit pro User/Interface
};
```

**Action:** Nested object auf `ProcessProperties` + Form (nur für ui, api, websocket technology) + i18n.

---

#### `nonRepudiation` auf `ProcessProperties` und `DataFlowProperties`

**CR:** CR 2.12 — Non-repudiation  
**SL:** SL-1 bis SL-4  
**Typ:** B (partiell — `endpointAuthentication: "certificate"` + `monitoringControl: "usage_logged"` ist starker indirekter Nachweis)  
**Betroffene Element-Types:** Process (ui, api), DataFlow (credentials, firmware, command)

```typescript
nonRepudiation?:
  | "none"              // Kein Nachweis möglich
  | "audit_log"         // Audit-Log mit User + Timestamp
  | "digital_signature" // Kryptographische Signatur der Aktionen
  | "hardware_backed";  // HSM/TPM-gesicherter Nachweis
```

**Action:** Property zu `ProcessProperties` + i18n. Auf DataFlow optional.

---

#### `cryptoStandard` auf `DataFlowProperties` und `DataStoreProperties`

**CR:** CR 4.3 — Use of cryptography  
**SL:** SL-1 bis SL-4  
**Typ:** A (wenn gesetzt; wenn nicht gesetzt → CR 4.3 Status = "Unknown")  
**Betroffene Element-Types:** DataFlow (encryptionInTransit gesetzt), DataStore (encryptionAtRest gesetzt)

```typescript
cryptoStandard?:
  | "fips_140_2"        // FIPS 140-2 Level 1-4
  | "fips_140_3"        // FIPS 140-3
  | "common_criteria"   // Common Criteria EAL
  | "nist_approved"     // NIST-approved algorithms (AES-256, SHA-256+)
  | "custom";           // Proprietär — Rationale in notes
```

**Action:** Property zu `DataFlowProperties` und `DataStoreProperties` + Form (nur wenn encryption gesetzt) + i18n.

---

### 1.3 Bewusst nicht modelliert (Typ D)

Diese CRs sind reine Implementation-Details ohne Architektur-Aussage. Sie erscheinen im Compliance-Report als **"Manual Override required"** — der Analyst muss ein Freitext-Rationale eintragen.

| CR | Grund |
|---|---|
| CR 1.4 — Identifier management | Naming-Policy, kein Architektur-Property |
| CR 1.7 — Password strength | Password-Policy, kein Architektur-Property |
| CR 1.10 — Authenticator feedback | UI-Implementation-Detail |
| CR 1.12 — System use notification | Login-Banner, kein Architektur-Property |
| CR 2.10 — Response to audit processing failures | Policy/Prozess |
| CR 2.11 — Timestamps | Logging-Implementation |
| CR 3.3 — Security functionality verification | Test-Prozess |
| CR 3.8 — Session integrity (randomness) | Crypto-Implementation |
| CR 7.5 — Emergency power | Infrastruktur, nicht im DFD modellierbar |
| CR 7.6 — Network configuration settings | Admin-Feature |

---

## Phase 2: CR-Mapping Architektur

### 2.1 Dateistruktur

```
src/
  features/
    compliance/
      models/
        cr-mapping-types.ts       ← TypeScript-Typen für das Mapping
        cr-mapping.json           ← Die eigentliche Mapping-Tabelle
        compliance-status.ts      ← Status-Typen: Implemented, Partial, Gap, NA, Manual
      services/
        compliance-evaluator.ts   ← Wertet Mapping gegen aktuelles Modell aus
        compliance-report-gen.ts  ← Generiert Report-Daten
      components/
        compliance-tab/           ← UI-Komponente
```

### 2.2 Mapping-Schema

```typescript
// cr-mapping-types.ts

export type CRStatus = 
  | "implemented"   // Alle Bedingungen erfüllt
  | "partial"       // Mindestens eine Bedingung erfüllt, aber nicht alle RE(x)
  | "gap"           // Keine Bedingung erfüllt
  | "na"            // Nicht anwendbar für dieses Modell / Gerätekategorie
  | "manual";       // Nicht automatisch prüfbar — Analyst-Eingabe erforderlich

export type DeviceCategory = "embedded" | "host" | "network" | "software" | "all";

export interface CRCondition {
  // Element-Typ der geprüft wird
  elementType: "Interface" | "Process" | "DataFlow" | "DataStore" 
             | "TrustBoundary" | "PhysicalBoundary" | "ChipBoundary" 
             | "Multiprocess" | "ExternalEntity";
  
  // Property-Pfad (dot-notation für nested)
  property: string;
  
  // Werte die als "erfüllt" gelten
  satisfiedBy: unknown[];
  
  // Optionale Bedingung: Property X muss Wert Y haben damit diese Condition gilt
  when?: {
    property: string;
    in: unknown[];
  };
  
  // Aggregation: mindestens ein Element muss die Bedingung erfüllen (default)
  // oder: alle Elemente müssen erfüllen
  scope?: "any" | "all";
}

export interface CRRequirement {
  id: string;                    // z.B. "CR-1.1", "EDR-2.13", "NDR-5.2-RE1"
  title: string;
  fr: string;                    // z.B. "FR1"
  deviceCategories: DeviceCategory[];
  slLevels: {                    // Ab welchem SL-Level wird diese CR relevant
    base?: number;               // SL für Basis-Requirement
    re?: Record<string, number>; // SL für jedes Requirement Enhancement
  };
  conditions: CRCondition[];     // Alle Bedingungen (OR-Verknüpfung zwischen conditions)
  conditionLogic?: "any" | "all"; // Wie werden conditions verknüpft (default: any)
  manualFallback?: boolean;      // true = kann nicht vollständig auto-geprüft werden
  notes?: string;
}
```

### 2.3 Mapping-Beispiele (Auszug aus `cr-mapping.json`)

```json
[
  {
    "id": "CR-1.1",
    "title": "Human user identification and authentication",
    "fr": "FR1",
    "deviceCategories": ["all"],
    "slLevels": { "base": 1, "re": { "RE1": 2, "RE2": 3 } },
    "conditions": [
      {
        "elementType": "Interface",
        "property": "implementedControls.logicalAccessControl",
        "satisfiedBy": ["password", "certificate", "challenge_response", "hardware_token", "mfa"],
        "when": {
          "property": "type",
          "in": ["ethernet", "wifi", "bluetooth", "uart", "usb", "rs232", "rs485"]
        },
        "scope": "any"
      }
    ],
    "conditionLogic": "any"
  },
  {
    "id": "CR-1.1-RE2",
    "title": "Multifactor authentication for all interfaces",
    "fr": "FR1",
    "deviceCategories": ["all"],
    "slLevels": { "base": 3 },
    "conditions": [
      {
        "elementType": "Interface",
        "property": "implementedControls.logicalAccessControl",
        "satisfiedBy": ["mfa"],
        "scope": "any"
      }
    ]
  },
  {
    "id": "EDR-2.13",
    "title": "Use of physical diagnostic and test interfaces",
    "fr": "FR2",
    "deviceCategories": ["embedded"],
    "slLevels": { "base": 2, "re": { "RE1": 3 } },
    "conditions": [
      {
        "elementType": "Interface",
        "property": "implementedControls.debugProtection",
        "satisfiedBy": ["auth_required", "limited_commands", "readout_protection", "fused_off"],
        "when": {
          "property": "type",
          "in": ["jtag", "swd", "swd_swo", "jtag_trace", "uart", "usb"]
        },
        "scope": "any"
      }
    ]
  },
  {
    "id": "EDR-2.13-RE1",
    "title": "Active monitoring of diagnostic interfaces",
    "fr": "FR2",
    "deviceCategories": ["embedded"],
    "slLevels": { "base": 3 },
    "conditions": [
      {
        "elementType": "Interface",
        "property": "implementedControls.monitoringControl",
        "satisfiedBy": ["alerted", "active_response"],
        "when": {
          "property": "type",
          "in": ["jtag", "swd", "swd_swo", "jtag_trace", "uart", "usb"]
        },
        "scope": "any"
      }
    ]
  },
  {
    "id": "CR-3.1",
    "title": "Communication integrity",
    "fr": "FR3",
    "deviceCategories": ["all"],
    "slLevels": { "base": 1, "re": { "RE1": 2 } },
    "conditions": [
      {
        "elementType": "DataFlow",
        "property": "integrityProtection",
        "satisfiedBy": ["crc", "hash", "hmac", "signature", "custom"],
        "scope": "all"
      }
    ]
  },
  {
    "id": "CR-3.11",
    "title": "Physical tamper resistance and detection",
    "fr": "FR3",
    "deviceCategories": ["embedded", "host", "network"],
    "slLevels": { "base": 2, "re": { "RE1": 3 } },
    "conditionLogic": "any",
    "conditions": [
      {
        "elementType": "PhysicalBoundary",
        "property": "tamperProtection",
        "satisfiedBy": ["seal", "switch", "mesh", "potting", "active_detection"],
        "scope": "any"
      },
      {
        "elementType": "Interface",
        "property": "implementedControls.physicalAccessProtection",
        "satisfiedBy": ["sealed", "tamper_evident"],
        "scope": "any"
      }
    ]
  },
  {
    "id": "CR-4.1",
    "title": "Information confidentiality",
    "fr": "FR4",
    "deviceCategories": ["all"],
    "slLevels": { "base": 1 },
    "conditionLogic": "all",
    "conditions": [
      {
        "elementType": "DataFlow",
        "property": "encryptionInTransit",
        "satisfiedBy": ["tls", "mtls", "vpn", "custom"],
        "scope": "all"
      },
      {
        "elementType": "DataStore",
        "property": "encryptionAtRest",
        "satisfiedBy": ["yes", "aes256", "tde", "kms", "custom"],
        "scope": "all"
      }
    ]
  },
  {
    "id": "EDR-3.14",
    "title": "Integrity of the boot process",
    "fr": "FR3",
    "deviceCategories": ["embedded"],
    "slLevels": { "base": 1, "re": { "RE1": 2 } },
    "conditions": [
      {
        "elementType": "ChipBoundary",
        "property": "secureBootEnabled",
        "satisfiedBy": [true],
        "scope": "any"
      }
    ]
  },
  {
    "id": "CR-1.3",
    "title": "Account management",
    "fr": "FR1",
    "deviceCategories": ["all"],
    "slLevels": { "base": 1 },
    "conditions": [
      {
        "elementType": "Multiprocess",
        "property": "accountManagement",
        "satisfiedBy": ["ldap", "active_directory", "radius", "iam"],
        "scope": "any"
      },
      {
        "elementType": "Process",
        "property": "accountManagement",
        "satisfiedBy": ["ldap", "active_directory", "radius", "iam"],
        "scope": "any"
      }
    ],
    "conditionLogic": "any",
    "manualFallback": true,
    "notes": "local_only zählt als partiell — Analyst muss Policy dokumentieren"
  },
  {
    "id": "CR-7.7",
    "title": "Least functionality",
    "fr": "FR7",
    "deviceCategories": ["all"],
    "slLevels": { "base": 1 },
    "conditionLogic": "any",
    "conditions": [
      {
        "elementType": "Interface",
        "property": "implementedControls.serviceAccessPolicy",
        "satisfiedBy": ["maintenance_only", "factory_only", "temporary_enable"],
        "scope": "any"
      },
      {
        "elementType": "Interface",
        "property": "operationalState",
        "satisfiedBy": ["sw_disabled", "hw_disabled", "permanent_disabled"],
        "scope": "any"
      }
    ]
  }
]
```

### 2.4 Evaluator-Logik (Pseudocode)

```typescript
// compliance-evaluator.ts

function evaluateCR(
  requirement: CRRequirement,
  graph: DFDGraph,
  targetSL: number
): CRStatus {
  
  // 1. Device-Category check (embedded / host / network / all)
  if (!isApplicableToModel(requirement.deviceCategories, graph)) {
    return "na";
  }
  
  // 2. SL-Level check — ist diese CR für den Ziel-SL relevant?
  if (requirement.slLevels.base > targetSL) {
    return "na";
  }
  
  // 3. Manual fallback — nicht automatisch prüfbar
  if (requirement.manualFallback && requirement.conditions.length === 0) {
    return "manual";
  }
  
  // 4. Conditions auswerten
  const results = requirement.conditions.map(c => evaluateCondition(c, graph));
  
  const logic = requirement.conditionLogic ?? "any";
  const satisfied = logic === "any" 
    ? results.some(r => r) 
    : results.every(r => r);
  
  if (satisfied) return "implemented";
  if (results.some(r => r)) return "partial"; // Mindestens eine Condition erfüllt
  return "gap";
}

function evaluateCondition(
  condition: CRCondition,
  graph: DFDGraph
): boolean {
  const elements = getElementsOfType(condition.elementType, graph);
  
  const matching = elements.filter(el => {
    // when-Bedingung prüfen
    if (condition.when) {
      const whenValue = getNestedProperty(el.properties, condition.when.property);
      if (!condition.when.in.includes(whenValue)) return false;
    }
    
    // Haupt-Property prüfen
    const value = getNestedProperty(el.properties, condition.property);
    return condition.satisfiedBy.includes(value);
  });
  
  return condition.scope === "all"
    ? matching.length === elements.length  // alle müssen erfüllen
    : matching.length > 0;                 // mindestens eines muss erfüllen
}
```

---

## Phase 2b: EN 50742 Approach B — Fixed-Subset Requirement Model

### Warum das generische SL-Schwellenwert-Modell nicht reicht

`compliance-evaluator.ts` filtert heute rein über `requirement.slLevels.base > targetSL → na`. Das entspricht dem normalen IEC-62443-Modell: bei Ziel-SL gelten alle Requirements mit `base ≤ targetSL`.

prEN 50742 (Draft, Clause 8.2/8.3, Tables 3+4) funktioniert anders. Statt "alles bis SL-C2" verlangt der Standard eine **explizit benannte Teilmenge** von SR/CR-IDs je Foundational Requirement, mit fixem Ziel-SL-C pro FR (nicht projektweit einheitlich):

| FR | System (Table 3, SR) | Component (Table 4, CR) | Ziel-SL-C |
|---|---|---|---|
| FR1 | SR1.1 | CR1.1, CR1.2 | SL-C2 |
| FR2 | SR2.1, SR2.8, SR2.9 | CR2.1, CR2.6, CR2.8, CR2.9, CR2.12, EDR2.13 | SL-C2 |
| FR3 | SR3.1, SR3.4, SR3.5, SR3.6 | CR3.1, CR3.4, CR3.5, CR3.6, EDR3.2, EDR3.11, EDR3.14 | SL-C2 |
| FR4 | — | — | None (nicht gefordert) |
| FR5 | SR5.1 | CR5.1 | SL-C1 |
| FR6 | SR6.1 | CR6.1 | SL-C1 |
| FR7 | SR7.1, SR7.2 | CR7.1, CR7.2 | SL-C2 |

Requirements, die generisch bei SL-C2 liegen aber nicht in dieser Liste stehen (z.B. CR1.3 Account Management), sind für EN 50742 Approach B **nicht** gefordert — der bestehende `slLevels`-Schwellenwert-Filter würde sie aber fälschlich als relevant markieren.

### Erweiterung des Datenmodells

`cr-mapping.json` bleibt die vollständige, normübergreifende IEC-62443-Referenztabelle (Single Source of Truth für alle CR/SR/EDR-IDs). EN 50742 wird nicht als eigenes Mapping-File dupliziert, sondern als **Filter-Profil** über das bestehende Mapping gelegt:

```typescript
// cr-mapping-types.ts — Ergänzung

export type MachineryRole = "system" | "component";

export interface ComplianceProfile {
  /** Welche Norm/welcher Approach dieses Profil abbildet (Report-Provenienz) */
  normativeBasis: string;              // "prEN 50742:2025 (Draft), Clause 8.2/8.3, Tables 3+4"

  /** Fixes Ziel-SL-C je FR, getrennt nach system/component. null = FR nicht gefordert (z.B. FR4). */
  frTargetSL: Record<MachineryRole, Record<string /* FR-ID */, number | null>>;

  /** Explizite Allow-List der geforderten Requirement-IDs, getrennt nach system/component.
   *  Requirements ausserhalb dieser Liste werden IMMER als "na" bewertet,
   *  unabhängig vom generischen SL-Schwellenwert. */
  requirementIds: Record<MachineryRole, string[]>;

  /** Optional: normspezifischer Mindestwert für numerische Properties,
   *  z.B. Audit-Log-Aufbewahrung (EN 50742 8.5: ≥ 5 Jahre für CR-2.8). */
  numericOverrides?: Record<string /* requirement id */, { minValue: number; unit: string }>;

  /** Erlaubt Approach-B-Klausel 8.3 (CCSC2): Component darf niedrigeres
   *  SL-C haben, wenn System-Ebene kompensiert. */
  allowsCompensatingCountermeasures: boolean;
}
```

`compliance-evaluator.ts` bekommt einen zusätzlichen, vorgeschalteten Filter (läuft VOR dem bestehenden SL-Vergleich):

```typescript
function isInScope(requirement: CRRequirement, profile: ComplianceProfile | undefined, role: MachineryRole): boolean {
  if (!profile) return true; // kein Profil aktiv → generisches SL-Modell wie bisher
  return profile.requirementIds[role].includes(requirement.id);
}

function targetSLFor(requirement: CRRequirement, profile: ComplianceProfile | undefined, role: MachineryRole, fallbackSL?: number): number | null {
  if (profile) return profile.frTargetSL[role][requirement.fr] ?? null; // null = FR nicht gefordert
  return fallbackSL ?? null;
}
```

`evaluateCR` ruft `isInScope` als erste Prüfung auf; ist das Requirement nicht in der Liste, ist der Status sofort `"na"` — der generische Schwellenwert-Pfad wird für Requirements ausserhalb der Liste gar nicht mehr erreicht.

### Machinery-Role als eigene Dimension

`deviceCategories` (embedded/host/network/software/all) bleibt unverändert — das ist eine Element-Type-Klassifikation. `machineryRole` (system/component) ist orthogonal dazu: sie bestimmt, ob Table 3 (SR-IDs) oder Table 4 (CR-IDs) als Requirement-Set gilt. Das lebt am Profil, nicht am einzelnen Requirement, weil dasselbe physische Gerät je nach Projekt-Scope als "System" oder "Component" bewertet werden kann (z.B. ein Safety-PLC-Hersteller bewertet seine Komponente gegen Table 4, der Maschinenhersteller, der die PLC integriert, das Gesamtsystem gegen Table 3). `machineryRole` ist ein Projekt-Setting, siehe `regulation-presets-design.md` §10.4.

### Compensating Countermeasures (8.3, CCSC2)

Ein Component-Gap (z.B. Component erfüllt nur SL-C1 statt SL-C2) kann durch eine System-Ebene-Massnahme kompensiert werden. Das braucht einen eigenen Cross-Reference-Typ, analog zu `ThreatReference`/`AssetDataReference`/`AttackTreeLikelihoodReference`:

```typescript
// shared/models/compensating-countermeasure-types.ts (neu)

export interface CompensatingCountermeasureReference {
  requirementId: string;          // die Component-CR, deren Gap kompensiert wird
  componentElementId: string;     // das Element mit dem Gap
  systemElementId: string;        // das System-Element, das kompensiert
  rationale: string;              // Pflichttext (8.3: "shall specify the need for compensating countermeasures")
}
```

Ein Requirement mit einer solchen Referenz erhält im Compliance-Report den neuen Status **"compensated"** statt "gap" — mit Verweis auf die kompensierende System-Massnahme und die Pflicht-Rationale als Tooltip/Fussnote im Report.

### Neuer CRStatus-Wert

```typescript
export type CRStatus =
  | "implemented"
  | "partial"
  | "gap"
  | "compensated"   // NEU — Gap auf Component-Ebene, durch System-Massnahme kompensiert (8.3)
  | "na"
  | "manual";
```

### Auswirkung auf Property-Gaps (Phase 1)

Eine neue Tier-2-Property für die Persistency-Anforderung (8.5):

#### `auditLogRetentionYears` auf `ProcessProperties` und `MultiprocessProperties`

**CR:** CR 2.8 (Auditable events) — im EN-50742-Approach-B-Kontext zusätzlich: Retention ≥ 5 Jahre (8.5).
**Typ:** A, aber mit numerischem Vergleich statt Enum-`satisfiedBy` — dafür braucht `CRCondition` ein zusätzliches Vergleichsfeld:

```typescript
auditLogRetentionYears?: number;
```

```typescript
// CRCondition — Ergänzung
comparator?: "in" | "gte";   // default "in" (bestehendes satisfiedBy-Verhalten unverändert)
minValue?: number;           // nur relevant wenn comparator === "gte"
```

**Action:** Property zu `ProcessProperties`/`MultiprocessProperties` + `CRCondition`-Erweiterung + `evaluateCondition`-Zweig für `"gte"` + i18n.

### Verhältnis zum Regulation-Preset-System

`ComplianceProfile` wird nicht separat konfiguriert, sondern hängt am `RegulationPreset` (`regulation-presets-design.md`, neues §10): der `en-50742-b`-Preset trägt `complianceProfile` als zusätzliches Feld.

**Korrektur (wichtig):** Annex B (EL/WoO/AC → Attack Potential → SRSL, Table B.5/B.6) wird ausschliesslich aus Clause 7.4.2 referenziert — also **nur für Approach A**. Approach B (Clause 8, Table 3/4) kennt kein SRSL und keine Attack-Potential-Berechnung; das Ziel-SL-C ist dort fix vorgegeben, unabhängig vom individuellen Risiko der einzelnen Safety-Funktion. Deshalb gibt es **zwei separate, exklusive Presets** statt eines gemeinsamen `en-50742`-Presets:

- **`en-50742-a`** — SRSL-Modell (Annex B, Attack Potential, Clause 7.4.3-Kontrollkataloge je SRSL-Stufe, je Safety-Funktion). Likelihood-Faktoren WoO/AC/EL sind hier aktiv und fliessen in die SRSL-Herleitung ein. Kein `ComplianceProfile` — es gibt keine Fixed-Requirement-Liste; die Controls sind stattdessen nach SRSL0–3 gestuft formuliert (eigener `SRSLProfile`-Typ, noch nicht im Detail ausgearbeitet — Phase 2c).
- **`en-50742-b`** — `ComplianceProfile` (Fixed-Subset, Table 3/4, dieser Abschnitt). Kein Attack-Potential/SRSL, kein Likelihood-Faktor-Modell — die Compliance-Bewertung ist risikounabhängig (implemented/gap/compensated je Control, nicht je Wahrscheinlichkeit). `likelihoodMethod`/`motivationModel` sind für dieses Preset auf `"not-applicable"` gesetzt.

Die beiden Presets sind vollständig unabhängig voneinander wählbar — kein gemeinsames `en-50742`-Preset mehr, aus dem "beide Requirement-Modelle automatisch folgen". Details zu beiden Presets: siehe `regulation-presets-design.md` §10.

---

## Phase 3: Compliance-Report-Feature

### 3.1 UI-Konzept

**Neuer Tab "Compliance"** in der Hauptnavigation, neben Threats / Risks / Assets / Audit.

```
┌──────────────────────────────────────────────────────────────────┐
│ Compliance                                          [Export PDF] │
├──────────────────────────────────────────────────────────────────┤
│ Target SL: [SL-1] [SL-2●] [SL-3] [SL-4]   Device: [Embedded ▼] │
├──────────────────────────────────────────────────────────────────┤
│ FR 1 — Identification & Authentication Control                   │
│   ✅ CR 1.1   Human user identification     IF-3 logicalAccess…  │
│   ✅ CR 1.1   RE(1) Unique identification   IF-3 (certificate)   │
│   ⚠️  CR 1.1   RE(2) Multifactor auth        No MFA interface set │
│   ✅ CR 1.2   Software/device auth          DF-2 endpointAuth…  │
│   📝 CR 1.3   Account management           [Enter rationale…]   │
│   📝 CR 1.4   Identifier management        [Enter rationale…]   │
│   ✅ CR 1.5   Authenticator management     CB-1 (HSM)           │
│   …                                                              │
├──────────────────────────────────────────────────────────────────┤
│ FR 3 — System Integrity                                          │
│   ✅ CR 3.1   Communication integrity       DF-1,2,3 (hmac)     │
│   ❌ CR 3.2   Malware protection            No property set      │
│   ✅ CR 3.4   Software integrity            DS-1 (signature)     │
│   ✅ EDR 3.11 Physical tamper resistance    PB-1 (mesh + switch) │
│   ✅ EDR 3.14 Boot process integrity        CB-1 secureboot=true │
│   …                                                              │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Status-Legende

| Symbol | Status | Bedeutung |
|---|---|---|
| ✅ | Implemented | Alle Conditions erfüllt |
| ⚠️ | Partial | Basis erfüllt, RE(x) nicht |
| ❌ | Gap | Keine Condition erfüllt — handlungsbedarf |
| 📝 | Manual | Nicht auto-prüfbar — Analyst-Rationale erforderlich |
| N/A | Not applicable | Nicht relevant für dieses Modell/Gerät |

### 3.3 Verlinkung zur Threat-Welt

Jede ❌-Zeile zeigt:
- Welche Threats durch dieses Gap aktiv sind
- Link zum Risk-Tab (offene Risiken die durch dieses Gap entstehen)
- "Create Mitigation"-Button der ein Mitigation-Template im Risk-Tab anlegt

Das schliesst den Kreis: **Compliance Gap → Threat → Risk → Mitigation → Implemented → Close-Loop → Compliance erfüllt.**

### 3.4 Export

- **Markdown/PDF-Report** für Audit-Dokumentation
- **CSV** für externe Compliance-Management-Tools
- **JSON** für maschinenlesbare Weiterverarbeitung

---

## Offene Entscheidungen

| # | Frage | Optionen | Status |
|---|---|---|---|
| 1 | Compliance-Tab im Hauptmodell oder separates Feature? | Tab vs. eigener View | Offen |
| 2 | CR-Mapping: statisches JSON oder konfigurierbar per Projekt? | Static vs. Project-Override | Empfehlung: static mit optionalem Override |
| 3 | Welche Normen neben IEC 62443-4-2? | ISO 21434, EN 50742, CRA | **Entschieden (Phase 2b):** kein separates Mapping-File — EN 50742 Approach B läuft als `ComplianceProfile` (Fixed-Subset-Filter + system/component-Rolle) über dasselbe `cr-mapping.json`, angehängt an den `en-50742-b`-Regulation-Preset (getrennt von `en-50742-a`, das SRSL/Annex B nutzt und kein `ComplianceProfile` hat) |
| 4 | SL-Target: pro Projekt gesetzt oder pro Element? | Projekt-Level | Empfehlung: Projekt-Level, mit Element-Override möglich |
| 5 | Manual-Override: wer darf overriden? | Alle Analysten / nur Lead | Offen |

---

## Abhängigkeiten & Reihenfolge

```
Phase 1a: element-properties.ts — neue Properties (Tier 1)
    ↓
Phase 1b: element-property-defaults.ts — Defaults
    ↓
Phase 1c: Forms — UI für neue Properties
    ↓
Phase 1d: i18n — DE/EN Keys
    ↓
Phase 2a: cr-mapping-types.ts — TypeScript-Schema
    ↓
Phase 2b: cr-mapping.json — vollständiges Mapping für IEC 62443-4-2
    ↓
Phase 2c: compliance-evaluator.ts — Auswertungs-Service
    ↓
Phase 2d: ComplianceProfile-Typ + isInScope/targetSLFor-Filter (EN 50742 Approach B)
    ↓
Phase 2e: CompensatingCountermeasureReference + CRStatus "compensated"
    ↓
Phase 2f: en-50742-b-Preset erhält complianceProfile (siehe regulation-presets-design.md §10)
    ↓
Phase 3a: compliance-tab — UI-Komponente (inkl. machineryRole-Auswahl system/component)
    ↓
Phase 3b: Export — PDF/CSV/JSON-Generator
    ↓
Phase 3c: Threat-Verlinkung — Gap → Risk → Mitigation
```

---

## Nächste Schritte (Phase 1)

- [ ] `logicalAccessControl: "mfa"` ergänzen
- [ ] `malwareProtection` zu `ProcessProperties` und `MultiprocessProperties`
- [ ] `failSafeOutputState` zu `ProcessProperties`
- [ ] `accountManagement` zu `ProcessProperties` und `MultiprocessProperties`
- [ ] `authenticatorStorage` zu `ProcessProperties`, `MultiprocessProperties`, `ChipBoundaryProperties`
- [ ] `defaultDenyPolicy` zu `TrustBoundaryProperties`
- [ ] `secureErase` zu `DataStoreProperties`
- [ ] `backupMechanism` zu `MultiprocessProperties`
- [ ] Tier-2-Properties: `sessionControl`, `nonRepudiation`, `cryptoStandard`
- [ ] `auditLogRetentionYears` zu `ProcessProperties`/`MultiprocessProperties` (EN 50742 8.5)
- [ ] Forms für alle neuen Properties
- [ ] i18n DE/EN für alle neuen Properties
- [ ] DATAFLOW_PROTOCOL_DRIVEN_FIELDS prüfen ob `physicalPathProtection` ergänzt werden muss

**Phase 2b (EN 50742 Approach B, nach Phase 2c):**
- [ ] `ComplianceProfile`-Typ + `MachineryRole` in `cr-mapping-types.ts`
- [ ] `isInScope`/`targetSLFor`-Filter in `compliance-evaluator.ts` vorschalten
- [ ] `comparator: "gte"` + `minValue` in `CRCondition` (für `auditLogRetentionYears`)
- [ ] `CompensatingCountermeasureReference`-Typ (shared) + `CRStatus: "compensated"`
- [ ] `frTargetSL`/`requirementIds`-Tabelle für Table 3 (system) und Table 4 (component) aus prEN 50742 befüllen
- [ ] `machineryRole` als `ProjectSettingsData`-Feld (siehe regulation-presets-design.md §10.4)
