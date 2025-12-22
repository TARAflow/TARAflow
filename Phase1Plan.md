# 📋 Phase 1 Vervollständigung - Aufgabenliste
### Gesamt Layout:
```
┌─────────────┬────────────────────────────────────────────────┐
│  Sidebar    │  Phase Tabs (horizontal)                       │
│  (200-250px)│  ┌─────────┬───┬───┬───┬───┐                   │
│             │  │Allgemein│ 1 │ 2 │ 3 │ 4 │                   │
│             │  │  Info   │DFD│Ast│Thr│Rsk│                   │
│             ├──┴─────────┴───┴───┴───┴───┴───────────────────┤
│ 📁 Projekte │                                                │
│ ────────────│              Main Workspace                    │
│ ▼ Meine     │                                                │
│   • Prj A   │         (Tab-spezifischer Content)             │
│   • Prj B   │                                                │
│   **Prj C** │         (Prj C ist offen - fett)               │
│   • Prj D   │                                                │
│             │                                                │
│ [+ Neu]     │                                                │
│ [📥 Import] │                                                │
│             │                                                │
│ ─────────── │                                                │
│ 📌 Zuletzt: │                                                │
│  • Prj E    │                                                │
└─────────────┴────────────────────────────────────────────────┘
```

### Phase Tabs (Horizontal Top)
Tab "Allgemein" (immer erster Tab):
Inhalt könnte sein:
```
┌──────────────────────────────────────┐
│ Projekt-Informationen                │
│                                      │
│ Name: [Projekt C____________]        │
│ Beschreibung:                        │
│ [Textarea für Details]               │
│                                      │
│ Erstellt: 01.12.2025                 │
│ Zuletzt bearbeitet: 05.12.2025       │
│                                      │
│ Tags: [webapp] [high-risk] [+]       │
│                                      │
│ Team:                                │
│ • Analyst: Max Mustermann            │
│ • Reviewer: [Optional]               │
│                                      │
│ Status: 🟡 In Bearbeitung            │
│                                      │
│ ──────────────────────────           │
│ Projekt-Einstellungen:               │
│ □ Strict Mode (alle Phasen pflicht)  │
│ □ Auto-Save aktiviert                │
│                                      │
│ [Projekt exportieren] [Löschen]      │
└──────────────────────────────────────┘
```

#### Phasen-Tabs mit Status-Indikatoren:
- Tab 1: "1 - DFD ✓"        (grüner Haken)
- Tab 2: "2 - Assets ⚙"     (in Arbeit)
- Tab 3: "3 - Threats ⚠"    (unvollständig)
- Tab 4: "4 - Risiken ○"    (nicht gestartet)

#### Tab-Beschriftung Optionen:

- Kurz: 1 | 2 | 3 | 4
- Mit Icon: 📊 | 🛡️ | ⚠️ | 📈
- Mit Kurznamen: DFD | Assets | Threats | Risk
- Mein Favorit: 1-DFD | 2-Assets | 3-Threats | 4-Risk (mit Status-Icon)

#### Workflow-Beispiel
**Szenario:** User arbeitet an mehreren Projekten

1. Öffnet App → letztes Projekt ist offen (fett in Sidebar)
2. Ist in Phase 3 (Tab "3 - Threats" aktiv)
3. Click auf "Projekt B" in Sidebar:
- Dialog: "Projekt C speichern?" → Ja/Nein/Abbrechen
- Projekt B wird geladen und fett
- Projekt C wird normal
- Bleibt in Phase 3 (oder springt zur letzten Phase von Projekt B?)
4. Click auf "Allgemein" Tab → sieht Projekt B Infos
5. Click auf "1 - DFD" → sieht DFD von Projekt B

Basierend auf dem aktualisierten PhasePlan und den Requirements muss Phase 1 (UI Layout & Projektmanagement) folgendes umfassen:

## ✅ Was bereits vorhanden ist (CoReTM-2.0 Basis):

*   React-Setup mit TypeScript
*   Grundlegendes Material-UI Design
*   DFD-Editor (draw.io Integration)
*   JSON Import/Export Funktionalität
*   Basis Threat-Table

## 🔨 Was noch implementiert werden muss für Phase 1:

### 1\. Neues UI-Layout implementieren

#### 1.1 Haupt-Layout-Struktur  

``` typescript
//src/components/Layout/MainLayout.tsx 
- Linke Sidebar (200-250px, kollapsierbar) 
- Horizontale Phase-Tabs (Top) 
- Main Workspace (dynamisch) 
- Responsive Grid/Flexbox Layout
```

#### 1.2 Sidebar-Komponente
```
// src/components/Sidebar/ProjectSidebar.tsx
- Projektliste ("Meine Projekte")
- Aktives Projekt in FETT
- [+ Neu] und [📥 Import] Buttons
- "Zuletzt verwendet" Sektion
- Collapse/Expand Toggle (☰ Button)
- Keyboard Shortcut Ctrl+B  
```

#### 1.3 Kontext-Menü (Rechtsklick)
``` typescript
// src/components/Sidebar/ProjectContextMenu.tsx
- Öffnen
- Umbenennen
- Duplizieren
- Exportieren
- Löschen
- Portal-Rendering für z-index
```

#### 1.4 Phase-Tabs Navigation  
``` typescript
// src/components/Navigation/PhaseTabs.tsx
- Tab 0: "Allgemein" 
- Tab 1: "1 - DFD" + Status-Icon
- Tab 2: "2 - Assets" + Status-Icon
- Tab 3: "3 - Threats" + Status-Icon
- Tab 4: "4 - Risk" + Status-Icon
- Status-Icons: ✓ ⚙ ⚠ ○
```
### 2. Storage Layer & Projektmanagement
#### 2.1 Storage Wrapper

``` typescript
// src/services/storage.ts
- Wrapper für window.storage API
- CRUD-Operationen für Projekte
- Error Handling
- Type-safe interfaces
```

#### 2.2 Projekt-Datenstruktur

``` typescript
// src/types/project.ts
interface Project {
  id: string;
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  currentPhase: number;
  strideMethod: 'per-element' | 'per-interaction' | null;
  methodSelected: boolean;
  phaseStatus: {
    0: PhaseStatus; // general
    1: PhaseStatus; // dfd
    2: PhaseStatus; // assets
    3: PhaseStatus; // threats
    4: PhaseStatus; // risk
  };
  settings: ProjectSettings;
  tags: string[];
  team: string[];
  status: ProjectStatus;
  activityLog: ActivityLogEntry[];
  dfd: DFDData | null;
  assets: Asset[];
  threats: Threat[];
}

type PhaseStatus = 'not-started' | 'in-progress' | 'incomplete' | 'complete';
```

#### 2.3 Projekt-CRUD Operationen

```typescript
// src/services/projectService.ts
- createProject(data: ProjectInput): Promise<Project>
- getProject(id: string): Promise<Project>
- updateProject(id: string, data: Partial<Project>): Promise<Project>
- deleteProject(id: string): Promise<void>
- listProjects(): Promise<Project[]>
- exportProject(id: string): Promise<Blob>
- importProject(file: File): Promise<Project>
```

### 3. Tab "Allgemein" (General Tab)
#### 3.1 General Tab Komponente

``` typescript
// src/components/Tabs/GeneralTab.tsx
- Projekt-Informationen Form
- Projekt-Settings (Strict Mode, Auto-Save)
- Projekt-Dashboard mit Quick Stats
- Phase Status Cards (klickbar → jump to phase)
- Recent Activity Timeline
- Export/Delete Buttons
```

#### 3.2 Projekt-Dashboard

```typescript
// src/components/Dashboard/ProjectDashboard.tsx
- Progress Overview (Progress Bar)
- Phase Status Cards mit Icons
- Quick Statistics
- Validation Status
- Quick Actions
```

#### 3.3 Activity Log

```typescript
// src/components/Dashboard/ActivityLog.tsx
- Zeige letzte 10 Aktionen
- Timestamp + Action Type + Description
- Filter nach Aktion (Create, Update, Delete)
```

### 4. Ungespeicherte Änderungen (* Indicator)
#### 4.1 Dirty State Management

```typescript
// src/hooks/useUnsavedChanges.ts
- Track dirty state per phase
- Show * in project name
- Show * in phase tabs
- beforeunload Event Handler
- Save Dialog bei Projektwechsel
```

#### 4.2 Auto-Save Funktionalität

```typescript
// src/hooks/useAutoSave.ts
- Debounced Auto-Save (30 Sekunden default)
- Konfigurierbar in Settings
- Visual Feedback ("Last saved: 2 min ago")
- Manual Save Button
```

### 5. Projekt-Verwaltung Features
#### 5.1 Neues Projekt Dialog
```typescript
// src/components/Dialogs/NewProjectDialog.tsx
- Form: Name, Description, Version, Responsible
- Validation (Name required)
- Generate unique ID
- Create in storage
- Redirect to General Tab
```

### 6. Routing & Navigation
#### 6.1 React Router Setup
```typescript
// src/routing/AppRouter.tsx
Routes:
- / → Redirect to last project or empty state
- /project/:projectId → Load project
- /project/:projectId/phase/:phaseId → Load project + phase
```

#### 6.2 Navigation Service
```typescript
// src/services/navigationService.ts
- navigateToProject(projectId: string)
- navigateToPhase(projectId: string, phaseId: number)
- handleUnsavedChanges() → Save Dialog
```

### 7. Keyboard Shortcuts
#### 7.1 Keyboard Shortcut Handler
```typescript
// src/hooks/useKeyboardShortcuts.ts
Shortcuts:
- Ctrl/Cmd+B: Toggle Sidebar
- Ctrl/Cmd+S: Save Project
- Ctrl/Cmd+N: New Project
- Ctrl/Cmd+1-5: Jump to Tab 0-4
- Escape: Close Dialog
```

### 8. UI Komponenten & Styling
#### 8.1 Basis-Komponenten erstellen

￼
```typescript
// src/components/UI/
- Button.tsx (Primary, Secondary, Danger)
- Input.tsx (Text, Textarea)
- Dropdown.tsx (Select)
- Badge.tsx (Status-Icons mit Farben)
- Toast.tsx (Success/Error Messages)
- Modal.tsx (Dialog Base)
- Loading.tsx (Spinner, Skeleton)
```

#### 8.2 Tailwind CSS Setup

￼
```typescript
// tailwind.config.js
- Color Palette (Primary, Success, Warning, Danger)
- Spacing Scale
- Typography
- Breakpoints
- Animations
```

### 9. State Management
#### 9.1 Global State Setup
```typescript
// src/context/ProjectContext.tsx
- Current Project
- Active Phase
- Projects List
- Sidebar Collapsed State
- Unsaved Changes Flag
```

#### 9.2 Actions & Reducers
``` typescript
// src/context/actions.ts
- SET_ACTIVE_PROJECT
- UPDATE_PROJECT
- SET_ACTIVE_PHASE
- TOGGLE_SIDEBAR
- SET_UNSAVED_CHANGES
- ADD_ACTIVITY_LOG
```

### 10. Testing & Validation
#### 10.1 Unit Tests
```typescript
// src/services/__tests__/
- storage.test.ts
- projectService.test.ts
```

#### 10.2 Integration Tests
``` typescript
// src/components/__tests__/
- MainLayout.test.tsx
- ProjectSidebar.test.tsx
- GeneralTab.test.tsx
```

---

## 🎯 Priorisierung für Phase 1 Implementierung

### **Sprint 1 (Woche 1):**
1. Storage Layer & Projekt-Datenstruktur
2. Basis UI-Layout (Sidebar + Phase Tabs + Main Workspace)
3. Sidebar mit Projektliste (statisch)

### **Sprint 2 (Woche 2):**
4. Projekt CRUD (Create, Read, Update, Delete)
5. Tab "Allgemein" (Basic Version)
6. Import/Export erweitern

### **Sprint 3 (Woche 3):**
7. Sidebar-Features (Collapse, Kontext-Menü, Recently Used)
8. Unsaved Changes Handling + Auto-Save
9. Routing & Navigation
10. Keyboard Shortcuts

---

## 📁 Empfohlene Dateistruktur
```
src/
├── components/
│   ├── Layout/
│   │   ├── MainLayout.tsx
│   │   └── EmptyState.tsx
│   ├── Sidebar/
│   │   ├── ProjectSidebar.tsx
│   │   ├── ProjectList.tsx
│   │   ├── ProjectContextMenu.tsx
│   │   └── RecentProjects.tsx
│   ├── Navigation/
│   │   ├── PhaseTabs.tsx
│   │   └── PhaseTab.tsx
│   ├── Tabs/
│   │   ├── GeneralTab.tsx
│   │   ├── DFDTab.tsx (Phase 2)
│   │   ├── AssetsTab.tsx (Phase 3)
│   │   ├── ThreatsTab.tsx (Phase 4)
│   │   └── RiskTab.tsx (Phase 5)
│   ├── Dashboard/
│   │   ├── ProjectDashboard.tsx
│   │   ├── PhaseStatusCard.tsx
│   │   ├── QuickStats.tsx
│   │   └── ActivityLog.tsx
│   ├── Dialogs/
│   │   ├── NewProjectDialog.tsx
│   │   ├── ImportProjectDialog.tsx
│   │   ├── DeleteConfirmDialog.tsx
│   │   ├── RenameProjectDialog.tsx
│   │   └── UnsavedChangesDialog.tsx
│   └── UI/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Badge.tsx
│       ├── Toast.tsx
│       └── Modal.tsx
├── services/
│   ├── storage.ts
│   ├── projectService.ts
│   └── navigationService.ts
├── hooks/
│   ├── useUnsavedChanges.ts
│   ├── useAutoSave.ts
│   └── useKeyboardShortcuts.ts
├── context/
│   ├── ProjectContext.tsx
│   └── actions.ts
├── types/
│   ├── project.ts
│   ├── dfd.ts
│   ├── asset.ts
│   └── threat.ts
├── utils/
│   ├── validation.ts
│   └── formatters.ts
└── routing/
    └── AppRouter.tsx
```


























