# Analyse — Step 3: Threat Eval Dialog

## Was Step 3 leisten muss

Der Benutzer hat Threats generiert. Er muss jetzt:
1. Einen Überblick bekommen — was wurde generiert, was ist noch offen
2. Jeden Threat bewerten — relevant oder nicht, ggf. Text anpassen
3. Proposed Mitigations + Verifications sehen — aber noch nicht auswählen (Risk Tab)

---

## Offene Fragen die vor der Implementierung geklärt werden müssen

### F1 — Wo lebt der Eval-Flow?

**Option A — Eigener Tab „Threat Eval"**
Separater Tab zwischen Generate und Risk.
Vorteil: klare Phasentrennung.
Nachteil: ein weiterer Tab, der nur für eine Phase relevant ist.

**Option B — Im bestehenden Threats-Tab**
Threats-Tab hat zwei Zustände: „Generated" und „Evaluated".
Ein Banner/Badge zeigt wie viele Threats noch nicht bewertet sind.
Vorteil: kein neuer Tab, der Benutzer bleibt im Kontext.

**→ Empfehlung: Option B.** Der Tab existiert bereits. Ein Status-Badge
pro Akkordeon-Gruppe reicht um den Fortschritt sichtbar zu machen.

---

### F2 — Struktur der Akkordeon-Gruppen

**Aktuelle Annahme:** Gruppierung nach DFD-Element oder Trust Boundary.

**Frage:** Welche Ebene ist die primäre Gruppe?

Variante 1 — flach nach Element:
```
[ Process: OPC UA Server ] (4 Threats, 2 offen)
[ DataFlow: Sensor → PLC ] (6 Threats, 6 offen)
[ Trust Boundary: Field Level ] (3 Threats, 0 offen)
```

Variante 2 — verschachtelt Trust Boundary → Element:
```
[ Trust Boundary: Field Level ]
  └── [ Process: OPC UA Server ] (4 Threats)
  └── [ DataFlow: Sensor → PLC ] (6 Threats)
```

Variante 2 gibt mehr Kontext bei grossen Modellen (OT/ICS mit vielen Elementen),
ist aber tiefer verschachtelt.

**→ Empfehlung: Variante 1 für jetzt** (einfacher umzusetzen, kann in Step 4 zu
Variante 2 erweitert werden wenn Filterung nach Tags kommt).

---

### F3 — Status-Modell auf dem Threat

Drei Optionen:

**A — Boolean**
```typescript
confirmed: boolean  // true = relevant, false = verworfen
```
Zu wenig differenziert. Man kann nicht unterscheiden "nicht bewertet" von "verworfen".

**B — 3-stufig**
```typescript
status: "pending" | "confirmed" | "dismissed"
```
Reicht für die meisten Fälle. Einfach im UI abbildbar.

**C — 4-stufig (aus ChatGPT-Analyse)**
```typescript
status: "pending" | "confirmed" | "dismissed" | "review"
```
`"review"` = unklar, später nochmal anschauen.

**→ Empfehlung: Option C.** `"review"` kostet wenig, bringt aber echten Nutzen
bei grossen Modellen wo man nicht alles in einem Durchgang bewerten will.

---

### F4 — Direkte Inline-Aktionen vs. nur Dialog

Soll der Benutzer den Status direkt in der Tabelle ändern können (ohne Dialog zu öffnen)?

**Option A — Nur über Dialog**
Jede Statusänderung erfordert Dialog-Öffnung.
Nachteil: langsam bei vielen Threats.

**Option B — Quick Actions in Tabelle + Dialog für Details**
In der Tabellenzeile: Status-Chip (klickbar) oder Icon-Buttons
✓ confirm / ✗ dismiss / ? review
Dialog öffnet sich nur wenn der Benutzer die Zeile anklickt für Details.

**→ Empfehlung: Option B.** Standard-Interaktionsmuster für Triage-UX.

---

### F5 — Inhalt des Dialogs

Was soll der Dialog zeigen?

**Sektion 1 — Kontext**
- DFD-Element-Name + Typ (oder DataFlow: Source → Target)
- Trust Boundary (falls vorhanden)
- STRIDE-Kategorie (farbig)
- Generierungsmethode (per-element / per-interaction)

**Sektion 2 — Threat**
- Threat-Beschreibung (editierbar?)
- Attack-Beschreibung (editierbar?)

**Frage zu Editierbarkeit:** Soll der Benutzer die generierten Texte anpassen können?
- Pro: Flexibilität, Analyst kann präzisieren
- Contra: Wenn Text editiert wird, verliert man die i18n-Verknüpfung
- Lösung: Text ist editierbar, aber wenn der Benutzer editiert wird
  `source: "custom"` gesetzt und der Text wird lokal gespeichert (nicht mehr
  aus i18n gezogen)

**Sektion 3 — Bewertung**
- Status: Relevant / Nicht relevant / Review / Offen (Radio oder Segmented Button)
- Begründung (optional, Freitext-Feld)

**Sektion 4 — Proposed Mitigations + Verifications (read-only hier)**
- Liste der `proposedMitigations` aus dem Katalog (lokalisiert)
- Liste der `proposedVerifications` aus dem Katalog (lokalisiert)
- Hinweistext: „Auswahl erfolgt im Risk Tab"

**→ Sektion 4 ist wichtig:** Der Analyst sieht bereits was auf ihn zukommt,
kann aber noch nichts auswählen. Das ist die richtige Erwartungssteuerung.

---

### F6 — Navigation im Dialog

„Next / Next / OK" wurde als Anti-Pattern identifiziert.

**Empfehlung: Single-View Dialog** mit allen Sektionen auf einmal sichtbar,
kein Wizard. Der Dialog hat:
- Oben: Kontext + Threat (Sektion 1+2)
- Mitte: Bewertung (Sektion 3) — das ist der primäre Call-to-Action
- Unten: Proposed Mitigations/Verifications (Sektion 4, collapsible)

Navigation zwischen Threats:
- „← Previous Threat" / „Next Threat →" Buttons im Dialog-Footer
- Damit kann der Analyst schnell durch alle Threats einer Gruppe navigieren
  ohne den Dialog zu schliessen

---

### F7 — Bulk-Aktionen

Für grosse Modelle (OT/ICS kann 50+ Threats haben):

Minimal: Checkbox-Selektion in Tabelle + „Mark selected as dismissed"
Optional: Filter nach Status (zeige nur „pending")

**→ Empfehlung: Minimal für Step 3, Filter als spätere Erweiterung.**

---

## Datenmodell-Ergänzungen auf `Threat`

```typescript
interface Threat {
  // ... existing fields ...
  // (proposedMitigations + proposedVerifications kommen aus Step 1+2)

  // Step 3 additions:
  evalStatus: "pending" | "confirmed" | "dismissed" | "review";
  evalNote?: string;         // optionale Begründung
  isTextCustomized: boolean; // true wenn Benutzer Threat/Attack-Text editiert hat
}
```

---

## Was Step 3 explizit NICHT macht

- Keine Mitigation-Auswahl (kommt im Risk Tab)
- Keine Risk-Bewertung (Impact/Likelihood)
- Kein Tag-Filtering (kommt in Step 4)
- Keine Traceability-Links (kommen später)

---

## Offene Entscheidungen (bitte klären vor Implementierung)

1. **F2** — Akkordeon-Struktur: flach (Element) oder verschachtelt (TB → Element)?
2. **F5 Editierbarkeit** — Sollen Threat/Attack-Texte im Dialog editierbar sein?
3. **F6 Navigation** — Prev/Next im Dialog, oder Dialog schliessen und nächste Zeile wählen?
