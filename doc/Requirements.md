# Threat Modeling Tool - User Stories

## Project Information

- **Base:** CoReTM-2.0 (https://github.com/messi1/CoReTM-2.0)
- **Methodology:** STRIDE according to bbv TARA documentation (Chapter 2)
- **Goal:** Complete STRIDE workflow from DFD to threat table
- **Version:** 1.0
- **Date:** December 5, 2025

---

## Epic 1: Project Management

### US-1.1: Create New Project

**As a** user  
**I want to** create a new threat modeling project  
**so that** I can perform a structured security analysis for a system.

**Acceptance Criteria:**

- User can open dialog via "New Project" button
- Required fields: Project name, short description
- Optional fields: System version, responsible person, creation date (automatic)
- System generates unique project ID (e.g., `project_uuid`)
- After saving: Redirect to DFD editor (Step 2)
- Project is persistently stored

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
  "created": "2025-12-05",
  "lastModified": "2025-12-05",
  "strideMethod": null,
  "dfd": null,
  "assets": [],
  "threats": []
}
```

**Definition of Done:**

- Project can be created
- Required field validation works
- Project is saved and can be loaded
- Redirect to DFD editor occurs

---

### US-1.2: Open Existing Project

**As a** user  
**I want to** open a previously created project  
**so that** I can continue my threat analysis.

**Acceptance Criteria:**

- User sees list of all saved projects with name, date, status
- Projects can be sorted by name, date
- Click on project opens it
- System loads all project data (DFD, assets, threats)
- User lands on last edited step or dashboard

**Technical Notes:**

- Uses `window.storage.list('project:')`
- Lazy loading for project list with many projects
- Status display: "DFD", "Assets defined", "Threats identified"

**Definition of Done:**

- List shows all projects
- Project can be opened
- All data is loaded correctly
- Navigation to correct step works

---

### US-1.3: Delete Project

**As a** user  
**I want to** delete a project  
**so that** I can remove analyses that are no longer needed.

**Acceptance Criteria:**

- Delete button in project list
- Confirmation dialog: "Really delete project?"
- After confirmation: Project is permanently deleted
- Success message appears
- List is updated

**Technical Notes:**

- Uses `window.storage.delete('project:{project-id}')`
- All associated data (assets, threats) must be deleted

**Definition of Done:**

- Project can be deleted
- Confirmation is required
- All data is removed
- UI updates

---

### US-1.4: Export Project

**As a** user  
**I want to** export a project as JSON file  
**so that** I can back it up or share it with others.

**Acceptance Criteria:**

- Export button in project menu
- System generates complete JSON file with all data
- Download dialog with filename: `{projectname}_TARA_{date}.json`
- Exported file is readable and valid JSON

**Technical Notes:**

- Uses `Blob` and `URL.createObjectURL()` for download
- JSON should be formatted (pretty-print)

**Definition of Done:**

- Export works
- JSON is valid and complete
- Filename is correctly formatted

---

### US-1.5: Import Project

**As a** user  
**I want to** import a previously exported project  
**so that** I can continue work on other devices or after data loss.

**Acceptance Criteria:**

- Import button on start page
- File upload dialog for JSON files
- Validation of JSON structure
- On success: Project is saved and opened
- On error: Clear error message

**Technical Notes:**

- JSON schema validation recommended
- Check for duplicates (same project ID)
- On duplicate: Option "Overwrite" or "Import as copy"

**Definition of Done:**

- Import works
- Validation detects faulty files
- Imported project is fully usable

---

## Epic 2: Data Flow Diagram (DFD)

### US-2.1: Initialize DFD Editor

**As a** user  
**I want to** be automatically directed to the DFD editor after project creation  
**so that** I can start modeling immediately.

**Acceptance Criteria:**

- Empty canvas area is displayed
- Tool palette with DFD elements is visible
- Help text: "Create your data flow diagram"
- Save button is active

**Technical Notes:**

- Builds on existing CoReTM DFD editor
- Canvas should be zoomable and scrollable

**Definition of Done:**

- Editor loads
- Canvas is interactive
- Tools are available

---

### US-2.2: Add DFD Elements

**As a** user  
**I want to** add standard DFD elements via drag & drop  
**so that** I can model the system architecture.

**Acceptance Criteria:**

- Available elements according to TARA document:
  - **External Entity (EE)**: Rectangle
  - **Process (P)**: Circle
  - **Data Store (DS)**: Two parallel lines
  - **Data Flow (DF)**: Arrow with label
  - **Trust Boundary**: Dashed line
  - **Physical Interface**: Square (according to section 2.3.5)
- Drag & drop from palette to canvas
- Elements can be moved
- Elements can be deleted
- Elements receive automatic unique IDs (EE-1, P-1, DS-1, DF-1)

**Technical Notes:**

- Extension of existing CoReTM editor
- Add new symbol for "Physical Interface"
- IDs must be persistent

**Definition of Done:**

- All element types can be added
- Drag & drop works
- IDs are correctly assigned
- Elements are movable and deletable

---

### US-2.3: Label and Configure DFD Elements

**As a** user  
**I want to** provide each DFD element with name and details  
**so that** components are clearly identifiable.

**Acceptance Criteria:**

- Double-click on element opens properties dialog
- Required fields: Name/label
- Element-specific fields:
  - **EE**: Name, description, type (User/System/Device)
  - **Process**: Name, description, technology
  - **Data Store**: Name, type (Database/File/Cloud/Registry)
  - **Data Flow**: Name, protocol, encryption (Yes/No)
  - **Interface**: Name, type (USB/UART/JTAG/Ethernet/etc.)
- Label is displayed on canvas
- Changes are immediately saved

**Technical Notes:**

- Modal dialog for properties
- Auto-save after 2 seconds of inactivity

**Definition of Done:**

- Dialog opens
- All fields can be filled
- Changes are saved
- Label is updated

---

### US-2.4: Create Data Flows Between Elements

**As a** user  
**I want to** draw data flows between elements  
**so that** communication paths in the system become visible.

**Acceptance Criteria:**

- User can draw connection from element A to element B
- Arrow shows direction of data flow
- Data flow can be labeled
- Bidirectional flows: Two separate arrows recommended
- Validation: Invalid connections are prevented (e.g., EE → EE without process)

**Technical Notes:**

- Arrow library for attractive arrows
- Snap-to-grid for clean alignment
- Validation according to DFD rules (see TARA 2.3.2)

**Definition of Done:**

- Data flows can be created
- Direction is clearly visible
- Labeling works
- Validation prevents invalid connections

---

### US-2.5: Define Trust Boundaries

**As a** user  
**I want to** draw trust boundaries in the DFD  
**so that** security zones are visually delimited.

**Acceptance Criteria:**

- Dashed line can be drawn
- Line encloses areas
- Labeling possible (e.g., "Intranet", "DMZ", "Internet")
- Different colors for different zones

**Technical Notes:**

- Freehand drawing or polygon tool
- Layering: Trust boundaries in background

**Definition of Done:**

- Trust boundaries can be drawn
- Labeling works
- Visual delimitation is clear

---

### US-2.6: Save and Validate DFD

**As a** user  
**I want to** save the DFD and check for completeness  
**so that** I can be sure all necessary elements are present.

**Acceptance Criteria:**

- Save button saves DFD in project
- Validation checks:
  - All elements have names
  - All data flows are connected
  - No isolated elements (unless intentional)
- Warnings for missing information
- After successful save: Continue to step 3 (select STRIDE method)

**Technical Notes:**

- Save DFD as JSON structure
- Validation rules configurable

**Definition of Done:**

- DFD is saved
- Validation works
- Warnings are displayed
- Navigation to step 3 possible

---

## Epic 3: STRIDE Method Selection

### US-3.1: Select STRIDE Method

**As a** user  
**I want to** choose between STRIDE-per-element and STRIDE-per-interaction  
**so that** I can use the analysis method appropriate for my system.

**Acceptance Criteria:**

- Selection page after DFD editor
- Two options:
  1.  **STRIDE-per-element**: "Detailed analysis of each component"
  2.  **STRIDE-per-interaction**: "Focus on interactions between components"
- Help text explains differences (according to TARA 2.6.2 vs 2.6.3):
  - Per-element: Better for closed systems, higher effort, analyzes each DFD element individually
  - Per-interaction: Better for networked systems, focuses on communication, analyzes data flows between components
- Comparison table from study (Tuma & Scandariato) showing per-element has better coverage
- After selection: Continue to asset definition (Step 4)

**Technical Notes:**

- Selection is saved in project
- Can be changed later (with warning)
- Influences threat generation in later steps

**Definition of Done:**

- Both methods can be selected
- Help text is understandable
- Selection is saved
- Navigation works

---

## Epic 4: Asset Identification and Security Goals

### US-4.1: Create Asset

**As a** user  
**I want to** create a new asset with all relevant information  
**so that** I build a complete asset list.

**Acceptance Criteria:**

- Form with fields according to TARA 2.4.1:
  - **Asset-ID**: Automatically generated (e.g., A001)
  - **Asset Name**: Required field
  - **Category**: Dropdown (Data/System/Infrastructure/Process/Human)
  - **Description**: Free text
  - **Storage Location**: Optional
  - **Dependencies**: Multi-select from other assets
  - **Responsibility**: Free text
- Saving adds asset to list
- Asset can be edited later

**Technical Notes:**

- Asset structure:

json

      {
        "id": "A001",
        "name": "Production Calibration Data",
        "category": "Data",
        "description": "Critical parameters for production control",
        "location": "Database Server 1",
        "dependencies": ["A002", "A010"],
        "responsible": "Production Team",
        "criticality": null,
        "strideRelevance": {},
        "securityGoals": []
      }

**Definition of Done:**

- Asset can be created
- All fields work
- Asset is saved
- Asset appears in list

---

### US-4.2: Display Asset Categories

**As a** user  
**I want to** see a structured overview of asset categories  
**so that** I can systematically capture all assets worth protecting.

**Acceptance Criteria:**

- Page shows 5 asset categories according to TARA 2.4.1:
  1.  **Data Assets**: Business-critical data, personal data, configuration data, authentication data
  2.  **System Assets**: Control components, communication interfaces, processing logic, security components
  3.  **Infrastructure Assets**: Hardware, network infrastructure, storage systems, backup systems
  4.  **Process Assets**: Production processes, maintenance/update processes, operational documentation
  5.  **Human Assets**: Operators, technicians/maintenance personnel, analysts/supervisors
- Each category is expandable with examples
- "Add Asset" button per category

**Technical Notes:**

- Accordion UI for categories
- Examples as tooltips or help text
- Template assets for quick adding

**Definition of Done:**

- All 5 categories are displayed
- Examples are visible
- UI is clear

---

### US-4.3: Assess Asset Criticality

**As a** user  
**I want to** evaluate each asset according to impact criteria  
**so that** I can set priorities for security measures.

**Acceptance Criteria:**

- Assessment dialog for each asset
- Selection of 4-6 relevant criteria from TARA 2.4.2:
  - **Business Criteria**: Financial Damage, Regulatory/Compliance, Reputation, Privacy Violation, Operational Impact, Affected Users/Systems, Recoverability
  - **Physical Criteria**: Safety Impact, Physical Asset Damage, Environmental Impact, Supply Chain/Logistics
- 4-level assessment per criterion:
  - **Critical**: Existential threat
  - **High**: Severe disruptions
  - **Medium**: Noticeable impairments
  - **Low**: Minimal impact
- System calculates overall criticality according to "Highest Impact" principle
- Criticality is color-coded (Red/Orange/Yellow/Green)

**Technical Notes:**

- Matrix UI for assessment
- Tooltip with description per level
- Automatic calculation of overall criticality

**Definition of Done:**

- Assessment dialog works
- All criteria can be assessed
- Overall criticality is calculated correctly
- Color coding is visible

---

### US-4.4: Determine STRIDE Relevance per Asset

**As a** user  
**I want to** define which STRIDE categories are relevant for each asset  
**so that** threat analysis is focused.

**Acceptance Criteria:**

- Checkbox list of 6 STRIDE categories:
  - **S**poofing (Authentication)
  - **T**ampering (Integrity)
  - **R**epudiation (Non-Repudiation)
  - **I**nformation Disclosure (Confidentiality)
  - **D**enial of Service (Availability)
  - **E**levation of Privilege (Authorization)
- Brief explanation per category as tooltip
- Recommendations based on asset category (e.g., Data Assets → T, I, D relevant)
- Multiple selection possible
- Selection is saved

**Technical Notes:**

- Mapping according to TARA Table 2 (DFD element → STRIDE)
- Suggestions can be overridden

**Definition of Done:**

- STRIDE categories can be selected
- Recommendations are displayed
- Selection is saved

---

### US-4.5: Define Security Goals

**As a** user  
**I want to** formulate specific, measurable security goals for each asset  
**so that** it is clear what should be protected.

**Acceptance Criteria:**

- For each selected STRIDE category: Text field for security goal
- Help text with SMART criteria (TARA 2.4.3):
  - Specific, Measurable, Achievable, Relevant, Time-bound
- Examples per STRIDE category (from TARA 2.4.3):
  - **Authentication**: "All administrative accesses to control components require multi-level identity verification; sessions are automatically terminated after 30 minutes of inactivity."
  - **Integrity**: "All configuration data must be protected so that any manipulation is immediately detected and deviations are reported within 30 seconds."
  - **Non-Repudiation**: "All changes to production parameters are logged so that time, actor, and type of change are clearly provable."
  - **Confidentiality**: "All data transmissions with personal or business-critical information must be protected so that no unauthorized person has access."
  - **Availability**: "Production-critical systems must be 99.5% available during operating hours; recovery from failures occurs within 15 minutes."
  - **Authorization**: "Firmware updates may only be performed with explicit authorization; privilege escalations are automatically revoked after 4 hours."
- Multiple goals per category possible
- Goals can be saved as templates

**Technical Notes:**

- Rich text editor for formatting
- Template library for common goals
- Auto-suggest based on asset type

**Definition of Done:**

- Security goals can be entered
- Examples are displayed
- Templates work
- Goals are saved

---

### US-4.6: Display Asset-Security Mapping

**As a** user  
**I want to** see an overview table of all assets with their assessments and goals  
**so that** I can check completeness.

**Acceptance Criteria:**

- Table with columns according to TARA 2.4.4:
  - Asset-ID
  - Asset Name
  - Category
  - Criticality (color-coded)
  - STRIDE Relevance (letters: S, T, R, I, D, E)
  - Specific Security Goals (summary)
- Filtering by category and criticality
- Sorting by all columns
- Export as CSV/Excel
- Click on asset opens detail view for editing

**Technical Notes:**

- Responsive table component
- Pagination with many assets
- Export function

**Definition of Done:**

- Table shows all assets
- Filtering and sorting work
- Export works
- Detail view is accessible

---

### US-4.7: Perform Asset Validation

**As a** user  
**I want to** have the asset list checked for completeness  
**so that** no critical assets are overlooked.

**Acceptance Criteria:**

- Validation button starts check
- Control questions from TARA 2.4.6 are checked:
  - ✓ Were all components from DFD captured as assets?
  - ✓ Are all data flows considered?
  - ✓ Were external dependencies included?
  - ✓ Are technical and organizational assets present?
  - ✓ Do assets cover all 6 STRIDE categories?
  - ✓ Are criticality assessments consistent?
  - ✓ Are security goals SMART formulated?
- Warnings and recommendations are displayed
- After successful validation: Continue to step 5 (threat table)

**Technical Notes:**

- Cross-check between DFD elements and assets
- Heuristics for consistency check
- Report with improvement suggestions

**Definition of Done:**

- Validation can be started
- Checks are performed
- Results are understandable
- Navigation to step 5 possible

---

## Epic 5: Threat Identification and Table Creation

### US-5.1: Initialize Threat Table

**As a** user  
**I want to** generate a threat table based on the selected STRIDE method  
**so that** I can systematically document all threats.

**Acceptance Criteria:**

- System generates initial threats based on:
  - Selected STRIDE method (per-element vs per-interaction)
  - DFD elements
  - Assets and their STRIDE relevance
- Table contains columns according to TARA Table 6:
  - **Threat-ID**: Unique ID (e.g., T-S-001, WS-1-S-1)
  - **Element/Interaction**: Reference to DFD element or data flow
  - **Asset-ID**: Link to affected assets
  - **STRIDE Type**: S/T/R/I/D/E
  - **Threat/Danger**: Description of threat
  - **Possible Attack**: Concrete attack scenarios
  - **Threat Actor**: Optional (Insider/External/Nation-State/etc.)
  - **Attack Vector**: Optional (API/Network/Social Engineering/etc.)
  - **Mitigation/Countermeasure**: Protection measures
  - **Test/Verification**: How effectiveness is tested
  - **Status**: Open/In Review/Resolved
- Initial threats are suggestions, can be edited

**Technical Notes:**

- **STRIDE-per-element**: Threats based on TARA Table 2 (element type → STRIDE)
  - Example: Process P-1 → 6 threats (S, T, R, I, D, E)
  - External Entity (EE) → S, R
  - Data Flow (DF) → T, I, D
  - Data Store (DS) → T, R, I, D
- **STRIDE-per-interaction**: Threats based on data flows
  - Example: DF-1 (User → Webserver) → Threats for S, T, I, D
- Uses STRIDE Threat and Mitigation Matrix (TARA Table 2)
- Template threats from OWASP STRIDE Reference Sheet

**Definition of Done:**

- Table is generated
- All columns are present
- Initial threats are plausible
- Table is editable

---

### US-5.2: Add Threat Manually

**As a** user  
**I want to** manually add additional threats  
**so that** I can capture specific threats that were not automatically detected.

**Acceptance Criteria:**

- "Add Threat" button above table
- Form with all columns (see US-5.1)
- Threat-ID is automatically assigned
- Required fields: Element/Interaction, STRIDE type, threat
- After saving: Threat appears in table

**Technical Notes:**

- Dropdown for DFD elements and data flows
- Dropdown for assets (multi-select)
- Dropdown for STRIDE type
- Auto-complete for common threats

**Definition of Done:**

- Threat can be added
- Form validates inputs
- Threat appears in table

---

### US-5.3: Edit Threat

**As a** user  
**I want to** edit existing threats  
**so that** I can refine descriptions and add countermeasures.

**Acceptance Criteria:**

- Click on threat row opens edit dialog
- All fields can be changed
- Changes are immediately saved
- Change history is logged (optional)

**Technical Notes:**

- Modal dialog or inline editing
- Auto-save after 2 seconds
- Versioning for audit trail

**Definition of Done:**

- Threats can be edited
- Changes are saved
- UI is responsive

---

### US-5.4: Document Mitigation and Testing

**As a** user  
**I want to** define countermeasures and test methods for each threat  
**so that** it is clear how risks are mitigated and verified.

**Acceptance Criteria:**

- "Mitigation" and "Test/Verification" fields per threat
- Suggestions from STRIDE Threat and Mitigation Matrix (TARA Table 2):
  - **Spoofing** → Multi-factor authentication, PKI, digital signatures
  - **Tampering** → Digital signatures, ACLs, data validation
  - **Repudiation** → Secure logging, digital signatures, timestamps
  - **Information Disclosure** → Encryption (at-rest/in-transit), ACLs
  - **Denial of Service** → Rate limiting, quotas, load balancing
  - **Elevation of Privilege** → ACLs, least privilege, input validation
- Free text for custom mitigations
- Multiple mitigations per threat possible
- Test methods referenced from examples (TARA Table 3/5):
  - Penetration tests (SQLMap, Burp Suite, OWASP ZAP)
  - Security scans (Lynis, Nessus)
  - Stress tests (k6, JMeter, Slowloris)
  - Certificate validation (SSL Labs)
  - Code review, SAST/DAST

**Technical Notes:**

- Template library for common mitigations
- Link to external testing tools documentation
- Status tracking for implementation

**Definition of Done:**

- Mitigation can be documented
- Test methods can be specified
- Suggestions are helpful
- Custom entries work

---

### US-5.5: Filter and Sort Threat Table

**As a** user  
**I want to** filter and sort the threat table  
**so that** I can focus on specific threat types or elements.

**Acceptance Criteria:**

- Filter by:
  - STRIDE type (S/T/R/I/D/E)
  - Status (Open/In Review/Resolved)
  - DFD element
  - Asset
  - Criticality (if linked to asset criticality)
- Sort by all columns
- Search function for threat descriptions
- Filters are combinable

**Technical Notes:**

- Client-side filtering for performance
- URL parameters for shareable filtered views
- Remember last filter settings

**Definition of Done:**

- Filtering works
- Sorting works
- Search finds threats
- Filters are combinable

---

### US-5.6: Export Threat Table

**As a** user  
**I want to** export the threat table  
**so that** I can share it with stakeholders or use it in reports.

**Acceptance Criteria:**

- Export button above table
- Export formats:
  - **CSV**: All columns, importable to Excel
  - **Excel**: Formatted table with filters
  - **PDF**: Formatted report with project info
  - **Markdown**: For documentation
- Filename: `{projectname}_Threats_{date}.{format}`
- Export respects current filters

**Technical Notes:**

- Uses libraries: PapaParse (CSV), SheetJS (Excel)
- PDF generation with project header
- Markdown export for integration into documentation

**Definition of Done:**

- All formats can be exported
- Exports are correctly formatted
- Filenames are correct
- Filtered exports work

---

### US-5.7: Validate Threat Model

**As a** user  
**I want to** validate the complete threat model  
**so that** I ensure completeness and correctness before proceeding to risk assessment.

**Acceptance Criteria:**

- Validation button starts comprehensive check
- Control questions from TARA 2.7 are checked:
  - ✓ Does the diagram correspond to current implementation?
  - ✓ Is every identified threat mitigated?
  - ✓ Are mitigations correct and understandable?
  - ✓ Does mitigation fit the threat?
  - ✓ Does the attack description correctly describe the threat?
  - ✓ Is the context of the threat correct?
  - ✓ Is the impact of the threat correct?
  - ✓ Has Test/QA reviewed the model?
- Validation report with:
  - Threats without mitigation
  - Threats without test methods
  - DFD elements without threats
  - Assets not covered by threats
  - Inconsistencies between DFD and threats
- Warnings and recommendations
- Optional: Approval workflow for QA review

**Technical Notes:**

- Cross-checks between DFD, assets, and threats
- Completeness heuristics
- Exportable validation report
- Status field for "QA Reviewed" checkbox

**Definition of Done:**

- Validation can be started
- All checks are performed
- Report is comprehensive and actionable
- Validation results are persistent

---

## Epic 6: Dashboard and Navigation

### US-6.1: Project Dashboard

**As a** user  
**I want to** see an overview dashboard for my project  
**so that** I can quickly understand progress and status.

**Acceptance Criteria:**

- Dashboard shows:
  - Project metadata (name, version, responsible, dates)
  - Progress indicators for each workflow step:
    - ✓ DFD created (X elements, Y data flows)
    - ✓ STRIDE method selected
    - ✓ Assets defined (X assets, Y critical)
    - ✓ Threats identified (X threats, Y open, Z mitigated)
    - Validation status
  - Quick links to each step
  - Recent activity log
- Visual progress bar (e.g., 3/5 steps completed)
- Warnings for incomplete steps

**Technical Notes:**

- Calculate statistics from stored data
- Dashboard is landing page when opening project
- Refresh on data changes

**Definition of Done:**

- Dashboard displays all information
- Progress calculation is correct
- Quick links work
- Activity log is updated

---

### US-6.2: Step-by-Step Navigation

**As a** user  
**I want to** navigate through the workflow steps in sequence  
**so that** I follow the structured STRIDE process.

**Acceptance Criteria:**

- Navigation sidebar or stepper component shows:
  1.  Project Setup
  2.  DFD Editor
  3.  STRIDE Method Selection
  4.  Asset Identification
  5.  Threat Table
  6.  (Future: Risk Assessment)
- Current step is highlighted
- Completed steps are marked with checkmark
- User can jump to any completed step
- User cannot skip ahead to incomplete steps (optional: with warning)
- "Next" and "Previous" buttons at bottom of each step

**Technical Notes:**

- Store current step in project data
- Validation before allowing navigation to next step
- Breadcrumb navigation for context

**Definition of Done:**

- Navigation is visible on all screens
- Current step is clear
- Navigation works correctly
- Validation prevents skipping

---

### US-6.3: Help and Documentation

**As a** user  
**I want to** access context-sensitive help  
**so that** I understand how to use each feature.

**Acceptance Criteria:**

- Help icon (?) on each page
- Context-sensitive help text explaining:
  - Purpose of current step
  - How to use features
  - Best practices from TARA document
  - Examples
- Link to full TARA PDF documentation
- Glossary of STRIDE terms
- Video tutorials (optional)

**Technical Notes:**

- Modal or sidebar for help content
- Help content stored as markdown
- Search function in help

**Definition of Done:**

- Help is accessible on all pages
- Content is relevant and clear
- Examples are helpful
- Documentation link works

---

## Non-Functional Requirements

### NFR-1: Performance

- Tool should load projects within 2 seconds
- DFD editor should render 100+ elements smoothly
- Threat table should handle 500+ threats without lag
- Auto-save should not disrupt user workflow

### NFR-2: Data Persistence

- All data must be stored locally using `window.storage`
- Data must survive browser refresh
- Export/import must preserve all data integrity
- No data loss on application errors

### NFR-3: Usability

- Interface follows modern UX patterns
- Responsive design for desktop (laptop/desktop screens)
- Clear error messages with recovery suggestions
- Undo/redo for critical operations (optional)

### NFR-4: Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color-blind friendly color schemes

### NFR-5: Security

- No sensitive data in browser console logs
- Input validation to prevent injection attacks
- Secure handling of exported files
- Privacy: No data sent to external servers

---

## Technical Architecture Notes

### Data Model

```json

    {
      "project": {
        "id": "string",
        "name": "string",
        "description": "string",
        "version": "string",
        "responsible": "string",
        "created": "date",
        "lastModified": "date",
        "currentStep": "number",
        "strideMethod": "per-element | per-interaction",
        "dfd": {
          "elements": [
            {
              "id": "string",
              "type": "EE | P | DS | DF | TB | Interface",
              "name": "string",
              "description": "string",
              "position": {"x": "number", "y": "number"},
              "properties": {}
            }
          ],
          "connections": [
            {
              "from": "string",
              "to": "string",
              "label": "string"
            }
          ]
        },
        "assets": [
          {
            "id": "string",
            "name": "string",
            "category": "string",
            "description": "string",
            "location": "string",
            "dependencies": ["string"],
            "responsible": "string",
            "criticality": {
              "overall": "Critical | High | Medium | Low",
              "criteria": {
                "financialDamage": "Critical | High | Medium | Low",
                "regulatory": "Critical | High | Medium | Low",
                ...
              }
            },
            "strideRelevance": {
              "S": "boolean",
              "T": "boolean",
              "R": "boolean",
              "I": "boolean",
              "D": "boolean",
              "E": "boolean"
            },
            "securityGoals": [
              {
                "category": "S | T | R | I | D | E",
                "goal": "string"
              }
            ]
          }
        ],
        "threats": [
          {
            "id": "string",
            "element": "string",
            "assetIds": ["string"],
            "strideType": "S | T | R | I | D | E",
            "threat": "string",
            "attack": "string",
            "threatActor": "string",
            "attackVector": "string",
            "mitigation": "string",
            "testing": "string",
            "status": "Open | In Review | Resolved",
            "created": "date",
            "modified": "date

          }
        ]
    }
}
```

### Tech Stack Recommendations

- **Framework**: React (already in CoReTM-2.0)
- **UI Components**: Tailwind CSS, shadcn/ui (available in artifact environment)
- **Diagramming**: Extend CoReTM's existing DFD editor
- **Storage**: `window.storage` API
- **Export**: PapaParse (CSV), SheetJS (Excel)
- **Icons**: lucide-react

### Development Phases

1. **Phase 1**: Project management + DFD editor enhancement (Epics 1-2)
2. **Phase 2**: STRIDE method selection + Asset management (Epics 3-4)
3. **Phase 3**: Threat table generation and editing (Epic 5)
4. **Phase 4**: Dashboard, navigation, help (Epic 6)
5. **Phase 5**: Risk assessment (future)

---

## Acceptance Criteria Summary

Each user story must meet its specific acceptance criteria plus:

- Code is reviewed and tested
- Documentation is updated
- No console errors
- Works in Chrome, Firefox, Safari
- Data persists across browser sessions
- Feature is integrated with navigation flow

---

## References

- **TARA Document**: Chapter 2 (STRIDE methodology)
- **Base Tool**: CoReTM-2.0 (https://github.com/messi1/CoReTM-2.0)
- **OWASP**: STRIDE Reference Sheet
- **Study**: Tuma & Scandariato - "Two Architectural Threat Analysis Techniques Compared"
