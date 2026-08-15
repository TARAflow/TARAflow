# TARAflow — Asset Stores: Single Source of Truth & Hazard-Verknüpfung (v2)

> Design- und Refactoring-Dokument. Prosa Deutsch, alle Identifier/Typen/Code englisch.
> Ziel: die mehrfachen Asset-Definitionen und die zwei beschreibbaren Stores auf **eine
> Quelle der Wahrheit** (`AssetData`) zusammenführen — und den Asset-Tab um die neue
> **HazardItem**-Beziehung erweitern.
>
> **v2-Konsolidierung:** Basis ist `asset-store-ssot-refactor.md`. Eingearbeitet wurden die
> brauchbaren Teile aus `TARAflow-asset-store-consolidation.md` (Golden-Baseline-Phase,
> `commitProject`-Chokepoint, Performance-Guard, „Safe-Stop"-Markierung, Status-quo-Abschnitt)
> sowie Befunde aus dem Code-Review (§3), die in beiden v1-Dokumenten fehlten. Es gibt ab hier
> **eine** eingefrorene Phasen-Nummerierung (Mapping v1→v2 im Anhang A).

---

## 1. Motivation

Der konkrete Auslöser: import-geminteten Human-Targets (`HU-002`, `HU-003`, …) erschienen im
**DFD-Tab** mit Namen, aber **nicht** im Hazard-/Threat-/Risk-Kontext (`Asset not found —
showing ID only`). Ursache war keine Tabellen- oder Typ-Frage, sondern ein **Split-Brain
zweier Stores**: die Assets wurden in `project.dfd.assets` gefaltet, aber `assetDataRef` baut
aus `project.assets.assets`, und der DFD→Assets-Sync wurde am Hazard-Schreibpfad übersprungen.

Der Quick Fix (Sync im `handleHazardsUpdate` nachziehen, QF-1) behebt das Symptom. Dieses
Dokument beschreibt die **Wurzelbehandlung**: solange es zwei beschreibbare Stores plus
manuell auszulösenden Sync gibt, ist die nächste Lücke nur eine Frage der Zeit — und §3 zeigt,
dass diese „nächste Lücke" bereits existiert (zweiter Doppelschreib in der
`asset-description-form`).

---

## 2. Bestandsaufnahme (Ist-Zustand)

### 2.1 Asset-Formen (vier)

| Typ | Ort | Felder (Kern) | Zweck |
|-----|-----|---------------|-------|
| `CreatedAsset<G>` | `shared/services/asset-creation.ts` | `id, displayId, name, assetGroup, protectionNeed?` | Reiner, dependency-freier **Erzeugungs-Seed** (id-Schema + Minimal-Record). |
| `AssetReference` | `shared/models/asset-reference-types.ts` | `id, name, assetGroup, hasSafetyAnnotation?, + optional impact/securityGoals/impactRatings/linkedElementIds` | **Read-Snapshot** für Threat/Risk/Hazard-Dialoge (Dependency Inversion). |
| **`DFDAsset`** | `features/dfd` (`project.dfd.assets`) | `id, displayId, name, description?, assetGroup, protectionNeed?, linkedElements?: ElementRelation[], assetToAssetRelations?: AssetToAssetRelation[], properties?: AssetProperties` | Asset wie es im **Graphen** lebt. `addCreatedAssets()` schreibt hierhin. |
| **`Asset` / `AssetData`** | `features/assets` (`project.assets.assets`) | `id, numericId, name, assetGroup, source, syncedWithDFD, linkedDFDElements, properties{…}, securityGoals, impactRatings, overallImpact, aggregatedImpact, physicalImpact, physicalImpactSource, lastModified` | Das **reiche Analyse-Modell** (Asset-Tab). Quelle für `AssetReference`. |

> **Korrektur gegenüber v1:** `DFDAsset` ist **kein** dünner Record. Es trägt
> `properties?: AssetProperties` (ein dicker kategoriespezifischer Block) und
> `assetToAssetRelations`. v1 listete nur `… linkedElements[…]` und unterschätzte damit den
> Umfang des Property-Umzugs (siehe §3.2 und Phase 4).

### 2.2 Stores (zwei beschreibbare)

- **`project.dfd.assets`** — DFD-Store. Der DFD-Tab liest/zeigt hier. Asset-*Identität* (id,
  name, group) entsteht heute hier (Canvas) **und** über `addCreatedAssets()` (Hazard-Import,
  Bowtie-Quick-Capture). Hält über `DFDAsset.properties` zusätzlich die **reichen
  Kategorie-Daten** (§3.1).
- **`project.assets.assets`** (`AssetData`) — Analyse-Store. `memoizedAssetDataRef` und damit
  alle Threat/Risk/Hazard-Konsumenten lesen **ausschließlich** hier. Enthält zusätzlich
  **manuelle** Assets (`source: "manual"`), die es im DFD gar nicht gibt → bereits heute eine
  **Obermenge bei den Records**, aber **nicht** bei den Properties (§3.2).

### 2.3 Mapper & Sync (der Klebstoff)

| Funktion | Ort | Richtung |
|----------|-----|----------|
| `createAsset()` | `shared/services/asset-creation.ts` | → `CreatedAsset` |
| `addCreatedAssets(dfd, created)` | `features/dfd/services/dfd-asset-creation.ts` | `CreatedAsset[]` → `dfd.assets` |
| `mapDFDAssetsToAssetFeature()` u. a. | `app/utils/dfd-to-asset-mapper.ts` | `DFDAsset` → `DFDAssetReference` (Sync-Input) |
| `syncFromDFD(assetData, dfdAssets, …)` | `features/assets/services/asset-sync-service.ts` | **`dfd.assets` → `AssetData`** (Create/Update/Remove) |
| `memoizedAssetDataRef` | `app/.../workspace-layout.tsx` | `AssetData` → `AssetReference[]` |
| `extractAssetReferences(project)` | `features/attacktree` (re-exportiert) | weitere `AssetReference`-Projektion |
| `seedToRef` (entfernt) | hazard-tab | `CreatedAsset` → `AssetReference` |

### 2.4 Duplikat-Inventar (Tech-Debt, Phase 1)

Konkret im Code gefunden — reine Duplikate ohne Persistenz-Semantik, compiler-geführt
entfernbar:

- **`AssetGroup`** (Union-Literal) doppelt definiert: `shared/models/asset-group-types.ts`
  **und** `features/dfd/models/asset-relation-types.ts`. (`asset-color-constants.ts`
  re-exportiert korrekt aus `shared`.)
- **`A2ARelationType`** doppelt definiert: `shared/models/asset-group-types.ts` **und**
  `features/dfd/models/asset-relation-types.ts` (`dfd-types.ts` re-exportiert die dfd-Variante).
- **id-Helper** (`parseAssetId`, `generateNextAssetId`, `renumberAssets`, `createEmptyAsset`,
  `createDefaultAssetData`) **doppelt** in `features/assets/models/asset-types.ts` **und**
  `features/assets/services/asset-factory.ts`. Live ist `asset-factory.ts`
  (`asset-sync-service` importiert von dort); die Kopien in `asset-types.ts` sind tot.

### 2.5 Wo es bricht

`syncFromDFD` ist **einseitig** (DFD → AssetData) und muss an **jedem** Schreibpfad, der
`dfd.assets` verändert, **manuell** ausgelöst werden. Genau das wurde im Hazard-Handler
vergessen. Damit ist die Invariante „beide Stores sind konsistent" nirgends erzwungen — sie
ist Disziplin, kein Mechanismus.

**Kernbefund:** Zwei beschreibbare Stores + manuell getriggerter, einseitiger Sync =
strukturell fehleranfällig. Es gibt keine echte Single Source of Truth.

---

## 3. Code-Befunde (neu in v2 — in keinem v1-Dokument)

Diese vier Befunde aus dem Review präzisieren den Umfang und korrigieren eine zu optimistische
Annahme in v1 („`AssetData` ist bereits die reichste Obermenge").

### 3.1 `DFDAsset.properties` wird aktiv befüllt — und vom Sync verworfen

Die `asset-description-form.tsx` operiert auf `asset: DFDAsset` mit
`onChange: (changes: Partial<DFDAsset>) => void` und schreibt `properties` (`AssetProperties`)
auf den **DFD-seitigen** Record. Die reiche Kategorie-Information (Data/Function/Process/…/Human)
lebt also heute in `dfd.assets`.

`syncFromDFD` liest aus dem `DFDAsset` aber nur `name`, `assetGroup`, `description`,
`protectionNeed`, `linkedElements` — **`dfdAsset.properties` wird komplett ignoriert**. Beim
Sync DFD → AssetData geht die gesamte Kategorie-Information also verloren bzw. erreicht
`AssetData`/`AssetReference` nie.

### 3.2 Zweite Split-Brain-Stelle: manueller Doppelschreib in der Form

Die Form hat zusätzlich zu `onChange` einen optionalen, untypisierten Spiegel:

```ts
onAssetFeatureUpdate?: (assetId: string, updates: { name?: string; properties?: any }) => void;
```

Sie schreibt also dieselben Properties **von Hand** in beide Stores. `optional` heißt:
vergisst ein Aufrufer ihn, driften die Stores. `properties?: any` heißt: kein Compiler-Schutz,
dass die zwei Property-Bags überhaupt zusammenpassen — was sie nicht tun (§3.3). Das ist
dieselbe Bug-Klasse wie `HU-003`, nur an einer zweiten Stelle. → Entfällt in Phase 5/6.

### 3.3 Zwei divergente Property-Bags (nicht eine Obermenge)

`DFDAsset.properties` (`AssetProperties`) und `Asset.properties` sind **verschiedene** Schemata
mit überlappenden, teils widersprüchlichen Feldern:

- Nur auf `DFDAsset.properties`: `isSafetyFunction`, `automationLevel`, `responsibility`,
  `role`, `confidentialityImpact`/`integrityImpact`/`availabilityImpact`, `secureStorage`,
  `businessSecret`, `personalData`, `aggregatedCriticality`, `strideDepth`, `externalRefs`, …
- Nur auf `Asset.properties`: HVA-Block (`isHighValueAsset`, `replacementLeadTime`,
  `vendorDependency`, `spareAvailability`, `highValueRationale`, `assetDestructionImpact`),
  `dataClassification`, `retentionPeriod`, …
- **Typkonflikt** bei gleichnamigen Feldern: `dataType` ist `AssetDataType[]` (DFD-Seite) vs.
  `string` (Asset-Seite); `isSecureStorage`/`secureStorage`, `isBusinessSecret`/`businessSecret`,
  `isPersonalData`/`personalData` sind dasselbe Konzept unter verschiedenen Namen.

**Konsequenz:** v1s „nimm den reichsten Record als SoT" greift zu kurz. Die Konsolidierung ist
ein **Schema-Merge** (zwei Property-Bags zu einem kanonischen, typisierten Schema), nicht eine
Auswahl. Das ist der eigentliche inhaltliche Aufwand → eigene Phase 4.

### 3.4 Safety-Projektion: Lücke verifizieren

`mapDFDAssetsToAssetFeature` überträgt `linkedElements[].safety` nicht — und
`DFDAsset.linkedElements` (`ElementRelation`) besitzt gar kein `safety`-Feld. Damit wäre
`linkedDFDElements[].safety` in `AssetData` durchgehend `undefined` →
`hasSafetyAnnotation` immer `false` → Safety-Chip und Safety-Kriterium-Auto-Add feuern nie aus
DFD-Assets. Entweder läuft Safety über einen anderen Pfad (Element-`assetRelations` mit
`SafetyAnnotation`), oder das ist eine latente Lücke. → **Test-Ziel in Phase 0**, bevor wir
irgendetwas anfassen.

---

## 4. Zielbild (Soll)

### 4.1 Prinzip: ein beschreibbarer Record, N read-only Projektionen

`project.assets.assets` (`AssetData`) wird die **einzige beschreibbare** Asset-Quelle. Jedes
Feature bekommt nur die Projektion, die es braucht. Threat/Risk/Hazard machen das heute schon
(`AssetReference`); die einzige Verletzung ist, dass DFD ein **zweiter beschreibbarer**
Asset-Store ist. Wir entfernen die Ausnahme, wir erfinden kein Muster.

Begründung für `AssetData` als SoT:

- Es enthält schon heute Records, die **nicht** im DFD existieren (`source: "manual"`).
- Analyst-Eingaben (Impact-Ratings, manuelle `physicalImpact`-Overrides) lassen sich **nicht**
  aus dem DFD ableiten — der DFD kann daher gar nicht die SoT für Asset-*Records* sein.
- Es ist das, was Threat/Risk/Hazard ohnehin konsumieren.
- **Aber:** bei den *Properties* ist es heute noch keine Obermenge (§3.3) — Phase 4 macht es
  dazu.

### 4.2 Rollen nach dem Umbau

- **`Asset` / `AssetData`** → kanonischer Asset-Record (einzige Wahrheit, persistiert), inkl.
  vereinheitlichtem Property-Schema.
- **DFD-Graph** → hält **keine** eigenen Asset-Records mehr, sondern **Verknüpfungen**
  (`elementId → assetId` + relationType + Canvas-Platzierung). Name/Group werden aus dem
  kanonischen Asset **projiziert**, nicht dupliziert.
- **`AssetReference`** → bleibt die **read-only Projektion** für Threat/Risk/Hazard.
- **`CreatedAsset`** → nur noch **internes** Übergabeformat zwischen Erzeugung und sofortiger
  Materialisierung in `AssetData`; nie ein eigener Store.

### 4.3 Datenfluss (Ziel)

```
            createAsset()  ─┐
  Asset-Tab (manuell)  ────┼──►  AssetData (SoT, persisted)
  DFD-Canvas (create)  ────┘            │
  Hazard-Bowtie/Import ────┘            │  pure projections (read-only, nie gespeichert)
                                        ├──►  AssetReference[]    (Threat/Risk/Hazard)
                                        ├──►  DFD asset view      (name/group by id)
                                        └──►  AssetHazardSummary  (Asset-Tab, §6)
```

Kein bidirektionaler Sync mehr — weil es nur **einen** beschreibbaren Store gibt. Der heutige
`syncFromDFD` kollabiert zu einer **reinen Projektion** (DFD-Links → abgeleitete Asset-Felder).

### 4.4 Verworfene Alternative: `AssetCore` in `shared`

`consolidation.md` (v1) schlug einen neuen gemeinsamen Kern-Typ `AssetCore`
(`id, name, assetGroup, protectionNeed?`) in `shared` plus einen `addAsset()`-Chokepoint vor.
**Verworfen**, weil ein zweiter Kern-Typ in `shared` eine *fünfte* Asset-Form einführt — genau
das, was wir reduzieren wollen. `Asset` **ist** der Kern; `createAsset()` materialisiert direkt
über die bestehende Factory (`createEmptyAsset`). Festgehalten als bewusste Entscheidung, falls
die Frage später wieder aufkommt.

---

## 5. Migration (phasenweise) — kanonische Nummerierung v2

Jede Phase ist für sich mergebar und lässt das System lauffähig. Risiko/Test pro Phase.
**Safe-Stop nach Phase 2:** danach ist die Bug-Klasse (gestrandete Assets) eliminiert; wenn die
Kapazität ausgeht, kann man hier sauber anhalten.

### Phase 0 — Golden-Baseline (Netz, zuerst)

**Ziel:** ein Regressionsnetz, bevor irgendetwas am Asset-Modell angefasst wird.

- Characterization-/Snapshot-Tests, die für 1–2 Fixture-Projekte (Rauchmelder-Referenzfall +
  ein Multi-Group-Fall) den **exakten `AssetReference[]`-Output** und die **Impact-Ableitung**
  (`overallImpact`, `physicalImpact`, `aggregatedImpact`, `hasSafetyAssets`) festschreiben.
- Snapshot für `syncFromDFD` (new/update/remove, `hasChanges`-Gate, Safety-Kriterium-Auto-Add)
  und für die `memoizedAssetDataRef`-Projektion.
- **Befund §3.4 hier pinnen:** Test, ob `hasSafetyAnnotation` aus DFD-Safety überhaupt `true`
  werden kann.

**Risiko:** keins (nur Tests). **Test:** _ist_ der Test.

### Phase 1 — Duplikate eliminieren

**Ziel:** Tech-Debt aus §2.4 weg, eine Definition pro Typ/Helper.

- Ein `AssetGroup` (aus `shared`); die Kopie in `features/dfd/models/asset-relation-types.ts`
  löschen und aus `shared` importieren.
- Ein `A2ARelationType` (aus `shared`); die dfd-lokale Kopie löschen.
- Ein id-Helper-Satz: `asset-factory.ts` ist SoT; die toten Kopien in `asset-types.ts` entfernen
  (oder als Re-Export belassen, dann in einem zweiten Schritt callsites umziehen).

**Risiko:** gering (compiler-geführt, reversibel). **Test:** Typprüfung grün; Golden-Tests
(Phase 0) unverändert.

### Phase 2 — Sync zentralisieren + Backfill  ✅ *Safe-Stop*

**Ziel:** kein Schreibpfad kann den DFD→Assets-Sync mehr „vergessen".

- Den Sync **im `updateProject`-Chokepoint** erzwingen (nicht pro Tab). `updateProject`
  (`use-project-manager.ts`) ist das eindeutige Schreibtor — Kommentar dort: „Core write
  channel — all feature tab handlers call this".

  ```ts
  // use-project-manager.ts — innerhalb updateProject, vor setProjects/Persistenz
  const updateProject = useCallback(async (next: Project): Promise<void> => {
    const prev = projectsRef.current.find((p) => p.id === next.id);
    const committed = commitAssetSync(prev, next); // siehe unten
    // … restlicher Body nutzt `committed` statt `next`
  }, [syncProjectToStorage]);
  ```

  ```ts
  // app-Schicht (pure). Mapper liegen in app/utils — keine Layer-Verletzung.
  function commitAssetSync(prev: Project | undefined, next: Project): Project {
    // Performance-Guard: nur laufen, wenn sich dfd.assets wirklich geändert hat
    if (prev?.dfd?.assets === next.dfd?.assets || !next.assets) return next;
    const { assetData } = syncFromDFD(
      next.assets,
      mapDFDAssetsToAssetFeature(next.dfd?.assets ?? []),
      mapDFDElementsToAssetFeature(next.dfd?.elements ?? []),
      mapDFDConnectionsToAssetFeature(next.dfd?.connections ?? []),
    );
    return { ...next, assets: assetData };
  }
  ```

- **Backfill** beim Projekt-Load (`loadProjects`/`handleOpenFromFile` in `use-project-manager.ts`,
  idempotent via `hasChanges`-Guard), um Altlasten zu heilen (`environment`-Erweiterung,
  gestrandete Hazard-Humans).
- QF-1 in `handleHazardsUpdate` wird damit überflüssig (zentral abgedeckt) — bleibt, bis Phase 2
  steht, dann entfernen.

**Risiko:** gering. `syncFromDFD` ist durch `hasChanges` + den Ref-Guard ein No-Op, wenn nichts
driftet. **Test:** Import → ohne Asset-Tab-Besuch erscheinen Humans in `assetDataRef`;
reload-fest; Golden-Tests unverändert.

### Phase 3 — HazardItem-Verknüpfung im Asset-Tab (§6)

**Ziel:** Asset-Tab zeigt `endangers`/`contributes_to`-Bezüge; Safety-Chip auch aus Hazard-Ziel.

Additiv, niedriges Risiko, sichtbarer Mehrwert. Details in §6. Bewusst **nach** Phase 2, damit
die Verknüpfung nicht erneut auf gestrandete IDs trifft (§6.5).

**Risiko:** gering (rein additiv). **Test:** Hazard-`endangers` → Asset zeigt „endangered by" +
Safety-Chip; `buildAssetHazardLinks` deckt beide Rollen ab.

### Phase 4 — Property-Schema & Erzeugungs-Seed vereinheitlichen

**Ziel:** ein kanonisches, **typisiertes** Property-Schema auf `Asset`; ein Erzeugungspfad.

- `AssetProperties` (DFD-Seite) und `Asset.properties` zu **einem** Schema auf dem kanonischen
  `Asset` zusammenführen (§3.3): Namens-/Typkonflikte auflösen (`dataType`-Array vs. -String;
  `secureStorage`/`isSecureStorage` etc.), HVA + Kategorie-Felder + CIANAAA unter ein Dach.
- `asset-description-form` auf den **kanonischen** Record zeigen lassen
  (`onChange: Partial<Asset>`); den `onAssetFeatureUpdate`-Doppelschreib (§3.2) entfernen.
- `createAsset()` bleibt dependency-frei, liefert aber einen Seed, der **direkt** über
  `createEmptyAsset` zu einem kanonischen `Asset` materialisiert wird. `protectionNeed` →
  kanonisches Feld (`properties.protectionNeed` / HVA), damit Kritikalität nicht verloren geht.
- `CreatedAsset` nur noch internes Übergabeformat (verlässt die Erzeugungsschicht nicht mehr).

**Risiko:** mittel (Schema-Merge berührt Form + Persistenz-Shape). **Test:** Quick-Capture und
Import erzeugen identische Asset-Records; Form-Eingaben landen in `AssetReference`; Golden-Tests
(ggf. mit bewusst angepasstem Snapshot) unverändert in der Ableitung.

### Phase 5 — DFD referenziert Asset-IDs (gated, höchstes Risiko)

**Ziel:** `dfd.assets` als **Record-Store** auflösen; der Graph hält nur noch Links.

- DFD-Asset-Knoten speichern nur `assetId` (+ Platzierung). Name/Group per Projektion aus
  `AssetData`.
- DFD-Canvas-Erzeugung schreibt **zuerst** in `AssetData` (Phase-4-Factory), dann referenziert
  der Knoten die neue id. `addCreatedAssets()` entfällt.
- **Persistenz-Migration** für Altprojekte: `dfd.assets` → `assetData` übernehmen (inkl.
  `properties` aus Phase 4), dann `dfd.assets` auf Referenzen reduzieren. Schema-Version bumpen,
  Backup-Datei wie beim bestehenden Migrationspfad (`handleOpenFromFile` zeigt `_migrated`).

**Risiko:** hoch (DFD-UX, Persistenz). **Hinter dem Golden-Net + Snapshot-Migrationstest.**
**Test:** Snapshot-Migration eines Altprojekts; Canvas-Create/Delete/Rename spiegelt sich in
`AssetData`.

### Phase 6 — Sync → reine Projektion, Typen aufräumen

**Ziel:** der dokumentierte Endzustand.

- `syncFromDFD` (Record-Create/Update/Remove) entfällt. Was bleibt, ist die **Link-Projektion**:
  Element-Verknüpfungen aktualisieren abgeleitete Felder (`physicalImpact`, `aggregatedImpact`,
  `hasSafetyAnnotation`) **aus** dem Graphen — read-only, deterministisch.
- Doppelte `AssetReference`-Erzeugung (`memoizedAssetDataRef` vs. `extractAssetReferences`) auf
  **eine** `toAssetReference()`-Projektion zusammenführen.
- Tote `mapDFD*ToAssetFeature`-Reshaper entfernen oder auf reine Projektionen schrumpfen.

**Risiko:** gering–mittel (Aufräumen nach erfolgter Verlagerung; Ableitung muss korrekt bleiben).
**Test:** Golden-Tests gegen Impact-Ableitung; keine toten Mapper; ein einziger
`toAssetReference()`-Pfad.

---

## 6. `features/assets` erweitern: HazardItem-Verknüpfung im Asset-Tab

### 6.1 Motivation

Heute leitet der Asset-Tab einen **Safety-Chip** allein aus der **DFD-Safety-Annotation** ab
(`hasSafetyAnnotation` bzw. `physicalImpact`). Mit Phase 1 des TARA-Workflows gibt es nun
**`HazardItem`** + Kanten:

- `endangers`: `from: hazardId → to: assetId` (Asset ist **Schutzziel**, mit Schwere auf der Kante).
- `contributes_to`: `from: assetId → to: hazardId` (Asset ist **Ursache**).

Damit ist ein Asset auch dann safety-/hazard-relevant, wenn es **Ziel** einer Gefährdung ist —
unabhängig von einer DFD-Safety-Annotation. Diese Beziehung soll im Asset-Tab sichtbar werden.

### 6.2 Neue Projektion: per-Asset Hazard-Summary

Da Features sich **nicht** gegenseitig importieren dürfen, wird die Hazard-Beziehung wie schon
bei Assets über **Referenz-Typen in `shared`** projiziert und von der App-Schicht (analog
`memoizedAssetDataRef`) berechnet und als Prop in den Asset-Tab gereicht.

**Neue Typen (`shared`):**

```ts
// shared/models/asset-hazard-reference-types.ts
export interface AssetHazardLink {
  hazardId: string;
  externalRef?: string;          // human-readable id, e.g. "03.01"
  label: string;
  role: "endangered" | "cause";  // endangers-target vs contributes_to-cause
  severity?: string;             // HumanHarmSeverity | HazardSeverity (on endangers edges)
}

export interface AssetHazardSummary {
  endangeredBy: AssetHazardLink[];
  contributesTo: AssetHazardLink[];
  worstSeverity?: string;        // worst across endangeredBy (for the chip)
  isHazardTarget: boolean;       // endangeredBy.length > 0
}
```

**Projektion (App-Schicht, pure):**

```ts
// builds Record<assetId, AssetHazardSummary> from the hazard graph.
// Pure, no feature import — consumes HazardData passed by the app layer.
function buildAssetHazardLinks(hazards: HazardData): Record<string, AssetHazardSummary>;
```

- `endangers.to` → `endangeredBy` des Asset (+ `severity` von der Kante).
- `contributes_to.from` → `contributesTo` des Asset.
- `worstSeverity` = höchste Schwere über `endangeredBy` (gleiche Rang-Heuristik wie die
  `Max Severity`-Spalte der Hazard-Tabelle — Heuristik nach `shared` ziehen, damit beide
  Tabellen dieselbe Ordnung nutzen).

Die App-Schicht reicht `Record<assetId, AssetHazardSummary>` (oder direkt am
`AssetDataReference` ergänzt) an den Asset-Tab.

### 6.3 Safety-Chip erweitern

Bisher: `isSafetyRelevant = hasSafetyAnnotation || physicalImpact !== undefined`.

Neu: **zusätzlich** `|| summary.isHazardTarget`. Ein Asset, das Ziel einer Gefährdung mit
Human-Harm-Schwere ist, ist safety-relevant — auch ohne DFD-Annotation. Tooltip des Chips
nennt die Quelle (Annotation vs. Hazard-Ziel) und ggf. die schlimmste Schwere.

> Konsistenz mit `hasSafetyData()` (`shared`): dort denselben Hazard-Ziel-Fall berücksichtigen,
> damit „Safety-Kriterium automatisch aktivieren" auch durch Hazard-Ziele ausgelöst wird,
> nicht nur durch Annotationen.

### 6.4 UI: neue Spalte/Chips im Asset-Tab

- **Neue Spalte „Hazards"**: Anzahl `endangeredBy` (+ ggf. `contributesTo`), als Chip mit
  `worstSeverity`-Farbe (gleiche `RANK_COLOR`-Skala wie die Hazard-Tabelle). Tooltip listet die
  Hazards (`externalRef` + `label`, Rolle, Schwere) — analog zu den Asset-Chip-Tooltips der
  Hazard-Tabelle.
- **Detail/Drawer**: Abschnitt „Linked hazards" mit zwei Gruppen (Endangered by / Contributes to)
  und Klick-Navigation zum Hazard (optional).
- **Safety-Chip**: Logik wie §6.3; Tooltip nennt Annotation **und/oder** Hazard-Ziel.

### 6.5 Abhängigkeit zur SoT-Bereinigung

Diese Erweiterung **profitiert direkt** von §4/Phase 5: Hazard-Kanten zeigen auf Asset-IDs.
Solange es zwei Stores gibt und geminteten Humans driften, zeigen die `endangers`-Kanten auf
IDs, die der Asset-Tab gar nicht kennt (der `HU-003`-Effekt). Mit zentralisiertem Sync
(Phase 2) teilen Assets und Hazards verlässlich denselben id-Raum. **Deshalb Phase 3 erst nach
Phase 2.**

---

## 7. Reihenfolge & Risiken

1. **Phase 0** (Golden-Baseline) — kein Risiko, Voraussetzung für alles Weitere. *Zuerst.*
2. **Phase 1** (Duplikate) — gering, sofortiger Dup-Abbau, compiler-geführt.
3. **Phase 2** (Sync zentralisieren + Backfill) — gering, schließt die Bug-Klasse. ✅ *Safe-Stop.*
4. **Phase 3** (Hazard-Verknüpfung) — additiv, gering, sichtbarer Mehrwert.
5. **Phase 4** (Property-Schema + Seed) — mittel; der eigentliche Schema-Merge.
6. **Phase 5** (DFD referenziert IDs) — **höchstes** Risiko; Persistenz-Migration + Tests.
7. **Phase 6** (Sync → Projektion, Aufräumen) — gering–mittel, nach Phase 5.

**Querschnitt-Risiken:** Persistenz-Migration bestehender Projekte (Phase 5); Erhalt der
abgeleiteten Impact-Werte (Phase 4/6); Threat/Risk-Konsumenten dürfen sich nicht ändern
(Golden-Tests gegen `AssetReference`-Output vor/nach jeder Phase). **Niemals Phase 5 vor
Phase 2.**

---

## 8. Definition of Done

- Es gibt **genau einen** beschreibbaren Asset-Store (`AssetData`); alles andere ist read-only
  Projektion.
- Asset-Erzeugung (Canvas, Bowtie, Import) läuft über **einen** Pfad; `CreatedAsset`/`seedToRef`/
  `addCreatedAssets` existieren nicht mehr als parallele Record-Quellen.
- **Ein** kanonisches, typisiertes Property-Schema auf `Asset`; der `onAssetFeatureUpdate`-
  Doppelschreib ist entfernt; `properties: any` existiert nicht mehr.
- Kein manuell zu triggernder bidirektionaler Sync mehr; DFD↔Assets ist eine Projektion.
- Der Asset-Tab zeigt **HazardItem-Verknüpfungen** (Spalte + Chip + Tooltip) und leitet den
  Safety-Chip aus Annotation **und** Hazard-Ziel ab.
- `AssetReference` wird über **eine** Projektionsfunktion erzeugt (kein `memoizedAssetDataRef`
  vs. `extractAssetReferences`-Dual mehr).
- Duplikate aus §2.4 sind eliminiert (eine `AssetGroup`, ein `A2ARelationType`, ein id-Helper-Satz).
- Golden-Tests: `AssetReference`-Output und Impact-Ableitung unverändert (bzw. bewusst und
  dokumentiert angepasst) gegenüber dem Stand vor dem Refactor.

---

## 9. Status quo — was schon erledigt ist

- **QF-1** in `handleHazardsUpdate`: zieht `syncFromDFD` nach Hazard-Mint nach — deckt **neue**
  Importe ab. Wird durch Phase 2 (zentraler Chokepoint) abgelöst.
- **Backfill-Idee** beim Project-Load: heilt **bestehende** gestrandete Assets. Wird in Phase 2
  formalisiert und bleibt als Netz auch danach sinnvoll.
- **`hasSafetyAnnotation?` optional** + `seedToRef` entfernt: erste Schritte Richtung
  Typ-Schichtung; entlasten Phase 4.

---

## Anhang A — Phasen-Mapping v1 → v2

| v2 | Inhalt | `ssot-refactor.md` (v1) | `consolidation.md` (v1) |
|----|--------|--------------------------|--------------------------|
| **0** | Golden-Baseline | (in „Test:"-Zeilen verteilt) | Phase 0 |
| **1** | Duplikate eliminieren | — | (in Phase 3/5 angedeutet) |
| **2** | Sync zentralisieren + Backfill | Phase 0 | Phase 2 |
| **3** | Hazard-Verknüpfung (§6) | §5 | §5 |
| **4** | Property-Schema + Seed | Phase 1 | Phase 1 + 3 (teilw.) |
| **5** | DFD referenziert IDs | Phase 2 | Phase 4 |
| **6** | Sync → Projektion, Aufräumen | Phase 3 + 4 | Phase 3 + 5 |

> Hinweis: Die **Risiko-Umkehr** zwischen den v1-Dokumenten (v1-`ssot` „Phase 2" = riskant,
> v1-`consolidation` „Phase 2" = harmlos) ist ab v2 aufgelöst — es gilt nur noch diese Tabelle.
