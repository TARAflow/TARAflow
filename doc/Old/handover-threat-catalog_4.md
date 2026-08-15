# Handover — Block 3: Threat Catalog & Templates → Translatable JSON

## Project Context

**TARAflow** — Electron + React/TypeScript threat modeling tool (TARA).
**Stack:** Electron, React, TypeScript, MUI, Vite, i18next.

---

## Current State

### Threat Catalog (`threat-catalog.json`)
Single file mixing three entry types with hardcoded `en`/`de` fields:
```json
{ "threatTemplates": [ { "id": "T-S-001", "threat": "...", "threatDE": "..." } ],
  "mitigationTemplates": [ { "id": "M-S-001", "mitigation": "...", "mitigationDE": "..." } ],
  "verificationTemplates": [ { "id": "V-S-001", "verification": "...", "verificationDE": "..." } ]
}
```

Threats, mitigations, and verifications are **only loosely coupled via `strideCategory`** —
no explicit link from a specific threat to its applicable mitigations/verifications.

### Interaction Templates (`interaction-templates.ts`)
TypeScript file with hardcoded bilingual strings and **mitigation texts embedded as string
arrays** — completely separate from the `M-xxx` entries in `threat-catalog.json`:
```typescript
{
  id: "S-INT-IN-001",
  threat: "Sender spoofing: ...",   threatDE: "...",
  suggestedMitigations: ["Implement mutual TLS...", ...],      // ← plain strings, not IDs
  suggestedMitigationsDE: ["Gegenseitige TLS...", ...],
}
```

### Problems
1. Adding a third language (FR, IT) requires code changes in multiple places
2. No explicit Threat → Mitigation → Verification linkage (only category-level)
3. Mitigation texts for interaction threats are duplicated and not reusable
4. No context filtering — same templates for OT/ICS, embedded, web apps
5. Non-developer maintenance is not possible

---

## Goal

1. Split `threat-catalog.json` into three language-neutral catalog files
2. Split `interaction-templates.ts` into a language-neutral catalog file
3. Move all translatable strings into per-language i18n namespace files
4. Add explicit `mitigations[]` / `verifications[]` reference arrays to each template
5. Add `context` field to templates for platform/industry/standards filtering
6. Enable new languages without code changes

---

## Target File Structure

### Language-neutral catalog files (data only, no translatable strings)

```
src/features/threats/services/
  element-templates.json        ← was: threat-catalog.json "threatTemplates" section
  interaction-templates.json    ← was: interaction-templates.ts (strings extracted)
  mitigations.json              ← was: threat-catalog.json "mitigationTemplates" section
  verifications.json            ← was: threat-catalog.json "verificationTemplates" section
```

### i18n namespace files (translatable strings only)

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

---

## Catalog Schema

### `element-templates.json`

```json
{
  "version": "2.0.0",
  "elementTemplates": [
    {
      "id": "T-S-001",
      "strideCategory": "S",
      "elementTypes": ["ExternalEntity"],
      "context": {
        "industry": [],
        "platform": [],
        "standards": []
      },
      "mitigations": ["M-S-001", "M-S-002", "M-S-004"],
      "verifications": ["V-S-001", "V-S-002"],
      "isCustom": false
    },
    {
      "id": "T-DF-001",
      "strideCategory": "T",
      "elementTypes": ["DataFlow"],
      "context": {},
      "mitigations": ["M-T-001", "M-T-002"],
      "verifications": ["V-T-001", "V-T-004"],
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
      "id": "T-INT-OUT-001",
      "strideCategory": "T",
      "perspective": "sender",
      "context": {
        "platform": ["embedded", "iot"],
        "standards": ["iec_62443"]
      },
      "mitigations": ["M-T-001", "M-T-002", "M-IF-T-001"],
      "verifications": ["V-T-001", "V-IF-T-001"],
      "isCustom": false
    }
  ]
}
```

> **Note on `perspective`:**
> - `"receiver"` = threat from the perspective of the receiving element (incoming flow)
> - `"sender"` = threat from the perspective of the sending element (outgoing flow)

### `mitigations.json`

```json
{
  "version": "2.0.0",
  "mitigations": [
    {
      "id": "M-S-001",
      "strideCategory": "S",
      "context": {},
      "isCustom": false
    },
    {
      "id": "M-IF-T-001",
      "strideCategory": "T",
      "context": {
        "platform": ["embedded", "iot"]
      },
      "isCustom": false
    }
  ]
}
```

### `verifications.json`

```json
{
  "version": "2.0.0",
  "verifications": [
    {
      "id": "V-S-001",
      "strideCategory": "S",
      "context": {},
      "isCustom": false
    }
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
  },
  "T-DF-001": {
    "threat": "Datenmanipulation während der Übertragung",
    "attack": "Angreifer fängt Daten ab und modifiziert sie während der Übertragung"
  }
}
```

### `en/interaction-templates.json`
Interaction templates use **i18next interpolation syntax** (`{{sourceName}}`) — these
are preserved verbatim in the translation values and resolved at runtime by the
placeholder engine.

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

> **Important:** i18next uses `{{key}}` interpolation natively. The placeholder
> `{{sourceName}}` will be passed as an i18next interpolation variable. The
> placeholder engine (`applyTemplatePlaceholders`) is **replaced** by i18next's
> own interpolation — no separate regex substitution needed.

### `en/mitigations.json`

```json
{
  "M-S-001": { "mitigation": "Implement multi-factor authentication (MFA)" },
  "M-S-002": { "mitigation": "Use PKI systems and digital certificates" },
  "M-IF-T-001": { "mitigation": "Physical tamper detection and secure boot mechanisms" }
}
```

### `de/mitigations.json`

```json
{
  "M-S-001": { "mitigation": "Multi-Faktor-Authentifizierung (MFA) implementieren" },
  "M-S-002": { "mitigation": "PKI-Systeme und digitale Zertifikate verwenden" },
  "M-IF-T-001": { "mitigation": "Physische Manipulationserkennung und Secure Boot-Mechanismen" }
}
```

### `en/verifications.json`

```json
{
  "V-S-001": { "verification": "Penetration testing for authentication bypass" },
  "V-T-001": { "verification": "Integrity check validation testing" }
}
```

### `de/verifications.json`

```json
{
  "V-S-001": { "verification": "Penetrationstests für Authentifizierungsumgehung" },
  "V-T-001": { "verification": "Integritätsprüfungsvalidierungstests" }
}
```

---

## Context Field for Filtering

```typescript
interface TemplateContext {
  industry?:  Array<"ot_ics" | "automotive" | "medical" | "financial" | "generic">;
  platform?:  Array<"embedded" | "iot" | "cloud" | "web" | "generic">;
  standards?: Array<"iec_62443" | "iso_21434" | "eu_cra" | "en_50742">;
}
```

**Filtering rules:**
- Missing key or empty array → universal (shown for every project)
- Non-empty array → shown only when project context matches **at least one** value
- Multiple non-empty keys → **all** keys must match (AND logic across keys, OR within a key)

**Examples:**
```json
{ "context": {} }                                                    // universal
{ "context": { "industry": ["ot_ics"] } }                          // OT/ICS only
{ "context": { "standards": ["iec_62443"] } }                      // IEC 62443 projects only
{ "context": { "platform": ["embedded"], "standards": ["iec_62443"] } } // both must match
```

---

## ProjectSettings (prerequisite for context filtering)

```typescript
interface ProjectSettings {
  platform:  "embedded" | "iot" | "cloud" | "web" | "generic";
  industry:  "ot_ics" | "automotive" | "medical" | "financial" | "generic";
  standards: Array<"iec_62443" | "iso_21434" | "eu_cra" | "en_50742">;
}
```

Configured in `GeneralTab` (Phase 0). Stored on `Project`. Used by catalog service
at generate-time to filter applicable templates.

---

## Catalog Service Changes

### Localization (replaces hardcoded EN/DE lookups)

```typescript
// Before
function getLocalizedThreat(template: ThreatTemplate, locale: string): string {
  return locale === 'de' ? template.threatDE : template.threat;
}

// After — element templates
function getLocalizedThreat(templateId: string, locale: string): string {
  return t(`${templateId}.threat`, { ns: 'element-templates' });
}

// After — interaction templates (i18next resolves {{sourceName}} etc.)
function getLocalizedInteractionThreat(
  templateId: string,
  placeholders: InteractionTemplatePlaceholders
): string {
  return t(`${templateId}.threat`, {
    ns: 'interaction-templates',
    sourceName: placeholders.sourceName,
    targetName: placeholders.targetName,
    dataFlowName: placeholders.dataFlowName,
    trustBoundaryName: placeholders.trustBoundaryName,
  });
}
```

> **Note:** The existing `applyTemplatePlaceholders()` regex engine in
> `interaction-templates.ts` is **superseded** by i18next interpolation.
> It can be removed once migration is complete.

### Context filtering

```typescript
function matchesContext(
  templateContext: TemplateContext,
  projectSettings: ProjectSettings
): boolean {
  const { industry, platform, standards } = templateContext;
  if (industry?.length && !industry.includes(projectSettings.industry)) return false;
  if (platform?.length && !platform.includes(projectSettings.platform)) return false;
  if (standards?.length && !standards.some(s => projectSettings.standards.includes(s))) return false;
  return true;
}

function getApplicableElementTemplates(
  project: ProjectSettings,
  strideCategory: StrideCategory,
  elementType: DFDElementType
): ElementTemplate[] {
  return ALL_ELEMENT_TEMPLATES.filter(t =>
    t.strideCategory === strideCategory &&
    t.elementTypes.includes(elementType) &&
    matchesContext(t.context, project)
  );
}

function getApplicableInteractionTemplates(
  project: ProjectSettings,
  strideCategory: StrideCategory,
  perspective: "sender" | "receiver"
): InteractionTemplate[] {
  return ALL_INTERACTION_TEMPLATES.filter(t =>
    t.strideCategory === strideCategory &&
    t.perspective === perspective &&
    matchesContext(t.context, project)
  );
}
```

### Resolving mitigations and verifications for a template

```typescript
function getMitigationsForTemplate(
  template: ElementTemplate | InteractionTemplate,
  locale: string
): string[] {
  return template.mitigations.map(id =>
    t(`${id}.mitigation`, { ns: 'mitigations' })
  );
}

function getVerificationsForTemplate(
  template: ElementTemplate | InteractionTemplate,
  locale: string
): string[] {
  return template.verifications.map(id =>
    t(`${id}.verification`, { ns: 'verifications' })
  );
}
```

---

## Migration Path

### Phase 0 — ProjectSettings
Add `ProjectSettings` fields (platform, industry, standards) to `GeneralTab`.
Persist on `Project`. No catalog changes yet.

### Phase 1 — Split catalogs
Extract the three sections of `threat-catalog.json` into separate files:
- `element-templates.json` (from `threatTemplates`)
- `mitigations.json` (from `mitigationTemplates`)
- `verifications.json` (from `verificationTemplates`)

Extract `interaction-templates.ts` template data into `interaction-templates.json`.

At this stage all files still carry EN/DE fields (no regression, nothing broken).

### Phase 2 — Add explicit references
Add `mitigations[]` and `verifications[]` arrays to every entry in
`element-templates.json` and `interaction-templates.json`.
Replace the embedded mitigation string arrays in `interaction-templates.ts`
with the ID references.

Mapping guide (strideCategory → default refs as starting point, then refine per-template):

| Element Template | Default mitigations | Default verifications |
|---|---|---|
| `T-S-xxx` (ExternalEntity) | M-S-001, M-S-002, M-S-004 | V-S-001, V-S-002 |
| `T-S-xxx` (Process) | M-S-001, M-S-003 | V-S-001, V-S-004 |
| `T-T-xxx` (DataFlow) | M-T-001, M-T-002 | V-T-001, V-T-002 |
| `T-T-xxx` (DataStore) | M-T-001, M-T-003 | V-T-001, V-T-003 |
| `T-IF-xxx` (PhysicalInterface) | M-IF-T-001..004 | V-IF-T-001 |
| ... | ... | ... |

### Phase 3 — Extract to i18n
Extract all translatable strings from the catalog files into the four i18n
namespace pairs (en/de):
- Remove `threat`, `threatDE`, `attack`, `attackDE` from `element-templates.json`
- Remove `threat`, `threatDE`, `attack`, `attackDE` from `interaction-templates.json`
- Remove `mitigation`, `mitigationDE` from `mitigations.json`
- Remove `verification`, `verificationDE` from `verifications.json`

Update `getLocalizedThreat()` and all display helpers to use i18next.
Remove `applyTemplatePlaceholders()` regex engine; use i18next interpolation.

### Phase 4 — Context field
Add `context: {}` to all templates (default = universal).
Activate `getApplicableTemplates()` filtering in the generator service.
Add at least 5 OT/ICS specific templates as proof of concept.

---

## Key Files

```
src/features/threats/services/
  element-templates.json                ← new name; remove EN/DE fields; add context + refs
  interaction-templates.json            ← new file; extracted from .ts; remove EN/DE; add refs
  mitigations.json                      ← new file; extracted from threat-catalog.json
  verifications.json                    ← new file; extracted from threat-catalog.json
  threat-catalog-service.ts             ← update localization + filter functions
  interaction-templates.ts              ← keep type definitions only; remove data + string helpers

src/i18n/locales/en/
  element-templates.json                ← new
  interaction-templates.json            ← new (with {{placeholder}} values)
  mitigations.json                      ← new
  verifications.json                    ← new

src/i18n/locales/de/
  element-templates.json                ← new
  interaction-templates.json            ← new
  mitigations.json                      ← new
  verifications.json                    ← new

src/features/overview/components/
  general-tab.tsx                       ← add ProjectSettings UI fields
```

---

## Definition of Done

- [ ] `ProjectSettings` (platform / industry / standards) in `GeneralTab` + persisted on `Project`
- [ ] `element-templates.json` — language-neutral, with `context` and `mitigations[]` / `verifications[]`
- [ ] `interaction-templates.json` — language-neutral, same structure, `perspective` field retained
- [ ] `mitigations.json` — language-neutral with `context`
- [ ] `verifications.json` — language-neutral with `context`
- [ ] `en/element-templates.json` + `de/element-templates.json` — all threat + attack strings
- [ ] `en/interaction-templates.json` + `de/interaction-templates.json` — strings with `{{placeholder}}` values
- [ ] `en/mitigations.json` + `de/mitigations.json` — all mitigation strings
- [ ] `en/verifications.json` + `de/verifications.json` — all verification strings
- [ ] `getLocalizedThreatText()` uses i18next (namespace `element-templates` or `interaction-templates`)
- [ ] `getMitigationsForTemplate()` uses i18next (namespace `mitigations`)
- [ ] `getVerificationsForTemplate()` uses i18next (namespace `verifications`)
- [ ] `applyTemplatePlaceholders()` regex engine removed; placeholders resolved via i18next
- [ ] `getApplicableElementTemplates()` + `getApplicableInteractionTemplates()` filter by `ProjectSettings`
- [ ] Existing EN/DE display unchanged (no regression)
- [ ] At least 5 OT/ICS specific templates (`context.industry: ["ot_ics"]`) added as proof of concept
