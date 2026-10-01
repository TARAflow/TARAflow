// ==================== IMPACT AGGREGATION PREVIEW ====================
//
// Changing the impact aggregation of a project with risks is an explicit
// decision (risk-impact-aggregation design §6): before it is applied, the
// analyst sees every risk whose impact or risk value changes — before → after
// — with risk level changes marked (Q5: all impact changes, level changes
// highlighted). Applying recalculates through riskService.updateConfiguration.
//
// Pure.

import type { ImpactAggregation } from "shared";
import type { Risk, RiskData } from "../models/risk-assessment-types";
import { calculateRiskValues, getRiskLabel } from "./risk-calculation-service";

export interface ImpactChangeRow {
  riskId: string;
  threatDisplayId: string;
  impactBefore: number;
  impactAfter: number;
  riskBefore: number;
  riskAfter: number;
  levelBefore: string;
  levelAfter: string;
  /** The risk level (before mitigation) changes. */
  levelChanged: boolean;
}

export function previewImpactAggregation(
  riskData: RiskData,
  next: ImpactAggregation,
): ImpactChangeRow[] {
  const config = riskData.configuration;
  const nextConfig = { ...config, impactAggregation: next };
  const label = (v: number) =>
    getRiskLabel(v, config.scale, config.roundingMethod, config.severityThresholds);

  const rows: ImpactChangeRow[] = [];
  for (const risk of riskData.risks as Risk[]) {
    const before = calculateRiskValues(risk.factorRatings ?? [], config);
    const after = calculateRiskValues(risk.factorRatings ?? [], nextConfig);
    if (before.impact === after.impact && before.risk === after.risk) continue;
    const levelBefore = label(before.risk);
    const levelAfter = label(after.risk);
    rows.push({
      riskId: risk.id,
      threatDisplayId: risk.threatDisplayId,
      impactBefore: before.impact,
      impactAfter: after.impact,
      riskBefore: before.risk,
      riskAfter: after.risk,
      levelBefore,
      levelAfter,
      levelChanged: levelBefore !== levelAfter,
    });
  }
  // Level changes first, then by the size of the impact change.
  return rows.sort(
    (a, b) =>
      Number(b.levelChanged) - Number(a.levelChanged) ||
      Math.abs(b.impactAfter - b.impactBefore) - Math.abs(a.impactAfter - a.impactBefore),
  );
}
