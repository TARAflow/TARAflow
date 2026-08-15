# TARAflow — PhysicalBoundary: Threat Generator Spezifikation

**Status:** Spezifikation (bereit zur Implementierung)  
**Datum:** 2026-05-22  
**Betrifft:** Threat-Generator, Threat-Katalog, Mitigations, Verifications, Rückwärtsmapping  
**Voraussetzung:** PhysicalBoundary Foundation Commit (DFD-Modell, Form, Validator)

---

## 1. Architektur-Überblick

### Was der Threat-Generator heute macht

Der Generator arbeitet auf `DFDAnalysisContext` und iteriert über:
1. **Elemente** (`getElement`) — STRIDE-per-Element
2. **DataFlows** (`getDataFlows`) — STRIDE-per-Interaction
3. **TrustBoundaries** (`getTrustBoundaries`) — TB-spezifische Threats
4. **ChipBoundaries** (`getChipBoundaries`) — CB-spezifische Threats (NEU im letzten Commit)

### Was hinzukommt

**PhysicalBoundaries** (`getPhysicalBoundaries`) — zwei neue Threat-Quellen:

```
Quelle 1: PhysicalBoundary-Element selbst
  → Properties-basierte Threats (PEL, accessibility, mobility, tamper, monitoring)

Quelle 2: DataFlow der eine PhysicalBoundary kreuzt
  → crossesPhysicalBoundary = true
  → Interaction-Threats (Wire Tap, Cable Manipulation, Signal Injection)
```

---

## 2. Trigger-Matrix — Element-basierte Threats

Jede Zeile ist eine eigenständige Threat-Regel. Regeln werden **kombiniert** ausgewertet —
mehrere können für dasselbe Element feuern.

### 2.1 Exposition / Erreichbarkeit

| ID | Trigger | STRIDE | Threat-Name |
|---|---|---|---|
| `PHY-E01` | `PEL >= PEL3 AND accessibility = "public"` | T, E | **Unauthorized Physical Access — Public Device** |
| `PHY-E02` | `PEL >= PEL2 AND accessibility = "public"` | I | **Physical Observation / Shoulder Surfing** |
| `PHY-E03` | `PEL >= PEL3 AND physicalAccessControl = "none"` | E | **Uncontrolled Physical Access to Boundary** |
| `PHY-E04` | `PEL >= PEL2 AND physicalAccessControl = "badge"` | S | **Badge Relay Attack / Cloning** |

### 2.2 Monitoring / Audit Trail

| ID | Trigger | STRIDE | Threat-Name |
|---|---|---|---|
| `PHY-M01` | `monitoringType = "none" AND PEL >= PEL2` | R | **No Physical Audit Trail** |
| `PHY-M02` | `monitoringType = "camera"` | R | **Camera Footage Post-Hoc Only — No Active Response** |
| `PHY-M03` | `monitoringType = "guard_patrol"` | R | **Detection Gap Between Guard Patrols** |

### 2.3 Tamper-Schutz

| ID | Trigger | STRIDE | Threat-Name |
|---|---|---|---|
| `PHY-T01` | `tamperProtection = "none" AND PEL >= PEL2` | T | **Physical Tampering — No Evidence** |
| `PHY-T02` | `tamperProtection = "seal"` | T | **Tamper Seal Bypass — Evidence Removable** |
| `PHY-T03` | `tamperProtection = "none" AND debugInterfaceAccessible = true` | T, E | **Debug Port Physical Attachment** |
| `PHY-T04` | `tamperProtection = "none" AND removableMediaAccessible = true` | T, I, D | **Removable Media Insertion** |

### 2.4 Attack Surface Hints

| ID | Trigger | STRIDE | Threat-Name |
|---|---|---|---|
| `PHY-A01` | `debugInterfaceAccessible = true` | E, I | **Debug Interface Accessible Inside Boundary** |
| `PHY-A02` | `debugInterfaceAccessible = true AND tamperProtection = "none"` | E | **Firmware Readback / Write via Debug Port** |
| `PHY-A03` | `removableMediaAccessible = true` | I, D | **Removable Media Data Exfiltration** |
| `PHY-A04` | `removableMediaAccessible = true AND PEL >= PEL3` | T | **Malicious Firmware / Data via USB/SD** |

### 2.5 Mobilität (physicalMobility)

| ID | Trigger | STRIDE | Threat-Name |
|---|---|---|---|
| `PHY-MOB01` | `physicalMobility = "portable"` | T | **Evil-Maid Attack — Device Removed and Returned** |
| `PHY-MOB02` | `physicalMobility = "portable"` | T, E | **Offline Lab Analysis — Firmware Extraction** |
| `PHY-MOB03` | `physicalMobility = "portable" AND safetyRelevant = true` | T | **Rogue Calibration — Safety-Critical Data Manipulation** |
| `PHY-MOB04` | `physicalMobility = "portable" AND debugInterfaceAccessible = true` | E | **JTAG/SWD Lab Attack — Unlimited Time** |
| `PHY-MOB05` | `physicalMobility = "removable"` | T | **Depot Attack — Device Extracted for Manipulation** |
| `PHY-MOB06` | `physicalMobility = "removable"` | T | **Hardware Swap / Counterfeit Module** |
| `PHY-MOB07` | `physicalMobility = "vehicle_mounted"` | D | **Vehicle Theft — Complete Device Access** |
| `PHY-MOB08` | `physicalMobility = "vehicle_mounted"` | T | **Field Manipulation During Maintenance Window** |

### 2.6 Safety

| ID | Trigger | STRIDE | Threat-Name |
|---|---|---|---|
| `PHY-S01` | `safetyRelevant = true AND tamperProtection = "none"` | T | **Physical Attack on Safety-Critical Hardware** |
| `PHY-S02` | `safetyRelevant = true AND monitoringType = "none"` | R | **Undetected Manipulation of Safety Boundary** |

---

## 3. Trigger-Matrix — Interaction-basierte Threats

Für DataFlows mit `crossesPhysicalBoundary = true`:

| ID | Trigger | STRIDE | Threat-Name |
|---|---|---|---|
| `PHY-INT01` | `crossesPhysicalBoundary = true` | T | **Physical Wire Tampering / Signal Injection** |
| `PHY-INT02` | `crossesPhysicalBoundary = true AND df.protocol.group = "electrical"` | T | **Hardwired Signal Manipulation** |
| `PHY-INT03` | `crossesPhysicalBoundary = true AND df.isShieldedCable = false` | I | **Signal Eavesdropping — Unshielded Cable** |
| `PHY-INT04` | `terminatesAtPhysicalBoundary = true` | T | **Interface on Physical Boundary Edge — Direct Attack Surface** |

---

## 4. Threat-Katalog Einträge

Format orientiert sich an bestehenden `element-templates.json` / `interaction-templates.json`.  
Alle IDs haben Präfix `PHY-` für Physical Boundary Threats.

### PHY-E01: Unauthorized Physical Access — Public Device

```json
{
  "id": "PHY-E01",
  "stride": ["Tampering", "ElevationOfPrivilege"],
  "elementTypes": ["PhysicalBoundary"],
  "title": {
    "en": "Unauthorized Physical Access — Public Device",
    "de": "Unberechtigter physischer Zugang — öffentliches Gerät"
  },
  "description": {
    "en": "The device is directly physically accessible by any person in the vicinity (PEL3/PEL4, accessibility=public). An attacker can interact with external interfaces, attempt to open the enclosure, or perform hardware attacks without needing to bypass any access control.",
    "de": "Das Gerät ist direkt physisch zugänglich für jedermann in der Umgebung. Ein Angreifer kann mit externen Schnittstellen interagieren, versuchen das Gehäuse zu öffnen oder Hardware-Angriffe durchführen ohne eine Zugangskontrolle überwinden zu müssen."
  },
  "causeDescription": {
    "en": "Device deployed in public environment (airport, train station, street) without physical access barrier.",
    "de": "Gerät in öffentlicher Umgebung ohne physische Zugriffsbarriere betrieben."
  },
  "trigger": "PEL >= PEL3 AND accessibility = public",
  "mitigations": ["PHY-MIT-01", "PHY-MIT-02", "PHY-MIT-06"],
  "verifications": ["PHY-VER-01", "PHY-VER-02"]
}
```

### PHY-E04: Badge Relay Attack

```json
{
  "id": "PHY-E04",
  "stride": ["Spoofing"],
  "elementTypes": ["PhysicalBoundary"],
  "title": {
    "en": "Badge Relay Attack / Badge Cloning",
    "de": "Badge Relay Attack / Badge-Kloning"
  },
  "description": {
    "en": "RFID/NFC badges used for physical access control are vulnerable to relay attacks (Wiegand protocol) and cloning (older MIFARE Classic). An attacker in proximity to an authorized cardholder can capture and relay the badge signal to gain access without the cardholder's knowledge.",
    "de": "RFID/NFC-Badges sind anfällig für Relay-Attacks (Wiegand-Protokoll) und Kloning (ältere MIFARE Classic). Ein Angreifer in der Nähe eines autorisierten Karteninhabers kann das Badge-Signal abfangen und weiterleiten."
  },
  "causeDescription": {
    "en": "Single-factor badge access without second factor (PIN, biometric). Particularly relevant for PEL2+ boundaries with badge-only control.",
    "de": "Einzel-Faktor Badge-Zugang ohne zweiten Faktor. Besonders relevant für PEL2+ Boundaries mit Badge-only Kontrolle."
  },
  "trigger": "physicalAccessControl = badge AND PEL >= PEL2",
  "mitigations": ["PHY-MIT-03", "PHY-MIT-04"],
  "verifications": ["PHY-VER-03"]
}
```

### PHY-M01: No Physical Audit Trail

```json
{
  "id": "PHY-M01",
  "stride": ["Repudiation"],
  "elementTypes": ["PhysicalBoundary"],
  "title": {
    "en": "No Physical Audit Trail",
    "de": "Kein physischer Audit-Trail"
  },
  "description": {
    "en": "No monitoring is present at this physical boundary. An attacker who gains physical access can operate without detection — no evidence of presence, manipulation, or timing is recorded. Post-incident forensics are impossible.",
    "de": "Kein Monitoring an dieser physischen Boundary. Ein Angreifer mit physischem Zugang kann unbeobachtet agieren — keine Aufzeichnung von Anwesenheit, Manipulation oder Zeitpunkt. Post-Incident-Forensik ist unmöglich."
  },
  "trigger": "monitoringType = none AND PEL >= PEL2",
  "mitigations": ["PHY-MIT-05", "PHY-MIT-06"],
  "verifications": ["PHY-VER-04"]
}
```

### PHY-T01: Physical Tampering — No Evidence

```json
{
  "id": "PHY-T01",
  "stride": ["Tampering"],
  "elementTypes": ["PhysicalBoundary"],
  "title": {
    "en": "Physical Tampering — No Tamper Evidence",
    "de": "Physisches Tampering — kein Manipulationsnachweis"
  },
  "description": {
    "en": "No tamper protection is present. An attacker who opens the boundary leaves no evidence. Hardware implants can be installed, components can be replaced, and firmware can be modified without any detectable trace.",
    "de": "Kein Tamper-Schutz vorhanden. Ein Angreifer der die Boundary öffnet hinterlässt keine Spuren. Hardware-Implants können installiert, Komponenten ausgetauscht und Firmware modifiziert werden ohne nachweisbare Spuren."
  },
  "trigger": "tamperProtection = none AND PEL >= PEL2",
  "mitigations": ["PHY-MIT-07", "PHY-MIT-08"],
  "verifications": ["PHY-VER-05"]
}
```

### PHY-A01: Debug Interface Accessible

```json
{
  "id": "PHY-A01",
  "stride": ["ElevationOfPrivilege", "InformationDisclosure"],
  "elementTypes": ["PhysicalBoundary"],
  "title": {
    "en": "Debug Interface Physically Accessible Inside Boundary",
    "de": "Debug-Schnittstelle physisch zugänglich innerhalb der Boundary"
  },
  "description": {
    "en": "A debug or programming port (JTAG, SWD, UART) is physically accessible inside this boundary without further disassembly. An attacker who opens the boundary can directly attach a debugger, halt the CPU, read/write flash memory, and extract firmware or cryptographic keys.",
    "de": "Eine Debug- oder Programmier-Schnittstelle (JTAG, SWD, UART) ist innerhalb dieser Boundary ohne weitere Demontage zugänglich. Ein Angreifer der die Boundary öffnet kann direkt einen Debugger anschliessen, die CPU anhalten, Flash lesen/schreiben und Firmware oder kryptografische Keys extrahieren."
  },
  "trigger": "debugInterfaceAccessible = true",
  "mitigations": ["PHY-MIT-09", "PHY-MIT-10"],
  "verifications": ["PHY-VER-06", "PHY-VER-07"]
}
```

### PHY-MOB01: Evil-Maid Attack

```json
{
  "id": "PHY-MOB01",
  "stride": ["Tampering"],
  "elementTypes": ["PhysicalBoundary"],
  "title": {
    "en": "Evil-Maid Attack — Device Removed, Manipulated and Returned",
    "de": "Evil-Maid Attack — Gerät entwendet, manipuliert und zurückgebracht"
  },
  "description": {
    "en": "A portable device can be physically removed from its operational environment by an attacker. The attacker has unlimited time and access to lab equipment — debuggers, fault injection, side-channel analysis, chip-off. After manipulation, the device is returned to service appearing legitimate. The device re-enters the trust chain without detection.",
    "de": "Ein tragbares Gerät kann von einem Angreifer aus seiner Betriebsumgebung entfernt werden. Der Angreifer hat unbegrenzte Zeit und Zugang zu Laborausrüstung — Debugger, Fault Injection, Seitenkanal-Analyse, Chip-Off. Nach der Manipulation wird das Gerät scheinbar legitim wieder in Betrieb genommen. Das Gerät kehrt ohne Erkennung in die Trust Chain zurück."
  },
  "causeDescription": {
    "en": "Device is portable — can be carried offsite. No tamper evidence that survives the return trip.",
    "de": "Gerät ist tragbar — kann ausser Haus gebracht werden. Kein Tamper-Nachweis der die Rückkehr übersteht."
  },
  "trigger": "physicalMobility = portable",
  "mitigations": ["PHY-MIT-11", "PHY-MIT-07", "PHY-MIT-12"],
  "verifications": ["PHY-VER-05", "PHY-VER-08"]
}
```

### PHY-MOB03: Rogue Calibration Device

```json
{
  "id": "PHY-MOB03",
  "stride": ["Tampering"],
  "elementTypes": ["PhysicalBoundary"],
  "title": {
    "en": "Rogue Calibration — Safety-Critical Measurement Manipulation",
    "de": "Manipuliertes Kalibriergerät — sicherheitsrelevante Messtäuschung"
  },
  "description": {
    "en": "A portable device that performs safety-relevant measurements or calibration can be manipulated while offsite. The manipulated device systematically delivers false reference values while appearing to function correctly. Safety-critical systems calibrated against this device develop systematic measurement errors that may only manifest under specific operational conditions, potentially leading to safety function failure.",
    "de": "Ein tragbares Gerät das sicherheitsrelevante Messungen oder Kalibrierungen durchführt kann im Labor manipuliert werden. Das manipulierte Gerät liefert systematisch falsche Referenzwerte während es korrekt zu funktionieren scheint. Sicherheitskritische Systeme die damit kalibriert werden entwickeln systematische Messfehler die erst unter bestimmten Betriebsbedingungen sichtbar werden und zum Ausfall von Sicherheitsfunktionen führen können."
  },
  "causeDescription": {
    "en": "Portable device (physicalMobility=portable) with safetyRelevant=true. No tamper evidence, no calibration chain verification.",
    "de": "Tragbares Gerät (physicalMobility=portable) mit safetyRelevant=true. Kein Tamper-Nachweis, keine Kalibrierkettenprüfung."
  },
  "trigger": "physicalMobility = portable AND safetyRelevant = true",
  "relevance": "critical",
  "mitigations": ["PHY-MIT-11", "PHY-MIT-13", "PHY-MIT-07"],
  "verifications": ["PHY-VER-09", "PHY-VER-05", "PHY-VER-08"]
}
```

### PHY-MOB05: Depot Attack

```json
{
  "id": "PHY-MOB05",
  "stride": ["Tampering"],
  "elementTypes": ["PhysicalBoundary"],
  "title": {
    "en": "Depot Attack — Device Extracted for Offline Manipulation",
    "de": "Depot Attack — Gerät ausgebaut und offline manipuliert"
  },
  "description": {
    "en": "A removable device (DIN-Rail module, plug-in card, field controller) can be extracted from its installation with some effort. During maintenance windows or via insider access, the device is removed, manipulated in a workshop, and reinstalled. Unlike Evil-Maid (portable), depot attack requires deliberate extraction effort and is typically an insider or supply-chain threat.",
    "de": "Ein ausbaubares Gerät (DIN-Rail-Modul, Steckkarte, Feldcontroller) kann mit etwas Aufwand aus seiner Installation entfernt werden. Während Wartungsfenstern oder durch Insider-Zugang wird das Gerät entnommen, in einer Werkstatt manipuliert und wieder eingebaut. Im Unterschied zum Evil-Maid Angriff erfordert der Depot Attack bewussten Extraktionsaufwand."
  },
  "trigger": "physicalMobility = removable",
  "mitigations": ["PHY-MIT-12", "PHY-MIT-07", "PHY-MIT-14"],
  "verifications": ["PHY-VER-05", "PHY-VER-10"]
}
```

### PHY-INT01: Physical Wire Tampering

```json
{
  "id": "PHY-INT01",
  "stride": ["Tampering"],
  "elementTypes": ["DataFlow"],
  "interactionTrigger": "crossesPhysicalBoundary = true",
  "title": {
    "en": "Physical Wire Tampering / Signal Injection",
    "de": "Physisches Kabel-Tampering / Signaleinspeisung"
  },
  "description": {
    "en": "A DataFlow that crosses a PhysicalBoundary traverses a physical cable or connector that is accessible to an attacker with physical access. The attacker can cut the cable, splice a tap device, inject signals, or replace connectors to manipulate data in transit.",
    "de": "Ein DataFlow der eine PhysicalBoundary kreuzt verläuft durch ein physisches Kabel oder einen Stecker der für einen Angreifer mit physischem Zugang zugänglich ist. Der Angreifer kann das Kabel durchtrennen, ein Abgriffgerät einschleifen, Signale einspeisen oder Stecker ersetzen."
  },
  "trigger": "crossesPhysicalBoundary = true",
  "mitigations": ["PHY-MIT-15", "PHY-MIT-16"],
  "verifications": ["PHY-VER-11"]
}
```

---

## 5. Mitigations-Katalog

| ID | Titel EN | Titel DE | Applicable Threats |
|---|---|---|---|
| `PHY-MIT-01` | Anti-tamper enclosure design | Manipulationsresistentes Gehäusedesign | PHY-E01, PHY-T01 |
| `PHY-MIT-02` | Security camera coverage at device location | Kameraüberwachung am Gerätestandort | PHY-E01, PHY-M01 |
| `PHY-MIT-03` | Multi-factor physical access (badge + PIN) | Mehrstufige physische Zugangskontrolle (Badge + PIN) | PHY-E04 |
| `PHY-MIT-04` | High-security RFID (MIFARE DESFire, LEGIC) | Hochsicherheits-RFID (MIFARE DESFire, LEGIC) | PHY-E04 |
| `PHY-MIT-05` | Physical access logging / audit trail | Physisches Zugangsprotokoll / Audit-Trail | PHY-M01, PHY-S02 |
| `PHY-MIT-06` | Security Operations Centre (SOC) alarm routing | SOC-Alarmweiterleitung | PHY-M01, PHY-M02 |
| `PHY-MIT-07` | Tamper-evident seal on all enclosure screws | Tamper-evidentes Siegel auf allen Gehäuseschrauben | PHY-T01, PHY-MOB01, PHY-MOB05 |
| `PHY-MIT-08` | Active tamper detection (mesh / switch + zeroize) | Aktive Tamper-Erkennung (Mesh / Schalter + Zeroize) | PHY-T01 |
| `PHY-MIT-09` | Debug interface locked / disabled in production (OTP/fuse) | Debug-Schnittstelle in Produktion gesperrt (OTP/Fuse) | PHY-A01, PHY-A02 |
| `PHY-MIT-10` | Debug port physically removed or potted | Debug-Port physisch entfernt oder vergossen | PHY-A01 |
| `PHY-MIT-11` | Device tracking / asset management (GPS, NFC tag) | Geräteverfolgung / Asset Management (GPS, NFC-Tag) | PHY-MOB01, PHY-MOB03 |
| `PHY-MIT-12` | Pre/post-maintenance tamper seal inspection procedure | Tamper-Siegel-Inspektionsverfahren vor/nach Wartung | PHY-MOB01, PHY-MOB05 |
| `PHY-MIT-13` | Calibration chain integrity verification (certificate + hash) | Kalibrierkettenintegrität (Zertifikat + Hash) | PHY-MOB03 |
| `PHY-MIT-14` | Signed firmware with boot-time attestation | Signierte Firmware mit Boot-Zeit-Attestierung | PHY-MOB05, PHY-MOB06 |
| `PHY-MIT-15` | Shielded / armoured cable for physical boundary crossings | Abgeschirmtes / gepanzertes Kabel für PB-Querungen | PHY-INT01, PHY-INT03 |
| `PHY-MIT-16` | Cable routing inside secured conduit / trunking | Kabelführung in gesichertem Kabelkanal | PHY-INT01, PHY-INT02 |

---

## 6. Verifications-Katalog

| ID | Titel EN | Titel DE | Type |
|---|---|---|---|
| `PHY-VER-01` | Physical penetration test — enclosure opening attempt | Physischer Penetrationstest — Gehäuseöffnungsversuch | Test |
| `PHY-VER-02` | Photographic evidence of deployed security measures | Fotodokumentation der implementierten Sicherheitsmassnahmen | Inspection |
| `PHY-VER-03` | Badge relay attack test (Proxmark or equivalent) | Badge Relay Attack Test (Proxmark oder äquivalent) | Test |
| `PHY-VER-04` | Access log review — verify monitoring coverage | Zugriffsprotokoll-Review — Monitoring-Abdeckung verifizieren | Review |
| `PHY-VER-05` | Tamper seal integrity inspection — photographic evidence | Tamper-Siegel-Integritätsprüfung — Fotodokumentation | Inspection |
| `PHY-VER-06` | JTAG/SWD lock verification — probe attachment refused | JTAG/SWD Sperr-Verifikation — Probe-Anschluss verweigert | Test |
| `PHY-VER-07` | Debug port readback test — firmware extraction attempt | Debug-Port Readback-Test — Firmware-Extraktionsversuch | Test |
| `PHY-VER-08` | Device identity verification after maintenance return | Geräteidentitätsverifikation nach Wartungsrückkehr | Procedure |
| `PHY-VER-09` | Calibration certificate chain validation | Kalibrierzertifikatsketten-Validierung | Review |
| `PHY-VER-10` | Module serial number verification before/after maintenance | Modulseriennummer-Verifikation vor/nach Wartung | Procedure |
| `PHY-VER-11` | Cable integrity inspection — splice detection | Kabelintegritätsprüfung — Einschleif-Erkennung | Inspection |

---

## 7. Rückwärtsmapping: Asset → PhysicalBoundary

### 7.1 Erweiterung `dfd-to-asset-mapper.ts`

Wenn ein Asset geometrisch innerhalb einer PhysicalBoundary liegt, werden automatisch
folgende Relationen abgeleitet (analog zu bestehender TB-Membership-Logik):

```typescript
// Pseudocode für dfd-to-asset-mapper.ts Erweiterung
for (const asset of assets) {
  const containingPBs = elementPhysicalBoundaries.get(asset.linkedElementId) ?? [];

  for (const pbId of containingPBs) {
    const pb = elementsById.get(pbId);
    const pbProps = pb.properties as PhysicalBoundaryProperties;

    // Physical Asset → located_in PhysicalBoundary
    if (asset.category === "Physical") {
      addRelation(asset.id, pbId, "located_in");
    }

    // Infrastructure Asset → secured_by PhysicalBoundary
    if (asset.category === "Infrastructure") {
      addRelation(asset.id, pbId, "secured_by");
    }

    // Derive physical exposure from PB
    if (pbProps.physicalExposureLevel) {
      asset.derivedPhysicalExposure = pbProps.physicalExposureLevel;
    }

    // Safety flag propagation
    if (pbProps.safetyRelevant && !asset.isHighValueAsset) {
      asset.derivedSafetyRelevant = true;
    }
  }
}
```

### 7.2 Neue Asset-Relationstypen für PhysicalBoundary

Ergänzung in `asset-constants.ts` (bereits vorbereitet mit leeren Arrays):

```typescript
// ALLOWED_INFRA_RELATIONS — Infrastructure Asset ↔ PhysicalBoundary
PhysicalBoundary: ["is_an", "secures", "powers"]

// ALLOWED_PHYSICAL_RELATIONS — Physical Asset ↔ PhysicalBoundary
PhysicalBoundary: ["is_an", "secures", "accesses", "damages"]

// ALLOWED_SYSTEM_RELATIONS — System Asset ↔ PhysicalBoundary
PhysicalBoundary: ["is_an", "depends_on"]
```

---

## 8. Implementierungs-Reihenfolge

```
1. Katalog-Dateien anlegen
   ├── element-templates.json   → PHY-E01..S02 (Element-Threats)
   └── interaction-templates.json → PHY-INT01..04 (DataFlow-Threats)

2. Threat-Generator erweitern
   ├── getPhysicalBoundaries() iterieren
   ├── Trigger-Regeln aus §2 auswerten
   ├── crossesPhysicalBoundary-Flows aus getDataFlows() filtern
   └── Interaction-Threats aus §3 generieren

3. Mitigations + Verifications anlegen
   ├── mitigations.json   → PHY-MIT-01..16
   └── verifications.json → PHY-VER-01..11

4. i18n Keys ergänzen
   ├── threats/en.json + de.json → Titel, Beschreibung, causeDescription
   ├── mitigations/en.json + de.json
   └── verifications/en.json + de.json

5. Rückwärtsmapping
   └── dfd-to-asset-mapper.ts → §7.1 Erweiterung

6. Tests
   ├── Billetautomat-Szenario: PEL4 + public → PHY-E01 ✓
   ├── Kalibriergerät-Szenario: portable + safetyRelevant → PHY-MOB03 ✓
   └── Schaltschrank badge-only: PEL2 + badge → PHY-E04 ✓
```

---

## 9. Offene Designentscheidungen

### 9.1 `sealed` in `accessibility`

Aktuell noch als Option vorhanden (backward compat). Sobald Migration vollständig:
- `sealed` aus `accessibility` entfernen
- Validator: `accessibility=sealed` → Warning "use PEL0 + tamperProtection instead"

### 9.2 Ableitung von `derivedPhysicalExposure` auf Assets

Noch nicht implementiert. Sobald Rückwärtsmapping aktiv:
- Asset erhält `derivedPhysicalExposure?: PhysicalExposureLevel` 
- Wird im Asset-Dialog als readonly angezeigt (analog zu `derivedSafetyRelevant`)

### 9.3 Threat-Feasibility-Scoring aus PEL

Für spätere Risk-Scoring-Erweiterung:
```
physical_attack_feasibility = f(PEL, accessibility, physicalMobility, tamperProtection, monitoringType)

Beispiel:
  PEL4 + public + portable + none + none → feasibility = HIGH
  PEL2 + guarded + fixed + active_detection + soc → feasibility = LOW
```
