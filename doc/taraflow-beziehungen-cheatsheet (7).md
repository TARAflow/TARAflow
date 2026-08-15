# TARAflow – Beziehungs-Cheat Sheet

<sub>© Jürgen Messerer · 2026</sub>

---

## Graphstruktur

```
Ebene 1:  DFD-Elemente ──(DataFlows)── DFD-Elemente
               ↕  Element-zu-Asset (typisiert)
Ebene 2:
  Vertikal    Data / Function / System / Infrastructure
  (statische Struktur: Was / Womit / Wo)

  Orthogonal  Process / Physical / Service / Human
  (dynamischer Kontext: Wie / Passiv / Extern / Wer)
```

> ChipBoundary ist ein connectables DFD-Element — verbindet sich via `is_an` 
> mit einem System Asset. Verbindungen (R9): nur ExternalEntity, Process, ChipBoundary.

**Vertikale Hierarchie** — Abstraktionsleiter von atomar bis Umgebung:
```
Data          ← atomare Werte, höchste Präzision
Function      ← Fähigkeit / Capability (Was muss das System können?)
System        ← Blackbox-Komponente (Was stellt die Function bereit?)
Infrastructure ← Umgebung / Arena (Wo läuft alles?)
```

**Orthogonale Kategorien** schneiden alle vertikalen Ebenen:
- **Process** — aktiver Ablauf zur Laufzeit (*information in motion*): Timing, Sequenz, Zustand der Ausführung — nicht das beschreibende Dokument (das ist Data)
- **Physical** — rein passive Sachwerte ohne eingebettetes System
- **Service** — interne/externe Dienste ausserhalb der eigenen Systemgrenze
- **Human** — Personen als Schutzsubjekte und Akteure

---

## Ebene 1 – Element-zu-Asset Beziehungen

### `is_an` – Sonderregel (gilt für alle Asset-Typen)
> **Formal:** `is_an(A, X)` ⇒ keine weiteren Beziehungen zwischen A und X erlaubt.
> Beziehungen von A zu anderen Assets bleiben uneingeschränkt erlaubt.
> `is_an` ist **nicht transitiv vererbbar** — Beziehungen des Assets werden nicht auf das Element vererbt.

### Data Assets

| Beziehung | Semantik |
|---|---|
| `creates` | Element erzeugt das Data Asset |
| `reads` | Element liest das Data Asset |
| `modifies` | Element verändert das Data Asset |
| `deletes` | Element löscht das Data Asset |
| `stores` | Element speichert das Data Asset |
| `transports` | Element transportiert das Data Asset |
| `is_an` | Element ist Instanz des Data Assets |

> **Data Flow**: darf nur `transports` und `is_an` (nicht creates/reads/modifies/...).
> `transports` ist Pflicht; ein Flow ohne es ist unvollständig (Warnung).

### Process Assets

> **Process = aktiver Ablauf zur Laufzeit.** Das beschreibende Dokument (NC-Programm, Therapieprofil, Protokoll) ist ein **Data Asset**.

**Process vs. Function — Entscheidungsbaum:**
```
1. Kennst du die zeitliche Abfolge der Schritte?        Nein → Function
2. Wäre Sequencing Attack / Race Condition ein Threat?  Nein → Function
3. Wird der Ablauf zur Laufzeit instanziiert?           Nein → Function
                                                         Ja  → Process
```

| Beziehung | Semantik |
|---|---|
| `executes` | Element führt den Prozess aus (startet und steuert den Vollzug) |
| `invokes` | Element startet den Prozess |
| `terminates` | Element beendet den Prozess |
| `suspends` | Element pausiert den laufenden Prozess |
| `monitors` | Element überwacht den Prozess-Zustand zur Laufzeit |

### System Assets

| Beziehung | Semantik | STRIDE-Fokus |
|---|---|---|
| `controls` | Umfassende Kontrolle (start/stop/configure) | Tampering, EoP |
| `configures` | Ändert Konfiguration | Tampering |
| `monitors` | Liest Systemzustand | Repudiation bei Ausfall |
| `uses [qualifier]` | Nutzt Funktionalität (**Qualifier Pflicht**) | je Qualifier |
| `depends_on` | Abhängigkeit → Totalausfall bei Ausfall | DoS |
| `is_an` | Element ist Instanz des System Assets | – |

> **ChipBoundary → System Asset:** Ein Chip-Element (MCU, SE, FPGA) 
> verbindet sich via `is_an` mit dem entsprechenden System Asset.
> Alle weiteren Beziehungen laufen über dieses System Asset auf Ebene 2.

> **PhysicalBoundary → Physical/Infrastructure Asset:** Eine physische Grenze
> (Gehäuse, Schaltschrank, Raum, Fahrzeug) verbindet sich mit Assets via:
> `Physical Asset located_in PhysicalBoundary` — Sachwert befindet sich darin.
> `Infrastructure Asset secured_by PhysicalBoundary` — Infrastruktur wird geschützt.
> PhysicalBoundary ist **nicht connectable** (kein DataFlow terminiert daran).
> Bedrohungsrelevante Dimension: `physicalMobility` öffnet Evil-Maid / Depot-Attack-Klasse.

**System `uses`-Qualifiers:**

| Qualifier | Angriffsvektor |
|---|---|
| `api` | Injection, Auth Bypass |
| `network` | MitM, Eavesdropping |
| `hardware` | Tampering, Physical Attack |
| `library` | Code Injection, Dependency Confusion |

### Infrastructure Assets

| Beziehung | Semantik |
|---|---|
| `accesses [qualifier]` | Physischer Zugriff (**Qualifier Pflicht**) |
| `secures` | Schützt das physische Asset |
| `damages` | Kann Asset physisch beschädigen (Sabotage) |
| `powers` | Stellt Energieversorgung sicher |
| `monitors` | Überwacht physische Parameter |
| `is_an` | Element ist Instanz des Infra-Assets |

**Infrastructure `accesses`-Qualifiers:**

| Qualifier | Bedeutung |
|---|---|
| `on-site` | Zutritt vor Ort zum Gelände / zur Anlage |
| `proximity` | Aus der Nähe (RFID, WLAN) |
| `internal` | Im Inneren des Gehäuses (PCB, Debug-Port) |

> **`on-site` vs. `direct`:** `on-site` = Zutritt zu einem Ort (Infrastruktur). `direct` = physischer Kontakt mit einem Objekt (Physical Asset). `proximity` ist für beide identisch.

### Physical Assets

> **Kein DFD-Einstieg** — mit einer Ausnahme: `ExternalEntity → damages → Physical Asset` ist als Ebene-1-Beziehung erlaubt für **Sabotage-Szenarien** (OT/Anlagensicherheit).

> **PhysicalBoundary-Beziehungen:** `Physical Asset located_in PhysicalBoundary` beschreibt
> die räumliche Einbettung. `Infrastructure Asset secured_by PhysicalBoundary` beschreibt
> den Schutz durch die Boundary. Beide Beziehungen werden vom Rückwärts-Mapper abgeleitet.
> Alle anderen Beziehungen sind **Asset-zu-Asset (Ebene 2)**.

> Enthält das Asset Software oder eine CPU → **System Asset**.

**Sabotage-Ausnahme (Ebene 1):**

| Beziehung | Erlaubtes Element | Semantik |
|---|---|---|
| `damages` | External Entity | Physische Zerstörung / Sabotage passiver Bauteile |

### Service Assets

> **Abgrenzung zu System Assets:** Die **Verantwortungsgrenze** entscheidet — nicht die technische Schnittstelle.
> System Asset = volle Kontrolle, `responsibility: owner`. Service Asset = geteilt oder extern, `responsibility: shared / third-party`.
> AWS S3 hat eine REST-API → trotzdem **Service Asset** (`responsibility: shared`).

| Beziehung | Semantik |
|---|---|
| `uses [qualifier]` | Element nutzt den Service (**Qualifier Pflicht**) |
| `depends_on` | Hard-Dependency: Totalausfall bei Service-Ausfall |
| `monitors` | Element überwacht Service-Status/Verfügbarkeit |
| `configures` | Element konfiguriert den Service |
| `is_an` | Element ist Instanz des Service Assets |

> **`uses` vs. `depends_on`:** `uses` = Degradation Mode möglich. `depends_on` = Totalausfall bei Ausfall.

**Service `uses`-Qualifiers:**

| Qualifier | Angriffsvektor |
|---|---|
| `api` | REST/SOAP/gRPC → Injection, Auth Bypass |
| `sdk` | Library-Integration → Dependency Confusion |
| `webhook` | Event-basiert → Spoofing, Replay Attack |
| `managed` | Vollständig extern → Availability Risk, Vendor Lock-in |

> **`managed` + CRA-Pflicht:** Bei `serviceType: managed` ist `responsibilityScope` **blockierendes Pflichtfeld** — nicht optional. Inhalt muss Schnittstellen-Absicherung, Provider-Sicherheitskontrollen und Security-Incident-SLA beschreiben. Ohne dies: analytisches Loch im Risikobericht.

### Human Assets

| Beziehung | Semantik | Kontext |
|---|---|---|
| `affects_safety` | Beeinflusst physische Sicherheit | Safety, STRIDE: Tampering/DoS |
| `affects_privacy` | Beeinträchtigt Privatsphäre/DSGVO | Privacy, STRIDE: InfoDisc |
| `identifies` | Identifiziert/de-anonymisiert Person | Privacy |
| `tracks` | Verfolgt/überwacht Person | Privacy |
| `exposes` | Gefährdet/exponiert Person | Safety/Privacy |
| `is_an` | Element repräsentiert diese Person/Rolle | – |

---

## Ebene 2 – Asset-zu-Asset Beziehungen

### Zwei-Stufen-Regelwerk

| Stufe | Art | Analytisch | Konfigurierbar |
|---|---|---|---|
| **Core Rules** | generisch, domänenunabhängig | ✅ immer | ❌ fest eingebaut |
| **Domain Extensions** | domänenspezifisch | optional (+ Rationale Pflicht) | ✅ Phase 0 |

### Core Rules – innerhalb einer Kategorie

| Von → Nach | Beziehung | STRIDE-Relevanz |
|---|---|---|
| Data → Data | `derives_from` | Tampering transitiv |
| | `aggregates` | Tampering, InfoDisc |
| | `supersedes` | Tampering, Repudiation |
| Function → Function | `depends_on` | DoS |
| | `calls` | Tampering, Spoofing — statische Abhängigkeit (Designzeit) |
| | `supersedes` | Tampering, Repudiation |
| Process → Process | `triggers` | Tampering, Spoofing |
| | `depends_on` | DoS |
| | `suspends` | DoS |
| System → System | `depends_on [degradationMode?]` | DoS — gedämpft wenn `degradationMode: true` |
| | `integrates` | Tampering, Spoofing |
| Infra → Infra | `powers` | DoS |
| | `houses` | Tampering |
| Physical → Physical | `mechanically_linked` | Tampering |
| | `powered_by` | DoS |
| Service → Service | `depends_on [degradationMode?]` | DoS — gedämpft wenn `degradationMode: true` |
| | `delegates_to` | Spoofing, Tampering |
| Human → Human | `manages` | EoP |
| | `reports_to` | – |

### Core Rules – zwischen Kategorien

| Von → Nach | Beziehung | STRIDE-Relevanz |
|---|---|---|
| Data → Process | `required_by` | Tampering, DoS |
| | `consumed_by` | Tampering |
| Data → Function | `required_by` | Tampering, DoS |
| | `configures` | Tampering (**direct** wenn Function safety-kritisch) |
| Data → Human | `affects_privacy` | InfoDisc |
| | `exposes` | InfoDisc |
| Function → Process | `implemented_by` | Tampering |
| | `triggers` | Tampering, Spoofing |
| Function → System | `implemented_by` | Tampering |
| | `depends_on` | DoS |
| Function → Human | `affects_safety` | Tampering, DoS (**direct**) |
| | `operated_by` | Spoofing, Repudiation |
| Process → Function | `implements` | Tampering |
| | `invokes [step?]` | Tampering, Spoofing — **`stepOrder` optional → Sequencing Attack** |
| Process → System | `runs_on` | Tampering, EoP |
| | `requires` | DoS |
| Process → Human | `affects_safety` | Tampering, DoS (**direct**) |
| | `affects_privacy` | InfoDisc |
| | `operated_by` | Spoofing, Repudiation |
| System → Function | `implements` | Tampering |
| | `depends_on` | DoS |
| System → Infra | `hosted_on` | Tampering |
| | `powered_by` | DoS |
| Physical → Function | `enables` | Tampering (**direct**) — physische Präsenz ermöglicht Function |
| | `triggers` | Spoofing |
| Physical → System | `hosts` | Tampering |
| | `controlled_by` | Tampering, DoS (**direct**) |
| Physical → Infra | `located_in` | Tampering (indirect) |
| | `connected_to` | Tampering |
| | `powered_by` | DoS |
| Physical → Human | `endangers` | Tampering, DoS (**direct**) |
| | `exposes` | InfoDisc (indirect) |
| Service → Function | `provides` | Tampering, Spoofing |
| | `depends_on` | DoS |
| Service → Data | `exposes` | InfoDisc |
| | `consumes` | Tampering |
| Service → System | `integrates_with` | Spoofing, Tampering |
| | `monitors` | InfoDisc |
| Service → Infra | `hosted_on` | Tampering |
| | `depends_on` | DoS |
| Service → Human | `affects_privacy` | InfoDisc |
| | `endangers` | DoS (**direct** wenn `isSafetyCritical`) |
| Infra → Physical | `houses` | Tampering |
| Human → Process | `responsible_for` | Repudiation |
| | `authorized_for` | Spoofing, EoP |
| Human → Function | `authorized_for` | Spoofing, EoP |
| | `responsible_for` | Repudiation |
| Human → Physical | `owns` | Repudiation |
| | `responsible_for` | Repudiation |
| | `accesses [qualifier]` | Spoofing (bei unberechtigtem Zugriff) — **Qualifier Pflicht** |

**`Human → Physical: accesses`-Qualifiers:**

| Qualifier | Bedeutung |
|---|---|
| `direct` | Physischer Kontakt (Anfassen, Entnehmen, Manipulieren) |
| `proximity` | Aus der Nähe ohne Kontakt (RFID, Kamera) |
| `visual` | Reine Sichtlinie (Foto, optische Inspektion) |

### Safety-Propagation (Core Rules)

| Ebene | Default Relevance | `direct` möglich? | Override | Max. Hops |
|---|---|---|---|---|
| Element → Asset | `direct` / `indirect` | ✅ automatisch | ✅ bei direct | manuell |
| Asset → Asset Core | `indirect` (derived) | ✅ manual + Rationale Pflicht | ✅ nur bei manual + Rationale | **1** |
| Domain (dokumentarisch) | – | ❌ | ❌ | – |
| Domain (analytisch) | `direct` / `indirect` | ✅ manual + Rationale Pflicht | ✅ nur bei direct + Rationale | **0** (einmalig) |

> **Symmetrie Core / Domain analytisch:** Beide erlauben `direct` — beide verlangen Rationale. Kein methodischer Anreiz, Core Rules in Domain Extensions umzuwandeln.

> **Hop-Limit**: `C affects_safety Human` → B `depends_on` C = B: **indirect** (Hop 1, derived). A `depends_on` B = A: **nicht automatisch** → Analyst-Entscheidung mit Rationale.

### Domain Extensions – Vordefinierte Kataloge

**OT / Industrial (IEC 62443):**
`operates_near`, `exposes_to_hazard`, `physically_contains`, `controls_actuator`

**Medical (IEC 81001-5-1):**
`administered_to`, `treats`, `diagnoses`, `prescribes_for`, `contraindicated_with`

**Automotive (ISO 21434):**
`transports`, `endangers`, `controls_vehicle`

**Generic IT:**
`authenticates`, `audits`, `encrypts`, `backs_up`

> Default: **dokumentarisch** (kein STRIDE/Safety-Einfluss).
> Optional analytisch wirksam → Pflicht-Rationale + STRIDE-Mapping.

---

## Safety Annotation (alle Ebenen)

```
relevance:              "none" | "indirect" | "direct"
impact:                 "none" | "reversible_injury" | "irreversible_injury" | "fatality"
physicalHazardPotential: "low" | "medium" | "high"
protectionTarget:       true | false  (nur Human Assets)
affectedSafetyFunctions: string[]
rationale:              string
```

**Safety Override Rule:** `fatality` oder `irreversible_injury` → automatisch höchste Priorität (ISO 12100).

**Derived/Manual Pattern:**
```
*Source:    "derived" (automatisch) | "manual" (Analyst)
*Rationale: Pflicht wenn source === "manual" → verbatim im Audit-Report
```

---

## High-Value Asset (Infrastructure + Physical)

```
assetDestructionImpact:  "low" | "medium" | "high" | "critical"   (fachliche Grundlage)
isHighValueAsset:        "low" | "medium" | "high" | "critical"   (abgeleitete Management-Sicht)
isHighValueAssetSource:  "derived" | "manual"
replacementLeadTime:     "<3m (low)" | "3-6m (medium)" | "6-12m (high)" | ">12m (critical)"
replacementLeadTimeNote: string   (optional)
highValueRationale:      string   (Pflicht wenn isHighValueAsset gesetzt)
```

**Kausalitätskette:**
```
assetDestructionImpact + replacementLeadTime + vendorDependency
  → isHighValueAsset (derived)
    → Override Rule
```

> **Derived-Logik:** `isHighValueAsset` wird mindestens aus `assetDestructionImpact` +
> `replacementLeadTime` abgeleitet. Vollständige Formel siehe asset-beziehungen.md,
> Abschnitt "High-Value Asset Override".

**`highValueRationale` Pflichtbedingung:**
```
Pflicht:    isHighValueAssetSource === 'manual'
            OR isHighValueAsset ∈ {'high', 'critical'}
Optional:   isHighValueAsset ∈ {'low', 'medium'} + source === 'derived'
```

**High-Value Override Rule:**

> **MINIMUM-Prinzip:** Override setzt MINIMUM-Level — überschreibt keine höheren Bewertungen. Safety Override hat immer Vorrang.

```
isHighValueAsset === 'critical'  → CRITICAL minimum
isHighValueAsset === 'high'      → HIGH minimum
isHighValueAsset === 'medium'    → HIGH minimum
isHighValueAsset === 'low'       → kein Override, informativ
```
→ Pflicht-Threats bei critical/high: Tampering, DoS, Physical Damage
→ `highValueRationale` verbatim im Risk-Report bei high/critical

**Prioritätshierarchie (absteigend):**
```
1. Safety Override (fatality + direct)  → CRITICAL
2. HVA critical                         → CRITICAL minimum
3. HVA high                             → HIGH minimum
4. HVA medium / Operational critical   → HIGH minimum
5. HVA low                              → kein Override
```

**Abgrenzung:**

| | `isProtectionTarget` | `isHighValueAsset` |
|---|---|---|
| Träger | Human Asset | Infrastructure Asset / Physical Asset |
| Grund | Menschenleben (ISO 12100) | Strategische Unersetzlichkeit |
| Beispiel | Maschinenbediener | EUV-Lithographie-Maschine, Unikat-Gemälde |

---

## Physical Asset (Zusatz-Properties)

```
isUnique:               true | false   (Unikat → Spoofing-Threat Pflicht)
portability:            "fixed" | "portable"
uniquenessRationale:    string         (Pflicht wenn isUnique === true)
```

> **High-Value Properties:** Physical Assets erben die HVA-Felder identisch von Infrastructure
> (`assetDestructionImpact`, `isHighValueAsset`, `isHighValueAssetSource`, `replacementLeadTime`).
> Override Rule und Rangfolge sind dieselben — siehe High-Value Asset Block oben.

**Bedrohungs-Pflichten:**
- `isUnique === true` → Pflicht-Threat: **Spoofing** (Austausch gegen Fälschung)
- `isHighValueAsset === 'critical' | 'high'` → Pflicht-Threats: Tampering, DoS

---

## Service Asset (Zusatz-Properties)

```
serviceType:         "internal" | "external" | "cloud" | "managed"
responsibility:      "owner" | "shared" | "third-party"
responsibilityScope: string   (Pflicht bei third-party, empfohlen bei shared)
                              Was liegt in eigener Verantwortung?
providerName:        string
slaReference:        string
isSafetyCritical:    true | false
```

**Validierungsregeln:**
```
IF responsibility === "third-party" AND responsibilityScope === ""
→ FEHLER (blockierend): Schnittstellen-Absicherung, Provider-Kontrollen, SLA (CRA Art. 13)

IF responsibility === "shared" AND responsibilityScope === ""
→ WARNUNG: responsibilityScope empfohlen (CRA Art. 13)

IF responsibility === "third-party" AND depends_on.degradationMode === true
→ INFO: SLA auf Failover-Verhalten prüfen

IF responsibility === "third-party" AND kein depends_on
→ WARNUNG: Externer Service ohne explizite Abhängigkeit
```

**Safety-Propagation:**
`isSafetyCritical: true` + `endangers → Human` → Safety-relevanter Threat (direct)

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>
