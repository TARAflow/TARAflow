// ==================== FIX: TREE LIKELIHOOD ON THE RISK SCALE ====================
// Conformance plan decision 21, part of migration 9 → 10 (0.15.0-beta).
//
// Mapping B (attack-tree feasibility level → value on the risk scale) came
// from FeasibilityConfiguration.levelToRiskScale, whose stored default was the
// 5-level table {very-low 1, low 2, medium 3, high 5} — no dialog ever
// replaced it. On a 3- or 4-level risk scale a "high" path therefore wrote a
// likelihood of 5, outside the scale (Headlamp: R = 2.5 × 5 = 12.5 on a
// 4-level scale). The mapping is now derived from the risk scale; this step
// corrects the values already stored on the risks:
//   - attack_tree_likelihood in factorRatings and mitigatedFactorRatings is
//     re-mapped level-wise (old snapshot → level → new table);
//   - the attackTreeAssessment snapshot gets the new table;
//   - impact / likelihood / risk before (and after, when the residual
//     changed) are recomputed with the unchanged risk configuration.
// All presets; 5-level projects are unchanged (same table). No treatment,
// priority or justification is touched.

import {
  feasibilityLevelToRiskScale,
  LEGACY_LEVEL_TO_RISK_SCALE,
} from "../../../shared/models/attack-feasibility-bands";
import { calculateRiskValues } from "../../../features/risks/services/risk-calculation-service";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "../../../features/risks/models/risk-factor-types";

type Ratings = { factorId: string; value: number; weight?: number }[];

export function fixTreeLikelihoodScale(data: any): any {
  const risks = data?.risks;
  const config = risks?.configuration;
  if (!Array.isArray(risks?.risks) || risks.risks.length === 0 || !config) {
    return data;
  }
  const target: Record<string, number> = feasibilityLevelToRiskScale(config.scale);

  let changed = false;
  const fixed = risks.risks.map((risk: any) => {
    const assessment = risk?.attackTreeAssessment;
    if (!assessment) return risk;
    const old: Record<string, number> =
      assessment.levelToRiskScale ?? LEGACY_LEVEL_TO_RISK_SCALE;
    const levelOf = (value: number) =>
      Object.keys(old).find((level) => old[level] === value);

    const remap = (ratings: Ratings | undefined): Ratings | undefined => {
      if (!Array.isArray(ratings)) return ratings;
      let touched = false;
      const next = ratings.map((r) => {
        if (r.factorId !== ATTACK_TREE_LIKELIHOOD_FACTOR_ID || !(r.value > 0)) {
          return r;
        }
        const level = levelOf(r.value);
        const value = level ? target[level] : r.value;
        if (value === r.value) return r;
        touched = true;
        return { ...r, value };
      });
      return touched ? next : ratings;
    };

    const factorRatings = remap(risk.factorRatings);
    const mitigatedFactorRatings = remap(risk.mitigatedFactorRatings);
    const sameSnapshot = Object.keys(target).every(
      (level) => old[level] === target[level],
    );
    if (
      factorRatings === risk.factorRatings &&
      mitigatedFactorRatings === risk.mitigatedFactorRatings &&
      sameSnapshot
    ) {
      return risk;
    }

    changed = true;
    const out: any = {
      ...risk,
      factorRatings,
      mitigatedFactorRatings,
      attackTreeAssessment: { ...assessment, levelToRiskScale: { ...target } },
    };
    if (factorRatings !== risk.factorRatings) {
      const before = calculateRiskValues(factorRatings as any, config);
      out.calculatedImpact = before.impact;
      out.calculatedLikelihood = before.likelihood;
      out.calculatedRiskBeforeMitigation = before.risk;
    }
    if (mitigatedFactorRatings !== risk.mitigatedFactorRatings) {
      out.calculatedRiskAfterMitigation = calculateRiskValues(
        mitigatedFactorRatings as any,
        config,
      ).risk;
    }
    return out;
  });

  return changed ? { ...data, risks: { ...risks, risks: fixed } } : data;
}
