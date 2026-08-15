# 6 Formeller TARA-Prozess

Der formalisierte TARA-Prozess gewährleistet Konsistenz, Nachvollziehbarkeit und einen systematischen Umgang mit Bedrohungen und Risiken. Dieser strukturierte Ansatz stellt die Rückverfolgbarkeit von der Systemmodellierung über schützenswerte Assets bis zu implementierten Gegenmassnahmen sicher.

---

## 6.1 Prozessübersicht

### 6.1.1 Phasenmodell

Der formelle TARA-Prozess umfasst fünf Kernphasen:

| Phase | Bezeichnung              | Kernaktivität                                                                    |
|-------|--------------------------|----------------------------------------------------------------------------------|
| 0     | Projekt & Kontext        | Projekt anlegen, Systemkontext definieren, Kritikalität und Governance festlegen |
| 1     | DFD-Modellierung         | Systemarchitektur visualisieren, Angriffsflächen identifizieren                  |
| 2     | Asset-Definition         | Schutzziele und Kritikalität festlegen                                           |
| 3     | Bedrohungsanalyse        | STRIDE und/oder Attack Trees anwenden                                            |
| 4     | Risiko-Bewertung         | Likelihood × Impact, Priorisierung                                               |
| 5     | Validierung & Governance | CBA, Sign-off, Re-Assessment-Zyklus                                              |

### 6.1.2 Gesamtprozess-Diagramm

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORMELLER TARA-PROZESS                                   │
│                    mit Workflow-Varianten und Feedback-Loops                │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────┐
     │  PHASE 0: PROJEKTINITIALISIERUNG     │
     │  & KONTEXTDEFINITION                 │
     │  ┌────────────────────────────────┐  │
     │  │ • Projektname & Version        │  │
     │  │ • Verantwortliche Rolle        │  │
     │  │ • Systembeschreibung & Kontext │  │
     │  │ • Kritikalität festlegen       │  │
     │  │   (Standard / Kritisches Sys.) │  │
     │  │ • Branchen-Tags                │  │
     │  │ • Plattform-Tags               │  │
     │  │ • Regulatorische Tags          │  │
     │  └────────────────────────────────┘  │
     │  Artefakt: Projekt- & Kontextprofil  │
     └──────────────────────────────────────┘
                        │
                        ▼
     ┌──────────────────────────────────────┐
     │      PHASE 1: DFD-MODELLIERUNG       │
     │  ┌────────────────────────────────┐  │
     │  │ • Architekturübersicht/Scope   │  │
     │  │ • DFD erstellen (alle Elemente)│  │
     │  │ • Trust Boundaries definieren  │  │
     │  │ • Interfaces identifizieren    │  │
     │  │ • Assets festlegen/markieren   │  │
     │  │ • Alle DFD Elemente beschreiben│  │
     │  └────────────────────────────────┘  │
     │  Artefakt: Validiertes DFD           │
     └──────────────────────────────────────┘
                        │
                        ▼
     ┌──────────────────────────────────────┐
     │      PHASE 2: ASSET-DEFINITION       │
     │  ┌────────────────────────────────┐  │
     │  │ • Assets inventarisieren       │  │
     │  │ • Kritikalität bewerten        │  │
     │  │   (Business + Physical Impact) │  │
     │  │ • CIANAAA-Schutzziele zuordnen │  │
     │  │ • Asset-Security-Mapping       │  │
     │  └────────────────────────────────┘  │
     │  Artefakt: Asset-Tabelle             │
     └──────────────────────────────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │    ENTSCHEIDUNGSPUNKT:      │
          │    Workflow-Auswahl         │
          │    (siehe 6.1.3)            │
          └─────────────────────────────┘
                   │          │
       VARIANTE A  │          │  VARIANTE B
                   │          │
     ┌─────────────┘          └─────────────┐
     │                                      │
     ▼                                      ▼
┌─────────────────────┐          ┌─────────────────────┐
│ PHASE 3A: STRIDE    │          │ PHASE 3B: ATTACK    │
│ ┌─────────────────┐ │          │ TREES               │
│ │• STRIDE per     │ │          │ ┌─────────────────┐ │
│ │  Element/Inter- │ │          │ │• Attack Goals   │ │
│ │  action         │ │          │ │  aus High-Impact│ │
│ │• Threat-Tabelle │ │          │ │  Assets ableiten│ │
│ │• Mitigations    │ │          │ │• Attack Trees   │ │
│ │                 │ │          │ │  modellieren    │ │
│ └─────────────────┘ │          │ │• Likelihood pro │ │
│                     │          │ │  Pfad bewerten  │ │
│                     │          │ └─────────────────┘ │
└──────────┬──────────┘          └────────────┬────────┘
           │                                  │
           │    ┌───────────────────┐         │
           │    │  Attack Tree      │◀────────│────────────────────┐
           │    │  notwendig?       │         │                    │
           │    │(Variante A, nach  │         │                    │
           │    │6.6 Risiko Bewert.)│         │                    │
           │    └─────────┬─────────┘         │                    │
           │         │    │                   │                    │
           │        JA   NEIN                 │                    │
           │         │    │                   │                    │
           │         ▼    └──────────────┐    ▼                    │
           │ ┌─────────────────────────┐ │  ┌────────────────────┐ │
           │ │ Attack Trees für        │ │  │ STRIDE-Validierung │ │
           │ │ Threats bei Unklarheit  │ │  │ ┌────────────────┐ │ │
           │ │ oder hohem Risiko       │ │  │ │• STRIDE per    │ │ │
           │ │ (High/Critical Impact   │ │  │ │  Element/Flow  │ │ │
           │ │ oder unklare Likelihood)│ │  │ │• Ergänzung     │ │ │
           │ └────────────┬────────────┘ │  │ │  fehlender     │ │ │
           │              │              │  │ │  Threats       │ │ │
  ┌────────┘              │              │  │ └────────────────┘ │ │
  │                       │              │  └─────────┬──────────┘ │
  │                       │              │            │            │
  │                       ▼              ▼            ▼            │
  │  ┌─────────────────────────────────────────────────┐           │
  │  │                                                 │           │
  │  │  ╔═══════════════════════════════════════════╗  │           │
  │  │  ║           FEEDBACK-LOOP                   ║  │           │
  │  │  ║  ┌─────────────────────────────────────┐  ║  │           │
  │  │  ║  │ Abgleich: STRIDE ↔ Attack Trees     │  ║  │           │
  │  │  ║  │ • Alle Angriffspfade abgedeckt?     │  ║  │           │
  │  │  ║  │ • Fehlende STRIDE-Kategorien?       │  ║  │           │
  │  │  ║  │ • Unrealistische Annahmen?          │  ║  │           │
  │  │  ║  │ • Likelihood-Schätzungen konsistent?│  ║  │           │
  │  │  ║  └─────────────────────────────────────┘  ║  │           │
  │  │  ║                    │                      ║  │           │
  │  │  ║           Lücken gefunden?                ║  │           │
  │  │  ║              │         │                  ║  │           │
  │  │  ║             JA        NEIN                ║  │           │
  │  │  ║              │         │                  ║  │           │
  │  │  ║              ▼         │                  ║  │           │
  │  │  ║     ┌─────────────┐    │                  ║  │           │
  │  │  ║     │ Iteration:  │    │                  ║  │           │
  │  │  ║     │ Phase 3     │────┘                  ║  │           │
  │  │  ║     │ ergänzen    │                       ║  │           │
  │  │  ║     └──────┬──────┘                       ║  │           │
  │  │  ║            │ (Rücksprung)                 ║  │           │
  │  │  ╚════════════│══════════════════════════════╝  │           │
  │  │               │                                 │           │
  │  └───────────────│─────────────────────────────────┘           │
  └─────┐            │                                             │
        ▼            ▼                                             │
     ┌──────────────────────────────────────┐                      │
     │      PHASE 4: RISIKO-BEWERTUNG       │                      │
     │  ┌────────────────────────────────┐  │                      │
     │  │ • Likelihood bewerten (OWASP)  │  │                      │
     │  │ • Impact aggregieren           │  │                      │
     │  │ • Risk = Likelihood × Impact   │  │                      │
     │  │ • MoSCoW-Priorisierung         │  │                      │
     │  └────────────────────────────────┘  │                      │
     │  Artefakt: Risiko-Register           │▶ ────────────────────┘
     └──────────────────────────────────────┘
                        │
                        ▼
     ┌──────────────────────────────────────┐
     │  PHASE 5: VALIDIERUNG & GOVERNANCE   │
     │  ┌────────────────────────────────┐  │
     │  │ • Cost-Benefit-Analysis (CBA)  │  │
     │  │ • Attack-Tree-Validierung für  │  │
     │  │   "Won't"-Entscheidungen       │  │
     │  │ • Sign-off durch Risk Owner    │  │
     │  │ • Re-Assessment-Trigger        │  │
     │  └────────────────────────────────┘  │
     │  Artefakt: Validiertes Risiko-       │
     │            protokoll, Audit-Trail    │
     └──────────────────────────────────────┘
                        │
                        │
         ╔══════════════╧══════════════╗
         ║    RE-ASSESSMENT-ZYKLUS     ║
         ║                             ║
         ║  Trigger:                   ║
         ║  • Architekturänderung      ║
         ║  • Neue Bedrohungen/CVEs    ║
         ║  • Regulatorische Änderung  ║
         ║  • Jährliche Überprüfung    ║
         ║         │                   ║
         ║         ▼                   ║
         ║  ┌─────────────────┐        ║
         ║  │ Zurück zu       │        ║
         ║  │ Phase 1 oder 2  │────────╫───────┐
         ║  └─────────────────┘        ║       │
         ╚═════════════════════════════╝       │
                                               │
                        ┌──────────────────────┘
                        │ (Nächste Iteration)
                        ▼
                   [PHASE 1]

┌─────────────────────────┐
│ Attack Trees für        │
│ Threats bei Unklarheit  │
│ oder hohem Risiko       │
│ (High/Critical Impact   │
│ oder unklare Likelihood)│
└────────────┬────────────┘
```

---

### 6.1.3 Workflow-Varianten

Der Prozess unterstützt zwei Workflow-Varianten, die sich in Phase 3 unterscheiden:

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW-AUSWAHL                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                      Systemkritikalität bewerten                            │
│                                                                             │
│           ┌─────────────────────────────────────────────┐                   │
│           │ • High-Impact Assets vorhanden?             │                   │
│           │ • Safety-relevantes System?                 │                   │
│           │ • Neue/unbekannte Architektur?              │                   │
│           │ • Compliance mit hohen Anforderungen?       │                   │
│           └─────────────────────────────────────────────┘                   │
│                              │                                              │
│              ┌───────────────┴───────────────┐                              │
│              │                               │                              │
│           NEIN                              JA                              │
│              │                               │                              │
│              ▼                               ▼                              │
│    ┌─────────────────┐            ┌─────────────────┐                       │
│    │   VARIANTE A    │            │   VARIANTE B    │                       │
│    │  STRIDE-first   │            │  Attack-Tree    │                       │
│    │                 │            │     first       │                       │
│    │  Effizient,     │            │  Tiefgründig,   │                       │
│    │  reproduzierbar │            │  validierend    │                       │
│    └─────────────────┘            └─────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Vergleich der Varianten:**

| Kriterium               | Variante A (STRIDE-first) | Variante B (Attack-Tree-first) |
|-------------------------|---------------------------|--------------------------------|
| Struktur                | Sehr hoch                 | Hoch                           |
| Kreativität             | Niedrig                   | Hoch                           |
| Angreiferfokus          | Mittel                    | Sehr hoch                      |
| Tool-Automatisierung    | Sehr gut                  | Gut                            |
| Vollständigkeitsprüfung | Begrenzt                  | Sehr gut                       |
| Empfohlen für           | Standard-IT, Compliance   | High-Risk, OT/ICS, Safety      |

---

## 6.2 Phase 0: Projektinitialisierung und Kontextdefinition

Die Phase 0 bildet die formale Grundlage des TARA-Prozesses.  
Sie dient der eindeutigen Identifikation des Analyseprojekts, der Beschreibung des Systemkontexts sowie der Festlegung von Kritikalität, Governance und regulatorischem Rahmen.

Diese Phase ist **verpflichtend** und muss vollständig abgeschlossen sein, bevor Aktivitäten aus Phase 1 (DFD-Modellierung) gestartet werden dürfen.

### 6.2.1 Ziele

| Ziel                        | Beschreibung                                               |
|-----------------------------|------------------------------------------------------------|
| Eindeutige Identifikation   | Klare Benennung und Versionierung des Analyseprojekts      |
| Kontextdefinition           | Beschreibung des Systems, seines Einsatzzwecks und Umfelds |
| Kritikalitätsklassifikation | Einordnung als Standard- oder kritisches System            |
| Governance-Festlegung       | Definition von Verantwortlichkeiten und Analyse-Ownern     |
| Analyse-Vorbereitung        | Grundlage für Methodik-, Workflow- und Tool-Entscheidungen |

### 6.2.2 Inputs

| Input                        | Quelle                | Pflicht   |
|------------------------------|-----------------------|-----------|
| Projektauftrag / Initiative  | Management / Team     | Ja        |
| Systembeschreibung           | Architektur / Produkt | Ja        |
| Regulatorischer Kontext      | Legal / Compliance    | Empfohlen |
| Branchen- & Plattformkontext | Produkt / Technik     | Empfohlen |

### 6.2.3 Aktivitäten

```txt

┌──────────────────────────────────────────┐
│ PROJEKTINITIALISIERUNG WORKFLOW          │
└──────────────────────────────────────────┘
     ┌──────────────────────┐
     │ 1. Projekt anlegen   │
     │    • Name            │
     │    • Version         │
     │    • Verantwortlich  │
     └─────────┬────────────┘
               │
               ▼
     ┌──────────────────────┐
     │ 2. Systemkontext     │
     │    beschreiben       │
     │    • Zweck           │
     │    • Einsatzumfeld   │
     │    • Annahmen        │
     └─────────┬────────────┘
               │
               ▼
     ┌──────────────────────┐
     │ 3. Kritikalität      │
     │    festlegen         │
     │    • Standard        │
     │    • Kritisch        │
     └─────────┬────────────┘
               │
               ▼
     ┌──────────────────────┐
     │ 4. Klassifikation    │
     │    • Branchen-Tags   │
     │    • Plattform-Tags  │
     │    • Regulatorik     │
     └─────────┬────────────┘
               │
               ▼
     ┌──────────────────────┐
     │ 5. Validierung       │
     │    & Freigabe        │
     └──────────────────────┘
```

### 6.2.4 Kritikalitätsklassifikation

Die Kritikalität bestimmt Tiefe, Methodik und Governance-Anforderungen des gesamten TARA-Prozesses.

| Klassifikation      | Beschreibung                                                            |
|---------------------|-------------------------------------------------------------------------|
| Standard-System     | IT-/Produkt-Systeme ohne sicherheits- oder lebensrelevante Auswirkungen |
| Kritisches System   | Systeme mit Safety-, OT-, regulatorisch oder geschäftskritischem Impact |

**Einfluss der Kritikalität auf den TARA-Prozess:**

| Aspekt | Standard-System | Kritisches System |
|--------|-----------------|-------------------|
| **Workflow-Variante (Phase 3)** | STRIDE-first (A) empfohlen | Attack-Tree-first (B) empfohlen |
| **Analyse-Tiefe** | Standard STRIDE | STRIDE + Attack Trees + Feedback-Loop |
| **Attack Trees** | Optional (nur bei High-Risk-Threats) | Verpflichtend für alle CRITICAL Assets |
| **Validierung (Phase 5)** | CBA + Sign-off | CBA + Attack-Tree-Validierung + Sign-off |
| **Re-Assessment** | Jährlich | Halbjährlich + bei jeder Architekturänderung |

**Einfluss auf Workflow-Wahl (siehe 6.5.2):**

| System-Kritikalität | Empfohlene Variante | Begründung | Override möglich? |
|---------------------|---------------------|------------|-------------------|
| **Standard-System** | STRIDE-first (A) | Effizient, reproduzierbar, gut automatisierbar | ✅ Ja, wenn ≥3 Risikofaktoren in 6.5.2 |
| **Kritisches System** | Attack-Tree-first (B) | Tiefgründig, angreiferzentriert, validierend | ⚠️ Nur mit Begründung |

> **Wichtig:** Diese Empfehlung ist eine **Vorgabe**, die durch die Entscheidungsmatrix in 6.5.2 übersteuert werden kann. Ein Standard-System mit ≥3 Risikofaktoren (Safety, neue Architektur, Compliance) sollte Variante B verwenden.

**Beispiel-Mapping:**

```txt
┌──────────────────────────────────────────────────────────┐
│  PHASE 0 → PHASE 3 WORKFLOW-MAPPING                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Standard-System                                         │
│    ├─ ≤2 Risikofaktoren → STRIDE-first (A)               │
│    └─ ≥3 Risikofaktoren → Attack-Tree-first (B)          │
│                                                          │
│  Kritisches System                                       │
│    └─ IMMER → Attack-Tree-first (B)                      │
│       (außer mit expliziter Begründung)                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Die Klassifikation beeinflusst insbesondere:

- Auswahl der Workflow-Variante (STRIDE-first vs. Attack-Tree-first) → **Siehe 6.5.2**
- Tiefe der Bedrohungsanalyse → **Siehe 6.5.1**
- Validierungs- und Governance-Anforderungen → **Siehe 6.7.3**

### 6.2.5 Output

| Artefakt                  | Format       | Beschreibung |
|---------------------------|--------------|--------------|
| Projektprofil             | Dokument / Tool-Objekt | Zentrale Referenz für die gesamte Analyse |
| Kontextbeschreibung       | Text         | Systemzweck, Scope, Annahmen |
| Kritikalitätsentscheidung | Dokumentiert | Grundlage für Workflow-Auswahl |
| Klassifikations-Tags      | Metadaten    | Branchen-, Plattform- und Regulatorik-Tags |

### 6.2.6 Übergang zu Phase 1

Nach Abschluss von Phase 0 liegt ein validiertes Projekt- und Kontextprofil vor.  
Dieses dient als verbindlicher Input für die **DFD-Modellierung in Phase 1**.

Änderungen an Kontext, Kritikalität oder regulatorischem Rahmen **erfordern eine erneute Durchführung von Phase 0** und können ein vollständiges Re-Assessment auslösen.

---

## 6.3 Phase 1: DFD-Modellierung

**Referenz:** Formalisierung von Kapitel 2.3 und 2.4

In dieser Phase wird das formelle Systemmodell erstellt. Alle relevanten Elemente, Datenflüsse, Schnittstellen und Trust Boundaries werden erfasst und dokumentiert.

Neu ist die explizite Erfassung physischer und logischer Interfaces (z. B. USB, Ethernet, RS232, Touchscreen, Debug-/Wartungszugänge). Diese Interfaces werden als eigene DFD-Elemente modelliert, um auch Interface-bezogene Gefährdungen systematisch zu identifizieren und später mit STRIDE zu analysieren.

Das validierte DFD dient als verbindliche Grundlage für die nachfolgenden Phasen (Asset-Definition, Bedrohungsanalyse, Risiko-Bewertung) und sichert Konsistenz, Nachvollziehbarkeit und Revisionsfähigkeit der Risikoanalyse.

### 6.3.1 Ziele

| Ziel             | Beschreibung                                   |
|------------------|------------------------------------------------|
| Scope-Definition | Klare Abgrenzung des Analysegegenstands        |
| Vollständigkeit  | Alle sicherheitsrelevanten Komponenten erfasst |
| Angriffsflächen  | Potenzielle Angriffsvektoren identifiziert     |
| Trust Boundaries | Vertrauensgrenzen formal definiert             |

### 6.3.2 Inputs

| Input                           | Quelle             | Pflicht |
|---------------------------------|--------------------|---------|
| Systemarchitektur-Dokumentation | Architektur-Team   | Ja      |
| Netzwerkdiagramme               | Infrastruktur-Team | Ja      |
| Schnittstellenbeschreibungen    | Entwicklung        | Ja      |
| Betriebskonzept                 | Operations         | Empfohlen |

### 6.3.3 Aktivitäten

Neben der Erfassung von Prozessen, Datenspeichern und Assets werden in dieser Phase auch physische und logische Interfaces systematisch identifiziert.
Dazu zählen beispielsweise USB-, JTAG- oder RS232-Ports, Netzwerkanschlüsse, Touchscreens sowie Wartungs- und Debug-Schnittstellen.
Auch logische Schnittstellen wie APIs oder softwarebasierte Kommunikationskanäle werden berücksichtigt.

Jedes Interface erhält eine eindeutige ID (IF-xx) und wird mit den relevanten Assets, Prozessen und Datenflüssen verknüpft.
Die dokumentierte Erfassung der Interfaces bildet die Grundlage für die STRIDE-Analyse und ermöglicht, Gefährdungen zu erkennen,
die in einer klassischen STRIDE-Analyse per Element oder per Interaction sonst unberücksichtigt blieben.

Die Aktivitäten im Workflow umfassen:

```txt
┌────────────────────────────────────┐
│     DFD-MODELLIERUNG WORKFLOW      │
└────────────────────────────────────┘

     ┌───────────────────┐
     │ 1. Scope &        │
     │    Architektur-   │
     │    übersicht      │
     └─────────┬─────────┘
               │
               ▼
     ┌───────────────────┐
     │ 2. Systemelemente │
     │    erfassen       │
     │    (Prozesse,     │
     │    Speicher,      │
     │    Entitäten)     │
     └─────────┬─────────┘
               │
               ▼
     ┌───────────────────┐
     │ 2a. Assets        │
     │     identifizieren│
     │     & markieren   │
     │     (A-xx)        │
     └─────────┬─────────┘
               ▼
     ┌───────────────────┐
     │ 3. Datenflüsse    │
     │    modellieren    │
     │    (mit IDs)      │
     └─────────┬─────────┘
               │
               ▼
     ┌───────────────────┐
     │ 4. Trust          │
     │    Boundaries     │
     │    einzeichnen    │
     └─────────┬─────────┘
               │
               ▼
     ┌───────────────────┐
     │ 5. Interfaces     │
     │    identifizieren │
     │    (physisch)     │
     └─────────┬─────────┘
               │
               ▼
     ┌───────────────────┐
     │ 6. Validierung    │
     │    (Checkliste)   │
     └───────────────────┘
```

### 6.3.4 DFD-Notation

> **Hinweis:** Durch die Einführung eigener DFD-Elemente für Interfaces können Bedrohungen systematisch erfasst werden, die sonst weder bei STRIDE per Interaction noch per Element berücksichtigt würden.

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DFD-SYMBOLE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EXTERNAL ENTITY              PROCESS                   PROCESS             │
│  (Rechteck)                   (Kreis)                   (Rechteck mit       │
│                                                          Halbkreisen)       │
│  ┌─────────────┐              ╭───────╮                 (─────────)         │
│  │             │              │       │                 │         │         │
│  │   Entity    │              │Process│                 │ Process │         │
│  │             │              │       │                 │         │         │
│  └─────────────┘              ╰───────╯                 (─────────)         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATA STORE                   DATA FLOW                 TRUST BOUNDARY      │
│  (Parallele Linien)           (Pfeil mit Label)         (Gestrichelte Linie)│
│                                                                             │
│  ═══════════════              ─────────────────▶        ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│     Data Store                    [D1] Data             ┊                 ┊ │
│  ═══════════════                                        ┊  Trust Zone     ┊ │
│                                                         ┊                 ┊ │
│                                                         ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MULTI-PROCESS                           INTERFACE                          │
│  (Doppelter Kreis –                      (Gestricheltes Quadrat an          │
│   verschachteltes DFD)                    Trust Boundary – physische        │
│                                           Schnittstelle)                    │
│  ╭───────────╮                                                              │
│  │ ╭───────╮ │                           ┌ ─ ─ ─ ─ ─ ┐                      │
│  │ │ Multi │ │                           │           │                      │
│  │ │Process│ │                           │ Interface │                      │
│  │ ╰───────╯ │                           │  (IF-xx)  │                      │
│  ╰───────────╯                           └ ─ ─ ─ ─ ─ ┘                      │
│                                                                             │
│  Verweis auf Detail-DFD                  Markiert physische Übergänge:      │
│  auf tieferer Ebene                      • USB, JTAG, CAN-Bus               │
│                                          • Netzwerk-Ports                   │
│                                          • Debug-Interfaces                 │
│                                          • Wartungszugänge                  │
│                                                                             │
│  ASSET                                                                      │
│  (Rechteck, farblich hervorgehoben – rot/orange)                            │
│                                                                             │
│  ┌─────────────┐                                                            │
│  │   Asset     │                                                            │
│  │   (A-01)    │                                                            │
│  └─────────────┘                                                            │
│                                                                             │
│  Repräsentiert schützenswerte Werte wie:                                    │
│  • Daten (z. B. Credentials, Konfigurationsdaten)                           │
│  • Funktionen / Services                                                    │
│  • Sicherheitsrelevante Zustände                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3.5 DFD-Beispiel

```txt
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
┊                              EXTERNAL ZONE                                 ┊
┊                                                                            ┊
┊    ┌─────────────┐              ┌─────────────┐                            ┊
┊    │   Operator  │              │  Externer   │                            ┊
┊    │  Terminal   │              │   Service   │                            ┊
┊    │   (EE-01)   │              │   (EE-02)   │                            ┊
┊    └──────┬──────┘              └──────┬──────┘                            ┊
┊           │                            │                                   ┊
┊           │ [D1] Commands              │ [D2] API Requests                 ┊
┊           ▼                            ▼                                   ┊
┊    ┌ ─ ─ ─ ─ ─ ─ ┐              ┌ ─ ─ ─ ─ ─ ─ ┐                            ┊
┊    │  Interface  │              │  Interface  │                            ┊
┊    │   (IF-01)   │              │   (IF-02)   │                            ┊
┊    │   Serial    │              │   HTTPS     │                            ┊
┊    └ ─ ─ ─ ─ ─ ─ ┘              └ ─ ─ ─ ─ ─ ─ ┘                            ┊
┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
             │                           │
┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
┊            │                           │                                    ┊
┊            │        CONTROLLER ZONE    │                                    ┊
┊            ▼                           ▼                                    ┊
┊      ╭───────────╮              ╭─────────────╮                             ┊
┊      │           │  [D3] Data   │             │                             ┊
┊      │  Command  │─────────────▶│    API      │                             ┊
┊      │ Processor │              │   Gateway   │                             ┊
┊      │  (P-01)   │              │   (P-02)    │                             ┊
┊      ╰─────┬─────╯              ╰──────┬──────╯                             ┊
┊            │                           │                                    ┊
┊            │ [D4] Control Signals      │ [D5] Queries                       ┊
┊            │                           │                                    ┊
┊            │      ╭───────────────╮    │                                    ┊
┊            │      │ ╭───────────╮ │    │                                    ┊
┊            └─────▶│ │  Business │ │◀───┘                                    ┊
┊                   │ │   Logic   │ │                                         ┊
┊                   │ │  (MP-01)  │ │◀─── Verweis auf Detail-DFD              ┊
┊                   │ ╰───────────╯ │                                         ┊
┊                   ╰───────┬───────╯                                         ┊
┊                           │                                                 ┊
┊                           │ [D6] Read/Write                                 ┊
┊                           ▼                                                 ┊
┊                   ═══════════════════                                       ┊
┊                      Configuration                                          ┊
┊                        Database                                             ┊
┊                       (DS-01)                                               ┊
┊                   ═══════════════════                                       ┊
┊                                                                             ┊
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

### 6.3.6 Validierungs-Checkliste

| Prüfpunkt                                          | Status |
|----------------------------------------------------|--------|
| Alle Systemkomponenten im DFD enthalten            | ☐ |
| Alle externen Entitäten identifiziert              | ☐ |
| Alle Datenflüsse mit eindeutiger ID versehen       | ☐ |
| Alle Trust Boundaries markiert                     | ☐ |
| Alle physischen Interfaces gekennzeichnet          | ☐ |
| Multi-Processes für komplexe Subsysteme verwendet  | ☐ |
| DFD konsistent mit Architekturdokumentation        | ☐ |
| DFD versioniert im Repository                      | ☐ |
| Alle Assets im DFD identifiziert und referenziert  | ☐ |
| Alle DFD-Elemente textuell beschrieben             | ☐ |

### 6.3.7 Asset-Modellierung im DFD

Assets stellen schützenswerte Werte innerhalb des Systems dar und werden bereits in Phase 1 direkt im DFD modelliert.

Ein Asset kann unterschiedlicher Natur sein, unter anderem:

- Daten (z. B. personenbezogene Daten, Konfigurationsdaten, Schlüsselmaterial)
- Funktionale Fähigkeiten (z. B. Steuerlogik, Update-Funktion)
- Systemzustände (z. B. Betriebsmodi, Sicherheitszustände)

Assets werden im DFD als eigenständige Elemente dargestellt und eindeutig referenziert.

**Notation:**

- Darstellung als farblich hervorgehobenes Rechteck (rot/orange)
- Eindeutige Kennzeichnung: `A-xx`
- Verknüpfung mit Prozessen, Datenspeichern oder Datenflüssen

Die Modellierung von Assets in Phase 1 dient ausschliesslich der Identifikation und strukturellen Zuordnung.  
Eine Bewertung von Schutzbedarf oder Impact erfolgt erst in Phase 2.

### 6.3.8 Beschreibung von DFD-Elementen

Alle DFD-Elemente müssen zusätzlich zur grafischen Darstellung textuell beschrieben werden.  
Ziel ist ein einheitliches Verständnis des Systemmodells sowie eine nachvollziehbare und auditierbare Dokumentation.

Für jedes DFD-Element sind mindestens folgende Attribute zu erfassen:

| Attribut        | Beschreibung                      |
|-----------------|-----------------------------------|
| Funktion        | Zweck und Aufgabe des Elements    |
| Sicherheit      | Relevanz für die Systemsicherheit |
| Trust Level     | Implizite Vertrauensannahmen      |
| Security Level  | Technischer Absicherungsgrad      |
| Klassifikation  | z.B. intern, vertraulich, reguliert |

Optional können weitere Attribute ergänzt werden, z. B.:

- Annahmen und Einschränkungen
- Exposition (intern, extern, physisch zugänglich)
- Technischer oder organisatorischer Owner

Diese Beschreibung ist verpflichtend für:

- Prozesse
- Datenspeicher
- Assets
- Interfaces

Die strukturierten Elementbeschreibungen bilden eine zentrale Grundlage für:

- die Bedrohungsidentifikation (Phase 3)
- die Risikobewertung (Phase 4)
- Audits und Re-Assessments

### 6.3.10 Output

| Artefakt                | Format            | Beschreibung                        |
|-------------------------|-------------------|-------------------------------------|
| DFD                     | Grafik + XML/JSON | Vollständiges Datenflussdiagramm    |
| Element-Liste           | Tabelle           | Alle DFD-Elemente mit IDs           |
| Trust-Boundary-Register | Tabelle           | Alle Vertrauensgrenzen dokumentiert |
| Interface-Liste         | Tabelle           | Physische Schnittstellen            |

---

## 6.4 Phase 2: Asset-Definition und Schutzziele

**Referenz:** Formalisierung von Kapitel 2.2

Diese Phase überführt die in Phase 1 identifizierten Assets in eine formale Bewertung.  
Für jedes Asset werden Schutzbedarf, Kritikalität und relevante Schutzziele systematisch festgelegt.

Diese Phase markiert den Übergang von der Systemmodellierung zur sicherheitsrelevanten Bewertung.  
Alle nachfolgenden Analyse- und Bewertungsaktivitäten beziehen sich verbindlich auf die in Phase 2 festgelegten Schutzziele und Kritikalitäten.

Erst durch die Zuordnung von Schutzzielen wird eine konsistente Priorisierung von Bedrohungen und Risiken möglich.

Die in dieser Phase getroffenen Entscheidungen sind revisionsrelevant und bilden einen zentralen Bestandteil der Audit- und Governance-Fähigkeit des TARA-Prozesses.

### 6.4.1 Ziele

| Ziel            | Beschreibung                                    |
|-----------------|-------------------------------------------------|
| Vollständigkeit | Alle wertvollen Systembestandteile erfasst      |
| Priorisierung   | Kritikalität nach Business- und Physical-Impact |
| Schutzziele     | Schutzziele – Asset-zentrierte Sicherheitsziele (CIANAAA) als Grundlage für spätere STRIDE- oder Attack Tree Analyse |
| Traceability    | Verknüpfung zu DFD-Elementen                    |

### 6.4.2 Inputs

| Input                             | Quelle           | Pflicht        |
|-----------------------------------|------------------|----------------|
| Validiertes DFD                   | Phase 1          | Ja             |
| Element-Liste                     | Phase 1          | Ja             |
| Asset-Liste (Phase-1-Sicht)       | Phase 1          | Ja             |
| Element-Beschreibungen            | Phase 1          | Ja             |
| Business-Anforderungen            | Product Owner    | Ja             |
| Compliance-Anforderungen          | Legal/Compliance | Empfohlen      |
| Safety-Anforderungen              | Safety-Team      | Falls relevant |

### 6.4.3 Aktivitäten

```txt
┌───────────────────────────────────────────────────────────────────────┐
│                    ASSET-DEFINITION WORKFLOW                          │
└───────────────────────────────────────────────────────────────────────┘

  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
  │ 1. Assets     │     │ 2. Zuordnung  │     │ 3. Impact-    │
  │ inventari-    │────▶│ zu DFD-       │────▶│ Bewertung     │
  │ sieren        │     │ Elementen     │     │ (ohne Risiko) │
  └───────────────┘     └───────────────┘     └───────┬───────┘
                                                      │
  Asset-Kategorien:      Verknüpfung mit:             │
  • Daten                • Processes (P-xx)           │
  • Systeme              • Data Stores (DS-xx)        ▼
  • Infrastruktur        • Data Flows (D-xx)   ┌───────────────┐
  • Prozesse             • Interfaces (IF-xx)  │ Impact-       │
  • Rollen & Akteure                           │ Domänen:      │
    (z.B. Operator)                            │ • Business    │
                                               │ • Physical    │
                                               └───────┬───────┘
                                                       │
                                                       ▼
  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
  │ 6. Asset-     │     │ 5. Formelle   │     │ 4. CIANAAA-   │
  │ Security-     │◀────│ Schutzziele   │◀────│ Kategorien    │
  │ Mapping       │     │ formulieren   │     │ zuordnen      │
  └───────────────┘     └───────────────┘     └───────────────┘

  Zentrale Referenz-     Prüfbare, messbare   Kategorien:
  tabelle für alle       Ziele pro Asset      • Confidentiality (C)
  Folgephasen            formulieren und      • Integrity (I)
                         verbindlich          • Availability (A)
                         festlegen            • Non-Repudiation (N)
                                              • Authentication (AuthN)
                                              • Authorization (AuthZ)
                                              • Accountability (Acc)
```

> **Hinweis:** Phase 2 übernimmt die in Phase 1 identifizierten Assets (6.3.7) und ergänzt diese bei Bedarf. Die Asset-Liste aus Phase 1 ist der verbindliche Startpunkt.

### 6.4.4 Impact-Bewertung

**Zwei Impact-Domänen:**

| Domäne                         | Kriterien | Beispiele |
|--------------------------------|--------------------------|-----------|
| **Business / Organisatorisch** | Financial Damage, Regulatory/Compliance, Reputation, Operational Impact, Affected Users, Recoverability | Betriebsunterbrechung, Bussgelder, Imageverlust |
| **Physical / Safety**          | Safety, Physical Asset Damage, Environmental Impact, Supply Chain | Personenschaden, Gerätezerstörung, Umweltschaden |

**Anpassbarkeit der Impact-Kriterien:**

Die oben aufgeführten Kriterien sind **Beispiele** und können organisationsspezifisch angepasst werden:

**Erlaubte Anpassungen:**
- ✅ **Eigene Kriterien definieren:** z.B. "Brand Value Impact", "Strategic Competitive Advantage", "Supply Chain Dependency"
- ✅ **Kriterien-Gewichtung:** z.B. Compliance 2×, Financial 1×, Reputation 1.5×
- ✅ **Branchenspezifische Kriterien:** 
  - Medical: "Patient Safety Impact", "Clinical Trial Integrity"
  - Automotive: "Vehicle Safety", "Recall Risk"
  - Energy: "Grid Stability", "Environmental Compliance"
- ✅ **Kriterien entfernen:** Wenn nicht relevant (z.B. "Affected Users" bei reinen B2B-Systemen)

**Standard-Kriterien (empfohlen, wenn keine spezifischen Anforderungen):**

| Domäne | Kriterien | Anpassbar? | Verpflichtend? |
|--------|-----------|------------|----------------|
| Business | Financial Damage, Regulatory/Compliance, Reputation, Operational Impact, Affected Users, Recoverability | ✅ Ja | ⚠️ Mindestens 3 Kriterien empfohlen |
| Physical | Safety, Physical Asset Damage, Environmental Impact, Supply Chain | ✅ Ja | ⚠️ Falls System physische Komponenten hat |

**Wichtig:** 
- Alle gewählten Kriterien und deren Gewichtung müssen in **Phase 0 (Projektprofil, 6.2.5)** dokumentiert werden
- Die Kriterien-Auswahl muss für das gesamte Projekt konsistent bleiben
- Änderungen erfordern ein Re-Assessment (siehe 6.7.4)

**Beispiel: Angepasste Impact-Bewertung (Medical Device)**

| Domäne | Kriterien | Gewichtung |
|--------|-----------|------------|
| Business | Regulatory/Compliance (FDA), Reputation, Operational Impact | 2× / 1.5× / 1× |
| Physical | **Patient Safety** (angepasst), Device Damage, Environmental Impact | 3× / 1× / 0.5× |

> **Hinweis:** Auch andere Skalen sind valide. Abhängig vom Projektkontext und den Anforderungen können z. B. **3-Stufen- oder 5-Stufen-Skalen** eingesetzt werden. Die Methode bleibt dabei unverändert – es ändert sich nur die Granularität der Bewertung.


**4-Stufen-Skala:**

| Stufe    | Wert | Beschreibung                                   |
|----------|------|------------------------------------------------|
| Kritisch | 4    | Existenzbedrohend, Personenschaden möglich     |
| Hoch     | 3    | Erheblicher Schaden, signifikante Auswirkungen |
| Mittel   | 2    | Moderater Schaden, begrenzte Auswirkungen      |
| Niedrig  | 1    | Geringer Schaden, leicht behebbar              |

**Konservatives Prinzip:** Gesamtkritikalität = höchster bewerteter Einzel-Impact (Highest-Impact-Wins)
**Mittelwert Prinzip:** Gesamtkritikalität = Durchschnitt aus allen Werten

### 6.4.5 Asset-Security-Mapping (Template)

| ID   | Asset-Name       | Asset Beschreibung | Finanzieller Schaden | Regulatorisch / Compliance | Reputation / Marke | Operational Impact | Safety Impact | Gesamt Impact | Schutzziele (CIANAAA) | Formelle Schutzziele | DFD-Ref |
|------|------------------|--------------------|----------------------|----------------------------|--------------------|--------------------|---------------|---------------|----------------------|---------------------|---------|
| A001 | Produktionsdaten | Geschäfts- und produktionsrelevante Daten zur Steuerung, Optimierung und Nachverfolgbarkeit von Betriebsprozessen. | Hoch | Kritisch | Hoch | Mittel | Niedrig | Kritisch | C, I, A, AuthN, AuthZ, Acc | Die Produktionsdaten müssen vor unbefugter Offenlegung (Confidentiality), unautorisierter oder unbeabsichtigter Veränderung (Integrity) sowie vor Verlust oder Nichtverfügbarkeit (Availability) geschützt werden. Zugriffe müssen eindeutig authentisiert (Authentication), autorisiert (Authorization) und revisionssicher nachvollziehbar sein (Accountability). | DS-01 |
| A002 | Steuergerät HW   | Physisches Steuergerät zur Ausführung sicherheitskritischer Steuerungs- und Regelungsfunktionen im Systembetrieb. | Mittel | Hoch | Mittel | Hoch | Kritisch | Kritisch | I, A, AuthN, AuthZ, Acc | Das Steuergerät darf Steuerbefehle nur von eindeutig authentisierten und autorisierten Entitäten akzeptieren (Authentication, Authorization). Die korrekte und unverfälschte Ausführung der Steuerlogik (Integrity) sowie die kontinuierliche Betriebsbereitschaft (Availability) müssen jederzeit gewährleistet sein. Sicherheitsrelevante Aktionen sind revisionssicher zu protokollieren (Accountability). | P-01, IF-01 |
| A003 | Firmware-Update  | Prozess zur Erstellung, Verteilung und Installation von Firmware, der die Funktionalität und Sicherheit des Systems beeinflusst. | Hoch | Kritisch | Hoch | Hoch | Mittel | Kritisch | I, A, N, AuthN, AuthZ | Firmware-Updates dürfen ausschliesslich aus vertrauenswürdigen Quellen stammen (Authentication), müssen unverändert und vollständig installiert werden (Integrity) und dürfen nicht abgestritten werden können (Non-Repudiation). Der Update-Prozess muss autorisiert, kontrolliert und verfügbar sein, ohne den sicheren Betrieb zu gefährden (Authorization, Availability). | MP-01 |
| A004 | API-Credentials  | Geheimnisse und Zugangsdaten zur Authentisierung und Autorisierung der System-zu-System-Kommunikation. | Mittel | Hoch | Hoch | Mittel | Niedrig | Hoch | C, AuthN, AuthZ, Acc | API-Zugangsdaten müssen strikt vertraulich behandelt werden (Confidentiality) und dürfen ausschliesslich von authentisierten und autorisierten Kommunikationspartnern verwendet werden (Authentication, Authorization). Nutzung und Missbrauch müssen nachvollziehbar protokolliert werden (Accountability). | D2, P-02 |

### 6.4.6 Output

| Artefakt                               | Phase/Schritt | Format       | Beschreibung                                                         |
|----------------------------------------|---------------|--------------|----------------------------------------------------------------------|
| Asset-Tabelle                          | 1–2           | Tabelle      | Alle Assets mit Klassifizierung                                      |
| Impact-Bewertungen                     | 3             | Dokumentiert | Begründungen für Kritikalitätseinstufungen                           |
| Asset-Security-Mapping                 | 4–6           | Tabelle      | Zentrale Referenz mit DFD-Verknüpfung                                |
| Asset-basierte Attack Goals (optional) | 6             | Tabelle      | Formale Angriffsziele pro kritischem Asset, Basis für optionale Attack Trees |

---

## 6.5 Phase 3: Bedrohungsanalyse

**Referenz:** Formalisierung von Kapitel 2.5, 2.6 und 4

Diese Phase identifiziert und bewertet Bedrohungen systematisch, basierend auf den in Phase 2 definierten Assets und Schutzzielen. 
Je nach Workflow-Variante kommen STRIDE-Analysen, optionale Attack Trees oder beide kombiniert zum Einsatz.
Die Ergebnisse bilden die Basis für die Risiko-Bewertung in Phase 4.

### 6.5.1 Ziele

| Ziel                   | Beschreibung                                                                |
| ---------------------- | --------------------------------------------------------------------------- |
| **Asset-fokussierte Priorisierung** | Threats werden nach Asset-Kritikalität priorisiert: HIGH/CRITICAL Assets → vorrangige Analyse |
| Vollständigkeit        | Alle relevanten Bedrohungen für Assets, Datenflüsse und Interfaces erfassen |
| Konsistenz             | Einheitliche Methode zur Bedrohungsidentifikation und -bewertung            |
| Nachvollziehbarkeit    | Dokumentation aller Threats mit Bezug zu Assets und DFD-Elementen           |
| Entscheidungsgrundlage | Basis für Priorisierung, Risikoanalyse und Mitigationsplanung               |

**Priorisierungs-Regel:**

Die Analyse-Tiefe richtet sich nach der Asset-Kritikalität (aus Phase 2):

| Asset-Impact | Analyse-Ansatz | Methode |
|--------------|----------------|---------|
| **CRITICAL** | Tiefenanalyse mit Attack Trees (empfohlen) | Variante B oder STRIDE + Attack Trees |
| **HIGH** | Detailliertes STRIDE, Attack Trees optional | STRIDE per Element/Interaction |
| **MEDIUM/LOW** | Standard-STRIDE | STRIDE per Interaction (effizient) |

> **Wichtig:** Diese Priorisierung betrifft die **Analyse-Tiefe**, nicht die **Vollständigkeit**. Alle Threats müssen erfasst werden, auch für LOW-Impact-Assets. Die Priorisierung optimiert lediglich den Ressourcen-Einsatz.

**Beispiel-Workflow bei großen Systemen (>50 DFD-Elemente):**

1. Phase 1: Alle CRITICAL Assets analysieren (Attack Trees)
2. Phase 2: Alle HIGH Assets analysieren (STRIDE detailliert)
3. Phase 3: MEDIUM/LOW Assets (STRIDE Basis)

### 6.5.2 Entscheidungspunkt: Workflow-Auswahl

```txt
┌───────────────────────────────────────────────────────────────────┐
│          ENTSCHEIDUNGSMATRIX: WORKFLOW-AUSWAHL                    │
└───────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │                  PRÜFFRAGEN                                 │
  │                                                             │
  │  1. Enthält das System Assets mit kritischem Impact?        │
  │  2. Ist das System safety-relevant (OT/ICS/Medical)?        │
  │  3. Handelt es sich um eine neue/unbekannte Architektur?    │
  │  4. Gibt es hohe Compliance-Anforderungen?                  │
  │  5. Steht ausreichend Zeit/Expertise für tiefe Analyse?     │
  └─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
         ≤ 2× JA                          ≥ 3× JA
              │                               │
              ▼                               ▼
    ┌─────────────────┐            ┌─────────────────┐
    │   VARIANTE A    │            │   VARIANTE B    │
    │                 │            │                 │
    │  STRIDE-first   │            │  Attack-Tree    │
    │                 │            │     first       │
    │  → 6.5.2        │            │  → 6.5.3        │
    └─────────────────┘            └─────────────────┘
```

**Entscheidungsmatrix (erweitert):**

| Kriterium | Bewertung | Begründung |
|-----------|-----------|------------|
| **Systemkritikalität (Phase 0)** | Standard / Kritisch | Aus Phase 0 übernommen |
| Kritische Assets | Ja/Nein | |
| Safety-Relevanz | Ja/Nein | |
| Neue Architektur | Ja/Nein | |
| Compliance-Anforderungen | Ja/Nein | |
| Ressourcen verfügbar | Ja/Nein | |
| **Gewählte Variante** | A / B | |

**Entscheidungsregel:**
- **Kritisches System (Phase 0) → Variante B (Attack-Tree-first) empfohlen**
- Standard-System + ≤ 2× JA → Variante A
- Standard-System + ≥ 3× JA → Variante B

### 6.5.3 Variante A: STRIDE-first

**Wichtig:** Pro STRIDE-Kategorie wird ein separater Threat-Eintrag erstellt, auch wenn der zugrunde liegende Angriff identisch ist (z.B. SQL Injection betrifft sowohl Tampering als auch Information Disclosure).

```txt
┌──────────────────────────────────────────────────────────────────┐
│                 VARIANTE A: STRIDE-FIRST                         │
└──────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────┐
     │      STRIDE-ANALYSE                  │
     │  ┌────────────────────────────────┐  │
     │  │ 1. Methode wählen:             │  │
     │  │    • per Element               │  │
     │  │    • per Interaction           │  │
     │  │    • oder Kombination          │  │
     │  │                                │  │
     │  │ 2. Systematisch alle DFD-      │  │
     │  │    Elemente/Flows und          │  │
     │  │    Interfaces prüfen           │  │
     │  │                                │  │
     │  │ 3. Threats dokumentieren       │  │
     │  │    (Threat-Tabelle)            │  │
     │  │                                │  │
     │  │ 4. Initiale Mitigations        │  │
     │  │    zuordnen                    │  │
     │  └────────────────────────────────┘  │
     └──────────────────────────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Weiter zu       │
               │ Phase 4         │
               │ (6.6 Risiko-    │
               │  Bewertung)     │
               └─────────────────┘   
                        │
                        ▼                  
          ┌─────────────────────────────┐
          │  Attack Trees notwendig?    │
          │  (nach Phase 4)             │
          │                             │
          │  JA, wenn:                  │
          │  • Hoher Impact + unklare   │
          │    Likelihood               │
          │  • Mehrere Mitigations zur  │
          │    Auswahl                  │
          │  • Komplexe, mehrstufige    │
          │    Angriffspfade            │
          └─────────────────────────────┘
                   │          │
          NEIN     │          │     JA
                   │          │
                   ▼          ▼
          ┌─────────────────────────┐
          │ Attack Trees für        │
          │ Threats mit High/       │
          │ Critical Impact oder    │
          │ unklarer Likelihood     │
          │ erstellen               │
          └─────────────────────────┘
                       │
                       ▼
          ┌───────────────────────────────────────────────┐
          │ Feedback-Loop (6.5.5)                         │
          │ und ggf. Risiko-Bewertung aktualisieren (6.6) │
          └───────────────────────────────────────────────┘
```

**STRIDE-Methodenwahl:**

Die Wahl der Methode hängt von der System-Architektur und den Analyse-Zielen ab:

| Methode | Anwendungsfall | Beispiel | Entscheidungskriterien |
|---------|----------------|----------|------------------------|
| **STRIDE per Element** | Einzelne, abgegrenzte Komponenten | Embedded Device, Sensor, Firmware-Module | ✅ System hat klar abgegrenzte Module<br>✅ Wenige externe Interaktionen<br>✅ Fokus auf Komponenten-Sicherheit<br>✅ Statische Architektur<br>❌ Nicht geeignet für: Viele DFD-Flows |
| **STRIDE per Interaction** | Komplexe, vernetzte Systeme | Cloud-System, Mobile App, Microservices | ✅ Viele externe Schnittstellen<br>✅ Datenflüsse zwischen Trust Zones<br>✅ Fokus auf Kommunikations-Sicherheit<br>✅ Dynamische Interaktionen<br>❌ Nicht geeignet für: Isolierte Komponenten |
| **Hybrid** | Kombination beider | Verteilte Embedded-Systeme, IoT, OT/ICS | ✅ Sowohl isolierte Module als auch Netzwerk-Interaktionen<br>✅ Mehrstufige Architektur (Edge + Cloud)<br>✅ Empfohlen für: Safety-kritische vernetzte Systeme<br>⚠️ Höherer Analyse-Aufwand |

**Entscheidungsbaum:**

```txt
                    ┌─────────────────────────────┐
                    │ Hat das System mehr als     │
                    │ 10 externe Datenflüsse?     │
                    └──────────┬──────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
               JA                           NEIN
                │                             │
                ▼                             ▼
    ┌────────────────────────┐    ┌────────────────────────┐
    │ STRIDE per Interaction │    │ Sind Komponenten       │
    │                        │    │ physisch getrennt?     │
    │ Fokus: Trust Zones     │    └──────────┬─────────────┘
    │ & Datenflüsse          │               │
    └────────────────────────┘      ┌────────┴────────┐
                                    │                 │
                                   JA               NEIN
                                    │                 │
                                    ▼                 ▼
                        ┌────────────────────┐ ┌──────────────────┐
                        │ HYBRID             │ │ STRIDE per       │
                        │                    │ │ Element          │
                        │ Komponenten +      │ │                  │
                        │ Interaktionen      │ │ Fokus: Module    │
                        └────────────────────┘ └──────────────────┘
```

**Dokumentationspflicht:**

Die gewählte STRIDE-Methode muss in der **Workflow-Entscheidung (6.5.2)** dokumentiert werden:

| Kriterium | Bewertung | Begründung |
|-----------|-----------|------------|
| Systemkritikalität (Phase 0) | Standard / Kritisch | Aus Phase 0 übernommen |
| Kritische Assets | Ja/Nein | |
| Safety-Relevanz | Ja/Nein | |
| Neue Architektur | Ja/Nein | |
| Compliance-Anforderungen | Ja/Nein | |
| Ressourcen verfügbar | Ja/Nein | |
| **STRIDE-Methode** | **per Element / per Interaction / Hybrid** | **[Begründung basierend auf obigen Kriterien]** |
| **Gewählte Variante** | A / B | |

**Best Practices:**

- **Bei Unsicherheit:** Starte mit STRIDE per Interaction (umfassender)
- **Iteratives Vorgehen:** Bei Hybrid zuerst per Element, dann Interactions ergänzen
- **Tool-Unterstützung:** STRIDE per Interaction ist besser automatisierbar

### 6.5.4 Variante B: Attack-Tree-first

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VARIANTE B: ATTACK-TREE-FIRST                          │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────┐
     │    ATTACK GOALS ABLEITEN             │
     │  ┌────────────────────────────────┐  │
     │  │ 1. High-Impact Assets aus      │  │
     │  │    Phase 2 selektieren         │  │
     │  │                                │  │
     │  │ 2. Attack-Goal-Tags zuordnen:  │  │
     │  │    • Disclosure                │  │
     │  │    • Manipulation              │  │
     │  │    • Destruction               │  │
     │  │    • Service Disruption        │  │
     │  │    • Privilege Abuse           │  │
     │  │    • Impersonation             │  │
     │  │                                │  │
     │  │ 3. Formelle Attack Goals       │  │
     │  │    formulieren                 │  │
     │  └────────────────────────────────┘  │
     └──────────────────────────────────────┘
                        │
                        ▼
     ┌──────────────────────────────────────┐
     │      ATTACK TREES MODELLIEREN        │
     │  ┌────────────────────────────────┐  │
     │  │ Pro Attack Goal:               │  │
     │  │                                │  │
     │  │ 1. Root Node = Attack Goal     │  │
     │  │                                │  │
     │  │ 2. Top-Level Angriffspfade     │  │
     │  │    identifizieren              │  │
     │  │                                │  │
     │  │ 3. AND/OR-Knoten modellieren   │  │
     │  │                                │  │
     │  │ 4. Likelihood pro Pfad         │  │
     │  │    bewerten                    │  │
     │  │                                │  │
     │  │ 5. Mitigations an Knoten       │  │
     │  │    zuordnen                    │  │
     │  └────────────────────────────────┘  │
     └──────────────────────────────────────┘
                        │
                        ▼
     ┌─────────────────────────────────────────────┐
     │      STRIDE-VALIDIERUNG                     │
     │  ┌───────────────────────────────────────┐  │
     │  │ 1. STRIDE per Element/Interaction     │  │
     │  │    durchführen                        │  │
     │  │                                       │  │
     │  │ 2. Abgleich mit Attack Trees:         │  │
     │  │    • Fehlende Kategorien?             │  │
     │  │    • Nicht abgedeckte Threats?        │  │
     │  │                                       │  │
     │  │ 3. Threat-Tabelle                     │  │
     │  │    vervollständigen                   │  │
     │  └───────────────────────────────────────┘  │
     └─────────────────────────────────────────────┘
                        │
                        ▼
               ┌────────────────┐
               │ Feedback-Loop  │
               │ (6.5.5)        │
               └────────────────┘
```

**Attack Tree Struktur:**

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ATTACK TREE BEISPIEL                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │      ROOT NODE              │
                    │   (Attack Goal)             │
                    │   "Zugriff auf Konfig-DB"   │
                    │   [Asset: A001, DS-01]      │
                    └──────────────┬──────────────┘
                                   │
                          ┌────────┴────────┐
                          │       OR        │
                          └────────┬────────┘
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
           ┌───────────────┐ ┌───────────┐ ┌───────────────┐
           │ SQL Injection │ │  Insider  │ │  Physischer   │
           │ via API       │ │  Threat   │ │    Zugang     │
           │               │ │           │ │  via IF-01    │
           │ [T-001]       │ │ [T-002]   │ │  [T-003]      │
           └───────┬───────┘ └─────┬─────┘ └───────┬───────┘
                   │               │               │
          ┌────────┴────────┐      │      ┌────────┴────────┐
          │      AND        │      │      │      AND        │
          └────────┬────────┘      │      └────────┬────────┘
          ┌────────┴────────┐      │      ┌────────┴────────┐
          ▼                 ▼      │      ▼                 ▼
   ┌─────────────┐  ┌─────────────┐│ ┌─────────────┐  ┌─────────────┐
   │ Unvalidierte│  │ DB-Zugriff  ││ │ Zugang zum  │  │ Credentials │
   │ Eingaben    │  │ von API     ││ │ Serverraum  │  │ erlangen    │
   │             │  │ erreichbar  ││ │             │  │             │
   └─────────────┘  └─────────────┘│ └─────────────┘  └─────────────┘
                                   │
   [L: Medium]      [L: High]      │  [L: Low]        [L: Low]
   [M: Input Val.]  [M: Network    │  [M: Zutritts-   [M: MFA,
                     Segmentation] │   kontrolle]      Rotation]

   L = Likelihood, M = Mitigation
```

### 6.5.5 Feedback-Loop: STRIDE ↔ Attack Trees

Dieser Schritt ist primär für kritische Systeme (Variante B: Attack-Tree-first) vorgesehen und wird in Standard-Systemen nur angewendet, wenn Attack Trees eingesetzt werden.

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FEEDBACK-LOOP PROZESS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────┐
     │                     ABGLEICH-PRÜFUNG                             │
     │                                                                  │
     │  ┌────────────────────────┐    ┌────────────────────────┐        │
     │  │    STRIDE THREATS      │    │    ATTACK TREES        │        │
     │  │                        │    │                        │        │
     │  │  T-001: SQL Injection  │◀──▶│  Pfad: SQL Injection   │  ✓     │
     │  │  T-002: Insider        │◀──▶│  Pfad: Insider         │  ✓     │
     │  │  T-003: Physical       │◀──▶│  Pfad: Physical        │  ✓     │
     │  │  T-004: XSS            │    │  ???                   │  ⚠     │
     │  │  ???                   │    │  Pfad: Supply Chain    │  ⚠     │
     │  │                        │    │                        │        │
     │  └────────────────────────┘    └────────────────────────┘        │
     │                                                                  │
     └──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │                     PRÜFFRAGEN                                   │
     │                                                                  │
     │  1. Sind alle Attack-Tree-Pfade durch STRIDE-Threats abgedeckt?  │
     │  2. Gibt es STRIDE-Threats ohne entsprechenden Angriffspfad?     │
     │  3. Sind die Likelihood-Schätzungen konsistent?                  │
     │  4. Sind die Mitigations vollständig und plausibel?              │
     │                                                                  │
     └──────────────────────────────────────────────────────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       │    Lücken gefunden?     │
                       └────────────┬────────────┘
                              │           │
                             JA         NEIN
                              │           │
                              ▼           ▼
                    ┌─────────────────┐  ┌─────────────────┐
                    │   ITERATION     │  │   WEITER ZU     │
                    │                 │  │   PHASE 4       │
                    │ • Fehlende      │  │                 │
                    │   Threats       │  │                 │
                    │   ergänzen      │  │                 │
                    │                 │  │                 │
                    │ • Attack Trees  │  │                 │
                    │   erweitern     │  │                 │
                    │                 │  │                 │
                    │ • Likelihood    │  │                 │
                    │   anpassen      │  │                 │
                    └────────┬────────┘  └─────────────────┘
                             │
                             │ (Rücksprung zu 6.5.2 oder 6.5.3)
                             ▼
                    ┌─────────────────┐
                    │ Erneute         │
                    │ Analyse         │
                    └─────────────────┘
```

### 6.5.6 Threat-Tabelle (Template)

**Best Practice: Asset-basierte Analyse-Priorisierung**

Bei umfangreichen Systemen empfiehlt sich folgende Reihenfolge:
```txt
┌─────────────────────────────────────────────────────┐
│  ASSET-BASIERTE THREAT-ANALYSE-STRATEGIE           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1️⃣ CRITICAL Assets (aus Phase 2)                   │
│     → Attack Trees + STRIDE Validierung            │
│     → Hohe Analyse-Tiefe                           │
│                                                     │
│  2️⃣ HIGH Assets                                      │
│     → STRIDE per Element/Interaction               │
│     → Attack Trees bei Unklarheit                  │
│                                                     │
│  3️⃣ MEDIUM/LOW Assets                               │
│     → STRIDE per Interaction (effizient)           │
│     → Fokus auf Standard-Bedrohungen               │
│                                                     │
│  ✅ Resultat: Optimaler Ressourcen-Einsatz          │
│     ohne Verlust der Vollständigkeit               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Hinweis zur Vollständigkeit:**
- Alle DFD-Elemente müssen analysiert werden (auch ohne direkten Asset-Bezug)
- Die Priorisierung betrifft nur die Analyse-Tiefe und Methodenwahl
- Interfaces und Trust Boundaries sind unabhängig von Assets immer zu prüfen

**ID-Konvention:** `<Element>-<STRIDE-Kategorie>-<Laufnummer>`

**Regel:** Ein Threat entspricht **genau einer** STRIDE-Kategorie. Wenn ein Angriff mehrere STRIDE-Kategorien betrifft, wird er in separate Threats aufgeteilt, da:
- Likelihood/Impact pro Kategorie unterschiedlich sein können
- Mitigations oft kategoriespezifisch sind
- Status-Tracking granular erfolgen muss

| Threat ID | STRIDE | Threat Description | Asset-Ref | DFD-Ref | Threat Actor | Attack Vector | Initiale Mitigation | Methode |
|-----------|--------|-------------------|-----------|---------|--------------|---------------|---------------------|---------|
| P2-T-1 | T | SQL Injection: Unauthorized data modification via API | A001 | P-02 | External | HTTPS/API | Prepared statements | STRIDE |
| P2-I-1 | I | SQL Injection: Sensitive data disclosure via API | A001 | P-02 | External | HTTPS/API | Input validation | STRIDE |
| DS1-S-1 | S | Unauthorized access to data store via stolen credentials | A001 | DS-01 | Internal | Local Access | MFA + RBAC | STRIDE |
| DS1-E-1 | E | Insider denies unauthorized data export | A001 | DS-01 | Internal | Local Access | Audit logging | STRIDE |
| IF1-T-1 | T | Physical manipulation of serial interface | A002 | IF-01 | External | Physical | Tamper-evident seals | Attack Tree |

>**Hinweis:** Bei komplexen Angriffen (z.B. SQL Injection) werden **beide betroffenen STRIDE-Kategorien als separate Threats** modelliert, um:
>- Unterschiedliche Risikoprofile abzubilden (z.B. Tampering vs. Disclosure)
>- Mitigations spezifisch zuzuordnen (z.B. Prepared Statements für Tampering, Output Encoding für Disclosure)
>- Granulares Status-Tracking zu ermöglichen

### 6.5.7 Output

| Artefakt                | Format           | Beschreibung                                            |
|-------------------------|------------------|---------------------------------------------------------|
| Threat-Tabelle          | Tabelle          | Vollständiger Gefahrenkatalog inkl. physischer Angriffe |
| Attack Trees            | Grafik + Tabelle | Pro kritisches Asset/Attack Goal                        |
| Feedback-Loop-Protokoll | Dokument         | Dokumentation der Iterationen                           |
| Workflow-Entscheidung   | Dokumentiert     | Begründung für Variante A/B                             |

---

## 6.6 Phase 4: Risiko-Bewertung

**Referenz:** Formalisierung von Kapitel 3.6

In dieser Phase werden die in Phase 3 identifizierten Bedrohungen systematisch bewertet.
Jedes Threat-Element wird hinsichtlich Wahrscheinlichkeit (Likelihood) und Auswirkung (Impact) analysiert, um die Risikopriorität zu bestimmen.

Die Risiko-Bewertung basiert auf den zuvor festgelegten Assets, Schutzzielen und Kritikalitäten.
Durch die kombinierte Betrachtung von Likelihood und Impact werden alle Risiken konsistent quantifiziert und priorisiert, was eine fundierte Entscheidungsgrundlage für Mitigationsmassnahmen, Ressourcenallokation und Governance bildet.

### 6.6.1 Ziele

| Ziel                   | Beschreibung                                         |
|------------------------|------------------------------------------------------|
| Konsistenz             | Reproduzierbare Bewertung nach definierten Kriterien |
| Priorisierung          | Klare Rangfolge der Risiken                          |
| Entscheidungsgrundlage | Basis für Massnahmenplanung                          |
| Flexibilität           | Anpassbare Skalen, Bewertungsmethoden und Aggregationsprinzipien je nach Projektkontext |

### 6.6.2 Konfiguration der Risiko-Bewertung

Die Risiko-Bewertung ist flexibel konfigurierbar. Alle Entscheidungen müssen in **Phase 0 (Projektprofil, 6.2.5)** dokumentiert werden.

**1. Skalen-Wahl**

| Skala | Stufen | Numerische Werte | Typische Anwendung |
|-------|--------|------------------|--------------------|
| **3-Stufen** | LOW / MEDIUM / HIGH | 1.0 / 2.0 / 3.0 | Schnelle Bewertung, agile Teams, Prototyping |
| **4-Stufen** | LOW / MEDIUM / HIGH / CRITICAL | 1.0 / 2.0 / 3.0 / 4.0 | Standard-IT-Systeme, ausgewogene Granularität |
| **5-Stufen** | LOW / MEDIUM / HIGH / VERY HIGH / CRITICAL | 1.0 / 2.0 / 3.0 / 4.0 / 5.0 | Hochregulierte Branchen, feine Differenzierung |

> **Empfehlung:** Wählen Sie die **kleinstmögliche Skala**, die ausreichend differenziert. Mehr Stufen = mehr Aufwand + höhere Subjektivität.

**2. Likelihood-Bewertungsmethode**

Die Methode zur Likelihood-Bewertung ist frei wählbar. Folgende Ansätze sind verbreitet:

| Ansatz | Beschreibung | Beispiel-Referenzen |
|--------|--------------|---------------------|
| **Faktor-basiert** | Bewertung nach definierten Faktoren (Threat Agent, Vulnerability, etc.) | OWASP Risk Rating, DREAD |
| **Potential-basiert** | Bewertung nach Angriffsaufwand (Zeit, Expertise, Equipment, etc.) | ISO 21434 (TVRA), Common Criteria |
| **Erfahrungs-basiert** | Bewertung durch Experteneinschätzung (z.B. Delphi-Methode) | FAIR, Custom Frameworks |
| **Daten-basiert** | Bewertung nach historischen Incident-Daten | VERIS, Breach Databases |

**Wichtig:** 
- Wählen Sie die Methode, die am besten zu Ihrem Kontext passt (verfügbare Daten, Expertise, regulatorische Anforderungen)
- Dokumentieren Sie die gewählte Methode und deren Faktoren in Phase 0
- Die Methode muss für das gesamte Projekt konsistent angewendet werden

**Beispiele für Likelihood-Faktoren:**

<details>
<summary><strong>Beispiel 1: OWASP-basiert (Faktor-basiert)</strong></summary>

**Threat Agent Factors:**
- Skill Level (1-9): Unskilled → Expert
- Motive (1-9): Low → High
- Opportunity (0-9): None → Unlimited
- Size (2-9): Individual → Nation State

**Vulnerability Factors:**
- Ease of Discovery (1-9): Impossible → Automated
- Ease of Exploit (1-9): Impossible → Automated
- Awareness (1-9): Unknown → Public Knowledge
- Intrusion Detection (1-9): Active → None

**Aggregation:** Durchschnitt oder Maximum der Faktoren

**Referenz:** [OWASP Risk Rating Methodology](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology)
</details>

<details>
<summary><strong>Beispiel 2: TVRA-basiert (Potential-basiert)</strong></summary>

**Attack Potential Factors (ISO 21434 Annex G):**
- Elapsed Time: < 1 day (0) → > 6 months (6)
- Specialist Expertise: Layman (0) → Expert (6)
- Knowledge of Target: Public (0) → Sensitive (7)
- Window of Opportunity: Unlimited (0) → Difficult (10)
- Equipment: Standard (0) → Specialized (4)

**Aggregation:** Summe der Faktoren

**Mapping:**
- 0-9: LOW
- 10-17: MEDIUM
- 18-24: HIGH
- 25+: CRITICAL

**Referenz:** ISO/SAE 21434 Annex G
</details>

<details>
<summary><strong>Beispiel 3: Vereinfachte Methode (Erfahrungs-basiert)</strong></summary>

**Single-Factor-Bewertung:**

"Wie wahrscheinlich ist es, dass dieser Threat in den nächsten 12 Monaten ausgenutzt wird?"

- **LOW:** Unwahrscheinlich (< 10% Chance)
- **MEDIUM:** Möglich (10-50% Chance)
- **HIGH:** Wahrscheinlich (> 50% Chance)
- **CRITICAL:** Sehr wahrscheinlich (> 80% Chance) oder bereits beobachtet

**Best Practice:** Diese Methode mit historischen Daten validieren (z.B. CVE-Datenbanken, Threat Intelligence)
</details>

> **Hinweis:** Falls keine Vorgaben existieren, ist eine faktor-basierte Methode (z.B. OWASP) ein guter Startpunkt. Diese kann später verfeinert werden.

**3. Impact-Aggregation**

| Prinzip | Formel | Use Case |
|---------|--------|----------|
| **Maximum (Konservativ)** | Overall Impact = **MAX**(Business, Physical) | Safety-kritische Systeme, regulatorische Compliance, "Worst-Case"-Ansatz |
| **Mittelwert (Balanced)** | Overall Impact = **AVG**(Business, Physical) | Balanced Scorecard, Risk/Reward-Abwägungen |
| **Gewichtet** | Overall Impact = **(w₁ × Business) + (w₂ × Physical)** | Spezifische Geschäftsanforderungen (z.B. w₁=0.7, w₂=0.3 für IT-lastige Systeme) |

> **Hinweis:** Es gibt keine "richtige" Wahl. Die Entscheidung hängt von der Risiko-Philosophie der Organisation ab.

**Dokumentationspflicht (Phase 0):**

Folgende Entscheidungen müssen im Projektprofil (6.2.5) festgehalten werden:
```markdown
## Risiko-Bewertungs-Konfiguration

### Skala
- **Likelihood:** [3/4/5]-Stufen
- **Impact:** [3/4/5]-Stufen

### Likelihood-Methode
- **Ansatz:** [Faktor-basiert / Potential-basiert / Erfahrungs-basiert / Daten-basiert]
- **Faktoren/Kriterien:**
  - [Liste der verwendeten Faktoren, z.B. "OWASP Threat Agent + Vulnerability Factors"]
- **Aggregation:** [Durchschnitt / Maximum / Andere]
- **Referenz:** [Link zu Standard/Methodik, falls vorhanden]

### Impact-Aggregation
- **Prinzip:** [Maximum / Mittelwert / Gewichtet]
- **Begründung:** [Warum wurde diese Methode gewählt?]

### Begründung der Konfiguration
[Kurze Erläuterung, warum diese spezifische Konfiguration für das Projekt gewählt wurde]
```

#### Konsistenz und Änderungen

**Konsistenz-Regel:**
- Die Konfiguration gilt für das **gesamte Projekt**
- Alle Threats werden mit der **gleichen Methode** bewertet
- Wechsel der Methode erfordert vollständiges Re-Assessment

**Änderungen:**
Änderungen an der Konfiguration erfordern ein **vollständiges Re-Assessment** (siehe 6.7.4), da:
- Risk-Scores nicht vergleichbar sind (z.B. 4-Stufen vs 5-Stufen)
- Likelihood-Faktoren unterschiedlich gewichtet werden
- Priorisierungen sich fundamental ändern können

#### Beispiel-Konfigurationen

| System-Typ | Skala | Likelihood-Methode | Impact-Aggregation | Begründung |
|------------|-------|-------------------|-------------------|------------|
| **Web Application** | 4-Stufen | OWASP-basiert (Faktor) | Mittelwert | Standard IT-Risiken, ausgewogene Business/Technical Impact |
| **Automotive ECU** | 5-Stufen | TVRA (Potential) | Maximum | ISO 21434 Compliance, Safety hat Vorrang |
| **Medical Device** | 5-Stufen | Custom (FDA-basiert) | Maximum | FDA 510(k) Requirements, Patient Safety kritisch |
| **IoT Prototype** | 3-Stufen | Vereinfacht (Erfahrung) | Mittelwert | Schnelle Iteration, begrenzte historische Daten |

### 6.6.2 Risiko-Formel

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                  RISK = LIKELIHOOD × IMPACT                                 │
│                                                                             │
│  Dabei gilt:                                                                │
│  • Overall Impact = MAX(Business Impact, Technical Impact)                  │
│  • Konservatives Prinzip: Höchster Einzelwert bestimmt Gesamtwert           │
│  • Mittelwert Prinzip: Durchschnitt aller Einzelwerte bestimmt Gesamtwert   │
│  • Skalen: 3-, 4- oder 5-stufig wählbar                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Risiko-Score-Berechnung

**4-Stufen-Skala (anpassbar):**
- LOW = 1.0
- MEDIUM = 2.0  
- HIGH = 3.0
- CRITICAL = 4.0

**Risk Score = Likelihood × Impact**
- 1.0-1.9 = LOW
- 2.0-2.9 = MEDIUM
- 3.0-3.9 = HIGH
- 4.0+ = CRITICAL

### 6.6.3 Likelihood-Bewertung (TVRA oder OWASP-basiert)

Es kann zwischen 3-, 4- oder 5-stufiger Skala gewählt werden, und die Faktoren für Likelihood und Impact sind frei definierbar, z. B. nach TVRA, OWASP oder organisationsspezifischen Kriterien.

**Methode wählen:**

| Methode | Faktoren | Referenz |
|---------|----------|----------|
| **OWASP** | Threat Agent (Skill, Motive, Opportunity, Size) + Vulnerability (Ease of Discovery/Exploit, Awareness, Intrusion Detection) | OWASP Risk Rating Methodology |
| **TVRA (ISO 21434)** | Attack Potential = Elapsed Time + Specialist Expertise + Knowledge of TOE + Window of Opportunity + Equipment | ISO/SAE 21434 Annex G |
| **Organisationsspezifisch** | Frei definierbar (z.B. CVSSv3-basiert) | - |

<br>

> **Hinweis:** Falls eine organisationsspezifische Methode gewählt wird, muss diese in Phase 0 dokumentiert werden:
### Custom Likelihood-Bewertung: IEC 62304 Risk Management

**Faktoren:**
1. **Probability of Occurrence** (P): 1-5 (Frequent → Remote)
2. **Severity of Harm** (S): 1-5 (Catastrophic → Negligible)

**Likelihood = P × Detection Difficulty:**
- Undetected: ×3
- Detected late: ×2
- Detected early: ×1

**Mapping auf 4-Stufen:**
- Score 1-3: LOW
- Score 4-6: MEDIUM
- Score 7-9: HIGH
- Score 10+: CRITICAL


> **Verpflichtung:** Custom-Methoden müssen mit Referenz-Standard (falls vorhanden) verlinkt werden.

**Bewertungsfaktoren:**

| Kategorie     | Faktoren                                                           |
|---------------|--------------------------------------------------------------------|
| Threat Agent  | Skill Level, Motive, Opportunity, Size                             |
| Vulnerability | Ease of Discovery, Ease of Exploit, Awareness, Intrusion Detection |

**Aggregation:** Höchster Einzelfaktor bestimmt Gesamt-Likelihood

| Stufe    | Beschreibung                                                   |
|----------|----------------------------------------------------------------|
| LOW      | Nur hochspezialisierte Angreifer, sehr geringe Exposition      |
| MEDIUM   | Mittlere Fachkenntnis, moderat zugängliche Schwachstellen      |
| HIGH     | Geringe Kenntnis ausreichend, hohe Exposition, automatisierbar |
| CRITICAL | Extrem leicht ausnutzbare Schwachstellen, sehr hohe Exposition, breiter Angriffsspielraum |

> **Hinweis:** Optionale Anpassungen der Skala
>- **3-Stufen-Skala:** LOW / MEDIUM / HIGH
>- **5-Stufen-Skala:** LOW / MEDIUM / HIGH / VERY HIGH / CRITICAL
>- **Zwischenstufen:** Bei Bedarf können Übergangsstufen wie LOW-MEDIUM oder MEDIUM-HIGH ergänzt werden

### 6.6.4 Impact-Bewertung

| Domäne                     | Kriterien                                                                                               | Beispiele                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Business / Organisatorisch | Financial Damage, Regulatory/Compliance, Reputation, Operational Impact, Affected Users, Recoverability | Betriebsunterbrechung, Bußgelder, Imageverlust   |
| Physical / Safety          | Safety, Physical Asset Damage, Environmental Impact, Supply Chain                                       | Personenschaden, Gerätezerstörung, Umweltschaden |

**4-Stufen-Skala (anpassbar auf 3- oder 5-Stufen):**

| Stufe    | Wert | Beschreibung                                   |
| -------- | ---- | ---------------------------------------------- |
| Kritisch | 4    | Existenzbedrohend, Personenschaden möglich     |
| Hoch     | 3    | Erheblicher Schaden, signifikante Auswirkungen |
| Mittel   | 2    | Moderater Schaden, begrenzte Auswirkungen      |
| Niedrig  | 1    | Geringer Schaden, leicht behebbar              |

**Aggregation:**
- Konservatives Prinzip: Gesamtrisikowert = höchster Impact
- Mittelwert-Prinzip: Gesamtrisikowert = Durchschnitt aus allen Domänen

### 6.6.5 Risiko-Matrix

```txt
┌──────────────────────────────────────────────────────────────┐
│                           RISIKO-MATRIX                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                │             IMPACT                          │
│                │   LOW      MEDIUM      HIGH      CRITICAL   │
│   ─────────────┼─────────────────────────────────────────────│
│                │                                             │
│   L   CRITICAL │  HIGH      HIGH       CRITICAL   CRITICAL   │
│   I            │  ████████  ████████   ████████  ████████    │
│   K            │                                             │
│   E   HIGH     │  MEDIUM    HIGH       CRITICAL  CRITICAL    │
│   L            │  ████████  ████████   ████████  ████████    │
│   I            │                                             │
│   H   MEDIUM   │  LOW       MEDIUM     HIGH      CRITICAL    │
│   O            │  ░░░░░░░░  ████████   ████████  ████████    │
│   O            │                                             │
│   D   LOW      │  LOW       LOW        MEDIUM     HIGH       │
│   │            │  ░░░░░░░░  ░░░░░░░░   ████████  ████████    │
│                                                              │
│   ░░░░ = Akzeptabel    ████ = Massnahme erforderlich         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.6.5 Sonderfall: Langfristige Risiken (ETSI EG 203 310)

Für kryptografische oder Vertrauens-Risiken gilt die Zeitformel:

```txt
X + Y + T > Z  →  RISK = CRITICAL (Override)

Wobei:
X = Zeit, in der das Asset geschützt bleiben muss
Y = Migrationszeit für neue Sicherheitsmechanismen
T = Zeit zum Aufbau von Vertrauen in neue Mechanismen
Z = Zeit, bis ein Angreifer die aktuelle Sicherheit brechen kann
```

### 6.6.6 Priorisierung (MoSCoW)

| Risk Level | Priorität | Handlungsempfehlung                            |
|------------|-----------|------------------------------------------------|
| CRITICAL   | Must      | Sofortige Mitigation / Redesign erforderlich   |
| HIGH       | Should    | Massnahme zeitnah umsetzen                     |
| MEDIUM     | Could     | Optionale Massnahme bei freien Ressourcen      |
| LOW        | Won't (at this stage) | Risiko akzeptabel, keine Massnahme |

### 6.6.7 Risiko-Register (Template)

| Threat ID | STRIDE | Threat Description | Asset-Ref | DFD-Ref | Risk (Before) | Mitigation | Risk (After) | Risk Reduction | Prio (MoSCoW) | Status | Owner | Due Date |
|-----------|--------|-------------------|-----------|---------|---------------|------------|--------------|----------------|---------------|--------|-------|----------|
| EE1-S-1 | S | Spoofing of external entity identity | A001 | EE-01 | 2.2 (M×M) | Use PKI system and digital certificates | 1.4 (L×M) | -36% | Should | Open | SecTeam | Q3-2026 |
| P2-T-1 | T | SQL Injection via API | A001 | P-02 | 3.2 (H×H) | Input validation + prepared statements | 1.6 (L×M) | -50% | Must | In Progress | DevTeam | Q2-2026 |

**Legende:**

- **Risk Score:** Berechnet als Likelihood × Impact (z.B. 2.2 = Medium Likelihood × Medium Impact)
- **Risk Reduction:** Prozentuale Reduktion durch Mitigation
- **Status-Werte:** Open | In Progress | Implemented | Verified | Closed | Won't Fix

**Status-Werte:**

- **Open:** Mitigation identifiziert, noch nicht gestartet
- **In Progress:** Umsetzung läuft
- **Implemented:** Technisch umgesetzt, noch nicht validiert
- **Verified:** Wirksamkeit bestätigt (z.B. durch Penetration Test)
- **Closed:** Abgeschlossen und im Audit-Trail dokumentiert
- **Won't Fix:** Risiko akzeptiert (erfordert Attack-Tree-Validierung bei HIGH/CRITICAL Impact, siehe 6.7.3)

### 6.6.8 Output

| Artefakt                      | Format  | Beschreibung                               |
|-------------------------------|---------|--------------------------------------------|
| Risiko-Register               | Tabelle | Alle Threats mit Bewertung und Priorität   |
| Risiko-Matrix (ausgefüllt)    | Grafik  | Visualisierung der Risikoverteilung        |
| Priorisierte Massnahmenliste  | Tabelle | Nach MoSCoW sortiert                       |
| Risiken Nichtumsetzungsmatrix | Tabelle | Tabelle mit Gründen für die Nichtumsetzung |

---

## 6.7 Phase 5: Validierung und Governance

**Referenz:** Formalisierung der Governance-Anforderungen

Diese Phase schliesst den TARA-Prozess ab und etabliert den Governance-Zyklus.

### 6.7.1 Ziele

| Ziel                | Beschreibung                           |
|---------------------|----------------------------------------|
| Wirksamkeit         | Massnahmen sind angemessen und wirksam |
| Wirtschaftlichkeit  | Kosten-Nutzen-Verhältnis geprüft       |
| Nachvollziehbarkeit | Alle Entscheidungen dokumentiert       |
| Nachhaltigkeit      | Re-Assessment-Prozess etabliert        |

### 6.7.2 Cost-Benefit-Analysis (CBA)

**Bewertungskriterien:**

| Kriterium               | Beschreibung                             |
|-------------------------|------------------------------------------|
| Technische Wirksamkeit  | Reduktion von Impact und/oder Likelihood |
| Implementierungskosten  | Engineering, Integration, Test           |
| Betriebskosten          | Wartung, Schulung, Ressourcen            |
| Regulatorische Wirkung  | Einfluss auf Compliance                  |
| Benutzerverträglichkeit | Auswirkung auf Usability                 |

**CBA-Template:**

| ID   | Massnahme      | Kosten | Wirksamkeit | Reg. Impact | Priorität | Empfehlung     |
|------|----------------|--------|-------------|-------------|-----------|----------------|
| M001 | Secure Boot    | 25.000 | Hoch        | Hoch        | Must      | Implementieren |
| M002 | Log-Auditing   | 10.000 | Mittel      | Mittel      | Should    | Planen         |
| M003 | API-Rate-Limit | 3.000  | Hoch        | Niedrig     | Could     | Bei Bedarf     |

### 6.7.3 Attack-Tree-Validierung für "Won't"-Entscheidungen

Risiken mit HIGH oder CRITICAL Impact, die als "Won't" klassifiziert wurden, **müssen** durch Attack-Tree-Analyse validiert werden.

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│              VALIDIERUNG VON "WON'T"-ENTSCHEIDUNGEN                         │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────┐
     │  "Won't"-Risiko mit HIGH/CRITICAL    │
     │  Impact identifiziert                │
     └──────────────────────────────────────┘
                        │
                        ▼
     ┌──────────────────────────────────────┐
     │  Attack Tree erstellen/erweitern     │
     │  • Alle Angriffspfade modellieren    │
     │  • Likelihood pro Pfad bewerten      │
     │  • Bestehende Kontrollen einzeichnen │
     └──────────────────────────────────────┘
                        │
                        ▼
     ┌──────────────────────────────────────┐
     │  Restrisiko bewerten                 │
     │  • Ist Aufwand für Angreifer hoch?   │
     │  • Sind Kontrollen ausreichend?      │
     │  • Ist CBA negativ?                  │
     └──────────────────────────────────────┘
                        │
                        ▼
     ┌──────────────────────────────────────┐
     │  Formelle Dokumentation              │
     │  • Begründung der Akzeptanz          │
     │  • Attack Tree als Nachweis          │
     │  • Sign-off durch Risk Owner         │
     └──────────────────────────────────────┘
```

### 6.7.4 Re-Assessment-Trigger

| Trigger                 | Beschreibung                   | Aktion                      |
|-------------------------|--------------------------------|-----------------------------|
| Architekturänderung     | HW, SW, Schnittstellen         | Zurück zu Phase 1           |
| Neue Bedrohungen        | CERT, CVE, interne Findings    | Zurück zu Phase 3           |
| Neue Assets             | Geänderte Sicherheitsziele     | Zurück zu Phase 2           |
| Regulatorische Änderung | Standard-Updates, neue Gesetze | Vollständiges Re-Assessment |
| Zeitablauf              | Mindestens jährlich            | Review aller Phasen         |

### 6.7.5 Governance-Zyklus

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GOVERNANCE-ZYKLUS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │  Threat ID &        │
                    │  Mitigation         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Risk Evaluation    │
                    │  & CBA              │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Implementation     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Validation         │
                    │  (inkl. ATA)        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Sign-Off &         │
                    │  Governance Board   │
                    └──────────┬──────────┘
                               │
                               ▼
                   ┌─────────────────────┐
         ┌────────▶│  Monitoring &       │
         │         │  Re-Assessment      │
         │         └──────────┬──────────┘
         │                    │
         │         Trigger?   │
         │              │     │
         │             JA    NEIN
         │              │     │
         │              ▼     ▼
         │    ┌──────────┐  ┌──────────┐
         │    │ Nächste  │  │ Weiter   │
         └────│ Iteration│  │ Monitor  │──────┐
              └──────────┘  └──────────┘      │
                                              │
                                              │
                            (Zyklus fortsetzt)
```
ATA: Attack Tree Analysis

### 6.7.6 Verantwortlichkeiten

| Rolle            | Verantwortung                   |
|------------------|---------------------------------|
| Security Manager | Prozessverantwortung, Methodik  |
| System Owner     | Technische Bewertung, Umsetzung |
| Risk Owner       | Risikoakzeptanz, Sign-off       |
| Governance Board | Freigabe, Eskalation            |

### 6.7.7 Output

| Artefakt              | Format   | Beschreibung                            |
|-----------------------|----------|-----------------------------------------|
| CBA-Protokoll         | Tabelle  | Kosten-Nutzen-Analyse aller Massnahmen  |
| Validierungsprotokoll | Dokument | Attack-Tree-Validierungen für "Won't"   |
| Sign-off-Dokument     | Formular | Unterschriften, Datum, Begründungen     |
| Audit-Trail           | Log      | Alle Änderungen versioniert             |
| Re-Assessment-Plan    | Dokument | Trigger, Verantwortlichkeiten, Zeitplan |

---

## 6.8 Artefakt-Matrix (Traceability)

Diese Matrix zeigt die Abhängigkeiten zwischen Phasen und Artefakten:

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ARTEFAKT-TRACEABILITY-MATRIX                          │
└─────────────────────────────────────────────────────────────────────────────┘

                        ERZEUGT IN PHASE →
                    ┌───────┬───────┬───────┬───────┬───────┐
                    │   1   │   2   │   3   │   4   │   5   │
                    │  DFD  │ Asset │Threat │ Risk  │  Gov  │
    ────────────────┼───────┼───────┼───────┼───────┼───────┤
    DFD             │   ●   │       │       │       │       │
    Element-Liste   │   ●   │       │       │       │       │
    Trust-Boundary  │   ●   │       │       │       │       │
    Interface-Liste │   ●   │       │       │       │       │
    ────────────────┼───────┼───────┼───────┼───────┼───────┤
    Asset-Tabelle   │   ◀   │   ●   │       │       │       │
    Asset-Security  │   ◀   │   ●   │       │       │       │
    Impact-Bewert.  │       │   ●   │       │       │       │
    ────────────────┼───────┼───────┼───────┼───────┼───────┤
    Threat-Tabelle  │   ◀   │   ◀   │   ●   │       │       │
    Attack Trees    │   ◀   │   ◀   │   ●   │       │   ◀   │
    Feedback-Prot.  │       │       │   ●   │       │       │
    ────────────────┼───────┼───────┼───────┼───────┼───────┤
    Risiko-Register │       │   ◀   │   ◀   │   ●   │       │
    Risiko-Matrix   │       │       │       │   ●   │       │
    Massnahmen-Liste│       │       │   ◀   │   ●   │       │
    ────────────────┼───────┼───────┼───────┼───────┼───────┤
    CBA-Protokoll   │       │       │       │   ◀   │   ●   │
    Validierung     │       │       │   ◀   │   ◀   │   ●   │
    Sign-off        │       │       │       │   ◀   │   ●   │
    Audit-Trail     │   ◀   │   ◀   │   ◀   │   ◀   │   ●   │
    Re-Assess-Plan  │       │       │       │       │   ●   │
    ────────────────┴───────┴───────┴───────┴───────┴───────┘

    Legende:
    ●  = Artefakt wird in dieser Phase erzeugt
    ◀  = Artefakt wird aus vorheriger Phase verwendet (Input)
```

### Artefakt-Übersicht (tabellarisch)

| Phase | Artefakt                     | Format           | Verwendung in |
|-------|------------------------------|------------------|---------------|
| 1     | DFD                          | Grafik + Daten   | Phase 2, 3    |
| 1     | Element-Liste                | Tabelle          | Phase 2, 3    |
| 1     | Element-Beschreibungen       | Tabelle / Text   | Phase 2, 3, 5 |
| 1     | Asset-Liste (Phase-1-Sicht)  | Tabelle          | Phase 2       |
| 1     | Trust-Boundary-Register      | Tabelle          | Phase 3       |
| 1     | Interface-Liste              | Tabelle          | Phase 3       |
| 2     | Asset-Tabelle                | Tabelle          | Phase 3, 4    |
| 2     | Asset-Security-Mapping       | Tabelle          | Phase 3, 4, 5 |
| 2     | Impact-Bewertungen           | Dokument         | Phase 4       |
| 3     | Threat-Tabelle               | Tabelle          | Phase 4, 5    |
| 3     | Attack Trees                 | Grafik + Tabelle | Phase 4, 5    |
| 3     | Feedback-Loop-Protokoll      | Dokument         | Audit         |
| 4     | Risiko-Register              | Tabelle          | Phase 5       |
| 4     | Risiko-Matrix                | Grafik           | Management-Reporting |
| 4     | Priorisierte Massnahmenliste | Tabelle          | Phase 5       |
| 5     | CBA-Protokoll                | Tabelle          | Governance    |
| 5     | Validierungsprotokoll        | Dokument         | Audit         |
| 5     | Sign-off-Dokument            | Formular         | Compliance    |
| 5     | Audit-Trail                  | Log              | Traceability  |
| 5     | Re-Assessment-Plan           | Dokument         | Governance-Zyklus |

---

## 6.9 Zusammenfassung

Der formelle TARA-Prozess liefert:

1. **Nachvollziehbarkeit:** Vollständige Traceability von Assets über Threats bis zu Massnahmen
2. **Reproduzierbarkeit:** Definierte Methoden und Kriterien
3. **Flexibilität:** Zwei Workflow-Varianten für unterschiedliche Kontexte
4. **Qualitätssicherung:** Feedback-Loops und Validierungsmechanismen
5. **Governance:** Etablierter Re-Assessment-Zyklus

```txt
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   VARIANTE A (STRIDE-first):  Effizient & reproduzierbar                    │
│                                für Standard-Systeme                         │
│                                                                             │
│   VARIANTE B (Attack-Tree-first): Tiefgründig & validierend                 │
│                                    für kritische Systeme                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Dokument-Version: 1.0*
*Basierend auf: TARA-Manuskript Kapitel 2–4, 6*
*Kompatibel mit: ETSI TVRA, ISO 27005, OWASP Risk Rating*
