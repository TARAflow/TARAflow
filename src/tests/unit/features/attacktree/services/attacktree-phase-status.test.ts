// The Attack Tree phase status (before: never derived, so an ISO/SAE 21434
// project — the only regime whose progress counts it — never reached 100 %).
import { describe, it, expect } from "vitest";
import { attackTreePhaseStatus } from "features/attacktree/services/attacktree-phase-status";

const tree = (errors = 0) => ({ validation: { errors: Array(errors).fill({}) } }) as never;
const assessed = { sourceStrideMethod: "attack-path", attackTreeAssessment: { treeId: "t1" } };
const unassessed = { sourceStrideMethod: "attack-path" };
const stride = { sourceStrideMethod: "per-element" };

describe("attackTreePhaseStatus", () => {
  it("not started without trees", () => {
    expect(attackTreePhaseStatus([], [assessed])).toBe("not-started");
    expect(attackTreePhaseStatus(undefined, undefined)).toBe("not-started");
  });

  it("incomplete when a tree has validation errors", () => {
    expect(attackTreePhaseStatus([tree(), tree(1)], [assessed])).toBe("incomplete");
  });

  it("in progress while no attack-path risk exists or one is not assessed", () => {
    expect(attackTreePhaseStatus([tree()], [stride])).toBe("in-progress");
    expect(attackTreePhaseStatus([tree()], [assessed, unassessed])).toBe("in-progress");
  });

  it("complete: trees valid, every attack-path risk assessed (STRIDE risks do not count)", () => {
    expect(attackTreePhaseStatus([tree(), tree()], [assessed, stride])).toBe("complete");
  });
});
