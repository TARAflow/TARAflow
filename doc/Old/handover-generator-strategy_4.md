# Handover — Block 4: Generator Strategy Pattern

## Project Context

**TARAflow** — Electron + React/TypeScript threat modeling tool (TARA).
**Stack:** Electron, React, TypeScript, MUI, Vite, i18next.

---

## Prerequisites

This block depends on:
- **Block 2 (i18n splitting)** — namespace files must exist
- **Block 3 (threat catalog)** — `ProjectSettings`, `context` field on templates,
  `getApplicableTemplates()` service must be implemented

---

## Current State

The generator produces threats using a flat rule table:
- Per-element: fixed STRIDE categories per element type (Process → S,T,R,I,D,E etc.)
- Per-interaction: sender/receiver perspective, 6 STRIDE per DataFlow

No element properties are evaluated. A `bare_metal` bootloader and a REST API
process produce identical threats.

---

## Goal

Three pluggable strategies, auto-detected from project content.
Each strategy uses element properties + project context to:
1. Select which STRIDE categories apply
2. Choose context-specific threat templates
3. Set initial mitigation/verification from catalog

---

## Strategy Overview

### ClassicStrategy
**When:** No assets linked to elements, no ProjectSettings set.
**Behaviour:** Current behaviour — fixed STRIDE per element type, generic templates.
**Use case:** Quick sketch, early exploration.

### HybridStrategy
**When:** Some elements have linked assets OR ProjectSettings is set.
**Behaviour:** STRIDE categories modulated by element properties.
Property → STRIDE reduction/escalation rules applied (see below).
Context-filtered templates from catalog.
**Use case:** Standard threat modelling session.

### RelationStrategy
**When:** All elements have linked assets with full CIANAAA annotations.
**Behaviour:** STRIDE derived from asset relation types (transports/modifies/creates)
combined with security goals (C,I,A,N,A,A,A).
**Use case:** Asset-complete models, IEC 62443 deep analysis.

### Auto-detection Logic

```typescript
function detectStrategy(project: ThreatProjectData): StrategyType {
  const assetCoverage = computeAssetCoverage(project);

  if (assetCoverage === 1.0) return "RelationStrategy";
  if (assetCoverage > 0 || project.settings?.platform) return "HybridStrategy";
  return "ClassicStrategy";
}
```

---

## HybridStrategy — Property → STRIDE Rules

### Process Rules

| Condition | STRIDE Effect |
|---|---|
| `technology` = `bootloader` | Add T (firmware tampering), Add E (unlock chain) |
| `technology` = `protocol_stack` | Add S (injection), Add D (flooding) |
| `technology` = `driver` | Add T (bus manipulation) |
| `runsAs` = `root` or `privilegeLevel` = `root` | Escalate E priority |
| `authenticationRequired` = `no` or `none` | Escalate S priority |
| `inputValidation` = `none` | Escalate T priority |
| `processSemantic` = `functional_block` | Reduce S, R (no identity boundary) |
| `processSemantic` = `security_boundary` | Escalate all — this is an enforcement point |
| `exposedToInternet` = `true` | Escalate all STRIDE |

### DataFlow Rules

| Condition | STRIDE Effect |
|---|---|
| `exposureLevel` = `EL4` | All STRIDE at max priority |
| `exposureLevel` = `EL0` | Skip S, I — internal trusted flow |
| `encryptionInTransit` = `none` | Escalate T, I |
| `encryptionInTransit` = `tls` or `mtls` | Reduce T, I |
| `safetyRelevant` = `true` | Add physical impact annotation |
| `crossesSafetyBoundary` = `true` | Escalate T, I |
| `endpointAuthentication` = `none` | Escalate S |
| `integrityProtection` = `true` | Reduce T |
| `excludeFromThreatGen` = `true` | Skip entirely |
| `assumedTrusted` = `true` *(future)* | Reduce to T + D only |

### DataStore Rules

| Condition | STRIDE Effect |
|---|---|
| `encryptionAtRest` = `none` | Escalate T, I |
| `integrityProtection` = `false` | Escalate T |
| `containsSafetyRelevantData` = `true` | Add physical impact, escalate T + D |
| `dataClassification` = `secret` | Escalate I priority |
| `multiTenant` = `true` | Escalate I (cross-tenant disclosure) |
| `backupEnabled` = `false` | Escalate D (data loss) |

### TrustBoundary + Interface Rules

| Condition | STRIDE Effect |
|---|---|
| `boundaryType` = `debug` | Add E (unlock via debug), Add I (read via debug) |
| `boundaryType` = `boot` | Add T (firmware), Add E (bypass boot check) |
| `boundaryType` = `peripheral` | Add T (bus injection), Add S (sensor spoofing) |
| Interface `type` = `usb` + `accessControl` = `none` | Add T, Add E |
| Interface `safetyRelevant` = `true` | Escalate T + D |

---

## Context-Specific Threat Templates

After Block 3, templates have a `context` field. The generator selects templates
matching the project's `ProjectSettings`:

```typescript
function selectThreatTemplate(
  strideCategory: StrideCategory,
  elementType: DFDElementType,
  projectSettings: ProjectSettings,
): ThreatTemplate {
  // 1. Find context-specific template (industry + platform + standards match)
  const specific = getApplicableTemplates(projectSettings, strideCategory)
    .filter(t => t.elementTypes.includes(elementType))
    .find(t => hasContext(t));

  // 2. Fall back to universal template
  return specific ?? getUniversalTemplate(strideCategory, elementType);
}
```

**Example — OT/ICS + IEC 62443:**
```
Process (bare_metal, protocol_stack) + Spoofing
→ Template T-S-OT-001: "Attacker injects malicious Modbus/CAN frames 
  impersonating a legitimate controller — no authentication on fieldbus"
  
vs. generic:
→ Template T-S-001: "Attacker impersonates a legitimate user or system"
```

---

## Auto-Fill Mitigation + Verification on Generate

After generation, each threat gets pre-filled mitigation and verification
from the catalog (currently empty):

```typescript
// In element-generator / interaction-generator after creating threat:
const mitigation = getBestMitigation(threat.strideCategory, projectSettings);
const verification = getBestVerification(threat.strideCategory, projectSettings);

threat.mitigation = mitigation?.text ?? "";
threat.verification = verification?.text ?? "";
```

This means analysts start with a complete draft instead of empty fields.
They refine rather than write from scratch.

---

## Architecture

```
src/features/threats/services/
  strategies/
    strategy-types.ts          ← StrategyType, IGeneratorStrategy interface
    classic-strategy.ts        ← current behaviour
    hybrid-strategy.ts         ← property-aware (new)
    relation-strategy.ts       ← asset-relation-driven (new)
    strategy-factory.ts        ← detectStrategy() + create()
  stride-modifier.ts           ← property → STRIDE rules (pure functions)
  context-template-selector.ts ← getApplicableTemplates() wrapper
```

---

## Key Files (current)

```
src/features/threats/services/per-element/element-generator.ts
src/features/threats/services/per-interaction/interaction-generator.ts
src/features/threats/models/threat-types.ts           ← ThreatConfiguration
src/features/dfd/models/element-properties.ts         ← all element properties
```

---

## Definition of Done

- [ ] `strategy-types.ts` — `IGeneratorStrategy` interface
- [ ] `ClassicStrategy` — wraps current generator logic unchanged
- [ ] `HybridStrategy` — property → STRIDE rules for all element types
- [ ] `strategy-factory.ts` — `detectStrategy()` + `createStrategy()`
- [ ] `ThreatConfiguration` — `strategyOverride?: StrategyType` (manual override)
- [ ] Config dialog — shows detected strategy, allows override
- [ ] Auto-fill mitigation + verification on generate from catalog
- [ ] Context-specific template selection via `ProjectSettings`
- [ ] CNC reference case: verify OT/ICS templates are selected
- [ ] Medical infusion pump reference case: verify embedded templates selected
- [ ] No regression on existing per-element + per-interaction generate
