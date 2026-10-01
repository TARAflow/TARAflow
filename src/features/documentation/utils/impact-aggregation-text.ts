// Report sentence: how the impact of the risks in the register was formed
// (risk-impact-aggregation design §5.5, Phase 3). Shown under the risk
// assessment heading in every format.

import type { ImpactAggregation } from "shared";

type Lang = "en" | "de";

const TEXT: Record<Lang, Record<ImpactAggregation, string>> = {
  en: {
    "harm-floor":
      "Impact aggregation: harm floor — the highest of safety, physical damage and environment, or the weighted mean of the other impact factors, whichever is higher.",
    max: "Impact aggregation: maximum — the highest rated impact factor, unweighted.",
    "weighted-mean": "Impact aggregation: weighted mean of all rated impact factors.",
  },
  de: {
    "harm-floor":
      "Impact-Aggregation: Schadens-Untergrenze — der höchste Wert aus Safety, Sachschaden und Umwelt oder der gewichtete Mittelwert der übrigen Impact-Faktoren, je nachdem, was höher ist.",
    max: "Impact-Aggregation: Maximum — der höchste bewertete Impact-Faktor, ungewichtet.",
    "weighted-mean": "Impact-Aggregation: gewichteter Mittelwert aller bewerteten Impact-Faktoren.",
  },
};

/** Absent setting = weighted mean (behaviour before the setting existed). */
export function impactAggregationSentence(
  aggregation: ImpactAggregation | undefined,
  lang: Lang,
): string {
  return TEXT[lang][aggregation ?? "weighted-mean"];
}
