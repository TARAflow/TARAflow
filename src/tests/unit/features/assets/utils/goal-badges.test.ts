// tests/unit/features/assets/utils/goal-badges.test.ts
//
// Card (asset dialog) and chips (asset table) render the same badges and
// markers — computed once from goalState(), never assembled per surface.

import { describe, expect, it } from "vitest";
import { goalBadges, goalMarker, goalSourceKey } from "features/assets/utils/goal-badges";
import {
  adjustGoal,
  excludeGoal,
  goalState,
  setGoalImpact,
} from "features/assets/services/asset-goal-state";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import type { Asset } from "features/assets/models/asset-types";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { SecurityGoal, SecurityGoalType } from "features/assets/models/asset-security-goals-types";

const S = "4-level" as const;
const TYPES: SecurityGoalType[] = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];
const r = (criterionId: string, value: number | null | "na"): ImpactRating => ({ criterionId, value });

function asset(ratings: ImpactRating[]): Asset {
  const base = {
    id: "a-1",
    displayId: "DA-001",
    name: "Config DB",
    assetGroup: "data",
    properties: {},
    impactRatings: ratings,
    linkedDFDElements: [{ elementId: "E-1", elementName: "Config push", relationType: "transports" }],
    securityGoals: TYPES.map((type) => ({ type, level: "none", formalDescription: "" })),
  } as unknown as Asset;
  return { ...base, securityGoals: deriveSecurityGoalSuggestions(base, base.securityGoals, S) };
}
const goal = (a: Asset, t: SecurityGoalType) => a.securityGoals.find((g) => g.type === t)!;
const withGoal = (a: Asset, g: SecurityGoal): Asset => ({
  ...a,
  securityGoals: a.securityGoals.map((x) => (x.type === g.type ? g : x)),
});
const ids = (a: Asset, t: SecurityGoalType) =>
  goalBadges(goalState(a, goal(a, t), S), goal(a, t)).map((b) => b.id);

describe("goalSourceKey", () => {
  it("suggested / adjusted / added / excluded", () => {
    const a = asset([r("safety", 4), r("financial_damage", 3)]);
    const st = (x: Asset, t: SecurityGoalType) => goalSourceKey(goalState(x, goal(x, t), S));
    expect(st(a, "I")).toBe("suggested");
    expect(st(withGoal(a, adjustGoal(a, goal(a, "I"), "low", "r", S)), "I")).toBe("adjusted");
    expect(st(withGoal(a, adjustGoal(a, goal(a, "Acc"), "low", "r", S)), "Acc")).toBe("added");
    expect(st(withGoal(a, excludeGoal(a, goal(a, "C"), "r", S)), "C")).toBe("excluded");
  });
});

describe("goalBadges / goalMarker", () => {
  it("source badge first; missing rationale is a badge and a warning", () => {
    const a0 = asset([r("safety", 4)]);
    const a = withGoal(a0, adjustGoal(a0, goal(a0, "I"), "low", "", S));
    expect(ids(a, "I")).toEqual(["source", "rationaleMissing"]);
    expect(goalMarker(goalState(a, goal(a, "I"), S), goal(a, "I"))).toBe("warning");
  });

  it("override above the asset value: badge and error marker", () => {
    const a0 = asset([r("safety", 2)]);
    const a = withGoal(a0, { ...setGoalImpact(goal(a0, "I"), "safety", 3), rationale: "x" });
    expect(ids(a, "I")).toContain("exceedsAsset");
    expect(goalMarker(goalState(a, goal(a, "I"), S), goal(a, "I"))).toBe("error");
  });

  it("assessed suggestion: source only, no marker", () => {
    const a = asset([r("safety", 4), r("operational", 4)]);
    expect(ids(a, "I")).toEqual(["source"]);
    expect(goalMarker(goalState(a, goal(a, "I"), S), goal(a, "I"))).toBeNull();
  });
});
