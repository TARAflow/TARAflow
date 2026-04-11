// ==================== i18n CONFIGURATION ====================
// src/i18n/i18n.ts
//
// Namespace layout (one file per feature):
//   common      → shared strings (buttons, labels, project, settings, stride, …)
//   dfd         → tabs.dfd.* + dfdValidation.*
//   assets      → tabs.assets.*
//   threats     → tabs.threats.*
//   risks       → tabs.risks.*
//   attacktree  → tabs.attacktree.*
//   doc         → tabs.doc.*
//   audit       → audit.*
//
// All existing t() calls remain unchanged (Option B — full key paths preserved).
// i18next resolves keys via defaultNS → fallbackNS chain automatically.
//
// To add a new feature namespace:
//   1. Create src/i18n/locales/en/<feature>.json + de/<feature>.json
//   2. Add to NAMESPACES array below
//   3. Import both language files and add to resources

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// EN namespace imports
import enCommon     from '../locales/en/common.json';
import enDfd        from '../locales/en/dfd.json';
import enAssets     from '../locales/en/assets.json';
import enThreats    from '../locales/en/threats.json';
import enRisks      from '../locales/en/risks.json';
import enAttacktree from '../locales/en/attacktree.json';
import enDoc        from '../locales/en/doc.json';
import enAudit      from '../locales/en/audit.json';

// DE namespace imports
import deCommon     from '../locales/de/common.json';
import deDfd        from '../locales/de/dfd.json';
import deAssets     from '../locales/de/assets.json';
import deThreats    from '../locales/de/threats.json';
import deRisks      from '../locales/de/risks.json';
import deAttacktree from '../locales/de/attacktree.json';
import deDoc        from '../locales/de/doc.json';
import deAudit      from '../locales/de/audit.json';

// ── Namespace list ───────────────────────────────────────────────────────────
// Order matters for fallback resolution: common is last so feature namespaces
// take precedence when the same key exists in multiple files.
const NAMESPACES = [
  'dfd',
  'assets',
  'threats',
  'risks',
  'attacktree',
  'doc',
  'audit',
  'common',
] as const;

export type AppNamespace = (typeof NAMESPACES)[number];

// ── Resources ────────────────────────────────────────────────────────────────
const resources = {
  en: {
    common: enCommon,
    dfd: enDfd,
    assets: enAssets,
    threats: enThreats,
    risks: enRisks,
    attacktree: enAttacktree,
    doc: enDoc,
    audit: enAudit,
  },
  de: {
    common: deCommon,
    dfd: deDfd,
    assets: deAssets,
    threats: deThreats,
    risks: deRisks,
    attacktree: deAttacktree,
    doc: deDoc,
    audit: deAudit,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,

    // Default namespace for t() calls without explicit ns prefix.
    // All feature namespaces are in fallbackNS so keys are found regardless
    // of which file they live in — no component changes required.
    defaultNS: "common",
    ns: NAMESPACES,
    fallbackNS: [
      "dfd",
      "assets",
      "threats",
      "risks",
      "attacktree",
      "doc",
      "audit",
      "common",
    ],

    fallbackLng: "en",
    debug: process.env.NODE_ENV === "development",

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "coretm_language",
    },
  });

export default i18n;