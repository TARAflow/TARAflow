// tests/unit/features/assets/services/asset-threat-crosscheck.test.ts
//
// Security-goal rework, Phase 6: threat ↔ goal cross-checks. "Violates" is the
// same definition the risk impact uses (violatesGoal): a threat whose linked
// assets carry no active matching goal falls back to the asset values in the
// risk — THREAT_WITHOUT_GOAL makes that visible. GOAL_WITHOUT_THREAT names
// active goals no threat realises.

import { describe, expect, it } from "vitest";
import {
  threatGoalFindings,
  threatsForGoal,
} from "features/assets/services/asset-threat-crosscheck";
import type { Asset } from "features/assets/models/asset-types";
import type { SecurityGoalType } from "features/assets/models/asset-security-goals-types";
import type { StrideCategory, ThreatGoalLink } from "shared";

const asset = (id: string, active: SecurityGoalType[], excluded: SecurityGoalType[] = []): Asset =>
  ({
    id,
    displayId: id.toUpperCase(),
    name: id,
    securityGoals: [
      ...active.map((type) => ({ type, level: "high", source: "suggested", formalDescription: "" })),
      ...excluded.map((type) => ({ type, level: "none", source: "manual", formalDescription: "", rationale: "r" })),
    ],
  }) as unknown as Asset;

const link = (id: string, stride: StrideCategory, ...assetIds: string[]): ThreatGoalLink => ({
  id,
  displayId: id,
  strideCategory: stride,
  linkedAssetIds: assetIds,
});

const codes = (f: ReturnType<typeof threatGoalFindings>) =>
  f.map((x) => `${x.code}:${x.assetId}:${x.strideCategory ?? x.goal}:${x.threats.map((t) => t.id).join(",")}`);

describe("THREAT_WITHOUT_GOAL", () => {
  it("a threat matched on ONE of its linked assets is fine (risk step 2/4)", () => {
    const f = threatGoalFindings([asset("a", ["I"]), asset("b", [])], [link("t1", "T", "a", "b")]);
    expect(codes(f).filter((c) => c.startsWith("THREAT"))).toEqual([]);
  });

  it("no linked asset has a matching active goal → warning on every linked asset, grouped by STRIDE", () => {
    const f = threatGoalFindings(
      [asset("a", ["C"]), asset("b", ["A"])],
      [link("t1", "T", "a", "b"), link("t2", "T", "a"), link("t3", "S", "a")],
    );
    expect(codes(f).filter((c) => c.startsWith("THREAT"))).toEqual([
      "THREAT_WITHOUT_GOAL:a:S:t3",
      "THREAT_WITHOUT_GOAL:a:T:t1,t2",
      "THREAT_WITHOUT_GOAL:b:T:t1",
    ]);
    const t = f.find((x) => x.assetId === "a" && x.strideCategory === "T")!;
    expect(t).toMatchObject({ severity: "warning", goal: "I" });
  });

  it("R is violated through N or Acc", () => {
    const f = threatGoalFindings([asset("a", ["Acc"])], [link("t1", "R", "a")]);
    expect(codes(f).filter((c) => c.startsWith("THREAT"))).toEqual([]);
  });

  it("an excluded goal is not active — the threat violates nothing", () => {
    const f = threatGoalFindings([asset("a", ["C"], ["I"])], [link("t1", "T", "a")]);
    expect(codes(f)).toContain("THREAT_WITHOUT_GOAL:a:T:t1");
  });

  it("threats without a linked (existing) asset are not this check", () => {
    const f = threatGoalFindings([asset("a", ["C"])], [link("t1", "T"), link("t2", "T", "gone"), link("t3", "I", "a")]);
    expect(codes(f).filter((c) => c.startsWith("THREAT"))).toEqual([]);
  });
});

describe("GOAL_WITHOUT_THREAT", () => {
  it("active goal no threat violates → info; excluded goals are not checked", () => {
    const f = threatGoalFindings([asset("a", ["C", "I"], ["A"])], [link("t1", "I", "a")]);
    expect(codes(f)).toEqual(["GOAL_WITHOUT_THREAT:a:I:"]);
    expect(f[0].severity).toBe("info");
  });

  it("no threats at all → nothing to cross-check (e.g. before threat generation)", () => {
    expect(threatGoalFindings([asset("a", ["C", "I"])], [])).toEqual([]);
  });
});

describe("threatsForGoal (card back-reference)", () => {
  it("counts the asset's threats of the goal's STRIDE category", () => {
    const links = [link("t1", "T", "a"), link("t2", "T", "b"), link("t3", "R", "a"), link("t4", "I", "a")];
    expect(threatsForGoal("a", "I", links).map((t) => t.id)).toEqual(["t1"]);
    expect(threatsForGoal("a", "N", links).map((t) => t.id)).toEqual(["t3"]);
    expect(threatsForGoal("a", "Acc", links).map((t) => t.id)).toEqual(["t3"]);
  });
});
