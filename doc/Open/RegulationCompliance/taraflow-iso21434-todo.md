# TARAflow — ISO 21434 Anpassungen

> Alle Änderungen werden über `Modus_21434` gesteuert.
> Wird im Projekt-Tag aktiviert — Standard-Modus bleibt unverändert.

---

## 1. Projekt-Tab

- [ ] Neuer Projekt-Tag `iso21434: true`
- [ ] Aktiviert `Modus_21434` global in allen Tabs

---

## 2. DFD-Tab / Asset-Tab

Keine strukturellen Änderungen nötig — die bestehende Architektur ist bereits kompatibel:

| ISO 21434 | TARAflow |
|---|---|
| Item Definition | Overview Tab |
| Asset Identification | DFD + Asset-Tab |
| Damage Scenario | Asset-Impact-Phase (CIANAAA + SFOP) |

- [ ] SFOP-Skala explizit dokumentieren: S0–S3 / F0–F3 / O0–O3 / P0–P3
- [ ] Damage Scenario pro Asset formal ausgeben (für Doc Generator)

---

## 3. Threat-Tab

### 3.1 Spalten

- [ ] `Mitigation`-Spalte ausblenden in `Modus_21434`
- [ ] `Verification`-Spalte ausblenden in `Modus_21434`
- [ ] Neues Pflichtfeld: `damage_scenario_ref` — referenziert Asset mit höchstem Impact

> **Begründung:** In ISO 21434 ist der Threat-Tab reine Identifikation.
> Mitigation und Verification kommen erst im Risk-Tab als Cybersecurity Goal + Claim.

### 3.2 Traceability

- [ ] Jeder Threat referenziert explizit den STRIDE-Typ + betroffenes Asset
- [ ] Warnung im Audit wenn Threat kein zugehöriges Damage Scenario hat

---

## 4. Attack Tree Tab

### 4.1 Modus-Umschaltung

- [ ] `Modus_21434` schaltet Leaf-Formular um:
  ```
  Standard:    f=0.5         → einzelner Schätzwert
  ISO 21434:   f=(ET,SP,KI,WO,E) → 5 Faktoren, Durchschnitt berechnet
  ```

### 4.2 Feasibility-Faktoren pro Leaf (ISO 21434)

| Kürzel | Faktor | Beschreibung |
|---|---|---|
| ET | Elapsed Time | Wie lange braucht ein Angreifer? |
| SP | Specialist Expertise | Welches Fachwissen ist nötig? |
| KI | Knowledge of Item | Wie gut muss der Angreifer das System kennen? |
| WO | Window of Opportunity | Wie lange ist die Angriffsfläche offen? |
| E | Equipment | Welche Hardware/Tools sind nötig? |

```
feasibility = (ET + SP + KI + WO + E) / 5
```

- [ ] Parser erweitern: `f=(3,2,2,1,1)` → Durchschnitt berechnen
- [ ] Aggregation bleibt gleich:
  - OR-Node: `MIN(feasibility Leaves)`
  - AND-Node: `MAX(feasibility Leaves)`

### 4.3 Verknüpfung Threat → Attack Tree

- [ ] Jeder STRIDE-Threat kann einem Attack Tree Root-Node zugewiesen werden
- [ ] Gruppierung: mehrere Threats auf dasselbe Damage Scenario → ein Attack Tree
- [ ] Warnung im Audit wenn Damage Scenario keinen Attack Tree hat (`Modus_21434`)

### 4.4 Impact

- [ ] `impact=auto` in beiden Modi — wird aus Asset-Impact-Phase gezogen
- [ ] Keine manuelle Eingabe

---

## 5. Risk-Tab

### 5.1 Neue Felder in `Modus_21434`

- [ ] `cybersecurity_goal` — WAS soll erreicht werden?
- [ ] `cybersecurity_claim` — WARUM ist es erreicht?
- [ ] `verification_method` — WIE wird es nachgewiesen? (bereits im Standard-Modus)
- [ ] `verification_status` — wurde es verifiziert? (bereits im Standard-Modus)

### 5.2 Won't-Tabelle erweitern

Aktuell: `Won't` mit freiem Begründungsfeld.

Neu in `Modus_21434` — strukturierte Claim-Typen:

| Claim-Typ | Bedeutung | Pflichtfelder |
|---|---|---|
| `avoidance` | Funktion/Feature wird entfernt | Begründung |
| `acceptance` | Risiko wird akzeptiert | Begründung + Annahmen + Review-Datum |
| `sharing` | Verantwortung an Dritte | Verantwortlicher + Vertragsreferenz |
| `transferral` | Versicherung/Drittpartei | Bedingungen + Nachweis |

- [ ] Won't-Dialog um `claim_type` Dropdown erweitern
- [ ] Pflichtfelder je nach `claim_type` einblenden
- [ ] Claims werden verbatim im Audit-Report dokumentiert

---

## 6. Doc Generator

Grösster Aufwand — komplett neuer Output-Pfad für `Modus_21434`:

### 6.1 Kapitelstruktur

- [ ] Neue Dokumentstruktur gemäss ISO 21434 Work Products:
  - WP 15-1: Cybersecurity Goals
  - WP 15-2: Cybersecurity Claims
  - WP 15-3: Cybersecurity Concept

### 6.2 Attack Tree Output

- [ ] Standard: `probability` pro Leaf ausgeben
- [ ] ISO 21434: 5 Faktoren pro Leaf tabellarisch + Durchschnitt

### 6.3 Asset-Impact Output

- [ ] Standard: CIANAAA + Override Rules
- [ ] ISO 21434: SFOP mit S0–S3/F0–F3/O0–O3/P0–P3 Skala + Damage Scenario formal

### 6.4 Risk Output

- [ ] Standard: MoSCoW + Mitigation + Verification
- [ ] ISO 21434: + Cybersecurity Goals + Claims + strukturierte Won't-Begründungen

### 6.5 Traceability

- [ ] Vollständige Traceability-Kette pro Massnahme ausgeben:
  ```
  Massnahme → Threat → STRIDE
            → Asset → CIANAAA
            → Damage Scenario → SFOP
            → Attack Tree → Feasibility
            → Cybersecurity Goal → Claim
  ```

---

## 7. Zusammenfassung Aufwand

| Bereich | Aufwand | Bemerkung |
|---|---|---|
| Projekt-Tag | minimal | Ein neues Feld |
| DFD / Asset-Tab | minimal | Architektur bereits kompatibel |
| Threat-Tab | klein | Spalten ausblenden + Damage Scenario Ref |
| Attack Tree | mittel | Parser + Leaf-Formular + Gruppierung |
| Risk-Tab | mittel | Neue Felder + Claims |
| Doc Generator | gross | Komplett neuer Output-Pfad |

---

<sub>© Jürgen Messerer · 2026 · Alle Rechte vorbehalten</sub>
