// ==================== i18n CONFIGURATION ====================
// src/i18n/i18n.ts
//
// Namespace layout (one file per feature):
//   common                   → shared strings (buttons, labels, project, settings, stride, …)
//   dfd                      → tabs.dfd.* + dfdValidation.*
//   assets                   → tabs.assets.*
//   threats                  → tabs.threats.*
//   risks                    → tabs.risks.*
//   attacktree               → tabs.attacktree.*
//   doc                      → tabs.doc.*
//   audit                    → audit.*
//
// Threat catalog namespaces (keyed by template ID, e.g. "T-S-001.threat"):
//   element-threats-attacks  → threat + attack texts for element templates
//   interaction-threats-attacks → threat + attack texts for interaction templates (with {{placeholders}})
//   mitigations              → mitigation texts
//   verifications            → verification texts
//
// All existing t() calls remain unchanged (Option B — full key paths preserved).
//
// To add a new feature namespace:
//   1. Create src/i18n/locales/en/<feature>.json + de/<feature>.json
//   2. Add to NAMESPACES array below
//   3. Import both language files and add to resources

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// EN namespace imports
import enCommon from "../locales/en/common.json";
import enDfd from "../locales/en/dfd.json";
import enAssets from "../locales/en/assets.json";
import enThreats from "../locales/en/threats.json";
import enRisks from "../locales/en/risks.json";
import enAttacktree from "../locales/en/attacktree.json";
import enDoc from "../locales/en/doc.json";
import enAudit from "../locales/en/audit.json";
import enElementThreatsAttacks from "../locales/en/element-threats-attacks.json";
import enInteractionThreatsAttacks from "../locales/en/interaction-threats-attacks.json";
import enMitigations from "../locales/en/mitigations.json";
import enVerifications from "../locales/en/verifications.json";

// DE namespace imports
import deCommon from "../locales/de/common.json";
import deDfd from "../locales/de/dfd.json";
import deAssets from "../locales/de/assets.json";
import deThreats from "../locales/de/threats.json";
import deRisks from "../locales/de/risks.json";
import deAttacktree from "../locales/de/attacktree.json";
import deDoc from "../locales/de/doc.json";
import deAudit from "../locales/de/audit.json";
import deElementThreatsAttacks from "../locales/de/element-threats-attacks.json";
import deInteractionThreatsAttacks from "../locales/de/interaction-threats-attacks.json";
import deMitigations from "../locales/de/mitigations.json";
import deVerifications from "../locales/de/verifications.json";

// ── Namespace list ────────────────────────────────────────────────────────────
const NAMESPACES = [
  "dfd",
  "assets",
  "threats",
  "risks",
  "attacktree",
  "doc",
  "audit",
  "element-threats-attacks",
  "interaction-threats-attacks",
  "mitigations",
  "verifications",
  "common",
] as const;

export type AppNamespace = (typeof NAMESPACES)[number];

// ── Resources ─────────────────────────────────────────────────────────────────
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
    "element-threats-attacks": enElementThreatsAttacks,
    "interaction-threats-attacks": enInteractionThreatsAttacks,
    mitigations: enMitigations,
    verifications: enVerifications,
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
    "element-threats-attacks": deElementThreatsAttacks,
    "interaction-threats-attacks": deInteractionThreatsAttacks,
    mitigations: deMitigations,
    verifications: deVerifications,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,

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
      "element-threats-attacks",
      "interaction-threats-attacks",
      "mitigations",
      "verifications",
      "common",
    ],

    fallbackLng: "en",
    debug: process.env.NODE_ENV === "development",

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "coretm_language",
    },
  });

export default i18n;