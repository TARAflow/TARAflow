// tests/unit/features/assets/services/asset-impact-resolver.test.ts
//
// PHASE 3 — Impact belongs to the damage scenario, and the category must survive.
//
// Two silent failures this guards against:
//
//   1. A confidentiality loss and an availability loss on the same asset carry
//      the same impact, because impact hangs on the ASSET. That is coarser than
//      either standard allows, and it is invisible — the numbers look fine.
//
//   2. `overallImpact = 4` does not say whether that is a fatality or a
//      reputational dent. Worse, with method = "average", a safety=4 (fatality)
//      surrounded by ten 1s averages to ~1.3 and DISAPPEARS. The register then
//      reports a trivial number for something that kills someone.

import { describe, it, expect } from "vitest";
import {
  averagingWouldBurySafety,
  deriveImpactByCategory,
  findDominantCategory,
  resolveImpactRatings,
} from "features/assets/services/asset-impact-resolver";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { SecurityGoal } from "features/assets/models/asset-security-goals-types";
import type { Asset } from "features/assets/models/asset-types";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

function rating(criterionId: string, value: number | null | "na"): ImpactRating {
  return { criterionId, value };
}

function makeAsset(impactRatings: ImpactRating[] = []): Asset {
  return { id: "A-001", name: "Config DB", impactRatings } as unknown as Asset;
}

function makeGoal(
  type: string,
  impactRatings?: ImpactRating[],
): SecurityGoal {
  return { type, level: "high", impactRatings } as unknown as SecurityGoal;
}

// ──────────────────────────────────────────────────────────────────────────
// Resolution order
// ──────────────────────────────────────────────────────────────────────────

describe("resolveImpactRatings", () => {
  it("REGRESSION: with no override, the asset's ratings apply (existing projects unchanged)", () => {
    // Every project that exists today has no per-goal ratings. They must keep
    // behaving exactly as before — this is why the field is optional and why
    // there is no migration.
    const asset = makeAsset([rating("safety", 3)]);

    const resolved = resolveImpactRatings(asset, makeGoal("C"));

    expect(resolved.source).toBe("asset");
    expect(resolved.ratings).toEqual([rating("safety", 3)]);
  });

  it("a per-goal override wins over the asset default", () => {
    // The whole point: an integrity loss on a controller is safety-relevant, a
    // confidentiality loss on the same controller usually is not.
    const asset = makeAsset([rating("safety", 1)]);
    const goal = makeGoal("I", [rating("safety", 4)]);

    const resolved = resolveImpactRatings(asset, goal);

    expect(resolved.source).toBe("security-goal");
    expect(resolved.securityGoalType).toBe("I");
    expect(resolved.ratings).toEqual([rating("safety", 4)]);
  });

  it("REGRESSION: an EMPTY override array is not treated as 'everything is zero'", () => {
    // An analyst who opens the override editor and saves without entering
    // anything must not silently wipe out the asset's ratings.
    const asset = makeAsset([rating("safety", 3)]);
    const goal = makeGoal("C", []);

    const resolved = resolveImpactRatings(asset, goal);

    expect(resolved.source).toBe("asset");
    expect(resolved.ratings).toEqual([rating("safety", 3)]);
  });

  it("resolves without a security goal at all", () => {
    const asset = makeAsset([rating("financial_damage", 2)]);

    expect(resolveImpactRatings(asset, undefined).source).toBe("asset");
  });

  it("an asset with no ratings resolves to an empty list, not a crash", () => {
    expect(resolveImpactRatings(makeAsset(), undefined).ratings).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Category breakdown (ISO 15.8 NOTE 1)
// ──────────────────────────────────────────────────────────────────────────

describe("deriveImpactByCategory", () => {
  it("maps TARAflow's criteria onto ISO's four categories", () => {
    const byCategory = deriveImpactByCategory([
      rating("safety", 4),
      rating("financial_damage", 2),
      rating("operational", 3),
      rating("privacy", 1),
    ]);

    expect(byCategory.safety).toBe(4);
    expect(byCategory.financial).toBe(2);
    expect(byCategory.operational).toBe(3);
    expect(byCategory.privacy).toBe(1);
  });

  it("collects TARAflow's extra criteria under 'other' (permitted by 15.5 NOTE 2)", () => {
    const byCategory = deriveImpactByCategory([
      rating("reputation", 2),
      rating("environmental", 4),
      rating("supply_chain", 1),
    ]);

    expect(byCategory.other).toBe(4); // max within the category
    expect(byCategory.safety).toBeUndefined();
  });

  it("takes the MAX within a category, never an average", () => {
    // Two moderate financial damages do not average into something milder than
    // either. The category's impact is the worst thing that happens in it.
    const byCategory = deriveImpactByCategory([
      rating("financial_damage", 4),
      // (only one financial criterion exists, so test 'other' which has several)
      rating("reputation", 1),
      rating("environmental", 5),
      rating("supply_chain", 2),
    ]);

    expect(byCategory.other).toBe(5);
  });

  it("REGRESSION: null and 'na' are EXCLUDED, not coerced to 0", () => {
    // Coercing an unrated criterion to 0 would drag a conservative MAX down and
    // make an unrated asset look harmless.
    const byCategory = deriveImpactByCategory([
      rating("safety", null),
      rating("financial_damage", "na"),
      rating("operational", 3),
    ]);

    expect(byCategory.safety).toBeUndefined();
    expect(byCategory.financial).toBeUndefined();
    expect(byCategory.operational).toBe(3);
  });

  it("an unknown criterion id falls into 'other' rather than being dropped", () => {
    const byCategory = deriveImpactByCategory([rating("custom_criterion", 3)]);

    expect(byCategory.other).toBe(3);
  });

  it("no ratings yields all-undefined, not all-zero", () => {
    const byCategory = deriveImpactByCategory([]);

    expect(byCategory.safety).toBeUndefined();
    expect(byCategory.other).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Dominant category — what the risk table shows next to the number
// ──────────────────────────────────────────────────────────────────────────

describe("findDominantCategory", () => {
  it("picks the highest-rated category", () => {
    const byCategory = deriveImpactByCategory([
      rating("safety", 2),
      rating("financial_damage", 4),
    ]);

    expect(findDominantCategory(byCategory)).toBe("financial");
  });

  it("REGRESSION: safety wins ties", () => {
    // If a fatality and a financial loss both rate 4, this is a SAFETY risk.
    // That determines how the organisation must treat it, and burying it behind
    // another category would be a reporting failure.
    const byCategory = deriveImpactByCategory([
      rating("safety", 4),
      rating("financial_damage", 4),
      rating("operational", 4),
    ]);

    expect(findDominantCategory(byCategory)).toBe("safety");
  });

  it("returns undefined when nothing is rated", () => {
    expect(findDominantCategory(deriveImpactByCategory([]))).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// The averaging trap
// ──────────────────────────────────────────────────────────────────────────

describe("averagingWouldBurySafety", () => {
  it("REGRESSION: flags a fatality about to be averaged away", () => {
    // safety=4 among ten 1s averages to ~1.3. The fatality vanishes and the risk
    // register reports a trivial number for something that kills someone.
    const ratings = [
      rating("safety", 4),
      rating("financial_damage", 1),
      rating("reputation", 1),
      rating("operational", 1),
    ];

    expect(averagingWouldBurySafety(ratings, "average")).toBe(true);
  });

  it("does not flag conservative (MAX) — the figure survives", () => {
    const ratings = [rating("safety", 4), rating("reputation", 1)];

    expect(averagingWouldBurySafety(ratings, "conservative")).toBe(false);
  });

  it("does not flag averaging when there is no severe safety rating", () => {
    const ratings = [rating("safety", 2), rating("reputation", 1)];

    expect(averagingWouldBurySafety(ratings, "average")).toBe(false);
  });

  it("does not flag when safety is unrated", () => {
    expect(
      averagingWouldBurySafety([rating("safety", null)], "average"),
    ).toBe(false);
    expect(averagingWouldBurySafety([rating("reputation", 3)], "average")).toBe(
      false,
    );
  });

  it("flags irreversible injury (3), not just fatality (4)", () => {
    expect(averagingWouldBurySafety([rating("safety", 3)], "average")).toBe(true);
  });
});
