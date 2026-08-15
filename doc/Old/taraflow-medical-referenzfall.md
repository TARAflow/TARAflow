# TARAflow Referenzfall: Vernetztes Infusionspumpensystem

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>

> **Zweck dieses Dokuments:** Demonstration der TARAflow-Methodik für ein Medizinprodukt. Der
> Referenzfall zeigt die Stärken des graphbasierten Ansatzes – insbesondere die Integration von
> Safety und Security sowie die vollständige Rückverfolgbarkeit von der Systemmodellierung bis
> zur Risikobewertung. Er erfüllt die Anforderungen der MDR und des EU Cyber Resilience Act.

---

## 0. Einführung: Warum TARAflow für Medical Devices?

### Das Problem klassischer Methoden

Klassische Threat-Modeling-Ansätze analysieren Elemente, nicht Auswirkungen. In der Medizintechnik
führt das zu einer gefährlichen Lücke: Ein "Tampering" an einer Konfigurationsdatei ist kein
abstraktes Integritätsproblem – bei einer Infusionspumpe ist es eine potenzielle Überdosierung.

Klassisch:
```
Pumpensteuerung → Tampering (möglich)
                → Denial of Service (möglich)
```
Kein Patientenbezug, keine Priorisierung, kein klinischer Kontext. Jedes Element generiert
dieselbe STRIDE-Liste – unabhängig davon ob es sicherheitskritisch ist oder nicht.

### Der TARAflow-Ansatz

TARAflow dreht die Logik um: Assets und ihr klinischer Impact steuern die Analyse.

```
TARAflow Medical:
DFD-Element → Asset → Klinischer Impact + CIANAAA-Schutzziele → STRIDE → Risk
              ↑
              Was gefährdet den Patienten? (Asset-Kategorie)
              Wie schwer ist der Schaden? (Severity nach ISO 14971)
              Welches Schutzziel verletzt die Therapie? (C/I/A/N/A/A/A)
```

### Drei konkrete Gewinne gegenüber klassischen Methoden

1. **Vollständige Rückverfolgbarkeit** – Jede Massnahme ist bis zum Asset, zur
   Schutzziel-Verletzung und zur regulatorischen Anforderung zurückverfolgbar. Das ist eine
   Anforderung nach IEC 81001-5-1 und MDR Anhang I.

2. **Safety + Security in einem Modell** – Safety-Konsequenzen (Patientengefährdung) werden
   direkt aus dem Security-Modell abgeleitet, ohne separates Safety-Dokument, ohne Doppelpflege.

3. **Fokus durch risikoorientierte Priorisierung** – Asset-Kritikalität steuert die STRIDE-Tiefe
   proportional zum klinischen Schaden. Das reduziert Analyseaufwand ohne Vollständigkeit zu
   opfern.

### Positionierung

TARAflow richtet sich an Hersteller die eine normkonforme TARA mit Nachweispflicht nach
IEC 81001-5-1, ISO 14971, MDR Anhang I oder dem EU Cyber Resilience Act durchführen müssen.

---

## 1. Systemkontext

Ein vernetztes Infusionspumpensystem besteht aus der physischen Pumpe mit eingebetteter Firmware,
einer Dockingstation zur Netzwerkanbindung, einem zentralen Medikamentendatenbank-Service
(Drug Library) sowie einem Krankenhausinformationssystem (HIS/EMR). Das System hat direkte
Patientenrelevanz, da fehlerhafte Medikamentengaben zu schwerer Verletzung oder Tod führen können.

**Systemgrenze:** Das Produkt/System unter Analyse umfasst Pumpen-Firmware, Drug-Library-Service,
Kommunikationsmodul und alle Schnittstellen nach aussen.

**Regulatorischer Kontext:** MDR (EU) 2017/745, ISO 14971 (Risikomanagement),
IEC 81001-5-1 (Security for Health Software), EU Cyber Resilience Act.

---

## 2. DFD-Modellierung

### 2.1 Elemente

**External Entities:**
- `○ Patient` – Empfänger der Therapie (primäres Schutzobjekt)
- `○ Pflegepersonal` – Bedienung vor Ort, Medikationsstart, Parametereinstellung
- `○ Klinik-IT (HIS/EMR)` – Zentrales System für Patientendaten und Drug-Library-Updates
- `○ Wartungstechniker` – Kalibrierung, Firmware-Updates, technischer Service

**Processes:**
- `□ Pumpensteuerung` – Präzisionsregelung des Motors, Flussratenausführung
- `□ Drug-Library-Service` – Validierung von Parametern gegen Sicherheitsgrenzwerte (DERS)
- `□ Alarm-Manager` – Überwachung auf Okklusion, Luft, Akku-Zustand, Grenzwert-Verletzung
- `□ Kommunikationsmodul` – Datenaustausch via Klinik-WLAN und Bluetooth

**Data Stores:**
- `🗄 Drug Library (lokal)` – Lokale Kopie der Medikamenten-Grenzwerte (DERS)
- `🗄 Therapie-Profil` – Aktuell eingestellte Parameter für den Patienten
- `🗄 Audit-Log` – Revisionssichere Aufzeichnung aller Bedienvorgänge
- `🗄 Firmware-Speicher` – Gespeicherte Firmware-Images und Konfiguration

**Data Flows (nach TARAflow Naming-Konvention):**
- `→ send BolusCommand [cmd]` – Pflegepersonal/HIS → Pumpensteuerung
- `→ update DrugLibrary [req]` – Klinik-IT → Drug Library (lokal)
- `→ recv DrugLibrary [resp]` – Drug Library → Drug-Library-Service
- `→ stream VitalData [stream]` – Pumpensteuerung → Monitoring-Zentrale
- `→ send Alarm [event]` – Alarm-Manager → Schwesternruf
- `→ send FirmwareUpdate [req]` – Wartungstechniker → Firmware-Speicher
- `→ send DiagData [resp]` – Pumpensteuerung → Wartungstechniker

**Trust Boundaries:**
- `─ Klinik-Netzwerk-Grenze` – Externe Netzwerkgrenze (WLAN/Internet)
- `─ Gerät-Grenze` – Zwischen Klinik-IT und Pumpen-intern
- `─ Safety-Grenze` – Zwischen Drug-Library-Service und Pumpensteuerung
- `─ Physischer Zugang` – Wartungsschnittstellen (USB, Service-Port)

---

## 3. Asset-Modellierung und Beziehungen

TARAflow verwendet fünf Asset-Kategorien die gemeinsam alle schützenswerten Güter eines Systems
abdecken. Die Beziehungen zwischen DFD-Elementen und Assets sind typisiert. Sie beschreiben
präzise wie ein Element ein Asset berührt. Das ist die Grundlage für die assetbasierte
STRIDE-Analyse.

**Safety Annotation Layer:** Safety-Aspekte werden als optionaler Annotation Layer auf
bestehenden Beziehungen modelliert – nicht als separates Safety-Modell. Wird an einer Beziehung
eine SafetyAnnotation gesetzt (`relevance: 'direct'`, `impact: 'fatality'`), signalisiert der
Analyst dass dieses Asset über diese Beziehung direkt safety-relevant ist. Die Annotation ist
der primäre Trigger für den Safety Impact im Asset-Tab. Der Safety Impact am Asset kann
abgeleitet (`derived`) oder manuell (`manual`) gesetzt werden – bei manueller Setzung ist eine
Begründung (`rationale`) Pflicht.

### 3.1 Data Assets

Identifizierte Data Assets: Medikamenten-Grenzwerte, Flussrate, Patienten-ID,
Alarm-Schwellen, Firmware-Image, Audit-Daten, Therapie-Parameter.

**Beziehungen:**
```
DataStore "Drug Library (lokal)"
└─ stores → Data Asset "Medikamenten-Grenzwerte"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Falsche Grenzwerte → toxische Überdosierung möglich' }

DataStore "Therapie-Profil"
├─ stores → Data Asset "Flussrate"
│  └─ safety: { relevance: 'direct', impact: 'fatality',
│               rationale: 'Falsche Flussrate → Über-/Unterdosierung' }
└─ stores → Data Asset "Therapie-Parameter"
   └─ safety: { relevance: 'direct', impact: 'irreversible_injury' }

DataStore "Audit-Log"
└─ stores → Data Asset "Audit-Daten"

DataStore "Firmware-Speicher"
└─ stores → Data Asset "Firmware-Image"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Kompromittierte Firmware → vollständige Systemkontrolle' }

Process "Pumpensteuerung"
├─ reads   → Data Asset "Flussrate"
└─ reads   → Data Asset "Therapie-Parameter"

Process "Drug-Library-Service"
└─ reads   → Data Asset "Medikamenten-Grenzwerte"

Process "Alarm-Manager"
├─ reads   → Data Asset "Alarm-Schwellen"
└─ creates → Data Asset "Audit-Daten"

DF "send BolusCommand [cmd]"
└─ transports → Data Asset "Flussrate"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Manipulation ermöglicht lebensgefährliche Bolusgabe' }

DF "update DrugLibrary [req]"
└─ transports → Data Asset "Medikamenten-Grenzwerte"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Kompromittiertes Update → falsche Sicherheitsgrenzwerte' }

DF "send FirmwareUpdate [req]"
└─ transports → Data Asset "Firmware-Image"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Manipuliertes Firmware-Update → vollständige Gerätekontrolle' }
```

### 3.2 Process Assets

Identifizierte Process Assets: Infusionsprozess, DERS-Validierung, Alarm-Prozess,
Firmware-Update-Prozess.

**Beziehungen:**
```
Process "Pumpensteuerung"
└─ is_an → Process Asset "Infusionsprozess"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                physicalHazardPotential: 'high' }

Process "Drug-Library-Service"
└─ is_an → Process Asset "DERS-Validierung"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'DERS ist letzte Sicherheitsinstanz vor Ausführung' }

Process "Alarm-Manager"
└─ is_an → Process Asset "Alarm-Prozess"
   └─ safety: { relevance: 'direct', impact: 'irreversible_injury',
                rationale: 'Ausfall → keine Warnung bei kritischem Zustand' }

EE "Pflegepersonal"
└─ invokes → Process Asset "Infusionsprozess"

EE "Wartungstechniker"
└─ invokes → Process Asset "Firmware-Update-Prozess"
```

### 3.3 System Assets

Identifizierte System Assets: Infusionspumpe, Drug-Library-Server, Monitoring-System,
Klinik-Netzwerk.

**Beziehungen:**
```
Process "Pumpensteuerung"
└─ is_an → System Asset "Infusionspumpe"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                physicalHazardPotential: 'high' }

Process "Drug-Library-Service"
├─ depends_on → System Asset "Drug-Library-Server"
└─ uses [network] → System Asset "Klinik-Netzwerk"

Process "Alarm-Manager"
└─ uses [network] → System Asset "Monitoring-System"

Process "Kommunikationsmodul"
└─ uses [network] → System Asset "Klinik-Netzwerk"

EE "Wartungstechniker"
└─ uses [local] → System Asset "Infusionspumpe"

EE "Klinik-IT (HIS/EMR)"
└─ uses [network] → System Asset "Drug-Library-Server"
```

### 3.4 Infrastructure Assets

Identifizierte Infrastructure Assets: Pumpen-Gehäuse, WLAN-Modul, Bluetooth-Modul,
Service-Port (USB).

**Beziehungen:**
```
EE "Wartungstechniker"
└─ accesses [local] → Infrastructure Asset "Service-Port (USB)"
   └─ safety: { relevance: 'indirect',
                rationale: 'Direktzugang zur Firmware ohne Netzwerkauthentifizierung' }

Process "Kommunikationsmodul"
├─ is_an → Infrastructure Asset "WLAN-Modul"
└─ is_an → Infrastructure Asset "Bluetooth-Modul"

Process "Pumpensteuerung"
└─ is_an → Infrastructure Asset "Pumpen-Gehäuse"
```

### 3.5 Human Assets

Identifizierte Human Assets: Patient, Pflegepersonal, Wartungstechniker.

**Beziehungen:**
```
EE "Patient"
└─ is_an → Human Asset "Patient"
   └─ Properties: { isProtectionTarget: true, safetyImpact: 'fatality',
                    rationale: 'Direkte Abhängigkeit von korrekter Medikamentenzufuhr' }

Process "Pumpensteuerung"
└─ affects_safety → Human Asset "Patient"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Unkontrollierte Flussrate → Über-/Unterdosierung' }

Process "Alarm-Manager"
└─ affects_safety → Human Asset "Patient"
   └─ safety: { relevance: 'direct', impact: 'irreversible_injury',
                rationale: 'Ausfall Alarmierung → verzögerte Intervention' }

Process "Drug-Library-Service"
└─ affects_safety → Human Asset "Patient"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Falsche DERS-Validierung → Grenzwerte nicht eingehalten' }

EE "Wartungstechniker"
└─ exposes → Human Asset "Patient"
   └─ rationale: 'Kompromittierter Service-Zugang ermöglicht Manipulation der Pumpe'
```

---

## 4. Asset Impact- und Schutzziel-Bewertung

Erst nachdem die Beziehungen im Graphen festgelegt sind, wird bewertet was jedes Asset
schützenswert macht und warum. Die Safety-Relevanz ergibt sich direkt aus den Beziehungen.

### 4.0 Formale Aggregationslogik

Die aggregierte Asset-Kritikalität ergibt sich aus zwei unabhängigen Domänen:

| Domäne | Kriterien |
|---|---|
| **Business / Organisatorisch** | Financial Damage, Regulatory/Compliance (MDR/FDA), Reputation, Operational Impact, Affected Users, Recoverability |
| **Physical / Safety** | **Safety** (Patientengefährdung), Physical Asset Damage, Environmental Impact |

**Aggregationsmatrix:**

| Business Impact | Safety Impact (physicalImpact) | Aggregiert |
|---|---|---|
| beliebig | HIGH (fatality / irreversible_injury) | CRITICAL |
| CRITICAL | – oder MED | CRITICAL |
| HIGH | MED (indirect, Hop 1) | CRITICAL |
| HIGH | – | HIGH |
| MEDIUM | MED (indirect, Hop 1) | HIGH |
| MEDIUM | – | MEDIUM |
| LOW | MED (indirect, Hop 1) | MEDIUM |
| LOW | – | LOW |

**Safety Override Rule (ISO 14971 / MDR):**
```
IF safetyImpact ∈ { 'fatality', 'irreversible_injury' }
THEN aggregatedCriticality := CRITICAL
     strideDepth            := 'vertieft'
     riskPriority           := 1
```
Diese Regel ist methodisch verbindlich. Sie implementiert das ISO 14971 Prinzip: Patientensicherheit
ist kein verrechenbarer Faktor.

### 4.0a Safety Impact als abgeleitetes Feld (Derived/Manual Pattern)

```
SafetyAnnotation auf Beziehung             →  physicalImpact am Asset
───────────────────────────────────────────────────────────────────────
impact: 'fatality'                         →  HIGH  (derived)
impact: 'irreversible_injury'              →  HIGH  (derived)
relevance: 'indirect' (transitiv, Hop 1)   →  MED   (derived)
keine Annotation                           →  LOW   (derived, default)
```

Jedes Safety-Feld hat ein Herkunfts-Attribut:
- `physicalImpactSource: "derived"` → keine zusätzliche Dokumentationspflicht
- `physicalImpactSource: "manual"` → Rationale wird verbatim im Audit-Report dokumentiert

### 4.1 Begriffliche Präzisierung der CIANAAA-Schutzziele

In TARAflow werden Non-Repudiation und Accountability bewusst unterschieden:

- **Non-Repudiation** – technische Nicht-Abstreitbarkeit einer Handlung (STRIDE R).
  Typische Massnahmen: Audit-Log, digitale Signatur.
- **Accountability** – rechtliche und organisatorische Verantwortlichkeit, insbesondere bei
  Patientendaten (MDR Anhang I, DSGVO Art. 5 Abs. 2).

### 4.2 Schutzziel-Ableitung aus Beziehungstyp (Auszug Medical)

| Beziehungstyp | Primäre Schutzziele | Medical-Kontext |
|---|---|---|
| `stores` | Integrity, Availability | Drug Library: Verfügbarkeit bei Therapiestart |
| `transports` | Integrity, Confidentiality, Authentication | Bolus-Befehle: Herkunft verifizierbar |
| `affects_safety` | Availability, Integrity | Pumpensteuerung: darf nicht ausfallen |
| `is_an` (Process) | Integrity, Availability | DERS-Validierung: Single Point of Safety |
| `accesses [local]` | Authorization, Non-Repudiation | Service-Port: wer hat zugegriffen? |
| `exposes` | Confidentiality, Authentication, Accountability | Wartungszugang: Patientendaten-Exposure |

### 4.3 Data Assets

> **Lesehilfe Safety Impact (physicalImpact):** Primär aus der SafetyAnnotation im DFD-Tab
> abgeleitet (`derived`). Bei manuell gesetzten Werten (`manual`) ist eine Rationale im Modell
> hinterlegt. HIGH = `fatality` oder `irreversible_injury`, MED = `indirect` (Hop 1),
> – = keine Annotation.

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Aggregiert |
|---|---|---|---|---|
| Medikamenten-Grenzwerte | Integrity, Availability, Authorization | HIGH (Regulatory) | HIGH (fatality) | **CRITICAL** |
| Flussrate | Integrity, Availability | HIGH (Operational) | HIGH (fatality) | **CRITICAL** |
| Therapie-Parameter | Integrity, Availability, Authorization | HIGH (Operational) | HIGH (irreversible_injury) | **CRITICAL** |
| Firmware-Image | Integrity, Availability, Authentication | HIGH (Operational) | HIGH (fatality) | **CRITICAL** |
| Alarm-Schwellen | Integrity, Availability | HIGH (Operational) | HIGH (irreversible_injury) | **CRITICAL** |
| Patienten-ID | Confidentiality, Integrity, Accountability | MEDIUM (Privacy/MDR) | MED (indirect) | **HIGH** |
| Audit-Daten | Integrity, Non-Repudiation, Accountability | MEDIUM (Regulatory) | – | **MEDIUM** |

### 4.4 Process Assets

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Aggregiert |
|---|---|---|---|---|
| Infusionsprozess | Availability, Integrity, Authorization | HIGH (Operational) | HIGH (fatality) | **CRITICAL** |
| DERS-Validierung | Integrity, Availability | HIGH (Regulatory) | HIGH (fatality) | **CRITICAL** |
| Alarm-Prozess | Availability, Integrity | HIGH (Operational) | HIGH (irreversible_injury) | **CRITICAL** |
| Firmware-Update-Prozess | Integrity, Authorization, Non-Repudiation | HIGH (Operational) | HIGH (fatality) | **CRITICAL** |

### 4.5 System Assets

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Aggregiert |
|---|---|---|---|---|
| Infusionspumpe | Availability, Integrity, Authorization | HIGH (Operational) | HIGH (fatality) | **CRITICAL** |
| Drug-Library-Server | Availability, Integrity | HIGH (Operational) | HIGH (fatality) | **CRITICAL** |
| Monitoring-System | Availability | HIGH (Operational) | MED (indirect) | **CRITICAL** |
| Klinik-Netzwerk | Availability, Authentication | HIGH (Operational) | MED (indirect) | **CRITICAL** |

### 4.6 Infrastructure Assets

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Aggregiert |
|---|---|---|---|---|
| WLAN-Modul | Availability, Authentication | HIGH (Operational) | MED (indirect) | **CRITICAL** |
| Bluetooth-Modul | Availability, Authentication | MEDIUM (Operational) | MED (indirect) | **HIGH** |
| Service-Port (USB) | Authorization, Non-Repudiation | MEDIUM (Operational) | MED (indirect) | **HIGH** |
| Pumpen-Gehäuse | Integrity, Availability | LOW | – | **LOW** |

### 4.7 Human Assets

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Protection Target | Aggregiert |
|---|---|---|---|---|---|
| Patient | Availability (Safety) | – | HIGH (fatality) | ✅ | **CRITICAL** |
| Pflegepersonal | Availability (Safety), Confidentiality | MEDIUM (Privacy) | HIGH (irreversible_injury) | ✅ | **CRITICAL** |
| Wartungstechniker | Confidentiality, Authorization | MEDIUM (Privacy) | MED (indirect) | – | **HIGH** |

### 4.8 Ergebnis der Bewertung

Von 20 identifizierten Assets sind 14 als CRITICAL eingestuft – ausnahmslos wegen Safety Impact.
Das zeigt: Patientensicherheit ist der dominierende Treiber der Risikopriorisierung.

Der Patient als Protection Target ist der Endpunkt aller Safety-Ketten. Seine Kritikalität ergibt
sich aus den `affects_safety`- und `exposes`-Beziehungen im Graphen – nicht aus einer manuellen
Einschätzung. Das ist der Unterschied zu einer klassischen Asset-Liste: die Bewertung ist
begründet und rückverfolgbar.

---

## 5. Erkenntnissprung: Was TARAflow im Medical-Bereich sichtbar macht

### 5.1 Beispiel: Drug-Library-Update als Safety-Angriffsvektor

**Klassisch:**
```
DF "update DrugLibrary [req]" → Tampering (möglich)
                              → Information Disclosure (möglich)
```
Kein Patientenbezug, keine Priorisierung.

**TARAflow:**
```
DF "update DrugLibrary [req]"
└─ transports → Data Asset "Medikamenten-Grenzwerte"
   └─ Integrity: CRITICAL, safety: { impact: 'fatality' }
   └─ gelesen von: □ Drug-Library-Service (DERS-Validierung)
   └─ affects_safety → Human Asset "Patient" [Protection Target]

→ Threat: Manipulation des Drug-Library-Updates
→ Konsequenz: Falsche Sicherheitsgrenzwerte → toxische Überdosierung
→ Priorität: CRITICAL (Safety Override Rule)
→ Massnahme: Digitale Signatur + Integritätsprüfung vor Import
```

### 5.2 Beispiel: Wartungszugang als versteckter Safety-Angriffsvektor

**Klassisch:**
```
EE "Wartungstechniker" → Spoofing (möglich), Tampering (möglich)
```

**TARAflow:**
```
EE "Wartungstechniker"
└─ uses [local] → System Asset "Infusionspumpe" [CRITICAL, physicalHazardPotential: high]
   └─ accesses [local] → Infrastructure Asset "Service-Port (USB)"
   └─ invokes → Process Asset "Firmware-Update-Prozess"
   └─ affects_safety → Human Asset "Patient" [fatality]

→ Was sichtbar wird:
  Der Wartungszugang ist nicht nur ein IT-Risiko –
  er ist ein direkter Safety-Angriffsvektor.
  Kompromittierter Service-Account → Firmware-Manipulation
  → Pumpe verhält sich unkontrolliert → Patientengefährdung
```

### 5.3 Beispiel: DERS-Validierung als Single Point of Safety-Failure

**Klassisch:** Drug-Library-Service als normaler Prozess – STRIDE wie alle anderen.

**TARAflow:**
```
Process "Drug-Library-Service"
├─ is_an      → Process Asset "DERS-Validierung" [Availability: CRITICAL, fatality]
├─ reads      → Data Asset "Medikamenten-Grenzwerte" [Integrity: CRITICAL]
└─ affects_safety → Human Asset "Patient" [fatality]

→ Was sichtbar wird:
  Die DERS-Validierung ist der einzige Knoten der alle
  Safety-kritischen Grenzwerte vor der Ausführung prüft.
  Denial of Service auf Drug-Library-Service = keine Validierung möglich
  = Pumpe führt unkontrolliert aus = kein Patientenschutz mehr.
  Das ist ohne Asset-Beziehungen nicht erkennbar.
```

---

## 6. Asset-Priorisierung: Fokus auf den Patienten

### 6.1 Kritikalitätsbewertung Medical-Assets

| Asset | Business Impact | Physical Impact | Aggregiert | STRIDE-Tiefe |
|---|---|---|---|---|
| Medikamenten-Grenzwerte | HIGH (Regulatory) | HIGH (fatality) | CRITICAL | Vertieft |
| Flussrate | HIGH (Operational) | HIGH (fatality) | CRITICAL | Vertieft |
| DERS-Validierung | HIGH (Regulatory) | HIGH (fatality) | CRITICAL | Vertieft |
| Firmware-Image | HIGH (Operational) | HIGH (fatality) | CRITICAL | Vertieft |
| Alarm-Schwellen | HIGH (Operational) | HIGH (irreversible_injury) | CRITICAL | Vertieft |
| Klinik-Netzwerk | HIGH (Operational) | MED (indirect) | CRITICAL | Fokussiert |
| Patienten-ID | MEDIUM (Privacy) | MED (indirect) | HIGH | Fokussiert |
| Audit-Daten | MEDIUM (Regulatory) | – | MEDIUM | Hochstufig |

### 6.2 Entscheidungsmatrix STRIDE-Tiefe

| Asset-Kritikalität | Trust Boundary | Attack Enabler | STRIDE-Tiefe | Beispiel Medical |
|---|---|---|---|---|
| CRITICAL | Ja | – | Vertieft | DF "update DrugLibrary" via Klinik-Netz |
| CRITICAL | Nein | – | Fokussiert | DataStore "Drug Library" intern |
| HIGH | Ja | Ja | Fokussiert | Klinik-Netzwerk via WLAN |
| HIGH | Nein | – | Fokussiert | Patienten-ID intern |
| MEDIUM/LOW | Ja | – | Fokussiert | Audit-Daten via Wartungszugang |
| MEDIUM/LOW | Nein | – | Hochstufig | Pumpen-Gehäuse |

### 6.3 Safety Override Rule

Assets mit `safetyImpact: 'fatality'` oder `safetyImpact: 'irreversible_injury'` erhalten
automatisch die höchste Analysepriorität, unabhängig vom Business Impact.
Ein Patientenleben ist nicht mit wirtschaftlichem Schaden verrechenbar (ISO 14971).

---

## 7. STRIDE-Analyse (Auszug)

### Threat T-01: Manipulation der Infusionsrate (Bolus-Angriff)

| Feld | Inhalt |
|---|---|
| **DFD-Element** | DF `send BolusCommand [cmd]` |
| **Asset-Beziehung** | `transports → Data Asset "Flussrate"` |
| **STRIDE-Kategorie** | Tampering / Spoofing |
| **CIANAAA-Verletzung** | Integrity, Authentication |
| **Schutzziel** | Bolus-Befehle dürfen nur von autorisiertem Pflegepersonal ausgelöst werden |
| **Angriffspfad** | Kompromittierung der Zentralstation → unautorisierter Bolus-Befehl an Pumpe → Ausführung ohne DERS-Prüfung |
| **Safety-Konsequenz** | `affects_safety → Human Asset "Patient"` → fatality |
| **Priorität** | CRITICAL (Safety Override Rule) |
| **STRIDE-Tiefe** | Vertieft (Trust Boundary + CRITICAL Asset + Safety) |

### Threat T-02: Manipulation des Drug-Library-Updates

| Feld | Inhalt |
|---|---|
| **DFD-Element** | DF `update DrugLibrary [req]` |
| **Asset-Beziehung** | `transports → Data Asset "Medikamenten-Grenzwerte"` |
| **STRIDE-Kategorie** | Tampering |
| **CIANAAA-Verletzung** | Integrity, Authentication |
| **Schutzziel** | Drug-Library-Updates nur von verifizierter Klinik-IT mit Integritätsnachweis |
| **Angriffspfad** | MITM im Klinik-Netz → manipuliertes Update eingespielt → DERS-Grenzwerte erhöht → toxische Dosen werden nicht blockiert |
| **Safety-Konsequenz** | `stores → Medikamenten-Grenzwerte → affects_safety → Patient` → fatality |
| **Priorität** | CRITICAL (Safety Override Rule) |
| **STRIDE-Tiefe** | Vertieft (Trust Boundary + CRITICAL Asset + Safety) |

### Threat T-03: Denial of Service DERS-Validierung

| Feld | Inhalt |
|---|---|
| **DFD-Element** | Process `Drug-Library-Service` |
| **Asset-Beziehung** | `is_an → Process Asset "DERS-Validierung"` |
| **STRIDE-Kategorie** | Denial of Service |
| **CIANAAA-Verletzung** | Availability |
| **Schutzziel** | DERS-Validierung muss jederzeit verfügbar sein bevor Pumpe ausführt |
| **Angriffspfad** | Netzwerk-Flooding auf Klinik-WLAN → Drug-Library-Service nicht erreichbar → Pumpe führt ohne Grenzwert-Validierung aus |
| **Safety-Konsequenz** | `affects_safety → Patient` → fatality |
| **Priorität** | CRITICAL (Safety Override Rule) |
| **STRIDE-Tiefe** | Vertieft (CRITICAL Asset + Safety) |

### Threat T-04: Kompromittiertes Firmware-Update via Service-Port

| Feld | Inhalt |
|---|---|
| **DFD-Element** | EE `Wartungstechniker` via DF `send FirmwareUpdate [req]` |
| **Asset-Beziehung** | `transports → Data Asset "Firmware-Image"` |
| **STRIDE-Kategorie** | Tampering / Elevation of Privilege |
| **CIANAAA-Verletzung** | Integrity, Authorization, Non-Repudiation |
| **Schutzziel** | Firmware-Updates nur signiert und von autorisiertem Personal |
| **Angriffspfad** | Physischer Zugang zum Service-Port → unsigniertes Firmware-Image eingespielt → vollständige Kontrolle über Pumpenverhalten |
| **Safety-Konsequenz** | `indirect via System Asset "Infusionspumpe"` → fatality |
| **Priorität** | CRITICAL (Safety Override Rule) |
| **STRIDE-Tiefe** | Vertieft (CRITICAL Asset + physischer Zugang) |

---

## 8. Risk-Tabelle (Auszug)

| ID | Threat | Likelihood | Impact | Risk | Safety Override | Massnahme | Prio |
|---|---|---|---|---|---|---|---|
| T-01 | Bolus-Manipulation | MEDIUM | CRITICAL | HIGH | ✅ fatality | mTLS + Bestätigung kritischer Befehle am Gerät | 1 |
| T-02 | Drug-Library-Manipulation | MEDIUM | CRITICAL | HIGH | ✅ fatality | Digitale Signatur + Integritätsprüfung vor Import | 1 |
| T-03 | DoS DERS-Validierung | HIGH | CRITICAL | CRITICAL | ✅ fatality | Offline-Fallback Drug Library + Netzwerksegmentierung | 1 |
| T-04 | Firmware-Update Manipulation | LOW | CRITICAL | MEDIUM | ✅ fatality | Secure Boot + signierte Firmware + physische Zugangskontrolle | 1 |
| T-05 | Patienten-ID Disclosure | MEDIUM | HIGH | HIGH | – | TLS + Authentifizierung HIS-Kommunikation | 2 |

**Safety Override Rule in der Praxis:** T-04 hat Likelihood LOW – klassisch wäre das Risk MEDIUM
mit normaler Priorität. Durch die Safety Override Rule (fatality) wird es zu Priorität 1
unabhängig vom Business Impact. Diese Entscheidung ist methodisch begründet und auditierbar
nach ISO 14971.

---

## 9. Der TARAflow-Graph als Single Source of Truth

```
Knoten: DFD-Elemente (Process, DataStore, EE, DF) + Assets (5 Kategorien)
Kanten: typisierte Beziehungen (affects_safety, depends_on, transports, ...)
        mit optionaler SafetyAnnotation (relevance, impact, physicalHazardPotential)
```

Dieser Graph ist die einzige Datenquelle – alle Diagramme und Dokumente werden daraus
abgeleitet. Eine Änderung im Modell propagiert in alle Sichten gleichzeitig.

### 9.1 Regelbasierte Ableitungen

| Auslöser im Graph | Automatische Ableitung |
|---|---|
| DF mit `transports` + Asset Integrity: HIGH+ | Tampering als Pflicht-Threat |
| DF mit `transports` + Asset Confidentiality: HIGH+ | Information Disclosure als Pflicht-Threat |
| EE mit `uses[network]` + Trust Boundary | Spoofing als Pflicht-Threat |
| Process mit `is_an` + Asset Availability: CRITICAL | DoS als Pflicht-Threat |
| SafetyAnnotation `impact: 'fatality'` auf Beziehung | `physicalImpact` := HIGH (derived) |
| SafetyAnnotation `impact: 'irreversible_injury'` | `physicalImpact` := HIGH (derived) |
| Element Hop-1 zu Asset mit `physicalImpact` HIGH | `physicalImpact` := MED (derived, indirect) |
| `physicalImpact` manuell ohne DFD-Annotation | Validierungswarnung + Rationale-Pflicht |
| Asset mit `safetyImpact: fatality` | `riskPriority` := 1, `strideDepth` := vertieft |

---

## 10. Automatisch generierbare Diagramme

### 10.1 Safety-Sicht (EN 50742 / ISO 14971)

```
SAFETY-KRITISCHE PFADE  🔴 = fatality risk

□ Pumpensteuerung     ──affects_safety──→ 👤 Patient 🔴
□ Drug-Library-Service ──affects_safety──→ 👤 Patient 🔴
□ Alarm-Manager       ──affects_safety──→ 👤 Patient 🔴
○ Wartungstechniker   ──exposes─────────→ 👤 Patient 🔴

Kritische Kette (T-02):
○ Klinik-IT → DF update DrugLibrary → 🗄 Drug Library (lokal)
  └─ reads: □ Drug-Library-Service (DERS)
  └─ affects_safety → 👤 🔴

Kritische Kette (T-04):
○ Wartungstechniker → Service-Port → Firmware-Image
  └─ is_an: □ Pumpensteuerung
  └─ affects_safety → 👤 🔴
```

### 10.2 Angriffsflächen-Sicht

```
○ Klinik-IT (HIS/EMR) ──uses[network]──→ □ Drug-Library-Service ⚠️ CRITICAL
○ Pflegepersonal      ──send Bolus────→ □ Pumpensteuerung       ⚠️ CRITICAL
○ Wartungstechniker   ──accesses[local]→ 🏗 Service-Port (USB)  ⚠️ HIGH
                      ──uses[local]───→ System "Infusionspumpe" ⚠️ CRITICAL

Zusammenfassung: 4 EEs | 6 Vektoren | 4 CRITICAL mit Safety-Relevanz
```

---

## 11. Warum ein Graph – nicht viele Dokumente

| Deliverable | Manuelle Erstellung | TARAflow |
|---|---|---|
| DFD | Manuell zeichnen | ✅ Eingabe-Diagramm |
| Systemarchitektur | Separat erstellen | ✅ Automatisch aus Graph |
| Safety-Nachweis (ISO 14971) | Manuell dokumentieren | ✅ Automatisch aus Graph |
| Asset-Inventar (IEC 81001-5-1) | Separat pflegen | ✅ Automatisch aus Graph |
| MDR Anhang I Nachweis | Manuell erstellen | ✅ Automatisch aus Graph |
| TARA-Dokumentation | Manuell erstellen | ✅ Kern-Output |
| Risk-Tabelle | Manuell erstellen | ✅ Aus Threat-Analyse |

---

## 12. Die vollständige Safety-Kette im Graphen

```
Angriff auf Drug-Library-Update (Cyber-Bedrohung)
  ↓ transports [Integrity verletzt]
Manipulation Medikamenten-Grenzwerte (Data Asset)
  ↓ reads
Fehlerhafte DERS-Validierung (Process Asset)
  ↓ is_an → Infusionsprozess ausgeführt
Unkontrollierte Flussrate (Data Asset)
  ↓ affects_safety
Überdosierung des Patienten (Human Asset – Protection Target) 🔴
```

Jeder Schritt ist im Graph explizit modelliert. Daraus folgt automatisch die höchste
Threat-Priorität – begründet, auditierbar, normkonform nach ISO 14971 und MDR.

---

## 13. Positionierung für die MDR-Zulassung

| Anforderung | MDR / ISO 14971 | TARAflow-Nachweis |
|---|---|---|
| Risikomanagement-Akte | MDR Anhang I, §3 | TARA-Dokumentation vollständig rückverfolgbar |
| Security-Risk-Assessment | IEC 81001-5-1 | Graph-basierte STRIDE-Analyse |
| Traceability Massnahmen | MDR Art. 10 | Massnahme → Threat → Asset → DFD-Element |
| Safety/Security-Integration | ISO 14971 §4 | Safety Annotation Layer im Security-Modell |
| Verifikation und Validierung | IEC 81001-5-1 §8 | Verifikationen im Threat-Tab verlinkt |

---

## 14. Nächste Schritte mit diesem Referenzfall

1. **Graph vervollständigen** – alle Asset-Beziehungen formal in TARAflow erfassen
2. **STRIDE vollständig** – alle Threats für CRITICAL Assets systematisch ableiten
3. **Attack Trees** – für T-01 und T-02 als Beispiel für Phase 3 TARAflow
4. **Massnahmen vollständig** – alle Threats mit konkreten Massnahmen und Normnachweis
5. **Export** – alle Diagramme und Dokumente automatisch aus dem Graph generieren
6. **Vortrag** – Referenzfall als Live-Demo in TARAflow mit MDR-Nachweis

Dieser Referenzfall ist der sekundäre Testfall für Medical-Device-spezifische TARAflow-Features
und dient als Demonstrationsgrundlage für Hersteller, Berater und Auditoren im Medizinbereich.

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>