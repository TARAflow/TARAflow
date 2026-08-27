# TARAflow — Asset-Store-Konsolidierung (Umbau-Spec / Handoff)

> **Zweck dieses Dokuments:** Ein neuer Chat soll damit sofort wissen, *was* umgebaut wird, *warum*, *wie weit es ist* und *wie weiterzumachen* ist. Verbindlich sind die **Invarianten** und die **Arbeitsweise** weiter unten — beim Abweichen davon zuerst rückfragen.

Repo: `https://github.com/TARAflow/TARAflow` · Branch: `main` · Stack: Electron + Vite + React + TypeScript, Tests mit Vitest.

---

## 1. Ziel in einem Satz

**Ein einziger Asset-Store.** `project.assets` (Feature-`AssetData.assets`, Typ `Asset`) wird die **einzige Quelle** der Asset-Objekte. Das zweite, gespiegelte Array `project.dfd.assets` (Typ `DFDAsset[]`) wird als **gespeicherte** Struktur entfernt. Element↔Asset-Verknüpfungen leben weiterhin als **Referenzen** in `element.assetRelations[].assetId` (und `connection.assetRelations`).

---

## 2. Warum (Motivation)

Zwei parallele Asset-Stores mussten über mehrere Kanäle bidirektional synchron gehalten werden. Das erzeugte eine ganze **Bug-Klasse**: Assets verschwanden „regelmässig" aus DFD und Asset-Tab, sobald man sie per `is_an`-Relation verknüpfte (die Relation überlebte, das Asset-Objekt fiel raus). Ursachen waren u. a. ein Legacy-„Asset-Marker"-Parsing-Pfad und ein stale-`base`-Overwrite in der Persistenz. Beide **Einzelbugs sind bereits gefixt** (siehe §4). Die Konsolidierung ist die **strukturelle** Heilung: keine zwei Stores → nichts mehr zu synchronisieren → die Bug-Klasse verschwindet.

---

## 3. Architektur-Entscheide (verbindlich)

1. **Kanonisch = Feature-Store** (`project.assets`, Typ `Asset`). Hält *alle* Asset-Felder.
2. **`DFDData` speichert keine Asset-Objekte.** Nur Referenzen (`assetRelations` mit `assetId`) bleiben. Kein gespeichertes `dfd.assets` mehr.
3. **Keine harte Feature-zu-Feature-Kopplung.** `DFDData` darf `Asset`/`AssetData` **nicht** aus `features/assets` importieren. Deshalb wandern die Asset-**Typen** nach `src/shared/models` (geteiltes Vokabular; beide Features zeigen nach *unten* in `shared`, nicht aufeinander). **Nur Typen** wandern — die Asset-**Services** (Impact-Deriver, Sync, Factory) bleiben in `features/assets`.
4. **Auflösung Referenz→Objekt passiert an der App-Naht**, nicht in der DFD-Schicht. Grund: `DFDProjectData` (was `dfd-service` sieht) enthält den Feature-Store **nicht**. Die neutrale Zwischenschicht `src/app/utils/*` darf beide Features importieren — dort lebt die Brücke `deriveDfdAssets(...)`.
5. **Ownership der Felder (Drift-Vermeidung):** DFD besitzt *strukturelle* Felder (`name`, `assetGroup`, Relationen); Asset-Tab besitzt *analytische* Felder (Beschreibung, Impact-Ratings, Schutzziele, aggregierter Impact). Beide schreiben in **denselben** Store, aber in **disjunkte** Feldgruppen. → **OFFENE ENTSCHEIDUNG**, siehe §7.

---

## 4. Bereits erledigt (auf `main` gemergt)

- **Marker-Relikt entfernt** — `asset-parser.ts`, `CoReTM`-Shape-Library gelöscht; Parser leitet keine Assets mehr aus XML ab (`parse().assets === []`). *(Commit „stop is_an assets vanishing after adding a relation" / marker-removal.)*
- **Stale-Base-Fix** — `use-dfd-persistence.ts` wählt `base` per `freshestOf(lastCommittedDfdRef, project.dfd)` nach `lastModified`, damit Fremdkanal-Schreibvorgänge nicht von einem stale Ref überschattet werden. Regressionstest `cross-channel-stale-base-asset-drop.test.ts`. *(Commit `440bd4f`.)*
- **2.1 — `deriveDfdAssets`** *(Commit `1daee54`)* — reine Inverse in `src/app/utils/asset-to-dfd-mapper.ts`: rekonstruiert die `DFDAsset[]`-Form aus dem Feature-Store + Diagramm. `linkedElements` werden aus `assetRelations` **abgeleitet** (nie aus einem Mirror). Feld `assetToAssetRelations` bewusst weggelassen (im Typ deklariert, aber **nirgends** gelesen/geschrieben — totes Feld). 7 Unit-Tests.
- **2.2 — Projektions-Äquivalenz** *(Commit `5bc9eb7`)* — Helfer `dfdSourcedAssets(featureAssets)` (Filter `source==='dfd'`) + Charakterisierungstest `src/tests/regression/dfd-assets-projection-equivalence.test.ts`: beweist gegen **echte** Fixtures (SmokeDetector 19 Assets, cnc-ref 4), dass `deriveDfdAssets(dfdSourcedAssets(feature), elements, connections)` das gespeicherte `dfd.assets` in Menge, Kernfeldern und Links **exakt** reproduziert. → Sicherheitsnetz für §5-Phase 2.4.
- **2.3a-i — Rename** *(Patch erstellt; ggf. schon gemergt)* — die **Asset-Sicht**-DFD-Referenztypen wurden umbenannt, um eine **Namenskollision** mit gleichnamigen Graph-Analyse-Typen in `shared` aufzulösen:
  - `DFDAssetReference` → `AssetDFDAsset`
  - `DFDElementReference` → `AssetDFDElement`
  - `DFDConnectionReference` → `AssetDFDConnection`
  - (in `features/assets/models/dfd-asset-link-types.ts`; Aliase + redundanter Barrel-Block entfernt; Forward-Mapper `app/utils/dfd-to-asset-mapper.ts` umgestellt). Die gleichnamigen **Graph-Analyse**-Typen in `src/shared/models/dfd-reference-types.ts` (`DFDAssetReference {id,name}` etc.) bleiben unangetastet (Threats/Attacktree).

---

## 5. Verbleibende Phasen (von innen nach aussen)

### 2.3a-ii — Typen nach `shared` verschieben *(mechanisch, compiler-verifiziert)*
Voraussetzung: 2.3a-i (Rename) ist gemergt.

- Diese 4 Dateien von `src/features/assets/models/` → `src/shared/models/`:
  `asset-types.ts`, `asset-impact-types.ts`, `asset-security-goals-types.ts`, `dfd-asset-link-types.ts`.
  (Alle 4 zusammen — `asset-types` hängt strukturell an den anderen; Zurücklassen erzeugte einen Zyklus `shared → features`.)
- In den verschobenen Dateien `from "shared"`-Importe auf **relative** Pfade umstellen (`./asset-group-types` für `AssetGroup`/`A2ARelationType`, `./common-types` für `PhaseStatusMap`), sonst Barrel-Zyklus `shared/index → asset-types → shared/index`.
- An den **alten** Pfaden `features/assets/models/*` **Shims** hinterlassen (`export * from "shared/models/…"`), damit Barrel + die wenigen Deep-Importer unverändert laufen.
- Im **shared-Barrel** (`src/shared/index.ts`) nur die **kollisionsfreien** Namen ergänzen: `Asset`, `AssetData`, `AssetConfiguration`, `ImpactRating`, `SecurityGoal`, `AssetProjectData`, `DEFAULT_ASSET_CONFIGURATION`, `SECURITY_GOALS` …
  **Nicht** in den Barrel: `AssetDFDAsset`/`AssetDFDElement`/`AssetDFDConnection` (die Asset-Sicht-DFD-Typen) — nur per Deep-Import `shared/models/dfd-asset-link-types` erreichbar lassen, sonst Verwechslungsgefahr mit den Graph-Typen wieder rein.
- **Gate:** `tsc` grün + volle Testsuite grün. Kein Verhaltens-, nur Strukturänderung.

### 2.3b — DFD von `Asset` entkoppeln
- Sicherstellen, dass `DFDData`/DFD-Schicht **keine** `Asset`-Objekte importiert/speichert. Wo innere Services (Graph-Builder, Stats, Validator, `dfd-service`) eine aufgelöste Liste brauchen, bekommen sie sie als **Parameter** (Typ aus `shared`), nicht aus einem gespeicherten `DFDData.assets`-Feld.
- Entscheidung A vs B (siehe §6) hier umsetzen.

### 2.3c — Schreibrichtung umdrehen + Mirror-Kanäle entfernen ⚠ **Runtime-Gate**
- In `src/app/utils/commit-asset-sync.ts` (einziger Schreibkanal + Load-Backfill) `dfd.assets` zur **Projektion** des Feature-Stores machen: `deriveDfdAssets(dfdSourcedAssets(assets), elements, connections)`.
- Die **Reverse-Mirror** in `src/app/components/layout/workspace-layout.tsx` entfernen: `handleDFDUpdate` (DFD→Feature-Sync), `makeAssetsUpdateHandler` (Name/Desc-Mirror auf `dfd.assets`), `handleHazardsUpdate` (Asset-Fold).
- Idempotenz/Referenz-Guard von `commitAssetSync` mit Tests absichern (bestehende Tests in `commit-asset-sync.test.ts` müssen grün bleiben: „unchanged dfd.assets → skip", „idempotent → same ref").
- ⚠ **Hier ändert sich Laufzeitverhalten.** Unit-Tests fangen ein mögliches Oszillieren mit den Mirror-Kanälen **nicht** vollständig. → **manueller Runtime-Test durch den User** als Gate (Asset im DFD anlegen → per `is_an` verknüpfen → Canvas-Autosave auslösen → Projekt neu laden → Asset überlebt in DFD *und* Asset-Tab).

### 2.4 — Storage droppen + Migration
- `prepareForDisk()` strippt `dfd.assets` (wie `filePath` — runtime-only). Test: gespeichertes JSON hat kein `dfd.assets`.
- Neue Migration `src/app/services/versions/migrate-4-to-5.ts`: etwaige **dfd-only-Assets** (die der Feature-Store nicht kennt) defensiv in den Feature-Store **falten**, dann `dfd.assets` droppen. In `versions/index.ts` registrieren, Branch in `migration-service.ts::applyMigrations` ergänzen, `CURRENT_SCHEMA_VERSION` in `src/app/services/schema-version.ts` von **4 → 5** setzen + Versionsnotiz.
- Tests: Migration idempotent; gegen echte Fixtures (`SmokeDetector.tara.json`, `cnc-ref.tara.json`, `Simple_Test_Project.tara.json`) + einen synthetischen Drift-Fall (Relation referenziert Asset, das nur in `dfd.assets` existiert → muss in den Feature-Store gefaltet werden, nicht verloren gehen).
- Danach `DFDData.assets` aus dem Typ entfernen (oder als deprecated/runtime-only markieren, je nach Entscheidung A/B).

---

## 6. Offene Design-Frage: `DFDData.assets` als Feld behalten oder droppen?

Beide erfüllen „ein Store + keine Hartkopplung"; Unterschied nur, wie die *aufgelöste Runtime-Liste* zu den inneren Services kommt:

- **Option A (kleinster Umbau):** `DFDData.assets` bleibt als **abgeleitetes, nicht-persistiertes** Runtime-Feld (Präzedenz: `filePath` ist genau so „stripped by prepareForDisk"). Innere Service-Signaturen unverändert. Der Feld-**Typ** muss ein DFD-eigener sein (kein `Asset`-Import), sonst Kopplung.
- **Option B (reinste Endform):** Feld ganz weg; Graph/Stats/Validator/`dfd-service` bekommen die Liste als Parameter (Typ aus `shared`). Mehr Signatur-Änderungen, aber `DFDData` komplett asset-objektfrei.

**Empfehlung:** mit A starten (risikoärmer, testbar in kleinen Schritten), B optional nachziehen. *(Der letzte User-Input tendierte in Richtung „Referenz statt Objekt" — das ist mit A/B kompatibel, solange `DFDData` keine `Asset`-Objekte speichert und `Asset` nicht importiert.)*

---

## 7. Offene Entscheidung vom User nötig (vor 2.3c/2.4)

**Ownership-Regel für analytische Felder.** Darf der DFD-Tab nur strukturelle Felder (`name`, `assetGroup`, Relationen) schreiben, und gehören Impact/Schutzziele exklusiv dem Asset-Tab? Ohne klare „wer gewinnt"-Regel für geteilte Felder holt man sich die Drift durch die Hintertür zurück. **Diese Regel bestimmt die Schreibpfade in 2.3c und das Fold-Verhalten des Konverters in 2.4.**

---

## 8. Invarianten (nie verletzen)

- `dfd.assets` ≡ Feature-Assets mit `source==='dfd'` (empirisch gegen echte Fixtures bestätigt). Manual-only Assets (`source==='manual'`) sind **nicht** in `dfd.assets`.
- `linkedElements` wird **immer** aus `element/connection.assetRelations` abgeleitet — **nie** aus einem gespeicherten Mirror (`Asset.linkedDFDElements` / `DFDAsset.linkedElements`). Genau diese Mirrors sind die Drift-Quelle.
- Zur Laufzeit ist der Feature-Store eine **Obermenge** von `dfd.assets` (via `syncFromDFD`-Backfill). Deshalb ist „`dfd.assets` aus dem Feature-Store ableiten" verlustfrei; der Konverter (2.4) deckt Altdaten ab.
- `DFDData` importiert niemals `Asset`/`AssetData` aus `features/assets`.
- Asset-Sicht-Typen heissen `AssetDFD*`; Graph-Analyse-Typen heissen `DFD*Reference` (in `shared`). Nicht wieder vermischen.

---

## 9. Arbeitsweise (verbindlich)

- **Zuerst `git fetch origin && git reset --hard origin/main`** — der User pusht zwischen den Schritten.
- **Testgetrieben, „von innen nach aussen".** Jede Phase mit Tests absichern. Wo Laufzeitverhalten kippt (2.3c), **manueller Runtime-Test durch den User** als Gate — nicht blind mergen.
- **Kleine, in sich geschlossene Schritte**, je als eigener Commit + eigener Download-Patch. Commit-Messages im Repo-Stil (`fix(dfd): …`, `refactor(assets): …`, mehrzeilig mit Begründung).
- **Nichts „aufräumen" ohne Auftrag.** Vorbestehende Dubletten/Altlasten separat behandeln, nicht in einen anderen Schritt bündeln.
- **Lokale Testumgebung:** `npm install` scheitert an `xlsx` von `cdn.sheetjs.com` (nicht in der Netz-Allowlist). Workaround **nur lokal**: `xlsx` temporär aus `package.json` entfernen, `package-lock.json` löschen, `npm install`, Tests laufen lassen — danach `package.json`/`package-lock.json` **wiederherstellen** (nie in den Patch aufnehmen). Fehlschläge in `hazards`-Tests, die *nur* `Cannot find module 'xlsx'` sagen, sind umgebungsbedingt, **nicht** durch die Änderung.
- **Verifikation je Schritt:** `npx tsc --noEmit -p tsconfig.json` (den bekannten xlsx-Fehler ausfiltern) + betroffene Vitest-Suites. Volle Suite ist gross (~150 Dateien) und läuft ggf. ins Zeitlimit → in Batches.

---

## 10. Wichtige Dateien / Orte

| Zweck | Pfad |
|---|---|
| Feature-Asset-Typen (`Asset`, `AssetData`) | `src/features/assets/models/asset-types.ts` |
| Asset-Sicht-DFD-Typen (`AssetDFD*`, `DFDElementLink`) | `src/features/assets/models/dfd-asset-link-types.ts` |
| Graph-Analyse-Refs (`DFD*Reference`) | `src/shared/models/dfd-reference-types.ts` |
| `DFDAsset` (zu entfernendes Storage-Modell) | `src/features/dfd/models/dfd-asset-types.ts` |
| Brücke Feature→DFDAsset (2.1) + `dfdSourcedAssets` (2.2) | `src/app/utils/asset-to-dfd-mapper.ts` |
| Forward-Mapper DFD→Feature | `src/app/utils/dfd-to-asset-mapper.ts` |
| Sync-Chokepoint (App-Naht) | `src/app/utils/commit-asset-sync.ts` |
| Reverse-Mirror-Kanäle | `src/app/components/layout/workspace-layout.tsx` |
| Persistenz-Hook (`freshestOf`, base-Auswahl) | `src/features/dfd/hooks/use-dfd-persistence.ts` |
| Sync-Service (`syncFromDFD`, `source`-Prune) | `src/features/assets/services/asset-sync-service.ts` |
| Migrations-Framework | `src/app/services/migration-service.ts`, `src/app/services/versions/`, `src/app/services/schema-version.ts` |
| Disk-Serialisierung (Strip) | `src/app/services/prepare-for-disk.ts` |
| Projekt-Typ | `src/app/models/project-types.ts` |
| Test-Fixtures (echte Projekte) | `src/tests/fixtures/` (`SmokeDetector.tara.json`, `cnc-ref.tara.json`, `Simple_Test_Project.tara.json`) |
| Schon vorhandene Sicherheitsnetz-Tests | `src/tests/regression/dfd-assets-projection-equivalence.test.ts`, `src/tests/unit/app/utils/asset-to-dfd-mapper.test.ts`, `src/tests/unit/app/utils/commit-asset-sync.test.ts` |

---

## 11. Nächster konkreter Schritt

**2.3a-ii** (Typen-Move nach `shared`) — sobald der Rename-Commit (2.3a-i) auf `main` ist. Vorgehen exakt wie in §5/2.3a-ii. Danach 2.3b (Entkopplung), dann 2.3c (Flip + Mirror-Entfernung, **mit User-Runtime-Test**), dann 2.4 (Strip + `migrate_4_to_5` + Schema-Bump).
