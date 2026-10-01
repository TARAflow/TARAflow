// tests/unit/features/risks/services/impact-aggregation-preview.test.ts
//
// Design §6 / Q5: changing the impact aggregation with risks present is an
// explicit decision — the preview lists every risk whose impact or risk value
// changes, risk level changes first.

import { describe, expect, it } from "vitest";
import { previewImpactAggregation } from "features/risks/services/impact-aggregation-preview";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";

const risk = (id: string, ratings: [string, number][]) =>
  ({
    id,
    threatDisplayId: id,
    factorRatings: ratings.map(([factorId, value]) => ({ factorId, value, weight: 1 })),
  }) as never;

const data = (risks: unknown[]): RiskData =>
  ({ configuration: { ...DEFAULT_CONFIGURATION }, risks, lastModified: "" }) as unknown as RiskData;

describe("previewImpactAggregation", () => {
  const d = data([
    // safety 4 among mild factors: 1.75 → 4, likelihood 4 → 7 → 16
    risk("r-level", [["safety", 4], ["financial_damage", 1], ["operational", 1], ["privacy", 1], ["skill_level", 4]]),
    // 2,3 mean 2.5 → max 3: small change, level may stay
    risk("r-small", [["financial_damage", 2], ["operational", 3], ["skill_level", 1]]),
    // single factor: nothing changes
    risk("r-same", [["financial_damage", 3], ["skill_level", 2]]),
  ]);

  it("only changed risks, level changes first, values before → after", () => {
    const rows = previewImpactAggregation(d, "max");
    expect(rows.map((r) => r.riskId)).toEqual(["r-level", "r-small"]);
    expect(rows[0]).toMatchObject({ impactBefore: 1.8, impactAfter: 4, riskAfter: 16, levelChanged: true });
    expect(rows[1]).toMatchObject({ impactBefore: 2.5, impactAfter: 3 });
  });

  it("harm floor leaves risks without harm factors alone", () => {
    const rows = previewImpactAggregation(d, "harm-floor");
    expect(rows.map((r) => r.riskId)).toEqual(["r-level"]);
  });

  it("same aggregation as now → nothing changes", () => {
    expect(previewImpactAggregation(d, "weighted-mean")).toEqual([]);
  });
});
