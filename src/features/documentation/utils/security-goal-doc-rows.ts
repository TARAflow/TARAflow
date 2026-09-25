// src/features/documentation/utils/security-goal-doc-rows.ts
//
// Security-goal table for the report — one row per (asset × active goal).
//
// The asset inventory only lists goal codes ("C, I, A"). An auditor needs more:
// how strong the protection need is, whether it was derived or decided by the
// analyst, and on what basis. IEC 62443-4-1 in particular expects a rationale
// whenever the analyst deviates from the derivation.
//
// The basis of a derived goal comes from explainLevel() — the SAME function the
// deriver uses to set the level — so the report cannot explain a level with a
// reason the tool did not actually use.
//
// Pure and format-agnostic: every generator (template-based and pdfmake) renders
// these rows, so the content is identical across formats.

import type { DocLanguage } from "../models/doc-types";
import type { Asset } from "../../assets/models/asset-types";
import type { ImpactScaleType } from "../../assets/models/asset-impact-types";
import type {
  CIANAAALevel,
  SecurityGoal,
  SecurityGoalType,
} from "../../assets/models/asset-security-goals-types";
import { SECURITY_GOALS } from "../../assets/models/asset-security-goals-types";
import {
  explainLevel,
  explainSuggestion,
} from "../../assets/services/asset-cianaaa-deriver";

type Lang = DocLanguage;

export interface SecurityGoalDocRow {
  asset: string;
  goal: string;
  level: string;
  source: string;
  basis: string;
  consequence: string;
}

// ==================== LABELS ====================
// Kept in step with i18n/locales/*/assets.json (tabs.assets.securityGoals,
// cianaaa.level, impactCriteria). Hard-coded like the report templates, so the
// DOCUMENT language wins regardless of the UI language.

const GOAL_NAMES: Record<Lang, Record<SecurityGoalType, string>> = {
  en: {
    C: "Confidentiality",
    I: "Integrity",
    A: "Availability",
    N: "Non-repudiation",
    AuthZ: "Authorization",
    AuthN: "Authentication",
    Acc: "Accountability",
  },
  de: {
    C: "Vertraulichkeit",
    I: "Integrität",
    A: "Verfügbarkeit",
    N: "Nichtabstreitbarkeit",
    AuthZ: "Autorisierung",
    AuthN: "Authentifizierung",
    Acc: "Rechenschaftspflicht",
  },
};

const LEVEL_NAMES: Record<Lang, Record<CIANAAALevel, string>> = {
  en: { none: "None", low: "Low", medium: "Medium", high: "High", critical: "Critical" },
  de: { none: "Keine", low: "Niedrig", medium: "Mittel", high: "Hoch", critical: "Kritisch" },
};

const CRITERION_NAMES: Record<Lang, Record<string, string>> = {
  en: {
    financial_damage: "Financial Damage",
    regulatory_compliance: "Regulatory / Compliance",
    reputation: "Reputation / Brand",
    privacy: "Privacy / Data Protection",
    operational: "Operational Impact",
    affected_users: "Affected Users / Systems",
    recoverability: "Recoverability",
    safety: "Safety Impact",
    physical_damage: "Physical Asset Damage",
    environmental: "Environmental Impact",
    supply_chain: "Supply Chain / Logistics",
  },
  de: {
    financial_damage: "Finanzieller Schaden",
    regulatory_compliance: "Regulatorik / Compliance",
    reputation: "Reputation / Marke",
    privacy: "Datenschutz",
    operational: "Betriebliche Auswirkung",
    affected_users: "Betroffene Nutzer / Systeme",
    recoverability: "Wiederherstellbarkeit",
    safety: "Sicherheitsauswirkung",
    physical_damage: "Physischer Anlagenschaden",
    environmental: "Umweltauswirkung",
    supply_chain: "Lieferkette / Logistik",
  },
};

const TEXT = {
  en: {
    derived: "Derived",
    manual: "Manual",
    legacy: "Unspecified",
    noRationale: "(no rationale given)",
    via: "Relations",
    driver: "Level from",
    naFloor: "not applicable → minimum level",
    fallback: "no goal-specific criterion rated; highest rated criterion",
    floor: "no impact rated → minimum level",
  },
  de: {
    derived: "Abgeleitet",
    manual: "Manuell",
    legacy: "Nicht angegeben",
    noRationale: "(keine Begründung angegeben)",
    via: "Beziehungen",
    driver: "Stufe aus",
    naFloor: "nicht anwendbar → Mindeststufe",
    fallback: "kein zielspezifisches Kriterium bewertet; höchstes bewertetes Kriterium",
    floor: "kein Impact bewertet → Mindeststufe",
  },
} as const;

function criterionName(id: string, lang: Lang): string {
  return CRITERION_NAMES[lang][id] ?? id;
}

// ==================== BASIS ====================

function derivedBasis(
  asset: Asset,
  goal: SecurityGoal,
  impactScale: ImpactScaleType,
  lang: Lang,
): string {
  const tx = TEXT[lang];
  const parts: string[] = [];

  const { reasons } = explainSuggestion(asset, goal.type, impactScale);
  if (reasons.length > 0) parts.push(`${tx.via}: ${reasons.join(", ")}`);

  const e = explainLevel(goal.type, asset.impactRatings ?? [], impactScale);
  switch (e.kind) {
    case "mechanism":
      parts.push(`${tx.driver}: ${criterionName(e.criterionId, lang)} = ${e.value}`);
      break;
    case "not-applicable":
      parts.push(
        `${tx.driver}: ${e.criterionIds.map((id) => criterionName(id, lang)).join(", ")} ${tx.naFloor}`,
      );
      break;
    case "fallback":
      parts.push(
        `${tx.driver}: ${tx.fallback} (${criterionName(e.criterionId, lang)} = ${e.value})`,
      );
      break;
    case "floor":
      parts.push(`${tx.driver}: ${tx.floor}`);
      break;
  }

  return parts.join("; ");
}

// ==================== TABLE LABELS ====================
// For renderers without a template (pdfmake). The text templates carry the
// same wording inline, following the existing template convention.

export function securityGoalDocLabels(lang: Lang): {
  title: string;
  intro: string;
  headers: string[];
} {
  return lang === "de"
    ? {
        title: "Schutzziele",
        intro:
          "Aktive Schutzziele je Asset. Abgeleitet = aus DFD-Beziehungen und Impact-Bewertung vorgeschlagen; Manuell = Entscheidung des Analysten, Abweichungen vom Vorschlag sind zu begründen.",
        headers: ["Asset", "Schutzziel", "Stufe", "Quelle", "Grundlage", "Schadensfolge"],
      }
    : {
        title: "Security Goals",
        intro:
          "Active security goals per asset. Derived = proposed from DFD relations and impact ratings; Manual = analyst decision, deviations from the proposal require a rationale.",
        headers: ["Asset", "Security Goal", "Level", "Source", "Basis", "Consequence"],
      };
}

// ==================== ROWS ====================

/**
 * One row per asset × goal with level ≠ "none", in asset order and the
 * canonical goal order (SECURITY_GOALS). Assets without active goals produce
 * no rows; an empty result means the table is omitted.
 */
export function buildSecurityGoalDocRows(
  assets: Asset[],
  impactScale: ImpactScaleType,
  lang: Lang,
): SecurityGoalDocRow[] {
  const tx = TEXT[lang];
  const order = SECURITY_GOALS.map((g) => g.type);
  const rows: SecurityGoalDocRow[] = [];

  for (const asset of assets) {
    const goals = [...(asset.securityGoals ?? [])]
      .filter((g) => g.level !== "none")
      .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    for (const goal of goals) {
      let source: string;
      let basis: string;
      if (goal.source === "manual") {
        source = tx.manual;
        basis = goal.rationale?.trim() || tx.noRationale;
      } else if (goal.source === "suggested") {
        source = tx.derived;
        basis = derivedBasis(asset, goal, impactScale, lang);
      } else {
        source = tx.legacy;
        basis = "-";
      }

      rows.push({
        asset: asset.name,
        goal: `${GOAL_NAMES[lang][goal.type]} (${goal.type})`,
        level: LEVEL_NAMES[lang][goal.level],
        source,
        basis,
        consequence: goal.consequence?.trim() || "-",
      });
    }
  }

  return rows;
}
