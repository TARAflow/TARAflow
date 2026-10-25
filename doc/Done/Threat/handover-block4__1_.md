# Handover — Block 4: Context-Aware Threat Generation + Coverage Inference

## Project Context

**TARAflow** — Electron + React/TypeScript threat modeling tool (TARA).
**Stack:** Electron, React, TypeScript, MUI, Vite, i18next.

---

## Prerequisites

- Block 3 complete: catalog in i18n namespaces, `proposedMitigations: MitigationDraft[]` on Threat
- `ProjectInfoData.tags` migrated from `string[]` → `ProjectTags`
- All four catalog namespaces registered in `i18n.ts`

---

## What This Block Delivers

1. **Context-aware template filtering** — templates selected based on project tags
   (domain / platform / regulation) and element-level properties
2. **Generator Strategy Pattern** — ClassicStrategy / HybridStrategy / RelationStrategy
   auto-detected; coverage inference integrated
3. **Coverage Inference** — mitigations already modelled in DFD properties shown as
   "covered" in the Threat Dialog and Threat Table

---

## Phase 0 — ProjectTags Type

Replace `ProjectInfoData.tags: string[]` with strongly-typed `ProjectTags`:

```typescript
// src/shared/project-tags.ts
export interface ProjectTags {
  domain:     string[];   // e.g. ["ot_ics"], ["automotive"]
  platform:   string[];   // e.g. ["embedded"], ["cloud"]
  regulation: string[];   // e.g. ["iec_62443"], ["iso_21434"]
  custom:     string[];   // freeform
}
```

Tag values come directly from `tag-categories.ts` — no separate enum.

### Migration guard
```typescript
// project-migration.ts
function migrateProjectTags(tags: string[] | ProjectTags): ProjectTags {
  if (Array.isArray(tags)) {
    // Legacy: bucket each string by getTagCategory()
    return tags.reduce((acc, tag) => {
      const cat = getTagCategory(tag) ?? "custom";
      acc[cat].push(tag);
      return acc;
    }, { domain: [], platform: [], regulation: [], custom: [] });
  }
  return tags;
}
```

### Tag validator (soft warnings, not hard errors)
- Regulation/domain mismatches logged as warnings only
- No hard block on save — analyst can override

---

## Phase 1 — Context Filtering Activated

`matchesContext()` in `threat-catalog-service.ts` reads `project.info.tags` directly.
No `ProjectSettings` object — that was removed.

```typescript
// threat-catalog-service.ts
function matchesContext(
  template: ElementTemplate,
  projectTags: ProjectTags,
  elementProps: ElementProperties
): boolean {
  const ctx = template.context;
  if (!ctx) return true; // universal template

  if (ctx.domain?.length && !ctx.domain.some(d => projectTags.domain.includes(d)))
    return false;
  if (ctx.platform?.length && !ctx.platform.some(p => projectTags.platform.includes(p)))
    return false;
  if (ctx.regulation?.length && !ctx.regulation.some(r => projectTags.regulation.includes(r)))
    return false;

  // Element-level keys (Phase 4b)
  if (ctx.technology?.length) {
    const v = elementProps?.["technology"] as string | undefined;
    if (!v || !ctx.technology.includes(v)) return false;
  }
  if (ctx.interfaceType?.length) {
    const v = elementProps?.["interfaceType"] as string | undefined;
    if (!v || !ctx.interfaceType.includes(v)) return false;
  }
  if (ctx.systemClass?.length) {
    const v = elementProps?.["systemClass"] as string | undefined;
    if (!v || !ctx.systemClass.includes(v)) return false;
  }

  return true;
}
```

---

## Phase 2 — Embedded Templates

New catalog files:
- `embedded-element-templates.json` — ChipBoundary + Interface templates
- `embedded-interaction-templates.json` — Embedded DataFlow templates

New catalog entries:
```
M-CB-T-001  Firmware integrity verification (ChipBoundary)
M-CB-T-002  Secure boot chain validation
M-CB-E-001  Debug interface locked in production build
M-CB-E-002  firmwareProtection + debugInterfaceLocked combined check
M-IF-*      Interface-specific mitigations
```

`ChipBoundary` added to `STRIDE_PER_ELEMENT_TYPE`.

---

## Phase 3 — Strategy Pattern

### Architecture

```
src/features/threats/services/
  strategies/
    strategy-types.ts           ← IGeneratorStrategy interface, StrategyType
    classic-strategy.ts         ← current behaviour, unchanged
    hybrid-strategy.ts          ← property-aware
    relation-strategy.ts        ← asset-relation-driven
    strategy-factory.ts         ← createStrategy() (single function, no detectStrategy)
  stride-modifier.ts            ← property → STRIDE rules (pure functions)
  coverage-inference.ts         ← inferCoverage(), CoverageStatus, COVERAGE_RULES
  threat-catalog-service.ts     ← matchesContext() updated, filtering activated
```

### IGeneratorStrategy interface

```typescript
interface IGeneratorStrategy {
  selectElementTemplates(element, projectTags, elementProps): ElementTemplate[];
  selectInteractionTemplates(conn, projectTags, senderProps, receiverProps): InteractionTemplate[];
  getInitialImpact(element, strideCategory, project): CIANAAALevel | undefined;
}
```

### Auto-detection logic (strategy-factory.ts)

```typescript
function createStrategy(project: Project): IGeneratorStrategy {
  const hasAssets = (project.assets?.items?.length ?? 0) > 0;
  const hasRelations = hasAssetRelations(project.assets);
  const forcedClassic = project.threats?.config?.forceClassicMode === true;

  if (forcedClassic) return new ClassicStrategy();
  if (hasRelations)  return new RelationStrategy();
  if (hasAssets)     return new HybridStrategy();
  return new ClassicStrategy();
}
```

Note: `strategyOverride: StrategyType` was replaced with `forceClassicMode?: boolean`
to simplify the API — only one meaningful override case exists.

### HybridStrategy — property → STRIDE rules

`stride-modifier.ts` contains pure functions per element type:
- `modifyStrideForProcess(props)` → removes STRIDE categories made impossible by properties
- `modifyStrideForDataStore(props)` → same pattern
- `modifyStrideForDataFlow(props)` → same pattern
- `modifyStrideForExternalEntity(props)` → same pattern
- `modifyStrideForInterface(props)` → same pattern
- `modifyStrideForChipBoundary(props)` → same pattern

### RelationStrategy — CIANAAA-driven impact

Sets `threat.initialImpact` from MAX CIANAAA level across driving asset relations.
Used by Risk Tab as pre-populated impact baseline.

### ThreatSource values (granular)

```typescript
type ThreatSource =
  | "generated:classic"
  | "generated:properties"
  | "generated:cianaaa"
  | "generated:full"
  | "manual";
```

i18n keys use underscore format: `"generated:classic"` → `"generated_classic"`.

---

## Phase 4 — Multiprocess Templates

`SYS-*` templates moved out of `element-templates.json` into `multiprocess-templates.json`.
`systemClass` context key on Multiprocess element (`systemClass: "cnc" | "mes" | "scada" | ...`)
drives template selection — not project-level platform tags.

This solves the mixed-system problem: a CNC machine containing both embedded controllers
and a backend application correctly receives different templates per element type.

---

## Phase 4b — Element-Level TemplateContext Keys

`TemplateContext` extended with:
```typescript
interface TemplateContext {
  // Project-level (existing)
  domain?:     string[];
  platform?:   string[];
  regulation?: string[];
  // Element-level (new Phase 4b)
  technology?:   string[];   // e.g. ["mqtt", "opcua"]
  protocol?:     string[];   // e.g. ["can", "modbus"]
  entityType?:   string[];   // ExternalEntity subtype
  interfaceType?: string[];  // Interface connector type (jtag, swd, uart, ...)
  systemClass?:  string[];   // Multiprocess system class
}
```

Fully decouples template selection from project tags.

---

## Phase 5 — Coverage Inference

### Concept

DFD properties already describe implemented controls. When a mitigation in the
Threat Dialog corresponds to a property already set in the DFD, it is shown as
"covered by model" — green badge, no auto-dismiss, no influence on relevance.

This reinforces correct analysis methodology: threats are always analysed as if
no controls existed. Coverage is informational only.

### Types

```typescript
type CoverageStatus =
  | "covered"          // property value confirms control is in place
  | "partial"          // some but not all required properties set
  | "not_covered"      // property absent or set to insecure value
  | "not_applicable"   // mitigation not relevant for this element type
  | "unknown";         // no rule defined for this mitigation/element combination

interface CoverageContext {
  element:    ElementProperties;
  dataFlow?:  DataFlowProperties;
  boundary?:  BoundaryProperties;
  interfaces?: InterfaceProperties[];
  perspective?: "sender" | "receiver";  // for interaction threats
}

interface CoverageResult {
  status:         CoverageStatus;
  reason?:        string;   // human-readable explanation
  sourceProperty?: string;  // which property triggered this
}
```

### Initial COVERAGE_RULES

| Mitigation ID | Element type | Covered when |
|---|---|---|
| M-S-001 | DataFlow | `authenticationMethod !== "none"` |
| M-S-002 | ExternalEntity | `authenticationRequired === true` |
| M-T-001 | DataFlow | `integrityProtection === true` |
| M-T-002 | DataFlow | `replayProtection === true` |
| M-I-001 | DataStore | `encryptionAtRest === true` |
| M-I-004 | DataFlow | `encryptionInTransit === true` |
| M-E-001 | Process | `authorizationModel !== "none"` |
| M-E-006 | Process | `privilegeSeparation === true` |
| M-CB-E-001 | ChipBoundary | `debugInterfaceLocked === true` |
| M-CB-E-002 | ChipBoundary | `firmwareProtection === true` AND `debugInterfaceLocked === true` |

### UI

- Threat Dialog: mitigation entries show coverage icon + reason tooltip
- Threat Table: mitigation chips show coverage icon
- Labels: "Covered by model" / "Inferred from model" — never "implemented" or "done"
- Coverage has **zero influence** on `relevance` — no auto-dismiss, no sorting

### Optional extension (non-breaking)

```typescript
// On element properties — explicit control declaration
securityControls?: ControlTag[];

type ControlTag =
  | "mfa" | "strong_auth" | "mutual_auth"
  | "encryption_at_rest" | "encryption_in_transit"
  | "input_validation_strict" | "rate_limiting"
  | "network_segmentation" | "secure_boot"
  | "code_signing" | "logging_monitoring";
```

`inferCoverage()` checks `securityControls` first, falls back to property inference.

---

## Key Files Changed

```
src/shared/
  project-tags.ts               ← ProjectTags, getTagCategory(), migrateProjectTags()

src/features/threats/services/
  strategies/
    strategy-types.ts
    classic-strategy.ts
    hybrid-strategy.ts
    relation-strategy.ts
    strategy-factory.ts         ← createStrategy() only (no detectStrategy)
  stride-modifier.ts
  coverage-inference.ts
  threat-catalog-service.ts

src/features/threats/models/
  threat-types.ts               ← ThreatSource granular values, initialImpact field
                                   forceClassicMode replaces strategyOverride

src/features/threats/services/catalog/
  embedded-element-templates.json
  embedded-interaction-templates.json
  multiprocess-templates.json

src/app/services/
  project-migration.ts          ← migrateProjectTags() on load
```

**Architectural constraint:** `features/threats` and `features/dfd` must never import
from each other — both import from `src/shared`.

---

## Definition of Done

### Generator Strategy

- [ ] `ProjectSettings` interface removed from `threat-types.ts`
- [ ] `ProjectTags` in `src/shared/project-tags.ts`
- [ ] `migrateProjectTags()` applied on project load
- [ ] `TemplateContext` with domain/platform/regulation/technology/interfaceType/systemClass
- [ ] `matchesContext()` reads `project.info.tags` directly
- [ ] Context filtering active in `getApplicableElementTemplates()`
- [ ] Context filtering active in `getApplicableInteractionTemplates()`
- [ ] `IGeneratorStrategy` interface defined
- [ ] `ClassicStrategy` — wraps current logic unchanged
- [ ] `HybridStrategy` — property → STRIDE rules for all element types
- [ ] `RelationStrategy` — asset-relation-driven, sets `initialImpact`
- [ ] `createStrategy()` — auto-detection logic
- [ ] `forceClassicMode?: boolean` on ThreatConfiguration
- [ ] Granular `ThreatSource` values with underscore i18n keys
- [ ] `IEnrichmentProvider` stub for Phase E1 (MITRE ATT&CK) and E2 (LLM)
- [ ] At least 5 context-specific templates per new catalog file
- [ ] i18n strings (en + de) for all new templates
- [ ] OT/ICS project: OT-specific templates selected over generic
- [ ] Medical project: Medical/Embedded templates selected
- [ ] No tags set: ClassicStrategy with universal templates
- [ ] No regression on existing per-element + per-interaction generate

### Coverage Inference

- [ ] `CoverageStatus` type defined (5 values)
- [ ] `CoverageContext` type defined (element + dataFlow + boundary + interfaces + perspective)
- [ ] `CoverageResult` type defined (status + reason + sourceProperty)
- [ ] `inferCoverage(mitigationId, context)` implemented
- [ ] Initial `COVERAGE_RULES` for M-S-001/002, M-T-001/002, M-I-001/004, M-E-001/006, M-CB-E-001/002
- [ ] Coverage signals in Threat Dialog (icon + reason tooltip)
- [ ] Coverage chips in Threat Table mitigation column
- [ ] Coverage has zero influence on `relevance`
- [ ] UI labels say "Covered by model" — never "implemented" or "done"
- [ ] `securityControls?: ControlTag[]` stub on element properties (non-breaking)
