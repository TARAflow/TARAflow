# Umsetzungsplan: Hazard Item & kombinatorische Gefährdungen

Implementierung der Hazard-Item-Erweiterung in TARAflow
(Electron · React · TypeScript · MUI · draw.io · i18next).

> **Code-Kommentare immer in Englisch** — auch wenn dieses Dokument deutsch ist.

---

## Übersicht

| | |
|---|---|
| **Phasen** | 8 (Phase 0 + 1–7) |
| **Diskrete Änderungen** | ~39 |
| **MVP-Schnitt** | Phase 0 + 1–3 + eingeklappte Darstellung (Phase 4 minimal) |
| **Vollständig** | alle Phasen (Importer separat, siehe Feature-Spec) |

**Architektur-Prinzip:** vertikaler Slice — neuer Feature-Slice (Hazard Tab) und
Datenmodell zuerst, dann nach oben durch Validierung, Analyse, DFD, UI.
Jede Phase ist für sich testbar.

**Verhältnis zu den anderen Dokumenten:**
- `taraflow-feature-spec-safety-hazard-import.md` — fachliche Spec für **Import**,
  Regulatory Profile, Safety Analysis Mode. Der **Importer wird dort beschrieben und
  später umgesetzt** — dieses Dokument verweist nur darauf.
- `taraflow-asset-beziehungen.md` / `taraflow-asset-zu-asset-beziehungen.md` —
  das Beziehungs- und Hazard-Item-Datenmodell (contributes_to / endangers).

**Sequenzierung (Abhängigkeiten):**

```
Phase 0 (Hazard Tab / Feature-Slice)
   └─► Phase 1 (Datenmodell)
          ├─► Phase 2 (Validierung)
          ├─► Phase 3 (Ableitung/Analyse)
          └─► Phase 4 (DFD/draw.io)
                   └─► Phase 5 (UI)
                          └─► Phase 6 (i18n + Doku-Gen)
Phase 7 (Migration + Reference Cases + Tests) — durchgehend, Abschluss am Ende
```

---

## Phase 0 — Hazard Tab & Feature-Slice

**Ziel:** Ein neuer Feature-Slice `hazard` mit eigenem Tab, der als **Single Source
of Truth** für alle Hazard Items dient. Sichtbarkeit über einen Safety-Toggle im
Overview gesteuert. Noch keine Verknüpfungslogik — nur der strukturelle Rahmen.

**Zwei orthogonale Schalter im Overview Tab:**

| Schalter | Werte | Wirkung |
|---|---|---|
| Methode | Standard / Critical | Reihenfolge Threats ↔ Attack Trees (bestehend) |
| Safety | an / aus | Hazard Tab ein-/ausblenden (neu) |

**Resultierende Tab-Reihenfolge:**

| Methode | Safety | Workflow |
|---|---|---|
| Standard | aus | Overview → DFD → Assets → Threats → Risks → Attack Trees |
| Standard | an | Overview → **Hazard** → DFD → Assets → Threats → Risks → Attack Trees |
| Critical | aus | Overview → DFD → Assets → Attack Trees → Threats → Risks |
| Critical | an | Overview → **Hazard** → DFD → Assets → Attack Trees → Threats → Risks |

Der Hazard Tab sitzt immer direkt nach Overview, vor DFD — unabhängig von der Methode.

**Änderungen:**

0a. **Feature-Slice `hazard`** anlegen (analog zu dfd/assets/threats/risks/attacktree/doc/audit).
    Ordnerstruktur, Routing, leerer Tab-Container.

0b. **Safety-Toggle** im Overview Tab (`project-info.tsx`): boolesches Feld
    `safetyRelevant` in `ProjectInfoData` / `Project`. Default `false`.
    (Auto-Vorschlag: bei Regulatory Profile machinery/medical/automotive/industrial
    → Toggle automatisch auf `true` setzen — siehe Feature-Spec offene Frage 4.)

0c. **Tab-Sichtbarkeit & Reihenfolge** an `safetyRelevant` koppeln.
    Hazard Tab nur gerendert wenn `safetyRelevant === true`, Position nach Overview.

0d. **Hazard-Übersicht** im Tab: Liste aller Hazard Items mit Schutzziel-Spalte
    (Human/Environment/Infrastructure), physicalHazardPotential, Quelle
    (manuell / importiert / aus Graph). Read-only in dieser Phase — CRUD kommt in Phase 5.

0e. **Single Source of Truth:** Hazard Items werden ausschliesslich hier definiert.
    Der DFD Tab referenziert sie nur (Verknüpfung via `contributes_to`, Phase 4).
    **Bidirektionale Synchronisation ist Pflicht:** Wird im DFD ein Hazard erzeugt,
    muss es sofort als Hazard Item im Tab existieren. Wird es im Tab umbenannt/gelöscht,
    zieht das DFD sofort nach. Es darf nie zwei Wahrheiten geben. Empfehlung: zentraler
    Hazard-Store, beide Tabs sind nur Views darauf.

0f. **Import-Platzhalter:** Button "Import" sichtbar aber deaktiviert/Stub —
    verweist auf die spätere Umsetzung gemäss Feature-Spec.

**Definition of Done:** Safety-Toggle schaltet den Hazard Tab ein, der Tab erscheint
an korrekter Position, zeigt eine (leere) Hazard-Liste. Methode-Schalter bleibt
davon unberührt.

---

## Phase 1 — Datenmodell (Foundation)

**Ziel:** Alle Typen existieren, das Modell kann Hazard Items, Environment und die
neuen Kanten halten. Noch keine Logik, keine UI.

**Änderungen:**

1. **`HazardItem`-Typ** definieren (neuer Knotentyp, kein Asset).
   Felder: `id`, `label`, `hazardType?`, `physicalHazardPotential?`, `externalRef?`,
   `rationale?`, **`combinationType: 'ANY' | 'ALL'`** (Default `ANY`).
   → vermutlich neue Datei `hazard-types.ts` (analog zu `asset-types.ts`).

   > **`combinationType`** entscheidet, wie mehrere `contributes_to`-Eingänge
   > zusammenwirken:
   > - `ANY` (Default): jede Ursache allein löst die Gefährdung aus (OR-Gate).
   >   Beispiel: Überdruck *oder* Überhitzung → Tankexplosion.
   > - `ALL`: erst alle Beiträge zusammen lösen aus (AND-Gate, Kombinatorik).
   >   Beispiel: Natrium *und* Wasser → exotherme Reaktion.
   >
   > Mehrere Eingänge implizieren also **nicht** automatisch Kombinatorik —
   > das muss explizit über `combinationType: 'ALL'` gesetzt werden.

1b. **`hazardDistance` auf der `contributes_to`-Kante** einführen (numerisch, 1, 2, 3...).
    Trägt die **topologische** Distanz eines Assets zum Hazard Item — getrennt von
    `relevance`, das **funktional** bleibt.

    > **Warum getrennt:** `relevance` (direct/indirect) beschreibt, *ob* das Asset die
    > physische Aktion unmittelbar steuert — funktionale Definition, unverändert zum
    > Beziehungsdokument. `hazardDistance` beschreibt, *wie weit* das Asset in der Kette
    > vom Hazard entfernt ist. Beispiel:
    > ```
    > Ventil           relevance: direct   hazardDistance: 1
    > PLC              relevance: direct   hazardDistance: 2   (steuert Ventil unmittelbar mit)
    > Engineering Stn. relevance: indirect hazardDistance: 3   (konfiguriert nur)
    > ```
    > So wird `relevance` nicht still topologisch umgedeutet (siehe Phase 3, Änderung 13).

2. **`Environment`-Asset-Kategorie** ergänzen.
   In der orthogonalen Asset-Enum/Union (wo Physical · Process · Service · Human definiert sind).

3. **Relationstypen** `contributes_to` und `endangers` in die Relation-Enum aufnehmen.
   `affects_safety` als `@deprecated` markieren (nicht löschen — Migration braucht es).

4. **`HazardImpact` discriminated union** definieren
   (`human` | `environment` | `infrastructure` mit je eigener Severity-Skala).
   → in `risk-types.ts`-Familie oder neue `hazard-impact.ts`.

5. **`SafetyAnnotation` anpassen:** `relevance` bleibt, Kommentar um die zwei
   `indirect`-Klassen ergänzen. `physicalHazardPotential` wandert konzeptuell ans
   Hazard Item (Feld am `SafetyAnnotation` als deprecated markieren oder als
   Spiegelung beibehalten).

6. **`reference-types.ts`** um Referenztypen für Hazard Item erweitern
   (cross-feature reference auf Hazard-Knoten, analog zu bestehenden Mitigation-Refs).

**Definition of Done:** Projekt kompiliert, ein Hazard Item + Environment + beide
Kanten können programmatisch erzeugt und serialisiert/deserialisiert werden.

---

## Phase 2 — Validierung

**Ziel:** Das Modell erlaubt nur sinnvolle Verbindungen.

**Änderungen:**

7. **`ALLOWED_A2A_RELATIONS`-Matrix** (in `asset-constants.ts`) erweitern:
   - `contributes_to`: erlaubt von Data/Function/Process/System/Physical/Infrastructure → Hazard Item
   - `endangers`: erlaubt von Hazard Item → Human/Environment/Infrastructure

8. **Validator-Regeln** (neue R-Nummern, analog R9/R10):
   - Hazard Item braucht mindestens einen `contributes_to`-Eingang
   - Hazard Item braucht mindestens eine `endangers`-Kante
   - `endangers` nur von Hazard Item ausgehend (nicht von Assets direkt — ausser eingeklappt, siehe Phase 4)

9. **Kombinatorik-Validierung:** mehrere `contributes_to` auf dasselbe Hazard Item
   sind erlaubt. Bei `combinationType: 'ALL'` Hinweis "kombinatorische Gefährdung —
   alle Beiträge erforderlich"; bei `ANY` "unabhängige Ursachen". Warnung wenn
   `ALL` mit nur einem Eingang gesetzt ist (sinnlos).

10. **`dfd-asset-property-validator.ts`** ergänzen für Hazard-Item-Properties
    (physicalHazardPotential gesetzt wenn safety-relevant etc.).

**Definition of Done:** Validator akzeptiert gültige Hazard-Strukturen, weist
ungültige (z.B. Hazard ohne Schutzziel) mit erklärender Meldung ab.

---

## Phase 3 — Ableitungs- & Analyse-Engine

**Ziel:** Safety Override, relevance/impact-Propagation und Impact-Dimension-Ableitung
funktionieren über das Hazard Item.

**Änderungen:**

11. **Safety Override Rule** umstellen: greift jetzt am Hazard Item
    (`endangers [fatality/irreversible]` → CRITICAL), nicht mehr an direkter
    `affects_safety`-Kante. **Berücksichtigt `combinationType`:**
    - `ANY`: Override greift, sobald *ein* `contributes_to`-Beitrag kompromittierbar ist
    - `ALL`: Override greift erst, wenn *alle* erwarteten Beiträge kompromittierbar sind
      (das Hazard ist erst dann "scharf")

12. **Impact-Dimension-Ableitung** aus Zielknotentyp implementieren
    (Human → Safety-Skala, Environment → Umwelt-Skala, Infrastructure → Destruction-Skala).

13. **relevance & hazardDistance trennen — `relevance` bleibt funktional.**
    - `relevance` (direct/indirect) wird **nicht** propagiert/umgedeutet. Es bleibt
      die funktionale Eigenschaft der Kante: kontrolliert das Asset die physische
      Aktion unmittelbar? Mehrere Glieder einer Kette können gleichzeitig `direct` sein.
    - `hazardDistance` trägt die topologische Distanz. Das **Hop-Limit** (default Hop 1,
      siehe Asset-zu-Asset-Dokument Regel 2) lebt auf `hazardDistance`, nicht auf `relevance`.
    - Automatische Ableitung jenseits Hop 1 erfordert weiterhin explizite
      Analyst-Entscheidung (`source: "manual"` + Rationale).

    > **Wichtig:** Dies korrigiert die ursprüngliche Formulierung ("vorgelagerte Glieder
    > erben indirect"), die `relevance` still topologisch umgedeutet hätte. Die funktionale
    > Definition aus dem Beziehungsdokument bleibt die einzige Wahrheit.

14. **`asset-cianaaa-deriver.ts`** integrieren: Hazard-Item-Pfad in die
    CIANAAA-Ableitung einbeziehen (BASE_RULES für contributes_to/endangers).

15. **Threat-Generierung:** Pflicht-Threats (Tampering, DoS) auf
    `contributes_to`-Beiträgen; Hazard Item als Konvergenzpunkt der Analyse.
    Bei `combinationType: 'ALL'` werden die Beiträge als gemeinsame Bedingung dokumentiert.

**Definition of Done:** Ein Modell mit Natrium/Wasser-Beispiel (`combinationType: 'ALL'`)
erzeugt automatisch CRITICAL-Risiko am Bediener, das AND ist in der Ableitung sichtbar.
Ein `ANY`-Hazard mit mehreren Eingängen behandelt jeden Beitrag als eigenständige Ursache.
`relevance` behält in beiden Fällen seine funktionale Bedeutung.

---

## Phase 4 — DFD / draw.io

**Ziel:** Hazard Item und Environment sind zeichenbar, eingeklappt/aufgeklappt funktioniert.

**Änderungen:**

16. **Hazard-Item-Shape** in die draw.io Shape-Library aufnehmen
    (über `Draw.loadPlugin` + `LocalLibrary`, Shapes via `inline-shapes.cjs` inlinen).
    Eigene Farbe (nicht Asset-Farben) — Vorschlag rot/orange Warnsemantik.

17. **Environment-Shape** als neue orthogonale Asset-Kategorie (eigene Farbe).

18. **Eingeklappt-Modus:** Zeichnet der Nutzer `Asset ─endangers─► Human` direkt,
    legt das Tool intern ein Hazard Item an (ableitbar) und mappt die Kanten.

19. **Aufklapp-Mechanik:** Sobald ein zweiter `contributes_to` auf dasselbe Hazard
    zeigt, wird das Hazard Item sichtbar (Auto-Expand, Kombinatorik sichtbar).

**Definition of Done:** Roboter-Beispiel eingeklappt, Natrium/Wasser-Beispiel
aufgeklappt — beide korrekt im DFD darstellbar.

---

## Phase 5 — UI (React / MUI)

**Ziel:** Alle neuen Knoten und Kanten sind im UI editierbar.

**Änderungen:**

20. **Hazard-Item-Editor-Dialog:** label, hazardType (ISO 12100 Dropdown),
    physicalHazardPotential (low/med/high), **combinationType (ANY/ALL)**,
    externalRef, rationale.

20b. **Hazard Tab CRUD:** die in Phase 0 read-only angelegte Hazard-Liste um
    Anlegen/Bearbeiten/Löschen erweitern (Single Source of Truth). Inkl.
    Schutzziel-Zuordnung (endangers → Human/Environment/Infrastructure) direkt im Tab.

21. **Environment-Asset-Dialog** (analog zu bestehenden Asset-Dialogen).

22. **`contributes_to`-Kanten-Editor:** relevance (direct/indirect) + Rationale.

23. **`endangers`-Kanten-Editor:** impact mit zieltyp-abhängiger Severity-Skala
    (discriminated union → UI zeigt passende Optionen je nach Zielknoten).

24. **Eingeklappt/Aufgeklappt-Toggle** im UI (manuelles Aufklappen auch bei einem Eingang).

**Definition of Done:** Vollständiger Workflow per Maus/Dialog ohne Code-Eingriff.

---

## Phase 6 — i18n & Doku-Generierung

**Ziel:** Mehrsprachigkeit und automatische Normsprache-Dokumentation.

**Änderungen:**

25. **i18n-Keys** (de/en) für Hazard Item, Environment, contributes_to, endangers,
    die zwei indirect-Klassen, alle Dialog-Labels. Über die 8 Namespaces verteilt.

26. **Doku-Generator:** Normsprache-Sätze für Hazard Items
    (ISO 12100 Gefährdungsart, betroffene Schutzziele, physicalHazardPotential).

27. **Multi-Target-Reporting:** ein Hazard mit Human + Environment + Infrastructure
    erzeugt drei getrennte Schadensaussagen im Report.

**Definition of Done:** Report auf de und en, mit korrekten Normsprache-Sätzen
für alle drei Schutzziel-Typen.

---

## Phase 7 — Migration, Reference Cases & Tests

**Ziel:** Bestehende Modelle laufen weiter, Referenzbeispiele und Tests sind aktuell.

**Änderungen:**

28. **Migrations-Loader:** alte Modelle mit `affects_safety` → automatisch
    `contributes_to → impliz. Hazard Item → endangers` beim Laden umwandeln.

29. **Reference Cases aktualisieren:** Rauchmelder, Roboter-Beispiel, CNC- und
    Medical-Referenzfälle auf das neue Muster.

30. **Unit-Tests** (vitest): Validierung, Safety Override am Hazard, Impact-Ableitung,
    Kombinatorik-AND, Migration.

31. **`affects_safety` final entfernen** (nach Migration + Tests grün) —
    oder als reiner Loader-Alias belassen, falls Abwärtskompatibilität gewünscht.

**Definition of Done:** Alle Tests grün, alte Modelle laden fehlerfrei, Referenzfälle
zeigen das neue Muster.

---

## Empfohlener MVP-Schnitt

Für eine erste lauffähige Version (Demo / eigene Nutzung):

- **Phase 0** vollständig (Hazard Tab + Safety-Toggle) — der strukturelle Rahmen
- **Phase 1** vollständig (Datenmodell)
- **Phase 2** Änderungen 7–8 (minimale Validierung)
- **Phase 3** Änderungen 11–12 (Safety Override + Impact-Ableitung)
- **Phase 4** Änderung 18 (nur eingeklappter Modus)
- **Phase 5** Änderungen 20, 20b, 23 (Hazard-Tab-CRUD + endangers-Editor)

Das deckt den **Einzeleingang-Fall** (Roboter → Hazard → Einrichter) komplett ab,
inklusive Hazard Tab als Single Source of Truth. Die Kombinatorik (Natrium/Wasser,
Aufklapp-Mechanik, Multi-Target) und der **Importer** (siehe Feature-Spec) folgen danach.

---

## Risiken & offene Punkte

- **Migration `affects_safety`:** Wenn viele bestehende Modelle existieren, muss der
  Loader robust sein. Entscheidung nötig: harte Migration vs. dauerhafter Alias.
- **physicalHazardPotential-Doppelung:** Feld existiert sowohl in alter
  `SafetyAnnotation` als auch neu am Hazard Item. Übergangsweise spiegeln,
  langfristig nur am Hazard Item führen.
- **Eingeklappt-Identität:** Das implizite Hazard Item braucht eine stabile ID
  (für Reload/Diff), auch wenn es nie sichtbar war. Sonst entstehen beim
  Aufklappen Duplikate.
- **draw.io Auto-Expand:** Layout beim Aufklappen — wo erscheint das Hazard Item
  visuell, ohne das bestehende Diagramm zu zerstören?
- **Safety-Toggle ↔ Regulatory Profile:** Auto-Aktivierung bei machinery/medical/etc.
  Soll der Toggle danach manuell abschaltbar bleiben (Override) oder hart ans Profil
  gekoppelt sein? Empfehlung: Auto-Vorschlag, aber manuell übersteuerbar.
- **Hazard Tab bei bestehenden Projekten:** Wird `safetyRelevant` bei Altprojekten
  auf `false` defaultet (Tab versteckt) — konsistent, kein Bruch.
- **Single-Source-of-Truth-Synchronisation (höchstes Umsetzungsrisiko):** Hazard Tab
  und DFD dürfen nie auseinanderlaufen. Jede Operation (Anlegen, Umbenennen, Löschen,
  Verknüpfen) muss sofort bidirektional greifen. Lösung: ein zentraler Hazard-Store als
  einzige Quelle, beide Tabs rendern nur Views. Kein Kopieren von Hazard-Daten in DFD-Knoten.

---

*© Jürgen Messerer · TARAflow · 2026*
