# TARAflow Closed Loop – Testplan v0.1

## Voraussetzungen

- Ein bestehendes TARAflow-Projekt mit DFD-Modell
- Mindestens 1 per-element Threat mit selektierten Mitigations
- Mindestens 1 per-interaction Threat (DataFlow zwischen zwei Prozessen)
- DFD-Elemente mit Properties (DataFlow, Process, ExternalEntity)

---

## Testblock 1 — MitigationStatus State Machine

**Ziel:** Statusübergänge funktionieren korrekt und RiskStatus wird automatisch aktualisiert.

### T1.1 — Basis-Statuswechsel

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Risk im Risk-Tab öffnen | Status = `open` |
| 2 | Mitigation selektieren (Checkbox) | MitigationStatus = `selected` in Summary |
| 3 | Risk-Tab Spalte Status prüfen | RiskStatus = `open` (noch nichts umgesetzt) |
| 4 | Mitigation-Status auf `planned` setzen | RiskStatus = `in-review` |
| 5 | Mitigation-Status auf `in_progress` setzen | RiskStatus = `in-review` |
| 6 | Mitigation-Status auf `implemented` setzen | RiskStatus = `mitigated` |
| 7 | Mitigation-Status auf `verified` setzen | RiskStatus = `verified` |

### T1.2 — Rejected

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Mitigation selektieren | status = `selected` |
| 2 | Status auf `rejected` setzen | Mitigation grau/durchgestrichen |
| 3 | RiskStatus prüfen | `open` (rejected zählt nicht) |
| 4 | Zweite Mitigation selektieren + `implemented` | RiskStatus = `mitigated` |

### T1.3 — Treatment-Interaktion

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Treatment auf `accept` setzen | Mitigations-Checkboxes disabled |
| 2 | RiskStatus prüfen | `accepted` |
| 3 | Risk After Ratings prüfen | Gleich wie Risk Before (auto-kopiert) |
| 4 | Tab 3 (Risk After) prüfen | Factor-Grid disabled, Info-Banner sichtbar |
| 5 | Treatment auf `eliminate` setzen | Mitigations wieder enabled |
| 6 | Mitigation auf `verified` setzen | RiskStatus = `eliminated` |

---

## Testblock 2 — DFD Notifications Panel

**Ziel:** DFD-Tab zeigt korrekte Warnungen wenn Mitigations implementiert sind aber DFD nicht aktualisiert wurde.

### T2.1 — Notification erscheint

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Risk mit TLS-Mitigation öffnen | |
| 2 | Mitigation (z.B. M-T-005) auf `implemented` setzen | |
| 3 | Dialog schliessen | |
| 4 | In DFD-Tab wechseln | Notification Panel erscheint |
| 5 | Panel-Inhalt prüfen | Zeile mit DataFlow-ID, Property `encryptionInTransit`, `none → tls` |
| 6 | Confidence-Badge prüfen | `deterministic` oder `heuristic` |

### T2.2 — Apply-Button

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Notification vorhanden (aus T2.1) | |
| 2 | Apply-Button klicken | Notification verschwindet aus Panel |
| 3 | DataFlow im DFD anklicken → Form öffnen | `encryptionInTransit` = `tls` |
| 4 | Security Control Ownership-Display im Form | Record sichtbar mit Datum, Mitigation-ID, Risk-ID |

### T2.3 — Drift-Erkennung

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Apply ausgeführt (aus T2.2) | Property korrekt gesetzt |
| 2 | Property manuell zurücksetzen (z.B. `encryptionInTransit = none`) | |
| 3 | DFD-Tab fokussieren | `drift` Notification erscheint (orange) |
| 4 | Property auf falschen Wert setzen ohne Apply | `conflict` Notification erscheint (rot) |

### T2.4 — Validierungsfehler parallel

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Bestehende Validierungsfehler im DFD | Errors und Warnings bleiben im Panel |
| 2 | Security-Notification aus T2.1 | Alle Typen gleichzeitig sichtbar |
| 3 | Header-Chips prüfen | Korrekte Zähler (X errors, Y warnings, Z security) |

---

## Testblock 3 — Per-Interaction Scope-Auswahl

**Ziel:** Bei per-interaction Threats kann der Analyst den Scope einer Mitigation einschränken.

### T3.1 — Scope-Selector erscheint

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Per-interaction Risk öffnen | |
| 2 | Mitigation mit mehreren Rollen selektieren (z.B. TLS → source + channel + target) | |
| 3 | Scope-Selector prüfen | Checkboxen: Sender / Channel / Receiver |
| 4 | Alle Rollen selektiert (Default) | Kein Override aktiv, kein oranger Border |

### T3.2 — Scope einschränken

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Scope auf "Channel only" einschränken | Oranger Border, "(overridden)" Label |
| 2 | DFD-Tab öffnen | Nur DataFlow-Notification (nicht Source/Target-Processes) |
| 3 | Alle Rollen wieder aktivieren | Override entfernt, volle Notification-Liste |

### T3.3 — Per-element Risk (kein Scope-Selector)

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Per-element Risk öffnen | |
| 2 | Mitigation selektieren | Kein Scope-Selector sichtbar |

---

## Testblock 4 — MitigationCoverage Badge

**Ziel:** Bereits im DFD implementierte Properties werden in Risk- und Threat-Dialog als "Already implemented" angezeigt.

### T4.1 — Badge im Risk Dialog

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | DataFlow im DFD öffnen | `encryptionInTransit` auf `tls` setzen |
| 2 | Risk Dialog für zugehörigen Threat öffnen | |
| 3 | Mitigations-Tab prüfen | Neben TLS-Mitigation: grüner Badge "Already implemented" |
| 4 | Tooltip über Badge | Property-Details sichtbar (z.B. `encryptionInTransit = tls`) |

### T4.2 — Badge im Threat Dialog

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Property aus T4.1 bleibt gesetzt | |
| 2 | Threat-Dialog für denselben Threat öffnen | |
| 3 | Mitigations-Liste prüfen | Grüner Badge neben TLS-Mitigation |

### T4.3 — Partial Badge

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | DataFlow: `encryptionInTransit = tls` ✅ | |
| 2 | Source-Process: `endpointAuthentication` = leer ❌ | |
| 3 | Risk Dialog öffnen | Gelber Badge "Partially implemented" |
| 4 | Tooltip | Zeigt ✓ und ✗ Properties |

### T4.4 — Kein Badge bei nicht implementiert

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Alle Properties leer | |
| 2 | Risk Dialog öffnen | Kein Badge (nur Checkbox ohne Indikator) |

---

## Testblock 5 — RiskStatus & MoSCoW

**Ziel:** Automatische Status-Berechnung und Tabellen-Darstellung korrekt.

### T5.1 — Status-Spalte (Risk-Tab Tabelle)

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Risk mit treatment `reduce` | Status-Select editierbar |
| 2 | Risk mit treatment `accept` | Status-Spalte: read-only Chip "Accepted" |
| 3 | Risk mit treatment `transfer` | Status-Spalte: read-only Chip "Transferred" |
| 4 | Risk mit MoSCoW `wont` | Status-Spalte: read-only Chip "Won't Do" |

### T5.2 — Won't-Tabelle

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Risk auf MoSCoW `wont` setzen | Verschwindet aus Haupt-Tabelle |
| 2 | Won't-Tabelle prüfen | Risk erscheint dort mit Justification-Spalte |
| 3 | Won't-Risk anklicken (Edit) | Dialog öffnet mit Won't-Risks aus selber Gruppe |
| 4 | Navigation Prev/Next | Nur Won't-Risks der Gruppe |
| 5 | Won't zurück auf `must` setzen | Erscheint wieder in Haupt-Tabelle |

### T5.3 — Justification-Logik

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | MoSCoW = `wont` | Nur `wontJustification`-Feld sichtbar |
| 2 | Treatment = `accept`, MoSCoW ≠ `wont` | Nur `treatmentJustification`-Feld sichtbar |
| 3 | MoSCoW = `wont` + Treatment = `accept` | Nur `wontJustification` (dominiert) |

---

## Testblock 6 — Audit Trail & SecurityControlOwnership

**Ziel:** Apply-Aktionen werden korrekt im Audit Trail gespeichert.

### T6.1 — Ownership-Display

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Apply aus T2.2 durchführen | |
| 2 | Betroffenes Element im DFD öffnen (Form) | |
| 3 | Ende der Documentation-Section | Ownership-Record sichtbar |
| 4 | Record-Inhalt prüfen | Property, Wert, Datum, Mitigation-ID, Risk-ID |

### T6.2 — Mehrere Applies

| Schritt | Aktion | Erwartetes Resultat |
|---|---|---|
| 1 | Zweite Notification für dasselbe Element applyen | |
| 2 | Ownership-Display | Beide Records sichtbar (chronologisch) |

---

## Testblock 7 — Regressionstest (bestehende Funktionen)

**Ziel:** Sicherstellen dass bestehende Funktionen durch neue Änderungen nicht beeinträchtigt wurden.

| Test | Aktion | Erwartetes Resultat |
|---|---|---|
| R1 | DFD-Elemente erstellen/bearbeiten | Forms funktionieren normal |
| R2 | Threat-Generierung auslösen | Threats werden korrekt generiert |
| R3 | Threat-Dialog öffnen / speichern | Kein Fehler, Notes speicherbar |
| R4 | Risk-Dialog öffnen / schliessen | Kein Rules-of-Hooks-Fehler in Console |
| R5 | Projekt speichern + neu laden | Alle MitigationStatus-Werte persistent |
| R6 | Dokumentations-Export | Mitigations in Report korrekt dargestellt |
| R7 | Risk-Konfiguration ändern (Factors) | Scores werden neu berechnet |
| R8 | Per-element und per-interaction Threats mischen | Beide erscheinen korrekt im Risk-Tab |

---

## Bekannte Einschränkungen (kein Bug)

- **Pre-selection:** Wenn DFD-Property bereits gesetzt → Mitigation wird NICHT automatisch vorselektiert (Phase 2)
- **Staleness:** Kein Ablaufdatum / Staleness-Indikator auf Controls (Phase 2)
- **Multi-Mitigation Aggregation:** mTLS ersetzt TLS nicht automatisch (Phase 2)
- **Traceability Navigation:** Klick auf Control-Notification → kein direkter Sprung zu Threat/Risk (Phase 2)

---

## Checkliste Testergebnis

```
□ T1.1 Basis-Statuswechsel
□ T1.2 Rejected
□ T1.3 Treatment-Interaktion
□ T2.1 Notification erscheint
□ T2.2 Apply-Button
□ T2.3 Drift-Erkennung
□ T2.4 Validierungsfehler parallel
□ T3.1 Scope-Selector erscheint
□ T3.2 Scope einschränken
□ T3.3 Per-element (kein Scope)
□ T4.1 Badge Risk Dialog
□ T4.2 Badge Threat Dialog
□ T4.3 Partial Badge
□ T4.4 Kein Badge
□ T5.1 Status-Spalte
□ T5.2 Won't-Tabelle
□ T5.3 Justification-Logik
□ T6.1 Ownership-Display
□ T6.2 Mehrere Applies
□ R1–R8 Regressionstest
```
