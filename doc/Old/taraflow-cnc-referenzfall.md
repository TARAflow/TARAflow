# TARAflow Referenzfall: CNC-Fertigungssystem

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>

> **Zweck dieses Dokuments:** Demonstration der TARAflow-Methodik anhand eines realen OT-Systems. Der Referenzfall zeigt die Stärken des graphbasierten Ansatzes. Insbesondere die Integration von Safety und Security, die automatische Diagrammgenerierung und die vollständige Rückverfolgbarkeit von der Systemmodellierung bis zur Risikobewertung.

---

## 0. Einführung: Warum TARAflow?

### Das Problem klassischer Methoden

Klassische Threat-Modeling-Ansätze, ob STRIDE-naiv oder regelbasierte Tools wie IriusRisk, analysieren **Elemente**, nicht **Auswirkungen**. Das Ergebnis ist eine Liste generischer Threats ohne konkreten Schadensbezug:

```
Klassisch:
CNC-Steuerung → Tampering (möglich)
                Information Disclosure (möglich)
                Denial of Service (möglich)
```

Man weiss was angegriffen werden kann, aber nicht warum es relevant ist, wie schwer der Schaden wäre und was die Safety-Konsequenz für Menschen ist. Jedes Element generiert dieselbe STRIDE-Liste, unabhängig davon ob es kritisch ist oder nicht. Der Analyseaufwand ist hoch, die Aussagekraft gering.

### Der TARAflow-Ansatz

TARAflow dreht die Logik um: **Assets und ihr Impact steuern die Analyse**, nicht Elementtypen und Regelkataloge.

```
TARAflow:
DFD-Element → Asset → Impact + CIANAAA-Schutzziele → STRIDE → Risk
                ↑
          Was ist schützenswert?        (Asset-Kategorie)
          Wie hoch ist der Schaden?     (Impact-Bewertung)
          Welches Schutzziel wird verletzt? (C/I/A/N/A/A/A)
```

Das Ergebnis ist keine generische Threat-Liste, sondern eine vollständige, nachvollziehbare Kette von der Systemstruktur bis zur Konsequenz.
CIANAAA steht für Confidentiality, Integrity, Availability, Non-Repudiation, Authentication, Authorization und Accountability.
TARAflow unterscheidet insbesondere zwischen Accountability (systeminterne Nachvollziehbarkeit) und Non-Repudiation
(beweisfeste Nicht-Abstreitbarkeit). Diese Unterscheidung wird im Methodenkern formal definiert.

### Drei konkrete Gewinne gegenüber klassischen Methoden

**1. Vollständige Rückverfolgbarkeit**
Jede Massnahme ist bis zum Asset, zur Schutzziel-Verletzung und zur regulatorischen Anforderung zurückverfolgbar. Das ist kein Nice-to-have. Es ist eine Anforderung nach IEC 62443-4-1 und EU Cyber Resilience Act.

**2. Safety + Security in einem Modell**
Safety-Konsequenzen (Personengefährdung) werden direkt aus dem Security-Modell abgeleitet, ohne separates Safety-Dokument, ohne Doppelpflege, ohne Inkonsistenz zwischen zwei Modellen.

**3. Fokus durch risikoorientierte Priorisierung**
Nicht jedes Element wird gleich tief analysiert. Asset-Kritikalität steuert die STRIDE-Tiefe proportional zum potenziellen Schaden. Das reduziert Analyseaufwand ohne Vollständigkeit zu opfern.

### Positionierung

TARAflow richtet sich an **Hersteller** die eine normkonforme TARA mit Nachweispflicht nach IEC 62443-4-1/4-2, ISO 21434, EN 50742 oder dem EU Cyber Resilience Act durchführen müssen. Es ist kein Tool für schnelle erste Übersichten, sondern für begründete, auditierbare Sicherheitsanalysen.

---

## 1. Systemkontext

Ein CNC-Fertigungssystem besteht aus einer oder mehreren CNC-Maschinen, einem Robotersystem für die Werkstückhandhabung, einem übergeordneten Leitsystem (SCADA) sowie verschiedenen Akteuren wie Bediener, Programmierer und Remote-Support. Das System hat direkte Sicherheitsrelevanz, da unkontrollierte Maschinenbewegungen zu schweren Verletzungen oder Tod führen können.

**Systemgrenze:** Das Produkt/System unter Analyse umfasst CNC-Steuerung, Robotersteuerung und Leitsystem inklusive aller Schnittstellen nach aussen.

**Regulatorischer Kontext:** IEC 62443-4-1 (SDL), EN 50742 (Safety), ISO 12100 (Maschinensicherheit), EU Cyber Resilience Act.

---

## 2. DFD-Modellierung

### 2.1 Elemente

**External Entities:**
- `○ Operator` – Maschinenbediener vor Ort
- `○ Programmierer` – NC-Programm Erstellung und Upload
- `○ Remote Support` – Hersteller-Fernwartung via VPN
- `○ Wartungstechniker` – Physische Wartung vor Ort

**Processes:**
- `□ CNC-Steuerung` – Ausführung von NC-Programmen, Achsregelung
- `□ Robotersteuerung` – Werkstückhandhabung, Bewegungssteuerung
- `□ Leitsystem (SCADA)` – Überwachung, Auftragssteuerung, Datenerfassung
- `□ Sicherheitssteuerung (SIS)` – Not-Halt, Schutzzaunüberwachung

**Data Stores (Speichersysteme):**
- `🗄 CNC-Filesystem` – Lokaler Speicher der CNC-Steuerung (NC-Programme, Kalibrierungsdaten)
- `🗄 SPS-Speicher` – Interner Speicher der Sicherheitssteuerung (Safety-Parameter)
- `🗄 Historian-Datenbank` – Zeitreihendatenbank im Leitsystem (Produktions- und Prozessdaten)
- `🗄 Netzwerk-Share` – Freigegebener Ordner im OT-Netzwerk (NC-Programm Upload)

**Data Flows (nach TARAflow Naming-Konvention):**
- `→ send NC-Program [req]` – Programmierer → Netzwerk-Share
- `→ pull NC-Program [req]` – CNC-Steuerung → Netzwerk-Share
- `→ recv NC-Program [resp]` – Netzwerk-Share → CNC-Steuerung
- `→ send cmd machineControl [cmd]` – Leitsystem → CNC-Steuerung
- `→ send cmd robotControl [cmd]` – Leitsystem → Robotersteuerung
- `→ stream machineStatus [stream]` – CNC-Steuerung → Leitsystem
- `→ send diagnostics [req]` – Remote Support → CNC-Steuerung
- `→ recv diagnostics [resp]` – CNC-Steuerung → Remote Support
- `→ send emergencyStop [cmd]` – Sicherheitssteuerung → CNC-Steuerung
- `→ send emergencyStop [cmd]` – Sicherheitssteuerung → Robotersteuerung

**Trust Boundaries:**
- `─ Remote-Access-Grenze` – Externe Netzwerkgrenze (VPN/Internet)
- `─ Steuerungsnetzwerk` – OT-Netzwerk intern
- `─ Operator-Zugang` – Physischer Zugang zur Maschine
- `─ Safety-Grenze` – Zwischen Safety und Non-Safety Bereich

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
abgeleitet (`derived`) oder manuell (`manual`) gesetzt werden. Bei manueller Setzung ist eine
Begründung (`rationale`) Pflicht.

### 3.1 Data Assets

Identifizierte Data Assets: Fertigungsrezepte, Kalibrierungsdaten, Produktionsdaten, Maschinenstatus, Diagnosedaten, Safety-Parameter, Auftragsdaten.

**Beziehungen:**
```
DataStore "CNC-Filesystem"
├─ stores → Data Asset "Fertigungsrezepte"
└─ stores → Data Asset "Kalibrierungsdaten"
   └─ safety: { relevance: 'direct', impact: 'irreversible_injury',
                rationale: 'Falsche Kalibrierung → unkontrollierte Bewegung' }

DataStore "Netzwerk-Share"
└─ stores → Data Asset "Fertigungsrezepte"

DataStore "Historian-Datenbank"
└─ stores → Data Asset "Produktionsdaten"

DataStore "SPS-Speicher"
└─ stores → Data Asset "Safety-Parameter"
   └─ safety: { relevance: 'indirect', impact: 'fatality',
                rationale: 'Manipulation der Safety-Parameter kompromittiert SIS-Logik –
                            indirekter Einfluss über Sicherheitssteuerung auf Not-Halt-Fähigkeit' }

Process "CNC-Steuerung"
├─ reads    → Data Asset "Fertigungsrezepte"
└─ modifies → Data Asset "Maschinenstatus"

Process "Leitsystem"
├─ creates  → Data Asset "Produktionsdaten"
└─ stores   → Data Asset "Auftragsdaten"

DF "send NC-Program [req]"
└─ transports → Data Asset "Fertigungsrezepte"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Manipuliertes NC-Programm → falsche Werkzeugbewegung' }

DF "recv diagnostics [resp]"
└─ transports → Data Asset "Diagnosedaten"
```

### 3.2 Process Assets

Identifizierte Process Assets: Zerspanungsprozess, Einrichtbetrieb, Not-Halt-Prozess, Qualitätsprüfung.

**Beziehungen:**
```
Process "CNC-Steuerung"
└─ is_an → Process Asset "Zerspanungsprozess"

Process "Leitsystem"
└─ monitors → Process Asset "Zerspanungsprozess"

EE "Operator"
└─ invokes → Process Asset "Einrichtbetrieb"

Process "Sicherheitssteuerung"
├─ is_an      → Process Asset "Not-Halt-Prozess"
│  └─ safety: { relevance: 'direct', impact: 'fatality' }
└─ terminates → Process Asset "Zerspanungsprozess"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Not-Halt muss zuverlässig stoppen können' }
```

### 3.3 System Assets

Identifizierte System Assets: CNC-Maschine, Roboter, Leitsystem, Sicherheitssteuerung (SIS).

**Beziehungen:**

**Beziehungen:**
```
Process "CNC-Steuerung"
└─ is_an → System Asset "CNC-Maschine"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                physicalHazardPotential: 'high' }

Process "Leitsystem"
├─ controls  → System Asset "CNC-Maschine"
├─ controls  → System Asset "Roboter"
│  └─ safety: { relevance: 'indirect', impact: 'fatality',
│               rationale: 'Indirekter Einfluss über Leitsystem-Kompromittierung –
│                           kompromittiertes Leitsystem kann Roboterbewegungen auslösen' }
└─ monitors  → System Asset "Sicherheitssteuerung"

Process "CNC-Steuerung"
├─ uses [network] → System Asset "Leitsystem"
└─ depends_on     → System Asset "Leitsystem"

EE "Remote Support"
└─ uses [network] → System Asset "CNC-Maschine"

Process "Sicherheitssteuerung"
└─ is_an → System Asset "Sicherheitssteuerung (SIS)"
   └─ safety: { relevance: 'direct', impact: 'fatality' }
```

### 3.4 Infrastructure Assets

Identifizierte Infrastructure Assets: Schutzumhausung, Steuerungsschrank, CNC-Gehäuse, OT-Netzwerkinfrastruktur.

**Beziehungen:**

**Beziehungen:**
```
EE "Wartungstechniker"
├─ accesses [local]    → Infrastructure Asset "CNC-Maschine (physisch)"
└─ accesses [internal] → Infrastructure Asset "Steuerungsschrank"

Infrastructure Asset "CNC-Maschine (physisch)"
└─ HighValue: {
     isHighValueAsset: true,
     assetDestructionImpact: 'critical',
     replacementLeadTime: '>12m (critical)',
     highValueRationale: 'Speziell konfigurierte 5-Achsen-Anlage für Titanbearbeitung.
                          Wiederbeschaffung, Rekonfiguration und Wiederanlaufqualifizierung
                          erfordern > 12 Monate. Totalausfall = vollständiger Produktionsstop.'
   }

Infrastructure Asset "Steuerungsschrank"
└─ HighValue: {
     isHighValueAsset: true,
     assetDestructionImpact: 'high',
     replacementLeadTime: '3-6m (medium)',
     highValueRationale: 'Kundenspezifische SPS-Konfiguration mit applikationsspezifischer
                          Steuerungslogik. Standardhardware, aber Neukonfiguration,
                          Inbetriebnahme und Sicherheitsabnahme sind zeitintensiv.'
   }

Process "Sicherheitssteuerung"
├─ secures  → Infrastructure Asset "Schutzumhausung"
│  └─ safety: { relevance: 'indirect', isPhysicalBarrier: true, impact: 'fatality',
│               rationale: 'Verhindert Kontakt mit rotierenden Werkzeugen –
│                           relevance: indirect da Schutzumhausung den Schaden nicht steuert
│                           sondern physisch unterbindet' }
└─ monitors → Infrastructure Asset "Schutzumhausung"

Process "USV"
└─ powers → Infrastructure Asset "Steuerungsschrank"

EE "Angreifer (physisch)"
└─ damages → Infrastructure Asset "Schutzumhausung"
```

### 3.5 Human Assets

Identifizierte Human Assets: Maschinenbediener, Einrichter, NC-Programmierer, Wartungstechniker, Mitarbeiter (allgemein).

> **Unterscheidung Einrichter / NC-Programmierer:**
> Der Einrichter testet und richtet Programme direkt an der Maschine ein –
> er ist physisch im Gefahrenbereich und damit Protection Target.
> Der NC-Programmierer erstellt Programme am Schreibtisch – er ist nicht
> physisch gefährdet, trägt aber Verantwortung für sicherheitskritische Logik.

**Beziehungen:**
```
EE "Operator"
└─ is_an → Human Asset "Maschinenbediener"
   └─ Properties: { isProtectionTarget: true, safetyImpact: 'fatality',
                    rationale: 'Physische Präsenz im Gefahrenbereich der Maschine' }

Process "CNC-Achssteuerung"
└─ affects_safety → Human Asset "Maschinenbediener"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Unkontrollierte Werkzeugbewegung bei Fehlmanipulation' }

Process "Robotersteuerung"
└─ affects_safety → Human Asset "Maschinenbediener"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Kollision durch falsche Bewegungsbahn' }

Process "Remote-Diagnose"
└─ exposes → Human Asset "Maschinenbediener"
   └─ rationale: 'Kompromittierung ermöglicht Fernsteuerung der Maschine'

EE "Einrichter"
└─ is_an → Human Asset "Einrichter"
   └─ Properties: { isProtectionTarget: true, safetyImpact: 'fatality',
                    rationale: 'Physische Präsenz im Gefahrenbereich während Einrichtung/Test' }

Process "CNC-Achssteuerung"
└─ affects_safety → Human Asset "Einrichter"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Testablauf im reduzierten Schutzmodus – direkter Gefahrenkontakt möglich' }

Process "Robotersteuerung"
└─ affects_safety → Human Asset "Einrichter"
   └─ safety: { relevance: 'direct', impact: 'fatality',
                rationale: 'Einrichter bewegt sich im Arbeitsbereich des Roboters –
                            unkontrollierte Bewegung bei reduziertem Schutzmodus möglich' }

EE "NC-Programmierer"
└─ is_an → Human Asset "NC-Programmierer"
   └─ Properties: { isProtectionTarget: false,
                    rationale: 'Erstellt NC-Programme am Schreibtisch – kein physischer Gefahrenbereich' }

Process "NC-Programm-Validierung"
└─ responsible_for → Human Asset "NC-Programmierer"
   └─ rationale: 'Fehlerhaftes Programm kann zu gefährlichen Maschinenbewegungen führen'


Process "Zeiterfassung"
├─ tracks          → Human Asset "Mitarbeiter"
└─ affects_privacy → Human Asset "Mitarbeiter"
```

---

## 4. Asset Impact- und Schutzziel-Bewertung

Erst nachdem die Beziehungen im Graphen festgelegt sind, wird bewertet was jedes Asset schützenswert macht und warum. Die Safety-Relevanz ergibt sich dabei direkt aus den Beziehungen. Eine separate Analyse ist nicht erforderlich.. Wer `affects_safety` auf einen Human Asset hat, bekommt Safety-Impact. Wer `secures` auf eine physische Barriere hat, ist sicherheitsrelevant.

### 4.0 Formale Aggregationslogik

Die aggregierte Asset-Kritikalität ergibt sich aus zwei unabhängigen Dimensionen: Business Impact und Physical Impact. Die Aggregation folgt einer expliziten Regel – keine Heuristik, keine Subjektivität.

**Aggregationsmatrix:**

| Business Impact | Safety Impact | relevance | Aggregiert |
|---|---|---|---|
| beliebig | HIGH (fatality / irreversible_injury) | direct | **CRITICAL** |
| beliebig | HIGH (fatality / irreversible_injury) | indirect | **HIGH+** |
| CRITICAL | – oder MED | – | **CRITICAL** |
| HIGH | MED (indirect, Hop 1) | – | **HIGH** |
| HIGH | – | – | **HIGH** |
| MEDIUM | MED (indirect, Hop 1) | – | **MEDIUM+** |
| MEDIUM | – | – | **MEDIUM** |
| LOW | MED (indirect, Hop 1) | – | **MEDIUM** |
| LOW | – | – | **LOW** |

> **Hinweis zu HIGH+/MEDIUM+:** Diese Zwischenwerte bedeuten "oberes Ende der Stufe"
> und können durch hohe Likelihood in der Risk-Tabelle zu CRITICAL/HIGH eskalieren.
> Die finale Risikoeinstufung ergibt sich aus Impact × Likelihood – nicht aus dem
> aggregierten Kritikalitätswert allein.

> **Hinweis:** `Physical Impact` wurde in `Safety Impact (physicalImpact)` umbenannt um die
> Konsistenz mit ISO 21434 Damage Categories und dem internen Derived/Manual Pattern
> herzustellen. HIGH entspricht `fatality` oder `irreversible_injury` aus der SafetyAnnotation,
> MED entspricht `indirect` (transitiv via Graph-Traversierung Hop 1).

Business Impact CRITICAL ist projektspezifisch zu definieren. Im NIS-2-Kontext z.B. bei schwerem volkswirtschaftlichem Schaden oder Verlust kritischer Infrastruktur, im CNC-Kontext z.B. bei totalem Produktionsausfall mit existenzbedrohenden Folgen. Safety-Aspekte führen zwar zwangsläufig zur Einstufung 'CRITICAL', sind jedoch bei weitem nicht der einzige Auslöser.

**Safety Override Rule (formale Definition):**

```
IF safetyImpact ∈ { 'fatality', 'irreversible_injury' }
   AND relevance === 'direct'
THEN aggregatedCriticality := CRITICAL
     strideDepth            := 'vertieft'
     riskPriority           := 1

IF safetyImpact ∈ { 'fatality', 'irreversible_injury' }
   AND relevance === 'indirect'
THEN aggregatedCriticality := HIGH+
     strideDepth            := 'fokussiert'
     riskPriority           := 2
```
Diese Regel implementiert das ISO 12100 Prinzip: physische Unversehrtheit von
Menschen ist kein verrechenbarer Faktor. Die Differenzierung nach relevance
stellt sicher dass nur Assets mit direkter Steuerungsverantwortung automatisch
zu CRITICAL eskalieren. Assets mit indirektem Einfluss bleiben differenzierbar.


Diese Regel ist methodisch verbindlich und nicht überschreibbar. Sie implementiert das ISO 12100 Prinzip: physische Unversehrtheit von Menschen ist kein verrechenbarer Faktor.

### 4.0a Zwei Impact-Domänen und Safety-Ableitung

TARAflow bewertet Assets entlang zwei unabhängiger Impact-Domänen:

| Domäne | Kriterien (Beispiele) |
|---|---|
| **Business / Organisatorisch** | Financial Damage, Regulatory/Compliance, Reputation, Operational Impact, Affected Users, Recoverability |
| **Physical / Safety** | **Safety**, Physical Asset Damage, Environmental Impact, Supply Chain |

Die Kriterien sind projektspezifisch anpassbar und werden in Phase 0 (Projektprofil) festgelegt.
Die Gesamtkritikalität pro Domäne ergibt sich nach dem Highest-Impact-Wins Prinzip.

**Safety als Kriterium innerhalb der Physical-Domäne:**

Das Safety-Kriterium ist das einzige Kriterium der Physical-Domäne das aus dem Graphen
abgeleitet wird. Die SafetyAnnotation auf einer Beziehung im DFD-Tab ist die bevorzugte Quelle –
nicht eine manuelle Schätzung. Das stellt sicher dass Safety auditierbar und rückverfolgbar ist.

**Safety Annotation Pattern auf Beziehungsebene:**

```typescript
safety: {
  relevance: "none" | "indirect" | "direct";
  impact?: "none" | "reversible_injury" | "irreversible_injury" | "fatality";
  physicalHazardPotential?: "low" | "medium" | "high";
  protectionTarget?: boolean;        // nur bei Human Assets
  affectedSafetyFunctions?: string[];
  rationale?: string;
}
```

**Ableitungsregel Safety Impact am Asset (Derived/Manual Pattern):**

```
SafetyAnnotation auf Beziehung (relevance/impact)    →  physicalImpact am Asset
─────────────────────────────────────────────────────────────────────────────────
impact: 'fatality'                                   →  HIGH  (derived)
impact: 'irreversible_injury'                        →  HIGH  (derived)
relevance: 'indirect' (transitiv, Hop 1)             →  MED   (derived)
keine Annotation                                     →  LOW   (derived, default)
```

**Derived/Manual Pattern – formale Definition:**

Jedes abgeleitete Safety-Feld am Asset hat ein Herkunfts-Attribut:

```
physicalImpact           → "LOW" | "MED" | "HIGH"
physicalImpactSource     → "derived" (default) | "manual"
physicalImpactRationale  → string (Pflicht wenn source === "manual")
```

Im Audit-Report gilt:
- `source === "derived"` → keine zusätzliche Dokumentationspflicht
- `source === "manual"` → Rationale wird verbatim dokumentiert (IEC 62443-4-1)

**Wann ist manuelles Setzen erlaubt?**

Ein Analyst darf `physicalImpact` manuell überschreiben wenn:
- Noch keine SafetyAnnotation im DFD vorhanden ist (Analyse läuft iterativ)
- Systemkontext eine direkte Bewertung erfordert die der Graph nicht abbildet

Das Tool erzeugt in diesem Fall eine Warnung:

```
⚠️ WARNING: physicalImpact manuell gesetzt ohne korrespondierende
   SafetyAnnotation im DFD-Tab.
   Rationale dokumentieren oder SafetyAnnotation ergänzen.
```

**Hop-Logik für transitive Safety-Relevanz:**

```
Hop 0:  Element ──(Beziehung mit safety.relevance: 'direct')──▶ Asset
        → physicalImpact: HIGH (derived)

Hop 1:  Element ──(controls/depends_on)──▶ Element[Hop 0]
        → physicalImpact: MED (derived, relevance: 'indirect')

Hop 2+: → nicht automatisch propagiert (zu weit vom direkten Schadenspfad)
```

CNC-Beispiel:
```
Sicherheitssteuerung  → is_an    → SIS Asset       → physicalImpact: HIGH (direct)
Leitsystem            → controls → Sicherheitsst.  → physicalImpact: MED  (indirect, Hop 1)
Remote Support EE     → uses     → Leitsystem       → nicht automatisch (Hop 2)
```

### 4.1 Begriffliche Präzisierung der CIANAAA-Schutzziele

Die ie Schutzziele Confidentiality, Integrity, Availability,
Authentication und Authorization sind etabliert und werden
im üblichen sicherheitstechnischen Sinn verwendet.

Die Ziele Non-Repudiation und Accountability werden in TARAflow
bewusst unterschieden, da sie unterschiedliche Aspekte der
Zurechenbarkeit beschreiben.

#### Non-Repudiation

Non-Repudiation bezeichnet die technische Nicht-Abstreitbarkeit
einer Handlung. Eine Aktion muss so protokolliert und gesichert
sein, dass sie einem Akteur eindeutig zugeordnet werden kann
und nicht nachträglich bestritten werden kann.

Non-Repudiation entspricht dem R (Repudiation) in STRIDE und
ist das Standard-Schutzziel überall wo Repudiation als Threat
relevant ist.

Typische Massnahmen: Audit-Log, digitale Signatur,
kryptografische Zeitstempel.

#### Accountability

Accountability bezeichnet die rechtliche und organisatorische
Verantwortlichkeit für Handlungen und deren Konsequenzen.
Sie geht über technisches Logging hinaus und adressiert die
Nachweispflicht gegenüber Behörden und betroffenen Personen.

Accountability kommt zusätzlich zum Zuge wenn personenbezogene
Daten verarbeitet werden (DSGVO Art. 5 Abs. 2) oder wenn
eine organisatorische Verantwortlichkeit nachgewiesen werden muss.

Typische Kontexte: affects_privacy, tracks, HR-Systeme,
Kundendaten, regulatorische Nachweispflichten gegenüber Behörden.

#### Ableitungsprinzip in TARAflow

Non-Repudiation wird abgeleitet überall wo der Beziehungstyp
einen Repudiation-Threat ermöglicht. Das entspricht dem
systematischen Vorgehen in STRIDE.

Accountability wird zusätzlich abgeleitet wenn das Asset
einen Privacy-Bezug hat oder eine organisatorische
Verantwortlichkeit gegenüber Behörden nachgewiesen werden muss.

Formal gilt:

```
Non-Repudiation: Standard bei Repudiation-relevanten Beziehungstypen
Accountability:  Zusatz bei Privacy (DSGVO) und behördlicher Nachweispflicht
```

### 4.2 Schutzziel-Ableitung aus Beziehungstyp

Die CIANAAA-Schutzziele (Confidentiality, Integrity, Availability,
Non-Repudiation, Authentication, Authorization, Accountability)
werden nicht frei vergeben. Sie folgen aus dem Beziehungstyp
zwischen DFD-Element und Asset. Die Zuordnung erfolgt kategorisiert
nach Asset-Typen, da die Relevanz der Beziehungstypen je nach
Asset-Klasse variiert.

*Data Assets:*

| Beziehungstyp | Primäre Schutzziele |
|---|---|
| `stores` | Integrity, Availability, Confidentiality* |
| `reads` | Confidentiality, Authorization |
| `modifies` | Integrity, Authorization, Non-Repudiation |
| `creates` | Integrity, Authentication, Non-Repudiation, Accountability** |
| `destroys` | Integrity, Authorization, Non-Repudiation, Accountability** |
| `transports` | Integrity, Confidentiality, Authentication, Accountability** |

*Process Assets:*

| Beziehungstyp | Primäre Schutzziele |
|---|---|
| `is_an` | Integrity, Availability, Confidentiality* |
| `invokes` | Authorization, Non-Repudiation, Accountability** |
| `terminates` | Authorization, Integrity |
| `suspends` | Authorization, Availability |
| `monitors` | Integrity, Non-Repudiation, Accountability** |
| `executes` | Integrity, Authorization, Non-Repudiation, Accountability** |

*System Assets:*

| Beziehungstyp | Primäre Schutzziele |
|---|---|
| `is_an` | Integrity, Availability |
| `controls` | Integrity, Availability, Authorization |
| `configures` | Integrity, Authorization, Non-Repudiation |
| `depends_on` | Availability |
| `uses [network]` | Authentication, Authorization, Integrity, Accountability** |
| `uses [local]` | Authorization, Integrity |

*Infrastructure Assets:*

| Beziehungstyp | Primäre Schutzziele |
|---|---|
| `is_an` | Integrity, Availability |
| `accesses [local]` | Authorization, Non-Repudiation |
| `accesses [internal]` | Authorization, Non-Repudiation |
| `accesses [remote]` | Authentication, Authorization, Non-Repudiation, Accountability** |
| `secures` | Availability, Integrity |
| `powers` | Availability |
| `damages` | Availability, Integrity |
| `monitors` | Integrity, Non-Repudiation, Accountability** |

*Human Assets:*

| Beziehungstyp | Primäre Schutzziele |
|---|---|
| `is_an` | – (Protection Target Definition) |
| `affects_safety` | Availability, Integrity |
| `affects_privacy` | Confidentiality, Authorization, Accountability |
| `tracks` | Confidentiality, Authorization, Accountability |
| `exposes` | Confidentiality, Authentication, Accountability** |

> __'*'__ Confidentiality gilt nur wenn das Asset explizit als vertraulich klassifiziert ist:
>  - stores: bei sicherem Speicher (TPM, HSM, OP-TEE)
>  - is_an:  bei Prozessen mit Geschäftsgeheimnischarakter (z.B. proprietäre Fertigungsverfahren)
>
>  Die Annotation erfolgt im Modell als Asset-Eigenschaft   (secureStorage: true / businessSecret: true).

> __'**'__ Accountability gilt zusätzlich wenn das Asset oder der Kontext einen Personenbezug aufweist (DSGVO Art. 5 Abs. 2)
>   oder eine behördliche Nachweispflicht besteht.    Annotation im Modell: personalData: true

Das bedeutet: Schutzziele sind keine freie Wahl des Analysten – sie werden aus dem Modell abgeleitet und sind damit nachvollziehbar und auditierbar.

### 4.3 Data Assets
> **Lesehilfe Safety Impact (physicalImpact):** Der Wert in dieser Spalte ist primär aus der SafetyAnnotation
> im DFD-Tab abgeleitet (`derived`). Bei manuell gesetzten Werten (`manual`) ist eine Rationale
> im Modell hinterlegt und wird im Audit-Report verbatim dokumentiert (IEC 62443-4-1).
> HIGH = `fatality` oder `irreversible_injury`, MED = `indirect` (Hop 1), – = keine Annotation.

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Aggregiert |
|---|---|---|---|---|
| Fertigungsrezepte | Integrity, Confidentiality, Authentication | HIGH (Operational) | fatality | **CRITICAL** |
| Kalibrierungsdaten | Integrity, Availability, Authorization | HIGH (Operational) | irreversible_injury | **CRITICAL** |
| Produktionsdaten | Availability, Confidentiality, Accountability | MEDIUM (Financial) | – | **MEDIUM** |
| Maschinenstatus | Integrity, Availability | MEDIUM (Operational) | indirect | **HIGH** |
| Diagnosedaten | Confidentiality, Authorization | LOW | – | **LOW** |
| Safety-Parameter | Integrity, Availability, Authorization | HIGH (Operational) | indirect | **HIGH+** |

### 4.4 Process Assets

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Aggregiert |
|---|---|---|---|---|
| Zerspanungsprozess | Availability, Integrity, Authorization | HIGH (Operational) | fatality | **CRITICAL** |
| Not-Halt-Prozess | Availability, Integrity | HIGH (Operational) | fatality | **CRITICAL** |
| Einrichtbetrieb | Integrity, Authorization, Accountability | MEDIUM (Operational) | indirect | **HIGH+** |
| Qualitätsprüfung | Integrity, Non-Repudiation | MEDIUM (Financial) | – | **MEDIUM** |

### 4.5 System Assets

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Aggregiert |
|---|---|---|---|---|
| CNC-Maschine | Availability, Integrity, Authorization | HIGH (Operational) | fatality | **CRITICAL** |
| Roboter | Availability, Integrity, Authorization | HIGH (Operational) | indirect | **HIGH+** |
| Sicherheitssteuerung (SIS) | Availability, Integrity | HIGH (Operational) | fatality | **CRITICAL** |
| Leitsystem | Availability, Authentication, Authorization | HIGH (Operational) | indirect | **HIGH+** |

### 4.6 Infrastructure Assets

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Aggregiert | High-Value |
|---|---|---|---|---|---|
| Schutzumhausung | Availability, Integrity | HIGH (Operational) | indirect | **HIGH+** | – |
| Steuerungsschrank | Availability, Integrity, Authorization | HIGH (Operational) | indirect | **HIGH+** | ✅ 3-6m |
| CNC-Gehäuse | Integrity, Authorization | MEDIUM (Operational) | indirect | **HIGH** | – |
| OT-Netzwerkinfrastruktur | Availability, Authentication | HIGH (Operational) | indirect | **HIGH+** | – |
| CNC-Maschine (physisch) | Availability, Integrity, Authorization | HIGH (Operational) | indirect | **HIGH+** | ✅ >12m / CRITICAL |

> **High-Value Assets:** CNC-Maschine (physisch) und Steuerungsschrank sind als
> `isHighValueAsset` klassifiziert. Bei CNC-Maschine löst `assetDestructionImpact: 'critical'`
> den **High-Value Override** aus → Pflicht-Threats: Tampering, DoS, Physical Damage.
> Steuerungsschrank bleibt HIGH+ da `assetDestructionImpact: 'high'` (kein Override-Trigger).

### 4.7 Human Assets

| Asset | Schutzziele (CIANAAA) | Business Impact | Safety Impact | Protection Target | Aggregiert |
|---|---|---|---|---|---|
| Maschinenbediener | Availability (Safety) | – | fatality | ✅ | **CRITICAL** |
| Wartungstechniker | Availability (Safety) | – | fatality | ✅ | **CRITICAL** |
| NC-Programmierer | Availability (Safety), Confidentiality | MEDIUM (Privacy) | - | - | **HIGH** |
| Einrichter | Availability (Safety) | – | fatality | ✅ | **CRITICAL** |
| Mitarbeiter (allgemein) | Confidentiality, Authorization | MEDIUM (Privacy) | – | – | **MEDIUM** |

### 4.6 Ergebnis der Bewertung

Die Bewertung macht zwei Dinge sichtbar die ohne Graph nicht erkennbar wären:

Erstens: Von 23 identifizierten Assets sind 8 als CRITICAL eingestuft – wegen direktem
Safety-Impact (relevance: 'direct'). Weitere 8 Assets sind als HIGH+ eingestuft
da sie fatality oder irreversible_injury nur systemisch beeinflussen
(relevance: 'indirect'). Die Differenzierung stellt sicher dass Priorisierung
Trennschärfe behält: CRITICAL = direkter Steuerungseinfluss auf den Schaden,
HIGH+ = systemischer Einfluss der durch hohe Likelihood zu CRITICAL eskalieren kann.
Das bedeutet: Safety ist der dominierende Treiber der Risikopriorisierung in diesem System.

Zweitens: Die vier Human Assets als Protection Targets (Maschinenbediener, Einrichter,
Wartungstechniker, Patient) sind der Endpunkt aller Safety-Ketten. Der NC-Programmierer
ist bewusst kein Protection Target – er arbeitet nicht im Gefahrenbereich. Seine
Kritikalität ergibt sich aus der Verantwortung für sicherheitskritische Programmlogik
(Non-Repudiation, Accountability), nicht aus physischer Gefährdung.
Die Bewertung ist **begründet und rückverfolgbar**.

---

## 5. Erkenntnissprung: Was TARAflow sichtbar macht

Der entscheidende Unterschied zu klassischen Methoden zeigt sich erst im direkten Vergleich. TARAflow macht Zusammenhänge sichtbar die bei elementbasierter Analyse verborgen bleiben.

### 5.1 Beispiel: NC-Programm Upload

**Klassisch (STRIDE-naiv):**
```
DF "NC-Programm Upload" → Tampering (möglich)
                        → Information Disclosure (möglich)
```
Kein Schadensbezug, keine Priorisierung, kein Safety-Kontext.

**TARAflow:**
```
DF "send NC-Program [req]"
└─ transports → Data Asset "Fertigungsrezepte"
   └─ Integrity: CRITICAL, safety: { impact: 'fatality' }
   └─ gelesen von: □ CNC-Steuerung (via 🗄 Netzwerk-Share → 🗄 CNC-Filesystem)
       └─ affects_safety → Human Asset "Maschinenbediener" [Protection Target]

→ Threat: Tampering auf NC-Programm
→ Konsequenz: Falsche Werkzeugbewegung → Personengefährdung
→ Priorität: CRITICAL (Safety Override Rule: fatality → immer höchste Priorität)
→ Massnahme: Digitale Signatur + Integritätsprüfung vor Programmausführung
```

### 5.2 Beispiel: Remote Support als versteckter Safety-Angriffsvektor

**Klassisch:**
```
EE "Remote Support" → uses → CNC-Steuerung
→ Spoofing (möglich), Tampering (möglich)
```

**TARAflow:**
```
EE "Remote Support"
└─ uses [network] → System Asset "CNC-Maschine" [CRITICAL, physicalHazardPotential: high]
   └─ controls → Process "CNC-Achssteuerung"
       └─ affects_safety → Human Asset "Maschinenbediener" [fatality]

→ Was vorher unsichtbar war:
   Remote Support ist nicht nur ein IT-Risiko –
   er ist ein direkter Safety-Angriffsvektor.
   Kompromittierter VPN-Zugang → Fernsteuerung der CNC-Achsen
   → Unkontrollierte Werkzeugbewegung → Personengefährdung
```

### 5.3 Beispiel: Sicherheitssteuerung als Single Point of Safety-Failure

**Klassisch:** Sicherheitssteuerung als normaler Prozess – STRIDE wie alle anderen.

**TARAflow:**
```
Process "Sicherheitssteuerung"
├─ is_an      → Process Asset "Not-Halt-Prozess" [Availability: CRITICAL, fatality]
├─ terminates → Process Asset "Zerspanungsprozess"
├─ secures    → Infrastructure Asset "Schutzumhausung" [isPhysicalBarrier]
└─ monitors   → Infrastructure Asset "Schutzumhausung"

→ Was sichtbar wird:
   Die Sicherheitssteuerung ist der einzige Knoten der alle
   Safety-kritischen Funktionen zusammenhält.
   Denial of Service auf SIS = kein Not-Halt möglich = kein Schutz mehr.
   Das ist ohne Asset-Beziehungen nicht erkennbar.
```

---

## 6. Asset-Priorisierung: Fokus durch Kritikalität

TARAflow analysiert nicht alle Elemente gleich tief. Die Asset-Kritikalität steuert den Analyseaufwand proportional zum potenziellen Schaden. Das ist der Mechanismus der verhindert dass eine TARA im Overengineering endet.

### 6.1 Kritikalitätsbewertung CNC-Assets

| Asset | Business Impact | Physical Impact | Aggregiert | STRIDE-Tiefe |
|---|---|---|---|---|
| Fertigungsrezepte | HIGH (Operational) | fatality (Safety) | **CRITICAL** | Vertieft |
| Not-Halt-Prozess | HIGH (Operational) | fatality (Safety) | **CRITICAL** | Vertieft |
| CNC-Maschine (System) | HIGH (Operational) | fatality (Safety) | **CRITICAL** | Vertieft |
| Schutzumhausung | HIGH (Operational) | fatality (Safety) | **CRITICAL** | Vertieft |
| Kalibrierungsdaten | HIGH (Operational) | irreversible_injury | **CRITICAL** | Vertieft |
| Leitsystem | HIGH (Operational) | indirect | **HIGH** | Fokussiert |
| Produktionsdaten | MEDIUM (Financial) | – | **HIGH** | Fokussiert |
| Maschinenstatus | MEDIUM (Operational) | indirect | **MEDIUM** | Hochstufig |
| Diagnosedaten | LOW (Confidentiality) | – | **LOW** | Hochstufig |
| Zeiterfassungsdaten | MEDIUM (Privacy) | – | **MEDIUM** | Hochstufig |

### 6.2 Entscheidungsmatrix STRIDE-Tiefe

| Asset-Kritikalität | Trust Boundary | Attack Enabler | STRIDE-Tiefe | Beispiel CNC |
|---|---|---|---|---|
| CRITICAL | Ja | – | **Vertieft** | DF "send NC-Program [req]" |
| CRITICAL | Nein | – | **Fokussiert** | DataStore "NC-Programme" intern |
| HIGH | Ja | Ja | **Fokussiert** | Leitsystem via Remote-Access |
| HIGH | Nein | – | **Fokussiert** | Produktionsdaten intern |
| MEDIUM/LOW | Ja | – | **Fokussiert** | Diagnosedaten via VPN |
| MEDIUM/LOW | Nein | – | **Hochstufig** | Maschinenstatus intern |

### 6.3 Safety Override Rule

Assets mit `safetyImpact: 'fatality'` oder `safetyImpact: 'irreversible_injury'` erhalten automatisch die höchste Analysepriorität, unabhängig vom Business Impact. Ein Menschenleben ist nicht mit wirtschaftlichem Schaden verrechenbar (ISO 12100).

```
Beispiel Safety Override:
Diagnosedaten → Business Impact: LOW → STRIDE-Tiefe: Hochstufig (normal)

Not-Halt-Prozess → Business Impact: HIGH
                → Physical Impact: fatality
                → STRIDE-Tiefe: Vertieft (Safety Override greift!)
```

---

## 7. STRIDE-Analyse (Auszug)

Die folgenden Threats zeigen wie Asset-Beziehungen die STRIDE-Analyse direkt steuern. Jeder Threat ist vollständig rückverfolgbar bis zum Asset und seiner Safety-Konsequenz.

### Threat T-01: Manipulation NC-Programm

| Feld | Inhalt |
|---|---|
| **DFD-Element** | DF `send NC-Program [req]` |
| **Asset-Beziehung** | `transports → Data Asset "Fertigungsrezepte"` |
| **STRIDE-Kategorie** | Tampering |
| **CIANAAA-Verletzung** | Integrity, Authentication |
| **Schutzziel** | Fertigungsrezepte dürfen nicht unautorisiert verändert werden |
| **Angriffspfad** | Programmierer-Workstation kompromittiert → manipuliertes NC-Programm hochgeladen → CNC-Steuerung liest falsches Programm → unkontrollierte Achsbewegung |
| **Safety-Konsequenz** | `affects_safety → Human Asset "Maschinenbediener"` → fatality |
| **Priorität** | **CRITICAL** (Safety Override Rule) |
| **STRIDE-Tiefe** | Vertieft (Trust Boundary + CRITICAL Asset) |

### Threat T-02: Kompromittierung Remote-Zugang

| Feld | Inhalt |
|---|---|
| **DFD-Element** | EE `Remote Support` via DF `send diagnostics [req]` |
| **Asset-Beziehung** | `uses [network] → System Asset "CNC-Maschine"` |
| **STRIDE-Kategorie** | Spoofing + Elevation of Privilege |
| **CIANAAA-Verletzung** | Authentication, Authorization |
| **Schutzziel** | Nur autorisierter Remote-Zugriff auf Steuerungsfunktionen |
| **Angriffspfad** | VPN-Credentials kompromittiert → Angreifer übernimmt Remote-Support-Rolle → Fernsteuerung CNC-Achsen möglich |
| **Safety-Konsequenz** | `exposes → Human Asset "Maschinenbediener"` → fatality |
| **Priorität** | **CRITICAL** (Safety Override Rule) |
| **STRIDE-Tiefe** | Vertieft (Trust Boundary + CRITICAL Asset + Safety) |

### Threat T-03: Denial of Service Sicherheitssteuerung

| Feld | Inhalt |
|---|---|
| **DFD-Element** | Process `Sicherheitssteuerung (SIS)` |
| **Asset-Beziehung** | `is_an → Process Asset "Not-Halt-Prozess"` |
| **STRIDE-Kategorie** | Denial of Service |
| **CIANAAA-Verletzung** | Availability |
| **Schutzziel** | Not-Halt-Prozess muss jederzeit verfügbar und auslösbar sein |
| **Angriffspfad** | Netzwerk-Flooding auf OT-Segment → SIS nicht mehr erreichbar → Not-Halt kann nicht ausgelöst werden → Maschine läuft ohne Safety-Funktion |
| **Safety-Konsequenz** | `terminates → Process Asset "Zerspanungsprozess"` nicht mehr möglich → fatality |
| **Priorität** | **CRITICAL** (Safety Override Rule) |
| **STRIDE-Tiefe** | Vertieft (CRITICAL Asset + Safety) |

### Threat T-04: Unbefugter physischer Zugang Steuerungsschrank

| Feld | Inhalt |
|---|---|
| **DFD-Element** | EE `Wartungstechniker` |
| **Asset-Beziehung** | `accesses [internal] → Infrastructure Asset "Steuerungsschrank"` |
| **STRIDE-Kategorie** | Tampering |
| **CIANAAA-Verletzung** | Integrity, Availability, Authorization, Accountability |
| **Schutzziel** | Physischer Zugang zu Steuerungshardware nur für autorisiertes Personal |
| **Angriffspfad** | Ungesicherter Schrank → direkter Hardwarezugang → Manipulation SPS-Konfiguration oder Hardware-Implant einschleusen |
| **Safety-Konsequenz** | indirect via System Asset "CNC-Maschine" → fatality |
| **Priorität** | **HIGH** |
| **STRIDE-Tiefe** | Fokussiert |

---

## 8. Risk-Tabelle (Auszug)

| ID | Threat | Likelihood | Impact | Risk | Safety Override | Massnahme | Prio |
|---|---|---|---|---|---|---|---|
| T-01 | NC-Programm Manipulation | MEDIUM | CRITICAL | HIGH | ✅ fatality | Digitale Signatur NC-Programme, Integritätsprüfung vor Ausführung | **1** |
| T-02 | Remote-Zugang kompromittiert | HIGH | CRITICAL | CRITICAL | ✅ fatality | MFA, VPN mit Zertifikaten, Session-Monitoring, Least Privilege | **1** |
| T-03 | DoS Sicherheitssteuerung | MEDIUM | CRITICAL | HIGH | ✅ fatality | Netzwerksegmentierung SIS, dediziertes Safety-Netzwerk, Redundanz | **1** |
| T-04 | Physischer Zugang Schrank | LOW | HIGH | MEDIUM | – | Schloss mit Zugangskontrolle, Versiegelung, Zugangsprotokoll | **2** |
| T-05 | Manipulation Kalibrierungsdaten | LOW | CRITICAL | HIGH | ✅ irreversible_injury | Schreibschutz, Versionierung, Änderungsprotokoll mit Signatur | **1** |

**Safety Override Rule in der Praxis:**
T-01 hat Likelihood MEDIUM – klassisch wäre das Risk HIGH mit normaler Priorität. Durch die Safety Override Rule (fatality) wird es zu Priorität 1 unabhängig vom Business Impact. Diese Entscheidung ist methodisch begründet und auditierbar nach ISO 12100.

---

## 9. Der TARAflow-Graph als Single Source of Truth

Alle Asset-Beziehungen bilden zusammen einen gerichteten Graphen:

```
Knoten:  DFD-Elemente (Process, DataStore, EE, DF) + Assets (5 Kategorien)
Kanten:  typisierte Beziehungen (controls, depends_on, affects_safety, ...)
```

Dieser Graph ist die **einzige Datenquelle** – alle Diagramme und Dokumente werden daraus abgeleitet. Es gibt keine Redundanz, keine Inkonsistenz zwischen verschiedenen Dokumenten. Eine Änderung im Modell propagiert in alle Sichten gleichzeitig.

### 9.1 Der Graph als Analyse-Engine

Der entscheidende Unterschied zu einem Modellierungswerkzeug ist: TARAflow leitet Ergebnisse **regelbasiert** aus dem Graphen ab. Die Kanten sind formal typisiert – das ermöglicht regelbasierte Ableitungen ohne manuelle Interpretation.

**Regelbasierte Ableitungen** (methodisch definiert,, keine Analyst-Entscheidung):

| Auslöser im Graph | Automatische Ableitung |
|---|---|
| DF mit `transports` + Asset `Integrity: HIGH+` | Tampering als Pflicht-Threat |
| DF mit `transports` + Asset `Confidentiality: HIGH+` | Information Disclosure als Pflicht-Threat |
| EE mit `uses[network]` + Trust Boundary | Spoofing als Pflicht-Threat |
| Process mit `is_an` + Asset `Availability: CRITICAL` | DoS als Pflicht-Threat |
| Asset mit `safetyImpact: fatality` | riskPriority := 1, strideDepth := vertieft |
| Asset mit `safetyImpact: fatality` + Human Asset `isProtectionTarget` | Safety-Sicht Eintrag, Safety-Kette Dokumentation |
| DF überschreitet Trust Boundary ohne parentConduit | Validierungsfehler (ERROR) |
| SafetyAnnotation `impact: 'fatality'` auf Beziehung | `physicalImpact` := HIGH (derived) |
| SafetyAnnotation `impact: 'irreversible_injury'` auf Beziehung | `physicalImpact` := HIGH (derived) |
| Element Hop-1 zu Asset mit `physicalImpact` HIGH | `physicalImpact` := MED (derived, indirect) |
| `physicalImpact` manuell gesetzt ohne DFD-Annotation | Validierungswarnung + Rationale-Pflicht |
| `physicalImpactSource === 'manual'` im Audit-Export | Rationale verbatim dokumentiert |

**Heuristische Ableitungen** (Analyst-Entscheidung, durch Modell informiert aber nicht erzwungen):

| Entscheidung | Basis im Modell | Analyst-Anteil |
|---|---|---|
| Likelihood-Bewertung | Expositionsbewertung, Angreiferprofile (kontextabhängig) | Hoch |
| Attack Enabler Identifikation | Graph-Traversierung auf indirekte Pfade | Mittel |
| Massnahmen-Auswahl | Threat-Kategorie + Asset-Kritikalität | Mittel |
| Systemgrenze und Scope | Projektkontext | Hoch |

**Konsequenz:** TARAflow ist keine vollständig automatische Analyse – das wäre methodisch nicht seriös. Aber der regelbasierte Methodikkern stellt sicher dass keine
 Pflicht-Threats übersehen werden und alle Safety-kritischen Pfade vollständig dokumentiert sind. Der Analyst entscheidet dort wo Kontext nötig ist und nicht dort wo die Logik eindeutig ist.

### 9.2 Regelbasierte Diagrammgenerierung

Auch die Diagramme sind nicht frei gezeichnet sondern folgen Filterregeln auf dem Graphen:

---

## 10. Automatisch generierbare Diagramme

Die folgenden Sichten sind Filterabfragen auf denselben Graphen. Im DFD-Tab von TARAflow sind sie über ein Dropdown direkt zugänglich. Das Dropdown erscheint automatisch sobald genügend Modellinformation vorhanden ist. Alle Sichten sind read-only; bearbeitet wird ausschliesslich im Standard-DFD.

### 10.1 DFD (Standard-Sicht)

**Filter:** Alle DFD-Elemente und Datenflüsse  
**Zielgruppe:** Security Engineer, Entwickler  
**Zeigt:** Systemstruktur, Datenflüsse, Trust Boundaries

```
○ Remote Support ────────────────────────────────────→ uses[network]
                                                              ↓
○ Programmierer → [send NC-Program] → 🗄 Netzwerk-Share → □ CNC-Steuerung
─ ─ ─ ─ ─ ─ ─ Remote-Access-Grenze ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                                          □ Leitsystem (SCADA)
                                          □ Robotersteuerung
─ ─ ─ ─ ─ ─ ─ Safety-Grenze ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                               □ Sicherheitssteuerung (SIS)
                                 ↓ send emergencyStop [cmd]
                           CNC-Steuerung, Robotersteuerung
```

### 10.2 Systemarchitektur-Sicht

**Filter:** System Assets + Infrastructure Assets; Kanten: controls, depends_on, powers, secures  
**Zielgruppe:** Systemarchitekt, Management, Auditor  
**Zeigt:** Komponenten und ihre Abhängigkeiten, physische Infrastruktur

```
                    ┌─────────────────────┐
                    │  Leitsystem (SCADA) │
                    └──────┬──────┬───────┘
                    controls│      │controls
           ┌────────────────┘      └──────────────────┐
           ▼                                          ▼
┌──────────────────┐                      ┌───────────────────┐
│  CNC-Maschine   │◄──depends_on──────────│  Roboter          │
│  [CRITICAL] 🔴  │                       │  [CRITICAL] 🔴    │
└──────────┬───────┘                      └───────────────────┘
           │ physisch
           ▼
┌──────────────────┐   powers   ┌────────────────────────┐
│  CNC-Gehäuse    │◄────────────│  Steuerungsschrank     │
│  [Infrastructure]│            │  [Infrastructure]      │
└──────────────────┘            └────────────────────────┘
           │ secures
           ▼
┌──────────────────┐
│  Schutzumhausung │
│  ⚠️ Safety Barrier│
│  [fatality] 🔴   │
└──────────────────┘
```

### 10.3 Safety-Sicht

**Filter:** Nur safety-annotierte Knoten und Kanten; Hervorhebung von Protection Targets  
**Zielgruppe:** Safety Engineer, Auditor (EN 50742, ISO 12100)  
**Zeigt:** Alle sicherheitsrelevanten Pfade zum Menschen als Schutzobjekt

```
┌─────────────────────────────────────────────────────────────────┐
│  SAFETY-KRITISCHE PFADE                   🔴 = fatality risk    │
└─────────────────────────────────────────────────────────────────┘

□ CNC-Achssteuerung ──affects_safety──→ 👤 Maschinenbediener 🔴
□ Robotersteuerung  ──affects_safety──→ 👤 Maschinenbediener 🔴
□ Remote-Diagnose   ──exposes─────────→ 👤 Maschinenbediener 🔴
🏗 Schutzumhausung  ──[Safety Barrier]─→ 👤 Maschinenbediener 🔴

Kritische Kette (T-01):
○ Programmierer → 🗄 Netzwerk-Share → 📄 Fertigungsrezepte → □ CNC-Steuerung
                                                                    └─ affects_safety → 👤 🔴

Kritische Kette (T-02):
○ Remote Support → □ Leitsystem → □ CNC-Achssteuerung
                                       └─ affects_safety → 👤 🔴
```

### 10.4 Angriffsflächen-Sicht

**Filter:** External Entities + ihre Verbindungen; Kanten: uses[*], accesses[*]  
**Zielgruppe:** Security Engineer, Penetration Tester  
**Zeigt:** Einstiegspunkte und Angriffsvektoren mit Bewertung

```
○ Remote Support    ──uses[network]──→ □ CNC-Steuerung      ⚠️ CRITICAL
                                     ──→ □ Leitsystem         ⚠️ CRITICAL

○ Programmierer     ──transports──→ 📄 Fertigungsrezepte     ⚠️ CRITICAL
                                       (Safety-kritisch!)

○ Operator          ──────────────→ □ Einrichtbetrieb        ⚠️ HIGH

○ Wartungstechniker ──accesses[local]────→ 🏗 CNC-Maschine   ⚠️ HIGH
                    ──accesses[internal]──→ 🏗 Steuerungsschrank ⚠️ HIGH

Zusammenfassung: 4 EEs | 8 Vektoren | 3 CRITICAL mit Safety-Relevanz
```

### 10.5 Datenpfad-Sicht

**Filter:** Data Assets + ihre Träger; Kanten: creates, reads, modifies, transports  
**Zielgruppe:** Security Engineer, Datenschutzbeauftragter  
**Zeigt:** Datenflüsse, Kritikalität und Zugriffsmuster

```
📄 Fertigungsrezepte [Integrity: CRITICAL] 🔴
   creates:    ○ Programmierer
   stores:     🗄 Netzwerk-Share, 🗄 CNC-Filesystem
   transports: DF "send NC-Program [req]"
   reads:      □ CNC-Steuerung

📄 Kalibrierungsdaten [Integrity: CRITICAL] 🔴
   stores:     🗄 CNC-Filesystem
   reads:      □ CNC-Steuerung
   modifies:   ○ Wartungstechniker (via Interface)

📄 Maschinenstatus [Availability: HIGH]
   creates:    □ CNC-Steuerung
   transports: DF "stream machineStatus [stream]"
   reads:      □ Leitsystem

📄 Produktionsdaten [Availability: HIGH]
   creates:    □ Leitsystem
   stores:     🗄 Historian-Datenbank
```

### 10.6 Abhängigkeits-Sicht

**Filter:** System + Process Assets; Kanten: depends_on  
**Zielgruppe:** Management, Business Continuity  
**Zeigt:** Kaskadeneffekte bei Ausfall, Single Points of Failure

```
□ CNC-Steuerung + Robotersteuerung
  └─ depends_on → □ Leitsystem
      └─ Ausfall → gesamte Fertigung steht (Business Critical)

□ CNC-Steuerung + Robotersteuerung
  └─ depends_on → □ Sicherheitssteuerung (SIS)
      └─ Ausfall → kein Not-Halt möglich (SAFETY CRITICAL) 🔴

Single Points of Failure:
  □ Leitsystem  → Business Critical (Produktionsstillstand)
  □ SIS         → Safety Critical (kein Personenschutz) 🔴
```

---

## 11. Warum ein Graph – nicht viele Dokumente

Der zentrale Vorteil von TARAflow liegt in der **einmaligen Modellierung** mit **mehrfacher Nutzung**:

| Deliverable | Manuelle Erstellung | TARAflow |
|---|---|---|
| DFD | Manuell zeichnen | ✅ Eingabe-Diagramm |
| Systemarchitektur | Separat erstellen | ✅ Automatisch aus Graph |
| Safety-Nachweis (EN 50742) | Manuell dokumentieren | ✅ Automatisch aus Graph |
| Asset-Inventar (IEC 62443) | Separat pflegen | ✅ Automatisch aus Graph |
| Angriffsflächen-Analyse | Separate Analyse | ✅ Automatisch aus Graph |
| TARA-Dokumentation | Manuell erstellen | ✅ Kern-Output |
| Risk-Tabelle | Manuell erstellen | ✅ Aus Threat-Analyse |
| Abhängigkeitsanalyse | Separate FMEA | ✅ Automatisch aus Graph |

**Konsequenz:** Eine Änderung im Modell propagiert automatisch in alle Sichten und Dokumente. Kein Synchronisationsaufwand, keine Inkonsistenz, kein Mehraufwand bei Systemänderungen.

---

## 12. Safety-Integration als Alleinstellungsmerkmal

Das CNC-Beispiel zeigt deutlich: Safety und Security sind nicht trennbar. TARAflow ist das einzige Threat-Modeling-Framework das diese Kette durchgängig und explizit modelliert.

### Die vollständige Safety-Kette im Graphen

```
Angriff auf NC-Programm (Cyber-Bedrohung)
         ↓  transports [Integrity verletzt]
Manipulation Fertigungsrezepte (Data Asset)
         ↓  reads
Fehlerhafter Bewegungsablauf (Process Asset)
         ↓  affects_safety
Unkontrollierte Maschinenbewegung (System Asset)
         ↓  secures [Schutzfunktion versagt]
Versagen Schutzumhausung (Infrastructure Asset)
         ↓  exposes
Körperverletzung / Tod (Human Asset – Protection Target) 🔴
```

Jeder Schritt dieser Kette ist im Graph explizit modelliert. Daraus folgt automatisch die höchste Threat-Priorität – begründet, auditierbar, normkonform.

### Safety Override Rule

Assets mit `safetyImpact: 'fatality'` erhalten automatisch die höchste Risikoprioritäts – unabhängig von Business Impact oder Likelihood. Ein Menschenleben ist nicht mit wirtschaftlichem Schaden verrechenbar (ISO 12100 Prinzip). TARAflow setzt diese Regel automatisch durch und dokumentiert sie für den Audit.

---

## 13. Positionierung gegenüber anderen Tools

| Kriterium | Klassisch STRIDE | IriusRisk | TARAflow |
|---|---|---|---|
| Ansatz | Element → generische Threats | Regelbasiert (Threat Library) | Graphbasiert (Asset → Beziehungen → Threats) |
| Safety-Integration | Nicht vorhanden | Nicht vorhanden | Kern-Feature |
| Rückverfolgbarkeit | Keine | Eingeschränkt | Vollständig |
| Priorisierung | Manuell, subjektiv | Regelbasiert | Asset-Kritikalität + Safety Override |
| Diagramm-Generierung | Manuell | Manuell | Automatisch aus Graph |
| Norm-Fokus | Keine | IEC 62443-2-x | IEC 62443-4-1/4-2, CRA |
| Zielgruppe | Alle | Integratoren | Hersteller, Consultants |

---

## 14. Nächste Schritte mit diesem Referenzfall

1. **Graph vervollständigen** – alle Asset-Beziehungen formal definieren und in TARAflow erfassen
2. **STRIDE vollständig** – alle Threats für CRITICAL und HIGH Assets systematisch ableiten
3. **Attack Trees** – für T-01 und T-02 als Beispiel für Phase 3 TARAflow
4. **Massnahmen vollständig** – alle Threats mit konkreten Massnahmen und Normnachweis
5. **Export** – alle Diagramme und Dokumente automatisch aus dem Graph generieren
6. **Vortrag** – Referenzfall als Live-Demo in TARAflow mit allen Diagramm-Sichten

Dieser Referenzfall ist der primäre Testfall für alle TARAflow-Features und dient als Demonstrationsgrundlage für Kunden, Consultants und Auditoren.

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>
