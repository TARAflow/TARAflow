// tests/unit/features/assets/services/asset-goal-state.test.ts
//
// goalState() / goalFindings() and the explicit analyst actions — the single
// domain truth for security goals (design doc §4.1, invariants §4.5).
//
// Fixture: a data asset "transported" by one flow → the graph suggests
// C, I (AuthN is filtered for data). A is not suggested.
//   Confidentiality ← regulatory_compliance, financial_damage, reputation
//   Integrity       ← safety (among others)

import { describe, it, expect } from "vitest";
import {
  adjustGoal,
  excludeGoal,
  goalFindings,
  goalState,
  goalStates,
  initializeMissingSnapshots,
  keepDecision,
  resetToSuggestion,
  severityFor,
} from "features/assets/services/asset-goal-state";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { SecurityGoal, SecurityGoalType } from "features/assets/models/asset-security-goals-types";
import type { Asset } from "features/assets/models/asset-types";

const S = "4-level" as const;
const TYPES: SecurityGoalType[] = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];
const r = (criterionId: string, value: number | null | "na"): ImpactRating => ({ criterionId, value });

function asset(
  impactRatings: ImpactRating[],
  opts: { relations?: string[]; goals?: SecurityGoal[] } = {},
): Asset {
  const relations = opts.relations ?? ["transports"];
  const base = {
    id: "a-1",
    name: "Config DB",
    assetGroup: "data",
    properties: {},
    impactRatings,
    linkedDFDElements: relations.map((relationType, i) => ({
      elementId: `E-${i}`,
      elementName: `Flow ${i}`,
      relationType,
    })),
    securityGoals: TYPES.map((type) => ({ type, level: "none", formalDescription: "" })),
  } as unknown as Asset;
  const goals =
    opts.goals ?? deriveSecurityGoalSuggestions(base, base.securityGoals, S);
  return { ...base, securityGoals: goals };
}

const goal = (a: Asset, t: SecurityGoalType) => a.securityGoals.find((g) => g.type === t)!;
const withGoal = (a: Asset, g: SecurityGoal): Asset => ({
  ...a,
  securityGoals: a.securityGoals.map((x) => (x.type === g.type ? g : x)),
});
const stateOf = (a: Asset, t: SecurityGoalType) => goalState(a, goal(a, t), S);
const findings = (a: Asset, t: SecurityGoalType) =>
  goalFindings(stateOf(a, t), goal(a, t)).map((f) => `${f.code}:${f.severity}${f.reason ? ":" + f.reason : ""}`);

// ──────────────────────────────────────────────────────────────────────────

describe("suggested goals — assessment follows what the level rests on", () => {
  it("mechanism → assessed, no findings", () => {
    const a = asset([r("financial_damage", 3)]);
    expect(stateOf(a, "C")).toMatchObject({ visibility: "card", source: "suggested", assessment: "assessed", displayLevel: "high" });
    expect(findings(a, "C")).toEqual([]);
  });

  it("fallback → provisional (info)", () => {
    const a = asset([r("safety", 3)]);
    expect(stateOf(a, "C").assessment).toBe("provisional");
    expect(findings(a, "C")).toEqual(["GOAL_PROVISIONAL:info"]);
  });

  it("all relevant criteria n/a → no applicable impact (info, may be correct)", () => {
    const a = asset([r("regulatory_compliance", "na"), r("financial_damage", "na"), r("reputation", "na"), r("safety", 4)]);
    expect(stateOf(a, "C")).toMatchObject({ assessment: "no-applicable-impact", level: "low" });
    expect(findings(a, "C")).toEqual(["GOAL_NO_APPLICABLE_IMPACT:info"]);
  });

  it("invariant D: nothing rated → assessment missing, displayLevel null (never a plain Low)", () => {
    const a = asset([]);
    const s = stateOf(a, "C");
    expect(s).toMatchObject({ assessment: "missing", level: "low", displayLevel: null });
    expect(findings(a, "C")).toEqual(["GOAL_UNASSESSED:warning"]);
  });

  it("carries the relations the suggestion rests on", () => {
    expect(stateOf(asset([r("financial_damage", 3)]), "C").suggestionReasons).toEqual(["Flow 0 → transports"]);
  });
});

describe("visibility and source", () => {
  it("not suggested and inactive → hidden", () => {
    expect(stateOf(asset([r("financial_damage", 3)]), "A")).toMatchObject({ visibility: "hidden", assessment: "assessed" });
  });

  it("excluded: suggested goal deliberately deactivated", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const a = withGoal(a0, excludeGoal(a0, goal(a0, "C"), "public data", S));
    expect(stateOf(a, "C")).toMatchObject({ visibility: "excluded", source: "manual", level: "none", rationaleRequired: true });
    expect(findings(a, "C")).toEqual([]);
  });

  it("manually added (not suggested) goal is a card", () => {
    const a0 = asset([r("operational", 3)]);
    const a = withGoal(a0, adjustGoal(a0, goal(a0, "A"), "high", "availability matters", S));
    expect(stateOf(a, "A")).toMatchObject({ visibility: "card", source: "manual", level: "high" });
  });

  it("legacy: active goal without source", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const a = withGoal(a0, { ...goal(a0, "C"), source: undefined, level: "medium" });
    expect(stateOf(a, "C")).toMatchObject({ source: "legacy", assessment: "assessed" });
  });

  it("manual without rationale → warning", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const a = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "medium", "  ", S));
    expect(findings(a, "C")).toEqual(["GOAL_RATIONALE_MISSING:warning"]);
  });
});

describe("stale manual decisions — reason and severity", () => {
  const decided = (ratings: ImpactRating[], relations?: string[]) => {
    const a0 = asset(ratings, { relations });
    return withGoal(a0, adjustGoal(a0, goal(a0, "C"), "medium", "reason", S));
  };
  const later = (a: Asset, ratings: ImpactRating[], relations?: string[]) =>
    ({
      ...a,
      impactRatings: ratings,
      ...(relations
        ? { linkedDFDElements: relations.map((relationType, i) => ({ elementId: `E-${i}`, elementName: `Flow ${i}`, relationType })) }
        : {}),
    }) as Asset;

  it("fresh decision is not stale", () => {
    expect(stateOf(decided([r("financial_damage", 2)]), "C").stale).toBeNull();
  });

  it("level-raised → warning", () => {
    const a = later(decided([r("financial_damage", 2)]), [r("financial_damage", 4)]);
    expect(findings(a, "C")).toEqual(["GOAL_OVERRIDE_STALE:warning:level-raised"]);
  });

  it("level-lowered → info", () => {
    const a = later(decided([r("financial_damage", 4)]), [r("financial_damage", 2)]);
    expect(findings(a, "C")).toEqual(["GOAL_OVERRIDE_STALE:info:level-lowered"]);
  });

  it("basis-changed: same level, different driving criterion → warning", () => {
    const a = later(decided([r("financial_damage", 3)]), [r("financial_damage", "na"), r("reputation", 3)]);
    expect(stateOf(a, "C").suggestion.level).toBe("high");
    expect(findings(a, "C")).toEqual(["GOAL_OVERRIDE_STALE:warning:basis-changed"]);
  });

  it("basis-changed: assessment was missing and now exists", () => {
    const a = later(decided([]), [r("safety", 1)]); // floor → fallback, both "low"
    expect(stateOf(a, "C").stale).toBe("basis-changed");
  });

  it("suggestion-removed: adjusted goal → warning; excluded goal → info", () => {
    const adjusted = later(decided([r("financial_damage", 3)]), [r("financial_damage", 3)], []);
    expect(findings(adjusted, "C")).toEqual(["GOAL_OVERRIDE_STALE:warning:suggestion-removed"]);

    const a0 = asset([r("financial_damage", 3)]);
    const excluded = later(withGoal(a0, excludeGoal(a0, goal(a0, "C"), "public", S)), [r("financial_damage", 3)], []);
    expect(findings(excluded, "C")).toEqual(["GOAL_OVERRIDE_STALE:info:suggestion-removed"]);
  });

  it("suggestion-added: manually added goal is now suggested → info", () => {
    const a0 = asset([r("operational", 3)]);
    const a1 = withGoal(a0, adjustGoal(a0, goal(a0, "A"), "high", "needed", S));
    const a = later(a1, [r("operational", 3)], ["transports", "stores"]); // stores suggests A
    expect(findings(a, "A")).toEqual(["GOAL_OVERRIDE_STALE:info:suggestion-added"]);
  });

  it("manual goal without snapshot (decided before snapshots) → unknown, not stale", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const a = withGoal(a0, { ...goal(a0, "C"), source: "manual", level: "low", rationale: "old" });
    expect(stateOf(a, "C").stale).toBeNull();
  });

  it("severityFor is the single place for the stale severity", () => {
    expect(severityFor("level-raised", false)).toBe("warning");
    expect(severityFor("suggestion-removed", true)).toBe("info");
    expect(severityFor("suggestion-removed", false)).toBe("warning");
  });
});

describe("invariants", () => {
  it("A: a derivation run after an impact change leaves a manual level unchanged", () => {
    const a0 = asset([r("financial_damage", 2)]);
    const a1 = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "medium", "reason", S));
    const changed = { ...a1, impactRatings: [r("financial_damage", 4)] } as Asset;
    const rederived = deriveSecurityGoalSuggestions(changed, changed.securityGoals, S);
    expect(rederived.find((g) => g.type === "C")).toEqual(goal(a1, "C"));
  });

  it("B: a stale decision is flagged, its level is not changed", () => {
    const a0 = asset([r("financial_damage", 2)]);
    const a1 = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "medium", "reason", S));
    const a = { ...a1, impactRatings: [r("financial_damage", 4)] } as Asset;
    expect(stateOf(a, "C")).toMatchObject({ stale: "level-raised", level: "medium" });
  });
});

describe("explicit actions", () => {
  const a0 = asset([r("financial_damage", 2)]);
  const a1 = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "high", "reason", S));
  const raised = { ...a1, impactRatings: [r("financial_damage", 4)] } as Asset;

  it("keepDecision: level stays, snapshot moves → no longer stale", () => {
    const kept = withGoal(raised, keepDecision(raised, goal(raised, "C"), S, "checked again"));
    expect(stateOf(kept, "C")).toMatchObject({ stale: null, level: "high" });
    expect(goal(kept, "C").rationale).toBe("checked again");
  });

  it("resetToSuggestion: back to the derived level, rationale and snapshot gone", () => {
    const reset = resetToSuggestion(raised, goal(raised, "C"), S);
    expect(reset).toMatchObject({ source: "suggested", level: "critical" });
    expect(reset.rationale).toBeUndefined();
    expect(reset.suggestionAtDecision).toBeUndefined();
  });

  it("resetToSuggestion on a manually added, not-suggested goal → inactive", () => {
    const b0 = asset([r("operational", 3)]);
    const b1 = withGoal(b0, adjustGoal(b0, goal(b0, "A"), "high", "x", S));
    expect(resetToSuggestion(b1, goal(b1, "A"), S)).toMatchObject({ level: "none", source: undefined });
  });

  it("initializeMissingSnapshots: only manual goals without a snapshot", () => {
    const legacyManual = withGoal(a0, { ...goal(a0, "C"), source: "manual", level: "low", rationale: "old" });
    const goals = initializeMissingSnapshots(legacyManual, S);
    expect(goals.find((g) => g.type === "C")!.suggestionAtDecision).toMatchObject({ suggested: true, level: "medium" });
    expect(goals.find((g) => g.type === "I")!.suggestionAtDecision).toBeUndefined();
    // already-snapshotted manual goals are untouched
    expect(initializeMissingSnapshots(a1, S).find((g) => g.type === "C")).toBe(goal(a1, "C"));
  });

  it("goalStates returns one state per goal", () => {
    expect(goalStates(a1, S).map((s) => s.type)).toEqual(TYPES);
  });
});

describe("rationale is required for a deviation only", () => {
  it("manual goal sitting on the suggested level needs no rationale", () => {
    const a0 = asset([r("financial_damage", 3)]); // C suggested: high
    const a = withGoal(a0, { ...goal(a0, "C"), source: "manual", level: "high", rationale: "" });
    expect(stateOf(a, "C").rationaleRequired).toBe(false);
    expect(findings(a, "C")).toEqual([]);
  });

  it("another level, an exclusion or an added goal still need one", () => {
    const a0 = asset([r("financial_damage", 3), r("operational", 3)]);
    const adjusted = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "low", "", S));
    const excluded = withGoal(a0, excludeGoal(a0, goal(a0, "C"), "", S));
    const added = withGoal(a0, adjustGoal(a0, goal(a0, "A"), "high", "", S));
    expect(stateOf(adjusted, "C").rationaleRequired).toBe(true);
    expect(stateOf(excluded, "C").rationaleRequired).toBe(true);
    expect(stateOf(added, "A").rationaleRequired).toBe(true);
  });
});
