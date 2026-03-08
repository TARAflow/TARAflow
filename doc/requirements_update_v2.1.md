# Threat Modeling Tool - Requirements Update

## Change History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-12-06 | Initial version |
| 2.1 | 2025-12-12 | DFD validation, Phase status, i18n, UI improvements |

---

## Implemented Features (Version 2.1)

The following features have been implemented since version 2.0 and should be reflected in the use cases:

---

## US-1.3 Additions: General Tab - Project Information

### New Acceptance Criteria (IMPLEMENTED):

**Required Field Validation for Phase 0:**
- **Name**: Required, minimum 3 characters
- **Description**: Required, with Collapse/Expand functionality for long texts
- **Version**: Required
- **Responsible**: Required  
- **Tags**: At least 1 tag required

**Automatic Phase Status Update:**
- Phase 0 status is calculated automatically:
  - `not-started`: No fields filled
  - `in-progress`: At least one field filled
  - `complete`: All required fields filled + at least 1 tag

**UI Improvements:**
- Required fields marked with red `*`
- Missing fields highlighted in yellow during edit mode
- Status badge next to title shows "✓ Complete" or "⚠ X Warnings"
- Collapse/Expand for Description (automatic when >100 characters or >2 newlines)
- Labels are bold formatted for better readability
- Newlines in Description are displayed correctly (`whitespace-pre-wrap`)

**ProjectProgress Component:**
- Shows validation status for each phase
- Colored borders based on status (red=errors, yellow=warnings, green=complete)
- Detailed error/warning counts per phase

### Technical Implementation:

```typescript
// Phase 0 Validation
function validateGeneralPhase(project: Project): PhaseStatus {
  const hasName = project.name?.trim().length >= 3;
  const hasDescription = project.description?.trim().length > 0;
  const hasVersion = project.version?.trim().length > 0;
  const hasResponsible = project.responsible?.trim().length > 0;
  const hasTags = project.tags?.length > 0;

  if (hasName && hasDescription && hasVersion && hasResponsible && hasTags) {
    return 'complete';
  }
  if (hasName || hasDescription || hasVersion || hasResponsible || hasTags) {
    return 'in-progress';
  }
  return 'not-started';
}
```

---

## US-2.5 Additions: DFD Validation System

### New Acceptance Criteria (IMPLEMENTED):

**Two-Scenario Validation:**

The system automatically detects which scenario applies based on the presence of External Entities:

#### Scenario A: Classic Threat Model (with External Entity)
- ≥ 1 Trust Boundary required
- ≥ 1 Process/Multiprocess/DataStore required
- ≥ 1 Element must be inside a Trust Boundary
- External Entities should be outside Trust Boundaries (Warning if inside)
- ≥ 1 Dataflow between internal element and External Entity required

#### Scenario B: Internal Threat Model (without External Entity)
- ≥ 2 Trust Boundaries required
- Each Trust Boundary must contain at least 1 Process/Multiprocess/DataStore
- ≥ 1 Dataflow must cross a Trust Boundary

**Error vs Warning Classification:**

| Type | Message Key | Description |
|------|-------------|-------------|
| **ERROR** | `noElements` | DFD contains no elements |
| **ERROR** | `noTrustBoundary` | No Trust Boundary present |
| **ERROR** | `needTwoTrustBoundaries` | Scenario B: less than 2 TBs |
| **ERROR** | `noProcessOrDatastore` | No Process/DataStore |
| **ERROR** | `noElementInsideTrustBoundary` | No element inside TB |
| **ERROR** | `emptyTrustBoundary` | TB contains no elements |
| **ERROR** | `noInternalExternalFlow` | No dataflow internal ↔ external |
| **ERROR** | `noCrossBoundaryFlow` | No dataflow crosses TB |
| **WARNING** | `unconnectedElement` | Element without dataflow connection |
| **WARNING** | `unconnectedDataflow` | Dataflow not connected |
| **WARNING** | `elementOutsideAllTrustBoundaries` | Element outside all TBs |
| **WARNING** | `externalEntityInsideTrustBoundary` | External Entity inside TB |

**Phase Status based on Validation:**
- `complete`: No errors, no warnings
- `in-progress`: No errors, but warnings present
- `incomplete`: Errors present

### Technical Implementation:

**New Files:**
- `DFDValidator.ts` - Validation logic with i18n keys
- `DFDValidationPanel.tsx` - UI component for errors/warnings
- `DFDParser.ts` - XML parsing with Multiprocess support
- `DFDService.ts` - Orchestrates Parser and Validator

**Validation Architecture:**
```typescript
interface ValidationResult {
  isValid: boolean;      // No blocking errors
  isComplete: boolean;   // No errors AND no warnings
  errors: string[];      // i18n keys for errors
  warnings: string[];    // i18n keys for warnings
  scenario: 'A' | 'B' | null;
}
```

---

## US-2.1 Additions: DFD Element Types

### New Acceptance Criteria (IMPLEMENTED):

**Multiprocess Element:**
- New element type "Multiprocess" (MP) added
- Represents multiple instances of a process
- Treated like Process in validation
- Icon: ◎

**Complete Element List:**
| Element | Prefix | Icon | Description |
|---------|--------|------|-------------|
| External Entity | EE | □ | External actors/systems |
| Process | P | ○ | Single process |
| **Multiprocess** | **MP** | **◎** | **Multiple process instances** |
| DataStore | DS | ═ | Data storage |
| DataFlow | DF | → | Data flow |
| Trust Boundary | TB | ┄ | Security boundary |
| Physical Interface | PI | ▣ | Physical interface |

---

## New User Story: US-2.7 - DFD Validation Panel

**As a** user  
**I want to** see validation errors and warnings in a dedicated panel below the DFD editor  
**so that** I can quickly identify and fix issues in my diagram.

**Acceptance Criteria:**

- Validation panel appears below the DFD canvas
- Panel shows errors (red) and warnings (yellow) separately
- Each message is translated to the user's language (DE/EN)
- Messages include element names for easy identification
- Panel is scrollable with max-height of 120px
- Panel is hidden when no errors or warnings exist
- Panel updates automatically when DFD changes

**Technical Notes:**
- Uses `DFDValidationPanel.tsx` component
- Messages use i18n keys with parameter support
- Format: `key:type:name` parsed by `translateValidationMessage()`

---

## New User Story: US-2.8 - Automatic Element Numbering (PLANNED)

**As a** user  
**I want to** have my DFD elements automatically numbered based on their position  
**so that** I have consistent, readable element IDs.

**Acceptance Criteria:**

- Elements receive prefixed IDs: EE-1, P-1, MP-1, DS-1, DF-1, TB-1
- Numbering is based on position (top-left to bottom-right)
- Algorithm: `score = y * 1000 + x` (prioritizes rows over columns)
- Numbering can be triggered:
  - Automatically on save
  - Manually via "Renumber Elements" button
- Labels are displayed on canvas as transparent rectangles with centered text

**Element Prefixes:**
| Element | Prefix |
|---------|--------|
| External Entity | EE |
| Process | P |
| Multiprocess | MP |
| DataStore | DS |
| DataFlow | DF |
| Trust Boundary | TB |
| Physical Interface | PI |

**Technical Notes:**
- Script parses XML, groups by type, sorts by position, updates labels
- Preserves existing element references in connections

---

## Internationalization (i18n) - New Section

### US-NEW: Multi-Language Support

**As a** user  
**I want to** use the application in German or English  
**so that** I can work in my preferred language.

**Acceptance Criteria (IMPLEMENTED):**

- Language switcher in header (dropdown)
- Supported languages: German (de), English (en)
- All UI labels are translated
- Validation messages are translated with parameter support
- Element type names are translated (e.g., "Process" → "Prozess")
- Language preference is persisted

**Translation Files:**
- `de.json` - German translations
- `en.json` - English translations

**Validation Message Format:**
```typescript
// Simple message
"dfdValidation.noElements" → "The DFD contains no elements"

// Message with name parameter
"dfdValidation.emptyTrustBoundary:{{name}}" → "Trust boundary \"TB1\" contains no process"

// Message with type and name
"dfdValidation.unconnectedElement:{{type}}:{{name}}" → "Process \"Auth\" has no connections"
```

**Translation Helper:**
```typescript
function translateValidationMessage(key: string, t: TFunction): string {
  const parts = key.split(':');
  const messageKey = parts[0];
  
  if (parts.length === 1) return t(messageKey);
  if (parts.length === 2) return t(messageKey, { name: parts[1] });
  if (parts.length === 3) {
    const type = t(`dfdValidation.elementTypes.${parts[1]}`);
    return t(messageKey, { type, name: parts[2] });
  }
  return key;
}
```

---

## Phase Tab Status Integration - New Section

### US-NEW: Phase Tab Validation Indicators

**As a** user  
**I want to** see validation status directly in the phase tabs  
**so that** I can quickly identify which phases need attention.

**Acceptance Criteria (IMPLEMENTED):**

- Phase tabs show error/warning badges
- Red badge with count for errors
- Yellow badge with count for warnings (only if no errors)
- Tooltip shows details on hover
- Badge updates automatically when validation changes

**PhaseTab Component Props:**
```typescript
interface PhaseTabProps {
  phaseId: number;
  label: string;
  status: PhaseStatus;
  isActive: boolean;
  onClick: () => void;
  errorCount?: number;    // NEW
  warningCount?: number;  // NEW
}
```

---

## Updated Data Structures

### Project Interface Updates

```typescript
interface Project {
  // ... existing fields ...
  
  // Phase status now auto-updates based on validation
  phaseStatus: {
    0: PhaseStatus; // General - based on required fields
    1: PhaseStatus; // DFD - based on DFDValidator
    2: PhaseStatus; // Assets
    3: PhaseStatus; // Threats
    4: PhaseStatus; // Risk
  };
  
  // DFD now includes validation results
  dfd: {
    xml: string;
    elements: DFDElement[];
    connections: DFDConnection[];
    stats: DFDStats;
    validation: DFDValidation;  // NEW
    lastModified: string;
  } | null;
}
```

### DFDValidation Interface (NEW)

```typescript
interface DFDValidation {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];      // i18n keys
  warnings: string[];    // i18n keys
  scenario: 'A' | 'B' | null;
  lastValidated: string;
}
```

### DFDStats Interface Updates

```typescript
interface DFDStats {
  totalElements: number;
  externalEntities: number;
  processes: number;
  multiprocesses: number;  // NEW
  dataStores: number;
  dataFlows: number;
  trustBoundaries: number;
  physicalInterfaces: number;
}
```

---

## Component Architecture (Updated)

```
src/
├── components/
│   ├── Phases/
│   │   ├── General/
│   │   │   ├── GeneralTab.tsx
│   │   │   ├── ProjectInfo.tsx      # Updated with validation
│   │   │   ├── ProjectProgress.tsx  # Updated with validation display
│   │   │   ├── ProjectSettings.tsx
│   │   │   └── ActivityLog.tsx
│   │   ├── DFD/
│   │   │   ├── DFDTab.tsx
│   │   │   ├── DFDValidationPanel.tsx  # NEW
│   │   │   └── DFDPreviewDialog.tsx
│   │   └── PhaseTabs.tsx            # Updated with error/warning counts
│   └── UI/
│       ├── PhaseTab.tsx             # Updated with badges
│       └── LanguageSwitcher.tsx
├── services/
│   └── DFDService.ts                # NEW - orchestrates DFD operations
├── DrawIO/
│   ├── DFDParser.ts                 # Updated with Multiprocess
│   ├── DFDValidator.ts              # NEW - validation logic
│   └── DFDStorageAdapter.ts
├── types/
│   ├── ProjectTypes.ts
│   └── DFDTypes.ts                  # Updated with new types
├── hooks/
│   └── useDFDEditor.ts
├── utils/
│   └── PhaseConfig.ts
└── i18n/
    ├── de.json                      # Updated with validation messages
    └── en.json                      # Updated with validation messages
```

---

## Definition of Done (Updated)

Each user story must meet its specific acceptance criteria plus:

- [ ] Code is clean, well-commented, and follows project conventions
- [ ] All UI text uses i18n keys (no hardcoded strings)
- [ ] German and English translations provided
- [ ] Validation messages use the `key:param` format
- [ ] Phase status updates automatically based on validation
- [ ] Error/warning counts display in phase tabs
- [ ] Feature works in Chrome 100+, Firefox 100+, Safari 15+
- [ ] Data persists correctly using localStorage with project-specific keys
- [ ] Keyboard navigation supported where applicable

---

## Summary of Changes

### Files Created/Modified:

| File | Status | Description |
|------|--------|-------------|
| `DFDValidator.ts` | NEW | Two-scenario validation with i18n |
| `DFDValidationPanel.tsx` | NEW | Error/warning display component |
| `DFDService.ts` | NEW | DFD business logic orchestration |
| `DFDParser.ts` | MODIFIED | Added Multiprocess support |
| `DFDTypes.ts` | MODIFIED | Added Multiprocess, DFDValidation |
| `ProjectInfo.tsx` | MODIFIED | Phase 0 validation, collapse/expand |
| `ProjectProgress.tsx` | MODIFIED | Validation status display |
| `PhaseTab.tsx` | MODIFIED | Error/warning badges |
| `PhaseTabs.tsx` | MODIFIED | Passes validation counts |
| `de.json` | MODIFIED | Added dfdValidation section |
| `en.json` | MODIFIED | Added dfdValidation section |

### Key Decisions:

1. **Two-Scenario Validation**: System auto-detects based on External Entity presence
2. **Error vs Warning**: Errors block progress, warnings allow continuation
3. **i18n Format**: `key:type:name` allows flexible parameter passing
4. **Phase Status**: Calculated automatically from validation results
5. **Multiprocess**: Treated identically to Process in validation rules
