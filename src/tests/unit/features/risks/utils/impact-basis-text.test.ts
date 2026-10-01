// Design §5.5 / Phase 3: the risk dialog and the report say how the impact of
// a risk was formed.

import { describe, expect, it } from "vitest";
import { impactBasisText } from "features/risks/utils/impact-basis-text";
import { calculateRiskValues, explainImpact } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { impactAggregationSentence } from "features/documentation/utils/impact-aggregation-text";

const t = (key: string, o?: Record<string, unknown>) =>
  String(o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n]));
const name = (id: string) => ({ safety: "Safety Impact", financial_damage: "Financial Damage" })[id] ?? id;
const r = (factorId: string, value: number) => ({ factorId, value, weight: 1 });
const ratings = [r("safety", 4), r("financial_damage", 2), r("operational", 1), r("skill_level", 3)];
const cfg = (impactAggregation?: "harm-floor" | "max" | "weighted-mean") => ({
  ...DEFAULT_CONFIGURATION,
  ...(impactAggregation ? { impactAggregation } : {}),
});

describe("impactBasisText", () => {
  it("harm floor names the harm factor", () => {
    expect(impactBasisText(explainImpact(ratings, cfg("harm-floor")), t, name)).toBe(
      "Impact 4 — Safety Impact (harm floor)",
    );
  });

  it("harm floor, mean higher: says no harm factor is higher", () => {
    const rs = [r("safety", 1), r("financial_damage", 4), r("operational", 2)];
    expect(impactBasisText(explainImpact(rs, cfg("harm-floor")), t, name)).toBe(
      "Impact 3 — weighted mean of 2 factor(s); no harm factor is higher",
    );
  });

  it("max names the highest factor; weighted mean counts the factors (likelihood not included)", () => {
    expect(impactBasisText(explainImpact(ratings, cfg("max")), t, name)).toBe(
      "Impact 4 — highest factor: Safety Impact",
    );
    expect(impactBasisText(explainImpact(ratings, cfg()), t, name)).toBe(
      "Impact 2.3 — weighted mean of 3 factor(s)",
    );
  });

  it("nothing rated → no line", () => {
    expect(impactBasisText(explainImpact([r("skill_level", 2)], cfg("max")), t, name)).toBeNull();
  });

  it("the explanation is the value the calculation uses", () => {
    for (const a of ["harm-floor", "max", "weighted-mean"] as const) {
      expect(calculateRiskValues(ratings, cfg(a)).impact).toBeCloseTo(
        Math.round(explainImpact(ratings, cfg(a)).value * 10) / 10,
      );
    }
  });
});

describe("report sentence", () => {
  it("per aggregation and language; absent setting = weighted mean", () => {
    expect(impactAggregationSentence("harm-floor", "en")).toMatch(/^Impact aggregation: harm floor/);
    expect(impactAggregationSentence("max", "de")).toMatch(/^Impact-Aggregation: Maximum/);
    expect(impactAggregationSentence(undefined, "en")).toBe(
      "Impact aggregation: weighted mean of all rated impact factors.",
    );
  });
});
