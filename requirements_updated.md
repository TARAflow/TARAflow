# Threat Modeling Tool - User Stories

## Change History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-12-06 | Initial version |
| 2.1 | 2025-12-12 | DFD validation, Phase status, i18n, UI improvements |

## Project Information

- **Base:** CoReTM-2.0 (https://github.com/messi1/CoReTM-2.0)
- **Methodology:** STRIDE according to bbv TARA documentation (Chapter 2)
- **Goal:** Complete STRIDE workflow from DFD to threat table with modern UI
- **Version:** 2.1
- **Date:** December 12, 2025

---

## UI Layout Overview

The application uses a modern layout with:

- **Left Sidebar (200-250px)**: Collapsible project management panel
  - List of all projects under "My Projects"
  - Active project is displayed in **bold**
  - Quick actions: [+ New] [📥 Import]
  - "Recently Used" section
  - Context menu (right-click): Rename, Duplicate, Export, Delete
  - Toggle button to collapse/expand (saves screen space)
  - Option to keep sidebar pinned open

- **Horizontal Phase Tabs (Top)**: Navigation through workflow phases
  - Tab 0: "General" (project info & settings)
  - Tab 1: "1 - DFD" with status icon
  - Tab 2: "2 - Assets" with status icon
  - Tab 3: "3 - Threats" with status icon
  - Tab 4: "4 - Risk" with status icon
  - Status icons: ✓ (completed) | ⚙ (in progress) | ⚠ (incomplete) | ○ (not started)

- **Main Workspace**: Full-width area for phase-specific content

- **Unsaved Changes**: Indicated by `*` next to project name

---

## Epic 1: UI Layout & Project Management

### US-1.0: Implement Main UI Layout

**As a** developer  
**I want to** implement the base UI layout structure  
**so that** users have a modern, intuitive interface.

**Acceptance Criteria:**

- Left sidebar with project list is rendered
- Sidebar can be collapsed/expanded with toggle button
- Sidebar width is fixed at 200-250px when expanded
- Horizontal phase tabs are displayed at top
- Main workspace area adjusts to sidebar state
- Layout is responsive and works on desktop screens (1280px+)
- Keyboard shortcut `Ctrl+B` toggles sidebar

**Technical Notes:**

- Use React state to manage sidebar collapse state
- Store sidebar preference in localStorage (user preference)
- CSS Grid or Flexbox for layout
- Smooth transitions for collapse/expand animations

**Definition of Done:**

- Layout renders correctly
- Sidebar toggle works smoothly
- Phase tabs are visible
- No layout shifts or glitches
- Works on Chrome, Firefox, Safari, Edge

---

### US-1.1: Create New Project

**As a** user  
**I want to** create a new threat modeling project  
**so that** I can perform a structured security analysis for a system.

**Acceptance Criteria:**

- [+ New] button in left sidebar opens "New Project" dialog
- Required fields: Project name, short description
- Optional fields: System version, responsible person, creation date (automatic)
- System generates unique project ID (e.g., `project_uuid`)
- After saving: 
  - Project appears in sidebar list in **bold** (as active project)
  - User is redirected to "General" tab
  - Other projects are displayed in normal font
- Project is persistently stored
- Unsaved changes indicator `*` appears when editing

**Technical Notes:**

- Uses `window.storage.set('project:{project-id}', projectData)`
- Project data structure:

```json
{
  "id": "project_123",
  "name": "IoT Device Security",
  "description": "Threat Model for Smart Home Hub",
  "version": "1.0",
  "responsible": "Security Team",
  "created": "2025-12-06",
  "lastModified": "2025-12-06",
  "currentPhase": 0,
  "strideMethod": null,
  "dfd": null,
  "assets": [],
  "threats": [],
  "phaseStatus": {
    "0": "in-progress",
    "1": "not-started",
    "2": "not-started",
    "3": "not-started",
    "4": "not-started"
  }
}
```

**Definition of Done:**

- Project can be created
- Required field validation works
- Project appears in sidebar in **bold**
- Project is saved and can be loaded
- User lands on "General" tab

---

### US-1.2: Open Existing Project

**As a** user  
**I want to** open a previously created project from the sidebar  
**so that** I can continue my threat analysis.

**Acceptance Criteria:**

- All saved projects are listed in "My Projects" section
- Active project is displayed in **bold** font
- Click on any project in sidebar opens it
- Previously active project returns to normal font
- System loads all project data (DFD, assets, threats)
- User lands on last edited phase or "General" tab
- Unsaved changes prompt appears if switching with unsaved data
- Tooltip on hover shows: "Last edited: [date], Phase: [X]"

**Technical Notes:**

- Uses `window.storage.list('project:')`
- Store last active phase in project data
- Lazy loading for project list if many projects exist
- Show loading indicator while switching projects

**Definition of Done:**

- List shows all projects
- Click switches active project (bold → normal, normal → bold)
- All data loads correctly
- Navigation to correct phase works
- Unsaved changes warning works

---

### US-1.3: General Tab - Project Information

**As a** user  
**I want to** view and edit basic project information in the "General" tab  
**so that** I can maintain project metadata and settings.

**Acceptance Criteria:**

- "General" tab (Tab 0) is always the first tab
- Form displays project information:
  - **Name**: Editable text field
  - **Description**: Expandable textarea
  - **Version**: Text field
  - **Responsible**: Text field
  - **Created**: Read-only date
  - **Last Modified**: Read-only date, auto-updates
  - **Tags**: Add/remove tags (e.g., [webapp] [high-risk])
  - **Team**: Optional team members
  - **Status**: Dropdown (Planning/In Progress/Under Review/Completed)
- Project Settings section:
  - ☐ Strict Mode (all phases required before proceeding)
  - ☐ Auto-Save enabled (default: on)
  - Auto-save interval: [30] seconds
- Project Dashboard (Quick Stats):
  - Phase 1: ✓/⚙/⚠/○ DFD - X elements, Y data flows
  - Phase 2: ✓/⚙/⚠/○ Assets - X assets (Y critical)
  - Phase 3: ✓/⚙/⚠/○ Threats - X threats (Y open, Z mitigated)
  - Phase 4: ✓/⚙/⚠/○ Risk Assessment - X high-risk
- Buttons at bottom:
  - [Export Project] [Delete Project]
- Changes mark project with `*` (unsaved)
- Changes auto-save based on setting

**Technical Notes:**

- Calculate statistics from project data
- Update lastModified timestamp on any change
- Export generates JSON file
- Delete requires confirmation dialog

**Definition of Done:**

- All fields can be edited
- Auto-save works
- Statistics are accurate
- Export/Delete functions work
- Changes trigger unsaved indicator

---

### US-1.4: Delete Project

**As a** user  
**I want to** delete a project  
**so that** I can remove analyses that are no longer needed.

**Acceptance Criteria:**

- Delete option available in:
  1. Context menu (right-click on project in sidebar)
  2. [Delete Project] button in "General" tab
- Confirmation dialog: "Really delete '{ProjectName}'? This cannot be undone."
- After confirmation: 
  - Project is permanently deleted
  - Removed from sidebar list
  - If it was the active project, open most recent project or show empty state
- Success toast message appears: "Project deleted successfully"

**Technical Notes:**

- Uses `window.storage.delete('project:{project-id}')`
- All associated data (assets, threats) must be deleted
- Update sidebar list immediately

**Definition of Done:**

- Project can be deleted from context menu and General tab
- Confirmation is required
- All data is removed
- Sidebar updates correctly
- Appropriate project is loaded after deletion

---

### US-1.5: Export Project

**As a** user  
**I want to** export a project as JSON file  
**so that** I can back it up or share it with others.

**Acceptance Criteria:**

- Export option available in:
  1. Context menu (right-click on project in sidebar)
  2. [Export Project] button in "General" tab
- System generates complete JSON file with all data
- Download dialog with filename: `{projectname}_TARA_{date}.json`
- Exported file is valid, formatted JSON (pretty-print)
- Toast message: "Project exported successfully"

**Technical Notes:**

- Uses `Blob` and `URL.createObjectURL()` for download
- JSON should be indented (2 spaces) for readability
- Include metadata in export (export date, tool version)

**Definition of Done:**

- Export works from both locations
- JSON is valid and complete
- Filename is correctly formatted
- Download triggers properly

---

### US-1.6: Import Project

**As a** user  
**I want to** import a previously exported project  
**so that** I can continue work on other devices or after data loss.

**Acceptance Criteria:**

- [📥 Import] button in left sidebar
- File upload dialog accepts JSON files only
- Validation of JSON structure
- On success: 
  - Project is saved
  - Added to sidebar list in **bold** (becomes active)
  - User lands on "General" tab
  - Toast message: "Project imported successfully"
- On error: Clear error message with details
- Duplicate handling:
  - If project ID exists: Dialog "Project already exists. Overwrite or import as copy?"
  - Overwrite: Replaces existing project
  - Import as copy: Generates new ID, adds "(Copy)" to name

**Technical Notes:**

- JSON schema validation recommended
- Check for required fields
- Handle malformed JSON gracefully
- Generate new timestamps for import

**Definition of Done:**

- Import works
- Validation detects faulty files
- Duplicate handling works correctly
- Imported project is fully usable
- Becomes active project after import

---

### US-1.7: Project Context Menu

**As a** user  
**I want to** right-click on a project in the sidebar to access quick actions  
**so that** I can efficiently manage projects.

**Acceptance Criteria:**

- Right-click on any project in sidebar opens context menu
- Menu options:
  - **Open** (if not already active)
  - **Rename**: Inline edit or dialog
  - **Duplicate**: Creates copy with "(Copy)" suffix
  - **Export**: Downloads JSON
  - **Delete**: Opens confirmation dialog
- Menu closes after action or on outside click
- Menu is positioned near cursor

**Technical Notes:**

- Use portal for menu rendering (avoid z-index issues)
- Close menu on Escape key
- Disable "Open" option for already active project

**Definition of Done:**

- Context menu appears on right-click
- All actions work correctly
- Menu positioning is accurate
- Keyboard navigation works (optional)

---

### US-1.8: Sidebar Collapse/Expand

**As a** user  
**I want to** collapse the sidebar to maximize workspace  
**so that** I have more room for complex diagrams and tables.

**Acceptance Criteria:**

- Toggle button (☰) at top of sidebar
- Click toggles between collapsed/expanded states
- Collapsed state:
  - Sidebar width: ~50px
  - Shows only icons (no text)
  - Project list hidden
  - Hover shows tooltip with project name
- Expanded state:
  - Full width (200-250px)
  - Shows all text and buttons
- User preference is saved (persists across sessions)
- Optional: Pin icon to keep sidebar always expanded
- Keyboard shortcut: `Ctrl+B` toggles sidebar
- Smooth animation (0.3s transition)

**Technical Notes:**

- Store preference in `localStorage` (user setting, not project-specific)
- CSS transitions for smooth animation
- Ensure main workspace adjusts width accordingly
- Icons should be recognizable in collapsed state

**Definition of Done:**

- Toggle works smoothly
- Collapsed state is usable (icons + tooltips)
- Preference persists across browser sessions
- Keyboard shortcut works
- No layout glitches during transition

---

### US-1.9: Unsaved Changes Indicator

**As a** user  
**I want to** see a visual indicator when I have unsaved changes  
**so that** I don't accidentally lose my work.

**Acceptance Criteria:**

- Active project name in sidebar shows `*` when unsaved changes exist
- Example: "**IoT Security \***" (bold + asterisk)
- Phase tabs show `*` if that phase has unsaved data
- Attempting to switch projects with unsaved changes triggers dialog:
  - "You have unsaved changes in '{ProjectName}'. Save before switching?"
  - Options: [Save & Switch] [Discard] [Cancel]
- Attempting to close browser with unsaved changes triggers browser warning
- Auto-save (if enabled) removes `*` after successful save
- Manual save button appears in toolbar when unsaved changes exist

**Technical Notes:**

- Track dirty state per phase
- Use browser's `beforeunload` event for close warning
- Debounce auto-save to avoid excessive storage calls
- Show last saved timestamp: "Last saved: 2 minutes ago"

**Definition of Done:**

- `*` appears correctly when changes are made
- Save dialog works on project switch
- Browser close warning appears
- Auto-save removes indicator
- Manual save button is visible when needed

---

### US-1.10: Recently Used Projects

**As a** user  
**I want to** see a list of recently used projects  
**so that** I can quickly access my most frequent work.

**Acceptance Criteria:**

- "Recently Used" section below "My Projects" in sidebar
- Shows last 5 opened projects (excluding currently active)
- Sorted by last access time (most recent first)
- Click on recent project opens it (same behavior as "My Projects")
- Format: "Project Name - [date]"
- Section is collapsible (optional)

**Technical Notes:**

- Track last access time in project metadata
- Update on every project open
- Filter out deleted projects
- Limit to 5 for UI cleanliness

**Definition of Done:**

- Recently used list appears
- Shows correct 5 projects
- Opens project on click
- Updates when projects are accessed

---

## Epic 2: Data Flow Diagram (DFD) - Phase 1 Tab

### US-2.0: Phase 1 Tab - DFD Canvas

**As a** user  
**I want to** access the DFD editor in Phase 1 tab  
**so that** I can model the system architecture.

**Acceptance Criteria:**

- Phase 1 tab displays "1 - DFD" with status icon
- Tab becomes active when clicked
- Main workspace shows full-width DFD canvas (maximizes space)
- Empty state message when no DFD exists: "Create your data flow diagram to begin threat modeling"
- DFD toolbar is visible at top of canvas:
  - Element palette (drag & drop)
  - Zoom controls (+/- buttons, percentage display)
  - Export DFD as image (PNG/SVG)
  - Clear canvas (with confirmation)
- Status icon updates based on DFD completeness:
  - ○ Not started: No elements
  - ⚙ In progress: Has elements but incomplete
  - ⚠ Incomplete: Missing required elements or connections
  - ✓ Complete: All elements have names and connections are valid

**Technical Notes:**

- Integrate existing CoReTM DFD editor
- Canvas should be zoomable (mouse wheel + buttons)
- Panning with mouse drag or spacebar + drag
- Auto-save DFD on changes (debounced)

**Definition of Done:**

- Phase 1 tab renders DFD canvas
- Toolbar is functional
- Canvas is interactive (zoom, pan)
- Status icon reflects DFD state
- Empty state is clear

---

### US-2.1: Add DFD Elements

**As a** user  
**I want to** add standard DFD elements via drag & drop  
**so that** I can model the system architecture.

**Acceptance Criteria:**

- Element palette shows all DFD element types:
  - **External Entity (EE)**: Rectangle icon
  - **Process (P)**: Circle icon
  - **Data Store (DS)**: Parallel lines icon
  - **Data Flow (DF)**: Arrow icon
  - **Trust Boundary (TB)**: Dashed line icon
  - **Physical Interface (PI)**: Square icon (according to TARA 2.3.5)
- Drag element from palette to canvas creates new instance
- Elements can be:
  - Moved: Click and drag
  - Resized: Drag corners (for some element types)
  - Deleted: Select + Delete key or context menu
  - Duplicated: Ctrl+D or context menu
- Each element receives automatic unique ID:
  - EE-1, EE-2, ... (External Entities)
  - P-1, P-2, ... (Processes)
  - DS-1, DS-2, ... (Data Stores)
  - DF-1, DF-2, ... (Data Flows)
  - TB-1, TB-2, ... (Trust Boundaries)
  - PI-1, PI-2, ... (Physical Interfaces)
- IDs are displayed on canvas (small text)

**Technical Notes:**

- Extend existing CoReTM editor with "Physical Interface" symbol
- Use snap-to-grid for clean alignment (optional but recommended)
- Store element positions in DFD data
- Undo/redo support for element operations (optional)

**Definition of Done:**

- All 6 element types can be added
- Drag & drop works smoothly
- Elements can be moved, deleted, duplicated
- IDs are correctly assigned and displayed
- Multiple elements can be selected (Shift+Click or box select)

---

### US-2.2: Label and Configure DFD Elements

**As a** user  
**I want to** provide each DFD element with name and details  
**so that** components are clearly identifiable.

**Acceptance Criteria:**

- Double-click on element opens properties dialog
- Dialog is modal and centered
- Required field for all elements: **Name/Label**
- Element-specific fields:

  **External Entity (EE):**
  - Name (required)
  - Description (optional textarea)
  - Type: Dropdown (User/External System/IoT Device/Other)

  **Process (P):**
  - Name (required)
  - Description (optional)
  - Technology: Text field (e.g., "Node.js API", "Python Script")
  - Trust Level: Dropdown (Trusted/Semi-Trusted/Untrusted)

  **Data Store (DS):**
  - Name (required)
  - Description (optional)
  - Type: Dropdown (Database/File System/Cloud Storage/Registry/Cache)
  - Technology: Text field (e.g., "PostgreSQL", "AWS S3")

  **Data Flow (DF):**
  - Name (required)
  - Protocol: Dropdown (HTTP/HTTPS/MQTT/TCP/UDP/Bluetooth/Custom)
  - Encryption: Checkbox (Yes/No)
  - Data Type: Text field (e.g., "User credentials", "Sensor data")

  **Trust Boundary (TB):**
  - Name (required)
  - Description (optional)
  - Zone Type: Dropdown (Internal/DMZ/External/Cloud)

  **Physical Interface (PI):**
  - Name (required)
  - Interface Type: Dropdown (USB/UART/JTAG/SPI/I2C/Ethernet/GPIO/Other)
  - Description (optional)

- Label is displayed on canvas after saving
- Changes trigger unsaved indicator `*`
- Auto-save after 2 seconds of inactivity (debounced)

**Technical Notes:**

- Modal dialog component with form validation
- Store element properties in DFD data structure
- Update canvas label immediately on dialog close
- Validation: Name field cannot be empty

**Definition of Done:**

- Dialog opens on double-click
- All element-specific fields are present
- Name is required and validated
- Changes save correctly
- Label updates on canvas
- Dialog can be closed with Escape key

---

### US-2.3: Create Data Flows Between Elements

**As a** user  
**I want to** draw data flows (arrows) between elements  
**so that** communication paths in the system become visible.

**Acceptance Criteria:**

- Click on source element, then click on target element creates data flow
- Arrow shows direction (source → target)
- Bidirectional flows: Create two separate arrows (recommended)
- Data flow can be labeled (double-click opens properties)
- Arrow can be:
  - Deleted: Select + Delete key
  - Redrawn: Delete and create new
  - Styled: Solid line (default) or dashed line option
- Invalid connections are prevented with warning message:
  - ✗ EE → EE (without intermediate process)
  - ✗ DS → DS (data stores don't communicate directly)
  - ✓ All other combinations allowed
- Validation warnings appear as toast notifications

**Technical Notes:**

- Use arrow library for attractive, curved arrows (e.g., leader-line or native SVG)
- Snap-to-edge for element connections
- Store connections in DFD data as `{from: "EE-1", to: "P-1", label: "User login"}`
- Implement DFD validation rules according to TARA 2.3.2

**Definition of Done:**

- Data flows can be created by clicking source and target
- Direction is clearly visible with arrow
- Invalid connections are prevented
- Error messages are clear
- Data flows can be deleted and edited

---

### US-2.4: Define Trust Boundaries

**As a** user  
**I want to** draw trust boundaries in the DFD  
**so that** security zones are visually delimited.

**Acceptance Criteria:**

- Trust Boundary tool in palette
- Two drawing modes:
  1. **Freehand**: Click multiple points to create custom shape, double-click to close
  2. **Rectangle**: Click and drag to create rectangular boundary
- Boundary appears as dashed line with semi-transparent fill
- Can be labeled (double-click opens properties)
- Multiple boundaries can be created with different zones
- Visual styling:
  - Internal zone: Green/light green
  - DMZ: Orange/yellow
  - External: Red/light red
  - Cloud: Blue/light blue
- Boundaries are placed behind elements (z-index)
- Can be resized by dragging corners

**Technical Notes:**

- SVG shapes for boundaries
- Layering: Trust boundaries should be in background layer
- Allow overlapping boundaries (for nested zones)
- Store boundary points/dimensions in DFD data

**Definition of Done:**

- Trust boundaries can be drawn (freehand or rectangle)
- Labeling works
- Visual zones are distinguishable by color
- Boundaries don't obscure elements
- Can be edited and deleted

---

### US-2.5: Save and Validate DFD

**As a** user  
**I want to** save the DFD and check for completeness  
**so that** I can ensure all necessary elements are present before proceeding.

**Acceptance Criteria:**

- [Save] button in toolbar manually saves DFD
- Auto-save triggers every 30 seconds if changes exist
- Validation checks on save:
  - ✓ All elements have names
  - ✓ All data flows are properly connected (no dangling arrows)
  - ✓ No isolated elements (elements not connected to any data flow)
    - Exception: Trust boundaries can stand alone
  - ✓ At least one External Entity exists
  - ✓ At least one Process exists
  - ✓ Data flows have protocols defined
- Warnings displayed in validation panel or toast:
  - ⚠ "Element P-2 has no name"
  - ⚠ "Data flow DF-3 is not connected"
  - ⚠ "External Entity EE-1 is isolated"
- Phase 1 status icon updates:
  - ✓ Complete: All validations pass
  - ⚠ Incomplete: Warnings exist but DFD is usable
  - ⚙ In progress: DFD exists but has issues
- Success message: "DFD saved successfully"
- Validation report can be exported as text/PDF (optional)

**Technical Notes:**

- Save DFD as JSON structure in project data
- Validation rules should be configurable (strict/lenient mode)
- Store validation results in project data
- Calculate DFD statistics: X elements, Y data flows, Z trust boundaries

**Definition of Done:**

- DFD saves correctly (manual and auto-save)
- All validation checks run
- Warnings are displayed clearly
- Status icon updates based on validation
- User can proceed to Phase 2 even with warnings (soft validation)

---

### US-2.6: Export DFD as Image

**As a** user  
**I want to** export the DFD as an image file  
**so that** I can include it in reports or presentations.

**Acceptance Criteria:**

- [Export Image] button in DFD toolbar
- Export formats:
  - **PNG**: Raster image (default)
  - **SVG**: Vector image (scalable)
- Export dialog allows:
  - Select format (PNG/SVG)
  - Choose resolution for PNG (72dpi/150dpi/300dpi)
  - Include/exclude grid
  - Crop to content or full canvas
- Filename: `{projectname}_DFD_{date}.{format}`
- Downloaded file opens correctly in image viewers

**Technical Notes:**

- Use HTML5 Canvas API or SVG serialization
- For PNG: Convert SVG/Canvas to PNG using `toDataURL()`
- Ensure fonts and styles are embedded in export
- Respect canvas zoom level (export at 100% zoom)

**Definition of Done:**

- Export button works
- Both PNG and SVG formats export correctly
- Images are high quality and readable
- Filename is formatted correctly
- Export includes all visible elements

---

## Epic 3: STRIDE Method Selection (after Phase 1 completion)

### US-3.1: Display STRIDE Method Selection Dialog

**As a** user  
**I want to** be prompted to choose a STRIDE analysis method after completing the DFD  
**so that** the tool generates appropriate threats.

**Acceptance Criteria:**

- Modal dialog appears automatically when:
  - Phase 1 (DFD) is marked complete (✓)
  - User clicks "Continue to Phase 2" or navigates to Phase 2 tab
  - No STRIDE method has been selected yet
- Dialog cannot be dismissed without making a selection
- Dialog title: "Choose STRIDE Analysis Method"
- Dialog shows two options:
  1. **STRIDE-per-element**
  2. **STRIDE-per-interaction**
- Each option has:
  - Radio button for selection
  - Title with icon
  - Description (2-3 sentences)
  - Visual diagram or example
  - "Best for" use cases
- Help text explains differences based on TARA 2.6.2 vs 2.6.3
- Buttons: [Continue with Selection] [Learn More] [Cancel]

**Technical Notes:**

- Store selected method in `project.strideMethod`
- Set flag `methodSelected: true` to prevent re-showing dialog
- If user cancels, stay on Phase 1 tab

**Definition of Done:**

- Dialog appears at appropriate time
- Both methods are clearly described
- Selection can be made
- Dialog is modal (cannot be bypassed)
- Selection is saved to project

---

### US-3.2: STRIDE-per-element Explanation

**As a** user  
**I want to** understand what STRIDE-per-element means  
**so that** I can make an informed choice.

**Acceptance Criteria:**

- STRIDE-per-element section shows:
  - **Title**: "STRIDE-per-element: Comprehensive Component Analysis"
  - **Icon**: Grid or list icon
  - **Description**: "Analyzes each DFD element (External Entity, Process, Data Store, Data Flow) individually against all applicable STRIDE threats. Provides thorough coverage but requires more effort."
  - **Best for**:
    - Closed systems with limited external interfaces
    - Safety-critical systems requiring exhaustive analysis
    - Regulatory compliance (e.g., automotive ISO 21434)
  - **Process**: "Each element type is analyzed for specific threats:
    - External Entities → Spoofing, Repudiation
    - Processes → All 6 STRIDE categories
    - Data Stores → Tampering, Repudiation, Information Disclosure, DoS
    - Data Flows → Tampering, Information Disclosure, DoS"
  - **Effort**: High (more threats to review)
  - **Coverage**: Excellent (better threat coverage according to Tuma & Scandariato study)
- Visual example: DFD with highlighted elements and corresponding threat counts

**Technical Notes:**

- Reference TARA 2.6.2 and Table 2
- Link to Tuma & Scandariato comparison study
- Show estimated threat count based on current DFD

**Definition of Done:**

- Explanation is clear and accurate
- Best-for use cases are listed
- Visual example helps understanding
- Matches TARA documentation

---

### US-3.3: STRIDE-per-interaction Explanation

**As a** user  
**I want to** understand what STRIDE-per-interaction means  
**so that** I can make an informed choice.

**Acceptance Criteria:**

- STRIDE-per-interaction section shows:
  - **Title**: "STRIDE-per-interaction: Communication-Focused Analysis"
  - **Icon**: Network or connection icon
  - **Description**: "Analyzes data flows and interactions between components. Focuses on communication channels and boundaries. More efficient for networked systems."
  - **Best for**:
    - Web applications and APIs
    - Distributed/microservices architectures
    - Cloud-native systems with many external services
  - **Process**: "Each data flow is analyzed for threats during transmission:
    - User → Web Server: Authentication, data integrity, confidentiality, availability
    - Crossing trust boundaries: Special attention to boundary threats
    - Focus on network protocols and communication patterns"
  - **Effort**: Medium (fewer total threats to analyze)
  - **Coverage**: Good (focuses on high-risk interaction points)
- Visual example: DFD with highlighted data flows and trust boundary crossings

**Technical Notes:**

- Reference TARA 2.6.3
- Emphasize trust boundary crossing analysis
- Show estimated threat count based on data flows

**Definition of Done:**

- Explanation is clear and accurate
- Best-for use cases are listed
- Visual example helps understanding
- Difference from per-element is clear

---

### US-3.4: Save STRIDE Method Selection

**As a** user  
**I want to** confirm my STRIDE method selection  
**so that** the tool can generate appropriate threats in Phase 3.

**Acceptance Criteria:**

- [Continue with Selection] button is enabled after choosing a method
- Click saves selection and closes dialog
- Selected method is stored in project data: `project.strideMethod = "per-element" | "per-interaction"`
- User is redirected to Phase 2 (Assets) tab
- Method selection is visible in "General" tab (read-only or editable with warning)
- If method is changed later, warning dialog:
  - "Changing the STRIDE method will regenerate all threats. Existing threat customizations will be lost. Continue?"
  - Options: [Change Method & Regenerate] [Keep Current Method]

**Technical Notes:**

- Store in project: `strideMethod: "per-element" | "per-interaction"`
- Flag: `methodSelected: true`
- Regenerating threats should preserve manual threat additions (optional)

**Definition of Done:**

- Selection saves correctly
- Dialog closes
- User navigates to Phase 2
- Method is visible in project settings
- Change warning works if method is modified

---

## Epic 4: Asset Identification and Security Goals - Phase 2 Tab

### US-4.x: Asset Tab – Asset Management Table  
As a user  
I want to manage all assets within the "Assets" tab  
so that I can define, evaluate, and maintain the system’s critical assets and their security requirements.



#### Acceptance Criteria:

**"Assets" tab (Tab 2) is positioned after the DFD tab**

The tab displays the **Asset Table**, containing one row per asset with the following mandatory columns:

- **Asset-ID** (read-only, auto-generated: A1, A2, …)  
- **Description** (editable text field)  
- **Impact Criteria** (grouped field or expandable detail cell)  
  - Business/organizational impact  
  - Physical/safety impact  
  - Privacy (optional)  
  - Reputation impact  
  - Operational/financial impact  
- **Total Impact** (read-only; auto-calculated based on chosen mode)  
- **Security Goals (CIANAAA)**  
  - Confidentiality  
  - Integrity  
  - Availability  
  - Authentication  
  - Authorization  
  - Accountability  
- **Formal Security Goals** (expandable textarea)


#### Table Features:

- Rows are sortable (by Asset-ID, Total Impact, Description, etc.)
- Rows are filterable (e.g., show only critical assets)
- Clicking a row opens a right-side detail panel for full asset editing
- Impact Criteria can be expanded/collapsed inline
- Security Goal flags shown as checkboxes or icon indicators
- Formal security goals shown truncated with “expand”
- Critical assets visually highlighted (e.g., red badge for high Total Impact)
- Table supports:
  - Add Asset
  - Duplicate Asset
  - Delete Asset (requires confirmation)
  - Bulk export (JSON/CSV/Excel)


#### Editing an Asset (Detail Panel):

Fields available:
- Asset-ID (read-only)
- Name / Description
- Asset Type (Data, Process, Component, Data Flow, Function, System)
- Impact Criteria (editable fields)
- Calculation Mode:  
  - ☐ Conservative  
  - ☐ Average  
- Total Impact (read-only, recalculated live)
- Security Goals (CIANAAA checkboxes)
- Formal Security Goals: multiline editor
- Linked DFD Elements: list of references (e.g., P1, DF3, DS2)
- Referenced by Threats: counter + link (e.g., “3 threats → view”)
- Referenced by Attack Trees: counter + link


#### Buttons at bottom of Tab:
- **[Add Asset]**  
- **[Export Assets]** (CSV/Excel/JSON)  
- **[Delete All Assets]** (requires confirmation dialog)


#### Behaviors:
- Creating a new asset adds a new row with auto-generated Asset-ID
- Changes in Impact Criteria automatically update Total Impact
- Removing an asset with references (Threats/Attack Trees) triggers warning dialog
- Undo/Redo supported (consistent with project UI)
- Changes trigger unsaved-project indicator (*)
- Changes obey the global Auto-Save setting


#### Technical Notes:

- Store all asset data in `project.assets`
- Asset-ID format must remain stable (`A1`, `A2`, ...)  
- Total Impact recalculated using the selected calculation mode:
  - **Conservative** = takes highest single criterion  
  - **Average** = weighted or arithmetic average
- Table must support ≥ 500 rows with no poor UI performance
- Export includes all metadata needed for full reconstruction
- Update `lastModified` timestamp on asset changes
- Impact Criteria fields should support configurable criteria in future versions


#### Definition of Done:

- Asset Table visible and functional
- All asset fields can be edited according to their rules
- Impact calculation is correct and auto-updating
- CIANAAA goals shown, persisted, and referenced in Threat Analysis
- Formal security goals saved correctly
- Table sorting, filtering, and detail editing all working
- Export produces complete and accurate asset data
- Unsaved indicator and Auto-Save function reliably

---

### US-4.0: Phase 2 Tab - Asset Management Layout

**As a** user  
**I want to** access asset management in Phase 2 tab  
**so that** I can define assets and their security requirements.

**Acceptance Criteria:**

- Phase 2 tab displays "2 - Assets" with status icon
- Main workspace uses split-view layout:
  - **Left side (30%)**: Mini-DFD (read-only, for reference)
    - Shows complete DFD from Phase 1
    - Zoom controls for better visibility
    - [Enlarge] button opens full-screen DFD view
    - Click on DFD element highlights it and scrolls to related assets (if any)
  - **Right side (70%)**: Asset management area
    - [+ New Asset] button at top
    - Asset list (table or cards)
    - Filter/sort controls
    - Selected asset details/edit form
- Empty state when no assets: "Define assets worth protecting. Start by adding your first asset."
- Status icon updates based on asset completeness:
  - ○ Not started: No assets defined
  - ⚙ In progress: Has assets but incomplete (missing criticality or goals)
  - ⚠ Incomplete: Assets missing required fields
  - ✓ Complete: All assets have criticality assessment and security goals

**Technical Notes:**

- Use CSS Grid or Flexbox for split-view
- Mini-DFD should be interactive (zoom, pan) but read-only
- Asset list should be virtualized if many assets (performance)
- Auto-save on asset changes

**Definition of Done:**

- Phase 2 tab renders split-view layout
- Mini-DFD displays correctly and is interactive
- Asset management area is functional
- Empty state is clear
- Status icon reflects asset state

---

### US-4.1: Create Asset

**As a** user  
**I want to** create a new asset with all relevant information  
**so that** I build a complete asset list.

**Acceptance Criteria:**

- [+ New Asset] button opens asset creation form/dialog
- Form fields according to TARA 2.4.1:
  - **Asset-ID**: Auto-generated (e.g., A001, A002, ...)
  - **Asset Name**: Required text field
  - **Category**: Required dropdown (Data/System/Infrastructure/Process/Human)
  - **Description**: Textarea (optional but recommended)
  - **Linked DFD Element**: Dropdown showing all DFD elements (optional)
  - **Storage Location**: Text field (optional)
  - **Dependencies**: Multi-select from existing assets
  - **Responsibility**: Text field (owner/team)
- Buttons: [Save Asset] [Cancel]
- After saving:
  - Asset appears in asset list
  - Form clears for adding next asset or closes (user preference)
  - Success message: "Asset created successfully"
  - Unsaved changes indicator `*` appears
- Validation: Name and Category are required

**Technical Notes:**

- Asset data structure:
```json
{
  "id": "A001",
  "name": "Production Calibration Data",
  "category": "Data",
  "description": "Critical parameters for production control",
  "linkedDfdElement": "DS-1",
  "location": "Database Server 1",
  "dependencies": ["A002", "A010"],
  "responsible": "Production Team",
  "criticality": {
    "overall": null,
    "criteria": {}
  },
  "strideRelevance": {
    "S": false, "T": false, "R": false,
    "I": false, "D": false, "E": false
  },
  "securityGoals": []
}
```

**Definition of Done:**

- Asset creation form/dialog works
- All fields are present and functional
- Validation works (name + category required)
- Asset is saved to project data
- Asset appears in list
- Linked DFD element dropdown shows all elements

---

### US-4.2: Display Asset Categories

**As a** user  
**I want to** see guidance on asset categories  
**so that** I can systematically capture all assets worth protecting.

**Acceptance Criteria:**

- Help panel or collapsible section shows 5 asset categories from TARA 2.4.1:
  
  1. **Data Assets**: 
     - Business-critical data
     - Personal data (PII)
     - Configuration data
     - Authentication credentials
     - Intellectual property
  
  2. **System Assets**:
     - Control components
     - Communication interfaces
     - Processing logic/algorithms
     - Security components (firewalls, auth services)
     - Operating systems
  
  3. **Infrastructure Assets**:
     - Hardware (servers, IoT devices, sensors)
     - Network infrastructure (routers, switches)
     - Storage systems
     - Backup systems
     - Power/cooling systems
  
  4. **Process Assets**:
     - Production/manufacturing processes
     - Maintenance/update procedures
     - Operational documentation
     - Business workflows
     - Incident response processes
  
  5. **Human Assets**:
     - Operators/end users
     - Technicians/maintenance personnel
     - Analysts/supervisors
     - Administrators
     - External contractors

- Each category is expandable accordion-style
- Help text accessible via (?) icon or "Show Categories" button
- Optional: Template assets for quick adding (pre-filled examples)

**Technical Notes:**

- Store category examples as static content or config
- Template assets can speed up initial setup
- Help panel can be sidebar or modal

**Definition of Done:**

- All 5 categories are documented and visible
- Examples are clear and helpful
- Help is easily accessible
- UI is intuitive (accordion/collapsible)

---

### US-4.3: Assess Asset Criticality

**As a** user  
**I want to** evaluate each asset according to impact criteria  
**so that** I can prioritize security measures.

**Acceptance Criteria:**

- Click on asset opens detail view with "Criticality Assessment" section
- Shows 4-6 relevant criteria from TARA 2.4.2 (customizable per asset):
  
  **Business Criteria**:
  - Financial Damage
  - Regulatory/Compliance Impact
  - Reputation Impact
  - Privacy Violation
  - Operational Impact
  - Affected Users/Systems
  - Recoverability
  
  **Physical Criteria** (for safety-critical systems):
  - Safety Impact
  - Physical Asset Damage
  - Environmental Impact
  - Supply Chain/Logistics Impact

- 4-level assessment per criterion:
  - **Critical** (Red): Existential threat, severe safety risk, catastrophic financial loss
  - **High** (Orange): Major disruptions, significant harm, large financial impact
  - **Medium** (Yellow): Noticeable impairments, moderate harm, manageable financial loss
  - **Low** (Green): Minimal impact, negligible harm, minor financial loss

- UI: Matrix or table with radio buttons for each criterion
- Tooltips explain each level with examples
- System calculates **Overall Criticality** using "Highest Impact" principle:
  - If any criterion is Critical → Overall = Critical
  - Else if any is High → Overall = High
  - Else if any is Medium → Overall = Medium
  - Else → Overall = Low
- Overall criticality displayed prominently with color badge
- Changes trigger unsaved indicator `*`

**Technical Notes:**

- Store criticality in asset:
```json
"criticality": {
  "overall": "High",
  "criteria": {
    "financialDamage": "High",
    "regulatory": "Medium",
    "reputation": "High",
    "privacy": "Low",
    "operational": "Medium"
  }
}
```
- Calculate overall on each criterion change
- Color coding: Critical=#DC2626, High=#EA580C, Medium=#CA8A04, Low=#16A34A

**Definition of Done:**

- Criticality assessment UI is clear and intuitive
- All criteria can be assessed
- Overall criticality calculates correctly
- Color coding is visible
- Tooltips provide guidance
- Changes save automatically

---

### US-4.4: Determine STRIDE Relevance per Asset

**As a** user  
**I want to** define which STRIDE categories are relevant for each asset  
**so that** threat analysis is focused and complete.

**Acceptance Criteria:**

- Asset detail view shows "STRIDE Relevance" section
- Checkbox list of 6 STRIDE categories:
  - ☐ **S**poofing (Authentication)
  - ☐ **T**ampering (Integrity)
  - ☐ **R**epudiation (Non-Repudiation)
  - ☐ **I**nformation Disclosure (Confidentiality)
  - ☐ **D**enial of Service (Availability)
  - ☐ **E**levation of Privilege (Authorization)
- Brief explanation per category as tooltip (e.g., hover on "Spoofing" shows "Threats related to identity verification and authentication")
- Recommendations based on asset category:
  - **Data Assets** → T, I, D (integrity, confidentiality, availability)
  - **System Assets** → All 6 categories
  - **Infrastructure Assets** → D, E (availability, privilege)
  - **Process Assets** → R, T (non-repudiation, integrity)
  - **Human Assets** → S, E (authentication, authorization)
- Recommendations shown as "Suggested: T, I, D" but user can override
- Multiple categories can be selected
- Selection saves automatically

**Technical Notes:**

- Reference TARA Table 2 (DFD element → STRIDE mapping)
- Store in asset: `"strideRelevance": {"S": true, "T": true, ...}`
- Auto-suggest based on category but allow full customization

**Definition of Done:**

- STRIDE categories can be selected/deselected
- Recommendations are displayed based on asset category
- Tooltips provide clear explanations
- Selection saves automatically
- User can override suggestions

---

### US-4.5: Define Security Goals

**As a** user  
**I want to** formulate specific, measurable security goals for each selected STRIDE category  
**so that** protection objectives are clear and actionable.

**Acceptance Criteria:**

- Asset detail view shows "Security Goals" section
- For each **selected** STRIDE category, show:
  - Category badge (e.g., "T - Tampering (Integrity)")
  - Text field for security goal
  - Character counter (e.g., "0/500")
  - Help text: "Make your goal SMART: Specific, Measurable, Achievable, Relevant, Time-bound"
- SMART criteria explanation available via (?) icon
- Examples per STRIDE category (from TARA 2.4.3):
  
  **Spoofing (Authentication)**:
  - "All administrative accesses require MFA; sessions terminate after 30 min inactivity"
  
  **Tampering (Integrity)**:
  - "All configuration data protected so manipulation is detected within 30 seconds"
  
  **Repudiation (Non-Repudiation)**:
  - "All production parameter changes logged with timestamp, actor, and change type"
  
  **Information Disclosure (Confidentiality)**:
  - "All transmissions with PII/business-critical data encrypted; no unauthorized access"
  
  **Denial of Service (Availability)**:
  - "Production systems 99.5% available during operating hours; 15-minute recovery time"
  
  **Elevation of Privilege (Authorization)**:
  - "Firmware updates require explicit authorization; privilege escalations auto-revoked after 4 hours"

- Multiple goals per category allowed (e.g., primary + secondary goals)
- Goals can be saved as templates for reuse
- Template library shows previously used goals with [Use Template] button
- Changes trigger unsaved indicator `*`

**Technical Notes:**

- Store goals in asset:
```json
"securityGoals": [
  {
    "category": "T",
    "goal": "All configuration data must be checksummed..."
  },
  {
    "category": "I",
    "goal": "All user data encrypted at rest using AES-256..."
  }
]
```
- Template library stored separately (project-level or global)
- Rich text editor optional (for formatting)

**Definition of Done:**

- Security goal fields appear for selected STRIDE categories
- SMART criteria guidance is accessible
- Examples are helpful and accurate
- Multiple goals per category can be added
- Template library works (save/reuse)
- Goals save automatically

---

### US-4.6: Display Asset-Security Mapping Table

**As a** user  
**I want to** see a comprehensive table of all assets with their assessments  
**so that** I can review completeness and identify gaps.

**Acceptance Criteria:**

- Asset list view shows table with columns (TARA 2.4.4):
  - **Asset-ID** (A001, A002, ...)
  - **Asset Name**
  - **Category** (Data/System/Infrastructure/Process/Human)
  - **Criticality** (color-coded badge: Critical/High/Medium/Low)
  - **STRIDE Relevance** (letters: e.g., "S,T,I,D,E")
  - **Security Goals** (count: "3 goals" or first 50 chars as preview)
  - **Actions** (Edit, Duplicate, Delete icons)
- Table features:
  - Sortable by all columns (click header to sort)
  - Filterable:
    - By category (dropdown or checkboxes)
    - By criticality (slider or checkboxes)
    - By STRIDE categories (multi-select)
    - By completion status (Complete/Incomplete)
  - Search box (searches name, description)
  - Pagination if many assets (e.g., 20 per page)
- Click on row opens asset detail view for editing
- Export buttons:
  - [Export as CSV]
  - [Export as Excel]
  - [Export as PDF Report]
- Export filename: `{projectname}_Assets_{date}.{format}`
- Empty state: "No assets defined yet. Click [+ New Asset] to start."

**Technical Notes:**

- Use responsive table component (e.g., react-table or tanstack-table)
- Virtualization for performance with 100+ assets
- Export using PapaParse (CSV) and SheetJS (Excel)
- PDF export with project header and formatted table

**Definition of Done:**

- Table displays all assets correctly
- Filtering and sorting work smoothly
- Search finds assets by name/description
- Click on row opens detail view
- Export to CSV, Excel, PDF works
- Pagination works (if needed)
- Empty state is clear

---

### US-4.7: Perform Asset Validation

**As a** user  
**I want to** validate the asset list for completeness  
**so that** no critical assets are overlooked.

**Acceptance Criteria:**

- [Validate Assets] button above asset table
- Click starts validation checks based on TARA 2.4.6:
  
  **Completeness Checks**:
  - ✓ All DFD components captured as assets?
    - Compare DFD elements (External Entities, Processes, Data Stores) with linked assets
    - Flag DFD elements without corresponding assets
  - ✓ All data flows considered?
    - Check if data transmitted in flows is represented as data assets
  - ✓ External dependencies included?
    - Warn if no external system/cloud assets defined
  - ✓ Technical AND organizational assets present?
    - Check for at least one Process asset (organizational)
    - Check for at least one System asset (technical)
  - ✓ All 6 STRIDE categories covered?
    - Ensure at least one asset addresses each STRIDE category
  - ✓ Criticality assessments consistent?
    - Flag assets with criticality but no security goals
    - Flag critical assets with insufficient goals
  - ✓ Security goals SMART formulated?
    - Heuristic checks: goals have metrics, timeframes, specifics

- Validation results displayed as report:
  - **Errors** (must fix): Missing required fields, inconsistencies
  - **Warnings** (should fix): Incomplete data, missing recommendations
  - **Suggestions**: Best practice improvements
- Each issue links to affected asset for quick fixing
- Overall validation status:
  - ✓ Complete: No errors, < 2 warnings
  - ⚠ Needs Review: Has warnings
  - ✗ Incomplete: Has errors
- Phase 2 status icon updates based on validation
- After successful validation: [Continue to Phase 3] button enabled

**Technical Notes:**

- Cross-reference between DFD elements and assets
- Heuristics for SMART goal validation (keyword detection)
- Store validation results in project for later reference
- Generate exportable validation report (PDF/HTML)

**Definition of Done:**

- Validation can be triggered
- All checks run correctly
- Results are clear and actionable
- Issues link to affected assets
- Status icon updates
- Navigation to Phase 3 enabled after validation

---

## Epic 5: Threat Identification and Table Creation - Phase 3 Tab

### US-5.0: Phase 3 Tab - Threat Table Layout

**As a** user  
**I want to** access threat management in Phase 3 tab  
**so that** I can identify and document threats.

**Acceptance Criteria:**

- Phase 3 tab displays "3 - Threats" with status icon
- Main workspace shows:
  - **Top toolbar**:
    - [Generate Threats] button (based on STRIDE method)
    - [+ Add Threat Manually] button
    - Filter controls (STRIDE type, Status, Asset, Element)
    - Search box
    - [Export Threats] dropdown (CSV/Excel/PDF/Markdown)
  - **Threat table** (full width):
    - All columns from TARA Table 6 (see US-5.1)
    - Sortable, filterable
    - Inline editing or row click opens detail dialog
  - **Statistics panel** (collapsible sidebar or top):
    - Total threats: X
    - By STRIDE: S=5, T=8, R=3, I=12, D=6, E=4
    - By status: Open=15, In Review=8, Resolved=12
    - By criticality: High=7, Medium=18, Low=10
- Empty state: "No threats identified yet. Click [Generate Threats] to automatically create threats based on your DFD and STRIDE method."
- Status icon updates:
  - ○ Not started: No threats
  - ⚙ In progress: Threats exist but many open
  - ⚠ Incomplete: Threats missing mitigation or testing
  - ✓ Complete: All threats have mitigation and status is Resolved or Accepted

**Technical Notes:**

- Use virtualized table for performance with 100+ threats
- Real-time search/filter (client-side)
- Preserve filter state in session storage
- Statistics recalculate on data changes

**Definition of Done:**

- Phase 3 tab renders threat table layout
- Toolbar buttons are functional
- Table displays correctly (empty state or with threats)
- Filters and search work
- Statistics calculate correctly
- Status icon reflects threat state

---

### US-5.1: Initialize Threat Table (Generate Threats)

**As a** user  
**I want to** automatically generate threats based on my STRIDE method and DFD  
**so that** I have a comprehensive starting point for threat analysis.

**Acceptance Criteria:**

- [Generate Threats] button triggers automatic threat generation
- Generation logic depends on `project.strideMethod`:
  
  **STRIDE-per-element** (TARA 2.6.2):
  - For each DFD element, generate threats based on TARA Table 2:
    - **External Entity (EE)** → S, R
    - **Process (P)** → S, T, R, I, D, E (all 6)
    - **Data Store (DS)** → T, R, I, D
    - **Data Flow (DF)** → T, I, D
    - **Physical Interface (PI)** → T, I, D, E
  - Threat ID format: `{ElementID}-{STRIDE}`
    - Example: `P-1-S`, `P-1-T`, `P-1-R`, etc.
  
  **STRIDE-per-interaction** (TARA 2.6.3):
  - For each data flow (DF), generate threats based on interaction:
    - All data flows → S, T, I, D (at minimum)
    - Crossing trust boundaries → E additional
  - Threat ID format: `{FlowID}-{STRIDE}`
    - Example: `DF-1-S`, `DF-1-T`, `DF-1-I`, `DF-1-D`

- Generated threats populate table with columns (TARA Table 6):
  - **Threat-ID**: Auto-generated (format above)
  - **Element/Interaction**: Reference to DFD element or data flow
  - **Asset-ID**: Link to affected assets (multi-select from asset list)
  - **STRIDE Type**: S/T/R/I/D/E
  - **Threat/Danger**: Description (template-based, user editable)
  - **Possible Attack**: Attack scenarios (template-based)
  - **Threat Actor**: Dropdown (Insider/External Attacker/Nation-State/Script Kiddie/Competitor/Other)
  - **Attack Vector**: Dropdown (Network/API/Physical/Social Engineering/Malware/Supply Chain/Other)
  - **Mitigation/Countermeasure**: Empty (to be filled)
  - **Test/Verification**: Empty (to be filled)
  - **Status**: Default "Open"
  - **Risk Level**: Calculated based on asset criticality (if linked)
  - **Created**: Timestamp
  - **Modified**: Timestamp

- Use threat templates from STRIDE Threat and Mitigation Matrix (TARA Table 2)
- Confirmation dialog before generating: "This will generate approximately X threats based on your DFD. Existing manual threats will be preserved. Continue?"
- After generation:
  - Success message: "X threats generated successfully"
  - Table populates with generated threats
  - User can edit any threat
  - Phase 3 status updates to ⚙ (in progress)

**Technical Notes:**

- Template threats stored as JSON library:
```json
{
  "P-S": {
    "threat": "Unauthorized access to process {name}",
    "attack": "Attacker spoofs identity to gain access to {name}",
    "suggestedMitigation": "Implement multi-factor authentication"
  },
  ...
}
```
- Replace {placeholders} with actual DFD element names
- Link threats to assets based on DFD element relationships
- Preserve manually added threats (don't regenerate)

**Definition of Done:**

- [Generate Threats] button works
- Correct threats generated based on STRIDE method
- Threat table populates with all required columns
- Threat descriptions use templates
- Asset links are suggested (user can modify)
- Manual threats are preserved
- Confirmation dialog appears before generation

---

### US-5.2: Add Threat Manually

**As a** user  
**I want to** manually add threats not detected automatically  
**so that** I capture system-specific or emerging threats.

**Acceptance Criteria:**

- [+ Add Threat Manually] button opens threat creation form/dialog
- Form has all columns from threat table:
  - **Threat-ID**: Auto-generated (e.g., `T-M-001` for manual threats)
  - **Element/Interaction**: Dropdown showing all DFD elements and data flows
  - **Asset-ID**: Multi-select dropdown from asset list
  - **STRIDE Type**: Dropdown (S/T/R/I/D/E)
  - **Threat/Danger**: Required textarea
  - **Possible Attack**: Textarea
  - **Threat Actor**: Dropdown (optional)
  - **Attack Vector**: Dropdown (optional)
  - **Mitigation/Countermeasure**: Textarea
  - **Test/Verification**: Textarea
  - **Status**: Dropdown (Open/In Review/Resolved/Accepted)
- Buttons: [Save Threat] [Save & Add Another] [Cancel]
- After saving:
  - Threat appears in table (highlighted as new for 5 seconds)
  - Success message: "Manual threat added successfully"
  - Form clears or closes based on button clicked
  - Unsaved indicator `*` appears

**Technical Notes:**

- Manual threat IDs: `T-M-001`, `T-M-002`, ... (M for Manual)
- Flag manual threats: `"isManual": true` in data
- Manual threats are not affected by "Regenerate Threats"
- All fields should have placeholder text for guidance

**Definition of Done:**

- Add threat form/dialog works
- All fields are present
- Validation works (threat description required)
- Threat saves and appears in table
- Multiple threats can be added sequentially (Save & Add Another)

---

### US-5.3: Edit Threat

**As a** user  
**I want to** edit existing threats  
**so that** I can refine descriptions, add mitigations, and update status.

**Acceptance Criteria:**

- Click on threat row opens threat detail dialog/panel
- All fields are editable (except Threat-ID)
- Changes save automatically after 2 seconds of inactivity (debounced)
- Or manual [Save] button to commit changes
- Close dialog with [X] or [Close] button
- Changes trigger unsaved indicator `*`
- Optional: Show change history (audit log)
  - "Modified by {user} on {date}: Changed status from Open to Resolved"

**Technical Notes:**

- Use modal dialog or slide-out panel for editing
- Auto-save with debounce (avoid excessive storage calls)
- Store modification timestamp: `"modified": "2025-12-06T14:30:00Z"`
- Optional: Version history in `"history": []` array

**Definition of Done:**

- Threat detail dialog opens on row click
- All fields can be edited
- Auto-save works (or manual save)
- Changes persist correctly
- Dialog can be closed
- Unsaved indicator appears

---

### US-5.4: Document Mitigation and Testing

**As a** user  
**I want to** define countermeasures and test methods for each threat  
**so that** risk mitigation is clear and verifiable.

**Acceptance Criteria:**

- Threat detail dialog has dedicated sections:
  
  **Mitigation/Countermeasure Section**:
  - Textarea for mitigation description
  - Suggestions from STRIDE Threat and Mitigation Matrix (TARA Table 2):
    - **Spoofing** → MFA, PKI, digital signatures, password policies
    - **Tampering** → Digital signatures, ACLs, data validation, checksums
    - **Repudiation** → Secure logging, digital signatures, timestamps, audit trails
    - **Information Disclosure** → Encryption (at-rest/in-transit), ACLs, data masking
    - **Denial of Service** → Rate limiting, quotas, load balancing, redundancy
    - **Elevation of Privilege** → ACLs, least privilege, input validation, sandboxing
  - [Use Suggestion] button to insert template mitigation
  - Multiple mitigations can be added (comma-separated or list)
  - Mitigation status: Dropdown (Planned/In Progress/Implemented/Verified)
  
  **Test/Verification Section**:
  - Textarea for test methods
  - Test method suggestions from TARA Table 3/5:
    - **Penetration Testing**: SQLMap, Burp Suite, OWASP ZAP, Metasploit
    - **Security Scanning**: Lynis, Nessus, Nmap, OpenVAS
    - **Stress Testing**: k6, JMeter, Slowloris, LOIC
    - **Certificate Validation**: SSL Labs, testssl.sh
    - **Code Review**: SAST (SonarQube, Checkmarx), DAST (OWASP ZAP)
    - **Fuzzing**: AFL, Peach, Radamsa
    - **Manual Testing**: Code review, architecture review
  - [Use Template] button for common test methods
  - Test status: Dropdown (Not Tested/Testing Planned/Testing In Progress/Passed/Failed)
  - Test results: Optional textarea (summary of test outcomes)

- Auto-save after changes
- Validation: Threat status "Resolved" requires mitigation to be "Implemented" or "Verified"

**Technical Notes:**

- Store mitigation and testing:
```json
{
  "mitigation": {
    "description": "Implement OAuth 2.0 with JWT tokens...",
    "status": "Implemented",
    "implementedDate": "2025-11-15"
  },
  "testing": {
    "methods": ["Burp Suite penetration test", "Manual code review"],
    "status": "Passed",
    "results": "No vulnerabilities found. Auth bypass attempts failed.",
    "testedDate": "2025-11-20"
  }
}
```
- Template library for common mitigations/tests
- Link to external tool documentation (optional)

**Definition of Done:**

- Mitigation section works with suggestions
- Testing section works with method templates
- Both sections auto-save
- Status dropdowns enforce validation (Resolved requires mitigation)
- Templates are helpful and accurate

---

### US-5.5: Filter and Sort Threat Table

**As a** user  
**I want to** filter and sort threats  
**so that** I can focus on specific threat types, status, or high-priority items.

**Acceptance Criteria:**

- Filter toolbar above table with controls:
  
  **Filter by STRIDE Type**:
  - Checkboxes or multi-select dropdown: ☐ S ☐ T ☐ R ☐ I ☐ D ☐ E
  - Shows count per type: S(5), T(8), R(3), I(12), D(6), E(4)
  
  **Filter by Status**:
  - Dropdown: All / Open / In Review / Resolved / Accepted
  
  **Filter by Element/Interaction**:
  - Dropdown showing all DFD elements and flows
  
  **Filter by Asset**:
  - Multi-select dropdown from asset list
  
  **Filter by Risk Level** (if implemented):
  - Slider or checkboxes: High / Medium / Low
  
  **Search Box**:
  - Searches threat description, attack, mitigation, testing fields
  - Real-time results (as user types)

- Multiple filters can be combined (AND logic)
- [Clear All Filters] button resets to default view
- Active filters displayed as removable chips/tags
- Sort by any column (click column header):
  - Default sort: Threat-ID ascending
  - Click once: Ascending
  - Click twice: Descending
  - Sort indicator (▲/▼) shows current sort

**Technical Notes:**

- Client-side filtering for performance (unless 1000+ threats)
- Use URL parameters for shareable filtered views (optional)
- Remember last filter/sort settings in session storage
- Update statistics panel based on filtered results

**Definition of Done:**

- All filter controls work correctly
- Filters can be combined
- Search finds threats in real-time
- Sort works on all columns
- Clear filters resets view
- Active filters are visible (chips/tags)
- Filter state persists within session

---

### US-5.6: Export Threat Table

**As a** user  
**I want to** export the threat table in various formats  
**so that** I can share with stakeholders, create reports, or import to other tools.

**Acceptance Criteria:**

- [Export Threats] dropdown button with format options:
  - **CSV**: All columns, comma-separated
  - **Excel**: Formatted workbook with filters and styling
  - **PDF**: Formatted report with project header and threat table
  - **Markdown**: For documentation (e.g., GitHub, Confluence)
  - **JSON**: Full threat data (for tool integration)

- Export respects current filters and sort order
- Export filename format: `{projectname}_Threats_{date}.{format}`
  - Example: `IoT-Security_Threats_2025-12-06.xlsx`

- Excel export features:
  - Frozen header row
  - Auto-fit columns
  - Filter dropdowns enabled
  - Color-coded STRIDE types and status
  - Conditional formatting for risk levels

- PDF export features:
  - Project metadata (name, version, date, STRIDE method)
  - Threat statistics summary
  - Formatted table (page breaks handled)
  - Page numbers and header/footer

- Markdown export features:
  - GitHub-flavored markdown table
  - Links to assets (if URLs provided)
  - Collapsible sections per STRIDE type (optional)

- Toast message on successful export: "Threats exported as {format}"

**Technical Notes:**

- CSV: Use PapaParse for generation
- Excel: Use SheetJS (XLSX library)
- PDF: Use jsPDF or similar
- Markdown: Custom generator
- JSON: Native JSON.stringify with formatting
- Handle large tables (pagination in PDF)

**Definition of Done:**

- All 5 export formats work correctly
- Exports respect filters and sort
- Filenames are correctly formatted
- Excel has formatting and filters
- PDF is readable and paginated
- Markdown is properly formatted
- Success message appears

---

### US-5.7: Validate Threat Model

**As a** user  
**I want to** validate the complete threat model  
**so that** I ensure all threats are properly addressed before proceeding.

**Acceptance Criteria:**

- [Validate Threat Model] button in Phase 3 toolbar
- Click triggers comprehensive validation based on TARA 2.7:
  
  **Completeness Checks**:
  - ✓ Does the DFD correspond to current implementation?
    - Check if DFD modified since threat generation → warn to regenerate
  - ✓ Every identified threat has mitigation?
    - Flag threats with empty mitigation field or status "Open" without mitigation plan
  - ✓ Are mitigations correct and understandable?
    - Heuristic: Check for vague terms like "secure it" or very short text
  - ✓ Does mitigation fit the threat?
    - Check STRIDE type vs. suggested mitigations from matrix
  - ✓ Does the attack description correctly describe the threat?
    - Flag threats with empty attack description
  - ✓ Is the context of the threat correct?
    - Check if linked assets and DFD elements still exist
  - ✓ Is the impact of the threat correct?
    - Compare threat risk level with linked asset criticality
  - ✓ Has Test/QA reviewed the model?
    - Checkbox: "Model has been reviewed by QA/Security team"
    - Optional reviewer name and date

- Validation report displayed as modal or panel:
  - **Summary**: X errors, Y warnings, Z suggestions
  - **Errors** (must fix before Phase 4):
    - Missing mitigations
    - Orphaned threats (linked elements no longer exist)
    - Inconsistent risk levels
  - **Warnings** (should fix):
    - Vague mitigations
    - Missing test methods
    - Threats without attack descriptions
  - **Suggestions** (best practices):
    - Consider additional threat actors
    - Add more detailed testing plans
    - Review high-risk threats for sufficiency
  
- Each issue is clickable → jumps to affected threat for editing
- Export validation report: [Export Report as PDF]
- Overall validation status:
  - ✓ Complete: No errors, < 3 warnings, QA reviewed
  - ⚠ Needs Review: Has warnings or not QA reviewed
  - ✗ Incomplete: Has errors
- Phase 3 status icon updates based on validation
- After passing validation: [Continue to Phase 4] button enabled
- Optional: QA approval workflow
  - Assign reviewer
  - Reviewer can approve or request changes
  - Comments/feedback per threat

**Technical Notes:**

- Cross-validate threats against DFD and assets
- Store validation results with timestamp
- Generate exportable validation report (PDF/HTML)
- QA workflow optional (can be added later)
- Validation checks should be configurable (strict/lenient mode)

**Definition of Done:**

- Validation can be triggered
- All checks run correctly (completeness, consistency, quality)
- Validation report is clear and actionable
- Issues link to affected threats
- Validation report can be exported
- Status icon updates based on results
- Navigation to Phase 4 enabled after passing
- QA checkbox works (optional reviewer tracking)

---

## Epic 6: Risk Assessment - Phase 4 Tab (Future Implementation)

### US-6.0: Phase 4 Tab - Risk Assessment Layout

**As a** user  
**I want to** assess and visualize risks from identified threats  
**so that** I can prioritize mitigation efforts.

**Acceptance Criteria:**

- Phase 4 tab displays "4 - Risk" with status icon
- Main workspace shows risk assessment interface:
  - **Left side (60%)**: Risk Matrix visualization
    - 2D heatmap: Impact (Y-axis) vs. Likelihood (X-axis)
    - Threats plotted as bubbles or points
    - Color-coded by risk level (Red/Orange/Yellow/Green)
    - Interactive: Click on threat → shows details
  - **Right side (40%)**: Threat Details panel
    - Selected threat information
    - Risk score calculation
    - Mitigation status
    - Residual risk assessment
  - **Top toolbar**:
    - Risk filters (High/Medium/Low)
    - Group by: Asset / STRIDE Type / Status
    - [Export Risk Report] button
- Empty state: "Complete Phase 3 (Threat Identification) to begin risk assessment."
- Status icon based on risk assessment completeness

**Technical Notes:**

- This epic is marked for future implementation
- Risk matrix can use charting library (Recharts, Chart.js, Plotly)
- Risk calculation: Impact × Likelihood = Risk Score
- Residual risk: Risk after mitigation implementation

**Definition of Done:**

- Phase 4 tab renders risk assessment UI
- Risk matrix visualizes threats
- Threat details panel shows selected threat
- Filters work
- Export generates risk report

---

## Epic 7: Dashboard and Navigation Enhancements

### US-7.1: General Tab - Project Dashboard

**As a** user  
**I want to** see a comprehensive project dashboard in the General tab  
**so that** I understand project progress and status at a glance.

**Acceptance Criteria:**

- General tab shows dashboard with sections:
  
  **Project Metadata** (top):
  - Name, Version, Responsible, Status
  - Created date, Last modified date
  - Tags
  
  **Progress Overview**:
  - Overall completion: Progress bar (0-100%)
  - Phase status cards:
    - Phase 1: DFD ✓/⚙/⚠/○ - X elements, Y data flows, Z trust boundaries
    - Phase 2: Assets ✓/⚙/⚠/○ - X assets (Y critical, Z high-risk)
    - Phase 3: Threats ✓/⚙/⚠/○ - X threats (Y open, Z resolved)
    - Phase 4: Risk ✓/⚙/⚠/○ - X high-risk, Y medium, Z low
  - Each card clickable → jumps to that phase tab
  
  **Quick Statistics**:
  - Total DFD elements by type
  - Total assets by category
  - Total threats by STRIDE type
  - Risk distribution
  
  **Recent Activity** (last 10 actions):
  - Timeline of changes:
    - "2025-12-06 14:30 - Added asset 'User Database'"
    - "2025-12-06 13:15 - Modified threat T-P-1-S"
    - "2025-12-05 16:45 - Completed DFD (Phase 1)"
  - Filterable by action type
  
  **Validation Status**:
  - DFD validation: ✓/⚠/✗
  - Asset validation: ✓/⚠/✗
  - Threat model validation: ✓/⚠/✗
  - Overall readiness: % complete
  
  **Quick Actions**:
  - [Export Full Report] (all phases combined)
  - [Validate All Phases]
  - [Generate Summary]

**Technical Notes:**

- Calculate statistics from project data
- Activity log stored in project: `"activityLog": []`
- Log actions: create, update, delete for all entities
- Dashboard refreshes on data changes (reactive)

**Definition of Done:**

- Dashboard displays all sections
- Statistics are accurate and update in real-time
- Phase cards link to respective tabs
- Activity timeline shows recent actions
- Quick action buttons work

---

### US-7.2: Help and Documentation System

**As a** user  
**I want to** access context-sensitive help throughout the application  
**so that** I understand how to use features and follow best practices.

**Acceptance Criteria:**

- Help icon (?) in top-right of each phase tab
- Click opens help panel (sidebar or modal) with:
  - **Purpose**: What this phase is for
  - **How to Use**: Step-by-step instructions
  - **Best Practices**: Tips from TARA document
  - **Examples**: Screenshots or sample data
  - **Common Mistakes**: What to avoid
- Global help menu (accessible from any tab):
  - STRIDE Glossary: Definitions of S/T/R/I/D/E
  - DFD Element Guide: When to use each element type
  - Asset Categories Guide: Examples per category
  - Threat Templates Library: Common threats and mitigations
  - Keyboard Shortcuts: Complete list
- Link to full TARA PDF documentation (external)
- Video tutorials (embedded or linked - optional)
- Searchable help content
- Help content stored as markdown for easy updates

**Technical Notes:**

- Help content as JSON or markdown files
- Search function using Fuse.js or similar
- Modal or slide-out panel for help display
- Glossary can be separate component (reusable)

**Definition of Done:**

- Help icon appears on all phase tabs
- Context-sensitive help content is relevant and clear
- Global help menu is accessible
- STRIDE glossary is comprehensive
- Examples are helpful
- Video tutorials work (if implemented)
- Search finds relevant help topics

---

### US-7.3: Keyboard Shortcuts

**As a** user  
**I want to** use keyboard shortcuts for common actions  
**so that** I can work more efficiently.

**Acceptance Criteria:**

- Supported keyboard shortcuts:
  - **Navigation**:
    - `Ctrl+1` / `Cmd+1`: Jump to General tab
    - `Ctrl+2` / `Cmd+2`: Jump to Phase 1 (DFD)
    - `Ctrl+3` / `Cmd+3`: Jump to Phase 2 (Assets)
    - `Ctrl+4` / `Cmd+4`: Jump to Phase 3 (Threats)
    - `Ctrl+5` / `Cmd+5`: Jump to Phase 4 (Risk)
    - `Ctrl+B` / `Cmd+B`: Toggle sidebar
  - **Actions**:
    - `Ctrl+S` / `Cmd+S`: Save project manually
    - `Ctrl+N` / `Cmd+N`: New project
    - `Ctrl+O` / `Cmd+O`: Open project (focuses sidebar)
    - `Ctrl+E` / `Cmd+E`: Export current view
    - `Ctrl+F` / `Cmd+F`: Focus search box (if available on current tab)
    - `Ctrl+Z` / `Cmd+Z`: Undo last action (optional)
    - `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo (optional)
  - **Dialog Controls**:
    - `Escape`: Close dialog/modal
    - `Enter`: Confirm/Save in dialog (if focus is not on textarea)
    - `Tab`: Navigate between form fields
  - **Table Navigation** (in threat table):
    - `↑` / `↓`: Navigate rows
    - `Enter`: Open selected row for editing
    - `Delete`: Delete selected row (with confirmation)
  - **DFD Editor** (Phase 1):
    - `Ctrl+D` / `Cmd+D`: Duplicate selected element
    - `Delete`: Delete selected element
    - `Ctrl++` / `Cmd++`: Zoom in
    - `Ctrl+-` / `Cmd+-`: Zoom out
    - `Ctrl+0` / `Cmd+0`: Reset zoom to 100%
    - `Space + Drag`: Pan canvas

- Shortcuts displayed in help menu
- Shortcut cheat sheet: `?` key opens overlay with all shortcuts
- Tooltips show keyboard shortcuts where applicable

**Technical Notes:**

- Use event listener for keyboard events (with preventDefault)
- Support both Ctrl (Windows/Linux) and Cmd (macOS)
- Ensure shortcuts don't conflict with browser defaults
- Disable shortcuts when typing in text fields (except Escape)

**Definition of Done:**

- All listed shortcuts work correctly
- Shortcuts work on Windows, macOS, Linux
- Cheat sheet (`?`) displays all shortcuts
- Tooltips show relevant shortcuts
- No conflicts with browser shortcuts
- Shortcuts disabled in text input contexts

---

## Non-Functional Requirements

### NFR-1: Performance

- Application loads within 2 seconds on modern browsers
- Project opens within 3 seconds (including DFD rendering)
- DFD editor renders 100+ elements smoothly (60 FPS)
- Threat table handles 500+ threats without lag
- Auto-save completes within 500ms (user-imperceptible)
- Sidebar collapse/expand animation is smooth (60 FPS)
- Search/filter results appear within 200ms
- Export operations complete within 5 seconds for typical projects

**Technical Notes:**

- Use React.memo, useMemo, useCallback for optimization
- Virtualize long lists (threat table, asset list)
- Lazy load phase content (code splitting)
- Debounce expensive operations (search, auto-save)
- Use Web Workers for heavy computations (optional)

---

### NFR-2: Data Persistence

- All data stored locally using `window.storage` API
- Data persists across browser sessions
- Auto-save every 30 seconds (configurable)
- Manual save button always available
- Data survives browser refresh without loss
- Export/import preserves all data integrity (no data loss)
- Unsaved changes warning before closing browser tab
- **No use of localStorage or sessionStorage** (not supported in Claude artifacts)

**Technical Notes:**

- Use React state for in-session data
- Sync to `window.storage` on changes (debounced)
- Handle storage quota exceeded errors gracefully
- Validate data integrity on load
- Backup strategy: Regular exports recommended

---

### NFR-3: Usability

- Interface follows modern UX patterns (Material Design, Fluent, or similar)
- Consistent visual design across all tabs
- Clear visual hierarchy (headings, spacing, colors)
- Responsive design for desktop (1280px to 4K monitors)
- Touch-friendly controls (for tablets)
- Clear error messages with recovery suggestions:
  - "Failed to save project. Check browser storage space. Try exporting as backup."
- Success feedback for all actions (toast notifications)
- Loading indicators for async operations
- Empty states with clear calls-to-action
- Undo/redo for critical operations (optional but recommended)
- Drag-and-drop where appropriate (file upload, DFD elements)

---

### NFR-4: Accessibility

- WCAG 2.1 AA compliance (minimum)
- Full keyboard navigation support (no mouse-only operations)
- Screen reader compatibility:
  - Semantic HTML (proper headings, labels, ARIA)
  - Alt text for icons and diagrams
  - Announcements for dynamic content changes
- Color-blind friendly color schemes:
  - Don't rely solely on color for information
  - Use icons + color for status indicators
  - High contrast ratios (4.5:1 for text, 3:1 for UI elements)
- Focus indicators visible on all interactive elements
- Skip navigation links for screen readers
- Form labels properly associated with inputs
- Error messages accessible (ARIA live regions)

**Technical Notes:**

- Use semantic HTML5 elements
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Use ARIA attributes where needed (aria-label, aria-describedby)
- Ensure color contrast with tool like axe DevTools
- Test keyboard navigation thoroughly

---

### NFR-5: Security

- No sensitive data in browser console logs
- Input validation to prevent XSS attacks:
  - Sanitize user input before rendering
  - Use React's built-in XSS protection
- Secure handling of exported files:
  - No automatic uploads to external servers
  - User controls all data exports
- Privacy: **No data sent to external servers** (100% local)
- No third-party analytics or tracking
- Content Security Policy (CSP) headers (if applicable)
- Safe JSON parsing (handle malicious imports)
- No eval() or unsafe dynamic code execution

---

### NFR-6: Browser Compatibility

- **Primary Support**:
  - Chrome/Edge (Chromium) 100+
  - Firefox 100+
  - Safari 15+
- **Secondary Support** (best effort):
  - Opera, Brave, Vivaldi
- **Not Supported**:
  - Internet Explorer (deprecated)
  - Mobile browsers (UI optimized for desktop)

**Technical Notes:**

- Use modern JavaScript (ES2020+)
- Transpile with Babel if needed
- Polyfills for missing features
- Test on all primary browsers before release

---

## Technical Architecture Notes

### Data Model

```json
{
  "project": {
    "id": "project_uuid_123",
    "name": "IoT Device Security Analysis",
    "description": "Comprehensive threat model for smart home hub",
    "version": "1.0",
    "responsible": "Security Team",
    "created": "2025-12-06T10:00:00Z",
    "lastModified": "2025-12-06T15:30:00Z",
    "currentPhase": 2,
    "strideMethod": "per-element",
    "methodSelected": true,
    "phaseStatus": {
      "0": "complete",
      "1": "complete",
      "2": "in-progress",
      "3": "not-started",
      "4": "not-started"
    },
    "settings": {
      "strictMode": false,
      "autoSave": true,
      "autoSaveInterval": 30
    },
    "tags": ["iot", "high-risk", "consumer"],
    "team": ["Alice", "Bob"],
    "status": "In Progress",
    "activityLog": [
      {
        "timestamp": "2025-12-06T15:30:00Z",
        "action": "update",
        "entity": "asset",
        "entityId": "A001",
        "description": "Modified asset criticality"
      }
    ],
    "dfd": {
      "elements": [
        {
          "id": "EE-1",
          "type": "ExternalEntity",
          "name": "Mobile App User",
          "description": "End user with smartphone app",
          "position": {"x": 100, "y": 150},
          "properties": {
            "entityType": "User",
            "trustLevel": "Untrusted"
          }
        },
        {
          "id": "P-1",
          "type": "Process",
          "name": "Authentication Service",
          "description": "Handles user login",
          "position": {"x": 300, "y": 150},
          "properties": {
            "technology": "Node.js + JWT",
            "trustLevel": "Trusted"
          }
        },
        {
          "id": "DS-1",
          "type": "DataStore",
          "name": "User Database",
          "description": "PostgreSQL user table",
          "position": {"x": 500, "y": 150},
          "properties": {
            "storeType": "Database",
            "technology": "PostgreSQL"
          }
        },
        {
          "id": "DF-1",
          "type": "DataFlow",
          "from": "EE-1",
          "to": "P-1",
          "name": "Login credentials",
          "properties": {
            "protocol": "HTTPS",
            "encrypted": true,
            "dataType": "User credentials"
          }
        },
        {
          "id": "TB-1",
          "type": "TrustBoundary",
          "name": "Internet",
          "points": [[50,50], [250,50], [250,300], [50,300]],
          "properties": {
            "zoneType": "External"
          }
        },
        {
          "id": "PI-1",
          "type": "PhysicalInterface",
          "name": "Debug UART",
          "description": "Serial debug port",
          "position": {"x": 600, "y": 300},
          "properties": {
            "interfaceType": "UART"
          }
        }
      ],
      "validation": {
        "complete": true,
        "warnings": [],
        "lastValidated": "2025-12-06T14:00:00Z"
      }
    },
    "assets": [
      {
        "id": "A001",
        "name": "User Credentials",
        "category": "Data",
        "description": "Username, password hash, session tokens",
        "linkedDfdElement": "DS-1",
        "location": "User Database (PostgreSQL)",
        "dependencies": ["A002"],
        "responsible": "Security Team",
        "criticality": {
          "overall": "High",
          "criteria": {
            "financialDamage": "Medium",
            "regulatory": "High",
            "reputation": "High",
            "privacy": "High",
            "operational": "Medium"
          }
        },
        "strideRelevance": {
          "S": true,
          "T": true,
          "R": false,
          "I": true,
          "D": false,
          "E": false
        },
        "securityGoals": [
          {
            "category": "S",
            "goal": "All authentication attempts logged with timestamp and IP; MFA required for admin access"
          },
          {
            "category": "T",
            "goal": "Password hashes use bcrypt with cost factor 12; any password change logged"
          },
          {
            "category": "I",
            "goal": "All credentials encrypted at rest using AES-256; access requires TLS 1.3+"
          }
        ]
      }
    ],
    "threats": [
      {
        "id": "P-1-S",
        "element": "P-1",
        "assetIds": ["A001"],
        "strideType": "S",
        "threat": "Unauthorized access to Authentication Service via identity spoofing",
        "attack": "Attacker uses stolen or brute-forced credentials to impersonate legitimate user",
        "threatActor": "External Attacker",
        "attackVector": "Network",
        "mitigation": {
          "description": "Implement multi-factor authentication (MFA) using TOTP; enforce strong password policy (min 12 chars, complexity); rate-limit login attempts (5 attempts per 15 min)",
          "status": "Implemented",
          "implementedDate": "2025-11-20"
        },
        "testing": {
          "methods": ["Burp Suite brute-force attempt", "Manual MFA bypass testing", "Password policy validation"],
          "status": "Passed",
          "results": "MFA cannot be bypassed. Rate limiting blocks brute-force after 5 attempts. Strong passwords enforced.",
          "testedDate": "2025-11-25"
        },
        "status": "Resolved",
        "riskLevel": "High",
        "created": "2025-12-05T10:00:00Z",
        "modified": "2025-12-06T14:00:00Z",
        "isManual": false
      },
      {
        "id": "T-M-001",
        "element": "PI-1",
        "assetIds": ["A005"],
        "strideType": "E",
        "threat": "Privilege escalation via debug UART interface",
        "attack": "Attacker with physical access connects to UART port and gains root shell access",
        "threatActor": "Insider",
        "attackVector": "Physical",
        "mitigation": {
          "description": "Disable UART in production firmware; implement secure boot; physically obscure or remove debug pins on production boards",
          "status": "Planned",
          "implementedDate": null
        },
        "testing": {
          "methods": ["Physical inspection", "Firmware analysis", "Boot sequence testing"],
          "status": "Not Tested",
          "results": null,
          "testedDate": null
        },
        "status": "Open",
        "riskLevel": "Critical",
        "created": "2025-12-06T15:00:00Z",
        "modified": "2025-12-06T15:00:00Z",
        "isManual": true
      }
    ],
    "validation": {
      "dfd": {
        "complete": true,
        "warnings": [],
        "lastValidated": "2025-12-06T14:00:00Z"
      },
      "assets": {
        "complete": true,
        "warnings": ["Asset A003 has no security goals defined"],
        "lastValidated": "2025-12-06T14:30:00Z"
      },
      "threats": {
        "complete": false,
        "errors": ["Threat T-M-001 has no mitigation"],
        "warnings": ["5 threats have status 'Open' without mitigation plan"],
        "lastValidated": "2025-12-06T15:00:00Z",
        "qaReviewed": false,
        "reviewer": null,
        "reviewedDate": null
      }
    }
  }
}
```

### Tech Stack

- **Framework**: React 18+ (already in CoReTM-2.0)
- **UI Components**: Tailwind CSS, shadcn/ui (available in Claude artifacts)
- **Icons**: lucide-react
- **Diagramming**: Extend existing CoReTM DFD editor
- **State Management**: React Context + useReducer or Zustand
- **Storage**: `window.storage` API (NOT localStorage/sessionStorage)
- **Export**: 
  - CSV: PapaParse
  - Excel: SheetJS (XLSX)
  - PDF: jsPDF or html2pdf
- **Charts**: Recharts or Chart.js (for risk matrix in Phase 4)
- **Tables**: TanStack Table (react-table v8) for threat table
- **Forms**: React Hook Form + Zod validation

### Development Phases

See updated **PhasePlan.md** for detailed phase breakdown.

**Summary**:
1. **Phase 1** (2-3 weeks): UI Layout + Project Management
2. **Phase 2** (2 weeks): DFD Editor Integration (Phase 1 Tab)
3. **Phase 3** (2-3 weeks): Asset Management (Phase 2 Tab)
4. **Phase 4** (3-4 weeks): Threat Generation & Mitigation (Phase 3 Tab)
5. **Phase 5** (2-3 weeks): Risk Assessment + Polish (Phase 4 Tab + finalization)

**Total**: ~11-15 weeks (3-4 months)

---

## Acceptance Criteria Summary

Each user story must meet its specific acceptance criteria plus:

- Code is clean, well-commented, and follows project conventions
- Unit tests for business logic (optional but recommended)
- Feature is integrated with navigation flow (tabs, sidebar, etc.)
- No console errors or warnings
- Works in Chrome 100+, Firefox 100+, Safari 15+
- Data persists correctly using `window.storage`
- Responsive design works on desktop screens (1280px+)
- Keyboard navigation supported where applicable
- WCAG 2.1 AA accessibility compliance
- Performance meets NFR-1 standards
- Feature documented in help system
- Code reviewed by peer (if team environment)

---

## References

- **TARA Document**: Chapter 2 (STRIDE methodology)
- **Base Tool**: CoReTM-2.0 (https://github.com/messi1/CoReTM-2.0)
- **OWASP**: STRIDE Reference Sheet
- **Study**: Tuma & Scandariato - "Two Architectural Threat Analysis Techniques Compared"
- **ISO 21434**: Road vehicles - Cybersecurity engineering (reference for automotive)
- **NIST SP 800-154**: Guide to Data-Centric System Threat Modeling

---

## Glossary

**DFD**: Data Flow Diagram - Visual representation of system architecture and data flows

**STRIDE**: Threat modeling methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)

**Asset**: Anything of value worth protecting (data, systems, processes, etc.)

**Threat**: Potential security issue that could compromise an asset

**Mitigation**: Countermeasure or security control to address a threat

**TARA**: Threat Analysis and Risk Assessment (bbv methodology)

**Criticality**: Measure of importance/impact if an asset is compromised

**Security Goal**: SMART objective defining what should be protected and to what level

**Validation**: Process of checking completeness and correctness of threat model

**QA**: Quality Assurance - review and approval by security/testing team
