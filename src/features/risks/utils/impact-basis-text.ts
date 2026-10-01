// "How the impact was formed" — one line for the risk dialog
// (risk-impact-aggregation design §5.5), e.g.
//   Impact 4 — Safety Impact (harm floor)
//   Impact 4 — highest factor: Financial Damage
//   Impact 2.5 — weighted mean of 4 factors
// Pure: t and the factor name lookup are injected.

import type { AggregatedImpact } from "../services/impact-aggregation";

type T = (key: string, options?: Record<string, unknown>) => string;
const K = "tabs.risks.dialog.impactBasis";

export function impactBasisText(
  agg: AggregatedImpact,
  t: T,
  factorName: (factorId: string) => string,
): string | null {
  const value = Math.round(agg.value * 10) / 10;
  switch (agg.basis.kind) {
    case "none":
      return null;
    case "harm-floor":
      return t(`${K}.harmFloor`, {
        value,
        factor: factorName(agg.basis.factorId),
        defaultValue: "Impact {{value}} — {{factor}} (harm floor)",
      });
    case "max":
      return t(`${K}.max`, {
        value,
        factor: factorName(agg.basis.factorId),
        defaultValue: "Impact {{value}} — highest factor: {{factor}}",
      });
    case "mean":
      return agg.method === "harm-floor"
        ? t(`${K}.meanOthers`, {
            value,
            count: agg.basis.count,
            defaultValue:
              "Impact {{value}} — weighted mean of {{count}} factor(s); no harm factor is higher",
          })
        : t(`${K}.mean`, {
            value,
            count: agg.basis.count,
            defaultValue: "Impact {{value}} — weighted mean of {{count}} factor(s)",
          });
  }
}
