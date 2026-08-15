# Implementation: Hazard Tab UI & Asset-Modell-Umzug

**Status:** Phase 1 (Datentypen) + Phasen-Renumber (Schema v2) + Hazard-Tab-UI + Gating + Progress-Cleanup + **Import-Brücke (as-built) + Review-Workspace mit Cyber-System-Scope** umgesetzt · Tripartite Flow ausstehend · Asset-Store-Konsolidierung als eigenes Ticket
**Autor:** Jürgen Messerer
**Datum:** 2026-06-15
**Version:** v5 (baut auf v4 auf; v4-Inhalt übernommen, korrigiert & erweitert)
**Bereich:** Hazard Feature-Slice · Import-Brücke · Asset-Erzeugung/-Sync (shared + app) · DFD-Asset-Gruppe „environment"

> **Code-Kommentare immer in Englisch** — auch wenn dieses Dokument deutsch ist.

---

## Änderungslog v4 → v5

> v4-Inhalt übernommen. v5 **korrigiert** eine inzwischen widerlegte Annahme (Asset-Sync auf
> dem Hazard-Pfad) und **erweitert** um die gebaute Import-Brücke und den Review-Workspace.
> Datum v5: 2026-06-15.

**Neu umgesetzt (war in v4 „ausstehend"):**

- **Import-Brücke `SafetyHazard → HazardItem` gebaut** (war §0.4.4 / §3 / §8 „ausstehend").
  Profilbasierter Importer mit interaktivem Spalten-Mapping-Dialog, format-agnostischen
  Adaptern (CSV via `papaparse`, XLSX/XLSM/XLS/ODS via **SheetJS `xlsx`**, TARAflow-JSON) und
  einer Brücke in den nativen Graphen. **Design-Abweichung zu v4 §3:** statt „ein implizites
  Human-Ziel aus dem flachen severity-Feld" werden **`affectedPersons` → deduplizierte
  Human-Assets → strukturierte `endangers`-Kante pro Rolle** erzeugt (`SEVERITY_TO_HUMAN`).
  Details: neue §3 (ersetzt).
- **Excel-Lib-Entscheidung getroffen** (war offene Entscheidung §7.4): **SheetJS `xlsx`**
  (Apache-2.0, CDN-Tarball) + `papaparse` für CSV.
- **Review-Workspace + Cyber-System-Scope** (komplett neu, nicht in v4): der Single-Bowtie-
  Dialog ist eine Master-Detail-Review-Sicht mit Triage-Gate `systemRelevance`
  (`in_scope|out_of_scope|unknown`), Sidebar mit Filter/Fortschritt, progressivem Bowtie-
  Aufklappen und Commit-on-Close. Details: neue §10.
- **HazardItem-Modell erweitert:** `description?`, `importMeta?`, `systemRelevance?`,
  `systemRelevanceNote?` (`shared/models/hazard-types.ts`).
- **Hazard-Tabelle erweitert:** View-Filter (`active|all|out`), review-status-getriebene
  Zeilenfarben (out=rot/ausgeblendet, unknown=neutral, in_scope=grün/orange), Header- und
  Zell-Tooltips inkl. Klartext-Asset-Namen für Causes/Targets.

**Korrektur (wichtig für neuen Chat):**

- **§4.3/§4.4/§6 waren falsch:** „Danach trägt der bestehende Asset-Sync sie in den Asset-Tab"
  bzw. „`dfd.assets` ist der eine Ort … kein separater Store nötig" stimmte **auf dem
  Hazard-Pfad nicht**. Es gibt zwei Stores (`project.dfd.assets` und `project.assets.assets`),
  und der DFD→Assets-Sync (`syncFromDFD`) wurde im Hazard-Handler **übersprungen** → import-
  geminteten Human-Assets strandeten in `dfd.assets` (Bug „HU-003"). **Fix (QF-1):**
  `handleHazardsUpdate` ruft nach `addCreatedAssets` jetzt `syncFromDFD` nach. Bestehende
  Altlasten heilen über einen einmaligen Backfill beim Project-Load / einen Assets-Tab-Besuch.
  Die **eigentliche** Auflösung (eine Single Source of Truth) ist ein separates Ticket:
  siehe `TARAflow-asset-store-consolidation.md`. Korrigierte Stellen: §4.3, §4.4, §6.

**Typ-Bereinigung (erste Schritte Richtung SSoT):**

- `AssetReference.hasSafetyAnnotation` → **optional** (`?: boolean`), damit der minimale
  Creation-Seed ohne Adapter als `AssetReference` nutzbar ist; `seedToRef` entfernt.
  `shared` exportiert zusätzlich `HumanHarmSeverity` (von der Brücke benötigt).

**Abhängigkeiten:** `+ papaparse ^5.5.3`, `+ @types/papaparse`, `+ xlsx` (SheetJS 0.20.3 CDN-Tarball).

> **Hinweis (kleine Bereinigung):** im committeten `handleHazardsUpdate` steht ein deutscher
> Inline-Kommentar (`// ← neu: synchronisierter Assets-Store`) — laut Konvention sollten
> Code-Kommentare englisch sein.

---

## Änderungslog v3 → v4

> v3-Inhalt **unverändert** übernommen; v4 ergänzt nur den umgesetzten Stand der
> zwei kleinen Cleanup-Schritte. **Keine Design-Änderung.** Datum v4: 2026-06-12.

- **Hazard-Tab-Gating umgesetzt** (war Schritt 0.4.3 / offene Entscheidung 7.5).
  **Abweichung zur v3-Spezifikation:** Das Flag liegt in **`ProjectInfoData.safetyRelevant`**
  (nicht `ProjectSettingsData.safetyMode`) und wird über einen **Slide-Switch im Overview-Tab
  unterhalb des Criticality-Switch** bedient (`project-info.tsx` + `new-project-dialog.tsx`),
  persistiert via `project-shell` ins `info`-Objekt. Tab-/Phasen-Gating: Filter in
  `phase-tab-bar` (Hazard fällt aus der Workflow-Sortierung, wenn aus; Nummerierung bleibt
  kontiguierlich), Render-Guard + Redirect auf Overview in `workspace-layout`. Default
  `false` → Bestandsprojekte bleiben security-only, keine Migration nötig. i18n: `settings.safety*`.
- **Progress-Cleanup umgesetzt** (war Schritt 0.4.2 / offene Entscheidung 7.6 / Verifikations-
  punkt 0.5). `PROGRESS_PHASE_IDS` + `getProgressPhaseIds(safetyRelevant)` als SSOT in
  `phase-types.ts`; `general-tab` erhält die Menge als **`progressPhaseIds`-Prop** (Literal
  `OVERVIEW_PHASE_IDS` entfernt, Feature-Slice bleibt rein); `project-progress` rechnet den
  Balken-Nenner über die angezeigten Phasen (matcht das Grid, erreicht 100 %) und passt die
  Grid-Spalten dynamisch 6/7 an. **Entscheidungen dabei:** AttackTree zählt zur Progress-Menge;
  Documentation/Audit/Integration ausgenommen; die Hazard-Kachel erscheint im Progress nur bei
  `safetyRelevant` (folgt demselben Toggle wie der Tab).
- **`calculatePhaseProgress`** auf die SSOT-Signatur (`progressPhaseIds`) gebracht, aber **noch
  nicht verdrahtet** — derzeit kein realer Aufrufer (`project-progress` rechnet lokal aus den
  injizierten Phasen). Einbindung in die Tabs **und die eigentliche Progress-Visualisierung
  (v. a. DFD-Tab)** ist ein eigenes, noch offenes Thema.

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

**Import-Brücke + Review-Workspace + Asset-Sync-Fix** — *neu in v5*

- **Import-Brücke** (`features/hazards`): `safety-hazard-types.ts`, `import-profile-types.ts`,
  `apply-import-profile.ts`, `safety-hazard-importer.ts` (CanonicalField inkl. `affectedPersons`
  + `physicalHazardPotential`, Required `id`/`description`, Suffix-Dedup), `hazard-bridge.ts`
  (Rollen → Human-Assets, strukturierte `endangers`-Severity), `register-hazard-adapters.ts`,
  Adapter unter `services/importer/` (`csv-importer`, `xlsx-ods-importer`, `taraflow-json-importer`),
  Hook `use-hazard-import.ts`, Dialog `hazard-import-profile-dialog.tsx`, `utils/tabular-mapping.ts`.
  Toolbar erhält Import-Button; `hazard-tab` ruft `registerHazardImportAdapters()` beim Bootstrap,
  `handleImport` merged Items/Relations/`createdAssets`.
- **Review-Workspace** (`hazard-dialog.tsx` umgebaut): Master-Detail mit Scope-Gate, Sidebar,
  progressivem Bowtie, Commit-on-Close (§10).
- **Tabelle** (`hazard-table.tsx`): View-Filter, review-status-Zeilenfarben, Tooltips.
- **Asset-Sync-Fix** (`workspace-layout.tsx`): `handleHazardsUpdate` ruft `syncFromDFD` nach
  `addCreatedAssets` (QF-1) — schließt die Sync-Lücke (§4.3/§6-Korrektur).
- **Modell:** `HazardItem` um `description?`, `importMeta?`, `systemRelevance?`,
  `systemRelevanceNote?` erweitert; `AssetReference.hasSafetyAnnotation` optional; `seedToRef` raus.
- **Deps:** `papaparse`, `@types/papaparse`, SheetJS `xlsx`.

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

### 0.2b File-Map — *neu in v5*

| Datei | Inhalt |
|---|---|
| `features/hazards/models/safety-hazard-types.ts` | `SafetyHazard` Import-DTO + Optionen |
| `features/hazards/models/import-profile-types.ts` | `ImportProfile`, `WorkbookPreview`, Marker/Meta-Typen, Options-Konstanten |
| `features/hazards/services/safety-hazard-importer.ts` | `CanonicalField`, `ProfileImportAdapter`, `finalizeImport`, Registry-Typen |
| `features/hazards/services/apply-import-profile.ts` | `applyImportProfile`, `suggestProfile`, Alias-Matching (i18n) |
| `features/hazards/services/hazard-bridge.ts` | `bridgeSafetyHazards` (Rollen → Human-Assets, Kanten, Suffix-Dedup) |
| `features/hazards/services/register-hazard-adapters.ts` | `registerHazardImportAdapters()` (Bootstrap) |
| `features/hazards/services/importer/{csv,xlsx-ods,taraflow-json}-importer.ts` | Format-Adapter (papaparse / SheetJS / JSON) |
| `features/hazards/services/taraflow-json-adapter.ts` | JSON-Adapter (Re-Export/Anschluss) |
| `features/hazards/utils/tabular-mapping.ts` | Tabellen-Mapping-Helfer |
| `features/hazards/hooks/use-hazard-import.ts` | Import-Seam (pick → detect → profile → bridge) |
| `features/hazards/components/hazard-import-profile-dialog.tsx` | Spalten-Mapping-Dialog |
| `features/hazards/components/hazard-dialog.tsx` | **umgebaut** → Review-Workspace + Scope-Gate (§10) |
| `features/hazards/components/hazard-table.tsx` | **erweitert** → View-Filter, Status-Farben, Tooltips (§11) |
| `app/components/layout/workspace-layout.tsx` | **geändert** → `handleHazardsUpdate` ruft `syncFromDFD` (QF-1) |
| `shared/models/hazard-types.ts` | **erweitert** → `description?`, `importMeta?`, `systemRelevance?`, `systemRelevanceNote?` |
| `shared/models/asset-reference-types.ts` | **geändert** → `hasSafetyAnnotation?` optional |
| `shared/index.ts` | exportiert `HumanHarmSeverity` |
| `package.json` | `+ papaparse`, `+ @types/papaparse`, `+ xlsx` (SheetJS) |

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
2. ✅ **Progress-Cleanup** (umgesetzt v4): eine `PROGRESS_PHASE_IDS`-Konstante aus `PhaseId`, die sowohl
   das Fortschritts-Raster filtert als auch den Nenner von `calculatePhaseProgress` bildet —
   damit „nur Arbeitsphasen zählen" an *einer* Stelle definiert ist. (Service-Nenner: Signatur
   angepasst, Verdrahtung noch offen — siehe v3→v4-Log.)
3. ✅ **Hazard-Tab-Gating** (umgesetzt v4): realisiert als **`ProjectInfoData.safetyRelevant`**
   (statt `ProjectSettingsData.safetyMode`) + Slide-Switch im Overview-Tab + Filter in
   `phase-tab-bar`, um den Hazard-Tab aus-/einzublenden. Siehe v3→v4-Log.
4. ✅ **Import-Brücke** `SafetyHazard → HazardItem` (§3) — **umgesetzt (v5)**, profilbasiert,
   inkl. SheetJS-Excel-Adapter.
5. **Phase 6 — Safety-Independence-Analyse** (eigenes Doc); erst nach voller UI-Umsetzung.
   In v5 über den Hazard-Level-Rollup `systemRelevance` (Cyber-System-Scope, §10) konzeptionell
   angedockt; die kantenfeine SUBSTANTIATED/REFUTED/UNCERTAIN-Analyse bleibt geparkt.
   **Performance Level (EN ISO 13849):** Methodik (`requiredPL` an der `endangers`-Kante,
   PLr als Akzeptanzschwelle, Cyber-als-Common-Cause) ist **vollständig im Independence-Doc
   spezifiziert** (`IMPLEMENTATION-hazard-item-safety-independence.md`, §2/§3a/§4/§6/§7) — das
   ist die SSoT, hier **nicht** duplizieren. UI-seitige Aufhängung, sobald das Feature gebaut
   wird: `requiredPL`-Dropdown im sichtbaren Hazard-Feldbereich (nur bei `safetyRelevant`),
   `Required PL`-Spalte in `hazard-table.tsx`, Status-Farbe getrieben vom Verdict (nicht vom
   Mitigationsstatus).
6. **Environment-Sweep:** prüfen, ob außerhalb der DFD-Modelle weitere erschöpfende
   `Record<AssetGroup>` / `switch(assetGroup)` einen environment-Zweig brauchen — `tsc` ist die Checkliste.
7. **Asset-Store-Konsolidierung** (Single Source of Truth) — eigenes Ticket/Doc
   `TARAflow-asset-store-consolidation.md`. QF-1 + Backfill sind interim; Phase 2 (Sync im
   `updateProject`-Chokepoint erzwingen) eliminiert die Bug-Klasse dauerhaft.
8. **Import-Nachgang:** `importMeta`-Anzeige im Bowtie-Detail + Doc-Gen-Mapper; Import-Report-
   Dialog (Warnungen-UI statt `console.warn`); Profil-Persistenz-Store (`savedProfiles`/`onSaveProfile`
   sind im Dialog vorbereitet, Store fehlt).

### 0.5 Offene Verifikationspunkte aus dem Renumber

- **`OVERVIEW_PHASE_IDS`** (in `general-tab` genutzt) war nicht Teil des Renumber-Diffs —
  prüfen, ob es auf die neuen IDs zeigt, und entscheiden, ob Hazard zur Progress-Menge gehört.
  → ✅ **erledigt (v4):** Literal entfernt, durch `PROGRESS_PHASE_IDS`/`getProgressPhaseIds`
  ersetzt; Hazard gehört zur Progress-Menge **nur bei `safetyRelevant`**.
- **`calculatePhaseProgress`** summiert derzeit *alle* Phasen; Documentation/Audit/Integration
  erreichen nie „complete", daher bleibt der Prozentwert strukturbedingt < 100 % (→ Schritt 0.4.2).
  → ✅ **adressiert (v4):** SSOT-Nenner via `getProgressPhaseIds`; sichtbarer Overview-Balken
  rechnet in `project-progress` über die angezeigten Phasen und erreicht 100 %. Service-Funktion
  signaturseitig SSOT-fähig, aber noch ohne Aufrufer.

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

## 3. Import-Brücke: `SafetyHazard → HazardItem` (umgesetzt, v5)

> **Ersetzt die v4-Fassung** („ein implizites Human-Ziel aus dem flachen severity-Feld").
> Die gebaute Lösung leitet Schutzziele aus den importierten „betroffenen Personen" ab.

**Zwei Schichten:**

1. **Format-agnostische Adapter** (`file → SafetyHazard[]`, ohne Projektwissen): CSV (`papaparse`),
   XLSX/XLSM/XLS/ODS (**SheetJS `xlsx`**, `header:1`-Grids je Sheet), TARAflow-JSON. Tabellen-
   Adapter exponieren rohe Sheet-Grids via `readWorkbook`; die Profil-Anwendung ist ein
   gemeinsamer Service (`apply-import-profile.ts`). Registrierung über
   `registerHazardImportAdapters()` (einmal beim Bootstrap — sonst leeres Registry, Dialog
   erscheint nie).
2. **Brücke** (`hazard-bridge.ts`, `SafetyHazard → HazardItem` + Kanten, mit Projektkontext).

**Profil-Mapping-Dialog** (`hazard-import-profile-dialog.tsx`): expliziter „Klick auf Spalten-
header mappt Feld X"-Workflow, Single- vs. Matrix-Modus (z. B. Severity über 3 Marker-Spalten),
„Extra columns (provenance)" → `importMeta`, Live-Preview, Sheet/HeaderRow/DataStartRow/idPattern,
Profil speichern/laden.

**Brücken-Semantik (`hazard-bridge.ts`):**

- `label = shortLabel(description)` (Text vor erstem `(`/`;`/Newline, max. 60), `description = full`.
- **`affectedPersons[]` (Rollen) → `endangers`**: jede distinkte Rolle (normalisiert dedupliziert)
  wird **ein** Human-Asset (Gruppe `human`, Präfix `HU`, `critical`); pro Rolle eine strukturierte
  `endangers`-Kante mit `SEVERITY_TO_HUMAN` (negligible/marginal → `reversible_injury`,
  critical → `irreversible_injury`, catastrophic → `fatality`). Keine Rolle → Info-Warnung
  (Analyst verdrahtet im Bowtie nach).
- **`affectedAssets[]` → `contributes_to`** (existierende Asset-IDs).
- **Dedup von IDs:** wiederverwendete Quell-Nummern werden mit Suffix erhalten (`id#2` + Warnung),
  statt verworfen.
- Human-Mint läuft über das **injizierte Primitive** `mintHumanAsset` (= `createAsset(..., "human",
  "critical")`); die Brücke kennt nur `created.id`, bleibt projekt-agnostisch/testbar.

**Severity-/Kategorie-Quelle:** ISO-12100-`hazardType` und `physicalHazardPotential` stehen in den
realen Kundentabellen i. d. R. nicht — der Importer warnt, wenn eine Spalte fehlt und ein Default
greift; bestehende, auditierte Kundendateien werden **nicht** in ein Template gezwungen.

**Referenzfall (Kunde):** Sheet `Risikobeurteilung` (Header Zeile 3, Daten ab Zeile 8, idPattern
`^\d+\.\d+$`), Mapping id→B, description→AB, affectedPersons→AC, rpn→AM, notes→AS; Severity-Matrix
AG/AH/AI, Probability-Matrix AJ/AK/AL → ergibt 70 Hazards (geprüft).

**Asset-Sync nach Import:** die geminteten Human-Assets müssen vom App-Layer in beide Stores
gelangen — siehe **§4.3-Korrektur** (QF-1 in `handleHazardsUpdate`).

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
  DFD vorausgeht und `project.dfd` echt nullable ist).

> **Korrektur (v5):** Die v4-Behauptung „Danach trägt der **bestehende** Asset-Sync sie in den
> Asset-Tab" stimmte **nicht**. `addCreatedAssets` schreibt nur in `dfd.assets`; der Read-Pfad
> (`memoizedAssetDataRef`) liest aber aus `project.assets.assets`. Der DFD→Assets-Sync
> (`syncFromDFD`) lief im Hazard-Handler **nicht** → geminteten Assets strandeten (Bug „HU-003").
> **Fix (QF-1):** `handleHazardsUpdate` ruft nach `addCreatedAssets` jetzt explizit
> `syncFromDFD(current.assets, mapDFDAssetsToAssetFeature(dfd.assets), …)` und schreibt das
> Ergebnis in `assets`. Altlasten heilen über einen einmaligen Backfill / Assets-Tab-Besuch.
> Die saubere Auflösung (eine SSoT statt zwei Stores) ist ein eigenes Ticket:
> `TARAflow-asset-store-consolidation.md`.

### 4.4 Rollenverteilung

| Slice | Rolle bzgl. Asset |
|---|---|
| **DFD-Tab** | legt Assets an (aus dem Graphen) — kanonischer Store `dfd.assets` |
| **Hazard-Tab** | legt Assets an (Bowtie-Schnellerfassung) → emittiert `createdAssets` |
| **Asset-Tab** | **legt keine Assets an** — bestimmt nur Impact-Bewertung und Schutzziele (CIANAAA-Sicherheitsziele bzw. Protection-Target-Eigenschaft) |

> SSOT-Hinweis: `dfd.assets` ist der eine Ort, an dem ein erzeugtes Asset lebt. Der
> Asset-Sync leitet daraus `Project.assets`/Reference-Views ab. Ein separater `AssetStore`
> ist damit **nicht** nötig.
>
> **Korrektur (v5):** Diese Annahme ist nur dann tragfähig, wenn der DFD→Assets-Sync auf
> **jedem** Schreibpfad läuft. Tatsächlich gibt es **zwei** Stores (`project.dfd.assets` und
> `project.assets.assets`), und der Sync wurde im Hazard-Pfad übersprungen — Bug „HU-003".
> Faktisch ist `project.assets.assets` (AssetData) das **angereicherte Master-Record**, das
> `dfd.assets` via `syncFromDFD` absorbiert. Die Ziel-Architektur (eine kanonische Quelle,
> Sync im `updateProject`-Chokepoint erzwungen) steht in `TARAflow-asset-store-consolidation.md`.

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

> **Erledigt (v5):** Adapter gebaut — SheetJS `xlsx` (XLSX/XLSM/XLS/ODS) + `papaparse` (CSV).
> Siehe §3.

---

## 6. Services (as-built)

SSOT ist `Project.hazards` (+ `dfd.assets`) über `updateProject` — **keine** separaten
Store-Objekte (`HazardStore`/`AssetStore` aus v2 sind durch dieses Muster ersetzt). Die
Services sind rein und getestet:

> **Korrektur (v5):** Für **Assets** stimmt „`dfd.assets` als SSoT" nur mit erzwungenem
> DFD→Assets-Sync. Read-Konsumenten (Hazard/Threat/Risk) lesen `project.assets.assets` über
> `memoizedAssetDataRef`; wird der Sync übersprungen, stranden Assets (Bug „HU-003", in v5 per
> QF-1 in `handleHazardsUpdate` behoben). Siehe §4.3/§4.4-Korrektur + Konsolidierungs-Doc.

| Service | Zweck |
|---|---|
| `hazardService` | CRUD am Hazard Item (ID-Gen, add/update/delete mit Kaskaden-Kantenentfernung), `getReferencingRelations`, `validate`, `deriveHazardPhaseStatus`, `toUpdateResult` |
| `hazardRelationService` | `contributes_to` / `endangers` add/remove/update (immutabel, idempotent) + `validateContributesTo`/`validateEndangers` (dedizierte Regelmatrix, **nicht** `ALLOWED_A2A_RELATIONS`, da HazardItem keine AssetGroup hat) |
| `hazardValidator` | R-Regeln: ≥1 `contributes_to`, ≥1 `endangers`, `ALL`-mit-1-Eingang-Warnung, dangling edges, Diskriminator-Konsistenz |
| `eligibleAssets(assets, role)` | zulässige Beitrags-/Schutzziel-Assets (treibt die Autocompletes) + `HAZARD_CONTRIBUTOR_GROUPS`/`HAZARD_TARGET_GROUPS` + `targetKindForAssetGroup` |
| `resolveSeverityScale(targetKind)` | ziel-typ-abhängige Severity-Skala für den `endangers`-Editor |
| `shared createAsset` / `addCreatedAssets` | Asset-Erzeugung & Einfaltung (§4) |
| `hazardImporterRegistry` *(v5, gebaut)* | Adapter-Registry (`registerHazardImportAdapters()`); Brücke `SafetyHazard → HazardItem` (§3) |

---

## 7. Offene Entscheidungen — Stand v4

1. ~~Asset-Store-Scope~~ → **entschieden:** reines shared Creation-Primitive, `dfd.assets`
   bleibt SSOT (§4); kein `asset-types.ts`-Umzug, kein zentraler Store.
2. **`groupBy` rechte Spalte:** Schutzziele nach Typ vs. nach Hazard — analog zur linken
   Spalte anbieten? (offen, mit Tripartite Flow.)
3. **System als `endangers`-Ziel:** final **ausgeschlossen** (rechts nur Schutzziele).
4. ~~Excel-Lib-Wahl~~ → **entschieden (v5):** SheetJS `xlsx` (XLSX/XLSM/XLS/ODS) + `papaparse`
   (CSV). Umgesetzt in `services/importer/`.
5. ~~Hazard-Tab-Gating via `safetyMode`~~ → **umgesetzt (v4)** als `ProjectInfoData.safetyRelevant`
   (nicht `settings.safetyMode`); Slide-Switch im Overview-Tab unter dem Criticality-Switch +
   Filter in `phase-tab-bar` + Render-Guard/Redirect in `workspace-layout`.
6. ~~Progress-Phasen-Menge~~ → **umgesetzt (v4):** `PROGRESS_PHASE_IDS` +
   `getProgressPhaseIds(safetyRelevant)` als SSOT in `phase-types.ts`
   (Documentation/Audit/Integration ausgenommen, AttackTree inkludiert, Hazard nur bei Safety).
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
| Import-Brücke `SafetyHazard → HazardItem` | nachgelagert (Feature-Spec) | **umgesetzt (v5)** — profilbasiert, SheetJS |
| Review-Workspace + Cyber-System-Scope (`systemRelevance`) | Phase 5 / Vorstufe Phase 6 | **umgesetzt (v5)** (§10) |
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

---

## 10. Review-Workspace & Cyber-System-Scope (v5)

> Ersetzt den Single-Bowtie-Dialog aus §9.3 durch eine Master-Detail-Review-Sicht. Der
> Bowtie-Editor selbst (§9.3) bleibt als Detail-Teil erhalten.

### 10.1 Konzept

`hazard-dialog.tsx` ist ein **Review-Workspace**: links eine Sidebar über **alle** Hazards
(durchsweepen ohne Open/Close-Churn), rechts Decision-Card + Hazard-Felder + (gegateter) Bowtie.
Eingeführt wird eine **Cyber-System-Scope-Achse auf Hazard-Ebene** (`systemRelevance`):

- `in_scope` — durch Cyberangriff erreichbar → Bowtie modellieren.
- `out_of_scope` — nicht cyber-verursacht; bleibt im Safety-Record, **aus der Bedrohungs-
  ableitung ausgeschlossen** (nicht gelöscht); braucht eine Begründung (`systemRelevanceNote`).
- `unknown` — noch zu prüfen (abgeleitet, kein separates Review-Status-Feld).

Das ist der **Hazard-Level-Rollup** der geparkten Safety-Security-Independence-Analyse
(Phase 6): die kantenfeine SUBSTANTIATED/REFUTED/UNCERTAIN-Bewertung bleibt geparkt, das
Vokabular ist kompatibel.

### 10.2 Flow & UX

- **Decision-Card oben**: Frage „Is this hazard reachable by a cyberattack?", Toggle in/out/unknown,
  Reason-Feld bei `out_of_scope`. Scope wird **nur hier** gesetzt (Sidebar ist Navigation +
  read-only Status, **kein** zweiter Editor).
- **Gate (Option A, progressive disclosure):** Hazard-Felder (Label/Description/Type/PHP/Logik/
  Rationale) sind **immer** sichtbar (auch bei neu angelegten Hazards erst benennen, dann Scope).
  Der **Bowtie** wird **eingeklappt** (nicht ausgegraut), solange nicht `in_scope` — bei
  `out_of_scope` Hinweis „no cyber cause/target modeling needed".
- **Sidebar**: View-Filter (all / needs-review / in_scope / out_of_scope / unknown), „x/total
  reviewed", pro Zeile externalRef-Chip + Scope-Badge + Vollständigkeits-Punkt, alle mit Tooltips.
- **Footer**: links Prev/Next + Index; rechts nur **Unknown → next**, **In scope**, **OK**.
  **Kein Cancel/Save** — Edits leben im Draft, **Commit-on-Close**: OK, Esc und Backdrop rufen
  `commitAndClose` (`onSave(draft, sessionAssets)` + `onClose`), bei fehlendem Pflicht-Label wird
  geschlossen ohne zu speichern.

### 10.3 Modellfelder (`shared/models/hazard-types.ts`)

`HazardItem` erhält: `description?` (Volltext, `label` bleibt Kurzname), `importMeta?:
Record<string,string>` (Provenance aus Extra-Spalten), `systemRelevance?`, `systemRelevanceNote?`.
Kein Tab-seitiger Eingriff nötig — der geklickte Hazard ist die initiale `editingId`.

---

## 11. Tabelle & i18n — Deltas (v5)

**`hazard-table.tsx`:**
- **View-Filter** oben rechts (`active` = out_of_scope ausblenden [Default] / `all` / `out`).
- **Zeilenfarbe nach Review-Status** (ersetzt das reine Vollständigkeits-Signal aus §9.2):
  `out_of_scope` = rot (Default ausgeblendet), `in_scope` = grün (vollständig) / orange
  (unvollständig), nicht geprüft (`unknown`/ungesetzt) = **neutral**.
- **Tooltips** auf allen Spalten (Header `description`) und Zellen; Causes/Targets-Chips zeigen den
  **Klartext-Asset-Namen** + „Asset not found"-Hinweis bei nicht auflösbarer ID.

**i18n** (`hazards`-Namespace erweitert, en+de): `tabs.hazards.import.*` (inkl. `fields.affectedPersons`,
`fields.physicalHazardPotential`, `aliases.*`), `tabs.hazards.review.*` (Scope/Filter/Tooltips),
`tabs.hazards.tip.*` (Tabellen-Tooltips), `tabs.hazards.viewFilter.*`, `common.ok`.

> **§9.1-Korrektur:** der letzte Satz („sobald der Sync sie in `assetDataRef` führt") setzte den
> automatischen Sync voraus — der lief im Hazard-Pfad nicht (§4.3-Korrektur, QF-1).

---

*© Jürgen Messerer · TARAflow · 2026*
