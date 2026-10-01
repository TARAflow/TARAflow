// ==================== IMPACT AGGREGATION ====================
//
// How the impact factor values of ONE risk become ONE impact
// (risk-impact-aggregation design §5, rev. 4):
//
//   weighted-mean  weighted mean of all rated impact factors. The behaviour
//                  before rev. 4; a configuration without the setting keeps it.
//   harm-floor     max( safety, physical_damage, environmental,
//                       weighted mean of the OTHER rated impact factors ).
//                  Harm to people and environment is never diluted; business
//                  consequences are still weighed against each other.
//   max            the highest rated impact factor, no weights
//                  (ISO/SAE 21434 15.5/15.8: categories rated equally).
//
// The result carries its basis, so the risk dialog and the report can say how
// the impact was formed ("4 — Safety Impact (harm floor)").
//
// Pure. Input = rated impact factors only (value > 0).

import type { ImpactAggregation } from "shared";

/** Impact factors that describe harm to people or the environment (Q3). */
export const HARM_FACTOR_IDS: readonly string[] = ["safety", "physical_damage", "environmental"];

export interface ImpactFactorValue {
  factorId: string;
  value: number;
  weight: number;
}

export type ImpactBasis =
  | { kind: "none" }
  /** Weighted mean of `count` factors (weighted-mean, or harm-floor without a higher harm value). */
  | { kind: "mean"; count: number }
  /** A harm factor sets the impact (harm-floor). */
  | { kind: "harm-floor"; factorId: string }
  /** The highest factor sets the impact (max). */
  | { kind: "max"; factorId: string };

export interface AggregatedImpact {
  value: number;
  basis: ImpactBasis;
  method: ImpactAggregation;
}

/** Absent setting = the behaviour before rev. 4. */
export function effectiveImpactAggregation(
  configured: ImpactAggregation | undefined,
): ImpactAggregation {
  return configured ?? "weighted-mean";
}

function weightedMean(items: readonly ImpactFactorValue[]): number {
  const totalWeight = items.reduce((sum, r) => sum + r.weight, 0);
  if (items.length === 0 || totalWeight <= 0) return 0;
  return items.reduce((sum, r) => sum + r.value * r.weight, 0) / totalWeight;
}

function highest(items: readonly ImpactFactorValue[]): ImpactFactorValue | undefined {
  return items.reduce<ImpactFactorValue | undefined>(
    (best, r) => (!best || r.value > best.value ? r : best),
    undefined,
  );
}

export function aggregateImpact(
  rated: readonly ImpactFactorValue[],
  configured: ImpactAggregation | undefined,
): AggregatedImpact {
  const method = effectiveImpactAggregation(configured);
  const items = rated.filter((r) => r.value > 0);
  if (items.length === 0) return { value: 0, basis: { kind: "none" }, method };

  if (method === "max") {
    const top = highest(items)!;
    return { value: top.value, basis: { kind: "max", factorId: top.factorId }, method };
  }

  if (method === "harm-floor") {
    const harm = highest(items.filter((r) => HARM_FACTOR_IDS.includes(r.factorId)));
    const rest = items.filter((r) => !HARM_FACTOR_IDS.includes(r.factorId));
    const mean = weightedMean(rest);
    // A tie goes to the harm factor: the floor is what explains the value.
    if (harm && harm.value >= mean) {
      return { value: harm.value, basis: { kind: "harm-floor", factorId: harm.factorId }, method };
    }
    return { value: mean, basis: { kind: "mean", count: rest.length }, method };
  }

  return { value: weightedMean(items), basis: { kind: "mean", count: items.length }, method };
}
