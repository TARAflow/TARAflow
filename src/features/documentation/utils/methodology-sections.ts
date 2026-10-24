// ==================== METHODOLOGY CHAPTER CONTENT ====================
// ISO/SAE 21434 conformance plan 0d: the report's methodology chapter, built
// ONLY from the methodology record the app layer derived (DocMethodology).
// Format-neutral: intro text plus tables; each generator renders them.

// Deep paths: the generation path imports no feature barrel (depcruise-doc).
import type { DocMethodology } from "../models/doc-types";
import {
  treatmentFallbackLabel,
  treatmentI18nKey,
  type TreatmentVocabulary,
} from "../../risks/models/risk-treatment-vocabulary";
import type { RiskTreatment } from "../../risks/models/risk-scale-types";

type TranslateFn = (key: string, defaultValue?: string) => string;

export interface MethodologySection {
  title: string;
  intro?: string;
  headers: string[];
  rows: string[][];
}

export interface MethodologyContent {
  intro: string;
  sections: MethodologySection[];
}

const K = "tabs.doc.methodology";

/** English fallbacks of the ISO impact level names (RQ-15-05), 1..4. */
const ISO_IMPACT_FALLBACK = ["Negligible", "Moderate", "Major", "Severe"];
const FEASIBILITY_FALLBACK: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  "very-low": "Very Low",
};

export function methodologyContent(m: DocMethodology, t: TranslateFn): MethodologyContent {
  const basis = t(m.presetNameKey, m.presetId);

  // ── Overview ──────────────────────────────────────────────────────────────
  const isoScale = m.impact.scale === "4-level";
  const scaleText = isoScale
    ? ISO_IMPACT_FALLBACK.map((fb, i) =>
        t(`tabs.assets.impactScaleIso.${i + 1}.label`, fb),
      ).join(", ")
    : t(`${K}.scale.${m.impact.scale}`, m.impact.scale);
  const scaleCell = m.impact.scaleConforms
    ? scaleText
    : `${scaleText} — ${t(`${K}.scaleNotConforming`, "does not conform: ISO/SAE 21434 requires four impact ratings (RQ-15-05)")}`;

  const overview: MethodologySection = {
    title: t(`${K}.overview`, "Method"),
    headers: [t(`${K}.item`, "Item"), t(`${K}.value`, "Value")],
    rows: [
      [t(`${K}.normativeBasis`, "Normative basis"), basis],
      [t(`${K}.impactScale`, "Impact rating (15.5)"), scaleCell],
      [
        t(`${K}.impactCategories`, "Impact categories"),
        m.impact.criteriaIds
          .map((id) => t(`tabs.assets.impactCriteria.${id}.name`, id))
          .join(", "),
      ],
      [
        t(`${K}.impactAggregation`, "Impact of a risk"),
        t(`${K}.aggregation.${m.impact.aggregation}`, m.impact.aggregation),
      ],
      [
        t(`${K}.likelihood`, "Likelihood (15.7)"),
        t(`${K}.likelihoodMethod.${m.likelihood.method}`, m.likelihood.method),
      ],
      [
        t(`${K}.feasibilityMethod`, "Attack feasibility rating"),
        `${t(`${K}.feasibility.${m.likelihood.feasibilityMethod}`, m.likelihood.feasibilityMethod)}; ${t(`${K}.likelihoodModel.${m.likelihood.likelihoodModel}`, m.likelihood.likelihoodModel)}`,
      ],
    ],
  };

  // ── Feasibility bands (Table G.7) ─────────────────────────────────────────
  const bands = [...m.likelihood.bands].sort((a, b) => a.minPotential - b.minPotential);
  const bandSection: MethodologySection = {
    title: t(`${K}.bands`, "Attack feasibility from attack potential (Table G.7)"),
    headers: [
      t(`${K}.feasibilityLevel`, "Attack feasibility"),
      t(`${K}.attackPotential`, "Attack potential"),
    ],
    rows: bands.map((b, i) => {
      const next = bands[i + 1];
      const range = next ? `${b.minPotential}–${next.minPotential - 1}` : `≥ ${b.minPotential}`;
      return [
        t(`tabs.doc.traceability.feasibility.${b.level}`, FEASIBILITY_FALLBACK[b.level] ?? b.level),
        range,
      ];
    }),
  };

  // ── Gate rules ────────────────────────────────────────────────────────────
  const rule = (r: string) => t(`${K}.rule.${r}`, r);
  const gateSection: MethodologySection = {
    title: t(`${K}.gateRules`, "Attack-tree aggregation"),
    intro: t(
      `${K}.gateRulesIntro`,
      "How the children of an AND / OR node combine, per kind of leaf rating. The attack tree's feasibility is the most feasible path (15.8 NOTE 2).",
    ),
    headers: [t(`${K}.ratingKind`, "Leaf rating"), "AND", "OR"],
    rows: Object.entries(m.likelihood.gateRules).map(([kind, r]) => [
      t(`${K}.kind.${kind}`, kind),
      rule(r.AND),
      rule(r.OR),
    ]),
  };

  // ── Treatment options ─────────────────────────────────────────────────────
  const vocabulary = m.treatment.vocabulary as TreatmentVocabulary;
  const treatmentSection: MethodologySection = {
    title: t(`${K}.treatment`, "Risk treatment options (15.9)"),
    intro: t(
      `${K}.treatmentIntro`,
      "The options are stored with TARAflow's values; the report shows the ISO names. A stored \"transfer\" is shown as \"Share (transfer)\" and flagged for review.",
    ),
    headers: [t(`${K}.isoOption`, "ISO option"), t(`${K}.storedValue`, "Stored value")],
    rows: m.treatment.options.map((o) => [
      t(
        `${treatmentI18nKey(o.stored as RiskTreatment, vocabulary)}.label`,
        treatmentFallbackLabel(o.stored as RiskTreatment, vocabulary),
      ),
      o.stored,
    ]),
  };

  // ── Cybersecurity properties (CIANAAA) ──────────────────────────────────
  const propertySection: MethodologySection = {
    title: t(`${K}.properties`, "Cybersecurity properties"),
    intro: t(
      `${K}.propertiesIntro`,
      "Every damage and threat scenario names the compromised property out of these seven. ISO/SAE 21434 (3.1.20) names confidentiality, integrity and availability as examples of cybersecurity properties; the further four are used as properties of their own.",
    ),
    headers: [t(`${K}.goal`, "Property"), t(`${K}.definition`, "Meaning")],
    rows: m.securityProperties.map((goal) => [
      t(`${K}.goalName.${goal}`, goal),
      t(`${K}.propertyDef.${goal}`, goal),
    ]),
  };

  const sections = [overview, bandSection, gateSection, treatmentSection, propertySection];

  // ── Calculation stamps ────────────────────────────────────────────────────
  if (m.calcStamps) {
    const s = m.calcStamps;
    sections.push({
      title: t(`${K}.stamps`, "Calculation versions"),
      intro: t(
        `${K}.stampsIntro`,
        "Values computed now carry these stamps. A risk or attack-tree analysis with another stamp was computed with another version or other tables.",
      ),
      headers: [
        t(`${K}.stamp`, "Stamp"),
        t(`${K}.calcVersion`, "Calculation version"),
        t(`${K}.mappingVersion`, "Tables (hash)"),
      ],
      rows: [
        [t(`${K}.stampRisk`, "Risk"), s.risk.calcVersion, s.risk.mappingVersion],
        [t(`${K}.stampPath`, "Attack-tree analysis"), s.path.calcVersion, s.path.mappingVersion],
      ],
    });
  }

  return {
    intro: t(
      `${K}.intro`,
      "This chapter documents the method the TARA was computed with. It is generated from the project configuration and from the rules the calculation applies, so it cannot describe another method than the one used.",
    ),
    sections,
  };
}
