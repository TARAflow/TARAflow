// Design §6: the preset's impact aggregation is taken over directly only while
// there are no risks — then no risk value can change.

import { describe, expect, it } from "vitest";
import { withRecommendedImpactAggregation } from "features/risks/utils/risks-tab-helpers";
import { createDefaultRiskData } from "features/risks/models/risk-assessment-types";

describe("withRecommendedImpactAggregation", () => {
  it("no risks: the recommendation is set", () => {
    const next = withRecommendedImpactAggregation(createDefaultRiskData(), "max");
    expect(next?.configuration.impactAggregation).toBe("max");
  });

  it("risks present: untouched (explicit decision in the configuration)", () => {
    const d = { ...createDefaultRiskData(), risks: [{ id: "r" }] } as never;
    expect(withRecommendedImpactAggregation(d, "max")).toBeNull();
  });

  it("already set or no recommendation: nothing to do", () => {
    const d = createDefaultRiskData();
    const set = { ...d, configuration: { ...d.configuration, impactAggregation: "max" as const } };
    expect(withRecommendedImpactAggregation(set, "max")).toBeNull();
    expect(withRecommendedImpactAggregation(d, undefined)).toBeNull();
  });
});
