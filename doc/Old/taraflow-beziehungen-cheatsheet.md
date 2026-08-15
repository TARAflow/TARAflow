# TARAflow – Beziehungs-Cheat Sheet

<sub>© Jürgen Messerer · 2026</sub>

---

## Graphstruktur

```
Ebene 1:  DFD-Elemente ──(DataFlows)── DFD-Elemente
               ↕  Element-zu-Asset (typisiert)
Ebene 2:  Assets ──(Asset-zu-Asset)── Assets
          (Data / Process / System / Infrastructure / Human)
```

---

## Ebene 1 – Element-zu-Asset Beziehungen

### `is_an` – Sonderregel (gilt für alle Asset-Typen)
> Exklusiv: ein DFD-Element ist **entweder** `is_an` **oder** hat Wirkungsbeziehungen — nie beides zum selben Asset.

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

| Beziehung | Semantik |
|---|---|
| `executes` | Element führt den Prozess aus |
| `invokes` | Element startet/ruft den Prozess auf |
| `terminates` | Element beendet den Prozess |
| `suspends` | Element pausiert den Prozess |
| `monitors` | Element überwacht den Prozess |
| `is_an` | Element ist Instanz des Process Assets |

### System Assets

| Beziehung | Semantik | STRIDE-Fokus |
|---|---|---|
| `controls` | Umfassende Kontrolle (start/stop/configure) | Tampering, EoP |
| `configures` | Ändert Konfiguration | Tampering |
| `monitors` | Liest Systemzustand | Repudiation bei Ausfall |
| `uses [qualifier]` | Nutzt Funktionalität (**Qualifier Pflicht**) | je Qualifier |
| `depends_on` | Abhängigkeit → Totalausfall bei Ausfall | DoS |
| `is_an` | Element ist Instanz des System Assets | – |

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
| `local` | Direkter Zugriff vor Ort |
| `proximity` | Aus der Nähe (RFID, WLAN) |
| `internal` | Im Inneren des Gehäuses (PCB, Debug-Port) |

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
| Process → Process | `triggers` | Tampering, Spoofing |
| | `depends_on` | DoS |
| | `suspends` | DoS |
| System → System | `depends_on` | DoS |
| | `integrates` | Tampering, Spoofing |
| Infra → Infra | `powers` | DoS |
| | `houses` | Tampering |
| Human → Human | `manages` | EoP |
| | `reports_to` | – |

### Core Rules – zwischen Kategorien

| Von → Nach | Beziehung | STRIDE-Relevanz |
|---|---|---|
| Data → Process | `required_by` | Tampering, DoS |
| | `consumed_by` | Tampering |
| Data → Human | `affects_privacy` | InfoDisc |
| | `exposes` | InfoDisc |
| Process → System | `runs_on` | Tampering, EoP |
| | `requires` | DoS |
| Process → Human | `affects_safety` | Tampering, DoS (**direct**) |
| | `affects_privacy` | InfoDisc |
| | `operated_by` | Spoofing, Repudiation |
| System → Infra | `hosted_on` | Tampering |
| | `powered_by` | DoS |
| Human → Process | `responsible_for` | Repudiation |
| | `authorized_for` | Spoofing, EoP |

### Safety-Propagation (Core Rules)

| Ebene | Erlaubte Relevance | Override | Max. Hops |
|---|---|---|---|
| Element → Asset | `direct` / `indirect` | ✅ bei direct | manuell |
| Asset → Asset Core | `indirect` only | ❌ | **1** |
| Domain (dokumentarisch) | – | ❌ | – |
| Domain (analytisch) | `direct` / `indirect` | ✅ nur mit Rationale | **0** (einmalig) |

> **Hop-Limit**: `C affects_safety Human` → B `depends_on` C = B: **indirect** (Hop 1). A `depends_on` B = A: **nicht automatisch** → Analyst-Entscheidung.

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

## High-Value Asset (nur Infrastructure)

```
isHighValueAsset:        true | false
assetDestructionImpact:  "high" | "critical"
replacementLeadTime:     "<3m (low)" | "3-6m (medium)" | "6-12m (high)" | ">12m (critical)"
replacementLeadTimeNote: string   (optional – Präzisierung oder Fallback-Begründung)
highValueRationale:      string   (Pflicht wenn isHighValueAsset === true)
```

**High-Value Override Rule:**
`isHighValueAsset === true` + `assetDestructionImpact === 'critical'`
→ Threat-Priorität CRITICAL, unabhängig vom Likelihood-Score
→ Pflicht-Threats: Tampering, DoS, Physical Damage
→ `highValueRationale` verbatim im Risk-Report

**Abgrenzung zu `isProtectionTarget`:**

| | `isProtectionTarget` | `isHighValueAsset` |
|---|---|---|
| Träger | Human Asset | Infrastructure Asset |
| Grund | Menschenleben (ISO 12100) | Strategische Unersetzlichkeit |
| Beispiel | Maschinenbediener | EUV-Lithographie-Maschine |

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>
