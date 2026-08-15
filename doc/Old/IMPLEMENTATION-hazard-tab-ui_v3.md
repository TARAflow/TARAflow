# Implementation: Hazard Tab UI & Asset-Modell-Umzug

**Status:** Phase 1 (Datentypen) + Phasen-Renumber (Schema v2) + **Hazard-Tab-UI umgesetzt** · Tripartite Flow / Importer / safetyMode-Gating ausstehend
**Autor:** Jürgen Messerer
**Datum:** 2026-06-07
**Version:** v3 (ersetzt v2 vollständig)
**Bereich:** Hazard Feature-Slice · Asset-Erzeugung (shared) · DFD-Asset-Gruppe „environment"

> **Code-Kommentare immer in Englisch** — auch wenn dieses Dokument deutsch ist.

---

## Änderungslog v2 → v3

- **Hazard-Tab-UI gebaut** (war in v2 „ausstehend"): `HazardsTab`, `HazardToolbar`,
  `HazardTable`, `HazardDialog` (Bowtie), `HazardConfigDialog` + reine Services mit
  37 Vitest-Tests. §0 von „nächste Schritte" auf **as-built** umgestellt.
- **Asset-Erzeugung entschieden** (war offene Entscheidung 4.3 / 7.1): **kein** zentraler
  `AssetStore` und **kein** Umzug von `asset-types.ts` nach `shared`. Stattdessen ein
  **reines shared Primitive** `shared/services/asset-creation.ts`; `dfd.assets` bleibt der
  kanonische Store. §4 entsprechend neu gefasst.
- **Environment** als 9. Asset-Gruppe eingebaut (war „Phase-1 change 2"). §4.5 neu.
- **As-built-Spezifika** ergänzt (§9): Tabelle, Dialog-Layout, `createdAssets`-Fluss, i18n-Namespace.
- **Phase 6 — Safety-Independence-Analyse** als separates, geparktes Dokument referenziert
  (`IMPLEMENTATION-hazard-item-safety-independence.md`); erst nach voller UI-Umsetzung angehen.
- Inhaltlich **nichts entfernt** — alle v2-Abschnitte (File-Map, Konventionen, Design §1–§2,
  D3 §5, Verifikationspunkte, Dokumentenliste) sind vollständig übernommen und nur dort
  aktualisiert, wo der gebaute Stand abweicht.

---

## Zweck dieses Dokuments

Dieses Dokument hält die **Design-Entscheidungen der UI-Session** fest und dokumentiert ab
v3 zusätzlich den **tatsächlich gebauten Stand**. Es ist Ergänzungs- und Entscheidungs-
dokument — es verweist auf die anderen Dokumente, statt sie zu wiederholen.

**Verhältnis zu den anderen Dokumenten:**

- `IMPLEMENTATION-hazard-item.md` — der Phasen-Umsetzungsplan (Phase 0–7). Die hier
  getroffenen Entscheidungen konkretisieren vor allem **Phase 0** (Hazard Tab),
  **Phase 1** (Datenmodell) und **Phase 5** (UI).
- `IMPLEMENTATION-hazard-item-safety-independence.md` — **Phase 6** (Security→Safety
  Independence Analysis), als Konzept festgehalten, **noch nicht** umgesetzt.
- `taraflow-feature-spec-safety-hazard-import.md` — fachliche Spec für den **Importer**
  (Regulatory Profile, Safety Analysis Mode, Adapter). Hier wird nur die **Import-Brücke**
  `SafetyHazard → HazardItem` entschieden.
- `taraflow-asset-beziehungen.md` / `taraflow-asset-zu-asset-beziehungen.md` — das
  Beziehungs- und Hazard-Item-Datenmodell (`contributes_to` / `endangers`,
  `relevance` / `hazardDistance`, `combinationType`).

---

## 0. Aktueller Stand & Handoff

> Dieser Abschnitt fasst zusammen, was umgesetzt und committet ist, wo der Code liegt und
> welche Architektur-Konventionen gelten. Die Design-Abschnitte 1–9 darunter beschreiben
> Ziel **und** gebauten Stand.

### 0.1 Umgesetzt & committet

**Phase 1 — Hazard-Datentypen** (`shared/models`)

- `safety-types.ts` nach `src/shared/models` verschoben (`SafetyImpact`, `SafetyRelevance`,
  `ValueSource`, `PhysicalHazardPotential`, `SafetyAnnotation`); Konsumenten umgehängt, dedupliziert.
- `hazard-impact.ts` — `HazardImpact` discriminated union (`human | environment |
  infrastructure`); `HumanHarmSeverity = Exclude<SafetyImpact,"none">`; Env-/Infra-Skalen;
  `SEVERITY_SCALE_BY_TARGET`; Type-Guards.
- `hazard-types.ts` — `HazardItem` (lean, Kanten separat gespeichert), `HazardItemId` (branded),
  `HazardCategory` (ISO 12100), `HazardCombinationType` (`ANY` default | `ALL`), `HazardSource`,
  `ContributesToRelation`, `EndangersRelation`, `HazardRelation` union, Guards.
  Asset-Referenzen sind schlichte Strings (`AssetReference.id`), **kein** branded `AssetId`.
- Round-trip-Unit-Test grün (`src/tests/unit/shared/models/hazard-model.test.ts`).

**Phasen-Renumber auf Schema v2** (Hazard als eigene Phase eingefügt)

- Hazard ist jetzt Phase **1**; alle Folgephasen +1 (DFD 2 … Audit 8, Integration 9).
- Nummern zentral in `app/models/phase-types.ts` → `PhaseId` + `STANDARD/CRITICAL_PHASE_ORDER`.
  **Alle Call-Sites referenzieren Phasen über `PhaseId.X`**, keine nackten Literale mehr.
- Order-basierte Navigation/Gating in `app/services/phase-navigation.ts` (kein `id ± 1`);
  `phase-config.ts` und `phase-helpers.ts` gelöscht; `WorkflowMode` nach `shared` konsolidiert.
- `PHASES` + `PhaseStatusMap` renummeriert, Hazard-Eintrag (id 1, 🚨) ergänzt.
- `Project.hazards: HazardData | null` ergänzt; `features/hazards/models/hazard-data-types.ts`
  (`HazardData = { hazards, relations, lastModified, configuration? }` + `createEmptyHazardData()`).
- Migration **v1 → v2** in `migration-service.ts` (phaseStatus-Remap, `currentPhase` +1,
  `hazards = null`) mit Keystone-Unit-Test.

**Phase 5 — Hazard-Tab-UI** (`features/hazards`) — *neu in v3*

- `HazardsTab` — Orchestrator: lokale `HazardData`-Arbeitskopie, debounced Autosave,
  Validierungs-Chip, Puffer `pendingCreatedAssets` (siehe §9.1). Ersetzt den Platzhalter-Branch.
- `HazardToolbar` — Add / Settings / Count / Validierungs-Chip / Continue.
- `HazardTable` — Master-Liste (MUI x-data-grid v6): farbige `ID·Name`-Chips für
  Causes/Targets, PHP-Spalte, abgeleitete Max-Severity, Quick-Add-Zeile (§9.2).
- `HazardDialog` — Bowtie-Editor: Ursachen / Hazard / Schutzziele, inline Asset-Anlegen,
  gestreckter Mittelknoten (§9.3).
- `HazardConfigDialog` — Projekt-Defaults (`defaultCombinationType`, `requireHazardType`, `maxHops`).
- Reine Services (`features/hazards/services`, 37 Vitest-Tests grün): `hazard-service`,
  `hazard-relation-service`, `hazard-validator`, `eligible-assets-service`, `severity-scale-service`.

**Asset-Erzeugung & Environment** — *neu in v3*

- `shared/services/asset-creation.ts` (ID-Schema + `CreatedAsset`-Seed; §4).
- `features/dfd/services/dfd-asset-creation.ts` → `addCreatedAssets` (null-sicher; §4.3).
- `features/dfd/hooks/use-dfd-data.ts` delegiert Asset-Erzeugung an das Primitive.
- `environment` als 9. `AssetGroup` (Präfix `EN`; §4.5).
- `workspace-layout.tsx`: `<HazardsTab>` verdrahtet; `handleHazardsUpdate` schreibt Hazards
  + faltet `createdAssets` in `dfd.assets`; ein Schreibkanal `updateProject` bleibt.

### 0.2 File-Map (Stand v3)

| Datei | Inhalt |
|---|---|
| `shared/models/hazard-types.ts` | HazardItem, Relationen, IDs, Kategorien, Guards |
| `shared/models/hazard-impact.ts` | HazardImpact union + Severity-Skalen |
| `shared/models/safety-types.ts` | SafetyImpact & Co. (hierher verschoben) |
| `shared/models/common-types.ts` | `PHASES`, `PhaseStatusMap`, `WorkflowMode` |
| `shared/services/asset-creation.ts` | **neu** — `createAsset`, `generateAssetId`, `CreatedAsset`, `ASSET_GROUP_PREFIX` (inkl. `EN`) |
| `app/models/phase-types.ts` | **`PhaseId`** + Order-Arrays (Nummern-SSOT) |
| `app/services/phase-navigation.ts` | order-basierte Navigation/Gating |
| `app/services/migration-service.ts` | Schema v2 + `migrate_1_to_2` |
| `app/models/project-types.ts` | `Project.hazards`-Slot |
| `app/components/layout/workspace-layout.tsx` | `<HazardsTab>` + `handleHazardsUpdate` (faltet `createdAssets`) |
| `features/hazards/models/hazard-data-types.ts` | `HazardData` (Projekt-Slot) + `HazardConfiguration` |
| `features/hazards/models/hazard-tab-types.ts` | `HazardProjectData`, `HazardUpdateResult` (inkl. `createdAssets?`) |
| `features/hazards/components/hazard-tab.tsx` | Orchestrator (§9.1) |
| `features/hazards/components/hazard-toolbar.tsx` | Toolbar |
| `features/hazards/components/hazard-table.tsx` | Master-Liste (§9.2) |
| `features/hazards/components/hazard-dialog.tsx` | Bowtie-Editor (§9.3) |
| `features/hazards/components/hazard-config-dialog.tsx` | Projekt-Defaults |
| `features/hazards/services/hazard-service.ts` | CRUD + Phasenstatus + `toUpdateResult` |
| `features/hazards/services/hazard-relation-service.ts` | `contributes_to`/`endangers` add/remove/update |
| `features/hazards/services/hazard-validator.ts` | R-Regeln |
| `features/hazards/services/eligible-assets-service.ts` | `eligibleAssets`, Gruppen, `targetKindForAssetGroup` |
| `features/hazards/services/severity-scale-service.ts` | `resolveSeverityScale` |
| `features/hazards/index.ts` | Barrel |
| `features/dfd/services/dfd-asset-creation.ts` | **neu** — `addCreatedAssets(dfd \| null, created)` |
| `features/dfd/hooks/use-dfd-data.ts` | nutzt shared `createAsset`/`generateAssetId` |
| `features/dfd/models/asset-relation-types.ts` | `AssetGroup` (+ `environment`) + Relationen |
| `features/dfd/models/asset-constants.ts` | Gruppen-Config/Matrizen (+ `environment`) |
| `features/dfd/index.ts` | Barrel (exportiert `addCreatedAssets`) |
| `i18n/locales/{en,de}/hazards.json` | **neu** — Hazard-Namespace |
| `i18n/services/i18n.ts` | `hazards`-Namespace registriert + in `fallbackNS` |

### 0.3 Architektur-Konventionen (verbindlich für neuen Code)

- **Slice-Layout:** `models / services / utils / hooks / components`. Aliases: `shared`,
  `features/*`, `app/*`, `i18n`.
- **Dependency-Regeln:** `shared` importiert keine Features; Features importieren weder `app`
  noch einander; Cross-Feature nur über Reference-Types **und reine Primitive** in `shared`
  (z.B. `asset-reference-types.ts`, `services/asset-creation.ts`). `app` darf Features + `shared`.
- **State — kein zustand/redux.** SSOT ist `activeProject` im `ProjectContext`; **einziger
  Schreibkanal** ist `updateProject(newProject)`. Jeder Tab bekommt ein verschmälertes
  `project={...}`-Prop + `onUpdate(result)`. Muster: `handleXUpdate` liest
  `activeProjectRef.current` und ruft `updateProject({ ...current, <slice>, phaseStatus })`.
- **Persistenz:** `app/services/project-repository.ts` (`createEmpty`/load/save) +
  `migration-service.ts`. Aktuelle Schema-Version: **2**.
- **Sprache:** Code, Identifier und Kommentare in **Englisch** (Konversation deutsch).

### 0.4 Verbleibende Schritte

1. **Tripartite Flow (D3)** — globale Übersichts-Sicht (§1.3, §5.1); noch nicht gebaut.
2. **Progress-Cleanup** (klein): eine `PROGRESS_PHASE_IDS`-Konstante aus `PhaseId`, die sowohl
   das Fortschritts-Raster filtert als auch den Nenner von `calculatePhaseProgress` bildet —
   damit „nur Arbeitsphasen zählen" an *einer* Stelle definiert ist.
3. **safetyMode-Gating** (klein): `ProjectSettingsData.safetyMode` + Filter in
   `phase-tab-bar`, um den Hazard-Tab aus-/einzublenden.
4. **Import-Brücke** `SafetyHazard → HazardItem` (§3); nachgelagert (Feature-Spec).
5. **Phase 6 — Safety-Independence-Analyse** (eigenes Doc); erst nach voller UI-Umsetzung.
6. **Environment-Sweep:** prüfen, ob außerhalb der DFD-Modelle weitere erschöpfende
   `Record<AssetGroup>` / `switch(assetGroup)` einen environment-Zweig brauchen (Asset-Tab-
   Formulare/-Config etc.) — `tsc` ist die Checkliste.

### 0.5 Offene Verifikationspunkte aus dem Renumber

- **`OVERVIEW_PHASE_IDS`** (in `general-tab` genutzt) war nicht Teil des Renumber-Diffs —
  prüfen, ob es auf die neuen IDs zeigt, und entscheiden, ob Hazard zur Progress-Menge gehört.
- **`calculatePhaseProgress`** summiert derzeit *alle* Phasen; Documentation/Audit/Integration
  erreichen nie „complete", daher bleibt der Prozentwert strukturbedingt < 100 % (→ Schritt 0.4.2).

### 0.6 Benötigte Dokumente/Files für einen neuen Chat

Ein neuer Chat hat **keinen** Zugriff auf bereits hochgeladene Dateien — alles unten muss
aktiv mitgegeben werden. Nach „immer" und „je nach nächstem Schritt" gegliedert.

**Immer mitgeben (Kontext + Konventionen):**

- `IMPLEMENTATION-hazard-tab-ui_v3.md` — *dieses Dokument* (Design + Stand + Konventionen).
- `IMPLEMENTATION-hazard-item.md` — Phasen-Umsetzungsplan (Phase 0–7).
- `IMPLEMENTATION-hazard-item-safety-independence.md` — Phase 6 (geparkt).
- `shared/models/hazard-types.ts`, `hazard-impact.ts` — die Phase-1-Datentypen (Fundament).
- `features/hazards/models/hazard-data-types.ts` — `HazardData` (der Projekt-Slot).
- `app/models/phase-types.ts` — `PhaseId` + Order-Arrays (Nummern-SSOT).

**Für die Tripartite-Flow-Sicht (Schritt 0.4.1):**

- `features/hazards/components/hazard-tab.tsx` + `hazard-table.tsx` als Muster/Anschluss.
- `features/hazards/services/*` (eligibleAssets, severity-scale) — Datenquellen.
- `shared/models/hazard-types.ts` / `hazard-impact.ts` — Knoten-/Kantenmodell.

**Für die Import-Brücke (nachgelagert):**

- `taraflow-feature-spec-safety-hazard-import.md` — Importer-Spec (`SafetyHazard`, Adapter).

**Für den Progress-/safetyMode-Cleanup (Schritt 0.4.2 / 0.4.3):**

- `features/overview/components/general-tab.tsx` + `project-progress.tsx` (Progress-Anzeige,
  `OVERVIEW_PHASE_IDS`).
- `app/components/navigation/phase-tab-bar.tsx` (Tab-Filter) +
  `features/overview/models/overview-types.ts` (`ProjectSettingsData`).
- `app/services/phase-navigation.ts` (`calculatePhaseProgress`).

> Faustregel: das jeweilige **Zielmodul + ein erprobtes Geschwister-Modul als Muster + die
> Typen, die es konsumiert**. Lieber ein File zu viel als ein fehlendes — sonst rät der neue
> Chat Signaturen, die nicht zur Architektur passen.

---

## 1. UI-Architektur des Hazard Tab

### 1.1 Grundprinzip — zwei Views auf einen Store

Der Hazard Tab besteht aus **zwei Views auf dieselbe `HazardData`** (Single Source of Truth
in `Project.hazards`). Beide Views sind reine Darstellungen — kein Kopieren von Hazard-Daten:

| View | Zweck | Stärke |
|---|---|---|
| **Bowtie** (Detail) | Editieren *eines* Hazards | Zeigt N:1:M-Struktur + Gate (`combinationType`) |
| **Tripartite Flow** (Übersicht, *ausstehend*) | Globaler Blick über *alle* Hazards | Macht geteilte Knoten sichtbar (m:n:m) |

Die Master-Liste (alle Hazard Items) sitzt über beiden und selektiert das aktive Hazard.

### 1.2 Bowtie — die Editier-Sicht (gebaut)

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

### 1.3 Tripartite Flow — die Übersichts-Sicht (ausstehend)

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

### 1.4 Schnell-Erfassungs-Workflow (gebaut)

Ziel: Hazard + Verknüpfungen ohne Dialog-Springerei.

1. `+ Neues Hazard Item` / Quick-Add-Zeile → `label` + `hazardType`, Enter. Item existiert.
2. Bowtie öffnet leer. Beiträge per Autocomplete-Chip aus bestehenden Assets
   (gefiltert auf erlaubte Quell-Kategorien) **oder inline neu angelegt** (§4). Pro Chip
   inline `relevance` + `hazardDistance`.
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
> 7.3 — System als Ziel zuzulassen würde die Cause/Target-Grenze verwischen; final ausgeschlossen.)

---

## 3. Import-Brücke: `SafetyHazard → HazardItem` (nachgelagert)

Das Import-Format `SafetyHazard` (Feature-Spec) ist flach: *eine* `severity`,
`affectedAssets[]`. Das native `HazardItem` verteilt Severity auf `endangers`-Kanten.
Der Adapter überbrückt das beim Import:

**Entschieden:** Ein importiertes Hazard ohne Ziel-Information wird als `HazardItem` mit
**einem impliziten Human-Schutzziel** angelegt, dessen `impact` aus dem flachen
`severity`-Feld stammt. Der Analyst verfeinert danach im Bowtie (weitere Ziele, korrekte
Skalen). `affectedAssets[]` werden zu `contributes_to`-Kanten.

---

## 4. Asset-Erzeugung (umgesetzte Lösung)

### 4.1 Begründung

Sowohl der **Hazard-Tab** als auch der **DFD-Tab** legen Assets an. Damit ist die
Asset-*Erzeugung* keine Feature-lokale Struktur mehr, sondern gemeinsames Vokabular —
analog zum Hazard Item. Die Architektur-Konvention (keine `feature ↔ feature` Imports;
Gemeinsames in `src/shared`) verlangt eine geteilte Stelle, sobald ein zweiter Slice Assets
erzeugt.

### 4.2 Entscheidung (löst v2 §4.3 / §7.1)

**Kein** zentraler `AssetStore`-Umzug und **kein** Verschieben von `asset-types.ts` nach
`shared`. Nur die **minimale Asset-Identität** (ID-Schema + Seed) wurde als reines Primitive
nach `shared` gezogen. Der **reiche** `DFDAsset`, der Asset-Store (`dfd.assets`) und der
Graph-Rebuild bleiben im DFD-Feature.

`shared/services/asset-creation.ts`:

- `CreatedAsset<G>` (`id, displayId, name, assetGroup, protectionNeed?`).
- `ASSET_GROUP_PREFIX` (DA/FU/SY/IF/PR/PH/SV/HU **+ EN** für environment).
- `generateAssetId(existingIds: string[], group)` — lückenlose Nummerierung pro Gruppe
  (nimmt **IDs**, nicht `DFDAsset[]`).
- `createAsset(existingIds, name, group, protectionNeed?)` — generisch, wirft bei
  unbekannter Gruppe (kein „undefined-001").

### 4.3 Konsumenten & Fluss

- **DFD** — `use-dfd-data.ts` delegiert `createAsset` und die Kategoriewechsel-ID an das
  Primitive (`existingIds = dfd.assets.map(a => a.id)`), widet den Seed zu `DFDAsset`
  (`{ ...seed, linkedElements: [] }`). Lokales `GROUP_PREFIX`/`generateAssetId` entfernt.
- **Hazard** — der Bowtie mintet lokal über `createAsset`, sammelt `sessionAssets` und gibt
  sie via `HazardUpdateResult.createdAssets` nach oben. **Kein** Callback, kein Hook-Chain.
- **App** — `handleHazardsUpdate` faltet `createdAssets` über
  `features/dfd/services/dfd-asset-creation.ts → addCreatedAssets(dfd: DFDData | null, created)`
  in `dfd.assets` (null-sicher: materialisiert ein minimal leeres DFD, da die Hazard-Phase dem
  DFD vorausgeht und `project.dfd` echt nullable ist). Danach trägt der bestehende Asset-Sync
  sie in den Asset-Tab.

### 4.4 Rollenverteilung

| Slice | Rolle bzgl. Asset |
|---|---|
| **DFD-Tab** | legt Assets an (aus dem Graphen) — kanonischer Store `dfd.assets` |
| **Hazard-Tab** | legt Assets an (Bowtie-Schnellerfassung) → emittiert `createdAssets` |
| **Asset-Tab** | **legt keine Assets an** — bestimmt nur Impact-Bewertung und Schutzziele (CIANAAA-Sicherheitsziele bzw. Protection-Target-Eigenschaft) |

> SSOT-Hinweis: `dfd.assets` ist der eine Ort, an dem ein erzeugtes Asset lebt. Der
> Asset-Sync leitet daraus `Project.assets`/Reference-Views ab. Ein separater `AssetStore`
> ist damit **nicht** nötig.

### 4.5 Environment als 9. Asset-Gruppe

`environment` ist orthogonale Asset-Gruppe und **reines Schutzziel** (Ziel von `endangers`).
Umgesetzt in `features/dfd/models`:

- `asset-relation-types.ts`: `AssetGroup`-Union um `"environment"` erweitert.
- `asset-constants.ts`: `ASSET_GROUP_CONFIG` (Umwelt, Blattgrün `#558B2F`);
  `DERIVABLE_RELATIONS` (leer); `ALLOWED_A2A_RELATIONS` (`environment: {}` als Quelle;
  `physical`/`service` → `environment` via `endangers`); `getAllowedRelations`
  (environment → `[]`, kein Element wirkt auf die Umwelt); `ASSET_GROUP_TAB_ORDER`.
- `shared/services/asset-creation.ts`: Präfix `EN`.
- `dfd-asset-types.ts` **unverändert** (nutzt `AssetGroup` nur als Feldtyp).

> Beim Hinzufügen von `"environment"` flaggt `tsc` jede weitere erschöpfende
> `Record<AssetGroup>` / `switch(assetGroup)` im Repo — der Compiler ist die Checkliste
> (§0.4.6). Die meisten Zweige sind trivial (leer/No-op, Label/Farbe, oder „wie human").

### 4.6 Move-Hinweise (historisch / falls der Store doch wandert)

Falls später der gesamte Asset-Store nach `shared` wandern soll (in v3 **nicht** geschehen):
`asset-types.ts` → `src/shared/models`; Asset-Anteile aus `element-properties.ts`
(`AssetProperties`, `securityGoals[]`, `physicalImpact*`) auf shared-Verträglichkeit prüfen;
Re-Exports/Barrel übergangsweise an alter Stelle behalten (minimal-invasiv, dann nachziehen).
Empfehlung bleibt: erst scharf schalten, wenn ein dritter Slice den reichen Asset-Record liest.

---

## 5. Tech-Stack-Zuordnung

Mit dem bestehenden `package.json` ist der Hazard Tab vollständig abgedeckt.

| Baustein | Lib | Notiz |
|---|---|---|
| Master-Liste | `@mui/x-data-grid` (v6) | **gebaut** — v6/v7-sicher (keine `valueGetter`) |
| Bowtie-Detail | MUI (`Autocomplete`, `Select`) + SVG/CSS-Connectors | **gebaut** — Layout/Form, kein D3 |
| Tripartite Flow | **D3** (`d3-shape` + `d3-scalePoint`) | **ausstehend** — echter Graph-View |
| Import-Validierung (JSON) | `ajv` | `taraflow_json` gegen JSON-Schema |
| CSV-Import | nativ | kein zusätzliches Lib nötig |
| i18n | `i18next` / `react-i18next` | Namespace `hazards` (§9.4) |

### 5.1 D3-Integration: React besitzt das DOM, D3 die Mathematik

`d3-scale` / `d3-shape` berechnen Positionen und die `d`-Strings; `<rect>` / `<path>`
werden als **React-Elemente in JSX** gerendert — D3 mutiert **nicht** das DOM. Folge: die
Flow-Sicht re-rendert automatisch bei `HazardData`-Änderungen (DFD bearbeitet ein Hazard
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

## 6. Services (as-built)

SSOT ist `Project.hazards` (+ `dfd.assets`) über `updateProject` — **keine** separaten
Store-Objekte (`HazardStore`/`AssetStore` aus v2 sind durch dieses Muster ersetzt). Die
Services sind rein und getestet:

| Service | Zweck |
|---|---|
| `hazardService` | CRUD am Hazard Item (ID-Gen, add/update/delete mit Kaskaden-Kantenentfernung), `getReferencingRelations`, `validate`, `deriveHazardPhaseStatus`, `toUpdateResult` |
| `hazardRelationService` | `contributes_to` / `endangers` add/remove/update (immutabel, idempotent) + `validateContributesTo`/`validateEndangers` (dedizierte Regelmatrix, **nicht** `ALLOWED_A2A_RELATIONS`, da HazardItem keine AssetGroup hat) |
| `hazardValidator` | R-Regeln: ≥1 `contributes_to`, ≥1 `endangers`, `ALL`-mit-1-Eingang-Warnung, dangling edges, Diskriminator-Konsistenz |
| `eligibleAssets(assets, role)` | zulässige Beitrags-/Schutzziel-Assets (treibt die Autocompletes) + `HAZARD_CONTRIBUTOR_GROUPS`/`HAZARD_TARGET_GROUPS` + `targetKindForAssetGroup` |
| `resolveSeverityScale(targetKind)` | ziel-typ-abhängige Severity-Skala für den `endangers`-Editor |
| `shared createAsset` / `addCreatedAssets` | Asset-Erzeugung & Einfaltung (§4) |
| `hazardImporterRegistry` *(ausstehend)* | Adapter-Registry; Brücke `SafetyHazard → HazardItem` |

---

## 7. Offene Entscheidungen — Stand v3

1. ~~Asset-Store-Scope~~ → **entschieden:** reines shared Creation-Primitive, `dfd.assets`
   bleibt SSOT (§4); kein `asset-types.ts`-Umzug, kein zentraler Store.
2. **`groupBy` rechte Spalte:** Schutzziele nach Typ vs. nach Hazard — analog zur linken
   Spalte anbieten? (offen, mit Tripartite Flow.)
3. **System als `endangers`-Ziel:** final **ausgeschlossen** (rechts nur Schutzziele).
4. **Excel-Lib-Wahl:** SheetJS `xlsx` vs. `exceljs` — erst bei `fmea_excel`-Adapter.
5. **Hazard-Tab-Gating via `safetyMode`:** Feld + Filter noch nicht umgesetzt.
6. **Progress-Phasen-Menge:** `PROGRESS_PHASE_IDS` als SSOT dafür, welche Phasen in den
   Fortschritt zählen (Documentation/Audit/Integration ausgenommen).
7. ~~Environment-Gruppe~~ → **umgesetzt** (§4.5).

---

## 8. Einordnung in den Phasenplan

| Entscheidung | Phase (`IMPLEMENTATION-hazard-item.md`) | Stand |
|---|---|---|
| Hazard Tab, zwei Views, Master-Liste | Phase 0 / Phase 5 | **umgesetzt** (Flow ausstehend) |
| Severity an `endangers`, `HazardImpact` union | Phase 1 / Phase 3 | umgesetzt |
| `relevance` ↔ `hazardDistance` getrennt | Phase 1 / Phase 3 | umgesetzt |
| Asset-Erzeugung (shared) + environment | Phase 1 | **umgesetzt** |
| Tripartite Flow (D3) + `groupBy` | Phase 5 | ausstehend |
| Bowtie-Editor + endangers-Editor | Phase 5 (Änderungen 20, 20b, 23) | **umgesetzt** |
| Import-Brücke `SafetyHazard → HazardItem` | nachgelagert (Feature-Spec) | ausstehend |
| Asset-Modell-Umzug nach `shared/models` | Phase 1 (Foundation) | **als Creation-Primitive umgesetzt** (Store nicht verschoben) |
| Security→Safety Independence | **Phase 6** | Konzept (eigenes Doc) |

---

## 9. As-built-Spezifika

### 9.1 `createdAssets`-Fluss

Bowtie `onSave(draft, sessionAssets)` → Tab puffert `pendingCreatedAssets` und augmentiert
die an Tabelle/Dialog gereichte Asset-Liste (ID-Kollisionsfreiheit + Namensauflösung vor dem
Sync) → Autosave emittiert `HazardUpdateResult.createdAssets` und leert den Puffer → App
`addCreatedAssets` faltet in `dfd.assets`; sobald der Sync sie in `assetDataRef` führt, fällt
der Puffer-Eintrag weg. Dialog-Cancel verwirft die `sessionAssets` (kein Leck).

### 9.2 Master-Liste

Spalten: **ID · Hazard · Type · Phys. Potential · Logic · Causes · Targets · Max Severity ·
Source · Actions**.

- **Causes / Targets**: echte Asset-`ID·Name`-Chips, eingefärbt nach Asset-Gruppe (lokale
  `GROUP_COLOR`-Palette — bewusste Duplikation der DFD-Palette, da kein Cross-Feature-Import;
  bei Bedarf nach `shared` heben). Umbruch über `flex-wrap` + `getRowHeight="auto"` → n Zeilen.
  Leer → rotes „0" als Unvollständigkeits-Signal.
- **Phys. Potential**: Stufenfarbe (low grau / medium orange / high rot).
- **Max Severity**: abgeleitetes Aggregat über `endangers`-Kanten (cross-target rank), als
  reales Feld `_worstRank` projiziert (v6/v7-sicher, keine `valueGetter`).
- Causes/Targets-Spalten `sortable: false` (Arrays); Default-Sort `_worstRank desc`.

### 9.3 Bowtie-Dialog-Layout

- Feldzeile: `ISO 12100 type` + `Physical hazard potential` teilen sich die Breite (`flex:1`),
  `Combination` rechts in natürlicher Breite (keine Lücke dahinter).
- Mittelknoten: Pfeil im Titel-Band (auf Höhe der „Causes"/„Targets"-Überschriften),
  Box-Oberkante = Oberkante des ersten Eintrags, Box wächst mit (`alignItems="stretch"` +
  `flexGrow`).
- Inline-Anlegen: Gruppen-`Select` + Autocomplete-`＋ create` pro Seite, lokal via shared
  `createAsset`; Save-Gate: `label` Pflicht, optional `hazardType` (`requireHazardType`).

### 9.4 i18n

Eigener Namespace **`hazards`** (`locales/{en,de}/hazards.json`), registriert in `i18n.ts` und
in **`fallbackNS`** aufgenommen. Dadurch lösen die unpräfixierten `t("tabs.hazards.…")`-Calls
(defaultNS `common`) über die Fallback-Kette im `hazards`-NS auf — null Komponentenänderung.
`validation.noMessages` liegt in `common`. Severity-/PHP-Werte werden teils via `humanize`
gerendert (Parität mit dem Dialog).

---

*© Jürgen Messerer · TARAflow · 2026*
