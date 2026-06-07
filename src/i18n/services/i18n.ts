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
//   element-threats-attacks  → threat + attack texts for element templates (merged from threats/{domain}/*)
//   interaction-threats-attacks → threat + attack texts for interaction templates (merged from threats/{domain}/*)
//   mitigations              → mitigation texts (merged from mitigations-{stride}.json)
//   verifications            → verification texts (merged from verifications-{stride}.json)
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
import enHazards from "../locales/en/hazards.json";
import enDfd from "../locales/en/dfd.json";
import enAssets from "../locales/en/assets.json";
import enThreats from "../locales/en/threats.json";
import enRisks from "../locales/en/risks.json";
import enAttacktree from "../locales/en/attacktree.json";
import enDoc from "../locales/en/doc.json";
import enAudit from "../locales/en/audit.json";
import {
  ELEMENT_THREAT_TEXTS as enElementThreatsAttacks,
  INTERACTION_THREAT_TEXTS as enInteractionThreatsAttacks,
} from "../locales/en/threats/index";
import enMitigationsSpoofing from "../locales/en/mitigations/mitigations-spoofing.json";
import enMitigationsTampering from "../locales/en/mitigations/mitigations-tampering.json";
import enMitigationsRepudiation from "../locales/en/mitigations/mitigations-repudiation.json";
import enMitigationsInformation from "../locales/en/mitigations/mitigations-information.json";
import enMitigationsDenial from "../locales/en/mitigations/mitigations-denial.json";
import enMitigationsElevation from "../locales/en/mitigations/mitigations-elevation.json";
import enMitigationsInterface from "../locales/en/mitigations/mitigations-interface.json";
import enMitigationsChipboundary from "../locales/en/mitigations/mitigations-chipboundary.json";
import enMitigationsPhysicalboundary from "../locales/en/mitigations/mitigations-physicalboundary.json";
import enVerificationsSpoofing from "../locales/en/verifications/verifications-spoofing.json";
import enVerificationsTampering from "../locales/en/verifications/verifications-tampering.json";
import enVerificationsRepudiation from "../locales/en/verifications/verifications-repudiation.json";
import enVerificationsInformation from "../locales/en/verifications/verifications-information.json";
import enVerificationsDenial from "../locales/en/verifications/verifications-denial.json";
import enVerificationsElevation from "../locales/en/verifications/verifications-elevation.json";
import enVerificationsInterface from "../locales/en/verifications/verifications-interface.json";
import enVerificationsChipboundary from "../locales/en/verifications/verifications-chipboundary.json";
import enVerificationsPhysicalboundary from "../locales/en/verifications/verifications-physicalboundary.json";

// DE namespace imports
import deCommon from "../locales/de/common.json";
import deHazards from "../locales/de/hazards.json";
import deDfd from "../locales/de/dfd.json";
import deAssets from "../locales/de/assets.json";
import deThreats from "../locales/de/threats.json";
import deRisks from "../locales/de/risks.json";
import deAttacktree from "../locales/de/attacktree.json";
import deDoc from "../locales/de/doc.json";
import deAudit from "../locales/de/audit.json";
import {
  ELEMENT_THREAT_TEXTS as deElementThreatsAttacks,
  INTERACTION_THREAT_TEXTS as deInteractionThreatsAttacks,
} from "../locales/de/threats/index";
import deMitigationsSpoofing from "../locales/de/mitigations/mitigations-spoofing.json";
import deMitigationsTampering from "../locales/de/mitigations/mitigations-tampering.json";
import deMitigationsRepudiation from "../locales/de/mitigations/mitigations-repudiation.json";
import deMitigationsInformation from "../locales/de/mitigations/mitigations-information.json";
import deMitigationsDenial from "../locales/de/mitigations/mitigations-denial.json";
import deMitigationsElevation from "../locales/de/mitigations/mitigations-elevation.json";
import deMitigationsInterface from "../locales/de/mitigations/mitigations-interface.json";
import deMitigationsChipboundary from "../locales/de/mitigations/mitigations-chipboundary.json";
import deMitigationsPhysicalboundary from "../locales/de/mitigations/mitigations-physicalboundary.json";
import deVerificationsSpoofing from "../locales/de/verifications/verifications-spoofing.json";
import deVerificationsTampering from "../locales/de/verifications/verifications-tampering.json";
import deVerificationsRepudiation from "../locales/de/verifications/verifications-repudiation.json";
import deVerificationsInformation from "../locales/de/verifications/verifications-information.json";
import deVerificationsDenial from "../locales/de/verifications/verifications-denial.json";
import deVerificationsElevation from "../locales/de/verifications/verifications-elevation.json";
import deVerificationsInterface from "../locales/de/verifications/verifications-interface.json";
import deVerificationsChipboundary from "../locales/de/verifications/verifications-chipboundary.json";
import deVerificationsPhysicalboundary from "../locales/de/verifications/verifications-physicalboundary.json";

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
    hazards: enHazards,
    dfd: enDfd,
    assets: enAssets,
    threats: enThreats,
    risks: enRisks,
    attacktree: enAttacktree,
    doc: enDoc,
    audit: enAudit,
    "element-threats-attacks": enElementThreatsAttacks,
    "interaction-threats-attacks": enInteractionThreatsAttacks,
    mitigations: {
      ...enMitigationsSpoofing,
      ...enMitigationsTampering,
      ...enMitigationsRepudiation,
      ...enMitigationsInformation,
      ...enMitigationsDenial,
      ...enMitigationsElevation,
      ...enMitigationsInterface,
      ...enMitigationsChipboundary,
      ...enMitigationsPhysicalboundary,
    },
    verifications: {
      ...enVerificationsSpoofing,
      ...enVerificationsTampering,
      ...enVerificationsRepudiation,
      ...enVerificationsInformation,
      ...enVerificationsDenial,
      ...enVerificationsElevation,
      ...enVerificationsInterface,
      ...enVerificationsChipboundary,
      ...enVerificationsPhysicalboundary,
    },
  },
  de: {
    common: deCommon,
    hazards: deHazards,
    dfd: deDfd,
    assets: deAssets,
    threats: deThreats,
    risks: deRisks,
    attacktree: deAttacktree,
    doc: deDoc,
    audit: deAudit,
    "element-threats-attacks": deElementThreatsAttacks,
    "interaction-threats-attacks": deInteractionThreatsAttacks,
    mitigations: {
      ...deMitigationsSpoofing,
      ...deMitigationsTampering,
      ...deMitigationsRepudiation,
      ...deMitigationsInformation,
      ...deMitigationsDenial,
      ...deMitigationsElevation,
      ...deMitigationsInterface,
      ...deMitigationsChipboundary,
      ...deMitigationsPhysicalboundary,
    },
    verifications: {
      ...deVerificationsSpoofing,
      ...deVerificationsTampering,
      ...deVerificationsRepudiation,
      ...deVerificationsInformation,
      ...deVerificationsDenial,
      ...deVerificationsElevation,
      ...deVerificationsInterface,
      ...deVerificationsChipboundary,
      ...deVerificationsPhysicalboundary,
    },
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
      "hazards",
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