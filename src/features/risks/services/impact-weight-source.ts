// ==================== IMPACT WEIGHT SOURCE ====================
//
// One source of weights for impact (risk-impact-aggregation design §5.3,
// phase 4). Asset criteria and risk impact factors are the same quantities —
// the sync copies the value 1:1 — but carried independent weights, so the
// same data gave two different means.
//
// With RiskConfiguration.impactWeightSource === "asset" the asset criterion
// weights (AssetConfiguration.impactCriteria, projected by the app layer as
// AssetDataReference.criterionWeights) are the DEFAULT for the impact factor
// weights. The analyst can override a factor's weight in the risk
// configuration (ActiveFactor.weightManual) — then the override applies, the
// same derived/manual pattern as the factor values. Likelihood weights stay
// in the risk configuration; impact factors without an asset criterion
// (custom factors) keep their own weight.
//
// Absent setting = "risk": the weights of the risk configuration, as before.
// Switching an existing project is an explicit decision with a preview.
//
// Pure.

import type { ImpactWeightSource, RiskConfiguration } from "../models/risk-config-types";
import type { FactorRating } from "../models/risk-factor-types";
import type { Risk, RiskData } from "../models/risk-assessment-types";
import { ALL_PREDEFINED_FACTORS } from "../models/risk-factor-types";
import { calculateRiskValues } from "./risk-calculation-service";

export function effectiveImpactWeightSource(
  configured: ImpactWeightSource | undefined,
): ImpactWeightSource {
  return configured ?? "risk";
}

function isImpactFactor(factorId: string, config: RiskConfiguration): boolean {
  const def = [...ALL_PREDEFINED_FACTORS, ...config.customFactors].find((f) => f.id === factorId);
  return def?.category === "impact";
}

/**
 * The risk data with the asset criterion weights on every impact factor the
 * analyst has not overridden (configuration, ratings before and after
 * mitigation), values recalculated; impactWeightSource set to "asset".
 * Overridden factors keep their weight. Returns null when nothing changes.
 * Every other rating field (source, derived value, provenance) stays.
 */
export function applyAssetImpactWeights(
  riskData: RiskData,
  criterionWeights: Readonly<Record<string, number>> | undefined,
): RiskData | null {
  if (!criterionWeights) return null;
  const config = riskData.configuration;
  const manual = new Set(
    config.activeFactors.filter((af) => af.weightManual).map((af) => af.factorId),
  );
  /** The asset weight a factor follows, or undefined (own weight applies). */
  const weightOf = (factorId: string): number | undefined =>
    isImpactFactor(factorId, config) && !manual.has(factorId) && factorId in criterionWeights
      ? criterionWeights[factorId]
      : undefined;

  let changed = config.impactWeightSource !== "asset";
  const activeFactors = config.activeFactors.map((af) => {
    const w = weightOf(af.factorId);
    if (w === undefined || w === af.weight) return af;
    changed = true;
    return { ...af, weight: w };
  });
  const nextConfig: RiskConfiguration = { ...config, activeFactors, impactWeightSource: "asset" };

  const reweigh = (ratings: FactorRating[]): [FactorRating[], boolean] => {
    let any = false;
    const out = ratings.map((r) => {
      const w = weightOf(r.factorId);
      if (w === undefined || w === r.weight) return r;
      any = true;
      return { ...r, weight: w };
    });
    return [any ? out : ratings, any];
  };

  const risks = riskData.risks.map((risk: Risk) => {
    const [factorRatings, a] = reweigh(risk.factorRatings ?? []);
    const [mitigatedFactorRatings, b] = reweigh(risk.mitigatedFactorRatings ?? []);
    if (!a && !b) return risk;
    changed = true;
    const before = calculateRiskValues(factorRatings, nextConfig);
    const after = calculateRiskValues(mitigatedFactorRatings, nextConfig);
    return {
      ...risk,
      factorRatings,
      mitigatedFactorRatings,
      calculatedImpact: before.impact,
      calculatedLikelihood: before.likelihood,
      calculatedRiskBeforeMitigation: before.risk,
      calculatedRiskAfterMitigation: after.risk,
    };
  });

  return changed ? { ...riskData, configuration: nextConfig, risks } : null;
}
