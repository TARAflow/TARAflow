# TARAflow – UseCase-Analyse: Konzept & Umsetzungsplan

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>

---

## 1. Konzept

### 1.1 Motivation

Die bestehende TARA-Analyse in TARAflow arbeitet systemweit — alle Threats, alle Assets, alle Beziehungen werden global betrachtet. Für grosse Systeme mit vielen Assets entsteht dabei ein Orientierungsproblem: 47 Threats, aber welche sind für den konkreten Angriffsablauf "Wartungszugang via USB" relevant?

UseCase-Analyse löst das durch **gefilterte, pfadorientierte Analyse**: Der Analyst definiert einen konkreten Ablauf als Sequenz von Schritten, das System traversiert den Graphen automatisch und zeigt nur die relevanten Threats und Risks.

**TARAflow bietet damit zwei Analysemodi auf demselben Graphen:**

```
Modus 1: Systemweite Analyse (klassisch)
  → Alle Threats, Assets, Beziehungen global sichtbar
  → Geeignet für: vollständige TARA, Compliance-Nachweise, Audits

Modus 2: UseCase-basierte Analyse (pfadorientiert)
  → Nur Threats und Assets im konkreten Ablaufpfad sichtbar
  → Geeignet für: gezielte Angriffsszenarien, Workshops, Zertifizierung
```

Beide Modi nutzen denselben zugrundeliegenden Graphen — keine Doppelmodellierung, kein Datenverlust.

### 1.2 Was ein UseCase ist

Ein UseCase in TARAflow ist eine **benannte Interaktionssequenz** die einen sicherheitsrelevanten Ablauf beschreibt. Nicht zu verwechseln mit UML-UseCases.

**Beispiele:**
- "Wartungszugang via USB"
- "OTA-Firmware-Update"
- "NC-Programm laden"
- "Notabschaltung auslösen"
- "Bediener-Login"
- "Fernwartung via VPN"

### 1.3 Architektur: View auf das bestehende Modell

Ein UseCase ist **kein neues Modell** — er ist eine **projektionale Teilmenge des Graphen** basierend auf sequenzieller Aktivierung von DFD-Elementen. Keine Doppelpflege.

> Diese Präzisierung ist relevant für Backend, Caching und Performance: ein UseCase definiert nicht einen Filter auf Anzeige-Ebene, sondern eine Projektion die serverseitig berechnet und gecacht werden kann.

```
Ebene 0:  UseCase
               ↓  UseCase-zu-Element (welche DFD-Elemente sind beteiligt?)
Ebene 1:  DFD-Elemente  ──(DataFlows)──  DFD-Elemente
               ↓  Element-zu-Asset (typisiert)
Ebene 2:  Asset Graph (vertikal + orthogonal)
```

### 1.4 Graphstruktur (Layout-Konzept)

```
Asset Graph (oben)
  ├── Vertikale Hierarchie (links):   Infrastructure → System → Function → Data
  └── Orthogonale Kategorien (rechts): Process | Physical | Service | Human

DFD — Data Flow Diagram (unten)
  └── Processes, DataStores, External Entities, Interfaces, DataFlows
```

DFD unten = konkrete Implementierung. Asset Graph oben = schützbare Werte.
Pfeile verbinden beide Ebenen via typisierte Element-zu-Asset Beziehungen.

---

## 2. Datenmodell

### 2.1 UseCase

```typescript
interface UseCase {
  id: string                    // UUID
  name: string                  // "Wartungszugang via USB"
  description?: string
  steps: UseCaseStep[]          // geordnete Sequenz

  entryPoint?: string           // Element-ID des Angriffseinstiegspunkts
                                // Default: primaryElementId von Step 1
                                // Relevant für: Attack Trees, Simulation, Angreifer-Perspektive
}
```

### 2.2 UseCaseStep

```typescript
interface UseCaseStep {
  order: number                    // 1, 2, 3... (Sequenz, Pflicht)
  label: string                    // "Techniker steckt USB-Stick ein"

  // DFD-Elemente (Single Source of Truth für Asset-Traversal)
  dfdElementIds: string[]          // alle aktiven Elemente in diesem Schritt
  primaryElementId?: string        // optionaler Fokus für Threat-Priorisierung
                                   // wenn gesetzt: Threats am primaryElement = DIRECT
                                   // restliche Threats = CONTEXT (Backlog)
                                   // Validierung: muss in dfdElementIds enthalten sein
                                   // Default (UX): erstes gewähltes Element
                                   // Empfehlung: genau eines pro Step (Angriffspunkt)

  // Trust Boundary — derived, nie manuell
  crossesTrustBoundary?: boolean   // UI-Property: true wenn ≥1 referenzierter DataFlow eine TB kreuzt
  crossedTrustBoundaryIds?: string[] // intern: welche Boundaries konkret gekreuzt werden
                                   // ermöglicht spätere Feinanalyse (Welche? Wie viele? Richtung?)
                                   // crossesTrustBoundary = crossedTrustBoundaryIds.length > 0
}
```

> **`assetIds` wurde bewusst weggelassen.** Assets werden ausschliesslich via Graph-Traversal
> aus den `dfdElementIds` abgeleitet (Element → Asset-Beziehung). Eine direkte Asset-Zuweisung
> würde die DFD-zu-Asset-Kette umgehen und "Geister-Assets" ermöglichen die nicht
> im Modell verankert sind.

> **`trustBoundaryId` wurde durch `crossesTrustBoundary: boolean (derived)` ersetzt.**
> Trust Boundaries gehören zum DFD-Fluss — nicht zum Step. Das DFD ist die Single Source
> of Truth. Ein Step kann mehrere DataFlows referenzieren die verschiedene Boundaries kreuzen;
> ein einzelnes `trustBoundaryId`-Feld würde das nicht korrekt abbilden.

### 2.3 Step-Grenzregel

Ein Step repräsentiert eine **logisch zusammengehörige Aktion ohne sicherheitsrelevante Zwischenentscheidung**.

**Splitte einen Step auf wenn:**
- ein Trust Boundary Crossing separat analysiert werden soll
- unterschiedliche Akteure in verschiedenen Teilschritten beteiligt sind
- die dominierenden STRIDE-Kategorien wechseln (z.B. Spoofing → Tampering)
- `crossesTrustBoundary: true` und der Übergang selbst analysiert werden soll

**Halte Steps zusammen wenn:**
- alle beteiligten Elemente denselben logischen Akteur / dieselbe Phase repräsentieren
- keine sicherheitsrelevante Entscheidung zwischen den Elementen stattfindet

> Diese Regel verhindert Modell-Drift: zwei Analysten die denselben Ablauf modellieren
> kommen zu vergleichbaren Step-Schnitten und damit zu konsistenten Threat-Zuordnungen.

### 2.4 Many-to-Many: Element ↔ UseCase

Ein DFD-Element kann in mehreren UseCases vorkommen — und in verschiedenen Rollen:

```
Process "Authentifizierung"
  └─ UseCase "Bediener-Login"   Step 1
  └─ UseCase "Wartungszugang"   Step 2

→ Kein Konflikt, kein exklusives Mapping
```

Die Zuordnung erfolgt ausschliesslich über `step.dfdElementIds` — kein separates Mapping-Objekt nötig.

**Rückwärtsquery** (automatisch via Graph-Traversal):
```
"Welche UseCases involvieren Process X?"
→ Alle Steps durchsuchen die X in dfdElementIds haben
→ Deren UseCases zurückgeben
```

### 2.5 Beispiel: UseCase "NC-Programm laden"

```
UseCase "NC-Programm laden"
├─ Step 1: "NC-Programmierer authentifiziert sich"
│   primaryElementId: EE_Programmierer       ← Fokus: wer initiiert?
│   dfdElementIds: [EE_Programmierer, Process_AuthService]
│   crossesTrustBoundary: false              (derived)
│
├─ Step 2: "NC-Programm wird übertragen"
│   primaryElementId: DataFlow_ProgrammTransfer  ← Fokus: was fliesst?
│   dfdElementIds: [DataFlow_ProgrammTransfer, Process_FileManager]
│   crossesTrustBoundary: true               (derived — DataFlow kreuzt TB_OT_IT)
│
└─ Step 3: "CNC führt Programm aus"
    dfdElementIds: [Process_CNCController, System_CNCMaschine]
    crossesTrustBoundary: false              (derived)
```

Assets werden automatisch via Graph-Traversal aus den `dfdElementIds` ermittelt:
```
Step 2: DataFlow_ProgrammTransfer
  └─ transports → Data Asset "Fertigungsrezepte"      [KERN]
  └─ transports → Data Asset "NC-Programm"
Process_FileManager
  └─ modifies  → Data Asset "Fertigungsrezepte"
  └─ runs_on   → System Asset "Dateiserver"           [KERN]
```

---

## 3. Automatische Threat-Zuordnung

### 3.1 Ableitungskette

Das System traversiert den Graphen automatisch — kein manuelles Threat-Mapping:

```
UseCase Step
  → referenziert DFD-Elemente
    → haben Element-zu-Asset Beziehungen
      → Assets haben Asset-zu-Asset Beziehungen (max Hop 1)
        → Assets generieren Threats (via STRIDE + Safety-Propagation)
          → Threats haben Risk-Bewertungen
```

### 3.2 Formale Zuordnungsregel

```
Threat T gehört zu UseCase UC wenn:

  ∃ Step S ∈ UC.steps
  ∃ Element E ∈ S.dfdElementIds
  ∃ Asset A erreichbar von E (via Element-zu-Asset)
  A ist Ziel-Asset von Threat T

  — oder transitiv (max Hop 1) —

  ∃ Asset B erreichbar von A (via Asset-zu-Asset Core Rule)
  B ist Ziel-Asset von Threat T
```

### 3.3 PRIMARY vs. SECONDARY Step-Zuordnung

Ein Threat kann über mehrere Steps erreichbar sein. Die Zuordnung ist zweistufig:

```
PRIMARY Step:
  Asset ist direkt über dfdElementIds des Steps erreichbar
  (= Element→Asset Beziehung vorhanden)
  → Wenn primaryElementId gesetzt: Threat gilt als DIRECT

SECONDARY Step:
  Asset ist nur transitiv erreichbar (Asset→Asset Hop 1)
  → Threat gilt als CONTEXT
```

**Prioritätsregel bei mehreren PRIMARY Steps:**

Ein Threat kann in mehr als einem Step PRIMARY sein (wenn dasselbe Asset von mehreren Steps direkt referenziert wird). In diesem Fall gilt:

```
LEADING PRIMARY:   Step mit dem kleinsten order-Wert (frühester Step)
ADDITIONAL PRIMARY: alle weiteren PRIMARY Steps
```

Die `order`-Nummer des Steps entscheidet — keine neue Logik nötig, das Feld ist bereits vorhanden.

**Wichtig — Traversal-Unabhängigkeit:**

```
Threat-Zuordnung (welche Threats gehören zum UseCase)
  → unabhängig von Step-Reihenfolge

Step-Reihenfolge beeinflusst nur:
  → Darstellung im UI
  → PRIMARY-Zuordnung (first occurrence = LEADING)
```

Ein Asset das in Step 3 referenziert wird kann via Asset→Asset Hop rückwärts auf ein Asset zeigen das in Step 1 vorkommt — das ist korrekt und gewollt. Steps sind Anzeigekontexte, keine Scope-Grenzen.

**Beispiel:**

```
System_CNCMaschine ist Ziel von T-044 (DoS)

Step 2: DataFlow_Transfer referenziert →
  → System_CNCMaschine via Asset→Asset (hosted_on) → SECONDARY
Step 3: Process_CNCController referenziert →
  → System_CNCMaschine direkt erreichbar → PRIMARY (LEADING, da Step 2 secondary)

Darstellung im UI:
  T-044 DoS auf CNC-Maschine
    → Step 2 (secondary / context)
    → Step 3 (primary / leading)
```

### 3.4 Eindeutigkeit von Threats im UseCase

Ein Threat ist **eindeutig pro UseCase** (ID-basiert) — die Step-Zuordnung ist eine Annotation, keine Duplikation.

```
Threat T-044 erscheint in Step 2 (secondary) UND Step 3 (primary)
→ es ist trotzdem EIN Threat im UseCase
→ threatCount = 1, nicht 2

UI zeigt: T-044 mit Annotations [Step 2: context] [Step 3: primary]
```

> Dies verhindert dass Analysten die Step-Zuordnungsanzeige als "mehr Threats" interpretieren.

```
UseCase "NC-Programm laden" — 6 relevante Threats:

  Step 1 (Authentifizierung):
    T-012  Spoofing auf NC-Programmierer          HIGH
    T-031  EoP via Auth-Bypass                    MEDIUM

  Step 2 (Übertragung):
    T-007  Tampering auf Fertigungsrezepte         CRITICAL
    T-019  InfoDisc via unverschlüsselten Transfer HIGH

  Step 3 (Ausführung):
    T-003  Sequencing Attack auf Fräsprozess       CRITICAL
    T-044  DoS auf Sicherheitssteuerung            HIGH
```

### 3.5 Attack Path Illustration

Ein UseCase ergibt einen **linearen Angriffspfad auf DFD-Ebene**. Asset-zu-Asset Beziehungen erweitern diesen Pfad lateral (Hop 1):

```
UseCase "NC-Programm laden":

DFD-Pfad (linear, Ebene 1):
  EE_Programmierer → Process_Auth → DataFlow_Transfer → Process_CNCController

Laterale Erweiterung via Asset→Asset (Ebene 2, Hop 1):
  DataFlow_Transfer
    └─ transports → Data "Fertigungsrezepte"
         └─ required_by → Process "Fräsvorgang"    ← Tampering CRITICAL

  Process_CNCController
    └─ runs_on → System "CNC-Maschine"
         └─ affects_safety → Human "Bediener"       ← Safety Override

Visualisierung:
  USB → Auth → Transfer → Execution
                  ↘ Tampering Fertigungsrezepte → Safety Impact (Fräsvorgang)
```

Der Attack Path entsteht automatisch aus dem Graphen — keine manuelle Modellierung nötig.

**AttackPathView — Konzept für spätere Implementierung:**

```
AttackPathView:
  nodes:
    - DFD-Elemente (geordnet nach Step.order)
    - Assets (angehängt via Element-zu-Asset Beziehung)
  edges:
    - sequential: Step N → Step N+1 (UseCase-Sequenz)
    - lateral:    Asset → Asset (Asset-zu-Asset Beziehung, max Hop 1)

Einstiegspunkt: UseCase.entryPoint (default: primaryElementId von Step 1)
```

> Diese Definition verhindert divergierende Implementierungen im Frontend und Backend.

### 3.6 Beispiel Threat-Zuordnung mit Step-Annotation

```
UseCase "NC-Programm laden" — 6 Threats (eindeutig, ID-basiert):

  T-012  Spoofing auf NC-Programmierer          HIGH
           → Step 1 (primary)

  T-031  EoP via Auth-Bypass                    MEDIUM
           → Step 1 (primary)

  T-007  Tampering auf Fertigungsrezepte         CRITICAL
           → Step 2 (primary) · Step 3 (secondary)

  T-019  InfoDisc via unverschlüsselten Transfer HIGH
           → Step 2 (primary)

  T-003  Sequencing Attack auf Fräsprozess       CRITICAL
           → Step 3 (primary)

  T-044  DoS auf Sicherheitssteuerung            HIGH
           → Step 2 (secondary) · Step 3 (primary)
```

---

## 4. UseCase Risk Score

### 4.1 Berechnung

```
UseCaseScore = MAX(Risk-Score aller Threats im UseCase-Pfad)
```

**Konservatives Prinzip** — konsistent mit Safety Override und MINIMUM-Prinzip: Ein UseCase ist so sicher wie sein schwächstes Glied.

```typescript
interface UseCaseRiskScore {
  score: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  drivenBy: string        // Threat-ID des kritischsten Threats
  threatCount: number     // Anzahl Threats im Pfad
  openCount: number       // davon ohne Mitigation
}
```

### 4.2 Residual Score nach Mitigation

```
UseCaseResidualScore = MAX(Residual Risk aller Threats im Pfad)
```

Zeigt ob der Ablauf nach allen Massnahmen akzeptabel ist.

### 4.3 UseCase-Übersicht im UI

```
UseCase Liste                         Score    Threats   Offen
──────────────────────────────────────────────────────────────
⬛ NC-Programm laden                  CRITICAL    6        2
🔴 Wartungszugang USB                 HIGH        5        1
🟡 Bediener-Login                     MEDIUM      3        0
🟢 Statusanzeige lesen                LOW         2        0
```

---

## 5. UI & Navigation

### 5.1 Tab-Reihenfolge

```
Overview → DFD → Asset (inkl. UseCase-View) → Threat → Risk → AttackTree
```

**UseCase ist kein eigener Haupt-Tab** — die UseCase-Verwaltung ist als zweiter View *innerhalb* des Asset-Tabs platziert. Der Analyst bleibt im Asset-Kontext und hat die Impact-Bewertungen direkt sichtbar wenn er UseCases definiert.

**Begründung:**
- Assets mit Impact und Schutzzielen sind im selben Tab sichtbar → informierter Kontext
- Kein Tab-Wechsel nötig um Asset-Kritikalität nachzuschlagen
- Ein Tab weniger in der Hauptnavigation — schlankere UX
- Vor Threat: UseCase-Filter ist gesetzt wenn Threats analysiert werden
- Vor Risk: UseCase-Score wird automatisch berechnet

### 5.2 UseCase als zuschaltbares Feature

UseCase-Analyse ist **optional** — aktivierbar im Overview-Tab analog zu Safety-Annotation und High-Value Assets:

```
Overview — Projektprofil
  └─ Analyse-Tiefe
      ├─ ☑ Safety-Annotation
      ├─ ☑ High-Value Assets
      └─ ☐ UseCase-Analyse          ← neu (default: aus)
```

**Wenn aktiviert:**
- Zweiter View-Toggle im Asset-Tab erscheint: `[Assets] [UseCases]`
- Threat-Tab zeigt UseCase-Filter-Dropdown
- Risk-Tab zeigt UseCase-Score-Spalte
- DFD-Canvas: aktiver UseCase graut nicht-beteiligte Elemente aus

**Wenn nicht aktiviert:**
- Kein UseCase-View im Asset-Tab, kein Filter — Tool verhält sich wie bisher
- Geeignet für: CRA Gap-Assessments, schnelle Workshops, einfache Systeme

### 5.3 Asset-Tab Layout mit UseCase-View

```
Asset-Tab
  ┌─ Toolbar ────────────────────────────────────────────┐
  │  [Assets]  [UseCases]              (Toggle, wenn aktiv) │
  └──────────────────────────────────────────────────────┘

  Default-View "Assets":
  ┌────────────────────────────────────────────────────────┐
  │ Asset           │ Kategorie │ Impact   │ Schutzziel     │
  │─────────────────┼───────────┼──────────┼────────────────│
  │ Fertigungsreze. │ Data      │ CRITICAL │ C, I           │
  │ CNC-Maschine    │ Infra     │ HIGH     │ A, I           │
  │ Fräsvorgang     │ Process   │ CRITICAL │ A              │
  └────────────────────────────────────────────────────────┘

  UseCase-View "UseCases":
  ┌──────────────────────┬─────────────────────────────────┐
  │  UseCase Liste       │  UseCase Editor                 │
  │                      │                                 │
  │  ⬛ NC-Programm     │  Name: "NC-Programm laden"      │
  │  🔴 Wartung USB     │                                 │
  │  🟡 Login           │  Steps:                         │
  │  🟢 Status          │  [1] "Programmierer auth."      │
  │                      │      ★ EE_Programmierer         │
  │  [+ UseCase hinzu]  │        Process_AuthService      │
  │                      │                                 │
  │                      │  [2] "NC-Programm übertragen"  │
  │                      │      ⚠️ TB                      │
  │                      │      ★ DataFlow_Transfer        │
  │                      │        Process_FileManager      │
  │                      │                                 │
  │                      │  [+ Schritt hinzufügen]         │
  └──────────────────────┴─────────────────────────────────┘
```

`★` = `primaryElementId` (optionaler Fokus für Threat-Priorisierung)
`⚠️ TB` = `crossesTrustBoundary: true` (automatisch abgeleitet)

### 5.4 DFD-Canvas UseCase-Modus

Wenn ein UseCase aktiv ist:
- Beteiligte DFD-Elemente: normal dargestellt, farblich hervorgehoben
- Nicht-beteiligte Elemente: ausgegraut (opacity reduziert)
- Aktive Trust Boundaries: hervorgehoben
- Step-Nummer als Badge auf den beteiligten Elementen (1, 2, 3...)

### 5.5 Threat-Tab Filter

```
Filter: [UseCase: NC-Programm laden ▼]  [Step: Alle ▼]

→ Zeigt nur Threats deren Assets im UseCase-Pfad liegen
→ Sortierung nach Step-Reihenfolge
→ Step-Spalte in der Threat-Tabelle (zeigt in welchem Step der Threat relevant ist)
```

### 5.6 Risk-Tab Filter

```
Filter: [UseCase: NC-Programm laden ▼]

UseCase Risk Score: CRITICAL (driven by T-007)
Threats: 6 total, 2 offen

→ Risk-Matrix gefiltert auf UseCase-relevante Threats
→ UseCase-Score prominent angezeigt
→ Residual Score nach Mitigation
```

---

## 6. Implementierungsreihenfolge

```
Phase 1: Datenmodell
  ☐ UseCase Interface (id, name, steps, entryPoint?)
  ☐ UseCaseStep Interface (order, label, dfdElementIds, primaryElementId?,
                           crossesTrustBoundary, crossedTrustBoundaryIds)
  ☐ Validierung: primaryElementId muss in dfdElementIds enthalten sein
  ☐ Derivation crossesTrustBoundary + crossedTrustBoundaryIds
      (aus DataFlows in dfdElementIds → TrustBoundary-Referenzen)
  ☐ UseCase Store (Zustand, CRUD)
  ☐ Graph-Traversal: Threat-zu-UseCase Zuordnung (PRIMARY vs. SECONDARY)
  ☐ PRIMARY-Priorisierung: LEADING = kleinster order-Wert bei mehreren PRIMARY Steps
  ☐ Threat-Deduplizierung: eindeutig pro UseCase (ID-basiert), Step-Zuordnung als Annotation
  ☐ UseCaseRiskScore Berechnung (MAX-Aggregation über deduplizierte Threats)
  ☐ entryPoint Default-Ableitung (primaryElementId von Step 1)

Phase 2: UseCase-View im Asset-Tab
  ☐ View-Toggle Toolbar im Asset-Tab: [Assets] [UseCases]
  ☐ Toggle nur sichtbar wenn UseCase-Analyse im Overview aktiviert
  ☐ UseCase-Liste (linke Spalte, mit Score-Badge)
  ☐ UseCase-Editor (rechte Spalte)
  ☐ Step-Editor (Reihenfolge, drag-to-reorder)
  ☐ Element-Auswahl per Step (Picker aus bestehendem DFD)
  ☐ primaryElementId Markierung (★ Fokus-Element pro Step, optional)
  ☐ crossesTrustBoundary Anzeige (⚠️ TB Badge, automatisch)

Phase 3: DFD-Canvas Integration
  ☐ UseCase-Modus Toggle im Canvas-Header
  ☐ Ausgrauen nicht-beteiligter Elemente
  ☐ Step-Badge auf beteiligten Elementen
  ☐ Hervorhebung aktiver Trust Boundaries

Phase 4: Threat & Risk Integration
  ☐ Threat-Tab: UseCase-Filter-Dropdown
  ☐ Threat-Tab: Step-Spalte mit PRIMARY/SECONDARY Annotation
  ☐ Threat-Tab: Hinweis bei Threats die in mehreren Steps erscheinen (Annotation, nicht Duplikat)
  ☐ Risk-Tab: UseCase-Filter
  ☐ Risk-Tab: UseCase-Score Anzeige (current + residual)

Phase 5: Overview Toggle
  ☐ UseCase-Analyse Schalter im Overview
  ☐ View-Toggle [Assets][UseCases] im Asset-Tab ein-/ausblenden wenn Schalter gesetzt
  ☐ Filter in Threat/Risk ausblenden wenn UseCase nicht aktiv
```

---

## 7. Offene Entscheidungen

| Frage | Tendenz | Status |
|---|---|---|
| Tab-Position | UseCase-View innerhalb Asset-Tab (Toggle) | ✅ Entschieden |
| Step-Reihenfolge änderbar per Drag? | Ja | Noch nicht entschieden |
| UseCase-Export für Audit-Report? | Ja (UseCase-spezifischer Threat-Report) | Backlog |
| UseCase im AttackTree als Startpunkt (via `entryPoint`)? | Ja | Backlog |
| Validierung: Step ohne DFD-Element? | Warnung | Noch nicht entschieden |
| Threat-Priorisierung DIRECT vs. CONTEXT (via `primaryElementId`) | Ja, wenn `primaryElementId` gesetzt | Backlog Phase 2 |
| Attack Path Visualisierung im UseCase-View? | Ja (AttackPathView — sequenziell + lateral) | Backlog |
| Step-Grenzregel als Validierungshinweis im UI? | Ja (Hinweis wenn Step >5 Elemente hat) | Backlog |
| `crossedTrustBoundaryIds` auswerten für Boundary-Detailanalyse? | Ja | Backlog |
| Asset-Tab: read-only UseCase-Rückwärtsquery pro Asset? | Ja (in Assets-View anzeigen) | Backlog |

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>
