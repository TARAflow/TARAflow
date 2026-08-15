# Handover — Step 3: Threat Eval Dialog

## Project Context

**TARAflow** — Electron + React/TypeScript threat modeling tool (TARA).
**Stack:** Electron, React, TypeScript, MUI, Vite, i18next.

---

## Prerequisites

- Step 1+2 complete: catalog in i18n, `proposedMitigations: string[]` on Threat
- `causeDescription` populated by generators
- `evalStatus` exists on Threat (will be replaced in this step)

---

## Goal

Transform the Threats-Tab from a pure display list into an active
**evaluation workspace** where the analyst triages all generated threats
before moving to the Risk Tab.

The flow is: **Generate → Evaluate → Risk Assessment**

Evaluation means:
1. Judge relevance (required decision per threat)
2. Annotate with project-specific context (optional)
3. Capture additional mitigations/verifications that the catalog missed
   (optional, no selection/prioritization — that is Risk Tab work)

---

## Data Model Changes

### Replace `evalStatus` with two orthogonal fields

`evalStatus` conflated two different concerns. Replace it with:

```typescript
/** Analyst's fachliche judgement — is this threat real for this system? */
type ThreatRelevance =
  | "unrated"       // not yet reviewed (default)
  | "relevant"      // confirmed as applicable to this system
  | "not_relevant"  // explicitly ruled out for this system
  | "uncertain";    // needs more information or a second opinion

/** Workflow state — where is the processing? */
type ThreatWorkflowStatus =
  | "open"          // not yet fully processed
  | "reviewed"      // analyst has evaluated, decision recorded
  | "closed";       // treatment decided in Risk Tab
```

### Replace `proposedMitigations: string[]` with `MitigationDraft[]`

Supports both catalog references and custom analyst additions (Option C):

```typescript
interface MitigationDraft {
  /** Catalog ID (e.g. "M-S-001"). Undefined = custom entry. */
  id?: string;
  /** Annotation for catalog entries, or full description for custom entries. */
  notes?: string;
}

interface VerificationDraft {
  /** Catalog ID (e.g. "V-S-001"). Undefined = custom entry. */
  id?: string;
  notes?: string;
}
```

### Updated Threat interface additions

```typescript
interface Threat {
  // ── replaces evalStatus ──────────────────────────────────────────────
  relevance: ThreatRelevance;
  workflowStatus: ThreatWorkflowStatus;
  evalNote?: string;              // optional reasoning for the relevance decision

  // ── replaces proposedMitigations: string[] ───────────────────────────
  proposedMitigations: MitigationDraft[];
  proposedVerifications: VerificationDraft[];

  // ── unchanged from Step 1+2 ──────────────────────────────────────────
  causeDescription: string;
  isTextCustomized: boolean;
}
```

### Migration guard (backward compatibility)

Existing saved projects have `evalStatus` and `proposedMitigations: string[]`.
Apply this guard when loading project data:

```typescript
function migrateThreat(raw: any): Threat {
  // evalStatus → relevance + workflowStatus
  if ('evalStatus' in raw && !('relevance' in raw)) {
    const map: Record<string, ThreatRelevance> = {
      confirmed: 'relevant',
      dismissed: 'not_relevant',
      review:    'uncertain',
      pending:   'unrated',
    };
    raw.relevance       = map[raw.evalStatus] ?? 'unrated';
    raw.workflowStatus  = raw.evalStatus === 'pending' ? 'open' : 'reviewed';
    delete raw.evalStatus;
  }

  // proposedMitigations: string[] → MitigationDraft[]
  if (Array.isArray(raw.proposedMitigations) &&
      typeof raw.proposedMitigations[0] === 'string') {
    raw.proposedMitigations = raw.proposedMitigations.map(
      (id: string) => ({ id })
    );
  }
  if (Array.isArray(raw.proposedVerifications) &&
      typeof raw.proposedVerifications[0] === 'string') {
    raw.proposedVerifications = raw.proposedVerifications.map(
      (id: string) => ({ id })
    );
  }

  // causeDescription default
  if (!('causeDescription' in raw)) raw.causeDescription = '';

  return raw as Threat;
}
```

### createEmptyThreat update

```typescript
export function createEmptyThreat(...): Threat {
  return {
    // ...existing fields...
    relevance:             "unrated",
    workflowStatus:        "open",
    evalNote:              undefined,
    causeDescription:      "",
    isTextCustomized:      false,
    proposedMitigations:   [],
    proposedVerifications: [],
  };
}
```

---

## Generator Changes

Generators currently write `proposedMitigations: string[]`.
Update to write `MitigationDraft[]`:

```typescript
// element-generator.ts + interaction-generator.ts
threat.proposedMitigations  = template.mitigations.map(id => ({ id }));
threat.proposedVerifications = template.verifications.map(id => ({ id }));
```

---

## Threats Table Changes

### New columns

Replace the current column set with:

```
T-ID | STRIDE | Source | Impact | Safety | Threat | Mitigations | Status | Actions
```

**Source** — `auto` / `manual` chip. Analyst sees immediately if threat was
generated or manually entered. Important for audit.

**Impact** — highest `aggregatedImpact` of linked assets, color-coded.
Computed at render time from `linkedAssetIds`, not stored on Threat.

**Safety** — `direct` / `indirect` / `none` icon.
Computed from `linkedAssetIds` checking `physicalImpact` on assets.
Threats with `direct` safety impact should be triaged first.

**Mitigations** — only `MitigationType` chips from proposed catalog entries.
Space-efficient; tooltip on hover shows suggestion text + notes.
Click on the cell opens the dialog.

**Status** — clickable `ThreatRelevance` chip, directly in the row.
No dialog required for status change.

### Relevance chip colors

```typescript
const RELEVANCE_COLORS: Record<ThreatRelevance, string> = {
  unrated:      "#9ca3af",   // grey
  relevant:     "#16a34a",   // green
  not_relevant: "#dc2626",   // red
  uncertain:    "#d97706",   // amber
};
```

### Inline Quick Actions (no dialog needed)

Each row has three icon buttons visible on hover:

```
[✓ Confirm relevant]  [? Mark uncertain]  [✗ Dismiss]
```

These update `relevance` + set `workflowStatus = "reviewed"` in-place.

### Accordion header badge

Each Trust Boundary accordion shows progress:

```
[ TB-1: Field Network ]  (12 threats — 8 reviewed, 3 unrated, 1 uncertain)
```

Color-coded: green when all reviewed, amber when uncertain remain, grey when unrated.

### Bulk actions

Checkbox column on the left. When ≥1 row selected, an action bar appears:

```
[N selected]  [✓ Mark relevant]  [✗ Dismiss]  [? Mark uncertain]  [Clear]
```

Typical use case: all Spoofing threats inside an internal TB are not relevant
because no authentication boundary exists → select all, dismiss at once.

---

## Threat Eval Dialog

### Three-level structure

**Level 1 — Decision (required)**
The analyst must set `relevance`. This is the only mandatory action.

**Level 2 — Annotation (optional)**
Notes on threat text, notes on individual catalog mitigations/verifications.
No selection, no prioritization — context capture only.

**Level 3 — Suggestion Capture (optional)**
Add custom mitigations/verifications that the catalog does not cover.
These are captured for later use in the Risk Tab. No selection here.

### Dialog layout

```
┌────────────────────────────────────────────────────────────┐
│  HEADER                                                    │
│  [S] Spoofing  ·  TB-1 / OPC UA Server  ·  auto  ·  DF-3  │
├────────────────────────────────────────────────────────────┤
│  THREAT                                         [edit ✎]  │
│  Unauthorized process access via identity spoofing         │
│                                                            │
│  CAUSE                                                     │
│  ⚠ Weak or missing authentication mechanisms for process   │
│    access  (read-only)                                     │
│                                                            │
│  ATTACK                                         [edit ✎]  │
│  Attacker spoofs a legitimate identity to gain             │
│  unauthorized access to a protected process                │
├────────────────────────────────────────────────────────────┤
│  PROPOSED MITIGATIONS                         [+ Add]      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [authentication]                                     │  │
│  │ Implement multi-factor authentication (MFA)          │  │
│  │   ↳ _______________________________________ [note]   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ [digital_signatures]                                 │  │
│  │ Use PKI systems and digital certificates             │  │
│  │   ↳ _______________________________________ [note]   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  PROPOSED VERIFICATIONS               (follow mitigations) │
│  • Penetration testing for auth bypass  ↳ [note]           │
│  • MFA implementation with bypass attempts  ↳ [note]       │
│  [+ Add custom verification]                               │
├────────────────────────────────────────────────────────────┤
│  RELEVANCE  (required)                                     │
│  ● Relevant  ○ Not relevant  ○ Uncertain  ○ Unrated        │
│                                                            │
│  Note: ____________________________________________        │
│  (optional — useful for audit trail)                       │
├────────────────────────────────────────────────────────────┤
│  [← 3 / 12]    [✗ Dismiss]  [? Uncertain]  [✓ Confirm →]  │
└────────────────────────────────────────────────────────────┘
```

### Section details

**Header** — read-only context strip:
STRIDE chip + Trust Boundary + Element/DataFlow name + source badge

**Cause** — read-only, amber background box.
Explains why this threat is technically possible. Not editable — it is
derived from the catalog and is a factual statement, not an analyst judgement.

**Threat / Attack** — editable via `[edit ✎]` toggle.
When edited: `isTextCustomized = true`, text stored locally,
i18n link severed. A badge shows `[customized]` when active.

**Proposed Mitigations** — catalog entries from `proposedMitigations`.
Each entry shows: type chip + localized suggestion text + optional note field.
`[+ Add]` button opens an inline form for custom entry (Level 3).

**Proposed Verifications** — catalog entries from `proposedVerifications`.
Same structure. Label clarifies these follow the mitigations automatically.
Custom verifications can be added inline.

**Relevance** — segmented button or radio group.
Setting any value except `unrated` automatically sets `workflowStatus = "reviewed"`.

**Note** — free text, optional. Useful for audit: explains why a threat
was dismissed or marked uncertain.

### Footer navigation

```
[← 3 / 12]  — Previous threat in current group + position indicator
[✗ Dismiss] — Sets relevance = not_relevant, stays in dialog
[? Uncertain] — Sets relevance = uncertain, stays in dialog
[✓ Confirm →] — Sets relevance = relevant, advances to next unrated threat
```

`Confirm →` skips already-reviewed threats and advances to the next
`unrated` or `uncertain` one. When all threats in the group are reviewed,
the dialog closes automatically.

---

## i18n Keys to Add

Add to `src/i18n/locales/en/threats.json` and `de/threats.json`:

```json
"eval": {
  "relevance": "Relevance",
  "unrated": "Unrated",
  "relevant": "Relevant",
  "not_relevant": "Not Relevant",
  "uncertain": "Uncertain",
  "evalNote": "Note (optional)",
  "cause": "Root Cause",
  "proposedMitigations": "Proposed Mitigations",
  "proposedVerifications": "Proposed Verifications",
  "followsMitigations": "follow mitigations automatically",
  "addMitigation": "Add custom mitigation",
  "addVerification": "Add custom verification",
  "customized": "customized",
  "workflowOpen": "Open",
  "workflowReviewed": "Reviewed",
  "workflowClosed": "Closed",
  "confirmAndNext": "Confirm",
  "prevThreat": "Previous",
  "positionIndicator": "{{current}} / {{total}}",
  "allReviewed": "All threats reviewed",
  "bulkConfirm": "Mark relevant",
  "bulkDismiss": "Dismiss",
  "bulkUncertain": "Mark uncertain",
  "selected": "{{count}} selected"
},
"columns": {
  "source": "Source",
  "impact": "Impact",
  "safety": "Safety",
  "status": "Status"
}
```

---

## Key Files

```
src/features/threats/models/
  threat-types.ts                  ← ThreatRelevance, ThreatWorkflowStatus,
                                     MitigationDraft, VerificationDraft,
                                     replace evalStatus, update createEmptyThreat

src/features/threats/services/
  per-element/element-generator.ts  ← MitigationDraft[] output
  per-interaction/interaction-generator.ts ← MitigationDraft[] output

src/features/threats/components/
  per-element/element-threat-table.tsx    ← new columns, inline actions, bulk
  per-interaction/interaction-threat-table.tsx ← same
  shared/threat-dialog.tsx               ← full rewrite per this spec
  shared/threat-table-utils.tsx          ← RelevanceChip, SourceChip,
                                            SafetyIcon, ImpactChip

src/app/services/
  project-migration.ts                   ← migrateThreat() guard

src/i18n/locales/en/threats.json         ← eval.* + columns.source/impact/safety/status
src/i18n/locales/de/threats.json         ← same in German
```

---

## Definition of Done

- [ ] `ThreatRelevance` and `ThreatWorkflowStatus` types defined
- [ ] `MitigationDraft` and `VerificationDraft` types defined
- [ ] `evalStatus` removed from `Threat` interface; replaced by `relevance` + `workflowStatus`
- [ ] `proposedMitigations: string[]` replaced by `proposedMitigations: MitigationDraft[]`
- [ ] `migrateThreat()` guard handles projects saved with old schema
- [ ] `createEmptyThreat()` initializes all new fields
- [ ] Generators emit `MitigationDraft[]`
- [ ] Threat table: Source, Impact, Safety columns added
- [ ] Threat table: Relevance chip clickable inline (no dialog required)
- [ ] Threat table: Quick Action buttons (confirm / uncertain / dismiss) on hover
- [ ] Threat table: Bulk action bar when ≥1 row selected
- [ ] Accordion header shows reviewed/unrated/uncertain counts
- [ ] Dialog: Cause section read-only, amber background
- [ ] Dialog: Threat/Attack editable with `isTextCustomized` flag
- [ ] Dialog: Proposed Mitigations with per-entry note fields
- [ ] Dialog: Custom mitigation/verification add (Level 3)
- [ ] Dialog: Proposed Verifications with per-entry note fields
- [ ] Dialog: Relevance segmented control (required)
- [ ] Dialog: evalNote free text field
- [ ] Dialog: Prev/Next footer navigation, auto-advance on Confirm
- [ ] All new strings in `en/de threats.json` under `eval.*`
- [ ] No regression on existing per-element + per-interaction display
