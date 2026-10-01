# TARAflow — Asset-Stores konsolidieren (Single Source of Truth)

**Status:** Vorschlag / Tech-Debt-Ticket
**Scope:** `shared`, `features/dfd`, `features/assets`, `app` (workspace-layout)
**Ziel:** Eine kanonische Asset-Quelle statt vier Formen / zwei Stores. Zusätzlich: `HazardItem`-Bezug im Assets-Tab sichtbar machen (über den Safety-Chip hinaus).

> Dieses Dokument ist die Konsequenz aus dem `HU-003`-Bug: hazard-geminteten Human-Assets landeten nur in `dfd.assets`, nie in `project.assets.assets`, weil der DFD→Assets-Sync auf dem Hazard-Pfad übersprungen wurde. Der Quick Fix (QF-1) behebt das Symptom; dieses Dokument beschreibt die Ursache und ihre Auflösung.

---

## 1. Ist-Zustand

### 1.1 Vier Asset-Formen

| Form | Ort | Zweck | Felder (Kern) |
|------|-----|-------|---------------|
| `CreatedAsset` | `shared/services/asset-creation.ts` | Erzeugungs-Seed (id-Schema) | `id`, `displayId`, `name`, `assetGroup`, `protectionNeed?` |
| `AssetReference` | `shared/models/asset-reference-types.ts` | Read-Snapshot für Threat/Risk/Hazard | `id`, `name`, `assetGroup`, `hasSafetyAnnotation`, `impactRatings?`, `securityGoals?`, … |
| `DFDAsset` | `features/dfd` | Asset im Graph-Store | `id`, `name`, `assetGroup`, `linkedElements`, `protectionNeed`, … |
| `Asset` (in `AssetData`) | `features/assets` | Angereichertes Master-Record | `+ impactRatings`, `overallImpact`, `aggregatedImpact`, `physicalImpact`, `properties`, `source`, `syncedWithDFD`, … |

### 1.2 Zwei Stores

```
project.dfd.assets      ← DFD-Tab liest/schreibt hier   (DFDAsset[])
project.assets.assets   ← Assets-Tab + memoizedAssetDataRef lesen hier   (Asset[] in AssetData)
```

### 1.3 Mapper / Brücken

- `mapDFDAssetsToAssetFeature`, `mapDFDElementsToAssetFeature`, `mapDFDConnectionsToAssetFeature` — DFD → Asset-Feature-Form.
- `syncFromDFD(assetData, dfdAssets, …)` (`asset-sync-service.ts`) — **einzige** echte DFD→Assets-Synchronisation (one-way).
- `memoizedAssetDataRef` (`workspace-layout.tsx`) — `Asset[]` → `AssetReference[]` für Konsumenten.
- `extractAssetReferences`, früher `seedToRef` — punktuelle Ad-hoc-Konvertierungen.

### 1.4 Datenfluss heute

```
            createAsset() ──► CreatedAsset
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        │ (DFD quick-capture)     │ (Hazard import mint)      │ (manual)
        ▼                         ▼                           ▼
  addCreatedAssets(dfd) ──► dfd.assets ── syncFromDFD ──► assets.assets ──► memoizedAssetDataRef ──► AssetReference[]
                                  ▲                            │                                         │
                              DFD-Tab                     Assets-Tab                          Threat / Risk / Hazard
```

---

## 2. Warum das beißt

1. **Zwei Stores, eine Sync-Richtung, kein Chokepoint.** `syncFromDFD` ist korrekt, läuft aber nur, wenn ein Tab ihn explizit aufruft. Jeder Schreibpfad, der `dfd.assets` ändert, **ohne** den Sync nachzuziehen, strandet Assets (genau der `HU-003`-Fall im Hazard-Handler).
2. **`AssetData` ist faktisch schon das Master-Record** (es absorbiert DFD-Assets via Sync und reichert an) — aber es ist nicht formal die *einzige* Quelle, und `dfd.assets` lebt als paralleler Store weiter.
3. **Typ-Wucherung erzeugt Adapter-Wildwuchs** (`seedToRef`, `mapDFD…`, `extractAssetReferences`). Jede neue Asset-Eigenschaft (z. B. deine `environment`-Erweiterung) muss durch mehrere Formen nachgezogen werden.

**Kernproblem:** Es gibt keine formale Single Source of Truth, und der einzige korrekte Sync ist nicht erzwungen.

---

## 3. Zielarchitektur

### 3.1 Entscheidung: `AssetData` ist die Single Source of Truth

`project.assets` (`AssetData`, mit `Asset[]` + `configuration`) wird die **einzige** maßgebliche Asset-Quelle. Begründung:

- Es trägt bereits die reichste Information (Impact-Ratings, Security-Goals, abgeleitete Impacts, Konfiguration).
- Der Sync ist heute schon DFD → Assets gerichtet; AssetData ist das *Ziel*, also der natürliche Master.
- Threat/Risk/Hazard konsumieren ohnehin `AssetReference`, das aus AssetData projiziert wird.

`dfd.assets` hört langfristig auf, ein **Store** zu sein, und wird zu einer **Projektion / Referenzierung** (DFD-Elemente verweisen per `assetId`, die Chips werden aus AssetData abgeleitet).

### 3.2 Typ-Schichtung (ein Kern, dünne Projektionen)

```
                    ┌────────────────────────────────────────┐
   Master           │  Asset            (features/assets)     │  ← einzige Schreibziel-Form
                    │   = AssetCore + enrichment + links      │
                    └───────────────┬────────────────────────┘
                                    │ projiziert (read-only)
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
  AssetReference            DFD asset chip view           CreatedAsset (Seed)
  (shared, DTO)             (id-ref + name/group)         = Pick<AssetCore,…> beim Erzeugen
```

- **`AssetCore`** (neu, in `shared`): `id`, `name`, `assetGroup`, `protectionNeed?` — der gemeinsame Kern. Dependency-frei.
- **`Asset`** (`features/assets`): `AssetCore` + Enrichment (Ratings, Goals, Impacts, `linkedDFDElements`, `source`). Master.
- **`AssetReference`** (`shared`): bleibt das **read-only DTO** für Threat/Risk/Hazard — als Projektion aus `Asset` (Dependency Inversion bleibt erhalten, das ist *gut*).
- **`CreatedAsset`** entfällt als eigener Typ → `createAsset()` gibt `AssetCore` zurück (oder direkt `Asset`-Seed). `seedToRef` entfällt.
- **`DFDAsset`** → Endzustand: nur noch `assetId`-Referenzen auf Elementen; kein paralleler Asset-Record.

### 3.3 Ein Erzeugungs-Chokepoint

Genau **ein** Service erzeugt Assets (id-Schema + Master-Eintrag), egal ob aus DFD-Quick-Capture, Hazard-Import oder manuell:

```ts
// the only place that mints an asset identity AND registers it in the master store
addAsset(assetData: AssetData, seed: AssetCore, opts?: { source: "dfd" | "manual" | "hazard" }): AssetData
```

### 3.4 Ein Sync-/Projektions-Chokepoint

Solange `dfd.assets` noch existiert (Übergangsphase): der DFD→Assets-Sync wird **im `updateProject`-Chokepoint** erzwungen, nicht pro Tab. Damit kann **kein** Schreibpfad mehr Assets stranden — das ist die Verallgemeinerung von QF-1.

```ts
// project-reducer / updateProject middleware (pseudo)
function commitProject(next: Project): Project {
  if (dfdAssetsChanged(next)) {
    const { assetData } = syncFromDFD(next.assets, mapDFD…(next.dfd));
    return { ...next, assets: assetData };
  }
  return next;
}
```

### 3.5 Ziel-Datenfluss

```
  addAsset() ──► AssetData (SSoT) ──► AssetReference[]  ──► Threat / Risk / Hazard
                      ▲                      └────────────► DFD chip view (projiziert)
                      │
        alle Erzeugungspfade (DFD / Hazard / manual) gehen hier durch
```

---

## 4. Migrationsplan (phasenweise, jede Phase einzeln lieferbar)

> **Wichtig:** Nach **Phase 2** ist die Bug-Klasse (gestrandete Assets) bereits eliminiert. Wenn die volle Typ-/Store-Konsolidierung zu groß ist, kann man dort sauber stoppen.

### Phase 0 — Absichern (zuerst!)
- Characterization-Tests für den Ist-Zustand: Import → Asset taucht in `assetDataRef` auf; DFD-Quick-Capture → dito; manuelles Asset; `environment`-Gruppe.
- Snapshot-Test für `memoizedAssetDataRef` und `syncFromDFD` (new/update/remove/keine-Änderung).
- **Erst danach** refactoren.

### Phase 1 — Ein Erzeugungs-Chokepoint
- `createAsset()` gibt `AssetCore` zurück (statt `CreatedAsset`). `CreatedAsset` → `type CreatedAsset = AssetCore` (Alias), dann Aufrufer migrieren, dann Alias löschen.
- `seedToRef` entfernen (bereits geschehen / vorbereitet).
- Alle Mint-Pfade (DFD, Hazard) rufen denselben `addAsset(...)`.

### Phase 2 — Sync erzwingen (Bug-Klasse killen) ✅ *Stopp-Punkt möglich*
- Den DFD→Assets-Sync aus den einzelnen Tabs in den `updateProject`-Chokepoint heben (§3.4).
- `handleHazardsUpdate`-QF-1 wird damit überflüssig (zentral abgedeckt) — QF-1 kann bleiben, bis Phase 2 steht.
- Backfill-Effekt (einmaliger Sync beim Project-Load) als Netz für Altlasten.
- **Ergebnis:** kein Schreibpfad kann mehr Assets stranden.

### Phase 3 — Typen kollabieren
- `AssetCore` in `shared` einführen; `Asset` = `AssetCore` + Enrichment; `AssetReference` als `Pick`/Projektion definieren.
- `hasSafetyAnnotation?` (bereits optional gemacht) und übrige Projektionsfelder konsolidieren.
- Tote Ad-hoc-Konverter entfernen (`extractAssetReferences` ggf. durch eine einzige `toAssetReference(asset)`-Projektion ersetzen).

### Phase 4 — `dfd.assets` als Store auflösen
- DFD-Elemente halten `assetId`-Referenzen statt eigener Asset-Records.
- DFD-Asset-Chips werden aus `AssetData` projiziert (read-only View).
- `mapDFDAssetsToAssetFeature` + `syncFromDFD` werden überflüssig → entfernen.
- **Das ist der größte Brocken** (DFD-Tab, draw.io-Asset-Zuordnung) — eigener Branch, viel Test-Abdeckung.

### Phase 5 — Aufräumen
- Verbleibende Mapper/Adapter löschen.
- Doku + ADR (Architecture Decision Record) „AssetData ist SSoT" festhalten.

---

## 5. `features/assets` erweitern: `HazardItem` im Assets-Tab

### 5.1 Motivation
Aktuell leitet der Assets-Tab nur einen **Safety-Chip** aus der Safety-Annotation (`linkedDFDElements[].safety`) ab. Seit Phase 1 (Hazard-Tab) gibt es `HazardItem` + Kanten:

- `endangers` (Hazard → Asset/Person) — das Asset ist **Ziel** einer Gefährdung.
- `contributes_to` (Asset → Hazard) — das Asset ist **Ursache/Beitrag**.

Diese Bezüge gehören sichtbar gemacht: pro Asset, welche Hazards es gefährden bzw. zu welchen es beiträgt.

### 5.2 Datenpfad (gleiches Muster wie `assetDataRef`)
Cross-Feature-Zugriff über ein **read-only DTO** aus der App-Schicht (Dependency Inversion, kein Feature-Import von `features/hazards` in `features/assets`):

```ts
// shared/models/hazard-reference-types.ts  (neu)
export interface AssetHazardLink {
  hazardId: string;
  externalRef?: string;     // human-readable id (e.g. "03.01")
  label: string;
  role: "target" | "cause"; // endangers → target, contributes_to → cause
  severity?: string;        // worst endangers severity on this edge (for targets)
}

export interface HazardReference {
  /** assetId → hazards touching it */
  byAssetId: Record<string, AssetHazardLink[]>;
}
```

- In `workspace-layout.tsx` ein `memoizedHazardRef` bauen (analog `memoizedAssetDataRef`): aus `project.hazards` (Items + Relations) die `byAssetId`-Map projizieren.
- An den Assets-Tab als Prop `hazardRef?: HazardReference` reichen.

### 5.3 UI im Assets-Tab
- **Neue Spalte / Chip „Hazards"**: Count + Tooltip mit den Hazard-Labels (`externalRef · label`), getrennt nach `target` / `cause`.
- Den bestehenden **Safety-Chip ergänzen** (nicht ersetzen): Safety-Annotation (DFD) und Hazard-Bezug (Phase 1) sind zwei verschiedene Signale — beide nebeneinander zeigen.
- Optional im Asset-Detail: Liste „Endangered by" / „Contributes to" mit Sprungmarke in den Hazard-Tab.

### 5.4 Richtungs-Hinweis
- **Human / Environment**-Assets erscheinen typischerweise als `endangers`-**Ziele** (aus „betroffene Personen" beim Import).
- **System / Data / Process**-Assets erscheinen als `contributes_to`-**Ursachen**.
Die UI sollte beide Rollen klar trennen, damit die Semantik nicht verschwimmt.

### 5.5 Abhängigkeit zur Store-Konsolidierung
Diese Erweiterung ist **unabhängig** von §1–4 umsetzbar (sie liest nur `project.hazards` + Asset-IDs). Sie wird aber sauberer, sobald die Asset-IDs garantiert in der SSoT auflösen (Phase 2) — sonst zeigt die Hazard-Spalte denselben „unresolved id"-Effekt wie zuvor die Bowtie-Targets.

---

## 6. Risiken & Sequenzierung

- **Nicht** Phase 4 vor Phase 2 angehen — erst den Sync erzwingen, dann den Store entfernen.
- Jede Phase hinter Tests; besonders `syncFromDFD`-Verhalten (new/update/remove, `hasChanges`-Gate, Safety-Kriterium-Auto-Add).
- `updateProject`-Chokepoint (Phase 2): auf Performance achten — `syncFromDFD` nur bei tatsächlicher `dfd.assets`-Änderung laufen lassen (Referenz-/Hash-Vergleich), nicht bei jedem Project-Update.
- Persistenz/Migration: bestehende Projekte mit gestrandeten DFD-Assets über den Backfill-Effekt einmalig heilen.

---

## 7. Was schon erledigt ist (und wie es reinpasst)

- **QF-1** in `handleHazardsUpdate`: zieht `syncFromDFD` nach Hazard-Mint nach — deckt **neue** Importe ab. Wird durch Phase 2 (zentraler Chokepoint) abgelöst.
- **Backfill-Effekt** beim Project-Load: heilt **bestehende** gestrandete Assets. Bleibt als Netz auch nach Phase 2 sinnvoll.
- **`hasSafetyAnnotation?` optional** + `seedToRef` entfernt: erste Schritte Richtung Phase 1/3 (Typ-Schichtung).

---

## 8. Kurz-Empfehlung

1. **Jetzt:** Phase 0 (Tests) + Phase 2 (Sync-Chokepoint). Damit ist die Ursache der Sync-Lücken weg.
2. **Danach, wenn Kapazität:** Phase 1 + 3 (Typen kollabieren).
3. **Separater großer Branch:** Phase 4 (`dfd.assets`-Store auflösen).
4. **Parallel/unabhängig:** §5 (`HazardItem` im Assets-Tab) — eigenständig lieferbar.
