import { describe, it, expect } from "vitest";
import { tvraAttackPotential, tvraApLevel, tvraRate } from "features/risks";

describe("tvra attack potential (weighted summation)", () => {
  it("is 0 when every factor is at its lowest level", () => {
    expect(
      tvraAttackPotential({
        time: "<=1day",
        expertise: "layman",
        knowledge: "public",
        opportunity: "unlimited",
        equipment: "standard",
        intensity: "single",
      }),
    ).toBe(0);
  });

  it("adds the ETSI-specific intensity factor", () => {
    expect(
      tvraAttackPotential({
        time: "<=1day",
        expertise: "layman",
        knowledge: "public",
        opportunity: "unlimited",
        equipment: "standard",
        intensity: "heavy-multiple",
      }),
    ).toBe(2);
  });

  it("computes the documented high-effort worked example (53)", () => {
    expect(
      tvraAttackPotential({
        time: "<=6months",
        expertise: "expert",
        knowledge: "critical",
        opportunity: "difficult",
        equipment: "bespoke",
        intensity: "heavy-multiple",
      }),
    ).toBe(53); // 17+6+11+10+7+2
  });
});

describe("tvra attack-potential level (CC B.4 bands)", () => {
  it.each([
    [0, "basic"],
    [9, "basic"],
    [10, "enhanced-basic"],
    [13, "enhanced-basic"],
    [14, "moderate"],
    [19, "moderate"],
    [20, "high"],
    [24, "high"],
    [25, "beyond-high"],
  ])("AP %i → %s", (ap, expected) => {
    expect(tvraApLevel(ap as number)).toBe(expected);
  });

  it("throws on a negative attack potential", () => {
    expect(() => tvraApLevel(-1)).toThrow(RangeError);
  });
});

describe("tvraRate", () => {
  it("maps the lowest attack potential to the highest likelihood", () => {
    expect(
      tvraRate({
        time: "<=1day",
        expertise: "layman",
        knowledge: "public",
        opportunity: "unlimited",
        equipment: "standard",
        intensity: "single",
      }),
    ).toEqual({ attackPotential: 0, level: "basic", likelihood: 5 });
  });

  it("maps a beyond-high attack potential to the lowest likelihood", () => {
    expect(
      tvraRate({
        time: "<=6months",
        expertise: "expert",
        knowledge: "critical",
        opportunity: "difficult",
        equipment: "bespoke",
        intensity: "heavy-multiple",
      }),
    ).toEqual({ attackPotential: 53, level: "beyond-high", likelihood: 1 });
  });
});

import {
  TVRA_FACTOR_LEVELS,
  TVRA_TIME_POINTS,
  TVRA_EXPERTISE_POINTS,
  TVRA_KNOWLEDGE_POINTS,
  TVRA_OPPORTUNITY_POINTS,
  TVRA_EQUIPMENT_POINTS,
  TVRA_INTENSITY_POINTS,
} from "features/risks";

describe("TVRA_FACTOR_LEVELS registry", () => {
  const tables: Record<string, Record<string, number>> = {
    time: TVRA_TIME_POINTS,
    expertise: TVRA_EXPERTISE_POINTS,
    knowledge: TVRA_KNOWLEDGE_POINTS,
    etsi_opportunity: TVRA_OPPORTUNITY_POINTS,
    equipment: TVRA_EQUIPMENT_POINTS,
    etsi_intensity: TVRA_INTENSITY_POINTS,
  };

  it("keys are exactly the six TVRA factor ids", () => {
    expect(Object.keys(TVRA_FACTOR_LEVELS).sort()).toEqual(
      Object.keys(tables).sort(),
    );
  });

  it("each registry level list matches its point-table keys 1:1 (order-independent)", () => {
    for (const [id, levels] of Object.entries(TVRA_FACTOR_LEVELS)) {
      expect([...levels].sort()).toEqual(Object.keys(tables[id]).sort());
    }
  });
});