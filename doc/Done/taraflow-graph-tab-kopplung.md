# TARAflow – Graph-Kopplung: Asset-Tab, Threat-Tab, Risk-Tab

## 1. Graphentheorie Grundlagen

TARAflow basiert auf einem **Property Graph** mit heterogenen Knoten und attributierten Kanten.

### Knotentypen (heterogener Graph)

```
Ebene 1:  DFD-Elemente (Process, DataStore, ExternalEntity)
Ebene 2a: Data Assets
Ebene 2b: Process Assets
Ebene 2c: System Assets
Ebene 2d: Infrastructure Assets
Ebene 2e: Human Assets
```

### Kantentypen

| Kante | Richtung | Trägt |
|-------|----------|-------|
| DataFlow | gerichtet | Protokoll, Daten |
| Element → Asset | gerichtet | SafetyAnnotation, Beziehungstyp |
| Asset → Asset | gerichtet | SafetyAnnotation, Beziehungstyp, Rationale |

### Warum Graph statt Tabelle

- **Tabelle**: statisch, keine Beziehungen
- **Baum**: nur hierarchisch, ein Parent pro Child
- **Graph**: beliebige Beziehungen, Pfadanalyse, Transitivität

### Eigenschaften die TARAflow nutzt

| Eigenschaft | Nutzung |
|-------------|---------|
| Gerichtete Kanten | A→B ≠ B→A, semantisch unterschiedlich |
| Heterogene Knoten | 5 Asset-Kategorien + DFD-Elemente |
| Attributierte Kanten | SafetyAnnotation, Rationale, source |
| Pfadanalyse | Safety propagiert entlang von Hop-Ketten |
| Erreichbarkeit | Welche Assets sind von diesem Element aus erreichbar? |
| DAG (kein Zyklus) | Safety-Propagation darf keine Zyklen erzeugen |

---

## 2. Asset-Tab – Haupt-Tabelle

### Aktuelle Struktur

Die Haupt-Asset-Tabelle enthält pro Asset:
- Impact Faktoren (frei wählbar aus Business und HSE)
- Gesamt Impact (qualitativ + Mittelwert)
- Schutzziele pro Asset (CIANAAA)

### Graph-Kopplung: HSE automatisch derived

| Faktor | Quelle | Basis |
|--------|--------|-------|
| **Business: Finanziell** | manual | Domänenwissen |
| **Business: Reputational** | manual | Domänenwissen |
| **Business: Operational** | manual | Domänenwissen |
| **HSE: Safety** | **derived** | physicalImpact + relevance aus SafetyAnnotation |
| **HSE: Health** | **derived** | Human Asset in Downstream-Kette |
| **HSE: Environment** | manual (Fallback) | noch nicht im Graph modellierbar |

**Regel:** HSE-Felder werden automatisch aus dem Graphen befüllt. Falls im Graph nicht vorhanden, kann der Analyst die Felder manuell hinzufügen (`source: "manual"` + Rationale).

### Fehlende Felder – Anzeige im Asset-Tab

Zusätzlich zur bestehenden Tabelle sollte der Graph folgende Informationen anzeigen:

**Spalten in der Tabelle:**

| Spalte | Quelle | Inhalt |
|--------|--------|--------|
| Safety Impact | derived | 🔴 direct / ⚠️ indirect / – |
| Downstream | derived | Anzahl abhängiger Assets (klickbar) |
| Betroffene Personen | derived | Human Assets in Downstream-Kette |

**Im Side Panel (bei Klick auf Asset):**
- Verwendet von: welche DFD-Elemente + Beziehungstyp
- Upstream Assets: von welchen Assets hängt dieses ab
- Downstream Assets: welche Assets hängen davon ab
- Trust Boundary Kontext
- Safety Impact Ableitung mit Hop-Kette

### CIANAAA → STRIDE Mapping

Die CIANAAA-Werte am Asset bestimmen direkt die Pflicht-Threats im Threat-Tab:

| Schutzziel | STRIDE Kategorie |
|------------|------------------|
| C (Confidentiality) | Information Disclosure |
| I (Integrity) | Tampering |
| A (Availability) | Denial of Service |
| N (Non-Repudiation) | Repudiation |
| Au (Authenticity) | Spoofing |
| Ac (Accountability) | Repudiation + Elevation of Privilege |

**Kein zusätzlicher Annotations-Layer nötig** – CIANAAA am Asset-Knoten + Element→Asset Kante reichen für die STRIDE-Ableitung aus.

---

## 3. Threat-Tab – Graph-Kopplung

### Priorisierung der Elemente

**Worst Case allein reicht nicht** – zwei Elemente mit je einem CRITICAL Asset sind gleich, aber nicht gleichwertig.

**Mehrstufige Priorisierung:**

| Stufe | Kriterium | Regel |
|-------|-----------|-------|
| 1 | Safety Override | Safety direct + fatality/irreversible → Priorität 1 |
| 2 | Safety indirect | Safety indirect → Priorität 2 |
| 3 | CRITICAL Asset Anzahl | mehr CRITICAL Assets = früher |
| 4 | HIGH Asset Anzahl | mehr HIGH Assets = früher |
| 5 | Downstream Dependencies | mehr abhängige Assets = früher |
| 6 | Rest | alphabetisch / manuell |

**Beispiel:**

```
Element A: Safety direct,   1x CRITICAL, 1x HIGH, 1x LOW
Element B: Safety indirect, 1x CRITICAL, 2x MED

Stufe 1: A = Safety direct  → Priorität 1
         B = Safety indirect → Priorität 2
→ Element A zuerst – klar und auditierbar
```

### Threat-Typen im Threat-Tab

**1. Pflicht-Threats (derived, nicht löschbar)**
- Quelle: CIANAAA × STRIDE Mapping
- Severity: MAX-Wert des jeweiligen Schutzziels über alle verbundenen Assets
- Safety Override hat immer Vorrang

**2. Relation-Threats (derived)**
- Quelle: Asset→Asset Core Rules
- Beispiel: Data A `derives_from` Data B → Tampering auf B impliziert Tampering auf A
- Wird auf Elemente übertragen die Asset A verwenden

**3. Interaction-Threats (DataFlow, angereichert)**
- Quelle: DataFlow × transportierte Assets × Trust Boundary
- Severity basiert **nur** auf Assets die dieser Flow transportiert (präziser als Element-Worst-Case)
- Trust Boundary Übertritt → Spoofing Pflicht-Threat

**4. Default-Threats (Vorschlag, akzeptierbar/ablehnbar)**
- Bestehende Logik: STRIDE per Element / per Interaction
- Analyst kann deaktivieren (mit Rationale)

**5. Manual-Threats**
- Domänen-spezifische Threats die der Graph nicht kennt
- `source: "manual"` + Rationale Pflichtfeld

### Severity-Aggregation bei mehreren Assets

**Nicht Durchschnitt – sondern MAX pro Schutzziel:**

```
Element "CNC-Steuerung" hat Assets:
  Fertigungsrezepte   C:HIGH  I:CRITICAL  A:HIGH
  Maschinenstatus     C:LOW   I:MEDIUM    A:HIGH
  Betriebsstunden-Log C:LOW   I:LOW       A:LOW

Threat Tampering:         Severity = MAX(I) = CRITICAL
Threat Info Disclosure:   Severity = MAX(C) = HIGH
Threat DoS:               Severity = MAX(A) = HIGH
```

**Safety Override überschreibt CIANAAA-basierten MAX:**
```
IF Asset in Element-Kette hat Safety direct + fatality
THEN Tampering + DoS → immer CRITICAL
```

**Für Interactions (DataFlows):**
```
Severity = MAX(CIANAAA) nur über Assets
           die dieser Flow transportiert
→ präziser als Element-Worst-Case
→ verschiedene Flows = verschiedene Severity
```

### Fehlende Felder im Threat-Tab

Aktuell: Threats pro Element / Interaction ohne Graph-Kontext.

Neu hinzufügen:
- **Element-Priorität** (aus Stufen 1–5 oben)
- **Begründung der Severity** (welches Asset hat Ausschlag gegeben)
- **Pflicht-Threat Markierung** (derived, nicht löschbar)
- **Safety Override Markierung** (wenn greift)
- **Betroffene Assets pro Threat** (für Traceability)

---

## 4. Risk-Tab – Aktuelle Struktur + Erweiterung

### Aktuelle Felder

| Feld | Typ |
|------|-----|
| Threat ID | derived |
| Threat Description | derived |
| Likelihood | manual |
| Impact | manual / derived |
| Risk before Mitigation | berechnet |
| Mitigation | manual |
| Risk after Mitigation | berechnet |

### Drei Quellen für Impact Faktoren

**Quelle 1: Graph (derived)**
- Safety Impact → aus SafetyAnnotation
- Operational Impact → aus Downstream-Kette (Anzahl betroffener Prozesse)
- Werte werden direkt übernommen
- read-only solange kein Override gesetzt

**Quelle 2: Risk-Config-Dialog (konfiguriert)**
- Analyst definiert projektspezifische Faktoren und deren Skalen
- Frei wählbar, ähnlich wie Impact-Faktoren im Asset-Tab

**Quelle 3: Override (manual, markiert)**
- Analyst überschreibt derived Wert
- Pflicht: Rationale eingeben
- Override bleibt dauerhaft sichtbar markiert (Audit-Trail)

### Risk-Config-Dialog

```
Projekt-Einstellungen:

Impact Faktoren:
  + Faktor hinzufügen    [+]

  ✓ Financial
      LOW:      < 10'000 CHF
      MEDIUM:   10'000 – 100'000 CHF
      HIGH:     100'000 – 1'000'000 CHF
      CRITICAL: > 1'000'000 CHF

  ✓ Reputational
      LOW:      intern bekannt
      MEDIUM:   Branche bekannt
      HIGH:     öffentlich bekannt
      CRITICAL: Medien / Behörden

  ✓ Regulatory
      LOW:      Dokumentationspflicht
      MEDIUM:   Meldepflicht
      HIGH:     Bussrisiko
      CRITICAL: Marktrückzug / Zulassungsverlust

Graph-Faktoren (read-only, immer aktiv):
  ✓ Safety      ← SafetyAnnotation
  ✓ Operational ← Downstream-Kette
```

### Override-Markierung

```
Threat: Tampering auf Fertigungsrezepte

Safety Impact:
  [derived]  CRITICAL  ← aus Graph
             ⚠️ Override: HIGH
             Rationale: "Schutzvorrichtung vorhanden,
                         Restrisiko reduziert"
             Autor: analyst@bbv.ch  Datum: 2026-03-08

Operational Impact:
  [derived]  HIGH  ← 3 Downstream-Prozesse
             kein Override

Financial Impact:
  [config]   HIGH  ← via Risk-Config-Dialog
             kein Override

Gesamt Impact:
  MAX(HIGH*, HIGH, HIGH) = HIGH
  * Override von CRITICAL auf HIGH
  source: "derived → override"
```

### Aggregationsregel

```
Gesamt Impact = MAX(alle Faktoren)

Sonderregel Safety Override:
  IF Safety derived = CRITICAL
  AND kein Override gesetzt
  THEN Gesamt Impact = CRITICAL
       unabhängig von anderen Faktoren

  IF Override gesetzt auf Safety
  THEN Override-Wert fliesst in MAX ein
       Override bleibt sichtbar markiert
       Audit-Trail wird geschrieben
```

### Was das für den Analysten bedeutet

```
Ohne Override:
  Graph-Werte    → direkt übernommen
  Config-Werte   → aus Risk-Config-Dialog
  Gesamt Impact  → automatisch berechnet
  → Analyst setzt nur Config-Werte einmalig

Mit Override:
  Abweichung vom Graph explizit begründen
  → auditierbar
  → normkonform (IEC 62443, ISO 21434
    fordern Begründung bei Abweichung
    von systematischer Analyse)
```

### Traceability-Kette (für Audit/Norm)

```
Massnahme → Threat → STRIDE-Kategorie
          → Asset → CIANAAA-Wert
          → Element → SafetyAnnotation
          → DFD-Modell
```

---

## 5. Gesamtdatenfluss

```
DFD-Tab:
  System modellieren
  SafetyAnnotation auf Element→Asset Kanten setzen
  Asset→Asset Beziehungen modellieren
        ↓
Asset-Tab:
  HSE Safety/Health: automatisch derived aus Graph
  HSE Environment + Business: manuell
  Gesamt Impact: berechnet
  CIANAAA: Analyst entscheidet (informiert durch Graph)
        ↓
Threat-Tab:
  Elemente sortiert nach Priorität (Safety + Impact)
  Pflicht-Threats: derived aus CIANAAA × STRIDE
  Relation-Threats: derived aus Asset→Asset Ketten
  Interaction-Threats: derived aus DataFlow × Assets
  Default/Manual-Threats: Analyst ergänzt
        ↓
Risk-Tab:
  Impact: derived aus Threat-Severity
  Likelihood: manuell
  Mitigation: manuell
  Traceability-Kette: vollständig
        ↓
Integration-Tab:
  Jira / Azure DevOps
  Git Audit-Trail
```

---

## 6. Kernaussage für den Vortrag

> Klassische TARA: Asset-Liste + Threat-Liste + Bewertungstabelle → flache Struktur, Beziehungen im Kopf des Analysten, nicht auditierbar.
>
> TARAflow: Property Graph mit heterogenen Knoten und attributierten Kanten → Beziehungen explizit modelliert, Impact berechenbar statt geschätzt, Traceability ist eine Graph-Eigenschaft (Pfad von Massnahme zu Asset existiert oder existiert nicht – nachweisbar).
>
> **Wenn ich frage: Welche Threats muss ich auf diesem Element analysieren?**
> Klassisch: Analyst überlegt.
> TARAflow: Graph-Traversierung → deterministisch, reproduzierbar, auditierbar.
