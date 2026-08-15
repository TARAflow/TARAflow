# Handover — Step 1+2: i18n Migration + Catalog Restructure

## Project Context

**TARAflow** — Electron + React/TypeScript threat modeling tool (TARA).
**Stack:** Electron, React, TypeScript, MUI, Vite, i18next.

---

## Prerequisites

- Block 2 (i18n namespace splitting) must be complete
- Existing EN/DE display must remain unchanged after this step (regression test)

---

## What Changes in One Pass

| Before | After |
|---|---|
| `threat-catalog.json` — one file, three mixed sections, EN/DE embedded | Four language-neutral catalog files |
| `interaction-templates.ts` — data + logic + EN/DE strings + embedded mitigation strings | Data extracted to JSON; type definitions remain in `.ts` |
| No explicit Threat→Mitigation→Verification linkage | `mitigations[]` + `verifications[]` ID arrays on every template |
| No context filtering possible | `context` field on every template (prep for Step 4) |
| Translatable strings inside data files | All strings in `src/i18n/locales/en|de/` only |

---

## Target File Structure

### Language-neutral catalog files

```
src/features/threats/services/
  element-templates.json        ← threats per DFD element type
  interaction-templates.json    ← threats per data flow direction
  mitigations.json              ← mitigation catalog
  verifications.json            ← verification catalog
```

### i18n namespace files

```
src/i18n/locales/
  en/
    element-templates.json
    interaction-templates.json
    mitigations.json
    verifications.json
  de/
    element-templates.json
    interaction-templates.json
    mitigations.json
    verifications.json
```

### Unchanged

```
src/features/threats/services/interaction-templates.ts
  ← keep: type definitions, IGeneratorStrategy interface stubs
  ← remove: all data arrays, all EN/DE string fields, applyTemplatePlaceholders()
```

---

## Catalog Schemas (language-neutral)

### `element-templates.json`

```json
{
  "version": "2.0.0",
  "elementTemplates": [
    {
      "id": "T-S-001",
      "strideCategory": "S",
      "elementTypes": ["ExternalEntity"],
      "context": {},
      "mitigations": ["M-S-001", "M-S-002", "M-S-004"],
      "verifications": ["V-S-001", "V-S-002"],
      "isCustom": false
    },
    {
      "id": "S-IF-001",
      "strideCategory": "S",
      "elementTypes": ["PhysicalInterface", "Interface"],
      "context": { "platform": ["embedded", "iot"] },
      "mitigations": ["M-S-001", "M-IF-S-001"],
      "verifications": ["V-S-001", "V-IF-S-001"],
      "isCustom": false
    }
  ]
}
```

### `interaction-templates.json`

```json
{
  "version": "2.0.0",
  "interactionTemplates": [
    {
      "id": "S-INT-IN-001",
      "strideCategory": "S",
      "perspective": "receiver",
      "context": {},
      "mitigations": ["M-S-001", "M-S-002", "M-S-004"],
      "verifications": ["V-S-001", "V-S-003"],
      "isCustom": false
    },
    {
      "id": "S-INT-OUT-001",
      "strideCategory": "S",
      "perspective": "sender",
      "context": {},
      "mitigations": ["M-S-001", "M-S-002", "M-S-005"],
      "verifications": ["V-S-001", "V-S-003"],
      "isCustom": false
    }
  ]
}
```

### `mitigations.json`

```json
{
  "version": "2.0.0",
  "mitigations": [
    { "id": "M-S-001", "strideCategory": "S", "context": {}, "isCustom": false },
    { "id": "M-IF-S-001", "strideCategory": "S", "context": { "platform": ["embedded", "iot"] }, "isCustom": false }
  ]
}
```

### `verifications.json`

```json
{
  "version": "2.0.0",
  "verifications": [
    { "id": "V-S-001", "strideCategory": "S", "context": {}, "isCustom": false },
    { "id": "V-IF-S-001", "strideCategory": "S", "context": { "platform": ["embedded", "iot"] }, "isCustom": false }
  ]
}
```

---

## i18n Namespace Files

### `en/element-templates.json`

```json
{
  "T-S-001": {
    "threat": "Spoofing of external entity identity",
    "attack": "Attacker impersonates a legitimate external entity to gain unauthorized access"
  },
  "T-DF-001": {
    "threat": "Data tampering during transmission",
    "attack": "Attacker intercepts and modifies data flowing between components"
  }
}
```

### `de/element-templates.json`

```json
{
  "T-S-001": {
    "threat": "Fälschung der Identität einer externen Entität",
    "attack": "Angreifer gibt sich als legitime externe Entität aus, um unbefugten Zugang zu erlangen"
  }
}
```

### `en/interaction-templates.json`

Placeholders use **i18next interpolation syntax** — resolved at render time,
not by the old regex engine.

```json
{
  "S-INT-IN-001": {
    "threat": "Sender spoofing: Attacker impersonates {{sourceName}} to deceive {{targetName}}",
    "attack": "Attacker forges identity of {{sourceName}} and sends malicious data to {{targetName}}, which processes it as legitimate"
  },
  "S-INT-OUT-001": {
    "threat": "Receiver spoofing: Attacker impersonates {{targetName}} to intercept data from {{sourceName}}",
    "attack": "Attacker sets up rogue endpoint pretending to be {{targetName}}, causing {{sourceName}} to send sensitive data to attacker"
  }
}
```

### `de/interaction-templates.json`

```json
{
  "S-INT-IN-001": {
    "threat": "Sender-Spoofing: Angreifer gibt sich als {{sourceName}} aus, um {{targetName}} zu täuschen",
    "attack": "Angreifer fälscht die Identität von {{sourceName}} und sendet bösartige Daten an {{targetName}}"
  }
}
```

### `en/mitigations.json`

```json
{
  "M-S-001": { "mitigation": "Implement multi-factor authentication (MFA)" },
  "M-S-002": { "mitigation": "Use PKI systems and digital certificates" },
  "M-S-004": { "mitigation": "Use digitally signed packets and authenticate code/data" },
  "M-IF-S-001": { "mitigation": "Implement hardware authentication (secure elements, cryptographic chips)" }
}
```

### `en/verifications.json`

```json
{
  "V-S-001": { "verification": "Penetration testing for authentication bypass" },
  "V-S-002": { "verification": "Verify MFA implementation with bypass attempts" },
  "V-S-003": { "verification": "Certificate validation testing (SSL Labs, testssl.sh)" },
  "V-IF-S-001": { "verification": "Hardware authentication testing with unauthorized devices" }
}
```

---

## Mitigation / Verification Mapping per Element Group

Assign `mitigations[]` and `verifications[]` per group, not per individual template.
~15 groups cover all ~40 templates.

| Group | Example IDs | Mitigations | Verifications |
|---|---|---|---|
| S — ExternalEntity | T-S-001, S-EE-001 | M-S-001, M-S-002, M-S-004 | V-S-001, V-S-002 |
| S — Process | S-P-001..003 | M-S-001, M-S-003 | V-S-001, V-S-004 |
| S — PhysicalInterface | S-IF-001 | M-S-001, M-IF-S-001 | V-S-001, V-IF-S-001 |
| T — DataFlow | T-DF-001..002 | M-T-001, M-T-002 | V-T-001, V-T-002 |
| T — DataStore | T-DS-001..002 | M-T-001, M-T-003 | V-T-001, V-T-003 |
| T — Process | T-P-001..002 | M-T-001, M-T-002, M-T-004 | V-T-001, V-T-004 |
| T — PhysicalInterface | T-IF-001 | M-IF-T-001..004 | V-IF-T-001 |
| R — all | R-EE-001, R-P-001..002, R-DS-001 | M-R-001, M-R-002 | V-R-001, V-R-002, V-R-003 |
| I — DataFlow | I-DF-001..002 | M-I-001, M-I-002 | V-I-001, V-I-002 |
| I — DataStore | I-DS-001..002 | M-I-001, M-I-003, M-I-004 | V-I-001, V-I-003 |
| I — Process | I-P-001..002 | M-I-002, M-I-005 | V-I-001, V-I-004 |
| I — PhysicalInterface | I-IF-001 | M-IF-I-001..002 | V-IF-I-001 |
| D — all elements | D-P-001..002, D-DF-001, D-DS-001..002 | M-D-001..005 | V-D-001..004 |
| D — PhysicalInterface | D-IF-001 | M-IF-D-001..002 | V-IF-D-001 |
| E — Process | E-P-001..003 | M-E-001..005 | V-E-001..003 |
| E — PhysicalInterface | E-IF-001..002 | M-E-006, M-IF-E-001..003 | V-E-004, V-IF-E-001..002 |

For interaction templates, map the same mitigation groups by strideCategory +
perspective (sender/receiver may differ slightly for S and R).

---

## Service Changes

### Localization — replaces hardcoded EN/DE lookups

```typescript
// Element template threat text
function getLocalizedElementThreat(templateId: string): string {
  return t(`${templateId}.threat`, { ns: 'element-templates' });
}

// Interaction template — i18next resolves {{sourceName}} etc. natively
function getLocalizedInteractionThreat(
  templateId: string,
  placeholders: InteractionTemplatePlaceholders
): string {
  return t(`${templateId}.threat`, {
    ns: 'interaction-templates',
    ...placeholders,   // sourceName, targetName, dataFlowName, trustBoundaryName
  });
}

// Mitigation text
function getLocalizedMitigation(mitigationId: string): string {
  return t(`${mitigationId}.mitigation`, { ns: 'mitigations' });
}

// Verification text
function getLocalizedVerification(verificationId: string): string {
  return t(`${verificationId}.verification`, { ns: 'verifications' });
}
```

### Resolving refs for a generated threat

```typescript
// Called by generator after creating a threat from a template
function resolveMitigationsForTemplate(
  template: ElementTemplate | InteractionTemplate
): ResolvedMitigation[] {
  return template.mitigations.map(id => ({
    id,
    text: getLocalizedMitigation(id),
  }));
}

function resolveVerificationsForTemplate(
  template: ElementTemplate | InteractionTemplate
): ResolvedVerification[] {
  return template.verifications.map(id => ({
    id,
    text: getLocalizedVerification(id),
  }));
}
```

> **Note:** `getBestMitigation(strideCategory)` from the earlier Block 4 draft
> is **not implemented** — superseded by explicit template refs.
> `applyTemplatePlaceholders()` regex engine is **removed** — superseded by
> i18next interpolation.

### Context filtering (prep for Step 4, wired but not activated yet)

```typescript
interface TemplateContext {
  industry?:  Array<"ot_ics" | "automotive" | "medical" | "financial" | "generic">;
  platform?:  Array<"embedded" | "iot" | "cloud" | "web" | "generic">;
  standards?: Array<"iec_62443" | "iso_21434" | "eu_cra" | "en_50742">;
}

// AND across keys, OR within a key — empty/missing = universal
function matchesContext(
  templateCtx: TemplateContext,
  projectSettings: ProjectSettings
): boolean {
  const { industry, platform, standards } = templateCtx;
  if (industry?.length && !industry.includes(projectSettings.industry)) return false;
  if (platform?.length && !platform.includes(projectSettings.platform)) return false;
  if (standards?.length && !standards.some(s => projectSettings.standards.includes(s))) return false;
  return true;
}
```

Step 4 activates this filter in the generator. Here it is implemented and tested
but the generator still loads all templates regardless of context.

---

## Generated Threat Data Model Addition

The generator now populates two new fields on each created `Threat`:

```typescript
interface Threat {
  // ... existing fields ...

  /** IDs from catalog — the full set proposed by the template (1-n) */
  proposedMitigations: string[];

  /** IDs from catalog — the full set proposed by the template (1-n) */
  proposedVerifications: string[];

  // Risk Tab (Step 5) will add:
  // confirmedMitigations: string[];
  // confirmedVerifications: string[];
}
```

`proposedMitigations` / `proposedVerifications` are set once at generate time
and not modified during Threat Eval. The analyst selects from them in the Risk Tab.

---

## Migration Script (one-time)

A Node.js migration script performs the transformation in CI or locally:

```
scripts/migrate-catalog-to-i18n.ts
```

Steps:
1. Read `threat-catalog.json` — split into `element-templates.json`,
   `mitigations.json`, `verifications.json`
2. Read `interaction-templates.ts` (parse as text / AST) — extract template
   data arrays into `interaction-templates.json`
3. Extract all `threat`/`threatDE`/`attack`/`attackDE` fields →
   write to `en/element-templates.json` + `de/element-templates.json`
4. Extract interaction strings → `en/interaction-templates.json` + `de/`
5. Extract `mitigation`/`mitigationDE` → `en/mitigations.json` + `de/`
6. Extract `verification`/`verificationDE` → `en/verifications.json` + `de/`
7. Add `context: {}` to all entries (universal default)
8. Add `mitigations[]` + `verifications[]` per group mapping table (from above)

---

## Key Files

```
src/features/threats/services/
  element-templates.json                 ← new (from threat-catalog.json threatTemplates)
  interaction-templates.json             ← new (from interaction-templates.ts data)
  mitigations.json                       ← new (from threat-catalog.json mitigationTemplates)
  verifications.json                     ← new (from threat-catalog.json verificationTemplates)
  threat-catalog-service.ts              ← update all localization functions
  interaction-templates.ts               ← keep types only; remove all data + string helpers

src/i18n/locales/en/
  element-templates.json                 ← new
  interaction-templates.json             ← new
  mitigations.json                       ← new
  verifications.json                     ← new

src/i18n/locales/de/
  element-templates.json                 ← new
  interaction-templates.json             ← new
  mitigations.json                       ← new
  verifications.json                     ← new

src/features/threats/models/threat-types.ts
  ← add proposedMitigations: string[]
  ← add proposedVerifications: string[]

scripts/
  migrate-catalog-to-i18n.ts             ← one-time migration script
```

---

## Definition of Done

- [ ] Migration script runs without errors; output files are valid JSON
- [ ] `element-templates.json`, `interaction-templates.json`, `mitigations.json`,
      `verifications.json` contain no translatable strings
- [ ] All four namespace pairs exist in `en/` and `de/`
- [ ] Every element template has `mitigations[]` (≥1 entry) and `verifications[]` (≥1 entry)
- [ ] Every interaction template has `mitigations[]` (≥1) and `verifications[]` (≥1)
- [ ] `getLocalizedElementThreat()` uses i18next namespace `element-templates`
- [ ] `getLocalizedInteractionThreat()` uses i18next with placeholder interpolation
- [ ] `applyTemplatePlaceholders()` regex engine removed
- [ ] `getBestMitigation(strideCategory)` not implemented (was superseded)
- [ ] `matchesContext()` implemented and unit-tested; generator not yet filtered
- [ ] `Threat` model has `proposedMitigations: string[]` and `proposedVerifications: string[]`
- [ ] Generator populates `proposedMitigations` + `proposedVerifications` on every generated threat
- [ ] Existing EN/DE display unchanged — regression test passes
- [ ] `threat-catalog.json` deleted after migration
