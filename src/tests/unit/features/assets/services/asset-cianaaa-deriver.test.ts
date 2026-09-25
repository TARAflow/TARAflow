// tests/unit/features/assets/services/asset-cianaaa-deriver.test.ts
//
// Level derivation for graph-suggested security goals.
//
// The bug this guards against: when every criterion relevant to a goal's cause
// mechanism was marked "na" (deliberately not applicable), the deriver fell
// through to MAX over ALL rated criteria. An asset with safety = 4 thus got
// confidentiality = "critical" although the analyst had just declared
// confidentiality damage not applicable.

import { describe, it, expect } from "vitest";
import {
  computeSuggestedLevel,
  deriveSecurityGoalSuggestions,
  explainLevel,
  explainSuggestion,
} from "features/assets/services/asset-cianaaa-deriver";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type {
  SecurityGoal,
  SecurityGoalType,
} from "features/assets/models/asset-security-goals-types";
import type { Asset } from "features/assets/models/asset-types";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

function rating(criterionId: string, value: number | null | "na"): ImpactRating {
  return { criterionId, value };
}

const ALL_TYPES: SecurityGoalType[] = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];

function emptyGoals(): SecurityGoal[] {
  return ALL_TYPES.map((type) => ({ type, level: "none", formalDescription: "" }));
}

/** data asset "transported" by a flow → graph suggests I, C, AuthN (AuthN filtered for data). */
function dataAsset(impactRatings: ImpactRating[]): Asset {
  return {
    id: "A-001",
    name: "Config DB",
    assetGroup: "data",
    properties: {},
    impactRatings,
    securityGoals: emptyGoals(),
    linkedDFDElements: [
      { elementId: "DF-1", elementName: "Config push", relationType: "transports" },
    ],
  } as unknown as Asset;
}

function levelOf(goals: SecurityGoal[], type: SecurityGoalType) {
  return goals.find((g) => g.type === type)?.level;
}

// Confidentiality ← regulatory_compliance, financial_damage, reputation
const C_NA = [
  rating("regulatory_compliance", "na"),
  rating("financial_damage", "na"),
  rating("reputation", "na"),
];

// ──────────────────────────────────────────────────────────────────────────

describe("explainLevel", () => {
  it("mechanism: MAX over the relevant criteria, reports the driver", () => {
    const e = explainLevel(
      "C",
      [rating("reputation", 2), rating("financial_damage", 3), rating("safety", 4)],
      "4-level",
    );
    expect(e).toEqual({
      kind: "mechanism",
      level: "high",
      criterionId: "financial_damage",
      value: 3,
    });
  });

  it("not-applicable: all relevant criteria 'na' → floor, NOT the MAX of unrelated criteria", () => {
    const e = explainLevel("C", [...C_NA, rating("safety", 4)], "4-level");
    expect(e.kind).toBe("not-applicable");
    expect(e.level).toBe("low");
  });

  it("fallback: relevant criteria unrated → MAX over all rated (incomplete assessment)", () => {
    const e = explainLevel(
      "C",
      [rating("regulatory_compliance", null), rating("safety", 4)],
      "4-level",
    );
    expect(e).toEqual({
      kind: "fallback",
      level: "critical",
      criterionId: "safety",
      value: 4,
    });
  });

  it("partly 'na', partly unrated → still fallback (not yet decided)", () => {
    const e = explainLevel(
      "C",
      [
        rating("regulatory_compliance", "na"),
        rating("financial_damage", null),
        rating("safety", 3),
      ],
      "4-level",
    );
    expect(e.kind).toBe("fallback");
  });

  it("no relevant criterion configured on the asset → fallback, not 'not-applicable'", () => {
    const e = explainLevel("C", [rating("safety", 2)], "4-level");
    expect(e.kind).toBe("fallback");
  });

  it("floor: nothing rated at all", () => {
    expect(explainLevel("C", [], "4-level")).toEqual({ kind: "floor", level: "low" });
  });
});

describe("deriveSecurityGoalSuggestions", () => {
  it("stores the floor for a suggested goal whose relevant criteria are all 'na'", () => {
    const asset = dataAsset([...C_NA, rating("safety", 4)]);
    const goals = deriveSecurityGoalSuggestions(asset, asset.securityGoals, "4-level");
    expect(levelOf(goals, "C")).toBe("low"); // was "critical" before the fix
    expect(levelOf(goals, "I")).toBe("critical"); // integrity ← safety, unaffected
  });

  it("never overwrites a manual goal", () => {
    const asset = dataAsset([rating("safety", 4)]);
    const existing = emptyGoals().map((g) =>
      g.type === "C" ? { ...g, level: "medium" as const, source: "manual" as const } : g,
    );
    const goals = deriveSecurityGoalSuggestions(asset, existing, "4-level");
    expect(goals.find((g) => g.type === "C")).toMatchObject({
      level: "medium",
      source: "manual",
    });
  });

  it("non-suggested goals stay 'none'", () => {
    const asset = dataAsset([rating("operational", 4)]);
    const goals = deriveSecurityGoalSuggestions(asset, asset.securityGoals, "4-level");
    expect(levelOf(goals, "A")).toBe("none"); // "transports" does not suggest A
  });
});

describe("computeSuggestedLevel / explainSuggestion stay consistent with the stored level", () => {
  const cases: Array<[string, ImpactRating[]]> = [
    ["mechanism", [rating("financial_damage", 3)]],
    ["not-applicable", [...C_NA, rating("safety", 4)]],
    ["fallback", [rating("safety", 4)]],
    ["floor", []],
  ];

  it.each(cases)("%s", (_label, ratings) => {
    const asset = dataAsset(ratings);
    const stored = levelOf(
      deriveSecurityGoalSuggestions(asset, asset.securityGoals, "4-level"),
      "C",
    );
    expect(computeSuggestedLevel(asset, "C", "4-level")).toBe(stored);
  });

  it("explainSuggestion names the n/a criteria instead of the unrelated MAX", () => {
    const asset = dataAsset([...C_NA, rating("safety", 4)]);
    const { levelDriver } = explainSuggestion(asset, "C", "4-level");
    expect(levelDriver).toContain("n/a");
    expect(levelDriver).not.toContain("safety");
  });
});
