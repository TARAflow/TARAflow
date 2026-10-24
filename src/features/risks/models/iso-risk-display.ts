// ==================== ISO/SAE 21434 RISK VALUE — DISPLAY ====================
// Conformance plan 3a-2 (decision 20 E4): under iso-21434 the risk value 1–5
// replaces `I × L` in register, matrix, filter, dialog and report. Pure
// helpers shared by those views.

import type { FeasibilityBandLevel } from "shared";
import type { RiskConfiguration } from "./risk-config-types";
import type { FactorRating } from "./risk-factor-types";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "./risk-factor-types";
import { RISK_SCALES } from "./risk-scale-types";
import {
  feasibilityFromRiskScaleValue,
  isoFeasibilityFromFactors,
  isoRiskValue,
  type IsoImpactLevel,
  type IsoRisk,
} from "./iso-risk-matrix";

/** The ISO view applies to the iso-21434 risk method (same switch as 0a). */
export function isIsoRiskMode(
  config: Pick<RiskConfiguration, "likelihoodMethod"> | undefined,
): boolean {
  return config?.likelihoodMethod === "iso-21434";
}

/** Values 1–5: the colours of the 5-level risk scale (1 green … 5 purple). */
export function isoRiskValueColor(value: number | undefined): string {
  if (!value) return "#6b7280";
  return RISK_SCALES["5-level"].levels[Math.min(Math.max(value, 1), 5) - 1].color;
}

/**
 * Words for the risk value 1–5 — display only (decision 23): stored,
 * filtered, sorted and reviewed is the number. Own keys, NOT the labels of the
 * TARAflow 5-level risk scale (there "Low" is 1, here 2): ISO 1 is
 * "minimal risk" (RQ-15-16).
 */
export const ISO_RISK_VALUE_FALLBACK = ["Minimal", "Low", "Medium", "High", "Critical"] as const;
export const isoRiskValueI18nKey = (value: number) => `risks.isoRiskValue.${value}`;
export const isoRiskValueFallback = (value: number) =>
  ISO_RISK_VALUE_FALLBACK[Math.min(Math.max(value, 1), 5) - 1];

export const isoImpactI18nKey = (level: IsoImpactLevel) => `risks.iso.impact.${level}`;
export const isoFeasibilityI18nKey = (level: FeasibilityBandLevel) =>
  `risks.iso.feasibility.${level}`;

export const ISO_IMPACT_FALLBACK: Record<IsoImpactLevel, string> = {
  negligible: "Negligible",
  moderate: "Moderate",
  major: "Major",
  severe: "Severe",
};
export const ISO_FEASIBILITY_FALLBACK: Record<FeasibilityBandLevel, string> = {
  "very-low": "Very low",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * The ISO value while the risk dialog edits it: the impact of the damage
 * scenario and a tree-driven feasibility are not edited in the dialog (they
 * come from asset and tree, stored by the app layer); what the dialog edits —
 * the iso_* fallback factors before mitigation and the residual ratings —
 * is applied live, through the same functions as the app layer.
 */
export function liveIsoRisk(
  stored: IsoRisk | undefined,
  factorRatings: readonly FactorRating[] | undefined,
  mitigatedFactorRatings: readonly FactorRating[] | undefined,
  config: Pick<RiskConfiguration, "scale">,
  treeDriven: boolean,
): IsoRisk | undefined {
  if (!stored) return undefined;
  const feasibility = treeDriven
    ? stored.feasibility
    : (isoFeasibilityFromFactors(factorRatings)?.feasibility ?? stored.feasibility);
  const residualTree = mitigatedFactorRatings?.find(
    (f) => f.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
  )?.value;
  const residual =
    feasibilityFromRiskScaleValue(residualTree, config.scale) ??
    isoFeasibilityFromFactors(mitigatedFactorRatings)?.feasibility;
  return {
    impact: stored.impact,
    feasibility,
    value: isoRiskValue(stored.impact, feasibility),
    ...(residual
      ? { residual: { feasibility: residual, value: isoRiskValue(stored.impact, residual) } }
      : {}),
  };
}

/**
 * Risks per ISO value, highest first (group headers: "4 · High ×2").
 * Counts the number, the word is display only.
 */
export function isoValueCounts(
  risks: readonly { isoRisk?: IsoRisk }[],
  word: (value: number) => string,
): { label: string; color: string; count: number }[] {
  const counts = [0, 0, 0, 0, 0];
  for (const r of risks) {
    const v = r.isoRisk?.value;
    if (v) counts[v - 1]++;
  }
  return [5, 4, 3, 2, 1]
    .filter((v) => counts[v - 1] > 0)
    .map((v) => ({ label: `${v} · ${word(v)}`, color: isoRiskValueColor(v), count: counts[v - 1] }));
}
