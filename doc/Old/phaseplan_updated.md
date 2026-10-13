# 🎯 Erweiterungsplan - Schrittweise Umsetzung

Wir gehen in **5 Phasen** vor, die auf dem bestehenden Code aufbauen:

---

## Phase 1: Fundament & UI-Layout (Epic 1)

Zuerst schaffen wir die Basis-Infrastruktur und das neue UI-Layout:

### 1. **Storage-Layer implementieren**
- Wrapper für `window.storage` API
- Projekt-Datenstruktur definieren
- CRUD-Operationen für Projekte
- Ungespeicherte Änderungen mit `*` markieren

### 2. **Hauptlayout entwickeln**
- **Linke Sidebar (Projektmanagement)**:
  - Liste "Meine Projekte"
  - Aktives Projekt wird **fett** dargestellt
  - Buttons: [+ Neu] [📥 Import]
  - Sektion "Zuletzt verwendet"
  - Ein-/Ausklappbar mit Toggle-Button
  - Optional: Fixiert ausgeklappt (User-Preference)
  - Kontext-Menü (Rechtsklick): Umbenennen, Duplizieren, Exportieren, Löschen

- **Horizontale Phase-Tabs (Top)**:
  - Tab 0: "Allgemein" (Projektinfo & Einstellungen)
  - Tab 1: "1 - DFD" mit Status-Icon
  - Tab 2: "2 - Assets" mit Status-Icon
  - Tab 3: "3 - Threats" mit Status-Icon
  - Tab 4: "4 - Risiken" mit Status-Icon
  - Status-Icons: ✓ (abgeschlossen) | ⚙ (in Arbeit) | ⚠ (unvollständig) | ○ (nicht gestartet)

- **Main Workspace**:
  - Tab-spezifischer Content
  - Maximaler Platz für DFD/Tabellen

### 3. **Tab "Allgemein" implementieren**
- Projekt-Informationen (Name, Beschreibung)
- Metadaten (Erstellt, Zuletzt bearbeitet)
- Tags und Team-Zuordnung
- Projekt-Status-Übersicht
- Projekt-Einstellungen (Strict Mode, Auto-Save)
- Projekt-Dashboard mit Quick Stats
- Export/Löschen-Funktionen

### 4. **Projekt-Workflow**
- Projekt öffnen: Click auf Projekt in Sidebar → wird fett, lädt in Main Workspace
- Projekt wechseln: Speichern-Dialog bei ungespeicherten Änderungen (mit `*`)
- Tab-Kontext bleibt erhalten beim Projektwechsel
- Auto-Save alle 30 Sekunden

### 5. **Navigation & Routing**
- Routing-Struktur: `/projekt/:id/phase/:phase`
- Browser-History-Support
- Keyboard Shortcuts:
  - `Ctrl+1-4`: Direkt zu Phase springen
  - `Ctrl+S`: Speichern
  - `Ctrl+N`: Neues Projekt
  - `Ctrl+B`: Sidebar toggle

**Ausgabe:** Funktionierendes UI-Layout mit Projektmanagement-System

---

## Phase 2: DFD-Editor Integration (Epic 2)

Bestehenden DFD-Editor in neues Layout integrieren und erweitern:

### 1. **DFD in Phase-Tab integrieren**
- Voller Workspace für DFD-Canvas (Phase 1 Tab)
- Toolbar optimiert für maximalen Platz
- Zoom-Funktionen prominent platzieren
- DFD-Validierung mit visuellen Hinweisen

### 2. **Neue DFD-Elemente hinzufügen**
- Physical Interface (Square) Symbol
- Verbesserte Trust Boundary Darstellung
- Element-Typisierung nach TARA
- Drag & Drop aus Element-Palette

### 3. **Element-Eigenschaften erweitern**
- Properties-Dialog für alle Elementtypen
- Spezifische Felder (Technologie, Protokoll, Verschlüsselung)
- Validierung nach DFD-Regeln
- Context-Menu für schnellen Zugriff

### 4. **DFD-Status & Validierung**
- Automatische Vollständigkeitsprüfung
- Konsistenzprüfung
- Warnungen im Phase-Tab-Icon anzeigen
- "Phase 1 - DFD ✓" bei erfolgreicher Validierung

### 5. **DFD-Referenz in anderen Phasen**
- Phase 2: Mini-DFD (Read-Only) zur Orientierung
- Phase 3: Verknüpfung Threats ↔ DFD-Elemente
- Click auf Element → springt zu DFD mit Highlight

**Ausgabe:** TARA-konformer DFD-Editor im neuen Layout

---

## Phase 3: Asset-Management (Epic 3)

Asset-Definition und Kritikalitätsbewertung:

### 1. **Phase 2 Tab - Asset-Management UI**
- Split-View:
  - Links: Mini-DFD (Read-Only) zur Orientierung
  - Rechts: Asset-Formular
- Asset-Liste (filterbar, sortierbar)
- Asset-Status im Tab-Icon reflektieren

### 2. **Asset-Formular**
- 5 Asset-Kategorien (Data/System/Infrastructure/Process/Human)
- Alle TARA-Felder:
  - Name, Typ, Beschreibung
  - Verknüpfung zu DFD-Element (Dropdown)
  - Technologie-Stack
  - Abhängigkeiten zu anderen Assets
- Inline-Validierung

### 3. **Kritikalitätsbewertung**
- Matrix-UI für Impact-Kriterien:
  - Safety, Financial, Operational, Privacy
- 4-stufige Bewertung (Critical/High/Medium/Low)
- Automatische Gesamtkritikalität-Berechnung
- Visuelle Darstellung (Farb-Coding)

### 4. **Security Goals & STRIDE-Relevanz**
- Checkbox-Auswahl für S/T/R/I/D/E pro Asset
- SMART Security Goals definieren
- Template-Bibliothek für häufige Goals
- Verknüpfung zu DFD-Element

### 5. **Asset-Übersicht & Export**
- Filterable Tabelle (nach Typ, Kritikalität)
- Quick-Actions (Bearbeiten, Duplizieren, Löschen)
- Export (CSV/Excel)
- Validierung: "⚠ 2 von 5 Assets ohne Schutzziele"

**Ausgabe:** Vollständiges Asset-Management mit Kritikalitätsbewertung

---

## Phase 4: Threat-Analyse (Epic 4 & 5)

STRIDE-Methoden, Threat-Generierung und Mitigation:

### 1. **Phase 3 Tab - Threat-Management UI**
- Threat-Tabelle (Hauptansicht)
- Filter-Leiste (nach Asset, Threat Type, Status)
- Inline-Editing für schnelle Anpassungen
- Modal-Dialog für detaillierte Threat-Definition

### 2. **STRIDE-Methodenauswahl**
- Modal nach Abschluss von Phase 1 (DFD)
- Vergleich per-element vs per-interaction
- Auswahl speichern im Projekt
- Methodenwechsel-Warnung bei bestehenden Threats

### 3. **Threat-Engine erweitern**
- STRIDE-per-element Logic (neu)
- STRIDE-per-interaction Logic (verbessern)
- Mapping: DFD → Assets → Threats
- Automatische Threat-Generierung auf Basis der Methode

### 4. **Threat-Table mit TARA-Spalten**
- Alle relevanten Spalten:
  - Threat ID, Name, Beschreibung
  - STRIDE-Kategorie
  - Betroffenes Asset (verknüpft)
  - Threat Actor, Attack Vector
  - Impact Score, Likelihood
  - Status (New/In Progress/Mitigated/Accepted)
- Sortieren, Filtern, Gruppieren
- Manuelle Threat-Hinzufügung möglich

### 5. **Mitigation & Verification**
- STRIDE Threat and Mitigation Matrix
- Mitigation-Strategien (Template-Bibliothek)
- Verification-Methoden vorschlagen
- Status-Tracking: Planned → Implemented → Verified
- Verknüpfung zu Security Goals (aus Phase 2)

### 6. **Threat-Validierung**
- Vollständigkeitsprüfung (alle Threats haben Mitigation?)
- QA-Review-Workflow
- Validierungsbericht
- Tab-Status: "3 - Threats ⚠" bei unvollständigen Threats

**Ausgabe:** Intelligente Threat-Generierung & Management

---

## Phase 5: Risk Assessment & Finalisierung (Epic 6)

Risikobewertung und finale Features:

### 1. **Phase 4 Tab - Risk Assessment UI**
- Risk Matrix (Visual Heatmap)
  - Impact (Y-Achse) vs. Likelihood (X-Achse)
  - Threats als Punkte/Bubbles
- Selected Threat Details (Sidebar oder Split-View)
  - Risk Score, Impact, Likelihood
  - Mitigation Status
  - Residual Risk nach Mitigation
- Risk Dashboard
  - High-Risk Threats (Top 10)
  - Mitigation Progress
  - Acceptance-Tracking

### 2. **Projekt-Dashboard vervollständigen (Tab "Allgemein")**
- Projekt-Statistiken:
  - Anzahl Assets, Threats, Mitigations
  - Completion-Status pro Phase (Progress Bar)
  - High/Medium/Low Risk Distribution
- Fortschrittsvisualisierung
  - Timeline der letzten Änderungen
  - Activity Log
- Quick-Actions für häufige Tasks

### 3. **Help & Documentation**
- Kontextsensitive Hilfe (?) Icon in jedem Tab
- STRIDE-Glossar (Modal/Sidebar)
- Best Practices für jede Phase
- Guided Tour für neue Benutzer
- Video-Tutorials einbetten

### 4. **Export & Reporting**
- PDF-Report-Generator:
  - Executive Summary
  - DFD-Diagramm
  - Asset-Liste
  - Threat-Matrix
  - Risk Assessment
- Markdown-Export (für GitHub/Confluence)
- Excel-Report (detaillierte Tabellen)
- JSON-Export (für Tool-Integration)
- Templates für verschiedene Standards (ISO 21434, NIST)

### 5. **Testing & Polish**
- Umfassende Tests (Unit, Integration, E2E)
- Performance-Optimierung:
  - Lazy Loading für große DFDs
  - Virtualisierte Tabellen
  - Optimierte Storage-Zugriffe
- Browser-Kompatibilität (Chrome, Firefox, Edge, Safari)
- Accessibility (WCAG 2.1 AA)
- Responsive Breakpoints (Desktop-Fokus, aber funktional auf Tablets)

### 6. **User Experience Verbesserungen**
- Undo/Redo-Funktionalität
- Keyboard-Shortcuts Cheat-Sheet
- Dark Mode Support
- Customizable Themes
- User Preferences speichern

**Ausgabe:** Production-ready Threat Modeling Tool

---

## 🎯 Erfolgskriterien

Nach Abschluss aller Phasen:

- ✅ Benutzer können Projekte verwalten (erstellen, öffnen, speichern, löschen)
- ✅ DFD-Editor erstellt TARA-konforme Diagramme
- ✅ Assets mit vollständiger Kritikalitätsbewertung
- ✅ Automatische Threat-Generierung (STRIDE per-element & per-interaction)
- ✅ Vollständiges Mitigation & Verification Management
- ✅ Risk Assessment mit visueller Matrix
- ✅ Export in multiple Formate (PDF, Excel, JSON, Markdown)
- ✅ Intuitive UI mit Phase-Navigation
- ✅ Auto-Save & Ungespeicherte-Änderungen-Warnung
- ✅ Performance-optimiert für komplexe Projekte

---

## 📊 Zeitschätzung

- **Phase 1:** 2-3 Wochen (UI-Fundament)
- **Phase 2:** 2 Wochen (DFD-Integration)
- **Phase 3:** 2-3 Wochen (Asset-Management)
- **Phase 4:** 3-4 Wochen (Threat-Engine & Mitigation)
- **Phase 5:** 2-3 Wochen (Risk Assessment & Polish)

**Total:** ~11-15 Wochen (ca. 3-4 Monate)

---

## 🚀 Nächste Schritte

1. Phase 1 starten: Storage-Layer & UI-Layout implementieren
2. Prototyp des Tab-Systems erstellen
3. Sidebar mit Projektliste entwickeln
4. Tab "Allgemein" als erstes implementieren
5. Bestehenden DFD-Code in Phase 1 Tab migrieren