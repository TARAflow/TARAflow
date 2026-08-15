# TARAflow: Prozesssicherheit & Modell-Integrität

## 1. Zielsetzung

Dieses Dokument beschreibt die Mechanismen, mit denen TARAflow sicherstellt, dass das Sicherheits- und Safety-Modell stets aktuell bleibt. Fokus liegt auf **Prozesssicherheit**, d.h. der Integration von Modellpflege in die Entwicklungs-, Release- und Betriebsprozesse.

Das zentrale Risiko: **Modell-Drift** — das Modell stimmt nicht mehr mit der Realität überein, ohne dass es jemand bemerkt. Alle Mechanismen hier zielen darauf ab, diesen Drift zu verhindern oder frühzeitig sichtbar zu machen.

---

## 2. Kontrollpunkte im Lebenszyklus

### A. Trigger-Prozess (Entwicklung)

- **Zweck:** Sicherstellen, dass neue Features und Schnittstellen sofort im Modell abgebildet werden.
- **Owner:** Entwickler, der das Feature implementiert — nicht das Security-Team.
- **Mechanismen:**
  - Code-Annotationen für neue Features oder Schnittstellen
  - Einheitliche Namenskonventionen zwischen Code und Modell
- **Ergebnis:** Das Modell wächst automatisch mit der Entwicklung und bleibt konsistent.

> **Häufiger Fehler:** Die Modellpflege wird als Aufgabe des Security-Teams betrachtet.
> In der Praxis kennt nur der Entwickler, der ein Feature baut, die genauen
> Datenflüsse und Interfaces. Ownership muss dort liegen.

---

### B. Gatekeeper-Prozess (Release)

- **Zweck:** Verhindern, dass Releases ausgeliefert werden, wenn das Modell veraltet ist.
- **Owner:** Release-Manager / CI-Pipeline (technisch); Security-Verantwortlicher (fachliche Freigabe bei Diff.
- **Mechanismen:**
  - Automated Consistency Check zwischen Release-Notes / Features und Modell-Status
  - Technische Release-Sperre bei Diskrepanzen

#### Remediation bei einem gefundenen Diff

Ein gefundener Diff darf nicht einfach übergangen werden. Der folgende Ablauf gilt verbindlich:

```
Diff gefunden
    ↓
Security-Verantwortlicher wird benachrichtigt
    ↓
Bewertung: Ist der Diff sicherheitsrelevant?
    ├── Nein → Modell aktualisieren, Release freigeben, Entscheidung dokumentieren
    └── Ja   → Modell aktualisieren + Bedrohungsanalyse für neue/geänderte
                Elemente durchführen, bevor Release freigegeben wird
```

**Zeitrahmen:** Das Modell muss vor dem Release aktualisiert sein — nicht danach.
Eine nachträgliche Aktualisierung ist kein akzeptabler Workaround, da im Auslieferungszeitraum
ein unvollständiges Modell existiert.

---

### C. Operational Sync / „Engineering Realities" (Betrieb)

- **Zweck:** Abdeckung von Änderungen, die außerhalb der Standard-Entwicklung passieren.
- **Owner:** Je nach Auslöser (siehe unten).

#### 1. Hotfix-Monitoring (Post-Release)

- **Owner:** Entwickler des Hotfixes + Security-Verantwortlicher
- **Mechanismus:** Post-Release-Trigger erkennt Notfall-Patches, die den Gatekeeper umgehen.
- **Regel:** Hotfixes, die Interfaces, Datenflüsse oder Safety-Funktionen berühren, müssen
  **innerhalb von 48 Stunden** nach Deployment im Modell nachgezogen werden.

> **Warum 48h und nicht sofort?** Unter Hotfix-Druck ist eine sofortige Modellpflege
> unrealistisch und führt zu Fehlern. 48h gibt Zeit für eine sorgfältige Aktualisierung,
> ist aber kurz genug, um echten Drift zu verhindern.

#### 2. Architekturänderungen

Das ist in der Praxis der häufigste Grund für echten Modell-Drift — und fällt durch
alle anderen Raster, weil Architekturentscheidungen oft kein klassisches Feature-Commit
sind und kein Hotfix.

- **Owner:** Architekt / Tech Lead
- **Auslöser:** Neues Backend, neuer Cloud-Connector, Protokollwechsel,
  Einführung eines neuen Subsystems, Änderung von Vertrauensgrenzen (Trust Boundaries)
- **Mechanismus:** Architekturentscheidungen werden im Architecture Decision Record (ADR)
  oder gleichwertigem Dokument festgehalten — mit explizitem Feld:
  *„Erfordert diese Entscheidung eine TARAflow-Modellaktualisierung? Ja / Nein / Begründung"*
- **Regel:** Architekturänderungen dürfen erst in Produktion gehen, wenn das Modell
  aktualisiert und der Gatekeeper-Check bestanden wurde.

#### 3. Environment-Audit (Physische Änderungen)

- **Owner:** OT-/Infrastruktur-Verantwortlicher
- **Mechanismus:** Überprüfung physischer Änderungen (z. B. Maschinenumzug,
  Netzwerksegmentierung, neue Verbindungen zu externen Systemen).
- **Auslöser:** Jede Änderung, die den Exposure Level eines Interfaces beeinflussen könnte.

#### 4. Library-Drift / SBOM-Check

- **Owner:** Security-Verantwortlicher
- **Mechanismus:** Prüft Updates von Drittanbieter-Bibliotheken und OS-Komponenten
  auf Auswirkungen im Modell (neue Attack Surface durch neue Dependencies).

---

## 3. Zusammenfassung der Prozesslogik

| Prozessschritt             | Mechanismus                                   | Owner                              | Zweck |
|----------------------------|-----------------------------------------------|------------------------------------|-------|
| Trigger (Entwicklung)      | Code-Annotationen & Naming Sync               | Entwickler                         | Modell wächst mit dem Code |
| Gatekeeper (Release)       | Consistency Check & Release-Sperre            | Release-Manager + Security         | Kein Release mit veraltetem Modell |
| Hotfix-Monitoring          | Post-Release-Trigger, 48h-Regel               | Entwickler + Security              | Hotfixes holen Modell schnell nach |
| Architekturänderungen      | ADR-Pflichtfeld + Gatekeeper                  | Architekt / Tech Lead              | Größter Drift-Risikofaktor explizit adressiert |
| Environment-Audit          | Manuelle Überprüfung bei physischen Änderungen | OT-/Infrastruktur-Verantwortlicher | Exposure-Level-Änderungen erfassen |
| Library-Drift / SBOM-Check | Dependency-Monitoring                         | Security-Verantwortlicher          | Neue Attack Surface durch Dependencies |

---

## 4. Wann ist das Modell als veraltet zu betrachten?

Ein Modell gilt als veraltet, wenn **eines** der folgenden Kriterien zutrifft:

- Ein neues Interface oder ein neuer Datenfluss existiert im System, aber nicht im Modell
- Ein bestehendes Interface wurde in seiner Charakteristik geändert (Protokoll, Exposure Level, Zieladresse)
- Eine Safety-Funktion wurde hinzugefügt, geändert oder entfernt
- Eine Architekturentscheidung wurde umgesetzt ohne ADR-Prüfung
- Ein Hotfix liegt mehr als 48h zurück ohne Modell-Nachzug

---

## 5. Prozesssicherheit: Diagramm

```
   ENTWICKLUNG (Code)               TARAflow MODELL
          |                               |
          | (1) TRIGGER-PROZESS           |
          |  Owner: Entwickler            |
          |------------------------------>|
          |  Code-Annotationen & Naming   |
          |                               |
          V                               V
   BUILD / COMMIT                  VALIDIERUNGS-ENGINE
          |                               |
          | (2) GATEKEEPER-PROZESS        |
          |  Owner: Release-Mgr + Security|
          |<------------------------------|
          | "Modell == Realität?"         |
          |                               |
   [ FREIGABE-STOPP ] <--- Falls Diff ----|
          |         Security bewertet:
          |         sicherheitsrelevant?
          |         → Modell aktualisieren
          |         → ggf. Bedrohungsanalyse
          |         → dann Release
          V (3) RELEASE
          |
   BETRIEB / OPS
          |
          | (4) OPERATIONAL SYNC
          |-- Hotfix-Monitoring     (Owner: Entwickler + Security, 48h-Regel)
          |-- Architekturänderungen (Owner: Architekt, ADR-Pflichtfeld)
          |-- Environment-Audit    (Owner: OT/Infra, bei Exposure-Änderungen)
          |-- Library-Drift / SBOM (Owner: Security)
          V
   KONTINUIERLICHE VALIDIERUNG
```
