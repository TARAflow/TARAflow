// tests/unit/features/assets/services/asset-goal-impact.test.ts
//
// Phase 4 (domain): impact per security goal — design doc §4.3.
//   eff(X, g, c) = override(g, c) if present, else asset(X, c)
//   override > asset value → GOAL_OVERRIDE_EXCEEDS_ASSET (error), never capped (invariant E)
//   asset value no active goal reaches → GOAL_ENVELOPE_SLACK (info)

import { describe, it, expect } from "vitest";
import { effectiveGoalRatings, resolveImpactRatings } from "features/assets/services/asset-impact-resolver";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import { assetImpactFindings, goalFindings, goalState, setGoalImpact } from "features/assets/services/asset-goal-state";
import { rationalePrompt } from "features/assets/components/security-goal-card";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { SecurityGoal, SecurityGoalType } from "features/assets/models/asset-security-goals-types";
import type { Asset } from "features/assets/models/asset-types";

const S = "4-level" as const;
const TYPES: SecurityGoalType[] = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];
const r = (criterionId: string, value: number | null | "na"): ImpactRating => ({ criterionId, value });

/** data asset stored + transported → suggests C, I, A */
function asset(ratings: ImpactRating[]): Asset {
  const base = {
    id: "a-1", name: "Config", assetGroup: "data", properties: {}, impactRatings: ratings,
    linkedDFDElements: [
      { elementId: "E-1", elementName: "Flow", relationType: "transports" },
      { elementId: "E-2", elementName: "Store", relationType: "stores" },
    ],
    securityGoals: TYPES.map((type) => ({ type, level: "none", formalDescription: "" })),
  } as unknown as Asset;
  return { ...base, securityGoals: deriveSecurityGoalSuggestions(base, base.securityGoals, S) };
}
const goal = (a: Asset, t: SecurityGoalType) => a.securityGoals.find((g) => g.type === t)!;
/** Apply a goal change and re-derive levels, as the dialog does. */
function withGoal(a: Asset, g: SecurityGoal): Asset {
  const next = { ...a, securityGoals: a.securityGoals.map((x) => (x.type === g.type ? g : x)) };
  return { ...next, securityGoals: deriveSecurityGoalSuggestions(next, next.securityGoals, S) };
}
const value = (rs: ImpactRating[], c: string) => rs.find((x) => x.criterionId === c)?.value;

describe("effective ratings per goal", () => {
  it("an override replaces one criterion; the rest is inherited", () => {
    const a0 = asset([r("financial_damage", 4), r("safety", 3)]);
    const g = setGoalImpact(goal(a0, "C"), "financial_damage", 2);
    const eff = effectiveGoalRatings(a0, g);
    expect(value(eff, "financial_damage")).toBe(2);
    expect(value(eff, "safety")).toBe(3);
  });

  it("resolveImpactRatings merges per criterion (no longer all-or-nothing)", () => {
    const a0 = asset([r("financial_damage", 4), r("safety", 3)]);
    const g = setGoalImpact(goal(a0, "C"), "financial_damage", 1);
    const res = resolveImpactRatings(a0, g);
    expect(res.source).toBe("security-goal");
    expect(value(res.ratings, "safety")).toBe(3);
    expect(resolveImpactRatings(a0, goal(a0, "C")).source).toBe("asset");
  });

  it("the goal's level follows its effective ratings, other goals are untouched", () => {
    const a0 = asset([r("financial_damage", 4), r("safety", 4)]);
    expect(goal(a0, "C").level).toBe("critical");
    const a = withGoal(a0, setGoalImpact(goal(a0, "C"), "financial_damage", 2));
    expect(goal(a, "C").level).toBe("medium");
    expect(goal(a, "I").level).toBe("critical");
  });
});

describe("rationale for a per-goal impact", () => {
  it("a suggested goal with an override needs a rationale, asked as 'impact'", () => {
    const a0 = asset([r("financial_damage", 4)]);
    const a = withGoal(a0, setGoalImpact(goal(a0, "C"), "financial_damage", 2));
    const st = goalState(a, goal(a, "C"), S);
    expect(st).toMatchObject({ rationaleRequired: true, impactOverrides: ["financial_damage"] });
    expect(rationalePrompt(st)).toBe("impact");
    expect(goalFindings(st, goal(a, "C")).map((f) => f.code)).toContain("GOAL_RATIONALE_MISSING");
  });
});

describe("invariant E — override above the asset value", () => {
  it("is flagged as an error; the override stays and applies", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const a1 = withGoal(a0, { ...setGoalImpact(goal(a0, "C"), "financial_damage", 3), rationale: "x" });
    // asset value lowered afterwards
    const a = withGoal({ ...a1, impactRatings: [r("financial_damage", 2)] } as Asset, goal(a1, "C"));
    const st = goalState(a, goal(a, "C"), S);
    expect(st.exceedsAsset).toEqual(["financial_damage"]);
    expect(goalFindings(st, goal(a, "C"))).toContainEqual(
      expect.objectContaining({ code: "GOAL_OVERRIDE_EXCEEDS_ASSET", severity: "error", criterionId: "financial_damage" }),
    );
    expect(value(goal(a, "C").impactRatings!, "financial_damage")).toBe(3); // not capped
    expect(value(effectiveGoalRatings(a, goal(a, "C")), "financial_damage")).toBe(3); // applies
  });

  it("n/a never exceeds; a value where the asset rates n/a does", () => {
    const a0 = asset([r("financial_damage", "na"), r("safety", 3)]);
    const g1 = setGoalImpact(setGoalImpact(goal(a0, "C"), "safety", "na"), "financial_damage", 2);
    expect(goalState(withGoal(a0, g1), g1, S).exceedsAsset).toEqual(["financial_damage"]);
  });
});

describe("GOAL_ENVELOPE_SLACK", () => {
  const a0 = asset([r("safety", 4)]);
  const lower = (a: Asset, t: SecurityGoalType) => withGoal(a, setGoalImpact(goal(a, t), "safety", 2));

  it("no active goal reaches the asset value → info", () => {
    const a = ["C", "I", "A"].reduce((acc, t) => lower(acc, t as SecurityGoalType), a0);
    expect(assetImpactFindings(a)).toEqual([
      expect.objectContaining({ code: "GOAL_ENVELOPE_SLACK", severity: "info", criterionId: "safety" }),
    ]);
  });

  it("one goal still inherits → no slack", () => {
    const a = ["C", "I"].reduce((acc, t) => lower(acc, t as SecurityGoalType), a0);
    expect(assetImpactFindings(a)).toEqual([]);
  });
});

describe("setGoalImpact", () => {
  it("adds, replaces and removes an override; none left → undefined", () => {
    const g0 = goal(asset([r("safety", 3)]), "I");
    const g1 = setGoalImpact(g0, "safety", 2);
    expect(g1.impactRatings).toEqual([{ criterionId: "safety", value: 2 }]);
    expect(setGoalImpact(g1, "safety", 1).impactRatings).toEqual([{ criterionId: "safety", value: 1 }]);
    expect(setGoalImpact(g1, "safety", undefined).impactRatings).toBeUndefined();
  });
});
