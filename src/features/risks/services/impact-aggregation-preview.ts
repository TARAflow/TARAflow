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

/**
 * Every risk whose impact or risk value differs between two states of the
 * risk data (same risks, other configuration and/or rating weights). Used for
 * the impact aggregation and the impact weight source (design §6, §5.3).
 */
export function previewRiskDataChange(current: RiskData, next: RiskData): ImpactChangeRow[] {
  const config = current.configuration;
  const label = (v: number) =>
    getRiskLabel(v, config.scale, config.roundingMethod, config.severityThresholds);
  const nextById = new Map((next.risks as Risk[]).map((r) => [r.id, r]));

  const rows: ImpactChangeRow[] = [];
  for (const risk of current.risks as Risk[]) {
    const other = nextById.get(risk.id);
    if (!other) continue;
    const before = calculateRiskValues(risk.factorRatings ?? [], config);
    const after = calculateRiskValues(other.factorRatings ?? [], next.configuration);
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

export function previewImpactAggregation(
  riskData: RiskData,
  next: ImpactAggregation,
): ImpactChangeRow[] {
  return previewRiskDataChange(riskData, {
    ...riskData,
    configuration: { ...riskData.configuration, impactAggregation: next },
  });
}
