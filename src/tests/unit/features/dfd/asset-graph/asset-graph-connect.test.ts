// tests/unit/features/dfd/asset-graph/asset-graph-connect.test.ts
//
// Phase 3, FR-E4/E5/E12: what the type chooser offers for a dragged
// connection — derived from the shared rules only (AR-4).

import { describe, it, expect } from "vitest";
import { planConnection } from "features/dfd/asset-graph/asset-graph-connect";
import {
  classifyA2ATargetGroup,
  getA2ARelationOptions,
  type A2ARelation,
  type AssetGroup,
} from "shared";

const GROUPS: AssetGroup[] = [
  "data", "function", "system", "infrastructure", "process", "physical", "service", "human", "environment",
];
const a = (id: string, assetGroup: AssetGroup) => ({ id, displayId: id.toUpperCase(), assetGroup });
const rel = (id: string, s: string, t: string, relationType: string) =>
  ({ id, sourceAssetId: s, targetAssetId: t, relationType }) as A2ARelation;

function findPair(cls: "valid" | "reverse_only" | "invalid"): [AssetGroup, AssetGroup] {
  for (const s of GROUPS) for (const t of GROUPS) {
    if (s !== t && classifyA2ATargetGroup(s, t).targetClass === cls) return [s, t];
  }
  throw new Error(`no ${cls} pair in the rules`);
}

describe("planConnection", () => {
  it("valid target: the forward types, KERN first, as in the rules", () => {
    const plan = planConnection(a("d", "data"), a("f", "function"), []);
    expect(plan.direction).toBe("forward");
    expect(plan.options.map((o) => [o.relationType, o.kern])).toEqual(
      getA2ARelationOptions("data", "function").map((o) => [o.relationType, o.kern]),
    );
    expect(plan.options.every((o) => o.sourceAssetId === "d" && o.targetAssetId === "f")).toBe(true);
  });

  it("reverse-only target: the types in the other direction, ends swapped (FR-E5)", () => {
    const [s, t] = findPair("reverse_only");
    const plan = planConnection(a("x", s), a("y", t), []);
    expect(plan.direction).toBe("reverse");
    expect(plan.options.length).toBeGreaterThan(0);
    expect(plan.options.every((o) => o.sourceAssetId === "y" && o.targetAssetId === "x")).toBe(true);
  });

  it("no direction allowed: nothing offered", () => {
    const [s, t] = findPair("invalid");
    expect(planConnection(a("x", s), a("y", t), [])).toEqual({ direction: "none", options: [] });
    expect(planConnection(a("x", "data"), a("x", "data"), []).direction).toBe("none");
  });

  it("an existing edge is marked; a mirror counterpart is reported (FR-E12)", () => {
    const plan = planConnection(a("d", "data"), a("f", "function"), [
      rel("r1", "d", "f", "required_by"),
      rel("r2", "f", "d", "reads"),
    ]);
    const req = plan.options.find((o) => o.relationType === "required_by")!;
    expect(req.exists).toBe(true);
    expect(req.mirror?.counterpartExists).toBe(true);
  });
});
