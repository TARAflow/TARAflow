# Handover — Block 2: i18n File Splitting

## Project Context

**TARAflow** — Electron + React/TypeScript threat modeling tool (TARA).
**Stack:** Electron, React, TypeScript, MUI, Vite, i18next.

---

## Current State

Two monolithic i18n files:
- `src/i18n/locales/en.json` — ~800+ lines
- `src/i18n/locales/de.json` — ~800+ lines

Both files grow with every feature. They are becoming hard to maintain and
impossible to hand off to translators for specific features.

---

## Goal

Split into feature-scoped files loaded by i18next namespace system.
One namespace per feature, shared strings in `common`.

---

## Target Structure

```
src/i18n/locales/
  en/
    common.json        ← buttons, labels, errors shared across features
    dfd.json           ← tabs.dfd.*
    threats.json       ← tabs.threats.*
    assets.json        ← tabs.assets.*
    risks.json         ← tabs.risks.*
    overview.json      ← tabs.overview.*
    validation.json    ← dfdValidation.*
  de/
    common.json
    dfd.json
    threats.json
    assets.json
    risks.json
    overview.json
    validation.json
```

---

## Key Sections in Current en.json

```
tabs.dfd.*                    → dfd.json
tabs.threats.*                → threats.json
tabs.assets.*                 → assets.json
tabs.risks.*                  → risks.json
tabs.overview.*               → overview.json
dfdValidation.*               → validation.json
common.*  (buttons, etc.)     → common.json
```

---

## i18next Configuration Change

```typescript
// src/i18n/i18n.ts — current
import en from './locales/en.json';
import de from './locales/de.json';

i18n.init({
  resources: { en: { translation: en }, de: { translation: de } }
});

// Target
i18n.init({
  ns: ['common', 'dfd', 'threats', 'assets', 'risks', 'overview', 'validation'],
  defaultNS: 'common',
  resources: {
    en: {
      common: require('./locales/en/common.json'),
      dfd:    require('./locales/en/dfd.json'),
      // ...
    }
  }
});
```

---

## Usage Change in Components

```typescript
// Current
const { t } = useTranslation();
t("tabs.dfd.element_description.process.fields.technology.label")

// Option A — explicit namespace (breaking change in all components)
const { t } = useTranslation('dfd');
t("element_description.process.fields.technology.label")

// Option B — keep existing keys, just split the file (non-breaking)
const { t } = useTranslation();
t("tabs.dfd.element_description.process.fields.technology.label")
// i18next resolves via namespace fallback chain
```

**Recommendation: Option B first.** Keep all existing translation key strings
unchanged. Only split the JSON files and configure i18next to load multiple
namespaces with fallback. This avoids touching hundreds of `t()` calls across
the codebase.

Option A (shorter keys) can be a follow-up refactor once the split is stable.

---

## Migration Steps

1. Create `src/i18n/locales/en/` and `src/i18n/locales/de/` directories
2. Split `en.json` into namespace files (script-assisted)
3. Split `de.json` into namespace files
4. Update i18next config to load namespaces
5. Verify no missing keys (existing tests or manual check)
6. Delete old `en.json` / `de.json`

---

## Split Script Sketch

```typescript
import en from './en.json';
import fs from 'fs';

const namespaces = {
  dfd:        en.tabs?.dfd,
  threats:    en.tabs?.threats,
  assets:     en.tabs?.assets,
  risks:      en.tabs?.risks,
  overview:   en.tabs?.overview,
  validation: en.dfdValidation,
};

Object.entries(namespaces).forEach(([ns, content]) => {
  fs.writeFileSync(
    `./locales/en/${ns}.json`,
    JSON.stringify(content, null, 2)
  );
});
```

---

## Benefits

- Translators receive only the file relevant to their domain
- New features add their own namespace file without touching others
- Bundle splitting possible (lazy-load `threats.json` only when in threats tab)
- Threat catalog translations (Block 3) fit naturally as `threat-catalog.de.json`

---

## Definition of Done

- [ ] Directory structure `src/i18n/locales/en/` and `src/i18n/locales/de/` created
- [ ] All keys split into namespace files without key changes
- [ ] i18next configured with namespace array + fallback chain
- [ ] All existing `t()` calls still resolve correctly (no missing key warnings)
- [ ] Old monolithic `en.json` / `de.json` deleted
- [ ] New feature additions documented: "add keys to the relevant namespace file"
