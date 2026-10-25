# TARAflow — Asset-Graph: Process-Sicht und Modell-Erweiterungen (Phase 4)

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>

> **Status:** Entwurf v1.1 (2026-10-13). Noch nichts umgesetzt. v1.1: Befund B16 (Beziehungsdokumente
> weichen vom Regelwerk ab), Entscheidung D13, Anforderungen DOC-1/DOC-2.
> **Herkunft:** Phase 4 aus `doc/Done/DFD/asset-graph-view-requirements.md` (v2.26; Phasen 0–3
> umgesetzt und released in `v0.13.0-alpha`). Übernommen sind ausserdem die dort offen gebliebenen
> Punkte AR-7/B12 (Downstream-Spalte) und der Referenz-Snapshot aus Phase 2. Die Anforderungen
> behalten ihre IDs, damit Commits, Tests und Code-Kommentare weiter auf sie verweisen können.
> **Ablage:** `doc/Open/DFD/asset-graph-process-view-requirements.md`
> **Code-Stand:** `v0.13.0-alpha` (Schema 8).
> **Konvention:** Prosa Deutsch, Identifier/Typen/Code englisch.
> **Bezug:** `taraflow-asset-zu-asset-beziehungen.md`, `taraflow-beziehungen-cheatsheet.md`,
> `doc/Open/taraflow-usecase-konzept.md`.

---

## 1. Ziel

Die Asset-Graph-Sicht zeigt seit `v0.13.0-alpha`, wie Assets über die Ebenen zusammenhängen, und
erlaubt, sie dort zu modellieren. Was sie noch nicht kann: **Abläufe** lesbar machen. Ein Process
Asset ist eine geordnete Folge von Schritten mit Daten zwischen den Schritten, mit Alternativ- und
Fehlerpfaden und mit Sub-Processes. Im allgemeinen Graphen ist das ein Knoten mit nummerierten
`invokes`-Kanten — die Reihenfolge ist ablesbar, der Ablauf nicht.

Phase 4 verankert die Erkenntnisse aus der Schulung (2026-09-29) im **Modell** (Komposition,
Verzweigungen), in der **Darstellung** (eigene Ablaufsicht) und in **Validierungen** (Lücken,
Duplikate, Function/Process-Paare). Dazu kommen die Abhängigkeitsrichtung je Beziehungstyp für die
Downstream-Spalte (AR-7/B12) und ein Referenz-Snapshot der Graph-Sicht.

## 2. Fachlicher Hintergrund (aus der Schulung)

- **Process ist orthogonal, nicht vertikal.** Die vertikale Hierarchie ist
  Data → Function → System → Infrastructure. Process schneidet quer: ruft Functions auf
  (`invokes`), läuft auf Systems (`runs_on`), wird von Humans bedient (`operated_by`).
- **Process ≠ UseCase.** Ein UseCase lässt sich als Process (oder Process-Kette) modellieren, aber
  nicht jeder Process ist ein UseCase (Bootsequenz, Regelzyklus, Watchdog haben keinen Actor). Eine
  Gleichsetzung wird nicht festgelegt.
- **Processes sind hierarchisch.** Ein Process kann aus Sub-Processes bestehen. Das Regelwerk hat
  dafür heute keine Kompositionsbeziehung (`triggers`, `depends_on`, `suspends` drücken kein
  „ist Teil von“ aus).
- **Processes haben Alternativ- und Fehlerpfade.** Angriffe setzen oft genau dort an
  (Fehlerbehandlung, Fallback, Abbruch mitten im Update, TOCTOU zwischen Prüf- und
  Ausführungsschritt). `stepOrder` bildet heute nur eine lineare Ordnung ab.
- **Function vs. Process:** Eine Function ist eine Fähigkeit (*was*), ohne zeitliche Struktur. Ein
  Process ist ein Ablauf (*wie/wann*) mit Auslöser, geordneten Schritten inkl. Alternativ-/
  Fehlerpfaden und Endzustand. Testfrage: *Entsteht ein eigener Threat, wenn die Reihenfolge
  manipuliert, ein Schritt übersprungen oder zwischen zwei Schritten eingegriffen wird?*
  Ja → Process. Beides zugleich ist legitim und wird über `Process ─implements→ Function`
  verbunden.
- **Naming-Konvention (Empfehlung):** Functions als Substantiv der Fähigkeit („Signaturprüfung“),
  Processes als Verbphrase oder „-Ablauf“ („Firmware-Update durchführen“); ID-Präfixe FU-, PR-.

## 3. Ausgangslage (`v0.13.0-alpha`)

- Asset Links sind kanonisch in `assets.relations[]` gespeichert (`A2ARelation`, eigene `id`,
  Attribute `stepOrder`, `rationale`, `notes`, `degradationMode`, `degradationDescription`).
  Einziger Schreibweg ist der Relations-Service (`applyA2AOps`, AR-5).
- Regelwerk in `shared/models/asset-a2a-rules.ts`: erlaubte Typen je Gruppenpaar, KERN-Kennzeichnung,
  Ziel-Einteilung, Spiegelpaare (`A2A_MIRROR_PAIRS`), inverse Namen. Process → Process erlaubt heute
  `triggers`, `depends_on`, `suspends`.
- `stepOrder` wird nur für `invokes` und `configures` angeboten (`A2A_STEP_TYPES`).
- Graph-Sicht (`features/dfd/asset-graph`): Ebenen- und Fokus-Sicht, Detailkarten, Edit Mode,
  Befund-Symbol an Kanten und Quellknoten für Links, die das Regelwerk nicht mehr erlaubt
  (UX-4 Stufe 4). Die Aufbereitung ist eine reine Funktion (`buildAssetGraph`, AR-11).
- Validierung: `validateA2ARelations` (Asset-Tab und DFD-Hinweise) meldet unzulässige Typen,
  fehlende Endpunkte und Selbstbezüge. Der Beziehungsdialog weist auf Spiegelpaare hin (FR-E12),
  verhindert sie aber nicht.
- Asset-Tabelle: Spalte „Asset Links“ (gelesen vom gelisteten Asset). Die Spalte „Downstream“
  bekommt keine Daten und zeigt „–“ (B12).

### 3.1 Befund B16 — Beziehungsdokumente weichen vom Regelwerk ab

Beim Aufräumen von `doc/` (2026-10-13) fiel auf, dass die Beziehungsdokumente Typen und Richtungen
beschreiben, die das Regelwerk im Code nicht kennt. Massgeblich ist der Code: Element → Asset nach
`getAllowedRelations` (`features/dfd/models/asset-constants.ts`), Asset → Asset nach
`ALLOWED_A2A_RELATIONS` (`shared/models/asset-a2a-rules.ts`). Der Dialog und der Validator folgen
seit `v0.13.0-alpha` ausschliesslich diesem Regelwerk (B15) — was die Dokumente darüber hinaus
beschreiben, lässt sich nicht modellieren bzw. wird als unzulässig gemeldet.

| # | Stelle | Dokument sagt | Regelwerk (Code) |
|---|---|---|---|
| 1 | `taraflow-asset-beziehungen.md`, „Physical Boundary — Asset-Beziehungen“ | `Physical Asset located_in PhysicalBoundary`, `Infrastructure secured_by PhysicalBoundary`, `System Asset depends_on PhysicalBoundary` — Richtung Asset → Boundary | Element → Asset: PhysicalBoundary → System `is_an`, `depends_on`; → Infrastructure `is_an`, `secures`, `powers`; → Physical `is_an`, `secures`, `accesses`, `damages`. `secured_by` gibt es nicht; `located_in` gibt es nur als Asset Link Physical → Infrastructure. |
| 2 | `taraflow-asset-beziehungen.md`, „Chip Boundary — Asset-Beziehungen“ | MCU `uses` Firmware (Data), MCU `hosts` Bootloader (Function), Process `depends_on` SE ChipBoundary | ChipBoundary → Data `reads`, `stores`, `modifies`; → Function `implements`, `depends_on`; → System `is_an`, `uses`, `depends_on`. `hosts` ist nur ein Asset Link Physical → System; Element → Element ist keine Asset-Beziehung. |
| 3 | `taraflow-beziehungen-cheatsheet.md`, PhysicalBoundary | „connectables DFD-Element … DataFlows terminieren via Interface-Symbol auf der Boundary-Kante“; Tabelle nur mit Physical/Infrastructure | Kein DataFlow darf direkt an einer PhysicalBoundary enden (`validatePhysicalBoundaryConnections`); Zugang über Interfaces auf dem Rand — so beschreibt es `taraflow-asset-beziehungen.md` richtig. Es fehlen Infrastructure `powers` und System `is_an`/`depends_on`. |
| 4 | Cheatsheet: Human-Tabelle und „Function → Human“ | `affects_safety` als aktive Beziehung | In keiner erlaubten Liste. `taraflow-asset-beziehungen.md` führt es als *deprecated* (ersetzt durch `endangers`); Typ, inverser Name und CIANAAA-Ableitung existieren noch im Code. |
| 5 | `taraflow-asset-beziehungen.md` | `belongs_to` (Data → Human, dokumentarisch), `contains` (hierarchische Assets) | Nicht im Regelwerk. `contains` überschneidet sich mit `consists_of` (D5). |
| 6 | Cheatsheet und `taraflow-asset-zu-asset-beziehungen.md` | `administered_to`, `treats`, `diagnoses`, … (Medizin, „dokumentarisch“) | Nicht im Regelwerk. |

Kein Befund: `contributes_to` ist eine Hazard-Relation (`hazards.relations`), keine Element- oder
Asset-Beziehung; `hosts`/`controlled_by` sind gültige Asset Links Physical → System.

Ursache ist strukturell: Die Matrizen stehen zweimal — im Code und als Prosa/Tabelle in den
Dokumenten — und nichts hält beide gleich. DOC-2 schliesst das.

## 4. Entscheidungen

### 4.1 Übernommen (entschieden)

| ID | Frage | Entscheidung |
|---|---|---|
| D5 | Name der Kompositionsbeziehung | `consists_of [step]` (Richtung: Parent → Child), Spiegel `part_of` nur zur Anzeige. |
| D8 | Alternativ- und Fehlerpfade | **(a)** Attribute `flow` (`main` \| `alternative` \| `error`, Default `main`) und `condition` (Freitext) an `invokes`/`consists_of`; ein Eintrag mit `flow ≠ main` und gleichem `stepOrder` wie ein Hauptpfad-Schritt zweigt von diesem Schritt ab. Eine Verzweigungsebene je Schritt; tiefere Logik über Sub-Processes. Keine Verzweigungen (c) abgelehnt, weil gerade die Fehlerpfade sicherheitsrelevant sind. |

### 4.2 Offen

| ID | Frage | Optionen | Empfehlung |
|---|---|---|---|
| D10 | Abhängigkeitsrichtung je A2A-Typ (für Downstream, AR-7/B12) | (a) Tabelle je Typ: *Ziel hängt von Quelle ab* / *Quelle hängt vom Ziel ab* / *keine Abhängigkeit*; (b) Downstream nur für eine feste Typ-Liste; (c) Spalte entfernen | (a), als Daten im Regelwerk neben den inversen Namen, mit Test „jeder Typ ist eingeordnet“. Beispiele: `required_by`, `configures`, `triggers`, `powers`, `houses` → Ziel hängt von Quelle ab; `depends_on`, `runs_on`, `hosted_on`, `powered_by` → Quelle hängt vom Ziel ab. |
| D11 | Wo öffnet die Ablaufsicht? | (a) eigene Ansicht im DFD-Tab neben dem Asset-Graph; (b) Modus der Graph-Sicht, Einstieg über einen Process-Knoten („Als Ablauf zeigen“); (c) Dialog | (b): ein Process ist dort schon ausgewählt, Rückweg über denselben Umschalter wie Ebenen/Fokus; kein vierter Ansichtsknopf. |
| D13 | Umgang mit Typen, die nur in den Dokumenten stehen (B16 Nr. 4–6) | (a) aus den Dokumenten streichen; (b) als „nicht im Regelwerk / geplant“ markieren; (c) ins Regelwerk aufnehmen | `affects_safety`: (a), es ist durch `endangers` ersetzt — im Code dann ebenfalls entfernen (Typ, inverser Name, Ableitung; ein Projekt mit altem Wert meldet der Validator). `contains`: (a) zugunsten von `consists_of` (D5). `belongs_to`, Medizin-Typen: (b) — bewusst dokumentarische Erweiterungen, bis ein Referenzfall sie braucht. |
| D12 | Schema-Version für `consists_of`, `flow`, `condition` | (a) neue Schema-Version 9; (b) keine: additive, optionale Felder und ein neuer Typ | (b), wie bei `v0.12.0-alpha` (neue Daten in optionalen Feldern). Ältere Versionen öffnen die Datei weiter, melden `consists_of` aber als unzulässigen Typ — das steht im Changelog. |

## 5. Anforderungen

### 5.1 Modell

| ID | Anforderung | Verb. |
|---|---|---|
| FR-P1 | **Kompositionsbeziehung** Process → Process: `consists_of [step]`, Spiegel `part_of` nur zur Anzeige (D5). Gleicher `stepOrder`-Qualifier wie `invokes` (Aufnahme in `A2A_STEP_TYPES`). Aufnahme in `A2ARelationType`, Regelwerk (inkl. KERN, inverser Name, Spiegelpaar), i18n, Beziehungsdokument und Cheatsheet. | MUSS |
| FR-P7 | **Verzweigungs-Semantik** (D8): `invokes` und `consists_of` tragen optional `flow` und bei `alternative`/`error` eine `condition`. Bearbeitbar in Kantenkarte und Beziehungsdialog (dieselbe Form, keine dritte Bearbeitungslogik). Ohne FR-P7 zeigt die Ablaufsicht nur den Hauptpfad und kennzeichnet das sichtbar. | MUSS |

### 5.2 Darstellung

| ID | Anforderung | Verb. |
|---|---|---|
| FR-P2 | **Process-Ablaufsicht** (D11; unterliegt UX-8 — keine Semantik zeigen, die das Modell nicht ausdrückt): eigene Darstellung, kein weiteres Layout des allgemeinen Graphen. Auslöser oben, Schritte aus `invokes` und `consists_of` nach `stepOrder` in Leserichtung, je Schritt die aufgerufene Function, zwischen den Schritten die ein- und ausfliessenden Data (`required_by`, `configures [step]`, `creates`/`modifies`), Alternativ- und Fehlerpfade als Abzweig vom jeweiligen Schritt (FR-P7), Endzustand unten. Sub-Processes aufklappbar. | SOLL |
| FR-P6 | Validierungsbefunde aus FR-P3 … FR-P5 erscheinen als Symbol am Knoten/an der Kante in Graph- und Ablaufsicht (UX-4 Stufe 4, wie die bestehenden Link-Befunde) und in der Detailkarte mit Erläuterung. | KANN |
| FR-V11 | Hazard Items aus `hazards.relations` können in der Graph-Sicht zugeschaltet werden (read-only, eigene Knotenform, `contributes_to`/`endangers`-Kanten; Preset „Schutzziele“). **Umgesetzt** (2026-10-25, als MUSS): `doc/Done/DFD/asset-graph-hazards-and-node-move.md`. | KANN |

### 5.3 Validierungen

| ID | Anforderung | Verb. |
|---|---|---|
| FR-P3 | Doppelte oder lückenhafte `stepOrder`-Werte im Hauptpfad eines Process → Warnung. | SOLL |
| FR-P4 | Function und Process mit gleichem (normalisiertem) Namen ohne `implements`-Kante zwischen ihnen → Warnung. | SOLL |
| FR-P5 | Spiegelduplikate (`A implements B` **und** `B implemented_by A`, allgemein `A2A_MIRROR_PAIRS`) sowie die Konfliktpaare aus `taraflow-asset-zu-asset-beziehungen.md` §3.3 → Warnung. | SOLL |

Alle Validierungen melden nur, sie ändern nichts — wie die bestehenden Link-Befunde. Sie erscheinen
im Asset-Tab und in den DFD-Hinweisen; ein Klick führt in der aktuellen Ansicht zum Asset (D9).

### 5.4 Aus der Asset-Graph-Sicht übernommen

| ID | Anforderung | Verb. |
|---|---|---|
| AR-7 | Die Spalte „Downstream“ der Asset-Tabelle zählt nach der Abhängigkeitsrichtung je Typ (D10) aus der kanonischen Quelle `assets.relations`; Beschreibung der Spalte entsprechend. Bis D10 entschieden ist, bleibt sie leer (B12). | MUSS |
| T-1 | **Referenz-Snapshot** der Graph-Sicht: Knoten- und Kantenmenge von `buildAssetGraph` (Ebenen- und Fokus-Sicht) für die Beispielprojekte aus `src/tests/examples` (TARAflow_Examples). Erweitert um einen Process mit Komposition und Verzweigung, sobald FR-P1/FR-P7 da sind. | MUSS |

### 5.5 Dokumentation

| ID | Anforderung | Verb. |
|---|---|---|
| DOC-1 | **Abgleich der Beziehungsdokumente mit dem Regelwerk** (B16): `taraflow-asset-beziehungen.md` (Abschnitte Physical Boundary und Chip Boundary), `taraflow-beziehungen-cheatsheet.md` und `taraflow-asset-zu-asset-beziehungen.md` beschreiben genau die Typen und Richtungen des Codes. Typen ausserhalb des Regelwerks nach D13. Dazu die neuen Typen aus FR-P1/FR-P7 sowie „Function vs. Process“ und die Naming-Konvention (§2). | MUSS |
| DOC-2 | **Eine Quelle für die Matrizen:** Die Tabellen „Element → Asset“ (je Elementtyp und Gruppe) und „Asset → Asset“ (je Gruppenpaar) werden aus dem Code erzeugt (Skript) und in die Dokumente zwischen festen Markierungen eingesetzt. Ein Test schlägt fehl, wenn der eingesetzte Abschnitt nicht mehr dem Code entspricht. Die Prosa erklärt, die Tabelle gilt. | SOLL |

### 5.6 Nicht-funktional

| ID | Anforderung | Verb. |
|---|---|---|
| NFR-2 | Alle neuen Texte i18n en/de (Typen, inverse Namen, Sätze, Pfadtypen, Befunde, Ablaufsicht). | MUSS |
| NFR-5 | Tests: Regelwerk (jeder neue Typ mit Label, inversem Namen, Satz; Spiegelpaar), Relations-Service (neue Attribute), Validierungen als reine Funktionen, Ablauf-Aufbereitung als reine Funktion, Roundtrip Speichern/Laden, Komponententests für Kantenkarte und Ablaufsicht. | MUSS |
| NFR-7 | Bestehende Dateien (Schema 8) bleiben gültig und unverändert lesbar; ohne `flow` gilt `main` (D12). | MUSS |

## 6. Umsetzungsschritte

Jeder Schritt ist für sich lieferbar.

1. **Entscheidungen D10–D13** treffen (D10, D12 und D13 sind Modellierungsfragen, D11 ist UX).
2. **Doku-Abgleich** (DOC-1 Teil B16, DOC-2): zuerst die bestehenden Abweichungen beheben und die
   Matrizen aus dem Code erzeugen, damit die Erweiterungen in Schritt 3 auf einer stimmigen
   Grundlage dokumentiert werden. Unabhängig vom Rest lieferbar.
3. **Modell** (FR-P1, FR-P7, NFR-7): Typ, Regelwerk, Attribute, Relations-Service, Kantenkarte und
   Beziehungsdialog, i18n; die neuen Typen, „Function vs. Process“ und die Naming-Konvention (§2)
   in die Beziehungsdokumente (DOC-1).
4. **Validierungen** (FR-P3 … FR-P5) als reine Funktionen in `shared`, angebunden an Asset-Tab und
   DFD-Hinweise; dann FR-P6 in der Graph-Sicht.
5. **Ablaufsicht** (FR-P2): reine Aufbereitung (Process → Schritte, Daten, Abzweige,
   Sub-Processes), dann die Darstellung.
6. **Downstream** (AR-7) nach D10.
7. **Referenz-Snapshot** (T-1), zuerst für den heutigen Stand, später um Process-Beispiele erweitert.
8. Optional **Hazard Items** im Graph (FR-V11).

**Risiko:** gering bis mittel — additive Typ-Erweiterung; die Ablaufsicht ist neue Oberfläche, aber
lesend.

## 7. Definition of Done

- `consists_of` und die Verzweigungs-Attribute sind im Modell, im Regelwerk, in Kantenkarte und
  Dialog vorhanden; alte Dateien öffnen unverändert.
- Die Ablaufsicht zeigt einen Process mit Schritten, Daten, Alternativ-/Fehlerpfaden und
  aufklappbaren Sub-Processes und zeigt nichts, was das Modell nicht ausdrückt (UX-8).
- Validierungen melden `stepOrder`-Lücken und -Duplikate, Function/Process-Namensgleichheit ohne
  `implements` und Spiegelduplikate — ohne etwas zu ändern.
- Downstream zählt nach der festgelegten Richtung je Typ.
- Referenz-Snapshot der Graph-Sicht für die Beispielprojekte vorhanden.
- Beziehungsdokumente und Cheatsheet stimmen mit dem Regelwerk überein (B16 erledigt); die
  Matrizen in den Dokumenten sind aus dem Code erzeugt und durch einen Test gesichert.
- i18n en/de vollständig; `canonicalStringify`-Idempotenz und AVE-TCS-Prüfung weiterhin grün.

## 8. Nicht in diesem Plan

- **Analytische Wirkung der A2A-Beziehungen** (B2): STRIDE-Ableitung, `hazardDistance`,
  Propagationsgrenzen. Braucht ein eigenes Design-Dokument und berührt den Threat-Generator; die
  Graph-Sicht ist dafür die Voraussetzung, nicht der Ersatz.
- **UseCase-Analyse** (Sequenz von DFD-Elementen, Ebene 0): `doc/Open/taraflow-usecase-konzept.md`.
  UseCase und Process Asset bleiben getrennte Konzepte.
- **Hazard-Relationen im Audit-Diff** (B8): eigener Punkt.
