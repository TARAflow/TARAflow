# TARAflow — PhysicalBoundary: Architecture Decision

**Status:** Draft  
**Datum:** 2026-05-21  
**Betrifft:** DFD-Elementmodell, Threat-Generator, draw.io Darstellung

---

## 1. Ausgangslage

TARAflow verwendet bisher `TrustBoundary` mit `boundaryType: "physical"` um physische Barrieren (Gehäuse, Schränke, Gebäude) zu modellieren. Parallel dazu existiert `ChipBoundary` als eigenständiges Element für Hardware-Isolationsgrenzen.

Durch die Einführung von `Interface` und `ChipBoundary` ist ein Muster entstanden, das konsequent weitergeführt werden sollte: **jede semantisch eigenständige Sicherheitsdomäne bekommt ein eigenes First-Class-Element.**

---

## 2. Das Problem: TrustBoundary ≠ PhysicalBoundary

Zwei Konzepte kollidieren aktuell in einem Element:

| Konzept | Beispiel | Schutzmechanismus |
|---|---|---|
| Logische Vertrauensgrenze | Internet ↔ OT-Netz | Firewall, Auth, Policy |
| Physische Zugriffsbarriere | Schaltschrank, Gehäuse | Schloss, Siegel, Kamera |

### Gegenbeispiel 1 — USB-Port im verschlossenen Schaltschrank

```
Internet → PLC → USB Debug Port
```

- **TrustBoundary:** kaum vorhanden (kein Netzwechsel, kein Identity-Wechsel)  
- **PhysicalBoundary:** stark (Schaltschrank abgeschlossen, Zugang nur für Techniker)

### Gegenbeispiel 2 — VPN zwischen zwei Unternehmen

```
Company A ↔ VPN ↔ Company B
```

- **TrustBoundary:** stark (Organisationswechsel, Policy-Wechsel)  
- **PhysicalBoundary:** irrelevant

Diese Fälle können mit einem einzigen Element nicht korrekt modelliert werden, ohne Semantik zu verwässern.

---

## 3. Drei orthogonale Boundary-Dimensionen

TARAflow modelliert drei grundlegend verschiedene Sicherheitsdomänen:

| Boundary | Frage | Schutzmechanismus | Threats |
|---|---|---|---|
| `TrustBoundary` | Wer vertraut wem? | Firewall, Auth, Policy, VLAN | MITM, Auth Bypass, Lateral Movement |
| `PhysicalBoundary` | Wer kommt physisch ran? | Gehäuse, Schloss, Badge, Siegel | Physical Access, Cable Tamper, USB Insert |
| `ChipBoundary` | Welche HW-Isolation existiert? | MPU, TrustZone, Debug-Fuse, Secure Boot | JTAG Bypass, Fault Injection, Bus Snooping |

Diese drei Typen sind **nicht hierarchisch** — keiner ist Spezialfall eines anderen. Sie sind orthogonal.

---

## 4. Entscheidung

**`PhysicalBoundary` wird als eigenständiges DFD-Element eingeführt.**

`ChipBoundary` bleibt eigenständig. Auch wenn ein Chip physisch in einem Gehäuse sitzt, beschreibt `ChipBoundary` elektrische und logische Isolation — kein Schloss, keine Kamera, kein Siegel schützt vor Fault Injection.

Der Wert `boundaryType: "physical"` in `TrustBoundaryProperties` wird als deprecated markiert und beim nächsten Save migriert (analog zum bestehenden `boundaryControls`-Deprecation-Pattern).

---

## 5. PhysicalBoundaryProperties

```typescript
export interface PhysicalBoundaryProperties {

  // ── Primary classifier ──────────────────────────────────────────────────
  boundaryType?:
    | "device_enclosure"   // Gerätegehäuse — Schrauben/Clips zum Öffnen
    | "cabinet"            // Schaltschrank, Serverschrank
    | "room"               // Serverraum, Produktionshalle, Technikraum
    | "building"           // Gebäude, Werk
    | "vehicle"            // Fahrzeug, Maschine, Anlage
    | "tamper_zone"        // Versiegelter Bereich (Potting, Tamper-Bag)
    | "custom";

  // ── Exposure ────────────────────────────────────────────────────────────
  /**
   * Physical exposure level — how reachable is this boundary?
   * Uses PEL scale (distinct from network EL scale on DataFlow/Interface).
   *
   * PEL0 (Sealed):     Destructive access only — potted, welded, tamper-zoned
   * PEL1 (Closed):     Tool-assisted access — screws, hex key, disassembly
   * PEL2 (Controlled): Key or badge required
   * PEL3 (Guarded):    Monitored + manned entry — highest physical assurance
   */
  physicalExposureLevel?: PhysicalExposureLevel;

  /**
   * Physical exposure category — HOW OPEN is the boundary?
   * Distinct from physicalAccessControl (WHAT protects it?).
   *
   * public:     No barrier — freely reachable (lobby, outdoor, public area)
   * controlled: Access restricted by mechanism (key, badge, PIN)
   * guarded:    Manned + monitored — active human presence at boundary
   * sealed:     Destructive access only — potted, welded, tamper-zoned
   */
  accessibility?:
    | "public"
    | "controlled"
    | "guarded"
    | "sealed";

  // ── Security Controls ───────────────────────────────────────────────────
  tamperProtection?:
    | "none"
    | "seal"             // Tamper-evident Label / Siegel
    | "switch"           // Tamper-Detection-Schalter
    | "mesh"             // Aktives Tamper-Mesh
    | "potting"          // Epoxidharz-Verguss
    | "active_detection"; // Voltage/Temp-Sensor mit Zeroize

  physicalAccessControl?:
    | "none"
    | "key"
    | "badge"
    | "badge_pin"
    | "biometric"
    | "guard";

  /**
   * Physical monitoring mechanism at this boundary.
   * none / camera / alarm / soc / guard_patrol / tamper_monitoring
   * @see PhysicalMonitoringType
   */
  monitoringType?: PhysicalMonitoringType;

  // ── Attack Surface Hints ────────────────────────────────────────────────
  debugAccessPossible?: boolean;    // Zugänglicher Debug-Port im Innern?
  removableMediaAllowed?: boolean;  // USB, SD-Karte erreichbar?
  requiresToolAccess?: boolean;     // Werkzeug nötig → EL1-Barriere

  // ── Safety / Compliance ─────────────────────────────────────────────────
  safetyRelevant?: boolean;
  safetyRationale?: string;

  // ── Audit ───────────────────────────────────────────────────────────────
  securityControlOwnership?: SecurityControlRecord[];
  notes?: string;
}
```

### 5.1 Bewusst weggelassen (gegenüber ChatGPT-Vorschlag)

| Feld | Grund |
|---|---|
| `environmentType` | Zu granular, kein direkter Threat-Einfluss |
| `serviceAccessRequired` | Analyst-Freitext in `notes` reicht |
| `complianceRelevance` | Gehört auf Projekt-/Asset-Ebene, nicht auf Boundary |
| `requiresDisassembly` | Bereits durch `accessibility: "sealed"` + `requiresToolAccess` abgedeckt |

---


## 5a. Neue Basis-Typen: PhysicalExposureLevel und PhysicalMonitoringType

### PhysicalExposureLevel (PEL)

`physicalExposureLevel` verwendet einen eigenen Typ `PEL0–PEL3` — explizit **nicht** `ExposureLevel (EL0–EL4)`.

**Warum getrennte Skalen?**

`ExposureLevel` auf `DataFlow` und `Interface` beschreibt *Netzwerk-Reachability* — wie weit ein Angreifer über das Netzwerk reisen muss. `PhysicalExposureLevel` auf `PhysicalBoundary` beschreibt *physische Zugänglichkeit* — wie weit ein Angreifer physisch vordringen muss.

Beide Konzepte sind orthogonal: Ein Schaltschrank kann `PEL2` (Badge required) sein, aber ein darin enthaltenes Interface mit Ethernet-Verbindung `EL3` (Adjacent Network). Würden beide `EL3` lauten, wären im Modell zwei vollständig verschiedene Aussagen visuell nicht unterscheidbar.

Zusätzlich: `EL4` (Public Internet) hat kein physisches Äquivalent — PEL toppt daher bei `PEL3`.

| Wert | Bedeutung | Attacker-Precondition |
|---|---|---|
| PEL0 | Sealed — potted, welded, tamper-zoned | Physische Zerstörung erforderlich |
| PEL1 | Closed — Werkzeugzugang (Schrauben, Hex-Key) | Deliberate physical effort, kein Auth |
| PEL2 | Controlled — Schlüssel, Badge oder PIN | Authorized physical access erforderlich |
| PEL3 | Guarded — Monitoring + Personal | Insider oder aktiver Guard bypass nötig |

### Accessibility vs. PhysicalAccessControl

`accessibility` und `physicalAccessControl` werden bewusst als **zwei getrennte Felder** modelliert:

| Feld | Frage | Beispielwert |
|---|---|---|
| `accessibility` | Wie offen ist die Boundary? (Expositionskategorie) | `"controlled"` |
| `physicalAccessControl` | Womit wird sie geschützt? (Mechanismus) | `"badge"` |

Diese Trennung verhindert semantische Inkonsistenz wie `accessibility: "restricted"` + `physicalAccessControl: "none"` und ermöglicht saubere Feasibility-Berechnung in einer späteren Attack-Path-Engine:

```
AttackFeasibility = f(accessibility, physicalAccessControl, monitoringType, tamperProtection)
```

| Wert | Expositionskategorie |
|---|---|
| `public` | Keine Barriere — frei erreichbar |
| `controlled` | Mechanismus vorhanden (key, badge, PIN) |
| `guarded` | Bemannt + überwacht — aktive menschliche Präsenz |
| `sealed` | Nur destruktiver Zugang — potted, verschweisst |

### PhysicalMonitoringType

`monitoringEnabled?: boolean` wird durch `monitoringType?: PhysicalMonitoringType` ersetzt.

**Warum kein Boolean?**

Die verschiedenen Monitoring-Mechanismen haben grundlegend unterschiedliche Threat-Reduktions-Profile:

| Typ | Threat-Reduktion | Begründung |
|---|---|---|
| `none` | Keine | Angreifer operiert unbeobachtet |
| `camera` | Gering | Nur post-hoc Evidence — kein Prevention |
| `alarm` | Mittel | Echtzeit-Alert — reduziert Dwell Time |
| `soc` | Hoch | Aktive Response-Kapazität |
| `guard_patrol` | Mittel–Hoch | Abhängig vom Patrol-Intervall |
| `tamper_monitoring` | Hoch | Elektronischer Tamper-Sensor — oft mit Zeroize auf ChipBoundary kombiniert |

Ein Boolean `true` würde Camera und SOC gleichwertig behandeln — das sind aber Threat-Reduktionen die sich um Faktoren unterscheiden.

## 6. Cascade Defaults

```typescript
export const PHYSICAL_BOUNDARY_TYPE_DEFAULTS: Record<
  NonNullable<PhysicalBoundaryProperties["boundaryType"]>,
  Partial<PhysicalBoundaryProperties>
> = {
  device_enclosure: {
    physicalExposureLevel: "PEL2",  // Tool access needed, not directly exposed
    accessibility:         "controlled",
    requiresToolAccess:    true,
    tamperProtection:      "none",
    physicalAccessControl: "none",
    monitoringType:        "none",
  },
  cabinet: {
    physicalExposureLevel: "PEL2",
    accessibility:         "controlled",
    physicalAccessControl: "key",
    tamperProtection:      "none",
    monitoringType:        "none",
  },
  room: {
    physicalExposureLevel: "PEL2",
    accessibility:         "controlled",
    physicalAccessControl: "badge",
    tamperProtection:      "none",
    monitoringType:        "none",
  },
  building: {
    physicalExposureLevel: "PEL3",
    accessibility:         "guarded",
    physicalAccessControl: "badge",
    tamperProtection:      "none",
    monitoringType:        "none",
  },
  vehicle: {
    physicalExposureLevel: "PEL1",
    accessibility:         "controlled",
    requiresToolAccess:    true,
    tamperProtection:      "none",
    physicalAccessControl: "key",
    monitoringType:        "none",
  },
  tamper_zone: {
    physicalExposureLevel: "PEL0",
    accessibility:         "sealed",
    tamperProtection:      "potting",
    requiresToolAccess:    true,
    physicalAccessControl: "none",
    monitoringType:        "none",
  },
  custom: {},
};
```

---

## 7. Threat-Klassen (automatisch generierbar)

Threats die durch `PhysicalBoundary`-Elemente getriggert werden:

| Threat | STRIDE | Trigger |
|---|---|---|
| Unauthorized Physical Access | S, T | `accessibility` != `sealed` oder `guarded` |
| Cable Tampering | T | `tamperProtection: "none"` + `accessibility: "public"` |
| USB / Removable Media Insertion | T, I | `removableMediaAllowed: true` |
| Debug Port Attachment | E, I | `debugAccessPossible: true` |
| Theft / Device Removal | T, D | `boundaryType: "device_enclosure"` + `tamperProtection: "none"` |
| Relay Attack | S | `physicalAccessControl: "badge"` ohne PIN oder Biometric |
| Side-Channel Preparation | I | `tamperProtection: "none"` + `physicalExposureLevel: "PEL0"/"PEL1"` |

---

## 8. Visuelle Darstellung (draw.io)

### Konvention

| Element | Farbe | Hex | Linienstil | Semantik |
|---|---|---|---|---|
| `TrustBoundary` | Rot | `#CC0000` | Short dash | Logische Vertrauensgrenze |
| `ChipBoundary` | Dunkelbraun | `#BF6000` | Dot-dash | Hardware-/Execution-Isolation |
| `PhysicalBoundary` | Marineblau | `#1B4F8A` | Long dash | Räumlich-physische Barriere |

### Begründung der Linienwahl

Die Strichlänge korrespondiert intuitiv mit der **Granularität** der Boundary:

- `short dash` → TrustBoundary: logisch, häufig, kleinteilig
- `dot-dash` → ChipBoundary: Chip-intern, präzise, engmaschig
- `long dash` → PhysicalBoundary: räumlich, großflächig, ruhig

Beim Überlappen mehrerer Boundaries (z.B. MCU im Schaltschrank im Serverraum) bleibt jede Grenze optisch eindeutig identifizierbar.

### Begründung der Farbwahl

Blau (`#1B4F8A`) transportiert semantisch "Perimeter / Zone / Gehäuse" — konsistent mit klassischen Netzwerk- und Infrastrukturdiagrammen. Kräftig genug um auf hellem Hintergrund zu wirken, ohne mit Rot (TB) oder Braun (CB) zu kollidieren.

---

## 9. Migrations-Strategie

`TrustBoundaryProperties.boundaryType: "physical"` wird deprecated:

```typescript
// TrustBoundaryProperties (existing)
boundaryType?:
  | "network"
  | "privilege"
  | "organization"
  | "cloud"
  | "physical"        // @deprecated — migrate to PhysicalBoundary element
  | "legal"
  | "device"
  | "peripheral"
  | "boot"
  | "debug";
```

Beim nächsten Save eines Projekts mit `boundaryType: "physical"`:
- Element wird als `PhysicalBoundary` neu erstellt
- `TrustBoundary` mit `boundaryType: "physical"` wird entfernt
- Analyst wird per Notification informiert

Analog zum bestehenden `boundaryControls → boundaryControlTypes`-Migrationsmuster.

---

## 9a. PhysicalMobility — Neue Bedrohungsdimension

`physicalMobility` ist **orthogonal zu PEL und accessibility** — es beantwortet eine andere Frage:

> *"Kann der Angreifer den Angriffskontext kontrollieren?"*

| Wert | Bedeutung | Beispiele | Threat-Klassen |
|---|---|---|---|
| `fixed` | Fest installiert — Angriff nur vor Ort | Wand-PLC, Schaltschrank-Controller | Nur Vor-Ort-Angriffe |
| `removable` | Ausbaubar mit Aufwand | DIN-Rail Gateway, Steckmodul, Feldcontroller | Depot Attack, Maintenance Abuse, Hardware Swap |
| `portable` | Tragbar — kann mitgenommen werden | Kalibriergerät, Handheld, Wartungs-Laptop | Evil-Maid, Firmware Implant, Lab-Seitenkanal, Device Substitution |
| `vehicle_mounted` | Im Fahrzeug montiert — mobil aber nicht handtragbar | CAN-Gateway, Fahrzeugsteuerung | Fahrzeugdiebstahl-Szenario, Depot Attack |

**Nur relevant für:** `device_enclosure`, `vehicle`  
**Validator:** Warning wenn diese boundaryTypes ohne `physicalMobility` gespeichert werden.

### Kalibrierungsgerät-Beispiel

```
boundaryType:             "device_enclosure"
physicalMobility:         "portable"         // ← öffnet Evil-Maid Threat-Klasse
safetyRelevant:           true               // ← kombiniert: Rogue Calibration Threat
tamperProtection:         "seal"             // einzige praktische Gegenmassnahme
accessibility:            "controlled"
physicalExposureLevel:    "PEL2"
```

Automatisch generierbare Threats:
- **Evil-Maid / Device Substitution** — Gerät mitgenommen, manipuliert, zurückgebracht
- **Firmware Implant via JTAG** (unbegrenzte Lab-Zeit)
- **Calibration Data Manipulation** (Safety-Impact: `safetyRelevant=true`)
- **Tamper Seal Bypass** (wenn `tamperProtection=seal` = einziger Schutz)

---

## 10. Zusammenfassung

| Frage | Antwort |
|---|---|
| Braucht es `PhysicalBoundary`? | **Ja** — semantisch eigenständig, nicht Spezialfall von TrustBoundary |
| Bleibt `ChipBoundary` separat? | **Ja** — elektrische/logische Isolation ≠ räumliche Zugriffsbarriere |
| Was passiert mit `TrustBoundary.boundaryType: "physical"`? | Deprecated → stille Entfernung (bereits umgesetzt) |
| Threat-Generator Auswirkung? | Stark: 10+ neue auto-generierbare Physical-Threats |
| Visuelle Darstellung? | Marineblau `#1B4F8A`, long dash — in `DFD_1.json` + `DFD_2.json` |
| PEL-Skala | PEL0–PEL4, höher = exponierter, analog zu EL0–EL4 |
| Mobility-Dimension | `physicalMobility`: fixed / removable / portable / vehicle_mounted |
| Attack Surface Hints | `debugInterfaceAccessible`, `removableMediaAccessible` (BoundaryType-konditioniert) |

---

## 11. Offene Workstreams (nach diesem Commit)

### 11.1 Threat-Generator erweitern

Neue Threat-Klassen die aus PhysicalBoundary-Properties generiert werden müssen:

| Trigger | STRIDE | Threat-Template |
|---|---|---|
| `PEL3/4 + accessibility=public` | T, E | Unauthorized Physical Access |
| `PEL2/3/4 + physicalAccessControl=none` | S | Relay Attack / Badge Cloning |
| `PEL2/3/4 + monitoringType=none` | R | No Physical Audit Trail |
| `PEL2/3/4 + tamperProtection=none` | T | Cable Tampering / USB Insertion |
| `debugInterfaceAccessible=true` | E, I | Debug Port Attachment |
| `removableMediaAccessible=true` | I, D | Removable Media Insertion / Data Exfiltration |
| `physicalMobility=portable` | T | Evil-Maid Attack |
| `physicalMobility=portable + safetyRelevant=true` | T | Rogue Calibration / Safety Implant |
| `physicalMobility=removable` | T | Depot Attack / Hardware Swap |
| `physicalMobility=vehicle_mounted` | D | Vehicle Theft / Field Manipulation |
| `crossesPhysicalBoundary=true` auf DataFlow | T | Physical Wire Tap / Cable Manipulation |

### 11.2 Threat-Katalog erweitern

Neue Einträge in `element-templates.json` / `interaction-templates.json`:

- `PHY-001` Unauthorized Physical Access
- `PHY-002` Badge Relay Attack
- `PHY-003` No Physical Audit Trail (Repudiation)
- `PHY-004` Cable Tampering / Signal Injection
- `PHY-005` Debug Port Attachment (JTAG/SWD/UART)
- `PHY-006` Removable Media Attack
- `PHY-007` Evil-Maid Attack
- `PHY-008` Rogue Calibration Device (Safety)
- `PHY-009` Depot Attack / Hardware Swap
- `PHY-010` Device Substitution

### 11.3 Mitigations + Verifications

Pro Threat-Template: Standard-Mitigations und Verifications definieren.

Beispiel `PHY-005` (Debug Port Attachment):
- **Mitigation:** Debug-Interface in Produktion sperren (RDP2 / Fuse-blow / OTP)
- **Verification:** Produktionstest: JTAG-Zugang verifizieren dass er blockiert ist

### 11.4 Rückwärtsmapping Asset → PhysicalBoundary

`dfd-to-asset-mapper.ts` erweitern:
- Physical Asset innerhalb einer PhysicalBoundary → `located_in` Relation
- Infrastructure Asset innerhalb einer PhysicalBoundary → `secured_by` Relation
- `physicalExposureLevel` der PB → physisches Exposure des Assets ableiten
