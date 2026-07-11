// cli/i18n-node.ts
//
// Phase 3 (TARAflow CLI Report Plan) — i18next singleton in Node.
//
// Initializes the same i18next singleton instance that property-doc-mappers.ts
// references via `import { i18n } from "i18n"` (alias "i18n" → src/i18n).
// i18next holds its state globally on the default export — once it's
// initialized here via initI18nNode(), i18n.getFixedT(lang, ns) returns
// translated text anywhere in the process (including in
// property-doc-mappers.ts).
//
// DELIBERATELY NOT reused: src/i18n/i18n.ts (the UI setup). That file runs
// `.use(LanguageDetector)` — LanguageDetector reads window.navigator/
// localStorage at init time, which don't exist in Node, and would crash on
// import. The resource construction (JSON imports) is therefore duplicated
// here instead of importing it from i18n.ts.
//
// SYNC NOTE: New namespaces/JSON files added to src/i18n/i18n.ts must be
// mirrored here manually. Extracting the "resources" construction into a
// shared, platform-neutral module (imported by both UI and CLI) would
// eliminate the duplication — deliberately not done here, to avoid
// touching src/i18n/i18n.ts.
//
// FINDING (not fixed, only mirrored): "hazards" is part of the resources
// in i18n.ts but missing there from NAMESPACES and fallbackNS. The same
// state is carried over here, to guarantee identical behavior to the UI.

import i18n from "i18next";

// ==================== EN NAMESPACE IMPORTS ====================
import enCommon from "../../src/i18n/locales/en/common.json";
import enHazards from "../../src/i18n/locales/en/hazards.json";
import enDfd from "../../src/i18n/locales/en/dfd.json";
import enAssets from "../../src/i18n/locales/en/assets.json";
import enThreats from "../../src/i18n/locales/en/threats.json";
import enRisks from "../../src/i18n/locales/en/risks.json";
import enAttacktree from "../../src/i18n/locales/en/attacktree.json";
import enDoc from "../../src/i18n/locales/en/doc.json";
import enAudit from "../../src/i18n/locales/en/audit.json";
import {
  ELEMENT_THREAT_TEXTS as enElementThreatsAttacks,
  INTERACTION_THREAT_TEXTS as enInteractionThreatsAttacks,
} from "../../src/i18n/locales/en/threats/index";
import enMitigationsSpoofing from "../../src/i18n/locales/en/mitigations/mitigations-spoofing.json";
import enMitigationsTampering from "../../src/i18n/locales/en/mitigations/mitigations-tampering.json";
import enMitigationsRepudiation from "../../src/i18n/locales/en/mitigations/mitigations-repudiation.json";
import enMitigationsInformation from "../../src/i18n/locales/en/mitigations/mitigations-information.json";
import enMitigationsDenial from "../../src/i18n/locales/en/mitigations/mitigations-denial.json";
import enMitigationsElevation from "../../src/i18n/locales/en/mitigations/mitigations-elevation.json";
import enMitigationsInterface from "../../src/i18n/locales/en/mitigations/mitigations-interface.json";
import enMitigationsChipboundary from "../../src/i18n/locales/en/mitigations/mitigations-chipboundary.json";
import enMitigationsPhysicalboundary from "../../src/i18n/locales/en/mitigations/mitigations-physicalboundary.json";
import enVerificationsSpoofing from "../../src/i18n/locales/en/verifications/verifications-spoofing.json";
import enVerificationsTampering from "../../src/i18n/locales/en/verifications/verifications-tampering.json";
import enVerificationsRepudiation from "../../src/i18n/locales/en/verifications/verifications-repudiation.json";
import enVerificationsInformation from "../../src/i18n/locales/en/verifications/verifications-information.json";
import enVerificationsDenial from "../../src/i18n/locales/en/verifications/verifications-denial.json";
import enVerificationsElevation from "../../src/i18n/locales/en/verifications/verifications-elevation.json";
import enVerificationsInterface from "../../src/i18n/locales/en/verifications/verifications-interface.json";
import enVerificationsChipboundary from "../../src/i18n/locales/en/verifications/verifications-chipboundary.json";
import enVerificationsPhysicalboundary from "../../src/i18n/locales/en/verifications/verifications-physicalboundary.json";

// ==================== DE NAMESPACE IMPORTS ====================
import deCommon from "../../src/i18n/locales/de/common.json";
import deHazards from "../../src/i18n/locales/de/hazards.json";
import deDfd from "../../src/i18n/locales/de/dfd.json";
import deAssets from "../../src/i18n/locales/de/assets.json";
import deThreats from "../../src/i18n/locales/de/threats.json";
import deRisks from "../../src/i18n/locales/de/risks.json";
import deAttacktree from "../../src/i18n/locales/de/attacktree.json";
import deDoc from "../../src/i18n/locales/de/doc.json";
import deAudit from "../../src/i18n/locales/de/audit.json";
import {
  ELEMENT_THREAT_TEXTS as deElementThreatsAttacks,
  INTERACTION_THREAT_TEXTS as deInteractionThreatsAttacks,
} from "../../src/i18n/locales/de/threats/index";
import deMitigationsSpoofing from "../../src/i18n/locales/de/mitigations/mitigations-spoofing.json";
import deMitigationsTampering from "../../src/i18n/locales/de/mitigations/mitigations-tampering.json";
import deMitigationsRepudiation from "../../src/i18n/locales/de/mitigations/mitigations-repudiation.json";
import deMitigationsInformation from "../../src/i18n/locales/de/mitigations/mitigations-information.json";
import deMitigationsDenial from "../../src/i18n/locales/de/mitigations/mitigations-denial.json";
import deMitigationsElevation from "../../src/i18n/locales/de/mitigations/mitigations-elevation.json";
import deMitigationsInterface from "../../src/i18n/locales/de/mitigations/mitigations-interface.json";
import deMitigationsChipboundary from "../../src/i18n/locales/de/mitigations/mitigations-chipboundary.json";
import deMitigationsPhysicalboundary from "../../src/i18n/locales/de/mitigations/mitigations-physicalboundary.json";
import deVerificationsSpoofing from "../../src/i18n/locales/de/verifications/verifications-spoofing.json";
import deVerificationsTampering from "../../src/i18n/locales/de/verifications/verifications-tampering.json";
import deVerificationsRepudiation from "../../src/i18n/locales/de/verifications/verifications-repudiation.json";
import deVerificationsInformation from "../../src/i18n/locales/de/verifications/verifications-information.json";
import deVerificationsDenial from "../../src/i18n/locales/de/verifications/verifications-denial.json";
import deVerificationsElevation from "../../src/i18n/locales/de/verifications/verifications-elevation.json";
import deVerificationsInterface from "../../src/i18n/locales/de/verifications/verifications-interface.json";
import deVerificationsChipboundary from "../../src/i18n/locales/de/verifications/verifications-chipboundary.json";
import deVerificationsPhysicalboundary from "../../src/i18n/locales/de/verifications/verifications-physicalboundary.json";

// ==================== NAMESPACE LIST ====================
// Copied 1:1 from i18n.ts (including the missing "hazards" registration).
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

// ==================== RESOURCES ====================
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

// ==================== INIT ====================

let initialized = false;

/**
 * Initializes the i18next singleton instance for Node — without
 * LanguageDetector (window/localStorage/navigator) and without
 * initReactI18next (no React tree in the CLI).
 *
 * Idempotent: calling it more than once (e.g. in tests) does not
 * re-initialize.
 *
 * @param lng - Default language (usually overridden immediately via
 *              getFixedT(lang, ns), see below — but i18next still needs a
 *              starting value for interpolation/plural rules).
 */
export async function initI18nNode(lng: "en" | "de" = "en"): Promise<typeof i18n> {
  if (initialized) return i18n;

  await i18n.init({
    resources,
    lng,

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
    debug: false,

    interpolation: {
      escapeValue: false,
    },

    // No LanguageDetector (needs window/localStorage/navigator),
    // no initReactI18next (no React instance in the CLI).
  });

  initialized = true;
  return i18n;
}

// Re-exported for call sites that want to work with the singleton
// directly (e.g. property-doc-mappers.ts via `import { i18n } from "i18n"`).
export { i18n };