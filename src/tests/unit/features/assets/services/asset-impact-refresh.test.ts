// src/tests/unit/features/assets/services/asset-impact-refresh.test.ts
//
// refreshOverallImpacts — the Assets tab's recalculation when the calculation
// or rounding method changes (it also runs when the tab first renders). A
// missing stored overallImpact counts as 0: an asset without ratings (e.g. an
// imported component's, before the machine rates it) is not changed to 0 just
// by opening the tab (manual test 0.20, SmokeDetectorController, 2026-11-22).

import { describe, it, expect } from "vitest";
import { refreshOverallImpacts } from "features/assets/services/asset-impact-calculator";
import type { Asset } from "features/assets";

const asset = (id: string, overallImpact: number | undefined, values: number[]): Asset =>
  ({
    id,
    overallImpact,
    impactRatings: values.map((value, i) => ({ criterionId: `c${i}`, value })),
    lastModified: "2026-11-20T08:00:00.000Z",
  }) as unknown as Asset;

describe("refreshOverallImpacts", () => {
  it("an asset without a stored value and without ratings is unchanged (missing = 0)", () => {
    expect(refreshOverallImpacts([asset("cmp-1", undefined, [])], "conservative", "round")).toBeNull();
  });

  it("a stored value matching the ratings is unchanged", () => {
    expect(refreshOverallImpacts([asset("a", 3, [1, 3])], "conservative", "round")).toBeNull();
  });

  it("a stored value that no longer matches is recalculated, the others keep their object", () => {
    const fine = asset("a", 3, [3]);
    const stale = asset("b", 3, [1, 3]);
    const out = refreshOverallImpacts([fine, stale], "average", "round");
    expect(out).not.toBeNull();
    expect(out![0]).toBe(fine);
    expect(out![1].overallImpact).toBe(2); // average of 1 and 3
    expect(out![1].lastModified).not.toBe("2026-11-20T08:00:00.000Z");
  });

  it("a missing value with ratings is still calculated", () => {
    const out = refreshOverallImpacts([asset("a", undefined, [2])], "conservative", "round");
    expect(out![0].overallImpact).toBe(2);
  });
});
