import { describe, it, expect } from "vitest";
import {
  iso21434AttackPotential,
  iso21434Feasibility,
  iso21434RateFeasibility,
} from "features/risks";

describe("iso21434 attack potential (Table G.6)", () => {
  it("sums the five factor point values", () => {
    expect(
      iso21434AttackPotential({
        elapsedTime: "<=1week",
        expertise: "layman",
        knowledge: "public",
        windowOfOpportunity: "easy",
        equipment: "standard",
      }),
    ).toBe(2); // 1+0+0+1+0
  });

  it("computes the documented high-effort worked example (47)", () => {
    expect(
      iso21434AttackPotential({
        elapsedTime: "<=6months",
        expertise: "expert",
        knowledge: "confidential",
        windowOfOpportunity: "difficult",
        equipment: "bespoke",
      }),
    ).toBe(47); // 17+6+7+10+7
  });

  it("maxes at 57", () => {
    expect(
      iso21434AttackPotential({
        elapsedTime: ">6months",
        expertise: "multiple-experts",
        knowledge: "strictly-confidential",
        windowOfOpportunity: "difficult",
        equipment: "multiple-bespoke",
      }),
    ).toBe(57); // 19+8+11+10+9
  });
});

describe("iso21434 feasibility bands (Table G.7)", () => {
  it.each([
    [0, "high"],
    [9, "high"],
    [10, "medium"],
    [13, "medium"],
    [14, "low"],
    [19, "low"],
    [20, "very-low"],
    [57, "very-low"],
  ])("AP %i → %s", (ap, expected) => {
    expect(iso21434Feasibility(ap as number)).toBe(expected);
  });

  it("throws on a negative attack potential", () => {
    expect(() => iso21434Feasibility(-1)).toThrow(RangeError);
  });
});

describe("iso21434RateFeasibility", () => {
  it("returns both attack potential and feasibility", () => {
    expect(
      iso21434RateFeasibility({
        elapsedTime: "<=1day",
        expertise: "layman",
        knowledge: "public",
        windowOfOpportunity: "unlimited",
        equipment: "standard",
      }),
    ).toEqual({ attackPotential: 0, feasibility: "high" });
  });
});

import {
  ISO21434_FACTOR_LEVELS,
  ISO21434_ELAPSED_TIME_POINTS,
  ISO21434_EXPERTISE_POINTS,
  ISO21434_KNOWLEDGE_POINTS,
  ISO21434_WOO_POINTS,
  ISO21434_EQUIPMENT_POINTS,
} from "features/risks";

describe("ISO21434_FACTOR_LEVELS registry", () => {
  const tables: Record<string, Record<string, number>> = {
    iso_elapsed_time: ISO21434_ELAPSED_TIME_POINTS,
    iso_expertise: ISO21434_EXPERTISE_POINTS,
    iso_knowledge: ISO21434_KNOWLEDGE_POINTS,
    iso_window_of_opportunity: ISO21434_WOO_POINTS,
    iso_equipment: ISO21434_EQUIPMENT_POINTS,
  };

  it("keys are exactly the five ISO factor ids", () => {
    expect(Object.keys(ISO21434_FACTOR_LEVELS).sort()).toEqual(
      Object.keys(tables).sort(),
    );
  });

  it("each registry level list matches its point-table keys 1:1 (order-independent)", () => {
    for (const [id, levels] of Object.entries(ISO21434_FACTOR_LEVELS)) {
      expect([...levels].sort()).toEqual(Object.keys(tables[id]).sort());
    }
  });
});