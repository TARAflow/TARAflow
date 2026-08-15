# TARAflow: Asset-zu-Asset Beziehungen

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>

> **Zweck dieses Dokuments:** Formale Definition der Asset-zu-Asset Beziehungen in TARAflow.
> Diese Beziehungen ergänzen die Element-zu-Asset Beziehungen und ermöglichen die Modellierung
> direkter semantischer Verbindungen zwischen Assets – ohne Umweg über DFD-Elemente.

---

## Wie dieses Dokument zu lesen ist

Dieses Dokument definiert das vollständige Beziehungsregelwerk. **Vollständigkeit ist das Ziel
des Dokuments — nicht das Ziel jedes Modells.**

In der Praxis decken wenige Kernbeziehungen den grössten Teil der Anwendungsfälle ab.
Beziehungen mit **[KERN]** sind der empfohlene Einstieg.

### KERN-Beziehungen

> **`[KERN]`** = empfohlene Startbeziehungen, decken ~80% der Anwendungsfälle ab.

Beziehungen mit **`[KERN]`** decken die meisten Projekte ab.

**Empfehlung:**
- Starte ausschliesslich mit `[KERN]`-Beziehungen
- Modelliere nur was du erklären kannst — Vollständigkeit kommt durch Iteration, nicht durch Erschöpfung

**Erweitere das Modell erst wenn:**
- Auswirkungen nicht erklärbar sind (`"Warum ist dieser Asset kritisch?"`)
- Abhängigkeiten im Graphen fehlen (`"Dieser Threat hat keinen Einstiegspunkt"`)
- Threats nicht klar zuordenbar sind (`"STRIDE-Kategorie unklar"`)

**KERN-Beziehungen im Überblick:**

| Beziehung | Von → Nach | Zweck |
|---|---|---|
| `depends_on` | System/Service/Process → * | Verfügbarkeitsabhängigkeit (DoS) |
| `required_by` | Data → Process/Function | Input-Abhängigkeit (Tampering) |
| `contributes_to` | Asset → Hazard Item | Beitrag zur Gefährdung (trägt `relevance`) |
| `endangers` | Hazard Item → Human/Environment/Infrastructure | Gefährdung eines Schutzziels (trägt `impact`) |
| `affects_privacy` | Data/Process → Human | Privacy-Relevanz |
| `configures` | Data → Function/System | Konfigurationsabhängigkeit |
| `runs_on` | Process → System | Ausführungskontext |
| `implements` | System/Process → Function | Architekturzuordnung |
| `hosted_on` | System → Infrastructure | Physische Einbettung |

> **Safety-Modellierung:** Die frühere direkte Kante `affects_safety` (Process/Function → Human)
> wird durch das Hazard-Item-Muster ersetzt: `Asset ─contributes_to─► Hazard Item ─endangers─► Schutzziel`.
> Bei einfachen Fällen (ein Eingang) kann das Hazard Item eingeklappt dargestellt werden —
> der Analyst zeichnet dann direkt `Asset ─endangers─► Human`, das Tool ergänzt das Hazard Item intern.
> Details siehe Safety Annotation Layer im Dokument "Asset-Beziehungen".

> Alle anderen Beziehungen sind valide — sie werden genutzt wenn das Modell es verlangt,
> nicht weil das Dokument sie aufführt.

---

## 1. Konzept und Einordnung im Graph

Der TARAflow-Graph hat zwei Hauptebenen – wobei Ebene 2 aus den Asset-Knotentypen besteht,
aufgeteilt in eine vertikale Hierarchie und orthogonale Kategorien, ergänzt um den
Hazard Item als eigenen Gefährdungsknoten:

```
Ebene 1:      DFD-Elemente  ──(DataFlows)──  DFD-Elemente
                   ↕ Element-zu-Asset Beziehungen (typisiert)
Ebene 2:
  Vertikal    Data Assets           ──┐  Statische Struktur
  (Abstraktion)  Function Assets    ──┤  (Was / Womit / Wo)
                 System Assets      ──┤
                 Infrastructure Assets ─┤
                                      ├──(Asset-zu-Asset Beziehungen)──
  Orthogonal  Process Assets        ──┤  Dynamischer Kontext
  (Kontext)   Physical Assets       ──┤  (Wie / Womit / Wer)
              Service Assets        ──┤
              Human Assets          ──┤
              Environment Assets    ──┘  Schutzziel (Umwelt)

  Gefährdung  Hazard Item  ◄─contributes_to─ Assets
  (kein Asset)             ─endangers─► Human / Environment / Infrastructure
```

**Environment Asset** ist eine orthogonale Kategorie und ein **Schutzziel** wie Human —
die Umwelt als schützenswertes Gut (Gewässer, Boden, Luft), ohne Personenbezug.

**Hazard Item** ist **kein Asset**, sondern die explizite Gefährdung. Es ist der
Konvergenzpunkt zwischen gefährdungsverursachenden Assets (`contributes_to`) und
gefährdeten Schutzzielen (`endangers`). Mehrere `contributes_to`-Eingänge auf dasselbe
Hazard Item bilden ein implizites AND (kombinatorische Gefährdung). Details siehe
Abschnitt "Hazard Item" im Dokument "Asset-Beziehungen".

Ebene 2 ist ein **heterogener Graph**. Die erlaubten
Beziehungstypen sind abhängig von der Kombination **Quell-Kategorie × Ziel-Kategorie**:

```
Innerhalb einer Kategorie:   Data→Data, Process→Process, ...
Zwischen Kategorien:         Data→Process, Process→Human, System→Infrastructure, ...
```

Das entspricht dem gleichen Prinzip wie Ebene 1: auch DFD-Elemente haben verschiedene
Typen (Process, DataStore, ExternalEntity, ...) mit typenabhängigen Verbindungsregeln.

Asset-zu-Asset Beziehungen beschreiben **Kausalität, die unabhängig vom Datenfluss existiert** —
Safety-, Privacy- und physische Abhängigkeiten zwischen Assets die sich nicht natürlich über
ein DFD-Element ausdrücken lassen.

**Beispiel:**
```
Data Asset "Admin Audit Logs"
└─ affects_privacy → Human Asset "System Admin Role"

→ Diese Beziehung existiert unabhängig davon welches DFD-Element
  die Audit Logs erzeugt oder liest.
```

---

## 2. Zwei-Stufen-Regelwerk

TARAflow unterscheidet zwei Stufen von Asset-zu-Asset Beziehungen:

```
Stufe 1: Core Rules
         → generisch, domänenunabhängig
         → fest eingebaut ins Tool
         → analytisch wirksam (STRIDE, Safety, Kritikalität)

Stufe 2: Domain Extensions
         → domänenspezifisch, konfigurierbar
         → in Phase 0 (Projektprofil) aktivierbar oder manuell definierbar
         → default: nur dokumentarisch
         → optional: analytisch wirksam (mit Pflicht-Rationale)
```

---

## 3. Stufe 1: Core Rules (generisch)

### 3.1 Innerhalb derselben Asset-Kategorie

**Data → Data:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `derives_from` | Asset B wird aus Asset A abgeleitet | Tampering (A beeinflusst B) | transitiv |
| `aggregates` | Asset B aggregiert mehrere A-Instanzen | Tampering, InfoDisc | transitiv |
| `supersedes` | Asset B ersetzt Asset A (z.B. neue Firmware) | Tampering, Repudiation | transitiv |

**Function → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `depends_on` | Function A benötigt Function B zur Ausführung | DoS | direct wenn B safety-kritisch |
| `supersedes` | Function A ersetzt Function B (neue Version) | Tampering, Repudiation | transitiv |
| `calls` | Function A ruft Function B auf (funktionale Abhängigkeit zur Designzeit) | Tampering, Spoofing | direct wenn B safety-kritisch |

> **`calls` vs. `invokes`:** `calls` beschreibt eine **statische funktionale Abhängigkeit** zwischen zwei Capabilities (Designzeit). `invokes` ist reserviert für **Process→Function** und beschreibt den dynamischen Aufruf eines Werkzeugs zur Laufzeit.

**Process → Process:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `triggers` | Prozess A löst Prozess B aus | Tampering, Spoofing | direct wenn B safety-kritisch |
| `depends_on` | Prozess A benötigt Prozess B | DoS | transitiv |
| `suspends` | Prozess A unterbricht Prozess B | DoS | direct wenn B safety-kritisch |

**System → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `depends_on` **[KERN]** | System A benötigt System B | DoS | transitiv |
| `integrates` | System A integriert System B | Tampering, Spoofing | transitiv |

**Infrastructure → Infrastructure:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `powers` | Infra A versorgt Infra B mit Strom | DoS | indirect |
| `houses` | Infra A beherbergt Infra B physisch | Tampering | indirect |

**Human → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `manages` | Person A verwaltet Person B | EoP | – |
| `reports_to` | Person A rapportiert an Person B | – | – |

---

**Physical → Physical:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `mechanically_linked` | Physische Komponente A wirkt auf B | Tampering | direct wenn B safety-kritisch |
| `powered_by` | Komponente A wird von B versorgt | DoS | indirect |

**Service → Service:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `depends_on` | Service A benötigt Service B | DoS | transitiv |
| `delegates_to` | Service A übergibt Anfragen an Service B | Spoofing, Tampering | transitiv |

---

### 3.2 Zwischen verschiedenen Asset-Kategorien

**Semantische Orientierungshilfe — ähnlich klingende Beziehungen:**

| Beziehung | Primäre Semantik | STRIDE-Fokus | Wann wählen |
|---|---|---|---|
| `depends_on` | Verfügbarkeitsabhängigkeit | DoS | Wenn Ausfall des Ziels den Quell-Asset stoppt |
| `required_by` | Input-Abhängigkeit | Tampering | Wenn Daten als Input für Ausführung benötigt werden |
| `consumed_by` | Transformation | Tampering | Wenn Daten durch den Prozess verändert/verbraucht werden |
| `implements` | Architektur (aktiv) | Tampering | System/Process stellt eine Function bereit |
| `implemented_by` | Architektur (passiv) | Tampering | Function wird durch System/Process realisiert (Spiegelrichtung) |
| `runs_on` | Ausführungskontext | EoP, Tampering | Process läuft physisch auf System |
| `hosted_on` | Infrastruktureinbettung | Tampering | System ist in Infrastructure untergebracht |

> **Faustregel:** `depends_on` = "Wenn X ausfällt, falle ich auch aus."
> `required_by` = "Ich brauche X als Input, um zu funktionieren."
> `consumed_by` = "X wird durch mich verändert."

**Data → Process:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `required_by` **[KERN]** | Daten werden für Prozessausführung benötigt | Tampering, DoS | transitiv via Prozess |
| `consumed_by` | Daten werden durch Prozess transformiert | Tampering | transitiv |
| `configures [step?]` | Daten konfigurieren einen bestimmten Prozessschritt — optionaler `stepOrder`-Qualifier | Tampering | direct wenn Prozessschritt safety-kritisch |

**Data → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `required_by` **[KERN]** | Daten werden für Funktionsausführung benötigt | Tampering, DoS | transitiv via Function |
| `configures` **[KERN]** | Daten konfigurieren das Verhalten einer Function | Tampering | direct wenn Function safety-kritisch |

**Data → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `affects_privacy` **[KERN]** | Daten enthalten personenbezogene Informationen | InfoDisc | – |
| `exposes` | Daten exponieren Person gegenüber Risiken | InfoDisc | indirect |

**Function → Data:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `creates` | Function erzeugt Data Asset | Tampering, Repudiation | transitiv |
| `reads` | Function liest Data Asset | InfoDisc | transitiv |
| `modifies` | Function verändert Data Asset | Tampering | direct wenn Data safety-kritisch |
| `deletes` | Function löscht Data Asset | DoS | transitiv |

**Function → Process:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `implemented_by` | Function wird durch Prozess implementiert | Tampering | direct wenn Function safety-kritisch |
| `triggers` | Function löst Prozess aus | Tampering, Spoofing | transitiv |

**Function → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `implemented_by` | Function wird durch System bereitgestellt | Tampering | direct wenn Function safety-kritisch |
| `depends_on` | Function benötigt System zur Ausführung | DoS | transitiv |

**Function → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `contributes_to` **[KERN]** | Function trägt zu einer Gefährdung (Hazard Item) bei | Tampering, DoS | `relevance` an der Kante |
| `operated_by` | Function wird von Mensch ausgelöst oder überwacht | Spoofing, Repudiation | indirect |

> **Safety-Pfad:** `Function ─contributes_to─► Hazard Item ─endangers─► Human`.
> Bei einem einzelnen Eingang mit ableitbarer Gefährdung kann das Hazard Item
> eingeklappt werden (`Function ─endangers─► Human`). Die frühere direkte Kante
> `affects_safety` entspricht diesem eingeklappten Fall.

**Process → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `implements` **[KERN]** | Prozess implementiert diese Function | Tampering | direct wenn Function safety-kritisch |
| `invokes [step?]` | Prozess ruft Function auf — optionaler `stepOrder`-Qualifier | Tampering, Spoofing | transitiv |

> **`stepOrder`-Qualifier:** Trägt ein `invokes` einen Schritt-Index (`step: 1`, `step: 2`, ...),
> entsteht eine geordnete Sequenz. Manipulation der Reihenfolge = **Sequencing Attack** —
> ein Threat-Typ der nur über Process Assets modellierbar ist.

**Process → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `runs_on` **[KERN]** | Prozess läuft auf System | Tampering, EoP | transitiv |
| `depends_on` | Prozess ist kritisch abhängig von System | DoS | transitiv |

**Process → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `contributes_to` **[KERN]** | Prozess trägt zu einer Gefährdung (Hazard Item) bei | Tampering, DoS | `relevance` an der Kante |
| `affects_privacy` **[KERN]** | Prozess verarbeitet personenbezogene Daten | InfoDisc | – |
| `operated_by` | Prozess wird von Mensch bedient | Spoofing, Repudiation | indirect |

> **Safety-Pfad:** `Process ─contributes_to─► Hazard Item ─endangers─► Human`.
> Eingeklappt bei einem Eingang: `Process ─endangers─► Human`. Entspricht der
> früheren direkten Kante `affects_safety`.

**System → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `implements` **[KERN]** | System stellt diese Function bereit | Tampering | direct wenn Function safety-kritisch |
| `depends_on` | System benötigt Function | DoS | transitiv |

**System → Infrastructure:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `hosted_on` **[KERN]** | System läuft auf Infrastruktur | Tampering | indirect |
| `powered_by` | System wird von Infrastruktur versorgt | DoS | indirect |

**Human → Process:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `responsible_for` | Person ist verantwortlich für Prozess | Repudiation | – |
| `authorized_for` | Person ist autorisiert Prozess auszuführen | Spoofing, EoP | – |

---

> **Physical Assets — Rolle im Graph:** Physical Assets sind rein passive Sachwerte ohne
> eingebettetes System. Sie erscheinen nicht im DFD-Fluss, sind aber über Asset-zu-Asset
> Beziehungen vollständig in den Graphen eingebunden. Physical ist keine Unterart von
> Infrastructure — Infrastructure ist ortsfest (Gebäude, Netz), Physical ist mobil
> (Werkzeug, Gemälde, Prototyp). Der Angriffspfad zu einem Physical Asset verläuft
> immer über Infrastructure oder System Assets als Einstiegspunkt.

**Physical → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `enables` | Physisches Asset ermöglicht die Ausführung der Function | Tampering | **direct** |
| `triggers` | Physisches Event löst Function aus | Spoofing | direct wenn Function safety-kritisch |

> **`enables` statt `executes`:** Ein rein passives Physical Asset führt nichts aus — es *ermöglicht* eine Funktion durch seine physische Präsenz oder seinen Zustand. Ein hydraulischer Bremsaktuator ermöglicht die Bremsfunktion; ein mechanischer Schlüssel ermöglicht die Zutrittsfunktion. `executes` bleibt DFD-Elementen und Process Assets vorbehalten.

**Physical → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `hosts` | Physisches Gerät hostet System | Tampering | indirect |
| `controlled_by` | Physische Komponente wird durch System gesteuert | Tampering, DoS | **direct** |

**Physical → Infrastructure:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `connected_to` | Physische Komponente ist mit Infrastruktur verbunden | Tampering | indirect |
| `powered_by` | Physische Komponente wird von Infrastruktur versorgt | DoS | indirect |
| `located_in` | Physical Asset befindet sich physisch in Infrastruktur | Tampering | indirect |

> **`located_in` vs. `connected_to`:** `located_in` beschreibt reine Ortsbeziehung (Gemälde hängt im Museumsraum); `connected_to` beschreibt eine technische Verbindung (Sensor verbunden mit OT-Netzwerk).

**Service → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `provides` | Externer Service stellt Function bereit | Tampering, Spoofing | direct wenn Function safety-kritisch |
| `depends_on` | Service benötigt Function | DoS | transitiv |

**Service → Data:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `exposes` | Service exponiert Daten nach aussen | InfoDisc | – |
| `consumes` | Service verarbeitet/speichert Daten | Tampering | transitiv |

**Service → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `integrates_with` | Service kommuniziert mit internem System | Spoofing, Tampering | transitiv |
| `monitors` | Service überwacht System | InfoDisc | indirect |

**Human → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `authorized_for` | Person ist autorisiert Function auszulösen | Spoofing, EoP | – |
| `responsible_for` | Person ist verantwortlich für Function | Repudiation | – |

---

**Physical → Hazard Item:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `contributes_to` | Physical Asset trägt zu einer Gefährdung bei (steuert/ermöglicht die physische Aktion) | Tampering, DoS | `relevance` an der Kante (`direct` wenn das Asset die physische Aktion unmittelbar steuert) |
| `exposes` | Physical Asset exponiert Person gegenüber Risiken (z.B. Strahlung, Substanz) | InfoDisc | indirect |

> **Architektur-Hinweis:** In der neuen Safety-Modellierung geht die Kante `endangers`
> ausschliesslich vom **Hazard Item → Schutzziel** (Human/Environment/Infrastructure).
> Ein Physical Asset (z.B. übersteuertes Ventil, Roboterarm) trägt via `contributes_to`
> zum Hazard Item bei. Vollständiger Pfad:
> `Physical ─contributes_to─► Hazard Item ─endangers─► Human`.
> Bei einem einzelnen Eingang kann das Hazard Item eingeklappt dargestellt werden
> (`Physical ─endangers─► Human`) — intern existiert es trotzdem.

**Service → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `affects_privacy` | Service verarbeitet oder exponiert personenbezogene Daten | InfoDisc | – |
| `endangers` | Ausfall des safety-kritischen Service gefährdet Person | DoS | direct wenn `isSafetyCritical: true` |

> `endangers` bei Service→Human ist nur relevant wenn der Service eine Safety-kritische Funktion trägt (z.B. Remote-Monitoring-Service für Patientenüberwachung). Ohne `isSafetyCritical: true` am Service Asset keine automatische Safety-Propagation.

**Service → Infrastructure:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `hosted_on` | Service läuft auf interner Infrastruktur | Tampering | indirect |
| `depends_on` | Service ist abhängig von Infrastruktur-Verfügbarkeit | DoS | transitiv |

**Infrastructure → Physical:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `houses` | Infrastruktur beherbergt das Physical Asset | Tampering | indirect |

> Umgekehrte Sichtweise zu `Physical → Infrastructure: located_in`. Beide Beziehungen können modelliert werden; `located_in` (Physical→Infra) ist die bevorzugte Richtung da das Physical Asset der primäre Analysegegenstand ist.

**Human → Physical:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `owns` | Person besitzt das Physical Asset | Repudiation | – |
| `responsible_for` | Person ist verantwortlich für Zustand und Verbleib des Assets | Repudiation | – |
| `accesses` | Person greift auf das Physical Asset zu | Spoofing (bei unberechtigtem Zugriff) | – |

---

### 3.3 Semantische Abgrenzung und Konflikte

Einige Beziehungstypen sind semantisch ähnlich, aber nicht kombinierbar für dieselbe Asset-Paarung. Die folgende Tabelle klärt Grenzfälle — formale Validierung erfolgt durch das Tool.

| Kombination | Problem | Empfehlung |
|---|---|---|
| `required_by` + `consumed_by` (Data → Process) | Widerspruch: Input vs. Transformation | Wähle genau eine Semantik. `required_by` wenn Daten gelesen werden; `consumed_by` wenn sie transformiert/verbraucht werden |
| `depends_on` + `implements` (System/Process → Function) | Architektur und Laufzeitabhängigkeit vermischt | `implements` für statische Architekturzuordnung; `depends_on` ausschliesslich für Verfügbarkeitsabhängigkeit zur Laufzeit |
| `runs_on` + `hosted_on` falsch eingesetzt | Ausführungs- und Infrastrukturebene vermischt | `runs_on` gilt für Process→System (Ausführungskontext); `hosted_on` gilt für System→Infrastructure (physische Einbettung) |
| Mehrfach `contributes_to` auf dasselbe Hazard Item als `direct` | Verwechslung von Kombinatorik und Redundanz | Bei `combinationType: ALL` sind mehrere `direct`-Beiträge korrekt (A UND B). `relevance` beschreibt die funktionale Rolle jedes Assets bei der Hazard-Realisierung; die topologische Entfernung wird separat über `hazardDistance` modelliert. Assets erben keine `relevance` automatisch aufgrund ihrer Position im Graph |
| `implements` (bidirektional: A→B und B→A) | Zirkuläre Architekturaussage | `implements` ist gerichtet: der Träger implementiert die Fähigkeit — nicht umgekehrt |

---

### 3.4 Analytische Wirkung der Core Rules

Core Rules sind **analytisch wirksam** – sie beeinflussen:

**STRIDE-Ableitung:**
```
Auslöser                                    → Pflicht-Threat
─────────────────────────────────────────────────────────────
Data A derives_from Data B                        → Tampering auf B impliziert Tampering auf A
Process A triggers Process B[safety]              → DoS auf A = Safety-relevanter Threat
Process A contributes_to Hazard → endangers Human → Tampering + DoS als Pflicht-Threats
Data affects_privacy Human                        → InfoDisc als Pflicht-Threat
Function A depends_on Function B[safety]          → DoS auf A = Safety-relevanter Threat
Function A contributes_to Hazard → endangers Human → Tampering + DoS als Pflicht-Threats
Data configures Function[safety]                  → Tampering auf Data = Safety-relevanter Threat
Physical enables Function[safety]                 → Tampering auf Physical = CRITICAL
Physical endangers Human                          → Tampering + DoS auf Physical = Safety-relevanter Threat
Service provides Function[safety]                 → Spoofing auf Service = Safety-relevanter Threat
Service endangers Human[isSafetyCritical]         → DoS auf Service = Safety-relevanter Threat
Physical located_in Infrastructure                → Tampering auf Infra = indirekter Threat auf Physical
```

**Safety-Propagation (hazardDistance, nicht relevance):**
```
Process B ─contributes_to [direct] → Hazard Item
Process A ─triggers→ Process B
→ Process A erhält KEINE automatische relevance-Ableitung
→ hazardDistance = 1 (eine Kante vom Hazard-tragenden Asset entfernt)
→ relevance bleibt offen — Analyst vergibt funktional (direct wenn A
  die physische Aktion ebenfalls unmittelbar mitsteuert, sonst indirect)

Data ─required_by→ Process B (contributes_to Hazard)
→ Data: hazardDistance = 1, relevance vom Analyst (typ. indirect — Daten
  steuern keine physische Aktion)

Physical ─contributes_to [direct] → Hazard Item
→ Physical: hazardDistance = 0, relevance = direct
  (direkter Beitrag zum Hazard)
```

> **`relevance` wird nicht über Hops abgeleitet.** Die Position im Graphen erzeugt
> nur einen `hazardDistance`-Wert. `relevance` bleibt die funktionale Eigenschaft
> (kontrolliert das Asset die physische Aktion?) und wird vom Analysten vergeben —
> das Tool kann höchstens einen *Vorschlag* anbieten, keine automatische Festlegung.

**Kritikalitäts-Ableitung:**
```
Folgt dem bestehenden Derived/Manual Pattern:
→ Core-Rule-Ableitungen = source: "derived"
→ keine zusätzliche Dokumentationspflicht
→ im Audit-Report automatisch als "systemisch abgeleitet" markiert
```

---

### 3.5 Propagations-Grenzen (formale Regeln)

**Drei getrennte Dimensionen — keine Vermischung:**

| Dimension | Bedeutung | Wer vergibt |
|---|---|---|
| `relevance` | funktionaler Beitrag zum Hazard (steuert die physische Aktion?) | Analyst (Tool schlägt vor) |
| `hazardDistance` | topologische Entfernung zum Hazard-tragenden Asset (0, 1, 2...) | automatisch aus Graph |
| `physicalHazardPotential` | Schadenspotenzial des Assets/Hazards selbst | Analyst / Hazard Item |

Beispiel — dieselben Assets, drei unabhängige Dimensionen:

| Asset | relevance | hazardDistance | physicalHazardPotential |
|---|---|---|---|
| Roboterarm | direct | 0 | high |
| Motion Controller | direct | 1 | low |
| PLC-Netzwerk | indirect | 2 | low |
| Natriumtank | indirect | 0 | high |
| Wasserleitung | indirect | 0 | low |

> Roboterarm und Motion Controller sind **beide `direct`** — beide steuern die
> physische Aktion unmittelbar mit. Sie unterscheiden sich nur in `hazardDistance`.
> Der Natriumtank ist `indirect` (steuert nichts aktiv), hat aber `hazardDistance: 0`
> (ist direkt am Hazard) und `physicalHazardPotential: high`. Diese drei Dimensionen
> erklären exakt die Fälle, die in flacher `relevance`-Modellierung immer wieder
> zu Kategoriefehlern führten.

Asset-zu-Asset Beziehungen erweitern die Safety-Analyse auf eine zweite semantische
Ebene. Ohne formale Begrenzung entsteht das Risiko einer **Transitive Closure Explosion**:
dichte Abhängigkeitsgraphen in sicherheitskritischen Systemen führen dazu dass fast alle
Assets in die Analyse gezogen werden – das CRITICAL-Inflationsproblem auf neuer Ebene.

Die folgenden Regeln begrenzen die **automatische Analyseausbreitung** formal
(nicht die Relevanz — die bleibt funktional und wird vom Analysten vergeben):

---

**Regel 1: Primary Causality Carrier**

Die DFD-Ebene (Element→Asset) hat Vorrang gegenüber der Asset-Ebene (Asset→Asset).
Die automatische Analyse setzt auf Asset→Asset Ebene `hazardDistance ≥ 1` — `relevance`
bleibt offen und wird vom Analysten funktional vergeben:

```
Element→Asset Beziehung mit SafetyAnnotation:
  → darf relevance: 'direct' tragen (Analyst-Entscheidung am DFD-Canvas)
  → hazardDistance: 0
  → Safety Override Rule greift bei direct + fatality
  → primäre Quelle für Safety-Kritikalität

contributes_to → Hazard Item:
  → hazardDistance: 0 (direkter Beitrag zum Hazard)
  → relevance funktional (direct wenn Asset die physische Aktion steuert)

Asset→Asset Core Rule (triggers, depends_on, required_by, ...):
  → setzt hazardDistance automatisch (Hop-Zählung), source: "derived"
  → relevance bleibt offen — KEINE automatische Festlegung
  → Analyst vergibt relevance funktional; bei 'direct' jenseits hazardDistance 0:
      • source: "manual" Pflicht
      • Rationale Pflicht ("Warum steuert dieses Asset die physische Aktion mit?")
```

> **Kein automatisches `indirect` mehr.** Früher setzte die Hop-Logik `relevance: indirect`
> automatisch. Das vermischte topologische Distanz mit funktionaler Rolle. Jetzt erzeugt
> die Position nur `hazardDistance`; `relevance` ist immer eine funktionale Aussage.

---

**Regel 2: hazardDistance-Berechnung & Analyse-Grenze**

Die automatische Analyseausbreitung über Asset→Asset Beziehungen stoppt nach
**hazardDistance 1** (default). Begrenzt wird die *automatische Ausbreitung*,
nicht die Relevanz:

```
C  contributes_to  Hazard    → C: hazardDistance 0  (direkter Beitrag)
B  depends_on      C         → B: hazardDistance 1  (automatisch erfasst, derived)
A  depends_on      B         → A: hazardDistance 2  (NICHT automatisch erfasst)
                               → erfordert explizite Analyst-Entscheidung
                               → source: "manual" + Rationale Pflicht
```

`relevance` wird auf keiner dieser Stufen automatisch gesetzt — sie ist immer
funktional und vom Analysten vergeben.

Kombinierte Distanz über beide Ebenen:

```
DFD-Element → Asset (Element→Asset)         → hazardDistance 0
Asset → Asset (eine Kante)                  → hazardDistance 1 (derived)
Asset → Asset (zwei Kanten)                 → hazardDistance 2+ (nicht automatisch)
```

**Konfiguration in Phase 0 (Projektprofil):**

Die Analyse-Grenze ist pro Projekt konfigurierbar:

```
maxHazardDistance: 1  (default — empfohlen für die meisten Projekte)
maxHazardDistance: 2  (optional — für OT-Anlagen mit bekannt langen Kaskaden)
```

Bei `maxHazardDistance: 2` gilt zusätzliche Schutzmassnahme gegen `direct`-Inflation:

```
IF hazardDistance === 2 AND relevance === 'direct'
THEN Validierungsfehler (blockierend):
     "direct relevance auf hazardDistance 2 erfordert zwingend Rationale.
      Begründung warum dieses Asset die physische Aktion unmittelbar mitsteuert,
      obwohl es zwei Kanten vom Hazard-tragenden Asset entfernt ist."
```

> **Warum diese Bremse?** Ein Asset zwei Kanten entfernt kann durchaus funktional
> `direct` sein (z.B. ein PLC der ein Ventil steuert, das ein Ventil steuert). Aber
> das ist selten und sollte begründet werden. Die Rationale-Pflicht stellt sicher,
> dass jede solche Annotation eine bewusste, dokumentierte Entscheidung ist.

---

**Regel 3: Keine automatische Eskalation von indirect zu CRITICAL**

`indirect` safety-relevante Assets dürfen nicht automatisch zu CRITICAL eskalieren –
unabhängig davon ob die Verbindung über DFD-Ebene oder Asset-Ebene entstand:

```
fatality + relevance: 'direct'    → CRITICAL  (Safety Override greift)
fatality + relevance: 'indirect'  → HIGH+     (kein automatischer Override)

HIGH+ kann durch hohe Likelihood in der Risk-Tabelle zu CRITICAL werden –
aber nicht durch weitere automatische Propagation.
```

Diese Regel ist konsistent mit der korrigierten Safety Override Rule
(siehe taraflow-cnc-referenzfall.md, Abschnitt 4.0).

---

**Regel 4: Doppelte Propagation verhindern**

Wenn ein Asset bereits über die DFD-Ebene eine SafetyAnnotation hat,
darf die Asset-Ebene diese nicht überschreiben oder verstärken:

```
Asset X hat bereits:
  Element→Asset: relevance: 'direct', impact: 'fatality'  (aus DFD-Canvas)

Asset→Asset Core Rule auf X:
  → ignoriert für Safety-Propagation (bereits höchste Stufe)
  → bleibt dokumentarisch wirksam (STRIDE-Ableitung)

Asset→Asset Domain Extension (analytisch) auf X:
  → Validierungswarnung:
    "Asset X hat bereits direkte SafetyAnnotation aus DFD-Ebene.
     Asset→Asset Safety-Annotation ist redundant."
```

---

**Regel 5: Override-Hierarchie und MINIMUM-Prinzip**

Mehrere Override Rules können auf dasselbe Asset wirken. Die Rangfolge ist fix:

```
1. Safety Override  (fatality / irreversible_injury + relevance: 'direct') → CRITICAL
2. HVA critical                                                             → CRITICAL minimum
3. HVA high                                                                 → HIGH minimum
4. HVA medium                                                               → HIGH minimum
5. Operational critical                                                     → HIGH minimum
6. HVA low                                                                  → kein Override
```

**MINIMUM-Prinzip:** Jeder Override setzt ein Minimum-Level — er überschreibt keine
höheren Bewertungen aus anderen Quellen. Safety Override hat immer Vorrang.

```
Beispiel: Asset mit isHighValueAsset: 'high' + fatality + relevance: 'direct'
→ Safety Override greift → CRITICAL
→ HVA high (HIGH minimum) ist bereits erfüllt — kein Konflikt

Beispiel: Asset mit isHighValueAsset: 'high' + fatality + relevance: 'indirect'
→ Safety Override greift NICHT (indirect)
→ HVA high → HIGH minimum
→ fatality + indirect → HIGH+ (durch Risk-Tabelle ggf. CRITICAL)
```

---

**Zusammenfassung der Propagations-Grenzen:**

| Ebene | relevance (funktional) | `direct` möglich? | Override | Max. hazardDistance |
|---|---|---|---|---|
| Element→Asset (DFD) | Analyst-Entscheidung | ✅ am Canvas | ✅ bei direct + fatality | 0 |
| contributes_to → Hazard | Analyst (direct wenn physische Aktion gesteuert) | ✅ | ✅ via Hazard Item | 0 |
| Asset→Asset Core Rule | Analyst (Tool schlägt vor) | ✅ manual + Rationale Pflicht jenseits Distanz 0 | ✅ nur bei direct + fatality | 1 |
| Asset→Asset Domain (dokumentarisch) | – | ❌ | ❌ | – |
| Asset→Asset Domain (analytisch) | Analyst | ✅ manual + Rationale Pflicht | ✅ nur bei direct + Rationale | 0 (einmalig) |

> `relevance` wird auf keiner Ebene automatisch gesetzt — die Spalte beschreibt
> wer sie vergibt. `hazardDistance` wird automatisch aus dem Graph berechnet.

---

## 4. Stufe 2: Domain Extensions

### 4.1 Konzept

Domain Extensions sind **domänenspezifische Beziehungen** die der Analyst selbst definiert
oder aus einem vordefinierten Domain-Katalog aktiviert.

**Default-Verhalten: dokumentarisch**
```
Domain-Beziehung "administered_to":
→ erscheint in Dokumentation und Asset-Inventar
→ beeinflusst STRIDE-Analyse NICHT
→ beeinflusst Safety-Propagation NICHT
→ kein Einfluss auf Kritikalität
```

**Optional: analytisch wirksam**
```
Domain-Beziehung "administered_to" (analytisch aktiviert):
→ Analyst markiert Beziehung als "analytisch wirksam"
→ Pflicht-Rationale: z.B. "impliziert affects_safety auf Human Asset"
→ Pflicht-STRIDE-Mapping: welche Kategorien werden abgeleitet?
→ Source: "manual" → verbatim im Audit-Report dokumentiert
```

### 4.2 Vordefinierte Domain-Kataloge

> **Hinweis zur Spalte "Analytisch wirksam als":** `safety` bedeutet, dass das
> Domänen-Verb auf das Hazard-Item-Muster abgebildet wird
> (`contributes_to → Hazard → endangers`). Bei einem einzelnen Eingang kann das
> Hazard Item eingeklappt sein. `privacy` bildet auf `affects_privacy` ab.

**Medical (IEC 81001-5-1, ISO 14971):**

| Beziehung | Von → Nach | Default | Analytisch wirksam als |
|---|---|---|---|
| `administered_to` | Process → Human | dokumentarisch | safety (Hazard-Pfad) |
| `treats` | Process → Human | dokumentarisch | safety (Hazard-Pfad) |
| `diagnoses` | Data → Human | dokumentarisch | affects_privacy |
| `prescribes_for` | Data → Human | dokumentarisch | affects_privacy |
| `contraindicated_with` | Data → Data | dokumentarisch | required_by |

**Automotive (ISO 21434):**

| Beziehung | Von → Nach | Default | Analytisch wirksam als |
|---|---|---|---|
| `transports` | System → Human | dokumentarisch | safety (Hazard-Pfad) |
| `controls_vehicle` | Process → System | dokumentarisch | runs_on |

**OT / Industrial (IEC 62443):**

| Beziehung | Von → Nach | Default | Analytisch wirksam als |
|---|---|---|---|
| `operates_near` | Process → Human | dokumentarisch | safety (Hazard-Pfad) |
| `exposes_to_hazard` | Infrastructure → Human | dokumentarisch | safety (Hazard-Pfad) |
| `physically_contains` | Infrastructure → Human | dokumentarisch | – |
| `controls_actuator` | Process → System | dokumentarisch | runs_on |

**Generic IT:**

| Beziehung | Von → Nach | Default | Analytisch wirksam als |
|---|---|---|---|
| `authenticates` | System → Human | dokumentarisch | authorized_for |
| `audits` | Process → Data | dokumentarisch | responsible_for |
| `encrypts` | System → Data | dokumentarisch | – |
| `backs_up` | Process → Data | dokumentarisch | required_by |

---

### 4.3 Benutzerdefinierte Beziehungen

Der Analyst kann eigene Beziehungstypen definieren:

```
Benutzerdefinierte Beziehung:
├── name:           z.B. "calibrates"
├── von:            Asset-Kategorie (z.B. Process)
├── nach:           Asset-Kategorie (z.B. System)
├── semantik:       Freitextbeschreibung
├── analytisch:     true / false
├── wenn analytisch:
│   ├── stride_mapping:   [ "Tampering", "Repudiation" ]
│   ├── safety_relevance: "direct" | "indirect" | "none"
│   └── rationale:        Pflichtfeld (Freitext)
└── domain:         z.B. "Medical", "Custom"
```

**Validation-Regel:**
```
IF analytisch === true AND rationale === ""
THEN Validierungswarnung:
     "Rationale für analytisch wirksame Domain-Beziehung ist Pflicht
      (IEC 62443-4-1 Traceability)"
```

---

## 5. UI-Integration im DFD-Tab

Asset-zu-Asset Beziehungen werden im **Asset Description Side Panel** verwaltet –
analog zum Element Description Panel mit zwei Tabs (General / Asset Relations):

```
Side Panel (overlay, vertical split):
┌─────────────────────────────────────┐
│  Asset List                         │
│  📄 Fertigungsrezepte                │
│  ⚙️  Zerspanungsprozess              │
│  [+] Neues Asset                    │
├─────────────────────────────────────┤
│  Asset Properties                   │
│  ┌─────────────┬───────────────────┐│
│  │   General   │  Asset Relations  ││
│  └─────────────┴───────────────────┘│
│                                     │
│  Asset Relations Tab:               │
│  ┌─────────────────────────────┐    │
│  │ Element-Beziehungen         │    │
│  │ (read-only, aus Canvas)     │    │
│  │ □ CNC-Steuerung reads       │    │
│  │ 🗄 NC-Filesystem stores      │    │
│  ├─────────────────────────────┤    │
│  │ Asset-Beziehungen           │    │
│  │ Core Rules + Domain Ext.    │    │
│  │ [+] Beziehung hinzufügen    │    │
│  │                             │    │
│  │ derives_from →              │    │
│  │   📄 Rohdaten                │    │
│  │   [SafetyAnnotation]        │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Beziehung hinzufügen – Workflow:**
```
1. [+] Beziehung hinzufügen
2. Beziehungstyp wählen
   → Core Rules (immer verfügbar)
   → Domain Extensions (falls in Phase 0 aktiviert)
   → Benutzerdefiniert
3. Ziel-Asset auswählen (aus Asset-Liste)
4. Optional: SafetyAnnotation setzen
5. Wenn Domain-Extension analytisch:
   → Rationale eingeben (Pflicht)
```

---

## 6. Auswirkung auf die Gesamtanalyse

### 6.1 Übersicht

| | Core Rules | Domain (dokumentarisch) | Domain (analytisch) |
|---|---|---|---|
| STRIDE-Ableitung | ✅ automatisch | ❌ | ✅ manuell definiert |
| Safety-Propagation | ✅ hazardDistance-Berechnung | ❌ | ✅ gemäss safety_relevance |
| Kritikalität | ✅ derived | ❌ | ✅ manual + Rationale |
| Dokumentation | ✅ automatisch | ✅ Asset-Inventar | ✅ Rationale verbatim |

### 6.2 Traceability-Kette

```
Massnahme
  → Risk
  → Threat (STRIDE-Kategorie)
  → Asset-zu-Asset Beziehung (Core Rule oder Domain Extension)
  → Asset
  → DFD-Element
```

Vollständig rückverfolgbar – auch wenn die Threat-Ableitung über eine
Asset-zu-Asset Beziehung erfolgte.

---

## 7. Abgrenzung zu Element-zu-Asset Beziehungen

| Merkmal | Element-zu-Asset | Asset-zu-Asset |
|---|---|---|
| Modellierungsort | DFD-Canvas | Asset Properties Side Panel |
| Richtung | DFD-Element → Asset | Asset → Asset |
| Visualisierung | Canvas-Kante | Side Panel Liste |
| Analytisch wirksam | immer | Core: immer / Domain: optional |
| SafetyAnnotation | ✅ | ✅ |
| Derived/Manual Pattern | ✅ | ✅ |

---

## 8. Beispiele

### 8.1 CNC-System (OT-Domain)

```
Process Asset "Zerspanungsprozess"
└─ depends_on (Core) → Process Asset "Not-Halt-Prozess"
   → Pflicht-Threat: DoS auf Not-Halt = DoS auf Zerspanungsprozess
   → hazardDistance 1; relevance: indirect (Zerspanungsprozess steuert die
     Sicherheitsabschaltung nicht selbst)

Data Asset "Fertigungsrezepte"
└─ required_by (Core) → Process Asset "Zerspanungsprozess"
   → Pflicht-Threat: Tampering auf Rezepte = Tampering auf Zerspanungsprozess
   → hazardDistance 1; relevance: indirect (Daten steuern keine physische Aktion)
```

### 8.2 Medical Device (Medical-Domain)

```
Process Asset "Bolus-Abgabe-Sequenz"
└─ administered_to (Domain, analytisch) → Human Asset "Patient"
   Rationale: "Direkte Verabreichung — Hazard-Pfad: contributes_to → Hazard → endangers Patient"
   stride_mapping: [ "Tampering", "DoS" ]
   safety_relevance: "direct"
   → Pflicht-Threat: Tampering auf Bolus-Sequenz = CRITICAL (Safety Override)

Data Asset "Medikamenten-Grenzwerte"
└─ required_by (Core) → Process Asset "Medikamenten-Validierungsablauf"
   → Tampering auf Grenzwerte = Tampering auf Validierungsablauf
   → hazardDistance 1; relevance: indirect (Grenzwert-Daten steuern die Abgabe nicht selbst)
```

### 8.3 OT-Anlage mit Function Assets (Integrator-Perspektive)
```
Function Asset "Brake Control Function"  [FU-001]
└─ implemented_by (Core) → System Asset "Safety Controller"
   → Tampering auf Safety Controller = Tampering auf Brake Control Function
   → Safety Override Rule greift: fatality → CRITICAL

Data Asset "Safety Parameters"
└─ configures (Core) → Function Asset "Brake Control Function"  [FU-001]
   → Tampering auf Safety Parameters = Pflicht-Threat
   → hazardDistance 1; relevance: indirect (Parameter konfigurieren nur)

Physical Asset "Hydraulic Brake Actuator"
└─ contributes_to (Core) → Hazard Item "unkontrollierte Bremsung"
   → Tampering auf Actuator = direkter Beitrag zur Gefährdung
   → hazardDistance 0; relevance: direct → Safety Override Rule greift: fatality → CRITICAL

Service Asset "Remote Monitoring Service"
└─ monitors (Core) → System Asset "Safety Controller"
   → Compromise des Remote Service = indirekter Pfad zur Safety-Funktion
   → hazardDistance 1; relevance: indirect (Monitoring steuert nichts)
```

---

### 8.4 Abgeleiteter Angriffspfad über Asset-Beziehungen

Dieses Beispiel zeigt wie der Angriffspfad implizit aus den Asset-zu-Asset Beziehungen
entsteht — ohne dass ein expliziter "Angriffspfad" modelliert werden muss.

```
Data Asset "Safety Parameters"
└─ configures → Function Asset "Brake Control Function"
   └─ implemented_by → System Asset "Safety Controller"
      └─ contributes_to → Hazard Item "unkontrollierte Bremsung"
         └─ endangers → Human Asset "Operator"
```

**Abgeleitete Threat-Kette:**

```
1. Einstiegspunkt: Tampering auf Data Asset "Safety Parameters"
   (z.B. via DFD-Element das modifies → Safety Parameters hat)

2. configures → Function "Brake Control Function"
   → Tampering auf Parameter = Tampering auf Funktion
   → hazardDistance 1; relevance: indirect (Parameter konfigurieren nur)

3. implemented_by → System "Safety Controller"
   → System ist Träger der kompromittierten Function
   → hazardDistance 1; relevance: indirect

4. contributes_to → Hazard Item "unkontrollierte Bremsung"
   → Safety Controller steuert die physische Aktion → hazardDistance 0, relevance: direct

5. endangers → Human "Operator"
   → Endpunkt: Safety-Impact auf Schutzsubjekt, impact: fatality

Ergebnis:
→ Tampering auf "Safety Parameters" wird zu CRITICAL
   (Safety Override Rule greift: fatality am Hazard Item)
→ Pflicht-Threats: Tampering, DoS auf Safety Parameters
```

> Dieser Pfad entsteht ohne explizite Modellierung eines "Angriffspfads" —
> er ergibt sich automatisch aus der Kombination von Asset-Beziehungen,
> STRIDE-Ableitung und Safety-Propagation.

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>
