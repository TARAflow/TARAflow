# TARAflow: Asset-zu-Asset Beziehungen

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>

> **Zweck dieses Dokuments:** Formale Definition der Asset-zu-Asset Beziehungen in TARAflow.
> Diese Beziehungen ergänzen die Element-zu-Asset Beziehungen und ermöglichen die Modellierung
> direkter semantischer Verbindungen zwischen Assets – ohne Umweg über DFD-Elemente.

---

## 1. Konzept und Einordnung im Graph

Der TARAflow-Graph hat zwei Hauptebenen – wobei Ebene 2 aus acht Knotentypen besteht,
aufgeteilt in eine vertikale Hierarchie und orthogonale Kategorien:

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
              Human Assets          ──┘
```

Ebene 2 ist ein **heterogener Graph** mit fünf Knotentypen. Die erlaubten
Beziehungstypen sind abhängig von der Kombination **Quell-Kategorie × Ziel-Kategorie**:

```
Innerhalb einer Kategorie:   Data→Data, Process→Process, ...
Zwischen Kategorien:         Data→Process, Process→Human, System→Infrastructure, ...
```

Das entspricht dem gleichen Prinzip wie Ebene 1: auch DFD-Elemente haben verschiedene
Typen (Process, DataStore, ExternalEntity, ...) mit typenabhängigen Verbindungsregeln.

Asset-zu-Asset Beziehungen beschreiben direkte semantische Verbindungen zwischen Assets
die sich nicht natürlich über ein DFD-Element ausdrücken lassen.

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
| `aggregates` | Asset B aggregiert mehrere A-Instanzen | Tampering, Information Disclosure | transitiv |
| `supersedes` | Asset B ersetzt Asset A (z.B. neue Firmware) | Tampering, Repudiation | transitiv |

**Function → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `depends_on` | Function A benötigt Function B zur Ausführung | Denial of Service | direct wenn B safety-kritisch |
| `supersedes` | Function A ersetzt Function B (neue Version) | Tampering, Repudiation | transitiv |
| `calls` | Function A ruft Function B auf (funktionale Abhängigkeit zur Designzeit) | Tampering, Spoofing | direct wenn B safety-kritisch |

> **`calls` vs. `invokes`:** `calls` beschreibt eine **statische funktionale Abhängigkeit** zwischen zwei Capabilities (Designzeit). `invokes` ist reserviert für **Process→Function** und beschreibt den dynamischen Aufruf eines Werkzeugs zur Laufzeit.

**Process → Process:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `triggers` | Prozess A löst Prozess B aus | Tampering, Spoofing | direct wenn B safety-kritisch |
| `depends_on` | Prozess A benötigt Prozess B | Denial of Service | transitiv |
| `suspends` | Prozess A unterbricht Prozess B | Denial of Service | direct wenn B safety-kritisch |

**System → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `depends_on` | System A benötigt System B | Denial of Service | transitiv |
| `integrates` | System A integriert System B | Tampering, Spoofing | transitiv |

**Infrastructure → Infrastructure:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `powers` | Infra A versorgt Infra B mit Strom | Denial of Service | indirect |
| `houses` | Infra A beherbergt Infra B physisch | Tampering | indirect |

**Human → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `manages` | Person A verwaltet Person B | Elevation of Privilege | – |
| `reports_to` | Person A rapportiert an Person B | – | – |

---

**Physical → Physical:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `mechanically_linked` | Physische Komponente A wirkt auf B | Tampering | direct wenn B safety-kritisch |
| `powered_by` | Komponente A wird von B versorgt | Denial of Service | indirect |

**Service → Service:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `depends_on` | Service A benötigt Service B | Denial of Service | transitiv |
| `delegates_to` | Service A übergibt Anfragen an Service B | Spoofing, Tampering | transitiv |

---

### 3.2 Zwischen verschiedenen Asset-Kategorien

**Data → Process:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `required_by` | Daten werden für Prozessausführung benötigt | Tampering, DoS | transitiv via Prozess |
| `consumed_by` | Daten werden durch Prozess transformiert | Tampering | transitiv |
| `configures [step?]` | Daten konfigurieren einen bestimmten Prozessschritt — optionaler `stepOrder`-Qualifier | Tampering | direct wenn Prozessschritt safety-kritisch |

**Data → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `required_by` | Daten werden für Funktionsausführung benötigt | Tampering, DoS | transitiv via Function |
| `configures` | Daten konfigurieren das Verhalten einer Function | Tampering | direct wenn Function safety-kritisch |

**Data → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `affects_privacy` | Daten enthalten personenbezogene Informationen | Information Disclosure | – |
| `exposes` | Daten exponieren Person gegenüber Risiken | Information Disclosure | indirect |

**Function → Data:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `creates` | Function erzeugt Data Asset | Tampering, Repudiation | transitiv |
| `reads` | Function liest Data Asset | Information Disclosure | transitiv |
| `modifies` | Function verändert Data Asset | Tampering | direct wenn Data safety-kritisch |
| `deletes` | Function löscht Data Asset | Denial of Service | transitiv |

**Function → Process:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `implemented_by` | Function wird durch Prozess implementiert | Tampering | direct wenn Function safety-kritisch |
| `triggers` | Function löst Prozess aus | Tampering, Spoofing | transitiv |

**Function → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `implemented_by` | Function wird durch System bereitgestellt | Tampering | direct wenn Function safety-kritisch |
| `depends_on` | Function benötigt System zur Ausführung | Denial of Service | transitiv |

**Function → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `affects_safety` | Function kann Menschen physisch gefährden | Tampering, DoS | **direct** |
| `operated_by` | Function wird von Mensch ausgelöst oder überwacht | Spoofing, Repudiation | indirect |

**Process → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `implements` | Prozess implementiert diese Function | Tampering | direct wenn Function safety-kritisch |
| `invokes [step?]` | Prozess ruft Function auf — optionaler `stepOrder`-Qualifier | Tampering, Spoofing | transitiv |

> **`stepOrder`-Qualifier:** Trägt ein `invokes` einen Schritt-Index (`step: 1`, `step: 2`, ...),
> entsteht eine geordnete Sequenz. Manipulation der Reihenfolge = **Sequencing Attack** —
> ein Threat-Typ der nur über Process Assets modellierbar ist.

**Process → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `runs_on` | Prozess läuft auf System | Tampering, Elevation of Privilege | transitiv |
| `requires` | Prozess benötigt System | Denial of Service | transitiv |

**Process → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `affects_safety` | Prozess kann Menschen physisch gefährden | Tampering, DoS | **direct** |
| `affects_privacy` | Prozess verarbeitet personenbezogene Daten | Information Disclosure | – |
| `operated_by` | Prozess wird von Mensch bedient | Spoofing, Repudiation | indirect |

**System → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `implements` | System stellt diese Function bereit | Tampering | direct wenn Function safety-kritisch |
| `depends_on` | System benötigt Function | Denial of Service | transitiv |

**System → Infrastructure:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `hosted_on` | System läuft auf Infrastruktur | Tampering | indirect |
| `powered_by` | System wird von Infrastruktur versorgt | Denial of Service | indirect |

**Human → Process:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `responsible_for` | Person ist verantwortlich für Prozess | Repudiation, Accountability | – |
| `authorized_for` | Person ist autorisiert Prozess auszuführen | Spoofing, Elevation of Privilege | – |

---

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
| `powered_by` | Physische Komponente wird von Infrastruktur versorgt | Denial of Service | indirect |
| `located_in` | Physical Asset befindet sich physisch in Infrastruktur | Tampering | indirect |

> **`located_in` vs. `connected_to`:** `located_in` beschreibt reine Ortsbeziehung (Gemälde hängt im Museumsraum); `connected_to` beschreibt eine technische Verbindung (Sensor verbunden mit OT-Netzwerk).

**Service → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `provides` | Externer Service stellt Function bereit | Tampering, Spoofing | direct wenn Function safety-kritisch |
| `depends_on` | Service benötigt Function | Denial of Service | transitiv |

**Service → Data:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `exposes` | Service exponiert Daten nach aussen | Information Disclosure | – |
| `consumes` | Service verarbeitet/speichert Daten | Tampering | transitiv |

**Service → System:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `integrates_with` | Service kommuniziert mit internem System | Spoofing, Tampering | transitiv |
| `monitors` | Service überwacht System | Information Disclosure | indirect |

**Human → Function:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `authorized_for` | Person ist autorisiert Function auszulösen | Spoofing, Elevation of Privilege | – |
| `responsible_for` | Person ist verantwortlich für Function | Repudiation, Accountability | – |

---

**Physical → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `endangers` | Physical Asset kann Person physisch gefährden | Tampering, DoS | **direct** |
| `exposes` | Physical Asset exponiert Person gegenüber Risiken (z.B. Strahlung, Substanz) | Information Disclosure | indirect |

> Typischer Anwendungsfall: Eine Maschinen-Komponente (`Physical Asset`) kann bei physischer Manipulation Person (`Human Asset`) gefährden. Abgrenzung: `endangers` beschreibt das Gefährdungspotenzial des Assets selbst; `affects_safety` (Process/Function→Human) beschreibt den Software-Pfad zum Schaden.

**Service → Human:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `affects_privacy` | Service verarbeitet oder exponiert personenbezogene Daten | Information Disclosure | – |
| `endangers` | Ausfall des safety-kritischen Service gefährdet Person | Denial of Service | direct wenn `isSafetyCritical: true` |

> `endangers` bei Service→Human ist nur relevant wenn der Service eine Safety-kritische Funktion trägt (z.B. Remote-Monitoring-Service für Patientenüberwachung). Ohne `isSafetyCritical: true` am Service Asset keine automatische Safety-Propagation.

**Service → Infrastructure:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `hosted_on` | Service läuft auf interner Infrastruktur | Tampering | indirect |
| `depends_on` | Service ist abhängig von Infrastruktur-Verfügbarkeit | Denial of Service | transitiv |

**Infrastructure → Physical:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `houses` | Infrastruktur beherbergt das Physical Asset | Tampering | indirect |

> Umgekehrte Sichtweise zu `Physical → Infrastructure: located_in`. Beide Beziehungen können modelliert werden; `located_in` (Physical→Infra) ist die bevorzugte Richtung da das Physical Asset der primäre Analysegegenstand ist.

**Human → Physical:**

| Beziehung | Semantik | STRIDE-Relevanz | Safety-Relevanz |
|---|---|---|---|
| `owns` | Person besitzt das Physical Asset | Repudiation | – |
| `responsible_for` | Person ist verantwortlich für Zustand und Verbleib des Assets | Repudiation, Accountability | – |
| `accesses` | Person greift auf das Physical Asset zu | Spoofing (bei unberechtigtem Zugriff) | – |

---

### 3.3 Analytische Wirkung der Core Rules

Core Rules sind **analytisch wirksam** – sie beeinflussen:

**STRIDE-Ableitung:**
```
Auslöser                                    → Pflicht-Threat
─────────────────────────────────────────────────────────────
Data A derives_from Data B                        → Tampering auf B impliziert Tampering auf A
Process A triggers Process B[safety]              → DoS auf A = Safety-relevanter Threat
Process A affects_safety Human                    → Tampering + DoS als Pflicht-Threats
Data affects_privacy Human                        → Information Disclosure als Pflicht-Threat
Function A depends_on Function B[safety]          → DoS auf A = Safety-relevanter Threat
Function A affects_safety Human                   → Tampering + DoS als Pflicht-Threats
Data configures Function[safety]                  → Tampering auf Data = Safety-relevanter Threat
Physical enables Function[safety]                 → Tampering auf Physical = CRITICAL
Physical endangers Human                          → Tampering + DoS auf Physical = Safety-relevanter Threat
Service provides Function[safety]                 → Spoofing auf Service = Safety-relevanter Threat
Service endangers Human[isSafetyCritical]         → DoS auf Service = Safety-relevanter Threat
Physical located_in Infrastructure                → Tampering auf Infra = indirekter Threat auf Physical
```

**Safety-Propagation:**
```
Process A triggers Process B[direct, fatality]
→ Process A erhält relevance: 'indirect' automatisch (Hop 1)

Data required_by Process[direct, fatality]
→ Data erhält relevance: 'indirect' automatisch (Hop 1)

Function A depends_on Function B[direct, fatality]
→ Function A erhält relevance: 'indirect' automatisch (Hop 1)

Data configures Function[direct, fatality]
→ Data erhält relevance: 'indirect' automatisch (Hop 1)

Physical enables Function[direct, fatality]
→ Physical erhält relevance: 'direct' automatisch
  (Physical ist direkter Ermöglicher, kein indirekter Hop)
```

**Kritikalitäts-Ableitung:**
```
Folgt dem bestehenden Derived/Manual Pattern:
→ Core-Rule-Ableitungen = source: "derived"
→ keine zusätzliche Dokumentationspflicht
→ im Audit-Report automatisch als "systemisch abgeleitet" markiert
```

---

### 3.4 Propagations-Grenzen (formale Regeln)

Asset-zu-Asset Beziehungen erweitern die Safety-Propagation auf eine zweite semantische
Ebene. Ohne formale Begrenzung entsteht das Risiko einer **Transitive Closure Explosion**:
dichte Abhängigkeitsgraphen in sicherheitskritischen Systemen führen dazu dass fast alle
Assets indirekt safety-relevant werden – das CRITICAL-Inflationsproblem auf neuer Ebene.

Die folgenden Regeln begrenzen die Propagation formal:

---

**Regel 1: Primary Causality Carrier**

Die DFD-Ebene (Element→Asset) hat Vorrang gegenüber der Asset-Ebene (Asset→Asset).
Automatische Safety-Propagation ist standardmässig `indirect` — `direct` ist auf
Asset→Asset Ebene immer eine explizite Analyst-Entscheidung:

```
Element→Asset Beziehung mit SafetyAnnotation:
  → darf relevance: 'direct' auslösen (automatisch)
  → Safety Override Rule greift
  → ist primäre Quelle für Safety-Kritikalität

Asset→Asset Core Rule (triggers, depends_on, required_by, ...):
  → default: relevance: 'indirect', source: "derived" (automatisch)
  → relevance: 'direct' erlaubt, aber:
      • source: "manual" Pflicht
      • Rationale Pflicht ("Warum ist dies ein direkter Kausalitätsträger?")
      • Safety Override Rule greift nur bei manual + direct + Rationale
  → Symmetrie zu Domain Extensions: gleiche Regeln, gleiche Pflichten

Asset→Asset Domain Extension (analytisch wirksam):
  → darf relevance: 'direct' nur wenn safety_relevance: 'direct'
    explizit gesetzt + Rationale vorhanden
  → einmalig – keine weitere Propagation von diesem Punkt
```

> **Warum symmetrisch?** Wenn ein Analyst gezwungen ist, eine Core Rule in eine
> Domain Extension umzuwandeln, nur um `direct` vergeben zu können, entsteht
> methodischer Druck der die Modellqualität senkt. Beide Stufen erlauben `direct` —
> beide verlangen Rationale. Die Pflicht schützt vor Inflation.

---

**Regel 2: Hop-Limit auf Asset→Asset Ebene**

Safety-Propagation über Asset→Asset Beziehungen stoppt nach **Hop 1** (default):

```
C  affects_safety  Human     → C: direct  (Element→Asset)
B  depends_on      C         → B: indirect, Hop 1  (Asset→Asset, derived)
A  depends_on      B         → A: NICHT automatisch propagiert (Hop 2)
                               → erfordert explizite Analyst-Entscheidung
                               → source: "manual" + Rationale Pflicht
```

Kombinierte Transitivität über beide Ebenen:

```
DFD-Element → Asset (Element→Asset, Hop 0) → direct
Asset → Asset (Asset→Asset, Hop 1)          → indirect (derived)
Asset → Asset (Asset→Asset, Hop 2+)         → nicht automatisch
```

**Konfiguration in Phase 0 (Projektprofil):**

Das Hop-Limit ist pro Projekt konfigurierbar:

```
maxHops: 1  (default — empfohlen für die meisten Projekte)
maxHops: 2  (optional — für OT-Anlagen mit bekannt langen Kaskaden)
```

Bei `maxHops: 2` gilt zusätzliche Schutzmassnahme gegen `direct`-Inflation:

```
IF Hop === 2 AND relevance === 'direct'
THEN Validierungsfehler (blockierend):
     "direct Safety-Annotation auf Hop 2 erfordert zwingend Rationale.
      Begründung warum dieser Asset ein direkter Kausalitätsträger ist,
      obwohl er zwei Hops vom primären Safety-Asset entfernt ist."
```

> **Warum diese Bremse?** Ohne sie würde `maxHops: 2` die `direct`-Inflation
> ermöglichen die das Hop-Limit ursprünglich verhindern soll.
> Die Rationale-Pflicht stellt sicher dass jede Hop-2-`direct`-Annotation
> eine bewusste, dokumentierte Analyst-Entscheidung ist.

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

**Zusammenfassung der Propagations-Grenzen:**

| Ebene | Default Relevance | `direct` möglich? | Override | Max. Hops |
|---|---|---|---|---|
| Element→Asset (DFD) | direct / indirect | ✅ automatisch | ✅ bei direct | – (manuell gesetzt) |
| Asset→Asset Core Rule | `indirect` (derived) | ✅ manual + Rationale Pflicht | ✅ nur bei manual + Rationale | 1 |
| Asset→Asset Domain (dokumentarisch) | – | ❌ | ❌ | – |
| Asset→Asset Domain (analytisch) | direct / indirect | ✅ manual + Rationale Pflicht | ✅ nur bei direct + Rationale | 0 (einmalig) |

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

**Medical (IEC 81001-5-1, ISO 14971):**

| Beziehung | Von → Nach | Default | Analytisch wirksam als |
|---|---|---|---|
| `administered_to` | Process → Human | dokumentarisch | affects_safety |
| `treats` | Process → Human | dokumentarisch | affects_safety |
| `diagnoses` | Data → Human | dokumentarisch | affects_privacy |
| `prescribes_for` | Data → Human | dokumentarisch | affects_privacy |
| `contraindicated_with` | Data → Data | dokumentarisch | required_by |

**Automotive (ISO 21434):**

| Beziehung | Von → Nach | Default | Analytisch wirksam als |
|---|---|---|---|
| `transports` | System → Human | dokumentarisch | affects_safety |
| `endangers` | System → Human | dokumentarisch | affects_safety |
| `controls_vehicle` | Process → System | dokumentarisch | runs_on |

**OT / Industrial (IEC 62443):**

| Beziehung | Von → Nach | Default | Analytisch wirksam als |
|---|---|---|---|
| `operates_near` | Process → Human | dokumentarisch | affects_safety |
| `exposes_to_hazard` | Infrastructure → Human | dokumentarisch | affects_safety |
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
│  📄 Fertigungsrezepte               │
│  ⚙️  Zerspanungsprozess             │
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
│  │   📄 Rohdaten               │    │
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
| Safety-Propagation | ✅ Hop-Logik | ❌ | ✅ gemäss safety_relevance |
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
   → Safety: indirect (Not-Halt ist direct, Zerspanungsprozess erbt indirect)

Data Asset "Fertigungsrezepte"
└─ required_by (Core) → Process Asset "Zerspanungsprozess"
   → Pflicht-Threat: Tampering auf Rezepte = Tampering auf Zerspanungsprozess
   → Safety: indirect (Hop 1 via Zerspanungsprozess)
```

### 8.2 Medical Device (Medical-Domain)

```
Process Asset "Bolus-Abgabe-Sequenz"
└─ administered_to (Domain, analytisch) → Human Asset "Patient"
   Rationale: "Direkte Verabreichung impliziert affects_safety"
   stride_mapping: [ "Tampering", "Denial of Service" ]
   safety_relevance: "direct"
   → Pflicht-Threat: Tampering auf Bolus-Sequenz = CRITICAL (Safety Override)

Data Asset "Medikamenten-Grenzwerte"
└─ required_by (Core) → Process Asset "Medikamenten-Validierungsablauf"
   → Tampering auf Grenzwerte = Tampering auf Validierungsablauf
   → Safety: indirect (Validierungsablauf ist direct)
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
   → Safety: indirect (Hop 1 via Brake Control Function)

Physical Asset "Hydraulic Brake Actuator"
└─ enables (Core) → Function Asset "Brake Control Function"  [FU-001]
   → Tampering auf Actuator = direct Safety-relevanter Threat
   → Safety Override Rule greift: fatality → CRITICAL

Service Asset "Remote Monitoring Service"
└─ monitors (Core) → System Asset "Safety Controller"
   → Compromise des Remote Service = indirekter Pfad zur Safety-Funktion
   → Safety: indirect (Hop 1 via Safety Controller)
```

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>
