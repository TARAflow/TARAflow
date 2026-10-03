# TARAflow — Asset-Graph-Sicht (View & Edit Mode): Anforderungen & Umsetzungsphasen

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>

> **Status:** Entwurf v2.4 (2026-10-02), zur externen Verifikation. **Phase 1 ist durch Gate G1 blockiert (§8);**
> der automatisierte Teil von G1 ist durchgeführt, das manuelle Prüfprotokoll steht noch aus.
> Vorgezogen, weil in beiden G1-Zweigen nötig und ohne Persistenzbezug: A2A-Regelwerk in `shared`,
> explizite KERN-Kennzeichnung, Ziel-Einteilung, kanonischer Typ und Relations-Service (§8, Phase 1).
> **D1 entschieden: (a) Kantenliste.**
> **Ablage:** `doc/Open/DFD/asset-graph-view-requirements.md`
> **Code-Stand der Bestandsaufnahme:** `main` @ `22e9d26` (2026-09-30); G1-Automatik und §10 Frage 1
> geprüft gegen `main` @ `daacc38` (2026-10-02, Persistenzpfad seit `22e9d26` unverändert).
> **Konvention:** Prosa Deutsch, Identifier/Typen/Code englisch.
> **Bezug:** `taraflow-asset-beziehungen.md`, `taraflow-asset-zu-asset-beziehungen.md`,
> `doc/Open/Asset/asset-store-ssot-refactor-v2.md`, `doc/Open/taraflow-usecase-konzept.md`,
> `doc/Done/Asset/security-goal-rework-design.md`.

### Revisionsverlauf

| Version | Datum | Änderungen |
|---|---|---|
| v1 | 2026-09-30 | Erstfassung: Bestandsaufnahme (B1–B5), Anforderungen, Entscheidungen D1–D7, Phasen 0–4. |
| v2 | 2026-09-30 | Einarbeitung des externen UX-Reviews. Neu: §5.1 UX-Prinzipien (2 Sichten × 2 Modi, Codierungsbudget, Hervorhebungs-Rangfolge, Kontexterhalt); Context Bar (FR-V14); Ebenen-Presets statt reinem Multi-Select (FR-V2); Einstieg „Im Graph zeigen“ aus der Tabelle (FR-V13); Detailpanel als Interaction Hub mit Wiederverwendung bestehender Komponenten (FR-V8); Connection Handles mit Zielhervorhebung während des Ziehens (FR-E4/E5); Layout-Stabilität innerhalb der Sitzung als MUSS (AR-12), lokale Persistenz als KANN (FR-V15, D3 revidiert); Verzweigungs-Semantik für Process-Abläufe als Voraussetzung der Ablaufsicht (FR-P7, D8). Geändert: FR-V7 (keine dauerhafte KERN-Hervorhebung auf Kanten), FR-E1 (visuelle Modusunterscheidung), FR-E11 (MUSS). Die technischen Prüffragen aus §10 sind noch unbeantwortet. |
| v2.1 | 2026-09-30 | Einarbeitung Review-Runde 2. Neu: **Gate G1** (§8) — B1 wird nicht als Annahme, sondern als formales Gate vor Phase 1 behandelt, mit Prüfprotokoll, Ergebnisfeld und Verzweigung PASS/FAIL. Heutiger A2A-**Schreibpfad** aus dem Code nachverfolgt (§3.3.1), inkl. Hinweis, dass A2A innerhalb der Sitzung sichtbar bleibt und erst Speichern+Neuöffnen den Verlust zeigt. Neues Prinzip **UX-8** (Sichten zeigen nur, was das Datenmodell ausdrücken kann); Phase 2/3 explizit ohne Verzweigungen. **AR-12** präzisiert (Fixierung auch nach „Neu anordnen“, neue Knoten werden nach dem Einschwingen ebenfalls fixiert). Befund B5 durch Code belegt, neuer Befund **B6** (Asset-Form im DFD-Beschreibungs-View ohne Zielliste). |
| v2.2 | 2026-10-02 | Phase 0 begonnen: automatisierter Teil von Gate G1 umgesetzt und Ergebnis eingetragen (§8); Prüffrage 1 aus §10 per Code-Suche beantwortet, dabei zweiter Schreibweg über den DFD-Import gefunden; Phase-0-Liste mit vorhandenen Tests abgeglichen; Testkonvention „bekannter Verlust wird festgehalten, nicht rot gelassen“ (§8); Verweis auf das Schutzziel-Rework-Dokument (jetzt `doc/Done`) korrigiert. |
| v2.3 | 2026-10-02 | G1-unabhängige Teile von Phase 1 umgesetzt: A2A-Regelwerk nach `shared/models/asset-a2a-rules.ts`, explizite KERN-Kennzeichnung, Ziel-Einteilung *gültig / nur umgekehrt / ungültig*. Neuer Befund **B7** (KERN-Reihenfolge im Regelwerk widerspricht dem Beziehungsdokument). AR-4 in zwei Schritte geteilt: Element-zu-Asset-Regelwerk folgt mit FR-E7 (Phase 3). |
| v2.4 | 2026-10-02 | **D1 entschieden: (a).** Begründung gegen den Code korrigiert: „gleiches Muster wie `hazards.relations`“ gilt nur halb (dort keine Kanten-IDs, kein Audit-Diff), stabile IDs sind kein Unterscheidungsmerkmal; tragend sind Robustheit gegen die Fehlerklasse von B1, lokale Kaskade/Audit und direkte Kantennutzung im Graph. Neuer Befund **B8** (Hazard-Relationen nicht im Audit-Diff). Kanonischer Typ `A2ARelation` und reiner Relations-Service (AR-5) umgesetzt, noch ohne Persistenz. |

---

## 1. Motivation

Asset-zu-Asset-Beziehungen (Ebene 2) werden heute ausschliesslich im Asset Description Side Panel
als **Liste pro Asset** gepflegt. Für einzelne Kanten reicht das. Für die Aussagen, die das
Beziehungsregelwerk eigentlich trägt, reicht es nicht:

- **Ketten sind unsichtbar.** Abschnitt 8.4 in `taraflow-asset-zu-asset-beziehungen.md` beschreibt,
  wie ein Angriffspfad *aus* den Beziehungen entsteht (Data → Function → System → Hazard → Human).
  In einer Liste pro Asset sieht man davon jeweils nur eine Kante.
- **Abläufe sind unlesbar.** Ein Process Asset ist eine geordnete Folge von
  `invokes [step]`-Aufrufen mit Daten, die zwischen den Schritten fliessen. Als Liste lässt sich das
  nicht nachvollziehen.
- **Modellierungsfehler bleiben verborgen.** Beispiel aus der Schulung (2026-09-29): „SW Update“ kann
  sowohl Function als auch Process sein. Existieren beide ohne `implements`-Kante dazwischen, ist das
  in einer Liste kaum zu bemerken, in einem Graphen sofort.

Ziel ist eine **grafische Sicht auf Ebene 2**, die zuerst liest (View Mode) und dann auch
modelliert (Edit Mode), sodass der Analyst beim Anlegen einer Beziehung sieht, wie der Graph wächst.
Die Graph-Sicht ist dabei **kein Ersatz** für Tabelle und Side Panel, sondern ein Denk- und
Analysewerkzeug: Sie soll Zusammenhänge zeigen, die in Listen verborgen bleiben. Die grösste
Gestaltungsgefahr ist nicht technischer Natur, sondern visuelle Überladung („Haarball“) — die
UX-Prinzipien in §5.1 richten sich dagegen.

### 1.1 Fachlicher Hintergrund aus der Schulung

Die folgenden Klärungen sind Ergebnis der Diskussion und prägen die Anforderungen. Sie sind hier
festgehalten, damit sie nicht als Implementierungsdetail verloren gehen:

- **Process ist orthogonal, nicht vertikal.** Die vertikale Hierarchie ist
  Data → Function → System → Infrastructure (so auch `shared/models/asset-group-types.ts`).
  Process schneidet quer: ruft Functions auf (`invokes`), läuft auf Systems (`runs_on`), wird von
  Humans bedient (`operated_by`).
- **Process ≠ UseCase.** Ein UseCase lässt sich als Process (oder Process-Kette) modellieren, aber
  nicht jeder Process ist ein UseCase (Bootsequenz, Regelzyklus, Watchdog haben keinen Actor).
  Eine Gleichsetzung wird **nicht** festgelegt.
- **Processes sind hierarchisch.** Ein Process kann je nach Betrachtungsebene aus Sub-Processes
  bestehen. Das Regelwerk hat dafür heute **keine Kompositionsbeziehung** (`triggers`,
  `depends_on`, `suspends` drücken kein „ist Teil von“ aus) → Phase 4.
- **Processes haben Alternativ- und Fehlerpfade.** Angriffe setzen häufig genau dort an
  (Fehlerbehandlung, Fallback, Abbruch mitten im Update, TOCTOU zwischen Prüf- und
  Ausführungsschritt). `stepOrder` bildet heute nur eine **lineare** Ordnung ab → Phase 4, D8.
- **Function vs. Process — Unterscheidungskriterium:** Eine Function ist eine Fähigkeit (*was*),
  ohne zeitliche Struktur. Ein Process ist ein Ablauf (*wie/wann*) mit Auslöser, geordneten
  Schritten inkl. Alternativ-/Fehlerpfaden und Endzustand. Testfrage: *Entsteht ein eigener Threat,
  wenn die Reihenfolge manipuliert, ein Schritt übersprungen oder zwischen zwei Schritten
  eingegriffen wird?* Ja → Process.
- **Beides zugleich ist legitim** und wird über `Process ─implements→ Function` verbunden
  (Function = das Was, Process = das Wie).
- **Naming-Konvention (Empfehlung):** Functions als Substantiv der Fähigkeit
  („Signaturprüfung“, „Firmware-Update-Fähigkeit“), Processes als Verbphrase oder „-Ablauf“
  („Firmware-Update durchführen“). Zusätzlich ID-Präfixe (FU-, PR-).

---

## 2. Abgrenzung

| Thema | In diesem Dokument | Anderswo |
|---|---|---|
| Grafische Sicht auf Asset-Graph (Ebene 2) + Element-Anker | ✅ | — |
| UX-Konzept der Graph-Sicht (Prinzipien, Interaktionen) | ✅ §5.1 ff. | — |
| Kanonische Persistenz der A2A-Beziehungen (Voraussetzung, §3 Befund B1) | ✅ Phase 1 | Überschneidung mit `asset-store-ssot-refactor-v2.md` |
| Kompositionsbeziehung, Verzweigungen, Process-Ablaufsicht | ✅ Phase 4 | — |
| Analytische Wirkung der A2A Core Rules (STRIDE-Ableitung, `hazardDistance`) | ❌ nur Hinweis (§3 Befund B2) | eigenes Design-Dokument nötig |
| UseCase-Analyse (DFD-Element-Sequenzen, Ebene 0) | ❌ | `doc/Open/taraflow-usecase-konzept.md` |
| Anlegen von DFD-Elementen | ❌ bewusst ausgeschlossen (§5, FR-E7) | DFD-Tab |
| Hazard-Item-Modellierung | ❌ (nur optionale Anzeige) | Hazard-Tab, `hazards.relations` |

**Verhältnis zum UseCase-Konzept:** Das UseCase-Konzept plant einen View-Toggle
`[Assets] [UseCases]` im Asset-Tab. Die Graph-Sicht fügt sich als weiterer View in denselben
Toggle ein (Entscheidung D2). UseCase (Sequenz von DFD-Elementen, Ebene 0) und Process Asset
(Sequenz von Function-Aufrufen, Ebene 2) sind **verschiedene Konzepte** und werden nicht
zusammengeführt; ein möglicher späterer Brückenschlag ist nicht Teil dieses Dokuments.

---

## 3. Ist-Zustand (aus dem Code, Stand `22e9d26`)

Alle Aussagen sind am Code bzw. an der Projektdatei `Simple_Test_Project.tara.json`
(`schemaVersion: 7`) nachvollziehbar. Befunde mit Handlungsbedarf sind als **B1–B5** markiert.

### 3.1 Element-zu-Asset-Beziehungen

- **Speicherort (SoT):** Projektdatei, im DFD-Teil:
  `dfd.elements[].assetRelations[]` und `dfd.connections[].assetRelations[]`
  (Felder: `assetId`, `assetGroup`, `relationType`, optional Qualifier, `notes`, `safety`).
- **Nicht** im draw.io-Modell: `dfd.xml` enthält keine Asset-Informationen.
- **Projektion:** `assets.assets[].linkedDFDElements[]` wird daraus abgeleitet
  (`src/app/utils/dfd-to-asset-mapper.ts`, aufgerufen über `commitAssetSync`).
- **Regelwerk:** `getAllowedRelations(elementType, assetGroup)` in
  `src/features/dfd/models/asset-constants.ts`.

### 3.2 Asset-Records

- **Kanonisch seit Schema v6:** `assets.assets[]` (`Asset`, `features/assets/models/asset-types.ts`),
  UUID als `id`, lesbares Label als `displayId`.
- `dfd.assets[]` ist nur noch **Laufzeit-Projektion**: `prepareForDisk` schreibt `assets: []`
  (`src/app/services/prepare-for-disk.ts`), `commitAssetSync` leitet beim Laden über
  `deriveDfdAssets()` neu ab (`src/app/utils/asset-to-dfd-mapper.ts`).
- `deriveDfdAssets()` berücksichtigt **nur** Assets mit `source === "dfd"`
  (`dfdSourcedAssets()`). Assets mit `source: "manual"` erscheinen daher **nicht** in den
  DFD-Asset-Pickern. → **B4**

### 3.3 Asset-zu-Asset-Beziehungen

- **Typ:** `AssetToAssetRelation` in `src/features/dfd/models/asset-relation-types.ts` —
  quellenseitig gespeichert (`sourceGroup`, `targetGroup`, `targetAssetId`, `relationType`,
  `stepOrder?`, `analyticallyActive?`, `rationale?`, `notes?`, `safety?`, `degradationMode?`,
  `degradationDescription?`). Relationstypen: `A2ARelationType` in
  `src/shared/models/asset-group-types.ts`.
- **Erfassung:** `AssetToAssetSelector` im `asset-description-form.tsx` (Tab „Relations“). Die Form
  schreibt `onChange({ ...asset, assetRelations: relations } as any)` auf das **`DFDAsset`**.
  Das typisierte Feld `DFDAsset.assetToAssetRelations` wird nirgends geschrieben
  (Kommentar in `asset-to-dfd-mapper.ts`: „dead field“; `dfd-asset-deletion.ts` räumt beide
  Schreibweisen ab).
- **Regelwerk:** `getAllowedA2ARelations(sourceGroup, targetGroup)` in
  `src/features/dfd/models/asset-constants.ts`.

#### 3.3.1 Heutiger Schreibpfad (aus dem Code nachverfolgt)

```
AssetToAssetSelector.onChange(relations)
  → AssetDescriptionForm.handleA2AChange
      onChange({ ...asset, assetRelations: relations } as any)
  → DfdAssetPanel: onAssetChange(selectedAsset.id, changes)
  → dfd-tab.tsx: handleAssetChange → scheduleSave(base ⇒ …)
  → use-dfd-data.ts: updateAsset(assetId, changes, base)
      → updateDFD(...) → finalizeDfd          // Mutation am DFDAsset in dfd.assets
  → workspace-layout.tsx: handleDFDUpdate
      → syncFromDFD(mapDFDAssetsToAssetFeature(...))   // trägt KEINE A2A weiter
  → updateProject → commitAssetSync(prev, next)
  → Speichern: prepareForDisk → dfd.assets = []        // A2A verworfen
  → Laden:     commitAssetSync → deriveDfdAssets(...)  // ohne A2A neu aufgebaut
```

**Die kanonische Mutation findet heute in `useDFDData.updateAsset` statt, und zwar auf dem
Laufzeit-Mirror `dfd.assets`.** Es gibt keinen Schreibpfad, der A2A-Beziehungen in
`project.assets` überführt. Innerhalb einer Sitzung bleiben die Beziehungen sichtbar, weil der
Mirror nur beim Laden neu abgeleitet wird (einziger Aufrufer von `deriveDfdAssets` ist
`commitAssetSync`, und nur bei leerem `dfd.assets`). Ein Tab-Wechsel beweist deshalb nichts; erst
Speichern **und** Neuöffnen zeigt den Verlust. Genau diese Stelle — `updateAsset` bzw. der
nachgelagerte Sync — ist es, die der Relations-Service (AR-5) ersetzen muss.

**B1 — A2A-Beziehungen werden (nach Code-Lektüre) nicht persistiert.**
Sie leben nur auf dem Laufzeit-Mirror `dfd.assets`. Dieser wird beim Speichern geleert
(`prepareForDisk`), beim Laden ohne A2A neu abgeleitet (`deriveDfdAssets` übernimmt sie nicht),
und das kanonische `Asset` hat kein Feld dafür. `migrate_5_to_6` biegt zwar `targetAssetId` auf
UUIDs um, verwirft danach aber `dfd.assets` vollständig — Altprojekte verlieren ihre A2A-Beziehungen
also bereits bei der Migration. Die Beispieldatei (Schema 7) enthält konsistent dazu **keine**
A2A-Beziehung. **Wird über Gate G1 (§8) entschieden**, nicht angenommen.

**B2 — A2A-Beziehungen sind analytisch nicht wirksam.**
Kein Threat-Generator referenziert `sourceAssetId`/`targetAssetId`/`assetRelations` von Assets
(`src/features/threats` enthält keine Konsumenten). Die in
`taraflow-asset-zu-asset-beziehungen.md` §3.4 beschriebene STRIDE-Ableitung und
`hazardDistance`-Berechnung existieren im Code nicht. `AssetData.a2aRelations` wird nirgends
befüllt, deshalb zeigt `asset-table.tsx` (`getDownstreamCount`) immer 0.
→ Nicht Gegenstand dieses Dokuments, aber wichtig für die Erwartung: Die Graph-Sicht
**visualisiert und pflegt** Beziehungen; sie erzeugt (noch) keine Threats.

**B3 — Regelwerk liegt im falschen Feature.**
Beide Regeltabellen (`getAllowedRelations`, `getAllowedA2ARelations`) liegen in
`features/dfd/models/asset-constants.ts`. Die Graph-Sicht gehört zu `features/assets` und darf
nicht quer in `features/dfd` importieren → Umzug nach `shared` (Phase 1).

**B5 — Redundante Gruppenfelder in der Relation.**
`sourceGroup`/`targetGroup` sind Kopien von `Asset.assetGroup`. Nach einem Gruppenwechsel eines
Assets (der Anlass für die UUID-Migration 5→6) werden sie stale. Das ist dieselbe Fehlerklasse
wie bei anderen abgeleiteten Feldern, die bei Änderung des Treibers nicht zurückgesetzt werden.
Belegt im Code: `useDFDData.updateAsset` passt bei einem Gruppenwechsel die **Element**-Relationen
an (Typprüfung gegen die neue Gruppe, `assetGroup` aktualisiert), die A2A-Relationen — weder die
eigenen noch die fremden, die auf das Asset zeigen — aber nicht.

**B6 — Zweiter Einstieg ohne Zielliste.**
`dfd-description-view.tsx` rendert `AssetDescriptionForm` ohne `allAssets` (Default `[]`). Im
Tab „Relations“ dieses Einstiegs gibt es daher keine Zielassets. Mit dem Relations-Service
(AR-5) muss jeder Einstieg dieselben Ziele aus der kanonischen Quelle beziehen.

**B8 — Hazard-Relationen nicht im Audit-Diff.**
`features/audit/services/diff-service.ts` vergleicht DFD, Assets, Threats, Risks und Attack Trees,
aber nicht `hazards` (weder Hazard Items noch `hazards.relations`). Nicht Teil dieses Plans, aber
für AR-9 relevant: Der neue A2A-Abschnitt im Diff darf sich nicht am Hazard-Muster orientieren,
weil es dort keines gibt. → Eigener Punkt außerhalb dieses Dokuments.

**B7 — KERN-Kennzeichnung nur implizit und widersprüchlich.**
Das A2A-Regelwerk sollte KERN-Beziehungen „jeweils zuerst“ auflisten. Die Reihenfolge stimmt aber
nicht mit der KERN-Übersicht in `taraflow-asset-zu-asset-beziehungen.md` überein, z. B.
process → human: `endangers` vor dem KERN-Typ `affects_privacy`; service → function: `provides`
vor `depends_on`. Aus der Reihenfolge lässt sich KERN also nicht ablesen, und es gibt keine andere
Stelle im Code, die KERN kennt. → Behoben in v2.3 durch `KERN_A2A_RELATIONS` (explizite Daten,
Test gegen das Regelwerk); die Reihenfolge im Regelwerk hat keine Bedeutung mehr.

### 3.4 Sonstiges

- **Hazard-Beziehungen** (`contributes_to`, `endangers`) sind ein eigenes System in
  `project.hazards.relations` (`src/shared/models/hazard-types.ts`,
  `features/hazards/services/hazard-relation-service.ts`), nicht Teil von A2A.
- **D3** ist vorhanden (`d3@^7.9.0`), genutzt in
  `features/attacktree/components/attacktree-preview.tsx` mit `d3.hierarchy` und `d3.zoom`.
  Das Baum-Layout ist für einen allgemeinen gerichteten Graphen (mehrere Eltern, Zyklen)
  **nicht** verwendbar; wiederverwendbar sind Zoom/Pan, Rendering-Muster und Theming.
- **Asset-Tab** (`features/assets/components/assets-tab.tsx`): DFD-Vorschau oben, Tabelle unten.
- **Löschen:** `ConfirmAssetDeleteDialog` + `asset-usage-types.ts` zählen bereits
  `assetToAssetRelations`, lesen aber aus `dfd.assets` (`countAssetReferences` in
  `dfd-asset-deletion.ts`).

---

## 4. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Ebene** | Eine Asset-Gruppe (`AssetGroup`): data, function, system, infrastructure (vertikal); process, physical, service, human, environment (orthogonal). |
| **Sicht** | *Was* gezeigt wird: Ebenen-Sicht, Fokus-Sicht, (Phase 4) Process-Ablaufsicht. |
| **Modus** | *Was man tun kann*: View Mode (lesen) oder Edit Mode (modellieren). Modus und Sicht sind unabhängig — in jeder Sicht kann modelliert werden. |
| **Ebenen-Sicht** | Überblick: alle Assets der gewählten Ebenen mit den Kanten zwischen ihnen. |
| **Fokus-Sicht** | Ego-Graph eines gewählten Assets bis Tiefe n (ein- und ausgehend). Primäres Arbeitsinstrument. |
| **Preset** | Benannte Ebenen-Kombination mit fachlicher Bedeutung (z. B. „Architektur“). |
| **Element-Anker** | Ein DFD-Element (Process, DataStore, ExternalEntity, Interface, DataFlow …), das über eine Element-zu-Asset-Beziehung an ein Asset gebunden ist. Im Graph eigener, klar unterscheidbarer Knotentyp. |
| **Stummel** | Darstellung von Kanten zu Assets in ausgeblendeten Ebenen: Zähler am Knoten statt Kante. |
| **Context Bar** | Ständig sichtbare Leiste, die beantwortet: *Was sehe ich gerade, und was ist ausgeblendet?* |
| **Connection Handle** | Sichtbarer Griff am Knoten (im Edit Mode), aus dem eine neue Beziehung gezogen wird. |
| **Detailpanel** | Seitliches Panel zum gewählten Knoten/zur gewählten Kante; zentraler Ort für Aktionen. |

---

## 5. Anforderungen

Verbindlichkeit: **MUSS** / **SOLL** / **KANN**. Jede Anforderung nennt die Phase (§8), in der sie
umgesetzt wird.

### 5.1 UX-Prinzipien

Die Prinzipien gelten für alle folgenden Anforderungen und sind bei Zielkonflikten massgeblich.

**UX-1 — Zwei Sichten × zwei Modi.**
Ebenen-Sicht („Wie hängt mein Modell zusammen?“) und Fokus-Sicht („Was hängt an diesem Asset?“)
sind Sichten; View und Edit sind Modi. Jede Kombination ist gültig. Die Fokus-Sicht ist das
primäre Arbeitsinstrument, die Ebenen-Sicht der Überblick. Bei grossen Modellen führt eine
vollständige Ebenen-Sicht zwangsläufig zum „Haarball“; der Einstieg soll deshalb bevorzugt über ein
konkretes Asset erfolgen (FR-V13).

**UX-2 — Modus ist fühlbar.**
View Mode wirkt wie eine Analysefläche (auswählen, fokussieren, expandieren, filtern, suchen,
navigieren). Edit Mode wirkt wie ein Modellierungswerkzeug (erstellen, verbinden, löschen,
Eigenschaften ändern). Der Unterschied ist visuell eindeutig, nicht nur an einem Schalter erkennbar.

**UX-3 — Knoten sagen „was ist das“, Kanten sagen „was passiert dazwischen“.**
Asset-Typ und Relationstyp werden nie mit denselben visuellen Mitteln codiert. Verbindliches
Codierungsbudget:

| Visuelles Mittel | Bedeutung | Nicht verwenden für |
|---|---|---|
| Knotenfarbe + Icon (redundant) | Asset-Gruppe | Zustände, Relationen |
| Knotenform | Knotenart: Asset / Element-Anker / Hazard Item | Asset-Gruppe |
| Pfeil | Richtung der Beziehung | — |
| Kantenbeschriftung (Text) | Relationstyp | — |
| Badge an der Kantenbeschriftung | `stepOrder` | — |
| Linienart | nur: A2A (durchgezogen) vs. Element→Asset (gestrichelt) | Relationstypen |
| Kantenfarbe | **nicht belegt** (neutral) | Relationstypen, KERN |

KERN-Beziehungen werden **nicht** dauerhaft auf den Kanten hervorgehoben, sondern nur in der
Typauswahl beim Anlegen (FR-E4) und in der Legende.

**UX-4 — Genau eine Hervorhebung gewinnt.**
Zustände haben eine feste Rangfolge; höherrangige überdecken niedrigere, nie konkurrieren zwei
gleich starke Signale:
1. Auswahl
2. Neu erstellt (kurzes Pulsieren, klingt ab)
3. Suchtreffer
4. Validierungsbefund (kleines Symbol am Knoten/an der Kante, **keine** Farbänderung)
5. Abgeblendet (ausserhalb von Fokus/Filter, aber zur Orientierung sichtbar)

**UX-5 — Der Nutzer bleibt im mentalen Kontext.**
Nach jeder Aktion (Beziehung anlegen, Asset anlegen, Filter ändern, Tiefe ändern) bleibt der
Fokus erhalten, bestehende Knoten bleiben an ihrem Platz, nur Neues wird eingefügt. Eine
vollständige Neuanordnung geschieht nie implizit, sondern nur auf ausdrücklichen Wunsch
(„Neu anordnen“).

**UX-6 — Nichts verschwindet stillschweigend.**
Jede Ausblendung (Ebene, Filter, Tiefe) ist sichtbar gemacht: in der Context Bar (FR-V14) und über
Stummel (FR-V4). Die Frage „Warum sehe ich X nicht?“ muss immer beantwortbar sein.

**UX-7 — Das System hilft beim Modellieren, statt nur zu validieren.**
Das Regelwerk wird genutzt, um zulässige Aktionen *vorab* anzubieten (gültige Ziele hervorheben,
passende Typen anbieten, Richtung vorschlagen), nicht erst, um Fehler nachträglich zu melden.

**UX-8 — Sichten zeigen nur, was das Datenmodell ausdrücken kann.**
Keine Sicht erfindet Semantik. Was nicht als Feld oder Beziehungstyp im Modell existiert, wird
nicht gezeichnet — auch nicht als „naheliegende“ Interpretation. Konkret: Fehler-, Alternativ- und
Bedingungspfade von Processes werden erst dargestellt, wenn ihre Modellierung entschieden (D8) und
umgesetzt (FR-P7) ist. Bis dahin zeigen alle Sichten `stepOrder` ausschliesslich als lineare
Reihenfolge. Neue Darstellungsideen, die neue Semantik voraussetzen, werden als
Modellierungsentscheidung behandelt, nicht als UX-Detail.

### 5.2 View Mode

| ID | Anforderung | Verb. | Phase |
|---|---|---|---|
| FR-V1 | Die Graph-Sicht ist als eigener View im Asset-Tab erreichbar (Toggle `[Tabelle] [Graph]`, erweiterbar um `[UseCases]`). | MUSS | 2 |
| FR-V2 | **Ebenen-Auswahl über Presets:** Auswahl über benannte Presets, zusätzlich „Benutzerdefiniert“ mit Multi-Select der einzelnen Ebenen. Presets (initial): **Architektur** (data, function, system, infrastructure) · **Ablauf** (process, function, data, system) · **Dienste & Abhängigkeiten** (service, system, function, infrastructure) · **Schutzziele** (human, environment, physical; mit FR-V11 zusätzlich Hazard Items) · **Alle**. Wird ein Preset manuell verändert, wechselt die Anzeige auf „Benutzerdefiniert“. | MUSS | 2 |
| FR-V3 | **Layout nach Ebenen:** Vertikale Ebenen liegen als horizontale Bahnen übereinander, Reihenfolge gemäss `asset-group-types.ts` (von unten nach oben: data → function → system → infrastructure). Orthogonale Ebenen liegen in einer seitlichen Spalte. Environment liegt neben Human (beides Schutzziele). | MUSS | 2 |
| FR-V4 | **Stummel:** Kanten zu Assets ausgeblendeter Ebenen erscheinen als Zähler am Knoten, gruppiert nach Zielebene (z. B. „3 → System“). Klick blendet die Ebene ein. | MUSS | 2 |
| FR-V5 | **Fokus-Sicht:** Auswahl eines Assets zeigt dessen ein- und ausgehende A2A-Beziehungen und Element-Anker. Tiefe 1 als Default, einstellbar bis mindestens 3. Knoten ausserhalb des Fokus werden entfernt oder abgeblendet (UX-4, Stufe 5), nicht gelöscht. | MUSS | 2 |
| FR-V6 | Element-Anker werden in der Fokus-Sicht angezeigt (eigene Knotenform, DFD-Typ-Icon, `displayId`), in der Ebenen-Sicht zuschaltbar. | MUSS | 2 |
| FR-V7 | Kanten zeigen Richtung (Pfeil) und `relationType` als Beschriftung; `stepOrder` erscheint als Badge. Codierung strikt nach UX-3; keine dauerhafte KERN-Hervorhebung. Eine Legende ist einblendbar. | MUSS | 2 |
| FR-V8 | **Detailpanel als Interaction Hub:** Klick auf einen Knoten zeigt Kerndaten (Name, `displayId`, Gruppe, Schutzbedarf) und die Beziehungen **gruppiert nach Relationstyp** („invokes → Signaturprüfung [1], Firmware installieren [2]“ · „runs_on → Update Controller“ · „operated_by → Technician“), jeweils anklickbar zur Navigation. Aktionen im View Mode: Fokussieren, Im DFD zeigen, In Tabelle zeigen. Klick auf eine Kante zeigt Typ, Qualifier, `stepOrder`, `rationale`, `degradationMode`. Das Panel verwendet die **bestehenden** Komponenten (`AssetToAssetSelector` u. a.) und denselben Relations-Service (AR-5) — es entsteht keine dritte Editier-Logik. | MUSS | 2 (Anzeige), 3 (Bearbeitung) |
| FR-V9 | **Navigation:** Von einem Element-Anker aus kann in den DFD-Tab gesprungen werden, das Element ist dort selektiert. | SOLL | 2 |
| FR-V10 | Filter nach Relationstyp; Suche nach Name/`displayId` mit Zentrieren auf den Treffer. Liegt ein Treffer in einer ausgeblendeten Ebene oder ausserhalb des Filters, sagt das Tool das explizit und bietet das Einblenden an (UX-6). | SOLL | 2 |
| FR-V11 | Hazard Items aus `hazards.relations` können zugeschaltet werden (read-only, eigene Knotenform, `contributes_to`/`endangers`-Kanten). | KANN | 4 |
| FR-V12 | Zoom, Pan, „Alles einpassen“, „Neu anordnen“ (einzige Stelle, an der ein vollständiges Re-Layout ausgelöst wird, UX-5). | MUSS | 2 |
| FR-V13 | **Einstieg aus der Tabelle:** Jede Zeile der Asset-Tabelle bietet „Im Graph zeigen“; das öffnet die Graph-Sicht in der Fokus-Sicht dieses Assets. Umgekehrt führt „In Tabelle zeigen“ zurück (FR-V8). | MUSS | 2 |
| FR-V14 | **Context Bar:** Ständig sichtbar oberhalb der Leinwand. Zeigt: Sicht, Preset bzw. gewählte Ebenen, Fokus-Asset und Tiefe, aktive Filter, Modus sowie Zähler („12 von 47 Assets sichtbar · 5 Beziehungen durch Filter ausgeblendet“). Jeder Eintrag ist direkt änderbar bzw. zurücksetzbar; „Alles zurücksetzen“ stellt die Standardansicht her. | MUSS | 2 |
| FR-V15 | Knotenpositionen können **lokal** (pro Projekt-ID, z. B. localStorage) über Sitzungen hinweg gemerkt werden, damit sich der Analyst beim Wiederöffnen orientiert. Nie in der Projektdatei (D3). Fehlen gespeicherte Positionen oder passen sie nicht mehr, greift das deterministische Layout. | KANN | 3 |

### 5.3 Edit Mode

| ID | Anforderung | Verb. | Phase |
|---|---|---|---|
| FR-E1 | Expliziter Umschalter View/Edit. Default beim Öffnen: View. Im View Mode sind keine Modelländerungen möglich. Der Edit Mode ist visuell eindeutig erkennbar (z. B. Rahmen/Hintergrund der Leinwand, Modus-Kennzeichnung in der Context Bar, sichtbare Connection Handles) (UX-2). | MUSS | 3 |
| FR-E2 | **Asset anlegen:** „+“ in einer Ebenen-Bahn legt ein Asset dieser Gruppe an (Gruppe vorbelegt, Name Pflicht). Erzeugung über die bestehende Factory (`createAsset`/`createEmptyAsset`). Das neue Asset erscheint an der Stelle der Aktion; bestehende Knoten bewegen sich nicht (UX-5). | MUSS | 3 |
| FR-E3 | Ein im Graph angelegtes Asset ist sofort in den DFD-Asset-Pickern auswählbar, überlebt nachfolgende DFD-Edits und Speichern/Neuöffnen (siehe B4, Entscheidung D4). | MUSS | 3 |
| FR-E4 | **Beziehung anlegen über Connection Handle:** Im Edit Mode zeigt ein Knoten beim Hover einen sichtbaren Griff. Zieht der Nutzer daraus eine Verbindung, werden **während des Ziehens** alle Knoten nach dem Regelwerk markiert: gültige Ziele hervorgehoben, Ziele, die **nur in umgekehrter Richtung** gültig sind, eigens gekennzeichnet, alle übrigen ausgegraut. Beim Loslassen auf einem gültigen Ziel öffnet sich ein kompakter Typ-Chooser mit **nur** den zulässigen Typen für `group(A) × group(B)`, KERN-Typen zuerst und als solche markiert. | MUSS | 3 |
| FR-E5 | **Richtungshilfe:** Loslassen auf einem Ziel, das nur umgekehrt gültig ist, öffnet den Chooser mit der umgekehrten Richtung und benennt sie ausdrücklich („Meintest du *Process implements Function*?“). Loslassen auf einem ausgegrauten Ziel legt nichts an und erklärt kurz, warum keine Richtung zulässig ist. | MUSS | 3 |
| FR-E6 | Optionale Relationsattribute (`stepOrder`, `rationale`, `degradationMode` + `degradationDescription`, `notes`) sind im Detailpanel editierbar; Pflichtregeln (z. B. `degradationDescription` bei `degradationMode`) werden wie im Side Panel validiert. | MUSS | 3 |
| FR-E7 | **Element-zu-Asset-Beziehung anlegen:** über „An Element anbinden“ im Detailpanel (Element-Auswahl) oder über den Connection Handle eines Element-Ankers. Zulässige Typen nach `getAllowedRelations(elementType, assetGroup)`, gleiche Zielhervorhebung wie FR-E4. DFD-Elemente werden im Graph **referenziert, nicht angelegt**. | MUSS | 3 |
| FR-E8 | Beziehungen und Assets können gelöscht werden (Detailpanel, Entf-Taste). Beim Löschen eines Assets zeigt ein Bestätigungsdialog die Folgen (Element-Beziehungen, A2A-Beziehungen, Risiken, Hazard-Beziehungen, Impact Ratings) — Wiederverwendung von `ConfirmAssetDeleteDialog`. | MUSS | 3 |
| FR-E9 | Undo/Redo für Änderungen im Graph (sitzungsbezogen). | SOLL | 3 |
| FR-E10 | Jede Änderung ist sofort in allen anderen Sichten sichtbar (Side Panel, Tabelle, DFD-Form) — es gibt keinen separaten Graph-Zustand. | MUSS | 3 |
| FR-E11 | **Graph wächst:** Nach dem Anlegen einer Beziehung bleibt der Fokus auf dem Quell-Asset, das Ziel wird (falls neu sichtbar) nahe der Quelle eingefügt, die neue Kante pulsiert kurz (UX-4, Stufe 2). Kein Re-Layout (UX-5). | MUSS | 3 |

### 5.4 Process-Sicht und Modell-Erweiterungen

| ID | Anforderung | Verb. | Phase |
|---|---|---|---|
| FR-P1 | **Kompositionsbeziehung** Process → Process (Vorschlag: `consists_of [step]`, Spiegel `part_of`), mit demselben `stepOrder`-Qualifier wie `invokes`. Aufnahme in `A2ARelationType`, Regelwerk, i18n, Doku. | MUSS | 4 |
| FR-P7 | **Verzweigungs-Semantik:** Schrittbeziehungen (`invokes`, `consists_of`) können einen Pfadtyp tragen (Vorschlag: `flow: "main" \| "alternative" \| "error"`, Default `main`) und bei `alternative`/`error` eine Bedingung (`condition`, Freitext). Form und Semantik: Entscheidung D8. Ohne FR-P7 zeigt die Ablaufsicht (FR-P2) ausschliesslich den linearen Hauptpfad und kennzeichnet das sichtbar. | MUSS | 4 |
| FR-P2 | **Process-Ablaufsicht** (unterliegt UX-8): eigene Darstellung, **kein** weiteres Layout des allgemeinen Graphen. Ein Process wird als Ablauf gezeigt: Auslöser oben, Schritte (aus `invokes` und `consists_of`, sortiert nach `stepOrder`) in Leserichtung, je Schritt die aufgerufene Function, zwischen den Schritten die ein- und ausfliessenden Data (`required_by`, `configures [step]`, `creates`/`modifies`), Alternativ- und Fehlerpfade als Abzweig vom jeweiligen Schritt (FR-P7), Endzustand unten. Sub-Processes aufklappbar. | SOLL | 4 |
| FR-P3 | Validierung: doppelte oder lückenhafte `stepOrder`-Werte innerhalb des Hauptpfads eines Process als Warnung. | SOLL | 4 |
| FR-P4 | Validierung: Function und Process mit gleichem (normalisiertem) Namen ohne `implements`-Kante zwischen ihnen → Warnung. | SOLL | 4 |
| FR-P5 | Validierung: Spiegelduplikate (`A implements B` **und** `B implemented_by A`) sowie die Konfliktpaare aus `taraflow-asset-zu-asset-beziehungen.md` §3.3 → Warnung. | SOLL | 4 |
| FR-P6 | Validierungsbefunde erscheinen als Symbol am Knoten/an der Kante in der Graph-Sicht (UX-4, Stufe 4) und im Detailpanel mit Erläuterung. | KANN | 4 |

### 5.5 Datenmodell und Architektur

| ID | Anforderung | Verb. | Phase |
|---|---|---|---|
| AR-1 | A2A-Beziehungen werden **kanonisch in `project.assets`** persistiert (Ort und Form: Entscheidung D1). `dfd.assets` bleibt reine Laufzeit-Projektion. | MUSS | 1 |
| AR-2 | Relationen speichern **keine** Kopie der Asset-Gruppen; die Gruppe wird immer aus dem referenzierten Asset gelesen (behebt B5). Bestehende Validierung, die `sourceGroup`/`targetGroup` liest, wird umgestellt. | MUSS | 1 |
| AR-3 | Schema-Bump mit Migration. Die Migration übernimmt A2A-Beziehungen aus `dfd.assets[].assetRelations` **und** `dfd.assets[].assetToAssetRelations`, sofern vorhanden. `migrate_5_to_6` wird so angepasst, dass v≤5-Dateien ihre Beziehungen **vor** dem Verwerfen von `dfd.assets` an den neuen Ort heben. | MUSS | 1 |
| AR-4 | Regelwerke (`getAllowedRelations`, `getAllowedA2ARelations`, KERN-Kennzeichnung) liegen in `shared`; `features/dfd` und `features/assets` importieren von dort (behebt B3). Die Zielhervorhebung (FR-E4) und die Richtungshilfe (FR-E5) werden **aus dem Regelwerk abgeleitet**, nicht separat gepflegt. **Zwei Schritte:** A2A-Regelwerk, KERN und Ziel-Einteilung in Phase 1 (erledigt, v2.3); das Element-zu-Asset-Regelwerk (`getAllowedRelations`) erst mit FR-E7, weil es an `DFDElementType` hängt und dieser Typ dafür ebenfalls nach `shared` muss — vorher braucht `features/assets` es nicht. | MUSS | 1 / 3 |
| AR-5 | Ein **reiner** Relations-Service (ohne React) kapselt Hinzufügen, Entfernen, Ändern, Validieren und Kaskade beim Asset-Löschen. Side Panel, Detailpanel und Graph-Leinwand nutzen **denselben** Service — mehrere Oberflächen, ein Schreibpfad. | MUSS | 1 |
| AR-6 | Element-zu-Asset-Beziehungen bleiben in `dfd.elements[]/connections[].assetRelations`. Die Graph-Sicht (in `features/assets`) schreibt sie **nicht direkt**, sondern über einen Callback an die App-Schicht, die eine reine DFD-Funktion anwendet und anschliessend `finalizeDfd` und `commitAssetSync` durchläuft. | MUSS | 3 |
| AR-7 | `AssetData.a2aRelations` (bzw. Nachfolger) wird aus der kanonischen Quelle befüllt; `getDownstreamCount` in der Asset-Tabelle liefert korrekte Werte. | MUSS | 1 |
| AR-8 | `ConfirmAssetDeleteDialog`/`asset-usage` zählen A2A-Beziehungen aus der kanonischen Quelle, nicht aus `dfd.assets`. | MUSS | 1 |
| AR-9 | Audit: `features/audit/services/diff-service.ts` berücksichtigt A2A-Beziehungen. Die Serialisierung ist deterministisch (stabile Sortierung), damit `canonicalStringify` idempotent bleibt und die TCS-Reproduzierbarkeitsprüfung nicht bricht. | MUSS | 1 |
| AR-10 | Knotenpositionen werden **nicht** in der Projektdatei gespeichert (D3). Das initiale Layout ist deterministisch (gleiche Eingabe → gleiche Anordnung; z. B. geseedete Startpositionen). | MUSS | 2 |
| AR-11 | Die Graph-Komponente trennt Datenaufbereitung (reine Funktion: Assets + Relationen + Sicht/Preset/Fokus/Filter → Knoten, Kanten, Stummel, Context-Bar-Zähler) von D3-Rendering, damit die Aufbereitung unit-testbar ist. | MUSS | 2 |
| AR-12 | **Layout-Stabilität in der Sitzung:** Nach jedem Initial-Layout und jedem „Neu anordnen“ erhalten alle Knoten nach dem Einschwingen `fx`/`fy` (fixiert). Bei Änderungen (neue Beziehung, neues Asset, Ein-/Ausblenden, Filter, Tiefe) bleiben fixierte Knoten unverändert; **nur** neu hinzukommende Knoten werden — nahe ihrem Bezugsknoten initialisiert — in die Simulation aufgenommen und nach deren Einschwingen ebenfalls fixiert. Ausgeblendete Knoten behalten ihre Position für ein späteres Wiedereinblenden. Ein vollständiges Re-Layout erfolgt ausschliesslich über „Neu anordnen“ (FR-V12). Manuelles Verschieben eines Knotens setzt dessen `fx`/`fy` neu. | MUSS | 2 |

### 5.6 Nicht-funktionale Anforderungen

| ID | Anforderung | Verb. | Phase |
|---|---|---|---|
| NFR-1 | Flüssige Interaktion (Zoom/Pan/Drag ohne sichtbares Ruckeln) bei 200 Assets und 600 Relationen auf Referenz-Hardware; initiales Layout stabilisiert sich in < 1 s. | SOLL | 2 |
| NFR-2 | Alle Texte i18n en/de, inkl. Preset-Namen, Context Bar, Chooser und Richtungshilfe. | MUSS | 2–4 |
| NFR-3 | Light/Dark-Theme wie restliche App; Farben pro Asset-Gruppe aus `shared/models/asset-color-constants.ts`. Bedeutung nie nur über Farbe (Icon redundant zur Farbe, UX-3). | MUSS | 2 |
| NFR-4 | Tastaturbedienung: Knotenauswahl per Tab/Pfeiltasten, Enter = Fokussieren, Entf = Löschen (nur Edit Mode), Esc = Auswahl bzw. laufendes Ziehen abbrechen. | SOLL | 3 |
| NFR-5 | Tests: reine Schichten (Relations-Service, Migration, Graph-Aufbereitung, Regelwerk, Zielhervorhebung) mit Vitest; Roundtrip-Test Speichern/Laden; Komponententests für Mode-Umschaltung, Context Bar und Typ-Chooser. | MUSS | 0–4 |
| NFR-6 | Keine Regression im Side Panel: bestehende A2A-Erfassung funktioniert unverändert (nun gegen die kanonische Quelle). | MUSS | 1 |

---

## 6. Interaktionsablauf „Beziehung anlegen“ (Referenz)

Zur Verdeutlichung von FR-E4, FR-E5, FR-E11 und UX-5 — kein zusätzlicher Anforderungsumfang:

```
1. Edit Mode aktiv, Fokus auf "Firmware-Update durchführen" (Process)
2. Hover über den Knoten → Connection Handle erscheint
3. Ziehen aus dem Handle
     → Functions/Systems/Humans mit zulässigen Typen: hervorgehoben
     → Assets, die nur umgekehrt gültig wären: eigens gekennzeichnet
     → alle übrigen: ausgegraut
4. Loslassen auf "Signaturprüfung" (Function)
     → Typ-Chooser: implements [KERN] · invokes [step?]
5. Auswahl "invokes", stepOrder 1
     → Relations-Service schreibt (ein Schreibpfad)
     → neue Kante pulsiert kurz, Fokus bleibt auf dem Process
     → keine anderen Knoten bewegen sich
6. Detailpanel des Process zeigt jetzt: invokes → Signaturprüfung [1]
```

---

## 7. Entscheidungen

| ID | Frage | Optionen | Empfehlung | Status |
|---|---|---|---|---|
| D1 | Wo und in welcher Form werden A2A-Beziehungen kanonisch gespeichert? | (a) Kantenliste `assets.relations[]` mit eigener `id`, `sourceAssetId`, `targetAssetId`, `relationType` + Attributen; (b) quellenseitig am `Asset` (`asset.relations[]`, wie heute am `DFDAsset`) | **(a).** Tragende Gründe: (1) Wege, die Assets kopieren oder umformen (`syncFromDFD`, `deriveDfdAssets`, Import, Hazard-Bridge, Asset-Erstellung), fassen die Kantenliste nicht an — genau dort entstand B1; (2) Kaskade beim Löschen und Audit-Diff bleiben lokal (eine Liste, ein Diff-Abschnitt statt einer Änderung je betroffenem Asset); (3) eingehende und ausgehende Kanten haben dieselbe Form, die Graph-Sicht nutzt sie direkt. Nicht tragend: stabile IDs (auch bei (b) möglich) und „gleiches Muster wie `hazards.relations`“ (dort ohne IDs und ohne Audit-Diff, B8). Vorteile von (b) sind einmalig (Migration 1:1, Asset-Export in sich vollständig); den Export-Vorteil erreicht (a), indem der Export eines Assets seine Kanten mitnimmt. | **entschieden (a)**, 2026-10-02 |
| D2 | Eigener Haupt-Tab oder View im Asset-Tab? | Tab / View-Toggle | **View im Asset-Tab**, konsistent mit dem UseCase-Konzept; Impact-Kontext bleibt erreichbar; Einstieg aus der Tabelle (FR-V13) ist natürlich. | offen |
| D3 | Knotenpositionen persistieren? | nein / in `.tara.json` / lokal | **Revidiert in v2:** Nie in `.tara.json` (jede Position erzeugt Diff-Rauschen im Audit-Trail und verletzt das Prinzip „inhaltliche Datei“). Stabilität innerhalb der Sitzung ist MUSS (AR-12). Stabilität über Sitzungen: lokal pro Projekt als KANN (FR-V15), analog zur Pfadspeicherung beim Multi-Diagram-Linking. | offen |
| D4 | Welche `source` bekommt ein im Graph angelegtes Asset? | `"dfd"` / `"manual"` / Semantik von `source` neu fassen | Kurzfristig `"dfd"` (sonst unsichtbar in DFD-Pickern, B4). Mittelfristig `source` als Herkunft (wo erzeugt) von der Sichtbarkeit im DFD entkoppeln — gehört zu Phase 5/6 von `asset-store-ssot-refactor-v2.md`. | offen |
| D5 | Name der Kompositionsbeziehung | `consists_of`/`part_of`, `contains`/`contained_in`, `has_step` | `consists_of [step]` (Richtung: Parent → Child), Spiegel `part_of` nur zur Anzeige. | offen |
| D6 | Layout-Engine | `d3-force` mit `forceY` je Ebene; geschichtetes Layout (dagre/ELK) | `d3-force` für Ebenen- und Fokus-Sicht (keine neue Dependency; Fixierung per `fx`/`fy` erfüllt AR-12); für die Process-Ablaufsicht eigenes deterministisches Layout (Schrittindex = Position im Hauptpfad). | offen |
| D7 | Element-zu-Asset-Bearbeitung im Graph in Phase 3 oder später? | Phase 3 / eigene Phase | Phase 3 (Nutzerwunsch), abgesichert durch AR-6. | offen |
| D8 | Wie werden Alternativ- und Fehlerpfade eines Process modelliert? | (a) Attribute `flow` + `condition` an `invokes`/`consists_of`; ein Eintrag mit `flow ≠ main` und gleichem `stepOrder` wie ein Hauptpfad-Schritt zweigt von diesem Schritt ab. (b) Jeder Alternativ-/Fehlerpfad ist ein eigener Sub-Process, verbunden über `triggers` mit Bedingung. (c) Keine Verzweigungen; Ablaufsicht bleibt linear. | **(a)**, beschränkt auf eine Verzweigungsebene je Schritt; tiefere Logik über Sub-Processes (Kombination mit b). Hält das Modell additiv (optionale Felder, alte Dateien gültig) und gibt der Ablaufsicht genau die Information, die sie braucht. (c) wird abgelehnt, weil gerade die Fehlerpfade sicherheitsrelevant sind. | offen |

---

## 8. Umsetzungsphasen

Jede Phase ist für sich lauffähig und einzeln rückbaubar. Commits innerhalb einer Phase müssen
jeweils eigenständig bauen und die Tests bestehen.

### Phase 0 — Netz und Gate G1

**Ziel:** Befund B1 entscheiden, bevor irgendetwas am Datenmodell geändert wird, und ein
Sicherheitsnetz vor dem Umbau spannen.

#### Gate G1 — Persistenz der A2A-Beziehungen (blockiert Phase 1)

G1 prüft zwei Dinge: **ob** A2A-Beziehungen persistiert werden, und **welcher Schreibpfad**
dafür verantwortlich ist. Das Zweite ist für den Graph entscheidend, weil Side Panel und Graph
denselben Relations-Service nutzen sollen und dafür klar sein muss, wo die Mutation heute
tatsächlich stattfindet (Hypothese aus §3.3.1: `useDFDData.updateAsset` auf `dfd.assets`).

**Prüfprotokoll (manuell, aktueller Build, ein Projekt mit mindestens zwei Assets
verschiedener Gruppen, z. B. Data + Function):**

| # | Schritt | Erwartung laut Code-Lektüre | Ist |
|---|---|---|---|
| 1 | DFD-Tab → Asset-Panel → Data-Asset wählen → Tab „Relations“ → A2A-Beziehung zum Function-Asset anlegen (z. B. `required_by`) | Beziehung erscheint in der Liste | |
| 2 | Tab wechseln und zurück | Beziehung weiterhin sichtbar (Mirror lebt in der Sitzung) | |
| 3 | Speichern | — | |
| 4 | `.tara.json` in einem Editor öffnen und nach der Zielasset-UUID bzw. `required_by` suchen | **kein** Treffer ausserhalb von `dfd.elements`/`connections`; `dfd.assets` ist `[]` | |
| 5 | Projekt schliessen, neu öffnen | — | |
| 6 | Asset erneut wählen → Tab „Relations“ | **Beziehung fehlt** | |
| 7 | Gruppenwechsel-Probe (B5): Beziehung erneut anlegen, dann Gruppe des Quell-Assets ändern, Relation im Tab ansehen | Relation mit veralteter Gruppe bzw. unzulässigem Typ bleibt stehen | |

**Automatisierte Entsprechung:** Roundtrip-Test über `updateAsset` → `prepareForDisk` →
`commitAssetSync` (Laden) sowie ein Test, der protokolliert, an welcher Stelle der Kette die
Relation verschwindet.

Umgesetzt in `src/tests/regression/a2a-relations-persistence.test.ts` (reiner Teil des Pfads:
Mutation auf `dfd.assets` wie `updateAsset`, dann `finalizeDfd` → `commitAssetSync` →
`serialiseProject` → `commitAssetSync(undefined, …)`). Ergebnis am `daacc38`:

| Stufe | Befund |
|---|---|
| 1 — Sitzung (`dfd.assets`) | Beziehung vorhanden |
| 2 — kanonischer Store (`project.assets`) | **Verlust.** `mapDFDAssetsToAssetFeature` übernimmt `DFDAsset.assetRelations` nicht; kein anderer Pfad schreibt A2A nach `project.assets` |
| 3 — Datei | nicht enthalten |
| 4 — Neuöffnen | Asset vorhanden, Beziehung fehlt |
| Migration `migrate_5_to_6` | v5-Beziehung geht verloren (`targetAssetId` wird umgebogen, danach `dfd.assets` verworfen) |

Stufen 2–4 und die Migration halten den **heutigen Verlust** fest (`not.…`-Assertions) statt rot zu
stehen: Jeder Commit bleibt für sich grün, und Phase 1 macht diese Tests gezielt rot — das Signal,
die Assertions umzukehren. `it.fails` wird bewusst nicht verwendet, weil es auch bei einem
Abbruch der Pipeline aus anderem Grund grün wäre. Gegenprobe: Ein `prepareForDisk`, das
`dfd.assets` behält, macht Stufe 3 und 4 rot.

Nicht automatisiert: Schritt 7 (B5, Gruppenwechsel), weil die Logik im Hook `useDFDData.updateAsset`
liegt. Sie wird in Phase 1 mit dem Relations-Service (AR-5) als reine Funktion testbar.

**Ergebnis G1:** ☐ PASS ☐ FAIL — Datum: ______ — Build/Commit: ______ — geprüft von: ______
**Tatsächlicher Schreibpfad:** ☐ wie §3.3.1 ☐ abweichend: ______________________

**Verzweigung:**

- **FAIL (erwartet):** Phase 1 wie beschrieben. Der Graph wird ausschliesslich auf dem neuen
  kanonischen Persistenzpfad aufgebaut; keine Graph-Arbeit (Phase 2) vor Abschluss von Phase 1.
  Zusätzlich: in den Release Notes der Version mit Phase 1 auf den bisherigen Datenverlust
  hinweisen (Projekte ab Schema 6 enthalten keine A2A-Beziehungen mehr; Wiederherstellung nur
  aus Backups `_migrated` bzw. Git-Historie vor der 5→6-Migration).
- **PASS (unerwartet):** Den tatsächlichen Pfad dokumentieren und §3.3/§3.3.1 korrigieren.
  Phase 1 schrumpft auf Konsolidierung: Regelwerk nach `shared` (AR-4), Relations-Service
  um den **vorhandenen** Pfad herum (AR-5), B5/B6 beheben. AR-3 (Rettungsmigration) entfällt
  bzw. wird neu bewertet. D1 bleibt offen, ist aber kein Muss mehr.

#### Weitere Arbeiten in Phase 0

- Migrationstest: v5-Fixture mit A2A-Beziehungen durch die Migrationskette. ✅ im G1-Test
  (`asset-uuid-migration-v5.tara.json` mit eingefügter Beziehung durch `migrate_5_to_6`).
- Test für B4: Asset mit `source: "manual"` erscheint nicht in `deriveDfdAssets`. ✅ bereits
  vorhanden: `src/tests/unit/app/utils/commit-asset-sync.test.ts`, „excludes manual-only assets
  from the derived dfd.assets“.
- Golden-Snapshot der heutigen `AssetReference[]`- und Impact-Ableitung (falls nicht schon durch
  Phase 0 des SSOT-Dokuments vorhanden).

**Ergebnis:** G1 entschieden und dokumentiert; Tests für B1/B4 vorhanden (bei FAIL halten sie den
Verlust fest, siehe oben), B5 über das manuelle Protokoll; Golden-Tests grün.
**Risiko:** keins.

### Phase 1 — A2A-Beziehungen kanonisch machen  ✅ *Safe-Stop*

**Voraussetzung:** Gate G1 entschieden. Umfang hängt vom Ergebnis ab (§8, Verzweigung).

**Ziel:** A2A-Beziehungen werden gespeichert, geladen und von allen Konsumenten aus einer Quelle
gelesen. Behebt B1, B3, B5, B6 und die Downstream-Anzeige.

- Entscheidung D1 umsetzen: neuer kanonischer Ort in `project.assets`, Typ in `shared`
  (ohne `sourceGroup`/`targetGroup`, AR-2).
- Regelwerke nach `shared` verschieben (AR-4), inkl. einer reinen Funktion, die für ein
  Quell-Asset alle Ziel-Assets in *gültig / nur umgekehrt gültig / ungültig* einteilt
  (Grundlage für FR-E4/E5, hier schon testbar). ✅ für A2A (v2.3, vor G1 vorgezogen):
  `shared/models/asset-a2a-rules.ts` mit `getAllowedA2ARelations`, `KERN_A2A_RELATIONS` /
  `getA2ARelationOptions` (KERN zuerst, markiert) und `classifyA2ATargets` (das Quell-Asset
  selbst ist immer ungültig). Element-zu-Asset-Regelwerk: siehe AR-4, Phase 3.
- Reiner Relations-Service (AR-5) inkl. Kaskade beim Asset-Löschen und Validierung gegen das
  Regelwerk. ✅ (v2.4, vor G1 vorgezogen): Typ `A2ARelation` in
  `shared/models/a2a-relation-types.ts` (eigene `id`, `sourceAssetId`, keine Gruppen-Kopien),
  Service in `shared/services/a2a-relation-service.ts`: Hinzufügen, Entfernen, Attribute ändern,
  Typ ändern (ID bleibt), Kaskade `removeA2ARelationsOfAsset`, `relationsOfAsset` für den
  Löschdialog, `validateA2ARelations` für Gruppenwechsel und Laden (meldet, löscht nicht),
  `sortA2ARelations` für AR-9. IDs werden injiziert, damit die Funktionen rein bleiben.
  Ablehnungsgründe: fehlende Quelle/Ziel, Selbstbeziehung, Typ nicht erlaubt, exaktes Duplikat.
  Noch nicht angeschlossen; das passiert mit dem Schema-Bump.
- Den heutigen Mutationsort (`useDFDData.updateAsset` für A2A, §3.3.1) durch den Service
  ersetzen: `AssetToAssetSelector`/`asset-description-form` schreiben über den Service; das
  `as any` auf `DFDAsset.assetRelations` entfällt; totes Feld `DFDAsset.assetToAssetRelations`
  entfernen; beide Form-Einstiege (`dfd-asset-panel`, `dfd-description-view`) beziehen Ziele aus
  der kanonischen Quelle (B6).
- Gruppenwechsel eines Assets validiert auch A2A-Relationen (ein- und ausgehend) gegen das
  Regelwerk (B5).
- Schema-Bump + Migration (AR-3), inkl. Anpassung `migrate_5_to_6`.
- `AssetData.a2aRelations` befüllen (AR-7), Löschdialog umstellen (AR-8), Audit-Diff und
  deterministische Serialisierung (AR-9).

**Tests:** Phase-0-Roundtrip jetzt grün; Migration v5/v6/v7 → neu; Service-Unit-Tests;
Ziel-Einteilung für alle Gruppenpaare; Idempotenz `canonicalStringify(JSON.parse(x)) === x`;
Side Panel unverändert bedienbar (NFR-6).
**Risiko:** mittel (Persistenz-Shape). Safe-Stop: Nach Phase 1 ist ein echter Fehler behoben,
auch wenn keine weitere Phase folgt.

### Phase 2 — Graph-Sicht, View Mode

**Voraussetzung:** Phase 1 abgeschlossen (bei G1 = FAIL zwingend).

**Ziel:** Lesen und Verstehen des Asset-Graphen, mit den UX-Prinzipien von Anfang an.
`stepOrder` wird nur als lineare Reihenfolge angezeigt; keine Verzweigungen (UX-8).

- View-Toggle im Asset-Tab (FR-V1, D2) und Einstieg „Im Graph zeigen“ aus der Tabelle (FR-V13).
- Reine Aufbereitungsfunktion (AR-11): Assets, A2A-Relationen, Element-Anker, Sicht,
  Preset/Ebenen, Fokus/Tiefe, Filter → Knoten, Kanten, Stummel, Context-Bar-Zähler.
- D3-Rendering mit `d3-force` + `forceY` je Ebene (D6), deterministisches Initial-Layout
  (AR-10), Fixierung nach dem Einschwingen (AR-12), Zoom/Pan nach Muster
  `attacktree-preview.tsx`, „Neu anordnen“ (FR-V3, FR-V12).
- Codierung nach UX-3, Hervorhebungs-Rangfolge nach UX-4, Legende (FR-V7).
- Presets (FR-V2), Stummel (FR-V4), Fokus-Sicht (FR-V5), Element-Anker (FR-V6),
  Context Bar (FR-V14).
- Detailpanel im Lesemodus (FR-V8), DFD-Navigation (FR-V9), Filter/Suche mit
  „warum nicht sichtbar“-Hinweis (FR-V10).
- i18n, Theme (NFR-2, NFR-3).

**Tests:** Aufbereitung als Unit-Tests (Stummel-Zählung, Fokus-Tiefe, Filter, Preset-Auflösung,
Context-Bar-Zähler); Stabilitätstest: Filter-/Tiefenwechsel verändert Positionen sichtbarer
Knoten nicht; Snapshot der Knoten/Kanten-Menge für ein Referenzprojekt.
**Risiko:** gering (rein lesend). Hier bereits Schulungs- und Review-Nutzen.

### Phase 3 — Edit Mode

**Ziel:** Modellieren direkt im Graphen, ohne den Kontext zu verlieren. Keine Erfassung von
Pfadtypen oder Bedingungen (UX-8, erst Phase 4).

- Mode-Umschalter mit visueller Unterscheidung (FR-E1, UX-2).
- Asset anlegen je Ebene (FR-E2) mit Sichtbarkeit im DFD (FR-E3, D4).
- Connection Handles, Zielhervorhebung während des Ziehens, Typ-Chooser, Richtungshilfe
  (FR-E4, FR-E5), Attribute im Detailpanel (FR-E6) — ausschliesslich über den Relations-Service
  aus Phase 1 und die Ziel-Einteilung aus dem Regelwerk.
- Element-zu-Asset-Beziehung über Detailpanel bzw. Element-Anker (FR-E7) mit
  App-Schicht-Callback (AR-6).
- Löschen mit Folgenanzeige (FR-E8), Undo/Redo (FR-E9), „Graph wächst“ (FR-E11).
- Tastaturbedienung (NFR-4); optional lokale Positionsspeicherung (FR-V15).

**Tests:** jede Graph-Aktion erzeugt denselben Projektzustand wie die entsprechende
Side-Panel-Aktion (FR-E10); Asset aus dem Graph überlebt DFD-Edit und Save/Reopen;
nach dem Anlegen einer Beziehung sind alle zuvor sichtbaren Knoten unverändert positioniert.
**Risiko:** mittel (zusätzliche Editier-Oberflächen; abgesichert durch einen Schreibpfad).

### Phase 4 — Process-Sicht und Modell-Erweiterungen

**Ziel:** Die Erkenntnisse aus der Schulung im Modell und in der Darstellung verankern.

- **Zuerst** Entscheidung D8 (Modellierungsentscheidung, nicht UX), dann Kompositionsbeziehung
  (FR-P1, D5) und Verzweigungs-Semantik (FR-P7): Typen, Regelwerk,
  i18n, Aktualisierung von `taraflow-asset-zu-asset-beziehungen.md` und Cheatsheet. Additive,
  optionale Felder — bestehende Dateien bleiben gültig.
- Process-Ablaufsicht als eigene Darstellung (FR-P2).
- Validierungen FR-P3 … FR-P5, Markierung im Graph (FR-P6).
- Optional: Hazard Items zuschaltbar (FR-V11).
- Doku: Abschnitt „Function vs. Process“ und Naming-Konvention (§1.1) in die Beziehungsdokumente
  übernehmen.

**Risiko:** gering bis mittel (additive Typ-Erweiterung).

### Nicht in diesem Plan

- Analytische Wirkung der A2A Core Rules (B2): STRIDE-Ableitung, `hazardDistance`,
  Propagationsgrenzen. Benötigt ein eigenes Design-Dokument und berührt den Threat-Generator.
  Die Graph-Sicht ist dafür die Voraussetzung, nicht der Ersatz.
- UseCase-Analyse (eigenes Konzept).

---

## 9. Definition of Done (gesamt)

- Gate G1 ist entschieden und das Ergebnis in §8 dokumentiert.
- A2A-Beziehungen überleben Speichern, Neuöffnen und Migration aus v5/v6/v7.
- Genau ein Schreibpfad für A2A-Beziehungen und genau einer für Element-zu-Asset-Beziehungen,
  unabhängig davon, ob Side Panel, DFD-Form, Detailpanel oder Graph-Leinwand die Änderung auslöst.
- `features/assets` importiert nichts aus `features/dfd`; Regelwerke liegen in `shared`.
- Graph-Sicht mit Ebenen- und Fokus-Sicht, Presets, Context Bar, Stummeln und Detailpanel;
  Codierung und Hervorhebungen nach UX-3/UX-4; bestehende Knoten bewegen sich nur über
  „Neu anordnen“.
- Edit Mode mit Asset-Anlage, Connection Handles mit Zielhervorhebung, Typ-Chooser inkl.
  Richtungshilfe, Element-Anbindung und Löschen mit Folgenanzeige.
- Keine Sicht zeigt Semantik, die das Datenmodell nicht ausdrückt (UX-8).
- Kompositionsbeziehung, Verzweigungs-Semantik und Process-Ablaufsicht vorhanden; Validierungen
  melden Naming-Duplikate, Spiegelduplikate und `stepOrder`-Lücken.
- `canonicalStringify`-Idempotenz und AVE-TCS-Prüfung weiterhin grün.
- i18n en/de vollständig.

---

## 10. Hinweise für das externe Review

Die Reviews der Runden 1 (UX) und 2 (Struktur, Gate) sind eingearbeitet. **Offen sind die technischen Prüffragen:**

1. **Befund B1** (§3.3): Ist die Kette `asset-description-form` → `DFDAsset.assetRelations` →
   `prepareForDisk` (leert `dfd.assets`) → `deriveDfdAssets` (übernimmt keine A2A) →
   Verlust korrekt gelesen, oder gibt es einen zweiten Pfad, der A2A-Beziehungen in
   `assets.assets` schreibt? Relevante Dateien: `src/features/dfd/components/forms/asset-description-form.tsx`,
   `src/app/services/prepare-for-disk.ts`, `src/app/utils/asset-to-dfd-mapper.ts`,
   `src/app/utils/commit-asset-sync.ts`, `src/app/services/versions/migrate-5-to-6.ts`.
   Ist der Schreibpfad in §3.3.1 vollständig, insbesondere: gibt es neben
   `useDFDData.updateAsset` weitere Stellen, die `dfd.assets[].assetRelations` mutieren
   (Import, Hazard-Mint, Asset-Tab)? Die manuelle Prüfung erfolgt über Gate G1.
   **Antwort (Code-Suche, `daacc38`):** Die Kette ist korrekt gelesen, mit einer Präzisierung: Der
   Verlust passiert schon vor `prepareForDisk`, weil `mapDFDAssetsToAssetFeature` die A2A nicht
   in den Feature-Store trägt. Es gibt keinen Pfad, der A2A in `assets.assets` schreibt. Beide
   Form-Einstiege landen in `useDFDData.updateAsset`: das Side Panel über
   `dfd-tab.handleAssetChange`, die Beschreibungsansicht über `useDFDEditor.updateAssetDescription`.
   Asset-Tab und Hazard-Bridge mutieren keine A2A (die Bridge legt nur neue Human-Assets an).
   **Zweiter Schreibweg:** `useDFDExportImport.importDFD` setzt `project.dfd.assets = data.assets`
   direkt aus der DFD-Exportdatei. Enthält ein Export A2A-Beziehungen, landen sie am Mirror vorbei
   an `updateAsset` und gehen beim Speichern ebenso verloren. Phase 1 muss diesen Weg über den
   Relations-Service (AR-5) führen und das Exportformat (`DFDExportData`) berücksichtigen.
2. **D1** (Kantenliste vs. quellenseitig): Gibt es Gründe für (b), die übersehen wurden?
3. **AR-3**: Ist eine nachträgliche Anpassung von `migrate_5_to_6` vertretbar, oder sollte die
   Rettung in einem neuen Migrationsschritt erfolgen (der dann aber keine Daten mehr vorfindet)?
4. **D4 / B4**: Führt `source: "dfd"` für graph-erzeugte Assets zu Problemen in `syncFromDFD`
   (Pruning von Assets, die nicht in `dfd.assets` stehen)?
5. **AR-6**: Ist der App-Schicht-Callback für Element-zu-Asset-Änderungen aus `features/assets`
   heraus sauber mit `finalizeDfd` und `commitAssetSync` vereinbar?
6. **AR-12 / D6**: Reicht Fixierung per `fx`/`fy` in `d3-force` für die geforderte Stabilität,
   oder braucht es ein inkrementelles Layout-Verfahren?
7. **D8**: Ist die Verzweigungs-Semantik (a) ausdrucksstark genug für realistische Abläufe
   (z. B. Firmware-Update mit Rollback), ohne zur Workflow-Engine zu werden?
8. **Phasen-Schnitt**: Ist jede Phase eigenständig lieferbar, und ist Phase 1 wirklich ein
   sicherer Haltepunkt?

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>
