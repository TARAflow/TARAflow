// ISO/SAE 21434 attack-potential levels get the likelihood dot of the other
// factors (user 2026-10-31): least likely green … most likely red.
import { describe, expect, it } from "vitest";
import { isoFactorLevelColor } from "features/risks/utils/factor-level-options";

describe("isoFactorLevelColor", () => {
  it("five levels (elapsed time): > 6 months green … ≤ 1 day red", () => {
    expect([5, 4, 3, 2, 1].map((i) => isoFactorLevelColor(5, i))).toEqual([
      "#22c55e",
      "#84cc16",
      "#f59e0b",
      "#f59e0b",
      "#ef4444",
    ]);
  });

  it("four levels: one colour each", () => {
    expect([4, 3, 2, 1].map((i) => isoFactorLevelColor(4, i))).toEqual(["#22c55e", "#84cc16", "#f59e0b", "#ef4444"]);
  });

  it("out of range or unrated: no dot", () => {
    expect(isoFactorLevelColor(4, 0)).toBeUndefined();
    expect(isoFactorLevelColor(4, 5)).toBeUndefined();
  });
});
