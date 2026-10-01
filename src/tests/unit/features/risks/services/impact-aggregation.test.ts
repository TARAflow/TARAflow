// tests/unit/features/risks/services/impact-aggregation.test.ts
//
// Risk-impact-aggregation design §5 (rev. 4): the impact of a risk was always
// the weighted mean of its impact factors, so safety 4 next to three harmless
// factors became 1.75. harm-floor never dilutes harm to people/environment;
// max follows ISO/SAE 21434. A configuration without the setting keeps the
// old weighted mean — loading never changes a risk value.

import { describe, expect, it } from "vitest";
import {
  HARM_FACTOR_IDS,
  aggregateImpact,
  type ImpactFactorValue,
} from "features/risks/services/impact-aggregation";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { REGULATION_PRESETS } from "shared";

const f = (factorId: string, value: number, weight = 1): ImpactFactorValue => ({ factorId, value, weight });
const SFOP = (s: number, fi: number, o: number, p: number) =>
  [f("safety", s), f("financial_damage", fi), f("operational", o), f("privacy", p)].filter((x) => x.value > 0);

describe("aggregateImpact — worked examples §5.4", () => {
  const rows: [number[], number, number, number][] = [
    // S F O P        mean   harm-floor  max
    [[4, 1, 1, 1], 1.75, 4, 4],
    [[1, 4, 1, 1], 1.75, 2, 4],
    [[2, 4, 4, 1], 2.75, 3, 4],
    [[0, 3, 1, 0], 2, 2, 3],
  ];
  for (const [[s, fi, o, p], mean, floor, max] of rows) {
    it(`S${s} F${fi} O${o} P${p}`, () => {
      const r = SFOP(s, fi, o, p);
      expect(aggregateImpact(r, "weighted-mean").value).toBeCloseTo(mean);
      expect(aggregateImpact(r, "harm-floor").value).toBeCloseTo(floor);
      expect(aggregateImpact(r, "max").value).toBe(max);
    });
  }
});

describe("aggregateImpact — rules", () => {
  it("absent setting = weighted mean (behaviour before rev. 4)", () => {
    expect(aggregateImpact(SFOP(4, 1, 1, 1), undefined)).toMatchObject({
      value: 1.75,
      method: "weighted-mean",
      basis: { kind: "mean", count: 4 },
    });
  });

  it("harm floor covers safety, physical damage and environment (Q3)", () => {
    expect([...HARM_FACTOR_IDS]).toEqual(["safety", "physical_damage", "environmental"]);
    const r = [f("environmental", 4), f("financial_damage", 1), f("operational", 1)];
    expect(aggregateImpact(r, "harm-floor")).toMatchObject({
      value: 4,
      basis: { kind: "harm-floor", factorId: "environmental" },
    });
    const pd = [f("physical_damage", 3), f("safety", 2), f("reputation", 1)];
    expect(aggregateImpact(pd, "harm-floor").basis).toEqual({ kind: "harm-floor", factorId: "physical_damage" });
  });

  it("harm floor: the mean of the OTHER factors wins when higher; harm does not enter it", () => {
    const r = [f("safety", 1), f("financial_damage", 4), f("operational", 2)];
    expect(aggregateImpact(r, "harm-floor")).toMatchObject({ value: 3, basis: { kind: "mean", count: 2 } });
  });

  it("harm floor: only harm factors rated → highest of them; none rated → mean", () => {
    expect(aggregateImpact([f("safety", 2), f("environmental", 3)], "harm-floor").value).toBe(3);
    expect(aggregateImpact([f("privacy", 2), f("reputation", 4)], "harm-floor").value).toBe(3);
  });

  it("weights apply to the mean, never to the floor or to max", () => {
    const r = [f("safety", 2), f("financial_damage", 4, 3), f("reputation", 1, 1)];
    expect(aggregateImpact(r, "weighted-mean").value).toBeCloseTo((2 + 12 + 1) / 5);
    expect(aggregateImpact(r, "harm-floor").value).toBeCloseTo(13 / 4);
    expect(aggregateImpact([f("safety", 2, 0.1), f("privacy", 3, 5)], "max").value).toBe(3);
  });

  it("nothing rated → 0", () => {
    expect(aggregateImpact([], "harm-floor")).toMatchObject({ value: 0, basis: { kind: "none" } });
  });
});

describe("calculateRiskValues uses the configured aggregation", () => {
  const ratings = [
    { factorId: "safety", value: 4, weight: 1 },
    { factorId: "financial_damage", value: 1, weight: 1 },
    { factorId: "operational", value: 1, weight: 1 },
    { factorId: "privacy", value: 1, weight: 1 },
    { factorId: "skill_level", value: 2, weight: 1 },
  ];

  it("existing configuration (no setting): unchanged", () => {
    const { impactAggregation: _unused, ...legacy } = DEFAULT_CONFIGURATION;
    const r = calculateRiskValues(ratings, legacy);
    expect(r.impact).toBe(1.8);
    expect(r.risk).toBe(3.5);
  });

  it("harm floor: impact 4, risk 8", () => {
    const r = calculateRiskValues(ratings, { ...DEFAULT_CONFIGURATION, impactAggregation: "harm-floor" });
    expect(r).toMatchObject({ impact: 4, likelihood: 2, risk: 8 });
  });
});

describe("preset recommendations §5.2 / rev. 4", () => {
  it("standard, EN 50742 A/B: harm floor; ISO 21434 and ETSI TVRA: max", () => {
    expect(REGULATION_PRESETS.standard.impactAggregation).toBe("harm-floor");
    expect(REGULATION_PRESETS["en-50742-a"].impactAggregation).toBe("harm-floor");
    expect(REGULATION_PRESETS["en-50742-b"].impactAggregation).toBe("harm-floor");
    expect(REGULATION_PRESETS["iso-21434"].impactAggregation).toBe("max");
    expect(REGULATION_PRESETS["etsi-tvra"].impactAggregation).toBe("max");
  });
});
