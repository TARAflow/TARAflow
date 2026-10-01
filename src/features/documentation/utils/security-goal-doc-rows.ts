// src/features/documentation/utils/security-goal-doc-rows.ts
//
// Security-goal table for the report — one row per (asset × goal) that is
// active or deliberately excluded.
//
// The asset inventory only lists goal codes ("C, I, A"). An auditor needs more:
// how strong the protection need is, whether it was derived or decided by the
// analyst, and on what basis. IEC 62443-4-1 in particular expects a rationale
// whenever the analyst deviates from the derivation — an exclusion included.
//
// Rows come from goalStates() — the single domain truth the goal cards, the
// asset table and the validation consume (design doc §4.1). The "Source"
// column carries the state (derived / provisional / minimum level / assessment
// required / adjusted / added / excluded, plus a changed basis); the basis of
// a derived level is the goal's levelReason, i.e. explainLevel() on the goal's
// EFFECTIVE ratings, so the report cannot explain a level with a reason the
// tool did not actually use.
//
// Pure and format-agnostic: every generator (template-based and pdfmake) renders
// these rows, so the content is identical across formats.

import type { DocLanguage } from "../models/doc-types";
import type { Asset } from "../../assets/models/asset-types";
import type {
  ImpactRating,
  ImpactScaleType,
} from "../../assets/models/asset-impact-types";
import type {
  CIANAAALevel,
  SecurityGoal,
  SecurityGoalType,
} from "../../assets/models/asset-security-goals-types";
import { SECURITY_GOALS } from "../../assets/models/asset-security-goals-types";
import {
  goalStates,
  severityFor,
  type GoalState,
} from "../../assets/services/asset-goal-state";
import { goalSourceKey } from "../../assets/utils/goal-badges";

type Lang = DocLanguage;

export interface SecurityGoalDocRow {
  asset: string;
  goal: string;
  level: string;
  source: string;
  basis: string;
  consequence: string;
  /** Deliberately excluded goal — renderers may set the row apart. */
  excluded: boolean;
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
    source: {
      suggested: "Derived",
      adjusted: "Adjusted",
      added: "Added",
      excluded: "Excluded",
      legacy: "Earlier decision",
    },
    assessment: {
      provisional: "provisional",
      "no-applicable-impact": "minimum level",
      missing: "assessment required",
    },
    impactAdjusted: "impact adjusted",
    review: "review",
    changed: "suggestion changed",
    stale: {
      "suggestion-removed": "no longer suggested",
      "suggestion-added": "now also suggested",
      "level-raised": "suggested level raised to {level}",
      "level-lowered": "suggested level lowered to {level}",
      "basis-changed": "suggestion rests on a different basis",
    },
    assessmentRequired: "Assessment required",
    noRationale: "(no rationale given)",
    via: "Relations",
    driver: "Level from",
    naFloor: "not applicable → minimum level",
    fallback: "no goal-specific criterion rated; highest rated criterion",
    floor: "no impact rated → minimum level",
    suggestion: "Suggestion",
    rationale: "Rationale",
    goalImpact: "Impact of this goal",
    asset: "asset",
    exceeds: "exceeds asset value",
  },
  de: {
    source: {
      suggested: "Abgeleitet",
      adjusted: "Angepasst",
      added: "Hinzugefügt",
      excluded: "Ausgeschlossen",
      legacy: "Frühere Entscheidung",
    },
    assessment: {
      provisional: "vorläufig",
      "no-applicable-impact": "Mindeststufe",
      missing: "Bewertung erforderlich",
    },
    impactAdjusted: "Impact angepasst",
    review: "prüfen",
    changed: "Vorschlag geändert",
    stale: {
      "suggestion-removed": "nicht mehr vorgeschlagen",
      "suggestion-added": "jetzt auch vorgeschlagen",
      "level-raised": "vorgeschlagene Stufe auf {level} gestiegen",
      "level-lowered": "vorgeschlagene Stufe auf {level} gesunken",
      "basis-changed": "Vorschlag beruht auf anderer Grundlage",
    },
    assessmentRequired: "Bewertung erforderlich",
    noRationale: "(keine Begründung angegeben)",
    via: "Beziehungen",
    driver: "Stufe aus",
    naFloor: "nicht anwendbar → Mindeststufe",
    fallback: "kein zielspezifisches Kriterium bewertet; höchstes bewertetes Kriterium",
    floor: "kein Impact bewertet → Mindeststufe",
    suggestion: "Vorschlag",
    rationale: "Begründung",
    goalImpact: "Impact dieses Ziels",
    asset: "Asset",
    exceeds: "über Asset-Wert",
  },
} as const;

function criterionName(id: string, lang: Lang): string {
  return CRITERION_NAMES[lang][id] ?? id;
}

const ratingText = (v: ImpactRating["value"] | undefined): string =>
  v === "na" ? "n/a" : typeof v === "number" ? String(v) : "-";

// ==================== SOURCE (state from 4.1) ====================

/**
 * The goal's state in one cell: who decided (derived / adjusted / added /
 * excluded), what a derived level rests on, a per-goal impact, and — for a
 * manual decision whose basis changed — the reason, graded like the finding
 * (review = warning, suggestion changed = info).
 */
function sourceText(state: GoalState, goal: SecurityGoal, lang: Lang): string {
  const tx = TEXT[lang];
  const key = goalSourceKey(state);
  let text: string = tx.source[key];
  if (key === "suggested" && state.assessment !== "assessed") {
    text += ` (${tx.assessment[state.assessment]})`;
  }
  if (goal.level !== "none" && state.impactOverrides.length > 0) {
    text += `, ${tx.impactAdjusted}`;
  }
  if (state.stale) {
    const warning = severityFor(state.stale, goal.level === "none") === "warning";
    const reason = tx.stale[state.stale].replace(
      "{level}",
      LEVEL_NAMES[lang][state.suggestion.level],
    );
    text += ` — ${warning ? tx.review : tx.changed}: ${reason}`;
  }
  return text;
}

// ==================== BASIS ====================

/** Relations + the criterion that drives the level (on the goal's EFFECTIVE ratings). */
function derivedBasis(state: GoalState, lang: Lang): string[] {
  const tx = TEXT[lang];
  const parts: string[] = [];
  if (state.suggestionReasons.length > 0) {
    parts.push(`${tx.via}: ${state.suggestionReasons.join(", ")}`);
  }
  const e = state.levelReason;
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
  return parts;
}

/**
 * A deviation is justified by the analyst's rationale (missing → flagged); a
 * goal that deviates from nothing is explained by the derivation. A per-goal
 * impact is listed with the asset value it deviates from.
 */
function basisText(
  asset: Asset,
  state: GoalState,
  goal: SecurityGoal,
  lang: Lang,
): string {
  const tx = TEXT[lang];
  const rationale = goal.rationale?.trim();
  const manual = state.source === "manual";
  const parts: string[] = [];

  if (manual && (state.rationaleRequired || rationale)) {
    parts.push(rationale || tx.noRationale);
    if (state.suggestion.suggested && goal.level !== state.suggestion.level) {
      parts.push(`${tx.suggestion}: ${LEVEL_NAMES[lang][state.suggestion.level]}`);
    }
  } else if (state.source !== "legacy") {
    parts.push(...derivedBasis(state, lang));
  }

  if (goal.level !== "none" && state.impactOverrides.length > 0) {
    const impact = (goal.impactRatings ?? [])
      .map((o) => {
        const assetValue = (asset.impactRatings ?? []).find(
          (r) => r.criterionId === o.criterionId,
        )?.value;
        const note = state.exceedsAsset.includes(o.criterionId)
          ? `${tx.exceeds} ${ratingText(assetValue)}`
          : `${tx.asset}: ${ratingText(assetValue)}`;
        return `${criterionName(o.criterionId, lang)} = ${ratingText(o.value)} (${note})`;
      })
      .join(", ");
    parts.push(`${tx.goalImpact}: ${impact}`);
    if (!manual) parts.push(`${tx.rationale}: ${rationale || tx.noRationale}`);
  }

  return parts.length > 0 ? parts.join("; ") : "-";
}

// ==================== TABLE LABELS ====================

/** Intro sentence — the text templates carry the same wording inline. */
const INTRO: Record<Lang, string> = {
  en: "Security goals per asset, including deliberately excluded ones. Derived = proposed from DFD relations and impact ratings; Adjusted / Added / Excluded = analyst decision, justified in the basis column; \"review\" marks a decision whose basis has changed since it was made.",
  de: "Schutzziele je Asset, einschliesslich bewusst ausgeschlossener. Abgeleitet = aus DFD-Beziehungen und Impact-Bewertung vorgeschlagen; Angepasst / Hinzugefügt / Ausgeschlossen = Entscheidung des Analysten, begründet in der Spalte Grundlage; „prüfen“ markiert eine Entscheidung, deren Grundlage sich seither geändert hat.",
};

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
        intro: INTRO.de,
        headers: ["Asset", "Schutzziel", "Stufe", "Quelle", "Grundlage", "Schadensfolge"],
      }
    : {
        title: "Security Goals",
        intro: INTRO.en,
        headers: ["Asset", "Security Goal", "Level", "Source", "Basis", "Consequence"],
      };
}

// ==================== ROWS ====================

/**
 * One row per asset × goal that is active (level ≠ "none") or deliberately
 * excluded (invariant C: an exclusion is an audit-relevant decision and must
 * not be missing from the report). In asset order and the canonical goal
 * order (SECURITY_GOALS). Built from goalStates() — the same domain truth as
 * the goal cards, the asset table and the validation. An empty result means
 * the table is omitted.
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
    const goals = asset.securityGoals ?? [];
    const states = goalStates(asset, impactScale);
    const entries = goals
      .map((goal, i) => ({ goal, state: states[i] }))
      .filter(
        ({ goal, state }) => goal.level !== "none" || state.visibility === "excluded",
      )
      .sort((a, b) => order.indexOf(a.goal.type) - order.indexOf(b.goal.type));

    for (const { goal, state } of entries) {
      const excluded = state.visibility === "excluded";
      rows.push({
        asset: asset.name,
        goal: `${GOAL_NAMES[lang][goal.type]} (${goal.type})`,
        level: excluded
          ? "-"
          : state.displayLevel
            ? LEVEL_NAMES[lang][state.displayLevel]
            : tx.assessmentRequired,
        source: sourceText(state, goal, lang),
        basis: basisText(asset, state, goal, lang),
        consequence: goal.consequence?.trim() || "-",
        excluded,
      });
    }
  }

  return rows;
}
