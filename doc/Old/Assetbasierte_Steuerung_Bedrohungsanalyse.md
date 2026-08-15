## Assetbasierte Steuerung der Bedrohungsanalyse

### Ziel und Zweck

Ziel der assetbasierten Steuerung innerhalb des Threat-Modeling- bzw. TARA-Prozesses ist es, eine vollständige, nachvollziehbare und risikoorientierte Bedrohungsanalyse sicherzustellen. Der Ansatz ermöglicht es, sicherheitsrelevante Systembestandteile gezielt zu identifizieren und den Analyseaufwand proportional zum potenziellen Schadensausmass zu gestalten.

---

### Begriffsdefinitionen

- **Asset**  
  Ein Asset ist ein schützenswertes Gut, dessen Verlust, Manipulation oder Beeinträchtigung zu einem unerwünschten Schaden führen kann. Dies umfasst insbesondere funktionale, informationelle, softwarebasierte und physische Assets.

- **DFD-Element**  
  Ein DFD-Element beschreibt eine logische oder physische Komponente des Systems (z. B. Prozess, Datenablage, externe Entität).

- **Data Flow**  
  Ein Data Flow beschreibt den gerichteten Austausch von Daten oder Signalen zwischen DFD-Elementen.

- **Asset-Kritikalität**  
  Die Asset-Kritikalität beschreibt das potenzielle Schadensausmass bei Beeinträchtigung eines Assets und wird anhand definierter Impact-Dimensionen bewertet. Die Bewertung erfolgt flexibel über projektspezifische Dimensionen, unterteilt in Business Impact (z. B. Financial, Operational, Privacy) und Physical Impact (z. B. Safety).

---

### Standardisierte Benennung von Data Flows und Request/Response-Regeln

#### Ziel und Zweck

Zur konsistenten Modellierung von Data Flows innerhalb des DFD wird ein **verbindliches Naming-Konzept** angewendet. Dies dient der **Eindeutigkeit, Nachvollziehbarkeit und Automatisierung** der Bedrohungsanalyse. Durch die klare Trennung von Flussrichtung, Semantik und Typ können Threats systematisch abgeleitet und Tool-Unterstützung (z. B. Linting oder automatische STRIDE-Mapping) effektiv genutzt werden.

---

#### Benennungskonvention

Jeder Data Flow wird nach folgendem **Schema** benannt:

```txt
<verb> <object> [<flow-type>]
```

- **Verb**  
  Definiert die Art der Kommunikation oder Aktion:
  - `send` – aktive Übertragung eines Befehls oder Requests
  - `recv` – Empfang von Daten, Responses oder Events
  - `pull` – explizite Anforderung eines Assets oder einer Ressource
  - `stream` – kontinuierliche, fortlaufende Datenübertragung

- **Object**  
  Beschreibt das transportierte Asset oder die payload-spezifische Entität (z. B. `cmd`, `event`, `config`, `metrics`).

- **Flow-Type**  
  Optional, aber empfohlen zur semantischen Differenzierung:
  - `[cmd]` – Steuerbefehle
  - `[req]` – Request
  - `[resp]` – Response
  - `[push]` – ungefragte Zustellung
  - `[stream]` – kontinuierlicher Datenstrom

**Beispiele:**

```txt
send cmd reboot [cmd]
pull config [req]
recv response [resp]
recv event orderPlaced [push]
```
---

#### Request/Response-Regel

Für alle Data Flows gilt die **unidirektionale Modellierung**. Zusätzlich wird für **Request-typisierte Flows (`[req]`)** eine **explizite Response (`[resp]`)** erzwungen:

| Request Flow | Response Flow | Bemerkung |
|-------------|---------------|------------|
| `send … [req]` | `recv … [resp]` | Muss existieren; Response darf nicht implizit sein |
| `pull … [req]` | `recv … [resp]` | Muss existieren; mehrere Responses (z. B. OK/Error) sind erlaubt |

- **Verbot bidirektionaler Pfeile:** Ein Request-Response-Paar wird durch zwei **eindeutige, unidirektionale Flows** modelliert.
- **Async / Delayed Responses:** Zeitliche Verzögerungen sind zulässig, solange die Kausalität erkennbar bleibt.
- **Mehrfach-Responses:** Optional, z. B. reguläre Antwort plus Fehlerantwort.  

---

#### Pub/Sub und spezielle Kommunikationsmuster

Für Publish/Subscribe-Flows gelten besondere Regeln:

| Phase | Label-Beispiel | Flow-Type | Bemerkung |
|-------|----------------|-----------|-----------|
| Subscribe / Registration | `send subscribe orders [cmd]` | `[cmd]` | Response nicht zwingend |
| Event Delivery | `recv event orderPlaced [push]` | `[push]` | Response nicht zwingend |
| Ack / Confirmation (optional) | `send ack orderPlaced [cmd]` | `[cmd]` | Optional |

**Hinweis:** `recv … [push]` Flows ohne vorheriges `send subscribe … [cmd]` erzeugen Tool-Warnungen, um die Kausalität und Vollständigkeit sicherzustellen.

---

#### Vorteile dieser Regeln

- **Klarheit:** Jede Richtung wird explizit modelliert und kann getrennt bewertet werden.
- **Automatisierung:** Threat-Vorlagen und STRIDE-Mappings lassen sich direkt an Flow-Typen koppeln.
- **Nachvollziehbarkeit:** Request/Response-Beziehungen sind jederzeit prüfbar.
- **Fehlerprävention:** Implizite oder bidirektionale Flows werden vermieden, wodurch systematische Blind Spots reduziert werden.

---

### Asset-Kategorien

Assets werden zur systematischen Erfassung in folgende Kategorien eingeteilt:

- **📄 Daten**  
  Informationsassets wie Sensordaten, Produktionsdaten, Konfigurationsdaten, Protokolle, personenbezogene Daten

- **💻 Systeme**  
  Technische Systeme und Komponenten wie Server, APIs, SCADA-Systeme, Cloud-Services, Datenbanken, Embedded Systems, Kontrollsysteme

- **🏭 Infrastruktur**  
  Physische Assets wie Maschinen, Produktionsanlagen, Netzwerkgeräte, physische Sicherheitssysteme

- **🔄 Prozesse**  
  Geschäfts- und technische Prozesse wie Firmware-Update-Mechanismen, Betriebshandbücher, Standard Operating Procedures (SOPs), Notfallpläne

- **👤 Menschen**  
  Rollen und Personengruppen wie Operatoren, Administratoren, Wartungspersonal, Verantwortliche, externe Dienstleister

Diese Kategorisierung unterstützt die strukturierte Asset-Identifikation und erleichtert die systematische Bewertung sowie Vollständigkeitsprüfung.

---

### Vollständigkeit der Asset-Erfassung

Im Rahmen des TARA-Prozesses werden grundsätzlich **alle identifizierbaren Assets des Systems erfasst**.  
Die vollständige Erfassung dient primär dem systematischen Scoping. Assets, die in allen Impact-Kategorien (Business & Physical) mit 'Negligible' (unbedeutend) bewertet wurden, führen zum automatischen Ausschluss der assoziierten DFD-Elemente von der vertieften Bedrohungsanalyse. Dies stellt sicher, dass der Analyseaufwand fokussiert auf die kritischen Systembestandteile gelenkt wird.

Die Erfassung eines Assets impliziert jedoch **keine automatische Verpflichtung** zu einer vertieften Bedrohungsanalyse.

#### Begründung aus Risiko- und Compliance-Perspektive

Die vollständige Erfassung aller identifizierbaren Assets ist sowohl aus risikobasierter als auch aus regulatorischer Sicht erforderlich. Zahlreiche Standards und regulatorische Rahmenwerke (z. B. ISO/IEC 27001, IEC 62443, Cyber Resilience Act) verlangen den Nachweis, dass sicherheitsrelevante Assets systematisch identifiziert und bewertet wurden.

Die dokumentierte Asset-Erfassung dient dabei insbesondere:

- dem Nachweis methodischer Vollständigkeit gegenüber Auditoren und Behörden,  
- der nachvollziehbaren Priorisierung von Analyse- und Schutzmassnahmen,  
- der Unterstützung späterer Re-Assessments bei Systemänderungen oder neuen Bedrohungslagen,  
- der Sicherstellung, dass im Lebenszyklus des Systems keine sicherheitsrelevanten Assets unbeabsichtigt unberücksichtigt bleiben.

Die vollständige Asset-Erfassung stellt somit eine **notwendige Grundlage** für eine risikoorientierte Bedrohungsanalyse dar, ohne eine automatische Verpflichtung zur vertieften Analyse aller Assets zu begründen.


---

### Trennung von Struktur- und Wirkungssicht

Die Bedrohungsanalyse basiert auf zwei komplementären Sichten:

- **Strukturelle Sicht**  
  Abgebildet durch das Data Flow Diagramm (DFD), welches Systemelemente, Data Flows und Systemgrenzen beschreibt.

- **Wirkungssicht**  
  Abgebildet durch die Asset-Bewertung, welche die potenziellen Auswirkungen eines erfolgreichen Angriffs beschreibt.

Beide Sichten werden zunächst getrennt erhoben und anschliessend systematisch korreliert.

---

### Iterativer Prozess: DFD-Phase und Asset-Bewertungsphase

Die assetbasierte Bedrohungsanalyse erfolgt in einem **iterativen Zwei-Phasen-Prozess**:

#### DFD-Phase

- Erstellung oder Aktualisierung des Data Flow Diagramms
- Strukturelle Erfassung aller Systemkomponenten, Datenflüsse und Systemgrenzen
- Initiale Identifikation von Assets innerhalb der DFD-Elemente

#### Asset-Bewertungsphase

- Systematische Identifikation aller schützenswerten Assets (DFD-basiert und unabhängig)
- Bewertung der Asset-Kritikalität anhand definierter Impact-Dimensionen
- Identifikation bisher nicht berücksichtigter Assets

#### Rückkopplung

Bei Identifikation neuer Assets in der Asset-Bewertungsphase erfolgt eine **Rückkehr in die DFD-Phase**, um die Zuordnung zu DFD-Elementen und Data Flows zu dokumentieren.

Dieser iterative Prozess wird so lange fortgesetzt, bis sowohl strukturelle als auch wirkungsbezogene Vollständigkeit erreicht ist.

---

### Asset-Bewertung

Für jedes Asset wird eine Kritikalitätsbewertung durchgeführt.  
Diese berücksichtigt mindestens folgende Impact-Dimensionen:

#### Business Impact / Organisatorische Kriterien

- **Betroffene Nutzer/Systeme**  
  Wie viele Nutzer oder Systeme wären direkt beeinträchtigt?

- **Financial Damage**  
  Welche Kosten entstehen bei Ausfall oder Angriff? (direkte und indirekte finanzielle Schäden)

- **Regulatory/Compliance**  
  Risiken von DSGVO/FDA/Normen-Verstössen oder anderen regulatorischen Anforderungen

- **Reputation/Brand**  
  Vertrauensverlust bei Kunden oder Partnern; Auswirkungen auf Markenimage

- **Operational Impact**  
  Beeinträchtigung kritischer Geschäftsprozesse, Produktionsausfälle, Serviceunterbrechungen

- **Recoverability**  
  Aufwand und Zeit zur Wiederherstellung des Assets oder seiner Funktion

#### Physical Impact / Physische Kriterien

- **Safety Impact**  
  Physische Gefahr für Menschen/Anlagen; Verletzungsrisiken, Gefahr für Leib und Leben

- **Physical Asset Damage**  
  Beschädigung oder Zerstörung von Maschinen, Anlagen, Gebäuden

- **Environmental Impact**  
  Risiken für Umwelt (Chemie, Energie, Wasser); Wasser- oder Luftverschmutzung

- **Supply Chain / Logistics**  
  Ausfall Liefer- oder Transportketten; Unterbrechung der Versorgungssicherheit

#### Bewertungsmethodik

Die aggregierte Asset-Kritikalität wird durch Bewertung aller relevanten Kriterien ermittelt. Die Gewichtung der einzelnen Kriterien ist projektspezifisch festzulegen und kann sich nach regulatorischen Anforderungen, Unternehmensprioritäten oder Stakeholder-Erwartungen richten.

Die Asset-Kritikalität dient als massgebliche Entscheidungsgrundlage für die Priorisierung der Bedrohungsanalyse.

---

### Korrelation von DFD und Asset-Bewertung

Jedem DFD-Element und jedem Data Flow können ein oder mehrere Assets zugeordnet werden.  
Zusätzlich wird für Data Flows festgelegt, ob sie eine Trust Boundary überschreiten.

Die Zuordnung erfolgt bidirektional:

- **Von Assets zu DFD-Elementen**: Welche DFD-Elementen tangieren ein bestimmtes Asset?
- **Von DFD-Elementen zu Assets**: Welche Assets werden durch ein bestimmtes DFD-Element tangiert?

Diese bidirektionale Validierung stellt sicher, dass keine relevanten Beziehungen übersehen werden.

---

### Zuordnungskriterien

Die Zuordnung eines **Assets** zu einem **DFD-Element** oder **Data Flow** erfolgt anhand der folgenden Kriterien. Jede Beziehung kann als potenzieller Angriffsvektor betrachtet und in **Attack Trees (AT)** und **STRIDE Threats** abgebildet werden.

#### 0. Element selbst ist ein Asset (is_an / Asset Representation)

Das DFD-Element **repräsentiert selbst ein Asset**. Risiken ergeben sich durch die Kompromittierung des Elements selbst, unabhängig davon, wie das Asset verarbeitet wird.

**Beispiele**:

- Auth-Service ist selbst kritisches System (Asset: "Authentication Service")  
- Datenbankserver als Systemkomponente (Asset: "Database System")  
- Hardware-Sicherheitsmodul (HSM) (Asset: "Secure Key Storage")  

**Mögliche STRIDE-Threats:** Spoofing, Tampering, Denial of Service, Information Disclosure  
**AT-Integration:** Prüfen, wie ein Angreifer das Element direkt angreifen kann, um das Asset zu kompromittieren.

---

#### 1. Element speichert das Asset

Das DFD-Element dient als **persistente Ablage** für das Asset. Risiken können durch unbefugten Zugriff, Datenverlust oder Manipulation entstehen.

**Beispiele**:

- Datenbank speichert Nutzerdaten (Asset: "Personenbezogene Daten")  
- Konfigurationsdatei speichert Zugangsdaten (Asset: "Credentials")  
- Flash-Speicher hält Firmware-Images (Asset: "Firmware-Integrität")  

**Mögliche STRIDE-Threats:** **I**nformation Disclosure, **T**ampering, **D**enial of Service  
**AT-Integration:** Prüfen, wie ein Angreifer auf gespeicherte Assets zugreifen und sie manipulieren könnte.  


#### 2a. Element verarbeitet das Asset (Process – read/compute)

Das DFD-Element **liest oder nutzt das Asset** und erzeugt daraus neue, abgeleitete Informationen, ohne das Original-Asset zu verändern.

**Beispiele:**

- Parser liest Eingabedaten (Asset: "Benutzereingaben")  
- Monitoring-Modul berechnet aggregierte Sensordaten (Asset: "Prozessdaten")  
- Berechnung eines Hashwerts aus Schlüsseldaten (Asset: "Kryptographische Schlüssel")  

**Mögliche STRIDE-Threats:** Information Disclosure  
**AT-Integration:** Prüfen, wie ein Angreifer abgeleitete Daten missbrauchen könnte, ohne das Original-Asset zu verändern.  

#### 2b. Element verarbeitet das Asset (Process – modify/change)

Das DFD-Element **verändert oder überschreibt das Asset** aktiv. Hier besteht ein höheres Risiko für Manipulation und Integritätsverletzungen.

**Beispiele:**

- Kryptographie-Modul transformiert Schlüsselmaterial (Asset: "Kryptographische Schlüssel")  
- Safety-Controller berechnet kritische Steuersignale (Asset: "Safety-Funktion")  
- Firmware-Update-Prozess schreibt über bestehendes Firmware-Image (Asset: "Firmware-Integrität")  

**Mögliche STRIDE-Threats:** Tampering, Integrity Threats  
**AT-Integration:** Prüfen, wie ein Angreifer Asset manipulieren oder falsche Werte einspeisen könnte.  

#### 3. Element erzeugt das Asset (Create)

Das DFD-Element ist **Ursprung im Lebenszyklus** des Assets. Angriffe können die Integrität der Erstellung gefährden.

**Beispiele:**

- Key-Generator erzeugt kryptographische Schlüssel (Asset: "Schlüsselmaterial") → Create  
- Sensor erzeugt Messdaten (Asset: "Prozessdaten") → Create  

**Mögliche STRIDE-Threats:** Spoofing, Tampering, Denial of Service  
**AT-Integration:** Prüfen, wie ein Angreifer die Erstellung des Assets beeinflussen oder manipulieren könnte.

#### 4. Element vernichtet das Asset (Destroy)

Das DFD-Element ist **Endpunkt im Lebenszyklus** des Assets. Angriffe können die Integrität oder Verfügbarkeit der Vernichtung gefährden.

**Beispiele:**

- Secure Delete-Funktion vernichtet sensitive Daten (Asset: "Confidential Information") → Destroy  

**Mögliche STRIDE-Threats:** Tampering, Denial of Service  
**AT-Integration:** Prüfen, wie ein Angreifer die Vernichtung umgehen oder verhindern könnte.

#### 5. Element transportiert das Asset (Transport)

Das Asset wird **zwischen DFD-Elementen verschoben**, z. B. über Netzwerk oder interne Busse. Risiken entstehen durch Abhörung, Injection oder Replay.

**Beispiele:**

- CAN-Bus transportiert Sensordaten (Asset: "Prozessdaten")  
- Web-Service überträgt Nutzerdaten (Asset: "Personenbezogene Daten")  

**Mögliche STRIDE-Threats:** Information Disclosure, Tampering, Repudiation  
**AT-Integration:** Prüfen, wie ein Angreifer die Übertragung abfangen oder manipulieren kann.  

---

### Indirekte Gefährdung von Assets / Attack Enabler

Ein DFD-Element kann **keine direkte funktionale Beziehung** zu einem Asset haben, aber durch seine Kompromittierung trotzdem Angriffe ermöglichen.

**Beispiele**:

- Logging-Service: Kompromittierung ermöglicht Verschleierung von Angriffen auf andere Assets
- Debug-Interface: Ermöglicht unbefugten Zugriff auf geschützte Systemfunktionen
- Netzwerk-Routing-Komponente: Ermöglicht Man-in-the-Middle-Angriffe auf übertragene Assets

**AT-Integration:** Prüfen, wie Angreifer die indirekte Rolle des Elements ausnutzen könnten, um andere Assets zu kompromittieren.

**Hinweis:** Diese indirekten Gefährdungen werden separat dokumentiert und in der Bedrohungsanalyse als **Attack Enabler** behandelt.

---

### Data Flow Granularität

Für Data Flows gilt: **Ein Data Flow transportiert primär ein Asset**.

- Mehrere Assets mit unterschiedlicher Kritikalität → Flow aufspalten  
- Ausnahme: technisch untrennbare Kombinationen → als **Composite Asset** mit höchster Kritikalität bewerten

**Zusatzregel:**

- Data Flows können **nur `transport`-Beziehungen** zum Asset haben  
- Alle anderen Beziehungen (`read`, `modify`, `store`, `delete`, `create`) werden **erst beim Process oder Data Store** modelliert

---

### Behandlung von DFD-Elementen ohne direkten Asset-Bezug

DFD-Elemente ohne direkten Asset-Bezug werden **nicht automatisch von der Analyse ausgeschlossen**.

Folgende Elemente werden auch ohne Asset-Zuordnung analysiert:

- Elemente, die Trust Boundaries überschreiten
- Elemente mit privilegierten Funktionen oder Zugriff auf kritische Systemressourcen
- Elemente, die als Attack Enabler für andere Komponenten dienen können

Die Entscheidung, solche Elemente zu analysieren, wird dokumentiert und begründet.

---

### Praktische Umsetzung der Asset-Markierung

#### Vollständige Erfassung im DFD

Alle identifizierten Assets werden **im Data Flow Diagramm markiert**, unabhängig von ihrer späteren Kritikalitätsbewertung.

Dies erfolgt durch:

- Kennzeichnung von DFD-Elementen mit Asset-Nummern oder Asset-Labels
- Visuelle Marker (z. B. Icons, Farben, Annotationen)
- Zuordnungstabellen, die Asset-ID mit DFD-Element-ID verknüpfen

**Begründung**: Zum Zeitpunkt der DFD-Erstellung ist die finale Asset-Kritikalität noch nicht bekannt. Die vollständige Markierung stellt sicher, dass keine Assets übersehen werden.

#### Dokumentation aller Assets

Alle erfassten Assets werden in der Systemdokumentation aufgeführt, einschliesslich:

- Asset-Kategorie (Daten, Systeme, Infrastruktur, Prozesse, Menschen)
- Kritikalitätsbewertung (basierend auf Business- und Physical-Impact-Kriterien)
- Zuordnung zu DFD-Elementen
- Begründung der Kritikalitätsbewertung

#### Priorisierte Analyse

Nur Assets mit **hoher oder kritischer Bewertung** fliessen in die vertieften Analyseschritte ein:

- **Detaillierte Threat-Tabellen** (STRIDE-Analyse)
- **Risk-Tabellen** (Risikoeinschätzung und Massnahmenplanung)
- **Attack Trees** (Angriffspfad-Modellierung)

Assets mit niedriger oder mittlerer Kritikalität:

- Werden dokumentiert und im DFD markiert
- Unterliegen einer hochstufigen STRIDE-Bewertung
- Fliessen nicht in detaillierte Attack Trees ein
- Können bei Re-Assessment oder Systemänderungen neu bewertet werden

#### Vorteile dieses Ansatzes

- **Vollständigkeit**: Keine Assets werden übersehen
- **Effizienz**: Analyseaufwand wird auf kritische Assets fokussiert
- **Nachvollziehbarkeit**: Die Entscheidung, warum ein Asset nicht vertieft analysiert wurde, ist transparent und dokumentiert
- **Flexibilität**: Assets können bei Neubewertung "hochgestuft" werden, ohne dass das DFD neu erstellt werden muss

---

### Ableitung der Analysepriorität

Die Priorisierung der Bedrohungsanalyse erfolgt auf Basis folgender Kriterien:

- Kritikalität der zugeordneten Assets
- Exponiertheit des DFD-Elements bzw. Data Flows (z. B. Trust Boundary)
- Rolle als Attack Enabler für kritische Assets

Der Asset-Bezug dient hierbei als **Priorisierungsmechanismus**, nicht als Ausschlusskriterium.

---

### Steuerung der STRIDE-Analyse

Abhängig von der ermittelten Priorität werden unterschiedliche Analyse-Tiefen angewendet:

- **Vertiefte STRIDE-Analyse**  
  Für DFD-Elemente und Data Flows mit Bezug zu hochkritischen oder sicherheitsrelevanten Assets.

- **Fokussierte STRIDE-Analyse**  
  Für interne Systemelemente mit Asset-Bezug, jedoch ohne erhöhte Exponiertheit.

- **Hochstufige STRIDE-Bewertung**  
  Für Elemente mit geringer Asset-Kritikalität oder rein unterstützender Funktion.

Die Auswahl der Analyse-Tiefe ist zu dokumentieren und nachvollziehbar zu begründen.

#### Entscheidungsmatrix STRIDE-Tiefe (Beispiel)

Die folgende Matrix dient als **Orientierungsbeispiel** für die systematische Ableitung der STRIDE-Analyse-Tiefe. Die konkreten Schwellenwerte für Asset-Kritikalität sind projektspezifisch zu definieren und an die jeweiligen Rahmenbedingungen anzupassen.

### Entscheidungsmatrix zur Steuerung der STRIDE-Analyse (erweitert)

| Asset-Kritikalität | Trust Boundary überschritten | Attack Enabler | STRIDE-Tiefe | Begründung / Dokumentation |
|-------------------|------------------------------|----------------|--------------|----------------------------|
| Hoch / Kritisch   | Ja                           | –              | Vertieft     | Hochkritisches Asset mit direkter externer Exposition erfordert eine vollständige STRIDE-Analyse aller relevanten Bedrohungskategorien |
| Hoch / Kritisch   | Nein                         | –              | Fokussiert   | Hochkritisches Asset ohne direkte Exposition; Analyse fokussiert auf relevante interne Bedrohungen |
| Mittel            | Ja                           | Ja             | Fokussiert   | Exponiertes Element mit Attack-Enabler-Funktion erfordert gezielte Analyse potenzieller Angriffspfade |
| Mittel            | Ja                           | Nein           | Fokussiert   | Externe Exposition bei mittlerer Kritikalität rechtfertigt eine fokussierte Bedrohungsanalyse |
| Mittel            | Nein                         | Ja             | Fokussiert   | Attack-Enabler-Funktion erfordert Analyse trotz fehlender direkter Exposition |
| Mittel            | Nein                         | Nein           | Hochstufig   | Internes Element mit mittlerer Kritikalität; hochstufige Bewertung ausreichend, methodische Vollständigkeit dokumentiert |
| Gering            | Ja                           | –              | Fokussiert   | Externe Exposition erfordert eine Mindestanalyse unabhängig von der Asset-Kritikalität |
| Gering            | Nein                         | –              | Hochstufig   | Geringe Kritikalität und keine Exposition; hochstufige Bewertung dokumentiert methodische Vollständigkeit |


**Hinweise zur Anwendung**:

- Die Kategorisierung der Asset-Kritikalität (Hoch/Mittel/Gering) ist systemspezifisch zu definieren
- Bei Mehrfachzuordnung von Assets gilt die höchste Asset-Kritikalität
- Die Entscheidung kann durch weitere Faktoren (z.B. regulatorische Anforderungen) beeinflusst werden
- Abweichungen von der Matrix sind zu dokumentieren und zu begründen

---

### Rückkopplung: STRIDE-Ergebnisse und Asset-Bewertung

Die STRIDE-Analyse kann zu neuen Erkenntnissen führen, die eine **Rückkehr in frühere Prozessphasen** erforderlich machen:

#### Iterative Validierung durch STRIDE-Ergebnisse

Während der STRIDE-Analyse können folgende Erkenntnisse auftreten:

1. **Identifikation bisher übersehener Assets**  
   Die Bedrohungsanalyse deckt Assets auf, die in der initialen Asset-Bewertungsphase nicht identifiziert wurden.  
   → Rückkehr zur Asset-Bewertungsphase

2. **Neubewertung der Asset-Kritikalität**  
   Erkannte Angriffspfade zeigen, dass die initiale Kritikalitätsbewertung zu niedrig angesetzt wurde.  
   → Aktualisierung der Asset-Bewertung und ggf. Anpassung der STRIDE-Tiefe

3. **Entdeckung neuer Trust Boundaries**  
   Die detaillierte Analyse zeigt Vertrauensgrenzen auf, die im initialen DFD nicht berücksichtigt wurden.  
   → Rückkehr zur DFD-Phase und Aktualisierung

4. **Identifikation indirekter Asset-Beziehungen**  
   STRIDE deckt auf, dass Elemente als Attack Enabler für bisher nicht zugeordnete Assets dienen.  
   → Aktualisierung der Asset-Zuordnung

#### Prozessablauf mit Rückkopplung

Der vollständige TARA-Prozess umfasst somit folgende Iterationsschleifen:

```txt
DFD-Phase ↔ Asset-Bewertungsphase ↔ STRIDE-Analyse
    ↓              ↓                      ↓
    └──────────────┴──────────────────────┘
         (Iterative Validierung)
```

Die Iteration wird so lange fortgesetzt, bis keine wesentlichen neuen Erkenntnisse mehr gewonnen werden und die Vollständigkeit der Analyse sichergestellt ist.

#### Dokumentation von Änderungen

Alle durch STRIDE-Ergebnisse ausgelösten Änderungen an DFD, Asset-Bewertung oder Asset-Zuordnung sind zu dokumentieren:

- Grund der Änderung
- Betroffene DFD-Elemente bzw. Assets
- Auswirkung auf die Risikoeinschätzung
- Datum und Bearbeiter

Dies gewährleistet die Nachvollziehbarkeit des iterativen Prozesses.

---

### Anwendung auf kritische und unkritische Systeme

Der beschriebene Prozess wird unabhängig von der Systemkritikalität angewendet.  
Unterschiede ergeben sich ausschliesslich aus den definierten Schwellenwerten der Asset-Kritikalität und den daraus abgeleiteten Analyse-Tiefen.

Dieses Vorgehen gewährleistet eine konsistente Methodik und erleichtert spätere Re-Assessments bei Systemänderungen.

---

### Grundsätze

- Die Bedrohungsanalyse basiert auf vollständiger Erfassung und risikoorientierter Priorisierung.
- Asset-Kritikalität steuert die Tiefe der Analyse.
- DFD, Asset-Bewertung und STRIDE-Analyse erfüllen unterschiedliche, sich ergänzende Funktionen und werden in einem iterativen Prozess korreliert.
- Die Zuordnung von Assets zu DFD-Elementen erfolgt anhand nachvollziehbarer Kriterien.
- Die Analyse-Tiefe ist proportional zum potenziellen Schadensausmass zu wählen.
- Elemente ohne direkten Asset-Bezug können als Attack Enabler dennoch analyserelevant sein.
- STRIDE-Ergebnisse können zu iterativer Validierung und Anpassung von DFD und Asset-Bewertung führen.
- Alle Änderungen im iterativen Prozess sind nachvollziehbar zu dokumentieren.
