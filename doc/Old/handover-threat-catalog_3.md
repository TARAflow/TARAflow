# Handover — Block 3: Threat Catalog & Templates → Translatable JSON

## Project Context

**TARAflow** — Electron + React/TypeScript threat modeling tool (TARA).
**Stack:** Electron, React, TypeScript, MUI, Vite, i18next.

---

## Current State

### Threat Catalog (`threat-catalog.json`)
Static JSON with hardcoded `en`/`de` fields per entry:
```json
{
  "id": "T-S-001",
  "strideCategory": "S",
  "threat": "Attacker impersonates a legitimate user...",
  "threatDE": "Ein Angreifer gibt sich als legitimer Benutzer aus...",
  "attack": "...",
  "attackDE": "..."
}
```

### Interaction Templates (`interaction-templates.ts`)
TypeScript file with hardcoded bilingual strings:
```typescript
{
  id: "S-INT-IN-001",
  threat: "Sender spoofing: Attacker impersonates {{sourceName}}...",
  threatDE: "Sender-Spoofing: Angreifer gibt sich als {{sourceName}} aus...",
}
```

### Problem
- Adding a third language (FR, IT) requires code changes
- Catalog entries cannot be maintained by non-developers
- No context filtering — same templates for OT/ICS and web apps

---

## Goal

1. Move all translatable strings out of data structures into i18n namespace files
2. Add `context` field to templates for platform/industry/standards filtering
3. Enable new languages without code changes

---

## Target Structure

### Catalog entries — keys only
```json
// threat-catalog.json (language-neutral)
{
  "threatTemplates": [
    {
      "id": "T-S-001",
      "strideCategory": "S",
      "elementTypes": ["Process", "ExternalEntity"],
      "context": {
        "industry": [],
        "platform": [],
        "standards": []
      }
    }
  ]
}
```

### Translations per namespace
```json
// src/i18n/locales/en/threat-catalog.json
{
  "T-S-001": {
    "threat": "Attacker impersonates a legitimate user...",
    "attack": "..."
  },
  "M-S-001": {
    "mitigation": "Implement mutual TLS authentication"
  }
}

// src/i18n/locales/de/threat-catalog.json
{
  "T-S-001": {
    "threat": "Ein Angreifer gibt sich als legitimer Benutzer aus...",
    "attack": "..."
  }
}
```

### Interaction templates — same pattern
```json
// src/i18n/locales/en/interaction-templates.json
{
  "S-INT-SND-001": {
    "threat": "Receiver spoofing: Attacker impersonates {{targetName}}...",
    "attack": "Attacker sets up rogue endpoint pretending to be {{targetName}}..."
  }
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

Empty arrays = universal (shown always).
Non-empty = shown only when project context matches at least one value.

**Examples:**
```json
{ "context": {} }                              // universal
{ "context": { "industry": ["ot_ics"] } }     // OT/ICS only
{ "context": { "standards": ["iec_62443"] } } // IEC 62443 projects only
{ "context": { "platform": ["embedded"], "standards": ["iec_62443"] } } // both must match
```

---

## ProjectSettings (required before Block 3 is useful)

```typescript
interface ProjectSettings {
  platform:  "embedded" | "iot" | "cloud" | "web" | "generic";
  industry:  "ot_ics" | "automotive" | "medical" | "financial" | "generic";
  standards: Array<"iec_62443" | "iso_21434" | "eu_cra" | "en_50742">;
}
```

Set in `GeneralTab` (Phase 0). Stored on `Project`. Used by catalog filter at
generate time.

---

## Catalog Service Changes

```typescript
// Current
function getLocalizedThreat(template: ThreatTemplate, locale: string): string {
  return locale === 'de' ? template.threatDE : template.threat;
}

// Target
function getLocalizedThreat(templateId: string, locale: string): string {
  return t(`${templateId}.threat`, { ns: 'threat-catalog' });
}

// Filter by context
function getApplicableTemplates(
  context: ProjectSettings,
  strideCategory: StrideCategory
): ThreatTemplate[] {
  return ALL_TEMPLATES.filter(t =>
    t.strideCategory === strideCategory &&
    matchesContext(t.context, context)
  );
}
```

---

## Migration Path

1. Add `ProjectSettings` to `GeneralTab` (minimal: platform + industry + standards)
2. Extract all translatable strings from `threat-catalog.json` into `en/threat-catalog.json` + `de/threat-catalog.json`
3. Extract all strings from `interaction-templates.ts` into `en/interaction-templates.json` + `de/interaction-templates.json`
4. Add `context` field to all template entries (default: empty = universal)
5. Update `getLocalizedThreatText()` to use i18next
6. Add OT/ICS specific templates for IEC 62443

---

## Key Files

```
src/features/threats/services/threat-catalog.json         ← remove EN/DE fields, add context
src/features/threats/services/interaction-templates.ts    ← extract strings to JSON
src/i18n/locales/en/threat-catalog.json                   ← new
src/i18n/locales/de/threat-catalog.json                   ← new
src/i18n/locales/en/interaction-templates.json            ← new
src/i18n/locales/de/interaction-templates.json            ← new
src/features/overview/components/general-tab.tsx          ← add ProjectSettings UI
src/features/threats/services/threat-catalog-service.ts   ← filter by context
```

---

## Definition of Done

- [ ] `ProjectSettings` (platform/industry/standards) in GeneralTab + persisted on Project
- [ ] `threat-catalog.json` language-neutral with `context` field
- [ ] `en/threat-catalog.json` + `de/threat-catalog.json` with all strings
- [ ] `interaction-templates.ts` strings extracted to JSON namespace files
- [ ] `getLocalizedThreatText()` uses i18next
- [ ] `getApplicableTemplates()` filters by ProjectSettings context
- [ ] Existing EN/DE display unchanged (no regression)
- [ ] At least 5 OT/ICS specific templates added as proof of concept
