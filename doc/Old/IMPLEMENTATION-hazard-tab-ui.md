# Implementation: Hazard Tab UI & Asset-Modell-Umzug

**Status:** Draft
**Autor:** Jürgen Messerer
**Datum:** 2026-06-05
**Bereich:** Hazard Feature-Slice · Asset-Modell · Shared Layer

> **Code-Kommentare immer in Englisch** — auch wenn dieses Dokument deutsch ist.

---

## Zweck dieses Dokuments

Dieses Dokument hält die **Design-Entscheidungen aus der UI-Session** fest, die in den
bestehenden Dokumenten noch nicht enthalten sind. Es ist ein **Ergänzungs- und
Entscheidungsdokument**, kein Ersatz — es verweist auf die anderen Dokumente, statt sie
zu wiederholen.

**Verhältnis zu den anderen Dokumenten:**

- `IMPLEMENTATION-hazard-item.md` — der Phasen-Umsetzungsplan (Phase 0–7). Die hier
  getroffenen Entscheidungen konkretisieren vor allem **Phase 0** (Hazard Tab),
  **Phase 1** (Datenmodell) und **Phase 5** (UI).
- `taraflow-feature-spec-safety-hazard-import.md` — fachliche Spec für den **Importer**
  (Regulatory Profile, Safety Analysis Mode, Adapter). Hier wird nur die **Import-Brücke**
  `SafetyHazard → HazardItem` entschieden.
- `taraflow-asset-beziehungen.md` / `taraflow-asset-zu-asset-beziehungen.md` — das
  Beziehungs- und Hazard-Item-Datenmodell (`contributes_to` / `endangers`,
  `relevance` / `hazardDistance`, `combinationType`).

---

## 1. UI-Architektur des Hazard Tab

### 1.1 Grundprinzip — zwei Views auf einen Store

Der Hazard Tab besteht aus **zwei Views auf denselben `HazardStore`** (Single Source of
Truth). Beide Views sind reine Darstellungen — kein Kopieren von Hazard-Daten:

| View | Zweck | Stärke |
|---|---|---|
| **Bowtie** (Detail) | Editieren *eines* Hazards | Zeigt N:1:M-Struktur + Gate (`combinationType`) |
| **Tripartite Flow** (Übersicht) | Globaler Blick über *alle* Hazards | Macht geteilte Knoten sichtbar (m:n:m) |

Die Master-Liste (alle Hazard Items) sitzt über beiden und selektiert das aktive Hazard.

### 1.2 Bowtie — die Editier-Sicht

Ein Hazard Item ist semantisch ein **Bowtie**: links die beitragenden Assets
(`contributes_to`), in der Mitte die Gefährdung mit ihrem **Gate**, rechts die
gefährdeten Schutzziele (`endangers`).

```
  CONTRIBUTES_TO            HAZARD ITEM              ENDANGERS
  (auslösend)                                        (verletzt)

  [Asset A] ─direct──┐                          ┌─► [Human]          katastrophal
  [Asset B] ─indir.──┤──►  ⚠ Hazard  ───────────┤
  [+ Asset]          │     [Gate: ANY ▾]        └─► [Environment]    schwer
                  (AND/OR)                          [+ Schutzziel]
```

- Das **Gate in der Mitte ist `combinationType`**: `ANY` (OR — jede Ursache allein),
  `ALL` (AND — alle Beiträge zusammen, Kombinatorik). Nur ab zwei Beiträgen relevant.
- Beitrags-Chip: `relevance` (direct/indirect) + `hazardDistance` + Rationale, inline.
- Schutzziel-Chip: `impact` mit **ziel-typ-abhängiger Severity-Skala**.

### 1.3 Tripartite Flow — die Übersichts-Sicht

Drei Spalten: **Auslösendes Asset → Hazard Item → Verletztes Schutzziel**. Sie macht
sichtbar, was der Bowtie verbirgt: dass ein Schutzziel von mehreren Hazards getroffen
wird und dass ein Asset mehrere Hazards speist.

**Interaktion (trägt die Übersicht):**

- **Pivot von jedem Knoten:** Hazard anklicken → sein Pfad leuchtet (= Bowtie, ausgerollt
  in die globalen Spalten). Asset anklicken → alle Hazards, die es speist. Schutzziel
  anklicken → alle Hazards, die es bedrohen.
- Klick auf einen Hazard-Knoten öffnet den Bowtie zum Editieren.
- **Gruppierungs-Toggle (benutzerwählbar):** `groupBy: 'category' | 'hazard'` für die
  linke Spalte (Assets nach Asset-Kategorie *oder* nach zugehörigem Hazard gruppiert).
  Später auf die rechte Spalte erweiterbar (Schutzziele nach Typ vs. nach Hazard).

### 1.4 Schnell-Erfassungs-Workflow

Ziel: Hazard + Verknüpfungen ohne Dialog-Springerei.

1. `+ Neues Hazard Item` / Quick-Add-Zeile → `label` + `hazardType`, Enter. Item existiert.
2. Bowtie öffnet leer. Beiträge per Autocomplete-Chip aus bestehenden Assets
   (gefiltert auf erlaubte Quell-Kategorien). Pro Chip inline `relevance` + `hazardDistance`.
3. Schutzziele per Autocomplete aus Human/Environment/Infrastructure-Assets.
   Pro Ziel `impact` setzen.
4. Gate erscheint ab zwei Beiträgen.

---

## 2. Datenmodell-Konsequenzen aus der UI

### 2.1 Severity gehört an die `endangers`-Kante — nicht ans Hazard Item

Ein Hazard kann gleichzeitig einen Menschen (Safety-Skala) **und** die Umwelt
(Umwelt-Skala) gefährden — mit unterschiedlicher Dimension und Magnitude. Severity ist
daher **pro Schutzziel** (`HazardImpact` discriminated union: `human` | `environment` |
`infrastructure`), nicht ein einzelnes Feld am Hazard Item.

Die **„Max. Severity"-Spalte** in der Master-Liste ist ein **abgeleitetes Aggregat** über
alle `endangers`-Kanten des Hazards — kein gespeichertes Feld.

### 2.2 Kardinalität

- **Pro Hazard: N : 1 : M** — N Auslöser konvergieren in *eine* Gefährdung, die auf
  M Schutzziele divergiert.
- **Global: m : n : m** — Assets und Schutzziele werden über Hazards hinweg geteilt
  (ein Asset speist mehrere Hazards; ein Schutzziel wird von mehreren bedroht).
- Das Hazard Item ist der **Pivot, der N×M auf N+M kollabiert**. Ohne ihn entstünden bei
  3 Ursachen × 2 Zielen 6 Einzelkanten — und `combinationType`, `hazardCategory`,
  `physicalHazardPotential` hätten keinen Ort. Das „1" in der Mitte ist der Sinn des
  Konstrukts.

### 2.3 Links/rechts = TARA-Achse

Die Asymmetrie ist nicht nur visuell:

- **Links (`contributes_to`)** = Likelihood-/Pfad-Seite — `relevance` + `hazardDistance`
  (*wie* und *wie nah* die Ursache an die physische Aktion kommt).
- **Rechts (`endangers`)** = Impact-Seite — `impact` / Severity (das **I in `R = I × L`**).
- Das Hazard Item ist der Punkt, an dem Likelihood und Impact zusammentreffen.

### 2.4 `endangers`-Ziele bleiben Schutzziele

`endangers`-Ziele sind auf **`{Human, Environment, Infrastructure}`** begrenzt —
Knoten mit *intrinsischem* Schutzwert. Daraus folgt für Grenzfälle:

- **Kritisches System, dessen Versagen indirekt zu gröberem Versagen führt** → der Knoten
  steht **links** (Contributor, `relevance: indirect`, `hazardDistance > 0`); das tatsächlich
  Verletzte ist das nachgelagerte Schutzziel.
- **Die Anlage selbst ist das zerstörte Wertobjekt** → als **Infrastructure**-Ziel auf der
  Destruction-Skala modellieren (+ High-Value-Override-Rule). Nicht als System-Ziel.

> Invariante: rechts stehen nur Schutzziele, nie Zwischenkomponenten. (Offene Entscheidung
> 4.3 — System als Ziel zuzulassen würde die Cause/Target-Grenze verwischen.)

---

## 3. Import-Brücke: `SafetyHazard → HazardItem`

Das Import-Format `SafetyHazard` (Feature-Spec) ist flach: *eine* `severity`,
`affectedAssets[]`. Das native `HazardItem` verteilt Severity auf `endangers`-Kanten.
Der Adapter überbrückt das beim Import:

**Entschieden:** Ein importiertes Hazard ohne Ziel-Information wird als `HazardItem` mit
**einem impliziten Human-Schutzziel** angelegt, dessen `impact` aus dem flachen
`severity`-Feld stammt. Der Analyst verfeinert danach im Bowtie (weitere Ziele, korrekte
Skalen). `affectedAssets[]` werden zu `contributes_to`-Kanten.

---

## 4. Asset-Modell-Umzug nach `src/shared/models`

### 4.1 Begründung

Sowohl der **Hazard-Tab** als auch der **DFD-Tab** legen Assets an. Damit ist das Asset
keine Feature-lokale Struktur mehr, sondern eine **shared Domain-Entität** — analog zum
Hazard Item. Die Architektur-Konvention (keine `feature ↔ feature` Imports; gemeinsame
Typen in `src/shared`) verlangt den Umzug ohnehin, sobald ein zweiter Slice Assets erzeugt.

### 4.2 Neue Rollenverteilung

| Slice | Rolle bzgl. Asset |
|---|---|
| **DFD-Tab** | legt Assets an (aus dem Graphen) |
| **Hazard-Tab** | legt Assets an (Schnell-Erfassung im Bowtie) |
| **Asset-Tab** | **legt keine Assets mehr an** — bestimmt nur noch Impact-Bewertung und Schutzziele des Assets (CIANAAA-Sicherheitsziele bzw. Protection-Target-Eigenschaft) |

### 4.3 Konsequenz: zentraler Asset-Store (SSOT)

Wenn mehrere Slices Assets erzeugen, gilt dasselbe Single-Source-of-Truth-Muster wie bei
Hazards: ein **zentraler Asset-Store**, auf den alle Tabs Views sind. Der Asset-Tab wird
View, nicht Eigentümer.

> **Offene Entscheidung:** Wandert nur der **Typ** (`asset-types.ts`) nach
> `src/shared/models`, oder der **ganze Asset-Store** (SSOT) nach `shared`? Empfehlung:
> Typen sicher nach `shared/models`; Store nach `shared`, sobald die DFD-/Hazard-seitige
> Asset-Erzeugung scharf geschaltet wird (spätestens Phase 4 des Hazard-Plans).

### 4.4 Move-Hinweise

- `asset-types.ts` → `src/shared/models/asset-types.ts`.
- Asset-Anteile aus `element-properties.ts` (z.B. `AssetProperties`, `securityGoals[]`,
  `physicalImpact*`) auf shared-Verträglichkeit prüfen — was von mehreren Slices gelesen
  wird, gehört nach `shared`.
- `HazardItem` lebt parallel in `src/shared/models/hazard-types.ts` (Phase 1).
- Re-Exports/Barrel an alter Stelle übergangsweise behalten, um Import-Pfade nicht in
  einem Schritt zu brechen (minimal-invasiv, dann nachziehen).

---

## 5. Tech-Stack-Zuordnung

Mit dem bestehenden `package.json` ist der Hazard Tab vollständig abgedeckt.

| Baustein | Lib | Notiz |
|---|---|---|
| Master-Liste | `@mui/x-data-grid` | wie Asset-Tabelle — konsistent, erprobt |
| Bowtie-Detail | MUI (`Autocomplete`, `Select`) + SVG/CSS-Connectors | **kein D3** — Layout/Form, keine Force-Simulation |
| Tripartite Flow | **D3** (`d3-shape` + `d3-scalePoint`) | echter Graph-View |
| Import-Validierung (JSON) | `ajv` | `taraflow_json` gegen JSON-Schema |
| CSV-Import | nativ | kein zusätzliches Lib nötig |
| i18n | `i18next` / `react-i18next` | über die 8 Namespaces |

### 5.1 D3-Integration: React besitzt das DOM, D3 die Mathematik

`d3-scale` / `d3-shape` berechnen Positionen und die `d`-Strings; `<rect>` / `<path>`
werden als **React-Elemente in JSX** gerendert — D3 mutiert **nicht** das DOM. Folge: die
Flow-Sicht re-rendert automatisch bei `HazardStore`-Änderungen (DFD bearbeitet ein Hazard
→ Store → Flow neu). Das ist die geforderte **bidirektionale Synchronisation ohne
Sonderlogik**.

- **Kein `d3-sankey`** — es ist keine Mengen-/Bandbreiten-Darstellung, sondern ein
  tripartites Node-Link-Layout. `d3.linkHorizontal()` (oder Cubic-Bezier) für die Kanten,
  `scalePoint` für die Y-Verteilung pro Spalte.
- **`groupBy`-Toggle** = nur Tausch der Y-Ordnungsfunktion der linken Spalte; mit
  d3-Transition animiert der Regroup.

### 5.2 Bekannte Lücke: Excel-Import

Der **ISO-12100-Excel-Import** (`.xlsx`, Adapter `fmea_excel`) braucht eine zusätzliche
Lib (SheetJS `xlsx` oder `exceljs`) — `.xlsx` ist gezipptes XML, ohne Parser nicht
sinnvoll lesbar. **Nicht blockierend** (Importer ist nachgelagerte Phase). CSV/JSON
kommen ohne aus.

---

## 6. Services (konsolidiert)

| Service | Zweck |
|---|---|
| `HazardStore` | Single Source of Truth; Hazard-Tab und DFD sind Views |
| `HazardService` | CRUD am Hazard Item + referentielle Integrität (Löschen warnen wenn referenziert) |
| `HazardRelationService` | `contributes_to` / `endangers` add/remove/edit; Validierung gegen `ALLOWED_A2A_RELATIONS` |
| `eligibleAssets(role)` | liefert zulässige Assets als Beitrag bzw. Schutzziel (treibt die Autocompletes) |
| `resolveSeverityScale(targetType)` | passende Severity-Skala für den `endangers`-Editor |
| `HazardValidator` | R-Regeln: ≥1 `contributes_to`, ≥1 `endangers`, `endangers` nur vom Hazard, `ALL` mit einem Eingang → Warnung |
| `hazardImporterRegistry` | Adapter-Registry (Feature-Spec); Brücke `SafetyHazard → HazardItem` |
| **`AssetStore`** (neu) | zentraler Asset-Store als SSOT (siehe 4.3) |

---

## 7. Offene Entscheidungen

1. **Asset-Store-Scope:** nur Typen nach `shared/models`, oder ganzer Asset-Store nach
   `shared`? (Empfehlung 4.3: Typen jetzt, Store mit Phase 4.)
2. **`groupBy` rechte Spalte:** Schutzziele nach Typ vs. nach Hazard — analog zur linken
   Spalte anbieten?
3. **System als `endangers`-Ziel:** final ausgeschlossen (Empfehlung) oder mit eigener
   Operational/Destruction-Skala zugelassen?
4. **Excel-Lib-Wahl:** SheetJS `xlsx` vs. `exceljs` — erst bei `fmea_excel`-Adapter.

---

## 8. Einordnung in den Phasenplan

| Entscheidung | Phase (`IMPLEMENTATION-hazard-item.md`) |
|---|---|
| Hazard Tab, zwei Views, Master-Liste | Phase 0 / Phase 5 |
| Severity an `endangers`, `HazardImpact` union | Phase 1 / Phase 3 |
| `relevance` ↔ `hazardDistance` getrennt | Phase 1 / Phase 3 |
| Tripartite Flow (D3) + `groupBy` | Phase 5 |
| Bowtie-Editor + endangers-Editor | Phase 5 (Änderungen 20, 20b, 23) |
| Import-Brücke `SafetyHazard → HazardItem` | nachgelagert (Feature-Spec) |
| Asset-Modell-Umzug nach `shared/models` | Phase 1 (Foundation), Store ggf. Phase 4 |

---

*© Jürgen Messerer · TARAflow · 2026*
