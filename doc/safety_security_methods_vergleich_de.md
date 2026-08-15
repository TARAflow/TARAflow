# Vergleich von Safety- und Security-Analyseverfahren

## ISO 12100, EN 50742 und TARAflow

Dieses Dokument vergleicht drei Ansätze zur Analyse von Risiken in
cyber-physischen Systemen:

- **ISO 12100** — klassische Safety-Risikoanalyse für Maschinen
- **EN 50742** — Security-for-Safety Ansatz zur Bewertung von
  Cyberangriffen auf Safety-Funktionen
- **TARAflow** — graphbasierte Bedrohungsanalyse zur Untersuchung von
  Angriffspfaden und Schadenspotenzial

Ziel ist es zu zeigen, wie sich diese Methoden ergänzen und gemeinsam
eine durchgehende Risikoanalyse ermöglichen — von der physischen
Gefährdung bis zur digitalen Ursachenkette.

> **Hinweis zu EN 50742:** Die EN 50742 ist zum Zeitpunkt der Erstellung
> dieses Dokuments noch kein verabschiedeter Standard. Die verwendete
> Version ist der öffentliche Kommentierungs-Draft `prEN 50742:2025`
> (BSI Draft for Public Comment, DPC: 25/30551049 DC, Dezember 2025).
> Inhalte können sich bis zur finalen Veröffentlichung noch ändern.

---

## Grundperspektive der Methoden

| Methode   | Perspektive               | Zentrale Fragestellung                                        |
|-----------|---------------------------|---------------------------------------------------------------|
| ISO 12100 | Safety-Gefährdungsanalyse | Welche Schäden kann die Maschine verursachen?                 |
| EN 50742  | Security für Safety       | Kann ein Cyberangriff bestehende Hazards auslösen?            |
| TARAflow  | Ursachen- und Pfadanalyse | Wie kann ein Angreifer das System erreichen und manipulieren? |

---

## Methodenvergleich

| Aspekt              | ISO 12100                                   | EN 50742                                                     | TARAflow                                                              |
|---------------------|---------------------------------------------|--------------------------------------------------------------|-----------------------------------------------------------------------|
| **Analyseart**      | Safety-Risikoanalyse                        | Security-for-Safety Analyse                                  | Threat- / Angriffspfadanalyse                                         |
| **Fokus**           | Physische Gefährdungen und Verletzungen     | Cybermanipulationen, die Hazards auslösen können             | Digitale Angriffspfade, Asset-Exposition und Kaskadeneffekte          |
| **Hauptfrage**      | Welche Hazards existieren?                  | Können Cyberangriffe diese Hazards auslösen?                 | Wie erreicht ein Angreifer kritische Assets?                           |
| **Ursachen**        | Unbeabsichtigt (Verschleiß, Fehlbedienung) | Absichtlich (Cyberangriffe auf Safety-Funktionen)            | Absichtlich (Angriffsstrategien über Interfaces und Datenflüsse)      |
| **Analyseobjekt**   | Maschine und ihr Verhalten                  | Interfaces und Angriffsoberflächen von Safety-Funktionen     | Systemarchitektur: Assets, Interfaces, Datenflüsse, Vertrauensgrenzen |
| **Modell**          | Hazards, Severity, Schutzmaßnahmen          | Exposure Level (EL), Window of Opportunity (WoO), Attacker Capability (AC) | Graph aus Assets, Beziehungen, Schutzzielableitungen (CIANAAA)  |
| **Risikofaktoren**  | Severity + Probability                      | Severity (aus ISO 12100) + Attack Potential                  | Angriffspfade, Angriffsaufwand, direkte und transitive Schadenwirkung |
| **Dynamik**         | Eher statisch                               | Bewertet Angriffsoberfläche semi-statisch                    | Dynamische Angriffspfadtraversierung im Systemgraphen                 |
| **Ergebnis**        | Safety-Risikolevel                          | Safety-related Security Level (SRSL)                         | Priorisierte Bedrohungsliste mit Angriffspfadanalyse                  |

---

## Beziehung zwischen ISO 12100 und EN 50742

### ISO 12100 — Wirkungsebene

ISO 12100 analysiert die **Gefährdungen der Maschine unabhängig von ihrer Ursache.**

Typische Fragen:
- Welche Hazards existieren?
- Welche Schäden können entstehen?
- Wie schwer ist der Schaden?

Beispiel:

```
Hazard: Roboterarm bewegt sich
↓
Gefahr: Quetschen
↓
Severity: Schwerverletzung
```

### EN 50742 — Security-for-Safety Ebene

Die EN 50742 **übernimmt die Safety-Ergebnisse aus der ISO 12100** und
bewertet, ob Cyberangriffe diese Hazards auslösen können.

Dabei gilt folgende Grundannahme:

- Hazards wurden bereits in der ISO 12100 identifiziert
- Cyberangriffe erzeugen **keine neuen physikalischen Hazards**
- Cybersecurity beeinflusst nur die **Wahrscheinlichkeit**, dass ein
  bestehender Hazard ausgelöst wird

Daher gilt:

| Element             | Quelle                                   |
|---------------------|------------------------------------------|
| Hazard              | ISO 12100                                |
| Severity            | ISO 12100                                |
| Wahrscheinlichkeit  | Beeinflusst durch Cyberexposition (EN 50742) |

Die Bewertung erfolgt über das **Attack Potential (AP)**:

```
AP = (EL × WoO) + AC
```

| Parameter | Bedeutung                                                    |
|-----------|--------------------------------------------------------------|
| EL        | Exposure Level — Angriffsoberfläche pro Interface/Verbindung |
| WoO       | Window of Opportunity — Zeitfenster, in dem ein Angriff möglich ist (Multiplikator) |
| AC        | Attacker Capability — technische Fähigkeit des Angreifers    |

Das Attack Potential wird in fünf Stufen eingeteilt (AP0–AP4):

| Score   | Stufe     | Bedeutung                                           |
|---------|-----------|-----------------------------------------------------|
| 0–5     | AP0       | Sehr niedrig — Angriff höchst unwahrscheinlich      |
| 5,1–10  | AP1       | Niedrig — nur unter sehr spezifischen Bedingungen   |
| 10,1–15 | AP2       | Mittel — realistisches Angriffsszenario             |
| 15,1–20 | AP3       | Hoch — wahrscheinliches Angriffsszenario            |
| > 20    | AP4       | Kritisch — Angriff ist nahezu sicher                |

Das daraus resultierende **Safety-related Security Level (SRSL)**
bestimmt anschließend die notwendigen Maßnahmen gemäß der
**IEC 62443-Serie** (insbesondere IEC 62443-3-3 auf Systemebene und
IEC 62443-4-2 auf Komponentenebene).

---

## Perspektive von TARAflow

TARAflow betrachtet die **Ursachenkette eines möglichen Angriffs** auf
Basis eines gerichteten Systemgraphen.

Anstatt beim Hazard zu beginnen, startet die Analyse bei:

- Angreifern und externen Entitäten
- Interfaces und Protokollen
- Datenflüssen zwischen Systemkomponenten
- Assets und deren Schutzzielableitung

### Typische Fragen

- Welche Interfaces und Vertrauensgrenzen existieren?
- Welche Angriffspfade führen zu kritischen Assets?
- Wie hoch ist das Schadenspotenzial — direkt und durch Kaskadeneffekte?

### Modellbestandteile

| Element           | Bedeutung                                                       |
|-------------------|-----------------------------------------------------------------|
| External Entities | Benutzer, Angreifer, externe Systeme                           |
| Interfaces        | Kommunikationskanäle mit Exposure Level                        |
| DataFlows         | Gerichtete Datenflüsse zwischen Prozessen und Systemen         |
| Assets            | Schutzobjekte mit abgeleiteten Schutzzielen (CIANAAA)          |
| Trust Boundaries  | Vertrauensgrenzen, die Exposure Level beeinflussen             |

### Schutzzielableitung: CIANAAA

TARAflow leitet Schutzziele nicht manuell, sondern **systematisch aus
den Beziehungen im Systemgraphen** ab. Dabei wird das erweiterte
CIANAAA-Framework verwendet:

| Schutzziel         | Bedeutung                                                        |
|--------------------|------------------------------------------------------------------|
| Confidentiality    | Schutz vor unberechtigtem Informationszugriff                   |
| Integrity          | Schutz vor unberechtigter Manipulation                          |
| Availability       | Schutz vor unberechtigter Unterbrechung                         |
| Non-Repudiation    | Nachweis von Aktionen und Verantwortlichkeiten                  |
| Authenticity       | Sicherstellung der Identität von Entitäten                      |
| Authorization      | Durchsetzung von Zugriffsrechten                                |
| Accountability     | Nachvollziehbarkeit von Aktionen                                |

Ergänzend bewertet TARAflow **Safety-Annotations** auf Beziehungen
(z. B. `affects_safety`), um Safety-relevante Assets und
Angriffspfade direkt mit der EN 50742 / ISO 12100 Analyse zu verknüpfen.

---

## Integrierte Kausalkette

Wenn alle drei Methoden kombiniert werden, entsteht eine vollständige
Analyse vom **Cyberangriff bis zum physischen Schaden**:

```
Angreifer
   ↓
Interface / DataFlow  (TARAflow: Angriffseinstieg)
   ↓
Traversierung des Systemgraphen  (TARAflow: Angriffsausbreitung)
   ↓
Kompromittierung eines kritischen Assets  (TARAflow: Systemmanipulation)
   ↓
Unsicherer Systemzustand
   ↓
Hazard  (ISO 12100: Identifikation und Severity-Bewertung)
   ↓
Physischer Schaden
```

| Phase                          | Methode   |
|--------------------------------|-----------|
| Angriffseinstieg               | TARAflow  |
| Angriffsausbreitung            | TARAflow  |
| Systemmanipulation             | TARAflow  |
| Definition des Hazards         | ISO 12100 |
| Bewertung der Severity         | ISO 12100 |
| Bewertung der Cyberexposition  | EN 50742  |
| Ableitung der SRSL-Anforderung | EN 50742  |

---

## Interpretation des Risikos

In diesem kombinierten Modell gilt:

- **Severity bleibt unverändert**, da sich die physikalische
  Gefährdung der Maschine durch Vernetzung nicht ändert.
- **Cyberexposition erhöht oder reduziert die Wahrscheinlichkeit**,
  dass ein Hazard ausgelöst wird.
- **TARAflow liefert die Attack-Potential-relevanten Eingaben** (EL
  pro Interface, Angriffspfade) als strukturierte Basis für die
  EN 50742 Bewertung.

Konzeptionell ergibt sich:

```
Risk ≈ Severity × Attack Potential
```

Beispiel:

```
Hazard: Quetschgefahr durch Roboterarm
Severity: tödlich (ISO 12100)

Vor Vernetzung:
  EL niedrig, WoO minimal → Attack Potential AP0/AP1
  → geringes Cyber-Risiko

Nach Internetanbindung (Remote-Wartungsinterface):
  EL erhöht, WoO größer → Attack Potential AP2/AP3
  → deutlich erhöhtes Cyber-Risiko
  → SRSL-Anforderung steigt
```

---

## Beispiel einer cyber-physischen Angriffskette

```
Angreifer (extern)
↓
Remote-Wartungsinterface (EL: hoch)
↓
Manipulation der PLC (Safety-Funktion kompromittiert)
↓
Deaktivierung der Bremse
↓
Maschine stoppt nicht
↓
Verletzung eines Bedieners
```

| Analyseschritt                                 | Methode   |
|------------------------------------------------|-----------|
| Identifikation des Interfaces und Exposure Level | TARAflow + EN 50742 |
| Angriffspfad zur PLC im Systemgraphen          | TARAflow  |
| Hazard „Maschine stoppt nicht" → Quetschgefahr | ISO 12100 |
| Severity-Einstufung                            | ISO 12100 |
| Berechnung AP = (EL × WoO) + AC               | EN 50742  |
| Ableitung SRSL und Maßnahmen (IEC 62443)       | EN 50742  |

---

## Fazit

Die drei Methoden betrachten unterschiedliche Ebenen desselben Systems
und sind in der Praxis **sequenziell und inhaltlich voneinander
abhängig**:

| Ebene                                              | Methode   |
|----------------------------------------------------|-----------|
| Physische Gefährdungen und deren Severity          | ISO 12100 |
| Cyberexposition sicherheitsrelevanter Funktionen   | EN 50742  |
| Angriffspfade, Asset-Exposition, Kaskadeneffekte   | TARAflow  |

> Gemeinsam entsteht eine vollständige Kausalkette von der **digitalen
> Ursache bis zum physischen Schaden**.
>
> TARAflow liefert dabei die strukturierten Eingabedaten (Interfaces,
> Exposure Level, Angriffspfade), die ISO 12100 liefert Hazards und
> Severity, und EN 50742 verbindet beide Welten zu einer
> bewertbaren Sicherheitsanforderung.
